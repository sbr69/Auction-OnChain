import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { fetchAllAuctions, fetchUserBidDeposit } from '../services/contract';
import { Auction } from '../types';
import { AuctionCard } from '../components/auction/AuctionCard';
import { Loader } from '../components/ui/Loader';
import { formatXlm, shortenAddress } from '../utils/formatters';
import { User, Gavel, Coins, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { address, username, isRegistered, balance, connect } = useWallet();
  const [createdAuctions, setCreatedAuctions] = useState<Auction[]>([]);
  const [biddingAuctions, setBiddingAuctions] = useState<{ auction: Auction; deposit: number }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserData = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }
    try {
      const all = await fetchAllAuctions();
      const myCreated = all.filter(a => a.creator.toUpperCase() === address.toUpperCase());
      setCreatedAuctions(myCreated);

      const bidsWithDeposits: { auction: Auction; deposit: number }[] = [];
      for (const a of all) {
        const dep = await fetchUserBidDeposit(a.id, address);
        if (dep > 0) {
          bidsWithDeposits.push({ auction: a, deposit: dep });
        }
      }
      setBiddingAuctions(bidsWithDeposits);
    } catch (err) {
      console.error("Error loading user profile auctions:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  if (!address) {
    return (
      <div className="glass-card max-w-lg mx-auto p-10 rounded-3xl text-center border border-white/10 space-y-4 my-12">
        <User className="w-12 h-12 text-brand-400 mx-auto" />
        <h2 className="text-2xl font-bold text-white">My Dashboard</h2>
        <p className="text-slate-400 text-sm">Connect your Stellar wallet to view your active bids, created auctions, and refunds.</p>
        <button onClick={connect} className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="glass-card p-8 rounded-3xl border border-white/10 bg-gradient-to-r from-brand-900/40 via-dark-card to-dark-bg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-cyan p-0.5 shadow-glow-purple">
            <div className="w-full h-full bg-dark-bg rounded-[14px] flex items-center justify-center text-2xl font-black text-brand-cyan">
              {username ? username[0].toUpperCase() : 'W'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{username ? `@${username}` : 'Anonymous User'}</h1>
              {isRegistered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">{address}</p>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-right w-full md:w-auto">
          <span className="text-xs text-slate-400 font-semibold block uppercase">Wallet Balance</span>
          <span className="text-xl font-black text-white">{formatXlm(balance)}</span>
        </div>
      </div>

      {loading ? (
        <Loader label="Loading personal dashboard data..." />
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-brand-cyan" /> My Bids & Escrows ({biddingAuctions.length})
              </h2>
            </div>

            {biddingAuctions.length === 0 ? (
              <div className="glass-card p-8 rounded-2xl text-center border border-white/5 text-slate-400 text-sm">
                You have not placed bids on any auctions yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {biddingAuctions.map(({ auction, deposit }) => (
                  <Link
                    key={auction.id}
                    to={`/auction/${auction.id}`}
                    className="glass-card p-5 rounded-2xl border border-white/10 hover:border-brand-500/40 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Auction #{auction.id}</span>
                      <h4 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">{auction.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Your Escrow Deposit: <strong className="text-emerald-400">{formatXlm(deposit)}</strong>
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-400" /> My Created Auctions ({createdAuctions.length})
              </h2>
              <Link to="/create" className="text-xs text-brand-400 font-bold hover:underline">
                + Create New
              </Link>
            </div>

            {createdAuctions.length === 0 ? (
              <div className="glass-card p-8 rounded-2xl text-center border border-white/5 text-slate-400 text-sm">
                You have not created any auctions yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {createdAuctions.map(auction => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
