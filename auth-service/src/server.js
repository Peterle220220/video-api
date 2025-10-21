const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
// Removed SSM dependency for now

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'auth-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Use environment variables directly instead of SSM
        process.env.AAI_API_BASE = process.env.AAI_API_BASE || 'https://api.assemblyai.com/v2';

        // Register auth routes
        const authRoutes = require('./routes/auth');
        app.use('/api/auth', authRoutes);
        
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
            console.log(`🚀 Auth Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
        });
    } catch (error) {
        console.error('❌ Failed to start auth service:', error);
        process.exit(1);
    }
}

// Removed SSM loadRuntimeParameters function

startServer();
