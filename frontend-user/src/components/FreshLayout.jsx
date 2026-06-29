import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import { io } from 'socket.io-client';
import AccountSettingsModal from './AccountSettingsModal';
import MobileBottomNav from './MobileBottomNav';
import FeatureOverlay from './FeatureOverlay';

const WA_SVG = () => (
  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'white' }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
  </svg>
);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

/* ══ FRESH LIGHT THEME — CSS Variable Remap ══
   Override Tailwind surface-* vars inside .fl-shell so ALL
   Tailwind classes (including opacity: /80 /60 /30) become light.
   This covers full-bleed pages like LiveChat that escape .fl-inner.
   ══════════════════════════════════════════════════════════════ */
.fl-shell {
  --color-surface-950: #f0fdf5;
  --color-surface-900: #ffffff;
  --color-surface-800: #f3fbf6;
  --color-surface-700: #e8f5ee;
  --color-surface-600: #d5eddf;
  --color-surface-500: #7aad8e;
  --color-surface-400: #4d7a62;
  --color-surface-300: #2d5c42;
  --color-surface-200: #1a3825;
  --color-surface-100: #0b1e12;
  --color-surface-50:  #0b1e12;
  --color-brand-500: #25D366;
  --color-brand-400: #00df6a;
  --color-brand-600: #128C7E;
  --color-brand-300: #00b894;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.fl-shell { display: flex; height: 100vh; background: #f3fbf6; overflow: hidden; }

/* ── SIDEBAR ── */
.fl-sidebar {
  width: 230px; flex-shrink: 0;
  background: #0c1610;
  border-right: 1px solid #1e2e22;
  display: flex; flex-direction: column;
  overflow: hidden; position: relative; z-index: 10;
}
.fl-sidebar::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(37,211,102,.06) 1px, transparent 1px);
  background-size: 22px 22px; pointer-events: none;
}
.fl-sidebar::after {
  content: ''; position: absolute; top: -60px; left: -60px;
  width: 220px; height: 220px; border-radius: 50%;
  background: radial-gradient(circle, rgba(37,211,102,.1) 0%, transparent 65%);
  pointer-events: none;
}

/* LOGO */
.fl-logo {
  padding: 22px 20px 18px;
  border-bottom: 1px solid #1e2e22;
  position: relative; z-index: 1;
}
.fl-logo-inner { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.fl-logo-box {
  width: 36px; height: 36px; border-radius: 10px;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  box-shadow: none; flex-shrink: 0;
}
.fl-logo-name { font-size: 17px; font-weight: 900; color: #e8f5ec; letter-spacing: -.2px; }
.fl-logo-name em { color: #25D366; font-style: normal; }

/* NAV */
.fl-nav { flex: 1; padding: 14px 10px; overflow-y: auto; position: relative; z-index: 1; }
.fl-nav::-webkit-scrollbar { width: 0; }
.fl-nav-section { margin-bottom: 6px; }
.fl-nav-label {
  font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
  color: #3d5c46; padding: 8px 10px 4px; margin-top: 8px; display: block;
}
.fl-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 600; color: #6b9478;
  cursor: pointer; transition: all .18s; text-decoration: none;
  position: relative; background: transparent; width: 100%; border: none;
  font-family: inherit;
}
.fl-nav-item:hover {
  background: rgba(255,255,255,0.08);
  color: #e8f5ec;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.07), inset 0 0 12px rgba(255,255,255,0.04);
}
.fl-nav-item.active {
  background: linear-gradient(135deg, rgba(37,211,102,.15), rgba(37,211,102,.06));
  color: #25D366 !important;
  border: 1px solid rgba(37,211,102,.18);
}
.fl-nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
  width: 3px; border-radius: 0 3px 3px 0; background: #25D366;
}
.fl-nav-item svg { width: 17px; height: 17px; flex-shrink: 0; opacity: .85; stroke: #1da851; color: #1da851; }
.fl-nav-item.active svg { opacity: 1; }
.fl-nav-item:hover svg { opacity: 1; filter: drop-shadow(0 0 3px rgba(255,255,255,0.4)); }
.fl-nav-badge {
  margin-left: auto; background: #25D366; color: #075E54;
  font-size: 10px; font-weight: 900; border-radius: 100px; padding: 2px 7px;
}
.fl-nav-arrow { margin-left: auto; font-size: 11px; transition: transform .2s; opacity: .5; }
.fl-nav-item.open .fl-nav-arrow { transform: rotate(90deg); }

/* Sub-menu */
.fl-submenu {
  overflow: hidden; transition: max-height .3s ease, opacity .3s ease;
  max-height: 0; opacity: 0;
}
.fl-submenu.open { max-height: 600px; opacity: 1; }
.fl-submenu-inner { padding: 2px 0 4px 12px; border-left: 2px solid #1e2e22; margin-left: 21px; }
.fl-sub-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 8px;
  font-size: 12px; font-weight: 600; color: #5a7a68;
  text-decoration: none; transition: all .15s;
}
.fl-sub-item:hover { background: rgba(37,211,102,.06); color: #e8f5ec; }
.fl-sub-item.active { color: #25D366; }
.fl-sub-item svg { width: 14px; height: 14px; opacity: .85; stroke: #1da851; color: #1da851; }

/* USER CARD */
.fl-user-card {
  padding: 14px 10px; border-top: 1px solid #1e2e22; position: relative; z-index: 1;
}
.fl-user-inner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,.03); border: 1px solid #1e2e22;
  cursor: pointer; transition: background .2s;
}
.fl-user-inner:hover { background: rgba(255,255,255,.06); }
.fl-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #25D366, #00b894);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; color: #075E54;
  overflow: hidden;
}
.fl-uname { font-size: 12px; font-weight: 800; color: #e8f5ec; }
.fl-ustatus { font-size: 10px; color: #25D366; display: flex; align-items: center; gap: 4px; }
.fl-online-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #25D366;
  display: inline-block; box-shadow: 0 0 5px #25D366;
}

/* ── MAIN ── */
.fl-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* TOPBAR */
.fl-topbar {
  height: 64px; flex-shrink: 0;/* Dropdown Item SVG size fix */
.fl-dd-item span svg { width: 18px !important; height: 18px !important; }
  background: rgba(255,255,255,.95); backdrop-filter: blur(14px);
  border-bottom: 1px solid #cde9d8;
  display: flex; align-items: center; padding: 0 28px; gap: 16px;
  position: sticky; top: 0; z-index: 20;
}
.fl-topbar-title { font-size: 17px; font-weight: 900; color: #0b1e12; flex: 1; }
.fl-topbar-subtitle { color: #4d7a62; font-size: 13px; font-weight: 500; margin-left: 8px; }
.fl-topbar-actions { display: flex; align-items: center; gap: 10px; }
.fl-icon-btn {
  width: 36px; height: 36px; border-radius: 9px;
  background: rgba(37,211,102,.06); border: 1px solid #cde9d8;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all .18s; position: relative; outline: none;
}
.fl-icon-btn:hover { background: rgba(37,211,102,.12); border-color: rgba(37,211,102,.3); }
.fl-icon-btn svg { width: 16px; height: 16px; stroke: #4d7a62; fill: none; stroke-width: 2; }
.fl-icon-btn:hover svg { stroke: #25D366; }
.fl-notif-dot {
  position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: #25D366;
  box-shadow: 0 0 6px #25D366; border: 1.5px solid white;
}
.fl-upgrade-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 9px;
  background: #25D366;
  border: 1px solid #1da851;
  font-size: 12px; font-weight: 800; color: #ffffff;
  cursor: pointer; transition: all .2s; white-space: nowrap;
  font-family: inherit;
  box-shadow: 0 4px 14px rgba(37,211,102,.3);
}
.fl-upgrade-btn:hover { background: #1da851; box-shadow: 0 4px 14px rgba(37,211,102,.5); }

/* ── USER DROPDOWN ── */
.fl-user-dd-wrap { position: relative; }
.fl-user-dd-btn {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 6px 10px; border-radius: 10px; border: 1px solid #cde9d8;
  background: white; transition: all .18s;
}
.fl-user-dd-btn:hover { border-color: #25D366; background: #f0fdf5; }
.fl-user-dd-name { font-size: 13px; font-weight: 700; color: #0b1e12; }
.fl-user-dd-role { font-size: 10px; color: #4d7a62; }
.fl-topbar-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, #25D366, #00b894);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 900; color: #075E54; overflow: hidden;
}
.fl-dropdown {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: white; border: 1px solid #cde9d8; border-radius: 14px;
  padding: 6px; min-width: 180px; box-shadow: 0 12px 36px rgba(0,0,0,.1);
  z-index: 100; animation: fdrop .15s ease;
}
@keyframes fdrop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.fl-dd-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; border-radius: 9px;
  font-size: 13px; font-weight: 600; color: #0b1e12;
  cursor: pointer; transition: background .15s; text-decoration: none;
  background: transparent; border: none; width: 100%; font-family: inherit;
}
.fl-dd-item:hover { background: #f3fbf6; }
.fl-dd-item.danger { color: #e53935; }
.fl-dd-item.danger:hover { background: #fff5f5; }
.fl-dd-sep { height: 1px; background: #cde9d8; margin: 4px 0; }

/* NOTIFICATION PANEL */
.fl-notif-panel {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: white; border: 1px solid #cde9d8; border-radius: 14px;
  width: 320px; box-shadow: 0 12px 36px rgba(0,0,0,.1); z-index: 100;
  animation: fdrop .15s ease; overflow: hidden;
}
.fl-notif-head {
  padding: 14px 16px; border-bottom: 1px solid #cde9d8;
  font-size: 14px; font-weight: 800; color: #0b1e12;
}
.fl-notif-list { max-height: 300px; overflow-y: auto; }
.fl-notif-item {
  padding: 12px 16px; border-bottom: 1px solid #f0fdf5;
  transition: background .15s; cursor: pointer;
}
.fl-notif-item:hover { background: #f3fbf6; }
.fl-notif-item-title { font-size: 13px; font-weight: 700; color: #0b1e12; }
.fl-notif-item-msg { font-size: 11.5px; color: #4d7a62; margin-top: 2px; }
.fl-notif-empty { padding: 32px; text-align: center; color: #7aad8e; font-size: 13px; }

/* CONTENT AREA */
.fl-content { flex: 1; overflow-y: auto; background: #f3fbf6; }
.fl-content::-webkit-scrollbar { width: 4px; }
.fl-content::-webkit-scrollbar-track { background: transparent; }
.fl-content::-webkit-scrollbar-thumb { background: #b8dfc8; border-radius: 4px; }
.fl-inner { padding: 28px; max-width: 1400px; margin: 0 auto; color: #0b1e12; }

/* ── GLOBAL: All right-panel text → deep black ── */
.fl-content p, .fl-content span, .fl-content div, .fl-content li,
.fl-content td, .fl-content th, .fl-content label,
.fl-content h1, .fl-content h2, .fl-content h3,
.fl-content h4, .fl-content h5, .fl-content h6 { color: #0b1e12; }

/* gray-* text overrides */
.fl-shell .text-gray-400, .fl-shell .text-gray-300,
.fl-shell .text-gray-500, .fl-shell .text-gray-600,
.fl-shell .text-slate-400, .fl-shell .text-slate-500,
.fl-shell .text-surface-400, .fl-shell .text-surface-500,
.fl-shell .text-surface-300, .fl-shell .text-surface-600 { color: #0b1e12 !important; }

/* Global text-white override (including hover state) */
.fl-shell .text-white, .fl-shell .text-white0,
.fl-shell .hover\:text-white:hover, .fl-shell .hover\:text-white:focus { color: #0b1e12 !important; }

/* green-accented text stays green */
.fl-shell .text-teal-400, .fl-shell .text-teal-300 { color: #128C7E !important; }
.fl-shell .text-green-400, .fl-shell .text-green-300 { color: #16a34a !important; }
.fl-shell .text-brand-400 { color: #16a34a !important; }

/* ── GLOBAL: Active tab/button → green background ── */
.fl-shell [aria-selected="true"],
.fl-shell [data-active="true"],
.fl-shell .tab-active,
.fl-shell button.active {
  background: linear-gradient(135deg,#25D366,#00df6a) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(37,211,102,.3) !important;
}

/* ── AiBrain internal nav ── */
.fl-shell aside[class*="sidebar"] a[class*="active"],
.fl-shell nav a.active, .fl-shell nav button.active {
  background: linear-gradient(135deg,rgba(37,211,102,.15),rgba(37,211,102,.06)) !important;
  color: #25D366 !important;
}

/* ══════════════════════════════════════════════════════
   FRESH LIGHT — .fl-shell level overrides
   CSS variables handle most things. Below rules handle:
   1. Hardcoded dark values (border-white/5, bg-black/20)
   2. Component-level classes (glass-panel, btn-*, input-field)
   3. Tables, forms, badges, scrollbars
   ══════════════════════════════════════════════════════ */

/* border-white/* → light green border */
.fl-shell [class*="border-white/"] { border-color: rgba(205,233,216,0.8) !important; }

/* bg-black/* → near-transparent light */
.fl-shell [class*="bg-black/"] { background-color: rgba(37,211,102,0.04) !important; }

/* shadow with dark rgba → subtle green shadow */
.fl-shell [class*="shadow-[rgba(0,0,0"] { box-shadow: 0 4px 20px rgba(37,211,102,0.08) !important; }
.fl-shell [class*="shadow-[4px_0_24px_rgba(0,0,0"] { box-shadow: 4px 0 24px rgba(37,211,102,0.08) !important; }

/* Chat message bubbles — inbound (bg-[#151515]) */
.fl-shell [class*="bg-\[#151515\]"] {
  background: #f0fdf5 !important;
  border: 1px solid #cde9d8 !important;
  color: #0b1e12 !important;
}
/* Inbound text-white inside */
.fl-shell [class*="bg-\[#151515\]"] * { color: #0b1e12 !important; }

/* Outbound message read state */
.fl-shell [class*="from-\[#00d9a5\]/20"] {
  background: linear-gradient(135deg, rgba(37,211,102,0.15), rgba(37,211,102,0.05)) !important;
  border-color: rgba(37,211,102,0.25) !important;
}

/* Chat backdrop pattern → light dots */
.fl-shell [style*="radial-gradient(circle at center, rgba(255,255,255,0.02)"] {
  background-image: radial-gradient(circle at center, rgba(37,211,102,0.06) 1px, transparent 1px) !important;
  background-color: #f3fbf6 !important;
}

/* Glass panel */
.fl-shell .glass-panel {
  background: rgba(255,255,255,0.95) !important;
  border: 1px solid #cde9d8 !important;
  box-shadow: 0 4px 24px rgba(37,211,102,0.08) !important;
}

/* Buttons */
.fl-shell .btn-primary {
  background: linear-gradient(135deg, #25D366, #00df6a) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(37,211,102,0.32) !important;
}
.fl-shell .btn-primary:hover { box-shadow: 0 8px 22px rgba(37,211,102,0.45) !important; }
.fl-shell .btn-secondary, .fl-shell .btn-ghost {
  background: #ffffff !important;
  border: 1.5px solid #cde9d8 !important;
  color: #128C7E !important;
}
.fl-shell .btn-secondary:hover, .fl-shell .btn-ghost:hover {
  background: #f0fdf5 !important; border-color: #25D366 !important;
}

/* Input component */
.fl-shell .input-field {
  background: #f3fbf6 !important;
  border: 1.5px solid #cde9d8 !important;
  color: #0b1e12 !important;
}
.fl-shell .input-field:focus {
  border-color: #25D366 !important;
  box-shadow: 0 0 0 3px rgba(37,211,102,0.12) !important;
  background: #ffffff !important;
}

/* All form elements */
.fl-shell input:not([type="checkbox"]):not([type="radio"]):not(.fa-otp-input),
.fl-shell select, .fl-shell textarea {
  background: #f3fbf6 !important;
  border-color: #cde9d8 !important;
  color: #0b1e12 !important;
}
.fl-shell input:focus, .fl-shell select:focus, .fl-shell textarea:focus {
  border-color: #25D366 !important;
  box-shadow: 0 0 0 3px rgba(37,211,102,0.12) !important;
  background: #ffffff !important;
}
.fl-shell input::placeholder, .fl-shell textarea::placeholder { color: #7aad8e !important; }
.fl-shell label { color: #0b1e12 !important; }

/* Tables */
.fl-shell table { background: #ffffff !important; }
.fl-shell thead th { background: #f3fbf6 !important; color: #4d7a62 !important; border-color: #cde9d8 !important; }
.fl-shell tbody td { color: #0b1e12 !important; border-color: #e8f5ee !important; }
.fl-shell tbody tr:hover td { background: #f0fdf5 !important; }

/* Status badges */
.fl-shell .bg-green-900  { background: #dcfce7 !important; }
.fl-shell .text-green-300, .fl-shell .text-green-400 { color: #16a34a !important; }
.fl-shell .bg-red-900    { background: #fee2e2 !important; }
.fl-shell .text-red-300, .fl-shell .text-red-400  { color: #dc2626 !important; }
.fl-shell .bg-yellow-900 { background: #fef9c3 !important; }
.fl-shell .text-yellow-300, .fl-shell .text-yellow-400 { color: #ca8a04 !important; }
.fl-shell .bg-blue-900   { background: #dbeafe !important; }
.fl-shell .text-blue-300, .fl-shell .text-blue-400 { color: #2563eb !important; }

/* Headings */
.fl-shell h1, .fl-shell h2, .fl-shell h3,
.fl-shell h4, .fl-shell h5, .fl-shell h6 { color: #0b1e12 !important; }

/* Scrollbars everywhere in shell */
.fl-shell ::-webkit-scrollbar { width: 4px; height: 4px; }
.fl-shell ::-webkit-scrollbar-track { background: transparent; }
.fl-shell ::-webkit-scrollbar-thumb { background: #b8dfc8; border-radius: 4px; }
.fl-shell ::-webkit-scrollbar-thumb:hover { background: #25D366; }

/* ─── FLOW BUILDER & AI VOICE: Force light theme ─── */
/* Override hardcoded dark backgrounds */
.fl-shell [style*="background: #0d0d0d"],
.fl-shell [style*="background: #111"],
.fl-shell [style*="background: #0c0c0c"],
.fl-shell [style*="background: #0f0f0f"],
.fl-shell [style*="background: #111111"],
.fl-shell [style*="background: #0a0a0a"],
.fl-shell [style*="background: rgb(17"],
.fl-shell [style*="background: rgb(12"],
.fl-shell [style*="background: rgb(15"] { background: #ffffff !important; }

.fl-shell [style*="background: #1a1a1a"],
.fl-shell [style*="background: rgb(26"] { background: #f3fbf6 !important; }

/* Override hardcoded border dark colors */
.fl-shell [style*="borderColor: rgba(255,255,255,0.06)"],
.fl-shell [style*="borderColor: rgba(255,255,255,0.07)"],
.fl-shell [style*="borderColor: rgba(255,255,255,0.08)"],
.fl-shell [style*="borderColor: rgba(255,255,255,0.1)"] { border-color: #cde9d8 !important; }

/* Override text-white and text-surface-* to dark */
.fl-shell .text-white { color: #0b1e12 !important; }
.fl-shell .text-surface-400 { color: #4d7a62 !important; }
.fl-shell .text-surface-500 { color: #7aad8e !important; }
.fl-shell .text-surface-300 { color: #2d5c42 !important; }
.fl-shell .text-surface-600 { color: #7aad8e !important; }

/* bg-surface-* classes */
.fl-shell .bg-surface-800, .fl-shell .bg-surface-900, .fl-shell .bg-surface-950 { background: #ffffff !important; }
.fl-shell .bg-surface-700 { background: #f3fbf6 !important; }
.fl-shell .bg-surface-800\/50, .fl-shell .bg-surface-800\/80 { background: rgba(243,251,246,0.8) !important; }

/* border-surface-* classes */
.fl-shell .border-surface-700, .fl-shell .border-surface-800 { border-color: #cde9d8 !important; }

/* Flow card hover */
.fl-shell .hover\:border-brand-500\/30:hover { border-color: rgba(37,211,102,0.5) !important; }
.fl-shell .hover\:bg-white\/\[0\.02\]:hover { background: #f0fdf5 !important; }

/* AI Voice tabs */
.fl-shell [style*="background: rgba(255,255,255,0.05)"],
.fl-shell [style*="background:rgba(255,255,255,0.05)"] { background: #f0fdf5 !important; color: #0b1e12 !important; }
.fl-shell [style*="background: rgba(0,0,0,0.3)"],
.fl-shell [style*="background:rgba(0,0,0,0.3)"],
.fl-shell [style*="background: rgba(0,0,0,0.2)"] { background: #f3fbf6 !important; }

/* AI Voice stat cards */
.fl-shell [style*="background: rgba(255,255,255,0.03)"],
.fl-shell [style*="background:rgba(255,255,255,0.03)"] { background: #ffffff !important; border: 1px solid #cde9d8 !important; }

/* Fix: text-white inside dark cards */
.fl-shell p, .fl-shell span:not(.fl-nav-badge):not(.fl-online-dot):not(.fl-notif-dot) { color: inherit; }

/* Mobile */
@media(max-width: 900px) {
  .fl-sidebar { display: none; }
  .fl-topbar { padding: 0 16px; }
  .fl-inner { padding: 16px 16px 80px; }
}
`;


// SVG icons (inline to avoid lucide dependency in this component)
const icons = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  campaigns: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  templates: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  contacts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  flow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  ai: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  voice: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4a2 2 0 0 1 1.99-2.18H6.5a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.07 6.07l1.32-1.32a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  qna: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ecom: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  integrations: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  team: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  plans: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  webhook: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  profile: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  help: <svg viewBox="0 0 24 24" fill="none" stroke="#e57373" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  logout: <svg viewBox="0 0 24 24" fill="none" stroke="#e57373" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
  accsettings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 11h4v2h-4z" /></svg>,
};

const NavItem = ({ to, icon, label, badge, end: endProp }) => (
  <NavLink
    to={to}
    end={endProp}
    className={({ isActive }) => `fl-nav-item${isActive ? ' active' : ''}`}
  >
    {icon}
    {label}
    {badge > 0 && <span className="fl-nav-badge">{badge}</span>}
  </NavLink>
);

const SubItem = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `fl-sub-item${isActive ? ' active' : ''}`}
  >
    {icon}
    {label}
  </NavLink>
);

const FreshLayout = () => {
  const { branding, activeTheme, setUserThemePreference } = useBranding();
  const [user, setUser] = useState({ name: '', role: 'Connected', logo: '' });
  const [accountDetails, setAccountDetails] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [config, setConfig] = useState(null);
  const [ecomOpen, setEcomOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const ddRef = useRef(null);
  const notifRef = useRef(null);

  // Auto-open/close submenus on route change
  useEffect(() => {
    setEcomOpen(location.pathname.startsWith('/ecommerce'));
    setIntOpen(location.pathname.startsWith('/integrations'));
    setVoiceOpen(location.pathname.startsWith('/ai-voice'));
  }, [location.pathname]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/account`);
        if (res.data) {
          setAccountDetails(res.data);
          setUser({ name: res.data.name || 'User', role: res.data.role || 'Connected', logo: res.data.logo || '' });
        }
      } catch (e) {}
    };
    const fetchNotifs = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/account/notifications`);
        setNotifications(res.data || []);
      } catch (e) {}
    };
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/public/config`);
        setConfig(res.data);
      } catch (e) {}
    };
    fetchUser();
    fetchNotifs();
    fetchConfig();

    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) {
      const socket = io(import.meta.env.VITE_API_URL || '');
      socket.on('connect', () => socket.emit('join_tenant', tenantId));
      socket.on('new_notification', n => setNotifications(p => [n, ...p]));
      return () => socket.disconnect();
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('tenantId');
    navigate('/login');
  };

  const handleReadNotif = async (id) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL || ''}/api/account/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Page title from location
  const pageTitles = {
    '/dashboard': ['Dashboard', 'WhatsApp Business API Overview'],
    '/chatbot/visual-flows': ['Flow Builder', 'Visual automation flow creator'],
    '/ai-brain': ['AI Brain', 'Manage knowledge base'],
    '/chatbot/flows': ['QnA', 'Simple question answering'],
    '/ai-voice/providers': ['Voice Providers', 'Configure voice integrations'],
    '/ai-voice/agents': ['Voice Agents', 'Manage AI voice agents'],
    '/ai-voice/campaigns': ['Voice Campaigns', 'Run outbound voice campaigns'],
    '/ai-voice/reports': ['Voice Reports', 'View call analytics'],
    '/chat': ['Live Chat', 'Manage customer conversations'],
    '/campaigns': ['Campaigns', 'Bulk messaging & broadcasts'],
    '/templates': ['Templates', 'WhatsApp message templates'],
    '/contacts': ['Contacts', 'Your customer database'],
    '/analytics': ['Analytics', 'Performance & insights'],
    '/ecommerce': ['Ecommerce', 'Store & orders management'],
    '/integrations': ['Integrations', 'Connect external tools'],
    '/team': ['Team', 'Manage your team members'],
    '/plans': ['Plans', 'Subscription & billing'],
    '/webhook': ['Webhook', 'API & webhook settings'],
    '/profile': ['Profile', 'Your account details'],
    '/settings': ['Settings', 'WhatsApp & account configuration'],
    '/wallet/logs': ['Wallet Logs', 'Transaction history'],
    '/admin/ai-center': ['AI Control Center', 'AI management'],
  };
  // Sort keys by length descending to match longest path first
  const titleEntry = Object.entries(pageTitles)
    .sort(([a], [b]) => b.length - a.length)
    .find(([k]) => location.pathname.startsWith(k));
  const [pageTitle, pageSubtitle] = titleEntry ? titleEntry[1] : ['Dashboard', 'Overview'];

  const isAdmin = user.role === 'SUPERADMIN' || user.role === 'ADMIN' || user.role === 'ADMIN_STAFF';
  const isStaff = user.role === 'STAFF';

  return (
    <div className="fl-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ─────── SIDEBAR ─────── */}
      <aside className="fl-sidebar">
        {/* Logo */}
        <div className="fl-logo">
          <a className="fl-logo-inner" href="/dashboard">
            <div className="fl-logo-box">
              {branding?.freshLogoUrl
                ? <img src={branding.freshLogoUrl} alt="Logo" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                : branding?.logoUrl
                  ? <img src={branding.logoUrl} alt="Logo" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                  : <WA_SVG />
              }
            </div>
            <span className="fl-logo-name">
              {branding?.name ? branding.name : <><span style={{ color: '#e8f5ec' }}>Prebuilt</span><em>API</em></>}
            </span>
          </a>
        </div>

        {/* Nav */}
        <nav className="fl-nav">
          {/* CORE */}
          <div className="fl-nav-section">
            <NavItem to="/dashboard" icon={icons.dashboard} label="Dashboard" end />
            <NavItem to="/chat" icon={icons.chat} label="Live Chat" />
            <NavItem to="/campaigns" icon={icons.campaigns} label="Campaigns" />
            <NavItem to="/templates" icon={icons.templates} label="Templates" />
            <NavItem to="/contacts" icon={icons.contacts} label="Contacts" />
          </div>

          {/* AUTOMATION */}
          <div className="fl-nav-section">
            <span className="fl-nav-label">Automation</span>
            <NavItem to="/chatbot/visual-flows" icon={icons.flow} label="Flow Builder" />
            <NavItem to="/ai-brain" icon={icons.ai} label="AI Brain" />
            
            <button
              className={`fl-nav-item${location.pathname.startsWith('/ai-voice') ? ' active' : ''}${voiceOpen ? ' open' : ''}`}
              onClick={() => setVoiceOpen(o => !o)}
            >
              {icons.voice}
              AI Voice
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto opacity-50"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div className={`fl-submenu${voiceOpen ? ' open' : ''}`}>
              <div className="fl-submenu-inner">
                <SubItem to="/ai-voice/providers" icon={icons.settings} label="Providers" />
                <SubItem to="/ai-voice/agents" icon={icons.team} label="Agents" />
                <SubItem to="/ai-voice/campaigns" icon={icons.campaigns} label="Campaigns" />
                <SubItem to="/ai-voice/reports" icon={icons.analytics} label="Reports" />
                <SubItem to="/ai-voice/developer-hub" icon={icons.webhook} label="Developer Hub" />
              </div>
            </div>

            <NavItem to="/chatbot/flows" icon={icons.qna} label="QnA" />
          </div>

          {/* MANAGE */}
          {!isStaff && (
            <div className="fl-nav-section">
              <span className="fl-nav-label">Manage</span>

              {/* Ecommerce collapsible */}
              <button
                className={`fl-nav-item${location.pathname.startsWith('/ecommerce') ? ' active' : ''}${ecomOpen ? ' open' : ''}`}
                onClick={() => setEcomOpen(o => !o)}
              >
                {icons.ecom}
                Ecommerce
                <span className="fl-nav-arrow">›</span>
              </button>
              <div className={`fl-submenu${ecomOpen ? ' open' : ''}`}>
                <div className="fl-submenu-inner">
                  {[
                    ['/ecommerce/overview', 'Overview', icons.analytics],
                    ['/ecommerce/stores', 'Stores', icons.ecom],
                    ['/ecommerce/orders', 'Orders', icons.campaigns],
                    ['/ecommerce/customers', 'Customers', icons.contacts],
                    ['/ecommerce/products', 'Products', icons.templates],
                    ['/ecommerce/abandoned-carts', 'Abandoned Carts', icons.webhook],
                    ['/ecommerce/campaigns', 'Campaigns', icons.campaigns],
                    ['/ecommerce/automations', 'Automations', icons.flow],
                    ['/ecommerce/templates', 'Templates', icons.templates],
                    ['/ecommerce/analytics', 'Analytics', icons.analytics],
                  ].map(([path, label, icon]) => (
                    <SubItem key={path} to={path} icon={icon} label={label} />
                  ))}
                </div>
              </div>

              {/* Integrations collapsible */}
              <button
                className={`fl-nav-item${location.pathname.startsWith('/integrations') ? ' active' : ''}${intOpen ? ' open' : ''}`}
                onClick={() => setIntOpen(o => !o)}
              >
                {icons.integrations}
                Integrations
                <span className="fl-nav-arrow">›</span>
              </button>
              <div className={`fl-submenu${intOpen ? ' open' : ''}`}>
                <div className="fl-submenu-inner">
                  <SubItem to="/integrations/api-webhook" icon={icons.webhook} label="API & Webhook" />
                  <SubItem to="/integrations/sheets" icon={icons.templates} label="Sheets" />
                </div>
              </div>

              <NavItem to="/team" icon={icons.team} label="Team" />
              <NavItem to="/plans" icon={icons.plans} label="Plans" />
              <NavItem to="/webhook" icon={icons.webhook} label="Webhook" />
            </div>
          )}

          {/* ACCOUNT */}
          <div className="fl-nav-section">
            <span className="fl-nav-label">Account</span>
            <NavItem to="/profile" icon={icons.profile} label="Profile" />
            <NavItem to="/settings" icon={icons.settings} label="Settings" />
            {config?.WALLET_MANAGEMENT_ENABLED === 'true' && (
              <NavItem to="/wallet/logs" icon={icons.wallet} label="Wallet Logs" />
            )}

              <a
                href={branding?.supportPhoneNumber ? `https://wa.me/${branding.supportPhoneNumber.replace(/[^0-9]/g, '')}?text=Hi%2C%20I%20need%20help` : '#'}
                target={branding?.supportPhoneNumber ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="fl-nav-item"
                style={{ color: '#e57373' }}
              >
                {icons.help}
                Need Help?
              </a>
          </div>
        </nav>

        {/* User card */}
        <div className="fl-user-card">
          <div className="fl-user-inner" onClick={() => setIsModalOpen(true)}>
            <div className="fl-avatar">
              {user.logo
                ? <img src={user.logo} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user.name?.charAt(0)?.toUpperCase() || 'U')
              }
            </div>
            <div>
              <div className="fl-uname">{user.name || 'User'}</div>
              <div className="fl-ustatus">
                <span className="fl-online-dot" />
                Connected
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─────── MAIN ─────── */}
      <div className="fl-main">
        {/* Topbar */}
        <div className="fl-topbar">
          <div className="fl-topbar-title">
            {pageTitle}
            <span className="fl-topbar-subtitle">{pageSubtitle}</span>
          </div>

          <div className="fl-topbar-actions">
            {/* Theme Toggle */}
            <button 
              className="fl-icon-btn flex items-center justify-center" 
              onClick={() => setUserThemePreference(activeTheme === 'fresh' ? 'classic' : 'fresh')}
              title={activeTheme === 'fresh' ? "Switch to Dark Theme" : "Switch to Light Theme"}
            >
              {activeTheme === 'fresh' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Upgrade button */}
            <button className="fl-upgrade-btn" onClick={() => navigate('/plans')}>
              <span style={{ display: 'flex', alignItems: 'center', width: 13, height: 13 }}>{icons.star}</span>
              Renew / Upgrade
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button className="fl-icon-btn" onClick={() => setNotifOpen(o => !o)} title="Notifications">
                {icons.bell}
                {unreadCount > 0 && <span className="fl-notif-dot" />}
              </button>
              {notifOpen && (
                <div className="fl-notif-panel">
                  <div className="fl-notif-head">
                    Notifications {unreadCount > 0 && <span style={{ color: '#25D366', fontSize: 12 }}>({unreadCount} new)</span>}
                  </div>
                  <div className="fl-notif-list">
                    {notifications.length === 0
                      ? <div className="fl-notif-empty">No notifications</div>
                      : notifications.map(n => (
                        <div
                          key={n.id}
                          className="fl-notif-item"
                          style={{ opacity: n.isRead ? 0.6 : 1 }}
                          onClick={() => !n.isRead && handleReadNotif(n.id)}
                        >
                          <div className="fl-notif-item-title" style={{ fontWeight: n.isRead ? 600 : 800 }}>{n.title}</div>
                          <div className="fl-notif-item-msg">{n.message}</div>
                          <div style={{ fontSize: 10, color: '#7aad8e', marginTop: 4 }}>{new Date(n.createdAt).toLocaleDateString()}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <div className="fl-user-dd-wrap" ref={ddRef}>
              <div className="fl-user-dd-btn" onClick={() => setDdOpen(o => !o)}>
                <div className="fl-topbar-avatar">
                  {user.logo
                    ? <img src={user.logo} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : (user.name?.charAt(0)?.toUpperCase() || 'U')
                  }
                </div>
                <div>
                  <div className="fl-user-dd-name">{user.name || 'User'}</div>
                  <div className="fl-user-dd-role">{user.role || 'Connected'}</div>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="#4d7a62" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {ddOpen && (
                <div className="fl-dropdown">
                  <button className="fl-dd-item" onClick={() => { setIsModalOpen(true); setDdOpen(false); }}>
                    <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icons.accsettings}</span>
                    Account Settings
                  </button>
                  <button className="fl-dd-item" onClick={() => { navigate('/profile'); setDdOpen(false); }}>
                    <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icons.profile}</span>
                    Profile
                  </button>
                  <div className="fl-dd-sep" />
                  <button className="fl-dd-item danger" onClick={handleLogout}>
                    <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icons.logout}</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="fl-content">
          <div className="fl-inner">
            {(() => {
              const isSuperAdmin = accountDetails?.role === 'SUPERADMIN';
              // EXPIRED: user previously had a plan, now expired
              const isExpired = accountDetails &&
                  accountDetails.validityExpiresAt !== null &&
                  new Date(accountDetails.validityExpiresAt) < new Date();
              // NO_PLAN: fresh user / paid plan awaiting payment
              const hasNoPlan = accountDetails &&
                  !accountDetails.validityExpiresAt &&
                  accountDetails.role !== 'SUPERADMIN';
              const pathname = location.pathname;

              const allowedPathPrefixes = [
                '/dashboard', '/plans', '/chat', '/live-chat', '/profile', '/settings', '/wallet', '/payment'
              ];
              const isPathAllowedUnderExpiry = allowedPathPrefixes.some(pref => pathname.startsWith(pref));

              let featureLockName = null;
              if (accountDetails && accountDetails.plan && !isSuperAdmin) {
                const plan = accountDetails.plan;
                if (pathname.startsWith('/campaigns') && plan.allow_campaigns === false) {
                  featureLockName = 'Bulk Campaigns';
                } else if (pathname.includes('/chatbot/visual-flows') && plan.allow_flow_builder === false) {
                  featureLockName = 'Flow Builder';
                } else if (pathname.includes('/ai-brain') && plan.allow_ai_brain === false) {
                  featureLockName = 'AI Brain';
                } else if (pathname.includes('/ai-voice') && plan.allow_ai_voice === false) {
                  featureLockName = 'AI Voice';
                } else if ((pathname.includes('/qna') || pathname.includes('/chatbot/autoreplies') || pathname.includes('/chatbot/flows')) && plan.allow_qna === false) {
                  featureLockName = 'QnA / Bot Replies';
                } else if (pathname.includes('/ecommerce') && plan.allow_ecommerce === false) {
                  featureLockName = 'Ecommerce Integration';
                } else if (pathname.includes('/integrations') && plan.allow_integrations === false) {
                  featureLockName = 'Integrations';
                } else if (pathname.includes('/team') && plan.allow_team === false) {
                  featureLockName = 'Team Members';
                }
              }

              const showExpiredBlock = isExpired && !isPathAllowedUnderExpiry && !isSuperAdmin;
              const showNoPlanBlock = hasNoPlan && !isPathAllowedUnderExpiry && !isSuperAdmin;
              const showFeatureBlock = !isExpired && !hasNoPlan && featureLockName !== null && !isSuperAdmin;

              if (showExpiredBlock) {
                return <FeatureOverlay reason="EXPIRED" account={accountDetails} />;
              }
              if (showNoPlanBlock) {
                return <FeatureOverlay reason="NO_PLAN" account={accountDetails} />;
              }
              if (showFeatureBlock) {
                return <FeatureOverlay reason="FEATURE_LOCKED" featureName={featureLockName} account={accountDetails} />;
              }
              return <Outlet />;
            })()}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav (reuse existing) */}
      <MobileBottomNav user={user} />

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={(u) => setUser({ name: u.name || user.name, logo: u.logo || user.logo, role: user.role })}
      />
    </div>
  );
};

export default FreshLayout;
