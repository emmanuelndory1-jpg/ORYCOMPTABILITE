import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, FileText, AlertTriangle, CheckCircle, X, Save, Trash2, Download, Briefcase, CreditCard, Calendar, FileSpreadsheet, Mail, Phone, History, ExternalLink } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_CONFIG, exportToCSV } from '@/lib/exportUtils';

interface ThirdParty {
  id: number;
  type: 'client' | 'supplier';
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  account_code: string;
  credit_limit: number;
  payment_terms: number;
  balance: number;
  overdue_amount: number;
  is_occasional: boolean;
}

export function ThirdPartyManager() {
  const { confirm, alert } = useDialog();
  const { formatCurrency, currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState<'client' | 'supplier'>('client');
  const [parties, setParties] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<ThirdParty | null>(null);
  const [showAgedBalance, setShowAgedBalance] = useState(false);
  const [agedBalanceData, setAgedBalanceData] = useState<any[]>([]);
  const [isSettingUpOccasional, setIsSettingUpOccasional] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    partyId: 0,
    amount: 0,
    mode: 'banque',
    date: new Date().toISOString().split('T')[0],
    reference: ''
  });
  const [selectedPartyForPayment, setSelectedPartyForPayment] = useState<ThirdParty | null>(null);
  
  // Transaction History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyParty, setHistoryParty] = useState<ThirdParty | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    credit_limit: 0,
    payment_terms: 30,
    is_occasional: false
  });

  useEffect(() => {
    fetchParties();
  }, [activeTab, activeYear?.id]);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/third-parties?type=${activeTab}`);
      const data = await res.json();
      setParties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgedBalance = async () => {
    try {
      const res = await fetch(`/api/reports/aged-balance?type=${activeTab}`);
      const data = await res.json();
      setAgedBalanceData(data);
      setShowAgedBalance(true);
    } catch (err) {
      console.error(err);
    }
  };

  const setupOccasional = async () => {
    setIsSettingUpOccasional(true);
    try {
      const res = await fetch('/api/third-parties/defaults');
      if (res.ok) {
        alert('Comptes occasionnels initialisés avec succès !', 'success');
        fetchParties();
      } else {
        const error = await res.json();
        alert(error.error || 'Erreur lors de l\'initialisation', 'error');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur de connexion au serveur', 'error');
    } finally {
      setIsSettingUpOccasional(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingParty 
        ? `/api/third-parties/${editingParty.id}`
        : '/api/third-parties';
      
      const method = editingParty ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type: activeTab })
      });

      if (res.ok) {
        setIsFormOpen(false);
        setEditingParty(null);
        resetForm();
        fetchParties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm('Êtes-vous sûr de vouloir supprimer ce tiers ?');
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/third-parties/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchParties();
      } else {
        const error = await res.json();
        alert(error.error, 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      credit_limit: 0,
      payment_terms: 30,
      is_occasional: false
    });
  };

  const openEdit = (party: ThirdParty) => {
    setEditingParty(party);
    setFormData({
      name: party.name || '',
      email: party.email || '',
      phone: party.phone || '',
      address: party.address || '',
      tax_id: party.tax_id || '',
      credit_limit: party.credit_limit || 0,
      payment_terms: party.payment_terms || 30,
      is_occasional: !!party.is_occasional
    });
    setIsFormOpen(true);
  };

  const openPayment = (party: ThirdParty) => {
    setSelectedPartyForPayment(party);
    setPaymentData({
      partyId: party.id,
      amount: Math.abs(party.balance), // Default to full balance
      mode: 'banque',
      date: new Date().toISOString().split('T')[0],
      reference: `PAY-${Date.now().toString().slice(-6)}`
    });
    setIsPaymentModalOpen(true);
  };

  const openHistory = async (party: ThirdParty) => {
    setHistoryParty(party);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/third-parties/${party.id}/transactions`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyForPayment) return;

    try {
      const res = await fetch(`/api/third-parties/${selectedPartyForPayment.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      if (res.ok) {
        alert('Paiement enregistré avec succès !', 'success');
        setIsPaymentModalOpen(false);
        fetchParties(); // Refresh balances
      } else {
        const error = await res.json();
        alert(error.error, 'error');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement du paiement', 'error');
    }
  };

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.account_code.includes(searchTerm)
  );

  const handleExportCSV = () => {
    const csvData = filteredParties.map(p => ({
      name: p.name,
      account_code: p.account_code,
      email: p.email || '',
      phone: p.phone || '',
      balance: p.balance,
      credit_limit: p.credit_limit
    }));
    exportToCSV(csvData, `${activeTab === 'client' ? 'Clients' : 'Fournisseurs'}_${new Date().toISOString().split('T')[0]}`, ['Name', 'Account_Code', 'Email', 'Phone', 'Balance', 'Credit_Limit']);
  };

  const exportAgedBalance = () => {
    const doc = new jsPDF();
    const title = `Balance Âgée ${activeTab === 'client' ? 'Clients' : 'Fournisseurs'}`;
    
    // Logo & Header
    try {
      doc.addImage(PDF_CONFIG.logoUrl, 'PNG', 14, 10, 15, 15);
    } catch (e) { console.warn("Logo could not be loaded for PDF"); }

    doc.setFontSize(18);
    doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
    doc.text(title, 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
    doc.text(`Entreprise : ${PDF_CONFIG.companyName}`, 14, 32);
    doc.text(`Date : ${new Date().toLocaleDateString()}`, 14, 37);

    const tableData = agedBalanceData.map(item => [
      item.name,
      formatCurrency(item.balance),
      formatCurrency(item.breakdown.current),
      formatCurrency(item.breakdown.days30),
      formatCurrency(item.breakdown.days60),
      formatCurrency(item.breakdown.days90)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Nom', 'Solde Total', '< 30j', '30-60j', '60-90j', '> 90j']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: (activeTab === 'client' ? PDF_CONFIG.colors.primary : [159, 18, 57]) as [number, number, number],
        textColor: 255,
        fontStyle: 'bold'
      },
      didDrawPage: (data) => {
        const str = "Page " + (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });

    doc.save(`balance_agee_${activeTab}.pdf`);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-brand-green mb-2">
            <div className="p-2 bg-brand-green/10 rounded-xl">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Répertoire Commercial</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Gestion des Tiers</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-base sm:text-lg">Centralisez vos relations clients et fournisseurs (Comptes 411/401)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
          <button 
            onClick={setupOccasional}
            disabled={isSettingUpOccasional}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-500 px-4 py-3 md:px-6 md:py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Créer automatiquement les comptes Client/Fournisseur occasionnels"
          >
            <Users size={18} />
            <span className="whitespace-nowrap">{isSettingUpOccasional ? 'Initialisation...' : 'Init. Occasionnels'}</span>
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-3 md:px-6 md:py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet size={18} />
            <span className="whitespace-nowrap">Exporter CSV</span>
          </button>
          <button 
            onClick={fetchAgedBalance}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-3 md:px-6 md:py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-sm active:scale-95"
          >
            <FileText size={18} />
            <span className="whitespace-nowrap">Balance Âgée</span>
          </button>
          <button 
            onClick={() => { setIsFormOpen(true); setEditingParty(null); resetForm(); }}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
          >
            <UserPlus size={18} />
            <span className="whitespace-nowrap">Nouveau {activeTab === 'client' ? 'Client' : 'Fournisseur'}</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Row */}
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full lg:w-fit overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('client')}
            className={cn(
              "flex-1 lg:flex-none px-6 sm:px-8 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 whitespace-nowrap",
              activeTab === 'client' ? "bg-white dark:bg-slate-900 text-brand-green shadow-xl shadow-slate-200/50 dark:shadow-none" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users size={16} />
            Clients
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={cn(
              "flex-1 lg:flex-none px-6 sm:px-8 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 whitespace-nowrap",
              activeTab === 'supplier' ? "bg-white dark:bg-slate-900 text-rose-500 shadow-xl shadow-slate-200/50 dark:shadow-none" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Briefcase size={16} />
            Fournisseurs
          </button>
        </div>

        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder={`Rechercher par nom ou code compte...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 transition-all text-sm sm:text-base text-slate-900 dark:text-white font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full text-center py-24">
            <div className="w-12 h-12 border-4 border-brand-green/20 border-t-brand-green rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-bold tracking-tight">Chargement de vos tiers...</p>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="col-span-full text-center py-24 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-300">
              <Users size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Aucun tiers enregistré</h3>
            <p className="text-slate-500 font-medium mt-2 max-w-xs mx-auto">Votre base de données est vide. Commencez par ajouter votre premier partenaire commercial.</p>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="mt-8 bg-brand-green text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-green/20 active:scale-95 transition-all"
            >
              Ajouter un tiers
            </button>
          </div>
        ) : (
          filteredParties.map((party) => (
            <div key={party.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all group relative overflow-hidden">
              {/* Hover Actions */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 flex gap-2 z-10">
                <button 
                  onClick={() => openEdit(party)}
                  className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-900 hover:text-white rounded-xl text-slate-400 shadow-xl border border-slate-100 dark:border-slate-700 transition-all active:scale-90"
                  title="Modifier"
                >
                  <FileText size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(party.id)}
                  className="p-3 bg-white dark:bg-slate-800 hover:bg-rose-500 hover:text-white rounded-xl text-slate-400 shadow-xl border border-slate-100 dark:border-slate-700 transition-all active:scale-90"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex items-start gap-6 mb-8">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                  activeTab === 'client' ? "bg-brand-green/5 text-brand-green" : "bg-rose-500/5 text-rose-500"
                )}>
                  {activeTab === 'client' ? <Users size={28} /> : <Briefcase size={28} />}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-xl tracking-tight truncate">{party.name}</h3>
                    {party.is_occasional ? (
                      <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-widest">Occasionnel</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                      {party.account_code}
                    </span>
                    {party.tax_id && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIF: {party.tax_id}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Solde Actuel</span>
                    <span className={cn(
                      "text-2xl font-black font-mono tracking-tighter",
                      party.balance > 0 
                        ? (activeTab === 'client' ? "text-brand-green" : "text-rose-500")
                        : "text-slate-900 dark:text-white"
                    )}>
                      {formatCurrency(party.balance)}
                    </span>
                  </div>
                  
                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        activeTab === 'client' ? "bg-brand-green" : "bg-rose-500"
                      )}
                      style={{ width: party.credit_limit > 0 ? `${Math.min((party.balance / party.credit_limit) * 100, 100)}%` : '0%' }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Plafond Crédit</span>
                    <span className="text-slate-600 dark:text-slate-300 font-mono">{formatCurrency(party.credit_limit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {party.balance > party.credit_limit && party.credit_limit > 0 && (
                    <div className="flex items-center gap-3 text-[10px] font-black text-rose-500 bg-rose-500/5 p-4 rounded-2xl uppercase tracking-widest border border-rose-500/10">
                      <AlertTriangle size={16} />
                      <span>Dépassement de plafond</span>
                    </div>
                  )}

                  {party.overdue_amount > 0 && (
                    <div className="flex items-center gap-3 text-[10px] font-black text-amber-600 bg-amber-500/5 p-4 rounded-2xl uppercase tracking-widest border border-amber-500/10">
                      <AlertTriangle size={16} />
                      <span>Retard: {formatCurrency(party.overdue_amount)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {party.email && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <Mail size={14} className="text-slate-300" />
                      <span className="truncate">{party.email}</span>
                    </div>
                  )}
                  {party.phone && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <Phone size={14} className="text-slate-300" />
                      <span>{party.phone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => openHistory(party)}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                  >
                    <History size={14} />
                    Historique
                  </button>
                  <button
                    onClick={() => openPayment(party)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                      activeTab === 'client' 
                        ? "bg-brand-green text-white shadow-brand-green/20 hover:bg-brand-green-light" 
                        : "bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800"
                    )}
                  >
                    <CreditCard size={14} />
                    {activeTab === 'client' ? 'Encaisser' : 'Régler'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPartyForPayment && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  {activeTab === 'client' ? 'Encaissement' : 'Règlement'}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Financière</p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
              <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl shadow-slate-900/20">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tiers concerné</p>
                  <p className="text-lg font-black tracking-tight">{selectedPartyForPayment.name}</p>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Solde actuel</span>
                    <span className="text-xl font-black font-mono tracking-tighter">{formatCurrency(selectedPartyForPayment.balance)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant ({currency})</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={isNaN(paymentData.amount) ? '' : paymentData.amount}
                    onChange={e => setPaymentData({...paymentData, amount: parseFloat(e.target.value)})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tighter"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                      <input
                        required
                        type="date"
                        value={paymentData.date}
                        onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode</label>
                      <select
                          value={paymentData.mode}
                          onChange={e => setPaymentData({...paymentData, mode: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                      >
                          <option value="banque">Banque</option>
                          <option value="caisse">Caisse</option>
                          <option value="mobile_money">Mobile Money</option>
                      </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence / Libellé</label>
                  <input
                    required
                    type="text"
                    value={paymentData.reference}
                    onChange={e => setPaymentData({...paymentData, reference: e.target.value})}
                    placeholder="Ex: Virement facture F-2024-001"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 bg-brand-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-green/20 hover:bg-brand-green-light transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle size={18} />
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && historyParty && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  Historique : {historyParty.name}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détail des transactions et solde progressif</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto">
              {loadingHistory ? (
                <div className="text-center py-24">
                  <div className="w-12 h-12 border-4 border-brand-green/20 border-t-brand-green rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-500 font-bold tracking-tight">Chargement de l'historique...</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[2rem] border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                        <th className="px-6 py-6">Date</th>
                        <th className="px-6 py-6">Libellé / Référence</th>
                        <th className="px-6 py-6 text-right">Débit</th>
                        <th className="px-6 py-6 text-right">Crédit</th>
                        <th className="px-6 py-6 text-right">Solde</th>
                        <th className="px-6 py-6 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="px-6 py-5 font-bold text-slate-500">{new Date(tx.date).toLocaleDateString()}</td>
                          <td className="px-6 py-5">
                            <div className="font-black text-slate-900 dark:text-white tracking-tight">{tx.description}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tx.reference}</div>
                          </td>
                          <td className="px-6 py-5 text-right font-bold font-mono text-slate-900 dark:text-white">
                            {tx.debit > 0 ? formatCurrency(tx.debit) : '-'}
                          </td>
                          <td className="px-6 py-5 text-right font-bold font-mono text-slate-900 dark:text-white">
                            {tx.credit > 0 ? formatCurrency(tx.credit) : '-'}
                          </td>
                          <td className="px-6 py-5 text-right font-black font-mono text-brand-green text-lg tracking-tighter">
                            {formatCurrency(tx.running_balance)}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {tx.invoice_id && (
                              <button 
                                onClick={() => window.location.href = `/invoices/${tx.invoice_id}`}
                                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-900 hover:text-white rounded-lg text-slate-400 transition-all active:scale-90"
                                title="Voir Facture"
                              >
                                <ExternalLink size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                            Aucune transaction trouvée.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  {editingParty ? 'Modifier' : 'Nouveau'} {activeTab === 'client' ? 'Client' : 'Fournisseur'}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fiche d'identification</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom / Raison Sociale *</label>
                <input
                  required
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adresse Complète</label>
                <textarea
                  value={formData.address || ''}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NCC (Contribuable)</label>
                  <input
                    type="text"
                    value={formData.tax_id || ''}
                    onChange={e => setFormData({...formData, tax_id: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Délai (jours)</label>
                  <input
                    type="number"
                    value={formData.payment_terms || 0}
                    onChange={e => setFormData({...formData, payment_terms: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plafond de crédit ({currency})</label>
                <input
                  type="number"
                  value={formData.credit_limit || 0}
                  onChange={e => setFormData({...formData, credit_limit: parseFloat(e.target.value) || 0})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-green/5 text-lg font-black font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="is_occasional"
                  checked={formData.is_occasional}
                  onChange={e => setFormData({...formData, is_occasional: e.target.checked})}
                  className="w-5 h-5 rounded-lg border-slate-300 text-brand-green focus:ring-brand-green"
                />
                <label htmlFor="is_occasional" className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest cursor-pointer">
                  Tiers Occasionnel
                </label>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 bg-slate-900 dark:bg-brand-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 dark:hover:bg-brand-green-light transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Save size={18} />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Aged Balance Modal */}
      {showAgedBalance && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-xl">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                  Balance Âgée {activeTab === 'client' ? 'Clients' : 'Fournisseurs'}
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyse des créances par ancienneté</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={exportAgedBalance}
                  className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-900 hover:text-white rounded-2xl text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"
                  title="Télécharger PDF"
                >
                  <Download size={20} />
                </button>
                <button onClick={() => setShowAgedBalance(false)} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-90 shadow-sm border border-slate-100 dark:border-slate-700">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto">
              <div className="overflow-x-auto rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                      <th className="px-6 py-6">Tiers</th>
                      <th className="px-6 py-6 text-right">Solde Total</th>
                      <th className="px-6 py-6 text-right text-emerald-400">Non échu</th>
                      <th className="px-6 py-6 text-right text-amber-400">30-60j</th>
                      <th className="px-6 py-6 text-right text-orange-400">60-90j</th>
                      <th className="px-6 py-6 text-right text-rose-400">&gt; 90j</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {agedBalanceData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-5 font-black text-slate-900 dark:text-white tracking-tight">{item.name}</td>
                        <td className="px-6 py-5 text-right font-black font-mono text-slate-900 dark:text-white text-lg tracking-tighter">{formatCurrency(item.balance)}</td>
                        <td className="px-6 py-5 text-right font-bold font-mono text-slate-500">{formatCurrency(item.breakdown.current)}</td>
                        <td className="px-6 py-5 text-right font-bold font-mono text-slate-500">{formatCurrency(item.breakdown.days30)}</td>
                        <td className="px-6 py-5 text-right font-bold font-mono text-slate-500">{formatCurrency(item.breakdown.days60)}</td>
                        <td className="px-6 py-5 text-right font-black font-mono text-rose-500">{formatCurrency(item.breakdown.days90)}</td>
                      </tr>
                    ))}
                    {agedBalanceData.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                          Aucune donnée disponible.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
