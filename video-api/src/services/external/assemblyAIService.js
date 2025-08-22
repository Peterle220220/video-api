const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const AAI_API_BASE = 'https://api.assemblyai.com/v2';
const AAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';

function assertApiKey() {
    if (!AAI_API_KEY) {
        throw new Error('ASSEMBLYAI_API_KEY is not set');
    }
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function extractAudioMp3(inputVideoPath, outputAudioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideoPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .audioBitrate('192k')
            .audioChannels(2)
            .audioFrequency(44100)
            .format('mp3')
            .on('end', () => resolve(outputAudioPath))
            .on('error', (err) => reject(err))
            .save(outputAudioPath);
    });
}

async function extractAudioM4a(inputVideoPath, outputAudioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideoPath)
            .noVideo()
            .audioCodec('aac')
            .audioBitrate('128k')
            .audioChannels(2)
            .audioFrequency(44100)
            .format('ipod') // m4a
            .on('end', () => resolve(outputAudioPath))
            .on('error', (err) => reject(err))
            .save(outputAudioPath);
    });
}

async function extractAudioWav(inputVideoPath, outputAudioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideoPath)
            .noVideo()
            .audioChannels(1)
            .audioFrequency(16000)
            .format('wav')
            .on('end', () => resolve(outputAudioPath))
            .on('error', (err) => reject(err))
            .save(outputAudioPath);
    });
}

async function extractBestAudio(inputVideoPath, folder) {
    // Try MP3 (preferred), then M4A, then WAV
    const mp3Path = path.join(folder, 'audio.mp3');
    try {
        await extractAudioMp3(inputVideoPath, mp3Path);
        return mp3Path;
    } catch (e1) {
        // Fallback to M4A
        const m4aPath = path.join(folder, 'audio.m4a');
        try {
            await extractAudioM4a(inputVideoPath, m4aPath);
            return m4aPath;
        } catch (e2) {
            // Fallback to WAV
            const wavPath = path.join(folder, 'audio.wav');
            await extractAudioWav(inputVideoPath, wavPath);
            return wavPath;
        }
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uploadToAssemblyAI(filePath) {
    assertApiKey();
    const size = fsSync.statSync(filePath).size;
    const maxAttempts = 3;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const stream = fsSync.createReadStream(filePath);
            const res = await fetch(`${AAI_API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    Authorization: AAI_API_KEY,
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': String(size),
                    'Accept': 'application/json',
                    'User-Agent': 'video-api/1.0',
                },
                // Required by Node.js fetch when sending a streamed body
                duplex: 'half',
                body: stream,
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`AssemblyAI upload failed: ${res.status} ${text}`);
            }
            const data = await res.json();
            if (!data || !data.upload_url) throw new Error('AssemblyAI upload: missing upload_url');
            return data.upload_url;
        } catch (err) {
            lastErr = err;
            const delay = Math.min(1000 * attempt, 3000);
            await sleep(delay);
        }
    }
    throw lastErr || new Error('AssemblyAI upload failed: fetch failed');
}

async function requestTranscription(audioUrl) {
    assertApiKey();
    const payload = {
        audio_url: audioUrl,
        // Auto chapters cannot be enabled together with summarization; keep summarization by default
        // auto_chapters: true,
        auto_highlights: true,
        summarization: true,
        summary_model: 'informative',
        summary_type: 'paragraph',
        speaker_labels: false,
        punctuate: true,
        format_text: true,
        language_detection: true,
    };
    const res = await fetch(`${AAI_API_BASE}/transcript`, {
        method: 'POST',
        headers: {
            Authorization: AAI_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`AssemblyAI transcript request failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    if (!data || !data.id) throw new Error('AssemblyAI transcript: missing id');
    return data.id;
}

async function fetchTranscript(transcriptId) {
    assertApiKey();
    const res = await fetch(`${AAI_API_BASE}/transcript/${transcriptId}`, {
        method: 'GET',
        headers: { Authorization: AAI_API_KEY },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`AssemblyAI transcript fetch failed: ${res.status} ${text}`);
    }
    return await res.json();
}

async function pollTranscriptUntilComplete(transcriptId, options = {}) {
    const { intervalMs = 3000, timeoutMs = 10 * 60 * 1000 } = options;
    const start = Date.now();
    while (true) {
        const data = await fetchTranscript(transcriptId);
        const status = String(data.status || '').toLowerCase();
        if (status === 'completed') return data;
        if (status === 'error') throw new Error(data.error || 'AssemblyAI processing error');
        if (Date.now() - start > timeoutMs) throw new Error('AssemblyAI polling timed out');
        await new Promise(r => setTimeout(r, intervalMs));
    }
}

async function writeMetaFile(videoId, meta) {
    const processedRoot = process.env.PROCESSED_PATH || './processed';
    const folder = path.join(processedRoot, videoId);
    await ensureDir(folder);
    const metaPath = path.join(folder, 'meta.json');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    return metaPath;
}

async function processVideoForSummary(videoId, inputVideoPath) {
    try {
        const processedRoot = process.env.PROCESSED_PATH || './processed';
        const folder = path.join(processedRoot, videoId);
        await ensureDir(folder);
        // Extract audio (choose best available format)
        const audioPath = await extractBestAudio(inputVideoPath, folder);

        // Upload and request transcript + summary
        const uploadUrl = await uploadToAssemblyAI(audioPath);
        const transcriptId = await requestTranscription(uploadUrl);

        // Persist initial meta (pending)
        await writeMetaFile(videoId, {
            status: 'processing',
            transcriptId,
            uploadUrl,
            audioPath: `/processed/${videoId}/${path.basename(audioPath)}`,
            updatedAt: new Date().toISOString(),
        });

        // Poll until complete
        const result = await pollTranscriptUntilComplete(transcriptId);

        const meta = {
            status: 'completed',
            transcriptId,
            uploadUrl,
            summary: result.summary || null,
            chapters: result.chapters || [],
            highlights: result.auto_highlights_result || null,
            text: result.text || null,
            confidence: result.confidence || null,
            words: result.words ? undefined : undefined, // keep file small by default
            audioPath: `/processed/${videoId}/${path.basename(audioPath)}`,
            updatedAt: new Date().toISOString(),
        };
        await writeMetaFile(videoId, meta);
        return meta;
    } catch (err) {
        try {
            await writeMetaFile(videoId, {
                status: 'error',
                error: err?.message || String(err),
                updatedAt: new Date().toISOString(),
            });
        } catch (_) { }
        throw err;
    }
}

module.exports = {
    processVideoForSummary,
};


