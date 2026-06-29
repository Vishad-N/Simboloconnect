import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserPlus, Edit, Trash2, Shield, CheckSquare, Square, X } from 'lucide-react';

// All features available in the user panel
const ALL_PERMISSIONS = [
    { key: 'MANAGE_CHAT',         label: 'Live Chat',           desc: 'Access & reply to live chats',          category: 'Core' },
    { key: 'MANAGE_CAMPAIGNS',    label: 'Campaigns',           desc: 'Create & send bulk campaigns',          category: 'Core' },
    { key: 'MANAGE_TEMPLATES',    label: 'Templates',           desc: 'Create & manage message templates',     category: 'Core' },
    { key: 'MANAGE_CONTACTS',     label: 'Contacts',            desc: 'View & manage contact list',            category: 'Core' },
    { key: 'MANAGE_WEBHOOK',      label: 'Webhook',             desc: 'Manage webhook integrations',           category: 'Advanced' },
    { key: 'MANAGE_FLOW_BUILDER', label: 'Flow Builder',        desc: 'Build & publish chatbot flows',         category: 'Advanced' },
    { key: 'MANAGE_QNA',          label: 'Q&A / Auto Reply',    desc: 'Manage auto-reply rules',               category: 'Advanced' },
    { key: 'MANAGE_AI_BRAIN',     label: 'AI Brain',            desc: 'Configure AI knowledge base',           category: 'Advanced' },
    { key: 'MANAGE_ECOMMERCE',    label: 'Ecommerce',           desc: 'Manage stores, orders & products',      category: 'Ecommerce' },
    { key: 'MANAGE_INTEGRATIONS', label: 'Integrations',        desc: 'API, Webhooks & Google Sheets',         category: 'Ecommerce' },
    { key: 'MANAGE_PLANS',        label: 'Plans & Billing',     desc: 'View & manage subscription plans',      category: 'Account' },
    { key: 'MANAGE_PROFILE',      label: 'Profile Settings',    desc: 'Update business profile & avatar',      category: 'Account' },
];

const CATEGORIES = ['Core', 'Advanced', 'Ecommerce', 'Account'];

const CATEGORY_COLORS = {
    Core:        'text-brand-400 bg-brand-500/10 border-brand-500/20',
    Advanced:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
    Ecommerce:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    Account:     'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

const initPermissions = () => Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false]));

const Team = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);

    const [formData, setFormData] = useState({
        name: '', email: '', password: '',
        permissions: initPermissions()
    });

    const fetchStaff = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff`);
            setStaffList(response.data);
        } catch (error) {
            console.error("Failed to fetch staff list", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStaff(); }, []);

    const handleOpenModal = (staff = null) => {
        if (staff) {
            setEditingStaff(staff);
            const perms = initPermissions();
            (staff.permissions || []).forEach(k => { if (perms[k] !== undefined) perms[k] = true; });
            setFormData({ name: staff.name, email: staff.email, password: '', permissions: perms });
        } else {
            setEditingStaff(null);
            setFormData({ name: '', email: '', password: '', permissions: initPermissions() });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const selectedPermissions = Object.keys(formData.permissions).filter(k => formData.permissions[k]);
        const payload = { name: formData.name, email: formData.email, permissions: selectedPermissions };
        if (formData.password) payload.password = formData.password;
        try {
            if (editingStaff) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/staff/${editingStaff.id}`, payload);
            } else {
                if (!payload.password) return alert("Password is required for new staff");
                await axios.post(`${import.meta.env.VITE_API_URL}/api/staff`, payload);
            }
            setIsModalOpen(false);
            fetchStaff();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to save staff");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Remove this staff member?")) return;
        try { await axios.delete(`${import.meta.env.VITE_API_URL}/api/staff/${id}`); fetchStaff(); }
        catch { alert("Failed to delete staff member."); }
    };

    const togglePermission = (key) => {
        setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
    };

    const isAllSelected = Object.values(formData.permissions).every(Boolean);
    const isNoneSelected = Object.values(formData.permissions).every(v => !v);

    const handleSelectAll = () => {
        const newVal = !isAllSelected;
        setFormData(prev => ({ ...prev, permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, newVal])) }));
    };

    const handleSelectCategory = (cat) => {
        const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
        const allCatSelected = catPerms.every(p => formData.permissions[p.key]);
        const updates = Object.fromEntries(catPerms.map(p => [p.key, !allCatSelected]));
        setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, ...updates } }));
    };

    const getPermLabel = (key) => ALL_PERMISSIONS.find(p => p.key === key)?.label || key.replace('MANAGE_', '');

    return (
        <div className="max-w-6xl w-full">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Team Management</h1>
                    <p className="text-surface-400">Manage your staff and control granular feature access.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="btn-primary">
                    <UserPlus size={18} /> Add Staff Member
                </button>
            </header>

            {loading ? (
                <div className="text-surface-400 text-center py-10">Loading staff directory...</div>
            ) : staffList.length === 0 ? (
                <div className="glass-panel text-center py-16 px-6">
                    <div className="mx-auto w-16 h-16 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mb-4">
                        <Users size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Staff Members Yet</h3>
                    <p className="text-surface-400 max-w-sm mx-auto mb-6">Invite team members to help manage your WhatsApp campaigns, contacts, and live chats.</p>
                    <button onClick={() => handleOpenModal()} className="btn-primary"><UserPlus size={18} /> Add Your First Staff</button>
                </div>
            ) : (
                <div className="glass-panel overflow-hidden">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-surface-800 bg-surface-800/20">
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Staff Member</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Access Limits</th>
                                <th className="p-4 text-xs font-semibold text-surface-400 uppercase tracking-wider">Created</th>
                                <th className="p-4 text-right text-xs font-semibold text-surface-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-800 border-t border-surface-800">
                            {staffList.map((staff) => (
                                <tr key={staff.id} className="hover:bg-surface-800/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center text-white font-bold select-none">
                                                {staff.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{staff.name}</p>
                                                <p className="text-surface-400 text-sm">{staff.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-1.5 flex-wrap max-w-xs">
                                            {staff.permissions?.length > 0 ? (
                                                staff.permissions.length === ALL_PERMISSIONS.length ? (
                                                    <span className="px-2 py-1 bg-brand-500/20 text-brand-400 text-xs rounded-lg">ALL ACCESS</span>
                                                ) : (
                                                    staff.permissions.slice(0, 4).map(perm => (
                                                        <span key={perm} className="px-2 py-1 bg-brand-500/20 text-brand-400 text-xs rounded-lg">
                                                            {getPermLabel(perm)}
                                                        </span>
                                                    ))
                                                )
                                            ) : (
                                                <span className="text-surface-500 text-sm">No access</span>
                                            )}
                                            {staff.permissions?.length > 4 && staff.permissions.length < ALL_PERMISSIONS.length && (
                                                <span className="px-2 py-1 bg-surface-700 text-surface-400 text-xs rounded-lg">+{staff.permissions.length - 4} more</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-surface-300 text-sm">{new Date(staff.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleOpenModal(staff)} className="p-2 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(staff.id)} className="p-2 text-surface-400 hover:text-red-400 hover:bg-surface-700 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Modal ── */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-surface-800 flex justify-between items-center bg-surface-800/50 flex-shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-brand-400" size={20} />
                                {editingStaff ? 'Edit Staff Access' : 'Add Staff Member'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Full Name</label>
                                <input type="text" required className="input-field w-full" value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Email Address</label>
                                <input type="email" required className="input-field w-full" value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">
                                    {editingStaff ? "New Password (Optional)" : "Password"}
                                </label>
                                <input type="password" required={!editingStaff} className="input-field w-full" value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>

                            {/* ── Module Permissions ── */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-surface-300">Module Permissions</label>
                                    {/* SELECT ALL button */}
                                    <button type="button" onClick={handleSelectAll}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isAllSelected ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-surface-800 text-surface-400 hover:text-white border border-surface-700'}`}>
                                        {isAllSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                                        {isAllSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                {CATEGORIES.map(cat => {
                                    const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
                                    const allCatSelected = catPerms.every(p => formData.permissions[p.key]);
                                    return (
                                        <div key={cat} className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                                                <button type="button" onClick={() => handleSelectCategory(cat)}
                                                    className="text-xs text-surface-500 hover:text-surface-300 transition-colors">
                                                    {allCatSelected ? 'Deselect group' : 'Select group'}
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {catPerms.map(perm => (
                                                    <label key={perm.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${formData.permissions[perm.key] ? 'border-brand-500/40 bg-brand-500/10' : 'border-surface-700 bg-surface-800/40 hover:bg-surface-800'}`}>
                                                        <input type="checkbox"
                                                            className="w-4 h-4 rounded border-surface-600 text-brand-500 bg-surface-900 focus:ring-brand-500/30 focus:ring-offset-0"
                                                            checked={formData.permissions[perm.key]}
                                                            onChange={() => togglePermission(perm.key)} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-sm font-medium">{perm.label}</p>
                                                            <p className="text-surface-500 text-xs">{perm.desc}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-surface-800">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-semibold text-surface-300 hover:text-white hover:bg-surface-800 transition-colors">Cancel</button>
                                <button type="submit" className="btn-primary">
                                    {editingStaff ? 'Update Member' : 'Add Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Team;
