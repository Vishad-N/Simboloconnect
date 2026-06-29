import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Plus, FolderOpen, GitBranch, MoreVertical, Edit2, Trash2, Archive,
    ChevronRight, Activity, Zap, Clock, CheckCircle2, PauseCircle,
    AlertCircle, Search, X, Layers, Play
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const STATUS_CONFIG = {
    DRAFT:      { label: 'Draft',     color: '#9ca3af', bg: 'rgba(156,163,175,0.1)',  icon: Edit2 },
    PUBLISHED:  { label: 'Published', color: '#00d9a5', bg: 'rgba(0,217,165,0.1)',   icon: CheckCircle2 },
    PAUSED:     { label: 'Paused',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: PauseCircle },
    ARCHIVED:   { label: 'Archived',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icon: Archive },
};

function CreateProjectModal({ onClose, onCreate }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#00d9a5');
    const [loading, setLoading] = useState(false);

    const COLORS = ['#00d9a5', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API}/api/visual-flows/projects`, { name, description, color });
            onCreate(res.data);
            onClose();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
            <div className="w-full max-w-md rounded-2xl border p-6 bg-surface-900 border-surface-700">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">New Automation Project</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-all">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Project Name *</label>
                        <input
                            type="text" required autoFocus
                            placeholder="e.g. Lead Nurture, Order Updates..."
                            className="input-field w-full"
                            value={name} onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Description</label>
                        <textarea
                            rows={2} placeholder="What does this project automate?"
                            className="input-field w-full resize-none"
                            value={description} onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-2">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map(c => (
                                <button key={c} type="button"
                                    onClick={() => setColor(c)}
                                    className="w-7 h-7 rounded-full transition-all"
                                    style={{
                                        background: c,
                                        outline: color === c ? `3px solid ${c}` : 'none',
                                        outlineOffset: '2px',
                                        opacity: color === c ? 1 : 0.6
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={loading || !name.trim()} className="btn-primary flex-1">
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function FlowCard({ flow, projectId, onDelete, onDuplicate }) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const cfg = STATUS_CONFIG[flow.status] || STATUS_CONFIG.DRAFT;
    const Icon = cfg.icon;

    const timeAgo = (d) => {
        const s = Math.floor((Date.now() - new Date(d)) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        return `${Math.floor(s/86400)}d ago`;
    };

    return (
        <div
            className="group relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-brand-500/30 bg-surface-900 border-surface-700"
            onClick={() => navigate(`/chatbot/visual-flows/flow/${flow.id}`)}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,217,165,0.1)' }}>
                        <GitBranch size={16} style={{ color: '#00d9a5' }} />
                    </div>
                    <span className="text-sm font-semibold text-white truncate max-w-[120px]">{flow.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        <Icon size={10} /> {cfg.label}
                    </span>
                    <div className="relative">
                        <button
                            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                            className="p-1 rounded-md text-surface-500 hover:text-white hover:bg-surface-800 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <MoreVertical size={14} />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-6 z-20 rounded-xl border shadow-2xl py-1 min-w-[140px] bg-surface-900 border-surface-700">
                                <button onClick={e => { e.stopPropagation(); onDuplicate(flow.id); setMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 transition-all">
                                    <Layers size={13} /> Duplicate
                                </button>
                                <button onClick={e => { e.stopPropagation(); if(confirm('Delete this flow?')) { onDelete(flow.id); } setMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
                                    <Trash2 size={13} /> Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-surface-500 mb-3 truncate">
                Trigger: <span className="text-surface-400">{flow.trigger || 'ALL_MESSAGES'}</span>
            </p>

            <div className="flex items-center justify-between text-xs text-surface-600">
                <span className="flex items-center gap-1">
                    <Clock size={11} /> {timeAgo(flow.updatedAt)}
                </span>
                {flow._count?.executions > 0 && (
                    <span className="flex items-center gap-1 text-surface-500">
                        <Activity size={11} /> {flow._count.executions} runs
                    </span>
                )}
            </div>
        </div>
    );
}

function ProjectCard({ project, onEdit, onDelete, onCreateFlow }) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(true);
    const [loading, setLoading] = useState(false);

    const activeFlows = project.flows?.filter(f => f.status === 'PUBLISHED') || [];
    const totalFlows = project.flows?.length || 0;

    const handleDeleteFlow = async (flowId) => {
        try {
            await axios.delete(`${API}/api/visual-flows/${flowId}`);
            // Refresh handled by parent
            window.location.reload();
        } catch {}
    };

    const handleDuplicateFlow = async (flowId) => {
        try {
            await axios.post(`${API}/api/visual-flows/${flowId}/duplicate`);
            window.location.reload();
        } catch {}
    };

    return (
        <div className="rounded-2xl border mb-4 overflow-hidden transition-all bg-surface-900 border-surface-700">
            {/* Project Header */}
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-all"
                onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color || '#00d9a5' }} />
                    <div>
                        <h3 className="font-semibold text-white text-sm">{project.name}</h3>
                        {project.description && (
                            <p className="text-xs text-surface-500 mt-0.5">{project.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                            <GitBranch size={11} /> {totalFlows} flows
                        </span>
                        {activeFlows.length > 0 && (
                            <span className="flex items-center gap-1 text-brand-400">
                                <Zap size={11} /> {activeFlows.length} live
                            </span>
                        )}
                    </div>
                    <ChevronRight size={16} className="text-surface-500 transition-transform"
                        style={{ transform: expanded ? 'rotate(90deg)' : 'none' }} />
                </div>
            </div>

            {/* Flows Grid */}
            {expanded && (
                <div className="p-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {project.flows?.map(flow => (
                            <FlowCard
                                key={flow.id}
                                flow={flow}
                                projectId={project.id}
                                onDelete={handleDeleteFlow}
                                onDuplicate={handleDuplicateFlow}
                            />
                        ))}
                        {/* Create new flow in this project */}
                        <button
                            onClick={() => onCreateFlow(project.id)}
                            className="rounded-xl border border-dashed border-surface-600 p-4 flex flex-col items-center justify-center gap-2 text-surface-600 hover:text-brand-400 hover:border-brand-500/40 transition-all min-h-[110px]"
                        >
                            <Plus size={20} />
                            <span className="text-xs font-medium">New Flow</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FlowProjects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [unassignedFlows, setUnassignedFlows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [projectsRes, allFlowsRes] = await Promise.all([
                axios.get(`${API}/api/visual-flows/projects`),
                axios.get(`${API}/api/visual-flows`)
            ]);
            setProjects(projectsRes.data);
            setUnassignedFlows(allFlowsRes.data.filter(f => !f.projectId));
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCreateFlow = async (projectId = null) => {
        try {
            const res = await axios.post(`${API}/api/visual-flows`, {
                name: 'Untitled Flow',
                trigger: 'ALL_MESSAGES',
                nodes: [],
                edges: [],
                status: 'DRAFT',
                projectId
            });
            navigate(`/chatbot/visual-flows/flow/${res.data.id}`);
        } catch (err) {
            alert('Failed to create flow');
        }
    };

    const handleDeleteFlow = async (flowId) => {
        try {
            await axios.delete(`${API}/api/visual-flows/${flowId}`);
            fetchData();
        } catch {}
    };

    const handleDuplicateFlow = async (flowId) => {
        try {
            await axios.post(`${API}/api/visual-flows/${flowId}/duplicate`);
            fetchData();
        } catch {}
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-surface-400 animate-pulse">Loading automation projects...</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                        <GitBranch className="text-brand-400" size={26} />
                        Flow Builder
                    </h1>
                    <p className="text-surface-400 text-sm">
                        Build and manage your WhatsApp automation flows. Organize into projects.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleCreateFlow(null)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Plus size={16} /> New Flow
                    </button>
                    <button
                        onClick={() => setShowCreateProject(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <FolderOpen size={16} /> New Project
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Projects', value: projects.length, icon: FolderOpen, color: '#00d9a5' },
                    { label: 'Total Flows', value: projects.reduce((a, p) => a + (p.flows?.length || 0), 0) + unassignedFlows.length, icon: GitBranch, color: '#00d9a5' },
                    { label: 'Published', value: [...projects.flatMap(p => p.flows || []), ...unassignedFlows].filter(f => f.status === 'PUBLISHED').length, icon: CheckCircle2, color: '#10b981' },
                    { label: 'Drafts', value: [...projects.flatMap(p => p.flows || []), ...unassignedFlows].filter(f => f.status === 'DRAFT').length, icon: Edit2, color: '#9ca3af' },
                ].map(stat => (
                    <div key={stat.label} className="rounded-xl border p-4 bg-surface-900 border-surface-700">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon size={16} style={{ color: stat.color }} />
                            <span className="text-xs text-surface-400">{stat.label}</span>
                        </div>
                        <span className="text-2xl font-bold text-white">{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Search */}
            {projects.length > 0 && (
                <div className="relative mb-6">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                    <input
                        type="text" placeholder="Search projects..."
                        className="input-field w-full max-w-xs pl-9"
                        value={search} onChange={e => setSearch(e.target.value)}
                    />
                </div>
            )}

            {/* Projects */}
            {filteredProjects.length > 0 ? (
                filteredProjects.map(project => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        onCreateFlow={handleCreateFlow}
                    />
                ))
            ) : null}

            {/* Unassigned flows */}
            {unassignedFlows.length > 0 && (
                <div className="rounded-2xl border mb-4 overflow-hidden bg-surface-900 border-surface-700">
                    <div className="flex items-center gap-2 p-4 pb-3">
                        <Layers size={15} className="text-surface-500" />
                        <span className="text-sm font-medium text-surface-400">Unassigned Flows</span>
                    </div>
                    <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {unassignedFlows.map(flow => (
                                <FlowCard
                                    key={flow.id}
                                    flow={flow}
                                    onDelete={handleDeleteFlow}
                                    onDuplicate={handleDuplicateFlow}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {projects.length === 0 && unassignedFlows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ background: 'rgba(0,217,165,0.08)', border: '1px solid rgba(0,217,165,0.2)' }}>
                        <GitBranch size={28} style={{ color: '#00d9a5' }} />
                    </div>
                    <h3 className="text-white font-semibold mb-2">No automation flows yet</h3>
                    <p className="text-surface-400 text-sm mb-6 max-w-sm">
                        Create your first automation project. Organize flows by campaign, use case, or customer journey.
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowCreateProject(true)} className="btn-secondary">
                            <FolderOpen size={15} /> New Project
                        </button>
                        <button onClick={() => handleCreateFlow(null)} className="btn-primary">
                            <Plus size={15} /> Create Flow
                        </button>
                    </div>
                </div>
            )}

            {showCreateProject && (
                <CreateProjectModal
                    onClose={() => setShowCreateProject(false)}
                    onCreate={(project) => setProjects(prev => [project, ...prev])}
                />
            )}
        </div>
    );
}
