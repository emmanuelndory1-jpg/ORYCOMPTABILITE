import React, { useEffect, useState } from 'react';
import { FileText, Download, Loader2, TrendingUp, TrendingDown, Scale, FileSpreadsheet, PieChart, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from '@/hooks/useCurrency';
import { PDF_CONFIG, exportToCSV, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';

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
  const [data, setData] = useState<FinancialData | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'income' | 'balance' | 'cash' | 'ratios'>('income');

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
      try {
        const [financialRes, settingsRes] = await Promise.all([
          fetch('/api/financial-statements'),
          fetch('/api/company/settings')
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
  }, []);

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
    const subtitle = "États Financiers - SYSCOHADA Révisé";

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
      utils.addPDFSignature(doc, finalY);
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      {/* Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {activeTab === 'income' ? (
          <div className="p-4 sm:p-8 max-w-3xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase">Compte de Résultat</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Exercice 2026</p>
            </div>

            <div className="space-y-6">
              {/* Produits */}
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-brand-green uppercase mb-3 border-b border-brand-green/20 pb-1">Produits (Classe 7)</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Ventes de marchandises (701)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.sales)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Prestations de services (706)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.services)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-900 dark:text-white">Total Produits</span>
                    <span className="text-brand-green">{formatCurrency(data.incomeStatement.revenue)}</span>
                  </div>
                </div>
              </div>

              {/* Charges */}
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-rose-600 uppercase mb-3 border-b border-rose-100 dark:border-rose-900/30 pb-1">Charges (Classe 6)</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Achats (60)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.purchases)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Services extérieurs (62/63)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.otherExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Impôts et taxes (64)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.taxes)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Charges de personnel (66)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.personnel)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Dotations aux amortissements (68)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.depreciation)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-900 dark:text-white">Total Charges</span>
                    <span className="text-rose-600">{formatCurrency(data.incomeStatement.expenses)}</span>
                  </div>
                </div>
              </div>

              {/* Résultat */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-6 sm:mt-8">
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">RÉSULTAT NET</span>
                  <span className={cn(
                    "text-lg sm:text-xl font-bold font-mono",
                    data.incomeStatement.netIncome >= 0 ? "text-brand-green" : "text-rose-600"
                  )}>
                    {formatCurrency(data.incomeStatement.netIncome)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'balance' ? (
          <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase">Bilan</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Au {new Date().toLocaleDateString()}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Actif */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-brand-green/10 dark:bg-brand-green/20 px-4 py-3 border-b border-brand-green/20 dark:border-brand-green/30 font-bold text-brand-green-dark dark:text-brand-green text-center uppercase text-sm">
                  Actif
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Actif Immobilisé</h4>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Immobilisations (Cl. 2)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.fixed)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Actif Circulant</h4>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Stocks & Créances (Cl. 3/4)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.current)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Trésorerie Actif</h4>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Disponibilités (Cl. 5)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.cash)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    <span>TOTAL ACTIF</span>
                    <span>{formatCurrency(data.balanceSheet.assets.total)}</span>
                  </div>
                </div>
              </div>

              {/* Passif */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-rose-50 dark:bg-rose-900/20 px-4 py-3 border-b border-rose-100 dark:border-rose-900/30 font-bold text-rose-800 dark:text-rose-400 text-center uppercase text-sm">
                  Passif
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Capitaux Propres</h4>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Capital & Réserves (Cl. 1)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.equity)}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm text-brand-green font-medium mt-1">
                      <span>Résultat de l'exercice</span>
                      <span className="font-mono">{formatCurrency(data.incomeStatement.netIncome)}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Dettes</h4>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Dettes Fournisseurs & Fiscales (Cl. 4)</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.debts)}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    <span>TOTAL PASSIF</span>
                    <span>{formatCurrency(data.balanceSheet.liabilities.total + data.incomeStatement.netIncome)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'cash' ? (
          <div className="p-4 sm:p-8 max-w-3xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase">Tableau des Flux de Trésorerie</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Période en cours</p>
            </div>

            <div className="space-y-6">
              {/* Flux d'Exploitation */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Flux d'Exploitation</span>
                  <span className={cn("font-mono font-bold text-sm sm:text-base", data.cashFlow.operating >= 0 ? "text-brand-green" : "text-rose-600")}>
                    {formatCurrency(data.cashFlow.operating)}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 italic">Résultat net + Amortissements (Simplifié)</p>
              </div>

              {/* Flux d'Investissement */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Flux d'Investissement</span>
                  <span className={cn("font-mono font-bold text-sm sm:text-base", data.cashFlow.investing >= 0 ? "text-brand-green" : "text-rose-600")}>
                    {formatCurrency(data.cashFlow.investing)}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 italic">Acquisitions d'immobilisations</p>
              </div>

              {/* Flux de Financement */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Flux de Financement</span>
                  <span className={cn("font-mono font-bold text-sm sm:text-base", data.cashFlow.financing >= 0 ? "text-brand-green" : "text-rose-600")}>
                    {formatCurrency(data.cashFlow.financing)}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 italic">Nouveaux emprunts et capitaux</p>
              </div>

              {/* Synthèse */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center text-base sm:text-lg font-bold">
                  <span className="text-slate-900 dark:text-white">Variation Nette de Trésorerie</span>
                  <span className={cn("font-mono", data.cashFlow.netChange >= 0 ? "text-brand-green" : "text-rose-600")}>
                    {formatCurrency(data.cashFlow.netChange)}
                  </span>
                </div>

                <div className="space-y-2 pt-4">
                  <div className="flex justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    <span>Trésorerie au début de la période</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.cashFlow.startBalance)}</span>
                  </div>
                  <div className="flex justify-between text-sm sm:text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Trésorerie à la fin de la période</span>
                    <span className="font-mono">{formatCurrency(data.cashFlow.endBalance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-8 max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase">Ratios de Performance & Structure</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Analyse de la santé financière</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Liquidity */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Liquidité Générale</h3>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase",
                    ratios!.liquidity > 1.2 ? "bg-brand-green/20 text-brand-green-dark dark:text-brand-green" : "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  )}>
                    {ratios!.liquidity > 1.2 ? 'Optimale' : 'À surveiller'}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{ratios!.liquidity.toFixed(2)}</div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Capacité à payer les dettes de court terme avec l'actif circulant.</p>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-[10px] sm:text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Fonds de Roulement Net</span>
                    <span className={cn("font-bold", ratios!.workingCapital >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(ratios!.workingCapital)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Margin */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Marge Nette</h3>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase",
                    ratios!.netMargin > 10 ? "bg-brand-green/20 text-brand-green-dark dark:text-brand-green" : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  )}>
                    {ratios!.netMargin > 10 ? 'Rentable' : 'Standard'}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{ratios!.netMargin.toFixed(1)}%</div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Part du bénéfice net dans le chiffre d'affaires total.</p>
              </div>

              {/* Solvency */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Autonomie Financière</h3>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase",
                    ratios!.solvency > 30 ? "bg-brand-green/20 text-brand-green-dark dark:text-brand-green" : "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  )}>
                    {ratios!.solvency > 30 ? 'Solide' : 'Endettée'}
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{ratios!.solvency.toFixed(1)}%</div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Part des capitaux propres dans le financement de l'actif total.</p>
              </div>

              {/* ROE */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Rentabilité des Capitaux (ROE)</h3>
                  <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-[8px] sm:text-[10px] font-bold uppercase">
                    Performance
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{ratios!.roe.toFixed(1)}%</div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Capacité de l'entreprise à générer du profit avec l'argent des associés.</p>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
              <h4 className="text-blue-900 dark:text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm sm:text-base">
                <AlertCircle size={18} />
                Interprétation des Ratios
              </h4>
              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                Ces ratios sont calculés sur la base des données comptables actuelles. Une liquidité supérieure à 1 indique que l'entreprise peut faire face à ses engagements immédiats. Une autonomie financière supérieure à 30% est généralement exigée par les banques pour l'octroi de crédits.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
