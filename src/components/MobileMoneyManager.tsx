import React, { useState, useEffect } from 'react';
import { PageHeader } from './ui/PageHeader';
import { apiFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { Smartphone, RefreshCw, Send, Download, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDialog } from './DialogProvider';

export function MobileMoneyManager() {
  const { formatCurrency } = useCurrency();
  const { alert: showToast } = useDialog();
  const [activeTab, setActiveTab] = useState<'transactions' | 'payout' | 'reconcile'>('transactions');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutForm, setPayoutForm] = useState({ amount: '', phone: '', network: 'orange', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/mobile-money/transactions');
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!tx.created_at) return true;
    const txDate = new Date(tx.created_at).toISOString().split('T')[0];
    if (dateFilter.start && txDate < dateFilter.start) return false;
    if (dateFilter.end && txDate > dateFilter.end) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'Reseau', 'Type', 'Reference', 'Telephone', 'Montant', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        new Date(tx.created_at).toLocaleDateString(),
        tx.network || '',
        tx.type === 'payment' ? 'Reçu' : 'Envoyé',
        tx.reference || '',
        tx.customer_phone || '',
        tx.amount,
        tx.status || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mobile_money_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
       const res = await apiFetch('/api/mobile-money/payout', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payoutForm)
       });
       if (res.ok) {
         showToast('Transfert initié avec succès', 'success');
         setPayoutForm({ amount: '', phone: '', network: 'orange', description: '' });
         fetchTransactions();
         setActiveTab('transactions');
       } else {
         const err = await res.json();
         showToast(err.error || 'Erreur lors du transfert', 'error');
       }
    } catch (e) {
       console.error(e);
       showToast('Erreur réseau', 'error');
    } finally {
       setSubmitting(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
       const res = await apiFetch('/api/mobile-money/reconcile', { method: 'POST' });
       if (res.ok) {
         showToast('Rapprochement terminé avec succès.', 'success');
         fetchTransactions();
       } else {
         showToast('Erreur lors du rapprochement', 'error');
       }
    } catch (e) {
       console.error(e);
       showToast('Erreur lors du rapprochement', 'error');
    } finally {
       setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Mobile Money" 
        subtitle="Gérez vos paiements et transferts Orange Money, MTN et Wave"
        icon={<Smartphone className="w-6 h-6" />}
      />

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700/50 pb-px">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'transactions' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Historique
          {activeTab === 'transactions' && (
            <motion.div layoutId="mmTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('payout')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'payout' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Envoyer des fonds
          {activeTab === 'payout' && (
            <motion.div layoutId="mmTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('reconcile')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'reconcile' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Rapprochement
          {activeTab === 'reconcile' && (
            <motion.div layoutId="mmTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="font-semibold text-slate-900 dark:text-white">Transactions Récentes</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1 px-2">
                <input 
                  type="date" 
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                  className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none"
                />
                <span className="text-slate-400 text-sm">au</span>
                <input 
                  type="date" 
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                  className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none"
                />
              </div>
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Exporter CSV</span>
              </button>
              <button onClick={fetchTransactions} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg" title="Actualiser">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <div className="w-full min-w-0 overflow-auto ">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Réseau</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Référence</th>
                  <th className="p-4">Téléphone</th>
                  <th className="p-4 text-right">Montant</th>
                  <th className="p-4 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {filteredTransactions.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucune transaction trouvée</td></tr>
                ) : filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm">
                    <td className="p-4 text-slate-900 dark:text-slate-300">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 capitalize">{tx.network}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'payment' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tx.type === 'payment' ? 'Reçu' : 'Envoyé'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">{tx.reference || '-'}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 font-mono">{tx.customer_phone}</td>
                    <td className="p-4 text-right font-medium text-slate-900 dark:text-slate-200">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 flex justify-end">
                      {tx.status === 'approved' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {tx.status === 'pending' && <Clock className="h-5 w-5 text-amber-500" />}
                      {tx.status === 'failed' && <XCircle className="h-5 w-5 text-rose-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'payout' && (
        <form onSubmit={handlePayout} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm p-6 max-w-xl">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-6">Nouveau transfert (Fournisseur, Employé)</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Réseau</label>
              <select 
                value={payoutForm.network}
                onChange={e => setPayoutForm({...payoutForm, network: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3"
              >
                <option value="orange">Orange Money</option>
                <option value="mtn">MTN Mobile Money</option>
                <option value="wave">Wave</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numéro de téléphone</label>
              <input 
                type="text" 
                placeholder="Ex: 0102030405"
                required
                value={payoutForm.phone}
                onChange={e => setPayoutForm({...payoutForm, phone: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Montant</label>
              <input 
                type="number" 
                required
                min="100"
                value={payoutForm.amount}
                onChange={e => setPayoutForm({...payoutForm, amount: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motif</label>
              <input 
                type="text" 
                required
                value={payoutForm.description}
                onChange={e => setPayoutForm({...payoutForm, description: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Envoyer les fonds
            </button>
          </div>
        </form>
      )}

      {activeTab === 'reconcile' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm p-6 max-w-2xl text-center space-y-6">
          <div className="h-20 w-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
            <RefreshCw className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Rapprochement Automatique</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Synchronise les paiements en attente avec votre agrégateur Mobile Money (Orange Money, MTN, Wave). 
              Génère automatiquement les écritures comptables (Validation des factures, crédits bancaires).
            </p>
          </div>

          <button 
            onClick={handleReconcile}
            disabled={reconciling}
            className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium py-3 px-8 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors mx-auto disabled:opacity-50 min-w-[200px]"
          >
            {reconciling ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'Lancer l\'analyse'}
          </button>
          
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700/50 text-left">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">Ce qui est vérifié</h4>
            <ul className="space-y-3">
              <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                Mise à jour des statuts des factures ("En attente" ➔ "Payée")
              </li>
              <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                Passation des écritures en comptabilité via le compte 521 (Banque/Mobile)
              </li>
              <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                Actualisation des soldes comptes fournisseurs lors des décaissements
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
