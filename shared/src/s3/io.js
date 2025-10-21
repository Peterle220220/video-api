const { GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../aws/clients');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_S3_BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'cab432-a2-n12122882';
const S3_INPUT_BUCKET = process.env.S3_INPUT_BUCKET || DEFAULT_S3_BUCKET;
const S3_OUTPUT_BUCKET = process.env.S3_OUTPUT_BUCKET || DEFAULT_S3_BUCKET;

function normalizeKey(key) { return String(key).replace(/^\/+/, ''); }

async function presignGet(bucket, key, { expiresIn = 900 } = {}) {
    const command = new GetObjectCommand({ Bucket: bucket, Key: normalizeKey(key) });
    return await getSignedUrl(s3Client, command, { expiresIn });
}

async function headObject(bucket, key) {
    try {
        return await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: normalizeKey(key) }));
    } catch (err) {
        if (err?.name === 'NotFound') return null;
        throw err;
    }
}

async function uploadFile(bucket, key, filePath, { contentType = 'application/octet-stream' } = {}) {
    const read = fs.createReadStream(filePath);
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: normalizeKey(key), Body: read, ContentType: contentType }));
    return { bucket, key: normalizeKey(key) };
}

async function downloadToTempFile(bucket, key) {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: normalizeKey(key) }));
    const tmpFile = path.join(os.tmpdir(), `${uuidv4()}_${path.basename(key)}`);
    await fsp.mkdir(path.dirname(tmpFile), { recursive: true });
    await new Promise((resolve, reject) => {
        const write = fs.createWriteStream(tmpFile);
        res.Body.pipe(write);
        res.Body.on('error', reject);
        write.on('finish', resolve);
        write.on('error', reject);
    });
    return tmpFile;
}

module.exports = {
    S3_INPUT_BUCKET,
    S3_OUTPUT_BUCKET,
    presignGet,
    headObject,
    uploadFile,
    downloadToTempFile,
};


