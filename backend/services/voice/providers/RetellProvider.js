const BaseVoiceProvider = require('../BaseVoiceProvider');
const axios = require('axios');

class RetellProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    super(apiKey, agentId, config);
    this.baseUrl = 'https://api.retellai.com/v2';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  normalizeStatus(status) {
    const map = {
      'registered': 'INITIATED',
      'ongoing': 'IN_PROGRESS',
      'ended': 'COMPLETED',
      'error': 'FAILED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    const payload = {
      from_number: fromPhone || this.config.voiceId || undefined,
      to_number: toPhone,
      agent_id: this.agentId || undefined,
      override_agent_id: this.agentId || undefined,
      retell_llm_dynamic_variables: {
        customer_name: context.name || 'Valued Customer',
        chat_summary: context.summary || '',
        intent: context.intent || 'general',
        products: JSON.stringify(context.products || []),
        payment_links: JSON.stringify(context.paymentLinks || []),
        email: context.email || '',
      }
    };
    if (!payload.from_number) delete payload.from_number;
    if (!this.agentId) {
      delete payload.agent_id;
      delete payload.override_agent_id;
    }

    const { data } = await axios.post(`${this.baseUrl}/create-phone-call`, payload, { headers: this.headers });
    return {
      externalCallId: data.call_id,
      status: this.normalizeStatus(data.call_status),
      recordingUrl: data.recording_url || null
    };
  }

  async endCall(externalCallId) {
    const { data } = await axios.post(
      `${this.baseUrl}/end-call`,
      { call_id: externalCallId },
      { headers: this.headers }
    );
    return { success: true, data };
  }

  async getCallStatus(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/get-call/${externalCallId}`, { headers: this.headers });
    return this.normalizeStatus(data.call_status);
  }

  async getTranscript(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/get-call/${externalCallId}`, { headers: this.headers });
    if (!data.transcript) return [];
    return (data.transcript || []).map(t => ({
      speaker: t.role === 'agent' ? 'AI' : 'CUSTOMER',
      message: t.content,
      timestamp: t.words?.[0]?.start ? new Date(t.words[0].start * 1000).toISOString() : new Date().toISOString()
    }));
  }

  async getRecordingUrl(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/get-call/${externalCallId}`, { headers: this.headers });
    return data.recording_url || null;
  }

  async testConnection() {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/list-agents`, { headers: this.headers, timeout: 5000 });
      return { success: true, latencyMs: Date.now() - start, provider: 'retell' };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err.response?.data?.message || err.message, provider: 'retell' };
    }
  }

  async syncAgents() {
    try {
      const { data } = await axios.get(`${this.baseUrl}/list-agents`, { headers: this.headers });
      return (data || []).map(agent => ({
        id: agent.agent_id,
        name: agent.agent_name || `Agent ${agent.agent_id}`,
        voice: agent.voice_id || undefined,
        language: agent.language || undefined
      }));
    } catch (err) {
      throw new Error(`Failed to sync Retell agents: ${err.message}`);
    }
  }
}

module.exports = RetellProvider;
