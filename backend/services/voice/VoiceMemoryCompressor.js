class VoiceMemoryCompressor {
  /**
   * Compresses chat messages array into a single brief paragraph.
   */
  static compressChatHistory(messages = []) {
    if (!messages || messages.length === 0) {
      return 'No previous chat history.';
    }

    // Pick last 10 messages to avoid payload limits
    const recent = messages.slice(-10);
    const summaryLines = recent.map(msg => {
      const roleName = msg.role === 'user' ? 'Customer' : 'AI';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return `${roleName}: ${content.substring(0, 100)}`;
    });

    return `Recent Chat Thread Summary:\n${summaryLines.join('\n')}`;
  }
}

module.exports = VoiceMemoryCompressor;
