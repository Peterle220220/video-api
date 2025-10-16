function buildTranscodeMessage({ videoId, ownerId, inputKey, variants = ['1280x720', '854x480'], outputFormat = 'mp4' }) {
    return {
        type: 'transcode',
        videoId,
        ownerId,
        inputKey,
        variants,
        outputFormat,
    };
}

function buildTranscribeMessage({ videoId, ownerId, inputKey }) {
    return {
        type: 'transcribe',
        videoId,
        ownerId,
        inputKey,
    };
}

function parseMessageBody(msg) {
    try {
        const body = typeof msg === 'string' ? JSON.parse(msg) : JSON.parse(msg?.Body || '{}');
        return body || {};
    } catch (_) { return {}; }
}

module.exports = {
    buildTranscodeMessage,
    buildTranscribeMessage,
    parseMessageBody,
};


