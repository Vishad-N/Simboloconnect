const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * Converts a buffer of audio (e.g. webm) to ogg (opus) if necessary.
 * Meta WhatsApp API requires audio to be AAC, MP4, MPEG, AMR, or OGG (opus).
 * We convert all non-compliant audio (like webm) to OGG/opus.
 */
async function convertAudioBufferToOgg(buffer, mimeType) {
    // If it's already a format supported natively without issues, we could skip.
    // However, Chrome MediaRecorder creates audio/webm which Meta rejects.
    // We will convert webm to ogg opus.
    if (!mimeType || (!mimeType.includes('webm') && !mimeType.includes('wav'))) {
        return { buffer, mimeType }; // Return as is
    }

    return new Promise((resolve, reject) => {
        const tmpDir = os.tmpdir();
        const randId = crypto.randomBytes(16).toString('hex');
        const inputPath = path.join(tmpDir, `input_${randId}.webm`);
        const outputPath = path.join(tmpDir, `output_${randId}.ogg`);

        fs.writeFileSync(inputPath, buffer);

        // Convert to ogg with opus codec, compatible with WhatsApp
        // -c:a libopus: uses the opus codec
        // -b:a 32k: low bitrate good for voice notes
        const cmd = `ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -compression_level 10 "${outputPath}"`;

        exec(cmd, (error, stdout, stderr) => {
            // Clean up input file
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

            if (error) {
                console.error("FFmpeg conversion error:", stderr || error.message);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                // Fallback to original buffer if conversion fails
                resolve({ buffer, mimeType });
                return;
            }

            try {
                const outBuffer = fs.readFileSync(outputPath);
                fs.unlinkSync(outputPath);
                resolve({ buffer: outBuffer, mimeType: 'audio/ogg' });
            } catch (fsErr) {
                console.error("Error reading transcoded file:", fsErr.message);
                resolve({ buffer, mimeType }); // Fallback
            }
        });
    });
}

module.exports = {
    convertAudioBufferToOgg
};
