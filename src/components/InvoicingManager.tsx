import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from './ui/PageHeader';
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
  Loader2,
  List,
  BarChart3,
  Receipt,
  BookOpen,
  X,
  User,
  Edit2
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceViewer } from './InvoiceViewer';
import { exportToExcel, generateInvoicePDF } from '@/lib/exportUtils';
import { CurrencyAnalyzer } from './CurrencyAnalyzer';
import { motion, AnimatePresence } from 'motion/react';
import { RecurringInvoiceManager } from './RecurringInvoiceManager';

type DocType = 'invoice' | 'quote' | 'recurring' | 'proforma';

interface Invoice {
  id: number;
  type: DocType;
  number: string;
  date: string;
  due_date: string;
  third_party_id: number;
  third_party_name: string;
  occasional_name?: string | null;
  status: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  currency?: string;
  exchange_rate?: number;
}

export function InvoicingManager() {
  const { alert: dialogAlert } = useDialog();
  const location = useLocation();
  const { confirm, alert } = useDialog();
  const { t } = useLanguage();
  const { formatCurrency, currency: baseCurrency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState<DocType>('invoice');
  const [documents, setDocuments] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [isBatchSending, setIsBatchSending] = useState(false);

  useEffect(() => {
    if (location.state?.action === 'new') {
      setShowEditor(true);
      window.history.replaceState({}, document.title);
    } else if (location.state?.prefill) {
      setPrefillData(location.state.prefill);
      setShowEditor(true);
      // Clear state to avoid re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    apiFetch('/api/company/dossier')
      .then(res => res.json())
      .then(data => setCompanySettings(data))
      .catch(err => console.error("Failed to fetch company settings", err));
  }, []);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [quickEditDocId, setQuickEditDocId] = useState<number | null>(null);
  const [quickEditData, setQuickEditData] = useState<any>(null);
  const [activeView, setActiveView] = useState<'list' | 'reports'>('list');
  const [reportData, setReportData] = useState<any>(null);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showTransactionPicker, setShowTransactionPicker] = useState(false);

  useEffect(() => {
    fetchDocuments();
    if (activeView === 'reports') {
      fetchReports();
    }
  }, [activeTab, activeView, activeYear?.id]);

  const handleQuickEditSave = async () => {
    if (!quickEditDocId || !quickEditData) return;
    try {
      const res = await apiFetch(`/api/invoices/${quickEditDocId}/quick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickEditData)
      });
      if (res.ok) {
        setQuickEditDocId(null);
        setQuickEditData(null);
        dialogAlert('Document mis à jour', 'success');
        fetchDocuments();
      } else {
        dialogAlert('Erreur lors de la mise à jour', 'error');
      }
    } catch (e) {
      dialogAlert('Erreur réseau', 'error');
    }
  };

  const fetchReports = async () => {
    try {
      const [statsRes, revenueRes] = await Promise.all([
        apiFetch('/api/invoices/stats'),
        apiFetch('/api/revenue/monthly')
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
      const res = await apiFetch(`/api/invoices?type=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : []);
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
      const res = await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocuments();
      } else {
        const data = await res.json();
        dialogAlert(data.error || "Erreur lors de la suppression", 'error');
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur de connexion", 'error');
    }
  };

  const handleEmail = async (doc: Invoice) => {
    setSelectedDocId(doc.id);
    setShowViewer(true);
    // The viewer will handle the email modal
  };

  const handleExport = () => {
    if (documents.length === 0) {
      dialogAlert("Aucune donnée à exporter", 'info');
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

    exportToExcel(exportData, `${activeTab === 'invoice' ? 'Factures' : activeTab === 'quote' ? 'Devis' : 'Proformas'}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDownloadPDF = async (docId: number) => {
    try {
      const res = await apiFetch(`/api/invoices/${docId}`);
      if (res.ok) {
        const fullDoc = await res.json();
        await generateInvoicePDF(fullDoc, companySettings);
      }
    } catch (err) {
      console.error("Failed to download PDF", err);
      dialogAlert("Erreur lors du téléchargement du PDF", 'error');
    }
  };

  const filteredDocs = (documents || []).filter(doc => {
    const matchesSearch = (doc.number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                          (doc.third_party_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    total: (documents || [])
      .filter(d => activeTab === 'invoice' ? d.status !== 'cancelled' : d.status !== 'rejected')
      .reduce((acc, doc) => acc + (doc.total_amount || 0), 0),
    paid: (documents || [])
      .filter(d => activeTab === 'invoice' ? d.status === 'paid' : d.status === 'accepted')
      .reduce((acc, doc) => acc + (doc.total_amount || 0), 0),
    pending: (documents || [])
      .filter(d => d.status === 'sent' || d.status === 'draft')
      .reduce((acc, doc) => acc + (doc.total_amount || 0), 0),
    overdue: (documents || [])
      .filter(d => activeTab === 'invoice' ? d.status === 'overdue' : d.status === 'rejected')
      .reduce((acc, doc) => acc + (doc.total_amount || 0), 0)
  };

  return (
    <div className="space-y-6 pb-20">
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
          <div className="fixed inset-0 z-[110] flex justify-center p-4 sm:p-6 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
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
              className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <InvoiceEditor 
                type={activeTab === 'recurring' ? 'invoice' : activeTab} 
                id={selectedDocId || undefined}
                prefill={prefillData}
                onClose={() => {
                  setShowEditor(false);
                  setPrefillData(null);
                  setSelectedDocId(null);
                  fetchDocuments();
                }} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickEditDocId && quickEditData && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setQuickEditDocId(null);
                setQuickEditData(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8"
            >
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Édition Rapide ({quickEditData.number})</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Date d'émission</label>
                  <input type="date" value={quickEditData.date} onChange={e => setQuickEditData({...quickEditData, date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Date d'échéance</label>
                  <input type="date" value={quickEditData.due_date} onChange={e => setQuickEditData({...quickEditData, due_date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Statut</label>
                  <select value={quickEditData.status} onChange={e => setQuickEditData({...quickEditData, status: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <option value="draft">Brouillon</option>
                    <option value="sent">Envoyé</option>
                    <option value="paid">Payé</option>
                    <option value="overdue">En retard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Notes</label>
                  <textarea value={quickEditData.notes || ''} onChange={e => setQuickEditData({...quickEditData, notes: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl min-h-[80px]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Conditions de règlement</label>
                  <textarea value={quickEditData.terms || ''} onChange={e => setQuickEditData({...quickEditData, terms: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl min-h-[80px]" />
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <button
                  onClick={() => {
                    setQuickEditDocId(null);
                    setQuickEditData(null);
                  }}
                  className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  onClick={handleQuickEditSave}
                  className="px-6 py-3 font-bold text-white bg-brand-green hover:bg-brand-green/90 rounded-xl shadow-lg"
                >
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showViewer && selectedDocId && (
          <div className="fixed inset-0 z-[110] flex justify-center p-4 sm:p-6 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
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
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 overflow-y-auto flex-1 min-h-0 w-full">
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
      <PageHeader
        title={activeTab === 'invoice' ? 'Facturation' : activeTab === 'quote' ? 'Devis' : activeTab === 'proforma' ? 'Proformas' : 'Facturation Récurrente'}
        subtitle={activeTab === 'invoice' ? 'Gérez vos factures clients et suivez les paiements' : activeTab === 'quote' ? 'Propositions commerciales' : activeTab === 'proforma' ? 'Factures proforma' : 'Abonnements et factures périodiques'}
        icon={<Receipt size={24} />}
        actions={
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner mr-2">
              <button
                onClick={() => setActiveView('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  activeView === 'list' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400"
                )}
                title="Liste"
              >
                <List size={20} />
              </button>
              <button
                onClick={() => setActiveView('reports')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  activeView === 'reports' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400"
                )}
                title="Rapports"
              >
                <BarChart3 size={20} />
              </button>
            </div>

            {activeTab !== 'recurring' && (
              <>
                <button 
                  onClick={() => setShowAnalyzer(!showAnalyzer)}
                  className={cn(
                    "p-3 rounded-xl border transition-all active:scale-95 group",
                    showAnalyzer 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" 
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                  )}
                >
                  <Globe size={20} />
                </button>
                <button 
                  onClick={() => setShowTransactionPicker(true)}
                  className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                  title="Créer depuis des écritures existantes"
                >
                  <BookOpen size={20} className="text-brand-green" />
                  <span className="hidden sm:inline">Depuis écritures</span>
                </button>
                <button 
                  onClick={() => setShowEditor(true)}
                  className="bg-brand-green hover:bg-brand-green/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Plus size={20} />
                  <span>Nouveau</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="w-full min-w-0 overflow-auto flex items-center justify-between gap-4  no-scrollbar py-1">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab('invoice')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'invoice' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Factures
          </button>
          <button
            onClick={() => setActiveTab('quote')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'quote' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Devis
          </button>
          <button
            onClick={() => setActiveTab('proforma')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'proforma' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Proforma
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={cn(
              "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'recurring' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Récurrent
          </button>
        </div>

        <div className="lg:hidden flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveView('list')}
            className={cn(
              "p-2 rounded-lg transition-all",
              activeView === 'list' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400"
            )}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={cn(
              "p-2 rounded-lg transition-all",
              activeView === 'reports' ? "bg-white dark:bg-slate-700 text-brand-green shadow-sm" : "text-slate-400"
            )}
          >
            <BarChart3 size={18} />
          </button>
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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total {activeTab === 'invoice' ? 'Facturé' : activeTab === 'quote' ? 'Devis' : 'Proformas'}</span>
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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{activeTab === 'invoice' ? 'En retard' : activeTab === 'proforma' ? 'Refusé / Expiré' : 'Refusé'}</span>
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
        <div className="flex flex-wrap lg:flex-nowrap gap-2">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                >
                  Tous
                </button>
                {activeTab === 'invoice' && (
                  <>
                    <button 
                      onClick={() => setStatusFilter('overdue')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === 'overdue' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40'}`}
                    >
                      En retard
                    </button>
                    <button 
                      onClick={() => setStatusFilter('paid')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === 'paid' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40'}`}
                    >
                      Payés
                    </button>
                    <button 
                      onClick={() => setStatusFilter('sent')}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${statusFilter === 'sent' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-500 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'}`}
                    >
                      Envoyés
                    </button>
                  </>
                )}
              </div>
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
      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden relative">
        {selectedDocs.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-brand-green text-white px-8 py-4 flex items-center justify-between border-b border-brand-green-light">
            <div className="flex items-center gap-4">
              <span className="font-bold">{selectedDocs.length} document(s) sélectionné(s)</span>
            </div>
            <button 
              onClick={() => setIsBatchSending(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-green rounded-xl font-bold text-sm shadow-sm hover:scale-105 active:scale-95 transition-all"
            >
              <Mail size={16} /> Envoyer par Email
            </button>
          </div>
        )}
        <div className="w-full min-w-0 overflow-auto ">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-8 py-6 w-12 text-center">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand-green focus:ring-brand-green/20 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDocs(filteredDocs.map(d => d.id));
                      else setSelectedDocs([]);
                    }}
                    checked={filteredDocs.length > 0 && selectedDocs.length === filteredDocs.length}
                  />
                </th>
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
                  <td colSpan={7} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-brand-green/20 border-t-brand-green rounded-full animate-spin" />
                      <p className="text-slate-500 font-bold tracking-tight">Chargement de vos documents...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-24 text-center">
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
                    <td className="px-8 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded text-brand-green focus:ring-brand-green/20 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDocs([...selectedDocs, doc.id]);
                          else setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                        }}
                      />
                    </td>
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
                      <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        {doc.occasional_name || doc.third_party_name}
                        {doc.third_party_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.location.href = '#/third-parties?search=' + encodeURIComponent(doc.third_party_name); }}
                            className="p-1.5 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors invisible group-hover:visible"
                            title="Voir le client"
                          >
                            <User size={14} />
                          </button>
                        )}
                      </div>
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
                          className="p-3 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all active:scale-90"
                          title="Édition Rapide"
                          onClick={() => {
                            setQuickEditData(doc);
                            setQuickEditDocId(doc.id);
                          }}
                        >
                          <Edit2 size={20} />
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

  {isBatchSending && (
    <BatchSendModal 
      onClose={() => setIsBatchSending(false)}
      selectedDocs={selectedDocs}
      documents={documents}
      companySettings={companySettings}
      onComplete={() => {
        setIsBatchSending(false);
        setSelectedDocs([]);
        fetchDocuments();
      }}
    />
  )}

  {showTransactionPicker && (
    <TransactionPickerModal
      onClose={() => setShowTransactionPicker(false)}
      onSelect={(tx) => {
        setShowTransactionPicker(false);
        setPrefillData(tx);
        setShowEditor(true);
      }}
      formatCurrency={formatCurrency}
    />
  )}
</div>
  );
}

function BatchSendModal({ 
  onClose, 
  selectedDocs, 
  documents, 
  companySettings,
  onComplete
}: { 
  onClose: () => void, 
  selectedDocs: number[], 
  documents: Invoice[], 
  companySettings: any,
  onComplete: () => void
}) {
  const [subject, setSubject] = useState(`Vos documents de ${companySettings?.name || 'notre entreprise'}`);
  const [body, setBody] = useState(`Bonjour,\n\nVeuillez trouver ci-joint votre document.\n\nCordialement,\nL'équipe ${companySettings?.name || ''}`);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  const handleSend = async () => {
    setSending(true);
    const docsToSend = documents.filter(d => selectedDocs.includes(d.id));
    const newResults = [];
    
    for (let i = 0; i < docsToSend.length; i++) {
        const doc = docsToSend[i];
        try {
           const docRes = await apiFetch(`/api/invoices/${doc.id}`);
           if (docRes.ok) {
               const fullDoc = await docRes.json();
               const recipientEmail = fullDoc.third_party?.email || 'client@example.com';
               
               const msgRes = await apiFetch('/api/messages', {
                 method: 'POST',
                 body: JSON.stringify({
                   recipient_email: recipientEmail,
                   recipient_name: doc.third_party_name,
                   subject: `${subject} - ${doc.number}`,
                   body: body,
                   related_invoice_id: doc.id.toString(),
                   attachment_url: `pdfurl`
                 })
               });
               
               if (msgRes.ok) {
                 newResults.push({ id: doc.id, success: true, number: doc.number, email: recipientEmail });
                 // also update status to sent in DB if it was a quote or draft invoice
                 if (doc.status === 'draft') {
                    await apiFetch(`/api/invoices/${doc.id}/status`, {
                       method: 'PUT',
                       body: JSON.stringify({ status: 'sent' })
                    });
                 }
               } else {
                 newResults.push({ id: doc.id, success: false, number: doc.number });
               }
           }
        } catch (err) {
            newResults.push({ id: doc.id, success: false, number: doc.number });
        }
        setProgress(Math.round(((i + 1) / docsToSend.length) * 100));
    }
    
    setResults(newResults);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in transition-all items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center">
              <Mail size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Envoi groupé</h2>
              <p className="text-sm font-medium text-slate-500">{selectedDocs.length} document(s) sélectionné(s)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {results.length > 0 ? (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
               {results.map((r, i) => (
                 <div key={i} className="flex justify-between items-center text-sm font-bold">
                    <span className="text-slate-700 dark:text-slate-300">{r.number} {r.email ? `(${r.email})` : ''}</span>
                    <span className={r.success ? "text-brand-green" : "text-rose-500"}>
                      {r.success ? 'Envoyé' : 'Échec'}
                    </span>
                 </div>
               ))}
            </div>
            <button
               onClick={onComplete}
               className="w-full bg-brand-green text-white py-4 rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
               Terminer
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 tracking-widest uppercase mb-2">Sujet de l'email</label>
              <input 
                 type="text" 
                 value={subject}
                 onChange={e => setSubject(e.target.value)}
                 className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
                 disabled={sending}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 tracking-widest uppercase mb-2">Message</label>
              <textarea 
                 rows={5}
                 value={body}
                 onChange={e => setBody(e.target.value)}
                 className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all resize-none"
                 disabled={sending}
              />
            </div>
            
            {sending && (
               <div className="space-y-2">
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Envoi en cours...</span>
                    <span>{progress}%</span>
                 </div>
                 <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>
               </div>
            )}

            <button
               onClick={handleSend}
               disabled={sending}
               className="w-full bg-brand-green text-white py-4 rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
               {sending ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
               {sending ? 'Traitement en cours...' : 'Envoyer les documents'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionPickerModal({ onClose, onSelect, formatCurrency }: { onClose: () => void, onSelect: (tx: any) => void, formatCurrency: (v: number, c?: string) => string }) {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/transactions?isDeleted=false")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const validUninvoiced = data.filter((t: any) => t.status === 'validated' && !t.invoice_number);
          setTxs(validUninvoiced);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in transition-all items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Convertir une écriture</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sélectionnez une écriture validée</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-3 no-scrollbar pb-4">
          {loading ? (
            <div className="py-20 text-center"><Loader2 size={32} className="mx-auto text-brand-green animate-spin" /></div>
          ) : txs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-medium italic">
              Aucune écriture comptable validée disponible pour la facturation.
            </div>
          ) : (
            txs.map(t => (
              <button
                key={t.id}
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/api/transactions/${t.id}`);
                    const fullTx = await res.json();
                    onSelect(fullTx);
                  } catch (err) {
                    console.error('Error fetching full transaction:', err);
                  }
                }}
                className="w-full text-left p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-brand-green/30 transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.date}</span>
                    <span className="text-[10px] font-black text-brand-green uppercase tracking-widest bg-brand-green/10 px-2 py-0.5 rounded-md">{t.reference || 'Auto'}</span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white group-hover:text-brand-green transition-colors">{t.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-black font-mono text-slate-900 dark:text-white">{formatCurrency(t.total_amount, t.currency)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
