require('dotenv').config();
const SQSService = require('../shared/services/sqsService');

async function testSQS() {
    console.log('🧪 Testing SQS Communication...\n');

    const sqs = new SQSService();

    try {
        // Test 1: Send message to transcoding queue
        console.log('📤 Test 1: Sending message to transcoding queue...');
        const transcodingMessage = {
            type: 'transcoding_job',
            videoId: 'test-video-123',
            inputSource: { type: 's3', key: 'videos/test-video.mp4' },
            resolutions: ['1920x1080', '1280x720'],
            timestamp: new Date().toISOString()
        };

        await sqs.sendMessage('transcoding', transcodingMessage, {
            attributes: {
                jobType: {
                    DataType: 'String',
                    StringValue: 'transcoding'
                },
                videoId: {
                    DataType: 'String',
                    StringValue: 'test-video-123'
                }
            }
        });
        console.log('✅ Transcoding message sent successfully\n');

        // Test 2: Send message to upload queue
        console.log('📤 Test 2: Sending message to upload queue...');
        const uploadMessage = {
            type: 'upload_processing',
            videoId: 'test-video-456',
            s3Key: 'videos/test-upload.mp4',
            filename: 'test-upload.mp4',
            timestamp: new Date().toISOString()
        };

        await sqs.sendMessage('upload', uploadMessage, {
            attributes: {
                jobType: {
                    DataType: 'String',
                    StringValue: 'upload_processing'
                },
                videoId: {
                    DataType: 'String',
                    StringValue: 'test-video-456'
                }
            }
        });
        console.log('✅ Upload message sent successfully\n');

        // Test 3: Send message to storage queue (AssemblyAI)
        console.log('📤 Test 3: Sending message to storage queue...');
        const storageMessage = {
            type: 'assemblyai_processing',
            videoId: 'test-video-789',
            s3Key: 'videos/test-assemblyai.mp4',
            timestamp: new Date().toISOString()
        };

        await sqs.sendMessage('storage', storageMessage, {
            attributes: {
                jobType: {
                    DataType: 'String',
                    StringValue: 'assemblyai'
                },
                videoId: {
                    DataType: 'String',
                    StringValue: 'test-video-789'
                }
            }
        });
        console.log('✅ Storage message sent successfully\n');

        // Test 4: Get queue status
        console.log('📊 Test 4: Getting queue status...');
        const [transcodingStatus, uploadStatus, storageStatus] = await Promise.all([
            sqs.getQueueAttributes('transcoding'),
            sqs.getQueueAttributes('upload'),
            sqs.getQueueAttributes('storage')
        ]);

        console.log('📊 Queue Status:');
        console.log(`   Transcoding: ${transcodingStatus.ApproximateNumberOfMessages || 0} messages`);
        console.log(`   Upload: ${uploadStatus.ApproximateNumberOfMessages || 0} messages`);
        console.log(`   Storage: ${storageStatus.ApproximateNumberOfMessages || 0} messages\n`);

        // Test 5: Receive and process messages
        console.log('📥 Test 5: Receiving messages...');
        
        // Receive from transcoding queue
        const transcodingMessages = await sqs.receiveMessages('transcoding', {
            maxMessages: 1,
            waitTime: 5,
            visibilityTimeout: 10
        });

        if (transcodingMessages.length > 0) {
            console.log(`📥 Received ${transcodingMessages.length} message(s) from transcoding queue`);
            console.log(`   Message: ${transcodingMessages[0].Body}`);
            
            // Delete the message
            await sqs.deleteMessage('transcoding', transcodingMessages[0].ReceiptHandle);
            console.log('✅ Message deleted from transcoding queue');
        } else {
            console.log('📭 No messages in transcoding queue');
        }

        console.log('\n🎉 SQS testing completed successfully!');

    } catch (error) {
        console.error('❌ SQS testing failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testSQS();
}

module.exports = testSQS;
