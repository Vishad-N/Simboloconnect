import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Webhook from './pages/Webhook';
import LiveChat from './pages/LiveChat';
import Templates from './pages/Templates';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import Profile from './pages/Profile';
import Team from './pages/Team';
import ChatbotSettings from './pages/ChatbotSettings';
import AiBrain from './pages/AiBrain';
import AiAdminCenter from './pages/AiAdminCenter';
import ChatbotFlow from './pages/ChatbotFlow';
import VisualFlowBuilder from './pages/VisualFlowBuilder';
import FlowProjects from './pages/FlowProjects';
import AutoReplies from './pages/AutoReplies';
import SubscriptionExpired from './pages/SubscriptionExpired';
import Impersonate from './pages/Impersonate';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import WalletLogs from './pages/WalletLogs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import RefundPolicy from './pages/RefundPolicy';
import Contact from './pages/Contact';
import axios from 'axios';
import { BrandingProvider, useBranding } from './context/BrandingContext';
import { SocketProvider } from './context/SocketContext';
import Maintenance from './pages/Maintenance';
import RequirePlan from './components/RequirePlan';
import ErrorBoundary from './components/ErrorBoundary';

// ── Fresh Theme Components ──
import FreshLanding from './pages/FreshLanding';
import FreshAuth from './pages/FreshAuth';
import FreshLayout from './components/FreshLayout';
import FreshDashboard from './pages/FreshDashboard';
import FreshPricing from './pages/FreshPricing';
import FreshLiveChat from './pages/FreshLiveChat';
import FreshCampaigns from './pages/FreshCampaigns';
import FreshWebhook from './pages/FreshWebhook';
import FreshFlowProjects from './pages/FreshFlowProjects';
import FreshAiBrain from './pages/FreshAiBrain';
import FreshVisualFlowBuilder from './pages/FreshVisualFlowBuilder';
import FreshWalletLogs from './pages/FreshWalletLogs';
import FreshVoiceProviders from './pages/FreshAIVoice/FreshProviders';
import FreshVoiceAgents from './pages/FreshAIVoice/FreshAgents';
import FreshVoiceCampaigns from './pages/FreshAIVoice/FreshCampaigns';
import FreshVoiceReports from './pages/FreshAIVoice/FreshReports';
import FreshVoiceDeveloperHub from './pages/FreshAIVoice/FreshDeveloperHub';

// Legacy ecommerce pages (keep for backward compat)
import WhatsAppOrders from './pages/WhatsAppOrders';
import ShopifyIntegration from './pages/ShopifyIntegration';
import WooCommerceIntegration from './pages/WooCommerceIntegration';
import Integrations from './pages/Integrations';

// New Integrations Module Pages
import OrdersPayments from './pages/OrdersPayments';
import ApiWebhook from './pages/ApiWebhook';
import SheetsIntegration from './pages/SheetsIntegration';

// New Ecommerce Module Pages
import EcommerceOverview from './pages/EcommerceOverview';
import EcommerceStores from './pages/EcommerceStores';
import EcommerceOrders from './pages/EcommerceOrders';
import EcommerceCustomers from './pages/EcommerceCustomers';
import EcommerceProducts from './pages/EcommerceProducts';
import EcommerceAbandonedCarts from './pages/EcommerceAbandonedCarts';
import EcommerceCampaigns from './pages/EcommerceCampaigns';
import EcommerceAutomations from './pages/EcommerceAutomations';
import EcommerceTemplates from './pages/EcommerceTemplates';
import EcommerceAnalytics from './pages/EcommerceAnalytics';
import VoiceProviders from './pages/AIVoice/Providers';
import VoiceAgents from './pages/AIVoice/Agents';
import VoiceCampaigns from './pages/AIVoice/Campaigns';
import VoiceReports from './pages/AIVoice/Reports';
import VoiceDeveloperHub from './pages/AIVoice/DeveloperHub';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('userToken') || localStorage.getItem('tenantId');
  return token ? children : <Navigate to="/auth" replace />;
};

// Theme-aware route component — picks Fresh or Classic versions
const ThemedRoutes = () => {
  const { branding, activeTheme } = useBranding();
  const isFreshAdmin = branding?.frontendTheme === 'fresh';
  const isFreshUser = activeTheme === 'fresh';

  const LandingPage = isFreshAdmin ? FreshLanding : Landing;
  const AuthPage = isFreshAdmin ? FreshAuth : Auth;
  const LayoutShell = isFreshUser ? FreshLayout : Layout;
  const PricingPage = isFreshUser ? FreshPricing : Pricing;

  const DashboardPage = isFreshUser ? FreshDashboard : Dashboard;
  const LiveChatPage = isFreshUser ? FreshLiveChat : LiveChat;
  const CampaignsPage = isFreshUser ? FreshCampaigns : Campaigns;
  const WebhookPage = isFreshUser ? FreshWebhook : Webhook;
  const FlowProjectsPage = isFreshUser ? FreshFlowProjects : FlowProjects;
  const AiBrainPage = isFreshUser ? FreshAiBrain : AiBrain;
  const VisualFlowBuilderPage = isFreshUser ? FreshVisualFlowBuilder : VisualFlowBuilder;
  const WalletLogsPage = isFreshUser ? FreshWalletLogs : WalletLogs;

  const AiVoiceProvidersPage = isFreshUser ? FreshVoiceProviders : VoiceProviders;
  const AiVoiceAgentsPage = isFreshUser ? FreshVoiceAgents : VoiceAgents;
  const AiVoiceCampaignsPage = isFreshUser ? FreshVoiceCampaigns : VoiceCampaigns;
  const AiVoiceReportsPage = isFreshUser ? FreshVoiceReports : VoiceReports;
  const AiVoiceDeveloperHubPage = isFreshUser ? FreshVoiceDeveloperHub : VoiceDeveloperHub;

  return (
    <Routes>
      <Route path="/expired" element={<SubscriptionExpired />} />
      <Route path="/auth/impersonate" element={<Impersonate />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-conditions" element={<TermsConditions />} />
      <Route path="/refund-policy" element={<RefundPolicy />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/" element={<LandingPage />} />

      <Route element={<PrivateRoute><LayoutShell /></PrivateRoute>}>
        {/* Core Pages (Unrestricted) */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/plans" element={<PricingPage />} />
        <Route path="/chat" element={<ErrorBoundary><LiveChatPage /></ErrorBoundary>} />
        <Route path="/wallet/logs" element={<WalletLogsPage />} />
        <Route path="/webhook" element={<WebhookPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />

        {/* Premium Pages (Restricted) */}
        <Route path="/campaigns" element={<RequirePlan><CampaignsPage /></RequirePlan>} />
        <Route path="/templates" element={<RequirePlan><Templates /></RequirePlan>} />
        <Route path="/contacts" element={<RequirePlan><Contacts /></RequirePlan>} />
        <Route path="/team" element={<RequirePlan><Team /></RequirePlan>} />
        <Route path="/admin/ai-center" element={<RequirePlan><AiAdminCenter /></RequirePlan>} />
        <Route path="/ai-brain" element={<RequirePlan><AiBrainPage /></RequirePlan>} />
        
        <Route path="/ai-voice" element={<Navigate to="/ai-voice/providers" replace />} />
        <Route path="/ai-voice/providers" element={<RequirePlan><AiVoiceProvidersPage /></RequirePlan>} />
        <Route path="/ai-voice/agents" element={<RequirePlan><AiVoiceAgentsPage /></RequirePlan>} />
        <Route path="/ai-voice/campaigns" element={<RequirePlan><AiVoiceCampaignsPage /></RequirePlan>} />
        <Route path="/ai-voice/reports" element={<RequirePlan><AiVoiceReportsPage /></RequirePlan>} />
        <Route path="/ai-voice/developer-hub" element={<RequirePlan><AiVoiceDeveloperHubPage /></RequirePlan>} />

        <Route path="/chatbot/autoreplies" element={<RequirePlan><AutoReplies /></RequirePlan>} />
        <Route path="/chatbot/visual-flows" element={<RequirePlan><FlowProjectsPage /></RequirePlan>} />
        <Route path="/chatbot/visual-flows/flow/:flowId" element={<RequirePlan><VisualFlowBuilderPage /></RequirePlan>} />
        <Route path="/chatbot/flows" element={<RequirePlan><ChatbotFlow /></RequirePlan>} />

        {/* Integrations (Restricted) */}
        <Route path="/integrations" element={<Navigate to="/integrations/api-webhook" replace />} />
        <Route path="/integrations/orders-payments" element={<Navigate to="/settings?tab=payments" replace />} />
        <Route path="/integrations/api-webhook" element={<RequirePlan><ApiWebhook /></RequirePlan>} />
        <Route path="/integrations/sheets" element={<RequirePlan><SheetsIntegration /></RequirePlan>} />

        {/* Ecommerce (Restricted) */}
        <Route path="/ecommerce" element={<Navigate to="/ecommerce/overview" replace />} />
        <Route path="/ecommerce/overview" element={<RequirePlan><EcommerceOverview /></RequirePlan>} />
        <Route path="/ecommerce/shopify" element={<RequirePlan><ShopifyIntegration /></RequirePlan>} />
        <Route path="/ecommerce/woocommerce" element={<RequirePlan><WooCommerceIntegration /></RequirePlan>} />
        <Route path="/ecommerce/stores" element={<RequirePlan><EcommerceStores /></RequirePlan>} />
        <Route path="/ecommerce/orders" element={<RequirePlan><EcommerceOrders /></RequirePlan>} />
        <Route path="/ecommerce/customers" element={<RequirePlan><EcommerceCustomers /></RequirePlan>} />
        <Route path="/ecommerce/products" element={<RequirePlan><EcommerceProducts /></RequirePlan>} />
        <Route path="/ecommerce/abandoned-carts" element={<RequirePlan><EcommerceAbandonedCarts /></RequirePlan>} />
        <Route path="/ecommerce/campaigns" element={<RequirePlan><EcommerceCampaigns /></RequirePlan>} />
        <Route path="/ecommerce/automations" element={<RequirePlan><EcommerceAutomations /></RequirePlan>} />
        <Route path="/ecommerce/templates" element={<RequirePlan><EcommerceTemplates /></RequirePlan>} />
        <Route path="/ecommerce/analytics" element={<RequirePlan><EcommerceAnalytics /></RequirePlan>} />
        <Route path="/ecommerce/whatsapp-orders" element={<WhatsAppOrders />} />
      </Route>
    </Routes>
  );
};

function App() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    // --- BACKWARD COMPATIBILITY MIGRATION ---
    try {
      const exTenantId = localStorage.getItem('tenantId');
      const exUserToken = localStorage.getItem('userToken');
      if (!exUserToken && exTenantId && exTenantId.startsWith('eyJ')) {
        const payloadStr = atob(exTenantId.split('.')[1]);
        const payload = JSON.parse(payloadStr);
        if (payload && payload.id) {
          localStorage.setItem('userToken', exTenantId);
          localStorage.setItem('tenantId', payload.id);
          console.log('Successfully migrated legacy user session.');
        }
      }
    } catch (e) {
      console.log('Legacy session migration skipped or failed.');
    }

    if (!import.meta.env.VITE_API_URL) {
      console.warn('VITE_API_URL is missing! Requests will fall back to http://localhost:5005');
    }

    // Inject Custom CSS
    const link = document.createElement('link');
    link.id = 'dynamic-user-css';
    link.rel = 'stylesheet';
    link.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/css/user.css?t=${Date.now()}`;
    document.head.appendChild(link);

    // Check Maintenance Mode
    const checkSystemStatus = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/auth/status`);
        setIsMaintenance(res.data.maintenanceMode);
      } catch (e) {
        console.error("Failed to check system status", e);
      } finally {
        setLoadingConfig(false);
      }
    };

    checkSystemStatus();

    // Global Axios Interceptor for Authorization
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('userToken');
        const tenantId = localStorage.getItem('tenantId');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        if (tenantId) config.headers['x-user-id'] = tenantId;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Global Axios Interceptor for Expiration/Suspension
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 403) {
          const code = error.response.data?.code;
          if (code === 'EXPIRED' || code === 'SUSPENDED') {
            window.location.href = '/expired';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  if (loadingConfig) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-50 text-white0 font-medium">Loading System Configuration...</div>;
  }

  if (isMaintenance) {
    return <Maintenance />;
  }

  return (
    <BrandingProvider>
      <BrowserRouter>
        <SocketProvider>
          <ThemedRoutes />
        </SocketProvider>
      </BrowserRouter>
    </BrandingProvider>
  );
}

export default App;
