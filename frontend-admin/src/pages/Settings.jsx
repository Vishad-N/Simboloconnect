import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';

const Settings = () => {
    const [settings, setSettings] = useState({
        defaultMetaAppId: '',
        defaultMetaAppSecret: '',
        platformName: '',
        platformLogoUrl: '',
        freshThemeLogoUrl: '',
        platformFaviconUrl: '',
        smtpHost: '',
        smtpPort: '',
        smtpFromName: '',
        smtpLogoUrl: '',
        enableEmailOtp: true,
        enableSmsOtp: false,
        enableTextSmsOtp: false,
        systemMetaToken: '',
        metaApiVersion: '',
        systemPhoneNumberId: '',
        requireSignupEmail: true,
        requireSignupSms: false,
        requireSignupWa: false,
        requireForgotEmail: true,
        requireForgotSms: false,
        requireForgotWa: false,
        supportPhoneNumber: '',
        trialEnabled: true,
        defaultTrialDays: 7,
        trialSignupText: 'Start your 7-day free trial',
        frontendTheme: 'classic',
        googleOauthEnabled: false,
        googleClientId: '',
        googleClientSecret: '',
        facebookOauthEnabled: false,
        facebookAppId: '',
        facebookAppSecret: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                setSettings({
                    defaultMetaAppId: res.data.DEFAULT_META_APP_ID || '',
                    defaultMetaAppSecret: res.data.DEFAULT_META_APP_SECRET || '',
                    platformName: res.data.PLATFORM_NAME || '',
                    platformLogoUrl: res.data.PLATFORM_LOGO_URL || '',
                    freshThemeLogoUrl: res.data.FRESH_THEME_LOGO_URL || '',
                    platformFaviconUrl: res.data.PLATFORM_FAVICON_URL || '',
                    smtpHost: res.data.SMTP_HOST || '',
                    smtpPort: res.data.SMTP_PORT || '',
                    smtpUser: res.data.SMTP_USER || '',
                    smtpPassword: res.data.SMTP_PASSWORD || '',
                    smtpFromName: res.data.SMTP_FROM_NAME || '',
                    smtpFromEmail: res.data.SMTP_FROM_EMAIL || '',
                    smtpLogoUrl: res.data.SMTP_LOGO_URL || '',
                    enableEmailOtp: res.data.ENABLE_EMAIL_OTP !== 'false',
                    enableSmsOtp: res.data.ENABLE_SMS_OTP === 'true',
                    enableTextSmsOtp: res.data.ENABLE_TEXT_SMS_OTP === 'true',
                    systemMetaToken: res.data.SYSTEM_META_TOKEN || '',
                    metaApiVersion: res.data.META_API_VERSION || 'v20.0',
                    systemPhoneNumberId: res.data.SYSTEM_PHONE_NUMBER_ID || '',
                    requireSignupEmail: res.data.REQUIRE_SIGNUP_EMAIL !== 'false',
                    requireSignupSms: res.data.REQUIRE_SIGNUP_SMS === 'true',
                    requireSignupWa: res.data.REQUIRE_SIGNUP_WA === 'true',
                    requireForgotEmail: res.data.REQUIRE_FORGOT_EMAIL !== 'false',
                    requireForgotSms: res.data.REQUIRE_FORGOT_SMS === 'true',
                    requireForgotWa: res.data.REQUIRE_FORGOT_WA === 'true',
                    supportPhoneNumber: res.data.SUPPORT_PHONE_NUMBER || '',
                    trialEnabled: res.data.TRIAL_ENABLED !== 'false',
                    defaultTrialDays: parseInt(res.data.DEFAULT_TRIAL_DAYS || '7', 10),
                    trialSignupText: res.data.TRIAL_SIGNUP_TEXT || 'Start your 7-day free trial',
                    frontendTheme: res.data.FRONTEND_THEME || 'classic',
                    googleOauthEnabled: res.data.GOOGLE_OAUTH_ENABLED === 'true',
                    googleClientId: res.data.GOOGLE_CLIENT_ID || '',
                    googleClientSecret: res.data.GOOGLE_CLIENT_SECRET || '',
                    facebookOauthEnabled: res.data.FACEBOOK_OAUTH_ENABLED === 'true',
                    facebookAppId: res.data.FACEBOOK_APP_ID || '',
                    facebookAppSecret: res.data.FACEBOOK_APP_SECRET || ''
                });
            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
    }, []);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            setMessage('Error: Image must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings({ ...settings, platformLogoUrl: reader.result });
            setMessage('Logo loaded successfully. Click Save to apply.');
        };
        reader.readAsDataURL(file);
    };

    const handleFaviconUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1 * 1024 * 1024) { // 1MB limit for favicon
            setMessage('Error: Favicon must be less than 1MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings({ ...settings, platformFaviconUrl: reader.result });
            setMessage('Favicon loaded successfully. Click Save to apply.');
        };
        reader.readAsDataURL(file);
    };

    const handleFreshLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            setMessage('Error: Image must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings({ ...settings, freshThemeLogoUrl: reader.result });
            setMessage('Fresh Logo loaded successfully. Click Save to apply.');
        };
        reader.readAsDataURL(file);
    };

    const handleSmtpImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            setMessage('Error: Image must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings({ ...settings, smtpLogoUrl: reader.result });
            setMessage('SMTP Logo loaded successfully. Click Save to apply.');
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, settings, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage('Settings saved successfully!');
        } catch (err) {
            setMessage('Failed to save settings.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4">Global System Settings</h2>

            <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl border border-surface-200 shadow-sm">

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-surface-800">Default Meta Configurations</h3>
                    <p className="text-sm text-surface-500">Provide fallback Meta credentials to be used when a client has not provided their own App ID or App Secret.</p>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Default Meta App ID</label>
                        <input
                            type="text"
                            value={settings.defaultMetaAppId}
                            onChange={(e) => setSettings({ ...settings, defaultMetaAppId: e.target.value })}
                            className="input-field"
                            placeholder="e.g. 1029384756"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Default Meta App Secret</label>
                        <input
                            type="password"
                            value={settings.defaultMetaAppSecret}
                            onChange={(e) => setSettings({ ...settings, defaultMetaAppSecret: e.target.value })}
                            className="input-field font-mono"
                            placeholder="••••••••••••••••••••••••"
                        />
                    </div>
                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">Global SaaS Branding</h3>
                    <p className="text-sm text-surface-500">Configure the name, logo, and favicon that clients will see across the platform.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Platform Name (Brand Name)</label>
                            <input type="text" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} className="input-field" placeholder="e.g. MyApp" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Support Phone Number</label>
                            <input type="text" value={settings.supportPhoneNumber} onChange={(e) => setSettings({ ...settings, supportPhoneNumber: e.target.value })} className="input-field" placeholder="+919876543210 (with country code)" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Platform Favicon (.ico or .png)</label>
                            <div className="flex items-center space-x-4">
                                {settings.platformFaviconUrl ? (
                                    <img src={settings.platformFaviconUrl} alt="Favicon Preview" className="h-8 w-8 object-contain rounded-md border border-surface-200 bg-surface-50" />
                                ) : (
                                    <div className="h-8 w-8 rounded-md border border-dashed border-surface-300 flex items-center justify-center text-[10px] text-surface-400">NONE</div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFaviconUpload}
                                    className="block w-full text-sm text-surface-500
                                        file:mr-4 file:py-1 file:px-3
                                        file:rounded-md file:border-0
                                        file:text-xs file:font-semibold
                                        file:bg-brand-50 file:text-brand-700
                                        hover:file:bg-brand-100"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-surface-700 mb-1">Platform Logo (Max 2MB)</label>
                            <div className="flex items-center space-x-4">
                                {settings.platformLogoUrl ? (
                                    <img src={settings.platformLogoUrl} alt="Logo Preview" className="h-12 w-auto object-contain rounded-md border border-surface-200 bg-surface-50 p-1" />
                                ) : (
                                    <div className="h-12 w-12 rounded-md border border-dashed border-surface-300 flex items-center justify-center text-xs text-surface-400">NO LOGO</div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="block w-full text-sm text-surface-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-md file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-brand-50 file:text-brand-700
                                        hover:file:bg-brand-100"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-surface-700 mb-1">Fresh Light Theme Logo (Optional)</label>
                            <div className="flex items-center space-x-4">
                                {settings.freshThemeLogoUrl ? (
                                    <img src={settings.freshThemeLogoUrl} alt="Fresh Logo Preview" className="h-12 w-auto object-contain rounded-md border border-surface-200 bg-surface-50 p-1" />
                                ) : (
                                    <div className="h-12 w-24 rounded-md border border-dashed border-surface-300 flex items-center justify-center text-xs text-surface-400">NO LOGO</div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFreshLogoUpload}
                                    className="block w-full text-sm text-surface-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-md file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-brand-50 file:text-brand-700
                                        hover:file:bg-brand-100"
                                />
                            </div>
                            <p className="text-xs text-surface-500 mt-1">Leave empty to use the default Platform Logo everywhere.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">SMTP Settings (Email Deliverability)</h3>
                    <p className="text-sm text-surface-500">Configure your email provider to send OTPs and notifications.</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">SMTP Host</label>
                            <input type="text" value={settings.smtpHost} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} className="input-field" placeholder="smtp.hostinger.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">SMTP Port</label>
                            <input type="number" value={settings.smtpPort} onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })} className="input-field" placeholder="465" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">SMTP Username</label>
                            <input type="email" value={settings.smtpUser} onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })} className="input-field" placeholder="no-reply@yourdomain.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">SMTP Password</label>
                            <input type="password" value={settings.smtpPassword} onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })} className="input-field font-mono" placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Sender Name (From)</label>
                            <input type="text" value={settings.smtpFromName} onChange={(e) => setSettings({ ...settings, smtpFromName: e.target.value })} className="input-field" placeholder="Platform Accounts" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Sender Email (From)</label>
                            <input type="email" value={settings.smtpFromEmail} onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value })} className="input-field" placeholder="no-reply@yourdomain.com" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-surface-700 mb-1">Email Logo (Max 2MB)</label>
                            <div className="flex items-center space-x-4">
                                {settings.smtpLogoUrl && (
                                    <img src={settings.smtpLogoUrl} alt="SMTP Logo Preview" className="h-10 w-auto object-contain rounded-md border border-surface-200 bg-surface-50" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleSmtpImageUpload}
                                    className="block w-full text-sm text-surface-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-md file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-brand-50 file:text-brand-700
                                        hover:file:bg-brand-100"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">OTP Configuration</h3>
                    <p className="text-sm text-surface-500">Configure how One-Time Passwords (OTPs) are delivered to users during signup.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={settings.enableEmailOtp}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSettings({
                                                ...settings,
                                                enableEmailOtp: checked,
                                                requireSignupEmail: checked,
                                                requireForgotEmail: checked
                                            });
                                        }}
                                        className="sr-only"
                                    />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${settings.enableEmailOtp ? 'bg-brand-500' : 'bg-surface-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.enableEmailOtp ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-surface-800">Email OTP System</div>
                                    <div className="text-xs text-surface-500">Sends 6-digit verification code via SMTP</div>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={settings.enableSmsOtp}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSettings({
                                                ...settings,
                                                enableSmsOtp: checked,
                                                requireSignupSms: checked,
                                                requireForgotSms: checked
                                            });
                                        }}
                                        className="sr-only"
                                    />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${settings.enableSmsOtp ? 'bg-brand-500' : 'bg-surface-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.enableSmsOtp ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-surface-800">WhatsApp OTP</div>
                                    <div className="text-xs text-surface-500">Dispatches via WhatsApp Business API</div>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={settings.enableTextSmsOtp}
                                        onChange={(e) => setSettings({ ...settings, enableTextSmsOtp: e.target.checked })}
                                        className="sr-only"
                                    />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${settings.enableTextSmsOtp ? 'bg-brand-500' : 'bg-surface-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.enableTextSmsOtp ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div>
                                    <div className="font-bold text-surface-800">SMS Gateway OTP</div>
                                    <div className="text-xs text-surface-500">Dispatches via primary SMS Gateway</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {settings.enableSmsOtp && (
                        <div className="mt-4 p-4 border border-brand-200 bg-brand-50 rounded-lg space-y-4">
                            <h4 className="text-sm font-semibold text-brand-800">WhatsApp API Configuration</h4>
                            <p className="text-xs text-surface-600">
                                Required to dispatch OTPs via WhatsApp. Ensure you have a template named <code>verification_code</code> active in your Meta dashboard.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-surface-700 mb-1">System Meta Access Token (Permanent Token)</label>
                                    <input
                                        type="password"
                                        value={settings.systemMetaToken}
                                        onChange={(e) => setSettings({ ...settings, systemMetaToken: e.target.value })}
                                        className="input-field font-mono text-sm"
                                        placeholder="EAA..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">WhatsApp Phone Number ID</label>
                                    <input
                                        type="text"
                                        value={settings.systemPhoneNumberId}
                                        onChange={(e) => setSettings({ ...settings, systemPhoneNumberId: e.target.value })}
                                        className="input-field font-mono text-sm"
                                        placeholder="1234567890"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Meta API Version</label>
                                    <input
                                        type="text"
                                        value={settings.metaApiVersion}
                                        onChange={(e) => setSettings({ ...settings, metaApiVersion: e.target.value })}
                                        className="input-field"
                                        placeholder="v20.0"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">Multi-Channel Verification Rules</h3>
                    <p className="text-sm text-surface-500">Configure which OTP channels are mandatory for users to verify during different actions. If multiple are selected, users must verify ALL selected channels.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Signup Rules */}
                        <div className="space-y-3 p-4 bg-surface-50 rounded-xl border border-surface-200">
                            <h4 className="font-semibold text-surface-700 mb-2 border-b border-surface-200 pb-2">New Account Signup</h4>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireSignupEmail} onChange={(e) => setSettings({ ...settings, requireSignupEmail: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require Email Verification</div>
                                    <div className="text-xs text-surface-500">Users must verify their email address.</div>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireSignupSms} onChange={(e) => setSettings({ ...settings, requireSignupSms: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require Text SMS Verification</div>
                                    <div className="text-xs text-surface-500">Users must verify their mobile via Text (Fast2SMS).</div>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireSignupWa} onChange={(e) => setSettings({ ...settings, requireSignupWa: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require WhatsApp Verification</div>
                                    <div className="text-xs text-surface-500">Users must verify their mobile via WhatsApp.</div>
                                </div>
                            </label>
                        </div>

                        {/* Forgot Password Rules */}
                        <div className="space-y-3 p-4 bg-surface-50 rounded-xl border border-surface-200">
                            <h4 className="font-semibold text-surface-700 mb-2 border-b border-surface-200 pb-2">Password Reset Recovery</h4>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireForgotEmail} onChange={(e) => setSettings({ ...settings, requireForgotEmail: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require Email Backup</div>
                                    <div className="text-xs text-surface-500">Recovery code sent to registered email.</div>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireForgotSms} onChange={(e) => setSettings({ ...settings, requireForgotSms: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require Text SMS Backup</div>
                                    <div className="text-xs text-surface-500">Recovery code sent via Text SMS.</div>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                                <input type="checkbox" checked={settings.requireForgotWa} onChange={(e) => setSettings({ ...settings, requireForgotWa: e.target.checked })} className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500" />
                                <div>
                                    <div className="text-sm font-medium text-surface-800">Require WhatsApp Backup</div>
                                    <div className="text-xs text-surface-500">Recovery code sent via WhatsApp.</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">SaaS Free Trial Settings</h3>
                    <p className="text-sm text-surface-500">Configure client trial access on registration, trial duration in days, and custom signup welcome description.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-surface-50 rounded-lg border border-surface-200 flex items-center justify-between">
                            <div>
                                <div className="font-bold text-surface-800">Enable Free Trial</div>
                                <div className="text-xs text-surface-500">If disabled, new users register without trial validity (requires subscription).</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.trialEnabled}
                                    onChange={(e) => setSettings({ ...settings, trialEnabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Trial Duration (Days)</label>
                            <input
                                type="number"
                                disabled={!settings.trialEnabled}
                                value={settings.defaultTrialDays}
                                onChange={(e) => setSettings({ ...settings, defaultTrialDays: Math.max(1, parseInt(e.target.value) || 0) })}
                                className="input-field disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder="e.g. 7"
                                min="1"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-surface-700 mb-1">Signup Title Description / Trial Text</label>
                            <input
                                type="text"
                                value={settings.trialSignupText}
                                onChange={(e) => setSettings({ ...settings, trialSignupText: e.target.value })}
                                className="input-field"
                                placeholder="e.g. Start your 7-day free trial"
                            />
                        </div>
                    </div>
                </div>

                {/* ════ UI THEME SWITCHER ════ */}
                <div className="space-y-4 pt-6 mt-6 border-t border-surface-200">
                    <h3 className="text-lg font-semibold text-surface-800">Client Panel UI Theme</h3>
                    <p className="text-sm text-surface-500">Choose the visual theme for your client-facing dashboard. Changes apply immediately for all users after save.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Classic Dark Theme */}
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, frontendTheme: 'classic' })}
                            className={`relative text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${
                                settings.frontendTheme === 'classic'
                                    ? 'border-brand-500 ring-2 ring-brand-400/30'
                                    : 'border-surface-200 hover:border-surface-300'
                            }`}
                        >
                            {/* Dark preview */}
                            <div className="h-28 bg-[#0b0b0b] flex overflow-hidden">
                                <div className="w-14 bg-[#101010] border-r border-[#1a1a1a] flex flex-col gap-1.5 p-2">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className={`h-2 rounded-full ${i === 0 ? 'bg-[#00d9a5] w-8' : 'bg-[#2a2a2a] w-6'}`} />
                                    ))}
                                </div>
                                <div className="flex-1 p-3 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        {['bg-[#1a1a1a]', 'bg-[#1a1a1a]', 'bg-[#1a1a1a]'].map((c, i) => (
                                            <div key={i} className={`${c} flex-1 h-10 rounded-lg border border-[#222]`} />
                                        ))}
                                    </div>
                                    <div className="bg-[#111] h-12 rounded-lg border border-[#222]" />
                                    <div className="bg-[#0d0d0d] h-8 rounded-lg border border-[#1e1e1e]" />
                                </div>
                            </div>
                            <div className="p-3 bg-white border-t border-surface-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-surface-800 text-sm">Classic Dark</div>
                                        <div className="text-xs text-surface-500">Dark mode — current default</div>
                                    </div>
                                    {settings.frontendTheme === 'classic' && (
                                        <span className="text-xs font-bold bg-brand-100 text-brand-700 px-2 py-1 rounded-full">✓ Active</span>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Fresh Light Theme */}
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, frontendTheme: 'fresh' })}
                            className={`relative text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${
                                settings.frontendTheme === 'fresh'
                                    ? 'border-green-500 ring-2 ring-green-400/30'
                                    : 'border-surface-200 hover:border-surface-300'
                            }`}
                        >
                            {/* Light preview */}
                            <div className="h-28 bg-[#f3fbf6] flex overflow-hidden">
                                <div className="w-14 bg-[#0c1610] border-r border-[#1e2e22] flex flex-col gap-1.5 p-2">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className={`h-2 rounded-full ${i === 0 ? 'bg-[#25D366] w-8' : 'bg-[#1e2e22] w-6'}`} />
                                    ))}
                                </div>
                                <div className="flex-1 p-3 flex flex-col gap-2 bg-[#f3fbf6]">
                                    <div className="flex gap-2">
                                        {['bg-white', 'bg-white', 'bg-white'].map((c, i) => (
                                            <div key={i} className={`${c} flex-1 h-10 rounded-lg border border-[#cde9d8]`} />
                                        ))}
                                    </div>
                                    <div className="bg-white h-12 rounded-lg border border-[#cde9d8]" />
                                    <div className="bg-[#e8faf0] h-8 rounded-lg border border-[#9ae8c0]" />
                                </div>
                            </div>
                            <div className="p-3 bg-white border-t border-surface-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-surface-800 text-sm">Fresh Light</div>
                                        <div className="text-xs text-surface-500">Light mode — green &amp; white</div>
                                    </div>
                                    {settings.frontendTheme === 'fresh' && (
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">✓ Active</span>
                                    )}
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">💡 <strong>Note:</strong> Theme change applies to client panel only. Admin panel always uses Classic Dark styling.</p>
                    </div>
                </div>

                {/* ── Social OAuth Settings ── */}
                <div className="border-t border-surface-700 pt-6 mt-6">
                    <h3 className="font-semibold text-surface-100 mb-1">Social Login (OAuth)</h3>
                    <p className="text-surface-400 text-xs mb-4">Enable Google / Facebook OAuth buttons on the signup/login page (Fresh theme).</p>
                    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-surface-100 text-sm">🔵 Google OAuth</span>
                            </div>
                            <div onClick={() => setSettings(s => ({ ...s, googleOauthEnabled: !s.googleOauthEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${settings.googleOauthEnabled ? 'bg-green-500' : 'bg-surface-600'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.googleOauthEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </div>
                        {settings.googleOauthEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1 font-semibold">Google Client ID</label>
                                    <input className="input-field text-xs" type="text" placeholder="xxxx.apps.googleusercontent.com" value={settings.googleClientId} onChange={e => setSettings(s => ({ ...s, googleClientId: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1 font-semibold">Google Client Secret</label>
                                    <input className="input-field text-xs" type="password" placeholder="GOCSPX-xxxxx" value={settings.googleClientSecret} onChange={e => setSettings(s => ({ ...s, googleClientSecret: e.target.value }))} />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-surface-100 text-sm">🔷 Facebook OAuth</span>
                            </div>
                            <div onClick={() => setSettings(s => ({ ...s, facebookOauthEnabled: !s.facebookOauthEnabled }))} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${settings.facebookOauthEnabled ? 'bg-green-500' : 'bg-surface-600'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.facebookOauthEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                        </div>
                        {settings.facebookOauthEnabled && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1 font-semibold">Facebook App ID</label>
                                    <input className="input-field text-xs" type="text" placeholder="123456789012345" value={settings.facebookAppId} onChange={e => setSettings(s => ({ ...s, facebookAppId: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-xs text-surface-400 mb-1 font-semibold">Facebook App Secret</label>
                                    <input className="input-field text-xs" type="password" placeholder="xxxxxxxxxxxxxxxx" value={settings.facebookAppSecret} onChange={e => setSettings(s => ({ ...s, facebookAppSecret: e.target.value }))} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-surface-200 flex items-center justify-between">
                    <span className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{message}</span>
                    <button type="submit" disabled={loading} className="btn-primary flex items-center">
                        <Save size={18} className="mr-2" />
                        {loading ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Settings;
