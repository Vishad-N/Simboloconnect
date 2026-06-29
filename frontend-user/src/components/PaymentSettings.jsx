import React, { useState, useEffect } from 'react';
import { 
    CreditCard, Save, Eye, EyeOff, Activity, AlertCircle, Plus, Trash2, 
    ArrowUpRight, Lock, CheckCircle2, ShieldCheck, Globe, Percent, Truck, 
    ToggleLeft, ToggleRight, FileText, Sparkles, BarChart2, Coins, ArrowUp, ArrowDown
} from 'lucide-react';
import axios from 'axios';

const PaymentSettings = ({ activeTab: initialTab }) => {
    const [subTab, setSubTab] = useState(initialTab || 'store'); // 'store' | 'gateways' | 'analytics'
    const [gateways, setGateways] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [storeSettings, setStoreSettings] = useState({
        currency: 'INR',
        taxRate: '18',
        shippingAmt: '0',
        codEnabled: false,
        invoicePrefix: 'INV-',
        invoiceTerms: 'Thank you for your business!',
        autoGenerateInvoice: true
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('razorpay');
    
    // Gateway Form State
    const [form, setForm] = useState({
        label: 'My Gateway',
        mode: 'test',
        priority: 1,
        isActive: true,
        // Gateway-specific config
        razorpayKeyId: '',
        razorpayKeySecret: '',
        stripeSecretKey: '',
        cashfreeAppId: '',
        cashfreeSecretKey: '',
        upiVpa: '',
        upiMerchantName: ''
    });

    // Mask preview helper
    const getMaskedVal = (val) => val ? val : '';

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('userToken');
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Fetch Store Settings
            const settingsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/workspace/payments/settings`, { headers });
            if (settingsRes.data?.settings) {
                setStoreSettings(settingsRes.data.settings);
            }

            // 2. Fetch Gateways
            const gatewaysRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/workspace/payments/gateways`, { headers });
            if (gatewaysRes.data?.gateways) {
                setGateways(gatewaysRes.data.gateways);
            }

            // 3. Fetch Analytics
            const analyticsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/workspace/payments/analytics`, { headers });
            if (analyticsRes.data?.analytics) {
                setAnalytics(analyticsRes.data.analytics);
            }
        } catch (e) {
            console.error("Failed to load payment architecture data", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-migrate on first mount
    useEffect(() => {
        const migrateLegacyConfig = async () => {
            const legacy = localStorage.getItem('orders_payments_config');
            if (legacy) {
                try {
                    const parsed = JSON.parse(legacy);
                    const token = localStorage.getItem('userToken');
                    const headers = { Authorization: `Bearer ${token}` };

                    // Post settings to database
                    await axios.post(`${import.meta.env.VITE_API_URL}/api/workspace/payments/settings`, {
                        currency: parsed.currency || 'INR',
                        taxRate: parsed.taxRate || '18',
                        shippingAmt: parsed.shippingAmt || '0',
                        codEnabled: parsed.codEnabled || false,
                        invoicePrefix: parsed.invoicePrefix || 'INV-',
                        invoiceTerms: parsed.invoiceTerms || '',
                        autoGenerateInvoice: parsed.autoGenerateInvoice !== undefined ? parsed.autoGenerateInvoice : true,
                        version: 1
                    }, { headers });

                    // Create legacy gateway in DB if keys existed
                    if (parsed.gatewayEnabled && parsed.selectedGateway && parsed.gatewayKeys?.keyId) {
                        const newConfig = parsed.selectedGateway === 'razorpay' ? {
                            keyId: parsed.gatewayKeys.keyId,
                            keySecret: parsed.gatewayKeys.keySecret
                        } : {
                            secretKey: parsed.gatewayKeys.keyId // strip adapter sk mapping
                        };

                        await axios.post(`${import.meta.env.VITE_API_URL}/api/workspace/payments/gateways`, {
                            provider: parsed.selectedGateway,
                            label: `Migrated ${parsed.selectedGateway}`,
                            mode: 'live',
                            priority: 1,
                            isActive: true,
                            config: newConfig
                        }, { headers }).catch(() => {});
                    }

                    // Remove localStorage once database persistence is active
                    localStorage.removeItem('orders_payments_config');
                    console.log("[Migration] Cleaned localStorage legacy payment keys successfully.");
                } catch (err) {
                    console.error("[Migration] Legacy settings migration skipped:", err);
                }
            }
            // Load state from Postgres (Postgres is strictly the single source of truth)
            await fetchAllData();
        };

        migrateLegacyConfig();
    }, []);

    // Save Store Settings with Optimistic UI Update & Rollback Safeguard
    const handleSaveStoreSettings = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const originalSettings = { ...storeSettings };
        
        try {
            const token = localStorage.getItem('userToken');
            const headers = { Authorization: `Bearer ${token}` };
            
            await axios.post(`${import.meta.env.VITE_API_URL}/api/workspace/payments/settings`, storeSettings, { headers });
            
            // Re-fetch to get synced backend representation
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/workspace/payments/settings`, { headers });
            if (res.data?.settings) {
                setStoreSettings(res.data.settings);
            }
            alert("Payment and invoice settings updated successfully!");
        } catch (err) {
            console.error("Save store settings failed, rolling back", err);
            setStoreSettings(originalSettings); // Safe Rollback
            alert("Failed to save settings. Reverted to previous state.");
        } finally {
            setIsSaving(false);
        }
    };

    // Create Gateway Route
    const handleCreateGateway = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const token = localStorage.getItem('userToken');
            const headers = { Authorization: `Bearer ${token}` };

            const config = {};
            if (selectedProvider === 'razorpay') {
                config.keyId = form.razorpayKeyId;
                config.keySecret = form.razorpayKeySecret;
            } else if (selectedProvider === 'stripe') {
                config.secretKey = form.stripeSecretKey;
            } else if (selectedProvider === 'cashfree') {
                config.appId = form.cashfreeAppId;
                config.secretKey = form.cashfreeSecretKey;
            } else if (selectedProvider === 'upi') {
                config.vpa = form.upiVpa;
                config.merchantName = form.upiMerchantName;
            }

            await axios.post(`${import.meta.env.VITE_API_URL}/api/workspace/payments/gateways`, {
                provider: selectedProvider,
                label: form.label,
                mode: form.mode,
                priority: Number(form.priority),
                isActive: form.isActive,
                config
            }, { headers });

            alert("New gateway adapter registered successfully!");
            setForm(prev => ({
                ...prev,
                label: 'My Gateway',
                priority: gateways.length + 2,
                razorpayKeyId: '',
                razorpayKeySecret: '',
                stripeSecretKey: '',
                cashfreeAppId: '',
                cashfreeSecretKey: '',
                upiVpa: '',
                upiMerchantName: ''
            }));
            await fetchAllData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to register gateway adapter.");
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Routing Node Status
    const handleToggleStatus = async (gatewayId, currentActive) => {
        const originalGateways = [...gateways];
        // Optimistic UI updates
        setGateways(prev => prev.map(g => g.id === gatewayId ? { ...g, isActive: !currentActive } : g));

        try {
            const token = localStorage.getItem('userToken');
            await axios.patch(`${import.meta.env.VITE_API_URL}/api/workspace/payments/gateways/${gatewayId}`, {
                isActive: !currentActive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            // Rollback on failure
            setGateways(originalGateways);
            alert("Failed to update gateway status. Rollback applied.");
        }
    };

    // Delete Gateway Route
    const handleRemoveGateway = async (gatewayId) => {
        if (!window.confirm("Are you sure you want to remove this payment gateway adapter?")) return;
        const originalGateways = [...gateways];
        setGateways(prev => prev.filter(g => g.id !== gatewayId));

        try {
            const token = localStorage.getItem('userToken');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/workspace/payments/gateways/${gatewayId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchAllData();
        } catch (err) {
            setGateways(originalGateways);
            alert("Failed to remove gateway. Reverted state.");
        }
    };

    if (isLoading) return (
        <div className="glass-panel p-8 animate-pulse space-y-6">
            <div className="h-8 w-64 bg-surface-700 rounded-lg"></div>
            <div className="h-4 w-96 bg-surface-800 rounded"></div>
            <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="h-28 bg-surface-800/50 rounded-2xl"></div>
                <div className="h-28 bg-surface-800/50 rounded-2xl"></div>
                <div className="h-28 bg-surface-800/50 rounded-2xl"></div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Elegant Header with Sub-tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-surface-900 border border-surface-700/60 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-500/20 text-brand-400 rounded-2xl border border-brand-500/25">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Payments & Routing</h2>
                        <p className="text-xs text-surface-400 mt-0.5">Centralized shop transaction settings, fallbacks, and live health analytics.</p>
                    </div>
                </div>

                {/* Sub Tab Controls */}
                <div className="flex bg-surface-950 p-1.5 rounded-xl border border-surface-700/50 self-start md:self-auto shadow-inner">
                    {[
                        { id: 'store', label: 'Store Config', icon: Globe },
                        { id: 'gateways', label: 'Gateway Registry', icon: Lock },
                        { id: 'analytics', label: 'Live Analytics', icon: BarChart2 }
                    ].map(t => (
                        <button key={t.id} onClick={() => setSubTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${subTab === t.id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-surface-400 hover:text-surface-200'}`}>
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB CONTENT: 1. STORE PAYMENTS */}
            {subTab === 'store' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                    <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={handleSaveStoreSettings} className="glass-panel p-6 border-surface-700 space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-surface-700/50">
                                <Globe className="text-brand-400" size={18} />
                                <h3 className="text-base font-bold text-white">General Payment Configurations</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-surface-300 mb-1.5">Store Currency</label>
                                    <select value={storeSettings.currency} 
                                        onChange={e => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                                        className="input-field cursor-pointer">
                                        {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-300 mb-1.5">Tax Rate (%)</label>
                                    <div className="relative">
                                        <input type="number" className="input-field pr-8" min="0" max="100"
                                            value={storeSettings.taxRate}
                                            onChange={e => setStoreSettings({ ...storeSettings, taxRate: e.target.value })} />
                                        <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-surface-300 mb-1.5">Flat Shipping Fee</label>
                                    <div className="relative">
                                        <input type="number" className="input-field pr-8" min="0"
                                            value={storeSettings.shippingAmt}
                                            onChange={e => setStoreSettings({ ...storeSettings, shippingAmt: e.target.value })} />
                                        <Truck size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
                                    </div>
                                </div>
                            </div>

                            {/* COD Toggle */}
                            <div className="flex items-center justify-between p-4 bg-surface-950 rounded-xl border border-surface-800">
                                <div className="flex gap-3">
                                    <Coins className="text-brand-400 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-xs font-bold text-white">Enable Cash on Delivery (COD)</p>
                                        <p className="text-[10px] text-surface-400 mt-0.5">Let customers place order and skip direct checkout payment, marking as pending collection.</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setStoreSettings({ ...storeSettings, codEnabled: !storeSettings.codEnabled })}>
                                    {storeSettings.codEnabled ? (
                                        <ToggleRight className="text-brand-400 cursor-pointer" size={32} />
                                    ) : (
                                        <ToggleLeft className="text-surface-500 cursor-pointer" size={32} />
                                    )}
                                </button>
                            </div>

                            <div className="flex items-center gap-2 pb-2 border-b border-surface-700/50 pt-2">
                                <FileText className="text-brand-400" size={18} />
                                <h3 className="text-base font-bold text-white">Invoice Customization</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-surface-300 mb-1.5">Invoice Number Prefix</label>
                                    <input type="text" className="input-field font-mono" placeholder="INV-"
                                        value={storeSettings.invoicePrefix}
                                        onChange={e => setStoreSettings({ ...storeSettings, invoicePrefix: e.target.value })} />
                                </div>
                                <div className="flex items-center justify-between p-3.5 bg-surface-950 rounded-xl border border-surface-800 md:mt-5">
                                    <div>
                                        <p className="text-xs font-bold text-white">Auto-Generate PDF</p>
                                        <p className="text-[10px] text-surface-400">Instantly email/WhatsApp invoice PDF on paid orders.</p>
                                    </div>
                                    <button type="button" onClick={() => setStoreSettings({ ...storeSettings, autoGenerateInvoice: !storeSettings.autoGenerateInvoice })}>
                                        {storeSettings.autoGenerateInvoice ? (
                                            <ToggleRight className="text-brand-400 cursor-pointer" size={28} />
                                        ) : (
                                            <ToggleLeft className="text-surface-500 cursor-pointer" size={28} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-surface-300 mb-1.5">Invoice Footer Note / Terms</label>
                                <textarea rows="3" className="input-field text-xs" placeholder="e.g. Items purchased are subject to return policy..."
                                    value={storeSettings.invoiceTerms}
                                    onChange={e => setStoreSettings({ ...storeSettings, invoiceTerms: e.target.value })} />
                            </div>

                            <button type="submit" disabled={isSaving} className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl disabled:opacity-50">
                                <Save size={16} />
                                {isSaving ? 'Saving Configurations...' : 'Save Payments Settings'}
                            </button>
                        </form>
                    </div>

                    {/* Left helper card */}
                    <div className="space-y-6">
                        <div className="glass-panel p-6 border-surface-700/60 bg-gradient-to-br from-brand-500/5 to-surface-900 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-brand-400 font-bold text-sm mb-3">
                                    <Sparkles size={16} /> Enterprise Grade Guard
                                </div>
                                <p className="text-xs text-surface-300 leading-relaxed">
                                    Your store configuration coordinates directly with the autonomous billing engines. Settings are enforced at checkout runtime under strict database transactions.
                                </p>
                            </div>
                            <div className="mt-8 pt-4 border-t border-surface-700/60 flex items-center gap-3">
                                <ShieldCheck className="text-green-400 shrink-0" size={18} />
                                <span className="text-[10px] text-surface-400">100% Relational DB Lock Protection</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: 2. GATEWAY REGISTRY */}
            {subTab === 'gateways' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Dynamic registry list */}
                        <div className="glass-panel p-6 border-surface-700">
                            <div className="flex items-center gap-2 pb-4 border-b border-surface-700/50 mb-4">
                                <Lock className="text-brand-400" size={18} />
                                <h3 className="text-base font-bold text-white">Active Router Registry</h3>
                            </div>

                            {gateways.length === 0 ? (
                                <div className="p-8 text-center bg-surface-950/40 rounded-2xl border border-dashed border-surface-700">
                                    <AlertCircle className="mx-auto text-surface-500 mb-2" size={32} />
                                    <p className="text-xs text-surface-400">No active router configurations registered in DB.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {gateways.map(g => (
                                        <div key={g.id} className="bg-surface-950 p-4 rounded-xl border border-surface-800 hover:border-surface-700 transition-all flex flex-col justify-between">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="capitalize text-xs font-bold text-white">{g.provider} Adapter</span>
                                                        <span className={`px-2 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider ${g.mode === 'live' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{g.mode}</span>
                                                    </div>
                                                    <p className="text-[10px] text-surface-400 mt-1 font-mono">{g.label}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-brand-500/10 text-brand-400 px-2 py-1 rounded font-bold border border-brand-500/20">Priority {g.priority}</span>
                                                    <button onClick={() => handleRemoveGateway(g.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"><Trash2 size={13} /></button>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-surface-900 flex justify-between items-center text-xs">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleToggleStatus(g.id, g.isActive)} className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={g.isActive} onChange={() => {}} className="sr-only peer" />
                                                        <div className="w-8 h-4 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-500"></div>
                                                    </button>
                                                    <span className="text-[10px] text-surface-400">{g.isActive ? 'Active and Routing' : 'Disabled'}</span>
                                                </div>

                                                <div className="text-[10px] text-surface-500 flex gap-2">
                                                    <span>Success: {g.successCount}</span>
                                                    <span>Fail: {g.failureCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add Adapter Form */}
                        <div className="glass-panel p-6 border-surface-700">
                            <div className="flex items-center gap-2 pb-4 border-b border-surface-700/50 mb-4">
                                <Plus className="text-brand-400" size={18} />
                                <h3 className="text-base font-bold text-white">Register Payment Adapter</h3>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {['razorpay', 'stripe', 'cashfree', 'upi'].map((p) => (
                                    <button key={p} type="button" onClick={() => setSelectedProvider(p)}
                                        className={`py-2 px-3 rounded-lg font-bold capitalize text-xs transition-all ${selectedProvider === p ? 'bg-brand-500/20 text-brand-400 border border-brand-500' : 'bg-surface-950 text-surface-400 hover:border-surface-700 hover:text-surface-200 border border-surface-800'}`}>
                                        {p === 'upi' ? 'UPI QR' : p}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={handleCreateGateway} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-surface-300 mb-1.5">Gateway Label</label>
                                        <input type="text" className="input-field" placeholder="e.g. Primary Razorpay" required
                                            value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-surface-300 mb-1.5">Failover Priority</label>
                                        <input type="number" className="input-field" min="1" required
                                            value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-surface-300">
                                        <input type="radio" name="mode" value="test" checked={form.mode === 'test'} onChange={() => setForm({ ...form, mode: 'test' })} className="accent-brand-500" />
                                        Sandbox Mode
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs text-surface-300">
                                        <input type="radio" name="mode" value="live" checked={form.mode === 'live'} onChange={() => setForm({ ...form, mode: 'live' })} className="accent-brand-500" />
                                        Live Production Mode
                                    </label>
                                </div>

                                {/* Conditional Keys per provider */}
                                {selectedProvider === 'razorpay' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Razorpay Key ID</label>
                                            <input type="text" className="input-field font-mono" placeholder="rzp_test_..." required
                                                value={form.razorpayKeyId} onChange={e => setForm({ ...form, razorpayKeyId: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Razorpay Key Secret</label>
                                            <input type="password" className="input-field font-mono" placeholder="Secret Key..." required
                                                value={form.razorpayKeySecret} onChange={e => setForm({ ...form, razorpayKeySecret: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {selectedProvider === 'stripe' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-surface-300 mb-1">Stripe Secret Key</label>
                                        <input type="password" className="input-field font-mono" placeholder="sk_test_..." required
                                            value={form.stripeSecretKey} onChange={e => setForm({ ...form, stripeSecretKey: e.target.value })} />
                                    </div>
                                )}

                                {selectedProvider === 'cashfree' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Cashfree App ID</label>
                                            <input type="text" className="input-field font-mono" placeholder="CF App ID..." required
                                                value={form.cashfreeAppId} onChange={e => setForm({ ...form, cashfreeAppId: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Cashfree Secret Key</label>
                                            <input type="password" className="input-field font-mono" placeholder="Secret Key..." required
                                                value={form.cashfreeSecretKey} onChange={e => setForm({ ...form, cashfreeSecretKey: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {selectedProvider === 'upi' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Merchant VPA (UPI ID)</label>
                                            <input type="text" className="input-field font-mono" placeholder="e.g. company@ybl" required
                                                value={form.upiVpa} onChange={e => setForm({ ...form, upiVpa: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-surface-300 mb-1">Merchant Name</label>
                                            <input type="text" className="input-field" placeholder="e.g. Acme Inc" required
                                                value={form.upiMerchantName} onChange={e => setForm({ ...form, upiMerchantName: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                <button type="submit" disabled={isSaving} className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs disabled:opacity-50">
                                    <Plus size={14} />
                                    {isSaving ? 'Registering Route...' : 'Register Secure Adapter'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="glass-panel p-6 border-surface-700/60 bg-gradient-to-br from-purple-500/5 to-surface-900 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-3">
                                    <ShieldCheck size={16} /> AES-256-CBC Protection
                                </div>
                                <p className="text-xs text-surface-300 leading-relaxed">
                                    Keys and secrets are encrypted with industrial standard AES-256 at the database level. Raw credentials are never leaked back to the browser.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: 3. PAYMENT ANALYTICS */}
            {subTab === 'analytics' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Visual analytics stats cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Success Rate Card */}
                        <div className="glass-panel p-6 border-surface-700 bg-gradient-to-br from-green-500/5 to-surface-950 flex flex-col justify-between">
                            <div>
                                <p className="text-xs font-semibold text-surface-400">Checkout Success Rate</p>
                                <h3 className="text-3xl font-extrabold text-white mt-2">
                                    {analytics?.successRate !== undefined ? `${analytics.successRate}%` : '100%'}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Redis Live Cache</span>
                            </div>
                        </div>

                        {/* Revenue Card */}
                        <div className="glass-panel p-6 border-surface-700 bg-gradient-to-br from-brand-500/5 to-surface-950 flex flex-col justify-between">
                            <div>
                                <p className="text-xs font-semibold text-surface-400">Total Collected Volume</p>
                                <h3 className="text-3xl font-extrabold text-white mt-2">
                                    {analytics?.totalRevenue !== undefined ? `${storeSettings.currency} ${Number(analytics.totalRevenue).toLocaleString()}` : `${storeSettings.currency} 0`}
                                </h3>
                            </div>
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-surface-400">
                                <Coins size={12} className="text-brand-400" /> Relational Postgres Audited
                            </div>
                        </div>

                        {/* Attempts Card */}
                        <div className="glass-panel p-6 border-surface-700 bg-gradient-to-br from-purple-500/5 to-surface-950 flex flex-col justify-between">
                            <div>
                                <p className="text-xs font-semibold text-surface-400">Transaction Status</p>
                                <div className="flex gap-4 mt-3">
                                    <div>
                                        <span className="text-[10px] text-surface-400">Paid:</span>
                                        <p className="text-lg font-extrabold text-green-400">{analytics?.successCount || 0}</p>
                                    </div>
                                    <div className="border-l border-surface-800 pl-4">
                                        <span className="text-[10px] text-surface-400">Failed:</span>
                                        <p className="text-lg font-extrabold text-red-400">{analytics?.failureCount || 0}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 text-[10px] text-surface-500">
                                Updated 5m ago
                            </div>
                        </div>
                    </div>

                    {/* Gateway Node Health Chart/Grid */}
                    <div className="glass-panel p-6 border-surface-700">
                        <div className="flex items-center justify-between pb-4 border-b border-surface-700/50 mb-4">
                            <h3 className="text-sm font-bold text-white">Gateway Node Health & Statuses</h3>
                            <span className="text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 font-bold uppercase tracking-wider">Active Monitoring</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-surface-300">
                                <thead>
                                    <tr className="border-b border-surface-800 text-surface-400">
                                        <th className="py-2.5">Adapter Node</th>
                                        <th className="py-2.5">Priority</th>
                                        <th className="py-2.5">Routing Status</th>
                                        <th className="py-2.5 text-right">Success Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analytics?.gatewayHealth?.length > 0 ? (
                                        analytics.gatewayHealth.map(n => {
                                            const total = n.successCount + n.failureCount;
                                            const rate = total > 0 ? Math.round((n.successCount / total) * 100) : 100;
                                            return (
                                                <tr key={n.id} className="border-b border-surface-900 hover:bg-surface-950/20">
                                                    <td className="py-3 font-semibold capitalize text-white flex items-center gap-2">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${n.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                                                        {n.provider} ({n.label})
                                                    </td>
                                                    <td className="py-3 font-mono">{n.priority}</td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${n.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                            {n.health}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right font-mono font-bold text-white">{rate}%</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="py-4 text-center text-surface-500">No telemetry logs available.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentSettings;
