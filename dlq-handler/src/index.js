const { startPolling } = require('../../shared/src/sqs/poller');
const { logger } = require('../../shared/src/logger');
const { updateVideo } = require('../../shared/src/ddb/videos');
const { parseMessageBody } = require('../../shared/src/types/messages');
const dotenv = require('dotenv');
dotenv.config();
const DLQ_TRANSCODE_URL = process.env.SQS_TRANSCODE_DLQ_URL || '';
const DLQ_TRANSCRIBE_URL = process.env.SQS_TRANSCRIBE_DLQ_URL || '';

if (!DLQ_TRANSCODE_URL && !DLQ_TRANSCRIBE_URL) {
    console.error('At least one DLQ URL must be provided');
    process.exit(1);
}

async function handleDlq(message) {
    const body = parseMessageBody(message);
    const videoId = body.videoId;
    const reason = body.errorReason || 'worker failed or timeout';
    const ctx = { videoId, messageId: message.MessageId };
    logger.warn(ctx, 'Handling DLQ message');
    if (videoId) {
        await updateVideo(videoId, { status: 'failed', errorReason: reason });
    }
}

async function main() {
    logger.info({}, 'DLQ handler starting');
    const runs = [];
    if (DLQ_TRANSCODE_URL) runs.push(startPolling({ queueUrl: DLQ_TRANSCODE_URL, handler: handleDlq, logger }));
    if (DLQ_TRANSCRIBE_URL) runs.push(startPolling({ queueUrl: DLQ_TRANSCRIBE_URL, handler: handleDlq, logger }));
    await Promise.all(runs);
}

main().catch((e) => { logger.error({ error: e?.message || String(e) }, 'Fatal'); process.exit(1); });


