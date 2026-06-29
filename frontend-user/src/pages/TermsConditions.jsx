import React from 'react';
import { FileText } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const TermsConditions = () => {
    const { branding } = useBranding();
    const appName = branding?.name || 'Our Company';
    const supportEmail = branding?.supportEmail || 'support@example.com';

    let customHtml = branding?.landingTermsConditions || '';
    if (customHtml) {
        customHtml = customHtml.replace(/\{\{appName\}\}/g, appName);
        customHtml = customHtml.replace(/\{\{supportEmail\}\}/g, supportEmail);
    }

    return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-surface-200 p-8">
                <div className="flex items-center gap-3 mb-8 border-b border-surface-100 pb-6">
                    <FileText className="h-8 w-8 text-brand-600" />
                    <h1 className="text-3xl font-bold text-surface-900">Terms & Conditions</h1>
                </div>

                <div className="prose prose-surface prose-brand max-w-none text-surface-600 space-y-6">
                    {customHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: customHtml }} />
                    ) : (
                        <>
                            <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

                            <p>Welcome to {appName}. By accessing or using our platform, you agree to be bound by these Terms and Conditions. Please read them carefully.</p>

                            <h3 className="text-xl font-semibold text-surface-900">1. Acceptance of Terms</h3>
                            <p>By creating an account or subscribing to our services, you confirm that you accept these Terms and agree to comply with them. If you do not agree to these terms, you must not use our services.</p>

                            <h3 className="text-xl font-semibold text-surface-900">2. Service Provision</h3>
                            <p>{appName} provides a WhatsApp Business API management dashboard. We do not guarantee uninterrupted access to the Meta API. Platform access is subject to your adherence to WhatsApp's own Commerce and Business policies.</p>

                            <h3 className="text-xl font-semibold text-surface-900">3. User Responsibilities</h3>
                            <p>You are responsible for safeguarding your account credentials, maintaining the security of your workspace, and ensuring that any messages sent comply with local laws and anti-spam regulations (SPAM is strictly prohibited). Non-compliance may result in immediate suspension without refund.</p>

                            <h3 className="text-xl font-semibold text-surface-900">4. Payment and Subscriptions</h3>
                            <p>Subscription fees are billed in advance based on the selected billing cycle. Pricing is subject to change with prior notice. Plan features and limits apply as configured in your purchased tier.</p>

                            <h3 className="text-xl font-semibold text-surface-900">5. Limitation of Liability</h3>
                            <p>To the fullest extent permitted by law, {appName} shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the service or API downtime.</p>
                            
                            <h3 className="text-xl font-semibold text-surface-900">6. Termination</h3>
                            <p>We reserve the right to suspend or terminate your account at any time if you violate these Terms.</p>

                            <h3 className="text-xl font-semibold text-surface-900">7. Contact Us</h3>
                            <p>For questions regarding these Terms, please contact <strong>{supportEmail}</strong>.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TermsConditions;
