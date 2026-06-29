import React from 'react';
import { Shield } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const PrivacyPolicy = () => {
    const { branding } = useBranding();
    const appName = branding?.name || 'Our Company';
    const supportEmail = branding?.supportEmail || 'support@example.com';

    let customHtml = branding?.landingPrivacyPolicy || '';
    if (customHtml) {
        customHtml = customHtml.replace(/\{\{appName\}\}/g, appName);
        customHtml = customHtml.replace(/\{\{supportEmail\}\}/g, supportEmail);
    }

    return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-surface-200 p-8">
                <div className="flex items-center gap-3 mb-8 border-b border-surface-100 pb-6">
                    <Shield className="h-8 w-8 text-brand-600" />
                    <h1 className="text-3xl font-bold text-surface-900">Privacy Policy</h1>
                </div>

                <div className="prose prose-surface prose-brand max-w-none text-surface-600 space-y-6">
                    {customHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: customHtml }} />
                    ) : (
                        <>
                            <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

                            <p>Welcome to {appName}. Your privacy is critical to us. This Privacy Policy explains how we collect, use, and protect your personal data when you use our platform.</p>

                            <h3 className="text-xl font-semibold text-surface-900">1. Information We Collect</h3>
                            <p>We may collect information you provide directly to us, such as when you create an account, update your profile, or communicate with our support team. This may include your name, email address, phone number, and billing information. We also log WhatsApp communications metadata for billing and service provisioning as part of the Meta Cloud API integration.</p>

                            <h3 className="text-xl font-semibold text-surface-900">2. How We Use Your Information</h3>
                            <p>We use the data we collect to operate, maintain, and improve our services; process transactions; send notices, updates, and alerts; and provide customer support.</p>

                            <h3 className="text-xl font-semibold text-surface-900">3. Data Security</h3>
                            <p>We implement appropriate technical and organizational measures to protect your personal information against accidental or unlawful destruction, loss, or unauthorized access.</p>

                            <h3 className="text-xl font-semibold text-surface-900">4. Sharing with Third Parties</h3>
                            <p>We do not sell your personal data. We may share data with trusted third-party service providers (such as Meta/WhatsApp for API delivery and payment gateways for transactions) solely for the purpose of operating our service.</p>

                            <h3 className="text-xl font-semibold text-surface-900">5. Contact Us</h3>
                            <p>If you have any questions or concerns about this Privacy Policy, please contact us at <strong>{supportEmail}</strong>.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
