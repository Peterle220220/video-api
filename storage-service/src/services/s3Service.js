const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({ 
    region: process.env.AWS_REGION || 'ap-southeast-2' 
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

function builds3KeyForUpload(filename) {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = filename.split('.').pop();
    return `uploads/${uuid}_${timestamp}.${extension}`;
}

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
    return response.Body;
}

async function listPrefix(prefix) {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix
    });
    
    return await s3Client.send(command);
}

async function deletePrefix(prefix) {
    const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    
    const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (listResponse.Contents && listResponse.Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
                Objects: listResponse.Contents.map(obj => ({ Key: obj.Key }))
            }
        });
        
        return await s3Client.send(deleteCommand);
    }
}

async function deleteObject(key) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    
    return await s3Client.send(command);
}

module.exports = {
    presignUpload,
    presignDownload,
    builds3KeyForUpload,
    buildProcessedKey,
    buildMetaKey,
    headObject,
    uploadFileStream,
    uploadBuffer,
    downloadToTempFile,
    listPrefix,
    deletePrefix,
    deleteObject
};
