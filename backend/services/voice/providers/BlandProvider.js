const BaseVoiceProvider = require('../BaseVoiceProvider');
const axios = require('axios');

class BlandProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    super(apiKey, agentId, config);
    this.baseUrl = 'https://api.bland.ai/v1';
    this.headers = {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json'
    };
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
      'cancelled': 'CANCELLED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    // E.164 is already guaranteed by VoiceOrchestrator — validate here as sanity check
    if (!toPhone || !toPhone.startsWith('+')) {
      throw new Error(`[BlandProvider] Invalid toPhone: "${toPhone}" — must be E.164 format starting with +`);
    }

    // from number: prefer explicit argument, then encryptedVoiceId config, then undefined
    const fromNumber = fromPhone || this.config.voiceId || undefined;

    const payload = {
      phone_number: toPhone,
      ...(fromNumber ? { from: fromNumber } : {}),
      // pathway_id only if agentId is a non-empty UUID
      ...(this.agentId && this.agentId.trim() ? { pathway_id: this.agentId.trim() } : {}),
      voice: this.config.voiceId && !/^[0-9a-fA-F-]{36}$/.test(this.config.voiceId)
        ? this.config.voiceId   // use voiceId as voice name only if NOT a UUID (UUIDs are phone numbers)
        : 'maya',
      language: this.config.language || 'en-US',
      record: true,
      // Bland uses 'task' as the system prompt / persona
      task: context.summary
        ? `You are a helpful AI sales assistant. Context from WhatsApp chat: ${context.summary}. Customer name: ${context.name || 'Customer'}.`
        : `You are a helpful AI assistant. Please assist the customer professionally.`,
      transfer_list: {},
      metadata: {
        customer_name: context.name || 'Customer',
        intent: context.intent || 'general',
        email: context.email || '',
        source: context.source || 'ai-brain'
      },
      request_data: {
        chat_summary: context.summary || '',
        products: context.products || [],
        payment_links: context.paymentLinks || []
      },
      wait_for_greeting: true,
      first_sentence: context.name
        ? `Hi ${context.name}! I'm calling from the team regarding your recent inquiry. How can I help you today?`
        : `Hi there! I'm calling from the team regarding your recent inquiry. How can I help you today?`
    };

    try {
      const { data } = await axios.post(`${this.baseUrl}/calls`, payload, { headers: this.headers, timeout: 15000 });
      return {
        externalCallId: data.call_id,
        status: this.normalizeStatus(data.status || 'queued'),
        recordingUrl: null
      };
    } catch (err) {
      const detail = err.response?.data?.message || err.response?.data?.error || err.response?.data || err.message;
      throw new Error(`[BlandProvider] API Error: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
    }
  }


  async endCall(externalCallId) {
    const { data } = await axios.post(
      `${this.baseUrl}/calls/${externalCallId}/stop`,
      {},
      { headers: this.headers }
    );
    return { success: true, data };
  }

  async getCallStatus(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/calls/${externalCallId}`, { headers: this.headers });
    return this.normalizeStatus(data.status);
  }

  async getTranscript(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/calls/${externalCallId}`, { headers: this.headers });
    const transcripts = data.transcripts || data.transcript || [];
    return transcripts.map(t => ({
      speaker: t.user === 'assistant' ? 'AI' : 'CUSTOMER',
      message: t.text,
      timestamp: t.created_at || new Date().toISOString()
    }));
  }

  async getRecordingUrl(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/calls/${externalCallId}`, { headers: this.headers });
    return data.recording_url || null;
  }

  async testConnection() {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/me`, { headers: this.headers, timeout: 5000 });
      return { success: true, latencyMs: Date.now() - start, provider: 'bland' };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err.response?.data?.message || err.message, provider: 'bland' };
    }
  }

  async syncAgents() {
    return [{ id: 'bland-default', name: 'Bland Default Agent', language: 'en' }];
  }
}

module.exports = BlandProvider;
