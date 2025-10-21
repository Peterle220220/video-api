const axios = require('axios');

// Service discovery configuration
const SERVICES = {
    auth: {
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        timeout: 5000
    },
    transcoding: {
        url: process.env.TRANSCODING_SERVICE_URL || 'http://localhost:3002',
        timeout: 30000
    },
    upload: {
        url: process.env.UPLOAD_SERVICE_URL || 'http://localhost:3003',
        timeout: 10000
    }
};

// Create HTTP clients for each service
const createServiceClient = (serviceName, config) => {
    const client = axios.create({
        baseURL: config.url,
        timeout: config.timeout,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Add request interceptor for authentication
    client.interceptors.request.use((requestConfig) => {
        // Add service-to-service authentication if needed
        if (process.env.SERVICE_AUTH_TOKEN) {
            requestConfig.headers['X-Service-Auth'] = process.env.SERVICE_AUTH_TOKEN;
        }
        return requestConfig;
    });

    // Add response interceptor for error handling
    client.interceptors.response.use(
        (response) => response,
        (error) => {
            console.error(`Service ${serviceName} error:`, error.message);
            return Promise.reject(error);
        }
    );

    return client;
};

// Export service clients
const authClient = createServiceClient('auth', SERVICES.auth);
const transcodingClient = createServiceClient('transcoding', SERVICES.transcoding);
const uploadClient = createServiceClient('upload', SERVICES.upload);

// Service communication functions
const serviceCommunication = {
    // Auth service calls
    auth: {
        verifyToken: async (token) => {
            try {
                const response = await authClient.get('/api/auth/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                return response.data;
            } catch (error) {
                throw new Error(`Auth service error: ${error.message}`);
            }
        }
    },

    // Transcoding service calls
    transcoding: {
        startTranscoding: async (videoData) => {
            try {
                const response = await transcodingClient.post('/api/transcoding/start', videoData);
                return response.data;
            } catch (error) {
                throw new Error(`Transcoding service error: ${error.message}`);
            }
        },

        getJobStatus: async (jobId) => {
            try {
                const response = await transcodingClient.get(`/api/transcoding/status/${jobId}`);
                return response.data;
            } catch (error) {
                throw new Error(`Transcoding service error: ${error.message}`);
            }
        }
    },

    // Upload service calls
    upload: {
        generatePresignedUrl: async (uploadData) => {
            try {
                const response = await uploadClient.post('/api/storage/presign-upload', uploadData);
                return response.data;
            } catch (error) {
                throw new Error(`Upload service error: ${error.message}`);
            }
        },

        processAssemblyAI: async (videoData) => {
            try {
                const response = await uploadClient.post('/api/storage/process-assemblyai', videoData);
                return response.data;
            } catch (error) {
                throw new Error(`Upload service error: ${error.message}`);
            }
        }
    }
};

module.exports = {
    authClient,
    transcodingClient,
    uploadClient,
    serviceCommunication,
    SERVICES
};
