import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Plus, Trash2, Save, Edit2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  color: string;
  type: string;
  accounts: string[];
}

interface Account {
  code: string;
  name: string;
}

export function BudgetCategoriesSetup() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<{name: string, color: string, accounts: string[]}>({
    name: '',
    color: '#94a3b8',
    accounts: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catsRes, accsRes] = await Promise.all([
        apiFetch('/api/budgets/categories'),
        apiFetch('/api/accounts/expenses') // This only fetches 6% accounts for now
      ]);
      setCategories(await catsRes.json());
      setAllAccounts(await accsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isNew = editingId === null;
      const url = isNew ? '/api/budgets/categories' : `/api/budgets/categories/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';

      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...formData, type: 'expense'})
      });

      setEditingId(null);
      setFormData({ name: '', color: '#94a3b8', accounts: [] });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      color: cat.color,
      accounts: cat.accounts || []
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer cette catégorie ?")) return;
    try {
      await apiFetch(`/api/budgets/categories/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAccount = (code: string) => {
    setFormData(prev => ({
      ...prev,
      accounts: prev.accounts.includes(code)
        ? prev.accounts.filter(a => a !== code)
        : [...prev.accounts, code]
    }));
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-green" /></div>;

  return (
    <div className="space-y-6">
       <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-xl font-bold mb-4">Créer / Modifier une Catégorie Budgétaire</h2>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nom de la catégorie</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-xl"
                    placeholder="Ex: Frais de déplacement"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Couleur (pour graphiques)</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="h-10 w-full"
                  />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Comptes associés (Attributions automatiques)</label>
               <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/50">
                  {allAccounts.map(acc => (
                     <label key={acc.code} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                        <input
                           type="checkbox"
                           checked={formData.accounts.includes(acc.code)}
                           onChange={() => toggleAccount(acc.code)}
                           className="rounded text-brand-green focus:ring-brand-green"
                        />
                        <span className="text-sm truncate" title={`${acc.code} - ${acc.name}`}>
                           <span className="font-mono text-xs text-slate-500 mr-2">{acc.code}</span>
                           {acc.name}
                        </span>
                     </label>
                  ))}
               </div>
            </div>

            <div className="flex justify-end gap-2">
               {editingId !== null && (
                  <button type="button" onClick={() => { setEditingId(null); setFormData({name: '', color: '#94a3b8', accounts: []}); }} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl">
                     Annuler
                  </button>
               )}
               <button type="submit" className="px-6 py-2 bg-brand-green text-white rounded-xl shadow hover:scale-105 transition-transform flex items-center gap-2">
                  <Save size={16} /> {editingId ? 'Mettre à jour' : 'Créer'}
               </button>
            </div>
          </form>
       </div>

       <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
             <h3 className="font-bold">Liste des Catégories</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
             {categories.map(cat => (
                <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                   <div className="flex items-center gap-4">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                      <div>
                         <div className="font-semibold text-slate-800 dark:text-white">{cat.name}</div>
                         <div className="text-xs text-slate-500 mt-1">
                            {cat.accounts.length} comptes associés: {cat.accounts.slice(0, 5).join(', ')}{cat.accounts.length > 5 ? '...' : ''}
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={() => startEdit(cat)} className="p-2 text-slate-400 hover:text-brand-green bg-slate-100 dark:bg-slate-800 rounded-lg">
                         <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-100 dark:bg-slate-800 rounded-lg">
                         <Trash2 size={16} />
                      </button>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}
