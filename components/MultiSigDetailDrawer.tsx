import React from 'react';
import { MultiSigTransaction, Signer } from '../types';
import { CheckCircleIcon, CancelIcon, PendingIcon, CloseIcon } from './Icons';

interface MultiSigDetailDrawerProps {
    transaction: MultiSigTransaction;
    onClose: () => void;
    onApprove: (txId: string) => void;
    onReject: (txId: string) => void;
}

const DetailRow: React.FC<{ label: string, value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-start">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="text-text-primary text-sm font-medium text-right">{value}</span>
    </div>
);

const SignerRow: React.FC<{ signer: Signer }> = ({ signer }) => {
    let statusIcon: React.ReactNode;
    let statusColor = 'text-text-secondary';
    
    switch (signer.status) {
        case 'Signed':
            statusIcon = <CheckCircleIcon size={20} className="text-accent-success" />;
            statusColor = 'text-accent-success';
            break;
        case 'Rejected':
             statusIcon = <CancelIcon size={20} className="text-accent-red" />;
             statusColor = 'text-accent-red';
             break;
        case 'Pending':
        default:
            statusIcon = <PendingIcon size={20} className="text-text-secondary" />;
            break;
    }

    return (
        <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-text-secondary">
                {signer.address.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
                <p className="text-sm font-mono text-text-primary">{signer.address}</p>
                <p className="text-xs text-text-secondary">{signer.role}</p>
            </div>
            <div className={`ml-auto flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
                {statusIcon}
                <span>{signer.status}</span>
            </div>
        </div>
    );
};

const MultiSigDetailDrawer: React.FC<MultiSigDetailDrawerProps> = ({ transaction, onClose, onApprove, onReject }) => {
    
    const signedCount = transaction.signatures.signers.filter(s => s.status === 'Signed').length;
    
    return (
        <>
            <div onClick={onClose} className="fixed inset-0 bg-black/60 z-30 transition-opacity animate-in fade-in-0"></div>
            <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border-divider-strong flex flex-col z-40 transition-transform animate-in slide-in-from-right-full duration-300">
                <div className="p-6 border-b border-border-divider-strong flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text-primary">Transaction Details</h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
                        <CloseIcon size={20} />
                    </button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="flex flex-col gap-6">
                        {/* Transaction Summary */}
                        <div className="flex flex-col gap-4">
                            <DetailRow label="Action" value={transaction.actionType} />
                            <DetailRow label="Amount" value={`${transaction.amount} ${transaction.currency} ($${transaction.usdValue.toLocaleString()})`} />
                            <DetailRow label="From" value={<span className="font-mono">{transaction.from}</span>} />
                            <DetailRow label="To" value={<span className="font-mono">{transaction.to}</span>} />
                             <DetailRow label="Requested By" value={<span className="font-mono">{transaction.requestedBy}</span>} />
                            <DetailRow label="Network Fee Est." value={`${transaction.networkFee} ETH`} />
                        </div>
                        <hr className="border-border-divider-strong" />
                        {/* Multi-Sig Info */}
                        <div>
                            <h3 className="text-text-primary font-bold mb-4">Signatures ({signedCount} of {transaction.signatures.required} required)</h3>
                            <div className="flex flex-col gap-3">
                                {transaction.signatures.signers.map((signer, index) => (
                                    <SignerRow key={index} signer={signer} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {transaction.status === 'Pending' && (
                    <div className="p-6 border-t border-border-divider-strong flex gap-4">
                        <button 
                            onClick={() => onReject(transaction.id)}
                            className="flex-1 h-12 flex items-center justify-center rounded-lg border border-accent-red text-accent-red font-bold text-base hover:bg-accent-red/10 transition-colors">
                            Reject Transaction
                        </button>
                        <button 
                             onClick={() => onApprove(transaction.id)}
                            className="flex-1 h-12 flex items-center justify-center rounded-lg bg-primary text-primary-text font-bold text-base hover:bg-[#B9D1ED] transition-colors">
                            Approve Transaction
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
};

export default MultiSigDetailDrawer;
