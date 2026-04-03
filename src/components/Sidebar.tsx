import React from 'react';
import { Logo } from './Logo';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calculator, 
  MessageSquareText, 
  Settings, 
  X,
  Wallet,
  FileText,
  ShieldCheck,
  Building2,
  Building,
  ChevronRight,
  Users,
  Percent,
  Briefcase,
  Target,
  LogOut,
  Repeat,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation, Link } from 'react-router-dom';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  companyName?: string;
  user?: any;
}

export function Sidebar({ isMobileOpen, setIsMobileOpen, companyName, user }: SidebarProps) {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  const currentPath = location.pathname.replace(/^\//, '');

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebar_collapsed', String(newState));
      return newState;
    });
  };

  const MENU_GROUPS = [
    {
      label: t('group.pilotage') || 'Pilotage',
      items: [
        { id: '', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'treasury', label: t('nav.treasury'), icon: Wallet },
        { id: 'invoicing', label: t('nav.invoicing'), icon: FileText },
        { id: 'reconciliation', label: t('nav.reconciliation'), icon: Calculator },
        { id: 'budgets', label: t('nav.budgets'), icon: Target },
      ]
    },
    {
      label: t('group.accounting') || 'Comptabilité',
      items: [
        { id: 'journal', label: t('nav.journal'), icon: BookOpen },
        { id: 'recurring', label: t('nav.recurring'), icon: Repeat },
        { id: 'ledger', label: t('nav.ledger'), icon: FileText },
        { id: 'trial-balance', label: t('nav.trial_balance'), icon: Calculator },
      ]
    },
    {
      label: t('group.management') || 'États & Gestion',
      items: [
        { id: 'financials', label: t('nav.financials'), icon: FileText },
        { id: 'third-parties', label: t('nav.third_parties'), icon: Briefcase },
        { id: 'assets', label: t('nav.assets'), icon: Building2 },
        { id: 'vat', label: t('nav.vat'), icon: Percent },
        { id: 'payroll', label: t('nav.payroll'), icon: Users },
        { id: 'company', label: t('nav.company') || 'Création Entreprise', icon: Building },
      ]
    },
    {
      label: t('group.revision') || 'Révision',
      items: [
        { id: 'compliance', label: t('nav.compliance'), icon: ShieldCheck },
        { id: 'financial-auditor', label: t('nav.financial_auditor') || 'Audit Financier IA', icon: Sparkles },
        { id: 'accounts', label: t('nav.accounts'), icon: Calculator },
      ]
    },
    {
      label: t('group.tools') || 'Outils',
      items: [
        { id: 'team', label: t('nav.team'), icon: Users },
        { id: 'assistant', label: t('nav.assistant'), icon: MessageSquareText },
        { id: 'tax-assistant', label: t('nav.tax_assistant') || 'Audit Fiscal Expert', icon: ShieldCheck },
        { id: 'settings', label: t('nav.settings'), icon: Settings },
      ]
    }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        animate={{ width: isCollapsed ? 80 : 288 }}
        className={cn(
          "fixed inset-y-0 left-0 z-[70] bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl transform transition-all duration-300 ease-in-out md:translate-x-0 md:static md:h-screen flex flex-col border-r border-slate-200 dark:border-white/5",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5 overflow-hidden",
          isCollapsed ? "px-4" : "px-6"
        )}>
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg shadow-brand-green/10 group-hover:scale-105 transition-transform duration-200 overflow-hidden border border-slate-100 dark:border-white/10">
                <Logo className="w-6 h-6 text-brand-green" showText={false} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-green-light rounded-full border-2 border-white dark:border-slate-950 shadow-sm" />
            </div>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col"
              >
                <span className="font-black text-lg tracking-tight block leading-none transition-colors uppercase text-slate-900 dark:text-white">
                  Ory<span className="text-brand-green">Compta</span>
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">Expert OHADA</span>
              </motion.div>
            )}
          </Link>
          {!isCollapsed && (
            <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {MENU_GROUPS.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-black tracking-[0.15em] px-3 mb-2"
                >
                  {group.label}
                </motion.div>
              )}
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = currentPath === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={`/${item.id}`}
                      onClick={() => {
                        setIsMobileOpen(false);
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center px-3 py-2 rounded-xl text-sm font-bold transition-all duration-200 group relative overflow-hidden",
                        isCollapsed ? "justify-center" : "justify-between",
                        isActive 
                          ? "bg-brand-green/5 dark:bg-brand-green/10 text-brand-green dark:text-brand-green-light shadow-sm border border-brand-green/10 dark:border-brand-green/20" 
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 relative z-10">
                        <item.icon 
                          size={18} 
                          className={cn(
                            "transition-colors duration-200 shrink-0",
                            isActive ? "text-brand-green dark:text-brand-green-light" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                          )} 
                        />
                        {!isCollapsed && <span className="tracking-tight">{item.label}</span>}
                      </div>
                      
                      {isActive && !isCollapsed && (
                        <motion.div
                          layoutId="activeTabIndicator"
                          className="absolute inset-0 bg-brand-green/5 rounded-xl z-0"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      
                      {isActive && !isCollapsed && <ChevronRight size={12} className="text-brand-green/50" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
          <div className={cn(
            "bg-white dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/10 hover:border-slate-200 dark:hover:border-white/20 transition-colors cursor-pointer group shadow-sm",
            isCollapsed ? "flex justify-center" : ""
          )}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-green to-brand-green-light flex items-center justify-center text-xs font-black ring-2 ring-white dark:ring-slate-950 group-hover:ring-slate-100 dark:group-hover:ring-slate-800 transition-all text-white shadow-lg shadow-brand-green/20 shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 min-w-0"
                >
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest leading-none mb-1">
                    {user?.role === 'admin' ? t('role.admin') || 'Administrateur' : t('role.user') || 'Utilisateur'}
                  </div>
                  <div className="font-bold text-sm truncate text-slate-900 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white tracking-tight">
                    {user?.name || t('role.user') || 'Utilisateur'}
                  </div>
                </motion.div>
              )}
              {!isCollapsed && <div className="w-2 h-2 bg-brand-green-light rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleCollapse}
              className="hidden md:flex items-center justify-center p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <ChevronRight className={cn("transition-transform duration-300", isCollapsed ? "rotate-0" : "rotate-180")} size={18} />
            </button>
            
            <button 
              onClick={logout}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all text-xs font-black uppercase tracking-widest",
                isCollapsed ? "px-0" : ""
              )}
              title={isCollapsed ? t('auth.logout') || 'Déconnexion' : undefined}
            >
              <LogOut size={14} />
              {!isCollapsed && (t('auth.logout') || 'Déconnexion')}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
