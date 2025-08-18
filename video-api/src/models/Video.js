const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    filename: {
        type: String,
        required: true,
        trim: true
    },
    original_path: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: 0
    },
    size: {
        type: Number,
        default: 0
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['uploaded', 'processing', 'completed', 'failed'],
        default: 'uploaded'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'videos'
});

// Indexes
videoSchema.index({ user_id: 1 });
videoSchema.index({ status: 1 });
videoSchema.index({ created_at: -1 });

module.exports = mongoose.model('Video', videoSchema);
