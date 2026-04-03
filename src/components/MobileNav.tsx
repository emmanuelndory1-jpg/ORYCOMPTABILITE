import React from 'react';
import { LayoutDashboard, BookOpen, Calculator, Menu, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface MobileNavProps {
  onMenuClick: () => void;
}

export function MobileNav({ onMenuClick }: MobileNavProps) {
  const location = useLocation();
  const currentPath = location.pathname.replace(/^\//, '') || 'dashboard';

  const navItems = [
    { id: 'dashboard', path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'journal', path: '/journal', label: 'Journal', icon: BookOpen },
    { id: 'treasury', path: '/treasury', label: 'Trésorerie', icon: Wallet },
    { id: 'financials', path: '/financials', label: 'États financiers', icon: Calculator },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-4 py-2 z-30 pb-[env(safe-area-inset-bottom,1rem)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-300">
      <div className="flex justify-between items-center max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentPath === item.id || (item.id === 'dashboard' && currentPath === '');
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px] relative",
                isActive ? "text-brand-green dark:text-brand-green-light" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="mobile-nav-bg"
                  className="absolute inset-0 bg-brand-green/10 dark:bg-brand-green/20 rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon size={20} className={cn(isActive && "fill-current")} />
              <span className="text-[9px] font-bold uppercase tracking-tighter text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
        
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 min-w-[64px]"
        >
          <Menu size={20} />
          <span className="text-[9px] font-bold uppercase tracking-tighter text-center leading-tight">Menu</span>
        </button>
      </div>
    </div>
  );
}
