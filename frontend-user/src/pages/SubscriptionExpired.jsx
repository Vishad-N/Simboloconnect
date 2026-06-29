import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, ArrowRight, Clock, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const Orb = ({ size, color, top, left, delay = 0 }) => (
    <div style={{
        position: 'absolute', borderRadius: '50%',
        width: size, height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        top, left, filter: 'blur(50px)', opacity: 0.3,
        animation: `orbFloat 6s ease-in-out infinite`,
        animationDelay: `${delay}s`, pointerEvents: 'none'
    }} />
);

const SubscriptionExpired = () => {
    const navigate = useNavigate();
    const { branding } = useBranding();
    const cardRef = useRef(null);

    const supportPhone = branding?.supportPhoneNumber || '919999999999';
    const supportPhoneClean = supportPhone.replace(/[^0-9]/g, '');
    const platformName = branding?.name || import.meta.env.VITE_BRAND_NAME || 'WaDesk';

    const handleWhatsApp = () => {
        const msg = `Hi! Mera ${platformName} subscription expire ho gaya hai. Main renew karna chahta hoon. Please guide karein.`;
        window.open(`https://wa.me/${supportPhoneClean}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleCall = () => window.open(`tel:${supportPhoneClean}`, '_self');

    // Card 3D tilt effect
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const handleMove = (e) => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
            card.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg)`;
        };
        const handleLeave = () => { card.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)'; };
        card.addEventListener('mousemove', handleMove);
        card.addEventListener('mouseleave', handleLeave);
        return () => { card.removeEventListener('mousemove', handleMove); card.removeEventListener('mouseleave', handleLeave); };
    }, []);

    return (
        <>
            <style>{`
                @keyframes orbFloat {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50% { transform: translateY(-20px) scale(1.05); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(32px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes shimmerBtn {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes pulseRing {
                    0%   { transform: scale(0.9); opacity: 0.8; }
                    70%  { transform: scale(1.2); opacity: 0; }
                    100% { transform: scale(0.9); opacity: 0; }
                }
                .se-primary-btn {
                    background: linear-gradient(90deg, #f59e0b 0%, #ef4444 40%, #f59e0b 80%);
                    background-size: 200% auto;
                    animation: shimmerBtn 2.5s linear infinite;
                    width: 100%; padding: 15px 24px;
                    border-radius: 14px; border: none;
                    color: #000; font-weight: 900; font-size: 15px;
                    cursor: pointer; display: flex; align-items: center;
                    justify-content: center; gap: 8px; margin-bottom: 12px;
                    box-shadow: 0 6px 24px rgba(245,158,11,0.4);
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .se-chat-btn {
                    width: 100%; padding: 12px 24px;
                    border-radius: 14px; border: 1px solid rgba(37,211,102,0.2);
                    background: rgba(37,211,102,0.05); color: #25D366;
                    font-weight: 700; font-size: 13.5px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 7px;
                    margin-bottom: 16px; transition: all 0.2s ease;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .se-chat-btn:hover { background: rgba(37,211,102,0.12); transform: translateY(-1px); }
                .se-support-btn {
                    padding: 12px 16px; border-radius: 12px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 7px;
                    font-weight: 700; font-size: 13px; transition: all 0.2s ease;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .se-support-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.07) !important; }
                .se-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
            `}</style>

            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #1a0a0a 0%, #0f1a1f 50%, #1a0a0a 100%)',
                padding: '32px 16px', position: 'relative', overflow: 'hidden',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>
                {/* Ambient orbs */}
                <Orb size="400px" color="#f59e0b" top="-10%" left="-5%" delay={0} />
                <Orb size="300px" color="#ef4444" top="60%" left="65%" delay={2} />
                <Orb size="200px" color="#25D366" top="20%" left="70%" delay={4} />

                {/* Grid pattern */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.03,
                    backgroundImage: 'linear-gradient(rgba(245,158,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px', pointerEvents: 'none'
                }} />

                {/* Card */}
                <div ref={cardRef} className="se-card" style={{
                    width: '100%', maxWidth: 540,
                    background: 'rgba(10,10,18,0.92)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 28, padding: '44px 38px',
                    boxShadow: '0 0 60px rgba(245,158,11,0.1), 0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
                    animation: 'slideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    position: 'relative', overflow: 'hidden',
                    backdropFilter: 'blur(20px)', willChange: 'transform',
                }}>
                    {/* Top gradient bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, transparent, #f59e0b, #ef4444, transparent)',
                    }} />

                    {/* Corner glow */}
                    <div style={{
                        position: 'absolute', top: -80, right: -80, width: 240, height: 240,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 65%)',
                        pointerEvents: 'none'
                    }} />

                    {/* Badge */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '5px 14px', borderRadius: 100,
                            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                            fontSize: 11.5, fontWeight: 800, color: '#f59e0b',
                            letterSpacing: '0.05em', textTransform: 'uppercase'
                        }}>
                            ⏳ Subscription Expired
                        </span>
                    </div>

                    {/* Icon with pulse */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute', inset: -10, borderRadius: '50%',
                                border: '2px solid #f59e0b',
                                animation: 'pulseRing 2.5s ease-out infinite',
                            }} />
                            <div style={{
                                position: 'absolute', inset: -10, borderRadius: '50%',
                                border: '2px solid #f59e0b',
                                animation: 'pulseRing 2.5s ease-out infinite',
                                animationDelay: '0.8s',
                            }} />
                            <div style={{
                                width: 76, height: 76, borderRadius: 20,
                                background: 'rgba(245,158,11,0.12)',
                                border: '1.5px solid rgba(245,158,11,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 30px rgba(245,158,11,0.2)',
                            }}>
                                <Clock size={38} color="#f59e0b" />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 style={{
                        textAlign: 'center', color: '#ffffff',
                        fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px',
                        marginBottom: 14, lineHeight: 1.3
                    }}>
                        Your Subscription Has Expired!
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        textAlign: 'center', color: 'rgba(255,255,255,0.5)',
                        fontSize: 14, lineHeight: 1.7, marginBottom: 24,
                    }}>
                        You can still receive and reply to messages via <strong style={{ color: '#25D366' }}>Live Chat</strong>.
                        <br />Please renew your plan to access all other features.
                    </p>

                    {/* Feature chips */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        justifyContent: 'center', marginBottom: 28
                    }}>
                        {[
                            { icon: MessageSquare, label: 'Live Chat Active', color: '#25D366' },
                            { icon: ShieldCheck, label: 'Data Safe & Secure', color: '#3b82f6' },
                            { icon: Sparkles, label: 'Instant Reactivation', color: '#a78bfa' },
                        ].map((chip, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 100,
                                background: `${chip.color}14`, border: `1px solid ${chip.color}28`,
                                fontSize: 11.5, fontWeight: 700, color: chip.color,
                            }}>
                                <chip.icon size={12} />
                                {chip.label}
                            </div>
                        ))}
                    </div>

                    {/* Primary CTA */}
                    <button className="se-primary-btn" onClick={() => navigate('/plans')}>
                        Renew Plan Now
                        <ArrowRight size={17} />
                    </button>

                    {/* Live chat shortcut */}
                    <button className="se-chat-btn" onClick={() => navigate('/chat')}>
                        <MessageSquare size={15} />
                        Open Live Chat (Always Free)
                    </button>

                    {/* Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>Or Contact Support</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    </div>

                    {/* Support buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button className="se-support-btn" onClick={handleWhatsApp} style={{
                            border: '1px solid rgba(37,211,102,0.18)',
                            background: 'rgba(37,211,102,0.05)', color: '#25D366',
                        }}>
                            <MessageCircle size={15} />
                            WhatsApp
                        </button>
                        <button className="se-support-btn" onClick={handleCall} style={{
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
                        }}>
                            <Phone size={15} />
                            Call Support
                        </button>
                    </div>

                    {/* Footer note */}
                    <p style={{
                        textAlign: 'center', marginTop: 18,
                        fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 500
                    }}>
                        {platformName} • Your data is safe 🔒
                    </p>
                </div>
            </div>
        </>
    );
};

export default SubscriptionExpired;
