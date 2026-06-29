/**
 * PHASE 1: WebhookWorker
 *
 * Processes inbound Meta webhook payloads ASYNCHRONOUSLY.
 * This file contains the full processing logic previously inline in routes/webhooks.js.
 * Meta already got HTTP 200 before this runs — no timeout risk.
 *
 * IDEMPOTENCY: Each job uses messageId as jobId in BullMQ, preventing duplicate processing.
 */

const { Worker } = require('bullmq');
const axios = require('axios');
const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');
const { validateBalance, deductCredits } = require('../middleware/walletEngine');
const { checkAvailability, bookAppointment } = require('../utils/calendar');
const redis = require('./redisConnection');
const { webhookReplyQueue } = require('./queues');

// ─── PHASE 1: Idempotency guard using Redis ────────────────────────────────
// Keys expire after 48h — covers any Meta retry window
async function isAlreadyProcessed(key) {
    const result = await redis.set(`idempotency:${key}`, '1', 'EX', 172800, 'NX');
    return result === null; // null = key already existed = already processed
}

// ─── Process a single inbound message event ───────────────────────────────
async function processInboundMessage(value, io, rawPayload) {
    const phoneNumberId = value.metadata.phone_number_id;
    const msgObj = value.messages[0];
    const from = msgObj.from;
    const messageId = msgObj.id;
    const msgType = msgObj.type;
    const waProfileName = value.contacts?.[0]?.profile?.name || null;

    // IDEMPOTENCY: Skip if already processed
    if (await isAlreadyProcessed(`msg_${messageId}`)) {
        console.log(`[WebhookWorker] Duplicate message skipped: ${messageId}`);
        return;
    }

    let preliminaryMsgBody = `[${msgType.toUpperCase()}]`;
    if (msgType === 'text') preliminaryMsgBody = msgObj.text.body;
    else if (msgType === 'button') preliminaryMsgBody = msgObj.button.text;

    console.log(`[WebhookWorker] Processing: phoneId=${phoneNumberId}, from=${from}, type=${msgType}`);

    // Find matching user
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { phoneNumberId: phoneNumberId },
                { phoneNumberId: String(phoneNumberId) },
            ],
        },
    });

    if (!user) {
        console.warn(`[WebhookWorker] No user found for phoneNumberId: ${phoneNumberId}`);
        return;
    }

    // ── Build message content ──────────────────────────────────────────────
    let msgBody = 'Media/Unsupported';
    let dbContent = { text: msgBody };

    if (msgType === 'text') {
        msgBody = msgObj.text.body;
        dbContent = { text: msgBody };
    } else if (msgType === 'button') {
        msgBody = msgObj.button.text;
        dbContent = { text: msgBody };
    } else if (['image', 'document', 'video', 'audio', 'sticker'].includes(msgType)) {
        try {
            const mediaId = msgObj[msgType].id;
            const mimeType = msgObj[msgType].mime_type;
            const caption = msgObj[msgType].caption || '';
            const fileName = msgObj[msgType].filename || `${msgType}_file`;
            msgBody = caption || `[${msgType.toUpperCase()} Received]`;

            const token = decrypt(user.metaToken);
            const { version } = await getMetaConfig();

            const mediaRes = await axios.get(`https://graph.facebook.com/${version}/${mediaId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const mediaUrl = mediaRes.data.url;
            const downloadRes = await axios.get(mediaUrl, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'arraybuffer',
            });

            const base64Data = Buffer.from(downloadRes.data, 'binary').toString('base64');
            dbContent = {
                type: msgType === 'sticker' ? 'image' : msgType,
                caption,
                fileName,
                mediaUrl: `data:${mimeType};base64,${base64Data}`,
            };
        } catch (mediaErr) {
            console.error('[WebhookWorker] Media download error:', mediaErr.message);
            msgBody = `Media/Unsupported (Error: ${mediaErr.message})`;
            dbContent = { text: msgBody };
        }
    } else {
        msgBody = `Unsupported type: ${msgType}`;
        dbContent = { text: msgBody };
    }

    // ── Upsert contact ─────────────────────────────────────────────────────
    let isNewContact = false;
    const cleanFrom = from.startsWith('+') ? from.substring(1) : from;
    const phoneVariants = [cleanFrom, '+' + cleanFrom];
    const contacts = await prisma.contact.findMany({
        where: {
            userId: user.id,
            phone: { in: phoneVariants },
        },
    });

    let contact = contacts[0];
    if (contacts.length === 0) {
        isNewContact = true;
        const normalizedPhone = '+' + cleanFrom;
        contact = await prisma.contact.create({
            data: { userId: user.id, phone: normalizedPhone, name: waProfileName || null, tags: ['Inbound'] },
        });
    } else if (waProfileName && contact.name !== waProfileName) {
        contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: waProfileName },
        });
    }

    // ── Opt-In / Opt-Out Logic ─────────────────────────────────────────────
    if (msgType === 'text') {
        const textLower = msgBody.trim().toLowerCase();
        if (textLower === 'stop' || textLower === 'unsubscribe') {
            contact = await prisma.contact.update({
                where: { id: contact.id },
                data: { optOut: true }
            });
            await prisma.contactEvent.create({
                data: { contactId: contact.id, type: 'OPT_OUT', description: 'User opted out of messages' }
            });
        } else if (textLower === 'start' || textLower === 'subscribe') {
            contact = await prisma.contact.update({
                where: { id: contact.id },
                data: { optOut: false }
            });
            await prisma.contactEvent.create({
                data: { contactId: contact.id, type: 'OPT_IN', description: 'User opted back in to messages' }
            });
        }
    }

    // ── Save inbound message ───────────────────────────────────────────────
    const log = await prisma.messageLog.upsert({
        where: { messageId },
        update: { status: 'DELIVERED' },
        create: {
            userId: user.id,
            messageId,
            recipient: from,
            direction: 'INBOUND',
            status: 'DELIVERED',
            content: dbContent,
        },
    });

    // ── Notification ───────────────────────────────────────────────────────
    try {
        let textPreview = typeof msgBody === 'string'
            ? msgBody.substring(0, 50)
            : (dbContent.text || 'Media message').substring(0, 50);

        const notif = await prisma.notification.create({
            data: {
                userId: user.id,
                title: `New Message from ${contact.name || from}`,
                message: textPreview,
                isRead: false,
            },
        });
        if (io) io.to(`user_${user.id}`).emit('new_notification', notif);
    } catch (e) {
        console.error('[WebhookWorker] Notification error:', e.message);
    }

    // ── Emit to dashboard ──────────────────────────────────────────────────
    if (io) io.to(`user_${user.id}`).emit('new_message', log);

    // ── Outbound Webhook Forwarding ─────────────────────────────────────────
    if (user.webhookEnabled && user.webhookUrl) {
        const outboundPayload = {
            contact: {
                status: isNewContact ? 'new' : 'existing',
                phone_number: contact.phone,
                uid: contact.id,
                first_name: contact.name || '',
                email: null,
                country: null,
            },
            message: {
                whatsapp_business_phone_number_id: phoneNumberId,
                whatsapp_message_id: messageId,
                body: msgType === 'text' || msgType === 'button' ? msgBody : null,
                status: log.status,
                media: ['image', 'document', 'video', 'audio', 'sticker'].includes(msgType) ? {
                    type: msgType === 'sticker' ? 'image' : msgType,
                    link: dbContent.mediaUrl,
                    mime_type: msgObj[msgType]?.mime_type || null,
                } : null,
            },
            whatsapp_webhook_payload: rawPayload || null,
        };

        axios.post(user.webhookUrl, outboundPayload, { timeout: 10000 })
            .then(res => console.log(`[Outbound Webhook] Dispatched to ${user.webhookUrl}. Status: ${res.status}`))
            .catch(err => console.error(`[Outbound Webhook] Dispatch failed to ${user.webhookUrl}:`, err.message));
    }

    // ── Bot / Flow / AI logic (PHASE 1: now runs safely async) ────────────
    if (!msgBody) return;

    const botPaused = (contacts || []).some(c => c.bot_paused_until && new Date(c.bot_paused_until) > new Date()) ||
                      (contact?.bot_paused_until && new Date(contact.bot_paused_until) > new Date());
    if (botPaused) {
        console.log(`[WebhookWorker] Bot paused for ${from}`);
        return;
    }

    const FlowEngine = require('./FlowEngine');

    // Priority 0: Active flow session
    const isResumed = await FlowEngine.resumeSessionIfActive(user, phoneNumberId, from, msgBody);
    if (isResumed) return;


    const fuzzball = require('fuzzball');

    // ─── Priority 1: Flow Builder (Specific Keyword Flows) ───────────────────
    const specificFlowStarted = await FlowEngine.startSpecificFlowIfMatched(user, phoneNumberId, from, msgBody, isNewContact);
    if (specificFlowStarted) {
        console.log(`[WebhookWorker] Handled by Specific Flow Builder`);
        return;
    }

    // ─── Priority 2: Q&A (AutoReply FAQ & ChatbotFlow) ──────────────────────
    let replyText = null, replyTemplate = null, replyMediaUrl = null;
    let highestScore = 0;
    
    // Check AutoReplies
    const autoReplies = await prisma.autoReply.findMany({ where: { userId: user.id, is_active: true } });
    let matchedAutoReply = null;
    
    for (const ar of autoReplies) {
        const trigger = ar.trigger_keyword.toLowerCase().trim();
        const msg = msgBody.toLowerCase().trim();
        
        if (ar.match_type === 'EXACT' && msg === trigger) {
            matchedAutoReply = ar; 
            break; // Perfect match, stop searching
        } else {
            // Fuzzy match using token_set_ratio (good for "office timing" vs "timing kya hai")
            const score = fuzzball.token_set_ratio(trigger, msg);
            if (score > 70 && score > highestScore) {
                highestScore = score;
                matchedAutoReply = ar;
            }
        }
    }

    if (matchedAutoReply) {
        if (matchedAutoReply.action_type === 'TEMPLATE') {
            replyTemplate = { templateName: matchedAutoReply.template_name, templateLanguage: matchedAutoReply.template_lang };
        } else {
            replyText = matchedAutoReply.reply_content;
            replyMediaUrl = matchedAutoReply.media_url;
        }
    } else {
        // Legacy ChatbotFlow (Q&A Fallback)
        const flows = await prisma.chatbotFlow.findMany({ where: { userId: user.id } });
        let matchedFlow = null;
        highestScore = 0;
        
        for (const f of flows) {
            const trigger = f.trigger.toLowerCase().trim();
            const msg = msgBody.toLowerCase().trim();
            if (msg === trigger) {
                matchedFlow = f;
                break;
            }
            const score = fuzzball.token_set_ratio(trigger, msg);
            if (score > 70 && score > highestScore) {
                highestScore = score;
                matchedFlow = f;
            }
        }
        
        if (matchedFlow) {
            if (matchedFlow.actionType === 'TEMPLATE') replyTemplate = matchedFlow.response;
            else replyText = matchedFlow.response?.text;
        }
    }

    // IF Q&A Matched, send it and STOP processing
    if (replyText || replyTemplate || replyMediaUrl) {
        console.log(`[WebhookWorker] Handled by Q&A`);
        await webhookReplyQueue.add('bot-reply', {
            userId: user.id,
            phoneNumberId,
            from,
            replyText,
            replyTemplate,
            replyMediaUrl,
        }, { jobId: `reply_${messageId}` });
        return; 
    }

    // ─── Priority 3: Workspace-Aware Autonomous AI ──────────────────────────
    if (user.botEnabled) {
        // ── FAST-PATH INTENT SHORTCUT ─────────────────────────────────────────
        const IntentShortcutEngine = require('./ai/IntentShortcutEngine');
        const intentResult = IntentShortcutEngine.detect(msgBody);

        if (intentResult.intent === 'INITIATE_VOICE_CALL' && intentResult.shouldBypassLLM) {
            const VoiceCapabilityChecker = require('./voice/VoiceCapabilityChecker');
            const capability = await VoiceCapabilityChecker.check(user.id);
            const customerName = contact?.name || null;
            replyText = IntentShortcutEngine.buildCallIntentReply(customerName, capability.canCall);

            if (capability.canCall) {
                try {
                    const VoiceQueueManager = require('./voice/VoiceQueueManager');
                    let callPhone = from;
                    if (callPhone && !callPhone.startsWith('+')) callPhone = '+' + callPhone.replace(/\D/g, '');
                    
                    await VoiceQueueManager.enqueueCall(
                        user.id,
                        contact?.id || 'UNKNOWN',
                        callPhone,
                        {
                            phone: callPhone,
                            name: customerName || 'Customer',
                            summary: `Customer requested a call via WhatsApp. Message: "${msgBody}"`,
                            intent: 'Customer Call Request',
                            escalated_at: new Date().toISOString(),
                            source: 'fast-path-shortcut'
                        }
                    );
                } catch (voiceErr) {
                    console.error(`[FastPath] Voice call queue error:`, voiceErr.message);
                }
            }
        } else if (intentResult.shouldBypassLLM && intentResult.immediateReply) {
            // ── GREETINGS FAST PATH BYPASS ────────────────────────────────────
            let reply = intentResult.immediateReply;
            if (contact?.name && reply.includes("Namaste! Hello!")) {
                reply = reply.replace("Namaste! Hello!", `Namaste ${contact.name}! Hello!`);
            }
            replyText = reply;
        } else {
            // ── FULL LLM PASS (all other intents) ────────────────────────────
            const { planAndExecuteWorkflow } = require('./ai/orchestrator/workflowPlanner');
            replyText = await planAndExecuteWorkflow(user.id, from, msgBody);
        }

        if (replyText) {
            console.log(`[WebhookWorker] Handled by AI Agent`);
            await webhookReplyQueue.add('bot-reply', {
                userId: user.id,
                phoneNumberId,
                from,
                replyText,
                replyTemplate: null,
                replyMediaUrl: null,
            }, { jobId: `reply_${messageId}` });
            return;
        }
    }

    // ─── Priority 4: Flow Builder (ALL_MESSAGES Fallback) ───────────────────
    // Only runs if AI is OFF or didn't generate a reply, AND no Keyword/Q&A matched
    const allMsgFlowStarted = await FlowEngine.startAllMessagesFlow(user, phoneNumberId, from, msgBody, isNewContact);
    if (allMsgFlowStarted) {
        console.log(`[WebhookWorker] Handled by ALL_MESSAGES Flow Fallback`);
        return;
    }
}

// ─── AI Inference (runs safely async now) ─────────────────────────────────
async function runAiInference(user, msgBody) {
    try {
        if (user.aiProvider === 'webhook' && user.aiWebhookUrl) {
            const aiRes = await axios.post(user.aiWebhookUrl, {
                contact: user.id,
                message: msgBody,
                timestamp: new Date().toISOString(),
            }, { timeout: 30000 });
            const d = aiRes.data;
            if (typeof d === 'string') return d;
            if (Array.isArray(d) && d.length > 0) return d[0].reply || d[0].text || d[0].response;
            if (typeof d === 'object') return d.reply || d.text || d.response;
            return null;
        }

        if (user.aiProvider === 'openai' && user.aiApiKey) {
            const kbDocs = await prisma.knowledgeDocument.findMany({ where: { userId: user.id } });
            const messages = [{ role: 'system', content: user.botPrompt || 'You are a helpful WhatsApp assistant.' }];
            if (kbDocs.length > 0) {
                const ctx = kbDocs.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n').substring(0, 15000);
                messages.push({ role: 'system', content: `Knowledge base:\n${ctx}\nPrioritize this context.` });
            }
            messages.push({ role: 'user', content: msgBody });

            let payload = { model: user.aiModel || 'gpt-4o-mini', messages };

            // Google Calendar tools
            if (user.googleRefreshToken) {
                payload.tools = [
                    { type: 'function', function: { name: 'check_availability', description: 'Check appointment availability', parameters: { type: 'object', properties: { dateStr: { type: 'string' }, durationMinutes: { type: 'integer' } }, required: ['dateStr'] } } },
                    { type: 'function', function: { name: 'book_appointment', description: 'Book an appointment', parameters: { type: 'object', properties: { summary: { type: 'string' }, startDateISO: { type: 'string' }, durationMinutes: { type: 'integer' } }, required: ['summary', 'startDateISO'] } } },
                ];
                payload.tool_choice = 'auto';
            }

            let aiRes = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
                headers: { Authorization: `Bearer ${user.aiApiKey}` },
                timeout: 30000,
            });
            let responseMessage = aiRes.data.choices[0].message;

            if (responseMessage.tool_calls) {
                messages.push(responseMessage);
                for (const tc of responseMessage.tool_calls) {
                    const args = JSON.parse(tc.function.arguments);
                    let result;
                    if (tc.function.name === 'check_availability') {
                        result = await checkAvailability(user.googleRefreshToken, user.googleClientId, user.googleClientSecret, args.dateStr, args.durationMinutes || 30);
                    } else if (tc.function.name === 'book_appointment') {
                        result = await bookAppointment(user.googleRefreshToken, user.googleClientId, user.googleClientSecret, args.summary, args.startDateISO, args.durationMinutes || 30);
                    }
                    messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: result });
                }
                aiRes = await axios.post('https://api.openai.com/v1/chat/completions', { ...payload, messages }, {
                    headers: { Authorization: `Bearer ${user.aiApiKey}` }, timeout: 30000,
                });
                responseMessage = aiRes.data.choices[0].message;
            }
            return responseMessage.content;
        }

        if (user.aiProvider === 'gemini' && user.aiApiKey) {
            const kbDocs = await prisma.knowledgeDocument.findMany({ where: { userId: user.id } });
            let prompt = (user.botPrompt ? `System: ${user.botPrompt}\n\n` : 'System: You are a helpful WhatsApp assistant.\n\n');
            if (kbDocs.length > 0) {
                const ctx = kbDocs.map(d => `[${d.name}]\n${d.content}`).join('\n\n').substring(0, 15000);
                prompt += `Knowledge base:\n${ctx}\n\n`;
            }
            prompt += `User: ${msgBody}`;
            const aiRes = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${user.aiModel || 'gemini-1.5-flash'}:generateContent?key=${user.aiApiKey}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { timeout: 30000 }
            );
            return aiRes.data.candidates[0].content.parts[0].text;
        }

        if ((user.aiProvider === 'openrouter' || user.aiProvider === 'nvidianim') && user.aiApiKey) {
            const kbDocs = await prisma.knowledgeDocument.findMany({ where: { userId: user.id } });
            const messages = [{ role: 'system', content: user.botPrompt || 'You are a helpful WhatsApp assistant.' }];
            if (kbDocs.length > 0) {
                const ctx = kbDocs.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n').substring(0, 15000);
                messages.push({ role: 'system', content: `Knowledge base:\n${ctx}` });
            }
            messages.push({ role: 'user', content: msgBody });

            const url = user.aiProvider === 'openrouter'
                ? 'https://openrouter.ai/api/v1/chat/completions'
                : 'https://integrate.api.nvidia.com/v1/chat/completions';
            const model = user.aiModel || (user.aiProvider === 'openrouter' ? 'meta-llama/llama-3-70b-instruct' : 'meta/llama3-70b-instruct');
            const headers = { Authorization: `Bearer ${user.aiApiKey}` };
            if (user.aiProvider === 'openrouter') {
                headers['HTTP-Referer'] = process.env.PUBLIC_URL || process.env.OPENROUTER_REFERRER || 'http://localhost:5005';
                headers['X-Title'] = process.env.APP_NAME || process.env.SMTP_SENDER_NAME || 'WhatsApp Panel';
            }

            const aiRes = await axios.post(url, { model, messages }, { headers, timeout: 30000 });
            return aiRes.data.choices[0].message.content;
        }
    } catch (err) {
        console.error(`[WebhookWorker] AI inference error (${user.aiProvider}):`, err.message);
    }
    return null;
}

// ─── Process status update event ──────────────────────────────────────────
async function processStatusUpdate(value, io) {
    const statusObj = value.statuses[0];
    const messageId = statusObj.id;
    const newStatus = statusObj.status.toUpperCase();

    // IDEMPOTENCY: Allow status updates (SENT→DELIVERED→READ is sequential, idempotency not needed here)

    console.log(`[WebhookWorker] Status update: ${messageId} → ${newStatus}`);
    try {
        let updateData = { status: newStatus };

        if (newStatus === 'FAILED' && statusObj.errors?.length > 0) {
            const err = statusObj.errors[0];
            let errorDetails = err.title || err.message || 'Unknown error';
            if (err.error_data?.details) errorDetails += ` (${err.error_data.details})`;

            const existingLog = await prisma.messageLog.findUnique({ where: { messageId } });
            if (existingLog) {
                let contentObj = {};
                try { contentObj = typeof existingLog.content === 'string' ? JSON.parse(existingLog.content) : (existingLog.content || {}); } catch (_) {}
                contentObj.failureReason = errorDetails;
                updateData.content = contentObj;
            }
        }

        const updatedLog = await prisma.messageLog.update({ where: { messageId }, data: updateData });

        // Phase 1: ContactEvent timeline logging
        try {
            if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(newStatus)) {
                const contact = await prisma.contact.findFirst({
                    where: { userId: updatedLog.userId, phone: updatedLog.recipient }
                });
                
                if (contact) {
                    await prisma.contactEvent.create({
                        data: {
                            contactId: contact.id,
                            type: `MESSAGE_${newStatus}`,
                            description: newStatus === 'FAILED' 
                                ? `Message failed: ${updateData.content?.failureReason || 'Unknown error'}`
                                : `Message ${newStatus.toLowerCase()}`
                        }
                    });
                }
            }
        } catch (eventErr) {
            console.error("[WebhookWorker] Error logging ContactEvent:", eventErr);
        }

        if (io) {
            io.to(`user_${updatedLog.userId}`).emit('message_status_update', { messageId, status: newStatus });
            if (updatedLog.campaignId) {
                io.to(`user_${updatedLog.userId}`).emit('campaign_status_update', { campaignId: updatedLog.campaignId });
            }
        }
    } catch (e) {
        // If message doesn't exist yet (timing issue), skip gracefully
        console.warn(`[WebhookWorker] Status update skipped for ${messageId}: ${e.message}`);
    }
}

// ─── Process template status update ───────────────────────────────────────
async function processTemplateStatusUpdate(entry) {
    const wabaId = entry.id;
    const templateInfo = entry.changes[0].value;
    const eventType = templateInfo.event;
    const templateName = templateInfo.message_template_name;
    const templateLanguage = templateInfo.message_template_language;

    const user = await prisma.user.findFirst({ where: { wabaId } });
    if (!user) return;

    let newStatus = 'PENDING';
    if (eventType === 'APPROVED') newStatus = 'APPROVED';
    else if (eventType === 'REJECTED') newStatus = 'REJECTED';

    await prisma.template.updateMany({
        where: { userId: user.id, name: templateName, language: templateLanguage },
        data: { status: newStatus },
    });

    // Also update EcomTemplate status
    try {
        await prisma.ecomTemplate.updateMany({
            where: { userId: user.id, name: templateName, language: templateLanguage },
            data: { status: newStatus },
        });
    } catch (ecomErr) {
        console.error(`[WebhookWorker] Failed to update EcomTemplate status for ${templateName}:`, ecomErr.message);
    }

    console.log(`[WebhookWorker] Template ${templateName} → ${newStatus}`);
}

// ─── Main BullMQ Worker ────────────────────────────────────────────────────
function startWebhookWorker(io) {
    const worker = new Worker('webhook.inbound', async (job) => {
        const body = job.data;

        if (!body.object) return; // Not a WhatsApp event

        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        if (!change) return;

        const value = change.value;

        if (value.messages) {
            await processInboundMessage(value, io, body);
        } else if (value.statuses) {
            await processStatusUpdate(value, io);
        } else if (change.field === 'message_template_status_update') {
            await processTemplateStatusUpdate(entry);
        }
    }, {
        connection: redis,
        concurrency: 5,   // Process up to 5 webhook events simultaneously
        settings: {
            backoffStrategies: {
                exponential: (attemptsMade) => Math.min(2000 * Math.pow(2, attemptsMade), 30000),
            },
        },
    });

    worker.on('completed', (job) => console.log(`[WebhookWorker] Job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message));
    worker.on('error', (err) => console.error('[WebhookWorker] Worker error:', err.message));

    console.log('[WebhookWorker] Started — processing webhook.inbound queue');
    return worker;
}

module.exports = { startWebhookWorker };
