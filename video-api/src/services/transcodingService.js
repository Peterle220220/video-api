const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
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
        this.jobs = new Map(); // jobId -> job data
        this.transcodedByVideoId = new Map(); // videoId -> [transcoded items]
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
            await this.createJobRecord(videoId, jobId, resolutions);

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
        const processedRoot = process.env.PROCESSED_PATH || './processed';
        const videoFolder = path.join(processedRoot, videoId);
        const outputPath = path.join(videoFolder, `${resolution}.mp4`);

        // Ensure output directory exists per video
        await fs.mkdir(videoFolder, { recursive: true });

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

    // Create job record (in-memory)
    async createJobRecord(videoId, jobId, resolutions = ['1920x1080', '1280x720', '854x480']) {
        const job = {
            video_id: videoId,
            job_id: jobId,
            status: 'processing',
            progress: 0,
            error_message: null,
            created_at: new Date(),
            started_at: new Date(),
            completed_at: null,
            resolutions
        };
        this.jobs.set(jobId, job);
    }

    // Update job status
    async updateJobStatus(jobId, status, progress, errorMessage = null) {
        const job = this.jobs.get(jobId);
        if (!job) return;
        job.status = status;
        job.progress = progress;
        job.error_message = errorMessage;
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            job.completed_at = new Date();
        }
        this.jobs.set(jobId, job);
    }

    // Update job progress
    async updateJobProgress(jobId, progress) {
        const job = this.jobs.get(jobId);
        if (!job) return;
        job.progress = progress;
        this.jobs.set(jobId, job);
    }

    // Save transcoded video record
    async saveTranscodedVideo(videoId, resolution, filePath, fileSize) {
        const list = this.transcodedByVideoId.get(videoId) || [];
        list.push({
            video_id: videoId,
            resolution,
            format: 'mp4',
            file_path: filePath,
            file_size: fileSize,
            status: 'completed',
            created_at: new Date(),
            completed_at: new Date()
        });
        this.transcodedByVideoId.set(videoId, list);
    }

    // Get job status
    async getJobStatus(jobId) {
        return this.jobs.get(jobId) || null;
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
        const jobs = Array.from(this.jobs.values())
            .filter(j => ['pending', 'processing'].includes(j.status))
            .sort((a, b) => b.created_at - a.created_at);
        return jobs;
    }

    // Clean up completed jobs
    async cleanupCompletedJobs() {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const [jobId, job] of this.jobs.entries()) {
            if (['completed', 'failed', 'cancelled'].includes(job.status) && job.completed_at && job.completed_at < sevenDaysAgo) {
                this.jobs.delete(jobId);
            }
        }
    }
}

module.exports = new TranscodingService();
