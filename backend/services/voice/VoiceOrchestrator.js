const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VoiceRoutingEngine = require('./VoiceRoutingEngine');
const VoiceProviderHealthMonitor = require('./VoiceProviderHealthMonitor');
const WorkingHoursService = require('./WorkingHoursService');

class VoiceOrchestrator {
  /**
   * The main entry point to initiate an AI voice call.
   * @param {string} userId - Tenant ID
   * @param {string} contactId - CRM Contact ID
   * @param {string} toPhone - Destination phone number (E.164 or raw; we normalize below)
   * @param {object} context - Previous chat memory, intent, products
   */
  static async initiateCall(userId, contactId, toPhone, context) {
    const startTime = Date.now();
    let providerSlug = 'unknown';

    // ── Normalize toPhone to E.164 (always ensure leading +) ──────────────
    let formattedPhone = (toPhone || '').trim();
    if (formattedPhone && !formattedPhone.startsWith('+')) {
      const digitsOnly = formattedPhone.replace(/\D/g, '');
      if (digitsOnly) {
        formattedPhone = '+' + digitsOnly;
      }
    }

    if (!formattedPhone || formattedPhone === '+') {
      throw new Error(`[VoiceOrchestrator] Cannot initiate call — invalid phone number: "${toPhone}"`);
    }

    console.log(`[VoiceOrchestrator] Initiating outbound call to ${formattedPhone} for workspace ${userId}`);

    try {
      // 1. Check working hours (non-blocking — just flags afterHoursTakeover)
      const insideHours = await WorkingHoursService.isWithinWorkingHours(userId);
      if (!insideHours) {
        console.log(`[VoiceOrchestrator] Outside working hours for user ${userId} — call will still proceed, flagged for handoff.`);
        context.afterHoursTakeover = true;
      }

      // 2. Get all ranked providers (handles round-robin and priority sorting)
      const rankedProviders = await VoiceRoutingEngine.getRankedProviders(userId);

      if (!rankedProviders || rankedProviders.length === 0) {
        throw new Error(`[VoiceOrchestrator] No active voice providers configured for workspace ${userId}. Please enable at least one provider in AI Voice Settings.`);
      }

      let lastError = null;
      let session = null;

      for (let i = 0; i < rankedProviders.length; i++) {
        const current = rankedProviders[i];
        providerSlug = current.providerSlug;
        const { adapter } = current;

        console.log(`[VoiceOrchestrator] Attempting call to ${formattedPhone} via ${providerSlug} (attempt ${i + 1}/${rankedProviders.length})`);

        try {
          // 3. Initiate API Call — fromPhone is null so adapter uses its configured voiceId
          const response = await adapter.initiateCall(formattedPhone, null, context);

          console.log(`[VoiceOrchestrator] ✅ Call initiated via ${providerSlug}: callId=${response.externalCallId}, status=${response.status}`);

          // 4. Log Session to DB
          session = await prisma.voiceCallSession.create({
            data: {
              userId,
              contactId,
              provider: providerSlug,
              externalCallId: response.externalCallId,
              direction: 'OUTBOUND',
              status: response.status || 'INITIATED',
              metadata: {
                ...context,
                toPhone: formattedPhone,
                initiatedAt: new Date().toISOString()
              }
            }
          });

          // 5. Log success + latency to health monitor
          await VoiceProviderHealthMonitor.logSuccess(providerSlug, Date.now() - startTime);

          // 6. Increment Round-Robin Counter so next call alternates providers
          try {
            const redis = require('../redisConnection');
            const rrKey = `voice_provider_round_robin:${userId}`;
            await redis.incr(rrKey);
          } catch (rrErr) {
            // Non-fatal
          }

          break; // Success — exit retry loop
        } catch (err) {
          // Log the FULL error — including response body from the provider API
          const errBody = err.response?.data
            ? (typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data)
            : null;
          console.error(
            `[VoiceOrchestrator] ❌ Provider ${providerSlug} failed:`,
            err.message,
            errBody ? `| Response: ${errBody}` : ''
          );
          lastError = err;
          await VoiceProviderHealthMonitor.logFailure(providerSlug);

          if (i < rankedProviders.length - 1) {
            console.log(`[VoiceOrchestrator] Falling back to next provider...`);
          }
        }
      }

      if (!session) {
        const providers = rankedProviders.map(p => p.providerSlug).join(', ');
        throw new Error(
          lastError
            ? `All providers failed. Last error (${providerSlug}): ${lastError.message}`
            : `All configured voice providers [${providers}] failed to initiate the call.`
        );
      }

      return session;
    } catch (error) {
      console.error(`[VoiceOrchestrator] ❌ Outbound call routing fully failed for ${formattedPhone}:`, error.message);
      throw error;
    }
  }
}

module.exports = VoiceOrchestrator;


