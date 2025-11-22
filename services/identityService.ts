import { Credential } from '../contexts/IdentityContext';

const STORAGE_KEY = 'arc_identity_data';

interface IdentityData {
    credentials: Credential[];
    reputationScore: number;
    identityLevel: string;
}

const DEFAULT_DATA: IdentityData = {
    credentials: [],
    reputationScore: 0,
    identityLevel: 'Unverified',
};

export const identityService = {
    getData: (): IdentityData => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : DEFAULT_DATA;
        } catch (error) {
            console.error('Failed to load identity data', error);
            return DEFAULT_DATA;
        }
    },

    saveData: (data: IdentityData) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save identity data', error);
        }
    },

    addCredential: (credential: Omit<Credential, 'id' | 'status'>): Credential => {
        const data = identityService.getData();
        const newCredential: Credential = {
            ...credential,
            id: crypto.randomUUID(),
            status: 'active',
        };

        data.credentials.push(newCredential);

        // Simple logic to update score/level based on credentials
        data.reputationScore += 50;
        if (data.reputationScore > 100) data.identityLevel = 'Basic User';
        if (data.reputationScore > 500) data.identityLevel = 'Verified Human';

        identityService.saveData(data);
        return newCredential;
    },

    removeCredential: (id: string) => {
        const data = identityService.getData();
        data.credentials = data.credentials.filter(c => c.id !== id);

        // Decrease score
        data.reputationScore = Math.max(0, data.reputationScore - 50);

        // Downgrade level if needed
        if (data.reputationScore < 100) data.identityLevel = 'Unverified';
        else if (data.reputationScore < 500) data.identityLevel = 'Basic User';

        identityService.saveData(data);
    }
};
