import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, Settings, Users as UsersIcon, CreditCard, Search, Plus, Minus, FileText } from 'lucide-react';

const WalletManagement = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [loading, setLoading] = useState(false);
    
    // Tab 1: Users
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [topupAmount, setTopupAmount] = useState('');
    const [topupDesc, setTopupDesc] = useState('');
    const [topupType, setTopupType] = useState('add');
    const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);

    // Tab 2: Pricing
    const [pricingRates, setPricingRates] = useState([]);
    
    // Tab 3: Settings
    const [walletMinRecharge, setWalletMinRecharge] = useState('100');
    const [walletLowAlert, setWalletLowAlert] = useState('50');
    const [walletManagementEnabled, setWalletManagementEnabled] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchPricing();
        fetchSettings();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/users`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setUsers(res.data);
        } catch (e) {
            console.error("Failed fetching users:", e);
        }
    };

    const fetchPricing = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/pricing`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            // Fill default categories if empty
            const defaultCats = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];
            const fetched = res.data;
            const merged = defaultCats.map(cat => {
                const existing = fetched.find(f => f.category === cat);
                return existing || { category: cat, baseCost: 0, markup: 0, totalRate: 0 };
            });
            setPricingRates(merged);
        } catch (e) {
            console.error("Failed fetching pricing:", e);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            if (res.data.WALLET_MIN_RECHARGE) setWalletMinRecharge(res.data.WALLET_MIN_RECHARGE);
            if (res.data.WALLET_LOW_BALANCE_ALERT) setWalletLowAlert(res.data.WALLET_LOW_BALANCE_ALERT);
            if (res.data.WALLET_MANAGEMENT_ENABLED) setWalletManagementEnabled(res.data.WALLET_MANAGEMENT_ENABLED === 'true');
        } catch (e) {
            console.error("Failed fetching settings:", e);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                walletMinRecharge,
                walletLowBalanceAlert: walletLowAlert,
                walletManagementEnabled
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            alert('Settings saved successfully.');
        } catch (e) {
            alert('Failed to save settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePricing = async () => {
        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/pricing`, {
                rates: pricingRates
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            alert('Pricing rates saved successfully.');
            fetchPricing();
        } catch (e) {
            alert('Failed to save pricing rates.');
        } finally {
            setLoading(false);
        }
    };

    const handlePricingChange = (index, field, value) => {
        const newRates = [...pricingRates];
        newRates[index][field] = parseFloat(value) || 0;
        setPricingRates(newRates);
    };

    const handleTopupSubmit = async (e) => {
        e.preventDefault();
        if (!selectedUser || !topupAmount) return;
        
        let finalAmount = parseFloat(topupAmount);
        if (topupType === 'deduct') {
            finalAmount = -finalAmount;
        }

        setLoading(true);
        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/users/${selectedUser.id}/topup`, {
                amount: finalAmount,
                description: topupDesc || `Admin Manual Adjustment`
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            alert('Wallet adjusted successfully.');
            setIsTopupModalOpen(false);
            setTopupAmount('');
            setTopupDesc('');
            fetchUsers(); // Refresh to see updated balances if joined, wait user list doesn't fetch balance currently.
        } catch (e) {
            alert(e.response?.data?.error || 'Failed to adjust wallet.');
        } finally {
            setLoading(false);
        }
    };

    const openTopupModal = (user) => {
        setSelectedUser(user);
        setIsTopupModalOpen(true);
        setTopupType('add');
        setTopupAmount('');
        setTopupDesc('');
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.phone && u.phone.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4 w-full flex items-center">
                <Wallet className="mr-3 text-brand-600" />
                Wallet Management
            </h2>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-surface-200 pb-4">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-50'}`}
                >
                    <UsersIcon size={18} /> Manage Wallets
                </button>
                <button
                    onClick={() => setActiveTab('pricing')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'pricing' ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-50'}`}
                >
                    <CreditCard size={18} /> Category Pricing
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-50'}`}
                >
                    <Settings size={18} /> Global Config
                </button>
            </div>

            {/* Tab 1: User Wallets */}
            {activeTab === 'users' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-surface-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 justify-center text-surface-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search users by name, email, or phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 input-field w-full"
                            />
                        </div>
                    </div>

                    <div className="bg-white border border-surface-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider text-xs">
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Phone</th>
                                        <th className="px-6 py-4">Wallet Balance</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-200">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-surface-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-surface-900">{user.name || 'N/A'}</div>
                                                <div className="text-surface-500 text-xs">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 text-surface-600">{user.phone || 'N/A'}</td>
                                            <td className="px-6 py-4 font-bold text-surface-900">
                                                ₹{user.wallet?.currentBalance !== undefined ? parseFloat(user.wallet.currentBalance).toFixed(2) : '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openTopupModal(user)}
                                                    className="btn-primary text-xs px-3 py-1.5"
                                                >
                                                    Adjust Balance
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-8 text-center text-surface-500 italic">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Pricing */}
            {activeTab === 'pricing' && (
                <div className="space-y-6 max-w-4xl">
                    <div className="bg-white border border-surface-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-surface-900 mb-4">Meta Template Pricing</h3>
                        <p className="text-sm text-surface-500 mb-6">Set the Base Cost (what Meta charges you) and the Reseller Markup (your profit). The system will automatically charge users the Total Rate per template message sent.</p>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-12 gap-4 font-semibold text-surface-600 text-sm border-b border-surface-200 pb-2">
                                <div className="col-span-3">Category</div>
                                <div className="col-span-3">Meta Base Cost (₹)</div>
                                <div className="col-span-3">Reseller Markup (₹)</div>
                                <div className="col-span-3">Total Rate (₹)</div>
                            </div>
                            
                            {pricingRates.map((rate, index) => (
                                <div key={rate.category} className="grid grid-cols-12 gap-4 items-center">
                                    <div className="col-span-3 font-medium text-surface-800">
                                        <span className="px-2 py-1 bg-surface-100 rounded text-xs tracking-wider">{rate.category}</span>
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={rate.baseCost}
                                            onChange={(e) => handlePricingChange(index, 'baseCost', e.target.value)}
                                            className="input-field w-full"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={rate.markup}
                                            onChange={(e) => handlePricingChange(index, 'markup', e.target.value)}
                                            className="input-field w-full"
                                        />
                                    </div>
                                    <div className="col-span-3 font-bold text-surface-900 bg-surface-50 p-2 rounded border border-surface-200 text-center">
                                        ₹{((parseFloat(rate.baseCost) || 0) + (parseFloat(rate.markup) || 0)).toFixed(4)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                onClick={fetchPricing}
                                className="btn-secondary"
                                disabled={loading}
                            >
                                Reset
                            </button>
                            <button
                                onClick={handleSavePricing}
                                className="btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save Pricing Rates'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Settings */}
            {activeTab === 'settings' && (
                <div className="space-y-6 max-w-2xl">
                    <form onSubmit={handleSaveSettings} className="bg-white border border-surface-200 rounded-lg p-6 shadow-sm">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-surface-900 mb-2">Minimum Wallet Top-up (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={walletMinRecharge}
                                    onChange={(e) => setWalletMinRecharge(e.target.value)}
                                    className="input-field w-full"
                                    placeholder="e.g. 100"
                                />
                                <p className="text-xs text-surface-500 mt-1">The minimum amount a user can recharge via Razorpay modal.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-surface-900 mb-2">Low Balance Alert Threshold (₹)</label>
                                <input
                                    type="number"
                                    required
                                    value={walletLowAlert}
                                    onChange={(e) => setWalletLowAlert(e.target.value)}
                                    className="input-field w-full"
                                    placeholder="e.g. 50"
                                />
                                <p className="text-xs text-surface-500 mt-1">The balance limit at which users see the critical red alert banner in their dashboard.</p>
                            </div>

                            <div className="flex items-center justify-between border-t border-surface-200 pt-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-surface-900">Enable User Wallet Management</h4>
                                    <p className="text-xs text-surface-500 mt-1">When enabled, users will see the wallet top-up option and credit limits in their dashboard.</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={walletManagementEnabled}
                                    onClick={() => setWalletManagementEnabled(!walletManagementEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${walletManagementEnabled ? 'bg-brand-500' : 'bg-surface-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${walletManagementEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="pt-4 flex justify-end border-t border-surface-200">
                                <button type="submit" disabled={loading} className="btn-primary">
                                    {loading ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Top-up Modal */}
            {isTopupModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="bg-surface-50 px-6 py-4 border-b border-surface-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                                <Wallet size={20} className="text-brand-600"/>
                                Adjust User Balance
                            </h3>
                        </div>
                        
                        <form onSubmit={handleTopupSubmit} className="p-6 space-y-5">
                            <div>
                                <p className="text-sm font-medium text-surface-600 mb-1">Target User</p>
                                <p className="font-bold text-surface-900">{selectedUser.email}</p>
                            </div>
                            
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setTopupType('add')}
                                    className={`flex-1 py-2 font-medium rounded-lg text-sm transition-colors border flex items-center justify-center gap-2 ${topupType === 'add' ? 'bg-green-50 border-green-500 text-green-700' : 'border-surface-300 text-surface-600 bg-white'}`}
                                >
                                    <Plus size={16} /> Add Credit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTopupType('deduct')}
                                    className={`flex-1 py-2 font-medium rounded-lg text-sm transition-colors border flex items-center justify-center gap-2 ${topupType === 'deduct' ? 'bg-red-50 border-red-500 text-red-700' : 'border-surface-300 text-surface-600 bg-white'}`}
                                >
                                    <Minus size={16} /> Deduct
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Amount (INR)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 font-semibold">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        required
                                        value={topupAmount}
                                        onChange={(e) => setTopupAmount(e.target.value)}
                                        className="input-field w-full pl-8"
                                        placeholder="e.g. 500"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Audit Log Description</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 text-surface-400" size={16} />
                                    <textarea
                                        required
                                        rows="2"
                                        value={topupDesc}
                                        onChange={(e) => setTopupDesc(e.target.value)}
                                        className="input-field w-full pl-9 py-2 text-sm"
                                        placeholder="Reason for adjustment... (e.g. Compensation refund, Manual Payment Received)"
                                    ></textarea>
                                </div>
                                <p className="text-xs text-surface-500 mt-1">This will be prefixed with 'Admin Adjustment: ' in log records.</p>
                            </div>
                            
                            <div className="flex gap-3 pt-4 border-t border-surface-100">
                                <button
                                    type="button"
                                    onClick={() => setIsTopupModalOpen(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`${topupType === 'deduct' ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm' : 'btn-primary'} flex-1 font-semibold rounded-lg`}
                                >
                                    {loading ? 'Processing...' : `Confirm ${topupType === 'add' ? 'Addition' : 'Deduction'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletManagement;
