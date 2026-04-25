import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch as fetch } from '@/lib/api';
import { useAuth } from './AuthContext';

export interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  is_active: number;
}

interface FiscalYearContextType {
  activeYear: FiscalYear | null;
  loading: boolean;
  refreshActiveYear: () => Promise<void>;
}

const FiscalYearContext = createContext<FiscalYearContextType | undefined>(undefined);

export function FiscalYearProvider({ children }: { children: ReactNode }) {
  const [activeYear, setActiveYear] = useState<FiscalYear | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  const refreshActiveYear = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const res = await fetch('/api/fiscal-years/active', { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        setActiveYear(data);
      }
    } catch (err) {
      console.error("Failed to fetch active fiscal year:", err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      refreshActiveYear();
    }
  }, [user, authLoading]);

  return (
    <FiscalYearContext.Provider value={{ activeYear, loading, refreshActiveYear }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  const context = useContext(FiscalYearContext);
  if (context === undefined) {
    throw new Error('useFiscalYear must be used within a FiscalYearProvider');
  }
  return context;
}
