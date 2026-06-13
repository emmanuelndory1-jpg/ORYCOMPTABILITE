import { apiFetch } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { FileText, Download, Loader2, TrendingUp, TrendingDown, Scale, FileSpreadsheet, PieChart, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { PDF_CONFIG, exportToCSV, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';
import { apiFetch as fetch } from '@/lib/api';

interface FinancialData {
  incomeStatement: {
    revenue: number;
    expenses: number;
    netIncome: number;
    details: {
      sales: number;
      services: number;
      purchases: number;
      personnel: number;
      taxes: number;
      otherExpenses: number;
      depreciation: number;
    };
  };
  balanceSheet: {
    assets: {
      fixed: number;
      current: number;
      cash: number;
      total: number;
    };
    liabilities: {
      equity: number;
      debts: number;
      total: number;
    };
  };
  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
    startBalance: number;
    endBalance: number;
  };
}

export function FinancialStatements() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [data, setData] = useState<FinancialData | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'income' | 'balance' | 'cash' | 'ratios'>('income');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const setQuickRange = (range: 'month' | 'quarter' | 'year' | 'all') => {
    if (range === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (range === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
    } else if (range === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const calculateRatios = () => {
    if (!data) return null;
    const { incomeStatement, balanceSheet } = data;
    const currentAssets = balanceSheet.assets.current + balanceSheet.assets.cash;
    const currentLiabilities = balanceSheet.liabilities.debts;
    const equity = balanceSheet.liabilities.equity + incomeStatement.netIncome;
    const totalAssets = balanceSheet.assets.total;

    return {
      liquidity: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
      netMargin: incomeStatement.revenue > 0 ? (incomeStatement.netIncome / incomeStatement.revenue) * 100 : 0,
      solvency: totalAssets > 0 ? (equity / totalAssets) * 100 : 0,
      roe: equity > 0 ? (incomeStatement.netIncome / equity) * 100 : 0,
      workingCapital: currentAssets - currentLiabilities
    };
  };

  const ratios = calculateRatios();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const [financialRes, settingsRes] = await Promise.all([
          apiFetch(`/api/financial-statements?${params.toString()}`),
          apiFetch('/api/company/settings')
        ]);
        const financialData = await financialRes.json();
        const settings = await settingsRes.json();
        setData(financialData);
        setCompanySettings(settings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeYear?.id, startDate, endDate]);

  const handleExportCSV = () => {
    if (!data) return;
    let csvData: any[] = [];
    let filename = '';
    
    if (activeTab === 'income') {
      csvData = [
        { Libellé: 'Ventes de marchandises', Montant: data.incomeStatement.details.sales },
        { Libellé: 'Prestations de services', Montant: data.incomeStatement.details.services },
        { Libellé: 'Total Produits', Montant: data.incomeStatement.revenue },
        { Libellé: 'Achats', Montant: data.incomeStatement.details.purchases },
        { Libellé: 'Services extérieurs', Montant: data.incomeStatement.details.otherExpenses },
        { Libellé: 'Impôts et taxes', Montant: data.incomeStatement.details.taxes },
        { Libellé: 'Charges de personnel', Montant: data.incomeStatement.details.personnel },
        { Libellé: 'Dotations aux amortissements', Montant: data.incomeStatement.details.depreciation },
        { Libellé: 'Total Charges', Montant: data.incomeStatement.expenses },
        { Libellé: 'RÉSULTAT NET', Montant: data.incomeStatement.netIncome }
      ];
      filename = `Compte_Resultat_${new Date().toISOString().split('T')[0]}`;
    } else if (activeTab === 'balance') {
      csvData = [
        { Poste: 'Actif Immobilisé', Montant: data.balanceSheet.assets.fixed },
        { Poste: 'Actif Circulant', Montant: data.balanceSheet.assets.current },
        { Poste: 'Trésorerie Actif', Montant: data.balanceSheet.assets.cash },
        { Poste: 'TOTAL ACTIF', Montant: data.balanceSheet.assets.total },
        { Poste: 'Capitaux Propres', Montant: data.balanceSheet.liabilities.equity },
        { Poste: 'Résultat de l\'exercice', Montant: data.incomeStatement.netIncome },
        { Poste: 'Dettes', Montant: data.balanceSheet.liabilities.debts },
        { Poste: 'TOTAL PASSIF', Montant: data.balanceSheet.liabilities.total + data.incomeStatement.netIncome }
      ];
      filename = `Bilan_${new Date().toISOString().split('T')[0]}`;
    } else if (activeTab === 'cash') {
      csvData = [
        { Poste: 'Flux d\'Exploitation', Montant: data.cashFlow.operating },
        { Poste: 'Flux d\'Investissement', Montant: data.cashFlow.investing },
        { Poste: 'Flux de Financement', Montant: data.cashFlow.financing },
        { Poste: 'Variation Nette de Trésorerie', Montant: data.cashFlow.netChange },
        { Poste: 'Trésorerie au début', Montant: data.cashFlow.startBalance },
        { Poste: 'Trésorerie à la fin', Montant: data.cashFlow.endBalance }
      ];
      filename = `Flux_Tresorerie_${new Date().toISOString().split('T')[0]}`;
    }
    
    exportToCSV(csvData, filename, ['Poste', 'Montant']);
  };

  const handleExportExcel = () => {
    if (!data) return;
    
    let excelData: any[] = [];
    let filename = '';
    
    if (activeTab === 'income') {
      excelData = [
        { Libellé: 'PRODUITS', Montant: '' },
        { Libellé: 'Ventes de marchandises', Montant: data.incomeStatement.details.sales },
        { Libellé: 'Prestations de services', Montant: data.incomeStatement.details.services },
        { Libellé: 'Total Produits', Montant: data.incomeStatement.revenue },
        { Libellé: '', Montant: '' },
        { Libellé: 'CHARGES', Montant: '' },
        { Libellé: 'Achats', Montant: data.incomeStatement.details.purchases },
        { Libellé: 'Services extérieurs', Montant: data.incomeStatement.details.otherExpenses },
        { Libellé: 'Impôts et taxes', Montant: data.incomeStatement.details.taxes },
        { Libellé: 'Charges de personnel', Montant: data.incomeStatement.details.personnel },
        { Libellé: 'Dotations aux amortissements', Montant: data.incomeStatement.details.depreciation },
        { Libellé: 'Total Charges', Montant: data.incomeStatement.expenses },
        { Libellé: '', Montant: '' },
        { Libellé: 'RÉSULTAT NET', Montant: data.incomeStatement.netIncome }
      ];
      filename = `Compte_Resultat_${new Date().toISOString().split('T')[0]}`;
    } else if (activeTab === 'balance') {
      excelData = [
        { Section: 'ACTIF', Poste: 'Actif Immobilisé', Montant: data.balanceSheet.assets.fixed },
        { Section: 'ACTIF', Poste: 'Actif Circulant', Montant: data.balanceSheet.assets.current },
        { Section: 'ACTIF', Poste: 'Trésorerie Actif', Montant: data.balanceSheet.assets.cash },
        { Section: 'ACTIF', Poste: 'TOTAL ACTIF', Montant: data.balanceSheet.assets.total },
        { Section: '', Poste: '', Montant: '' },
        { Section: 'PASSIF', Poste: 'Capitaux Propres', Montant: data.balanceSheet.liabilities.equity },
        { Section: 'PASSIF', Poste: 'Résultat de l\'exercice', Montant: data.incomeStatement.netIncome },
        { Section: 'PASSIF', Poste: 'Dettes', Montant: data.balanceSheet.liabilities.debts },
        { Section: 'PASSIF', Poste: 'TOTAL PASSIF', Montant: data.balanceSheet.liabilities.total + data.incomeStatement.netIncome }
      ];
      filename = `Bilan_${new Date().toISOString().split('T')[0]}`;
    } else if (activeTab === 'cash') {
      excelData = [
        { Poste: 'Flux d\'Exploitation', Montant: data.cashFlow.operating },
        { Poste: 'Flux d\'Investissement', Montant: data.cashFlow.investing },
        { Poste: 'Flux de Financement', Montant: data.cashFlow.financing },
        { Poste: 'Variation Nette de Trésorerie', Montant: data.cashFlow.netChange },
        { Poste: 'Trésorerie au début', Montant: data.cashFlow.startBalance },
        { Poste: 'Trésorerie à la fin', Montant: data.cashFlow.endBalance }
      ];
      filename = `Flux_Tresorerie_${new Date().toISOString().split('T')[0]}`;
    }
    
    import('../lib/exportUtils').then(utils => {
      utils.exportToExcel(excelData, filename, activeTab.toUpperCase());
    });
  };

  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const settings = companySettings || { name: PDF_CONFIG.companyName };
    const titleMap = {
      income: "COMPTE DE RÉSULTAT",
      balance: "BILAN",
      cash: "TABLEAU DES FLUX DE TRÉSORERIE",
      ratios: "RATIOS FINANCIERS"
    };
    const title = titleMap[activeTab];
    const subtitle = (startDate || endDate) 
      ? `Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`
      : "États Financiers - SYSCOHADA Révisé";

    const nextY = addPDFHeader(doc, settings, title, subtitle);

    if (activeTab === 'income') {
      const incomeData = [
        [{ content: 'PRODUITS (Classe 7)', colSpan: 2, styles: { fillColor: [240, 253, 244], fontStyle: 'bold', textColor: [21, 128, 61] } }],
        ['Ventes de marchandises', formatCurrencyPDF(data.incomeStatement.details.sales)],
        ['Prestations de services', formatCurrencyPDF(data.incomeStatement.details.services)],
        [{ content: 'Total Produits', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.incomeStatement.revenue), styles: { fontStyle: 'bold' } }],
        
        [{ content: 'CHARGES (Classe 6)', colSpan: 2, styles: { fillColor: [255, 241, 242], fontStyle: 'bold', textColor: [159, 18, 57] } }],
        ['Achats', formatCurrencyPDF(data.incomeStatement.details.purchases)],
        ['Services extérieurs', formatCurrencyPDF(data.incomeStatement.details.otherExpenses)],
        ['Impôts et taxes', formatCurrencyPDF(data.incomeStatement.details.taxes)],
        ['Charges de personnel', formatCurrencyPDF(data.incomeStatement.details.personnel)],
        ['Dotations aux amortissements', formatCurrencyPDF(data.incomeStatement.details.depreciation)],
        [{ content: 'Total Charges', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.incomeStatement.expenses), styles: { fontStyle: 'bold' } }],
        
        [{ content: 'RÉSULTAT NET', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', fontSize: 12 } }, { content: formatCurrencyPDF(data.incomeStatement.netIncome), styles: { fillColor: [241, 245, 249], fontStyle: 'bold', fontSize: 12, textColor: data.incomeStatement.netIncome >= 0 ? [34, 197, 94] : [244, 63, 94] } }],
      ];

      autoTable(doc, {
        startY: nextY,
        head: [['Libellé', `Montant (${currency})`]],
        body: incomeData as any,
        theme: 'grid',
        headStyles: { fillColor: PDF_CONFIG.colors.secondary },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 'auto', halign: 'right' },
        },
      });
    } else if (activeTab === 'balance') {
      // Assets Table
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ACTIF", 14, nextY);
      
      const assetsData = [
        ['Actif Immobilisé', formatCurrencyPDF(data.balanceSheet.assets.fixed)],
        ['Actif Circulant (Stocks & Créances)', formatCurrencyPDF(data.balanceSheet.assets.current)],
        ['Trésorerie Actif', formatCurrencyPDF(data.balanceSheet.assets.cash)],
        [{ content: 'TOTAL ACTIF', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.balanceSheet.assets.total), styles: { fontStyle: 'bold' } }],
      ];

      autoTable(doc, {
        startY: nextY + 5,
        head: [['Poste', `Montant (${currency})`]],
        body: assetsData as any,
        theme: 'grid',
        headStyles: { fillColor: [21, 128, 61] }, // Brand green header
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 'auto', halign: 'right' },
        },
      });

      // Liabilities Table
      const finalYAssets = ((doc as any).lastAutoTable?.finalY || nextY) + 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("PASSIF", 14, finalYAssets - 5);

      const liabilitiesData = [
        ['Capitaux Propres', formatCurrencyPDF(data.balanceSheet.liabilities.equity)],
        ['Résultat de l\'exercice', formatCurrencyPDF(data.incomeStatement.netIncome)],
        ['Dettes', formatCurrencyPDF(data.balanceSheet.liabilities.debts)],
        [{ content: 'TOTAL PASSIF', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.balanceSheet.liabilities.total + data.incomeStatement.netIncome), styles: { fontStyle: 'bold' } }],
      ];

      autoTable(doc, {
        startY: finalYAssets,
        head: [['Poste', `Montant (${currency})`]],
        body: liabilitiesData as any,
        theme: 'grid',
        headStyles: { fillColor: [159, 18, 57] }, // Rose header
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 'auto', halign: 'right' },
        },
      });
    } else if (activeTab === 'cash') {
      const cashFlowData = [
        ['Flux d\'Exploitation', formatCurrencyPDF(data.cashFlow.operating)],
        ['Flux d\'Investissement', formatCurrencyPDF(data.cashFlow.investing)],
        ['Flux de Financement', formatCurrencyPDF(data.cashFlow.financing)],
        [{ content: 'Variation Nette de Trésorerie', styles: { fontStyle: 'bold' } }, { content: formatCurrencyPDF(data.cashFlow.netChange), styles: { fontStyle: 'bold' } }],
        ['Trésorerie au début de la période', formatCurrencyPDF(data.cashFlow.startBalance)],
        [{ content: 'Trésorerie à la fin de la période', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: formatCurrencyPDF(data.cashFlow.endBalance), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
      ];

      autoTable(doc, {
        startY: nextY,
        head: [['Poste', `Montant (${currency})`]],
        body: cashFlowData as any,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 'auto', halign: 'right' },
        },
      });
    }

    const finalY = ((doc as any).lastAutoTable?.finalY || nextY) + 20;
    import('../lib/exportUtils').then(utils => {
      utils.addOHADAComplianceSignature(doc, finalY, companySettings?.manager_name || "L'Administrateur");
      utils.addPDFFooter(doc);
      doc.save(`Etats_Financiers_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">États Financiers</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Bilan et Compte de Résultat (SYSCOHADA)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <FileSpreadsheet size={18} />
            CSV
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
          >
            <FileSpreadsheet size={18} className="text-brand-green" />
            Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex-1 sm:flex-none bg-brand-green hover:bg-brand-green-dark text-white px-3 sm:px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-green/20 text-sm"
          >
            <Download size={18} />
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
            <TrendingUp size={16} className="text-brand-green" /> Période d'analyse
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setQuickRange('month')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Mois</button>
            <button onClick={() => setQuickRange('quarter')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Trimestre</button>
            <button onClick={() => setQuickRange('year')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Cette Année</button>
            <button onClick={() => setQuickRange('all')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Tout</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">Date début</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">Date fin</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="w-full min-w-0 overflow-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-max sm:w-fit min-w-full sm:min-w-0">
          <button
            onClick={() => setActiveTab('income')}
            className={cn(
              "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'income' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <TrendingUp size={16} />
            Compte de Résultat
          </button>
          <button
            onClick={() => setActiveTab('balance')}
            className={cn(
              "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'balance' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <Scale size={16} />
            Bilan
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={cn(
              "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'cash' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <FileText size={16} />
            Flux de Trésorerie
          </button>
          <button
            onClick={() => setActiveTab('ratios')}
            className={cn(
              "px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'ratios' ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <PieChart size={16} />
            Ratios Financiers
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8 transition-all duration-500">
        {activeTab === 'income' ? (
          <div className="premium-card p-6 md:p-10 max-w-4xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Compte de Résultat</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{activeYear?.name ? `Exercice ${activeYear.name}` : 'Exercice en cours'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-2/3 border-b-2 border-slate-100 dark:border-slate-800">Libellé</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-1/3 text-right border-b-2 border-slate-100 dark:border-slate-800">Montant</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={2} className="py-3 px-4 font-bold text-brand-green uppercase text-[10px] tracking-wider border-b border-brand-green/20">Produits (Classe 7)</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Ventes de marchandises (701)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.sales)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Prestations de services (706)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.services)}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-b-2 border-slate-200 dark:border-slate-700">
                    <td className="py-4 px-4 text-slate-900 dark:text-white text-[13px] uppercase tracking-wider">Total Produits</td>
                    <td className="py-4 px-4 text-right font-mono text-brand-green">{formatCurrency(data.incomeStatement.revenue)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={2} className="py-3 px-4 font-bold text-rose-600 uppercase text-[10px] tracking-wider border-b border-rose-100 dark:border-rose-900/30">Charges (Classe 6)</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Achats (60)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.purchases)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Services extérieurs (62/63)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.otherExpenses)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Impôts et taxes (64)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.taxes)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Charges de personnel (66)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.personnel)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Dotations aux amortissements (68)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.depreciation)}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-b-2 border-slate-200 dark:border-slate-700">
                    <td className="py-4 px-4 text-slate-900 dark:text-white text-[13px] uppercase tracking-wider">Total Charges</td>
                    <td className="py-4 px-4 text-right font-mono text-rose-600">{formatCurrency(data.incomeStatement.expenses)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-8"></td></tr>

                  <tr className={cn(
                    "font-black text-lg sm:text-xl",
                    data.incomeStatement.netIncome >= 0 ? "bg-brand-green/10 text-brand-green-dark dark:text-brand-green" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  )}>
                    <td className="py-5 px-4 rounded-l-2xl uppercase tracking-wider">RÉSULTAT NET</td>
                    <td className="py-5 px-4 text-right font-mono rounded-r-2xl">{formatCurrency(data.incomeStatement.netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'balance' ? (
          <div className="premium-card p-6 md:p-10 max-w-5xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Bilan</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Au {new Date().toLocaleDateString()}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* ACTIF */}
              <div className="shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl">
                <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3.5 px-4 rounded-t-2xl font-black uppercase tracking-widest text-[13px] text-center">
                  Actif
                </div>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-b-2xl border-t-0 bg-white dark:bg-slate-900/50">
                  <tbody className="text-sm">
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Actif Immobilisé</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Immobilisations (Cl. 2)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.fixed)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Actif Circulant</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Stocks & Créances (Cl. 3/4)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.current)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Trésorerie Actif</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Disponibilités (Cl. 5)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.cash)}</td>
                    </tr>

                    <tr className="bg-slate-100 dark:bg-slate-800 font-black text-[15px] border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-5 px-4 text-slate-900 dark:text-white uppercase tracking-wider rounded-bl-2xl">Total Actif</td>
                      <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white rounded-br-2xl">{formatCurrency(data.balanceSheet.assets.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PASSIF */}
              <div className="shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl">
                <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3.5 px-4 rounded-t-2xl font-black uppercase tracking-widest text-[13px] text-center">
                  Passif
                </div>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-b-2xl border-t-0 bg-white dark:bg-slate-900/50">
                  <tbody className="text-sm">
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Capitaux Propres</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Capital & Réserves (Cl. 1)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.equity)}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-brand-green font-bold flex items-center gap-1.5"><TrendingUp size={14} className="text-brand-green" /> Résultat de l'exercice</td>
                      <td className="py-4 px-4 text-right font-mono text-brand-green font-bold">{formatCurrency(data.incomeStatement.netIncome)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Dettes</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Dettes Fournisseurs & Fiscales (Cl. 4)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.debts)}</td>
                    </tr>

                    <tr className="bg-slate-100 dark:bg-slate-800 font-black text-[15px] border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-5 px-4 text-slate-900 dark:text-white uppercase tracking-wider rounded-bl-2xl">Total Passif</td>
                      <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white rounded-br-2xl">{formatCurrency(data.balanceSheet.liabilities.total + data.incomeStatement.netIncome)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'cash' ? (
          <div className="premium-card p-6 md:p-10 max-w-4xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Flux de Trésorerie</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{startDate || endDate ? 'Période analysée' : 'Période en cours'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <tbody className="text-sm">
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux d'Exploitation</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Résultat net + Amortissements (Simplifié)</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.operating >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.operating)}
                    </td>
                  </tr>
                  
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux d'Investissement</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Acquisitions d'immobilisations</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.investing >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.investing)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux de Financement</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Nouveaux emprunts et capitaux</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.financing >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.financing)}
                    </td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className={cn(
                    "font-black text-lg",
                    data.cashFlow.netChange >= 0 ? "bg-brand-green/10 text-brand-green-dark dark:text-brand-green" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  )}>
                    <td className="py-5 px-4 rounded-l-2xl uppercase tracking-wider">Variation Nette de Trésorerie</td>
                    <td className="py-5 px-4 text-right font-mono rounded-r-2xl">{formatCurrency(data.cashFlow.netChange)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className="bg-slate-50 dark:bg-slate-800/30 border-t-2 border-slate-200 dark:border-slate-700">
                    <td className="py-5 px-4 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Trésorerie au début de la période</td>
                    <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white font-bold">{formatCurrency(data.cashFlow.startBalance)}</td>
                  </tr>
                  
                  <tr className="bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                    <td className="py-5 px-4 font-black uppercase tracking-widest text-[13px] rounded-bl-2xl">Trésorerie à la fin de la période</td>
                    <td className="py-5 px-4 text-right font-mono font-black text-xl rounded-br-2xl">{formatCurrency(data.cashFlow.endBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="premium-card p-6 md:p-10 max-w-5xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Ratios de Performance & Structure</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Analyse de la santé financière</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Liquidity */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Liquidité Générale</h3>
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                      ratios!.liquidity > 1.2 ? "bg-brand-green/10 text-brand-green border border-brand-green/20" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    )}>
                      {ratios!.liquidity > 1.2 ? 'Optimale' : 'À surveiller'}
                    </span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.liquidity.toFixed(2)}x</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Capacité à payer les dettes de court terme avec l'actif circulant.</p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4 px-6">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Fonds de Roulement Net</span>
                    <span className={cn("font-bold font-mono text-sm", ratios!.workingCapital >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(ratios!.workingCapital)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Margin */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Marge Nette</h3>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    ratios!.netMargin > 10 ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  )}>
                    {ratios!.netMargin > 10 ? 'Rentable' : 'Standard'}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.netMargin.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Part du bénéfice net dégagée après couverture de toutes les charges.</p>
              </div>

              {/* Solvency */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Autonomie Financière</h3>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    ratios!.solvency > 30 ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                  )}>
                    {ratios!.solvency > 30 ? 'Solide' : 'Endettée'}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.solvency.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Poids des capitaux propres par rapport à l'ensemble du financement.</p>
              </div>

              {/* ROE */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Rentabilité (ROE)</h3>
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md text-[10px] font-black uppercase tracking-widest">
                    Performance
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.roe.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Retour sur investissement généré pour les associés ou actionnaires.</p>
              </div>
            </div>

            <div className="mt-8 lg:mt-10 p-6 bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 rounded-2xl shadow-xl flex gap-4 items-start">
              <div className="p-2.5 bg-brand-green/20 rounded-xl shrink-0 mt-1">
                <AlertCircle size={24} className="text-brand-green" />
              </div>
              <div>
                <h4 className="text-white font-black mb-2 text-sm uppercase tracking-widest">
                  Interprétation OHADA
                </h4>
                <p className="text-sm text-slate-300 dark:text-slate-400 leading-relaxed font-medium">
                  Ces indicateurs sont conformes aux normes d'analyse SYSCOHADA. Une autonomie financière supérieure à 33% est recommandée, garantissant que les capitaux propres couvrent au moins un tiers du passif total.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
