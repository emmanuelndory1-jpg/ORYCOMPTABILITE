import React, { useState, useEffect } from 'react';
import { 
  Save, RefreshCw, AlertCircle, Percent, ToggleLeft, ToggleRight, 
  Loader2, Calculator, Info, Building2, ShieldCheck, Landmark
} from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface TaxRule {
  id: number;
  code: string;
  name: string;
  type: 'employee_social' | 'employee_tax' | 'employer_social' | 'employer_tax';
  rate: number | null;
  fixed_amount: number | null;
  ceiling: number | null;
  min_base: number | null;
  account_code: string | null;
  is_active: number;
}

interface TaxBracket {
  id: number;
  tax_code: string;
  min_value: number;
  max_value: number | null;
  rate: number;
  deduction: number;
}

interface TaxReduction {
  id: number;
  marital_status: string;
  children_count: number;
  parts: number;
}

interface PayrollRule {
  id: number;
  code: string;
  name: string;
  type: 'bonus' | 'deduction';
  formula: string;
  is_taxable: number;
  is_social_taxable: number;
  is_active: number;
}

interface CompanySettings {
  tax_regime: string;
  vat_regime: string;
}

export function PayrollSettingsManager() {
  const { formatCurrency, currency } = useCurrency();
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [reductions, setReductions] = useState<TaxReduction[]>([]);
  const [payrollRules, setPayrollRules] = useState<PayrollRule[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'brackets' | 'reductions' | 'rules'>('general');
  
  // Simulator state
  const [simGross, setSimGross] = useState<number>(500000);
  const [simParts, setSimParts] = useState<number>(1);
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, settingsRes, bracketsRes, reductionsRes, payrollRulesRes] = await Promise.all([
        fetch('/api/tax-rules'),
        fetch('/api/company/settings'),
        fetch('/api/payroll/brackets'),
        fetch('/api/payroll/reductions'),
        fetch('/api/payroll/rules')
      ]);
      
      if (!rulesRes.ok || !settingsRes.ok || !bracketsRes.ok || !reductionsRes.ok || !payrollRulesRes.ok) 
        throw new Error('Failed to fetch data');
      
      const [rulesData, settingsData, bracketsData, reductionsData, payrollRulesData] = await Promise.all([
        rulesRes.json(),
        settingsRes.json(),
        bracketsRes.json(),
        reductionsRes.json(),
        payrollRulesRes.json()
      ]);
      
      setRules(rulesData);
      setCompanySettings(settingsData);
      setBrackets(bracketsData);
      setReductions(reductionsData);
      setPayrollRules(payrollRulesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async (rule: TaxRule) => {
    setSaving(rule.code);
    try {
      const res = await fetch(`/api/tax-rules/${rule.code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rate: rule.rate,
          ceiling: rule.ceiling,
          fixed_amount: rule.fixed_amount,
          is_active: rule.is_active
        })
      });

      if (!res.ok) throw new Error('Failed to update rule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateBracket = async (bracket: TaxBracket) => {
    setSaving(`bracket-${bracket.id}`);
    try {
      const res = await fetch(`/api/payroll/brackets/${bracket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bracket)
      });
      if (!res.ok) throw new Error('Failed to update bracket');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateReduction = async (reduction: TaxReduction) => {
    setSaving(`reduction-${reduction.id}`);
    try {
      const res = await fetch(`/api/payroll/reductions/${reduction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reduction)
      });
      if (!res.ok) throw new Error('Failed to update reduction');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdatePayrollRule = async (rule: PayrollRule) => {
    setSaving(`prule-${rule.id}`);
    try {
      const res = await fetch(`/api/payroll/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      if (!res.ok) throw new Error('Failed to update payroll rule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateSettings = async (updates: Partial<CompanySettings>) => {
    if (!companySettings) return;
    setSaving('settings');
    try {
      const res = await fetch('/api/company/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...companySettings, ...updates })
      });
      if (!res.ok) throw new Error('Failed to update settings');
      setCompanySettings({ ...companySettings, ...updates });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleSimulate = () => {
    const getRule = (code: string) => rules.find(r => r.code === code);
    
    // 1. Base for IS and CN (80% of Gross)
    const base80 = simGross * 0.8;
    
    // 2. CNPS (Part Salariale)
    const cnpsRule = getRule('CNPS_RET_SAL');
    const cnpsBase = cnpsRule?.ceiling ? Math.min(simGross, cnpsRule.ceiling) : simGross;
    const cnpsEmployee = Math.round(cnpsBase * (cnpsRule?.rate || 0.063));
    
    // 3. IS (Impôt sur le Salaire)
    const isRule = getRule('IS');
    const isTax = Math.round(base80 * (isRule?.rate || 0.012));
    
    // 4. CN (Contribution Nationale)
    let cnTax = 0;
    const cnBrackets = brackets.filter(b => b.tax_code === 'CN');
    if (cnBrackets.length > 0) {
      const bracket = cnBrackets.find(b => base80 >= b.min_value && (!b.max_value || base80 < b.max_value));
      if (bracket) {
        cnTax = Math.round(base80 * bracket.rate - bracket.deduction);
      }
    } else {
      // Fallback to legacy calculation
      if (base80 > 50000) {
        if (base80 <= 130000) cnTax = (base80 - 50000) * 0.015;
        else if (base80 <= 200000) cnTax = (130000 - 50000) * 0.015 + (base80 - 130000) * 0.05;
        else cnTax = (130000 - 50000) * 0.015 + (200000 - 130000) * 0.05 + (base80 - 200000) * 0.10;
      }
    }
    cnTax = Math.round(cnTax);
    
    // 5. IGR (Impôt Général sur le Revenu)
    const igrBase = Math.max(0, (base80 - isTax - cnTax - cnpsEmployee) * 0.85);
    const q = igrBase / simParts;
    let igrTax = 0;
    const igrBrackets = brackets.filter(b => b.tax_code === 'IGR');
    
    if (igrBrackets.length > 0) {
      const bracket = igrBrackets.find(b => q >= b.min_value && (!b.max_value || q < b.max_value));
      if (bracket) {
        igrTax = Math.max(0, Math.round(igrBase * bracket.rate - bracket.deduction * simParts));
      }
    } else {
      // Fallback
      let igrRate = 0, v = 0;
      if (q <= 25000) { igrRate = 0; v = 0; }
      else if (q <= 45500) { igrRate = 0.10; v = 2500; }
      else if (q <= 81500) { igrRate = 0.15; v = 4775; }
      else if (q <= 126500) { igrRate = 0.20; v = 8850; }
      else if (q <= 220000) { igrRate = 0.25; v = 15175; }
      else if (q <= 389000) { igrRate = 0.35; v = 37175; }
      else if (q <= 842000) { igrRate = 0.45; v = 76075; }
      else { igrRate = 0.60; v = 202375; }
      igrTax = Math.max(0, Math.round(igrBase * igrRate - v * simParts));
    }
    
    setSimResult({
      cnpsEmployee,
      isTax,
      cnTax,
      igrTax,
      totalTaxes: isTax + cnTax + igrTax,
      net: simGross - cnpsEmployee - isTax - cnTax - igrTax
    });
  };

  const handleBracketChange = (id: number, field: keyof TaxBracket, value: any) => {
    setBrackets(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleReductionChange = (id: number, field: keyof TaxReduction, value: any) => {
    setReductions(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handlePayrollRuleChange = (id: number, field: keyof PayrollRule, value: any) => {
    setPayrollRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleChange = (code: string, field: keyof TaxRule, value: any) => {
    setRules(prev => prev.map(r => r.code === code ? { ...r, [field]: value } : r));
  };

  const renderRuleRow = (rule: TaxRule) => (
    <tr key={rule.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900 dark:text-slate-100">{rule.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{rule.code}</div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.001"
            value={rule.rate ? (rule.rate * 100).toFixed(3) : ''}
            onChange={(e) => handleChange(rule.code, 'rate', parseFloat(e.target.value) / 100)}
            placeholder="-"
            className="w-20 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
          />
          <span className="text-slate-400 dark:text-slate-500 text-sm">%</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={rule.ceiling || ''}
            onChange={(e) => handleChange(rule.code, 'ceiling', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Illimité"
            className="w-28 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
          />
          <span className="text-slate-400 dark:text-slate-500 text-xs">{currency}</span>
        </div>
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => handleChange(rule.code, 'is_active', rule.is_active ? 0 : 1)}
          className={cn(
            "p-1 rounded-full transition-colors",
            rule.is_active ? "text-brand-green hover:bg-brand-green/10 dark:hover:bg-brand-green/20" : "text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          {rule.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
        </button>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => handleUpdateRule(rule)}
          disabled={saving === rule.code}
          className="text-brand-green hover:text-brand-green-dark p-2 rounded-lg hover:bg-brand-green/10 dark:hover:bg-brand-green/20 transition-colors disabled:opacity-50"
        >
          {saving === rule.code ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        </button>
      </td>
    </tr>
  );

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Chargement des paramètres...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres de Paie</h2>
          <p className="text-slate-500 dark:text-slate-400">Configurez les barèmes, les coefficients et les règles de calcul.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            className="p-2.5 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-xl transition-all border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-3 border border-rose-100 dark:border-rose-800">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-fit overflow-x-auto max-w-full">
        {[
          { id: 'general', label: 'Général & Simulateur', icon: Building2 },
          { id: 'brackets', label: 'Barèmes (IS/CN/IGR)', icon: Landmark },
          { id: 'reductions', label: 'Déductions (Parts)', icon: Percent },
          { id: 'rules', label: 'Primes & Retenues', icon: Calculator },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-800 text-brand-green shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: General Settings */}
          <div className="space-y-8 border-r border-slate-100 dark:border-slate-800 pr-0 lg:pr-8 border-none md:border-solid">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-fit">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 size={18} className="text-brand-green" />
                  Paramètres de Base
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Régime Fiscal</label>
                  <select 
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green outline-none transition-all"
                    value={companySettings?.tax_regime || ''}
                    onChange={(e) => handleUpdateSettings({ tax_regime: e.target.value })}
                    disabled={saving === 'settings'}
                  >
                    <option value="RSI">Régime Simplifié (RSI)</option>
                    <option value="RNI">Régime Réel Normal (RNI)</option>
                    <option value="RME">Régime Micro-Entreprises (RME)</option>
                  </select>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                  <Info size={18} className="text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800 dark:text-blue-400">
                    Ces paramètres influencent le calcul automatique des cotisations sociales et fiscales.
                  </p>
                </div>
              </div>
            </div>

            {/* Social Contributions Management */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-orange-500" />
                  Cotisations CNPS
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rules.filter(r => r.code.includes('CNPS') || ['PF', 'AT'].includes(r.code)).map(renderRuleRow)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Simulator */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calculator size={24} className="text-brand-green" />
                    Simulateur de Bulletin
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Simulez le passage du brut au net selon les barèmes en vigueur.</p>
                </div>
                <button 
                  onClick={handleSimulate}
                  className="bg-brand-green text-white px-8 py-3 rounded-2xl font-bold hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/20"
                >
                  Calculer le Net
                </button>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Salaire Brut Mensuel</label>
                    <div className="relative">
                      <input 
                        type="number"
                        className="w-full pl-6 pr-16 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:border-brand-green outline-none transition-all text-xl font-mono"
                        value={simGross}
                        onChange={(e) => setSimGross(Number(e.target.value))}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Nombre de Parts (Quotient IGR)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.5"
                        min="1"
                        className="w-full pl-6 pr-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white focus:border-brand-green outline-none transition-all text-xl font-mono"
                        value={simParts}
                        onChange={(e) => setSimParts(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {simResult ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl space-y-4 border border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Détails des Retenues</h4>
                      <div className="flex justify-between items-center group">
                        <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Cotisation Sociale (CNPS)</span>
                        <span className="font-mono text-rose-500 font-medium">-{formatCurrency(simResult.cnpsEmployee)}</span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Impôt sur Salaire (IS)</span>
                        <span className="font-mono text-rose-500 font-medium">-{formatCurrency(simResult.isTax)}</span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Contribution Nationale (CN)</span>
                        <span className="font-mono text-rose-500 font-medium">-{formatCurrency(simResult.cnTax)}</span>
                      </div>
                      <div className="flex justify-between items-center group">
                        <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Impôt Général sur Revenu (IGR)</span>
                        <span className="font-mono text-rose-500 font-medium">-{formatCurrency(simResult.igrTax)}</span>
                      </div>
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="font-bold text-slate-900 dark:text-white">Total Charges Salariales</span>
                        <span className="font-mono font-bold text-rose-600">{formatCurrency(simResult.cnpsEmployee + simResult.totalTaxes)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center items-center p-8 bg-brand-green/5 dark:bg-brand-green/10 rounded-3xl border-2 border-dashed border-brand-green/20">
                      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Salaire Net à Payer</span>
                      <span className="text-4xl md:text-5xl font-black text-brand-green font-mono">{formatCurrency(simResult.net)}</span>
                      <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl text-center shadow-sm">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Part Salariale</span>
                          <span className="text-sm font-bold text-rose-500">{((simResult.cnpsEmployee + simResult.totalTaxes) / simGross * 100).toFixed(1)}%</span>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl text-center shadow-sm">
                          <span className="block text-[10px] text-slate-400 uppercase font-bold">Salaire Net</span>
                          <span className="text-sm font-bold text-brand-green">{(simResult.net / simGross * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                    <Calculator size={64} className="mb-4 opacity-50" />
                    <p className="font-medium">Entrez un montant et cliquez sur simuler</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'brackets' && (
        <div className="space-y-8">
          {/* IGR Brackets */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark size={18} className="text-brand-green" />
                Barème IGR (Tranches Progressives)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Minimum (Q)</th>
                    <th className="px-6 py-3">Maximum (Q)</th>
                    <th className="px-6 py-3">Taux (%)</th>
                    <th className="px-6 py-3">Montant à Déduire (V)</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {brackets.filter(b => b.tax_code === 'IGR').map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={b.min_value}
                          onChange={(e) => handleBracketChange(b.id, 'min_value', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={b.max_value || ''}
                          onChange={(e) => handleBracketChange(b.id, 'max_value', e.target.value ? Number(e.target.value) : null)}
                          placeholder="Max"
                          className="w-32 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={b.rate * 100}
                            onChange={(e) => handleBracketChange(b.id, 'rate', Number(e.target.value) / 100)}
                            className="w-16 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <input
                          type="number"
                          value={b.deduction}
                          onChange={(e) => handleBracketChange(b.id, 'deduction', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdateBracket(b)}
                          disabled={saving === `bracket-${b.id}`}
                          className="text-brand-green p-2 hover:bg-brand-green/10 rounded-lg transition-colors"
                        >
                          {saving === `bracket-${b.id}` ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CN Brackets */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark size={18} className="text-brand-green" />
                Barème CN (Contribution Nationale)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Minimum (R)</th>
                    <th className="px-6 py-3">Maximum (R)</th>
                    <th className="px-6 py-3 text-center">Taux (%)</th>
                    <th className="px-6 py-3 text-center">Abattement Forfaitaire</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {brackets.filter(b => b.tax_code === 'CN').map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                         <input
                          type="number"
                          value={b.min_value}
                          onChange={(e) => handleBracketChange(b.id, 'min_value', Number(e.target.value))}
                          className="w-32 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={b.max_value || ''}
                          onChange={(e) => handleBracketChange(b.id, 'max_value', e.target.value ? Number(e.target.value) : null)}
                          placeholder="Max"
                          className="w-32 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 font-mono">
                           <input
                            type="number"
                            step="0.1"
                            value={b.rate * 100}
                            onChange={(e) => handleBracketChange(b.id, 'rate', Number(e.target.value) / 100)}
                            className="w-16 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                         <input
                          type="number"
                          value={b.deduction}
                          onChange={(e) => handleBracketChange(b.id, 'deduction', Number(e.target.value))}
                          className="w-24 px-2 py-1 text-right border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdateBracket(b)}
                          disabled={saving === `bracket-${b.id}`}
                          className="text-brand-green p-2 hover:bg-brand-green/10 rounded-lg transition-colors"
                        >
                          {saving === `bracket-${b.id}` ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reductions' && (
        <div className="space-y-8 max-w-4xl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Percent size={18} className="text-brand-green" />
                Coefficients de Déduction Fiscale (Nombre de Parts IGR)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Situation Familiale</th>
                    <th className="px-6 py-3">Nombre d'enfants</th>
                    <th className="px-6 py-3 text-center">Parts (N)</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {reductions.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                        {r.marital_status === 'single' ? 'Célibataire / Divorcé' : 'Marié(e)'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {r.children_count === 0 ? 'Sans enfant' : `${r.children_count} enfant${r.children_count > 1 ? 's' : ''}`}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={r.parts}
                          onChange={(e) => handleReductionChange(r.id, 'parts', Number(e.target.value))}
                          className="w-20 px-2 py-1 text-center border dark:border-slate-700 dark:bg-slate-900 rounded-md text-sm font-bold text-brand-green"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdateReduction(r)}
                          disabled={saving === `reduction-${r.id}`}
                          className="text-brand-green p-2 hover:bg-brand-green/10 rounded-lg transition-colors"
                        >
                          {saving === `reduction-${r.id}` ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 italic">
                Note : Pour IGR, le quotient familial Q = R / N, où R est le revenu imposable net et N le nombre de parts.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-8">
           <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator size={18} className="text-brand-green" />
                Règles de Calcul des Primes & Retenues
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Code & Libellé</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Formule / Logic</th>
                    <th className="px-6 py-3 text-center">Taxable</th>
                    <th className="px-6 py-3 text-center">Actif</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {payrollRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                           <input
                            type="text"
                            value={rule.name}
                            onChange={(e) => handlePayrollRuleChange(rule.id, 'name', e.target.value)}
                            className="bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-full"
                          />
                        </div>
                        <div className="text-xs text-slate-400 font-mono">{rule.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          rule.type === 'bonus' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        )}>
                          {rule.type === 'bonus' ? 'Prime' : 'Retenue'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={rule.formula}
                          onChange={(e) => handlePayrollRuleChange(rule.id, 'formula', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border-none rounded text-xs font-mono"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={rule.is_taxable === 1}
                          onChange={(e) => handlePayrollRuleChange(rule.id, 'is_taxable', e.target.checked ? 1 : 0)}
                          className="rounded text-brand-green focus:ring-brand-green"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handlePayrollRuleChange(rule.id, 'is_active', rule.is_active ? 0 : 1)}
                          className={cn(
                            "p-1 rounded-full transition-colors",
                            rule.is_active ? "text-brand-green" : "text-slate-300"
                          )}
                        >
                          {rule.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleUpdatePayrollRule(rule)}
                          disabled={saving === `prule-${rule.id}`}
                          className="text-brand-green p-2 hover:bg-brand-green/10 rounded-lg transition-colors"
                        >
                          {saving === `prule-${rule.id}` ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
               <div className="flex gap-4 text-[10px] text-slate-400">
                <span className="font-bold uppercase">Variables disponibles :</span>
                <code>base_salary</code>
                <code>seniority_years</code>
                <code>fixed</code>
                <span className="italic ml-auto">Note : Les formules complexes seront supportées dans une future version.</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 p-4 w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 hover:text-brand-green hover:border-brand-green/50 hover:bg-brand-green/5 transition-all text-sm font-medium">
            <Calculator size={18} />
            Ajouter une nouvelle règle de calcul
          </button>
        </div>
      )}
    </div>
  );
}
