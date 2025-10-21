const SQSService = require('../../../shared/services/sqsService');
const transcodingService = require('./transcodingService');
const { updateJob, getJob } = require('./dynamoService');

class TranscodingQueueService {
    constructor() {
        this.sqs = new SQSService();
        this.isProcessing = false;
    }

    // Send transcoding job to queue
    async queueTranscodingJob(jobData) {
        try {
            const message = {
                type: 'transcoding_job',
                videoId: jobData.videoId,
                inputSource: jobData.inputSource,
                resolutions: jobData.resolutions,
                timestamp: new Date().toISOString(),
                retryCount: 0
            };

            await this.sqs.sendMessage('transcoding', message, {
                attributes: {
                    jobType: {
                        DataType: 'String',
                        StringValue: 'transcoding'
                    },
                    videoId: {
                        DataType: 'String',
                        StringValue: jobData.videoId
                    }
                }
            });

            console.log(`📤 Transcoding job queued for video ${jobData.videoId}`);
            return true;
        } catch (error) {
            console.error('❌ Error queueing transcoding job:', error);
            throw error;
        }
    }

    // Process transcoding jobs from queue
    async processTranscodingJob(messageBody, message) {
        try {
            const { videoId, inputSource, resolutions, retryCount = 0 } = messageBody;
            
            console.log(`🎬 Processing transcoding job for video ${videoId}`);
            
            // Update job status to processing
            await updateJob(videoId, {
                status: 'processing',
                started_at: new Date().toISOString(),
                retry_count: retryCount
            });

            // Start transcoding
            const result = await transcodingService.transcodeVideo(videoId, inputSource, resolutions);
            
            // Update job status to completed
            await updateJob(videoId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                result: result
            });

            console.log(`✅ Transcoding completed for video ${videoId}`);
            return result;

        } catch (error) {
            console.error(`❌ Transcoding failed for video ${messageBody.videoId}:`, error);
            
            // Handle retry logic
            const maxRetries = 3;
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying transcoding job (${retryCount + 1}/${maxRetries})`);
                
                // Re-queue with incremented retry count
                await this.sqs.sendMessage('transcoding', {
                    ...messageBody,
                    retryCount: retryCount + 1
                }, {
                    delaySeconds: Math.pow(2, retryCount) * 60 // Exponential backoff
                });
            } else {
                // Mark job as failed
                await updateJob(messageBody.videoId, {
                    status: 'failed',
                    error: error.message,
                    failed_at: new Date().toISOString()
                });
            }
            
            throw error;
        }
    }

    // Start processing queue
    startProcessing() {
        if (this.isProcessing) {
            console.log('⚠️ Transcoding queue processing already started');
            return;
        }

        this.isProcessing = true;
        console.log('🚀 Starting transcoding queue processing...');

        this.sqs.startPolling('transcoding', this.processTranscodingJob.bind(this), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 300, // 5 minutes for transcoding
            pollInterval: 1000
        });
    }

    // Stop processing queue
    stopProcessing() {
        this.isProcessing = false;
        console.log('🛑 Stopping transcoding queue processing...');
    }

    // Get queue status
    async getQueueStatus() {
        try {
            const attributes = await this.sqs.getQueueAttributes('transcoding');
            return {
                approximateNumberOfMessages: attributes.ApproximateNumberOfMessages || 0,
                approximateNumberOfMessagesNotVisible: attributes.ApproximateNumberOfMessagesNotVisible || 0,
                approximateNumberOfMessagesDelayed: attributes.ApproximateNumberOfMessagesDelayed || 0
            };
        } catch (error) {
            console.error('❌ Error getting queue status:', error);
            throw error;
        }
    }
}

module.exports = TranscodingQueueService;
