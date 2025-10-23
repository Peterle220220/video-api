const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');
const { AWS_REGION, S3_BUCKET, QUT_USERNAME, DDB_TABLE, ASSEMBLY_AI_API_KEY, AAI_API_BASE } = require('../config/aws');

class AssemblyAIWorker {
    constructor() {
        this.s3Client = new S3Client({ region: AWS_REGION });
        this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
        this.tableName = DDB_TABLE;
        this.assemblyAIKey = ASSEMBLY_AI_API_KEY;
        this.assemblyAIBase = AAI_API_BASE;
    }

    async process(messageBody, message) {
        try {
            const { videoId, s3Key, retryCount = 0 } = messageBody;
            
            console.log(`🤖 Processing AssemblyAI job for video ${videoId}`);
            
            // Update job status
            await this.updateJobStatus(videoId, {
                assemblyai_status: 'processing',
                assemblyai_started_at: new Date().toISOString(),
                retry_count: retryCount
            });

            // Get S3 presigned URL for AssemblyAI
            const audioUrl = await this.getAudioUrl(s3Key);
            
            // Submit to AssemblyAI
            const transcriptId = await this.submitToAssemblyAI(audioUrl);
            
            // Poll for completion
            const result = await this.pollAssemblyAI(transcriptId);
            
            // Create metadata file in S3
            await this.createMetadataFile(videoId, {
                status: 'completed',
                transcriptId,
                summary: result.summary,
                transcript: result.transcript,
                confidence: result.confidence,
                updatedAt: new Date().toISOString()
            });

            // Update job status to completed
            await this.updateJobStatus(videoId, {
                assemblyai_status: 'completed',
                assemblyai_completed_at: new Date().toISOString(),
                transcript_id: transcriptId,
                summary: result.summary,
                transcript: result.transcript
            });

            console.log(`✅ AssemblyAI processing completed for video ${videoId}`);
            return { success: true, videoId, result };

        } catch (error) {
            console.error(`❌ AssemblyAI processing failed for video ${messageBody.videoId}:`, error);
            
            // Create error metadata file in S3
            try {
                await this.createMetadataFile(messageBody.videoId, {
                    status: 'error',
                    error: error.message,
                    updatedAt: new Date().toISOString()
                });
            } catch (metaError) {
                console.error('❌ Failed to create error metadata file:', metaError);
            }
            
            // Update job status to failed
            await this.updateJobStatus(messageBody.videoId, {
                assemblyai_status: 'failed',
                assemblyai_error: error.message,
                assemblyai_failed_at: new Date().toISOString()
            });
            
            throw error;
        }
    }

    async getAudioUrl(s3Key) {
        try {
            // Generate presigned URL for AssemblyAI
            const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            
            const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key
            });

            const audioUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
            console.log(`🔗 Generated presigned URL for AssemblyAI`);
            return audioUrl;
        } catch (error) {
            console.error('❌ Error generating presigned URL:', error);
            throw error;
        }
    }

    async submitToAssemblyAI(audioUrl) {
        try {
            console.log(`📤 Submitting to AssemblyAI...`);
            
            const response = await axios.post(`${this.assemblyAIBase}/transcript`, {
                audio_url: audioUrl,
                summarization: true,
                summary_type: 'bullets',
                summary_model: 'informative'
            }, {
                headers: {
                    'Authorization': this.assemblyAIKey,
                    'Content-Type': 'application/json'
                }
            });

            const transcriptId = response.data.id;
            console.log(`📤 AssemblyAI submission successful: ${transcriptId}`);
            return transcriptId;

        } catch (error) {
            console.error('❌ Error submitting to AssemblyAI:', error.response?.data || error.message);
            throw error;
        }
    }

    async pollAssemblyAI(transcriptId) {
        try {
            console.log(`⏳ Polling AssemblyAI for transcript ${transcriptId}...`);
            
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes max
            
            while (attempts < maxAttempts) {
                const response = await axios.get(`${this.assemblyAIBase}/transcript/${transcriptId}`, {
                    headers: {
                        'Authorization': this.assemblyAIKey
                    }
                });

                const status = response.data.status;
                console.log(`📊 AssemblyAI status: ${status}`);

                if (status === 'completed') {
                    console.log(`✅ AssemblyAI processing completed`);
                    return {
                        transcript: response.data.text,
                        summary: response.data.summary,
                        confidence: response.data.confidence
                    };
                } else if (status === 'error') {
                    throw new Error(`AssemblyAI processing failed: ${response.data.error}`);
                }

                // Wait 5 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;
            }

            throw new Error('AssemblyAI processing timeout');

        } catch (error) {
            console.error('❌ Error polling AssemblyAI:', error);
            throw error;
        }
    }

    async createMetadataFile(videoId, metadata) {
        try {
            const key = `meta/${videoId}.json`;
            const content = JSON.stringify(metadata, null, 2);
            
            const command = new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: key,
                Body: content,
                ContentType: 'application/json'
            });
            
            await this.s3Client.send(command);
            console.log(`📄 Created metadata file for video ${videoId}: s3://${S3_BUCKET}/${key}`);
        } catch (error) {
            console.error('❌ Error creating metadata file:', error);
            throw error;
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
            console.log(`📝 Updated AssemblyAI job status for ${videoId}`);
        } catch (error) {
            console.error('❌ Error updating job status:', error);
            throw error;
        }
    }
}

module.exports = AssemblyAIWorker;
