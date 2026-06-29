import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, User } from 'lucide-react';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/audit-logs`, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setLogs(res.data);
        } catch (error) {
            console.error("Failed fetching audit logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const formatAction = (action) => {
        return action.replace(/_/g, ' ');
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4 flex items-center">
                <ShieldCheck className="mr-3 text-brand-600" /> Audit Logs
            </h2>

            <div className="glass-card shadow border border-surface-200">
                <table className="min-w-full divide-y divide-surface-200">
                    <thead className="bg-surface-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Target User ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-surface-200">
                        {loading ? (
                            <tr><td colSpan="4" className="px-6 py-4 text-center text-sm text-surface-500">Loading...</td></tr>
                        ) : logs.map((log) => (
                            <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${log.action.includes('SUSPEND') || log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                                            log.action.includes('ACTIVATE') ? 'bg-green-100 text-green-800' :
                                                'bg-blue-100 text-blue-800'
                                        }`}>
                                        {formatAction(log.action)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600 font-mono">
                                    {log.targetUserId || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm text-surface-500 font-mono text-xs max-w-xs truncate" title={JSON.stringify(log.details)}>
                                    {JSON.stringify(log.details)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLogs;
