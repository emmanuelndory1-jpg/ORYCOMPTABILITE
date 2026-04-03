import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Layout, Eye, EyeOff, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface DashboardCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetConfig[];
  onToggleWidget: (id: string) => void;
  onReset: () => void;
}

export function DashboardCustomizer({ isOpen, onClose, widgets, onToggleWidget, onReset }: DashboardCustomizerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col border-l border-slate-200 dark:border-slate-800"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Personnaliser</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tableau de Bord</p>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Visibilité des Widgets</h3>
                  <button 
                    onClick={onReset}
                    className="text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline"
                  >
                    Réinitialiser
                  </button>
                </div>
                
                <div className="space-y-3">
                  {widgets.map((widget) => (
                    <div 
                      key={widget.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                        widget.visible 
                          ? "bg-brand-green/5 border-brand-green/20" 
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-xl",
                          widget.visible ? "bg-brand-green/10 text-brand-green" : "bg-slate-200 dark:bg-slate-700 text-slate-400"
                        )}>
                          <Layout size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{widget.label}</span>
                      </div>
                      
                      <button 
                        onClick={() => onToggleWidget(widget.id)}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-90",
                          widget.visible 
                            ? "bg-brand-green text-white shadow-lg shadow-brand-green/20" 
                            : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                        )}
                      >
                        {widget.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-slate-900 dark:bg-slate-800 rounded-3xl text-white space-y-4 shadow-xl shadow-slate-900/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-green/20 rounded-lg">
                    <Check size={16} className="text-brand-green" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider">Enregistrement Auto</p>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-300 leading-relaxed">
                  Vos préférences sont automatiquement sauvegardées et seront appliquées lors de votre prochaine visite.
                </p>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={onClose}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-all active:scale-95"
              >
                Terminer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
