import { initializeApp, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';

async function restore() {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.log('No firebase config found, skipping restore.');
      return;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (getApps().length === 0) {
      initializeApp({
        projectId: config.projectId,
        storageBucket: config.storageBucket
      });
    }

    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    if (files.length === 0) {
      console.log('No backups found.');
      return;
    }

    const latestBackups = new Map<string, any>();
    
    for (const file of files) {
      if (!file.name.endsWith('.db')) continue;
      
      const fileName = path.basename(file.name);
      
      const dbNameMatch = fileName.match(/^(.*)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.db$/);
      let dbName = '';
      if (dbNameMatch) {
         dbName = dbNameMatch[1];
      } else {
         const parts = fileName.split('_');
         if (parts.length > 1) {
           parts.pop();
           dbName = parts.join('_');
         } else {
           dbName = fileName.replace('.db', '');
         }
      }
      
      const currentLatest = latestBackups.get(dbName);
      if (!currentLatest || new Date(file.metadata.timeCreated) > new Date(currentLatest.metadata.timeCreated)) {
        latestBackups.set(dbName, file);
      }
    }

    for (const [dbName, file] of latestBackups.entries()) {
      const destFile = dbName.endsWith('.db') ? dbName : `${dbName}.db`;
      const destPath = path.resolve(process.cwd(), destFile);
      
      console.log(`Restoring ${destFile} from ${file.name} (last modified ${file.metadata.timeCreated})...`);
      await file.download({ destination: destPath });
    }
    console.log('Restore completed successfully.');

  } catch (error) {
    console.error('Error during database restore:', error);
  }
}

restore();
