import React, { useState, useEffect } from 'react';
import { Download, Filter, Search, FileText, Printer, FileSpreadsheet } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import { useCurrency } from '@/hooks/useCurrency';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';

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
  const [ledgerData, setLedgerData] = useState<AccountLedger[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  useEffect(() => {
    fetchLedger();
    fetchCompanySettings();
  }, [startDate, endDate]);

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/company/settings');
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
      
      const res = await fetch(`/api/reports/general-ledger?${params.toString()}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = ledgerData.filter(acc => 
    acc.code.includes(accountFilter) || acc.name.toLowerCase().includes(accountFilter.toLowerCase())
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
      utils.addPDFSignature(doc, yPos);
      addPDFFooter(doc);
      doc.save(`Grand_Livre_${new Date().toISOString().split('T')[0]}.pdf`);
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Grand Livre</h1>
          <p className="text-slate-500 dark:text-slate-400">Détail des mouvements par compte</p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mb-2 w-full sm:w-auto">
          <Filter size={16} /> Filtres
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
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rechercher un compte</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              placeholder="Code ou nom du compte..."
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
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
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-2 text-slate-600 dark:text-slate-400">{entry.date}</td>
                        <td className="px-6 py-2 text-slate-500 dark:text-slate-500 text-xs">{entry.reference || '-'}</td>
                        <td className="px-6 py-2 text-slate-900 dark:text-white">{entry.description}</td>
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
    </div>
  );
}
