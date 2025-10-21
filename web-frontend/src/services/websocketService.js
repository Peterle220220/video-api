const { v4: uuidv4 } = require('uuid');

// Store connected users
const connectedUsers = new Map();

function initializeWebSocket(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Handle user authentication
        socket.on('authenticate', (data) => {
            const { userId, token } = data;
            if (userId && token) {
                // Join user-specific room
                socket.join(`user_${userId}`);
                connectedUsers.set(socket.id, { userId, token, connectedAt: new Date() });
                console.log(`👤 User ${userId} authenticated and joined room`);
                
                // Send confirmation
                socket.emit('authenticated', {
                    userId,
                    message: 'Successfully authenticated',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Handle video upload requests
        socket.on('upload-request', async (data) => {
            try {
                const { userId, filename, contentType } = data;
                console.log(`📤 Upload request from user ${userId}: ${filename}`);
                
                // Forward to API Gateway via SQS
                const { sendMessage } = require('./sqsService');
                await sendMessage('storage-queue', {
                    action: 'presign-upload',
                    userId,
                    filename,
                    contentType,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('upload-request-sent', {
                    message: 'Upload request sent to storage service',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error handling upload request:', error);
                socket.emit('error', {
                    message: 'Failed to process upload request',
                    error: error.message
                });
            }
        });

        // Handle transcoding start requests
        socket.on('start-transcoding', async (data) => {
            try {
                const { userId, s3Key, title, description, resolutions } = data;
                console.log(`🎬 Transcoding request from user ${userId}: ${s3Key}`);
                
                // Forward to Video Processing Service via SQS
                const { sendMessage } = require('./sqsService');
                await sendMessage('transcoding-queue', {
                    action: 'start-transcoding',
                    userId,
                    s3Key,
                    title,
                    description,
                    resolutions,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('transcoding-request-sent', {
                    message: 'Transcoding request sent to processing service',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error handling transcoding request:', error);
                socket.emit('error', {
                    message: 'Failed to process transcoding request',
                    error: error.message
                });
            }
        });

        // Handle status check requests
        socket.on('check-status', async (data) => {
            try {
                const { userId, jobId } = data;
                console.log(`📊 Status check request from user ${userId}: ${jobId}`);
                
                // Forward to Video Processing Service via SQS
                const { sendMessage } = require('./sqsService');
                await sendMessage('transcoding-queue', {
                    action: 'get-status',
                    userId,
                    jobId,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('status-request-sent', {
                    message: 'Status request sent to processing service',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error handling status check:', error);
                socket.emit('error', {
                    message: 'Failed to check status',
                    error: error.message
                });
            }
        });

        // Handle CPU test requests
        socket.on('test-cpu', async (data) => {
            try {
                const { userId, duration } = data;
                console.log(`🔥 CPU test request from user ${userId}: ${duration}s`);
                
                // Forward to Video Processing Service via SQS
                const { sendMessage } = require('./sqsService');
                await sendMessage('transcoding-queue', {
                    action: 'test-cpu',
                    userId,
                    duration,
                    timestamp: new Date().toISOString()
                });
                
                socket.emit('cpu-test-sent', {
                    message: 'CPU test request sent to processing service',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error handling CPU test:', error);
                socket.emit('error', {
                    message: 'Failed to start CPU test',
                    error: error.message
                });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            const userInfo = connectedUsers.get(socket.id);
            if (userInfo) {
                console.log(`👋 User ${userInfo.userId} disconnected`);
                connectedUsers.delete(socket.id);
            } else {
                console.log(`👋 Anonymous client disconnected: ${socket.id}`);
            }
        });

        // Send welcome message
        socket.emit('connected', {
            message: 'Connected to Web Frontend Service',
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });
    });

    // Broadcast system status every 30 seconds
    setInterval(() => {
        const status = {
            connectedClients: io.engine.clientsCount,
            connectedUsers: connectedUsers.size,
            timestamp: new Date().toISOString()
        };
        io.emit('system-status', status);
    }, 30000);

    console.log('🌐 WebSocket service initialized');
}

// Get connected users count
function getConnectedUsersCount() {
    return connectedUsers.size;
}

// Get all connected users
function getConnectedUsers() {
    return Array.from(connectedUsers.values());
}

// Broadcast message to specific user
function broadcastToUser(userId, event, data) {
    const io = require('../server').io;
    io.to(`user_${userId}`).emit(event, data);
}

// Broadcast message to all users
function broadcastToAll(event, data) {
    const io = require('../server').io;
    io.emit(event, data);
}

module.exports = {
    initializeWebSocket,
    getConnectedUsersCount,
    getConnectedUsers,
    broadcastToUser,
    broadcastToAll
};
