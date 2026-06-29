import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShoppingBag, Settings, AlertTriangle, CheckCircle2, X, Save,
  RefreshCw, ShoppingCart, Users, Package, Search, ChevronDown,
  MessageSquare, TrendingUp, Shield
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const ShopifyIntegration = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({ storeUrl: '', apiKey: '', apiSecret: '', accessToken: '' });
  const [savedConfig, setSavedConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [syncing, setSyncing] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('shopify_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSavedConfig(parsed);
      setConfig(parsed);
      if (parsed.storeUrl && parsed.accessToken) setConnected(true);
    }
  }, []);

  const handleSave = () => {
    if (!config.storeUrl || !config.accessToken) {
      alert('Store URL and Access Token are required.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('shopify_config', JSON.stringify(config));
      setSavedConfig(config);
      setConnected(true);
      setShowSettings(false);
      setLoading(false);
    }, 800);
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect Shopify?')) {
      localStorage.removeItem('shopify_config');
      setSavedConfig(null);
      setConfig({ storeUrl: '', apiKey: '', apiSecret: '', accessToken: '' });
      setConnected(false);
    }
  };

  const handleSync = async (type) => {
    setSyncing(type);
    try {
      await axios.post(`${API}/api/ecommerce/stores/sync`, { type });
    } catch (_) {}
    setTimeout(() => setSyncing(''), 1500);
  };

  const tabs = [
    { id: 'orders',    label: 'Orders',    icon: ShoppingCart, color: 'text-blue-400',   badge: '0' },
    { id: 'customers', label: 'Customers', icon: Users,         color: 'text-purple-400', badge: '0' },
    { id: 'products',  label: 'Products',  icon: Package,       color: 'text-amber-400',  badge: '0' },
  ];

  const permissions = [
    { resource: 'Orders',    icon: '🛒', access: 'Read & Write', scope: 'read_orders, write_orders',  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     dot: 'bg-blue-400' },
    { resource: 'Customers', icon: '👤', access: 'Read',         scope: 'read_customers',              color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400' },
    { resource: 'Products',  icon: '📦', access: 'Read',         scope: 'read_products',               color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   dot: 'bg-amber-400' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center bg-gradient-to-r from-[#96bf48]/20 to-[#96bf48]/5 p-6 rounded-2xl border border-[#96bf48]/30">
        <h1 className="text-3xl font-bold font-display text-[#96bf48] flex items-center gap-3">
          <ShoppingBag size={32} /> Shopify Dashboard
        </h1>
        <button onClick={() => setShowSettings(true)} className="btn-secondary flex items-center gap-2">
          <Settings size={16} /> Settings
        </button>
      </div>

      {connected ? (
        <div className="space-y-6">

          {/* Connected Banner */}
          <div className="glass-panel p-4 rounded-2xl border border-green-500/30 bg-green-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-green-400" />
              <div>
                <p className="text-green-400 font-semibold">Connected to Shopify</p>
                <p className="text-surface-400 text-sm">Store: {savedConfig?.storeUrl}</p>
              </div>
            </div>
            <button onClick={handleDisconnect} className="text-red-400 text-sm border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
              Disconnect
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Orders',    value: '0', sub: 'Read & Write', icon: ShoppingCart, color: 'text-blue-400',   border: 'border-blue-500/20',   bg: 'bg-blue-500/10' },
              { label: 'Customers',       value: '0', sub: 'Read Only',    icon: Users,         color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/10' },
              { label: 'Products',        value: '0', sub: 'Read Only',    icon: Package,       color: 'text-amber-400',  border: 'border-amber-500/20',  bg: 'bg-amber-500/10' },
            ].map(s => (
              <div key={s.label} className={`glass-panel p-5 rounded-2xl border ${s.border} ${s.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-sm font-medium ${s.color}`}>{s.label}</p>
                  <s.icon size={18} className={s.color} />
                </div>
                <h3 className={`text-3xl font-bold ${s.color}`}>{s.value}</h3>
                <p className="text-xs text-surface-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
            {/* Tab Header */}
            <div className="flex border-b border-surface-700 bg-surface-900/50">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all border-b-2 ${
                    activeTab === tab.id
                      ? `border-[#96bf48] ${tab.color} bg-[#96bf48]/5`
                      : 'border-transparent text-surface-400 hover:text-white hover:bg-surface-800/40'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-[#96bf48]/20 text-[#96bf48]' : 'bg-surface-700 text-surface-400'}`}>
                    {tab.badge}
                  </span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-5 gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={`Search ${activeTab}...`}
                    className="w-full pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-[#96bf48]/40"
                  />
                </div>
                <button
                  onClick={() => handleSync(activeTab)}
                  disabled={!!syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#96bf48] hover:bg-[#7ea33c] text-white text-sm font-semibold transition-all disabled:opacity-60"
                >
                  <RefreshCw size={14} className={syncing === activeTab ? 'animate-spin' : ''} />
                  {syncing === activeTab ? 'Syncing...' : `Sync ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                </button>
              </div>

              {/* Empty State */}
              <div className="text-center py-12 text-surface-400">
                {activeTab === 'orders' && (
                  <>
                    <ShoppingCart size={48} className="mx-auto mb-3 opacity-20 text-blue-400" />
                    <p className="font-semibold text-white mb-1">No orders synced yet</p>
                    <p className="text-sm">Click "Sync Orders" to fetch your Shopify orders.</p>
                    <p className="text-xs mt-1 text-surface-500">Permissions: read_orders, write_orders</p>
                  </>
                )}
                {activeTab === 'customers' && (
                  <>
                    <Users size={48} className="mx-auto mb-3 opacity-20 text-purple-400" />
                    <p className="font-semibold text-white mb-1">No customers synced yet</p>
                    <p className="text-sm">Click "Sync Customers" to import your Shopify customers.</p>
                    <p className="text-xs mt-1 text-surface-500">Permissions: read_customers</p>
                  </>
                )}
                {activeTab === 'products' && (
                  <>
                    <Package size={48} className="mx-auto mb-3 opacity-20 text-amber-400" />
                    <p className="font-semibold text-white mb-1">No products synced yet</p>
                    <p className="text-sm">Click "Sync Products" to import your Shopify catalog.</p>
                    <p className="text-xs mt-1 text-surface-500">Permissions: read_products</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* API Permissions Panel */}
          <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-surface-700 bg-surface-800/60">
              <Shield size={15} className="text-[#96bf48]" />
              <span className="text-sm font-semibold text-white">API Access Permissions</span>
            </div>
            <div className="divide-y divide-surface-700/60">
              {permissions.map(p => (
                <div key={p.resource} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">{p.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{p.resource}</p>
                      <p className="text-[11px] text-surface-500 font-mono mt-0.5">{p.scope}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${p.bg} ${p.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    {p.access}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-6">
          {/* Not Connected */}
          <div className="glass-panel p-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex flex-col items-start gap-4">
              <p className="text-yellow-400 font-medium flex items-center gap-2">
                <AlertTriangle size={20} /> Not Connected! Please connect your Shopify store.
              </p>
              <button onClick={() => setShowSettings(true)} className="bg-[#96bf48] hover:bg-[#7ea33c] text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                Connect Shopify
              </button>
            </div>
          </div>

          {/* Required Permissions (shown before connect too) */}
          <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-surface-700 bg-surface-800/60">
              <Shield size={15} className="text-[#96bf48]" />
              <span className="text-sm font-semibold text-white">Required API Permissions</span>
              <span className="ml-auto text-xs text-surface-500">Enable these in Shopify Admin when creating your app</span>
            </div>
            <div className="divide-y divide-surface-700/60">
              {permissions.map(p => (
                <div key={p.resource} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">{p.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{p.resource}</p>
                      <p className="text-[11px] text-surface-500 font-mono mt-0.5">{p.scope}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${p.bg} ${p.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    {p.access}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-surface-700 sticky top-0 bg-surface-900 z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingBag size={22} className="text-[#96bf48]" /> Shopify Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-surface-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: 'storeUrl',     label: 'Store URL',          placeholder: 'your-store.myshopify.com', required: true,  type: 'text' },
                { key: 'apiKey',       label: 'API Key',            placeholder: 'API Key (optional)',       required: false, type: 'text' },
                { key: 'apiSecret',    label: 'API Secret',         placeholder: 'API Secret (optional)',    required: false, type: 'password' },
                { key: 'accessToken',  label: 'Admin Access Token', placeholder: 'shpat_xxxxxxxxxxxxxxxxx',  required: true,  type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={f.type}
                    value={config[f.key]}
                    onChange={e => setConfig({ ...config, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="input-field w-full"
                  />
                </div>
              ))}

              {/* Permissions inside modal */}
              <div className="rounded-xl border border-[#96bf48]/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#96bf48]/10 border-b border-[#96bf48]/20">
                  <Shield size={13} className="text-[#96bf48]" />
                  <span className="text-xs font-semibold text-white">Required API Permissions</span>
                </div>
                <div className="divide-y divide-surface-700/50">
                  {permissions.map(p => (
                    <div key={p.resource} className="flex items-center justify-between px-4 py-2.5 bg-surface-800/60">
                      <div className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-white">{p.resource}</p>
                          <p className="text-[10px] text-surface-500 font-mono">{p.scope}</p>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${p.bg} ${p.color}`}>
                        <span className={`w-1 h-1 rounded-full ${p.dot}`} /> {p.access}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400 space-y-1">
                <p className="font-medium text-surface-300">How to get credentials:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Shopify Admin → Settings → Apps and sales channels</li>
                  <li>Click "Develop apps" → "Create an app"</li>
                  <li>Under Admin API scopes, enable permissions above</li>
                  <li>Install app → copy Admin API access token</li>
                </ol>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-surface-700">
              <button onClick={() => setShowSettings(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#96bf48] hover:bg-[#7ea33c] text-white font-semibold transition-all">
                {loading ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                {loading ? 'Saving...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopifyIntegration;
