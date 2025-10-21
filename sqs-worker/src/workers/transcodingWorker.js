const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class TranscodingWorker {
    constructor() {
        this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
        this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' }));
        this.tableName = process.env.DYNAMODB_TABLE_NAME || 'video-jobs';
    }

    async process(messageBody, message) {
        try {
            const { videoId, inputSource, resolutions, retryCount = 0 } = messageBody;
            
            console.log(`🎬 Processing transcoding job for video ${videoId}`);
            
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
            
            // Update job status to failed
            await this.updateJobStatus(messageBody.videoId, {
                status: 'failed',
                error: error.message,
                failed_at: new Date().toISOString()
            });
            
            throw error;
        }
    }

    async downloadVideo(inputSource, videoId) {
        try {
            const { key } = inputSource;
            const localPath = `/tmp/${videoId}_${Date.now()}.mp4`;
            
            const command = new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
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
        
        for (const resolution of resolutions) {
            try {
                console.log(`🎞️ Transcoding to ${resolution}...`);
                
                const outputPath = `/tmp/${videoId}_${resolution}_${Date.now()}.mp4`;
                
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
                            resolve();
                        })
                        .on('error', (err) => {
                            console.error(`❌ Transcoding failed for ${resolution}:`, err);
                            reject(err);
                        })
                        .on('progress', (progress) => {
                            console.log(`📊 ${resolution} progress: ${progress.percent}%`);
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
                throw error;
            }
        }

        return results;
    }

    async uploadTranscodedVideos(results, videoId) {
        // This would implement S3 upload logic
        // For now, just log the results
        console.log(`📤 Uploading ${results.length} transcoded videos for ${videoId}`);
        
        for (const result of results) {
            console.log(`📤 Uploading ${result.resolution} to ${result.s3Key}`);
            // Implement S3 upload here
        }
    }

    async updateJobStatus(videoId, updates) {
        try {
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { video_id: videoId },
                UpdateExpression: 'SET ' + Object.keys(updates).map(key => `${key} = :${key}`).join(', '),
                ExpressionAttributeValues: Object.fromEntries(
                    Object.entries(updates).map(([key, value]) => [`:${key}`, value])
                )
            });

            await this.dynamoClient.send(command);
            console.log(`📝 Updated job status for ${videoId}`);
        } catch (error) {
            console.error('❌ Error updating job status:', error);
            throw error;
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
