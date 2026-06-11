import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calculator, Wallet, FileText, BarChart3, Users, Settings, Plus, BookOpen, ShieldCheck, ChevronRight, ArrowDown, CornerDownLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useModules } from '@/context/ModuleContext';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { isActive } = useModules();

  const allActions = [
    { title: 'Tableau de bord', icon: <BarChart3 size={16} />, path: '/', category: 'Pages' },
    { title: 'Recherche Transaction', icon: <Search size={16} />, path: '/journal', category: 'Pages' },
    { title: 'Trésorerie', icon: <Wallet size={16} />, path: '/treasury', module: 'treasury', category: 'Pages' },
    { title: 'Facturation', icon: <FileText size={16} />, path: '/invoicing', module: 'invoicing', category: 'Pages' },
    { title: 'Journal Général', icon: <BookOpen size={16} />, path: '/journal', category: 'Pages' },
    { title: 'États Financiers', icon: <Calculator size={16} />, path: '/financials', category: 'Pages' },
    { title: 'Balance des comptes', icon: <Calculator size={16} />, path: '/trial-balance', category: 'Pages' },
    { title: 'Grand Livre interactif', icon: <FileText size={16} />, path: '/ledger', category: 'Pages' },
    { title: 'Clients & Fournisseurs', icon: <Users size={16} />, path: '/third-parties', module: 'third_parties', category: 'Pages' },
    { title: 'Immobilisations', icon: <Settings size={16} />, path: '/assets', module: 'assets', category: 'Pages' },
    { title: 'Conformité OHADA', icon: <ShieldCheck size={16} />, path: '/compliance', category: 'Pages' },
    { title: 'Paie & RH', icon: <Users size={16} />, path: '/payroll', module: 'payroll', category: 'Pages' },
    { title: 'Tableau de bord RH', icon: <BarChart3 size={16} />, path: '/hr-dashboard', module: 'payroll', category: 'Pages' },
    { title: 'Messagerie & Factures', icon: <FileText size={16} />, path: '/messaging', category: 'Pages' },
    { title: 'Tâches & Échéances', icon: <BookOpen size={16} />, path: '/tasks', category: 'Pages' },
    { title: 'Déclaration TVA', icon: <FileText size={16} />, path: '/vat', module: 'vat', category: 'Pages' },
    { title: 'Piste d\'Audit', icon: <ShieldCheck size={16} />, path: '/audit', category: 'Pages' },
    { title: 'Auditeur IA Financier', icon: <Search size={16} />, path: '/financial-auditor', category: 'Pages' },
    { title: 'Budgets', icon: <Calculator size={16} />, path: '/budgets', module: 'budget', category: 'Pages' },
    { title: 'Paramètres système', icon: <Settings size={16} />, path: '/settings', category: 'Pages' },
    
    // Quick Actions
    { title: 'Nouvelle Écriture', icon: <Plus size={16} />, action: 'new_transaction', category: 'Actions Rapides' },
    { title: 'Nouveau Tiers', icon: <Users size={16} />, action: 'new_party', category: 'Actions Rapides' },
    { title: 'Nouveau Produit/Service', icon: <Plus size={16} />, action: 'new_item', category: 'Actions Rapides' },
    { title: 'Lancer un Audit Flash', icon: <ShieldCheck size={16} />, action: 'audit_now', category: 'Actions Rapides' },
    { title: 'Changer la devise', icon: <Wallet size={16} />, action: 'change_currency', category: 'Actions Rapides' },
  ];

  const actions = allActions.filter(action => !action.module || isActive(action.module));

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const [recentEntries, setRecentEntries] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Fetch recent entries
      apiFetch('/api/transactions?limit=5')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const formatted = data.slice(0, 5).map(tx => ({
              id: `recent_${tx.id}`,
              type: 'transaction',
              title: `${tx.description} (ID: ${tx.id})`,
              subtitle: `Récemment ajouté - Date: ${tx.date} - Montant: ${tx.total_amount || 0} FCFA`,
              link: `/journal?search=${tx.id}`,
              resultType: 'data',
              category: 'Écritures Récentes'
            }));
            setRecentEntries(formatted);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Combine actions and search results
  const combinedResults = [
    ...filteredActions.map(a => ({ ...a, resultType: 'action' })),
    ...(query.length === 0 ? recentEntries : []),
    ...searchResults.map(r => ({ ...r, resultType: 'data', category: 'Résultats' }))
  ];

  const categories = Array.from(new Set(combinedResults.map(a => a.category)));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    setQuery('');
    setSelectedIndex(0);
  }, [isOpen]);

  const executeAction = (result: any) => {
    if (result.path || result.link) {
      navigate(result.path || result.link);
    } else if (result.action) {
      if (result.action === 'new_transaction') {
        navigate('/journal', { state: { action: 'new' } });
      } else if (result.action === 'new_party') {
        navigate('/third-parties', { state: { action: 'new' } });
      } else if (result.action === 'new_item') {
        navigate('/invoicing', { state: { action: 'new' } });
      } else if (result.action === 'audit_now') {
        navigate('/compliance');
      } else if (result.action === 'change_currency') {
        navigate('/settings', { state: { action: 'currency' } });
      }
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const handleNav = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % combinedResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + combinedResults.length) % combinedResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = combinedResults[selectedIndex];
        if (result) {
          executeAction(result);
        }
      }
    };

    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
  }, [isOpen, combinedResults, selectedIndex, navigate]);

  if (!isOpen) return null;

  const getIcon = (item: any) => {
    if (item.resultType === 'action') return item.icon;
    switch (item.type) {
      case 'account': return <Calculator size={16} />;
      case 'transaction': return <BookOpen size={16} />;
      case 'third_party': return <Users size={16} />;
      case 'invoice': return <FileText size={16} />;
      default: return <Search size={16} />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 backdrop-blur-md bg-slate-950/40 pt-16 sm:pt-24 pb-24 overflow-y-auto">
        <div 
          className="fixed inset-0 -z-10" 
          onClick={() => setIsOpen(false)}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -20 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-white/10"
        >
          <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
            <div className="w-10 h-10 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center shadow-inner">
              {isSearching ? <Loader2 size={22} className="animate-spin" /> : <Search size={22} />}
            </div>
            <input 
              ref={inputRef}
              type="text" 
              placeholder="Rechercher une page, compte, client, date (AAAA-MM-JJ) ou ID de transaction..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-lg font-bold tracking-tight"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-2 py-1 rounded-lg">
                <span className="opacity-50">ESC</span>
              </div>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-4 custom-scrollbar">
            {combinedResults.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="text-slate-300" size={32} />
                </div>
                <p className="text-slate-500 font-medium">Aucun résultat pour "{query}"</p>
                <p className="text-xs text-slate-400 mt-2">Essayez de rechercher un code compte (ex: 411), un nom de client ou un ID de transaction.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {categories.map(category => (
                  <div key={category} className="space-y-1.5">
                    <div className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400/80 mb-2">{category}</div>
                    {combinedResults.filter(a => a.category === category).map((result) => {
                      const absoluteIndex = combinedResults.indexOf(result);
                      return (
                        <button
                          key={result.id + result.title + (result.path || result.link || result.action)}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 text-left border",
                            absoluteIndex === selectedIndex 
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl shadow-slate-900/10 dark:shadow-white/5 border-transparent translate-x-1' 
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'
                          )}
                          onClick={() => executeAction(result)}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                            absoluteIndex === selectedIndex ? "bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-900" : "bg-slate-100 dark:bg-white/5 text-slate-400"
                          )}>
                            {getIcon(result)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-bold tracking-tight truncate">{result.title}</span>
                            {result.subtitle && (
                              <span className={cn(
                                "text-[10px] block truncate opacity-70",
                                absoluteIndex === selectedIndex ? "text-white/80 dark:text-slate-900/80" : "text-slate-500"
                              )}>{result.subtitle}</span>
                            )}
                          </div>
                          {absoluteIndex === selectedIndex && (
                            <ChevronRight size={16} className="opacity-50 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="px-8 py-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5"><ArrowDown size={14}/> Naviguer</span>
              <span className="flex items-center gap-1.5"><CornerDownLeft size={14}/> Sélectionner</span>
            </div>
            <span>v4.2 PRO</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
