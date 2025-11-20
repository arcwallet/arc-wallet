import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface FHEKeypair {
    publicKey: string;
    privateKey: string;
}

export interface ViewKey {
    id: string;
    key: string;
    grantedTo: string;
    grantedToName?: string;
    createdAt: Date;
}

interface PrivacyContextType {
    isPrivacyMode: boolean;
    togglePrivacyMode: () => void;
    fheKeypair: FHEKeypair | null;
    generateKeypair: () => void;
    viewKeys: ViewKey[];
    createViewKey: (grantedTo: string, name?: string) => ViewKey;
    revokeViewKey: (id: string) => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const usePrivacy = () => {
    const context = useContext(PrivacyContext);
    if (!context) {
        throw new Error('usePrivacy must be used within a PrivacyProvider');
    }
    return context;
};

// Mock FHE keypair generation (will be replaced with real FHE library)
const generateMockFHEKeypair = (): FHEKeypair => {
    const randomHex = (length: number) => {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    return {
        publicKey: `0xfhe_pub_${randomHex(32)}`,
        privateKey: `0xfhe_priv_${randomHex(32)}`,
    };
};

export const PrivacyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);
    const [fheKeypair, setFheKeypair] = useState<FHEKeypair | null>(null);
    const [viewKeys, setViewKeys] = useState<ViewKey[]>([]);

    // Load privacy settings from localStorage
    useEffect(() => {
        const savedMode = localStorage.getItem('arcwallet_privacy_mode');
        const savedKeypair = localStorage.getItem('arcwallet_fhe_keypair');
        const savedViewKeys = localStorage.getItem('arcwallet_view_keys');

        if (savedMode === 'true') {
            setIsPrivacyMode(true);
        }

        if (savedKeypair) {
            try {
                setFheKeypair(JSON.parse(savedKeypair));
            } catch (e) {
                console.error('Failed to parse FHE keypair:', e);
            }
        }

        if (savedViewKeys) {
            try {
                const parsed = JSON.parse(savedViewKeys);
                setViewKeys(parsed.map((vk: any) => ({ ...vk, createdAt: new Date(vk.createdAt) })));
            } catch (e) {
                console.error('Failed to parse view keys:', e);
            }
        }
    }, []);

    const togglePrivacyMode = () => {
        const newMode = !isPrivacyMode;
        setIsPrivacyMode(newMode);
        localStorage.setItem('arcwallet_privacy_mode', newMode.toString());

        // Auto-generate keypair if enabling privacy for the first time
        if (newMode && !fheKeypair) {
            generateKeypair();
        }
    };

    const generateKeypair = () => {
        const keypair = generateMockFHEKeypair();
        setFheKeypair(keypair);
        localStorage.setItem('arcwallet_fhe_keypair', JSON.stringify(keypair));
    };

    const createViewKey = (grantedTo: string, name?: string): ViewKey => {
        if (!fheKeypair) {
            throw new Error('No FHE keypair available. Enable privacy mode first.');
        }

        const viewKey: ViewKey = {
            id: Math.random().toString(36).substr(2, 9),
            key: `0xview_${Math.random().toString(36).substr(2, 16)}`,
            grantedTo,
            grantedToName: name,
            createdAt: new Date(),
        };

        const newViewKeys = [...viewKeys, viewKey];
        setViewKeys(newViewKeys);
        localStorage.setItem('arcwallet_view_keys', JSON.stringify(newViewKeys));

        return viewKey;
    };

    const revokeViewKey = (id: string) => {
        const newViewKeys = viewKeys.filter(vk => vk.id !== id);
        setViewKeys(newViewKeys);
        localStorage.setItem('arcwallet_view_keys', JSON.stringify(newViewKeys));
    };

    return (
        <PrivacyContext.Provider
            value={{
                isPrivacyMode,
                togglePrivacyMode,
                fheKeypair,
                generateKeypair,
                viewKeys,
                createViewKey,
                revokeViewKey,
            }}
        >
            {children}
        </PrivacyContext.Provider>
    );
};
