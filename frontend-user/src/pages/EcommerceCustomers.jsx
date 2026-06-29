import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Download, MessageSquare, Eye, ShoppingCart, X, Phone, Mail, MapPin, RefreshCw, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

const segmentConfig = {
  vip:    { label: 'VIP',     color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20', hex: '#f59e0b' },
  loyal:  { label: 'Loyal',   color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20',  hex: '#3b82f6' },
  new:    { label: 'New',     color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20', hex: '#10b981' },
  atrisk: { label: 'At Risk', color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',   hex: '#ef4444' },
};

export default function EcommerceCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [platform, setPlatform] = useState('');
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 6;
  const [stats, setStats] = useState({ total: 0, vip: 0, loyal: 0, new: 0, atrisk: 0 });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      // We pass the segment/search to API if supported, or fetch and filter if simple MVP
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/customers`, {
        headers,
        params: { page, limit: perPage, search, platform } // add segment if backend supports
      });
      
      // Mock segments for now if backend doesn't return them directly
      const formattedCustomers = res.data.customers.map(c => ({
        ...c,
        segment: c.totalSpent > 15000 ? 'vip' : c.totalSpent > 5000 ? 'loyal' : 'new'
      }));

      // In real scenario we apply segment filter here if backend doesn't
      let filtered = formattedCustomers;
      if (segment && segment !== 'all') {
        filtered = filtered.filter(c => c.segment === segment);
      }

      setCustomers(filtered);
      setTotalPages(Math.ceil(res.data.total / perPage));

      // Calculate stats (would be better from backend)
      setStats({
        total: res.data.total,
        vip: formattedCustomers.filter(c => c.segment === 'vip').length,
        loyal: formattedCustomers.filter(c => c.segment === 'loyal').length,
        new: formattedCustomers.filter(c => c.segment === 'new').length,
        atrisk: formattedCustomers.filter(c => c.segment === 'atrisk').length,
      });

      const storesRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores`, { headers });
      setStores(storesRes.data.stores);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, platform, segment]);

  const handleSync = async () => {
    if (stores.length === 0) return alert('No stores connected to sync.');
    setSyncing(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      const store = stores[0]; // Sync first store
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores/${store.id}/sync`, { type: 'customers' }, { headers });
      fetchCustomers();
    } catch (err) {
      alert('Sync failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (customers.length === 0) return;
    const csvContentBody = "Name,Phone,Email,Orders,Total Spent\n"
      + customers.map(e => `"${e.name || ''}","${e.phone || ''}","${e.email || ''}","${e.totalOrders || 0}","${e.totalSpent || 0}"`).join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContentBody);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "customers_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendWhatsApp = async (customer) => {
    setSending(p => ({ ...p, [customer.id]: true }));
    try {
      const token = localStorage.getItem('userToken');
      // Replace this with actual customer messaging endpoint
      await new Promise(r => setTimeout(r, 1000));
      alert(`Message successfully triggered to ${customer.name}`);
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSending(p => { const n = { ...p }; delete n[customer.id]; return n; });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Users size={18} className="text-brand-400" />
            </div>
            Customers
          </h1>
          <p className="text-surface-400 text-sm mt-1">All customers synced from your connected stores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ key: '', label: 'All', count: stats.total, hex: '#818cf8' },
          { key: 'vip', label: 'VIP', count: stats.vip, hex: '#f59e0b' },
          { key: 'loyal', label: 'Loyal', count: stats.loyal, hex: '#3b82f6' },
          { key: 'new', label: 'New', count: stats.new, hex: '#10b981' },
          { key: 'atrisk', label: 'At Risk', count: stats.atrisk, hex: '#ef4444' },
        ].map(s => (
          <button key={s.key} onClick={() => { setSegment(s.key); setPage(1); }}
            className={`p-3 rounded-xl border text-left transition-all duration-200 ${segment === s.key ? 'scale-[1.02]' : 'border-surface-700 hover:border-surface-500'}`}
            style={segment === s.key ? { borderColor: s.hex + '60', background: s.hex + '12' } : {}}>
            <p className="text-xl font-bold" style={{ color: s.hex }}>{s.count}</p>
            <p className="text-xs text-surface-400 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" placeholder="Search by name, phone, email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
        </div>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}
          className="bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-300 focus:outline-none focus:border-brand-500/50">
          <option value="">All Platforms</option>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
        </select>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
           <div className="col-span-3 text-center py-16 text-surface-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-surface-500">
            <Users size={48} className="mx-auto mb-4 opacity-30" />
            <p>No customers found</p>
          </div>
        ) : customers.map(c => {
          const sc = segmentConfig[c.segment] || segmentConfig.new;
          return (
            <div key={c.id} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-brand-500/20 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500/40 to-indigo-500/40 flex items-center justify-center font-bold text-white text-sm border border-white/10">
                    {c.name ? c.name.split(' ').map(n => n[0]).join('') : 'C'}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{c.name}</p>
                    <p className="text-xs text-surface-500">{c.city || 'Unknown Location'}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium border ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
              </div>
              <div className="space-y-1 mb-3 text-xs text-surface-400">
                <div className="flex items-center gap-2"><Phone size={11} /><span>{c.phone || 'N/A'}</span></div>
                <div className="flex items-center gap-2"><Mail size={11} /><span className="truncate">{c.email || 'N/A'}</span></div>
                <div className="flex items-center gap-2"><MapPin size={11} /><span>{c.store?.storeName || 'Store'}</span></div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-xs text-surface-400"><ShoppingCart size={11} /><span>{c.totalOrders} orders</span></div>
                <span className="text-sm font-bold text-brand-400">₹{parseFloat(c.totalSpent).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(c.tags || []).map(t => <span key={t} className="px-1.5 py-0.5 text-[10px] bg-surface-700 text-surface-400 rounded-md">{t}</span>)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/ecommerce/campaigns')} title="Create a WhatsApp Campaign for this customer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 text-xs transition-all">
                  <TrendingUp size={11} /> Promote
                </button>
                <button onClick={() => setSelected(c)} title="View customer profile"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-surface-600 text-surface-400 hover:text-white text-xs transition-all">
                  <Eye size={11} /> View
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors"><ChevronLeft size={16} /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-brand-500 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-white">Customer Profile</h2>
              <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500/40 to-indigo-500/40 flex items-center justify-center font-bold text-white text-xl border border-white/10">
                  {selected.name ? selected.name.split(' ').map(n => n[0]).join('') : 'C'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selected.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${segmentConfig[selected.segment]?.color} ${segmentConfig[selected.segment]?.bg} ${segmentConfig[selected.segment]?.border}`}>
                    {segmentConfig[selected.segment]?.label}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Phone', value: selected.phone || 'N/A' }, { label: 'Email', value: selected.email || 'N/A' }, { label: 'City', value: selected.city || 'Unknown' }, { label: 'Platform', value: selected.store?.storeName }, { label: 'Total Orders', value: selected.totalOrders }, { label: 'Total Spent', value: `₹${parseFloat(selected.totalSpent).toLocaleString()}` }, { label: 'Last Order', value: new Date(selected.updatedAt).toLocaleDateString() }].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-surface-500">{d.label}</p>
                    <p className="text-sm font-medium text-surface-100 mt-0.5">{d.value}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => { setSelected(null); navigate('/ecommerce/campaigns'); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all">
                <TrendingUp size={15} /> Create WhatsApp Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
