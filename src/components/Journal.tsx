import { parseSafeJSON } from "../lib/utils";
import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, Navigate, Outlet, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from './ui/PageHeader';
import { 
  BookOpen, 
  Upload, 
  Trash2, 
  FileSpreadsheet, 
  Download, 
  Wand2, 
  Plus, 
  MicOff, 
  Mic, 
  Loader2, 
  ArrowRight, 
  Calculator, 
  FileText, 
  Zap, 
  Filter, 
  Settings2, 
  Hash, 
  FilePlus, 
  X, 
  Settings, 
  Check, 
  ExternalLink, 
  FileX, 
  Edit,
  Pencil,
  Brain,
  Maximize,
  Copy,
  Clock,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { sanitizeText, formatCurrencyPDF } from '@/lib/pdfUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { useDialog } from './DialogProvider';
import { useLanguage } from '@/context/LanguageContext';
import { SafeImage } from './SafeImage';
import { exportToCSV, PDF_CONFIG, addPDFHeader, addPDFFooter, CompanySettings } from '@/lib/exportUtils';
import { 
  DEFAULT_OPERATION_TYPES, 
  calculateEntries, 
  CustomOperation, 
  CustomOperationTemplate, 
  JournalEntryLine, 
  PaymentMode 
} from '@/lib/accounting';
import { 
  suggestJournalEntry, 
  AISuggestion, 
  analyzeInvoice, 
  suggestAccountCode, 
  parseNaturalLanguageEntry,
  logOcrFeedback,
  InvoiceAnalysis
} from '@/services/geminiService';

import * as XLSX from 'xlsx';
import { ThirdPartyFormModal } from './ThirdPartyFormModal';
import { saveLocalTransactions } from '../lib/dataSync';

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
  third_party_id?: number | null;
  third_party_name?: string;
  notes?: string;
  document_url?: string;
  invoice_number?: string;
  invoice_id?: number;
  recurring_transaction_id?: string;
  operation_type?: string;
  amount_ht?: number;
  vat_rate?: number;
  payment_mode?: string;
  treasury_account?: string;
  creation_mode?: 'guided' | 'expert';
}

interface Attachment {
  id: number;
  transaction_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface DetailedTransaction extends Transaction {
  entries: JournalEntryLine[];
  attachments?: Attachment[];
}

type OperationType = string; // Allow dynamic types

export function Journal({ openModal, onModalClose, scanTrigger, onScanTriggerConsumed }: { openModal?: boolean; onModalClose?: () => void; scanTrigger?: boolean; onScanTriggerConsumed?: () => void; }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirm, alert: dialogAlert } = useDialog();
  const { t } = useLanguage();
  const { formatCurrency, currency: baseCurrency, exchangeRates, getExchangeRate, getCurrencyIcon } = useCurrency();
  const { activeYear } = useFiscalYear();
  const location = useLocation();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [missingCapital, setMissingCapital] = useState(false);
  
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);
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
  const [isThirdPartyModalOpen, setIsThirdPartyModalOpen] = useState(false);
  const [thirdPartyModalType, setThirdPartyModalType] = useState<'client' | 'supplier'>('client');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestingAccount, setSuggestingAccount] = useState<number | null>(null); // null means not suggesting, -1 means guided mode override
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [mode, setMode] = useState<'guided' | 'expert'>('guided');
  const [isAiAssistEnabled, setIsAiAssistEnabled] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<DetailedTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);
  const [quickInvoiceData, setQuickInvoiceData] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [magicInput, setMagicInput] = useState('');
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastAiPrediction, setLastAiPrediction] = useState<InvoiceAnalysis | null>(null);
  const [lastAiImage, setLastAiImage] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(true);
  const [currentView, setCurrentView] = useState<'active' | 'trash'>('active');
  const [pendingImportEntries, setPendingImportEntries] = useState<any[]>([]);
  const [isImportValidationModalOpen, setIsImportValidationModalOpen] = useState(false);
  const magicInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openModal) {
      openNewModal();
    }
  }, [openModal]);

  const [accounts, setAccounts] = useState<{code: string, name: string}[]>([]);
  const [thirdParties, setThirdParties] = useState<{id: number, name: string, type: string, account_code: string, is_occasional?: boolean, balance?: number}[]>([]);
  const [defaultOccasional, setDefaultOccasional] = useState<{ client: any | null, supplier: any | null }>({ client: null, supplier: null });

  const generateReference = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF-${year}${month}${day}-${random}`;
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
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [isAutoDescription, setIsAutoDescription] = useState<boolean>(true);
  const [amountString, setAmountString] = useState<string>('');
  const [operationType, setOperationType] = useState<string>('achat_marchandises');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('caisse');
  const [amountHT, setAmountHT] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(18);

  // Helper to safely evaluate simple math expressions in the amount field (ex: 15000 + 4500)
  const evaluateMathExpression = (val: string): number | null => {
    const clean = val.replace(/\s+/g, '');
    if (/^[0-9.+\-*/()]+$/.test(clean)) {
      try {
        const fn = new Function(`return (${clean})`);
        const result = fn();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          return result;
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return null;
  };

  // Sync amountString with amountHT, unless there is an expression being typed
  useEffect(() => {
    const currentParsed = parseFloat(amountString);
    if (Math.abs(currentParsed - amountHT) > 0.01 || (isNaN(currentParsed) && amountHT !== 0)) {
      setAmountString(amountHT > 0 ? String(amountHT) : '');
    }
  }, [amountHT]);

  // Custom Op Form State
  const [newOpLabel, setNewOpLabel] = useState('');
  const [newOpErrors, setNewOpErrors] = useState<Record<string, string>>({});
  const [newOpIcon, setNewOpIcon] = useState('✨');
  const [newOpVatDebit, setNewOpVatDebit] = useState('');
  const [newOpVatCredit, setNewOpVatCredit] = useState('');
  const [newOpTemplate, setNewOpTemplate] = useState<CustomOperationTemplate[]>([
    { account_code: '', type: 'debit', formula: 'ht' }
  ]);
  const [selectedThirdParty, setSelectedThirdParty] = useState<string>(''); // account_code
  const [occasionalName, setOccasionalName] = useState('');
  const [selectedTreasuryAccount, setSelectedTreasuryAccount] = useState<string>('');
  const [suggestedAccounts, setSuggestedAccounts] = useState<{account_code: string, account_name: string, count: number}[]>([]);
  const [selectedAccountOverride, setSelectedAccountOverride] = useState<string>('');

  // Expert Mode Entries
  const [entries, setEntries] = useState<JournalEntryLine[]>([
    { account_code: '', debit: 0, credit: 0 },
    { account_code: '', debit: 0, credit: 0 }
  ]);

  const getOperationLabel = (type: string) => {
    if (type && type.startsWith('custom_')) {
      const customOpId = parseInt(type.split('_')[1]);
      const customOp = customOperations.find(op => op.id === customOpId);
      return customOp?.label || 'Opération';
    }
    const standard = DEFAULT_OPERATION_TYPES.find(t => t.id === type);
    return standard?.label || '';
  };

  // Automate operation description (libellé) in real-time
  useEffect(() => {
    if (isAutoDescription && isModalOpen) {
      const opLabel = getOperationLabel(operationType);
      const party = thirdParties.find(p => p.account_code === selectedThirdParty);
      const partyName = party ? (party.is_occasional && occasionalName ? occasionalName : party.name) : '';
      
      let text = opLabel;
      if (partyName) {
        text += ` - ${partyName}`;
      }
      if (reference) {
        text += ` (Réf: ${reference})`;
      }
      setDescription(text);
    }
  }, [operationType, selectedThirdParty, reference, isAutoDescription, customOperations, thirdParties, occasionalName, isModalOpen]);

  // Auto-save Draft
  useEffect(() => {
    if (isModalOpen && !editingId) {
      const hasChanges = description.trim() !== '' || amountHT > 0 || entries.some(e => e.account_code !== '' || e.debit > 0 || e.credit > 0);
      if (hasChanges) {
        localStorage.setItem('journal_draft', JSON.stringify({
          mode, date, reference, description, amountHT, entries, selectedThirdParty, occasionalName, operationType
        }));
      }
    }
  }, [isModalOpen, editingId, mode, date, reference, description, amountHT, entries, selectedThirdParty, occasionalName, operationType]);

  const handleModalClose = async (force = false) => {
    const hasChanges = description.trim() !== '' || 
                       amountHT > 0 || 
                       notes.trim() !== '' ||
                       entries.some(e => e.account_code !== '' || e.debit > 0 || e.credit > 0) ||
                       pendingFiles.length > 0;

    if (!force && hasChanges) {
      const proceed = await confirm("Voulez-vous abandonner l'écriture en cours ? Toutes les données non enregistrées seront perdues.");
      if (!proceed) return;
    }
    localStorage.removeItem('journal_draft');
    setIsModalOpen(false);
    setEditingId(null);
    setDueDate('');
    setReference('');
    setDescription('');
    setNotes('');
    setDocumentUrls([]);
    setPendingFiles([]);
    setExistingAttachments([]);
    setEntries([{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
    setAmountHT(0);
    setOperationType('achat_marchandises');
    setPaymentMode('caisse');
    setSelectedThirdParty('');
    setOccasionalName('');
    setSelectedTreasuryAccount('');
    setSelectedAccountOverride('');
    setAiSuggestion(null);
    if (onModalClose) onModalClose();
  };

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        descriptionInputRef.current?.focus({ preventScroll: true });
      }, 150);
    }
  }, [isModalOpen]);

  const [isFastEntryMode, setIsFastEntryMode] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Fast Entry Mode with Alt+S
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsFastEntryMode(prev => {
          const next = !prev;
          if (next) dialogAlert("Mode Saisie Rapide activé (Tab/Entrée enchaînés).", 'info');
          else dialogAlert("Mode Saisie Rapide désactivé.", 'info');
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [dialogAlert]);

  const handleEntryKeyDown = (e: React.KeyboardEvent, idx: number, field: 'account' | 'description' | 'debit' | 'credit') => {
    if (e.key === 'Enter' || (isFastEntryMode && e.key === 'Tab' && !e.shiftKey)) {
      if (e.key === 'Enter') e.preventDefault(); // Prevent form submission
      
      const row = (e.currentTarget.closest('.group') as HTMLElement);
      if (!row) return;
      const inputs = row.querySelectorAll('input');
      
      if (field === 'account') {
        const val = entries[idx].account_code;
        if (e.key === 'Enter' && isAiAssistEnabled && val && !/^\d+$/.test(val)) {
          handleSuggestAccountHead(idx, val);
          return;
        }
        // Focus description
        if (inputs[1]) inputs[1].focus({ preventScroll: true });
        if (isFastEntryMode && e.key === 'Tab') e.preventDefault();
      } else if (field === 'description') {
        // Focus debit
        if (inputs[2]) inputs[2].focus({ preventScroll: true });
        if (isFastEntryMode && e.key === 'Tab') e.preventDefault();
      } else if (field === 'debit') {
        // Focus credit
        if (inputs[3]) inputs[3].focus({ preventScroll: true });
        if (isFastEntryMode && e.key === 'Tab') e.preventDefault();
      } else if (field === 'credit') {
        if ((isFastEntryMode || e.key === 'Enter') && idx === entries.length - 1 && (!isBalanced || isFastEntryMode)) {
          setEntries(prev => [...prev, { account_code: '', debit: 0, credit: 0, description: '' }]);
        }
        setTimeout(() => {
          const allRows = row.parentElement?.children;
          if (allRows && allRows[idx + 1]) {
            const nextRowInputs = (allRows[idx + 1] as HTMLElement).querySelectorAll('input');
            if (nextRowInputs[0]) nextRowInputs[0].focus({ preventScroll: true });
          }
        }, 50);
        if (isFastEntryMode && e.key === 'Tab') e.preventDefault();
      }
    }
  };

  const clearForm = async () => {
    const proceed = await confirm("Voulez-vous réinitialiser le formulaire ?");
    if (!proceed) return;
    
    setDescription('');
    setIsAutoDescription(true);
    setAmountHT(0);
    setAmountString('');
    setNotes('');
    setDocumentUrls([]);
    setPendingFiles([]);
    setEntries([{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
    setOperationType('achat_marchandises');
    setPaymentMode('caisse');
    setSelectedThirdParty('');
    setOccasionalName('');
    setSelectedTreasuryAccount('');
    setSelectedAccountOverride('');
    setAiSuggestion(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;

      // Ctrl+K to focus Magic Input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        magicInputRef.current?.focus({ preventScroll: true });
      }

      // Ctrl+B to balance
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleBalance();
      }

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }

      // Alt+1 to Alt+5 to quickly switch operation types in guided mode
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setOperationType('vente_marchandises');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setOperationType('vente_services');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setOperationType('achat_marchandises');
      } else if (e.altKey && e.key === '4') {
        e.preventDefault();
        setOperationType('achat_services');
      } else if (e.altKey && e.key === '5') {
        e.preventDefault();
        setOperationType('frais_generaux');
      }

      // Escape to close/abandon
      if (e.key === 'Escape' && !isCustomOpModalOpen && !isDetailOpen && !isQuickInvoiceOpen) {
        handleModalClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, description, amountHT, entries, pendingFiles, isCustomOpModalOpen, isDetailOpen, isQuickInvoiceOpen]);

  useEffect(() => {
    const fetchSuggestions = () => {
      const party = thirdParties.find(p => p.account_code === selectedThirdParty);
      const params = new URLSearchParams();
      if (party) params.append('thirdPartyId', party.id.toString());
      if (operationType) params.append('operationType', operationType);
      if (description) params.append('description', description);

      if (params.toString()) {
        apiFetch(`/api/journal/suggestions?${params.toString()}`)
          .then(res => res.json())
          .then(data => setSuggestedAccounts(data))
          .catch(err => console.error(err));
      } else {
        setSuggestedAccounts([]);
      }
    };
    
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedThirdParty, operationType, thirdParties, description]);
  
  useEffect(() => {
    fetchTransactions();
    fetchCustomOperations();
    fetchAccounts();
    fetchThirdParties();
    fetchDefaultOccasional();
    fetchCompanySettings();
  }, [startDate, endDate, statusFilter, searchTerm, thirdPartyFilter, accountFilter, minAmount, maxAmount, activeYear?.id]);

  const fetchDefaultOccasional = async () => {
    try {
      const res = await apiFetch('/api/third-parties/defaults');
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
        apiFetch('/api/company/settings'),
        apiFetch('/api/vat-settings')
      ]);
      const settings = await settingsRes.json();
      const vatSettings = await vatRes.json();
      setCompanySettings({ ...settings, vat_settings: vatSettings });
    } catch (err) {
      console.error("Error fetching company settings:", err);
    }
  };

  useEffect(() => {
    if (mode === 'guided' && isModalOpen) {
      const calculated = calculateEntries(
        operationType,
        amountHT * transactionExchangeRate,
        vatRate,
        paymentMode,
        customOperations,
        selectedThirdParty,
        companySettings?.vat_settings || [], // vatSettings
        selectedTreasuryAccount,
        companySettings,
        selectedAccountOverride
      );
      setEntries(calculated);
    }
  }, [mode, isModalOpen, operationType, amountHT, vatRate, paymentMode, transactionExchangeRate, customOperations, selectedThirdParty, selectedTreasuryAccount, companySettings, selectedAccountOverride]);

  useEffect(() => {
    setSelectedThirdParty('');
    setSelectedAccountOverride('');
  }, [operationType]);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchThirdParties = async () => {
    try {
      const res = await apiFetch('/api/third-parties');
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
      if (activeYear?.id) params.append('fiscalYearId', activeYear.id.toString());
      if (currentView === 'trash') params.append('isDeleted', 'true');

      const res = await apiFetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      setTransactions(data);
      if (currentView !== 'trash') { saveLocalTransactions(data).catch(console.error); }

      const capRes = await apiFetch('/api/check-capital');
      const capData = await capRes.json();
      setMissingCapital(!capData.hasCapital);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await apiFetch(`/api/transactions/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        dialogAlert("Transaction restaurée avec succès !");
        fetchTransactions();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de la restauration", 'error');
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur de communication", 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const isTrash = currentView === 'trash';
    const message = isTrash 
      ? "Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cette transaction ? Cette action est irréversible."
      : "Voulez-vous déplacer cette transaction vers la corbeille ?";
    
    const proceed = await confirm(message);
    if (!proceed) return;

    try {
      const url = isTrash ? `/api/transactions/${id}?permanent=true` : `/api/transactions/${id}`;
      const res = await apiFetch(url, { method: 'DELETE' });
      const data = await res.json();
      
      if (res.ok) {
        dialogAlert(isTrash ? "Transaction supprimée définitivement" : "Transaction déplacée dans la corbeille");
        fetchTransactions();
      } else {
        dialogAlert(data.error || "Erreur lors de la suppression", 'error');
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la suppression", 'error');
    }
  };

  const handleReverse = async (id: number) => {
    const proceed = await confirm("Êtes-vous sûr de vouloir contre-passer cette transaction ? Une nouvelle transaction annulant celle-ci sera créée.");
    if (!proceed) return;

    try {
      const res = await apiFetch(`/api/transactions/${id}/reverse`, { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        dialogAlert("Transaction contre-passée avec succès !");
        fetchTransactions();
      } else {
        dialogAlert(data.error || "Erreur lors de la contre-passation", 'error');
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la contre-passation", 'error');
    }
  };

  const fetchCustomOperations = async () => {
    try {
      const res = await apiFetch('/api/custom-operations');
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
      const res = await apiFetch('/api/custom-operations', {
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
      const res = await apiFetch(`/api/transactions/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (data.invoice_number) {
        const proceed = await confirm(`Cette transaction est déjà liée à la facture ${data.invoice_number}. Voulez-vous quand même créer une nouvelle facture ?`);
        if (!proceed) return;
      }

      // Check if it's a sale (has 7xx accounts) or purchase (has 6xx accounts)
      const saleEntries = data.entries?.filter((e: any) => e.account_code?.startsWith('7')) || [];
      const purchaseEntries = data.entries?.filter((e: any) => e.account_code?.startsWith('6')) || [];
      const hasSale = saleEntries.length > 0;
      const hasPurchase = purchaseEntries.length > 0;
      
      if (!hasSale && !hasPurchase) {
        const proceed = await confirm("Cette transaction ne semble pas être une vente ou un achat (pas de compte de classe 6 ou 7). Voulez-vous quand même créer une facture ?");
        if (!proceed) return;
      }

      // Prepare quick invoice data
      const clientEntry = data.entries?.find((e: any) => e.account_code?.startsWith('411'));
      const supplierEntry = data.entries?.find((e: any) => e.account_code?.startsWith('401'));
      const partnerEntry = clientEntry || supplierEntry;

      let tp = null;
      if (data.third_party_id) {
        tp = thirdParties.find(p => p.id === data.third_party_id);
      } else if (partnerEntry) {
        tp = thirdParties.find(p => p.account_code === partnerEntry.account_code);
      }

      // VAT detection (443 is sales VAT, 445 is purchase VAT)
      const vatEntry = data.entries?.find((e: any) => e.account_code?.startsWith('443') || e.account_code?.startsWith('445'));
      let detectedVatRate = 18;
      if (vatEntry) {
        const vatAmount = Math.abs((vatEntry.credit || 0) - (vatEntry.debit || 0));
        const baseEntries = saleEntries.length > 0 ? saleEntries : purchaseEntries;
        const baseAmount = Math.abs(baseEntries.reduce((acc: number, e: any) => acc + ((e.credit || 0) - (e.debit || 0)), 0));
        if (baseAmount > 0) {
          const rawRate = (vatAmount / baseAmount) * 100;
          const commonRates = [0, 2, 5, 10, 18];
          detectedVatRate = commonRates.reduce((prev, curr) => 
            Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
          );
        }
      }

      let items = [];
      if (saleEntries.length > 0) {
        items = saleEntries.map((e: any) => ({
          description: e.description || data.description,
          quantity: 1,
          unit_price: Math.abs((e.credit || 0) - (e.debit || 0)),
          vat_rate: detectedVatRate,
          account_code: e.account_code
        }));
      } else if (purchaseEntries.length > 0) {
        items = purchaseEntries.map((e: any) => ({
          description: e.description || data.description,
          quantity: 1,
          unit_price: Math.abs((e.credit || 0) - (e.debit || 0)),
          vat_rate: detectedVatRate,
          account_code: e.account_code
        }));
      } else {
        const computedTotal = data.total_amount || 
                              data.amount_ht || 
                              (data.entries?.reduce((sum: number, e: any) => sum + (e.debit || 0), 0) || 0);
        items = [{
          description: data.description,
          quantity: 1,
          unit_price: computedTotal,
          vat_rate: detectedVatRate,
          account_code: '701'
        }];
      }

      setQuickInvoiceData({
        transaction: {
          ...data,
          total_amount: data.total_amount || data.amount_ht || data.entries?.reduce((sum: number, e: any) => sum + (e.debit || 0), 0) || 0
        },
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
      navigate('/invoicing', { state: { prefill: quickInvoiceData.transaction } });
      setIsQuickInvoiceOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/invoices', {
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
      const res = await apiFetch(`/api/transactions/${id}`);
      const data = await res.json();
      setSelectedTransactionDetail(data);
      setIsDetailOpen(true);
    } catch (err) {
      console.error("Failed to fetch transaction details", err);
      dialogAlert("Erreur lors du chargement des détails");
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const res = await apiFetch(`/api/transactions/${id}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      setReference(generateReference());
      // Clean description from potential copy suffix
      const cleanDesc = data.description ? data.description.replace(/\(copie\)/gi, '').replace(/^Copie de /i, '').trim() : '';
      setDescription(cleanDesc);
      setNotes(data.notes || '');
      
      // Parse document URLs if they are stored as JSON array
      let urls: string[] = [];
      if (data.document_url) {
        try {
          const parsed = parseSafeJSON(data.document_url);
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
      // Not duplicating physical attachments to avoid reference errors
      
      setEntries(data.entries.map((e: any) => ({ 
        account_code: e.account_code,
        debit: e.debit,
        credit: e.credit,
        description: e.description
      })));
      setTransactionCurrency(data.currency || 'FCFA');
      setTransactionExchangeRate(data.exchange_rate || 1);
      
      // Restore guided mode parameters if they exist
      if (data.operation_type) setOperationType(data.operation_type);
      
      let recoveredAmountHT = data.amount_ht;
      if (!recoveredAmountHT && data.entries && data.entries.length > 0) {
        const baseEntry = data.entries.find((e: any) => e.account_code?.startsWith('6') || e.account_code?.startsWith('2') || e.account_code?.startsWith('7'));
        if (baseEntry) {
          recoveredAmountHT = baseEntry.account_code.startsWith('7') ? baseEntry.credit : baseEntry.debit;
        } else {
          recoveredAmountHT = data.entries.reduce((max: number, e: any) => Math.max(max, e.debit || 0, e.credit || 0), 0);
        }
      }
      setAmountHT(recoveredAmountHT || 0);
      setAmountString(recoveredAmountHT ? String(recoveredAmountHT) : '');

      if (data.vat_rate !== undefined) setVatRate(data.vat_rate);
      if (data.payment_mode) setPaymentMode(data.payment_mode);
      if (data.treasury_account) setSelectedTreasuryAccount(data.treasury_account);
      
      // Try to restore third party
      if (data.third_party_id) {
        const party = thirdParties.find(p => p.id === data.third_party_id);
        if (party) {
          setSelectedThirdParty(party.account_code);
          if (party.is_occasional) {
            setOccasionalName(data.occasional_name || '');
          } else {
            setOccasionalName('');
          }
        }
      } else {
        setSelectedThirdParty('');
        setOccasionalName('');
      }

      setMode(data.creation_mode || 'expert');
      setIsModalOpen(true);
    } catch (err) {
      console.error("Failed to duplicate transaction", err);
      dialogAlert("Erreur lors de la duplication", 'error');
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await apiFetch(`/api/transactions/${id}`);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setEditingId(id);
      setIsAutoDescription(false);
      setDate(data.date || new Date().toISOString().split('T')[0]);
      setDueDate(data.due_date || '');
      setReference(data.reference || '');
      setDescription(data.description || '');
      setNotes(data.notes || '');
      
      // Parse document URLs if they are stored as JSON array
      let urls: string[] = [];
      if (data.document_url) {
        try {
          const parsed = parseSafeJSON(data.document_url);
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
      setExistingAttachments(data.attachments || []);
      
      setEntries(data.entries);
      setTransactionCurrency(data.currency || 'FCFA');
      setTransactionExchangeRate(data.exchange_rate || 1);
      
      // Restore guided mode parameters if they exist
      if (data.operation_type) setOperationType(data.operation_type);
      
      let recoveredAmountHT2 = data.amount_ht;
      if (!recoveredAmountHT2 && data.entries && data.entries.length > 0) {
        const baseEntry = data.entries.find((e: any) => e.account_code?.startsWith('6') || e.account_code?.startsWith('2') || e.account_code?.startsWith('7'));
        if (baseEntry) {
          recoveredAmountHT2 = baseEntry.account_code.startsWith('7') ? baseEntry.credit : baseEntry.debit;
        } else {
          recoveredAmountHT2 = data.entries.reduce((max: number, e: any) => Math.max(max, e.debit || 0, e.credit || 0), 0);
        }
      }
      setAmountHT(recoveredAmountHT2 || 0);
      setAmountString(recoveredAmountHT2 ? String(recoveredAmountHT2) : '');

      if (data.vat_rate !== undefined) setVatRate(data.vat_rate);
      if (data.payment_mode) setPaymentMode(data.payment_mode);
      if (data.treasury_account) setSelectedTreasuryAccount(data.treasury_account);
      
      // Try to restore third party
      if (data.third_party_id) {
        const party = thirdParties.find(p => p.id === data.third_party_id);
        if (party) {
          setSelectedThirdParty(party.account_code);
          if (party.is_occasional) {
            setOccasionalName(data.occasional_name || '');
          } else {
            setOccasionalName('');
          }
        }
      } else {
        setSelectedThirdParty('');
        setOccasionalName('');
      }

      setMode(data.creation_mode || 'expert');
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
    setIsScanning(true);
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (scanTrigger) {
      handleScanButtonClick();
      if (onScanTriggerConsumed) onScanTriggerConsumed();
    }
  }, [scanTrigger]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const useAI = await confirm("Voulez-vous qu'Ory analyse cette facture pour pré-remplir les champs ?");
        if (useAI) {
          await processFileForAI(file);
        } else {
          setPendingFiles(prev => [...prev, file]);
        }
      } else {
        setPendingFiles(prev => [...prev, file]);
      }
    }
  };

  const processFileForAI = async (file: File) => {
    const isSale = await confirm("S'agit-il d'une VENTE ? (Cliquez sur 'Confirmer' pour VENTE, 'Annuler' pour un ACHAT)");
    const sType = isSale ? 'vente' : 'achat';
    
    setAnalyzing(true);
    setIsModalOpen(true);
    setMode('guided');
    setEditingId(null);
    setScanType(sType);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const newUrl = `data:${file.type};base64,${base64}`;
      setDocumentUrls(prev => [...prev, newUrl]);
      await performAIAnalysis(base64, newUrl, sType, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (isScanning) {
      const file = files[0];
      if (!scanType) return;
      await processFileForAI(file);
      setIsScanning(false);
    } else {
      // Adding attachments
      const newFiles = Array.from(files);
      
      // If it's an image or PDF and we are in the modal, ask to analyze
      if (isModalOpen && newFiles.length > 0 && (newFiles[0].type.startsWith('image/') || newFiles[0].type === 'application/pdf')) {
        const file = newFiles[0];
        const useAI = await confirm("Voulez-vous qu'Ory analyse ce document pour pré-remplir les champs de la transaction ?");
        
        if (useAI) {
          await processFileForAI(file);
        } else {
          setPendingFiles(prev => [...prev, ...newFiles]);
        }
      } else {
        setPendingFiles(prev => [...prev, ...newFiles]);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      dialogAlert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMagicInput(transcript);
      // Wait a bit for state update before submitting
      setTimeout(() => {
        handleMagicSubmit();
      }, 500);
    };

    recognition.start();
  };

  useEffect(() => {
    const state = location.state as { prefilled?: any, triggerVoice?: boolean };
    if (state?.triggerVoice) {
      // Clear state so it doesn't trigger again on reload
      window.history.replaceState({}, document.title);
      startListening();
    }
    if (state?.prefilled) {
      const data = state.prefilled;
      setMode('guided');
      setEditingId(null);
      setDescription(data.description || '');
      setAmountHT(data.amount || 0);

      if (data.date) setDate(data.date);
      if (data.operationType) setOperationType(data.operationType);
      if (data.paymentMode) setPaymentMode(data.paymentMode);

      if (data.thirdPartyName) {
        const type = ['vente_marchandises', 'vente_services', 'encaissement_client'].includes(data.operationType) ? 'client' : 'supplier';
        const match = thirdParties.find(tp => 
          tp.name.toLowerCase().includes(data.thirdPartyName!.toLowerCase()) || 
          data.thirdPartyName!.toLowerCase().includes(tp.name.toLowerCase())
        );
        
        if (match) {
          setSelectedThirdParty(match.account_code);
        } else {
          setOccasionalName(data.thirdPartyName || '');
          const def = type === 'client' ? defaultOccasional.client : defaultOccasional.supplier;
          if (def) setSelectedThirdParty(def.account_code);
        }
      }

      setReference(generateReference());
      setIsModalOpen(true);
      // Clear location state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, thirdParties, defaultOccasional]);

  const handleMagicSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!magicInput.trim()) return;

    setIsMagicLoading(true);
    try {
      const data = await parseNaturalLanguageEntry(magicInput);
      if (!data) {
        dialogAlert("Impossible de comprendre cette demande. Essayez d'être plus explicite : 'Achat de fournitures 50000 FCFA par caisse chez Inova'", "error");
        return;
      }

      setMode('guided');
      setEditingId(null);
      setDescription(data.description || magicInput);
      setAmountHT(data.amount || 0);

      if (data.date) {
        setDate(data.date);
      }

      if (data.operationType) {
        setOperationType(data.operationType);
      }

      if (data.paymentMode) {
        setPaymentMode(data.paymentMode);
      }

      if (data.thirdPartyName) {
        const type = ['vente_marchandises', 'vente_services', 'encaissement_client'].includes(data.operationType) ? 'client' : 'supplier';
        
        const match = thirdParties.find(tp => 
          tp.name.toLowerCase().includes(data.thirdPartyName!.toLowerCase()) || 
          data.thirdPartyName!.toLowerCase().includes(tp.name.toLowerCase())
        );
        
        if (match) {
          setSelectedThirdParty(match.account_code);
        } else {
          setOccasionalName(data.thirdPartyName || '');
          const def = type === 'client' ? defaultOccasional.client : defaultOccasional.supplier;
          if (def) {
            setSelectedThirdParty(def.account_code);
          }
        }
      }

      const generatedReference = generateReference();
      setReference(generatedReference);

      setIsModalOpen(true);
      setMagicInput('');
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur lors de la suggestion IA", "error");
    } finally {
      setIsMagicLoading(false);
    }
  };

  const performAIAnalysis = async (base64: string, dataUrl: string, sType: 'vente' | 'achat', mimeType: string = 'image/jpeg') => {
    try {
      const data = await analyzeInvoice(base64, sType, companySettings?.vat_settings || [], mimeType);
      
      if (!data) throw new Error("L'analyse IA a échoué");

      setLastAiPrediction(data);
      setLastAiImage(dataUrl);

      if (data.date) setDate(data.date);
      if (data.description) setDescription(data.description);
      
      const ht = data.amount_ht || (data.amount_ttc ? data.amount_ttc / 1.18 : 0);
      if (ht > 0) setAmountHT(Math.round(ht));
      
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
          setOccasionalName(data.third_party || '');
          const def = sType === 'vente' ? defaultOccasional.client : defaultOccasional.supplier;
          if (def) {
            setSelectedThirdParty(def.account_code);
          }
        }
      }

      // Operation Type
      if (data.operation_type && DEFAULT_OPERATION_TYPES.some(t => t.id === data.operation_type)) {
        setOperationType(data.operation_type);
      } else {
        setOperationType(sType === 'vente' ? 'vente_marchandises' : 'achat_marchandises');
      }

      // If expert mode, we can also pre-fill entries
      if (data.entries && data.entries.length > 0) {
        setEntries(data.entries.map(e => ({
          account_code: e.account_code,
          debit: e.debit,
          credit: e.credit,
          description: e.description || ''
        })));
      }

      dialogAlert("Analyse terminée ! Les champs ont été pré-remplis.", 'success');
    } catch (err: any) {
      console.error("AI Analysis failed", err);
      dialogAlert(`Erreur lors de l'analyse : ${err.message || 'Veuillez saisir manuellement.'}`, 'error');
    } finally {
      setAnalyzing(false);
      setScanType(null);
      setIsScanning(false);
    }
  };

  const applyDetailedItemsToEntries = () => {
    if (!lastAiPrediction || !lastAiPrediction.items || lastAiPrediction.items.length === 0) return;

    const sType = operationType.includes('vente') ? 'vente' : 'achat';
    const newEntries: any[] = [];
    
    // Total for third party line
    let totalTTC = 0;

    // Create lines for each item
    lastAiPrediction.items.forEach(item => {
      totalTTC += item.total;
      newEntries.push({
        account_code: item.account_suggestion || (sType === 'achat' ? '601100' : '701100'),
        debit: sType === 'achat' ? item.total : 0,
        credit: sType === 'vente' ? item.total : 0,
        description: item.description
      });
    });

    // Add VAT line if present
    if (lastAiPrediction.amount_tva > 0) {
      const vatCode = sType === 'achat' ? '445200' : '443100';
      newEntries.push({
        account_code: vatCode,
        debit: sType === 'achat' ? lastAiPrediction.amount_tva : 0,
        credit: sType === 'vente' ? lastAiPrediction.amount_tva : 0,
        description: 'TVA extraite'
      });
      totalTTC += lastAiPrediction.amount_tva;
    }

    // Add third party line
    const thirdPartyCode = selectedThirdParty || (sType === 'achat' ? '401100' : '411100');
    newEntries.push({
      account_code: thirdPartyCode,
      debit: sType === 'vente' ? totalTTC : 0,
      credit: sType === 'achat' ? totalTTC : 0,
      description: `Réglement ${lastAiPrediction.third_party || 'tiers'}`
    });

    setEntries(newEntries);
    setMode('expert');
    dialogAlert("Les écritures ont été détaillées par article. Vous êtes maintenant en mode expert.", "success");
  };

  const handleDeleteAttachment = async (id: number) => {
    const confirmed = await confirm("Voulez-vous supprimer cette pièce jointe ?");
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/attachments/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        if (selectedTransactionDetail) {
          setSelectedTransactionDetail(prev => {
            if (!prev) return null;
            return {
              ...prev,
              attachments: prev.attachments?.filter(a => a.id !== id)
            };
          });
        }
        // If we are editing, we might need to refresh the attachments list
        if (editingId) {
          const txRes = await apiFetch(`/api/transactions/${editingId}`);
          const txData = await txRes.json();
          setSelectedTransactionDetail(txData); // This is a bit hacky but works if we use it for edit too
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la suppression", 'error');
    }
  };

  const handleAISuggestion = async () => {
    if (!description || !amountHT) {
      dialogAlert("Veuillez saisir un libellé et un montant pour obtenir une suggestion.");
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
        dialogAlert("L'IA n'a pas pu générer de suggestion pertinente.");
      }
    } catch (err) {
      console.error("AI Suggestion failed", err);
      dialogAlert("Erreur lors de la suggestion IA.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleSuggestAccountHead = async (index: number = -1, overrideSearchTerm: string = '') => {
    const lineDescription = index !== -1 ? entries[index].description : '';
    let lookupDescription = lineDescription ? `${description} (${lineDescription})` : description;
    
    if (overrideSearchTerm) {
      lookupDescription += ` - Recherche sémantique: ${overrideSearchTerm}`;
    }

    if (!lookupDescription && !overrideSearchTerm) {
      dialogAlert("Veuillez saisir un libellé pour que l'IA puisse suggérer un compte.", 'info');
      return;
    }

    setSuggestingAccount(index);
    try {
      // Use suggestedAccounts (frequent accounts) or recent transactions for history
      const historyCtx = suggestedAccounts.length > 0 ? suggestedAccounts : transactions.slice(0, 20);
      const suggestions = await suggestAccountCode(lookupDescription, historyCtx, accounts);
      
      if (suggestions && suggestions.length > 0) {
        if (index === -1) {
          // In guided mode, update the suggestions list and auto-select the best one
          setSuggestedAccounts(suggestions.map((s: any) => ({
            account_code: s.account_code,
            account_name: s.account_name || s.explanation.substring(0, 50),
            count: Math.round(s.confidence * 100),
            explanation: s.explanation
          })));
          setSelectedAccountOverride(suggestions[0].account_code);
          dialogAlert(`L'IA a suggéré ${suggestions.length} compte(s) pour "${description}".`, 'success');
        } else {
          // In expert mode, just apply the best suggestion to the line
          const best = suggestions[0];
          const newEntries = [...entries];
          newEntries[index].account_code = best.account_code;
          setEntries(newEntries);
          dialogAlert(`Compte suggéré : ${best.account_code}. ${best.explanation}`, 'success');
        }
      } else {
        dialogAlert("L'IA n'a pas pu suggérer de compte pour ce libellé.", 'info');
      }
    } catch (err) {
      console.error("Failed to suggest account", err);
    } finally {
      setSuggestingAccount(null);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    setEntries(aiSuggestion.entries.map(e => ({
      account_code: e.account_code,
      debit: e.debit,
      credit: e.credit,
      description: e.description || ''
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
    // Use the first row that lacks an amount, or the last row if all have amounts
    let targetIdx = newEntries.findIndex(e => !e.debit && !e.credit);
    if (targetIdx === -1) {
      targetIdx = newEntries.length - 1;
    }
    
    const target = { ...newEntries[targetIdx] };

    if (diff > 0) {
      // More debit than credit, add to credit
      target.credit = Number((Number(target.credit || 0) + diff).toFixed(2));
      target.debit = 0; // Clear opposite
    } else {
      // More credit than debit, add to debit
      target.debit = Number((Number(target.debit || 0) + Math.abs(diff)).toFixed(2));
      target.credit = 0; // Clear opposite
    }

    newEntries[targetIdx] = target;
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

      const entriesToSave = entries;

      const res = await apiFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date, 
          due_date: (paymentMode === 'credit' && dueDate) ? dueDate : null,
          description, 
          reference,
          entries: entriesToSave,
          third_party_id: thirdPartyId,
          occasional_name: party?.is_occasional ? occasionalName : null,
          currency: transactionCurrency,
          exchange_rate: transactionExchangeRate,
          notes,
          document_url: JSON.stringify(documentUrls),
          operation_type: operationType,
          amount_ht: amountHT,
          vat_rate: vatRate,
          payment_mode: paymentMode,
          treasury_account: selectedTreasuryAccount,
          creation_mode: mode
        })
      });
      
      const data = await res.json();

      if (res.ok) {
        const transactionId = editingId || data.id;

        // Upload pending files if any
        if (pendingFiles.length > 0) {
          const formData = new FormData();
          pendingFiles.forEach(file => {
            formData.append('files', file);
          });

          const uploadRes = await apiFetch(`/api/transactions/${transactionId}/attachments`, {
            method: 'POST',
            body: formData
          });

          if (!uploadRes.ok) {
            console.error("Failed to upload attachments");
            dialogAlert("La transaction a été enregistrée mais certaines pièces jointes n'ont pas pu être téléchargées.", 'info');
          }
        }

        handleModalClose(true);
        fetchTransactions();
        // Reset
        setDescription('');
        setAmountHT(0);
        setEntries([]);
        setEditingId(null);
        setSelectedThirdParty('');
        setPendingFiles([]);

        // Log OCR feedback if it was an AI-assisted creation
        if (lastAiPrediction && lastAiImage && !editingId) {
          const finalData: InvoiceAnalysis = {
            date,
            description,
            third_party: party?.name || (party?.is_occasional ? occasionalName : ''),
            amount_ht: amountHT,
            amount_tva: (amountHT * vatRate / 100),
            amount_ttc: (amountHT * (1 + vatRate / 100)),
            vat_rate: vatRate,
            operation_type: operationType,
            invoice_number: reference,
            currency: transactionCurrency,
            entries: entriesToSave.map(e => ({
              account_code: e.account_code,
              debit: e.debit,
              credit: e.credit,
              description: e.description
            }))
          };
          
          logOcrFeedback(lastAiImage, lastAiPrediction, finalData);
          setLastAiPrediction(null);
          setLastAiImage(null);
        }
      } else {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreDraft = () => {
    const draftStr = localStorage.getItem('journal_draft');
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setMode(draft.mode || 'guided');
        setDate(draft.date || new Date().toISOString().split('T')[0]);
        setReference(draft.reference || generateReference());
        setDescription(draft.description || '');
        setAmountHT(draft.amountHT || 0);
        setAmountString(draft.amountHT ? String(draft.amountHT) : '');
        setEntries(draft.entries || [{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
        setSelectedThirdParty(draft.selectedThirdParty || '');
        setOccasionalName(draft.occasionalName || '');
        setOperationType(draft.operationType || 'sale');
        setIsModalOpen(true);
        return true;
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
    return false;
  };

  const openNewModal = (defaultType?: string) => {
    if (handleRestoreDraft()) {
      return;
    }
    setEditingId(null);
    setIsAutoDescription(true);
    setDate(new Date().toISOString().split('T')[0]);
    setReference(generateReference());
    setDescription('');
    setAmountHT(0);
    setAmountString('');
    setEntries([{ account_code: '', debit: 0, credit: 0 }, { account_code: '', debit: 0, credit: 0 }]);
    setMode('guided');
    if (defaultType) {
      setOperationType(defaultType);
    }
    setSelectedThirdParty('');
    setOccasionalName('');
    setSelectedTreasuryAccount('');
    setIsModalOpen(true);
    setTimeout(() => {
      descriptionInputRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  const handleImportExcel = () => {
    importInputRef.current?.click();
  };

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const entries = data.map((row: any) => ({
          date: row.date || row.Date || new Date().toISOString().split('T')[0],
          description: row.description || row.Description || row.Libellé || 'Import Excel',
          reference: row.reference || row.Reference || row.Réf || '',
          lines: [
            { account_code: String(row.account_debit || row.Débit || ''), debit: Number(row.amount || row.Montant || 0), credit: 0 },
            { account_code: String(row.account_credit || row.Crédit || ''), debit: 0, credit: Number(row.amount || row.Montant || 0) }
          ]
        })).filter(e => e.lines[0].account_code && e.lines[1].account_code && (e.lines[0].debit > 0 || e.lines[1].credit > 0));

        if (entries.length === 0) {
          dialogAlert("Aucune donnée valide trouvée dans le fichier. Assurez-vous d'avoir les colonnes: date, description, account_debit, account_credit, amount.");
          return;
        }

        setPendingImportEntries(entries);
        setIsImportValidationModalOpen(true);
      } catch (err) {
        console.error(err);
        dialogAlert("Le fichier Excel n'a pas pu être lu. Vérifiez son format.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const confirmImportJournal = async () => {
    setIsImportValidationModalOpen(false);
    const res = await apiFetch('/api/import/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: pendingImportEntries })
    });

    if (res.ok) {
      const result = await res.json();
      dialogAlert(`${result.success} écritures importées avec succès.`);
      fetchTransactions();
      setPendingImportEntries([]);
    } else {
      const errorData = await res.json();
      dialogAlert("Erreur lors de l'import: " + (errorData.error || "Inconnu"));
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiFetch(`/api/journal/export?${params.toString()}`);
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
      dialogAlert("Erreur lors de l'export Excel");
    }
  };

  const handleExportPDF = async () => {
    try {
      // Fetch detailed data for export
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);

      const res = await apiFetch(`/api/journal/export?${params.toString()}`);
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
      utils.addOHADAComplianceSignature(doc, finalY + 20, settings.manager_name || "L'Administrateur");
      addPDFFooter(doc);
      doc.save(`Journal_General_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (err) {
      console.error("Export failed", err);
      dialogAlert("Erreur technique lors de l'export PDF");
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
    const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;

    let hasVAT = false;
    let hasPayment = false;
    let amountLabel = 'Montant';

    // Custom operations
    if (type.startsWith('custom_')) {
      const id = parseInt(type.split('_')[1]);
      const op = customOperations.find(o => o.id === id);
      if (op) {
        hasVAT = op.entries_template.some((t: any) => t.type === 'tva');
        hasPayment = op.entries_template.some((t: any) => t.type === 'payment');
      }
    } else {
      // Standard operations
      switch (type) {
        case 'vente_marchandises':
        case 'vente_services':
        case 'achat_marchandises':
        case 'achat_services':
        case 'frais_generaux':
          hasVAT = true;
          hasPayment = true;
          amountLabel = 'Montant HT';
          break;
        case 'charges_a_payer':
          hasVAT = true;
          hasPayment = false;
          amountLabel = 'Montant HT';
          break;
        case 'amortissement':
        case 'charges_constatees_avance':
        case 'produits_constates_avance':
          hasVAT = false;
          hasPayment = false;
          amountLabel = 'Montant';
          break;
        case 'appel_capital':
          hasVAT = false;
          hasPayment = false;
          amountLabel = 'Montant appelé';
          break;
        case 'constitution_capital':
          hasVAT = false;
          hasPayment = false;
          amountLabel = 'Capital Total';
          break;
        case 'augmentation_capital':
          hasVAT = false;
          hasPayment = false;
          amountLabel = 'Montant Augmentation';
          break;
        case 'liberation_capital':
          hasVAT = false;
          hasPayment = true;
          amountLabel = 'Montant libéré';
          break;
        case 'paiement_salaire':
          hasVAT = false;
          hasPayment = true;
          amountLabel = 'Salaire Net';
          break;
        case 'paiement_impot':
          hasVAT = false;
          hasPayment = true;
          amountLabel = 'Montant Impôt';
          break;
        case 'retrait_banque':
        case 'depot_banque':
        case 'pret_bancaire':
        case 'encaissement_client':
        case 'paiement_fournisseur':
          hasVAT = false;
          hasPayment = true;
          amountLabel = 'Montant';
          break;
        default:
          hasVAT = true;
          hasPayment = true;
          amountLabel = 'Montant';
      }
    }

    if (!taxesEnabled) {
      hasVAT = false;
      if (amountLabel === 'Montant HT') {
        amountLabel = 'Montant TTC';
      }
    }

    return { hasVAT, hasPayment, amountLabel };
  };

  const formConfig = getFormConfig(operationType);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const handleGenerateInvoice = async (id: number) => {
    const confirmed = await confirm("Voulez-vous générer une facture à partir de cette transaction ? Les détails du client et les montants seront pré-remplis.");
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/transactions/${id}/generate-invoice`, {
        method: 'POST'
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la génération de la facture");
      }

      try {
        const invRes = await apiFetch(`/api/invoices/${data.id}`);
        const setRes = await apiFetch('/api/company/settings');
        
        if (invRes.ok && setRes.ok) {
           const invoice = await invRes.json();
           const settings = await setRes.json();
           
           const { buildInvoicePDF } = await import('../lib/exportUtils');
           const doc = await buildInvoicePDF(invoice, settings);
           const pdfBlob = doc.output('blob');
           
           const formData = new FormData();
           formData.append('files', pdfBlob, `Facture_${invoice.number}.pdf`);
           
           await apiFetch(`/api/transactions/${id}/attachments`, {
             method: 'POST',
             body: formData
           });
        }
      } catch (attErr) {
        console.error('Erreur attachement facture:', attErr);
      }

      dialogAlert(`Facture ${data.number} générée avec succès et jointe à l'écriture.`, 'success');
      fetchTransactions();
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la génération de la facture", 'error');
    }
  };

  const handleBulkValidate = async () => {
    const confirmed = await confirm("Voulez-vous vraiment valider ces enregistrements ?");
    if (!confirmed) return;

    try {
      const res = await apiFetch('/api/transactions/bulk-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });
      
      if (res.ok) {
        fetchTransactions();
        setSelectedIds([]);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la validation");
      }
    } catch (err) {
      console.error(err);
      dialogAlert(err instanceof Error ? err.message : "Erreur lors de la validation", 'error');
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm(t('common.confirm_delete'));
    if (!confirmed) return;

    try {
      const res = await apiFetch('/api/transactions/bulk-delete', {
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative space-y-6"
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-brand-green/10 backdrop-blur-md flex justify-center p-8 pointer-events-none items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4"
          >
            <div className="w-full max-w-2xl aspect-video border-4 border-dashed border-brand-green rounded-[3rem] flex flex-col items-center justify-center gap-6 bg-white/80 dark:bg-slate-900/80 shadow-2xl animate-in zoom-in duration-300">
              <div className="p-8 bg-brand-green/20 text-brand-green rounded-full animate-bounce">
                <Upload size={64} />
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Déposez votre facture ici</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Ory va l'analyser instantanément</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        title="Journal Intelligent"
        subtitle="Saisie simplifiée & conforme SYSCOHADA"
        icon={<BookOpen size={24} />}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {selectedIds.length > 0 && (
              <>
                <button 
                  onClick={handleBulkValidate}
                  className="bg-brand-green/10 dark:bg-brand-green/20 border border-brand-green/20 dark:border-brand-green/30 text-brand-green dark:text-brand-green hover:bg-brand-green/20 dark:hover:bg-brand-green/30 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Check size={18} />
                  <span className="hidden md:inline">Valider ({selectedIds.length})</span>
                  <span className="md:hidden">Valider</span>
                </button>
                <button 
                  onClick={handleBulkDelete}
                  className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Trash2 size={18} />
                  <span className="hidden md:inline">Supprimer ({selectedIds.length})</span>
                  <span className="md:hidden">{selectedIds.length}</span>
                </button>
              </>
            )}
            <div className="hidden sm:flex bg-white dark:bg-slate-900 rounded-xl p-1 border border-slate-200 dark:border-slate-800 shadow-sm">
              <button 
                onClick={handleImportExcel}
                className="hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-500 p-2 rounded-lg transition-colors"
                title="Importer Excel"
              >
                <Plus size={18} />
              </button>
              <input 
                type="file" 
                ref={importInputRef} 
                onChange={onImportFileChange} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />
              <button 
                onClick={handleExportExcel}
                className="hover:bg-slate-50 dark:hover:bg-slate-800 text-brand-green p-2 rounded-lg transition-colors"
                title="Exporter Excel"
              >
                <FileSpreadsheet size={18} />
              </button>
              <button 
                onClick={handleExportPDF}
                className="hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 p-2 rounded-lg transition-colors"
                title="PDF"
              >
                <Download size={18} />
              </button>
            </div>
            
            <button 
              onClick={handleScanButtonClick}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Wand2 size={18} className="text-brand-gold" />
              <span className="hidden md:inline">Scanner</span>
            </button>
            
            <button 
              onClick={() => openNewModal()}
              className="bg-brand-green text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 whitespace-nowrap active:scale-95"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Saisie Manuelle</span>
              <span className="sm:hidden">Saisie</span>
            </button>
          </div>
        }
      />

      {missingCapital && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm -mt-2 mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
        >
          <div className="flex gap-3">
            <div className="text-amber-500 mt-1"><AlertCircle size={24} /></div>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-200">Capital de départ manquant</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Il semble que votre journal ne contienne pas l'enregistrement de votre capital de départ. Il s'agit généralement de la première écriture de votre entreprise.
              </p>
            </div>
          </div>
          <button 
            onClick={() => openNewModal('constitution_capital')}
            className="whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
          >
            Saisir le capital
          </button>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3 relative z-10">
        <button onClick={() => openNewModal('vente_marchandises')} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl flex items-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-900/30">
          <Plus size={14} /> Nouvelle Vente
        </button>
        <button onClick={() => openNewModal('achat_marchandises')} className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-100 dark:border-emerald-900/30">
          <Plus size={14} /> Nouvel Achat
        </button>
        <button onClick={() => openNewModal('frais_generaux')} className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors border border-amber-100 dark:border-amber-900/30">
          <Plus size={14} /> Nouvelle Dépense
        </button>
      </div>

      {/* Magic Input */}
      <form onSubmit={handleMagicSubmit} className="relative z-10 pt-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-green mb-2 block flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
          Saisie Express
        </label>
        <div className="relative group">
          <input 
            type="text" 
            ref={magicInputRef}
            value={magicInput}
            onChange={(e) => setMagicInput(e.target.value)}
            placeholder="Dictez votre opération (ex: Consultation patient Koffi 15000 FCFA reçu par espèce...)"
            className="w-full bg-white dark:bg-slate-900 border-2 border-brand-green/30 focus:border-brand-green text-slate-900 dark:text-white rounded-2xl py-4 pl-14 pr-44 transition-all outline-none font-medium shadow-sm hover:shadow-md"
            disabled={isMagicLoading}
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-green">
            <Wand2 size={24} />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="button"
              onClick={startListening}
              disabled={isListening}
              className={`p-2 rounded-xl transition-all flex items-center justify-center ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-green hover:bg-brand-green/10'}`}
              title="Dicter l'opération"
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              type="submit"
              disabled={isMagicLoading || !magicInput.trim()}
              className="bg-brand-green text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-green/90 transition-all disabled:opacity-50"
            >
              {isMagicLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              <span className="hidden sm:inline">Créer</span>
            </button>
          </div>
        </div>
      </form>
      
      {/* Quick Suggestions / Templates */}
      <div className="flex flex-wrap gap-2 mt-2 items-center text-xs font-medium relative z-10">
        <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Rapide :</span>
        {[
          "Consultation patient 15000 FCFA par espèces", 
          "Achat de matériel médical 200000 FCFA par banque chez Laborex", 
          "Frais d'électricité cabinet 45000 FCFA par Orange Money",
          "Encaissement honoraires chirurgie 1200000 FCFA par virement"
        ].map((template, idx) => (
          <button 
            key={idx}
            onClick={() => setMagicInput(template)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-brand-green/10 hover:text-brand-green transition-all"
          >
            {template.substring(0, 30)}...
          </button>
        ))}
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
              <p className="text-xl font-black text-slate-900 dark:text-white font-display">
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
              <p className="text-xl font-black text-slate-900 dark:text-white font-display">{transactions.length}</p>
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

      {/* View Toggle */}
      <div className="w-full min-w-0 overflow-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
      <div className="flex bg-slate-100/50 dark:bg-slate-800/30 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-max sm:w-fit min-w-full sm:min-w-0">
        <button 
          onClick={() => setCurrentView('active')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            currentView === 'active' 
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <BookOpen size={14} />
          Opérations
        </button>
        <button 
          onClick={() => setCurrentView('trash')}
          className={cn(
            "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
            currentView === 'trash' 
              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
              : "text-slate-500 hover:text-rose-500"
          )}
        >
          <Trash2 size={14} />
          Corbeille
        </button>
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

          <div className="w-full min-w-0 overflow-auto flex bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800  no-scrollbar">
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
        <div className="w-full min-w-0 overflow-auto ">
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
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">Date</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">Libellé</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">Référence</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right whitespace-nowrap">Montant</th>
                <th className="px-4 sm:px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center whitespace-nowrap">Statut</th>
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
                    <td colSpan={7} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                        <div className="w-24 h-24 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center shadow-inner border border-slate-100 dark:border-slate-800">
                          <FileText size={40} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="space-y-2">
                           <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Aucune écriture trouvée</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Commencez par ajouter une nouvelle écriture manuellement, ou scannez une facture via l'IA.</p>
                        </div>
                        <button
                          onClick={() => openNewModal()}
                          className="mt-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:border-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10 hover:text-brand-green transition-all shadow-sm flex items-center gap-2"
                        >
                          <Plus size={16} /> 
                          Saisir une écriture
                        </button>
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
                      <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{tx.date}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{tx.description}</span>
                          {(tx.occasional_name || tx.third_party_name) && (
                            <span className="text-[9px] sm:text-[10px] font-black text-brand-green uppercase tracking-widest mt-0.5">
                              Tiers: {tx.occasional_name || tx.third_party_name}
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
                            {tx.creation_mode === 'guided' && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-brand-green uppercase tracking-widest bg-brand-green/10 px-1.5 py-0.5 rounded">
                                <Wand2 size={10} />
                                Guidé
                              </span>
                            )}
                            <span className="md:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {tx.reference}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{tx.reference || '-'}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-right whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 font-display">
                          {formatCurrency(tx.total_amount, tx.currency)}
                        </div>
                        {tx.currency && tx.currency !== baseCurrency && (
                          <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                            ≈ {formatCurrency(tx.total_amount * (tx.exchange_rate || 1), baseCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-5 text-center whitespace-nowrap">
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
                          {currentView === 'active' ? (
                            <>
                              {tx.status !== 'validated' ? (
                                <button 
                                  onClick={() => handleEdit(tx.id)}
                                  className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green-light hover:bg-brand-green/10 dark:hover:bg-brand-green/20 rounded-lg transition-colors"
                                  title="Modifier"
                                >
                                  <Pencil size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleReverse(tx.id)}
                                  className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                  title="Contre-passer"
                                >
                                  <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDuplicate(tx.id)}
                                className="hidden sm:block p-2 text-slate-400 dark:text-slate-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                title="Dupliquer"
                              >
                                <FilePlus size={16} />
                              </button>
                              {tx.status === 'validated' && !tx.invoice_number && (
                                <button 
                                  onClick={() => handleCreateInvoiceFromTransaction(tx.id)}
                                  className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-brand-gold dark:hover:text-brand-gold hover:bg-brand-gold/10 dark:hover:bg-brand-gold/20 rounded-lg transition-colors"
                                  title="Générer Facture"
                                >
                                  <Zap size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <button 
                              onClick={() => handleRestore(tx.id)}
                              className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green-light hover:bg-brand-green/10 dark:hover:bg-brand-green/20 rounded-lg transition-colors"
                              title="Restaurer"
                            >
                              <BookOpen size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          )}
                          {tx.status !== 'validated' && (
                            <button 
                              onClick={() => handleDelete(tx.id)}
                              className="p-1.5 sm:p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title={currentView === 'trash' ? "Supprimer définitivement" : "Supprimer"}
                            >
                              <Trash2 size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          )}
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
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        >
          <div className="mx-auto bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800/80 transition-all duration-300 relative">
            <div className="overflow-y-auto min-h-0 flex-1 custom-scrollbar">
              <div className="flex flex-col md:flex-row min-h-full">
            
            {/* Left Panel: Inputs */}
            <div className="flex-1 p-5 sm:p-6 lg:p-8 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 sm:p-4 bg-brand-green/10 text-brand-green rounded-2xl">
                    {analyzing ? <Loader2 className="animate-spin" size={24} /> : editingId ? <Pencil size={24} /> : <Calculator size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                      {analyzing ? "Analyse IA..." : editingId ? "Modifier l'écriture" : "Saisie Intelligente"}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conformité SYSCOHADA</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                    <Link
                      to="/ai-training"
                      className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 text-brand-green hover:bg-brand-green/10"
                      title="Voir comment l'IA apprend de vos corrections"
                    >
                      <Brain size={14} />
                      <span className="hidden lg:inline">Lab IA</span>
                    </Link>
                    {lastAiImage && (
                      <button
                        onClick={() => setShowImagePreview(!showImagePreview)}
                        className={cn(
                          "px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                          showImagePreview ? "bg-brand-green text-white shadow-lg" : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        <FileText size={14} />
                        {showImagePreview ? "Inputs" : "Aperçu"}
                      </button>
                    )}
                    <button 
                      onClick={() => setMode('guided')}
                      className={cn(
                        "px-6 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all", 
                        mode === 'guided' ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
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
                    {mode === 'expert' && (
                      <label 
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 ml-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border",
                          isAiAssistEnabled 
                            ? "bg-brand-gold/10 border-brand-gold/30 text-brand-gold shadow-sm"
                            : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:text-brand-gold hover:border-brand-gold/30"
                        )}
                        title="Activer la saisie assistée par l'IA pour trouver les bons comptes automatiquement"
                      >
                        <Wand2 size={12} className={cn(isAiAssistEnabled && "animate-pulse")} />
                        <span>IA Auto</span>
                        <div className="relative inline-block w-6 h-3 align-middle select-none ml-1">
                          <input 
                            type="checkbox" 
                            checked={isAiAssistEnabled}
                            onChange={(e) => setIsAiAssistEnabled(e.target.checked)}
                            className="absolute opacity-0 w-0 h-0"
                          />
                          <div className={cn("block overflow-hidden h-3 rounded-full transition-colors duration-300", isAiAssistEnabled ? "bg-brand-gold/50" : "bg-slate-300 dark:bg-slate-600")}></div>
                          <div className={cn("absolute top-[1px] left-[1px] w-2.5 h-2.5 rounded-full bg-white transition-transform duration-300 shadow", isAiAssistEnabled ? "translate-x-3" : "translate-x-0")}></div>
                        </div>
                      </label>
                    )}
                  </div>
                  <button 
                    onClick={() => handleModalClose()}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30"
                    title="Abandonner l'écriture"
                  >
                    <X size={14} />
                    <span className="hidden sm:inline">Abandonner</span>
                  </button>
                </div>
              </div>

                {mode === 'guided' && (
                  <div className="mb-8 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-slate-100 dark:border-slate-800 hidden-scrollbar">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Type d'opération</label>
                    <div className="w-full min-w-0 overflow-x-auto flex gap-3 pb-2 custom-scrollbar">
                      {allOperationTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setOperationType(type.id)}
                          className={cn(
                            "flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all group",
                            operationType === type.id 
                              ? "border-brand-green bg-brand-green text-white shadow-md shadow-brand-green/20 scale-105" 
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-brand-green/30 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
                          )}
                        >
                          <span className={cn(
                            "text-base transition-transform group-hover:scale-110",
                            operationType === type.id ? "grayscale-0" : "grayscale opacity-70"
                          )}>{type.icon}</span>
                          <span className="whitespace-nowrap">{type.label}</span>
                        </button>
                      ))}
                      <button 
                        onClick={() => setIsCustomOpModalOpen(true)}
                        className="flex-none flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-500 hover:border-brand-green hover:text-brand-green hover:bg-brand-green/5 transition-all shadow-sm"
                      >
                       <Settings size={14} /> <span className="text-xs font-bold uppercase tracking-widest">Gérer</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Common Fields */}
                  <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none font-bold shadow-sm text-sm",
                            errors.date ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-200 dark:border-slate-700"
                          )}
                        />
                        <div className="flex gap-2 mt-1.5 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              setDate(`${year}-${month}-${day}`);
                              if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                            }}
                            className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-md transition-colors border border-slate-200/50 dark:border-slate-700/50"
                          >
                            Aujourd'hui
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() - 1);
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              setDate(`${year}-${month}-${day}`);
                              if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                            }}
                            className="px-2 py-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-md transition-colors border border-slate-200/50 dark:border-slate-700/50"
                          >
                            Hier
                          </button>
                        </div>
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
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all outline-none font-bold shadow-sm text-sm"
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

                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end ml-1 mb-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé de l'opération</label>
                        <button
                          type="button"
                          onClick={() => setIsAutoDescription(!isAutoDescription)}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 border w-fit mx-0",
                            isAutoDescription
                              ? "bg-brand-green/10 border-brand-green/20 text-brand-green"
                              : "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
                          )}
                          title="Activer/Désactiver l'automatisation du libellé"
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", isAutoDescription ? "bg-brand-green animate-pulse" : "bg-slate-400")} />
                          {isAutoDescription ? "Automatique" : "Manuel"}
                        </button>
                      </div>
                      <button 
                        onClick={handleAISuggestion}
                        disabled={suggesting || !description || !amountHT}
                        className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-3 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-purple-100 dark:hover:bg-purple-900/40 flex items-center gap-1.5 disabled:opacity-50 transition-colors border border-purple-200/50 dark:border-purple-800/50"
                      >
                        {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        Suggestion IA
                      </button>
                    </div>
                    <input 
                      type="text" 
                      ref={descriptionInputRef}
                      value={description}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          amountInputRef.current?.focus({ preventScroll: true });
                        }
                      }}
                      onBlur={() => {
                        if (mode === 'guided' && description && !selectedThirdParty) {
                          const descLower = description.toLowerCase();
                          const type = ['vente_marchandises', 'vente_services', 'encaissement_client'].includes(operationType) ? 'client' :
                                      ['achat_marchandises', 'achat_services', 'frais_generaux', 'paiement_fournisseur', 'charges_a_payer'].includes(operationType) ? 'supplier' : null;
                          
                          if (type) {
                            const match = thirdParties.find(tp => tp.type === type && !!tp.name && descLower.includes(tp.name.toLowerCase()));
                            if (match) {
                              setSelectedThirdParty(match.account_code);
                            }
                          }
                        }
                      }}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setIsAutoDescription(false);
                        if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                      }}
                      placeholder="Ex: Facture d'achat de marchandises..."
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none font-bold text-base placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-sm",
                        errors.description ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-200 dark:border-slate-700"
                      )}
                    />
                    {errors.description && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1 font-bold uppercase tracking-tight">{errors.description}</p>}
                  </div>

                {/* OCR Items Display */}
                {lastAiPrediction?.items && lastAiPrediction.items.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-brand-green/5 dark:bg-brand-green/10 rounded-3xl border border-brand-green/10 dark:border-brand-green/20"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-brand-green/10 text-brand-green rounded-lg">
                          <FilePlus size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">Articles extraits par l'IA</span>
                          {lastAiPrediction.confidence !== undefined && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className={`w-1 h-1 rounded-full ${lastAiPrediction.confidence > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Confiance : {lastAiPrediction.confidence}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={applyDetailedItemsToEntries}
                        className="text-[9px] font-black uppercase tracking-widest bg-brand-green text-white px-3 py-1.5 rounded-xl shadow-lg shadow-brand-green/20 hover:scale-105 transition-transform"
                      >
                        Détailler les écritures
                      </button>
                    </div>
                    <div className="space-y-3">
                      {lastAiPrediction.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white/50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{item.description}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Qte: {item.quantity}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PU: {formatCurrency(item.unit_price, transactionCurrency)}</span>
                              {item.account_suggestion && (
                                <span className="text-[9px] font-black text-brand-green uppercase tracking-widest bg-brand-green/5 px-1.5 py-0.5 rounded">
                                  {item.account_suggestion}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900 dark:text-white font-display">
                              {formatCurrency(item.total, transactionCurrency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="p-3 bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total HT extrait</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(lastAiPrediction.amount_ht, transactionCurrency)}</div>
                      </div>
                      <div className="p-3 bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total TTC extrait</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(lastAiPrediction.amount_ttc, transactionCurrency)}</div>
                      </div>
                    </div>
                  </motion.div>
                )}

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
                    
                    <div className="w-full min-w-0 overflow-auto bg-white/80 dark:bg-slate-900/80 rounded-2xl p-4 border border-purple-100/50 dark:border-purple-900/20 shadow-sm ">
                      <table className="w-full text-[11px] min-w-[500px]">
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
                                  value={selectedThirdParty || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedThirdParty(val);
                                    const party = thirdParties.find(p => p.account_code === val);
                                    if (party && party.is_occasional) {
                                      setOccasionalName(party.name);
                                    } else {
                                      setOccasionalName('');
                                    }
                                  }}
                                  className="flex-1 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold"
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
                                  onClick={() => {
                                    setThirdPartyModalType(type);
                                    setIsThirdPartyModalOpen(true);
                                  }}
                                  className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 shadow-sm"
                                  title="Créer un nouveau tiers"
                                >
                                  <Plus size={14} /> Nouveau
                                </button>
                              </div>
                            </div>

                            {selectedTP && (
                              <div className="mx-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-300 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs",
                                    type === 'client' ? "bg-blue-50 text-blue-500" : "bg-brand-green/10 text-brand-green"
                                  )}>
                                    {selectedTP.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Solde Actuel</div>
                                    <div className={cn(
                                      "text-sm font-black",
                                      (selectedTP.balance || 0) > 0 ? "text-rose-500" : (selectedTP.balance || 0) < 0 ? "text-emerald-500" : "text-slate-500"
                                    )}>
                                      {formatCurrency(selectedTP.balance || 0, baseCurrency)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none mb-1">Compte</div>
                                  <div className="text-xs font-mono font-bold text-slate-500">{selectedTP.account_code}</div>
                                </div>
                              </div>
                            )}

                            {selectedTP?.is_occasional && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                              >
                                <label className="block text-[10px] font-black text-brand-green uppercase tracking-widest ml-1">
                                  Nom
                                </label>
                                <input
                                  type="text"
                                  value={occasionalName}
                                  onChange={(e) => setOccasionalName(e.target.value)}
                                  placeholder="Ex: Client de passage, Nom spécifique..."
                                  className="w-full px-4 py-3 rounded-xl border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10 text-slate-900 dark:text-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all outline-none font-bold text-sm"
                                />
                              </motion.div>
                            )}

                            {/* AI Suggestions for Accounts */}
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-3"
                            >
                              <div className="flex justify-between items-center ml-1">
                                <div className="flex items-center gap-2">
                                  <Wand2 size={12} className="text-brand-green" />
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Suggestions d'imputation
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAISuggestion}
                                  disabled={suggesting || !description || !amountHT}
                                  className="text-[10px] text-brand-green dark:text-brand-green-light font-black uppercase tracking-widest hover:underline flex items-center gap-1.5 disabled:opacity-50 disabled:no-underline"
                                >
                                  {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                  Suggestion IA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSuggestAccountHead(-1)}
                                  disabled={suggestingAccount !== null || !description}
                                  className="text-[10px] text-brand-gold dark:text-brand-gold font-black uppercase tracking-widest hover:underline flex items-center gap-1.5 disabled:opacity-50 disabled:no-underline"
                                >
                                  {suggestingAccount === -1 ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
                                  Imputer via IA
                                </button>
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
                                {suggestedAccounts.length > 0 ? (
                                  suggestedAccounts.map((s) => (
                                    <button
                                      key={s.account_code}
                                      type="button"
                                      onClick={() => setSelectedAccountOverride(s.account_code)}
                                      className={cn(
                                        "px-4 py-2 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-2",
                                        selectedAccountOverride === s.account_code
                                          ? "border-brand-green bg-brand-green text-white shadow-md"
                                          : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-green/30"
                                      )}
                                    >
                                      <span className="opacity-70">{s.account_code}</span>
                                      <span>{s.account_name}</span>
                                      {selectedAccountOverride === s.account_code && <Check size={10} />}
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic ml-1">Aucune suggestion disponible. Utilisez la suggestion IA.</p>
                                )}
                                
                                {selectedAccountOverride && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAccountOverride('')}
                                    className="px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1"
                                  >
                                    <X size={10} /> Réinitialiser
                                  </button>
                                )}
                              </div>

                              {aiSuggestion && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="p-4 rounded-2xl bg-brand-green/5 border border-brand-green/20 space-y-3"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <p className="text-xs font-bold text-brand-green flex items-center gap-2">
                                        <Check size={14} /> Suggestion IA générée
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {aiSuggestion.explanation}
                                      </p>
                                    </div>
                                    <div className="px-2 py-1 rounded-lg bg-brand-green/10 text-brand-green text-[10px] font-black">
                                      {Math.round(aiSuggestion.confidence * 100)}%
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Find the main account (usually the first one that isn't VAT or Treasury)
                                        const mainEntry = aiSuggestion.entries.find(e => 
                                          !e.account_code.startsWith('445') && 
                                          !e.account_code.startsWith('443') &&
                                          !['521', '571', '585', '401', '411'].includes(e.account_code)
                                        );
                                        if (mainEntry) {
                                          setSelectedAccountOverride(mainEntry.account_code);
                                        } else if (aiSuggestion.entries.length > 0) {
                                          setSelectedAccountOverride(aiSuggestion.entries[0].account_code);
                                        }
                                        setAiSuggestion(null);
                                      }}
                                      className="px-4 py-2 bg-brand-green text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-sm"
                                    >
                                      Appliquer le compte
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAiSuggestion(null)}
                                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                      Ignorer
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </motion.div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Financials */}
                    <div className="grid grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className={cn(!formConfig.hasVAT && "col-span-2", "space-y-3")}>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{formConfig.amountLabel}</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            ref={amountInputRef}
                            inputMode="decimal"
                            value={amountString}
                            placeholder="0 (ex: 25000 + 1250)"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const evaluated = evaluateMathExpression(amountString);
                                if (evaluated !== null) {
                                  setAmountHT(evaluated);
                                  setAmountString(String(evaluated));
                                }
                                (e.currentTarget.closest('.space-y-8')?.querySelector('button[className*="bg-slate-900"]') as HTMLElement)?.focus({ preventScroll: true });
                              }
                            }}
                            onBlur={() => {
                              const evaluated = evaluateMathExpression(amountString);
                              if (evaluated !== null) {
                                setAmountHT(evaluated);
                                setAmountString(String(evaluated));
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAmountString(val);
                              const parsed = Number(val);
                              if (!isNaN(parsed)) {
                                setAmountHT(parsed);
                              }
                              if (errors.amountHT) setErrors(prev => ({ ...prev, amountHT: '' }));
                            }}
                            className={cn(
                              "w-full pl-16 pr-5 py-3 rounded-xl border focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none font-black text-xl font-mono shadow-sm",
                              errors.amountHT ? "border-rose-500 bg-rose-50/50 dark:bg-rose-900/10" : "border-slate-200 dark:border-slate-700"
                            )}
                          />
                          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base pointer-events-none">
                            {transactionCurrency}
                          </div>
                        </div>
                        {transactionCurrency !== baseCurrency && amountHT > 0 && (
                          <div className="mt-1 flex items-center justify-end text-[10px] text-slate-400 font-bold uppercase tracking-tight mr-2">
                            ≈ {formatCurrency(amountHT * transactionExchangeRate, baseCurrency)}
                          </div>
                        )}
                        {errors.amountHT && <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-2 font-bold uppercase tracking-tight">{errors.amountHT}</p>}
                      </div>
                      {formConfig.hasVAT && (
                        <div className="space-y-3">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TVA (%)</label>
                          <select 
                            value={vatRate}
                            onChange={(e) => setVatRate(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all outline-none font-bold text-base shadow-sm"
                          >
                            <option value={18}>18% (Standard)</option>
                            <option value={10}>10% (Réduit)</option>
                            <option value={5}>5% (Super Réduit)</option>
                            <option value={2}>2% (Spécial)</option>
                            <option value={0}>0% (Exonéré)</option>
                          </select>
                        </div>
                      )}

                      {/* Amount Breakdown (HT / TVA / TTC) inline if hasVAT */}
                      {formConfig.hasVAT && amountHT > 0 && (
                        <div className="col-span-2 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex bg-white/50 dark:bg-slate-900/30 rounded-xl p-4 text-xs font-medium items-center justify-between shadow-inner">
                          <div className="flex flex-col items-start min-w-[120px]">
                            <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-[0.15em] mb-1 font-bold">Montant HT</span>
                            <span className="text-slate-700 dark:text-slate-300 font-mono text-base">{formatCurrency(amountHT, transactionCurrency)}</span>
                          </div>
                          <div className="text-slate-300 dark:text-slate-600 font-black">+</div>
                          <div className="flex flex-col items-center min-w-[120px]">
                            <span className="text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-[0.15em] mb-1 font-bold">TVA ({vatRate}%)</span>
                            <span className="text-amber-600 dark:text-amber-500 font-mono text-base">{formatCurrency(amountHT * (vatRate / 100), transactionCurrency)}</span>
                          </div>
                          <div className="text-slate-300 dark:text-slate-600 font-black">=</div>
                          <div className="flex flex-col items-end min-w-[120px]">
                            <span className="text-brand-green/80 uppercase text-[10px] tracking-[0.15em] mb-1 font-bold">Montant TTC</span>
                            <span className="text-brand-green font-mono font-black text-base">{formatCurrency(amountHT * (1 + vatRate / 100), transactionCurrency)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Mode */}
                    {formConfig.hasPayment && (
                      <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
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
                                  "flex-1 py-3.5 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border transition-all",
                                  paymentMode === pm
                                    ? "border-slate-900 dark:border-slate-600 bg-slate-900 dark:bg-slate-700 text-white shadow-md shadow-slate-900/10"
                                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
                                )}
                              >
                                {pm.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {paymentMode !== 'credit' && (
                          <div className="space-y-3 pt-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Compte de Trésorerie (Optionnel)
                            </label>
                            <select
                              value={selectedTreasuryAccount || ''}
                              onChange={(e) => setSelectedTreasuryAccount(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all outline-none font-bold text-sm shadow-sm"
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
                        {paymentMode === 'credit' && (
                          <div className="space-y-3 pt-2 animate-in slide-in-from-top-2">
                            <label className="block text-[10px] font-black text-brand-gold uppercase tracking-widest ml-1 flex items-center gap-1.5">
                              <Clock size={14} /> Date d'échéance (Optionnelle)
                            </label>
                            <input
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-brand-gold/30 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all outline-none font-bold shadow-sm"
                              min={date}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes & Documents */}
                    <div className="space-y-6 bg-slate-50/50 dark:bg-slate-800/30 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes & Observations</label>
                        <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ajoutez des détails supplémentaires sur cette opération..."
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all outline-none font-medium text-sm min-h-[100px] resize-none shadow-sm"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pièces Jointes</label>
                        <div className="space-y-3">
                          {/* Existing Attachments from Server */}
                          {existingAttachments.map((att) => (
                            <div key={att.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="text-brand-green shrink-0" size={20} />
                                <span className="text-xs font-bold text-brand-green truncate">{att.file_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => window.open(`/api/attachments/${att.id}`, '_blank')}
                                  className="p-2 text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                                  title="Voir le document"
                                >
                                  <ArrowRight size={16} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Pending Files to be Uploaded */}
                          {pendingFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 dark:bg-brand-gold/10">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <Upload className="text-brand-gold shrink-0" size={20} />
                                <span className="text-xs font-bold text-brand-gold truncate">{file.name} (En attente)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  title="Retirer"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Legacy Document URLs (from AI Scan or old data) */}
                          {documentUrls.filter(url => url.startsWith('data:')).map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-xl border border-brand-green/20 bg-brand-green/5 dark:bg-brand-green/10">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <Wand2 className="text-brand-green shrink-0" size={20} />
                                <span className="text-xs font-bold text-brand-green truncate">Scan IA #{idx + 1}</span>
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
                            onClick={() => {
                              setIsScanning(false);
                              fileInputRef.current?.click();
                            }}
                            className="w-full flex items-center justify-center gap-3 px-5 py-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10 transition-all group shadow-sm"
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
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-all rounded-[2rem] overflow-hidden shadow-sm mt-8">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl shadow-inner">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 dark:text-white leading-tight font-display">Saisie d'écritures</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Expert Comptable</p>
                        </div>
                        <div className={cn(
                          "ml-6 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm border",
                          isBalanced ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" : "bg-rose-50 dark:bg-rose-900/20 text-rose-500 border-rose-200 dark:border-rose-900/30 animate-pulse"
                        )}>
                          <div className={cn("w-2 h-2 rounded-full", isBalanced ? "bg-emerald-500" : "bg-rose-500")} />
                          {isBalanced ? 'Journal Équilibré' : 'Déséquilibré'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsFastEntryMode(!isFastEntryMode)}
                          className={cn(
                            "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shadow-sm",
                            isFastEntryMode 
                              ? "bg-brand-green text-white border-brand-green" 
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                          title="Activer la saisie rapide (Raccourci: Alt+S)"
                        >
                          <Zap size={14} className={cn(isFastEntryMode && "animate-pulse")} />
                          Rapide (Alt+S)
                        </button>
                        <button 
                          onClick={handleBalance}
                          disabled={isBalanced}
                          className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-2 border border-amber-200/50 dark:border-amber-900/50 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Équilibrer automatiquement l'écriture"
                        >
                          <Zap size={14} /> Équilibrer
                        </button>
                      </div>
                    </div>
                    
                    {errors.balance && (
                      <div className="m-4 p-4 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-xl text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest text-center shadow-sm">
                        {errors.balance}
                      </div>
                    )}
                    
                    <div className="p-0 overflow-x-auto">
                      {/* Table Header */}
                      <div className="grid grid-cols-[140px_1fr_140px_140px_50px] gap-3 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] min-w-[700px]">
                        <div>Compte *</div>
                        <div>Libellé Ligne (Optionnel)</div>
                        <div className="text-right text-brand-green/80">Débit</div>
                        <div className="text-right text-brand-gold/80">Crédit</div>
                        <div></div>
                      </div>
                      
                      {/* Lines */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 min-w-[700px]">
                        {entries.map((entry, idx) => (
                          <div key={idx} className="group px-6 py-4 hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
                            <div className="grid grid-cols-[140px_1fr_140px_140px_50px] gap-3 items-start">
                              <div className="relative group/account">
                                <input 
                                  placeholder="Ex: 4111" 
                                  list="expert-account-list"
                                  className={cn(
                                    "w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green shadow-sm",
                                    errors[`account_${idx}`] ? "border-rose-500 bg-rose-50/50" : "border-slate-200 dark:border-slate-700"
                                  )}
                                  value={entry.account_code || ''}
                                  onKeyDown={(e) => handleEntryKeyDown(e, idx, 'account')}
                                  onBlur={() => {
                                    if (isAiAssistEnabled && entry.account_code && !/^\d+$/.test(entry.account_code)) {
                                      handleSuggestAccountHead(idx, entry.account_code);
                                    }
                                  }}
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
                                {errors[`account_${idx}`] && <p className="text-[9px] text-rose-500 mt-2 font-bold uppercase tracking-tight">{errors[`account_${idx}`]}</p>}
                                <button
                                  type="button"
                                  onClick={() => handleSuggestAccountHead(idx)}
                                  disabled={suggestingAccount !== null || (!description && !entry.description)}
                                  className="absolute -left-10 top-3.5 p-1.5 bg-brand-gold/10 text-brand-gold rounded-lg hover:bg-brand-gold/20 transition-all shadow-sm hidden md:block"
                                  title="Suggérer un compte via l'IA"
                                >
                                  {suggestingAccount === idx ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                </button>
                              </div>
                              
                              <div>
                                <input
                                  placeholder="Libellé spécifique à cette ligne..."
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green shadow-sm placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                  value={entry.description || ''}
                                  onKeyDown={(e) => handleEntryKeyDown(e, idx, 'description')}
                                  onChange={(e) => {
                                    const newEntries = [...entries];
                                    newEntries[idx].description = e.target.value;
                                    setEntries(newEntries);
                                  }}
                                />
                                {accounts.find(a => a.code === entry.account_code) && (
                                  <div className="flex items-center gap-1.5 mt-2 overflow-hidden px-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest truncate">
                                      {accounts.find(a => a.code === entry.account_code)?.name}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div>
                                <input 
                                  placeholder="0" 
                                  type="number"
                                  inputMode="decimal"
                                  className={cn(
                                    "w-full px-4 py-3 rounded-xl border text-sm font-bold bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green text-right font-mono shadow-sm",
                                    errors[`amount_${idx}`] ? "border-rose-500 bg-rose-50/50" : "border-slate-200 dark:border-slate-700"
                                  )}
                                  value={isNaN(entry.debit) || entry.debit === 0 ? '' : entry.debit}
                                  onKeyDown={(e) => handleEntryKeyDown(e, idx, 'debit')}
                                  onChange={(e) => {
                                    const newEntries = [...entries];
                                    const val = Number(e.target.value);
                                    newEntries[idx].debit = val;
                                    if (val > 0) newEntries[idx].credit = 0;
                                    setEntries(newEntries);
                                    if (errors.balance) setErrors(prev => ({ ...prev, balance: '' }));
                                  }}
                                />
                              </div>

                              <div>
                                <input 
                                  placeholder="0" 
                                  type="number"
                                  inputMode="decimal"
                                  className={cn(
                                    "w-full px-4 py-3 rounded-xl border text-sm font-bold bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white transition-all outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green text-right font-mono shadow-sm",
                                    errors[`amount_${idx}`] ? "border-rose-500 bg-rose-50/50" : "border-slate-200 dark:border-slate-700"
                                  )}
                                  value={isNaN(entry.credit) || entry.credit === 0 ? '' : entry.credit}
                                  onKeyDown={(e) => handleEntryKeyDown(e, idx, 'credit')}
                                  onChange={(e) => {
                                    const newEntries = [...entries];
                                    const val = Number(e.target.value);
                                    newEntries[idx].credit = val;
                                    if (val > 0) newEntries[idx].debit = 0;
                                    setEntries(newEntries);
                                    if (errors.balance) setErrors(prev => ({ ...prev, balance: '' }));
                                  }}
                                />
                              </div>

                              <div className="flex justify-center items-center h-12 pt-1 border-slate-200">
                                <button 
                                  onClick={() => {
                                    if (entries.length > 2) {
                                      setEntries(entries.filter((_, i) => i !== idx));
                                    } else {
                                      dialogAlert("Une écriture doit avoir au moins 2 lignes.", 'info');
                                    }
                                  }}
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer Actions & Totals */}
                      <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center min-w-[700px]">
                        <button 
                          onClick={() => setEntries([...entries, { account_code: '', debit: 0, credit: 0, description: '' }])}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-brand-green hover:bg-brand-green/5 dark:hover:bg-brand-green/10 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                        >
                          <Plus size={16} /> Ajouter une ligne
                        </button>
                        
                        <div className="flex items-center gap-10 text-sm font-black mr-[70px]">
                          <div className="text-right flex flex-col gap-1 min-w-[120px]">
                            <span className="text-[9px] tracking-[0.2em] uppercase text-slate-400">Total Débit</span>
                            <span className="font-mono text-base text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                              {formatCurrency(entries.reduce((acc, e) => acc + (Number(e.debit) || 0), 0), transactionCurrency)}
                            </span>
                          </div>
                          <div className="text-xl text-slate-300 dark:text-slate-600 font-light translate-y-2">=</div>
                          <div className="text-right flex flex-col gap-1 min-w-[120px]">
                            <span className="text-[9px] tracking-[0.2em] uppercase text-slate-400">Total Crédit</span>
                            <span className="font-mono text-base text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                              {formatCurrency(entries.reduce((acc, e) => acc + (Number(e.credit) || 0), 0), transactionCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>

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
            <div className="w-full md:w-[400px] xl:w-[420px] bg-slate-50 dark:bg-slate-800/30 flex flex-col border-l border-slate-100 dark:border-slate-800 stretch">
              <div className="flex-1 p-5 sm:p-6 lg:p-8 pb-4 space-y-6">
                
                {lastAiImage && showImagePreview ? (
                  <div className="space-y-6 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Scanné</h3>
                      <button 
                        onClick={() => setShowImagePreview(false)}
                        className="text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline"
                      >
                        Voir Résumé
                      </button>
                    </div>
                    
                    <div className="relative group rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900 group">
                      {lastAiImage.startsWith('data:application/pdf') ? (
                        <iframe 
                          src={lastAiImage} 
                          title="Facture PDF"
                          className="w-full h-[500px]"
                        />
                      ) : (
                        <>
                          <img 
                            src={lastAiImage} 
                            alt="Facture" 
                            className="w-full h-auto object-contain cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-500"
                            onClick={() => window.open(lastAiImage, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white">
                              <Maximize size={24} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {lastAiPrediction && (
                      <div className="space-y-4">
                        {/* Compliance Score */}
                        {lastAiPrediction.compliance_score !== undefined && (
                          <div className={cn(
                            "p-5 rounded-[2rem] border-2 flex flex-col gap-3",
                            lastAiPrediction.compliance_score > 70 
                              ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/20" 
                              : "bg-amber-50/50 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20"
                          )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full animate-pulse",
                                  lastAiPrediction.compliance_score > 70 ? "bg-emerald-500" : "bg-amber-500"
                                )} />
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  lastAiPrediction.compliance_score > 70 ? "text-emerald-600" : "text-amber-600"
                                )}>Confiance AI</span>
                              </div>
                              <span className="text-xl font-black text-slate-900 dark:text-white font-display">
                                {lastAiPrediction.compliance_score}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${lastAiPrediction.compliance_score}%` }}
                                className={cn(
                                  "h-full transition-all duration-1000",
                                  lastAiPrediction.compliance_score > 70 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500"
                                )}
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic">
                              {lastAiPrediction.compliance_score > 70 
                                ? "Ce document semble conforme aux exigences fiscales OHADA (identifiants et taxes détectés)." 
                                : "Attention : certains éléments légaux semblent manquer ou sont peu lisibles."}
                            </p>
                          </div>
                        )}

                        {/* Additional Taxes */}
                        {lastAiPrediction.tax_details && lastAiPrediction.tax_details.length > 0 && (
                          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Taxes Additionnelles</span>
                            {lastAiPrediction.tax_details.map((tax, i) => (
                              <div key={i} className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">{tax.label}</span>
                                <span className="text-slate-900 dark:text-white font-black">{formatCurrency(tax.amount, transactionCurrency)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Calculator size={14} /> Résumé financier
                        </h3>
                        {lastAiImage && (
                          <button 
                            onClick={() => setShowImagePreview(true)}
                            className="text-[10px] font-black text-brand-green uppercase tracking-widest hover:underline flex items-center gap-1"
                          >
                            Voir Facture <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-500">Montant HT</span>
                          <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                            {formatCurrency(amountHT, transactionCurrency)}
                          </span>
                        </div>
                        {formConfig.hasVAT && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500">TVA ({vatRate}%)</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                              {formatCurrency(amountHT * (vatRate / 100), transactionCurrency)}
                            </span>
                          </div>
                        )}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Total TTC</span>
                            <span className="text-2xl font-black text-brand-green font-mono">
                              {formatCurrency(amountTTC, transactionCurrency)}
                            </span>
                          </div>
                          {transactionCurrency !== baseCurrency && (
                            <div className="text-right mt-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                ≈ {formatCurrency(amountTTC * transactionExchangeRate, baseCurrency)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={14} /> Aperçu comptable
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="col-span-1">Compte</span>
                          <span className="text-right">Débit</span>
                          <span className="text-right">Crédit</span>
                        </div>
                        <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                          {entries.map((e, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 text-[11px] items-center">
                              <span className="col-span-1 font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded text-center w-fit">
                                {e.account_code || '---'}
                              </span>
                              <span className="text-right font-black text-slate-900 dark:text-white">{e.debit > 0 ? formatCurrency(e.debit, transactionCurrency) : ''}</span>
                              <span className="text-right font-black text-slate-900 dark:text-white">{e.credit > 0 ? formatCurrency(e.credit, transactionCurrency) : ''}</span>
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
                              Diff: {formatCurrency(Math.abs(entries.reduce((acc, e) => acc + (Number(e.debit) - Number(e.credit)), 0)), transactionCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              </div>
              </div>
            </div>
            
            {/* STICKY FOOTER */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button onClick={clearForm} className="flex-1 sm:flex-none py-3 px-5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Effacer
                </button>
                <button onClick={() => handleModalClose()} className="flex-1 sm:flex-none py-3 px-5 bg-rose-50 dark:bg-rose-900/10 text-rose-500 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all shadow-sm border border-rose-100 dark:border-rose-900/30 flex items-center justify-center gap-2">
                  <X size={16} /> Annuler
                </button>
              </div>
              
              <button onClick={() => handleSave()} disabled={submitting || !isBalanced} className="w-full sm:w-[300px] bg-brand-green text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-3">
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                  {editingId ? "Enregistrer" : "Valider l'écriture"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Operation Modal */}
      {isCustomOpModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center p-4 animate-in fade-in duration-200 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
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
        <div className="fixed inset-0 z-[60] flex justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-200 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
                {selectedTransactionDetail.creation_mode === 'guided' && (
                  <div className="p-4 rounded-2xl bg-brand-green/5 border border-brand-green/20">
                    <span className="text-[10px] font-black text-brand-green uppercase tracking-widest block mb-1">Mode de Saisie</span>
                    <div className="flex items-center gap-2 text-brand-green">
                      <Wand2 size={16} />
                      <span className="text-sm font-bold">Guidé</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Journal Entries */}
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-brand-green rounded-full" />
                  Écritures Comptables
                </h3>
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="w-full min-w-0 overflow-auto ">
                    <table className="w-full text-left border-collapse min-w-[600px]">
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
                    const attachments = selectedTransactionDetail.attachments || [];
                    
                    if (attachments.length > 0) {
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {attachments.map((att) => (
                            <div key={att.id} className="relative group">
                              <div className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center transition-all group-hover:border-brand-green/50">
                                {att.file_type?.startsWith('image/') ? (
                                  <SafeImage 
                                    src={`/api/attachments/${att.id}`} 
                                    alt={att.file_name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <FileText size={48} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px]">{att.file_name}</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <a 
                                    href={`/api/attachments/${att.id}`} 
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
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-3 flex-wrap">
              <button 
                onClick={() => {
                  setIsDetailOpen(false);
                  handleDuplicate(selectedTransactionDetail.id);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all flex items-center gap-2 border border-purple-200 dark:border-purple-800/50"
              >
                <Copy size={16} />
                Dupliquer
              </button>
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
              {selectedTransactionDetail.status !== 'validated' ? (
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
              ) : (
                <button 
                  onClick={() => {
                    setIsDetailOpen(false);
                    handleReverse(selectedTransactionDetail.id);
                  }}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  Contre-passer
                </button>
              )}
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

      {/* Pre-Import Validation Modal */}
      {isImportValidationModalOpen && (
        <div className="fixed inset-0 z-[70] flex justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all animate-in fade-in duration-300 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Validation Pré-Import</h2>
                  <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                    Vérification des données CSV avant import définitif
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImportValidationModalOpen(false);
                  setPendingImportEntries([]);
                }}
                className="p-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 min-h-0 w-full space-y-6">
              {(() => {
                const unbalanced = pendingImportEntries.filter(e => Math.abs(e.lines.reduce((acc: number, l: any) => acc + l.debit, 0) - e.lines.reduce((acc: number, l: any) => acc + l.credit, 0)) > 0.01);
                
                const missingTax = pendingImportEntries.filter(e => {
                  const hasClass6or7 = e.lines.some((l: any) => l.account_code?.startsWith('6') || l.account_code?.startsWith('7'));
                  const hasVAT = e.lines.some((l: any) => l.account_code?.startsWith('445') || l.account_code?.startsWith('443'));
                  return hasClass6or7 && !hasVAT;
                });

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total des écritures</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{pendingImportEntries.length}</span>
                      </div>
                      <div className={cn("p-4 rounded-2xl border flex flex-col gap-2 transition-colors", unbalanced.length > 0 ? "border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10 text-rose-600" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10 text-emerald-600")}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Écritures déséquilibrées</span>
                        <span className="text-xl font-black">{unbalanced.length}</span>
                      </div>
                      <div className={cn("p-4 rounded-2xl border flex flex-col gap-2 transition-colors col-span-2", missingTax.length > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 text-amber-600" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10 text-emerald-600")}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Taxes potentielles manquantes</span>
                        <div className="flex items-center justify-between">
                          <span className="text-xl font-black">{missingTax.length}</span>
                          {missingTax.length > 0 && <span className="text-xs font-medium opacity-80">Comptes charges/produits sans compte de TVA associé</span>}
                        </div>
                      </div>
                    </div>

                    {unbalanced.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <AlertCircle size={16} className="text-rose-500" />
                          Déséquilibres détectés
                        </h4>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                              <tr>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-xs">Date</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-xs">Description</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 text-xs text-right">Différence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unbalanced.slice(0, 5).map((e, i) => {
                                const debit = e.lines.reduce((acc: number, l: any) => acc + l.debit, 0);
                                const credit = e.lines.reduce((acc: number, l: any) => acc + l.credit, 0);
                                return (
                                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                                    <td className="px-4 py-3">{e.date}</td>
                                    <td className="px-4 py-3 font-medium">{e.description}</td>
                                    <td className="px-4 py-3 text-right text-rose-500 font-bold">{Math.abs(debit - credit).toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                              {unbalanced.length > 5 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-3 text-center text-xs text-slate-500 italic">...et {unbalanced.length - 5} de plus</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
              <button 
                onClick={() => {
                  setIsImportValidationModalOpen(false);
                  setPendingImportEntries([]);
                }}
                className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmImportJournal}
                className="px-8 py-2.5 bg-brand-green text-white rounded-xl font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green/90 transition-all flex items-center gap-2"
              >
                <Check size={18} />
                Forcer l'importation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Invoice Preview Modal */}
      {isQuickInvoiceOpen && quickInvoiceData && (
        <div className="fixed inset-0 z-[70] flex justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all animate-in fade-in duration-300 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green">
                  <Zap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Génération Rapide</h2>
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

            <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0 w-full">
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
                  <div className="w-full min-w-0 overflow-auto ">
                    <table className="w-full text-left border-collapse min-w-[800px]">
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

            <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex gap-4">
              <button 
                onClick={() => {
                  setIsQuickInvoiceOpen(false);
                  navigate('/invoicing', { state: { prefill: quickInvoiceData.transaction } });
                }}
                className="flex-1 px-6 py-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3"
              >
                <Edit size={18} />
                Éditeur Complet
              </button>
              <button 
                onClick={handleConfirmQuickInvoice}
                disabled={submitting}
                className="flex-[2] px-6 py-4 bg-brand-green text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-brand-green-dark transition-all shadow-xl shadow-brand-green/20 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Confirmer la Génération
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal removed as it is now handled by DialogProvider */}
      
      <ThirdPartyFormModal
        isOpen={isThirdPartyModalOpen}
        onClose={() => setIsThirdPartyModalOpen(false)}
        type={thirdPartyModalType}
        onSuccess={async (newTP) => {
          await fetchThirdParties();
          setSelectedThirdParty(newTP.account_code);
          setOccasionalName(newTP.name);
        }}
      />
    </motion.div>
  );
}
