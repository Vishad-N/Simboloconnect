import React, { useState } from 'react';
import { Save, KeyRound, Activity, AlertCircle, Facebook, Eye, EyeOff, ChevronDown, Sparkles, CreditCard } from 'lucide-react';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import PaymentSettings from '../components/PaymentSettings';

const getEmbedUrl = (url) => {
    if (!url) return "https://www.youtube.com/embed/3Qy4v5Z0EOM";
    try {
        if (url.includes('youtube.com/watch')) {
            const urlParams = new URLSearchParams(new URL(url).search);
            return `https://www.youtube.com/embed/${urlParams.get('v')}`;
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1].split('?')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        return url;
    } catch (e) { return url; }
};

const Settings = () => {
    const [activeTab, setActiveTab] = useState('meta'); // 'meta' | 'payments'
    const [tokens, setTokens] = useState({ phoneNumberId: '', wabaId: '', metaToken: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [qualityData, setQualityData] = useState({ rating: null, limit: null });
    const [qualityLoading, setQualityLoading] = useState(false);
    const [fbReady, setFbReady] = useState(false);
    const [showTokenField, setShowTokenField] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const { branding } = useBranding();
    const isEmbeddedEnabled = branding?.embeddedSignupEnabled === true;

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('oauth_success')) {
            alert("WhatsApp Connected Successfully!");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get('oauth_error')) {
            alert(`Meta Onboarding Failed: ${urlParams.get('msg') || 'Unknown Error'}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (urlParams.get('tab') === 'payments') {
            setActiveTab('payments');
        }

        const fetchQuality = async () => {
            setQualityLoading(true);
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/settings/quality`);
                setQualityData({ rating: res.data.quality_rating, limit: res.data.messaging_limit_tier });
            } catch (e) { console.error(e); } finally { setQualityLoading(false); }
        };

        axios.get(`${import.meta.env.VITE_API_URL}/api/settings/tokens`).then(r => {
            if (r.data) {
                setTokens({ phoneNumberId: r.data.phoneNumberId || '', wabaId: r.data.wabaId || '', metaToken: r.data.metaToken || '' });
                if (r.data.phoneNumberId && r.data.metaToken) { setIsConnected(true); fetchQuality(); }
            }
        }).catch(console.error);
    }, []);

    React.useEffect(() => {
        if (!isEmbeddedEnabled || !branding?.embeddedSignupAppId) return;
        const sdkVersion = branding.metaJsSdkVersion || 'v19.0';
        if (window.FB) {
            try { window.FB.init({ appId: branding.embeddedSignupAppId, autoLogAppEvents: true, xfbml: true, version: sdkVersion }); } catch (e) {}
            setFbReady(true); return;
        }
        window.fbAsyncInit = () => {
            window.FB.init({ appId: branding.embeddedSignupAppId, autoLogAppEvents: true, xfbml: true, version: sdkVersion });
            setFbReady(true);
        };
        (function(d, s, id) {
            if (d.getElementById(id)) return;
            const js = d.createElement(s); js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js"; js.async = true; js.defer = true;
            d.getElementsByTagName(s)[0].parentNode.insertBefore(js, d.getElementsByTagName(s)[0]);
        }(document, 'script', 'facebook-jssdk'));
    }, [isEmbeddedEnabled, branding?.embeddedSignupAppId]);

    React.useEffect(() => {
        const handleMessage = (event) => {
            console.log('[META POSTMESSAGE]', event.origin, event.data);
            if (event.data && typeof event.data === 'object') {
                console.log('[META POSTMESSAGE DETAIL]', {
                    origin: event.origin,
                    type: event.data.type,
                    event: event.data.event,
                    data: event.data.data
                });
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleFbLogin = () => {
        if (!fbReady || !window.FB) { alert("Facebook SDK is still loading. Please wait or disable ad-blockers."); return; }
        if (!branding?.embeddedSignupConfigId) { alert("Embedded Signup Config ID is missing. Contact your administrator."); return; }
        const token = localStorage.getItem('userToken');
        if (!token) { alert("Authentication token missing. Please log in again."); return; }
        setIsSaving(true);
        console.log("Config ID Used:", branding.embeddedSignupConfigId);
        console.log("Meta App ID Used:", branding.embeddedSignupAppId);
        window.FB.login((response) => {
            console.log("[FB.login Client Response Payload]:", JSON.stringify(response, null, 2));
            if (response.authResponse?.code) {
                axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/meta-auth/exchange-code`,
                    { code: response.authResponse.code },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).then(() => { alert("WhatsApp Connected via Facebook!"); setIsConnected(true); window.location.reload(); })
                .catch(err => alert(`Failed: ${err.response?.data?.error || err.message}`))
                .finally(() => setIsSaving(false));
            } else { setIsSaving(false); }
        }, {
            config_id: branding.embeddedSignupConfigId,
            response_type: 'code', override_default_response_type: true,
            auth_type: 'rerequest',
            scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
            extras: { 
                setup: {},
                featureType: 'whatsapp_business_app_onboarding',
                sessionInfoVersion: '3'
            }
        });
    };

    const handleSave = async (e) => {
        e.preventDefault(); setIsSaving(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/api/settings/tokens`, tokens);
            try { await axios.post(`${import.meta.env.VITE_API_URL}/api/templates/sync`); } catch {}
            alert("Credentials saved successfully!"); setIsConnected(true); setShowManual(false);
        } catch (err) { alert(err.response?.data?.error || "Failed to save credentials."); }
        finally { setIsSaving(false); }
    };

    const handleRemove = async () => {
        if (!window.confirm("Remove all API credentials? This will stop all WhatsApp integrations.")) return;
        setIsSaving(true);
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/settings/tokens`);
            setTokens({ phoneNumberId: '', wabaId: '', metaToken: '' });
            setIsConnected(false); setShowManual(false);
            alert("Credentials removed.");
        } catch { alert("Failed to remove credentials."); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-6">
            {/* Elegant Main Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">System Settings</h1>
                    <p className="text-xs text-surface-400 mt-1">Configure Meta WhatsApp API endpoints and store billing management.</p>
                </div>

                {/* Sleek Central Tab Switches */}
                <div className="flex bg-surface-950 p-1 rounded-xl border border-surface-800 shadow-inner">
                    <button onClick={() => setActiveTab('meta')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'meta' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/20' : 'text-surface-400 hover:text-surface-200'}`}>
                        <Facebook size={14} />
                        WhatsApp &amp; Meta API
                    </button>
                    <button onClick={() => setActiveTab('payments')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'payments' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/20' : 'text-surface-400 hover:text-surface-200'}`}>
                        <CreditCard size={14} />
                        Payments &amp; Routing
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: 1. META ENDPOINTS */}
            {activeTab === 'meta' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start animate-fadeIn">
                    <div className="space-y-6 w-full">
                        {/* Credentials Card */}
                        <div className="glass-panel p-8 space-y-6 border-surface-700">
                            <div className="flex items-center gap-3 pb-4 border-b border-surface-700/60">
                                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl"><KeyRound size={24} /></div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Meta API Credentials</h2>
                                    <p className="text-sm text-surface-400">Connect via Facebook or enter credentials manually.</p>
                                </div>
                                {isConnected && (
                                    <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> Connected
                                    </span>
                                )}
                            </div>

                            {isEmbeddedEnabled && (
                                <div>
                                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Recommended — Quick Setup</p>
                                    <button type="button" onClick={handleFbLogin} disabled={isSaving}
                                        className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-[#1877F2] hover:bg-[#1565D8] active:scale-[0.98] text-white font-bold transition-all duration-200 shadow-lg shadow-[#1877F2]/25 disabled:opacity-50">
                                        <Facebook size={20} />
                                        {isSaving ? 'Connecting...' : 'Continue with Facebook'}
                                    </button>
                                    <p className="text-xs text-surface-500 text-center mt-2">Automatically fills WABA ID, Phone ID &amp; Access Token</p>
                                </div>
                            )}

                            {isEmbeddedEnabled && (
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 h-px bg-surface-700"></div>
                                    <span className="text-surface-500 text-sm font-medium px-2">OR</span>
                                    <div className="flex-1 h-px bg-surface-700"></div>
                                </div>
                            )}

                            {!isConnected ? (
                                <form onSubmit={handleSave} className="space-y-4">
                                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Manual Setup</p>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-300 mb-2">Phone Number ID</label>
                                        <input type="text" className="input-field" placeholder="e.g. 1029384756..."
                                            value={tokens.phoneNumberId} onChange={e => setTokens({ ...tokens, phoneNumberId: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-300 mb-2">WhatsApp Business Account ID (WABA)</label>
                                        <input type="text" className="input-field" placeholder="e.g. 5647382910..."
                                            value={tokens.wabaId} onChange={e => setTokens({ ...tokens, wabaId: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-surface-300 mb-2">Permanent Access Token</label>
                                        <div className="relative">
                                            <input type={showTokenField ? 'text' : 'password'} className="input-field pr-12"
                                                placeholder="EAAGm0..." value={tokens.metaToken}
                                                onChange={e => setTokens({ ...tokens, metaToken: e.target.value })} />
                                            <button type="button" onClick={() => setShowTokenField(!showTokenField)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                                                {showTokenField ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={isSaving} className="btn-primary w-full disabled:opacity-50">
                                        <Save size={18} /> {isSaving ? 'Saving...' : 'Securely Save Credentials'}
                                    </button>
                                </form>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-xl bg-surface-800/60 border border-surface-700 space-y-2">
                                        <div className="flex justify-between text-sm"><span className="text-surface-400">Phone Number ID</span><span className="text-white font-mono text-xs">{tokens.phoneNumberId || '—'}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-surface-400">WABA ID</span><span className="text-white font-mono text-xs">{tokens.wabaId || '—'}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-surface-400">Access Token</span><span className="text-white font-mono text-xs">{'•'.repeat(20)}</span></div>
                                    </div>
                                    <button onClick={() => setShowManual(!showManual)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all">
                                        <span>Update Credentials Manually</span>
                                        <ChevronDown size={16} className={`transition-transform duration-200 ${showManual ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showManual && (
                                        <form onSubmit={handleSave} className="space-y-3 pt-3 border-t border-surface-700">
                                            <div>
                                                <label className="block text-sm font-medium text-surface-300 mb-1.5">Phone Number ID</label>
                                                <input type="text" className="input-field" value={tokens.phoneNumberId} onChange={e => setTokens({ ...tokens, phoneNumberId: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-surface-300 mb-1.5">WABA ID</label>
                                                <input type="text" className="input-field" value={tokens.wabaId} onChange={e => setTokens({ ...tokens, wabaId: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-surface-300 mb-1.5">Access Token</label>
                                                <div className="relative">
                                                    <input type={showTokenField ? 'text' : 'password'} className="input-field pr-12"
                                                        value={tokens.metaToken} onChange={e => setTokens({ ...tokens, metaToken: e.target.value })} />
                                                    <button type="button" onClick={() => setShowTokenField(!showTokenField)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-white">
                                                        {showTokenField ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button type="submit" disabled={isSaving} className="btn-primary w-full disabled:opacity-50">
                                                <Save size={16} /> {isSaving ? 'Saving...' : 'Update Credentials'}
                                            </button>
                                        </form>
                                    )}
                                    <button onClick={handleRemove} disabled={isSaving}
                                        className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all disabled:opacity-50">
                                        Remove All Credentials
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Connection Status Card */}
                        {(qualityLoading || qualityData.rating) && (
                            <div className="glass-panel p-8 border-surface-700">
                                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-surface-700/60">
                                    <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl"><Activity size={24} /></div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Live Meta Connection Status</h2>
                                        <p className="text-sm text-surface-400">Real-time health of your WhatsApp Business Account.</p>
                                    </div>
                                </div>
                                {qualityLoading ? (
                                    <div className="text-surface-400 animate-pulse text-sm">Testing connection with Meta...</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-surface-800/50 p-4 rounded-xl border border-surface-700">
                                            <p className="text-sm text-surface-400 mb-1">Quality Rating</p>
                                            <p className={`font-bold text-xl uppercase tracking-wider ${qualityData.rating === 'GREEN' ? 'text-green-400' : qualityData.rating === 'YELLOW' ? 'text-yellow-400' : qualityData.rating === 'UNKNOWN' ? 'text-brand-400' : 'text-red-400'}`}>
                                                {qualityData.rating || 'N/A'}
                                                {qualityData.rating === 'GREEN' && <span className="text-xs text-green-500/80 ml-2">(Healthy)</span>}
                                                {qualityData.rating === 'UNKNOWN' && <span className="text-xs text-brand-500/80 ml-2">(In Review / New)</span>}
                                            </p>
                                        </div>
                                        <div className="bg-surface-800/50 p-4 rounded-xl border border-surface-700">
                                            <p className="text-sm text-surface-400 mb-1">Daily Messaging Limit</p>
                                            <p className="font-bold text-xl text-white">
                                                {qualityData.limit === 'UNKNOWN' ? 'Pending Approval' : (qualityData.limit?.replace('TIER_', '') || 'N/A')}
                                                {qualityData.limit !== 'UNKNOWN' && <span className="text-xs text-surface-400 ml-1 font-normal">msg/day</span>}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Video Help Column */}
                    <div className="glass-panel p-6 border-surface-700 sticky top-6">
                        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <AlertCircle className="text-brand-400" size={20} /> Need Help?
                        </h2>
                        <p className="text-sm text-surface-400 mb-6">
                            Watch this step-by-step tutorial on how to generate your API credentials using the Meta Developer Dashboard.
                        </p>
                        <div className="relative w-full rounded-xl overflow-hidden border border-surface-700 bg-surface-900 aspect-video shadow-lg">
                            <iframe className="absolute top-0 left-0 w-full h-full"
                                src={getEmbedUrl(branding?.manualSetupVideoUrl)}
                                title="YouTube Setup Guide" frameBorder="0"
                                allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                        </div>
                        <div className="mt-6 pt-4 border-t border-surface-700/50">
                            <h4 className="text-white font-medium mb-3 text-sm">Key Steps Covered:</h4>
                            <ul className="text-sm text-surface-400 space-y-2 list-disc list-inside">
                                <li>Create a App in Developer Account</li>
                                <li>Add WhatsApp Product</li>
                                <li>Add your Payment Method / Card</li>
                                <li>Generate System User Token securely</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: 2. PAYMENT CONFIG */}
            {activeTab === 'payments' && (
                <div className="w-full animate-fadeIn">
                    <PaymentSettings />
                </div>
            )}
        </div>
    );
};

export default Settings;
