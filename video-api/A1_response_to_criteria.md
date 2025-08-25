# Assignment 1 - REST API Project - Response to Criteria

## Overview

- **Name:** Le Nam Phong
- **Student number:** N12122882
- **Application name:** Video Summary and Optimizer
- **Two line description:** This app uses FFmpeg to transcode uploaded videos into multiple resolutions and uses AssemblyAI to transcribe and summarize audio. Users can view and download each transcoded rendition and edit descriptions.

## Core criteria

### Containerise the app

- **ECR Repository name**: Project1-n12122882
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/Dockerfile`
  - `video-api/docker-compose.yml`

### Deploy the container

- **EC2 instance ID**: i-0ad89028b042e9bb0
- **Video timestamp:** mm:ss

### User login

- **One line description:** Hard‑coded username/password list with JWT-based sessions; admin can delete transcoded videos.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/config/accounts.js`
  - `video-api/src/middleware/auth.js`
  - `video-api/src/routes/auth.js`
  - `video-api/src/routes/transcoding.js`

### REST API

- **One line description:** REST API with noun-based endpoints and HTTP methods (GET, POST, PUT, DELETE) and appropriate status codes.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/server.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/routes/videos.js`
  - `video-api/src/services/transcodingService.js`

### Two kinds of data

#### First kind

- **One line description:** Video files (original uploads and transcoded outputs)
- **Type:** Unstructured
- **Rationale:** Large binary assets; stored on filesystem, no DB requirements
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`
  - `video-api/uploads/`
  - `video-api/processed/`

#### Second kind

- **One line description:** File metadata, per-video transcript/summary, and in-memory job status
- **Type:** Structured (JSON files on disk + in-memory maps); no ACID
- **Rationale:** Simple queries; low likelihood of concurrent writes; durable enough for demo
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/services/external/assemblyAIService.js`
  - `video-api/src/services/transcodingService.js`
  - `video-api/src/routes/videos.js`

### CPU intensive task

- **One line description**: Uses FFmpeg to transcode videos into multiple resolutions; CPU monitored during progress.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/services/transcodingService.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/utils/cpuMonitor.js`

### CPU load testing

- **One line description**: Load scripts drive sustained CPU via a dedicated endpoint and/or multiple transcode jobs.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`
  - `video-api/scripts/test-cpu.js`
  - `video-api/scripts/cpu-load.sh`

## Additional criteria

### Extended API features

- **One line description**: Library endpoint supports paging (page, limit) to list transcoded videos.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`

### External API(s)

- **One line description**: AssemblyAI for transcription and summarization; audio extracted via FFmpeg and uploaded, then polled until complete.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/services/external/assemblyAIService.js`
  - `video-api/src/routes/transcoding.js`

### Custom processing

- **One line description**: Audio extraction pipeline with format fallbacks (MP3 → M4A → WAV) prior to transcription.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/src/services/external/assemblyAIService.js`

### Infrastructure as code

- **One line description**: Containerized Node.js + FFmpeg with Docker; orchestrated via Docker Compose (includes optional k6 load service).
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `video-api/Dockerfile`
  - `video-api/docker-compose.yml`

### Web client

- **One line description**: ReactJS client with login (JWT), video upload to start transcoding, and paginated library of transcoded videos.
- **Video timestamp:** mm:ss
- **Relevant files:**
  - `web/src/pages/Login.jsx`
  - `web/src/pages/Videos.jsx`
  - `web/src/routes/ProtectedRoute.jsx`
  - `web/src/services/api.js`
