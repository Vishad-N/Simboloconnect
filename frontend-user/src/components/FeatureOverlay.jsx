import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, ArrowRight, Zap, Crown, Clock, MessageSquare, Sparkles, ShieldCheck, Star } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

/* ─── Animated floating orb ─── */
const Orb = ({ size, color, top, left, delay = 0, isFresh }) => (
    <div style={{
        position: 'absolute', borderRadius: '50%',
        width: size, height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        top, left, filter: 'blur(40px)', opacity: isFresh ? 0.15 : 0.35,
        animation: `orbFloat 6s ease-in-out infinite`,
        animationDelay: `${delay}s`, pointerEvents: 'none'
    }} />
);

/* ─── Feature chip ─── */
const Chip = ({ icon: Icon, label, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 100,
        background: `${color}14`, border: `1px solid ${color}28`,
        fontSize: 11.5, fontWeight: 700, color,
        whiteSpace: 'nowrap'
    }}>
        <Icon size={12} />
        {label}
    </div>
);

/* ─── Main Component ─── */
const FeatureOverlay = ({ reason = 'EXPIRED', featureName = '', account = null }) => {
    const navigate = useNavigate();
    const { branding, activeTheme } = useBranding();
    const cardRef = useRef(null);

    const supportPhone = branding?.supportPhoneNumber || '919999999999';
    const supportPhoneClean = supportPhone.replace(/[^0-9]/g, '');
    const platformName = branding?.name || 'WhatsApp CRM';

    // Days since expiry
    const daysSinceExpiry = account?.validityExpiresAt
        ? Math.floor((new Date() - new Date(account.validityExpiresAt)) / (1000 * 60 * 60 * 24))
        : null;

    const handleWhatsApp = (msg) => {
        window.open(`https://wa.me/${supportPhoneClean}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleCall = () => window.open(`tel:${supportPhoneClean}`, '_self');

    // Card tilt effect
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const handleMove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
            card.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg) translateZ(4px)`;
        };
        const handleLeave = () => { card.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)'; };
        card.addEventListener('mousemove', handleMove);
        card.addEventListener('mouseleave', handleLeave);
        return () => { card.removeEventListener('mousemove', handleMove); card.removeEventListener('mouseleave', handleLeave); };
    }, []);

    // ── State configurations ──
    const states = {
        NO_PLAN: {
            gradient: 'linear-gradient(135deg, #0a1628 0%, #0d1f12 50%, #0a1628 100%)',
            accent: '#25D366',
            accentSecondary: '#00e676',
            icon: <Zap size={36} color="#25D366" />,
            iconBg: 'rgba(37,211,102,0.12)',
            iconBorder: 'rgba(37,211,102,0.3)',
            badge: '🚀 Get Started',
            badgeColor: '#25D366',
            title: 'Choose a Plan to Unlock All Features',
            subtitle: 'You can send and receive messages via Live Chat.\nPlease choose a subscription plan to unlock all premium features.',
            primaryBtn: 'View & Buy a Plan',
            primaryAction: () => navigate('/plans'),
            waMsg: `Hi! I just signed up on ${platformName} and want to know about plans and pricing. Please guide me.`,
            chips: [
                { icon: MessageSquare, label: 'Live Chat Active', color: '#25D366' },
                { icon: Star, label: 'Free to Start', color: '#f59e0b' },
                { icon: Crown, label: 'Upgrade Anytime', color: '#a78bfa' },
            ]
        },
        EXPIRED: {
            gradient: 'linear-gradient(135deg, #1a0a0a 0%, #0f1a1f 50%, #1a0a0a 100%)',
            accent: '#f59e0b',
            accentSecondary: '#ef4444',
            icon: <Clock size={36} color="#f59e0b" />,
            iconBg: 'rgba(245,158,11,0.12)',
            iconBorder: 'rgba(245,158,11,0.3)',
            badge: '⏳ Subscription Expired',
            badgeColor: '#f59e0b',
            title: 'Your Subscription Has Expired!',
            subtitle: `You can still send and receive messages manually via Live Chat.\nPlease renew your subscription to access other premium features.${daysSinceExpiry && daysSinceExpiry > 0 ? `\n\n⚠️ Expired ${daysSinceExpiry} days ago` : ''}`,
            primaryBtn: 'Renew Subscription',
            primaryAction: () => navigate('/plans'),
            waMsg: `Hi! My ${platformName} subscription has expired. I want to renew it. Please guide me.`,
            chips: [
                { icon: MessageSquare, label: 'Live Chat Still Active', color: '#25D366' },
                { icon: ShieldCheck, label: 'Data Safe & Secure', color: '#3b82f6' },
                { icon: Sparkles, label: 'Instant Reactivation', color: '#a78bfa' },
            ]
        },
        FEATURE_LOCKED: {
            gradient: 'linear-gradient(135deg, #0a0a1a 0%, #0d1a0f 50%, #0a0a1a 100%)',
            accent: '#a78bfa',
            accentSecondary: '#7c3aed',
            icon: <Crown size={36} color="#a78bfa" />,
            iconBg: 'rgba(167,139,250,0.12)',
            iconBorder: 'rgba(167,139,250,0.3)',
            badge: '🔒 Premium Feature',
            badgeColor: '#a78bfa',
            title: `${featureName || 'This Feature'} is Not Included in Your Plan`,
            subtitle: 'Please upgrade your subscription plan to unlock this feature.\nOur premium plans include this and many other advanced features.',
            primaryBtn: 'Upgrade Subscription',
            primaryAction: () => navigate('/plans'),
            waMsg: `Hi! I want to unlock ${featureName || 'a premium feature'} on ${platformName}. Please guide me.`,
            chips: [
                { icon: Zap, label: 'Instant Unlock', color: '#25D366' },
                { icon: Crown, label: 'All Features Included', color: '#f59e0b' },
                { icon: Sparkles, label: 'Premium Support', color: '#a78bfa' },
            ]
        }
    };

    const cfg = states[reason] || states.EXPIRED;
    const isFresh = activeTheme === 'fresh';

    // Theming variables
    const cardBg = isFresh ? '#ffffff' : 'rgba(10,14,20,0.92)';
    const cardBorder = isFresh ? '1px solid #cde9d8' : `1px solid ${cfg.accent}20`;
    const textColor = isFresh ? '#0b1e12' : '#ffffff';
    const subtitleColor = isFresh ? '#4d7a62' : 'rgba(255,255,255,0.5)';
    const cardShadow = isFresh 
        ? `0 12px 40px rgba(18,140,126,0.08), 0 30px 80px rgba(11,30,18,0.05), inset 0 1px 0 rgba(255,255,255,0.8)`
        : `0 0 60px ${cfg.accent}12, 0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`;
    const btnTextColor = isFresh ? '#ffffff' : '#000000';
    const dividerColor = isFresh ? '#cde9d8' : 'rgba(255,255,255,0.06)';
    const dividerTextColor = isFresh ? '#4d7a62' : 'rgba(255,255,255,0.25)';
    const footerColor = isFresh ? '#7aad8e' : 'rgba(255,255,255,0.2)';
    const btnSupportBorder = isFresh ? '1px solid #cde9d8' : '1px solid rgba(255,255,255,0.1)';
    const btnSupportBg = isFresh ? '#ffffff' : 'rgba(255,255,255,0.03)';
    const btnSupportText = isFresh ? '#0b1e12' : 'rgba(255,255,255,0.7)';

    return (
        <>
            <style>{`
                @keyframes orbFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50% { transform: translateY(-20px) scale(1.05); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(28px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes pulse-ring {
                    0%   { transform: scale(0.9); opacity: 0.8; }
                    70%  { transform: scale(1.15); opacity: 0; }
                    100% { transform: scale(0.9); opacity: 0; }
                }
                .fo-shimmer-btn {
                    background: linear-gradient(90deg, ${cfg.accent} 0%, ${cfg.accentSecondary} 40%, ${cfg.accent} 80%);
                    background-size: 200% auto;
                    animation: shimmer 2.5s linear infinite;
                }
                .fo-support-btn {
                    transition: all 0.2s ease;
                }
                .fo-support-btn:hover {
                    background: ${isFresh ? '#f3fbf6' : 'rgba(255,255,255,0.07)'} !important;
                    transform: translateY(-1px);
                }
                .fo-card {
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }
            `}</style>

            <div style={{
                minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '32px 16px', position: 'relative',
            }}>
                {/* Ambient orbs */}
                <Orb size={300} color={cfg.accent} top="-10%" left="-5%" delay={0} isFresh={isFresh} />
                <Orb size={250} color={cfg.accentSecondary} top="60%" left="70%" delay={2} isFresh={isFresh} />
                <Orb size={180} color="#25D366" top="30%" left="60%" delay={4} isFresh={isFresh} />

                {/* Main card */}
                <div ref={cardRef} className="fo-card" style={{
                    width: '100%', maxWidth: 560,
                    background: cardBg,
                    border: cardBorder,
                    borderRadius: 28,
                    padding: '40px 36px',
                    boxShadow: cardShadow,
                    animation: 'slideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    position: 'relative', overflow: 'hidden',
                    backdropFilter: 'blur(20px)',
                    willChange: 'transform',
                }}>
                    {/* Top gradient bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: `linear-gradient(90deg, transparent, ${cfg.accent}, ${cfg.accentSecondary}, transparent)`,
                    }} />

                    {/* Inner glow */}
                    <div style={{
                        position: 'absolute', top: -80, right: -80, width: 240, height: 240,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${cfg.accent}10 0%, transparent 65%)`,
                        pointerEvents: 'none'
                    }} />

                    {/* Badge */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 14px', borderRadius: 100,
                            background: `${cfg.badgeColor}12`,
                            border: `1px solid ${cfg.badgeColor}30`,
                            fontSize: 11.5, fontWeight: 800, color: cfg.badgeColor,
                            letterSpacing: '0.05em', textTransform: 'uppercase'
                        }}>
                            {cfg.badge}
                        </span>
                    </div>

                    {/* Icon with pulse ring */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                        <div style={{ position: 'relative' }}>
                            {/* Pulse rings */}
                            <div style={{
                                position: 'absolute', inset: -8, borderRadius: '50%',
                                border: `2px solid ${cfg.accent}`,
                                animation: 'pulse-ring 2.5s ease-out infinite',
                                animationDelay: '0s'
                            }} />
                            <div style={{
                                position: 'absolute', inset: -8, borderRadius: '50%',
                                border: `2px solid ${cfg.accent}`,
                                animation: 'pulse-ring 2.5s ease-out infinite',
                                animationDelay: '0.8s'
                            }} />
                            <div style={{
                                width: 72, height: 72, borderRadius: 20,
                                background: cfg.iconBg,
                                border: `1.5px solid ${cfg.iconBorder}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 0 30px ${cfg.accent}20`,
                            }}>
                                {cfg.icon}
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 style={{
                        textAlign: 'center', color: textColor,
                        fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px',
                        marginBottom: 14, lineHeight: 1.3
                    }}>
                        {cfg.title}
                    </h2>

                    {/* Subtitle */}
                    <p style={{
                        textAlign: 'center', color: subtitleColor,
                        fontSize: 13.5, lineHeight: 1.7, marginBottom: 24,
                        whiteSpace: 'pre-line'
                    }}>
                        {cfg.subtitle}
                    </p>

                    {/* Feature chips */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        justifyContent: 'center', marginBottom: 28
                    }}>
                        {cfg.chips.map((chip, i) => (
                            <Chip key={i} icon={chip.icon} label={chip.label} color={chip.color} />
                        ))}
                    </div>

                    {/* Primary CTA */}
                    <button
                        onClick={cfg.primaryAction}
                        className="fo-shimmer-btn"
                        style={{
                            width: '100%', padding: '15px 24px',
                            borderRadius: 14, border: 'none',
                            color: btnTextColor, fontWeight: 900,
                            fontSize: 15, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            marginBottom: 12,
                            boxShadow: `0 6px 24px ${cfg.accent}40`,
                        }}
                    >
                        {cfg.primaryBtn}
                        <ArrowRight size={17} />
                    </button>

                    {/* Live Chat shortcut */}
                    <button
                        onClick={() => navigate('/chat')}
                        style={{
                            width: '100%', padding: '12px 24px',
                            borderRadius: 14, border: isFresh ? '1.5px solid #cde9d8' : '1px solid rgba(37,211,102,0.2)',
                            background: isFresh ? '#f3fbf6' : 'rgba(37,211,102,0.04)',
                            color: '#25D366', fontWeight: 700,
                            fontSize: 13.5, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            marginBottom: 16, transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isFresh ? '#e8f5ee' : 'rgba(37,211,102,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isFresh ? '#f3fbf6' : 'rgba(37,211,102,0.04)'; e.currentTarget.style.transform = ''; }}
                    >
                        <MessageSquare size={15} />
                        Open Live Chat (Always Free)
                    </button>

                    {/* Divider */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14
                    }}>
                        <div style={{ flex: 1, height: 1, background: dividerColor }} />
                        <span style={{ fontSize: 11, color: dividerTextColor, fontWeight: 600 }}>Or Contact Support</span>
                        <div style={{ flex: 1, height: 1, background: dividerColor }} />
                    </div>

                    {/* Support buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                            className="fo-support-btn"
                            onClick={() => handleWhatsApp(cfg.waMsg)}
                            style={{
                                padding: '12px 16px', borderRadius: 12,
                                border: isFresh ? '1.5px solid #cde9d8' : '1px solid rgba(37,211,102,0.18)',
                                background: isFresh ? '#f3fbf6' : 'rgba(37,211,102,0.05)',
                                color: '#25D366', fontWeight: 700, fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            }}
                        >
                            <MessageCircle size={15} />
                            WhatsApp
                        </button>
                        <button
                            className="fo-support-btn"
                            onClick={handleCall}
                            style={{
                                padding: '12px 16px', borderRadius: 12,
                                border: btnSupportBorder,
                                background: btnSupportBg,
                                color: btnSupportText, fontWeight: 700, fontSize: 13,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            }}
                        >
                            <Phone size={15} />
                            Call Support
                        </button>
                    </div>

                    {/* Footer note */}
                    <p style={{
                        textAlign: 'center', marginTop: 18,
                        fontSize: 11, color: footerColor,
                        fontWeight: 500
                    }}>
                        {platformName} • Your data is safe and secure 🔒
                    </p>
                </div>
            </div>
        </>
    );
};

export default FeatureOverlay;
