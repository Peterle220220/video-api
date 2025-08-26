#!/usr/bin/env node
"use strict";

// CPU load client: auto-login and upload sample.mp4 repeatedly to drive >80% CPU for ~5 minutes
// Usage examples:
//   node scripts/load-encode.js                      # defaults
//   MINUTES=5 VUS=4 node scripts/load-encode.js     # override by env
//   node scripts/load-encode.js --minutes 5 --vus 6  # override by args

const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const FormData = require("form-data");

function getArg(name, def) {
  const env = process.env[name.toUpperCase()];
  if (env !== undefined && env !== "") return env;
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function login(apiBase, username, password) {
  const url = `${apiBase}/api/auth/login`;
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

  const url = `${apiBase}/api/transcoding/start`;
  const res = await axios.post(url, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
  });
  return res?.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const apiBase = String(getArg("api-base", process.env.API_BASE || "http://localhost:3000"));
  const username = String(getArg("user", process.env.USERNAME || "admin"));
  const password = String(getArg("pass", process.env.PASSWORD || "admin123"));
  const minutes = Number(getArg("minutes", process.env.MINUTES || 5));
  const vus = Number(getArg("vus", process.env.VUS || 4));
  const sleepBetween = Number(getArg("sleep", process.env.SLEEP_BETWEEN || 1000));
  const videoPath = String(getArg("video", process.env.VIDEO_PATH || path.resolve(__dirname, "../sample.mp4")));
  const heavy = String(getArg("heavy", process.env.HEAVY || "1")) === "1";

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const startAt = Date.now();
  const endAt = startAt + minutes * 60 * 1000;

  console.log(`[client] Logging in to ${apiBase} as ${username} ...`);
  const token = await login(apiBase, username, password);
  console.log(`[client] Got token, starting load: vus=${vus}, duration=${minutes}m, heavy=${heavy}`);

  let i = 0;
  const resolutions = heavy ? ["1920x1080","1280x720","854x480"] : ["1280x720","854x480"];
  const resolutionsJson = JSON.stringify(resolutions);

  async function worker(workerId) {
    while (Date.now() < endAt) {
      const n = ++i;
      try {
        await startTranscode(apiBase, token, videoPath, `load-${workerId}-${n}`, resolutionsJson);
      } catch (err) {
        const msg = err?.response?.data?.error || err?.message || String(err);
        console.error(`[worker ${workerId}] request failed: ${msg}`);
      }
      await sleep(sleepBetween);
    }
  }

  const workers = [];
  for (let w = 1; w <= vus; w++) workers.push(worker(w));
  await Promise.all(workers);
  console.log("[client] Done. Monitor CPU on server to verify >80% for 5 minutes.");
})();


