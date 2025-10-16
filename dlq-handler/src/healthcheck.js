const { sqsClient } = require('../../shared/src/aws/clients');
const { GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

async function main() {
    const urls = [process.env.SQS_TRANSCODE_DLQ_URL, process.env.SQS_TRANSCRIBE_DLQ_URL].filter(Boolean);
    if (!urls.length) throw new Error('No DLQ URLs');
    for (const url of urls) {
        await sqsClient.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['ApproximateNumberOfMessages'] }));
    }
    process.stdout.write('ok');
}

main().catch((e) => { process.stderr.write(String(e?.message || e)); process.exit(1); });


