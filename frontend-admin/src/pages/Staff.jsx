import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Shield, Edit2, Trash2, Plus, X } from 'lucide-react';

const MODULES = ['Dashboard', 'Users', 'Plans', 'Broadcast', 'Settings'];

const Staff = () => {
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        permissions: []
    });

    const fetchStaff = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/staff`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setStaffList(res.data);
        } catch (error) {
            console.error("Failed to fetch staff");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const openModal = (staff = null) => {
        if (staff) {
            setEditingStaff(staff);
            setFormData({
                name: staff.name,
                email: staff.email,
                password: '',
                permissions: staff.permissions || []
            });
        } else {
            setEditingStaff(null);
            setFormData({ name: '', email: '', password: '', permissions: [] });
        }
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (moduleName) => {
        setFormData(prev => {
            const hasPerm = prev.permissions.includes(moduleName);
            return {
                ...prev,
                permissions: hasPerm
                    ? prev.permissions.filter(p => p !== moduleName)
                    : [...prev.permissions, moduleName]
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStaff) {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/staff/${editingStaff.id}`, formData, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
            } else {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/staff`, formData, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
            }
            fetchStaff();
            setIsModalOpen(false);
        } catch (error) {
            alert(error.response?.data?.error || "Failed to save staff");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this staff member?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/staff/${id}`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            fetchStaff();
        } catch (error) {
            alert("Failed to delete staff");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-surface-200">
                <h2 className="text-2xl font-bold text-surface-900 flex items-center">
                    <Shield className="mr-3 text-brand-600" /> Admin Staff
                </h2>
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center"
                >
                    <Plus size={18} className="mr-2" />
                    Add Staff
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-surface-200">
                            <thead className="bg-surface-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">Permissions</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-surface-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-surface-200">
                                {staffList.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-surface-900">{staff.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                                            {staff.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-wrap gap-1">
                                                {(staff.permissions || []).map(perm => (
                                                    <span key={perm} className="px-2 py-1 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                                                        {perm}
                                                    </span>
                                                ))}
                                                {(!staff.permissions || staff.permissions.length === 0) && (
                                                    <span className="text-xs text-surface-400 italic">No specific permissions</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openModal(staff)}
                                                className="text-brand-600 hover:text-brand-900 mr-4"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(staff.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {staffList.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-surface-500">
                                            No staff members found. Add one to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CREATE/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-surface-200 bg-surface-50">
                            <h3 className="text-xl font-bold text-surface-900">
                                {editingStaff ? 'Edit Staff Member' : 'Add New Staff'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-surface-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6">
                            <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="input-field"
                                        placeholder="John Manager"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="input-field"
                                        placeholder="john@yourdomain.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-1">
                                        Password {editingStaff && <span className="text-surface-400 font-normal">(Leave blank to keep unchanged)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        required={!editingStaff}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="input-field font-mono"
                                        placeholder={editingStaff ? "••••••••" : "Choose a secure password"}
                                    />
                                </div>

                                <div className="pt-4 border-t border-surface-200 mt-6 !mb-2">
                                    <label className="block text-sm font-bold text-surface-900 mb-3">Module Permissions</label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {MODULES.map(mod => (
                                            <label key={mod} className="flex items-center p-3 border border-surface-200 rounded-lg cursor-pointer hover:bg-surface-50 transition">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-brand-600 border-surface-300 rounded focus:ring-brand-500"
                                                    checked={formData.permissions.includes(mod)}
                                                    onChange={() => handlePermissionToggle(mod)}
                                                />
                                                <span className="ml-3 font-medium text-surface-700 select-none">
                                                    {mod}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-surface-200 bg-surface-50 flex justify-end gap-3 mt-auto">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-surface-300 shadow-sm text-sm font-medium rounded-md text-surface-700 bg-white hover:bg-surface-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="staff-form"
                                className="btn-primary"
                            >
                                {editingStaff ? 'Update Staff Info' : 'Create Staff Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Staff;
