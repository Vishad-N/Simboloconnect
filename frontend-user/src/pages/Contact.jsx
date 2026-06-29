import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const Contact = () => {
    const { branding, loading } = useBranding();
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [status, setStatus] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Simulate sending email
        setStatus('sending');
        setTimeout(() => {
            setStatus('success');
            setFormData({ name: '', email: '', message: '' });
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-surface-950 text-white font-sans flex flex-col">
            <nav className="border-b border-surface-800 bg-surface-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        {!loading && branding?.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-12 w-auto object-contain mix-blend-multiply" />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                                <MessageSquare size={20} className="text-white" />
                            </div>
                        )}
                    </Link>
                    <Link to="/" className="text-sm font-medium text-surface-300 hover:text-white transition-colors">
                        Back to Home
                    </Link>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid grid-cols-1 md:grid-cols-2 gap-12 w-full">
                <div>
                    <h1 className="text-4xl font-bold mb-6">Contact Us</h1>
                    <p className="text-surface-400 mb-10 text-lg">
                        Have questions about our platform, pricing, or need technical support? We're here to help. Reach out to our team.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-surface-300">
                            <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-brand-400">
                                <Mail size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white0">Email</p>
                                <p className="text-lg">support@{branding?.name ? branding.name.toLowerCase().replace(/\s+/g, '') : 'example'}.com</p>
                            </div>
                        </div>

                        {branding?.supportPhoneNumber && (
                            <div className="flex items-center gap-4 text-surface-300">
                                <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-brand-400">
                                    <Phone size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white0">Phone / WhatsApp</p>
                                    <p className="text-lg">{branding.supportPhoneNumber}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 text-surface-300">
                            <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-brand-400">
                                <MapPin size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white0">Location</p>
                                <p className="text-lg">Global Operations</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-900 border border-surface-800 p-8 rounded-2xl shadow-xl">
                    <h3 className="text-2xl font-bold mb-6">Send us a message</h3>
                    {status === 'success' ? (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3">
                            <Send size={20} />
                            <p>Your message has been sent successfully. We will get back to you soon.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-surface-800 border border-surface-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-surface-800 border border-surface-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Message</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full bg-surface-800 border border-surface-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-brand-500 resize-none"
                                    placeholder="How can we help you?"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={status === 'sending'}
                                className="w-full bg-brand-500 hover:bg-brand-400 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                            >
                                {status === 'sending' ? 'Sending...' : 'Send Message'}
                                {!status && <Send size={18} />}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Contact;
