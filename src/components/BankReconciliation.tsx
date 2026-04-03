import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  Plus, Calculator, ArrowRight, Check, Landmark, 
  Link as LinkIcon, ExternalLink, Search, Filter,
  History, Settings as SettingsIcon, X, ChevronRight
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { useDialog } from './DialogProvider';
import { useOutletContext } from 'react-router-dom';
import { aiReconcileBank } from '../services/geminiService';

interface BankAccount {
  id: number;
  name: string;
  account_number: string;
  bank_name: string;
  balance: number;
  currency: string;
  gl_account_code: string;
  last_synced?: string;
}

interface BankTransaction {
  id: string | number;
  date: string;
  description: string;
  amount: number;
  reference?: string;
  status?: 'pending' | 'matched';
  matched_gl_id?: number;
  matched_description?: string;
  matched_account?: string;
}

interface ReconciliationResult {
  bankTransactionId: string | number;
  status: 'matched' | 'unmatched';
  gl_id?: number;
  confidenceScore?: number;
  reason: string;
}

interface GLEntry {
  gl_id: number;
  account_code: string;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
}

export function BankReconciliation() {
  const { companySettings } = useOutletContext<{ companySettings: any }>();
  const { confirm, alert } = useDialog();

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [reconciliationResults, setReconciliationResults] = useState<ReconciliationResult[]>([]);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isCreateEntryModalOpen, setIsCreateEntryModalOpen] = useState(false);
  const [isManualMatchModalOpen, setIsManualMatchModalOpen] = useState(false);
  const [selectedTxForEntry, setSelectedTxForEntry] = useState<BankTransaction | null>(null);
  const [selectedTxForMatch, setSelectedTxForMatch] = useState<BankTransaction | null>(null);
  const [manualMatchSearch, setManualMatchSearch] = useState('');
  const [availableGLEntries, setAvailableGLEntries] = useState<GLEntry[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'pending'>('all');
  const [createEntryForm, setCreateEntryForm] = useState({
    accountCode: '',
    description: '',
    date: '',
    amount: 0
  });
  
  const [newAccount, setNewAccount] = useState({
    name: '',
    account_number: '',
    bank_name: '',
    balance: 0,
    currency: companySettings?.currency || 'XOF',
    gl_account_code: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  useEffect(() => {
    fetchBankAccounts();
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

  useEffect(() => {
    if (selectedAccountId) {
      fetchTransactions(selectedAccountId);
    }
  }, [selectedAccountId]);

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch('/api/bank-accounts');
      const data = await res.json();
      setBankAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async (accountId: number) => {
    try {
      const res = await fetch(`/api/bank-transactions/${accountId}`);
      const data = await res.json();
      setBankTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSync = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/bank-accounts/${selectedAccountId}/sync`, { method: 'POST' });
      if (res.ok) {
        await fetchTransactions(selectedAccountId);
        await fetchBankAccounts();
        alert("Synchronisation terminée.", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la synchronisation.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchBankAccounts();
        setSelectedAccountId(data.id);
        setIsAddAccountModalOpen(false);
        setNewAccount({
          name: '',
          account_number: '',
          bank_name: '',
          balance: 0,
          currency: companySettings?.currency || 'XOF',
          gl_account_code: ''
        });
        alert("Compte bancaire ajouté.", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du compte.", "error");
    }
  };

  const handleMatch = async (bankTransactionId: string | number, glId: number) => {
    try {
      const res = await fetch('/api/bank-reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId, glId })
      });
      if (res.ok) {
        if (selectedAccountId) fetchTransactions(selectedAccountId);
        setReconciliationResults(prev => prev.filter(r => r.bankTransactionId !== bankTransactionId));
        alert("Transaction rapprochée avec succès.", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors du rapprochement.", "error");
    }
  };

  const handleUnmatch = async (bankTransactionId: string | number) => {
    const confirmed = await confirm("Voulez-vous vraiment détacher ce rapprochement ?");
    if (!confirmed) return;

    try {
      const res = await fetch('/api/bank-reconciliation/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId })
      });
      if (res.ok) {
        if (selectedAccountId) fetchTransactions(selectedAccountId);
        alert("Transaction détachée avec succès.", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'opération.", "error");
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForEntry) return;

    try {
      const res = await fetch('/api/bank-reconciliation/create-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankTransactionId: selectedTxForEntry.id,
          ...createEntryForm
        })
      });

      if (res.ok) {
        if (selectedAccountId) {
          fetchTransactions(selectedAccountId);
          fetchBankAccounts();
        }
        setIsCreateEntryModalOpen(false);
        setSelectedTxForEntry(null);
        alert("Écriture créée et rapprochée.", "success");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création de l'écriture.", "error");
    }
  };

  const openCreateEntryModal = (tx: BankTransaction) => {
    setSelectedTxForEntry(tx);
    setCreateEntryForm({
      accountCode: '',
      description: tx.description,
      date: tx.date.split('T')[0],
      amount: tx.amount
    });
    setIsCreateEntryModalOpen(true);
  };

  const openManualMatchModal = async (tx: BankTransaction) => {
    setSelectedTxForMatch(tx);
    setIsManualMatchModalOpen(true);
    setManualMatchSearch('');
    
    // Fetch potential GL entries for this account
    if (selectedAccountId) {
      try {
        const account = bankAccounts.find(a => a.id === selectedAccountId);
        const glCode = account?.gl_account_code || companySettings?.payment_bank_account || '521';
        const res = await fetch(`/api/journal-entries?account_code=${glCode}&unreconciled=true`);
        const data = await res.json();
        setAvailableGLEntries(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: companySettings?.currency || 'XOF' 
    }).format(amount);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed = results.data.map((row: any, index) => {
            const amountStr = row['Amount'] || row['Montant'] || row['Debit'] || row['Credit'] || Object.values(row)[2];
            let amount = 0;
            if (amountStr) {
              const cleanStr = String(amountStr).replace(/[^\d.,-]/g, '').replace(',', '.');
              amount = parseFloat(cleanStr);
            }

            return {
              date: row['Date'] || Object.values(row)[0] || new Date().toISOString().split('T')[0],
              description: row['Description'] || row['Libellé'] || Object.values(row)[1] || 'Transaction inconnue',
              amount: amount,
              reference: row['Reference'] || row['Référence'] || ''
            };
          });

          if (selectedAccountId) {
            fetch(`/api/bank-accounts/${selectedAccountId}/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactions: parsed })
            }).then(res => {
              if (res.ok) {
                fetchTransactions(selectedAccountId);
                alert(`${parsed.length} transactions importées.`, "success");
              }
            }).catch(err => {
              console.error(err);
              alert("Erreur lors de l'importation.", "error");
            });
          }
        } catch (error) {
          console.error("Erreur de parsing CSV:", error);
          alert("Erreur lors de la lecture du fichier CSV.", "error");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("Erreur PapaParse:", error);
        alert("Erreur lors de l'importation.", "error");
        setIsUploading(false);
      }
    });
  };

  const handleReconcile = async () => {
    if (bankTransactions.length === 0) {
      alert("Veuillez d'abord importer ou synchroniser des transactions.", "info");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Fetch GL entries and other data for reconciliation from backend
      const account = bankAccounts.find(a => a.id === selectedAccountId);
      const glCode = account?.gl_account_code || companySettings?.payment_bank_account || '521';
      
      const dataRes = await fetch(`/api/ai/reconcile-data?account_code=${glCode}`);
      if (!dataRes.ok) throw new Error("Erreur lors de la récupération des données de rapprochement");
      const { glEntries: fetchedGlEntries } = await dataRes.json();

      // 2. Call AI service on frontend
      const pendingTxs = bankTransactions.filter(tx => tx.status !== 'matched');
      const result = await aiReconcileBank(pendingTxs, fetchedGlEntries);
      
      if (!result) throw new Error("Erreur lors du rapprochement par l'IA");

      setReconciliationResults(result);
      setGlEntries(fetchedGlEntries);
    } catch (error) {
      console.error(error);
      alert("Une erreur est survenue lors du rapprochement.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const getGLEntry = (gl_id?: number) => {
    return glEntries.find(entry => entry.gl_id === gl_id);
  };

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const matchedCount = bankTransactions.filter(tx => tx.status === 'matched').length;
  const pendingCount = bankTransactions.filter(tx => tx.status !== 'matched').length;

  const filteredTransactions = bankTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         tx.reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'matched' && tx.status === 'matched') ||
                         (statusFilter === 'pending' && tx.status !== 'matched');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="text-indigo-600" />
            Rapprochement Bancaire
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Gérez vos comptes et vérifiez vos opérations bancaires.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Connecter une Banque
          </button>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isProcessing}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? <RefreshCw className="animate-spin" size={18} /> : <Upload size={18} />}
            Importer CSV
          </button>
          <button
            onClick={handleReconcile}
            disabled={bankTransactions.length === 0 || isProcessing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Calculator size={18} />}
            Rapprochement IA
          </button>
        </div>
      </div>

      {/* Accounts Selection & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Account List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mes Comptes</h3>
          <div className="space-y-2">
            {bankAccounts.map(account => (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all group",
                  selectedAccountId === account.id
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-tight",
                    selectedAccountId === account.id ? "text-indigo-100" : "text-slate-400"
                  )}>
                    {account.bank_name}
                  </span>
                  <ChevronRight size={16} className={cn(
                    "transition-transform",
                    selectedAccountId === account.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                  )} />
                </div>
                <div className="font-bold truncate">{account.name}</div>
                <div className={cn(
                  "text-lg font-mono mt-2",
                  selectedAccountId === account.id ? "text-white" : "text-slate-900 dark:text-white"
                )}>
                  {formatCurrency(account.balance)}
                </div>
              </button>
            ))}
            {bankAccounts.length === 0 && (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-sm text-slate-500">Aucun compte connecté</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {selectedAccount ? (
            <>
              {/* Account Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500 font-medium">Solde Bancaire</span>
                    <Landmark size={16} className="text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(selectedAccount.balance)}</div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <History size={10} />
                    Dernière synchro: {selectedAccount.last_synced ? new Date(selectedAccount.last_synced).toLocaleString('fr-FR') : 'Jamais'}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500 font-medium">Opérations Rapprochées</span>
                    <CheckCircle2 size={16} className="text-brand-green" />
                  </div>
                  <div className="text-2xl font-bold text-brand-green">{matchedCount}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Sur un total de {bankTransactions.length}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500 font-medium">À Traiter</span>
                    <AlertCircle size={16} className="text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
                  <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="text-[10px] text-indigo-600 font-bold hover:underline mt-1 flex items-center gap-1"
                  >
                    {isSyncing ? <RefreshCw className="animate-spin" size={10} /> : <RefreshCw size={10} />}
                    Synchroniser maintenant
                  </button>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h2 className="font-bold text-slate-800 dark:text-white">Transactions Bancaires</h2>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">Tous</option>
                      <option value="matched">Rapprochés</option>
                      <option value="pending">En attente</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-4">Date</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Montant</th>
                        <th className="p-4 text-center">Statut</th>
                        <th className="p-4">Correspondance GL</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredTransactions.map(tx => {
                        const result = reconciliationResults.find(r => r.bankTransactionId === tx.id);
                        const isMatched = tx.status === 'matched';
                        const aiMatched = result?.status === 'matched';
                        
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="p-4 text-slate-500 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-slate-900 dark:text-white">{tx.description}</div>
                              {tx.reference && <div className="text-[10px] text-slate-400">Réf: {tx.reference}</div>}
                            </td>
                            <td className={cn(
                              "p-4 text-right font-mono font-bold",
                              tx.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-white"
                            )}>
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-4 text-center">
                              {isMatched ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold uppercase">
                                  <Check size={10} /> Rapproché
                                </span>
                              ) : aiMatched ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] font-bold uppercase">
                                  <Calculator size={10} /> IA: {result.confidenceScore}%
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-500 text-[10px] font-bold uppercase">
                                  En attente
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {isMatched ? (
                                <div className="text-xs">
                                  <div className="font-medium text-slate-700 dark:text-slate-300">{tx.matched_description}</div>
                                  <div className="text-slate-400">Compte: {tx.matched_account}</div>
                                </div>
                              ) : aiMatched ? (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-xs">
                                  <div className="font-medium text-indigo-900 dark:text-indigo-300">{getGLEntry(result.gl_id)?.description}</div>
                                  <div className="text-indigo-600 dark:text-indigo-400 mt-1 flex justify-between">
                                    <span>Cpte: {getGLEntry(result.gl_id)?.account_code}</span>
                                    <span className="font-bold">Match</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic">
                                  {result?.reason || "Aucune correspondance"}
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-1">
                                {isMatched ? (
                                  <button 
                                    onClick={() => handleUnmatch(tx.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                    title="Détacher le rapprochement"
                                  >
                                    <X size={16} />
                                  </button>
                                ) : (
                                  <>
                                    {aiMatched && (
                                      <button 
                                        onClick={() => handleMatch(tx.id, result.gl_id!)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg transition-colors shadow-sm"
                                        title="Valider le rapprochement suggéré"
                                      >
                                        <Check size={16} />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => openManualMatchModal(tx)}
                                      className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                      title="Rapprochement manuel"
                                    >
                                      <LinkIcon size={16} />
                                    </button>
                                    <button 
                                      onClick={() => openCreateEntryModal(tx)}
                                      className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                      title="Créer une écriture"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {bankTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                              <RefreshCw size={32} className="opacity-20" />
                              <p>Aucune transaction à afficher.</p>
                              <button onClick={handleSync} className="text-indigo-600 font-bold text-sm hover:underline">Synchroniser maintenant</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="max-w-sm mx-auto space-y-4">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 mx-auto">
                  <Landmark size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Connectez votre banque</h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Pour commencer le rapprochement, vous devez d'abord connecter un compte bancaire ou importer un relevé CSV.
                </p>
                <button 
                  onClick={() => setIsAddAccountModalOpen(true)}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-md shadow-indigo-100"
                >
                  Ajouter un Compte
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plus className="text-indigo-600" />
                Nouveau Compte Bancaire
              </h2>
              <button onClick={() => setIsAddAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nom du Compte</label>
                  <input
                    required
                    type="text"
                    placeholder="ex: Compte Courant Principal"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.name}
                    onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Banque</label>
                  <input
                    required
                    type="text"
                    placeholder="ex: Société Générale"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.bank_name}
                    onChange={e => setNewAccount({...newAccount, bank_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">N° de Compte</label>
                  <input
                    required
                    type="text"
                    placeholder="XXXX XXXX XXXX"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.account_number}
                    onChange={e => setNewAccount({...newAccount, account_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Solde Initial</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.balance}
                    onChange={e => setNewAccount({...newAccount, balance: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Devise</label>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.currency}
                    onChange={e => setNewAccount({...newAccount, currency: e.target.value})}
                  >
                    <option value="XOF">FCFA (XOF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar (USD)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte Comptable (GL)</label>
                  <select
                    required
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAccount.gl_account_code}
                    onChange={e => setNewAccount({...newAccount, gl_account_code: e.target.value})}
                  >
                    <option value="">Sélectionner un compte...</option>
                    {accounts.filter(a => a.code.startsWith(companySettings?.payment_bank_account?.substring(0, 2) || '52')).map(acc => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Create Entry Modal */}
      {isCreateEntryModalOpen && selectedTxForEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Plus className="text-indigo-600" />
                Créer une Écriture
              </h2>
              <button onClick={() => setIsCreateEntryModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Transaction Bancaire</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="font-medium text-slate-900 dark:text-white">{selectedTxForEntry.description}</div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-500">{new Date(selectedTxForEntry.date).toLocaleDateString('fr-FR')}</span>
                    <span className={cn("font-mono font-bold text-sm", selectedTxForEntry.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-white")}>
                      {formatCurrency(selectedTxForEntry.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Compte de Contrepartie</label>
                <select
                  required
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={createEntryForm.accountCode}
                  onChange={e => setCreateEntryForm({...createEntryForm, accountCode: e.target.value})}
                >
                  <option value="">Sélectionner un compte...</option>
                  {accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Libellé de l'Écriture</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={createEntryForm.description}
                  onChange={e => setCreateEntryForm({...createEntryForm, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={createEntryForm.date}
                    onChange={e => setCreateEntryForm({...createEntryForm, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Montant</label>
                  <input
                    disabled
                    type="text"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 outline-none"
                    value={formatCurrency(createEntryForm.amount)}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateEntryModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                >
                  Créer l'Écriture
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Manual Match Modal */}
      {isManualMatchModalOpen && selectedTxForMatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <LinkIcon className="text-indigo-600" />
                Rapprochement Manuel
              </h2>
              <button onClick={() => setIsManualMatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Bank Transaction Info */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Transaction Bancaire</label>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{selectedTxForMatch.description}</div>
                    <div className="text-xs text-slate-500">{new Date(selectedTxForMatch.date).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div className={cn("font-mono font-bold", selectedTxForMatch.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-white")}>
                    {formatCurrency(selectedTxForMatch.amount)}
                  </div>
                </div>
              </div>

              {/* Search and List of GL Entries */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher une écriture (description, référence...)"
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    value={manualMatchSearch}
                    onChange={e => setManualMatchSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {availableGLEntries.filter(entry => 
                    entry.description.toLowerCase().includes(manualMatchSearch.toLowerCase()) ||
                    entry.reference?.toLowerCase().includes(manualMatchSearch.toLowerCase())
                  ).length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Search size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucune écriture trouvée pour cette recherche.</p>
                    </div>
                  ) : availableGLEntries
                    .filter(entry => 
                      entry.description.toLowerCase().includes(manualMatchSearch.toLowerCase()) ||
                      entry.reference?.toLowerCase().includes(manualMatchSearch.toLowerCase())
                    )
                    .map(entry => {
                      const entryAmount = entry.debit > 0 ? entry.debit : -entry.credit;
                      const isAmountMatch = Math.abs(entryAmount - selectedTxForMatch.amount) < 0.01;
                      
                      return (
                        <div 
                          key={entry.gl_id}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer group",
                            isAmountMatch 
                              ? "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10" 
                              : "border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                          )}
                          onClick={() => {
                            handleMatch(selectedTxForMatch.id, entry.gl_id);
                            setIsManualMatchModalOpen(false);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                {entry.description}
                                {isAmountMatch && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase">Montant Exact</span>
                                )}
                              </div>
                              <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                                <span>{new Date(entry.date).toLocaleDateString('fr-FR')}</span>
                                <span>Réf: {entry.reference || 'N/A'}</span>
                                <span>Compte: {entry.account_code}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                {formatCurrency(entryAmount)}
                              </div>
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase mt-1">
                                Sélectionner
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {availableGLEntries.length === 0 && (
                    <div className="text-center py-8 text-slate-400 italic text-sm">
                      Aucune écriture non rapprochée trouvée pour ce compte.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setIsManualMatchModalOpen(false)}
                className="px-6 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
