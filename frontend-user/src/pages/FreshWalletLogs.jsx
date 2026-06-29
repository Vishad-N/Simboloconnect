import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wallet, ArrowDownRight, ArrowUpRight, Clock, Receipt } from 'lucide-react';

const FreshWalletLogs = () => {
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

    if (loading) return <div className="p-8 text-center text-[#4d7a62]">Loading Wallet Logs...</div>;

    return (
        <div className="space-y-6">
            <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0b1e12] mb-2 flex items-center gap-3">
                        <Wallet className="text-[#25D366]" size={28} /> Wallet History
                    </h1>
                    <p className="text-[#4d7a62] text-sm">View your credit usage and top-up transactions.</p>
                </div>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(37,211,102,0.1) 0%, rgba(18,140,126,0.05) 100%)',
                    border: '1px solid rgba(37,211,102,0.2)',
                    boxShadow: '0 2px 10px rgba(37,211,102,0.05)'
                }} className="px-6 py-3 rounded-2xl text-center">
                    <p className="text-xs text-[#4d7a62] uppercase tracking-wider font-bold mb-1">Current Balance</p>
                    <p className="text-2xl font-black text-[#0b1e12]">₹{parseFloat(balance).toFixed(2)}</p>
                </div>
            </header>

            <div className="glass-panel overflow-hidden border border-[#cde9d8] rounded-2xl bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#f3fbf6] border-b border-[#cde9d8]">
                                <th className="p-4 text-[#4d7a62] font-semibold text-xs uppercase tracking-wider">Date & Time</th>
                                <th className="p-4 text-[#4d7a62] font-semibold text-xs uppercase tracking-wider">Type</th>
                                <th className="p-4 text-[#4d7a62] font-semibold text-xs uppercase tracking-wider">Category</th>
                                <th className="p-4 text-[#4d7a62] font-semibold text-xs uppercase tracking-wider">Description</th>
                                <th className="p-4 text-[#4d7a62] font-semibold text-xs uppercase tracking-wider text-right">Amount (INR)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e8f5ee]">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-[#4d7a62] italic text-sm">
                                        No transactions found in your wallet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-[#f0fdf5] transition-colors">
                                        <td className="p-4 text-[#0b1e12] text-sm whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Clock size={15} className="text-[#7aad8e]" /> 
                                                {formatDate(log.timestamp)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                log.type === 'CREDIT' 
                                                    ? 'bg-green-500/10 text-green-600' 
                                                    : 'bg-red-500/10 text-red-600'
                                            }`}>
                                                {log.type === 'CREDIT' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                                                {log.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#0b1e12] text-xs">
                                            <span className="px-2 py-1.5 rounded-lg bg-[#e8f5ee] font-semibold text-[#2d5c42] uppercase tracking-wider">
                                                {log.category || 'GENERAL'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#0b1e12] text-sm max-w-xs truncate">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={15} className="text-[#128C7E] shrink-0" />
                                                <span className="truncate" title={log.description}>{log.description}</span>
                                            </div>
                                        </td>
                                        <td className={`p-4 font-bold text-right text-sm whitespace-nowrap ${
                                            log.type === 'CREDIT' ? 'text-green-600' : 'text-[#0b1e12]'
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

export default FreshWalletLogs;
