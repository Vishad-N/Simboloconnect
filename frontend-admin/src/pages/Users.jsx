import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserX, UserCheck, ShieldAlert, Edit, Plus, Trash2, Download } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const Users = () => {
    const [users, setUsers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currencySymbol, setCurrencySymbol] = useState('₹');
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedUser, setSelectedUser] = useState(null);
    const [validityEdit, setValidityEdit] = useState('');

    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', validityExpiresAt: '', planId: '' });

    const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
    const [limitsForm, setLimitsForm] = useState({
        message_limit: '', contact_limit: '',
        campaigns_limit: '', bot_replies_limit: '', bot_flows_limit: '', team_members_limit: '',
        planId: ''
    });

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', logo: '' });

    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase();
        const nameMatch = user.name?.toLowerCase().includes(term);
        const emailMatch = user.email?.toLowerCase().includes(term);
        const phoneMatch = user.phone?.toLowerCase().includes(term);
        return nameMatch || emailMatch || phoneMatch;
    });

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API}/api/admin/users`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setUsers(res.data);
        } catch (error) {
            console.error("Failed fetching users");
        } finally {
            setLoading(false);
        }
    };

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
            } catch (err) { /* ignore currency fetch error */ }
        } catch (error) {
            console.error("Failed fetching plans");
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchPlans();
    }, []);

    const toggleStatus = async (user) => {
        try {
            await axios.put(`${API}/api/admin/users/${user.id}/status`,
                { isActive: !user.isActive },
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            fetchUsers();
        } catch (err) { alert("Failed to update status"); }
    };

    const handleUpdateValidity = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API}/api/admin/users/${selectedUser.id}/validity`,
                { validityExpiresAt: validityEdit ? new Date(validityEdit).toISOString() : null },
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            setSelectedUser(null);
            fetchUsers();
        } catch (err) { alert("Failed to update validity"); }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/admin/users`, newUserForm,
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            setIsAddUserModalOpen(false);
            setNewUserForm({ name: '', email: '', password: '', validityExpiresAt: '', planId: '' });
            fetchUsers();
        } catch (err) { alert("Failed to create user. Email may exist."); }
    };

    const handlePlanChange = (planId) => {
        const selectedPlan = plans.find(p => p.id === planId);
        setLimitsForm({
            ...limitsForm,
            planId: planId,
            message_limit:      selectedPlan?.message_limit      ?? 0,
            contact_limit:      selectedPlan?.contacts_limit     ?? 0,
            campaigns_limit:    selectedPlan?.campaigns_limit    ?? 0,
            bot_replies_limit:  selectedPlan?.bot_replies_limit  ?? 0,
            bot_flows_limit:    selectedPlan?.bot_flows_limit    ?? 0,
            team_members_limit: selectedPlan?.team_members_limit ?? 0,
        });
    };

    const openLimitsModal = (user) => {
        setSelectedUser(user);
        const userPlan = plans.find(p => p.id === user.planId);
        setLimitsForm({
            message_limit:      user.message_limit      ?? userPlan?.message_limit      ?? 0,
            contact_limit:      user.contact_limit      ?? userPlan?.contacts_limit     ?? 0,
            campaigns_limit:    user.campaigns_limit    ?? userPlan?.campaigns_limit    ?? 0,
            bot_replies_limit:  user.bot_replies_limit  ?? userPlan?.bot_replies_limit  ?? 0,
            bot_flows_limit:    user.bot_flows_limit    ?? userPlan?.bot_flows_limit    ?? 0,
            team_members_limit: user.team_members_limit ?? userPlan?.team_members_limit ?? 0,
            planId: user.planId || 'none'
        });
        setIsLimitsModalOpen(true);
    };

    const handleUpdateLimits = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...limitsForm, planId: limitsForm.planId === 'none' ? '' : limitsForm.planId };
            await axios.put(`${API}/api/admin/users/${selectedUser.id}/limits`,
                payload,
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            setIsLimitsModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) { alert("Failed to update limits"); }
    };

    const openProfileModal = (user) => {
        setSelectedUser(user);
        setProfileForm({ name: user.name || '', email: user.email || '', password: '', logo: user.logo || '' });
        setIsProfileModalOpen(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API}/api/admin/users/${selectedUser.id}/profile`,
                profileForm,
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            setIsProfileModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) { alert("Failed to update profile"); }
    };

    const handleImpersonate = async (userId) => {
        try {
            const res = await axios.post(`${API}/api/admin/users/${userId}/impersonate`, {}, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            const { token } = res.data;
            window.open(`${API}/impersonate?token=${token}`, '_blank');
        } catch (err) {
            console.error("Impersonate error:", err);
            alert("Failed to login as user.");
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to permanently delete this user and all their data?")) return;
        try {
            await axios.delete(`${API}/api/admin/users/${userId}`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            fetchUsers();
        } catch (err) { alert("Failed to delete user"); }
    };

    const handleExportCSV = () => {
        if (!users || users.length === 0) { alert("No data available to export."); return; }
        const headers = ["Name", "Email", "Phone", "Status", "Plan", "Message Limit", "Contact Limit", "Campaigns/Month", "Bot Flows", "Team Members", "Expiry Date", "Created At"];
        const csvRows = [headers.join(",")];
        users.forEach(user => {
            const planName = plans.find(p => p.id === user.planId)?.name || 'Custom / Trial';
            const status = user.isActive ? 'Active' : (!user.isEmailVerified ? 'Unverified' : 'Suspended');
            const expiry = user.validityExpiresAt ? new Date(user.validityExpiresAt).toLocaleDateString() : 'Lifetime';
            csvRows.push([
                `"${user.name || ''}"`, `"${user.email || ''}"`, `"${user.phone || ''}"`,
                `"${status}"`, `"${planName}"`,
                `"${user.message_limit ?? 0}"`, `"${user.contact_limit ?? 0}"`,
                `"${user.campaigns_limit ?? 0}"`, `"${user.bot_flows_limit ?? 0}"`,
                `"${user.team_members_limit ?? 0}"`,
                `"${expiry}"`, `"${new Date(user.createdAt).toLocaleDateString()}"`
            ].join(","));
        });
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const LimitInput = ({ label, field, value, onChange, defaultVal }) => (
        <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">{label}</label>
            <input type="number" min="0" required className="input-field text-sm py-1.5"
                value={value} onChange={e => onChange({ ...limitsForm, [field]: e.target.value })} />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <h2 className="text-2xl font-bold text-surface-900">Client Management</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative min-w-[300px]">
                        <input
                            type="text"
                            placeholder="Search by name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pl-10 pr-10 text-sm bg-white border border-surface-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-700"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-600 text-xs font-semibold"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <button onClick={handleExportCSV} className="btn-secondary flex items-center text-sm py-2 px-4 bg-white border border-surface-300 text-surface-700 hover:bg-surface-50 rounded-lg shadow-sm">
                        <Download size={16} className="mr-2" /> Export CSV
                    </button>
                    <button onClick={() => setIsAddUserModalOpen(true)} className="btn-primary flex items-center text-sm py-2 px-4 rounded-lg">
                        <Plus size={16} className="mr-1" /> Add User
                    </button>
                </div>
            </div>

            <div className="glass-card shadow border border-surface-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                    <thead className="bg-surface-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Client</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status / Meta</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Limits & Plan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Expiry</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-surface-200">
                        {loading ? (
                            <tr><td colSpan="5" className="px-6 py-4 text-center text-sm text-surface-500">Loading...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="5" className="px-6 py-8 text-center text-sm text-surface-500 font-medium">No clients found matching your search.</td></tr>
                        ) : filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-surface-900">{user.name}</div>
                                    <div className="text-sm text-surface-500">{user.email}</div>
                                    {user.phone && <div className="text-xs text-surface-400 mt-1">{user.phone}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col space-y-1">
                                        {user.isActive ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-max bg-green-100 text-green-800">Active</span>
                                        ) : !user.isEmailVerified ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-max bg-yellow-100 text-yellow-800">Unverified</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-max bg-red-100 text-red-800">Suspended</span>
                                        )}
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-max ${user.metaConfigured ? 'bg-blue-100 text-blue-800' : 'bg-surface-100 text-surface-600'}`}>
                                            {user.metaConfigured ? 'Meta Setup' : 'No API Key'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-xs text-surface-700 font-mono space-y-0.5">
                                        <div>Msg: {user.message_limit ?? 0} | Contact: {user.contact_limit ?? 0}</div>
                                        <div className="text-surface-500">Camp: {user.campaigns_limit ?? 0}/mo | Flows: {user.bot_flows_limit ?? 0}</div>
                                        <div className="text-surface-500">Team: {user.team_members_limit ?? 0}</div>
                                    </div>
                                    <div className="text-xs text-surface-500 font-semibold mt-1">
                                        {plans.find(p => p.id === user.planId)?.name || 'No Plan'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900">
                                    {user.validityExpiresAt ? new Date(user.validityExpiresAt).toLocaleDateString() : 'Lifetime'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-3">
                                        <button onClick={() => handleImpersonate(user.id)} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold" title="Login As">Login As</button>
                                        <button onClick={() => { setSelectedUser(user); setValidityEdit(user.validityExpiresAt ? new Date(user.validityExpiresAt).toISOString().split('T')[0] : ''); }} className="text-brand-600 hover:text-brand-900 text-xs" title="Edit Validity">Expiry</button>
                                        <button onClick={() => openLimitsModal(user)} className="text-purple-600 hover:text-purple-900 text-xs" title="Edit Limits & Plan">Limits</button>
                                        <button onClick={() => openProfileModal(user)} className="text-blue-600 hover:text-blue-900" title="Edit Profile"><Edit size={16} /></button>
                                        <button onClick={() => toggleStatus(user)} className={`${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`} title={user.isActive ? 'Suspend' : 'Activate'}>
                                            {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                                        </button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900" title="Delete User"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Validity Edit Modal */}
            {selectedUser && !isLimitsModalOpen && !isProfileModalOpen && (
                <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-surface-900">Edit Expiry: {selectedUser.name}</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-surface-400 hover:text-surface-600">×</button>
                        </div>
                        <form onSubmit={handleUpdateValidity} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Expiration Date</label>
                                <input type="date" className="input-field" value={validityEdit} onChange={(e) => setValidityEdit(e.target.value)} />
                                <p className="text-xs text-surface-500 mt-1">Leave blank to grant lifetime access.</p>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-surface-200">
                                <button type="button" onClick={() => setSelectedUser(null)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Limits & Plan Edit Modal — Full Control */}
            {isLimitsModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-surface-900">Edit Limits: {selectedUser.name}</h3>
                            <button onClick={() => { setIsLimitsModalOpen(false); setSelectedUser(null); }} className="text-surface-400 hover:text-surface-600">×</button>
                        </div>
                        <form onSubmit={handleUpdateLimits} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Assign Plan</label>
                                <select className="input-field" value={limitsForm.planId} onChange={e => handlePlanChange(e.target.value)}>
                                    <option value="" disabled>Select a Plan</option>
                                    <option value="none">No Plan</option>
                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({currencySymbol}{p.price})</option>)}
                                </select>
                                <p className="text-xs text-surface-500 mt-1">Override values below will take priority over the plan defaults.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <LimitInput label="Message Limit" field="message_limit" value={limitsForm.message_limit} onChange={setLimitsForm} />
                                <LimitInput label="Contact Limit" field="contact_limit" value={limitsForm.contact_limit} onChange={setLimitsForm} />
                                <LimitInput label="Campaigns/Month" field="campaigns_limit" value={limitsForm.campaigns_limit} onChange={setLimitsForm} />
                                <LimitInput label="Bot Replies/Month" field="bot_replies_limit" value={limitsForm.bot_replies_limit} onChange={setLimitsForm} />
                                <LimitInput label="Bot Flows" field="bot_flows_limit" value={limitsForm.bot_flows_limit} onChange={setLimitsForm} />
                                <LimitInput label="Team Members" field="team_members_limit" value={limitsForm.team_members_limit} onChange={setLimitsForm} />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-surface-200">
                                <button type="button" onClick={() => { setIsLimitsModalOpen(false); setSelectedUser(null); }} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save All Limits</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Profile Edit Modal */}
            {isProfileModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-surface-900">Edit Profile: {selectedUser.name}</h3>
                            <button onClick={() => { setIsProfileModalOpen(false); setSelectedUser(null); }} className="text-surface-400 hover:text-surface-600">×</button>
                        </div>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Name</label>
                                <input type="text" className="input-field" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                                <input type="email" className="input-field" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Logo URL (Optional)</label>
                                <input type="text" className="input-field" value={profileForm.logo} onChange={e => setProfileForm({ ...profileForm, logo: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">New Password</label>
                                <input type="password" placeholder="Leave blank to keep current" className="input-field" value={profileForm.password} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-surface-200">
                                <button type="button" onClick={() => { setIsProfileModalOpen(false); setSelectedUser(null); }} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-surface-900">Add New Workspace</h3>
                            <button onClick={() => setIsAddUserModalOpen(false)} className="text-surface-400 hover:text-surface-600">×</button>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Company / Name</label>
                                <input type="text" required className="input-field" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                                <input type="email" required className="input-field" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-1">Password</label>
                                <input type="text" required minLength={6} className="input-field" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Plan</label>
                                    <select className="input-field block w-full" value={newUserForm.planId} onChange={e => setNewUserForm({ ...newUserForm, planId: e.target.value })}>
                                        <option value="">7-Day Trial</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Expiry Date</label>
                                    <input type="date" className="input-field w-full" value={newUserForm.validityExpiresAt} onChange={e => setNewUserForm({ ...newUserForm, validityExpiresAt: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-surface-200">
                                <button type="button" onClick={() => setIsAddUserModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Create User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
