import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Activity, ShieldAlert, Globe, Server, Bot, Workflow, 
    Users, Wrench, BarChart3, Terminal, Plug, GitBranch, 
    Beaker, Power, CheckCircle2, Search, Loader2, Play, Lock
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const TABS = [
    { id: 'overview', label: 'Global Overview', icon: Globe },
    { id: 'providers', label: 'AI Providers', icon: Server },
    { id: 'agents', label: 'AI Agents', icon: Bot },
    { id: 'routing', label: 'AI Routing', icon: GitBranch },
    { id: 'workspaces', label: 'Workspace AI', icon: Users },
    { id: 'tools', label: 'Global Tools', icon: Wrench },
    { id: 'analytics', label: 'AI Analytics', icon: BarChart3 },
    { id: 'security', label: 'Security Center', icon: ShieldAlert },
    { id: 'logs', label: 'Execution Logs', icon: Terminal },
    { id: 'integrations', label: 'n8n & Webhooks', icon: Plug },
    { id: 'sandbox', label: 'Sandbox Lab', icon: Beaker },
];

export default function AiAdminCenter() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [logs, setLogs] = useState([]);
    const [security, setSecurity] = useState(null);

    const { socket } = useSocket();
    const [liveEvents, setLiveEvents] = useState([]);

    useEffect(() => {
        if (!socket) return;
        const handleEvent = (evt) => {
            setLiveEvents(prev => [evt, ...prev].slice(0, 10));
        };
        socket.on('admin_ai_action', handleEvent);
        return () => socket.off('admin_ai_action', handleEvent);
    }, [socket]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, workspacesRes, logsRes, secRes] = await Promise.all([
                axios.get('/api/admin/ai/overview'),
                axios.get('/api/admin/ai/workspaces'),
                axios.get('/api/admin/ai/logs'),
                axios.get('/api/admin/ai/security')
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
        fetchData();
    }, []);

    const toggleWorkspaceAi = async (id, currentStatus) => {
        try {
            await axios.post(`/api/admin/ai/workspaces/${id}/toggle`, { botEnabled: !currentStatus });
            setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, botEnabled: !currentStatus } : w));
        } catch (e) {
            alert("Failed to toggle AI for workspace.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-80px)] bg-surface-950 flex flex-col items-center justify-center rounded-xl border border-white/5 shadow-2xl">
                <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Connecting to AI Control Plane...</h2>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-80px)] bg-surface-950 text-surface-50 flex rounded-xl overflow-hidden border border-brand-500/10 shadow-[0_0_50px_rgba(0,217,165,0.05)] relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[300px] bg-brand-500/5 blur-[120px] pointer-events-none"></div>

            {/* Admin Sidebar */}
            <div className="w-64 bg-surface-950 border-r border-white/5 flex flex-col flex-shrink-0 z-10 relative">
                <div className="p-6 border-b border-white/5 bg-gradient-to-b from-brand-500/5 to-transparent">
                    <div className="flex items-center gap-3 mb-1">
                        <ShieldAlert className="w-6 h-6 text-brand-400" />
                        <h1 className="text-xl font-bold text-white tracking-tight">Mission Control</h1>
                    </div>
                    <p className="text-xs text-surface-400 mt-2 font-mono">GLOBAL AI ORCHESTRATION</p>
                </div>
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                                activeTab === tab.id 
                                ? 'bg-brand-500 text-surface-950 font-bold shadow-[0_0_15px_rgba(0,217,165,0.3)]' 
                                : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </div>
                            {tab.id === 'security' && security?.stats?.failedValidations > 0 && (
                                <span className={`w-2 h-2 rounded-full ${activeTab === tab.id ? 'bg-surface-950' : 'bg-red-500 animate-pulse'}`}></span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto bg-surface-950/50 backdrop-blur-xl z-10 relative custom-scrollbar">
                <div className="max-w-7xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'overview' && <OverviewTab stats={stats} />}
                            {activeTab === 'providers' && <ProvidersTab />}
                            {activeTab === 'agents' && <AgentsTab />}
                            {activeTab === 'routing' && <RoutingTab />}
                            {activeTab === 'workspaces' && <WorkspacesTab workspaces={workspaces} toggleWorkspaceAi={toggleWorkspaceAi} />}
                            {activeTab === 'tools' && <GlobalToolsTab />}
                            {activeTab === 'analytics' && <AnalyticsTab stats={stats} />}
                            {activeTab === 'security' && <SecurityCenterTab security={security} />}
                            {activeTab === 'logs' && <GlobalLogsTab logs={logs} />}
                            {activeTab === 'integrations' && <IntegrationsTab />}
                            {activeTab === 'sandbox' && <AdminSandboxTab />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// --- TABS ---

function OverviewTab({ stats }) {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Global Infrastructure</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-xs font-mono">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
                    SYSTEM OPERATIONAL
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard title="Active AI Workspaces" value={`${stats?.activeWorkspaces} / ${stats?.totalWorkspaces}`} icon={Users} color="brand" />
                <StatCard title="Total AI Actions" value={stats?.totalActions} icon={Activity} color="blue" />
                <StatCard title="Token Consumption" value={`${(stats?.totalTokens / 1000000).toFixed(2)}M`} icon={Database} color="orange" />
                <StatCard title="Total AI Cost" value={`$${parseFloat(stats?.estimatedCost || 0).toFixed(2)}`} icon={BarChart3} color="green" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-surface-900 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Traffic & Routing Health</h3>
                    <div className="h-64 flex items-end justify-between gap-2 border-b border-white/10 pb-4">
                        {/* Placeholder Chart */}
                        {[40, 70, 45, 90, 65, 85, 120, 100, 140, 110, 160, 180, 150].map((h, i) => (
                            <div key={i} className="w-full bg-brand-500/20 hover:bg-brand-500 transition-colors rounded-t-sm relative group cursor-pointer" style={{ height: `${(h/180)*100}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                    {h * 10} Requests
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Infrastructure Status</h3>
                        <div className="space-y-4">
                            <StatusRow label="OpenAI API Gateway" status={stats?.health?.openai} />
                            <StatusRow label="Redis Memory Cluster" status={stats?.health?.redis} />
                            <StatusRow label="BullMQ Orchestrator" status={stats?.health?.bullmq} />
                            <StatusRow label="Provider Failover Engine" status="Standby" color="blue" />
                        </div>
                    </div>
                    
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Security Overview</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-surface-400 text-sm">Failed Validations</span>
                                <span className="text-red-400 font-bold">{stats?.failedActions}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-surface-400 text-sm">Human Escalations</span>
                                <span className="text-yellow-400 font-bold">{stats?.escalations}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color }) {
    const colorClasses = {
        brand: 'text-brand-500 bg-brand-500/10',
        blue: 'text-blue-500 bg-blue-500/10',
        orange: 'text-orange-500 bg-orange-500/10',
        green: 'text-green-500 bg-green-500/10'
    };
    
    return (
        <div className="bg-surface-900 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-surface-400 text-sm font-medium">{title}</h3>
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        </div>
    );
}

function StatusRow({ label, status, color = "brand" }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-surface-300 text-sm">{label}</span>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color === 'brand' ? 'bg-brand-500' : 'bg-blue-500'} animate-pulse`}></div>
                <span className="text-white text-xs font-mono">{status}</span>
            </div>
        </div>
    );
}

function ProvidersTab() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Provider Orchestration</h2>
                    <p className="text-surface-400 mt-1">Manage global AI API keys, fallback routes, and load balancing.</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Primary Provider */}
                <div className="bg-surface-900 border border-brand-500/30 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-brand-500 text-surface-950 text-xs font-bold rounded-bl-lg">PRIMARY</div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-surface-950 rounded-xl border border-white/5">
                                <Server className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">OpenAI (GPT-4o)</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                                    <span className="text-xs text-brand-500 font-mono">Latency: 450ms</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-surface-400">Monthly Usage</p>
                            <p className="text-xl font-bold text-white">$1,240.50</p>
                        </div>
                    </div>
                </div>

                {/* Fallback 1 */}
                <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 relative opacity-70 hover:opacity-100 transition-opacity">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-surface-700 text-white text-xs font-bold rounded-bl-lg">FALLBACK 1</div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-surface-950 rounded-xl border border-white/5">
                                <Server className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Anthropic (Claude 3.5 Sonnet)</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-surface-600"></div>
                                    <span className="text-xs text-surface-500 font-mono">Standby</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fallback 2 */}
                <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 relative opacity-70 hover:opacity-100 transition-opacity">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-surface-700 text-white text-xs font-bold rounded-bl-lg">FALLBACK 2</div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-surface-950 rounded-xl border border-white/5">
                            <Server className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">OpenRouter (Meta Llama 3)</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-surface-600"></div>
                                <span className="text-xs text-surface-500 font-mono">Standby</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function WorkspacesTab({ workspaces, toggleWorkspaceAi }) {
    const [search, setSearch] = useState('');
    
    const filtered = workspaces.filter(w => w.name?.toLowerCase().includes(search.toLowerCase()) || w.email?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Workspace AI Management</h2>
                <div className="relative">
                    <Search className="w-5 h-5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text"
                        placeholder="Search workspaces..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-surface-900 border border-white/10 rounded-lg text-white text-sm focus:border-brand-500 outline-none w-64"
                    />
                </div>
            </div>

            <div className="bg-surface-900 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-surface-950/50 border-b border-white/5">
                        <tr className="text-xs uppercase tracking-wider text-surface-400 font-medium">
                            <th className="px-6 py-4">Workspace</th>
                            <th className="px-6 py-4">AI Source</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Actions Executed</th>
                            <th className="px-6 py-4">Env</th>
                            <th className="px-6 py-4 text-right">Master Switch</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filtered.map(w => (
                            <tr key={w.id} className="hover:bg-white/[0.02]">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{w.name}</div>
                                    <div className="text-xs text-surface-400">{w.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Server className="w-4 h-4 text-surface-400" />
                                        <span className="text-sm text-surface-200">{w.aiAgent?.useOwnAi ? 'Custom Key' : 'Admin AI'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${w.botEnabled ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {w.botEnabled ? 'ACTIVE' : 'SUSPENDED'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-surface-300 font-mono">
                                    {w._count.aiActionLogs}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {w.aiAgent?.sandboxMode ? <span className="text-yellow-500 flex items-center gap-1"><Beaker className="w-4 h-4"/> Sandbox</span> : 'Live'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => toggleWorkspaceAi(w.id, w.botEnabled)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            w.botEnabled ? 'bg-surface-800 text-red-400 hover:bg-red-500/20' : 'bg-brand-500 text-surface-950 hover:bg-brand-600'
                                        }`}
                                    >
                                        {w.botEnabled ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SecurityCenterTab({ security }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-red-500" /> Security Center
            </h2>
            <p className="text-surface-400 mb-6">Monitoring workspace boundaries, prompt injections, and API abuse.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-surface-900 border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-surface-400 text-sm mb-2">Isolation Breaches Prevented</h3>
                    <p className="text-3xl font-bold text-white">{security?.stats?.failedValidations || 0}</p>
                </div>
                <div className="bg-surface-900 border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-surface-400 text-sm mb-2">Prompt Injections Caught</h3>
                    <p className="text-3xl font-bold text-white">0</p>
                </div>
                <div className="bg-surface-900 border border-white/5 p-6 rounded-2xl">
                    <h3 className="text-surface-400 text-sm mb-2">Rate Limit Violations</h3>
                    <p className="text-3xl font-bold text-white">0</p>
                </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-4">Security Threat Log</h3>
            <div className="bg-surface-900 border border-white/5 rounded-2xl overflow-hidden">
                {security?.alerts?.length > 0 ? (
                    <table className="w-full text-left">
                        <thead className="bg-surface-950/50 border-b border-white/5">
                            <tr className="text-xs uppercase text-surface-400">
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Workspace</th>
                                <th className="px-6 py-4">Attempted Action</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {security.alerts.map(a => (
                                <tr key={a.id} className="hover:bg-white/[0.02]">
                                    <td className="px-6 py-4 text-sm text-surface-300">{new Date(a.executedAt).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-white">{a.user?.name}</td>
                                    <td className="px-6 py-4 text-sm text-surface-400 font-mono">{a.toolName}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs font-bold rounded">BLOCKED</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="w-12 h-12 text-brand-500 mx-auto mb-3" />
                        <p className="text-white font-medium">No security threats detected.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Placeholder Tabs for the rest to keep code clean and modular
function AgentsTab() { return <PlaceholderTab title="AI Agents" desc="Global AI Agent builder. Design specific agents (Sales, Support) that tenants can deploy." /> }
function RoutingTab() { return <PlaceholderTab title="AI Routing Engine" desc="Visual orchestration layer to route user intents to specific specialized AI agents." /> }
function GlobalToolsTab() { return <PlaceholderTab title="Global Tools Registry" desc="Manage, version, and approve all custom tools available to tenant workspaces." /> }
function AnalyticsTab({ stats }) { return <PlaceholderTab title="Advanced AI Analytics" desc="Drill down into cross-tenant ROI, conversion metrics, and cost analysis." /> }
function GlobalLogsTab({ logs }) { return <PlaceholderTab title="Global Execution Logs" desc="Master timeline of every single AI action taken across the entire platform." /> }
function IntegrationsTab() { return <PlaceholderTab title="n8n & Webhooks" desc="Connect the AI core to external workflow engines like n8n, Make, or Zapier." /> }
function AdminSandboxTab() { return <PlaceholderTab title="Admin Sandbox Lab" desc="Safely simulate traffic, test prompt injections, and evaluate failover logic." /> }

function PlaceholderTab({ title, desc }) {
    return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <Wrench className="w-16 h-16 text-surface-700 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            <p className="text-surface-400">{desc}</p>
            <div className="mt-8 px-4 py-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-xs font-mono">
                COMING IN PHASE 2
            </div>
        </div>
    );
}
