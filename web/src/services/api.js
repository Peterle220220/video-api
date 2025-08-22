import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

export const api = axios.create({
    baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const endpoints = {
    auth: {
        login: '/api/auth/login',
        profile: '/api/auth/profile',
        test: '/api/auth/test',
    },
    transcoding: {
        start: '/api/transcoding/start',
        jobs: '/api/transcoding/jobs',
        status: (jobId) => `/api/transcoding/status/${jobId}`,
        transcodedList: (videoId) => `/api/transcoding/videos/${videoId}/transcoded`,
        library: '/api/transcoding/library',
        metrics: '/api/transcoding/metrics',
        metadata: (videoId, resolution) => `/api/transcoding/metadata/${videoId}/${resolution}`,
        deleteVideo: (videoId) => `/api/transcoding/videos/${videoId}`,
    },
    staticPaths: {
        processed: (filename) => `${apiBaseUrl}/processed/${filename}`,
        uploads: (filename) => `${apiBaseUrl}/uploads/${filename}`,
    },
};


