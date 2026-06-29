import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Inline toast system (no external dep needed)
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
                t.type === 'success' ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'
            }`}>
                {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
        ))}
    </div>
);

const VoiceProviders = () => {
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
            
            // Append Custom Provider if not in DB yet, to fulfill user request dynamically
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
        
        // Prevent saving temporary custom if not in backend DB yet (handled gracefully)
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
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100%', paddingBottom: 40 }}>
            <ToastContainer toasts={toasts} />

            {/* Hero Header */}
            <div className="border-b border-white/5 bg-surface-900/30" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#25D366,#00b894)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,.3)' }}>
                        <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: 'none', stroke: 'white', strokeWidth: 2 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.36a16 16 0 0 0 6.08 6.08l1.21-1.21a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', margin: 0 }}>Voice Providers</h1>
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Configure and manage your AI Voice Calling engines</p>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px' }}>
                {loading ? (
                    <div className="text-center py-16 text-gray-500">Loading providers...</div>
                ) : providers.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="text-5xl mb-4">🔌</div>
                        <div className="text-gray-400 font-medium">No voice providers enabled yet</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {providers.map(p => (
                            <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-teal-500/30 transition-all flex flex-col h-full">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{p.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${p.sandboxMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {p.sandboxMode ? '🧪 Sandbox' : '🟢 Production'}
                                        </span>
                                        {p.agentCount !== undefined && (
                                            <div className="text-[10px] text-gray-500 mt-1">
                                                {p.agentCount} Agents Synced {p.lastSyncAt ? `• Last sync: ${new Date(p.lastSyncAt).toLocaleDateString()}` : ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-3xl">
                                        {p.slug === 'retell' ? '🔊' : p.slug === 'bland' ? '📡' : p.slug === 'custom' ? '⚙️' : '🎙️'}
                                    </div>
                                </div>
                                
                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                                        <input 
                                            type="password" 
                                            placeholder={p.userConfig?.apiKeyConfigured ? "•••••••••••••••• (Saved)" : "Enter your API key..."} 
                                            value={configs[p.id]?.apiKey || ''} 
                                            onChange={e => updateConfig(p.id, 'apiKey', e.target.value)} 
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Agent / Voice ID (Optional)</label>
                                        <input type="text" placeholder="Enter your agent/voice ID..." value={configs[p.id]?.agentId || ''} onChange={e => updateConfig(p.id, 'agentId', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">From Phone Number (Optional)</label>
                                        <input type="text" placeholder="e.g. +1234567890" value={configs[p.id]?.voiceId || ''} onChange={e => updateConfig(p.id, 'voiceId', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-all" />
                                    </div>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between pb-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleActive(p.id, configs[p.id]?.active ?? false)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs[p.id]?.active ? 'bg-teal-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs[p.id]?.active ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            <span className="text-sm font-medium text-gray-300">{configs[p.id]?.active ? 'Enabled' : 'Disabled'}</span>
                                        </div>
                                        <button onClick={() => deleteConfig(p.id)} className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors">
                                            🗑️ Remove
                                        </button>
                                    </div>

                                    <button onClick={() => saveConfig(p.id)} disabled={savingId === p.id} className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-black font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-teal-500/20">
                                        {savingId === p.id ? 'Saving...' : '🔒 Save Configuration'}
                                    </button>

                                    {/* Always show Sync Agents button, but throw error if no API key */}
                                    <button 
                                        onClick={() => syncAgents(p.slug, p.userConfig?.apiKeyConfigured || configs[p.id]?.apiKey)} 
                                        disabled={syncingId === p.slug} 
                                        className="w-full bg-white/5 hover:bg-white/10 disabled:bg-white/5 border border-white/10 text-white font-semibold py-2 rounded-xl transition-all mt-2 text-sm flex justify-center items-center gap-2"
                                    >
                                        {syncingId === p.slug ? '🔄 Syncing...' : '🔄 Sync Agents'}
                                    </button>

                                    {p.userConfig && (
                                        <div className="pt-4 border-t border-white/5 mt-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-teal-400">🧪 Live Test</span>
                                                <span className="text-[10px] text-gray-500 font-mono">Outbound call</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="+919876543210" 
                                                    value={testPhones[p.id] || ''} 
                                                    onChange={e => setTestPhones(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50"
                                                />
                                                <button 
                                                    onClick={() => triggerTestCall(p.id)}
                                                    disabled={testingId === p.id}
                                                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 text-black font-bold rounded-lg text-xs transition-all shadow-md flex items-center gap-1 shrink-0"
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

export default VoiceProviders;
