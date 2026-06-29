const VoiceQueueManager = require('./VoiceQueueManager');

class CallEscalationService {
  /**
   * Called by the AI Brain or Chatbot Router when high intent / urgency is detected
   * or when user explicitly asks for a call.
   */
  static async triggerCallEscalation(userId, contactPhone, contactId, chatSummary) {
    console.log(`[CallEscalation] Triggered for ${contactPhone}`);

    // Context format mapped for the AI Voice Agents
    const context = {
      phone: contactPhone,
      summary: chatSummary,
      intent: "Sales Escalation",
      escalated_at: new Date().toISOString()
    };

    // Enqueue the outbound call request
    const job = await VoiceQueueManager.enqueueCall(userId, contactId, contactPhone, context);

    return { success: true, message: 'Call escalation requested successfully.', jobId: job.id };
  }
}

module.exports = CallEscalationService;
