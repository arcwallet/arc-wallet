import React, { useState, useEffect } from 'react';
import { SocialLoginButtons } from './SocialLoginButtons';
import { useWallet } from '../contexts/WalletContext';
import { BACKEND_URL } from '../config/app.config';

interface OAuthAccount {
    id: string;
    provider: string;
    providerId: string;
    email: string;
    name: string;
    picture?: string;
}

export const LinkedAccountsManager: React.FC = () => {
    const [linkedAccounts, setLinkedAccounts] = useState<OAuthAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        fetchLinkedAccounts();
    }, []);

    const fetchLinkedAccounts = async () => {
        try {
            // In a real app, we would fetch this from the backend
            // const response = await fetch(`${BACKEND_URL}/auth/linked-accounts`);
            // const data = await response.json();
            // setLinkedAccounts(data);

            // Mock data for now as the endpoint is not fully implemented
            setLinkedAccounts([]);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to fetch linked accounts:', error);
            setIsLoading(false);
        }
    };

    const handleUnlink = async (provider: string) => {
        if (linkedAccounts.length === 1) {
            alert('Cannot unlink last authentication method');
            return;
        }

        const confirmed = confirm(`Unlink ${provider} account?`);
        if (!confirmed) return;

        try {
            // await fetch(`${BACKEND_URL}/auth/unlink/${provider}`, { method: 'DELETE' });
            await fetchLinkedAccounts();
        } catch (error) {
            console.error('Failed to unlink account:', error);
        }
    };

    const getProviderIcon = (provider: string) => {
        switch (provider) {
            case 'google': return '🔵';
            case 'apple': return '🍎';
            case 'facebook': return '📘';
            default: return '🔒';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Linked Accounts</h3>

                {isLoading ? (
                    <div className="text-text-secondary">Loading...</div>
                ) : linkedAccounts.length > 0 ? (
                    <div className="space-y-3">
                        {linkedAccounts.map((account) => (
                            <div key={`${account.provider}-${account.providerId}`} className="flex items-center justify-between p-4 rounded-lg bg-[#151A22] border border-white/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getProviderIcon(account.provider)}</span>
                                    <div>
                                        <p className="font-medium text-text-primary">{account.name}</p>
                                        <p className="text-sm text-text-secondary">{account.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnlink(account.provider)}
                                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                                >
                                    Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-text-secondary mb-4">No social accounts linked.</p>
                )}
            </div>

            <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-text-secondary mb-4">Link additional accounts:</p>
                <SocialLoginButtons />
            </div>
        </div>
    );
};
