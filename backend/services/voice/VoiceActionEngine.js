const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MetaApiService = require('../MetaApiService');

class VoiceActionEngine {
  /**
   * Executes an action requested by the AI Agent during a call.
   * Typical payload comes from the voice provider's function calling feature.
   */
  static async handleAction(userId, contactId, actionName, payload) {
    console.log(`[VoiceActionEngine] Executing action: ${actionName} for User: ${userId}`);

    // Retrieve contact phone to send WhatsApp message
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });
    if (!contact || !contact.phone) {
      throw new Error(`Contact ${contactId} not found or has no phone number.`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user || !user.metaToken || !user.phoneNumberId) {
      console.warn(`[VoiceActionEngine] User ${userId} has not fully configured Meta WhatsApp credentials. Action skipped.`);
      return { success: false, message: 'WhatsApp credentials not configured.' };
    }

    const cleanPhone = contact.phone.replace(/[^0-9]/g, '');

    switch (actionName) {
      case 'send_whatsapp_payment_link':
        return await this.sendPaymentLink(userId, cleanPhone, user.metaToken, user.phoneNumberId, payload);
      case 'send_demo_link':
        return await this.sendDemoLink(userId, cleanPhone, user.metaToken, user.phoneNumberId, payload);
      case 'create_crm_note':
        return await this.createCrmNote(userId, contactId, payload);
      case 'schedule_callback':
        return await this.scheduleCallback(userId, contactId, payload);
      default:
        throw new Error(`Unsupported action: ${actionName}`);
    }
  }

  static async sendPaymentLink(userId, toPhone, token, phoneNumberId, payload) {
    const amount = payload.amount || '500';
    const currency = payload.currency || 'INR';
    // Generate payment link using the configured PUBLIC_URL from environment
    const baseUrl = process.env.PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:5005';
    const paymentLink = `${baseUrl}/pay/${userId}?amt=${amount}&cur=${currency}`;
    const text = `Here is your payment link for ${amount} ${currency}: ${paymentLink}`;

    try {
      await MetaApiService.sendText({
        phoneNumberId,
        token,
        to: toPhone,
        text,
        context: { userId }
      });
      console.log(`[VoiceActionEngine] Sent payment link to ${toPhone}`);
      return { success: true, message: 'Payment link sent via WhatsApp.' };
    } catch (err) {
      console.error('[VoiceActionEngine] Failed to send WhatsApp payment link:', err.message);
      return { success: false, message: err.message };
    }
  }

  static async sendDemoLink(userId, toPhone, token, phoneNumberId, payload) {
    const productCategory = payload.productCategory || '';
    const asset = await prisma.demoAsset.findFirst({
      where: {
        userId,
        OR: [
          { productCategory: { contains: productCategory, mode: 'insensitive' } },
          { name: { contains: productCategory, mode: 'insensitive' } }
        ]
      }
    });

    if (!asset) {
      return { success: false, message: 'No demo asset found for that category.' };
    }

    const text = `Hi! Here is the demo link you requested for ${asset.name}: ${asset.url}`;

    try {
      await MetaApiService.sendText({
        phoneNumberId,
        token,
        to: toPhone,
        text,
        context: { userId }
      });
      console.log(`[VoiceActionEngine] Sent demo link ${asset.url} to ${toPhone}`);
      return { success: true, message: `Demo link sent: ${asset.url}` };
    } catch (err) {
      console.error('[VoiceActionEngine] Failed to send WhatsApp demo link:', err.message);
      return { success: false, message: err.message };
    }
  }

  static async createCrmNote(userId, contactId, payload) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId }});
    if (contact) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { internalNotes: (contact.internalNotes || '') + `\n[Voice AI Note]: ${payload.note}` }
      });
      return { success: true, message: 'CRM Note added successfully.' };
    }
    return { success: false, message: 'Contact not found.' };
  }

  static async scheduleCallback(userId, contactId, payload) {
    const time = payload.time || 'tomorrow';
    const contact = await prisma.contact.findUnique({ where: { id: contactId }});
    if (contact) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { internalNotes: (contact.internalNotes || '') + `\n[Callback Scheduled]: At ${time}` }
      });
      return { success: true, message: 'Callback scheduled.' };
    }
    return { success: false, message: 'Contact not found.' };
  }
}

module.exports = VoiceActionEngine;
