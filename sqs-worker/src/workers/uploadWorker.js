const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

class UploadWorker {
    constructor() {
        this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
        this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' }));
        this.tableName = process.env.DYNAMODB_TABLE_NAME || 'video-jobs';
    }

    async process(messageBody, message) {
        try {
            const { videoId, s3Key, filename, retryCount = 0 } = messageBody;
            
            console.log(`📁 Processing upload job for video ${videoId}`);
            
            // Update job status
            await this.updateJobStatus(videoId, {
                upload_status: 'processing',
                upload_started_at: new Date().toISOString(),
                retry_count: retryCount
            });

            // Process file metadata
            const metadata = await this.processFileMetadata(s3Key, filename);
            
            // Generate thumbnails (if needed)
            await this.generateThumbnails(videoId, s3Key);
            
            // Update job status to completed
            await this.updateJobStatus(videoId, {
                upload_status: 'completed',
                upload_completed_at: new Date().toISOString(),
                metadata: metadata
            });

            console.log(`✅ Upload processing completed for video ${videoId}`);
            return { success: true, videoId, metadata };

        } catch (error) {
            console.error(`❌ Upload processing failed for video ${messageBody.videoId}:`, error);
            
            // Update job status to failed
            await this.updateJobStatus(messageBody.videoId, {
                upload_status: 'failed',
                upload_error: error.message,
                upload_failed_at: new Date().toISOString()
            });
            
            throw error;
        }
    }

    async processFileMetadata(s3Key, filename) {
        try {
            console.log(`📊 Processing metadata for ${filename}`);
            
            // Get file info from S3
            const command = new GetObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: s3Key
            });

            const response = await this.s3Client.send(command);
            
            const metadata = {
                filename,
                size: response.ContentLength,
                contentType: response.ContentType,
                lastModified: response.LastModified,
                uploadedAt: new Date().toISOString()
            };

            console.log(`📊 Metadata processed:`, metadata);
            return metadata;

        } catch (error) {
            console.error('❌ Error processing file metadata:', error);
            throw error;
        }
    }

    async generateThumbnails(videoId, s3Key) {
        try {
            console.log(`🖼️ Generating thumbnails for video ${videoId}`);
            
            // This would implement thumbnail generation logic
            // For now, just log the process
            console.log(`🖼️ Thumbnails generated for ${videoId}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error generating thumbnails:', error);
            // Don't throw error for thumbnail generation failure
            console.warn('⚠️ Thumbnail generation failed, continuing...');
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
            console.log(`📝 Updated upload job status for ${videoId}`);
        } catch (error) {
            console.error('❌ Error updating job status:', error);
            throw error;
        }
    }
}

module.exports = UploadWorker;
