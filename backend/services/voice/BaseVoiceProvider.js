/**
 * BaseVoiceProvider — Abstract base class all providers must implement.
 * Enforces standard interface across Retell, Bland, Vapi, Twilio, Telnyx.
 */
class BaseVoiceProvider {
  constructor(apiKey, agentId, config = {}) {
    if (!apiKey) throw new Error(`[${this.constructor.name}] API key is required`);
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.config = config;
    this.providerName = this.constructor.name;
  }

  /**
   * Initiate an outbound AI voice call
   * @param {string} toPhone - E.164 format: +91XXXXXXXXXX
   * @param {string|null} fromPhone - Caller number (or null for provider default)
   * @param {object} context - CRM context { name, summary, intent, products, paymentLinks }
   * @returns {{ externalCallId, status, recordingUrl? }}
   */
  async initiateCall(toPhone, fromPhone, context) {
    throw new Error(`[${this.providerName}] initiateCall() not implemented`);
  }

  /**
   * End / hang up an active call
   * @param {string} externalCallId
   */
  async endCall(externalCallId) {
    throw new Error(`[${this.providerName}] endCall() not implemented`);
  }

  /**
   * Get current status of a call
   * @param {string} externalCallId
   * @returns {string} status string
   */
  async getCallStatus(externalCallId) {
    throw new Error(`[${this.providerName}] getCallStatus() not implemented`);
  }

  /**
   * Get call transcript (array of { speaker, message, timestamp })
   * @param {string} externalCallId
   */
  async getTranscript(externalCallId) {
    throw new Error(`[${this.providerName}] getTranscript() not implemented`);
  }

  /**
   * Get call recording URL
   * @param {string} externalCallId
   */
  async getRecordingUrl(externalCallId) {
    throw new Error(`[${this.providerName}] getRecordingUrl() not implemented`);
  }

  /**
   * Test if the API key is valid — should make a lightweight API call
   * @returns {{ success: boolean, latencyMs: number, message?: string }}
   */
  async testConnection() {
    throw new Error(`[${this.providerName}] testConnection() not implemented`);
  }

  /**
   * Sync available AI agents from the provider
   * @returns {Array<{ id: string, name: string, voice?: string, language?: string }>}
   */
  async syncAgents() {
    throw new Error(`[${this.providerName}] syncAgents() not implemented`);
  }

  /**
   * Normalize call status from provider format to platform format
   * Platform statuses: INITIATED | IN_PROGRESS | COMPLETED | FAILED | CANCELLED
   */
  normalizeStatus(providerStatus) {
    return providerStatus?.toUpperCase() || 'UNKNOWN';
  }
}

module.exports = BaseVoiceProvider;
