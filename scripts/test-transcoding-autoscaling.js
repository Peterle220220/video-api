const axios = require('axios');

const API_URL = 'https://n12122882.cab432.com';
const TOKEN = 'eyJraWQiOiJrVVJRNENoTTJTajhpVnNxQ2ZQaXBqU0FsbGlVTmd2dTVzbmdPWWwwczFnPSIsImFsZyI6IlJTMjU2In0';

async function triggerCPULoad() {
    console.log('🔥 Starting CPU load test on Transcoding Service...');
    
    const requests = [];
    
    for (let i = 0; i < 5; i++) {
        const promise = axios.post(
            `${API_URL}/api/transcoding/test-cpu`,
            { duration: 120 }, // 2 minutes
            {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        ).then(response => {
            console.log(`✅ Request ${i + 1} started:`, response.data);
        }).catch(error => {
            console.error(`❌ Request ${i + 1} failed:`, error.message);
        });
        
        requests.push(promise);
        
        // Delay nhỏ giữa các requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await Promise.all(requests);
    console.log('✅ All CPU load tests started!');
}

// Hoặc test với real transcoding jobs
async function triggerTranscodingJobs() {
    console.log('🎬 Starting multiple transcoding jobs...');
    
    for (let i = 0; i < 10; i++) {
        try {
            const response = await axios.post(
                `${API_URL}/api/transcoding/start`,
                {
                    s3Key: `test-videos/sample-${i}.mp4`,
                    title: `Load Test Video ${i}`,
                    resolutions: ['1920x1080', '1280x720', '854x480']
                },
                {
                    headers: {
                        'Authorization': `Bearer ${TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log(`✅ Job ${i + 1}/10 created:`, response.data.videoId);
        } catch (error) {
            console.error(`❌ Job ${i + 1} failed:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

// Chọn 1 trong 2 methods:
triggerCPULoad().catch(console.error);
// triggerTranscodingJobs().catch(console.error);