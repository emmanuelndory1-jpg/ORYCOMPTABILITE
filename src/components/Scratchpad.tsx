import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, X, Minimize2, Maximize2, Trash2, CheckCircle2, Save } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { cn } from '@/lib/utils';

export function Scratchpad() {
  const dragControls = useDragControls();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [note, setNote] = useState('');
  const [savedMessage, setSavedMessage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('erp_scratchpad_note');
    if (saved) {
      setNote(saved);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('erp_scratchpad_note', note);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  // Save to local storage automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      if (note !== localStorage.getItem('erp_scratchpad_note')) {
        handleSave();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (isOpen && !isMinimized && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => { setIsOpen(true); setIsMinimized(false); }}
            className="fixed bottom-6 left-6 z-40 p-3.5 bg-amber-200 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full shadow-lg border border-amber-300 dark:border-amber-500/30 hover:scale-105 transition-transform"
            title="Ouvrir le bloc-notes rapide"
          >
            <StickyNote size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Widget */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className={cn(
              "fixed left-6 z-50 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300",
              isMinimized ? "bottom-6 w-64 h-14" : "bottom-6 w-80 h-96"
            )}
          >
            {/* Header */}
            <div 
              className="bg-amber-100 dark:bg-amber-900/30 px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-amber-200 dark:border-amber-900/50 select-none"
              onPointerDown={(e) => dragControls.start(e)}
              onDoubleClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-2 font-black text-amber-900 dark:text-amber-500">
                <StickyNote size={16} />
                <span className="text-sm">Bloc-notes rapide</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                  className="p-1 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-400 transition-colors"
                >
                  {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  className="p-1 rounded-md hover:bg-amber-200 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-amber-700 dark:text-amber-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <div className="flex-1 relative flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tapez vos notes rapides ici... (Sauvegardé automatiquement)"
                  className="flex-1 w-full bg-transparent resize-none p-4 outline-none text-slate-700 dark:text-slate-300 text-sm leading-relaxed custom-scrollbar placeholder:text-amber-900/30 dark:placeholder:text-amber-100/20"
                />
                
                {/* Footer Tools */}
                <div className="px-4 py-3 bg-amber-100/50 dark:bg-slate-900/50 flex items-center justify-between border-t border-amber-200/50 dark:border-amber-900/30">
                  <AnimatePresence>
                    {savedMessage && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider"
                      >
                        <CheckCircle2 size={12} />
                        Enregistré
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={handleSave}
                      className={cn(
                        "p-1.5 rounded-lg text-amber-600 hover:bg-amber-200 hover:text-amber-700 dark:text-amber-500/50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 transition-colors",
                      )}
                      title="Enregistrer manuellement"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Voulez-vous vraiment effacer toutes vos notes ?')) {
                          setNote('');
                        }
                      }}
                      className={cn(
                        "p-1.5 rounded-lg text-amber-600 hover:bg-rose-100 hover:text-rose-600 dark:text-amber-500/50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors",
                        note.length === 0 && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={note.length === 0}
                      title="Effacer les notes"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
