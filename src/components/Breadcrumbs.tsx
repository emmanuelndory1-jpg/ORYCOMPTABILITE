import React from 'react';
import { ChevronRight, Home, LayoutDashboard, Calculator, FileText, ShieldCheck, Package, BookOpen, PieChart, Landmark, Settings, Users, Receipt, Wallet, Briefcase, FileSearch, Scale, UserCircle, Target, FileBarChart } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ROUTE_CONFIG: Record<string, { label: string; group: string; icon: React.ReactNode }> = {
  dashboard: { label: 'Tableau de Bord', group: 'Pilotage', icon: <LayoutDashboard size={14} /> },
  journal: { label: 'Journal & Saisie', group: 'Comptabilité', icon: <Calculator size={14} /> },
  ledger: { label: 'Grand Livre', group: 'Comptabilité', icon: <BookOpen size={14} /> },
  'trial-balance': { label: 'Balance Générale', group: 'Comptabilité', icon: <Scale size={14} /> },
  financials: { label: 'États Financiers', group: 'États & Gestion', icon: <FileBarChart size={14} /> },
  treasury: { label: 'Trésorerie', group: 'Pilotage', icon: <Landmark size={14} /> },
  reconciliation: { label: 'Rapprochement', group: 'Pilotage', icon: <Receipt size={14} /> },
  assets: { label: 'Immobilisations', group: 'États & Gestion', icon: <Package size={14} /> },
  vat: { label: 'Gestion TVA', group: 'États & Gestion', icon: <Receipt size={14} /> },
  payroll: { label: 'Gestion Paie', group: 'États & Gestion', icon: <Users size={14} /> },
  'third-parties': { label: 'Tiers', group: 'États & Gestion', icon: <UserCircle size={14} /> },
  budgets: { label: 'Budgets', group: 'Pilotage', icon: <Target size={14} /> },
  invoicing: { label: 'Facturation', group: 'États & Gestion', icon: <Receipt size={14} /> },
  compliance: { label: 'Conformité', group: 'Révision', icon: <ShieldCheck size={14} /> },
  accounts: { label: 'Plan Comptable', group: 'Révision', icon: <FileText size={14} /> },
  assistant: { label: 'Assistant IA', group: 'Outils', icon: <Briefcase size={14} /> },
  'tax-assistant': { label: 'Assistant Fiscal', group: 'Outils', icon: <FileSearch size={14} /> },
  'financial-auditor': { label: 'Auditeur Financier', group: 'Outils', icon: <ShieldCheck size={14} /> },
  team: { label: 'Équipe', group: 'Outils', icon: <Users size={14} /> },
  settings: { label: 'Paramètres', group: 'Outils', icon: <Settings size={14} /> },
  recurring: { label: 'Récurrences', group: 'Comptabilité', icon: <Receipt size={14} /> },
  company: { label: 'Entreprise', group: 'États & Gestion', icon: <Briefcase size={14} /> },
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  
  // If we are at root, it's dashboard
  const currentPath = pathnames[0] || 'dashboard';
  const config = ROUTE_CONFIG[currentPath];

  return (
    <nav className="flex items-center space-x-2 text-xs font-medium mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <Link 
        to="/"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-brand-green hover:border-brand-green/30 transition-all shadow-sm group"
      >
        <Home size={14} className="group-hover:scale-110 transition-transform" />
        <span className="hidden sm:inline">Accueil</span>
      </Link>
      
      <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />

      {currentPath === 'dashboard' ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-green/5 border border-brand-green/20 text-brand-green shadow-sm">
          <LayoutDashboard size={14} />
          <span className="font-bold uppercase tracking-widest text-[10px]">Vue d'ensemble</span>
        </div>
      ) : (
        <>
          {config && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="font-bold uppercase tracking-widest text-[10px]">{config.group}</span>
            </div>
          )}
          
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-green/5 border border-brand-green/20 text-brand-green shadow-sm animate-in zoom-in-95 duration-300">
            {config?.icon}
            <span className="font-bold uppercase tracking-widest text-[10px]">
              {config?.label || currentPath}
            </span>
          </div>
        </>
      )}

      {/* Handle potential sub-paths if they existed (e.g. /journal/entry/123) */}
      {pathnames.length > 1 && pathnames.slice(1).map((name, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm animate-in slide-in-from-left-2 duration-300">
            <span className="font-bold uppercase tracking-widest text-[10px]">{name}</span>
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
}
