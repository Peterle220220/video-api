# Statelessness Readiness (Assessment 2)

This document explains how the `video-api` service now adheres to stateless design principles to enable horizontal scaling.

## What changed

- Persistent data is stored only in cloud services:
  - Video renditions and metadata: Amazon S3 (`processed/<videoId>/<resolution>.mp4`, `meta/<videoId>.json`).
  - Job and video records: Amazon DynamoDB (single-table design keyed by `qut-username`).
- Local filesystem usage removed for persistence:
  - Multipart upload via local disk (multer) has been removed from the API. Clients must upload to S3 via presigned URLs, then start transcoding by `s3Key`.
  - Transcoding outputs are written to OS temp and immediately uploaded to S3.
- Startup reconciliation (crash-safety):
  - On service startup, any jobs stuck in `processing`/`pending` are marked `failed` with an error message (`Service restarted`). This avoids zombie jobs and keeps observable state consistent.
- No persistent connections required:
  - No WebSocket/SSE. Clients poll REST endpoints for job status and system metrics. Loss of connections is tolerated by design.
- Load and tooling updated:
  - `scripts/cpu-load.sh` and `scripts/load-encode.js` now use presigned upload → S3 → `s3Key` flow.
  - `docker-compose.yml` no longer mounts local volumes for `uploads/` or `processed/`.

## Key files

- `src/routes/transcoding.js`: enforces `s3Key` input, returns presigned download URLs, lists active jobs.
- `src/services/transcodingService.js`: writes to temp, uploads to S3, stores progress in DynamoDB.
- `src/services/storage/s3Service.js`: presign, upload, list, head, and delete helpers.
- `src/services/db/dynamoService.js`: job CRUD, `listActiveJobs()`, and `failInFlightJobsOnStartup()`.
- `src/server.js`: on startup, marks in-flight jobs as failed and starts CPU monitor.
- `docker-compose.yml`: removes local bind mounts for persistence.
- `scripts/cpu-load.sh`, `scripts/load-encode.js`: presigned S3 upload flow.
- `README.md`: updated examples to use presigned S3 uploads and clarify statelessness.

## How this meets stateless criteria

- All persistent data resides in S3 and DynamoDB. Containers are ephemeral.
- The app tolerates loss of connections: there is no reliance on persistent WebSocket/SSE.
- If the app stops at any time, state in S3/DynamoDB remains consistent. On restart, in-flight jobs are marked `failed` for accurate, observable state.
- The only in-memory state (transcode queue and `activeJobs` map) is transient and used purely for local concurrency control. Loss is handled gracefully.

## Validation steps

1. Upload via presigned URL, then start a transcode by `s3Key`.
2. During transcode, restart the API container.
3. Call `GET /api/transcoding/status/:jobId` → job should be `failed` after restart.
4. Re-start the job; new outputs appear under the same `processed/<videoId>/` S3 prefix.
5. Library and metadata endpoints return presigned download URLs that work without local static hosting.

## Notes

- OS temporary directory is used for intermediate files. This is ephemeral and safe to lose between restarts.
- For production, move API keys (e.g., AssemblyAI) to environment variables or a secret manager.
