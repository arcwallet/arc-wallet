import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/app.config';
import { useWallet } from '../contexts/WalletContext';
import { PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon, RefreshIcon } from './Icons';

interface Webhook {
    id: string;
    url: string;
    events: string[];
    secret: string;
    createdAt: number;
}

const WebhookManager: React.FC = () => {
    const { address } = useWallet();
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [selectedEvents, setSelectedEvents] = useState<string[]>(['Transfer']);
    const [isAdding, setIsAdding] = useState(false);
    const [testStatus, setTestStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({});

    useEffect(() => {
        if (address) {
            fetchWebhooks();
        }
    }, [address]);

    const fetchWebhooks = async () => {
        if (!address) return;
        setIsLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.webhooks.list(address));
            const json = await res.json();
            if (json.success) {
                setWebhooks(json.data);
            }
        } catch (error) {
            console.error('Failed to fetch webhooks', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddWebhook = async () => {
        if (!address || !newUrl) return;
        setIsAdding(true);
        try {
            const res = await fetch(API_ENDPOINTS.webhooks.create(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: address,
                    url: newUrl,
                    events: selectedEvents
                })
            });
            const json = await res.json();
            if (json.success) {
                setWebhooks([...webhooks, json.data]);
                setNewUrl('');
            }
        } catch (error) {
            console.error('Failed to add webhook', error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteWebhook = async (id: string) => {
        try {
            await fetch(API_ENDPOINTS.webhooks.delete(id), { method: 'DELETE' });
            setWebhooks(webhooks.filter(w => w.id !== id));
        } catch (error) {
            console.error('Failed to delete webhook', error);
        }
    };

    const handleTestWebhook = async (id: string) => {
        setTestStatus(prev => ({ ...prev, [id]: null }));
        try {
            const res = await fetch(API_ENDPOINTS.webhooks.test(id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: address })
            });
            const json = await res.json();
            setTestStatus(prev => ({ ...prev, [id]: json.success ? 'success' : 'error' }));

            // Clear status after 3 seconds
            setTimeout(() => {
                setTestStatus(prev => ({ ...prev, [id]: null }));
            }, 3000);
        } catch (error) {
            setTestStatus(prev => ({ ...prev, [id]: 'error' }));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-text-primary">Webhooks</h2>
                <p className="text-text-secondary text-sm">
                    Receive real-time notifications for wallet events.
                </p>
            </div>

            {/* Add Webhook Form */}
            <div className="flex flex-col gap-4 bg-surface p-4 rounded-xl border border-divider">
                <h3 className="text-base font-medium text-text-primary">Add New Webhook</h3>
                <div className="flex gap-3">
                    <input
                        type="url"
                        placeholder="https://api.yourapp.com/webhook"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        className="flex-1 bg-background border border-divider rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary"
                    />
                    <button
                        onClick={handleAddWebhook}
                        disabled={isAdding || !newUrl}
                        className="bg-primary text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        {isAdding ? 'Adding...' : <><PlusIcon size={18} /> Add</>}
                    </button>
                </div>
                <div className="flex gap-2">
                    <span className="text-text-secondary text-sm py-1">Events:</span>
                    {['Transfer', 'UserOperation'].map(event => (
                        <label key={event} className="flex items-center gap-2 cursor-pointer bg-background px-3 py-1 rounded-full border border-divider hover:border-primary/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedEvents.includes(event)}
                                onChange={(e) => {
                                    if (e.target.checked) setSelectedEvents([...selectedEvents, event]);
                                    else setSelectedEvents(selectedEvents.filter(e => e !== event));
                                }}
                                className="accent-primary"
                            />
                            <span className="text-sm text-text-primary">{event}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Webhook List */}
            <div className="flex flex-col gap-3">
                {isLoading ? (
                    <div className="text-text-secondary text-center py-4">Loading webhooks...</div>
                ) : webhooks.length === 0 ? (
                    <div className="text-text-secondary text-center py-8 bg-surface/50 rounded-xl border border-dashed border-divider">
                        No webhooks configured.
                    </div>
                ) : (
                    webhooks.map(webhook => (
                        <div key={webhook.id} className="flex flex-col gap-3 bg-surface p-4 rounded-xl border border-divider">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1 overflow-hidden">
                                    <div className="font-mono text-sm text-text-primary truncate" title={webhook.url}>
                                        {webhook.url}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        {webhook.events.map(event => (
                                            <span key={event} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                {event}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleTestWebhook(webhook.id)}
                                        className={`p-2 rounded-lg transition-colors ${testStatus[webhook.id] === 'success' ? 'text-green-500 bg-green-500/10' :
                                            testStatus[webhook.id] === 'error' ? 'text-red-500 bg-red-500/10' :
                                                'text-text-secondary hover:text-primary hover:bg-white/5'
                                            }`}
                                        title="Test Webhook"
                                    >
                                        {testStatus[webhook.id] === 'success' ? <CheckCircleIcon size={18} /> :
                                            testStatus[webhook.id] === 'error' ? <XCircleIcon size={18} /> :
                                                <RefreshIcon size={18} />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteWebhook(webhook.id)}
                                        className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete Webhook"
                                    >
                                        <TrashIcon size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-secondary bg-background/50 p-2 rounded border border-divider/50 font-mono">
                                <span className="select-none">Secret:</span>
                                <span className="truncate">{webhook.secret}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WebhookManager;
