import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Pencil, Trash2, X, Check, Copy } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { useDialog } from './DialogProvider';

interface Account {
  code: string;
  name: string;
  class_code: number;
  type: string;
}

export function Accounts() {
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

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = () => {
    setLoading(true);
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
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
        alert(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion");
    }
  };

  const handleDelete = async (code: string) => {
    const confirmed = await confirm(`Êtes-vous sûr de vouloir supprimer le compte ${code} ?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/accounts/${code}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || "Impossible de supprimer ce compte");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plan Comptable</h1>
          <p className="text-slate-500 dark:text-slate-400">SYSCOHADA Révisé</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-green hover:bg-brand-green-light text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-lg shadow-brand-green/20"
        >
          <Plus size={18} />
          Nouveau Compte
        </button>
      </div>

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
    </div>
  );
}
