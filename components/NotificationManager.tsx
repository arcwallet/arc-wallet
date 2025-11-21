import React, { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config/app.config';
import { useWallet } from '../contexts/WalletContext';
import { BellIcon, CheckCircleIcon } from './Icons';

const NotificationManager: React.FC = () => {
    const { address } = useWallet();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
            checkSubscription();
        }
    }, [address]);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
        }
    };

    const subscribeUser = async () => {
        if (!address) return;
        setIsLoading(true);

        try {
            // 1. Register Service Worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // 2. Get VAPID Key
            const res = await fetch(API_ENDPOINTS.notifications.vapidKey());
            const { publicKey } = await res.json();

            // 3. Subscribe to Push Manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });

            // 4. Send Subscription to Backend
            await fetch(API_ENDPOINTS.notifications.subscribe(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: address,
                    subscription
                })
            });

            setIsSubscribed(true);
            setPermission('granted');
        } catch (error) {
            console.error('Failed to subscribe:', error);
            alert('Failed to enable notifications. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const unsubscribeUser = async () => {
        setIsLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe from backend
                await fetch(API_ENDPOINTS.notifications.subscribe(), {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                });

                // Unsubscribe from browser
                await subscription.unsubscribe();
                setIsSubscribed(false);
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const sendTestNotification = async () => {
        if (!address) return;
        try {
            await fetch(API_ENDPOINTS.notifications.test(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: address })
            });
        } catch (error) {
            console.error('Failed to send test notification:', error);
        }
    };

    if (!('Notification' in window)) {
        return null; // Browser doesn't support notifications
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white">Push Notifications</h2>
                <p className="text-slate-400 text-sm">
                    Get notified about incoming transactions even when the app is closed.
                </p>
            </div>

            <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-slate-500/30 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isSubscribed ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
                        <BellIcon size={24} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-100">
                            {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
                        </span>
                        <span className="text-xs text-slate-400">
                            {isSubscribed ? 'You will receive alerts for wallet activity.' : 'Allow browser notifications to stay updated.'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isSubscribed && (
                        <button
                            onClick={sendTestNotification}
                            className="text-sm text-blue-400 hover:text-blue-300 hover:underline px-2 transition-colors"
                        >
                            Test
                        </button>
                    )}

                    <button
                        onClick={isSubscribed ? unsubscribeUser : subscribeUser}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg font-medium transition-all shadow-sm ${isSubscribed
                            ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-500/30'
                            : 'bg-slate-200 text-slate-900 hover:bg-white hover:shadow-md'
                            }`}
                    >
                        {isLoading ? 'Processing...' : isSubscribed ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationManager;
