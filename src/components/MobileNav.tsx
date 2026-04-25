import React, { useState } from 'react';
import { LayoutDashboard, BookOpen, Calculator, Menu, Wallet, ChevronDown, FileText, Target, Receipt, History, Users, Settings2, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface SubItem {
  id: string;
  path: string;
  label: string;
  icon: any;
}

interface NavSection {
  id: string;
  label: string;
  icon: any;
  items: SubItem[];
  path?: string;
}

interface MobileNavProps {
  onMenuClick: () => void;
}

export function MobileNav({ onMenuClick }: MobileNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const currentPath = location.pathname.replace(/^\//, '') || 'dashboard';

  const sections: NavSection[] = [
    { 
      id: 'dashboard', 
      path: '/', 
      label: 'Pilotage', 
      icon: LayoutDashboard,
      items: [
        { id: 'dashboard', path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
        { id: 'treasury', path: '/treasury', label: 'Trésorerie', icon: Wallet },
        { id: 'invoicing', path: '/invoicing', label: 'Facturation', icon: FileText },
        { id: 'budgets', path: '/budgets', label: 'Budgets', icon: Target },
      ]
    },
    { 
      id: 'accounting', 
      path: '/journal', 
      label: 'Compta', 
      icon: BookOpen,
      items: [
        { id: 'journal', path: '/journal', label: 'Journal', icon: BookOpen },
        { id: 'ledger', path: '/ledger', label: 'Grand Livre', icon: FileText },
        { id: 'trial-balance', path: '/trial-balance', label: 'Balance', icon: Calculator },
        { id: 'vat', path: '/vat', label: 'TVA', icon: Receipt },
      ]
    },
    { 
      id: 'management', 
      path: '/financials', 
      label: 'Gestion', 
      icon: Calculator,
      items: [
        { id: 'financials', path: '/financials', label: 'États Fin.', icon: Calculator },
        { id: 'third-parties', path: '/third-parties', label: 'Tiers', icon: Users },
        { id: 'assets', path: '/assets', label: 'Immos', icon: Settings2 },
        { id: 'compliance', path: '/compliance', label: 'Conformité', icon: ShieldCheck },
      ]
    },
    { 
      id: 'analysis', 
      path: '/financial-auditor', 
      label: 'Analyse', 
      icon: Sparkles,
      items: [
        { id: 'financial-auditor', path: '/financial-auditor', label: 'Audit IA', icon: Sparkles },
        { id: 'tax-assistant', path: '/tax-assistant', label: 'Fisc IA', icon: ShieldCheck },
        { id: 'audit', path: '/audit', label: 'Logs', icon: History },
      ]
    },
  ];

  const handleSectionClick = (section: NavSection) => {
    if (activeSection === section.id) {
      setActiveSection(null);
    } else {
      setActiveSection(section.id);
    }
  };

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[50]">
      {/* Expanded Sub-menu */}
      <AnimatePresence>
        {activeSection && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 right-0 mb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-2xl p-2"
          >
            <div className="p-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between px-6">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                {sections.find(s => s.id === activeSection)?.label}
              </span>
              <button 
                onClick={() => setActiveSection(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1">
              {sections.find(s => s.id === activeSection)?.items.map((subItem) => {
                const isSubActive = currentPath === subItem.id || (subItem.id === 'dashboard' && currentPath === '');
                return (
                  <button
                    key={subItem.id}
                    onClick={() => {
                      navigate(subItem.path);
                      setActiveSection(null);
                    }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl transition-all text-left",
                      isSubActive 
                        ? "bg-brand-green/10 text-brand-green" 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      isSubActive ? "bg-brand-green text-white" : "bg-slate-100 dark:bg-slate-800"
                    )}>
                      <subItem.icon size={16} />
                    </div>
                    <span className="text-xs font-bold truncate">{subItem.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-[2.5rem] p-2 shadow-[0_8px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-between">
        {sections.map((section) => {
          const isCurrentSectionActive = section.items.some(item => 
            currentPath === item.id || (item.id === 'dashboard' && currentPath === '')
          );
          const isExpanded = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-[2rem] transition-all relative flex-1 min-w-0 group",
                isExpanded || isCurrentSectionActive ? "text-brand-green dark:text-brand-green-light" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {(isExpanded || isCurrentSectionActive) && (
                <motion.div 
                  layoutId="mobile-dock-bg"
                  className="absolute inset-0 bg-brand-green/10 dark:bg-brand-green/20 rounded-[2rem] -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                isExpanded || isCurrentSectionActive ? "text-brand-green scale-110" : "bg-transparent"
              )}>
                <section.icon size={20} />
              </div>
              <span className={cn(
                "text-[7px] font-black uppercase tracking-widest text-center transition-all duration-300",
                isExpanded || isCurrentSectionActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 absolute"
              )}>
                {section.label}
              </span>
              
              {(isExpanded || isCurrentSectionActive) && (
                <motion.div 
                  layoutId="mobile-dock-dot"
                  className={cn(
                    "w-1 h-1 rounded-full mt-1",
                    isExpanded ? "bg-brand-green-light animate-pulse" : "bg-brand-green dark:bg-brand-green-light"
                  )}
                />
              )}
            </button>
          );
        })}
        
        <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/5 mx-1 shadow-inner" />

        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-1 p-2 rounded-[2rem] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex-1 min-w-0"
        >
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center">
            <Menu size={20} />
          </div>
          <span className="text-[7px] font-black uppercase tracking-widest text-center opacity-0 translate-y-1 absolute">Menu</span>
        </button>
      </div>
    </div>
  );
}
