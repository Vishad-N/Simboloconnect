const RetellProvider = require('./providers/RetellProvider');
const BlandProvider = require('./providers/BlandProvider');
const VapiProvider = require('./providers/VapiProvider');
const TwilioVoiceProvider = require('./providers/TwilioVoiceProvider');
const TelnyxVoiceProvider = require('./providers/TelnyxVoiceProvider');
const ElevenLabsProvider = require('./providers/ElevenLabsProvider');

class VoiceProviderFactory {
  /**
   * Returns an instance of the provider adapter based on the provider string.
   */
  static getProvider(providerName, apiKey, agentId, config = {}) {
    switch (providerName.toLowerCase()) {
      case 'retell':
        return new RetellProvider(apiKey, agentId, config);
      case 'bland':
        return new BlandProvider(apiKey, agentId, config);
      case 'vapi':
        return new VapiProvider(apiKey, agentId, config);
      case 'twilio':
        return new TwilioVoiceProvider(apiKey, agentId, config);
      case 'telnyx':
        return new TelnyxVoiceProvider(apiKey, agentId, config);
      case 'elevenlabs':
        return new ElevenLabsProvider(apiKey, agentId, config);
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }
}

module.exports = VoiceProviderFactory;
