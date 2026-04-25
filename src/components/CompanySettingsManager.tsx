import React, { useState, useEffect } from 'react';
import { Building, Save, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';

interface CompanySettings {
  id: number;
  name: string;
  legal_form: string;
  activity: string;
  fiscal_id: string;
  tax_regime: string;
  vat_regime: string;
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
}

import { useModules } from '@/context/ModuleContext';

export function CompanySettingsManager() {
  const { isActive } = useModules();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/company/dossier');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/company/settings', {
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
          payment_mobile_account: settings.payment_mobile_account
        })
      });

      if (res.ok) {
        setSuccess("Paramètres mis à jour avec succès.");
        // Reload to ensure everything is synced if needed, or just keep state
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

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-green" /></div>;
  if (!settings) return <div className="p-8 text-center text-slate-500">Aucun paramètre trouvé.</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
            <Building size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Informations de l'Entreprise</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Modifiez les détails de votre société</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green-dark dark:text-brand-green-light rounded-lg text-sm border border-brand-green/20 dark:border-brand-green/30">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'entreprise</label>
            <input 
              type="text" 
              required
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.name ?? ''}
              onChange={e => setSettings({...settings, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Forme Juridique</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.legal_form ?? 'SARL'}
              onChange={e => setSettings({...settings, legal_form: e.target.value})}
            >
              <option value="SARL">SARL</option>
              <option value="SA">SA</option>
              <option value="SAS">SAS</option>
              <option value="EI">Entreprise Individuelle</option>
              <option value="SUARL">SUARL</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Activité</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.activity ?? ''}
              onChange={e => setSettings({...settings, activity: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Devise</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.currency ?? 'FCFA'}
              onChange={e => setSettings({...settings, currency: e.target.value})}
            >
              <option value="FCFA">FCFA (XOF)</option>
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dollar ($)</option>
              <option value="GNF">Franc Guinéen (GNF)</option>
              <option value="CDF">Franc Congolais (CDF)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">La devise utilisée pour tous les affichages.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numéro Contribuable (NCC)</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.fiscal_id ?? ''}
              onChange={e => setSettings({...settings, fiscal_id: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Régime Fiscal</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.tax_regime ?? 'Régime du Réel Normal'}
              onChange={e => setSettings({...settings, tax_regime: e.target.value})}
            >
              <option value="Régime du Réel Normal">Régime du Réel Normal</option>
              <option value="Régime du Réel Simplifié">Régime du Réel Simplifié</option>
              <option value="Régime de l'Entreprenant">Régime de l'Entreprenant</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Régime TVA</label>
            <select 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.vat_regime ?? 'Assujetti'}
              onChange={e => setSettings({...settings, vat_regime: e.target.value})}
            >
              <option value="Assujetti">Assujetti</option>
              <option value="Non Assujetti">Non Assujetti</option>
              <option value="Exonéré">Exonéré</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom du Gérant</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.manager_name ?? ''}
              onChange={e => setSettings({...settings, manager_name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Capital Social</label>
            <input 
              type="number" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.capital ?? 0}
              onChange={e => setSettings({...settings, capital: Number(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Téléphone</label>
            <input 
              type="tel" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.phone ?? ''}
              onChange={e => setSettings({...settings, phone: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email de l'entreprise</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.email ?? ''}
              onChange={e => setSettings({...settings, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pays</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.country ?? 'Côte d\'Ivoire'}
              onChange={e => setSettings({...settings, country: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.address ?? ''}
              onChange={e => setSettings({...settings, address: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ville</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
              value={settings.city ?? ''}
              onChange={e => setSettings({...settings, city: e.target.value})}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Coordonnées Bancaires</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de la Banque</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                value={settings.bank_name ?? ''}
                onChange={e => setSettings({...settings, bank_name: e.target.value})}
                placeholder="Ex: NSIA Banque"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numéro de Compte</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                value={settings.bank_account_number ?? ''}
                onChange={e => setSettings({...settings, bank_account_number: e.target.value})}
                placeholder="Ex: 0123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IBAN</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                value={settings.bank_iban ?? ''}
                onChange={e => setSettings({...settings, bank_iban: e.target.value})}
                placeholder="Ex: CI01 01234 567890123456 78"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code SWIFT / BIC</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                value={settings.bank_swift ?? ''}
                onChange={e => setSettings({...settings, bank_swift: e.target.value})}
                placeholder="Ex: NSIACIAB"
              />
            </div>
          </div>
        </div>

        {/* Informations Sociales (Module Paie) */}
        {isActive('payroll') && (
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Informations Sociales & Paie</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">N° Employeur CNPS</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                  value={settings.cnps_employer_number ?? ''}
                  onChange={e => setSettings({...settings, cnps_employer_number: e.target.value})}
                  placeholder="Ex: 012345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Centre des Impôts (Rattachement)</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                  value={settings.tax_office ?? ''}
                  onChange={e => setSettings({...settings, tax_office: e.target.value})}
                  placeholder="Ex: CDI Cocody"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Modes de Paiement (Factures)</h3>
          <div className="space-y-6">
            {/* Virement Bancaire */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <input
                  type="checkbox"
                  id="payment_bank_enabled"
                  checked={settings.payment_bank_enabled !== false && Number(settings.payment_bank_enabled) !== 0}
                  onChange={e => setSettings({...settings, payment_bank_enabled: e.target.checked})}
                  className="w-4 h-4 text-brand-green border-slate-300 rounded focus:ring-brand-green"
                />
                <label htmlFor="payment_bank_enabled" className="font-medium text-slate-900 dark:text-slate-100">
                  Virement Bancaire
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Compte Comptable :</label>
                <input
                  type="text"
                  value={settings.payment_bank_account ?? '521'}
                  onChange={e => setSettings({...settings, payment_bank_account: e.target.value})}
                  className="w-32 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  placeholder="Ex: 521"
                />
              </div>
            </div>

            {/* Espèces */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <input
                  type="checkbox"
                  id="payment_cash_enabled"
                  checked={settings.payment_cash_enabled !== false && Number(settings.payment_cash_enabled) !== 0}
                  onChange={e => setSettings({...settings, payment_cash_enabled: e.target.checked})}
                  className="w-4 h-4 text-brand-green border-slate-300 rounded focus:ring-brand-green"
                />
                <label htmlFor="payment_cash_enabled" className="font-medium text-slate-900 dark:text-slate-100">
                  Espèces
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Compte Comptable :</label>
                <input
                  type="text"
                  value={settings.payment_cash_account ?? '571'}
                  onChange={e => setSettings({...settings, payment_cash_account: e.target.value})}
                  className="w-32 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  placeholder="Ex: 571"
                />
              </div>
            </div>

            {/* Mobile Money */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <input
                  type="checkbox"
                  id="payment_mobile_enabled"
                  checked={settings.payment_mobile_enabled !== false && Number(settings.payment_mobile_enabled) !== 0}
                  onChange={e => setSettings({...settings, payment_mobile_enabled: e.target.checked})}
                  className="w-4 h-4 text-brand-green border-slate-300 rounded focus:ring-brand-green"
                />
                <label htmlFor="payment_mobile_enabled" className="font-medium text-slate-900 dark:text-slate-100">
                  Mobile Money
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Compte Comptable :</label>
                <input
                  type="text"
                  value={settings.payment_mobile_account ?? '585'}
                  onChange={e => setSettings({...settings, payment_mobile_account: e.target.value})}
                  className="w-32 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  placeholder="Ex: 585"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-brand-green hover:bg-brand-green-dark text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
