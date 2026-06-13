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
  Landmark,
  FileText,
  ShieldCheck,
  Brain,
  Building2,
  Building,
  Search,
  HelpCircle,
  PlusCircle,
  Bell,
  ChevronRight,
  History,
  Users,
  Percent,
  Briefcase,
  Target,
  LogOut,
  Repeat,
  ChevronDown,
  Settings2,
  Banknote,
  Calendar,
  ShoppingBag,
  Smartphone,
  Folder,
  CheckSquare,
  BarChart3,
  ArrowUp,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useModules } from '@/context/ModuleContext';
import { useLocation, Link } from 'react-router-dom';

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  companyName?: string;
  logoUrl?: string | null;
  taxesEnabled?: boolean;
  user?: any;
}

export function Sidebar({ isMobileOpen, setIsMobileOpen, companyName, logoUrl, user, taxesEnabled = true }: SidebarProps) {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { isActive } = useModules();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [isHovered, setIsHovered] = React.useState(false);

  const isEffectivelyCollapsed = isCollapsed && !isHovered;


  const [searchQuery, setSearchQuery] = React.useState('');
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    'Pilotage': true,
    'Comptabilité': true
  });
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollRef.current) {
      setShowScrollTop(scrollRef.current.scrollTop > 100);
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentPath = location.pathname.replace(/^\//, '');

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebar_collapsed', String(newState));
      return newState;
    });
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  interface MenuItem {
    id: string;
    label: string;
    icon: any;
    module?: string;
    badge?: string | number;
    advanced?: boolean;
  }

  interface MenuGroup {
    label: string;
    items: MenuItem[];
  }

  const MENU_GROUPS: MenuGroup[] = [
    {
      label: t('group.pilotage') || 'Pilotage',
      items: [
        { id: '', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'inventory', label: 'Gestion des stocks', icon: Package },
        { id: 'treasury', label: t('nav.treasury'), icon: Wallet, module: 'treasury' },
        { id: 'mobile-money', label: 'Mobile Money', icon: Smartphone, advanced: true },
        { id: 'invoicing', label: t('nav.invoicing'), icon: FileText, badge: '3', module: 'invoicing' },
        { id: 'reconciliation', label: t('nav.reconciliation'), icon: Calculator, module: 'bankRec', advanced: true },
        { id: 'budgets', label: t('nav.budgets'), icon: Target, module: 'budget', advanced: true },
        { id: 'p2p', label: 'Procure-to-Pay', icon: ShoppingBag, module: 'p2p', advanced: true },
      ]
    },
    {
      label: t('group.accounting') || 'Comptabilité',
      items: [
        { id: 'journal', label: t('nav.journal'), icon: BookOpen, badge: 'Draft' },
        { id: 'recurring', label: t('nav.recurring'), icon: Repeat, advanced: true },
        { id: 'ledger', label: t('nav.ledger'), icon: FileText },
        { id: 'trial-balance', label: t('nav.trial_balance'), icon: Calculator },
        { id: 'opening-balances', label: 'Bilan d\'Ouverture', icon: Calculator, advanced: true },
      ]
    },
    {
      label: t('group.management') || 'États & Gestion',
      items: [
        { id: 'financials', label: t('nav.financials'), icon: FileText },
        { id: 'custom-reports', label: 'Rapports Personnalisés', icon: Settings2, advanced: true },
        { id: 'crm', label: 'CRM & Ventes', icon: Target, module: 'third_parties', advanced: true },
        { id: 'third-parties', label: t('nav.third_parties'), icon: Briefcase, module: 'third_parties' },
        { id: 'assets', label: t('nav.assets'), icon: Building2, module: 'assets', advanced: true },
        { id: 'vat', label: t('nav.vat'), icon: Percent, module: 'vat' },
        { id: 'tax-report', label: 'Rapport Fiscal', icon: FileText, module: 'vat', advanced: true },
        { id: 'company', label: t('nav.company') || 'Création Entreprise', icon: Building, advanced: true },
      ]
    },
    {
      label: t('group.payroll') || 'Paie & RH',
      items: [
        { id: 'payroll?view=employees', label: 'Gestion des Salariés', icon: Users, module: 'payroll' },
        { id: 'hr-dashboard', label: 'Tableau de bord RH', icon: BarChart3, module: 'payroll', advanced: true },
        { id: 'payroll?view=periods', label: 'Périodes de Paie', icon: Calendar, module: 'payroll' },
        { id: 'payroll?view=declarations', label: 'Bulletins & Déclarations', icon: FileText, module: 'payroll' },
      ]
    },
    {
      label: t('group.revision') || 'Révision',
      items: [
        { id: 'compliance', label: t('nav.compliance'), icon: ShieldCheck, advanced: true },
        { id: 'audit', label: 'Journal d\'Audit', icon: History, module: 'audit', advanced: true },
        { id: 'accounts', label: t('nav.accounts'), icon: Calculator, advanced: true },
      ]
    },
    {
      label: t('group.tools') || 'Outils',
      items: [
        { id: 'documents', label: 'Gestion Documentaire', icon: Folder, advanced: true },
        { id: 'messaging', label: 'Messagerie & Factures', icon: MessageSquareText, advanced: true },
        { id: 'tasks', label: 'Calendrier Général', icon: Calendar, advanced: true },
        { id: 'team', label: t('nav.team'), icon: Users, advanced: true },
        { id: 'settings', label: t('nav.settings'), icon: Settings },
      ]
    }
  ];

  const filteredGroups = MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (!item.module || isActive(item.module)) && 
      (taxesEnabled || (item.id !== "vat" && item.id !== "tax-report"))
    )
  })).filter(group => group.items.length > 0);


  
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ width: isEffectivelyCollapsed ? 84 : 296 }}
        className={cn(
          "fixed inset-y-0 left-0 z-[70] bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl text-slate-900 dark:text-slate-100 shadow-[2px_0_24px_-8px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_24px_-8px_rgba(0,0,0,0.6)] transform transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] md:translate-x-0 md:sticky md:top-0 md:h-screen flex flex-col border-r border-slate-200/60 dark:border-slate-800/60",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className={cn(
          "h-[84px] flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60 overflow-hidden shrink-0",
          isEffectivelyCollapsed ? "px-5" : "px-7"
        )}>
          <Link to="/" className="flex items-center gap-3.5 group shrink-0 relative">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(16,185,129,0.2)] group-hover:shadow-[0_12px_20px_-6px_rgba(16,185,129,0.3)] group-hover:-translate-y-0.5 transition-all duration-300 overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-green/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Logo className={logoUrl ? "w-10 h-10 text-brand-green relative z-10" : "w-6 h-6 text-brand-green relative z-10"} showText={false} src={logoUrl} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-brand-green rounded-full border-[2.5px] border-white dark:border-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
            {!isEffectivelyCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col"
              >
                <span className="font-extrabold text-[15px] tracking-tight block leading-none uppercase text-slate-900 dark:text-white">
                  Ory<span className="text-brand-green">Compta</span>
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] font-bold mt-1 max-w-[140px] truncate">Expert OHADA</span>
              </motion.div>
            )}
          </Link>
          {!isEffectivelyCollapsed && (
            <button onClick={() => setIsMobileOpen(false)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar relative">
          {filteredGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!isEffectivelyCollapsed && (
                <button 
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between text-[11px] uppercase text-slate-400 dark:text-slate-500 font-bold tracking-[0.15em] px-4 mb-2.5 group"
                >
                  <span className="group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{group.label}</span>
                  <ChevronDown size={14} className={cn("transition-transform duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300", !openGroups[group.label] && "-rotate-90")} />
                </button>
              )}
              
              <AnimatePresence initial={false}>
                {(isEffectivelyCollapsed || openGroups[group.label] || searchQuery) && (
                  <motion.nav 
                    initial={isEffectivelyCollapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="space-y-0.5 overflow-hidden"
                    role="navigation"
                    aria-label={group.label}
                  >
                    {group.items.map((item) => {
                      const isActive = currentPath === item.id;
                      return (
                        <Link
                          key={item.id}
                          to={`/${item.id}`}
                          onClick={() => {
                            if (window.innerWidth < 768) setIsMobileOpen(false);
                          }}
                          title={isEffectivelyCollapsed ? item.label : undefined}
                          className={cn(
                            "w-full flex items-center px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group relative overflow-hidden",
                            isEffectivelyCollapsed ? "justify-center" : "justify-between",
                            isActive 
                              ? "text-brand-green dark:text-emerald-400 shadow-sm" 
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                          )}
                        >
                          {/* Active Background */}
                          {isActive && (
                            <motion.div
                              layoutId="activeTabIndicator"
                              className="absolute inset-0 bg-brand-green/10 dark:bg-brand-green/20 z-0"
                              transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                          )}

                          {/* Hover effect background */}
                          <div className={cn(
                            "absolute inset-0 bg-slate-100 dark:bg-slate-800 opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-0",
                            isActive ? "hidden" : ""
                          )} />

                          {/* Active border indicator */}
                          {isActive && !isEffectivelyCollapsed && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-brand-green rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.8)] z-10" />
                          )}
                          {isActive && isEffectivelyCollapsed && (
                            <div className="absolute left-0 inset-y-0 w-[3px] bg-brand-green rounded-r-full shadow-[0_0_12px_rgba(16,185,129,0.8)] z-10" />
                          )}

                          <div className="flex items-center gap-3.5 relative z-10">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110",
                              isActive ? "text-brand-green" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                            )}>
                              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            {!isEffectivelyCollapsed && <span className="tracking-tight">{item.label}</span>}
                          </div>
                          
                          {!isEffectivelyCollapsed && item.badge && (
                            <span className={cn(
                              "relative z-10 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                              item.badge === 'Draft' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-brand-green/20 text-brand-green dark:text-brand-green-light"
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </motion.nav>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={scrollToTop}
              className="absolute bottom-[90px] right-4 w-10 h-10 bg-brand-green text-white rounded-full flex items-center justify-center shadow-lg hover:bg-brand-green-dark transition-colors z-50 text-sm"
              title="Retourner en haut"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 space-y-3 shrink-0 backdrop-blur-xl">
          {/* Help & Support */}
          {!isEffectivelyCollapsed && (
            <Link to="/assistant" className="flex items-center gap-3 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-brand-green dark:hover:text-brand-green transition-colors group">
              <HelpCircle size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="text-sm font-bold">Aide & Support</span>
            </Link>
          )}

          <div className={cn(
            "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700/80 hover:border-brand-green/30 dark:hover:border-brand-green/30 transition-all duration-300 cursor-pointer group shadow-sm hover:shadow-md",
            isEffectivelyCollapsed ? "flex justify-center p-2" : ""
          )}>
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-[15px] font-black border-[2px] border-transparent group-hover:border-brand-green transition-colors text-white dark:text-slate-900 shadow-md">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-brand-green rounded-full border-[2.5px] border-white dark:border-slate-950 shadow-sm flex items-center justify-center">
                   <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              {!isEffectivelyCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 min-w-0"
                >
                  <div className="text-[9px] text-brand-green font-black uppercase tracking-[0.2em] leading-none mb-1">
                    {user?.role === 'admin' ? t('role.admin') || 'Administrateur' : t('role.user') || 'Utilisateur'}
                  </div>
                  <div className="font-bold text-[13px] truncate text-slate-900 dark:text-white tracking-tight group-hover:text-brand-green transition-colors">
                    {user?.name || t('role.user') || 'Utilisateur'}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleCollapse}
              className="hidden md:flex items-center justify-center p-2.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <ChevronRight className={cn("transition-transform duration-300", isCollapsed ? "rotate-0" : "rotate-180")} size={18} />
            </button>
            
            <button 
              onClick={logout}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-500 dark:hover:bg-rose-500/10 rounded-xl transition-all text-xs font-bold uppercase tracking-widest",
                isEffectivelyCollapsed ? "px-0" : ""
              )}
              title={isEffectivelyCollapsed ? t('auth.logout') || 'Déconnexion' : undefined}
            >
              <LogOut size={16} strokeWidth={2.5} />
              {!isEffectivelyCollapsed && (t('auth.logout') || 'Déconnexion')}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
