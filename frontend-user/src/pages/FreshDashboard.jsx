import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import FreshPlanActivationModal from '../components/FreshPlanActivationModal';

// ── Helpers ──────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString();
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString() : '';
const today = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// ── Sub-components ────────────────────────────────────────
const StatCard = ({ icon, iconBg, iconColor, label, value, sub, trend, trendUp, bigIcon }) => (
  <div className="db-stat-card" style={{
    background: '#ffffff', border: '1px solid #cde9d8',
    borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
    transition: 'all .2s', cursor: 'default',
    boxShadow: '0 2px 12px rgba(37,211,102,0.06)',
    animation: 'fadeUp .4s ease both',
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(37,211,102,.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#cde9d8'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(37,211,102,0.06)'; }}
  >
    {/* top-right glow */}
    <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,211,102,.06) 0%,transparent 65%)' }} />
    {/* label row */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', strokeWidth: 2, stroke: iconColor }}>{icon}</svg>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#4d7a62' }}>{label}</span>
    </div>
    <div style={{ fontSize: 'clamp(24px, 2.5vw, 34px)', fontWeight: 900, color: '#0b1e12', letterSpacing: -1, marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 11, color: '#4d7a62', fontWeight: 500 }}>{sub}</div>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100, marginTop: 8,
      background: trendUp ? 'rgba(37,211,102,.12)' : 'rgba(229,57,53,.1)',
      color: trendUp ? '#128C7E' : '#dc2626'
    }}>{trend}</div>
    {/* big bg icon */}
    <div style={{ position: 'absolute', right: 16, bottom: 16, opacity: .06 }}>
      <svg viewBox="0 0 24 24" style={{ width: 56, height: 56, stroke: '#25D366', fill: 'none', strokeWidth: 1.5 }}>{bigIcon}</svg>
    </div>
  </div>
);

const BarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{ padding: 20, height: 200, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--g)' }}>{d.v}</div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', borderRadius: 6, overflow: 'hidden', height: 140 }}>
            <div style={{
              height: `${Math.max((d.v / max) * 100, 4)}%`,
              background: d.v > 0 ? 'linear-gradient(180deg,#25D366,#00b894)' : 'rgba(37,211,102,.3)',
              borderRadius: 6, position: 'relative', transition: 'height .8s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(255,255,255,.15),transparent)' }} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{d.l}</div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────
const Dashboard = () => {
  const [analytics, setAnalytics] = useState({ totalMessagesSent: 0, activeContacts: 0, readRate: 0, deliveryRate: 0, recentActivity: [], weeklyMessages: [] });
  const [account, setAccount] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const navigate = useNavigate();

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
        theme: { color: '#25D366' }
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

  useEffect(() => {
    const fetch = async () => {
      try {
        const [aRes, accRes, cfgRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/analytics`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/account`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/public/config`).catch(() => ({ data: {} })),
        ]);
        setAnalytics(aRes.data);
        if (accRes.data) {
          setAccount(accRes.data);
          const hasPlanSelected = !!accRes.data.planId;
          const isNotActive = !accRes.data.validityExpiresAt || new Date(accRes.data.validityExpiresAt) < new Date();
          if (hasPlanSelected && isNotActive && accRes.data.role !== 'SUPERADMIN') {
              setIsActivationModalOpen(true);
          }
        }
        setConfig(cfgRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #25D366', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>Loading dashboard…</div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────
  const name = account?.name || 'there';
  const hasActivePlan = account?.validityExpiresAt && new Date(account.validityExpiresAt) > new Date();
  const hasPlan = !!account?.planId;
  const planName = hasActivePlan ? (account?.plan?.name || 'No Plan') : 'No Plan';
  const expiry = account?.validityExpiresAt ? new Date(account.validityExpiresAt).toLocaleDateString('en-GB') : null;

  const walletBalance = account?.wallet?.currentBalance !== undefined ? parseFloat(account.wallet.currentBalance) : 0;
  const minRecharge = config?.WALLET_MIN_RECHARGE ? parseFloat(config.WALLET_MIN_RECHARGE) : 100;
  const lowAlert = config?.WALLET_LOW_BALANCE_ALERT ? parseFloat(config.WALLET_LOW_BALANCE_ALERT) : 50;
  const isLowBalance = walletBalance < lowAlert;

  const msgLimit = account?.planId ? (account.plan?.messageLimit ?? 0) : 0;
  const msgSent = analytics.totalMessagesSent ?? 0;
  const msgRem = Math.max(0, msgLimit - msgSent);
  const usedPct = msgLimit > 0 ? Math.min(100, Math.round((msgSent / msgLimit) * 100)) : 0;
  const circumference = 2 * Math.PI * 45; // r=45
  const dashOffset = circumference - (usedPct / 100) * circumference;

  // Weekly bar chart — use API data or fallback to last 7 days pattern
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekData = days.map((l, i) => ({
    l,
    v: analytics.weeklyMessages?.[i] ?? 0
  }));

  // Activity badge color
  const badgeStyle = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'DONE') return { background: 'rgba(37,211,102,.12)', color: 'var(--g)' };
    if (s === 'RUNNING' || s === 'IMPORTED') return { background: 'rgba(33,150,243,.12)', color: '#64b5f6' };
    if (s === 'FAILED') return { background: 'rgba(229,57,53,.1)', color: '#e57373' };
    if (s === 'VERIFIED') return { background: 'rgba(255,183,77,.12)', color: '#FFB74D' };
    return { background: 'rgba(37,211,102,.12)', color: 'var(--g)' };
  };

  // CSS vars — FRESH LIGHT palette (white bg, deep black text)
  const S = {
    '--g': '#25D366', '--gd': '#128C7E', '--gx': '#075E54',
    '--bg': '#f3fbf6', '--card': '#ffffff', '--card2': '#f0fdf5',
    '--border': '#cde9d8', '--border2': '#d5eddf',
    '--text': '#0b1e12', '--muted': '#4d7a62', '--muted2': '#7aad8e',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#0b1e12',
    background: '#f3fbf6',
  };

  const secCard = { background: '#ffffff', border: '1px solid #cde9d8', borderRadius: 16, overflow: 'hidden', animation: 'fadeUp .4s .2s ease both', boxShadow: '0 2px 12px rgba(37,211,102,0.06)' };
  const secHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #e8f5ee' };
  const secTitle = { fontSize: 14, fontWeight: 800, color: '#0b1e12', display: 'flex', alignItems: 'center', gap: 8 };
  const dot = { width: 8, height: 8, borderRadius: '50%', background: 'var(--g)', boxShadow: '0 0 6px var(--g)' };

  return (
    <div style={{ ...S }}>
      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { to{transform:rotate(360deg);} }
        .db-qa { transition:all .2s; }
        .db-qa:hover { border-color:rgba(37,211,102,.4)!important; background:#f0fdf5!important; transform:translateY(-2px); box-shadow:0 4px 16px rgba(37,211,102,.12)!important; }
        .db-qa:hover .db-qa-label { color:#0b1e12!important; }
        .db-act:hover { background:#f0fdf5; }
        .db-sec-action { font-size:12px;font-weight:700;color:#128C7E;cursor:pointer;border:none;background:none;font-family:inherit; }
        .db-sec-action:hover { color:#25D366; text-decoration:underline; }
        .db-trial-btn { padding:9px 20px;border-radius:9px;background:linear-gradient(135deg,#25D366,#00df6a);color:white;font-size:12px;font-weight:900;font-family:inherit;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(37,211,102,.3);transition:all .2s; }
        .db-trial-btn:hover { transform:translateY(-1px);box-shadow:0 8px 20px rgba(37,211,102,.4); }
        .db-num-bar { height:100%;border-radius:4px;background:linear-gradient(90deg,#25D366,#00b894); }
        .db-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .db-main-grid { display: grid; grid-template-columns: 1fr 340px; gap: 18px; }
        .db-stat-card { padding: 20px; }
        @media (max-width: 1024px) {
          .db-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .db-main-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .db-stats-grid { grid-template-columns: 1fr; }
          .db-stat-card { padding: 14px !important; }
        }
      `}</style>

      {/* ── Welcome Row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Welcome Back, <span style={{ color: 'var(--g)' }}>{name}</span> 👋
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Here's your WhatsApp Business API overview.</p>
          <div style={{ fontSize: 12, color: 'var(--muted2)', fontWeight: 600, marginTop: 2 }}>{today()}</div>
        </div>
        <button className="db-trial-btn" style={{ padding: '11px 22px', fontSize: 13 }} onClick={() => navigate('/campaigns')}>
          + New Campaign
        </button>
      </div>

      {/* ── Plan / Trial Banner ── */}
      {(() => {
        const hasActiveSub = !!account?.validityExpiresAt && new Date(account.validityExpiresAt) > new Date();
        const hasPlanPendingPayment = !!account?.planId && !account?.validityExpiresAt;
        const isExpiredSub = !!account?.validityExpiresAt && new Date(account.validityExpiresAt) < new Date();
        const isSuperAdmin = account?.role === 'SUPERADMIN';

        if (isSuperAdmin) {
          return (
            <div style={{ background: 'linear-gradient(135deg,rgba(37,211,102,.1),rgba(18,140,126,.08))', border: '1px solid rgba(37,211,102,.22)', borderRadius: 14, padding: '16px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .35s ease both' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,211,102,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: 'var(--g)', fill: 'none', strokeWidth: 2.5 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--g)', marginBottom: 2 }}>👑 SUPER ADMIN ACCOUNT</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Full access — no subscription required.</div>
              </div>
            </div>
          );
        }

        if (hasActiveSub) {
          return (
            <div style={{ background: 'linear-gradient(135deg,rgba(37,211,102,.1),rgba(18,140,126,.08))', border: '1px solid rgba(37,211,102,.22)', borderRadius: 14, padding: '16px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .35s ease both' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,211,102,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: 'var(--g)', fill: 'none', strokeWidth: 2.5 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--g)', marginBottom: 2 }}>
                  {account?.plan?.name ? '🎉 ' + account.plan.name.toUpperCase() + ' ACTIVE' : '🎉 PLAN ACTIVE'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Subscription active{expiry && <> · Expires <strong style={{ color: 'var(--text)' }}>{expiry}</strong></>}.
                </div>
              </div>
              <Link to="/plans"><button className="db-trial-btn">Renew / Upgrade →</button></Link>
            </div>
          );
        }

        if (isExpiredSub) {
          return (
            <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,.1),rgba(239,68,68,.06))', border: '1px solid rgba(245,158,11,.3)', borderRadius: 14, padding: '16px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .35s ease both' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: '#f59e0b', fill: 'none', strokeWidth: 2.5 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#f59e0b', marginBottom: 2 }}>⏳ SUBSCRIPTION EXPIRED</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Expired on <strong style={{ color: '#ef4444' }}>{expiry}</strong>. Renew now to restore all features.</div>
              </div>
              <Link to="/plans"><button className="db-trial-btn" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>Renew Now →</button></Link>
            </div>
          );
        }

        // No active subscription — fresh user or paid plan pending payment
        const canClaimFree = !account?.usedFreePlan;

        return (
          <div style={{ background: 'linear-gradient(135deg,rgba(167,139,250,.1),rgba(37,211,102,.06))', border: '1px solid rgba(167,139,250,.25)', borderRadius: 14, padding: '16px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .35s ease both' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: '#a78bfa', fill: 'none', strokeWidth: 2.5 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#a78bfa', marginBottom: 2 }}>
                {canClaimFree ? '🎁 FREE TRIAL AVAILABLE' : (hasPlanPendingPayment ? '💳 PAYMENT PENDING — ACTIVATE YOUR PLAN' : '🚀 CHOOSE A PLAN TO UNLOCK ALL FEATURES')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {canClaimFree
                  ? 'Start your free trial today and unlock campaigns, automation, and integrations immediately.'
                  : (hasPlanPendingPayment
                    ? `You selected "${account?.plan?.name}" — complete payment to activate all features.`
                    : 'Currently only Live Chat is active. Please choose a plan to access campaigns, automation, and all other features.')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {canClaimFree && (
                <button onClick={handleActivateFreePlan} className="db-trial-btn" style={{ background: 'linear-gradient(135deg,#f59e0b,#f59e0b)' }}>Claim Free Trial 🎁</button>
              )}
              <button onClick={() => setIsActivationModalOpen(true)} className="db-trial-btn" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)' }}>{hasPlanPendingPayment ? 'Complete Payment →' : 'View Plans →'}</button>
            </div>
          </div>
        );
      })()}

      {/* ── Wallet Banner (if enabled) ── */}
      {config?.WALLET_MANAGEMENT_ENABLED === 'true' && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(37,211,102,0.06) 0%, #ffffff 100%)',
          border: '1px solid #cde9d8',
          borderRadius: 14,
          padding: '16px 22px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 2px 12px rgba(37,211,102,0.04)',
          animation: 'fadeUp .35s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(37,211,102,0.1)',
              border: '1px solid rgba(37,211,102,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', strokeWidth: 2, stroke: '#25D366' }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M12 11h4v2h-4z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4d7a62', marginBottom: 2 }}>Available Credits</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#0b1e12', letterSpacing: '-0.5px' }}>₹{walletBalance.toFixed(2)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#25D366' }}>INR</span>
                {isLowBalance && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    ⚠️ Low Balance
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/wallet/logs" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '9px 18px',
                borderRadius: 9,
                background: '#ffffff',
                border: '1px solid #cde9d8',
                color: '#4d7a62',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0fdf5'}
              onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
              >
                History
              </button>
            </Link>
            <button onClick={() => setIsRechargeModalOpen(true)} className="db-trial-btn" style={{ padding: '9px 20px' }}>
              + Top-Up
            </button>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="db-stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          iconBg="rgba(37,211,102,.12)" iconColor="#25D366"
          icon={<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>}
          bigIcon={<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>}
          label="Total Messages Sent" value={fmt(msgSent)} sub="All time"
          trend={`↑ ${fmt(analytics.thisWeekMessages ?? 0)} this week`} trendUp
        />
        <StatCard
          iconBg="rgba(33,150,243,.1)" iconColor="#64b5f6"
          icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>}
          bigIcon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>}
          label="Active Contacts" value={fmt(analytics.activeContacts)} sub="Total recorded"
          trend="↑ Growing" trendUp
        />
        <StatCard
          iconBg="rgba(255,183,77,.1)" iconColor="#FFB74D"
          icon={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />}
          bigIcon={<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />}
          label="Read Rate" value={`${analytics.readRate ?? 0}%`} sub="Outbound average"
          trend="↑ vs 22% email" trendUp
        />
        <StatCard
          iconBg="rgba(236,64,122,.1)" iconColor="#f48fb1"
          icon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
          bigIcon={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
          label="Delivery Rate" value={`${analytics.deliveryRate ?? 0}%`} sub="All messages delivered"
          trend="↑ Perfect score" trendUp
        />
      </div>

      {/* ── Main Grid: Left (Chart + Activity) + Right Column ── */}
      <div className="db-main-grid" style={{ marginBottom: 18 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Bar Chart */}
          <div style={secCard}>
            <div style={secHead}>
              <div style={secTitle}><div style={dot} /> Messages This Week</div>
              <button className="db-sec-action" onClick={() => navigate('/analytics')}>View Report →</button>
            </div>
            <BarChart data={weekData} />
          </div>

          {/* Recent Activity */}
          <div style={secCard}>
            <div style={secHead}>
              <div style={secTitle}><div style={dot} /> Recent Activity</div>
              <button className="db-sec-action" onClick={() => navigate('/campaigns')}>View All →</button>
            </div>
            <div>
              {analytics.recentActivity && analytics.recentActivity.length > 0 ? analytics.recentActivity.slice(0, 6).map((act, i) => (
                <div key={act.id || i} className="db-act" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', transition: 'background .15s', cursor: 'default', borderBottom: i < analytics.recentActivity.length - 1 ? '1px solid rgba(30,46,34,.6)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: 'none', strokeWidth: 2, stroke: '#25D366' }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.action}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{fmtTime(act.time)}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0, ...badgeStyle(act.status) }}>{act.status}</span>
                </div>
              )) : (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No recent activity yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Quick Actions */}
          <div style={secCard}>
            <div style={secHead}>
              <div style={secTitle}><div style={dot} /> Quick Actions</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 16 }}>
              {[
                { label: 'New Campaign', to: '/campaigns', bg: 'rgba(37,211,102,.12)', stroke: '#25D366', icon: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></> },
                { label: 'Add Contact', to: '/contacts', bg: 'rgba(33,150,243,.1)', stroke: '#64b5f6', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></> },
                { label: 'New Template', to: '/templates', bg: 'rgba(255,183,77,.1)', stroke: '#FFB74D', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /></> },
                { label: 'Flow Builder', to: '/chatbot/visual-flows', bg: 'rgba(236,64,122,.08)', stroke: '#f48fb1', icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /> },
              ].map(({ label, to, bg, stroke, icon }) => (
                <Link key={label} to={to} style={{ textDecoration: 'none' }}>
                  <div className="db-qa" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 10px', borderRadius: 12, background: 'var(--card2)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all .2s', textAlign: 'center' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" style={{ width: 19, height: 19, fill: 'none', strokeWidth: 2, stroke }}>{icon}</svg>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Plan Status */}
          <div style={secCard}>
            <div style={secHead}>
              <div style={secTitle}><div style={dot} /> Plan Status</div>
              <Link to="/plans"><button className="db-sec-action">Upgrade</button></Link>
            </div>
            <div style={{ padding: 16 }}>
              {/* SVG ring */}
              <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 14px' }}>
                <svg viewBox="0 0 100 100" width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={50} cy={50} r={45} fill="none" stroke="var(--border2)" strokeWidth={8} />
                  <circle cx={50} cy={50} r={45} fill="none" stroke="var(--g)" strokeWidth={8} strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{usedPct}%</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>USED</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { val: fmt(msgSent), lbl: 'Msgs Sent', green: false },
                  { val: fmt(msgRem), lbl: 'Remaining', green: true },
                  { val: fmt(analytics.activeContacts), lbl: 'Contacts', green: false },
                  { val: planName, lbl: 'Current Plan', green: true },
                ].map(({ val, lbl, green }) => (
                  <div key={lbl} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: green ? 'var(--g)' : 'var(--text)' }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance */}
          <div style={secCard}>
            <div style={secHead}>
              <div style={secTitle}><div style={dot} /> Performance</div>
            </div>
            <div style={{ padding: '10px 16px 16px' }}>
              {[
                { label: 'Open Rate', val: analytics.readRate ?? 0 },
                { label: 'Click Rate', val: analytics.clickRate ?? 0 },
                { label: 'Reply Rate', val: analytics.replyRate ?? 0 },
                { label: 'Delivery', val: analytics.deliveryRate ?? 100 },
              ].map(({ label, val }, i, arr) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 80, height: 4, background: 'var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div className="db-num-bar" style={{ width: `${val}%` }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{val}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recharge Modal ── */}
      {isRechargeModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'rgba(11, 30, 18, 0.4)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 400,
            background: '#ffffff',
            border: '1px solid #cde9d8',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 12px 40px rgba(18, 140, 126, 0.15)',
            animation: 'fadeUp 0.3s ease both',
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 900,
              color: '#0b1e12',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', strokeWidth: 2.5, stroke: '#25D366' }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M12 11h4v2h-4z" />
              </svg>
              Top-Up Wallet
            </h2>
            <p style={{ fontSize: 13, color: '#4d7a62', marginBottom: 24 }}>Enter the amount to add to your credits.</p>
            
            <form onSubmit={handleRecharge}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#4d7a62', marginBottom: 8, letterSpacing: '0.05em' }}>Amount (INR)</label>
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#0b1e12' }}>₹</span>
                <input
                  type="number"
                  required
                  min={minRecharge}
                  step="1"
                  value={rechargeAmount}
                  onChange={e => setRechargeAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 32px',
                    borderRadius: 12,
                    border: '1px solid #cde9d8',
                    background: '#fcfdfe',
                    color: '#0b1e12',
                    fontSize: 16,
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder={`e.g. ${minRecharge * 5}`}
                />
              </div>
              <p style={{ fontSize: 11, color: '#7aad8e', marginBottom: 24 }}>Minimum top-up: ₹{minRecharge}</p>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #cde9d8',
                    color: '#4d7a62',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rechargeLoading}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37,211,102,0.25)',
                  }}
                >
                  {rechargeLoading ? 'Processing...' : 'Pay with Razorpay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Plan Activation Modal ── */}
      <FreshPlanActivationModal 
        account={account} 
        isOpen={isActivationModalOpen} 
        onClose={() => setIsActivationModalOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;
