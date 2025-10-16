const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { sqsClient } = require('../aws/clients');

async function send(queueUrl, body, { messageGroupId, messageDeduplicationId } = {}) {
    const params = {
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
    };
    if (messageGroupId) params.MessageGroupId = messageGroupId;
    if (messageDeduplicationId) params.MessageDeduplicationId = messageDeduplicationId;
    const res = await sqsClient.send(new SendMessageCommand(params));
    return res;
}

module.exports = { send };


