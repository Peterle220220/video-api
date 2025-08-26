#!/usr/bin/env node
"use strict";

// Simple CPU burner: saturate all CPU cores for a given duration (default 5 minutes)
// Usage:
//   node scripts/cpu-burn.js              # burn for 5 minutes
//   node scripts/cpu-burn.js --minutes 2  # burn for 2 minutes
//   MINUTES=3 node scripts/cpu-burn.js    # burn for 3 minutes

const os = require("os");
const { isMainThread, Worker, parentPort, workerData } = require("worker_threads");

if (!isMainThread) {
  const endTimestamp = Date.now() + Number(workerData?.ms || 0);
  let accumulator = 0;
  // Tight compute loop; purposefully heavy math to keep core busy
  while (Date.now() < endTimestamp) {
    for (let i = 0; i < 1_000_000; i++) {
      // The exact computation is irrelevant; it's only to keep the ALUs busy
      accumulator += Math.sqrt(i) * Math.sin(i);
    }
  }
  // Notify parent (optional) and exit
  try { parentPort?.postMessage(accumulator); } catch (_) {}
  process.exit(0);
}

function parseMinutesFromArgs(defaultMinutes) {
  const envMinutes = process.env.MINUTES;
  if (envMinutes && !Number.isNaN(Number(envMinutes))) {
    return Math.max(0.1, Number(envMinutes));
  }
  const idx = process.argv.indexOf("--minutes");
  if (idx > -1 && process.argv[idx + 1] && !Number.isNaN(Number(process.argv[idx + 1]))) {
    return Math.max(0.1, Number(process.argv[idx + 1]));
  }
  return defaultMinutes;
}

(async () => {
  const minutes = parseMinutesFromArgs(5);
  const durationMs = Math.floor(minutes * 60 * 1000);
  const numCores = Math.max(1, os.cpus().length);

  console.log(`Starting CPU burn: ${numCores} workers for ${minutes} minute(s) (~${durationMs} ms)`);

  const workers = [];
  let completed = 0;

  for (let i = 0; i < numCores; i++) {
    const w = new Worker(__filename, { workerData: { ms: durationMs } });
    w.on("message", () => {});
    w.on("exit", () => {
      completed += 1;
      if (completed === numCores) {
        console.log("CPU burn finished.");
      }
    });
    w.on("error", (err) => {
      console.error("Worker error:", err?.message || err);
    });
    workers.push(w);
  }

  // Safety timeout: ensure all workers stop even if their loop finished early/late
  setTimeout(() => {
    for (const w of workers) {
      try { w.terminate(); } catch (_) {}
    }
  }, durationMs + 1500);
})();


