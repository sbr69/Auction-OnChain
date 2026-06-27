import React from 'react';
import { CONTRACT_ID } from '../../utils/constants';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/5 bg-dark-bg/60 backdrop-blur-md py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-sm border border-brand-500/30">
            SB
          </div>
          <p className="text-xs text-slate-400">
            © 2026 StellarBid. Decentralized Real-Time Auctions on Soroban Testnet.
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-medium text-slate-400">
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-400 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Contract Explorer <ExternalLink className="w-3 h-3" />
          </a>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[11px] font-semibold">
            Stellar Testnet
          </span>
        </div>
      </div>
    </footer>
  );
};
