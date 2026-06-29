import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, XCircle, Plus, Calendar, Clock, BarChart2, Activity, RefreshCw, Download, Phone, Info, Search, RotateCcw, Volume2, ChevronDown, Check, ExternalLink } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const FreshCampaigns = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [agents, setAgents] = useState([]);
    const [providers, setProviders] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Details & Retarget States
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedCampaignDetails, setSelectedCampaignDetails] = useState(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
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
            alert("Failed to download CSV");
        }
    };

    const handleRetarget = async () => {
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
            alert(res.data.message || "Retargeting campaign created successfully!");
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
            }, 8000);
        }
        return () => clearInterval(interval);
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
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="bg-gradient-to-br from-orange-500 to-red-500 text-transparent bg-clip-text">Voice Campaigns</span>
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold border border-orange-200">
                            {campaigns.filter(c => c.status === 'RUNNING').length} Active
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Create and monitor automated outbound calling sequences</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchAll} 
                        disabled={loading}
                        className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-orange-500' : 'text-gray-400'} />
                        {loading ? 'Refreshing...' : 'Refresh List'}
                    </button>
                    <button 
                        onClick={() => setShowModal(true)} 
                        className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                        <Plus size={18} /> New Campaign
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {loading && campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium text-lg">Loading your campaigns...</p>
                </div>
            ) : campaigns.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-16 text-center max-w-2xl mx-auto mt-12">
                    <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        📢
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">No Campaigns Found</h2>
                    <p className="text-gray-500 mb-8 text-lg">You haven't created any AI voice campaigns yet. Start engaging your contacts at scale.</p>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all transform hover:-translate-y-1"
                    >
                        Create First Campaign
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider font-bold">
                                    <th className="px-6 py-4">Campaign Name</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Progress</th>
                                    <th className="px-6 py-4">Provider / Agent</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {campaigns.map(camp => {
                                    const progress = camp.audienceCount > 0 ? ((camp.completedCount + camp.failedCount) / camp.audienceCount) * 100 : 0;
                                    return (
                                    <tr key={camp.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{camp.name}</div>
                                            <div className="text-xs text-gray-500 mt-1 font-medium">Tags: {camp.targetTags?.join(', ') || 'None'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 text-xs rounded-full font-bold inline-flex items-center gap-1.5 ${
                                                camp.status === 'RUNNING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                camp.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                camp.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                camp.status === 'PAUSED' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                                'bg-gray-100 text-gray-700 border border-gray-200'
                                            }`}>
                                                {camp.status === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                                                {camp.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                                                    <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full relative" style={{ width: `${progress}%` }}>
                                                        <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}></div>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-gray-600 w-8">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="text-[10px] text-gray-500 mt-1.5 uppercase font-bold tracking-wider">
                                                {camp.completedCount + camp.failedCount} / {camp.audienceCount} calls
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-800 font-semibold capitalize text-sm">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> {camp.provider}
                                            </div>
                                            <div className="text-xs text-gray-500 font-mono mt-1">{camp.agentId?.substring(0,8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} className="text-gray-400" />
                                                {new Date(camp.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleViewDetails(camp.id)} 
                                                    className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center border border-indigo-200 transition-colors" 
                                                    title="View Report & Details"
                                                >
                                                    <BarChart2 size={16} />
                                                </button>
                                                {['DRAFT', 'PAUSED'].includes(camp.status) && (
                                                    <button onClick={() => handleAction(camp.id, 'start')} className="w-9 h-9 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center border border-green-200 transition-colors" title="Start">
                                                        <Play size={16} fill="currentColor" />
                                                    </button>
                                                )}
                                                {camp.status === 'RUNNING' && (
                                                    <button onClick={() => handleAction(camp.id, 'cancel')} className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center border border-red-200 transition-colors" title="Cancel">
                                                        <XCircle size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Campaign Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                        <span className="p-2 bg-orange-100 text-orange-600 rounded-xl">📢</span> 
                                        Create Voice Campaign
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1 font-medium">Configure your AI outbound dialing strategy</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                                    <XCircle size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-white">
                                <form id="campaignForm" onSubmit={handleCreateCampaign} className="space-y-8">
                                    
                                    {/* Section 1 */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">1</div>
                                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">General</h3>
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-gray-700 mb-2 block">Campaign Name</label>
                                            <input required type="text" placeholder="e.g. Q3 Sales Outreach" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all" />
                                        </div>
                                    </div>

                                    {/* Section 2 */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">2</div>
                                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">AI Agent Configuration</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-5">
                                            <div>
                                                <label className="text-sm font-bold text-gray-700 mb-2 block">Select Provider</label>
                                                <select required value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value, agentId: ''})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none capitalize">
                                                    <option value="" disabled>Choose Provider...</option>
                                                    {providers.filter(p => p.userConfig?.apiKeyConfigured).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                {providers.filter(p => p.userConfig?.apiKeyConfigured).length === 0 && (
                                                    <p className="text-xs text-red-500 mt-1 font-medium">No providers configured. Please add API keys in AI Voice → Providers first.</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700 mb-2 block">Select Voice Agent</label>
                                                <select required value={formData.agentId} onChange={e => setFormData({...formData, agentId: e.target.value})} disabled={!formData.provider} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none disabled:opacity-50 disabled:bg-gray-50">
                                                    <option value="" disabled>Choose Agent...</option>
                                                    {agents.filter(a => a.providerId === formData.provider).map(a => (
                                                        <option key={a.providerAgentId} value={a.providerAgentId}>{a.name} ({a.voiceName || a.language || 'Default'})</option>
                                                    ))}
                                                </select>
                                                {formData.provider && agents.filter(a => a.providerId === formData.provider).length === 0 && (
                                                    <p className="text-xs text-amber-600 mt-1 font-medium">No agents synced for this provider. Go to AI Voice → Agents and click Sync.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3 */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">3</div>
                                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Audience Targeting</h3>
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-gray-700 mb-2 block">Target Contact Tags</label>
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
                                                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${formData.targetTags.includes(tag) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                            {tags.length === 0 && <p className="text-sm text-red-500 mt-2 font-medium">No tags found in contacts. Create tags first in Contact Manager.</p>}
                                        </div>
                                    </div>

                                    {/* Section 4 */}
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">4</div>
                                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Execution Strategy</h3>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                <label className="text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                                    <Activity size={16} className="text-indigo-500" /> Concurrent Calls
                                                </label>
                                                <input type="number" min="1" max="100" value={formData.settings.concurrency} onChange={e => setFormData({...formData, settings: {...formData.settings, concurrency: parseInt(e.target.value)}})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm" />
                                                <p className="text-xs text-gray-500 mt-2 font-medium">Number of parallel active lines.</p>
                                            </div>
                                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                <label className="text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                                    <Clock size={16} className="text-orange-500" /> Schedule Launch
                                                </label>
                                                <input type="datetime-local" value={formData.scheduledAt} onChange={e => setFormData({...formData, scheduledAt: e.target.value})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm" />
                                                <p className="text-xs text-gray-500 mt-2 font-medium">Leave empty to run instantly.</p>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                                            <label className="flex items-center gap-3 cursor-pointer mb-5">
                                                <input type="checkbox" checked={formData.settings.retryEnabled} onChange={e => setFormData({...formData, settings: {...formData.settings, retryEnabled: e.target.checked}})} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors" />
                                                <span className="text-sm text-gray-900 font-bold">Enable Automatic Retries</span>
                                            </label>
                                            {formData.settings.retryEnabled && (
                                                <div className="grid grid-cols-2 gap-5 pt-4 border-t border-gray-200">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Max Retries</label>
                                                        <input type="number" min="1" max="5" value={formData.settings.retryCount} onChange={e => setFormData({...formData, settings: {...formData.settings, retryCount: parseInt(e.target.value)}})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm shadow-sm" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">Retry Delay (ms)</label>
                                                        <input type="number" min="1000" step="1000" value={formData.settings.retryDelay} onChange={e => setFormData({...formData, settings: {...formData.settings, retryDelay: parseInt(e.target.value)}})} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm shadow-sm" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 mt-6 bg-orange-50 border border-orange-200 p-4 rounded-xl">
                                            <input type="checkbox" id="startNow" checked={formData.startNow} onChange={e => setFormData({...formData, startNow: e.target.checked})} className="w-5 h-5 text-orange-600 focus:ring-orange-500 rounded border-orange-300" />
                                            <label htmlFor="startNow" className="text-sm font-bold text-orange-800 cursor-pointer">Start Campaign Immediately (If no schedule is set)</label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-3xl">
                                <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-transparent">
                                    Cancel
                                </button>
                                <button type="submit" form="campaignForm" disabled={saving || (!formData.scheduledAt && !formData.startNow)} className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5">
                                    {saving ? 'Creating...' : '🚀 Launch Campaign'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Campaign Detail Modal */}
            <AnimatePresence>
                {showDetailsModal && selectedCampaignDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold text-gray-900">{selectedCampaignDetails.campaign.name}</h2>
                                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-bold capitalize ${
                                            selectedCampaignDetails.campaign.status === 'RUNNING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                            selectedCampaignDetails.campaign.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                            'bg-gray-100 text-gray-700 border border-gray-200'
                                        }`}>
                                            {selectedCampaignDetails.campaign.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 font-medium">Campaign ID: {selectedCampaignDetails.campaign.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => fetchCampaignDetails(selectedCampaignId)} 
                                        disabled={detailsLoading}
                                        className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                        title="Refresh details"
                                    >
                                        <RefreshCw size={18} className={detailsLoading ? 'animate-spin text-orange-500' : ''} />
                                    </button>
                                    <button onClick={() => setShowDetailsModal(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                                        <XCircle size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar bg-white space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Contacts</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1">{selectedCampaignDetails.stats.total}</div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dialed / Initiated</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1">
                                            {selectedCampaignDetails.campaign.dialedCount}
                                            <span className="text-xs text-gray-500 font-medium ml-1">
                                                ({selectedCampaignDetails.stats.total > 0 ? Math.round((selectedCampaignDetails.campaign.dialedCount / selectedCampaignDetails.stats.total) * 100) : 0}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Answered (Picked Up)</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1 text-green-600">
                                            {selectedCampaignDetails.stats.answered}
                                            <span className="text-xs text-gray-500 font-medium ml-1">
                                                ({selectedCampaignDetails.campaign.dialedCount > 0 ? Math.round((selectedCampaignDetails.stats.answered / selectedCampaignDetails.campaign.dialedCount) * 100) : 0}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Duration</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1 text-indigo-600">
                                            {Math.floor(selectedCampaignDetails.stats.totalDuration / 60)}m {selectedCampaignDetails.stats.totalDuration % 60}s
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Failed / No Answer</div>
                                        <div className="text-2xl font-bold text-gray-900 mt-1 text-red-500">
                                            {selectedCampaignDetails.stats.failed + selectedCampaignDetails.stats.noAnswer + selectedCampaignDetails.stats.busy}
                                        </div>
                                    </div>
                                </div>

                                {/* Filters and Search */}
                                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                                    <div className="relative w-full md:w-80">
                                        <span className="absolute left-3.5 top-3.5 text-gray-400">
                                            <Search size={16} />
                                        </span>
                                        <input 
                                            type="text" 
                                            placeholder="Search by name or phone..." 
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-sm"
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto py-1">
                                        {['ALL', 'COMPLETED', 'ANSWERED', 'RINGING', 'NO_ANSWER', 'BUSY', 'FAILED', 'INITIATED'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border whitespace-nowrap transition-all ${
                                                    statusFilter === status 
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Call Log Table */}
                                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider font-bold sticky top-0 z-10">
                                                    <th className="px-6 py-4">S.No</th>
                                                    <th className="px-6 py-4">Contact</th>
                                                    <th className="px-6 py-4">Phone</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Duration</th>
                                                    <th className="px-6 py-4">Called At</th>
                                                    <th className="px-6 py-4">Recording</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-sm">
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
                                                            <tr className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4 font-semibold text-gray-500">{idx + 1}</td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-gray-900">{call.contactName}</div>
                                                                    {call.tags?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {call.tags.map(t => (
                                                                                <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold border border-gray-200">{t}</span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 font-mono text-gray-600">{call.phone}</td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2.5 py-1 text-xs rounded-full font-bold inline-flex items-center gap-1 border ${
                                                                        call.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        call.status === 'ANSWERED' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                                                                        call.status === 'RINGING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                        call.status === 'NO_ANSWER' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                        call.status === 'BUSY' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                                        call.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                                    }`}>
                                                                        {call.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 font-semibold text-gray-800">{call.durationFormatted}</td>
                                                                <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                                                                    {new Date(call.calledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {call.recordingUrl ? (
                                                                        <audio src={call.recordingUrl} controls className="h-8 w-48 max-w-full" />
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400 font-medium">No Recording</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {call.summary && (
                                                                <tr>
                                                                    <td colSpan="7" className="px-8 py-2 bg-indigo-50/20 text-xs text-gray-600 border-b border-gray-100">
                                                                        <span className="font-bold text-indigo-700 uppercase tracking-wider mr-2">Call Summary:</span>
                                                                        {call.summary}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                {selectedCampaignDetails.calls.length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-10 text-center text-gray-400 font-semibold">No calls made yet in this campaign.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-3xl">
                                <button 
                                    onClick={() => handleDownloadCSV(selectedCampaignDetails.campaign.id, selectedCampaignDetails.campaign.name)}
                                    className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                                >
                                    <Download size={18} /> Download CSV Report
                                </button>

                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowRetargetModal(true)}
                                        className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
                                    >
                                        <RotateCcw size={18} /> Retarget Campaign
                                    </button>
                                    <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-transparent">
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden border border-gray-200"
                        >
                            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <RotateCcw size={18} className="text-orange-500" /> Retarget Campaign
                                </h3>
                                <button onClick={() => setShowRetargetModal(false)} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                                    <XCircle size={16} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-sm text-gray-600 font-medium">Select which call statuses you want to target for retry: </p>
                                
                                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    {[
                                        { key: 'FAILED', label: 'Failed Calls (System/Provider Errors)' },
                                        { key: 'NO_ANSWER', label: 'No Answer (Ranged out/Unanswered)' },
                                        { key: 'BUSY', label: 'Busy (Line busy or rejected)' }
                                    ].map(item => (
                                        <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={retargetStatuses.includes(item.key)} 
                                                onChange={e => {
                                                    const newStatuses = e.target.checked 
                                                        ? [...retargetStatuses, item.key] 
                                                        : retargetStatuses.filter(s => s !== item.key);
                                                    setRetargetStatuses(newStatuses);
                                                }}
                                                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-colors" 
                                            />
                                            <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                                        </label>
                                    ))}
                                </div>

                                <p className="text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-lg border border-amber-200">
                                    This will create a new campaign named <b>{selectedCampaignDetails?.campaign.name} (Retarget)</b> targeting only contacts matching these failed statuses.
                                </p>
                            </div>

                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                                <button onClick={() => setShowRetargetModal(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors border border-transparent">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleRetarget} 
                                    disabled={retargeting}
                                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
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

export default FreshCampaigns;
