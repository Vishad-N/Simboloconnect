import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

// Inline toast system (no external dep needed)
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

const StatusBadge = ({ status }) => {
    const colors = {
        COMPLETED: 'bg-green-500/20 text-green-400 border border-green-500/30',
        INITIATED: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        FAILED: 'bg-red-500/20 text-red-400 border border-red-500/30',
        CANCELLED: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}>
            {status}
        </span>
    );
};

const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.36a16 16 0 0 0 6.08 6.08l1.21-1.21a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
);

const AiVoiceCalling = () => {
    const [providers, setProviders] = useState([]);
    const [calls, setCalls] = useState([]);
    const [configs, setConfigs] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [apiToken, setApiToken] = useState('');
    const [selectedDevProvider, setSelectedDevProvider] = useState('vapi');
    const [showApiToken, setShowApiToken] = useState(false);
    const { toasts, toast } = useToast();

    // Test Call states
    const [testPhones, setTestPhones] = useState({});
    const [testingId, setTestingId] = useState(null);
    const [selectedCall, setSelectedCall] = useState(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [provRes, callRes, accountRes] = await Promise.allSettled([
                axios.get(`${API}/api/voice/providers`),
                axios.get(`${API}/api/voice/calls`),
                axios.get(`${API}/api/account`),
            ]);
            if (provRes.status === 'fulfilled') {
                const data = provRes.value.data || [];
                setProviders(data);
                
                // Pre-populate input values from user configuration on refresh or load
                const initialConfigs = {};
                data.forEach(p => {
                    initialConfigs[p.id] = {
                        apiKey: '',
                        agentId: p.userConfig?.agentId || '',
                        voiceId: p.userConfig?.voiceId || '',
                        active: p.userConfig ? (p.userConfig.active ?? true) : false
                    };
                });
                setConfigs(prev => ({ ...initialConfigs, ...prev }));
            }
            if (callRes.status === 'fulfilled') setCalls(callRes.value.data || []);
            if (accountRes.status === 'fulfilled') setApiToken(accountRes.value.data?.apiToken || '');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const saveConfig = async (providerId) => {
        const cfg = configs[providerId] || {};
        const prov = providers.find(p => p.id === providerId);
        if (!cfg.apiKey && !prov?.userConfig?.apiKeyConfigured) {
            return toast.error('API Key is required');
        }
        setSavingId(providerId);
        try {
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, cfg);
            toast.success('Configuration saved securely!');
            // Refresh to update userConfig status in state
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save configuration');
        } finally {
            setSavingId(null);
        }
    };

    const triggerTestCall = async (providerId) => {
        const phone = testPhones[providerId];
        if (!phone) return toast.error('Please enter a phone number to test');
        setTestingId(providerId);
        try {
            await axios.post(`${API}/api/voice/providers/${providerId}/test-call`, { phone });
            toast.success('Test call placed successfully!');
            fetchAll(); // Refresh call history
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to place test call');
        } finally {
            setTestingId(null);
        }
    };

    const simulateCallCompletion = async (callId) => {
        try {
            await axios.post(`${API}/api/voice/calls/${callId}/simulate-complete`);
            toast.success('Simulated call completion successfully!');
            fetchAll();
        } catch (err) {
            toast.error('Failed to complete simulated call');
        }
    };

    const deleteConfig = async (providerId) => {
        if (!window.confirm('Are you sure you want to remove these credentials?')) return;
        setSavingId(providerId);
        try {
            await axios.delete(`${API}/api/voice/providers/${providerId}/config`);
            toast.success('Configuration removed');
            updateConfig(providerId, 'apiKey', '');
            updateConfig(providerId, 'agentId', '');
            updateConfig(providerId, 'voiceId', '');
            fetchAll();
        } catch (err) {
            toast.error('Failed to remove configuration');
        } finally {
            setSavingId(null);
        }
    };

    const toggleActive = async (providerId, currentActive) => {
        const prov = providers.find(p => p.id === providerId);
        const newValue = !currentActive;
        
        // If not configured in backend yet, just update local state
        if (!prov?.userConfig) {
            updateConfig(providerId, 'active', newValue);
            return;
        }

        updateConfig(providerId, 'active', newValue);
        try {
            const cfg = configs[providerId] || {};
            await axios.post(`${API}/api/voice/providers/${providerId}/config`, { ...cfg, active: newValue });
            toast.success(`Provider ${newValue ? 'enabled' : 'disabled'} for calls`);
            fetchAll();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to toggle status');
            updateConfig(providerId, 'active', currentActive);
        }
    };

    const updateConfig = (providerId, field, value) => {
        setConfigs(prev => ({ ...prev, [providerId]: { ...prev[providerId], [field]: value } }));
    };

    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => ['COMPLETED', 'SUCCESS', 'completed', 'success'].includes(c.status)).length;
    const totalSeconds = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalSeconds / totalCalls) : 0;
    const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;
    const callingMinutes = Math.round(totalSeconds / 60);

    const tabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'providers', label: '⚙️ Providers' },
        { id: 'history', label: '📞 Call History' },
        { id: 'devhub', label: '🔌 Developer Hub' },
    ];

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
                    call: {
                        id: "vapi-call-12345"
                    }
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
                arguments: {
                    demoType: "saas",
                    message: "Welcome to our platform!"
                }
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
                    function: {
                        arguments: {
                            phone: "+919876543210",
                            demoType: "chatbot"
                        }
                    }
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
                arguments: {
                    phone: "+919876543210",
                    demoType: "ai_voice"
                }
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
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#f3fbf6', color: '#0b1e12', minHeight: '100%' }}>
            <style>{`
              .av-wrap { background:#f3fbf6!important; color:#0b1e12!important; }
              .av-wrap * { color:inherit; }
              /* Hero header */
              .av-hero { background: linear-gradient(135deg, #f0fdf5 0%, #e8f5ee 100%)!important; border-bottom:1px solid #cde9d8!important; }
              /* Stat cards */
              .av-card { background:#ffffff!important; border:1px solid #cde9d8!important; border-radius:16px; box-shadow:0 2px 12px rgba(37,211,102,.06); }
              .av-card:hover { border-color:#25D366!important; box-shadow:0 8px 24px rgba(37,211,102,.12)!important; }
              .av-card .stat-val { color:#0b1e12!important; font-weight:900; }
              .av-card .stat-lbl { color:#4d7a62!important; }
              /* Tabs */
              .av-tabs-wrap { background:#ffffff!important; border:1px solid #cde9d8!important; }
              .av-tab-active { background:linear-gradient(135deg,#25D366,#00df6a)!important; color:#ffffff!important; }
              .av-tab-inactive { color:#4d7a62!important; }
              .av-tab-inactive:hover { color:#0b1e12!important; background:#f0fdf5!important; }
              /* Section cards */
              .av-sec { background:#ffffff!important; border:1px solid #cde9d8!important; border-radius:16px; box-shadow:0 2px 12px rgba(37,211,102,.06); }
              /* Step cards */
              .av-step { background:#f0fdf5!important; border:1px solid #cde9d8!important; border-radius:12px; }
              /* Input fields */
              .av-input { background:#f3fbf6!important; border:1.5px solid #cde9d8!important; color:#0b1e12!important; border-radius:10px; padding:10px 14px; font-size:13px; width:100%; outline:none; }
              .av-input:focus { border-color:#25D366!important; box-shadow:0 0 0 3px rgba(37,211,102,.12)!important; background:#ffffff!important; }
              .av-input::placeholder { color:#7aad8e!important; }
              /* Labels */
              .av-label { color:#4d7a62!important; font-size:12px; font-weight:600; margin-bottom:6px; display:block; }
              /* Buttons */
              .av-btn-primary { background:linear-gradient(135deg,#25D366,#00df6a)!important; color:#ffffff!important; border:none; border-radius:10px; padding:10px 20px; font-weight:700; cursor:pointer; transition:all .2s; }
              .av-btn-primary:hover { box-shadow:0 6px 18px rgba(37,211,102,.3)!important; }
              .av-btn-sec { background:#ffffff!important; border:1.5px solid #cde9d8!important; color:#128C7E!important; border-radius:10px; padding:8px 16px; font-weight:600; cursor:pointer; }
              .av-btn-sec:hover { border-color:#25D366!important; background:#f0fdf5!important; }
              /* Code/mono blocks */
              .av-mono { background:#f0fdf5!important; border:1px solid #cde9d8!important; color:#128C7E!important; font-family:monospace; border-radius:10px; padding:10px 14px; font-size:12px; }
              /* Table */
              .av-table th { background:#f3fbf6!important; color:#4d7a62!important; border-color:#cde9d8!important; }
              .av-table td { color:#0b1e12!important; border-color:#e8f5ee!important; }
              .av-table tr:hover td { background:#f0fdf5!important; }
              /* Safety rail section */
              .av-safety { background:linear-gradient(135deg,rgba(37,211,102,.08),rgba(18,140,126,.05))!important; border:1px solid rgba(37,211,102,.2)!important; border-radius:16px; }
              .av-safety-check { color:#128C7E!important; }
              /* Badges */
              .av-badge-green { background:rgba(37,211,102,.12)!important; color:#128C7E!important; border:1px solid rgba(37,211,102,.2)!important; }
              .av-badge-red { background:rgba(220,38,38,.08)!important; color:#dc2626!important; border:1px solid rgba(220,38,38,.15)!important; }
              .av-badge-yellow { background:rgba(245,158,11,.1)!important; color:#b45309!important; }
              .av-badge-blue { background:rgba(37,99,235,.08)!important; color:#1d4ed8!important; }
            `}</style>
            <ToastContainer toasts={toasts} />

            {/* Hero Header */}
            <div className="av-hero" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#25D366,#00b894)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,.3)' }}>
                        <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: 'none', stroke: 'white', strokeWidth: 2 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.36a16 16 0 0 0 6.08 6.08l1.21-1.21a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0b1e12', margin: 0 }}>AI Voice Calling</h1>
                        <p style={{ fontSize: 13, color: '#4d7a62', margin: '2px 0 0' }}>Automate customer calls with AI — configure providers &amp; monitor activity</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', boxShadow: '0 0 6px #25D366' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>System Active</span>
                </div>
            </div>

            <div style={{ padding: '24px 32px' }}>
                {/* Stats Cards */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:14, marginBottom:28 }}>
                    {[
                        { label: 'Total Calls', value: totalCalls, icon: '📞' },
                        { label: 'Completed', value: completedCalls, icon: '✅' },
                        { label: 'Success Rate', value: `${successRate}%`, icon: '🎯' },
                        { label: 'Calling Minutes', value: `${callingMinutes}m`, icon: '🎙️' },
                        { label: 'Total Duration', value: `${totalSeconds}s`, icon: '⏱️' },
                        { label: 'Avg Duration', value: `${avgDuration}s`, icon: '📈' },
                    ].map(stat => (
                        <div key={stat.label} className="av-card" style={{ padding:18, transition:'all .2s' }}
                            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                            onMouseLeave={e=>e.currentTarget.style.transform=''}>
                            <div style={{ fontSize:22, marginBottom:6 }}>{stat.icon}</div>
                            <div className="stat-val" style={{ fontSize:24, fontWeight:900, color:'#0b1e12' }}>{stat.value}</div>
                            <div className="stat-lbl" style={{ fontSize:11, color:'#4d7a62', marginTop:3, fontWeight:600 }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="av-tabs-wrap" style={{ display:'flex', gap:4, padding:4, borderRadius:12, width:'fit-content', marginBottom:24 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={activeTab === tab.id ? 'av-tab-active' : 'av-tab-inactive'}
                            style={{ padding:'8px 20px', borderRadius:9, fontSize:13, fontWeight:700, border:'none', cursor:'pointer', transition:'all .18s' }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                        <div className="av-sec" style={{ padding:24 }}>
                            <h3 style={{ fontSize:16, fontWeight:800, color:'#0b1e12', marginBottom:16 }}>🤖 How AI Voice Calling Works</h3>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                                {[
                                    { step: '1', title: 'Customer Chats', desc: 'Customer interacts with your AI Brain in Live Chat', icon: '💬' },
                                    { step: '2', title: 'AI Detects Intent', desc: 'AI detects urgency, buying signals or escalation request', icon: '🧠' },
                                    { step: '3', title: 'Auto Voice Call', desc: 'AI initiates a voice call using your configured provider', icon: '📞' },
                                ].map(item => (
                                    <div key={item.step} className="av-step" style={{ display:'flex', gap:14, padding:16 }}>
                                        <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(37,211,102,.15)', border:'1px solid rgba(37,211,102,.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'#128C7E', fontWeight:900, fontSize:14, flexShrink:0 }}>{item.step}</div>
                                        <div>
                                            <div style={{ fontSize:20, marginBottom:4 }}>{item.icon}</div>
                                            <div style={{ fontWeight:700, color:'#0b1e12', fontSize:13 }}>{item.title}</div>
                                            <div style={{ fontSize:12, color:'#4d7a62', marginTop:4 }}>{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="av-safety" style={{ padding:20 }}>
                            <h3 style={{ fontWeight:800, color:'#128C7E', marginBottom:14, fontSize:14 }}>🛡️ Enterprise Safety Rails</h3>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                                {['Daily Minute Limits', 'Concurrent Call Limits', 'Abuse Protection', 'Working Hours Mode'].map(feature => (
                                    <div key={feature} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#0b1e12', fontWeight:600 }}>
                                        <div style={{ width:18, height:18, borderRadius:'50%', background:'rgba(37,211,102,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                            <svg style={{ width:10, height:10, stroke:'#25D366', fill:'none' }} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Providers Tab */}
                {activeTab === 'providers' && (
                    <div>
                        {loading ? (
                            <div className="text-center py-16 text-gray-500">Loading providers...</div>
                        ) : providers.length === 0 ? (
                            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
                                <div className="text-5xl mb-4">🔌</div>
                                <div className="text-gray-400 font-medium">No voice providers enabled yet</div>
                                <div className="text-sm text-gray-500 mt-2">Ask your admin to enable providers from the Voice Control Center</div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {providers.map(p => (
                                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-teal-500/30 transition-all">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="font-bold text-lg text-white">{p.name}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${p.sandboxMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {p.sandboxMode ? '🧪 Sandbox' : '🟢 Production'}
                                                </span>
                                            </div>
                                            <div className="text-3xl">
                                                {p.name?.toLowerCase().includes('retell') ? '🔊' : p.name?.toLowerCase().includes('bland') ? '📡' : '🎙️'}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">API Key</label>
                                                <input 
                                                    type="password" 
                                                    placeholder={p.userConfig?.apiKeyConfigured ? "•••••••••••••••• (Saved)" : "Enter your API key..."} 
                                                    value={configs[p.id]?.apiKey || ''} 
                                                    onChange={e => updateConfig(p.id, 'apiKey', e.target.value)} 
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 transition-all" 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">Agent / Voice ID</label>
                                                <input type="text" placeholder="Enter your agent/voice ID..." value={configs[p.id]?.agentId || ''} onChange={e => updateConfig(p.id, 'agentId', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-all" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-400 mb-1 block">From Phone Number / Caller ID</label>
                                                <input type="text" placeholder="e.g. +1234567890 (Required for Retell)" value={configs[p.id]?.voiceId || ''} onChange={e => updateConfig(p.id, 'voiceId', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-all" />
                                            </div>
                                            
                                            {/* Toggle & Buttons */}
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => toggleActive(p.id, configs[p.id]?.active ?? false)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs[p.id]?.active ? 'bg-teal-500' : 'bg-gray-600'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs[p.id]?.active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                    <span className="text-sm font-medium text-gray-300">{configs[p.id]?.active ? 'Enabled' : 'Disabled'}</span>
                                                </div>
                                                <button onClick={() => deleteConfig(p.id)} className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors">
                                                    🗑️ Remove
                                                </button>
                                            </div>

                                            <button onClick={() => saveConfig(p.id)} disabled={savingId === p.id} className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-teal-500/50 text-black font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-teal-500/20 mt-2">
                                                {savingId === p.id ? 'Saving...' : '🔒 Save Configuration'}
                                            </button>

                                            {/* Test Live Outbound Call Section */}
                                            {p.userConfig && (
                                                <div className="pt-4 border-t border-white/5 mt-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-teal-400">🧪 Live Outbound Test</span>
                                                        <span className="text-[10px] text-gray-500 font-mono">Simulate welcome/assistance call</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Phone (+919876543210)" 
                                                            value={testPhones[p.id] || ''} 
                                                            onChange={e => setTestPhones(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-teal-500/50"
                                                        />
                                                        <button 
                                                            onClick={() => triggerTestCall(p.id)}
                                                            disabled={testingId === p.id}
                                                            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 text-black font-bold rounded-lg text-xs transition-all shadow-md flex items-center gap-1 shrink-0"
                                                        >
                                                            {testingId === p.id ? 'Calling...' : '📞 Call Now'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Call History Tab */}
                {activeTab === 'history' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold">Recent AI Voice Calls</h3>
                            <button onClick={fetchAll} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">🔄 Refresh</button>
                        </div>
                        {calls.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-5xl mb-4">📭</div>
                                <div className="text-gray-400 font-medium">No calls yet</div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider">
                                            <th className="px-6 py-3">Contact</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Duration</th>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {calls.map(c => (
                                            <tr key={c.id} className="hover:bg-white/3 transition-colors">
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="font-semibold text-white">{c.contact?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{c.contact?.phone ? `+${c.contact.phone}` : c.contactId}</div>
                                                </td>
                                                <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                                                <td className="px-6 py-4 text-sm text-gray-400">{c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : '-'}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right flex gap-2 justify-end">
                                                    {!['COMPLETED', 'SUCCESS', 'completed', 'success'].includes(c.status) && (
                                                        <button 
                                                            onClick={() => simulateCallCompletion(c.id)} 
                                                            className="text-xs bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 px-2.5 py-1.5 rounded-lg transition-all"
                                                        >
                                                            ⚡ Complete
                                                        </button>
                                                    )}
                                                    <button onClick={() => setSelectedCall(c)} className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded-lg transition-colors">
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Developer Hub Tab */}
                {activeTab === 'devhub' && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* Dev Hub Header Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-purple-500/5 pointer-events-none" />
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">🔌 Dynamic Voice Automation Hub</h3>
                                <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
                                    Our platform features a completely provider-agnostic automation layer. During active calls, any AI Voice Provider (Vapi, Bland AI, Retell AI, Twilio, ElevenLabs, or your own custom system) can trigger real-time actions—like sending a WhatsApp demo link or payment link—via a simple HTTP POST request.
                                </p>
                            </div>
                        </div>

                        {/* Setup Credentials Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <h4 className="text-lg font-semibold text-teal-400 mb-4">🔑 API Authentication & Endpoint</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Universal Webhook URL</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={webhookUrl} 
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-teal-300 font-mono focus:outline-none" 
                                        />
                                        <button 
                                            onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold transition-colors shrink-0"
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Your Platform API Token (Bearer)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type={showApiToken ? "text" : "password"} 
                                            readOnly 
                                            value={apiToken || 'No API Token configured. Generate one under Profile / Settings.'} 
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-teal-300 font-mono focus:outline-none" 
                                        />
                                        <button 
                                            onClick={() => setShowApiToken(!showApiToken)}
                                            className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold transition-colors shrink-0"
                                        >
                                            {showApiToken ? '👁️ Hide' : '👁️ Show'}
                                        </button>
                                        <button 
                                            disabled={!apiToken}
                                            onClick={() => copyToClipboard(apiToken, 'API Token')}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Guides & JSON Schema */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Provider Selection & Instructions */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <h4 style={{ fontSize:15, fontWeight:800, color:'#0b1e12', marginBottom:16 }}>🎯 AI Voice Provider Setup Guides</h4>
                                    
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
                                        {Object.keys(providerConfigs).map(pKey => (
                                            <button
                                                key={pKey}
                                                onClick={() => setSelectedDevProvider(pKey)}
                                                style={{
                                                    padding: '8px 18px',
                                                    borderRadius: 10,
                                                    fontSize: 12,
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.08em',
                                                    border: selectedDevProvider === pKey
                                                        ? 'none'
                                                        : '1.5px solid #cde9d8',
                                                    background: selectedDevProvider === pKey
                                                        ? 'linear-gradient(135deg,#25D366,#00df6a)'
                                                        : '#ffffff',
                                                    color: selectedDevProvider === pKey ? '#ffffff' : '#128C7E',
                                                    boxShadow: selectedDevProvider === pKey
                                                        ? '0 4px 14px rgba(37,211,102,.35)'
                                                        : 'none',
                                                    cursor: 'pointer',
                                                    transition: 'all .18s',
                                                    fontFamily: 'inherit',
                                                }}
                                                onMouseEnter={e => { if(selectedDevProvider !== pKey) { e.currentTarget.style.background='#f0fdf5'; e.currentTarget.style.borderColor='#25D366'; e.currentTarget.style.color='#0b1e12'; }}}
                                                onMouseLeave={e => { if(selectedDevProvider !== pKey) { e.currentTarget.style.background='#ffffff'; e.currentTarget.style.borderColor='#cde9d8'; e.currentTarget.style.color='#128C7E'; }}}
                                            >
                                                {pKey}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ padding:16, background:'#f0fdf5', borderRadius:12, border:'1px solid #cde9d8' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                            <span style={{ width:8, height:8, borderRadius:'50%', background:'#25D366', boxShadow:'0 0 6px #25D366', display:'inline-block' }} />
                                            <span style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', color:'#128C7E', letterSpacing:'0.08em' }}>
                                                {selectedDevProvider} Integration steps
                                            </span>
                                        </div>
                                        <p style={{ fontSize:13, color:'#0b1e12', lineHeight:1.7, fontWeight:600 }}>
                                            {providerConfigs[selectedDevProvider].instructions}
                                        </p>
                                    </div>

                                    {/* Universal Properties Reference Table */}
                                    <div style={{ marginTop:24 }}>
                                        <h5 style={{ fontSize:13, fontWeight:800, color:'#0b1e12', marginBottom:10 }}>📋 Universal Properties Reference</h5>
                                        <div style={{ overflowX:'auto', border:'1px solid #cde9d8', borderRadius:12 }}>
                                            <table className="av-table" style={{ width:'100%', textAlign:'left', fontSize:12, borderCollapse:'collapse' }}>
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider font-bold">
                                                        <th className="px-4 py-3">Property</th>
                                                        <th className="px-4 py-3">Type</th>
                                                        <th className="px-4 py-3">Required</th>
                                                        <th className="px-4 py-3">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300">
                                                    <tr>
                                                        <td className="px-4 py-3 font-mono text-teal-400">customerPhone</td>
                                                        <td className="px-4 py-3">String</td>
                                                        <td className="px-4 py-3 font-semibold text-amber-400">Yes</td>
                                                        <td className="px-4 py-3 text-gray-400">Customer phone number in E.164 format.</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-3 font-mono text-teal-400">callId</td>
                                                        <td className="px-4 py-3">String</td>
                                                        <td className="px-4 py-3 font-semibold text-amber-400">Yes</td>
                                                        <td className="px-4 py-3 text-gray-400">Unique call session identifier from provider.</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-3 font-mono text-teal-400">demoType</td>
                                                        <td className="px-4 py-3">String</td>
                                                        <td className="px-4 py-3 font-semibold text-amber-400">Yes</td>
                                                        <td className="px-4 py-3 text-gray-400">
                                                            Demo Asset requested. Resolves to pricing, saas, reseller, etc.
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-3 font-mono text-teal-400">message</td>
                                                        <td className="px-4 py-3">String</td>
                                                        <td className="px-4 py-3">No</td>
                                                        <td className="px-4 py-3 text-gray-400">Custom text message. Appends the demo link automatically.</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="px-4 py-3 font-mono text-teal-400">source</td>
                                                        <td className="px-4 py-3">String</td>
                                                        <td className="px-4 py-3">No</td>
                                                        <td className="px-4 py-3 text-gray-400">Source provider identifier (e.g. Bland, Vapi).</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Interactive Code Box */}
                            <div className="space-y-6">
                                <div className="bg-[#0f0f15] border border-white/10 rounded-2xl p-6 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-teal-400">💻 Payload Preview</h4>
                                            <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-400 font-mono font-bold uppercase">JSON</span>
                                        </div>

                                        <pre className="p-4 bg-black/60 border border-white/10 rounded-xl text-[10px] text-teal-400 font-mono overflow-x-auto leading-relaxed max-h-[350px]">
                                            {JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2)}
                                        </pre>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                                        <button 
                                            onClick={() => copyToClipboard(JSON.stringify(providerConfigs[selectedDevProvider].payload, null, 2), 'JSON payload')}
                                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
                                        >
                                            📋 Copy Payload JSON
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const curl = `curl -X POST "${webhookUrl}" \\\n  -H "Authorization: Bearer ${apiToken || '<YOUR_API_TOKEN>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(providerConfigs[selectedDevProvider].payload)}'`;
                                                copyToClipboard(curl, 'cURL command');
                                            }}
                                            className="w-full bg-teal-500 hover:bg-teal-400 text-black font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20"
                                        >
                                            🚀 Copy cURL Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* How links are resolved Guide */}
                        <div className="bg-gradient-to-br from-teal-500/10 to-indigo-500/5 border border-teal-500/20 rounded-2xl p-6">
                            <h4 className="text-base font-bold text-teal-400 mb-2">🔍 How Dynamic Links are Resolved (Smart Demo Routing)</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                When a voice provider triggers the webhook action with a specified <code className="text-teal-300 font-mono font-bold">demoType</code> (e.g. <code>pricing</code>, <code>reseller</code>, <code>chatbot</code>), the platform processes it using the following hierarchy:
                            </p>
                            <ul className="list-disc list-inside text-xs text-gray-400 mt-3 space-y-2 leading-relaxed">
                                <li>
                                    <strong className="text-white">Custom Demo Asset Lookup:</strong> The system scans your database for any custom **Demo Asset** configured in your Workspace with a name, category, or keyword that matches the requested <code className="text-teal-300 font-mono">demoType</code>. If found, it immediately forwards that URL!
                                </li>
                                <li>
                                    <strong className="text-white">Fallback Construction:</strong> If no matching Demo Asset exists in your catalog, the system dynamically constructs and delivers a premium fallback URL under your Workspace domain: <code className="text-teal-300 font-mono">https://your-domain.com/demo/&#123;demoType&#125;</code>.
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Call Details Modal */}
            {selectedCall && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                📞 Call with {selectedCall.contact?.name || 'Customer'}
                                <StatusBadge status={selectedCall.status} />
                            </h3>
                            <button onClick={() => setSelectedCall(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-xs text-gray-500 mb-1">Phone Number</div>
                                    <div className="text-sm font-medium">{selectedCall.contact?.phone ? `+${selectedCall.contact.phone}` : 'Unknown'}</div>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-xs text-gray-500 mb-1">Duration</div>
                                    <div className="text-sm font-medium">{selectedCall.durationSeconds ? `${Math.floor(selectedCall.durationSeconds / 60)}m ${selectedCall.durationSeconds % 60}s` : 'N/A'}</div>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="text-xs text-gray-500 mb-1">Date</div>
                                    <div className="text-sm font-medium">{new Date(selectedCall.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-teal-400 mb-2 flex items-center gap-2">
                                    📝 Summary
                                </h4>
                                <p className="text-sm text-gray-300 bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed">
                                    {selectedCall.summary || 'No summary generated for this call yet.'}
                                </p>
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
                                    💬 Transcript
                                </h4>
                                {selectedCall.transcript && Array.isArray(selectedCall.transcript) ? (
                                    <div className="space-y-3">
                                        {selectedCall.transcript.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.speaker === 'AI' ? 'justify-start' : 'justify-end'}`}>
                                                <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${msg.speaker === 'AI' ? 'bg-white/10 text-gray-200 rounded-tl-sm' : 'bg-teal-500/20 text-teal-100 border border-teal-500/30 rounded-tr-sm'}`}>
                                                    <span className="text-[10px] uppercase tracking-wider font-bold opacity-50 block mb-1">{msg.speaker}</span>
                                                    {msg.message}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 italic p-6 bg-white/5 rounded-xl border border-white/5 text-center">
                                        No transcript available for this call.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiVoiceCalling;
