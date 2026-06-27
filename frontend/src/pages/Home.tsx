import React, { useState, useEffect, useCallback } from 'react';
import { fetchAllAuctions } from '../services/contract';
import { Auction } from '../types';
import { AuctionCard } from '../components/auction/AuctionCard';
import { Loader, CardSkeleton } from '../components/ui/Loader';
import { EventPoller } from '../services/events';
import { Sparkles, Gavel, ArrowRight, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home: React.FC = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'endingSoon' | 'highestBid'>('all');

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAllAuctions();
      setAuctions(data.filter(a => a.status === 'Approved'));
    } catch (err) {
      console.error("Error loading home auctions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = EventPoller.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const filteredAuctions = [...auctions].sort((a, b) => {
    if (filter === 'endingSoon') return a.endTime - b.endTime;
    if (filter === 'highestBid') return b.highestBid - a.highestBid;
    return b.id - a.id;
  });

  return (
    <div className="space-y-12">
      <section className="relative glass-card rounded-3xl p-8 sm:p-12 border border-white/10 overflow-hidden bg-gradient-to-br from-brand-900/40 via-dark-card to-dark-bg shadow-2xl">
        <div className="max-w-2xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" /> Powered by Stellar Soroban Smart Contracts
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-none">
            Trustless Real-Time <br />
            <span className="text-gradient-purple">Digital Auctions</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            Bid on verified auctions with XLM held safely in on-chain escrow. 
            Claim permanent identity, enjoy instant refunds, and experience real-time updates.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/create"
              className="px-6 py-3.5 bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-accent/90 text-white font-bold rounded-2xl shadow-lg shadow-brand-500/25 transition-all flex items-center gap-2 text-sm group"
            >
              <Gavel className="w-4 h-4" /> Start Your Auction
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Active Auctions</h2>
            <p className="text-slate-400 text-sm">Reviewer-verified items open for bidding</p>
          </div>

          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 self-start sm:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'all' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilter('endingSoon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'endingSoon' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ending Soon
            </button>
            <button
              onClick={() => setFilter('highestBid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === 'highestBid' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Top Bids
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center border border-white/5 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mx-auto">
              <Filter className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">No Live Auctions Found</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              There are currently no approved live auctions in the feed. Be the first to create one!
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm transition-all"
            >
              <Gavel className="w-4 h-4" /> Create First Auction
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
