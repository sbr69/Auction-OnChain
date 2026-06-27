import React, { useState, useEffect } from 'react';
import { formatTimeRemaining } from '../../utils/formatters';
import { Clock, Timer } from 'lucide-react';

export const AuctionTimer: React.FC<{ endTime: number; compact?: boolean }> = ({ endTime, compact = false }) => {
  const [time, setTime] = useState(() => formatTimeRemaining(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = formatTimeRemaining(endTime);
      setTime(updated);
      if (updated.isExpired) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  if (time.isExpired) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-slate-400 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
        <Clock className="w-4 h-4 text-slate-500" /> Auction Ended
      </div>
    );
  }

  const isUrgent = time.days === 0 && time.hours < 1;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 font-semibold text-xs ${isUrgent ? 'text-amber-400 animate-pulse' : 'text-slate-200'}`}>
        <Timer className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-400' : 'text-brand-400'}`} />
        {time.days > 0 && `${time.days}d `}
        {String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m {String(time.seconds).padStart(2, '0')}s
      </div>
    );
  }

  return (
    <div className={`glass-card p-4 rounded-2xl border ${isUrgent ? 'border-amber-500/40 bg-amber-500/5 shadow-glow-gold' : 'border-white/10'}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
        <Timer className={`w-4 h-4 ${isUrgent ? 'text-amber-400 animate-pulse' : 'text-brand-400'}`} /> Time Remaining
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <span className={`text-xl font-bold block ${isUrgent ? 'text-amber-400' : 'text-white'}`}>{time.days}</span>
          <span className="text-[10px] uppercase text-slate-400 font-semibold">Days</span>
        </div>
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <span className={`text-xl font-bold block ${isUrgent ? 'text-amber-400' : 'text-white'}`}>{String(time.hours).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase text-slate-400 font-semibold">Hours</span>
        </div>
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <span className={`text-xl font-bold block ${isUrgent ? 'text-amber-400' : 'text-white'}`}>{String(time.minutes).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase text-slate-400 font-semibold">Mins</span>
        </div>
        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
          <span className={`text-xl font-bold block ${isUrgent ? 'text-amber-400 animate-pulse' : 'text-white'}`}>{String(time.seconds).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase text-slate-400 font-semibold">Secs</span>
        </div>
      </div>
    </div>
  );
};
