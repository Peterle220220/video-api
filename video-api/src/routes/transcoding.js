const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const transcodingService = require('../services/transcodingService');
const Video = require('../models/Video');
const TranscodedVideo = require('../models/TranscodedVideo');
const { getCurrentCPUUsage, getCPUUsageHistory, getSystemInfo, getMemoryUsage } = require('../utils/cpuMonitor');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper: parse human-readable size (e.g., 500MB, 1GB, 1048576) to bytes
function parseFileSizeToBytes(value) {
    if (!value) return 500 * 1024 * 1024; // default 500MB
    if (typeof value === 'number') return value;
    const str = String(value).trim();
    // If pure number, treat as bytes
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(kb|kib|k|mb|mib|m|gb|gib|g|tb|tib|t)$/i);
    if (!match) return 500 * 1024 * 1024;
    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    const TB = GB * 1024;
    switch (unit) {
        case 'kb':
        case 'kib':
        case 'k':
            return Math.floor(num * KB);
        case 'mb':
        case 'mib':
        case 'm':
            return Math.floor(num * MB);
        case 'gb':
        case 'gib':
        case 'g':
            return Math.floor(num * GB);
        case 'tb':
        case 'tib':
        case 't':
            return Math.floor(num * TB);
        default:
            return 500 * 1024 * 1024;
    }
}

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseFileSizeToBytes(process.env.MAX_FILE_SIZE)
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|avi|mov|mkv|wmv|flv|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'));
        }
    }
});

// Start transcoding job
router.post('/start', authenticateToken, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        const { title, description, resolutions } = req.body;
        const videoPath = req.file.path;
        const filename = req.file.filename;
        const fileSize = req.file.size;

        // Save video record to database
        const video = new Video({
            title: title || 'Untitled Video',
            description: description || '',
            filename,
            original_path: videoPath,
            size: fileSize,
            user_id: req.user._id,
            status: 'uploaded'
        });

        await video.save();
        const videoId = video._id;

        // Parse resolutions
        const resolutionList = resolutions ? JSON.parse(resolutions) : ['1920x1080', '1280x720', '854x480'];

        // Start transcoding in background
        transcodingService.transcodeVideo(videoId, videoPath, resolutionList)
            .then(result => {
                console.log(`✅ Transcoding completed for video ${videoId}:`, result);
            })
            .catch(error => {
                console.error(`❌ Transcoding failed for video ${videoId}:`, error);
            });

        res.json({
            success: true,
            message: 'Transcoding job started',
            videoId: videoId,
            filename: filename,
            resolutions: resolutionList,
            status: 'processing'
        });

    } catch (error) {
        console.error('Error starting transcoding:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get transcoding job status
router.get('/status/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobStatus = await transcodingService.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get current CPU usage
        const cpuUsage = await getCurrentCPUUsage();

        res.json({
            job: jobStatus,
            currentCPUUsage: cpuUsage,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting job status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all active transcoding jobs
router.get('/jobs', authenticateToken, async (req, res) => {
    try {
        const activeJobs = await transcodingService.getActiveJobs();
        const cpuUsage = await getCurrentCPUUsage();
        const systemInfo = getSystemInfo();
        const memoryUsage = getMemoryUsage();

        res.json({
            activeJobs,
            systemMetrics: {
                cpuUsage,
                memoryUsage,
                systemInfo
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting active jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel transcoding job
router.delete('/cancel/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        await transcodingService.cancelJob(jobId);

        res.json({
            success: true,
            message: 'Job cancelled successfully',
            jobId: jobId
        });

    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get system metrics
router.get('/metrics', authenticateToken, async (req, res) => {
    try {
        const cpuUsage = await getCurrentCPUUsage();
        const cpuHistory = getCPUUsageHistory();
        const systemInfo = getSystemInfo();
        const memoryUsage = getMemoryUsage();

        res.json({
            cpu: {
                current: cpuUsage,
                history: cpuHistory.slice(-20) // Last 20 readings
            },
            memory: memoryUsage,
            system: systemInfo,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get transcoded videos for a specific video
router.get('/videos/:videoId/transcoded', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;

        const transcodedVideos = await TranscodedVideo.find({ video_id: videoId })
            .sort({ created_at: -1 })
            .lean();

        res.json({
            videoId: videoId,
            transcodedVideos: transcodedVideos
        });

    } catch (error) {
        console.error('Error getting transcoded videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clean up completed jobs
router.post('/cleanup', authenticateToken, async (req, res) => {
    try {
        await transcodingService.cleanupCompletedJobs();

        res.json({
            success: true,
            message: 'Cleanup completed successfully'
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test CPU-intensive operation
router.post('/test-cpu', authenticateToken, async (req, res) => {
    try {
        const { duration = 30 } = req.body; // Default 30 seconds

        console.log(`🔥 Starting CPU test for ${duration} seconds`);

        // Start CPU-intensive operation
        const startTime = Date.now();
        const cpuUsageHistory = [];

        const interval = setInterval(async () => {
            const cpuUsage = await getCurrentCPUUsage();
            cpuUsageHistory.push({ timestamp: new Date().toISOString(), usage: cpuUsage });

            const elapsed = (Date.now() - startTime) / 1000;
            console.log(`📊 CPU Test - Elapsed: ${elapsed.toFixed(1)}s, CPU: ${cpuUsage}%`);

            if (elapsed >= duration) {
                clearInterval(interval);
                console.log('✅ CPU test completed');
            }
        }, 1000);

        // Simulate CPU-intensive work
        const cpuIntensiveWork = () => {
            let result = 0;
            for (let i = 0; i < 1000000; i++) {
                result += Math.sqrt(i) * Math.sin(i);
            }
            return result;
        };

        // Run CPU-intensive work in background
        const workInterval = setInterval(() => {
            cpuIntensiveWork();
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed >= duration) {
                clearInterval(workInterval);
            }
        }, 100);

        res.json({
            success: true,
            message: `CPU test started for ${duration} seconds`,
            startTime: new Date().toISOString(),
            duration: duration
        });

    } catch (error) {
        console.error('Error starting CPU test:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
