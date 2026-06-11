import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Pencil, Trash2, X, Check, Copy, Upload, ArrowRight, RefreshCw, AlertCircle, Sparkles, ChevronRight, AlertTriangle, Info } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useDialog } from './DialogProvider';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';

import { PageHeader } from './ui/PageHeader';
import { Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Account {
  code: string;
  name: string;
  class_code: number;
  type: string;
}

const AccountRow = React.memo(({ acc, onOpenModal, onCopy, onDelete }: { acc: Account, onOpenModal: (account: Account) => void, onCopy: (account: Account) => void, onDelete: (code: string) => void }) => {
  return (
    <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
      <td className="px-8 py-5 font-mono font-bold text-slate-700 dark:text-slate-300">{acc.code}</td>
      <td className="px-8 py-5 font-medium text-slate-900 dark:text-white">{acc.name}</td>
      <td className="px-8 py-5">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Classe {acc.class_code}
        </span>
      </td>
      <td className="px-8 py-5">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border
          ${acc.type === 'actif' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30' : 
            acc.type === 'passif' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30' :
            acc.type === 'charge' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30' :
            acc.type === 'produit' ? 'bg-brand-green/10 dark:bg-brand-green/20 text-brand-green dark:text-brand-green-light border-brand-green/20 dark:border-brand-green/30' :
            'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-700'
          }`}>
          {acc.type}
        </span>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => onOpenModal(acc)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green-light hover:bg-brand-green/5 dark:hover:bg-brand-green/10 rounded-lg transition-colors"
            title="Modifier"
          >
            <Pencil size={16} />
          </button>
          <button 
            onClick={() => onCopy(acc)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Copier"
          >
            <Copy size={16} />
          </button>
          <button 
            onClick={() => onDelete(acc.code)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

export function Accounts() {
  const { alert: dialogAlert } = useDialog();
  const { confirm, alert } = useDialog();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // Audit Results
  const [auditResults, setAuditResults] = useState<{ id: string, title: string, description: string, type: 'warning' | 'info' | 'error', accountsAffected: string[] }[]>([]);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('actif');

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<{code: string, name: string, type: string, class: string, tax_code: string}>({ code: '', name: '', type: '', class: '', tax_code: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [isImportValidationModalOpen, setIsImportValidationModalOpen] = useState(false);
  const [pendingAccountsToImport, setPendingAccountsToImport] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = () => {
    setLoading(true);
    apiFetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        generateAudit(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  };

  const generateAudit = (accs: Account[]) => {
    const results: typeof auditResults = [];
    const accCodes = accs.map(a => a.code);
    
    // Règle 1: Suppression des frais d'établissement (201)
    const has201 = accs.filter(a => a.code.startsWith('201'));
    if (has201.length > 0) {
      results.push({
        id: 'rule_1',
        title: "Comptes de frais d'établissement obsolètes",
        description: "Le SYSCOHADA révisé exige de comptabiliser directement en charges les frais d'établissement. Les comptes 201 ne doivent plus être utilisés ni capitalisés.",
        type: 'error',
        accountsAffected: has201.map(a => a.code)
      });
    }

    // Règle 2: Provisions de retraite (169)
    const has169 = accs.filter(a => a.code.startsWith('169'));
    if (has169.length === 0) {
      results.push({
        id: 'rule_2',
        title: "Absence de provisions pour retraite",
        description: "Il est fortement recommandé/obligatoire de provisionner les indemnités de fin de carrière (Comptes 169) si vous avez des employés.",
        type: 'warning',
        accountsAffected: []
      });
    }

    // Règle 3: Comptabilité analytique
    const hasClass9 = accs.filter(a => a.code.startsWith('9'));
    if (hasClass9.length === 0) {
      results.push({
        id: 'rule_3',
        title: "Organisation de la comptabilité analytique",
        description: "Le PCGO recommande de ventiler les coûts. En l'absence de classe 9, assurez-vous que les subdivisions des classes 6, 7 et 8 sont suffisantes pour le suivi par composant/bureau.",
        type: 'info',
        accountsAffected: []
      });
    }
    
    // Règle 4: Amortissement par composants
    const hasComplexAssets = accs.filter(a => ['213', '215'].some(prefix => a.code.startsWith(prefix) && a.code.length === 3));
    if (hasComplexAssets.length > 0) {
      results.push({
        id: 'rule_4',
        title: "Approche par composants (Amortissement)",
        description: "Pour les grandes immobilisations (Bâtiments, Matériels industriels), il faut créer des subdivisions pour séparer la structure principale des sous-composants (ex: 2131 Toiture).",
        type: 'info',
        accountsAffected: hasComplexAssets.map(a => a.code)
      });
    }

    setAuditResults(results);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setIsImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsImporting(false);
        if (results.data && results.data.length > 0) {
          setCsvData(results.data);
          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          
          // Auto-guess mapping
          const guessMapping = {
            code: headers.find(h => h.toLowerCase().includes('compte') || h.toLowerCase().includes('code')) || '',
            name: headers.find(h => h.toLowerCase().includes('intitul') || h.toLowerCase().includes('libell') || h.toLowerCase().includes('name')) || '',
            type: headers.find(h => h.toLowerCase().includes('type') || h.toLowerCase().includes('nature')) || '',
            class: headers.find(h => h.toLowerCase().includes('classe')) || '',
            tax_code: headers.find(h => h.toLowerCase().includes('taxe') || h.toLowerCase().includes('tva')) || '',
          };
          setColumnMapping(guessMapping);
        } else {
          dialogAlert("Le fichier semble vide ou mal formaté.", "error");
        }
      },
      error: (error) => {
        setIsImporting(false);
        dialogAlert(`Erreur de lecture du fichier: ${error.message}`, "error");
      }
    });
  };

  const submitImport = () => {
    if (!columnMapping.code || !columnMapping.name) {
      dialogAlert("Veuillez mapper au moins le Code et l'Intitulé du compte.", "error");
      return;
    }

    const accountsToImport = csvData.map(row => {
      const rowCode = String(row[columnMapping.code] || '').trim();
      const rowName = String(row[columnMapping.name] || '').trim();
      const rowType = columnMapping.type ? String(row[columnMapping.type] || '').trim().toLowerCase() : 'actif';
      const rowTaxCode = columnMapping.tax_code ? String(row[columnMapping.tax_code] || '').trim() : '';
      
      let classCode = parseInt(rowCode.charAt(0)) || 0;
      if (columnMapping.class && row[columnMapping.class]) {
        classCode = parseInt(String(row[columnMapping.class]).trim()) || classCode;
      }
      
      return {
        code: rowCode,
        name: rowName,
        class_code: classCode,
        type: ['actif', 'passif', 'charge', 'produit', 'capitaux'].includes(rowType) ? rowType : 'actif',
        tax_code: rowTaxCode
      };
    }).filter(acc => acc.code && acc.name);

    if (accountsToImport.length === 0) {
      dialogAlert("Aucun compte valide trouvé après le mappage.", "error");
      return;
    }

    setPendingAccountsToImport(accountsToImport);
    setIsImportValidationModalOpen(true);
  };

  const confirmImportAccounts = async () => {
    setIsImporting(true);
    try {
      const res = await apiFetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingAccountsToImport)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        dialogAlert(data.message || "Importation réussie", "success");
        setIsImportModalOpen(false);
        setIsImportValidationModalOpen(false);
        setImportFile(null);
        setCsvData([]);
        setPendingAccountsToImport([]);
        fetchAccounts();
      } else {
        dialogAlert(data.error || "Une erreur est survenue lors de l'importation.", "error");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur de connexion lors de l'importation.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredAccounts = React.useMemo(() => {
    return accounts.filter(acc => 
      acc.code.includes(searchTerm) || acc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [accounts, searchTerm]);

  const handleOpenModal = (account?: Account) => {
    if (account) {
      setEditingCode(account.code);
      setCode(account.code);
      setName(account.name);
      setType(account.type);
    } else {
      setEditingCode(null);
      setCode('');
      setName('');
      setType('actif');
    }
    setIsModalOpen(true);
  };

  const handleCopy = (account: Account) => {
    setEditingCode(null);
    setCode(account.code);
    setName(`${account.name} (Copie)`);
    setType(account.type);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const classCode = parseInt(code.charAt(0)) || 0;
    const payload = { code, name, class_code: classCode, type };
    
    try {
      const url = editingCode ? `/api/accounts/${editingCode}` : '/api/accounts';
      const method = editingCode ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchAccounts();
      } else {
        const data = await res.json();
        dialogAlert(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur de connexion");
    }
  };

  const handleDelete = async (code: string) => {
    const confirmed = await confirm(`Êtes-vous sûr de vouloir supprimer le compte ${code} ?`);
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/accounts/${code}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAccounts();
      } else {
        const data = await res.json();
        dialogAlert(data.error || "Impossible de supprimer ce compte");
      }
    } catch (err) {
      console.error(err);
      dialogAlert("Erreur de connexion");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <PageHeader
        title="Plan Comptable"
        subtitle="SYSCOHADA Révisé"
        icon={<Calculator size={24} />}
        actions={
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2 sm:py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Upload size={18} />
              <span className="hidden sm:inline">Importer</span>
            </button>
            <button 
              onClick={() => setIsAuditModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 sm:py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Sparkles size={18} />
              <span className="hidden sm:inline">Audit SYSCOHADA</span>
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-brand-green hover:bg-brand-green-light text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-green/20 active:scale-95 whitespace-nowrap"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nouveau Compte</span>
              <span className="sm:hidden">Nouveau</span>
            </button>
          </div>
        }
      />

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50/30 dark:bg-slate-900/50">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un compte (ex: 411, Clients)..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-3 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 shadow-sm transition-colors">
            <Filter size={20} />
          </button>
        </div>

        <div className="w-full min-w-0 overflow-auto ">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-8 py-5">Code</th>
                <th className="px-8 py-5">Intitulé du Compte</th>
                <th className="px-8 py-5">Classe</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">Chargement du plan comptable...</td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">Aucun compte trouvé.</td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <AccountRow 
                    key={acc.code} 
                    acc={acc} 
                    onOpenModal={handleOpenModal} 
                    onCopy={handleCopy} 
                    onDelete={handleDelete} 
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center p-4 animate-in fade-in duration-200 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingCode ? "Modifier le Compte" : "Nouveau Compte"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code Compte</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={!!editingCode}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-500 dark:disabled:text-slate-600 transition-colors"
                  placeholder="Ex: 411"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Intitulé</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                  placeholder="Ex: Clients"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
                >
                  <option value="actif">Actif</option>
                  <option value="passif">Passif</option>
                  <option value="charge">Charge</option>
                  <option value="produit">Produit</option>
                  <option value="capitaux">Capitaux Propres</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="bg-brand-green hover:bg-brand-green-light text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-brand-green/20 transition-all flex items-center gap-2"
                >
                  <Check size={18} />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center p-4 animate-in fade-in duration-200 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={24} className="text-purple-600" />
                Audit SYSCOHADA Révisé
              </h2>
              <button 
                onClick={() => setIsAuditModalOpen(false)} 
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Fermer"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4 px-1">
                Voici une analyse de la conformité de votre plan comptable selon le référentiel actuel (PCGO).
              </p>
              
              {auditResults.length === 0 ? (
                <div className="bg-brand-green/10 text-brand-green p-6 rounded-2xl text-center font-bold">
                  Aucun défaut de conformité détecté pour le moment.
                </div>
              ) : (
                auditResults.map((result, idx) => (
                  <div key={result.id} className={`p-5 rounded-2xl border ${
                    result.type === 'error' ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400' :
                    result.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-500' :
                    'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    <h3 className="font-bold flex items-center gap-2 mb-2">
                      {result.type === 'error' ? <AlertTriangle size={18} /> : 
                       result.type === 'warning' ? <AlertTriangle size={18} /> : 
                       <Info size={18} />}
                      {result.title}
                    </h3>
                    <p className="text-sm font-medium mb-3 opacity-90 leading-relaxed">{result.description}</p>
                    {result.accountsAffected.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Comptes impactés :</span>
                        {result.accountsAffected.map(acc => (
                           <span key={acc} className="px-2 py-0.5 rounded-md text-xs font-bold leading-none bg-black/5 dark:bg-white/10">
                             {acc}
                           </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="flex justify-end pt-6 mt-2 border-t border-slate-100 dark:border-slate-800">
               <button 
                 onClick={() => setIsAuditModalOpen(false)}
                 className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
               >
                 Compris
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 animate-in fade-in duration-200 overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 elevate-3 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload size={24} className="text-brand-green" />
                Importer des Comptes
              </h2>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setCsvData([]); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isImporting}
                />
                
                <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  {importFile ? importFile.name : "Sélectionner un fichier CSV"}
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Format attendu: CSV avec séparateur virgule ou point-virgule.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="mx-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                >
                  {isImporting ? <RefreshCw className="animate-spin" size={18} /> : "Parcourir..."}
                </button>
              </div>

              {csvData.length > 0 && csvHeaders.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    Mappage des colonnes
                    <span className="text-sm font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      {csvData.length} lignes détectées
                    </span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Code Compte <span className="text-rose-500">*</span>
                      </div>
                      <select 
                        value={columnMapping.code}
                        onChange={(e) => setColumnMapping({...columnMapping, code: e.target.value})}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-green outline-none"
                      >
                        <option value="">Sélectionner une colonne...</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Intitulé (Nom) <span className="text-rose-500">*</span>
                      </div>
                      <select 
                        value={columnMapping.name}
                        onChange={(e) => setColumnMapping({...columnMapping, name: e.target.value})}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-green outline-none"
                      >
                        <option value="">Sélectionner une colonne...</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Classe (Optionnel)
                      </div>
                      <select 
                        value={columnMapping.class}
                        onChange={(e) => setColumnMapping({...columnMapping, class: e.target.value})}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-green outline-none"
                      >
                        <option value="">Auto (déduit du code)</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center mb-2">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Type (Optionnel)
                      </div>
                      <select 
                        value={columnMapping.type}
                        onChange={(e) => setColumnMapping({...columnMapping, type: e.target.value})}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-green outline-none"
                      >
                        <option value="">Par défaut (Actif)</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-center mb-2">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Code Taxe / TVA (Optionnel)
                      </div>
                      <select 
                        value={columnMapping.tax_code}
                        onChange={(e) => setColumnMapping({...columnMapping, tax_code: e.target.value})}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-green outline-none"
                      >
                        <option value="">Ignorer</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3 text-blue-700 dark:text-blue-400 text-sm">
                      <AlertCircle className="shrink-0 mt-0.5" size={16} />
                      <p>
                        Les valeurs pour "Type" doivent correspondre à: <strong>actif, passif, charge, produit, capitaux</strong>.
                        Si la colonne Type n'est pas renseignée ou contient une autre valeur, "actif" sera utilisé par défaut.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => { setIsImportModalOpen(false); setImportFile(null); setCsvData([]); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button 
                type="button"
                onClick={submitImport}
                disabled={csvData.length === 0 || !columnMapping.code || !columnMapping.name || isImporting}
                className="bg-brand-green hover:bg-brand-green-light disabled:opacity-50 disabled:hover:bg-brand-green text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-brand-green/20 transition-all flex items-center gap-2"
              >
                {isImporting ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                Importer ({csvData.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Import Validation Modal */}
      {isImportValidationModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all animate-in fade-in duration-300 overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <AlertCircle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Validation Pré-Import</h2>
                  <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                    Vérification des comptes antes l'import définitif
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImportValidationModalOpen(false);
                  setPendingAccountsToImport([]);
                }}
                className="p-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 min-h-0 w-full space-y-6">
              {(() => {
                const missingTax = pendingAccountsToImport.filter(acc => 
                  (String(acc.class_code) === '6' || String(acc.class_code) === '7') && !acc.tax_code
                );

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total des comptes</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{pendingAccountsToImport.length}</span>
                      </div>
                      <div className={cn("p-4 rounded-2xl border flex flex-col gap-2 transition-colors", missingTax.length > 0 ? "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 text-amber-600" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10 text-emerald-600")}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Taxes potentielles manquantes</span>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-black">{missingTax.length}</span>
                          {missingTax.length > 0 && <span className="text-xs font-medium opacity-80">Comptes de charges/produits sans code taxe</span>}
                        </div>
                      </div>
                    </div>

                    {missingTax.length > 0 && (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 text-sm flex gap-3 border border-amber-200 dark:border-amber-900/50">
                        <AlertCircle className="shrink-0 mt-0.5" size={16} />
                        <p>
                          <strong>Attention :</strong> {missingTax.length} comptes de classe 6 ou 7 n'ont pas de code de taxe / TVA associé. Il est recommandé de configurer un code de taxe pour les comptes de charges et produits.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
              <button 
                onClick={() => {
                  setIsImportValidationModalOpen(false);
                  setPendingAccountsToImport([]);
                }}
                className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-xl transition-colors"
                disabled={isImporting}
              >
                Annuler
              </button>
              <button 
                onClick={confirmImportAccounts}
                disabled={isImporting}
                className="px-8 py-2.5 bg-brand-green text-white rounded-xl font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green/90 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
                Forcer l'importation
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
