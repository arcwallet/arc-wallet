import React from 'react';
import { useState } from 'react';
import { BACKEND_URL } from '../config/app.config';

interface SocialLoginButtonsProps {
    onSuccess?: (user: any) => void;
    onError?: (error: Error) => void;
}

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const AppleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74s2.57-.99 4.31-.82c.72.03 2.81.29 4.14 2.23-3.68 1.8-3.06 6.16.63 7.66-.67 1.73-1.6 3.43-2.96 4.76-.6.6-1.54 1.46-1.2 1.4zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
);

const FacebookIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
    onSuccess,
    onError
}) => {


    const handleSocialLogin = (provider: 'google' | 'apple' | 'facebook') => {
        // Redirect to OAuth authorization URL
        // We use window.location.href to navigate to the backend route which handles the redirect
        // We add a redirect_url param to tell the backend where to send the user after success
        const currentUrl = window.location.href;
        // If we are on login page, redirect to dashboard after success
        // If we are on settings page (linking), redirect back to settings
        const redirectUrl = currentUrl.includes('/login')
            ? `${window.location.origin}/dashboard`
            : currentUrl;

        window.location.href = `${BACKEND_URL}/auth/${provider}?redirect_url=${encodeURIComponent(redirectUrl)}`;
    };

    return (
        <div className="flex flex-col gap-3 w-full">
            <button
                onClick={() => handleSocialLogin('google')}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
                <GoogleIcon />
                <span className="font-medium text-gray-700">Continue with Google</span>
            </button>

            <button
                onClick={() => handleSocialLogin('apple')}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-black text-white border border-black rounded-lg hover:bg-gray-900 transition-colors shadow-sm"
            >
                <AppleIcon />
                <span className="font-medium">Continue with Apple</span>
            </button>

            <button
                onClick={() => handleSocialLogin('facebook')}
                className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-[#1877F2] text-white border border-[#1877F2] rounded-lg hover:bg-[#166FE5] transition-colors shadow-sm"
            >
                <FacebookIcon />
                <span className="font-medium">Continue with Facebook</span>
            </button>
        </div>
    );
};
