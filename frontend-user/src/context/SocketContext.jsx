import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const location = useLocation();

    // Use a ref to keep track of the current location inside the socket callback
    const locationRef = React.useRef(location);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        // Only connect if we have a user/tenant ID (simplified check)
        const tenantId = localStorage.getItem('tenantId') || 'test-user-id';
        if (!tenantId) return;

        const newSocket = io(import.meta.env.VITE_API_URL);

        newSocket.on('connect', () => {
            console.log('Global Socket Connected');
            newSocket.emit('join_tenant', tenantId);
        });

        newSocket.on('new_message', (log) => {
            if (log.direction === 'INBOUND') {
                // Check current location via ref to get the latest value inside callback
                if (locationRef.current.pathname !== '/chat') {
                    // Play sound only if NOT on chat page
                    const audio = new window.Audio('/sounds/notification.mp3');
                    audio.volume = 0.5;
                    audio.play().catch(e => console.error("Audio playback failed:", e));
                    
                    setUnreadCount(prev => prev + 1);
                }
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []); // Only run once on mount

    // Reset unread count when visiting chat
    useEffect(() => {
        if (location.pathname === '/chat') {
            setUnreadCount(0);
        }
    }, [location.pathname]);

    return (
        <SocketContext.Provider value={{ socket, unreadCount }}>
            {children}
        </SocketContext.Provider>
    );
};
