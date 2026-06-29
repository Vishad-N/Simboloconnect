import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, ArrowDownRight, ArrowUpRight, Clock, Receipt } from 'lucide-react';

const WalletLogs = () => {
    const [logs, setLogs] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/account/wallet/logs`);
                setLogs(res.data.transactions);
                setBalance(res.data.balance);
            } catch (error) {
                console.error("Failed to fetch wallet logs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    if (loading) return <div className="p-8 text-center text-surface-400">Loading Wallet Logs...</div>;

    return (
        <div className="space-y-6">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <Wallet className="text-brand-400" /> Wallet History
                    </h1>
                    <p className="text-surface-400">View your credit usage and top-up transactions.</p>
                </div>
                <div className="bg-surface-800 border border-surface-700 px-6 py-3 rounded-xl text-center">
                    <p className="text-sm text-surface-400 uppercase tracking-wider mb-1">Current Balance</p>
                    <p className="text-2xl font-bold text-white">₹{parseFloat(balance).toFixed(2)}</p>
                </div>
            </header>

            <div className="glass-panel overflow-hidden border border-surface-700 rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-800/50 border-b border-surface-700">
                                <th className="p-4 text-surface-300 font-medium">Date & Time</th>
                                <th className="p-4 text-surface-300 font-medium">Type</th>
                                <th className="p-4 text-surface-300 font-medium">Category</th>
                                <th className="p-4 text-surface-300 font-medium">Description</th>
                                <th className="p-4 text-surface-300 font-medium text-right">Amount (INR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700/50">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-white0 italic">
                                        No transactions found in your wallet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-surface-800/30 transition-colors">
                                        <td className="p-4 text-surface-300 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-white0" /> 
                                                {formatDate(log.timestamp)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                log.type === 'CREDIT' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {log.type === 'CREDIT' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                                {log.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-surface-300">
                                            <span className="px-2 py-1 rounded bg-surface-700 text-xs font-medium uppercase">
                                                {log.category || 'GENERAL'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-surface-300 max-w-xs truncate">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={16} className="text-brand-400 shrink-0" />
                                                <span className="truncate" title={log.description}>{log.description}</span>
                                            </div>
                                        </td>
                                        <td className={`p-4 font-bold text-right whitespace-nowrap ${
                                            log.type === 'CREDIT' ? 'text-green-400' : 'text-white'
                                        }`}>
                                            {log.type === 'CREDIT' ? '+' : '-'}₹{parseFloat(log.amount).toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WalletLogs;
