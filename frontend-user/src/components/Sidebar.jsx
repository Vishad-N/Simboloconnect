import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Send, Users, Activity, Settings, MessageSquareText, Webhook,
  User, Network, Bot, Package, GitBranch, MessageCircleQuestion, ShoppingCart,
  ShoppingBag, Box, Plug, ChevronDown, Store, BarChart2, RotateCcw, Zap, FileText, ShieldAlert, Phone, Code
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useBranding } from '../context/BrandingContext';
import { useSocket } from '../context/SocketContext';
import LanguageSwitcher from './LanguageSwitcher';

const Sidebar = ({ user }) => {
    const { branding, loading: brandingLoading } = useBranding();
    const { unreadCount } = useSocket();
    const location = useLocation();

    const isEcomActive = location.pathname.startsWith('/ecommerce');
    const isIntegrationsActive = location.pathname.startsWith('/integrations');
    const isVoiceActive = location.pathname.startsWith('/ai-voice');
    const [ecomOpen, setEcomOpen] = useState(isEcomActive);
    const [integrationsOpen, setIntegrationsOpen] = useState(isIntegrationsActive);
    const [voiceOpen, setVoiceOpen] = useState(isVoiceActive);

    React.useEffect(() => {
        setEcomOpen(location.pathname.startsWith('/ecommerce'));
        setIntegrationsOpen(location.pathname.startsWith('/integrations'));
        setVoiceOpen(location.pathname.startsWith('/ai-voice'));
    }, [location.pathname]);

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Live Chat', path: '/chat', icon: MessageSquareText },
        { name: 'Campaigns', path: '/campaigns', icon: Send },
        { name: 'Templates', path: '/templates', icon: Activity },
        { name: 'Contacts', path: '/contacts', icon: Users },
        { name: 'Webhook', path: '/webhook', icon: Webhook },
        { name: 'Flow Builder', path: '/chatbot/visual-flows', icon: GitBranch },
        { name: 'QnA', path: '/chatbot/flows', icon: MessageCircleQuestion },
        { name: 'AI Brain', path: '/ai-brain', icon: Bot },
    ];

    const ecomSubItems = [
        { name: 'Overview',        path: '/ecommerce/overview',   icon: LayoutDashboard },
        { name: 'Stores',          path: '/ecommerce/stores',     icon: Store },
        { name: 'Orders',          path: '/ecommerce/orders',     icon: ShoppingCart },
        { name: 'Customers',       path: '/ecommerce/customers',  icon: Users },
        { name: 'Products',        path: '/ecommerce/products',   icon: Package },
        { name: 'Abandoned Carts', path: '/ecommerce/abandoned-carts', icon: RotateCcw },
        { name: 'Campaigns',       path: '/ecommerce/campaigns',  icon: Send },
        { name: 'Automations',     path: '/ecommerce/automations',icon: Zap },
        { name: 'Templates',       path: '/ecommerce/templates',  icon: FileText },
        { name: 'Analytics',       path: '/ecommerce/analytics',  icon: BarChart2 },
    ];

    const voiceSubItems = [
        { name: 'Providers', path: '/ai-voice/providers', icon: Network },
        { name: 'Agents',    path: '/ai-voice/agents',    icon: User },
        { name: 'Campaigns', path: '/ai-voice/campaigns', icon: Send },
        { name: 'Reports',   path: '/ai-voice/reports',   icon: BarChart2 },
        { name: 'Developer Hub', path: '/ai-voice/developer-hub', icon: Code },
    ];

    const bottomNavItems = [
        { name: 'Team', path: '/team', icon: Users },
        { name: 'Plans', path: '/plans', icon: Package },
        { name: 'Profile', path: '/profile', icon: User },
    ];

    const integrationsSubItems = [
        { name: 'Store Payments', path: '/settings?tab=payments', icon: ShoppingCart },
        { name: 'API Access & Webhook', path: '/integrations/api-webhook', icon: Webhook },
        { name: 'Sheets Integration', path: '/integrations/sheets', icon: Plug },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (!user || user.role !== 'STAFF') return true;
        if (item.name === 'Dashboard' || item.name === 'Profile') return true;
        if (item.name === 'Plans' || item.name === 'Team') return false;
        const permMap = {
            'Live Chat': 'MANAGE_CHAT',
            'Campaigns': 'MANAGE_CAMPAIGNS',
            'Templates': 'MANAGE_TEMPLATES',
            'Contacts': 'MANAGE_CONTACTS',
            'Webhook': 'MANAGE_API',
            'Flow Builder': 'MANAGE_CHATBOT',
            'AI Brain': 'MANAGE_CHATBOT'
        };
        if (permMap[item.name]) {
            return user.permissions?.includes(permMap[item.name]);
        }
        return true;
    });

    const filteredBottomNavItems = bottomNavItems.filter(item => {
        if (!user) return true;
        
        if (user.role !== 'STAFF') return true;
        if (item.name === 'Plans' || item.name === 'Team') return false;
        if (item.name === 'Profile') return true;
        return true;
    });

    const renderNavLink = (item) => (
        <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/dashboard' || item.path === '/'}
            className={({ isActive }) =>
                twMerge(
                    "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group relative",
                    isActive
                        ? "bg-brand-500/10 text-brand-400 font-semibold shadow-[inset_3px_0_0_#00d9a5]"
                        : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                )
            }
        >
            <item.icon size={18} className="transition-transform group-hover:scale-110" />
            {item.name}
            {item.path === '/chat' && unreadCount > 0 && (
                <span className="absolute right-4 w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
            )}
        </NavLink>
    );

    return (
        <aside className="hidden md:flex w-[220px] h-screen bg-black flex-col fixed left-0 top-0 shadow-[4px_0_24px_rgba(0,0,0,0.9)] z-50" style={{borderRight:'1px solid rgba(255,255,255,0.05)'}}>
            <div className="p-6 flex items-center justify-center border-b border-white/5">
                {brandingLoading ? null : branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="h-10 w-auto max-w-[200px] object-contain" />
                ) : (
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-white drop-shadow-[0_0_10px_rgba(0,217,165,0.3)]">
                        {branding.name || 'Workspace'}
                    </span>
                )}
            </div>

            <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
                {filteredNavItems.map(renderNavLink)}

                {/* E-commerce Collapsible Menu */}
                {(!user || user.role !== 'STAFF') && (
                    <div>
                        <button
                            onClick={() => setEcomOpen(!ecomOpen)}
                            className={twMerge(
                                "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group",
                                isEcomActive
                                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <ShoppingCart size={18} className="transition-transform group-hover:scale-110" />
                                Ecommerce
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${ecomOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Submenu */}
                        <div className={`overflow-hidden transition-all duration-300 ${ecomOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="pl-3 mt-1 space-y-0.5 border-l-2 border-surface-700 ml-5">
                                {ecomSubItems.map(sub => (
                                    <NavLink
                                        key={sub.name}
                                        to={sub.path}
                                        className={({ isActive }) =>
                                            twMerge(
                                                "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "text-brand-400 font-semibold bg-brand-500/8"
                                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                                            )
                                        }
                                    >
                                        <sub.icon size={14} />
                                        {sub.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Integrations Collapsible Menu */}
                {(!user || user.role !== 'STAFF') && (
                    <div>
                        <button
                            onClick={() => setIntegrationsOpen(!integrationsOpen)}
                            className={twMerge(
                                "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group",
                                isIntegrationsActive
                                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <Plug size={18} className="transition-transform group-hover:scale-110" />
                                Integrations
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${integrationsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Submenu */}
                        <div className={`overflow-hidden transition-all duration-300 ${integrationsOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="pl-3 mt-1 space-y-0.5 border-l-2 border-surface-700 ml-5">
                                {integrationsSubItems.map(sub => (
                                    <NavLink
                                        key={sub.name}
                                        to={sub.path}
                                        className={({ isActive }) =>
                                            twMerge(
                                                "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "text-brand-400 font-semibold bg-brand-500/8"
                                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                                            )
                                        }
                                    >
                                        <sub.icon size={14} />
                                        {sub.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Voice Collapsible Menu */}
                {(!user || user.role !== 'STAFF') && (
                    <div>
                        <button
                            onClick={() => setVoiceOpen(!voiceOpen)}
                            className={twMerge(
                                "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group",
                                isVoiceActive
                                    ? "bg-brand-500/10 text-brand-400 font-semibold"
                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <Phone size={18} className="transition-transform group-hover:scale-110" />
                                AI Voice
                            </span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${voiceOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Submenu */}
                        <div className={`overflow-hidden transition-all duration-300 ${voiceOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="pl-3 mt-1 space-y-0.5 border-l-2 border-surface-700 ml-5">
                                {voiceSubItems.map(sub => (
                                    <NavLink
                                        key={sub.name}
                                        to={sub.path}
                                        className={({ isActive }) =>
                                            twMerge(
                                                "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-200",
                                                isActive
                                                    ? "text-brand-400 font-semibold bg-brand-500/8"
                                                    : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                                            )
                                        }
                                    >
                                        <sub.icon size={14} />
                                        {sub.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {filteredBottomNavItems.map(renderNavLink)}
            </div>

            <div className="p-4 border-t border-white/5 flex flex-col gap-2">
                {branding?.supportPhoneNumber && (
                    <a
                        href={`https://wa.me/${branding.supportPhoneNumber.replace(/[^0-9]/g, '')}?text=Hi%2C%20I%20need%20help%20with%20my%20account`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group bg-brand-500/5 text-brand-500 font-medium hover:bg-brand-500 hover:text-[#050505]"
                    >
                        <MessageSquareText size={18} className="transition-transform group-hover:scale-110" />
                        <span className="font-semibold">Need Help?</span>
                    </a>
                )}
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        twMerge(
                            "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 group",
                            isActive
                                ? "bg-brand-500/10 text-brand-400 font-semibold shadow-[inset_3px_0_0_#00d9a5]"
                                : "text-surface-400 hover:bg-surface-800 hover:text-surface-50"
                        )
                    }
                >
                    <Settings size={18} className="transition-transform group-hover:rotate-45" />
                    Settings
                </NavLink>
                <div className="pt-2 border-t border-white/5 mt-2">
                    <LanguageSwitcher position="up" className="w-full [&>button]:w-full [&>button]:justify-between" />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
