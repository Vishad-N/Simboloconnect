import React from 'react';
import { Webhook, Link, KeyRound } from 'lucide-react';

const WebhookPage = () => {
    // In a real application, the ngrok/localtunnel URL might be fetched from the backend.
    // For this preview, we display the generated localtunnel URL.
    const cleanHostname = window.location.hostname.replace(/^www\./, '');
    const webhookUrl = `https://${cleanHostname}/api/webhooks`;
    const verifyToken = cleanHostname;

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
    };

    return (
        <div className="max-w-3xl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Webhook Configuration</h1>
                <p className="text-surface-400">Configure these details in your Meta App Dashboard to receive live messages and status updates.</p>
            </header>

            <div className="glass-panel p-8 space-y-8">
                <div className="flex items-center gap-3 pb-4 border-b border-surface-700">
                    <div className="p-3 bg-[#25D366]/10 text-[#25D366] rounded-xl">
                        <Webhook size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Meta Webhook Details</h2>
                        <p className="text-sm text-surface-400">Copy these values exactly to your WhatsApp webhook settings.</p>
                    </div>
                </div>

                <div className="space-y-6 pt-2">
                    <div className="bg-[#f0fdf5] p-4 rounded-xl border border-[#25D366]/40">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300">
                                <Link size={16} className="text-[#25D366]" />
                                Callback URL
                            </label>
                            <button
                                onClick={() => copyToClipboard(webhookUrl)}
                                className="text-xs text-[#25D366] hover:text-[#1da851] transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="bg-white p-3 rounded-lg text-[#0b1e12] font-mono text-sm border border-[#25D366]/20 break-all">
                            {webhookUrl}
                        </div>
                    </div>

                    <div className="bg-[#f0fdf5] p-4 rounded-xl border border-[#25D366]/40">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300">
                                <KeyRound size={16} className="text-[#25D366]" />
                                Verify Token
                            </label>
                            <button
                                onClick={() => copyToClipboard(verifyToken)}
                                className="text-xs text-[#25D366] hover:text-[#1da851] transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="bg-white p-3 rounded-lg text-[#0b1e12] font-mono text-sm border border-[#25D366]/20">
                            {verifyToken}
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-surface-700 text-sm text-surface-400">
                    <p><strong>Note:</strong> Make sure to subscribe to the `messages` field in the Meta Webhooks dashboard after verifying.</p>
                </div>
            </div>
        </div>
    );
};

export default WebhookPage;
