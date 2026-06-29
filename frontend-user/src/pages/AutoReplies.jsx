import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, FileImage, FileText, PlayCircle } from 'lucide-react';

const AutoReplies = () => {
    const [replies, setReplies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [templates, setTemplates] = useState([]);
    
    // Form state
    const [formData, setFormData] = useState({
        id: null,
        trigger_keyword: '',
        match_type: 'EXACT',
        action_type: 'TEXT',
        template_id: '',
        template_name: '',
        template_lang: '',
        reply_content: '',
        media_url: '',
        is_active: true
    });

    const resetForm = () => {
        setFormData({
            id: null,
            trigger_keyword: '',
            match_type: 'EXACT',
            action_type: 'TEXT',
            template_id: '',
            template_name: '',
            template_lang: '',
            reply_content: '',
            media_url: '',
            is_active: true
        });
    };

    const fetchReplies = async () => {
        setIsLoading(true);
        try {
            const [res, tempRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/autoreplies`),
                axios.get(`${import.meta.env.VITE_API_URL}/api/templates`)
            ]);
            setReplies(res.data);
            setTemplates(tempRes.data.filter(t => t.status === 'APPROVED'));
        } catch (error) {
            console.error("Failed to load auto-replies", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReplies();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            let payload = { ...formData };
            if (payload.action_type === 'TEMPLATE') {
                const t = templates.find(temp => temp.id === payload.template_id);
                if (t) {
                    payload.template_name = t.name;
                    payload.template_lang = t.language;
                }
            } else {
                payload.template_id = null;
                payload.template_name = null;
                payload.template_lang = null;
            }

            if (payload.id) {
                // Update
                await axios.put(`${import.meta.env.VITE_API_URL}/api/autoreplies/${payload.id}`, payload);
            } else {
                // Create
                await axios.post(`${import.meta.env.VITE_API_URL}/api/autoreplies`, payload);
            }
            setIsModalOpen(false);
            fetchReplies();
        } catch (error) {
            console.error("Failed to save auto-reply", error);
            alert("Error saving auto-reply: " + (error.response?.data?.error || error.message));
        }
    };

    const handleEdit = (reply) => {
        setFormData({ ...reply });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this auto-reply rule?")) return;
        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/autoreplies/${id}`);
            fetchReplies();
        } catch (error) {
            console.error("Failed to delete auto-reply", error);
        }
    };

    const handleToggleActive = async (reply) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/autoreplies/${reply.id}`, { is_active: !reply.is_active });
            fetchReplies();
        } catch (error) {
            console.error("Failed to toggle status", error);
        }
    };

    const renderMediaIcon = (url) => {
        if (!url) return null;
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.endsWith('.mp4')) return <PlayCircle size={16} className="text-brand-400 inline mr-1" />;
        if (lowerUrl.endsWith('.pdf') || lowerUrl.endsWith('.doc')) return <FileText size={16} className="text-brand-400 inline mr-1" />;
        return <FileImage size={16} className="text-brand-400 inline mr-1" />;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-display text-white">Auto Replies (FAQ)</h1>
                    <p className="text-surface-400 mt-1">Set up keyword-based automated responses for incoming WhatsApp messages.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/25"
                >
                    <Plus size={16} /> Create Rule
                </button>
            </div>

            <div className="bg-surface-800 border border-surface-700 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-800/50 border-b border-surface-700">
                                <th className="py-4 px-6 text-sm font-semibold text-surface-400">Trigger Keyword</th>
                                <th className="py-4 px-6 text-sm font-semibold text-surface-400">Match Type</th>
                                <th className="py-4 px-6 text-sm font-semibold text-surface-400">Reply Message</th>
                                <th className="py-4 px-6 text-sm font-semibold text-surface-400">Status</th>
                                <th className="py-4 px-6 text-sm font-semibold text-surface-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-white0">Loading rules...</td>
                                </tr>
                            ) : replies.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-8 text-center text-white0">No auto-reply rules found. Create one to get started.</td>
                                </tr>
                            ) : (
                                replies.map(reply => (
                                    <tr key={reply.id} className="hover:bg-surface-700/30 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className="font-medium text-white">{reply.trigger_keyword}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-surface-700 text-surface-300">
                                                {reply.match_type}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 max-w-md">
                                            <div className="text-sm text-surface-300 whitespace-pre-wrap">
                                                {reply.action_type === 'TEMPLATE' ? (
                                                    <span className="text-brand-400 font-medium">[Template] {reply.template_name} ({reply.template_lang})</span>
                                                ) : (
                                                    <>
                                                        {renderMediaIcon(reply.media_url)}
                                                        {reply.reply_content}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <button 
                                                onClick={() => handleToggleActive(reply)}
                                                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                    reply.is_active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                                                }`}
                                            >
                                                {reply.is_active ? <><CheckCircle size={12}/> Active</> : <><XCircle size={12}/> Paused</>}
                                            </button>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(reply)} className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:text-white hover:bg-brand-500 transition-colors" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(reply.id)} className="p-2 rounded-lg bg-surface-700 text-surface-300 hover:text-white hover:bg-red-500 transition-colors" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-800 border border-surface-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-surface-700 flex justify-between items-center bg-surface-900/50">
                            <h3 className="text-xl font-bold text-white">
                                {formData.id ? 'Edit Auto Reply' : 'Create Auto Reply'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-surface-400 hover:text-white transition">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-surface-300 font-medium mb-1">Trigger Keyword *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Price, Hello, Support"
                                        value={formData.trigger_keyword}
                                        onChange={(e) => setFormData({...formData, trigger_keyword: e.target.value})}
                                        className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm text-surface-300 font-medium mb-1">Match Type</label>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 text-sm text-surface-200 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="match_type" 
                                                value="EXACT"
                                                checked={formData.match_type === 'EXACT'}
                                                onChange={(e) => setFormData({...formData, match_type: e.target.value})}
                                                className="text-brand-500 focus:ring-brand-500 bg-surface-900 border-surface-700"
                                            />
                                            Exact Match (Message must be exactly this word)
                                        </label>
                                    </div>
                                    <div className="flex gap-4 mt-2">
                                        <label className="flex items-center gap-2 text-sm text-surface-200 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="match_type" 
                                                value="PARTIAL"
                                                checked={formData.match_type === 'PARTIAL'}
                                                onChange={(e) => setFormData({...formData, match_type: e.target.value})}
                                                className="text-brand-500 focus:ring-brand-500 bg-surface-900 border-surface-700"
                                            />
                                            Contains (Message contains this word anywhere)
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm text-surface-300 font-medium mb-1">Action Type</label>
                                    <select
                                        value={formData.action_type}
                                        onChange={(e) => setFormData({...formData, action_type: e.target.value})}
                                        className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                    >
                                        <option value="TEXT">Send Text/Media Message</option>
                                        <option value="TEMPLATE">Send Meta Template</option>
                                    </select>
                                </div>

                                {formData.action_type === 'TEXT' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm text-surface-300 font-medium mb-1">Reply Message *</label>
                                            <textarea
                                                required
                                                rows={4}
                                                placeholder="Type the response message here..."
                                                value={formData.reply_content || ''}
                                                onChange={(e) => setFormData({...formData, reply_content: e.target.value})}
                                                className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                            ></textarea>
                                        </div>

                                        <div>
                                            <label className="block text-sm text-surface-300 font-medium mb-1">Media URL (Optional)</label>
                                            <input
                                                type="url"
                                                placeholder="https://example.com/image.jpg"
                                                value={formData.media_url || ''}
                                                onChange={(e) => setFormData({...formData, media_url: e.target.value})}
                                                className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                            />
                                            <p className="text-xs text-white0 mt-1">Provide a direct link to an image, pdf, or mp4 video to send along with the reply.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-sm text-surface-300 font-medium mb-1">Select Meta Template *</label>
                                        <select
                                            required
                                            value={formData.template_id || ''}
                                            onChange={(e) => setFormData({...formData, template_id: e.target.value})}
                                            className="w-full bg-surface-900 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-colors"
                                        >
                                            <option value="" disabled>Choose an approved template...</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({t.language})
                                                </option>
                                            ))}
                                        </select>
                                        {templates.length === 0 && (
                                            <p className="text-xs text-amber-500 mt-1">No approved templates found. Create one in the Templates page.</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-4">
                                    <input 
                                        type="checkbox" 
                                        id="isActive"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                                        className="rounded border-surface-700 text-brand-500 focus:ring-brand-500 bg-surface-900"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-surface-300 cursor-pointer">Rule is Active</label>
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-surface-700 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-surface-300 hover:text-white transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors font-medium shadow-lg shadow-brand-500/25"
                                    >
                                        Save Rule
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AutoReplies;
