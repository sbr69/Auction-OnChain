import { X, Clock, User } from 'lucide-react';
import { shortenAddress } from '../utils/formatters';

interface BidEntry {
  bidder: string;
  amount: number;
  timestamp: number;
}

interface BidHistoryModalProps {
  bids: BidEntry[];
  onClose: () => void;
}

export function BidHistoryModal({ bids, onClose }: BidHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-950/40 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-border w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-serif text-xl font-medium text-brand-900">Bid History</h3>
          <button onClick={onClose} className="text-brand-500 hover:text-brand-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-grow">
          {bids.length === 0 ? (
            <p className="text-brand-500 text-center py-8">No bids placed yet.</p>
          ) : (
            <div className="space-y-4">
              {bids.sort((a, b) => b.timestamp - a.timestamp).map((bid, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-brand-50 rounded-xl border border-brand-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-900 font-mono">{shortenAddress(bid.bidder, 6)}</p>
                      <div className="flex items-center gap-1 text-xs text-brand-500">
                        <Clock className="w-3 h-3" />
                        {new Date(bid.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-brand-900">{bid.amount.toFixed(2)} XLM</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
