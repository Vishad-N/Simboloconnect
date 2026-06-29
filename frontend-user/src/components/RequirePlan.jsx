import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Navigate, useNavigate } from 'react-router-dom';
import PlanActivationModal from './PlanActivationModal';
import FreshPlanActivationModal from './FreshPlanActivationModal';

const RequirePlan = ({ children }) => {
    const navigate = useNavigate();
    const isFresh = (localStorage.getItem('user_theme_preference') || localStorage.getItem('cached_frontend_theme') || 'fresh') !== 'classic';
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/account`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` }
                });
                setAccount(res.data);
            } catch (error) {
                console.error("Failed to fetch account for RequirePlan");
            } finally {
                setLoading(false);
            }
        };

        fetchAccount();
    }, []);

    if (loading) {
        return <div className="flex h-full items-center justify-center p-12 text-surface-400">Loading plan verification...</div>;
    }

    // If they have an active plan or are a superadmin, render normally
    const hasActivePlan = account?.validityExpiresAt && new Date(account.validityExpiresAt) > new Date();
    const isSuperAdmin = account?.role === 'SUPERADMIN';

    if (hasActivePlan || isSuperAdmin) {
        return children;
    }

    // If they don't have a plan, show the UI behind but open the non-closable modal
    return (
        <div className="relative h-full w-full pointer-events-none">
            <div className="opacity-30 filter blur-sm">
                {children}
            </div>
            <div className="pointer-events-auto">
                {isFresh ? (
                    <FreshPlanActivationModal 
                        account={account} 
                        isOpen={true} 
                        onClose={() => navigate('/dashboard')} 
                        closable={true} 
                    />
                ) : (
                    <PlanActivationModal 
                        account={account} 
                        isOpen={true} 
                        onClose={() => navigate('/dashboard')} 
                        closable={true} 
                    />
                )}
            </div>
        </div>
    );
};

export default RequirePlan;
