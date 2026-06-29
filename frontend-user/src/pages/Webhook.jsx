import React, { useState } from 'react';
import { Webhook, Link as LinkIcon, KeyRound, CheckCircle2, Copy, AlertCircle } from 'lucide-react';

const WebhookPage = () => {
    const [copiedField, setCopiedField] = useState(null);
    const cleanHostname = window.location.hostname.replace(/^www\./, '');
    const webhookUrl = `https://${cleanHostname}/api/webhooks`;
    const verifyToken = cleanHostname;

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <header className="mb-10 pb-8 border-b border-white/5">
                <div className="flex items-center gap-4 mb-2">
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #25D366, #00b894)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,.3)' }}>
                        <Webhook color="white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white m-0 tracking-tight">
                            Webhook Configuration
                        </h1>
                        <p className="text-sm font-medium mt-1" style={{ color: '#94a3b8' }}>Connect your Meta App Dashboard to receive real-time messages.</p>
                    </div>
                </div>
            </header>

            <div className="rounded-2xl p-8 overflow-hidden relative" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="relative z-10 flex items-center gap-4 pb-6 mb-6 border-b border-white/5">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)' }}>
                        <Webhook size={24} color="#25D366" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Meta Webhook Details</h2>
                        <p className="text-sm" style={{ color: '#64748b' }}>Copy these exact values into your WhatsApp webhook settings.</p>
                    </div>
                </div>

                <div className="space-y-8 pt-2 relative z-10">
                    {/* Callback URL Field */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                                <LinkIcon size={16} color="#25D366" />
                                Callback URL
                            </label>
                            <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366' }}>Required</span>
                        </div>
                        <div className="flex items-stretch group rounded-xl overflow-hidden transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a' }}>
                            <div className="flex-1 p-4 font-mono text-sm flex items-center text-white overflow-x-auto">
                                {webhookUrl}
                            </div>
                            <button
                                onClick={() => copyToClipboard(webhookUrl, 'url')}
                                className="px-6 flex items-center justify-center gap-2 font-bold transition-all border-l"
                                style={{ 
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    background: copiedField === 'url' ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.02)',
                                    color: copiedField === 'url' ? '#25D366' : '#94a3b8'
                                }}
                            >
                                {copiedField === 'url' ? <><CheckCircle2 size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                            </button>
                        </div>
                    </div>

                    {/* Verify Token Field */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                                <KeyRound size={16} color="#25D366" />
                                Verify Token
                            </label>
                            <span className="text-xs font-bold px-2 py-1 rounded" style={{ background: 'rgba(37,211,102,0.1)', color: '#25D366' }}>Required</span>
                        </div>
                        <div className="flex items-stretch group rounded-xl overflow-hidden transition-all" style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a' }}>
                            <div className="flex-1 p-4 font-mono text-sm flex items-center text-white">
                                {verifyToken}
                            </div>
                            <button
                                onClick={() => copyToClipboard(verifyToken, 'token')}
                                className="px-6 flex items-center justify-center gap-2 font-bold transition-all border-l"
                                style={{ 
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    background: copiedField === 'token' ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.02)',
                                    color: copiedField === 'token' ? '#25D366' : '#94a3b8'
                                }}
                            >
                                {copiedField === 'token' ? <><CheckCircle2 size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t relative z-10 flex items-start gap-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="p-2 rounded-lg shrink-0 mt-0.5" style={{ background: 'rgba(37,211,102,0.1)' }}>
                        <AlertCircle size={20} color="#25D366" />
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-1">Important Step</h4>
                        <p className="text-sm leading-relaxed" style={{ color: '#64748b' }}>
                            After clicking "Verify and Save" in your Meta Dashboard, ensure you click the <strong>"Manage"</strong> button next to Webhooks and subscribe to the <code className="px-1.5 py-0.5 rounded mx-1" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>messages</code> field. This is required to receive incoming messages.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebhookPage;
