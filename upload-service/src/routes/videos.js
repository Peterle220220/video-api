const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../../shared/middleware/auth');
const { updateVideoDescription } = require('../services/dynamoService');
const { buildMetaKey, uploadBuffer, presignDownload } = require('../services/s3Service');

const router = express.Router();

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

// Update description: save to DynamoDB and also mirror to S3 meta file if exists
router.put('/:id/description', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ error: 'description is required and must be a non-empty string' });
        }

        const trimmed = description.trim();
        const updated = await updateVideoDescription(id, trimmed).catch(() => null);

        // Best-effort: update S3 meta file if present
        try {
            const metaObj = Object.assign({}, updated || {}, { description: trimmed, descriptionUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            const buf = Buffer.from(JSON.stringify(metaObj, null, 2), 'utf-8');
            const key = buildMetaKey(id);
            await uploadBuffer(key, buf, { contentType: 'application/json' });
        } catch (_) {}

        return res.json({ success: true, message: 'Description updated', videoId: id, meta: updated || { description: trimmed } });
    } catch (error) {
        console.error('Error updating description:', error);
        return res.status(500).json({ error: 'Failed to update description' });
    }
});

module.exports = router;
