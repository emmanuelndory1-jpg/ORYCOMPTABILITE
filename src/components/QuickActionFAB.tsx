import React, { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuickActionFABProps {
  onAction: (action: string) => void;
}

export function QuickActionFAB({ onAction }: QuickActionFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleAction = (action: string) => {
    onAction(action);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-28 right-6 z-30 flex flex-col items-end gap-3 text-right">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ delay: 0.05 }}
              onClick={() => handleAction('invoice')}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black uppercase tracking-widest text-[10px]"
            >
              <span>Nouvelle Facture</span>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                <FileText size={18} />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              onClick={() => handleAction('payroll')}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black uppercase tracking-widest text-[10px]"
            >
              <span>Faire la Paie</span>
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
                <FileText size={18} />
              </div>
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ delay: 0.15 }}
              onClick={() => handleAction('asset')}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black uppercase tracking-widest text-[10px]"
            >
              <span>Créer Actif</span>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                <FileText size={18} />
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={toggleOpen}
        className={`w-14 h-14 rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.3)] flex items-center justify-center text-white transition-all duration-300 ${
          isOpen ? 'bg-slate-800 rotate-45 scale-90' : 'bg-brand-green hover:bg-brand-green-light active:scale-95'
        }`}
      >
        <Plus size={32} />
      </button>
    </div>
  );
}
