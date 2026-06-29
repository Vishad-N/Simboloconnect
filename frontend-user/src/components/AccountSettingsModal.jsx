import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Upload, User, Mail, Lock } from 'lucide-react';

const AccountSettingsModal = ({ isOpen, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        logo: '' // base64
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [previewLogo, setPreviewLogo] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchAccountDetails();
        }
    }, [isOpen]);

    const fetchAccountDetails = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/account`);
            const data = res.data;
            setFormData({
                name: data.name || '',
                email: data.email || '',
                password: '', // Never populate existing password
                logo: data.logo || ''
            });
            setPreviewLogo(data.logo || '');
        } catch (error) {
            console.error("Failed to fetch account details", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        // 2MB limit
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, logo: reader.result }));
            setPreviewLogo(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                logo: formData.logo
            };

            // Only send password if it was modified
            if (formData.password) {
                payload.password = formData.password;
            }

            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/account/update`, payload);
            alert("Account settings updated!");

            // Notify parent to update header
            if (onUpdate) {
                onUpdate(res.data.user);
            }
            onClose();
        } catch (error) {
            console.error("Failed to update account", error);
            alert("Error updating account: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-surface-800">
                    <h2 className="text-xl font-bold text-white">Account Settings</h2>
                    <button onClick={onClose} className="text-surface-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="text-center py-8 text-surface-400">Loading details...</div>
                    ) : (
                        <form id="accountForm" onSubmit={handleSubmit} className="space-y-6">

                            {/* Logo Upload */}
                            <div className="flex flex-col items-center">
                                <div className="relative group cursor-pointer mb-2">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-800 border-2 border-surface-700 flex items-center justify-center">
                                        {previewLogo ? (
                                            <img src={previewLogo} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-white0">
                                                {formData.name ? formData.name.charAt(0).toUpperCase() : 'TA'}
                                            </span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Upload size={20} className="text-white mb-1" />
                                        <span className="text-[10px] text-white font-medium">Change</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                    </label>
                                </div>
                                <p className="text-xs text-white0">Square image, max 2MB</p>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-surface-400 mb-1 ml-1 flex items-center gap-1">
                                        <User size={14} /> Full Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-surface-400 mb-1 ml-1 flex items-center gap-1">
                                        <Mail size={14} /> Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-surface-400 mb-1 ml-1 flex items-center gap-1">
                                        <Lock size={14} /> New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-surface-800 border-none rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-brand-500"
                                        placeholder="Leave blank to keep current"
                                        minLength={6}
                                    />
                                </div>
                            </div>

                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-surface-800 flex justify-end gap-3 bg-surface-800/20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        form="accountForm"
                        type="submit"
                        disabled={isLoading || isSaving}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AccountSettingsModal;
