const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const transcodingRoutes = require('./routes/transcoding');
const videoRoutes = require('./routes/videos');
const storageRoutes = require('./routes/storage');
const { startCPUMonitoring } = require('./utils/cpuMonitor');
const multer = require('multer');
const { failInFlightJobsOnStartup } = require('./services/db/dynamoService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static serving removed for stateless design; use S3 presigned URLs instead

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transcoding', transcodingRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/storage', storageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
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

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize and start server
async function startServer() {
    try {
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

startServer();
