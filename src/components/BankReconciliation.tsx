import { triggerCloudBackup } from '@/lib/backup';
import { apiFetch } from '../lib/api';
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  Plus, Calculator, ArrowRight, Check, Landmark, 
  Link as LinkIcon, ExternalLink, Search, Filter,
  History, Settings as SettingsIcon, X, ChevronRight,
  Download, Sparkles, ShieldCheck, Lock, Unlock, MessageSquare,
  AlertTriangle
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
  is_locked?: boolean | number;
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
  const { alert: dialogAlert } = useDialog();
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
  const [isCsvMappingModalOpen, setIsCsvMappingModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState({
    date: '',
    description: '',
    amount: '',
    reference: ''
  });
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isCreateEntryModalOpen, setIsCreateEntryModalOpen] = useState(false);
  const [isManualMatchModalOpen, setIsManualMatchModalOpen] = useState(false);
  const [isForcedMatchModalOpen, setIsForcedMatchModalOpen] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [activeTab, setActiveTab] = useState<'compare' | 'history'>('compare');
  const [selectedTxForEntry, setSelectedTxForEntry] = useState<BankTransaction | null>(null);
  const [selectedTxForMatch, setSelectedTxForMatch] = useState<BankTransaction | null>(null);
  const [manualMatchSearch, setManualMatchSearch] = useState('');
  const [availableGLEntries, setAvailableGLEntries] = useState<GLEntry[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [glSearchTerm, setGlSearchTerm] = useState('');
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
      const res = await apiFetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      fetchTransactions(selectedAccountId);
      fetchAvailableGLEntries();
    }
  }, [selectedAccountId]);

  const fetchAvailableGLEntries = async () => {
    if (!selectedAccountId) return;
    try {
      const account = bankAccounts.find(a => a.id === selectedAccountId);
      const glCode = account?.gl_account_code || companySettings?.payment_bank_account || '521';
      const res = await apiFetch(`/api/journal-entries?account_code=${glCode}&unreconciled=true`);
      const data = await res.json();
      setAvailableGLEntries(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await apiFetch('/api/bank-accounts');
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
      const res = await apiFetch(`/api/bank-transactions/${accountId}`);
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
      const res = await apiFetch(`/api/bank-accounts/${selectedAccountId}/sync`, { method: 'POST' });
      if (res.ok) {
        await fetchTransactions(selectedAccountId);
        await fetchBankAccounts();
        dialogAlert("Synchronisation terminée.", "success");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la synchronisation.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/bank-accounts', {
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
        dialogAlert("Compte bancaire ajouté.", "success");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de l'ajout du compte.", "error");
    }
  };

  const handleMagicMatch = async () => {
    if (bankTransactions.length === 0) return;
    
    setIsProcessing(true);
    try {
      const account = bankAccounts.find(a => a.id === selectedAccountId);
      const glCode = account?.gl_account_code || companySettings?.payment_bank_account || '521';
      
      const dataRes = await apiFetch(`/api/bank-reconciliation/available-gl?account_code=${glCode}`);
      const { glEntries: availableGl } = await dataRes.json();
      
      const pendingTxs = bankTransactions.filter(tx => tx.status !== 'matched');
      let matchCount = 0;
      
      for (const tx of pendingTxs) {
        // Look for exact match: same date (ignoring time) and same amount
        const txDate = tx.date.split('T')[0];
        const exactMatch = availableGl.find((gl: any) => {
          const glDate = gl.date.split('T')[0];
          const glAmount = gl.debit > 0 ? gl.debit : -gl.credit;
          return glDate === txDate && Math.abs(glAmount - tx.amount) < 0.01;
        });
        
        if (exactMatch) {
          await apiFetch('/api/bank-reconciliation/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bankTransactionId: tx.id, glId: exactMatch.gl_id })
          });
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        if (selectedAccountId) {
          fetchTransactions(selectedAccountId);
          fetchAvailableGLEntries();
        }
        dialogAlert(`${matchCount} transactions ont été rapprochées via Magic Match !`, "success");
      } else {
        dialogAlert("Aucune correspondance exacte trouvée.", "info");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors du Magic Match.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const [selectedGLEntryId, setSelectedGLEntryId] = useState<number | null>(null);

  const handleMatch = async (bankTransactionId: string | number, glId: number, reason?: string) => {
    try {
      const res = await apiFetch('/api/bank-reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId, glId, reason })
      });
      if (res.ok) {
        if (selectedAccountId) {
          fetchTransactions(selectedAccountId);
          fetchAvailableGLEntries();
        }
        setReconciliationResults(prev => prev.filter(r => r.bankTransactionId !== bankTransactionId));
        if (isForcedMatchModalOpen) setIsForcedMatchModalOpen(false);
        dialogAlert("Transaction rapprochée avec succès.", "success");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors du rapprochement.", "error");
    }
  };

  const handleUnmatch = async (bankTransactionId: string | number) => {
    const confirmed = await confirm("Voulez-vous vraiment détacher ce rapprochement ?");
    if (!confirmed) return;

    try {
      const res = await apiFetch('/api/bank-reconciliation/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankTransactionId })
      });
      if (res.ok) {
        if (selectedAccountId) fetchTransactions(selectedAccountId);
        dialogAlert("Transaction détachée avec succès.", "success");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de l'opération.", "error");
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForEntry) return;

    try {
      const res = await apiFetch('/api/bank-reconciliation/create-entry', {
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
        dialogAlert("Écriture créée et rapprochée.", "success");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la création de l'écriture.", "error");
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
    
    // Refresh available entries
    fetchAvailableGLEntries();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: companySettings?.currency || 'XOF' 
    }).format(amount);
  };

  const handleExportOFX = async () => {
    if (!selectedAccountId) return;
    window.location.href = `/api/export/ofx/${selectedAccountId}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAccountId) {
      dialogAlert("Veuillez sélectionner un compte bancaire avant d'importer un relevé.", "info");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const headers = Object.keys(results.data[0]);
          setCsvHeaders(headers);
          setCsvData(results.data);
          
          // Try to auto-map
          const mapping = {
            date: headers.find(h => /date/i.test(h)) || headers[0],
            description: headers.find(h => /desc|libel|motif/i.test(h)) || headers[1],
            amount: headers.find(h => /montant|amount|debit|valeur/i.test(h)) || headers[2],
            reference: headers.find(h => /ref/i.test(h)) || ''
          };
          setCsvMapping(mapping);
          setIsCsvMappingModalOpen(true);
        }
        setIsUploading(false);
      },
      error: (error) => {
        console.error("Erreur PapaParse:", error);
        dialogAlert("Erreur lors de la lecture du fichier CSV.", "error");
        setIsUploading(false);
      }
    });
  };

  const confirmCsvImport = async () => {
    if (!selectedAccountId || csvData.length === 0) return;

    setIsUploading(true);
    try {
      const parsed = csvData.map(row => {
        const amountStr = row[csvMapping.amount];
        let amount = 0;
        if (amountStr !== undefined) {
          const cleanStr = String(amountStr).replace(/[^\d.,-]/g, '').replace(',', '.');
          amount = parseFloat(cleanStr);
        }

        return {
          date: row[csvMapping.date] || new Date().toISOString().split('T')[0],
          description: row[csvMapping.description] || 'Transaction inconnue',
          amount: amount,
          reference: csvMapping.reference ? row[csvMapping.reference] : ''
        };
      });

      const res = await apiFetch(`/api/bank-accounts/${selectedAccountId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: parsed })
      });

      if (res.ok) {
        fetchTransactions(selectedAccountId);
        setIsCsvMappingModalOpen(false);
        dialogAlert(`${parsed.length} transactions importées avec succès.`, "success");
      } else {
        throw new Error("Erreur serveur lors de l'import");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de l'importation des transactions.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReconcile = async () => {
    if (bankTransactions.length === 0) {
      dialogAlert("Veuillez d'abord importer ou synchroniser des transactions.", "info");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Fetch GL entries and other data for reconciliation from backend
      const account = bankAccounts.find(a => a.id === selectedAccountId);
      const glCode = account?.gl_account_code || companySettings?.payment_bank_account || '521';
      
      const dataRes = await apiFetch(`/api/ai/reconcile-data?account_code=${glCode}`);
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
      dialogAlert("Une erreur est survenue lors du rapprochement.", "error");
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
                         tx.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.matched_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.amount.toString().includes(searchTerm);
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
            Banque
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('compare')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'compare' ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <RefreshCw size={14} />
              Rapprochement
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'history' ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <History size={14} />
              Historique
            </button>
          </div>
          <button
            onClick={handleMagicMatch}
            disabled={bankTransactions.length === 0 || isProcessing}
            className="bg-brand-gold hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles size={18} />
            Magic Match
          </button>
          <button
            onClick={handleExportOFX}
            disabled={bankTransactions.length === 0}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            Exporter OFX
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

              {/* Comparative View */}
              {activeTab === 'compare' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Left: Saisi dans OryEmm (GL Entries) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} />
                        Saisi dans OryEmm
                      </h3>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full font-bold">Local</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-[600px] flex flex-col">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                          <input 
                            type="text" 
                            placeholder="Filtrer les écritures..." 
                            value={glSearchTerm}
                            onChange={e => setGlSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {availableGLEntries
                          .filter(entry => 
                            entry.description.toLowerCase().includes(glSearchTerm.toLowerCase()) ||
                            (entry.reference || '').toLowerCase().includes(glSearchTerm.toLowerCase()) ||
                            (entry.debit > 0 ? entry.debit : -entry.credit).toString().includes(glSearchTerm)
                          )
                          .length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-50">
                            <FileText size={32} />
                            <p className="text-xs">Aucune écriture trouvée</p>
                          </div>
                        ) : availableGLEntries
                          .filter(entry => 
                            entry.description.toLowerCase().includes(glSearchTerm.toLowerCase()) ||
                            (entry.reference || '').toLowerCase().includes(glSearchTerm.toLowerCase()) ||
                            (entry.debit > 0 ? entry.debit : -entry.credit).toString().includes(glSearchTerm)
                          )
                          .map(entry => (
                          <div key={entry.gl_id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 transition-all bg-slate-50/30 dark:bg-slate-900/10 group">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{entry.description}</div>
                                <div className="text-[10px] text-slate-500 mt-1 flex gap-2">
                                  <span>{new Date(entry.date).toLocaleDateString('fr-FR')}</span>
                                  <span>Réf: {entry.reference || 'N/A'}</span>
                                </div>
                              </div>
                              <div className="text-right ml-2">
                                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(entry.debit > 0 ? entry.debit : -entry.credit)}
                                </div>
                                <div className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                  {entry.account_code}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Relevé Réel (Bank Transactions) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Landmark size={16} />
                        Relevé Réel
                      </h3>
                      <button 
                        onClick={() => {
                          const lastDate = [...bankTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date().toISOString();
                          confirm(`Voulez-vous verrouiller toutes les transactions rapprochées jusqu'au ${new Date(lastDate).toLocaleDateString()} ?`).then(res => {
                            if (res) {
                              // Call locking API
                              const startDate = '2000-01-01'; // Beginning of time
                              const endDate = lastDate.split('T')[0];
                              apiFetch('/api/bank-reconciliation/lock-period', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ bankAccountId: selectedAccountId, startDate, endDate })
                              }).then(lockRes => {
                                if (lockRes.ok) {
                                  dialogAlert("Période verrouillée avec succès.", "success");
                                  triggerCloudBackup().catch(e => console.error("Cloud backup failed", e));
                                }
                              });
                            }
                          });
                        }}
                        className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Lock size={10} />
                        Verrouiller la période
                      </button>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-[600px] flex flex-col">
                      <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input 
                              type="text" 
                              placeholder="Filtrer le relevé..." 
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="px-2 py-1 text-[10px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none"
                          >
                            <option value="all">Tous</option>
                            <option value="pending">À traiter</option>
                            <option value="matched">Rapprochés</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {filteredTransactions.map(tx => {
                          const aiResult = reconciliationResults.find(r => r.bankTransactionId === tx.id);
                          const isMatched = tx.status === 'matched';
                          
                          // Badges logic
                          let badgeStyle = "bg-slate-100 text-slate-500";
                          let badgeText = "En attente";
                          let badgeIcon = <Landmark size={10} />;
                          
                          if (isMatched) {
                            badgeStyle = "bg-emerald-100 text-emerald-700";
                            badgeText = "Identique";
                            badgeIcon = <Check size={10} />;
                          } else if (aiResult?.status === 'matched') {
                            if (aiResult.confidenceScore && aiResult.confidenceScore < 80) {
                              badgeStyle = "bg-amber-100 text-amber-700";
                              badgeText = "Écart Montant";
                              badgeIcon = <AlertTriangle size={10} />;
                            } else {
                              badgeStyle = "bg-indigo-100 text-indigo-700";
                              badgeText = "Suggéré";
                              badgeIcon = <Sparkles size={10} />;
                            }
                          } else if (!isMatched && !aiResult) {
                            badgeStyle = "bg-rose-100 text-rose-700";
                            badgeText = "Oubli / Non saisi";
                            badgeIcon = <AlertCircle size={10} />;
                          }

                          return (
                            <div key={tx.id} className={cn(
                              "p-3 rounded-xl border transition-all",
                              isMatched ? "border-emerald-100 bg-emerald-50/20" : "border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700"
                            )}>
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{tx.description}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{new Date(tx.date).toLocaleDateString('fr-FR')}</div>
                                </div>
                                <div className="text-right ml-2">
                                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(tx.amount)}</div>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50 dark:border-slate-700">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase", badgeStyle)}>
                                  {badgeIcon}
                                  {badgeText}
                                </span>
                                
                                <div className="flex gap-1">
                                  {!isMatched && !tx.is_locked && (
                                    <>
                                      <button 
                                        onClick={() => openManualMatchModal(tx)}
                                        className="p-1 px-2 text-[10px] bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                                      >
                                        Rapprochement
                                      </button>
                                      <button 
                                        onClick={() => openCreateEntryModal(tx)}
                                        className="p-1 px-2 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                                      >
                                        Saisir
                                      </button>
                                    </>
                                  )}
                                  {isMatched && !tx.is_locked && (
                                    <button 
                                      onClick={() => handleUnmatch(tx.id)}
                                      className="p-1 px-2 text-[10px] bg-slate-100 text-slate-500 rounded-lg font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                    >
                                      Annuler
                                    </button>
                                  )}
                                  {tx.is_locked && (
                                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                      <Lock size={10} />
                                      Verrouillé
                                    </span>
                                  )}
                                </div>
                              </div>

                              {isMatched && (
                                <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-[9px] text-slate-500 flex items-center gap-2">
                                  <ShieldCheck size={12} className="text-emerald-600" />
                                  <span>Rapproché avec {tx.matched_description}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* History Tab: Standard Table */
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 dark:text-white">Opérations Rapprochées</h2>
                  </div>
                  <div className="w-full min-w-0 overflow-auto ">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                          <th className="p-4">Date</th>
                          <th className="p-4">Transaction Bancaire</th>
                          <th className="p-4">Montant</th>
                          <th className="p-4">Correspondance GL</th>
                          <th className="p-4 text-center">Verrouillé</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
                        {bankTransactions.filter(tx => tx.status === 'matched').map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="p-4 text-slate-500 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-slate-900 dark:text-white">{tx.description}</div>
                            </td>
                            <td className="p-4 font-mono font-bold">
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="p-4">
                              <div className="text-xs">
                                <div className="font-medium text-slate-700 dark:text-slate-300">{tx.matched_description}</div>
                                <div className="text-slate-400">Compte: {tx.matched_account}</div>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center">
                                {tx.is_locked ? (
                                  <Lock size={14} className="text-emerald-500" />
                                ) : (
                                  <Unlock size={14} className="text-slate-300" />
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {!tx.is_locked && (
                                <button 
                                  onClick={() => handleUnmatch(tx.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
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

      {/* Forced Adjustment Modal */}
      {isForcedMatchModalOpen && selectedTxForMatch && (
        <div className="fixed inset-0 z-[60] flex justify-center p-4 bg-slate-900/60 backdrop-blur-sm items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" />
                  Ajustement Forcé
                </h3>
                <p className="text-xs text-slate-500 mt-1">Un motif est requis pour enregistrer cet écart.</p>
              </div>
              <button 
                onClick={() => setIsForcedMatchModalOpen(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300">
                L'écart sera enregistré dans l'historique d'audit avec votre motif.
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Motif de l'écart
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Ex: Frais bancaires, erreur de saisie, arrondi..."
                  className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsForcedMatchModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (!adjustmentReason.trim()) {
                      dialogAlert("Veuillez saisir un motif.", "error");
                      return;
                    }
                    const selectedEntry = availableGLEntries.find(e => e.gl_id === selectedGLEntryId);
                    if (selectedEntry) {
                      handleMatch(selectedTxForMatch.id, selectedEntry.gl_id, adjustmentReason);
                    }
                  }}
                  disabled={!adjustmentReason.trim()}
                  className="flex-1 bg-amber-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-amber-200 dark:shadow-none hover:bg-amber-700 transition-all disabled:opacity-50"
                >
                  Forcer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Manual Match Modal */}
      {isManualMatchModalOpen && selectedTxForMatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
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
                    (entry.reference?.toLowerCase() || '').includes(manualMatchSearch.toLowerCase()) ||
                    entry.account_code.toLowerCase().includes(manualMatchSearch.toLowerCase()) ||
                    (entry.debit > 0 ? entry.debit : -entry.credit).toString().includes(manualMatchSearch)
                  ).length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Search size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Aucune écriture trouvée pour cette recherche.</p>
                    </div>
                  ) : availableGLEntries
                    .filter(entry => 
                      entry.description.toLowerCase().includes(manualMatchSearch.toLowerCase()) ||
                      (entry.reference?.toLowerCase() || '').includes(manualMatchSearch.toLowerCase()) ||
                      entry.account_code.toLowerCase().includes(manualMatchSearch.toLowerCase()) ||
                      (entry.debit > 0 ? entry.debit : -entry.credit).toString().includes(manualMatchSearch)
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
                            if (!isAmountMatch) {
                              setSelectedGLEntryId(entry.gl_id);
                              setAdjustmentReason('');
                              setIsForcedMatchModalOpen(true);
                              setIsManualMatchModalOpen(false);
                            } else {
                              handleMatch(selectedTxForMatch.id, entry.gl_id);
                              setIsManualMatchModalOpen(false);
                            }
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

      {/* CSV Mapping Modal */}
      {isCsvMappingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload /> Mapage des colonnes CSV
              </h2>
              <button onClick={() => setIsCsvMappingModalOpen(false)} className="hover:rotate-90 transition-transform">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col md:flex-row gap-8">
              {/* Mapping Controls */}
              <div className="md:w-1/3 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Assigner les colonnes</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Date
                      </label>
                      <select 
                        value={csvMapping.date}
                        onChange={e => setCsvMapping({...csvMapping, date: e.target.value})}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Description / Libellé
                      </label>
                      <select 
                        value={csvMapping.description}
                        onChange={e => setCsvMapping({...csvMapping, description: e.target.value})}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Montant
                      </label>
                      <select 
                        value={csvMapping.amount}
                        onChange={e => setCsvMapping({...csvMapping, amount: e.target.value})}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Référence (Optionnel)
                      </label>
                      <select 
                        value={csvMapping.reference}
                        onChange={e => setCsvMapping({...csvMapping, reference: e.target.value})}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Aucune</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
                    <AlertCircle size={14} className="inline mr-1" />
                    Assurez-vous que le format de date est valide et que les montants utilisent un point (.) ou une virgule (,) comme séparateur décimal.
                  </p>
                </div>
              </div>

              {/* Data Preview */}
              <div className="md:w-2/3 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aperçu (10 premières lignes)</h3>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{csvData.length} lignes trouvées</span>
                </div>
                <div className="border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner">
                  <div className="w-full min-w-0 overflow-auto  max-h-[400px] custom-scrollbar">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 shadow-sm border-b border-slate-100 dark:border-slate-700">
                        <tr>
                          {csvHeaders.map(h => (
                            <th key={h} className={cn(
                              "px-3 py-2 whitespace-nowrap font-bold",
                              Object.values(csvMapping).includes(h) ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10" : "text-slate-400"
                            )}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {csvData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            {csvHeaders.map(h => (
                              <td key={h} className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setIsCsvMappingModalOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmCsvImport}
                disabled={isUploading}
                className="px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Confirmer l'importation
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
