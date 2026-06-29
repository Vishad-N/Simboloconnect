import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useBranding } from '../context/BrandingContext';

const FreshPricing = ({ isEmbedded }) => {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(null);
  const [config, setConfig] = useState({ ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' });
  const [currentUserPlan, setCurrentUserPlan] = useState(null);
  
  const isAuthenticated = !!localStorage.getItem('userToken');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const configRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/public/config`).catch(() => ({ data: { ACTIVE_PAYMENT_GATEWAY: 'RAZORPAY', SYSTEM_CURRENCY: 'INR' } }));
        const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/auth/plans`);
        
        let statusRes = { data: null };
        if (isAuthenticated) {
            statusRes = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/payment/status`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` }
            }).catch(() => ({ data: null }));
        }

        setPlans(res.data);
        setConfig(configRes.data);
        if (statusRes.data) setCurrentUserPlan(statusRes.data);
      } catch (error) {
        console.error("Failed fetching plans", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [isAuthenticated]);

  const handleUpgrade = async (plan) => {
    if (!isAuthenticated) {
        navigate('/register');
        return;
    }

    try {
        if (Number(plan.price) === 0) {
            await axios.post(
                `${import.meta.env.VITE_API_URL || ''}/api/payment/free/activate`,
                { planId: plan.id },
                { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
            );
            confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            setSuccessMessage(`Activated ${plan.name} successfully!`);
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        const gateway = config.ACTIVE_PAYMENT_GATEWAY?.toLowerCase() || 'razorpay';
        
        if (gateway !== 'razorpay') {
            const { data } = await axios.post(
                `${import.meta.env.VITE_API_URL || ''}/api/payment/${gateway}/order`,
                { planId: plan.id },
                { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
            );
            if (data.url) window.location.href = data.url;
            return;
        }

        // Razorpay flow
        const { data: orderData } = await axios.post(
            `${import.meta.env.VITE_API_URL || ''}/api/payment/razorpay/order`,
            { planId: plan.id },
            { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
        );

        if (orderData.free === true) {
            confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            setSuccessMessage(`Activated ${plan.name} successfully!`);
            setTimeout(() => window.location.reload(), 2000);
            return;
        }

        const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: "INR",
            name: branding?.name || "Subscription",
            description: `Upgrade to ${orderData.planName}`,
            order_id: orderData.order.id,
            handler: async function (response) {
                await axios.post(
                    `${import.meta.env.VITE_API_URL || ''}/api/payment/razorpay/verify`,
                    {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        planId: plan.id
                    },
                    { headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` } }
                );
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
                setSuccessMessage(`Upgraded to ${plan.name} successfully!`);
                setTimeout(() => window.location.reload(), 2000);
            },
            theme: { color: "#25D366" }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
    } catch (error) {
        alert(error.response?.data?.error || "Payment failed");
    }
  };

  const currSym = { INR: '₹', USD: '$', EUR: '€' }[config.SYSTEM_CURRENCY] || '₹';

  const css = `
    .fl-pricing-page { padding: 90px 6%; background: #f3fbf6; ${isEmbedded ? '' : 'min-height: 100vh;'} }
    .fl-sec-tag { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #25D366; margin-bottom: 10px; }
    .fl-sec-title { font-size: clamp(28px,3.5vw,44px); font-weight: 900; text-align: center; color: #0b1e12; margin-bottom: 14px; letter-spacing: -.8px; }
    .fl-sec-sub { text-align: center; color: #4d7a62; font-size: 16px; max-width: 500px; margin: 0 auto 60px; }
    
    .fl-plan-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(280px,1fr)); gap: 24px; max-width: 1020px; margin: 0 auto; justify-content: center; }
    .fl-plan-card { background: white; border: 1.5px solid #cde9d8; border-radius: 20px; padding: 36px 32px; position: relative; transition: all .25s; flex: 1; max-width: 400px; }
    .fl-plan-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(37,211,102,.12); }
    .fl-plan-card.popular { border-color: #25D366; border-width: 2px; box-shadow: 0 8px 32px rgba(37,211,102,.15); transform: scale(1.03); }
    .fl-plan-card.popular:hover { transform: scale(1.03) translateY(-6px); }
    
    .fl-plan-pop { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg,#25D366,#00df6a); color: white; font-size: 11px; font-weight: 900; border-radius: 100px; padding: 5px 18px; white-space: nowrap; letter-spacing: .5px; box-shadow: 0 4px 12px rgba(37,211,102,.35); }
    .fl-plan-name { font-size: 18px; font-weight: 900; color: #0b1e12; margin-bottom: 8px; }
    .fl-plan-price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
    .fl-plan-currency { font-size: 22px; font-weight: 800; color: #128C7E; }
    .fl-plan-amount { font-size: 48px; font-weight: 900; color: #0b1e12; line-height: 1; letter-spacing: -2px; }
    .fl-plan-period { font-size: 14px; color: #4d7a62; }
    .fl-plan-desc { font-size: 13px; color: #4d7a62; margin-bottom: 24px; line-height: 1.6; }
    
    .fl-plan-features { list-style: none; margin-bottom: 32px; display: flex; flex-direction: column; gap: 12px; }
    .fl-plan-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #0b1e12; }
    .fl-plan-features li::before { content: '✓'; color: #25D366; font-size: 15px; font-weight: 900; margin-top: 1px; }
    
    .fl-plan-btn-outline { display: block; width: 100%; padding: 13px; border-radius: 11px; border: 1.5px solid #cde9d8; color: #128C7E; font-size: 14px; font-weight: 800; text-align: center; text-decoration: none; transition: all .2s; background: white; cursor: pointer; font-family: inherit; }
    .fl-plan-btn-outline:hover { border-color: #25D366; background: #f0fdf5; }
    .fl-plan-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
    .fl-plan-btn-solid { display: block; width: 100%; padding: 14px; border-radius: 11px; background: linear-gradient(135deg,#25D366,#00df6a); color: white; font-size: 14px; font-weight: 900; text-align: center; text-decoration: none; border: none; cursor: pointer; font-family: inherit; box-shadow: 0 6px 20px rgba(37,211,102,.38); transition: all .2s; }
    .fl-plan-btn-solid:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(37,211,102,.48); }
    .fl-plan-btn-solid:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  return (
    <div className="fl-pricing-page" id={isEmbedded ? "pricing" : undefined}>
      <style>{css}</style>
      
      {/* If accessed without auth, show navigation header optionally? No, App.jsx wraps with Layout for logged in users.
          Wait, if it's public, it should have a header?
          Let's check how Pricing is rendered in App.jsx.
          In App.jsx, \`/pricing\` is OUTSIDE \`<PrivateRoute>\`. It doesn't have a Layout. 
          I should add a simple header. */}
      
      {!isEmbedded && !isAuthenticated && (
          <div style={{ position: 'absolute', top: 20, left: 30 }}>
              <Link to="/" style={{ textDecoration: 'none', color: '#0b1e12', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                 ← Back to Home
              </Link>
          </div>
      )}

      <div style={{ paddingTop: (!isEmbedded && !isAuthenticated) ? '40px' : '0' }}>
          <div className="fl-sec-tag">Pricing</div>
          <h2 className="fl-sec-title">Simple, Transparent Plans</h2>
          <p className="fl-sec-sub">Start free. No credit card required.</p>
          
          {successMessage && (
            <div style={{ background: '#dcfce7', color: '#166534', padding: '16px', borderRadius: '12px', textAlign: 'center', maxWidth: '600px', margin: '0 auto 30px', fontWeight: 'bold' }}>
              {successMessage}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center' }}>Loading plans...</div>
          ) : (
            <div className="fl-plan-grid">
              {plans.map((plan, idx) => {
                const isPopular = idx === 1 || plan.is_popular;
                const hasActivePlan = currentUserPlan?.validityExpiresAt && new Date(currentUserPlan.validityExpiresAt) > new Date();
                const isCurrentPlan = hasActivePlan && currentUserPlan?.planId === plan.id;
                const isFreePlanUsed = Number(plan.price) === 0 && currentUserPlan?.usedFreePlan;

                let periodLabel = 'mo';
                if (plan.duration_days === 365) periodLabel = 'yr';
                else if (plan.duration_days === 90) periodLabel = 'quarter';
                else if (plan.duration_days !== 30) periodLabel = plan.duration_days + 'd';

                return (
                  <div key={plan.id} className={`fl-plan-card ${isPopular ? 'popular' : ''}`}>
                    {isPopular && <div className="fl-plan-pop">MOST POPULAR</div>}
                    <div className="fl-plan-name">{plan.name}</div>
                    <div className="fl-plan-price">
                      <span className="fl-plan-currency">{currSym}</span>
                      <span className="fl-plan-amount">{plan.price}</span>
                      <span className="fl-plan-period">/{periodLabel}</span>
                    </div>
                    <div className="fl-plan-desc">{plan.description || "Everything you need to grow your business on WhatsApp."}</div>
                    
                    <ul className="fl-plan-features">
                      <li>{!plan.message_limit || plan.message_limit >= 999999 ? 'Unlimited' : plan.message_limit.toLocaleString()} messages</li>
                      <li>{!plan.contacts_limit || plan.contacts_limit >= 999999 ? 'Unlimited' : plan.contacts_limit.toLocaleString()} Contacts</li>
                      <li>{plan.bot_replies_limit >= 999999 ? 'Unlimited' : plan.bot_replies_limit} Bot Replies</li>
                      {(plan.features_json || []).map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                        <button disabled className="fl-plan-btn-outline">Current Plan</button>
                    ) : isFreePlanUsed ? (
                        <button disabled className="fl-plan-btn-outline">Already Used</button>
                    ) : (
                        <button 
                            onClick={() => {
                                if (isEmbedded) {
                                    navigate(isAuthenticated ? '/plans' : '/register');
                                } else {
                                    handleUpgrade(plan);
                                }
                            }} 
                            className={isPopular ? 'fl-plan-btn-solid' : 'fl-plan-btn-outline'}
                        >
                            {isEmbedded ? 'Get Started' : (isAuthenticated ? 'Upgrade Plan' : 'Get Started')}
                        </button>
                    )}
                  </div>
                );
              })}
              
              {/* Add a Custom Enterprise Plan to match the screenshot if there are only 2 dynamic plans */}
              {plans.length <= 2 && (
                  <div className="fl-plan-card">
                    <div className="fl-plan-name">Enterprise</div>
                    <div className="fl-plan-price">
                      <span style={{ fontSize: '36px', fontWeight: 900, color: '#25D366' }}>Custom</span>
                    </div>
                    <div className="fl-plan-desc">For large businesses with custom API needs, dedicated infrastructure, and SLAs.</div>
                    
                    <ul className="fl-plan-features">
                      <li>Unlimited messages</li>
                      <li>Unlimited Numbers</li>
                      <li>White Label Option</li>
                      <li>API Access</li>
                      <li>Dedicated Manager</li>
                    </ul>

                    <button onClick={() => window.location.href='/contact'} className="fl-plan-btn-outline">
                        Contact Sales
                    </button>
                  </div>
              )}

            </div>
          )}
      </div>
    </div>
  );
};

export default FreshPricing;
