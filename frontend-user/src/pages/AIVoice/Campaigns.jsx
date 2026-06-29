import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, BarChart2, Download, RotateCcw, XCircle, RefreshCw, Play, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const VoiceCampaigns = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [agents, setAgents] = useState([]);
    const [providers, setProviders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedCampaignId, setSelectedCampaignId] = useState(null);
    const [selectedCampaignDetails, setSelectedCampaignDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Retarget Modal State
    const [showRetargetModal, setShowRetargetModal] = useState(false);
    const [retargetStatuses, setRetargetStatuses] = useState(['FAILED', 'NO_ANSWER', 'BUSY']);
    const [retargeting, setRetargeting] = useState(false);

    const fetchCampaignDetails = async (id) => {
        try {
            setDetailsLoading(true);
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.get(`${API}/api/voice-campaigns/${id}/calls`, { headers });
            setSelectedCampaignDetails(res.data);
        } catch (error) {
            console.error("Failed to fetch campaign details", error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleViewDetails = (id) => {
        setSelectedCampaignId(id);
        setShowDetailsModal(true);
        fetchCampaignDetails(id);
    };

    const handleDownloadCSV = async (id, campaignName) => {
        try {
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            const res = await axios.get(`${API}/api/voice-campaigns/${id}/download-csv`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `campaign_${campaignName.replace(/\s+/g, '_')}_report.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Failed to download CSV", error);
            alert("Failed to download CSV report");
        }
    };

    const handleLaunchRetarget = async () => {
        if (retargetStatuses.length === 0) {
            alert("Please select at least one status to retarget");
            return;
        }
        setRetargeting(true);
        try {
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            const res = await axios.post(`${API}/api/voice-campaigns/${selectedCampaignId}/retarget`, {
                statuses: retargetStatuses
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(res.data.message || "Retarget campaign created successfully!");
            setShowRetargetModal(false);
            setShowDetailsModal(false);
            fetchAll();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to retarget campaign");
        } finally {
            setRetargeting(false);
        }
    };

    useEffect(() => {
        let interval;
        if (showDetailsModal && selectedCampaignId) {
            interval = setInterval(() => {
                fetchCampaignDetails(selectedCampaignId);
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showDetailsModal, selectedCampaignId]);

    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        provider: '',
        agentId: '',
        targetTags: [],
        scheduledAt: '',
        settings: {
            retryEnabled: false,
            retryCount: 1,
            retryDelay: 5000,
            concurrency: 5
        },
        startNow: true
    });

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            const headers = { Authorization: `Bearer ${token}` };
            
            const [campRes, agentsRes, tagsRes, provRes] = await Promise.all([
                axios.get(`${API}/api/voice-campaigns`, { headers }),
                axios.get(`${API}/api/voice-agents`, { headers }),
                axios.get(`${API}/api/contacts/groups`, { headers }).catch(() => ({ data: [] })),
                axios.get(`${API}/api/voice/providers`, { headers })
            ]);
            
            setCampaigns(campRes.data || []);
            setAgents(agentsRes.data || []);
            setTags(tagsRes.data || []);
            setProviders(provRes.data || []);
        } catch (error) {
            console.error("Failed to fetch campaigns", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            await axios.post(`${API}/api/voice-campaigns`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            setFormData({
                name: '',
                provider: '',
                agentId: '',
                targetTags: [],
                scheduledAt: '',
                settings: { retryEnabled: false, retryCount: 1, retryDelay: 5000, concurrency: 5 },
                startNow: true
            });
            fetchAll();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to create campaign");
        } finally {
            setSaving(false);
        }
    };

    const handleAction = async (id, action) => {
        try {
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            await axios.post(`${API}/api/voice-campaigns/${id}/${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.error || `Failed to ${action} campaign`);
        }
    };

    return (
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100%', paddingBottom: 40 }}>
            {/* Hero Header */}
            <div className="border-b border-white/5 bg-surface-900/30" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(245,158,11,.3)' }}>
                        <span className="text-2xl">📢</span>
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', margin: 0 }}>Voice Campaigns</h1>
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Dial massive lists of contacts autonomously using AI Voice</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchAll} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors">
                        🔄 Refresh
                    </button>
                    <button onClick={() => setShowModal(true)} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-black rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 transition-all">
                        + New Campaign
                    </button>
                </div>
            </div>

            <div style={{ padding: '32px' }}>
                {loading ? (
                    <div className="text-center py-16 text-gray-500">Loading campaigns...</div>
                ) : (
                    <div className="bg-surface-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        {campaigns.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-6xl mb-6">🏜️</div>
                                <h3 className="text-xl font-bold text-white mb-2">No Campaigns Yet</h3>
                                <p className="text-gray-400 max-w-md mx-auto mb-8">Create your first AI outbound voice campaign to engage thousands of customers simultaneously.</p>
                                <button onClick={() => setShowModal(true)} className="px-8 py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all">
                                    Start a Campaign
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-black/20 border-b border-white/5 text-xs text-gray-400 uppercase tracking-wider font-bold">
                                            <th className="px-6 py-4">Campaign Name</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Progress</th>
                                            <th className="px-6 py-4">Provider / Agent</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {campaigns.map(camp => {
                                            const progress = camp.audienceCount > 0 ? ((camp.completedCount + camp.failedCount) / camp.audienceCount) * 100 : 0;
                                            return (
                                            <tr key={camp.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white">{camp.name}</div>
                                                    <div className="text-xs text-gray-500 mt-1">Tags: {camp.targetTags?.join(', ') || 'None'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${
                                                        camp.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                        camp.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                        camp.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                        camp.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                    }`}>
                                                        {camp.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                        <span className="text-xs font-mono text-gray-400">{Math.round(progress)}%</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 mt-1.5 uppercase font-semibold">
                                                        {camp.completedCount + camp.failedCount} / {camp.audienceCount} calls
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-white font-medium capitalize">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> {camp.provider}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono mt-1">{camp.agentId?.substring(0,8)}...</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-xs font-medium">
                                                    {new Date(camp.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleViewDetails(camp.id)} 
                                                            className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20" 
                                                            title="View Report & Details"
                                                        >
                                                            <BarChart2 size={14} />
                                                        </button>
                                                        {['DRAFT', 'PAUSED'].includes(camp.status) && (
                                                            <button onClick={() => handleAction(camp.id, 'start')} className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center border border-green-500/20" title="Start">
                                                                <Play size={12} fill="currentColor" />
                                                            </button>
                                                        )}
                                                        {camp.status === 'RUNNING' && (
                                                            <button onClick={() => handleAction(camp.id, 'cancel')} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center border border-red-500/20" title="Cancel">
                                                                <XCircle size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Campaign Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                📢 Create Voice Campaign
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <form id="campaignForm" onSubmit={handleCreateCampaign} className="space-y-6">
                                
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider">1. General</h3>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Campaign Name</label>
                                        <input required type="text" placeholder="e.g. Q3 Sales Outreach" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50" />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider">2. AI Agent Configuration</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Select Provider</label>
                                            <select required value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 appearance-none">
                                                <option value="" disabled>Choose Provider...</option>
                                                {Array.from(new Set(agents.map(a => a.providerId).filter(Boolean))).map(pId => {
                                                    const prov = providers.find(pr => pr.id === pId);
                                                    return <option key={pId} value={pId}>{prov ? prov.name : pId.toUpperCase()}</option>;
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Select Voice Agent</label>
                                            <select required value={formData.agentId} onChange={e => setFormData({...formData, agentId: e.target.value})} disabled={!formData.provider} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 appearance-none disabled:opacity-50">
                                                <option value="" disabled>Choose Agent...</option>
                                                {agents.filter(a => a.providerId === formData.provider).map(a => (
                                                    <option key={a.providerAgentId} value={a.providerAgentId}>{a.name} ({a.language})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider">3. Audience</h3>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Target Contact Tags</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {tags.map(tag => (
                                                <button 
                                                    type="button"
                                                    key={tag}
                                                    onClick={() => {
                                                        const newTags = formData.targetTags.includes(tag) 
                                                            ? formData.targetTags.filter(t => t !== tag)
                                                            : [...formData.targetTags, tag];
                                                        setFormData({...formData, targetTags: newTags});
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formData.targetTags.includes(tag) ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                        {tags.length === 0 && <p className="text-xs text-red-400 mt-2">No tags found in contacts. Create tags first.</p>}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <h3 className="text-sm font-bold text-teal-400 uppercase tracking-wider">4. Execution Strategy</h3>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1.5 block font-semibold flex items-center gap-2">
                                                Concurrent Calls
                                            </label>
                                            <input type="number" min="1" max="100" value={formData.settings.concurrency} onChange={e => setFormData({...formData, settings: {...formData.settings, concurrency: parseInt(e.target.value)}})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50" />
                                            <p className="text-[10px] text-gray-500 mt-1">Number of parallel active lines.</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1.5 block font-semibold flex items-center gap-2">
                                                Schedule Launch
                                            </label>
                                            <input type="datetime-local" value={formData.scheduledAt} onChange={e => setFormData({...formData, scheduledAt: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500/50 [color-scheme:dark]" />
                                            <p className="text-[10px] text-gray-500 mt-1">Leave empty to run instantly.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
                                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                                            <input type="checkbox" checked={formData.settings.retryEnabled} onChange={e => setFormData({...formData, settings: {...formData.settings, retryEnabled: e.target.checked}})} className="w-4 h-4 rounded text-teal-500 bg-black/40 border-white/20 focus:ring-teal-500" />
                                            <span className="text-sm text-white font-semibold">Enable Automatic Retries</span>
                                        </label>
                                        {formData.settings.retryEnabled && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">Max Retries</label>
                                                    <input type="number" min="1" max="5" value={formData.settings.retryCount} onChange={e => setFormData({...formData, settings: {...formData.settings, retryCount: parseInt(e.target.value)}})} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 mb-1 block">Retry Delay (ms)</label>
                                                    <input type="number" min="1000" step="1000" value={formData.settings.retryDelay} onChange={e => setFormData({...formData, settings: {...formData.settings, retryDelay: parseInt(e.target.value)}})} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-4 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                                        <input type="checkbox" id="startNow" checked={formData.startNow} onChange={e => setFormData({...formData, startNow: e.target.checked})} className="w-4 h-4 text-orange-500 focus:ring-orange-500 rounded border-gray-600 bg-gray-700" />
                                        <label htmlFor="startNow" className="text-sm font-semibold text-yellow-500">Start Campaign Immediately (If no schedule is set)</label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="p-6 border-t border-white/10 bg-surface-900/50 flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button type="submit" form="campaignForm" disabled={saving || (!formData.scheduledAt && !formData.startNow)} className="px-8 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/30 text-black font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2">
                                {saving ? 'Creating...' : '🚀 Launch Campaign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Detail Modal */}
            <AnimatePresence>
                {showDetailsModal && selectedCampaignDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface-900 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/10"
                        >
                            <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold text-white">{selectedCampaignDetails.campaign.name}</h2>
                                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold capitalize ${
                                            selectedCampaignDetails.campaign.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                            selectedCampaignDetails.campaign.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                        }`}>
                                            {selectedCampaignDetails.campaign.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 font-medium font-mono">Campaign ID: {selectedCampaignDetails.campaign.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => fetchCampaignDetails(selectedCampaignId)} 
                                        disabled={detailsLoading}
                                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                        title="Refresh details"
                                    >
                                        <RefreshCw size={18} className={detailsLoading ? 'animate-spin text-orange-500' : ''} />
                                    </button>
                                    <button onClick={() => setShowDetailsModal(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                        <XCircle size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-black/10 space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Contacts</div>
                                        <div className="text-2xl font-bold text-white mt-1">{selectedCampaignDetails.stats.total}</div>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dialed / Initiated</div>
                                        <div className="text-2xl font-bold text-white mt-1">
                                            {selectedCampaignDetails.campaign.dialedCount}
                                            <span className="text-xs text-gray-500 font-medium ml-1">
                                                ({selectedCampaignDetails.stats.total > 0 ? Math.round((selectedCampaignDetails.campaign.dialedCount / selectedCampaignDetails.stats.total) * 100) : 0}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Answered (Picked Up)</div>
                                        <div className="text-2xl font-bold text-green-400 mt-1">
                                            {selectedCampaignDetails.stats.answered}
                                            <span className="text-xs text-gray-500 font-medium ml-1">
                                                ({selectedCampaignDetails.campaign.dialedCount > 0 ? Math.round((selectedCampaignDetails.stats.answered / selectedCampaignDetails.campaign.dialedCount) * 100) : 0}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Duration</div>
                                        <div className="text-2xl font-bold text-indigo-400 mt-1">
                                            {Math.floor(selectedCampaignDetails.stats.totalDuration / 60)}m {selectedCampaignDetails.stats.totalDuration % 60}s
                                        </div>
                                    </div>
                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Failed / No Answer</div>
                                        <div className="text-2xl font-bold text-red-400 mt-1">
                                            {selectedCampaignDetails.stats.failed + selectedCampaignDetails.stats.noAnswer + selectedCampaignDetails.stats.busy}
                                        </div>
                                    </div>
                                </div>

                                {/* Filters and Search */}
                                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                                    <div className="relative w-full md:w-80">
                                        <span className="absolute left-3.5 top-3.5 text-gray-500">
                                            <Search size={16} />
                                        </span>
                                        <input 
                                            type="text" 
                                            placeholder="Search by name or phone..." 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 shadow-sm"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto py-1">
                                        {['ALL', 'COMPLETED', 'ANSWERED', 'RINGING', 'NO_ANSWER', 'BUSY', 'FAILED', 'INITIATED'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-all ${
                                                    statusFilter === status 
                                                        ? 'bg-orange-500 border-orange-500 text-black shadow-sm' 
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Call Log Table */}
                                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20 shadow-sm">
                                    <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider font-bold sticky top-0 z-10">
                                                    <th className="px-6 py-4">S.No</th>
                                                    <th className="px-6 py-4">Contact</th>
                                                    <th className="px-6 py-4">Phone</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Duration</th>
                                                    <th className="px-6 py-4">Called At</th>
                                                    <th className="px-6 py-4">Recording</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-sm">
                                                {selectedCampaignDetails.calls
                                                    .filter(call => {
                                                        const matchSearch = (call.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                                            (call.phone || '').includes(searchQuery);
                                                        
                                                        if (statusFilter === 'ALL') return matchSearch;
                                                        if (statusFilter === 'ANSWERED') return matchSearch && call.durationSeconds > 5;
                                                        return matchSearch && call.status === statusFilter;
                                                    })
                                                    .map((call, idx) => (
                                                        <React.Fragment key={call.id}>
                                                            <tr className="hover:bg-white/5 transition-colors">
                                                                <td className="px-6 py-4 font-semibold text-gray-500">{idx + 1}</td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-white">{call.contactName}</div>
                                                                    {call.tags?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {call.tags.map(t => (
                                                                                <span key={t} className="px-1.5 py-0.5 bg-white/5 text-gray-400 rounded text-[9px] font-bold border border-white/10">{t}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 font-mono text-gray-400">{call.phone}</td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2.5 py-1 text-xs rounded-full font-bold inline-flex items-center gap-1 border ${
                                                                        call.status === 'COMPLETED' ? 'bg-green-500/15 text-green-400 border-green-500/20' :
                                                                        call.status === 'ANSWERED' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' :
                                                                        call.status === 'RINGING' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20' :
                                                                        call.status === 'NO_ANSWER' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' :
                                                                        call.status === 'BUSY' ? 'bg-orange-500/15 text-orange-400 border-orange-500/20' :
                                                                        call.status === 'FAILED' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                                                                        'bg-white/5 text-gray-400 border-white/10'
                                                                    }`}>
                                                                        {call.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 font-semibold text-white">{call.durationFormatted}</td>
                                                                <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                                                                    {new Date(call.calledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {call.recordingUrl ? (
                                                                        <audio src={call.recordingUrl} controls className="h-8 w-48 max-w-full [color-scheme:dark]" />
                                                                    ) : (
                                                                        <span className="text-xs text-gray-500 font-medium">No Recording</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {call.summary && (
                                                                <tr>
                                                                    <td colSpan="7" className="px-8 py-2 bg-indigo-500/5 text-xs text-gray-400 border-b border-white/5">
                                                                        <span className="font-bold text-indigo-400 uppercase tracking-wider mr-2">Call Summary:</span>
                                                                        {call.summary}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                {selectedCampaignDetails.calls.length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-10 text-center text-gray-500 font-semibold">No calls made yet in this campaign.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-5 border-t border-white/10 bg-black/20 flex justify-between items-center rounded-b-3xl">
                                <button 
                                    onClick={() => handleDownloadCSV(selectedCampaignDetails.campaign.id, selectedCampaignDetails.campaign.name)}
                                    className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                                >
                                    <Download size={18} /> Download CSV Report
                                </button>

                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowRetargetModal(true)}
                                        className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                                    >
                                        <RotateCcw size={18} /> Retarget Campaign
                                    </button>
                                    <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent">
                                        Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Retarget Campaign Modal */}
            <AnimatePresence>
                {showRetargetModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-surface-900 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-white/10"
                        >
                            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    🎯 Retarget Campaign
                                </h3>
                                <button onClick={() => setShowRetargetModal(false)} className="text-gray-400 hover:text-white">✕</button>
                            </div>

                            <div className="p-6 bg-black/10 space-y-4">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Select which call outcomes you want to retarget. We will generate a new campaign focusing exclusively on these contacts.
                                </p>

                                <div className="space-y-2.5">
                                    {[
                                        { key: 'FAILED', label: 'Failed Calls (System/Carrier error)' },
                                        { key: 'NO_ANSWER', label: 'No Answer (Rung but did not pick up)' },
                                        { key: 'BUSY', label: 'Busy (Line busy or rejected)' }
                                    ].map(item => (
                                        <label key={item.key} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5 rounded-xl cursor-pointer hover:border-white/10 transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={retargetStatuses.includes(item.key)} 
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setRetargetStatuses([...retargetStatuses, item.key]);
                                                    } else {
                                                        setRetargetStatuses(retargetStatuses.filter(s => s !== item.key));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded text-orange-500 bg-black/40 border-white/20 focus:ring-orange-500/20"
                                            />
                                            <span className="text-xs text-gray-300 font-semibold">{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3 rounded-b-3xl">
                                <button onClick={() => setShowRetargetModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleLaunchRetarget}
                                    disabled={retargeting}
                                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-black font-bold rounded-xl shadow-lg transition-all text-xs flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {retargeting ? 'Creating...' : '🚀 Launch Retarget'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
         </div>
     );
};

export default VoiceCampaigns;
