import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { Download, Filter, Search, FileText, Printer, FileSpreadsheet, X, Info, ExternalLink } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import { useCurrency } from '@/hooks/useCurrency';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';
import { PageHeader } from './ui/PageHeader';

interface LedgerEntry {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
}

interface AccountLedger {
  code: string;
  name: string;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
}

export function GeneralLedger() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [ledgerData, setLedgerData] = useState<AccountLedger[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [descriptionSearch, setDescriptionSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [txLoading, setTxLoading] = useState(false);

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
    fetchLedger();
    fetchCompanySettings();
  }, [startDate, endDate, activeYear?.id]);

  const fetchCompanySettings = async () => {
    try {
      const res = await apiFetch('/api/company/settings');
      const data = await res.json();
      setCompanySettings(data);
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res = await apiFetch(`/api/reports/general-ledger?${params.toString()}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTxClick = async (reference: string) => {
    if (!reference || reference === '-') return;
    setTxLoading(true);
    try {
      const res = await apiFetch(`/api/transactions/by-reference/${reference}`);
      if (res.ok) {
        setSelectedTx(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  };

  const filteredData = ledgerData
    .map(acc => ({
      ...acc,
      entries: acc.entries.filter(entry => 
        entry.description.toLowerCase().includes(descriptionSearch.toLowerCase()) ||
        (entry.reference || '').toLowerCase().includes(descriptionSearch.toLowerCase())
      )
    }))
    .filter(acc => 
      (acc.code.includes(accountFilter) || acc.name.toLowerCase().includes(accountFilter.toLowerCase())) &&
      acc.entries.length > 0
    );

  const handleExportCSV = () => {
    const csvData = filteredData.flatMap(acc => acc.entries.map(entry => ({
      account_code: acc.code,
      account_name: acc.name,
      date: entry.date,
      reference: entry.reference || '',
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit
    })));
    exportToCSV(csvData, `Grand_Livre_${new Date().toISOString().split('T')[0]}`, ['Account_Code', 'Account_Name', 'Date', 'Reference', 'Description', 'Debit', 'Credit']);
  };

  const handleExportExcel = () => {
    const excelData = filteredData.flatMap(acc => acc.entries.map(entry => ({
      'Code Compte': acc.code,
      'Nom Compte': acc.name,
      Date: entry.date,
      Référence: entry.reference || '',
      Libellé: entry.description,
      Débit: entry.debit,
      Crédit: entry.credit
    })));
    
    import('../lib/exportUtils').then(utils => {
      utils.exportToExcel(excelData, `Grand_Livre_${new Date().toISOString().split('T')[0]}`, 'GRAND_LIVRE');
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const settings = companySettings || { name: PDF_CONFIG.companyName };
    
    const subtitle = (startDate || endDate) 
      ? `Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`
      : "Toute la période";

    const startY = addPDFHeader(doc, settings, "GRAND LIVRE GÉNÉRAL", subtitle);
    let yPos = startY;

    filteredData.forEach(account => {
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Account Header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 248, 244); // Brand-green-50 equivalent
      doc.rect(14, yPos, 182, 10, 'F');
      doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
      doc.text(`Compte : ${account.code} - ${sanitizeText(account.name)}`, 16, yPos + 7);
      yPos += 15;

      const tableBody: any[][] = account.entries.map(entry => [
        entry.date,
        sanitizeText(entry.reference || '-'),
        sanitizeText(entry.description),
        formatCurrencyPDF(entry.debit),
        formatCurrencyPDF(entry.credit)
      ]);

      // Add totals row
      tableBody.push([
        { content: 'TOTAL PÉRIODE', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
        { content: formatCurrencyPDF(account.totalDebit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatCurrencyPDF(account.totalCredit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
      ]);

      // Add balance row
      const balance = account.totalDebit - account.totalCredit;
      const balanceLabel = balance > 0 ? 'SOLDE DÉBITEUR' : 'SOLDE CRÉDITEUR';
      tableBody.push([
        { content: balanceLabel, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } },
        { content: balance > 0 ? formatCurrencyPDF(balance) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
        { content: Math.abs(balance) > 0 && balance < 0 ? formatCurrencyPDF(Math.abs(balance)) : '', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Réf', 'Libellé', `Débit (${currency})`, `Crédit (${currency})`]],
        body: tableBody,
        theme: 'grid',
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: PDF_CONFIG.colors.primary as [number, number, number],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        },
        margin: { top: 20 },
        didDrawPage: (data) => {
          const str = "Page " + (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });

      // Update yPos for next account
      yPos = ((doc as any).lastAutoTable?.finalY || yPos) + 15;
    });

    import('../lib/exportUtils').then(utils => {
      utils.addOHADAComplianceSignature(doc, yPos, companySettings?.manager_name || "L'Administrateur");
      addPDFFooter(doc);
      doc.save(`Grand_Livre_${new Date().toISOString().split('T')[0]}.pdf`);
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <PageHeader
        title="Grand Livre"
        subtitle="Détail des mouvements par compte"
        actions={
          <>
            <button 
              onClick={handleExportCSV}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <FileSpreadsheet size={18} />
              CSV
            </button>
            <button 
              onClick={handleExportExcel}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <FileSpreadsheet size={18} className="text-brand-green" />
              Excel
            </button>
            <button 
              onClick={handleExportPDF}
              className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
            >
              <Download size={18} />
              PDF
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mb-2 w-full">
          <Filter size={16} className="text-brand-green" /> Période d'analyse
        </div>
        <div className="flex flex-wrap gap-2 mb-2 w-full">
          <button onClick={() => setQuickRange('month')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Mois</button>
          <button onClick={() => setQuickRange('quarter')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Ce Trimestre</button>
          <button onClick={() => setQuickRange('year')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Cette Année</button>
          <button onClick={() => setQuickRange('all')} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-brand-green/10 hover:text-brand-green transition-colors font-bold uppercase tracking-wider">Tout</button>
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date début</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date fin</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Filtrer par compte</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              placeholder="Code ou nom..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Chercher dans l'écriture</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={descriptionSearch}
              onChange={(e) => setDescriptionSearch(e.target.value)}
              placeholder="Libellé ou référence..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
            />
          </div>
        </div>
      </div>

      {/* Ledger Content */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Chargement du Grand Livre...</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
            Aucune écriture trouvée pour cette période.
          </div>
        ) : (
          filteredData.map((account) => (
            <div key={account.code} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span className="bg-white dark:bg-slate-950 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">{account.code}</span>
                  {account.name}
                </h3>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Solde : <span className={cn(account.totalDebit - account.totalCredit >= 0 ? "text-brand-green" : "text-rose-600 dark:text-rose-400")}>
                    {formatCurrency(account.totalDebit - account.totalCredit)}
                  </span>
                </div>
              </div>
              <div className="w-full min-w-0 overflow-auto ">
                <table className="w-full text-sm text-left min-w-[800px]">
                  <thead className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3 font-medium w-32">Date</th>
                      <th className="px-6 py-3 font-medium w-32">Réf</th>
                      <th className="px-6 py-3 font-medium">Libellé</th>
                      <th className="px-6 py-3 font-medium text-right w-40">Débit</th>
                      <th className="px-6 py-3 font-medium text-right w-40">Crédit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {account.entries.map((entry, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => handleTxClick(entry.reference)}
                        className={cn(
                          "transition-colors",
                          entry.reference && entry.reference !== '-' ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <td className="px-6 py-2 text-slate-600 dark:text-slate-400">{entry.date}</td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 dark:text-slate-500 text-xs font-mono">{entry.reference || '-'}</span>
                            {entry.reference && entry.reference !== '-' && <ExternalLink size={10} className="text-slate-300" />}
                          </div>
                        </td>
                        <td className="px-6 py-2 text-slate-900 dark:text-white font-medium">{entry.description}</td>
                        <td className="px-6 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </td>
                        <td className="px-6 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-800 dark:text-white">
                      <td colSpan={3} className="px-6 py-3 text-right">Total Période</td>
                      <td className="px-6 py-3 text-right font-mono text-brand-green-light">{formatCurrency(account.totalDebit)}</td>
                      <td className="px-6 py-3 text-right font-mono text-brand-green-light">{formatCurrency(account.totalCredit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-sm items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-green text-white rounded-2xl shadow-lg shadow-brand-green/20">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Détails de l'écriture</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedTx.reference}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      {new Date(selectedTx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Statut</p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        selectedTx.status === 'validated' ? "bg-brand-green/10 text-brand-green border border-brand-green/20" : "bg-amber-100 text-amber-700 border border-amber-200"
                      )}>
                        {selectedTx.status === 'validated' ? 'Validé' : 'Brouillon'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-lg font-black text-brand-green">
                      {formatCurrency(selectedTx.lines.reduce((sum: number, l: any) => sum + (l.debit || 0), 0))}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Écritures Comptables</h3>
                    <div className="h-px flex-1 mx-6 bg-slate-100 dark:bg-slate-800" />
                  </div>
                  
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="w-full min-w-0 overflow-auto ">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-black tracking-widest text-slate-500">
                        <tr>
                          <th className="px-6 py-4 text-left">Compte</th>
                          <th className="px-6 py-4 text-left">Libellé Ligne</th>
                          <th className="px-6 py-4 text-right">Débit</th>
                          <th className="px-6 py-4 text-right">Crédit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedTx.lines.map((line: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-mono text-xs text-brand-green font-bold">{line.account_code}</div>
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{line.account_name}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">{line.description || selectedTx.description}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  <Info size={14} />
                  Cliquer sur l'ID pour voir la pièce jointe
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:scale-105 transition-all"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Loading Overlay for Drill-down */}
      {txLoading && (
        <div className="fixed inset-0 z-[60] flex justify-center bg-slate-900/20 backdrop-blur-[2px] items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Chargement des détails...</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
