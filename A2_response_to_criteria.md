# Assignment 2 - Cloud Services Exercises - Response to Criteria

## Instructions

- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections. If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed

## Overview

- **Name:** Nam Phong Le
- **Student number:** n12122882
- **Application name:** Video Transcoding API
- **Two line description:** RESTful API for video uploads using S3 pre-signed URLs and multi-resolution transcoding with FFmpeg, persistent state stored in S3 + DynamoDB, authentication via Amazon Cognito (supports TOTP MFA), runtime configuration via SSM Parameter Store, AssemblyAI key stored in Secrets Manager.
- **EC2 instance name or ID:**

---

### Core - First data persistence service

- **AWS service name:** Amazon S3
- **What data is being stored?:** Uploaded source video files, transcoded .mp4 variants by resolution, extracted audio files (mp3/m4a/wav), and JSON metadata at `meta/<videoId>.json`.
- **Why is this service suited to this data?:** Durable object storage with cost-effective handling of large files, built-in pre-signed URLs for direct upload/download, and easy scalability.
- **Why is are the other services used not suitable for this data?:** DynamoDB is not suitable for large blobs, the local filesystem would make the system stateful and non-durable when scaling or restarting.
- **Bucket/instance/table name:** cab432-a2-n12122882
- **Video timestamp:**
- **Relevant files:**
  - `video-api/src/routes/storage.js`
  - `video-api/src/routes/transcoding.js`
  - `video-api/src/services/transcodingService.js`

### Core - Second data persistence service

- **AWS service name:** Amazon DynamoDB
- **What data is being stored?:** Video metadata (title, description, transcripts) and transcoding jobs (per-resolution progress, status).
- **Why is this service suited to this data?:** Serverless NoSQL with low latency and pay-per-request pricing, the single-table design is convenient for user-scoped queries and job records.
- **Why is are the other services used not suitable for this data?:** S3 does not support flexible querying, RDS requires heavier operations/management, the local filesystem is not durable.
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

- **What data is stored within your application that is not stored in cloud data services?:**
  - Temporary files in the OS temp directory (e.g. `os.tmpdir()`/`/tmp`) during download-from-S3 and per-resolution FFmpeg outputs before upload to S3.
  - In-memory execution state for the transcoder: global task queue, concurrency counters, and active FFmpeg command handles used to cancel jobs.
  - In-memory CPU metrics history kept only for live monitoring/telemetry on the metrics endpoints.
  - No server-side sessions are stored: authentication is stateless via Cognito JWT verification on every request.

- **Why is this data not considered persistent state?:**
  - All above items are ephemeral/derivative and do not need to survive a restart. Final artifacts (videos, metadata) live in S3; job state and progress live in DynamoDB.
  - Temp files are deleted once uploaded to S3; if the container stops, they are discarded with the container filesystem.
  - The transcoding queue and active process handles are runtime-only control structures; they are reconstructed on boot.
  - The UI and clients never rely on local files: uploads/downloads use S3 presigned URLs; the API does not serve static assets from disk (static serving removed).

- **How does your application ensure data consistency if the app suddenly stops?:**
  - On startup, any jobs left in `processing`/`pending` are marked `failed` via a reconciliation routine so the system never leaves jobs stuck in-flight. Clients can safely re-trigger transcoding from the original S3 input.
  - Job progress and per-resolution status are written to DynamoDB continuously (throttled ~every 5%) while FFmpeg runs; after each resolution is uploaded to S3 it is marked `completed`. Therefore, partial progress is visible/durable even if the worker dies mid-run.
  - Inputs and outputs are addressed by deterministic S3 keys (e.g., `processed/<videoId>/<resolution>.mp4`), so recomputation is straightforward and idempotent.
  - Authentication is stateless: each request brings its own JWT which is verified against Cognito, so no session store or sticky routing is required.

- **Operational behaviors that keep state out of instances:**
  - Runtime configuration is fetched from SSM Parameter Store at boot (FFmpeg tunables, concurrency, monitoring intervals) instead of using local config files.
  - The API exposes a health endpoint and does not write persistent data to local disk; uploads/downloads flow directly between clients and S3 using presigned URLs.

- **Relevant files:**
  - `video-api/src/services/db/dynamoService.js`: `failInFlightJobsOnStartup`, `updateJob`, `getJob`, `listActiveJobs`.
  - `video-api/src/services/transcodingService.js`: in-memory `activeJobs`/`pendingTasks`/`runningTasks`, `enqueueTranscode`, `updateJobResolutionProgress`, `createJobRecord`.
  - `video-api/src/services/storage/s3Service.js`: `downloadToTempFile` (temp files), `uploadFileStream`, `buildProcessedKey`, `buildMetaKey`.
  - `video-api/src/utils/cpuMonitor.js`: in-memory `cpuUsageHistory` and interval-based sampler.
  - `video-api/src/middleware/auth.js`: stateless JWT verification (no DB session lookup).
  - `video-api/src/server.js`: loads runtime config from SSM and triggers startup reconciliation of in-flight jobs.

### Core - Authentication with Cognito

- **User pool name:** User pool - kwy8d6
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

- **What factors are used for authentication:** Password + TOTP (Authenticator app).
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/cognito.tf`
  - `video-api/src/services/external/cognitoService.js`
  - `video-api/src/routes/auth.js`

### Cognito groups

- **How are groups used to set permissions?:** The `Admin` group can delete transcoded videos, middleware reads `cognito:groups` from the JWT to check.
- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/cognito.tf` (group Admin)
  - `video-api/src/middleware/auth.js`
  - `video-api/src/routes/transcoding.js` (DELETE `/api/transcoding/videos/:videoId`)

### Core - DNS with Route53

- **Subdomain**: `n12122882.cab432.com:3000`,  `n12122882.cab432.com:3001`
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

- **Technology used:** Terraform (>= 1.5), AWS provider `~> 5.0`, region `ap-southeast-2`.
- **Purpose:** Express the application infrastructure as code for repeatability, version control, and safe teardown.

- **What I provisioned (IaC):**
  - **Amazon S3 – video storage**
    - Bucket: `cab432-a2-n12122882`.
    - Versioning enabled for data safety; full Public Access Block enabled.
    - CORS allows `GET, PUT, POST, HEAD`, `allowed_origins: *`, `expose_headers: ETag`, `max_age_seconds: 3000`.
    - Used for: source uploads, transcoded outputs, and JSON metadata.
  - **Amazon DynamoDB – metadata and jobs**
    - Table: `cab432-a2-n12122882-metadata`, single-table design.
    - Keys: `qut-username` (PK) and `sk` (SK). Billing: `PAY_PER_REQUEST`.
    - TTL disabled. `manage_ddb` variable allows skipping table creation when the table already exists.
  - **Amazon Cognito – authentication**
    - User Pool: `video-api-a2-n12122882`; App Client: `web-app-client` (with `client_secret`).
    - MFA configuration `OPTIONAL` with software TOTP enabled.
    - Enabled flows: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`.
    - Creates `Admin` group for RBAC; exposes `JWKS URI` via outputs for backend JWT verification.
  - **SSM Parameter Store – runtime configuration**
    - `/n12122882/video_api/aai_base` = `https://api.assemblyai.com`.
    - `/n12122882/video_api/ffmpeg_config` (JSON):
      - `ffmpeg`: `preset=medium`, `crf=23`, `fps=30`, `threads=0`
      - `transcoding`: `defaultResolutions=["1280x720","854x480"]`, `maxConcurrent=2`
      - `limits.maxFileSize="500MB"`, `monitoring.cpuMonitoringInterval=2000`

- **How I apply IaC (workflow):**
  - Initialize and apply: `terraform init`, `terraform validate`, `terraform plan -out tfplan`, `terraform apply -auto-approve tfplan`.
  - If resources already exist: use `terraform import` (S3/DynamoDB) or set `manage_ddb=false` in `local.tfvars` to skip table management.
  - After apply, export outputs for the app:
    - Export JSON: `terraform output -json > outputs.json`
    - On Windows: run `export-env.ps1` to generate `.env.iac` at the project root with `AWS_REGION`, `S3_BUCKET`, `DDB_TABLE`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_JWKS_URI`.

- **Why IaC here:**
  - Fast spin-up/tear-down; consistent configuration across machines.
  - Review/rollback changes via Git; reduces manual errors.

- **Video timestamp:**
- **Relevant files:**
  - `video-api/infra/terraform/providers.tf`
  - `video-api/infra/terraform/versions.tf`
  - `video-api/infra/terraform/s3.tf`
  - `video-api/infra/terraform/dynamodb.tf`
  - `video-api/infra/terraform/cognito.tf`
  - `video-api/infra/terraform/ssm.tf`
  - `video-api/infra/terraform/outputs.tf`
  - `video-api/infra/terraform/README.md`
  - `video-api/infra/terraform/export-env.ps1`
