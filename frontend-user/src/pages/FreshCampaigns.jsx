import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, BarChart2, CheckCircle2, XCircle, Clock, AlertCircle, FileText, Users, Send, ChevronLeft, Search, Download } from 'lucide-react';
import io from 'socket.io-client';

const TemplatePreview = ({ template, mediaUrl, mediaFile, isSavedCampaign }) => {
    if (!template || !template.components) return null;
    let header = null;
    let body = "";
    let footer = null;
    let buttons = [];

    const comps = typeof template.components === 'string' ? JSON.parse(template.components) : template.components;

    const getMediaSrc = (url, file) => {
        if (file) {
            try {
                return URL.createObjectURL(file);
            } catch (e) {
                console.error(e);
            }
        }
        if (url) {
            // Numeric ID or media_ prefix — served via our backend
            if (/^\d+$/.test(url) || url.startsWith('media_')) {
                return `${import.meta.env.VITE_API_URL}/api/campaigns/media/${url}`;
            }
            // Full https URL (Meta CDN or other) — use directly
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            // Fallback: treat as backend media ID
            return `${import.meta.env.VITE_API_URL}/api/campaigns/media/${url}`;
        }
        return null;
    };

    comps.forEach(comp => {
        if (comp.type === 'HEADER') {
            if (comp.format === 'TEXT') {
                header = <div className="font-bold mb-1 text-gray-900">{comp.text}</div>;
            } else if (comp.format === 'IMAGE') {
                const src = getMediaSrc(mediaUrl, mediaFile);
                header = (
                    <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-[120px] relative">
                        {src ? (
                            <>
                                <img 
                                    src={src} 
                                    alt="Campaign image" 
                                    className="w-full h-auto max-h-40 object-contain" 
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }} 
                                />
                                <div style={{display:'none'}} className="flex flex-col items-center gap-1 p-4 text-gray-400 w-full justify-center">
                                    <span className="text-2xl">🖼️</span>
                                    <span className="text-xs font-medium text-gray-500">{isSavedCampaign ? 'Image was sent with this campaign' : 'Image preview unavailable'}</span>
                                    {isSavedCampaign && <span className="text-[10px] text-gray-400">(Preview expired — image was delivered successfully)</span>}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-1 p-4 text-gray-400">
                                <span className="text-2xl">🖼️</span>
                                <span className="text-xs">{isSavedCampaign ? 'Image was sent with this campaign' : 'No image uploaded yet'}</span>
                            </div>
                        )}
                    </div>
                );
            } else if (comp.format === 'VIDEO') {
                const src = getMediaSrc(mediaUrl, mediaFile);
                header = (
                    <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center min-h-[120px]">
                        {src ? (
                            <video src={src} controls className="w-full h-auto max-h-40 object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-1 p-4 text-gray-400">
                                <span className="text-2xl">📹</span>
                                <span className="text-xs">No video uploaded yet</span>
                            </div>
                        )}
                    </div>
                );
            } else if (comp.format === 'DOCUMENT') {
                header = (
                    <div className="mb-2 rounded-lg p-3 border border-gray-200 bg-gray-100 flex items-center gap-2">
                        <span className="text-xl">📄</span>
                        <span className="text-xs text-gray-600 truncate">{mediaFile ? mediaFile.name : 'Document Header'}</span>
                    </div>
                );
            } else {
                header = <div className="font-bold mb-1 text-gray-900">{`[${comp.format} HEADER]`}</div>;
            }
        }
        if (comp.type === 'BODY') body = comp.text;
        if (comp.type === 'FOOTER') footer = comp.text;
        if (comp.type === 'BUTTONS') buttons = comp.buttons || [];
    });

    return (
        <div className="bg-[#efeae2] p-4 rounded-xl max-w-sm mt-4 border border-surface-700 shadow-md">
            <div className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-800 relative">
                {header}
                <div className="whitespace-pre-wrap">{body}</div>
                {footer && <div className="text-xs text-gray-500 mt-1">{footer}</div>}
                
                {buttons.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t pt-2 border-gray-100">
                        {buttons.map((btn, i) => (
                            <div key={i} className="text-center text-blue-500 py-1 bg-gray-50 rounded-md font-medium text-xs border border-gray-100 truncate px-2">
                                {btn.type === 'URL' ? '🔗' : btn.type === 'PHONE_NUMBER' ? '📞' : '🔘'} {btn.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const Campaigns = () => {
    const [view, setView] = useState('list'); // 'list' | 'create' | 'details'
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [campaigns, setCampaigns] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [testNumber, setTestNumber] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        templateId: '',
        selectedGroups: [], // empty means "All Contacts"
        scheduledAt: '',
        enableClickTracking: false,
        targetPhones: [] // used for retargeting
    });
    
    // Dynamic Template Mapping State
    const [variablesConfig, setVariablesConfig] = useState({});
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [templateVariables, setTemplateVariables] = useState([]);
    const [requiresMedia, setRequiresMedia] = useState(false);
    const [mediaFormat, setMediaFormat] = useState('');
    const [availableCustomKeys, setAvailableCustomKeys] = useState([]);

    const [mediaUploading, setMediaUploading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Use Promise.allSettled to ensure one failure doesn't break everything
            const results = await Promise.allSettled([
                axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/templates`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/contacts`)
            ]);

            // Handle Campaigns
            if (results[0].status === 'fulfilled') {
                let campaignsData = results[0].value.data || [];
                setCampaigns(campaignsData);
            } else {
                console.error("Failed to fetch campaigns:", results[0].reason);
            }

            // Handle Templates
            if (results[1].status === 'fulfilled') {
                const allTemplates = results[1].value.data;
                
                // Robust filtering: Check for APPROVED status (case-insensitive)
                // Also allow templates with no status (legacy) or AVAILABLE
                const approvedTemplates = allTemplates.filter(t => {
                    const status = (t.status || '').toUpperCase();
                    return status === 'APPROVED' || status === 'AVAILABLE' || status === '';
                });
                
                // Fallback: If no approved templates found, but we have templates, show them all (for debugging/testing)
                if (approvedTemplates.length === 0 && allTemplates.length > 0) {
                    setTemplates(allTemplates);
                } else {
                    setTemplates(approvedTemplates);
                }
            } else {
                console.error("Failed to fetch templates:", results[1].reason);
            }

            // Handle Contacts
            if (results[2].status === 'fulfilled') {
                const responseData = results[2].value.data;
                const allContacts = responseData.data || responseData; // Handle pagination structure or plain array
                // Extract unique groups and custom keys from all contacts
                const groups = new Set();
                const customKeys = new Set();
                allContacts.forEach(c => {
                    if (c.tags && Array.isArray(c.tags)) {
                        c.tags.forEach(t => groups.add(t));
                    }
                    if (c.customFields) {
                        try {
                            const fields = typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields;
                            Object.keys(fields).forEach(k => customKeys.add(k));
                        } catch (_) {}
                    }
                });
                setAvailableGroups(Array.from(groups));
                setAvailableCustomKeys(Array.from(customKeys).sort());
            } else {
                console.error("Failed to fetch contacts:", results[2].reason);
            }

        } catch (error) {
            console.error("Unexpected error in fetchData:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => {
            if (view === 'list') {
                axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns`)
                    .then(res => setCampaigns(res.data))
                    .catch(err => console.error("Poll error:", err));
            }
        }, 15000);

        const socket = io(`${import.meta.env.VITE_API_URL}`);
        const tenantId = localStorage.getItem('tenantId') || 'test-user-id';
        socket.emit('join_tenant', tenantId);

        socket.on('campaign_status_update', (data) => {
            // Re-fetch campaigns to dynamically update the stats
            axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns`)
                .then(res => setCampaigns(res.data))
                .catch(err => console.error("Socket fetch error:", err));
        });

        return () => {
            clearInterval(interval);
            socket.off('campaign_status_update');
            socket.disconnect();
        };
    }, [view]);

    useEffect(() => {
        if (!formData.templateId) {
            setTemplateVariables([]);
            setRequiresMedia(false);
            setVariablesConfig({});
            setMediaUrl('');
            setMediaFile(null);
            return;
        }

        const template = templates.find(t => t.id === formData.templateId);
        if (!template) return;

        let components = [];
        try {
            components = typeof template.components === 'string' ? JSON.parse(template.components) : (template.components || []);
        } catch (e) {
            components = [];
        }

        let vars = [];
        let mediaReq = false;
        let format = '';

        components.forEach(comp => {
            const compType = comp.type?.toUpperCase() || '';
            const compFormat = comp.format?.toUpperCase() || '';
            if (compType === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(compFormat)) {
                mediaReq = true;
                format = compFormat;
            }

            const text = comp.text || '';
            const matches = text.match(/\{\{\d+\}\}/g);
            if (matches) {
                matches.forEach(m => {
                    if (!vars.find(v => v.match === m)) {
                        vars.push({ match: m, type: comp.type });
                    }
                });
            }
            
            if (comp.type === 'BUTTONS' && comp.buttons) {
                comp.buttons.forEach(btn => {
                    if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
                        if (!vars.find(v => v.match === '{{1}}' && v.type === 'BUTTONS')) {
                            vars.push({ match: '{{1}}', type: 'BUTTONS' });
                        }
                    }
                });
            }
        });

        // Initialize default variable config
        const initialConfig = {};
        vars.forEach((v, index) => {
            initialConfig[index] = { type: 'custom', value: '' }; // Default to custom text
        });

        setTemplateVariables(vars);
        setRequiresMedia(mediaReq);
        setMediaFormat(format);
        setVariablesConfig(initialConfig);
        setMediaUrl('');
        setMediaFile(null);
    }, [formData.templateId, templates]);

    const handleSelectChange = (index, selectedVal) => {
        if (selectedVal === 'custom') {
            setVariablesConfig(prev => ({ ...prev, [index]: { type: 'custom', value: '' } }));
        } else if (selectedVal === 'contact_name') {
            setVariablesConfig(prev => ({ ...prev, [index]: { type: 'contact_name', value: '' } }));
        } else if (selectedVal === 'contact_phone') {
            setVariablesConfig(prev => ({ ...prev, [index]: { type: 'contact_phone', value: '' } }));
        } else if (selectedVal === 'custom_field_manual') {
            setVariablesConfig(prev => ({ ...prev, [index]: { type: 'custom_field', value: '', isManual: true } }));
        } else if (selectedVal.startsWith('custom_field:')) {
            const fieldKey = selectedVal.replace('custom_field:', '');
            setVariablesConfig(prev => ({ ...prev, [index]: { type: 'custom_field', value: fieldKey } }));
        }
    };

    const getConfigSelectValue = (config) => {
        if (!config) return 'custom';
        if (config.type === 'custom') return 'custom';
        if (config.type === 'contact_name') return 'contact_name';
        if (config.type === 'contact_phone') return 'contact_phone';
        if (config.type === 'custom_field') {
            if (config.isManual) return 'custom_field_manual';
            if (availableCustomKeys.includes(config.value)) {
                return `custom_field:${config.value}`;
            }
            return 'custom_field_manual';
        }
        return 'custom';
    };

    const handleCreateCampaign = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.templateId) {
            alert("Name and Template are required.");
            return;
        }

        // Validate: media required but not uploaded yet
        if (requiresMedia && !mediaUrl) {
            alert(`This template requires a ${mediaFormat} file. Please upload the media before launching.`);
            return;
        }

        // Validate: media is still uploading
        if (mediaUploading) {
            alert("Please wait for media upload to complete.");
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/create`, {
                name: formData.name,
                templateId: formData.templateId,
                tags: formData.selectedGroups,
                targetPhones: formData.targetPhones || [],
                variablesConfig,
                mediaUrl,
                scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
                enableClickTracking: formData.enableClickTracking
            });
            alert(formData.scheduledAt ? "Campaign scheduled successfully!" : "Campaign triggered successfully!");
            setView('list');
            fetchData();
            setFormData({ name: '', templateId: '', selectedGroups: [], scheduledAt: '', enableClickTracking: false, targetPhones: [] });
            setTestNumber('');
            setVariablesConfig({});
            setMediaUrl('');
            setMediaFile(null);
        } catch (error) {
            console.error("Failed to start campaign:", error);
            alert("Error: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTestCampaign = async () => {
        if (!formData.templateId || !testNumber) {
            alert("Please select a template and enter a test number.");
            return;
        }

        setIsTesting(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/test`, {
                templateId: formData.templateId,
                testNumber: testNumber,
                variablesConfig,
                mediaUrl
            });
            alert("Test message sent successfully!");
        } catch (error) {
            console.error("Test failed:", error);
            alert("Test failed: " + (error.response?.data?.error || error.message));
        } finally {
            setIsTesting(false);
        }
    };

    const fetchCampaignDetails = async (id) => {
        setView('details');
        setDetailsLoading(true);
        setSearchQuery('');
        
        if (id && id.toString().startsWith('demo')) {
            setDetailsLoading(false);
            return;
        }

        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/campaigns/${id}`);
            setSelectedCampaign(res.data);
        } catch (error) {
            console.error("Failed to fetch campaign details:", error);
            alert("Error loading details");
            setView('list');
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleCancelCampaign = async (campaignId) => {
        if (!window.confirm("Are you sure you want to cancel this scheduled campaign? Credits will be refunded.")) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/${campaignId}/cancel`);
            alert("Campaign cancelled successfully!");
            fetchCampaignDetails(campaignId);
        } catch (error) {
            alert("Error cancelling campaign: " + (error.response?.data?.error || error.message));
        }
    };

    const toggleGroup = (group) => {
        setFormData(prev => {
            if (prev.selectedGroups.includes(group)) {
                return { ...prev, selectedGroups: prev.selectedGroups.filter(t => t !== group) };
            } else {
                return { ...prev, selectedGroups: [...prev.selectedGroups, group] };
            }
        });
    };

    const renderInsights = (stats, interactive = true) => {
        const calculatePercent = (val, total) => total === 0 ? 0 : Math.round((val / total) * 100);

        return (
            <div className="grid grid-cols-4 gap-4 mt-4">
                <div 
                    onClick={(e) => { if(interactive) { e.stopPropagation(); setStatusFilter(statusFilter === 'SENT' ? 'ALL' : 'SENT'); } }}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[#25D366] hover:shadow-[0_0_15px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 ${interactive && statusFilter === 'SENT' ? 'bg-[#25D366]/10 border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.4)]' : 'bg-surface-900/50 border-surface-700'}`}>
                    <p className="text-sm text-surface-400 mb-2">Sent</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{stats.sent}</span>
                        <span className="text-sm text-[#25D366] font-medium">({calculatePercent(stats.sent, stats.total)}%)</span>
                    </div>
                </div>
                <div 
                    onClick={(e) => { if(interactive) { e.stopPropagation(); setStatusFilter(statusFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED'); } }}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[#25D366] hover:shadow-[0_0_15px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 ${interactive && statusFilter === 'DELIVERED' ? 'bg-[#25D366]/10 border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.4)]' : 'bg-surface-900/50 border-surface-700'}`}>
                    <p className="text-sm text-surface-400 mb-2">Delivered</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{stats.delivered}</span>
                        <span className="text-sm text-[#25D366] font-medium">({calculatePercent(stats.delivered, stats.total)}%)</span>
                    </div>
                </div>
                <div 
                    onClick={(e) => { if(interactive) { e.stopPropagation(); setStatusFilter(statusFilter === 'READ' ? 'ALL' : 'READ'); } }}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[#25D366] hover:shadow-[0_0_15px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 ${interactive && statusFilter === 'READ' ? 'bg-[#25D366]/10 border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.4)]' : 'bg-surface-900/50 border-surface-700'}`}>
                    <p className="text-sm text-surface-400 mb-2">Read</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{stats.read}</span>
                        <span className="text-sm text-[#25D366] font-medium">({calculatePercent(stats.read, stats.total)}%)</span>
                    </div>
                </div>
                <div 
                    onClick={(e) => { if(interactive) { e.stopPropagation(); setStatusFilter(statusFilter === 'FAILED' ? 'ALL' : 'FAILED'); } }}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[#25D366] hover:shadow-[0_0_15px_rgba(37,211,102,0.4)] hover:-translate-y-0.5 ${interactive && statusFilter === 'FAILED' ? 'bg-[#25D366]/10 border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.4)]' : 'bg-surface-900/50 border-surface-700'}`}>
                    <p className="text-sm text-surface-400 mb-2">Failed</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">{stats.failed}</span>
                        <span className="text-sm text-red-400 font-medium">({calculatePercent(stats.failed, stats.total)}%)</span>
                    </div>
                </div>
                {stats.clicked !== undefined && (
                    <div 
                        onClick={(e) => { if(interactive) { e.stopPropagation(); setStatusFilter(statusFilter === 'CLICKED' ? 'ALL' : 'CLICKED'); } }}
                        className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:border-brand-500 hover:shadow-[0_0_15px_rgba(0,195,255,0.4)] hover:-translate-y-0.5 ${interactive && statusFilter === 'CLICKED' ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_15px_rgba(0,195,255,0.4)]' : 'bg-surface-900/50 border-surface-700'}`}>
                        <p className="text-sm text-surface-400 mb-2">Clicked</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">{stats.clicked}</span>
                            <span className="text-sm text-brand-400 font-medium">({calculatePercent(stats.clicked, stats.total)}%)</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (view === 'create') {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <button onClick={() => setView('list')} className="text-brand-400 hover:text-brand-300 font-medium">
                    &larr; Back to Campaigns
                </button>

                <div className="glass-panel p-8 rounded-2xl border border-surface-700">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <Send size={24} className="text-brand-400" /> New Campaign
                    </h2>

                    <form onSubmit={handleCreateCampaign} className="space-y-6">
                        <div>
                            <label className="block text-sm text-surface-300 font-medium mt-4 mb-2">Campaign Name <span className="text-red-400">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Diwali Promo 2026"
                                className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-surface-300 font-medium mt-4 mb-2">Select Approved Template <span className="text-red-400">*</span></label>
                            {templates.length === 0 ? (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> No approved templates available. Please create one in the Templates section.
                                </div>
                            ) : (
                                <select
                                    required
                                    value={formData.templateId}
                                    onChange={e => setFormData({ ...formData, templateId: e.target.value })}
                                    className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                >
                                    <option value="" disabled>Select a template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                    ))}
                                </select>
                            )}

                            {formData.templateId && (
                                <TemplatePreview 
                                    template={templates.find(t => t.id === formData.templateId)} 
                                    mediaUrl={mediaUrl}
                                    mediaFile={mediaFile}
                                />
                            )}
                        </div>

                        {/* Dynamic Variables UI */}
                        {requiresMedia && (
                            <div className="bg-surface-800/50 p-5 rounded-xl border border-surface-700">
                                <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-400"/> Upload Media ({mediaFormat})
                                </h3>
                                <p className="text-xs text-surface-400 mb-3">Drag and drop a file or provide a public link.</p>
                                
                                <div className="space-y-3">
                                    <div className="relative border-2 border-dashed border-surface-600 hover:border-brand-500 rounded-xl p-6 text-center transition-colors bg-surface-900 group">
                                        <input
                                            type="file"
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                // Show preview immediately from local file
                                                setMediaFile(file);
                                                setMediaUrl(''); // Clear previous
                                                setMediaUploading(true);
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                try {
                                                    const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/upload`, fd, {
                                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}`, 'Content-Type': 'multipart/form-data' }
                                                    });
                                                    setMediaUrl(res.data.mediaId || res.data.url || '');
                                                } catch (err) {
                                                    console.error('Media upload failed:', err);
                                                    alert("Failed to upload media. Please try again.");
                                                    setMediaFile(null);
                                                } finally {
                                                    setMediaUploading(false);
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            accept={mediaFormat === 'IMAGE' ? 'image/*' : mediaFormat === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                        />
                                        <div className="flex flex-col items-center gap-2 text-surface-400 group-hover:text-brand-400 transition-colors">
                                            <FileText size={24} />
                                            {mediaUploading ? (
                                                <span className="text-sm font-medium text-brand-400">Uploading... please wait</span>
                                            ) : (
                                                <span className="text-sm font-medium">Click or drag {mediaFormat.toLowerCase()} here to upload</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Media preview — shows immediately from local file, before upload finishes */}
                                    {mediaFile && (
                                        <div className="space-y-2">
                                            {mediaUrl && (
                                                <div className="p-3 bg-brand-500/10 border border-brand-500/30 text-brand-400 rounded-lg text-sm flex items-center gap-2 font-medium">
                                                    <CheckCircle2 size={16} /> Media uploaded successfully!
                                                </div>
                                            )}
                                            {mediaUploading && (
                                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg text-sm flex items-center gap-2">
                                                    <AlertCircle size={16} /> Uploading media...
                                                </div>
                                            )}
                                            <div className="p-4 bg-surface-900 rounded-xl border border-surface-700 flex flex-col items-center gap-3">
                                                <span className="text-xs text-surface-400 font-semibold uppercase tracking-wider">Media Preview</span>
                                                {mediaFormat === 'IMAGE' && (
                                                    <img
                                                        src={URL.createObjectURL(mediaFile)}
                                                        alt="Campaign preview"
                                                        className="max-h-60 rounded-lg object-contain border border-surface-700 shadow-md"
                                                    />
                                                )}
                                                {mediaFormat === 'VIDEO' && (
                                                    <video
                                                        src={URL.createObjectURL(mediaFile)}
                                                        controls
                                                        className="max-h-60 w-full rounded-lg border border-surface-700 shadow-md"
                                                    />
                                                )}
                                                {mediaFormat === 'DOCUMENT' && (
                                                    <div className="flex items-center gap-3 p-3 bg-surface-800 rounded-lg border border-surface-700 w-full justify-center">
                                                        <FileText size={28} className="text-brand-400" />
                                                        <div className="text-left">
                                                            <div className="text-sm font-medium text-white max-w-[250px] truncate">{mediaFile.name}</div>
                                                            <div className="text-xs text-surface-400">{Math.round(mediaFile.size / 1024)} KB</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {templateVariables.length > 0 && (
                            <div className="bg-surface-800/50 p-5 rounded-xl border border-surface-700">
                                <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
                                    <FileText size={18} className="text-brand-400"/> Template Variables
                                </h3>
                                <p className="text-xs text-surface-400 mb-4">Map dynamic content to your template's variables.</p>
                                
                                <div className="space-y-4">
                                    {templateVariables.map((v, index) => (
                                        <div key={`${v.match}-${index}`} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                            <div className="bg-surface-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap min-w-[80px] text-center">
                                                {v.match}
                                            </div>
                                            <select
                                                value={getConfigSelectValue(variablesConfig[index])}
                                                onChange={e => handleSelectChange(index, e.target.value)}
                                                className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500 min-w-[160px]"
                                            >
                                                <option value="custom">Custom Text (Static)</option>
                                                <option value="contact_name">Contact Name</option>
                                                <option value="contact_phone">Contact Phone</option>
                                                {availableCustomKeys.length > 0 && (
                                                    <optgroup label="Contact Custom Fields">
                                                        {availableCustomKeys.map(k => (
                                                            <option key={k} value={`custom_field:${k}`}>{k}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                <option value="custom_field_manual">Specify Custom Field key...</option>
                                            </select>

                                            {variablesConfig[index]?.type === 'custom' && (
                                                <input
                                                    type="text"
                                                    required
                                                    value={variablesConfig[index]?.value || ''}
                                                    onChange={e => setVariablesConfig(prev => ({
                                                        ...prev, 
                                                        [index]: { ...prev[index], value: e.target.value }
                                                    }))}
                                                    placeholder="Enter static text..."
                                                    className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500"
                                                />
                                            )}

                                            {variablesConfig[index]?.type === 'custom_field' && (variablesConfig[index]?.isManual || !availableCustomKeys.includes(variablesConfig[index]?.value)) && (
                                                <input
                                                    type="text"
                                                    required
                                                    value={variablesConfig[index]?.value || ''}
                                                    onChange={e => setVariablesConfig(prev => ({
                                                        ...prev, 
                                                        [index]: { ...prev[index], value: e.target.value }
                                                    }))}
                                                    placeholder="Enter custom field key (e.g. city, course, amount)..."
                                                    className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-surface-300 font-medium mt-4 mb-2">Target Audience</label>
                            
                            {formData.targetPhones && formData.targetPhones.length > 0 ? (
                                <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl text-brand-400 text-sm font-medium flex items-center justify-between mb-3">
                                    <span>Retargeting {formData.targetPhones.length} specific contacts.</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({ ...formData, targetPhones: [] })}
                                        className="text-white hover:text-red-400 underline"
                                    >
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-white0 mb-3">Leave all unselected to send to ALL contacts. Select groups to filter.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableGroups.length === 0 ? (
                                            <span className="text-sm text-white0 italic">No groups found from your contacts list.</span>
                                        ) : (
                                            availableGroups.map(group => (
                                                <button
                                                    key={group}
                                                    type="button"
                                                    onClick={() => toggleGroup(group)}
                                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${formData.selectedGroups.includes(group)
                                                        ? 'bg-brand-500 text-white border-brand-500'
                                                        : 'bg-surface-800 text-surface-300 border-surface-600 hover:bg-surface-700'
                                                        }`}
                                                >
                                                    {group}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm text-surface-300 font-medium mt-4 mb-2">Schedule for Later (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={formData.scheduledAt}
                                    onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                                    className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                />
                                <p className="text-xs text-white0 mt-2">Leave blank to send instantly.</p>
                            </div>
                            <div className="flex flex-col justify-center">
                                <label className="block text-sm text-surface-300 font-medium mt-4 mb-2">&nbsp;</label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={formData.enableClickTracking}
                                            onChange={e => setFormData({ ...formData, enableClickTracking: e.target.checked })}
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.enableClickTracking ? 'bg-brand-500' : 'bg-surface-700'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.enableClickTracking ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">Enable URL Click Tracking</div>
                                        <div className="text-xs text-surface-400">Shorten links & track user clicks</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="pt-6 mt-6 border-t border-surface-700">
                            <h3 className="text-sm text-surface-300 font-medium mb-3">Test Current Template</h3>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={testNumber}
                                    onChange={e => setTestNumber(e.target.value)}
                                    placeholder="Test Phone Number (e.g. +919876543210)"
                                    className="flex-1 max-w-sm bg-surface-800 border-none rounded-xl px-4 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500"
                                />
                                <button
                                    type="button"
                                    onClick={handleTestCampaign}
                                    disabled={isTesting || !formData.templateId || !testNumber}
                                    className="px-4 py-2 rounded-xl bg-surface-800 text-brand-400 border border-brand-500/30 hover:bg-brand-500/10 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {isTesting ? 'Sending...' : 'Send Test'}
                                </button>
                            </div>
                        </div>

                        {requiresMedia && !mediaUrl && !mediaUploading && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> This template requires a {mediaFormat} file. Please upload media before launching.
                            </div>
                        )}
                        <div className="pt-6 mt-6 border-t border-surface-700 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting || templates.length === 0 || mediaUploading || (requiresMedia && !mediaUrl)}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Processing...' : mediaUploading ? 'Uploading Media...' : (formData.scheduledAt ? 'Schedule Campaign ⏰' : 'Launch Campaign')}
                                {!isSubmitting && !mediaUploading && <Send size={18} />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    if (view === 'details') {
        const calculatePercent = (val, total) => total === 0 ? 0 : Math.round((val / total) * 100);
        let totalStats = { total: 0, sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
        let filteredMessages = [];

        if (selectedCampaign && selectedCampaign.messages) {
            totalStats.total = selectedCampaign.messages.length;
            totalStats.sent = selectedCampaign.messages.filter(m => ['SENT', 'DELIVERED', 'READ', 'CLICKED'].includes(m.status)).length;
            totalStats.delivered = selectedCampaign.messages.filter(m => ['DELIVERED', 'READ', 'CLICKED'].includes(m.status)).length;
            totalStats.read = selectedCampaign.messages.filter(m => ['READ', 'CLICKED'].includes(m.status)).length;
            totalStats.clicked = selectedCampaign.messages.filter(m => m.status === 'CLICKED').length;
            totalStats.failed = selectedCampaign.messages.filter(m => m.status === 'FAILED').length;

            filteredMessages = selectedCampaign.messages.filter(m => {
                const matchesSearch = m.recipient.includes(searchQuery) || m.status.toLowerCase().includes(searchQuery.toLowerCase());
                if (statusFilter === 'ALL') return matchesSearch;
                if (statusFilter === 'SENT') return matchesSearch && ['SENT', 'DELIVERED', 'READ', 'CLICKED'].includes(m.status);
                if (statusFilter === 'DELIVERED') return matchesSearch && ['DELIVERED', 'READ', 'CLICKED'].includes(m.status);
                if (statusFilter === 'READ') return matchesSearch && ['READ', 'CLICKED'].includes(m.status);
                return matchesSearch && m.status === statusFilter;
            });
        }

        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <button onClick={() => setView('list')} className="flex items-center gap-2 text-brand-400 hover:text-brand-300 font-medium transition-colors">
                    <ChevronLeft size={18} /> Back to Campaigns
                </button>

                {detailsLoading || !selectedCampaign ? (
                    <div className="p-12 text-center text-surface-400">Loading details...</div>
                ) : (
                    <div className="space-y-6">
                        <div className="glass-panel p-8 rounded-2xl border border-surface-700">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-3xl font-bold font-display text-white mb-2">{selectedCampaign.name}</h2>
                                    <p className="text-surface-400 flex items-center gap-4">
                                        <span className="flex items-center gap-1"><FileText size={16} /> {selectedCampaign.template?.name}</span>
                                        <span className="flex items-center gap-1"><Clock size={16} /> Created: {new Date(selectedCampaign.createdAt).toLocaleString()}</span>
                                        {selectedCampaign.scheduledAt && (
                                            <span className="flex items-center gap-1 text-blue-400">
                                                <Clock size={16} /> Scheduled: {new Date(selectedCampaign.scheduledAt).toLocaleString()}
                                            </span>
                                        )}
                                    </p>
                                    
                                    {templates.find(t => t.name === selectedCampaign.template?.name) && (
                                        <div className="mt-4">
                                            <span className="text-xs text-surface-400 font-medium uppercase tracking-wider mb-2 block">Template Preview</span>
                                            <TemplatePreview 
                                                template={templates.find(t => t.name === selectedCampaign.template?.name)} 
                                                mediaUrl={selectedCampaign.mediaUrl}
                                                isSavedCampaign={true}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedCampaign.status === 'SCHEDULED' && (
                                        <button 
                                            onClick={() => handleCancelCampaign(selectedCampaign.id)}
                                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
                                        >
                                            Cancel Schedule
                                        </button>
                                    )}
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider 
                                        ${selectedCampaign.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                        : selectedCampaign.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : selectedCampaign.status === 'CANCELLED' ? 'bg-surface-600/50 text-surface-300 border border-surface-600'
                                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                                        {selectedCampaign.status}
                                    </span>
                                </div>
                            </div>

                            {renderInsights(totalStats)}
                            
                            {/* Retargeting Controls */}
                            {totalStats.total > 0 && (
                                <div className="mt-6 pt-6 border-t border-surface-700 flex items-center justify-between bg-surface-800/50 p-4 rounded-xl">
                                    <div>
                                        <h4 className="text-white font-medium mb-1 flex items-center gap-2"><Users size={16} className="text-brand-400" /> Retarget Audience</h4>
                                        <p className="text-xs text-surface-400">Create a new campaign targeting a specific segment of this campaign.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            disabled={totalStats.delivered === 0 && totalStats.sent === 0}
                                            onClick={() => {
                                                const recipients = selectedCampaign.messages.filter(m => ['SENT', 'DELIVERED'].includes(m.status)).map(m => m.recipient);
                                                const origTemplate = templates.find(t => t.name === selectedCampaign.template?.name);
                                                setFormData({ name: `${selectedCampaign.name} - Retargeted Delivered`, templateId: origTemplate?.id || '', selectedGroups: [], scheduledAt: '', enableClickTracking: false, targetPhones: recipients });
                                                if (selectedCampaign.variablesConfig) setVariablesConfig(selectedCampaign.variablesConfig);
                                                if (selectedCampaign.mediaUrl) setMediaUrl(selectedCampaign.mediaUrl);
                                                setMediaFile(null);
                                                setView('create');
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Retarget Delivered (Not Read)
                                        </button>
                                        <button 
                                            disabled={totalStats.read === 0}
                                            onClick={() => {
                                                const recipients = selectedCampaign.messages.filter(m => m.status === 'READ').map(m => m.recipient);
                                                const origTemplate = templates.find(t => t.name === selectedCampaign.template?.name);
                                                setFormData({ name: `${selectedCampaign.name} - Retargeted Readers`, templateId: origTemplate?.id || '', selectedGroups: [], scheduledAt: '', enableClickTracking: false, targetPhones: recipients });
                                                if (selectedCampaign.variablesConfig) setVariablesConfig(selectedCampaign.variablesConfig);
                                                if (selectedCampaign.mediaUrl) setMediaUrl(selectedCampaign.mediaUrl);
                                                setMediaFile(null);
                                                setView('create');
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-sm font-medium transition-colors border border-brand-500/30 disabled:opacity-50"
                                        >
                                            Retarget Read (Not Clicked)
                                        </button>
                                        <button 
                                            disabled={totalStats.clicked === 0}
                                            onClick={() => {
                                                const recipients = selectedCampaign.messages.filter(m => m.status === 'CLICKED').map(m => m.recipient);
                                                const origTemplate = templates.find(t => t.name === selectedCampaign.template?.name);
                                                setFormData({ name: `${selectedCampaign.name} - Retargeted Clickers`, templateId: origTemplate?.id || '', selectedGroups: [], scheduledAt: '', enableClickTracking: false, targetPhones: recipients });
                                                if (selectedCampaign.variablesConfig) setVariablesConfig(selectedCampaign.variablesConfig);
                                                if (selectedCampaign.mediaUrl) setMediaUrl(selectedCampaign.mediaUrl);
                                                setMediaFile(null);
                                                setView('create');
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors border border-green-500/30 disabled:opacity-50"
                                        >
                                            Retarget Clicked
                                        </button>
                                        <button 
                                            disabled={totalStats.failed === 0}
                                            onClick={() => {
                                                const recipients = selectedCampaign.messages.filter(m => m.status === 'FAILED').map(m => m.recipient);
                                                const origTemplate = templates.find(t => t.name === selectedCampaign.template?.name);
                                                setFormData({ name: `${selectedCampaign.name} - Retry Failed`, templateId: origTemplate?.id || '', selectedGroups: [], scheduledAt: '', enableClickTracking: false, targetPhones: recipients });
                                                if (selectedCampaign.variablesConfig) setVariablesConfig(selectedCampaign.variablesConfig);
                                                if (selectedCampaign.mediaUrl) setMediaUrl(selectedCampaign.mediaUrl);
                                                setMediaFile(null);
                                                setView('create');
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20 disabled:opacity-50"
                                        >
                                            Retry Failed
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">Contact Delivery Log</h3>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => {
                                            const csvContent = "data:text/csv;charset=utf-8," 
                                                + "Recipient,Status,Timestamp,Failure Reason\n" 
                                                + filteredMessages.map(m => `${m.recipient},${m.status},${new Date(m.timestamp).toLocaleString()},"${(m.content?.failureReason || '').replace(/"/g, '""')}"`).join("\n");
                                            const encodedUri = encodeURI(csvContent);
                                            const link = document.createElement("a");
                                            link.setAttribute("href", encodedUri);
                                            link.setAttribute("download", `campaign_report_${selectedCampaign.name}.csv`);
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }}
                                        className="btn-secondary flex items-center gap-2 text-sm px-3 py-1.5"
                                    >
                                        <Download size={14} /> Download
                                    </button>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by phone or status..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-surface-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-brand-500 w-64"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-surface-700 text-surface-400 text-sm">
                                            <th className="pb-3 font-medium px-4">Recipient</th>
                                            <th className="pb-3 font-medium px-4">Status</th>
                                            <th className="pb-3 font-medium px-4 text-right">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {filteredMessages.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="py-8 text-center text-white0">No logs found.</td>
                                            </tr>
                                        ) : (
                                            filteredMessages.map(msg => (
                                                <tr key={msg.id} className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors">
                                                    <td className="py-3 px-4 text-white font-mono">{msg.recipient}</td>
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold tracking-wide uppercase
                                                            ${msg.status === 'READ' ? 'bg-blue-500/10 text-blue-400'
                                                                : msg.status === 'DELIVERED' ? 'bg-green-500/10 text-green-400'
                                                                    : msg.status === 'FAILED' ? 'bg-red-500/10 text-red-400'
                                                                        : 'bg-surface-700 text-surface-300'}`}
                                                        >
                                                            {msg.status === 'READ' || msg.status === 'DELIVERED' ? <CheckCircle2 size={12} />
                                                                : msg.status === 'FAILED' ? <XCircle size={12} />
                                                                    : <Clock size={12} />}
                                                            {msg.status}
                                                        </span>
                                                        {msg.status === 'FAILED' && (msg.content?.text || msg.content?.failureReason) && (
                                                            <div className="mt-1 text-[11px] text-red-400/80 leading-snug max-w-xs break-words">
                                                                {(msg.content?.failureReason || msg.content?.text).replace(/Error:/i, '').trim()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-surface-400">
                                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default View: LIST / REPORTS
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-end md:justify-between items-center">
                <h1 className="text-3xl font-bold font-display text-white hidden md:block">Campaign Insights</h1>
                <button
                    onClick={() => setView('create')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
                >
                    <Plus size={18} /> 
                    <span className="hidden md:inline">New Campaign</span>
                    <span className="md:hidden">New</span>
                </button>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    <div className="p-12 text-center text-surface-400">Loading Campaign Analytics...</div>
                ) : campaigns.length === 0 ? (
                    <div className="glass-panel p-12 text-center rounded-2xl border border-surface-700">
                        <div className="w-16 h-16 bg-surface-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BarChart2 size={32} className="text-white0" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Campaigns Yet</h3>
                        <p className="text-white0 mb-6 max-w-md mx-auto">Create your first broadcast campaign to send personalized messages to multiple contacts simultaneously and track performance metrics here.</p>
                        <button
                            onClick={() => setView('create')}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                        >
                            Start First Campaign
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {campaigns.map((camp) => (
                        <div key={camp.id} onClick={() => fetchCampaignDetails(camp.id)} className="glass-panel p-6 rounded-2xl border border-surface-700 hover:border-brand-500/50 cursor-pointer transition-all hover:bg-surface-800/50 relative flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold text-white">{camp.name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider 
                                            ${camp.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' 
                                            : camp.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400'
                                            : camp.status === 'CANCELLED' ? 'bg-surface-600/50 text-surface-300'
                                            : 'bg-yellow-500/20 text-yellow-400'}`}>
                                            {camp.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-surface-400 flex items-center gap-4">
                                        <span className="flex items-center gap-1"><FileText size={14} /> {camp.templateName}</span>
                                        <span className="flex items-center gap-1"><Users size={14} /> {camp.stats.total} Targets</span>
                                        {camp.scheduledAt ? (
                                            <span className="flex items-center gap-1 text-blue-400"><Clock size={14} /> Scheduled: {new Date(camp.scheduledAt).toLocaleString()}</span>
                                        ) : (
                                            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(camp.createdAt).toLocaleDateString()}</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Performance Metrics Block */}
                            <div>
                                {renderInsights(camp.stats, false)}
                            </div>
                        </div>
                    ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Campaigns;
