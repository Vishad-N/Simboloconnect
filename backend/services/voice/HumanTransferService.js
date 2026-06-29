const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MetaApiService = require('../MetaApiService');

class HumanTransferService {
  /**
   * Escalate an active AI call to a human agent.
   */
  static async executeTransfer(userId, sessionId, transferDestination) {
    console.log(`[HumanTransfer] Initiating transfer for session ${sessionId} to ${transferDestination}`);
    
    // 1. Log the transfer attempt in DB
    const session = await prisma.voiceCallSession.update({
      where: { id: sessionId },
      data: { status: 'TRANSFERRING_TO_HUMAN' }
    });

    // 2. Notify the target human agent via WhatsApp using MetaApiService
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.metaToken && user.phoneNumberId && transferDestination) {
      try {
        const cleanPhone = transferDestination.replace(/[^0-9]/g, '');
        await MetaApiService.sendText({
          phoneNumberId: user.phoneNumberId,
          token: user.metaToken,
          to: cleanPhone,
          text: `🚨 [Urgent Call Escalation]: Customer call (Session: ${sessionId}) is being transferred to you. Please answer.`,
          context: { userId }
        });
      } catch (err) {
        console.error('[HumanTransferService] Failed to send WhatsApp notification to agent:', err.message);
      }
    }

    // 3. Complete transfer (status update)
    await prisma.voiceCallSession.update({
      where: { id: sessionId },
      data: { status: 'TRANSFERRED' }
    });

    return { success: true, message: `Call successfully transferred to ${transferDestination}` };
  }
}

module.exports = HumanTransferService;
