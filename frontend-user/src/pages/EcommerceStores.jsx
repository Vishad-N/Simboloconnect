import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Store, Plus, ShoppingBag, Box, CheckCircle2, AlertTriangle, X, RefreshCw,
  Trash2, Settings, ExternalLink, Zap, Shield, Clock, ChevronRight, Copy, Eye, EyeOff
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Toast component
function Toast({ toasts, remove }) {
  return (
    <div className="fixed top-6 right-6 z-[100] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border animate-in slide-in-from-right
          ${t.type === 'success' ? 'bg-green-900/90 border-green-500/40 text-green-200' : t.type === 'error' ? 'bg-red-900/90 border-red-500/40 text-red-200' : 'bg-surface-800 border-surface-600 text-surface-200'}`}>
          {t.type === 'success' ? <CheckCircle2 size={16} className="text-green-400" /> : <AlertTriangle size={16} className="text-red-400" />}
          {t.message}
          <button onClick={() => remove(t.id)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = (message, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  return { toasts, add, remove: (id) => setToasts(p => p.filter(t => t.id !== id)) };
}

const platformColors = { shopify: '#96bf48', woocommerce: '#7f54b3' };
const platformLabels = { shopify: 'Shopify', woocommerce: 'WooCommerce' };

export default function EcommerceStores() {
  const [stores, setStores] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPlatform, setAddPlatform] = useState(null);
  const [form, setForm] = useState({ storeUrl: '', apiKey: '', apiSecret: '', accessToken: '', consumerKey: '', consumerSecret: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const { toasts, add, remove } = useToasts();

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ storeName: '', accessToken: '', apiKey: '', apiSecret: '', consumerKey: '', consumerSecret: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showSecretSettings, setShowSecretSettings] = useState({});

  const handleOpenSettings = (store) => {
    setSelectedStore(store);
    setSettingsForm({
      storeName: store.storeName || '',
      accessToken: '',
      apiKey: store.apiKey || '',
      apiSecret: '',
      consumerKey: store.platform === 'woocommerce' ? store.accessToken || '' : '',
      consumerSecret: '',
    });
    setShowSecretSettings({});
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsForm.storeName.trim()) {
      add('Store name is required', 'error');
      return;
    }
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      await axios.put(`${API}/api/ecommerce/stores/${selectedStore.id}`, {
        storeName: settingsForm.storeName,
        accessToken: selectedStore.platform === 'shopify' ? settingsForm.accessToken : undefined,
        apiKey: selectedStore.platform === 'shopify' ? settingsForm.apiKey : undefined,
        apiSecret: selectedStore.platform === 'shopify' ? settingsForm.apiSecret : undefined,
        consumerKey: selectedStore.platform === 'woocommerce' ? settingsForm.consumerKey : undefined,
        consumerSecret: selectedStore.platform === 'woocommerce' ? settingsForm.consumerSecret : undefined,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      add('Store settings updated successfully!', 'success');
      setShowSettingsModal(false);
      fetchStores();
    } catch (e) {
      add(e.response?.data?.message || 'Failed to update store settings.', 'error');
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchStores = async () => {
    setFetchLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await axios.get(`${API}/api/ecommerce/stores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStores(res.data.stores || []);
    } catch (err) {
      console.error('Failed to load stores', err);
      setStores([]);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleConnect = async () => {
    if (addPlatform === 'shopify' && (!form.storeUrl || !form.accessToken)) {
      add('Store URL and Access Token are required', 'error'); return;
    }
    if (addPlatform === 'woocommerce' && (!form.storeUrl || !form.consumerKey || !form.consumerSecret)) {
      add('All WooCommerce fields are required', 'error'); return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const payload = addPlatform === 'shopify'
        ? { platform: 'shopify', domain: form.storeUrl, accessToken: form.accessToken, apiKey: form.apiKey, apiSecret: form.apiSecret }
        : { platform: 'woocommerce', domain: form.storeUrl, consumerKey: form.consumerKey, consumerSecret: form.consumerSecret };
      const res = await axios.post(`${API}/api/ecommerce/stores/connect`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.store) {
        setStores(p => [...p, res.data.store]);
        add('Store connected successfully!', 'success');
      }
      setShowAddModal(false);
      setForm({ storeUrl: '', apiKey: '', apiSecret: '', accessToken: '', consumerKey: '', consumerSecret: '' });
      fetchStores();
    } catch (e) {
      add(e.response?.data?.message || 'Connection failed. Check credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (storeId, type) => {
    setSyncing(p => ({ ...p, [`${storeId}_${type}`]: true }));
    try {
      const token = localStorage.getItem('userToken');
      await axios.post(`${API}/api/ecommerce/stores/${storeId}/sync`, { type }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      add(`${type} synced successfully!`, 'success');
    } catch {
      add(`Sync failed. Please try again.`, 'error');
    } finally {
      setTimeout(() => setSyncing(p => ({ ...p, [`${storeId}_${type}`]: false })), 1200);
    }
  };

  const handleDisconnect = async (storeId) => {
    if (!window.confirm('Disconnect this store? All synced data will be retained.')) return;
    try {
      const token = localStorage.getItem('userToken');
      await axios.delete(`${API}/api/ecommerce/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStores(p => p.filter(s => s.id !== storeId));
      add('Store disconnected successfully', 'success');
    } catch (err) {
      add(err.response?.data?.message || 'Failed to disconnect store', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Toast toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Store size={18} className="text-brand-400" />
            </div>
            Stores
          </h1>
          <p className="text-surface-400 text-sm mt-1">Manage all your connected ecommerce stores</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-brand-500/25">
          <Plus size={18} /> Connect Store
        </button>
      </div>

      {/* Stores Grid */}
      {fetchLoading ? (
        <div className="glass-panel rounded-2xl border border-surface-700 py-20 text-center">
          <RefreshCw size={32} className="mx-auto mb-4 text-brand-400 animate-spin" />
          <p className="text-surface-400">Loading stores...</p>
        </div>
      ) : stores.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-surface-700 py-20 text-center">
          <Store size={56} className="mx-auto mb-4 text-surface-600" />
          <h3 className="text-xl font-bold text-surface-300 mb-2">No stores connected</h3>
          <p className="text-surface-500 mb-6">Connect your Shopify or WooCommerce store to start automating</p>
          <button onClick={() => setShowAddModal(true)}
            className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all">
            <Plus size={16} className="inline mr-2" />Connect Store
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stores.map(store => (
            <StoreCard key={store.id} store={store} onSync={handleSync} onDisconnect={handleDisconnect} onOpenSettings={handleOpenSettings} syncing={syncing} />
          ))}
          {/* Add new store card */}
          <button onClick={() => setShowAddModal(true)}
            className="glass-panel rounded-2xl border-2 border-dashed border-surface-600 hover:border-brand-500/50 p-8 flex flex-col items-center justify-center gap-3 text-surface-500 hover:text-brand-400 transition-all duration-200 group">
            <div className="w-12 h-12 rounded-xl border-2 border-dashed border-surface-600 group-hover:border-brand-500/50 flex items-center justify-center">
              <Plus size={22} />
            </div>
            <span className="font-medium">Connect Another Store</span>
          </button>
        </div>
      )}

      {/* Add Store Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-surface-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Connect Store</h2>
              <button onClick={() => { setShowAddModal(false); setAddPlatform(null); }}
                className="text-surface-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            {!addPlatform ? (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <p className="text-surface-400 text-sm">Choose your ecommerce platform</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'shopify', label: 'Shopify', icon: ShoppingBag, color: '#96bf48', desc: 'Connect via API Token or OAuth' },
                    { id: 'woocommerce', label: 'WooCommerce', icon: Box, color: '#7f54b3', desc: 'Connect via REST API keys' },
                  ].map(p => (
                    <button key={p.id} onClick={() => setAddPlatform(p.id)}
                      className="p-5 rounded-xl border-2 border-surface-700 hover:border-opacity-80 transition-all duration-200 text-left group"
                      style={{ '--hover-color': p.color }}>
                      <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ background: p.color + '22' }}>
                        <p.icon size={22} style={{ color: p.color }} />
                      </div>
                      <p className="font-bold text-white">{p.label}</p>
                      <p className="text-xs text-surface-400 mt-1">{p.desc}</p>
                      <ChevronRight size={16} className="mt-2 text-surface-500 group-hover:text-white transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : addPlatform === 'shopify' ? (
              <ShopifyConnectForm form={form} setForm={setForm} loading={loading} onConnect={handleConnect} onBack={() => setAddPlatform(null)} showSecret={showSecret} setShowSecret={setShowSecret} />
            ) : (
              <WooConnectForm form={form} setForm={setForm} loading={loading} onConnect={handleConnect} onBack={() => setAddPlatform(null)} showSecret={showSecret} setShowSecret={setShowSecret} />
            )}
          </div>
        </div>
      )}

      {/* Store Settings Modal */}
      {showSettingsModal && selectedStore && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-surface-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Store Settings</h2>
              <button onClick={() => { setShowSettingsModal(false); setSelectedStore(null); }}
                className="text-surface-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Store Name</label>
                <input type="text" value={settingsForm.storeName}
                  onChange={e => setSettingsForm(p => ({ ...p, storeName: e.target.value }))}
                  placeholder="Store Display Name" className="input-field w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Store URL (Read-only)</label>
                <input type="text" value={selectedStore.domain} disabled
                  className="input-field w-full opacity-60 cursor-not-allowed" />
              </div>

              {selectedStore.platform === 'shopify' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">API Key (Optional)</label>
                    <input type="text" value={settingsForm.apiKey}
                      onChange={e => setSettingsForm(p => ({ ...p, apiKey: e.target.value }))}
                      placeholder="shpat_xxxxxx" className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">API Secret (Optional / Leave blank to keep current)</label>
                    <div className="relative">
                      <input type={showSecretSettings.apiSecret ? 'text' : 'password'} value={settingsForm.apiSecret}
                        onChange={e => setSettingsForm(p => ({ ...p, apiSecret: e.target.value }))}
                        placeholder="••••••••••••••••" className="input-field w-full pr-10" />
                      <button type="button" onClick={() => setShowSecretSettings(p => ({ ...p, apiSecret: !p.apiSecret }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                        {showSecretSettings.apiSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Admin Access Token (Leave blank to keep current)</label>
                    <div className="relative">
                      <input type={showSecretSettings.accessToken ? 'text' : 'password'} value={settingsForm.accessToken}
                        onChange={e => setSettingsForm(p => ({ ...p, accessToken: e.target.value }))}
                        placeholder="••••••••••••••••" className="input-field w-full pr-10" />
                      <button type="button" onClick={() => setShowSecretSettings(p => ({ ...p, accessToken: !p.accessToken }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                        {showSecretSettings.accessToken ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Consumer Key</label>
                    <input type="text" value={settingsForm.consumerKey}
                      onChange={e => setSettingsForm(p => ({ ...p, consumerKey: e.target.value }))}
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx" className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Consumer Secret (Leave blank to keep current)</label>
                    <div className="relative">
                      <input type={showSecretSettings.consumerSecret ? 'text' : 'password'} value={settingsForm.consumerSecret}
                        onChange={e => setSettingsForm(p => ({ ...p, consumerSecret: e.target.value }))}
                        placeholder="••••••••••••••••" className="input-field w-full pr-10" />
                      <button type="button" onClick={() => setShowSecretSettings(p => ({ ...p, consumerSecret: !p.consumerSecret }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                        {showSecretSettings.consumerSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-surface-700 flex-shrink-0">
              <button onClick={() => setShowSettingsModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSaveSettings} disabled={settingsLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-all">
                {settingsLoading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {settingsLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreCard({ store, onSync, onDisconnect, onOpenSettings, syncing }) {
  const [expanded, setExpanded] = useState(false);
  const color = platformColors[store.platform];
  const syncTypes = ['orders', 'products', 'customers'];

  return (
    <div className="glass-panel rounded-2xl border border-surface-700 hover:border-opacity-60 transition-all duration-300"
      style={{ '--hover-bc': color }}>
      <div className="p-5">
        {/* Store Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
              {store.platform === 'shopify' ? <ShoppingBag size={20} style={{ color }} /> : <Box size={20} style={{ color }} />}
            </div>
            <div>
              <h3 className="font-bold text-white">{store.storeName}</h3>
              <p className="text-xs text-surface-400">{store.domain}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs rounded-full font-medium bg-green-500/15 text-green-400 border border-green-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Connected
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Orders', value: (store.orders || 0).toLocaleString() },
            { label: 'Products', value: store.products || 0 },
            { label: 'Customers', value: (store.customers || 0).toLocaleString() },
            { label: 'Revenue', value: `₹${((store.revenue || 0) / 1000).toFixed(0)}K` },
          ].map(s => (
            <div key={s.label} className="bg-surface-800 rounded-xl p-2.5 text-center">
              <p className="text-base font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-surface-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sync Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {syncTypes.map(type => (
            <button key={type} onClick={() => onSync(store.id, type)}
              disabled={syncing[`${store.id}_${type}`]}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-surface-600 text-surface-300 hover:border-brand-500/40 hover:text-brand-400 transition-all">
              <RefreshCw size={12} className={syncing[`${store.id}_${type}`] ? 'animate-spin' : ''} />
              {syncing[`${store.id}_${type}`] ? 'Syncing...' : `Sync ${type.charAt(0).toUpperCase() + type.slice(1)}`}
            </button>
          ))}
        </div>

        {/* Info Row */}
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span className="flex items-center gap-1"><Clock size={11} /> Connected {store.connectedAt}</span>
          <span className="flex items-center gap-1"><Shield size={11} /> {store.webhooks} webhooks active</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-surface-700">
        <a href={`https://${store.domain}`} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 text-xs text-surface-400 hover:text-white hover:bg-surface-800 transition-colors border-r border-surface-700">
          <ExternalLink size={13} /> Open Store
        </a>
        <button onClick={() => onOpenSettings(store)}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-xs text-surface-400 hover:text-white hover:bg-surface-800 transition-colors border-r border-surface-700">
          <Settings size={13} /> Settings
        </button>
        <button onClick={() => onDisconnect(store.id)}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors">
          <Trash2 size={13} /> Disconnect
        </button>
      </div>
    </div>
  );
}

function ShopifyConnectForm({ form, setForm, loading, onConnect, onBack, showSecret, setShowSecret }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        <button onClick={onBack} className="text-xs text-surface-400 hover:text-white flex items-center gap-1 mb-2">← Back</button>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#96bf48]/10 border border-[#96bf48]/20 mb-2">
          <ShoppingBag size={20} className="text-[#96bf48]" />
          <div>
            <p className="font-semibold text-white text-sm">Connect Shopify Store</p>
            <p className="text-xs text-surface-400">Enter your Shopify credentials below</p>
          </div>
        </div>
        {[
          { key: 'storeUrl', label: 'Store URL', placeholder: 'your-store.myshopify.com', required: true },
          { key: 'apiKey', label: 'API Key', placeholder: 'shpat_xxxxxx (Optional)' },
          { key: 'apiSecret', label: 'API Secret', placeholder: 'API Secret (Optional)', secret: true },
          { key: 'accessToken', label: 'Admin Access Token', placeholder: 'shpat_xxxxxxxxxxxxxx', required: true, secret: true },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              {f.label} {f.required && <span className="text-red-400">*</span>}
            </label>
            <div className="relative">
              <input type={f.secret && !showSecret[f.key] ? 'password' : 'text'}
                value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className="input-field w-full pr-10" />
              {f.secret && (
                <button type="button" onClick={() => setShowSecret(p => ({ ...p, [f.key]: !p[f.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                  {showSecret[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          </div>
        ))}
        {/* Required Permissions Panel */}
        <div className="rounded-xl border border-[#96bf48]/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#96bf48]/10 border-b border-[#96bf48]/20">
            <Shield size={14} className="text-[#96bf48]" />
            <span className="text-sm font-semibold text-white">Required API Permissions</span>
          </div>
          <div className="divide-y divide-surface-700/60">
            {[
              {
                resource: 'Orders',
                icon: '🛒',
                access: 'Read & Write',
                scope: 'read_orders, write_orders',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
                dot: 'bg-blue-400',
              },
              {
                resource: 'Customers',
                icon: '👤',
                access: 'Read',
                scope: 'read_customers',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10 border-purple-500/20',
                dot: 'bg-purple-400',
              },
              {
                resource: 'Products',
                icon: '📦',
                access: 'Read',
                scope: 'read_products',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
                dot: 'bg-amber-400',
              },
            ].map(p => (
              <div key={p.resource} className="flex items-center justify-between px-4 py-2.5 bg-surface-800/60">
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{p.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.resource}</p>
                    <p className="text-[10px] text-surface-500 font-mono mt-0.5">{p.scope}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${p.bg} ${p.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  {p.access}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step guide */}
        <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400 space-y-1">
          <p className="font-medium text-surface-300">How to get credentials:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to Shopify Admin → Settings → Apps and sales channels</li>
            <li>Click "Develop apps" → "Create an app"</li>
            <li>Under "Admin API access scopes" enable the permissions above</li>
            <li>Install app and copy the Admin API access token</li>
          </ol>
        </div>
      </div>
      <div className="flex gap-3 p-6 border-t border-surface-700 flex-shrink-0">
        <button onClick={onBack} className="btn-secondary flex-1">Cancel</button>
        <button onClick={onConnect} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#96bf48] hover:bg-[#7ea33c] text-white font-semibold transition-all">
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          {loading ? 'Connecting...' : 'Connect Shopify'}
        </button>
      </div>
    </div>
  );
}

function WooConnectForm({ form, setForm, loading, onConnect, onBack, showSecret, setShowSecret }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        <button onClick={onBack} className="text-xs text-surface-400 hover:text-white flex items-center gap-1 mb-2">← Back</button>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#7f54b3]/10 border border-[#7f54b3]/20 mb-2">
          <Box size={20} className="text-[#7f54b3]" />
          <div>
            <p className="font-semibold text-white text-sm">Connect WooCommerce Store</p>
            <p className="text-xs text-surface-400">Enter your WooCommerce REST API credentials</p>
          </div>
        </div>
        {[
          { key: 'storeUrl', label: 'WordPress Site URL', placeholder: 'https://your-store.com', required: true },
          { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_xxxxxxxxxxxxxxxxxxxxxxxx', required: true },
          { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_xxxxxxxxxxxxxxxxxxxxxxxx', required: true, secret: true },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              {f.label} {f.required && <span className="text-red-400">*</span>}
            </label>
            <div className="relative">
              <input type={f.secret && !showSecret[f.key] ? 'password' : 'text'}
                value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className="input-field w-full pr-10" />
              {f.secret && (
                <button type="button" onClick={() => setShowSecret(p => ({ ...p, [f.key]: !p[f.key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                  {showSecret[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400 space-y-1">
          <p className="font-medium text-surface-300">How to get credentials:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>WordPress Admin → WooCommerce → Settings → Advanced → REST API</li>
            <li>Click "Add key" → Set description and permissions to Read/Write</li>
            <li>Copy Consumer Key and Consumer Secret</li>
          </ol>
        </div>
      </div>
      <div className="flex gap-3 p-6 border-t border-surface-700 flex-shrink-0">
        <button onClick={onBack} className="btn-secondary flex-1">Cancel</button>
        <button onClick={onConnect} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7f54b3] hover:bg-[#6b4699] text-white font-semibold transition-all">
          {loading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          {loading ? 'Connecting...' : 'Connect WooCommerce'}
        </button>
      </div>
    </div>
  );
}
