import React, { useState, useEffect } from 'react';
import { Bell, Save, Loader2, Mail, Clock, FileText } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';

interface ReminderSettings {
  invoice_reminder_enabled: boolean;
  invoice_reminder_days: number;
  invoice_reminder_email: string;
  invoice_reminder_subject: string;
  invoice_reminder_template: string;
}

export function InvoiceReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
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
        setSettings({
          invoice_reminder_enabled: !!data.settings.invoice_reminder_enabled,
          invoice_reminder_days: data.settings.invoice_reminder_days || 7,
          invoice_reminder_email: data.settings.invoice_reminder_email || '',
          invoice_reminder_subject: data.settings.invoice_reminder_subject || 'Rappel de facture impayée',
          invoice_reminder_template: data.settings.invoice_reminder_template || "Bonjour, votre facture {number} d'un montant de {total} est échue depuis le {due_date}. Merci de régulariser votre situation."
        });
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
      // Get current full settings to not overwrite other fields
      const dossierRes = await fetch('/api/company/dossier');
      const dossierData = await dossierRes.json();
      const currentSettings = dossierData.settings || {};

      const res = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentSettings,
          name: currentSettings.name,
          legalForm: currentSettings.legal_form,
          activity: currentSettings.activity,
          fiscalId: currentSettings.fiscal_id,
          taxRegime: currentSettings.tax_regime,
          vatRegime: currentSettings.vat_regime,
          currency: currentSettings.currency,
          address: currentSettings.address,
          city: currentSettings.city,
          country: currentSettings.country,
          capital: currentSettings.capital,
          managerName: currentSettings.manager_name,
          invoiceReminderEnabled: settings.invoice_reminder_enabled,
          invoiceReminderDays: settings.invoice_reminder_days,
          invoiceReminderEmail: settings.invoice_reminder_email,
          invoiceReminderSubject: settings.invoice_reminder_subject,
          invoiceReminderTemplate: settings.invoice_reminder_template
        })
      });

      if (res.ok) {
        setSuccess("Paramètres de rappel mis à jour avec succès.");
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

  const triggerCheck = async () => {
    try {
      const res = await fetch('/api/invoices/check-reminders', { method: 'POST' });
      if (res.ok) {
        setSuccess("Vérification manuelle des rappels lancée.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-green" /></div>;
  if (!settings) return <div className="p-8 text-center text-slate-500">Aucun paramètre trouvé.</div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Rappels de Factures</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configurez les relances automatiques pour les factures échues</p>
          </div>
        </div>
        <button 
          onClick={triggerCheck}
          className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Vérifier maintenant
        </button>
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

        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex-1">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Activer les rappels automatiques</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Le système vérifiera quotidiennement les factures échues et enverra des relances.</p>
          </div>
          <button
            type="button"
            onClick={() => setSettings({...settings, invoice_reminder_enabled: !settings.invoice_reminder_enabled})}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              settings.invoice_reminder_enabled ? 'bg-brand-green' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.invoice_reminder_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings.invoice_reminder_enabled && (
          <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  Délai de relance (jours)
                </label>
                <input 
                  type="number" 
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                  value={settings.invoice_reminder_days}
                  onChange={e => setSettings({...settings, invoice_reminder_days: parseInt(e.target.value)})}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Nombre de jours après l'échéance pour envoyer le rappel.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                  <Mail size={16} className="text-slate-400" />
                  Email de notification
                </label>
                <input 
                  type="email" 
                  placeholder="comptabilite@votre-entreprise.com"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                  value={settings.invoice_reminder_email}
                  onChange={e => setSettings({...settings, invoice_reminder_email: e.target.value})}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adresse qui recevra une copie de chaque rappel envoyé.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  Objet de l'email
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                  value={settings.invoice_reminder_subject}
                  onChange={e => setSettings({...settings, invoice_reminder_subject: e.target.value})}
                />
                <p className="text-[10px] text-slate-400 mt-1">Variables: {'{number}'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modèle de message</label>
                <textarea 
                  rows={4}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors resize-none"
                  value={settings.invoice_reminder_template}
                  onChange={e => setSettings({...settings, invoice_reminder_template: e.target.value})}
                />
                <p className="text-[10px] text-slate-400 mt-1">Variables: {'{number}, {total}, {due_date}, {client_name}'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-brand-green hover:bg-brand-green-dark text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Enregistrer les paramètres de rappel
          </button>
        </div>
      </form>
    </div>
  );
}
