import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useBranding } from '../context/BrandingContext';
import * as Icons from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';

const DynamicIcon = ({ name, className }) => {
    const defaultIconStr = 'MessageSquare';
    const IconComponent = Icons[name] || Icons[defaultIconStr] || Icons.HelpCircle;
    return <IconComponent className={className} />;
};

const Landing = () => {
    const { branding, loading: brandingLoading } = useBranding();
    const [plans, setPlans] = useState([]);
    const [config, setConfig] = useState({ SYSTEM_CURRENCY: 'INR' });
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'quarterly' | 'yearly'
    
    // Parse JSON safely
    const features = (() => {
        try {
            const arr = JSON.parse(branding?.landingFeaturesJson || '[]');
            return arr.length > 0 ? arr : null;
        } catch (e) {
            return null;
        }
    })();

    const testimonials = (() => {
        try {
            const arr = JSON.parse(branding?.landingTestimonialsJson || '[]');
            if (arr.length > 0) return arr;
        } catch (e) {
        }
        return [
            { id: 1, name: "Aman", role: "Business Owner", company: "Local Store", quote: "This platform has completely transformed how I handle customer support. The AI integration works like magic and the CRM tools are intuitive and fast.", avatarUrl: "" },
            { id: 2, name: "Pragya", role: "Marketing Director", company: "Platform", quote: "I love the webhook integrations and auto-replies. It saves me 10 hours a week in manual work. Sending broadcast messages is now a breeze!", avatarUrl: "" }
        ];
    })();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const configRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/config`).catch(() => ({ data: { SYSTEM_CURRENCY: 'INR' } }));
                setConfig(configRes.data);

                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/plans`);
                setPlans(res.data);
            } catch (error) {
                console.error("Failed fetching plans", error);
            }
        };
        fetchData();
    }, []);

    const defaultFeatures = [
        { title: "Green Tick Verification", icon: "Globe2", description: "Apply for the official WhatsApp Green Tick badge directly from our platform to build trust with your customers." },
        { title: "AI Chatbot Builder", icon: "Bot", description: "Create intelligent conversational flows using our drag-and-drop builder, integrated seamlessly with OpenAI." },
        { title: "Broadcast Campaigns", icon: "Target", description: "Send personalized bulk messages to thousands of customers securely with guaranteed delivery and analytics." },
        { title: "Shared Team Inbox", icon: "Users", description: "Collaborate with unlimited agents on a single WhatsApp number. Assign chats, add private notes, and resolve tickets faster." },
        { title: "API & Webhooks", icon: "Zap", description: "Connect your CRM, Shopify, or custom apps easily using our robust REST APIs and real-time event webhooks." },
        { title: "Secure & Compliant", icon: "ShieldCheck", description: "End-to-end encrypted messaging complying with global data protection norms (GDPR ready)." },
    ];
    const displayFeatures = features || defaultFeatures;

    // Filter plans by billing cycle
    const cycleMap = { monthly: 30, quarterly: 90, yearly: 365 };
    const filteredPlans = plans.filter(p => p.duration_days === cycleMap[billingCycle]);
    // Fallback: if no plans for selected cycle, show all plans
    const displayPlans = filteredPlans.length > 0 ? filteredPlans : plans;

    const CYCLES = [
        { key: 'monthly', label: 'Monthly' },
        { key: 'quarterly', label: 'Quarterly', badge: 'Save 10%' },
        { key: 'yearly', label: 'Yearly', badge: 'Save 20%' },
    ];

    const currSymbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SAR: 'ر.س ', AED: 'د.إ ', QAR: 'QAR ' };
    const currSym = currSymbols[config.SYSTEM_CURRENCY] || '₹';

    // Support WhatsApp link from branding
    const supportPhone = branding?.supportPhoneNumber || branding?.supportPhone || branding?.phone || '';
    const helpLink = supportPhone ? `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}` : null;


    return (
        <div className="bg-surface-950 min-h-screen text-white font-sans selection:bg-brand-500 selection:text-white">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-surface-950/80 backdrop-blur-md border-b border-surface-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3">
                            {branding?.logoUrl ? (
                                <img src={branding.logoUrl} alt="Logo" className="h-16 w-auto max-w-[250px] object-contain" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                                    <Icons.MessageSquare size={20} className="text-white" />
                                </div>
                            )}
                        </div>
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-sm font-medium text-surface-300 hover:text-white transition-colors">Features</a>
                            <a href="#pricing" className="text-sm font-medium text-surface-300 hover:text-white transition-colors">Pricing</a>
                            <a href="#testimonials" className="text-sm font-medium text-surface-300 hover:text-white transition-colors">Testimonials</a>
                            <Link to="/contact" className="text-sm font-medium text-surface-300 hover:text-white transition-colors">Contact Us</Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <LanguageSwitcher className="hidden md:block w-32" />
                            <Link to="/login" className="text-sm font-medium text-surface-300 hover:text-white transition-colors hidden md:block">Sign In</Link>
                            <Link to="/register" className="bg-brand-500 hover:bg-brand-400 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 shadow-lg shadow-brand-500/20">
                                {branding?.trialEnabled !== false ? 'Start Free Trial' : 'Get Started Now'}
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Advanced Glowing Orbs Background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-brand-600/20 blur-[120px] mix-blend-screen animate-pulse"></div>
                    <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '4s' }}></div>
                </div>
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-8 backdrop-blur-sm opacity-100">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                            </span>
                            <span className="text-sm font-medium tracking-wide">Next-Gen WhatsApp API Platform Live</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight opacity-100">
                            {branding?.landingHeroTitle && branding.landingHeroTitle.trim() !== '' ? branding.landingHeroTitle : (
                                <>Automate your business on <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">WhatsApp</span></>
                            )}
                        </h1>
                        <p className="text-xl text-surface-400 mb-10 max-w-2xl mx-auto leading-relaxed opacity-100">
                            {branding?.landingHeroSubtitle && branding.landingHeroSubtitle.trim() !== '' ? branding.landingHeroSubtitle : "Scale your sales, marketing, and support with the ultimate WhatsApp Business API suite. Build AI chatbots, launch campaigns, and support customers seamlessly."}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-100">
                            <Link to="/register" className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl text-lg font-bold transition-all shadow-[0_0_40px_-10px_var(--color-brand-500)] flex items-center justify-center gap-2 group hover:scale-[1.02]">
                                {branding?.trialEnabled !== false ? `Start ${branding?.trialDurationDays || 7}-Day Free Trial` : 'Get Started Now'}
                                <Icons.ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link to="/login" className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-bold border border-white/10 backdrop-blur-md transition-all flex items-center justify-center gap-2">
                                Sign into Workspace
                            </Link>
                        </div>
                        <p className="mt-8 text-sm text-white0 font-medium opacity-100">
                            {branding?.trialEnabled !== false ? 'No credit card required. Cancel anytime.' : 'Quick registration. Set up your workspace instantly.'}
                        </p>
                    </div>

                    {/* Premium App UI Mockup */}
                    <div className="mt-20 relative max-w-5xl mx-auto animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <div className="absolute inset-x-10 -bottom-10 -top-10 bg-gradient-to-b from-transparent via-brand-500/10 to-transparent blur-3xl rounded-full pointer-events-none"></div>
                        <div className="relative rounded-2xl border border-white/10 bg-surface-900/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col">
                            {/* Fake Browser/Window Header */}
                            <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/[0.02]">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                </div>
                                <div className="mx-auto px-16 py-1.5 rounded-lg text-xs text-white0 font-mono bg-surface-950/50 border border-white/5 flex items-center justify-center gap-2 hidden md:flex">
                                    <Icons.Lock size={12} className="text-surface-600" />
                                    app.{branding?.name?.toLowerCase().replace(/\s+/g, '') || 'yourdomain'}.com
                                </div>
                                <div className="ml-auto w-10"></div>
                            </div>
                            {/* Fake Window Body */}
                            <div className="flex h-[350px] md:h-[450px]">
                                {/* Realist Sidebar */}
                                <div className="w-20 md:w-64 border-r border-white/10 p-4 flex flex-col gap-2 bg-surface-900/50">
                                    <div className="text-xs font-bold text-white0 uppercase tracking-wider mb-4 hidden md:block px-2">Main Menu</div>
                                    <div className="flex items-center gap-3 w-full bg-brand-500/20 text-brand-400 px-3 py-2.5 rounded-lg border border-brand-500/30">
                                        <Icons.LayoutDashboard size={18} />
                                        <span className="text-sm font-semibold hidden md:block">Dashboard</span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full hover:bg-white/5 text-surface-400 hover:text-white px-3 py-2.5 rounded-lg transition-colors">
                                        <Icons.MessageSquare size={18} />
                                        <span className="text-sm font-medium hidden md:block">Team Inbox</span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full hover:bg-white/5 text-surface-400 hover:text-white px-3 py-2.5 rounded-lg transition-colors">
                                        <Icons.Send size={18} />
                                        <span className="text-sm font-medium hidden md:block">Campaigns</span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full hover:bg-white/5 text-surface-400 hover:text-white px-3 py-2.5 rounded-lg transition-colors">
                                        <Icons.Users size={18} />
                                        <span className="text-sm font-medium hidden md:block">Contacts</span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full hover:bg-white/5 text-surface-400 hover:text-white px-3 py-2.5 rounded-lg transition-colors mt-auto">
                                        <Icons.Settings size={18} />
                                        <span className="text-sm font-medium hidden md:block">Settings</span>
                                    </div>
                                </div>
                                {/* Realistic Main Content */}
                                <div className="flex-1 p-6 md:p-10 flex flex-col bg-surface-950/40 relative overflow-hidden">
                                    {/* Abstract Mesh overlay in Dashboard */}
                                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-500/10 blur-3xl rounded-full"></div>
                                    
                                    <h2 className="text-2xl font-bold text-white mb-6 tracking-tight relative z-10">WhatsApp Overview</h2>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 relative z-10">
                                        <div className="bg-surface-800/80 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-lg">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400"><Icons.MessageCircle size={20}/></div>
                                                <span className="text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded-full">+12.5%</span>
                                            </div>
                                            <p className="text-sm text-surface-400 font-medium">Messages Sent</p>
                                            <p className="text-3xl font-extrabold text-white mt-1">24,592</p>
                                        </div>
                                        <div className="bg-surface-800/80 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-lg">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center border border-brand-500/30 text-brand-400"><Icons.Users size={20}/></div>
                                                <span className="text-brand-400 text-xs font-bold bg-brand-500/10 px-2 py-1 rounded-full">+5.2%</span>
                                            </div>
                                            <p className="text-sm text-surface-400 font-medium">Active Contacts</p>
                                            <p className="text-3xl font-extrabold text-white mt-1">8,104</p>
                                        </div>
                                        <div className="bg-surface-800/80 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-lg hidden md:block">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400"><Icons.BarChart3 size={20}/></div>
                                                <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 px-2 py-1 rounded-full">98.2%</span>
                                            </div>
                                            <p className="text-sm text-surface-400 font-medium">Delivery Rate</p>
                                            <p className="text-3xl font-extrabold text-white mt-1">Excellent</p>
                                        </div>
                                    </div>

                                    {/* Realistic Chat Preview */}
                                    <div className="flex-1 bg-surface-800/50 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col relative z-10">
                                        <div className="bg-surface-900/80 border-b border-white/10 px-4 py-3 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-inner">JD</div>
                                            <div>
                                                <p className="text-sm font-bold text-white">John Doe</p>
                                                <p className="text-xs text-brand-400">Online</p>
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col gap-3 overflow-hidden">
                                            <div className="bg-surface-700/80 border border-white/5 text-surface-200 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm self-start max-w-[80%] shadow-sm">
                                                Hi! I'd like to automate my WhatsApp customer support.
                                            </div>
                                            <div className="bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm self-end max-w-[80%] shadow-md border border-brand-400/50">
                                                Hello John! You're at the right place. Our platform can connect your number in 2 minutes. Ready to start?
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="border-y border-surface-800 bg-surface-900/40 backdrop-blur-sm relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <p className="text-4xl font-bold tracking-tight text-white mb-2">99.9%</p>
                            <p className="text-surface-400 text-sm font-medium uppercase tracking-wider">Uptime SLA</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold tracking-tight text-white mb-2">10M+</p>
                            <p className="text-surface-400 text-sm font-medium uppercase tracking-wider">Messages Daily</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold tracking-tight text-white mb-2">&lt;1s</p>
                            <p className="text-surface-400 text-sm font-medium uppercase tracking-wider">Delivery Speed</p>
                        </div>
                        <div>
                            <p className="text-4xl font-bold tracking-tight text-white mb-2">500+</p>
                            <p className="text-surface-400 text-sm font-medium uppercase tracking-wider">Active Businesses</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
                        <h2 className="text-sm font-bold text-brand-400 tracking-wider uppercase mb-3">Powerful features</h2>
                        <h3 className="text-4xl md:text-5xl font-bold mb-6">Everything you need to scale on WhatsApp</h3>
                        <p className="text-lg text-surface-400">Replace 10 different tools with one unified inbox and automation platform.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {displayFeatures.map((feature, idx) => (
                            <div key={idx} className="relative p-[1px] rounded-3xl overflow-hidden group hover:-translate-y-2 transition-transform duration-500 shadow-xl">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent group-hover:from-brand-500/50 group-hover:to-indigo-500/20 transition-colors duration-500 z-0"></div>
                                <div className="relative h-full bg-surface-900/90 backdrop-blur-xl p-8 rounded-[23px] z-10 flex flex-col">
                                    <div className="w-14 h-14 bg-gradient-to-br from-surface-800 to-surface-800/50 rounded-2xl flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 group-hover:border-brand-500/30 group-hover:shadow-[0_0_20px_-5px_var(--color-brand-500)] transition-all duration-300">
                                        <DynamicIcon name={feature.icon} className="text-brand-400 drop-shadow-[0_0_8px_rgba(var(--color-brand-400),0.5)]" />
                                    </div>
                                    <h4 className="text-xl font-bold mb-3 text-white tracking-tight">{feature.title}</h4>
                                    <p className="text-surface-400 leading-relaxed text-sm">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 relative bg-surface-900 border-y border-surface-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-10 max-w-3xl mx-auto">
                        <h2 className="text-sm font-bold text-brand-400 tracking-wider uppercase mb-3">Fair Pricing</h2>
                        <h3 className="text-4xl md:text-5xl font-bold mb-6">Simple, transparent pricing</h3>
                        <p className="text-lg text-surface-400 mb-8">Start for free. Upgrade when you need more power.</p>

                        {/* Billing Cycle Toggle */}
                        <div className="inline-flex items-center gap-1 p-1 bg-surface-800 rounded-full border border-surface-700 shadow-inner">
                            {CYCLES.map(cycle => (
                                <button
                                    key={cycle.key}
                                    onClick={() => setBillingCycle(cycle.key)}
                                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                                        billingCycle === cycle.key
                                            ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                                            : 'text-surface-400 hover:text-white'
                                    }`}
                                >
                                    {cycle.label}
                                    {cycle.badge && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                            billingCycle === cycle.key
                                                ? 'bg-white/20 text-white'
                                                : 'bg-green-500/20 text-green-400'
                                        }`}>
                                            {cycle.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-3 md:grid-cols-2 lg:max-w-7xl mx-auto items-center">
                        {displayPlans.length === 0 ? (
                            <p className="text-center col-span-full text-white0">No {billingCycle} plans available. Check other billing cycles.</p>
                        ) : (
                            displayPlans.map((plan, idx) => {
                                const isPopular = idx === 1;
                                const featureList = Array.isArray(plan.features_json) ? plan.features_json : [];
                                return (
                                    <div key={plan.id} className={`relative flex flex-col p-8 rounded-3xl transition-all duration-500 hover:-translate-y-2 ${isPopular ? "bg-surface-900 border border-brand-500/50 shadow-[0_0_50px_-12px_var(--color-brand-500)] scale-105 z-20 backdrop-blur-xl" : "bg-white/[0.02] border border-white/10 backdrop-blur-md hover:border-white/20 z-10"}`}>
                                        {isPopular && (
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-brand-600 to-indigo-500 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg shadow-brand-500/30 border border-white/20">
                                                Most Popular
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <h3 className={`text-xl font-bold ${isPopular ? 'text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-white' : 'text-white'}`}>{plan.name}</h3>
                                            <Icons.Package className={`h-6 w-6 ${isPopular ? 'text-brand-300' : 'text-white0'}`} />
                                        </div>
                                        <div className="mt-6 flex items-baseline text-5xl font-extrabold text-white">
                                            <span className={`text-3xl mr-1 ${isPopular ? 'text-brand-300/70' : 'text-white0'}`}>{currSym}</span>
                                            {plan.price}
                                            <span className={`ml-1 text-lg font-medium ${isPopular ? 'text-brand-200/50' : 'text-white0'}`}>
                                                /{plan.duration_days === 30 ? 'Monthly' : plan.duration_days === 90 ? 'Quarterly' : plan.duration_days === 180 ? 'Half-Yearly' : plan.duration_days === 365 ? 'Yearly' : plan.duration_days + 'd'}
                                            </span>
                                        </div>

                                        {/* Plan Limits Display */}
                                        <div className={`mt-6 grid grid-cols-2 gap-y-4 gap-x-2 p-5 rounded-2xl shadow-inner ${isPopular ? 'bg-gradient-to-br from-brand-500/10 to-surface-900 border border-brand-500/30' : 'bg-surface-800/30 border border-surface-700/50'}`}>
                                            {[
                                                { label: 'Messages', val: plan.message_limit, icon: 'MessageSquare' },
                                                { label: 'Contacts', val: plan.contacts_limit, icon: 'Users' },
                                                { label: 'Campaigns/mo', val: plan.campaigns_limit, icon: 'Megaphone' },
                                                { label: 'Bot Replies', val: plan.bot_replies_limit, icon: 'Bot' },
                                                { label: 'Bot Flows', val: plan.bot_flows_limit, icon: 'Zap' },
                                                { label: 'Team', val: plan.team_members_limit, icon: 'UserCheck' },
                                            ].map(({ label, val, icon }) => {
                                                const IconCmp = Icons[icon] || Icons.CheckCircle2;
                                                return (
                                                    <div key={label} className="flex items-start gap-2.5">
                                                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${isPopular ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-700/50 text-surface-400'}`}>
                                                            <IconCmp size={14} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase font-bold tracking-wider text-white0 line-clamp-1">{label}</span>
                                                            <span className={`text-sm font-extrabold ${isPopular ? 'text-white' : 'text-surface-200'}`}>
                                                                {!val || val >= 999999 ? <span className="text-green-400">Unlimited</span> : val.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <ul className="space-y-3 flex-1">
                                            {featureList.map((feat, i) => (
                                                <li key={i} className="flex items-start">
                                                    <Icons.CheckCircle2 className={`flex-shrink-0 w-5 h-5 mt-0.5 ${isPopular ? 'text-brand-400' : 'text-surface-600'}`} />
                                                    <span className="ml-3 text-surface-200 text-sm leading-relaxed">{feat}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <Link to="/register" className={`mt-8 block w-full rounded-xl py-4 px-6 text-center text-sm font-bold transition-all ${isPopular ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.02]' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:text-white transition-colors'}`}>
                                            Get Started Today
                                        </Link>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>


            {/* Testimonials Section */}
            {testimonials && (
                <section id="testimonials" className="py-24 relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center mb-16 max-w-3xl mx-auto">
                            <h2 className="text-sm font-bold text-brand-400 tracking-wider uppercase mb-3">Wall of Love</h2>
                            <h3 className="text-4xl md:text-5xl font-bold mb-6">What our customers say</h3>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 lg:max-w-5xl mx-auto">
                            {testimonials.map((testi, idx) => (
                                <div key={idx} className="relative p-[1px] rounded-3xl overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent z-0"></div>
                                    <div className="relative h-full bg-surface-900/90 backdrop-blur-xl p-8 rounded-[23px] z-10 flex flex-col justify-between hover:bg-surface-800/90 transition-colors duration-500">
                                        <div>
                                            <div className="flex gap-1 mb-6 text-amber-400">
                                                {[...Array(5)].map((_, i) => <Icons.Star key={i} size={18} fill="currentColor" />)}
                                            </div>
                                            <p className="text-lg text-surface-200 mb-8 italic leading-relaxed">"{testi.quote}"</p>
                                        </div>
                                        <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                                            <div className="w-12 h-12 bg-gradient-to-br from-brand-500/40 to-indigo-500/40 border border-white/10 rounded-full overflow-hidden flex items-center justify-center shadow-inner">
                                                {testi.avatarUrl ? (
                                                    <img src={testi.avatarUrl} alt={testi.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-white font-bold">{testi.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-white tracking-tight">{testi.name}</h5>
                                                <p className="text-sm text-surface-400 font-medium">{testi.role}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-600"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-500 via-brand-600 to-brand-900 opacity-80 backdrop-blur-3xl"></div>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to transform your communication?</h2>
                    <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto drop-shadow-sm">
                        Join thousands of modern businesses globally. Set up your WhatsApp API in under 5 minutes.
                    </p>
                    <Link to="/register" className="bg-white text-brand-600 hover:bg-surface-50 px-8 py-4 rounded-xl text-lg font-extrabold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 hover:scale-105 inline-flex items-center gap-2">
                        Get Started For Free
                        <Icons.ArrowRight size={20} />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-surface-950 border-t border-surface-800 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
                        <div className="flex items-center gap-2">
                            {branding?.logoUrl ? (
                                <img src={branding.logoUrl} alt="Logo" className="h-10 w-auto max-w-[200px] object-contain mix-blend-multiply" />
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                                    <Icons.MessageSquare size={16} className="text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <a href="#features" className="text-surface-400 hover:text-white transition-colors text-sm">Features</a>
                            <a href="#pricing" className="text-surface-400 hover:text-white transition-colors text-sm">Pricing</a>
                            <a href="#testimonials" className="text-surface-400 hover:text-white transition-colors text-sm">Testimonials</a>
                            <Link to="/contact" className="text-surface-400 hover:text-white transition-colors text-sm">Contact Us</Link>
                        </div>
                    </div>
                    <div className="flex flex-col items-center md:items-start text-center md:text-left mt-6 md:mt-0">
                        <p className="text-white0 text-sm">© {new Date().getFullYear()} {branding?.name || 'Workspace'}. All rights reserved.</p>
                        <div className="flex flex-wrap gap-4 mt-2 justify-center">
                            <Link to="/privacy-policy" className="text-surface-400 hover:text-white transition-colors text-xs">Privacy Policy</Link>
                            <Link to="/terms-conditions" className="text-surface-400 hover:text-white transition-colors text-xs">Terms & Conditions</Link>
                            <Link to="/refund-policy" className="text-surface-400 hover:text-white transition-colors text-xs">Cancellation & Refund Policy</Link>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <Link to="/login" className="text-surface-300 hover:text-white transition-colors text-sm font-semibold">Login</Link>
                        <Link to="/register" className="text-surface-300 hover:text-white transition-colors text-sm font-semibold">Sign Up</Link>
                    </div>
                </div>
            </footer>
            {/* Floating WhatsApp Help Widget */}
            <div className="fixed bottom-6 right-6 z-[9999] group">
                <a
                    href={helpLink || 'https://wa.me/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-lg shadow-green-500/40 hover:bg-[#20ba5a] transition-all hover:scale-110 hover:shadow-green-500/60 relative"
                    title="Chat with Support"
                >
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30"></span>
                    {/* WhatsApp SVG Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-8 h-8 text-white" fill="currentColor">
                        <path d="M16 2C8.27 2 2 8.27 2 16c0 2.48.65 4.82 1.79 6.84L2 30l7.39-1.77A13.94 13.94 0 0016 30c7.73 0 14-6.27 14-14S23.73 2 16 2zm6.94 19.46c-.29.81-1.69 1.55-2.33 1.64-.6.09-1.35.13-2.17-.14-.5-.16-1.14-.38-1.95-.74-3.44-1.48-5.68-4.95-5.85-5.18-.17-.23-1.4-1.86-1.4-3.55 0-1.69.88-2.52 1.19-2.86.31-.34.68-.43.91-.43.23 0 .45.01.65.01s.51-.08.8.61c.29.71 1 2.44 1.09 2.61.09.17.14.37.03.59-.11.22-.17.36-.34.55-.17.2-.35.43-.5.58-.17.17-.35.35-.15.69.2.34.89 1.46 1.92 2.36 1.33 1.17 2.44 1.52 2.79 1.69.34.17.54.14.74-.09.2-.23.87-1.01 1.1-1.35.23-.34.46-.28.77-.17.31.11 1.97.93 2.31 1.1.34.17.57.25.65.39.09.14.09.8-.2 1.6z"/>
                    </svg>
                </a>
                {/* Tooltip */}
                <div className="absolute right-16 bottom-3 bg-surface-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap border border-surface-700">
                    💬 Chat with Support
                    <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-surface-900 border-t border-r border-surface-700 rotate-45"></div>
                </div>
            </div>
        </div>
    );
};

export default Landing;
