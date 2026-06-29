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
                t.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-red-500 text-white'
            }`}>
                {t.type === 'success' ? '✅' : '❌'} {t.msg}
            </div>
        ))}
    </div>
);

const FreshDeveloperHub = () => {
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
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            <ToastContainer toasts={toasts} />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="bg-gradient-to-br from-indigo-600 to-purple-600 text-transparent bg-clip-text">Developer Hub</span>
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Dynamic Voice Automation Integrations</p>
                </div>
            </div>

            <div className="space-y-8 animate-fadeIn">
                <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 pointer-events-none" />
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">🔌 Dynamic Voice Automation Hub</h3>
                        <p className="text-sm text-gray-600 mt-3 max-w-3xl leading-relaxed">
                            Our platform features a completely provider-agnostic automation layer. During active calls, any AI Voice Provider (Vapi, Bland AI, Retell AI, Twilio, ElevenLabs, or your own custom system) can trigger real-time actions—like sending a WhatsApp demo link or payment link—via a simple HTTP POST request.
                        </p>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8">
                    <h4 className="text-lg font-bold text-gray-900 mb-6">🔑 API Authentication & Endpoint</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="text-sm text-gray-700 font-semibold mb-2 block">Universal Webhook URL</label>
                            <div className="flex gap-2">
                                <input type="text" readOnly value={webhookUrl} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <button onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')} className="px-5 py-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-colors shadow-sm shrink-0">📋 Copy</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-gray-700 font-semibold mb-2 block">Your Platform API Token (Bearer)</label>
                            <div className="flex gap-2">
                                <input type={showApiToken ? "text" : "password"} readOnly value={apiToken || 'No API Token configured. Generate one under Profile / Settings.'} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <button onClick={() => setShowApiToken(!showApiToken)} className="px-4 py-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-colors shadow-sm shrink-0">{showApiToken ? '👁️ Hide' : '👁️ Show'}</button>
                                <button disabled={!apiToken} onClick={() => copyToClipboard(apiToken, 'API Token')} className="px-5 py-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-colors shadow-sm disabled:opacity-50 shrink-0">📋 Copy</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8">
                            <h4 className="text-lg font-bold text-gray-900 mb-6">🎯 AI Voice Provider Setup Guides</h4>
                            
                            <div className="flex flex-wrap gap-3 mb-8">
                                {Object.keys(providerConfigs).map(pKey => (
                                    <button
                                        key={pKey}
                                        onClick={() => setSelectedDevProvider(pKey)}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${selectedDevProvider === pKey ? 'bg-indigo-600 text-white shadow-md border-transparent' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'}`}
                                    >
                                        {pKey}
                                    </button>
                                ))}
                            </div>

                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)] block" />
                                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">{selectedDevProvider} Integration steps</span>
                                </div>
                                <p className="text-sm text-indigo-950/80 leading-relaxed font-medium">{providerConfigs[selectedDevProvider].instructions}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 shadow-sm rounded-3xl p-8 flex flex-col h-full">
                        <h4 className="text-sm font-bold text-gray-900 mb-6 flex items-center justify-between">
                            <span>📄 PAYLOAD PREVIEW</span>
                            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-xs uppercase font-black tracking-wider">JSON</span>
                        </h4>
                        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-5 overflow-auto relative group">
                            <button onClick={() => copyToClipboard(JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2), 'Payload schema')} className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Copy</button>
                            <pre className="text-[13px] font-mono text-blue-300 leading-relaxed m-0">
                                <span className="text-gray-500">// Example payload from {selectedDevProvider}</span><br/><br/>
                                {JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2).replace(/"(.*?)":/g, '<span class="text-teal-300">"$1"</span>:').replace(/"(.*)"(?=[,\n])/g, '<span class="text-blue-300">"$1"</span>')}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FreshDeveloperHub;
