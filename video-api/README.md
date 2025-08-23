# Video Transcoding API

A RESTful API for video streaming with CPU‑intensive transcoding (>80%) to stress test system performance.

## 🚀 Key Features

- **Video Upload & Management**: Upload and manage video files
- **CPU-Intensive Transcoding**: Convert videos to multiple resolutions using FFmpeg
- **Real-time CPU Monitoring**: Track CPU usage during transcoding
- **Authentication & Authorization**: JWT-based authentication
- **No Database Required**: In-memory job and account config
- **Containerization**: Docker and Docker Compose

## 🛠️ Technology Stack

- **Backend**: Node.js + Express.js
- **Data Storage**: In-memory (no DB)
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

3. (Optional) Build and run API only with Docker Compose

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

Removed in this demo (no database)

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
- Historical data stored in memory (last 100 readings)
- Alert when CPU > 80%
- System metrics (memory, load average)

### Job Progress Tracking

- Real-time progress updates
- Job status management
- Error handling and logging

## 🔐 Authentication

Registration endpoint disabled in this demo

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### Accounts

Accounts are configured in `src/config/accounts.js`.

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

## 🧪 CPU Load Testing with Docker (k6)

Goal: drive CPU >80% for 5 minutes with network headroom (the `test-cpu` endpoint transfers very little data).

### 1) Get JWT token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# copy the "token" value from the response
```

### 2) Run the whole stack (API + Load Generator)

Edit the `load` service in `docker-compose.yml` to set `AUTH_TOKEN` using the token above (or export it when running k6 manually).

```yaml
  load:
    image: grafana/k6:0.49.0
    environment:
      - API_BASE=http://api:3000
      - AUTH_TOKEN=REPLACE_WITH_YOUR_TOKEN
      - TEST_DURATION=5m
      - VUS=25
    volumes:
      - ./scripts:/scripts
    entrypoint: ["k6", "run", "/scripts/test-cpu.js"]
```

Start:

```bash
docker-compose up -d --build
docker-compose logs -f api | cat
```

Monitor CPU in API logs (you will see >80% warnings and transcoding progress if present):

```bash
docker-compose logs -f api | cat
```

k6 results will be written to `video-api/scripts/k6_results.csv` (if `K6_OUT=csv` is enabled).

### 3) Run k6 manually (optional)

If you don't want to use the `load` service, you can run it separately:

```bash
docker run --rm -it \
  -e API_BASE=http://host.docker.internal:3000 \
  -e AUTH_TOKEN=YOUR_TOKEN \
  -e TEST_DURATION=5m \
  -e VUS=25 \
  -v $(pwd)/scripts:/scripts \
  grafana/k6:0.49.0 run /scripts/test-cpu.js
```

Notes:
- `VUS` controls the number of virtual users; 20–40 is usually enough to keep CPU >80% with the `test-cpu` endpoint (each request triggers a 300s compute loop on the server).
- Network headroom: the endpoint only sends/receives small JSON ⇒ low bandwidth, leaving enough headroom to scale out to ≥3 servers.

## 📁 Project Structure

```
video-api/
├── src/
│   ├── config/
│   │   ├── accounts.js      # Local accounts configuration
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

Database and Redis have been removed in this demo.

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
