import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Plus, Search, Copy, Eye, Trash2, CheckCircle2, X, RefreshCw, MessageSquare, Tag, ShoppingCart, Truck, RotateCcw, Bell } from 'lucide-react';

const categoryConfig = {
  order:     { label: 'Order',     color: '#818cf8', icon: ShoppingCart },
  shipping:  { label: 'Shipping',  color: '#06b6d4', icon: Truck },
  cart:      { label: 'Cart',      color: '#f59e0b', icon: RotateCcw },
  promotion: { label: 'Promotion', color: '#10b981', icon: Tag },
  support:   { label: 'Support',   color: '#f472b6', icon: MessageSquare },
  general:   { label: 'General',   color: '#a78bfa', icon: Bell },
};

export default function EcommerceTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTpl, setNewTpl] = useState({ displayName: '', category: 'order', body: '', language: 'en' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filtered = templates.filter(t => {
    const m = (t.displayName || t.name || '').toLowerCase().includes(search.toLowerCase());
    const c = catFilter === 'all' || t.category === catFilter;
    return m && c;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreate = async () => {
    if (!newTpl.displayName || !newTpl.body) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('userToken');
      const variables = [];
      const varMatches = newTpl.body.match(/\{\{([^}]+)\}\}/g);
      if (varMatches) {
         varMatches.forEach(v => {
           const match = v.match(/\{\{([^}]+)\}\}/);
           if (match && match[1]) variables.push(match[1].trim());
         });
      }

      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/templates`, {
        name: newTpl.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: newTpl.displayName,
        category: newTpl.category,
        language: newTpl.language,
        body: newTpl.body,
        variables: variables
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTemplates();
      setShowCreate(false);
      setNewTpl({ displayName: '', category: 'order', body: '', language: 'en' });
    } catch (err) {
      alert('Failed to create template: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      const token = localStorage.getItem('userToken');
      await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      alert('Failed to delete template');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <FileText size={18} className="text-brand-400" />
            </div>
            Ecommerce Templates
          </h1>
          <p className="text-surface-400 text-sm mt-1">WhatsApp message templates for order notifications and campaigns</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-brand-500/25">
          <Plus size={18} /> New Template
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCatFilter('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${catFilter === 'all' ? 'bg-brand-500 text-white' : 'border border-surface-600 text-surface-400 hover:text-white hover:border-surface-400'}`}>
          All ({templates.length})
        </button>
        {Object.entries(categoryConfig).map(([key, cfg]) => {
          const count = templates.filter(t => t.category === key).length;
          if (count === 0) return null;
          return (
            <button key={key} onClick={() => setCatFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${catFilter === key ? 'text-white' : 'border border-surface-600 text-surface-400 hover:text-white'}`}
              style={catFilter === key ? { background: cfg.color, borderColor: cfg.color } : {}}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input type="text" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-16 text-surface-500">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-surface-500">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p>No templates found</p>
          </div>
        ) : filtered.map(t => {
          const cc = categoryConfig[t.category] || categoryConfig.general;
          const CIcon = cc.icon;
          return (
            <div key={t.id} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-brand-500/20 transition-all duration-200 flex flex-col">
              {/* Template Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cc.color + '20' }}>
                    <CIcon size={16} style={{ color: cc.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{t.displayName || t.name}</h3>
                    <p className="text-xs text-surface-500 font-mono">{t.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium border ${t.status === 'APPROVED' ? 'text-green-400 bg-green-400/10 border-green-400/20' : t.status === 'PENDING' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>
                    {t.status || 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Message Body Preview */}
              <div className="flex-1 bg-surface-800/60 rounded-xl p-3 mb-3 border border-surface-700">
                <p className="text-xs text-surface-300 leading-relaxed whitespace-pre-line line-clamp-3">{t.body}</p>
              </div>

              {/* Variables */}
              {t.variables && t.variables.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.variables.map((v, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-brand-500/10 text-brand-400 rounded border border-brand-500/20 font-mono">
                      {`{{${i + 1}}}`} {v}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-surface-500">{(t.usageCount || 0).toLocaleString()} uses · {(t.language || 'en').toUpperCase()}</span>
                <div className="flex gap-1">
                  <button onClick={() => handleCopy(t.body, t.id)}
                    className={`p-1.5 rounded-lg transition-all text-sm ${copied === t.id ? 'text-green-400 bg-green-400/10' : 'text-surface-400 hover:text-white hover:bg-surface-700'}`}
                    title="Copy body">
                    {copied === t.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => setSelected(t)}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-all" title="Preview">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => deleteTemplate(t.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-white">{selected.displayName || selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {(() => { const cc = categoryConfig[selected.category] || categoryConfig.general; const CIcon = cc.icon; return (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cc.color + '20' }}>
                    <CIcon size={16} style={{ color: cc.color }} />
                  </div>
                ); })()}
                <div>
                  <p className="text-xs text-surface-500">Template: <span className="font-mono">{selected.name}</span></p>
                  <p className="text-xs text-surface-500">Language: {(selected.language || 'en').toUpperCase()} · Status: {selected.status}</p>
                </div>
              </div>

              {/* WhatsApp Preview */}
              <div className="bg-[#0b1418] rounded-2xl p-4 border border-surface-700">
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-[#005c4b] rounded-2xl rounded-br-sm px-3 py-2.5 shadow-md">
                    <p className="text-[13px] text-white leading-relaxed whitespace-pre-line">{selected.body}</p>
                    <p className="text-right text-[10px] text-green-300/60 mt-1">09:41 ✓✓</p>
                  </div>
                </div>
              </div>

              {/* Variables */}
              {selected.variables && selected.variables.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-300 mb-2">Template Variables:</p>
                  <div className="space-y-1.5">
                    {selected.variables.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-surface-800 rounded-lg">
                        <span className="font-mono text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">{`{{${i + 1}}}`}</span>
                        <span className="text-sm text-surface-300">{v.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => handleCopy(selected.body, selected.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:text-white text-sm transition-all">
                  <Copy size={15} /> Copy Body
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-surface-700 sticky top-0 bg-surface-900 z-10">
              <h2 className="text-lg font-bold text-white">New Ecommerce Template</h2>
              <button onClick={() => setShowCreate(false)} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Template Display Name <span className="text-red-400">*</span></label>
                <input type="text" value={newTpl.displayName} onChange={e => setNewTpl(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="e.g. Order Shipped Notification" className="input-field w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Category</label>
                  <select value={newTpl.category} onChange={e => setNewTpl(p => ({ ...p, category: e.target.value }))} className="input-field w-full">
                    {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Language</label>
                  <select value={newTpl.language} onChange={e => setNewTpl(p => ({ ...p, language: e.target.value }))} className="input-field w-full">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Message Body <span className="text-red-400">*</span>
                  <span className="ml-2 text-xs text-surface-500 font-normal">Use {`{{1}}, {{2}}`} for variables</span>
                </label>
                <textarea value={newTpl.body} onChange={e => setNewTpl(p => ({ ...p, body: e.target.value }))}
                  rows={5} placeholder="Hi {{1}}, your order #{{2}} has been confirmed..."
                  className="input-field w-full resize-none font-mono text-sm" />
              </div>
              <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400">
                <p className="font-medium text-surface-300 mb-1">💡 Available Variables:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {['customer_name', 'order_id', 'order_amount', 'product_name', 'tracking_link', 'coupon_code', 'shop_link'].map(v => (
                    <button key={v} onClick={() => setNewTpl(p => ({ ...p, body: p.body + `{{${v}}}` }))}
                      className="px-1.5 py-0.5 bg-surface-700 rounded text-brand-400 hover:bg-brand-500/10 transition-colors font-mono">{`{{${v}}}`}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-surface-700 sticky bottom-0 bg-surface-900">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !newTpl.displayName || !newTpl.body}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all disabled:opacity-50">
                {creating ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {creating ? 'Creating…' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
