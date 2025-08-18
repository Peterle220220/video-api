const mongoose = require('mongoose');

const transcodedVideoSchema = new mongoose.Schema({
    video_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    resolution: {
        type: String,
        required: true
    },
    format: {
        type: String,
        required: true,
        default: 'mp4'
    },
    file_path: {
        type: String,
        required: true
    },
    file_size: {
        type: Number,
        default: 0
    },
    bitrate: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    completed_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at' },
    collection: 'transcoded_videos'
});

// Indexes
transcodedVideoSchema.index({ video_id: 1 });
transcodedVideoSchema.index({ resolution: 1 });
transcodedVideoSchema.index({ status: 1 });
transcodedVideoSchema.index({ created_at: -1 });

module.exports = mongoose.model('TranscodedVideo', transcodedVideoSchema);
