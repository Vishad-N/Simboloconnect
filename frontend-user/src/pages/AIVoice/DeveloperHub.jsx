import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const useToast = () => {
    const [toasts, setToasts] = useState([]);
    const addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    };
    return { toasts, toast: { success: (m) => addToast(m, 'success'), error: (m) => addToast(m, 'error') } };
};

const ToastContainer = ({ toasts }) => (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
            <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse ${
                t.type === 'success' ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'
            }`}>
                {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
        ))}
    </div>
);

const VoiceDeveloperHub = () => {
    const [apiToken, setApiToken] = useState('');
    const [selectedDevProvider, setSelectedDevProvider] = useState('vapi');
    const [showApiToken, setShowApiToken] = useState(false);
    const { toasts, toast } = useToast();

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
                const accountRes = await axios.get(`${API}/api/account`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setApiToken(accountRes.data?.apiToken || '');
            } catch (err) {
                console.error(err);
            }
        };
        fetchToken();
    }, []);

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied successfully!`);
    };

    const webhookUrl = `${window.location.origin}/api/webhooks/voice/action/send-link`;

    const providerConfigs = {
        vapi: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                message: {
                    toolCalls: [
                        {
                            function: {
                                name: "send_demo_link",
                                arguments: {
                                    phone: "+919876543210",
                                    demoType: "pricing"
                                }
                            }
                        }
                    ],
                    call: { id: "vapi-call-12345" }
                }
            },
            instructions: "Create a new Custom Tool in your Vapi Dashboard. Paste the Webhook URL, set the Method to POST, and add the Authorization header. Define properties 'phone' and 'demoType' inside the tool arguments so they are sent dynamically."
        },
        bland: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                call_id: "bland-call-998877",
                phone: "+919876543210",
                arguments: { demoType: "saas", message: "Welcome to our platform!" }
            },
            instructions: "In Bland AI, add a Webhook Tool under your agent's Tools tab. Set the webhook URL, select POST, and specify the Authorization header. Bind the phone, call_id, and demoType variables inside the tool payload."
        },
        retell: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                call_id: "retell-call-112233",
                toolCall: {
                    function: { arguments: { phone: "+919876543210", demoType: "chatbot" } }
                }
            },
            instructions: "In Retell AI, define a Custom Webhook Tool. Map the endpoint URL to our Webhook URL, set the Headers, and Retell will automatically post the toolCall arguments when the agent triggers it."
        },
        elevenlabs: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                callId: "elevenlabs-call-334455",
                arguments: { phone: "+919876543210", demoType: "ai_voice" }
            },
            instructions: "In ElevenLabs, create a Webhook Agent Tool. Specify the Webhook URL and the Headers. Define the 'phone' and 'demoType' parameters inside ElevenLabs so they are passed to the arguments object."
        },
        twilio: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                CallSid: "twilio-sid-556677",
                phone: "+919876543210",
                demoType: "automation"
            },
            instructions: "For Twilio Voice or Twilio Webhooks, hook your status callback or TwiML Gather action to our Webhook URL. Ensure your request passes the CallSid and demographic info."
        },
        custom: {
            url: webhookUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken || '<YOUR_API_TOKEN>'}`
            },
            payload: {
                customerPhone: "+919876543210",
                callId: "custom-call-9900",
                demoType: "pricing",
                message: "Here is your customized saas pricing link: {{link}}",
                source: "custom_dialer"
            },
            instructions: "For any custom voice dialer or future provider, trigger our webhook by sending a POST request to the Webhook URL with your client API Token in the Authorization header. You can send any JSON body that includes a customer phone number, call ID, and demoType!"
        }
    };

    return (
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100%', paddingBottom: 40 }}>
            <ToastContainer toasts={toasts} />
            
            {/* Hero Header */}
            <div className="border-b border-white/5 bg-surface-900/30" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#eab308,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(234,179,8,.3)' }}>
                    <span className="text-2xl">🔌</span>
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', margin: 0 }}>Developer Hub</h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Dynamic Voice Automation Integrations</p>
                </div>
            </div>

            <div style={{ padding: '32px' }}>
                <div className="space-y-8 animate-fadeIn">
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-purple-500/5 pointer-events-none" />
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">🔌 Dynamic Voice Automation Hub</h3>
                            <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                                Our platform features a completely provider-agnostic automation layer. During active calls, any AI Voice Provider (Vapi, Bland AI, Retell AI, Twilio, ElevenLabs, or your own custom system) can trigger real-time actions—like sending a WhatsApp demo link or payment link—via a simple HTTP POST request.
                            </p>
                        </div>
                    </div>

                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-6">
                        <h4 className="text-lg font-semibold text-teal-400 mb-4">🔑 API Authentication & Endpoint</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Universal Webhook URL</label>
                                <div className="flex gap-2">
                                    <input type="text" readOnly value={webhookUrl} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-teal-300 font-mono focus:outline-none" />
                                    <button onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors shrink-0">📋 Copy</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Your Platform API Token (Bearer)</label>
                                <div className="flex gap-2">
                                    <input type={showApiToken ? "text" : "password"} readOnly value={apiToken || 'No API Token configured. Generate one under Profile / Settings.'} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-teal-300 font-mono focus:outline-none" />
                                    <button onClick={() => setShowApiToken(!showApiToken)} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors shrink-0">{showApiToken ? '👁️ Hide' : '👁️ Show'}</button>
                                    <button disabled={!apiToken} onClick={() => copyToClipboard(apiToken, 'API Token')} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 shrink-0">📋 Copy</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-surface-900 border border-white/5 rounded-2xl p-6">
                                <h4 className="text-base font-bold text-white mb-4">🎯 AI Voice Provider Setup Guides</h4>
                                
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {Object.keys(providerConfigs).map(pKey => (
                                        <button
                                            key={pKey}
                                            onClick={() => setSelectedDevProvider(pKey)}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${selectedDevProvider === pKey ? 'bg-brand-500 text-surface-950 shadow-[0_4px_14px_rgba(37,211,102,0.35)] border-none' : 'bg-surface-900 text-surface-400 border border-surface-700 hover:border-brand-500 hover:text-white hover:bg-surface-800'}`}
                                        >
                                            {pKey}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ padding:16, background:'#f0fdf5', borderRadius:12, border:'1px solid #cde9d8' }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#25D366', boxShadow:'0 0 6px #25D366', display:'inline-block' }} />
                                        <span style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', color:'#128C7E', letterSpacing:'0.08em' }}>{selectedDevProvider} Integration steps</span>
                                    </div>
                                    <p style={{ fontSize:13, color:'#0b1e12', lineHeight:1.7, fontWeight:600 }}>{providerConfigs[selectedDevProvider].instructions}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 flex flex-col h-full">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                                <span>📄 PAYLOAD PREVIEW</span>
                                <span className="bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">JSON</span>
                            </h4>
                            <div className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl p-4 overflow-auto relative group">
                                <button onClick={() => copyToClipboard(JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2), 'Payload schema')} className="absolute top-3 right-3 text-[10px] uppercase font-bold tracking-wider bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</button>
                                <pre className="text-xs font-mono text-blue-300 leading-relaxed m-0">
                                    <span className="text-gray-500">// Example payload from {selectedDevProvider}</span><br/><br/>
                                    {JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2).replace(/"(.*?)":/g, '<span class="text-teal-300">"$1"</span>:').replace(/"(.*)"(?=[,\n])/g, '<span class="text-blue-300">"$1"</span>')}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceDeveloperHub;
