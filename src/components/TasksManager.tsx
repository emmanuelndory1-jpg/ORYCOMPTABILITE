import React, { useState, useEffect } from 'react';
import { CheckSquare, Calendar as CalendarIcon, Plus, MoreVertical, Search, CheckCircle2, Clock, AlertCircle, LayoutList, CalendarDays, ChevronLeft, ChevronRight, X, Loader2, Trash2, FileText, Calendar, Repeat, CreditCard, Users, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { format, startOfMonth, startOfWeek, endOfMonth, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, parseISO, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { apiFetch } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

export function TasksManager() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [recurringTxs, setRecurringTxs] = useState<any[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [crmDeals, setCrmDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, completed
  const [sourceFilter, setSourceFilter] = useState('all'); // all, task, invoice, fiscal_year, recurring, payroll, transaction, asset, crm, advance
  const [view, setView] = useState<'list' | 'calendar' | 'week'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium', category: 'Général' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, invRes, fyRes, recTxRes, recInvRes, payrollRes, txRes, assetsRes, advRes] = await Promise.all([
        apiFetch('/api/tasks'),
        apiFetch('/api/invoices'),
        apiFetch('/api/fiscal-years'),
        apiFetch('/api/recurring-transactions'),
        apiFetch('/api/recurring-invoices'),
        apiFetch('/api/payroll/periods'),
        apiFetch('/api/transactions'), // Maybe limits size in future, but fine for now
        apiFetch('/api/assets'),
        apiFetch('/api/advances')
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (fyRes.ok) setFiscalYears(await fyRes.json());
      if (recTxRes.ok) setRecurringTxs(await recTxRes.json());
      if (recInvRes.ok) setRecurringInvoices(await recInvRes.json());
      if (payrollRes.ok) setPayrollPeriods(await payrollRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (assetsRes.ok) setAssets(await assetsRes.json());
      if (advRes.ok) setAdvances(await advRes.json());
      
      const savedDeals = localStorage.getItem('crm_deals');
      if (savedDeals) {
        setCrmDeals(JSON.parse(savedDeals));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    // Optimistic update
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    
    try {
      await apiFetch(`/api/tasks/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      console.error(e);
      // Revert on error
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: task.status } : t));
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const submitNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.dueDate) return;
    try {
      const payload = {
        title: newTask.title,
        due_date: newTask.dueDate,
        priority: newTask.priority,
        category: newTask.category
      };
      const res = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      if (res.ok) {
        fetchData();
        setIsTaskModalOpen(false);
        setNewTask({ title: '', dueDate: new Date().toISOString().split('T')[0], priority: 'medium', category: 'Général' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  type CalendarEvent = {
    id: string;
    originalId: any;
    type: string;
    title: string;
    date: string;
    status: string;
    priority?: string;
    taskCategory?: string;
    searchStr: string;
  };

  const calendarEvents: CalendarEvent[] = [
    ...tasks.map(t => ({ id: `task-${t.id}`, originalId: t.id, type: 'task', title: t.title, date: t.due_date || t.dueDate, status: t.status, priority: t.priority, taskCategory: t.category, searchStr: `${t.title || ''} ${t.description || ''} ${t.category || ''}`.toLowerCase() })),
    ...invoices.filter(i => i.due_date).map(i => ({ id: `inv-${i.id}`, originalId: i.id, type: i.type === 'quote' ? 'quote' : 'invoice', title: i.type === 'quote' ? `Devis ${i.number || i.invoice_number}` : `Facture ${i.number || i.invoice_number}`, date: i.due_date, status: i.status === 'paid' ? 'completed' : 'pending', searchStr: `${i.number || i.invoice_number || ''} ${i.third_party_name || i.client_name || ''} ${i.notes || ''}`.toLowerCase() })),
    ...fiscalYears.flatMap(fy => [
        { id: `fy-start-${fy.id}`, originalId: fy.id, type: 'fiscal_year', title: `Début Ex. ${fy.name}`, date: fy.start_date, status: 'completed', searchStr: fy.name?.toLowerCase() || '' },
        { id: `fy-end-${fy.id}`, originalId: fy.id, type: 'fiscal_year', title: `Fin Ex. ${fy.name}`, date: fy.end_date, status: fy.status === 'closed' ? 'completed' : 'pending', searchStr: fy.name?.toLowerCase() || '' }
    ]),
    ...recurringTxs.map(rt => ({ id: `rt-${rt.id}`, originalId: rt.id, type: 'recurring', title: `Récurrence: ${rt.description}`, date: rt.next_date, status: 'pending', searchStr: `${rt.description || ''}`.toLowerCase() })),
    ...recurringInvoices.map(ri => ({ id: `ri-${ri.id}`, originalId: ri.id, type: 'recurring', title: `Facture Réc.: ${ri.client_name || 'Client'}`, date: ri.next_date, status: 'pending', searchStr: `${ri.client_name || ''}`.toLowerCase() })),
    ...payrollPeriods.map(pp => ({ id: `pp-${pp.id}`, originalId: pp.id, type: 'payroll', title: `Paie ${pp.month}/${pp.year}`, date: new Date(pp.year, pp.month, 0).toISOString(), status: pp.status === 'validated' || pp.status === 'paid' ? 'completed' : 'pending', searchStr: `paie ${pp.month}/${pp.year}`.toLowerCase() })),
    ...transactions.map(tx => ({ id: `tx-${tx.id}`, originalId: tx.id, type: 'transaction', title: `Tx: ${tx.description}`, date: tx.date, status: 'completed', searchStr: `${tx.description || ''} ${tx.reference || ''}`.toLowerCase() })),
    ...assets.map(a => ({ id: `asset-${a.id}`, originalId: a.id, type: 'asset', title: `Acquisition: ${a.name}`, date: a.acquisition_date, status: 'completed', searchStr: `${a.name || ''}`.toLowerCase() })),
    ...advances.map(a => ({ id: `adv-${a.id}`, originalId: a.id, type: 'advance', title: `Avance ${a.first_name} ${a.last_name}`, date: a.date, status: a.status === 'repaid' ? 'completed' : 'pending', searchStr: `${a.first_name || ''} ${a.last_name || ''} ${a.description || ''}`.toLowerCase() })),
    ...crmDeals.filter(d => d.expectedCloseDate).map(d => ({ id: `crm-${d.id}`, originalId: d.id, type: 'crm', title: `Deal CRM: ${d.title}`, date: d.expectedCloseDate, status: d.stage === 'won' || d.stage === 'lost' ? 'completed' : 'pending', searchStr: `${d.title || ''}`.toLowerCase() }))
  ];

  const filteredEvents = calendarEvents.filter(e => {
    if (filter === 'pending' && e.status !== 'pending') return false;
    if (filter === 'completed' && e.status !== 'completed') return false;
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'Fiscalité' && !(['fiscal_year'].includes(e.type) || e.taskCategory === 'Fiscalité')) return false;
      if (sourceFilter === 'Paie' && !(['payroll', 'advance'].includes(e.type) || e.taskCategory === 'Paie')) return false;
      if (sourceFilter === 'Factures' && !(['invoice', 'quote', 'recurring'].includes(e.type) || e.taskCategory === 'Factures')) return false;
      if (sourceFilter === 'Audit' && !(['transaction', 'asset'].includes(e.type) || e.taskCategory === 'Audit')) return false;
      if (sourceFilter === 'Tâches' && !((['task', 'crm'].includes(e.type)) && !(['Fiscalité', 'Paie', 'Factures', 'Audit'].includes(e.taskCategory || '')))) return false;
    }
    if (search && !(e.title.toLowerCase().includes(search.toLowerCase()) || (e.searchStr && e.searchStr.includes(search.toLowerCase())))) return false;
    return true;
  });

  const onNextPeriod = () => {
    if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const onPrevPeriod = () => {
    if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const exportToICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//FNE//ERP//FR\nCALSCALE:GREGORIAN\n";
    
    filteredEvents.forEach(event => {
      const eDate = new Date(event.date);
      if (isNaN(eDate.getTime())) return;
      
      const formatICSDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };
      
      const dtStart = formatICSDate(eDate);
      const eDateEnd = new Date(eDate.getTime() + 60 * 60 * 1000); // +1 hour duration
      const dtEnd = formatICSDate(eDateEnd);
      
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `DTSTART:${dtStart}\n`;
      icsContent += `DTEND:${dtEnd}\n`;
      icsContent += `SUMMARY:${event.title}\n`;
      icsContent += `DESCRIPTION:Type: ${event.type} - Statut: ${event.status}\n`;
      icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `echeances_${format(new Date(), 'yyyyMMdd')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEventClick = (ev: React.MouseEvent, e: any) => {
    ev.stopPropagation();
    switch (e.type) {
      case 'task':
        toggleStatus(e.originalId);
        break;
      case 'invoice':
      case 'quote':
        navigate('/invoicing');
        break;
      case 'recurring':
        navigate('/recurring');
        break;
      case 'payroll':
      case 'advance':
        navigate('/payroll');
        break;
      case 'transaction':
      case 'fiscal_year':
        navigate('/journal');
        break;
      case 'asset':
        navigate('/assets');
        break;
      case 'crm':
        navigate('/crm');
        break;
      default:
        break;
    }
  };

  const handleDragStart = (e: React.DragEvent, eventItem: any) => {
    if (eventItem.type === 'task') {
      e.dataTransfer.setData('application/json', JSON.stringify({
        id: eventItem.originalId,
        type: eventItem.type
      }));
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      
      if (data.type === 'task' && data.id) {
        const isoDate = targetDate.toISOString().split('T')[0];
        
        // Optimistic update
        setTasks(prev => prev.map(t => 
          t.id === data.id ? { ...t, due_date: isoDate, dueDate: isoDate } : t
        ));
        
        const res = await apiFetch(`/api/tasks/${data.id}`, {
          method: 'PUT',
          body: JSON.stringify({ due_date: isoDate })
        });
        
        if (!res.ok) {
          fetchData(); // revert
        }
      }
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  const renderCalendar = () => {
    let startDate: Date;
    let endDate: Date;

    if (view === 'week') {
      startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
      endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(monthStart);
      startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
      endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    }

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        
        const dayEvents = filteredEvents.filter(e => {
          try {
            return isSameDay(parseISO(e.date), cloneDay);
          } catch { return false; }
        });
        
        days.push(
          <div 
            key={day.toISOString()} 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, cloneDay)}
            className={cn(
              "min-h-[100px] sm:min-h-[120px] bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800 p-1 sm:p-2 transition-colors relative group",
              view === 'calendar' && !isSameMonth(day, startOfMonth(currentDate)) ? "text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/10" : "text-slate-700 dark:text-slate-200",
              isSameDay(day, new Date()) ? "bg-brand-green/5 dark:bg-brand-green/10" : ""
            )}
          >
            <div className="flex justify-end">
              <span className={cn(
                "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full mb-1 sm:mb-2",
                isSameDay(day, new Date()) ? "bg-brand-green text-white" : ""
              )}>
                {formattedDate}
              </span>
            </div>
            <div className="space-y-1 sm:space-y-1.5 overflow-hidden">
              {dayEvents.map(e => (
                <div 
                  key={e.id} 
                  draggable={e.type === 'task'}
                  onDragStart={(ev) => handleDragStart(ev, e)}
                  onClick={(ev) => handleEventClick(ev, e)}
                  className={cn(
                    "text-[9px] sm:text-[10px] px-1.5 py-1 rounded truncate cursor-pointer transition-colors border font-bold shadow-sm",
                    e.type === 'task' ? (e.status === 'completed' ? "bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 line-through" : e.priority === 'high' ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400" : "bg-brand-green/10 border-brand-green/20 text-brand-green dark:bg-brand-green/20 dark:border-brand-green/30") 
                    : (e.type === 'invoice' || e.type === 'quote') ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                    : e.type === 'recurring' ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20"
                    : e.type === 'payroll' ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/20"
                    : e.type === 'transaction' ? "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    : e.type === 'asset' ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20"
                    : e.type === 'crm' ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20"
                    : e.type === 'advance' ? "bg-pink-50 border-pink-200 text-pink-700 dark:bg-pink-500/10 dark:border-pink-500/20"
                    : "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/20"
                  )}
                  title={e.title}
                >
                  <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full mr-1" style={{backgroundColor: 'currentColor'}} />
                  {e.title}
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-white dark:from-slate-900 to-transparent flex justify-center">
               <button className="text-[10px] text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full hover:bg-brand-green hover:text-white transition-colors"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setNewTask({...newTask, dueDate: cloneDay.toISOString().split('T')[0]});
                  setIsTaskModalOpen(true);
                }}>
                 + Tâche
               </button>
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toISOString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 gap-4">
           <div className="flex items-center gap-2 w-full sm:w-auto">
             <button onClick={onPrevPeriod} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <ChevronLeft size={20} />
             </button>
             <h2 className="flex-1 text-center sm:min-w-[150px] text-lg font-black uppercase text-slate-900 dark:text-white tracking-wider">
               {view === 'week' 
                 ? `Sem ${format(startDate, 'd')} - ${format(endDate, 'd MMM yyyy', { locale: fr })}`
                 : format(currentDate, 'MMMM yyyy', { locale: fr })}
             </h2>
             <button onClick={onNextPeriod} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <ChevronRight size={20} />
             </button>
           </div>
           
           <button 
             onClick={() => setCurrentDate(new Date())}
             className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 w-full sm:w-auto"
           >
             Aujourd'hui
           </button>
        </div>
        <div className="w-full min-w-0 overflow-auto ">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              {weekDays.map((wd, i) => (
                 <div key={wd} className={cn("py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-200 dark:border-slate-800 last:border-r-0", i >= 5 && "text-slate-400")}>
                   {wd}
                 </div>
              ))}
            </div>
            <div className="border-l border-t border-slate-200 dark:border-slate-800">
              {rows}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="text-brand-green" />
            Calendrier Général
          </h1>
          <p className="text-slate-500 text-sm font-medium">Centralisation de toutes les informations chronologiques et échéances.</p>
        </div>
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl flex">
            <button 
              onClick={() => setView('calendar')}
              className={cn(
                "px-3 layout-h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all py-2",
                view === 'calendar' ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <CalendarDays size={16} /> <span className="hidden sm:inline">Mois</span>
            </button>
            <button 
              onClick={() => setView('week')}
              className={cn(
                "px-3 layout-h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all py-2",
                view === 'week' ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <Calendar size={16} /> <span className="hidden sm:inline">Semaine</span>
            </button>
            <button 
              onClick={() => setView('list')}
              className={cn(
                "px-3 layout-h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all py-2",
                view === 'list' ? "bg-white dark:bg-slate-900 text-brand-green shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              <LayoutList size={16} /> <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToICS}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap active:scale-95"
              title="Exporter au format ICS (Outlook, Google Calendar, Apple Calendar)"
            >
              <Download size={16} className="text-slate-500" /> <span className="hidden lg:inline">Exporter ICS</span>
            </button>
            <button 
              onClick={() => setIsTaskModalOpen(true)}
              className="px-4 py-2 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green-light transition-all flex items-center gap-2 shadow-lg shadow-brand-green/20 whitespace-nowrap active:scale-95"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Nouvelle tâche</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="relative mb-4">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input 
                 type="text"
                 placeholder="Rechercher..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 text-slate-900 dark:text-white font-medium"
               />
            </div>
            
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">Statut</h3>
            <div className="space-y-1 mb-6">
              <button 
                onClick={() => setFilter('all')}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden group",
                  filter === 'all' ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {filter === 'all' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400 rounded-r-md" />}
                Toutes les tâches
              </button>
              <button 
                onClick={() => setFilter('pending')}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden group",
                  filter === 'pending' ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {filter === 'pending' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-md" />}
                À faire
              </button>
              <button 
                onClick={() => setFilter('completed')}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden group",
                  filter === 'completed' ? "bg-brand-green/10 text-brand-green" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {filter === 'completed' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-green rounded-r-md" />}
                Terminées
              </button>
            </div>
            
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">Types d'Activités</h3>
            <div className="space-y-1 mb-6">
              {[
                { id: 'all', label: 'Toutes les activités' },
                { id: 'Fiscalité', label: 'Fiscalité', color: 'bg-purple-500' },
                { id: 'Paie', label: 'Paie', color: 'bg-orange-500' },
                { id: 'Factures', label: 'Factures', color: 'bg-emerald-500' },
                { id: 'Audit', label: 'Audit', color: 'bg-slate-500' },
                { id: 'Tâches', label: 'Tâches', color: 'bg-brand-green' }
              ].map(type => (
                <button 
                  key={type.id}
                  onClick={() => setSourceFilter(type.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative overflow-hidden group flex items-center gap-2",
                    sourceFilter === type.id ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  {sourceFilter === type.id && <div className={cn("absolute left-0 top-0 bottom-0 w-1", type.color || "bg-slate-400")} style={type.color && type.id === 'all' ? {} : { borderRadius: '0 4px 4px 0' }} />}
                  <span className={cn("w-2 h-2 rounded-full", type.color || "bg-slate-400")} />
                  {type.label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">Légende</h3>
               <div className="space-y-3 px-1">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20" />
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Tâche - Priorité Haute</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded bg-brand-green/10 border border-brand-green/20 dark:bg-brand-green/20 dark:border-brand-green/30" />
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Tâche - Standard</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700" />
                   <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Événement Terminé</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {view === 'calendar' || view === 'week' ? renderCalendar() : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEvents.length > 0 ? filteredEvents.map(event => (
                  <div key={event.id} onClick={(ev) => handleEventClick(ev, event)} className={cn("p-4 sm:p-5 flex items-start gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group cursor-pointer", event.status === 'completed' && event.type === 'task' ? "opacity-60" : "")}>
                     {event.type === 'task' ? (
                       <button 
                         onClick={() => toggleStatus(event.originalId)}
                         className={cn("w-6 h-6 rounded-md flex items-center justify-center border-2 shrink-0 transition-all", event.status === 'completed' ? "bg-brand-green border-brand-green text-white" : "border-slate-300 dark:border-slate-600 hover:border-brand-green")}
                       >
                         {event.status === 'completed' && <CheckCircle2 size={16} />}
                       </button>
                     ) : (
                       <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                         {(event.type === 'invoice' || event.type === 'quote') ? <FileText size={16} className="text-emerald-500" /> : 
                          event.type === 'recurring' ? <Repeat size={16} className="text-blue-500" /> :
                          event.type === 'payroll' ? <Users size={16} className="text-orange-500" /> :
                          event.type === 'transaction' ? <CreditCard size={16} className="text-slate-500" /> :
                          event.type === 'asset' ? <FileText size={16} className="text-amber-500" /> :
                          event.type === 'crm' ? <Users size={16} className="text-indigo-500" /> :
                          event.type === 'advance' ? <CreditCard size={16} className="text-pink-500" /> :
                          <Calendar size={16} className="text-purple-500" />}
                       </div>
                     )}
                     <div className="flex-1 min-w-0 pt-0.5">
                       <p className={cn("font-bold text-sm sm:text-base text-slate-900 dark:text-white transition-all", event.status === 'completed' && event.type === 'task' ? "line-through text-slate-500" : "")}>{event.title}</p>
                       <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium">
                         <span className={cn(
                             "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px]",
                             event.type === 'task' && event.status === 'completed' ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" : (new Date(event.date) < new Date(new Date().setHours(0,0,0,0)) ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400")
                           )}>
                           <CalendarIcon size={12} /> {format(parseISO(event.date), 'dd MMMM yyyy', { locale: fr })}
                         </span>
                         <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 uppercase tracking-widest text-[9px] font-black">{event.type}</span>
                         {event.priority === 'high' && (
                           <span className="flex items-center gap-1 text-rose-500 text-[10px] uppercase font-bold tracking-widest sm:ml-auto">
                             <AlertCircle size={12} /> Priorité Haute
                           </span>
                         )}
                       </div>
                     </div>
                     {event.type === 'task' && (
                       <button 
                         onClick={() => deleteTask(event.originalId)}
                         className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                         title="Supprimer la tâche"
                       >
                         <Trash2 size={16} />
                       </button>
                     )}
                  </div>
                )) : (
                  <div className="p-16 text-center text-slate-500">
                    <CheckSquare className="mx-auto h-16 w-16 text-slate-200 dark:text-slate-700 mb-4" />
                    <p className="text-base font-bold text-slate-900 dark:text-white mb-2">Aucun événement trouvé</p>
                    <p className="text-sm">Il n'y a aucun événement correspondant à vos critères.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center p-4 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col">
            <button 
              onClick={() => setIsTaskModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-amber-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white">Nouvelle tâche</h2>
            <form onSubmit={submitNewTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Titre</label>
                <input 
                  type="text" 
                  required
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Date d'échéance</label>
                  <input 
                    type="date" 
                    required
                    value={newTask.dueDate}
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Catégorie</label>
                  <select 
                    value={newTask.category}
                    onChange={e => setNewTask({...newTask, category: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                  >
                    <option value="Général">Général</option>
                    <option value="Fiscalité">Fiscalité</option>
                    <option value="Paie">Paie</option>
                    <option value="Factures">Factures</option>
                    <option value="Audit">Audit</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Priorité</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNewTask({...newTask, priority: 'low'})} className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all border", newTask.priority === 'low' ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900" : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}>Basse</button>
                  <button type="button" onClick={() => setNewTask({...newTask, priority: 'medium'})} className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all border", newTask.priority === 'medium' ? "bg-brand-green text-white border-brand-green" : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}>Normale</button>
                  <button type="button" onClick={() => setNewTask({...newTask, priority: 'high'})} className={cn("flex-1 py-2 rounded-xl text-xs font-bold transition-all border", newTask.priority === 'high' ? "bg-rose-500 text-white border-rose-500" : "bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}>Haute</button>
                </div>
              </div>
              <button type="submit" className="w-full mt-4 bg-brand-green hover:bg-brand-green-light text-white font-bold rounded-xl py-3 transition-colors shadow-lg shadow-brand-green/20">
                Créer la tâche
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

