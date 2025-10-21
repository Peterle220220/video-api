const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
// Removed SSM dependency for now

const { startCPUMonitoring } = require('./utils/cpuMonitor');
const { failInFlightJobsOnStartup } = require('./services/dynamoService');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'transcoding-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Use environment variables directly instead of SSM
        process.env.AAI_API_BASE = process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2';
        process.env.FFMPEG_PRESET = process.env.FFMPEG_PRESET || 'medium';
        process.env.FFMPEG_CRF = process.env.FFMPEG_CRF || '23';
        process.env.FFMPEG_FPS = process.env.FFMPEG_FPS || '30';
        process.env.FFMPEG_THREADS = process.env.FFMPEG_THREADS || '0';
        process.env.DEFAULT_RESOLUTIONS = process.env.DEFAULT_RESOLUTIONS || '["1920x1080","1280x720","854x480"]';
        process.env.MAX_CONCURRENT_TRANSCODES = process.env.MAX_CONCURRENT_TRANSCODES || '2';
        process.env.MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '1073741824';
        

        // Register routes
        const transcodingRoutes = require('./routes/transcoding');
        app.use('/api/transcoding', transcodingRoutes);
        
        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
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
            console.log(`🚀 Transcoding Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔄 Transcoding API: http://localhost:${PORT}/api/transcoding`);
        });
    } catch (error) {
        console.error('❌ Failed to start transcoding service:', error);
        process.exit(1);
    }
}

// Removed SSM loadRuntimeParameters functions

startServer();
