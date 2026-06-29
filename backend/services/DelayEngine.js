/**
 * PHASE 3: Randomized Human-Like Delay Engine
 *
 * Generates delays that mimic human sending patterns.
 * This prevents Meta's ML from detecting machine-speed campaigns.
 *
 * Strategy:
 * - Base delay grows with batch position (earlier messages = faster)
 * - Random jitter ±40% applied to every delay
 * - Burst protection: every 50 messages, add a longer "breathing pause"
 * - Night-time detection: optional future hook
 */

/**
 * Calculate delay in milliseconds for a campaign message.
 *
 * @param {number} batchIndex - 0-based position in the campaign send order
 * @param {object} options
 * @param {number} options.minDelayMs - Minimum delay (default: 300ms)
 * @param {number} options.maxDelayMs - Maximum delay cap (default: 3000ms)
 * @param {number} options.burstEvery - Add burst pause every N messages (default: 50)
 * @param {number} options.burstPauseMs - Extra pause during burst cooldown (default: 5000ms)
 * @returns {number} delay in milliseconds
 */
function calculateDelay(batchIndex, {
    minDelayMs = 300,
    maxDelayMs = 3000,
    burstEvery = 50,
    burstPauseMs = 5000,
} = {}) {
    // Base delay: ramps up slightly as batch grows, then plateaus
    const baseDelay = Math.min(300 + batchIndex * 20, maxDelayMs);

    // Jitter: ±40% randomization
    const jitter = baseDelay * (0.6 + Math.random() * 0.8);

    // Burst pause: every `burstEvery` messages, add a longer break
    const isBurstPoint = batchIndex > 0 && batchIndex % burstEvery === 0;
    const burstExtra = isBurstPoint ? burstPauseMs + Math.random() * 2000 : 0;

    const totalDelay = Math.round(jitter + burstExtra);

    return Math.max(minDelayMs, Math.min(totalDelay, maxDelayMs + burstExtra));
}

/**
 * Sleep for the calculated delay.
 * @param {number} batchIndex
 * @param {object} options - Same as calculateDelay options
 */
async function humanDelay(batchIndex, options = {}) {
    const ms = calculateDelay(batchIndex, options);
    await new Promise(r => setTimeout(r, ms));
    return ms; // Return actual delay used (for logging)
}

/**
 * Campaign pacing: calculate total estimated send time.
 * @param {number} contactCount
 * @returns {{ estimatedSeconds: number, messagesPerMinute: number }}
 */
function estimateCampaignDuration(contactCount) {
    let totalMs = 0;
    for (let i = 0; i < contactCount; i++) {
        totalMs += calculateDelay(i);
    }
    const estimatedSeconds = Math.round(totalMs / 1000);
    const messagesPerMinute = Math.round((contactCount / estimatedSeconds) * 60);
    return { estimatedSeconds, messagesPerMinute };
}

module.exports = { calculateDelay, humanDelay, estimateCampaignDuration };
