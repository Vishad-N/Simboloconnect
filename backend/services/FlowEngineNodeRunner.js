const axios = require('axios');
const prisma = require('../../prismaClient');
const { decrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');

// ─── Helper: Get Meta API version ────────────────────────────────────────────
async function getVersion() {
    try { const { version } = await getMetaConfig(); return version; } 
    catch { return 'v19.0'; }
}

// ─── Helper: Send WhatsApp message via Meta API ───────────────────────────────
async function sendWA(user, phoneNumberId, toPhone, payload) {
    const token = decrypt(user.metaToken);
    const version = await getVersion();
    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    try {
        const res = await axios.post(url, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: toPhone,
            ...payload
        }, { headers: { Authorization: `Bearer ${token}` } });

        await prisma.messageLog.create({
            data: {
                userId: user.id,
                messageId: res.data?.messages?.[0]?.id || `flow_${Date.now()}`,
                recipient: toPhone,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: { ...payload, _source: 'FLOW' }
            }
        }).catch(() => {});  

        return true;
    } catch (err) {
        console.error('[FlowEngine] Meta API Error:', err.response?.data || err.message);
        return false;
    }
}

const extractMediaUrlOrId = (url) => {
    if (!url) return { url: '', isId: false };
    if (url.includes('/media/') && /^\d+$/.test(url.split('/').pop())) {
        return { url: url.split('/').pop(), isId: true };
    }
    return { url, isId: /^\d+$/.test(url) };
};

async function buildMessagePayload(node, stateData, incomingMessage) {
    const data = node.data || {};
    
    switch (node.type) {
        case 'sendTextNode': {
            let text = data.message || '';
            Object.entries(stateData || {}).forEach(([k, v]) => {
                text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
            });
            text = text.replace(/{{lastMessage}}/g, incomingMessage || '');
            return { type: 'text', text: { body: text, preview_url: false } };
        }
        case 'sendImageNode': {
            const media = extractMediaUrlOrId(data.imageUrl || data.mediaUrl || '');
            if (!media.url) return null;
            return { type: 'image', image: { [media.isId ? 'id' : 'link']: media.url, caption: data.caption || '' } };
        }
        case 'sendVideoNode': {
            const media = extractMediaUrlOrId(data.videoUrl || data.mediaUrl || '');
            if (!media.url) return null;
            return { type: 'video', video: { [media.isId ? 'id' : 'link']: media.url, caption: data.caption || '' } };
        }
        case 'sendAudioNode': {
            const media = extractMediaUrlOrId(data.audioUrl || data.mediaUrl || '');
            if (!media.url) return null;
            return { type: 'audio', audio: { [media.isId ? 'id' : 'link']: media.url } };
        }
        case 'sendDocumentNode': {
            const media = extractMediaUrlOrId(data.documentUrl || data.mediaUrl || '');
            if (!media.url) return null;
            return { type: 'document', document: { [media.isId ? 'id' : 'link']: media.url, filename: data.filename || 'document', caption: data.caption || '' } };
        }
        default:
            return null;
    }
}

async function executeNode(node, edges, user, phoneNumberId, contactPhone, incomingMessage, stateData, flowId) {
    const nodeId = node.id;
    const getNexts = (handle) => edges.filter(e => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle));

    switch (node.type) {
        case 'keywordTriggerNode':
        case 'webhookTriggerNode':
        case 'scheduleTriggerNode':
        case 'newMessageTriggerNode':
        case 'aiIntentTriggerNode':
        case 'triggerNode':
            return { nextEdges: getNexts(), stateData };

        case 'sendTextNode':
        case 'sendImageNode':
        case 'sendVideoNode':
        case 'sendAudioNode':
        case 'sendDocumentNode': {
            const payload = await buildMessagePayload(node, stateData, incomingMessage);
            if (payload) await sendWA(user, phoneNumberId, contactPhone, payload);
            return { nextEdges: getNexts(), stateData };
        }

        case 'delayNode': {
            // Handled exclusively by the BullMQ worker logic now for real suspensions
            return { nextEdges: getNexts(), stateData };
        }

        case 'conditionNode': {
            const conditions = node.data?.conditions || [];
            const logicType = node.data?.logicType || 'AND';
            const msg = (incomingMessage || '').toLowerCase();

            const results = conditions.map(cond => {
                const field = (stateData?.[cond.field] || incomingMessage || '').toLowerCase();
                const val = (cond.value || '').toLowerCase();
                switch (cond.operator) {
                    case 'contains':    return field.includes(val);
                    case 'not_contains':return !field.includes(val);
                    case 'equals':      return field === val;
                    default:            return field.includes(val);
                }
            });

            const passed = logicType === 'AND' ? results.every(Boolean) : results.some(Boolean);
            const branch = passed ? 'true' : 'false';
            const nextEdges = edges.filter(e => e.source === nodeId && (e.sourceHandle === branch || e.label === branch));
            return { nextEdges: nextEdges.length ? nextEdges : getNexts(), stateData };
        }

        // Add Part 1 & Part 4 Nodes here (AI Agent Node, Payment Node, CRM Node)
        case 'aiAgentNode': {
            // Invokes the new Workflow Planner
            const { planAndExecuteWorkflow } = require('./ai/orchestrator/workflowPlanner');
            const aiResponse = await planAndExecuteWorkflow(user.id, contactPhone, incomingMessage);
            if (aiResponse) {
                await sendWA(user, phoneNumberId, contactPhone, { type: 'text', text: { body: aiResponse } });
            }
            return { nextEdges: getNexts(), stateData };
        }

        case 'waitReplyNode': {
            return { nextEdges: [], stateData, waitReply: true, currentNodeId: nodeId };
        }

        default:
            console.warn(`[NodeRunner] Unknown node type: ${node.type}`);
            return { nextEdges: getNexts(), stateData };
    }
}

module.exports = { executeNode };
