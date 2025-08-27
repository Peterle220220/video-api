#!/usr/bin/env node
"use strict";

// CPU load client: auto-login and upload sample.mp4 repeatedly to drive >80% CPU for ~5 minutes
// Safe for small EC2 instances: adaptive throttling based on server metrics, job limits,
// exponential backoff on errors, and optional cleanup to avoid disk exhaustion.
// Usage examples:
//   node scripts/load-encode.js                      # defaults
//   MINUTES=5 VUS=4 node scripts/load-encode.js     # override by env
//   node scripts/load-encode.js --minutes 5 --vus 6  # override by args

const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const FormData = require("form-data");

function joinUrl(base, p) {
  const a = String(base || "").replace(/\/+$/, "");
  const b = String(p || "").replace(/^\/+/, "");
  return `${a}/${b}`;
}

function getVal(name, def) {
  // 1) CLI arg has highest priority
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  // 2) Environment vars: support LOAD_* prefix to avoid collision with system vars
  const upper = name.toUpperCase();
  const fromEnv = process.env[`LOAD_${upper}`] ?? process.env[upper];
  if (fromEnv !== undefined && String(fromEnv) !== "") return fromEnv;
  // 3) Default
  return def;
}

async function login(apiBase, username, password) {
  const url = joinUrl(apiBase, "/api/auth/login");
  const res = await axios.post(url, { username, password }, { timeout: 15000 });
  const token = res?.data?.token;
  if (!token) throw new Error("Login failed: no token in response");
  return token;
}

async function startTranscode(apiBase, token, filePath, title, resolutionsJson) {
  const form = new FormData();
  form.append("video", fs.createReadStream(filePath));
  form.append("title", title);
  if (resolutionsJson) form.append("resolutions", resolutionsJson);

  const url = joinUrl(apiBase, "/api/transcoding/start");
  const res = await axios.post(url, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
  });
  return res?.data;
}

async function getMetrics(apiBase, token) {
  const url = joinUrl(apiBase, "/api/transcoding/metrics");
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
  const cpu = Number(res?.data?.cpu?.current ?? 0);
  const mem = Number(res?.data?.memory?.percentage ?? 0);
  return { cpu, mem };
}

async function getActiveJobs(apiBase, token) {
  const url = joinUrl(apiBase, "/api/transcoding/jobs");
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
  const count = Array.isArray(res?.data?.activeJobs) ? res.data.activeJobs.length : 0;
  return count;
}

async function runCPUTest(apiBase, token, durationSec) {
  const url = joinUrl(apiBase, "/api/transcoding/test-cpu");
  await axios.post(url, { duration: durationSec }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
}

async function cleanup(apiBase, token) {
  const url = joinUrl(apiBase, "/api/transcoding/cleanup");
  try {
    await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
  } catch (_) { /* best-effort */ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const apiBaseRaw = String(getVal("api-base", "http://localhost:3000"));
  const apiBase = apiBaseRaw.replace(/\/+$/, "");
  const username = String(getVal("user", "admin"));
  const password = String(getVal("pass", "admin123"));
  const minutes = Number(getVal("minutes", 5));
  const vus = Number(getVal("vus", 4));
  const sleepBetween = Number(getVal("sleep", 1000));
  const videoPath = String(getVal("video", path.resolve(__dirname, "../sample.mp4")));
  const heavy = String(getVal("heavy", "0")) === "1"; // default safer (720p/480p)

  // Adaptive throttling settings (override via env/args)
  const targetCPU = Number(getVal("target-cpu", 85)); // % aim to stay around this
  const hardCPU = Number(getVal("hard-cpu", 92)); // % stop new jobs above this
  const hardMem = Number(getVal("hard-mem", 90)); // % stop new jobs above this
  const maxJobs = Number(getVal("max-jobs", 2)); // limit in-flight jobs on server
  const cpuMode = String(getVal("cpu-mode", "0")) === "1"; // use /test-cpu instead of uploads
  const backoffBase = Number(getVal("backoff", 3000)); // base backoff when overloaded
  const cleanupAfter = String(getVal("cleanup", "1")) === "1"; // call /cleanup when finished

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const startAt = Date.now();
  const endAt = startAt + minutes * 60 * 1000;

  console.log(`[client] Logging in to ${apiBase} as ${username} ...`);
  const token = await login(apiBase, username, password);
  console.log(`[client] Got token, starting load: vus=${vus}, duration=${minutes}m, heavy=${heavy}`);

  let i = 0;
  const resolutions = heavy ? ["1920x1080", "1280x720", "854x480"] : ["1280x720", "854x480"];
  const resolutionsJson = JSON.stringify(resolutions);

  async function worker(workerId) {
    while (Date.now() < endAt) {
      const n = ++i;
      try {
        // Throttle based on server health
        try {
          const [metrics, jobs] = await Promise.all([
            getMetrics(apiBase, token).catch(() => ({ cpu: 0, mem: 0 })),
            getActiveJobs(apiBase, token).catch(() => 0)
          ]);

          if (metrics.cpu >= hardCPU || metrics.mem >= hardMem || jobs >= maxJobs) {
            const reason = metrics.cpu >= hardCPU ? `CPU ${metrics.cpu}%` : metrics.mem >= hardMem ? `MEM ${metrics.mem}%` : `jobs ${jobs}`;
            const wait = backoffBase * 2;
            console.warn(`[worker ${workerId}] overloaded (${reason}). Backing off ${wait}ms`);
            await sleep(wait);
            continue; // retry loop
          }
          // gentle pacing towards target CPU
          if (metrics.cpu > targetCPU) {
            const delta = Math.min(5000, Math.max(0, Math.round((metrics.cpu - targetCPU) * 50)));
            if (delta > 0) await sleep(delta);
          }
        } catch (_) { /* ignore throttle errors */ }

        if (cpuMode) {
          await runCPUTest(apiBase, token, Math.max(10, Math.min(60, Math.floor((endAt - Date.now()) / 1000))))
            .catch(() => { });
        } else {
          await startTranscode(apiBase, token, videoPath, `load-${workerId}-${n}`, resolutionsJson);
        }
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || String(err);
        console.error(`[worker ${workerId}] request failed: ${msg}`);
        // Exponential-ish backoff on errors
        const code = err?.response?.status || 0;
        const longBackoff = (code === 429 || code === 503 || code === 413) ? backoffBase * 3 : backoffBase;
        await sleep(longBackoff);
      }
      await sleep(sleepBetween);
    }
  }

  const workers = [];
  for (let w = 1; w <= vus; w++) workers.push(worker(w));
  await Promise.all(workers);
  console.log("[client] Done. Monitor CPU on server to verify >80% for 5 minutes.");

  if (cleanupAfter) {
    console.log("[client] Triggering server cleanup (best-effort) ...");
    await cleanup(apiBase, token);
  }
})();


