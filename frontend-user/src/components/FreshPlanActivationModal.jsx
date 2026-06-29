import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Sparkles, Check, ArrowRight, X, Phone, MessageCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useBranding } from '../context/BrandingContext';

const FreshPlanActivationModal = ({ account, isOpen, onClose, closable = true }) => {
    const { branding } = useBranding();
    const [plans, setPlans] = useState([]);
    const [config, setConfig] = useState({ ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' });
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showAllPlans, setShowAllPlans] = useState(false);
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const loadPlansAndConfig = async () => {
            try {
                const [configRes, plansRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/public/config`).catch(() => ({ data: { ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' } })),
                    axios.get(`${import.meta.env.VITE_API_URL || ''}/api/auth/plans`)
                ]);

                setConfig(configRes.data);
                const allPlans = plansRes.data;
                const filteredPlans = account?.usedFreePlan 
                    ? allPlans.filter(p => Number(p.price) !== 0)
                    : allPlans;
                setPlans(filteredPlans);

                // Default to user's selected plan if they have one
                if (account?.planId) {
                    const match = filteredPlans.find(p => p.id === account.planId);
                    if (match) {
                        setSelectedPlan(match);
                    } else if (filteredPlans.length > 0) {
                        setSelectedPlan(filteredPlans[0]);
                    }
                } else if (filteredPlans.length > 0) {
                    setSelectedPlan(filteredPlans[0]);
                }
            } catch (err) {
                console.error("Failed to load plans in activation modal", err);
            } finally {
                setLoading(false);
            }
        };

        loadPlansAndConfig();
    }, [isOpen, account]);

    if (!isOpen) return null;

    const handleWhatsAppSupport = () => {
        const supportPhone = branding?.supportPhoneNumber || '919999999999';
        const supportPhoneClean = supportPhone.replace(/[^0-9]/g, '');
        const text = `Hi! I need help with activating/renewing my plan: ${selectedPlan?.name || ''}. Please guide me.`;
        window.open(`https://wa.me/${supportPhoneClean}?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleCallSupport = () => {
        const supportPhone = branding?.supportPhoneNumber || '919999999999';
        const supportPhoneClean = supportPhone.replace(/[^0-9]/g, '');
        window.open(`tel:${supportPhoneClean}`, '_self');
    };

    const handlePayment = async () => {
        if (!selectedPlan) return;
        setPaymentLoading(true);

        try {
            // Free plan activation
            if (Number(selectedPlan.price) === 0) {
                await axios.post(
                    `${import.meta.env.VITE_API_URL || ''}/api/payment/free/activate`,
                    { planId: selectedPlan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );

                confetti({
                    particleCount: 200,
                    spread: 120,
                    origin: { y: 0.6 },
                    colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
                });

                alert(`Success! ${selectedPlan.name} has been activated.`);
                window.location.reload();
                return;
            }

            // Redirect flow for PhonePe, Airwallex, Stripe
            if (config.ACTIVE_PAYMENT_GATEWAY === 'STRIPE') {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL || ''}/api/payment/stripe/order`,
                    { planId: selectedPlan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                if (data.url) window.location.href = data.url;
                return;
            }

            if (config.ACTIVE_PAYMENT_GATEWAY === 'PHONEPE') {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL || ''}/api/payment/phonepe/order`,
                    { planId: selectedPlan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                if (data.url) window.location.href = data.url;
                return;
            }

            // Default: Razorpay
            const { data: orderData } = await axios.post(
                `${import.meta.env.VITE_API_URL || ''}/api/payment/razorpay/order`,
                { planId: selectedPlan.id },
                { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
            );

            if (orderData.free === true) {
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
                alert(`Success! ${selectedPlan.name} has been activated.`);
                window.location.reload();
                return;
            }

            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: "INR",
                name: branding?.name ? `${branding.name} Subscription` : "Subscription Setup",
                description: `Upgrade to ${orderData.planName}`,
                order_id: orderData.order.id,
                handler: async function (response) {
                    try {
                        await axios.post(
                            `${import.meta.env.VITE_API_URL || ''}/api/payment/razorpay/verify`,
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                planId: selectedPlan.id
                            },
                            { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                        );

                        confetti({
                            particleCount: 200,
                            spread: 120,
                            origin: { y: 0.6 }
                        });

                        alert("Payment successful! Your plan is now active.");
                        window.location.reload();
                    } catch (verifyError) {
                        alert("Payment verification failed. Please contact support.");
                    }
                },
                theme: { color: "#25D366" }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (res) {
                alert("Payment failed: " + res.error.description);
            });
            rzp.open();

        } catch (error) {
            alert(error.response?.data?.error || "Failed to initiate payment.");
        } finally {
            setPaymentLoading(false);
        }
    };

    const currencySymbol = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SAR: 'ر.स ', AED: 'د.إ ', QAR: 'QAR ' }[config.SYSTEM_CURRENCY] || '₹';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(11, 30, 18, 0.4)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-[#fcfdfe] border border-[#cde9d8] text-[#0b1e12] rounded-3xl w-full max-w-lg shadow-[0_12px_40px_rgba(18,140,126,0.15)] p-6 md:p-8 relative overflow-hidden max-h-[90vh] flex flex-col">
                
                {/* Close Button */}
                {closable && (
                    <button onClick={onClose} className="absolute right-4 top-4 p-2 text-[#4d7a62] hover:text-[#0b1e12] rounded-full bg-[#f3fbf6] transition z-10">
                        <X size={18} />
                    </button>
                )}

                {loading ? (
                    <div className="py-12 text-center text-[#4d7a62] flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading plan details...</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-1">
                        {/* Heading */}
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck size={32} className="text-[#25D366]" />
                            </div>
                            <h2 className="text-2xl font-black tracking-tight text-[#0b1e12]">Activate Your Workspace</h2>
                            <p className="text-sm text-[#4d7a62] mt-1">Please select and pay for a subscription plan to continue.</p>
                        </div>

                        {selectedPlan && (
                            <div className="bg-white border border-[#cde9d8] shadow-sm rounded-2xl p-5 mb-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-[#25D366]/10 text-[#25D366] text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-bl-xl border-l border-b border-[#cde9d8]">
                                    Selected Plan
                                </div>
                                <h3 className="text-lg font-extrabold text-[#0b1e12] flex items-center gap-2">
                                    <Sparkles size={16} className="text-[#25D366]" /> {selectedPlan.name}
                                </h3>
                                <div className="text-3xl font-black mt-2 text-[#0b1e12] flex items-baseline gap-1">
                                    {currencySymbol}{selectedPlan.price}
                                    <span className="text-xs text-[#4d7a62] font-medium">/{selectedPlan.duration_days} Days</span>
                                </div>

                                <ul className="mt-4 space-y-2 pt-4 border-t border-[#cde9d8]">
                                    {(selectedPlan.features_json || []).map((feat, idx) => (
                                        <li key={idx} className="flex items-start text-xs text-[#4d7a62]">
                                            <Check size={14} className="text-[#25D366] mr-2 mt-0.5 shrink-0" />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Plan selection trigger */}
                        <div className="mb-6">
                            <button 
                                onClick={() => setShowAllPlans(!showAllPlans)}
                                className="w-full text-center text-xs font-bold text-[#25D366] hover:text-[#128C7E] py-2 border border-dashed border-[#cde9d8] rounded-xl hover:bg-[#f0fdf5] transition flex items-center justify-center gap-1.5"
                            >
                                {showAllPlans ? "Hide Other Available Plans" : "Or Choose a Different Subscription Plan"}
                            </button>

                            {showAllPlans && (
                                <div className="mt-3 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {plans
                                        .filter(p => !(Number(p.price) === 0 && account?.usedFreePlan))
                                        .map(p => (
                                            <div 
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPlan(p);
                                                    setShowAllPlans(false);
                                                }}
                                                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                                                    selectedPlan?.id === p.id 
                                                        ? 'bg-[#f0fdf5] border-[#25D366] text-[#0b1e12]' 
                                                        : 'bg-[#fcfdfe] border-[#cde9d8] hover:border-[#25D366] text-[#4d7a62]'
                                                }`}
                                            >
                                                <div className="text-xs font-bold">{p.name}</div>
                                                <div className="text-xs font-black text-[#0b1e12]">{currencySymbol}{p.price}</div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Bottom Actions */}
                        <div className="space-y-3 pt-2">
                            <button
                                onClick={handlePayment}
                                disabled={paymentLoading}
                                className="w-full py-4 rounded-xl font-bold text-white border-none text-sm transition-all hover:-translate-y-px flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(37,211,102,0.25)]"
                                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                            >
                                {paymentLoading ? "Processing Payment..." : `Activate & Pay Now (${currencySymbol}${selectedPlan?.price || 0})`}
                                <ArrowRight size={16} />
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleWhatsAppSupport}
                                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-[#0b1e12] text-xs bg-white border border-[#cde9d8] hover:bg-[#f0fdf5] transition"
                                >
                                    <MessageCircle size={14} className="text-[#25D366]" /> WhatsApp Support
                                </button>
                                <button
                                    onClick={handleCallSupport}
                                    className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-[#0b1e12] text-xs bg-white border border-[#cde9d8] hover:bg-[#f0fdf5] transition"
                                >
                                    <Phone size={14} className="text-[#25D366]" /> Call Support
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FreshPlanActivationModal;
