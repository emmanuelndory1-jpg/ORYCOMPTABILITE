import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

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

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{ isOpen: boolean; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; message: string; resolve: (value: boolean) => void } | null>(null);

  const alert = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setAlertState({ isOpen: true, message, type });
  };

  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ isOpen: true, message, resolve });
    });
  };

  const closeAlert = () => setAlertState(prev => ({ ...prev, isOpen: false }));

  const handleConfirm = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}

      {/* Alert Modal */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${
                alertState.type === 'error' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' :
                alertState.type === 'success' ? 'bg-brand-green/10 text-brand-green' :
                'bg-brand-gold/10 dark:bg-brand-gold/20 text-brand-gold'
              }`}>
                {alertState.type === 'error' ? <AlertCircle size={24} /> :
                 alertState.type === 'success' ? <Check size={24} /> :
                 <AlertCircle size={24} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {alertState.type === 'error' ? 'Erreur' :
                 alertState.type === 'success' ? 'Succès' : 'Information'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{alertState.message}</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={closeAlert}
                className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
