import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, Lock, Mail } from 'lucide-react';

const Profile = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setEmail(localStorage.getItem('adminEmail') || '');
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        if (password && password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/profile`, {
                email: email,
                password: password || undefined
            }, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });

            localStorage.setItem('adminEmail', email);
            setMessage('Profile updated successfully.');
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4">Superadmin Profile</h2>
            
            <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                {message && <div className="p-3 bg-green-50 text-green-700 rounded-lg">{message}</div>}
                {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
                
                <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Email Address</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-surface-400" />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field pl-10"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">New Password (leave blank to keep current)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-surface-400" />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field pl-10"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                        <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Profile;
