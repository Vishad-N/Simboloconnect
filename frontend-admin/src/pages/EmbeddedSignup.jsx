import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Facebook, Save, CheckCircle2, AlertCircle, Link, MonitorPlay } from 'lucide-react';

const EmbeddedSignup = () => {
    const [settings, setSettings] = useState({
        embeddedSignupEnabled: false,
        embeddedSignupAppId: '',
        embeddedSignupAppSecret: '',
        embeddedSignupConfigId: '',
        webhookVerifyToken: '',
        manualSetupVideoUrl: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`);
            setSettings({
                embeddedSignupEnabled: res.data.EMBEDDED_SIGNUP_ENABLED === 'true',
                embeddedSignupAppId: res.data.EMBEDDED_SIGNUP_APP_ID || '',
                embeddedSignupAppSecret: res.data.EMBEDDED_SIGNUP_APP_SECRET || '',
                embeddedSignupConfigId: res.data.EMBEDDED_SIGNUP_CONFIG_ID || '',
                webhookVerifyToken: res.data.WEBHOOK_VERIFY_TOKEN || 'yourdomain.com',
                manualSetupVideoUrl: res.data.MANUAL_SETUP_VIDEO_URL || ''
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                embeddedSignupEnabled: settings.embeddedSignupEnabled,
                embeddedSignupAppId: settings.embeddedSignupAppId,
                embeddedSignupAppSecret: settings.embeddedSignupAppSecret,
                embeddedSignupConfigId: settings.embeddedSignupConfigId,
                manualSetupVideoUrl: settings.manualSetupVideoUrl
            });
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setMessage('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    // Use the backend API URL for OAuth callbacks instead of the admin panel origin
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const redirectUrl = `${baseUrl}/api/meta-auth/facebook/callback`;
    const webhookUrl = `${baseUrl}/api/webhooks/meta`;

    if (loading) {
        return <div className="text-center py-10">Loading configuration...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-surface-900 mb-2">Embedded Signup Configuration</h1>
                <p className="text-surface-500">Enable automated WhatsApp Cloud API onboarding via Facebook Login.</p>
            </header>

            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.includes('success') ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden mb-8">
                <div className="bg-[#1877F2]/10 border-b border-surface-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Facebook className="text-[#1877F2]" size={32} />
                        <div>
                            <h2 className="text-lg font-semibold text-surface-900">Meta App Setup</h2>
                            <p className="text-sm text-surface-500">Configure your Meta Developer App details here.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-surface-200">
                        <span className="text-sm font-medium text-surface-700">Enable Feature</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={settings.embeddedSignupEnabled}
                            onClick={() => setSettings({ ...settings, embeddedSignupEnabled: !settings.embeddedSignupEnabled })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.embeddedSignupEnabled ? 'bg-brand-500' : 'bg-surface-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.embeddedSignupEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!settings.embeddedSignupEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">App ID</label>
                            <input
                                type="text"
                                className="w-full border border-surface-300 rounded-lg px-4 py-2.5 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="eg. 1029384756"
                                value={settings.embeddedSignupAppId}
                                onChange={(e) => setSettings({ ...settings, embeddedSignupAppId: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">App Secret</label>
                            <input
                                type="password"
                                className="w-full border border-surface-300 rounded-lg px-4 py-2.5 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="****************"
                                value={settings.embeddedSignupAppSecret}
                                onChange={(e) => setSettings({ ...settings, embeddedSignupAppSecret: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-surface-700 mb-2">Embedded Signup Config ID</label>
                            <input
                                type="text"
                                className="w-full border border-surface-300 rounded-lg px-4 py-2.5 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="eg. 11223344556677"
                                value={settings.embeddedSignupConfigId}
                                onChange={(e) => setSettings({ ...settings, embeddedSignupConfigId: e.target.value })}
                            />
                            <p className="text-xs text-surface-500 mt-1">Generated from the Meta Embedded Signup Builder.</p>
                        </div>
                    </div>
                    
                    <hr className="border-surface-200" />
                    
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <MonitorPlay size={18} className="text-surface-500" />
                             <label className="block text-sm font-medium text-surface-700">Manual Setup YouTube Video URL</label>
                        </div>
                        <p className="text-xs text-surface-500 mb-3">Copy your YouTube embed URL (e.g., https://www.youtube.com/embed/XXXXX) to display on the User Settings page for manual onboarding.</p>
                        <input
                            type="text"
                            className="w-full border border-surface-300 rounded-lg px-4 py-2.5 focus:ring-brand-500 focus:border-brand-500"
                            placeholder="https://www.youtube.com/embed/c0mYxH92aM"
                            value={settings.manualSetupVideoUrl}
                            onChange={(e) => setSettings({ ...settings, manualSetupVideoUrl: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-surface-200">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-surface-50 rounded-xl border border-surface-200 p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
                        <Link size={20} className="text-surface-500"/>
                        Important Meta App URLs
                    </h3>
                    <p className="text-sm text-surface-600 mb-6">
                        Copy these values into your Meta Developer App configuration to ensure the Embedded Signup flow works correctly.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg border border-surface-200">
                        <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">OAuth Redirect URI</label>
                        <textarea 
                            readOnly 
                            className="w-full bg-surface-50 text-sm text-surface-800 p-3 rounded border border-surface-200 focus:outline-none resize-none" 
                            rows={2}
                            value={redirectUrl}
                        />
                        <p className="text-xs text-surface-500 mt-2">Add this to <strong>Facebook Login for Business &gt; Settings</strong> (Valid OAuth Redirect URIs).</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-surface-200">
                        <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Required Scopes</label>
                        <textarea 
                            readOnly 
                            className="w-full bg-surface-50 text-sm text-surface-800 p-3 rounded border border-surface-200 focus:outline-none resize-none font-mono" 
                            rows={3}
                            value="whatsapp_business_management&#10;whatsapp_business_messaging&#10;business_management"
                        />
                        <p className="text-xs text-surface-500 mt-2">Make sure your app has Advanced Access to these permissions.</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-surface-200">
                        <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Webhook Callback URL</label>
                        <textarea 
                            readOnly 
                            className="w-full bg-surface-50 text-sm text-surface-800 p-3 rounded border border-surface-200 focus:outline-none resize-none" 
                            rows={2}
                            value={webhookUrl}
                        />
                        <p className="text-xs text-surface-500 mt-2">Add this to <strong>Webhooks &gt; WhatsApp Business Account</strong> endpoint.</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-surface-200">
                        <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Webhook Verify Token</label>
                        <input 
                            readOnly 
                            type="text"
                            className="w-full bg-surface-50 text-sm text-surface-800 p-3 rounded border border-surface-200 focus:outline-none" 
                            value="yourdomain.com"
                        />
                        <p className="text-xs text-surface-500 mt-2">Use this token when configuring the Webhook.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmbeddedSignup;
