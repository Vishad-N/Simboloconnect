const BaseVoiceProvider = require('../BaseVoiceProvider');
const axios = require('axios');

class ElevenLabsProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    super(apiKey, agentId, config);
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.headers = {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  normalizeStatus(status) {
    const map = {
      'queued': 'INITIATED',
      'ringing': 'INITIATED',
      'in_progress': 'IN_PROGRESS',
      'speaking': 'IN_PROGRESS',
      'listening': 'IN_PROGRESS',
      'done': 'COMPLETED',
      'completed': 'COMPLETED',
      'failed': 'FAILED',
      'error': 'FAILED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    if (!toPhone || !toPhone.startsWith('+')) {
      throw new Error(`[ElevenLabsProvider] Invalid toPhone: "${toPhone}" — must be E.164 format starting with +`);
    }

    if (!this.agentId) {
      throw new Error(`[ElevenLabsProvider] agentId is required to place outbound conversational AI calls`);
    }

    // Call ElevenLabs Outbound Conversational Agent API
    // Endpoint: POST /v1/convai/agents/{agent_id}/initiate-call
    const payload = {
      phone_number: toPhone,
      dynamic_variables: {
        customer_name: context.name || 'Customer',
        chat_summary: context.summary || '',
        intent: context.intent || 'general',
        email: context.email || ''
      }
    };

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/convai/agents/${this.agentId}/initiate-call`,
        payload,
        { headers: this.headers, timeout: 15000 }
      );

      return {
        externalCallId: data.call_id,
        status: this.normalizeStatus(data.status || 'queued'),
        recordingUrl: null
      };
    } catch (err) {
      const detail = err.response?.data?.message || err.response?.data?.error || err.response?.data || err.message;
      throw new Error(`[ElevenLabsProvider] API Error: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
    }
  }

  async endCall(externalCallId) {
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/convai/calls/${externalCallId}/stop`,
        {},
        { headers: this.headers }
      );
      return { success: true, data };
    } catch (err) {
      console.warn(`[ElevenLabsProvider] Failed to stop call via API: ${err.message}`);
      return { success: true, message: 'Skipped stopping active call session.' };
    }
  }

  async getCallStatus(externalCallId) {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/convai/calls/${externalCallId}`,
        { headers: this.headers }
      );
      return this.normalizeStatus(data.status);
    } catch (err) {
      console.error(`[ElevenLabsProvider] Failed to get call status:`, err.message);
      return 'UNKNOWN';
    }
  }

  async getTranscript(externalCallId) {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/convai/calls/${externalCallId}`,
        { headers: this.headers }
      );
      const transcript = data.transcript || [];
      return transcript.map(t => ({
        speaker: t.role === 'agent' ? 'AI' : 'CUSTOMER',
        message: t.message || t.text || '',
        timestamp: t.time || new Date().toISOString()
      }));
    } catch (err) {
      console.error(`[ElevenLabsProvider] Failed to get transcript:`, err.message);
      return [];
    }
  }

  async getRecordingUrl(externalCallId) {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/convai/calls/${externalCallId}`,
        { headers: this.headers }
      );
      return data.recording_url || null;
    } catch (err) {
      console.error(`[ElevenLabsProvider] Failed to get recording URL:`, err.message);
      return null;
    }
  }

  async testConnection() {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/convai/agents`, { headers: this.headers, timeout: 5000 });
      return { success: true, latencyMs: Date.now() - start, provider: 'elevenlabs' };
    } catch (err) {
      const detail = err.response?.data?.message || err.response?.data?.error || err.message;
      return { success: false, latencyMs: Date.now() - start, message: detail, provider: 'elevenlabs' };
    }
  }

  async syncAgents() {
    try {
      const { data } = await axios.get(`${this.baseUrl}/convai/agents`, { headers: this.headers });
      return (data.agents || []).map(agent => ({
        id: agent.agent_id,
        name: agent.name || `ElevenLabs Agent ${agent.agent_id}`
      }));
    } catch (err) {
      return [{ id: 'elevenlabs-default', name: 'ElevenLabs Default Agent', language: 'en' }];
    }
  }
}

module.exports = ElevenLabsProvider;
