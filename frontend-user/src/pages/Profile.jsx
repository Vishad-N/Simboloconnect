import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Save, MapPin, Briefcase, Globe, Mail, AlignLeft, Smartphone } from 'lucide-react';

const Profile = () => {
    const [profile, setProfile] = useState({
        about: '',
        address: '',
        description: '',
        email: '',
        websites: [''],
        vertical: '',
        profilePicture: '',
        registeredPhone: '',
        verifiedName: ''
    });
    const [originalProfile, setOriginalProfile] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/profile`);
            const data = res.data || {};
            const initialProfile = {
                about: data.about || '',
                address: data.address || '',
                description: data.description || '',
                email: data.email || '',
                websites: data.websites && data.websites.length > 0 ? data.websites : [''],
                vertical: data.vertical || '',
                profilePicture: data.profilePicture || '',
                registeredPhone: data.registeredPhone || '',
                verifiedName: data.verifiedName || ''
            };
            setProfile(initialProfile);
            setOriginalProfile(initialProfile);
        } catch (error) {
            console.error("Failed to fetch profile", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Filter out empty websites
            const cleanedProfile = {
                ...profile,
                websites: profile.websites.filter(w => w.trim() !== '')
            };

            await axios.post(`${import.meta.env.VITE_API_URL}/api/profile`, cleanedProfile);
            alert("WhatsApp Business Profile updated successfully!");
            setOriginalProfile(profile);
        } catch (error) {
            console.error("Failed to update profile", error);
            alert("Error updating profile. Check settings or console.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleWebsiteChange = (index, value) => {
        const newWebsites = [...profile.websites];
        newWebsites[index] = value;
        setProfile(prev => ({ ...prev, websites: newWebsites }));
    };

    const addWebsite = () => {
        if (profile.websites.length < 2) { // Meta usually allows max 2 websites for WhatsApp Business
            setProfile(prev => ({ ...prev, websites: [...prev.websites, ''] }));
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit Meta Profile
            alert('Error: Image must be less than 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfile(prev => ({ ...prev, profilePicture: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    if (isLoading) {
        return <div className="p-12 text-center text-surface-400">Loading Profile Data...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-white mb-2 flex items-center gap-3">
                    <User className="text-brand-400" /> WhatsApp Business Profile
                </h1>
                <p className="text-surface-400">Manage how your business appears to customers on WhatsApp.</p>
            </header>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <div className="text-blue-400 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-blue-100 mb-1">Important Note About Meta Sync</h4>
                    <p className="text-xs text-blue-200/80 leading-relaxed">
                        Data entered in your Meta Business Manager does <strong>not</strong> automatically sync to the Cloud API. Because your API connection is fresh, this profile may appear blank. Please fill out your details here and click <span className="font-semibold text-white">Save Profile</span> to apply them to your WhatsApp number.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="glass-panel p-8 space-y-8 rounded-2xl border border-surface-700">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-surface-700 pb-2">Basic Info</h3>

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-2">WhatsApp Profile Image (Max 5MB)</label>
                            <div className="flex items-center space-x-4">
                                {profile.profilePicture ? (
                                    <img src={profile.profilePicture.startsWith('data:') || profile.profilePicture.startsWith('http') ? profile.profilePicture : `${import.meta.env.VITE_API_URL}${profile.profilePicture}`} alt="Logo Preview" className="h-16 w-16 object-cover rounded-full border border-surface-700 bg-surface-800" />
                                ) : (
                                    <div className="h-16 w-16 rounded-full border border-dashed border-surface-600 flex items-center justify-center text-xs text-white0">NO IMAGE</div>
                                )}
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={handleImageUpload}
                                    className="block w-full text-sm text-surface-400
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-xl file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-brand-500/20 file:text-brand-400
                                        hover:file:bg-brand-500/30 transition-colors"
                                />
                            </div>
                            <p className="text-xs text-white0 mt-2">Recommended size: 640x640px. Must be exactly square for best results.</p>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <AlignLeft size={16} className="text-white0" /> About (Status)
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Hey there! I am using WhatsApp."
                                value={profile.about}
                                maxLength={139}
                                onChange={(e) => handleChange('about', e.target.value)}
                            />
                            <p className="text-xs text-white0 mt-1 text-right">{profile.about.length}/139</p>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <Briefcase size={16} className="text-white0" /> Description
                            </label>
                            <textarea
                                className="input-field h-24 resize-none"
                                placeholder="Describe your business..."
                                value={profile.description}
                                maxLength={256}
                                onChange={(e) => handleChange('description', e.target.value)}
                            />
                            <p className="text-xs text-white0 mt-1 text-right">{profile.description.length}/256</p>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <Briefcase size={16} className="text-white0" /> Industry / Vertical
                            </label>
                            <select
                                className="input-field"
                                value={profile.vertical}
                                onChange={(e) => handleChange('vertical', e.target.value)}
                            >
                                <option value="">Select Industry...</option>
                                <option value="APPAREL">Apparel</option>
                                <option value="BEAUTY">Beauty</option>
                                <option value="EDU">Education</option>
                                <option value="HEALTH">Health</option>
                                <option value="PROF_SERVICES">IT / Professional Services</option>
                                <option value="RETAIL">Retail</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-surface-700 pb-2">Contact Info</h3>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <MapPin size={16} className="text-white0" /> Business Address
                            </label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="123 Main St, City, Country"
                                value={profile.address}
                                maxLength={256}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <Mail size={16} className="text-white0" /> Email Address
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="contact@business.com"
                                value={profile.email}
                                maxLength={128}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <Smartphone size={16} className="text-white0" /> Registered WhatsApp Number
                            </label>
                            <input
                                type="text"
                                className="input-field bg-surface-800/50 cursor-not-allowed opacity-80"
                                value={profile.registeredPhone || 'Not Connected'}
                                readOnly
                                disabled
                            />
                            <p className="text-xs text-white0 mt-1">This is your official WhatsApp number connected to Meta Cloud API.</p>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-2">
                                <Globe size={16} className="text-white0" /> Websites (Max 2)
                            </label>
                            {profile.websites.map((web, idx) => (
                                <input
                                    key={idx}
                                    type="url"
                                    className="input-field mb-2"
                                    placeholder="https://www.example.com"
                                    value={web}
                                    onChange={(e) => handleWebsiteChange(idx, e.target.value)}
                                />
                            ))}
                            {profile.websites.length < 2 && (
                                <button type="button" onClick={addWebsite} className="text-xs text-brand-400 mt-1 hover:text-brand-300">
                                    + Add another website
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-surface-700 flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={fetchProfile}
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl border border-surface-600 text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                        Reset Changes
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || JSON.stringify(profile) === JSON.stringify(originalProfile)}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {isSaving ? 'Syncing to Meta...' : 'Save Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Profile;
