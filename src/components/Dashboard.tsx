import React, { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart, Line, Cell,
  PieChart as RePieChart, Pie,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertCircle, Loader2, Search,
  ArrowUpRight, ArrowDownRight, Wallet, CreditCard, Users, FileText, Plus, FileSpreadsheet,
  Target, ChevronRight, MessageSquareText, PieChart as PieChartIcon, History as HistoryIcon,
  Activity, BarChart3, PieChart, Settings as SettingsIcon, Check, Calculator
} from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { apiFetch as fetch } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/exportUtils';
import { DashboardCustomizer, type WidgetConfig } from './DashboardCustomizer';
import { getQuickInsight } from '../services/geminiService';

export function Dashboard() {
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    turnover: 0,
    expenses: 0,
    net_result: 0,
    cash: 0,
    receivables: 0,
    payables: 0
  });
  const [chartData, setChartData] = useState([]);
  const [cashflowData, setCashflowData] = useState([]);
  const [breakdownData, setBreakdownData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgetVsActual, setBudgetVsActual] = useState([]);
  const [ratios, setRatios] = useState({ currentRatio: 0, netMargin: 0, solvency: 0, roi: 0 });
  const [loading, setLoading] = useState(true);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('dashboard_widgets');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'summary', label: 'Résumé de Performance', visible: true },
      { id: 'investment', label: 'Capacité d\'Investissement', visible: true },
      { id: 'stats', label: 'Indicateurs Clés', visible: true },
      { id: 'quick_stats', label: 'Indicateurs Rapides', visible: true },
      { id: 'health', label: 'Santé Financière', visible: true },
      { id: 'tax_calendar', label: 'Calendrier Fiscal', visible: true },
      { id: 'compliance', label: 'Score de Conformité', visible: true },
      { id: 'runway', label: 'Cash Runway', visible: true },
      { id: 'advisor', label: 'Conseiller Ory', visible: true },
      { id: 'shortcut', label: 'Raccourcis Clavier', visible: true },
      { id: 'performance', label: 'Graphique de Performance', visible: true },
      { id: 'cashflow', label: 'Prévision de Trésorerie', visible: true },
      { id: 'financial_health', label: 'Indicateurs de Santé', visible: true },
      { id: 'expenses', label: 'Répartition des Dépenses', visible: true },
      { id: 'activity', label: 'Activité Récente', visible: true },
      { id: 'analysis', label: 'Analyse Stratégique', visible: true },
    ];
  });

  const isVisible = (id: string) => widgets.find(w => w.id === id)?.visible ?? true;

  const toggleWidget = (id: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      localStorage.setItem('dashboard_widgets', JSON.stringify(updated));
      return updated;
    });
  };

  const resetWidgets = () => {
    const reset = widgets.map(w => ({ ...w, visible: true }));
    setWidgets(reset);
    localStorage.setItem('dashboard_widgets', JSON.stringify(reset));
  };

  const cashRunway = stats.expenses > 0 ? Math.round((stats.cash / (stats.expenses / 12)) * 10) / 10 : Infinity;
  const healthScore = Math.min(100, Math.max(0, 
    (ratios.netMargin > 10 ? 40 : ratios.netMargin > 0 ? 20 : 5) + 
    (ratios.currentRatio > 1.5 ? 30 : ratios.currentRatio > 1 ? 20 : 10) + 
    (ratios.solvency > 1.2 ? 30 : ratios.solvency > 1 ? 20 : 10)
  ));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, chartsRes, cashflowRes, breakdownRes, recentRes, budgetRes, ratiosRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/charts'),
          fetch('/api/dashboard/cashflow-forecast'),
          fetch('/api/dashboard/breakdown'),
          fetch('/api/dashboard/recent'),
          fetch('/api/dashboard/budget-vs-actual'),
          fetch('/api/dashboard/ratios')
        ]);
        
        const responses = [statsRes, chartsRes, cashflowRes, breakdownRes, recentRes, budgetRes, ratiosRes];
        const allOk = responses.every(r => r.ok);
        
        if (!allOk) {
          const failedRes = responses.find(r => !r.ok);
          const text = await failedRes?.text();
          console.error("Dashboard fetch failed:", text || failedRes?.statusText);
          setLoading(false);
          return;
        }

        const [statsData, chartsData, cfData, bData, recentData, budgetData, ratiosData] = await Promise.all(
          responses.map(r => r.json())
        );
        
        setStats(statsData);
        setChartData(chartsData);
        setCashflowData(cfData);
        setBreakdownData(bData);
        setRecentTransactions(recentData);
        setBudgetVsActual(budgetData);
        setRatios(ratiosData);
        setLoading(false);

        // Fetch AI insight after stats are loaded
        fetchInsight(statsData.turnover, statsData.expenses, statsData.cash);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchInsight = async (ca: number, charges: number, cash: number) => {
    setLoadingInsight(true);
    try {
      const insight = await getQuickInsight(ca, charges, cash);
      if (insight) {
        setAiInsight(insight);
      }
    } catch (err) {
      console.error("Failed to fetch AI insight:", err);
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleExportSummary = () => {
    const summaryData = [
      { Metric: 'Trésorerie Disponible', Value: stats.cash },
      { Metric: 'Chiffre d\'Affaires', Value: stats.turnover },
      { Metric: 'Charges Totales', Value: stats.expenses },
      { Metric: 'Résultat Net', Value: stats.net_result },
      { Metric: 'Créances Clients', Value: stats.receivables },
      { Metric: 'Dettes Fournisseurs', Value: stats.payables }
    ];
    
    import('../lib/exportUtils').then(utils => {
      utils.exportToExcel(summaryData, `Rapport_Synthese_${new Date().toISOString().split('T')[0]}`, 'SYNTHESE');
    });
  };

  const StatCard = ({ title, value, trend, trendValue, icon: Icon, color, delay, path, whiteTrend }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={() => path && navigate(path)}
      className={cn(
        "premium-card p-7 group relative overflow-hidden transition-all duration-500 hover:-translate-y-2",
        path ? "cursor-pointer" : ""
      )}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -mr-10 -mt-10" />
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={cn(
          "p-4 rounded-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-lg",
          color,
          "text-white"
        )}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl backdrop-blur-2xl shadow-xl border border-white/10",
            whiteTrend ? "bg-white/10 text-white" : (trend === 'up' ? 'bg-brand-green/10 text-brand-green' : 'bg-rose-500/10 text-rose-500'),
          )}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trendValue}
          </div>
        )}
      </div>
      
      <div className="space-y-3 relative z-10">
        <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1 truncate" title={title}>{title}</h3>
        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter leading-none font-display drop-shadow-sm truncate">
          {loading ? (
            <div className="h-8 w-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          ) : (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: delay + 0.2 }}
            >
              {formatCurrency(value)}
            </motion.span>
          )}
        </div>
      </div>
      
      <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <span>Détails</span>
        <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-16 pb-24 relative">
      <div className="atmospheric-bg" />
      
      {/* Editorial Header - Recipe 2 & 11 inspired */}
      <div className="relative pt-8 pb-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-green/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 relative z-10">
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
              <span className="px-4 py-1.5 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-brand-green/20">
                Live Intelligence
              </span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Mise à jour en temps réel</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-5xl sm:text-7xl md:text-[100px] font-black text-slate-900 dark:text-slate-100 tracking-tighter leading-[0.8] uppercase animate-in fade-in slide-in-from-bottom-4 duration-1000">
                Ory<span className="text-brand-green">Compta</span>
              </h1>
              <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.5em]">Expertise SYSCOHADA</p>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
            
            <p className="text-2xl text-slate-500 dark:text-slate-400 font-medium leading-tight max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              Pilotez votre performance avec une <span className="text-slate-900 dark:text-slate-100 font-black italic underline decoration-brand-green/30 underline-offset-8">clarté absolue</span>. 
              Chaque chiffre raconte l'histoire de votre croissance.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-right-4 duration-1000 delay-500">
            <button 
              onClick={() => setIsCustomizerOpen(true)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-500 shadow-sm flex items-center gap-4 active:scale-95"
            >
              <SettingsIcon size={18} className="group-hover:rotate-90 transition-transform duration-500" />
              <span>Personnaliser</span>
            </button>
            <button 
              onClick={handleExportSummary}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-slate-800 hover:text-white transition-all duration-500 shadow-sm flex items-center gap-4 active:scale-95"
            >
              <FileSpreadsheet size={18} className="group-hover:rotate-12 transition-transform duration-500" />
              <span>Exporter</span>
            </button>
            <button 
              onClick={() => navigate('/journal')}
              className="group bg-brand-green text-white px-10 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-green-light transition-all duration-500 shadow-2xl shadow-brand-green/30 flex items-center gap-4 active:scale-95"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
              <span>Nouvelle Saisie</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Navigation - New Feature */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Journal', icon: Calculator, path: '/journal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Tiers', icon: Users, path: '/third-parties', color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
          { label: 'Trésorerie', icon: Wallet, path: '/treasury', color: 'text-brand-green', bg: 'bg-brand-green/10' },
          { label: 'Factures', icon: FileText, path: '/invoicing', color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Rapports', icon: BarChart3, path: '/financials', color: 'text-rose-500', bg: 'bg-rose-500/10' },
          { label: 'Paramètres', icon: SettingsIcon, path: '/settings', color: 'text-slate-500', bg: 'bg-slate-500/10' },
        ].map((item, idx) => (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            onClick={() => navigate(item.path)}
            className="group flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl hover:border-brand-green/30 hover:shadow-2xl hover:shadow-brand-green/5 transition-all duration-500 active:scale-95"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", item.bg, item.color)}>
              <item.icon size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Financial Summary Section */}
      <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isVisible('summary') && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 premium-card p-8 bg-gradient-to-br from-slate-900 to-slate-950 text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.1)_0%,_transparent_50%)]" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-green/20 flex items-center justify-center text-brand-green border border-brand-green/20">
                  <Activity size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight font-display">Résumé de Performance</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Période Fiscale 2026</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Marge Brute</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-brand-green truncate">64.2%</p>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green w-[64.2%]" />
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">EBITDA</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-brand-gold truncate">{formatCurrency(stats.turnover * 0.28)}</p>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-gold w-[28%]" />
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Point Mort</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-white truncate">J-142</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase truncate">Atteint le 22 Mai</p>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">BFR</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-rose-400 truncate">{formatCurrency(stats.receivables - stats.payables)}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase truncate">Besoin en fonds de roulement</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isVisible('investment') && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="premium-card p-8 bg-brand-gold text-white flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(255,255,255,0.2)_0%,_transparent_50%)]" />
            <div className="relative z-10">
              <h3 className="text-lg font-black uppercase tracking-widest mb-2">Capacité d'Investissement</h3>
              <p className="text-sm opacity-80 font-medium leading-relaxed">Basé sur votre cash-flow actuel et vos engagements futurs.</p>
            </div>
            <div className="relative z-10 mt-8">
              <div className="text-4xl sm:text-5xl font-black font-display mb-2 truncate">{formatCurrency(stats.cash * 0.6)}</div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 truncate">Disponible pour nouveaux projets</p>
            </div>
            <button className="relative z-10 mt-8 w-full py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-xs font-black uppercase tracking-widest transition-all">
              Simuler un projet
            </button>
          </motion.div>
        )}
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Main Stats */}
        {isVisible('stats') && (
          <>
            <StatCard 
              title="Trésorerie Disponible" 
              value={stats.cash} 
              trend="up" 
              trendValue="+12%" 
              icon={Wallet} 
              color="bg-brand-green" 
              delay={0.1}
              path="/treasury"
              whiteTrend={true}
            />
            <StatCard 
              title="Chiffre d'Affaires" 
              value={stats.turnover} 
              trend="up" 
              trendValue="+8.5%" 
              icon={TrendingUp} 
              color="bg-brand-green-light" 
              delay={0.2}
              path="/journal"
              whiteTrend={true}
            />
            <StatCard 
              title="Créances Clients" 
              value={stats.receivables} 
              trend="down" 
              trendValue="-2.1%" 
              icon={Users} 
              color="bg-brand-gold-dark" 
              delay={0.3}
              path="/third-parties"
            />
            <StatCard 
              title="Résultat Net" 
              value={stats.net_result} 
              trend={stats.net_result >= 0 ? 'up' : 'down'} 
              trendValue={stats.net_result >= 0 ? '+5%' : '-3%'} 
              icon={FileText} 
              color="bg-brand-gold" 
              delay={0.4}
              path="/financials"
            />
          </>
        )}

        {/* Quick Stats Bar - New Feature */}
        {isVisible('quick_stats') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="lg:col-span-4 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-6 shadow-sm"
          >
            <div className="flex items-center gap-8 px-4 overflow-hidden">
              <div className="space-y-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Charges Fixes</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{formatCurrency(stats.expenses * 0.4)}</p>
              </div>
              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Seuil de Rentabilité</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{formatCurrency(stats.expenses * 1.2)}</p>
              </div>
              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Délai de Paiement Moyen</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">32 jours</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut Fiscal:</span>
              <span className="px-3 py-1 bg-brand-green/10 text-brand-green text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-green/20">À jour</span>
            </div>
          </motion.div>
        )}

        {/* Atmospheric Health Score - Large Bento Item */}
        {isVisible('health') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-slate-950 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl group border border-white/5"
          >
            {/* Background Glow - Improved Symbiosis */}
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12)_0%,_transparent_50%)] opacity-30 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(197,160,89,0.08)_0%,_transparent_50%)] opacity-30 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.02)_0%,_transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Indice de Santé Financière</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                    <div className="text-5xl sm:text-7xl font-black tracking-tighter leading-none font-display text-white drop-shadow-2xl">{healthScore}%</div>
                    <div className={cn(
                      "px-4 sm:px-6 py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl shadow-2xl",
                      healthScore > 70 ? "bg-brand-green/20 text-brand-green-light border border-brand-green/30" :
                      healthScore > 40 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                      "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    )}>
                      {healthScore > 70 ? 'Performance Optimale' : healthScore > 40 ? 'Stabilité Vigilante' : 'Alerte Critique'}
                    </div>
                  </div>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-slate-900/50 flex items-center justify-center relative shadow-2xl">
                  <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    <circle
                      cx="48" cy="48" r="42"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-slate-900/30"
                    />
                    <circle
                      cx="48" cy="48" r="42"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={263.9}
                      strokeDashoffset={263.9 - (263.9 * healthScore) / 100}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-1500 ease-out",
                        healthScore > 70 ? "text-brand-green-light" :
                        healthScore > 40 ? "text-amber-500" :
                        "text-rose-500"
                      )}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Target size={24} className="text-slate-600 group-hover:scale-125 transition-transform duration-700" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                <div className="space-y-6">
                  <div className="group/ratio">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      <span>Marge Nette Opérationnelle</span>
                      <span className="text-white font-display text-base">{ratios.netMargin}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-900/50 rounded-full overflow-hidden p-[1px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, ratios.netMargin))}%` }}
                        className="h-full bg-gradient-to-r from-brand-green/50 to-brand-green-light rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                      />
                    </div>
                  </div>
                  <div className="group/ratio">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                      <span>Ratio de Liquidité Générale</span>
                      <span className="text-white font-display text-base">{ratios.currentRatio}</span>
                    </div>
                    <div className="h-1.5 bg-slate-900/50 rounded-full overflow-hidden p-[1px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ratios.currentRatio * 20)}%` }}
                        className="h-full bg-gradient-to-r from-brand-gold/50 to-brand-gold rounded-full shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/5 backdrop-blur-2xl rounded-[1.5rem] p-6 border border-white/10 shadow-inner relative group/advice">
                  <div className="absolute top-4 right-4 text-brand-gold/20 group-hover/advice:text-brand-gold/50 transition-colors duration-500">
                    <MessageSquareText size={20} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gold/80 mb-4">Analyse Stratégique</p>
                  <p className="text-base font-medium text-slate-300 leading-relaxed italic font-display">
                    "Votre structure financière est <span className="text-white font-black">robuste</span>. L'excédent de liquidité actuel suggère une opportunité de <span className="text-brand-green-light font-black">croissance externe</span>."
                  </p>
                  <button 
                    onClick={() => navigate('/advisor')}
                    className="mt-6 flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest hover:text-brand-gold transition-colors group/btn"
                  >
                    <span>Consulter Ory Advisor</span>
                    <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tax Calendar Widget */}
        {isVisible('tax_calendar') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="premium-card p-6 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Échéances Fiscales</h3>
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <HistoryIcon size={16} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-rose-500 uppercase leading-none">Avr</span>
                  <span className="text-lg font-black text-slate-900 dark:text-slate-100 leading-none">15</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Déclaration TVA</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Mars 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-blue-500 uppercase leading-none">Mai</span>
                  <span className="text-lg font-black text-slate-900 dark:text-slate-100 leading-none">20</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Impôt sur les Sociétés</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Acompte Q1</p>
                </div>
              </div>
            </div>
            <button className="mt-4 text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline text-center">Voir tout le calendrier</button>
          </motion.div>
        )}

        {/* Compliance Score Widget */}
        {isVisible('compliance') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="premium-card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Conformité OHADA</h3>
              <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl">
                <Check size={16} />
              </div>
            </div>
            <div className="flex flex-col items-center py-2">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                  <circle cx="48" cy="48" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={251.3} strokeDashoffset={251.3 * 0.05} strokeLinecap="round" className="text-brand-green" />
                </svg>
                <span className="absolute text-2xl font-black text-slate-900 dark:text-slate-100">95%</span>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4">Score de Conformité</p>
            </div>
            <div className="flex items-center gap-2 mt-4 p-2 bg-brand-green/5 rounded-lg border border-brand-green/10">
              <AlertCircle size={12} className="text-brand-green" />
              <span className="text-[9px] font-bold text-brand-green uppercase tracking-wider">1 point de vigilance détecté</span>
            </div>
          </motion.div>
        )}

        {isVisible('runway') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="premium-card p-6 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cash Runway</h3>
              <div className="p-2 bg-brand-gold/10 dark:bg-brand-gold/20 text-brand-gold rounded-xl">
                <Wallet size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <div className="text-4xl font-black text-slate-900 dark:text-slate-100 font-display">{cashRunway === Infinity ? '∞' : cashRunway}</div>
              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">mois</div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed font-medium">
              Temps estimé avant épuisement de la trésorerie au rythme actuel.
            </p>
          </motion.div>
        )}

        {isVisible('advisor') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conseiller Ory</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchInsight(stats.turnover, stats.expenses, stats.cash)}
                  disabled={loadingInsight}
                  className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                  title="Rafraîchir le conseil"
                >
                  <HistoryIcon size={12} className={cn(loadingInsight && "animate-spin")} />
                </button>
                <div className="p-1.5 bg-brand-green/20 text-brand-gold rounded-lg">
                  <MessageSquareText size={14} />
                </div>
              </div>
            </div>
            <div className="text-[11px] font-medium text-slate-300 italic min-h-[2.5rem] flex items-center line-clamp-3">
              {loadingInsight ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-brand-green" />
                  <span>Analyse en cours...</span>
                </div>
              ) : (
                aiInsight || "\"Votre CA a augmenté de 12%. Pensez à provisionner vos impôts.\""
              )}
            </div>
            <button 
              onClick={() => navigate('/financial-auditor')}
              className="mt-3 w-full py-1.5 bg-brand-green hover:bg-brand-green-light text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Audit Complet IA
            </button>
          </motion.div>
        )}

        {isVisible('shortcut') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Raccourci</h3>
              <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg">
                <Search size={14} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-500 dark:text-slate-400 shadow-sm">Ctrl</kbd>
              <span className="text-slate-300 dark:text-slate-600">+</span>
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-500 dark:text-slate-400 shadow-sm">K</kbd>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Recherche globale rapide partout dans l'application.
            </p>
          </motion.div>
        )}

        {/* Performance Chart - Extra Large Bento Item */}
        {isVisible('performance') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2 premium-card p-8 relative overflow-hidden group"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 relative z-10 gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Performance</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Produits vs Charges</p>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Produits</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Charges</span>
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand-green)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-brand-green)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCharges" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                    className="text-slate-400 dark:text-slate-500"
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                    className="text-slate-400 dark:text-slate-500"
                    tickFormatter={(value) => `${value / 1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                      padding: '20px',
                      backgroundColor: 'var(--tooltip-bg)',
                      color: 'var(--tooltip-text)'
                    }}
                    itemStyle={{ color: 'var(--tooltip-text)' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ca" 
                    stroke="var(--color-brand-green)" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorCa)" 
                    name="Produits" 
                    animationDuration={2000}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="charges" 
                    stroke="#f43f5e" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorCharges)" 
                    name="Charges" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Cash Flow Forecast - Large Bento Item */}
        {isVisible('cashflow') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="lg:col-span-4 premium-card p-8"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Prévision de Trésorerie</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Projection basée sur les échéances clients et fournisseurs</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Solde Prévu
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashflowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: 'currentColor', fontSize: 11}} 
                    className="text-slate-400 dark:text-slate-500"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: 'currentColor', fontSize: 11}} 
                    className="text-slate-400 dark:text-slate-500"
                    tickFormatter={(value) => `${value / 1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                      backgroundColor: 'var(--tooltip-bg)', 
                      color: 'var(--tooltip-text)' 
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Solde']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#3b82f6" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    animationDuration={2000}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Financial Health - Small Bento Item */}
        {isVisible('financial_health') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white"
          >
            <h3 className="text-lg font-bold mb-1">Santé Financière</h3>
            <p className="text-xs text-slate-400 mb-6">Indicateurs clés de solvabilité</p>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Ratio de Liquidité</span>
                  <span className="text-brand-green font-bold">Excellent</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-green w-[85%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Marge Nette</span>
                  <span className="text-brand-gold font-bold">18.5%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-gold w-[65%]" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-brand-green/10 rounded-lg">
                    <TrendingUp size={16} className="text-brand-green" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fonds de Roulement</p>
                    <p className="text-sm font-bold">{formatCurrency(stats.cash + stats.receivables - stats.payables)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <AlertCircle size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Dettes à Court Terme</p>
                    <p className="text-sm font-bold">{formatCurrency(stats.payables)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Expenses Breakdown - Editorial List */}
        {isVisible('expenses') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="lg:col-span-2 premium-card p-8"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Dépenses</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Répartition par poste</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <PieChart size={24} className="text-slate-400 dark:text-slate-500" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={breakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      animationDuration={2000}
                    >
                      {breakdownData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            index === 0 ? "var(--color-brand-green)" :
                            index === 1 ? "var(--color-brand-gold)" :
                            index === 2 ? "#3b82f6" :
                            index === 3 ? "#8b5cf6" : "#f43f5e"
                          } 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                        padding: '20px',
                        backgroundColor: 'var(--tooltip-bg)',
                        color: 'var(--tooltip-text)'
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-6">
                {breakdownData.map((item: any, idx) => (
                  <div key={idx} className="group cursor-pointer">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          idx === 0 ? "bg-brand-green" :
                          idx === 1 ? "bg-brand-gold" :
                          idx === 2 ? "bg-blue-500" :
                          idx === 3 ? "bg-violet-500" : "bg-rose-500"
                        )} />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-green transition-colors">{item.name}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / stats.expenses) * 100}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          idx === 0 ? "bg-brand-green" :
                          idx === 1 ? "bg-brand-gold" :
                          idx === 2 ? "bg-blue-500" :
                          idx === 3 ? "bg-violet-500" : "bg-rose-500"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Recent Activity - Editorial List */}
        {isVisible('activity') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="lg:col-span-2 premium-card p-8"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Activité</h3>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-green/10 text-brand-green text-[9px] font-black uppercase tracking-widest rounded-md border border-brand-green/20">
                    <span className="w-1 h-1 rounded-full bg-brand-green animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Flux financiers récents</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:rotate-12 transition-transform duration-500">
                <HistoryIcon size={24} className="text-slate-400 dark:text-slate-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {recentTransactions.map((tx: any, idx: number) => (
                  <motion.div 
                    key={tx.id} 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between group/item transition-all duration-300 border border-transparent hover:border-slate-100 dark:hover:border-white/10"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/item:bg-brand-green/10 group-hover/item:text-brand-green transition-all duration-500 shadow-sm">
                        <FileText size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight mb-1 group-hover/item:text-brand-green transition-colors truncate" title={tx.description}>{tx.description}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">{tx.date}</p>
                          <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">ID: {tx.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-display">{formatCurrency(tx.amount)}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                        <p className="text-[10px] font-black text-brand-green uppercase tracking-[0.2em]">Traité</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <button 
              onClick={() => navigate('/journal')}
              className="mt-8 w-full py-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] hover:border-brand-green hover:text-brand-green hover:bg-brand-green/5 transition-all duration-500 flex items-center justify-center gap-3 group/btn"
            >
              Consulter le Grand Livre
              <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}

        {/* NEW: Strategic Analysis Section */}
        {isVisible('analysis') && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Net Margin Trend */}
            <div className="lg:col-span-2 premium-card p-8">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Marge Nette</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Évolution de la rentabilité (%)</p>
                </div>
                <div className="p-4 bg-brand-green/10 text-brand-green rounded-2xl">
                  <Activity size={24} />
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.map(d => ({
                    ...d,
                    margin: d.ca > 0 ? parseFloat(((d.ca - d.charges) / d.ca * 100).toFixed(1)) : 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-800" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                      className="text-slate-400 dark:text-slate-500"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                      className="text-slate-400 dark:text-slate-500"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip 
                      cursor={{fill: 'var(--color-brand-green)', opacity: 0.05}}
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                        padding: '20px',
                        backgroundColor: 'var(--tooltip-bg)',
                        color: 'var(--tooltip-text)'
                      }}
                      formatter={(value: number) => [`${value}%`, 'Marge Nette']}
                    />
                    <Bar 
                      dataKey="margin" 
                      fill="var(--color-brand-green)" 
                      radius={[10, 10, 0, 0]} 
                      animationDuration={2000}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.ca - entry.charges >= 0 ? 'var(--color-brand-green)' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Financial Ratios Radar */}
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl text-white group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_var(--color-brand-gold)_0%,_transparent_50%)] opacity-10 group-hover:opacity-20 transition-opacity duration-700" />
              
              <div className="flex items-center justify-between mb-12 relative z-10">
                <div>
                  <h3 className="text-3xl font-black tracking-tight font-display">Équilibre</h3>
                  <p className="text-sm text-slate-400 font-medium">Radar des ratios clés</p>
                </div>
                <div className="p-5 bg-brand-gold/20 text-brand-gold rounded-3xl backdrop-blur-xl border border-brand-gold/20">
                  <BarChart3 size={28} />
                </div>
              </div>
              <div className="h-[320px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                    { subject: 'Liquidité', A: ratios.currentRatio * 40, fullMark: 100 },
                    { subject: 'Marge', A: ratios.netMargin, fullMark: 100 },
                    { subject: 'Solvabilité', A: ratios.solvency * 40, fullMark: 100 },
                    { subject: 'ROI', A: ratios.roi, fullMark: 100 },
                    { subject: 'Trésorerie', A: Math.min(100, (stats.cash / (stats.turnover || 1)) * 100), fullMark: 100 }
                  ]}>
                    <PolarGrid stroke="#334155" strokeDasharray="5 5" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Ratios"
                      dataKey="A"
                      stroke="var(--color-brand-green)"
                      strokeWidth={3}
                      fill="var(--color-brand-green)"
                      fillOpacity={0.4}
                      animationDuration={2500}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(12px)',
                        color: '#f8fafc',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-6 relative z-10">
                <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md group/stat hover:bg-white/10 transition-all duration-500 min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 group-hover/stat:text-brand-green transition-colors truncate">ROI</div>
                  <div className="text-2xl sm:text-3xl font-black text-brand-green font-display truncate">{ratios.roi}%</div>
                </div>
                <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md group/stat hover:bg-white/10 transition-all duration-500 min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 group-hover/stat:text-brand-gold transition-colors truncate">Solvabilité</div>
                  <div className="text-2xl sm:text-3xl font-black text-brand-gold font-display truncate">{ratios.solvency}</div>
                </div>
              </div>
            </div>
            {/* Budget vs Actual Comparison */}
            <div className="lg:col-span-4 premium-card p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display">Budget vs Réel</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Suivi de la performance budgétaire par catégorie</p>
                </div>
                <div className="p-4 bg-brand-gold/10 text-brand-gold rounded-2xl">
                  <Target size={24} />
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsActual} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis 
                      dataKey="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                      className="text-slate-400 dark:text-slate-500"
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: 'currentColor', fontSize: 10, fontWeight: 700}} 
                      className="text-slate-400 dark:text-slate-500"
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      cursor={{fill: 'var(--color-brand-green)', opacity: 0.05}}
                      contentStyle={{ 
                        borderRadius: '24px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                        padding: '20px',
                        backgroundColor: 'var(--tooltip-bg)',
                        color: 'var(--tooltip-text)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    />
                    <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actual" name="Réel" fill="var(--color-brand-green)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <DashboardCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        widgets={widgets}
        onToggleWidget={toggleWidget}
        onReset={resetWidgets}
      />
    </div>
  );
}
