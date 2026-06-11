import React, { createContext, useContext, useState, useEffect } from 'react';

export interface SyncContextType {
  isSyncing: boolean;
  pendingCount: number;
  setSyncing: (active: boolean) => void;
}

const SyncContext = createContext<SyncContextType>({ isSyncing: false, pendingCount: 0, setSyncing: () => {} });

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    const handleStart = () => setSyncCount(c => c + 1);
    const handleEnd = () => setSyncCount(c => Math.max(0, c - 1));

    window.addEventListener('sync-start', handleStart);
    window.addEventListener('sync-end', handleEnd);

    return () => {
      window.removeEventListener('sync-start', handleStart);
      window.removeEventListener('sync-end', handleEnd);
    };
  }, []);

  useEffect(() => {
    setIsSyncing(syncCount > 0);
  }, [syncCount]);

  return <SyncContext.Provider value={{ isSyncing, pendingCount: syncCount, setSyncing: setIsSyncing }}>{children}</SyncContext.Provider>;
};
