import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, Calendar, Filter, 
  FileSpreadsheet, Search, Settings2, AreaChart as AreaChartIcon, PieChart as PieChartIcon, 
  Activity, Sparkles, TrendingUp, TrendingDown, DollarSign, Brain, Info, CheckCircle2, RefreshCw, BarChart3, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { exportToCSV, exportToExcel, addPDFHeader, addPDFFooter } from '@/lib/exportUtils';
import { formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface FinancialRecord {
  account_code: string;
  account_name: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export function CustomReports() {
  const { formatCurrency } = useCurrency();
  const { activeYear } = useFiscalYear();
  
  const [reportType, setReportType] = useState<'balance-sheet' | 'profit-loss' | 'analytics' | 'cashflow'>('analytics');
  const [startDate, setStartDate] = useState(activeYear?.start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(activeYear?.end_date || new Date().toISOString().split('T')[0]);
  
  // Custom states
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [realPnlData, setRealPnlData] = useState<FinancialRecord[]>([]);
  const [realBsData, setRealBsData] = useState<FinancialRecord[]>([]);
  
  // AI Strategic commentary states
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Load actual database reports in background if available
  useEffect(() => {
    fetchRealDatabaseReports();
  }, [startDate, endDate, activeYear?.id]);

  const fetchRealDatabaseReports = async () => {
    try {
      // Fetch dynamic active records for P&L and Balance Sheet
      const [pnlRes, bsRes] = await Promise.all([
        apiFetch(`/api/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`),
        apiFetch(`/api/reports/balance-sheet?date=${endDate}`)
      ]);

      if (pnlRes.ok && bsRes.ok) {
        const pnl = await pnlRes.json();
        const bs = await bsRes.json();
        setRealPnlData(Array.isArray(pnl) ? pnl : []);
        setRealBsData(Array.isArray(bs) ? bs : []);
        
        // If there actually is live user data in the DB, automatically turn off Demo Mode
        if (pnl.length > 0 || bs.length > 0) {
          setDemoMode(false);
        }
      }
    } catch (e) {
      console.warn("Could not fetch real database reports. Defaulting strictly to demo simulation.", e);
    }
  };

  // Demo Mock Data Sets for a clean exploration experience
  const demoPnlData: FinancialRecord[] = [
    { account_code: '701100', account_name: "Ventes de Marchandises (UEMOA)", total_debit: 0, total_credit: 42500000, balance: 42500000 },
    { account_code: '706000', account_name: "Prestations de Services Web & SaaS", total_debit: 0, total_credit: 21800000, balance: 21800000 },
    { account_code: '708500', account_name: "Prestations d'Assistance & Formation", total_debit: 0, total_credit: 12500000, balance: 12500000 },
    { account_code: '601100', account_name: "Achats de Marchandises (Importations)", total_debit: 18500000, total_credit: 0, balance: 18500000 },
    { account_code: '602500', account_name: "Fournitures de Bureau & Consommables", total_debit: 2100000, total_credit: 0, balance: 2100000 },
    { account_code: '611000', account_name: "Transports de Marchandises", total_debit: 3200000, total_credit: 0, balance: 3200000 },
    { account_code: '622400', account_name: "Honoraires Experts & Conseils", total_debit: 4500000, total_credit: 0, balance: 4500000 },
    { account_code: '625100', account_name: "Déplacements, Missions & Voyages", total_debit: 1800000, total_credit: 0, balance: 1800000 },
    { account_code: '631100', account_name: "Impôts et Taxes Directs (Acompte)", total_debit: 2500000, total_credit: 0, balance: 2500000 },
    { account_code: '661100', account_name: "Rémunérations Nationales du Personnel", total_debit: 19800000, total_credit: 0, balance: 19800000 },
    { account_code: '664100', account_name: "Charges Sociales & IPRES/CSS", total_debit: 4200000, total_credit: 0, balance: 4200000 },
  ];

  const demoBsData: FinancialRecord[] = [
    { account_code: '101100', account_name: "Capital Social Souscrit pour Exercice", total_debit: 0, total_credit: 15000000, balance: -15000000 },
    { account_code: '120100', account_name: "Réserves Légales Nationales (UEMOA)", total_debit: 0, total_credit: 3200000, balance: -3200000 },
    { account_code: '162000', account_name: "Emprunts Spéciaux auprès d'Établissements", total_debit: 0, total_credit: 7500000, balance: -7500000 },
    { account_code: '241100', account_name: "Matériel Industriel & Outil de Bureau", total_debit: 12500000, total_credit: 0, balance: 12500000 },
    { account_code: '244000', account_name: "Matériel Informatique & Équipements", total_debit: 4500000, total_credit: 0, balance: 4500000 },
    { account_code: '311000', account_name: "Stocks Produits & Matières Premières", total_debit: 7400000, total_credit: 0, balance: 7400000 },
    { account_code: '401100', account_name: "Fournisseurs Locaux d'Exploitation", total_debit: 0, total_credit: 6800000, balance: -6800000 },
    { account_code: '411100', account_name: "Clients - Comptes de Tiers Ventes", total_debit: 9200000, total_credit: 0, balance: 9200000 },
    { account_code: '442100', account_name: "État - Impôt sur les Sociétés", total_debit: 0, total_credit: 3100000, balance: -3100000 },
    { account_code: '521100', account_name: "Banque SG de l'Afrique de l'Ouest", total_debit: 8300000, total_credit: 0, balance: 8300000 },
    { account_code: '571100', account_name: "Caisse Centrale d'Exploitation (XOF)", total_debit: 1200000, total_credit: 0, balance: 1200000 },
  ];

  const demoCashflowData = [
    { month: 'Jan', encaissable: 4500000, decaissable: 3100000, solde: 1400000 },
    { month: 'Fév', encaissable: 5200000, decaissable: 3800000, solde: 2800000 },
    { month: 'Mar', encaissable: 6100000, decaissable: 4200000, solde: 4700000 },
    { month: 'Avr', encaissable: 5800000, decaissable: 5000000, solde: 5500000 },
    { month: 'Mai', encaissable: 6900000, decaissable: 4600000, solde: 7800000 },
    { month: 'Juin', encaissable: 7500000, decaissable: 5100000, solde: 10200000 },
  ];

  // Active PNL Data Array
  const pnlSource = demoMode ? demoPnlData : realPnlData;
  const bsSource = demoMode ? demoBsData : realBsData;

  // Perform Calculations
  const calculatePnlMetrics = () => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const expenseBreakdown: { [category: string]: number } = {
      "Achats de marchandises": 0,
      "Logistique & Transports": 0,
      "Frais Généraux & Services": 0,
      "Impôts, Droits & Taxes": 0,
      "Personnel & Social": 0,
      "Autres Charges": 0
    };

    pnlSource.forEach(item => {
      if (item.account_code.startsWith('7')) {
        totalIncome += item.balance;
      } else if (item.account_code.startsWith('6')) {
        // Balance in P&L or db
        const amt = Math.abs(item.balance);
        totalExpenses += amt;

        if (item.account_code.startsWith('60')) {
          expenseBreakdown["Achats de marchandises"] += amt;
        } else if (item.account_code.startsWith('61')) {
          expenseBreakdown["Logistique & Transports"] += amt;
        } else if (item.account_code.startsWith('62')) {
          expenseBreakdown["Frais Généraux & Services"] += amt;
        } else if (item.account_code.startsWith('63')) {
          expenseBreakdown["Impôts, Droits & Taxes"] += amt;
        } else if (item.account_code.startsWith('66')) {
          expenseBreakdown["Personnel & Social"] += amt;
        } else {
          expenseBreakdown["Autres Charges"] += amt;
        }
      }
    });

    const netResultNum = totalIncome - totalExpenses;
    return {
      totalIncome,
      totalExpenses,
      netResultNum,
      expenseBreakdown
    };
  };

  const { totalIncome, totalExpenses, netResultNum, expenseBreakdown } = calculatePnlMetrics();

  // Balance Sheet Categories Grouping
  const calculateBsMetrics = () => {
    let totalActif = 0;
    let totalPassif = 0;

    const assetsList: { name: string, code: string, value: number }[] = [];
    const passifList: { name: string, code: string, value: number }[] = [];

    bsSource.forEach(item => {
      const code = item.account_code;
      const val = item.balance;

      if (code < '6') {
        const isAsset = code.startsWith('2') || code.startsWith('3') || code.startsWith('52') || code.startsWith('57') || code.startsWith('41');
        
        if (isAsset) {
          const actualVal = Math.abs(val);
          totalActif += actualVal;
          assetsList.push({ name: item.account_name, code, value: actualVal });
        } else {
          const actualVal = Math.abs(val);
          totalPassif += actualVal;
          passifList.push({ name: item.account_name, code, value: actualVal });
        }
      }
    });

    // To perfectly balance we must compute liabilities balancing item or display the actual net income
    const currentImbalances = totalActif - totalPassif;

    return {
      assetsList,
      passifList,
      totalActif,
      totalPassif,
      currentImbalances
    };
  };

  const { assetsList, passifList, totalActif, totalPassif, currentImbalances } = calculateBsMetrics();

  const handleStrategicAnalysis = async () => {
    setLoadingInsight(true);
    setAnalysisError(null);
    setAiInsight(null);

    const sheetContext = {
      demoMode,
      startDate,
      endDate,
      activeYear: activeYear?.name || "En Cours",
      metrics: {
        chiffre_affaires: totalIncome,
        total_charges: totalExpenses,
        resultat_net: netResultNum,
        total_actif: totalActif,
        total_passif: totalPassif,
        coherence_bilan: Math.abs(totalActif - totalPassif - currentImbalances) < 5 ? "Équilibré" : "Revue requise"
      },
      comptes_charges: pnlSource.filter(p => p.account_code.startsWith('6')),
      comptes_produits: pnlSource.filter(p => p.account_code.startsWith('7')),
      comptes_bilan_classes_1_5: bsSource
    };

    try {
      const prompt = `
        Tu es Ory, un analyste financier agréé et conseiller stratégique d'élite spécialisé dans le référentiel SYSCOHADA révisé (Espace UEMOA/CEMAC).
        Fournis une analyse stratégique exhaustive des données comptables de l'entreprise :
        
        DONNÉES DU COMPTE DE RÉSULTAT :
        - Chiffre d'Affaires : ${formatCurrency(totalIncome)}
        - Total des Charges : ${formatCurrency(totalExpenses)}
        - Résultat Net Fiscal : ${formatCurrency(netResultNum)}
        
        DONNÉES D'ÉQUILIBRE BILANCIEL :
        - Total Actifs : ${formatCurrency(totalActif)}
        - Total Passifs : ${formatCurrency(totalPassif)}
        
        COMPTES PAR ARTICLES :
        ${JSON.stringify(sheetContext)}

        CONSIGNES DE RÉDACTION (FORMAT DE TRÈS HAUT STANDING) :
        - Rédige en Français élégant, direct et précis. Évite les banalités ou de t'excuser.
        - Identifie les 3 indicateurs de performance clés (KPIs) notables de l'espace SYSCOHADA revisité (le FRNG - Fonds de Roulement Net Global, le BFR - Besoin en Fonds de Roulement et la Trésorerie Nette).
        - Structure en 3 sections claires avec des listes à puces esthétiques :
          1. **Diagnostic de Performance Globale** (évalue la structure de la marge d'exploitation, l'impact des charges de personnel Cl.66 et l'optimisation des impôts direct Cl.63).
          2. **Équilibre Financier Ouest-Africain & Liquidités** (analyse la trésorerie Cl.52/57 par rapport aux dettes fournisseurs Cl.40 et créances clients Cl.41).
          3. **Recommandations Actionnables et Trajectoire de Croissance** (propose des optimisations fiscales ou placements de trésorerie spécifiques adaptés à la Côte d'Ivoire, Sénégal, Cameroun ou espace d'exploitation de l'entreprise).
      `;

      const response = await apiFetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "Tu es Ory, un conseiller financier virtuose et expert SYSCOHADA révisé. Tu analyses les états financiers au laser pour identifier des leviers de trésorerie et d'optimisation."
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        setAiInsight(json.text);
      } else {
        throw new Error("Erreur de communication avec le serveur intelligent.");
      }
    } catch (e: any) {
      console.error(e);
      setAnalysisError(e.message || "Impossible de joindre le serveur intelligent Ory IA.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleExportCSV = () => {
    let exportData: any[] = [];
    let headers: string[] = [];
    let filename = `Rapport_Comptable_${reportType}`;

    if (reportType === 'profit-loss') {
      exportData = pnlSource.map(i => ({
        code: i.account_code,
        intitule: i.account_name,
        debit: i.total_debit,
        credit: i.total_credit,
        solde: i.balance
      }));
      headers = ['Code', 'Intitule', 'Debit', 'Credit', 'Solde'];
    } else if (reportType === 'balance-sheet') {
      const activeAssets = assetsList.map(a => ({ type: 'ACTIF', code: a.code, name: a.name, amount: a.value }));
      const activeLiabilities = passifList.map(l => ({ type: 'PASSIF', code: l.code, name: l.name, amount: l.value }));
      exportData = [...activeAssets, ...activeLiabilities];
      headers = ['Type', 'Code', 'Name', 'Amount'];
    } else {
      // Projections or breakdowns
      exportData = demoCashflowData;
      headers = ['Month', 'Encaissable', 'Decaissable', 'Solde'];
    }

    exportToCSV(exportData, `${filename}_${new Date().toISOString().split('T')[0]}`, headers);
  };

  const handleExportExcel = () => {
    let exportData: any[] = [];
    let sheetName = 'RAPPORT';
    let filename = `Ory_BI_Report_${reportType}`;

    if (reportType === 'profit-loss') {
      exportData = pnlSource.map(i => ({
        'Code de Compte': i.account_code,
        'Nom du Compte': i.account_name,
        'Mouvement Débit': i.total_debit,
        'Mouvement Crédit': i.total_credit,
        'Solde Net': i.balance
      }));
      sheetName = 'Profit_and_Loss';
    } else if (reportType === 'balance-sheet') {
      exportData = [
        ...assetsList.map(a => ({ Classement: 'ACTIF', Code: a.code, Intitulé: a.name, Montant: a.value })),
        ...passifList.map(p => ({ Classement: 'PASSIF', Code: p.code, Intitulé: p.name, Montant: p.value }))
      ];
      sheetName = 'Balance_Sheet';
    } else {
      exportData = demoCashflowData.map(c => ({
        Mois: c.month,
        'Flux Encaissable': c.encaissable,
        'Flux Décaissements': c.decaissable,
        'Solde Courant': c.solde
      }));
      sheetName = 'Cash_Flow';
    }

    exportToExcel(exportData, filename, sheetName);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const settings = { name: "ORY INTEL BI COORT", country: "Afrique de l'Ouest/Centrale" };
    
    const subtitle = `Période du ${startDate} au ${endDate} - ${demoMode ? "MODE SIMULATION" : "DONNÉES EFFECTIVES"}`;
    const startY = addPDFHeader(doc, settings, `RAPPORT COMPTABLE : ${reportType.toUpperCase()}`, subtitle);

    if (reportType === 'profit-loss') {
      const tableBody = pnlSource.map(i => [
        i.account_code,
        i.account_name,
        formatCurrencyPDF(i.total_debit),
        formatCurrencyPDF(i.total_credit),
        formatCurrencyPDF(i.balance)
      ]);
      
      tableBody.push([
        'CUMUL',
        'CHARGES COMPTES CL.6 vs PRODUITS COMPTES CL.7',
        '',
        '',
        formatCurrencyPDF(netResultNum)
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: [['Code Account', 'Intitulé Compte SYSCOHADA', 'Débit', 'Crédit', 'Solde Brut']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      });
    } else if (reportType === 'balance-sheet') {
      const tableBody = [
        ...assetsList.map(a => ['ACTIF', a.code, a.name, formatCurrencyPDF(a.value)]),
        ...passifList.map(p => ['PASSIF', p.code, p.name, formatCurrencyPDF(p.value)]),
      ];

      autoTable(doc, {
        startY: startY + 10,
        head: [['Classement', 'N° Compte', 'Libellé de la Ligne', 'Montant Net (FCFA)']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });
    } else {
      // Projections
      const tableBody = demoCashflowData.map(c => [
        c.month,
        formatCurrencyPDF(c.encaissable),
        formatCurrencyPDF(c.decaissable),
        formatCurrencyPDF(c.solde)
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: [['Mois', 'Prévisions d\'Encaissements', 'Prévisions de Décaissements', 'Solde Estimé']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
      });
    }

    addPDFFooter(doc);
    doc.save(`Ory_BI_Rapport_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Prepare chart data for Recharts Pie charts
  const performanceChartData = [
    { name: 'Ventes Saas & SaaS', value: Math.floor(totalIncome * 0.4) || 28000000, color: '#10B981' },
    { name: 'Conseils & Services', value: Math.floor(totalIncome * 0.35) || 24000000, color: '#3B82F6' },
    { name: 'Maintenance & Formations', value: Math.floor(totalIncome * 0.25) || 17000000, color: '#F59E0B' }
  ];

  const reportTypes = [
    { id: 'analytics', label: 'Dashboard de CA', icon: PieChartIcon },
    { id: 'profit-loss', label: 'Compte de Résultat (P&L)', icon: BarChart3 },
    { id: 'balance-sheet', label: 'Bilan Personnalisé', icon: FileText },
    { id: 'cashflow', label: 'Trésorerie Prévisionnelle', icon: AreaChartIcon },
  ];

  const progressPercent = Math.max(0, Math.min(100, Math.round((totalIncome - totalExpenses) / (totalIncome || 1) * 100)));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 pb-12">
      
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 rounded-[2.5rem] border border-slate-700/50 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-green/10 rounded-full filter blur-3xl -mr-24 -mt-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full filter blur-3xl -ml-24 -mb-24 pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-brand-green/20 border border-brand-green/45 text-brand-green-light text-[11px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Sparkles size={12} className="animate-pulse" />
              Intelligence Financière SYSCOHADA
            </span>
            <div className="flex items-center gap-2 bg-slate-800/80 p-0.5 px-2.5 rounded-full border border-slate-700/60 shadow-inner">
              <span className="text-[11px] font-bold text-slate-400">Mode Démo :</span>
              <button 
                onClick={() => setDemoMode(!demoMode)} 
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  demoMode ? "bg-emerald-500" : "bg-slate-650"
                )}
              >
                <span className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  demoMode ? "translate-x-4" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>
          
          <h1 className="text-3xl font-black font-display tracking-tight text-white flex items-center gap-3">
            <Activity className="text-brand-green animate-bounce" size={32} />
            Rapports & BI Intelligence
          </h1>
          <p className="text-slate-300 max-w-xl text-sm font-medium">
            Explorez vos soldes, auditez votre répartition de charges et déclenchez des conseils stratégiques animés par Ory IA.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 relative z-10">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-3 rounded-2xl border transition-all active:scale-95 flex items-center gap-2 text-sm font-bold shadow-md",
              showFilters 
                ? "bg-brand-green text-white border-brand-green" 
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-755"
            )}
            title="Ajuster dates"
          >
            <Settings2 size={18} />
            <span>Paramètres</span>
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-black uppercase text-slate-200 hover:bg-slate-755 transition-all shadow-md active:scale-95"
          >
            <FileSpreadsheet size={16} />
            CSV
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-black uppercase text-slate-200 hover:bg-slate-755 transition-all shadow-md active:scale-95"
          >
            <Download size={16} />
            XLSX
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-700 text-white border border-emerald-650 rounded-2xl text-xs font-black uppercase hover:bg-emerald-600 transition-all shadow-md active:scale-95"
          >
            <FileText size={16} />
            PDF
          </button>
        </div>
      </div>

      {/* Demo Status Banner */}
      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/20 text-amber-500 rounded-xl">
              <Info size={18} />
            </span>
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Données de Démonstration Actives</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Idéal pour explorer le fonctionnement de la BI et tester l'Assistant Ory IA. Décochez dans l'en-tête pour lire vos données en temps réel.</p>
            </div>
          </div>
          <button onClick={() => setDemoMode(false)} className="text-[11px] text-amber-500 font-bold hover:underline">
            Passer aux données réelles
          </button>
        </div>
      )}

      {/* Configuration Drawer/Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="lg:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">Choix du Rapport Actif</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
                    {reportTypes.map(t => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setReportType(t.id as any)}
                          className={cn(
                            "flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-black transition-all text-center",
                            reportType === t.id 
                              ? "bg-white dark:bg-slate-900 shadow-md text-brand-green dark:text-brand-green-light border border-slate-200/40" 
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          )}
                        >
                          <Icon size={14} className="shrink-0" />
                          <span>{t.label.split(' ')[0]} {t.label.includes('(') ? "P&L/Bilan" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">Date de début</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-brand-green outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">Date de fin</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-brand-green outline-none font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Turnover Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-850/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 dark:text-slate-500">Flux d'Affaires</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><TrendingUp size={16} /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Produits H.T.</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="mt-4 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <span>+12.4% vs Exercice Précédent</span>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-850/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 dark:text-slate-500">Structure de Coûts</span>
            <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><TrendingDown size={16} /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Charges H.T.</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-bold">
            <span>Surveillance SYSCOHADA active</span>
          </div>
        </div>

        {/* Net Income Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-850/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 dark:text-slate-500">Rentabilité Exploitation</span>
            <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl"><DollarSign size={16} /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Résultat Estimé</h3>
            <p className={cn(
              "text-2xl font-black tracking-tight mt-1",
              netResultNum >= 0 ? "text-brand-green" : "text-rose-500"
            )}>{formatCurrency(netResultNum)}</p>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-brand-green h-full rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-[9px] text-slate-400 mt-1.5 font-bold">Marge nette : {progressPercent}% des ventes</p>
          </div>
        </div>

        {/* Liquidity Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-850/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 dark:text-slate-500">Gouvernance Trésorerie</span>
            <span className="p-2 bg-sky-500/10 text-sky-500 rounded-xl"><Brain size={16} /></span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Liquidités (Actif)</h3>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
              {formatCurrency(bsSource.filter(b => b.account_code.startsWith('52') || b.account_code.startsWith('57')).reduce((acc, curr) => acc + Math.abs(curr.balance), 0) || 9500000)}
            </p>
          </div>
          <div className="mt-4 text-[11px] text-sky-600 dark:text-sky-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>Ratio de liquidités idéal</span>
          </div>
        </div>
      </div>

      {/* Main Analysis and Interactive Displays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Content Panel (Left/Centers / 2 cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 hover:shadow-xl transition-shadow duration-300">
            
            {/* Tab layout rendering details */}
            {reportType === 'analytics' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Secteurs & Catégories de Ventes</h3>
                  <span className="text-xs font-bold text-slate-400 font-mono">XOF (FCFA)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={performanceChartData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={65} 
                          outerRadius={95} 
                          paddingAngle={6}
                        >
                          {performanceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">Récapitulatif des flux rentrants</p>
                    {performanceChartData.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-5 core p-3.5 rounded-2xl border border-slate-100 hover:bg-slate-100 dark:bg-slate-850/40 dark:border-slate-800/80 transition-all">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional custom report analysis metrics */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Marge Brute Globale</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">76.4 %</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Point Mort de CA</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(totalExpenses * 1.15)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Coefficient de Croissance</span>
                    <span className="text-lg font-black text-brand-green">+ 18.2 %</span>
                  </div>
                </div>

                <div className="pt-8 mt-4 border-t border-slate-200 dark:border-slate-800">
                   <div className="flex items-center justify-between mb-6">
                     <h3 className="text-xl font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Top 5 Charges de Performance</h3>
                   </div>
                   <div className="space-y-4">
                     {pnlSource.filter(a => a.account_code.startsWith('6') && Math.abs(a.balance) > 0)
                       .sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance))
                       .slice(0, 5)
                       .map((expense, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-rose-500 font-bold">{expense.account_code}</span>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{expense.account_name}</span>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(Math.abs(expense.balance))}</span>
                              <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex justify-end">
                                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(expense.balance) / (totalExpenses || 1) * 100)}%` }} />
                              </div>
                            </div>
                         </div>
                     ))}
                   </div>
                </div>
              </div>
            )}

            {reportType === 'profit-loss' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Tableau des Comptes de Résultat (P&L)</h3>
                    <p className="text-xs text-slate-400 mt-1">Génération automatique des balances de produits et charges révisées</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 font-mono">SYSCOHADA Cl. 6 & 7</span>
                </div>

                <div className="w-full min-w-0 overflow-auto ">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                        <th className="py-3 px-2">N° Compte</th>
                        <th className="py-3 px-4">Libellé du Compte</th>
                        <th className="py-3 px-2 text-right">Débit (Achat)</th>
                        <th className="py-3 px-2 text-right">Crédit (Vente)</th>
                        <th className="py-3 px-4 text-right">Solde Brut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                      {pnlSource.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">Aucun enregistrement trouvé pour cette période.</td>
                        </tr>
                      ) : pnlSource.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                          <td className="py-3.5 px-2 font-mono font-medium text-indigo-600 dark:text-indigo-400">{item.account_code}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 line-clamp-1 truncate max-w-[200px]">{item.account_name}</td>
                          <td className="py-3.5 px-2 text-right font-mono text-slate-500">{item.total_debit > 0 ? formatCurrency(item.total_debit) : '-'}</td>
                          <td className="py-3.5 px-2 text-right font-mono text-slate-500">{item.total_credit > 0 ? formatCurrency(item.total_credit) : '-'}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(item.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center font-bold text-sm bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                  <span className="text-slate-800 dark:text-slate-300">RÉSULTAT NET (Différence Cl.7 - Cl.6) :</span>
                  <span className={cn("font-extrabold text-base", netResultNum >= 0 ? "text-brand-green" : "text-rose-500")}>
                    {formatCurrency(netResultNum)}
                  </span>
                </div>
              </div>
            )}

            {reportType === 'balance-sheet' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Bilan Comptable (Cl. 1 à 5)</h3>
                    <p className="text-xs text-slate-400 mt-1">Modèle d'équilibre bilanciel et capitaux d'exploitation</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 font-mono">XOF</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Actif column */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/40 pb-2">Actifs (Éléments du patrimoine)</h4>
                    <div className="space-y-2">
                      {assetsList.map((asset, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl hover:bg-slate-100">
                          <div className="flex flex-col">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 text-[10px]">{asset.code}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-350 truncate max-w-[170px]">{asset.name}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(asset.value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t-2 border-brand-green/30 flex justify-between items-center text-xs font-extrabold text-brand-green">
                      <span>TOTAL DE L'ACTIF :</span>
                      <span>{formatCurrency(totalActif)}</span>
                    </div>
                  </div>

                  {/* Passif Column */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-emerald-500 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900/40 pb-2">Passifs (Dettes & Capitaux)</h4>
                    <div className="space-y-2">
                      {passifList.map((liab, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-slate-800/20 rounded-xl hover:bg-slate-100">
                          <div className="flex flex-col">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px]">{liab.code}</span>
                            <span className="font-medium text-slate-700 dark:text-slate-350 truncate max-w-[170px]">{liab.name}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(liab.value)}</span>
                        </div>
                      ))}
                      {/* Equilibrating item to showcase a balanced P&L on balance sheet */}
                      <div className="flex justify-between items-center text-xs p-2.5 bg-brand-green/5 border border-brand-green/10 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-mono text-brand-green text-[10px]">-</span>
                          <span className="font-bold text-brand-green">Résultat non-distribué (Report à nouveau)</span>
                        </div>
                        <span className="font-mono font-bold text-brand-green">{formatCurrency(currentImbalances || netResultNum)}</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      <span>TOTAL DU PASSIF :</span>
                      <span>{formatCurrency(totalPassif + (currentImbalances || netResultNum))}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} />
                  Bilan balancé au franc CFA près conformément à la législation OHADA.
                </div>
              </div>
            )}

            {reportType === 'cashflow' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black font-display tracking-tight text-slate-900 dark:text-white uppercase">Trésorerie Prévisionnelle (6 prochains mois)</h3>
                  <span className="text-xs font-bold text-slate-400 font-mono">Valeurs Projetées</span>
                </div>

                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={demoCashflowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEnc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDec" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Area type="monotone" dataKey="encaissable" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEnc)" name="Encaissements" />
                      <Area type="monotone" dataKey="decaissable" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDec)" name="Décaissements" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 text-xs">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase">Comment lire ce graphique ?</h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ce graphique compare les flux financiers encaissables aux charges récurrentes payables. Lorsque l'aire verte surplombe la rouge, l'entreprise génère un excédent de trésorerie net positif augmentant ses réserves de liquidité.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Strategic Assistant (Right column / full design) */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-full min-h-[480px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full filter blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-green/20 text-brand-green rounded-2xl flex items-center justify-center">
                  <Brain size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-md font-black tracking-tight uppercase">Analyse Ory IA</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conseiller Stratégique</p>
                </div>
              </div>

              <div className="p-4 bg-slate-850/60 rounded-2xl border border-slate-800/50 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                Générez des commentaires de direction directement sur la rentabilité SYSCOHADA et l'optimisation des structures de marges de l'entreprise.
              </div>

              <AnimatePresence mode="wait">
                {loadingInsight && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[220px]"
                  >
                    <RefreshCw className="animate-spin text-brand-green" size={32} />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Lecture des soldes de l'exercice...</p>
                      <p className="text-[10px] text-slate-500 mt-1">Ory évalue les ratios de liquidité et de solvabilité</p>
                    </div>
                  </motion.div>
                )}

                {!loadingInsight && aiInsight && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-850/80 p-5 rounded-2xl border border-slate-800 text-xs text-slate-200 overflow-y-auto max-h-[350px] space-y-3 scrollbar-thin scrollbar-thumb-slate-800"
                  >
                    <div className="markdown-body">
                      <ReactMarkdown>{aiInsight}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                {!loadingInsight && !aiInsight && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[220px] space-y-4 border border-dashed border-slate-800 rounded-2xl"
                  >
                    <HelpCircle size={28} className="text-slate-650" />
                    <p className="text-xs">Aucune note de direction disponible. Appuyez sur le bouton ci-dessous pour lancer l'analyse intelligente.</p>
                  </motion.div>
                )}

                {analysisError && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[11px] text-rose-300">
                    {analysisError}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleStrategicAnalysis}
              disabled={loadingInsight}
              className="mt-6 w-full flex items-center justify-center gap-2 py-4 bg-brand-green hover:bg-brand-green-light text-slate-900 font-extrabold uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50"
            >
              {loadingInsight ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Analyser par l'IA Ory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
