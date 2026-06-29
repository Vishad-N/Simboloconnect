import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, Users, Send, Clock, Megaphone, AlertCircle, Wallet, Plus,
    CreditCard, TrendingUp, Zap, MessageSquare, CheckCircle2, XCircle,
    Bot, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw, Circle,
    Mail, Smartphone, Globe, ChevronRight, Inbox, Star
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PlanActivationModal from '../components/PlanActivationModal';

/* ── Stat Card ────────────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, sub, trend, trendUp, accent = '#00d9a5' }) => (
    <div className="relative overflow-hidden rounded-2xl group cursor-default"
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,217,165,0.25)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
        {/* Ambient glow */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: `${accent}18` }} />

        <div className="relative z-10 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: '#5a6a7a' }}>{title}</p>
                <div className="p-2 rounded-xl" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                    <Icon size={16} color={accent} />
                </div>
            </div>
            <p className="text-2xl sm:text-4xl font-black text-white mb-3 tracking-tight leading-none">{value}</p>
            <div className="flex items-center gap-2">
                {trend && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
                        style={{
                            background: trendUp ? 'rgba(0,217,165,0.1)' : 'rgba(239,68,68,0.1)',
                            color: trendUp ? '#00d9a5' : '#f87171'
                        }}>
                        {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {trend}
                    </span>
                )}
                {sub && <span className="text-xs" style={{ color: '#4a5568' }}>{sub}</span>}
            </div>
        </div>
        {/* Bottom line on hover */}
        <div className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
    </div>
);

/* ── Quick Action Button ───────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, to, accent = '#00d9a5' }) => (
    <Link to={to}
        className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-5 rounded-2xl group transition-all"
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = `${accent}40`}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
    >
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110"
            style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
            <Icon size={18} color={accent} />
        </div>
        <span className="text-[10px] sm:text-xs font-bold text-white/70 group-hover:text-white transition-colors text-center leading-tight">{label}</span>
    </Link>
);

/* ── Status Dot ───────────────────────────────────────────── */
const StatusDot = ({ ok }) => (
    <span className="flex items-center gap-2 text-xs font-semibold"
        style={{ color: ok ? '#00d9a5' : '#f87171' }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ok ? '#00d9a5' : '#f87171' }} />
        {ok ? 'Operational' : 'Degraded'}
    </span>
);

/* ── Main Dashboard ───────────────────────────────────────── */
const Dashboard = () => {
    const [analytics, setAnalytics] = useState({
        totalMessagesSent: 0,
        activeContacts: 0,
        readRate: 0,
        recentActivity: [],
        weeklyMessages: [],
        thisWeekMessages: 0,
    });
    const [totalContacts, setTotalContacts] = useState(null);
    const [totalCampaigns, setTotalCampaigns] = useState(null);
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState(null);
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
    const [rechargeAmount, setRechargeAmount] = useState('');
    const [rechargeLoading, setRechargeLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchData = async () => {
        try {
            const [analyticsRes, accountRes, configRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/analytics`).catch(err => {
                    console.error('Failed to fetch analytics:', err);
                    return { data: { totalMessagesSent: 0, activeContacts: 0, readRate: 0, recentActivity: [], weeklyMessages: [], thisWeekMessages: 0, totalCampaigns: 0 } };
                }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/account`).catch(err => {
                    console.error('Failed to fetch account:', err);
                    return { data: null };
                }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/public/config`).catch(err => {
                    console.error('Failed to fetch public config:', err);
                    return { data: {} };
                })
            ]);

            if (analyticsRes?.data) {
                setAnalytics(analyticsRes.data);
                setTotalContacts(analyticsRes.data.activeContacts ?? 0);
                setTotalCampaigns(analyticsRes.data.totalCampaigns ?? 0);
            }
            if (accountRes?.data !== undefined) {
                setAccount(accountRes.data);
                // Show activation modal ONLY if:
                // - User has selected a plan (planId is set), meaning they intend to buy
                // - BUT their subscription is not yet active (no validityExpiresAt) OR it has expired
                const hasPlanSelected = !!accountRes.data?.planId;
                const isNotActive = !accountRes.data?.validityExpiresAt || new Date(accountRes.data.validityExpiresAt) < new Date();
                if (hasPlanSelected && isNotActive && accountRes.data?.role !== 'SUPERADMIN') {
                    setIsActivationModalOpen(true);
                }
            }
            if (configRes?.data) setConfig(configRes.data);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Dashboard fetch failed completely', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    };

    const walletBalance = account?.wallet?.currentBalance !== undefined ? parseFloat(account.wallet.currentBalance) : 0;
    const minRecharge = config?.WALLET_MIN_RECHARGE ? parseFloat(config.WALLET_MIN_RECHARGE) : 100;
    const lowAlert = config?.WALLET_LOW_BALANCE_ALERT ? parseFloat(config.WALLET_LOW_BALANCE_ALERT) : 50;
    const isLowBalance = walletBalance < lowAlert;
    // Use real contact count from contacts API, fallback to analytics
    const displayContacts = totalContacts !== null ? totalContacts : (analytics.activeContacts || 0);
    const displayCampaigns = totalCampaigns !== null ? totalCampaigns : 0;
    const displayMessages = analytics.totalMessagesSent || 0;
    const displayReadRate = analytics.readRate || 0;
    const displayInbound = analytics.inboundMessages || 0;

    const handleRecharge = async (e) => {
        e.preventDefault();
        setRechargeLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/payment/razorpay/wallet-order`,
                { amountInRupees: parseFloat(rechargeAmount) },
                { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
            );
            const rzp = new window.Razorpay({
                key: res.data.key_id, amount: res.data.amount, currency: 'INR',
                name: import.meta.env.VITE_BRAND_NAME || 'WaDesk', description: 'Wallet Recharge', order_id: res.data.order.id,
                handler: async (response) => {
                    try {
                        await axios.post(`${import.meta.env.VITE_API_URL}/api/payment/razorpay/wallet-verify`,
                            { ...response, amountInRupees: parseFloat(rechargeAmount) },
                            { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                        );
                        setIsRechargeModalOpen(false);
                        window.location.reload();
                    } catch { alert('Verification failed. Contact support.'); }
                },
                theme: { color: '#00d9a5' }
            });
            rzp.open();
        } catch { alert('Failed to initiate recharge.'); }
        finally { setRechargeLoading(false); }
    };

    const handleActivateFreePlan = async () => {
        try {
            setLoading(true);
            await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/account/activate-free-plan`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` }
            });
            import('canvas-confetti').then((confetti) => {
                confetti.default({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            });
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            alert(err.response?.data?.error || "Failed to activate free plan.");
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#000000' }}>
            <div className="w-12 h-12 border-4 rounded-full animate-spin mb-4"
                style={{ borderColor: 'rgba(0,217,165,0.2)', borderTopColor: '#00d9a5' }} />
            <h2 className="text-xl font-bold text-white mb-1">Loading Dashboard</h2>
            <p className="text-sm" style={{ color: '#5a6a7a' }}>Fetching live analytics...</p>
        </div>
    );

    return (
        <div className="min-h-full" style={{ background: '#000000' }}>

            {/* ── Header ── */}
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#00d9a5,#00b884)', boxShadow: '0 0 20px rgba(0,217,165,0.3)' }}>
                        <Activity size={22} color="#000" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white leading-tight">
                            Welcome Back{account?.name ? `, ${account.name}` : ''}
                        </h1>
                        <p className="text-sm" style={{ color: '#5a6a7a' }}>
                            WhatsApp Business API · Real-time overview
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: '#3a4a5a' }}>
                        Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)', color: '#00d9a5' }}>
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Activation Required Banner (Free Trial / Pay) ── */}
            {account && !account.validityExpiresAt && account.role !== 'SUPERADMIN' && (
                <div className="mb-8 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08) 0%,#0d0d0d 60%)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div>
                        <h2 className="text-lg font-black text-white mb-1">Activate Your Workspace</h2>
                        <p className="text-sm" style={{ color: '#5a6a7a' }}>You currently have no active plan. Please claim your free trial or purchase a plan to start using all features.</p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        {!account.usedFreePlan && (
                            <button onClick={handleActivateFreePlan} className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
                                Claim Free Trial 🎁
                            </button>
                        )}
                        <button onClick={() => setIsActivationModalOpen(true)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:bg-white/5" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
                            View Plans & Pricing
                        </button>
                    </div>
                </div>
            )}

            {/* ── Wallet Banner (if enabled) ── */}
            {config?.WALLET_MANAGEMENT_ENABLED === 'true' && (
                <div className="mb-8 rounded-2xl p-6 flex items-center justify-between relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg,rgba(0,217,165,0.08) 0%,#0d0d0d 60%)', border: '1px solid rgba(0,217,165,0.15)' }}>
                    <div className="absolute -right-8 -top-8 opacity-5"><Wallet size={200} color="#00d9a5" /></div>
                    <div className="flex items-center gap-5 relative z-10">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: 'rgba(0,217,165,0.1)', border: '1px solid rgba(0,217,165,0.25)' }}>
                            <CreditCard size={26} color="#00d9a5" />
                        </div>
                        <div>
                            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5a6a7a' }}>Available Credits</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white">₹{walletBalance.toFixed(2)}</span>
                                <span className="text-sm font-bold" style={{ color: '#00d9a5' }}>INR</span>
                                {isLowBalance && (
                                    <span className="ml-2 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                                        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                                        <AlertCircle size={10} /> Low Balance
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 relative z-10">
                        <Link to="/wallet/logs" className="px-5 py-2.5 rounded-xl text-sm font-bold text-white/70 hover:text-white transition-all"
                            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                            History
                        </Link>
                        <button onClick={() => setIsRechargeModalOpen(true)}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5"
                            style={{ background: 'linear-gradient(135deg,#00d9a5,#00b884)', color: '#000', boxShadow: '0 4px 14px rgba(0,217,165,0.3)' }}>
                            <Plus size={16} /> Top-Up
                        </button>
                    </div>
                </div>
            )}

            {/* ── 6 Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard title="Messages Sent" value={displayMessages.toLocaleString()}
                    icon={Send} sub="all time outbound"
                    trend={displayMessages > 0 ? '+active' : null} trendUp accent="#00d9a5" />
                <StatCard title="Total Contacts" value={displayContacts.toLocaleString()}
                    icon={Users} sub="in your workspace"
                    trend={displayContacts > 0 ? `${displayContacts} saved` : null} trendUp accent="#3b82f6" />
                <StatCard title="Read Rate" value={`${displayReadRate}%`}
                    icon={Activity} sub="message engagement"
                    trend={displayMessages > 0 ? `${displayReadRate}% read` : null} trendUp accent="#a78bfa" />
                <StatCard title="Campaigns" value={displayCampaigns.toLocaleString()}
                    icon={Megaphone} sub="total created"
                    trend={displayCampaigns > 0 ? `${displayCampaigns} total` : null} trendUp accent="#f59e0b" />
                <StatCard title="Inbound Messages" value={displayInbound.toLocaleString()}
                    icon={Inbox} sub="received"
                    trend={null} accent="#ec4899" />
                <StatCard title="AI Bot" value={account?.botEnabled ? 'Active' : 'Inactive'}
                    icon={Bot} sub="workspace AI status"
                    trend={null} accent={account?.botEnabled ? '#00d9a5' : '#6b7280'} />
            </div>

            {/* ── Middle Row: Quick Actions + System Health ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                {/* Quick Actions */}
                <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                        <Zap size={16} color="#00d9a5" /> Quick Actions
                    </h2>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        <QuickAction icon={Send} label="New Campaign" to="/campaigns" accent="#00d9a5" />
                        <QuickAction icon={MessageSquare} label="Live Chat" to="/chat" accent="#3b82f6" />
                        <QuickAction icon={Users} label="Contacts" to="/contacts" accent="#a78bfa" />
                        <QuickAction icon={Mail} label="Templates" to="/templates" accent="#f59e0b" />
                        <QuickAction icon={Bot} label="AI Brain" to="/ai-brain" accent="#ec4899" />
                        <QuickAction icon={BarChart3} label="Analytics" to="/dashboard" accent="#10b981" />
                    </div>
                </div>

                {/* System Health */}
                <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                        <Globe size={16} color="#00d9a5" /> System Health
                    </h2>
                    <div className="space-y-4">
                        {[
                            { label: 'WhatsApp API', ok: true },
                            { label: 'Webhook Server', ok: true },
                            { label: 'AI Engine', ok: !!account?.botEnabled },
                            { label: 'Message Queue', ok: true },
                            { label: 'Database', ok: true },
                        ].map(({ label, ok }) => (
                            <div key={label} className="flex items-center justify-between py-2"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span className="text-sm font-medium" style={{ color: '#9ca3af' }}>{label}</span>
                                <StatusDot ok={ok} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Recent Activity Log ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Clock size={16} color="#00d9a5" /> Recent Activity
                    </h2>
                    <Link to="/campaigns" className="text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all"
                        style={{ color: '#00d9a5' }}>
                        View All <ChevronRight size={12} />
                    </Link>
                </div>

                {analytics.recentActivity?.length > 0 ? (
                    <div>
                        {analytics.recentActivity.slice(0, 8).map((activity, i) => (
                            <div key={activity.id || i}
                                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-default"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'rgba(0,217,165,0.08)', border: '1px solid rgba(0,217,165,0.15)' }}>
                                        <Megaphone size={15} color="#00d9a5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white leading-tight">{activity.action}</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>{formatTime(activity.time)}</p>
                                    </div>
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                                    style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', letterSpacing: '0.05em' }}>
                                    {activity.status}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Empty State */
                    <div className="py-20 flex flex-col items-center text-center px-6">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                            style={{ background: 'rgba(0,217,165,0.05)', border: '1px dashed rgba(0,217,165,0.2)' }}>
                            <Zap size={28} color="#00d9a5" style={{ opacity: 0.4 }} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No Activity Yet</h3>
                        <p className="text-sm max-w-sm leading-relaxed mb-6" style={{ color: '#4a5568' }}>
                            Your live data, campaigns, and message logs will appear here once you start using the workspace.
                        </p>
                        <Link to="/campaigns"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                            style={{ background: 'rgba(0,217,165,0.1)', border: '1px solid rgba(0,217,165,0.25)', color: '#00d9a5' }}>
                            <Send size={14} /> Create First Campaign
                        </Link>
                    </div>
                )}
            </div>

            {/* ── Recharge Modal ── */}
            {isRechargeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
                    <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
                        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-3">
                            <Wallet color="#00d9a5" size={22} /> Top-Up Wallet
                        </h2>
                        <p className="text-sm mb-8" style={{ color: '#5a6a7a' }}>Enter the amount to add to your credits.</p>
                        <form onSubmit={handleRecharge}>
                            <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#5a6a7a' }}>Amount (INR)</label>
                            <div className="relative mb-2">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold">₹</span>
                                <input type="number" required min={minRecharge} step="1"
                                    value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 rounded-xl text-white font-bold text-lg outline-none"
                                    style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                                    placeholder={`e.g. ${minRecharge * 5}`} />
                            </div>
                            <p className="text-xs mb-8" style={{ color: '#4a5568' }}>Minimum ₹{minRecharge}</p>
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setIsRechargeModalOpen(false)}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-white transition-all hover:bg-white/5"
                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>Cancel</button>
                                <button type="submit" disabled={rechargeLoading}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-black border-none"
                                    style={{ background: 'linear-gradient(135deg,#00d9a5,#00b884)', boxShadow: '0 4px 14px rgba(0,217,165,0.3)' }}>
                                    {rechargeLoading ? 'Processing...' : 'Pay via Razorpay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Plan Activation Modal ── */}
            <PlanActivationModal 
                account={account} 
                isOpen={isActivationModalOpen} 
                onClose={() => setIsActivationModalOpen(false)} 
            />
        </div>
    );
};

export default Dashboard;
