const VoiceActionEngine = require('./VoiceActionEngine');

class VoiceSandboxSimulator {
  /**
   * Allows users to test the Voice API orchestration without actually dialing out.
   */
  static async simulateCall(userId, toPhone, context) {
    console.log(`[SandboxSimulator] Simulating call for user ${userId} to ${toPhone}`);
    
    // Simulate a 2 second delay for provider connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if simulateTrigger matches a WhatsApp action
    let actionTriggered = 'None';
    let actionResult = null;
    
    if (context.simulateAction === 'payment') {
      actionTriggered = 'send_whatsapp_payment_link';
      actionResult = await VoiceActionEngine.handleAction(userId, context.contactId, 'send_whatsapp_payment_link', {
        amount: '1500',
        currency: 'INR'
      }).catch(err => ({ success: false, error: err.message }));
    } else if (context.simulateAction === 'demo') {
      actionTriggered = 'send_demo_link';
      actionResult = await VoiceActionEngine.handleAction(userId, context.contactId, 'send_demo_link', {
        productCategory: context.productCategory || 'general'
      }).catch(err => ({ success: false, error: err.message }));
    }

    return {
      externalCallId: `sandbox_${Date.now()}`,
      status: 'COMPLETED',
      duration: 45,
      transcript: [
        { speaker: 'AI', message: 'Hello! I am calling from the sales department. How can I help you today?' },
        { speaker: 'CUSTOMER', message: context.simulateAction === 'payment' ? 'Can you send me the payment link?' : 'I want to see a product demo.' },
        { speaker: 'AI', message: 'Sure, I have triggered that via WhatsApp. Let me know if you received it.' }
      ],
      summary: 'Simulated successful sandbox call testing conversation and triggers.',
      leadScore: context.simulateAction === 'payment' ? 95 : 80,
      actionTriggered,
      actionResult
    };
  }
}

module.exports = VoiceSandboxSimulator;
