import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5005';

const VoiceAgents = () => {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);

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
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100%', paddingBottom: 40 }}>
            {/* Hero Header */}
            <div className="border-b border-white/5 bg-surface-900/30" style={{ padding: '28px 32px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
                        <span className="text-2xl">🤖</span>
                    </div>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', margin: 0 }}>Synced Agents</h1>
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Manage and monitor AI agents imported from your providers</p>
                    </div>
                </div>
                <button onClick={fetchAgents} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2">
                    {loading ? '🔄 Refreshing...' : '🔄 Refresh List'}
                </button>
            </div>

            <div style={{ padding: '32px' }}>
                {loading ? (
                    <div className="text-center py-16 text-gray-500">Loading agents...</div>
                ) : agents.length === 0 ? (
                    <div className="text-center py-16 bg-surface-900 border border-white/5 rounded-2xl">
                        <div className="text-5xl mb-4">📭</div>
                        <div className="text-gray-400 font-medium">No agents found</div>
                        <div className="text-sm text-gray-500 mt-2">Go to Providers and click "Sync Agents" to import them here.</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents.map(agent => (
                            <div key={agent.id} className="bg-surface-900 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 transition-all hover:-translate-y-1">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                            <span className="text-xl">🎙️</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{agent.name}</h3>
                                            <span className="text-[10px] text-gray-500 font-mono tracking-wider">ID: {agent.providerAgentId?.substring(0,8)}...</span>
                                        </div>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${agent.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                                        {agent.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                                    </div>
                                </div>
                                
                                <div className="space-y-3 mt-6">
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                                        <span className="text-xs text-gray-500 font-medium">Provider</span>
                                        <span className="text-sm text-white font-semibold flex items-center gap-2">
                                            {agent.providerId === 'retell' ? '🔊' : '📡'} 
                                            {agent.providerId?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                                        <span className="text-xs text-gray-500 font-medium">Voice Identity</span>
                                        <span className="text-sm text-blue-400 font-semibold">{agent.voiceName || 'Default System Voice'}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                                        <span className="text-xs text-gray-500 font-medium">Language</span>
                                        <span className="text-sm text-white font-semibold">{agent.language || 'en-US'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceAgents;
