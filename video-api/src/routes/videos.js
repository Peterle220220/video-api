const express = require('express');
const Video = require('../models/Video');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all videos
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        // Build query
        let query = {};
        if (status) {
            query.status = status;
        }

        // Execute queries
        const [videos, totalVideos] = await Promise.all([
            Video.find(query)
                .populate('user_id', 'username')
                .sort({ created_at: -1 })
                .skip(offset)
                .limit(parseInt(limit))
                .lean(),
            Video.countDocuments(query)
        ]);

        const totalPages = Math.ceil(totalVideos / limit);

        // Transform data to match expected format
        const transformedVideos = videos.map(video => ({
            ...video,
            uploader_name: video.user_id.username,
            user_id: video.user_id._id
        }));

        res.json({
            videos: transformedVideos,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalVideos,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get video by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findById(id)
            .populate('user_id', 'username')
            .lean();

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Transform data to match expected format
        const transformedVideo = {
            ...video,
            uploader_name: video.user_id.username,
            user_id: video.user_id._id
        };

        res.json({
            video: transformedVideo
        });

    } catch (error) {
        console.error('Error getting video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update video
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description } = req.body;

        // Check if video exists and user owns it
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        if (video.user_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to update this video' });
        }

        // Update video
        const updatedVideo = await Video.findByIdAndUpdate(
            id,
            { title, description, updated_at: new Date() },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Video updated successfully',
            video: updatedVideo
        });

    } catch (error) {
        console.error('Error updating video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete video
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if video exists and user owns it
        const video = await Video.findById(id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Only allow deletion by admin username
        if (!req.user || req.user.username !== 'admin') {
            return res.status(403).json({ error: 'Only admin can delete videos' });
        }

        // Delete video file
        const fs = require('fs').promises;
        try {
            await fs.unlink(video.original_path);
        } catch (fileError) {
            console.warn('Could not delete video file:', fileError);
        }

        // Delete from database
        await Video.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Video deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's videos
router.get('/user/me', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const [videos, totalVideos] = await Promise.all([
            Video.find({ user_id: req.user._id })
                .sort({ created_at: -1 })
                .skip(offset)
                .limit(parseInt(limit))
                .lean(),
            Video.countDocuments({ user_id: req.user._id })
        ]);

        const totalPages = Math.ceil(totalVideos / limit);

        res.json({
            videos: videos,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalVideos,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error getting user videos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get video statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
    try {
        const [totalVideos, processingVideos, completedVideos, totalSizeResult] = await Promise.all([
            Video.countDocuments(),
            Video.countDocuments({ status: 'processing' }),
            Video.countDocuments({ status: 'completed' }),
            Video.aggregate([
                {
                    $group: {
                        _id: null,
                        totalSize: { $sum: '$size' }
                    }
                }
            ])
        ]);

        const totalSize = totalSizeResult.length > 0 ? totalSizeResult[0].totalSize : 0;

        res.json({
            totalVideos,
            processingVideos,
            completedVideos,
            totalSize,
            totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2)
        });

    } catch (error) {
        console.error('Error getting video stats:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
