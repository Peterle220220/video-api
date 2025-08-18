const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const TranscodingJob = require('../models/TranscodingJob');
const TranscodedVideo = require('../models/TranscodedVideo');
const { getRedisClient } = require('../config/redis');
const { getCurrentCPUUsage } = require('../utils/cpuMonitor');

// Configure FFmpeg paths (auto-detect if env invalid or missing)
(function configureFfmpegPaths() {
    const ffmpegCandidates = [
        process.env.FFMPEG_PATH,
        '/opt/homebrew/bin/ffmpeg',  // macOS (Apple Silicon)
        '/usr/local/bin/ffmpeg',     // macOS (Intel) / some Linux
        '/usr/bin/ffmpeg'            // Linux
    ].filter(Boolean);

    const ffprobeCandidates = [
        process.env.FFPROBE_PATH,
        '/opt/homebrew/bin/ffprobe',
        '/usr/local/bin/ffprobe',
        '/usr/bin/ffprobe'
    ].filter(Boolean);

    const pickExisting = (candidates) => candidates.find(p => {
        try { return fsSync.existsSync(p); } catch { return false; }
    });

    const ffmpegPath = pickExisting(ffmpegCandidates);
    const ffprobePath = pickExisting(ffprobeCandidates);

    if (process.env.FFMPEG_PATH && !ffmpegPath) {
        console.warn(`FFMPEG_PATH is set but not found at '${process.env.FFMPEG_PATH}'. Falling back to auto-detect.`);
    }
    if (process.env.FFPROBE_PATH && !ffprobePath) {
        console.warn(`FFPROBE_PATH is set but not found at '${process.env.FFPROBE_PATH}'. Falling back to auto-detect.`);
    }

    if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log(`FFmpeg path set to: ${ffmpegPath}`);
    } else {
        console.log('FFmpeg path not set explicitly. Using system PATH resolution.');
    }

    if (ffprobePath) {
        ffmpeg.setFfprobePath(ffprobePath);
        console.log(`FFprobe path set to: ${ffprobePath}`);
    } else {
        console.log('FFprobe path not set explicitly. Using system PATH resolution.');
    }
})();

class TranscodingService {
    constructor() {
        this.activeJobs = new Map();
    }

    // Get video information
    async getVideoInfo(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata);
                }
            });
        });
    }

    // Transcode video to different resolutions
    async transcodeVideo(videoId, inputPath, resolutions = ['1920x1080', '1280x720', '854x480']) {
        const jobId = uuidv4();
        const startTime = Date.now();

        try {
            // Create job record
            await this.createJobRecord(videoId, jobId);

            // Get video info
            const videoInfo = await this.getVideoInfo(inputPath);
            const duration = Math.floor(videoInfo.format.duration);

            console.log(`🎬 Starting transcoding for video ${videoId} with job ${jobId}`);
            console.log(`📊 Video duration: ${duration}s`);

            // Process each resolution
            const transcodingPromises = resolutions.map(resolution =>
                this.transcodeToResolution(videoId, jobId, inputPath, resolution, duration)
            );

            // Wait for all transcoding to complete
            const results = await Promise.all(transcodingPromises);

            // Update job status
            await this.updateJobStatus(jobId, 'completed', 100);

            const totalTime = Date.now() - startTime;
            console.log(`✅ Transcoding completed for job ${jobId} in ${totalTime}ms`);

            return {
                jobId,
                status: 'completed',
                results,
                duration: totalTime
            };

        } catch (error) {
            console.error(`❌ Transcoding failed for job ${jobId}:`, error);
            await this.updateJobStatus(jobId, 'failed', 0, error.message);
            throw error;
        }
    }

    // Transcode to specific resolution
    async transcodeToResolution(videoId, jobId, inputPath, resolution, totalDuration) {
        const outputPath = path.join(
            process.env.PROCESSED_PATH || './processed',
            `${videoId}_${resolution.replace('x', '_')}.mp4`
        );

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        return new Promise((resolve, reject) => {
            let progress = 0;
            let lastProgressUpdate = 0;

            const command = ffmpeg(inputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size(resolution)
                .videoBitrate('2000k')
                .audioBitrate('128k')
                .fps(30)
                .outputOptions([
                    '-crf', '23',
                    '-preset medium',
                    '-movflags +faststart',
                    '-pix_fmt yuv420p'
                ])
                .on('start', (commandLine) => {
                    console.log(`🔄 Starting ${resolution} transcoding: ${commandLine}`);
                })
                .on('progress', async (progressInfo) => {
                    // Calculate progress percentage safely
                    try {
                        if (totalDuration > 0 && progressInfo && progressInfo.timemark) {
                            const seconds = progressInfo.timemark.split(':').reduce((acc, time) => 60 * acc + parseFloat(time), 0);
                            progress = Math.max(0, Math.min(100, Math.floor((seconds / totalDuration) * 100)));
                        }
                    } catch (_) { /* ignore parse errors */ }

                    // Update progress every 5%
                    if (progress - lastProgressUpdate >= 5) {
                        lastProgressUpdate = progress;
                        await this.updateJobProgress(jobId, progress);

                        // Monitor CPU usage during transcoding
                        const cpuUsage = await getCurrentCPUUsage();
                        console.log(`📊 ${resolution} - Progress: ${progress}%, CPU: ${cpuUsage}%`);

                        // Store CPU usage in Redis
                        const redisClient = getRedisClient();
                        await redisClient.set(`transcoding_cpu:${jobId}:${resolution}`, cpuUsage);
                    }
                })
                .on('end', async () => {
                    try {
                        // Get file size
                        const stats = await fs.stat(outputPath);

                        // Save transcoded video record
                        await this.saveTranscodedVideo(videoId, resolution, outputPath, stats.size);

                        console.log(`✅ ${resolution} transcoding completed: ${outputPath}`);
                        resolve({
                            resolution,
                            outputPath,
                            fileSize: stats.size,
                            status: 'completed'
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    console.error(`❌ ${resolution} transcoding error:`, err);
                    reject(err);
                });

            // Store command reference for potential cancellation
            this.activeJobs.set(jobId, command);

            command.save(outputPath);
        });
    }

    // Create job record in database
    async createJobRecord(videoId, jobId) {
        const job = new TranscodingJob({
            video_id: videoId,
            job_id: jobId,
            status: 'processing',
            started_at: new Date()
        });
        await job.save();
    }

    // Update job status
    async updateJobStatus(jobId, status, progress, errorMessage = null) {
        const updateData = {
            status,
            progress,
            error_message: errorMessage
        };

        if (status === 'completed' || status === 'failed') {
            updateData.completed_at = new Date();
        }

        await TranscodingJob.findOneAndUpdate(
            { job_id: jobId },
            updateData
        );
    }

    // Update job progress
    async updateJobProgress(jobId, progress) {
        await TranscodingJob.findOneAndUpdate(
            { job_id: jobId },
            { progress }
        );
    }

    // Save transcoded video record
    async saveTranscodedVideo(videoId, resolution, filePath, fileSize) {
        const transcodedVideo = new TranscodedVideo({
            video_id: videoId,
            resolution,
            format: 'mp4',
            file_path: filePath,
            file_size: fileSize,
            status: 'completed',
            completed_at: new Date()
        });
        await transcodedVideo.save();
    }

    // Get job status
    async getJobStatus(jobId) {
        const job = await TranscodingJob.findOne({ job_id: jobId }).lean();
        return job;
    }

    // Cancel transcoding job
    async cancelJob(jobId) {
        const command = this.activeJobs.get(jobId);
        if (command) {
            command.kill('SIGKILL');
            this.activeJobs.delete(jobId);
            await this.updateJobStatus(jobId, 'cancelled', 0);
            console.log(`🚫 Job ${jobId} cancelled`);
        }
    }

    // Get all active jobs
    async getActiveJobs() {
        const jobs = await TranscodingJob.find({
            status: { $in: ['pending', 'processing'] }
        })
            .sort({ created_at: -1 })
            .lean();
        return jobs;
    }

    // Clean up completed jobs
    async cleanupCompletedJobs() {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await TranscodingJob.deleteMany({
            status: { $in: ['completed', 'failed'] },
            completed_at: { $lt: sevenDaysAgo }
        });
    }
}

module.exports = new TranscodingService();
