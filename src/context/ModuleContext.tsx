import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch as fetch } from '@/lib/api';

interface Module {
  id: number;
  module_key: string;
  is_active: number;
}

interface ModuleContextType {
  modules: Module[];
  isActive: (key: string) => boolean;
  refreshModules: () => Promise<void>;
  loading: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = async () => {
    try {
      const res = await fetch('/api/company/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (err) {
      console.error("Failed to fetch modules:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const isActive = (key: string) => {
    const module = modules.find(m => m.module_key === key);
    return module ? module.is_active === 1 : true; // Default to true if not found (system modules)
  };

  return (
    <ModuleContext.Provider value={{ modules, isActive, refreshModules: fetchModules, loading }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (context === undefined) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
}
