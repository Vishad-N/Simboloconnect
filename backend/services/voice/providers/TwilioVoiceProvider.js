const BaseVoiceProvider = require('../BaseVoiceProvider');
const twilio = require('twilio');

class TwilioVoiceProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    // apiKey = AccountSID:AuthToken (colon-separated)
    super(apiKey, agentId, config);
    const [accountSid, authToken] = apiKey.split(':');
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = config.fromNumber || agentId; // agentId used as from number for Twilio
    this.twimlAppSid = config.twimlAppSid || null;
    this.statusCallbackUrl = config.statusCallbackUrl || null;
  }

  getClient() {
    return twilio(this.accountSid, this.authToken);
  }

  normalizeStatus(status) {
    const map = {
      'queued': 'INITIATED',
      'ringing': 'INITIATED',
      'in-progress': 'IN_PROGRESS',
      'completed': 'COMPLETED',
      'failed': 'FAILED',
      'busy': 'FAILED',
      'no-answer': 'FAILED',
      'canceled': 'CANCELLED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    if (!toPhone || !toPhone.startsWith('+')) {
      throw new Error(`[TwilioProvider] Invalid toPhone: "${toPhone}" — must be E.164 format starting with +`);
    }

    const client = this.getClient();
    // twimlUrl fallback: backend endpoint > env > hard error
    const backendUrl = process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:5005';
    const twimlUrl = this.config.twimlUrl || process.env.TWILIO_TWIML_URL
      || `${backendUrl}/api/voice/twiml`;

    const fromNumber = fromPhone || this.config.voiceId || this.fromNumber;
    if (!fromNumber) {
      throw new Error('[TwilioProvider] A from number (Caller ID / Twilio Phone Number) is required. Please set the Voice/Caller ID field in your provider configuration.');
    }

    try {
      const call = await client.calls.create({
        to: toPhone,
        from: fromNumber,
        url: `${twimlUrl}?customerName=${encodeURIComponent(context.name || '')}&intent=${encodeURIComponent(context.intent || '')}&summary=${encodeURIComponent((context.summary || '').substring(0, 200))}`,
        statusCallback: this.statusCallbackUrl || undefined,
        statusCallbackMethod: 'POST',
        record: true,
        machineDetection: 'DetectMessageEnd'
      });

      return {
        externalCallId: call.sid,
        status: this.normalizeStatus(call.status),
        recordingUrl: null // Available after call ends via webhook
      };
    } catch (err) {
      const detail = err.message || 'Unknown Twilio error';
      throw new Error(`[TwilioProvider] API Error: ${detail}`);
    }
  }


  async endCall(externalCallId) {
    const client = this.getClient();
    const call = await client.calls(externalCallId).update({ status: 'completed' });
    return { success: true, status: call.status };
  }

  async getCallStatus(externalCallId) {
    const client = this.getClient();
    const call = await client.calls(externalCallId).fetch();
    return this.normalizeStatus(call.status);
  }

  async getTranscript(externalCallId) {
    // Twilio transcripts come via webhook. Return empty for polling fallback.
    return [];
  }

  async getRecordingUrl(externalCallId) {
    const client = this.getClient();
    const recordings = await client.recordings.list({ callSid: externalCallId, limit: 1 });
    if (recordings.length > 0) {
      return `https://api.twilio.com${recordings[0].uri.replace('.json', '.mp3')}`;
    }
    return null;
  }

  async testConnection() {
    const start = Date.now();
    try {
      const client = this.getClient();
      await client.api.accounts(this.accountSid).fetch();
      return { success: true, latencyMs: Date.now() - start, provider: 'twilio' };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err.message, provider: 'twilio' };
    }
  }

  async syncAgents() {
    return [{ id: 'twilio-default', name: 'Twilio Default Agent', language: 'en' }];
  }
}

module.exports = TwilioVoiceProvider;
