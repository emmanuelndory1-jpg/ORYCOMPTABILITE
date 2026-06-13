import React, { useEffect, useRef } from 'react';
import { useDialog } from './DialogProvider';
import { validateDataIntegrity, saveLocalTransactions } from '../lib/dataSync';

export function BackgroundSync() {
  const { alert } = useDialog();
  const hasValidatedOnMount = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('Device returned online. Validating data integrity...');
      const result = await validateDataIntegrity();
      
      if (!result.isValid && result.discrepancies.length > 0) {
        console.warn('Financial data discrepancies found:', result.discrepancies);
        alert(
          `Discrepancies found during sync (${result.discrepancies.length}). Financial records re-synchronized.`, 
          'error'
        );
        // Self-heal: update local transactions to match server truth
        if (result.serverTxs.length > 0) {
           await saveLocalTransactions(result.serverTxs);
        }
      } else {
        console.log('Background validation: Data integrity verified.');
        // If it's valid, make sure to sync the server Txs fully
        if (result.serverTxs.length > 0) {
          await saveLocalTransactions(result.serverTxs);
        }
        // Only show success toast if we just came back online
        alert('Data synchronized successfully. No discrepancies.', 'success');
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [alert]);

  return null;
}
