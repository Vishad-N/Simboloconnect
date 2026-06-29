import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Key, Webhook, Copy, CheckCircle2, RefreshCw, Eye, EyeOff, Save,
  Globe, Plug, Shield, Zap, AlertTriangle, Code, ExternalLink,
  Link, Server, Terminal, ChevronRight, Info, RotateCcw
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

export default function ApiWebhook() {
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState('api');

  const panelWebhookUrl = `${API}/webhook/inbound`;
  const baseUrl = API;

  useEffect(() => {
    // Load token from DB (source of truth) with localStorage as fallback
    const loadToken = async () => {
      try {
        const res = await axios.get(`${API}/api/integrations/api-token`);
        if (res.data.token) {
          setApiToken(res.data.token);
          localStorage.setItem('api_token', res.data.token);
        } else {
          // No token in DB yet — check localStorage (pre-migration)
          const t = localStorage.getItem('api_token');
          if (t) setApiToken(t);
        }
      } catch (err) {
        // Fallback to localStorage if backend call fails
        const t = localStorage.getItem('api_token');
        if (t) setApiToken(t);
        console.error('Failed to load API token from backend:', err);
      }
    };
    loadToken();

    const loadWebhookSettings = async () => {
      try {
        const res = await axios.get(`${API}/api/integrations/webhook`);
        if (res.data) {
          setWebhookUrl(res.data.url || '');
          setWebhookEnabled(!!res.data.enabled);
          localStorage.setItem('webhook_url', res.data.url || '');
          localStorage.setItem('webhook_enabled', String(!!res.data.enabled));
        }
      } catch (err) {
        console.error("Error loading webhook settings from backend:", err);
        const w = localStorage.getItem('webhook_url');
        const we = localStorage.getItem('webhook_enabled');
        if (w) setWebhookUrl(w);
        if (we) setWebhookEnabled(we === 'true');
      }
    };
    loadWebhookSettings();
  }, []);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const generateToken = async () => {
    setGenerating(true);
    try {
      // Generate token via backend — stores it in DB so auth middleware can validate it
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

  const saveWebhook = async () => {
    if (webhookEnabled && !webhookUrl) { alert('Please enter a webhook URL'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/integrations/webhook`, { url: webhookUrl, enabled: webhookEnabled });
      localStorage.setItem('webhook_url', webhookUrl);
      localStorage.setItem('webhook_enabled', String(webhookEnabled));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error saving webhook settings to backend:", err);
      alert("Failed to save webhook settings to backend. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'api',     label: 'API Access',     icon: Key },
    { id: 'webhook', label: 'Webhook',        icon: Webhook },
    { id: 'connect', label: 'Connect Platform', icon: Plug },
  ];

  const samplePayload = `{
  "contact": {
    "status": "existing/updated/new",
    "phone_number": "XXXXXXXXXX",
    "uid": "XXXXXXXXXX",
    "first_name": "XXXXXXXXXX",
    "email": "XXXX@XXXXXXXXXX.com",
    "country": "XXXX"
  },
  "message": {
    "whatsapp_business_phone_number_id": "XXXXXXXXXX",
    "whatsapp_message_id": "wamid.XXXXXXXXXX",
    "body": null,
    "status": null,
    "media": {
      "type": "image",
      "link": "link to media",
      "mime_type": "image/jpeg"
    }
  },
  "whatsapp_webhook_payload": {
    // Full Meta WhatsApp webhook data
  }
}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-purple-500/15 to-brand-500/5 rounded-2xl border border-purple-500/20">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Plug size={24} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">API Access & Webhook</h1>
          <p className="text-surface-400 text-sm">Connect external platforms using your panel's WhatsApp API — no direct Meta access needed</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">
          <span className="font-semibold">How it works:</span> Your panel acts as a WhatsApp API bridge.
          External platforms connect to <strong>your panel's API</strong> using your token — not directly to Meta.
          This means faster setup, no WABA approval needed for integrations.
        </p>
      </div>

      {/* Tabs */}
      <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
        <div className="flex border-b border-surface-700 bg-surface-800/50">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                  : 'border-transparent text-surface-400 hover:text-white hover:bg-surface-800/40'
              }`}>
              <tab.icon size={15} />{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── API ACCESS ── */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Your Panel API Token</h3>
                <p className="text-sm text-surface-400 mb-4">Use this token to authenticate API calls to your WhatsApp panel from any external platform.</p>

                <label className="block text-sm font-medium text-surface-300 mb-2">Access Token</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={showToken ? 'text' : 'password'} readOnly
                      value={apiToken || 'No token generated yet'}
                      className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white font-mono text-sm pr-20 focus:outline-none" />
                    <button onClick={() => setShowToken(!showToken)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => apiToken && copy(apiToken, 'token')} disabled={!apiToken}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-400">
                      {copied === 'token' ? <CheckCircle2 size={16} className="text-brand-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={generateToken} disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all">
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                {generating ? 'Generating...' : apiToken ? 'Regenerate Token' : 'Generate New Token'}
              </button>

              {/* API Base URL */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Panel API Base URL</label>
                <div className="flex items-center gap-2 p-3 bg-surface-800 rounded-xl border border-surface-600">
                  <Server size={14} className="text-surface-500 flex-shrink-0" />
                  <code className="text-sm text-brand-400 font-mono flex-1">{baseUrl}/api/</code>
                  <button onClick={() => copy(`${baseUrl}/api/`, 'baseurl')}
                    className="text-surface-400 hover:text-brand-400">
                    {copied === 'baseurl' ? <CheckCircle2 size={14} className="text-brand-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Quick Endpoints */}
              <div>
                <p className="text-sm font-medium text-surface-300 mb-3">Key Endpoints</p>
                <div className="space-y-2">
                  {[
                    { method: 'POST', path: '/api/chat/send', desc: 'Send WhatsApp message' },
                    { method: 'GET',  path: '/api/chat/contacts', desc: 'List all contacts' },
                    { method: 'POST', path: '/api/campaigns/send', desc: 'Trigger a campaign' },
                    { method: 'GET',  path: '/api/templates', desc: 'Get all templates' },
                  ].map(ep => (
                    <div key={ep.path} className="flex items-center gap-3 p-3 bg-surface-800/60 rounded-xl border border-surface-700">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ep.method === 'POST' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{ep.method}</span>
                      <code className="text-xs font-mono text-surface-300 flex-1">{ep.path}</code>
                      <span className="text-xs text-surface-500">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── WEBHOOK ── */}
          {activeTab === 'webhook' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Outgoing Webhook</h3>
                <p className="text-sm text-surface-400 mb-4">When a WhatsApp message is received, your panel will forward the payload to this URL via POST.</p>
              </div>

              {/* Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-800/60 rounded-xl border border-surface-700">
                <div>
                  <p className="text-sm font-semibold text-white">Enable Webhook Forwarding</p>
                  <p className="text-xs text-surface-400 mt-0.5">Forward all inbound messages to your endpoint</p>
                </div>
                <button onClick={() => setWebhookEnabled(!webhookEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${webhookEnabled ? 'bg-brand-500' : 'bg-surface-600'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${webhookEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">Webhook Endpoint URL</label>
                <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50" />
              </div>

              {/* Sample Payload */}
              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">Example Webhook Response</p>
                <div className="relative bg-surface-950 rounded-xl border border-surface-700 p-4">
                  <pre className="text-xs text-surface-300 font-mono overflow-x-auto whitespace-pre leading-relaxed">{samplePayload}</pre>
                  <button onClick={() => copy(samplePayload, 'payload')}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 rounded-lg text-xs text-surface-300 transition-colors">
                    {copied === 'payload' ? <><CheckCircle2 size={12} className="text-brand-400" /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
              </div>

              <button onClick={saveWebhook} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-all">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Webhook'}
              </button>
            </div>
          )}

          {/* ── CONNECT PLATFORM ── */}
          {activeTab === 'connect' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Connect External Platforms</h3>
                <p className="text-sm text-surface-400 mb-4">
                  Use your panel's API token to integrate WhatsApp messaging into any platform.
                  No direct Meta WABA access required — your panel proxies all requests.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'Zapier', icon: '⚡', desc: 'Connect 5000+ apps with no-code automation', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
                  { name: 'Make (Integromat)', icon: '🔄', desc: 'Visual workflow automation platform', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                  { name: 'n8n', icon: '🔧', desc: 'Open-source self-hosted automation', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                  { name: 'Custom App', icon: '💻', desc: 'Any platform via REST API + token', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
                  { name: 'Pabbly Connect', icon: '🔗', desc: 'Affordable automation for Indian businesses', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                  { name: 'CRM Systems', icon: '🏢', desc: 'Salesforce, HubSpot, Zoho via REST', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
                ].map(p => (
                  <div key={p.name} className={`flex items-start gap-3 p-4 rounded-xl border ${p.bg} transition-all hover:scale-[1.01]`}>
                    <span className="text-2xl leading-none">{p.icon}</span>
                    <div>
                      <p className={`text-sm font-bold ${p.color}`}>{p.name}</p>
                      <p className="text-xs text-surface-400 mt-0.5">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Auth snippet */}
              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">Authentication Header</p>
                <div className="relative bg-surface-950 rounded-xl border border-surface-700 p-4">
                  <pre className="text-xs text-brand-400 font-mono">{`Authorization: Bearer ${apiToken || 'YOUR_API_TOKEN'}`}</pre>
                  <button onClick={() => copy(`Authorization: Bearer ${apiToken}`, 'auth')}
                    className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-surface-800 rounded-lg text-xs text-surface-300">
                    {copied === 'auth' ? <CheckCircle2 size={11} className="text-brand-400" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
