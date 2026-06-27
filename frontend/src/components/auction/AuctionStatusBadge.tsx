import React from 'react';
import { AuctionStatusType } from '../../types';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export const AuctionStatusBadge: React.FC<{ status: AuctionStatusType }> = ({ status }) => {
  switch (status) {
    case 'Approved':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Auction
        </span>
      );
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5" />
          Pending Review
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Rejected
        </span>
      );
    case 'Ended':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <Clock className="w-3.5 h-3.5" />
          Ended
        </span>
      );
    default:
      return null;
  }
};
