import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { TxState } from '../types';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string) => void;
  txState: TxState;
  setTxState: (state: TxState) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ type: ToastType; title: string; message?: string } | null>(null);
  const [txState, setTxState] = useState<TxState>({ status: 'IDLE' });

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const iconMap = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-brand-500" />,
  };

  const bgMap = {
    success: 'bg-surface border-emerald-100',
    error: 'bg-rose-50 border-rose-200',
    info: 'bg-brand-50 border-brand-200',
  };

  return (
    <ToastContext.Provider value={{ showToast, txState, setTxState }}>
      {children}

      {/* Transaction progress bar */}
      <AnimatePresence>
        {txState.status !== 'IDLE' && txState.status !== 'SUCCESS' && txState.status !== 'FAILED' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-surface border border-border rounded-xl shadow-lg px-6 py-3 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-brand-900">{txState.message || 'Processing...'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className={`flex items-start gap-3 px-6 py-4 rounded-xl shadow-lg border ${bgMap[toast.type]}`}>
              {iconMap[toast.type]}
              <div className="flex-1">
                <p className="font-semibold text-sm text-brand-900">{toast.title}</p>
                {toast.message && <p className="text-xs text-brand-600 mt-0.5">{toast.message}</p>}
              </div>
              <button onClick={() => setToast(null)} className="text-brand-400 hover:text-brand-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
