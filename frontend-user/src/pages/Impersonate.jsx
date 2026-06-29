import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Impersonate = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get('token');

        if (token) {
            // Store the real JWT
            localStorage.setItem('userToken', token);
            navigate('/');
            // Reload to re-initialize socket connections
            window.location.reload();
        } else {
            navigate('/login');
        }
    }, [navigate, location]);

    return (
        <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
            <div className="text-white text-lg">Initializing Impersonation Session...</div>
        </div>
    );
};

export default Impersonate;
