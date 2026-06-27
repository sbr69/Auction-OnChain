import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loader: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading blockchain data...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
        <Loader2 className="w-6 h-6 text-brand-400 absolute top-3 left-3 animate-pulse" />
      </div>
      {label && <p className="text-slate-400 text-sm mt-4 font-medium animate-pulse">{label}</p>}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/5 animate-pulse space-y-4">
      <div className="w-full h-48 bg-white/5 rounded-xl" />
      <div className="h-6 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/5 rounded w-1/2" />
      <div className="flex justify-between items-center pt-2">
        <div className="h-8 bg-white/10 rounded w-1/3" />
        <div className="h-8 bg-brand-500/20 rounded w-1/4" />
      </div>
    </div>
  );
};
