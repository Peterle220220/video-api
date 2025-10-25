const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { AWS_REGION, S3_BUCKET, QUT_USERNAME, DDB_TABLE } = require('../config/aws');
const EnhancedSQSService = require('../../shared/services/enhancedSqsService');

class TranscodingWorker {
    constructor() {
        this.s3Client = new S3Client({ region: AWS_REGION });
        this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
        this.tableName = DDB_TABLE;
        this.sqs = new EnhancedSQSService();
    }

    async process(messageBody, message) {
        try {
            // Handle test messages that should intentionally fail
            if (messageBody.test === true && messageBody.shouldFail === true) {
                console.log('🧪 Test message detected - intentionally failing for DLQ testing');
                throw new Error('Test message: intentional failure for DLQ testing');
            }
            
            const { videoId, inputSource, resolutions, retryCount = 0 } = messageBody;
            
            console.log(`🎬 Processing transcoding job for video ${videoId}`);
            
            // Create initial meta file to prevent 404 errors
            await this.createInitialMetaFile(videoId);
            
            // Update job status to processing
            await this.updateJobStatus(videoId, {
                status: 'processing',
                started_at: new Date().toISOString(),
                retry_count: retryCount
            });

            // Download video from S3
            const localVideoPath = await this.downloadVideo(inputSource, videoId);
            
            // Transcode to multiple resolutions
            const results = await this.transcodeVideo(localVideoPath, videoId, resolutions);
            
            // Upload transcoded videos to S3
            await this.uploadTranscodedVideos(results, videoId);
            
            // Update job status to completed
            await this.updateJobStatus(videoId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                results: results
            });

            // Cleanup local files
            await this.cleanup(localVideoPath, results);

            console.log(`✅ Transcoding completed for video ${videoId}`);
            return { success: true, videoId, results };

        } catch (error) {
            console.error(`❌ Transcoding failed for video ${messageBody.videoId}:`, error);
            
            // Classify error type for better handling
            const errorType = this.sqs.classifyError(error);
            console.log(`🏷️ Error classified as: ${errorType}`);
            
            // Update job status to failed with error classification
            await this.updateJobStatus(messageBody.videoId, {
                status: 'failed',
                error: error.message,
                error_type: errorType,
                failed_at: new Date().toISOString()
            });
            
            // For transient errors, we might want to retry
            if (errorType === 'transient' && retryCount < 2) {
                console.log(`🔄 Transient error detected, will retry...`);
            }
            
            throw error;
        }
    }

    async downloadVideo(inputSource, videoId) {
        try {
            const { key } = inputSource;
            
            // Create temp directory if it doesn't exist
            const tempDir = process.platform === 'win32' ? 'E:\\tmp' : '/tmp';
            await fs.mkdir(tempDir, { recursive: true });
            
            const localPath = `${tempDir}/${videoId}_${Date.now()}.mp4`;
            
            const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: key
            });

            const response = await this.s3Client.send(command);
            const chunks = [];
            
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            
            const buffer = Buffer.concat(chunks);
            await fs.writeFile(localPath, buffer);
            
            console.log(`📥 Downloaded video to ${localPath}`);
            return localPath;
        } catch (error) {
            console.error('❌ Error downloading video:', error);
            throw error;
        }
    }

    async transcodeVideo(inputPath, videoId, resolutions) {
        const results = [];
        
        // Get temp directory (same as downloadVideo)
        const tempDir = process.platform === 'win32' ? 'E:\\tmp' : '/tmp';
        
        for (const resolution of resolutions) {
            try {
                console.log(`🎞️ Transcoding to ${resolution}...`);
                
                const outputPath = `${tempDir}/${videoId}_${resolution}_${Date.now()}.mp4`;
                
                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .size(resolution)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions([
                            '-preset medium',
                            '-crf 23',
                            '-movflags +faststart'
                        ])
                        .output(outputPath)
                        .on('end', () => {
                            console.log(`✅ Transcoding completed for ${resolution}`);
                            // Update progress to 100% when completed
                            this.updateResolutionProgress(videoId, resolution, 100, 'completed');
                            resolve();
                        })
                        .on('error', (err) => {
                            console.error(`❌ Transcoding failed for ${resolution}:`, err);
                            // Update progress to failed
                            this.updateResolutionProgress(videoId, resolution, 0, 'failed');
                            reject(err);
                        })
                        .on('progress', (progress) => {
                            const percent = Math.round(progress.percent || 0);
                            console.log(`📊 ${resolution} progress: ${percent}%`);
                            // Update progress in real-time
                            this.updateResolutionProgress(videoId, resolution, percent, 'processing');
                        })
                        .run();
                });

                results.push({
                    resolution,
                    localPath: outputPath,
                    s3Key: `processed/${videoId}/${resolution}.mp4`
                });

            } catch (error) {
                console.error(`❌ Failed to transcode ${resolution}:`, error);
                // Update progress to failed
                this.updateResolutionProgress(videoId, resolution, 0, 'failed');
                throw error;
            }
        }

        return results;
    }

    async uploadTranscodedVideos(results, videoId) {
        console.log(`📤 Uploading ${results.length} transcoded videos for ${videoId}`);
        
        for (const result of results) {
            try {
                console.log(`📤 Uploading ${result.resolution} to ${result.s3Key}`);
                
                // Read the local file and upload to S3
                const readStream = fsSync.createReadStream(result.localPath);
                
                const uploadCommand = new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: result.s3Key,
                    Body: readStream,
                    ContentType: 'video/mp4'
                });
                
                await this.s3Client.send(uploadCommand);
                console.log(`✅ Successfully uploaded ${result.resolution} to S3`);
                
            } catch (error) {
                console.error(`❌ Failed to upload ${result.resolution}:`, error);
                throw error;
            }
        }
    }

    async updateJobStatus(videoId, updates) {
        try {
            // Create expression attribute names to handle reserved keywords
            const expressionAttributeNames = {};
            const updateExpressions = [];
            const expressionAttributeValues = {};

            Object.entries(updates).forEach(([key, value]) => {
                const nameKey = `#${key}`;
                const valueKey = `:${key}`;
                
                expressionAttributeNames[nameKey] = key;
                expressionAttributeValues[valueKey] = value;
                updateExpressions.push(`${nameKey} = ${valueKey}`);
            });

            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { 
                    'qut-username': QUT_USERNAME,
                    'sk': `VIDEO#${videoId}`
                },
                UpdateExpression: 'SET ' + updateExpressions.join(', '),
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues
            });

            await this.dynamoClient.send(command);
            console.log(`📝 Updated job status for ${videoId}`);
        } catch (error) {
            console.error('❌ Error updating job status:', error);
            throw error;
        }
    }

    async createInitialMetaFile(videoId) {
        try {
            const metaKey = `meta/${videoId}.json`;
            const initialMeta = {
                status: 'processing',
                videoId: videoId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                transcriptId: null,
                summary: null,
                transcript: null,
                confidence: null
            };

            const command = new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: metaKey,
                Body: JSON.stringify(initialMeta, null, 2),
                ContentType: 'application/json'
            });

            await this.s3Client.send(command);
            console.log(`📝 Created initial meta file for ${videoId}`);
        } catch (error) {
            console.error('❌ Error creating initial meta file:', error);
            // Don't throw error as this is not critical
        }
    }

    async updateResolutionProgress(videoId, resolution, progress, status) {
        try {
            // Get current job data
            const getCommand = new GetCommand({
                TableName: this.tableName,
                Key: { 
                    'qut-username': QUT_USERNAME,
                    'sk': `VIDEO#${videoId}`
                }
            });

            const currentJob = await this.dynamoClient.send(getCommand);
            const currentResolutionProgress = currentJob.Item?.resolution_progress || {};

            // Update the specific resolution progress
            currentResolutionProgress[resolution] = {
                progress: Math.max(0, Math.min(100, progress)),
                status: status,
                updatedAt: new Date().toISOString()
            };

            // Calculate overall progress
            const resolutionList = ['1920x1080', '1280x720', '854x480'];
            const totalProgress = resolutionList.reduce((acc, res) => {
                return acc + (currentResolutionProgress[res]?.progress || 0);
            }, 0);
            const overallProgress = Math.floor(totalProgress / resolutionList.length);

            // Determine overall status
            const statuses = resolutionList.map(res => currentResolutionProgress[res]?.status || 'processing');
            let overallStatus = 'processing';
            if (statuses.every(s => s === 'completed')) {
                overallStatus = 'completed';
            } else if (statuses.some(s => s === 'failed')) {
                overallStatus = 'failed';
            }

            // Update job with new progress
            const updateCommand = new UpdateCommand({
                TableName: this.tableName,
                Key: { 
                    'qut-username': QUT_USERNAME,
                    'sk': `VIDEO#${videoId}`
                },
                UpdateExpression: 'SET resolution_progress = :rp, progress = :p, #status = :s, updated_at = :ua',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':rp': currentResolutionProgress,
                    ':p': overallProgress,
                    ':s': overallStatus,
                    ':ua': new Date().toISOString()
                }
            });

            await this.dynamoClient.send(updateCommand);
            console.log(`📊 Updated ${resolution} progress: ${progress}% (${status})`);
        } catch (error) {
            console.error('❌ Error updating resolution progress:', error);
            // Don't throw error as this is not critical for transcoding
        }
    }

    async cleanup(localVideoPath, results) {
        try {
            // Clean up input file
            await fs.unlink(localVideoPath).catch(() => {});
            
            // Clean up output files
            for (const result of results) {
                await fs.unlink(result.localPath).catch(() => {});
            }
            
            console.log('🧹 Cleaned up local files');
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }
}

module.exports = TranscodingWorker;
