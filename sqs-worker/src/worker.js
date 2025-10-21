require('dotenv').config();
const SQSService = require('../shared/services/sqsService');
const TranscodingWorker = require('./workers/transcodingWorker');
const UploadWorker = require('./workers/uploadWorker');
const AssemblyAIWorker = require('./workers/assemblyAIWorker');

class SQSWorker {
    constructor() {
        this.sqs = new SQSService();
        this.workers = {
            transcoding: new TranscodingWorker(),
            upload: new UploadWorker(),
            assemblyai: new AssemblyAIWorker()
        };
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            console.log('⚠️ SQS Worker already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting SQS Worker...');

        // Start processing all queues
        await Promise.all([
            this.startTranscodingWorker(),
            this.startUploadWorker(),
            this.startAssemblyAIWorker()
        ]);
    }

    async startTranscodingWorker() {
        console.log('🎬 Starting transcoding worker...');
        this.sqs.startPolling('transcoding', this.workers.transcoding.process.bind(this.workers.transcoding), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 300, // 5 minutes
            pollInterval: 1000
        });
    }

    async startUploadWorker() {
        console.log('📁 Starting upload worker...');
        this.sqs.startPolling('upload', this.workers.upload.process.bind(this.workers.upload), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 60,
            pollInterval: 2000
        });
    }

    async startAssemblyAIWorker() {
        console.log('🤖 Starting AssemblyAI worker...');
        this.sqs.startPolling('storage', this.workers.assemblyai.process.bind(this.workers.assemblyai), {
            maxMessages: 1,
            waitTime: 20,
            visibilityTimeout: 300, // 5 minutes
            pollInterval: 5000
        });
    }

    async stop() {
        this.isRunning = false;
        console.log('🛑 Stopping SQS Worker...');
    }

    async getStatus() {
        try {
            const [transcodingStatus, uploadStatus, storageStatus] = await Promise.all([
                this.sqs.getQueueAttributes('transcoding'),
                this.sqs.getQueueAttributes('upload'),
                this.sqs.getQueueAttributes('storage')
            ]);

            return {
                isRunning: this.isRunning,
                queues: {
                    transcoding: {
                        approximateNumberOfMessages: transcodingStatus.ApproximateNumberOfMessages || 0,
                        approximateNumberOfMessagesNotVisible: transcodingStatus.ApproximateNumberOfMessagesNotVisible || 0
                    },
                    upload: {
                        approximateNumberOfMessages: uploadStatus.ApproximateNumberOfMessages || 0,
                        approximateNumberOfMessagesNotVisible: uploadStatus.ApproximateNumberOfMessagesNotVisible || 0
                    },
                    storage: {
                        approximateNumberOfMessages: storageStatus.ApproximateNumberOfMessages || 0,
                        approximateNumberOfMessagesNotVisible: storageStatus.ApproximateNumberOfMessagesNotVisible || 0
                    }
                }
            };
        } catch (error) {
            console.error('❌ Error getting worker status:', error);
            throw error;
        }
    }
}

// Start worker if run directly
if (require.main === module) {
    const worker = new SQSWorker();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('🛑 Received SIGINT, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('🛑 Received SIGTERM, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
    });

    // Start worker
    worker.start().catch(error => {
        console.error('❌ Failed to start SQS Worker:', error);
        process.exit(1);
    });
}

module.exports = SQSWorker;
