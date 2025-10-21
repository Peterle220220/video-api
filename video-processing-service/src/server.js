const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const transcodingRoutes = require('./routes/transcoding');
const { initializeSQS, startMessageProcessor } = require('./services/sqsService');
const { startCPUMonitoring } = require('./utils/cpuMonitor');

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
        service: 'Video Processing Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
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

// Initialize and start server
async function startServer() {
    try {
        // Initialize SQS connections (skip if no AWS credentials)
        try {
            await initializeSQS();
            console.log('✅ SQS connections initialized');
            
            // Start message processor
            startMessageProcessor();
            console.log('✅ SQS message processor started');
        } catch (error) {
            console.warn('⚠️ SQS initialization skipped (no AWS credentials):', error.message);
        }

        // Start CPU monitoring
        startCPUMonitoring();
        console.log('✅ CPU monitoring started');

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Video Processing Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start Video Processing Service:', error);
        process.exit(1);
    }
}

startServer();
