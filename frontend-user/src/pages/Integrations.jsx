import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plug, Key, Webhook, FileSpreadsheet, Copy, CheckCircle2, RefreshCw, Eye, EyeOff, Save } from 'lucide-react';

const Integrations = () => {
    const [copied, setCopied] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [apiToken, setApiToken] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [webhookSaved, setWebhookSaved] = useState(false);
    const [generating, setGenerating] = useState(false);

    const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

    useEffect(() => {
        // Load token from DB (source of truth)
        const loadToken = async () => {
            try {
                const res = await axios.get(`${API}/api/integrations/api-token`);
                if (res.data.token) {
                    setApiToken(res.data.token);
                    localStorage.setItem('api_token', res.data.token);
                } else {
                    const savedToken = localStorage.getItem('api_token');
                    if (savedToken) setApiToken(savedToken);
                }
            } catch {
                const savedToken = localStorage.getItem('api_token');
                if (savedToken) setApiToken(savedToken);
            }
        };
        loadToken();
        const savedWebhook = localStorage.getItem('webhook_url');
        if (savedWebhook) { setWebhookUrl(savedWebhook); setWebhookSaved(true); }
    }, []);

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(type);
            setTimeout(() => setCopied(''), 2000);
        });
    };

    const generateToken = async () => {
        setGenerating(true);
        try {
            const res = await axios.post(`${API}/api/integrations/api-token/regenerate`);
            const token = res.data.token;
            setApiToken(token);
            localStorage.setItem('api_token', token);
        } catch (err) {
            console.error('Failed to generate API token:', err);
            alert('Failed to generate token. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const saveWebhook = () => {
        if (!webhookUrl) {
            alert('Please enter a webhook URL.');
            return;
        }
        try {
            new URL(webhookUrl);
        } catch {
            alert('Please enter a valid URL (must start with https://)');
            return;
        }
        localStorage.setItem('webhook_url', webhookUrl);
        setWebhookSaved(true);
        setTimeout(() => setWebhookSaved(false), 2000);
    };

    const sheetsScript = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Add a new row with the received data
  sheet.appendRow([
    new Date(),
    data.phone || '',
    data.name || '',
    data.message || '',
    data.status || '',
    data.campaign || ''
  ]);
  
  return ContentService
    .createTextOutput(JSON.stringify({"status": "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput("Webhook is active")
    .setMimeType(ContentService.MimeType.TEXT);
}`;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold font-display text-white flex items-center gap-3">
                    <Plug size={32} className="text-brand-400" /> API & Integrations
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* API Access */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-brand-500/10 rounded-xl">
                            <Key size={24} className="text-brand-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">API Access</h2>
                            <p className="text-sm text-surface-400">Generate tokens to connect external apps.</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-2">Access Token</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type={showToken ? "text" : "password"}
                                    readOnly 
                                    value={apiToken || 'No token generated yet'} 
                                    className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-white font-mono text-sm pr-20"
                                />
                                <button 
                                    onClick={() => setShowToken(!showToken)}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white"
                                >
                                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                <button 
                                    onClick={() => apiToken && handleCopy(apiToken, 'api')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white"
                                    disabled={!apiToken}
                                >
                                    {copied === 'api' ? <CheckCircle2 size={16} className="text-brand-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={generateToken} 
                        disabled={generating}
                        className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
                    >
                        {generating ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                        {generating ? 'Generating...' : apiToken ? 'Regenerate Token' : 'Generate New Token'}
                    </button>
                </div>

                {/* Webhook */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Webhook size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Webhook Configuration</h2>
                            <p className="text-sm text-surface-400">Receive real-time event notifications.</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-2">Webhook URL</label>
                        <input 
                            type="url" 
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                            placeholder="https://your-server.com/webhook" 
                            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-brand-500 text-sm"
                        />
                    </div>
                    <button 
                        onClick={saveWebhook}
                        className="btn-primary w-full mt-2 bg-purple-500 hover:bg-purple-600 shadow-purple-500/25 flex items-center justify-center gap-2"
                    >
                        {webhookSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {webhookSaved ? 'Saved!' : 'Save Webhook'}
                    </button>
                </div>

                {/* Google Sheets Integration */}
                <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-4 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-500/10 rounded-xl">
                            <FileSpreadsheet size={24} className="text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Google Sheets Integration</h2>
                            <p className="text-sm text-surface-400">Automatically sync contacts and messages to Google Sheets using Apps Script.</p>
                        </div>
                    </div>
                    
                    <div className="bg-surface-900 rounded-xl p-4 border border-surface-800 relative">
                        <pre className="text-xs text-surface-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
{sheetsScript}
                        </pre>
                        <button 
                            onClick={() => handleCopy(sheetsScript, 'sheets')}
                            className="absolute top-3 right-3 p-2 bg-surface-800 rounded-lg hover:bg-surface-700 text-surface-300 transition-colors flex items-center gap-1.5 text-xs"
                            title="Copy Script"
                        >
                            {copied === 'sheets' ? <><CheckCircle2 size={14} className="text-brand-400" /> Copied!</> : <><Copy size={14} /> Copy</>}
                        </button>
                    </div>

                    <div className="bg-surface-800 rounded-xl p-4 text-sm text-surface-400">
                        <p className="font-medium text-surface-300 mb-2">Setup Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs">
                            <li>Open Google Sheets → Extensions → Apps Script</li>
                            <li>Paste the script above and save</li>
                            <li>Click Deploy → New Deployment → Web App</li>
                            <li>Set "Who has access" to "Anyone" and click Deploy</li>
                            <li>Copy the Web App URL and paste it in the Webhook URL above</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Integrations;
