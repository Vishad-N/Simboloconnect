import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Package, Send, ShieldCheck, Webhook, Settings, LogOut, Activity, MonitorUp, PaintBucket, MessageSquare, User, CreditCard, LayoutTemplate, Facebook, Bot, Phone } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const Sidebar = () => {
    const { branding, brandingLoading } = useBranding();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('adminPermissions');
        navigate('/login');
    };

    const adminRole = localStorage.getItem('adminRole') || 'SUPERADMIN';
    const rawPerms = localStorage.getItem('adminPermissions');
    let adminPermissions = [];
    try {
        adminPermissions = (rawPerms && rawPerms !== 'undefined') ? JSON.parse(rawPerms) : [];
    } catch (e) {
        adminPermissions = [];
    }

    const navItems = [
        { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} />, module: 'Dashboard' },
        { path: '/users', label: 'User Management', icon: <Users size={20} />, module: 'Users' },
        { path: '/plans', label: 'Plan Management', icon: <Package size={20} />, module: 'Plans' },
        { path: '/broadcast', label: 'Broadcast Alert', icon: <Send size={20} />, module: 'Broadcast' },
        { path: '/profile', label: 'Admin Profile', icon: <User size={20} />, module: 'Profile' },
        { path: '/settings', label: 'System Settings', icon: <Settings size={20} />, module: 'Settings' },
        { path: '/wallet-management', label: 'Wallet Management', icon: <CreditCard size={20} />, superAdminOnly: true },
        { path: '/payment-gateways', label: 'Payment Gateways', icon: <CreditCard size={20} />, superAdminOnly: true },
        { path: '/landing-editor', label: 'Landing Editor', icon: <LayoutTemplate size={20} />, superAdminOnly: true },
        { path: '/sms-gateways', label: 'SMS Gateways', icon: <MessageSquare size={20} />, superAdminOnly: true },
        { path: '/staff', label: 'Staff Management', icon: <ShieldCheck size={20} />, superAdminOnly: true },
        { path: '/audit-logs', label: 'Audit Logs', icon: <ShieldCheck size={20} />, superAdminOnly: true },
        { path: '/webhooks', label: 'Webhook Monitor', icon: <Webhook size={20} />, superAdminOnly: true },
        { path: '/ai-control-center', label: 'AI Control Center', icon: <Bot size={20} />, superAdminOnly: true },
        { path: '/voice-center', label: 'Voice Center', icon: <Phone size={20} />, superAdminOnly: true },
        { path: '/embedded-signup', label: 'Embedded Signup', icon: <Facebook size={20} />, superAdminOnly: true },
        { path: '/system-updates', label: 'System Updates', icon: <MonitorUp size={20} />, superAdminOnly: true },
        { path: '/advanced-css', label: 'Advanced CSS', icon: <PaintBucket size={20} />, superAdminOnly: true },
    ].filter(item => {
        if (adminRole === 'SUPERADMIN' || adminRole === 'ADMIN') return true;
        if (item.superAdminOnly) return false;
        if (item.module && adminPermissions.includes(item.module)) return true;
        return false;
    });

    return (
        <aside className="w-64 bg-white border-r border-surface-200 h-screen sticky top-0 flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-surface-200">
                {brandingLoading ? null : branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain mr-2" />
                ) : (
                    <Activity className="text-brand-600 mr-2" size={24} />
                )}
                <span className="font-bold text-lg text-surface-900 truncate">{branding.name}</span>
            </div>

            <nav className="flex-1 px-4 mt-6 space-y-1 overflow-y-auto">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={() =>
                            `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${location.pathname === item.path
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="ml-3">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-surface-200">
                <div className="mb-4 px-2">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Logged in as</p>
                    <p className="text-sm font-semibold text-surface-900 truncate">
                        {localStorage.getItem('adminEmail')}
                    </p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="ml-3">Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

const Header = () => {
    const { branding } = useBranding();

    return (
        <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-8 sticky top-0 z-10 w-full">
            <h1 className="text-xl font-semibold text-surface-800">Administration</h1>
            <div className="flex items-center space-x-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    System Operational
                </span>
            </div>
        </header>
    );
};

const Layout = () => {
    return (
        <div className="flex min-h-screen bg-surface-50">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-8 overflow-y-auto w-full max-w-7xl mx-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
