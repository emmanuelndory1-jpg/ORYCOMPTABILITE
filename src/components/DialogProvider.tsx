import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AlertCircle, Check, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DialogContextType {
  alert: (message: string, type?: 'error' | 'success' | 'info') => void;
  confirm: (message: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; message: string; resolve: (value: boolean) => void } | null>(null);

  const alert = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ isOpen: true, message, resolve });
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleConfirm = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl p-4 flex items-start gap-3 w-full"
            >
              <div className={`mt-0.5 shrink-0 ${
                toast.type === 'error' ? 'text-rose-500' :
                toast.type === 'success' ? 'text-brand-green' : 'text-brand-gold'
              }`}>
                {toast.type === 'error' ? <AlertCircle size={20} /> :
                 toast.type === 'success' ? <Check size={20} /> : <Info size={20} />}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {toast.type === 'error' ? 'Erreur' :
                   toast.type === 'success' ? 'Succès' : 'Information'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{toast.message}</p>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Modal */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-brand-gold/10 dark:bg-brand-gold/20 text-brand-gold mx-auto flex items-center justify-center mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirmation</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{confirmState.message}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className="flex-1 py-2 bg-brand-gold text-white rounded-xl font-medium hover:bg-brand-gold-dark transition-colors shadow-lg shadow-brand-gold/20"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
