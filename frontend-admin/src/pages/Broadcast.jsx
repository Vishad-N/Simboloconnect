import React, { useState } from 'react';
import axios from 'axios';
import { Send, AlertCircle } from 'lucide-react';

const Broadcast = () => {
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();

        if (!window.confirm("Are you sure you want to broadcast this message to ALL active users? This cannot be undone.")) return;

        setLoading(true);
        setStatus({ type: '', text: '' });

        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/broadcast`,
                { message },
                { headers: { 'x-user-id': localStorage.getItem('adminToken') } }
            );
            setStatus({ type: 'success', text: 'Broadcast message dispatched successfully to all active clients.' });
            setMessage('');
        } catch (error) {
            setStatus({ type: 'error', text: 'Failed to send broadcast. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl space-y-6">
            <h2 className="text-2xl font-bold text-surface-900 border-b border-surface-200 pb-4 flex items-center">
                <Send className="mr-3 text-brand-600" /> System Broadcast
            </h2>

            <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                <div className="flex items-start mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <AlertCircle className="text-yellow-600 mr-3 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h4 className="font-semibold text-yellow-800">Warning: Global Action</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                            This tool sends a WhatsApp message to every single active workspace owner using the default platform Meta credentials. Use this only for critical service updates or billing alerts.
                        </p>
                    </div>
                </div>

                {status.text && (
                    <div className={`mb-6 p-4 rounded-lg border ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {status.text}
                    </div>
                )}

                <form onSubmit={handleSend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">Alert Message</label>
                        <textarea
                            required
                            rows="6"
                            className="input-field"
                            placeholder="Type your system-wide alert here..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                        <div className="flex justify-end mt-2">
                            <span className="text-xs text-surface-500">{message.length} characters</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-surface-200 flex justify-end">
                        <button type="submit" disabled={loading || !message.trim()} className="btn-primary flex items-center">
                            <Send size={18} className="mr-2" />
                            {loading ? 'Sending...' : 'Send Broadcast'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Broadcast;
