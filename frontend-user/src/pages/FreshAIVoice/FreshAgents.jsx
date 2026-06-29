import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, LayoutGrid, List } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const FreshAgents = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');

    const fetchAgents = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
            const res = await axios.get(`${API}/api/voice-agents`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAgents(res.data || []);
        } catch (error) {
            console.error("Failed to fetch agents", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="bg-gradient-to-br from-indigo-500 to-purple-600 text-transparent bg-clip-text">AI Voice Agents</span>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold border border-indigo-200">
                            {agents.length} Synced
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm font-medium">Manage and monitor AI agents imported from your voice providers</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            <LayoutGrid size={18} />
                        </button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                            <List size={18} />
                        </button>
                    </div>
                    <button 
                        onClick={fetchAgents} 
                        disabled={loading}
                        className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-500' : 'text-gray-400'} />
                        {loading ? 'Refreshing...' : 'Refresh List'}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {loading && agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-medium text-lg">Loading your AI agents...</p>
                </div>
            ) : agents.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-16 text-center max-w-2xl mx-auto mt-12">
                    <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
                        🤖
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">No Agents Found</h2>
                    <p className="text-gray-500 mb-8 text-lg">You haven't synced any AI agents from your providers yet.</p>
                    <button 
                        onClick={() => window.location.href = '/ai-voice/providers'}
                        className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1"
                    >
                        Go to Providers &amp; Sync
                    </button>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-4"}>
                    <AnimatePresence>
                        {agents.map(agent => (
                            <motion.div 
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                key={agent.id} 
                                className={`bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group ${viewMode === 'list' ? 'flex items-center p-4 gap-6' : 'p-0'}`}
                            >
                                {/* Header / Icon Area */}
                                <div className={viewMode === 'grid' ? "p-6 pb-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white" : "shrink-0"}>
                                    <div className={`flex justify-between items-start ${viewMode === 'list' ? 'hidden' : ''}`}>
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-50 flex items-center justify-center border border-indigo-100/50 shadow-sm group-hover:scale-110 transition-transform duration-300">
                                            <span className="text-2xl">🎙️</span>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${agent.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                            {agent.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                                        </div>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-50 flex items-center justify-center border border-indigo-100/50 shadow-sm">
                                            <span className="text-xl">🎙️</span>
                                        </div>
                                    )}

                                    <div className={viewMode === 'grid' ? "mt-5" : "flex-1 min-w-[200px]"}>
                                        <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-indigo-600 transition-colors">{agent.name}</h3>
                                        <p className="text-xs text-gray-400 font-mono mt-1">ID: {agent.providerAgentId}</p>
                                    </div>
                                </div>
                                
                                {/* Details Area */}
                                <div className={viewMode === 'grid' ? "p-6 space-y-4" : "flex flex-1 items-center justify-between gap-6 px-4"}>
                                    <div className={viewMode === 'grid' ? "flex flex-col gap-1" : "flex-1"}>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Provider</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-700 capitalize flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                {agent.providerId}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className={viewMode === 'grid' ? "flex flex-col gap-1" : "flex-1"}>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Voice Model</span>
                                        <span className="text-sm font-semibold text-gray-700 truncate">{agent.voiceName || 'System Default'}</span>
                                    </div>
                                    
                                    <div className={viewMode === 'grid' ? "flex flex-col gap-1" : "flex-1"}>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Language</span>
                                        <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-md w-fit">{agent.language || 'en-US'}</span>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${agent.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                                            {agent.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default FreshAgents;
