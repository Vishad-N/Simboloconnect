import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

/* ── Google SVG ── */
const GoogleSVG = () => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const FacebookSVG = () => (
  <svg viewBox="0 0 24 24" fill="white" style={{ width: 18, height: 18, flexShrink: 0 }}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);
const WA_SVG = () => (
  <svg viewBox="0 0 24 24" style={{ width: 26, height: 26, fill: 'white' }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

const FA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
.fa-page * { box-sizing: border-box; margin: 0; padding: 0; }
.fa-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #0c1f16; min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }

/* LEFT */
.fa-left {
  background: linear-gradient(160deg, #075E54 0%, #0d7a62 45%, #0b6b4f 100%);
  padding: 48px 52px; display: flex; flex-direction: column; justify-content: space-between;
  position: relative; overflow: hidden;
}
.fa-left::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,.12) 1px, transparent 1px);
  background-size: 26px 26px; pointer-events: none;
}
.fa-left::after {
  content: ''; position: absolute; top: -160px; right: -160px;
  width: 500px; height: 500px; border-radius: 50%;
  background: radial-gradient(circle, rgba(37,211,102,.22) 0%, transparent 65%);
  pointer-events: none;
}
.fa-blob-b {
  position: absolute; bottom: -120px; left: -100px;
  width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,0,0,.2) 0%, transparent 65%);
  pointer-events: none;
}
.fa-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; position: relative; z-index: 2; }
.fa-logo-box {
  width: 44px; height: 44px; border-radius: 13px;
  background: linear-gradient(135deg, #25D366, #00e676);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px rgba(37,211,102,.45);
}
.fa-logo-name { font-size: 22px; font-weight: 900; color: white; letter-spacing: -.3px; }
.fa-logo-name em { color: #7fff9a; font-style: normal; }
.fa-left-hero { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0 30px; }
.fa-tag {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.12); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.2); border-radius: 100px;
  padding: 7px 16px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,.9);
  margin-bottom: 30px; width: fit-content;
}
.fa-live-dot { width: 8px; height: 8px; border-radius: 50%; background: #25D366; display: inline-block; box-shadow: 0 0 8px #25D366; animation: fa-blink 1.8s ease-in-out infinite; }
@keyframes fa-blink { 0%,100%{opacity:1;}50%{opacity:.3;} }
.fa-left-hero h1 { font-size: clamp(30px,3vw,46px); font-weight: 900; color: white; line-height: 1.12; letter-spacing: -1.2px; margin-bottom: 16px; }
.fa-left-hero h1 span { color: #7fff9a; }
.fa-left-hero p { font-size: 15px; color: rgba(255,255,255,.65); line-height: 1.7; max-width: 380px; margin-bottom: 38px; }
.fa-trust-row { display: flex; flex-direction: column; gap: 14px; margin-bottom: 42px; }
.fa-trust-item {
  display: flex; align-items: center; gap: 14px;
  background: rgba(255,255,255,.08); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.12); border-radius: 14px;
  padding: 14px 18px; transition: background .2s;
}
.fa-trust-item:hover { background: rgba(255,255,255,.13); }
.fa-ti-icon { width: 40px; height: 40px; border-radius: 11px; background: rgba(37,211,102,.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
.fa-ti-text { flex: 1; }
.fa-ti-title { font-size: 13px; font-weight: 800; color: white; margin-bottom: 2px; }
.fa-ti-sub { font-size: 11px; color: rgba(255,255,255,.55); }
.fa-ti-badge { background: #25D366; color: #075E54; font-size: 10px; font-weight: 900; border-radius: 100px; padding: 3px 10px; white-space: nowrap; }
.fa-stats-row { display: flex; gap: 0; position: relative; z-index: 2; }
.fa-stat-item { flex: 1; text-align: center; padding: 0 8px; }
.fa-stat-item:not(:last-child) { border-right: 1px solid rgba(255,255,255,.12); }
.fa-stat-n { font-size: 24px; font-weight: 900; color: #7fff9a; letter-spacing: -.5px; }
.fa-stat-l { font-size: 11px; color: rgba(255,255,255,.5); font-weight: 500; margin-top: 2px; }
.fa-testi-strip {
  position: relative; z-index: 2;
  background: rgba(255,255,255,.07); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
  padding: 18px 20px; margin-top: 28px;
}
.fa-testi-stars { color: #FFD700; font-size: 12px; margin-bottom: 6px; }
.fa-testi-text { font-size: 12.5px; color: rgba(255,255,255,.75); line-height: 1.6; font-style: italic; margin-bottom: 12px; }
.fa-testi-author { display: flex; align-items: center; gap: 10px; }
.fa-tav { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#e85858,#f06060); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: white; }
.fa-tname { font-size: 12px; font-weight: 700; color: white; }
.fa-trole { font-size: 10px; color: rgba(255,255,255,.45); }

/* RIGHT */
.fa-right { background: white; padding: 48px 52px; display: flex; flex-direction: column; justify-content: center; overflow-y: auto; }
.fa-form-header { margin-bottom: 28px; }
.fa-form-header h2 { font-size: 26px; font-weight: 900; color: #0b1e12; letter-spacing: -.5px; margin-bottom: 6px; }
.fa-form-header p { font-size: 14px; color: #4d7a62; }
.fa-form-header p a { color: #128C7E; font-weight: 700; text-decoration: none; }
.fa-form-header p a:hover { text-decoration: underline; }

/* Social */
.fa-social-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.fa-soc-btn {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 11px 16px; border-radius: 11px;
  font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s;
  text-decoration: none; border: 1.5px solid; font-family: inherit;
}
.fa-soc-google { background: white; border-color: #e0e0e0; color: #3c4043; }
.fa-soc-google:hover { background: #f8f9fa; border-color: #d0d0d0; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.fa-soc-fb { background: #1877F2; border-color: #1877F2; color: white; }
.fa-soc-fb:hover { background: #0d6edc; box-shadow: 0 4px 14px rgba(24,119,242,.3); }

/* Divider */
.fa-divider { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.fa-divider-line { flex: 1; height: 1px; background: #cde9d8; }
.fa-divider-text { font-size: 12px; color: #4d7a62; font-weight: 600; white-space: nowrap; }

/* Form */
.fa-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fa-field { margin-bottom: 16px; }
.fa-field label { display: block; font-size: 12px; font-weight: 700; color: #0b1e12; margin-bottom: 6px; letter-spacing: .2px; }
.fa-field label .req { color: #e53935; margin-left: 2px; }
.fa-input {
  width: 100%; padding: 11px 14px; border: 1.5px solid #cde9d8; border-radius: 10px;
  font-size: 13.5px; font-family: inherit; color: #0b1e12; background: #f3fbf6;
  outline: none; transition: border-color .2s, box-shadow .2s, background .2s;
}
.fa-input:focus { border-color: #25D366; box-shadow: 0 0 0 3px rgba(37,211,102,.12); background: white; }
.fa-input.err { border-color: #e53935; box-shadow: 0 0 0 3px rgba(229,57,53,.08); }
.fa-pw-wrap { position: relative; }
.fa-pw-wrap .fa-input { padding-right: 44px; }
.fa-pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #4d7a62; transition: color .2s; }
.fa-pw-toggle:hover { color: #128C7E; }

/* Strength */
.fa-strength-bar { display: flex; gap: 4px; margin-top: 8px; }
.fa-sb { flex: 1; height: 4px; border-radius: 4px; background: #e8f0eb; transition: background .3s; }
.fa-sb.weak { background: #e53935; } .fa-sb.fair { background: #fb8c00; } .fa-sb.good { background: #43a047; } .fa-sb.strong { background: #25D366; }
.fa-strength-label { font-size: 11px; font-weight: 700; margin-top: 4px; }
.fa-strength-label.weak{color:#e53935;} .fa-strength-label.fair{color:#fb8c00;} .fa-strength-label.good{color:#43a047;} .fa-strength-label.strong{color:#25D366;}

/* Error text */
.fa-err { font-size: 11px; color: #e53935; margin-top: 5px; font-weight: 600; }

/* Terms */
.fa-terms-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; }
.fa-terms-row input[type=checkbox] { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; accent-color: #25D366; cursor: pointer; }
.fa-terms-row label { font-size: 12px; color: #4d7a62; line-height: 1.5; cursor: pointer; }
.fa-terms-row label a { color: #128C7E; font-weight: 700; text-decoration: none; }

/* Submit */
.fa-submit {
  width: 100%; padding: 14px; border-radius: 12px;
  background: linear-gradient(135deg, #25D366, #00df6a);
  color: white; font-size: 15px; font-weight: 900; font-family: inherit;
  border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(37,211,102,.38); transition: all .25s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.fa-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(37,211,102,.48); }
.fa-submit:disabled { opacity: .7; cursor: not-allowed; transform: none; }
.fa-trial-note { text-align: center; margin-top: 14px; font-size: 12px; color: #4d7a62; }
.fa-trial-note span { color: #25D366; font-weight: 700; }

/* Forgot / misc */
.fa-forgot-link { font-size: 12px; color: #128C7E; font-weight: 700; text-decoration: none; float: right; }
.fa-forgot-link:hover { text-decoration: underline; }
.fa-error-box { background: #fff5f5; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #e53935; margin-bottom: 16px; }
.fa-success-box { background: #f0fdf5; border: 1px solid #9ae8c0; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #128C7E; margin-bottom: 16px; }

/* OTP input */
.fa-otp-wrap { display: flex; gap: 10px; justify-content: center; margin: 16px 0; }
.fa-otp-input { width: 48px; height: 56px; text-align: center; font-size: 22px; font-weight: 800; border: 2px solid #cde9d8; border-radius: 12px; outline: none; font-family: inherit; color: #0b1e12; background: #f3fbf6; transition: border-color .2s; }
.fa-otp-input:focus { border-color: #25D366; box-shadow: 0 0 0 3px rgba(37,211,102,.12); }

/* Plan Picker */
.fa-plan-picker { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
.fa-plan-opt {
  border: 1.5px solid #cde9d8; border-radius: 12px; padding: 12px 10px;
  cursor: pointer; text-align: center; transition: all .2s; background: #f3fbf6;
  position: relative;
}
.fa-plan-opt:hover { border-color: #25D366; background: #ecfcf3; }
.fa-plan-opt.selected { border-color: #25D366; background: #e0faf0; box-shadow: 0 0 0 3px rgba(37,211,102,.15); }
.fa-plan-opt-pop { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #25D366; color: white; font-size: 9px; font-weight: 900; border-radius: 100px; padding: 2px 9px; white-space: nowrap; }
.fa-plan-name { font-size: 12px; font-weight: 800; color: #0b1e12; margin-bottom: 3px; }
.fa-plan-price { font-size: 13px; font-weight: 900; color: #128C7E; }
.fa-plan-price span { font-size: 10px; font-weight: 500; color: #4d7a62; }

@media(max-width:960px) { .fa-page { grid-template-columns: 1fr; } .fa-left { display: none; } .fa-right { padding: 40px 28px; } }
@media(max-width:480px) { .fa-form-row { grid-template-columns: 1fr; } .fa-social-row { grid-template-columns: 1fr; } .fa-plan-picker { grid-template-columns: 1fr; } }
`;

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const FreshAuth = () => {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();

  const isRegister = location.pathname === '/register';
  const isLogin = !isRegister;

  // State (same as Auth.jsx)
  const [step, setStep] = useState('FORM'); // FORM | OTP | FORGOT_PASSWORD | RESET_OTP
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', businessName: '' });
  const [selectedPlan, setSelectedPlan] = useState('business');
  const [otpValues, setOtpValues] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [requiredChannels, setRequiredChannels] = useState([]);
  const [pendingChannels, setPendingChannels] = useState([]);
  const [loadingMap, setLoadingMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwStrength, setPwStrength] = useState({ level: 0, label: '', cls: '' });
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsErr, setTermsErr] = useState('');
  
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  useEffect(() => { setStep('FORM'); setError(''); setSuccessMsg(''); }, [location.pathname]);

  useEffect(() => {
    if (isRegister) {
      setLoadingPlans(true);
      axios.get(`${API}/api/auth/plans`)
        .then(res => {
          setPlans(res.data);
          if (res.data && res.data.length > 0) {
            // Select the most popular plan by default, or the second one, or the first one
            const pop = res.data.find(p => p.is_popular) || res.data[1] || res.data[0];
            setSelectedPlan(pop.id);
          }
        })
        .catch(err => console.error("Failed to load plans", err))
        .finally(() => setLoadingPlans(false));
    }
  }, [isRegister]);

  const platformName = branding?.name || import.meta.env.VITE_BRAND_NAME || 'WaDesk';
  const trialDays = branding?.trialDurationDays || 7;
  const trialEnabled = branding?.trialEnabled !== false;
  const googleEnabled = branding?.googleOauthEnabled === true;
  const facebookEnabled = branding?.facebookOauthEnabled === true;

  // Password strength
  const checkStrength = (val) => {
    if (!val) { setPwStrength({ level: 0, label: '', cls: '' }); return; }
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score = Math.min(score + 1, 4);
    const levels = [
      { level: 1, label: 'Weak password', cls: 'weak' },
      { level: 2, label: 'Fair password', cls: 'fair' },
      { level: 3, label: 'Good password', cls: 'good' },
      { level: 4, label: 'Strong password', cls: 'strong' },
    ];
    setPwStrength(levels[Math.min(score - 1, 3)] || { level: 0, label: '', cls: '' });
  };

  // Auth submit (same logic as Auth.jsx)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    if (isRegister && !termsChecked) { setTermsErr('You must accept the terms to continue'); setLoading(false); return; }
    setTermsErr('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      const payload = isRegister ? { ...formData, selectedPlan } : formData;
      const res = await axios.post(`${API}${endpoint}`, payload);
      if (res.data.requiresVerification) {
        setSavedEmail(res.data.email);
        setSuccessMsg(res.data.message);
        setRequiredChannels(res.data.requiredChannels || ['EMAIL']);
        setPendingChannels(res.data.pendingChannels || res.data.requiredChannels || ['EMAIL']);
        setStep('OTP');
        return;
      }
      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('tenantId', res.data.user.id);
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        setSavedEmail(err.response.data.email);
        setSuccessMsg(err.response.data.error || 'Please verify your identity.');
        setRequiredChannels(err.response.data.requiredChannels || ['EMAIL']);
        setPendingChannels(err.response.data.pendingChannels || err.response.data.requiredChannels || ['EMAIL']);
        setStep('OTP');
        return;
      }
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (channel, e) => {
    if (e) e.preventDefault();
    const otpCode = otpValues[channel];
    if (!otpCode || otpCode.length !== 6) return;
    setLoadingMap({ ...loadingMap, [channel]: true }); setError('');
    try {
      const res = await axios.post(`${API}/api/auth/verify-otp`, {
        email: savedEmail, otp: otpCode, channel, context: 'SIGNUP'
      });
      if (res.data.requiresMoreVerification) {
        setPendingChannels(res.data.pendingChannels || []);
        setRequiredChannels(res.data.requiredChannels || requiredChannels);
        setOtpValues({});
        setSuccessMsg('OTP verified! Please complete remaining verification.');
        return;
      }
      localStorage.setItem('userToken', res.data.token);
      localStorage.setItem('tenantId', res.data.user.id);
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
    } finally { setLoadingMap({ ...loadingMap, [channel]: false }); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await axios.post(`${API}/api/auth/forgot-password`, { email: formData.email });
      setSavedEmail(formData.email);
      setSuccessMsg('A reset OTP has been sent to your email.');
      setStep('RESET_OTP');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email.');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await axios.post(`${API}/api/auth/reset-password`, {
        email: savedEmail, otp: otpValues['EMAIL'], newPassword
      });
      setSuccessMsg('Password reset successfully! You can now log in.');
      setStep('FORM');
      setFormData(d => ({ ...d, password: '' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  const handleResend = async (channel) => {
    try {
      await axios.post(`${API}/api/auth/resend-otp`, { email: savedEmail, channel });
    } catch (err) {}
  };

  const handleOtpChange = (channel, val) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setOtpValues(prev => ({ ...prev, [channel]: digits }));
  };

  const handleSocial = (provider) => {
    window.location.href = `${API}/api/auth/oauth/${provider.toLowerCase()}`;
  };

  const channelLabel = (ch) => ch === 'EMAIL' ? 'Email' : ch === 'PHONE' ? 'Phone' : ch;

  return (
    <div className="fa-page">
      <style dangerouslySetInnerHTML={{ __html: FA_CSS }} />

      {/* LEFT PANEL */}
      <div className="fa-left">
        <div className="fa-blob-b" />
        <a className="fa-logo" href="/">
          {(branding?.freshLogoUrl || branding?.logoUrl) ? (
            <img src={branding.freshLogoUrl || branding.logoUrl} alt="Logo" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 13, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'none', stroke: 'white', strokeWidth: 2 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
          )}
          <span className="fa-logo-name">
            {platformName.split(' ')[0]}<em>{platformName.split(' ').slice(1).join(' ') || ''}</em>
          </span>
        </a>
        <div className="fa-left-hero">
          <div className="fa-tag"><span className="fa-live-dot" /> Official WhatsApp Business API Partner</div>
          <h1>Start Sending<br /><span>WhatsApp Campaigns</span><br />in 7 Minutes</h1>
          <p>Join 50,000+ Indian businesses using {platformName} to automate messages, build chatbots, and boost sales — all from one powerful dashboard.</p>
          <div className="fa-trust-row">
            {[
              { icon: '🚀', title: trialEnabled ? `${trialDays}-Day Free Trial` : 'Get Started Free', sub: 'No credit card needed. Cancel anytime.', badge: trialEnabled ? 'FREE' : null },
              { icon: '🤖', title: 'AI Chatbot Builder', sub: 'No coding. Live in under 10 minutes.' },
              { icon: '🛡️', title: '100% Official API', sub: 'Meta-approved. Green tick included.' },
            ].map((t, i) => (
              <div key={i} className="fa-trust-item">
                <div className="fa-ti-icon">{t.icon}</div>
                <div className="fa-ti-text">
                  <div className="fa-ti-title">{t.title}</div>
                  <div className="fa-ti-sub">{t.sub}</div>
                </div>
                {t.badge && <div className="fa-ti-badge">{t.badge}</div>}
              </div>
            ))}
          </div>
          <div className="fa-stats-row">
            <div className="fa-stat-item"><div className="fa-stat-n">50K+</div><div className="fa-stat-l">Businesses</div></div>
            <div className="fa-stat-item"><div className="fa-stat-n">1B+</div><div className="fa-stat-l">Messages Sent</div></div>
            <div className="fa-stat-item"><div className="fa-stat-n">99.9%</div><div className="fa-stat-l">Uptime</div></div>
            <div className="fa-stat-item"><div className="fa-stat-n">98%</div><div className="fa-stat-l">Read Rate</div></div>
          </div>
        </div>
        <div className="fa-testi-strip">
          <div className="fa-testi-stars">★★★★★</div>
          <div className="fa-testi-text">"{platformName} transformed how we communicate. Our order confirmations now get 98% read rates. Best investment this year."</div>
          <div className="fa-testi-author">
            <div className="fa-tav">RK</div>
            <div><div className="fa-tname">Rahul Kapoor</div><div className="fa-trole">Founder, ShopEzy India</div></div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="fa-right">

        {/* ── OTP Step ── */}
        {step === 'OTP' && (
          <div>
            <div className="fa-form-header">
              <h2>Verify Your Identity</h2>
              <p>We've sent verification codes to your registered channels.</p>
            </div>
            {successMsg && <div className="fa-success-box">{successMsg}</div>}
            {error && <div className="fa-error-box">{error}</div>}
            {pendingChannels.map(channel => (
              <div key={channel} className="fa-field">
                <label>{channelLabel(channel)} OTP <span className="req">*</span></label>
                <div className="fa-otp-wrap">
                  {[0,1,2,3,4,5].map(i => (
                    <input
                      key={i}
                      className="fa-otp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpValues[channel] ? otpValues[channel][i] || '' : ''}
                      onChange={e => {
                        const full = (otpValues[channel] || '').slice(0, i) + e.target.value.replace(/\D/g,'') + (otpValues[channel] || '').slice(i+1);
                        handleOtpChange(channel, full.slice(0,6));
                        if (e.target.value && e.target.nextSibling) e.target.nextSibling.focus();
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !e.target.value && e.target.previousSibling) e.target.previousSibling.focus();
                      }}
                    />
                  ))}
                </div>
                <button className="fa-submit" onClick={(e) => handleVerifyOtp(channel, e)} disabled={loadingMap[channel]}>
                  {loadingMap[channel] ? 'Verifying…' : `Verify ${channelLabel(channel)} OTP`}
                </button>
                <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#4d7a62' }}>
                  Didn't receive it?{' '}
                  <button onClick={() => handleResend(channel)} style={{ background: 'none', border: 'none', color: '#128C7E', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Resend OTP</button>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Forgot Password ── */}
        {step === 'FORGOT_PASSWORD' && (
          <div>
            <div className="fa-form-header">
              <h2>Reset Password</h2>
              <p>Enter your email to receive a reset code. <button onClick={() => setStep('FORM')} style={{ background: 'none', border: 'none', color: '#128C7E', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Back to Login →</button></p>
            </div>
            {error && <div className="fa-error-box">{error}</div>}
            {successMsg && <div className="fa-success-box">{successMsg}</div>}
            <form onSubmit={handleForgotPassword}>
              <div className="fa-field">
                <label>Email Address <span className="req">*</span></label>
                <input className="fa-input" type="email" placeholder="rahul@yourbusiness.com" value={formData.email} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))} required />
              </div>
              <button className="fa-submit" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Code →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Reset OTP ── */}
        {step === 'RESET_OTP' && (
          <div>
            <div className="fa-form-header">
              <h2>Set New Password</h2>
              <p>Enter the OTP sent to {savedEmail} and your new password.</p>
            </div>
            {error && <div className="fa-error-box">{error}</div>}
            {successMsg && <div className="fa-success-box">{successMsg}</div>}
            <form onSubmit={handleResetPassword}>
              <div className="fa-field">
                <label>Reset OTP <span className="req">*</span></label>
                <input className="fa-input" type="text" placeholder="6-digit OTP" maxLength={6} value={otpValues['EMAIL'] || ''} onChange={e => handleOtpChange('EMAIL', e.target.value)} required />
              </div>
              <div className="fa-field">
                <label>New Password <span className="req">*</span></label>
                <div className="fa-pw-wrap">
                  <input className="fa-input" type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                  <button type="button" className="fa-pw-toggle" onClick={() => setShowPassword(s => !s)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                      {showPassword ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                    </svg>
                  </button>
                </div>
              </div>
              <button className="fa-submit" type="submit" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Main FORM (Login / Register) ── */}
        {step === 'FORM' && (
          <>
            <div className="fa-form-header">
              <h2>{isRegister ? 'Create your free account' : 'Welcome back'}</h2>
              {isRegister
                ? <p>Already have an account? <Link to="/login">Sign in →</Link></p>
                : <p>Don't have an account? <Link to="/register">Create one free →</Link></p>
              }
            </div>

            {/* Social Buttons */}
            {(googleEnabled || facebookEnabled) && (
              <>
                <div className="fa-social-row">
                  {googleEnabled && (
                    <button className="fa-soc-btn fa-soc-google" type="button" onClick={() => handleSocial('Google')}>
                      <GoogleSVG /> {isRegister ? 'Sign up with Google' : 'Continue with Google'}
                    </button>
                  )}
                  {facebookEnabled && (
                    <button className="fa-soc-btn fa-soc-fb" type="button" onClick={() => handleSocial('Facebook')}>
                      <FacebookSVG /> {isRegister ? 'Sign up with Facebook' : 'Continue with Facebook'}
                    </button>
                  )}
                </div>
                <div className="fa-divider">
                  <div className="fa-divider-line" />
                  <div className="fa-divider-text">OR CONTINUE WITH EMAIL</div>
                  <div className="fa-divider-line" />
                </div>
              </>
            )}

            {error && <div className="fa-error-box">{error}</div>}

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <>
                  <div className="fa-form-row">
                    <div className="fa-field">
                      <label>First Name <span className="req">*</span></label>
                      <input className="fa-input" type="text" placeholder="Rahul" value={formData.name?.split(' ')[0] || ''} onChange={e => setFormData(d => ({ ...d, name: e.target.value + ' ' + (d.name?.split(' ').slice(1).join(' ') || '') }))} required />
                    </div>
                    <div className="fa-field">
                      <label>Last Name</label>
                      <input className="fa-input" type="text" placeholder="Sharma" value={formData.name?.split(' ').slice(1).join(' ') || ''} onChange={e => setFormData(d => ({ ...d, name: (d.name?.split(' ')[0] || '') + ' ' + e.target.value }))} />
                    </div>
                  </div>
                  <div className="fa-field">
                    <label>Business Name <span className="req">*</span></label>
                    <input className="fa-input" type="text" placeholder="e.g. ShopEzy India" value={formData.businessName} onChange={e => setFormData(d => ({ ...d, businessName: e.target.value }))} required />
                  </div>
                  <div className="fa-field">
                    <label>Choose Your Plan</label>
                    <div className="fa-plan-picker">
                      {loadingPlans ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', fontSize: 12, color: '#4d7a62', padding: 10 }}>Loading plans...</div>
                      ) : plans.map(p => (
                        <div key={p.id} className={`fa-plan-opt${selectedPlan === p.id ? ' selected' : ''}`} onClick={() => setSelectedPlan(p.id)}>
                          {p.is_popular && <div className="fa-plan-opt-pop">POPULAR</div>}
                          <div className="fa-plan-name">{p.name}</div>
                          <div className="fa-plan-price">₹{p.price}<span>{p.duration_days === 30 ? '/mo' : `/${p.duration_days}d`}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div className="fa-field">
                <label>Email Address <span className="req">*</span></label>
                <input className="fa-input" type="email" placeholder="rahul@yourbusiness.com" value={formData.email} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))} required />
              </div>

              {/* Phone (register only) */}
              {isRegister && (
                <div className="fa-field">
                  <label>Phone Number <span className="req">*</span></label>
                  <PhoneInput
                    country="in"
                    value={formData.phone}
                    onChange={val => setFormData(d => ({ ...d, phone: '+' + val }))}
                    inputStyle={{ width: '100%', fontFamily: 'inherit', fontSize: 13.5, background: '#f3fbf6', border: '1.5px solid #cde9d8', borderRadius: 10, padding: '11px 14px 11px 52px', color: '#0b1e12', height: 44 }}
                    buttonStyle={{ background: '#f3fbf6', border: '1.5px solid #cde9d8', borderRight: 'none', borderRadius: '10px 0 0 10px' }}
                    containerStyle={{ width: '100%' }}
                  />
                </div>
              )}

              {/* Password */}
              <div className="fa-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Password <span className="req">*</span></label>
                  {isLogin && <button type="button" className="fa-forgot-link" onClick={() => setStep('FORGOT_PASSWORD')}>Forgot password?</button>}
                </div>
                <div className="fa-pw-wrap">
                  <input
                    className="fa-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={e => { setFormData(d => ({ ...d, password: e.target.value })); if (isRegister) checkStrength(e.target.value); }}
                    required
                  />
                  <button type="button" className="fa-pw-toggle" onClick={() => setShowPassword(s => !s)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                      {showPassword ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                    </svg>
                  </button>
                </div>
                {isRegister && pwStrength.level > 0 && (
                  <>
                    <div className="fa-strength-bar">
                      {[1,2,3,4].map(i => <div key={i} className={`fa-sb${i <= pwStrength.level ? ` ${pwStrength.cls}` : ''}`} />)}
                    </div>
                    <div className={`fa-strength-label ${pwStrength.cls}`}>{pwStrength.label}</div>
                  </>
                )}
              </div>

              {/* Terms (register only) */}
              {isRegister && (
                <div className="fa-terms-row">
                  <input type="checkbox" id="fa-terms" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
                  <label htmlFor="fa-terms">
                    I agree to {platformName}'s{' '}
                    {branding?.landingTermsConditions ? <Link to="/terms-conditions">Terms of Service</Link> : 'Terms of Service'} and{' '}
                    {branding?.landingPrivacyPolicy ? <Link to="/privacy-policy">Privacy Policy</Link> : 'Privacy Policy'}.
                    I consent to receive product updates via email and WhatsApp.
                  </label>
                </div>
              )}
              {termsErr && <div className="fa-err" style={{ marginTop: -12, marginBottom: 16 }}>{termsErr}</div>}

              <button className="fa-submit" type="submit" disabled={loading}>
                {loading
                  ? (isRegister ? 'Creating Account…' : 'Signing In…')
                  : isRegister
                    ? (trialEnabled ? `Create Free Account — Start ${trialDays}-Day Trial` : 'Create Free Account')
                    : 'Sign In →'
                }
                {!loading && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 18, height: 18 }}>
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                )}
              </button>

              {isRegister && trialEnabled && (
                <div className="fa-trial-note">
                  🔒 No credit card required &nbsp;·&nbsp; <span>Free for {trialDays} days</span> &nbsp;·&nbsp; Cancel anytime
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default FreshAuth;
