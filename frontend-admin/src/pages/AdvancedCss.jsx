import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, RefreshCw, Eye, Code, PaintBucket, AlertTriangle } from 'lucide-react';

const AdvancedCss = () => {
    const [activeTab, setActiveTab] = useState('admin');
    const [css, setCss] = useState({ admin: '', user: '' });
    const [initialCss, setInitialCss] = useState({ admin: '', user: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Create preview style tags on mount
    useEffect(() => {
        let adminPreview = document.getElementById('live-preview-admin');
        if (!adminPreview) {
            adminPreview = document.createElement('style');
            adminPreview.id = 'live-preview-admin';
            document.head.appendChild(adminPreview);
        }

        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                const fetched = {
                    admin: res.data.ADMIN_CUSTOM_CSS || '',
                    user: res.data.USER_CUSTOM_CSS || ''
                };
                setCss(fetched);
                setInitialCss(fetched);
            } catch (err) {
                console.error("Failed to fetch CSS settings");
            }
        };
        fetchSettings();

        return () => {
            // Clean up preview on unmount
            const style = document.getElementById('live-preview-admin');
            if (style) style.remove();
        };
    }, []);

    const handleChange = (e) => {
        setCss({ ...css, [activeTab]: e.target.value });
    };

    const handleLivePreview = () => {
        if (activeTab === 'admin') {
            const previewTag = document.getElementById('live-preview-admin');
            if (previewTag) {
                previewTag.innerHTML = css.admin;
                setMessage({ type: 'success', text: 'Live Preview Applied! If it breaks the UI, just refresh the page.' });
                setTimeout(() => setMessage({ type: '', text: '' }), 5000);
            }
        } else {
            // For User CSS, saving temporarily to localStorage or just advising
            setMessage({ type: 'success', text: 'Live Preview for User CSS must be seen on the User Panel. Please Save and test.' });
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                adminCustomCss: css.admin,
                userCustomCss: css.user
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setInitialCss(css);

            // Force reload the external links
            const adminLink = document.getElementById('dynamic-admin-css');
            if (adminLink) adminLink.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/css/admin.css?t=${Date.now()}`;

            // Clear temporary preview cache
            const previewTag = document.getElementById('live-preview-admin');
            if (previewTag) previewTag.innerHTML = '';

            setMessage({ type: 'success', text: 'Custom CSS Saved and Deployed Successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save CSS.' });
        }
        setLoading(false);
    };

    const handleReset = async () => {
        if (!window.confirm("Are you sure you want to revert to the default theme? This will erase your custom CSS.")) return;

        setLoading(true);
        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                adminCustomCss: '',
                userCustomCss: ''
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });

            setCss({ admin: '', user: '' });
            setInitialCss({ admin: '', user: '' });

            // Clear injected previews and refetch
            const previewTag = document.getElementById('live-preview-admin');
            if (previewTag) previewTag.innerHTML = '';

            const adminLink = document.getElementById('dynamic-admin-css');
            if (adminLink) adminLink.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/css/admin.css?t=${Date.now()}`;

            setMessage({ type: 'success', text: 'CSS Reset to Default Configuration.' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to reset CSS.' });
        }
        setLoading(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <PaintBucket className="text-indigo-600" /> Advanced CSS Editor
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Deeply customize the aesthetics of the User and Admin panels.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition border border-red-200"
                    >
                        <RefreshCw size={18} /> Reset to Default
                    </button>
                    <button
                        onClick={handleLivePreview}
                        className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition border border-blue-200"
                    >
                        <Eye size={18} /> Live Preview
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                    >
                        <Save size={18} /> {loading ? 'Saving...' : 'Deploy CSS'}
                    </button>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg font-medium border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
                <div className="flex border-b border-gray-200 bg-gray-50">
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`flex-1 py-4 text-center font-semibold transition flex items-center justify-center gap-2 ${activeTab === 'admin' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Code size={18} /> Admin Panel CSS
                    </button>
                    <button
                        onClick={() => setActiveTab('user')}
                        className={`flex-1 py-4 text-center font-semibold transition flex items-center justify-center gap-2 ${activeTab === 'user' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Code size={18} /> User Panel CSS
                    </button>
                </div>
                <div className="flex-1 p-0 relative">
                    <textarea
                        value={css[activeTab]}
                        onChange={handleChange}
                        spellCheck="false"
                        className="w-full h-full min-h-[500px] p-6 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-none"
                        placeholder={`/* Write your custom ${activeTab === 'admin' ? 'Admin' : 'User'} CSS here. \n * Example: \n * body { background-color: #000; color: #fff; } \n * .sidebar { display: none; } \n */`}
                    ></textarea>
                </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex gap-3 shadow-sm mt-4">
                <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-600" />
                <div>
                    <strong className="block mb-1 font-semibold text-yellow-900">Warning</strong>
                    Improper CSS can break the UI layouts. Always use <strong>Live Preview</strong> Before Deploying.
                    If the Admin panel breaks completely, you can quickly reset it by navigating blindly to this page and clicking <strong>Reset to Default</strong>, or by clearing the <code>SystemSetting</code> table directly in your database.
                </div>
            </div>
        </div>
    );
};

export default AdvancedCss;
