const mongoose = require('mongoose');

const transcodingJobSchema = new mongoose.Schema({
    video_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    job_id: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    error_message: {
        type: String,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    started_at: {
        type: Date,
        default: null
    },
    completed_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at' },
    collection: 'transcoding_jobs'
});

// Indexes
transcodingJobSchema.index({ job_id: 1 }, { unique: true });
transcodingJobSchema.index({ video_id: 1 });
transcodingJobSchema.index({ status: 1 });
transcodingJobSchema.index({ created_at: -1 });

module.exports = mongoose.model('TranscodingJob', transcodingJobSchema);
