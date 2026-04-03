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
    <div className="md:hidden fixed bottom-20 right-4 z-30 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              transition={{ delay: 0.1 }}
              onClick={() => handleAction('scan')}
              className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-full shadow-lg border border-slate-100 font-medium"
            >
              <span className="text-sm">Scanner Facture</span>
              <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
                <Camera size={16} />
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              onClick={() => handleAction('new')}
              className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-full shadow-lg border border-slate-100 font-medium"
            >
              <span className="text-sm">Nouvelle Saisie</span>
              <div className="w-8 h-8 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center">
                <FileText size={16} />
              </div>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={toggleOpen}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${
          isOpen ? 'bg-slate-800 rotate-45' : 'bg-brand-green hover:bg-brand-green-light'
        }`}
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
