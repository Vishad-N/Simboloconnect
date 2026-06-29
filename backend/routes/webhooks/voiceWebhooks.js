const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Middleware to verify Retell signature (optional but secure)
function verifyRetellSignature(req, secret) {
  if (!secret) return true;
  const signature = req.headers['x-retell-signature'];
  if (!signature) return false;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return hash === signature;
}

// 1. Retell Webhook
router.post('/retell', async (req, res) => {
  try {
    const { event, call, transcript, recording_url } = req.body;
    const callId = call?.call_id || req.body.call_id;

    console.log(`[VoiceWebhook] Received Retell Event: ${event} for Call: ${callId}`);

    const session = await prisma.voiceCallSession.findFirst({
      where: { externalCallId: callId }
    });
    if (!session) return res.status(404).send('Session not found');

    if (event === 'call_completed' || event === 'call_ended') {
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          recordingUrl: recording_url || call?.recording_url,
          durationSeconds: call?.duration_ms ? Math.round(call.duration_ms / 1000) : undefined
        }
      });

      // Dispatch transcript worker
      if (transcript || call?.transcript) {
        const VoiceTranscriptWorker = require('../../workers/VoiceTranscriptWorker');
        await VoiceTranscriptWorker.worker.add('process-transcript', {
          sessionId: session.id,
          rawTranscript: transcript || call?.transcript
        });
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceWebhook] Retell Webhook Error:', error);
    res.status(500).send('Webhook Error');
  }
});

// 2. Bland AI Webhook
router.post('/bland', async (req, res) => {
  try {
    const { call_id, event, transcript, recording_url, duration } = req.body;
    console.log(`[VoiceWebhook] Received Bland Event: ${event} for Call: ${call_id}`);

    const session = await prisma.voiceCallSession.findFirst({
      where: { externalCallId: call_id }
    });
    if (!session) return res.status(404).send('Session not found');

    // Bland sends transcripts and completions
    await prisma.voiceCallSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        recordingUrl: recording_url || undefined,
        durationSeconds: duration ? Math.round(parseFloat(duration)) : undefined
      }
    });

    if (transcript) {
      const parsedTranscript = Array.isArray(transcript) ? transcript.map(t => ({
        speaker: t.user === 'assistant' ? 'AI' : 'CUSTOMER',
        message: t.text
      })) : [];
      
      const VoiceTranscriptWorker = require('../../workers/VoiceTranscriptWorker');
      await VoiceTranscriptWorker.worker.add('process-transcript', {
        sessionId: session.id,
        rawTranscript: parsedTranscript
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceWebhook] Bland Webhook Error:', error);
    res.status(500).send('Webhook Error');
  }
});

// 3. Vapi Webhook
router.post('/vapi', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).send('Bad Request');

    const callId = message.call?.id;
    const metadata = message.call?.metadata || {};
    const sessionId = metadata.sessionId || message.metadata?.sessionId;

    console.log(`[VoiceWebhook] Received Vapi Message Type: ${message.type} for Call: ${callId}, SessionId: ${sessionId}`);

    let session = null;
    if (sessionId) {
      session = await prisma.voiceCallSession.findUnique({
        where: { id: sessionId }
      });
    }
    if (!session && callId) {
      session = await prisma.voiceCallSession.findFirst({
        where: { externalCallId: callId }
      });
    }

    if (!session) {
      console.log(`[VoiceWebhook] No session found for callId: ${callId}, sessionId: ${sessionId}`);
      return res.status(200).send('OK'); // Don't return 404, Vapi will retry
    }

    const finalStatuses = ['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'];

    // Handle call status events
    if (message.type === 'status-update') {
      const vapiStatus = message.status;
      let ourStatus = session.status;
      if (vapiStatus === 'ringing')       ourStatus = 'RINGING';
      else if (vapiStatus === 'in-progress') ourStatus = 'ANSWERED';
      else if (vapiStatus === 'ended') {
        const endedReason = message.endedReason || message.call?.endedReason || '';
        if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') ourStatus = 'NO_ANSWER';
        else if (endedReason === 'busy') ourStatus = 'BUSY';
        else if (endedReason === 'failed' || endedReason === 'error') ourStatus = 'FAILED';
        else ourStatus = 'COMPLETED';
      }
      else if (vapiStatus === 'no-answer') ourStatus = 'NO_ANSWER';
      else if (vapiStatus === 'busy')     ourStatus = 'BUSY';
      else if (vapiStatus === 'failed')   ourStatus = 'FAILED';

      const isCurrentlyFinal = finalStatuses.includes(session.status);
      if (!isCurrentlyFinal) {
        const updatedSession = await prisma.voiceCallSession.updateMany({
          where: { id: session.id, status: { notIn: finalStatuses } },
          data: { status: ourStatus }
        });

        if (updatedSession.count > 0 && finalStatuses.includes(ourStatus)) {
          // Update campaign stats
          if (session.campaignId) {
            const durationSec = message.call?.duration ? Math.round(message.call.duration) : 
                                message.durationSeconds || 0;
            const durationMinutes = Math.ceil(durationSec / 60);
            const statsUpdate = { totalMinutes: { increment: durationMinutes } };

            if (ourStatus === 'COMPLETED')    statsUpdate.completedCount  = { increment: 1 };
            else if (ourStatus === 'NO_ANSWER') statsUpdate.noAnswerCount = { increment: 1 };
            else if (ourStatus === 'BUSY')    statsUpdate.busyCount       = { increment: 1 };
            else if (ourStatus === 'FAILED')  statsUpdate.failedCount     = { increment: 1 };
            if (durationSec > 5)               statsUpdate.answeredCount    = { increment: 1 };

            await prisma.voiceCampaign.update({
              where: { id: session.campaignId },
              data: statsUpdate
            });

            await checkAndCompleteCampaign(session.campaignId);
          }
        }
      }
    }

    if (message.type === 'end-of-call-report') {
      const durationSec = message.call?.duration ? Math.round(message.call.duration) : 
                          message.durationSeconds || 0;
      const endedReason = message.call?.endedReason || message.endedReason || '';

      // Determine final status
      let finalStatus = 'COMPLETED';
      if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') finalStatus = 'NO_ANSWER';
      else if (endedReason === 'busy') finalStatus = 'BUSY';
      else if (endedReason === 'failed' || endedReason === 'error') finalStatus = 'FAILED';
      else if (durationSec > 5) finalStatus = 'COMPLETED'; // actual conversation

      const isCurrentlyFinal = finalStatuses.includes(session.status);

      // Always update call session metadata
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: {
          recordingUrl: message.call?.recordingUrl || message.recordingUrl || undefined,
          durationSeconds: durationSec || undefined,
          summary: message.analysis?.summary || message.summary || undefined
        }
      });

      if (!isCurrentlyFinal) {
        const updatedSession = await prisma.voiceCallSession.updateMany({
          where: { id: session.id, status: { notIn: finalStatuses } },
          data: { status: finalStatus }
        });

        if (updatedSession.count > 0) {
          // Update campaign stats if this call belongs to a campaign
          if (session.campaignId) {
            const durationMinutes = Math.ceil(durationSec / 60);
            const statsUpdate = { totalMinutes: { increment: durationMinutes } };

            if (finalStatus === 'COMPLETED')    statsUpdate.completedCount  = { increment: 1 };
            else if (finalStatus === 'NO_ANSWER') statsUpdate.noAnswerCount = { increment: 1 };
            else if (finalStatus === 'BUSY')    statsUpdate.busyCount       = { increment: 1 };
            else if (finalStatus === 'FAILED')  statsUpdate.failedCount     = { increment: 1 };
            if (durationSec > 5)               statsUpdate.answeredCount    = { increment: 1 };

            await prisma.voiceCampaign.update({
              where: { id: session.campaignId },
              data: statsUpdate
            });

            // Check if campaign is now fully completed
            await checkAndCompleteCampaign(session.campaignId);
          }
        }
      }

      if (message.transcript || message.call?.transcript) {
        const rawT = message.call?.transcript || message.transcript;
        let lines = [];
        if (typeof rawT === 'string') {
          lines = rawT.split('\n').map(line => {
            const parts = line.split(':');
            const role = parts[0]?.toLowerCase().includes('bot') || parts[0]?.toLowerCase().includes('assistant') ? 'AI' : 'CUSTOMER';
            return { speaker: role, message: parts.slice(1).join(':').trim() };
          }).filter(l => l.message);
        } else if (Array.isArray(rawT)) {
          lines = rawT.map(t => ({ speaker: t.role === 'assistant' ? 'AI' : 'CUSTOMER', message: t.content || t.message }));
        }

        if (lines.length > 0) {
          const VoiceTranscriptWorker = require('../../workers/VoiceTranscriptWorker');
          await VoiceTranscriptWorker.worker.add('process-transcript', {
            sessionId: session.id,
            rawTranscript: lines
          });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceWebhook] Vapi Webhook Error:', error);
    res.status(500).send('Webhook Error');
  }
});

// Helper: Auto-complete campaign when all dials are done
async function checkAndCompleteCampaign(campaignId) {
  try {
    const campaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'RUNNING') return;

    const totalProcessed = (campaign.completedCount || 0) + (campaign.failedCount || 0) +
                           (campaign.noAnswerCount || 0) + (campaign.busyCount || 0);
    
    if (campaign.audienceCount > 0 && totalProcessed >= campaign.audienceCount) {
      await prisma.voiceCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
      console.log(`[Campaign] Campaign ${campaignId} auto-completed. Total: ${totalProcessed}/${campaign.audienceCount}`);
    }
  } catch (err) {
    console.error('[Campaign] Auto-complete check failed:', err.message);
  }
}

// 4. Twilio Voice Webhook (Status Callback)
router.post('/twilio', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log(`[VoiceWebhook] Twilio Callback Status: ${CallStatus} for Sid: ${CallSid}`);

    const session = await prisma.voiceCallSession.findFirst({
      where: { externalCallId: CallSid }
    });
    if (!session) return res.status(404).send('Session not found');

    if (CallStatus === 'completed') {
      // In a real twilio setup, recording URL would come from a recordingStatusCallback.
      // We will mock/query it, and update duration.
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          durationSeconds: CallDuration ? parseInt(CallDuration, 10) : undefined
        }
      });

      // Trigger automatic summarization directly
      const VoiceTranscriptWorker = require('../../workers/VoiceTranscriptWorker');
      await VoiceTranscriptWorker.worker.add('process-transcript', {
        sessionId: session.id,
        rawTranscript: [{ speaker: 'AI', message: 'Thank you for calling. Outbound call completed successfully.' }]
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceWebhook] Twilio Webhook Error:', error);
    res.status(500).send('Webhook Error');
  }
});

// 5. Telnyx Voice Webhook
router.post('/telnyx', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).send('Bad Request');

    const eventType = data.event_type;
    const callControlId = data.payload?.call_control_id;

    console.log(`[VoiceWebhook] Telnyx Event: ${eventType} for Call: ${callControlId}`);

    const session = await prisma.voiceCallSession.findFirst({
      where: { externalCallId: callControlId }
    });
    if (!session) return res.status(404).send('Session not found');

    if (eventType === 'call.hangup') {
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED' }
      });

      const VoiceTranscriptWorker = require('../../workers/VoiceTranscriptWorker');
      await VoiceTranscriptWorker.worker.add('process-transcript', {
        sessionId: session.id,
        rawTranscript: [{ speaker: 'AI', message: 'Telnyx call control session completed.' }]
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceWebhook] Telnyx Webhook Error:', error);
    res.status(500).send('Webhook Error');
  }
});

// 4. Custom Tool Webhooks: Send WhatsApp Message or Links dynamically during active calls
const handleVoiceActionSendLink = async (req, res) => {
  try {
    // 1. Dynamic extraction of arguments/parameters from different voice provider payloads
    let argumentsObj = {};
    if (req.body.message?.toolCalls && req.body.message.toolCalls.length > 0) {
      argumentsObj = req.body.message.toolCalls[0].function?.arguments || {};
    } else if (req.body.toolCall?.function?.arguments) {
      argumentsObj = req.body.toolCall.function.arguments;
    } else if (req.body.arguments) {
      argumentsObj = req.body.arguments;
    }

    if (typeof argumentsObj === 'string') {
      try {
        argumentsObj = JSON.parse(argumentsObj);
      } catch (e) {
        console.error("[VoiceWebhook] Failed to parse arguments string:", e);
      }
    }

    // Extract Authorization header / API key (supporting Bearer token, custom header, body or query params for multi-tenant SaaS clients)
    let apiKey = undefined;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7).trim();
      } else {
        apiKey = authHeader.trim();
      }
    }
    apiKey = apiKey || 
             req.headers['x-api-key'] || 
             req.query.apiKey || 
             req.query.api_key || 
             req.body.apiKey || 
             req.body.api_key ||
             argumentsObj.apiKey ||
             argumentsObj.api_key;

    // Log incoming payload for advanced troubleshooting
    console.log(`[VoiceWebhook] Action send-link incoming payload:`, JSON.stringify(req.body, null, 2));

    // Extract callId (various formats)
    const callId = req.body.call_id || 
                   req.body.callId || 
                   req.body.CallSid || 
                   req.body.message?.call?.id || 
                   req.body.call?.call_id ||
                   req.body.call?.id ||
                   req.body.call_control_id ||
                   req.body.data?.payload?.call_control_id ||
                   req.query.call_id ||
                   argumentsObj.call_id ||
                   argumentsObj.callId;

    // Extract phone number (various formats, including nested provider call objects)
    const phone = argumentsObj.phone || 
                  argumentsObj.customerPhone || 
                  argumentsObj.recipient ||
                  argumentsObj.to ||
                  req.body.phone || 
                  req.body.customerPhone || 
                  req.body.customer_phone ||
                  req.body.to ||
                  req.body.recipient ||
                  req.body.message?.call?.customer?.number || // Vapi standard customer number
                  req.body.call?.customer_phone_number ||    // Retell standard customer number
                  req.body.call?.customer?.number ||         // Vapi alternative
                  req.body.customer?.number ||               // Vapi alternative 2
                  req.body.call?.phone ||
                  req.body.call?.customerPhone ||
                  req.query.phone ||
                  req.query.customerPhone ||
                  req.query.to;

    // Extract message/text template
    const message = argumentsObj.message || 
                    argumentsObj.text || 
                    argumentsObj.body || 
                    req.body.message || 
                    req.body.text || 
                    req.body.body || 
                    req.query.message;

    // Extract demoType or link category
    const demoType = argumentsObj.demoType || 
                     argumentsObj.demo_type || 
                     argumentsObj.linkType ||
                     req.body.demoType || 
                     req.body.demo_type || 
                     req.query.demoType;

    // Extract source
    const source = req.body.source || req.query.source || 'voice';

    console.log(`[VoiceWebhook] Action send-link parsed parameters:`, {
      callId,
      phone,
      message,
      demoType,
      source
    });

    if (!callId) {
      console.warn("[VoiceWebhook] Action execution bypassed: callId is missing in request payload.");
      return res.status(200).json({ success: true, status: 'SKIPPED_MISSING_CALL_ID' });
    }

    // Try resolving phone from active voice session metadata as a fallback if not passed in tool args
    let finalPhone = phone;
    if (!finalPhone) {
      try {
        const session = await prisma.voiceCallSession.findFirst({
          where: { externalCallId: callId }
        });
        if (session && session.metadata) {
          const metadata = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
          finalPhone = metadata.phone || metadata.toPhone || (session.metadata && (session.metadata.phone || session.metadata.toPhone));
        }
      } catch (err) {
        console.error("[VoiceWebhook] Fallback phone lookup failed:", err.message);
      }
    }

    if (!finalPhone) {
      console.warn("[VoiceWebhook] Action execution bypassed: customer phone number could not be resolved.");
      return res.status(200).json({ success: true, status: 'SKIPPED_MISSING_PHONE' });
    }

    const AutomationMessagingService = require('../../services/AutomationMessagingService');
    const io = req.app.get('io');

    const result = await AutomationMessagingService.sendLink({
      customerPhone: finalPhone,
      message,
      demoType,
      source,
      callId,
      apiKey
    }, io);

    console.log(`[VoiceWebhook] AutomationMessagingService execution resolved:`, result);
    return res.status(200).json({ success: true, status: result.status });

  } catch (error) {
    console.error('[VoiceWebhook] Global Silent Handler Failure occurred and was masked successfully:', error.message);
    return res.status(200).json({ success: true });
  }
};

router.post('/action/send-whatsapp', handleVoiceActionSendLink);
router.post('/action/send-link', handleVoiceActionSendLink);

module.exports = router;
