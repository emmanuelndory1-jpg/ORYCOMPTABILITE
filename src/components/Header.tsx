import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, HelpCircle, User, LogOut, X, Loader2, ChevronRight, BookOpen, Users, Building2, Calculator, Moon, Sun, FileText, Wallet, ShieldCheck, Menu, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { apiFetch as fetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useFiscalYear, FiscalYear } from '@/context/FiscalYearContext';
import { useSync } from '@/context/SyncContext';
import { Calendar, User as UserIcon, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Logo } from './Logo';
import { Dropdown } from './ui/Dropdown';

interface SearchResult {
  id: string;
  type: 'account' | 'transaction' | 'third_party' | 'asset' | 'invoice';
  title: string;
  subtitle: string;
  link: string;
  icon: any;
}

interface Notification {
  id: number;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function Header({ logoUrl, onMenuClick }: { logoUrl?: string | null, onMenuClick?: () => void }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread' | 'alerts'>('all');
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { activeYear, refreshActiveYear } = useFiscalYear();
  const { isSyncing, pendingCount } = useSync();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const yearSelectorRef = useRef<HTMLDivElement>(null);
  const themeSelectorRef = useRef<HTMLDivElement>(null);

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('default');

  useEffect(() => {
    const loadWorkspaces = () => {
      const saved = localStorage.getItem('erp_workspaces');
      setWorkspaces(saved ? JSON.parse(saved) : [{ id: 'default', name: 'Mon Entreprise Principale' }]);
      setActiveWorkspaceId(localStorage.getItem('erp_active_workspace') || 'default');
    };
    loadWorkspaces();
    window.addEventListener('storage', loadWorkspaces);
    window.addEventListener('workspaces_updated', loadWorkspaces);
    return () => {
      window.removeEventListener('storage', loadWorkspaces);
      window.removeEventListener('workspaces_updated', loadWorkspaces);
    };
  }, []);

  const handleActivateWorkspace = (id: string) => {
    localStorage.setItem('erp_active_workspace', id);
    window.dispatchEvent(new Event('workspaces_updated'));
    window.location.reload();
  };

  const isDarkMode = resolvedTheme === 'dark';

  const fetchFiscalYears = async () => {
    try {
      const res = await apiFetch('/api/fiscal-years');
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setFiscalYears(data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiscalYears();
    }
  }, [user]);

  const handleActivateYear = async (id: number) => {
    try {
      const res = await apiFetch(`/api/fiscal-years/${id}/activate`, { method: 'PUT' });
      if (res.ok) {
        await refreshActiveYear();
        setShowYearSelector(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        // We use setTimeout to ensure the input is rendered before focusing
        setTimeout(() => {
          const searchInput = document.getElementById('global-search-input');
          if (searchInput) searchInput.focus();
        }, 100);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (yearSelectorRef.current && !yearSelectorRef.current.contains(event.target as Node)) {
        setShowYearSelector(false);
      }
      if (themeSelectorRef.current && !themeSelectorRef.current.contains(event.target as Node)) {
        setShowThemeSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error('Search failed');
        
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn('Search received non-JSON response');
          return;
        }

        const data = await response.json();
        
        const formattedResults = data.map((item: any) => {
          let icon = Search;
          let link = '/';
          
          switch (item.type) {
            case 'account':
              icon = Calculator;
              link = '/accounts';
              break;
            case 'transaction':
              icon = BookOpen;
              link = '/journal';
              break;
            case 'third_party':
              icon = Users;
              link = '/third-parties';
              break;
            case 'asset':
              icon = Building2;
              link = '/assets';
              break;
            case 'invoice':
              icon = FileText;
              link = '/invoicing';
              break;
          }
          
          return { ...item, icon, link };
        });
        
        setSearchResults(formattedResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchNotifications = async () => {
    if (!user || document.visibilityState === 'hidden') return;
    try {
      const response = await apiFetch('/api/notifications');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return; // Auth context will handle this
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn('Received non-JSON response for notifications:', contentType);
        return;
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (error: any) {
      // Only log if it's not a standard "Failed to fetch" or "timed out" which happens during server restarts
      if (error.message !== 'Failed to fetch' && error.message !== 'Request timed out' && error.name !== 'AbortError') {
        console.warn('Silent failure fetching notifications:', error.message);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  const markAsRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cette notification ? Cette action est irréversible.")) return;
    try {
      await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleResultClick = (link: string) => {
    navigate(link);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const THEMES = [
    { id: 'light', label: 'Clair', icon: Sun },
    { id: 'dark', label: 'Sombre', icon: Moon },
    { id: 'system', label: 'Système', icon: Settings },
  ] as const;

  return (
    <header role="banner" className="h-16 md:h-[84px] sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/60 flex items-center px-4 md:px-10 transition-all duration-300 shadow-sm md:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)]">
      {/* Mobile Menu & Brand */}
      <div className="flex md:hidden items-center gap-3 w-1/4">
        {onMenuClick && (
          <button 
            onClick={onMenuClick} 
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={2.5} />
          </button>
        )}
        <Logo className="w-5 h-5 text-brand-green" showText={false} src={logoUrl} />
      </div>

      {/* Left: Brand & Status (Desktop) */}
      <div className="hidden lg:flex xl:w-72 items-center gap-5">
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-[0_8px_16px_-6px_rgba(16,185,129,0.2)] group-hover:shadow-[0_12px_20px_-6px_rgba(16,185,129,0.3)] group-hover:-translate-y-0.5 transition-all duration-300 border border-slate-100 dark:border-slate-800 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-green/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Logo className={logoUrl ? "w-10 h-10 text-brand-green relative z-10" : "w-6 h-6 text-brand-green relative z-10"} showText={false} src={logoUrl} />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white uppercase">ORYCOMPTA</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="text-[9px] font-black text-brand-green uppercase tracking-[0.15em]">Connecté</span>
              </div>
              
              {/* Sync Status Indicator */}
              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 group/sync cursor-help" title={isSyncing ? `${pendingCount} transaction(s) en attente de validation serveur` : "Toutes les données sont synchronisées avec le serveur (à jour)"}>
                {isSyncing ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-green/10 border border-brand-green/20">
                    <RefreshCw size={10} className="animate-spin text-brand-green" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-brand-green">
                      {pendingCount} attente
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Cloud size={10} className="text-slate-400" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">À jour</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-2xl relative mx-auto px-2 md:px-0" ref={searchRef}>
        <div className={cn(
          "relative group transition-all duration-500",
          isSearchOpen ? "w-full scale-[1.02]" : "w-10 md:w-full md:max-w-md mx-auto"
        )}>
          <Search 
            className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-green transition-colors duration-300 cursor-pointer md:cursor-text z-10" 
            size={18} 
            strokeWidth={2.5}
            onClick={() => setIsSearchOpen(true)}
          />
          <input
            id="global-search-input"
            type="text"
            placeholder={t('search.placeholder') || "Transactions, clients, comptes..."}
            className={cn(
              "w-full bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:border-brand-green/40 focus:ring-4 focus:ring-brand-green/10 rounded-2xl py-3 pl-10 md:pl-12 pr-14 text-sm transition-all duration-300 outline-none text-slate-900 dark:text-white dark:placeholder-slate-500 font-semibold shadow-inner",
              !isSearchOpen && "hidden md:block"
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          {!isSearchOpen && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 pointer-events-none">
              <div className="flex items-center justify-center px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm">
                 <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">⌘K</span>
              </div>
            </div>
          )}
          <AnimatePresence>
            {isSearchOpen && (searchQuery.length > 0 || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute top-full left-0 right-0 mt-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-800/60 overflow-hidden max-h-[480px] flex flex-col z-50 origin-top"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">{t('search.results') || 'Résultats de recherche'}</span>
                  {isSearching && <Loader2 className="animate-spin text-brand-green" size={16} />}
                </div>
                
                <div className="overflow-y-auto flex-1 p-3 space-y-1 custom-scrollbar">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result.link)}
                        className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-left group border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm group-hover:bg-brand-green group-hover:text-white group-hover:border-brand-green group-hover:shadow-md transition-all duration-300">
                           <result.icon size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[15px] text-slate-900 dark:text-white truncate group-hover:text-brand-green transition-colors">{result.title}</div>
                          <div className="text-[13px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{result.subtitle}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                           <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-all transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))
                  ) : !isSearching && searchQuery.length >= 2 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/80 rounded-full flex items-center justify-center mb-5 shadow-inner">
                        <Search size={32} className="text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-[15px] text-slate-500 dark:text-slate-400">
                        {t('search.no_results') || 'Aucun résultat trouvé pour'} <br/>
                        <span className="text-slate-900 dark:text-white font-bold inline-block mt-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">"{searchQuery}"</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Actions */}
      <nav role="navigation" aria-label="Menu principal" className="flex-1 flex items-center justify-end gap-3 md:gap-5">
        {/* Workspace Selector */}
        <div className="hidden lg:block relative z-50">
          <Dropdown
            trigger={
              <button className="flex items-center gap-2.5 px-4 py-2.5 bg-brand-green/10 dark:bg-brand-green/5 text-brand-green border border-brand-green/20 dark:border-brand-green/10 rounded-xl text-[13px] font-bold hover:bg-brand-green hover:text-white transition-all group shadow-sm">
                <Building2 size={16} className="group-hover:scale-110 transition-transform" />
                <span className="max-w-[120px] truncate">{workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Entreprise'}</span>
              </button>
            }
            width="w-64"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Changer d'Entité</span>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 p-2 custom-scrollbar">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => { if(ws.id !== activeWorkspaceId) handleActivateWorkspace(ws.id) }}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all group border border-transparent",
                    ws.id === activeWorkspaceId ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700"
                  )}
                >
                  <span className="text-sm font-bold truncate pr-3">{ws.name}</span>
                  {ws.id === activeWorkspaceId && (
                     <div className="w-2.5 h-2.5 shrink-0 rounded-full bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </Dropdown>
        </div>

        {/* Fiscal Year Selector */}
        <div className="hidden lg:block relative z-50">
          <Dropdown
            trigger={
              <button className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[13px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:shadow-md transition-all border border-slate-200 dark:border-slate-700 group">
                <Calendar size={16} className="text-brand-green group-hover:scale-110 transition-transform" />
                <span>{activeYear?.name || 'Exercice'}</span>
              </button>
            }
            width="w-64"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Changer d'exercice</span>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 p-2 custom-scrollbar">
              {fiscalYears.map((year) => (
                <button
                  key={year.id}
                  onClick={() => handleActivateYear(year.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all group border border-transparent",
                    year.is_active ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{year.name}</span>
                    <span className={cn("text-[11px] mt-0.5 font-medium", year.is_active ? "text-brand-green/70" : "text-slate-500")}>{year.start_date} - {year.end_date}</span>
                  </div>
                  {year.is_active === 1 && (
                     <div className="w-2.5 h-2.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800 p-2 bg-slate-50/30 dark:bg-slate-800/30">
              <button 
                onClick={() => navigate('/settings')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-brand-green transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm hover:shadow-md"
              >
                <Settings size={14} />
                Gérer les exercices
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="flex items-center gap-2 md:gap-3 mr-1 md:mr-2">
          <div className="relative z-50">
            <Dropdown
              trigger={
                <button className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all duration-300 active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group">
                  <div className="relative w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                </button>
              }
              width="w-48"
              align="center"
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Choix du Thème</span>
              </div>
              <div className="space-y-1 p-2">
                {THEMES.map((t_item) => (
                  <button
                    key={t_item.id}
                    onClick={() => setTheme(t_item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border border-transparent",
                      theme === t_item.id ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-700"
                    )}
                  >
                    <t_item.icon size={16} strokeWidth={2.5} />
                    <span className="text-sm font-bold">{t_item.label}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 relative group">
              <HelpCircle size={20} className="group-hover:scale-110 transition-transform" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none z-50 shadow-xl border border-slate-800 dark:border-slate-200">
                {t('common.help') || 'Aide'}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900 dark:border-b-slate-100" />
              </div>
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 relative group"
            >
              <Settings size={20} className="group-hover:scale-110 group-hover:rotate-45 transition-transform duration-500" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none z-50 shadow-xl border border-slate-800 dark:border-slate-200">
                {t('nav.settings') || 'Paramètres'}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900 dark:border-b-slate-100" />
              </div>
            </button>
          </div>
        </div>

        <div className="relative z-50">
          <Dropdown
            trigger={
              <button className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all duration-300 relative border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group">
                <Bell size={20} className="group-hover:scale-110 transition-transform origin-top" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4.5 h-4.5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            }
            width="w-80"
            closeOnContentClick={false}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[15px] text-slate-900 dark:text-white leading-none">{t('notifications.title') || 'Notifications'}</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[11px] text-brand-green font-bold hover:text-brand-green-light transition-colors uppercase tracking-wider"
                  >
                    {t('notifications.mark_read') || 'Tout Lu'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setNotificationFilter('all')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", notificationFilter === 'all' ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700")}
                >
                  Toutes
                </button>
                <button 
                  onClick={() => setNotificationFilter('unread')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1", notificationFilter === 'unread' ? "bg-brand-green text-white" : "bg-brand-green/10 text-brand-green hover:bg-brand-green/20")}
                >
                  Non lues {unreadCount > 0 && <span className="bg-brand-green-light/20 px-1.5 rounded text-[10px]">{unreadCount}</span>}
                </button>
                <button 
                  onClick={() => setNotificationFilter('alerts')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", notificationFilter === 'alerts' ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20")}
                >
                  Alertes
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {(() => {
                const filtered = notifications.filter(n => {
                  if (notificationFilter === 'unread') return !n.is_read;
                  if (notificationFilter === 'alerts') return n.type === 'warning' || n.type === 'error';
                  return true;
                });
                
                if (filtered.length === 0) {
                  return (
                    <div className="p-10 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                        {notificationFilter === 'alerts' ? <AlertTriangle size={24} /> : <Bell size={24} />}
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 text-[13px] font-medium">
                        {notificationFilter === 'unread' ? 'Aucune notification non lue' : notificationFilter === 'alerts' ? 'Aucune alerte' : (t('notifications.empty') || 'Aucune notification')}
                      </span>
                    </div>
                  );
                }

                return filtered.map((notification) => (
                  <div 
                    key={notification.id}
                    onClick={() => {
                      if (!notification.is_read) markAsRead(notification.id);
                      if (notification.link) navigate(notification.link);
                    }}
                    className={cn(
                      "p-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer border-l-[3px] relative group border border-transparent text-left flex gap-3",
                      notification.is_read ? "border-l-transparent opacity-60" : 
                      notification.type === 'success' ? "border-l-brand-green bg-brand-green/5" :
                      notification.type === 'warning' ? "border-l-amber-500 bg-amber-500/5" :
                      notification.type === 'error' ? "border-l-rose-500 bg-rose-500/5" : "border-l-blue-500 bg-blue-500/5"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {notification.type === 'success' && <CheckCircle size={16} className="text-brand-green" />}
                      {notification.type === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
                      {notification.type === 'error' && <XCircle size={16} className="text-rose-500" />}
                      {(notification.type === 'info' || !notification.type) && <Info size={16} className="text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button 
                        onClick={(e) => deleteNotification(e, notification.id)}
                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 text-slate-400 rounded-lg transition-all"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                      <div className={cn("font-bold text-[13px] mb-1 truncate pr-8 leading-tight", notification.is_read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white")} title={notification.title}>{notification.title}</div>
                      <div className="text-[12px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{notification.message}</div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mt-2.5">
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50">
              <button 
                onClick={() => navigate('/audit-trail')}
                className="w-full py-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {t('notifications.view_all') || 'Historique Complet'}
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden lg:block" />

        <div className="flex items-center gap-4 pl-2 md:pl-4 relative z-50">
          <Dropdown
            trigger={
              <div className="flex items-center gap-3.5 group cursor-pointer p-1.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-[14px] font-bold text-slate-900 dark:text-white leading-none mb-1.5 group-hover:text-brand-green transition-colors">{user?.name || t('role.user') || 'Utilisateur'}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-[0.15em]">{user?.role === 'admin' ? t('role.admin') || 'Administrateur' : t('role.user') || 'Utilisateur'}</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-black shadow-lg shadow-slate-900/10 dark:shadow-white/10 group-hover:scale-105 transition-all duration-300 border-[3px] border-white dark:border-slate-950 group-hover:border-brand-green/20 relative overflow-hidden text-lg">
                   <div className="absolute inset-0 bg-gradient-to-tr from-brand-green/20 to-transparent" />
                  <span className="relative z-10">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                </div>
              </div>
            }
            width="w-64"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 font-bold border border-slate-800 dark:border-slate-200">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-slate-900 dark:text-white truncate leading-tight">{user?.name || 'Mon Compte'}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
            <div className="p-2 space-y-1">
              <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-all group">
                <Settings size={18} className="text-slate-400 group-hover:text-brand-green transition-colors" />
                <span className="text-[14px]">Paramètres</span>
              </button>
              <button onClick={() => navigate('/assistant')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-all group">
                <HelpCircle size={18} className="text-slate-400 group-hover:text-brand-green transition-colors" />
                <span className="text-[14px]">Aide & Support</span>
              </button>
            </div>
            <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-800/30">
              <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-rose-50 dark:hover:bg-rose-900/10 text-rose-600 font-bold transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 group">
                <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
                <span className="text-[14px]">Déconnexion</span>
              </button>
            </div>
          </Dropdown>
        </div>
      </nav>
    </header>
  );
}
