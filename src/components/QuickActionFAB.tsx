import React, { useState } from 'react';
import { Plus, X, FileText, Camera } from 'lucide-react';
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
    <div className="md:hidden fixed bottom-28 right-6 z-30 flex flex-col items-end gap-3 text-right">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              onClick={() => handleAction('scan')}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black uppercase tracking-widest text-[10px]"
            >
              <span>Scanner Facture</span>
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
                <Camera size={18} />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              onClick={() => handleAction('new')}
              className="flex items-center gap-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 font-black uppercase tracking-widest text-[10px]"
            >
              <span>Nouvelle Saisie</span>
              <div className="w-10 h-10 bg-brand-green/10 text-brand-green rounded-xl flex items-center justify-center">
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
