import React, { useState } from 'react';
import { ShoppingCart, RefreshCw, Filter, Search, X, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';

const WhatsAppOrders = () => {
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchId, setSearchId] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Demo orders data
    const [orders] = useState([]);

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        completed: orders.filter(o => o.status === 'completed').length,
        revenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0),
    };

    const filteredOrders = orders.filter(o => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (searchId && !o.id.toLowerCase().includes(searchId.toLowerCase())) return false;
        if (searchPhone && !o.phone.includes(searchPhone)) return false;
        return true;
    });

    const handleClearFilters = () => {
        setStatusFilter('all');
        setSearchId('');
        setSearchPhone('');
    };

    const viewOrder = (order) => {
        setSelectedOrder(order);
        setShowOrderModal(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold font-display text-white flex items-center gap-3">
                    <ShoppingCart size={32} className="text-brand-400" /> WhatsApp Orders
                </h1>
                <div className="flex gap-3">
                    <button onClick={() => alert('Orders refreshed.')} className="btn-secondary flex items-center gap-2">
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-400 mb-2">Total Orders</p>
                            <h3 className="text-3xl font-bold text-white">{stats.total}</h3>
                        </div>
                        <ShoppingCart size={28} className="text-surface-600" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-400 mb-2">Pending Orders</p>
                            <h3 className="text-3xl font-bold text-yellow-400">{stats.pending}</h3>
                        </div>
                        <Clock size={28} className="text-yellow-500/30" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-400 mb-2">Completed Orders</p>
                            <h3 className="text-3xl font-bold text-green-400">{stats.completed}</h3>
                        </div>
                        <CheckCircle2 size={28} className="text-green-500/30" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-brand-500/30 bg-brand-500/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-brand-400 mb-2">Total Revenue</p>
                            <h3 className="text-3xl font-bold text-brand-400">₹{stats.revenue}</h3>
                        </div>
                        <span className="text-brand-500/30 text-3xl font-bold">₹</span>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-surface-700">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-surface-300 mb-1">Status</label>
                        <select 
                            value={statusFilter} 
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-brand-500 text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-surface-300 mb-1">Order ID</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                            <input 
                                type="text" 
                                value={searchId}
                                onChange={e => setSearchId(e.target.value)}
                                placeholder="Search by Order ID" 
                                className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-1 focus:ring-brand-500 text-sm" 
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-surface-300 mb-1">Customer Phone</label>
                        <input 
                            type="text" 
                            value={searchPhone}
                            onChange={e => setSearchPhone(e.target.value)}
                            placeholder="Enter phone number" 
                            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-brand-500 text-sm" 
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button onClick={handleClearFilters} className="btn-secondary h-10 px-4 text-sm">
                            <X size={14} className="mr-1 inline" /> Clear
                        </button>
                        <button className="btn-primary h-10 px-4 flex items-center gap-2 text-sm">
                            <Filter size={14} /> Apply
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-surface-700 text-surface-400 text-xs">
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Order ID</th>
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Customer</th>
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Items</th>
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Amount</th>
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Status</th>
                                <th className="pb-3 px-4 font-medium uppercase tracking-wider">Date</th>
                                <th className="pb-3 px-4 text-right font-medium uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-surface-400">
                                        <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                                        <p>No orders found</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors">
                                        <td className="py-3 px-4 text-white font-mono text-xs">{order.id}</td>
                                        <td className="py-3 px-4 text-white">{order.customer}<br/><span className="text-xs text-surface-400">{order.phone}</span></td>
                                        <td className="py-3 px-4 text-surface-300">{order.items}</td>
                                        <td className="py-3 px-4 text-white font-semibold">₹{order.amount}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                order.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                                order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-red-500/10 text-red-400'
                                            }`}>{order.status}</span>
                                        </td>
                                        <td className="py-3 px-4 text-surface-400">{order.date}</td>
                                        <td className="py-3 px-4 text-right">
                                            <button onClick={() => viewOrder(order)} className="text-brand-400 hover:text-brand-300">
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Modal */}
            {showOrderModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center p-6 border-b border-surface-700">
                            <h2 className="text-lg font-bold text-white">Order #{selectedOrder.id}</h2>
                            <button onClick={() => setShowOrderModal(false)} className="text-surface-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-surface-400">Customer</span><span className="text-white">{selectedOrder.customer}</span></div>
                            <div className="flex justify-between"><span className="text-surface-400">Phone</span><span className="text-white">{selectedOrder.phone}</span></div>
                            <div className="flex justify-between"><span className="text-surface-400">Amount</span><span className="text-white font-bold">₹{selectedOrder.amount}</span></div>
                            <div className="flex justify-between"><span className="text-surface-400">Status</span><span className="text-white">{selectedOrder.status}</span></div>
                        </div>
                        <div className="p-6 border-t border-surface-700">
                            <button onClick={() => setShowOrderModal(false)} className="btn-secondary w-full">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppOrders;
