import { useState, useEffect } from 'react';
import { Clock, ArrowUpRight, History } from 'lucide-react';
import { Auction } from '../types';
import { formatTimeRemaining, resolveIpfsUrl, formatXlm } from '../utils/formatters';
import { Link } from 'react-router-dom';

interface AuctionCardProps {
  auction: Auction;
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const { days, hours, minutes, seconds, isExpired } = formatTimeRemaining(auction.endTime);

      if (isExpired) {
        setIsEnded(true);
        return 'Ended';
      }

      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      return `${minutes}m ${seconds}s`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [auction.endTime]);

  const statusLabel = auction.status === 'Pending' ? 'Pending' :
    auction.status === 'Approved' && !isEnded ? 'Live' :
    auction.status === 'Rejected' ? 'Rejected' :
    'Ended';

  return (
    <Link
      to={`/auction/${auction.id}`}
      className="bg-surface rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:shadow-brand-900/5 transition-all duration-300 flex flex-col group"
    >
      <div className="relative h-64 overflow-hidden">
        <img
          src={resolveIpfsUrl(auction.mediaUrl)}
          alt={auction.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          {auction.status === 'Pending' && (
            <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md bg-opacity-90">
              Pending
            </span>
          )}
          {auction.status === 'Approved' && !isEnded && (
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md bg-opacity-90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          )}
          {(isEnded || auction.status === 'Ended') && (
            <span className="bg-brand-100 text-brand-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md bg-opacity-90">
              Ended
            </span>
          )}
        </div>
        <div className="absolute top-4 right-4 bg-surface/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-brand-900 flex items-center gap-1.5 shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          {timeLeft}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3 className="font-serif text-xl font-medium text-brand-900 mb-2 line-clamp-1">{auction.title}</h3>
        <p className="text-brand-600 text-sm mb-6 line-clamp-2 leading-relaxed">{auction.description}</p>

        <div className="mt-auto">
          <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-t border-border/60">
            <div>
              <p className="text-xs text-brand-500 mb-1 uppercase tracking-wider font-semibold">Highest Bid</p>
              <p className="text-lg font-mono text-brand-900">
                {auction.totalBids > 0 ? formatXlm(auction.highestBid) : formatXlm(auction.startingBid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-500 mb-1 uppercase tracking-wider font-semibold">Total Bids</p>
              <p className="text-lg font-mono text-brand-900">{auction.totalBids}</p>
            </div>
          </div>

          <div className="text-sm font-medium text-brand-600 hover:text-brand-900 transition-colors flex items-center gap-1.5 bg-brand-50 py-1.5 px-3 rounded-md w-fit">
            <ArrowUpRight className="w-4 h-4" />
            View Details
          </div>
        </div>
      </div>
    </Link>
  );
}
