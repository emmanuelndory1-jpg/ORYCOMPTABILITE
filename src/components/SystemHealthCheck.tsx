import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle, Server, Database, Brain, Calendar, Calculator, RefreshCw, PlayCircle } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DEFAULT_OPERATION_TYPES, calculateEntries, CustomOperation } from '@/lib/accounting';

interface DiagnosticResult {
  database: { status: string; message: string };
  accounts: { status: string; count: number };
  transactions: { status: string; count: number };
  fiscal_year: { status: string; active: string | null };
  ai_service: { status: string; configured: boolean };
  timestamp: string;
}

interface OperationTestResult {
  id: string;
  label: string;
  status: 'success' | 'error';
  message: string;
}

export function SystemHealthCheck() {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Operation Tests
  const [opTests, setOpTests] = useState<OperationTestResult[]>([]);
  const [testingOps, setTestingOps] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health/full');
      if (!res.ok) throw new Error("Erreur lors du diagnostic");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const runOperationTests = async () => {
    setTestingOps(true);
    setOpTests([]);
    
    try {
      // 1. Fetch custom operations to test them too
      const res = await fetch('/api/custom-operations');
      const customOps: CustomOperation[] = await res.json();

      const allOps = [
        ...DEFAULT_OPERATION_TYPES,
        ...customOps.map(op => ({ id: `custom_${op.id}`, label: op.label, icon: op.icon }))
      ];

      const results: OperationTestResult[] = [];

      // 2. Simulate each operation
      allOps.forEach(op => {
        try {
          // Simulate with dummy data
          const entries = calculateEntries(op.id, 10000, 18, 'caisse', customOps);
          
          // Check 1: Are entries generated?
          if (entries.length === 0) {
            throw new Error("Aucune écriture générée");
          }

          // Check 2: Is it balanced?
          const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
          const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
          
          if (Math.abs(totalDebit - totalCredit) > 1) {
             throw new Error(`Déséquilibre: Débit ${totalDebit} != Crédit ${totalCredit}`);
          }

          results.push({ id: op.id, label: op.label, status: 'success', message: 'OK' });
        } catch (e) {
          results.push({ id: op.id, label: op.label, status: 'error', message: e instanceof Error ? e.message : 'Erreur inconnue' });
        }
      });

      setOpTests(results);

    } catch (err) {
      console.error(err);
    } finally {
      setTestingOps(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ok' || status === 'success') return <CheckCircle className="text-brand-green" size={20} />;
    if (status === 'warning') return <AlertTriangle className="text-amber-500" size={20} />;
    return <XCircle className="text-rose-500" size={20} />;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    return (
      <span className={cn(
        "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
        (status === 'ok' || status === 'success') ? "bg-brand-green/10 text-brand-green-dark" :
        status === 'warning' ? "bg-amber-100 text-amber-700" :
        "bg-rose-100 text-rose-700"
      )}>
        {(status === 'ok' || status === 'success') ? 'Opérationnel' : status === 'warning' ? 'Attention' : 'Erreur'}
      </span>
    );
  };

  if (loading && !result) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
        <RefreshCw className="animate-spin mx-auto text-brand-green mb-2" size={32} />
        <p className="text-slate-500 dark:text-slate-400">Analyse du système en cours...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="text-brand-green" />
              État du Système
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Diagnostic complet des fonctionnalités</p>
          </div>
          <button 
            onClick={runDiagnostics}
            disabled={loading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
            title="Relancer le diagnostic"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm border-b border-rose-100 dark:border-rose-900/40 flex items-center gap-2">
            <XCircle size={16} />
            {error}
          </div>
        )}

        {result && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {/* Database */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <Database size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">Base de Données</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{result.database.message}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={result.database.status} />
                <StatusIcon status={result.database.status} />
              </div>
            </div>

            {/* Accounts */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <Calculator size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">Plan Comptable</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{result.accounts.count} comptes actifs</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={result.accounts.status} />
                <StatusIcon status={result.accounts.status} />
              </div>
            </div>

            {/* Transactions */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <Server size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">Transactions</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{result.transactions.count} écritures enregistrées</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={result.transactions.status} />
                <StatusIcon status={result.transactions.status} />
              </div>
            </div>

            {/* Fiscal Year */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">Exercice Comptable</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {result.fiscal_year.active ? `Actif : ${result.fiscal_year.active}` : 'Aucun exercice actif'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={result.fiscal_year.status} />
                <StatusIcon status={result.fiscal_year.status} />
              </div>
            </div>

            {/* AI Service */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                  <Brain size={20} />
                </div>
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">Service IA (Gemini)</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {result.ai_service.configured ? 'Clé API configurée' : 'Clé API manquante'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={result.ai_service.status} />
                <StatusIcon status={result.ai_service.status} />
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 transition-colors">
          Dernier scan : {result ? new Date(result.timestamp).toLocaleString() : '-'}
        </div>
      </div>

      {/* Operation Tests Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlayCircle className="text-blue-600 dark:text-blue-400" />
              Test des Opérations
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Simulation de toutes les écritures comptables</p>
          </div>
          <button 
            onClick={runOperationTests}
            disabled={testingOps}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            <PlayCircle size={18} className={cn(testingOps && "animate-spin")} />
            {testingOps ? "Test en cours..." : "Lancer les tests"}
          </button>
        </div>

        {opTests.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {opTests.map((test) => (
              <div key={test.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-300">{test.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500 text-xs">{test.message}</span>
                  {test.status === 'success' ? <CheckCircle size={16} className="text-brand-green" /> : <XCircle size={16} className="text-rose-500" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
