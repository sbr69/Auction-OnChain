import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { Wallet, LogOut, ShieldCheck, UserPlus, ChevronDown } from 'lucide-react';
import { shortenAddress, formatXlm } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { UsernameForm } from './UsernameForm';

export const ConnectButton: React.FC = () => {
  const { address, username, isRegistered, isAdmin, balance, isConnecting, connect, disconnect } = useWallet();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-accent/90 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="glass-card px-3.5 py-2 rounded-xl flex items-center gap-3 border border-white/10 hover:border-brand-500/40 transition-all text-sm group"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs border border-brand-500/30">
            {username ? username[0].toUpperCase() : 'W'}
          </div>

          <div className="text-left hidden sm:block">
            <div className="font-semibold text-white text-xs flex items-center gap-1.5">
              {username ? `@${username}` : shortenAddress(address)}
              {isAdmin && (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold border border-amber-500/30">
                  ADMIN
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {formatXlm(balance)}
            </div>
          </div>

          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-transform" />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 mt-2 w-64 glass-card rounded-2xl p-2 border border-white/10 shadow-2xl z-50 bg-dark-card/95 backdrop-blur-xl animate-fade-in"
            onClick={() => setShowMenu(false)}
          >
            <div className="p-3 border-b border-white/5 mb-1">
              <p className="text-xs text-slate-400">Connected Wallet</p>
              <p className="text-xs font-mono text-slate-200 break-all mt-0.5">{address}</p>
              {username ? (
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified: @{username}
                </div>
              ) : (
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="mt-2 w-full text-left inline-flex items-center gap-1.5 text-xs text-brand-400 font-bold bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1.5 rounded-lg border border-brand-500/30 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Claim Username (Required)
                </button>
              )}
            </div>

            <button
              onClick={disconnect}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" /> Disconnect Wallet
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Account Identity Registration"
      >
        <UsernameForm onSuccess={() => setShowRegisterModal(false)} />
      </Modal>
    </>
  );
};
