const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { sendMessage } = require('../services/sqsService');

const router = express.Router();

// Proxy requests to Storage Service
router.post('/storage/presign-upload', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'presign-upload',
            userId: req.user?.id,
            ...req.body
        };
        
        const result = await sendMessage('storage-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Upload request sent to storage service'
        });
    } catch (error) {
        console.error('Proxy presign-upload error:', error);
        res.status(500).json({ error: 'Failed to process upload request' });
    }
});

router.post('/storage/presign-download', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'presign-download',
            userId: req.user?.id,
            ...req.body
        };
        
        const result = await sendMessage('storage-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Download request sent to storage service'
        });
    } catch (error) {
        console.error('Proxy presign-download error:', error);
        res.status(500).json({ error: 'Failed to process download request' });
    }
});

// Proxy requests to Video Processing Service
router.post('/transcoding/start', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'start-transcoding',
            userId: req.user?.id,
            ...req.body
        };
        
        const result = await sendMessage('transcoding-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Transcoding request sent to processing service'
        });
    } catch (error) {
        console.error('Proxy transcoding start error:', error);
        res.status(500).json({ error: 'Failed to process transcoding request' });
    }
});

router.get('/transcoding/status/:jobId', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'get-status',
            jobId: req.params.jobId,
            userId: req.user?.id
        };
        
        const result = await sendMessage('transcoding-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Status request sent to processing service'
        });
    } catch (error) {
        console.error('Proxy status check error:', error);
        res.status(500).json({ error: 'Failed to check job status' });
    }
});

router.get('/transcoding/jobs', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'list-jobs',
            userId: req.user?.id
        };
        
        const result = await sendMessage('transcoding-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Jobs list request sent to processing service'
        });
    } catch (error) {
        console.error('Proxy jobs list error:', error);
        res.status(500).json({ error: 'Failed to get jobs list' });
    }
});

router.get('/transcoding/metrics', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'get-metrics',
            userId: req.user?.id
        };
        
        const result = await sendMessage('transcoding-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'Metrics request sent to processing service'
        });
    } catch (error) {
        console.error('Proxy metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

router.post('/transcoding/test-cpu', authenticateToken, async (req, res) => {
    try {
        const message = {
            action: 'test-cpu',
            userId: req.user?.id,
            ...req.body
        };
        
        const result = await sendMessage('transcoding-queue', message);
        res.json({
            success: true,
            messageId: result.MessageId,
            message: 'CPU test request sent to processing service'
        });
    } catch (error) {
        console.error('Proxy CPU test error:', error);
        res.status(500).json({ error: 'Failed to start CPU test' });
    }
});

module.exports = router;
