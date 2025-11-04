import React, { useState, useMemo } from 'react';
import { MULTI_SIG_TRANSACTIONS } from '../constants';
import { MultiSigTransaction, MultiSigStatus, Signer } from '../types';
import MultiSigDetailDrawer from './MultiSigDetailDrawer';


const StatusIndicator: React.FC<{ status: MultiSigStatus }> = ({ status }) => {
    const baseClasses = "flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full";
    switch (status) {
        case MultiSigStatus.Pending:
            return <div className={`${baseClasses} bg-accent-orange/10 text-accent-orange`}><div className="size-1.5 rounded-full bg-accent-orange"></div>Pending</div>;
        case MultiSigStatus.Approved:
            return <div className={`${baseClasses} bg-accent-success/10 text-accent-success`}><div className="size-1.5 rounded-full bg-accent-success"></div>Approved</div>;
        case MultiSigStatus.Rejected:
            return <div className={`${baseClasses} bg-accent-red/10 text-accent-red`}><div className="size-1.5 rounded-full bg-accent-red"></div>Rejected</div>;
        default:
            return null;
    }
};


const MultiSigDashboard: React.FC = () => {
    const [transactions, setTransactions] = useState<MultiSigTransaction[]>(MULTI_SIG_TRANSACTIONS);
    const [activeTab, setActiveTab] = useState<MultiSigStatus>(MultiSigStatus.Pending);
    const [selectedTx, setSelectedTx] = useState<MultiSigTransaction | null>(null);
    
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => tx.status === activeTab);
    }, [transactions, activeTab]);

    const handleApprove = (txId: string) => {
       setTransactions(prev => prev.map(tx => {
           if (tx.id === txId) {
               // In a real app, this would be the current user
               const currentUserAddress = 'bob@arc.xyz';
               let signedCount = 0;
               const newSigners = tx.signatures.signers.map(s => {
                   if (s.address === currentUserAddress && s.status === 'Pending') {
                       return {...s, status: 'Signed' as const};
                   }
                   return s;
               });

               newSigners.forEach(s => {
                   if (s.status === 'Signed') signedCount++;
               });

               const newStatus = signedCount >= tx.signatures.required ? MultiSigStatus.Approved : tx.status;
               
               return { ...tx, status: newStatus, signatures: { ...tx.signatures, signers: newSigners }};
           }
           return tx;
       }));
       setSelectedTx(null);
    };

    const handleReject = (txId: string) => {
        setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, status: MultiSigStatus.Rejected } : tx));
        setSelectedTx(null);
    };


    const tabs: { label: string, status: MultiSigStatus }[] = [
        { label: 'Pending', status: MultiSigStatus.Pending },
        { label: 'Approved', status: MultiSigStatus.Approved },
        { label: 'Rejected', status: MultiSigStatus.Rejected },
    ];
    
    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-text-primary">Multi-Signature Approvals</h1>
                <p className="mt-2 text-base font-normal leading-normal text-text-secondary">Transactions requiring organizational approval.</p>
            </div>

            {/* Filter Tabs */}
            <nav className="flex border-b border-border-divider-strong mb-6">
                {tabs.map(tab => (
                    <button 
                        key={tab.status} 
                        onClick={() => setActiveTab(tab.status)}
                        className={`px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab.status ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Transaction List Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="text-text-secondary">
                        <tr>
                            <th className="p-3 font-medium">Action Type</th>
                            <th className="p-3 font-medium">Amount</th>
                            <th className="p-3 font-medium">Requested By</th>
                            <th className="p-3 font-medium">Signatures</th>
                            <th className="p-3 font-medium">Time</th>
                            <th className="p-3 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody className="align-top">
                        {filteredTransactions.map(tx => {
                            const signedCount = tx.signatures.signers.filter(s => s.status === 'Signed').length;
                            return (
                                <tr 
                                    key={tx.id} 
                                    onClick={() => setSelectedTx(tx)}
                                    className="border-b border-border-divider-strong hover:bg-surface/50 cursor-pointer"
                                >
                                    <td className="p-4 align-middle text-text-primary font-semibold">{tx.actionType}</td>
                                    <td className="p-4 align-middle">
                                        <div className="font-semibold text-text-primary">{tx.amount} {tx.currency}</div>
                                        <div className="text-text-secondary">${tx.usdValue.toLocaleString()}</div>
                                    </td>
                                    <td className="p-4 align-middle text-text-secondary font-mono">{tx.requestedBy}</td>
                                    <td className="p-4 align-middle text-text-secondary">{signedCount} / {tx.signatures.required} signed</td>
                                    <td className="p-4 align-middle text-text-secondary">{tx.timestamp}</td>
                                    <td className="p-4 align-middle"><StatusIndicator status={tx.status} /></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {filteredTransactions.length === 0 && (
                    <div className="text-center py-12 text-text-secondary">
                        No {activeTab.toLowerCase()} transactions found.
                    </div>
                )}
            </div>

            {selectedTx && (
                <MultiSigDetailDrawer 
                    transaction={selectedTx} 
                    onClose={() => setSelectedTx(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            )}
        </div>
    );
};

export default MultiSigDashboard;
