import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShoppingCart, Search, Filter, RefreshCw, Download, Eye, MessageSquare,
  CheckCircle2, Clock, Truck, XCircle, Package, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';

const statusConfig = {
  pending:    { label: 'Pending',    color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20'  },
  confirmed:  { label: 'Confirmed',  color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20'   },
  processing: { label: 'Processing', color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20' },
  shipped:    { label: 'Shipped',    color: 'text-cyan-400',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/20'   },
  delivered:  { label: 'Delivered',  color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20'  },
  cancelled:  { label: 'Cancelled',  color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20'    },
};

const paymentConfig = {
  paid:    { label: 'Paid',    color: 'text-green-400', bg: 'bg-green-400/10'  },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-400/10'  },
  failed:  { label: 'Failed',  color: 'text-red-400',   bg: 'bg-red-400/10'    },
  cod:     { label: 'COD',     color: 'text-orange-400',bg: 'bg-orange-400/10' },
  refunded:{ label: 'Refunded',color: 'text-red-400',   bg: 'bg-red-400/10'    },
};

const statusIcons = { pending: Clock, confirmed: CheckCircle2, processing: RefreshCw, shipped: Truck, delivered: CheckCircle2, cancelled: XCircle };

export default function EcommerceOrders() {
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sendingMsg, setSendingMsg] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const perPage = 10;

  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0, delivered: 0 });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/orders`, {
        headers,
        params: { page, limit: perPage, search, status: statusFilter, platform: platformFilter }
      });
      
      setOrders(res.data.orders);
      setTotalPages(Math.ceil(res.data.total / perPage));
      
      // Load stores for sync dropdown
      const storesRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores`, { headers });
      setStores(storesRes.data.stores);
      
      // Local quick stats calculation (approximate for current view or needs dedicated endpoint)
      setStats({
        total: res.data.total,
        pending: res.data.orders.filter(o => o.orderStatus === 'pending').length,
        shipped: res.data.orders.filter(o => o.orderStatus === 'shipped').length,
        delivered: res.data.orders.filter(o => o.orderStatus === 'delivered').length,
      });
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, search, statusFilter, platformFilter]);

  const handleSync = async () => {
    if (stores.length === 0) return alert('No stores connected to sync.');
    setSyncing(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      // Sync first active store (in real scenario, sync all or ask user)
      const store = stores[0];
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores/${store.id}/sync`, { type: 'orders' }, { headers });
      fetchOrders();
    } catch (err) {
      alert('Sync failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (orders.length === 0) return;
    const csvContentBody = "Order ID,Customer,Amount,Status,Payment,Date\n"
      + orders.map(e => `"${e.externalOrderId || ''}","${e.customerName || ''}","${e.totalAmount || 0}","${e.orderStatus || ''}","${e.paymentStatus || ''}","${e.createdAt || ''}"`).join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContentBody);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "orders_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendWhatsApp = async (orderId) => {
    setSendingMsg(p => ({ ...p, [orderId]: true }));
    try {
      const token = localStorage.getItem('userToken');
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/orders/${orderId}/notify`, {
        templateName: 'order_confirmation'
      }, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, whatsappStatus: 'sent' } : o));
    } catch (err) {
      alert('Failed to send WhatsApp message');
    } finally {
      setSendingMsg(p => ({ ...p, [orderId]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <ShoppingCart size={18} className="text-brand-400" />
            </div>
            Orders
          </h1>
          <p className="text-surface-400 text-sm mt-1">Manage orders across all connected stores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Orders'}
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', val: stats.total, color: '#818cf8' },
          { label: 'Pending', val: stats.pending, color: '#f59e0b' },
          { label: 'Shipped', val: stats.shipped, color: '#06b6d4' },
          { label: 'Delivered', val: stats.delivered, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="glass-panel p-4 rounded-xl border border-surface-700">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-sm text-surface-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" placeholder="Search orders, customers..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-300 focus:outline-none focus:border-brand-500/50">
          <option value="">All Statuses</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Orders Table */}
      <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700 bg-surface-800/50">
                {['Order ID', 'Customer', 'Product', 'Amount', 'Status', 'Payment', 'WhatsApp', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-surface-500">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-surface-500">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No orders found. Connect a store and sync.</p>
                </td></tr>
              ) : orders.map(order => {
                const sc = statusConfig[order.orderStatus] || statusConfig.pending;
                const pc = paymentConfig[order.paymentStatus] || paymentConfig.pending;
                const SIcon = statusIcons[order.orderStatus] || Package;
                const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
                const firstProduct = lineItems[0] ? (lineItems[0].title || lineItems[0].name) : 'Various Items';

                return (
                  <tr key={order.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-medium text-brand-400">#{order.externalOrderId}</span>
                      <br /><span className="text-[11px] text-surface-500">{order.store?.storeName}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-medium text-surface-100">{order.customerName}</p>
                      <p className="text-[11px] text-surface-500">{order.customerPhone || order.customerEmail}</p>
                    </td>
                    <td className="px-4 py-3.5 max-w-[150px]">
                      <p className="text-surface-200 truncate">{firstProduct}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-white">₹{parseFloat(order.totalAmount).toLocaleString()}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.color} ${sc.bg} ${sc.border}`}>
                        <SIcon size={11} /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${pc.color} ${pc.bg}`}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {order.whatsappStatus === 'sent' ? (
                        <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Sent</span>
                      ) : order.whatsappStatus === 'failed' ? (
                        <span className="text-xs text-red-400 flex items-center gap-1"><XCircle size={12} /> Failed</span>
                      ) : (
                        <button onClick={() => handleSendWhatsApp(order.id)}
                          disabled={sendingMsg[order.id]}
                          className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 border border-brand-500/20 px-2 py-0.5 rounded-lg hover:bg-brand-500/10 transition-colors">
                          {sendingMsg[order.id] ? <RefreshCw size={11} className="animate-spin" /> : <MessageSquare size={11} />}
                          {sendingMsg[order.id] ? 'Sending...' : 'Send'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-400">{new Date(order.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button onClick={() => setSelectedOrder({ ...order, product: firstProduct })}
                        className="text-surface-400 hover:text-brand-400 transition-colors p-1 hover:bg-brand-500/10 rounded-lg">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700">
            <span className="text-sm text-surface-400">
              Showing Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-brand-500 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-white">Order #{selectedOrder.externalOrderId}</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-surface-400 hover:text-white"><XCircle size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Customer', value: selectedOrder.customerName },
                  { label: 'Phone', value: selectedOrder.customerPhone || selectedOrder.customerEmail },
                  { label: 'Product', value: selectedOrder.product },
                  { label: 'Amount', value: `₹${parseFloat(selectedOrder.totalAmount).toLocaleString()}` },
                  { label: 'Platform', value: selectedOrder.store?.storeName },
                  { label: 'Date', value: new Date(selectedOrder.createdAt).toLocaleString() },
                  { label: 'Payment', value: paymentConfig[selectedOrder.paymentStatus]?.label },
                  { label: 'Tracking', value: selectedOrder.trackingNumber || 'Not assigned' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-surface-500 mb-0.5">{d.label}</p>
                    <p className="text-sm font-medium text-surface-100">{d.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => handleSendWhatsApp(selectedOrder.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all">
                  <MessageSquare size={15} /> Send WhatsApp Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
