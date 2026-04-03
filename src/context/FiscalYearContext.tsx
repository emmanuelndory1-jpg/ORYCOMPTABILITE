import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch as fetch } from '@/lib/api';

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

  const refreshActiveYear = async () => {
    try {
      const res = await fetch('/api/fiscal-years/active');
      if (res.ok) {
        const data = await res.json();
        setActiveYear(data);
      }
    } catch (err) {
      console.error("Failed to fetch active fiscal year:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshActiveYear();
  }, []);

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
