import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Plus, Settings, HelpCircle, User, LogOut, X, Loader2, ChevronRight, BookOpen, Users, Building2, Calculator, Moon, Sun, FileText, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { apiFetch as fetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useFiscalYear, FiscalYear } from '@/context/FiscalYearContext';
import { Calendar } from 'lucide-react';

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
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { activeYear, refreshActiveYear } = useFiscalYear();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const yearSelectorRef = useRef<HTMLDivElement>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const isDarkMode = theme === 'dark';

  const fetchFiscalYears = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
      if (res.ok) {
        const data = await res.json();
        setFiscalYears(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFiscalYears();
  }, []);

  const handleActivateYear = async (id: number) => {
    try {
      const res = await fetch(`/api/fiscal-years/${id}/activate`, { method: 'PUT' });
      if (res.ok) {
        await refreshActiveYear();
        window.location.reload();
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
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target as Node)) {
        setShowQuickActions(false);
      }
      if (yearSelectorRef.current && !yearSelectorRef.current.contains(event.target as Node)) {
        setShowYearSelector(false);
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
    try {
      const response = await fetch('/api/notifications');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

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

  const QUICK_ACTIONS = [
    { label: t('nav.journal') || 'Saisie Journal', icon: Calculator, link: '/journal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('nav.invoicing') || 'Facturation', icon: FileText, link: '/invoicing', color: 'text-brand-green', bg: 'bg-brand-green/10' },
    { label: t('nav.third_parties') || 'Tiers', icon: Users, link: '/third-parties', color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
    { label: t('nav.treasury') || 'Trésorerie', icon: Wallet, link: '/treasury', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <header className="h-16 sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 md:px-8 transition-all duration-300 shadow-2xl shadow-black/20">
      {/* Left: Search Bar */}
      <div className="flex-1 max-w-xl relative" ref={searchRef}>
        <div className={cn(
          "relative group transition-all duration-300",
          isSearchOpen ? "w-full" : "w-64"
        )}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-green transition-colors" size={16} />
          <input
            type="text"
            placeholder={t('search.placeholder') || "Rechercher..."}
            className="w-full bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-brand-green/30 focus:ring-4 focus:ring-brand-green/5 rounded-2xl py-2.5 pl-11 pr-4 text-sm transition-all outline-none text-slate-900 dark:text-slate-100 dark:placeholder-slate-500 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          {!isSearchOpen && searchQuery.length === 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none opacity-50">
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
      <div className="flex items-center gap-2 md:gap-4">
        {/* Quick Actions */}
        <div className="relative hidden sm:block" ref={quickActionsRef}>
          <button 
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-green-light transition-all shadow-lg shadow-brand-green/20 active:scale-95"
          >
            <Plus size={16} className={cn("transition-transform duration-300", showQuickActions ? "rotate-45" : "rotate-0")} />
            <span className="hidden lg:inline">Actions</span>
          </button>

          <AnimatePresence>
            {showQuickActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-3 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-2 z-50"
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Actions Rapides</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.link}
                      onClick={() => {
                        navigate(action.link);
                        setShowQuickActions(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group"
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-all group-hover:scale-110", action.bg, action.color)}>
                        <action.icon size={18} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fiscal Year Selector */}
        <div className="relative hidden lg:block" ref={yearSelectorRef}>
          <button 
            onClick={() => setShowYearSelector(!showYearSelector)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Calendar size={14} className="text-brand-green" />
            <span>{activeYear?.name || 'Exercice'}</span>
          </button>

          <AnimatePresence>
            {showYearSelector && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-2 z-50"
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Changer d'exercice</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
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
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => {
                      navigate('/settings');
                      setShowYearSelector(false);
                    }}
                    className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-brand-green transition-colors"
                  >
                    Gérer les exercices
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 md:gap-2 mr-1 md:mr-2">
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-300 relative group active:scale-90"
            aria-label="Toggle theme"
          >
            <div className="relative w-5 h-5">
              <motion.div
                initial={false}
                animate={{ 
                  rotate: isDarkMode ? 0 : 90,
                  scale: isDarkMode ? 0 : 1,
                  opacity: isDarkMode ? 0 : 1
                }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Moon size={20} />
              </motion.div>
              <motion.div
                initial={false}
                animate={{ 
                  rotate: isDarkMode ? 0 : -90,
                  scale: isDarkMode ? 1 : 0,
                  opacity: isDarkMode ? 1 : 0
                }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Sun size={20} />
              </motion.div>
            </div>
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
              {isDarkMode ? t('theme.light') || 'Mode Clair' : t('theme.dark') || 'Mode Sombre'}
            </span>
          </button>

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

        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
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
                          setShowNotifications(false);
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

        <div className="flex items-center gap-3 pl-2">
          <div className="hidden lg:block text-right min-w-0">
            <div className="text-sm font-bold text-white leading-none mb-1 truncate max-w-[150px]">{user?.name || t('role.user') || 'Utilisateur'}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium truncate max-w-[150px]">{user?.role === 'admin' ? t('role.admin') || 'Administrateur' : t('role.user') || 'Utilisateur'}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-green to-brand-green-light flex items-center justify-center text-white font-bold shadow-lg shadow-brand-green/20">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
