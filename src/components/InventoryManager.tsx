import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, AlertTriangle, ArrowUpRight, ArrowDownRight, Edit2, Trash2, TrendingDown, TrendingUp, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '@/lib/api';
import { useDialog } from './DialogProvider';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

export default function InventoryManager() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { alert: dialogAlert, confirm } = useDialog();
  const { formatCurrency } = useCurrency();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ reference: '', name: '', category: 'Général', unit: 'unité', min_quantity: 0, quantity: 0, unit_price: 0 });

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [movementData, setMovementData] = useState({ type: 'in', quantity: 0, date: new Date().toISOString().split('T')[0], reason: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/inventory');
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.reference) {
      return dialogAlert("Veuillez remplir les champs obligatoires", "error");
    }
    try {
      const url = editingItem ? `/api/inventory/${editingItem.id}` : '/api/inventory';
      const method = editingItem ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        dialogAlert(editingItem ? "Article modifié" : "Article ajouté avec succès", "success");
        setIsModalOpen(false);
        fetchInventory();
      } else {
        const error = await res.json();
        dialogAlert(error.error || "Erreur lors de l'enregistrement", "error");
      }
    } catch (e) {
      dialogAlert("Erreur réseau", "error");
    }
  };

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm("Êtes-vous sûr de vouloir supprimer cet article ?");
    if (!isConfirmed) return;
    
    try {
      const res = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (res.ok) {
        dialogAlert("Article supprimé", "success");
        fetchInventory();
      } else {
        dialogAlert("Erreur lors de la suppression", "error");
      }
    } catch(e) {
       dialogAlert("Erreur réseau", "error");
    }
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (movementData.quantity <= 0) return dialogAlert("La quantité doit être supérieure à 0", "error");
    
    try {
      const res = await apiFetch(`/api/inventory/${selectedItem.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movementData)
      });
      if (res.ok) {
        dialogAlert("Mouvement enregistré", "success");
        setIsMovementModalOpen(false);
        fetchInventory();
      } else {
        const err = await res.json();
        dialogAlert(err.error || "Erreur lors du mouvement", "error");
      }
    } catch(e) {
        dialogAlert("Erreur réseau", "error");
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      reference: item.reference, name: item.name, category: item.category || 'Général', unit: item.unit || 'unité', min_quantity: item.min_quantity || 0, quantity: item.quantity, unit_price: item.unit_price
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ reference: '', name: '', category: 'Général', unit: 'unité', min_quantity: 0, quantity: 0, unit_price: 0 });
    setIsModalOpen(true);
  };

  const openMovementModal = (item: any, type: 'in' | 'out') => {
    setSelectedItem(item);
    setMovementData({ type, quantity: 0, date: new Date().toISOString().split('T')[0], reason: type === 'in' ? 'Achat fournisseur' : 'Vente client' });
    setIsMovementModalOpen(true);
  };

  const categories = [...new Set(items.map(i => i.category || 'Général'))];
  
  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.reference.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter ? (i.category || 'Général') === categoryFilter : true;
    return matchesSearch && matchesCat;
  });

  const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const lowStockItems = items.filter(i => i.quantity <= (i.min_quantity || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="text-brand-green" size={28} />
            Gestion des stocks
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Suivi des articles, alertes, et valorisation globale (FIFO/CUMP ajusté).</p>
        </div>
        <button onClick={openCreateModal} className="bg-brand-green text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-brand-green/90 transition-colors shadow-sm">
          <Plus size={18} />
          Nouvel Article
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Total Articles</h3>
            <div className="text-3xl font-black text-slate-900 dark:text-white">{items.length}</div>
         </div>
         <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Valorisation Globale</h3>
            <div className="text-3xl font-black text-brand-green">{formatCurrency(totalValue)}</div>
         </div>
         <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-100 dark:border-rose-900/30 p-6 shadow-sm">
            <h3 className="text-sm font-black text-rose-400 uppercase tracking-widest mb-2 flex flex-center gap-2"><AlertTriangle size={16}/> Stock Critique</h3>
            <div className="text-3xl font-black text-rose-500">{lowStockItems.length}</div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher (référence, nom)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-brand-green"
            />
          </div>
          <div className="relative md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm appearance-none focus:ring-2 focus:ring-brand-green font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="">Toutes les catégories</option>
              {categories.map(c => <option key={String(c)} value={String(c)}>{c}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
           <div className="text-center py-20 flex justify-center"><div className="animate-spin w-8 h-8 rounded-full border-4 border-brand-green border-t-transparent" /></div>
        ) : filteredItems.length === 0 ? (
           <div className="text-center py-20">
             <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
             <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun article trouvé.</p>
           </div>
        ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest">
                   <th className="py-4 px-6">Article</th>
                   <th className="py-4 px-6">Catégorie</th>
                   <th className="py-4 px-6 text-right">Quantité</th>
                   <th className="py-4 px-6 text-right">Valorisation</th>
                   <th className="py-4 px-6 text-center">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredItems.map(item => {
                   const isLow = item.quantity <= (item.min_quantity || 0);
                   return (
                   <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 group">
                     <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{item.reference}</div>
                     </td>
                     <td className="py-4 px-6">
                       <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                         {item.category || 'Général'}
                       </span>
                     </td>
                     <td className="py-4 px-6 text-right">
                       <div className={cn("text-lg font-black", isLow ? "text-rose-500" : "text-slate-900 dark:text-white")}>
                         {item.quantity} {item.unit}
                       </div>
                       {item.min_quantity > 0 && <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Min: {item.min_quantity}</div>}
                     </td>
                     <td className="py-4 px-6 text-right">
                        <div className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.unit_price)} / {item.unit}</div>
                        <div className="text-xs text-brand-green font-bold mt-0.5">{formatCurrency(item.quantity * item.unit_price)}</div>
                     </td>
                     <td className="py-4 px-6 text-center">
                       <div className="flex items-center justify-center gap-1">
                         <button onClick={() => openMovementModal(item, 'in')} className="p-2 hover:bg-brand-green/10 text-brand-green rounded-xl transition-colors tooltip-trigger" title="Entrée de stock">
                           <ArrowDownRight size={16} />
                         </button>
                         <button onClick={() => openMovementModal(item, 'out')} className="p-2 hover:bg-amber-500/10 text-amber-500 rounded-xl transition-colors tooltip-trigger" title="Sortie de stock">
                           <ArrowUpRight size={16} />
                         </button>
                         <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                         <button onClick={() => openEditModal(item)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors">
                           <Edit2 size={16} />
                         </button>
                         <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors">
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </td>
                   </tr>
                 )})}
               </tbody>
             </table>
           </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col mx-4">
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{editingItem ? 'Modifier l\'article' : 'Nouvel Article'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fiche d'inventaire</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white dark:hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-95 border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                   <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence <span className="text-rose-500">*</span></label>
                    <input autoFocus required type="text" value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" placeholder="REF-001" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" placeholder="Ex: Informatique" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Désignation complète <span className="text-rose-500">*</span></label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité de mesure</label>
                    <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" placeholder="unité, kg, litre..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Unitaire HT Base</label>
                    <input type="number" step="0.01" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none text-right" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{editingItem ? "Quantité Actuelle" : "Quantité Initiale"}</label>
                    <input type="number" disabled={!!editingItem} value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold text-sm text-right disabled:opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alerte Stock Min</label>
                    <input type="number" value={formData.min_quantity} onChange={e => setFormData({...formData, min_quantity: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-rose-200 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-rose-500/20 outline-none text-right font-mono" />
                  </div>
                </div>
                
                {!editingItem && (
                   <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={18} />
                      <div className="text-xs text-amber-700 dark:text-amber-400">En créant un article avec une quantité initiale supérieure à zéro, une écriture comptable d'entrée en stock sera automatiquement générée à la date du jour.</div>
                   </div>
                )}
                
                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">Annuler</button>
                  <button type="submit" className="flex-1 px-6 py-4 bg-brand-green text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-green/20 hover:bg-brand-green/90 transition-all active:scale-95 flex justify-center items-center gap-2"><Save size={16}/> Enregistrer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMovementModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsMovementModalOpen(false)} />
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col mx-4">
               <div className={cn("p-6 border-b border-slate-50 dark:border-slate-800", movementData.type === 'in' ? "bg-brand-green/10" : "bg-amber-500/10")}>
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <div className={cn("flex items-center gap-2 text-sm font-black uppercase tracking-widest", movementData.type === 'in' ? "text-brand-green" : "text-amber-500")}>
                           {movementData.type === 'in' ? <ArrowDownRight size={18}/> : <ArrowUpRight size={18} />}
                           {movementData.type === 'in' ? 'Entrée de Stock' : 'Sortie de Stock'}
                        </div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-2 truncate w-64">{selectedItem.name}</h4>
                        <div className="text-xs text-slate-500 font-mono">En stock: {selectedItem.quantity} {selectedItem.unit}</div>
                     </div>
                     <button onClick={() => setIsMovementModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"><X size={20}/></button>
                  </div>
               </div>
               <form onSubmit={handleMovement} className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                        <input type="date" required value={movementData.date} onChange={e => setMovementData({...movementData, date: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité</label>
                        <input type="number" required min="1" max={movementData.type === 'out' ? selectedItem.quantity : undefined} value={movementData.quantity || ''} onChange={e => setMovementData({...movementData, quantity: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-xl font-mono text-center focus:ring-4 focus:ring-brand-green/20 outline-none" />
                     </div>
                  </div>
                  
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motif / Justificatif</label>
                     <input type="text" required placeholder="Ex: Livraison, Casse..." value={movementData.reason} onChange={e => setMovementData({...movementData, reason: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-sm focus:ring-4 focus:ring-brand-green/20 outline-none" />
                  </div>

                  <p className="text-xs text-slate-500 text-center">Une écriture comptable de variation de stock ({(movementData.quantity * selectedItem.unit_price).toLocaleString()} {useCurrency().currency}) sera générée automatiquement.</p>

                  <button type="submit" className={cn("w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all active:scale-95", movementData.type === 'in' ? "bg-brand-green shadow-brand-green/20 hover:bg-brand-green/90" : "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600")}>
                     Confirmer le Mouvement
                  </button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

