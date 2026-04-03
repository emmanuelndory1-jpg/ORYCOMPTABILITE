import React, { useState, useEffect } from 'react';
import { Building2, Car, Laptop, Armchair, Factory, FileCode, Map, Plus, Calendar, Check, Loader2, Table, Save, AlertCircle } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface Asset {
  id: number;
  name: string;
  type: string;
  purchase_price: number;
  acquisition_date: string;
  depreciation_duration: number;
  status: string;
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [recordingDep, setRecordingDep] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState('it');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [vatRate, setVatRate] = useState('18');
  const [paymentMode, setPaymentMode] = useState('banque');
  const [duration, setDuration] = useState('3');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    fetchAssets();
    fetchCompanySettings();
  }, []);

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
        fetchSchedule(selectedAsset.id, scheduleType);
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
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-brand-green hover:bg-brand-green-light text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
        >
          <Plus size={18} /> Nouvelle Immobilisation
        </button>
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
                    <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                            <Icon size={20} />
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{asset.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 capitalize">{asset.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{new Date(asset.acquisition_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {formatCurrency(asset.purchase_price)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green uppercase">
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.depreciation_duration > 0 && (
                          <button 
                            onClick={() => {
                              setSelectedAsset(asset);
                              fetchSchedule(asset.id);
                            }}
                            className="text-brand-green hover:text-brand-green-light font-medium text-sm flex items-center gap-1 ml-auto"
                          >
                            <Table size={16} /> Tableau Amort.
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Depreciation Schedule Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h2 className="font-bold text-xl text-slate-900 dark:text-white">Tableau d'Amortissement</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedAsset.name} ({selectedAsset.depreciation_duration} ans)</p>
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
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Taux d'Amort.</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{(100 / selectedAsset.depreciation_duration).toFixed(2)}%</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">Annuité</span>
                      <span className="text-lg font-bold text-brand-green">{formatCurrency(selectedAsset.purchase_price / selectedAsset.depreciation_duration)}</span>
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
