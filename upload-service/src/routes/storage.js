const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
// const { authenticateToken } = require('../../shared/middleware/auth');
const {authenticateToken} = require('../middleware/auth');
const { presignUpload, presignDownload, buildMetaKey, uploadBuffer, headObject } = require('../services/s3Service');
const assemblyAI = require('../services/assemblyAIService');
const UploadQueueService = require('../services/uploadQueue');

// Initialize queue service
const uploadQueue = new UploadQueueService();

// Helper function to create initial meta file
async function createInitialMetaFile(videoId) {
    try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const { s3Client } = require('../config/aws');
        
        const metaKey = buildMetaKey(videoId);
        const initialMeta = {
            status: 'processing',
            videoId: videoId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            transcriptId: null,
            summary: null,
            transcript: null,
            confidence: null
        };

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME || 'cab432-a2-n12122882',
            Key: metaKey,
            Body: JSON.stringify(initialMeta, null, 2),
            ContentType: 'application/json'
        });

        await s3Client.send(command);
        console.log(`📝 Created initial meta file for ${videoId}`);
    } catch (error) {
        console.error('❌ Error creating initial meta file:', error);
        throw error;
    }
}

const router = express.Router();

// Generate presigned URL for file upload
router.post('/presign-upload', authenticateToken, async (req, res) => {
    try {
        const { filename, contentType, fileSize } = req.body;
        
        if (!filename || !contentType) {
            return res.status(400).json({ error: 'filename and contentType are required' });
        }

        // Generate unique key for the file
        const fileId = uuidv4();
        const fileExtension = path.extname(filename);
        const key = `uploads/${fileId}${fileExtension}`;

        // Generate presigned URL for upload
        const presignedUrl = await presignUpload(key, contentType, fileSize);

        res.json({
            success: true,
            uploadUrl: presignedUrl,
            key: key,
            fileId: fileId,
            expiresIn: 3600 // 1 hour
        });

    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate presigned URL for file download
router.post('/presign-download', authenticateToken, async (req, res) => {
    try {
        const { key } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: 'key is required' });
        }

        const presignedUrl = await presignDownload(key);

        res.json({
            success: true,
            downloadUrl: presignedUrl,
            key: key,
            expiresIn: 3600 // 1 hour
        });

    } catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process video with AssemblyAI (called by transcoding service)
router.post('/process-assemblyai', authenticateToken, async (req, res) => {
    try {
        const { videoId, s3Key } = req.body;
        
        if (!videoId || !s3Key) {
            return res.status(400).json({ error: 'videoId and s3Key are required' });
        }

        // Queue AssemblyAI processing job
        await uploadQueue.queueAssemblyAIJob({
            videoId,
            s3Key
        });

        res.json({
            success: true,
            message: 'AssemblyAI processing queued',
            videoId: videoId
        });

    } catch (error) {
        console.error('Error queueing AssemblyAI processing:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get video metadata from AssemblyAI
router.get('/metadata/:videoId', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;
        const key = buildMetaKey(videoId);
        
        try {
            // Check if metadata file exists first
            const head = await headObject(key);
            if (!head) {
                // Create initial meta file if it doesn't exist
                await createInitialMetaFile(videoId);
            }
            
            const url = await presignDownload(key);
            return res.json({ videoId, metaUrl: url });
        } catch (_) {
            return res.status(404).json({ error: 'Metadata not found' });
        }
    } catch (error) {
        console.error('Error reading metadata:', error);
        res.status(500).json({ error: 'Failed to read metadata' });
    }
});

// Queue management endpoints
router.post('/queue/start', authenticateToken, async (req, res) => {
    try {
        uploadQueue.startProcessing();
        res.json({
            success: true,
            message: 'Upload queue processing started'
        });
    } catch (error) {
        console.error('Error starting queue processing:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/queue/stop', authenticateToken, async (req, res) => {
    try {
        uploadQueue.stopProcessing();
        res.json({
            success: true,
            message: 'Upload queue processing stopped'
        });
    } catch (error) {
        console.error('Error stopping queue processing:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/queue/status', authenticateToken, async (req, res) => {
    try {
        const status = await uploadQueue.getQueueStatus();
        res.json({
            success: true,
            queueStatus: status,
            isProcessing: uploadQueue.isProcessing
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
