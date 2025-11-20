import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Credential {
    id: string;
    issuer: string;
    type: string;
    issueDate: string;
    status: 'active' | 'expired' | 'revoked';
}

interface IdentityContextType {
    credentials: Credential[];
    reputationScore: number;
    identityLevel: string;
    addCredential: (credential: Omit<Credential, 'id' | 'status'>) => void;
    removeCredential: (id: string) => void;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export const useIdentity = () => {
    const context = useContext(IdentityContext);
    if (!context) {
        throw new Error('useIdentity must be used within an IdentityProvider');
    }
    return context;
};

export const IdentityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Mock initial state
    const [credentials, setCredentials] = useState<Credential[]>([
        {
            id: '1',
            issuer: 'Arc Identity Authority',
            type: 'KYC Level 1',
            issueDate: '2024-01-15',
            status: 'active',
        },
        {
            id: '2',
            issuer: 'DeFi Credit Score',
            type: 'Credit Score > 700',
            issueDate: '2024-02-20',
            status: 'active',
        },
    ]);

    const [reputationScore, setReputationScore] = useState(720);
    const [identityLevel, setIdentityLevel] = useState('Verified Human');

    const addCredential = (credential: Omit<Credential, 'id' | 'status'>) => {
        const newCredential: Credential = {
            ...credential,
            id: Math.random().toString(36).substr(2, 9),
            status: 'active',
        };
        setCredentials((prev) => [...prev, newCredential]);
        // Mock score update
        setReputationScore((prev) => Math.min(prev + 10, 850));
    };

    const removeCredential = (id: string) => {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        // Mock score update
        setReputationScore((prev) => Math.max(prev - 10, 0));
    };

    return (
        <IdentityContext.Provider
            value={{
                credentials,
                reputationScore,
                identityLevel,
                addCredential,
                removeCredential,
            }}
        >
            {children}
        </IdentityContext.Provider>
    );
};
