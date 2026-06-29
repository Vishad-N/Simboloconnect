import React from 'react';
import { AlertTriangle, Wrench } from 'lucide-react';

const Maintenance = () => {
    return (
        <div className="min-h-screen bg-surface-50 flex flex-col justify-center items-center p-6 text-center">
            <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full border border-surface-200">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Wrench className="text-orange-500 w-10 h-10 animate-bounce" />
                </div>
                <h1 className="text-3xl font-extrabold text-surface-900 mb-4 tracking-tight">System Maintenance</h1>
                <p className="text-lg text-surface-600 mb-8 leading-relaxed">
                    We are currently upgrading our platform to serve you better. We will be back online shortly. Thank you for your patience!
                </p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-4 text-left">
                    <AlertTriangle className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-blue-900">What does this mean for you?</h4>
                        <p className="text-sm text-blue-800 mt-1">All automated WhatsApp messages and replies are still running normally in the background. Only the dashboard access is temporarily paused.</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-surface-400 text-sm">
                &copy; {new Date().getFullYear()} TechSoftonics
            </div>
        </div>
    );
};

export default Maintenance;
