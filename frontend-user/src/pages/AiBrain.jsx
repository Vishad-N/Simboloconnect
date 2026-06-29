import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bot, Server, Settings, Wrench, BrainCircuit, Activity, 
    BarChart3, Beaker, CheckCircle2, XCircle, ChevronRight, 
    Play, Save, Loader2, Sparkles, RefreshCcw, ShieldAlert,
    Terminal, Database, Lock, Globe, FileText, MessageSquare,
    Phone, Volume2, Trash2, Plus, AlertCircle
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'provider', label: 'AI Provider', icon: Server },
    { id: 'settings', label: 'AI Settings', icon: Settings },
    { id: 'tools', label: 'Tools & Permissions', icon: Wrench },
    { id: 'memory', label: 'Memory', icon: BrainCircuit },
    { id: 'logs', label: 'Action Logs', icon: Terminal },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'sandbox', label: 'Sandbox Testing', icon: Beaker },
];

export default function AiBrain() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState(null);
    const [logs, setLogs] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    
    // Live events
    const { socket } = useSocket();
    const [liveEvents, setLiveEvents] = useState([]);

    useEffect(() => {
        if (!socket) return;
        const handleAiEvent = (event) => {
            setLiveEvents(prev => [event, ...prev].slice(0, 5));
        };
        // Simulated AI events from backend if needed
        socket.on('ai_action', handleAiEvent);
        return () => socket.off('ai_action', handleAiEvent);
    }, [socket]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes, logsRes, analyticsRes] = await Promise.all([
                axios.get('/api/ai/settings'),
                axios.get('/api/ai/logs'),
                axios.get('/api/ai/analytics')
            ]);
            setSettings(settingsRes.data);
            setLogs(logsRes.data);
            setAnalytics(analyticsRes.data);
        } catch (err) {
            console.error("Failed to load AI data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const saveSettings = async (agentData, userData, apiKey) => {
        setSaving(true);
        try {
            await axios.post('/api/ai/settings', {
                agentSettings: agentData,
                userSettings: userData,
                apiKey
            });
            await fetchData();
            alert("Settings saved successfully!");
        } catch (err) {
            alert("Failed to save settings: " + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Initializing AI Core...</h2>
                <p className="text-surface-400">Loading workspace intelligence</p>
            </div>
        );
    }

    return (
        <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          <div style={{ minHeight:'calc(100vh-80px)', display:'flex', borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 2px 24px rgba(0,0,0,0.2)' }}>
            {/* Inner Sidebar for Tabs */}
            <div style={{ width:240, display:'flex', flexDirection:'column', flexShrink:0, background:'#0d0d0d', borderRight:'1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                        <div style={{ padding:7, background:'rgba(37,211,102,.1)', borderRadius:9 }}>
                            <Bot style={{ width:20, height:20, color:'#25D366' }} />
                        </div>
                        <h1 style={{ fontSize:17, fontWeight:900, color:'#ffffff', margin:0 }}>AI Brain</h1>
                    </div>
                    <p style={{ fontSize:11, color:'#94a3b8', marginTop:4, marginLeft:2 }}>Workspace Operating System</p>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'10px 10px' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${
                                activeTab === tab.id ? 'text-white bg-white/10 rounded-lg' : 'text-slate-400 hover:text-white hover:bg-white/5 rounded-lg'
                            }`}
                            style={{ border: 'none', cursor: 'pointer', textAlign: 'left', background: activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto" style={{ background: '#000000' }}>
                <div className="max-w-6xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'overview' && <OverviewTab analytics={analytics} settings={settings} />}
                            {activeTab === 'provider' && <ProviderTab settings={settings} onSave={saveSettings} saving={saving} />}
                            {activeTab === 'settings' && <SettingsTab settings={settings} onSave={saveSettings} saving={saving} />}
                            {activeTab === 'tools' && <ToolsTab settings={settings} onSave={saveSettings} saving={saving} />}
                            {activeTab === 'memory' && <MemoryTab settings={settings} />}
                            {activeTab === 'logs' && <LogsTab logs={logs} />}
                            {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} />}
                            {activeTab === 'sandbox' && <SandboxTab settings={settings} onSave={saveSettings} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Live Activity Floating Panel */}
            {liveEvents.length > 0 && (
                <div className="fixed bottom-6 right-6 w-80 bg-surface-900 border border-white/10 rounded-xl shadow-2xl p-4 z-50">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                        <h4 className="text-sm font-semibold text-white">Live AI Execution</h4>
                    </div>
                    <div className="space-y-2">
                        {liveEvents.map((evt, i) => (
                            <div key={i} className="text-xs text-surface-300 font-mono flex items-start gap-2">
                                <ChevronRight className="w-3 h-3 mt-0.5 text-brand-500 shrink-0" />
                                <span>{evt.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}

// --- TAB COMPONENTS ---

function OverviewTab({ analytics, settings }) {
    const isOnline = settings?.agent?.isActive && settings?.userSettings?.botEnabled;
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">System Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface-900 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-brand-500/10 transition-all"></div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-surface-400 text-sm font-medium">Status</h3>
                        <Activity className={`w-5 h-5 ${isOnline ? 'text-brand-500' : 'text-red-500'}`} />
                    </div>
                    <p className="text-2xl font-bold text-white">{isOnline ? 'Online' : 'Offline'}</p>
                    <p className="text-xs text-surface-400 mt-2">Workspace AI Core</p>
                </div>

                <div className="bg-surface-900 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-all"></div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-surface-400 text-sm font-medium">Model</h3>
                        <Server className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">{settings?.agent?.model || 'gpt-4o'}</p>
                    <p className="text-xs text-surface-400 mt-2">{settings?.agent?.useOwnAi ? 'Your API Key' : 'Admin AI Gateway'}</p>
                </div>

                <div className="bg-surface-900 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-purple-500/10 transition-all"></div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-surface-400 text-sm font-medium">Total Actions</h3>
                        <Terminal className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">{analytics?.totalActions || 0}</p>
                    <p className="text-xs text-surface-400 mt-2">{analytics?.successRate}% Success Rate</p>
                </div>

                <div className="bg-surface-900 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-orange-500/10 transition-all"></div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-surface-400 text-sm font-medium">Token Usage</h3>
                        <Database className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">{(analytics?.totalTokens / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-surface-400 mt-2">~${parseFloat(analytics?.estimatedCost).toFixed(3)} Estimated</p>
                </div>
            </div>

            <div className="bg-surface-900 p-8 rounded-xl border border-white/5 mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">System Health</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-surface-950 rounded-lg">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-500" />
                            <span className="text-sm font-medium text-white">Redis Memory Engine</span>
                        </div>
                        <span className="text-xs text-surface-400">Operational</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-surface-950 rounded-lg">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-500" />
                            <span className="text-sm font-medium text-white">Tool Validation Layer</span>
                        </div>
                        <span className="text-xs text-surface-400">Strict Protection Active</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-surface-950 rounded-lg">
                        <div className="flex items-center gap-3">
                            {settings?.agent?.sandboxMode ? <ShieldAlert className="w-5 h-5 text-yellow-500" /> : <CheckCircle2 className="w-5 h-5 text-brand-500" />}
                            <span className="text-sm font-medium text-white">Sandbox Environment</span>
                        </div>
                        <span className="text-xs text-surface-400">{settings?.agent?.sandboxMode ? 'Enabled' : 'Disabled (Live Mode)'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

const ALL_PROVIDERS = [
    {
        id: 'openai', name: 'OpenAI', logo: '🟢',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
        defaultModel: 'gpt-4o', website: 'platform.openai.com',
    },
    {
        id: 'anthropic', name: 'Anthropic (Claude)', logo: '🟤',
        models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        defaultModel: 'claude-sonnet-4-5', website: 'console.anthropic.com',
    },
    {
        id: 'google', name: 'Google Gemini', logo: '🔵',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-ultra'],
        defaultModel: 'gemini-1.5-pro', website: 'aistudio.google.com',
    },
    {
        id: 'groq', name: 'Groq (Ultra Fast)', logo: '⚡',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'llama-3.2-90b-vision-preview'],
        defaultModel: 'llama-3.3-70b-versatile', website: 'console.groq.com',
    },
    {
        id: 'openrouter', name: 'OpenRouter', logo: '🔀',
        models: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct', 'mistralai/mistral-7b-instruct', 'google/gemini-pro', 'anthropic/claude-3-haiku', 'cohere/command-r-plus', 'nousresearch/hermes-3-llama-3.1-70b'],
        defaultModel: 'openrouter/auto', website: 'openrouter.ai',
    },
    {
        id: 'mistral', name: 'Mistral AI', logo: '🌪️',
        models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mixtral-8x22b', 'open-mistral-7b', 'codestral-latest'],
        defaultModel: 'mistral-large-latest', website: 'console.mistral.ai',
    },
    {
        id: 'cohere', name: 'Cohere', logo: '🟡',
        models: ['command-r-plus', 'command-r', 'command-light', 'command-nightly'],
        defaultModel: 'command-r-plus', website: 'dashboard.cohere.com',
    },
    {
        id: 'together', name: 'Together AI', logo: '🤝',
        models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'NousResearch/Nous-Hermes-2-Yi-34B', 'togethercomputer/llama-2-70b-chat'],
        defaultModel: 'meta-llama/Llama-3-70b-chat-hf', website: 'api.together.xyz',
    },
    {
        id: 'perplexity', name: 'Perplexity AI', logo: '🔍',
        models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
        defaultModel: 'llama-3.1-sonar-large-128k-online', website: 'www.perplexity.ai',
    },
];

function ProviderTab({ settings, onSave, saving }) {
    const [useOwnAi, setUseOwnAi] = useState(settings?.agent?.useOwnAi || false);
    const [provider, setProvider] = useState(settings?.userSettings?.aiProvider || 'openai');
    const [model, setModel] = useState(settings?.agent?.model || 'gpt-4o');
    const [apiKey, setApiKey] = useState('');
    const [dbUpdatedAt, setDbUpdatedAt] = useState(settings?.userSettings?.updatedAt || null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Get models for the selected provider
    const currentProviderData = ALL_PROVIDERS.find(p => p.id === provider) || ALL_PROVIDERS[0];
    const availableModels = currentProviderData.models;

    // Adjust selected model if it is not supported by the new provider
    useEffect(() => {
        if (!availableModels.includes(model)) {
            setModel(currentProviderData.defaultModel);
        }
    }, [provider]);

    const handleSave = () => {
        if (apiKey && apiKey.includes('••••')) {
            alert("Cannot save masked values. Please enter a valid key.");
            return;
        }
        if (provider === 'groq' && apiKey && !apiKey.startsWith('gsk_')) {
            alert("Invalid Groq API Key. Must start with gsk_");
            return;
        }
        onSave({ useOwnAi, model }, { aiProvider: provider }, apiKey || undefined);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            let res;
            if (apiKey) {
                res = await axios.post('/api/ai/provider/test', {
                    provider,
                    apiKey,
                    model
                });
            } else {
                res = await axios.post('/api/ai/test-config');
            }
            setTestResult({ success: true, message: res.data.message });
        } catch (err) {
            setTestResult({ success: false, message: err.response?.data?.error || err.message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">AI Provider Configuration</h2>
                {dbUpdatedAt && (
                    <div className="text-xs text-brand-500 font-mono">
                        Last Config Update: {new Date(dbUpdatedAt).toLocaleString()}
                    </div>
                )}
            </div>

            {/* Admin AI Toggle */}
            <div 
                className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${!useOwnAi ? 'border-brand-500 bg-brand-500/5' : 'border-white/5 bg-surface-900'}`}
                onClick={() => setUseOwnAi(false)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Server className="w-6 h-6 text-brand-400" />
                        <h3 className="text-lg font-bold text-white">Use Admin AI Brain (Recommended)</h3>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${!useOwnAi ? 'border-brand-500 bg-brand-500' : 'border-surface-600'}`}>
                        {!useOwnAi && <CheckCircle2 className="w-4 h-4 text-surface-950" />}
                    </div>
                </div>
                <p className="text-sm text-surface-400 ml-9">Use the platform's managed AI infrastructure. No API keys required. Rate limits apply based on your plan.</p>
            </div>

            {/* Custom AI Toggle */}
            <div 
                className={`p-6 rounded-xl border-2 transition-all cursor-pointer ${useOwnAi ? 'border-brand-500 bg-brand-500/5' : 'border-white/5 bg-surface-900'}`}
                onClick={() => setUseOwnAi(true)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Lock className="w-6 h-6 text-brand-400" />
                        <h3 className="text-lg font-bold text-white">Use My Own AI Brain</h3>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${useOwnAi ? 'border-brand-500 bg-brand-500' : 'border-surface-600'}`}>
                        {useOwnAi && <CheckCircle2 className="w-4 h-4 text-surface-950" />}
                    </div>
                </div>
                <p className="text-sm text-surface-400 ml-9">Connect your own OpenAI, Anthropic, or OpenRouter keys for unlimited custom usage.</p>

                {useOwnAi && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-6 ml-9 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Provider</label>
                                <select 
                                    className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                    value={provider}
                                    onChange={e => setProvider(e.target.value)}
                                >
                                    {ALL_PROVIDERS.map(p => (
                                        <option key={p.id} value={p.id}>{p.logo} {p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Model</label>
                                <select 
                                    className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                >
                                    {availableModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1">API Key</label>
                            <input 
                                type="password" 
                                placeholder={settings?.userSettings?.hasAiApiKey ? "•••••••••••••••• (Key Saved)" : `Enter ${currentProviderData.name} API Key`}
                                className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none font-mono"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                            />
                            <p className="text-xs text-surface-500 mt-1">Leave blank to keep existing key unchanged.</p>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-4">
                            <button 
                                onClick={handleTest}
                                disabled={testing}
                                className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Test Connection
                            </button>
                            {testResult && (
                                <span className={`text-sm ${testResult.success ? 'text-brand-500' : 'text-red-500'}`}>
                                    {testResult.message}
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
                
                {useOwnAi && (
                    <div className="mt-4 ml-9 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl">
                        <div className="flex items-center gap-3 text-brand-500 mb-2">
                            <ShieldAlert className="w-5 h-5" />
                            <h4 className="font-bold text-sm">Save Before Testing</h4>
                        </div>
                        <p className="text-xs text-surface-400">
                            Always click <b>Save Configuration</b> at the bottom of the page before testing the connection, 
                            so the backend uses your newest key.
                        </p>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(0,217,165,0.3)] disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Configuration
                </button>
            </div>
        </div>
    );
}

function SettingsTab({ settings, onSave, saving }) {
    const [name, setName] = useState(settings?.agent?.name || 'Workspace Assistant');
    const [prompt, setPrompt] = useState(settings?.agent?.systemPrompt || 'You are a helpful assistant.');
    const [knowledgeWebsite, setKnowledgeWebsite] = useState(settings?.agent?.knowledgeWebsite || '');
    const [knowledgePdf, setKnowledgePdf] = useState(settings?.agent?.knowledgePdf || '');
    const [botEnabled, setBotEnabled] = useState(settings?.userSettings?.botEnabled ?? true);

    // AI Settings -> AI Error Responses state
    const [aiErrorResponses, setAiErrorResponses] = useState(() => {
        const defaultResponses = {
            rateLimit: [],
            providerDown: [],
            networkError: [],
            unknownError: [],
            allProvidersFailed: [],
            aiDisabled: [],
            maintenance: []
        };
        try {
            if (settings?.agent?.aiErrorResponses) {
                const parsed = typeof settings.agent.aiErrorResponses === 'string'
                    ? JSON.parse(settings.agent.aiErrorResponses)
                    : settings.agent.aiErrorResponses;
                return {
                    rateLimit: parsed.rateLimit || [],
                    providerDown: parsed.providerDown || [],
                    networkError: parsed.networkError || [],
                    unknownError: parsed.unknownError || [],
                    allProvidersFailed: parsed.allProvidersFailed || [],
                    aiDisabled: parsed.aiDisabled || [],
                    maintenance: parsed.maintenance || []
                };
            }
        } catch (e) {
            console.error("Error loading aiErrorResponses in state init:", e);
        }
        return defaultResponses;
    });

    const [activeErrorKey, setActiveErrorKey] = useState('rateLimit');
    const [newResponseInput, setNewResponseInput] = useState('');
    const [selectedPreviewType, setSelectedPreviewType] = useState('whatsapp');

    const ERROR_TYPES_CONFIG = [
        {
            key: 'rateLimit',
            title: 'Rate Limit (429)',
            description: 'Triggered when the provider is rate-limiting the workspace API key or payload frequency.',
            suggestions: [
                "Thoda high traffic chal raha hai 😊 Please ek baar dubara try kariye.",
                "AI assistant abhi thoda busy hai 😅 Ek sec please 🚀",
                "Traffic high hai abhi. Please ek minute baad try karein. 🙏"
            ],
            defaultPreview: "Thoda high traffic chal raha hai 😊 Please ek baar dubara try kariye."
        },
        {
            key: 'providerDown',
            title: 'Provider Down (5xx)',
            description: 'Triggered when the primary LLM provider (Groq/OpenAI/OpenRouter) returns a server down or timeout.',
            suggestions: [
                "Server pe load thoda jyada hai, hum abhi theek kar rahe hain! 🛠️",
                "Peeche se AI engine down chal raha hai. Ek bar dubara check karein. 🚀",
                "Our backend systems are overloaded. Working to resolve it shortly! 🛠️"
            ],
            defaultPreview: "Server pe load thoda jyada hai, hum abhi theek kar rahe hain! 🛠️"
        },
        {
            key: 'networkError',
            title: 'Network Error',
            description: 'Triggered when the connection between the panel and provider timeouts or fails.',
            suggestions: [
                "Network me thoda issue lag raha hai, please ek bar phir se try karein! 📶",
                "Minor connectivity glitch on our end. Please try again! 📶",
                "Connection time out ho gaya hai. Ek baar refresh kijiye. 🙏"
            ],
            defaultPreview: "Network me thoda issue lag raha hai, please ek bar phir se try karein! 📶"
        },
        {
            key: 'unknownError',
            title: 'Unknown Error',
            description: 'Fallback when an unhandled server error occurs during request execution.',
            suggestions: [
                "Kuch unexpected error aayi hai. Main abhi check karta hu! 😅",
                "Oops, something went wrong on our end. Let me double-check that! 🤔",
                "Koyi technical problem aayi hai. Hum abhi inspect kar rahe hain. ⚙️"
            ],
            defaultPreview: "Kuch unexpected error aayi hai. Main abhi check karta hu! 😅"
        },
        {
            key: 'allProvidersFailed',
            title: 'All Providers Failed',
            description: 'Triggered if primary, admin failover, and openrouter backup all fail sequentially.',
            suggestions: [
                "Sabhi AI systems busy hain. Humare team ko updates bhej diye gaye hain! 📢",
                "All our AI engines are currently unreachable. Support notified! 📢",
                "Koi AI network access nahi ho pa raha hai. Hum jald vapas aayenge! 🛠️"
            ],
            defaultPreview: "Sabhi AI systems busy hain. Humare team ko updates bhej diye gaye hain! 📢"
        },
        {
            key: 'aiDisabled',
            title: 'AI Agent Paused/Disabled',
            description: 'Triggered when the AI Master Switch is toggled off, or agent status is set to inactive.',
            suggestions: [
                "AI assistant abhi band hai. Jaldi hi humare agent aapse contact karenge! 🤝",
                "AI is currently offline. A human agent will connect with you shortly! 🤝",
                "Main abhi aapse connect nahi kar sakta. Ek executive aapse direct baat karenge! 📲"
            ],
            defaultPreview: "AI assistant abhi band hai. Jaldi hi humare agent aapse contact karenge! 🤝"
        },
        {
            key: 'maintenance',
            title: 'System Maintenance',
            description: 'Triggered when platform maintenance mode is active.',
            suggestions: [
                "AI system abhi maintenance par hai. Bas kuch hi der me active ho jayega! 🛠️",
                "Under scheduled platform maintenance. Back online very soon! 🛠️",
                "Hum maintenance break par hain. Kripya thodi der baad message karein. 🙏"
            ],
            defaultPreview: "AI system abhi maintenance par hai. Bas kuch hi der me active ho jayega! 🛠️"
        }
    ];

    const currentErrorConfig = ERROR_TYPES_CONFIG.find(c => c.key === activeErrorKey);
    const activeCustomResponses = aiErrorResponses[activeErrorKey] || [];

    const handleAddResponse = (key, text) => {
        if (!text.trim()) return;
        setAiErrorResponses(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), text.trim()]
        }));
        setNewResponseInput('');
    };

    const handleRemoveResponse = (key, index) => {
        setAiErrorResponses(prev => ({
            ...prev,
            [key]: (prev[key] || []).filter((_, idx) => idx !== index)
        }));
    };

    const handleResetToDefault = () => {
        if (window.confirm("Are you sure you want to clear all custom error responses? The system will automatically revert to system default rotated replies (Hindi, Hinglish, English) and guarantee production-safe operation.")) {
            setAiErrorResponses({
                rateLimit: [],
                providerDown: [],
                networkError: [],
                unknownError: [],
                allProvidersFailed: [],
                aiDisabled: [],
                maintenance: []
            });
        }
    };

    const handleSave = () => {
        onSave({ 
            name, 
            systemPrompt: prompt, 
            knowledgeWebsite, 
            knowledgePdf,
            aiErrorResponses
        }, { botEnabled });
    };

    // Calculate active preview message: custom if exists, otherwise default fallback
    const previewMessage = activeCustomResponses.length > 0 
        ? activeCustomResponses[activeCustomResponses.length - 1] 
        : currentErrorConfig?.defaultPreview || "Reverting to default response...";

    return (
        <div className="space-y-6 max-w-6xl">
            <h2 className="text-2xl font-bold text-white mb-6">AI Settings & Error Control</h2>

            <div className="bg-surface-900 p-6 rounded-xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Master Switch</h3>
                        <p className="text-sm text-surface-400">Enable or disable autonomous AI replies across the workspace.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={botEnabled} onChange={e => setBotEnabled(e.target.checked)} />
                        <div className="w-14 h-7 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">AI Assistant Name</label>
                    <input 
                        type="text" 
                        className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-surface-300">System Prompt</label>
                        <span className="text-xs text-surface-500 font-mono">v{settings?.agent?.promptVersion || 1}.0</span>
                    </div>
                    <textarea 
                        className="w-full h-64 bg-surface-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none font-mono text-sm resize-none"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="You are a helpful customer support agent..."
                    />
                    <p className="text-xs text-surface-400 mt-2">
                        Note: Workspace context (products, customers, tools) is automatically injected by the AI Core Engine. You do not need to add it here.
                    </p>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Knowledge Base</h3>
                        <p className="text-sm text-surface-400 mb-4">Add your business website or upload a PDF so the AI can automatically learn about your services and answer customer questions.</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-brand-500" />
                                Business Website URL
                            </label>
                            <input 
                                type="url" 
                                placeholder="https://example.com"
                                className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                value={knowledgeWebsite}
                                onChange={e => setKnowledgeWebsite(e.target.value)}
                            />
                            <p className="text-xs text-surface-500 mt-1">The AI will automatically crawl and learn from this website.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-1 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-purple-500" />
                                Business Documentation (PDF Link)
                            </label>
                            <input 
                                type="url" 
                                placeholder="https://example.com/brochure.pdf"
                                className="w-full bg-surface-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                                value={knowledgePdf}
                                onChange={e => setKnowledgePdf(e.target.value)}
                            />
                            <p className="text-xs text-surface-500 mt-1">Provide a URL to a PDF document with your service details, menus, or FAQs.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Error Responses card */}
            <div className="bg-surface-900 p-6 rounded-xl border border-white/5 space-y-6">
                <div className="border-b border-white/5 pb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-brand-400 animate-pulse" />
                        AI Settings → AI Error Responses & Fallbacks
                    </h3>
                    <p className="text-sm text-surface-400 mt-1">
                        Configure customer-facing fallback messages during API limits, downtime, or network glitches. 
                        Guarantees no raw errors (404, 429, stack traces, provider names) are exposed to users.
                    </p>
                </div>

                {/* Executive Alert Banner */}
                <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-xl text-xs text-brand-400 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold uppercase block mb-1">🛡️ Safe Provider Fallback Chain Active:</span>
                        Custom Workspace Response &rarr; Rotated System Default &rarr; Hardcoded Emergency Failback.
                        Real raw errors are strictly logged in backend logs and admin debug panel, keeping your brand white-labeled and professional.
                    </div>
                </div>

                {/* Main Split Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Error Categories Management Panel (Left) */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Interactive Selector Chips */}
                        <div className="flex flex-wrap gap-2">
                            {ERROR_TYPES_CONFIG.map(cfg => {
                                const hasCustom = (aiErrorResponses[cfg.key] || []).length > 0;
                                const isActive = cfg.key === activeErrorKey;
                                return (
                                    <button
                                        key={cfg.key}
                                        onClick={() => {
                                            setActiveErrorKey(cfg.key);
                                            setNewResponseInput('');
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                            isActive 
                                                ? 'bg-brand-500 text-surface-950 border-brand-500 shadow-[0_0_10px_rgba(0,217,165,0.3)]' 
                                                : 'bg-surface-950 text-surface-300 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {cfg.title}
                                        {hasCustom && (
                                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-surface-950' : 'bg-brand-400'}`}></span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Error Context Panel */}
                        <div className="bg-surface-950 p-4 rounded-xl border border-white/5 space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-white">{currentErrorConfig?.title} Details</h4>
                                <p className="text-xs text-surface-400 mt-1">{currentErrorConfig?.description}</p>
                            </div>

                            {/* Active Custom Variations List */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-surface-400 block">Custom Rotated Responses:</label>
                                {activeCustomResponses.length === 0 ? (
                                    <div className="p-3 bg-surface-900 border border-dashed border-white/5 rounded-lg text-xs text-surface-500">
                                        No custom responses configured for this error. Reverting to platform default rotated replies (Hindi, Hinglish, English).
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {activeCustomResponses.map((res, index) => (
                                            <div key={index} className="flex justify-between items-start p-2.5 bg-surface-900 border border-white/5 rounded-lg text-xs text-white">
                                                <span className="flex-1 pr-4">{res}</span>
                                                <button
                                                    onClick={() => handleRemoveResponse(activeErrorKey, index)}
                                                    className="text-surface-500 hover:text-red-500 transition-colors p-0.5"
                                                    title="Remove response"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add Variation Form */}
                            <div className="space-y-3 pt-2 border-t border-white/5">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Type custom Hinglish/Hindi/English reply variation..."
                                        value={newResponseInput}
                                        onChange={e => setNewResponseInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddResponse(activeErrorKey, newResponseInput);
                                            }
                                        }}
                                        className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-brand-500"
                                    />
                                    <button
                                        onClick={() => handleAddResponse(activeErrorKey, newResponseInput)}
                                        className="px-3 py-2 bg-brand-500 hover:bg-brand-600 text-surface-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>

                                {/* Suggestion Quick Chips */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-surface-500 block">Suggested Rotated Replies (Click to Add):</span>
                                    <div className="flex flex-col gap-1.5">
                                        {currentErrorConfig?.suggestions.map((sug, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAddResponse(activeErrorKey, sug)}
                                                className="text-[11px] text-left px-2.5 py-1.5 bg-surface-900 hover:bg-surface-950 border border-white/5 hover:border-brand-500/20 text-surface-300 rounded transition-all truncate"
                                            >
                                                + "{sug}"
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Premium Live Device Mock Preview Panel (Right) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Live Preview Simulator</span>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setSelectedPreviewType('whatsapp')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                        selectedPreviewType === 'whatsapp' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-surface-500 border border-transparent'
                                    }`}
                                >
                                    WhatsApp
                                </button>
                                <button
                                    onClick={() => setSelectedPreviewType('livechat')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                        selectedPreviewType === 'livechat' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-surface-500 border border-transparent'
                                    }`}
                                >
                                    Live Chat
                                </button>
                                <button
                                    onClick={() => setSelectedPreviewType('voice')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                        selectedPreviewType === 'voice' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-surface-500 border border-transparent'
                                    }`}
                                >
                                    Voice Call
                                </button>
                            </div>
                        </div>

                        {/* WhatsApp Style Mock Preview */}
                        {selectedPreviewType === 'whatsapp' && (
                            <div className="w-full bg-[#efeae2] rounded-xl border border-white/10 overflow-hidden shadow-2xl font-sans h-72 flex flex-col">
                                {/* Header */}
                                <div className="bg-[#008069] p-3 flex items-center gap-3">
                                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center border border-white/30 font-bold text-white text-sm">AI</div>
                                    <div>
                                        <div className="text-xs font-bold text-white">{name}</div>
                                        <div className="text-[10px] text-white/90 animate-pulse">online</div>
                                    </div>
                                </div>
                                {/* Message Pane */}
                                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]">
                                    {/* Mock Incoming Message */}
                                    <div className="flex justify-end">
                                        <div className="bg-[#d9fdd3] text-[#111b21] p-2 rounded-lg text-xs max-w-[85%] relative shadow-sm">
                                            Hello! details bataye
                                            <span className="block text-[9px] text-[#667781] text-right mt-1 font-mono">1:42 PM ✓✓</span>
                                        </div>
                                    </div>
                                    {/* System Fallback Message */}
                                    <div className="flex justify-start">
                                        <div className="bg-[#ffffff] text-[#111b21] p-2.5 rounded-lg text-xs max-w-[85%] relative shadow-sm">
                                            {previewMessage}
                                            <span className="block text-[9px] text-[#667781] text-right mt-1 font-mono">1:42 PM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Website Live Chat Style Mock Preview */}
                        {selectedPreviewType === 'livechat' && (
                            <div className="w-full bg-[#f8fafc] dark:bg-surface-950 rounded-xl border border-white/10 overflow-hidden shadow-2xl font-sans h-72 flex flex-col">
                                {/* Header */}
                                <div className="bg-brand-600 p-3.5 flex items-center justify-between text-white">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center border border-white/30 font-bold text-white text-xs">AI</div>
                                        <div>
                                            <div className="text-xs font-bold">{name}</div>
                                            <div className="text-[10px] text-white/80">Support Assistant</div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase">Live Chat</span>
                                </div>
                                {/* Body */}
                                <div className="flex-1 p-4 bg-surface-950 flex flex-col justify-end space-y-3">
                                    {/* User message */}
                                    <div className="flex justify-end">
                                        <div className="bg-brand-500 text-surface-950 p-2.5 rounded-2xl rounded-tr-none text-xs font-medium max-w-[80%] shadow">
                                            Pricing details please.
                                        </div>
                                    </div>
                                    {/* AI Fallback reply */}
                                    <div className="flex justify-start">
                                        <div className="bg-surface-900 border border-white/5 text-white p-2.5 rounded-2xl rounded-tl-none text-xs max-w-[80%] shadow-lg">
                                            {previewMessage}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Interactive Voice Waveform Simulator */}
                        {selectedPreviewType === 'voice' && (
                            <div className="w-full bg-surface-950 rounded-xl border border-white/10 p-6 shadow-2xl h-72 flex flex-col justify-between items-center text-center">
                                <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                                    <Volume2 className="w-3.5 h-3.5 animate-bounce" /> Outbound Call Assistant
                                </div>

                                {/* Active CSS Simulated Waveform */}
                                <div className="flex items-center justify-center gap-1.5 h-16 my-2 w-full">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(bar => {
                                        const heights = ['h-4', 'h-8', 'h-12', 'h-10', 'h-6', 'h-14', 'h-8', 'h-10', 'h-12', 'h-6', 'h-10', 'h-8', 'h-4', 'h-6', 'h-3'];
                                        const delay = (bar % 5) * 0.15;
                                        return (
                                            <div 
                                                key={bar} 
                                                className={`w-1 rounded bg-brand-500 animate-pulse ${heights[bar - 1]}`}
                                                style={{ animationDelay: `${delay}s`, animationDuration: '1.2s' }}
                                            ></div>
                                        );
                                    })}
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[10px] text-surface-400 uppercase font-bold tracking-wider">Spoken TTS Reading Output:</div>
                                    <div className="text-xs text-white font-serif px-4 italic leading-relaxed max-w-sm">
                                        "{previewMessage}"
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <button
                    onClick={handleResetToDefault}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-lg transition-all border border-red-500/20 text-sm"
                >
                    <RefreshCcw className="w-4 h-4 shrink-0" />
                    Reset to Default
                </button>

                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(0,217,165,0.3)] disabled:opacity-50 text-sm"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Settings
                </button>
            </div>
        </div>
    );
}

function ToolsTab({ settings, onSave, saving }) {
    const defaultTools = ["search_products", "create_payment_link", "search_customer", "get_order_status", "escalate_to_human", "initiate_voice_call"];
    
    const [enabledTools, setEnabledTools] = useState(() => {
        try {
            return typeof settings?.agent?.toolsEnabled === 'string' ? JSON.parse(settings.agent.toolsEnabled) : (settings?.agent?.toolsEnabled || defaultTools);
        } catch {
            return defaultTools;
        }
    });

    const toolDescriptions = {
        "search_products": "Allows the AI to search your connected Ecommerce store (Shopify/WooCommerce) for product pricing, availability, and details.",
        "create_payment_link": "Allows the AI to generate real Razorpay payment links dynamically when a customer wants to purchase.",
        "search_customer": "Allows the AI to lookup past customer order history or profile tags.",
        "get_order_status": "Allows the AI to check the fulfillment status of an order.",
        "escalate_to_human": "Allows the AI to intelligently pause itself and alert a human agent if it lacks confidence or the customer requests human support.",
        "initiate_voice_call": "Allows the AI to trigger a live outbound welcome/assistance AI Voice call to the customer's phone number during or after a chat."
    };


    const toggleTool = (tool) => {
        if (enabledTools.includes(tool)) {
            setEnabledTools(enabledTools.filter(t => t !== tool));
        } else {
            setEnabledTools([...enabledTools, tool]);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tools & Permissions</h2>
                    <p className="text-surface-400">Give your AI the ability to take real actions within your workspace.</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Strict Validation Active</span>
                </div>
            </div>

            <div className="space-y-4">
                {defaultTools.map(tool => (
                    <div key={tool} className="flex items-start justify-between bg-surface-900 p-5 rounded-xl border border-white/5 transition-all hover:border-white/10">
                        <div className="flex-1 pr-6">
                            <h3 className="text-white font-mono font-bold mb-1 flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-surface-400" />
                                {tool}
                            </h3>
                            <p className="text-sm text-surface-400">{toolDescriptions[tool]}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                            <input type="checkbox" className="sr-only peer" checked={enabledTools.includes(tool)} onChange={() => toggleTool(tool)} />
                            <div className="w-11 h-6 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>
                ))}
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end">
                <button 
                    onClick={() => onSave({ toolsEnabled: enabledTools }, {}, null)}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-surface-950 font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(0,217,165,0.3)] disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Permissions
                </button>
            </div>
        </div>
    );
}

function SandboxTab({ settings, onSave }) {
    const isSandbox = settings?.agent?.sandboxMode || false;
    
    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-2">Sandbox Testing</h2>
            <p className="text-surface-400 mb-6">Safely test your AI's reasoning and tool execution without affecting live customers or real payment gateways.</p>

            <div className="bg-surface-900 p-8 rounded-xl border border-white/5 relative overflow-hidden">
                {!isSandbox && (
                    <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <ShieldAlert className="w-12 h-12 text-surface-400 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Sandbox is Disabled</h3>
                        <p className="text-surface-400 mb-6 text-center max-w-md">Enable Sandbox mode to test AI flows safely. When active, payment links and orders will be simulated.</p>
                        <button 
                            onClick={() => onSave({ sandboxMode: true }, {}, null)}
                            className="px-6 py-2.5 bg-surface-100 hover:bg-white text-surface-950 font-bold rounded-lg transition-colors"
                        >
                            Enable Sandbox Mode
                        </button>
                    </div>
                )}
                
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
                        <span className="text-white font-medium">Sandbox Environment Active</span>
                    </div>
                    <button 
                        onClick={() => onSave({ sandboxMode: false }, {}, null)}
                        className="px-4 py-1.5 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
                    >
                        Disable Sandbox
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-surface-950 rounded-lg font-mono text-sm text-surface-300">
                        <span className="text-brand-400">AI:</span> System ready for simulation. Waiting for test payload...
                    </div>
                    <div className="flex gap-2">
                        <input type="text" placeholder="Simulate a customer message..." className="flex-1 bg-surface-950 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-brand-500" disabled={!isSandbox} />
                        <button className="px-4 py-2 bg-brand-500 text-surface-950 font-bold rounded-lg disabled:opacity-50 flex items-center gap-2" disabled={!isSandbox}>
                            <Play className="w-4 h-4" /> Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LogsTab({ logs }) {
    if (!logs || logs.length === 0) {
        return (
            <div className="text-center py-20 bg-surface-900 rounded-xl border border-white/5">
                <Terminal className="w-12 h-12 text-surface-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white">No Action Logs Found</h3>
                <p className="text-surface-400 mt-1">The AI has not executed any tools yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">AI Action Logs</h2>
            <div className="bg-surface-900 rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-950/50 border-b border-white/5 text-xs uppercase tracking-wider text-surface-400">
                            <th className="px-6 py-4 font-medium">Time</th>
                            <th className="px-6 py-4 font-medium">Tool Execution</th>
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Latency</th>
                            <th className="px-6 py-4 font-medium">Context</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 text-sm text-surface-300">
                                    {new Date(log.executedAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-surface-500" />
                                        <span className="font-mono text-sm text-brand-400">{log.toolName}</span>
                                    </div>
                                    <div className="text-xs text-surface-500 truncate max-w-xs mt-1 font-mono">
                                        {JSON.stringify(log.input)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        log.status === 'SUCCESS' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 
                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-surface-400 font-mono">
                                    {log.executionTimeMs ? `${log.executionTimeMs}ms` : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {log.isSandbox ? (
                                        <span className="text-yellow-500 text-xs font-semibold flex items-center gap-1"><Beaker className="w-3 h-3"/> Sandbox</span>
                                    ) : (
                                        <span className="text-surface-500 text-xs">Live</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MemoryTab() {
    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-2">Memory Engine</h2>
            <p className="text-surface-400 mb-6">Manage how the AI remembers customer conversations and context across sessions.</p>

            <div className="bg-surface-900 p-8 rounded-xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-950 rounded-lg border border-white/5">
                    <div>
                        <h4 className="text-white font-medium mb-1">Sliding Window Redis Cache</h4>
                        <p className="text-sm text-surface-400">Maintains the last 15 messages in fast memory for instant context retrieval.</p>
                    </div>
                    <div className="bg-brand-500/20 text-brand-400 px-3 py-1 rounded text-xs font-bold border border-brand-500/30">ACTIVE</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-950 rounded-lg border border-white/5">
                    <div>
                        <h4 className="text-white font-medium mb-1">Background Summarizer</h4>
                        <p className="text-sm text-surface-400">BullMQ worker automatically compresses old threads to prevent token overflow.</p>
                    </div>
                    <div className="bg-brand-500/20 text-brand-400 px-3 py-1 rounded text-xs font-bold border border-brand-500/30">ACTIVE</div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4" /> Flush Redis Cache
                    </button>
                </div>
            </div>
        </div>
    );
}

function AnalyticsTab({ analytics }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">AI Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-surface-900 p-6 rounded-xl border border-white/5">
                    <h3 className="text-surface-400 text-sm font-medium mb-2">Total AI Requests</h3>
                    <p className="text-3xl font-bold text-white">{analytics?.totalActions || 0}</p>
                </div>
                <div className="bg-surface-900 p-6 rounded-xl border border-white/5">
                    <h3 className="text-surface-400 text-sm font-medium mb-2">Tool Success Rate</h3>
                    <p className="text-3xl font-bold text-brand-400">{analytics?.successRate}%</p>
                </div>
                <div className="bg-surface-900 p-6 rounded-xl border border-white/5">
                    <h3 className="text-surface-400 text-sm font-medium mb-2">Tokens Consumed</h3>
                    <p className="text-3xl font-bold text-orange-400">{analytics?.totalTokens ? (analytics.totalTokens).toLocaleString() : 0}</p>
                </div>
                <div className="bg-surface-900 p-6 rounded-xl border border-white/5">
                    <h3 className="text-surface-400 text-sm font-medium mb-2">Estimated Cost</h3>
                    <p className="text-3xl font-bold text-green-400">${parseFloat(analytics?.estimatedCost || 0).toFixed(4)}</p>
                </div>
            </div>

            <div className="bg-surface-900 p-12 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-16 h-16 text-surface-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Advanced Analytics Available Soon</h3>
                <p className="text-surface-400 max-w-md">Detailed token usage graphs, cost projections, and conversation conversion funnels are currently being processed by the data engine.</p>
            </div>
        </div>
    );
}

