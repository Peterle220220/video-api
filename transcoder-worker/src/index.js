const { startPolling } = require('../../shared/src/sqs/poller');
const { send } = require('../../shared/src/sqs/sender');
const { logger } = require('../../shared/src/logger');
const { S3_INPUT_BUCKET, S3_OUTPUT_BUCKET, downloadToTempFile, uploadFile } = require('../../shared/src/s3/io');
const { updateVideo, appendOutput } = require('../../shared/src/ddb/videos');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { parseMessageBody } = require('../../shared/src/types/messages');
const dotenv = require('dotenv');
dotenv.config();
const QUEUE_URL = process.env.SQS_TRANSCODE_URL || '';
const VISIBILITY_SECONDS = Number(process.env.VISIBILITY_TIMEOUT_SEC || 1200); // 20m default

if (!QUEUE_URL) {
    console.error('SQS_TRANSCODE_URL is required');
    process.exit(1);
}

async function runFfmpegMp4(inputPath, resolution, outPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', inputPath,
            '-vf', `scale=${resolution}`,
            '-c:v', 'libx264', '-preset', process.env.FFMPEG_PRESET || 'medium', '-crf', process.env.FFMPEG_CRF || '23',
            '-c:a', 'aac', '-b:a', '128k',
            '-movflags', '+faststart',
            outPath,
        ];
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        proc.stdout.on('data', (d) => {});
        proc.stderr.on('data', (d) => {});
        proc.on('close', (code) => {
            if (code === 0) return resolve(outPath);
            reject(new Error(`ffmpeg exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

async function handleTranscodeMessage(message) {
    const body = parseMessageBody(message);
    const { videoId, ownerId, inputKey, variants = ['1280x720', '854x480'], outputFormat = 'mp4' } = body;
    const ctx = { videoId, requestId: message.MessageId };
    logger.info(ctx, 'Transcoding started');
    if (!videoId || !inputKey) throw new Error('Missing videoId or inputKey');

    // Idempotency: if status already completed, skip
    try {
        // Light check via outputs later
    } catch (_) {}

    const inputFile = await downloadToTempFile(S3_INPUT_BUCKET, inputKey);
    try {
        for (const res of variants) {
            const out = path.join(os.tmpdir(), `${uuidv4()}_${res}.mp4`);
            await runFfmpegMp4(inputFile, res, out);
            const outKey = `videos/${videoId}/${res}.mp4`;
            await uploadFile(S3_OUTPUT_BUCKET, outKey, out, { contentType: 'video/mp4' });
            await appendOutput(videoId, { resolution: res, key: outKey, format: 'mp4' });
            logger.info(ctx, `Uploaded ${res}`);
            try { fs.unlinkSync(out); } catch (_) {}
        }
        await updateVideo(videoId, { status: 'completed' });
        logger.info(ctx, 'Transcoding completed');

        // Emit transcribe job if configured
        if (process.env.SQS_TRANSCRIBE_URL) {
            const inputUrl = process.env.INPUT_PRESIGN_DISABLED ? null : null; // placeholder; presign at API time
            const payload = { type: 'transcribe', videoId, ownerId, inputKey, presignedUrl: inputUrl };
            await send(process.env.SQS_TRANSCRIBE_URL, payload);
            logger.info(ctx, 'Emitted transcribe job');
        }
    } catch (err) {
        await updateVideo(videoId, { status: 'failed', errorReason: err?.message || String(err) });
        logger.error(Object.assign({}, ctx, { error: err?.message || String(err) }), 'Transcoding failed');
        throw err;
    } finally {
        try { fs.unlinkSync(inputFile); } catch (_) {}
    }
}

async function main() {
    logger.info({}, 'Transcoder worker starting');
    await startPolling({
        queueUrl: QUEUE_URL,
        visibilityTimeoutSec: VISIBILITY_SECONDS,
        handler: handleTranscodeMessage,
        logger,
    });
}

main().catch((e) => {
    logger.error({ error: e?.message || String(e) }, 'Fatal error');
    process.exit(1);
});


