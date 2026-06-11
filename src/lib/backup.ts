import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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

    const blob = await response.blob();
    
    // Upload to Firebase Storage
    const storage = getStorage();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backups/${user.uid}/compta_${timestamp}.db`;
    const storageRef = ref(storage, fileName);

    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'application/octet-stream',
      customMetadata: {
        userId: user.uid,
        email: user.email || '',
        timestamp: timestamp
      }
    });

    console.log(`Uploading backup...`);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Backup upload is ${progress}% done`);
        },
        (error) => {
          console.error('Backup upload failed:', error);
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
          reject(error);
        },
        async () => {
          console.log('Backup uploaded successfully!');
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('File available at', downloadURL);
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
          resolve(true);
        }
      );
    });

  } catch (error) {
    console.error('Error during cloud backup:', error);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sync-end'));
    return false;
  }
};
