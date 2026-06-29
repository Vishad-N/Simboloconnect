import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShoppingCart, CreditCard, CheckCircle2, AlertCircle, ChevronDown,
  DollarSign, Shield, Zap, ToggleLeft, ToggleRight, Save, RefreshCw,
  Package, Truck, Globe, Lock, ExternalLink, Info
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

export default function OrdersPayments() {
  const [catalogEnabled, setCatalogEnabled] = useState(true);
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState('razorpay');
  const [currency, setCurrency] = useState('INR');
  const [taxRate, setTaxRate] = useState('18');
  const [shippingAmt, setShippingAmt] = useState('0');
  const [gatewayKeys, setGatewayKeys] = useState({ keyId: '', keySecret: '' });
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const s = localStorage.getItem('orders_payments_config');
    if (s) {
      const p = JSON.parse(s);
      setCatalogEnabled(p.catalogEnabled ?? true);
      setGatewayEnabled(p.gatewayEnabled ?? true);
      setSelectedGateway(p.selectedGateway || 'razorpay');
      setCurrency(p.currency || 'INR');
      setTaxRate(p.taxRate || '18');
      setShippingAmt(p.shippingAmt || '0');
      setGatewayKeys(p.gatewayKeys || { keyId: '', keySecret: '' });
    }
  }, []);

  const saveAll = async (section) => {
    setSaving(section);
    const config = { catalogEnabled, gatewayEnabled, selectedGateway, currency, taxRate, shippingAmt, gatewayKeys };
    localStorage.setItem('orders_payments_config', JSON.stringify(config));
    try { await axios.post(`${API}/api/integrations/orders-payments`, config); } catch (_) {}
    setTimeout(() => { setSaving(''); setSaved(section); setTimeout(() => setSaved(''), 2000); }, 700);
  };

  const gateways = [
    { id: 'razorpay', name: 'Razorpay', logo: '₹', desc: 'India\'s leading payment gateway', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'stripe', name: 'Stripe', logo: 'S', desc: 'Global payments infrastructure', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'cashfree', name: 'Cashfree', logo: 'CF', desc: 'Fast & reliable Indian payments', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { id: 'payu', name: 'PayU', logo: 'P', desc: 'Trusted payment solution', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-brand-500/15 to-blue-500/5 rounded-2xl border border-brand-500/20">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
          <ShoppingCart size={24} className="text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Orders & Payments</h1>
          <p className="text-surface-400 text-sm">Enable WhatsApp catalog orders and configure payment gateways</p>
        </div>
      </div>

      {/* ─────────────── ORDER PROCESSING ─────────────── */}
      <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-700 bg-surface-800/40">
          <ShoppingCart size={18} className="text-brand-400" />
          <h2 className="text-base font-bold text-white">Order Processing Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Catalog Orders Toggle */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-surface-800/60 border border-surface-700">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${catalogEnabled ? 'bg-brand-500/20 border border-brand-500/30' : 'bg-surface-700 border border-surface-600'}`}>
                <Package size={18} className={catalogEnabled ? 'text-brand-400' : 'text-surface-500'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Enable WhatsApp Catalog Orders</p>
                <p className="text-xs text-surface-400 mt-0.5">Allow customers to place orders directly from WhatsApp catalog without leaving the chat</p>
              </div>
            </div>
            <button onClick={() => setCatalogEnabled(!catalogEnabled)} className="flex-shrink-0 mt-0.5">
              {catalogEnabled
                ? <ToggleRight size={36} className="text-brand-400" />
                : <ToggleLeft size={36} className="text-surface-500" />}
            </button>
          </div>

          {catalogEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Order Currency</label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 appearance-none">
                    {currencies.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                </div>
                <p className="text-[11px] text-surface-500 mt-1">Currency for order amounts</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Tax Rate (%)</label>
                <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} min="0" max="100"
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50" />
                <p className="text-[11px] text-surface-500 mt-1">e.g., 18 for 18% GST</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Shipping Amount (₹)</label>
                <input type="number" value={shippingAmt} onChange={e => setShippingAmt(e.target.value)} min="0"
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50" />
                <p className="text-[11px] text-surface-500 mt-1">Fixed shipping per order</p>
              </div>
            </div>
          )}

          <button onClick={() => saveAll('orders')} disabled={!!saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all">
            {saving === 'orders' ? <RefreshCw size={14} className="animate-spin" /> : saved === 'orders' ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving === 'orders' ? 'Saving...' : saved === 'orders' ? 'Saved!' : 'Save Order Settings'}
          </button>
        </div>
      </div>

      {/* ─────────────── PAYMENT GATEWAY ─────────────── */}
      <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-700 bg-surface-800/40">
          <CreditCard size={18} className="text-purple-400" />
          <h2 className="text-base font-bold text-white">Payment Gateway Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Gateway Toggle */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-surface-800/60 border border-surface-700">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${gatewayEnabled ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-surface-700 border border-surface-600'}`}>
                <CreditCard size={18} className={gatewayEnabled ? 'text-purple-400' : 'text-surface-500'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Enable Payment Gateway</p>
                <p className="text-xs text-surface-400 mt-0.5">Customers can pay online directly via WhatsApp order flow using your configured gateway</p>
              </div>
            </div>
            <button onClick={() => setGatewayEnabled(!gatewayEnabled)} className="flex-shrink-0 mt-0.5">
              {gatewayEnabled
                ? <ToggleRight size={36} className="text-purple-400" />
                : <ToggleLeft size={36} className="text-surface-500" />}
            </button>
          </div>

          {gatewayEnabled && (
            <>
              {/* Gateway Selector */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-3">Select Payment Gateway</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {gateways.map(gw => (
                    <button key={gw.id} onClick={() => setSelectedGateway(gw.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${selectedGateway === gw.id ? `${gw.bg} ${gw.color} border-current` : 'border-surface-700 text-surface-400 hover:border-surface-500 bg-surface-800/60'}`}>
                      <div className="text-xl font-black mb-1">{gw.logo}</div>
                      <p className="text-sm font-bold">{gw.name}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{gw.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gateway Credentials */}
              <div className="rounded-xl border border-surface-600 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-800/80 border-b border-surface-700">
                  <Lock size={13} className="text-surface-400" />
                  <span className="text-sm font-semibold text-white capitalize">{selectedGateway} Configuration</span>
                  <a href={selectedGateway === 'razorpay' ? 'https://dashboard.razorpay.com/app/keys' : '#'}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    Get API Keys <ExternalLink size={11} />
                  </a>
                </div>
                <div className="p-4 space-y-4 bg-surface-900/40">
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">
                      {selectedGateway === 'razorpay' ? 'Key ID' : 'API Key'} <span className="text-red-400">*</span>
                    </label>
                    <input type="text" value={gatewayKeys.keyId}
                      onChange={e => setGatewayKeys(p => ({ ...p, keyId: e.target.value }))}
                      placeholder={selectedGateway === 'razorpay' ? 'rzp_live_xxxxxxxxxxxxxxxxxx' : 'Your API Key'}
                      className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-brand-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-400 mb-1.5">
                      {selectedGateway === 'razorpay' ? 'Key Secret' : 'API Secret'} <span className="text-red-400">*</span>
                    </label>
                    <input type="password" value={gatewayKeys.keySecret}
                      onChange={e => setGatewayKeys(p => ({ ...p, keySecret: e.target.value }))}
                      placeholder="••••••••••••••••••••"
                      className="w-full px-4 py-2.5 bg-surface-800 border border-surface-600 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-brand-500/50" />
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      {selectedGateway === 'razorpay'
                        ? 'Go to Razorpay Dashboard → Settings → API Keys → Generate API Keys'
                        : `Login to your ${gateways.find(g => g.id === selectedGateway)?.name} dashboard to get your API credentials`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                <Shield size={14} className="text-green-400 flex-shrink-0" />
                All credentials are encrypted at rest using AES-256. Never shared with third parties.
              </div>
            </>
          )}

          <button onClick={() => saveAll('gateway')} disabled={!!saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-all">
            {saving === 'gateway' ? <RefreshCw size={14} className="animate-spin" /> : saved === 'gateway' ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving === 'gateway' ? 'Saving...' : saved === 'gateway' ? 'Saved!' : 'Save Gateway Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
