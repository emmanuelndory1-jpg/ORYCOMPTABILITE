import React, { useState, useEffect } from 'react';
import { Download, Filter, Search, FileText, Printer, FileSpreadsheet } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import { useCurrency } from '@/hooks/useCurrency';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';

interface TrialBalanceEntry {
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
}

export function TrialBalance() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [data, setData] = useState<TrialBalanceEntry[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filter, setFilter] = useState('');

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

  useEffect(() => {
    fetchData();
    fetchCompanySettings();
  }, [startDate, endDate, activeYear?.id]);

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/company/settings');
      const data = await res.json();
      setCompanySettings(data);
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res = await fetch(`/api/reports/trial-balance?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    item.code.includes(filter) || item.name.toLowerCase().includes(filter.toLowerCase())
  );

  const totalDebit = filteredData.reduce((acc, curr) => acc + curr.debit, 0);
  const totalCredit = filteredData.reduce((acc, curr) => acc + curr.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 1;

  const handleExportCSV = () => {
    const csvData = filteredData.map(row => ({
      code: row.code,
      name: row.name,
      debit: row.debit,
      credit: row.credit,
      balance: row.balance
    }));
    exportToCSV(csvData, `Balance_Generale_${new Date().toISOString().split('T')[0]}`, ['Code', 'Name', 'Debit', 'Credit', 'Balance']);
  };

  const handleExportExcel = () => {
    const excelData = filteredData.map(row => ({
      Code: row.code,
      Intitulé: row.name,
      'Mouvements Débit': row.debit,
      'Mouvements Crédit': row.credit,
      'Solde Débiteur': row.balance > 0 ? row.balance : 0,
      'Solde Créditeur': row.balance < 0 ? Math.abs(row.balance) : 0
    }));
    
    import('../lib/exportUtils').then(utils => {
      utils.exportToExcel(excelData, `Balance_Generale_${new Date().toISOString().split('T')[0]}`, 'BALANCE');
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const settings = companySettings || { name: PDF_CONFIG.companyName };
    
    const subtitle = (startDate || endDate) 
      ? `Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`
      : "Toute la période";

    const startY = addPDFHeader(doc, settings, "BALANCE GÉNÉRALE", subtitle);

    const tableBody: any[][] = filteredData.map(row => [
      row.code,
      sanitizeText(row.name),
      formatCurrencyPDF(row.debit),
      formatCurrencyPDF(row.credit),
      formatCurrencyPDF(row.balance > 0 ? row.balance : 0),
      formatCurrencyPDF(row.balance < 0 ? Math.abs(row.balance) : 0)
    ]);

    // Totals
    tableBody.push([
      { content: 'TOTAUX GÉNÉRAUX', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
      { content: formatCurrencyPDF(totalDebit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: formatCurrencyPDF(totalCredit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
      { content: formatCurrencyPDF(totalDebit - totalCredit), colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } }
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['Compte', 'Intitulé', 'Mvts Débit', 'Mvts Crédit', 'Solde Débiteur', 'Solde Créditeur']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: PDF_CONFIG.colors.primary as [number, number, number],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || startY;

    import('../lib/exportUtils').then(utils => {
      utils.addPDFSignature(doc, finalY + 15);
      addPDFFooter(doc);
      doc.save(`Balance_Generale_${new Date().toISOString().split('T')[0]}.pdf`);
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Balance Générale</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Synthèse des comptes et vérification de l'équilibre</p>
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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
        <div className="flex flex-col gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
            <Filter size={16} className="text-brand-green" /> Période d'analyse
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setQuickRange('month')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Mois</button>
            <button onClick={() => setQuickRange('quarter')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Trimestre</button>
            <button onClick={() => setQuickRange('year')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Cette Année</button>
            <button onClick={() => setQuickRange('all')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Tout</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-4 flex-1">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date début</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date fin</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
          <div className="sm:col-span-2 lg:flex-[2]">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rechercher un compte</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Code ou nom..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Balance Status */}
      <div className={cn(
        "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
        isBalanced ? "bg-brand-green/5 border-brand-green/20 text-brand-green" : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-400"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full flex-shrink-0", isBalanced ? "bg-brand-green" : "bg-rose-500 animate-pulse")} />
          <span className="font-medium text-sm sm:text-base">
            {isBalanced ? "Balance Équilibrée" : "Balance Déséquilibrée - Vérifiez vos écritures !"}
          </span>
        </div>
        <div className="font-mono font-bold text-sm sm:text-base">
          Écart : {formatCurrency(Math.abs(totalDebit - totalCredit))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 font-medium w-24">Compte</th>
                <th className="px-6 py-3 font-medium">Intitulé</th>
                <th className="px-6 py-3 font-medium text-right w-32 bg-slate-100/50 dark:bg-slate-800/30">Mvts Débit</th>
                <th className="px-6 py-3 font-medium text-right w-32 bg-slate-100/50 dark:bg-slate-800/30">Mvts Crédit</th>
                <th className="px-6 py-3 font-medium text-right w-32">Solde Débiteur</th>
                <th className="px-6 py-3 font-medium text-right w-32">Solde Créditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">Chargement...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">Aucune donnée trouvée.</td></tr>
              ) : (
                <>
                  {filteredData.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">{row.code}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{row.name}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20">
                        {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-slate-500 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20">
                        {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-medium text-brand-green-light">
                        {row.balance > 0 ? formatCurrency(row.balance) : '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-medium text-rose-700 dark:text-rose-400">
                        {row.balance < 0 ? formatCurrency(Math.abs(row.balance)) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-slate-700">
                    <td colSpan={2} className="px-6 py-4 text-right uppercase text-xs tracking-wider">Totaux Généraux</td>
                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(totalDebit)}</td>
                    <td className="px-6 py-4 text-right font-mono">{formatCurrency(totalCredit)}</td>
                    <td className="px-6 py-4 text-right font-mono text-brand-green">
                      {formatCurrency(filteredData.reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0))}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-rose-800 dark:text-rose-400">
                      {formatCurrency(Math.abs(filteredData.reduce((acc, curr) => acc + (curr.balance < 0 ? curr.balance : 0), 0)))}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
