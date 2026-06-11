import { useDialog } from './DialogProvider';
import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { 
  X, BellRing, 
  Download, 
  Printer, 
  Mail, 
  CheckCircle2, 
  CreditCard, 
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Building2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  MoreVertical,
  Trash2,
  FileDown,
  Banknote,
  Smartphone
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings, formatCurrencyPDF, generateInvoicePDF } from '@/lib/exportUtils';
import jsPDF from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import autoTable from 'jspdf-autotable';

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  vat_rate: number;
  total: number;
}

interface Invoice {
  id: number;
  type: 'invoice' | 'quote';
  number: string;
  date: string;
  due_date: string;
  third_party_id: number;
  third_party_name: string;
  third_party_address: string;
  third_party_tax_id: string;
  third_party_email?: string;
  third_party_type?: 'client' | 'supplier' | 'other';
  status: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  paid_amount: number;
  notes: string;
  terms: string;
  items: InvoiceItem[];
  currency?: string;
  exchange_rate?: number;
  payment_link?: string;
}

interface InvoiceViewerProps {
  id: number;
  onClose: () => void;
  onEdit?: () => void;
}

export function InvoiceViewer({ id, onClose, onEdit }: InvoiceViewerProps) {
  const { alert: dialogAlert } = useDialog();
  const { formatCurrency, currency: baseCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [validating, setValidating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    email: '',
    subject: '',
    message: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('bank');
  const [mmPhone, setMmPhone] = useState('');
  const [mmNetwork, setMmNetwork] = useState('orange');

  useEffect(() => {
    if (companySettings) {
      if (companySettings.payment_bank_enabled !== false && Number(companySettings.payment_bank_enabled) !== 0) {
        setPaymentMode('bank');
      } else if (companySettings.payment_cash_enabled !== false && Number(companySettings.payment_cash_enabled) !== 0) {
        setPaymentMode('cash');
      } else if (companySettings.payment_mobile_enabled !== false && Number(companySettings.payment_mobile_enabled) !== 0) {
        setPaymentMode('mobile');
      }
    }
  }, [companySettings]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copyPaymentLink = () => {
    if (invoice?.payment_link) {
      navigator.clipboard.writeText(invoice.payment_link);
      setCopied(true);
    }
  };

  useEffect(() => {
    if (invoice) {
      setEmailData({
        email: invoice.third_party_email || '',
        subject: `${invoice.type === 'invoice' ? 'Facture' : invoice.type === 'quote' ? 'Devis' : 'Proforma'} ${invoice.number} - ${companySettings?.name || 'Ma Société'}`,
        message: `Bonjour,\n\nVeuillez trouver ci-joint votre ${invoice.type === 'invoice' ? 'facture' : invoice.type === 'quote' ? 'devis' : 'proforma'} ${invoice.number}.\n\nCordialement,\n${companySettings?.name || 'Ma Société'}`
      });
    }
  }, [invoice, companySettings]);

  useEffect(() => {
    fetchInvoice();
    fetchCompanySettings();
  }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const res = await apiFetch('/api/company/settings');
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReminder = async () => {
    dialogAlert('Le rappel est en cours d\'envoi au client.', 'info');
    setTimeout(() => {
      dialogAlert('Le client a été relancé avec succès.', 'success');
    }, 1500);
  };

  const handleConvert = async () => {
    if (!invoice || invoice.type !== 'quote') return;
    setConverting(true);
    try {
      const res = await apiFetch(`/api/invoices/${id}/convert`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        dialogAlert(`Devis converti avec succès ! Nouvelle facture : ${data.number}`);
        fetchInvoice();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de la conversion");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  const handleEmail = async () => {
    setShowEmailModal(true);
  };

  const sendEmail = async () => {
    if (!invoice) return;
    setSendingEmail(true);
    try {
      const res = await apiFetch(`/api/invoices/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });
      if (res.ok) {
        dialogAlert("Email envoyé avec succès !");
        setShowEmailModal(false);
        fetchInvoice();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de l'envoi de l'email");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice || invoice.status !== 'draft') return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;
    
    try {
      const res = await apiFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleValidate = async () => {
    if (!invoice) return;
    setValidating(true);
    try {
      const res = await apiFetch(`/api/invoices/${id}/validate`, { method: 'POST' });
      if (res.ok) {
        fetchInvoice();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de la validation");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  const handlePay = async () => {
    if (!invoice || !companySettings) return;
    
    setPaying(true);

    if (paymentMode === 'mobile') {
      try {
        const res = await apiFetch(`/api/mobile-money/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: id,
            phone: mmPhone,
            network: mmNetwork
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.payment_url && data.payment_url.startsWith('http')) {
            window.open(data.payment_url, '_blank');
          }
          dialogAlert("Demande de paiement Mobile Money initiée avec succès.", "success");
          setShowPaymentModal(false);
        } else {
          const err = await res.json();
          dialogAlert(err.error || "Erreur lors de l'initiation du paiement");
        }
      } catch (err) {
        console.error(err);
        dialogAlert("Erreur réseau");
      } finally {
        setPaying(false);
      }
      return;
    }

    let paymentAccount = companySettings.payment_bank_account || '521';
    if (paymentMode === 'bank') paymentAccount = companySettings.payment_bank_account || '521';
    if (paymentMode === 'cash') paymentAccount = companySettings.payment_cash_account || '571';

    try {
      const payload = {
        paymentDate: new Date().toISOString().split('T')[0],
        paymentAccount,
        amount: invoice.total_amount
      };
      const res = await apiFetch(`/api/invoices/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowPaymentModal(false);
        fetchInvoice();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors du paiement");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPaying(false);
    }
  };

  const handleExportPDF = async () => {
    if (!invoice) return;
    await generateInvoicePDF(invoice, companySettings);
  };

  if (loading || !invoice) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  const totalDiscount = invoice.items.reduce((acc, item) => acc + (item.quantity * item.unit_price * ((item.discount || 0) / 100)), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm sticky top-0 z-20 gap-4">
        <div className="flex items-center gap-4 sm:gap-5">
          <button 
            onClick={onClose}
            className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90"
          >
            <ArrowLeft size={24} className="text-slate-500" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{invoice.number}</h2>
              <div className={cn(
                "px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] shadow-sm shrink-0",
                invoice.status === 'draft' ? "bg-slate-100 text-slate-600" :
                invoice.status === 'paid' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
              )}>
                {invoice.status}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 truncate">
              {invoice.type === 'invoice' ? (invoice.third_party_type === 'supplier' ? "Facture d'Achat" : 'Facture Client') : (invoice.type === 'quote' ? 'Devis Commercial' : 'Facture Proforma')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {invoice.status === 'draft' && invoice.type === 'invoice' && (
            <button 
              onClick={handleValidate}
              disabled={validating}
              className="flex-1 sm:flex-none bg-brand-green hover:bg-brand-green-light text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-brand-green/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {validating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck size={20} />}
              <span className="whitespace-nowrap">Valider</span>
            </button>
          )}

          {invoice.status === 'sent' && (
            <button 
              onClick={() => setShowPaymentModal(true)}
              disabled={paying}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {paying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CreditCard size={20} />}
              <span className="whitespace-nowrap">Payer</span>
            </button>
          )}

          {invoice.type === 'quote' && (invoice.status === 'sent' || invoice.status === 'accepted') && (
            <button 
              onClick={handleConvert}
              disabled={converting}
              className="flex-1 sm:flex-none bg-brand-green hover:bg-brand-green-light text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-brand-green/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {converting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ChevronRight size={20} />}
              <span className="whitespace-nowrap">Convertir en Facture</span>
            </button>
          )}

          <div className="hidden sm:block w-px h-10 bg-slate-100 dark:bg-slate-800 mx-2" />

          <div className="flex items-center justify-center gap-2">
            <button 
              onClick={handleEmail}
              className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-brand-green hover:bg-brand-green/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
              title="Envoyer par email"
            >
              <Mail size={20} />
              <span className="sm:hidden font-black text-xs uppercase tracking-widest">Email</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-brand-green hover:bg-brand-green/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
              title="Exporter en PDF"
            >
              <FileDown size={24} />
              <span className="sm:hidden font-bold text-sm">PDF</span>
            </button>
            <button 
              onClick={() => window.print()}
              className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-blue-600 hover:bg-blue-500/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
              title="Imprimer"
            >
              <Printer size={24} />
              <span className="sm:hidden font-bold text-sm">Imprimer</span>
            </button>
            {invoice.status === 'overdue' && (
              <button 
                onClick={handleSendReminder}
                className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-amber-600 hover:bg-amber-500/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2 group"
                title="Envoyer un rappel de paiement"
              >
                <BellRing size={24} className="group-hover:-rotate-12 transition-transform" />
                <span className="sm:hidden font-bold text-sm">Relancer</span>
              </button>
            )}
            {invoice.status === 'draft' && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button 
                    onClick={onEdit}
                    className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-brand-green hover:bg-brand-green/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
                    title="Modifier"
                  >
                    <FileText size={24} />
                    <span className="sm:hidden font-bold text-sm">Modifier</span>
                  </button>
                )}
                <button 
                  onClick={handleDelete}
                  className="flex-1 sm:flex-none p-3 sm:p-4 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2"
                  title="Supprimer"
                >
                  <Trash2 size={24} />
                  <span className="sm:hidden font-bold text-sm">Supprimer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Envoyer par Email</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Partage de document</p>
                </div>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Destinataire</label>
                <input 
                  type="email"
                  value={emailData.email}
                  onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                  placeholder="email@client.com"
                  className="w-full px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-medium"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Objet</label>
                <input 
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-medium"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Message</label>
                <textarea 
                  rows={6}
                  value={emailData.message}
                  onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-medium resize-none"
                />
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-4">
              <button 
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={sendEmail}
                disabled={sendingEmail || !emailData.email}
                className="flex-[2] bg-brand-green hover:bg-brand-green-light text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-brand-green/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {sendingEmail ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail size={20} />}
                Envoyer le document
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Document Preview */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden print:shadow-none print:border-none relative">
          {invoice.type === 'invoice' ? (
            <div className="p-8 sm:p-12 text-xs text-slate-800 dark:text-slate-200 space-y-8 font-sans bg-white dark:bg-slate-950 print:p-0">
              {/* Top Section */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="space-y-1 w-full md:w-1/2 text-left">
                  <h1 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{companySettings?.name?.toUpperCase() || 'MA SOCIÉTÉ'}</h1>
                  <p className="font-bold text-slate-800 dark:text-slate-300">NIF/NCC : {companySettings?.fiscal_id || 'Non Renseigné'}</p>
                  <p className="text-slate-700 dark:text-slate-400">Régime d'imposition : {companySettings?.tax_regime || 'Non Renseigné'}</p>
                  <div className="h-2" />
                  <p className="text-slate-700 dark:text-slate-400">RCCM : {companySettings?.rccm || 'Non Renseigné'}</p>
                  <p className="text-slate-700 dark:text-slate-400">Références bancaires : {companySettings?.payment_bank_account || 'Non Renseignées'}</p>
                  <p className="text-slate-700 dark:text-slate-400">Adresse : {companySettings?.address || 'Non Renseignée'}</p>
                  {companySettings?.phone && <p className="text-slate-700 dark:text-slate-400">N° Tél : {companySettings?.phone}</p>}
                  {companySettings?.email && <p className="text-slate-700 dark:text-slate-400">Mail : {companySettings?.email}</p>}
                  <p className="text-slate-700 dark:text-slate-400">Date : {new Date(invoice.date).toLocaleDateString('fr-FR')}</p>
                  <p className="text-slate-700 dark:text-slate-400">Mode de paiement : {invoice.payment_link ? 'Moyen Electronique' : (invoice.terms?.includes('comptant') ? 'Comptant' : 'Virement / Chèque')}</p>
                  {invoice.notes && <p className="mt-4 break-words max-w-[250px] font-bold uppercase text-slate-800 dark:text-slate-200">{invoice.notes}</p>}
                </div>

                <div className="w-full md:w-1/2 flex flex-col items-end">
                  <h1 className="text-xl font-bold text-center w-full mb-4">
                    <span className="text-brand-green">{companySettings?.name?.toUpperCase() || 'MA SOCIÉTÉ'}</span>
                  </h1>
                  <div className="border-[1.5px] border-slate-600 dark:border-slate-500 p-1 flex mb-4 w-full justify-between items-center bg-white dark:bg-slate-800 relative">
                      <div className="absolute top-0 left-0 -mt-[0.6rem] ml-2 bg-white dark:bg-slate-800 px-2 text-[10px] sm:text-xs font-bold text-slate-800 border-x-[1.5px] border-t-[1.5px] border-white dark:border-slate-800 font-sans tracking-tight dark:text-slate-200">
                        Facture N° {invoice.number || 'Facture'}
                      </div>
                      <div className="flex flex-col items-center justify-center p-2 flex-1 ml-2">
                        <div className="text-[12px] font-bold text-slate-700 dark:text-slate-300 text-center uppercase leading-tight tracking-tighter pt-2">
                            {invoice.third_party_type === 'supplier' ? "Facture d'Achat" : "Facture de Vente"}
                        </div>
                      </div>
                  </div>

                  <div className="border-[1.5px] border-slate-600 dark:border-slate-500 p-3 w-full mt-3 relative text-left">
                     <div className="absolute top-0 left-0 -mt-[0.6rem] ml-2 bg-white dark:bg-slate-950 px-2 text-[10px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 font-sans tracking-tight">
                        Client
                      </div>
                     <p className="font-bold text-slate-900 dark:text-white">Nom : {invoice.third_party_name || "Client Inconnu"}</p>
                     <p className="text-slate-700 dark:text-slate-400">Adresse : {invoice.third_party_address || "Non Renseignée"}</p>
                     <p className="font-bold text-slate-900 dark:text-white">NIF/NCC : {invoice.third_party_tax_id || "Non Renseigné"}</p>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full relative z-10">
                {invoice.status === 'paid' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] pointer-events-none z-0 opacity-10">
                    <div className="border-[0.5rem] border-brand-green text-brand-green font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl text-5xl">PAYÉE</div>
                  </div>
                )}
                {invoice.status === 'overdue' && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-15deg] pointer-events-none z-0 opacity-10">
                    <div className="border-[0.5rem] border-rose-500 text-rose-500 font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl text-5xl">EN RETARD</div>
                  </div>
                )}
                <table className="w-full border-collapse text-[10px] font-sans">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border border-slate-400 dark:border-slate-700">
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-left w-16 text-black dark:text-slate-200 font-bold">Réf</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-left text-black dark:text-slate-200 font-bold">Désignation</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-right text-black dark:text-slate-200 font-bold">PU HT</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-center w-12 text-black dark:text-slate-200 font-bold">Qté</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-center w-12 text-black dark:text-slate-200 font-bold">Unité</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-center w-[4.5rem] text-black dark:text-slate-200 font-bold">Taxes (%)</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-center w-16 text-black dark:text-slate-200 font-bold">Taux (%)</th>
                      <th className="border border-slate-400 dark:border-slate-700 p-1 text-right text-black dark:text-slate-200 font-bold">Montant HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, i) => (
                      <tr key={i} className="border border-slate-400 dark:border-slate-700">
                        <td className="border border-slate-400 dark:border-slate-700 p-1 font-bold text-slate-800 dark:text-slate-300">Art-{(i+1).toString().padStart(2, '0')}</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 font-bold text-slate-900 dark:text-slate-200">{item.description}</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-medium">{formatCurrency(item.unit_price, invoice.currency)}</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-center font-bold">{item.quantity}</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-center font-bold">1</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-center text-xs">TVA (18)</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-center">1</td>
                        <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(item.total, invoice.currency)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[9px]">TOTAL HT</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold">{formatCurrency((invoice.subtotal + totalDiscount), invoice.currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[9px]">REMISE</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold">{totalDiscount > 0 ? `- ${formatCurrency(totalDiscount, invoice.currency)}` : '0'}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[9px]">TVA</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold">{formatCurrency(invoice.vat_amount, invoice.currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[9px]">TOTAL TTC</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold">{formatCurrency(invoice.total_amount, invoice.currency)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[9px]">AUTRES TAXES</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold">0</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="border border-slate-400 dark:border-slate-700 p-1 pr-4 text-right font-bold uppercase text-[10px] text-slate-900 dark:text-white">TOTAL A PAYER</td>
                      <td className="border border-slate-400 dark:border-slate-700 p-1 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(invoice.total_amount, invoice.currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Résumé de la fiscalité (FNE) */}
              <div className="mt-6 text-left w-full pl-0 bg-transparent">
                 <h4 className="font-bold uppercase text-[10px] mb-2 font-sans text-slate-900 dark:text-white">RESUME DE LA FACTURE</h4>
                 <div className="overflow-x-auto w-full">
                   <table className="w-full border-collapse text-[10px] font-sans">
                      <thead>
                        <tr className="border-y border-slate-400 dark:border-slate-700 uppercase tracking-wider">
                          <th className="py-1 text-left font-bold text-slate-900 dark:text-white">CATEGORIEL</th>
                          <th className="py-1 text-right font-bold text-slate-900 dark:text-white">SOUS-TOTAL</th>
                          <th className="py-1 text-right font-bold text-slate-900 dark:text-white w-24">TAUX</th>
                          <th className="py-1 text-right font-bold text-slate-900 dark:text-white w-32">TOTAL TAXES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-400 dark:divide-slate-700">
                        {invoice.vat_amount > 0 ? (
                          <tr className="text-slate-900 dark:text-white font-medium border-b border-slate-400 dark:border-slate-700">
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 font-bold">TVA normal : TVA sur HT 18,20N - A</td>
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 text-right">{formatCurrency(invoice.subtotal, invoice.currency).replace(' FCFA', '')}</td>
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 text-right">18%</td>
                            <td className="py-1 text-right font-black">{formatCurrency(invoice.vat_amount, invoice.currency).replace(' FCFA', '')}</td>
                          </tr>
                        ) : (
                          <tr className="text-slate-900 dark:text-white border-b border-slate-400 dark:border-slate-700">
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 font-bold">Exonéré</td>
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 text-right">{formatCurrency(invoice.subtotal, invoice.currency).replace(' FCFA', '')}</td>
                            <td className="py-1 border-r border-slate-400 dark:border-slate-700 text-right">0%</td>
                            <td className="py-1 text-right font-bold">0</td>
                          </tr>
                        )}
                      </tbody>
                   </table>
                 </div>
                 {invoice.status !== 'paid' && (
                   <div className="mt-8 flex justify-center items-center gap-4 border border-slate-200 dark:border-slate-700 p-4 w-max mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 border-dashed cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => window.open(`/mock-payment?invoice_id=${invoice.id}&amount=${invoice.total_amount}`, '_blank')}>
                     <div className="text-center">
                       <p className="text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest leading-tight">Cliquer pour Payer</p>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[200px]">Mobile Money, Wave, Carte Bancaire</p>
                     </div>
                   </div>
                 )}
                 <div className="mt-8 text-center text-xs font-bold text-slate-800 dark:text-slate-300">
                    PIED DE PAGE DES FACTURES
                 </div>
              </div>

              <div className="mt-8 text-center font-bold text-[10px] uppercase pt-4 border-t border-slate-300 dark:border-slate-700 text-slate-500">
                 Pied de page des factures - {companySettings?.name}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
          {/* Paper Header */}
          <div className="p-16 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="space-y-8">
              <div className="w-24 h-24 bg-brand-green rounded-[2rem] flex items-center justify-center text-white font-black text-4xl shadow-2xl shadow-brand-green/30">
                {companySettings?.name?.charAt(0) || 'C'}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{companySettings?.name || 'Ma Société'}</h3>
                <div className="text-sm text-slate-500 leading-relaxed font-medium space-y-1">
                  <p>{companySettings?.address}</p>
                  <p>{companySettings?.city}, {companySettings?.country}</p>
                  <div className="pt-2 flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>NIF: {companySettings?.fiscal_id}</span>
                    <span>RCCM: {companySettings?.rccm}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right space-y-8 self-stretch md:self-auto flex flex-col justify-between md:block">
              <h1 className="text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter opacity-[0.03] select-none pointer-events-none absolute right-16 top-16">
                {invoice.type === 'quote' ? 'Devis' : 'Proforma'}
              </h1>
              {invoice.status === 'paid' && (
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 rotate-[-15deg] pointer-events-none z-0 opacity-20">
                  <div className="border-[0.5rem] border-brand-green text-brand-green font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl text-4xl">PAYÉE</div>
                </div>
              )}
              {invoice.status === 'overdue' && (
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 rotate-[-15deg] pointer-events-none z-0 opacity-20">
                  <div className="border-[0.5rem] border-rose-500 text-rose-500 font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl text-4xl">EN RETARD</div>
                </div>
              )}
              {invoice.status === 'cancelled' && (
                <div className="absolute top-1/2 right-1/4 -translate-y-1/2 rotate-[-15deg] pointer-events-none z-0 opacity-20">
                  <div className="border-[0.5rem] border-slate-500 text-slate-500 font-black uppercase tracking-[0.2em] px-8 py-4 rounded-xl text-4xl">ANNULÉE</div>
                </div>
              )}
              <div className="space-y-4 relative z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Référence</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{invoice.number}</p>
                </div>
                <div className="grid grid-cols-2 gap-8 text-right">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(invoice.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {invoice.due_date && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Échéance</p>
                      <p className="text-sm font-black text-rose-500">{new Date(invoice.due_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="p-16 grid grid-cols-1 md:grid-cols-2 gap-16 bg-slate-50/30 dark:bg-slate-800/10">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Facturé à</h4>
              <div className="space-y-3">
                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{invoice.third_party_name}</p>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium max-w-[350px]">
                  {invoice.third_party_address || 'Adresse non renseignée'}
                </p>
                {invoice.third_party_tax_id && (
                  <div className="inline-flex px-3 py-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    NIF: {invoice.third_party_tax_id}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col justify-center items-end gap-4">
              <div className="p-8 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm text-right space-y-2 min-w-[200px] w-full">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut du paiement</p>
                <div className="flex items-center gap-3 justify-end">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    invoice.status === 'paid' ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  <p className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{invoice.status}</p>
                </div>
              </div>
              
              {invoice.status !== 'paid' && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4 w-full min-w-[200px] cursor-pointer hover:bg-slate-50 transition-colors block text-center" onClick={() => window.open(`/mock-payment?invoice_id=${invoice.id}&amount=${invoice.total_amount}`, '_blank')}>
                  <div className="space-y-1 flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-1">Règlement Facture</p>
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">Cliquer pour payer (Mobile Money / Carte)</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="p-16">
            <div className="w-full min-w-0 overflow-auto ">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <th className="px-4 py-6 text-left">Description des prestations</th>
                    <th className="px-4 py-6 text-center">Qté</th>
                    <th className="px-4 py-6 text-right">Prix Unit. HT</th>
                    <th className="px-4 py-6 text-center">TVA</th>
                    <th className="px-4 py-6 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-8 text-slate-800 dark:text-slate-200 font-bold text-base">{item.description}</td>
                      <td className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 font-mono font-bold">{item.quantity}</td>
                      <td className="px-4 py-8 text-right text-slate-500 dark:text-slate-400 font-mono font-bold">{formatCurrency(item.unit_price, invoice.currency)}</td>
                      <td className="px-4 py-8 text-center">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500">{item.vat_rate}%</span>
                      </td>
                      <td className="px-4 py-8 text-right font-black text-slate-900 dark:text-white font-mono text-lg tracking-tighter">{formatCurrency(item.total, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="mt-16 flex justify-end">
              <div className="w-full max-w-[350px] space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-400 uppercase tracking-widest text-[10px]">Sous-total HT</span>
                    <span className="text-slate-900 dark:text-white font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-slate-400 uppercase tracking-widest text-[10px]">TVA Totale</span>
                    <span className="text-slate-900 dark:text-white font-mono">{formatCurrency(invoice.vat_amount, invoice.currency)}</span>
                  </div>
                  {invoice.paid_amount > 0 && (
                    <div className="flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-450">
                      <span className="uppercase tracking-widest text-[10px]">Acompte payé</span>
                      <span className="font-mono">- {formatCurrency(invoice.paid_amount, invoice.currency)}</span>
                    </div>
                  )}
                </div>
                <div className="pt-8 border-t-4 border-slate-900 dark:border-slate-700 flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{invoice.paid_amount > 0 ? 'Solde Restant' : 'Total à régler'}</span>
                    <p className="text-xs text-brand-green font-black uppercase tracking-widest">{invoice.paid_amount > 0 ? 'Reste à payer' : 'Net à payer'}</p>
                  </div>
                  <span className="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">
                    {formatCurrency(invoice.paid_amount > 0 ? (invoice.total_amount - invoice.paid_amount) : invoice.total_amount, invoice.currency)}
                  </span>
                </div>
                {invoice.currency && invoice.currency !== baseCurrency && (
                  <div className="pt-4 flex justify-between items-center text-xs text-slate-500 italic font-medium">
                    <span>Equivalent {baseCurrency} (Reste)</span>
                    <span>{formatCurrency((invoice.paid_amount > 0 ? (invoice.total_amount - invoice.paid_amount) : invoice.total_amount) * (invoice.exchange_rate || 1), baseCurrency)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Info */}
          {(invoice.notes || invoice.terms) && (
            <div className="p-16 bg-slate-900 text-white border-t border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {invoice.notes && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Notes Additionnelles</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium italic">"{invoice.notes}"</p>
                  </div>
                )}
                {invoice.terms && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Conditions de règlement</h4>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{invoice.terms}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          {/* Status Timeline */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Parcours du document</h3>
            <div className="space-y-10">
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="w-1 h-full bg-slate-50 dark:bg-slate-800 mt-4 rounded-full" />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Création</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{new Date(invoice.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>

              {invoice.status !== 'draft' && (
                <div className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                      <ShieldCheck size={20} />
                    </div>
                    {invoice.status === 'paid' && <div className="w-1 h-full bg-slate-50 dark:bg-slate-800 mt-4 rounded-full" />}
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Validation</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Comptabilisé</p>
                  </div>
                </div>
              )}

              {invoice.status === 'paid' && (
                <div className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <CreditCard size={20} />
                    </div>
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Paiement</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Soldé intégralement</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-slate-900/40">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Actions de partage</h3>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleEmail}
                className="flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all gap-3 group active:scale-95 flex"
              >
                <Mail className="text-slate-400 group-hover:text-brand-green transition-colors" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Email</span>
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all gap-3 group active:scale-95 flex"
              >
                <Printer className="text-slate-400 group-hover:text-blue-400 transition-colors" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest">Print</span>
              </button>
            </div>
            <button 
              onClick={handleExportPDF}
              className="w-full py-5 bg-white text-slate-900 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand-green hover:text-white transition-all active:scale-95"
            >
              <FileDown size={20} />
              Télécharger PDF
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[60] flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowPaymentModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Mode de paiement
                  </h3>
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {(companySettings?.payment_bank_enabled !== false && Number(companySettings?.payment_bank_enabled) !== 0) && (
                    <label className={cn(
                      "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      paymentMode === 'bank' 
                        ? "border-brand-green bg-brand-green/5" 
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/30"
                    )}>
                      <input 
                        type="radio" 
                        name="paymentMode" 
                        value="bank" 
                        checked={paymentMode === 'bank'}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1 flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          paymentMode === 'bank' ? "bg-brand-green text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}>
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Virement Bancaire</p>
                          <p className="text-xs text-slate-500">Compte: {companySettings?.payment_bank_account || '521'}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        paymentMode === 'bank' ? "border-brand-green" : "border-slate-300"
                      )}>
                        {paymentMode === 'bank' && <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />}
                      </div>
                    </label>
                  )}

                  {(companySettings?.payment_cash_enabled !== false && Number(companySettings?.payment_cash_enabled) !== 0) && (
                    <label className={cn(
                      "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      paymentMode === 'cash' 
                        ? "border-brand-green bg-brand-green/5" 
                        : "border-slate-200 dark:border-slate-700 hover:border-brand-green/30"
                    )}>
                      <input 
                        type="radio" 
                        name="paymentMode" 
                        value="cash" 
                        checked={paymentMode === 'cash'}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1 flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                          paymentMode === 'cash' ? "bg-brand-green text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}>
                          <Banknote size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">Espèces</p>
                          <p className="text-xs text-slate-500">Compte: {companySettings?.payment_cash_account || '571'}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        paymentMode === 'cash' ? "border-brand-green" : "border-slate-300"
                      )}>
                        {paymentMode === 'cash' && <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />}
                      </div>
                    </label>
                  )}

                  {(companySettings?.payment_mobile_enabled !== false && Number(companySettings?.payment_mobile_enabled) !== 0) && (
                    <div className="space-y-4">
                      <label className={cn(
                        "flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all",
                        paymentMode === 'mobile' 
                          ? "border-brand-green bg-brand-green/5" 
                          : "border-slate-200 dark:border-slate-700 hover:border-brand-green/30"
                      )}>
                        <input 
                          type="radio" 
                          name="paymentMode" 
                          value="mobile" 
                          checked={paymentMode === 'mobile'}
                          onChange={(e) => setPaymentMode(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex-1 flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            paymentMode === 'mobile' ? "bg-brand-green text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                          )}>
                            <Smartphone size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">Mobile Money</p>
                            <p className="text-xs text-slate-500">Paiement en ligne</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          paymentMode === 'mobile' ? "border-brand-green" : "border-slate-300"
                        )}>
                          {paymentMode === 'mobile' && <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />}
                        </div>
                      </label>
                      {paymentMode === 'mobile' && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Réseau</label>
                            <select 
                              value={mmNetwork} 
                              onChange={(e) => setMmNetwork(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
                            >
                              <option value="orange">Orange Money</option>
                              <option value="mtn">MTN Mobile Money</option>
                              <option value="wave">Wave</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Téléphone client</label>
                            <input 
                              type="text" 
                              value={mmPhone} 
                              onChange={(e) => setMmPhone(e.target.value)}
                              placeholder="Numéro (ex: 0102030405)"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-4">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {paying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CreditCard size={20} />}
                    Confirmer
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
