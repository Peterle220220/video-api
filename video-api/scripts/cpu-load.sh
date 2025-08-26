#!/usr/bin/env bash

set -euo pipefail

# CPU load generator for t3.micro on AWS
# - Mode "cpu": trigger /api/transcoding/test-cpu with minimal network usage
# - Mode "transcode": trigger /api/transcoding/start with a local small video file
#
# Defaults are chosen to push >80% CPU for ~5 minutes with network headroom.

API_BASE="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"
MODE="cpu"                 # cpu | transcode
VUS=30                      # parallel workers (per mode semantics below)
MINUTES=5                   # test length
SLEEP_BETWEEN=1             # seconds between requests (cpu mode)
VIDEO_PATH="./sample.mp4"  # used in transcode mode
RESOLUTIONS='["1280x720","854x480"]'  # used in transcode mode
TOKEN=""
HEAVY=0                    # transcode heavy mode: push CPU harder and keep queueing jobs

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --api-base URL         API base URL (default: ${API_BASE})
  --user USERNAME        Login username (default: ${USERNAME})
  --pass PASSWORD        Login password (default: ${PASSWORD})
  --mode MODE            cpu | transcode (default: ${MODE})
  --vus N                Number of parallel workers (default: ${VUS})
  --minutes N            Test duration in minutes (default: ${MINUTES})
  --sleep S              Seconds between requests (default: ${SLEEP_BETWEEN})
  --video PATH           Video file path (transcode mode)
  --resolutions JSON     JSON array of resolutions (transcode mode)
  --token TOKEN          Pre-provided JWT token (skips login)
  --heavy                Transcode heavy load (adds 1080p and keeps queueing jobs)
  -h, --help             Show this help

Examples:
  # CPU mode (minimal network), 5 minutes, ~30 workers
  $(basename "$0") --mode cpu --vus 30 --minutes 5

  # Transcode mode with a small local file (requires ffmpeg threads>=2 to push >80%)
  $(basename "$0") --mode transcode --video ./tiny.mp4 --vus 3 --minutes 5

  # Force ~100% CPU for ~5 minutes using heavy transcode (keeps queueing)
  $(basename "$0") --mode transcode --heavy --minutes 5
EOF
}

log() { echo "[$(date +%H:%M:%S)] $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base) API_BASE="$2"; shift 2;;
    --user) USERNAME="$2"; shift 2;;
    --pass) PASSWORD="$2"; shift 2;;
    --mode) MODE="$2"; shift 2;;
    --vus) VUS="$2"; shift 2;;
    --minutes) MINUTES="$2"; shift 2;;
    --sleep) SLEEP_BETWEEN="$2"; shift 2;;
    --video) VIDEO_PATH="$2"; shift 2;;
    --resolutions) RESOLUTIONS="$2"; shift 2;;
    --token) TOKEN="$2"; shift 2;;
    --heavy) HEAVY=1; shift 1;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown option: $1"; usage; exit 1;;
  esac
done

# Validate numbers
if ! [[ "$VUS" =~ ^[0-9]+$ ]]; then echo "--vus must be integer"; exit 1; fi
if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then echo "--minutes must be integer"; exit 1; fi
if ! [[ "$SLEEP_BETWEEN" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then echo "--sleep must be number"; exit 1; fi

CPU_TEST_SECONDS=$(( MINUTES * 60 ))

# Autotune for transcode if user left defaults: try to choose a reasonable VUS
if [[ "$MODE" == "transcode" && "$VUS" -eq 30 ]]; then
  if command -v nproc >/dev/null 2>&1; then
    CORES=$(nproc)
  else
    CORES=2
  fi
  # Assume ffmpeg uses ~2 threads per job; target ~2x cores to keep pipeline full
  VUS=$(( CORES * 2 ))
  if [[ "$VUS" -lt 3 ]]; then VUS=3; fi
fi

get_token() {
  local url="${API_BASE}/api/auth/login"
  local body
  body=$(printf '{"username":"%s","password":"%s"}' "$USERNAME" "$PASSWORD")
  local resp
  resp=$(curl -s -X POST "$url" -H 'Content-Type: application/json' -d "$body") || true

  # Try jq first, fallback to sed
  if command -v jq >/dev/null 2>&1; then
    echo "$resp" | jq -r .token
  else
    echo "$resp" | sed -n 's/.*"token"\s*:\s*"\([^"]*\)".*/\1/p'
  fi
}

if [[ -z "$TOKEN" ]]; then
  log "Logging in to get JWT token..."
  TOKEN=$(get_token)
fi

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Failed to obtain token. Check credentials or API_BASE." >&2
  exit 1
fi

log "API_BASE=${API_BASE} MODE=${MODE} VUS=${VUS} MINUTES=${MINUTES}"

cpu_worker() {
  local i="$1"
  local payload
  payload=$(printf '{"duration":%d}' "$CPU_TEST_SECONDS")
  curl -s -X POST "${API_BASE}/api/transcoding/test-cpu" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$payload" >/dev/null || true
}

transcode_worker() {
  local i="$1"
  curl -s -X POST "${API_BASE}/api/transcoding/start" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "video=@${VIDEO_PATH}" \
    -F "title=load-$i" \
    -F "resolutions=${RESOLUTIONS}" >/dev/null || true
}

start_time=$(date +%s)
end_time=$(( start_time + CPU_TEST_SECONDS ))

case "$MODE" in
  cpu)
    log "Starting ${VUS} CPU workers for ${MINUTES} minutes (minimal network)."
    for i in $(seq 1 "$VUS"); do
      cpu_worker "$i" &
      sleep "$SLEEP_BETWEEN"
    done
    wait || true
    ;;
  transcode)
    if [[ ! -f "$VIDEO_PATH" ]]; then
      echo "Video file not found: $VIDEO_PATH" >&2
      exit 1
    fi
    # Heavy mode: bump resolutions if not already heavy
    if [[ "$HEAVY" -eq 1 ]]; then
      RESOLUTIONS='["1920x1080","1280x720","854x480"]'
      log "HEAVY mode enabled: using resolutions=${RESOLUTIONS} and continuous queuing for ${MINUTES} minutes."
    fi

    log "Starting ${VUS} transcode jobs; will keep queueing until ${MINUTES} minutes elapse."
    for i in $(seq 1 "$VUS"); do
      transcode_worker "$i" &
      sleep 1
    done
    log "Sustaining load for ~${MINUTES} minutes."
    # Actively queue additional jobs so CPU stays high for the entire window
    now=$(date +%s)
    i=$VUS
    while [[ "$now" -lt "$end_time" ]]; do
      if [[ "$HEAVY" -eq 1 ]]; then
        i=$(( i + 1 ))
        transcode_worker "$i" &
      fi
      sleep "$SLEEP_BETWEEN"
      now=$(date +%s)
    done
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

log "Done. You can monitor with: docker stats --no-stream"


