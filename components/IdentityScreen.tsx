import React from 'react';
import { VerifiedIcon } from './Icons';
import { useIdentity } from '../contexts/IdentityContext';

const IdentityScreen: React.FC = () => {
    const { credentials, reputationScore, identityLevel } = useIdentity();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[#E6EEF3]">Identity & Trust</h2>
                    <p className="text-[#A7B4C8] mt-1">Manage your Verifiable Credentials and Onchain Reputation</p>
                </div>
                <button className="px-4 py-2 bg-primary text-primary-text rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Add Credential
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Reputation Score Card */}
                <div className="bg-[#151A22] p-6 rounded-xl border border-white/5">
                    <h3 className="text-[#A7B4C8] font-medium mb-2">Reputation Score</h3>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-[#E6EEF3]">{reputationScore}</span>
                        <span className="text-green-400 text-sm mb-1">Good</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full mt-4 overflow-hidden">
                        <div className="bg-green-400 h-full rounded-full" style={{ width: `${(reputationScore / 1000) * 100}%` }} />
                    </div>
                </div>

                {/* Identity Level Card */}
                <div className="bg-[#151A22] p-6 rounded-xl border border-white/5">
                    <h3 className="text-[#A7B4C8] font-medium mb-2">Identity Level</h3>
                    <div className="flex items-center gap-2">
                        <VerifiedIcon size={32} className="text-blue-400" />
                        <div>
                            <p className="text-lg font-bold text-[#E6EEF3]">{identityLevel}</p>
                            <p className="text-xs text-[#A7B4C8]">Tier 2 Access</p>
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-bold text-[#E6EEF3] mt-4">My Credentials</h3>
            <div className="bg-[#151A22] rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-[#A7B4C8] text-sm uppercase">
                        <tr>
                            <th className="p-4 font-medium">Type</th>
                            <th className="p-4 font-medium">Issuer</th>
                            <th className="p-4 font-medium">Date</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {credentials.map((cred) => (
                            <tr key={cred.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-[#E6EEF3] font-medium">{cred.type}</td>
                                <td className="p-4 text-[#A7B4C8]">{cred.issuer}</td>
                                <td className="p-4 text-[#A7B4C8]">{cred.issueDate}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cred.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                                        }`}>
                                        {cred.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button className="text-[#A7B4C8] hover:text-white text-sm">View</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IdentityScreen;
