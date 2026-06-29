import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageCircleQuestion, Plus, Trash2, Save, Workflow, AlertCircle, Search } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const ChatbotFlow = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // New rule state
    const [newTrigger, setNewTrigger] = useState('');
    const [newMatchType, setNewMatchType] = useState('EXACT');
    const [newActionType, setNewActionType] = useState('TEXT');
    const [newResponseText, setNewResponseText] = useState('');
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rulesRes, tempRes] = await Promise.all([
                axios.get(`${API}/api/autoreplies`),
                axios.get(`${API}/api/templates`)
            ]);
            setRules(rulesRes.data);
            setTemplates(tempRes.data.filter(t => t.status === 'APPROVED'));
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAddRule = async (e) => {
        e.preventDefault();
        if (!newTrigger.trim()) return;
        if (newActionType === 'TEXT' && !newResponseText.trim()) return;
        if (newActionType === 'TEMPLATE' && !selectedTemplate) return;

        setIsSaving(true);
        try {
            let payload = {
                trigger_keyword: newTrigger.toLowerCase().trim(),
                match_type: newMatchType,
                action_type: newActionType,
                is_active: true,
            };

            if (newActionType === 'TEXT') {
                payload.reply_content = newResponseText;
            } else if (newActionType === 'TEMPLATE') {
                const t = templates.find(temp => temp.id === selectedTemplate);
                payload.template_id = t.id;
                payload.template_name = t.name;
                payload.template_lang = t.language;
            }

            await axios.post(`${API}/api/autoreplies`, payload);

            // Reset form
            setNewTrigger('');
            setNewResponseText('');
            setSelectedTemplate('');
            setNewMatchType('EXACT');

            fetchData();
        } catch (error) {
            console.error(error);
            alert("Failed to save rule: " + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this rule?")) return;
        try {
            await axios.delete(`${API}/api/autoreplies/${id}`);
            fetchData();
        } catch (error) {
            alert("Failed to delete rule");
        }
    };

    const handleToggle = async (rule) => {
        try {
            await axios.put(`${API}/api/autoreplies/${rule.id}`, { is_active: !rule.is_active });
            fetchData();
        } catch (error) {
            alert("Failed to toggle rule");
        }
    };

    return (
        <div className="max-w-6xl w-full">
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <MessageCircleQuestion className="text-brand-400" size={32} />
                        Q&A Auto-Replies
                    </h1>
                    <p className="text-surface-400 max-w-2xl">
                        Create instant auto-replies. When a user sends a message matching the keyword, the bot replies automatically. Supports <strong className="text-white">Exact</strong> and <strong className="text-white">Contains</strong> matching.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Add New Rule */}
                <div className="lg:col-span-1">
                    <form onSubmit={handleAddRule} className="glass-panel p-6 sticky top-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Plus size={18} className="text-brand-400" /> New QnA Rule
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Trigger Keyword</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. hello, pricing, help"
                                    className="input-field w-full"
                                    value={newTrigger}
                                    onChange={e => setNewTrigger(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Match Type</label>
                                <select
                                    className="input-field w-full"
                                    value={newMatchType}
                                    onChange={e => setNewMatchType(e.target.value)}
                                >
                                    <option value="EXACT">Exact Match (full message must match)</option>
                                    <option value="PARTIAL">Contains Word (keyword found anywhere)</option>
                                </select>
                                <p className="text-xs text-surface-500 mt-1">
                                    {newMatchType === 'EXACT'
                                        ? '✓ Only triggers if user sends exactly this keyword.'
                                        : '✓ Triggers if user message contains this word anywhere.'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-surface-300 mb-1">Action Type</label>
                                <select
                                    className="input-field w-full"
                                    value={newActionType}
                                    onChange={e => setNewActionType(e.target.value)}
                                >
                                    <option value="TEXT">Send Text Message</option>
                                    <option value="TEMPLATE">Send Template (Meta Approved)</option>
                                </select>
                            </div>

                            {newActionType === 'TEXT' ? (
                                <div>
                                    <label className="block text-sm font-medium text-surface-300 mb-1">Response Text</label>
                                    <textarea
                                        required
                                        rows="4"
                                        placeholder="Type the bot's auto-reply here..."
                                        className="input-field w-full resize-none"
                                        value={newResponseText}
                                        onChange={e => setNewResponseText(e.target.value)}
                                    ></textarea>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-surface-300 mb-1">Select Meta Template</label>
                                    <select
                                        required
                                        className="input-field w-full"
                                        value={selectedTemplate}
                                        onChange={e => setSelectedTemplate(e.target.value)}
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
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="btn-primary w-full mt-6"
                        >
                            <Save size={16} /> {isSaving ? 'Saving...' : 'Save Rule'}
                        </button>
                    </form>
                </div>

                {/* Right Col: Rules List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2 text-surface-300">
                        <Workflow size={18} />
                        <h2 className="text-lg font-semibold">Active Rules ({rules.length})</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-surface-400">Loading rules...</div>
                    ) : rules.length === 0 ? (
                        <div className="glass-panel p-10 text-center flex flex-col items-center">
                            <AlertCircle size={32} className="text-surface-500 mb-3" />
                            <h3 className="text-white font-medium mb-1">No rules yet</h3>
                            <p className="text-surface-400 text-sm max-w-sm">Create your first rule on the left. The bot will use these rules to reply to customers instantly.</p>
                        </div>
                    ) : (
                        rules.map(rule => (
                            <div key={rule.id} className={`glass-panel p-5 flex items-start gap-4 transition-all hover:border-surface-600 group ${!rule.is_active ? 'opacity-50' : ''}`}>
                                <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-3 flex-shrink-0 min-w-[130px] text-center shadow-sm">
                                    <span className="text-[10px] uppercase text-surface-500 font-bold block mb-1">If Message</span>
                                    <span className="text-[10px] uppercase text-white font-bold block mb-1">
                                        {rule.match_type === 'PARTIAL' ? 'Contains' : 'Equals'}
                                    </span>
                                    <span className="text-white font-mono font-medium text-sm">{rule.trigger_keyword}</span>
                                </div>

                                <div className="flex-1 pt-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 rounded bg-brand-500/20 text-white text-xs font-bold tracking-wider">
                                            {rule.action_type}
                                        </span>
                                        {rule.match_type === 'PARTIAL' && (
                                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center gap-1">
                                                <Search size={10} /> Contains Word
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-surface-300 text-sm whitespace-pre-wrap">
                                        {rule.action_type === 'TEXT'
                                            ? (rule.reply_content || "No text defined.")
                                            : `[Template] ${rule.template_name} (${rule.template_lang})`
                                        }
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 items-end flex-shrink-0">
                                    {/* Toggle active/inactive */}
                                    <button
                                        onClick={() => handleToggle(rule)}
                                        title={rule.is_active ? 'Click to disable' : 'Click to enable'}
                                        className={`text-xs px-2 py-1 rounded-full font-semibold border transition-all ${rule.is_active
                                            ? 'bg-brand-500/10 text-white border-brand-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                                            : 'bg-surface-800 text-surface-500 border-surface-700 hover:bg-brand-500/10 hover:text-white'
                                        }`}
                                    >
                                        {rule.is_active ? 'Active' : 'Disabled'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id)}
                                        className="p-2 text-surface-500 hover:bg-surface-800 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete Rule"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatbotFlow;
