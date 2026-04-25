import React, { useState, useEffect } from 'react';
import { 
  Building2, Car, Laptop, Armchair, Factory, FileCode, Map, Plus, 
  Calendar, Check, Loader2, Table, Save, AlertCircle, DollarSign,
  Repeat, X, Trash2, History, ChevronRight, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch as fetch } from '@/lib/api';
import { useFiscalYear } from '@/context/FiscalYearContext';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface Asset {
  id: number;
  name: string;
  type: string;
  purchase_price: number;
  vat_amount: number;
  total_price: number;
  acquisition_date: string;
  depreciation_duration: number;
  depreciation_method: 'linear' | 'declining';
  declining_coefficient?: number;
  status: string;
  accumulated_depreciation?: number;
  net_book_value?: number;
  account_code: string;
}

interface ScheduleItem {
  year: number;
  period: string;
  baseValue: number;
  depreciation: number;
  accumulatedDepreciation: number;
  remainingValue: number;
  isRecorded: boolean;
  type: 'annual' | 'monthly';
}

export function AssetsManager() {
  const { formatCurrency, currency, getCurrencyIcon } = useCurrency();
  const { activeYear } = useFiscalYear();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [detailedAsset, setDetailedAsset] = useState<Asset | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [recordingDep, setRecordingDep] = useState<string | null>(null);

  // Sale State
  const [sellingAsset, setSellingAsset] = useState<Asset | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [salePaymentMode, setSalePaymentMode] = useState('banque');

  // Form State
  const [type, setType] = useState('it');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [vatRate, setVatRate] = useState('18');
  const [paymentMode, setPaymentMode] = useState('banque');
  const [duration, setDuration] = useState('3');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [depMethod, setDepMethod] = useState<'linear' | 'declining'>('linear');
  const [depCoef, setDepCoef] = useState('');

  const [companySettings, setCompanySettings] = useState<any>(null);


  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/company/settings');
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/assets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailedAsset(data);
        setShowDetailPanel(true);
        fetchSchedule(id, scheduleType);
      }
    } catch (err) {
      console.error('Error fetching asset details:', err);
    }
  };

  const [scheduleType, setScheduleType] = useState<'annual' | 'monthly'>('annual');

  const fetchSchedule = async (assetId: number, type: 'annual' | 'monthly' = 'annual') => {
    setLoadingSchedule(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/depreciation-schedule?type=${type}`);
      const data = await res.json();
      setSchedule(data.schedule);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleRecordDepreciation = async (item: ScheduleItem) => {
    if (!selectedAsset) return;
    setRecordingDep(item.period);
    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}/record-depreciation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: item.type,
          period: item.period,
          amount: item.depreciation
        })
      });

      if (res.ok) {
        fetchSchedule(detailedAsset?.id || selectedAsset.id, scheduleType);
        if (detailedAsset) {
          fetchAssetDetails(detailedAsset.id);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRecordingDep(null);
    }
  };

  const [generatingAll, setGeneratingAll] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = async () => {
    try {
      const res = await fetch('/api/assets/pending-depreciations-count');
      const data = await res.json();
      setPendingCount(data.count);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchCompanySettings();
    fetchPendingCount();
  }, [activeYear?.id]);

  const handleGenerateAllMonthly = async () => {
    setGeneratingAll(true);
    try {
      const res = await fetch('/api/assets/generate-monthly-depreciations', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`${data.count} dotation(s) générée(s) avec succès.`);
        fetchAssets();
        fetchPendingCount();
      } else {
        alert(data.error || "Erreur lors de la génération");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !price) return;
    
    setSubmitting(true);
    const ht = Number(price);
    const tva = Math.round(ht * (Number(vatRate) / 100));
    const ttc = ht + tva;

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          purchase_price: ht,
          vat_amount: tva,
          total_price: ttc,
          acquisition_date: date,
          depreciation_duration: Number(duration),
          depreciation_method: depMethod,
          declining_coefficient: depMethod === 'declining' ? Number(depCoef) : null,
          payment_mode: paymentMode
        })
      });

      if (res.ok) {
        setIsCreating(false);
        fetchAssets();
        // Reset form
        setName('');
        setPrice('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSell = async () => {
    if (!sellingAsset || !salePrice || !saleDate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assets/${sellingAsset.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_date: saleDate,
          selling_price: Number(salePrice),
          payment_mode: salePaymentMode
        })
      });

      if (res.ok) {
        setSellingAsset(null);
        fetchAssets();
        setSalePrice('');
      } else {
        const data = await res.json();
        alert(data.error || "Erreur lors de la cession");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const assetTypes = [
    { id: 'building', label: 'Bâtiment', icon: Building2, duration: 20 },
    { id: 'vehicle', label: 'Véhicule', icon: Car, duration: 5 },
    { id: 'it', label: 'Matériel Informatique', icon: Laptop, duration: 3 },
    { id: 'furniture', label: 'Mobilier', icon: Armchair, duration: 10 },
    { id: 'industrial', label: 'Matériel Industriel', icon: Factory, duration: 10 },
    { id: 'software', label: 'Logiciel / Brevet', icon: FileCode, duration: 2 },
    { id: 'land', label: 'Terrain', icon: Map, duration: 0 },
  ];

  const getIcon = (typeId: string) => {
    const t = assetTypes.find(t => t.id === typeId);
    return t ? t.icon : Building2;
  };

  // Preview Calculation
  const previewHT = Number(price) || 0;
  const previewTVA = Math.round(previewHT * (Number(vatRate) / 100));
  const previewTTC = previewHT + previewTVA;
  const selectedType = assetTypes.find(t => t.id === type);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Immobilisations</h1>
          <p className="text-slate-500 dark:text-slate-400">Suivi des actifs et amortissements (SYSCOHADA)</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateAllMonthly}
            disabled={generatingAll}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 relative"
          >
            {generatingAll ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
            Générer les dotations du mois
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white dark:ring-slate-900 animate-bounce">
                {pendingCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-brand-green hover:bg-brand-green-light text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
          >
            <Plus size={18} /> Nouvelle Immobilisation
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">Acquisition d'Immobilisation</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Saisissez les détails pour générer l'écriture comptable.</p>
          </div>
          
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Type d'actif</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {assetTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setType(t.id);
                        setDuration(t.duration.toString());
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center",
                        type === t.id 
                          ? "bg-brand-green/10 border-brand-green text-brand-green ring-1 ring-brand-green" 
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-green/20 hover:bg-brand-green/5"
                      )}
                    >
                      <t.icon size={24} />
                      <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Details Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Libellé de l'immobilisation</label>
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Ordinateur Portable Dell XPS"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Prix d'achat HT</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {getCurrencyIcon(16)}
                    </div>
                    <input 
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Taux TVA (%)</label>
                  <select 
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  >
                    <option value="0">0% (Exonéré)</option>
                    <option value="18">18% (Standard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date d'acquisition</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Amortissement (ans)</label>
                  <input 
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    disabled={type === 'land'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Mode d'amortissement</label>
                  <select 
                    value={depMethod}
                    onChange={(e) => setDepMethod(e.target.value as 'linear' | 'declining')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  >
                    <option value="linear">Linéaire</option>
                    <option value="declining">Dégressif</option>
                  </select>
                </div>

                {depMethod === 'declining' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Coefficient</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={depCoef}
                      onChange={(e) => setDepCoef(e.target.value)}
                      placeholder={Number(duration) >= 7 ? "2.25" : Number(duration) >= 5 ? "1.75" : "1.25"}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Mode de Paiement</label>
                  <div className="flex gap-2">
                    {['banque', 'caisse', 'credit'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize",
                          paymentMode === mode 
                            ? "bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-600" 
                            : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                        )}
                      >
                        {mode === 'credit' ? 'Crédit Fournisseur' : mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col h-full">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FileCode size={20} className="text-blue-600 dark:text-blue-400" />
                Aperçu de l'écriture
              </h3>
              
              <div className="flex-1 space-y-4">
                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-sm font-mono space-y-2">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                    <span>Compte</span>
                    <span>Débit</span>
                    <span>Crédit</span>
                  </div>
                  
                  {/* Asset Line */}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">2xx</span>
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">Immobilisation</span>
                    </span>
                    <span className="text-brand-green">{formatCurrency(previewHT)}</span>
                    <span className="text-slate-300 dark:text-slate-700">-</span>
                  </div>

                  {/* VAT Line */}
                  {previewTVA > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300">4451</span>
                        <span className="text-slate-500 dark:text-slate-400">TVA s/ Immo</span>
                      </span>
                      <span className="text-brand-green">{formatCurrency(previewTVA)}</span>
                      <span className="text-slate-300 dark:text-slate-700">-</span>
                    </div>
                  )}

                  {/* Payment Line */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 border-dashed">
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {paymentMode === 'banque' ? (companySettings?.payment_bank_account || '521') : paymentMode === 'caisse' ? (companySettings?.payment_cash_account || '571') : '481'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {paymentMode === 'credit' ? 'Frs d\'invest.' : 'Trésorerie'}
                      </span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">-</span>
                    <span className="text-rose-600 dark:text-rose-400">{formatCurrency(previewTTC)}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  * Les comptes exacts (ex: 2441 pour matériel informatique) seront attribués automatiquement selon le plan comptable SYSCOHADA.
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting || !name || !price}
                  className="flex-[2] bg-brand-green hover:bg-brand-green-light disabled:opacity-50 text-white py-3 rounded-xl font-bold shadow-lg shadow-brand-green/20 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Actif</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Date Acq.</th>
                <th className="px-6 py-4 text-right">Valeur HT</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-green" /></td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">Aucune immobilisation enregistrée.</td></tr>
              ) : (
                assets.map((asset) => {
                  const Icon = getIcon(asset.type);
                  return (
                    <tr 
                      key={asset.id} 
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => fetchAssetDetails(asset.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                            <Icon size={20} />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">{asset.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{asset.account_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 capitalize">{asset.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(asset.acquisition_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {formatCurrency(asset.purchase_price)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase",
                          asset.status === 'active' ? "bg-brand-green/10 text-brand-green" : "bg-rose-100 text-rose-600"
                        )}>
                          {asset.status === 'active' ? 'En service' : asset.status === 'sold' ? 'Cédé' : asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                          {asset.status === 'active' && (
                            <button 
                              onClick={() => setSellingAsset(asset)}
                              className="text-amber-600 hover:text-amber-700 font-medium text-sm flex items-center gap-1"
                              title="Enregistrer la vente"
                            >
                              <DollarSign size={16} /> Céder
                            </button>
                          )}
                          {asset.depreciation_duration > 0 && (
                            <button 
                              onClick={() => {
                                setSelectedAsset(asset);
                                fetchSchedule(asset.id);
                              }}
                              className="text-brand-green hover:text-brand-green-light font-medium text-sm flex items-center gap-1"
                            >
                              <Table size={16} /> Amort.
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Side Panel */}
      <AnimatePresence>
        {showDetailPanel && detailedAsset && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailPanel(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-green/10 text-brand-green rounded-2xl">
                      {React.createElement(getIcon(detailedAsset.type), { size: 24 })}
                    </div>
                    <div>
                      <h2 className="font-bold text-xl text-slate-900 dark:text-white">{detailedAsset.name}</h2>
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Historique & Amortissements</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowDetailPanel(false)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <Plus size={24} className="rotate-45 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Basic Info Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Acquisition</span>
                      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                        <Calendar size={16} className="text-brand-green" />
                        {new Date(detailedAsset.acquisition_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Code Comptable</span>
                      <div className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        {detailedAsset.account_code}
                      </div>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={14} className="text-brand-green" />
                      Détails Financiers
                    </h3>
                    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Prix d'achat HT</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(detailedAsset.purchase_price)}</span>
                      </div>
                      <div className="p-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">TVA récupérable</span>
                        <span className="font-mono font-bold text-blue-600">{formatCurrency(detailedAsset.vat_amount)}</span>
                      </div>
                      <div className="p-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Prix TTC</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white text-lg">{formatCurrency(detailedAsset.total_price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Depreciation Summary */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <Repeat size={14} className="text-brand-green" />
                      Amortissement ({detailedAsset.depreciation_duration} ans)
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-brand-green/5 dark:bg-brand-green/10 p-3 rounded-xl border border-brand-green/20">
                        <span className="text-[10px] font-bold text-brand-green uppercase block mb-1">Amorti</span>
                        <div className="text-sm font-black text-brand-green">{formatCurrency(detailedAsset.accumulated_depreciation || 0)}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-100 dark:border-rose-800">
                        <span className="text-[10px] font-bold text-rose-600 uppercase block mb-1">VNC</span>
                        <div className="text-sm font-black text-rose-600">{formatCurrency(detailedAsset.net_book_value || 0)}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Méthode</span>
                        <div className="text-sm font-black text-slate-700 dark:text-slate-300 capitalize">{detailedAsset.depreciation_method}</div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule in Panel */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Calendrier d'amortissement</h3>
                      <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex gap-1">
                        <button
                          onClick={() => {
                            setScheduleType('annual');
                            fetchSchedule(detailedAsset.id, 'annual');
                          }}
                          className={cn(
                            "px-3 py-1 rounded text-[10px] font-black uppercase transition-all",
                            scheduleType === 'annual' ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                          )}
                        >
                          Annuel
                        </button>
                        <button
                          onClick={() => {
                            setScheduleType('monthly');
                            fetchSchedule(detailedAsset.id, 'monthly');
                          }}
                          className={cn(
                            "px-3 py-1 rounded text-[10px] font-black uppercase transition-all",
                            scheduleType === 'monthly' ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                          )}
                        >
                          Mensuel
                        </button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10">
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                              <th className="px-4 py-3">Période</th>
                              <th className="px-4 py-3 text-right">Dotation</th>
                              <th className="px-4 py-3 text-right">VNC</th>
                              <th className="px-4 py-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {schedule.map((item) => (
                              <tr key={item.period} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", item.isRecorded && "bg-brand-green/5")}>
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item.period}</td>
                                <td className="px-4 py-3 text-right font-mono text-brand-green font-bold">{formatCurrency(item.depreciation)}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-500">{formatCurrency(item.remainingValue)}</td>
                                <td className="px-4 py-3 text-center">
                                  {item.isRecorded ? (
                                    <Check size={16} className="text-brand-green mx-auto" />
                                  ) : (
                                    <button 
                                      onClick={() => handleRecordDepreciation(item)}
                                      disabled={recordingDep === item.period}
                                      className="p-1.5 text-slate-400 hover:text-brand-green transition-colors"
                                      title="Enregistrer manuellement"
                                    >
                                      {recordingDep === item.period ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                  <button 
                    onClick={() => setShowDetailPanel(false)}
                    className="px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all shadow-lg"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Sale Modal */}
      {sellingAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="font-bold text-xl text-slate-900 dark:text-white">Cession d'Immobilisation</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Enregistrer la vente de : <span className="font-semibold text-slate-700 dark:text-slate-300">{sellingAsset.name}</span></p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800 flex gap-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="flex-shrink-0" size={20} />
                <p>
                  Cette action générera les écritures de cession (Produit de cession et Sortie de l'actif) et marquera l'actif comme "Cédé".
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Date de cession</label>
                  <input 
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Prix de vente</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {getCurrencyIcon(16)}
                    </div>
                    <input 
                      type="number"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Mode de Règlement</label>
                <div className="flex gap-2">
                  {[
                    { id: 'banque', label: 'Banque' },
                    { id: 'caisse', label: 'Caisse' },
                    { id: 'credit', label: 'Créance Diverse' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setSalePaymentMode(mode.id)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                        salePaymentMode === mode.id 
                          ? "bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-600" 
                          : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              <button 
                onClick={() => setSellingAsset(null)}
                className="flex-1 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSell}
                disabled={submitting || !salePrice}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 rounded-xl font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Confirmer la vente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Depreciation Schedule Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h2 className="font-bold text-xl text-slate-900 dark:text-white">Tableau d'Amortissement</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedAsset.name} ({selectedAsset.depreciation_duration} ans) - 
                  <span className="capitalize font-semibold text-brand-green ml-1">
                    {selectedAsset.depreciation_method === 'declining' ? 'Dégressif' : 'Linéaire'}
                  </span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedAsset(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Plus size={24} className="rotate-45 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingSchedule ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-brand-green" size={48} />
                  <p className="text-slate-500 dark:text-slate-400">Calcul du tableau...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1">
                      <button
                        onClick={() => {
                          setScheduleType('annual');
                          fetchSchedule(selectedAsset.id, 'annual');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                          scheduleType === 'annual' ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        Annuel
                      </button>
                      <button
                        onClick={() => {
                          setScheduleType('monthly');
                          fetchSchedule(selectedAsset.id, 'monthly');
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                          scheduleType === 'monthly' ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        Mensuel
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Valeur d'Origine</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(selectedAsset.purchase_price)}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Taux Lineaire</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{(100 / selectedAsset.depreciation_duration).toFixed(2)}%</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Mode Actuel</span>
                      <span className="text-lg font-bold text-brand-green capitalize">{selectedAsset.depreciation_method === 'declining' ? `Dégressif (x${selectedAsset.declining_coefficient || (selectedAsset.depreciation_duration >= 7 ? 2.25 : selectedAsset.depreciation_duration >= 5 ? 1.75 : 1.25)})` : 'Linéaire'}</span>
                    </div>
                  </div>

                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold">
                        <tr>
                          <th className="px-4 py-3">Année</th>
                          <th className="px-4 py-3 text-right">Base</th>
                          <th className="px-4 py-3 text-right">Dotation</th>
                          <th className="px-4 py-3 text-right">Cumul</th>
                          <th className="px-4 py-3 text-right">VNC</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {schedule.map((item) => (
                          <tr key={item.period} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors", item.isRecorded && "bg-brand-green/5 dark:bg-brand-green/10")}>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{item.period}</td>
                            <td className="px-4 py-3 text-right font-mono dark:text-slate-400">{formatCurrency(item.baseValue)}</td>
                            <td className="px-4 py-3 text-right font-mono text-brand-green font-semibold">{formatCurrency(item.depreciation)}</td>
                            <td className="px-4 py-3 text-right font-mono dark:text-slate-400">{formatCurrency(item.accumulatedDepreciation)}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold dark:text-white">{formatCurrency(item.remainingValue)}</td>
                            <td className="px-4 py-3 text-center">
                              {item.isRecorded ? (
                                <span className="inline-flex items-center gap-1 text-brand-green font-bold text-xs uppercase">
                                  <Check size={14} /> Enregistré
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handleRecordDepreciation(item)}
                                  disabled={recordingDep === item.period}
                                  className="bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all flex items-center gap-1 mx-auto disabled:opacity-50"
                                >
                                  {recordingDep === item.period ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Enregistrer
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                    <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                      L'enregistrement d'une dotation génère automatiquement une écriture comptable : 
                      <strong className="block mt-1">Débit 681 (Dotations) / Crédit 28x (Amortissements)</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button 
                onClick={() => setSelectedAsset(null)}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
