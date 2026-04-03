import React, { useState, useEffect } from 'react';
import { 
  Repeat, 
  Plus, 
  Search, 
  Calendar, 
  ArrowRight, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Filter,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';

interface RecurringTransactionLine {
  id?: number;
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
}

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  next_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  current_occurrences: number;
  last_processed: string | null;
  debit_account: string;
  credit_account: string;
  category: string;
  active: number;
  auto_process: number;
  lines?: RecurringTransactionLine[];
}

export function RecurringTransactions() {
  const { confirm, alert: dialogAlert } = useDialog();
  const [transactions, setTransactions] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const { formatCurrency } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    frequency: 'monthly' as const,
    next_date: new Date().toISOString().split('T')[0],
    end_date: '',
    max_occurrences: '',
    category: 'Général',
    auto_process: false,
    lines: [
      { account_code: '', debit: 0, credit: 0, description: '' },
      { account_code: '', debit: 0, credit: 0, description: '' }
    ] as RecurringTransactionLine[]
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/recurring-transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate lines balance
    const totalDebit = formData.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      dialogAlert("L'écriture n'est pas équilibrée (Débit != Crédit)", "error");
      return;
    }

    if (totalDebit === 0) {
      dialogAlert("Le montant total doit être supérieur à zéro", "error");
      return;
    }

    try {
      const response = await fetch('/api/recurring-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: totalDebit,
          max_occurrences: formData.max_occurrences ? parseInt(formData.max_occurrences) : null,
          end_date: formData.end_date || null
        })
      });
      if (response.ok) {
        setIsModalOpen(false);
        setFormData({
          description: '',
          amount: '',
          frequency: 'monthly',
          next_date: new Date().toISOString().split('T')[0],
          end_date: '',
          max_occurrences: '',
          category: 'Général',
          auto_process: false,
          lines: [
            { account_code: '', debit: 0, credit: 0, description: '' },
            { account_code: '', debit: 0, credit: 0, description: '' }
          ]
        });
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error creating recurring transaction:', error);
    }
  };

  const handleProcessAll = async () => {
    const today = new Date().toISOString().split('T')[0];
    const dueCount = transactions.filter(t => t.active && t.next_date <= today).length;
    
    if (dueCount === 0) {
      dialogAlert("Aucune écriture n'est en attente pour aujourd'hui.", "info");
      return;
    }

    const confirmed = await confirm(`Voulez-vous traiter les ${dueCount} écritures récurrentes en attente ?`);
    if (!confirmed) return;

    setIsProcessingAll(true);
    try {
      const response = await fetch('/api/recurring-transactions/process-all', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        dialogAlert(`${data.processedCount} écritures ont été générées avec succès.`, "success");
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error processing all transactions:', error);
    } finally {
      setIsProcessingAll(false);
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account_code: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 2) return;
    const newLines = [...formData.lines];
    newLines.splice(index, 1);
    setFormData({ ...formData, lines: newLines });
  };

  const updateLine = (index: number, field: keyof RecurringTransactionLine, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const handleProcess = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const confirmed = await confirm(`Voulez-vous générer l'écriture comptable pour "${tx.description}" maintenant ? La prochaine échéance sera décalée.`);
    if (!confirmed) return;

    setIsProcessing(id);
    try {
      const response = await fetch(`/api/recurring-transactions/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      if (response.ok) {
        dialogAlert("L'écriture comptable a été générée avec succès.", "success");
        fetchTransactions();
      } else {
        const data = await response.json();
        dialogAlert(data.error || "Erreur lors de la génération de l'écriture.", "error");
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
      dialogAlert("Une erreur réseau est survenue.", "error");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Êtes-vous sûr de vouloir supprimer cette écriture récurrente ?');
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/recurring-transactions/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchTransactions();
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.debit_account.includes(searchQuery) ||
    t.credit_account.includes(searchQuery)
  );

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'Hebdomadaire';
      case 'monthly': return 'Mensuel';
      case 'quarterly': return 'Trimestriel';
      case 'annually': return 'Annuel';
      default: return freq;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Repeat className="text-brand-green" />
            Écritures Récurrentes
          </h1>
          <p className="text-slate-500 text-sm">Gérez vos écritures automatiques (loyers, abonnements, etc.)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessAll}
            disabled={isProcessingAll}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-semibold transition-all shadow-sm disabled:opacity-50"
          >
            {isProcessingAll ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} className="text-brand-green" />}
            Traiter les échéances
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-brand-green/20"
          >
            <Plus size={20} />
            Nouvelle Récurrence
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand-green/10 text-brand-green rounded-lg">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Actives</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{transactions.filter(t => t.active).length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Calendar size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">À venir ce mois</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {transactions.filter(t => {
              const next = new Date(t.next_date);
              const now = new Date();
              return next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <Repeat size={20} />
            </div>
            <span className="text-sm font-medium text-slate-500">Montant total mensuel</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(transactions.reduce((acc, t) => {
              if (t.frequency === 'monthly') return acc + t.amount;
              if (t.frequency === 'quarterly') return acc + (t.amount / 3);
              if (t.frequency === 'annually') return acc + (t.amount / 12);
              return acc;
            }, 0))}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par description ou compte..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-green rounded-xl text-sm outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtres</span>
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-brand-green" size={40} />
            <p className="text-slate-500 animate-pulse">Chargement des récurrences...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fréquence</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Montant</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comptes (D/C)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Prochaine Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{tx.description}</div>
                      <div className="text-xs text-slate-500">{tx.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        tx.frequency === 'monthly' ? "bg-blue-100 text-blue-700" :
                        tx.frequency === 'quarterly' ? "bg-purple-100 text-purple-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {getFrequencyLabel(tx.frequency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {tx.lines && tx.lines.length > 0 ? (
                          tx.lines.map((line, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-[10px] font-mono">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded",
                                line.debit > 0 ? "text-brand-green bg-brand-green/10" : "text-blue-600 bg-blue-50"
                              )}>
                                {line.account_code}
                              </span>
                              <span className="text-slate-400">
                                {line.debit > 0 ? formatCurrency(line.debit) : formatCurrency(line.credit)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded">{tx.debit_account}</span>
                            <ArrowRight size={12} className="text-slate-300" />
                            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{tx.credit_account}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(tx.next_date).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleProcess(tx.id)}
                          disabled={isProcessing === tx.id}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-bold",
                            isProcessing === tx.id 
                              ? "bg-slate-100 text-slate-400" 
                              : "bg-brand-green/10 text-brand-green hover:bg-brand-green hover:text-white"
                          )}
                          title="Générer l'écriture maintenant"
                        >
                          {isProcessing === tx.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                          Générer
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Repeat size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Aucune écriture récurrente</h3>
            <p className="text-slate-500 max-w-xs mx-auto mb-6">Automatisez vos écritures répétitives pour gagner du temps et éviter les oublis.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 text-brand-green font-bold hover:underline"
            >
              <Plus size={18} />
              Créer votre première récurrence
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="text-brand-green" />
                  Nouvelle Écriture Récurrente
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-sm font-bold text-slate-700">Description de la récurrence</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      placeholder="Ex: Loyer mensuel bureau"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Fréquence</label>
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    >
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuel</option>
                      <option value="quarterly">Trimestriel</option>
                      <option value="annually">Annuel</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Catégorie</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      placeholder="Ex: Charges fixes"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Première Échéance</label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      value={formData.next_date}
                      onChange={(e) => setFormData({ ...formData, next_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Date de fin (Optionnel)</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nombre max d'occurrences</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none"
                      placeholder="Illimité si vide"
                      value={formData.max_occurrences}
                      onChange={(e) => setFormData({ ...formData, max_occurrences: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <input
                      type="checkbox"
                      id="auto_process"
                      className="w-5 h-5 rounded border-slate-300 text-brand-green focus:ring-brand-green"
                      checked={formData.auto_process}
                      onChange={(e) => setFormData({ ...formData, auto_process: e.target.checked })}
                    />
                    <label htmlFor="auto_process" className="text-sm font-bold text-slate-700 cursor-pointer">
                      Génération automatique (Auto-process)
                    </label>
                  </div>
                </div>

                {/* Lines Editor */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Lignes de l'écriture</h3>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-xs font-bold text-brand-green hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} /> Ajouter une ligne
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.lines.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Compte</label>
                          <input
                            required
                            type="text"
                            className="w-full px-3 py-1.5 bg-white border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-brand-green"
                            placeholder="Ex: 613"
                            value={line.account_code}
                            onChange={(e) => updateLine(idx, 'account_code', e.target.value)}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Débit</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-white border-slate-200 rounded-lg text-xs outline-none focus:border-brand-green"
                            value={line.debit || ''}
                            onChange={(e) => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Crédit</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-1.5 bg-white border-slate-200 rounded-lg text-xs outline-none focus:border-brand-green"
                            value={line.credit || ''}
                            onChange={(e) => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Libellé</label>
                          <input
                            type="text"
                            className="w-full px-3 py-1.5 bg-white border-slate-200 rounded-lg text-xs outline-none focus:border-brand-green"
                            placeholder="Optionnel"
                            value={line.description || ''}
                            onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center px-4 py-2 bg-slate-900 rounded-xl text-white">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Équilibré</div>
                    <div className="flex gap-6 font-mono text-sm font-bold">
                      <div className="text-brand-green">D: {formatCurrency(formData.lines.reduce((s, l) => s + (l.debit || 0), 0))}</div>
                      <div className="text-blue-400">C: {formatCurrency(formData.lines.reduce((s, l) => s + (l.credit || 0), 0))}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green-dark transition-colors shadow-lg shadow-brand-green/20"
                  >
                    Créer la Récurrence
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
