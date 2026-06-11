import React, { useState, useEffect } from 'react';
import { Building2, Plus, Check, Trash2, Edit2, Play, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export function WorkspacesManager() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('erp_workspaces');
    return saved ? JSON.parse(saved) : [{ id: 'default', name: 'Mon Entreprise Principale', role: 'Administrateur' }];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem('erp_active_workspace') || 'default';
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState('');

  useEffect(() => {
    localStorage.setItem('erp_workspaces', JSON.stringify(workspaces));
    window.dispatchEvent(new Event('workspaces_updated'));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem('erp_active_workspace', activeWorkspaceId);
    window.dispatchEvent(new Event('workspaces_updated'));
  }, [activeWorkspaceId]);

  const handleAddWorkspace = () => {
    if (!newWorkspace.trim()) return;
    const newId = Date.now().toString();
    setWorkspaces([...workspaces, { id: newId, name: newWorkspace.trim(), role: 'Administrateur' }]);
    setNewWorkspace('');
    setIsEditing(false);
  };

  const handleRemoveWorkspace = (id: string) => {
    if (workspaces.length <= 1) return;
    const newWorkspaces = workspaces.filter(w => w.id !== id);
    setWorkspaces(newWorkspaces);
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(newWorkspaces[0].id);
    }
  };

  return (
    <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
          <div className="w-1.5 h-4 bg-brand-green rounded-full" />
          Dossiers de Travail (Entités)
        </h3>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 bg-brand-green/10 text-brand-green rounded-xl hover:bg-brand-green hover:text-white transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workspaces.map((workspace) => (
          <div 
            key={workspace.id}
            onClick={() => setActiveWorkspaceId(workspace.id)}
            className={cn(
              "group p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden",
              activeWorkspaceId === workspace.id
                ? "border-brand-green bg-brand-green/5 ring-4 ring-brand-green/5"
                : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50"
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                activeWorkspaceId === workspace.id ? "bg-brand-green text-white shadow-lg shadow-brand-green/20" : "bg-white dark:bg-slate-800 text-slate-400 group-hover:scale-110"
              )}>
                <Building2 size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {workspace.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                     {workspace.role}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {workspaces.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveWorkspace(workspace.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {activeWorkspaceId === workspace.id && (
                  <div className="p-2 text-brand-green">
                    <Check size={20} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6 flex flex-col sm:flex-row gap-4 items-end"
        >
          <div className="flex-1 space-y-2 w-full">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              Nom de la nouvelle entité
            </label>
            <input 
              type="text"
              value={newWorkspace}
              onChange={(e) => setNewWorkspace(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all font-medium"
              placeholder="Ex: Ma Filiale..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddWorkspace();
              }}
            />
          </div>
          <button 
            onClick={handleAddWorkspace}
            disabled={!newWorkspace.trim()}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-brand-green text-white font-bold text-sm uppercase tracking-widest hover:bg-brand-green-light active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Créer
          </button>
        </motion.div>
      )}
    </div>
  );
}
