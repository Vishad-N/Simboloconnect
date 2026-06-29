import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const VoiceReports = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
                const res = await axios.get(`${API}/api/voice-reports/dashboard`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (error) {
                console.error("Failed to fetch dashboard", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) {
        return <div className="p-10 text-center text-gray-500">Loading metrics...</div>;
    }

    if (!stats) return null;

    const COLORS = ['#10B981', '#F43F5E', '#F59E0B', '#3B82F6'];

    return (
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100%', paddingBottom: 40 }}>
            {/* Hero Header */}
            <div className="border-b border-white/5 bg-surface-900/30" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#10B981,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(16,185,129,.3)' }}>
                    <span className="text-2xl">📊</span>
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', margin: 0 }}>Voice Analytics</h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Performance metrics across all AI voice campaigns</p>
                </div>
            </div>

            <div style={{ padding: '32px' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Calls</p>
                        <h2 className="text-3xl font-bold text-white">{stats.totalCalls}</h2>
                    </div>
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Answered</p>
                        <h2 className="text-3xl font-bold text-green-400">{stats.answeredCalls}</h2>
                    </div>
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Minutes</p>
                        <h2 className="text-3xl font-bold text-blue-400">{stats.totalMinutes}m</h2>
                    </div>
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-5">
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Success Rate</p>
                        <h2 className="text-3xl font-bold text-orange-400">{stats.successRate}%</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Activity Chart */}
                    <div className="bg-surface-900 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-white font-bold text-lg mb-6">Call Volume (7 Days)</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.charts?.callsByDay}>
                                    <defs>
                                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af'}} axisLine={false} />
                                    <YAxis stroke="#6b7280" tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                                    <Area type="monotone" dataKey="calls" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Breakdown Charts */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 flex flex-col">
                            <h3 className="text-white font-bold text-lg mb-4 text-center">Outcome Distribution</h3>
                            <div className="flex-1 min-h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.charts?.successRateChart}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {stats.charts?.successRateChart.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-surface-900 border border-white/5 rounded-2xl p-6 flex flex-col">
                            <h3 className="text-white font-bold text-lg mb-4 text-center">Provider Usage</h3>
                            <div className="flex-1 min-h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.charts?.providerUsage}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af', fontSize: 12}} axisLine={false} />
                                        <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}} />
                                        <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceReports;
