import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, HelpCircle, User, LogOut, X, Loader2, ChevronRight, BookOpen, Users, Building2, Calculator, Moon, Sun, FileText, Wallet, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { apiFetch as fetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useFiscalYear, FiscalYear } from '@/context/FiscalYearContext';
import { Calendar, User as UserIcon } from 'lucide-react';
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

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { activeYear, refreshActiveYear } = useFiscalYear();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const yearSelectorRef = useRef<HTMLDivElement>(null);
  const themeSelectorRef = useRef<HTMLDivElement>(null);

  const isDarkMode = resolvedTheme === 'dark';

  const fetchFiscalYears = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
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
      const res = await fetch(`/api/fiscal-years/${id}/activate`, { method: 'PUT' });
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchRef.current?.querySelector('input')?.focus();
      }
      if (e.key === 'Escape') {
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
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
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
      const response = await fetch('/api/notifications');
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
      // Only log if it's not a standard "Failed to fetch" which happens during server restarts
      if (error.message !== 'Failed to fetch') {
        console.error('Error fetching notifications:', error);
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
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
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
    <header className="h-20 sticky top-0 z-40 bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl border-b border-slate-200/50 dark:border-white/5 flex items-center px-6 md:px-10 transition-all duration-300 shadow-sm">
      {/* Left: Brand & Status */}
      <div className="hidden lg:flex flex-1 items-center gap-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform duration-300 border border-slate-100 dark:border-white/5">
            <Logo className="w-6 h-6 text-emerald-600" showText={false} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-slate-100">ORYCOMPTA</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
              <span className="text-[8px] font-black text-brand-green uppercase tracking-widest">Connecté</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl relative mx-auto px-2 md:px-0" ref={searchRef}>
        <div className={cn(
          "relative group transition-all duration-500",
          isSearchOpen ? "w-full" : "w-10 md:w-72"
        )}>
          <Search 
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-green transition-all duration-300 group-focus-within:scale-110 cursor-pointer md:cursor-text" 
            size={18} 
            onClick={() => setIsSearchOpen(true)}
          />
          <input
            type="text"
            placeholder={t('search.placeholder') || "Rechercher..."}
            className={cn(
              "w-full bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-white/5 focus:bg-white dark:focus:bg-slate-900 focus:border-brand-green/30 focus:ring-8 focus:ring-brand-green/5 rounded-2xl py-3 pl-10 md:pl-14 pr-4 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 dark:placeholder-slate-500 font-bold shadow-inner",
              !isSearchOpen && "hidden md:block"
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          {!isSearchOpen && searchQuery.length === 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1.5 pointer-events-none opacity-50">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-bold text-slate-400 dark:text-slate-500 shadow-sm">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-[10px] font-bold text-slate-400 dark:text-slate-500 shadow-sm">K</kbd>
            </div>
          )}
          
          <AnimatePresence>
            {isSearchOpen && (searchQuery.length > 0 || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute top-full left-0 right-0 mt-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden max-h-[480px] flex flex-col z-50"
              >
                <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('search.results') || 'Résultats'}</span>
                  {isSearching && <Loader2 className="animate-spin text-brand-green" size={14} />}
                </div>
                
                <div className="overflow-y-auto flex-1 p-3 space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result.link)}
                        className="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-white dark:hover:bg-slate-800 shadow-none hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20 transition-all text-left group border border-transparent hover:border-slate-100 dark:hover:border-slate-700"
                      >
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-brand-green group-hover:text-white transition-all duration-300">
                          <result.icon size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-green dark:group-hover:text-brand-gold transition-colors">{result.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{result.subtitle}</div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-all" />
                      </button>
                    ))
                  ) : !isSearching && searchQuery.length >= 2 ? (
                    <div className="p-10 text-center">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search size={24} className="text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {t('search.no_results') || 'Aucun résultat trouvé pour'} <span className="text-slate-900 dark:text-slate-100 font-bold">"{searchQuery}"</span>
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
      <div className="flex-1 flex items-center justify-end gap-2 md:gap-4">
        {/* Fiscal Year Selector */}
        <div className="hidden lg:block">
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700">
                <Calendar size={14} className="text-brand-green" />
                <span>{activeYear?.name || 'Exercice'}</span>
              </button>
            }
            width="w-64"
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Changer d'exercice</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 p-2">
              {fiscalYears.map((year) => (
                <button
                  key={year.id}
                  onClick={() => handleActivateYear(year.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all group",
                    year.is_active ? "bg-brand-green/10 text-brand-green" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{year.name}</span>
                    <span className="text-[10px] opacity-60">{year.start_date} - {year.end_date}</span>
                  </div>
                  {year.is_active === 1 && <div className="w-1.5 h-1.5 rounded-full bg-brand-green" />}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 p-2">
              <button 
                onClick={() => navigate('/settings')}
                className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-brand-green transition-colors"
              >
                Gérer les exercices
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="flex items-center gap-1 md:gap-2 mr-1 md:mr-2">
          <div>
            <Dropdown
              trigger={
                <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-300 relative group active:scale-90">
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                </button>
              }
              width="w-48"
              align="center"
            >
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Choix du Thème</span>
              </div>
              <div className="space-y-1 p-2">
                {THEMES.map((t_item) => (
                  <button
                    key={t_item.id}
                    onClick={() => setTheme(t_item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all group",
                      theme === t_item.id ? "bg-brand-green/10 text-brand-green" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <t_item.icon size={16} />
                    <span className="text-sm font-bold">{t_item.label}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative group">
              <HelpCircle size={20} />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">{t('common.help') || 'Aide'}</span>
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative group"
            >
              <Settings size={20} />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">{t('nav.settings') || 'Paramètres'}</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Dropdown
            trigger={
              <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:ring-slate-900 ring-2 ring-white dark:ring-slate-900 border-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            }
            width="w-80"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{t('notifications.title') || 'Notifications'}</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-brand-green font-medium hover:underline"
                >
                  {t('notifications.mark_read') || 'Tout marquer comme lu'}
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    onClick={() => {
                      if (!notification.is_read) markAsRead(notification.id);
                      if (notification.link) navigate(notification.link);
                    }}
                    className={cn(
                      "p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 mb-1 relative group",
                      notification.is_read ? "border-transparent opacity-60" : 
                      notification.type === 'success' ? "border-brand-green" :
                      notification.type === 'warning' ? "border-brand-gold" :
                      notification.type === 'error' ? "border-red-500" : "border-blue-500"
                    )}
                  >
                    <button 
                      onClick={(e) => deleteNotification(e, notification.id)}
                      className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-all"
                    >
                      <X size={12} />
                    </button>
                    <div className="font-semibold text-xs mb-1 text-slate-900 dark:text-slate-100 truncate pr-6" title={notification.title}>{notification.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight">{notification.message}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 truncate">
                      {new Date(notification.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm italic">
                  {t('notifications.empty') || 'Aucune notification'}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <button 
                onClick={() => navigate('/audit-trail')}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              >
                {t('notifications.view_all') || 'Voir l\'historique complet'}
              </button>
            </div>
          </Dropdown>
        </div>

        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

        <div className="flex items-center gap-4 pl-4">
          <Dropdown
            trigger={
              <div className="flex items-center gap-3 group cursor-pointer">
                <div className="hidden lg:block text-right min-w-0">
                  <div className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1 truncate max-w-[150px] tracking-tight">{user?.name || t('role.user') || 'Utilisateur'}</div>
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                    <div className="text-[9px] text-brand-green uppercase font-black tracking-widest truncate max-w-[150px]">{user?.role === 'admin' ? t('role.admin') || 'Administrateur' : t('role.user') || 'Utilisateur'}</div>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-green to-emerald-500 flex items-center justify-center text-white font-black shadow-lg shadow-brand-green/20 group-hover:scale-105 transition-transform duration-300 ring-4 ring-white dark:ring-slate-950 group-hover:ring-brand-green/10">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </div>
            }
            width="w-56"
          >
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">{user?.name || 'Mon Compte'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <div className="p-2 space-y-1">
              <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all">
                <Settings size={16} />
                <span className="text-sm font-bold">Paramètres</span>
              </button>
              <button onClick={() => navigate('/assistant')} className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-all">
                <HelpCircle size={16} />
                <span className="text-sm font-bold">Aide & Support</span>
              </button>
            </div>
            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={logout} className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 transition-all">
                <LogOut size={16} />
                <span className="text-sm font-bold">Déconnexion</span>
              </button>
            </div>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
