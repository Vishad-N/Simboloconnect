import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, RefreshCw } from 'lucide-react';

const Webhooks = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/webhooks`;
            console.log(`Fetching webhooks from: ${apiUrl}`);
            const res = await axios.get(apiUrl);
            setLogs(res.data);
        } catch (error) {
            console.error("Failed fetching webhook logs:", error);
            setError(error.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Optional: poll every 15 seconds
        const interval = setInterval(fetchLogs, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4 w-full flex items-center">
                    <Activity className="mr-3 text-brand-600" />
                    Webhook Monitor
                    <button
                        onClick={fetchLogs}
                        className="ml-auto text-sm btn-secondary flex items-center rounded-full px-3 py-1.5"
                    >
                        <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </h2>
            </div>

            <div className="space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-center">
                        Error loading logs: {error}
                    </div>
                )}

                {logs.length === 0 && !loading && !error && (
                    <div className="text-surface-500 text-center py-8">No webhook payloads found recently.</div>
                )}

                {logs.map((log) => (
                    <div key={log.id} className="bg-white border border-surface-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                        <div className="bg-surface-50 px-4 py-2 border-b border-surface-200 flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 tracking-wide uppercase">
                                    {log.source}
                                </span>
                                <span className="text-xs text-surface-500 font-mono">ID: {log.id.split('-')[0]}</span>
                            </div>
                            <span className="text-xs text-surface-500">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="p-4 bg-surface-900 text-green-400 font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto w-full">
                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Webhooks;
