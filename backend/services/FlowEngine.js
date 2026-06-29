const axios = require('axios');
const prisma = require('../prismaClient');
const { decrypt } = require('../utils/encryption');
const { getMetaConfig } = require('../utils/metaConfig');

// ─── Trigger Keyword Matcher ────────────────────────────────────────────────
// Matches incoming message against a flow's trigger node settings
function matchesTrigger(messageBody, flow, nodes, isNewContact = false) {
    const triggerNode = (nodes || []).find(n => n.type?.toLowerCase().includes('trigger'));
    
    // Check newMessageTriggerNode condition: should only fire on the first message ever from a contact
    if (triggerNode?.type === 'newMessageTriggerNode') {
        if (!isNewContact) return false;
    }

    // Check scheduleTriggerNode constraints: should only be active within configured timeframes
    if (triggerNode?.type === 'scheduleTriggerNode') {
        const { startTime, endTime } = triggerNode.data || {};
        const now = new Date();
        if (startTime && now < new Date(startTime)) return false;
        if (endTime && now > new Date(endTime)) return false;
    }

    const msg = (messageBody || '').toLowerCase().trim();
    const matchType = triggerNode?.data?.matchType || 'contains';
    const keyword = (triggerNode?.data?.keyword || flow.trigger || '').toLowerCase().trim();

    if (!keyword || keyword === 'all_messages') return true;

    switch (matchType) {
        case 'exact':     return msg === keyword;
        case 'startsWith': return msg.startsWith(keyword);
        case 'endsWith':   return msg.endsWith(keyword);
        case 'contains':   return msg.includes(keyword);
        case 'regex':
            try { return new RegExp(keyword, 'i').test(msg); } catch { return false; }
        default:           return msg.includes(keyword);
    }
}

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

        // Log outbound message
        await prisma.messageLog.create({
            data: {
                userId: user.id,
                messageId: res.data?.messages?.[0]?.id || `flow_${Date.now()}`,
                recipient: toPhone,
                direction: 'OUTBOUND',
                status: 'SENT',
                content: { ...payload, _source: 'FLOW' }
            }
        }).catch(() => {});  // Don't fail the flow if logging fails

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

// ─── Build Meta payloads for each message node type ──────────────────────────
async function buildMessagePayload(node, stateData, incomingMessage) {
    const data = node.data || {};
    
    switch (node.type) {
        case 'sendTextNode': {
            let text = data.message || '';
            // Variable substitution: {{varName}} → stateData.varName
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
            return { type: 'document', document: { [media.isId ? 'id' : 'link']: media.url, filename: data.filename || 'document.pdf' } };
        }
        case 'sendButtonsNode': {
            const buttons = (data.buttons || []).slice(0, 3).map((btn, i) => ({
                type: 'reply', reply: { id: btn.id || `btn_${i}`, title: (btn.title || `Option ${i + 1}`).substring(0, 20) }
            }));
            if (!buttons.length) return null;
            return {
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: data.body || 'Please choose an option:' },
                    action: { buttons }
                }
            };
        }
        case 'sendListNode': {
            const sections = (data.sections || []).map(sec => ({
                title: sec.title || 'Section',
                rows: (sec.rows || []).slice(0, 10).map((row, i) => ({
                    id: row.id || `row_${i}`,
                    title: (row.title || `Item ${i + 1}`).substring(0, 24),
                    description: (row.description || '').substring(0, 72)
                }))
            }));
            if (!sections.length) return null;
            return {
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: data.header ? { type: 'text', text: data.header } : undefined,
                    body: { text: data.body || 'Please select from the list:' },
                    action: { button: data.buttonText || 'Choose', sections }
                }
            };
        }
        case 'sendTemplateNode': {
            if (!data.templateName) return null;
            return {
                type: 'template',
                template: {
                    name: data.templateName,
                    language: { code: data.language || 'en_US' },
                    components: data.components || []
                }
            };
        }
        default:
            return null;
    }
}

// ─── Execute a single node — returns { nextEdge, done, stateData } ────────────
async function executeNode(node, edges, user, phoneNumberId, contactPhone, incomingMessage, stateData, flowId) {
    const nodeId = node.id;
    const getNexts = (handle) => edges.filter(e => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle));

    switch (node.type) {
        // ── Trigger nodes (just pass through) ──────────────────────────────
        case 'keywordTriggerNode':
        case 'webhookTriggerNode':
        case 'scheduleTriggerNode':
        case 'newMessageTriggerNode':
        case 'aiIntentTriggerNode':
        case 'triggerNode':
            return { nextEdges: getNexts(), stateData };

        // ── Message nodes ──────────────────────────────────────────────────
        case 'sendTextNode':
        case 'sendImageNode':
        case 'sendVideoNode':
        case 'sendAudioNode':
        case 'sendDocumentNode':
        case 'sendButtonsNode':
        case 'sendListNode':
        case 'sendTemplateNode':
        case 'sendMessageNode': {
            const payload = await buildMessagePayload(node, stateData, incomingMessage);
            if (payload) await sendWA(user, phoneNumberId, contactPhone, payload);
            return { nextEdges: getNexts(), stateData };
        }

        // ── Delay node ─────────────────────────────────────────────────────
        case 'delayNode': {
            const amount = parseInt(node.data?.amount || 1);
            const unit = node.data?.unit || 'seconds';
            const ms = unit === 'minutes' ? amount * 60000 : unit === 'hours' ? amount * 3600000 : amount * 1000;
            if (ms < 30000) await new Promise(r => setTimeout(r, ms)); // Only wait for short delays inline
            return { nextEdges: getNexts(), stateData };
        }

        // ── Condition / If-Else node ───────────────────────────────────────
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
                    case 'not_equals':  return field !== val;
                    case 'starts_with': return field.startsWith(val);
                    case 'ends_with':   return field.endsWith(val);
                    default:            return field.includes(val);
                }
            });

            const passed = logicType === 'AND' ? results.every(Boolean) : results.some(Boolean);
            const branch = passed ? 'true' : 'false';
            const nextEdges = edges.filter(e => e.source === nodeId && (e.sourceHandle === branch || e.label === branch));
            return { nextEdges: nextEdges.length ? nextEdges : getNexts(), stateData };
        }

        // ── Switch / Multi-branch node ────────────────────────────────────
        case 'switchNode': {
            const field = node.data?.field || 'message';
            const value = (stateData?.[field] || incomingMessage || '').toLowerCase().trim();
            const cases = node.data?.cases || [];
            const matchedCase = cases.find(c => value === c.value?.toLowerCase()?.trim());
            const handle = matchedCase?.value || 'default';
            const nextEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === handle);
            return { nextEdges: nextEdges.length ? nextEdges : getNexts(), stateData };
        }

        // ── Random Split / A-B test node ──────────────────────────────────
        case 'randomSplitNode': {
            const splits = node.data?.splits || [{ label: 'A', percentage: 50 }];
            const rand = Math.random() * 100;
            let cumulative = 0;
            let chosen = splits[splits.length - 1];
            for (const split of splits) {
                cumulative += (split.percentage || 0);
                if (rand <= cumulative) { chosen = split; break; }
            }
            const nextEdges = edges.filter(e => e.source === nodeId && e.sourceHandle === chosen.label);
            return { nextEdges: nextEdges.length ? nextEdges : getNexts(), stateData };
        }

        // ── Save Variable node ─────────────────────────────────────────────
        case 'saveVariableNode': {
            const varName = node.data?.variableName;
            const source = node.data?.source || 'lastMessage';
            if (varName) {
                const newState = { ...stateData };
                if (source === 'lastMessage') newState[varName] = incomingMessage;
                else newState[varName] = node.data?.value || '';
                return { nextEdges: getNexts(), stateData: newState };
            }
            return { nextEdges: getNexts(), stateData };
        }

        // ── Add/Remove Tag nodes ───────────────────────────────────────────
        case 'addTagNode':
        case 'removeTagNode': {
            const tags = node.data?.tags || [];
            if (tags.length) {
                try {
                    const contact = await prisma.contact.findFirst({
                        where: { userId: user.id, phone: contactPhone }
                    });
                    if (contact) {
                        const currentTags = contact.tags || [];
                        const newTags = node.type === 'addTagNode'
                            ? [...new Set([...currentTags, ...tags])]
                            : currentTags.filter(t => !tags.includes(t));
                        await prisma.contact.update({ where: { id: contact.id }, data: { tags: newTags } });
                    }
                } catch (e) { console.error('[FlowEngine] Tag update error:', e.message); }
            }
            return { nextEdges: getNexts(), stateData };
        }

        // ── Update Contact node ────────────────────────────────────────────
        case 'updateContactNode': {
            const fields = node.data?.fields || [];
            if (fields.length) {
                try {
                    const updateData = {};
                    fields.forEach(f => { if (f.key && f.value) updateData[f.key] = f.value; });
                    await prisma.contact.updateMany({
                        where: { userId: user.id, phone: contactPhone },
                        data: updateData
                    });
                } catch (e) { console.error('[FlowEngine] Contact update error:', e.message); }
            }
            return { nextEdges: getNexts(), stateData };
        }

        // ── API Request node ───────────────────────────────────────────────
        case 'apiRequestNode': {
            const reqUrl = node.data?.url;
            if (reqUrl) {
                try {
                    const headers = {};
                    (node.data?.headers || []).forEach(h => { if (h.key) headers[h.key] = h.value; });
                    const body = node.data?.body ? JSON.parse(node.data.body) : undefined;
                    const method = (node.data?.method || 'POST').toLowerCase();
                    const apiRes = await axios({ method, url: reqUrl, headers, data: body, timeout: 15000 });
                    
                    if (node.data?.saveResponse && node.data?.responseVariable) {
                        const newState = { ...stateData, [node.data.responseVariable]: JSON.stringify(apiRes.data) };
                        return { nextEdges: getNexts(), stateData: newState };
                    }
                } catch (e) { console.error('[FlowEngine] API Request error:', e.message); }
            }
            return { nextEdges: getNexts(), stateData };
        }

        // ── AI Reply Node ───────────────────────────────────────────────────
        case 'aiReplyNode': {
            const provider = node.data?.provider || 'openai';
            const model = node.data?.model || 'gpt-4o-mini';
            let prompt = node.data?.prompt || 'You are a helpful assistant.';
            Object.entries(stateData || {}).forEach(([k, v]) => {
                prompt = prompt.replace(new RegExp(`{{${k}}}`, 'g'), v);
            });
            const temperature = parseFloat(node.data?.temperature || 0.7);

            let aiResponseText = 'AI is currently unavailable.';
            try {
                if (!user.aiApiKey) {
                    aiResponseText = 'AI API key is not configured in settings.';
                } else if (provider === 'openai') {
                    const aiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
                        model,
                        temperature,
                        messages: [
                            { role: 'system', content: prompt },
                            { role: 'user', content: incomingMessage }
                        ]
                    }, {
                        headers: { Authorization: `Bearer ${user.aiApiKey}` },
                        timeout: 15000
                    });
                    aiResponseText = aiRes.data.choices[0].message.content;
                } else if (provider === 'gemini') {
                    const aiRes = await axios.post(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${user.aiApiKey}`,
                        {
                            contents: [{ parts: [{ text: `System: ${prompt}\n\nUser: ${incomingMessage}` }] }],
                            generationConfig: { temperature }
                        },
                        { timeout: 15000 }
                    );
                    aiResponseText = aiRes.data.candidates[0].content.parts[0].text;
                } else if (provider === 'groq') {
                    const aiRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                        model,
                        temperature,
                        messages: [
                            { role: 'system', content: prompt },
                            { role: 'user', content: incomingMessage }
                        ]
                    }, {
                        headers: { Authorization: `Bearer ${user.aiApiKey}` },
                        timeout: 15000
                    });
                    aiResponseText = aiRes.data.choices[0].message.content;
                }
            } catch (e) {
                console.error('[FlowEngine] AI Inference Error:', e.response?.data || e.message);
                aiResponseText = 'Sorry, the AI encountered an error.';
            }

            await sendWA(user, phoneNumberId, contactPhone, { type: 'text', text: { body: aiResponseText } });
            return { nextEdges: getNexts(), stateData };
        }

        // ── Human Handover node ────────────────────────────────────────────
        case 'humanHandoverNode': {
            const msg = node.data?.message || 'Connecting you to a human agent...';
            await sendWA(user, phoneNumberId, contactPhone, { type: 'text', text: { body: msg } });
            // Pause bot for this contact for 24 hours
            try {
                await prisma.contact.updateMany({
                    where: { userId: user.id, phone: contactPhone },
                    data: { bot_paused_until: new Date(Date.now() + 86400000) }
                });
            } catch (e) {}
            return { nextEdges: [], stateData, done: true };  // Stop flow
        }

        // ── End Conversation node ──────────────────────────────────────────
        case 'endConversationNode': {
            const msg = node.data?.message;
            if (msg) await sendWA(user, phoneNumberId, contactPhone, { type: 'text', text: { body: msg } });
            return { nextEdges: [], stateData, done: true };
        }

        // ── Wait Reply node (pause & store session) ────────────────────────
        case 'waitReplyNode': {
            return { nextEdges: [], stateData, waitReply: true, currentNodeId: nodeId };
        }

        // ── Unknown — pass through ─────────────────────────────────────────
        default:
            console.warn(`[FlowEngine] Unknown node type: ${node.type}`);
            return { nextEdges: getNexts(), stateData };
    }
}

// ─── Main Flow Execution ──────────────────────────────────────────────────────
class FlowEngine {

    // ─── Resume a paused session ─────────────────────────────────────────────
    static async resumeSessionIfActive(user, phoneNumberId, contactPhone, messageBody) {
        const session = await prisma.flowSession.findUnique({
            where: { userId_contactPhone: { userId: user.id, contactPhone } }
        });

        if (!session || session.status !== 'WAITING_REPLY') return false;

        const flow = await prisma.visualFlow.findUnique({ where: { id: session.flowId } });
        if (!flow || !flow.isActive) {
            await this.completeSession(session.id);
            return false;
        }

        await this.executeFlow(flow, session, messageBody, contactPhone, user, phoneNumberId);
        return true;
    }

    // ─── Start flow matching a specific keyword trigger ──────────────────────
    static async startSpecificFlowIfMatched(user, phoneNumberId, contactPhone, messageBody, isNewContact = false) {
        const activeFlows = await prisma.visualFlow.findMany({
            where: { userId: user.id, isActive: true }
        });

        let matchedFlow = null;
        for (const flow of activeFlows) {
            if (!flow.trigger || flow.trigger === 'ALL_MESSAGES') continue;

            const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
            if (matchesTrigger(messageBody, flow, nodes, isNewContact)) {
                matchedFlow = flow;
                break;
            }
        }

        if (matchedFlow) {
            await this.executeFlow(matchedFlow, null, messageBody, contactPhone, user, phoneNumberId);
            return true;
        }
        return false;
    }

    // ─── Start ALL_MESSAGES fallback flow ────────────────────────────────────
    static async startAllMessagesFlow(user, phoneNumberId, contactPhone, messageBody, isNewContact = false) {
        const allMsgFlows = await prisma.visualFlow.findMany({
            where: { userId: user.id, isActive: true, trigger: 'ALL_MESSAGES' }
        });

        for (const flow of allMsgFlows) {
            const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
            const triggerNode = (nodes || []).find(n => n.type?.toLowerCase().includes('trigger'));

            if (triggerNode?.type === 'newMessageTriggerNode' && !isNewContact) continue;

            if (triggerNode?.type === 'scheduleTriggerNode') {
                const { startTime, endTime } = triggerNode.data || {};
                const now = new Date();
                if (startTime && now < new Date(startTime)) continue;
                if (endTime && now > new Date(endTime)) continue;
            }

            await this.executeFlow(flow, null, messageBody, contactPhone, user, phoneNumberId);
            return true;
        }
        return false;
    }

    // ─── Core execution loop ─────────────────────────────────────────────────
    static async executeFlow(flow, session, incomingMessage, contactPhone, user, phoneNumberId) {
        const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
        const edges = typeof flow.edges === 'string' ? JSON.parse(flow.edges) : (flow.edges || []);

        const startTime = Date.now();
        const executionSteps = [];

        let queue = [];
        let stateData = session
            ? (typeof session.stateData === 'string' ? JSON.parse(session.stateData) : session.stateData) || {}
            : {};

        if (session) {
            // Resume from after the waitReply node
            const waitNodeId = session.currentNodeId;
            const nextEdges = edges.filter(e => e.source === waitNodeId);
            if (!nextEdges.length) { await this.completeSession(session.id); return; }
            queue = nextEdges.map(e => e.target);
            stateData.lastMessage = incomingMessage;
        } else {
            // Find trigger node — handle ALL node types that contain 'trigger' in type name
            const triggerNode = nodes.find(n => n.type?.toLowerCase().includes('trigger'));
            if (!triggerNode) {
                console.warn(`[FlowEngine] No trigger node found in flow: ${flow.name} (${flow.id})`);
                return;
            }
            queue.push(triggerNode.id);
            stateData.lastMessage = incomingMessage;
            stateData.contactPhone = contactPhone;
        }

        let safety = 0;
        while (queue.length > 0 && safety < 100) {
            safety++;
            const currentNodeId = queue.shift();
            const node = nodes.find(n => n.id === currentNodeId);
            if (!node) continue;

            const step = { nodeId: node.id, type: node.type, ts: Date.now() };

            try {
                const result = await executeNode(
                    node, edges, user, phoneNumberId, contactPhone,
                    incomingMessage, stateData, flow.id
                );

                step.status = 'ok';
                stateData = result.stateData || stateData;
                executionSteps.push(step);

                if (result.waitReply) {
                    // Pause execution — save session (Note: waitReply will pause this entire flow branch)
                    await this.upsertSession(flow.id, user.id, contactPhone, result.currentNodeId, stateData);
                    continue; // Other branches can still execute if they are in the queue
                }

                if (result.done) {
                    // This branch ended
                    if (session && queue.length === 0) await this.completeSession(session.id);
                    continue;
                }

                if (result.nextEdges && result.nextEdges.length > 0) {
                    // Queue all outgoing edges (this allows parallel paths from a single node)
                    result.nextEdges.forEach(edge => queue.push(edge.target));
                } else if (result.nextEdge) {
                    queue.push(result.nextEdge.target);
                } else {
                    if (session && queue.length === 0) await this.completeSession(session.id);
                }
            } catch (err) {
                step.status = 'error';
                step.error = err.message;
                executionSteps.push(step);
                console.error(`[FlowEngine] Node ${node.type} error:`, err.message);
            }
        }

        // Store execution log
        try {
            await prisma.flowExecution.create({
                data: {
                    userId: user.id,
                    flowId: flow.id,
                    contactPhone,
                    trigger: incomingMessage || '',
                    status: executionSteps.some(s => s.status === 'error') ? 'FAILED' : 'COMPLETED',
                    steps: executionSteps,
                    durationMs: Date.now() - startTime,
                }
            });
        } catch (e) {
            // If FlowExecution table doesn't exist yet, silently skip
            if (!e.message?.includes('does not exist')) {
                console.warn('[FlowEngine] Execution log failed:', e.message);
            }
        }
    }

    // ─── TEST mode — simulate flow without sending real messages ─────────────
    static async testFlow(flow, testMessage, user) {
        const nodes = typeof flow.nodes === 'string' ? JSON.parse(flow.nodes) : (flow.nodes || []);
        const edges = typeof flow.edges === 'string' ? JSON.parse(flow.edges) : (flow.edges || []);

        const steps = [];
        const simulatedResponses = [];

        // Check trigger match
        const triggerNode = nodes.find(n => n.type?.toLowerCase().includes('trigger'));
        if (!triggerNode) {
            return { matched: false, error: 'No trigger node found in this flow.', steps: [], responses: [] };
        }

        const matches = matchesTrigger(testMessage, flow, nodes);
        steps.push({
            nodeId: triggerNode.id,
            type: triggerNode.type,
            label: triggerNode.data?.label || 'Trigger',
            status: matches ? 'matched' : 'not_matched',
            detail: matches ? `Keyword matched: "${triggerNode.data?.keyword || flow.trigger}"` : `Message "${testMessage}" did not match trigger`
        });

        if (!matches) {
            return { matched: false, steps, responses: [] };
        }

        // Walk the graph using queue for parallel edges
        let queue = [triggerNode.id];
        let safety = 0;

        const getNexts = (nodeId, handle) => edges.filter(e => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle));

        while (queue.length > 0 && safety < 50) {
            safety++;
            const currentNodeId = queue.shift();
            const node = nodes.find(n => n.id === currentNodeId);
            if (!node) continue;

            // Skip trigger node (already logged)
            if (node.type?.toLowerCase().includes('trigger')) {
                const nextEdges = getNexts(node.id);
                nextEdges.forEach(e => queue.push(e.target));
                continue;
            }

            const step = {
                nodeId: node.id,
                type: node.type,
                label: node.data?.label || node.type,
                status: 'executed'
            };

            // Simulate node execution
            if (['sendTextNode', 'sendImageNode', 'sendVideoNode', 'sendAudioNode', 'sendDocumentNode', 'sendButtonsNode', 'sendListNode', 'sendTemplateNode'].includes(node.type)) {
                let preview = '';
                if (node.type === 'sendTextNode') preview = node.data?.message || '';
                else if (node.type === 'sendImageNode') preview = `[Image] ${node.data?.caption || ''}`;
                else if (node.type === 'sendVideoNode') preview = `[Video] ${node.data?.caption || ''}`;
                else if (node.type === 'sendAudioNode') preview = '[Audio File]';
                else if (node.type === 'sendDocumentNode') preview = `[Document] ${node.data?.filename || ''}`;
                else if (node.type === 'sendButtonsNode') preview = `[Buttons] ${node.data?.body || ''}`;
                else if (node.type === 'sendListNode') preview = `[List] ${node.data?.body || ''}`;
                else if (node.type === 'sendTemplateNode') preview = `[Template] ${node.data?.templateName || ''}`;

                step.detail = preview;
                simulatedResponses.push({ type: node.type, preview, nodeId: node.id });
                const nextEdges = getNexts(node.id);
                step.nextNodeId = nextEdges.map(e => e.target).join(', ');
                steps.push(step);
                nextEdges.forEach(e => queue.push(e.target));
            } else if (node.type === 'conditionNode') {
                const conditions = node.data?.conditions || [];
                step.detail = `Condition: checking ${conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(', ')}`;
                let nextEdges = getNexts(node.id, 'true');
                if (!nextEdges.length) nextEdges = getNexts(node.id);
                step.nextNodeId = nextEdges.map(e => e.target).join(', ');
                steps.push(step);
                nextEdges.forEach(e => queue.push(e.target));
            } else if (node.type === 'delayNode') {
                step.detail = `Delay: ${node.data?.amount} ${node.data?.unit}`;
                const nextEdges = getNexts(node.id);
                step.nextNodeId = nextEdges.map(e => e.target).join(', ');
                steps.push(step);
                nextEdges.forEach(e => queue.push(e.target));
            } else if (node.type === 'waitReplyNode') {
                step.detail = 'Flow pauses here waiting for user reply';
                step.status = 'waiting';
                steps.push(step);
                continue;
            } else if (node.type === 'humanHandoverNode') {
                step.detail = 'Bot paused — transferred to human agent';
                step.status = 'handover';
                steps.push(step);
                continue;
            } else {
                step.detail = `${node.type} executed`;
                const nextEdges = getNexts(node.id);
                step.nextNodeId = nextEdges.map(e => e.target).join(', ');
                steps.push(step);
                nextEdges.forEach(e => queue.push(e.target));
            }
        }

        return { matched: true, steps, responses: simulatedResponses };
    }

    static async upsertSession(flowId, userId, contactPhone, currentNodeId, stateData) {
        await prisma.flowSession.upsert({
            where: { userId_contactPhone: { userId, contactPhone } },
            update: { flowId, currentNodeId, stateData, status: 'WAITING_REPLY', updatedAt: new Date() },
            create: { userId, contactPhone, flowId, currentNodeId, stateData, status: 'WAITING_REPLY' }
        });
    }

    static async completeSession(sessionId) {
        await prisma.flowSession.delete({ where: { id: sessionId } }).catch(() => {});
    }
}

module.exports = FlowEngine;
