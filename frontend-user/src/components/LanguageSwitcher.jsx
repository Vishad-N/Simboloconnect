import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

const LanguageSwitcher = ({ className, position = 'down' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentLang, setCurrentLang] = useState('en');

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'हिंदी' },
        { code: 'ar', name: 'العربية' }
    ];

    useEffect(() => {
        // Parse current initialized translation state
        const match = document.cookie.match(new RegExp('(^| )googtrans=([^;]+)'));
        if (match) {
            const val = match[2];
            if (val.includes('/hi')) setCurrentLang('hi');
            else if (val.includes('/ar')) setCurrentLang('ar');
            else setCurrentLang('en');
        }
    }, []);

    const setLanguage = (langCode) => {
        // 1. Find the native hidden Google Translate dropdown
        const selectElement = document.querySelector('.goog-te-combo');
        
        if (selectElement) {
            // For English (base language), Google Translate's select often expects 'en' or an empty string to restore
            selectElement.value = langCode;
            selectElement.dispatchEvent(new Event('change'));
            
            // Wait a tiny bit and if it fails to revert (value rejection), try empty string for base language
            setTimeout(() => {
                if (langCode === 'en' && selectElement.value !== 'en') {
                    selectElement.value = '';
                    selectElement.dispatchEvent(new Event('change'));
                }
            }, 100);
            
            setCurrentLang(langCode);
            setIsOpen(false);
        } else {
            // Fallback if widget not loaded yet
            const domain = window.location.hostname;
            const transVal = langCode === 'en' ? '/auto/en' : `/en/${langCode}`;
            document.cookie = `googtrans=${transVal}; path=/`;
            document.cookie = `googtrans=${transVal}; domain=${domain}; path=/`;
            document.cookie = `googtrans=${transVal}; domain=.${domain}; path=/`;
            setCurrentLang(langCode);
            setIsOpen(false);
            window.location.reload();
        }
    };

    return (
        <div className={twMerge("relative", className)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/80 hover:bg-surface-700 border border-surface-700 text-surface-200 transition-colors cursor-pointer outline-none select-none"
            >
                <Globe size={16} className="text-brand-400" />
                <span className="text-sm font-medium">
                    {languages.find(l => l.code === currentLang)?.name || 'Language'}
                </span>
                <ChevronDown size={14} className="text-surface-400 ml-1" />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-[90]" 
                        onClick={() => setIsOpen(false)}
                    ></div>
                    <div className={clsx(
                        "absolute right-0 w-32 bg-surface-800 border border-surface-700 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-[100] py-1",
                        position === 'up' ? "bottom-full mb-2" : "top-full mt-2"
                    )}>
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => setLanguage(lang.code)}
                                className={clsx(
                                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                                    currentLang === lang.code 
                                        ? "bg-brand-500/10 text-brand-400 font-semibold"
                                        : "text-surface-300 hover:bg-surface-700 hover:text-white"
                                )}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default LanguageSwitcher;
