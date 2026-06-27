import React from 'react';
import { Link } from 'react-router-dom';
import { Auction } from '../../types';
import { formatXlm, resolveIpfsUrl, shortenAddress } from '../../utils/formatters';
import { AuctionTimer } from './AuctionTimer';
import { AuctionStatusBadge } from './AuctionStatusBadge';
import { TrendingUp, Gavel, User } from 'lucide-react';

export const AuctionCard: React.FC<{ auction: Auction }> = ({ auction }) => {
  const mediaSrc = resolveIpfsUrl(auction.mediaUrl);

  return (
    <Link
      to={`/auction/${auction.id}`}
      className="glass-card rounded-2xl border border-white/10 overflow-hidden group hover:border-brand-500/50 hover:shadow-glow-purple transition-all duration-300 flex flex-col h-full bg-dark-card/80"
    >
      <div className="relative w-full h-52 overflow-hidden bg-slate-900/50">
        <img
          src={mediaSrc}
          alt={auction.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/121420/8b5cf6?text=StellarBid+Item';
          }}
        />
        <div className="absolute top-3 left-3">
          <AuctionStatusBadge status={auction.status} />
        </div>
        <div className="absolute bottom-3 right-3 glass-card px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex items-center gap-1">
          <Gavel className="w-3.5 h-3.5 text-brand-cyan" /> {auction.totalBids} bids
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1.5">
            <User className="w-3.5 h-3.5 text-brand-400" />
            <span>by {shortenAddress(auction.creator)}</span>
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1">
            {auction.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1 font-normal">
            {auction.description}
          </p>
        </div>

        <div className="pt-3 border-t border-white/5 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
              {auction.totalBids > 0 ? 'Highest Bid' : 'Starting Bid'}
            </span>
            <div className="text-lg font-extrabold text-white flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {formatXlm(auction.totalBids > 0 ? auction.highestBid : auction.startingBid)}
            </div>
          </div>

          <div className="text-right">
            <AuctionTimer endTime={auction.endTime} compact />
          </div>
        </div>
      </div>
    </Link>
  );
};
