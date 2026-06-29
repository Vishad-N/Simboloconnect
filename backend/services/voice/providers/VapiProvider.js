const BaseVoiceProvider = require('../BaseVoiceProvider');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const VoiceTenantIsolationGuard = require('../VoiceTenantIsolationGuard');

class VapiProvider extends BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    super(apiKey, agentId, config);
    this.baseUrl = 'https://api.vapi.ai';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  normalizeStatus(status) {
    const map = {
      'queued': 'INITIATED',
      'ringing': 'INITIATED',
      'in-progress': 'IN_PROGRESS',
      'forwarding': 'IN_PROGRESS',
      'ended': 'COMPLETED',
      'unknown': 'FAILED'
    };
    return map[status] || 'UNKNOWN';
  }

  async initiateCall(toPhone, fromPhone, context) {
    if (!toPhone || !toPhone.startsWith('+')) {
      throw new Error(`[VapiProvider] Invalid toPhone: "${toPhone}" — must be E.164 format starting with +`);
    }

    const backendUrl = process.env.BACKEND_URL || process.env.PUBLIC_URL || 'http://localhost:5005';

    const payload = {
      assistant: this.agentId ? undefined : {
        model: { provider: 'openai', model: 'gpt-4o' },
        voice: { provider: 'playht', voiceId: 'jennifer' },
        firstMessage: `Hi ${context.name || 'there'}! I'm calling to help you.`,
        systemPrompt: `You are an AI sales assistant. Context: ${context.summary || ''}. Products discussed: ${JSON.stringify(context.products || [])}`,
        serverUrl: `${backendUrl}/api/webhooks/voice/vapi`
      },
      assistantId: this.agentId || undefined,
      assistantOverrides: this.agentId ? {
        serverUrl: `${backendUrl}/api/webhooks/voice/vapi`
      } : undefined,
      customer: {
        number: toPhone,
        name: context.name || 'Customer',
        extension: ''
      },
      metadata: {
        userId: context.userId || this.config.userId,
        contactId: context.contactId,
        sessionId: context.sessionId,
        intent: context.intent,
        email: context.email
      }
    };

    if (!this.agentId) {
      delete payload.assistantId;
      delete payload.assistantOverrides;
    } else {
      delete payload.assistant;
    }

    const callerId = (fromPhone || this.config.voiceId || '').trim();
    if (callerId) {
      const isPhoneNumber = /^\+\d+$/.test(callerId);
      const isUUID = /^[0-9a-fA-F-]{36}$/.test(callerId);

      if (isPhoneNumber) {
        let twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
        let twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';

        const workspaceId = context.userId || this.config.userId;
        if (workspaceId) {
          try {
            const twilioConfig = await prisma.userVoiceProvider.findFirst({
              where: {
                userId: workspaceId,
                provider: { slug: 'twilio' }
              }
            });
            if (twilioConfig && twilioConfig.encryptedApiKey) {
              const decryptedApiKey = VoiceTenantIsolationGuard.decrypt(twilioConfig.encryptedApiKey);
              if (decryptedApiKey && decryptedApiKey.includes(':')) {
                const [sid, token] = decryptedApiKey.split(':');
                twilioAccountSid = sid;
                twilioAuthToken = token;
              }
            }
          } catch (err) {
            console.error('[VapiProvider] Failed to fetch/decrypt Twilio credentials:', err.message);
          }
        }

        payload.phoneNumber = {
          twilioPhoneNumber: callerId,
          twilioAccountSid,
          twilioAuthToken
        };
      } else if (isUUID) {
        payload.phoneNumberId = callerId;
      } else {
        throw new Error('Invalid Caller ID or Phone Number ID. Must be an E.164 phone number (+...) or a Vapi Phone Number ID (UUID).');
      }
    }

    try {
      const { data } = await axios.post(`${this.baseUrl}/call/phone`, payload, { headers: this.headers, timeout: 15000 });
      return {
        externalCallId: data.id,
        status: this.normalizeStatus(data.status),
        recordingUrl: data.recordingUrl || null
      };
    } catch (err) {
      const detail = err.response?.data?.message
        || err.response?.data?.error
        || (err.response?.data ? JSON.stringify(err.response.data) : null)
        || err.message;
      throw new Error(`[VapiProvider] API Error (${err.response?.status || 'network'}): ${detail}`);
    }
  }

  async endCall(externalCallId) {
    const { data } = await axios.delete(`${this.baseUrl}/call/${externalCallId}`, { headers: this.headers });
    return { success: true, data };
  }

  async getCallStatus(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/call/${externalCallId}`, { headers: this.headers });
    return this.normalizeStatus(data.status);
  }

  async getTranscript(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/call/${externalCallId}`, { headers: this.headers });
    const messages = data.messages || [];
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        speaker: m.role === 'assistant' ? 'AI' : 'CUSTOMER',
        message: m.message || m.content,
        timestamp: m.time ? new Date(m.time * 1000).toISOString() : new Date().toISOString()
      }));
  }

  async getRecordingUrl(externalCallId) {
    const { data } = await axios.get(`${this.baseUrl}/call/${externalCallId}`, { headers: this.headers });
    return data.recordingUrl || null;
  }

  async testConnection() {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/assistant`, { headers: this.headers, timeout: 5000 });
      return { success: true, latencyMs: Date.now() - start, provider: 'vapi' };
    } catch (err) {
      return { success: false, latencyMs: Date.now() - start, message: err.response?.data?.message || err.message, provider: 'vapi' };
    }
  }

  async syncAgents() {
    try {
      const { data } = await axios.get(`${this.baseUrl}/assistant`, { headers: this.headers });
      return (data || []).map(agent => ({
        id: agent.id,
        name: agent.name || `Vapi Agent ${agent.id}`,
        voice: agent.voice?.voiceId || undefined,
        language: agent.voice?.provider || undefined
      }));
    } catch (err) {
      throw new Error(`Failed to sync Vapi agents: ${err.message}`);
    }
  }
}

module.exports = VapiProvider;
