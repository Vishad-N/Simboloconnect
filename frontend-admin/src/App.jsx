import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import axios from 'axios';
import Login from './pages/Login';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Webhooks from './pages/Webhooks';
import SystemUpdates from './pages/SystemUpdates';
import AdvancedCss from './pages/AdvancedCss';
import Dashboard from './pages/Dashboard';
import EmbeddedSignup from './pages/EmbeddedSignup';
import Plans from './pages/Plans';
import Broadcast from './pages/Broadcast';
import AuditLogs from './pages/AuditLogs';
import Staff from './pages/Staff';
import SmsGateways from './pages/SmsGateways';
import Profile from './pages/Profile';
import PaymentGateways from './pages/PaymentGateways';
import LandingEditor from './pages/LandingEditor';
import WalletManagement from './pages/WalletManagement';
import AiAdminCenter from './pages/AiAdminCenter';
import AdminVoiceCenter from './pages/AdminVoiceCenter';
import './App.css';
import { BrandingProvider } from './context/BrandingContext';

const PrivateRoute = ({ children }) => {
  const adminToken = localStorage.getItem('adminToken');
  return adminToken ? children : <Navigate to="/login" replace />;
};

// Global Axios Interceptor for Authorization
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      // Use x-user-id for Admin Portal compatibility with current middleware
      config.headers['x-user-id'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {
  React.useEffect(() => {
    const link = document.createElement('link');
    link.id = 'dynamic-admin-css';
    link.rel = 'stylesheet';
    link.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/public/css/admin.css?t=${Date.now()}`;
    document.head.appendChild(link);
  }, []);

  return (
    <BrandingProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="plans" element={<Plans />} />
            <Route path="broadcast" element={<Broadcast />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="staff" element={<Staff />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="payment-gateways" element={<PaymentGateways />} />
            <Route path="landing-editor" element={<LandingEditor />} />
            <Route path="sms-gateways" element={<SmsGateways />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="embedded-signup" element={<EmbeddedSignup />} />
            <Route path="system-updates" element={<SystemUpdates />} />
            <Route path="advanced-css" element={<AdvancedCss />} />
            <Route path="wallet-management" element={<WalletManagement />} />
            <Route path="ai-control-center" element={<AiAdminCenter />} />
            <Route path="voice-center" element={<AdminVoiceCenter />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </BrandingProvider>
  );
}

export default App;
