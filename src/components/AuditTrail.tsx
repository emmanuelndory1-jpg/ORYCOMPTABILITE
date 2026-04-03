import React, { useState, useEffect } from 'react';
import { History, Search, Filter, User, Calendar, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: number;
  date: string;
  user: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
}

export function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-brand-green-dark dark:text-brand-green-light bg-brand-green/10 dark:bg-brand-green/20 border-brand-green/20 dark:border-brand-green/30';
      case 'UPDATE': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40';
      case 'DELETE': return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/40';
      default: return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    }
  };

  const formatDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return (
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 overflow-x-auto transition-colors">
          {JSON.stringify(parsed, null, 2)}
        </div>
      );
    } catch (e) {
      return <span className="text-sm text-slate-500 dark:text-slate-400">{details}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="text-brand-green" />
          Journal d'Audit
        </h1>
        <p className="text-slate-500 dark:text-slate-400">Traçabilité des actions et modifications système</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 transition-colors">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher (Utilisateur, Entité, Détails...)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400 dark:text-slate-500" />
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-colors"
          >
            <option value="ALL">Toutes les actions</option>
            <option value="CREATE">Création</option>
            <option value="UPDATE">Modification</option>
            <option value="DELETE">Suppression</option>
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-brand-green" size={32} />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Aucun journal d'audit trouvé.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={cn("px-2 py-1 rounded text-xs font-bold uppercase border w-20 text-center shrink-0", getActionColor(log.action))}>
                    {log.action}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{log.entity}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">#{log.entity_id}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <div className="flex items-center gap-1">
                        <User size={12} />
                        {log.user}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(log.date).toLocaleString()}
                      </div>
                    </div>

                    {formatDetails(log.details)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
