import axios from 'axios';

// Auto-detect backend base URL using current host (EC2 IP/domain) with port 3000 by default.
// Can be overridden by REACT_APP_API_BASE when needed (e.g., different host/port).
const { protocol, hostname } = window.location;
const inferredApiBase = `${protocol}//${hostname}:3000`;
const apiBaseUrl = inferredApiBase;

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
        meta: (videoId) => `/api/transcoding/videos/${videoId}/meta`,
    },
    videos: {
        updateDescription: (videoId) => `/api/videos/${videoId}/description`,
    },
    staticPaths: {
        processed: (filename) => `${apiBaseUrl}/processed/${filename}`,
        uploads: (filename) => `${apiBaseUrl}/uploads/${filename}`,
    },
};


