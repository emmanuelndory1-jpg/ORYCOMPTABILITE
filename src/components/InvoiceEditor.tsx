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
  Check
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { useDialog } from './DialogProvider';

interface ThirdParty {
  id: number;
  name: string;
  type: string;
  account_code: string;
  is_occasional?: boolean;
  payment_terms?: number;
}

interface InvoiceItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  account_code: string;
}

interface InvoiceEditorProps {
  type: 'invoice' | 'quote';
  id?: number;
  prefill?: any;
  onClose: () => void;
}

export function InvoiceEditor({ type, id, prefill, onClose }: InvoiceEditorProps) {
  const { confirm, alert: dialogAlert } = useDialog();
  const { currency: baseCurrency, exchangeRates, getExchangeRate, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [defaultOccasional, setDefaultOccasional] = useState<{ client: ThirdParty | null | undefined, supplier: ThirdParty | null | undefined }>({ client: undefined, supplier: undefined });
  const [selectedThirdParty, setSelectedThirdParty] = useState<ThirdParty | null>(null);
  const [showTPDropdown, setShowTPDropdown] = useState(false);
  const [tpSearch, setTpSearch] = useState('');
  const [occasionalName, setOccasionalName] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState(baseCurrency || 'FCFA');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, vat_rate: 18, account_code: '701' }
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
    fetchThirdParties();
    fetchAccounts();
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

    // VAT detection
    const vatEntry = prefill.entries.find((e: any) => e.account_code.startsWith('443'));
    const saleEntries = prefill.entries.filter((e: any) => e.account_code.startsWith('7'));
    
    let detectedVatRate = 18; // Default
    if (vatEntry && saleEntries.length > 0) {
      const vatAmount = Math.abs(vatEntry.credit - vatEntry.debit);
      const htAmount = Math.abs(saleEntries.reduce((acc: number, e: any) => acc + (e.credit - e.debit), 0));
      if (htAmount > 0) {
        // Round to nearest common VAT rate (0, 2, 5, 10, 18)
        const rawRate = (vatAmount / htAmount) * 100;
        const commonRates = [0, 2, 5, 10, 18];
        detectedVatRate = commonRates.reduce((prev, curr) => 
          Math.abs(curr - rawRate) < Math.abs(prev - rawRate) ? curr : prev
        );
      }
    }

    // Items from entries (usually 7xx accounts)
    if (saleEntries.length > 0) {
      const newItems = saleEntries.map((e: any) => ({
        description: e.description || prefill.description, // Use entry description if available
        quantity: 1,
        unit_price: Math.abs(e.credit - e.debit),
        vat_rate: detectedVatRate,
        account_code: e.account_code
      }));
      setItems(newItems);
    } else {
      // Fallback if no 7xx account found
      setItems([{
        description: prefill.description,
        quantity: 1,
        unit_price: prefill.total_amount,
        vat_rate: detectedVatRate,
        account_code: '701'
      }]);
    }
  };

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

  const fetchThirdParties = async () => {
    try {
      const res = await fetch('/api/third-parties?type=client');
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
      const res = await fetch('/api/accounts');
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
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDate(data.date);
        setDueDate(data.due_date);
        setNotes(data.notes || '');
        setTerms(data.terms || '');
        setCurrency(data.currency || 'FCFA');
        setExchangeRate(data.exchange_rate || 1);
        setOccasionalName(data.occasional_name || '');
        setItems(data.items.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
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
    setItems([...items, { description: '', quantity: 1, unit_price: 0, vat_rate: 18, account_code: '701' }]);
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

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const vatAmount = items.reduce((acc, item) => acc + (item.quantity * item.unit_price * (item.vat_rate / 100)), 0);
  const total = subtotal + vatAmount;

  const handleCreateTP = async (isOccasional: boolean = false) => {
    if (!tpSearch.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/third-parties', {
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
        transaction_id: prefill?.id
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
        alert(err.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau");
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
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
              {id ? 'Modifier' : 'Nouveau'} {type === 'invoice' ? 'Facture' : 'Devis'}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
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
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green font-bold">
                      {selectedThirdParty.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{selectedThirdParty.name}</div>
                      <div className="text-xs text-slate-500">Compte: {selectedThirdParty.account_code}</div>
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
                              handleCreateTP(false);
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom du client occasionnel (sur la facture)</label>
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
                <div className="col-span-5">Description de la prestation</div>
                <div className="col-span-1 text-center">Qté</div>
                <div className="col-span-2 text-right">Prix Unit. HT</div>
                <div className="col-span-1 text-center">TVA</div>
                <div className="col-span-2 text-center">Compte</div>
                <div className="col-span-1 text-right">Total HT</div>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start group p-4 md:p-0 bg-slate-50/50 md:bg-transparent rounded-2xl border border-slate-100 md:border-none">
                    <div className="col-span-1 md:col-span-5">
                      <label className="md:hidden block text-[10px] font-black text-slate-400 uppercase mb-1">Description</label>
                      <input 
                        type="text"
                        placeholder="Ex: Maintenance serveur mensuelle..."
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
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
                        {formatCurrency(item.quantity * item.unit_price, currency)}
                        {currency !== baseCurrency && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            ≈ {formatCurrency(item.quantity * item.unit_price * exchangeRate, baseCurrency)}
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
        </div>

        {/* Right Column: Settings & Totals */}
        <div className="space-y-6">
          {/* Dates & Reference */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Dates
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
                  value={dueDate}
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

          {/* Totals */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/20 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Récapitulatif Financier</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sous-total HT</span>
                <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">TVA Totale</span>
                <span className="font-medium">{formatCurrency(vatAmount, currency)}</span>
              </div>
              <div className="pt-4 border-t border-slate-800 flex justify-between items-end">
                <span className="text-sm font-bold text-brand-green uppercase tracking-wider">Total TTC</span>
                <span className="text-3xl font-black text-white">{formatCurrency(total, currency)}</span>
              </div>
              {currency !== baseCurrency && (
                <div className="pt-2 flex justify-between items-center text-xs text-slate-500 italic">
                  <span>Equivalent {baseCurrency}</span>
                  <span>{formatCurrency(total * exchangeRate, baseCurrency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Terms */}
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
                  placeholder="Notes visibles uniquement par vous..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green min-h-[80px] resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Conditions de règlement</label>
                <textarea 
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Conditions affichées sur le document..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-green min-h-[80px] resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
