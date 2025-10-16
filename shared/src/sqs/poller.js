const { ReceiveMessageCommand, DeleteMessageCommand, ChangeMessageVisibilityCommand } = require('@aws-sdk/client-sqs');
const { sqsClient } = require('../aws/clients');

async function pollOnce({ queueUrl, waitTimeSec = 20, maxMessages = 1, visibilityTimeoutSec }) {
    const params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: Math.max(1, Math.min(10, maxMessages || 1)),
        WaitTimeSeconds: Math.max(0, Math.min(20, waitTimeSec || 20)),
        VisibilityTimeout: visibilityTimeoutSec,
    };
    const res = await sqsClient.send(new ReceiveMessageCommand(params));
    return res.Messages || [];
}

async function deleteMessage(queueUrl, receiptHandle) {
    await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
}

async function extendVisibility(queueUrl, receiptHandle, visibilityTimeoutSec) {
    await sqsClient.send(new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeoutSec,
    }));
}

async function startPolling({ queueUrl, handler, logger, stopSignal, visibilityTimeoutSec = 900, waitTimeSec = 20 }) {
    const log = logger || console;
    while (!stopSignal?.stopped) {
        try {
            const messages = await pollOnce({ queueUrl, waitTimeSec, visibilityTimeoutSec });
            if (!messages.length) continue;
            for (const msg of messages) {
                const ctx = { messageId: msg.MessageId };
                try {
                    await handler(msg, { extendVisibility: (sec) => extendVisibility(queueUrl, msg.ReceiptHandle, sec) });
                    await deleteMessage(queueUrl, msg.ReceiptHandle);
                    log.info(ctx, 'Message processed');
                } catch (err) {
                    log.error(Object.assign({}, ctx, { error: err?.message || String(err) }), 'Message processing failed');
                    // Leave to redrive policy
                }
            }
        } catch (err) {
            log.error({ error: err?.message || String(err) }, 'Polling error');
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
}

module.exports = {
    pollOnce,
    deleteMessage,
    extendVisibility,
    startPolling,
};


