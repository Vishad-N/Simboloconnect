import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ShoppingBag, ShoppingCart, TrendingUp, Users, Package, RotateCcw, Zap, AlertCircle, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Store, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Animated counter hook
function useCounter(end, duration = 1500, started = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, started]);
  return count;
}

// Mini Sparkline
function Sparkline({ data, color = '#00d9a5', height = 40 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = height;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const quickActions = [
  { label: 'Connect Store', icon: Store, color: '#00d9a5', path: '/ecommerce/stores' },
  { label: 'Create Campaign', icon: Zap, color: '#818cf8', path: '/ecommerce/campaigns' },
  { label: 'View Orders', icon: ShoppingCart, color: '#f59e0b', path: '/ecommerce/orders' },
  { label: 'Analytics', icon: BarChart2, color: '#10b981', path: '/ecommerce/analytics' },
];

export default function EcommerceOverview() {
  const [visible, setVisible] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [connectedStores, setConnectedStores] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    fetchOverview();
    return () => clearTimeout(t);
  }, []);

  const fetchOverview = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      const [analyticsRes, storesRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/analytics/overview`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/stores`, { headers })
      ]);
      setStatsData({
        ...analyticsRes.data.stats,
        sparks: analyticsRes.data.sparks
      });
      setConnectedStores(storesRes.data.stores || []);
    } catch (err) {
      console.error('Failed to fetch overview data', err);
    }
  };

  const getStatsArray = () => {
    if (!statsData) return [];
    return [
      { label: 'Total Stores', value: statsData.totalStores || 0, icon: Store, color: '#00d9a5', sub: 'Connected stores', up: true, spark: statsData.sparks?.stores || [0,0,0,0,0,0,0] },
      { label: 'Total Orders', value: statsData.totalOrders || 0, icon: ShoppingCart, color: '#818cf8', sub: 'All time orders', up: true, spark: statsData.sparks?.orders || [0,0,0,0,0,0,0] },
      { label: 'Revenue', value: statsData.totalRevenue || 0, icon: TrendingUp, color: '#f59e0b', sub: 'Total revenue', up: true, spark: statsData.sparks?.revenue || [0,0,0,0,0,0,0], prefix: '₹' },
      { label: 'Recovered Carts', value: statsData.recoveredCarts || 0, icon: RotateCcw, color: '#10b981', sub: `${statsData.recoveryRate}% rate`, up: true, spark: statsData.sparks?.recoveredCarts || [0,0,0,0,0,0,0] },
      { label: 'Messages Sent', value: statsData.messagesSent || 0, icon: Zap, color: '#06b6d4', sub: 'Campaigns & Alerts', up: true, spark: statsData.sparks?.messages || [0,0,0,0,0,0,0] },
      { label: 'Customers', value: statsData.totalCustomers || 0, icon: Users, color: '#f472b6', sub: 'Synced customers', up: true, spark: statsData.sparks?.customers || [0,0,0,0,0,0,0] },
      { label: 'Active Automations', value: statsData.totalAutomations || 0, icon: Zap, color: '#a78bfa', sub: 'Running automations', up: false, spark: statsData.sparks?.automations || [0,0,0,0,0,0,0] },
      { label: 'Abandoned Carts', value: statsData.totalCarts || 0, icon: AlertCircle, color: '#fb923c', sub: 'Total abandoned', up: false, spark: statsData.sparks?.carts || [0,0,0,0,0,0,0] },
    ];
  };

  const dynamicStats = getStatsArray();

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-500/20 via-indigo-500/10 to-purple-500/10 p-6 rounded-2xl border border-brand-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,217,165,0.12),transparent_60%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                <ShoppingBag size={20} className="text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Ecommerce Overview</h1>
                <p className="text-surface-400 text-sm">Monitor all your stores, orders & automations</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {quickActions.map(a => (
              <button key={a.label} onClick={() => navigate(a.path)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 hover:scale-105 shadow-sm"
                style={{ borderColor: '#cde9d8', color: '#0b1e12', background: '#ffffff' }}>
                <a.icon size={16} style={{ color: a.color }} />
                <span className="hidden md:inline">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dynamicStats.length > 0 ? dynamicStats.map((s, i) => (
          <StatCard key={s.label} stat={s} index={i} visible={visible} />
        )) : <div className="col-span-4 text-center py-10 text-surface-500">Loading metrics...</div>}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connected Stores */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Store size={18} className="text-brand-400" /> Connected Stores
          </h2>
          {connectedStores.length === 0 && (
            <div className="glass-panel p-6 text-center rounded-xl border border-surface-700">
              <p className="text-sm text-surface-400 mb-4">No stores connected yet.</p>
              <button onClick={() => navigate('/ecommerce/stores')} className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm">Connect Store</button>
            </div>
          )}
          {connectedStores.map(store => (
            <div key={store.id} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-brand-500/30 transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-semibold text-white">{store.storeName}</span>
                  </div>
                  <span className="text-xs text-surface-500">{store.domain}</span>
                </div>
                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-brand-500/20 text-brand-400 capitalize">
                  {store.platform}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-surface-400">
                <span>Status: {store.status}</span>
                <span>Synced: {new Date(store.connectedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Feed Placeholder */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Zap size={18} className="text-brand-400" /> Live Activity Feed
          </h2>
          <div className="glass-panel rounded-xl border border-surface-700 divide-y divide-surface-800 p-8 text-center">
             <Zap size={30} className="mx-auto mb-3 opacity-30 text-surface-500" />
             <p className="text-surface-400">Activity stream will appear here as webhooks are received.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ stat, index, visible }) {
  const val = useCounter(stat.value, 1500, visible);
  const fmt = (v) => {
    if (stat.prefix === '₹') return `${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`;
    return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v;
  };

  return (
    <div className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-opacity-50 transition-all duration-300 hover:-translate-y-0.5"
      style={{ borderColor: visible ? stat.color + '30' : '', transitionDelay: `${index * 60}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: stat.color + '1a' }}>
          <stat.icon size={18} style={{ color: stat.color }} />
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: stat.up ? '#10b981' : '#fb923c' }}>
          {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        </div>
      </div>
      <div className="mb-1">
        <span className="text-2xl font-bold text-white">{stat.prefix || ''}{fmt(val)}</span>
      </div>
      <p className="text-xs text-surface-400 mb-2">{stat.label}</p>
      <div className="flex items-end justify-between">
        <span className="text-[11px] text-surface-500">{stat.sub}</span>
        <Sparkline data={stat.spark} color={stat.color} height={30} />
      </div>
    </div>
  );
}
