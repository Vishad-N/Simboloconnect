import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import FreshPricing from './FreshPricing';

const WA_SVG = () => (
  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'white' }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

const FL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

.fl-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.fl-landing { font-family: 'Plus Jakarta Sans', sans-serif; background: #f3fbf6; color: #0b1e12; }
.fl-landing html { scroll-behavior: smooth; }

/* NAV */
.fl-nav {
  background: rgba(255,255,255,.92); backdrop-filter: blur(18px);
  border-bottom: 1px solid #cde9d8;
  padding: 0 6%; height: 68px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 200;
}
.fl-logo-a { display: flex; align-items: center; gap: 11px; text-decoration: none; }
.fl-logo-box {
  width: 38px; height: 38px; border-radius: 11px;
  background: linear-gradient(135deg,#25D366,#00e676);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(37,211,102,.4);
}
.fl-logo-name { font-size: 19px; font-weight: 800; color: #075E54; letter-spacing: -.3px; }
.fl-logo-name em { color: #25D366; font-style: normal; }
.fl-nav-links { display: flex; gap: 30px; list-style: none; }
.fl-nav-links a { text-decoration: none; color: #4d7a62; font-size: 14px; font-weight: 600; transition: color .2s; }
.fl-nav-links a:hover { color: #128C7E; }
.fl-nav-actions { display: flex; gap: 10px; align-items: center; }
.fl-btn-ghost {
  padding: 9px 20px; border-radius: 9px; border: 1.5px solid #cde9d8; color: #128C7E;
  font-weight: 700; font-size: 13px; background: transparent; cursor: pointer;
  text-decoration: none; transition: all .2s; font-family: inherit;
}
.fl-btn-ghost:hover { border-color: #25D366; background: #f0fdf5; }
.fl-btn-primary {
  padding: 9px 22px; border-radius: 9px; background: linear-gradient(135deg,#25D366,#00df6a);
  color: white; font-weight: 800; font-size: 13px; border: none; cursor: pointer;
  text-decoration: none; box-shadow: 0 4px 14px rgba(37,211,102,.35); transition: all .2s;
  font-family: inherit;
}
.fl-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37,211,102,.45); }

/* HERO */
.fl-hero {
  display: grid; grid-template-columns: 1fr 1fr;
  align-items: center; gap: 0;
  min-height: calc(100vh - 68px);
  padding: 0 6%;
  background: linear-gradient(135deg,#e8faf0 0%,#f3fbf6 50%,#fff 100%);
  position: relative; overflow: hidden;
}
.fl-hero::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(circle,#c2e8d0 1px,transparent 1px);
  background-size: 28px 28px; opacity: .45; pointer-events: none;
}
.fl-hero::after {
  content: ''; position: absolute; top: -200px; left: -200px;
  width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle,rgba(37,211,102,.12) 0%,transparent 65%);
  pointer-events: none;
}
.fl-hero-left { position: relative; z-index: 2; padding: 60px 0; }
.fl-hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: #e0faf0; border: 1px solid #9ae8c0;
  border-radius: 100px; padding: 7px 16px;
  font-size: 12px; font-weight: 700; color: #128C7E; margin-bottom: 28px;
}
.fl-live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #25D366;
  display: inline-block; box-shadow: 0 0 8px #25D366;
  animation: fl-blink 1.8s ease-in-out infinite;
}
@keyframes fl-blink { 0%,100%{opacity:1;}50%{opacity:.3;} }
.fl-hero h1 {
  font-size: clamp(36px,4.5vw,62px); font-weight: 900;
  line-height: 1.1; letter-spacing: -1.5px; color: #0b1e12; margin-bottom: 20px;
}
.fl-hero h1 .grad {
  background: linear-gradient(90deg,#25D366,#00b894);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.fl-hero-sub { font-size: 17px; color: #4d7a62; line-height: 1.7; max-width: 480px; margin-bottom: 36px; }
.fl-hero-btns { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 48px; }
.fl-h-btn {
  padding: 15px 32px; border-radius: 12px;
  background: linear-gradient(135deg,#25D366,#00df6a);
  color: white; font-size: 16px; font-weight: 800; border: none; cursor: pointer;
  text-decoration: none; box-shadow: 0 8px 24px rgba(37,211,102,.38); transition: all .2s;
  display: inline-flex; align-items: center; gap: 8px; font-family: inherit;
}
.fl-h-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(37,211,102,.48); }
.fl-h-btn-ghost {
  padding: 15px 32px; border-radius: 12px;
  border: 2px solid #cde9d8; color: #0b1e12; font-size: 16px; font-weight: 700;
  background: white; cursor: pointer; text-decoration: none; transition: all .2s;
  display: inline-flex; align-items: center; gap: 8px; font-family: inherit;
}
.fl-h-btn-ghost:hover { border-color: #25D366; color: #128C7E; }
.fl-hero-stats { display: flex; gap: 36px; flex-wrap: wrap; }
.fl-hstat { text-align: center; }
.fl-hstat-n { font-size: 28px; font-weight: 900; color: #128C7E; letter-spacing: -.5px; }
.fl-hstat-l { font-size: 12px; color: #4d7a62; font-weight: 500; margin-top: 2px; }
.fl-hstat-div { width: 1px; background: #cde9d8; align-self: stretch; }

/* PHONE */
.fl-hero-right {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 0 40px 40px;
}
.fl-phone-frame {
  width: 280px; flex-shrink: 0; background: #fff; border-radius: 32px;
  border: 2px solid #ddd; box-shadow: 0 32px 80px rgba(0,0,0,.18),0 0 0 8px rgba(37,211,102,.06);
  overflow: hidden; position: relative;
  animation: fl-float 4s ease-in-out infinite alternate;
}
@keyframes fl-float { 0%{transform:translateY(0);}100%{transform:translateY(-14px);} }
.fl-phone-notch { height: 28px; background: #111; display: flex; align-items: center; justify-content: center; }
.fl-notch-pill { width: 60px; height: 8px; border-radius: 10px; background: #333; }
.fl-wa-header { background: #075E54; padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
.fl-wa-avatar { width: 36px; height: 36px; border-radius: 50%; background: #25D366; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: white; flex-shrink: 0; }
.fl-wa-name { font-size: 13px; font-weight: 700; color: white; }
.fl-wa-online { font-size: 10px; color: rgba(255,255,255,.65); }
.fl-wa-body { background: #ece5dd; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 300px; }
.fl-msg { max-width: 78%; padding: 8px 11px; border-radius: 12px; font-size: 11.5px; line-height: 1.5; position: relative; }
.fl-msg-in { background: white; color: #111; border-top-left-radius: 3px; align-self: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,.1); }
.fl-msg-out { background: #d9fdd3; color: #111; border-top-right-radius: 3px; align-self: flex-end; box-shadow: 0 1px 2px rgba(0,0,0,.1); }
.fl-msg-time { font-size: 9px; color: #999; text-align: right; margin-top: 3px; }
.fl-msg-check { color: #128C7E; }
.fl-campaign-card { background: white; border-radius: 10px; padding: 10px 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08); font-size: 11px; align-self: flex-start; max-width: 90%; }
.fl-cc-title { font-weight: 800; color: #075E54; font-size: 12px; margin-bottom: 4px; }
.fl-cc-stats { display: flex; gap: 10px; margin-top: 6px; }
.fl-cc-s { text-align: center; }
.fl-cc-n { font-weight: 800; color: #25D366; font-size: 13px; }
.fl-cc-l { font-size: 9px; color: #888; }
.fl-typing { background: white; border-radius: 12px; border-top-left-radius: 3px; padding: 10px 14px; align-self: flex-start; box-shadow: 0 1px 2px rgba(0,0,0,.1); display: flex; align-items: center; gap: 4px; }
.fl-typing span { width: 7px; height: 7px; border-radius: 50%; background: #aaa; animation: fl-typedot 1.2s ease-in-out infinite; }
.fl-typing span:nth-child(2){animation-delay:.2s;} .fl-typing span:nth-child(3){animation-delay:.4s;}
@keyframes fl-typedot{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}
.fl-wa-input-row { background: #f0f2f5; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
.fl-wa-input { flex: 1; background: white; border-radius: 20px; padding: 8px 14px; font-size: 11px; color: #999; border: none; outline: none; }
.fl-wa-send { width: 34px; height: 34px; border-radius: 50%; background: #075E54; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* Floating badges */
.fl-float-card {
  position: absolute; background: white; border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,.12); padding: 12px 16px;
  display: flex; align-items: center; gap: 10px;
  font-size: 12px; font-weight: 700; color: #0b1e12; white-space: nowrap;
}
.fl-fc1 { left: -90px; top: 80px; animation: fl-fl1 3s ease-in-out infinite alternate; }
.fl-fc2 { right: -70px; top: 160px; animation: fl-fl2 3.5s ease-in-out infinite alternate; }
.fl-fc3 { left: -70px; bottom: 120px; animation: fl-fl1 4s ease-in-out infinite alternate-reverse; }
@keyframes fl-fl1{0%{transform:translateY(0);}100%{transform:translateY(-8px);}}
@keyframes fl-fl2{0%{transform:translateY(0);}100%{transform:translateY(8px);}}
.fl-fc-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.fl-fc-sub { font-size: 10px; color: #4d7a62; font-weight: 500; }

/* FEATURES */
.fl-features { padding: 100px 6%; background: white; }
.fl-sec-tag { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #25D366; margin-bottom: 10px; }
.fl-sec-title { font-size: clamp(28px,3.5vw,44px); font-weight: 900; text-align: center; color: #0b1e12; margin-bottom: 14px; letter-spacing: -.8px; }
.fl-sec-sub { text-align: center; color: #4d7a62; font-size: 16px; max-width: 500px; margin: 0 auto 60px; }
.fl-feat-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(290px,1fr)); gap: 22px; max-width: 1080px; margin: 0 auto; }
.fl-feat-card { background: #f3fbf6; border: 1px solid #cde9d8; border-radius: 18px; padding: 30px; transition: all .25s; cursor: default; }
.fl-feat-card:hover { border-color: #25D366; transform: translateY(-4px); box-shadow: 0 12px 32px rgba(37,211,102,.12); }
.fl-fi { width: 50px; height: 50px; border-radius: 14px; background: linear-gradient(135deg,#25D366,#00df6a); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 6px 18px rgba(37,211,102,.3); }
.fl-fi svg { width: 26px; height: 26px; fill: white; stroke: none; }
.fl-feat-card h3 { font-size: 17px; font-weight: 800; color: #0b1e12; margin-bottom: 9px; }
.fl-feat-card p { font-size: 14px; color: #4d7a62; line-height: 1.65; }

/* HOW IT WORKS */
.fl-how { padding: 90px 6%; background: linear-gradient(135deg,#075E54 0%,#0d6b55 100%); position: relative; overflow: hidden; }
.fl-how::before { content: ''; position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,.04); pointer-events: none; }
.fl-how .fl-sec-tag { color: rgba(255,255,255,.6); }
.fl-how .fl-sec-title { color: white; }
.fl-how .fl-sec-sub { color: rgba(255,255,255,.6); }
.fl-steps { display: grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); gap: 24px; max-width: 900px; margin: 0 auto; position: relative; z-index: 1; }
.fl-step { text-align: center; padding: 28px 20px; }
.fl-step-num { width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,.1); border: 2px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #25D366; margin: 0 auto 16px; }
.fl-step h3 { font-size: 16px; font-weight: 800; color: white; margin-bottom: 8px; }
.fl-step p { font-size: 13px; color: rgba(255,255,255,.6); line-height: 1.6; }

/* PRICING */
.fl-pricing { padding: 90px 6%; background: #f3fbf6; }
.fl-plan-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 24px; max-width: 1020px; margin: 0 auto; }
.fl-plan-card {
  background: white; border: 1.5px solid #cde9d8; border-radius: 20px;
  padding: 36px 32px; position: relative; transition: all .25s;
}
.fl-plan-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(37,211,102,.12); }
.fl-plan-card.popular {
  border-color: #25D366; border-width: 2px;
  box-shadow: 0 8px 32px rgba(37,211,102,.15);
  transform: scale(1.03);
}
.fl-plan-card.popular:hover { transform: scale(1.03) translateY(-6px); }
.fl-plan-pop {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg,#25D366,#00df6a);
  color: white; font-size: 11px; font-weight: 900; border-radius: 100px;
  padding: 5px 18px; white-space: nowrap; letter-spacing: .5px;
  box-shadow: 0 4px 12px rgba(37,211,102,.35);
}
.fl-plan-name { font-size: 18px; font-weight: 900; color: #0b1e12; margin-bottom: 8px; }
.fl-plan-price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
.fl-plan-currency { font-size: 22px; font-weight: 800; color: #128C7E; }
.fl-plan-amount { font-size: 48px; font-weight: 900; color: #0b1e12; line-height: 1; letter-spacing: -2px; }
.fl-plan-period { font-size: 14px; color: #4d7a62; }
.fl-plan-custom { font-size: 36px; font-weight: 900; color: #25D366; letter-spacing: -1px; }
.fl-plan-desc { font-size: 13px; color: #4d7a62; margin-bottom: 24px; line-height: 1.6; }
.fl-plan-features { list-style: none; margin-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
.fl-plan-features li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #0b1e12; }
.fl-plan-features li::before { content: '✓'; width: 20px; height: 20px; border-radius: 50%; background: #f0fdf5; color: #25D366; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.fl-plan-btn-outline {
  display: block; width: 100%; padding: 13px; border-radius: 11px;
  border: 1.5px solid #cde9d8; color: #128C7E;
  font-size: 14px; font-weight: 800; text-align: center;
  text-decoration: none; transition: all .2s; background: white; cursor: pointer; font-family: inherit;
}
.fl-plan-btn-outline:hover { border-color: #25D366; background: #f0fdf5; }
.fl-plan-btn-solid {
  display: block; width: 100%; padding: 14px; border-radius: 11px;
  background: linear-gradient(135deg,#25D366,#00df6a);
  color: white; font-size: 14px; font-weight: 900; text-align: center;
  text-decoration: none; border: none; cursor: pointer; font-family: inherit;
  box-shadow: 0 6px 20px rgba(37,211,102,.38); transition: all .2s;
}
.fl-plan-btn-solid:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(37,211,102,.48); }
.fl-plan-sep { height: 1px; background: #e8f5ee; margin-bottom: 16px; }

/* TESTIMONIALS */
.fl-testi { padding: 90px 6%; background: white; }
.fl-testi-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 20px; max-width: 1000px; margin: 0 auto; }
.fl-tcard { background: #f3fbf6; border: 1px solid #cde9d8; border-radius: 16px; padding: 26px; }
.fl-stars { color: #f5c518; font-size: 12px; margin-bottom: 12px; }
.fl-tcard-text { font-size: 14px; color: #0b1e12; line-height: 1.7; margin-bottom: 18px; font-style: italic; }
.fl-tauthor { display: flex; align-items: center; gap: 10px; }
.fl-tav { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: white; flex-shrink: 0; }
.fl-tname { font-size: 13px; font-weight: 800; color: #0b1e12; }
.fl-trole { font-size: 12px; color: #4d7a62; }

/* CTA BANNER */
.fl-cta-banner { padding: 90px 6%; background: linear-gradient(135deg,#07160f 0%,#075E54 100%); text-align: center; position: relative; overflow: hidden; }
.fl-cta-banner::before { content: ''; position: absolute; top: -150px; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle,rgba(37,211,102,.15) 0%,transparent 65%); pointer-events: none; }
.fl-cta-banner h2 { font-size: clamp(28px,4vw,50px); font-weight: 900; color: white; letter-spacing: -1px; margin-bottom: 16px; position: relative; }
.fl-cta-banner p { font-size: 16px; color: rgba(255,255,255,.6); margin-bottom: 36px; position: relative; }

/* FOOTER */
.fl-footer { background: #07160f; padding: 56px 6% 28px; }
.fl-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 48px; }
.fl-footer-tagline { font-size: 13px; color: rgba(255,255,255,.4); margin-top: 10px; line-height: 1.6; max-width: 220px; }
.fl-footer-col h4 { font-size: 12px; font-weight: 800; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; }
.fl-footer-col ul { list-style: none; }
.fl-footer-col li a { font-size: 13px; color: rgba(255,255,255,.6); text-decoration: none; display: block; padding: 4px 0; transition: color .2s; }
.fl-footer-col li a:hover { color: #25D366; }
.fl-footer-bottom { border-top: 1px solid rgba(255,255,255,.08); padding-top: 22px; text-align: center; font-size: 12px; color: rgba(255,255,255,.3); }

@media(max-width:900px){
  .fl-hero { grid-template-columns: 1fr; padding-top: 48px; }
  .fl-hero-right { display: none; }
  .fl-nav-links { display: none; }
  .fl-footer-grid { grid-template-columns: 1fr 1fr; }
  .fl-plan-card.popular { transform: none; }
}
`;

const FreshLanding = () => {
  const { branding } = useBranding();
  const navigate = useNavigate();

  const platformName = branding?.name || import.meta.env.VITE_BRAND_NAME || 'WaDesk';
  const heroTitle = branding?.landingHeroTitle || "India's #1\nWhatsApp API\nPlatform";
  const heroSubtitle = branding?.landingHeroSubtitle || 'Send bulk messages, build chatbots, run campaigns — all from one powerful dashboard. Trusted by 50,000+ growing businesses.';
  const trialDays = branding?.trialDurationDays || 7;
  const trialEnabled = branding?.trialEnabled !== false;
  const ctaText = branding?.trialSignupText || `Start ${trialDays}-Day Free Trial`;

  const heroLines = heroTitle.split('\n');

  const [plans, setPlans] = useState([]);
  const [config, setConfig] = useState({ SYSTEM_CURRENCY: 'INR' });
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/config`).catch(() => ({ data: { SYSTEM_CURRENCY: 'INR' } }));
        setConfig(configRes.data);

        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/plans`);
        setPlans(res.data);
      } catch (error) {
        console.error("Failed fetching plans", error);
      }
    };
    fetchData();
  }, []);

  const cycleMap = { monthly: 30, quarterly: 90, yearly: 365 };
  const filteredPlans = plans.filter(p => p.duration_days === cycleMap[billingCycle]);
  const displayPlans = filteredPlans.length > 0 ? filteredPlans : plans;

  const CYCLES = [
    { key: 'monthly', label: 'Monthly' },
    { key: 'quarterly', label: 'Quarterly', badge: 'Save 10%' },
    { key: 'yearly', label: 'Yearly', badge: 'Save 20%' },
  ];

  const currSymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SAR: 'ر.س ', AED: 'د.إ ', QAR: 'QAR ' };
  const currSym = currSymbols[config.SYSTEM_CURRENCY] || '₹';

  return (
    <div className="fl-landing">
      <style dangerouslySetInnerHTML={{ __html: FL_CSS }} />

      {/* NAV */}
      <nav className="fl-nav">
        <div className="flex items-center gap-3 mr-4">
            {(branding?.freshLogoUrl || branding?.logoUrl) ? (
                <img src={branding.freshLogoUrl || branding.logoUrl} alt="Logo" className="h-10 w-auto max-w-[200px] object-contain" />
            ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20" style={{ background: '#25D366' }}>
                    <Icons.MessageSquare size={20} className="text-white" />
                </div>
            )}
            <span className="fl-logo-name" style={{ marginLeft: '-4px' }}>
              {platformName.includes(' ')
                ? <><span style={{ color: '#075E54' }}>{platformName.split(' ')[0]}</span><em>{platformName.split(' ').slice(1).join(' ')}</em></>
                : platformName
              }
            </span>
        </div>
        <ul className="fl-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#how">How It Works</a></li>
          <li><a href="#testimonials">Reviews</a></li>
        </ul>
        <div className="fl-nav-actions">
          <Link to="/login" className="fl-btn-ghost">Sign In</Link>
          {trialEnabled
            ? <Link to="/register" className="fl-btn-primary">{ctaText} →</Link>
            : <Link to="/register" className="fl-btn-primary">Get Started →</Link>
          }
        </div>
      </nav>

      {/* HERO */}
      <section className="fl-hero">
        <div className="fl-hero-left">
          <div className="fl-hero-badge">
            <span className="fl-live-dot" />
            Official WhatsApp Business API Partner
          </div>
          <h1>
            {heroLines.map((line, i) =>
              i === 1
                ? <span key={i}><span className="grad">{line}</span><br /></span>
                : <span key={i}>{line}<br /></span>
            )}
          </h1>
          <p className="fl-hero-sub">{heroSubtitle}</p>
          <div className="fl-hero-btns">
            <Link to="/register" className="fl-h-btn">
              {trialEnabled ? ctaText : 'Get Started'}
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 18, height: 18 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <a href="#features" className="fl-h-btn-ghost">See Features</a>
          </div>
          <div className="fl-hero-stats">
            <div className="fl-hstat"><div className="fl-hstat-n">50K+</div><div className="fl-hstat-l">Active Businesses</div></div>
            <div className="fl-hstat-div" />
            <div className="fl-hstat"><div className="fl-hstat-n">1B+</div><div className="fl-hstat-l">Messages Sent</div></div>
            <div className="fl-hstat-div" />
            <div className="fl-hstat"><div className="fl-hstat-n">99.9%</div><div className="fl-hstat-l">API Uptime</div></div>
          </div>
        </div>

        {/* PHONE GRAPHIC */}
        <div className="fl-hero-right">
          <div className="fl-float-card fl-fc1">
            <div className="fl-fc-icon" style={{ background: '#e0faf0' }}>📤</div>
            <div><div>1,240 Sent</div><div className="fl-fc-sub">Campaign delivered</div></div>
          </div>
          <div className="fl-float-card fl-fc2">
            <div className="fl-fc-icon" style={{ background: '#e8f0fe' }}>🤖</div>
            <div><div>Bot Active</div><div className="fl-fc-sub">24/7 auto-reply</div></div>
          </div>
          <div className="fl-float-card fl-fc3">
            <div className="fl-fc-icon" style={{ background: '#fff3e0' }}>📈</div>
            <div><div>98% Read Rate</div><div className="fl-fc-sub">vs 22% email avg</div></div>
          </div>

          <div className="fl-phone-frame">
            <div className="fl-phone-notch"><div className="fl-notch-pill" /></div>
            <div className="fl-wa-header">
              <div className="fl-wa-avatar">P</div>
              <div>
                <div className="fl-wa-name">{platformName} Bot</div>
                <div className="fl-wa-online">● online</div>
              </div>
            </div>
            <div className="fl-wa-body">
              <div className="fl-msg fl-msg-in">
                👋 Hi! Welcome to <strong>{platformName}</strong>.<br />How can I help?
                <div className="fl-msg-time">10:01 AM</div>
              </div>
              <div className="fl-msg fl-msg-out">
                I want to send a bulk campaign
                <div className="fl-msg-time">10:02 AM <span className="fl-msg-check">✓✓</span></div>
              </div>
              <div className="fl-campaign-card">
                <div className="fl-cc-title">📊 Campaign Report</div>
                <div style={{ fontSize: '10.5px', color: '#555' }}>Diwali Offer 2024</div>
                <div className="fl-cc-stats">
                  <div className="fl-cc-s"><div className="fl-cc-n">5,200</div><div className="fl-cc-l">Sent</div></div>
                  <div className="fl-cc-s"><div className="fl-cc-n">5,088</div><div className="fl-cc-l">Delivered</div></div>
                  <div className="fl-cc-s"><div className="fl-cc-n">4,916</div><div className="fl-cc-l">Read</div></div>
                  <div className="fl-cc-s"><div className="fl-cc-n">612</div><div className="fl-cc-l">Replied</div></div>
                </div>
              </div>
              <div className="fl-msg fl-msg-in">
                ✅ Your campaign is live!<br />5,200 messages delivered.
                <div className="fl-msg-time">10:04 AM</div>
              </div>
              <div className="fl-typing"><span /><span /><span /></div>
            </div>
            <div className="fl-wa-input-row">
              <div className="fl-wa-input">Type a message…</div>
              <div className="fl-wa-send">
                <svg viewBox="0 0 24 24" fill="white" style={{ width: 16, height: 16 }}><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="fl-features" id="features">
        <div className="fl-sec-tag">Features</div>
        <h2 className="fl-sec-title">Everything Your Business Needs</h2>
        <p className="fl-sec-sub">Powerful tools built for every size — from solo sellers to large enterprises.</p>
        <div className="fl-feat-grid">
          {[
            { title: 'Bulk Messaging', desc: 'Reach thousands of customers instantly with personalized messages, media, and templates in one click.', icon: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { title: 'WhatsApp Chatbot', desc: 'Build smart AI chatbots that handle orders, FAQs, and customer support 24/7 — no coding needed.', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
            { title: 'Campaign Manager', desc: 'Schedule campaigns, segment audiences, and view detailed delivery & conversion analytics in real time.', icon: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
            { title: 'Live Analytics', desc: 'Track open rates, clicks, and conversions in real time. Know exactly what\'s working and what\'s not.', icon: <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            { title: 'Official API & Green Tick', desc: '100% official WhatsApp Business API. Get the verified green tick and higher message limits.', icon: <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
            { title: 'Team Inbox', desc: 'Manage all customer conversations in one shared inbox. Assign, tag, and resolve chats as a team.', icon: <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map((f, i) => (
            <div key={i} className="fl-feat-card">
              <div className="fl-fi"><svg viewBox="0 0 24 24" fill="white">{f.icon.props.children}</svg></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <FreshPricing isEmbedded />

      <section className="fl-testi" id="testimonials">
        <div className="fl-sec-tag">Testimonials</div>
        <h2 className="fl-sec-title">Loved by Businesses Across India</h2>
        <p className="fl-sec-sub">See what our customers are saying about us.</p>
        <div className="fl-testi-grid">
          {[
            { text: `${platformName} has completely transformed how we communicate with customers. Our order confirmations now get 98% read rates!`, name: 'Rahul Kapoor', role: 'Founder, ShopEzy India', initials: 'RK', color: '#e85858' },
            { text: 'The chatbot builder is incredible. We set up our entire support flow in one afternoon. No developer needed!', name: 'Anjali Singh', role: 'CEO, LearnFast EdTech', initials: 'AS', color: '#0077c2' },
            { text: `We run campaigns for 40+ clients using ${platformName}. Best WhatsApp platform in India — period.`, name: 'Priya Mehta', role: 'Director, DigiBoost Agency', initials: 'PM', color: '#7b44d8' },
          ].map((t, i) => (
            <div key={i} className="fl-tcard">
              <div className="fl-stars">★★★★★</div>
              <div className="fl-tcard-text">{t.text}</div>
              <div className="fl-tauthor">
                <div className="fl-tav" style={{ background: t.color }}>{t.initials}</div>
                <div><div className="fl-tname">{t.name}</div><div className="fl-trole">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="fl-cta-banner">
        <h2>Ready to Grow on WhatsApp?</h2>
        <p>Join 50,000+ businesses. {trialEnabled ? `Start your ${trialDays}-day free trial` : 'Get started today'} — no credit card needed.</p>
        <Link to="/register" className="fl-h-btn" style={{ display: 'inline-flex' }}>
          {trialEnabled ? 'Create Free Account' : 'Get Started'}
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 18, height: 18 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="fl-footer">
        <div className="fl-footer-grid">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {(branding?.freshLogoUrl || branding?.logoUrl) ? (
                  <img src={branding.freshLogoUrl || branding.logoUrl} alt="Logo" className="h-8 w-auto max-w-[200px] object-contain" />
              ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20" style={{ background: '#25D366' }}>
                      <Icons.MessageSquare size={16} className="text-white" />
                  </div>
              )}
              <span className="fl-logo-name" style={{ fontSize: 18, color: 'white' }}>{platformName.split(' ')[0]}<em style={{ color: '#25D366' }}>{platformName.split(' ').slice(1).join(' ') || ''}</em></span>
            </div>
            <div className="fl-footer-tagline">{platformName}'s most powerful WhatsApp Business API platform. Automate, engage, and grow.</div>
          </div>
          <div className="fl-footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#how">How It Works</a></li>
            </ul>
          </div>
          <div className="fl-footer-col">
            <h4>Company</h4>
            <ul>
              <li><Link to="/contact" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Contact</Link></li>
            </ul>
          </div>
          <div className="fl-footer-col">
            <h4>Legal</h4>
            <ul>
              {branding?.landingPrivacyPolicy && <li><Link to="/privacy-policy" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Privacy Policy</Link></li>}
              {branding?.landingTermsConditions && <li><Link to="/terms-conditions" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Terms of Service</Link></li>}
              {branding?.landingRefundPolicy && <li><Link to="/refund-policy" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Refund Policy</Link></li>}
            </ul>
          </div>
        </div>
        <div className="fl-footer-bottom">© {new Date().getFullYear()} {platformName}. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default FreshLanding;
