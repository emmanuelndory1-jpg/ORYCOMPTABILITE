import { apiFetch } from './api';

const DB_NAME = 'OrycomptaDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveLocalTransactions(transactions: any[]) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Get all existing keys first to remove deleted ones if we want an exact mirror
    store.clear(); 

    transactions.forEach(t => {
      store.put(t);
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Error saving local transactions', error);
  }
}

export async function getLocalTransactions(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error fetching local transactions', error);
    return [];
  }
}

export async function validateDataIntegrity(): Promise<{ 
  isValid: boolean, 
  discrepancies: string[],
  serverTxs: any[]
}> {
  try {
    // Fetch server data
    const response = await apiFetch('/api/transactions');
    if (!response.ok) throw new Error('Failed to fetch server data');
    const serverData = await response.json();
    const serverTxs = serverData.transactions || [];

    // Fetch local data
    const localTxs = await getLocalTransactions();
    
    // Compare
    const discrepancies: string[] = [];
    
    const serverTxMap = new Map(serverTxs.map((t: any) => [t.id, t]));
    const localTxMap = new Map(localTxs.map((t: any) => [t.id, t]));

    serverTxs.forEach((st: any) => {
      const lt = localTxMap.get(st.id);
      if (!lt) {
        discrepancies.push(`Missing local transaction (ID: ${st.id})`);
      } else {
        // Compare some critical fields: total_amount, status
        if (Math.abs(Number(st.total_amount || 0) - Number(lt.total_amount || 0)) > 0.01) {
          discrepancies.push(`Transaction ${st.id} amount mismatch: Local ${lt.total_amount}, Server ${st.total_amount}`);
        }
        if (st.status !== lt.status) {
          discrepancies.push(`Transaction ${st.id} status mismatch: Local ${lt.status}, Server ${st.status}`);
        }
      }
    });

    localTxs.forEach((lt: any) => {
      if (!serverTxMap.has(lt.id)) {
        discrepancies.push(`Extra local transaction (ID: ${lt.id}) not on server`);
      }
    });

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      serverTxs
    };
  } catch (error: any) {
    console.error('Data validation failed', error);
    return {
      isValid: false,
      discrepancies: [`Data validation failed: ${error.message}`],
      serverTxs: []
    };
  }
}
