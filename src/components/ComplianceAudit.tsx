import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw, Download, Pencil, Save, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { suggestCorrection } from '@/services/geminiService';

interface AuditIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type: 'balance' | 'account' | 'missing_data' | 'format';
  message: string;
  transactionId?: number;
  details?: string;
}

interface JournalEntry {
  id?: number;
  account_code: string;
  debit: number;
  credit: number;
  account_name?: string;
}

interface TransactionDetail {
  id: number;
  date: string;
  description: string;
  reference: string;
  notes?: string;
  entries: JournalEntry[];
}

interface AuditReport {
  score: number;
  totalTransactions: number;
  issues: AuditIssue[];
  lastRun: string;
}

export function ComplianceAudit() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [correctingTx, setCorrectingTx] = useState<TransactionDetail | null>(null);
  const [currentIssue, setCurrentIssue] = useState<AuditIssue | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [accounts, setAccounts] = useState<{code: string, name: string}[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance/audit');
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrect = async (issue: AuditIssue) => {
    if (!issue.transactionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/${issue.transactionId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCorrectingTx(data);
      setCurrentIssue(issue);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du chargement de la transaction");
    } finally {
      setLoading(false);
    }
  };

  const handleAISuggestion = async () => {
    if (!correctingTx || !currentIssue) return;
    setSuggesting(true);
    try {
      const suggestion = await suggestCorrection(correctingTx, currentIssue, accounts);
      if (suggestion) {
        setCorrectingTx({
          ...correctingTx,
          entries: suggestion.entries
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!correctingTx) return;

    // Basic validation: check if balanced
    const totalDebit = correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
    const totalCredit = correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      if (!confirm(`Attention: L'écriture n'est pas équilibrée (Diff: ${Math.abs(totalDebit - totalCredit).toFixed(2)}). Voulez-vous quand même enregistrer ?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${correctingTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctingTx)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setCorrectingTx(null);
        // Re-run audit to update the list
        runAudit();
      } else {
        const error = await res.json();
        alert(`Erreur: ${error.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const addEntry = () => {
    if (!correctingTx) return;
    setCorrectingTx({
      ...correctingTx,
      entries: [...correctingTx.entries, { account_code: '', debit: 0, credit: 0 }]
    });
  };

  const removeEntry = (index: number) => {
    if (!correctingTx) return;
    const newEntries = [...correctingTx.entries];
    newEntries.splice(index, 1);
    setCorrectingTx({ ...correctingTx, entries: newEntries });
  };

  const updateEntry = (index: number, field: keyof JournalEntry, value: any) => {
    if (!correctingTx) return;
    const newEntries = [...correctingTx.entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setCorrectingTx({ ...correctingTx, entries: newEntries });
  };

  const handleExportPDF = () => {
    if (!report) return;

    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('fr-FR');

    // Header
    doc.setFontSize(18);
    doc.text("Rapport de Conformite SYSCOHADA", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date du rapport : ${today}`, 14, 30);
    doc.text(`Score de conformite : ${report.score}%`, 14, 36);

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resume des Anomalies", 14, 50);

    const tableBody = report.issues.map(issue => [
      issue.severity === 'high' ? 'Critique' : issue.severity === 'medium' ? 'Majeur' : 'Mineur',
      issue.type.toUpperCase(),
      sanitizeText(issue.message),
      sanitizeText(issue.details || '')
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Gravite', 'Type', 'Probleme', 'Details']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        3: { cellWidth: 80 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const severity = data.cell.raw;
          if (severity === 'Critique') data.cell.styles.textColor = [225, 29, 72]; // Rose-600
          if (severity === 'Majeur') data.cell.styles.textColor = [217, 119, 6]; // Amber-600
          if (severity === 'Mineur') data.cell.styles.textColor = [37, 99, 235]; // Blue-600
        }
      }
    });

    doc.save(`Rapport_Conformite_${today.replace(/\//g, '-')}.pdf`);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conformité & Audit</h1>
          <p className="text-slate-500">Vérification des règles SYSCOHADA et cohérence comptable</p>
        </div>
        <div className="flex gap-2">
          {report && (
            <button 
              onClick={handleExportPDF}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              <Download size={18} />
              Exporter PDF
            </button>
          )}
          <button 
            onClick={runAudit}
            disabled={loading}
            className="bg-brand-green hover:bg-brand-green-light disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            Lancer l'audit
          </button>
        </div>
      </div>

      {!report && !loading && (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-slate-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucun rapport disponible</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Lancez une analyse pour vérifier la conformité de vos écritures comptables aux normes SYSCOHADA Révisé.
          </p>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Score Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4",
                report.score >= 90 ? "border-brand-green text-brand-green bg-brand-green/10" :
                report.score >= 70 ? "border-amber-500 text-amber-600 bg-amber-50" :
                "border-rose-500 text-rose-600 bg-rose-50"
              )}>
                {report.score}%
              </div>
              <div>
                <div className="text-sm text-slate-500 font-medium uppercase">Score de Conformité</div>
                <div className="font-bold text-slate-900">
                  {report.score >= 90 ? "Excellent" : report.score >= 70 ? "Moyen" : "Critique"}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-sm text-slate-500 font-medium uppercase mb-2">Écritures Analysées</div>
              <div className="text-3xl font-bold text-slate-900">{report.totalTransactions}</div>
              <div className="text-xs text-slate-400 mt-1">Transactions totales</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-sm text-slate-500 font-medium uppercase mb-2">Anomalies Détectées</div>
              <div className="text-3xl font-bold text-rose-600">{report.issues.length}</div>
              <div className="text-xs text-slate-400 mt-1">Problèmes à corriger</div>
            </div>
          </div>

          {/* Issues List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Détail des Anomalies</h3>
              <span className="text-xs text-slate-500">Dernière analyse : {new Date(report.lastRun).toLocaleString()}</span>
            </div>
            
            {report.issues.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-12 text-center"
              >
                <CheckCircle className="text-brand-green w-12 h-12 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-900">Tout est conforme !</h4>
                <p className="text-slate-500">Aucune anomalie détectée dans votre comptabilité.</p>
              </motion.div>
            ) : (
              <div className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {report.issues.map((issue) => (
                    <motion.div 
                      key={issue.id} 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="p-6 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn("p-2 rounded-lg shrink-0", getSeverityColor(issue.severity))}>
                          <AlertTriangle size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase", getSeverityColor(issue.severity))}>
                              {issue.severity === 'high' ? 'Critique' : issue.severity === 'medium' ? 'Majeur' : 'Mineur'}
                            </span>
                            <span className="text-xs text-slate-500 font-mono uppercase bg-slate-100 px-2 py-0.5 rounded">
                              {issue.type}
                            </span>
                            {issue.transactionId && (
                              <span className="text-xs text-slate-400">
                                Transaction #{issue.transactionId}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900">{issue.message}</h4>
                          {issue.details && (
                            <p className="text-sm text-slate-600 mt-1">{issue.details}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => issue.transactionId && handleCorrect(issue)}
                          className="text-sm text-brand-green font-medium hover:underline flex items-center gap-1"
                        >
                          <Pencil size={14} />
                          Corriger
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correction Modal */}
      <AnimatePresence>
        {isModalOpen && correctingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center text-brand-green">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Correction d'Écriture</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Transaction #{correctingTx.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date</label>
                    <input 
                      type="date"
                      value={correctingTx.date}
                      onChange={(e) => setCorrectingTx({ ...correctingTx, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Référence / Pièce</label>
                    <input 
                      type="text"
                      value={correctingTx.reference}
                      onChange={(e) => setCorrectingTx({ ...correctingTx, reference: e.target.value })}
                      placeholder="Ex: FACT-2024-001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Libellé de l'opération</label>
                    <input 
                      type="text"
                      value={correctingTx.description}
                      onChange={(e) => setCorrectingTx({ ...correctingTx, description: e.target.value })}
                      placeholder="Description de la transaction..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      Lignes d'Écritures
                      <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {correctingTx.entries.length} lignes
                      </span>
                    </h4>
                    <button 
                      onClick={addEntry}
                      className="text-xs bg-brand-green/10 text-brand-green hover:bg-brand-green/20 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus size={14} />
                      Ajouter une ligne
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Compte</th>
                          <th className="px-4 py-3 w-32">Débit</th>
                          <th className="px-4 py-3 w-32">Crédit</th>
                          <th className="px-4 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {correctingTx.entries.map((entry, idx) => (
                          <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2">
                              <div className="flex flex-col gap-1">
                                <input 
                                  type="text"
                                  value={entry.account_code}
                                  onChange={(e) => updateEntry(idx, 'account_code', e.target.value)}
                                  placeholder="Code compte (ex: 6011)"
                                  className="w-full bg-transparent border-none focus:ring-0 p-0 font-mono text-brand-green font-bold placeholder:font-normal placeholder:text-slate-300"
                                />
                                <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                  {accounts.find(a => a.code === entry.account_code)?.name || "Compte inconnu"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number"
                                value={entry.debit || ''}
                                onChange={(e) => updateEntry(idx, 'debit', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-right font-medium"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number"
                                value={entry.credit || ''}
                                onChange={(e) => updateEntry(idx, 'credit', parseFloat(e.target.value) || 0)}
                                className="w-full bg-transparent border-none focus:ring-0 p-0 text-right font-medium"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => removeEntry(idx)}
                                className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50/50 font-bold text-slate-900 border-t border-slate-100">
                        <tr>
                          <td className="px-4 py-3 text-right text-xs uppercase text-slate-500">Totaux</td>
                          <td className={cn(
                            "px-4 py-3 text-right",
                            correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) !== correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0) ? "text-rose-600" : "text-brand-green"
                          )}>
                            {correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0).toLocaleString()}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right",
                            correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) !== correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0) ? "text-rose-600" : "text-brand-green"
                          )}>
                            {correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0).toLocaleString()}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  {Math.abs(correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) - correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)) > 0.01 && (
                    <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 text-sm">
                      <AlertTriangle size={16} />
                      <span>L'écriture est déséquilibrée d'un montant de <strong>{Math.abs(correctingTx.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0) - correctingTx.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0)).toLocaleString()}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <button 
                  onClick={handleAISuggestion}
                  disabled={suggesting}
                  className="text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all border border-brand-gold/20"
                >
                  {suggesting ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Suggestion IA
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleSaveCorrection}
                    disabled={saving}
                    className="bg-brand-green hover:bg-brand-green-light disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-green/20"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Enregistrer les corrections
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
