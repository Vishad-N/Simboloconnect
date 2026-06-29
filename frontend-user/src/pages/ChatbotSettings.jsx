import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bot, Save, Code, Key, Brain, Sparkles, Database, FileText, Globe, Trash2, Calendar } from 'lucide-react';

const ChatbotSettings = () => {
    const [settings, setSettings] = useState({
        botEnabled: false,
        botPrompt: '',
        aiProvider: 'none',
        aiApiKey: '',
        aiWebhookUrl: '',
        aiModel: '',
        googleClientId: '',
        googleClientSecret: '',
        isGoogleConnected: false
    });
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const getAvailableModels = (provider) => {
        switch (provider) {
            case 'openai':
                return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
            case 'gemini':
                return ['gemini-1.5-pro', 'gemini-1.5-flash'];
            case 'openrouter':
                return ['meta-llama/llama-3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro-1.5', 'openai/gpt-4o'];
            case 'nvidianim':
                return ['meta/llama3-70b-instruct', 'meta/llama3-8b-instruct', 'mistralai/mixtral-8x22b-instruct-v0.1'];
            default:
                return [];
        }
    };
    
    // Knowledge Base & Prompt Optimization State
    const [optimizing, setOptimizing] = useState(false);
    const [knowledgeDocs, setKnowledgeDocs] = useState([]);
    const [newUrl, setNewUrl] = useState('');
    const [processingKb, setProcessingKb] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/chatbot/settings`);
                if (response.data) {
                    setSettings({
                        botEnabled: response.data.botEnabled,
                        botPrompt: response.data.botPrompt,
                        aiProvider: response.data.aiProvider,
                        aiApiKey: response.data.aiApiKey, // likely masked
                        aiWebhookUrl: response.data.aiWebhookUrl,
                        aiModel: response.data.aiModel || '',
                        googleClientId: response.data.googleClientId,
                        googleClientSecret: response.data.googleClientSecret,
                        isGoogleConnected: response.data.isGoogleConnected
                    });
                }
            } catch (error) {
                console.error("Error fetching chatbot settings", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchKnowledge = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/chatbot/knowledge`);
                setKnowledgeDocs(res.data);
            } catch (e) {
                console.error("Failed to fetch knowledge docs", e);
            }
        };

        fetchSettings();
        fetchKnowledge();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/chatbot/settings`, settings);
            alert("Chatbot & AI settings saved successfully!");
        } catch (error) {
            console.error("Error saving settings", error);
            alert(error.response?.data?.error || "Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleOptimizePrompt = async () => {
        if (!settings.botPrompt) return alert("Please enter a basic prompt first to optimize it.");
        setOptimizing(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chatbot/prompt-optimize`, { prompt: settings.botPrompt });
            setSettings({ ...settings, botPrompt: res.data.optimizedPrompt });
            alert("Prompt optimized using AI! Don't forget to save changes.");
        } catch (e) {
            alert(e.response?.data?.error || "Failed to optimize prompt. Make sure OpenAI Key is saved.");
        } finally {
            setOptimizing(false);
        }
    };

    const handleUploadPdf = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') return alert("Only PDF files are supported.");
        
        const formData = new FormData();
        formData.append('document', file);
        
        setProcessingKb(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chatbot/knowledge/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setKnowledgeDocs([res.data, ...knowledgeDocs]);
            alert("PDF processed and added to Knowledge Base!");
        } catch (err) {
            alert("Failed to upload PDF.");
        } finally {
            setProcessingKb(false);
            e.target.value = null;
        }
    };

    const handleCrawlUrl = async () => {
        if (!newUrl) return;
        setProcessingKb(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/chatbot/knowledge/crawl`, { url: newUrl });
            setKnowledgeDocs([res.data, ...knowledgeDocs]);
            setNewUrl('');
            alert("Website crawled and added to Knowledge Base!");
        } catch (err) {
            alert("Failed to crawl website.");
        } finally {
            setProcessingKb(false);
        }
    };

    const handleDeleteDoc = async (id) => {
        if (!window.confirm("Delete this document? AI will no longer read it.")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/chatbot/knowledge/${id}`);
            setKnowledgeDocs(knowledgeDocs.filter(d => d.id !== id));
        } catch (err) {
            alert("Failed to delete document.");
        }
    };

    const handleConnectGoogle = async () => {
        if (!settings.googleClientId || (!settings.googleClientSecret && !settings.isGoogleConnected)) {
            return alert("Please enter your Google Client ID and Secret first to connect your calendar.");
        }
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/integrations/google/authUrl`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } // if applicable, depends on axios interceptor
            });
            window.location.href = res.data.url;
        } catch (err) {
            alert(err.response?.data?.error || "Failed to initiate Google Calendar connection. Did you save your credentials?");
        }
    };

    const handleDisconnectGoogle = async () => {
        if (!window.confirm("Disconnect Google Calendar? AI will not be able to make bookings.")) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/integrations/google/disconnect`);
            setSettings({ ...settings, isGoogleConnected: false });
            alert("Calendar disconnected.");
        } catch (err) {
            alert("Failed to disconnect calendar.");
        }
    };

    if (loading) return <div className="text-surface-400 p-8">Loading Settings...</div>;

    return (
        <div className="max-w-4xl w-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Bot className="text-brand-400" size={32} />
                    AI & Chatbot Brain
                </h1>
                <p className="text-surface-400">Configure global fallback logic and AI integrations for automated Live Chat responses.</p>
            </header>

            <form onSubmit={handleSave} className="glass-panel p-8 space-y-8">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-5 bg-surface-800/50 rounded-xl border border-surface-700">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Master Bot Toggle (Global)</h3>
                        <p className="text-sm text-surface-400">Enable or disable all automated responses (Flows & AI) for your workspace.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.botEnabled}
                            onChange={(e) => setSettings({ ...settings, botEnabled: e.target.checked })}
                        />
                        <div className="w-14 h-7 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-500"></div>
                    </label>
                </div>

                <div className={`space-y-6 ${!settings.botEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="border-b border-surface-800 pb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Code className="text-brand-400" size={20} /> Integration Settings
                        </h2>
                        <p className="text-sm text-surface-400 max-w-2xl mt-1">If a customer's message doesn't match any Flow Rules, the system can forward it to an AI provider or external webhook (like n8n) for a dynamic response.</p>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-2">Fallback AI Provider</label>
                            <select
                                className="input-field w-full md:w-1/2"
                                value={settings.aiProvider}
                                onChange={(e) => setSettings({ ...settings, aiProvider: e.target.value })}
                            >
                                <option value="none">None (Only Flow Rules)</option>
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="nvidianim">NVIDIA NIM</option>
                                <option value="webhook">Custom Webhook (n8n, Flowise)</option>
                            </select>
                        </div>

                        {['openai', 'gemini', 'openrouter', 'nvidianim'].includes(settings.aiProvider) && (
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-surface-300 mb-2 flex items-center gap-2">
                                        <Key size={14} className="text-brand-400" />
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        className="input-field w-full"
                                        placeholder={settings.aiApiKey ? "••••••••••••••••" : `Enter your ${settings.aiProvider === 'openai' ? 'OpenAI' : settings.aiProvider === 'gemini' ? 'Gemini' : settings.aiProvider === 'openrouter' ? 'OpenRouter' : 'NVIDIA NIM'} API key`}
                                        value={settings.aiApiKey}
                                        onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
                                    />
                                    <p className="text-xs text-white0 mt-2">API Keys are encrypted securely at rest.</p>
                                </div>
                                <div className="w-full md:w-1/3">
                                    <label className="block text-sm font-medium text-surface-300 mb-2 flex items-center gap-2">
                                        <Sparkles size={14} className="text-brand-400" />
                                        AI Model
                                    </label>
                                    <select
                                        className="input-field w-full"
                                        value={settings.aiModel}
                                        onChange={(e) => setSettings({ ...settings, aiModel: e.target.value })}
                                    >
                                        <option value="">Default Recommended</option>
                                        {getAvailableModels(settings.aiProvider).map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {settings.aiProvider === 'webhook' && (
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-2">Custom Webhook URL</label>
                                <input
                                    type="url"
                                    className="input-field w-full"
                                    placeholder="https://your-n8n-instance.com/webhook/receive-message"
                                    value={settings.aiWebhookUrl}
                                    onChange={(e) => setSettings({ ...settings, aiWebhookUrl: e.target.value })}
                                />
                                <div className="mt-3 p-4 bg-surface-800/40 rounded-xl border border-surface-700 text-sm text-surface-300">
                                    <p className="font-semibold text-white mb-2">Webhook Payload Format:</p>
                                    <pre className="text-xs text-brand-400 overflow-x-auto whitespace-pre-wrap">
                                        {`{\n  "contact": "+1234567890",\n  "message": "Hello there",\n  "timestamp": "2024-03-24T12:00:00Z"\n}`}
                                    </pre>
                                    <p className="mt-2 text-surface-400">Respond to this webhook with <code className="text-brand-300 bg-surface-800 px-1 rounded">{"{ \"reply\": \"Your AI response here\" }"}</code> to automatically send a message back to the user.</p>
                                </div>
                            </div>
                        )}

                        {/* Google Calendar native integration */}
                        {(settings.aiProvider === 'openai' || settings.aiProvider === 'gemini') && (
                            <div className="pt-4 mt-6 border-t border-surface-800/50">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                    <Calendar size={16} className="text-brand-400"/> Google Calendar Booking
                                </h3>
                                <p className="text-xs text-surface-400 mb-4">Connect your calendar so the AI can check availability and schedule appointments automatically.</p>
                                
                                <div className="space-y-4 mb-4 bg-surface-800/20 p-4 rounded-xl border border-surface-700">
                                    <div className="text-xs text-surface-400 bg-surface-800 p-3 rounded-lg border border-surface-700/50 flex flex-col gap-1">
                                        <p className="font-semibold text-white">Google Cloud Setup Required:</p>
                                        <p>1. Go to Google Cloud Console and create OAuth logic.</p>
                                        <p>2. Set the <b>Authorized Redirect URI</b> exactly to:</p>
                                        <code className="bg-surface-900 border border-brand-500/30 text-brand-300 p-2 rounded block mt-1 break-all">
                                            {window.location.origin}/api/integrations/google/callback
                                        </code>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-surface-300 mb-2">Google Client ID</label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            placeholder="123456789-xxxxxx.apps.googleusercontent.com"
                                            value={settings.googleClientId}
                                            onChange={(e) => setSettings({ ...settings, googleClientId: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-300 mb-2 flex items-center gap-2">
                                            <Key size={14} className="text-brand-400" />
                                            Google Client Secret
                                        </label>
                                        <input
                                            type="password"
                                            className="input-field w-full"
                                            placeholder={settings.googleClientSecret ? "••••••••••••••••" : "GOCSPX-xxxxxx"}
                                            value={settings.googleClientSecret}
                                            onChange={(e) => setSettings({ ...settings, googleClientSecret: e.target.value })}
                                        />
                                    </div>
                                </div>
                                
                                {settings.isGoogleConnected ? (
                                    <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                        <div className="flex-1 text-sm">
                                            <p className="font-medium text-green-400">Calendar Connected</p>
                                            <p className="text-surface-400 text-xs">AI has access to manage bookings.</p>
                                        </div>
                                        <button type="button" onClick={handleDisconnectGoogle} className="text-xs text-surface-400 hover:text-red-400 transition-colors">Disconnect</button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={handleConnectGoogle} className="btn-secondary text-sm">
                                        Connect Google Calendar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="border-t border-surface-800 pt-8 mt-8 space-y-6">
                        <div className="border-b border-surface-800 pb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Brain className="text-brand-400" size={20} /> System Prompt Persona
                            </h2>
                            <p className="text-sm text-surface-400 max-w-2xl mt-1">Define how your AI should behave, its tone, and general rules.</p>
                        </div>
                        
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-medium text-surface-300">Bot Instructions</label>
                                <button type="button" onClick={handleOptimizePrompt} disabled={optimizing} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                                    <Sparkles size={14} /> {optimizing ? 'Optimizing...' : 'Optimize with AI'}
                                </button>
                            </div>
                            <textarea
                                className="input-field w-full h-32"
                                placeholder="You are a helpful customer support assistant for Acme Corp..."
                                value={settings.botPrompt}
                                onChange={(e) => setSettings({ ...settings, botPrompt: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="border-t border-surface-800 pt-8 mt-8 space-y-6">
                        <div className="border-b border-surface-800 pb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Database className="text-brand-400" size={20} /> Knowledge Base (RAG)
                            </h2>
                            <p className="text-sm text-surface-400 max-w-2xl mt-1">Upload PDFs or scan websites. The AI will read these documents before answering customer questions.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><FileText size={16} className="text-brand-400"/> Upload PDF</h3>
                                <input type="file" accept="application/pdf" onChange={handleUploadPdf} disabled={processingKb} className="text-sm text-surface-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-500/10 file:text-brand-400 hover:file:bg-brand-500/20 cursor-pointer" />
                            </div>
                            <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700">
                                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Globe size={16} className="text-brand-400"/> Scan Website</h3>
                                <div className="flex gap-2">
                                    <input type="url" placeholder="https://example.com" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="input-field w-full text-sm py-2" />
                                    <button type="button" onClick={handleCrawlUrl} disabled={processingKb || !newUrl} className="btn-primary py-2 px-4 whitespace-nowrap">Scan</button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-surface-300">Uploaded Documents</h3>
                            {knowledgeDocs.length === 0 ? (
                                <div className="text-center py-6 text-white0 text-sm bg-surface-800/30 rounded-lg border border-surface-700/50">No documents in your knowledge base yet.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {knowledgeDocs.map(doc => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 bg-surface-800/50 rounded-lg border border-surface-700">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                {doc.type === 'PDF' ? <FileText size={18} className="text-red-400 shrink-0"/> : <Globe size={18} className="text-blue-400 shrink-0"/>}
                                                <span className="text-sm text-white truncate" title={doc.name}>{doc.name}</span>
                                            </div>
                                            <button type="button" onClick={() => handleDeleteDoc(doc.id)} className="text-white0 hover:text-red-400 transition-colors p-1 shrink-0">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-surface-800">
                    <button type="submit" disabled={isSaving} className="btn-primary w-full md:w-auto min-w-[140px]">
                        <Save size={18} />
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatbotSettings;
