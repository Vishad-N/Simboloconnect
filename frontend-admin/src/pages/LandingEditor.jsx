import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Plus, Trash2, LayoutTemplate, Star, LayoutList } from 'lucide-react';

const LandingEditor = () => {
    const defaultFeatures = [
        { title: "Green Tick Verification", icon: "Globe2", description: "Apply for the official WhatsApp Green Tick badge directly from our platform to build trust with your customers." },
        { title: "AI Chatbot Builder", icon: "Bot", description: "Create intelligent conversational flows using our drag-and-drop builder, integrated seamlessly with OpenAI." },
        { title: "Broadcast Campaigns", icon: "Target", description: "Send personalized bulk messages to thousands of customers securely with guaranteed delivery and analytics." },
        { title: "Shared Team Inbox", icon: "Users", description: "Collaborate with unlimited agents on a single WhatsApp number. Assign chats, add private notes, and resolve tickets faster." },
        { title: "API & Webhooks", icon: "Zap", description: "Connect your CRM, Shopify, or custom apps easily using our robust REST APIs and real-time event webhooks." },
        { title: "Secure & Compliant", icon: "ShieldCheck", description: "End-to-end encrypted messaging complying with global data protection norms (GDPR ready)." },
    ];

    const defaultTestimonials = [
        { name: "Aman", role: "Business Owner", quote: "This platform has completely transformed how I handle customer support. The AI integration works like magic and the CRM tools are intuitive and fast.", avatarUrl: "" },
        { name: "Pragya", role: "Marketing Director", quote: "I love the webhook integrations and auto-replies. It saves me 10 hours a week in manual work. Sending broadcast messages is now a breeze!", avatarUrl: "" }
    ];

    const [settings, setSettings] = useState({
        landingHeroTitle: '',
        landingHeroSubtitle: '',
        landingFeaturesJson: '[]',
        landingTestimonialsJson: '[]',
        landingPrivacyPolicy: '',
        landingTermsConditions: '',
        landingRefundPolicy: ''
    });
    const [features, setFeatures] = useState([]);
    const [testimonials, setTestimonials] = useState([]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, {
                    headers: { 'x-user-id': localStorage.getItem('adminToken') }
                });
                
                setSettings({
                    landingHeroTitle: res.data.LANDING_HERO_TITLE || 'Automate your business on WhatsApp',
                    landingHeroSubtitle: res.data.LANDING_HERO_SUBTITLE || 'Scale your sales, marketing, and support with the ultimate WhatsApp Business API suite.',
                    landingFeaturesJson: res.data.LANDING_FEATURES_JSON || '[]',
                    landingTestimonialsJson: res.data.LANDING_TESTIMONIALS_JSON || '[]',
                    landingPrivacyPolicy: res.data.LANDING_PRIVACY_POLICY || '',
                    landingTermsConditions: res.data.LANDING_TERMS_CONDITIONS || '',
                    landingRefundPolicy: res.data.LANDING_REFUND_POLICY || ''
                });

                try {
                    const parsedFeatures = JSON.parse(res.data.LANDING_FEATURES_JSON || '[]');
                    setFeatures(parsedFeatures.length > 0 ? parsedFeatures : defaultFeatures);
                } catch(e) { setFeatures(defaultFeatures); }

                try {
                    const parsedTestimonials = JSON.parse(res.data.LANDING_TESTIMONIALS_JSON || '[]');
                    setTestimonials(parsedTestimonials.length > 0 ? parsedTestimonials : defaultTestimonials);
                } catch(e) { setTestimonials(defaultTestimonials); }

            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        const payload = {
            ...settings,
            landingFeaturesJson: JSON.stringify(features),
            landingTestimonialsJson: JSON.stringify(testimonials)
        };

        try {
            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/admin/settings`, payload, {
                headers: { 'x-user-id': localStorage.getItem('adminToken') }
            });
            setMessage('Landing Page content saved successfully!');
        } catch (err) {
            setMessage('Failed to save content.');
        } finally {
            setLoading(false);
        }
    };

    const addFeature = () => {
        setFeatures([...features, { title: 'New Feature', description: 'Describe the feature here', icon: 'Star' }]);
    };
    const updateFeature = (index, key, value) => {
        const newArr = [...features];
        newArr[index][key] = value;
        setFeatures(newArr);
    };
    const removeFeature = (index) => {
        const newArr = [...features];
        newArr.splice(index, 1);
        setFeatures(newArr);
    };

    const addTestimonial = () => {
        setTestimonials([...testimonials, { name: 'John Doe', role: 'CEO, Company', quote: 'This product changed our business!', avatarUrl: '' }]);
    };
    const updateTestimonial = (index, key, value) => {
        const newArr = [...testimonials];
        newArr[index][key] = value;
        setTestimonials(newArr);
    };
    const removeTestimonial = (index) => {
        const newArr = [...testimonials];
        newArr.splice(index, 1);
        setTestimonials(newArr);
    };

    return (
        <div className="max-w-4xl space-y-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-surface-900 mb-2">Landing Page Editor</h1>
                <p className="text-surface-500">Configure the content shown on the public landing page.</p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                
                {/* Hero Section */}
                <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-200 pb-4">
                        <LayoutTemplate className="text-brand-600" size={24} />
                        <h3 className="text-xl font-semibold text-surface-800">Hero Section</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Main Application Title (Hero)</label>
                            <input
                                type="text"
                                value={settings.landingHeroTitle}
                                onChange={(e) => setSettings({ ...settings, landingHeroTitle: e.target.value })}
                                className="input-field text-lg font-bold"
                                placeholder="Automate your business on WhatsApp"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Hero Subtitle</label>
                            <textarea
                                value={settings.landingHeroSubtitle}
                                onChange={(e) => setSettings({ ...settings, landingHeroSubtitle: e.target.value })}
                                className="input-field h-24"
                                placeholder="Scale your sales, marketing, and support..."
                            />
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b border-surface-200 pb-4">
                        <div className="flex items-center gap-2">
                            <LayoutList className="text-blue-500" size={24} />
                            <h3 className="text-xl font-semibold text-surface-800">Features Checklist</h3>
                        </div>
                        <button type="button" onClick={addFeature} className="btn-secondary text-sm flex items-center gap-2 py-1.5 px-3">
                            <Plus size={16} /> Add Feature
                        </button>
                    </div>

                    {features.length === 0 ? (
                        <div className="text-center py-8 text-surface-400 border-2 border-dashed border-surface-200 rounded-lg">
                            No features added yet. Click "Add Feature" to create one.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {features.map((feature, idx) => (
                                <div key={idx} className="p-4 bg-surface-50 border border-surface-200 rounded-lg relative group">
                                    <button type="button" onClick={() => removeFeature(idx)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={18} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                                        <div>
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Feature Title</label>
                                            <input type="text" value={feature.title} onChange={(e) => updateFeature(idx, 'title', e.target.value)} className="input-field py-1.5 text-sm" placeholder="e.g. Broadcast Campaigns" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Lucide Icon Name</label>
                                            <input type="text" value={feature.icon} onChange={(e) => updateFeature(idx, 'icon', e.target.value)} className="input-field py-1.5 text-sm" placeholder="e.g. Send, Zap, MessageSquare" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Description</label>
                                            <textarea value={feature.description} onChange={(e) => updateFeature(idx, 'description', e.target.value)} className="input-field py-1.5 text-sm h-16" placeholder="Feature description..." />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Testimonials Section */}
                <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4 border-b border-surface-200 pb-4">
                        <div className="flex items-center gap-2">
                            <Star className="text-yellow-500" size={24} />
                            <h3 className="text-xl font-semibold text-surface-800">Testimonials</h3>
                        </div>
                        <button type="button" onClick={addTestimonial} className="btn-secondary text-sm flex items-center gap-2 py-1.5 px-3">
                            <Plus size={16} /> Add Testimonial
                        </button>
                    </div>

                    {testimonials.length === 0 ? (
                        <div className="text-center py-8 text-surface-400 border-2 border-dashed border-surface-200 rounded-lg">
                            No testimonials added yet. Click "Add Testimonial" to create one.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {testimonials.map((testi, idx) => (
                                <div key={idx} className="p-4 bg-surface-50 border border-surface-200 rounded-lg relative group">
                                    <button type="button" onClick={() => removeTestimonial(idx)} className="absolute top-4 right-4 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={18} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                                        <div>
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Customer Name</label>
                                            <input type="text" value={testi.name} onChange={(e) => updateTestimonial(idx, 'name', e.target.value)} className="input-field py-1.5 text-sm" placeholder="e.g. Sarah Smith" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Role / Company</label>
                                            <input type="text" value={testi.role} onChange={(e) => updateTestimonial(idx, 'role', e.target.value)} className="input-field py-1.5 text-sm" placeholder="e.g. Sales Director, Acme Corp" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Avatar Image URL (Optional)</label>
                                            <input type="text" value={testi.avatarUrl} onChange={(e) => updateTestimonial(idx, 'avatarUrl', e.target.value)} className="input-field py-1.5 text-sm" placeholder="https://..." />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-surface-500 mb-1">Quote</label>
                                            <textarea value={testi.quote} onChange={(e) => updateTestimonial(idx, 'quote', e.target.value)} className="input-field py-1.5 text-sm h-16" placeholder="Customer quote..." />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Legal Documents Section */}
                <div className="bg-white p-6 rounded-xl border border-surface-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 border-b border-surface-200 pb-4">
                        <LayoutTemplate className="text-gray-500" size={24} />
                        <h3 className="text-xl font-semibold text-surface-800">Legal Documents (HTML/Text)</h3>
                    </div>
                    <p className="text-xs text-surface-500 mb-4">You can use basic HTML tags like &lt;p&gt;, &lt;h3&gt;, &lt;strong&gt;, &lt;ul&gt;, and &lt;li&gt;. Use <strong>&#123;&#123;appName&#125;&#125;</strong> to dynamically insert your current Brand Name, and <strong>&#123;&#123;supportEmail&#125;&#125;</strong> for the support email.</p>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Privacy Policy</label>
                            <textarea
                                value={settings.landingPrivacyPolicy}
                                onChange={(e) => setSettings({ ...settings, landingPrivacyPolicy: e.target.value })}
                                className="input-field h-40 font-mono text-xs"
                                placeholder="<h3>1. Information We Collect</h3><p>Welcome to {{appName}}...</p>"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Terms & Conditions</label>
                            <textarea
                                value={settings.landingTermsConditions}
                                onChange={(e) => setSettings({ ...settings, landingTermsConditions: e.target.value })}
                                className="input-field h-40 font-mono text-xs"
                                placeholder="<h3>1. Acceptance of Terms</h3><p>By using {{appName}} you agree...</p>"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-surface-800 mb-2">Refund Policy</label>
                            <textarea
                                value={settings.landingRefundPolicy}
                                onChange={(e) => setSettings({ ...settings, landingRefundPolicy: e.target.value })}
                                className="input-field h-40 font-mono text-xs"
                                placeholder="<h3>Refunds</h3><p>Contact us at {{supportEmail}}...</p>"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex justify-end items-center gap-4">
                    <span className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{message}</span>
                    <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto flex items-center justify-center">
                        <Save size={18} className="mr-2" />
                        {loading ? 'Saving...' : 'Publish to Landing Page'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LandingEditor;
