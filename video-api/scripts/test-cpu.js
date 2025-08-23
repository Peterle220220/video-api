import http from 'k6/http';
import { sleep } from 'k6';

// K6 options: control concurrency and total test duration
export const options = {
  vus: Number(__ENV.VUS || 25),
  duration: String(__ENV.TEST_DURATION || '5m'),
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const CPU_TEST_SECONDS = Number(__ENV.CPU_TEST_SECONDS || 300); // per request CPU time on server
const SLEEP_BETWEEN = Number(__ENV.SLEEP_BETWEEN || 1); // seconds between requests per VU

if (!AUTH_TOKEN) {
  // Throwing at module init will fail fast with a clear message
  throw new Error('AUTH_TOKEN is required. Pass with -e AUTH_TOKEN=... or set in compose.');
}

export default function () {
  const url = `${API_BASE}/api/transcoding/test-cpu`;
  const payload = JSON.stringify({ duration: CPU_TEST_SECONDS });
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    timeout: '120s',
  };

  // Each VU triggers CPU-heavy work on the server; endpoint returns immediately
  http.post(url, payload, params);

  // Keep a short rest to avoid overwhelming logs; network load stays minimal
  sleep(SLEEP_BETWEEN);
}


