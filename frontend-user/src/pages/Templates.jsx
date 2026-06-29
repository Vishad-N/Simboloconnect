import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, RefreshCw, CheckCircle, Clock, XCircle, ChevronRight, Phone, Globe, MessageSquare, Trash2, ArrowLeft, Image as ImageIcon, Video, FileText, ExternalLink } from 'lucide-react';

const Templates = () => {
    const [view, setView] = useState('list'); // 'list' | 'category' | 'editor'
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // Wizard Form State
    const [formData, setFormData] = useState({
        name: '',
        category: 'MARKETING',
        language: 'en_US',
        headerType: 'NONE', // NONE, TEXT, IMAGE, VIDEO, DOCUMENT, LOCATION
        headerText: '',
        headerFile: null, // Base64 string
        headerFileName: '',
        headerMimeType: '',
        bodyText: '',
        footerText: '',
        buttons: [], // { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER', text: '', url: '', country_code: '', phone_number: '' }
        includeUnsubscribe: true
    });

    const resetForm = () => {
        setFormData({
            name: '',
            category: 'MARKETING',
            language: 'en_US',
            headerType: 'NONE',
            headerText: '',
            headerFile: null,
            headerFileName: '',
            headerMimeType: '',
            bodyText: '',
            footerText: '',
            buttons: [],
            includeUnsubscribe: true
        });
    };

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/templates`);
            setTemplates(response.data);
        } catch (error) {
            console.error("Failed to load templates", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/templates/sync`);
            await fetchTemplates();
        } catch (error) {
            console.error("Failed to sync templates", error);
            alert("Error syncing templates. Ensure Meta tokens are valid.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCreateTemplate = async () => {
        if (!formData.name || !formData.bodyText) {
            alert("Template Name and Body are required.");
            return;
        }

        const components = [];

        if (formData.headerType === 'TEXT' && formData.headerText) {
            components.push({ type: 'HEADER', format: 'TEXT', text: formData.headerText });
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(formData.headerType)) {
            // For Meta API, you only declare the format during creation.
            // But they also require passing an `example` array with a handle if creating for review.
            components.push({ type: 'HEADER', format: formData.headerType });
        }

        // Auto-generate example if variables are used in body
        const bodyComponent = { type: 'BODY', text: formData.bodyText };
        const varsMatch = formData.bodyText.match(/\{\{\d+\}\}/g);
        if (varsMatch && varsMatch.length > 0) {
            // Provide dummy examples for each variable found
            const dummyVars = Array(varsMatch.length).fill("Sample");
            bodyComponent.example = { body_text: [dummyVars] };
        }
        components.push(bodyComponent);

        if (formData.footerText) {
            components.push({ type: 'FOOTER', text: formData.footerText });
        }

        let finalButtons = [...formData.buttons];
        if (formData.includeUnsubscribe) {
            finalButtons.push({ type: 'QUICK_REPLY', text: 'Unsubscribe' });
        }

        if (finalButtons.length > 0) {
            const serializedButtons = finalButtons.map(b => {
                if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
                if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
                if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: `${b.country_code}${b.phone_number}` };
                return null;
            }).filter(b => b);

            if (serializedButtons.length > 0) {
                components.push({ type: 'BUTTONS', buttons: serializedButtons });
            }
        }

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/templates/create`, {
                name: formData.name,
                category: formData.category,
                language: formData.language,
                components: components,
                // Pass media for the backend to upload to Meta as an example handle
                headerFile: formData.headerFile,
                headerFileName: formData.headerFileName,
                headerMimeType: formData.headerMimeType
            });
            alert("Template submitted to Meta for approval!");
            setView('list');
            resetForm();
            fetchTemplates();
        } catch (error) {
            console.error("Error creating template", error);
            alert("Failed to create template: " + (error.response?.data?.error || error.message));
        }
    };

    const addButton = (type) => {
        const maxAllowed = formData.includeUnsubscribe ? 2 : 3;
        if (formData.buttons.length >= maxAllowed) {
            alert(`Maximum 3 buttons allowed total (Unsubscribe takes 1 slot).`);
            return;
        }
        setFormData({
            ...formData,
            buttons: [...formData.buttons, { type, text: '', url: '', country_code: '+1', phone_number: '' }]
        });
    };

    const updateButton = (index, field, value) => {
        const newButtons = [...formData.buttons];
        newButtons[index][field] = value;
        setFormData({ ...formData, buttons: newButtons });
    };

    const removeButton = (index) => {
        const newButtons = [...formData.buttons];
        newButtons.splice(index, 1);
        setFormData({ ...formData, buttons: newButtons });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const limit = 5; // 5MB limit for template examples typically
        if (file.size > limit * 1024 * 1024) {
            alert(`File size exceeds ${limit}MB.`);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData({
                ...formData,
                headerFile: reader.result,
                headerFileName: file.name,
                headerMimeType: file.type
            });
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setFormData({
            ...formData,
            headerFile: null,
            headerFileName: '',
            headerMimeType: ''
        });
    };

    const renderStatusBadge = (status) => {
        const s = status.toUpperCase();
        if (s === 'APPROVED') return <span className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium w-fit"><CheckCircle size={12} /> Approved</span>;
        if (s === 'REJECTED') return <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium w-fit"><XCircle size={12} /> Rejected</span>;
        return <span className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-medium w-fit"><Clock size={12} /> Pending</span>;
    };

    const handleDeleteTemplate = async (templateName) => {
        if (!window.confirm(`Are you sure you want to delete template "${templateName}"? This cannot be undone.`)) {
            return;
        }

        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/templates/${templateName}`);
            alert("Template deleted successfully.");
            fetchTemplates();
        } catch (error) {
            console.error("Failed to delete template", error);
            alert("Failed to delete template: " + (error.response?.data?.error || error.message));
        }
    };

    // --- SUB-COMPONENTS ---

    const PhoneMockup = () => {
        let displayBody = formData.bodyText ? formData.bodyText.replace(/\{\{\d+\}\}/g, '[Variable]') : "Your message body will appear here...";
        let displayHeaderType = formData.headerType;
        let displayHeaderText = formData.headerText;
        let displayButtons = formData.buttons;
        let displayIncludeUnsubscribe = formData.includeUnsubscribe;

        if (view === 'category') {
            if (formData.category === 'MARKETING') {
                displayHeaderType = 'IMAGE';
                displayBody = "🎉 Diwali Mega Sale is here!\n\nGet up to 50% off on all electronics. Use code DIWALI50 at checkout.\n\nHurry, offer valid till stocks last!";
                displayButtons = [{ type: 'URL', text: 'Shop Now' }];
                displayIncludeUnsubscribe = true;
            } else if (formData.category === 'UTILITY') {
                displayHeaderType = 'NONE';
                displayBody = "Hi there,\n\nYour order #12345 has been shipped and is out for delivery today.\n\nTrack your package using the link below.";
                displayButtons = [{ type: 'URL', text: 'Track Order' }];
                displayIncludeUnsubscribe = false;
            } else if (formData.category === 'AUTHENTICATION') {
                displayHeaderType = 'NONE';
                displayBody = "Your WhatsApp verification code is 482-991.\n\nFor your security, do not share this code with anyone.";
                displayButtons = [{ type: 'URL', text: 'Copy Code' }];
                displayIncludeUnsubscribe = false;
            }
        }

        return (
            <div className="w-72 bg-white border-[8px] border-surface-200 rounded-[2.5rem] h-[550px] flex flex-col overflow-hidden relative shadow-2xl flex-shrink-0">
                {/* Phone Header */}
                <div className="bg-[#008069] p-4 flex items-center justify-between z-10 text-white">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20"></div>
                        <div>
                            <div className="w-24 h-3 bg-white/30 rounded"></div>
                            <div className="w-16 h-2 bg-white/20 rounded mt-1"></div>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-[#efeae2] p-4 overflow-y-auto w-full relative">
                    <div className="bg-white max-w-[90%] rounded-lg p-3 text-[#111b21] mt-4 relative text-[13px] leading-snug break-words shadow-sm">
                        {/* Header */}
                        {displayHeaderType === 'TEXT' && displayHeaderText && (
                            <p className="font-bold text-[#111b21] mb-1">{displayHeaderText}</p>
                        )}
                        {['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(displayHeaderType) && (
                            <div className="bg-gray-100 rounded-sm w-full h-24 mb-2 flex items-center justify-center border border-gray-200 relative overflow-hidden">
                                {formData.headerFile && displayHeaderType === 'IMAGE' && view !== 'category' ? (
                                    <img src={formData.headerFile} alt="preview" className="w-full h-full object-cover" />
                                ) : formData.headerFile && displayHeaderType === 'VIDEO' && view !== 'category' ? (
                                    <video src={formData.headerFile} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        {displayHeaderType === 'IMAGE' && <ImageIcon size={24} className="mb-1" />}
                                        {displayHeaderType === 'VIDEO' && <Video size={24} className="mb-1" />}
                                        {displayHeaderType === 'DOCUMENT' && <FileText size={24} className="mb-1" />}
                                        <span className="font-medium text-[10px] uppercase text-center px-2">
                                            {view === 'category' ? `[Sample ${displayHeaderType.toLowerCase()}]` : (formData.headerFileName || `[Sample ${displayHeaderType.toLowerCase()}]`)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Body */}
                        <p className="whitespace-pre-wrap">{displayBody}</p>

                        {/* Footer */}
                        {formData.footerText && view !== 'category' && (
                            <p className="text-[11px] text-gray-500 mt-2">{formData.footerText}</p>
                        )}
                    </div>

                    {/* Buttons */}
                    {(displayButtons.length > 0 || displayIncludeUnsubscribe) && (
                        <div className="mt-1 flex flex-col gap-1 w-full max-w-[90%]">
                            {displayButtons.map((btn, idx) => (
                                <div key={idx} className="bg-white py-2 px-3 rounded flex items-center justify-center gap-2 shadow-sm border border-gray-100">
                                    {btn.type === 'URL' && <ExternalLink size={14} className="text-[#00a884]" />}
                                    {btn.type === 'PHONE_NUMBER' && <Phone size={14} className="text-[#00a884]" />}
                                    {btn.type === 'QUICK_REPLY' && <MessageSquare size={14} className="text-[#00a884]" />}
                                    <span className="text-[#00a884] font-medium text-[13px]">{btn.text || "Button Text"}</span>
                                </div>
                            ))}
                            {displayIncludeUnsubscribe && (
                                <div className="bg-white py-2 px-3 rounded flex items-center justify-center gap-2 shadow-sm border border-gray-100">
                                    <MessageSquare size={14} className="text-[#00a884]" />
                                    <span className="text-[#00a884] font-medium text-[13px]">Unsubscribe</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- VIEWS ---

    if (view === 'category') {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <button onClick={() => setView('list')} className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors">
                    <ArrowLeft size={18} /> Back to Templates
                </button>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Step 1: Choose Category</h2>
                        <p className="text-surface-400">Select the category that best describes your template's purpose.</p>
                    </div>
                    <button
                        onClick={() => setView('editor')}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
                    >
                        Next: Build Template <ChevronRight size={18} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                        {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map(cat => (
                            <div
                                key={cat}
                                onClick={() => setFormData({ ...formData, category: cat })}
                                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${formData.category === cat
                                    ? 'border-brand-500 bg-brand-500/10'
                                    : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                                    }`}
                            >
                                <h3 className="text-xl font-bold text-white mb-2 capitalize">{cat.toLowerCase()}</h3>
                                <p className="text-surface-400 text-sm">
                                    {cat === 'MARKETING' && "Send promotional offers, announcements, and newsletters to increase awareness and engagement."}
                                    {cat === 'UTILITY' && "Send account updates, order updates, alerts, and important notifications to customers."}
                                    {cat === 'AUTHENTICATION' && "Send codes to verify transactions or logins, like one-time passwords (OTPs)."}
                                </p>
                            </div>
                        ))}
                    </div>
                    <PhoneMockup />
                </div>
            </div>
        );
    }

    if (view === 'editor') {
        return (
            <div className="max-w-6xl mx-auto space-y-6 pb-20">
                <button onClick={() => setView('category')} className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors">
                    <ArrowLeft size={18} /> Back to Category
                </button>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Step 2: Edit Template</h2>
                        <p className="text-surface-400">Design your message. Use variables like {'{{1}}'} to personalize.</p>
                    </div>
                    <button
                        onClick={handleCreateTemplate}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors shadow-lg shadow-green-500/25"
                    >
                        Submit for Review <CheckCircle size={18} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Editor Form */}
                    <div className="flex-1 space-y-6">
                        {/* Basic Info */}
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-surface-400 mb-1">Template Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                        placeholder="e.g., welcome_message"
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                    />
                                    <p className="text-xs text-white0 mt-1">Lowercase and underscores only.</p>
                                </div>
                                <div>
                                    <label className="block text-sm text-surface-400 mb-1">Language</label>
                                    <select
                                        value={formData.language}
                                        onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                    >
                                        <option value="en_US">English (US)</option>
                                        <option value="en_GB">English (UK)</option>
                                        <option value="es">Spanish</option>
                                        <option value="hi">Hindi</option>
                                        <option value="ar">Arabic</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Message Components */}
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-6">

                            {/* Header */}
                            <div>
                                <label className="block text-sm text-surface-300 font-bold mb-2">Header <span className="text-white0 font-normal">(Optional)</span></label>
                                <select
                                    value={formData.headerType}
                                    onChange={e => setFormData({ ...formData, headerType: e.target.value })}
                                    className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500 mb-2"
                                >
                                    <option value="NONE">None</option>
                                    <option value="TEXT">Text</option>
                                    <option value="IMAGE">Image</option>
                                    <option value="VIDEO">Video</option>
                                    <option value="DOCUMENT">Document</option>
                                    <option value="LOCATION">Location</option>
                                </select>
                                {formData.headerType === 'TEXT' && (
                                    <input
                                        type="text"
                                        maxLength={60}
                                        value={formData.headerText}
                                        onChange={e => setFormData({ ...formData, headerText: e.target.value })}
                                        placeholder="Add a text heading..."
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                    />
                                )}
                                {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formData.headerType) && (
                                    <div className="mt-2 text-sm">
                                        {!formData.headerFile ? (
                                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-surface-600 border-dashed rounded-xl cursor-pointer bg-surface-800 hover:bg-surface-700 transition">
                                                <div className="flex flex-col items-center justify-center text-surface-400">
                                                    <Plus size={20} className="mb-1" />
                                                    <p className="text-xs">Click to upload sample {formData.headerType.toLowerCase()}</p>
                                                </div>
                                                <input type="file" className="hidden" accept={
                                                    formData.headerType === 'IMAGE' ? "image/*" :
                                                        formData.headerType === 'VIDEO' ? "video/*" : ".pdf,.doc,.docx"
                                                } onChange={handleFileUpload} />
                                            </label>
                                        ) : (
                                            <div className="flex items-center justify-between p-3 bg-surface-800 rounded-xl border border-surface-600 text-sm">
                                                <span className="text-surface-300 truncate max-w-[200px]">{formData.headerFileName}</span>
                                                <button onClick={removeFile} type="button" className="text-red-400 hover:text-red-300 p-1">
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-white0 mt-1">A sample file is required for review by Meta.</p>
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div>
                                <label className="block text-sm text-surface-300 font-bold mb-2">Body <span className="text-red-400">*</span></label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.bodyText}
                                    onChange={e => setFormData({ ...formData, bodyText: e.target.value })}
                                    placeholder="Enter your message here. Use {{1}}, {{2}} to add variables."
                                    className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                />
                            </div>

                            {/* Footer */}
                            <div>
                                <label className="block text-sm text-surface-300 font-bold mb-2">Footer <span className="text-white0 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    maxLength={60}
                                    value={formData.footerText}
                                    onChange={e => setFormData({ ...formData, footerText: e.target.value })}
                                    placeholder="Add a short footer..."
                                    className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-4">
                            <label className="block text-sm text-surface-300 font-bold mb-2">Buttons <span className="text-white0 font-normal">(Optional, max 3)</span></label>

                            {formData.buttons.map((btn, idx) => (
                                <div key={idx} className="bg-surface-800/50 p-4 rounded-xl border border-surface-700 relative group">
                                    <button
                                        onClick={() => removeButton(idx)}
                                        className="absolute right-3 top-3 text-white0 hover:text-red-400"
                                    ><Trash2 size={16} /></button>

                                    <div className="flex flex-col gap-3 pr-8">
                                        <div className="flex gap-4 items-center">
                                            <span className="text-brand-400 font-mono text-sm uppercase font-bold w-32">{btn.type.replace('_', ' ')}</span>
                                            <input
                                                type="text"
                                                value={btn.text}
                                                onChange={e => updateButton(idx, 'text', e.target.value)}
                                                placeholder="Button Text"
                                                maxLength={20}
                                                className="flex-1 bg-surface-900 border-none rounded-lg px-3 py-2 text-white text-sm"
                                            />
                                        </div>

                                        {btn.type === 'URL' && (
                                            <input
                                                type="text"
                                                value={btn.url}
                                                onChange={e => updateButton(idx, 'url', e.target.value)}
                                                placeholder="https://example.com"
                                                className="w-full bg-surface-900 border-none rounded-lg px-3 py-2 text-white text-sm"
                                            />
                                        )}
                                        {btn.type === 'PHONE_NUMBER' && (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={btn.country_code}
                                                    onChange={e => updateButton(idx, 'country_code', e.target.value)}
                                                    placeholder="+1"
                                                    className="w-20 bg-surface-900 border-none rounded-lg px-3 py-2 text-white text-sm"
                                                />
                                                <input
                                                    type="text"
                                                    value={btn.phone_number}
                                                    onChange={e => updateButton(idx, 'phone_number', e.target.value)}
                                                    placeholder="1234567890"
                                                    className="flex-1 bg-surface-900 border-none rounded-lg px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {(formData.buttons.length < (formData.includeUnsubscribe ? 2 : 3)) && (
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => addButton('QUICK_REPLY')} type="button" className="px-3 py-1.5 rounded-lg bg-surface-800 text-sm text-surface-200 hover:bg-surface-700 transition">
                                        + Quick Reply
                                    </button>
                                    {formData.buttons.filter(b => b.type === 'URL').length < 2 && (
                                        <button onClick={() => addButton('URL')} type="button" className="px-3 py-1.5 rounded-lg bg-surface-800 text-sm text-surface-200 hover:bg-surface-700 transition">
                                            + URL
                                        </button>
                                    )}
                                    {formData.buttons.filter(b => b.type === 'PHONE_NUMBER').length < 1 && (
                                        <button onClick={() => addButton('PHONE_NUMBER')} type="button" className="px-3 py-1.5 rounded-lg bg-surface-800 text-sm text-surface-200 hover:bg-surface-700 transition">
                                            + Phone Number
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="mt-8 border-t border-surface-700 pt-6 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-surface-200">Unsubscribe Button</h4>
                                    <p className="text-xs text-surface-400 mt-1">Automatically adds an opt-out button to your template.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={formData.includeUnsubscribe}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                if (formData.buttons.length >= 3) {
                                                    alert("Please remove a button first to make room for Unsubscribe.");
                                                    return;
                                                }
                                            }
                                            setFormData({ ...formData, includeUnsubscribe: e.target.checked });
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-surface-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Live Preview Checkout */}
                    <div className="sticky top-6 h-fit">
                        <PhoneMockup />
                    </div>
                </div>
            </div>
        );
    }

    // Default View: LIST
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-end md:justify-between items-center">
                <h1 className="text-3xl font-bold font-display text-white hidden md:block">Message Templates</h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-surface-800 text-white hover:bg-surface-700 transition-colors disabled:opacity-50 text-sm md:text-base"
                    >
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        <span className="hidden md:inline">Refresh from Meta</span>
                        <span className="md:hidden">Sync</span>
                    </button>
                    <button
                        onClick={() => setView('category')}
                        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25 text-sm md:text-base"
                    >
                        <Plus size={16} />
                        <span className="hidden md:inline">Create Template</span>
                        <span className="md:hidden">Create</span>
                    </button>
                    <a
                        href="https://business.facebook.com/wa/manage/message-templates/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25 text-sm md:text-base"
                    >
                        <ExternalLink size={16} />
                        <span className="hidden md:inline">Manage on Meta</span>
                        <span className="md:hidden">Meta</span>
                    </a>
                </div>
            </div>

            {/* Unified Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 w-full overflow-x-hidden mt-4">
                {isLoading ? (
                    <div className="col-span-full text-center p-8 text-white0">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="col-span-full text-center p-8 text-white0">No templates found. Create one or sync from Meta.</div>
                ) : (
                    templates.map((t) => {
                        // Extract Media Info if exists
                        const headerComp = t.components?.find(c => c.type === 'HEADER');
                        const hasMedia = headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format);
                        const mediaType = headerComp?.format;

                        return (
                            <div key={t.id} className="bg-surface-800 rounded-2xl p-4 shadow-lg shadow-black/20 border border-surface-700 relative flex flex-col h-full hover:border-surface-600 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-white text-lg truncate w-full pr-8">{t.name}</h3>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.name); }}
                                        className="absolute top-3 right-3 text-surface-400 hover:text-red-400 p-2 rounded-lg hover:bg-surface-700 transition"
                                        title="Delete Template"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    {renderStatusBadge(t.status)}
                                    <span className="bg-surface-700/50 px-2 py-0.5 rounded text-surface-400 font-medium text-[10px] uppercase">{t.category}</span>
                                    {hasMedia && (
                                        <span className="flex items-center gap-1 bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded font-medium text-[10px] uppercase ml-auto">
                                            {mediaType === 'IMAGE' && <ImageIcon size={12} />}
                                            {mediaType === 'VIDEO' && <Video size={12} />}
                                            {mediaType === 'DOCUMENT' && <FileText size={12} />}
                                            {mediaType} INCLUDED
                                        </span>
                                    )}
                                </div>

                                <div className="bg-surface-900 p-4 rounded-xl border border-surface-700/50 mb-3 flex-grow shadow-inner">
                                    {hasMedia && (
                                        <div className="w-full h-24 bg-surface-800 rounded-lg mb-3 flex items-center justify-center border border-surface-700/50">
                                            {mediaType === 'IMAGE' && <ImageIcon size={32} className="text-white0" />}
                                            {mediaType === 'VIDEO' && <Video size={32} className="text-white0" />}
                                            {mediaType === 'DOCUMENT' && <FileText size={32} className="text-white0" />}
                                        </div>
                                    )}
                                    <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap font-sans">{t.body}</p>
                                    
                                    {t.components?.find(c => c.type === 'BUTTONS')?.buttons && (
                                        <div className="mt-3 flex flex-col gap-1.5">
                                            {t.components.find(c => c.type === 'BUTTONS').buttons.map((btn, idx) => (
                                                <div key={idx} className="bg-surface-800 border border-surface-700 text-brand-400 py-1.5 px-3 rounded flex items-center justify-center gap-2 text-xs font-medium truncate">
                                                    {btn.type === 'URL' && <ExternalLink size={12} />}
                                                    {btn.type === 'PHONE_NUMBER' && <Phone size={12} />}
                                                    {btn.type === 'QUICK_REPLY' && <MessageSquare size={12} />}
                                                    {btn.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center text-xs text-white0 pt-3 border-t border-surface-700/50 mt-auto">
                                    <span className="uppercase tracking-wide font-medium">Language: <span className="text-surface-300 ml-1">{t.language}</span></span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default Templates;
