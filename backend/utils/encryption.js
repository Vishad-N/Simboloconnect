const crypto = require('crypto');

// Generate a random 32-byte key if one is not provided in env.
// In production, ENCRYPTION_SECRET or ENCRYPTION_KEY should be a secure 32-character string.
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET || 'a_very_secure_secret_key_32bytes_';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes for AES-256
const getEncryptionKey = () => {
    return crypto.createHash('sha256').update(String(ENCRYPTION_SECRET)).digest('base64').substring(0, 32);
};

/**
 * Encrypts a plain text string using AES-256-CBC
 * @param {string} text - The plain text to encrypt
 * @returns {string} - The initialization vector and encrypted text, separated by a colon
 */
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getEncryptionKey()), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts an encrypted string using AES-256-CBC
 * @param {string} text - The initialization vector and encrypted text, separated by a colon
 * @returns {string} - The decrypted plain text
 */
function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) throw new Error('Invalid encryption format');
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(getEncryptionKey()), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
