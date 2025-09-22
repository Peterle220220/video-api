# Assignment 2 - Cloud Services Exercises - Response to Criteria

## Instructions

- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections. If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed

## Overview

- **Name:** YourName GoesHere
- **Student number:** n12122882
- **Application name:** Video Transcoding API
- **Two line description:** RESTful API for video uploads using S3 pre-signed URLs and multi-resolution transcoding with FFmpeg; persistent state stored in S3 + DynamoDB; authentication via Amazon Cognito (supports TOTP MFA); runtime configuration via SSM Parameter Store; AssemblyAI key stored in Secrets Manager.
- **EC2 instance name or ID:**

---

### Core - First data persistence service

- **AWS service name:** Amazon S3
- **What data is being stored?:** Uploaded source video files, transcoded .mp4 variants by resolution, extracted audio files (mp3/m4a/wav), and JSON metadata at `meta/<videoId>.json`.
- **Why is this service suited to this data?:** Durable object storage with cost-effective handling of large files, built-in pre-signed URLs for direct upload/download, and easy scalability.
- **Why is are the other services used not suitable for this data?:** DynamoDB is not suitable for large blobs; the local filesystem would make the system stateful and non-durable when scaling or restarting.
- **Bucket/instance/table name:** cab432-a2-n12122882
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/routes/storage.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/services/transcodingService.js`

### Core - Second data persistence service

- **AWS service name:** Amazon DynamoDB
- **What data is being stored?:** Video metadata (title, description, owner) and transcoding jobs (per-resolution progress, status, start/end timestamps).
- **Why is this service suited to this data?:** Serverless NoSQL with low latency and pay-per-request pricing; the single-table design is convenient for user-scoped queries and job records.
- **Why is are the other services used not suitable for this data?:** S3 does not support flexible querying; RDS requires heavier operations/management; the local filesystem is not durable.
- **Bucket/instance/table name:** cab432-a2-n12122882-metadata
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/services/db/dynamoService.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/routes/videos.js`

### S3 Pre-signed URLs

- **S3 Bucket names:** cab432-a2-n12122882
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/services/storage/s3Service.js`
  - `video-api/src/routes/storage.js`
  - `video-api/src/routes/transcoding.js`

### In-memory cache

- **ElastiCache instance name:** video-api-n12122882 (endpoint: `video-api-n12122882.km2jzi.0001.apse2.cache.amazonaws.com:11211`)
- **What data is being cached?:** S3 HEAD/JSON results (object metadata) and DynamoDB job/status query results.
- **Why is this data likely to be accessed frequently?:** The UI/clients frequently poll job progress, list the video library, and read metadata, resulting in repeated access within short intervals.
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/services/cache/memcached.js`
  - `video-api/src/services/storage/s3Service.js`
  - `video-api/src/services/db/dynamoService.js`

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary files in `/tmp` during transcode/upload, in-memory queues and in-flight job state, and in-memory CPU usage history.
- **Why is this data not considered persistent state?:** These are temporary/derivative data that can be recreated from S3 and DynamoDB metadata; they are discarded when the container stops.
- **How does your application ensure data consistency if the app suddenly stops?:** On startup, the system marks any in-flight jobs as `failed` to avoid stuck states; transcoding can be re-initiated from S3 inputs and stored metadata.
- **Relevant files:**
  - `video-api/src/services/db/dynamoService.js` (failInFlightJobsOnStartup)
  - `video-api/src/services/transcodingService.js`
  - `video-api/src/utils/cpuMonitor.js`
  - `video-api/src/server.js`

### Core - Authentication with Cognito

- **User pool name:** video-api-a2-n12122882
- **How are authentication tokens handled by the client?:** JWTs are stored in `localStorage` (key `token`) and automatically attached to the `Authorization: Bearer <token>` header for every request.
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/cognito.tf`
  - `video-api/src/services/external/cognitoService.js`
  - `video-api/src/middleware/auth.js`
  - `video-api/src/routes/auth.js`
  - `web/src/services/api.js`
  - `web/src/routes/ProtectedRoute.jsx`

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password + TOTP (Authenticator app). The code also supports SMS_MFA if enabled in the pool.
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/cognito.tf`
  - `video-api/src/services/external/cognitoService.js`
  - `video-api/src/routes/auth.js`

### Cognito groups

- **How are groups used to set permissions?:** The `Admin` group can delete transcoded videos; middleware reads `cognito:groups` from the JWT to check.
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/cognito.tf` (group Admin)
  - `video-api/src/middleware/auth.js`
  - `video-api/src/routes/transcoding.js` (DELETE `/api/transcoding/videos/:videoId`)

### Core - DNS with Route53

- **Subdomain**:
- **Video timestamp:**

### Parameter store

- **Parameter names:** `/n12122882/video_api/aai_base`, `/n12122882/video_api/ffmpeg_config`
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/ssm.tf`
  - `video-api/src/server.js`

### Secrets manager

- **Secrets names:** `cab432-a2-n12122882/ASSEMBLYAI_API_KEY`
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/services/external/assemblyAIService.js`

### Infrastructure as code

- **Technology used:** Terraform
- **Services deployed:** S3 bucket, DynamoDB table (single-table), Cognito User Pool + App Client + Group, SSM Parameter Store (configuration parameters).
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/providers.tf`
  - `video-api/infra/terraform/versions.tf`
  - `video-api/infra/terraform/s3.tf`
  - `video-api/infra/terraform/dynamodb.tf`
  - `video-api/infra/terraform/cognito.tf`
  - `video-api/infra/terraform/ssm.tf`
  - `video-api/infra/terraform/README.md`
