const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const { initializeSQS, startMessageProcessor } = require('./services/sqsService');
const { initializeWebSocket } = require('./services/websocketService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Web Frontend Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API endpoints for real-time updates
app.get('/api/status', (req, res) => {
    res.json({
        connected: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
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
            startMessageProcessor(io);
            console.log('✅ SQS message processor started');
        } catch (error) {
            console.warn('⚠️ SQS initialization skipped (no AWS credentials):', error.message);
        }

        // Initialize WebSocket
        initializeWebSocket(io);
        console.log('✅ WebSocket initialized');

        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Web Frontend Service running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🌐 WebSocket server ready`);
        });
    } catch (error) {
        console.error('❌ Failed to start Web Frontend Service:', error);
        process.exit(1);
    }
}

startServer();
