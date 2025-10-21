const { startPolling } = require('../../shared/src/sqs/poller');
const { logger } = require('../../shared/src/logger');
const { parseMessageBody } = require('../../shared/src/types/messages');
const { getVideo, updateVideo } = require('../../shared/src/ddb/videos');
const { presignGet, S3_INPUT_BUCKET } = require('../../shared/src/s3/io');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const dotenv = require('dotenv');
dotenv.config();
const QUEUE_URL = process.env.SQS_TRANSCRIBE_URL || '';
const AAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || process.env.AAI_API_KEY || '';

if (!QUEUE_URL) { console.error('SQS_TRANSCRIBE_URL is required'); process.exit(1); }
if (!AAI_API_KEY) { console.error('ASSEMBLYAI_API_KEY is required'); process.exit(1); }

async function callAssemblyAIFromS3(inputUrl) {
    const uploadRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'Authorization': AAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: inputUrl, summarization: true, summary_model: 'informative', summary_type: 'paragraph' })
    });
    if (!uploadRes.ok) throw new Error(`AAI request failed: ${uploadRes.status}`);
    const job = await uploadRes.json();
    const id = job.id;
    const start = Date.now();
    while (true) {
        const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: { Authorization: AAI_API_KEY } });
        if (!res.ok) throw new Error(`AAI poll failed: ${res.status}`);
        const data = await res.json();
        if (data.status === 'completed') return data;
        if (data.status === 'error') throw new Error(data.error || 'AAI error');
        if (Date.now() - start > 10 * 60 * 1000) throw new Error('AAI timeout');
        await new Promise(r => setTimeout(r, 3000));
    }
}

async function handleMessage(message) {
    const body = parseMessageBody(message);
    const { videoId, ownerId, inputKey } = body;
    const ctx = { videoId, requestId: message.MessageId };
    logger.info(ctx, 'Transcribe started');
    if (!videoId || !inputKey) throw new Error('Missing videoId/inputKey');

    // Build a public or presigned URL (assume CloudFront or S3 presign externally), here simply form s3:// is not supported -> require presigner upstream
    let s3Url = body.inputUrl || body.presignedUrl;
    if (!s3Url) {
        // Generate presigned URL from inputKey
        s3Url = await presignGet(S3_INPUT_BUCKET, inputKey);
    }

    try {
        const result = await callAssemblyAIFromS3(s3Url);
        await updateVideo(videoId, { transcriptText: result.text || '', status: 'completed' });
        logger.info(ctx, 'Transcribe completed');
    } catch (err) {
        await updateVideo(videoId, { status: 'failed', errorReason: err?.message || String(err) });
        logger.error(Object.assign({}, ctx, { error: err?.message || String(err) }), 'Transcribe failed');
        throw err;
    }
}

async function main() {
    logger.info({}, 'Transcribe worker starting');
    await startPolling({ queueUrl: QUEUE_URL, handler: handleMessage, logger });
}

main().catch((e) => { logger.error({ error: e?.message || String(e) }, 'Fatal'); process.exit(1); });


