import { parseSafeJSON } from "../lib/utils";
import React, { useEffect, useState, useRef } from 'react';
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
  Activity, BarChart3, PieChart, Settings as SettingsIcon, Check, Calculator, Shield, Briefcase, Building2,
  ShoppingBag, ShieldCheck, Brain, Sparkles, Zap, Mic, MicOff, Repeat, Percent, ExternalLink, Download, Maximize2, Minimize2
} from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { useLanguage } from '@/context/LanguageContext';
import { apiFetch } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

import { useNavigate, useOutletContext } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/exportUtils';
import { DashboardCustomizer, type WidgetConfig } from './DashboardCustomizer';
import { getQuickInsight, parseNaturalLanguageEntry, generateComprehensiveDashboardReport } from '../services/geminiService';
import Markdown from 'react-markdown';
import { useModules } from '@/context/ModuleContext';
import { useDialog } from './DialogProvider';

export function Dashboard() {
  const { formatCurrency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const { t } = useLanguage();
  const { isActive } = useModules();
  const { companySettings } = useOutletContext<any>();
  const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;
  const { alert: showToast } = useDialog();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    turnover: 0,
    expenses: 0,
    net_result: 0,
    cash: 0,
    receivables: 0,
    payables: 0,
    payroll: {
      total: 0,
      employees: 0,
      lastPeriod: null as string | null
    },
    trends: {
      cash: 0,
      turnover: 0,
      receivables: 0,
      payables: 0,
      net_result: 0,
      payroll: 0
    },
    kpis: {
      grossMargin: 64.2,
      ebitda: 0,
      breakEvenStatus: "J-142",
      breakEvenSublabel: "Atteint le 22 Mai",
      investmentCapacity: 0,
      fixedExpenses: 0,
      seuilRentabilite: 0
    }
  });
  const [chartData, setChartData] = useState([]);
  const [cashflowData, setCashflowData] = useState([]);
  const [breakdownData, setBreakdownData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [budgetVsActual, setBudgetVsActual] = useState([]);
  const [ratios, setRatios] = useState({ currentRatio: 0, netMargin: 0, solvency: 0, roi: 0 });
  const [loading, setLoading] = useState(true);
  const [assetStats, setAssetStats] = useState({ totalValue: 0, totalAccumulatedDep: 0, netBookValue: 0, count: 0 });
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [quickEntry, setQuickEntry] = useState('');
  const [processingQuickEntry, setProcessingQuickEntry] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingRecurringCount, setPendingRecurringCount] = useState(0);
  const [deadlines, setDeadlines] = useState<{tasks: any[], invoices: any[]}>({ tasks: [], invoices: [] });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [isPdfConfigOpen, setIsPdfConfigOpen] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({
    title: 'Rapport Tableau de Bord',
    headerText: '',
    footerText: 'Généré par OryCompta - Confidentiel'
  });

  const [maximizedWidget, setMaximizedWidget] = useState<string | null>(null);

  const maxClasses = (id: string) => maximizedWidget === id 
    ? "fixed inset-0 sm:inset-4 md:inset-8 z-[100] m-0 !max-w-none !col-span-full shadow-2xl overflow-y-auto !bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800 " + (id !== 'health' && id !== 'performance' ? "!rounded-[2.5rem]" : "")
    : "";

  const MaximizeButton = ({ id }: { id: string }) => (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMaximizedWidget(maximizedWidget === id ? null : id); }}
      className="absolute top-4 right-4 p-2 sm:p-2.5 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-300 z-[110] opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 shadow-sm backdrop-blur-md"
      aria-label="Plein écran"
      title="Plein écran"
    >
      {maximizedWidget === id ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );


  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      showToast("La reconnaissance vocale n'est pas supportée par votre navigateur.", 'error');
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuickEntry(transcript);
      // Wait for state update then submit
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as any;
        handleQuickEntry(fakeEvent, transcript);
      }, 500);
    };

    recognition.start();
  };

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('dashboard_widgets');
    if (saved) {
      try {
        return parseSafeJSON(saved);
      } catch (e) {
        console.error("Error parsing dashboard widgets", e);
      }
    }
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
      { id: 'payroll_summary', label: 'Résumé RH', visible: true },
      { id: 'asset_summary', label: 'Immobilisations', visible: true },
      { id: 'performance_ratios', label: 'Performance & Ratios', visible: true },
      { id: 'recent_audit_logs', label: 'Modifications Récentes (Audit)', visible: true },
    ];
  });

  const generateFullReport = async () => {
    setIsReportModalOpen(true);
    setGeneratingReport(true);
    try {
      const report = await generateComprehensiveDashboardReport({
        stats,
        ratios,
        assetStats,
        deadlines
      });
      setReportContent(report);
    } catch (e) {
      console.error(e);
      setReportContent("Une erreur est survenue lors de la génération du rapport.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const isVisible = (id: string) => {
    // Determine module restriction
    const requiresAnalytics = ['performance', 'analysis', 'performance_ratios', 'cashflow', 'expenses', 'financial_health', 'health'];
    const requiresPayroll = ['payroll_summary'];
    const requiresAssets = ['asset_summary'];
    const requiresAudit = ['recent_audit_logs'];

    if (requiresAnalytics.includes(id) && !isActive('analytics')) return false;
    if (requiresPayroll.includes(id) && !isActive('payroll')) return false;
    if (requiresAssets.includes(id) && !isActive('assets')) return false;
    if (requiresAudit.includes(id) && !isActive('audit')) return false;

    return widgets.find(w => w.id === id)?.visible ?? true;
  };

  const getGroupOrder = (ids: string[]) => {
    const indices = ids.map(id => widgets.findIndex(w => w.id === id)).filter(i => i !== -1);
    return indices.length > 0 ? Math.min(...indices) : 99;
  };

  const toggleWidget = (id: string) => {
    setWidgets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      localStorage.setItem('dashboard_widgets', JSON.stringify(updated));
      return updated;
    });
  };

  const handleReorderWidgets = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('dashboard_widgets', JSON.stringify(newWidgets));
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
    let isMounted = true;
    const cacheKey = `dashboard_cache_${activeYear?.id || 'all'}`;

    const loadCache = () => {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        try {
          const cached = parseSafeJSON(saved);
          if (cached) {
            if (cached.stats) setStats(cached.stats);
            if (cached.chartData) setChartData(cached.chartData);
            if (cached.cashflowData) setCashflowData(cached.cashflowData);
            if (cached.breakdownData) setBreakdownData(cached.breakdownData);
            if (cached.recentTransactions) setRecentTransactions(cached.recentTransactions);
            if (cached.auditLogs) setAuditLogs(cached.auditLogs);
            if (cached.budgetVsActual) setBudgetVsActual(cached.budgetVsActual);
            if (cached.ratios) setRatios(cached.ratios);
            if (cached.assetStats) setAssetStats(cached.assetStats);
            if (cached.pendingRecurringCount !== undefined) setPendingRecurringCount(cached.pendingRecurringCount);
            setLoading(false);
          }
        } catch (e) {
          console.error("Failed to parse dashboard cache", e);
        }
      } else {
        setLoading(true);
      }
    };

    const fetchData = async () => {
      try {
        const [statsRes, chartsRes, cashflowRes, breakdownRes, recentRes, budgetRes, ratiosRes, assetStatsRes, auditRes, recurringRes, deadlinesRes] = await Promise.all([
          apiFetch('/api/dashboard/stats'),
          apiFetch('/api/dashboard/charts'),
          apiFetch('/api/dashboard/cashflow-forecast'),
          apiFetch('/api/dashboard/breakdown'),
          apiFetch('/api/dashboard/recent'),
          apiFetch('/api/dashboard/budget-vs-actual'),
          apiFetch('/api/dashboard/ratios'),
          apiFetch('/api/assets/stats'),
          apiFetch('/api/audit-logs?limit=5'),
          apiFetch('/api/recurring-transactions/due-count'),
          apiFetch('/api/dashboard/deadlines?days=7')
        ]);
        
        const responses = [statsRes, chartsRes, cashflowRes, breakdownRes, recentRes, budgetRes, ratiosRes, assetStatsRes, auditRes, recurringRes, deadlinesRes];
        const allOk = responses.every(r => r.ok);
        
        if (!allOk) {
          const failedRes = responses.find(r => !r.ok);
          const text = await failedRes?.text();
          console.error("Dashboard fetch failed:", text || failedRes?.statusText);
          if (isMounted) setLoading(false);
          return;
        }

        const [statsData, chartsData, cfData, bData, recentData, budgetData, ratiosData, assetStatsData, auditData, recurringData, deadlinesData] = await Promise.all(
          responses.map(r => r.json())
        );
        
        if (!isMounted) return;

        setStats(statsData);
        setChartData(chartsData);
        setCashflowData(cfData);
        setBreakdownData(bData);
        setRecentTransactions(recentData);
        setAuditLogs(auditData.logs || auditData || []);
        setBudgetVsActual(budgetData);
        setRatios(ratiosData);
        setAssetStats(assetStatsData);
        setPendingRecurringCount(recurringData.count || 0);
        setDeadlines(deadlinesData || { tasks: [], invoices: [] });
        
        if (deadlinesData && (deadlinesData.tasks?.length > 0 || deadlinesData.invoices?.length > 0)) {
          const totalDeadlines = (deadlinesData.tasks?.length || 0) + (deadlinesData.invoices?.length || 0);
          if (!sessionStorage.getItem('deadlinesToastShown')) {
            setTimeout(() => {
              showToast(`${totalDeadlines} échéance(s) comptable(s) dans les 7 prochains jours.`, 'info');
            }, 1000);
            sessionStorage.setItem('deadlinesToastShown', 'true');
          }
        }
        
        setLoading(false);

        // Update local cache
        try {
          const cacheToSave = {
            stats: statsData,
            chartData: chartsData,
            cashflowData: cfData,
            breakdownData: bData,
            recentTransactions: recentData,
            auditLogs: auditData.logs || auditData || [],
            budgetVsActual: budgetData,
            ratios: ratiosData,
            assetStats: assetStatsData,
            pendingRecurringCount: recurringData.count || 0
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheToSave));
        } catch (e) {
          console.error("Failed to save dashboard cache", e);
        }

        // Fetch AI insight with more context, using a cache
        const insightCacheKey = `insight_${activeYear?.id}`;
        const cached = localStorage.getItem(insightCacheKey);
        const cacheTime = localStorage.getItem(`${insightCacheKey}_time`);
        
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 12 * 60 * 60 * 1000) {
           setAiInsight(cached);
        } else {
           fetchInsight({
             turnover: statsData.turnover,
             expenses: statsData.expenses,
             cash: statsData.cash,
             receivables: statsData.receivables,
             payables: statsData.payables,
             ratios: ratiosData,
             period: activeYear?.name || 'en cours'
           });
        }
      } catch (err) {
        console.error("Dashboard background fetch error:", err);
        if (isMounted) setLoading(false);
      }
    };
    
    // Load cache instantly, then fetch fresh data silently in the background
    loadCache();
    fetchData();

    return () => {
      isMounted = false;
    };
  }, [activeYear?.id]);

  const fetchInsight = async (data: any) => {
    setLoadingInsight(true);
    try {
      const insight = await getQuickInsight(data);
      if (insight) {
        setAiInsight(insight);
        localStorage.setItem(`insight_${activeYear?.id}`, insight);
        localStorage.setItem(`insight_${activeYear?.id}_time`, Date.now().toString());
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

  const handleGeneratePdf = async () => {
    try {
      const res = await apiFetch('/api/company/settings');
      let companySettings = { name: 'OryCompta' };
      if (res.ok) {
        companySettings = await res.json();
      }

      const utils = await import('../lib/exportUtils');
      const dataToExport = {
        ...stats,
        kpis: stats.kpis,
        ratios: ratios,
        cashflowData: cashflowData,
        receivables: stats.receivables,
        payables: stats.payables
      };

      utils.generateCustomDashboardPDF(dataToExport, pdfConfig, companySettings as any);
      setIsPdfConfigOpen(false);
    } catch (err) {
      console.error("Failed to generate custom PDF", err);
    }
  };

  const handleQuickEntry = async (e: React.FormEvent, manualValue?: string) => {
    if (e) e.preventDefault();
    const entryValue = manualValue || quickEntry;
    if (!entryValue.trim() || processingQuickEntry) return;
    
    setProcessingQuickEntry(true);
    try {
      const parsed = await parseNaturalLanguageEntry(entryValue);
      if (parsed) {
        // Redirect to journal with prefilled data or show a small confirmation
        navigate('/journal', { state: { prefilled: parsed } });
      }
    } catch (err) {
      console.error("Quick entry failed:", err);
    } finally {
      setProcessingQuickEntry(false);
    }
  };

  const StatCard = ({ title, value, trend, trendValue, icon: Icon, color, delay, path, whiteTrend, colSpan = "col-span-1", style, id }: any) => (
    <motion.div 
      style={style}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => path && navigate(path)}
      className={cn(
        "group relative overflow-hidden backdrop-blur-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgb(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1.5 h-full min-h-[160px] sm:min-h-[190px]",
        colSpan,
        path ? "cursor-pointer" : ""
      , maxClasses(id))}
    >
      {id && <MaximizeButton id={id} />}
      {/* Dynamic Background Glow */}
      <div className={cn(
        "absolute -bottom-24 -right-24 w-64 h-64 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-10 dark:group-hover:opacity-20 pointer-events-none",
        color
      )} />
      
      {/* Light Reflection */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="p-6 sm:p-7 flex flex-col h-full z-10 space-y-6">
        <div className="flex justify-between items-start w-full">
          <div className={cn(
            "w-14 h-14 rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 flex items-center justify-center shrink-0 border border-white/20 shadow-md relative overflow-hidden",
            color,
            "text-white"
          )}>
            <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
            <Icon size={26} className="relative z-10 group-hover:animate-pulse" strokeWidth={2.5} />
          </div>

          {trend && (
            <div className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-all duration-300",
              whiteTrend 
                ? "bg-white text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700" 
                : (trend === 'up' 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                  : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"),
            )}>
              {trend === 'up' ? <ArrowUpRight size={14} strokeWidth={3} /> : <ArrowDownRight size={14} strokeWidth={3} />}
              {trendValue}
            </div>
          )}
        </div>
        
        <div className="space-y-2 mt-auto">
          <h3 className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] font-semibold uppercase tracking-[0.15em] opacity-80 group-hover:opacity-100 transition-opacity">
            {title}
          </h3>
          <div className="text-3xl sm:text-[36px] font-black text-slate-900 dark:text-white tracking-tight leading-none group-hover:scale-[1.02] origin-left transition-transform duration-300">
            {loading ? (
              <div className="h-10 w-2/3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            ) : (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: delay + 0.1 }}
                className="font-mono"
              >
                {formatCurrency(value)}
              </motion.span>
            )}
          </div>
        </div>
      </div>
      
      {/* Decorative Bottom Line (Hidden statically, slides in on hover) */}
      <div className={cn(
        "absolute bottom-0 left-0 h-1.5 w-full -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out",
        color
      )} />
      
      {/* Hover action indicator */}
      {path && (
        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-brand-green">
            <ChevronRight size={16} strokeWidth={3} />
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-10 pb-24 relative">
      <div className="atmospheric-bg" />
      
      {/* Pending Recurring Transactions Alert */}
      <AnimatePresence>
        {pendingRecurringCount > 0 && (
          <motion.div
            style={{ order: -3 }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={() => navigate('/recurring')}
            className="cursor-pointer bg-brand-green/10 border border-brand-green/20 p-4 rounded-2xl flex items-center justify-between group hover:bg-brand-green/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-green text-white rounded-xl shadow-lg shadow-brand-green/30">
                <Repeat size={18} className="animate-spin-slow" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {pendingRecurringCount} {pendingRecurringCount === 1 ? 'écriture récurrente est' : 'écritures récurrentes sont'} en attente
                </p>
                <p className="text-xs text-slate-500">Cliquez pour les traiter maintenant et automatiser votre comptabilité.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-brand-green font-black uppercase text-[10px] tracking-widest">
              Gérer <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial Header - Recipe 2 & 11 inspired */}
      <div className="relative pt-12 pb-16 overflow-hidden" style={{ order: -2 }}>
        <div className="absolute top-0 right-0 w-2/3 h-full bg-[radial-gradient(circle_at_right,_rgba(16,185,129,0.05)_0%,_transparent_70%)] pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
          <div className="space-y-8 max-w-4xl">
            <div className="flex items-center gap-6 animate-in fade-in slide-in-from-left-4 duration-700">
              <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-slate-200 dark:border-slate-700">
                Ory Intelligence v4.0
              </span>
              <div className="flex items-center gap-2 text-brand-green">
                <div className="w-2 h-2 rounded-full bg-current animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Système Opérationnel</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-8xl md:text-[120px] font-black text-slate-900 dark:text-slate-100 tracking-[-0.05em] leading-[0.85] uppercase animate-in fade-in slide-in-from-bottom-4 duration-1000">
                Tableau de <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-emerald-500 drop-shadow-sm font-bold text-[102px] text-center not-italic">Bord</span>
              </h1>
              <div className="flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                <div className="h-px w-24 bg-brand-green/30" />
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] whitespace-nowrap">Gestion Intelligence & Croissance</p>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
            
            <div className="text-2xl text-slate-500 dark:text-slate-400 font-medium leading-tight max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              Transformez vos données comptables en <span className="text-slate-900 dark:text-slate-100 font-black relative inline-block">
                levier stratégique
                <motion.span 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: 1, duration: 1.5 }}
                  className="absolute -bottom-1 left-0 h-1 bg-brand-green/20 rounded-full"
                />
              </span>.
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-right-4 duration-1000 delay-500">
            <button 
              onClick={generateFullReport}
              className="group bg-brand-gold text-white px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-gold-light transition-all duration-500 shadow-2xl shadow-brand-gold/30 flex items-center gap-3 active:scale-95"
            >
              <Sparkles size={18} className="group-hover:rotate-12 transition-transform duration-500" />
              <span>Rapport IA Exécutif</span>
            </button>
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
              <span>Exporter EXCEL</span>
            </button>
            <button 
              onClick={() => setIsPdfConfigOpen(true)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-8 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 dark:hover:bg-slate-800 hover:text-white transition-all duration-500 shadow-sm flex items-center gap-4 active:scale-95"
            >
              <FileText size={18} className="group-hover:rotate-12 transition-transform duration-500" />
              <span>Rapport PDF</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start" style={{ order: -1 }}>
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {[
            { label: 'Journal', icon: Calculator, path: '/journal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Tiers', icon: Users, path: '/third-parties', color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
            { label: 'Trésorerie', icon: Wallet, path: '/treasury', color: 'text-brand-green', bg: 'bg-brand-green/10' },
            { label: 'Factures', icon: FileText, path: '/invoicing', color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Paie & RH', icon: Users, path: '/payroll', color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ...(taxesEnabled ? [{ label: 'TVA', icon: Percent, path: '/vat', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }] : []),
            { label: 'Actifs', icon: Building2, path: '/assets', color: 'text-rose-500', bg: 'bg-rose-500/10' },
            { label: 'Audit', icon: ShieldCheck, path: '/audit', color: 'text-slate-500', bg: 'bg-slate-500/10' },
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors text-center">{item.label}</span>
            </motion.button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[160px]"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-brand-green/10 text-brand-green flex items-center justify-center">
              <Zap size={16} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saisie Rapide IA</h3>
          </div>
          <form onSubmit={handleQuickEntry} className="space-y-3">
            <div className="relative">
              <input 
                type="text"
                value={quickEntry}
                onChange={(e) => setQuickEntry(e.target.value)}
                placeholder="Ex: Payé 50k loyer hier..."
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green/20"
              />
              <button
                type="button"
                onClick={startListening}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
                  isListening ? "text-red-500 animate-pulse bg-red-50" : "text-slate-400 hover:text-brand-green hover:bg-slate-100"
                )}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>
            <button 
              type="submit"
              disabled={processingQuickEntry || !quickEntry}
              className="w-full py-2.5 bg-brand-green hover:bg-brand-green-dark text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            >
              {processingQuickEntry ? "Analyse..." : "Générer l'écriture"}
            </button>
          </form>
        </motion.div>
      </div>

      {/* AI Strategic Advisor - Futuristic Bento Head */}
      {isVisible('analysis') && (
          <motion.div 
          style={{ order: getGroupOrder(['analysis']) }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn("bg-slate-900 border border-white/5 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-brand-green/10", maxClasses('analysis'))}>
            <MaximizeButton id="analysis" />
          {/* Glowing Ambient Effects */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-green/10 rounded-full blur-[140px] -mr-64 -mt-64 animate-pulse duration-[8000ms]" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-green/5 rounded-full blur-[100px] -ml-40 -mb-40" />
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-12 items-center">
            <div className="relative shrink-0">
              <div className="w-28 h-28 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-center border border-white/10 group-hover:scale-105 group-hover:rotate-6 transition-all duration-700 shadow-2xl">
                <Brain className="text-brand-green" size={56} />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-green rounded-full flex items-center justify-center shadow-lg border-4 border-slate-900 text-slate-950">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left space-y-6">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <span className="px-4 py-1.5 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-brand-green/20 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                  Ory Stratégie PRO v4.2
                </span>
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest hidden sm:inline">Analyse Systémique OHADA</span>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl sm:text-6xl font-black tracking-tighter font-display leading-[0.85] uppercase">
                  Analyse <span className="text-brand-green italic">Prédictive</span>
                </h2>
                <div className="relative">
                  <p className={cn(
                    "text-xl sm:text-2xl text-slate-300 font-medium leading-relaxed max-w-4xl border-l-[3px] border-brand-green pl-8 py-2",
                    loadingInsight && "animate-pulse"
                  )}>
                    {loadingInsight ? "Ory déchiffre vos flux..." : (aiInsight || "Je constate une augmentation de 14% de vos marges opérationnelles ce mois-ci. Attention : vos créances clients à plus de 60 jours dépassent le seuil critique de 5 millions FCFA.")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-4 shrink-0 w-full lg:w-auto">
              <button 
                onClick={() => navigate('/financial-auditor')}
                className="px-10 py-5 bg-brand-green hover:bg-brand-green-light text-slate-950 font-black rounded-[1.5rem] transition-all shadow-xl shadow-brand-green/20 text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 group/btn"
              >
                <Target size={22} className="group-hover/btn:scale-110 transition-transform" />
                Audit Strategique
              </button>
              <button 
                onClick={() => navigate('/assistant')}
                className="px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-[1.5rem] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 backdrop-blur-md active:scale-95"
              >
                <MessageSquareText size={22} />
                Conseil IA
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-12 pt-10 border-t border-white/5 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: 'Fiabilité Analyse', value: '98.8%', icon: ShieldCheck, color: 'text-brand-green' },
              { label: 'Flux Prévus', value: `+${(stats.turnover * 0.15 / 1000).toFixed(1)}M FCFA`, icon: TrendingUp, color: 'text-indigo-400' },
              { label: 'Indice de Risque', value: 'Modéré', icon: AlertCircle, color: 'text-amber-400' },
              { label: 'Cash Runway', value: `${cashRunway} Mois`, icon: HistoryIcon, color: 'text-brand-gold' }
            ].map((metric, i) => (
              <div key={i} className="flex items-center gap-4 group/metric">
                <div className={cn("w-12 h-12 rounded-2xl bg-white/5 border border-white/5 group-hover/metric:border-white/20 transition-colors flex items-center justify-center", metric.color)}>
                  <metric.icon size={24} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{metric.label}</div>
                  <div className="text-lg font-black text-white font-display">{metric.value}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Financial Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ order: getGroupOrder(['summary', 'investment']) }}>
        {isVisible('summary') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'summary') }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("lg:col-span-2 premium-card p-8 bg-gradient-to-br from-slate-900 to-slate-950 text-white relative overflow-hidden", maxClasses('summary'))}>
            <MaximizeButton id="summary" />
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
                  <p className="text-xl sm:text-2xl font-black font-display text-brand-green truncate">{stats.kpis.grossMargin}%</p>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green" style={{ width: `${stats.kpis.grossMargin}%` }} />
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">EBITDA</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-brand-gold truncate">{formatCurrency(stats.kpis.ebitda)}</p>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-gold" style={{ width: `${stats.turnover > 0 ? Math.min(100, Math.max(0, (stats.kpis.ebitda / stats.turnover) * 100)) : 28}%` }} />
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Point Mort</p>
                  <p className="text-xl sm:text-2xl font-black font-display text-white truncate">{stats.kpis.breakEvenStatus}</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase truncate">{stats.kpis.breakEvenSublabel}</p>
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
            style={{ order: widgets.findIndex(w => w.id === 'investment') }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("premium-card p-8 bg-brand-gold text-white flex flex-col justify-between relative overflow-hidden", maxClasses('investment'))}>
            <MaximizeButton id="investment" />
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(255,255,255,0.2)_0%,_transparent_50%)]" />
            <div className="relative z-10">
              <h3 className="text-lg font-black uppercase tracking-widest mb-2">Capacité d'Investissement</h3>
              <p className="text-sm opacity-80 font-medium leading-relaxed">Basé sur votre cash-flow actuel et vos engagements futurs.</p>
            </div>
            <div className="relative z-10 mt-8">
              <div className="text-4xl sm:text-5xl font-black font-display mb-2 truncate">{formatCurrency(stats.kpis.investmentCapacity)}</div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 truncate">Disponible pour nouveaux projets</p>
            </div>
            <button className="relative z-10 mt-8 w-full py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-xs font-black uppercase tracking-widest transition-all">
              Simuler un projet
            </button>
          </motion.div>
        )}
      </div>

      {/* Bento Grid Layout */}
      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 2xl:gap-8"
        style={{ order: getGroupOrder([
          'stats', 'quick_stats', 'health', 'tax_calendar', 'compliance', 
          'runway', 'advisor', 'shortcut', 'payroll_summary', 'performance', 
          'cashflow', 'financial_health', 'performance_ratios', 'expenses', 
          'asset_summary', 'activity', 'recent_audit_logs'
        ]) }}
      >
        {/* Main Stats */}
        {isVisible('stats') && (
          <>
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_cash"
              title="Trésorerie Disponible" 
              value={stats.cash} 
              trend={stats.trends.cash >= 0 ? "up" : "down"} 
              trendValue={(stats.trends.cash >= 0 ? "+" : "") + stats.trends.cash + "%"} 
              icon={Wallet} 
              color="bg-brand-green" 
              delay={0.1}
              path="/treasury"
              whiteTrend={true}
              colSpan="md:col-span-2 lg:col-span-2"
            />
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_turnover"
              title="Chiffre d'Affaires" 
              value={stats.turnover} 
              trend={stats.trends.turnover >= 0 ? "up" : "down"} 
              trendValue={(stats.trends.turnover >= 0 ? "+" : "") + stats.trends.turnover + "%"} 
              icon={TrendingUp} 
              color="bg-emerald-500" 
              delay={0.2}
              path="/journal"
              whiteTrend={true}
              colSpan="md:col-span-2 lg:col-span-2"
            />
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_receivables"
              title="Créances Clients" 
              value={stats.receivables} 
              trend={stats.trends.receivables >= 0 ? "up" : "down"} 
              trendValue={(stats.trends.receivables >= 0 ? "+" : "") + stats.trends.receivables + "%"} 
              icon={Users} 
              color="bg-brand-gold-dark" 
              delay={0.3}
              path="/third-parties"
              colSpan="col-span-1"
            />
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_payables"
              title="Dettes Fournisseurs" 
              value={stats.payables} 
              trend={stats.trends.payables >= 0 ? "up" : "down"} 
              trendValue={(stats.trends.payables >= 0 ? "+" : "") + stats.trends.payables + "%"} 
              icon={ArrowDownRight} 
              color="bg-rose-500" 
              delay={0.35}
              path="/third-parties"
              colSpan="col-span-1"
            />
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_net_result"
              title="Résultat Net" 
              value={stats.net_result} 
              trend={stats.trends.net_result >= 0 ? 'up' : 'down'} 
              trendValue={(stats.trends.net_result >= 0 ? "+" : "") + stats.trends.net_result + "%"} 
              icon={FileText} 
              color="bg-brand-gold" 
              delay={0.4}
              path="/financials"
              colSpan="md:col-span-2 lg:col-span-1"
            />
            <StatCard 
              style={{ order: widgets.findIndex(w => w.id === 'stats') }}
              id="stats_payroll"
              title="Masse Salariale" 
              value={stats.payroll.total} 
              trend={stats.trends.payroll >= 0 ? "up" : "down"} 
              trendValue={(stats.trends.payroll >= 0 ? "+" : "") + stats.trends.payroll + "%"} 
              icon={Briefcase} 
              color="bg-indigo-500" 
              delay={0.45}
              path="/payroll"
              colSpan="md:col-span-2 lg:col-span-1"
            />
          </>
        )}

        {/* Quick Stats Bar - New Feature */}
        {isVisible('quick_stats') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'quick_stats') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className={cn("lg:col-span-4 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-6 shadow-sm", maxClasses('quick_stats'))}>
            <MaximizeButton id="quick_stats" />
            <div className="w-full min-w-0 overflow-auto flex items-center gap-4 sm:gap-8 px-4  no-scrollbar pb-2 sm:pb-0">
              <div className="space-y-1 min-w-[120px] sm:min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Charges Fixes</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{formatCurrency(stats.kpis.fixedExpenses)}</p>
              </div>
              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1 min-w-[120px] sm:min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Seuil de Rentabilité</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{formatCurrency(stats.kpis.seuilRentabilite)}</p>
              </div>
              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1 min-w-[120px] sm:min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">Délai de Paiement</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">32 jours</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4 shrink-0 sm:mt-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Statut:</span>
              <span className="px-3 py-1 bg-brand-green/10 text-brand-green text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-green/20">À jour</span>
            </div>
          </motion.div>
        )}

        {/* Atmospheric Health Score - Large Bento Item */}
        {isVisible('health') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'health') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
             className={cn("lg:col-span-2 lg:row-span-2 bg-slate-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl group border border-white/5 flex flex-col justify-between min-h-[340px]", maxClasses('health'))}>
            <MaximizeButton id="health" />
            {/* Background Glow - Improved Symbiosis */}
            <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12)_0%,_transparent_50%)] opacity-30 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_80%,_rgba(197,160,89,0.08)_0%,_transparent_50%)] opacity-30 group-hover:opacity-40 transition-opacity duration-700" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.02)_0%,_transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Indice de Santé Financière</h3>
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
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-slate-900/50 flex items-center justify-center relative shadow-2xl">
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
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 group-hover:scale-125 transition-transform duration-700" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mt-10 sm:mt-12">
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
                    onClick={() => navigate('/assistant')}
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
            style={{ order: widgets.findIndex(w => w.id === 'tax_calendar') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className={cn("premium-card p-6 flex flex-col justify-between", maxClasses('tax_calendar'))}>
            <MaximizeButton id="tax_calendar" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Échéances (7J)</h3>
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <HistoryIcon size={16} />
              </div>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {(() => {
                const combined = [...(deadlines.tasks || []), ...(deadlines.invoices || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);
                if (combined.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex flex-col items-center justify-center mb-3 text-slate-300 dark:text-slate-600">
                        <Check size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Aucune échéance à venir</p>
                      <p className="text-[10px] text-slate-400 mt-1">Vous êtes à jour !</p>
                    </div>
                  );
                }
                return combined.map((d, i) => {
                  const date = new Date(d.date);
                  const monthName = date.toLocaleDateString('fr-FR', { month: 'short' }).substring(0, 4);
                  const day = date.getDate();
                  const isTask = d.type === 'task';
                  
                  return (
                    <div key={`${d.type}-${d.id}-${i}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col items-center justify-center w-10 h-10 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                        <span className={cn("text-[9px] font-black uppercase leading-none", isTask ? "text-amber-500" : "text-rose-500")}>{monthName}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none mt-0.5">{day}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={d.title}>{d.title}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{isTask ? 'Tâche' : 'Facture'}</p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <button onClick={() => navigate('/tasks')} className="mt-4 text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline text-center">Voir tout le calendrier</button>
          </motion.div>
        )}

        {/* Compliance Score Widget */}
        {isVisible('compliance') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'compliance') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className={cn("premium-card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950", maxClasses('compliance'))}>
            <MaximizeButton id="compliance" />
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
            style={{ order: widgets.findIndex(w => w.id === 'runway') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className={cn("premium-card p-6 flex flex-col justify-between", maxClasses('runway'))}>
            <MaximizeButton id="runway" />
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
            style={{ order: widgets.findIndex(w => w.id === 'advisor') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className={cn("bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white flex flex-col justify-between group", maxClasses('advisor'))}>
            <MaximizeButton id="advisor" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conseiller Ory</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchInsight({ turnover: stats.turnover, expenses: stats.expenses, cash: stats.cash })}
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
            style={{ order: widgets.findIndex(w => w.id === 'shortcut') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 }}
            className={cn("bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between", maxClasses('shortcut'))}>
            <MaximizeButton id="shortcut" />
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

        {isVisible('payroll_summary') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'payroll_summary') }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1 }}
            className={cn("premium-card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950", maxClasses('payroll_summary'))}>
            <MaximizeButton id="payroll_summary" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Résumé RH</h3>
              <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl">
                <Users size={16} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-slate-100 font-display">{stats.payroll.employees}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Salariés</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-brand-green font-display">{formatCurrency(stats.payroll.total)}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Masse Salariale</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Statut du Mois</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                    stats.payroll.lastPeriod === 'validated' ? "bg-brand-green/10 text-brand-green border border-brand-green/20" : "bg-brand-gold/10 text-brand-gold border border-brand-gold/20"
                  )}>
                    {stats.payroll.lastPeriod === 'validated' ? 'Payé' : stats.payroll.lastPeriod === 'draft' ? 'En cours' : 'Aucun'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => navigate('/payroll')}
              className="mt-4 text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline text-center"
            >
              Gérer la paie
            </button>
          </motion.div>
        )}

        {/* Performance Chart - Extra Large Bento Item */}
        {isVisible('performance') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'performance') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={cn("lg:col-span-2 premium-card p-8 relative overflow-hidden group", maxClasses('performance'))}>
            <MaximizeButton id="performance" />
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
            style={{ order: widgets.findIndex(w => w.id === 'cashflow') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className={cn("lg:col-span-4 premium-card p-8", maxClasses('cashflow'))}>
            <MaximizeButton id="cashflow" />
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
                    formatter={(value: number, name: string) => {
                      if (name === 'balance') return [formatCurrency(value), 'Solde Projeté'];
                      if (name === 'inflows') return [formatCurrency(value), 'Encaissement Prévu'];
                      if (name === 'outflows') return [formatCurrency(value), 'Décaissement Prévu'];
                      return [formatCurrency(value), name];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Bar dataKey="inflows" name="Encaissements" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} opacity={0.8} />
                  <Bar dataKey="outflows" name="Décaissements" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} opacity={0.8} />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    name="Solde Projeté"
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
            style={{ order: widgets.findIndex(w => w.id === 'financial_health') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={cn("bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl text-white", maxClasses('financial_health'))}>
            <MaximizeButton id="financial_health" />
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
        {isVisible('performance_ratios') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'performance_ratios') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className={cn("col-span-1 lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group", maxClasses('performance_ratios'))}>
            <MaximizeButton id="performance_ratios" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/5 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:bg-brand-green/10 transition-colors duration-1000" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-brand-green mb-2">
                  <div className="p-2 bg-brand-green/10 rounded-xl">
                    <Activity size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Analyse de Performance</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Ratios Financiers & Rentabilité</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Indicateurs de santé et de performance opérationnelle</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Global</p>
                  <p className={cn(
                    "text-3xl font-black font-display tracking-tighter",
                    healthScore > 70 ? "text-brand-green" : healthScore > 40 ? "text-amber-500" : "text-rose-500"
                  )}>
                    {healthScore}%
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center relative">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" />
                    <circle 
                      cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" 
                      strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * healthScore) / 100}
                      strokeLinecap="round"
                      className={cn(
                        "transition-all duration-1000",
                        healthScore > 70 ? "text-brand-green" : healthScore > 40 ? "text-amber-500" : "text-rose-500"
                      )}
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {/* Current Ratio */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                    <Wallet size={20} />
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                    ratios.currentRatio > 1.5 ? "bg-emerald-100 text-emerald-600" : ratios.currentRatio > 1 ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {ratios.currentRatio > 1.5 ? 'Optimal' : ratios.currentRatio > 1 ? 'Correct' : 'Risqué'}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ratio de Liquidité</p>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{ratios.currentRatio}</h4>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ratios.currentRatio * 33)}%` }}
                    className="h-full bg-blue-500 rounded-full"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Capacité à payer les dettes court terme</p>
              </div>

              {/* Net Margin */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                    <TrendingUp size={20} />
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                    ratios.netMargin > 15 ? "bg-emerald-100 text-emerald-600" : ratios.netMargin > 5 ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {ratios.netMargin > 15 ? 'Élevée' : ratios.netMargin > 5 ? 'Moyenne' : 'Faible'}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Marge Nette</p>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{ratios.netMargin}%</h4>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, ratios.netMargin * 2))}%` }}
                    className="h-full bg-brand-green rounded-full"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Rentabilité sur le chiffre d'affaires</p>
              </div>

              {/* Solvency */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-2xl">
                    <Shield size={20} />
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                    ratios.solvency > 1.5 ? "bg-emerald-100 text-emerald-600" : ratios.solvency > 1 ? "bg-blue-100 text-blue-600" : "bg-rose-100 text-rose-600"
                  )}>
                    {ratios.solvency > 1.5 ? 'Solide' : ratios.solvency > 1 ? 'Équilibrée' : 'Critique'}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Solvabilité</p>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{ratios.solvency}</h4>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ratios.solvency * 33)}%` }}
                    className="h-full bg-brand-gold rounded-full"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Capacité à couvrir les dettes totales</p>
              </div>

              {/* ROI */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700/50 space-y-4 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl">
                    <TrendingUp size={20} />
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                    ratios.roi > 20 ? "bg-emerald-100 text-emerald-600" : ratios.roi > 10 ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {ratios.roi > 20 ? 'Excellent' : ratios.roi > 10 ? 'Bon' : 'Modéré'}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ROI (Actifs)</p>
                  <h4 className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{ratios.roi}%</h4>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, ratios.roi * 2))}%` }}
                    className="h-full bg-purple-500 rounded-full"
                  />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Rendement des capitaux investis</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
              <div className="lg:col-span-2 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Liquidité', value: ratios.currentRatio, target: 1.5 },
                    { name: 'Solvabilité', value: ratios.solvency, target: 1.2 },
                    { name: 'Marge (%)', value: ratios.netMargin / 10, target: 1.5 },
                    { name: 'ROI (%)', value: ratios.roi / 10, target: 2.0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800">
                              <p className="text-[10px] font-black uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                              <p className="text-xl font-black">{payload[0].value}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={40}>
                      { [0, 1, 2, 3].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#c5a059', '#10b981', '#a855f7'][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Insights de Performance</h4>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Votre ratio de liquidité de <span className="font-bold text-slate-900 dark:text-white">{ratios.currentRatio}</span> indique une {ratios.currentRatio > 1 ? 'bonne' : 'faible'} capacité à honorer vos engagements immédiats.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green mt-1.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      La marge nette de <span className="font-bold text-slate-900 dark:text-white">{ratios.netMargin}%</span> est {ratios.netMargin > 10 ? 'supérieure' : 'inférieure'} à la moyenne du secteur (10%).
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Un ROI de <span className="font-bold text-slate-900 dark:text-white">{ratios.roi}%</span> démontre une {ratios.roi > 15 ? 'excellente' : 'optimisable'} utilisation de vos actifs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isVisible('expenses') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'expenses') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className={cn("lg:col-span-2 premium-card p-8", maxClasses('expenses'))}>
            <MaximizeButton id="expenses" />
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

        {isVisible('asset_summary') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'asset_summary') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("premium-card p-8 bg-gradient-to-br from-indigo-900 to-slate-900 text-white relative overflow-hidden group shadow-2xl shadow-indigo-500/10", maxClasses('asset_summary'))}>
            <MaximizeButton id="asset_summary" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-1000" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-indigo-400 mb-2">
                  <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/20 shadow-inner">
                    <Building2 size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Patrimoine Actif</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight font-display uppercase">Immobilisations</h3>
                <p className="text-indigo-300/60 font-medium text-xs">Valeur nette comptable du parc</p>
              </div>
              <p className="text-3xl font-black text-white">{assetStats.count}</p>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                  <p className="text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-1">Brut total</p>
                  <p className="text-sm font-bold text-white font-mono">{formatCurrency(assetStats.totalValue)}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                  <p className="text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-1">Amortissements</p>
                  <p className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(assetStats.totalAccumulatedDep)}</p>
                </div>
              </div>

              <div className="p-5 bg-indigo-500/20 rounded-3xl border border-indigo-500/30">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Valeur Nette (VNC)</p>
                    <p className="text-2xl font-black text-white font-mono">{formatCurrency(assetStats.netBookValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Amorti à</p>
                    <p className="text-sm font-black text-indigo-400">{assetStats.totalValue > 0 ? Math.round((assetStats.totalAccumulatedDep / assetStats.totalValue) * 100) : 0}%</p>
                  </div>
                </div>
                <div className="h-2 bg-indigo-950 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${assetStats.totalValue > 0 ? (assetStats.totalAccumulatedDep / assetStats.totalValue) * 100 : 0}%` }}
                    className="h-full bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                  />
                </div>
              </div>

              <button 
                onClick={() => navigate('/assets')}
                className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all hover:translate-y-[-2px] flex items-center justify-center gap-2 group"
              >
                Gérer les actifs
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Recent Activity - Editorial List */}
        <div className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isVisible('activity') && (
          <motion.div 
              style={{ order: widgets.findIndex(w => w.id === 'activity') }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className={cn("premium-card p-8 h-full", maxClasses('activity'))}>
            <MaximizeButton id="activity" />
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
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:rotate-12 transition-transform duration-500 shadow-inner">
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
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/item:bg-brand-green/10 group-hover/item:text-brand-green transition-all duration-500 shadow-sm border border-slate-100 dark:border-slate-700/50">
                          <FileText size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight mb-1 group-hover/item:text-brand-green transition-colors truncate" title={tx.description}>{tx.description}</p>
                          <div className="flex items-center gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">{tx.date}</p>
                            <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">ID: {String(tx.id || '').slice(0, 8)}</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate('/journal?search=' + encodeURIComponent(tx.id || tx.reference || '')); }}
                            className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-brand-green/20 hover:text-brand-green text-slate-500 rounded-lg transition-colors ml-2 shrink-0 hidden group-hover/item:flex items-center justify-center"
                            title="Voir la source"
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-display">{formatCurrency(tx.amount)}</p>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", tx.amount >= 0 ? "bg-brand-green" : "bg-rose-500")} />
                          <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", tx.amount >= 0 ? "text-brand-green" : "text-rose-500")}>
                            {tx.amount >= 0 ? 'Entrée' : 'Sortie'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              
              <button 
                onClick={() => navigate('/ledger')}
                className="mt-8 w-full py-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] hover:border-brand-green hover:text-brand-green hover:bg-brand-green/5 transition-all duration-500 flex items-center justify-center gap-3 group/btn"
              >
                Consulter le Grand Livre
                <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {isVisible('recent_audit_logs') && (
          <motion.div 
              style={{ order: widgets.findIndex(w => w.id === 'recent_audit_logs') }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className={cn("premium-card p-8 h-full bg-slate-50/30 dark:bg-slate-900/40", maxClasses('recent_audit_logs'))}>
            <MaximizeButton id="recent_audit_logs" />
              <div className="flex items-center justify-between mb-10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Piste d'Audit</h3>
                    <div className="p-1 px-2 bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-blue-500/20">Audit-Ready</div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Dernières modifications du système</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl shadow-inner text-blue-500">
                  <Shield size={24} />
                </div>
              </div>

              <div className="space-y-4">
                {auditLogs.slice(0, 5).map((log: any, idx: number) => (
                  <div key={log.id} className="flex gap-4 group/log">
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-white/10",
                        log.action === 'CREATE' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        log.action === 'UPDATE' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                        "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                      )}>
                        {log.action === 'CREATE' ? <Plus size={18} /> : log.action === 'UPDATE' ? <SettingsIcon size={18} /> : <AlertCircle size={18} />}
                      </div>
                      {idx < auditLogs.length - 1 && <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">{log.entity}: {log.action}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest tabular-nums">{new Date(log.date).toLocaleTimeString()}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none mb-2">Par <span className="font-bold text-slate-700 dark:text-slate-300">{log.user}</span></p>
                      <div className="bg-white/50 dark:bg-slate-800/30 p-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/50 inline-block">
                        <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500">REF: {log.entity_id || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => navigate('/audit')}
                className="mt-6 w-full py-4 bg-slate-900/5 dark:bg-white/5 rounded-2xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] hover:bg-slate-900 dark:hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 group/audit-btn"
              >
                <span>Journal d'audit complet</span>
                <Shield size={14} className="group-hover/audit-btn:rotate-12 transition-transform" />
              </button>
            </motion.div>
          )}
        </div>

        {/* NEW: Strategic Analysis Section */}
        {isVisible('analysis') && (
          <motion.div 
            style={{ order: widgets.findIndex(w => w.id === 'analysis') }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className={cn("lg:col-span-4 grid grid-cols-1 lg:grid-cols-3 gap-6", maxClasses('analysis'))}>
            <MaximizeButton id="analysis" />
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
        onReorder={handleReorderWidgets}
      />

      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsReportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-gold/20 rounded-2xl flex items-center justify-center text-brand-gold border border-brand-gold/30">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-display">Rapport IA Exécutif</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Analyse Financière Globale</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <Search size={20} className="hidden" /> {/* Temp */}
                  <span className="font-bold relative -top-[1px]">✕</span>
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto min-h-[300px] flex-1">
                {generatingReport ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-6">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-brand-gold rounded-full border-t-transparent animate-spin"></div>
                      <Sparkles size={24} className="absolute inset-0 m-auto text-brand-gold animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">Génération en cours</p>
                      <p className="text-sm font-medium text-slate-500 max-w-sm">Le Directeur Financier Virtuel analyse vos données, ratios et KPIs pour préparer la synthèse...</p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-display md:prose-lg prose-p:leading-relaxed prose-li:font-medium prose-strong:text-brand-gold">
                    <Markdown>{reportContent || "Impossible de charger le rapport."}</Markdown>
                  </div>
                )}
              </div>

              {!generatingReport && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
                  <button 
                    onClick={() => {
                       const element = document.createElement("a");
                       const file = new Blob([reportContent || ""], {type: 'text/markdown'});
                       element.href = URL.createObjectURL(file);
                       element.download = `rapport_executif_${new Date().toISOString().split('T')[0]}.md`;
                       document.body.appendChild(element);
                       element.click();
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    <Download size={18} />
                    Télécharger (.MD)
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isPdfConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsPdfConfigOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/30">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-display">Rapport PDF</h2>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Options d'exportation</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPdfConfigOpen(false)}
                  className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <span className="font-bold relative -top-[1px]">✕</span>
                </button>
              </div>

              <div className="p-6 sm:p-8 flex-1 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Titre du rapport
                  </label>
                  <input 
                    type="text" 
                    value={pdfConfig.title}
                    onChange={(e) => setPdfConfig(prev => ({...prev, title: e.target.value}))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green"
                    placeholder="Synthèse Financière..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    En-tête personnalisé (Optionnel)
                  </label>
                  <input 
                    type="text" 
                    value={pdfConfig.headerText}
                    onChange={(e) => setPdfConfig(prev => ({...prev, headerText: e.target.value}))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green"
                    placeholder="Ex: Réunion du comité de direction..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Pied de page personnalisé
                  </label>
                  <input 
                    type="text" 
                    value={pdfConfig.footerText}
                    onChange={(e) => setPdfConfig(prev => ({...prev, footerText: e.target.value}))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green"
                    placeholder="Texte du pied de page..."
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                <button 
                  onClick={() => setIsPdfConfigOpen(false)}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleGeneratePdf}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                >
                  <Download size={18} />
                  Générer PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {maximizedWidget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setMaximizedWidget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
