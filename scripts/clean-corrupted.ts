import fs from 'fs';
import path from 'path';

// Files that must NEVER be deleted under any circumstances
const EXCLUDED_FILES = new Set([
  'compta.db',
  'database.sqlite',
  'sqlite.db',
  'emma@123',
  'empty_user_6.db',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'server.ts'
]);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function cleanCorruptedDatabases() {
  const isDryRun = process.env.DRY_RUN === 'true';
  const workspaceRoot = process.cwd();
  
  console.log('=== DATABASE MAINTENANCE & SPACE RECOVERY ===');
  console.log(`Working Directory: ${workspaceRoot}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (Simulated)' : 'ACTIVE CLEANUP (Secure Deletion)'}`);
  console.log('Scanning workspace for corrupted database files and backup files...\n');

  let files: string[] = [];
  try {
    files = fs.readdirSync(workspaceRoot);
  } catch (error) {
    console.error('Error reading workspace files:', error);
    process.exit(1);
  }

  const targets: { name: string; size: number; path: string }[] = [];

  for (const file of files) {
    const fullPath = path.join(workspaceRoot, file);
    
    // Safety checks
    if (!fs.existsSync(fullPath)) continue;
    
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) continue;

    // Check if file is in exclusion list
    if (EXCLUDED_FILES.has(file)) continue;

    // Identify targets based on matching corrupted flags
    const isCorruptedFile = file.includes('.corrupted');
    const isCorruptedBackup = file.includes('.corrupted_bk_') || file.includes('.corrupted_backup');
    const isCorruptedDump = file.endsWith('.dump.sql') && file.includes('corrupted');

    if (isCorruptedFile || isCorruptedBackup || isCorruptedDump) {
      targets.push({
        name: file,
        size: stats.size,
        path: fullPath
      });
    }
  }

  if (targets.length === 0) {
    console.log('No corrupted database files or backups were found in the workspace.');
    console.log('Workspace is clean. Reclaimed space: 0 Bytes.');
    return;
  }

  console.log(`Found ${targets.length} candidates for secure deletion:`);
  console.log('--------------------------------------------------------------------------');
  
  let totalReclaimedBytes = 0;

  for (const target of targets) {
    console.log(`[Target]  ${target.name} (${formatBytes(target.size)})`);
    totalReclaimedBytes += target.size;
  }
  
  console.log('--------------------------------------------------------------------------');
  console.log(`Total space to reclaim: ${formatBytes(totalReclaimedBytes)}\n`);

  if (isDryRun) {
    console.log('Dry run enabled. No files have been deleted.');
    console.log('To execute the clean up, run this script without DRY_RUN=true, e.g.:');
    console.log('  npm run clean:db');
    return;
  }

  // Active Cleanup Mode
  console.log('Executing secure deletion...');
  let successCount = 0;
  let failureCount = 0;
  let activeReclaimedBytes = 0;

  for (const target of targets) {
    try {
      fs.unlinkSync(target.path);
      console.log(`✔️ Deleted: ${target.name}`);
      successCount++;
      activeReclaimedBytes += target.size;
    } catch (err: any) {
      console.error(`❌ Failed to delete ${target.name}:`, err.message || err);
      failureCount++;
    }
  }

  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Successfully deleted: ${successCount}/${targets.length} files`);
  if (failureCount > 0) {
    console.log(`Failed deletions: ${failureCount} files`);
  }
  console.log(`Total Space Reclaimed: ${formatBytes(activeReclaimedBytes)}`);
  console.log('=======================================');
}

cleanCorruptedDatabases().catch(err => {
  console.error('An unexpected error occurred during database clean up:', err);
  process.exit(1);
});
