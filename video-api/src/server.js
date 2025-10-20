const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const Module = require('module');

// Ensure shared modules can resolve dependencies from app's node_modules
(function ensureAppNodeModulesInPath() {
    try {
        const appNodeModules = path.resolve(__dirname, '..', 'node_modules');
        if (appNodeModules) {
            process.env.NODE_PATH = process.env.NODE_PATH
                ? `${appNodeModules}${path.delimiter}${process.env.NODE_PATH}`
                : appNodeModules;
            Module._initPaths();
        }
    } catch (_) { /* no-op */ }
})();

const { startCPUMonitoring } = require('./utils/cpuMonitor');
const multer = require('multer');
const { failInFlightJobsOnStartup } = require('./services/db/dynamoService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static serving removed for stateless design; use S3 presigned URLs instead

// Routes will be registered after runtime parameters are loaded

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString(), uptime: process.uptime() });
});


// Initialize and start server
async function startServer() {
    try {
        const SKIP_SSM = String(process.env.SKIP_SSM || '').toLowerCase() === '1' || String(process.env.SKIP_SSM || '').toLowerCase() === 'true';
        if (!SKIP_SSM) {
            // Load parameter for AAI base (string)
            process.env.AAI_API_BASE = await loadRuntimeParameters({ paramsNames: '/n12122882/video_api/aai_base' });

            // Load consolidated FFmpeg/config JSON and map to env
            const ffmpegConfig = await loadRuntimeParametersJson({ paramName: '/n12122882/video_api/ffmpeg_config' });

            if (ffmpegConfig && ffmpegConfig.ffmpeg) {
                if (ffmpegConfig.ffmpeg.preset) process.env.FFMPEG_PRESET = String(ffmpegConfig.ffmpeg.preset);
                if (ffmpegConfig.ffmpeg.crf != null) process.env.FFMPEG_CRF = String(ffmpegConfig.ffmpeg.crf);
                if (ffmpegConfig.ffmpeg.fps != null) process.env.FFMPEG_FPS = String(ffmpegConfig.ffmpeg.fps);
                if (ffmpegConfig.ffmpeg.threads != null) process.env.FFMPEG_THREADS = String(ffmpegConfig.ffmpeg.threads);
            }
            if (ffmpegConfig && ffmpegConfig.transcoding) {
                if (Array.isArray(ffmpegConfig.transcoding.defaultResolutions)) {
                    process.env.DEFAULT_RESOLUTIONS = JSON.stringify(ffmpegConfig.transcoding.defaultResolutions);
                }
                if (ffmpegConfig.transcoding.maxConcurrent != null) {
                    process.env.MAX_CONCURRENT_TRANSCODES = String(ffmpegConfig.transcoding.maxConcurrent);
                }
            }
            if (ffmpegConfig && ffmpegConfig.limits) {
                if (ffmpegConfig.limits.maxFileSize) process.env.MAX_FILE_SIZE = String(ffmpegConfig.limits.maxFileSize);
            }
            if (ffmpegConfig && ffmpegConfig.monitoring) {
                if (ffmpegConfig.monitoring.cpuMonitoringInterval != null) {
                    process.env.CPU_MONITORING_INTERVAL = String(ffmpegConfig.monitoring.cpuMonitoringInterval);
                }
            }
        } else {
            // Local/dev defaults when skipping SSM
            if (!process.env.AAI_API_BASE) process.env.AAI_API_BASE = 'https://api.assemblyai.com/v2';
            console.log('⚙️  SKIP_SSM enabled - using local defaults for config');
        }

        // Now that env is ready, register routes (modules may read env at load time)
        const authRoutes = require('./routes/auth');
        const transcodingRoutes = require('./routes/transcoding');
        const videoRoutes = require('./routes/videos');
        const storageRoutes = require('./routes/storage');

        app.use('/api/auth', authRoutes);
        app.use('/api/transcoding', transcodingRoutes);
        app.use('/api/videos', videoRoutes);
        app.use('/api/storage', storageRoutes);
        
        // 404 handler (placed after routes so they can match first)
        app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });

        // Multer-specific error handler (e.g., file too large)
        app.use((err, req, res, next) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        error: 'File too large',
                        message: 'Uploaded file exceeds the allowed size',
                    });
                }
                return res.status(400).json({ error: 'Upload error', code: err.code, message: err.message });
            }
            return next(err);
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                error: 'Something went wrong!',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
            });
        });
        // Start CPU monitoring
        startCPUMonitoring();
        console.log('✅ CPU monitoring started');

        // Crash-safety: mark in-flight jobs as failed on startup (stateless readiness)
        try {
            const count = await failInFlightJobsOnStartup('Service restarted');
            if (count > 0) console.log(`🧹 Marked ${count} in-flight job(s) as failed on startup`);
        } catch (e) {
            console.warn('Startup job reconciliation failed:', e?.message || e);
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔄 Transcoding API: http://localhost:${PORT}/api/transcoding`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
async function loadRuntimeParameters({ paramsNames = ''}) {
    const ssm = new SSMClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
    const res = await ssm.send(new GetParameterCommand({ Name: paramsNames }));
    return res.Parameter?.Value || '';
}

async function loadRuntimeParametersJson({ paramName = '' }) {
    if (!paramName) return null;
    const ssm = new SSMClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
    const res = await ssm.send(new GetParameterCommand({ Name: paramName }));
    const raw = res.Parameter?.Value || '';
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (_) {
        console.warn(`Failed to parse JSON from SSM parameter: ${paramName}`);
        return null;
    }
}
startServer();
