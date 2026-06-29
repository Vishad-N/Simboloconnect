import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Plus, Trash2, CheckCircle, XCircle, Send } from 'lucide-react';

const PROVIDERS = [
    { id: 'FAST2SMS', name: 'Fast2SMS' },
    { id: 'MSG91', name: 'MSG91' },
    { id: 'TWILIO', name: 'Twilio' },
    { id: 'PLIVO', name: 'Plivo' },
    { id: 'VONAGE', name: 'Vonage (Nexmo)' },
    { id: 'CUSTOM', name: 'Custom HTTP Webhook' }
];

const SmsGateways = () => {
    const [gateways, setGateways] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        id: null,
        provider: 'FAST2SMS',
        is_primary: false,
        is_secondary: false,
        status: 'ACTIVE',
        config: {}
    });

    const [testPhone, setTestPhone] = useState('');
    const [testingId, setTestingId] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    const fetchGateways = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/sms-gateways`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setGateways(res.data);
        } catch (error) {
            console.error(error);
            showMessage("Failed to load gateways", "error");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGateways();
    }, []);

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const handleConfigChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            config: { ...prev.config, [field]: value }
        }));
    };

    const handleProviderChange = (e) => {
        setFormData({
            ...formData,
            provider: e.target.value,
            config: {} // Reset config when provider changes
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                provider: formData.provider,
                config_json: formData.config,
                is_primary: formData.is_primary,
                is_secondary: formData.is_secondary,
                status: formData.status
            };

            if (formData.id) {
                await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/sms-gateways/${formData.id}`, payload, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                showMessage("Gateway updated successfully!");
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/sms-gateways`, payload, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                showMessage("Gateway created successfully!");
            }
            setIsEditing(false);
            fetchGateways();
        } catch (error) {
            showMessage(error.response?.data?.error || "Failed to save gateway", "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this SMS gateway?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/sms-gateways/${id}`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            showMessage("Gateway deleted!");
            fetchGateways();
        } catch (error) {
            showMessage("Failed to delete gateway", "error");
        }
    };

    const handleTest = async (id) => {
        if (!testPhone) {
            showMessage("Please enter a test phone number", "error");
            return;
        }
        setTestingId(id);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/sms-gateways/${id}/test`,
                { testPhone },
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            showMessage(res.data.message || "Test SMS sent successfully!");
        } catch (error) {
            showMessage(error.response?.data?.error || "Test failed", "error");
        }
        setTestingId(null);
    };

    const openEditForm = (gateway = null) => {
        if (gateway) {
            setFormData({
                id: gateway.id,
                provider: gateway.provider,
                is_primary: gateway.is_primary,
                is_secondary: gateway.is_secondary,
                status: gateway.status,
                config: gateway.config_json || {}
            });
        } else {
            setFormData({
                id: null,
                provider: 'FAST2SMS',
                is_primary: false,
                is_secondary: false,
                status: 'ACTIVE',
                config: {}
            });
        }
        setIsEditing(true);
    };

    const renderConfigFields = () => {
        switch (formData.provider) {
            case 'FAST2SMS':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">API Key</label>
                            <input type="password" value={formData.config.apiKey || ''} onChange={e => handleConfigChange('apiKey', e.target.value)} className="input-field" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Sender ID</label>
                                <input type="text" value={formData.config.senderId || 'TXTIND'} onChange={e => handleConfigChange('senderId', e.target.value)} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Route</label>
                                <input type="text" value={formData.config.route || 'v3'} onChange={e => handleConfigChange('route', e.target.value)} className="input-field" />
                            </div>
                        </div>
                    </>
                );
            case 'MSG91':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Auth Key</label>
                            <input type="password" value={formData.config.authKey || ''} onChange={e => handleConfigChange('authKey', e.target.value)} className="input-field" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Template ID (DLT)</label>
                                <input type="text" value={formData.config.templateId || ''} onChange={e => handleConfigChange('templateId', e.target.value)} className="input-field" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Sender ID (Optional)</label>
                                <input type="text" value={formData.config.senderId || ''} onChange={e => handleConfigChange('senderId', e.target.value)} className="input-field" />
                            </div>
                        </div>
                    </>
                );
            case 'TWILIO':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Account SID</label>
                                <input type="text" value={formData.config.accountSid || ''} onChange={e => handleConfigChange('accountSid', e.target.value)} className="input-field" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Auth Token</label>
                                <input type="password" value={formData.config.authToken || ''} onChange={e => handleConfigChange('authToken', e.target.value)} className="input-field" required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">From Number</label>
                            <input type="text" value={formData.config.fromNumber || ''} onChange={e => handleConfigChange('fromNumber', e.target.value)} className="input-field" placeholder="+1234567890" required />
                        </div>
                    </>
                );
            case 'PLIVO':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Auth ID</label>
                                <input type="text" value={formData.config.authId || ''} onChange={e => handleConfigChange('authId', e.target.value)} className="input-field" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Auth Token</label>
                                <input type="password" value={formData.config.authToken || ''} onChange={e => handleConfigChange('authToken', e.target.value)} className="input-field" required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Source Number</label>
                            <input type="text" value={formData.config.srcNumber || ''} onChange={e => handleConfigChange('srcNumber', e.target.value)} className="input-field" placeholder="1234567890" required />
                        </div>
                    </>
                );
            case 'VONAGE':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">API Key</label>
                                <input type="text" value={formData.config.apiKey || ''} onChange={e => handleConfigChange('apiKey', e.target.value)} className="input-field" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">API Secret</label>
                                <input type="password" value={formData.config.apiSecret || ''} onChange={e => handleConfigChange('apiSecret', e.target.value)} className="input-field" required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">From Name</label>
                            <input type="text" value={formData.config.fromName || 'System'} onChange={e => handleConfigChange('fromName', e.target.value)} className="input-field" required />
                        </div>
                    </>
                );
            case 'CUSTOM':
                return (
                    <>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-surface-700 mb-1">API URL</label>
                                <input type="text" value={formData.config.apiUrl || ''} onChange={e => handleConfigChange('apiUrl', e.target.value)} className="input-field" placeholder="https://api.example.com/send?to={mobile}&msg={otp}" required />
                                <p className="text-xs text-surface-500 mt-1">Supports {'{mobile}'} and {'{otp}'} tags.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">HTTP Method</label>
                                <select value={formData.config.method || 'POST'} onChange={e => handleConfigChange('method', e.target.value)} className="input-field">
                                    <option value="POST">POST</option>
                                    <option value="GET">GET</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Headers (JSON format)</label>
                            <textarea value={formData.config.headersJson || '{\n  "Content-Type": "application/json"\n}'} onChange={e => handleConfigChange('headersJson', e.target.value)} className="input-field font-mono" rows={3}></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Payload Body (JSON format)</label>
                            <textarea value={formData.config.payloadJson || '{\n  "recipient": "{mobile}",\n  "message": "Your OTP is {otp}"\n}'} onChange={e => handleConfigChange('payloadJson', e.target.value)} className="input-field font-mono" rows={4}></textarea>
                        </div>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-surface-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900">SMS Gateways</h2>
                    <p className="text-sm text-surface-500 mt-1">Configure external providers for delivering OTPs directly to mobile phones.</p>
                </div>
                {!isEditing && (
                    <button onClick={() => openEditForm()} className="btn-primary flex items-center">
                        <Plus size={18} className="mr-2" />
                        Add Gateway
                    </button>
                )}
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {message.type === 'error' ? <XCircle size={20} className="mt-0.5 shrink-0" /> : <CheckCircle size={20} className="mt-0.5 shrink-0" />}
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            {isEditing ? (
                <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-surface-200 bg-surface-50">
                        <h3 className="text-lg font-semibold text-surface-900">{formData.id ? 'Edit Gateway' : 'New Gateway Configuration'}</h3>
                    </div>

                    <form onSubmit={handleSave} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Provider Service</label>
                                <select
                                    value={formData.provider}
                                    onChange={handleProviderChange}
                                    className="input-field"
                                    disabled={!!formData.id} // Don't allow changing provider type after creation for simplicity
                                >
                                    {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-5 bg-surface-50 rounded-lg border border-surface-200 space-y-4">
                            <h4 className="text-sm font-semibold text-surface-800 uppercase tracking-wider">{PROVIDERS.find(p => p.id === formData.provider)?.name} Credentials</h4>
                            {renderConfigFields()}
                        </div>

                        <div className="flex gap-6 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_primary}
                                    onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <span className="text-sm font-medium text-surface-800">Set as Primary Gateway</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_secondary}
                                    onChange={e => setFormData({ ...formData, is_secondary: e.target.checked })}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <span className="text-sm font-medium text-surface-800">Set as Secondary (Fallback) Gateway</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-surface-200">
                            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-surface-600 font-medium hover:bg-surface-100 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary flex items-center">
                                <Save size={18} className="mr-2" />
                                Save Configuration
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-12 text-center text-surface-500">Loading gateways...</div>
                    ) : gateways.length === 0 ? (
                        <div className="bg-surface-50 border border-dashed border-surface-300 rounded-xl p-12 text-center">
                            <p className="text-surface-500 mb-4">No SMS Gateways configured yet.</p>
                            <button onClick={() => openEditForm()} className="btn-primary mx-auto flex items-center">
                                <Plus size={18} className="mr-2" /> Add First Gateway
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {gateways.map(gateway => (
                                <div key={gateway.id} className="bg-white border border-surface-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-5 flex-1 cursor-pointer hover:bg-surface-50 transition-colors" onClick={() => openEditForm(gateway)}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-lg">
                                                    {PROVIDERS.find(p => p.id === gateway.provider)?.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-surface-900">{PROVIDERS.find(p => p.id === gateway.provider)?.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gateway.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {gateway.status}
                                                        </span>
                                                        {gateway.is_primary && <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">PRIMARY</span>}
                                                        {gateway.is_secondary && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">SECONDARY</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(gateway.id); }}
                                                className="text-surface-400 hover:text-red-500 transition-colors p-2"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-surface-50 border-t border-surface-200 p-4 flex gap-3">
                                        <input
                                            type="text"
                                            placeholder="Test Phone Num (e.g. 919876543210)"
                                            value={testPhone}
                                            onChange={e => setTestPhone(e.target.value)}
                                            className="input-field text-sm"
                                        />
                                        <button
                                            onClick={() => handleTest(gateway.id)}
                                            disabled={testingId === gateway.id}
                                            className="whitespace-nowrap bg-surface-200 hover:bg-surface-300 text-surface-800 font-medium px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                                        >
                                            {testingId === gateway.id ? 'Sending...' : <><Send size={14} className="mr-2" /> Test SMS</>}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmsGateways;
