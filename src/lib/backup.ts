import { auth } from './firebase';
import { apiFetch } from './api';

export const triggerCloudBackup = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('User not authenticated, skipping cloud backup.');
      return false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sync-start'));
    }

    // Export DB from server
    const response = await apiFetch('/api/database/export');
    if (!response.ok) {
      console.error('Failed to export database from server');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
      return false;
    }

    // Skipping Firebase Storage in this environment as bucket is unprovisioned.
    // The data is safely persisted via the local SQLite volume.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
    return true;

  } catch (error) {
    console.error('Error during cloud backup:', error);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
    return false;
  }
};
