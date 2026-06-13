import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileDown, Settings, LayoutTemplate, AlignLeft, AlignRight, AlignCenter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from '@/components/DialogProvider';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: any) => void;
  initialTemplate?: string;
}

export function PdfExportModal({ isOpen, onClose, onExport, initialTemplate = 'prestige' }: PdfExportModalProps) {
  const [template, setTemplate] = useState(initialTemplate);
  const [clientPosition, setClientPosition] = useState('right');
  const [logoPosition, setLogoPosition] = useState('left');
  const [signaturePosition, setSignaturePosition] = useState('right');

  const handleExport = () => {
    onExport({
      template,
      clientPosition,
      logoPosition,
      signaturePosition
    });
    onClose();
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
            className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Options d'exportation</h2>
                  <p className="text-xs font-bold text-slate-400">Personnalisez l'apparence du PDF</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modèle de facture</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'prestige', label: 'Prestige' },
                    { id: 'classic', label: 'Classique' },
                    { id: 'minimal', label: 'Minimaliste' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                        template === t.id
                          ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <LayoutTemplate size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emplacement du destinataire</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setClientPosition('left')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      clientPosition === 'left'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignLeft size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">À Gauche</span>
                  </button>
                  <button
                    onClick={() => setClientPosition('right')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      clientPosition === 'right'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignRight size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">À Droite</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emplacement du Logo / Émetteur</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLogoPosition('left')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      logoPosition === 'left'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignLeft size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gauche</span>
                  </button>
                  <button
                    onClick={() => setLogoPosition('center')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      logoPosition === 'center'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignCenter size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Centre</span>
                  </button>
                  <button
                    onClick={() => setLogoPosition('right')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      logoPosition === 'right'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignRight size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Droite</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emplacement de la Signature</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSignaturePosition('left')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      signaturePosition === 'left'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignLeft size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">À Gauche</span>
                  </button>
                  <button
                    onClick={() => setSignaturePosition('right')}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-2",
                      signaturePosition === 'right'
                        ? "border-brand-green bg-brand-green/5 text-brand-green shadow-sm"
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/50 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <AlignRight size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">À Droite</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2.5 bg-brand-green text-white rounded-xl font-bold shadow-md hover:shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95"
              >
                <FileDown size={18} />
                Exporter
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
