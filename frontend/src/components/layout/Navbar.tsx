import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '../wallet/ConnectButton';
import { useWallet } from '../../context/WalletContext';
import { Gavel, PlusCircle, ShieldAlert, User, Compass } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const { isAdmin, isRegistered } = useWallet();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-cyan p-0.5 shadow-glow-purple group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-dark-bg rounded-[14px] flex items-center justify-center">
              <Gavel className="w-6 h-6 text-brand-cyan group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
              STELLAR<span className="text-gradient-purple">BID</span>
            </span>
            <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Soroban Auctions
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <Link
            to="/"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isActive('/')
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-4 h-4" /> Explore Auctions
          </Link>

          <Link
            to="/create"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isActive('/create')
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlusCircle className="w-4 h-4" /> Create Auction
          </Link>

          <Link
            to="/profile"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isActive('/profile')
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-4 h-4" /> My Dashboard
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive('/admin')
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/30'
                  : 'text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Reviewer Portal
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
};
