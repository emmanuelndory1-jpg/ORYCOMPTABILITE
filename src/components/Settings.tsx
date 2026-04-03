import React from 'react';
import { FiscalYearManager } from './FiscalYearManager';
import { SystemHealthCheck } from './SystemHealthCheck';
import { AuditTrail } from './AuditTrail';
import { CompanySettingsManager } from './CompanySettingsManager';
import { CurrencyManager } from './CurrencyManager';
import { InvoiceReminderSettings } from './InvoiceReminderSettings';
import { PayrollSettingsManager } from './PayrollSettingsManager';
import { SubscriptionManager } from './SubscriptionManager';
import { VATSettingsManager } from './VATSettingsManager';
import { LanguageSettings } from './LanguageSettings';
import { Settings as SettingsIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function Settings() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="text-slate-800 dark:text-slate-200" />
          {t('nav.settings') || 'Paramètres'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('settings.description') || 'Configuration générale de votre comptabilité.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <LanguageSettings />
          <SubscriptionManager />
          <CompanySettingsManager />
          <CurrencyManager />
          <InvoiceReminderSettings />
          <PayrollSettingsManager />
          <VATSettingsManager />
          <FiscalYearManager />
        </div>
        <div className="space-y-8">
          <SystemHealthCheck />
        </div>
      </div>
      
      {/* Audit Trail Section */}
      <div className="mt-8">
        <AuditTrail />
      </div>
    </div>
  );
}
