import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Inline toast system
const useToast = () => {
    const [toasts, setToasts] = useState([]);
    const addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    };
    return { toasts, toast: { success: (m) => addToast(m, 'success'), error: (m) => addToast(m, 'error') } };
};

const ToastContainer = ({ toasts }) => (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse ${
                t.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-red-500 text-white'
            }`}>
                {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
        ))}
    </div>
);

const FreshVoiceProviders = () => {
    const [providers, setProviders] = useState([]);
    const [configs, setConfigs] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const { toasts, toast } = useToast();

    // Test Call states
    const [testPhones, setTestPhones] = useState({});
    const [testingId, setTestingId] = useState(null);
    const [syncingId, setSyncingId] = useState(null);
    const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const provRes = await axios.get(`${API}/api/voice/providers`, { headers });
            const data = provRes.data || [];
            
            // Append Custom Provider dynamically
            if (!data.find(p => p.slug === 'custom')) {
                data.push({
                    id: 'custom-temp-id',
                    name: 'Custom Webhook',
                    slug: 'custom',
                    enabled: true,
                    sandboxMode: false,
                    agentCount: 0,
                    userConfig: null
                });
            }

            setProviders(data);
            
            const initialConfigs = {};
            data.forEach(p => {
                initialConfigs[p.id] = {
                    apiKey: '',
                    agentId: p.userConfig?.agentId || '',
                    voiceId: p.userConfig?.voiceId || '',
                    active: p.userConfig ? (p.userConfig.active ?? true) : false
                };
            });
            setConfigs(prev => ({ ...initialConfigs, ...prev }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const saveConfig = async (providerId) => {
        const cfg = configs[providerId] || {};
        const prov = providers.find(p => p.id === providerId);
        if (!cfg.apiKey && !prov?.userConfig?.apiKeyConfigured) {
            return toast.error('API Key is required to save configuration');
        }

        if (providerId === 'custom-temp-id') {
            return toast.error('Please run the backend seed script to register Custom Webhook first');
        }

        setSavingId(providerId);
        try {
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, cfg, { headers });
            toast.success('Configuration saved securely!');
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save configuration');
        } finally {
            setSavingId(null);
        }
    };

    const triggerTestCall = async (providerId) => {
        const phone = testPhones[providerId];
        if (!phone) return toast.error('Please enter a phone number to test');
        setTestingId(providerId);
        try {
            await axios.post(`${API}/api/voice/providers/${providerId}/test-call`, { phone }, { headers });
            toast.success('Test call placed successfully!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to place test call');
        } finally {
            setTestingId(null);
        }
    };

    const syncAgents = async (providerSlug, hasApiKey) => {
        if (!hasApiKey) {
            return toast.error('Please save your API key first before syncing agents!');
        }

        setSyncingId(providerSlug);
        try {
            const res = await axios.post(`${API}/api/voice-agents/sync/${providerSlug}`, {}, { headers });
            toast.success(`Successfully synced ${res.data.count} agents!`);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to sync agents');
        } finally {
            setSyncingId(null);
        }
    };

    const deleteConfig = async (providerId) => {
        if (!window.confirm('Are you sure you want to remove these credentials?')) return;
        setSavingId(providerId);
        try {
            await axios.delete(`${API}/api/voice/providers/${providerId}/config`, { headers });
            toast.success('Configuration removed');
            updateConfig(providerId, 'apiKey', '');
            updateConfig(providerId, 'agentId', '');
            updateConfig(providerId, 'voiceId', '');
            fetchAll();
        } catch (err) {
            toast.error('Failed to remove configuration');
        } finally {
            setSavingId(null);
        }
    };

    const toggleActive = async (providerId, currentActive) => {
        const prov = providers.find(p => p.id === providerId);
        const newValue = !currentActive;
        
        if (!prov?.userConfig) {
            updateConfig(providerId, 'active', newValue);
            return;
        }

        updateConfig(providerId, 'active', newValue);
        try {
            const cfg = configs[providerId] || {};
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, { ...cfg, active: newValue }, { headers });
            toast.success(`Provider ${newValue ? 'enabled' : 'disabled'} for calls`);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to toggle status');
            updateConfig(providerId, 'active', currentActive);
        }
    };

    const updateConfig = (providerId, field, value) => {
        setConfigs(prev => ({ ...prev, [providerId]: { ...prev[providerId], [field]: value } }));
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            <ToastContainer toasts={toasts} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="bg-gradient-to-br from-indigo-600 to-purple-600 text-transparent bg-clip-text">Voice Providers</span>
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Configure and manage your AI Voice Calling engines</p>
                </div>
            </div>

            <div className="space-y-6">
                {loading ? (
                    <div className="text-center py-16 text-gray-500 font-medium">Loading providers...</div>
                ) : providers.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl shadow-sm">
                        <div className="text-6xl mb-4">🔌</div>
                        <div className="text-gray-900 font-bold text-xl">No voice providers enabled yet</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {providers.map(p => (
                            <div key={p.id} className="bg-white border border-gray-200 rounded-3xl p-6 hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col h-full shadow-sm group">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-900">{p.name}</h3>
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg mt-1.5 inline-block ${p.sandboxMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {p.sandboxMode ? '🧪 SANDBOX' : '🟢 PRODUCTION'}
                                        </span>
                                        {p.agentCount !== undefined && (
                                            <div className="text-xs text-gray-500 mt-2 font-medium">
                                                {p.agentCount} Agents Synced {p.lastSyncAt ? `• Last sync: ${new Date(p.lastSyncAt).toLocaleDateString()}` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                        {p.slug === 'retell' ? '🔊' : p.slug === 'bland' ? '📡' : p.slug === 'custom' ? '⚙️' : '🎙️'}
                                    </div>
                                </div>
                                
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <label className="text-xs text-gray-700 font-bold uppercase tracking-wider mb-2 block">API Key</label>
                                        <input 
                                            type="password" 
                                            placeholder={p.userConfig?.apiKeyConfigured ? "•••••••••••••••• (Saved)" : "Enter your API key..."} 
                                            value={configs[p.id]?.apiKey || ''} 
                                            onChange={e => updateConfig(p.id, 'apiKey', e.target.value)} 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-700 font-bold uppercase tracking-wider mb-2 block">Agent / Voice ID (Optional)</label>
                                        <input type="text" placeholder="Enter your agent/voice ID..." value={configs[p.id]?.agentId || ''} onChange={e => updateConfig(p.id, 'agentId', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-700 font-bold uppercase tracking-wider mb-2 block">
                                            {p.slug === 'vapi' ? 'Vapi Phone Number ID (Required for Calls)' : 'From Phone Number (Optional)'}
                                        </label>
                                        <input type="text" 
                                            placeholder={p.slug === 'vapi' ? 'UUID from Vapi Dashboard → Phone Numbers' : 'e.g. +1234567890'} 
                                            value={configs[p.id]?.voiceId || ''} 
                                            onChange={e => updateConfig(p.id, 'voiceId', e.target.value)} 
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                        />
                                        {p.slug === 'vapi' && (
                                            <p className="text-[11px] text-amber-600 mt-1.5 font-medium">⚠️ Required: Go to <strong>app.vapi.ai → Phone Numbers</strong>, buy/import a number and paste its UUID here.</p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="mt-6 pt-5 border-t border-gray-100">
                                    <div className="flex items-center justify-between pb-4">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleActive(p.id, configs[p.id]?.active ?? false)}
                                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${configs[p.id]?.active ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${configs[p.id]?.active ? 'translate-x-6' : 'translate-x-1'} shadow-sm`} />
                                            </button>
                                            <span className="text-sm font-bold text-gray-700">{configs[p.id]?.active ? 'Enabled' : 'Disabled'}</span>
                                        </div>
                                        <button onClick={() => deleteConfig(p.id)} className="text-xs text-red-600 hover:text-red-700 font-bold px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                                            🗑️ Remove
                                        </button>
                                    </div>

                                    <button onClick={() => saveConfig(p.id)} disabled={savingId === p.id} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-all shadow-sm shadow-indigo-200">
                                        {savingId === p.id ? 'Saving...' : '🔒 Save Configuration'}
                                    </button>

                                    {/* Sync Agents visible but validates API key */}
                                    <button 
                                        onClick={() => syncAgents(p.slug, p.userConfig?.apiKeyConfigured || configs[p.id]?.apiKey)} 
                                        disabled={syncingId === p.slug} 
                                        className="w-full bg-gray-50 hover:bg-gray-100 disabled:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-all mt-2 text-sm flex justify-center items-center gap-2"
                                    >
                                        {syncingId === p.slug ? '🔄 Syncing...' : '🔄 Sync Agents'}
                                    </button>

                                    {p.userConfig && (
                                        <div className="pt-5 border-t border-gray-100 mt-5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">🧪 Live Test</span>
                                                <span className="text-[10px] text-gray-500 font-mono font-medium">Outbound call</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="+919876543210" 
                                                    value={testPhones[p.id] || ''} 
                                                    onChange={e => setTestPhones(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                                <button 
                                                    onClick={() => triggerTestCall(p.id)}
                                                    disabled={testingId === p.id}
                                                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-2 shrink-0"
                                                >
                                                    {testingId === p.id ? 'Calling...' : '📞 Call'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FreshVoiceProviders;
