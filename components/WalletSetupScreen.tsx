import React, { useState } from 'react';
import { AddIcon, DocumentIcon } from './Icons';

interface SelectionCardProps {
    icon: string;
    title: string;
    description: string;
    isSelected: boolean;
    onClick: () => void;
}

const getIconComponent = (iconName: string) => {
    switch (iconName) {
        case 'add_card':
            return <AddIcon size={32} />;
        case 'move_to_inbox':
            return <DocumentIcon size={32} />;
        default:
            return <AddIcon size={32} />;
    }
};

const SelectionCard: React.FC<SelectionCardProps> = ({ icon, title, description, isSelected, onClick }) => {
    const selectedClasses = "border-2 border-[#9EBBE4]/60 bg-[#091325]/80 ring-4 ring-[#9EBBE4]/10";
    const baseClasses = "border border-[#D1DCE8]/20 bg-[#091325]/30 hover:border-[#9EBBE4]/50 hover:bg-[#091325]/60";

    return (
        <div
            className={`flex flex-col gap-3 rounded-lg p-4 transition-all cursor-pointer ${isSelected ? selectedClasses : baseClasses}`}
            onClick={onClick}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#9EBBE4]/10 text-[#9EBBE4]">
                {getIconComponent(icon)}
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-[#E6EEF3] text-base font-medium leading-normal">{title}</p>
                <p className="text-[#A7B4C8] text-sm font-normal leading-normal">{description}</p>
            </div>
        </div>
    );
}

interface WalletSetupScreenProps {
  onComplete: () => void;
}

const WalletSetupScreen: React.FC<WalletSetupScreenProps> = ({ onComplete }) => {
    const [selection, setSelection] = useState<'create' | 'import'>('import');

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl rounded-xl border border-[#D1DCE8]/20 bg-[#151A22] p-6 sm:p-8 lg:p-12">
                <div className="flex flex-col gap-8">
                    {/* ProgressBar */}
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-6 justify-between">
                            <p className="text-[#A7B4C8] text-sm font-medium leading-normal">Step 1 of 4</p>
                        </div>
                        <div className="rounded-full bg-[#091325]/50">
                            <div className="h-1.5 rounded-full bg-[#9EBBE4]" style={{ width: '25%' }}></div>
                        </div>
                    </div>
                    {/* PageHeading */}
                    <div className="flex flex-wrap justify-between gap-3">
                        <div className="flex w-full flex-col gap-2">
                            <h1 className="text-[#E6EEF3] text-3xl sm:text-4xl font-bold leading-tight tracking-tight">Set Up Your Wallet</h1>
                            <p className="text-[#A7B4C8] text-base font-normal leading-relaxed">Create a new secure wallet or import one you already have to manage your digital assets.</p>
                        </div>
                    </div>
                    {/* Selection Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <SelectionCard 
                            icon="add_card"
                            title="Create a new wallet"
                            description="Set up a brand new, secure wallet and get a recovery phrase."
                            isSelected={selection === 'create'}
                            onClick={() => setSelection('create')}
                       />
                       <SelectionCard 
                            icon="move_to_inbox"
                            title="I already have a wallet"
                            description="Import an existing wallet using your secret recovery phrase."
                            isSelected={selection === 'import'}
                            onClick={() => setSelection('import')}
                       />
                    </div>
                    {/* Separator */}
                    <div className="w-full h-px bg-[#D1DCE8]/20"></div>
                    {/* ButtonGroup */}
                    <div className="flex justify-stretch">
                        <div className="flex w-full flex-1 flex-wrap-reverse gap-3 sm:flex-nowrap justify-between">
                            <button className="flex min-w-[84px] w-full sm:w-auto cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-5 bg-transparent text-[#A7B4C8] text-base font-medium leading-normal tracking-wide transition-colors hover:text-[#E6EEF3]">
                                <span className="truncate">Back</span>
                            </button>
                            <button 
                                onClick={onComplete}
                                className="flex min-w-[84px] w-full sm:w-auto cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-5 bg-[#9EBBE4] text-[#091325] text-base font-bold leading-normal tracking-wide transition-opacity hover:opacity-90">
                                <span className="truncate">Continue</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletSetupScreen;
