import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { motion } from 'framer-motion';
import { Trash2, Copy, Settings } from 'lucide-react';
import { NODE_TYPE_MAP, CATEGORY_COLORS } from '../constants/nodeDefinitions';
import useFlowStore from '../store/flowStore';

// Base node wrapper shared by all node types
export const BaseNode = memo(({ id, type, data, selected, children, sourceHandles = 1, showTarget = true }) => {
  const nodeDef = NODE_TYPE_MAP[type];
  const category = nodeDef?.category || 'messages';
  const colors = CATEGORY_COLORS[category];
  const Icon = nodeDef?.icon;
  const { deleteNode, duplicateNode, setSelectedNode } = useFlowStore();

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="group"
      style={{
        minWidth: 260,
        maxWidth: 320,
        background: '#ffffff',
        border: selected ? `2px solid ${colors.border}` : `1px solid #e2e8f0`,
        borderLeft: `6px solid ${colors.border}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 3px ${colors.border}20, 0 8px 30px rgba(0,0,0,0.12)`
          : '0 2px 10px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
        overflow: 'visible',
      }}
    >
      {/* Target handle */}
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ width: 14, height: 14, background: '#ffffff', border: `2px solid ${colors.border}`, left: -10 }}
        />
      )}

      {/* Header */}
      <div
        style={{
          padding: '12px 14px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: colors.border, display: 'flex', alignItems: 'center', background: `${colors.border}15`, padding: 6, borderRadius: 6 }}>
            {Icon && <Icon size={18} />}
          </div>
          <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {data?.label || nodeDef?.label || type}
          </span>
        </div>

        {/* Action buttons (visible on hover/select) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
            style={{ color: '#94a3b8', padding: 3, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Duplicate"
          >
            <Copy size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
            style={{ color: '#f43f5e', padding: 3, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>{children}</div>

      {/* Source handle(s) */}
      {sourceHandles === 1 && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ width: 14, height: 14, background: '#ffffff', border: `2px solid ${colors.border}`, right: -8 }}
        />
      )}
      {sourceHandles === 'true-false' && (
        <>
          <Handle type="source" id="true" position={Position.Right} style={{ width: 14, height: 14, background: '#ffffff', border: '2px solid #10b981', right: -8, top: '35%' }} />
          <Handle type="source" id="false" position={Position.Right} style={{ width: 14, height: 14, background: '#ffffff', border: '2px solid #f43f5e', right: -8, top: '65%' }} />
        </>
      )}
    </motion.div>
  );
});

// ── Shared label style ────────────────────────────────────────────────
const label = { fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };
const preview = { fontSize: 13, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f1f5f9', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0' };
const badge = (color) => ({
  display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
  borderRadius: 4, fontSize: 10, fontWeight: 600,
  background: `${color}15`, color: color, border: `1px solid ${color}30`,
});

// ─── TRIGGER NODES ───────────────────────────────────────────────────
export const KeywordTriggerNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="keywordTriggerNode" data={data} selected={selected} showTarget={false}>
    <span style={label}>Trigger Keyword</span>
    <div style={{ ...preview, color: '#fbbf24', fontWeight: 600 }}>
      {data?.keyword || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Set keyword...</span>}
    </div>
    {data?.matchType && (
      <div style={{ marginTop: 6 }}>
        <span style={badge('#f59e0b')}>{data.matchType}</span>
      </div>
    )}
  </BaseNode>
));

export const WebhookTriggerNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="webhookTriggerNode" data={data} selected={selected} showTarget={false}>
    <span style={label}>Webhook Path</span>
    <div style={{ ...preview, fontFamily: 'monospace', color: '#7dd3fc', fontSize: 11 }}>
      {data?.path || '/webhook'}
    </div>
  </BaseNode>
));

export const ScheduleTriggerNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="scheduleTriggerNode" data={data} selected={selected} showTarget={false}>
    <span style={label}>Schedule (Cron)</span>
    <div style={{ ...preview, fontFamily: 'monospace', color: '#a78bfa' }}>{data?.cron || '0 9 * * *'}</div>
    <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>{data?.timezone || 'Asia/Kolkata'}</div>
  </BaseNode>
));

export const NewMessageTriggerNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="newMessageTriggerNode" data={data} selected={selected} showTarget={false}>
    <div style={{ ...preview, color: '#94a3b8' }}>Triggers on every incoming message</div>
  </BaseNode>
));

// ─── MESSAGE NODES ───────────────────────────────────────────────────
export const SendTextNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendTextNode" data={data} selected={selected}>
    <span style={label}>Message</span>
    <div style={{ ...preview, background: 'rgba(59,130,246,0.06)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.1)' }}>
      {data?.message || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Click to edit message...</span>}
    </div>
  </BaseNode>
));

export const SendImageNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendImageNode" data={data} selected={selected}>
    {data?.imageUrl ? (
      <img src={data.imageUrl} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 80, objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
    ) : (
      <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 8, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(59,130,246,0.2)', color: '#64748b', fontSize: 11 }}>
        No image URL set
      </div>
    )}
    {data?.caption && <div style={{ ...preview, marginTop: 6, color: '#94a3b8' }}>{data.caption}</div>}
  </BaseNode>
));

export const SendVideoNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendVideoNode" data={data} selected={selected}>
    <span style={label}>Video URL</span>
    <div style={{ ...preview, color: '#60a5fa', wordBreak: 'break-all', fontSize: 11 }}>{data?.videoUrl || <span style={{ color: '#64748b', fontStyle: 'italic' }}>No URL set</span>}</div>
  </BaseNode>
));

export const SendAudioNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendAudioNode" data={data} selected={selected}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(59,130,246,0.2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: '60%', height: '100%', background: '#3b82f6', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748b' }}>Audio</span>
    </div>
  </BaseNode>
));

export const SendDocumentNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendDocumentNode" data={data} selected={selected}>
    <span style={label}>Document</span>
    <div style={{ ...preview, color: '#60a5fa', fontSize: 11 }}>{data?.filename || data?.documentUrl || <span style={{ color: '#64748b', fontStyle: 'italic' }}>No document set</span>}</div>
  </BaseNode>
));

export const SendButtonsNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendButtonsNode" data={data} selected={selected}>
    <div style={{ ...preview, marginBottom: 8 }}>{data?.body || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Button message...</span>}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(data?.buttons || []).map((btn, i) => (
        <div key={i} style={{ padding: '5px 10px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', fontSize: 11, color: '#60a5fa', textAlign: 'center' }}>
          {btn.title}
        </div>
      ))}
    </div>
  </BaseNode>
));

export const SendListNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendListNode" data={data} selected={selected}>
    <div style={{ ...preview, marginBottom: 6 }}>{data?.body || <span style={{ color: '#64748b', fontStyle: 'italic' }}>List message...</span>}</div>
    <div style={{ padding: '5px 10px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', fontSize: 11, color: '#60a5fa', textAlign: 'center' }}>
      {data?.buttonText || 'Choose option'}
    </div>
  </BaseNode>
));

export const SendTemplateNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="sendTemplateNode" data={data} selected={selected}>
    <span style={label}>Template Name</span>
    <div style={{ ...preview, color: '#60a5fa', fontWeight: 600 }}>{data?.templateName || <span style={{ color: '#64748b', fontStyle: 'italic', fontWeight: 400 }}>Select template...</span>}</div>
    {data?.language && <div style={{ marginTop: 4 }}><span style={badge('#3b82f6')}>{data.language}</span></div>}
  </BaseNode>
));

// ─── LOGIC NODES ─────────────────────────────────────────────────────
export const ConditionNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="conditionNode" data={data} selected={selected} sourceHandles="true-false">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(data?.conditions || [{ field: 'message', operator: 'contains', value: '' }]).map((c, i) => (
        <div key={i} style={{ padding: '6px 8px', background: 'rgba(168,85,247,0.06)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.15)', fontSize: 11 }}>
          <span style={{ color: '#c084fc' }}>{c.field}</span>
          <span style={{ color: '#64748b', margin: '0 4px' }}>{c.operator}</span>
          <span style={{ color: '#e2e8f0' }}>"{c.value || '...'}"</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>✓ True →</span>
        <span style={{ fontSize: 10, color: '#f43f5e', fontWeight: 600 }}>✗ False →</span>
      </div>
    </div>
  </BaseNode>
));

export const SwitchNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="switchNode" data={data} selected={selected} sourceHandles={0}>
    <span style={label}>Switch on: <span style={{ color: '#c084fc' }}>{data?.field || 'message'}</span></span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {(data?.cases || []).map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#e2e8f0', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: 6 }}>{c.value}</span>
          <Handle type="source" id={`case-${i}`} position={Position.Right} style={{ width: 10, height: 10, background: '#a855f7', border: '2px solid #0f172a', right: -20, top: undefined, position: 'relative' }} />
        </div>
      ))}
    </div>
  </BaseNode>
));

export const DelayNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="delayNode" data={data} selected={selected}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '8px 0' }}>
      <span style={{ fontSize: 24, color: '#c084fc' }}>⏳</span>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>{data?.amount || 5}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{data?.unit || 'seconds'}</div>
      </div>
    </div>
  </BaseNode>
));

export const RandomSplitNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="randomSplitNode" data={data} selected={selected} sourceHandles={0}>
    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
      {(data?.splits || []).map((s, i) => (
        <div key={i} style={{ flex: 1, padding: '6px 4px', background: 'rgba(168,85,247,0.1)', borderRadius: 8, textAlign: 'center', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc' }}>{s.percentage}%</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
          <Handle type="source" id={`split-${i}`} position={Position.Right} style={{ width: 10, height: 10, background: '#a855f7', border: '2px solid #0f172a', right: -20, position: 'relative', top: undefined }} />
        </div>
      ))}
    </div>
  </BaseNode>
));

export const GoToFlowNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="goToFlowNode" data={data} selected={selected}>
    <span style={label}>Target Flow</span>
    <div style={{ ...preview, color: '#c084fc', fontWeight: 600 }}>{data?.targetFlowName || <span style={{ color: '#64748b', fontStyle: 'italic', fontWeight: 400 }}>Select flow...</span>}</div>
  </BaseNode>
));

// ─── ACTION NODES ────────────────────────────────────────────────────
export const AddTagNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="addTagNode" data={data} selected={selected}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {(data?.tags || []).map((t, i) => (
        <span key={i} style={badge('#10b981')}>{t}</span>
      ))}
      {(!data?.tags || data.tags.length === 0) && <span style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>No tags set</span>}
    </div>
  </BaseNode>
));

export const RemoveTagNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="removeTagNode" data={data} selected={selected}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {(data?.tags || []).map((t, i) => (
        <span key={i} style={badge('#f43f5e')}>{t}</span>
      ))}
      {(!data?.tags || data.tags.length === 0) && <span style={{ color: '#64748b', fontSize: 11, fontStyle: 'italic' }}>No tags set</span>}
    </div>
  </BaseNode>
));

export const SaveVariableNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="saveVariableNode" data={data} selected={selected}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ ...badge('#10b981'), fontFamily: 'monospace' }}>{data?.variableName || 'variable'}</span>
      <span style={{ color: '#64748b', fontSize: 12 }}>←</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{data?.source || 'lastMessage'}</span>
    </div>
  </BaseNode>
));

export const UpdateContactNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="updateContactNode" data={data} selected={selected}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {(data?.fields || []).map((f, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11 }}>
          <span style={{ color: '#34d399', fontWeight: 600 }}>{f.key}</span>
          <span style={{ color: '#64748b' }}>=</span>
          <span style={{ color: '#e2e8f0' }}>{f.value || '...'}</span>
        </div>
      ))}
    </div>
  </BaseNode>
));

export const AssignAgentNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="assignAgentNode" data={data} selected={selected}>
    <div style={{ ...preview, color: '#34d399' }}>{data?.agentId ? `Agent: ${data.agentId}` : <span style={{ color: '#64748b', fontStyle: 'italic' }}>No agent selected</span>}</div>
  </BaseNode>
));

export const ApiRequestNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="apiRequestNode" data={data} selected={selected}>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <span style={badge(data?.method === 'GET' ? '#10b981' : data?.method === 'POST' ? '#3b82f6' : '#f59e0b')}>{data?.method || 'POST'}</span>
    </div>
    <div style={{ ...preview, fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>{data?.url || <span style={{ fontStyle: 'italic', color: '#64748b' }}>https://api.example.com/...</span>}</div>
    {data?.saveResponse && data?.responseVariable && (
      <div style={{ marginTop: 6 }}><span style={badge('#10b981')}>→ {data.responseVariable}</span></div>
    )}
  </BaseNode>
));

// ─── AI NODES ────────────────────────────────────────────────────────
export const AiReplyNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="aiReplyNode" data={data} selected={selected}>
    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
      <span style={badge('#7c3aed')}>{data?.provider || 'openai'}</span>
      <span style={badge('#6d28d9')}>{data?.model || 'gpt-4o-mini'}</span>
    </div>
    <div style={{ ...preview, fontSize: 11, color: '#94a3b8' }}>
      {data?.prompt ? data.prompt.substring(0, 80) + (data.prompt.length > 80 ? '...' : '') : <span style={{ fontStyle: 'italic', color: '#64748b' }}>No prompt set</span>}
    </div>
  </BaseNode>
));

export const GptPromptNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="gptPromptNode" data={data} selected={selected}>
    <span style={badge('#7c3aed')}>{data?.model || 'gpt-4o'}</span>
    <div style={{ ...preview, marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
      {data?.userPrompt ? data.userPrompt.substring(0, 80) + (data.userPrompt.length > 80 ? '...' : '') : <span style={{ fontStyle: 'italic', color: '#64748b' }}>No prompt set</span>}
    </div>
    {data?.saveOutput && <div style={{ marginTop: 6 }}><span style={badge('#5b21b6')}>→ {data.saveOutput}</span></div>}
  </BaseNode>
));

export const KnowledgeBaseNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="knowledgeBaseNode" data={data} selected={selected}>
    <div style={{ fontSize: 11, color: '#94a3b8' }}>
      {data?.documentIds?.length ? `${data.documentIds.length} document(s) linked` : <span style={{ fontStyle: 'italic', color: '#64748b' }}>No documents selected</span>}
    </div>
  </BaseNode>
));

// ─── HUMAN SUPPORT NODES ─────────────────────────────────────────────
export const HumanHandoverNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="humanHandoverNode" data={data} selected={selected}>
    <div style={{ ...preview, color: '#fb7185' }}>{data?.message || 'Connecting you to an agent...'}</div>
    {data?.pauseBot && <div style={{ marginTop: 6 }}><span style={badge('#f43f5e')}>🤖 Bot Paused</span></div>}
  </BaseNode>
));

export const NotifyAgentNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="notifyAgentNode" data={data} selected={selected}>
    <span style={label}>Channel: <span style={{ color: '#fb7185' }}>{data?.channel || 'email'}</span></span>
    <div style={{ ...preview, fontSize: 11, color: '#94a3b8' }}>{data?.message || 'Notification message...'}</div>
  </BaseNode>
));

export const EndConversationNode = memo(({ id, data, selected }) => (
  <BaseNode id={id} type="endConversationNode" data={data} selected={selected} sourceHandles={0}>
    <div style={{ ...preview, color: '#94a3b8' }}>{data?.message || 'Thank you! Have a great day.'}</div>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 11, color: '#f43f5e', fontWeight: 600, letterSpacing: '0.05em' }}>⬛ FLOW ENDS</span>
    </div>
  </BaseNode>
));

// ─── NODE TYPE MAP ───────────────────────────────────────────────────
export const customNodeTypes = {
  keywordTriggerNode: KeywordTriggerNode,
  webhookTriggerNode: WebhookTriggerNode,
  scheduleTriggerNode: ScheduleTriggerNode,
  newMessageTriggerNode: NewMessageTriggerNode,
  sendTextNode: SendTextNode,
  sendImageNode: SendImageNode,
  sendVideoNode: SendVideoNode,
  sendAudioNode: SendAudioNode,
  sendDocumentNode: SendDocumentNode,
  sendButtonsNode: SendButtonsNode,
  sendListNode: SendListNode,
  sendTemplateNode: SendTemplateNode,
  conditionNode: ConditionNode,
  switchNode: SwitchNode,
  delayNode: DelayNode,
  randomSplitNode: RandomSplitNode,
  goToFlowNode: GoToFlowNode,
  addTagNode: AddTagNode,
  removeTagNode: RemoveTagNode,
  saveVariableNode: SaveVariableNode,
  updateContactNode: UpdateContactNode,
  assignAgentNode: AssignAgentNode,
  apiRequestNode: ApiRequestNode,
  aiReplyNode: AiReplyNode,
  gptPromptNode: GptPromptNode,
  knowledgeBaseNode: KnowledgeBaseNode,
  humanHandoverNode: HumanHandoverNode,
  notifyAgentNode: NotifyAgentNode,
  endConversationNode: EndConversationNode,
};
