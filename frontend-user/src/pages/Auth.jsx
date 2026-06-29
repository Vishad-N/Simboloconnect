import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Activity, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const Auth = () => {
    const { branding, loading: brandingLoading } = useBranding();
    const [step, setStep] = useState('FORM'); // 'FORM' | 'OTP' | 'FORGOT_PASSWORD' | 'RESET_OTP'
    const location = useLocation();
    const [isLogin, setIsLogin] = useState(location.pathname === '/login' || location.pathname === '/auth');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (location.pathname === '/register') {
            setIsLogin(false);
            setStep('FORM');
        } else if (location.pathname === '/login') {
            setIsLogin(true);
            setStep('FORM');
        }
    }, [location.pathname]);

    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
    const [otpValues, setOtpValues] = useState({});
    const [newPassword, setNewPassword] = useState('');
    const [savedEmail, setSavedEmail] = useState('');
    const [requiredChannels, setRequiredChannels] = useState([]);
    const [pendingChannels, setPendingChannels] = useState([]);
    const [loadingMap, setLoadingMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [resendMsg, setResendMsg] = useState({});
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}${endpoint}`, formData);

            if (res.data.requiresVerification) {
                setSavedEmail(res.data.email);
                setSuccessMsg(res.data.message);
                setRequiredChannels(res.data.requiredChannels || ['EMAIL']);
                setPendingChannels(res.data.pendingChannels || res.data.requiredChannels || ['EMAIL']);
                setStep('OTP');
                return;
            }

            // Success (No verification needed, standard login)
            localStorage.setItem('userToken', res.data.token);
            // Replace old simulated token with real ID just in case existing code relies on it
            localStorage.setItem('tenantId', res.data.user.id);

            navigate('/dashboard');
            // Reload to re-initialize global socket with new ID natively
            window.location.reload();
        } catch (err) {
            if (err.response?.data?.requiresVerification) {
                setSavedEmail(err.response.data.email);
                setError('');
                setSuccessMsg(err.response.data.error || 'Please verify your identity to log in.');
                setRequiredChannels(err.response.data.requiredChannels || ['EMAIL']);
                setPendingChannels(err.response.data.pendingChannels || err.response.data.requiredChannels || ['EMAIL']);
                setStep('OTP');
                return;
            }
            setError(err.response?.data?.error || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (channel, e) => {
        if (e) e.preventDefault();
        const otpCode = otpValues[channel];
        if (!otpCode || otpCode.length !== 6) return;

        setLoadingMap({ ...loadingMap, [channel]: true });
        setError('');

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/verify-otp`, {
                email: savedEmail,
                otp: otpCode,
                channel,
                context: 'SIGNUP'
            });

            if (res.data.requiresMoreVerification) {
                setPendingChannels(res.data.pendingChannels || []);
                setRequiredChannels(res.data.requiredChannels || requiredChannels);
                setSuccessMsg(res.data.message);
                setError('');
                return;
            }

            localStorage.setItem('userToken', res.data.token);
            localStorage.setItem('tenantId', res.data.user.id);

            navigate('/dashboard');
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.error || `Verification failed for ${channel}. Invalid OTP.`);
        } finally {
            setLoadingMap({ ...loadingMap, [channel]: false });
        }
    };

    const handleResendOtp = async (channel) => {
        setLoadingMap({ ...loadingMap, [`${channel}_RESEND`]: true });
        setError('');
        setResendMsg({ ...resendMsg, [channel]: '' });

        try {
            const context = step === 'RESET_OTP' ? 'FORGOT_PASSWORD' : 'SIGNUP';
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/resend-otp`, {
                email: savedEmail,
                channel,
                context
            });
            setResendMsg({ ...resendMsg, [channel]: res.data.message });
        } catch (err) {
            setError(err.response?.data?.error || `Failed to resend ${channel} OTP.`);
        } finally {
            setLoadingMap({ ...loadingMap, [`${channel}_RESEND`]: false });
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/forgot-password`, { email: formData.email });
            setSuccessMsg(res.data.message);
            setSavedEmail(formData.email);
            setRequiredChannels(res.data.requiredChannels || ['EMAIL']);
            setPendingChannels(res.data.pendingChannels || res.data.requiredChannels || ['EMAIL']);
            setStep('RESET_OTP');
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
            setStep('FORM');
            setIsLogin(true);
            setFormData({ ...formData, password: '' });
        } catch (err) {
            setError(err.response?.data?.error || `Failed to verify ${channel} or reset password.`);
        } finally {
            setLoadingMap({ ...loadingMap, [channel]: false });
        }
    };

    if (step === 'OTP') {
        return (
            <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center items-center flex-col">
                        {brandingLoading ? null : branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-24 w-auto max-w-[300px] object-contain mb-4" />
                        ) : (
                            <Activity className="h-14 w-14 text-brand-600 mb-2" />
                        )}
                        <h2 className="mt-4 text-center text-3xl font-extrabold text-surface-900">Verify your Account</h2>
                        <p className="mt-2 text-center text-sm text-surface-600">
                            We have dispatched verification codes to your registered contacts.
                            {requiredChannels.length > 0 && <span className="block mt-1 font-medium text-brand-600">({requiredChannels.length} verification steps required)</span>}
                        </p>
                    </div>

                    <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-surface-200">
                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm text-center">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm text-center">
                                {successMsg}
                            </div>
                        )}

                        <div className="space-y-8">
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
                                                        className="focus:ring-brand-500 focus:border-brand-500 block w-full text-center text-xl tracking-[0.3em] border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white"
                                                        placeholder="000000"
                                                    />
                                                    <button
                                                        onClick={(e) => handleVerifyOtp(channel, e)}
                                                        disabled={isChannelLoading || currentOtp.length !== 6}
                                                        className="flex-shrink-0 flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50"
                                                    >
                                                        {isChannelLoading ? 'Verifying...' : `Verify ${channel}`}
                                                    </button>
                                                </div>
                                                <div className="mt-3 text-right">
                                                    {resendMsg[channel] && <span className="text-xs text-green-600 mr-3">{resendMsg[channel]}</span>}
                                                    <button
                                                        onClick={() => handleResendOtp(channel)}
                                                        disabled={isResendLoading}
                                                        className="text-xs font-medium text-white0 hover:text-brand-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        {isResendLoading ? 'Sending...' : `Resend ${channel} Code`}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-white0">This channel has been successfully verified.</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 text-center border-t border-surface-100 pt-4">
                            <button onClick={() => setStep('FORM')} className="text-sm text-white0 hover:text-surface-700">
                                ← Back to sign in
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'FORGOT_PASSWORD') {
        return (
            <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center items-center flex-col">
                        {brandingLoading ? null : branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-24 w-auto max-w-[300px] object-contain mb-4" />
                        ) : (
                            <Activity className="h-14 w-14 text-brand-600 mb-2" />
                        )}
                        <h2 className="mt-4 text-center text-3xl font-extrabold text-surface-900">Reset your password</h2>
                        <p className="mt-2 text-center text-sm text-surface-600">
                            Enter your email address and we'll send you a recovery code.
                        </p>
                    </div>

                    <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-surface-200">
                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleForgotPassword}>
                            <div>
                                <label className="block text-sm font-medium text-surface-700">Email address</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-surface-400" />
                                    </div>
                                    <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white" placeholder="you@example.com" />
                                </div>
                            </div>

                            <button type="submit" disabled={loading || !formData.email} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50">
                                {loading ? 'Sending...' : 'Send Recovery Code'}
                            </button>
                        </form>

                        <div className="mt-6 text-center border-t border-surface-100 pt-6">
                            <button onClick={() => setStep('FORM')} className="text-sm font-medium text-brand-600 hover:text-brand-500 transition-colors">
                                Return to sign in
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'RESET_OTP') {
        return (
            <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center items-center flex-col">
                        {brandingLoading ? null : branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-24 w-auto max-w-[300px] object-contain mb-4" />
                        ) : (
                            <Activity className="h-14 w-14 text-brand-600 mb-2" />
                        )}
                        <h2 className="mt-4 text-center text-3xl font-extrabold text-surface-900">Recovery Steps</h2>
                        <p className="mt-2 text-center text-sm text-surface-600">
                            Verify your identity across the required channels to set a new password.
                            {requiredChannels.length > 0 && <span className="block mt-1 font-medium text-brand-600">({requiredChannels.length} verification steps required)</span>}
                        </p>
                    </div>

                    <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-surface-200">
                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm text-center">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm text-center">
                                {successMsg}
                            </div>
                        )}

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
                                    className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 pr-10 sm:text-sm border-surface-300 rounded-md py-3 px-3 border text-surface-900 bg-white"
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
                            <p className="text-xs text-white0 mt-2">This password will be applied once all OTPs below are verified.</p>
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
                                                        className="focus:ring-brand-500 focus:border-brand-500 block w-full text-center text-xl tracking-[0.3em] border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white"
                                                        placeholder="000000"
                                                    />
                                                    <button
                                                        onClick={(e) => handleResetPassword(channel, e)}
                                                        disabled={isChannelLoading || currentOtp.length !== 6 || newPassword.length < 6}
                                                        className="flex-shrink-0 flex justify-center items-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50"
                                                    >
                                                        {isChannelLoading ? 'Verifying...' : `Verify ${channel}`}
                                                    </button>
                                                </div>
                                                <div className="mt-3 text-right">
                                                    {resendMsg[channel] && <span className="text-xs text-green-600 mr-3">{resendMsg[channel]}</span>}
                                                    <button
                                                        onClick={() => handleResendOtp(channel)}
                                                        disabled={isResendLoading}
                                                        className="text-xs font-medium text-white0 hover:text-brand-600 disabled:opacity-50 transition-colors"
                                                    >
                                                        {isResendLoading ? 'Sending...' : `Resend ${channel} Code`}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-white0">This channel has been successfully verified.</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 text-center border-t border-surface-100 pt-4">
                            <button onClick={() => setStep('FORM')} className="text-sm text-white0 hover:text-surface-700">
                                ← Back to sign in
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center items-center flex-col">
                    {brandingLoading ? null : branding.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="h-24 w-auto max-w-[300px] object-contain mb-4" />
                    ) : (
                        <Activity className="h-14 w-14 text-brand-600 mb-2" />
                    )}
                </div>
                <h2 className="mt-4 text-center text-3xl font-extrabold text-surface-900">
                    {isLogin 
                        ? 'Sign in to your workspace' 
                        : (branding?.trialEnabled !== false 
                            ? (branding?.trialSignupText || `Start your ${branding?.trialDurationDays || 7}-day free trial`) 
                            : 'Create a new account'
                          )
                    }
                </h2>
                <p className="mt-2 text-center text-sm text-surface-600">
                    {isLogin ? 'Or ' : 'Already have an account? '}
                    {isLogin ? (
                        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-500">
                            create a new account
                        </Link>
                    ) : (
                        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500">
                            sign in instead
                        </Link>
                    )}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-surface-200">
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm text-center">
                            {error}
                        </div>
                    )}

                    {!isLogin && branding?.trialEnabled !== false && (
                        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <p className="text-sm text-green-800">
                                <span className="font-bold">🎉 Welcome!</span> Create an account today and instantly get a <span className="font-bold">{branding?.trialDurationDays || 7}-Day Free Trial</span>. No credit card required.
                            </p>
                        </div>
                    )}
                    {!isLogin && branding?.trialEnabled === false && (
                        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                            <p className="text-sm text-blue-800">
                                <span className="font-bold">✨ Welcome!</span> Register your workspace today. Once registered, you can choose a subscription plan to unlock full capabilities.
                            </p>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {!isLogin && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700">Company / Full Name</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-surface-400" />
                                        </div>
                                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white" placeholder="Acme Corp" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Phone Number (WhatsApp)</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <PhoneInput
                                            country={'in'}
                                            enableSearch={true}
                                            placeholder="9876543210"
                                            value={formData.phone}
                                            onChange={phone => setFormData({ ...formData, phone })}
                                            inputClass="!w-full !focus:ring-brand-500 !focus:border-brand-500 !block !sm:text-sm !border-surface-300 !rounded-md !py-2 !h-[42px] !border !text-surface-900 !bg-white"
                                            containerClass="!w-full"
                                            buttonClass="!border-surface-300 !bg-surface-50 !rounded-l-md"
                                            dropdownClass="!text-surface-900 !bg-white"
                                            searchClass="!text-surface-900 !bg-white !placeholder-surface-400"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-surface-700">Email address</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-surface-400" />
                                </div>
                                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white" placeholder="you@example.com" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-surface-700">Password</label>
                                {isLogin && (
                                    <button type="button" onClick={() => { setStep('FORGOT_PASSWORD'); setFormData({ ...formData, password: '' }); setError(''); setSuccessMsg(''); }} className="text-sm font-medium text-brand-600 hover:text-brand-500">
                                        Forgot your password?
                                    </button>
                                )}
                            </div>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-surface-400" />
                                </div>
                                <input type={showPassword ? "text" : "password"} required minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 pr-10 sm:text-sm border-surface-300 rounded-md py-2 px-3 border text-surface-900 bg-white" placeholder="••••••••" />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <button type="submit" disabled={loading} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors disabled:opacity-50">
                                {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Auth;
