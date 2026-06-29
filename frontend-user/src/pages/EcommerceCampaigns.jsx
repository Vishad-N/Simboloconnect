import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Send, Plus, Search, RefreshCw, Play, Pause, Trash2, Eye, Copy, X, CheckCircle2, Clock, Users, ShoppingCart, BarChart2, Zap } from 'lucide-react';

const typeCfg = {
  promotional:  { label: 'Promotional',  color: '#818cf8', bg: 'bg-indigo-400/10', text: 'text-indigo-400' },
  retention:    { label: 'Retention',    color: '#10b981', bg: 'bg-green-400/10',  text: 'text-green-400' },
  announcement: { label: 'Announcement', color: '#f59e0b', bg: 'bg-amber-400/10',  text: 'text-amber-400' },
  abandoned:    { label: 'Cart Recovery',color: '#fb923c', bg: 'bg-orange-400/10', text: 'text-orange-400' },
};

const statusCfg = {
  draft:     { label: 'Draft',     color: 'text-surface-400', bg: 'bg-surface-700', border: 'border-surface-600' },
  scheduled: { label: 'Scheduled', color: 'text-blue-400',    bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  running:   { label: 'Running',   color: 'text-brand-400',   bg: 'bg-brand-400/10',border: 'border-brand-400/20' },
  completed: { label: 'Completed', color: 'text-green-400',   bg: 'bg-green-400/10',border: 'border-green-400/20' },
  paused:    { label: 'Paused',    color: 'text-amber-400',   bg: 'bg-amber-400/10',border: 'border-amber-400/20' },
};

const audienceSegments = [
  { id: 'all', label: 'All Customers' },
  { id: 'vip', label: 'VIP Customers' },
  { id: 'loyal', label: 'Loyal Customers' },
  { id: 'new', label: 'New Customers (30d)' },
  { id: 'atrisk', label: 'At-Risk Customers' },
  { id: 'abandoned', label: 'Abandoned Cart Users' },
  { id: 'purchased', label: 'Purchased Specific Product' },
];

export default function EcommerceCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'promotional', storeId: 'all', audience: 'all', template: '', scheduledAt: '' });
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(res.data.campaigns || []);
      
      const tplRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(tplRes.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!form.name || !form.type || !form.template) return alert('Name, type and template are required');
    setCreating(true);
    try {
      const token = localStorage.getItem('userToken');
      const payload = {
        name: form.name,
        type: form.type,
        audience: form.audience,
        templateName: form.template,
        scheduledAt: form.scheduledAt || null,
        status: form.scheduledAt ? 'scheduled' : 'draft',
      };
      if (form.storeId !== 'all') {
        payload.storeId = form.storeId;
      }
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/campaigns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCampaigns();
      setShowCreate(false);
      setForm({ name: '', type: 'promotional', storeId: 'all', audience: 'all', template: '', scheduledAt: '' });
    } catch (err) {
      alert('Failed to create campaign: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreating(false);
    }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      const token = localStorage.getItem('userToken');
      await axios.delete(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Failed to delete campaign');
    }
  };

  const totalSent = campaigns.reduce((a, c) => a + (c.sent || 0), 0);
  const totalRead = campaigns.reduce((a, c) => a + (c.read || 0), 0);
  const avgOpenRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(1) + '%' : '0%';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Send size={18} className="text-brand-400" />
            </div>
            Ecommerce Campaigns
          </h1>
          <p className="text-surface-400 text-sm mt-1">WhatsApp campaigns targeted at your store customers</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-brand-500/25">
          <Plus size={18} /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', val: campaigns.length, color: '#818cf8' },
          { label: 'Messages Sent', val: campaigns.reduce((a, c) => a + (c.sent || 0), 0).toLocaleString(), color: '#10b981' },
          { label: 'Avg Open Rate', val: avgOpenRate, color: '#f59e0b' },
          { label: 'Revenue Attributed', val: `₹${campaigns.reduce((a, c) => a + (c.revenue || 0), 0).toLocaleString()}`, color: '#06b6d4' },
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
        <input type="text" placeholder="Search campaigns…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
      </div>

      {/* Campaigns List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-surface-500">Loading campaigns...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-surface-500">
            <Send size={48} className="mx-auto mb-4 opacity-30" />
            <p>No campaigns found</p>
          </div>
        ) : filtered.map(c => {
          const tc = typeCfg[c.type] || typeCfg.promotional;
          const sc = statusCfg[c.status] || statusCfg.draft;
          const sent = c.sent || 0;
          const delivered = c.delivered || 0;
          const read = c.read || 0;
          const clicks = c.clicks || 0;
          const revenue = c.revenue || 0;
          const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0;
          const readRate = delivered > 0 ? ((read / delivered) * 100).toFixed(1) : 0;
          const ctr = read > 0 ? ((clicks / read) * 100).toFixed(1) : 0;
          return (
            <div key={c.id} className="glass-panel p-5 rounded-xl border border-surface-700 hover:border-brand-500/20 transition-all">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white">{c.name}</h3>
                    <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium border ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
                    <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${tc.text} ${tc.bg}`}>{tc.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-surface-500">
                    <span className="flex items-center gap-1"><Users size={11} /> {c.targetAudience > 0 ? `${c.targetAudience} contacts` : 'Not yet targeted'}</span>
                    <span>{c.store?.storeName || 'All Stores'}</span>
                    {c.scheduledAt && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(c.scheduledAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteCampaign(c.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all"><Trash2 size={16} /></button>
                </div>
              </div>

              {sent > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-surface-800">
                  {[
                    { label: 'Sent', val: sent, color: '#818cf8' },
                    { label: 'Delivered', val: `${deliveryRate}%`, color: '#10b981' },
                    { label: 'Read Rate', val: `${readRate}%`, color: '#f59e0b' },
                    { label: 'CTR', val: `${ctr}%`, color: '#06b6d4' },
                    { label: 'Revenue', val: revenue > 0 ? `₹${revenue.toLocaleString()}` : '–', color: '#00d9a5' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-bold text-sm" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-[10px] text-surface-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-surface-700 sticky top-0 bg-surface-900 z-10">
              <h2 className="text-lg font-bold text-white">New Ecommerce Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Campaign Name <span className="text-red-400">*</span></label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Summer Sale Campaign" className="input-field w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Campaign Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="input-field w-full">
                    {Object.entries(typeCfg).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Store</label>
                  <select value={form.storeId} onChange={e => setForm(p => ({ ...p, storeId: e.target.value }))} className="input-field w-full">
                    <option value="all">All Stores</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Target Audience</label>
                <select value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value }))} className="input-field w-full">
                  {audienceSegments.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">WhatsApp Template <span className="text-red-400">*</span></label>
                <select value={form.template} onChange={e => setForm(p => ({ ...p, template: e.target.value }))} className="input-field w-full">
                  <option value="">Select an approved template...</option>
                  {templates.filter(t => t.status === 'APPROVED').map(t => (
                    <option key={t.id} value={t.name}>{t.displayName || t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-surface-700 sticky bottom-0 bg-surface-900">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={creating || !form.name || !form.template}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all disabled:opacity-50">
                {creating ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                {creating ? 'Creating…' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
