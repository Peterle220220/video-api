const { sqsClient } = require('../../shared/src/aws/clients');
const { GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

async function main() {
    const url = process.env.SQS_TRANSCRIBE_URL;
    if (!url) throw new Error('SQS_TRANSCRIBE_URL not set');
    await sqsClient.send(new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['ApproximateNumberOfMessages'] }));
    process.stdout.write('ok');
}

main().catch((e) => { process.stderr.write(String(e?.message || e)); process.exit(1); });


