import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Check, Zap, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useBranding } from '../context/BrandingContext';

const Pricing = () => {
    const { branding } = useBranding();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState(null);
    const [config, setConfig] = useState({ ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' });
    const [currentUserPlan, setCurrentUserPlan] = useState(null); // { planId, usedFreePlan, plan: {...} }

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const configRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/public/config`).catch(() => ({ data: { ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' } }));
                const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/auth/plans`);
                const statusRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/payment/status`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` }
                }).catch(() => ({ data: null }));

                setPlans(res.data);
                setConfig(configRes.data);
                if (statusRes.data) setCurrentUserPlan(statusRes.data);
            } catch (error) {
                console.error("Failed fetching plans", error);
            } finally {
                setLoading(false);
            }
        };

        const verifyGatewayRedirect = async () => {
            const params = new URLSearchParams(window.location.search);
            const sessionId = params.get('session_id');
            const gateway = params.get('gateway');
            const planId = params.get('planId');

            if (sessionId && gateway && planId) {
                try {
                    await axios.post(
                        `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/payment/${gateway.toLowerCase()}/verify`,
                        { session_id: sessionId, planId },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                    );
                    
                    const audio = new Audio('/sounds/success.mp3');
                    audio.volume = 0.6;
                    audio.play().catch(e => console.error("Audio block:", e));

                    confetti({
                        particleCount: 200,
                        spread: 120,
                        origin: { y: 0.6 },
                        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
                    });

                    setSuccessMessage(`Payment successful! You have upgraded your plan.`);
                    setTimeout(() => setSuccessMessage(null), 8000);

                    // clear params
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) {
                    alert("Payment verification failed.");
                }
            }
        };

        fetchPlans();
        verifyGatewayRedirect();
    }, []);

    const handleUpgrade = async (plan) => {
        try {
            if (Number(plan.price) === 0) {
                try {
                    await axios.post(
                        `${import.meta.env.VITE_API_URL || ''}/api/payment/free/activate`,
                        { planId: plan.id },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                    );

                    const audio = new Audio('/sounds/success.mp3');
                    audio.volume = 0.6;
                    audio.play().catch(e => console.error("Audio block:", e));

                    confetti({
                        particleCount: 200,
                        spread: 120,
                        origin: { y: 0.6 },
                        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
                    });

                    setSuccessMessage(`Thank you! You have successfully activated the ${plan.name}.`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } catch (freeError) {
                    alert("Free Plan Error: " + (freeError.response?.data?.error || freeError.message));
                    console.error("Free Plan Error:", freeError);
                }
                return;
            }

            if (config.ACTIVE_PAYMENT_GATEWAY === 'STRIPE') {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/payment/stripe/order`,
                    { planId: plan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                if (data.url) window.location.href = data.url;
                return;
            }

            if (config.ACTIVE_PAYMENT_GATEWAY === 'AIRWALLEX') {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/payment/airwallex/order`,
                    { planId: plan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                if (data.url) window.location.href = data.url;
                return;
            }

            if (config.ACTIVE_PAYMENT_GATEWAY === 'PHONEPE') {
                const { data } = await axios.post(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/payment/phonepe/order`,
                    { planId: plan.id },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                if (data.url) window.location.href = data.url;
                return;
            }

            // Default fallback is Razorpay
            // 1. Create Order
            const { data: orderData } = await axios.post(
                `${import.meta.env.VITE_API_URL || ''}/api/payment/razorpay/order`,
                { planId: plan.id },
                { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
            );

            // If backend detected free plan, it already activated it — no modal needed
            if (orderData.free === true) {
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'] });
                setSuccessMessage(`Thank you! You have successfully activated the ${plan.name}.`);
                setTimeout(() => window.location.reload(), 2000);
                return;
            }

            // 2. Open Razorpay Checkout Modal
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: "INR",
                name: branding?.name ? `${branding.name} Subscription` : "Subscription Setup",
                description: `Upgrade to ${orderData.planName}`,
                order_id: orderData.order.id,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment
                        await axios.post(
                            `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/payment/razorpay/verify`,
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                planId: plan.id
                            },
                            { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                        );

                        // 4. Play Success Sound
                        const audio = new Audio('/sounds/success.mp3');
                        audio.volume = 0.6;
                        audio.play().catch(e => console.error("Audio block:", e));

                        // 5. Trigger Canvas Confetti
                        confetti({
                            particleCount: 200,
                            spread: 120,
                            origin: { y: 0.6 },
                            colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899']
                        });

                        // 6. Show Success Message
                        setSuccessMessage(`Thank you for your purchase! You have successfully upgraded to the ${plan.name}.`);
                        setTimeout(() => setSuccessMessage(null), 8000);

                    } catch (verifyError) {
                        alert("Payment verification failed. Please contact support.");
                        console.error(verifyError);
                    }
                },
                theme: {
                    color: "#22c55e"
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                alert("Payment failed! " + response.error.description);
            });
            rzp.open();

        } catch (error) {
            alert(error.response?.data?.error || "Failed to initiate payment. Ensure gateway is configured.");
            console.error(error);
        }
    };

    return (
        <div className="py-12 min-h-screen" style={{ background: '#f4f7f5' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: '#0b1e12' }}>
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-xl" style={{ color: '#4d7a62' }}>
                        Everything you need to scale your WhatsApp marketing.
                    </p>
                </div>

                {successMessage && (
                    <div className="max-w-3xl mx-auto mt-8 bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-xl flex items-center shadow-sm animate-fade-in-down">
                        <CheckCircle2 className="w-6 h-6 mr-3 text-green-500 shrink-0" />
                        <span className="font-medium text-lg">{successMessage}</span>
                    </div>
                )}

                <div className="mt-16 justify-center grid gap-8 lg:grid-cols-3 md:grid-cols-2 lg:max-w-none items-start">
                    {loading ? (
                        <p className="text-center col-span-full">Loading pricing tiers...</p>
                    ) : plans.length === 0 ? (
                        <p className="text-center col-span-full text-white0">Contact sales for pricing details.</p>
                    ) : (
                        plans.map((plan) => (
                            <div key={plan.id} className="relative flex flex-col p-8 bg-white border border-[#cde9d8] shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold" style={{ color: '#0b1e12' }}>
                                        {plan.name}
                                    </h3>
                                    <Package className="h-6 w-6 text-brand-500" />
                                </div>
                                <div className="mt-4 flex items-baseline text-5xl font-extrabold" style={{ color: '#0b1e12' }}>
                                    {{ INR: '₹', USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', SAR: 'ر.س ', AED: 'د.إ ', QAR: 'QAR ' }[config.SYSTEM_CURRENCY] || '₹'}{plan.price}
                                    <span className="ml-1 text-lg font-medium text-gray-500">/{plan.duration_days === 30 ? 'mo' : plan.duration_days === 180 ? '6mo' : plan.duration_days === 365 ? 'yr' : plan.duration_days + 'd'}</span>
                                </div>
                                <p className="mt-4 text-sm" style={{ color: '#4d7a62' }}>
                                    Everything you need to get your business on WhatsApp.
                                </p>
                                <ul className="mt-8 space-y-4 flex-1 border-t border-[#e8f5ee] pt-6">
                                    {(plan.features_json || []).map((feature, idx) => (
                                        <li key={idx} className="flex items-start">
                                            <Check className="flex-shrink-0 w-5 h-5 text-[#25D366] mt-0.5" aria-hidden="true" />
                                            <span className="ml-3 text-sm font-medium" style={{ color: '#2d5c42' }}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                {(() => {
                                    const hasActivePlan = currentUserPlan?.validityExpiresAt && new Date(currentUserPlan.validityExpiresAt) > new Date();
                                    const isCurrentPlan = hasActivePlan && currentUserPlan?.planId === plan.id;
                                    const isFreePlanUsed = Number(plan.price) === 0 && currentUserPlan?.usedFreePlan;

                                    if (isCurrentPlan) {
                                        return (
                                            <button
                                                disabled
                                                className="mt-8 flex items-center justify-center gap-2 w-full bg-[#f0fdf5] border border-[#25D366] rounded-xl py-3 px-6 text-center text-sm font-bold text-[#16a34a] cursor-not-allowed"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Activated
                                            </button>
                                        );
                                    }
                                    if (isFreePlanUsed) {
                                        return (
                                            <button
                                                disabled
                                                className="mt-8 flex items-center justify-center gap-2 w-full bg-surface-200/10 border border-surface-500/30 rounded-md py-3 px-6 text-center text-sm font-medium text-surface-500 cursor-not-allowed"
                                            >
                                                Already Used
                                            </button>
                                        );
                                    }
                                    return (
                                        <button
                                            onClick={() => handleUpgrade(plan)}
                                            className="mt-8 block w-full bg-[#25D366] border border-transparent rounded-xl py-3 px-6 text-center text-sm font-bold text-white hover:bg-[#16a34a] shadow-sm hover:shadow transition-all"
                                        >
                                            Upgrade to {plan.name}
                                        </button>
                                    );
                                })()}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Pricing;
