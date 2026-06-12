import React, { useState, useRef } from 'react';
import { LayoutDashboard, BookOpen, Calculator, Menu, Wallet, ChevronDown, FileText, Target, Receipt, History, Users, Settings2, Sparkles, ShieldCheck, ShoppingBag, Briefcase, Plus, Camera, Search, X, Folder, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useModules } from '@/context/ModuleContext';
import { useDialog } from './DialogProvider';

interface SubItem {
  id: string;
  path: string;
  label: string;
  icon: any;
  module?: string;
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
  const { isActive } = useModules();
  const { alert } = useDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const currentPath = location.pathname.replace(/^\//, '') || 'dashboard';

  const allSections: NavSection[] = [
    { 
      id: 'dashboard', 
      path: '/', 
      label: 'Pilotage', 
      icon: LayoutDashboard,
      items: [
        { id: 'dashboard', path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
        { id: 'treasury', path: '/treasury', label: 'Trésorerie', icon: Wallet, module: 'treasury' },
        { id: 'invoicing', path: '/invoicing', label: 'Ventes', icon: FileText, module: 'invoicing' },
        { id: 'procure-to-pay', path: '/procure-to-pay', label: 'Achats', icon: ShoppingBag, module: 'p2p' },
        { id: 'budgets', path: '/budgets', label: 'Budgets', icon: Target, module: 'budget' },
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
        { id: 'payroll', path: '/payroll', label: 'Paie', icon: Briefcase, module: 'payroll' },
        { id: 'hr-dashboard', path: '/hr-dashboard', label: 'RH', icon: Briefcase, module: 'payroll' },
        { id: 'vat', path: '/vat', label: 'TVA', icon: Receipt, module: 'vat' },
      ]
    },
    { 
      id: 'management', 
      path: '/financials', 
      label: 'Gestion', 
      icon: Calculator,
      items: [
        { id: 'financials', path: '/financials', label: 'États Fin.', icon: Calculator },
        { id: 'third-parties', path: '/third-parties', label: 'Tiers', icon: Users, module: 'third_parties' },
        { id: 'assets', path: '/assets', label: 'Immos', icon: Settings2, module: 'assets' },
        { id: 'compliance', path: '/compliance', label: 'Conformité', icon: ShieldCheck },
      ]
    },
    { 
      id: 'analysis', 
      path: '/financial-auditor', 
      label: 'Outils', 
      icon: Sparkles,
      items: [
        { id: 'documents', path: '/documents', label: 'Documents', icon: Folder },
        { id: 'messaging', path: '/messaging', label: 'Messages', icon: FileText },
        { id: 'tasks', path: '/tasks', label: 'Tâches', icon: CheckSquare },
        { id: 'audit', path: '/audit', label: 'Logs', icon: History, module: 'audit' },
        { id: 'settings', path: '/settings', label: 'Paramètres', icon: Settings2 },
      ]
    },
  ];

  const sections = allSections.map(section => ({
    ...section,
    items: section.items.filter(item => !item.module || isActive(item.module))
  })).filter(section => section.items.length > 0);

  const handleSectionClick = (section: NavSection) => {
    setIsQuickActionOpen(false);
    if (activeSection === section.id) {
      setActiveSection(null);
    } else {
      setActiveSection(section.id);
    }
  };

  const handleScan = () => {
    fileInputRef.current?.click();
    setIsQuickActionOpen(false);
  };

  const handleNewEntry = () => {
    navigate('/journal');
    setIsQuickActionOpen(false);
  };

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[50]">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            alert("Scan en cours... (Redirection vers Achats)", "info");
            navigate('/procure-to-pay');
          }
        }}
      />

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
                        ? "bg-brand-green/10 dark:bg-brand-green/20 text-brand-green dark:text-emerald-400" 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      isSubActive ? "bg-brand-green text-white dark:bg-emerald-500 dark:text-slate-950" : "bg-slate-100 dark:bg-slate-800"
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

      {/* Quick Action Menu */}
      <AnimatePresence>
        {isQuickActionOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-48 bg-slate-900 border border-slate-800 rounded-[2rem] p-2 shadow-2xl shadow-brand-green/20"
          >
            <div className="space-y-1">
              <button 
                onClick={handleScan}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/10 text-white rounded-2xl transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera size={20} />
                </div>
                <span className="text-xs font-bold">Scanner</span>
              </button>
              <button 
                onClick={handleNewEntry}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/10 text-white rounded-2xl transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold">Écriture</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dock Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/50 dark:border-white/10 rounded-[2.5rem] p-2 shadow-[0_8px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_-10px_rgba(0,0,0,0.5)] flex items-center justify-between">
        {/* First 2 sections */}
        {sections.slice(0, 2).map((section) => {
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
                isExpanded || isCurrentSectionActive ? "text-brand-green dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {(isExpanded || isCurrentSectionActive) && (
                <motion.div 
                  layoutId="mobile-dock-bg"
                  className="absolute inset-0 bg-brand-green/10 dark:bg-brand-green/30 rounded-[2rem] -z-10"
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
                "text-[7px] font-black uppercase tracking-widest text-center transition-all duration-300 truncate",
                isExpanded || isCurrentSectionActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 absolute"
              )}>
                {section.id === 'dashboard' ? 'Pilot' : section.label}
              </span>
            </button>
          );
        })}

        {/* Central Plus Button */}
        <div className="relative -mt-10 px-2">
          <button
            onClick={() => {
              setIsQuickActionOpen(!isQuickActionOpen);
              setActiveSection(null);
            }}
            className={cn(
              "w-14 h-14 rounded-full bg-brand-green text-white shadow-xl shadow-brand-green/30 flex items-center justify-center transition-all active:scale-95 duration-500",
              isQuickActionOpen ? "rotate-45 bg-slate-900" : "rotate-0"
            )}
          >
            <Plus size={28} />
          </button>
        </div>

        {/* Last 2 sections */}
        {sections.slice(2, 4).map((section) => {
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
                isExpanded || isCurrentSectionActive ? "text-brand-green dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {(isExpanded || isCurrentSectionActive) && (
                <motion.div 
                  layoutId="mobile-dock-bg"
                  className="absolute inset-0 bg-brand-green/10 dark:bg-brand-green/30 rounded-[2rem] -z-10"
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
                "text-[7px] font-black uppercase tracking-widest text-center transition-all duration-300 truncate",
                isExpanded || isCurrentSectionActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 absolute"
              )}>
                {section.label}
              </span>
            </button>
          );
        })}
        
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
