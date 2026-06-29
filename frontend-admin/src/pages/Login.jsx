import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Activity, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';

const Login = () => {
    const { branding, loading: brandingLoading } = useBranding();
    const [step, setStep] = useState('LOGIN'); // 'LOGIN' | 'FORGOT' | 'OTP'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otpValues, setOtpValues] = useState({});
    const [newPassword, setNewPassword] = useState('');
    const [savedEmail, setSavedEmail] = useState('');
    const [requiredChannels, setRequiredChannels] = useState([]);
    const [pendingChannels, setPendingChannels] = useState([]);
    const [loadingMap, setLoadingMap] = useState({});
    const [resendMsg, setResendMsg] = useState({});
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/account/login`, {
                email,
                password
            });

            if (res.data.user.role !== 'SUPERADMIN' && res.data.user.role !== 'ADMIN_STAFF' && res.data.user.role !== 'ADMIN') {
                setError('Access denied. Admin portal privileges required.');
                setLoading(false);
                return;
            }

            localStorage.setItem('adminToken', res.data.user.id); // Or real JWT if using one
            localStorage.setItem('adminEmail', res.data.user.email);
            localStorage.setItem('adminRole', res.data.user.role);
            localStorage.setItem('adminPermissions', JSON.stringify(res.data.user.permissions || []));
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/forgot-password`, { email });
            setSuccessMsg(res.data.message);
            setSavedEmail(email);
            setRequiredChannels(res.data.requiredChannels || ['EMAIL']);
            setPendingChannels(res.data.pendingChannels || res.data.requiredChannels || ['EMAIL']);
            setStep('OTP');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to request password reset.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (channel, e) => {
        if (e) e.preventDefault();
        const otpCode = otpValues[channel];
        if (!newPassword || newPassword.length < 6) {
            setError('Please enter a valid new password (min 6 characters) before verifying.');
            return;
        }
        if (!otpCode || otpCode.length !== 6) return;

        setLoadingMap({ ...loadingMap, [channel]: true });
        setError('');
        setSuccessMsg('');

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/reset-password`, {
                email: savedEmail,
                otp: otpCode,
                newPassword,
                channel
            });

            if (res.data.requiresMoreVerification) {
                setPendingChannels(res.data.pendingChannels || []);
                setRequiredChannels(res.data.requiredChannels || requiredChannels);
                setSuccessMsg(res.data.message);
                setError('');
                return;
            }

            setSuccessMsg(res.data.message);
            setStep('LOGIN');
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.error || `Failed to verify ${channel} or reset password.`);
        } finally {
            setLoadingMap({ ...loadingMap, [channel]: false });
        }
    };

    const handleResendOtp = async (channel) => {
        setLoadingMap({ ...loadingMap, [`${channel}_RESEND`]: true });
        setError('');
        setResendMsg({ ...resendMsg, [channel]: '' });

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/resend-otp`, {
                email: savedEmail,
                channel,
                context: 'FORGOT_PASSWORD'
            });
            setResendMsg({ ...resendMsg, [channel]: res.data.message });
        } catch (err) {
            setError(err.response?.data?.error || `Failed to resend ${channel} OTP.`);
        } finally {
            setLoadingMap({ ...loadingMap, [`${channel}_RESEND`]: false });
        }
    };

    if (step === 'FORGOT') {
        return (
            <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full glass-card p-8">
                    <div className="flex justify-center mb-6 h-16">
                        {brandingLoading ? null : branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                        ) : (
                            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center border border-surface-200">
                                <Activity className="w-8 h-8 text-brand-600" />
                            </div>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-center text-surface-900 mb-2">Reset Password</h2>
                    <p className="text-center text-surface-500 mb-8">Enter your admin email to receive a recovery code</p>

                    {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6 border border-red-100 text-center">{error}</div>}

                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-surface-400" />
                                </div>
                                <input type="email" required className="input-field pl-10" placeholder="admin@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                        </div>
                        <button type="submit" disabled={loading || !email} className="w-full btn-primary flex justify-center py-2.5 mt-2 disabled:opacity-50">
                            {loading ? 'Sending...' : 'Send Recovery Code'}
                        </button>
                    </form>
                    <div className="mt-6 text-center border-t border-surface-200 pt-6">
                        <button onClick={() => setStep('LOGIN')} className="text-sm font-medium text-brand-600 hover:text-brand-500">Return to sign in</button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'OTP') {
        return (
            <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full glass-card p-8">
                    <div className="flex justify-center mb-6 h-16">
                        {brandingLoading ? null : branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                        ) : (
                            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center border border-surface-200">
                                <Activity className="w-8 h-8 text-brand-600" />
                            </div>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-center text-surface-900 mb-2">Recovery Steps</h2>
                    <p className="text-center text-surface-500 mb-8">
                        Verify your identity to set a new password.
                        {requiredChannels.length > 0 && <span className="block mt-1 font-medium text-brand-600">({requiredChannels.length} verification steps required)</span>}
                    </p>

                    {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6 border border-red-100 text-center">{error}</div>}
                    {successMsg && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-6 border border-green-200 text-center">{successMsg}</div>}

                    <div className="mb-8 p-4 bg-surface-50 border border-surface-300 rounded-lg">
                        <label className="block text-sm font-bold text-surface-900 mb-2">Create New Password First</label>
                        <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-surface-400" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="input-field pl-10 pr-10"
                                placeholder="Enter your new password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 focus:outline-none"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-surface-500 mt-2">This password will be applied once all OTPs below are verified.</p>
                    </div>

                    <div className="space-y-6">
                        {requiredChannels.map((channel) => {
                            const isPending = pendingChannels.includes(channel);
                            const isChannelLoading = loadingMap[channel];
                            const isResendLoading = loadingMap[`${channel}_RESEND`];
                            const currentOtp = otpValues[channel] || '';

                            return (
                                <div key={channel} className={`p-4 rounded-lg border ${isPending ? 'border-surface-300 bg-white' : 'border-green-300 bg-green-50'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-bold text-surface-700">
                                            {channel} Verification
                                        </label>
                                        {!isPending && (
                                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200">
                                                ✓ Verified
                                            </span>
                                        )}
                                    </div>

                                    {isPending ? (
                                        <>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={6}
                                                    value={currentOtp}
                                                    onChange={e => setOtpValues({ ...otpValues, [channel]: e.target.value.replace(/[^0-9]/g, '') })}
                                                    className="input-field text-center text-xl tracking-[0.3em] font-mono"
                                                    placeholder="000000"
                                                />
                                                <button
                                                    onClick={(e) => handleResetPassword(channel, e)}
                                                    disabled={isChannelLoading || currentOtp.length !== 6 || newPassword.length < 6}
                                                    className="flex-shrink-0 flex justify-center items-center px-4 btn-primary disabled:opacity-50 text-sm"
                                                >
                                                    {isChannelLoading ? '...' : `Verify`}
                                                </button>
                                            </div>
                                            <div className="mt-3 flex justify-between items-center">
                                                <button
                                                    onClick={() => handleResendOtp(channel)}
                                                    disabled={isResendLoading}
                                                    className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {isResendLoading ? 'Sending...' : `Resend ${channel} Code`}
                                                </button>
                                                {resendMsg[channel] && <span className="text-xs text-green-600 mr-2">{resendMsg[channel]}</span>}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-surface-500">This channel has been successfully verified.</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6 text-center border-t border-surface-200 pt-6">
                        <button onClick={() => setStep('LOGIN')} className="text-sm font-medium text-brand-600 hover:text-brand-500">Return to sign in</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-card p-8">
                <div className="flex justify-center mb-6 h-16">
                    {brandingLoading ? null : branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                    ) : (
                        <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center border border-surface-200">
                            <Activity className="w-8 h-8 text-brand-600" />
                        </div>
                    )}
                </div>

                <h2 className="text-2xl font-bold text-center text-surface-900 mb-2">
                    {branding.name}
                </h2>
                <p className="text-center text-surface-500 mb-8">
                    Sign in to manage the platform
                </p>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6 border border-red-100 text-center">
                        {error}
                    </div>
                )}
                {successMsg && (
                    <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-6 border border-green-200 text-center">
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-surface-400" />
                            </div>
                            <input
                                type="email"
                                required
                                className="input-field pl-10"
                                placeholder="admin@yourdomain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-surface-700">
                                Password
                            </label>
                            <button type="button" onClick={() => { setStep('FORGOT'); setError(''); setSuccessMsg(''); setPassword(''); }} className="text-sm font-medium text-brand-600 hover:text-brand-500">
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-surface-400" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="input-field pl-10 pr-10"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 focus:outline-none"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary flex justify-center py-2.5 mt-2"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
