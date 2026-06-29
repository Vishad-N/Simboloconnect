const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.createHash('sha256')
  .update(process.env.VOICE_ENCRYPTION_KEY || 'voice_encryption_key_32_bytes_default')
  .digest();

class VoiceTenantIsolationGuard {
  /**
   * Encrypt sensitive data (API keys, tokens) using AES-256-GCM
   */
  static encrypt(plaintext) {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt AES-256-GCM encrypted data
   */
  static decrypt(ciphertext) {
    if (!ciphertext) return null;
    // Handle legacy unencrypted values (plain strings without ':' separator)
    if (!ciphertext.includes(':')) return ciphertext;
    try {
      const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[VoiceTenantIsolationGuard] Decryption failed:', err.message);
      return null;
    }
  }

  /**
   * Validate that a call session belongs to the requesting tenant
   */
  static async validateSessionOwnership(prisma, userId, sessionId) {
    const session = await prisma.voiceCallSession.findUnique({
      where: { id: sessionId }
    });
    if (!session || session.userId !== userId) {
      throw new Error(`[IsolationGuard] Security Violation: User ${userId} cannot access session ${sessionId}`);
    }
    return session;
  }

  /**
   * Validate that a user provider config belongs to the requesting user
   */
  static async validateProviderOwnership(prisma, userId, userProviderId) {
    const config = await prisma.userVoiceProvider.findUnique({
      where: { id: userProviderId }
    });
    if (!config || config.userId !== userId) {
      throw new Error(`[IsolationGuard] Security Violation: User ${userId} cannot access provider config ${userProviderId}`);
    }
    return config;
  }
}

module.exports = VoiceTenantIsolationGuard;
