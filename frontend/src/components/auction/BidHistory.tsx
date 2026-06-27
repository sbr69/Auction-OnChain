import React from 'react';
import { formatXlm, shortenAddress } from '../../utils/formatters';
import { TrendingUp, Award } from 'lucide-react';

interface BidHistoryProps {
  highestBid: number;
  highestBidder: string;
  totalBids: number;
}

export const BidHistory: React.FC<BidHistoryProps> = ({ highestBid, highestBidder, totalBids }) => {
  if (totalBids === 0) {
    return (
      <div className="glass-card p-6 rounded-2xl text-center border border-white/5">
        <p className="text-slate-400 text-sm">No bids placed yet. Be the first bidder!</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
        <span>Recent Bidding Activity</span>
        <span className="text-brand-400">{totalBids} total</span>
      </h4>

      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Current Highest Bidder</span>
            <span className="text-xs font-mono text-white font-bold">{shortenAddress(highestBidder)}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> {formatXlm(highestBid)}
          </span>
        </div>
      </div>
    </div>
  );
};
