import React, { useState } from 'react';
import { ShoppingCart, RefreshCw, MessageSquare, AlertTriangle, CheckCircle2, Clock, X, TrendingUp, RotateCcw, DollarSign, Percent, Send } from 'lucide-react';

const mockCarts = [];

const statusCfg = {
  pending:   { label: 'Pending',   color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20',  icon: Clock },
  recovered: { label: 'Recovered', color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20',  icon: CheckCircle2 },
  expired:   { label: 'Expired',   color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20',    icon: AlertTriangle },
};

const reminderSequence = [
  { step: 1, delay: '30 minutes', message: '🛒 Hey {{name}}, you left something behind! Complete your order and enjoy FREE shipping.', template: 'cart_reminder_1' },
  { step: 2, delay: '6 hours',    message: '⏳ {{name}}, your cart is about to expire! Use code SAVE10 for 10% OFF your order.', template: 'cart_reminder_2' },
  { step: 3, delay: '24 hours',   message: '🎁 Last chance {{name}}! Your cart expires soon. Here\'s a special 15% discount just for you.', template: 'cart_reminder_3' },
];

export default function EcommerceAbandonedCarts() {
  const [carts, setCarts] = useState(mockCarts);
  const [sending, setSending] = useState({});
  const [tab, setTab] = useState('carts'); // carts | settings
  const [settings, setSettings] = useState({ enabled: true, delay1: 30, delay2: 360, delay3: 1440, coupon1: '', coupon2: 'SAVE10', coupon3: 'SAVE15' });

  const pending = carts.filter(c => c.status === 'pending').length;
  const recovered = carts.filter(c => c.status === 'recovered').length;
  const recoveredVal = carts.filter(c => c.status === 'recovered').reduce((a, c) => a + c.value, 0);
  const total = carts.reduce((a, c) => a + c.value, 0);
  const rate = ((recovered / carts.length) * 100).toFixed(1);

  const sendReminder = async (cartId, step) => {
    const key = `${cartId}_${step}`;
    setSending(p => ({ ...p, [key]: true }));
    await new Promise(r => setTimeout(r, 1200));
    setSending(p => { const n = { ...p }; delete n[key]; return n; });
    setCarts(prev => prev.map(c => c.id === cartId ? { ...c, reminders: c.reminders + 1 } : c));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <RotateCcw size={18} className="text-amber-400" />
            </div>
            Abandoned Carts
          </h1>
          <p className="text-surface-400 text-sm mt-1">Recover lost revenue with automated WhatsApp reminders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('carts')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'carts' ? 'bg-brand-500 text-white' : 'border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800'}`}>
            Carts
          </button>
          <button onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'settings' ? 'bg-brand-500 text-white' : 'border border-surface-600 text-surface-300 hover:text-white hover:bg-surface-800'}`}>
            Settings
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Carts', val: carts.length, color: '#818cf8', sub: 'detected' },
          { label: 'Pending Recovery', val: pending, color: '#f59e0b', sub: 'waiting' },
          { label: 'Recovered', val: recovered, color: '#10b981', sub: `₹${recoveredVal.toLocaleString()} revenue` },
          { label: 'Recovery Rate', val: `${rate}%`, color: '#06b6d4', sub: 'of all carts' },
        ].map(s => (
          <div key={s.label} className="glass-panel p-4 rounded-xl border border-surface-700">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
            <p className="text-sm text-surface-400 mt-1">{s.label}</p>
            <p className="text-xs text-surface-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {tab === 'carts' ? (
        <div className="space-y-4">
          {/* Recovery Banner */}
          <div className="glass-panel p-4 rounded-xl border border-brand-500/20 bg-brand-500/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center"><TrendingUp size={16} className="text-brand-400" /></div>
              <div>
                <p className="text-sm font-semibold text-white">Recovery automation is <span className="text-brand-400">Active</span></p>
                <p className="text-xs text-surface-400">3-step reminder sequence • 3 carts pending</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-surface-400">Recovered:</span>
              <span className="font-bold text-brand-400">₹{recoveredVal.toLocaleString()}</span>
            </div>
          </div>

          {/* Carts Table */}
          <div className="glass-panel rounded-2xl border border-surface-700 overflow-hidden bg-white">
            {carts.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center text-surface-400">
                <AlertTriangle size={48} className="opacity-20 mb-4 text-surface-400" />
                <p className="text-xl font-bold" style={{ color: '#0b1e12' }}>No Abandoned Carts</p>
                <p className="text-sm mt-2 max-w-sm mx-auto">We're actively monitoring your store. When a customer abandons checkout, it will appear here.</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-800/50">
                    {['Customer', 'Cart Value', 'Products', 'Abandoned', 'Reminders', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-surface-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {carts.map(c => {
                    const sc = statusCfg[c.status];
                    const SIcon = sc.icon;
                    return (
                      <tr key={c.id} className="hover:bg-surface-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-surface-100">{c.customer}</p>
                          <p className="text-xs text-surface-500">{c.phone}</p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-bold text-white">₹{c.value.toLocaleString()}</p>
                          <p className="text-xs text-surface-500">{c.items} items</p>
                        </td>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          <p className="text-xs text-surface-400 truncate">{c.product}</p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-400">{c.abandonedAt}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${c.reminders >= i ? 'bg-brand-500/20 border-brand-500/40 text-brand-400' : 'bg-surface-800 border-surface-700 text-surface-600'}`}>{i}</div>
                            ))}
                          </div>
                          {c.nextReminder && <p className="text-[10px] text-surface-500 mt-1">Next: {c.nextReminder}</p>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.color} ${sc.bg} ${sc.border}`}>
                            <SIcon size={11} /> {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {c.status === 'pending' && (
                            <button onClick={() => sendReminder(c.id, c.reminders + 1)}
                              disabled={!!sending[`${c.id}_${c.reminders + 1}`]}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-400 hover:bg-brand-500/20 transition-all">
                              {sending[`${c.id}_${c.reminders + 1}`] ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                              Send Reminder {c.reminders + 1}
                            </button>
                          )}
                          {c.status === 'recovered' && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} /> Recovered</span>}
                          {c.status === 'expired' && <span className="text-xs text-red-400">Expired</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Reminder Sequence Preview */}
          <div className="glass-panel p-5 rounded-xl border border-surface-700">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-400" /> Reminder Sequence
            </h3>
            <div className="space-y-3">
              {reminderSequence.map((r, i) => (
                <div key={r.step} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">{r.step}</div>
                    {i < reminderSequence.length - 1 && <div className="w-0.5 h-8 bg-surface-700 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-surface-200">Step {r.step}</span>
                      <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">After {r.delay}</span>
                    </div>
                    <p className="text-xs text-surface-400 leading-relaxed bg-surface-800 rounded-xl p-3 border border-surface-700">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl border border-surface-700 space-y-6">
          <h3 className="text-lg font-bold text-white">Automation Settings</h3>
          
          <div className="flex items-center justify-between p-4 bg-surface-800 rounded-xl border border-surface-700">
            <div>
              <p className="font-semibold text-white">Enable Cart Recovery</p>
              <p className="text-sm text-surface-400">Automatically send WhatsApp reminders for abandoned carts</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, enabled: !p.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-all ${settings.enabled ? 'bg-brand-500' : 'bg-surface-600'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200 ${settings.enabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-surface-300">Reminder Timing</h4>
            {[
              { step: 1, label: 'First Reminder', key: 'delay1', unit: 'minutes' },
              { step: 2, label: 'Second Reminder', key: 'delay2', unit: 'minutes' },
              { step: 3, label: 'Final Reminder', key: 'delay3', unit: 'minutes' },
            ].map(r => (
              <div key={r.step} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm">{r.step}</div>
                <div className="flex-1">
                  <p className="text-sm text-surface-300">{r.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={settings[r.key]}
                    onChange={e => setSettings(p => ({ ...p, [r.key]: e.target.value }))}
                    className="w-24 bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-brand-500/50" />
                  <span className="text-sm text-surface-400">{r.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-surface-300">Discount Coupons</h4>
            {[
              { step: 1, label: 'Step 1 Coupon (Optional)', key: 'coupon1' },
              { step: 2, label: 'Step 2 Coupon', key: 'coupon2' },
              { step: 3, label: 'Step 3 Coupon (Best Offer)', key: 'coupon3' },
            ].map(r => (
              <div key={r.key} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-surface-300 font-bold text-sm">{r.step}</div>
                <div className="flex-1">
                  <p className="text-sm text-surface-300">{r.label}</p>
                </div>
                <input type="text" value={settings[r.key]} placeholder="e.g. SAVE10"
                  onChange={e => setSettings(p => ({ ...p, [r.key]: e.target.value }))}
                  className="w-32 bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500/50" />
              </div>
            ))}
          </div>

          <button className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-all">
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}
