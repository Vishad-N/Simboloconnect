import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { BarChart2, TrendingUp, ShoppingCart, Users, RotateCcw, MessageSquare, Zap, DollarSign, ArrowUpRight, ArrowDownRight, Store } from 'lucide-react';

// Icon Map for KPI Cards
const iconMap = {
  DollarSign: DollarSign,
  ShoppingCart: ShoppingCart,
  RotateCcw: RotateCcw,
  MessageSquare: MessageSquare,
  Users: Users,
  Zap: Zap
};

// Minimal bar chart
function BarChart({ data = [], color = '#00d9a5', height = 120, label = '' }) {
  const max = Math.max(...data.map(d => d.val)) || 1;
  return (
    <div>
      {label && <p className="text-xs text-surface-400 mb-2">{label}</p>}
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="w-full rounded-t-md transition-all duration-700 hover:opacity-80 cursor-pointer"
              style={{ height: `${(d.val / max) * (height - 20)}px`, background: `${color}${i === data.length - 1 ? 'ff' : '80'}` }}
              title={`${d.label}: ${d.val}`} />
            <span className="text-[9px] text-surface-500 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut chart using SVG
function DonutChart({ segments = [], size = 100 }) {
  const total = segments.reduce((a, s) => a + s.val, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={38} fill="none" stroke="#2a2a40" strokeWidth="12" />
        <circle cx={50} cy={50} r={24} fill="#1a1a2e" />
        <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fill="#5a6a7a" fontSize="11" fontWeight="bold">0</text>
      </svg>
    );
  }
  let cum = 0;
  const r = 38, cx = 50, cy = 50;
  const arcs = segments.map(s => {
    const pct = s.val / total;
    const start = cum;
    cum += pct;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    return { ...s, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity="0.85" />)}
      <circle cx={cx} cy={cy} r={24} fill="#1a1a2e" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold">{total}</text>
    </svg>
  );
}

export default function EcommerceAnalytics() {
  const [period, setPeriod] = useState('7d');
  const [animated, setAnimated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasConnectedStores, setHasConnectedStores] = useState(false);
  
  // Dynamic stats state
  const [kpiCards, setKpiCards] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [cartRecoveryData, setCartRecoveryData] = useState([]);
  const [orderStatusSegments, setOrderStatusSegments] = useState([]);
  const [msgData, setMsgData] = useState([]);
  const [platformSplit, setPlatformSplit] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [campaignPerformance, setCampaignPerformance] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('userToken');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/ecommerce/analytics?period=${period}`, { headers });
      
      setHasConnectedStores(res.data.hasConnectedStores);
      if (res.data.hasConnectedStores) {
        setKpiCards(res.data.kpiCards);
        setRevenueData(res.data.revenueData);
        setCartRecoveryData(res.data.cartRecoveryData);
        setOrderStatusSegments(res.data.orderStatusSegments);
        setMsgData(res.data.msgData);
        setPlatformSplit(res.data.platformSplit);
        setTopProducts(res.data.topProducts);
        setCampaignPerformance(res.data.campaignPerformance);
      }
      setTimeout(() => setAnimated(true), 200);
    } catch (err) {
      console.error('Failed to fetch e-commerce analytics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
          style={{ borderColor: 'rgba(0,217,165,0.2)', borderTopColor: '#00d9a5' }} />
        <h3 className="text-lg font-bold text-white mb-1">Loading Analytics</h3>
        <p className="text-sm text-surface-400">Fetching live performance metrics...</p>
      </div>
    );
  }

  if (!hasConnectedStores) {
    return (
      <div className="max-w-md mx-auto py-16 flex flex-col items-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'rgba(0,217,165,0.05)', border: '1px dashed rgba(0,217,165,0.2)' }}>
          <Store size={28} className="text-brand-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Connected Stores</h3>
        <p className="text-sm max-w-sm leading-relaxed mb-6 text-surface-400">
          You haven't connected any Shopify or WooCommerce stores yet. Connect your store first to view dynamic sales, cart recovery, and message analytics.
        </p>
        <button onClick={() => navigate('/ecommerce/stores')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-500 text-white hover:bg-brand-600 transition-all shadow-md">
          Connect Your Store
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
              <BarChart2 size={18} className="text-brand-400" />
            </div>
            Ecommerce Analytics
          </h1>
          <p className="text-surface-400 text-sm mt-1">Complete performance overview across all stores</p>
        </div>
        <div className="flex gap-1.5 bg-surface-800 border border-surface-700 rounded-xl p-1">
          {['7d', '30d', '90d', 'custom'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-white'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => {
          const IconComponent = iconMap[k.icon] || BarChart2;
          return (
            <div key={k.label} className="glass-panel p-4 rounded-xl border border-surface-700 hover:border-opacity-50 transition-all"
              style={{ '--hc': k.color }}>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: k.color + '20' }}>
                  <IconComponent size={16} style={{ color: k.color }} />
                </div>
                <span className={`text-xs flex items-center gap-0.5 ${k.up ? 'text-green-400' : 'text-red-400'}`}>
                  {k.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                </span>
              </div>
              <p className="text-lg font-bold text-white">{k.val}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">{k.label}</p>
              <p className="text-[10px] text-surface-500">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-xl border border-surface-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-brand-400" /> Revenue ({period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'Last 90 Days'})</h3>
            <span className="text-sm font-bold text-brand-400">₹{revenueData.reduce((a, d) => a + d.val, 0).toLocaleString()}</span>
          </div>
          <BarChart data={revenueData} color="#00d9a5" height={140} />
        </div>

        <div className="glass-panel p-5 rounded-xl border border-surface-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><RotateCcw size={16} className="text-amber-400" /> Cart Recovery ({period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'Last 90 Days'})</h3>
            <span className="text-sm font-bold text-amber-400">{cartRecoveryData.reduce((a, d) => a + d.val, 0)} carts</span>
          </div>
          <BarChart data={cartRecoveryData} color="#f59e0b" height={140} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Donut */}
        <div className="glass-panel p-5 rounded-xl border border-surface-700">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ShoppingCart size={16} className="text-brand-400" /> Order Status</h3>
          <div className="flex items-center gap-6">
            <DonutChart segments={orderStatusSegments} size={110} />
            <div className="space-y-2 flex-1">
              {orderStatusSegments.map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs text-surface-400">{s.label}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Chart */}
        <div className="glass-panel p-5 rounded-xl border border-surface-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><MessageSquare size={16} className="text-indigo-400" /> WhatsApp Messages</h3>
            <span className="text-sm font-bold text-indigo-400">{msgData.reduce((a, d) => a + d.val, 0).toLocaleString()}</span>
          </div>
          <BarChart data={msgData} color="#818cf8" height={120} />
        </div>

        {/* Platform Split */}
        <div className="glass-panel p-5 rounded-xl border border-surface-700">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-purple-400" /> Platform Split</h3>
          <DonutChart segments={platformSplit} size={110} />
          <div className="space-y-2 mt-3">
            {platformSplit.map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: s.color }}>{s.label}</span>
                  <span className="text-surface-400">{s.val} ({s.val > 0 && platformSplit.reduce((a,x) => a+x.val,0) > 0 ? ((s.val / platformSplit.reduce((a,x) => a+x.val,0))*100).toFixed(0) : 0}%)</span>
                </div>
                <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: animated ? `${platformSplit.reduce((a,x) => a+x.val,0) > 0 ? (s.val / platformSplit.reduce((a,x) => a+x.val,0))*100 : 0}%` : '0%', background: s.color, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="glass-panel p-5 rounded-xl border border-surface-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-brand-400" /> Top Products by Orders</h3>
        </div>
        <div className="overflow-x-auto">
          {topProducts.length === 0 ? (
            <div className="text-center py-6 text-surface-400">No product sales recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {['Product', 'Orders', 'Revenue', 'Growth'].map(h => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {topProducts.map((p, i) => (
                  <tr key={p.name} className="hover:bg-surface-800/40 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-400">{i + 1}</span>
                        <span className="font-medium text-surface-200">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-bold text-white">{p.orders.toLocaleString()}</td>
                    <td className="py-3 font-bold text-brand-400">₹{p.revenue.toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`flex items-center gap-1 font-semibold text-sm ${p.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {Math.abs(p.growth)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="glass-panel p-5 rounded-xl border border-surface-700">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Zap size={16} className="text-brand-400" /> Campaign Performance</h3>
        {campaignPerformance.length === 0 ? (
          <div className="text-center py-6 text-surface-400">No campaigns executed yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {campaignPerformance.map(c => (
              <div key={c.label} className="bg-surface-800 rounded-xl p-4 border border-surface-700">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <p className="text-sm font-semibold text-white truncate">{c.label}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[{ l: 'Sent', v: c.sent }, { l: 'Read', v: c.read }, { l: 'CTR', v: c.ctr }, { l: 'Revenue', v: c.revenue }].map(s => (
                    <div key={s.l} className="bg-surface-900 rounded-lg p-2">
                      <p className="font-bold text-sm text-white">{s.v}</p>
                      <p className="text-[10px] text-surface-500">{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
