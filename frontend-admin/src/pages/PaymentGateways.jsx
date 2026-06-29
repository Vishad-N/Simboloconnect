import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CreditCard, DollarSign, Wallet } from 'lucide-react';

const PaymentGateways = () => {
    const [settings, setSettings] = useState({
        razorpayKeyId: '',
        razorpayKeySecret: '',
        stripeKeyPub: '',
        stripeKeySecret: '',
        airwallexClientId: '',
        airwallexApiKey: '',
        phonepeMerchantId: '',
        phonepeSaltKey: '',
        activePaymentGateway: 'RAZORPAY',
        systemCurrency: 'INR',
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
                    razorpayKeyId: res.data.RAZORPAY_KEY_ID || '',
                    razorpayKeySecret: res.data.RAZORPAY_KEY_SECRET || '',
                    stripeKeyPub: res.data.STRIPE_KEY_PUB || '',
                    stripeKeySecret: res.data.STRIPE_KEY_SECRET || '',
                    airwallexClientId: res.data.AIRWALLEX_CLIENT_ID || '',
                    airwallexApiKey: res.data.AIRWALLEX_API_KEY || '',
                    activePaymentGateway: res.data.ACTIVE_PAYMENT_GATEWAY || 'RAZORPAY',
                    systemCurrency: res.data.SYSTEM_CURRENCY || 'INR',
                    phonepeMerchantId: res.data.PHONEPE_MERCHANT_ID || '',
                    phonepeSaltKey: res.data.PHONEPE_SALT_KEY || '',
                });
            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, settings, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage('Payment configuration saved successfully!');
        } catch (err) {
            setMessage('Failed to save settings.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-surface-900 mb-2">Payment Gateways</h1>
                <p className="text-surface-500">Manage global currency and configure API keys for multiple payment processors.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                
                <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-200 pb-4">
                        <DollarSign className="text-brand-600" size={24} />
                        <h3 className="text-xl font-semibold text-surface-800">Global Configuration</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-50 p-5 rounded-lg border border-surface-200">
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Active Payment Gateway</label>
                            <p className="text-xs text-surface-500 mb-3">This gateway will be used for all checkout sessions.</p>
                            <select
                                value={settings.activePaymentGateway}
                                onChange={(e) => setSettings({ ...settings, activePaymentGateway: e.target.value })}
                                className="input-field shadow-sm bg-white"
                            >
                                <option value="RAZORPAY">Razorpay</option>
                                <option value="STRIPE">Stripe</option>
                                <option value="AIRWALLEX">Airwallex</option>
                                <option value="PHONEPE">PhonePe</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Global Currency</label>
                            <p className="text-xs text-surface-500 mb-3">This currency will sync across all pricing display and payments.</p>
                            <select
                                value={settings.systemCurrency}
                                onChange={(e) => setSettings({ ...settings, systemCurrency: e.target.value })}
                                className="input-field shadow-sm bg-white"
                            >
                                <option value="INR">INR - Indian Rupee (₹)</option>
                                <option value="USD">USD - US Dollar ($)</option>
                                <option value="EUR">EUR - Euro (€)</option>
                                <option value="GBP">GBP - British Pound (£)</option>
                                <option value="AUD">AUD - Australian Dollar (A$)</option>
                                <option value="CAD">CAD - Canadian Dollar (C$)</option>
                                <option value="SAR">SAR - Saudi Riyal (ر.س)</option>
                                <option value="AED">AED - UAE Dirham (د.إ)</option>
                                <option value="QAR">QAR - Qatari Riyal (QAR)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Razorpay */}
                    <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Wallet className="text-blue-500" size={20} />
                            <h4 className="text-lg font-semibold text-surface-800">Razorpay</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Key ID</label>
                                <input type="text" value={settings.razorpayKeyId} onChange={(e) => setSettings({ ...settings, razorpayKeyId: e.target.value })} className="input-field font-mono text-sm" placeholder="rzp_..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Key Secret</label>
                                <input type="password" value={settings.razorpayKeySecret} onChange={(e) => setSettings({ ...settings, razorpayKeySecret: e.target.value })} className="input-field font-mono text-sm" placeholder="••••••••••••••••" />
                            </div>
                        </div>
                    </div>

                    {/* Stripe */}
                    <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CreditCard className="text-[#635BFF]" size={20} />
                            <h4 className="text-lg font-semibold text-surface-800">Stripe</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Publishable Key</label>
                                <input type="text" value={settings.stripeKeyPub} onChange={(e) => setSettings({ ...settings, stripeKeyPub: e.target.value })} className="input-field font-mono text-sm" placeholder="pk_..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Secret Key</label>
                                <input type="password" value={settings.stripeKeySecret} onChange={(e) => setSettings({ ...settings, stripeKeySecret: e.target.value })} className="input-field font-mono text-sm" placeholder="sk_..." />
                            </div>
                        </div>
                    </div>

                    {/* Airwallex */}
                    <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CreditCard className="text-black" size={20} />
                            <h4 className="text-lg font-semibold text-surface-800">Airwallex</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Client ID</label>
                                <input type="text" value={settings.airwallexClientId} onChange={(e) => setSettings({ ...settings, airwallexClientId: e.target.value })} className="input-field font-mono text-sm" placeholder="ClientId..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">API Key</label>
                                <input type="password" value={settings.airwallexApiKey} onChange={(e) => setSettings({ ...settings, airwallexApiKey: e.target.value })} className="input-field font-mono text-sm" placeholder="••••••••••••••••" />
                            </div>
                        </div>
                    </div>

                    {/* PhonePe */}
                    <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <CreditCard className="text-[#5f259f]" size={20} />
                            <h4 className="text-lg font-semibold text-surface-800">PhonePe</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Merchant ID</label>
                                <input type="text" value={settings.phonepeMerchantId} onChange={(e) => setSettings({ ...settings, phonepeMerchantId: e.target.value })} className="input-field font-mono text-sm" placeholder="M..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Salt Key</label>
                                <input type="password" value={settings.phonepeSaltKey} onChange={(e) => setSettings({ ...settings, phonepeSaltKey: e.target.value })} className="input-field font-mono text-sm" placeholder="••••••••-••••-••••-••••-••••••••••••" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex justify-end items-center gap-4">
                    <span className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{message}</span>
                    <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto flex items-center justify-center">
                        <Save size={18} className="mr-2" />
                        {loading ? 'Saving...' : 'Save All Configurations'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PaymentGateways;
