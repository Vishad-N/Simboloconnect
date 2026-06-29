import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Play, Undo2, Redo2, LayoutGrid, AlertTriangle, CheckCircle, Loader2,
  PanelLeftClose, PanelLeftOpen, GitBranch, Eye, Download, Upload, Sun, Moon,
  Pause, Send, X, CheckCircle2, AlertCircle, Terminal, ChevronDown, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useFlowStore from '../store/flowStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

const Btn = ({ onClick, title, children, disabled, active, danger, className = '' }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
      danger ? 'border border-red-500/30 bg-red-500/8 text-red-400 hover:bg-red-500/15' :
      active ? 'border border-brand-500/50 bg-brand-500/12 text-brand-400' :
      'border border-white/[0.07] bg-white/[0.04] text-surface-400 hover:text-surface-200 hover:bg-white/[0.07]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
    {children}
  </button>
);

const Sep = () => <div className="w-px h-5 bg-white/[0.08] mx-1 flex-shrink-0" />;

// ─── Real Simulator Panel ───────────────────────────────────────────────────
function SimulatorPanel({ flowId, flowName, onClose, isDark }) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const runTest = async () => {
    if (!message.trim() || !flowId) return;
    setLoading(true);
    setResult(null);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.post(`${API}/api/visual-flows/${flowId}/test`,
        { message: message.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
      setHistory(prev => [{ message: message.trim(), result: res.data, ts: Date.now() }, ...prev.slice(0, 9)]);
    } catch (err) {
      setResult({ matched: false, error: err.response?.data?.error || err.message, steps: [], responses: [] });
    } finally {
      setLoading(false);
    }
  };

  const stepIcon = (s) => {
    if (s.status === 'matched' || s.status === 'executed') return <CheckCircle2 size={12} className="text-brand-400 flex-shrink-0" />;
    if (s.status === 'not_matched') return <AlertCircle size={12} className="text-red-400 flex-shrink-0" />;
    if (s.status === 'waiting') return <Pause size={12} className="text-amber-400 flex-shrink-0" />;
    if (s.status === 'handover') return <AlertCircle size={12} className="text-blue-400 flex-shrink-0" />;
    return <AlertCircle size={12} className="text-red-400 flex-shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: isDark ? '#0a0a0a' : '#ffffff', borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`, width: 360 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0' }}>
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-brand-400" />
          <span className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>Flow Simulator</span>
        </div>
        <button onClick={onClose} className="p-1 text-surface-500 hover:text-white rounded-lg hover:bg-surface-800 transition-all">
          <X size={16} />
        </button>
      </div>

      {/* Flow ID warning */}
      {!flowId && (
        <div className="mx-4 mt-4 p-3 rounded-xl text-xs text-amber-400 border border-amber-500/20 bg-amber-500/8">
          ⚠️ Save the flow first before testing it.
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}>
        <label className="text-xs text-surface-400 font-medium block mb-2">Test Message</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runTest()}
            placeholder="Type a message to test..."
            disabled={!flowId || loading}
            className="input-field flex-1 text-sm"
            style={{ fontSize: 13 }}
          />
          <button
            onClick={runTest}
            disabled={!flowId || loading || !message.trim()}
            className="btn-primary px-3 py-2 text-xs"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-xs text-surface-600 mt-1.5">Press Enter to test • No real messages are sent</p>
      </div>

      {/* Result */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-surface-400 animate-pulse">
            <Loader2 size={16} className="animate-spin text-brand-400" />
            Running simulation...
          </div>
        )}

        {result && !loading && (
          <div>
            {/* Match result banner */}
            <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm font-semibold ${result.matched ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {result.matched ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {result.matched ? '✓ Trigger Matched — Flow Executed' : '✗ No Trigger Match Found'}
              {result.error && <span className="text-xs font-normal ml-1">({result.error})</span>}
            </div>

            {/* Execution steps */}
            {result.steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">Execution Steps</p>
                <div className="space-y-2">
                  {result.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {stepIcon(step)}
                      <div className="flex-1 min-w-0">
                        <span className="text-surface-200 font-medium block">{step.label || step.type}</span>
                        {step.detail && <span className="text-surface-500 break-words">{step.detail}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bot responses */}
            {result.responses?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">Bot Would Reply</p>
                <div className="space-y-2">
                  {result.responses.map((resp, i) => (
                    <div key={i} className="rounded-xl p-3 text-sm"
                      style={{ background: 'rgba(0,217,165,0.06)', border: '1px solid rgba(0,217,165,0.15)' }}>
                      <span className="text-xs text-surface-500 block mb-1 uppercase tracking-wide">{resp.type?.replace('send', '').replace('Node', '') || 'Message'}</span>
                      <span className="text-surface-200 break-words">{resp.preview || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 1 && !loading && !result && (
          <div>
            <p className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wider">Recent Tests</p>
            <div className="space-y-1">
              {history.slice(1).map((h, i) => (
                <button key={i} onClick={() => { setMessage(h.message); setResult(h.result); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-surface-400 hover:bg-surface-800 hover:text-white transition-all">
                  {h.result.matched ? '✓' : '✗'} "{h.message}"
                </button>
              ))}
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="text-center py-8 text-surface-600">
            <Terminal size={32} className="mx-auto mb-3 text-surface-700" />
            <p className="text-sm">Send a test message to simulate the flow without sending real WhatsApp messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TopToolbar = ({ reactFlowInstance }) => {
  const {
    flowName, setFlowName, flowId, setFlowId, isDirty, isSaving, setIsSaving, markClean,
    nodes, edges, validate, validationErrors, isPublished, setIsPublished,
    undo, redo, canUndo, canRedo, toggleTheme, theme: storeTheme, toggleSidebar, sidebarOpen,
    exportFlow, importFlow,
  } = useFlowStore();

  const navigate = useNavigate();
  const [showValidation, setShowValidation] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [flowStatus, setFlowStatus] = useState('DRAFT');
  const [isPublishing, setIsPublishing] = useState(false);

  const isDark = storeTheme === 'dark';
  const bg = isDark ? 'rgba(8,8,12,0.97)' : 'rgba(248,250,252,0.97)';
  const border = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  const textColor = isDark ? '#e2e8f0' : '#0f172a';

  // Save flow as draft
  const handleSave = async () => {
    const errors = validate();
    if (errors.some(e => e.type === 'error')) { setShowValidation(true); return; }
    setIsSaving(true);
    try {
      const triggerNode = nodes.find(n => n.type?.toLowerCase().includes('trigger'));
      const trigger = triggerNode?.data?.keyword || triggerNode?.data?.triggerType || 'ALL_MESSAGES';
      const payload = {
        name: flowName,
        trigger,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        status: flowStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        isActive: flowStatus === 'PUBLISHED',
      };
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      if (flowId) {
        await axios.put(`${API}/api/visual-flows/${flowId}`, payload, { headers });
      } else {
        const res = await axios.post(`${API}/api/visual-flows`, { ...payload, status: 'DRAFT', isActive: false }, { headers });
        setFlowId(res.data.id);
        setFlowStatus('DRAFT');
      }
      markClean();
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Publish flow (makes it live)
  const handlePublish = async () => {
    if (!flowId) { alert('Save the flow first before publishing.'); return; }
    setIsPublishing(true);
    try {
      const token = localStorage.getItem('userToken');
      await axios.post(`${API}/api/visual-flows/${flowId}/publish`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFlowStatus('PUBLISHED');
      setIsPublished(true);
    } catch (err) {
      alert('Publish failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsPublishing(false);
    }
  };

  // Pause published flow
  const handlePause = async () => {
    if (!flowId) return;
    setIsPublishing(true);
    try {
      const token = localStorage.getItem('userToken');
      await axios.post(`${API}/api/visual-flows/${flowId}/pause`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFlowStatus('PAUSED');
      setIsPublished(false);
    } catch (err) {
      alert('Pause failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportFlow()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${flowName.replace(/\s+/g, '_')}.json`; a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => importFlow(evt.target.result);
      reader.readAsText(file);
    };
    input.click();
  };

  const handleAutoLayout = () => {
    if (!reactFlowInstance) return;
    const newNodes = nodes.map((node, i) => ({
      ...node, position: { x: (i % 3) * 380 + 100, y: Math.floor(i / 3) * 220 + 100 }
    }));
    useFlowStore.getState().initFlow({ nodes: newNodes, edges, name: flowName });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
  };

  const errors = validationErrors.filter(e => e.type === 'error');

  const statusBadge = {
    DRAFT:     { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'Draft' },
    PUBLISHED: { color: '#00d9a5', bg: 'rgba(0,217,165,0.1)',   label: 'Published' },
    PAUSED:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Paused' },
  }[flowStatus] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'Draft' };

  return (
    <div className="flex" style={{ height: 56, flexShrink: 0 }}>
      {/* Main toolbar */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', background: bg, borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(16px)', gap: 6, zIndex: 20
      }}>
        {/* Left: back + flow name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <button onClick={() => navigate('/chatbot/visual-flows')}
            className="p-1.5 text-surface-500 hover:text-white hover:bg-surface-800 rounded-lg transition-all flex-shrink-0">
            <ArrowLeft size={15} />
          </button>
          <Btn onClick={toggleSidebar} title="Toggle Sidebar">
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </Btn>
          <Sep />
          <GitBranch size={14} style={{ color: '#00d9a5', flexShrink: 0 }} />
          <input
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none', maxWidth: 200,
              fontSize: 13, fontWeight: 700, color: textColor, minWidth: 80,
              borderBottom: '1px solid transparent', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderBottomColor = '#00d9a5'}
            onBlur={e => e.target.style.borderBottomColor = 'transparent'}
          />
          {isDirty && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Unsaved changes">●</span>}
          {/* Status badge */}
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ color: statusBadge.color, background: statusBadge.bg }}>
            {statusBadge.label}
          </span>
        </div>

        {/* Center: tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Btn onClick={undo} disabled={!canUndo()} title="Undo (Ctrl+Z)"><Undo2 size={14} /></Btn>
          <Btn onClick={redo} disabled={!canRedo()} title="Redo (Ctrl+Y)"><Redo2 size={14} /></Btn>
          <Sep />
          <Btn onClick={handleAutoLayout} title="Auto Layout"><LayoutGrid size={14} /> Layout</Btn>
          <Btn onClick={() => reactFlowInstance?.fitView({ padding: 0.2 })} title="Fit View"><Eye size={14} /></Btn>
          <Sep />
          <Btn onClick={handleExport} title="Export JSON"><Download size={14} /></Btn>
          <Btn onClick={handleImport} title="Import JSON"><Upload size={14} /></Btn>
          <Sep />
          {/* Validation */}
          <div style={{ position: 'relative' }}>
            <Btn onClick={() => { validate(); setShowValidation(!showValidation); }}
              danger={errors.length > 0}
              active={errors.length === 0 && validationErrors.length > 0}
              title="Validate Flow">
              {errors.length > 0 ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
              {validationErrors.length > 0 && (
                <span style={{ background: errors.length > 0 ? '#f43f5e' : '#f59e0b', color: 'white', borderRadius: 999, fontSize: 10, padding: '0 4px', fontWeight: 700 }}>
                  {validationErrors.length}
                </span>
              )}
            </Btn>
            <AnimatePresence>
              {showValidation && validationErrors.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ position: 'absolute', top: '110%', right: 0, marginTop: 4, width: 280, background: isDark ? '#0d0d0d' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.1)', zIndex: 100 }}>
                  <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0' }}>
                    <span className="text-xs font-bold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>Flow Validation</span>
                    <button onClick={() => setShowValidation(false)} className="text-surface-500 hover:text-white"><X size={13} /></button>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {validationErrors.map((err, i) => (
                      <div key={i} className="flex gap-2 px-3 py-2 border-b border-white/[0.04] text-xs">
                        <span>{err.type === 'error' ? '🔴' : '🟡'}</span>
                        <span className="text-surface-400">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Sep />
          {/* Simulator toggle */}
          <Btn
            onClick={() => setShowSimulator(!showSimulator)}
            active={showSimulator}
            title="Open Flow Simulator"
          >
            <Terminal size={13} /> Test
          </Btn>
        </div>

        {/* Right: Save + Publish/Pause */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={isSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: isDirty ? 'linear-gradient(135deg, #00d9a5, #00b589)' : 'rgba(0,217,165,0.1)',
              border: '1px solid rgba(0,217,165,0.3)', borderRadius: 10,
              color: isDirty ? '#000' : '#00d9a5', fontSize: 13, fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              boxShadow: isDirty ? '0 4px 14px rgba(0,217,165,0.3)' : 'none',
            }}>
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          {flowStatus === 'PUBLISHED' ? (
            <button onClick={handlePause} disabled={isPublishing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: '1px solid rgba(245,158,11,0.5)', borderRadius: 10,
                color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}>
              {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />}
              Pause Flow
            </button>
          ) : (
            <button onClick={handlePublish} disabled={isPublishing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: '1px solid rgba(99,102,241,0.5)', borderRadius: 10,
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
              }}>
              {isPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {isPublishing ? 'Publishing...' : 'Publish Live'}
            </button>
          )}
        </div>
      </div>

      {/* Simulator panel */}
      {showSimulator && (
        <SimulatorPanel
          flowId={flowId}
          flowName={flowName}
          onClose={() => setShowSimulator(false)}
          isDark={isDark}
        />
      )}
    </div>
  );
};

export default TopToolbar;
