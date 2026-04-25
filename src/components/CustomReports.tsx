import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader2, Calendar, Filter, 
  FileSpreadsheet, Search, ChevronDown, ChevronUp,
  Settings2, Check, X, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { exportToCSV, addPDFHeader, addPDFFooter, PDF_CONFIG } from '@/lib/exportUtils';
import { formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Account {
  code: string;
  name: string;
  type: string;
}

interface ReportRow {
  account_code: string;
  account_name: string;
  date?: string;
  description?: string;
  reference?: string;
  total_debit?: number;
  total_credit?: number;
  debit?: number;
  credit?: number;
}

export function CustomReports() {
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  
  const [reportType, setReportType] = useState<'balance-sheet' | 'income-statement'>('balance-sheet');
  const [startDate, setStartDate] = useState(activeYear?.start_date || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(activeYear?.end_date || new Date().toISOString().split('T')[0]);
  const [isDetailed, setIsDetailed] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [includeReference, setIncludeReference] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [accountSearch, setAccountSearch] = useState('');

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        setAccounts(data);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        startDate,
        endDate,
        detailed: String(isDetailed),
      });
      
      if (selectedAccounts.length > 0) {
        params.append('accountCodes', selectedAccounts.join(','));
      }

      const res = await fetch(`/api/reports/custom?${params.toString()}`);
      const data = await res.json();
      setReportData(data);
      setShowFilters(false);
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = (code: string) => {
    setSelectedAccounts(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filteredAccounts = accounts.filter(acc => 
    (acc.code.includes(accountSearch) || acc.name.toLowerCase().includes(accountSearch.toLowerCase())) &&
    (reportType === 'balance-sheet' ? ['1','2','3','4','5'].includes(acc.code[0]) : ['6','7'].includes(acc.code[0]))
  );

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = reportType === 'balance-sheet' ? 'BILAN PERSONNALISÉ' : 'COMPTE DE RÉSULTAT PERSONNALISÉ';
    const subtitle = `Période du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`;
    
    const nextY = addPDFHeader(doc, { name: 'OryCompta' } as any, title, subtitle);

    const headers = isDetailed 
      ? ['Compte', 'Date', 'Libellé', 'Référence', 'Débit', 'Crédit']
      : ['Compte', 'Intitulé', 'Total Débit', 'Total Crédit', 'Solde'];

    const body = reportData.map(row => {
      if (isDetailed) {
        return [
          `${row.account_code} - ${row.account_name}`,
          row.date || '',
          row.description || '',
          row.reference || '',
          formatCurrencyPDF(row.debit || 0),
          formatCurrencyPDF(row.credit || 0)
        ];
      } else {
        const balance = (row.total_debit || 0) - (row.total_credit || 0);
        return [
          row.account_code,
          row.account_name,
          formatCurrencyPDF(row.total_debit || 0),
          formatCurrencyPDF(row.total_credit || 0),
          formatCurrencyPDF(balance)
        ];
      }
    });

    autoTable(doc, {
      startY: nextY,
      head: [headers],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    addPDFFooter(doc);
    doc.save(`Rapport_Custom_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = isDetailed 
      ? ['Compte', 'Intitulé', 'Date', 'Description', 'Référence', 'Débit', 'Crédit']
      : ['Compte', 'Intitulé', 'Total Débit', 'Total Crédit', 'Solde'];

    const data = reportData.map(row => {
      if (isDetailed) {
        return {
          Compte: row.account_code,
          Intitulé: row.account_name,
          Date: row.date,
          Description: row.description,
          Référence: row.reference,
          Débit: row.debit,
          Crédit: row.credit
        };
      } else {
        return {
          Compte: row.account_code,
          Intitulé: row.account_name,
          'Total Débit': row.total_debit,
          'Total Crédit': row.total_credit,
          Solde: (row.total_debit || 0) - (row.total_credit || 0)
        };
      }
    });

    exportToCSV(data, `Rapport_Custom_${reportType}`, headers);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Rapports Personnalisés</h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Générez vos propres états financiers sur mesure</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-xl border transition-all",
              showFilters 
                ? "bg-brand-green/10 border-brand-green text-brand-green" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
            )}
          >
            <Settings2 size={20} />
          </button>
          {reportData.length > 0 && (
            <>
              <button 
                onClick={handleExportCSV}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <FileSpreadsheet size={18} />
                CSV
              </button>
              <button 
                onClick={handleExportPDF}
                className="bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
              >
                <Download size={18} />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Type & Dates */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-brand-green uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} />
                  Période & Type
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Type de Rapport</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button
                        onClick={() => setReportType('balance-sheet')}
                        className={cn(
                          "py-2 text-xs font-bold rounded-lg transition-all",
                          reportType === 'balance-sheet' ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" : "text-slate-500"
                        )}
                      >
                        Bilan
                      </button>
                      <button
                        onClick={() => setReportType('income-statement')}
                        className={cn(
                          "py-2 text-xs font-bold rounded-lg transition-all",
                          reportType === 'income-statement' ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" : "text-slate-500"
                        )}
                      >
                        Résultat
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Du</label>
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Au</label>
                      <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Accounts Selection */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-brand-gold uppercase tracking-widest flex items-center gap-2">
                  <Filter size={14} />
                  Sélection des Comptes
                </h3>
                
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text"
                      placeholder="Filtrer les comptes..."
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-brand-green/20"
                    />
                  </div>

                  <div className="h-48 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                    {filteredAccounts.map(acc => (
                      <button
                        key={acc.code}
                        onClick={() => toggleAccount(acc.code)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors",
                          selectedAccounts.includes(acc.code)
                            ? "bg-brand-green/10 text-brand-green"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black">{acc.code}</span>
                          <span className="text-xs font-bold truncate max-w-[150px]">{acc.name}</span>
                        </div>
                        {selectedAccounts.includes(acc.code) && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{selectedAccounts.length} sélectionnés</span>
                    <button 
                      onClick={() => setSelectedAccounts([])}
                      className="text-[10px] text-rose-500 font-black uppercase hover:underline"
                    >
                      Effacer
                    </button>
                  </div>
                </div>
              </div>

              {/* Options & Fields */}
              <div className="space-y-6">
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 size={14} />
                  Options & Champs
                </h3>
                
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer group">
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      isDetailed ? "bg-blue-500 border-blue-500" : "border-slate-300 dark:border-slate-600 group-hover:border-blue-400"
                    )}>
                      {isDetailed && <Check size={12} className="text-white" />}
                    </div>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={isDetailed}
                      onChange={(e) => setIsDetailed(e.target.checked)}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Rapport Détaillé</p>
                      <p className="text-[10px] text-slate-400">Affiche chaque transaction individuelle</p>
                    </div>
                  </label>

                  {isDetailed && (
                    <div className="space-y-3 pl-8 animate-in slide-in-from-left-2 duration-200">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={includeReference}
                          onChange={(e) => setIncludeReference(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-green focus:ring-brand-green/20"
                        />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Inclure Référence</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={includeDescription}
                          onChange={(e) => setIncludeDescription(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-green focus:ring-brand-green/20"
                        />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Inclure Description</span>
                      </label>
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <div className="flex gap-2 text-blue-600 dark:text-blue-400 mb-2">
                      <Info size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Note</span>
                    </div>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      Le rapport détaillé peut être volumineux si la période est longue. Privilégiez des plages de dates courtes pour une meilleure lisibilité.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={generateReport}
                disabled={loading}
                className="bg-brand-green hover:bg-brand-green-dark disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg shadow-brand-green/20"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                Générer le Rapport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Results */}
      {reportData.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {reportType === 'balance-sheet' ? 'Bilan' : 'Compte de Résultat'} {isDetailed ? 'Détaillé' : 'Synthétique'}
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Période du {new Date(startDate).toLocaleDateString()} au {new Date(endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Lignes</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{reportData.length}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Compte</th>
                  {isDetailed ? (
                    <>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                      {includeDescription && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>}
                      {includeReference && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Référence</th>}
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Débit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Crédit</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Intitulé</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Débit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Crédit</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Solde</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {reportData.map((row, idx) => {
                  const balance = (row.total_debit || 0) - (row.total_credit || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{row.account_code}</span>
                          {isDetailed && <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{row.account_name}</span>}
                        </div>
                      </td>
                      {isDetailed ? (
                        <>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">{row.date}</td>
                          {includeDescription && <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">{row.description}</td>}
                          {includeReference && <td className="px-6 py-4 text-xs font-mono text-slate-400">{row.reference}</td>}
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white text-right">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white text-right">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400">{row.account_name}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white text-right">{formatCurrency(row.total_debit || 0)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white text-right">{formatCurrency(row.total_credit || 0)}</td>
                          <td className={cn(
                            "px-6 py-4 text-xs font-black text-right",
                            balance >= 0 ? "text-brand-green" : "text-rose-500"
                          )}>
                            {formatCurrency(balance)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {!isDetailed && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-black">
                    <td colSpan={2} className="px-6 py-4 text-xs uppercase tracking-widest text-slate-900 dark:text-white">Totaux</td>
                    <td className="px-6 py-4 text-xs text-right text-slate-900 dark:text-white">
                      {formatCurrency(reportData.reduce((sum, r) => sum + (r.total_debit || 0), 0))}
                    </td>
                    <td className="px-6 py-4 text-xs text-right text-slate-900 dark:text-white">
                      {formatCurrency(reportData.reduce((sum, r) => sum + (r.total_credit || 0), 0))}
                    </td>
                    <td className="px-6 py-4 text-xs text-right text-brand-green">
                      {formatCurrency(reportData.reduce((sum, r) => sum + ((r.total_debit || 0) - (r.total_credit || 0)), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 p-20 text-center">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Settings2 size={40} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Aucun rapport généré</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Utilisez le panneau de configuration ci-dessus pour définir vos critères et générer votre rapport personnalisé.
          </p>
        </div>
      )}
    </div>
  );
}
