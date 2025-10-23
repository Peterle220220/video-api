const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const transcodingService = require('../services/transcodingService');
const { getCurrentCPUUsage, getCPUUsageHistory, getSystemInfo, getMemoryUsage } = require('../utils/cpuMonitor');
const { authenticateToken } = require('../middleware/auth');
const assemblyAI = require('../services/external/assemblyAIService');
const { listPrefix, presignDownload, buildProcessedKey, buildMetaKey, deletePrefix, headObject, getObjectJson, deleteObject } = require('../services/storage/s3Service');
const { putVideo, getJob, queryJobsByVideoId, updateJob, listVideos } = require('../services/db/dynamoService');
const { listActiveJobs } = require('../services/db/dynamoService');

// Helper function to create initial meta file
async function createInitialMetaFile(videoId) {
    try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const { s3Client, S3_BUCKET } = require('../config/aws');
        
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
            Bucket: S3_BUCKET,
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

// Start transcoding job: supports either direct multipart upload (legacy) or S3 key input
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const { title, description, resolutions, s3Key } = req.body;
        let videoId = uuidv4();
        if (!s3Key) {
            return res.status(400).json({ error: 's3Key is required. Upload the file to S3 using a presigned URL, then call this endpoint.' });
        }
        const inputSource = { type: 's3', key: String(s3Key) };
        const filename = String(s3Key).split('/').pop();

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
                source: { s3_key: inputSource.key },
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
            // Call upload service to queue AssemblyAI processing
            const uploadClient = require('../services/external/apiClient');
            uploadClient.post('/api/storage/process-assemblyai', {
                videoId,
                s3Key: inputSource.key
            }).then(response => {
                console.log(`📝 AssemblyAI processing queued for video ${videoId}`);
            }).catch(err => {
                console.warn(`Failed to queue AssemblyAI processing for video ${videoId}:`, err?.message || err);
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
            try { u.url = await presignDownload(buildProcessedKey(jobStatus.video_id, u.resolution)); } catch (_) { }
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

        // Convert resolutionProgress array to object for easier frontend consumption
        const resolutionProgressObj = {};
        resolutionProgress.forEach(rp => {
            resolutionProgressObj[rp.resolution] = {
                progress: rp.progress,
                status: rp.status,
                url: rp.url
            };
        });

        res.json({
            job: {
                ...jobStatus,
                resolution_progress: resolutionProgressObj
            },
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
        const activeJobs = await listActiveJobs();
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
        const files = (listed.Contents || []).filter(o => o.Key.endsWith('.mp4'));
        const transcodedVideos = (await Promise.all(files.map(async (o) => {
            let url = null;
            try { url = await presignDownload(o.Key); } catch (_) { }
            return {
                video_id: videoId,
                resolution: o.Key.replace(prefix, '').replace('.mp4', ''),
                format: 'mp4',
                file_path: o.Key,
                file_size: o.Size,
                status: 'completed',
                created_at: o.LastModified,
                completed_at: o.LastModified,
                url
            };
        }))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

// List transcoded videos library (from DynamoDB videos + presigned S3 URLs)
router.get('/library', authenticateToken, async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(limitParam || '10', 10) || 10));
        // Load videos from DynamoDB
        const videos = await listVideos();
        const totalVideos = videos.length;
        const totalPages = Math.max(1, Math.ceil(totalVideos / limit));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const pageItems = videos.slice(start, end);

        // For each paginated video, generate presigned URLs for available/expected resolutions
        const items = [];
        for (const v of pageItems) {
            const videoId = v.video_id || String(v.sk || '').replace(/^VIDEO#/, '') || '';
            const expected = Array.isArray(v.resolutions) && v.resolutions.length
                ? v.resolutions
                : ['1920x1080', '1280x720', '854x480'];
            const urls = [];
            for (const r of expected) {
                const key = buildProcessedKey(videoId, r);
                // Only include resolutions that actually exist in S3
                const exists = await headObject(key).catch(() => null);
                if (!exists) continue;
                let url = null;
                try { url = await presignDownload(key); } catch (_) { url = null; }
                if (url) urls.push({ resolution: r, url });
            }
            items.push({
                videoId,
                resolutions: expected,
                urls,
                updatedAt: v.updated_at || v.created_at || new Date(0).toISOString(),
                title: v.title,
                description: v.description
            });
        }

        res.json({
            count: totalVideos,
            videos: items,
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
        const isAdmin = !!(req.user && (req.user.isAdmin || (Array.isArray(req.user.groups) && req.user.groups.some(g => String(g).toLowerCase() === 'admin'))));
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only Admin group members can delete videos' });
        }
        // Delete all processed objects under this videoId
        try { await deletePrefix(`processed/${videoId}/`); } catch (err) { console.warn('Failed to delete processed prefix:', err?.message || err); }
        // Delete meta
        try { await deleteObject(buildMetaKey(videoId)); } catch (_) { }

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
            // Check if metadata file exists
            const head = await headObject(key);
            if (!head) {
                // Create initial meta file if it doesn't exist
                await createInitialMetaFile(videoId);
            }
            
            const url = await presignDownload(key);
            return res.json({ videoId, metaUrl: url });
        } catch (error) {
            console.log(`Metadata file not found for video ${videoId}:`, error.message);
            return res.status(404).json({ error: 'Metadata not found' });
        }
    } catch (error) {
        console.error('Error reading metadata:', error);
        res.status(500).json({ error: 'Failed to read metadata' });
    }
});
