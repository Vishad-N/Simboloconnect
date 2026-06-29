import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Activity, MessageSquare } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, totalMessages: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/dashboard-stats`, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4">Platform Overview</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex items-center shadow-sm">
                    <div className="p-4 bg-brand-50 rounded-full mr-4">
                        <Users className="text-brand-600 w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-surface-500 uppercase tracking-wide">Total Workspaces</p>
                        <h3 className="text-3xl font-bold text-surface-900">
                            {loading ? '...' : stats.totalUsers}
                        </h3>
                    </div>
                </div>

                <div className="glass-card p-6 flex items-center shadow-sm">
                    <div className="p-4 bg-purple-50 rounded-full mr-4">
                        <Activity className="text-purple-600 w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-surface-500 uppercase tracking-wide">Active Subscriptions</p>
                        <h3 className="text-3xl font-bold text-surface-900">
                            {loading ? '...' : stats.activeUsers}
                        </h3>
                    </div>
                </div>

                <div className="glass-card p-6 flex items-center shadow-sm">
                    <div className="p-4 bg-blue-50 rounded-full mr-4">
                        <MessageSquare className="text-blue-600 w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-surface-500 uppercase tracking-wide">Total Messages Sent</p>
                        <h3 className="text-3xl font-bold text-surface-900">
                            {loading ? '...' : stats.totalMessages}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6 mt-8">
                <h3 className="text-lg font-bold text-surface-900 mb-4">Quick Actions</h3>
                <div className="flex space-x-4">
                    <a href="/users" className="btn-primary">Manage Users</a>
                    <a href="/plans" className="btn-secondary">View Pricing Plans</a>
                    <a href="/broadcast" className="btn-secondary">Send System Alert</a>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
