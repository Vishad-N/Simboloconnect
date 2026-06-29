import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

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
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {t.msg}
            </div>
        ))}
    </div>
);

const AdminVoiceCenter = () => {
    const [providers, setProviders] = useState([]);
    const [usage, setUsage] = useState({ totalCalls: 0, totalDuration: 0, activeCalls: 0, failedCalls: 0 });
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [editingProvider, setEditingProvider] = useState(null);
    const [providerForm, setProviderForm] = useState({});
    const [adminConfigs, setAdminConfigs] = useState({});
    const [activeTab, setActiveTab] = useState('providers');
    const { toasts, toast } = useToast();

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [provRes, usageRes, userProvRes] = await Promise.allSettled([
                axios.get(`${API}/api/admin/voice/providers`),
                axios.get(`${API}/api/admin/voice/usage`),
                axios.get(`${API}/api/voice/providers`)
            ]);
            if (provRes.status === 'fulfilled') setProviders(provRes.value.data || []);
            if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data || {});
            if (userProvRes.status === 'fulfilled') {
                const data = userProvRes.value.data || [];
                const initialConfigs = {};
                data.forEach(p => {
                    initialConfigs[p.id] = {
                        apiKey: '',
                        agentId: p.userConfig?.agentId || '',
                        voiceId: p.userConfig?.voiceId || '',
                        active: p.userConfig ? (p.userConfig.active ?? true) : false
                    };
                });
                setAdminConfigs(prev => ({ ...initialConfigs, ...prev }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const toggleProvider = async (providerId, enabled) => {
        try {
            await axios.patch(`${API}/api/admin/voice/providers/${providerId}`, { enabled });
            toast.success(`Provider ${enabled ? 'enabled' : 'disabled'} successfully`);
            fetchAll();
        } catch (err) {
            toast.error('Failed to update provider status');
        }
    };

    const saveProviderSettings = async (providerId) => {
        setSavingId(providerId);
        try {
            await axios.patch(`${API}/api/admin/voice/providers/${providerId}`, providerForm);
            toast.success('Provider settings saved!');
            setEditingProvider(null);
            fetchAll();
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSavingId(null);
        }
    };

    const updateAdminConfig = (providerId, field, value) => {
        setAdminConfigs(prev => ({ ...prev, [providerId]: { ...prev[providerId], [field]: value } }));
    };

    const saveAdminConfig = async (providerId) => {
        const cfg = adminConfigs[providerId] || {};
        const prov = providers.find(p => p.id === providerId);
        if (!cfg.apiKey && !prov?.userConfig?.apiKeyConfigured && !adminConfigs[providerId]?.apiKeyConfigured) {
            return toast.error('API Key is required');
        }
        setSavingId(`admin-${providerId}`);
        try {
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, cfg);
            toast.success('Platform AI credentials saved securely!');
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save configuration');
        } finally {
            setSavingId(null);
        }
    };

    const deleteAdminConfig = async (providerId) => {
        if (!window.confirm('Are you sure you want to remove these credentials?')) return;
        setSavingId(`admin-${providerId}`);
        try {
            await axios.delete(`${API}/api/voice/providers/${providerId}/config`);
            toast.success('Configuration removed');
            updateAdminConfig(providerId, 'apiKey', '');
            updateAdminConfig(providerId, 'agentId', '');
            updateAdminConfig(providerId, 'voiceId', '');
            fetchAll();
        } catch (err) {
            toast.error('Failed to remove configuration');
        } finally {
            setSavingId(null);
        }
    };

    const toggleAdminActive = async (providerId, currentActive) => {
        const prov = providers.find(p => p.id === providerId);
        const newValue = !currentActive;
        
        // If not configured in backend yet, just update local state
        if (!prov?.userConfig) {
            updateAdminConfig(providerId, 'active', newValue);
            return;
        }

        updateAdminConfig(providerId, 'active', newValue);
        try {
            const cfg = adminConfigs[providerId] || {};
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, { ...cfg, active: newValue });
            toast.success(`Platform Agent ${newValue ? 'enabled' : 'disabled'}`);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to toggle status');
            updateAdminConfig(providerId, 'active', currentActive);
        }
    };

    const tabs = [
        { id: 'providers', label: '⚙️ Provider Control' },
        { id: 'credentials', label: '🤖 Platform AI Agent' },
        { id: 'usage', label: '📊 Usage Analytics' },
        { id: 'safety', label: '🛡️ Safety Rails' },
    ];

    return (
        <div>
            <ToastContainer toasts={toasts} />

            {/* Page Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.36a16 16 0 0 0 6.08 6.08l1.21-1.21a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">AI Voice Control Center</h1>
                        <p className="text-sm text-gray-500">Manage voice providers, quotas, and usage across all tenants</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Calls', value: usage.totalCalls || 0, icon: '📞' },
                    { label: 'Active Calls', value: usage.activeCalls || 0, icon: '🔴' },
                    { label: 'Total Duration', value: `${Math.round((usage.totalDuration || 0) / 60)} min`, icon: '⏱️' },
                    { label: 'Failed Calls', value: usage.failedCalls || 0, icon: '❌' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <div className="text-2xl mb-2">{stat.icon}</div>
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Providers Tab */}
            {activeTab === 'providers' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Voice Provider Configuration</h2>
                        <button onClick={fetchAll} className="text-xs text-purple-600 hover:text-purple-700 font-medium">🔄 Refresh</button>
                    </div>
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Loading providers...</div>
                    ) : providers.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="text-5xl mb-4">🔌</div>
                            <div className="text-gray-500 font-medium">No voice providers configured</div>
                            <p className="text-sm text-gray-400 mt-2">Add provider records in the database to manage them here</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {providers.map(p => (
                                <div key={p.id} className="px-6 py-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-xl">
                                                {p.name?.toLowerCase().includes('retell') ? '🔊' : p.name?.toLowerCase().includes('bland') ? '📡' : p.name?.toLowerCase().includes('vapi') ? '🎙️' : '📞'}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{p.name}</div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.sandboxMode ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                        {p.sandboxMode ? '🧪 Sandbox' : '✅ Production'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">Priority: {p.priority}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => { setEditingProvider(editingProvider === p.id ? null : p.id); setProviderForm({ priority: p.priority, sandboxMode: p.sandboxMode, cooldownSeconds: p.cooldownSeconds }); }} className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                                ⚙️ Settings
                                            </button>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={p.enabled} onChange={e => toggleProvider(p.id, e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    {editingProvider === p.id && (
                                        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block font-medium">Priority</label>
                                                    <input type="number" value={providerForm.priority || 1} onChange={e => setProviderForm(f => ({ ...f, priority: parseInt(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block font-medium">Cooldown (seconds)</label>
                                                    <input type="number" value={providerForm.cooldownSeconds || 0} onChange={e => setProviderForm(f => ({ ...f, cooldownSeconds: parseInt(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                                                </div>
                                                <div className="flex items-center gap-2 pt-5">
                                                    <input type="checkbox" id={`sandbox-${p.id}`} checked={providerForm.sandboxMode || false} onChange={e => setProviderForm(f => ({ ...f, sandboxMode: e.target.checked }))} />
                                                    <label htmlFor={`sandbox-${p.id}`} className="text-sm text-gray-700">Sandbox Mode</label>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button onClick={() => saveProviderSettings(p.id)} disabled={savingId === p.id} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50">
                                                    {savingId === p.id ? 'Saving...' : '💾 Save Changes'}
                                                </button>
                                                <button onClick={() => setEditingProvider(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200">Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Platform AI Credentials Tab */}
            {activeTab === 'credentials' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-6">
                    <div className="mb-6">
                        <h2 className="font-semibold text-gray-900 text-lg">🤖 Platform-Wide AI Voice Agent</h2>
                        <p className="text-sm text-gray-500 mt-1">Configure the Superadmin AI Voice agent. This agent automatically calls new users upon sign-up (Welcome/Onboarding) and can be used for platform-wide alerts.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {providers.map(p => (
                            <div key={p.id} className={`border rounded-xl p-5 transition-colors ${adminConfigs[p.id]?.active ? 'border-purple-200 bg-white' : 'border-gray-200 bg-gray-50/50'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">{p.name?.toLowerCase().includes('retell') ? '🔊' : p.name?.toLowerCase().includes('bland') ? '📡' : '🎙️'}</div>
                                        <div>
                                            <div className="font-bold text-gray-900">{p.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                Status: <span className={adminConfigs[p.id]?.active ? 'text-green-600 font-medium' : 'text-gray-400 font-medium'}>
                                                    {adminConfigs[p.id]?.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={adminConfigs[p.id]?.active || false} onChange={() => toggleAdminActive(p.id, adminConfigs[p.id]?.active)} />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                                        <input 
                                            type="password" 
                                            placeholder="Enter your API key..." 
                                            value={adminConfigs[p.id]?.apiKey || ''} 
                                            onChange={e => updateAdminConfig(p.id, 'apiKey', e.target.value)} 
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" 
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Agent / Voice ID (Onboarding Agent)</label>
                                        <input type="text" placeholder="Enter the Onboarding Agent ID..." value={adminConfigs[p.id]?.agentId || ''} onChange={e => updateAdminConfig(p.id, 'agentId', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Caller ID (Phone Number)</label>
                                        <input type="text" placeholder="e.g. +1234567890" value={adminConfigs[p.id]?.voiceId || ''} onChange={e => updateAdminConfig(p.id, 'voiceId', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 gap-2">
                                        <button onClick={() => deleteAdminConfig(p.id)} className="px-3 py-2 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors font-medium">
                                            🗑️ Remove
                                        </button>
                                        <button onClick={() => saveAdminConfig(p.id)} disabled={savingId === `admin-${p.id}`} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors">
                                            {savingId === `admin-${p.id}` ? 'Saving...' : '💾 Save Config'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Usage Tab */}
            {activeTab === 'usage' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
                    <div className="text-5xl mb-4">📊</div>
                    <h3 className="font-semibold text-gray-700 mb-2">Tenant Usage Analytics</h3>
                    <p className="text-sm text-gray-400 mb-6">Per-tenant call volume, minute usage and billing data shown below.</p>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Platform Total Calls', value: usage.totalCalls || 0 },
                            { label: 'Total Minutes Used', value: `${Math.round((usage.totalDuration || 0) / 60)} min` },
                            { label: 'Failed/Blocked Calls', value: usage.failedCalls || 0 },
                        ].map(stat => (
                            <div key={stat.label} className="bg-gray-50 rounded-xl p-4">
                                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Safety Rails Tab */}
            {activeTab === 'safety' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-6">🛡️ Enterprise Safety Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { label: 'Kill Switch (Disable ALL Calls)', desc: 'Set DISABLE_ALL_VOICE_CALLS=true in server .env to emergency stop all calls platform-wide', icon: '🚨', status: 'ENV Configured' },
                            { label: 'Daily Minute Limits', desc: 'VoiceQuota tracks daily/monthly usage per tenant with hard-stop enforcement', icon: '⏱️', status: 'Active' },
                            { label: 'Concurrent Call Limits', desc: 'VoiceQueueManager enforces per-tenant concurrent call limits', icon: '📊', status: 'Active' },
                            { label: 'Abuse Retry Limits', desc: 'Maximum retry attempts per call session enforced to prevent runaway billing', icon: '🔁', status: 'Active' },
                            { label: 'Working Hours Protection', desc: 'WorkingHours model defines when AI calls can be made', icon: '🕐', status: 'Active' },
                            { label: 'Tenant Isolation', desc: 'VoiceTenantIsolationGuard ensures each workspace uses only its own credentials', icon: '🔐', status: 'Active' },
                        ].map(item => (
                            <div key={item.label} className="flex gap-4 p-4 border border-gray-200 rounded-xl hover:border-purple-200 transition-colors">
                                <div className="text-2xl flex-shrink-0">{item.icon}</div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div className="font-semibold text-sm text-gray-900">{item.label}</div>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex-shrink-0 ml-2">{item.status}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVoiceCenter;
