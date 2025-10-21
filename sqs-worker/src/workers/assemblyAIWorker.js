const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const axios = require('axios');

class AssemblyAIWorker {
    constructor() {
        this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
        this.dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' }));
        this.tableName = process.env.DYNAMODB_TABLE_NAME || 'video-jobs';
        this.assemblyAIKey = process.env.ASSEMBLY_AI_API_KEY;
        this.assemblyAIBase = process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2';
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
                Bucket: process.env.S3_BUCKET_NAME,
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
