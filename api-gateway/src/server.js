const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const proxyRoutes = require('./routes/proxy');
const { initializeSQS } = require('./services/sqsService');
const QueueManager = require('./utils/queueManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'API Gateway',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', proxyRoutes);

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
        // Initialize queues first (skip if no AWS credentials)
        try {
            const queueManager = new QueueManager();
            await queueManager.initializeQueues();
            console.log('✅ SQS queues initialized');
        } catch (error) {
            console.warn('⚠️ SQS queues initialization skipped (no AWS credentials):', error.message);
        }

        // Initialize SQS connections (skip if no AWS credentials)
        try {
            await initializeSQS();
            console.log('✅ SQS connections initialized');
        } catch (error) {
            console.warn('⚠️ SQS connections initialization skipped (no AWS credentials):', error.message);
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 API Gateway running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start API Gateway:', error);
        process.exit(1);
    }
}

startServer();
