import React, { useState, useEffect } from 'react';
import { Box, Settings, AlertTriangle, CheckCircle2, X, Save, RefreshCw } from 'lucide-react';

const WooCommerceIntegration = () => {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [config, setConfig] = useState({ siteUrl: '', consumerKey: '', consumerSecret: '' });
    const [savedConfig, setSavedConfig] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('woo_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            setSavedConfig(parsed);
            setConfig(parsed);
            if (parsed.siteUrl && parsed.consumerKey) setConnected(true);
        }
    }, []);

    const handleConnect = () => {
        setShowSettings(true);
    };

    const handleSave = () => {
        if (!config.siteUrl || !config.consumerKey || !config.consumerSecret) {
            alert('Site URL, Consumer Key, and Consumer Secret are required.');
            return;
        }
        setLoading(true);
        setTimeout(() => {
            localStorage.setItem('woo_config', JSON.stringify(config));
            setSavedConfig(config);
            setConnected(true);
            setShowSettings(false);
            setLoading(false);
        }, 800);
    };

    const handleDisconnect = () => {
        if (confirm('Are you sure you want to disconnect WooCommerce?')) {
            localStorage.removeItem('woo_config');
            setSavedConfig(null);
            setConfig({ siteUrl: '', consumerKey: '', consumerSecret: '' });
            setConnected(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-purple-500/20 to-purple-500/5 p-6 rounded-2xl border border-purple-500/30">
                <h1 className="text-3xl font-bold font-display text-purple-400 flex items-center gap-3">
                    <Box size={32} /> WooCommerce Dashboard
                </h1>
                <button onClick={() => setShowSettings(true)} className="btn-secondary flex items-center gap-2">
                    <Settings size={16} /> Settings
                </button>
            </div>

            {connected ? (
                <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-2xl border border-green-500/30 bg-green-500/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 size={24} className="text-green-400" />
                                <div>
                                    <p className="text-green-400 font-semibold text-lg">Connected to WooCommerce</p>
                                    <p className="text-surface-400 text-sm">Store: {savedConfig?.siteUrl}</p>
                                </div>
                            </div>
                            <button onClick={handleDisconnect} className="text-red-400 hover:text-red-300 text-sm font-medium border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                                Disconnect
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                            <p className="text-sm text-surface-400 mb-2">Total Orders</p>
                            <h3 className="text-3xl font-bold text-white">0</h3>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                            <p className="text-sm text-surface-400 mb-2">Pending</p>
                            <h3 className="text-3xl font-bold text-yellow-400">0</h3>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl border border-surface-700 bg-purple-500/10 border-purple-500/30">
                            <p className="text-sm text-purple-400 mb-2">Revenue</p>
                            <h3 className="text-3xl font-bold text-purple-400">₹0</h3>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Recent Orders</h3>
                            <button className="btn-secondary text-sm flex items-center gap-2">
                                <RefreshCw size={14} /> Sync Orders
                            </button>
                        </div>
                        <div className="text-center py-8 text-surface-400">
                            <Box size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No orders synced yet. Click "Sync Orders" to fetch from WooCommerce.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass-panel p-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex flex-col items-start gap-4">
                        <p className="text-yellow-400 font-medium flex items-center gap-2">
                            <AlertTriangle size={20} /> Not Connected! Please connect your WooCommerce store to start receiving order notifications.
                        </p>
                        <button 
                            onClick={handleConnect}
                            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            Connect WooCommerce
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-surface-700">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Box size={22} className="text-purple-400" /> WooCommerce Settings
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-surface-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1.5">WordPress Site URL <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={config.siteUrl}
                                    onChange={e => setConfig({ ...config, siteUrl: e.target.value })}
                                    placeholder="https://your-store.com"
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1.5">Consumer Key <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={config.consumerKey}
                                    onChange={e => setConfig({ ...config, consumerKey: e.target.value })}
                                    placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1.5">Consumer Secret <span className="text-red-400">*</span></label>
                                <input
                                    type="password"
                                    value={config.consumerSecret}
                                    onChange={e => setConfig({ ...config, consumerSecret: e.target.value })}
                                    placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                                    className="input-field w-full"
                                />
                            </div>
                            <div className="bg-surface-800 rounded-xl p-4 text-sm text-surface-400">
                                <p className="font-medium text-surface-300 mb-1">How to get these credentials:</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs">
                                    <li>Go to WordPress Admin → WooCommerce → Settings → Advanced → REST API</li>
                                    <li>Click "Add key" → Set description and permissions (Read/Write)</li>
                                    <li>Copy Consumer Key and Consumer Secret</li>
                                </ol>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-surface-700">
                            <button onClick={() => setShowSettings(false)} className="btn-secondary flex-1">Cancel</button>
                            <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 shadow-purple-500/25">
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                {loading ? 'Saving...' : 'Save & Connect'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WooCommerceIntegration;
