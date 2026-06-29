import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Send, Activity } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useSocket } from '../context/SocketContext';

const MobileBottomNav = ({ user }) => {
    const { unreadCount } = useSocket();
    
    let navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Chat', path: '/chat', icon: MessageSquareText },
        { name: 'Campaigns', path: '/campaigns', icon: Send },
        { name: 'Templates', path: '/templates', icon: Activity },
    ];

    navItems = navItems.filter(item => {
        if (!user || user.role !== 'STAFF') return true;
        if (item.name === 'Dashboard') return true;
        const permMap = {
            'Chat': 'MANAGE_CHAT',
            'Campaigns': 'MANAGE_CAMPAIGNS',
            'Templates': 'MANAGE_TEMPLATES'
        };
        if (permMap[item.name]) {
            return user.permissions?.includes(permMap[item.name]);
        }
        return true;
    });

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-900 border-t border-surface-800 pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        className={({ isActive }) =>
                            twMerge(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 relative",
                                isActive
                                    ? "text-brand-400"
                                    : "text-surface-400 hover:text-surface-200"
                            )
                        }
                    >
                        <div className="relative">
                            <item.icon size={24} />
                            {item.path === '/chat' && unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-surface-900 animate-pulse" />
                            )}
                        </div>
                        <span className="text-[10px] font-medium">{item.name}</span>
                    </NavLink>
                ))}
            </div>
        </div>
    );
};

export default MobileBottomNav;
