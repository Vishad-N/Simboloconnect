import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Zap, Plus, Play, Pause, Trash2, Eye, Copy, Search, RefreshCw, X, ChevronRight, CheckCircle2, Clock, ArrowRight, GitBranch, MessageSquare, Tag, Bell, Webhook } from 'lucide-react';

const triggerOptions = [
  { id: 'order_created', label: 'New Order', color: '#10b981', icon: '🛒' },
  { id: 'order_paid', label: 'Order Paid', color: '#818cf8', icon: '💳' },
  { id: 'order_shipped', label: 'Order Shipped', color: '#06b6d4', icon: '📦' },
  { id: 'order_delivered', label: 'Order Delivered', color: '#10b981', icon: '✅' },
  { id: 'cart_abandoned', label: 'Cart Abandoned', color: '#f59e0b', icon: '🛒' },
  { id: 'customer_created', label: 'Customer Created', color: '#f472b6', icon: '👤' },
  { id: 'payment_failed', label: 'Payment Failed', color: '#ef4444', icon: '❌' },
  { id: 'cod_order', label: 'COD Order', color: '#fb923c', icon: '💰' },
];

const actionOptions = [
  { id: 'send_template', label: 'Send Template', icon: MessageSquare, color: '#00d9a5' },
  { id: 'add_tag', label: 'Add Tag', icon: Tag, color: '#818cf8' },
  { id: 'delay', label: 'Delay', icon: Clock, color: '#f59e0b' },
  { id: 'notify_admin', label: 'Notify Admin', icon: Bell, color: '#f472b6' },
  { id: 'webhook', label: 'Webhook Call', icon: Webhook, color: '#06b6d4' },
];

export default function EcommerceAutomations() {
  const [automations, setAutomations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newFlow, setNewFlow] = useState({ name: '', triggerType: '', storeScope: 'all', flowJson: [] });
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // wizard step

  const fetchAutomations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutomations(res.data.automations || []);
    } catch (err) {
      console.error('Failed to fetch automations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const filtered = automations.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = async (id) => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.patch(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/automations/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, status: res.data.automation.status } : a));
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const deleteAutomation = async (id) => {
    if (!window.confirm('Delete this automation?')) return;
    try {
      const token = localStorage.getItem('userToken');
      await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/automations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert('Failed to delete automation');
    }
  };

  const handleAddAction = (actionId) => {
    setNewFlow(p => ({ ...p, flowJson: [...p.flowJson, { type: actionId }] }));
  };

  const handleRemoveAction = (index) => {
    setNewFlow(p => {
      const newActions = [...p.flowJson];
      newActions.splice(index, 1);
      return { ...p, flowJson: newActions };
    });
  };

  const handleCreate = async () => {
    if (!newFlow.name || !newFlow.triggerType) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('userToken');
      const payload = {
        name: newFlow.name,
        triggerType: newFlow.triggerType,
        flowJson: newFlow.flowJson,
        storeScope: newFlow.storeScope,
      };
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/automations`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAutomations();
      setShowCreate(false);
      setNewFlow({ name: '', triggerType: '', storeScope: 'all', flowJson: [] });
      setStep(1);
    } catch (err) {
      alert('Failed to create automation');
    } finally {
      setCreating(false);
    }
  };

  const getTriggerConfig = (id) => triggerOptions.find(t => t.id === id) || { label: id, color: '#818cf8', icon: '⚡' };
  const getActionConfig = (id) => actionOptions.find(a => a.id === id) || { label: id, color: '#818cf8', icon: Zap };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Zap size={18} className="text-brand-400" />
            </div>
            Automations
          </h1>
          <p className="text-surface-400 text-sm mt-1">Build multi-step automated WhatsApp flows for ecommerce events</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-brand-500/25">
          <Plus size={18} /> Create Automation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Automations', val: automations.length, color: '#818cf8' },
          { label: 'Active', val: automations.filter(a => a.status === 'active').length, color: '#10b981' },
          { label: 'Total Runs', val: automations.reduce((a, c) => a + (c.runs || 0), 0).toLocaleString(), color: '#06b6d4' },
          { label: 'Avg Success', val: '98.5%', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="glass-panel p-4 rounded-xl border border-surface-700">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-sm text-surface-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input type="text" placeholder="Search automations…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
      </div>

      {/* Automations List */}
      <div className="space-y-3">
        {loading ? (
           <div className="text-center py-16 text-surface-500">Loading automations...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-surface-500">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p>No automations found</p>
          </div>
        ) : filtered.map(a => {
          const tc = getTriggerConfig(a.triggerType);
          const actionsList = Array.isArray(a.flowJson) ? a.flowJson : [];
          const isActive = a.status === 'active';
          return (
            <div key={a.id} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-brand-500/20 transition-all duration-200">
              <div className="flex items-start gap-4">
                {/* Trigger Badge */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ background: tc.color + '20' }}>
                  {tc.icon}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-white">{a.name}</h3>
                    <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium border ${isActive ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-surface-400 bg-surface-700 border-surface-600'}`}>
                      {isActive ? 'Active' : 'Paused'}
                    </span>
                    <span className="text-xs text-surface-500">{a.storeScope === 'all' ? 'All Stores' : a.storeScope}</span>
                  </div>

                  {/* Flow Visualization */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ background: tc.color + '20', color: tc.color }}>{tc.label}</span>
                    {actionsList.length > 0 && <ArrowRight size={12} className="text-surface-600" />}
                    {actionsList.map((action, i) => {
                      const ac = getActionConfig(action.type);
                      return (
                        <React.Fragment key={i}>
                          <span className="text-xs px-2 py-0.5 rounded-lg border flex items-center gap-1" style={{ background: ac.color + '10', borderColor: ac.color + '30', color: ac.color }}>
                             <ac.icon size={10} /> {ac.label}
                          </span>
                          {i < actionsList.length - 1 && <ArrowRight size={12} className="text-surface-600" />}
                        </React.Fragment>
                      );
                    })}
                    {actionsList.length === 0 && <span className="text-xs text-surface-500">(No Actions)</span>}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-surface-500">
                    <span>{a.runs || 0} runs</span>
                    <span className="text-green-400">99.2% success</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleStatus(a.id)}
                    className={`p-2 rounded-lg transition-all ${isActive ? 'text-amber-400 hover:bg-amber-400/10' : 'text-green-400 hover:bg-green-400/10'}`}
                    title={isActive ? 'Pause' : 'Activate'}>
                    {isActive ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button onClick={() => deleteAutomation(a.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trigger Reference */}
      <div className="glass-panel p-5 rounded-xl border border-surface-700">
        <h3 className="text-sm font-bold text-white mb-3">Available Triggers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {triggerOptions.map(t => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/60">
              <span className="text-lg">{t.icon}</span>
              <span className="text-xs text-surface-300">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Automation Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-white">Create Automation</h2>
              <button onClick={() => { setShowCreate(false); setStep(1); }} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Step Indicator */}
              <div className="flex items-center gap-2 mb-4">
                {[1, 2].map(s => (
                  <React.Fragment key={s}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-brand-500 text-white' : 'bg-surface-700 text-surface-400'}`}>{s}</div>
                    {s < 2 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-brand-500' : 'bg-surface-700'}`} />}
                  </React.Fragment>
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Automation Name <span className="text-red-400">*</span></label>
                    <input type="text" value={newFlow.name} onChange={e => setNewFlow(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Order Confirmation Flow" className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-2">Select Trigger <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {triggerOptions.map(t => (
                        <button key={t.id} onClick={() => setNewFlow(p => ({ ...p, triggerType: t.id }))}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-sm transition-all ${newFlow.triggerType === t.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'}`}>
                          <span className="text-lg">{t.icon}</span>
                          <span className={newFlow.triggerType === t.id ? 'text-brand-400' : 'text-surface-300'}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { if (newFlow.name && newFlow.triggerType) setStep(2); }}
                    disabled={!newFlow.name || !newFlow.triggerType}
                    className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all disabled:opacity-50">
                    Next: Add Actions →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-surface-800 p-4 rounded-xl border border-surface-700 mb-4">
                     <p className="text-xs font-bold text-brand-400 mb-2 uppercase tracking-wider">Flow Sequence</p>
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-white">
                           <span className="w-6 h-6 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center"><Zap size={12}/></span>
                           {getTriggerConfig(newFlow.triggerType).label}
                        </div>
                        {newFlow.flowJson.map((act, idx) => {
                           const ac = getActionConfig(act.type);
                           return (
                             <div key={idx} className="flex items-center gap-2 text-sm text-surface-200 ml-3 border-l-2 border-surface-600 pl-4 py-1 relative">
                               <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-surface-500" />
                               <ac.icon size={14} style={{ color: ac.color }}/>
                               {ac.label}
                               <button onClick={() => handleRemoveAction(idx)} className="ml-auto text-surface-500 hover:text-red-400"><X size={14} /></button>
                             </div>
                           );
                        })}
                     </div>
                  </div>

                  <p className="text-sm text-surface-400 font-medium">Add Action:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {actionOptions.map(a => (
                      <button key={a.id} onClick={() => handleAddAction(a.id)} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/60 border border-surface-700 hover:border-brand-500/50 hover:bg-surface-800 transition-all text-left group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: a.color + '22' }}>
                          <a.icon size={16} style={{ color: a.color }} />
                        </div>
                        <span className="text-sm text-surface-200 flex-1 font-medium">{a.label}</span>
                        <span className="text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"><Plus size={12}/> Add</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-surface-700">
                    <button onClick={() => setStep(1)} className="flex-1 btn-secondary">← Back</button>
                    <button onClick={handleCreate} disabled={creating || newFlow.flowJson.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all disabled:opacity-50">
                      {creating ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      {creating ? 'Creating…' : 'Save Automation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
