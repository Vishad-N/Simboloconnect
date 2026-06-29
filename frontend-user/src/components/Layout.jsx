import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Settings, LogOut, Bell, Send, MessageCircle, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import AccountSettingsModal from './AccountSettingsModal';
import MobileBottomNav from './MobileBottomNav';
import { useBranding } from '../context/BrandingContext';
import { io } from 'socket.io-client';
import FeatureOverlay from './FeatureOverlay';

const Layout = () => {
    const { branding, loading: brandingLoading, activeTheme, setUserThemePreference } = useBranding();
    const [user, setUser] = useState({ name: 'Test Account', logo: '' });
    const [accountDetails, setAccountDetails] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const dropdownRef = useRef(null);
    const notifRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('tenantId');
        navigate('/login');
    };

    // Fetch initial user details on load
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/account`);
                if (res.data) {
                    setAccountDetails(res.data);
                    setUser({
                        name: res.data.name || 'Account User',
                        logo: res.data.logo || '',
                        email: res.data.email || '',
                        role: res.data.role
                    });
                }
            } catch (error) {
                console.error("Failed to fetch user for layout", error);
            }
        };

        const fetchNotifications = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/account/notifications`);
                setNotifications(res.data || []);
            } catch (error) {
                console.error("Failed to fetch notifications");
            }
        };

        fetchUser();
        fetchNotifications();

        // Socket setup for global notifications
        const tenantId = localStorage.getItem('tenantId');
        if (tenantId) {
            const socket = io(import.meta.env.VITE_API_URL || '');
            socket.on('connect', () => {
                socket.emit('join_tenant', tenantId);
            });
            socket.on('new_notification', (notif) => {
                setNotifications(prev => [notif, ...prev]);
            });
            return () => socket.disconnect();
        }
    }, []);

    // Handle clicks outside of dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleReadNotification = async (id) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/account/notifications/${id}/read`);
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) { }
    };

    const handleProfileUpdate = (updatedUser) => {
        setUser({ name: updatedUser.name || 'Test Account', logo: updatedUser.logo || '' });
    };

    // Subscription & feature check
    const isSuperAdmin = accountDetails?.role === 'SUPERADMIN';
    // EXPIRED: user previously had a plan, now it's past expiry date
    const isExpired = accountDetails &&
        accountDetails.validityExpiresAt !== null &&
        new Date(accountDetails.validityExpiresAt) < new Date();
    // HAS_NO_PLAN: user has no active subscription (fresh user or paid plan not yet activated)
    const hasNoPlan = accountDetails &&
        !accountDetails.validityExpiresAt &&
        accountDetails.role !== 'SUPERADMIN';
    const pathname = location.pathname;

    const allowedPathPrefixes = [
        '/dashboard', '/plans', '/chat', '/live-chat', '/profile', '/settings', '/wallet', '/payment'
    ];
    const isPathAllowedUnderExpiry = allowedPathPrefixes.some(pref => pathname.startsWith(pref));

    let featureLockName = null;
    if (accountDetails && accountDetails.plan && !isSuperAdmin) {
        const plan = accountDetails.plan;
        if (pathname.startsWith('/campaigns') && plan.allow_campaigns === false) {
            featureLockName = 'Bulk Campaigns';
        } else if (pathname.includes('/chatbot/visual-flows') && plan.allow_flow_builder === false) {
            featureLockName = 'Flow Builder';
        } else if (pathname.includes('/ai-brain') && plan.allow_ai_brain === false) {
            featureLockName = 'AI Brain';
        } else if (pathname.includes('/ai-voice') && plan.allow_ai_voice === false) {
            featureLockName = 'AI Voice';
        } else if ((pathname.includes('/qna') || pathname.includes('/chatbot/autoreplies') || pathname.includes('/chatbot/flows')) && plan.allow_qna === false) {
            featureLockName = 'QnA / Bot Replies';
        } else if (pathname.includes('/ecommerce') && plan.allow_ecommerce === false) {
            featureLockName = 'Ecommerce Integration';
        } else if (pathname.includes('/integrations') && plan.allow_integrations === false) {
            featureLockName = 'Integrations';
        } else if (pathname.includes('/team') && plan.allow_team === false) {
            featureLockName = 'Team Members';
        }
    }

    const showExpiredBlock = isExpired && !isPathAllowedUnderExpiry && !isSuperAdmin;
    const showNoPlanBlock = hasNoPlan && !isPathAllowedUnderExpiry && !isSuperAdmin;
    const showFeatureBlock = !isExpired && !hasNoPlan && featureLockName !== null && !isSuperAdmin;

    return (
        <div className="h-screen bg-black flex overflow-hidden">
            <Sidebar user={user} />
            <div className="flex-1 min-h-0 ml-0 md:ml-[220px] flex flex-col overflow-hidden">
                <header className="h-16 border-b border-white/[0.06] flex items-center justify-between md:justify-end px-4 md:px-8 sticky top-0 bg-black/90 backdrop-blur z-10 gap-6">
                    <div className="flex md:hidden items-center gap-2">
                        {brandingLoading ? null : branding?.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[150px] object-contain" />
                        ) : (
                            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-surface-300">
                                {branding?.name || 'Workspace'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4 md:gap-6">
                        <button
                            onClick={() => setUserThemePreference(activeTheme === 'fresh' ? 'classic' : 'fresh')}
                            className="p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-full transition flex items-center justify-center"
                            title={activeTheme === 'fresh' ? "Switch to Dark Theme" : "Switch to Light Theme"}
                        >
                            {activeTheme === 'fresh' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>

                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                className="relative p-2 text-surface-400 hover:text-white hover:bg-white/5 rounded-full transition"
                            >
                                <Bell size={20} />
                                {notifications.filter(n => !n.isRead).length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-black"></span>
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-2xl py-2 z-50 animate-fade-in origin-top-right overflow-hidden" style={{background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.07)'}}>
                                    <div className="px-4 py-2" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                                        <h3 className="font-semibold text-surface-100">Notifications</h3>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="px-4 py-6 text-center text-white0 text-sm">No new notifications</div>
                                        ) : (
                                            notifications.map(notif => (
                                                <div
                                                    key={notif.id}
                                                    className={`px-4 py-3 hover:bg-white/5 transition cursor-pointer ${notif.isRead ? 'opacity-60' : ''}`} style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}
                                                    onClick={() => !notif.isRead && handleReadNotification(notif.id)}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className={`text-sm ${notif.isRead ? 'text-surface-300 font-medium' : 'text-white font-semibold'}`}>{notif.title}</h4>
                                                        {!notif.isRead && <span className="w-2 h-2 bg-brand-500 rounded-full mt-1 shrink-0"></span>}
                                                    </div>
                                                    <p className="text-xs text-surface-400 leading-relaxed">{notif.message}</p>
                                                    <p className="text-[10px] text-surface-500 mt-2">{new Date(notif.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative border-l border-white/[0.06] pl-6" ref={dropdownRef}>
                            <div
                                className="flex items-center gap-3 cursor-pointer p-1 rounded-xl hover:bg-white/5 transition pl-3"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-bold text-surface-100">{user.name}</p>
                                    <p className="text-xs text-brand-400 font-medium">{user.role || 'Connected'}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full items-center justify-center flex text-surface-400 overflow-hidden shadow-sm" style={{background:'#1a1a1a', border:'2px solid rgba(255,255,255,0.08)'}}>
                                    {user.logo ? (
                                        <img src={user.logo} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-sm">{user.name ? user.name.charAt(0).toUpperCase() : 'T'}</span>
                                    )}
                                </div>
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl py-2 z-50 animate-fade-in origin-top-right" style={{background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.07)'}}>
                                    <button
                                        onClick={() => { setIsModalOpen(true); setIsDropdownOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-surface-200 hover:bg-white/5 hover:text-white flex items-center gap-2 transition"
                                    >
                                        <Settings size={16} /> Account Settings
                                    </button>
                                    <div className="h-[1px] my-1" style={{background:'rgba(255,255,255,0.05)'}}></div>
                                    <button
                                        onClick={() => { handleLogout(); setIsDropdownOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2 transition"
                                    >
                                        <LogOut size={16} /> Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 min-h-0 overflow-y-auto" style={{background:'#000000'}}>
                    <div className="p-6 pb-24 md:p-8 max-w-7xl mx-auto animate-fade-in min-h-full">
                        {showExpiredBlock ? (
                            <FeatureOverlay reason="EXPIRED" account={accountDetails} />
                        ) : showNoPlanBlock ? (
                            <FeatureOverlay reason="NO_PLAN" account={accountDetails} />
                        ) : showFeatureBlock ? (
                            <FeatureOverlay reason="FEATURE_LOCKED" featureName={featureLockName} account={accountDetails} />
                        ) : (
                            <Outlet />
                        )}
                    </div>
                </main>
            </div>

            {branding?.supportPhoneNumber && (
                <a
                    href={`https://wa.me/${branding.supportPhoneNumber.replace(/[^0-9]/g, '')}?text=Hi%2C%20I%20need%20help%20with%20my%20account`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fixed bottom-20 left-4 md:hidden bg-green-500 text-white p-3 rounded-full shadow-2xl hover:bg-green-600 transition-all transform hover:scale-105 z-50 flex items-center justify-center gap-2 border-2 border-green-400/30"
                    title="Contact Support"
                >
                    <MessageCircle size={24} />
                </a>
            )}

            <MobileBottomNav user={user} />

            <AccountSettingsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onUpdate={handleProfileUpdate}
            />
        </div>
    );
};

export default Layout;
