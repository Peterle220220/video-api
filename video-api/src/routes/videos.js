const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getProcessedRoot() {
    return process.env.PROCESSED_PATH || './processed';
}

async function readVideoMeta(videoId) {
    const metaPath = path.join(getProcessedRoot(), videoId, 'video.json');
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        return JSON.parse(content);
    } catch (_) {
        return null;
    }
}

async function writeVideoMeta(videoId, meta) {
    const folder = path.join(getProcessedRoot(), videoId);
    await fs.mkdir(folder, { recursive: true });
    const metaPath = path.join(folder, 'video.json');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

async function listLibrary() {
    const processedRoot = getProcessedRoot();
    await fs.mkdir(processedRoot, { recursive: true });
    const entries = await fs.readdir(processedRoot, { withFileTypes: true });
    const videoIds = entries.filter(d => d.isDirectory()).map(d => d.name);
    const items = [];
    for (const videoId of videoIds) {
        const folder = path.join(processedRoot, videoId);
        let files = [];
        try {
            files = (await fs.readdir(folder)).filter(name => name.endsWith('.mp4'));
        } catch (_) {}
        const resolutions = files.map(name => name.replace('.mp4', ''));
        const baseUrl = process.env.PUBLIC_BASE_URL || '';
        const urls = files.map(name => ({
            resolution: name.replace('.mp4', ''),
            url: `${baseUrl}/processed/${videoId}/${name}`
        }));
        const stats = fsSync.statSync(folder);
        const meta = await readVideoMeta(videoId);
        items.push({
            videoId,
            resolutions,
            urls,
            updatedAt: stats.mtime,
            meta: meta || undefined
        });
    }
    // Sort by updated time desc
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
}

// List videos (filesystem-backed)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pageParam = req.query.page;
        const limitParam = req.query.limit;
        const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(limitParam || '10', 10) || 10));

        const items = await listLibrary();
        const totalVideos = items.length;
        const totalPages = Math.max(1, Math.ceil(totalVideos / limit));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const pagedItems = items.slice(start, end);

        res.json({
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
        console.error('Error listing videos:', error);
        res.status(500).json({ error: 'Failed to list videos' });
    }
});

// Get single video detail (resolutions, urls, meta)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const processedRoot = getProcessedRoot();
        const folder = path.join(processedRoot, id);
        try {
            await fs.access(folder);
        } catch (_) {
            return res.status(404).json({ error: 'Video not found' });
        }
        const files = (await fs.readdir(folder)).filter(name => name.endsWith('.mp4'));
        const resolutions = files.map(name => name.replace('.mp4', ''));
        const baseUrl = process.env.PUBLIC_BASE_URL || '';
        const urls = files.map(name => ({ resolution: name.replace('.mp4', ''), url: `${baseUrl}/processed/${id}/${name}` }));
        const stats = fsSync.statSync(folder);
        const meta = await readVideoMeta(id);
        res.json({
            video: {
                videoId: id,
                resolutions,
                urls,
                updatedAt: stats.mtime,
                meta: meta || undefined
            }
        });
    } catch (error) {
        console.error('Error getting video:', error);
        res.status(500).json({ error: 'Failed to get video' });
    }
});

// Update video meta (admin only for demo)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.user || req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Only admin can update videos' });
        }
        const { id } = req.params;
        const { title, description } = req.body;
        const processedRoot = getProcessedRoot();
        const folder = path.join(processedRoot, id);
        try {
            await fs.access(folder);
        } catch (_) {
            return res.status(404).json({ error: 'Video not found' });
        }
        const prev = (await readVideoMeta(id)) || {};
        const next = {
            ...prev,
            id,
            title: title ?? prev.title,
            description: description ?? prev.description,
            updated_at: new Date().toISOString(),
            created_at: prev.created_at || new Date().toISOString(),
            username: prev.username || req.user?.username || 'unknown'
        };
        await writeVideoMeta(id, next);
        res.json({ success: true, message: 'Video updated successfully', video: next });
    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ error: 'Failed to update video' });
    }
});

// Delete video folder (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.user || req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Only admin can delete videos' });
        }
        const { id } = req.params;
        const processedRoot = getProcessedRoot();
        const folder = path.join(processedRoot, id);
        try {
            await fs.rm(folder, { recursive: true, force: true });
        } catch (err) {
            console.warn('Failed to remove folder:', err?.message || err);
        }
        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});

// Get current user's videos (by meta.username)
router.get('/user/me', authenticateToken, async (req, res) => {
    try {
        const all = await listLibrary();
        const mine = all.filter(it => (it.meta && it.meta.username) ? it.meta.username === req.user.username : false);
        res.json({
            videos: mine,
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalVideos: mine.length,
                hasNext: false,
                hasPrev: false
            }
        });
    } catch (error) {
        console.error('Error getting user videos:', error);
        res.status(500).json({ error: 'Failed to get user videos' });
    }
});

// Get overview stats
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        const processedRoot = getProcessedRoot();
        await fs.mkdir(processedRoot, { recursive: true });
        const entries = await fs.readdir(processedRoot, { withFileTypes: true });
        const videoIds = entries.filter(d => d.isDirectory()).map(d => d.name);
        let totalSize = 0;
        for (const id of videoIds) {
            const folder = path.join(processedRoot, id);
            const files = (await fs.readdir(folder)).filter(name => name.endsWith('.mp4'));
            for (const name of files) {
                try {
                    const stats = await fs.stat(path.join(folder, name));
                    totalSize += stats.size || 0;
                } catch (_) {}
            }
        }
        res.json({
            totalVideos: videoIds.length,
            processingVideos: 0,
            completedVideos: videoIds.length,
            totalSize,
            totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2)
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;
