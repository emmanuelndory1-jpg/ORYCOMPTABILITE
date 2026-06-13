import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useDialog } from './DialogProvider';
import { useCurrency } from '@/hooks/useCurrency';
import { Save, Check, RotateCcw, AlertTriangle, FileText, Calculator, Download, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageHeader } from './ui/PageHeader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';

interface Account {
  code: string;
  name: string;
}

interface OpeningBalanceEntry {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export function OpeningBalances() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<OpeningBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'simple' | 'expert'>('simple');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  
  const { alert, confirm } = useDialog();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetchAccounts();
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const res = await apiFetch('/api/company/settings');
      const data = await res.json();
      setCompanySettings(data);
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/accounts');
      const data = await res.json();
      // Filter out root parent accounts and special accounts, typically we balance classes 1 to 5.
      // But let's show all detailed accounts.
      const detailed = data.filter((a: any) => a.code.length >= 2);
      setAccounts(detailed);
      
      // Initialize entries
      const initialEntries = detailed.map((a: any) => ({
        account_code: a.code,
        account_name: a.name,
        debit: 0,
        credit: 0
      }));
      setEntries(initialEntries);
    } catch (e) {
      console.error(e);
      alert("Erreur lors du chargement des comptes", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (activeEntries.length === 0) {
      return alert("Aucune balance saisie à exporter.", "info");
    }

    const doc = new jsPDF();
    const settings = companySettings || { name: PDF_CONFIG.companyName };
    
    let subtitle = `Mode: ${mode === 'simple' ? 'Simplifié' : 'Expert'}`;
    const startY = addPDFHeader(doc, settings as CompanySettings, "BILAN D'OUVERTURE (A-NOUVEAUX)", subtitle);

    const tableData = activeEntries.map(e => [
      sanitizeText(e.account_code),
      sanitizeText(e.account_name),
      formatCurrencyPDF(e.debit),
      formatCurrencyPDF(e.credit)
    ]);

    tableData.push([
      { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } } as any,
      { content: formatCurrencyPDF(totalDebit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } } as any,
      { content: formatCurrencyPDF(totalCredit), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } } as any
    ]);

    if (!isBalanced) {
      tableData.push([
        { content: 'ÉCART', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right', textColor: [225, 29, 72] } } as any,
        { content: formatCurrencyPDF(Math.abs(totalDebit - totalCredit)), colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', textColor: [225, 29, 72] } } as any
      ]);
    }

    autoTable(doc, {
      startY: startY + 10,
      head: [['Compte', 'Intitulé', 'Actif / Débit', 'Passif / Crédit']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: PDF_CONFIG.colors.primary as [number, number, number],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || startY + 20;
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, finalY + 10);

    addPDFFooter(doc);
    doc.save(`Bilan_Ouverture_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleEntryChange = (code: string, field: 'debit' | 'credit', value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]+/g,"")) || 0;
    
    setEntries(prev => prev.map(e => {
      if (e.account_code === code) {
        return {
          ...e,
          // Only allow one side to have a value, or just trust the user
          [field]: numValue,
          ...(field === 'debit' && numValue > 0 ? { credit: 0 } : {}),
          ...(field === 'credit' && numValue > 0 ? { debit: 0 } : {})
        };
      }
      return e;
    }));
  };

  const totalDebit = entries.reduce((acc, e) => acc + e.debit, 0);
  const totalCredit = entries.reduce((acc, e) => acc + e.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const activeEntries = entries.filter(e => e.debit > 0 || e.credit > 0);

  const handleSubmit = async () => {
    if (activeEntries.length === 0) {
      return alert("Veuillez saisir au moins un montant à l'actif ou au passif.", "error");
    }
    if (!isBalanced) {
      return alert(`La validation en temps réel a échoué : Le Total Actif doit être strictement égal au Total Passif. Veuillez corriger l'écart de ${formatCurrency(Math.abs(totalDebit - totalCredit))}.`, "error");
    }

    const validate = await confirm("Êtes-vous sûr de vouloir enregistrer ces balances d'ouverture ? Cette opération générera une écriture comptable d'A-Nouveaux.");

    if (!validate) return;

    setSubmitting(true);
    try {
      const yearStr = new Date().getFullYear().toString();
      const payload = {
        date: `${yearStr}-01-01`, // Usually 1st Jan
        description: "Reprise des balances d'ouverture (A-Nouveaux)",
        reference: `AN-${yearStr}`,
        status: 'validated', // Bilan d'ouverture is immutable
        entries: activeEntries.map(e => ({
          account_code: e.account_code,
          debit: e.debit,
          credit: e.credit
        }))
      };

      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Balances d'ouverture enregistrées avec succès.", "success");
        // Clear active entries
        setEntries(prev => prev.map(e => ({ ...e, debit: 0, credit: 0 })));
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de l'enregistrement", "error");
      }
    } catch (e) {
      alert("Erreur réseau.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEntries = entries.filter(e => 
    e.account_code.includes(search) || e.account_name.toLowerCase().includes(search.toLowerCase()) || e.debit > 0 || e.credit > 0
  );

  const getSimpleEntryValue = (prefix: string, type: 'debit' | 'credit') => {
    // Sum all entries with this prefix that have a value
    return entries.filter(e => e.account_code.startsWith(prefix)).reduce((sum, e) => sum + e[type], 0);
  };

  const handleSimpleEntryChange = (prefix: string, type: 'debit' | 'credit', value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.-]+/g,"")) || 0;
    
    const matchingAccount = accounts.find(a => a.code.startsWith(prefix));
    if (!matchingAccount) return;

    setEntries(prev => {
      const newEntries = [...prev];
      // clear existing ones with this prefix to avoid duplicates when grouping in simple mode
      newEntries.forEach(e => {
        if(e.account_code.startsWith(prefix)){
           e.debit = 0;
           e.credit = 0;
        }
      });
      const index = newEntries.findIndex(e => e.account_code === matchingAccount.code);
      if(index >= 0) {
        newEntries[index] = {
            ...newEntries[index],
            [type]: numValue,
            ...(type === 'debit' ? { credit: 0 } : { debit: 0 })
        };
      }
      return newEntries;
    });
  };

  const simpleAssets = [
    { label: 'Matériel, Équipement, Véhicules (Ce que l\'entreprise possède)', prefix: '21' },
    { label: 'Stock (Marchandises, matières premières en réserve)', prefix: '3' },
    { label: 'Créances Clients (Argent qu\'on vous doit)', prefix: '41' },
    { label: 'Solde en Banque', prefix: '51' },
    { label: 'Liquidités en Caisse', prefix: '53' },
  ];

  const simpleLiabilities = [
    { label: 'Capital Social (Apport personnel investit)', prefix: '10' },
    { label: 'Emprunts et Dettes Bancaires', prefix: '16' },
    { label: 'Dettes Fournisseurs (Factures que vous devez payer)', prefix: '40' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Bilan d'Ouverture (A-Nouveaux)" 
        subtitle="Saisissez les montants de l'actif et du passif pour initialiser votre comptabilité." 
        icon={<Calculator size={24} />} 
      />

      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-5 rounded-2xl flex gap-4 text-sm border border-blue-100 dark:border-blue-800/50 shadow-sm">
        <Info className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" size={24} />
        <div>
          <p className="font-bold text-base mb-1">Rappel : Qu'est-ce que le Bilan d'Ouverture ?</p>
          <p className="mb-3 opacity-90">
            C'est la photographie financière de l'entreprise au début de l'exercice, garantissant la fiabilité et la <strong>continuité comptable</strong>. 
            Il est indispensable lors de la création d'entreprise ou du changement de régime. Par <strong>principe d'intangibilité</strong>, il ne doit pas être modifié rétroactivement une fois l'exercice ouvert.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            <div>
              <p className="font-bold mb-1">1. L'Actif (Ce que l'entreprise possède)</p>
              <ul className="list-disc pl-4 space-y-1 opacity-80">
                <li>Immobilisations (matériels, véhicules)</li>
                <li>Stocks (marchandises)</li>
                <li>Créances clients et trésorerie (banque, caisse)</li>
              </ul>
            </div>
            <div>
              <p className="font-bold mb-1">2. Le Passif (Ce que l'entreprise doit)</p>
              <ul className="list-disc pl-4 space-y-1 opacity-80">
                <li>Capitaux propres (capital social, apports)</li>
                <li>Emprunts et dettes bancaires</li>
                <li>Dettes fournisseurs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 flex flex-col xl:flex-row gap-4 justify-between items-center">
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-sm font-bold w-full xl:w-auto">
              <button 
                onClick={() => setMode('simple')}
                className={cn("px-6 py-2 rounded-lg flex-1 xl:flex-none transition-all", mode === 'simple' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
              >
                 Mode Simplifié
              </button>
              <button 
                onClick={() => setMode('expert')}
                className={cn("px-6 py-2 rounded-lg flex-1 xl:flex-none transition-all", mode === 'expert' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
              >
                 Mode Expert (Plan Comptable)
              </button>
            </div>

            {mode === 'expert' && (
              <div className="w-full xl:w-72">
                <input
                  type="text"
                  placeholder="Rechercher un compte..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-4 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-green/20"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 items-center w-full xl:w-auto">
               <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-sm font-bold w-full sm:w-auto overflow-x-auto whitespace-nowrap">
                 <div className="px-4 py-1.5 rounded-lg text-slate-500 shrink-0">
                   Total Actif: <span className="text-slate-900 dark:text-white font-black ml-1">{formatCurrency(totalDebit)}</span>
                 </div>
                 <div className="px-4 py-1.5 rounded-lg text-slate-500 shrink-0">
                   Total Passif: <span className="text-slate-900 dark:text-white font-black ml-1">{formatCurrency(totalCredit)}</span>
                 </div>
                 <div className={cn("px-4 py-1.5 rounded-lg flex items-center gap-2 shrink-0", 
                    totalDebit === 0 && totalCredit === 0 ? "bg-slate-200 dark:bg-slate-700 text-slate-500" :
                    isBalanced ? "bg-brand-green/10 text-brand-green" : "bg-rose-500/10 text-rose-500")}>
                    {isBalanced ? <Check size={16} /> : <AlertTriangle size={16} className="animate-pulse" />} 
                    <div className="flex flex-col">
                      <span className="font-black text-sm">Écart: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>
                      {(!isBalanced && (totalDebit > 0 || totalCredit > 0)) && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">Actif ≠ Passif</span>
                      )}
                    </div>
                 </div>
               </div>
               
               <div className="flex items-center gap-2 w-full sm:w-auto">
                 <button 
                    onClick={handleExportPDF}
                    disabled={activeEntries.length === 0}
                    className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all flex-1 sm:flex-none"
                    title="Télécharger en PDF"
                 >
                   <Download size={18} />
                   <span className="hidden xl:inline">PDF</span>
                 </button>
                 
                 <button 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-brand-green text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all flex-1 sm:flex-none"
                 >
                   <Save size={18} />
                   Enregistrer
                 </button>
               </div>
            </div>
          </div>

          <div className="p-0 sm:p-6 overflow-x-auto">
            {mode === 'simple' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
                
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center font-black text-lg">+</div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">Ce que l'entreprise possède</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Actif (Total: {formatCurrency(totalDebit)})</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {simpleAssets.map(asset => (
                      <div key={asset.prefix} className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{asset.label}</label>
                        <div className="flex items-center gap-3">
                           <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">[{asset.prefix}...]</span>
                           <input 
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={getSimpleEntryValue(asset.prefix, 'debit') || ''}
                              onChange={(e) => handleSimpleEntryChange(asset.prefix, 'debit', e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green text-right font-mono transition-all"
                            />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black text-lg">-</div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">Ce que l'entreprise doit</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Passif (Total: {formatCurrency(totalCredit)})</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {simpleLiabilities.map(liability => (
                      <div key={liability.prefix} className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{liability.label}</label>
                        <div className="flex items-center gap-3">
                           <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">[{liability.prefix}...]</span>
                           <input 
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={getSimpleEntryValue(liability.prefix, 'credit') || ''}
                              onChange={(e) => handleSimpleEntryChange(liability.prefix, 'credit', e.target.value)}
                              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:border-brand-green focus:ring-1 focus:ring-brand-green text-right font-mono transition-all"
                            />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest min-w-[300px]">Compte</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right w-48">Actif / Débit</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right w-48">Passif / Crédit</th>
                </tr>
              </thead>
              <tbody>
                {['1', '2', '3', '4', '5'].map(classDigit => {
                  const classEntries = filteredEntries.filter(e => e.account_code.startsWith(classDigit));
                  if (classEntries.length === 0) return null;
                  
                  const classNames: Record<string, string> = {
                    '1': 'Comptes de capitaux (Passif)',
                    '2': 'Comptes d\'immobilisations (Actif)',
                    '3': 'Comptes de stocks (Actif)',
                    '4': 'Comptes de tiers (Actif/Passif)',
                    '5': 'Comptes financiers (Actif/Passif)'
                  };

                  return (
                    <React.Fragment key={classDigit}>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-y border-slate-200 dark:border-slate-700">
                        <td colSpan={3} className="p-3 px-4 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50">
                          Classe {classDigit} - {classNames[classDigit]}
                        </td>
                      </tr>
                      {classEntries.map(entry => (
                        <tr key={entry.account_code} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                {entry.account_code}
                              </div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.account_name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right cursor-text">
                            <input 
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={entry.debit || ''}
                              onChange={(e) => handleEntryChange(entry.account_code, 'debit', e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-brand-green focus:ring-0 text-right font-mono text-sm tracking-widest placeholder:text-slate-300"
                            />
                          </td>
                          <td className="p-4 text-right cursor-text">
                            <input 
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={entry.credit || ''}
                              onChange={(e) => handleEntryChange(entry.account_code, 'credit', e.target.value)}
                              className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-brand-green focus:ring-0 text-right font-mono text-sm tracking-widest placeholder:text-slate-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">Aucun compte trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>
      </div>
    </div>
  );
}
