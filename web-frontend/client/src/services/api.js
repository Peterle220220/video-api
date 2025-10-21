import axios from 'axios';

// Auto-detect backend base URL using current host (EC2 IP/domain) with port 3000 by default.
// Can be overridden by REACT_APP_API_BASE when needed (e.g., different host/port).
const { protocol, hostname } = window.location;
const inferredApiBase = `${protocol}//${hostname}:3000`;
const apiBaseUrl = process.env.REACT_APP_API_BASE || inferredApiBase;

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

api.interceptors.response.use((response) => {
    return response;
}, (error) => {
    const status = error && error.response && error.response.status;
    if (status === 401) {
        const requestUrl = (error && error.config && error.config.url) || '';
        const isAuthRequest = requestUrl.startsWith('/api/auth');
        const currentPath = window.location && window.location.pathname;
        const isOnAuthPage = currentPath === '/login' || currentPath === '/register' || currentPath === '/forgot-password';

        // Chỉ redirect khi 401 xảy ra trên các API protected, không phải auth endpoints
        // và khi không đứng ở trang auth (để tránh refresh làm mất state lỗi trên Login)
        if (!isAuthRequest && !isOnAuthPage) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
    }
    return Promise.reject(error);
});

export const endpoints = {
    auth: {
        login: '/api/auth/login',
        register: '/api/auth/register',
        confirm: '/api/auth/confirm',
        profile: '/api/auth/profile',
        test: '/api/auth/test',
        challenge: '/api/auth/challenge',
        totpAssociate: '/api/auth/mfa/totp/associate',
        totpVerify: '/api/auth/mfa/totp/verify',
        mfaDisable: '/api/auth/mfa/disable',
    },
    storage: {
        presignUpload: '/api/storage/presign-upload',
        presignDownload: '/api/storage/presign-download',
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
};
