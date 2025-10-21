const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { getCurrentCPUUsage } = require('../utils/cpuMonitor');
const { uploadFileStream, buildProcessedKey, downloadToTempFile } = require('./s3Service');
const { putJob, updateJob, getJob } = require('./dynamoService');

// FFmpeg tunables from environment
const FFMPEG_PRESET = String(process.env.FFMPEG_PRESET || 'medium');
const FFMPEG_CRF = String(process.env.FFMPEG_CRF || '23');
const FFMPEG_FPS = Number(process.env.FFMPEG_FPS || 30);
const FFMPEG_THREADS = Number(process.env.FFMPEG_THREADS || 0); // 0 = auto by ffmpeg

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

        // Global queue to limit concurrent ffmpeg transcodes across all jobs
        this.pendingTasks = [];
        this.runningTasks = 0;
        const defaultConcurrency = Math.max(1, Math.floor(os.cpus().length / 2));
        this.maxConcurrentTranscodes = Number(process.env.MAX_CONCURRENT_TRANSCODES || defaultConcurrency);
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

    // Transcode video to different resolutions. inputSource can be:
    // - { type: 's3', key: 'uploads/...' }
    // - { type: 'local', path: '/path/to/file' }
    async transcodeVideo(videoId, inputSource, resolutions = ['1920x1080', '1280x720', '854x480']) {
        const jobId = uuidv4();
        const startTime = Date.now();

        try {
            // Resolve input path (download S3 to temp when needed)
            let inputPath = null;
            if (inputSource && inputSource.type === 's3' && inputSource.key) {
                inputPath = await downloadToTempFile(inputSource.key);
            } else if (inputSource && inputSource.type === 'local' && inputSource.path) {
                inputPath = inputSource.path;
            } else if (typeof inputSource === 'string') {
                inputPath = inputSource;
            } else {
                throw new Error('Invalid input source');
            }

            // Create job record in DynamoDB
            await this.createJobRecord(videoId, jobId, resolutions);

            // Get video info
            const videoInfo = await this.getVideoInfo(inputPath);
            const duration = Math.floor(videoInfo.format.duration);

            console.log(`🎬 Starting transcoding for video ${videoId} with job ${jobId}`);
            console.log(`📊 Video duration: ${duration}s`);

            // Enqueue each resolution; queue will respect global concurrency limit
            const transcodingPromises = resolutions.map(resolution =>
                this.enqueueTranscode(videoId, jobId, inputPath, resolution, duration)
            );

            // Wait for all scheduled transcodes to complete
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

    // Enqueue a transcode task that will run under global concurrency control
    enqueueTranscode(videoId, jobId, inputPath, resolution, totalDuration) {
        return new Promise((resolve, reject) => {
            const task = async () => {
                try {
                    const result = await this.transcodeToResolution(
                        videoId,
                        jobId,
                        inputPath,
                        resolution,
                        totalDuration
                    );
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    this.runningTasks = Math.max(0, this.runningTasks - 1);
                    this._tryStartNext();
                }
            };
            this.pendingTasks.push(task);
            this._tryStartNext();
        });
    }

    _tryStartNext() {
        // Start as many tasks as allowed by maxConcurrentTranscodes
        while (this.runningTasks < this.maxConcurrentTranscodes && this.pendingTasks.length > 0) {
            const next = this.pendingTasks.shift();
            this.runningTasks += 1;
            // Fire and forget; completion handled inside task
            Promise.resolve().then(next);
        }
    }

    // Transcode to specific resolution
    async transcodeToResolution(videoId, jobId, inputPath, resolution, totalDuration) {
        // Output to a temporary file, then upload to S3
        const outputPath = path.join(os.tmpdir(), `${uuidv4()}_${resolution}.mp4`);

        return new Promise((resolve, reject) => {
            let progress = 0;
            let lastProgressUpdate = 0;

            const command = ffmpeg(inputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size(resolution)
                .videoBitrate('2000k')
                .audioBitrate('128k')
                .fps(isFinite(FFMPEG_FPS) && FFMPEG_FPS > 0 ? FFMPEG_FPS : 30)
                .outputOptions([
                    '-crf', FFMPEG_CRF,
                    '-preset', FFMPEG_PRESET,
                    '-movflags +faststart',
                    '-pix_fmt yuv420p'
                ])
                // Pass threads if explicitly configured; 0 or NaN => let ffmpeg auto-detect
                .outputOptions(
                    isFinite(FFMPEG_THREADS) && FFMPEG_THREADS > 0
                        ? ['-threads', String(FFMPEG_THREADS)]
                        : []
                )
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

                    // Update per-resolution progress every 5%
                    if (progress - lastProgressUpdate >= 5) {
                        lastProgressUpdate = progress;
                        await this.updateJobResolutionProgress(jobId, resolution, progress);

                        // Monitor CPU usage during transcoding
                        const cpuUsage = await getCurrentCPUUsage();
                        console.log(`📊 ${resolution} - Progress: ${progress}%, CPU: ${cpuUsage}%`);
                    }
                })
                .on('end', async () => {
                    try {
                        // Upload to S3
                        const read = fsSync.createReadStream(outputPath);
                        const key = buildProcessedKey(videoId, resolution);
                        await uploadFileStream(key, read, { contentType: 'video/mp4' });
                        try { await fs.unlink(outputPath); } catch (_) {}

                        // Mark this resolution as completed
                        await this.updateJobResolutionProgress(jobId, resolution, 100, 'completed');

                        console.log(`✅ ${resolution} transcoding completed: ${outputPath}`);
                        resolve({
                            resolution,
                            s3Key: key,
                            fileSize: undefined,
                            status: 'completed'
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (err) => {
                    console.error(`❌ ${resolution} transcoding error:`, err);
                    // Mark this resolution as failed
                    this.updateJobResolutionProgress(jobId, resolution, 0, 'failed').catch(() => { });
                    reject(err);
                });

            // Store command reference for potential cancellation
            this.activeJobs.set(jobId, command);

            command.save(outputPath);
        });
    }

    // Create job record (DynamoDB)
    async createJobRecord(videoId, jobId, resolutions = ['1920x1080', '1280x720', '854x480']) {
        const job = {
            video_id: videoId,
            job_id: jobId,
            status: 'processing',
            progress: 0,
            error_message: null,
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            completed_at: null,
            resolutions,
            resolution_progress: Object.fromEntries(
                resolutions.map(r => [r, { progress: 0, status: 'pending' }])
            )
        };
        await putJob(job);
    }

    // Update job status
    async updateJobStatus(jobId, status, progress, errorMessage = null) {
        const updates = {
            status,
            progress,
            error_message: errorMessage,
        };
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            updates.completed_at = new Date().toISOString();
        }
        await updateJob(jobId, updates);
    }

    // Update job progress
    async updateJobProgress(jobId, progress) {
        await updateJob(jobId, { progress });
    }

    // Update progress for a specific resolution and recalc overall job progress/status
    async updateJobResolutionProgress(jobId, resolution, progress, resolutionStatus = null) {
        const job = await getJob(jobId);
        if (!job) return;
        const normalizedProgress = Math.max(0, Math.min(100, Math.floor(progress)));
        const newStatus = resolutionStatus || (normalizedProgress >= 100 ? 'completed' : 'processing');
        const nextResProgress = Object.assign({}, job.resolution_progress || {});
        nextResProgress[resolution] = { progress: normalizedProgress, status: newStatus };

        const resolutionList = Array.isArray(job.resolutions) && job.resolutions.length
            ? job.resolutions
            : ['1920x1080', '1280x720', '854x480'];

        const total = resolutionList.reduce((acc, r) => acc + ((nextResProgress[r]?.progress) || 0), 0);
        const overall = Math.floor(total / resolutionList.length);

        let status = job.status || 'processing';
        const statuses = resolutionList.map(r => (nextResProgress?.[r]?.status) || 'processing');
        if (statuses.every(s => s === 'completed')) {
            status = 'completed';
        } else if (statuses.some(s => s === 'failed')) {
            status = 'failed';
        } else {
            status = 'processing';
        }

        await updateJob(jobId, {
            resolution_progress: nextResProgress,
            progress: overall,
            status,
            updated_at: new Date().toISOString()
        });
    }

    // Save transcoded video record (no-op; listing relies on S3)
    async saveTranscodedVideo() { return; }

    // Get job status
    async getJobStatus(jobId) {
        return await getJob(jobId);
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
        // Not implemented: requires a GSI on status or scan; prefer status/:jobId usage.
        return [];
    }

    // Clean up completed jobs
    async cleanupCompletedJobs() {
        // No-op; retention can be handled by DynamoDB TTL or external jobs
        return;
    }
}

module.exports = new TranscodingService();
