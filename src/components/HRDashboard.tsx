import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { Users, DollarSign, Briefcase, BarChart3, PieChart, TrendingUp, AlertTriangle } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface DepartmentStats {
  department: string;
  employeeCount: number;
  totalSalary: number;
}

interface HRDashboardData {
  totalEmployees: number;
  totalPayroll: number;
  byDepartment: DepartmentStats[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

export function HRDashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState<HRDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/hr/dashboard');
        if (!res.ok) {
          throw new Error('Failed to fetch HR dashboard data');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF', // Assuming XOF based on previous configs
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-12 w-12 mb-4 text-rose-500" />
        <h3 className="font-bold text-lg mb-2">Erreur de chargement</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Formatting for Pie chart - Payroll distribution
  const pieData = data.byDepartment.map((d, index) => ({
    name: d.department,
    value: d.totalSalary,
    color: COLORS[index % COLORS.length]
  }));

  // Formatting for Bar chart - Employees per department
  const barData = data.byDepartment.map((d, index) => ({
    name: d.department,
    Employés: d.employeeCount,
    'Masse Salariale': d.totalSalary
  })).sort((a, b) => b['Masse Salariale'] - a['Masse Salariale']); // Sort by largest payroll

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="text-brand-green" />
          Tableau de Bord RH
        </h1>
        <p className="text-slate-500 text-sm font-medium">Analyse de la masse salariale et répartition par département.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Effectif Total (Actif)</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{data.totalEmployees}</h3>
            </div>
            <div className="p-3 bg-brand-green/10 rounded-xl text-brand-green">
              <Users size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Masse Salariale (Base)</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(data.totalPayroll)}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
              <DollarSign size={24} />
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hidden lg:block"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Salaire Moyen</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                {data.totalEmployees > 0 ? formatCurrency(data.totalPayroll / data.totalEmployees) : '0'}
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <Briefcase size={24} />
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart size={20} className="text-cyan-500" />
              Répartition de la Masse Salariale
            </h3>
          </div>
          <div className="h-72 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Aucune donnée disponible</div>
            )}
          </div>
        </motion.div>

        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-green" />
              Effectifs et Salaires par Département
            </h3>
          </div>
          <div className="h-72 w-full">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => new Intl.NumberFormat('fr-FR', { notation: 'compact', compactDisplay: 'short' }).format(val)}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Masse Salariale') return formatCurrency(Number(value));
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Masse Salariale" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  <Line yAxisId="right" type="monotone" dataKey="Employés" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">Aucune donnée disponible</div>
            )}
          </div>
        </motion.div>
      </div>
      
      <motion.div 
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.5 }}
         className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
           <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
             <Briefcase size={18} className="text-blue-500" />
             Détails par département
           </h3>
        </div>
        <div className="w-full min-w-0 overflow-auto ">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold">Département</th>
                <th className="px-6 py-4 font-bold text-center">Effectif</th>
                <th className="px-6 py-4 font-bold text-right">Masse Salariale</th>
                <th className="px-6 py-4 font-bold text-right">Salaire Moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {data.byDepartment.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                       {d.department}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-medium">
                    {d.employeeCount} employés
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                    {formatCurrency(d.totalSalary)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 font-medium">
                    {d.employeeCount > 0 ? formatCurrency(d.totalSalary / d.employeeCount) : '-'}
                  </td>
                </tr>
              ))}
              {data.byDepartment.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">Aucune donnée disponible pour le moment.</td>
                </tr>
              )}
            </tbody>
            {data.byDepartment.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-950/50 border-t-2 border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <td className="px-6 py-4 text-slate-900 dark:text-white">TOTAL</td>
                  <td className="px-6 py-4 text-center text-slate-900 dark:text-white">{data.totalEmployees} employés</td>
                  <td className="px-6 py-4 text-right text-brand-green">{formatCurrency(data.totalPayroll)}</td>
                  <td className="px-6 py-4 text-right text-slate-900 dark:text-white">{data.totalEmployees > 0 ? formatCurrency(data.totalPayroll / data.totalEmployees) : '-'}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </motion.div>
    </div>
  );
}
