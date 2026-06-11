import React, { useState } from 'react';
import { Bell, Mail, Smartphone, AlertTriangle, Save, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function NotificationSettings() {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    email_invoices: true,
    email_reminders: true,
    email_weekly_summary: false,
    push_new_documents: true,
    push_payment_received: true,
    alert_low_stock: false,
    alert_tax_deadlines: true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 800);
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-green/20 dark:peer-focus:ring-brand-green/10 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-green shadow-inner"></div>
    </label>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green">
          <Bell size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Préférences de Notification</h2>
          <p className="text-sm border-l-2 border-brand-green/30 pl-2 text-slate-500 font-medium">Gérez comment et quand vous souhaitez être informé.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Notifications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Mail className="text-brand-green" size={18} />
            Notifications par Email
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Factures & Devis</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Copie des documents envoyés aux clients</p>
              </div>
              <ToggleSwitch checked={settings.email_invoices} onChange={() => handleToggle('email_invoices')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Relances d'impayés</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Avis d'expédition des relances automatiques</p>
              </div>
              <ToggleSwitch checked={settings.email_reminders} onChange={() => handleToggle('email_reminders')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Rapport Hebdomadaire</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Résumé de l'activité comptable de la semaine</p>
              </div>
              <ToggleSwitch checked={settings.email_weekly_summary} onChange={() => handleToggle('email_weekly_summary')} />
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Smartphone className="text-brand-green" size={18} />
            Notifications Push (App)
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Nouveaux Documents</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Acquisition de nouvelles pièces comptables</p>
              </div>
              <ToggleSwitch checked={settings.push_new_documents} onChange={() => handleToggle('push_new_documents')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Paiements Reçus</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Confirmation lors de la saisie d'un encaissement</p>
              </div>
              <ToggleSwitch checked={settings.push_payment_received} onChange={() => handleToggle('push_payment_received')} />
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 shadow-sm p-6 md:col-span-2">
          <h3 className="font-bold text-rose-600 dark:text-rose-400 mb-6 flex items-center gap-2">
            <AlertTriangle size={18} />
            Alertes Importantes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Échéances Fiscales</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Rappels pour les déclarations TVA, Impôts, etc.</p>
              </div>
              <ToggleSwitch checked={settings.alert_tax_deadlines} onChange={() => handleToggle('alert_tax_deadlines')} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Stock Faible</p>
                <p className="text-xs text-slate-500 font-medium mt-1">Alerte quand un article passe sous le seuil d'alerte</p>
              </div>
              <ToggleSwitch checked={settings.alert_low_stock} onChange={() => handleToggle('alert_low_stock')} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-brand-green text-white font-bold text-sm rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-green/20"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={18} />
          ) : (
            <Save size={18} />
          )}
          {isSaving ? 'Enregistrement...' : saved ? 'Enregistré' : 'Enregistrer les préférences'}
        </button>
      </div>
    </div>
  );
}
