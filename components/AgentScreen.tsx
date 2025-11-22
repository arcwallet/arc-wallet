import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, SpinnerIcon, TrashIcon } from './Icons';
import { agentService, AgentResponse } from '../services/agentService';

interface AgentScreenProps {
    onExecuteIntent?: (intent: any) => void;
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'agent';
    timestamp: Date;
    intent?: any;
}

const AgentScreen: React.FC<AgentScreenProps> = ({ onExecuteIntent }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: "Hi! I'm your Arc Agent. I can help you send assets, swap tokens, or check your balance. What would you like to do?",
            sender: 'agent',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        loadHistory();
    }, []);

    useEffect(scrollToBottom, [messages]);

    const loadHistory = async () => {
        try {
            const history = await agentService.getHistory();
            if (history && history.length > 0) {
                const formattedHistory: Message[] = history.flatMap((conv: any) => [
                    {
                        id: `user-${conv.id}`,
                        text: conv.user_message,
                        sender: 'user',
                        timestamp: new Date(conv.created_at),
                    },
                    {
                        id: `agent-${conv.id}`,
                        text: conv.agent_response,
                        sender: 'agent',
                        timestamp: new Date(conv.created_at), // approximate
                        intent: conv.intent ? JSON.parse(conv.intent) : undefined,
                    }
                ]);
                // Keep welcome message if history is empty, otherwise replace or prepend?
                // Let's prepend history to the current session (which starts with welcome)
                // Actually, if we have history, maybe we don't need the generic welcome message, or we keep it at the very top?
                // Let's just append history after the welcome message for now, or replace it.
                // Better: Set messages to history, and maybe add a "History loaded" divider?
                // For simplicity:
                setMessages((prev) => {
                    const welcome = prev.find(m => m.id === 'welcome');
                    return welcome ? [welcome, ...formattedHistory] : formattedHistory;
                });
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    };

    const handleClearHistory = async () => {
        try {
            await agentService.clearHistory();
            setMessages([
                {
                    id: 'welcome',
                    text: "History cleared. How can I help you now?",
                    sender: 'agent',
                    timestamp: new Date(),
                },
            ]);
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await agentService.parseIntent(userMsg.text);

            const agentMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: response.message,
                sender: 'agent',
                timestamp: new Date(),
                intent: response.intent.type !== 'UNKNOWN' ? response.intent : undefined,
            };

            setMessages((prev) => [...prev, agentMsg]);

        } catch (error) {
            console.error('Agent error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error. Please try again.",
                sender: 'agent',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleExecute = (intent: any) => {
        if (onExecuteIntent) {
            onExecuteIntent(intent);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-slate-500/50 overflow-hidden">
                        <img src="/arc-agent-logo.png" alt="Arc Agent" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-[#E6EEF3]">Arc Agent</h2>
                        <p className="text-[#A7B4C8] text-sm">Powered by Intent-Based Architecture</p>
                    </div>
                </div>
                <button
                    onClick={handleClearHistory}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Clear History"
                >
                    <TrashIcon size={20} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#151A22] rounded-xl border border-white/5 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'user'
                                    ? 'bg-primary text-primary-text rounded-tr-none'
                                    : 'bg-white/10 text-[#E6EEF3] rounded-tl-none'
                                    }`}
                            >
                                <p className="leading-relaxed">{msg.text}</p>
                                <p className="text-[10px] opacity-50 mt-2 text-right">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            {msg.intent && onExecuteIntent && (
                                <button
                                    onClick={() => handleExecute(msg.intent)}
                                    className="mt-2 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <span>Proceed to {msg.intent.type === 'SEND' ? 'Send' : msg.intent.type === 'SWAP' ? 'Swap' : 'Action'}</span>
                                    <span className="text-xs opacity-70">→</span>
                                </button>
                            )}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-[#091325]/50">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type a command (e.g., 'Send 10 USDC to Bob')..."
                            className="flex-1 bg-[#151A22] border border-white/10 rounded-lg px-4 py-3 text-[#E6EEF3] placeholder-[#A7B4C8] focus:outline-none focus:border-primary transition-colors"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping}
                            className="bg-primary text-primary-text p-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SendIcon size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentScreen;
