import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Building, Save, Loader2, CreditCard, ShieldCheck, Users, Briefcase, MapPin, Receipt, Landmark, UploadCloud, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useModules } from '@/context/ModuleContext';
import { useOutletContext } from 'react-router-dom';

interface CompanySettings {
  id: number;
  name: string;
  legal_form: string;
  activity: string;
  fiscal_id: string;
  tax_regime: string;
  vat_regime: string;
  taxes_enabled?: boolean | number;
  currency: string;
  address: string;
  city: string;
  country: string;
  capital: number;
  manager_name: string;
  phone?: string;
  email?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  bank_swift?: string;
  payment_bank_enabled?: boolean;
  payment_bank_account?: string;
  payment_cash_enabled?: boolean;
  payment_cash_account?: string;
  payment_mobile_enabled?: boolean;
  payment_mobile_account?: string;
  cnps_employer_number?: string;
  tax_office?: string;
  rccm?: string;
  syscohada_system?: string;
  vat_rate?: number;
  logo_url?: string | null;
}

import { triggerCloudBackup } from '@/lib/backup';

export function CompanySettingsManager() {
  const { isActive, refreshModules } = useModules();
  const { refreshCompanySettings } = useOutletContext<{ refreshCompanySettings: () => Promise<void> }>();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingPayroll, setActivatingPayroll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/company/dossier');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des paramètres.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModule = async (key: string) => {
    setActivatingPayroll(true);
    try {
      const res = await apiFetch(`/api/company/modules/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 1 })
      });

      if (!res.ok) throw new Error('Failed to update module');
      
      await refreshModules();
      setSuccess("Module Paie activé avec succès !");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    } finally {
      setActivatingPayroll(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          legalForm: settings.legal_form,
          activity: settings.activity,
          fiscalId: settings.fiscal_id,
          taxRegime: settings.tax_regime,
          vatRegime: settings.vat_regime,
          currency: settings.currency,
          address: settings.address,
          city: settings.city,
          country: settings.country,
          capital: settings.capital,
          managerName: settings.manager_name,
          phone: settings.phone,
          email: settings.email,
          bank_name: settings.bank_name,
          bank_account_number: settings.bank_account_number,
          bank_iban: settings.bank_iban,
          bank_swift: settings.bank_swift,
          payment_bank_enabled: settings.payment_bank_enabled,
          payment_bank_account: settings.payment_bank_account,
          payment_cash_enabled: settings.payment_cash_enabled,
          payment_cash_account: settings.payment_cash_account,
          payment_mobile_enabled: settings.payment_mobile_enabled,
          payment_mobile_account: settings.payment_mobile_account,
          rccm: settings.rccm,
          syscohada_system: settings.syscohada_system,
          vat_rate: settings.vat_rate,
          cnps_employer_number: settings.cnps_employer_number,
          tax_office: settings.tax_office,
          logo_url: settings.logo_url
        })
      });

      if (res.ok) {
        setSuccess("Paramètres mis à jour avec succès.");
        await refreshCompanySettings();
        triggerCloudBackup().catch(e => console.error("Backup failed", e));
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Erreur lors de la sauvegarde.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  };

  const processImageFile = (file: File) => {
    setError(null);
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    const isValidFormat = validMimeTypes.includes(file.type) || validExtensions.includes(extension);

    if (!isValidFormat) {
      setError("Format de fichier non pris en charge. Veuillez choisir un fichier au format .jpg, .jpeg ou .png.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setError(null), 8000);
      return;
    }

    if (file.size > 1024 * 1024 * 5) {
      setError("Le fichier dépasse la taille maximale autorisée. Le logo ne doit pas dépasser 5 Mo.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setError(null), 8000);
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 512;
        let { width, height } = img;
        
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
          setSettings(prev => prev ? { ...prev, logo_url: dataUrl } : prev);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      // Reset input so the same file could be selected again if deleted
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  if (loading) return <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin text-brand-green mb-4" size={32} /><p className="text-slate-500">Chargement des paramètres...</p></div>;
  if (!settings) return <div className="p-8 text-center text-slate-500">Aucun paramètre trouvé.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Centre d'Information</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gérez le profil, l'identité et la configuration de votre entreprise.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-green hover:bg-brand-green-dark text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Enregistrer les modifications
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm border border-red-200 dark:border-red-900/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green-dark dark:text-brand-green-light rounded-xl text-sm border border-brand-green/20 dark:border-brand-green/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Core Info & Logo */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3">
              <Building2 className="text-brand-green" size={20} />
              <h2 className="font-bold text-slate-900 dark:text-white">Identité Visuelle</h2>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div 
                className={`relative w-48 h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all group cursor-pointer ${settings.logo_url ? 'border-brand-green/30 bg-brand-green/5' : 'border-slate-300 dark:border-slate-700 hover:border-brand-green/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => logoInputRef.current?.click()}
              >
                {settings.logo_url ? (
                  <>
                    <img src={settings.logo_url} alt="Logo preview" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium flex items-center gap-2"><UploadCloud size={16}/> Remplacer</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <div className="w-12 h-12 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-3">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliquer ou glisser</p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG (Max 5Mo)</p>
                  </div>
                )}
              </div>
              <input 
                ref={logoInputRef} 
                type="file" 
                className="hidden" 
                accept=".jpg,.jpeg,.png,image/jpeg,image/png" 
                onClick={(e) => e.stopPropagation()} 
                onChange={handleLogoUpload} 
              />
              {settings.logo_url && (
                <button 
                  type="button" 
                  onClick={() => setSettings({...settings, logo_url: null})}
                  className="mt-4 text-rose-500 text-sm font-medium hover:text-rose-600 transition-colors"
                >
                  Supprimer le logo
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3">
               <Briefcase className="text-indigo-500" size={20} />
               <h2 className="font-bold text-slate-900 dark:text-white">Informations Générales</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nom de l'entreprise</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                  value={settings.name ?? ''}
                  onChange={e => setSettings({...settings, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Forme Juridique</label>
                  <select 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                    value={settings.legal_form ?? 'SARL'}
                    onChange={e => setSettings({...settings, legal_form: e.target.value})}
                  >
                    <option value="SARL">SARL</option>
                    <option value="SA">SA</option>
                    <option value="SAS">SAS</option>
                    <option value="EI">EI</option>
                    <option value="SUARL">SUARL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Devise</label>
                  <select 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                    value={settings.currency ?? 'FCFA'}
                    onChange={e => setSettings({...settings, currency: e.target.value})}
                  >
                    <option value="FCFA">XOF (FCFA)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GNF">GNF</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Activité Principale</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                  value={settings.activity ?? ''}
                  onChange={e => setSettings({...settings, activity: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Capital Social</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                  value={settings.capital ?? 0}
                  onChange={e => setSettings({...settings, capital: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
               <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3">
                 <MapPin className="text-amber-500" size={20} />
                 <h2 className="font-bold text-slate-900 dark:text-white">Contact & Localisation</h2>
               </div>
               <div className="p-6 space-y-4 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nom du Gérant</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.manager_name ?? ''}
                      onChange={e => setSettings({...settings, manager_name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Téléphone</label>
                      <input 
                        type="tel" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.phone ?? ''}
                        onChange={e => setSettings({...settings, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                      <input 
                        type="email" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.email ?? ''}
                        onChange={e => setSettings({...settings, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Adresse Complète</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.address ?? ''}
                      onChange={e => setSettings({...settings, address: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ville</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.city ?? ''}
                        onChange={e => setSettings({...settings, city: e.target.value})}
                      />
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Pays</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.country ?? 'Côte d\'Ivoire'}
                        onChange={e => setSettings({...settings, country: e.target.value})}
                      />
                    </div>
                  </div>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
               <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3">
                 <Receipt className="text-teal-500" size={20} />
                 <h2 className="font-bold text-slate-900 dark:text-white">Administration & Impôts</h2>
               </div>
               <div className="p-6 space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">N° Contribuable (NCC)</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.fiscal_id ?? ''}
                        onChange={e => setSettings({...settings, fiscal_id: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Registre Commerce</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.rccm ?? ''}
                        onChange={e => setSettings({...settings, rccm: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Système Comptable SYSCOHADA</label>
                    <select 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.syscohada_system ?? 'normal'}
                      onChange={e => setSettings({...settings, syscohada_system: e.target.value})}
                    >
                      <option value="normal">Système Normal</option>
                      <option value="simplifie">Système Minimal de Trésorerie (SMT)</option>
                    </select>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Régime Fiscal</label>
                      <select 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.tax_regime ?? 'Régime du Réel Normal'}
                        onChange={e => setSettings({...settings, tax_regime: e.target.value})}
                      >
                        <option value="Régime du Réel Normal">Régime du Réel Normal</option>
                        <option value="Régime du Réel Simplifié">Régime du Réel Simplifié</option>
                        <option value="Régime de l'Entreprenant">Régime de l'Entreprenant</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Régime TVA</label>
                      <select 
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                        value={settings.vat_regime ?? 'Assujetti'}
                        onChange={e => setSettings({...settings, vat_regime: e.target.value})}
                      >
                        <option value="Assujetti">Assujetti</option>
                        <option value="Non Assujetti">Non Assujetti</option>
                        <option value="Exonéré">Exonéré</option>
                      </select>
                    </div>
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Taux TVA (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.vat_rate ?? 18}
                      onChange={e => setSettings({...settings, vat_rate: Number(e.target.value)})}
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
             <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div className="flex items-center gap-3">
                 <Landmark className="text-blue-500" size={20} />
                 <h2 className="font-bold text-slate-900 dark:text-white">Coordonnées Bancaires & Paiements</h2>
               </div>
             </div>
             <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nom de la Banque</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.bank_name ?? ''}
                      onChange={e => setSettings({...settings, bank_name: e.target.value})}
                      placeholder="Ex: NSIA Banque"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Code SWIFT / BIC</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                      value={settings.bank_swift ?? ''}
                      onChange={e => setSettings({...settings, bank_swift: e.target.value})}
                      placeholder="Ex: NSIACIAB"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Numéro de Compte / IBAN</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm font-mono"
                      value={settings.bank_iban ?? settings.bank_account_number ?? ''}
                      onChange={e => setSettings({...settings, bank_iban: e.target.value, bank_account_number: e.target.value})}
                      placeholder="Ex: CI01 01234 567890123456 78"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm flex items-center gap-2 font-bold text-slate-900 dark:text-white uppercase tracking-wider title-font"><CreditCard size={16}/> Méthodes de Paiement Actives</h3>
                  
                  {/* Virement Bancaire */}
                  <div className={`p-4 rounded-xl border transition-colors ${settings.payment_bank_enabled ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="payment_bank_enabled"
                          checked={settings.payment_bank_enabled !== false && Number(settings.payment_bank_enabled) !== 0}
                          onChange={e => setSettings({...settings, payment_bank_enabled: e.target.checked})}
                          className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="payment_bank_enabled" className={`font-semibold ${settings.payment_bank_enabled ? 'text-blue-900 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          Virement Bancaire
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest whitespace-nowrap">Compte Lié</label>
                        <input
                          type="text"
                          value={settings.payment_bank_account ?? '521'}
                          onChange={e => setSettings({...settings, payment_bank_account: e.target.value})}
                          className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center font-mono"
                          disabled={!settings.payment_bank_enabled}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Espèces */}
                  <div className={`p-4 rounded-xl border transition-colors ${settings.payment_cash_enabled ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="payment_cash_enabled"
                          checked={settings.payment_cash_enabled !== false && Number(settings.payment_cash_enabled) !== 0}
                          onChange={e => setSettings({...settings, payment_cash_enabled: e.target.checked})}
                          className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                        />
                        <label htmlFor="payment_cash_enabled" className={`font-semibold ${settings.payment_cash_enabled ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          Caisse / Espèces
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest whitespace-nowrap">Compte Lié</label>
                        <input
                          type="text"
                          value={settings.payment_cash_account ?? '571'}
                          onChange={e => setSettings({...settings, payment_cash_account: e.target.value})}
                          className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center font-mono"
                          disabled={!settings.payment_cash_enabled}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Money */}
                  <div className={`p-4 rounded-xl border transition-colors ${settings.payment_mobile_enabled ? 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="payment_mobile_enabled"
                          checked={settings.payment_mobile_enabled !== false && Number(settings.payment_mobile_enabled) !== 0}
                          onChange={e => setSettings({...settings, payment_mobile_enabled: e.target.checked})}
                          className="w-5 h-5 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                        />
                        <label htmlFor="payment_mobile_enabled" className={`font-semibold ${settings.payment_mobile_enabled ? 'text-orange-900 dark:text-orange-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          Mobile Money (Wave, Orange, MTN...)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-widest whitespace-nowrap">Compte Lié</label>
                        <input
                          type="text"
                          value={settings.payment_mobile_account ?? '585'}
                          onChange={e => setSettings({...settings, payment_mobile_account: e.target.value})}
                          className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm text-center font-mono"
                          disabled={!settings.payment_mobile_enabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
             </div>
          </div>

          {/* Modules Addons */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
             <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3">
               <ShieldCheck className="text-purple-500" size={20} />
               <h2 className="font-bold text-slate-900 dark:text-white">Modules & Extensions</h2>
             </div>
             <div className="p-6">
                {!isActive('payroll') ? (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl border border-purple-100 dark:border-purple-800/30 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Briefcase size={80} />
                    </div>
                    <div className="relative z-10 flex-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-widest mb-3">
                        Module Extensible
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Gestion de la Paie & RH</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">Débloquez la gestion complète de vos employés : génération automatique des bulletins de salaire, calcul des cotisations sociales (CNPS), et déclarations fiscales simplifiées.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleModule('payroll')}
                      disabled={activatingPayroll}
                      className="relative z-10 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 disabled:opacity-50"
                    >
                      {activatingPayroll ? <Loader2 size={18} className="animate-spin" /> : <Briefcase size={18} />}
                      Activer le module
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                       <span className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300">
                           <CheckCircle2 size={14} />
                         </span>
                         Module Paie & RH Activé
                       </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">N° Employeur CNPS</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                          value={settings.cnps_employer_number ?? ''}
                          onChange={e => setSettings({...settings, cnps_employer_number: e.target.value})}
                          placeholder="Ex: 012345678"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Centre des Impôts (Rattachement)</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-all shadow-sm"
                          value={settings.tax_office ?? ''}
                          onChange={e => setSettings({...settings, tax_office: e.target.value})}
                          placeholder="Ex: CDI Cocody"
                        />
                      </div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden mt-6">
             <div className="bg-red-100/50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30 p-5 flex items-center gap-3">
               <AlertCircle className="text-red-600 dark:text-red-500" size={20} />
               <h2 className="font-bold text-red-900 dark:text-red-400">Zone de Danger</h2>
             </div>
             <div className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h4 className="text-lg font-bold text-red-900 dark:text-red-400 mb-1">Réinitialiser l'application</h4>
                    <p className="text-sm text-red-700 dark:text-red-300/70 max-w-xl">
                      Cette action est irréversible. Elle supprimera toutes les factures, écritures comptables, tiers, et tous les paramètres de votre entreprise actuelle. Vous serez redirigé vers l'écran de création d'une nouvelle entreprise.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("⚠️ Êtes-vous ABSOLUMENT certain de vouloir supprimer toutes vos données ?\n\nToutes vos factures, données comptables et paramètres seront effacés de manière permanente.\n\nTapez OK pour continuer.") !== true) {
                        return;
                      }
                      
                      const finalConfirm = window.prompt("Pour confirmer la suppression, veuillez taper 'SUPPRIMER' dans le champ ci-dessous :");
                      if (finalConfirm !== 'SUPPRIMER') {
                        alert("Réinitialisation annulée.");
                        return;
                      }

                      try {
                        const res = await apiFetch('/api/company/reset', { method: 'POST' });
                        if (res.ok) {
                          alert("L'application a été réinitialisée avec succès.");
                          window.location.reload();
                        } else {
                          alert("Erreur lors de la réinitialisation.");
                        }
                      } catch (err) {
                        console.error(err);
                        alert("Erreur lors de la réinitialisation.");
                      }
                    }}
                    className="whitespace-nowrap px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all flex items-center gap-2 active:scale-95"
                  >
                    <AlertCircle size={18} />
                    Supprimer les données
                  </button>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
