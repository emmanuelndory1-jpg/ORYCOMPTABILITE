import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  User, 
  Calendar, 
  FileText, 
  Info,
  ChevronDown,
  Search,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';
import { buildInvoicePDF } from '@/lib/exportUtils';
import { FNELogo } from './FNELogo';
import { ThirdPartyFormModal } from './ThirdPartyFormModal';

interface ThirdParty {
  id: number;
  name: string;
  type: string;
  account_code: string;
  is_occasional?: boolean;
  payment_terms?: number;
  address?: string;
  tax_id?: string;
}

interface InvoiceItem {
  id?: number;
  inventory_item_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_rate?: number;
  vat_rate: number;
  account_code: string;
}

interface InvoiceEditorProps {
  type: 'invoice' | 'quote' | 'proforma';
  id?: number;
  prefill?: any;
  onClose: () => void;
}

export function InvoiceEditor({ type, id, prefill, onClose }: InvoiceEditorProps) {
  const { confirm, alert: dialogAlert } = useDialog();
  const { currency: baseCurrency, exchangeRates, getExchangeRate, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isThirdPartyModalOpen, setIsThirdPartyModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>('');
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [defaultOccasional, setDefaultOccasional] = useState<{ client: ThirdParty | null | undefined, supplier: ThirdParty | null | undefined }>({ client: undefined, supplier: undefined });
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdParty | null>(null);
  const [showTPDropdown, setShowTPDropdown] = useState(false);
  const [tpSearch, setTpSearch] = useState('');
  const [occasionalName, setOccasionalName] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const fetchInventory = async () => {
    try {
      const res = await apiFetch('/api/inventory');
      if (res.ok) setInventoryItems(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState(baseCurrency || 'FCFA');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [template, setTemplate] = useState<'classic' | 'minimal' | 'prestige'>('prestige');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, discount_rate: 0, vat_rate: 18, account_code: '701' }
  ]);

  useEffect(() => {
    if (!id && baseCurrency) {
      setCurrency(baseCurrency);
      setExchangeRate(1);
    }
  }, [baseCurrency, id]);

  useEffect(() => {
    if (!id && currency && baseCurrency && exchangeRates.length > 0) {
      const rate = getExchangeRate(currency, baseCurrency);
      setExchangeRate(rate);
    }
  }, [currency, baseCurrency, exchangeRates, id]);

  // Add selected third party account to the accounts list if not present
  useEffect(() => {
    if (selectedThirdParty && selectedThirdParty.account_code) {
      setAccounts(prev => {
        const exists = prev.some(a => a.code === selectedThirdParty.account_code);
        if (exists) return prev;
        return [...prev, { 
          code: selectedThirdParty.account_code, 
          name: `Compte Tiers: ${selectedThirdParty.name}` 
        }];
      });

      // Update due date based on payment terms
      if (!id) {
        const terms = selectedThirdParty.payment_terms || 30;
        const newDueDate = new Date(date);
        newDueDate.setDate(newDueDate.getDate() + terms);
        setDueDate(newDueDate.toISOString().split('T')[0]);
      }
    }
  }, [selectedThirdParty, date, id]);

  useEffect(() => {
    fetchCompanySettings();
    fetchThirdParties();
    fetchAccounts();
    fetchInventory();
    fetchDefaultOccasional();
    if (id) fetchInvoice();
  }, [id]);

  useEffect(() => {
    if (!id && prefill && thirdParties.length > 0 && defaultOccasional.client !== undefined) {
      handlePrefill();
    }
  }, [id, prefill, thirdParties, defaultOccasional]);

  const handlePrefill = () => {
    if (!prefill) return;

    setDate(prefill.date || new Date().toISOString().split('T')[0]);
    setNotes(prefill.notes || '');
    setCurrency(prefill.currency || baseCurrency || 'FCFA');
    setExchangeRate(prefill.exchange_rate || 1);
    setTemplate(prefill.template || 'prestige');

    // Try to find the client
    if (prefill.third_party_id) {
      const tp = thirdParties.find(p => p.id === prefill.third_party_id);
      if (tp) setSelectedThirdParty(tp);
    } else {
      const clientEntry = prefill.entries.find((e: any) => e.account_code.startsWith('411'));
      if (clientEntry) {
        // If we have occasional_name, it's likely a one-time client
        if (prefill.occasional_name) {
          setOccasionalName(prefill.occasional_name);
          if (defaultOccasional.client) {
            setSelectedThirdParty(defaultOccasional.client);
          }
        } else {
          // Try to find the third party by account code
          const tp = thirdParties.find(p => p.account_code === clientEntry.account_code);
          if (tp) setSelectedThirdParty(tp);
        }
      }
    }

    // VAT detection (443 for sales/revenue, 445 for purchases/expenses)
    const vatEntry = prefill.entries?.find((e: any) => e.account_code?.startsWith('443') || e.account_code?.startsWith('445'));
    const saleEntries = prefill.entries?.filter((e: any) => e.account_code?.startsWith('7')) || [];
    const purchaseEntries = prefill.entries?.filter((e: any) => e.account_code?.startsWith('6')) || [];
    
    let detectedVatRate = 18; // Default
    if (vatEntry) {
      const vatAmount = Math.abs((vatEntry.credit || 0) - (vatEntry.debit || 0));
      const baseEntries = saleEntries.length > 0 ? saleEntries : purchaseEntries;
      const baseAmount = Math.abs(baseEntries.reduce((acc: number, e: any) => acc + ((e.credit || 0) - (e.debit || 0)), 0));
      if (baseAmount > 0) {
        // Round to nearest common VAT rate (0, 2, 5, 10, 18)
        const rawRate = (vatAmount / baseAmount) * 100;
        const commonRates = [0, 2, 5, 10, 18];
        detectedVatRate = commonRates.reduce((prev, curr) => 
          Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
        );
      }
    }

    // Items from entries (usually 7xx accounts for sales, 6xx for purchases)
    if (saleEntries.length > 0) {
      const newItems = saleEntries.map((e: any) => ({
        description: e.description || prefill.description, // Use entry description if available
        quantity: 1,
        unit_price: Math.abs((e.credit || 0) - (e.debit || 0)),
        vat_rate: detectedVatRate,
        account_code: e.account_code
      }));
      setItems(newItems);
    } else if (purchaseEntries.length > 0) {
      const newItems = purchaseEntries.map((e: any) => ({
        description: e.description || prefill.description, // Use entry description if available
        quantity: 1,
        unit_price: Math.abs((e.credit || 0) - (e.debit || 0)),
        vat_rate: detectedVatRate,
        account_code: e.account_code
      }));
      setItems(newItems);
    } else {
      // Fallback if no 7xx or 6xx account found
      const computedTotal = prefill.total_amount || 
                            prefill.amount_ht || 
                            (prefill.entries?.reduce((sum: number, e: any) => sum + (e.debit || 0), 0) || 0);
      setItems([{
        description: prefill.description,
        quantity: 1,
        unit_price: computedTotal,
        vat_rate: detectedVatRate,
        account_code: '701'
      }]);
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

  const fetchThirdParties = async () => {
    try {
      const res = await apiFetch('/api/third-parties?type=client');
      if (res.ok) {
        const data = await res.json();
        setThirdParties(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        // Filter for revenue accounts (Class 7)
        setAccounts(data.filter((acc: any) => acc.code.startsWith('7')));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDate(data.date);
        setDueDate(data.due_date);
        setNotes(data.notes || '');
        setTerms(data.terms || '');
        setCurrency(data.currency || 'FCFA');
        setExchangeRate(data.exchange_rate || 1);
        setTemplate(data.template || 'prestige');
        setPaidAmount(data.paid_amount || 0);
        setOccasionalName(data.occasional_name || '');
        setItems(data.items.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_rate: i.discount || 0,
          vat_rate: i.vat_rate,
          account_code: i.account_code || '701'
        })));
        // Find third party
        const tp = thirdParties.find(t => t.id === data.third_party_id);
        if (tp) setSelectedThirdParty(tp);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, discount_rate: 0, vat_rate: 18, account_code: '701' }]);
  };

  const removeItem = async (index: number) => {
    if (items.length === 1) return;
    const confirmed = await confirm("Voulez-vous vraiment retirer cet article ?");
    if (confirmed) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    if (items.some(item => item.unit_price > 0)) {
      const rateFrom = getExchangeRate(currency, baseCurrency);
      const rateTo = getExchangeRate(newCurrency, baseCurrency);
      const conversionFactor = rateFrom / rateTo;
      
      setItems(items.map(item => ({
        ...item,
        unit_price: Math.round(item.unit_price * conversionFactor * 100) / 100
      })));
    }
    setCurrency(newCurrency);
  };

  const subtotal = items.reduce((acc, item) => {
    const lineGross = item.quantity * item.unit_price;
    const discount = lineGross * ((item.discount_rate || 0) / 100);
    return acc + (lineGross - discount);
  }, 0);
  const totalDiscount = items.reduce((acc, item) => {
    const lineGross = item.quantity * item.unit_price;
    return acc + (lineGross * ((item.discount_rate || 0) / 100));
  }, 0);
  const vatAmount = items.reduce((acc, item) => {
    const lineGross = item.quantity * item.unit_price;
    const discount = lineGross * ((item.discount_rate || 0) / 100);
    const lineNet = lineGross - discount;
    return acc + (lineNet * (item.vat_rate / 100));
  }, 0);
  const isFacture = type === 'invoice';
  const total = subtotal + vatAmount;

  const handlePdfPreview = async () => {
    try {
      const invoiceData = {
        type,
        number: id ? (prefill?.number || `DRAFT-N°${id}`) : 'BROUILLON',
        date,
        due_date: dueDate,
        status: 'draft',
        template,
        third_party_name: selectedThirdParty ? (selectedThirdParty.is_occasional ? (occasionalName || selectedThirdParty.name) : selectedThirdParty.name) : "CLIENT DESTINATAIRE",
        third_party_address: selectedThirdParty?.address || '',
        third_party_tax_id: selectedThirdParty?.tax_id || '',
        subtotal: subtotal,
        vat_amount: vatAmount,
        total_amount: total,
        paid_amount: paidAmount,
        notes,
        terms,
        items: items.map(item => ({
          description: item.description || "Ligne d'article",
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          discount: item.discount_rate || 0,
          vat_rate: item.vat_rate || 18,
          account_code: item.account_code || '701'
        }))
      };

      const doc = await buildInvoicePDF(invoiceData, companySettings);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfDataUri(url);
      setShowPdfModal(true);
    } catch (err) {
      console.error("Erreur de génération d'aperçu PDF", err);
      dialogAlert("Impossible de générer l'aperçu PDF", 'error');
    }
  };

  useEffect(() => {
    return () => {
      if (pdfDataUri && pdfDataUri.startsWith('blob:')) {
        URL.revokeObjectURL(pdfDataUri);
      }
    };
  }, [pdfDataUri]);

  const datesAndCurrencyPanel = (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Calendar size={16} />
        Dates & Devise
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Date d'émission</label>
          <input 
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Date d'échéance</label>
          <input 
            type="date"
            value={dueDate || ''}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Devise</label>
          <div className="flex gap-2">
            <select 
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green appearance-none font-bold"
            >
              <option value="FCFA">FCFA</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GNF">GNF</option>
              <option value="CDF">CDF</option>
            </select>
            {currency !== baseCurrency && (
              <input 
                type="number"
                step="0.000001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="w-24 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-green font-mono"
                title={`1 ${currency} = ? ${baseCurrency}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const totalsPanel = (
    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20 space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
        <span>Récapitulatif Financier</span>
        {paidAmount > 0 && (
          <span className="text-[10px] bg-brand-green/20 text-brand-green font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Avec Acompte
          </span>
        )}
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Sous-total HT</span>
          <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm text-emerald-400">
            <span>Remise totale</span>
            <span className="font-medium">- {formatCurrency(totalDiscount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">TVA Totale</span>
          <span className="font-medium">{formatCurrency(vatAmount, currency)}</span>
        </div>

        <div className="pt-3 border-t border-slate-800/60 flex justify-between items-center text-sm">
          <span className="text-slate-400">Total TTC brut</span>
          <span className="font-bold">{formatCurrency(total, currency)}</span>
        </div>

        {isFacture && (
          <div className="py-2.5 px-3 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-medium">Saisir un acompte ({currency}) :</span>
            <input 
              type="number"
              value={paidAmount || ''}
              placeholder="0"
              onChange={(e) => setPaidAmount(Math.max(0, Math.min(total, parseFloat(e.target.value) || 0)))}
              className="w-28 px-2 py-1 bg-slate-900 border border-slate-750 rounded-lg text-right text-white font-mono font-black focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Règlement final</span>
            <span className="text-sm font-black text-brand-green uppercase tracking-wider block">
              {paidAmount > 0 ? 'Reste à payer' : 'Net à payer'}
            </span>
          </div>
          <span className="text-3xl font-black text-white font-mono tracking-tight">
            {formatCurrency(total - paidAmount, currency)}
          </span>
        </div>
        
        {currency !== baseCurrency && (
          <div className="pt-2 flex justify-between items-center text-xs text-slate-500 italic">
            <span>Equivalent {baseCurrency} (Reste)</span>
            <span>{formatCurrency((total - paidAmount) * exchangeRate, baseCurrency)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const designPanel = (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
        <FileText size={16} />
        Style & Template
      </h3>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Modèle de Document</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'classic', label: 'Classique', desc: 'Professionnel & Sobre' },
            { id: 'minimal', label: 'Minimaliste', desc: 'Design Épuré Moderne' },
            { id: 'prestige', label: 'Prestige Luxe', desc: 'Brillance de Or & Chic' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id as any)}
              className={cn(
                "p-3 rounded-xl border text-left flex flex-col justify-between transition-all",
                template === t.id 
                  ? "border-brand-green bg-brand-green/5 text-brand-green ring-1 ring-brand-green" 
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
              )}
            >
              <span className="text-xs font-black leading-none block mb-1">{t.label}</span>
              <span className="text-[9px] text-slate-400 leading-none block">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const notesAndTermsPanel = (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Info size={16} />
        Notes & Conditions
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Notes internes</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes internes visibles uniquement par vous..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green min-h-[80px] resize-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Conditions de règlement</label>
          <textarea 
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Conditions affichées sur le document..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-705 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green min-h-[80px] resize-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: 'Paiement comptant', value: 'Paiement comptant dès réception de facture.' },
              { label: 'Acompte 50%', value: 'Acompte de 50% à la commande, solde de 50% à la livraison.' },
              { label: 'Net 30 Jours', value: 'Règlement à 30 jours nets date de facture.' },
              { label: '30% Commande, 70% Livraison', value: 'Conditions de règlement : 30% d\'acompte exigible à la commande, 70% à la réception finale.' }
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTerms(p.value);
                  if (p.value.includes('comptant')) {
                    setDueDate(date);
                  } else if (p.value.includes('30 jours')) {
                    const newDueDate = new Date(date);
                    newDueDate.setDate(newDueDate.getDate() + 30);
                    setDueDate(newDueDate.toISOString().split('T')[0]);
                  }
                }}
                className="text-[10px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 rounded-lg transition-colors font-medium cursor-pointer"
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const handleCreateTP = async (isOccasional: boolean = false) => {
    if (!tpSearch.trim()) return;
    
    setSaving(true);
    try {
      const res = await apiFetch('/api/third-parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpSearch,
          type: 'client',
          payment_terms: 30,
          is_occasional: isOccasional
        })
      });
      
      if (res.ok) {
        const newTP = await res.json();
        setThirdParties(prev => [...prev, newTP]);
        setSelectedThirdParty(newTP);
        setTpSearch('');
        setShowTPDropdown(false);
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de la création du client", 'error');
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur réseau", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedThirdParty) {
      dialogAlert("Veuillez sélectionner un client", 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type,
        date,
        due_date: dueDate,
        third_party_id: selectedThirdParty.id,
        occasional_name: selectedThirdParty.is_occasional ? occasionalName : null,
        notes,
        terms,
        items,
        currency,
        exchange_rate: exchangeRate,
        transaction_id: prefill?.id,
        template,
        paid_amount: paidAmount
      };

      const url = id ? `/api/invoices/${id}` : '/api/invoices';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onClose();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const filteredTPs = thirdParties.filter(tp => 
    tp.name.toLowerCase().includes(tpSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1 min-h-0 overflow-y-auto w-full p-4 sm:p-6 custom-scrollbar">
      <datalist id="inventoryList">
        {inventoryItems.map(item => <option key={item.id} value={`${item.reference} - ${item.name}`} />)}
      </datalist>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {id ? 'Modifier' : 'Nouveau'} {type === 'invoice' ? 'Facture' : type === 'quote' ? 'Devis' : 'Proforma'}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border flex items-center gap-2 transition-all active:scale-95",
              showPreview 
                ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/10"
                : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            )}
          >
            {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>Aperçu en direct</span>
          </button>
          <button 
            type="button"
            onClick={handlePdfPreview}
            className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border flex items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
          >
            <FileText size={16} />
            <span>Aperçu PDF</span>
          </button>
          <button 
            onClick={onClose}
            className="flex-1 sm:flex-none px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none bg-brand-green hover:bg-brand-green-light text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-1 gap-6",
        showPreview ? "lg:grid-cols-12" : "lg:grid-cols-3"
      )}>
        {/* Left Column: Details */}
        <div className={cn(
          "space-y-6",
          showPreview ? "lg:col-span-7" : "lg:col-span-2"
        )}>
          {/* Client Selection */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User size={16} />
              Informations Client
            </h3>
            
            <div className="relative">
              <button 
                onClick={() => setShowTPDropdown(!showTPDropdown)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-left transition-all",
                  selectedThirdParty ? "border-brand-green/30" : "border-slate-200 dark:border-slate-700"
                )}
              >
                {selectedThirdParty ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green font-bold">
                        {selectedThirdParty.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{selectedThirdParty.name}</div>
                        <div className="text-xs text-slate-500">Compte: {selectedThirdParty.account_code}</div>
                      </div>
                    </div>
                    {/* Display Balance */}
                    <div className="text-right ml-4 pr-2">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solde actuel</div>
                       <div className={cn(
                         "text-sm font-bold",
                         (selectedThirdParty as any).balance > 0 ? "text-rose-500" : (selectedThirdParty as any).balance < 0 ? "text-emerald-500" : "text-slate-500"
                       )}>
                         {formatCurrency((selectedThirdParty as any).balance || 0, baseCurrency)}
                       </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400">Sélectionner un client...</span>
                )}
                <ChevronDown size={20} className="text-slate-400" />
              </button>

              {showTPDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text"
                          placeholder="Rechercher un client..."
                          value={tpSearch}
                          onChange={(e) => setTpSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                          autoFocus
                        />
                      </div>
                      {tpSearch && !filteredTPs.some(tp => tp.name.toLowerCase() === tpSearch.toLowerCase()) && (
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsThirdPartyModalOpen(true);
                            }}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                          >
                            <Plus size={14} />
                            Standard
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTP(true);
                            }}
                            className="px-3 py-2 bg-brand-green text-white rounded-xl hover:bg-brand-green-light transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                          >
                            <Plus size={14} />
                            Nouveau
                          </button>
                        </div>
                      )}
                      {!tpSearch && defaultOccasional.client && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedThirdParty(defaultOccasional.client);
                            setShowTPDropdown(false);
                          }}
                          className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border border-amber-200/50"
                        >
                          <Plus size={14} />
                          Rapide
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {filteredTPs.map((tp) => (
                      <button
                        key={tp.id}
                        onClick={() => {
                          setSelectedThirdParty(tp);
                          setShowTPDropdown(false);
                          if (tp.is_occasional) {
                            setOccasionalName(tp.name);
                          } else {
                            setOccasionalName('');
                          }
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold",
                            tp.is_occasional ? "bg-amber-100 text-amber-600" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                          )}>
                            {tp.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-slate-900 dark:text-white">{tp.name}</div>
                              {tp.is_occasional && <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1 py-0.5 rounded uppercase tracking-widest">Occas.</span>}
                            </div>
                            <div className="text-xs text-slate-500">{tp.account_code}</div>
                          </div>
                        </div>
                        {selectedThirdParty?.id === tp.id && <Check size={18} className="text-brand-green" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedThirdParty?.is_occasional && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom</label>
                <input 
                  type="text"
                  placeholder="Ex: M. Jean Dupont..."
                  value={occasionalName}
                  onChange={(e) => setOccasionalName(e.target.value)}
                  className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-brand-green/30 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-green/10 transition-all font-bold"
                />
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                <div className="p-2 bg-brand-green/10 text-brand-green rounded-lg">
                  <FileText size={18} />
                </div>
                Détails des Articles
              </h3>
              <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-wider">
                {items.length} {items.length > 1 ? 'Articles' : 'Article'}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <div className="col-span-4">Description de la prestation</div>
                <div className="col-span-1 text-center">Qté</div>
                <div className="col-span-2 text-right">Prix Unit. HT</div>
                <div className="col-span-1 text-center">Remise %</div>
                {companySettings?.taxes_enabled !== false && <div className="col-span-1 text-center">TVA</div>}
                <div className="col-span-2 text-center">Compte</div>
                <div className="col-span-1 text-right">Total HT</div>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start group p-4 md:p-0 bg-slate-50/50 md:bg-transparent rounded-2xl border border-slate-100 md:border-none">
                    <div className="col-span-1 md:col-span-4">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Description</label>
                      <input 
                        type="text"
                        list="inventoryList"
                        placeholder="Ex: Maintenance serveur mensuelle..."
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(index, 'description', val);
                          // Auto fill price if matching inventory item
                          const matchedItem = inventoryItems.find(inv => inv.name === val || inv.reference === val || `${inv.reference} - ${inv.name}` === val);
                          if (matchedItem) {
                             if (item.unit_price === 0) updateItem(index, 'unit_price', matchedItem.unit_price);
                          }
                        }}
                        className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-medium"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Quantité</label>
                      <input 
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-center focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Prix Unit.</label>
                      <input 
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-right focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-mono font-bold"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Remise %</label>
                      <input 
                        type="number"
                        value={item.discount_rate || 0}
                        onChange={(e) => updateItem(index, 'discount_rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-center focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">TVA</label>
                      <select 
                        value={item.vat_rate}
                        onChange={(e) => updateItem(index, 'vat_rate', parseFloat(e.target.value))}
                        className="w-full px-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-center focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold appearance-none"
                      >
                        <option value={18}>18%</option>
                        <option value={10}>10%</option>
                        <option value={5}>5%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Compte</label>
                      <select 
                        value={item.account_code || '701'}
                        onChange={(e) => updateItem(index, 'account_code', e.target.value)}
                        className="w-full px-3 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all font-bold appearance-none"
                      >
                        {accounts.map(acc => (
                          <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                        ))}
                        {accounts.length === 0 && <option value="701">701 - Ventes</option>}
                      </select>
                    </div>
                    <div className="col-span-1 md:col-span-1 flex items-center gap-3">
                      <div className="flex-1 text-right font-black text-slate-900 dark:text-white py-3 font-mono text-base tracking-tighter">
                        {formatCurrency((item.quantity * item.unit_price) * (1 - (item.discount_rate || 0)/100), currency)}
                        {currency !== baseCurrency && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            ≈ {formatCurrency((item.quantity * item.unit_price) * (1 - (item.discount_rate || 0)/100) * exchangeRate, baseCurrency)}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => removeItem(index)}
                        className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all md:opacity-0 group-hover:opacity-100 active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={addItem}
                className="w-full py-5 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] text-slate-400 hover:text-brand-green hover:border-brand-green/30 hover:bg-brand-green/5 transition-all flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest"
              >
                <Plus size={20} />
                Ajouter une ligne de prestation
              </button>
            </div>
          </div>
          
          {/* Under split screen preview mode, render compact settings panels inline */}
          {showPreview && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
              {datesAndCurrencyPanel}
              {notesAndTermsPanel}
            </div>
          )}
        </div>

        {/* Right Column / Live paper view panel side */}
        <div className={cn(
          "space-y-6",
          showPreview ? "lg:col-span-5" : "space-y-6"
        )}>
          {showPreview ? (
            /* PROFESSIONAL LIVE PAPER SHEET PREVIEW */
            <div className="sticky top-6 bg-slate-50 dark:bg-slate-950 p-6 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl h-[calc(100vh-220px)] overflow-y-auto no-scrollbar space-y-8 font-sans text-[10px] text-slate-800 dark:text-slate-300">
               <div className="flex items-center justify-between pointer-events-none mb-2">
                  <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full">Aperçu en direct (Brouillon)</span>
                  <span className="text-[10px] font-mono text-slate-400">{type === 'invoice' ? 'FA-BROUILLON' : type === 'quote' ? 'DE-BROUILLON' : 'PRO-BROUILLON'}</span>
               </div>

               {/* Top Info */}
               <div className="flex flex-col md:flex-row justify-between items-start gap-4 text-left border-b border-dashed border-slate-200 dark:border-slate-850 pb-6">
                 <div className="space-y-1">
                   <h4 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase mb-1">{companySettings?.name || 'VOTRE COMPAGNIE'}</h4>
                   <p className="opacity-90">NCC : {companySettings?.fiscal_id || '21000652'}</p>
                   <p className="opacity-90">Régime d'imposition : RNI</p>
                   <p className="opacity-90">RCCM : {companySettings?.rccm || 'CI-ABJ-DRAFT'}</p>
                   <p className="opacity-90">Adresse : {companySettings?.address || 'ADJAMÉ'}</p>
                   <p className="opacity-95 pt-2">Date : {new Date(date).toLocaleDateString('fr-FR')}</p>
                   <p className="opacity-95">Mode : Virement/Espèces</p>
                 </div>

                 <div className="flex flex-col items-end w-full md:w-auto">
                   {/* FNE Visual block if type is invoice */}
                   {type === 'invoice' ? (
                     <div className="border border-amber-500/30 p-2 flex gap-3 items-center bg-white dark:bg-slate-900 rounded-xl shadow-sm">
                        {/* Removed QRCodeSVG */}
                        <div className="p-0.5 bg-slate-50 dark:bg-slate-950 rounded-md shrink-0 border border-slate-100 dark:border-slate-800">
                          <FNELogo className="h-10 w-10 text-slate-850" />
                        </div>
                        <div className="text-left font-sans">
                          <div className="text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none">FACTURE DE VENTE</div>
                          <div className="text-[11px] font-black text-slate-900 dark:text-white leading-tight">N° PROVISOIRE</div>
                          <div className="text-[8px] text-emerald-500 font-black uppercase leading-none mt-0.5">FNE NORMALISÉE</div>
                        </div>
                     </div>
                   ) : (
                     <div className="border border-blue-500/30 p-3 bg-blue-500/5 rounded-xl text-right">
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{type === 'quote' ? 'DEVIS DE COMMANDE' : 'FACTURE PROFORMA'}</div>
                        <div className="text-xs font-black text-slate-950 dark:text-white font-sans">N° PROVISOIRE</div>
                     </div>
                   )}
                 </div>
               </div>

               {/* Client Info block */}
               <div className="border border-slate-200 dark:border-slate-800 p-3 rounded-2xl bg-white dark:bg-slate-900 text-left">
                  <span className="text-[8px] uppercase tracking-widest font-black text-slate-400 block mb-1">CLIENT DESTINATAIRE</span>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    {selectedThirdParty ? (selectedThirdParty.is_occasional ? (occasionalName || selectedThirdParty.name) : selectedThirdParty.name) : 'Aucun client sélectionné'}
                  </p>
                  <p className="opacity-95">{selectedThirdParty?.address || 'Pas d\'adresse renseignée'}</p>
                  {selectedThirdParty?.tax_id && <p className="font-bold">NCC : {selectedThirdParty.tax_id}</p>}
               </div>

               {/* List of Prestatiions/Items */}
               <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                 <table className="w-full text-left text-[9px] border-collapse">
                   <thead>
                     <tr className="bg-slate-50 dark:bg-slate-800 uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                       <th className="p-2.5">Désignation</th>
                       <th className="p-2.5 text-right w-12">Qté</th>
                       <th className="p-2.5 text-right w-20">P.U. (HT)</th>
                       <th className="p-2.5 text-right w-16">TVA</th>
                       <th className="p-2.5 text-right w-24">Total (HT)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {items.map((item, idx) => {
                       const isFilled = item.description.trim() !== "";
                       return (
                         <tr key={idx} className={cn(!isFilled && "opacity-40")}>
                           <td className="p-2.5 font-bold text-slate-900 dark:text-white max-w-[12rem] break-words text-left">
                             {item.description || `Ligne d'article ${idx + 1}...`}
                           </td>
                           <td className="p-2.5 text-right">{item.quantity}</td>
                           <td className="p-2.5 text-right">{formatCurrency(item.unit_price, currency)}</td>
                           <td className="p-2.5 text-right">{item.vat_rate}%</td>
                           <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                             {formatCurrency(item.quantity * item.unit_price * (1 - (item.discount_rate || 0) / 100), currency)}
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>

               {/* Recap and Fiscality block */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-900 text-left">
                    <div className="text-[8px] uppercase tracking-wider font-extrabold text-slate-705 dark:text-slate-300 mb-1">Résumé Fiscalité de TVA</div>
                    <table className="w-full text-[8px] text-slate-600 dark:text-slate-400">
                       <thead>
                         <tr className="border-b border-slate-200 dark:border-slate-800 pb-1 font-bold">
                           <th className="text-left py-1">Catégorie</th>
                           <th className="text-right py-1">Base HT</th>
                           <th className="text-right py-1">Taxe</th>
                         </tr>
                       </thead>
                       <tbody>
                         {vatAmount > 0 ? (
                           <tr>
                             <td className="py-1">TVA Normale (18%)</td>
                             <td className="text-right py-1">{formatCurrency(subtotal, currency)}</td>
                             <td className="text-right py-1 font-bold">{formatCurrency(vatAmount, currency)}</td>
                           </tr>
                         ) : (
                           <tr>
                             <td className="py-1">TVA Taux Zéro (0%)</td>
                             <td className="text-right py-1">{formatCurrency(subtotal, currency)}</td>
                             <td className="text-right py-1 font-bold">{formatCurrency(0, currency)}</td>
                           </tr>
                         )}
                       </tbody>
                    </table>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-900 text-white flex flex-col justify-between shadow-lg">
                     <div className="space-y-1">
                        <div className="flex justify-between text-[8px] text-slate-400">
                           <span>Sous-total HT</span>
                           <span>{formatCurrency(subtotal, currency)}</span>
                        </div>
                        {totalDiscount > 0 && (
                           <div className="flex justify-between text-[8px] text-emerald-450">
                              <span>Remise</span>
                              <span>- {formatCurrency(totalDiscount, currency)}</span>
                           </div>
                        )}
                        <div className="flex justify-between text-[8px] text-slate-400">
                           <span>Montant TVA</span>
                           <span>{formatCurrency(vatAmount, currency)}</span>
                        </div>
                     </div>
                     <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between items-baseline">
                        <span className="text-[9px] font-bold text-brand-green uppercase tracking-widest">TOTAL TTC</span>
                        <span className="text-sm font-black text-white font-display leading-none">{formatCurrency(total, currency)}</span>
                     </div>
                  </div>
               </div>

               {/* Terms note */}
               {terms && (
                 <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-[9px] italic border-l-2 border-brand-green text-left border-slate-200">
                   {terms}
                 </div>
               )}
            </div>
          ) : (
            <>
              {datesAndCurrencyPanel}
              {designPanel}
              {totalsPanel}
              {notesAndTermsPanel}
            </>
          )}
        </div>
      </div>

      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/60 backdrop-blur-sm items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Prévisualisation PDF</h3>
                  <p className="text-[10px] text-slate-400 font-medium font-sans">Aperçu en temps réel tel qu'il sera généré pour l'export</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfDataUri}
                  download={`${type === 'invoice' ? 'Facture' : type === 'quote' ? 'Devis' : 'Proforma'}_Apercu.pdf`}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-green hover:bg-brand-green-light rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-brand-green/10"
                >
                  <Save size={14} />
                  Télécharger
                </a>
                <button
                  onClick={() => {
                    setShowPdfModal(false);
                    if (pdfDataUri) {
                      URL.revokeObjectURL(pdfDataUri);
                      setPdfDataUri('');
                    }
                  }}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* PDF Frame body */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 relative flex items-center justify-center">
              {pdfDataUri ? (
                <iframe
                  id="pdf-preview-iframe"
                  src={`${pdfDataUri}#toolbar=1&navpanes=0`}
                  className="w-full h-full rounded-2xl border-0 shadow-sm"
                  title="Aperçu du PDF"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Génération du document...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ThirdPartyFormModal
        isOpen={isThirdPartyModalOpen}
        onClose={() => setIsThirdPartyModalOpen(false)}
        type="client"
        onSuccess={async (newTP) => {
          await fetchThirdParties();
          setSelectedThirdParty(newTP);
          setTpSearch('');
        }}
      />
    </div>
  );
}
