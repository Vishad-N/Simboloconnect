import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Activity, RefreshCw, AlertTriangle, PlayCircle, ShieldAlert, CheckCircle, XCircle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

const SystemUpdates = () => {
    const [settings, setSettings] = useState({
        metaApiVersion: '',
        metaGraphApiVersion: '',
        metaJsSdkVersion: '',
        metaEmbeddedSignupVersion: '',
        draftMetaApiVersion: '',
        webhookVerifyToken: '',
        defaultTrialDays: '7',
        systemMetaToken: '',
        maintenanceMode: false,
        metaBusinessAppOnboardingEnabled: false,
        metaSettingsLastUpdated: ''
    });

    const [testReport, setTestReport] = useState([]);
    const [testing, setTesting] = useState(false);
    const [expandedSteps, setExpandedSteps] = useState({});
    const [webhookStatus, setWebhookStatus] = useState('Checking...');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const versionsWhitelist = ['v19.0', 'v20.0', 'v21.0', 'v22.0', 'v23.0', 'v24.0', 'v25.0'];

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setSettings({
                metaApiVersion: res.data.META_GRAPH_API_VERSION || res.data.META_API_VERSION || 'v20.0',
                metaGraphApiVersion: res.data.META_GRAPH_API_VERSION || res.data.META_API_VERSION || 'v20.0',
                metaJsSdkVersion: res.data.META_JS_SDK_VERSION || 'v19.0',
                metaEmbeddedSignupVersion: res.data.META_EMBEDDED_SIGNUP_VERSION || 'v19.0',
                draftMetaApiVersion: res.data.DRAFT_META_API_VERSION || '',
                webhookVerifyToken: res.data.WEBHOOK_VERIFY_TOKEN || '',
                defaultTrialDays: res.data.DEFAULT_TRIAL_DAYS || '7',
                systemMetaToken: res.data.SYSTEM_META_TOKEN || '',
                maintenanceMode: res.data.MAINTENANCE_MODE === 'true',
                metaBusinessAppOnboardingEnabled: res.data.META_BUSINESS_APP_ONBOARDING_ENABLED === 'true',
                metaSettingsLastUpdated: res.data.META_SETTINGS_LAST_UPDATED || ''
            });
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    const fetchWebhookPulse = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/system/pulse`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            if (res.data.status === 'ok') {
                setWebhookStatus('Online (200 OK)');
            } else {
                setWebhookStatus('Offline / Error');
            }
        } catch (e) {
            setWebhookStatus('Offline / Error');
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchWebhookPulse();
        const interval = setInterval(fetchWebhookPulse, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                ...settings,
                metaApiVersion: settings.metaGraphApiVersion
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage({ type: 'success', text: 'System Configuration Saved!' });
            fetchSettings();
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save configuration.' });
        }
        setLoading(false);
    };

    const handleTestMeta = async () => {
        try {
            setTesting(true);
            setTestReport([]);
            const versionToTest = settings.draftMetaApiVersion || settings.metaGraphApiVersion;

            const res = await axios.post(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/system/test-meta`,
                { version: versionToTest, token: settings.systemMetaToken },
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );

            if (res.data?.report) {
                setTestReport(res.data.report);
            } else {
                setTestReport([{ step: "Testing Connection", success: res.data?.success, message: "Raw test finished successfully." }]);
            }
        } catch (e) {
            const errObj = e.response?.data || {};
            setTestReport([{ step: "API Connection", success: false, message: errObj.error || e.message }]);
        } finally {
            setTesting(false);
        }
    };

    const handleSystemRefresh = async () => {
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/system/refresh`, {}, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage({ type: 'success', text: 'System Cache Cleared Successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to clear cache' });
        }
    };

    const handleRollback = async () => {
        if (!window.confirm("Are you sure you want to rollback to the previous Meta configurations? This will restore the last saved versions instantly.")) {
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/system/rollback-meta`, {}, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage({ type: 'success', text: res.data.message || 'Meta configurations rolled back successfully!' });
            fetchSettings();
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to rollback configurations.' });
        }
        setLoading(false);
    };

    const toggleStep = (index) => {
        setExpandedSteps(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 text-sm">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">System Updates & Diagnostics</h1>
                    <p className="text-sm text-gray-500">Manage API versions, system parameters, and connection testing.</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={handleSystemRefresh}
                        className="flex items-center gap-2 bg-gray-50 text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 transition text-sm font-semibold"
                    >
                        <RefreshCw size={16} /> Clear Cache
                    </button>
                    <button
                        onClick={handleRollback}
                        className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-lg hover:bg-red-100 transition text-sm font-semibold"
                    >
                        <ShieldAlert size={16} /> Rollback Versions
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition text-sm font-semibold shadow-sm"
                    >
                        <Save size={16} /> {loading ? 'Saving...' : 'Save All Settings'}
                    </button>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg text-sm font-semibold ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {message.text}
                </div>
            )}

            {/* Compact Status Bar */}
            <div className="bg-white px-6 py-3.5 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-5 items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Graph API:</span>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded font-mono font-bold text-sm">{settings.metaGraphApiVersion || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Embedded Signup:</span>
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded font-mono font-bold text-sm">{settings.metaEmbeddedSignupVersion || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">JS SDK:</span>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded font-mono font-bold text-sm">{settings.metaJsSdkVersion || 'N/A'}</span>
                    </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="font-semibold text-gray-400 uppercase">Last Updated:</span>
                    <span className="font-medium text-gray-600">{settings.metaSettingsLastUpdated ? new Date(settings.metaSettingsLastUpdated).toLocaleString() : 'N/A'}</span>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left: Configuration Panel */}
                <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-6">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-2.5">
                        <Save size={18} className="text-indigo-600" /> Platform Configuration
                    </h2>

                    <form className="space-y-6">
                        {/* Maintenance Toggle */}
                        <div className="p-4 bg-orange-50/40 rounded-lg border border-orange-100/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <AlertTriangle size={18} className="text-orange-500" />
                                <div>
                                    <div className="font-bold text-sm text-gray-800">Platform Maintenance Mode</div>
                                    <div className="text-xs text-gray-500">Temporarily disables tenant panel logins.</div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="maintenanceMode"
                                    checked={settings.maintenanceMode}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                            </label>
                        </div>

                        {/* WhatsApp Business App Onboarding Toggle */}
                        <div className="p-4 bg-indigo-50/40 rounded-lg border border-indigo-100/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <MessageSquare size={18} className="text-indigo-600" />
                                <div>
                                    <div className="font-bold text-sm text-gray-800">WhatsApp Business App Onboarding</div>
                                    <div className="text-xs text-gray-500">Enables high-version feature flow for business app signup setup.</div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="metaBusinessAppOnboardingEnabled"
                                    checked={settings.metaBusinessAppOnboardingEnabled}
                                    onChange={handleChange}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Version Selectors Row */}
                        <div>
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Meta API Target Settings</span>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Graph API Version</label>
                                    <select
                                        name="metaGraphApiVersion"
                                        value={settings.metaGraphApiVersion}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-sm bg-white"
                                    >
                                        {versionsWhitelist.map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Embedded Signup</label>
                                    <select
                                        name="metaEmbeddedSignupVersion"
                                        value={settings.metaEmbeddedSignupVersion}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-sm bg-white"
                                    >
                                        {versionsWhitelist.map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">JS SDK Version</label>
                                    <select
                                        name="metaJsSdkVersion"
                                        value={settings.metaJsSdkVersion}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-sm bg-white"
                                    >
                                        {versionsWhitelist.map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Token & System Values Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Webhook Verify Token</label>
                                <input
                                    type="text"
                                    name="webhookVerifyToken"
                                    value={settings.webhookVerifyToken}
                                    onChange={handleChange}
                                    placeholder="Secure verify token"
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Default Trial Days</label>
                                <input
                                    type="number"
                                    name="defaultTrialDays"
                                    value={settings.defaultTrialDays}
                                    onChange={handleChange}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right: Diagnostics & Testing */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Live Health Status */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Activity size={16} className="text-green-500" /> Platform API Heartbeat
                        </h2>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700">Webhook Monitor Service</h3>
                                <p className="text-xs text-gray-500">Active API response listener</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`flex w-2.5 h-2.5 rounded-full ${webhookStatus.includes('Online') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                <span className="font-mono text-sm font-bold text-gray-700">{webhookStatus}</span>
                            </div>
                        </div>
                    </div>

                    {/* Meta Diagnostics & Sandbox */}
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-50 pb-2">
                            <PlayCircle size={16} className="text-blue-500" /> Compatibility Sandbox
                        </h2>

                        <div className="space-y-3.5">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Draft Meta Version</label>
                                    <select
                                        name="draftMetaApiVersion"
                                        value={settings.draftMetaApiVersion}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 font-mono text-xs bg-blue-50/50"
                                    >
                                        <option value="">Use Active Version</option>
                                        {versionsWhitelist.map(v => (
                                            <option key={v} value={v}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1">System User Token</label>
                                    <input
                                        type="password"
                                        name="systemMetaToken"
                                        value={settings.systemMetaToken}
                                        onChange={handleChange}
                                        placeholder="System Meta token"
                                        className="w-full px-3 py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleTestMeta}
                                disabled={testing || !settings.systemMetaToken}
                                className="bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition w-full font-semibold disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-sm"
                            >
                                {testing ? 'Testing Meta Connection...' : 'Test Meta Configuration'}
                            </button>
                        </div>

                        {/* Diagnostic Results Report */}
                        <div className="space-y-2.5">
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 pb-1.5">Report Outcomes</span>
                            {testReport.length === 0 ? (
                                <div className="text-xs text-gray-400 text-center py-5 bg-gray-50 rounded border border-dashed border-gray-200 font-mono">
                                    // Trigger test to generate checklist
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                    {testReport.map((rep, idx) => (
                                        <div key={idx} className="bg-white border border-gray-100 rounded shadow-xs">
                                            <div
                                                onClick={() => toggleStep(idx)}
                                                className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition select-none"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {rep.success ? (
                                                        <CheckCircle className="text-green-500" size={16} />
                                                    ) : (
                                                        <XCircle className="text-red-500" size={16} />
                                                    )}
                                                    <span className="text-sm font-medium text-gray-700">{rep.step}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${rep.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                        {rep.success ? 'Pass' : 'Fail'}
                                                    </span>
                                                    {expandedSteps[idx] ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                </div>
                                            </div>
                                            {expandedSteps[idx] && (
                                                <div className="p-3.5 bg-gray-50 border-t border-gray-100 text-xs font-mono text-gray-500 whitespace-pre-wrap leading-relaxed">
                                                    {rep.message}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SystemUpdates;
