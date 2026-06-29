import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    Activity, ShieldAlert, Globe, Server, Bot, Workflow, 
    Users, Wrench, BarChart3, Terminal, Plug, GitBranch, 
    Beaker, Power, CheckCircle2, Search, Loader2, Play, Lock, Database
} from 'lucide-react';

const TABS = [
    { id: 'overview', label: 'Global Overview', icon: BarChart3 },
    { id: 'workspaces', label: 'Workspace AI', icon: Users },
    { id: 'providers', label: 'AI Providers', icon: Server },
    { id: 'emergency', label: 'Emergency Controls', icon: Power },
];

export default function AiAdminCenter() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [logs, setLogs] = useState([]);
    const [security, setSecurity] = useState(null);

    const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';
    const token = localStorage.getItem('adminToken');
    const headers = useMemo(() => ({ 'x-user-id': token }), [token]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, workspacesRes, logsRes, secRes] = await Promise.all([
                axios.get(`${API}/api/admin/ai/overview`, { headers }),
                axios.get(`${API}/api/admin/ai/workspaces`, { headers }),
                axios.get(`${API}/api/admin/ai/logs`, { headers }),
                axios.get(`${API}/api/admin/ai/security`, { headers })
            ]);
            setStats(statsRes.data);
            setWorkspaces(workspacesRes.data);
            setLogs(logsRes.data);
            setSecurity(secRes.data);
        } catch (err) {
            console.error("Failed to load admin AI data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log("AI Admin Center Loaded v2.1 (Cache Buster)");
        fetchData();
    }, []);

    const toggleWorkspaceAi = async (id, currentStatus) => {
        try {
            await axios.post(`${API}/api/admin/ai/workspaces/${id}/toggle`, { botEnabled: !currentStatus }, { headers });
            setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, botEnabled: !currentStatus } : w));
        } catch (e) {
            alert("Failed to toggle AI for workspace.");
        }
    };

    const emergencyAction = async (action) => {
        if (!window.confirm(`Are you sure you want to execute emergency ${action}?`)) return;
        try {
            await axios.post(`${API}/api/admin/ai/emergency/${action}`, {}, { headers });
            alert(`Emergency ${action} executed successfully.`);
            fetchData();
        } catch (e) {
            alert(`Failed to execute emergency ${action}.`);
        }
    };

    const renderTabContent = () => {
        switch(activeTab) {
            case 'overview':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard title="Total AI Workspaces" value={stats?.totalWorkspaces || 0} icon={Users} color="text-blue-500" />
                        <StatCard title="Active AI Tenants" value={stats?.activeWorkspaces || 0} icon={CheckCircle2} color="text-brand-500" />
                        <StatCard title="Total Actions (24h)" value={stats?.totalActions || 0} icon={Activity} color="text-purple-500" />
                        <StatCard title="Failed Jobs" value={stats?.failedActions || 0} icon={ShieldAlert} color="text-red-500" />
                        <StatCard title="Token Usage" value={stats?.totalTokens || 0} icon={Database} color="text-yellow-500" />
                        <StatCard title="Est. Cost" value={`$${Number(stats?.estimatedCost || 0).toFixed(2)}`} icon={BarChart3} color="text-green-500" />
                        
                        <div className="md:col-span-4 bg-surface-900 rounded-xl p-6 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-4">Infrastructure Health</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <HealthIndicator name="OpenAI / Claude API" status={stats?.health?.openai || 'Checking'} />
                                <HealthIndicator name="Redis Vector DB" status={stats?.health?.redis || 'Checking'} />
                                <HealthIndicator name="BullMQ Queue" status={stats?.health?.bullmq || 'Checking'} />
                            </div>
                        </div>
                    </div>
                );
            case 'workspaces':
                return (
                    <div className="bg-surface-900 rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Tenant AI Management</h3>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
                                <input type="text" placeholder="Search workspaces..." className="w-full bg-surface-950 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500" />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-surface-300">
                                <thead className="bg-surface-800 text-xs uppercase text-surface-400">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Workspace</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Model / Setup</th>
                                        <th className="px-6 py-4 font-medium">Actions</th>
                                        <th className="px-6 py-4 font-medium text-right">Controls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {Array.isArray(workspaces) && workspaces.map(w => (
                                        <tr key={w.id} className="hover:bg-surface-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white">{w.name}</div>
                                                <div className="text-xs text-surface-500">{w.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {w.botEnabled ? 
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20"><CheckCircle2 className="w-3.5 h-3.5"/> Active</span> :
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-500/10 text-surface-400 border border-surface-500/20"><Power className="w-3.5 h-3.5"/> Disabled</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">
                                                    {w.aiAgent?.useOwnAi ? 'Custom Key' : 'Admin Key'} • {w.aiAgent?.model || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">{w._count?.aiActionLogs || 0}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => toggleWorkspaceAi(w.id, w.botEnabled)} className="text-xs px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-white rounded transition-colors mr-2">
                                                    {w.botEnabled ? 'Suspend' : 'Activate'}
                                                </button>
                                                <button onClick={() => {
                                                    axios.post(`${API}/api/admin/ai/workspaces/${w.id}/clear-memory`, {}, { headers }).then(() => alert('Memory Cleared'))
                                                }} className="text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors">
                                                    Clear Memory
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'emergency':
                return (
                    <div className="space-y-6">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                            <div className="flex items-center gap-3 text-red-500 mb-4">
                                <ShieldAlert className="w-6 h-6" />
                                <h3 className="text-lg font-bold">Global Emergency Controls</h3>
                            </div>
                            <p className="text-surface-300 text-sm mb-6">Use these controls only in critical situations. These actions affect all workspaces platform-wide.</p>
                            
                            <div className="flex gap-4">
                                <button onClick={() => emergencyAction('stop')} className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors">
                                    <Power className="w-5 h-5" /> GLOBAL KILL SWITCH
                                </button>
                                <button onClick={() => emergencyAction('resume')} className="flex items-center gap-2 px-6 py-3 bg-surface-800 hover:bg-surface-700 text-white font-bold rounded-lg transition-colors border border-surface-700">
                                    <Play className="w-5 h-5" /> Resume Operations
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'providers':
                return <AiProvidersTab API={API} headers={headers} />;
            case 'agents':
                return <GlobalAgentsTab />;
            case 'routing':
                return <RoutingEngineTab />;
            case 'tools':
                return <ToolsManagerTab />;
            case 'security':
                return (
                    <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500"/> Security & Compliance Alerts</h3>
                        <p className="text-surface-400 mb-4 text-sm">Failed Validations: {security?.stats?.failedValidations || 0}</p>
                        <div className="space-y-3">
                            {security?.alerts?.map((alert, i) => (
                                <div key={i} className="p-4 bg-surface-950 border border-red-500/20 rounded-lg flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-bold text-white">Blocked Request • {alert.user?.name}</div>
                                        <div className="text-xs text-surface-400">{alert.inputMessage}</div>
                                    </div>
                                    <div className="text-xs text-red-400 font-mono">Policy Violation</div>
                                </div>
                            )) || <p className="text-surface-500 text-sm">No security alerts detected.</p>}
                        </div>
                    </div>
                );
            case 'logs':
                return (
                    <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Terminal className="w-5 h-5"/> Realtime Execution Logs</h3>
                        <div className="space-y-3 h-[600px] overflow-y-auto pr-2">
                            {Array.isArray(logs) && logs.map((log, i) => (
                                <div key={i} className="p-4 bg-surface-950 border border-white/5 rounded-lg text-sm">
                                    <div className="flex justify-between text-xs text-surface-500 mb-2 font-mono">
                                        <span>{log.user?.email} • {log.contactId}</span>
                                        <span>{new Date(log.executedAt).toLocaleString()}</span>
                                    </div>
                                    <div className="text-white mb-1"><span className="text-blue-400">User:</span> {log.inputMessage}</div>
                                    <div className="text-surface-300"><span className="text-brand-400">AI:</span> {log.aiResponse}</div>
                                    {log.toolCallsUsed && log.toolCallsUsed !== '[]' && (
                                        <div className="mt-2 text-xs text-yellow-500 font-mono">Tools Executed: {log.toolCallsUsed}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'webhooks':
                return <IntegrationsTab />;
            case 'prompts':
                return <PromptManagerTab />;
            case 'sandbox':
                return <SandboxTab />;
            default:
                return null;
        }
    };

    if (loading) {
        return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 text-brand-500 animate-spin" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl min-h-[80vh]">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20">
                    <Bot className="w-8 h-8 text-brand-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">AI Control Center</h1>
                    <p className="text-surface-400 mt-1">Mission Control for Autonomous Enterprise Agents</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-64 flex-shrink-0 space-y-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-brand-500 text-surface-950 shadow-[0_0_15px_rgba(0,217,165,0.3)]' 
                                    : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                                }`}
                            >
                                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-surface-950' : 'text-surface-500'}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderTabContent()}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }) {
    return (
        <div className="bg-surface-900 p-6 rounded-xl border border-white/5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-surface-400">{title}</span>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <span className="text-3xl font-bold text-white">{value}</span>
        </div>
    );
}

function HealthIndicator({ name, status }) {
    const isOk = status === 'Active' || status === 'OK';
    return (
        <div className="flex items-center justify-between p-3 bg-surface-950 rounded-lg border border-white/5">
            <span className="text-sm font-medium text-surface-300">{name}</span>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOk ? 'bg-brand-500' : 'bg-red-500'} animate-pulse`}></div>
                <span className={`text-xs font-bold ${isOk ? 'text-brand-500' : 'text-red-500'}`}>{status}</span>
            </div>
        </div>
    );
}


const ALL_PROVIDERS = [
    {
        id: 'openai', name: 'OpenAI', logo: '🟢', color: 'text-green-400',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
        defaultModel: 'gpt-4o', website: 'platform.openai.com',
    },
    {
        id: 'anthropic', name: 'Anthropic (Claude)', logo: '🟤', color: 'text-orange-400',
        models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        defaultModel: 'claude-sonnet-4-5', website: 'console.anthropic.com',
    },
    {
        id: 'google', name: 'Google Gemini', logo: '🔵', color: 'text-blue-400',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro', 'gemini-ultra'],
        defaultModel: 'gemini-1.5-pro', website: 'aistudio.google.com',
    },
    {
        id: 'groq', name: 'Groq (Ultra Fast)', logo: '⚡', color: 'text-yellow-400',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'llama-3.2-90b-vision-preview'],
        defaultModel: 'llama-3.3-70b-versatile', website: 'console.groq.com',
    },
    {
        id: 'openrouter', name: 'OpenRouter', logo: '🔀', color: 'text-purple-400',
        models: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct', 'mistralai/mistral-7b-instruct', 'google/gemini-pro', 'anthropic/claude-3-haiku', 'cohere/command-r-plus', 'nousresearch/hermes-3-llama-3.1-70b'],
        defaultModel: 'openrouter/auto', website: 'openrouter.ai',
    },
    {
        id: 'mistral', name: 'Mistral AI', logo: '🌪️', color: 'text-cyan-400',
        models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mixtral-8x22b', 'open-mistral-7b', 'codestral-latest'],
        defaultModel: 'mistral-large-latest', website: 'console.mistral.ai',
    },
    {
        id: 'cohere', name: 'Cohere', logo: '🟡', color: 'text-amber-400',
        models: ['command-r-plus', 'command-r', 'command-light', 'command-nightly'],
        defaultModel: 'command-r-plus', website: 'dashboard.cohere.com',
    },
    {
        id: 'together', name: 'Together AI', logo: '🤝', color: 'text-teal-400',
        models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'NousResearch/Nous-Hermes-2-Yi-34B', 'togethercomputer/llama-2-70b-chat'],
        defaultModel: 'meta-llama/Llama-3-70b-chat-hf', website: 'api.together.xyz',
    },
    {
        id: 'perplexity', name: 'Perplexity AI', logo: '🔍', color: 'text-indigo-400',
        models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'],
        defaultModel: 'llama-3.1-sonar-large-128k-online', website: 'www.perplexity.ai',
    },
    {
        id: 'webhook', name: 'Custom Webhook (n8n/Flowise)', logo: '🔌', color: 'text-pink-400',
        models: ['webhook'],
        defaultModel: 'webhook', website: 'n8n.io / Flowise',
    },
];

function AiProvidersTab({ API, headers }) {
    const [providers, setProviders] = useState(() => {
        const defaults = ALL_PROVIDERS.map((p, i) => ({
            ...p,
            enabled: i === 0,
            priority: i + 1,
            apiKey: '',
            selectedModel: p.defaultModel,
            status: i === 0 ? 'Active' : 'Idle',
            latency: Math.floor(Math.random() * 400) + 100,
        }));
        try {
            const saved = localStorage.getItem('ai_providers_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return defaults.map(def => {
                        const match = parsed.find(x => x.id === def.id);
                        if (match) {
                            return {
                                ...def,
                                enabled: typeof match.enabled === 'boolean' ? match.enabled : def.enabled,
                                priority: typeof match.priority === 'number' ? match.priority : def.priority,
                                apiKey: match.apiKey || def.apiKey,
                                selectedModel: match.selectedModel || def.selectedModel,
                                status: match.status || def.status,
                            };
                        }
                        return def;
                    });
                }
            }
        } catch (e) {}
        return defaults;
    });
    const [primaryProvider, setPrimaryProvider] = useState('openai');
    const [editingKey, setEditingKey] = useState(null);
    const [keyValues, setKeyValues] = useState({});
    const [saved, setSaved] = useState(false);
    const [dbUpdatedAt, setDbUpdatedAt] = useState(null);

    // Fetch config from backend database on mount
    useEffect(() => {
        const fetchDbConfig = async () => {
            try {
                const res = await axios.get(`${API}/api/admin/ai/providers`, { headers });
                const { provider, model, apiKey, aiWebhookUrl } = res.data;
                if (provider) {
                    setPrimaryProvider(provider);
                    const isWebhook = provider === 'webhook';
                    const activeKey = isWebhook ? aiWebhookUrl : apiKey;
                    setProviders(prev => prev.map(p => {
                        if (p.id === provider) {
                            return {
                                ...p,
                                enabled: true,
                                apiKey: activeKey || p.apiKey,
                                selectedModel: model || p.selectedModel,
                                status: 'Active'
                            };
                        }
                        return p;
                    }));
                    if (activeKey) {
                        setKeyValues(prev => ({ ...prev, [provider]: activeKey }));
                    }
                }
                setDbUpdatedAt(res.data.updatedAt);
            } catch (e) {
                console.error("Failed to fetch database AI providers config:", e);
            }
        };
        fetchDbConfig();
    }, [API, headers]);

    const saveConfig = async () => {
        localStorage.setItem('ai_providers_config', JSON.stringify(providers));
        
        const activeP = providers.find(p => p.id === primaryProvider);
        try {
            const finalKey = (keyValues[primaryProvider] || activeP?.apiKey || "").trim();
            if (finalKey.includes('••••')) {
                alert("Please enter a new API key. Cannot save masked values.");
                return;
            }
            if (primaryProvider === 'groq' && finalKey && !finalKey.startsWith('gsk_')) {
                alert("Invalid Groq API Key. Must start with gsk_" );
                return;
            }
            
            const isWebhook = primaryProvider === 'webhook';
            const postData = {
                provider: primaryProvider,
                apiKey: isWebhook ? "" : finalKey,
                aiWebhookUrl: isWebhook ? finalKey : "",
                model: activeP?.selectedModel || ""
            };
            
            await axios.post(`${API}/api/admin/ai/providers`, postData, { headers });
            
            setSaved(true);
            setDbUpdatedAt(new Date().toISOString());
            setTimeout(() => setSaved(false), 2000);
            
            // Force reload config to guarantee backend accepted it
            window.location.reload();
        } catch (e) {
            alert(e.response?.data?.error || "Failed to save global AI configuration to server database.");
        }
    };

    const toggleProvider = (id) => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled, status: !p.enabled ? 'Active' : 'Idle' } : p));
    };

    const setModel = (id, model) => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, selectedModel: model } : p));
    };

    const setPriority = (id, delta) => {
        setProviders(prev => {
            const sorted = [...prev].sort((a, b) => a.priority - b.priority);
            const idx = sorted.findIndex(p => p.id === id);
            const newIdx = Math.max(0, Math.min(sorted.length - 1, idx + delta));
            const swapItem = sorted[newIdx];
            if (swapItem.id === id) return prev;
            const newArr = prev.map(p => {
                if (p.id === id) return { ...p, priority: swapItem.priority };
                if (p.id === swapItem.id) return { ...p, priority: sorted[idx].priority };
                return p;
            });
            return newArr;
        });
    };

    const saveKey = (id) => {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, apiKey: keyValues[id] || p.apiKey } : p));
        setEditingKey(null);
    };

    const sorted = [...providers].sort((a, b) => a.priority - b.priority);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1">AI Provider Management</h3>
                    <p className="text-sm text-surface-400">Configure priority, models, and API keys for all AI providers.</p>
                    {dbUpdatedAt && (
                        <p className="text-xs text-brand-500 font-mono mt-1">
                            Last DB Update: {new Date(dbUpdatedAt).toLocaleString()}
                        </p>
                    )}
                </div>
                <button onClick={saveConfig} className={`px-5 py-2.5 font-bold rounded-xl text-sm transition-all ${saved ? 'bg-green-500 text-white' : 'bg-brand-500 text-surface-950 hover:opacity-90'}`}>
                    {saved ? '✓ Saved!' : 'Save Configuration'}
                </button>
            </div>

            {/* Primary Provider Selector */}
            <div className="p-5 bg-gradient-to-r from-brand-500/10 to-surface-900 border border-brand-500/30 rounded-xl">
                <div className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3">🏆 Primary Provider (Default for all workspaces)</div>
                <div className="flex flex-wrap gap-2">
                    {sorted.filter(p => p.enabled).map(p => (
                        <button key={p.id} onClick={() => setPrimaryProvider(p.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${primaryProvider === p.id ? 'bg-brand-500 text-surface-950 border-brand-500 shadow-[0_0_15px_rgba(0,217,165,0.4)]' : 'bg-surface-800 text-surface-300 border-white/10 hover:border-brand-500/50'}`}>
                            {p.logo} {p.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Provider Cards */}
            <div className="space-y-4">
                {sorted.map((provider, idx) => (
                    <div key={provider.id} className={`p-5 rounded-xl border transition-all ${provider.enabled ? 'bg-surface-900 border-white/10' : 'bg-surface-950 border-white/5 opacity-60'}`}>
                        <div className="flex flex-col lg:flex-row gap-4">
                            {/* Left: Info + Toggle */}
                            <div className="flex items-start gap-4 flex-1">
                                <div className="text-3xl mt-1">{provider.logo}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h4 className={`text-base font-bold ${provider.color}`}>{provider.name}</h4>
                                        {primaryProvider === provider.id && (
                                            <span className="text-xs px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded-full border border-brand-500/30 font-bold">PRIMARY</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${provider.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-surface-700 text-surface-400'}`}>
                                            {provider.status}
                                        </span>
                                        <span className="text-xs text-surface-500">#{provider.priority} Priority</span>
                                        {provider.latency && (
                                            <span className="text-xs text-surface-500">{provider.latency}ms avg</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-surface-500 mt-1">{provider.website}</div>

                                    {/* Model Selector */}
                                    <div className="mt-3">
                                        <label className="text-xs text-surface-400 mb-1 block">Active Model:</label>
                                        <select
                                            value={provider.selectedModel}
                                            onChange={e => setModel(provider.id, e.target.value)}
                                            className="bg-surface-800 border border-white/10 text-white text-sm rounded-lg px-3 py-2 w-full max-w-sm focus:outline-none focus:border-brand-500 cursor-pointer"
                                        >
                                            {provider.models.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* API Key - ONLY show for primary provider because DB stores 1 key globally */}
                                    {primaryProvider === provider.id && (
                                        <div className="mt-3 bg-brand-500/5 p-3 rounded-xl border border-brand-500/20">
                                            <label className="text-xs font-bold text-brand-400 block mb-2">
                                                {provider.id === 'webhook' ? 'Global Custom Webhook URL (Primary)' : 'Global API Key (Primary)'}
                                            </label>
                                            {editingKey === provider.id ? (
                                                <div className="flex gap-2 max-w-sm">
                                                    <input
                                                        type="text"
                                                        placeholder={provider.id === 'webhook' ? "Enter custom webhook URL (e.g. n8n)..." : `Enter ${provider.name} API key...`}
                                                        value={keyValues[provider.id] || ''}
                                                        onChange={e => setKeyValues(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                                        className="flex-1 bg-surface-950 border border-brand-500/50 text-white text-xs rounded-lg px-3 py-2 focus:outline-none font-mono"
                                                    />
                                                    <button onClick={() => saveKey(provider.id)} className="px-3 py-2 bg-brand-500 text-surface-950 text-xs font-bold rounded-lg">Apply</button>
                                                    <button onClick={() => setEditingKey(null)} className="px-3 py-2 bg-surface-700 text-white text-xs font-bold rounded-lg">✕</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-mono text-white">
                                                        {provider.apiKey ? (
                                                            provider.id === 'webhook' ? provider.apiKey : `${provider.apiKey.slice(0, 6)}••••••••••••••`
                                                        ) : (
                                                            provider.id === 'webhook' ? 'No Webhook URL set' : 'No API key set'
                                                        )}
                                                    </span>
                                                    <button onClick={() => { setEditingKey(provider.id); setKeyValues(prev => ({ ...prev, [provider.id]: provider.apiKey || '' })) }} className="text-xs text-brand-400 hover:text-brand-300 font-bold underline">
                                                        {provider.apiKey ? (provider.id === 'webhook' ? 'Edit URL' : 'Change Key') : (provider.id === 'webhook' ? 'Set Webhook URL' : 'Set API Key')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Controls */}
                            <div className="flex lg:flex-col items-center justify-between lg:justify-start gap-4 lg:gap-3 flex-shrink-0">
                                {/* Toggle */}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={provider.enabled} onChange={() => toggleProvider(provider.id)} />
                                    <div className="w-11 h-6 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                                </label>
                                {/* Priority Arrows */}
                                <div className="flex lg:flex-col gap-1">
                                    <button onClick={() => setPriority(provider.id, -1)} disabled={idx === 0}
                                        className="w-8 h-8 flex items-center justify-center bg-surface-800 hover:bg-surface-700 text-white rounded-lg text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">▲</button>
                                    <button onClick={() => setPriority(provider.id, 1)} disabled={idx === sorted.length - 1}
                                        className="w-8 h-8 flex items-center justify-center bg-surface-800 hover:bg-surface-700 text-white rounded-lg text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">▼</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Fallback Order Summary */}
            <div className="p-4 bg-surface-900 border border-white/5 rounded-xl">
                <div className="text-xs font-bold text-surface-400 uppercase tracking-widest mb-3">⛓️ Active Fallback Chain</div>
                <div className="flex flex-wrap items-center gap-2">
                    {sorted.filter(p => p.enabled).map((p, i) => (
                        <React.Fragment key={p.id}>
                            <span className={`text-sm font-bold ${p.color}`}>{p.logo} {p.name} ({p.selectedModel})</span>
                            {i < sorted.filter(x => x.enabled).length - 1 && <span className="text-surface-600 text-sm">→</span>}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PlaceholderTab({ title, desc }) {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
            <Wrench className="w-12 h-12 text-surface-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-surface-400 max-w-md">{desc}</p>
            <div className="mt-8 px-4 py-2 bg-brand-500/10 text-brand-400 text-xs font-bold rounded-full border border-brand-500/20">
                Coming in V2 Orchestration Update
            </div>
        </div>
    );
}

function GlobalAgentsTab() {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Global AI Agents</h3>
                    <p className="text-sm text-surface-400">Standard system personas available to all workspaces.</p>
                </div>
                <button className="px-4 py-2 bg-brand-500 text-surface-950 font-bold rounded-lg text-sm">Create Agent</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Sales Agent', 'Support Agent', 'Billing Expert', 'E-commerce Concierge'].map((agent, i) => (
                    <div key={i} className="p-4 bg-surface-950 border border-white/5 rounded-lg flex items-start gap-4">
                        <div className="p-2 bg-surface-800 rounded-lg"><Bot className="w-5 h-5 text-brand-500" /></div>
                        <div className="flex-1">
                            <h4 className="text-white font-medium mb-1">{agent}</h4>
                            <p className="text-xs text-surface-400 mb-3">Specialized for handling contextual queries related to {agent.toLowerCase().split(' ')[0]}.</p>
                            <div className="flex gap-2">
                                <span className="text-xs px-2 py-1 bg-surface-800 rounded">gpt-4o</span>
                                <span className="text-xs px-2 py-1 bg-surface-800 rounded">Tools Enabled</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RoutingEngineTab() {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-bold text-white mb-1">AI Routing Engine</h3>
            <p className="text-sm text-surface-400 mb-6">Semantic routing rules to direct user intents to the correct agent.</p>
            <div className="space-y-4">
                {[
                    { intent: 'refund, billing, invoice', agent: 'Billing Expert' },
                    { intent: 'buy, price, features', agent: 'Sales Agent' },
                    { intent: 'track order, return policy', agent: 'E-commerce Concierge' },
                ].map((rule, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-surface-950 rounded-lg border border-white/5">
                        <div className="flex-1">
                            <div className="text-xs text-surface-400 mb-1">If intent matches:</div>
                            <div className="text-white font-medium text-sm">"{rule.intent}"</div>
                        </div>
                        <GitBranch className="w-5 h-5 text-surface-600" />
                        <div className="flex-1 text-right">
                            <div className="text-xs text-surface-400 mb-1">Route to:</div>
                            <div className="text-brand-400 font-medium text-sm">{rule.agent}</div>
                        </div>
                    </div>
                ))}
            </div>
            <button className="mt-4 w-full py-3 border border-dashed border-surface-600 rounded-xl text-sm font-medium text-surface-400 hover:text-white hover:border-brand-500 transition-all">
                + Add Routing Rule
            </button>
        </div>
    );
}

function ToolsManagerTab() {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-bold text-white mb-1">Global Tools Manager</h3>
            <p className="text-sm text-surface-400 mb-6">Enable or disable function-calling tools globally across the platform.</p>
            <div className="space-y-3">
                {[
                    { name: 'search_products', desc: 'Allows AI to query the ecommerce catalog.' },
                    { name: 'create_payment_link', desc: 'Allows AI to generate Razorpay/Stripe links.' },
                    { name: 'get_order_status', desc: 'Allows AI to fetch real-time shipping status.' },
                    { name: 'escalate_to_human', desc: 'Transfers chat to live human agents.' },
                ].map((tool, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-surface-950 border border-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Wrench className="w-4 h-4 text-brand-500" />
                            <div>
                                <div className="text-white font-mono text-sm">{tool.name}</div>
                                <div className="text-xs text-surface-400">{tool.desc}</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked={true} />
                            <div className="w-9 h-5 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PromptManagerTab() {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-bold text-white mb-1">Global Prompt Templates</h3>
            <p className="text-sm text-surface-400 mb-6">Manage base instructions injected into all AI sessions.</p>
            <div className="space-y-4">
                <div className="p-4 bg-surface-950 border border-brand-500/20 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-brand-400 font-medium">Core System Prompt</h4>
                        <span className="text-xs text-surface-500 font-mono">v12.4 • Active</span>
                    </div>
                    <textarea 
                        className="w-full h-32 bg-surface-900 border border-white/5 rounded-lg p-3 text-sm text-surface-300 focus:outline-none focus:border-brand-500 font-mono resize-none"
                        defaultValue="You are a highly capable AI assistant operating within a WhatsApp SaaS platform..."
                    />
                    <div className="mt-3 flex justify-end gap-2">
                        <button className="text-xs px-3 py-1.5 bg-surface-800 text-white rounded">Rollback</button>
                        <button className="text-xs px-3 py-1.5 bg-brand-500 text-surface-950 font-bold rounded">Save Version</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SandboxTab() {
    return (
        <div className="bg-surface-900 rounded-xl border border-white/5 p-6 flex flex-col items-center justify-center min-h-[400px]">
            <Beaker className="w-12 h-12 text-brand-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">AI Sandbox Simulator</h3>
            <p className="text-surface-400 max-w-md text-center mb-6">Test routing rules, prompt injections, and multi-agent handoffs in a secure isolated chat environment.</p>
            <button className="px-6 py-3 bg-brand-500 text-surface-950 font-bold rounded-xl shadow-[0_0_15px_rgba(0,217,165,0.3)]">
                Launch Sandbox Session
            </button>
        </div>
    );
}

function IntegrationsTab() {
    return (
        <PlaceholderTab 
            title="Integrations & Webhooks" 
            desc="Connect external channels, trigger dynamic webhooks, and map third-party SaaS products." 
        />
    );
}
