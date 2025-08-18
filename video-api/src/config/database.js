const mongoose = require('mongoose');

// MongoDB connection options
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    // bufferMaxEntries: 0,
    bufferCommands: false
};

// Test database connection
async function testConnection() {
    try {
        await mongoose.connection.db.admin().ping();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
}

// Initialize database connection
async function initializeDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/video_api';

        // Connect to MongoDB
        await mongoose.connect(mongoUri, mongoOptions);

        console.log('✅ MongoDB connected successfully');

        // Create indexes for better performance
        await createIndexes();

        // Create default admin user if not exists
        await createDefaultAdmin();

        console.log('✅ Database initialization completed');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Create database indexes
async function createIndexes() {
    try {
        // Users collection indexes
        await mongoose.connection.db.collection('users').createIndex({ username: 1 }, { unique: true });
        await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });

        // Videos collection indexes
        await mongoose.connection.db.collection('videos').createIndex({ user_id: 1 });
        await mongoose.connection.db.collection('videos').createIndex({ status: 1 });
        await mongoose.connection.db.collection('videos').createIndex({ created_at: -1 });

        // Transcoding jobs indexes
        await mongoose.connection.db.collection('transcoding_jobs').createIndex({ job_id: 1 }, { unique: true });
        await mongoose.connection.db.collection('transcoding_jobs').createIndex({ video_id: 1 });
        await mongoose.connection.db.collection('transcoding_jobs').createIndex({ status: 1 });

        // Transcoded videos indexes
        await mongoose.connection.db.collection('transcoded_videos').createIndex({ video_id: 1 });
        await mongoose.connection.db.collection('transcoded_videos').createIndex({ resolution: 1 });

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('❌ Failed to create indexes:', error);
        throw error;
    }
}

// Create default admin user
async function createDefaultAdmin() {
    try {
        const bcrypt = require('bcryptjs');
        const adminPassword = await bcrypt.hash('admin123', 10);

        const adminUser = {
            username: 'admin',
            email: 'admin@example.com',
            password_hash: adminPassword,
            role: 'admin',
            created_at: new Date(),
            updated_at: new Date()
        };

        // Use upsert to avoid duplicate key errors
        await mongoose.connection.db.collection('users').updateOne(
            { username: 'admin' },
            { $setOnInsert: adminUser },
            { upsert: true }
        );

        console.log('✅ Default admin user created/verified');
    } catch (error) {
        console.error('❌ Failed to create default admin:', error);
        throw error;
    }
}

// Get database connection
function getConnection() {
    return mongoose.connection;
}

// Close database connection
async function closeConnection() {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
    }
}

module.exports = {
    testConnection,
    initializeDatabase,
    getConnection,
    closeConnection
};
