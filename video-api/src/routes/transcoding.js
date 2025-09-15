const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const transcodingService = require('../services/transcodingService');
const { getCurrentCPUUsage, getCPUUsageHistory, getSystemInfo, getMemoryUsage } = require('../utils/cpuMonitor');
const { authenticateToken } = require('../middleware/auth');
const assemblyAI = require('../services/external/assemblyAIService');
const { listPrefix, presignDownload, buildProcessedKey, buildMetaKey, deletePrefix, headObject, getObjectJson, deleteObject } = require('../services/storage/s3Service');
const { putVideo, putJob, getJob, updateJob, queryJobsByVideoId, updateVideoDescription } = require('../services/db/dynamoService');

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

// Start transcoding job: supports either direct multipart upload (legacy) or S3 key input
router.post('/start', authenticateToken, upload.single('video'), async (req, res) => {
    try {
        const { title, description, resolutions, s3Key } = req.body;
        let videoId = uuidv4();
        let inputSource = null;
        let filename = null;
        if (s3Key) {
            inputSource = { type: 's3', key: String(s3Key) };
            filename = s3Key.split('/').pop();
        } else if (req.file) {
            inputSource = { type: 'local', path: req.file.path };
            filename = req.file.filename;
        } else {
            return res.status(400).json({ error: 'Provide either s3Key or multipart video' });
        }

        // Parse resolutions; default to lower set for small instances
        let resolutionList = ['1280x720', '854x480'];
        if (resolutions) {
            try {
                const parsed = JSON.parse(resolutions);
                if (Array.isArray(parsed) && parsed.length) {
                    resolutionList = parsed;
                }
            } catch (e) {
                // keep defaults if parse fails
            }
        }

        // Create video record in DynamoDB
        try {
            await putVideo({
                video_id: videoId,
                title: title || filename || 'Untitled',
                description: description || '',
                owner: req.user?.id || 'unknown',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                source: inputSource.type === 's3' ? { s3_key: inputSource.key } : { local: true },
                resolutions: resolutionList
            });
        } catch (e) {
            console.warn('putVideo failed (continuing):', e?.message || e);
        }

        // Start transcoding in background (it will handle S3/local inputs)
        transcodingService.transcodeVideo(videoId, inputSource, resolutionList)
            .then(result => {
                console.log(`✅ Transcoding completed for video ${videoId}:`, result);
            })
            .catch(error => {
                console.error(`❌ Transcoding failed for video ${videoId}:`, error);
            });

        // Start background AssemblyAI processing for transcript/summary (best-effort)
        try {
            assemblyAI.processVideoForSummary(videoId, inputSource)
                .then(meta => {
                    console.log(`📝 AssemblyAI summary completed for video ${videoId}`);
                })
                .catch(err => {
                    console.warn(`AssemblyAI processing failed for video ${videoId}:`, err?.message || err);
                });
        } catch (_) { /* ignore fire-and-forget errors */ }

        // Return presigned URLs for expected outputs
        const urls = await Promise.all(resolutionList.map(async (r) => {
            const key = buildProcessedKey(videoId, r);
            const url = await presignDownload(key).catch(() => null);
            return { resolution: r, url };
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

// Get transcoding job status (from DynamoDB)
router.get('/status/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const jobStatus = await getJob(jobId);

        if (!jobStatus) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Get current CPU usage
        const cpuUsage = await getCurrentCPUUsage();

        // Always include URLs and per-resolution progress for the three target resolutions
        const fullResList = ['1920x1080', '1280x720', '854x480'];
        const urls = fullResList.map(r => ({
            resolution: r,
            url: null
        }));
        for (const u of urls) {
            try { u.url = await presignDownload(buildProcessedKey(jobStatus.video_id, u.resolution)); } catch (_) {}
        }

        const resolutionProgress = fullResList.map(r => {
            const info = (jobStatus.resolution_progress && jobStatus.resolution_progress[r]) || { progress: 0, status: 'pending' };
            return {
                resolution: r,
                progress: Math.max(0, Math.min(100, Number(info.progress) || 0)),
                status: info.status || 'pending',
                url: urls.find(u => u.resolution === r)?.url || null
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

// Get all active transcoding jobs (processing/pending)
router.get('/jobs', authenticateToken, async (req, res) => {
    try {
        // For simplicity, query by recent videos and statuses is not included here; client often calls status/:id.
        // Optionally, you can maintain a separate GSI on status.
        const activeJobs = []; 
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

// Get transcoded videos for a specific video (list from S3)
router.get('/videos/:videoId/transcoded', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;
        const prefix = `processed/${videoId}/`;
        const listed = await listPrefix(prefix);
        const transcodedVideos = (listed.Contents || [])
            .filter(o => o.Key.endsWith('.mp4'))
            .map(o => ({
                video_id: videoId,
                resolution: o.Key.replace(prefix, '').replace('.mp4', ''),
                format: 'mp4',
                file_path: o.Key,
                file_size: o.Size,
                status: 'completed',
                created_at: o.LastModified,
                completed_at: o.LastModified
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            videoId: videoId,
            transcodedVideos: transcodedVideos
        });

    } catch (error) {
        console.error('Error getting transcoded videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Video file metadata by videoId and resolution (lightweight via S3 HEAD; detailed ffprobe omitted)
router.get('/metadata/:videoId/:resolution', authenticateToken, async (req, res) => {
    try {
        const { videoId, resolution } = req.params;
        // We cannot ffprobe S3 directly without downloading; respond with minimal info from S3 key
        const key = buildProcessedKey(videoId, resolution);

        // HEAD to get size and last modified
        const head = await headObject(key).catch(() => null);
        const size = head?.ContentLength;
        const updatedAt = head?.LastModified || new Date().toISOString();

        // Optional enhancement: download and ffprobe if needed
        const width = undefined, height = undefined, fps = undefined, duration = undefined, bitrate = undefined;

        res.json({
            videoId,
            resolution,
            size: size,
            width,
            height,
            fps,
            duration,
            bitrate,
            s3Key: key,
            updatedAt
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

// List transcoded videos library (from S3 prefixes)
router.get('/library', authenticateToken, async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(limitParam || '10', 10) || 10));
        // List distinct videoId prefixes under processed/
        const first = await listPrefix('processed/');
        const prefixes = new Set();
        for (const obj of (first.Contents || [])) {
            const parts = obj.Key.split('/');
            if (parts.length >= 3) prefixes.add(parts[1]);
        }
        const videoIds = Array.from(prefixes);

        const items = [];
        for (const videoId of videoIds) {
            const listed = await listPrefix(`processed/${videoId}/`);
            const files = (listed.Contents || []).filter(o => o.Key.endsWith('.mp4'));
            const resolutions = files.map(o => path.basename(o.Key).replace('.mp4', ''));
            const urls = [];
            for (const f of files) {
                const reso = path.basename(f.Key).replace('.mp4', '');
                let url = null;
                try { url = await presignDownload(f.Key); } catch (_) {}
                urls.push({ resolution: reso, url });
            }
            items.push({ videoId, resolutions, urls, updatedAt: files[0]?.LastModified || new Date(0) });
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
        // Delete all processed objects under this videoId
        try { await deletePrefix(`processed/${videoId}/`); } catch (err) { console.warn('Failed to delete processed prefix:', err?.message || err); }
        // Delete meta
        try { await deleteObject(buildMetaKey(videoId)); } catch (_) {}

        res.json({ success: true, message: 'Video deleted' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});

// Get video metadata (summary/transcript) stored in S3 meta/<videoId>.json
router.get('/videos/:videoId/meta', authenticateToken, async (req, res) => {
    try {
        const { videoId } = req.params;
        const key = buildMetaKey(videoId);
        try {
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
