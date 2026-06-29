import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState({ name: '', logoUrl: null });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                // Fetch public branding from backend
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/branding`);
                setBranding({
                    name: res.data.name ? `${res.data.name} Admin` : '', // Removed hardcoded 'Platform Admin'
                    logoUrl: res.data.logoUrl
                });
                if (res.data.name) {
                    document.title = `${res.data.name} Admin Portal`;
                    localStorage.setItem('cached_admin_branding_name', `${res.data.name} Admin Portal`);
                }

                // Set Favicon dynamically
                const faviconUrl = res.data.faviconUrl;
                if (faviconUrl) {
                    localStorage.setItem('cached_admin_branding_favicon', faviconUrl);
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

    return (
        <BrandingContext.Provider value={{ branding, loading }}>
            {children}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => useContext(BrandingContext);
