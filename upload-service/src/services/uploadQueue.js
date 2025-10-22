const SQSService = require('../../shared/services/sqsService');
const assemblyAI = require('./assemblyAIService');
const { updateVideoDescription } = require('./dynamoService');

class UploadQueueService {
    constructor() {
        this.sqs = new SQSService();
        this.isProcessing = false;
    }

    // Send upload processing job to queue
    async queueUploadJob(jobData) {
        try {
            const message = {
                type: 'upload_processing',
                videoId: jobData.videoId,
                s3Key: jobData.s3Key,
                filename: jobData.filename,
                timestamp: new Date().toISOString(),
                retryCount: 0
            };

            await this.sqs.sendMessage('upload', message, {
                attributes: {
                    jobType: {
                        DataType: 'String',
                        StringValue: 'upload_processing'
                    },
                    videoId: {
                        DataType: 'String',
                        StringValue: jobData.videoId
                    }
                }
            });

            console.log(`📤 Upload job queued for video ${jobData.videoId}`);
            return true;
        } catch (error) {
            console.error('❌ Error queueing upload job:', error);
            throw error;
        }
    }

    // Send AssemblyAI processing job to queue
    async queueAssemblyAIJob(jobData) {
        try {
            const message = {
                type: 'assemblyai_processing',
                videoId: jobData.videoId,
                s3Key: jobData.s3Key,
                timestamp: new Date().toISOString(),
                retryCount: 0
            };

            await this.sqs.sendMessage('storage', message, {
                attributes: {
                    jobType: {
                        DataType: 'String',
                        StringValue: 'assemblyai'
                    },
                    videoId: {
                        DataType: 'String',
                        StringValue: jobData.videoId
                    }
                }
            });

            console.log(`📤 AssemblyAI job queued for video ${jobData.videoId}`);
            return true;
        } catch (error) {
            console.error('❌ Error queueing AssemblyAI job:', error);
            throw error;
        }
    }

    // Process upload jobs from queue
    async processUploadJob(messageBody, message) {
        try {
            const { videoId, s3Key, filename, retryCount = 0 } = messageBody;
            
            console.log(`📁 Processing upload job for video ${videoId}`);
            
            // Process file metadata, generate thumbnails, etc.
            // This is where you would add file processing logic
            
            console.log(`✅ Upload processing completed for video ${videoId}`);
            return { success: true, videoId };

        } catch (error) {
            console.error(`❌ Upload processing failed for video ${messageBody.videoId}:`, error);
            
            // Handle retry logic
            const maxRetries = 3;
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying upload job (${retryCount + 1}/${maxRetries})`);
                
                await this.sqs.sendMessage('upload', {
                    ...messageBody,
                    retryCount: retryCount + 1
                }, {
                    delaySeconds: Math.pow(2, retryCount) * 30 // Exponential backoff
                });
            }
            
            throw error;
        }
    }

    // Process AssemblyAI jobs from queue
    async processAssemblyAIJob(messageBody, message) {
        try {
            const { videoId, s3Key, retryCount = 0 } = messageBody;
            
            console.log(`🤖 Processing AssemblyAI job for video ${videoId}`);
            
            // Process video with AssemblyAI
            const result = await assemblyAI.processVideoForSummary(videoId, { type: 's3', key: s3Key });
            
            console.log(`✅ AssemblyAI processing completed for video ${videoId}`);
            return result;

        } catch (error) {
            console.error(`❌ AssemblyAI processing failed for video ${messageBody.videoId}:`, error);
            
            // Handle retry logic
            const maxRetries = 2; // Fewer retries for AssemblyAI
            if (retryCount < maxRetries) {
                console.log(`🔄 Retrying AssemblyAI job (${retryCount + 1}/${maxRetries})`);
                
                await this.sqs.sendMessage('storage', {
                    ...messageBody,
                    retryCount: retryCount + 1
                }, {
                    delaySeconds: Math.pow(2, retryCount) * 60 // Exponential backoff
                });
            }
            
            throw error;
        }
    }

    // Start processing queues
    startProcessing() {
        if (this.isProcessing) {
            console.log('⚠️ Upload queue processing already started');
            return;
        }

        this.isProcessing = true;
        console.log('🚀 Starting upload queue processing...');

        // Start upload queue processing
        this.sqs.startPolling('upload', this.processUploadJob.bind(this), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 60,
            pollInterval: 2000
        });

        // Start AssemblyAI queue processing
        this.sqs.startPolling('storage', this.processAssemblyAIJob.bind(this), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 300, // 5 minutes for AssemblyAI
            pollInterval: 5000
        });
    }

    // Stop processing queues
    stopProcessing() {
        this.isProcessing = false;
        console.log('🛑 Stopping upload queue processing...');
    }

    // Get queue status
    async getQueueStatus() {
        try {
            const [uploadStatus, storageStatus] = await Promise.all([
                this.sqs.getQueueAttributes('upload'),
                this.sqs.getQueueAttributes('storage')
            ]);

            return {
                upload: {
                    approximateNumberOfMessages: uploadStatus.ApproximateNumberOfMessages || 0,
                    approximateNumberOfMessagesNotVisible: uploadStatus.ApproximateNumberOfMessagesNotVisible || 0
                },
                storage: {
                    approximateNumberOfMessages: storageStatus.ApproximateNumberOfMessages || 0,
                    approximateNumberOfMessagesNotVisible: storageStatus.ApproximateNumberOfMessagesNotVisible || 0
                }
            };
        } catch (error) {
            console.error('❌ Error getting queue status:', error);
            throw error;
        }
    }
}

module.exports = UploadQueueService;
