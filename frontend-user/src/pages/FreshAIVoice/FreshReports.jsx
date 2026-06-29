import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { PhoneCall, CheckCircle2, Clock, Activity, BarChart2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const FreshReports = () => {
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
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC]">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium text-lg">Loading analytics data...</p>
            </div>
        );
    }

    if (!stats) return null;

    const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6366F1'];

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="bg-gradient-to-br from-indigo-600 to-purple-600 text-transparent bg-clip-text">Voice Analytics</span>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold border border-indigo-200">
                            Real-time
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Performance metrics across all AI voice campaigns</p>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                        <PhoneCall size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Calls</p>
                        <h3 className="text-3xl font-black text-gray-900">{stats.totalCalls}</h3>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shadow-inner">
                        <CheckCircle2 size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Answered</p>
                        <h3 className="text-3xl font-black text-gray-900">{stats.answeredCalls}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Minutes</p>
                        <h3 className="text-3xl font-black text-gray-900">{stats.totalMinutes}<span className="text-xl font-bold text-gray-400">m</span></h3>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner">
                        <Activity size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Success Rate</p>
                        <h3 className="text-3xl font-black text-gray-900">{stats.successRate}<span className="text-xl font-bold text-gray-400">%</span></h3>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Activity Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <BarChart2 size={20} className="text-indigo-500" />
                                Call Volume Trend
                            </h3>
                            <p className="text-sm text-gray-500 font-medium mt-1">Daily outbound call activity over the last 7 days</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.charts?.callsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorFreshCalls" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12, fontWeight: 600}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12, fontWeight: 600}} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontWeight: 'bold'}}
                                    itemStyle={{color: '#4F46E5'}}
                                />
                                <Area type="monotone" dataKey="calls" stroke="#4F46E5" strokeWidth={4} fill="url(#colorFreshCalls)" activeDot={{r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2}} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Breakdown Column */}
                <div className="flex flex-col gap-8">
                    {/* Outcome Pie */}
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 flex-1 flex flex-col">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Outcome Distribution</h3>
                        <p className="text-xs text-gray-500 font-medium mb-6">Breakdown of call results</p>
                        <div className="flex-1 min-h-[200px] flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.charts?.successRateChart}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {stats.charts?.successRateChart.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                        itemStyle={{fontWeight: 'bold', color: '#374151'}}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-gray-900">{stats.successRate}%</span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Success</span>
                            </div>
                        </div>
                    </div>

                    {/* Provider Bar */}
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 flex-1 flex flex-col">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Provider Usage</h3>
                        <p className="text-xs text-gray-500 font-medium mb-6">Traffic distributed across providers</p>
                        <div className="flex-1 min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.charts?.providerUsage} margin={{top: 0, right: 0, left: -20, bottom: 0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12, fontWeight: 600}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12, fontWeight: 600}} />
                                    <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontWeight: 'bold'}} />
                                    <Bar dataKey="value" fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={48} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FreshReports;
