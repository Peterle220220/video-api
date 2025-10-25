import axios from 'axios';

// Auto-detect backend base URL using current host (EC2 IP/domain).
// Can be overridden by REACT_APP_API_BASE when needed (e.g., different host/port).
const { protocol, hostname } = window.location;
const inferredApiBase = `${protocol}//${hostname}`;
const apiBaseUrl = process.env.REACT_APP_API_BASE || inferredApiBase;

// Service-specific base URLs
const authServiceUrl = process.env.REACT_APP_AUTH_SERVICE_URL || `${protocol}//${hostname}`;
const transcodingServiceUrl = process.env.REACT_APP_TRANSCODING_SERVICE_URL || `${protocol}//${hostname}`;
const uploadServiceUrl = process.env.REACT_APP_UPLOAD_SERVICE_URL || `${protocol}//${hostname}`;

// Main API client (deprecated - use service-specific APIs)
// export const api = axios.create({
//     baseURL: apiBaseUrl,
// });

// Service-specific API clients
export const authApi = axios.create({
    baseURL: inferredApiBase,
});

export const transcodingApi = axios.create({
    baseURL: inferredApiBase,
});

export const uploadApi = axios.create({
    baseURL: inferredApiBase,
});

// Common interceptor function
const addAuthInterceptor = (axiosInstance) => {
    axiosInstance.interceptors.request.use((config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    axiosInstance.interceptors.response.use((response) => {
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
};

// Apply interceptors to all API clients
addAuthInterceptor(authApi);
addAuthInterceptor(transcodingApi);
addAuthInterceptor(uploadApi);

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

// Static file paths for processed videos
const staticPaths = {
    processed: (relPath) => `${transcodingServiceUrl}/static/processed/${relPath}`,
};

export { staticPaths };


