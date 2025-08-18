# Video Transcoding API

A RESTful API for video streaming with CPU‑intensive transcoding (>80%) to stress test system performance.

## 🚀 Key Features

- **Video Upload & Management**: Upload and manage video files
- **CPU-Intensive Transcoding**: Convert videos to multiple resolutions using FFmpeg
- **Real-time CPU Monitoring**: Track CPU usage during transcoding
- **Authentication & Authorization**: JWT-based authentication
- **Database Management**: MongoDB for structured data
- **Caching**: Redis for session and cache management
- **Containerization**: Docker and Docker Compose

## 🛠️ Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Cache**: Redis
- **Video Processing**: FFmpeg
- **Authentication**: JWT
- **Containerization**: Docker + Docker Compose
- **File Upload**: Multer

## 📋 System Requirements

- Docker and Docker Compose
- Node.js 18+ (for development)
- FFmpeg (included in the Docker image)

## 🚀 Setup & Run

### Using Docker Compose (Recommended)

1. **Clone the repository and navigate into the directory:**

```bash
cd video-api
```

2. **Start the whole stack:**

```bash
docker-compose up -d
```

3. **Check logs:**

```bash
docker-compose logs -f api
```

### Development Mode

1. **Install dependencies:**

```bash
npm install
```

2. **Create a .env file from env.example:**

```bash
cp env.example .env
```

3. **Start MongoDB and Redis:**

```bash
docker-compose up mongodb redis -d
```

4. **Run the app:**

```bash
npm run dev
```

## 📊 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in
- `GET /api/auth/profile` - Get profile info

### Video Management

- `GET /api/videos` - Get video list
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update a video
- `DELETE /api/videos/:id` - Delete a video
- `GET /api/videos/user/me` - Get current user's videos

### Transcoding (CPU-Intensive)

- `POST /api/transcoding/start` - Start video transcoding
- `GET /api/transcoding/status/:jobId` - Check job status
- `GET /api/transcoding/jobs` - Get list of active jobs
- `DELETE /api/transcoding/cancel/:jobId` - Cancel a job
- `GET /api/transcoding/metrics` - Get system metrics
- `POST /api/transcoding/test-cpu` - Test a CPU-intensive operation

### System

- `GET /health` - Health check

## 🔥 CPU-Intensive Features

### Video Transcoding

The API will use **80–95% CPU** when transcoding video:

```bash
# Start transcoding
curl -X POST http://localhost:3000/api/transcoding/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "video=@sample.mp4" \
  -F "title=Sample Video" \
  -F "resolutions=[\"1920x1080\",\"1280x720\",\"854x480\"]"
```

### CPU Test

Test CPU usage for 30 seconds:

```bash
curl -X POST http://localhost:3000/api/transcoding/test-cpu \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 30}'
```

### Monitor CPU Usage

```bash
# Get real-time metrics
curl -X GET http://localhost:3000/api/transcoding/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📈 Monitoring

### CPU Usage Monitoring

- Real-time CPU usage tracking
- Historical data stored in Redis
- Alert when CPU > 80%
- System metrics (memory, load average)

### Job Progress Tracking

- Real-time progress updates
- Job status management
- Error handling and logging

## 🔐 Authentication

### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### Default Admin User

- Username: `admin`
- Password: `admin123`
- Role: `admin`

## 🐳 Docker Commands

```bash
# Build image
docker build -t video-api .

# Run container
docker run -p 3000:3000 video-api

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

## 📁 Project Structure

```
video-api/
├── src/
│   ├── config/
│   │   ├── database.js      # MongoDB configuration
│   │   └── redis.js         # Redis configuration
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── models/
│   │   ├── User.js          # User model
│   │   ├── Video.js         # Video model
│   │   ├── TranscodingJob.js # Transcoding job model
│   │   └── TranscodedVideo.js # Transcoded video model
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   ├── videos.js        # Video management routes
│   │   └── transcoding.js   # Transcoding routes
│   ├── services/
│   │   └── transcodingService.js  # FFmpeg transcoding service
│   ├── utils/
│   │   └── cpuMonitor.js    # CPU monitoring utilities
│   └── server.js            # Main server file
├── uploads/                 # Uploaded video files
├── processed/               # Transcoded video files
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `MONGODB_USER`: MongoDB username
- `MONGODB_PASSWORD`: MongoDB password
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port
- `JWT_SECRET`: JWT secret key
- `UPLOAD_PATH`: Video upload directory
- `PROCESSED_PATH`: Transcoded video directory
- `MAX_FILE_SIZE`: Maximum file size
- `CPU_MONITORING_INTERVAL`: CPU monitoring interval (ms)

## 🚨 Troubleshooting

### FFmpeg not found

```bash
# Install FFmpeg on Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Install FFmpeg on macOS
brew install ffmpeg

# Install FFmpeg on Windows
# Download from https://ffmpeg.org/download.html
```

### Database connection issues

```bash
# Check MongoDB status
docker-compose ps mongodb

# View MongoDB logs
docker-compose logs mongodb
```

### High CPU usage expected

⚠️ **Note**: Video transcoding will use **80–95% CPU** — this is expected behavior!

## 📝 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
