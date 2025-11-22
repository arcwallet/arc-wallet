import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { identityService } from '../services/identityService';

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
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [reputationScore, setReputationScore] = useState(0);
    const [identityLevel, setIdentityLevel] = useState('Unverified');

    // Load initial data
    useEffect(() => {
        const loadData = () => {
            const data = identityService.getData();
            setCredentials(data.credentials);
            setReputationScore(data.reputationScore);
            setIdentityLevel(data.identityLevel);
        };
        loadData();

        // Listen for storage events to sync across tabs
        window.addEventListener('storage', loadData);
        return () => window.removeEventListener('storage', loadData);
    }, []);

    const refreshData = () => {
        const data = identityService.getData();
        setCredentials(data.credentials);
        setReputationScore(data.reputationScore);
        setIdentityLevel(data.identityLevel);
    };

    const addCredential = (credential: Omit<Credential, 'id' | 'status'>) => {
        identityService.addCredential(credential);
        refreshData();
    };

    const removeCredential = (id: string) => {
        identityService.removeCredential(id);
        refreshData();
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
