const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
// Removed SSM dependency for now

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'upload-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Use environment variables directly instead of SSM
        process.env.AAI_API_BASE = process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2';
        process.env.ASSEMBLYAI_API_KEY = process.env.ASSEMBLY_AI_API_KEY || process.env.ASSEMBLYAI_API_KEY;

        // Register routes
        const videoRoutes = require('./routes/videos');
        const storageRoutes = require('./routes/storage');
        
        app.use('/api/videos', videoRoutes);
        app.use('/api/storage', storageRoutes);
        
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

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Upload Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📁 Upload API: http://localhost:${PORT}/api/storage`);
            console.log(`🎬 Videos API: http://localhost:${PORT}/api/videos`);
        });
    } catch (error) {
        console.error('❌ Failed to start upload service:', error);
        process.exit(1);
    }
}

// Removed SSM loadRuntimeParameters function

startServer();
