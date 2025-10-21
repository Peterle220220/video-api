const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const os = require('os');

const s3Client = new S3Client({ 
    region: process.env.AWS_REGION || 'ap-southeast-2' 
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

function buildProcessedKey(videoId, resolution) {
    return `processed/${videoId}/${resolution}.mp4`;
}

function buildMetaKey(videoId) {
    return `meta/${videoId}.json`;
}

async function presignUpload(key, options = {}) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: options.contentType || 'application/octet-stream',
        ...options
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function presignDownload(key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

async function headObject(key) {
    const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    
    try {
        return await s3Client.send(command);
    } catch (error) {
        if (error.name === 'NotFound') {
            return null;
        }
        throw error;
    }
}

async function uploadFileStream(key, stream, options = {}) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: stream,
        ContentType: options.contentType || 'application/octet-stream',
        ...options
    });
    
    return await s3Client.send(command);
}

async function uploadBuffer(key, buffer, options = {}) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        ...options
    });
    
    return await s3Client.send(command);
}

async function downloadToTempFile(key) {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    
    const response = await s3Client.send(command);
    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}_${path.basename(key)}`);
    
    // Write to temporary file
    const writeStream = fs.createWriteStream(tempPath);
    response.Body.pipe(writeStream);
    
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(tempPath));
        writeStream.on('error', reject);
    });
}

module.exports = {
    presignUpload,
    presignDownload,
    buildProcessedKey,
    buildMetaKey,
    headObject,
    uploadFileStream,
    uploadBuffer,
    downloadToTempFile
};
