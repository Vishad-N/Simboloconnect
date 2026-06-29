import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const BrandingContext = createContext();

// Apply theme to <html> immediately (called on load from cache too)
const applyTheme = (theme) => {
    const validTheme = theme === 'fresh' ? 'fresh' : 'classic';
    if (validTheme === 'fresh') {
        document.documentElement.setAttribute('data-theme', 'fresh');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
};

// Apply cached theme instantly (before API response) to prevent flash
const userPref = localStorage.getItem('user_theme_preference');
const cachedTheme = userPref || localStorage.getItem('cached_frontend_theme');
if (cachedTheme) applyTheme(cachedTheme);

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState({ name: '', logoUrl: null, freshLogoUrl: null, frontendTheme: 'fresh' });
    const [userTheme, setUserTheme] = useState(() => localStorage.getItem('user_theme_preference'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/branding`);
                setBranding(res.data);
                if (res.data.name) {
                    document.title = res.data.name;
                    localStorage.setItem('cached_branding_name', res.data.name);
                }

                // Apply frontend theme: prefer user preference if it exists
                const userPref = localStorage.getItem('user_theme_preference');
                const theme = userPref || res.data.frontendTheme || 'classic';
                applyTheme(theme);
                localStorage.setItem('cached_frontend_theme', res.data.frontendTheme || 'classic');

                // Set Favicon dynamically
                const faviconUrl = res.data.faviconUrl;
                if (faviconUrl) {
                    localStorage.setItem('cached_branding_favicon', faviconUrl);
                    let link = document.querySelector("link[rel~='icon']");
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = faviconUrl;
                }
            } catch (error) {
                console.error("Failed to fetch branding data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchBranding();
    }, []);

    const setUserThemePreference = (theme) => {
        const validTheme = theme === 'fresh' ? 'fresh' : 'classic';
        setUserTheme(validTheme);
        localStorage.setItem('user_theme_preference', validTheme);
        applyTheme(validTheme);
    };

    const activeTheme = userTheme || branding.frontendTheme || 'classic';

    return (
        <BrandingContext.Provider value={{ branding, loading, activeTheme, setUserThemePreference }}>
            {loading ? (
                <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0F19' }}>
                     <div className="w-8 h-8 border-2 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                children
            )}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => useContext(BrandingContext);
