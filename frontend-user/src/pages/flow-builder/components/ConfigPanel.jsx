import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import useFlowStore from '../store/flowStore';
import { NODE_TYPE_MAP } from '../constants/nodeDefinitions';
import axios from 'axios';

const inp = (isDark) => ({
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  background: isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc',
  border: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : '#e2e8f0'}`,
  color: isDark ? '#e2e8f0' : '#0f172a',
});
const lbl = (isDark) => ({ fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' });

// ── Reusable Fields ────────────────────────────────────────────────────
const Field = ({ label: l, children, isDark }) => (
  <div style={{ marginBottom: 12 }}>
    <span style={lbl(isDark)}>{l}</span>
    {children}
  </div>
);

const TextField = ({ label: l, value, onChange, placeholder, isDark, multiline, rows = 3 }) => (
  <Field label={l} isDark={isDark}>
    {multiline ? (
      <textarea rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inp(isDark), resize: 'vertical', lineHeight: 1.5 }} />
    ) : (
      <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inp(isDark)} />
    )}
  </Field>
);

const SelectField = ({ label: l, value, onChange, options, isDark }) => (
  <Field label={l} isDark={isDark}>
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ ...inp(isDark), cursor: 'pointer' }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
);

const MediaUploadField = ({ label: l, value, onChange, placeholder, isDark, accept, format }) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 10MB Limit
    if (file.size > 10 * 1024 * 1024) {
      alert(`File size exceeds the 10MB limit. Please upload a smaller file.`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await axios.post(`${apiUrl}/api/campaigns/upload`, formData);
      onChange(res.data.mediaUrl || res.data.mediaId || res.data.url);
    } catch (err) {
      console.error('Upload Error:', err.response?.data || err.message);
      alert(err.response?.data?.error || err.message || "Failed to upload file to Meta.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={l} isDark={isDark}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input 
          type="text" 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder={placeholder} 
          style={{ ...inp(isDark), flex: 1 }} 
        />
        <label 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            padding: '0 12px', height: '30px', 
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', 
            borderRadius: 8, color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            opacity: uploading ? 0.5 : 1, transition: 'all 0.2s'
          }}
          title={`Upload ${format || 'file'}`}
        >
          <input type="file" style={{ display: 'none' }} accept={accept} onChange={handleUpload} disabled={uploading} />
          {uploading ? '...' : 'Upload'}
        </label>
      </div>
    </Field>
  );
};

// ── Panel configs per node type ────────────────────────────────────────
const ConfigContent = ({ node, update, isDark, templates }) => {
  const d = node.data || {};
  const u = (key, val) => update({ [key]: val });
  const type = node.type;

  if (type === 'keywordTriggerNode') return (
    <>
      <TextField label="Trigger Keyword" value={d.keyword} onChange={(v) => u('keyword', v)} placeholder="e.g. hello, order, help" isDark={isDark} />
      <SelectField label="Match Type" value={d.matchType} onChange={(v) => u('matchType', v)} isDark={isDark}
        options={[{ value: 'exact', label: 'Exact Match' }, { value: 'contains', label: 'Contains' }, { value: 'startsWith', label: 'Starts With' }]} />
    </>
  );

  if (type === 'webhookTriggerNode') return (
    <>
      <TextField label="Webhook Path" value={d.path} onChange={(v) => u('path', v)} placeholder="/webhook/my-flow" isDark={isDark} />
      <TextField label="Secret Key (optional)" value={d.secret} onChange={(v) => u('secret', v)} placeholder="Verify token" isDark={isDark} />
    </>
  );

  if (type === 'scheduleTriggerNode') return (
    <>
      <TextField label="Cron Expression" value={d.cron} onChange={(v) => u('cron', v)} placeholder="0 9 * * *" isDark={isDark} />
      <TextField label="Timezone" value={d.timezone} onChange={(v) => u('timezone', v)} placeholder="Asia/Kolkata" isDark={isDark} />
      <Field label="Active From (Start Time)" isDark={isDark}>
        <input type="datetime-local" value={d.startTime || ''} onChange={(e) => u('startTime', e.target.value)} style={inp(isDark)} />
      </Field>
      <Field label="Active Until (End Time)" isDark={isDark}>
        <input type="datetime-local" value={d.endTime || ''} onChange={(e) => u('endTime', e.target.value)} style={inp(isDark)} />
      </Field>
      <div style={{ fontSize: 11, color: '#64748b', padding: '8px', background: isDark ? 'rgba(15,23,42,0.5)' : '#f1f5f9', borderRadius: 8, marginTop: 8 }}>
        Examples: <br />Daily 9am: <code>0 9 * * *</code><br />Every hour: <code>0 * * * *</code>
      </div>
    </>
  );

  if (type === 'sendTextNode') return (
    <>
      <TextField label="Message Text" value={d.message} onChange={(v) => u('message', v)} placeholder="Type your message..." isDark={isDark} multiline rows={4} />
      <div style={{ fontSize: 11, color: '#64748b', marginTop: -8, marginBottom: 12 }}>Use {'{{variable}}'} for dynamic values</div>
    </>
  );

  if (type === 'sendImageNode') return (
    <>
      <MediaUploadField label="Image URL or Upload" value={d.imageUrl} onChange={(v) => u('imageUrl', v)} placeholder="https://example.com/image.jpg" isDark={isDark} accept="image/*" format="Image" />
      <TextField label="Caption (optional)" value={d.caption} onChange={(v) => u('caption', v)} placeholder="Image caption..." isDark={isDark} multiline rows={2} />
    </>
  );

  if (type === 'sendVideoNode') return (
    <>
      <MediaUploadField label="Video URL or Upload" value={d.videoUrl} onChange={(v) => u('videoUrl', v)} placeholder="https://example.com/video.mp4" isDark={isDark} accept="video/*" format="Video" />
      <TextField label="Caption (optional)" value={d.caption} onChange={(v) => u('caption', v)} placeholder="Video caption..." isDark={isDark} multiline rows={2} />
    </>
  );

  if (type === 'sendAudioNode') return (
    <MediaUploadField label="Audio URL or Upload" value={d.audioUrl} onChange={(v) => u('audioUrl', v)} placeholder="https://example.com/audio.mp3" isDark={isDark} accept="audio/*" format="Audio" />
  );

  if (type === 'sendDocumentNode') return (
    <>
      <MediaUploadField label="Document URL or Upload" value={d.documentUrl} onChange={(v) => u('documentUrl', v)} placeholder="https://example.com/file.pdf" isDark={isDark} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" format="Document" />
      <TextField label="Filename" value={d.filename} onChange={(v) => u('filename', v)} placeholder="document.pdf" isDark={isDark} />
    </>
  );

  if (type === 'sendButtonsNode') return (
    <>
      <TextField label="Body Message" value={d.body} onChange={(v) => u('body', v)} placeholder="Choose an option:" isDark={isDark} multiline rows={3} />
      <Field label="Buttons (max 3)" isDark={isDark}>
        {(d.buttons || []).map((btn, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={btn.title} onChange={(e) => { const b = [...(d.buttons || [])]; b[i] = { ...b[i], title: e.target.value }; u('buttons', b); }}
              placeholder={`Button ${i + 1}`} style={{ ...inp(isDark), flex: 1 }} />
            {(d.buttons || []).length > 1 && (
              <button onClick={() => { const b = (d.buttons || []).filter((_, j) => j !== i); u('buttons', b); }}
                style={{ padding: '0 8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer' }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {(d.buttons || []).length < 3 && (
          <button onClick={() => u('buttons', [...(d.buttons || []), { id: `btn${Date.now()}`, title: '' }])}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.3)', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={12} /> Add Button
          </button>
        )}
      </Field>
    </>
  );

  if (type === 'sendListNode') return (
    <>
      <TextField label="Header (optional)" value={d.header} onChange={(v) => u('header', v)} placeholder="Main title" isDark={isDark} />
      <TextField label="Body Message" value={d.body} onChange={(v) => u('body', v)} placeholder="Please select from the list:" isDark={isDark} multiline rows={2} />
      <TextField label="Button Text" value={d.buttonText} onChange={(v) => u('buttonText', v)} placeholder="View Options" isDark={isDark} />
      
      <Field label="Sections & Rows" isDark={isDark}>
        {(d.sections || []).map((sec, i) => (
          <div key={i} style={{ background: isDark ? 'rgba(15,23,42,0.5)' : '#f1f5f9', borderRadius: 10, padding: 10, marginBottom: 8, border: `1px solid ${isDark ? 'rgba(51,65,85,0.4)' : '#e2e8f0'}` }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={sec.title} onChange={(e) => { const s = [...(d.sections || [])]; s[i] = { ...s[i], title: e.target.value }; u('sections', s); }}
                placeholder="Section Title" style={{ ...inp(isDark), flex: 1, fontWeight: 'bold' }} />
              <button onClick={() => u('sections', (d.sections || []).filter((_, j) => j !== i))}
                style={{ padding: '0 8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer' }}>
                <Trash2 size={12} />
              </button>
            </div>
            
            <div style={{ paddingLeft: 8, borderLeft: `2px solid ${isDark ? '#334155' : '#cbd5e1'}`, marginTop: 8 }}>
              {(sec.rows || []).map((row, r) => (
                <div key={r} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input value={row.title} onChange={(e) => { const s = [...(d.sections || [])]; s[i].rows[r] = { ...row, title: e.target.value }; u('sections', s); }}
                      placeholder="Row Title" style={inp(isDark)} />
                    <input value={row.description || ''} onChange={(e) => { const s = [...(d.sections || [])]; s[i].rows[r] = { ...row, description: e.target.value }; u('sections', s); }}
                      placeholder="Description (optional)" style={{...inp(isDark), fontSize: 10}} />
                  </div>
                  <button onClick={() => { const s = [...(d.sections || [])]; s[i].rows = s[i].rows.filter((_, k) => k !== r); u('sections', s); }}
                    style={{ padding: '0 8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => { const s = [...(d.sections || [])]; s[i].rows = [...(s[i].rows || []), { id: `row${Date.now()}`, title: '', description: '' }]; u('sections', s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 10, background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.3)', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', marginTop: 4 }}>
                <Plus size={10} /> Add Row
              </button>
            </div>
          </div>
        ))}
        <button onClick={() => u('sections', [...(d.sections || []), { title: 'New Section', rows: [{ id: `row${Date.now()}`, title: '', description: '' }] }])}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: 8, color: '#34d399', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={12} /> Add Section
        </button>
      </Field>
    </>
  );

  if (type === 'sendTemplateNode') return (
    <>
      <SelectField label="Template Name" value={d.templateName} onChange={(v) => {
        const t = templates.find(temp => temp.name === v);
        if (t) {
           u('templateName', t.name);
           u('language', t.language);
        } else {
           u('templateName', v);
        }
      }} isDark={isDark} options={[
        { value: '', label: 'Select template...' },
        ...templates.map(t => ({ value: t.name, label: `${t.name} (${t.language})` }))
      ]} />
      <SelectField label="Language" value={d.language} onChange={(v) => u('language', v)} isDark={isDark}
        options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'en_US', label: 'English (US)' }]} />
    </>
  );

  if (type === 'conditionNode') return (
    <>
      <SelectField label="Logic Type" value={d.logicType} onChange={(v) => u('logicType', v)} isDark={isDark}
        options={[{ value: 'AND', label: 'ALL conditions (AND)' }, { value: 'OR', label: 'ANY condition (OR)' }]} />
      <Field label="Conditions" isDark={isDark}>
        {(d.conditions || []).map((cond, i) => (
          <div key={i} style={{ background: isDark ? 'rgba(15,23,42,0.5)' : '#f1f5f9', borderRadius: 10, padding: 10, marginBottom: 8, border: `1px solid ${isDark ? 'rgba(51,65,85,0.4)' : '#e2e8f0'}` }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <select value={cond.field} onChange={(e) => { const c = [...(d.conditions || [])]; c[i] = { ...c[i], field: e.target.value }; u('conditions', c); }}
                style={{ ...inp(isDark), flex: 1 }}>
                {['message', 'contactName', 'contactPhone', 'tag', 'variable'].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={cond.operator} onChange={(e) => { const c = [...(d.conditions || [])]; c[i] = { ...c[i], operator: e.target.value }; u('conditions', c); }}
                style={{ ...inp(isDark), flex: 1 }}>
                {['contains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={cond.value || ''} onChange={(e) => { const c = [...(d.conditions || [])]; c[i] = { ...c[i], value: e.target.value }; u('conditions', c); }}
                placeholder="Value..." style={{ ...inp(isDark), flex: 1 }} />
              {(d.conditions || []).length > 1 && (
                <button onClick={() => u('conditions', (d.conditions || []).filter((_, j) => j !== i))}
                  style={{ padding: '0 8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => u('conditions', [...(d.conditions || []), { field: 'message', operator: 'contains', value: '' }])}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, background: 'rgba(168,85,247,0.1)', border: '1px dashed rgba(168,85,247,0.3)', borderRadius: 8, color: '#c084fc', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={12} /> Add Condition
        </button>
      </Field>
    </>
  );

  if (type === 'delayNode') return (
    <>
      <Field label="Delay Amount" isDark={isDark}>
        <input type="number" min="1" value={d.amount || 5} onChange={(e) => u('amount', parseInt(e.target.value))} style={inp(isDark)} />
      </Field>
      <SelectField label="Unit" value={d.unit} onChange={(v) => u('unit', v)} isDark={isDark}
        options={[{ value: 'seconds', label: 'Seconds' }, { value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }]} />
    </>
  );

  if (type === 'apiRequestNode') return (
    <>
      <SelectField label="Method" value={d.method} onChange={(v) => u('method', v)} isDark={isDark}
        options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))} />
      <TextField label="URL" value={d.url} onChange={(v) => u('url', v)} placeholder="https://api.example.com/endpoint" isDark={isDark} />
      <TextField label="Request Body (JSON)" value={d.body} onChange={(v) => u('body', v)} placeholder='{"key": "value"}' isDark={isDark} multiline rows={3} />
      <TextField label="Save Response to Variable" value={d.responseVariable} onChange={(v) => u('responseVariable', v)} placeholder="apiResponse" isDark={isDark} />
    </>
  );

  if (type === 'aiReplyNode') return (
    <>
      <SelectField label="AI Provider" value={d.provider} onChange={(v) => u('provider', v)} isDark={isDark}
        options={[{ value: 'openai', label: 'OpenAI' }, { value: 'gemini', label: 'Google Gemini' }, { value: 'groq', label: 'Groq' }]} />
      <TextField label="Model" value={d.model} onChange={(v) => u('model', v)} placeholder="gpt-4o-mini" isDark={isDark} />
      <TextField label="System Prompt" value={d.prompt} onChange={(v) => u('prompt', v)} placeholder="You are a helpful WhatsApp assistant..." isDark={isDark} multiline rows={4} />
      <Field label={`Temperature: ${d.temperature ?? 0.7}`} isDark={isDark}>
        <input type="range" min="0" max="1" step="0.1" value={d.temperature ?? 0.7} onChange={(e) => u('temperature', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#7c3aed' }} />
      </Field>
    </>
  );

  if (type === 'humanHandoverNode') return (
    <>
      <TextField label="Handover Message" value={d.message} onChange={(v) => u('message', v)} placeholder="Connecting you to an agent..." isDark={isDark} multiline rows={3} />
      <Field label="Pause Bot" isDark={isDark}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={d.pauseBot !== false} onChange={(e) => u('pauseBot', e.target.checked)} />
          <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>Pause bot for this contact</span>
        </label>
      </Field>
    </>
  );

  if (type === 'endConversationNode') return (
    <TextField label="Closing Message" value={d.message} onChange={(v) => u('message', v)} placeholder="Thank you! Have a great day." isDark={isDark} multiline rows={3} />
  );

  if (type === 'saveVariableNode') return (
    <>
      <TextField label="Variable Name" value={d.variableName} onChange={(v) => u('variableName', v)} placeholder="userEmail" isDark={isDark} />
      <SelectField label="Source" value={d.source} onChange={(v) => u('source', v)} isDark={isDark}
        options={[{ value: 'lastMessage', label: 'Last User Message' }, { value: 'customValue', label: 'Custom Value' }, { value: 'contactName', label: 'Contact Name' }, { value: 'contactPhone', label: 'Contact Phone' }]} />
      {d.source === 'customValue' && <TextField label="Custom Value" value={d.value} onChange={(v) => u('value', v)} placeholder="Static value" isDark={isDark} />}
    </>
  );

  if (type === 'addTagNode' || type === 'removeTagNode') return (
    <Field label="Tags" isDark={isDark}>
      {(d.tags || []).map((tag, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={tag} onChange={(e) => { const t = [...(d.tags || [])]; t[i] = e.target.value; u('tags', t); }}
            placeholder="tag-name" style={{ ...inp(isDark), flex: 1 }} />
          <button onClick={() => u('tags', (d.tags || []).filter((_, j) => j !== i))}
            style={{ padding: '0 8px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: '#f43f5e', cursor: 'pointer' }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button onClick={() => u('tags', [...(d.tags || []), ''])}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.3)', borderRadius: 8, color: '#34d399', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
        <Plus size={12} /> Add Tag
      </button>
    </Field>
  );

  // Generic fallback
  return (
    <div style={{ fontSize: 12, color: '#64748b', padding: 12, textAlign: 'center', background: 'rgba(15,23,42,0.4)', borderRadius: 10 }}>
      Node type: <strong style={{ color: '#94a3b8' }}>{type}</strong><br />Select to configure.
    </div>
  );
};

const ConfigPanel = ({ theme }) => {
  const { selectedNode, configPanelOpen, setConfigPanelOpen, updateNodeData, deleteNode } = useFlowStore();
  const [templates, setTemplates] = useState([]);
  
  React.useEffect(() => {
    if (selectedNode?.type === 'sendTemplateNode') {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      axios.get(`${apiUrl}/api/templates`, { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } })
        .then(res => setTemplates(res.data.filter(t => t.status === 'APPROVED')))
        .catch(err => console.error(err));
    }
  }, [selectedNode?.type]);

  const isDark = theme === 'dark';
  const nodeDef = selectedNode ? NODE_TYPE_MAP[selectedNode.type] : null;
  const Icon = nodeDef?.icon;
  const bg = isDark ? '#0d1526' : '#f8fafc';
  const border = isDark ? 'rgba(51,65,85,0.6)' : '#e2e8f0';

  if (!configPanelOpen || !selectedNode) return null;

  const update = (data) => updateNodeData(selectedNode.id, data);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 280, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 280, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ width: 280, height: '100%', display: 'flex', flexDirection: 'column', background: bg, borderLeft: `1px solid ${border}`, flexShrink: 0 }}
      >
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} className={nodeDef?.bgClass || 'bg-surface-700'}>
            {Icon && <Icon size={14} className={nodeDef?.colorClass || 'text-surface-400'} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#0f172a' }}>{nodeDef?.label || selectedNode.type}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{nodeDef?.categoryLabel}</div>
          </div>
          <button onClick={() => setConfigPanelOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Label rename */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}` }}>
          <span style={lbl(isDark)}>Node Label</span>
          <input value={selectedNode.data?.label || nodeDef?.label || ''} onChange={(e) => update({ label: e.target.value })}
            style={inp(isDark)} placeholder="Rename this node..." />
        </div>

        {/* Dynamic config */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          <ConfigContent node={selectedNode} update={update} isDark={isDark} templates={templates} />
        </div>

        {/* Delete button */}
        <div style={{ padding: '10px 14px', borderTop: `1px solid ${border}` }}>
          <button onClick={() => deleteNode(selectedNode.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px', fontSize: 12, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, color: '#f43f5e', cursor: 'pointer', fontWeight: 600 }}>
            <Trash2 size={14} /> Delete Node
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfigPanel;
