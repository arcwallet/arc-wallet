import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/app.config';
import { useCircleWallet } from '../contexts/CircleWalletContext';
import { PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon, RefreshIcon } from './Icons';

interface Webhook {
    id: string;
    url: string;
    events: string[];
    secret: string;
    createdAt: number;
}

const WebhookManager: React.FC = () => {
    const { address } = useCircleWallet();
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
                <h2 className="text-xl font-bold text-white">Webhooks</h2>
                <p className="text-slate-400 text-sm">
                    Receive real-time notifications for wallet events.
                </p>
            </div>

            {/* Add Webhook Form */}
            <div className="flex flex-col gap-4 bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-slate-500/30 shadow-sm">
                <h3 className="text-base font-medium text-white">Add New Webhook</h3>
                <div className="flex gap-3">
                    <input
                        type="url"
                        placeholder="https://api.yourapp.com/webhook"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        className="flex-1 bg-slate-900/60 border border-slate-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all placeholder:text-slate-500"
                    />
                    <button
                        onClick={handleAddWebhook}
                        disabled={isAdding || !newUrl}
                        className="bg-slate-200 text-slate-900 px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-white transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        {isAdding ? 'Adding...' : <><PlusIcon size={18} /> Add</>}
                    </button>
                </div>
                <div className="flex gap-2">
                    <span className="text-slate-400 text-sm py-1">Events:</span>
                    {['Transfer', 'UserOperation'].map(event => (
                        <label key={event} className="flex items-center gap-2 cursor-pointer bg-slate-900/60 px-3 py-1 rounded-full border border-slate-500/30 hover:border-blue-400/50 transition-all">
                            <input
                                type="checkbox"
                                checked={selectedEvents.includes(event)}
                                onChange={(e) => {
                                    if (e.target.checked) setSelectedEvents([...selectedEvents, event]);
                                    else setSelectedEvents(selectedEvents.filter(e => e !== event));
                                }}
                                className="accent-blue-400 rounded border-slate-500 bg-slate-800"
                            />
                            <span className="text-sm text-slate-200">{event}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Webhook List */}
            <div className="flex flex-col gap-3">
                {isLoading ? (
                    <div className="text-slate-400 text-center py-4">Loading webhooks...</div>
                ) : webhooks.length === 0 ? (
                    <div className="text-slate-400 text-center py-8 bg-slate-900/20 rounded-xl border border-dashed border-slate-500/30">
                        No webhooks configured.
                    </div>
                ) : (
                    webhooks.map(webhook => (
                        <div key={webhook.id} className="flex flex-col gap-3 bg-slate-900/40 backdrop-blur-sm p-4 rounded-xl border border-slate-500/30 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1 overflow-hidden">
                                    <div className="font-mono text-sm text-slate-100 truncate" title={webhook.url}>
                                        {webhook.url}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        {webhook.events.map(event => (
                                            <span key={event} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                                                {event}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleTestWebhook(webhook.id)}
                                        className={`p-2 rounded-lg transition-all ${testStatus[webhook.id] === 'success' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                                            testStatus[webhook.id] === 'error' ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                                                'text-slate-400 hover:text-blue-400 hover:bg-white/5 hover:border-blue-400/30 border border-transparent'
                                            }`}
                                        title="Test Webhook"
                                    >
                                        {testStatus[webhook.id] === 'success' ? <CheckCircleIcon size={18} /> :
                                            testStatus[webhook.id] === 'error' ? <XCircleIcon size={18} /> :
                                                <RefreshIcon size={18} />}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteWebhook(webhook.id)}
                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-lg transition-all"
                                        title="Delete Webhook"
                                    >
                                        <TrashIcon size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-500/30 font-mono">
                                <span className="select-none text-slate-500">Secret:</span>
                                <span className="truncate text-slate-300">{webhook.secret}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WebhookManager;
