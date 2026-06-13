import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Command, Search, Zap, Calculator, Database, LogOut, Moon, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from '@/components/DialogProvider';

export function KeyboardShortcutsModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void 
}) {
  const [activeTab, setActiveTab] = useState<'global'|'journal'|'expert'>('global');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const shortcuts = {
    global: [
      { keys: ['⌘', 'K'], label: 'Ouvrir la recherche globale' },
      { keys: ['Shift', '?'], label: 'Afficher ces raccourcis' },
      { keys: ['Esc'], label: 'Fermer les fenêtres modales' },
    ],
    journal: [
      { keys: ['Alt', 'S'], label: 'Activer/Désactiver la Saisie Rapide (Enchaînement Tab/Entrée)' },
      { keys: ['Entrée'], label: 'Aller au champ de texte suivant / Imputer la ligne' },
      { keys: ['Tab'], label: 'Naviguer uniquement lorsque la saisie rapide est actée' },
    ],
    expert: [
      { keys: ['⌘', 'Shift', 'A'], label: 'Suggérer une imputation IA (Mode Saisie Rapide)' },
    ]
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <Command size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Raccourcis Clavier</h2>
                  <p className="text-xs font-bold text-slate-400">Gagnez du temps avec les actions rapides</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">
                {(Object.keys(shortcuts) as Array<keyof typeof shortcuts>).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === tab 
                        ? "bg-brand-green/10 text-brand-green" 
                        : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {tab === 'global' ? 'Général' : tab === 'journal' ? 'Journal / Saisie' : 'Mode Expert'}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {shortcuts[activeTab].map((sc, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800/80">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{sc.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sc.keys.map((k, j) => (
                        <kbd key={j} className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-500 dark:text-slate-400 shadow-sm min-w-[28px] text-center">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Utilisez ces raccourcis depuis n'importe où dans l'application
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
