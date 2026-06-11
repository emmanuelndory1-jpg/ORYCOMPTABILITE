import React, { useState, useEffect } from 'react';
import { PageHeader } from './ui/PageHeader';
import { Target, Users, MapPin, Search, Plus, Filter, LayoutGrid, LayoutList, ChevronRight, Phone, Mail, MoreHorizontal, Calendar, Star, DollarSign, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';

interface CRMDeal {
  id: string | number;
  third_party_id: number;
  title: string;
  value: number;
  probability: number;
  stage: 'prospect' | 'contacted' | 'proposal' | 'won' | 'lost';
  expected_close_date: string;
  department?: string;
}

import { useSearchParams } from 'react-router-dom';

export function CRMManager() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('client') || '';
  const [clients, setClients] = useState<any[]>([]);
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const { formatCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CRMDeal | null>(null);
  
  const [formData, setFormData] = useState<Partial<CRMDeal>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, dealsRes] = await Promise.all([
        apiFetch('/api/third-parties?type=client'),
        apiFetch('/api/crm/deals')
      ]);
      setClients(await clientsRes.json());
      setDeals(await dealsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenModal = (deal?: CRMDeal) => {
    if (deal) {
      setEditingDeal(deal);
      setFormData(deal);
    } else {
      setEditingDeal(null);
      setFormData({
        title: '',
        third_party_id: clients.length > 0 ? clients[0].id : 0,
        value: 0,
        probability: 50,
        stage: 'prospect',
        expected_close_date: new Date().toISOString().split('T')[0],
        department: 'Ventes'
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveDeal = async () => {
    if (!formData.title || !formData.third_party_id) return;
    
    try {
      if (editingDeal) {
        await apiFetch(`/api/crm/deals/${editingDeal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await apiFetch('/api/crm/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleDeleteDeal = async (id: string | number) => {
    if (confirm("Supprimer cette affaire ?")) {
       try {
         await apiFetch(`/api/crm/deals/${id}`, { method: 'DELETE' });
         fetchData();
       } catch (e) {
         console.error(e);
       }
    }
  };

  const stages = [
    { id: 'prospect', label: 'Prospects', color: 'bg-slate-100 dark:bg-slate-800' },
    { id: 'contacted', label: 'Contactés', color: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'proposal', label: 'Propositions', color: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'won', label: 'Gagnés', color: 'bg-emerald-50 dark:bg-emerald-900/20' },
  ];

  const handleDragStart = (e: React.DragEvent, dealId: string | number) => {
    e.dataTransfer.setData('dealId', dealId.toString());
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId) {
      const dealToUpdate = deals.find(d => d.id.toString() === dealId);
      if (dealToUpdate) {
          // Optimistic UI update
          setDeals(prev => prev.map(d => d.id.toString() === dealId ? { ...d, stage: stageId as any } : d));
          try {
            await apiFetch(`/api/crm/deals/${dealId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...dealToUpdate, stage: stageId })
            });
          } catch (e) {
            console.error(e);
            fetchData(); // Revert on failure
          }
      }
    }
  };

  const filteredDeals = deals.filter(d => {
    const term = searchTerm.toLowerCase();
    const titleMatch = (d.title || '').toLowerCase().includes(term);
    const client = clients.find(c => c.id === d.third_party_id);
    const clientMatch = client && (client.name || '').toLowerCase().includes(term);
    return titleMatch || clientMatch;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Target className="text-brand-green" size={32} />
            CRM & Pipeline Sales
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
            Analysez votre entonnoir de conversion. <span className="px-2 py-0.5 rounded text-xs font-bold bg-brand-green/10 text-brand-green">Nouveau module</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Rechercher une affaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-green transition-all"
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green-dark transition-all shadow-lg flex items-center gap-2 transform active:scale-95"
          >
            <Plus size={20} />
            Nouvelle Affaire
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 overflow-auto flex  pb-4 gap-6 min-h-[600px]">
        {stages.map(stage => {
          const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div 
              key={stage.id}
              className={`kanban-column flex-1 min-w-[300px] max-w-[350px] rounded-2xl flex flex-col border border-black/5 dark:border-white/5 ${stage.color}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-black/5', 'dark:bg-white/5', 'scale-[1.01]', 'shadow-inner');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-black/5', 'dark:bg-white/5', 'scale-[1.01]', 'shadow-inner');
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove('bg-black/5', 'dark:bg-white/5', 'scale-[1.01]', 'shadow-inner');
                handleDrop(e, stage.id);
              }}
              style={{ transition: 'all 0.2s ease' }}
            >
              <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/20 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest text-sm flex items-center gap-2">
                    {stage.label}
                    <span className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-xs">{stageDeals.length}</span>
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">{formatCurrency(stageValue)}</p>
                </div>
              </div>
              <div className="p-4 flex-1 space-y-4 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {stageDeals.map(deal => {
                    const client = clients.find(c => c.id === deal.third_party_id);
                    return (
                      <motion.div
                        layout
                        layoutId={`card-${deal.id}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.02 }}
                        whileDrag={{ scale: 1.05, rotate: 2, zIndex: 50, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        key={deal.id}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, deal.id)}
                        className="p-5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 cursor-grab active:cursor-grabbing group relative"
                      >
                        <div className="flex justify-between items-start mb-2 group/header">
                          <h4 className="font-bold text-slate-900 dark:text-white leading-tight cursor-pointer hover:text-brand-green transition-colors" onClick={() => handleOpenModal(deal)}>{deal.title}</h4>
                          <button onClick={() => handleDeleteDeal(deal.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover/header:opacity-100 transition-opacity p-1">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mb-3 font-medium">
                          <Briefcase size={12} />
                          {client ? client.name : 'Client prospect'}
                        </p>
                        <div className="mb-4">
                           <div className="flex justify-between items-center text-[10px] mb-1">
                             <span className="text-slate-500 font-bold uppercase">Probabilité</span>
                             <span className="text-brand-green font-black">{deal.probability || 0}%</span>
                           </div>
                           <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                             <div className="bg-brand-green h-1.5 rounded-full" style={{ width: `${deal.probability || 0}%` }} />
                           </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-black text-brand-green-light tracking-tight">{formatCurrency(deal.value)}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                            <Calendar size={10} />
                            {new Date(deal.expected_close_date || new Date()).toLocaleDateString()}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {stageDeals.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium opacity-50 bg-white/20 dark:bg-black/20">
                    Glissez une affaire ici
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Target className="text-brand-green" size={20} />
            Taux de conversion par Client
          </h2>
          <div className="space-y-4">
            {Object.entries(
              deals.reduce((acc, deal) => {
                const clientName = clients.find(c => c.id === deal.third_party_id)?.name || 'Client Inconnu';
                if (!acc[clientName]) acc[clientName] = { total: 0, won: 0 };
                acc[clientName].total++;
                if (deal.stage === 'won') acc[clientName].won++;
                return acc;
              }, {} as Record<string, { total: number; won: number }>)
            ).map(([clientName, stats]) => {
              const conversionRate = Math.round((stats.won / stats.total) * 100);
              return (
                <div key={clientName} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">{clientName}</span>
                    <span className={conversionRate > 50 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                      {conversionRate}% ({stats.won}/{stats.total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${conversionRate > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${conversionRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Briefcase className="text-brand-green" size={20} />
            Taux de conversion par Département
          </h2>
          <div className="space-y-4">
            {Object.entries(
              deals.reduce((acc, deal) => {
                const dept = deal.department || 'Non assigné';
                if (!acc[dept]) acc[dept] = { total: 0, won: 0 };
                acc[dept].total++;
                if (deal.stage === 'won') acc[dept].won++;
                return acc;
              }, {} as Record<string, { total: number; won: number }>)
            ).map(([dept, stats]) => {
              const conversionRate = Math.round((stats.won / stats.total) * 100);
              return (
                <div key={dept} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-700 dark:text-slate-300">{dept}</span>
                    <span className={conversionRate > 50 ? 'text-blue-500 font-bold' : 'text-slate-500 font-bold'}>
                      {conversionRate}% ({stats.won}/{stats.total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${conversionRate > 50 ? 'bg-blue-500' : 'bg-slate-400'}`}
                      style={{ width: `${conversionRate}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Modal Edition / Creation */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-center p-4 bg-slate-900/40 backdrop-blur-sm items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <h2 className="text-2xl font-black mb-6 text-slate-900 dark:text-white tracking-tight">
                {editingDeal ? 'Modifier l\'affaire' : 'Nouvelle affaire'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Titre de l'affaire</label>
                  <input type="text" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Client</label>
                    <select value={formData.third_party_id || ''} onChange={e => setFormData({...formData, third_party_id: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none">
                      <option value={0}>Sélectionner...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Valeur (FCFA)</label>
                    <input type="number" value={formData.value || ''} onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Département</label>
                    <input type="text" value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Statut</label>
                    <select value={formData.stage || 'prospect'} onChange={e => setFormData({...formData, stage: e.target.value as any})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none">
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      <option value="lost">Perdu</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date Prévue</label>
                     <input type="date" value={formData.expected_close_date ? formData.expected_close_date.split('T')[0] : ''} onChange={e => setFormData({...formData, expected_close_date: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-green outline-none" />
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Probabilité ({formData.probability}%)</label>
                     <input type="range" min="0" max="100" step="5" value={formData.probability || 0} onChange={e => setFormData({...formData, probability: parseInt(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-3" />
                   </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                 <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                   Annuler
                 </button>
                 <button onClick={handleSaveDeal} className="px-5 py-2.5 bg-brand-green text-white font-bold rounded-xl shadow-lg hover:bg-brand-green-dark transition-colors">
                   Enregistrer
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
