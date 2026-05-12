import { apiFetch } from '../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Pencil, Trash2, X, Check, Copy, Upload, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useDialog } from './DialogProvider';
import Papa from 'papaparse';

import { PageHeader } from './ui/PageHeader';
import { Calculator } from 'lucide-react';

interface Account {
  code: string;
  name: string;
  class_code: number;
  type: string;
}

export function Accounts() {
  const { alert: dialogAlert } = useDialog();
  const { confirm, alert } = useDialog();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('actif');

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<{code: string, name: string, type: string, class: string}>({ code: '', name: '', type: '', class: '' });
  const [isImporting, setIsImporting] = useState(false);
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
        setLoading(false);
      })
      .catch(err => console.error(err));
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

  const submitImport = async () => {
    if (!columnMapping.code || !columnMapping.name) {
      dialogAlert("Veuillez mapper au moins le Code et l'Intitulé du compte.", "error");
      return;
    }

    setIsImporting(true);

    const accountsToImport = csvData.map(row => {
      const rowCode = String(row[columnMapping.code] || '').trim();
      const rowName = String(row[columnMapping.name] || '').trim();
      const rowType = columnMapping.type ? String(row[columnMapping.type] || '').trim().toLowerCase() : 'actif';
      
      let classCode = parseInt(rowCode.charAt(0)) || 0;
      if (columnMapping.class && row[columnMapping.class]) {
        classCode = parseInt(String(row[columnMapping.class]).trim()) || classCode;
      }
      
      return {
        code: rowCode,
        name: rowName,
        class_code: classCode,
        type: ['actif', 'passif', 'charge', 'produit', 'capitaux'].includes(rowType) ? rowType : 'actif',
      };
    }).filter(acc => acc.code && acc.name);

    if (accountsToImport.length === 0) {
      dialogAlert("Aucun compte valide trouvé après le mappage.", "error");
      setIsImporting(false);
      return;
    }

    try {
      const res = await fetch('/api/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountsToImport)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        dialogAlert(data.message || "Importation réussie", "success");
        setIsImportModalOpen(false);
        setImportFile(null);
        setCsvData([]);
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

  const filteredAccounts = accounts.filter(acc => 
    acc.code.includes(searchTerm) || acc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      
      const res = await fetch(url, {
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
    <div className="space-y-6">
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

        <div className="overflow-x-auto">
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
                  <tr key={acc.code} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
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
                          onClick={() => handleOpenModal(acc)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-green dark:hover:text-brand-green-light hover:bg-brand-green/5 dark:hover:bg-brand-green/10 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleCopy(acc)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Copier"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(acc.code)}
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
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

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl p-6 elevate-3 flex flex-col max-h-[90vh]">
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
    </div>
  );
}
