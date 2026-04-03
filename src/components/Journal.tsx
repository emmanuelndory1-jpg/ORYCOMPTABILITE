import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, Navigate, Outlet, useNavigate, Link } from 'react-router-dom';
import { Plus, Upload, FileText, Check, X, Loader2, Calculator, ArrowRight, Wand2, Pencil, Download, Settings, Filter, Trash2, FileSpreadsheet, Zap, ExternalLink, FileX, FilePlus, Edit, Settings2, Hash, Search } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';
import { 
  DEFAULT_OPERATION_TYPES, 
  calculateEntries, 
  CustomOperation, 
  CustomOperationTemplate, 
  JournalEntryLine, 
  PaymentMode 
} from '@/lib/accounting';
import { suggestJournalEntry, AISuggestion, analyzeInvoice } from '@/services/geminiService';

interface Transaction {
  id: number;
  date: string;
  description: string;
  reference: string;
  status: string;
  total_amount: number;
  currency?: string;
  exchange_rate?: number;
  occasional_name?: string;
  notes?: string;
  document_url?: string;
  invoice_number?: string;
  invoice_id?: number;
  recurring_transaction_id?: string;
}

interface DetailedTransaction extends Transaction {
  entries: JournalEntryLine[];
}

type OperationType = string; // Allow dynamic types

export function Journal({ openModal, onModalClose }: { openModal?: boolean; onModalClose?: () => void }) {
  const navigate = useNavigate();
  const { confirm, alert: dialogAlert } = useDialog();
  const { t } = useLanguage();
  const { formatCurrency, currency: baseCurrency, exchangeRates, getExchangeRate } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [thirdPartyFilter, setThirdPartyFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [customOperations, setCustomOperations] = useState<CustomOperation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transactionCurrency, setTransactionCurrency] = useState('FCFA');
  const [transactionExchangeRate, setTransactionExchangeRate] = useState(1);
  const [isCustomOpModalOpen, setIsCustomOpModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [mode, setMode] = useState<'guided' | 'expert'>('guided');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<DetailedTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);
  const [quickInvoiceData, setQuickInvoiceData] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);

  useEffect(() => {
    if (openModal) {
      openNewModal();
    }
  }, [openModal]);

  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF-${year}${month}${day}-${random}`;
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setReference('');
    setDescription('');
    setNotes('');
    setDocumentUrls([]);
    setEntries([{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
    if (onModalClose) onModalClose();
  };

  useEffect(() => {
    if (baseCurrency && !editingId) {
      setTransactionCurrency(baseCurrency);
      setTransactionExchangeRate(1);
    }
  }, [baseCurrency, editingId]);

  useEffect(() => {
    if (transactionCurrency && baseCurrency && exchangeRates.length > 0 && !editingId) {
      setTransactionExchangeRate(getExchangeRate(transactionCurrency, baseCurrency));
    }
  }, [transactionCurrency, baseCurrency, exchangeRates, editingId]);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reference, setReference] = useState('');

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [operationType, setOperationType] = useState<string>('achat_marchandises');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('caisse');
  const [amountHT, setAmountHT] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(18);
  
  // Custom Op Form State
  const [newOpLabel, setNewOpLabel] = useState('');
  const [newOpErrors, setNewOpErrors] = useState<Record<string, string>>({});
  const [newOpIcon, setNewOpIcon] = useState('✨');
  const [newOpVatDebit, setNewOpVatDebit] = useState('');
  const [newOpVatCredit, setNewOpVatCredit] = useState('');
  const [newOpTemplate, setNewOpTemplate] = useState<CustomOperationTemplate[]>([
    { account_code: '', type: 'debit', formula: 'ht' }
  ]);
  const [accounts, setAccounts] = useState<{code: string, name: string}[]>([]);
  const [thirdParties, setThirdParties] = useState<{id: number, name: string, type: string, account_code: string, is_occasional?: boolean}[]>([]);
  const [defaultOccasional, setDefaultOccasional] = useState<{ client: any | null, supplier: any | null }>({ client: null, supplier: null });
  const [selectedThirdParty, setSelectedThirdParty] = useState<string>(''); // account_code
  const [occasionalName, setOccasionalName] = useState('');
  const [selectedTreasuryAccount, setSelectedTreasuryAccount] = useState<string>('');
  const [suggestedAccounts, setSuggestedAccounts] = useState<{account_code: string, account_name: string, count: number}[]>([]);

  // Expert Mode Entries
  const [entries, setEntries] = useState<JournalEntryLine[]>([
    { account_code: '', debit: 0, credit: 0 },
    { account_code: '', debit: 0, credit: 0 }
  ]);

  useEffect(() => {
    if (selectedThirdParty) {
      const party = thirdParties.find(p => p.account_code === selectedThirdParty);
      if (party) {
        fetch(`/api/journal/suggestions?thirdPartyId=${party.id}&operationType=${operationType}`)
          .then(res => res.json())
          .then(data => setSuggestedAccounts(data))
          .catch(err => console.error(err));
      }
    } else {
      setSuggestedAccounts([]);
    }
  }, [selectedThirdParty, operationType, thirdParties]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTransactions();
    fetchCustomOperations();
    fetchAccounts();
    fetchThirdParties();
    fetchDefaultOccasional();
    fetchCompanySettings();
  }, [startDate, endDate, statusFilter, searchTerm, thirdPartyFilter, accountFilter, minAmount, maxAmount]);

  const fetchDefaultOccasional = async () => {
    try {
      const res = await fetch('/api/third-parties/defaults');
      if (res.ok) {
        const data = await res.json();
        setDefaultOccasional(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const [settingsRes, vatRes] = await Promise.all([
        fetch('/api/company/settings'),
        fetch('/api/vat-settings')
      ]);
      const settings = await settingsRes.json();
      const vatSettings = await vatRes.json();
      setCompanySettings({ ...settings, vat_settings: vatSettings });
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  useEffect(() => {
    if (mode === 'guided') {
      const calculated = calculateEntries(
        operationType,
        amountHT,
        vatRate,
        paymentMode,
        customOperations,
        selectedThirdParty,
        companySettings?.vat_settings || [], // vatSettings
        selectedTreasuryAccount,
        companySettings
      );
      setEntries(calculated);
    }
  }, [mode, operationType, amountHT, vatRate, paymentMode, customOperations, selectedThirdParty, selectedTreasuryAccount]);

  useEffect(() => {
    setSelectedThirdParty('');
  }, [operationType]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchThirdParties = async () => {
    try {
      const res = await fetch('/api/third-parties');
      const data = await res.json();
      setThirdParties(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ... (existing code)

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (thirdPartyFilter) params.append('thirdPartyId', thirdPartyFilter);
      if (accountFilter) params.append('accountCode', accountFilter);
      if (minAmount) params.append('minAmount', minAmount);
      if (maxAmount) params.append('maxAmount', maxAmount);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomOperations = async () => {
    try {
      const res = await fetch('/api/custom-operations');
      const data = await res.json();
      setCustomOperations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const validateCustomOp = () => {
    const errors: Record<string, string> = {};
    if (!newOpLabel.trim()) errors.label = "Le nom est obligatoire";
    if (newOpTemplate.length === 0) errors.template = "Le schéma doit avoir au moins une ligne";
    
    newOpTemplate.forEach((line, idx) => {
      if (!line.account_code) errors[`tpl_account_${idx}`] = "Compte requis";
    });

    setNewOpErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateCustomOp = async () => {
    if (!validateCustomOp()) return;
    
    try {
      const res = await fetch('/api/custom-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newOpLabel,
          icon: newOpIcon,
          vat_account_debit: newOpVatDebit,
          vat_account_credit: newOpVatCredit,
          entries_template: newOpTemplate
        })
      });
      
      if (res.ok) {
        setIsCustomOpModalOpen(false);
        fetchCustomOperations();
        // Reset form
        setNewOpLabel('');
        setNewOpIcon('✨');
        setNewOpVatDebit('');
        setNewOpVatCredit('');
        setNewOpTemplate([{ account_code: '', type: 'debit', formula: 'ht' }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInvoiceFromTransaction = async (id: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.invoice_number) {
        const proceed = await confirm(`Cette transaction est déjà liée à la facture ${data.invoice_number}. Voulez-vous quand même créer une nouvelle facture ?`);
        if (!proceed) return;
      }

      // Check if it's a sale (has 7xx accounts)
      const saleEntries = data.entries.filter((e: any) => e.account_code.startsWith('7'));
      const isSale = saleEntries.length > 0;
      
      if (!isSale) {
        const proceed = await confirm("Cette transaction ne semble pas être une vente (pas de compte de classe 7). Voulez-vous quand même créer une facture ?");
        if (!proceed) return;
      }

      // Prepare quick invoice data
      const clientEntry = data.entries.find((e: any) => e.account_code.startsWith('411'));
      let tp = null;
      if (data.third_party_id) {
        tp = thirdParties.find(p => p.id === data.third_party_id);
      } else if (clientEntry) {
        tp = thirdParties.find(p => p.account_code === clientEntry.account_code);
      }

      // VAT detection
      const vatEntry = data.entries.find((e: any) => e.account_code.startsWith('443'));
      let detectedVatRate = 18;
      if (vatEntry && saleEntries.length > 0) {
        const vatAmount = Math.abs(vatEntry.credit - vatEntry.debit);
        const htAmount = Math.abs(saleEntries.reduce((acc: number, e: any) => acc + (e.credit - e.debit), 0));
        if (htAmount > 0) {
          const rawRate = (vatAmount / htAmount) * 100;
          const commonRates = [0, 2, 5, 10, 18];
          detectedVatRate = commonRates.reduce((prev, curr) => 
            Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
          );
        }
      }

      const items = saleEntries.length > 0 ? saleEntries.map((e: any) => ({
        description: e.description || data.description,
        quantity: 1,
        unit_price: Math.abs(e.credit - e.debit),
        vat_rate: detectedVatRate,
        account_code: e.account_code
      })) : [{
        description: data.description,
        quantity: 1,
        unit_price: data.total_amount,
        vat_rate: detectedVatRate,
        account_code: '701'
      }];

      setQuickInvoiceData({
        transaction: data,
        thirdParty: tp,
        items,
        total: items.reduce((acc, i) => acc + (i.quantity * i.unit_price * (1 + i.vat_rate/100)), 0)
      });
      setIsQuickInvoiceOpen(true);

    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la préparation de la facture");
    }
  };

  const handleConfirmQuickInvoice = async () => {
    if (!quickInvoiceData) return;
    
    if (!quickInvoiceData.thirdParty) {
      dialogAlert("Impossible de créer la facture : aucun client détecté. Veuillez utiliser l'éditeur complet.", 'error');
      navigate('/invoices', { state: { prefill: quickInvoiceData.transaction } });
      setIsQuickInvoiceOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice',
          date: quickInvoiceData.transaction.date,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          third_party_id: quickInvoiceData.thirdParty.id,
          occasional_name: quickInvoiceData.transaction.occasional_name,
          notes: quickInvoiceData.transaction.notes,
          items: quickInvoiceData.items,
          currency: quickInvoiceData.transaction.currency || 'FCFA',
          exchange_rate: quickInvoiceData.transaction.exchange_rate || 1,
          transaction_id: quickInvoiceData.transaction.id
        })
      });

      if (res.ok) {
        setIsQuickInvoiceOpen(false);
        fetchTransactions();
        dialogAlert("Facture générée avec succès !");
      } else {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la génération");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la génération", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShowDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      const data = await res.json();
      setSelectedTransactionDetail(data);
      setIsDetailOpen(true);
    } catch (err) {
      console.error("Failed to fetch transaction details", err);
      alert("Erreur lors du chargement des détails");
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setReference(data.reference ? `${data.reference}-COPY` : generateReference());
      setDescription(`${data.description} (Copie)`);
      setNotes(data.notes || '');
      
      // Parse document URLs if they are stored as JSON array
      let urls: string[] = [];
      if (data.document_url) {
        try {
          const parsed = JSON.parse(data.document_url);
          if (Array.isArray(parsed)) {
            urls = parsed;
          } else {
            urls = [data.document_url];
          }
        } catch (e) {
          urls = [data.document_url];
        }
      }
      setDocumentUrls(urls);
      
      setEntries(data.entries.map((e: any) => ({ 
        account_code: e.account_code,
        debit: e.debit,
        credit: e.credit
      })));
      setMode('expert');
      setIsModalOpen(true);
    } catch (err) {
      console.error("Failed to duplicate transaction", err);
      dialogAlert("Erreur lors de la duplication", 'error');
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/transactions/${id}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setEditingId(id);
      setDate(data.date);
      setReference(data.reference || '');
      setDescription(data.description);
      setNotes(data.notes || '');
      
      // Parse document URLs if they are stored as JSON array
      let urls: string[] = [];
      if (data.document_url) {
        try {
          const parsed = JSON.parse(data.document_url);
          if (Array.isArray(parsed)) {
            urls = parsed;
          } else {
            urls = [data.document_url];
          }
        } catch (e) {
          urls = [data.document_url];
        }
      }
      setDocumentUrls(urls);
      
      setEntries(data.entries);
      setTransactionCurrency(data.currency || 'FCFA');
      setTransactionExchangeRate(data.exchange_rate || 1);
      
      // Try to restore third party
      if (data.third_party_id) {
        const party = thirdParties.find(p => p.id === data.third_party_id);
        if (party) {
          setSelectedThirdParty(party.account_code);
          if (party.is_occasional) {
            setOccasionalName(data.occasional_name || '');
          }
        }
      } else {
        setSelectedThirdParty('');
        setOccasionalName('');
      }

      setMode('expert'); // Default to expert mode for editing as we don't store the guided params
      setIsModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch transaction details", err);
      dialogAlert("Erreur lors du chargement de la transaction", 'error');
    }
  };

  const [scanType, setScanType] = useState<'vente' | 'achat' | null>(null);

  const handleScanButtonClick = async () => {
    const isSale = await confirm("S'agit-il d'une VENTE ? (Cliquez sur 'Confirmer' pour VENTE, 'Annuler' pour un ACHAT)");
    setScanType(isSale ? 'vente' : 'achat');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scanType) return;

    setAnalyzing(true);
    setIsModalOpen(true);
    setMode('guided');
    setEditingId(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const newUrl = `data:${file.type};base64,${base64}`;
      setDocumentUrls(prev => [...prev, newUrl]);
      
      try {
        const data = await analyzeInvoice(base64, scanType, companySettings?.vat_settings || []);
        
        if (!data) throw new Error("L'analyse IA a échoué");

        setDate(data.date || new Date().toISOString().split('T')[0]);
        setDescription(data.description || "Opération importée");
        
        const ht = data.amount_ht || (data.amount_ttc ? data.amount_ttc / 1.18 : 0);
        setAmountHT(Math.round(ht));
        
        // VAT Rate detection
        if (data.vat_rate !== undefined) {
          setVatRate(data.vat_rate);
        } else if (data.amount_tva > 0 && ht > 0) {
          const rawRate = (data.amount_tva / ht) * 100;
          const commonRates = [0, 2, 5, 10, 18];
          const closest = commonRates.reduce((prev, curr) => 
            Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
          );
          setVatRate(closest);
        }

        // Third Party detection
        if (data.third_party) {
          const match = thirdParties.find(tp => 
            tp.name.toLowerCase().includes(data.third_party.toLowerCase()) || 
            data.third_party.toLowerCase().includes(tp.name.toLowerCase())
          );
          
          if (match) {
            setSelectedThirdParty(match.account_code);
          } else {
            setOccasionalName(data.third_party);
            const def = scanType === 'vente' ? defaultOccasional.client : defaultOccasional.supplier;
            if (def) {
              setSelectedThirdParty(def.account_code);
            }
          }
        }

        // Operation Type
        if (data.operation_type && DEFAULT_OPERATION_TYPES.some(t => t.id === data.operation_type)) {
          setOperationType(data.operation_type);
        } else {
          setOperationType(scanType === 'vente' ? 'vente_marchandises' : 'achat_marchandises');
        }

      } catch (err: any) {
        console.error("AI Analysis failed", err);
        dialogAlert(`Erreur lors de l'analyse : ${err.message || 'Veuillez saisir manuellement.'}`, 'error');
      } finally {
        setAnalyzing(false);
        // Reset scan type for next time
        setScanType(null);
        // Clear file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAISuggestion = async () => {
    if (!description || !amountHT) {
      alert("Veuillez saisir un libellé et un montant pour obtenir une suggestion.");
      return;
    }

    setSuggesting(true);
    setAiSuggestion(null);
    try {
      const thirdParty = thirdParties.find(tp => tp.account_code === selectedThirdParty);
      const suggestion = await suggestJournalEntry(
        description, 
        amountHT, 
        accounts, 
        operationType, 
        paymentMode, 
        thirdParty, 
        vatRate,
        occasionalName
      );
      if (suggestion && suggestion.entries.length > 0) {
        setAiSuggestion(suggestion);
      } else {
        alert("L'IA n'a pas pu générer de suggestion pertinente.");
      }
    } catch (err) {
      console.error("AI Suggestion failed", err);
      alert("Erreur lors de la suggestion IA.");
    } finally {
      setSuggesting(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    setEntries(aiSuggestion.entries.map(e => ({
      account_code: e.account_code,
      debit: e.debit,
      credit: e.credit
    })));
    setMode('expert');
    setAiSuggestion(null);
  };

  const handleCurrencyChange = (newCurrency: string) => {
    if (transactionCurrency === newCurrency) return;

    const rateFrom = getExchangeRate(transactionCurrency, baseCurrency);
    const rateTo = getExchangeRate(newCurrency, baseCurrency);
    const conversionFactor = rateFrom / rateTo;

    if (mode === 'guided') {
      if (amountHT > 0) {
        setAmountHT(prev => Math.round(prev * conversionFactor * 100) / 100);
      }
    } else {
      setEntries(prev => prev.map(entry => ({
        ...entry,
        debit: Math.round(entry.debit * conversionFactor * 100) / 100,
        credit: Math.round(entry.credit * conversionFactor * 100) / 100
      })));
    }

    setTransactionCurrency(newCurrency);
  };

  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!description.trim()) {
      newErrors.description = "Le libellé est obligatoire";
    }
    
    if (mode === 'guided') {
      if (amountHT <= 0) {
        newErrors.amountHT = "Le montant doit être supérieur à 0";
      }
    } else {
      // Expert mode validation
      const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
      const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        newErrors.balance = `Écriture déséquilibrée (Diff: ${Math.abs(totalDebit - totalCredit).toFixed(2)})`;
      }
      
      entries.forEach((entry, idx) => {
        if (!entry.account_code) {
          newErrors[`account_${idx}`] = "Compte requis";
        } else if (!/^\d+$/.test(entry.account_code)) {
          newErrors[`account_${idx}`] = "Code numérique requis";
        }
        
        if (Number(entry.debit) < 0 || Number(entry.credit) < 0) {
          newErrors[`amount_${idx}`] = "Montant négatif interdit";
        }
      });
    }
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      newErrors.date = "La date ne peut pas être dans le futur";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBalance = () => {
    const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const diff = totalDebit - totalCredit;

    if (Math.abs(diff) < 0.01) return;

    const newEntries = [...entries];
    const lastEntry = newEntries[newEntries.length - 1];

    if (diff > 0) {
      // More debit than credit, add to credit of the last entry
      lastEntry.credit = Number((lastEntry.credit + diff).toFixed(2));
    } else {
      // More credit than debit, add to debit of the last entry
      lastEntry.debit = Number((lastEntry.debit + Math.abs(diff)).toFixed(2));
    }

    setEntries(newEntries);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const url = editingId ? `/api/transactions/${editingId}` : '/api/transactions';
      const method = editingId ? 'PUT' : 'POST';

      // Find third party ID if selected
      const party = thirdParties.find(p => p.account_code === selectedThirdParty);
      const thirdPartyId = party ? party.id : null;

      const entriesToSave = mode === 'guided' 
        ? calculateEntries(
            operationType, 
            amountHT * transactionExchangeRate, 
            vatRate, 
            paymentMode, 
            customOperations, 
            selectedThirdParty,
            companySettings?.vat_settings,
            selectedTreasuryAccount,
            companySettings
          )
        : entries;

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date, 
          description, 
          reference,
          entries: entriesToSave,
          third_party_id: thirdPartyId,
          occasional_name: party?.is_occasional ? occasionalName : null,
          currency: transactionCurrency,
          exchange_rate: transactionExchangeRate,
          notes,
          document_url: JSON.stringify(documentUrls)
        })
      });
      
      const data = await res.json();

      if (res.ok) {
        handleModalClose();
        fetchTransactions();
        // Reset
        setDescription('');
        setAmountHT(0);
        setEntries([]);
        setEditingId(null);
        setSelectedThirdParty('');
      } else {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setReference(generateReference());
    setDescription('');
    setAmountHT(0);
    setEntries([{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
    setMode('guided');
    setSelectedThirdParty('');
    setOccasionalName('');
    setSelectedTreasuryAccount('');
    setIsModalOpen(true);
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/journal/export?${params.toString()}`);
      const data: DetailedTransaction[] = await res.json();

      const excelData = data.flatMap(tx => tx.entries.map(entry => ({
        Date: tx.date,
        Référence: tx.reference || '',
        Compte: entry.account_code,
        Libellé: tx.description,
        Débit: entry.debit,
        Crédit: entry.credit
      })));

      const utils = await import('../lib/exportUtils');
      utils.exportToExcel(excelData, `Journal_${new Date().toISOString().split('T')[0]}`, 'JOURNAL');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export Excel");
    }
  };

  const handleExportPDF = async () => {
    try {
      // Fetch detailed data for export
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/journal/export?${params.toString()}`);
      const data: DetailedTransaction[] = await res.json();

      // --- VALIDATION AVANT EXPORT ---
      let totalDebitGlobal = 0;
      let totalCreditGlobal = 0;

      data.forEach(tx => {
        tx.entries.forEach(entry => {
          totalDebitGlobal += Number(entry.debit);
          totalCreditGlobal += Number(entry.credit);
        });
      });

      // --- GÉNÉRATION PDF ---
      const doc = new jsPDF();
      const settings = companySettings || { name: PDF_CONFIG.companyName };
      const subtitle = (startDate || endDate) 
        ? `Période : ${startDate || 'Début'} au ${endDate || 'Fin'}`
        : "Toute la période";

      const nextY = addPDFHeader(doc, settings, "JOURNAL GÉNÉRAL", subtitle);
      
      const tableBody: any[] = [];

      // 2. Données réelles
      data.forEach(tx => {
        tx.entries.forEach(entry => {
          tableBody.push([
            tx.date,
            sanitizeText(tx.reference || ''),
            entry.account_code,
            sanitizeText(tx.description),
            formatCurrencyPDF(Number(entry.debit)),
            formatCurrencyPDF(Number(entry.credit))
          ]);
        });
      });

      // 3. Totaux
      tableBody.push([
        { content: 'TOTAUX', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right', fillColor: [241, 245, 249] } },
        { content: formatCurrencyPDF(totalDebitGlobal), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatCurrencyPDF(totalCreditGlobal), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
      ]);

      autoTable(doc, {
        startY: nextY,
        head: [['Date', 'Ref', 'Compte', 'Libellé', 'Débit', 'Crédit']],
        body: tableBody,
        theme: 'grid',
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: PDF_CONFIG.colors.primary as [number, number, number],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
        },
      });

      const utils = await import('../lib/exportUtils');
      const finalY = (doc as any).lastAutoTable?.finalY || nextY + 20;
      utils.addPDFSignature(doc, finalY + 20);
      addPDFFooter(doc);
      doc.save(`Journal_General_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (err) {
      console.error("Export failed", err);
      alert("Erreur technique lors de l'export PDF");
    }
  };

  const allOperationTypes = [
    ...DEFAULT_OPERATION_TYPES,
    ...customOperations.map(op => ({
      id: `custom_${op.id}`,
      label: op.label,
      icon: op.icon
    }))
  ];

  const getFormConfig = (type: string) => {
    // Custom operations
    if (type.startsWith('custom_')) {
       const customOpId = parseInt(type.split('_')[1]);
       const customOp = customOperations.find(op => op.id === customOpId);
       const hasVAT = customOp?.entries_template.some(t => t.formula === 'tva') ?? false;
       // Heuristic: if it uses PAYMENT or THIRD_PARTY, it likely needs payment mode
       const hasPayment = customOp?.entries_template.some(t => t.account_code === 'PAYMENT' || t.account_code === 'THIRD_PARTY') ?? true;
       return {
         hasVAT,
         hasPayment,
         amountLabel: hasVAT ? 'Montant HT' : 'Montant'
       };
    }

    // Standard operations
    switch (type) {
      case 'vente_marchandises':
      case 'vente_services':
      case 'achat_marchandises':
      case 'achat_services':
      case 'frais_generaux':
        return { hasVAT: true, hasPayment: true, amountLabel: 'Montant HT' };
      
      case 'charges_a_payer':
        return { hasVAT: true, hasPayment: false, amountLabel: 'Montant HT' };
      
      case 'amortissement':
      case 'charges_constatees_avance':
      case 'produits_constates_avance':
        return { hasVAT: false, hasPayment: false, amountLabel: 'Montant' };
        
      case 'paiement_salaire':
        return { hasVAT: false, hasPayment: true, amountLabel: 'Salaire Net' };

      case 'paiement_impot':
        return { hasVAT: false, hasPayment: true, amountLabel: 'Montant Impôt' };
        
      case 'retrait_banque':
      case 'depot_banque':
      case 'pret_bancaire':
      case 'encaissement_client':
      case 'paiement_fournisseur':
        return { hasVAT: false, hasPayment: true, amountLabel: 'Montant' };
        
      default:
        return { hasVAT: true, hasPayment: true, amountLabel: 'Montant' };
    }
  };

  const formConfig = getFormConfig(operationType);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        fetchTransactions();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la suppression", 'error');
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await fetch('/api/transactions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      
      if (res.ok) {
        fetchTransactions();
        setSelectedIds([]);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la suppression", 'error');
    }
  };

  const amountTTC = amountHT * (1 + vatRate / 100);
  const isBalanced = Math.abs(entries.reduce((acc, e) => acc + (Number(e.debit) - Number(e.credit)), 0)) < 0.01;
  const saving = submitting;
  const handleSave = handleSubmit;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight font-display mb-2">Journal Intelligent</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Saisie simplifiée & conforme SYSCOHADA</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm animate-in fade-in zoom-in duration-200"
            >
              <Trash2 size={18} />
              Supprimer ({selectedIds.length})
            </button>
          )}
          <div className="flex bg-white dark:bg-slate-900 rounded-2xl p-1 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button 
              onClick={handleExportExcel}
              className="hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 p-3 rounded-xl transition-colors"
              title="Exporter en Excel"
            >
              <FileSpreadsheet size={20} className="text-brand-green" />
            </button>
            <div className="w-px bg-slate-100 dark:bg-slate-800 my-2" />
            <button 
              onClick={handleExportPDF}
              className="hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 p-3 rounded-xl transition-colors"
              title="Exporter en PDF Détaillé"
            >
              <Download size={20} />
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
          <button 
            onClick={handleScanButtonClick}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Wand2 size={20} className="text-brand-gold" />
            <span>Scanner</span>
          </button>
          <button 
            onClick={openNewModal}
            className="bg-brand-green text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20"
          >
            <Plus size={20} />
            Saisie Manuelle
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="premium-card p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-l-4 border-l-brand-green">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-green/10 text-brand-green rounded-xl">
              <Calculator size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Débit (Période)</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-display">
                {formatCurrency(transactions.reduce((acc, tx) => acc + tx.total_amount, 0), baseCurrency)}
              </p>
            </div>
          </div>
        </div>
        <div className="premium-card p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-l-4 border-l-brand-gold">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre d'opérations</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-display">{transactions.length}</p>
            </div>
          </div>
        </div>
        <div className="premium-card p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-l-4 border-l-purple-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Zap size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernière opération</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {transactions[0]?.description || 'Aucune'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">{transactions[0]?.date || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="premium-card p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6">
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Filter size={18} className="text-slate-400" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Filtres</span>
          </div>
          {(startDate || endDate || statusFilter !== 'all' || searchTerm || thirdPartyFilter || accountFilter || minAmount || maxAmount) && (
            <button 
              onClick={() => { 
                setStartDate(''); 
                setEndDate(''); 
                setStatusFilter('all'); 
                setSearchTerm(''); 
                setQuickFilter('all');
                setThirdPartyFilter('');
                setAccountFilter('');
                setMinAmount('');
                setMaxAmount('');
              }}
              className="lg:hidden text-[10px] font-black text-rose-500 uppercase tracking-widest"
            >
              Réinitialiser
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row items-stretch lg:items-center gap-4 flex-1">
          <div className="relative col-span-1 sm:col-span-2 lg:flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Filter size={16} />
            </div>
            <input 
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none transition-all"
            />
          </div>

          <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                setStartDate(today);
                setEndDate(today);
                setQuickFilter('today');
              }}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                quickFilter === 'today' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              Aujourd'hui
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                const first = now.getDate() - now.getDay();
                const firstDay = new Date(now.setDate(first)).toISOString().split('T')[0];
                const lastDay = new Date().toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
                setQuickFilter('week');
              }}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                quickFilter === 'week' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              Semaine
            </button>
            <button 
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const lastDay = new Date().toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
                setQuickFilter('month');
              }}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                quickFilter === 'month' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              Mois
            </button>
            <button 
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setQuickFilter('all');
              }}
              className={cn(
                "flex-1 min-w-[80px] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                quickFilter === 'all' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              Tout
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-bold focus:ring-0 text-slate-700 dark:text-slate-300 px-2 w-full"
            />
            <ArrowRight size={12} className="text-slate-300 shrink-0" />
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-bold focus:ring-0 text-slate-700 dark:text-slate-300 px-2 w-full"
            />
          </div>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-brand-green/20 transition-all"
          >
            <option value="all">Tous les statuts</option>
            <option value="validated">Validés</option>
            <option value="draft">Brouillon</option>
          </select>

          <button 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
              showAdvancedFilters 
                ? "bg-brand-green/10 border-brand-green text-brand-green" 
                : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <Settings2 size={16} />
            <span className="hidden sm:inline">Filtres avancés</span>
          </button>
        </div>
        {(startDate || endDate || statusFilter !== 'all' || searchTerm || thirdPartyFilter || accountFilter || minAmount || maxAmount) && (
          <button 
            onClick={() => { 
              setStartDate(''); 
              setEndDate(''); 
              setStatusFilter('all'); 
              setSearchTerm(''); 
              setQuickFilter('all');
              setThirdPartyFilter('');
              setAccountFilter('');
              setMinAmount('');
              setMaxAmount('');
            }}
            className="hidden lg:block text-xs font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Advanced Filters Section */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="premium-card p-4 sm:p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiers</label>
                <select 
                  value={thirdPartyFilter}
                  onChange={(e) => setThirdPartyFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-brand-green/20 transition-all"
                >
                  <option value="">Tous les tiers</option>
                  {thirdParties.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compte</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Hash size={14} />
                  </div>
                  <input 
                    type="text"
                    placeholder="Code compte..."
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-green/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant Min</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-green/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant Max</label>
                <input 
                  type="number"
                  placeholder="999..."
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-green/20 outline-none transition-all"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction List */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 sm:px-6 py-5 w-10">
                  <input 
                    type="checkbox" 
                    checked={transactions.length > 0 && selectedIds.length === transactions.length}
                    onChange={toggleAll}
                    className="rounded-md border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green bg-white dark:bg-slate-800"
                  />
                </th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Date</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Libellé</th>
                <th className="hidden md:table-cell px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Référence</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Montant</th>
                <th className="hidden sm:table-cell px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Statut</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Chargement du journal...</p>
                      </div>
                    </td>
                  </motion.tr>
                ) : transactions.length === 0 ? (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-50">
                        <FileText size={48} className="text-slate-300" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Aucune écriture comptable trouvée</p>
                      </div>
                    </td>
                  </motion.tr>
                ) : (
                  transactions.map((tx) => (
                    <motion.tr 
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleShowDetail(tx.id)}
                      className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer", selectedIds.includes(tx.id) && "bg-brand-green/5 dark:bg-brand-green/10")}
                    >
                      <td className="px-4 sm:px-6 py-5" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(tx.id)}
                          onChange={() => toggleSelection(tx.id)}
                          className="rounded-md border-slate-300 dark:border-slate-700 text-brand-green focus:ring-brand-green bg-white dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{tx.date}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{tx.description}</span>
                          {tx.occasional_name && (
                            <span className="text-[9px] sm:text-[10px] font-black text-brand-green uppercase tracking-widest mt-0.5">
                              Tiers: {tx.occasional_name}
                            </span>
                          )}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {tx.invoice_number && (
                              <Link 
                                to={`/invoices?id=${tx.invoice_id}`}
                                className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-brand-gold uppercase tracking-widest hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText size={10} />
                                {tx.invoice_number}
                              </Link>
                            )}
                            <span className="md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {tx.reference}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 sm:px-6 py-5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{tx.reference || '-'}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-right">
                        <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 font-display">
                          {formatCurrency(tx.total_amount, tx.currency)}
                        </div>
                        {tx.currency && tx.currency !== baseCurrency && (
                          <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                            ≈ {formatCurrency(tx.total_amount * (tx.exchange_rate || 1), baseCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 sm:px-6 py-5 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          tx.status === 'draft' 
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700" 
                            : "bg-brand-green/10 dark:bg-brand-green/20 text-brand-green dark:text-brand-green-light border border-brand-green/20 dark:border-brand-green/30 shadow-sm"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", tx.status === 'draft' ? "bg-slate-400" : "bg-brand-green")} />
                          {tx.status === 'draft' ? 'Brouillon' : 'Validé'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <button 
                            onClick={() => handleEdit(tx.id)}
                            className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green-light hover:bg-brand-green/10 dark:hover:bg-brand-green/20 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={14} className="sm:w-4 sm:h-4" />
                          </button>
                          <button 
                            onClick={() => handleDuplicate(tx.id)}
                            className="hidden sm:block p-2 text-slate-400 dark:text-slate-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="Dupliquer"
                          >
                            <FilePlus size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Saisie */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white/95 dark:bg-slate-900/95 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col md:flex-row border border-white/20 dark:border-slate-800 transition-all duration-500">
            
            {/* Left Panel: Inputs */}
            <div className="flex-1 p-5 sm:p-10 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 sm:p-4 bg-brand-green/10 text-brand-green rounded-2xl">
                    {analyzing ? <Loader2 className="animate-spin" size={24} /> : editingId ? <Pencil size={24} /> : <Calculator size={24} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                      {analyzing ? "Analyse IA..." : editingId ? "Modifier l'écriture" : "Saisie Intelligente"}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conformité SYSCOHADA</p>
                  </div>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setMode('guided')}
                    disabled={!!editingId}
                    className={cn(
                      "px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all", 
                      mode === 'guided' ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400", 
                      editingId && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Guidé
                  </button>
                  <button 
                    onClick={() => setMode('expert')}
                    className={cn(
                      "px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all", 
                      mode === 'expert' ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    Expert
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                {/* Common Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date d'opération</label>
                    <input 
                      type="date" 
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                      }}
                      className={cn(
                        "w-full px-5 py-3.5 rounded-2xl border focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all outline-none font-bold",
                        errors.date ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                      )}
                    />
                    {errors.date && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 font-bold uppercase tracking-tight">{errors.date}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Générée auto..."
                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold"
                      />
                      <button 
                        type="button"
                        onClick={() => setReference(generateReference())}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-brand-green transition-colors"
                        title="Régénérer"
                      >
                        <Zap size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Devise & Change</label>
                    <div className="flex gap-3">
                      <select 
                        value={transactionCurrency}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        className="flex-1 px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-black"
                      >
                        <option value="FCFA">FCFA</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GNF">GNF</option>
                        <option value="CDF">CDF</option>
                      </select>
                      {transactionCurrency !== baseCurrency && (
                        <input 
                          type="number"
                          step="0.000001"
                          value={transactionExchangeRate}
                          onChange={(e) => setTransactionExchangeRate(parseFloat(e.target.value) || 1)}
                          className="w-32 px-4 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-mono font-bold text-center"
                          title={`1 ${transactionCurrency} = ? ${baseCurrency}`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé de l'opération</label>
                    <button 
                      onClick={handleAISuggestion}
                      disabled={suggesting || !description || !amountHT}
                      className="text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase tracking-widest hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                      Suggestion IA
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                    }}
                    placeholder="Ex: Facture d'achat de marchandises..."
                    className={cn(
                      "w-full px-5 py-4 rounded-2xl border focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all outline-none font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600",
                      errors.description ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                    )}
                  />
                  {errors.description && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 font-bold uppercase tracking-tight">{errors.description}</p>}
                </div>

                {/* AI Suggestion Feedback */}
                {aiSuggestion && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 rounded-3xl p-6 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                          <Wand2 size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-purple-900 dark:text-purple-100 tracking-tight">Suggestion de l'IA</div>
                          <div className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Confiance: {Math.round(aiSuggestion.confidence * 100)}%</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-purple-600/80 dark:text-purple-400/80 italic font-medium leading-relaxed">"{aiSuggestion.explanation}"</p>
                    
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl p-4 border border-purple-100/50 dark:border-purple-900/20 shadow-sm">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-purple-50 dark:border-purple-900/10">
                            <th className="text-left py-2">Compte</th>
                            <th className="text-right py-2">Débit</th>
                            <th className="text-right py-2">Crédit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50 dark:divide-purple-900/5">
                          {aiSuggestion.entries.map((e, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 font-mono font-bold text-slate-600 dark:text-slate-400">{e.account_code}</td>
                              <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                              <td className="py-2.5 text-right font-black text-slate-900 dark:text-white">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={applyAISuggestion}
                        className="flex-1 bg-purple-600 dark:bg-purple-700 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 dark:hover:bg-purple-600 transition-all shadow-lg shadow-purple-600/20"
                      >
                        Appliquer la suggestion
                      </button>
                      <button 
                        onClick={() => setAiSuggestion(null)}
                        className="px-6 py-3 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all"
                      >
                        Ignorer
                      </button>
                    </div>
                  </motion.div>
                )}

                {mode === 'guided' ? (
                  <>
                    {/* Operation Type Selection */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center ml-1">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Type d'opération</label>
                        <button 
                          onClick={() => setIsCustomOpModalOpen(true)}
                          className="text-[10px] text-brand-green dark:text-brand-green-light font-black uppercase tracking-widest hover:underline flex items-center gap-1.5"
                        >
                          <Settings size={12} /> Gérer les types
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {allOperationTypes.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => setOperationType(type.id)}
                            className={cn(
                              "flex items-center gap-4 px-5 py-4 rounded-2xl border text-sm font-bold transition-all text-left group",
                              operationType === type.id 
                                ? "border-brand-green bg-brand-green/5 dark:bg-brand-green/10 text-brand-green dark:text-brand-green-light ring-2 ring-brand-green/20" 
                                : "border-slate-100 dark:border-slate-800 hover:border-brand-green/30 dark:hover:border-brand-green/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                            )}
                          >
                            <span className={cn(
                              "text-2xl transition-transform group-hover:scale-110 duration-300",
                              operationType === type.id ? "grayscale-0" : "grayscale opacity-50"
                            )}>{type.icon}</span>
                            <span className="flex-1">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Third Party Selection */}
                    {(() => {
                      const type = ['vente_marchandises', 'vente_services', 'encaissement_client'].includes(operationType) ? 'client' :
                                   ['achat_marchandises', 'achat_services', 'frais_generaux', 'paiement_fournisseur', 'charges_a_payer'].includes(operationType) ? 'supplier' : null;
                      
                      if (type) {
                        const filteredParties = thirdParties.filter(p => p.type === type);
                        const selectedTP = thirdParties.find(p => p.account_code === selectedThirdParty);
                        
                        return (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {type === 'client' ? 'Client associé' : 'Fournisseur associé'}
                              </label>
                              <div className="flex gap-3">
                                <select
                                  value={selectedThirdParty}
                                  onChange={(e) => setSelectedThirdParty(e.target.value)}
                                  className="flex-1 px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold"
                                >
                                  <option value="">Sélectionner un {type === 'client' ? 'client' : 'fournisseur'}...</option>
                                  {filteredParties.map(p => (
                                    <option key={p.id} value={p.account_code}>
                                      {p.name} ({p.account_code}) {p.is_occasional ? '[Occas.]' : ''}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const def = type === 'client' ? defaultOccasional.client : defaultOccasional.supplier;
                                    if (def) {
                                      setSelectedThirdParty(def.account_code);
                                      setOccasionalName('');
                                    }
                                  }}
                                  className="px-5 py-3.5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2 border border-amber-200/30 dark:border-amber-700/30 shadow-sm"
                                  title="Utiliser le tiers occasionnel par défaut"
                                >
                                  <Zap size={14} /> Rapide
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const name = prompt(`Nom du nouveau ${type === 'client' ? 'client' : 'fournisseur'} occasionnel :`);
                                    if (name) {
                                      try {
                                        const res = await fetch('/api/third-parties', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            name,
                                            type,
                                            is_occasional: true
                                          })
                                        });
                                        const newTP = await res.json();
                                        if (res.ok) {
                                          await fetchThirdParties();
                                          setSelectedThirdParty(newTP.account_code);
                                          setOccasionalName(name);
                                        }
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }
                                  }}
                                  className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm"
                                  title="Créer un nouveau tiers occasionnel spécifique"
                                >
                                  <Plus size={14} /> Nouveau
                                </button>
                              </div>
                            </div>

                            {selectedTP?.is_occasional && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                              >
                                <label className="block text-[10px] font-black text-brand-green uppercase tracking-widest ml-1">
                                  Précision du nom (Occasionnel)
                                </label>
                                <input
                                  type="text"
                                  value={occasionalName}
                                  onChange={(e) => setOccasionalName(e.target.value)}
                                  placeholder="Ex: Client de passage, Nom spécifique..."
                                  className="w-full px-5 py-3.5 rounded-2xl border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold text-sm"
                                />
                              </motion.div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Financials */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className={cn(!formConfig.hasVAT && "col-span-2", "space-y-2")}>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{formConfig.amountLabel}</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={isNaN(amountHT) ? '' : amountHT}
                            onChange={(e) => {
                              setAmountHT(Number(e.target.value));
                              if (errors.amountHT) setErrors(prev => ({ ...prev, amountHT: '' }));
                            }}
                            className={cn(
                              "w-full pl-14 pr-5 py-4 rounded-2xl border focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white transition-all outline-none font-black text-lg",
                              errors.amountHT ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                            )}
                          />
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                            {transactionCurrency}
                          </div>
                        </div>
                        {transactionCurrency !== baseCurrency && amountHT > 0 && (
                          <div className="mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1">
                            ≈ {formatCurrency(amountHT * transactionExchangeRate, baseCurrency)}
                          </div>
                        )}
                        {errors.amountHT && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 font-bold uppercase tracking-tight">{errors.amountHT}</p>}
                      </div>
                      {formConfig.hasVAT && (
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TVA (%)</label>
                          <select 
                            value={vatRate}
                            onChange={(e) => setVatRate(Number(e.target.value))}
                            className="w-full px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-black text-lg"
                          >
                            <option value={18}>18% (Standard)</option>
                            <option value={10}>10% (Réduit)</option>
                            <option value={5}>5% (Super Réduit)</option>
                            <option value={2}>2% (Spécial)</option>
                            <option value={0}>0% (Exonéré)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Payment Mode */}
                    {formConfig.hasPayment && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mode de Règlement</label>
                          <div className="flex gap-2">
                            {(['caisse', 'banque', 'mobile_money', 'credit'] as PaymentMode[]).map((pm) => (
                              <button
                                key={pm}
                                onClick={() => {
                                  setPaymentMode(pm);
                                  setSelectedTreasuryAccount('');
                                }}
                                className={cn(
                                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                  paymentMode === pm
                                    ? "border-slate-900 dark:border-slate-600 bg-slate-900 dark:bg-slate-700 text-white shadow-lg shadow-slate-900/20"
                                    : "border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                )}
                              >
                                {pm.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {paymentMode !== 'credit' && (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Compte de Trésorerie (Optionnel)
                            </label>
                            <select
                              value={selectedTreasuryAccount}
                              onChange={(e) => setSelectedTreasuryAccount(e.target.value)}
                              className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold"
                            >
                              <option value="">Compte par défaut ({paymentMode === 'banque' ? (companySettings?.payment_bank_account || '521') : paymentMode === 'caisse' ? (companySettings?.payment_cash_account || '571') : (companySettings?.payment_mobile_account || '585')})</option>
                              {accounts
                                .filter(a => {
                                  if (paymentMode === 'banque') return a.code.startsWith('52');
                                  if (paymentMode === 'caisse') return a.code.startsWith('57');
                                  if (paymentMode === 'mobile_money') return a.code.startsWith('58');
                                  return a.code.startsWith('5');
                                })
                                .map(a => (
                                  <option key={a.code} value={a.code}>
                                    {a.code} - {a.name}
                                  </option>
                                ))
                              }
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes & Documents */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes & Observations</label>
                        <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ajoutez des détails supplémentaires sur cette opération..."
                          className="w-full px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-medium text-sm min-h-[100px] resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pièces Jointes</label>
                        <div className="space-y-3">
                          {documentUrls.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between px-5 py-4 rounded-2xl border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="text-brand-green shrink-0" size={20} />
                                <span className="text-xs font-bold text-brand-green truncate">Pièce #{idx + 1}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => window.open(url, '_blank')}
                                  className="p-2 text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                                  title="Voir le document"
                                >
                                  <ArrowRight size={16} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setDocumentUrls(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10 transition-all group"
                          >
                            <Upload className="text-slate-400 group-hover:text-brand-green transition-colors" size={20} />
                            <span className="text-xs font-bold text-slate-500 group-hover:text-brand-green transition-colors uppercase tracking-widest">Ajouter une pièce jointe</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Expert Mode Manual Entry */
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-all">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Écritures comptables (Expert)</p>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all",
                          isBalanced ? "bg-brand-green/10 text-brand-green" : "bg-rose-50 text-rose-500 animate-pulse"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", isBalanced ? "bg-brand-green" : "bg-rose-500")} />
                          {isBalanced ? 'Équilibré' : 'Déséquilibré'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleBalance}
                          disabled={isBalanced}
                          className="bg-white dark:bg-slate-800 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 border border-amber-200/30 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Équilibrer automatiquement l'écriture"
                        >
                          <Zap size={14} /> Équilibrer
                        </button>
                        <button 
                          onClick={() => setEntries([...entries, { account_code: '', debit: 0, credit: 0 }])}
                          className="bg-white dark:bg-slate-800 text-brand-green px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green hover:text-white transition-all flex items-center gap-2 border border-brand-green/20 shadow-sm"
                        >
                          <Plus size={14} /> Ligne
                        </button>
                      </div>
                    </div>
                    
                    {errors.balance && (
                      <div className="mb-6 p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-2xl text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest text-center">
                        {errors.balance}
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {entries.map((entry, idx) => (
                        <div key={idx} className="space-y-1 mb-3">
                          <div className="flex gap-3 items-center group">
                            <input 
                              placeholder="Cpt" 
                              list="expert-account-list"
                              className={cn(
                                "w-24 px-3 py-2.5 rounded-xl border text-sm font-mono font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green",
                                errors[`account_${idx}`] ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                              )}
                              value={entry.account_code}
                              onChange={(e) => {
                                const newEntries = [...entries];
                                newEntries[idx].account_code = e.target.value;
                                setEntries(newEntries);
                                if (errors[`account_${idx}`]) setErrors(prev => {
                                  const next = { ...prev };
                                  delete next[`account_${idx}`];
                                  return next;
                                });
                              }}
                            />
                            <input 
                              placeholder="Débit" 
                              type="number"
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green text-right",
                                errors[`amount_${idx}`] ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                              )}
                              value={isNaN(entry.debit) ? '' : entry.debit}
                              onChange={(e) => {
                                const newEntries = [...entries];
                                newEntries[idx].debit = Number(e.target.value);
                                setEntries(newEntries);
                                if (errors.balance) setErrors(prev => ({ ...prev, balance: '' }));
                              }}
                            />
                            <input 
                              placeholder="Crédit" 
                              type="number"
                              className={cn(
                                "flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green text-right",
                                errors[`amount_${idx}`] ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800"
                              )}
                              value={isNaN(entry.credit) ? '' : entry.credit}
                              onChange={(e) => {
                                const newEntries = [...entries];
                                newEntries[idx].credit = Number(e.target.value);
                                setEntries(newEntries);
                                if (errors.balance) setErrors(prev => ({ ...prev, balance: '' }));
                              }}
                            />
                            <button 
                              onClick={() => {
                                if (entries.length > 2) {
                                  setEntries(entries.filter((_, i) => i !== idx));
                                } else {
                                  dialogAlert("Une écriture doit avoir au moins 2 lignes.", 'info');
                                }
                              }}
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors md:opacity-0 md:group-hover:opacity-100"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {errors[`account_${idx}`] && <p className="text-[9px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-tight ml-1">{errors[`account_${idx}`]}</p>}
                          {accounts.find(a => a.code === entry.account_code) && (
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 ml-1 truncate italic font-medium">
                              {accounts.find(a => a.code === entry.account_code)?.name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <datalist id="expert-account-list">
                      {accounts.map(acc => (
                        <option key={acc.code} value={acc.code}>{acc.name}</option>
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Summary & Preview */}
            <div className="w-full md:w-96 bg-slate-50 dark:bg-slate-800/30 p-6 sm:p-10 flex flex-col">
              <div className="flex-1 space-y-10">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Résumé financier</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-500">Montant HT</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white font-display">
                        {formatCurrency(amountHT, transactionCurrency)}
                      </span>
                    </div>
                    {formConfig.hasVAT && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">TVA ({vatRate}%)</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(amountHT * (vatRate / 100), transactionCurrency)}
                        </span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Total TTC</span>
                        <span className="text-2xl font-black text-brand-green font-display">
                          {formatCurrency(amountTTC, transactionCurrency)}
                        </span>
                      </div>
                      {transactionCurrency !== baseCurrency && (
                        <div className="text-right mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            ≈ {formatCurrency(amountTTC * transactionExchangeRate, baseCurrency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Aperçu comptable</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">
                      <span>Compte</span>
                      <div className="flex justify-between">
                        <span>Débit</span>
                        <span>Crédit</span>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {entries.map((e, i) => (
                        <div key={i} className="grid grid-cols-2 gap-4 text-xs">
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{e.account_code || '---'}</span>
                          <div className="flex justify-between font-black text-slate-900 dark:text-white">
                            <span>{e.debit > 0 ? formatCurrency(e.debit, transactionCurrency) : ''}</span>
                            <span>{e.credit > 0 ? formatCurrency(e.credit, transactionCurrency) : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                        isBalanced ? "bg-brand-green/10 text-brand-green" : "bg-rose-50 text-rose-500"
                      )}>
                        {isBalanced ? 'Équilibré' : 'Déséquilibré'}
                      </span>
                      {!isBalanced && (
                        <span className="text-[10px] font-black text-rose-500">
                          Diff: {formatCurrency(Math.abs(entries.reduce((acc, e) => acc + (e.debit - e.credit), 0)), transactionCurrency)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 space-y-4">
                <button 
                  onClick={handleSave}
                  disabled={saving || !isBalanced}
                  className="w-full bg-brand-green text-white py-5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-xl shadow-brand-green/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                  {editingId ? "Enregistrer les modifications" : "Valider l'écriture"}
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-black uppercase tracking-widest transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Custom Operation Modal */}
      {isCustomOpModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nouveau Type d'Opération</h2>
              <button onClick={() => setIsCustomOpModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-16">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Icône</label>
                  <input 
                    value={newOpIcon}
                    onChange={(e) => setNewOpIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-xl focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Nom de l'opération</label>
                  <input 
                    value={newOpLabel}
                    onChange={(e) => {
                      setNewOpLabel(e.target.value);
                      if (newOpErrors.label) setNewOpErrors(prev => ({ ...prev, label: '' }));
                    }}
                    placeholder="Ex: Achat Fournitures"
                    className={cn(
                      "w-full px-3 py-2 rounded-xl border focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors",
                      newOpErrors.label ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" : "border-slate-200 dark:border-slate-700"
                    )}
                  />
                  {newOpErrors.label && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 font-medium">{newOpErrors.label}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Cpt. TVA Déductible</label>
                  <input 
                    list="vat-debit-list"
                    value={newOpVatDebit}
                    onChange={(e) => setNewOpVatDebit(e.target.value)}
                    placeholder="Ex: 445"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                  />
                  <datalist id="vat-debit-list">
                    {accounts.filter(a => a.code.startsWith('445')).map(a => (
                      <option key={a.code} value={a.code}>{a.name}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Cpt. TVA Collectée</label>
                  <input 
                    list="vat-credit-list"
                    value={newOpVatCredit}
                    onChange={(e) => setNewOpVatCredit(e.target.value)}
                    placeholder="Ex: 443"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                  />
                  <datalist id="vat-credit-list">
                    {accounts.filter(a => a.code.startsWith('443')).map(a => (
                      <option key={a.code} value={a.code}>{a.name}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Schéma Comptable</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {newOpTemplate.map((line, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors">
                        <input 
                          list="account-list"
                          placeholder="Compte" 
                          value={line.account_code}
                          onChange={(e) => {
                            const newTpl = [...newOpTemplate];
                            newTpl[idx].account_code = e.target.value;
                            setNewOpTemplate(newTpl);
                            if (newOpErrors[`tpl_account_${idx}`]) setNewOpErrors(prev => {
                              const next = { ...prev };
                              delete next[`tpl_account_${idx}`];
                              return next;
                            });
                          }}
                          className={cn(
                            "flex-1 px-2 py-1 rounded border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors",
                            newOpErrors[`tpl_account_${idx}`] ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" : "border-slate-200 dark:border-slate-700"
                          )}
                        />
                        <select
                          value={line.type}
                          onChange={(e) => {
                            const newTpl = [...newOpTemplate];
                            newTpl[idx].type = e.target.value as 'debit' | 'credit';
                            setNewOpTemplate(newTpl);
                          }}
                          className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                        >
                          <option value="debit">Débit</option>
                          <option value="credit">Crédit</option>
                        </select>
                        <select
                          value={line.formula}
                          onChange={(e) => {
                            const newTpl = [...newOpTemplate];
                            newTpl[idx].formula = e.target.value as 'ht' | 'tva' | 'ttc';
                            setNewOpTemplate(newTpl);
                          }}
                          className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                        >
                          <option value="ht">HT</option>
                          <option value="tva">TVA</option>
                          <option value="ttc">TTC</option>
                        </select>
                        <button 
                          onClick={() => setNewOpTemplate(newOpTemplate.filter((_, i) => i !== idx))}
                          className="text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {newOpErrors[`tpl_account_${idx}`] && <p className="text-[9px] text-rose-500 dark:text-rose-400 font-medium ml-1">{newOpErrors[`tpl_account_${idx}`]}</p>}
                    </div>
                  ))}
                  {newOpErrors.template && <p className="text-xs text-rose-500 dark:text-rose-400 font-medium text-center">{newOpErrors.template}</p>}
                </div>
                <datalist id="account-list">
                  <option value="PAYMENT">Compte de Trésorerie (selon mode)</option>
                  <option value="THIRD_PARTY">Compte Tiers (Client/Fournisseur)</option>
                  <option value="VAT_DEBIT">Compte TVA Déductible (Config)</option>
                  <option value="VAT_CREDIT">Compte TVA Collectée (Config)</option>
                  {accounts.map(acc => (
                    <option key={acc.code} value={acc.code}>{acc.name}</option>
                  ))}
                </datalist>
                <button 
                  onClick={() => setNewOpTemplate([...newOpTemplate, { account_code: '', type: 'debit', formula: 'ht' }])}
                  className="mt-2 text-xs text-brand-green dark:text-brand-green-light font-medium flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} /> Ajouter une ligne
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-400 transition-colors">
                <p>Utilisez <strong>PAYMENT</strong> pour la trésorerie, <strong>VAT_DEBIT/CREDIT</strong> pour la TVA.</p>
              </div>

              <button 
                onClick={handleCreateCustomOp}
                disabled={!newOpLabel}
                className="w-full bg-brand-green text-white py-3 rounded-xl font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green/90 transition-all mt-4 disabled:opacity-50"
              >
                Créer le type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Transaction View Modal */}
      {/* Detailed Transaction View Modal */}
      {isDetailOpen && selectedTransactionDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Détails de l'opération</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Réf: {selectedTransactionDetail.reference || 'N/A'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Summary Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedTransactionDetail.date}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedTransactionDetail.description}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Montant Total</span>
                  <span className="text-sm font-black text-brand-green">
                    {formatCurrency(selectedTransactionDetail.total_amount, selectedTransactionDetail.currency)}
                  </span>
                </div>
              </div>

              {/* Journal Entries */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                  Écritures Comptables
                </h3>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Compte</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Débit</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Crédit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {selectedTransactionDetail.entries?.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-brand-green">{entry.account_code}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{entry.account_name}</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white text-right">
                            {entry.debit > 0 ? formatCurrency(entry.debit, selectedTransactionDetail.currency) : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-900 dark:text-white text-right">
                            {entry.credit > 0 ? formatCurrency(entry.credit, selectedTransactionDetail.currency) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes & Documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                    Notes & Observations
                  </h3>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 min-h-[100px]">
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {selectedTransactionDetail.notes || "Aucune note pour cette opération."}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                    Pièces Jointes
                  </h3>
                  {(() => {
                    let urls: string[] = [];
                    if (selectedTransactionDetail.document_url) {
                      try {
                        const parsed = JSON.parse(selectedTransactionDetail.document_url);
                        if (Array.isArray(parsed)) {
                          urls = parsed;
                        } else {
                          urls = [selectedTransactionDetail.document_url];
                        }
                      } catch (e) {
                        urls = [selectedTransactionDetail.document_url];
                      }
                    }
                    
                    if (urls.length > 0) {
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {urls.map((url, idx) => (
                            <div key={idx} className="relative group">
                              <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center transition-all group-hover:border-brand-green/50">
                                {url.startsWith('data:image/') ? (
                                  <img 
                                    src={url} 
                                    alt={`Pièce #${idx + 1}`} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <FileText size={48} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Document #{idx + 1}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-3 bg-white text-slate-900 rounded-xl shadow-xl hover:scale-110 transition-transform"
                                  >
                                    <ExternalLink size={20} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    return (
                      <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50 dark:bg-slate-800/20">
                        <FileX size={32} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Aucune pièce jointe</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsDetailOpen(false);
                  handleCreateInvoiceFromTransaction(selectedTransactionDetail.id);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-brand-gold hover:bg-brand-gold/10 transition-all flex items-center gap-2 border border-brand-gold/20"
              >
                <FilePlus size={16} />
                Générer Facture
              </button>
              <button 
                onClick={() => {
                  setIsDetailOpen(false);
                  handleEdit(selectedTransactionDetail.id);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <Pencil size={16} />
                Modifier
              </button>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="px-8 py-2.5 bg-brand-green text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green/90 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Invoice Preview Modal */}
      {isQuickInvoiceOpen && quickInvoiceData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <Zap size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Génération Rapide</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Vérifiez les détails avant validation</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickInvoiceOpen(false)}
                className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Client Détecté</label>
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-black text-sm">
                      {quickInvoiceData.thirdParty?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{quickInvoiceData.thirdParty?.name || 'Client Inconnu'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{quickInvoiceData.thirdParty?.account_code || '---'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Date d'opération</label>
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{quickInvoiceData.transaction.date}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Échéance à 30 jours par défaut</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Articles de Facture</label>
                <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant HT</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">TVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {quickInvoiceData.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white">{item.description}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white text-right">{formatCurrency(item.unit_price, quickInvoiceData.transaction.currency)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400 text-right">{item.vat_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total TTC à facturer</p>
                  <p className="text-4xl font-black text-brand-green font-display">
                    {formatCurrency(quickInvoiceData.total, quickInvoiceData.transaction.currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex gap-4">
              <button 
                onClick={() => {
                  setIsQuickInvoiceOpen(false);
                  navigate('/invoices', { state: { prefill: quickInvoiceData.transaction } });
                }}
                className="flex-1 px-8 py-5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3"
              >
                <Edit size={18} />
                Éditeur Complet
              </button>
              <button 
                onClick={handleConfirmQuickInvoice}
                disabled={submitting}
                className="flex-[2] px-8 py-5 bg-brand-green text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-xl shadow-brand-green/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Confirmer la Génération
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal removed as it is now handled by DialogProvider */}
    </div>
  );
}
