import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AddIcon, TrashIcon } from './Icons';

interface Transaction {
    to: string;
    amount: string;
    data?: string;
}

interface BatchTransferProps {
    onTransactionsChange: (transactions: Transaction[]) => void;
    tokenSymbol: string;
    balance: string;
}

export const BatchTransfer: React.FC<BatchTransferProps> = ({
    onTransactionsChange,
    tokenSymbol,
    balance
}) => {
    const [transactions, setTransactions] = useState<Transaction[]>([
        { to: '', amount: '' }
    ]);

    const updateTransaction = (index: number, field: keyof Transaction, value: string) => {
        const newTransactions = [...transactions];
        newTransactions[index] = { ...newTransactions[index], [field]: value };
        setTransactions(newTransactions);
        onTransactionsChange(newTransactions);
    };

    const addTransaction = () => {
        setTransactions([...transactions, { to: '', amount: '' }]);
    };

    const removeTransaction = (index: number) => {
        if (transactions.length === 1) return;
        const newTransactions = transactions.filter((_, i) => i !== index);
        setTransactions(newTransactions);
        onTransactionsChange(newTransactions);
    };

    const totalAmount = transactions.reduce((sum, tx) => {
        try {
            return sum + (parseFloat(tx.amount) || 0);
        } catch {
            return sum;
        }
    }, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-text-secondary">Recipients</h3>
                <button
                    onClick={addTransaction}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                    <AddIcon size={14} />
                    Add Recipient
                </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                <AnimatePresence initial={false}>
                    {transactions.map((tx, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative p-3 rounded-lg bg-[#0f1729] border border-white/5 group"
                        >
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex gap-3">
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={tx.to}
                                        onChange={(e) => updateTransaction(index, 'to', e.target.value)}
                                        placeholder="0x..."
                                        className="w-full bg-transparent text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none font-mono"
                                    />
                                    <div className="h-px bg-white/10" />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={tx.amount}
                                            onChange={(e) => updateTransaction(index, 'amount', e.target.value)}
                                            placeholder="0.00"
                                            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none"
                                        />
                                        <span className="text-xs text-text-secondary">{tokenSymbol}</span>
                                    </div>
                                </div>

                                {transactions.length > 1 && (
                                    <button
                                        onClick={() => removeTransaction(index)}
                                        className="p-1 text-text-secondary hover:text-red-400 transition-colors self-center"
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-sm text-text-secondary">Total</span>
                <div className="text-right">
                    <p className="text-sm font-bold text-text-primary">
                        {totalAmount.toFixed(4)} {tokenSymbol}
                    </p>
                    {parseFloat(balance) < totalAmount && (
                        <p className="text-xs text-red-400">Insufficient balance</p>
                    )}
                </div>
            </div>
        </div>
    );
};
