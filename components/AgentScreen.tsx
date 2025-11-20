import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, SpinnerIcon } from './Icons';
import { agentService, AgentResponse } from '../services/agentService';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'agent';
    timestamp: Date;
}

const AgentScreen: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
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

    useEffect(scrollToBottom, [messages]);

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
            };

            setMessages((prev) => [...prev, agentMsg]);

            // Handle actions (mock)
            if (response.action?.type === 'SWAP') {
                // In a real app, this would navigate or open a modal
                setTimeout(() => {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        text: "I've opened the swap interface for you (Simulated).",
                        sender: 'agent',
                        timestamp: new Date()
                    }]);
                }, 1000);
            }

        } catch (error) {
            console.error('Agent error:', error);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-xl">🤖</span>
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-[#E6EEF3]">Arc Agent</h2>
                    <p className="text-[#A7B4C8] text-sm">Powered by Intent-Based Architecture</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#151A22] rounded-xl border border-white/5 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
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
