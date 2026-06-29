import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Package, Search, RefreshCw, Download, Eye, Star, ShoppingCart, X, ChevronLeft, ChevronRight, Tag, TrendingUp } from 'lucide-react';

const statusCfg = {
  active:       { label: 'Active',       color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20'  },
  out_of_stock: { label: 'Out of Stock', color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20'    },
  low_stock:    { label: 'Low Stock',    color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20'  },
};

const categoryColors = { Electronics: '#818cf8', Clothing: '#f472b6', Footwear: '#fb923c', Sports: '#10b981', 'Home Decor': '#06b6d4', Accessories: '#a78bfa', Health: '#34d399', General: '#818cf8' };

function ProductAvatar({ title, category }) {
  const initials = title ? title.split(' ').slice(0, 2).map(w => w[0]).join('') : 'PR';
  const color = categoryColors[category] || '#818cf8';
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: color + '22', color, border: `1px solid ${color}30` }}>
      {initials}
    </div>
  );
}

export default function EcommerceProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 6;
  const [stats, setStats] = useState({ total: 0, active: 0, low_stock: 0, out_of_stock: 0 });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/products`, {
        headers,
        params: { page, limit: perPage, search, status: statusFilter, platform }
      });
      
      setProducts(res.data.products);
      setTotalPages(Math.ceil(res.data.total / perPage));
      
      // Local quick stats calculation
      setStats({
        total: res.data.total,
        active: res.data.products.filter(p => p.stockStatus === 'active').length,
        low_stock: res.data.products.filter(p => p.stockStatus === 'low_stock').length,
        out_of_stock: res.data.products.filter(p => p.stockStatus === 'out_of_stock').length,
      });

      const storesRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores`, { headers });
      setStores(storesRes.data.stores);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, statusFilter, platform]);

  const handleSync = async () => {
    if (stores.length === 0) return alert('No stores connected to sync.');
    setSyncing(true);
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      const store = stores[0]; // Currently syncing first store
      await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores/${store.id}/sync`, { type: 'products' }, { headers });
      fetchProducts();
    } catch (err) {
      alert('Sync failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) return;
    const csvContentBody = "Title,SKU,Price,Stock,Status\n"
      + products.map(e => `"${e.title || ''}","${e.sku || ''}","${e.price || 0}","${e.stock || 0}","${e.stockStatus || ''}"`).join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContentBody);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "products_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <Package size={18} className="text-brand-400" />
            </div>
            Products
          </h1>
          <p className="text-surface-400 text-sm mt-1">{stats.total} products synced across all stores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync Products'}
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800 text-sm transition-all">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', val: stats.total, color: '#818cf8' },
          { label: 'Active', val: stats.active, color: '#10b981' },
          { label: 'Low Stock', val: stats.low_stock, color: '#f59e0b' },
          { label: 'Out of Stock', val: stats.out_of_stock, color: '#ef4444' },
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
          <input type="text" placeholder="Search products, SKU…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/50 transition-colors" />
        </div>
        <select value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}
          className="bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-300 focus:outline-none focus:border-brand-500/50">
          <option value="">All Platforms</option>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-surface-300 focus:outline-none focus:border-brand-500/50">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-16 text-surface-500">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-surface-500">
            <Package size={48} className="mx-auto mb-4 opacity-30" />
            <p>No products found</p>
          </div>
        ) : products.map(p => {
          const sc = statusCfg[p.stockStatus] || statusCfg.out_of_stock;
          const category = 'General';
          const color = categoryColors[category];
          
          return (
            <div key={p.id} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-brand-500/20 transition-all duration-200 hover:-translate-y-0.5">
              <div className="flex items-start gap-3 mb-3">
                <ProductAvatar title={p.title} category={category} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{p.title}</h3>
                  <p className="text-xs text-surface-500">SKU: {p.sku || 'N/A'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: color + '22', color }}>{category}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium border flex-shrink-0 ${sc.color} ${sc.bg} ${sc.border}`}>{sc.label}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-surface-800 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-white">₹{parseFloat(p.price).toLocaleString()}</p>
                  <p className="text-[10px] text-surface-500">Price</p>
                </div>
                <div className="bg-surface-800 rounded-lg p-2 text-center">
                  <p className={`text-sm font-bold ${p.stock === 0 ? 'text-red-400' : p.stock < 10 ? 'text-amber-400' : 'text-green-400'}`}>{p.stock}</p>
                  <p className="text-[10px] text-surface-500">Stock</p>
                </div>
                <div className="bg-surface-800 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-brand-400">-</p>
                  <p className="text-[10px] text-surface-500">Sold</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <Star size={11} fill="#f59e0b" /> 5.0
                </div>
                <span className="text-xs text-surface-500">{p.store?.storeName || 'Store'}</span>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelected({ ...p, category })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-surface-600 text-surface-400 hover:text-white text-xs transition-all">
                  <Eye size={11} /> Details
                </button>
                <button onClick={() => navigate('/ecommerce/campaigns')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-brand-500/30 text-brand-400 hover:bg-brand-500/10 text-xs transition-all">
                  <TrendingUp size={11} /> Promote
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors"><ChevronLeft size={16} /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-brand-500 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg text-surface-400 hover:text-white disabled:opacity-40 hover:bg-surface-700 transition-colors"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Product Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-surface-700">
              <h2 className="text-lg font-bold text-white">Product Details</h2>
              <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <ProductAvatar title={selected.title} category={selected.category} />
                <div>
                  <h3 className="font-bold text-white">{selected.title}</h3>
                  <p className="text-sm text-surface-400">{selected.category} · {selected.store?.storeName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'SKU', value: selected.sku || 'N/A' }, { label: 'Price', value: `₹${parseFloat(selected.price).toLocaleString()}` },
                  { label: 'Stock', value: selected.stock }, { label: 'Total Sold', value: '-' },
                  { label: 'Rating', value: `5.0 ★` }, { label: 'Status', value: statusCfg[selected.stockStatus]?.label || 'Unknown' },
                ].map(d => (
                  <div key={d.label}>
                    <p className="text-xs text-surface-500">{d.label}</p>
                    <p className="text-sm font-medium text-surface-100 mt-0.5">{d.value}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => { setSelected(null); navigate('/ecommerce/campaigns'); }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all">
                <TrendingUp size={15} /> Create WhatsApp Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
