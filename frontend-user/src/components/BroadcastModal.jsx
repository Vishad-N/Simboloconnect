import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Send, FileText, AlertCircle, CheckCircle } from 'lucide-react';

const TemplatePreview = ({ template, mediaUrl, mediaFile }) => {
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
            if (/^\d+$/.test(url) || url.startsWith('media_')) {
                return `${import.meta.env.VITE_API_URL}/api/campaigns/media/${url}`;
            }
            return url;
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
                    <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center min-h-[120px]">
                        {src ? (
                            <img src={src} alt="Image Header preview" className="w-full h-auto max-h-40 object-contain" onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                            }} />
                        ) : (
                            <div className="flex flex-col items-center gap-1 p-4 text-gray-400">
                                <span className="text-2xl">🖼️</span>
                                <span className="text-xs">No image uploaded yet</span>
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


const BroadcastModal = ({ isOpen, onClose, targetContacts, targetTags, onCampaignCreated }) => {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        templateId: '',
        scheduledAt: '',
        enableClickTracking: false
    });
    
    // Dynamic Template Mapping State
    const [variablesConfig, setVariablesConfig] = useState({});
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaUploading, setMediaUploading] = useState(false);
    const [templateVariables, setTemplateVariables] = useState([]);
    const [requiresMedia, setRequiresMedia] = useState(false);
    const [mediaFormat, setMediaFormat] = useState('');
    const [availableCustomKeys, setAvailableCustomKeys] = useState([]);

    useEffect(() => {
        if (!isOpen) return;
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [templatesRes, contactsRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/api/templates`),
                    axios.get(`${import.meta.env.VITE_API_URL}/api/contacts`)
                ]);

                const allTemplates = templatesRes.data;
                const approvedTemplates = allTemplates.filter(t => {
                    const status = (t.status || '').toUpperCase();
                    return status === 'APPROVED' || status === 'AVAILABLE' || status === '';
                });
                setTemplates(approvedTemplates.length > 0 ? approvedTemplates : allTemplates);

                // Extract custom keys
                const customKeys = new Set();
                const contactsData = contactsRes.data.data || contactsRes.data;
                contactsData.forEach(c => {
                    if (c.customFields) {
                        try {
                            const fields = typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields;
                            Object.keys(fields).forEach(k => customKeys.add(k));
                        } catch (_) {}
                    }
                });
                setAvailableCustomKeys(Array.from(customKeys).sort());
            } catch (error) {
                console.error("Failed to fetch data for modal:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [isOpen]);

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

        const initialConfig = {};
        vars.forEach((v, index) => {
            initialConfig[index] = { type: 'custom', value: '' }; 
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

        setIsSubmitting(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/create`, {
                name: formData.name,
                templateId: formData.templateId,
                tags: targetTags || [],
                targetPhones: targetContacts || [],
                variablesConfig,
                mediaUrl,
                scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
                enableClickTracking: formData.enableClickTracking
            });
            alert(formData.scheduledAt ? "Campaign scheduled successfully!" : "Campaign triggered successfully!");
            onCampaignCreated();
            onClose();
        } catch (error) {
            console.error("Failed to start campaign:", error);
            alert("Error: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-surface-800/90 backdrop-blur-md p-6 border-b border-surface-700 flex justify-between items-center z-10">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Send size={24} className="text-brand-400" /> Broadcast to {targetContacts?.length > 0 ? `${targetContacts.length} Contacts` : (targetTags?.length > 0 ? `${targetTags.length} Groups` : 'Selected Audience')}
                    </h2>
                    <button onClick={onClose} className="text-surface-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    {isLoading ? (
                        <div className="text-center py-12 text-surface-400">Loading templates...</div>
                    ) : (
                        <form onSubmit={handleCreateCampaign} className="space-y-6">
                            <div>
                                <label className="block text-sm text-surface-300 font-medium mb-2">Campaign Name <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Diwali Promo 2026"
                                    className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-surface-300 font-medium mb-2">Select Template <span className="text-red-400">*</span></label>
                                {templates.length === 0 ? (
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-sm flex items-center gap-2">
                                        <AlertCircle size={16} /> No templates available.
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={formData.templateId}
                                        onChange={e => setFormData({ ...formData, templateId: e.target.value })}
                                        className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
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

                            {requiresMedia && (
                                <div className="bg-surface-900/50 p-5 rounded-xl border border-surface-700">
                                    <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
                                        <FileText size={18} className="text-brand-400"/> Upload Media ({mediaFormat})
                                    </h3>
                                    <p className="text-xs text-surface-400 mb-3">Drag and drop a file to upload.</p>
                                    
                                    <div className="space-y-3">
                                        <div className="relative border-2 border-dashed border-surface-600 hover:border-brand-500 rounded-xl p-6 text-center transition-colors bg-surface-800 group">
                                            <input
                                                type="file"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    setMediaFile(file);
                                                    setMediaUploading(true);
                                                    const fd = new FormData();
                                                    fd.append('file', file);
                                                    try {
                                                        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/campaigns/upload`, fd, {
                                                            headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}`, 'Content-Type': 'multipart/form-data' }
                                                        });
                                                        setMediaUrl(res.data.mediaId || res.data.url || '');
                                                    } catch (err) {
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

                                        {mediaFile && (
                                            <div className="space-y-2">
                                                {mediaUrl && (
                                                    <div className="p-3 bg-brand-500/10 border border-brand-500/30 text-brand-400 rounded-lg text-sm flex items-center gap-2 font-medium">
                                                        <CheckCircle size={16} /> Media uploaded successfully!
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
                                <div className="bg-surface-900/50 p-5 rounded-xl border border-surface-700">
                                    <h3 className="text-md font-bold text-white mb-2 flex items-center gap-2">
                                        <FileText size={18} className="text-brand-400"/> Template Variables
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {templateVariables.map((v, index) => (
                                            <div key={`${v.match}-${index}`} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                <div className="bg-surface-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium min-w-[80px] text-center">
                                                    {v.match}
                                                </div>
                                                <select
                                                    value={getConfigSelectValue(variablesConfig[index])}
                                                    onChange={e => handleSelectChange(index, e.target.value)}
                                                    className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500 min-w-[160px]"
                                                >
                                                    <option value="custom">Custom Text</option>
                                                    <option value="contact_name">Contact Name</option>
                                                    <option value="contact_phone">Contact Phone</option>
                                                    {availableCustomKeys.length > 0 && (
                                                        <optgroup label="Contact Fields">
                                                            {availableCustomKeys.map(k => (
                                                                <option key={k} value={`custom_field:${k}`}>{k}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <option value="custom_field_manual">Specify Custom Field key...</option>
                                                </select>

                                                {(variablesConfig[index]?.type === 'custom' || (variablesConfig[index]?.type === 'custom_field' && (variablesConfig[index]?.isManual || !availableCustomKeys.includes(variablesConfig[index]?.value)))) && (
                                                    <input
                                                        type="text"
                                                        required
                                                        value={variablesConfig[index]?.value || ''}
                                                        onChange={e => setVariablesConfig(prev => ({
                                                            ...prev, [index]: { ...prev[index], value: e.target.value }
                                                        }))}
                                                        placeholder={variablesConfig[index]?.type === 'custom' ? "Enter static text..." : "Enter custom field key..."}
                                                        className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-500"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-surface-300 font-medium mb-2">Schedule for Later (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.scheduledAt}
                                        onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                                        className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                    />
                                </div>
                                <div className="flex flex-col justify-center">
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

                            <div className="pt-6 border-t border-surface-700 flex justify-end gap-3">
                                <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl bg-surface-700 text-white hover:bg-surface-600 font-medium">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !formData.templateId}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Processing...' : (formData.scheduledAt ? 'Schedule Broadcast' : 'Send Broadcast')}
                                    {!isSubmitting && <Send size={18} />}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BroadcastModal;
