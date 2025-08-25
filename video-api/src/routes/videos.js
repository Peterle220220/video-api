const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

// Update only description in meta.json (file-based, no DB)
router.put('/:id/description', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ error: 'description is required and must be a non-empty string' });
        }

        const processedRoot = process.env.PROCESSED_PATH || './processed';
        const folder = path.join(processedRoot, id);
        const metaPath = path.join(folder, 'meta.json');

        await ensureDir(folder);

        let meta = {};
        try {
            const content = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(content) || {};
        } catch (_) {
            meta = {};
        }

        const trimmed = description.trim();
        meta.description = trimmed;
        meta.descriptionUpdatedAt = new Date().toISOString();
        meta.updatedAt = new Date().toISOString();

        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        return res.json({
            success: true,
            message: 'Description updated',
            videoId: id,
            meta
        });
    } catch (error) {
        console.error('Error updating description:', error);
        return res.status(500).json({ error: 'Failed to update description' });
    }
});

module.exports = router;
