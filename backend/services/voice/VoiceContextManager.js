const VoiceMemoryCompressor = require('./VoiceMemoryCompressor');

class VoiceContextManager {
  /**
   * Constructs the voice call context dynamically.
   */
  static buildContext(contact, chatHistory = [], extraData = {}) {
    const summary = VoiceMemoryCompressor.compressChatHistory(chatHistory);
    return {
      name: contact.name || 'Customer',
      email: contact.email || '',
      phone: contact.phone,
      summary: summary,
      intent: extraData.intent || 'general_inquiry',
      products: extraData.products || [],
      paymentLinks: extraData.paymentLinks || [],
      ...extraData
    };
  }
}

module.exports = VoiceContextManager;
