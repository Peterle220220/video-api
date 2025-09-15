const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, S3_BUCKET } = require('../../config/aws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

function normalizeKey(key) {
    return String(key).replace(/^\/+/, '');
}

async function presignUpload(key, { expiresIn = 900, contentType = 'application/octet-stream' } = {}) {
    const command = new PutObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key), ContentType: contentType });
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
}

async function presignDownload(key, { expiresIn = 900 } = {}) {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key) });
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
}

async function uploadBuffer(key, buffer, { contentType = 'application/octet-stream', metadata } = {}) {
    await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key), Body: buffer, ContentType: contentType, Metadata: metadata }));
    return { bucket: S3_BUCKET, key: normalizeKey(key) };
}

async function uploadFileStream(key, stream, { contentType = 'application/octet-stream', metadata } = {}) {
    await s3Client.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key), Body: stream, ContentType: contentType, Metadata: metadata }));
    return { bucket: S3_BUCKET, key: normalizeKey(key) };
}

async function headObject(key) {
    try {
        const res = await s3Client.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key) }));
        return res;
    } catch (err) {
        if (err && err.name === 'NotFound') return null;
        throw err;
    }
}

async function deleteObject(key) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key) }));
}

async function listPrefix(prefix, { continuationToken, maxKeys = 1000 } = {}) {
    const res = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: normalizeKey(prefix), ContinuationToken: continuationToken, MaxKeys: maxKeys }));
    return res;
}

function builds3KeyForUpload(filename) {
    const base = path.basename(filename);
    return `uploads/${Date.now()}_${base}`;
}

function buildProcessedKey(videoId, resolution) {
    return `processed/${videoId}/${resolution}.mp4`;
}

function buildMetaKey(videoId) {
    return `meta/${videoId}.json`;
}

async function downloadToTempFile(key) {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key) }));
    const tmpFile = path.join(os.tmpdir(), `${uuidv4()}_${path.basename(key)}`);
    await new Promise((resolve, reject) => {
        const write = fs.createWriteStream(tmpFile);
        res.Body.pipe(write);
        res.Body.on('error', reject);
        write.on('finish', resolve);
        write.on('error', reject);
    });
    return tmpFile;
}

async function getObjectText(key) {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: normalizeKey(key) }));
    const chunks = [];
    await new Promise((resolve, reject) => {
        res.Body.on('data', (chunk) => chunks.push(chunk));
        res.Body.on('end', resolve);
        res.Body.on('error', reject);
    });
    return Buffer.concat(chunks).toString('utf-8');
}

async function getObjectJson(key) {
    const text = await getObjectText(key);
    try { return JSON.parse(text); } catch (_) { return null; }
}

async function deletePrefix(prefix) {
    const listed = await listPrefix(prefix);
    const keys = (listed.Contents || []).map(o => ({ Key: o.Key }));
    if (keys.length === 0) return;
    if (keys.length <= 1000) {
        await s3Client.send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: keys } }));
    } else {
        // fallback: delete one by one if more than 1000 (simple implementation)
        for (const k of keys) {
            await deleteObject(k.Key);
        }
    }
}

module.exports = {
    presignUpload,
    presignDownload,
    uploadBuffer,
    uploadFileStream,
    headObject,
    deleteObject,
    listPrefix,
    builds3KeyForUpload,
    buildProcessedKey,
    buildMetaKey,
    downloadToTempFile,
    getObjectText,
    getObjectJson,
    deletePrefix
};


