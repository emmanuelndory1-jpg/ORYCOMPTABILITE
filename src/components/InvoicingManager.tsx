import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  Download,
  Printer,
  Mail,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  FileCheck,
  FileX,
  Globe,
  XCircle,
  Loader2
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceViewer } from './InvoiceViewer';
import { exportToExcel, generateInvoicePDF } from '@/lib/exportUtils';
import { CurrencyAnalyzer } from './CurrencyAnalyzer';
import { motion, AnimatePresence } from 'framer-motion';
import { RecurringInvoiceManager } from './RecurringInvoiceManager';

type DocType = 'invoice' | 'quote' | 'recurring';

interface Invoice {
  id: number;
  type: DocType;
  number: string;
  date: string;
  due_date: string;
  third_party_id: number;
  third_party_name: string;
  status: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  currency?: string;
  exchange_rate?: number;
}

export function InvoicingManager() {
  const location = useLocation();
  const { confirm, alert } = useDialog();
  const { t } = useLanguage();
  const { formatCurrency, currency: baseCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<DocType>('invoice');
  const [documents, setDocuments] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [prefillData, setPrefillData] = useState<any>(null);

  useEffect(() => {
    if (location.state?.prefill) {
      setPrefillData(location.state.prefill);
      setShowEditor(true);
      // Clear state to avoid re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    fetch('/api/company/dossier')
      .then(res => res.json())
      .then(data => setCompanySettings(data))
      .catch(err => console.error("Failed to fetch company settings", err));
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'reports'>('list');
  const [reportData, setReportData] = useState<any>(null);
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  useEffect(() => {
    fetchDocuments();
    if (activeView === 'reports') {
      fetchReports();
    }
  }, [activeTab, activeView]);

  const fetchReports = async () => {
    try {
      const [statsRes, revenueRes] = await Promise.all([
        fetch('/api/invoices/stats'),
        fetch('/api/revenue/monthly')
      ]);
      if (statsRes.ok && revenueRes.ok) {
        const stats = await statsRes.json();
        const revenue = await revenueRes.json();
        setReportData({ stats, revenue });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?type=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocuments();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur lors de la suppression", 'error');
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion", 'error');
    }
  };

  const handleEmail = async (doc: Invoice) => {
    setSelectedDocId(doc.id);
    setShowViewer(true);
    // The viewer will handle the email modal
  };

  const handleExport = () => {
    if (documents.length === 0) {
      alert("Aucune donnée à exporter", 'info');
      return;
    }

    const exportData = filteredDocs.map(doc => ({
      'Numéro': doc.number,
      'Type': doc.type === 'invoice' ? 'Facture' : 'Devis',
      'Date': new Date(doc.date).toLocaleDateString(),
      'Échéance': doc.due_date ? new Date(doc.due_date).toLocaleDateString() : '-',
      'Client': doc.third_party_name,
      'Sous-total HT': doc.subtotal,
      'TVA': doc.vat_amount,
      'Total TTC': doc.total_amount,
      'Statut': doc.status.toUpperCase()
    }));

    exportToExcel(exportData, `${activeTab === 'invoice' ? 'Factures' : 'Devis'}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDownloadPDF = async (docId: number) => {
    try {
      const res = await fetch(`/api/invoices/${docId}`);
      if (res.ok) {
        const fullDoc = await res.json();
        generateInvoicePDF(fullDoc, companySettings);
      }
    } catch (err) {
      console.error("Failed to download PDF", err);
      alert("Erreur lors du téléchargement du PDF", 'error');
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.third_party_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: any }> = {
      draft: { label: 'Brouillon', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', icon: FileText },
      sent: { label: 'Envoyé', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Mail },
      paid: { label: 'Payé', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
      overdue: { label: 'En retard', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: AlertCircle },
      cancelled: { label: 'Annulé', color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', icon: XCircle },
      accepted: { label: 'Accepté', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2 },
      rejected: { label: 'Refusé', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: FileX },
    };

    const config = configs[status] || configs.draft;
    const Icon = config.icon;

    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-transparent transition-all duration-300 group-hover:scale-105",
        config.bg,
        config.color,
        "border-current/10"
      )}>
        <Icon size={12} />
        {config.label}
      </div>
    );
  };

  const stats = {
    total: documents
      .filter(d => activeTab === 'invoice' ? d.status !== 'cancelled' : d.status !== 'rejected')
      .reduce((acc, doc) => acc + doc.total_amount, 0),
    paid: documents
      .filter(d => activeTab === 'invoice' ? d.status === 'paid' : d.status === 'accepted')
      .reduce((acc, doc) => acc + doc.total_amount, 0),
    pending: documents
      .filter(d => d.status === 'sent' || d.status === 'draft')
      .reduce((acc, doc) => acc + doc.total_amount, 0),
    overdue: documents
      .filter(d => activeTab === 'invoice' ? d.status === 'overdue' : d.status === 'rejected')
      .reduce((acc, doc) => acc + doc.total_amount, 0)
  };

  return (
    <div className="space-y-10 pb-20">
      <AnimatePresence>
        {showQuickView && selectedDocId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickView(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-950 shadow-2xl z-[101] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Aperçu rapide</h2>
                      <p className="text-sm text-slate-500 font-medium">Détails du document</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowQuickView(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    <XCircle size={24} className="text-slate-400" />
                  </button>
                </div>

                <InvoiceViewer 
                  id={selectedDocId} 
                  onClose={() => setShowQuickView(false)}
                  onEdit={() => {
                    setShowQuickView(false);
                    setShowEditor(true);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditor(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <InvoiceEditor 
                type={activeTab === 'recurring' ? 'invoice' : activeTab} 
                prefill={prefillData}
                onClose={() => {
                  setShowEditor(false);
                  setPrefillData(null);
                  fetchDocuments();
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showViewer && selectedDocId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowViewer(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <InvoiceViewer 
                  id={selectedDocId} 
                  onClose={() => {
                    setShowViewer(false);
                    setSelectedDocId(null);
                    fetchDocuments();
                  }}
                  onEdit={() => {
                    setShowViewer(false);
                    setShowEditor(true);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {activeTab === 'invoice' ? 'Facturation' : 'Devis'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {activeTab === 'invoice' ? 'Gérez vos factures clients et suivez les paiements' : 'Préparez et envoyez vos propositions commerciales'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
            <button
              onClick={() => setActiveView('list')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                activeView === 'list' 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-md scale-105" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Liste
            </button>
            <button
              onClick={() => setActiveView('reports')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                activeView === 'reports' 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-md scale-105" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Rapports
            </button>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('invoice')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                activeTab === 'invoice' 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-md scale-105" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Factures
            </button>
            <button
              onClick={() => setActiveTab('quote')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                activeTab === 'quote' 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-md scale-105" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Devis
            </button>
            <button
              onClick={() => setActiveTab('recurring')}
              className={cn(
                "flex-1 sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                activeTab === 'recurring' 
                  ? "bg-white dark:bg-slate-700 text-brand-green shadow-md scale-105" 
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Récurrent
            </button>
          </div>
        {activeTab !== 'recurring' && (
          <>
            <button 
              onClick={() => setShowAnalyzer(!showAnalyzer)}
              className={cn(
                "p-4 rounded-2xl border transition-all active:scale-95 group",
                showAnalyzer 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
              title="Analyse des devises"
            >
              <Globe size={22} className={cn(showAnalyzer && "animate-pulse")} />
            </button>
            <button 
              onClick={() => setShowEditor(true)}
              className="bg-brand-green hover:bg-brand-green-light text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-2xl shadow-brand-green/30 transition-all active:scale-95 group w-full sm:w-auto"
            >
              <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="whitespace-nowrap">Nouveau {activeTab === 'invoice' ? 'Facture' : 'Devis'}</span>
            </button>
          </>
        )}
        </div>
      </div>

      <AnimatePresence>
        {showAnalyzer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CurrencyAnalyzer />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Dashboard */}
      {activeTab === 'recurring' ? (
        <RecurringInvoiceManager />
      ) : activeView === 'list' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="premium-card p-8 group">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <FileText size={28} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total {activeTab === 'invoice' ? 'Facturé' : 'Devis'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{formatCurrency(stats.total)}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg">
                  {documents.length} docs
                </div>
                <span className="text-xs text-slate-400 font-medium">au total</span>
              </div>
            </div>

            <div className="premium-card p-8 group">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 size={28} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{activeTab === 'invoice' ? 'Payé' : 'Accepté'}</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{formatCurrency(stats.paid)}</div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.total > 0 ? (stats.paid / stats.total) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full transition-all duration-1000 ease-out" 
                />
              </div>
              <div className="text-[10px] text-emerald-500 mt-2 font-black uppercase tracking-wider">
                {stats.total > 0 ? ((stats.paid / stats.total) * 100).toFixed(1) : 0}% du total
              </div>
            </div>

            <div className="premium-card p-8 group">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Clock size={28} />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">En attente</span>
              </div>
              <div className="text-3xl font-black text-slate-900 dark:text-white font-display tracking-tighter">{formatCurrency(stats.pending)}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-xs text-amber-600 font-bold">À relancer prochainement</span>
              </div>
            </div>

            <div className="premium-card p-8 group">
              <div className="flex items-center justify-between mb-6">
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  {activeTab === 'invoice' ? <AlertCircle size={28} /> : <FileX size={28} />}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{activeTab === 'invoice' ? 'En retard' : 'Refusé'}</span>
              </div>
              <div className="text-3xl font-black text-rose-600 font-display tracking-tighter">{formatCurrency(stats.overdue)}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="px-2 py-0.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg">
                  {activeTab === 'invoice' ? 'Action requise' : 'Perte potentielle'}
                </div>
              </div>
            </div>
          </div>

      {/* Filters & Search */}
      <div className="premium-card p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-green transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Rechercher par numéro, client ou montant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold text-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 md:flex-none px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Exporter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Document</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Client</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Échéance</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Montant TTC</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Statut</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-brand-green/20 border-t-brand-green rounded-full animate-spin" />
                      <p className="text-slate-500 font-bold tracking-tight">Chargement de vos documents...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                      <div className="p-8 bg-slate-50 dark:bg-slate-900 rounded-[2rem] text-slate-300">
                        <FileText size={64} />
                      </div>
                      <div>
                        <p className="text-slate-900 dark:text-white font-black text-xl tracking-tight">Aucun document trouvé</p>
                        <p className="text-slate-500 font-medium mt-2">Commencez par créer votre premier document commercial pour voir vos statistiques s'afficher ici.</p>
                      </div>
                      <button 
                        onClick={() => setShowEditor(true)}
                        className="w-full sm:w-auto bg-brand-green text-white px-8 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-brand-green/20 active:scale-95 transition-all"
                      >
                        Créer ma première facture
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr 
                    key={doc.id} 
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                    onClick={() => {
                      setSelectedDocId(doc.id);
                      setShowQuickView(true);
                    }}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-2xl group-hover:bg-brand-green group-hover:text-white transition-all duration-300 shadow-sm">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="font-black text-slate-900 dark:text-white tracking-tight">{doc.number}</div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                            {new Date(doc.date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-slate-700 dark:text-slate-300">{doc.third_party_name}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className={cn(
                        "text-sm font-bold",
                        doc.status === 'overdue' ? "text-rose-500" : "text-slate-500"
                      )}>
                        {new Date(doc.due_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="font-black text-slate-900 dark:text-white font-display text-lg tracking-tighter">
                        {formatCurrency(doc.total_amount, doc.currency)}
                      </div>
                      {doc.currency && doc.currency !== baseCurrency && (
                        <div className="text-[10px] text-slate-400 font-medium tracking-tight">
                          ≈ {formatCurrency(doc.total_amount * (doc.exchange_rate || 1), baseCurrency)}
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-center">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-8 py-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          className="p-3 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-xl transition-all active:scale-90"
                          title="Télécharger PDF"
                          onClick={() => handleDownloadPDF(doc.id)}
                        >
                          <Download size={20} />
                        </button>
                        <button 
                          className="p-3 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-xl transition-all active:scale-90"
                          title="Modifier"
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setShowEditor(true);
                          }}
                        >
                          <ArrowUpRight size={20} />
                        </button>
                        <button 
                          className="p-3 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all active:scale-90"
                          title="Envoyer"
                          onClick={() => handleEmail(doc)}
                        >
                          <Mail size={20} />
                        </button>
                        <button 
                          className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                          title="Supprimer"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  ) : (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Monthly Revenue Chart Placeholder */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-8 flex items-center gap-3">
          <DollarSign className="text-brand-green" /> Revenus Mensuels
        </h3>
        <div className="space-y-6">
          {reportData?.revenue?.map((item: any) => (
            <div key={item.month} className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                <span>{item.month}</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(item.total)}</span>
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex">
                <div 
                  className="bg-brand-green h-full transition-all duration-1000"
                  style={{ width: `${(item.paid / item.total) * 100}%` }}
                />
                <div 
                  className="bg-amber-400 h-full transition-all duration-1000 opacity-50"
                  style={{ width: `${((item.total - item.paid) / item.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-brand-green">Payé: {formatCurrency(item.paid)}</span>
                <span className="text-amber-600">En attente: {formatCurrency(item.total - item.paid)}</span>
              </div>
            </div>
          ))}
          {(!reportData?.revenue || reportData.revenue.length === 0) && (
            <div className="py-20 text-center text-slate-400 font-medium italic">
              Aucune donnée de revenu disponible pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-8 flex items-center gap-3">
          <FileCheck className="text-blue-500" /> Répartition par Statut
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reportData?.stats?.map((stat: any) => (
            <div key={`${stat.type}-${stat.status}`} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.type} - {stat.status}</span>
                <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-900 dark:text-white shadow-sm">{stat.count}</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">{formatCurrency(stat.total)}</div>
              <div className="mt-2 text-[10px] font-bold text-slate-500">
                Payé: {formatCurrency(stat.paid)}
              </div>
            </div>
          ))}
          {(!reportData?.stats || reportData.stats.length === 0) && (
            <div className="col-span-2 py-20 text-center text-slate-400 font-medium italic">
              Aucune statistique disponible.
            </div>
          )}
        </div>
      </div>
    </div>
  )}
</div>
  );
}
