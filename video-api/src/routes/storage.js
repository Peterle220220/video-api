const express = require('express');
const { presignUpload, presignDownload, builds3KeyForUpload } = require('../services/storage/s3Service');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Request a presigned URL to upload a file directly to S3
router.post('/presign-upload', authenticateToken, async (req, res) => {
    try {
        const { filename, contentType } = req.body || {};
        if (!filename) return res.status(400).json({ error: 'filename is required' });
        const key = builds3KeyForUpload(filename);
        const url = await presignUpload(key, { contentType: contentType || 'application/octet-stream' });
        res.json({ key, uploadUrl: url });
    } catch (err) {
        console.error('presign-upload error:', err);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});

// v2: return upload key theo chuẩn uploads/{ownerId}/{videoId}.mp4
router.post('/presign-upload-v2', authenticateToken, async (req, res) => {
    try {
        const { filename, contentType } = req.body || {};
        const ownerId = req.user?.id || 'anonymous';
        const videoId = uuidv4();
        const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'mp4';
        const key = `uploads/${ownerId}/${videoId}.${ext}`;
        const url = await presignUpload(key, { contentType: contentType || 'application/octet-stream' });
        res.json({ key, uploadUrl: url, ownerId, videoId });
    } catch (err) {
        console.error('presign-upload-v2 error:', err);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});

// Request a presigned URL to download a file from S3
router.post('/presign-download', authenticateToken, async (req, res) => {
    try {
        const { key } = req.body || {};
        if (!key) return res.status(400).json({ error: 'key is required' });
        const url = await presignDownload(key);
        res.json({ key, downloadUrl: url });
    } catch (err) {
        console.error('presign-download error:', err);
        res.status(500).json({ error: 'Failed to create download URL' });
    }
});

module.exports = router;


