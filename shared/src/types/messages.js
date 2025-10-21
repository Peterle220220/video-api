function buildTranscodeMessage({ videoId, ownerId, inputKey, variants = ['1280x720', '854x480'], outputFormat = 'mp4', 'qut-username': qutUsername }) {
    const message = {
        type: 'transcode',
        videoId,
        ownerId,
        inputKey,
        variants,
        outputFormat,
    };
    if (qutUsername) {
        message['qut-username'] = qutUsername;
    }
    return message;
}

function buildTranscribeMessage({ videoId, ownerId, inputKey, 'qut-username': qutUsername }) {
    const message = {
        type: 'transcribe',
        videoId,
        ownerId,
        inputKey,
    };
    if (qutUsername) {
        message['qut-username'] = qutUsername;
    }
    return message;
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


