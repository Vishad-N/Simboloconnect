const BaseVoiceProvider = require('../BaseVoiceProvider');
const axios = require('axios');

class TelnyxVoiceProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    super(apiKey, agentId, config);
    this.baseUrl = 'https://api.telnyx.com/v2';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    this.connectionId = agentId; // Telnyx uses connectionId as agentId
    this.fromNumber = config.fromNumber || null;
  }

  normalizeStatus(status) {
    const map = {
      'queued': 'INITIATED',
      'ringing': 'INITIATED',
      'answered': 'IN_PROGRESS',
      'active': 'IN_PROGRESS',
      'bridging': 'IN_PROGRESS',
      'bridged': 'IN_PROGRESS',
      'hangup': 'COMPLETED',
      'rejected': 'FAILED',
      'failed': 'FAILED',
      'invalid': 'FAILED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    if (!toPhone || !toPhone.startsWith('+')) {
      throw new Error(`[TelnyxProvider] Invalid toPhone: "${toPhone}" — must be E.164 format starting with +`);
    }

    if (!this.connectionId || !this.connectionId.trim()) {
      throw new Error('[TelnyxProvider] connection_id (Agent ID) is required but not configured. Please set your Telnyx Connection ID in the voice provider settings.');
    }

    const fromNumber = fromPhone || this.config.voiceId || this.fromNumber;
    if (!fromNumber) {
      throw new Error('[TelnyxProvider] A from number (Caller ID) is required for Telnyx outbound calls. Please set the Voice/Caller ID field in your provider configuration.');
    }

    const payload = {
      connection_id: this.connectionId.trim(),
      to: toPhone,
      from: fromNumber,
      record_channels: 'both',
      answering_machine_detection: 'detect',
      custom_headers: [
        { name: 'X-Customer-Name', value: context.name || '' },
        { name: 'X-Intent', value: context.intent || '' },
        { name: 'X-Source', value: context.source || 'ai-brain' }
      ]
    };

    try {
      const { data } = await axios.post(`${this.baseUrl}/calls`, payload, { headers: this.headers });
      return {
        externalCallId: data.data?.call_control_id || data.data?.call_leg_id,
        status: this.normalizeStatus(data.data?.state || 'queued'),
        recordingUrl: null
      };
    } catch (err) {
      const detail = err.response?.data?.errors?.[0]?.detail
        || err.response?.data?.errors?.[0]?.title
        || err.response?.data?.message
        || err.message;
      throw new Error(`[TelnyxProvider] API Error: ${detail}`);
    }
  }


  async endCall(externalCallId) {
    const { data } = await axios.post(
      `${this.baseUrl}/calls/${externalCallId}/actions/hangup`,
      { client_state: 'ended' },
      { headers: this.headers }
    );
    return { success: true, data };
  }

  async getCallStatus(externalCallId) {
    // Telnyx is event-driven — status comes via webhook
    // Return cached status from DB for polling
    return 'UNKNOWN';
  }

  async getTranscript(externalCallId) {
    // Telnyx transcripts come via webhook
    return [];
  }

  async getRecordingUrl(externalCallId) {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/calls/${externalCallId}/recordings`,
        { headers: this.headers }
      );
      return data.data?.[0]?.url || null;
    } catch {
      return null;
    }
  }

  async testConnection() {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/available_phone_numbers`, {
        headers: this.headers,
        timeout: 5000,
        params: { country_code: 'US', limit: 1 }
      });
      return { success: true, latencyMs: Date.now() - start, provider: 'telnyx' };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err.response?.data?.errors?.[0]?.detail || err.message, provider: 'telnyx' };
    }
  }

  async syncAgents() {
    return [{ id: 'telnyx-default', name: 'Telnyx Default Agent', language: 'en' }];
  }
}

module.exports = TelnyxVoiceProvider;
