// A simple placeholder Lambda function
console.log('Loading function');

exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const params = {
            Bucket: bucket,
            Key: key,
        };
        console.log(`A new file '${key}' was uploaded to bucket '${bucket}'.`);
        // TODO: Add logic here, e.g., write metadata to DynamoDB
    }
    return `Successfully processed ${event.Records.length} records.`;
};
