import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const RefundPolicy = () => {
    const { branding } = useBranding();
    const appName = branding?.name || 'Our Company';
    const supportEmail = branding?.supportEmail || 'support@example.com';

    let customHtml = branding?.landingRefundPolicy || '';
    if (customHtml) {
        customHtml = customHtml.replace(/\{\{appName\}\}/g, appName);
        customHtml = customHtml.replace(/\{\{supportEmail\}\}/g, supportEmail);
    }

    return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-surface-200 p-8">
                <div className="flex items-center gap-3 mb-8 border-b border-surface-100 pb-6">
                    <RefreshCcw className="h-8 w-8 text-brand-600" />
                    <h1 className="text-3xl font-bold text-surface-900">Cancellation & Refund Policy</h1>
                </div>

                <div className="prose prose-surface prose-brand max-w-none text-surface-600 space-y-6">
                    {customHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: customHtml }} />
                    ) : (
                        <>
                            <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

                            <p>At {appName}, we strive to provide the best possible experience. This Cancellation and Refund Policy describes under what circumstances we offer refunds for our subscription services.</p>

                            <h3 className="text-xl font-semibold text-surface-900">1. Cancellations</h3>
                            <p>You can cancel your subscription at any time from your account settings. After cancellation, your account will remain active until the end of the current paid billing period. We do not charge cancellation fees.</p>

                            <h3 className="text-xl font-semibold text-surface-900">2. Refund Eligibility</h3>
                            <p>Generally, payments are non-refundable. However, we may issue a full or partial refund in the following exceptional cases:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>You requested a refund within <strong>7 days</strong> of your initial purchase (and no heavy usage of the API was recorded).</li>
                                <li>An erroneous double charge occurred due to a system glitch.</li>
                                <li>We are unable to provide the core service for an extended period of time.</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-surface-900">3. Non-Refundable Scenarios</h3>
                            <p>We do not issue refunds for:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Accounts suspended due to a violation of our Terms & Conditions or spamming policies.</li>
                                <li>Unused limits or days in a billing cycle after the initial 7-day period.</li>
                                <li>Top-up balances loaded specifically for API message usage (Wallet balances).</li>
                            </ul>

                            <h3 className="text-xl font-semibold text-surface-900">4. Processing Time</h3>
                            <p>Approved refunds may take 5-10 business days to reflect on your original payment method, depending on the payment gateway and your bank.</p>

                            <h3 className="text-xl font-semibold text-surface-900">5. How to Request a Refund</h3>
                            <p>To request a refund, please send an email explaining your issue to our support team at <strong>{supportEmail}</strong>.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RefundPolicy;
