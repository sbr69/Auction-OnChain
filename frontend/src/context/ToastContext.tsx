import React, { createContext, useContext, useState, useCallback } from 'react';
import { TxState } from '../types';
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, X } from 'lucide-react';

interface ToastContextType {
  txState: TxState;
  setTxState: (state: TxState) => void;
  showToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  resetTxState: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [txState, setTxState] = useState<TxState>({ status: 'IDLE' });
  const [customToast, setCustomToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; description?: string } | null>(null);

  const resetTxState = useCallback(() => {
    setTxState({ status: 'IDLE' });
    setCustomToast(null);
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', title: string, description?: string) => {
    setCustomToast({ type, title, description });
    setTimeout(() => {
      setCustomToast(null);
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ txState, setTxState, showToast, resetTxState }}>
      {children}
      
      {(txState.status !== 'IDLE' || customToast) && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 animate-slide-up">
          <div className="glass-card p-4 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden bg-dark-card/95 backdrop-blur-xl">
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              txState.status === 'SUCCESS' || customToast?.type === 'success' ? 'bg-emerald-500 shadow-glow-cyan' :
              txState.status === 'FAILED' || customToast?.type === 'error' ? 'bg-rose-500' :
              'bg-brand-500 animate-pulse'
            }`} />

            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {txState.status === 'SUCCESS' || customToast?.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : txState.status === 'FAILED' || customToast?.type === 'error' ? (
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                ) : (
                  <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-white flex items-center justify-between">
                  {customToast ? customToast.title :
                   txState.status === 'SIMULATING' ? 'Simulating Transaction...' :
                   txState.status === 'SIGNING' ? 'Please Confirm in Wallet' :
                   txState.status === 'SUBMITTING' || txState.status === 'PENDING' ? 'Submitting to Stellar...' :
                   txState.status === 'SUCCESS' ? 'Transaction Confirmed!' :
                   txState.status === 'FAILED' ? 'Transaction Failed' : 'Processing...'}
                </h4>

                <p className="text-xs text-slate-300 mt-1 break-words">
                  {customToast ? customToast.description :
                   txState.message || txState.error || 'Interacting with Soroban smart contract.'}
                </p>

                {txState.txHash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txState.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2 font-medium underline"
                  >
                    View on Stellar Expert <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {(txState.status === 'SUCCESS' || txState.status === 'FAILED' || customToast) && (
                <button
                  onClick={resetTxState}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
