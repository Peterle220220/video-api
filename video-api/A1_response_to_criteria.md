# Assignment 1 - REST API Project - Response to Criteria

## Overview

- **Name:** Nam Phong Le
- **Student number:** n12122882
- **Application name:** Video Summary and Optimizer
- **Two line description:** This app uses FFmpeg to transcode uploaded videos into multiple resolutions and uses AssemblyAI to transcribe and summarize audio. Users can view and download each transcoded rendition and edit descriptions.

## Core criteria

### Containerise the app

- **ECR Repository name**: n12122882/video-api
- **Video timestamp:** 00:03 - 00:43
- **Relevant files:**
  - `video-api/Dockerfile`
  - `video-api/docker-compose.yml`

### Deploy the container

- **EC2 instance ID**: i-0e2d36a90b3969036
- **Video timestamp:** 00:46 - 00:50

### User login

- **One line description:** Hard‑coded username/password list with JWT-based sessions; admin can delete transcoded videos.
- **Video timestamp:** 02:17 - 02:33
- **Relevant files:**
  - `video-api/src/config/accounts.js`
  - `video-api/src/middleware/auth.js`
  - `video-api/src/routes/auth.js`
  - `video-api/src/routes/transcoding.js`

### REST API

- **One line description:** REST API with noun-based endpoints and HTTP methods (GET, POST, PUT, DELETE) and appropriate status codes.
- **Video timestamp:** 01:27 02:14
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
- **Video timestamp:** 03:25 - 03:40
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`
  - `video-api/uploads/`
  - `video-api/processed/`

#### Second kind

- **One line description:** File metadata, per-video transcript/summary, and in-memory job status
- **Type:** Structured (JSON files on disk + in-memory maps); no ACID
- **Rationale:** Simple queries; low likelihood of concurrent writes; durable enough for demo
- **Video timestamp:** 03:40 - 03:59
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/services/external/assemblyAIService.js`
  - `video-api/src/services/transcodingService.js`
  - `video-api/src/routes/videos.js`

### CPU intensive task

- **One line description**: Uses FFmpeg to transcode videos into multiple resolutions; CPU monitored during progress.
- **Video timestamp:** 04:16 - 04:36
- **Relevant files:**
  - `video-api/src/services/transcodingService.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/utils/cpuMonitor.js`

### CPU load testing

- **One line description**: Load scripts drive sustained CPU via a dedicated endpoint and/or multiple transcode jobs.
- **Video timestamp:** 04:39 - 05:44
- **Relevant files:**
  - `video-api/scripts/load-encode.js`

## Additional criteria

### Extended API features

- **One line description**: Library endpoint supports paging (page, limit) to list transcoded videos.
- **Video timestamp:** 02:32 - 02:40
- **Relevant files:**
  - `video-api/src/routes/transcoding.js`

### External API(s)

- **One line description**: AssemblyAI for transcription and summarization; audio extracted via FFmpeg and uploaded, then polled until complete.
- **Video timestamp:** 04:00 - 04:15
- **Relevant files:**
  - `video-api/src/services/external/assemblyAIService.js`
  - `video-api/src/routes/transcoding.js`

### Custom processing

- **One line description**: Audio extraction pipeline with format fallbacks (MP3 → M4A → WAV) prior to transcription.
- **Video timestamp:** 03:40 - 03:59
- **Relevant files:**
  - `video-api/src/services/external/assemblyAIService.js`

### Web client

- **One line description**: ReactJS client with login (JWT), video upload to start transcoding, and paginated library of transcoded videos.
- **Video timestamp:** 02:16 - 03:24
- **Relevant files:**
  - `web/src/pages/Login.jsx`
  - `web/src/pages/Videos.jsx`
  - `web/src/routes/ProtectedRoute.jsx`
  - `web/src/services/api.js`
