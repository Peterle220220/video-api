const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const transcodingService = require('../services/transcodingService');
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

// Start transcoding job (no DB)
router.post('/start', authenticateToken, upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        const { title, description, resolutions } = req.body;
        const videoPath = req.file.path;
        const filename = req.file.filename;
        const fileSize = req.file.size;

        // Create an in-memory video id
        const videoId = uuidv4();

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

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urls = resolutionList.map(r => ({
            resolution: r,
            url: `${baseUrl}/processed/${videoId}/${r}.mp4`
        }));

        res.json({
            success: true,
            message: 'Transcoding job started',
            videoId: videoId,
            filename: filename,
            resolutions: resolutionList,
            status: 'processing',
            urls
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

        // Always include URLs and per-resolution progress for the three target resolutions
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fullResList = ['1920x1080', '1280x720', '854x480'];
        const urls = fullResList.map(r => ({
            resolution: r,
            url: `${baseUrl}/processed/${jobStatus.video_id}/${r}.mp4`
        }));

        const resolutionProgress = fullResList.map(r => {
            const info = (jobStatus.resolution_progress && jobStatus.resolution_progress[r]) || { progress: 0, status: 'pending' };
            return {
                resolution: r,
                progress: Math.max(0, Math.min(100, Number(info.progress) || 0)),
                status: info.status || 'pending',
                url: `${baseUrl}/processed/${jobStatus.video_id}/${r}.mp4`
            };
        });

        res.json({
            job: jobStatus,
            urls,
            resolutionProgress,
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

// Get transcoded videos for a specific video (from in-memory store)
router.get('/videos/:videoId/transcoded', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;

        const transcodedVideos = (transcodingService.transcodedByVideoId.get(videoId) || [])
            .sort((a, b) => b.created_at - a.created_at);

        res.json({
            videoId: videoId,
            transcodedVideos: transcodedVideos
        });

    } catch (error) {
        console.error('Error getting transcoded videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Video file metadata by videoId and resolution
router.get('/metadata/:videoId/:resolution', authenticateToken, async (req, res) => {
    try {
        const { videoId, resolution } = req.params;
        const processedRoot = process.env.PROCESSED_PATH || './processed';
        const filePath = path.join(processedRoot, videoId, `${resolution}.mp4`);

        // Ensure file exists and get size
        const stats = await fs.stat(filePath);

        // Probe metadata
        const info = await transcodingService.getVideoInfo(filePath);
        const videoStream = (info?.streams || []).find(s => s.codec_type === 'video') || {};
        const width = videoStream.width || undefined;
        const height = videoStream.height || undefined;
        const fpsStr = videoStream.avg_frame_rate || videoStream.r_frame_rate || '';
        let fps = undefined;
        if (fpsStr && fpsStr !== '0/0') {
            const parts = String(fpsStr).split('/');
            const num = parseFloat(parts[0]);
            const den = parseFloat(parts[1] || '1');
            if (isFinite(num) && isFinite(den) && den !== 0) {
                fps = Number((num / den).toFixed(2));
            }
        }
        const duration = Number(info?.format?.duration) || undefined;
        const bitrate = Number(info?.format?.bit_rate) || undefined;

        res.json({
            videoId,
            resolution,
            size: stats.size,
            width,
            height,
            fps,
            duration,
            bitrate,
            path: `/processed/${videoId}/${resolution}.mp4`,
            updatedAt: stats.mtime
        });
    } catch (error) {
        console.error('Error getting metadata:', error?.message || error);
        res.status(404).json({ error: 'Metadata not found' });
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

// List transcoded videos library
router.get('/library', authenticateToken, async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(limitParam || '10', 10) || 10));

        const processedRoot = process.env.PROCESSED_PATH || './processed';
        await fs.mkdir(processedRoot, { recursive: true });

        const videoIds = (await fs.readdir(processedRoot, { withFileTypes: true }))
            .filter(d => d.isDirectory())
            .map(d => d.name);

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const items = [];
        for (const videoId of videoIds) {
            const folder = path.join(processedRoot, videoId);
            const files = (await fs.readdir(folder)).filter(name => name.endsWith('.mp4'));
            const resolutions = files.map(name => name.replace('.mp4', ''));
            const urls = files.map(name => ({
                resolution: name.replace('.mp4', ''),
                url: `${baseUrl}/processed/${videoId}/${name}`
            }));
            const stats = fsSync.statSync(folder);
            items.push({
                videoId,
                resolutions,
                urls,
                updatedAt: stats.mtime
            });
        }

        // Sort by updated time desc
        items.sort((a, b) => b.updatedAt - a.updatedAt);

        const totalVideos = items.length;
        const totalPages = Math.max(1, Math.ceil(totalVideos / limit));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const pagedItems = items.slice(start, end);

        res.json({
            count: totalVideos,
            videos: pagedItems,
            pagination: {
                currentPage,
                totalPages,
                totalVideos,
                limit,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1
            }
        });
    } catch (error) {
        console.error('Error listing library:', error);
        res.status(500).json({ error: 'Failed to list transcoded library' });
    }
});

// Delete a transcoded video folder (admin only)
router.delete('/videos/:videoId', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;
        if (!req.user || req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Only admin can delete videos' });
        }
        const processedRoot = process.env.PROCESSED_PATH || './processed';
        const folder = path.join(processedRoot, videoId);

        // Remove folder recursively
        try {
            await fs.rm(folder, { recursive: true, force: true });
        } catch (err) {
            console.warn('Failed to remove folder:', err?.message || err);
        }

        // Remove in-memory records
        try {
            transcodingService.transcodedByVideoId.delete(videoId);
        } catch (_) { }

        res.json({ success: true, message: 'Video deleted' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});
