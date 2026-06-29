import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Edit, Trash2, Users, MessageSquare, Bot, Zap, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const defaultFormData = {
    name: '', price: '', duration_days: '',
    isUnlimited: false,
    message_limit: '1000',
    contacts_limit: '1000',
    campaigns_limit: '60',
    bot_replies_limit: '1000',
    bot_flows_limit: '5',
    team_members_limit: '3',
    featuresText: 'Live Chat Dashboard\nFree Conversations\nCreate Label & Notes\nBusiness Survey Flows\nGoogle Sheets Integration',
    allow_campaigns:    true,
    allow_flow_builder: true,
    allow_ai_brain: true,
    allow_ai_voice: true,
    allow_qna: true,
    allow_ecommerce: true,
    allow_integrations: true,
    allow_team: true,
    is_default_free: false
};

const Plans = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [formData, setFormData] = useState(defaultFormData);
    const [currencySymbol, setCurrencySymbol] = useState('₹');

    const fetchPlans = async () => {
        try {
            const res = await axios.get(`${API}/api/admin/plans`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setPlans(res.data);

            try {
                const settingsRes = await axios.get(`${API}/api/admin/settings`, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SAR: 'ر.س', AED: 'د.إ', QAR: 'QAR ' };
                const code = settingsRes.data.SYSTEM_CURRENCY || 'INR';
                setCurrencySymbol(symbols[code] || `${code} `);
            } catch (err) { /* ignore */ }
        } catch (error) {
            console.error("Failed fetching plans");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                price: parseFloat(formData.price),
                duration_days: parseInt(formData.duration_days, 10),
                features_json: formData.featuresText.split('\n').map(f => f.trim()).filter(f => f.length > 0),
                message_limit:      formData.isUnlimited ? 999999 : (parseInt(formData.message_limit,      10) || 1000),
                contacts_limit:     formData.isUnlimited ? 999999 : (parseInt(formData.contacts_limit,     10) || 1000),
                campaigns_limit:    formData.isUnlimited ? 999999 : (parseInt(formData.campaigns_limit,    10) || 60),
                bot_replies_limit:  formData.isUnlimited ? 999999 : (parseInt(formData.bot_replies_limit,  10) || 1000),
                bot_flows_limit:    formData.isUnlimited ? 999999 : (parseInt(formData.bot_flows_limit,    10) || 5),
                team_members_limit: formData.isUnlimited ? 999999 : (parseInt(formData.team_members_limit, 10) || 3),
                allow_campaigns:    formData.allow_campaigns,
                allow_flow_builder: formData.allow_flow_builder,
                allow_ai_brain:     formData.allow_ai_brain,
                allow_ai_voice:     formData.allow_ai_voice,
                allow_qna:          formData.allow_qna,
                allow_ecommerce:    formData.allow_ecommerce,
                allow_integrations: formData.allow_integrations,
                allow_team:         formData.allow_team,
                is_default_free:    formData.is_default_free
            };

            if (editingPlan) {
                await axios.put(`${API}/api/admin/plans/${editingPlan.id}`, payload, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
            } else {
                await axios.post(`${API}/api/admin/plans`, payload, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error) {
            alert("Failed to save plan.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this plan?")) return;
        try {
            await axios.delete(`${API}/api/admin/plans/${id}`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            fetchPlans();
        } catch (error) { alert("Failed to delete plan"); }
    };

    const openModal = (plan = null) => {
        if (plan) {
            const isUnlimited = (plan.message_limit ?? 1000) >= 999999;
            setEditingPlan(plan);
            setFormData({
                name:               plan.name,
                price:              plan.price.toString(),
                duration_days:      plan.duration_days.toString(),
                isUnlimited:        isUnlimited,
                message_limit:      isUnlimited ? '1000' : (plan.message_limit      ?? 1000).toString(),
                contacts_limit:     isUnlimited ? '1000' : (plan.contacts_limit     ?? 1000).toString(),
                campaigns_limit:    isUnlimited ? '60' : (plan.campaigns_limit    ?? 60).toString(),
                bot_replies_limit:  isUnlimited ? '1000' : (plan.bot_replies_limit  ?? 1000).toString(),
                bot_flows_limit:    isUnlimited ? '5' : (plan.bot_flows_limit    ?? 5).toString(),
                team_members_limit: isUnlimited ? '3' : (plan.team_members_limit ?? 3).toString(),
                featuresText:       (Array.isArray(plan.features_json) ? plan.features_json : []).join('\n'),
                allow_campaigns:    plan.allow_campaigns !== false,
                allow_flow_builder: plan.allow_flow_builder !== false,
                allow_ai_brain:     plan.allow_ai_brain !== false,
                allow_ai_voice:     plan.allow_ai_voice !== false,
                allow_qna:          plan.allow_qna !== false,
                allow_ecommerce:    plan.allow_ecommerce !== false,
                allow_integrations: plan.allow_integrations !== false,
                allow_team:         plan.allow_team !== false,
                is_default_free:    plan.is_default_free === true
            });
        } else {
            setEditingPlan(null);
            setFormData(defaultFormData);
        }
        setIsModalOpen(true);
    };

    const f = formData;
    const sf = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const limitIcon = { message_limit: MessageSquare, contacts_limit: Users, campaigns_limit: MessageSquare, bot_replies_limit: Bot, bot_flows_limit: Zap, team_members_limit: UserCheck };
    const limitLabel = {
        message_limit: 'Messages', contacts_limit: 'Contacts', campaigns_limit: 'Campaigns/Month',
        bot_replies_limit: 'Bot Replies/Month', bot_flows_limit: 'Bot Flows',
        team_members_limit: 'Team Members'
    };

    const durationLabel = (days) => {
        if (days === 30) return '/Monthly';
        if (days === 90) return '/Quarterly';
        if (days === 180) return '/Half-Yearly';
        if (days === 365) return '/Yearly';
        return `/${days}d`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4 w-full flex items-center justify-between">
                    <span className="flex items-center"><Package className="mr-3 text-brand-600" /> Plan Manager</span>
                    <button onClick={() => openModal()} className="btn-primary flex items-center text-sm py-1.5 px-3">
                        <Plus size={16} className="mr-1" /> Add Plan
                    </button>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? <p>Loading plans...</p> : plans.map((plan) => {
                    const featureList = Array.isArray(plan.features_json) ? plan.features_json : [];
                    return (
                        <div key={plan.id} className="glass-card shadow border border-surface-200 p-6 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-bold text-surface-900">{plan.name}</h3>
                                    {plan.is_default_free && (
                                        <span className="bg-brand-100 text-brand-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Free Trial Plan</span>
                                    )}
                                </div>
                                <div className="my-3 flex items-baseline">
                                    <span className="text-3xl font-extrabold tracking-tight text-surface-900">{currencySymbol}{plan.price}</span>
                                    <span className="ml-1 text-sm font-medium text-surface-500">{durationLabel(plan.duration_days)}</span>
                                </div>

                                {/* Structured Limits */}
                                <div className="mt-3 space-y-1.5 bg-surface-50 rounded-lg p-3 border border-surface-200">
                                    <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">Plan Limits (Enforced)</p>
                                    {Object.entries(limitLabel).map(([key, label]) => {
                                        const Icon = limitIcon[key];
                                        const val = plan[key] ?? '—';
                                        return (
                                            <div key={key} className="flex items-center justify-between text-xs text-surface-700">
                                                <span className="flex items-center gap-1.5"><Icon size={12} className="text-brand-500" />{label}</span>
                                                <span className="font-bold text-surface-900">{val >= 999999 ? 'Unlimited' : val}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Feature List */}
                                {featureList.length > 0 && (
                                    <ul className="mt-4 space-y-1.5">
                                        {featureList.map((feature, i) => (
                                            <li key={i} className="flex items-center text-sm text-surface-600">
                                                <svg className="h-4 w-4 text-brand-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Allowed Modules */}
                                <div className="mt-3 pt-3 border-t border-surface-100 grid grid-cols-2 gap-1 text-[11px] text-surface-500">
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_campaigns !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>Bulk Campaigns</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_flow_builder !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>Flow Builder</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_ai_brain !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>AI Brain</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_ai_voice !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>AI Voice</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_qna !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>QnA</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_ecommerce !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>Ecommerce</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_integrations !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>Integrations</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${plan.allow_team !== false ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                        <span>Team Members</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex space-x-3 pt-4 border-t border-surface-100">
                                <button onClick={() => openModal(plan)} className="flex-1 btn-secondary text-sm flex justify-center items-center py-1.5">
                                    <Edit size={14} className="mr-1" /> Edit
                                </button>
                                <button onClick={() => handleDelete(plan.id)} className="flex-1 btn-secondary text-red-600 hover:text-red-700 text-sm flex justify-center items-center py-1.5 border-red-200 hover:bg-red-50">
                                    <Trash2 size={14} className="mr-1" /> Delete
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Plan Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl my-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-surface-900">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-surface-600">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-3">
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Plan Name</label>
                                    <input type="text" required value={f.name} onChange={e => sf('name', e.target.value)} className="input-field" placeholder="Starter Plan" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Price ({currencySymbol})</label>
                                    <input type="number" required value={f.price} onChange={e => sf('price', e.target.value)} className="input-field" placeholder="299" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Billing Cycle (Days)</label>
                                    <input type="number" min="1" required value={f.duration_days} onChange={e => sf('duration_days', e.target.value)} className="input-field" placeholder="e.g. 7, 30, 365" />
                                    <p className="text-xs text-surface-500 mt-1">Enter number of days (e.g., 7 for trial, 30 for monthly, 365 for yearly).</p>
                                </div>
                            </div>

                            {/* Free Trial Toggle */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-blue-800">Set as Default Free Trial Plan</h4>
                                    <p className="text-xs text-blue-600">If enabled, new users can activate this plan for free once.</p>
                                </div>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={f.is_default_free} onChange={e => sf('is_default_free', e.target.checked)} />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${f.is_default_free ? 'bg-blue-500' : 'bg-surface-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${f.is_default_free ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Enforceable Limits */}
                            <div className="border border-brand-200 bg-brand-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs font-bold text-brand-700 uppercase tracking-wider">🔒 Enforced Limits (Backend Controlled)</p>
                                    <label className="flex items-center cursor-pointer">
                                        <span className="text-xs font-medium text-surface-600 mr-2">Unlimited Plan?</span>
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={f.isUnlimited} onChange={e => sf('isUnlimited', e.target.checked)} />
                                            <div className={`block w-10 h-6 rounded-full transition-colors ${f.isUnlimited ? 'bg-brand-500' : 'bg-surface-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${f.isUnlimited ? 'transform translate-x-4' : ''}`}></div>
                                        </div>
                                    </label>
                                </div>
                                {!f.isUnlimited ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(limitLabel).map(([key, label]) => {
                                                const Icon = limitIcon[key];
                                                return (
                                                    <div key={key}>
                                                        <label className="flex items-center gap-1 text-xs font-medium text-surface-700 mb-1">
                                                            <Icon size={12} className="text-brand-500" />{label}
                                                        </label>
                                                        <input type="number" min="0" required value={f[key]} onChange={e => sf(key, e.target.value)}
                                                            className="input-field text-sm" placeholder="Enter limit" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-brand-100/50 border border-brand-200 text-brand-700 p-4 rounded-lg text-sm font-medium text-center">
                                        <span className="block font-bold text-lg mb-1">Unlimited Usage</span>
                                        This plan has no limits for messages, campaigns, contacts, bots, or team members.
                                    </div>
                                )}
                            </div>

                            {/* Feature Toggles */}
                            <div className="border border-surface-200 bg-surface-50 rounded-lg p-4">
                                <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">🛠️ Feature Permissions</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_campaigns} onChange={e => sf('allow_campaigns', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700 font-semibold">📢 Bulk Campaigns</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_flow_builder} onChange={e => sf('allow_flow_builder', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">Flow Builder</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_ai_brain} onChange={e => sf('allow_ai_brain', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">AI Brain</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_ai_voice} onChange={e => sf('allow_ai_voice', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">AI Voice</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_qna} onChange={e => sf('allow_qna', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">QnA</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_ecommerce} onChange={e => sf('allow_ecommerce', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">Ecommerce</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_integrations} onChange={e => sf('allow_integrations', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">Integrations</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer py-1">
                                        <input type="checkbox" checked={f.allow_team} onChange={e => sf('allow_team', e.target.checked)} className="rounded text-brand-500 focus:ring-brand-500" />
                                        <span className="text-surface-700">Team Members</span>
                                    </label>
                                </div>
                            </div>

                            {/* Display Features */}
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Display Features (One per line)</label>
                                <textarea required value={f.featuresText} onChange={e => sf('featuresText', e.target.value)}
                                    className="input-field text-sm" rows="5" placeholder={'Live Chat Dashboard\nFree Conversations\nCreate Label & Notes'} />
                                <p className="text-xs text-surface-500 mt-1">These are shown on the pricing page for marketing purposes.</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-surface-200">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">{editingPlan ? 'Save Changes' : 'Create Plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Plans;
