const fs = require('fs');

let path = 'src/components/Header.tsx';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('import { validateDataIntegrity, saveLocalTransactions }')) {
  code = code.replace(
    "import { useSync } from '@/context/SyncContext';",
    "import { useSync } from '@/context/SyncContext';\nimport { validateDataIntegrity, saveLocalTransactions } from '@/lib/dataSync';\nimport { useDialog } from './DialogProvider';"
  );
}

// Check if useDialog is already imported elsewhere
if (code.match(/import { useDialog }/g)?.length > 1) {
  // Remove the one we just added if there was already one
  code = code.replace("import { useDialog } from './DialogProvider';\n", "");
} else if (!code.includes("import { useDialog } from") && code.includes("import { validateDataIntegrity")) {
   code = code.replace(
    "import { validateDataIntegrity, saveLocalTransactions } from '@/lib/dataSync';",
     "import { validateDataIntegrity, saveLocalTransactions } from '@/lib/dataSync';\nimport { useDialog } from './DialogProvider';"
   )
}


if (!code.includes('const [isForceSyncing, setIsForceSyncing]')) {
  code = code.replace(
    "const { isSyncing, pendingCount, lastSyncTime } = useSync();",
    `const { isSyncing, pendingCount, lastSyncTime, setSyncing } = useSync();
  const { alert } = useDialog();
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  
  const handleForceSync = async () => {
    setIsForceSyncing(true);
    try {
      const result = await validateDataIntegrity();
      if (!result.isValid && result.discrepancies.length > 0) {
        if (result.serverTxs.length > 0) {
           await saveLocalTransactions(result.serverTxs);
        }
        alert(\`\${result.discrepancies.length} différences trouvées. Données resynchronisées.\`, 'error');
      } else {
        if (result.serverTxs.length > 0) {
           await saveLocalTransactions(result.serverTxs);
        }
        alert('Synchronisation réussie. Vos données sont à jour.', 'success');
      }
    } catch (e) {
      alert('Erreur lors de la synchronisation', 'error');
    } finally {
      setIsForceSyncing(false);
    }
  };`
  );
}

// We need to inject setSyncing into context extraction too if we override the existing line
if (code.includes('const { isSyncing, pendingCount, lastSyncTime } = useSync();') && code.includes('const { isSyncing, pendingCount, lastSyncTime, setSyncing } = useSync();')) {
  // we did the replace above, but just in case
}

const syncStatusMatch = `              {/* Sync Status Indicator */}
              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 group/sync cursor-help" title={isSyncing ? \`\${pendingCount} transaction(s) en attente de validation serveur\` : \`Dernière sauvegarde cloud : \${lastSyncTime ? lastSyncTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : 'À l\\'instant'}\`}>
                {isSyncing ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-green/10 border border-brand-green/20">
                    <RefreshCw size={10} className="animate-spin text-brand-green" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-brand-green">
                      {pendingCount} attente
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <Cloud size={10} className="text-slate-400" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Sync {lastSyncTime ? lastSyncTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : 'Ok'}
                    </span>
                  </div>
                )}
              </div>`;

const syncStatusReplacement = `              {/* Sync Status Indicator */}
              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 group/sync">
                {isSyncing || isForceSyncing ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-green/10 border border-brand-green/20" title={\`\${pendingCount} transaction(s) en attente...\`}>
                    <RefreshCw size={10} className="animate-spin text-brand-green" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-brand-green">
                      {isForceSyncing ? 'Synchronisation...' : \`\${pendingCount} attente\`}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" title={\`Dernière sauvegarde : \${lastSyncTime ? lastSyncTime.toLocaleTimeString('fr-FR') : 'À l\\'instant'}\`}>
                      <Cloud size={10} className="text-slate-400" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        Sync {lastSyncTime ? lastSyncTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : 'Ok'}
                      </span>
                    </div>
                    <button 
                      onClick={handleForceSync}
                      disabled={isForceSyncing}
                      className="ml-1 p-1 text-slate-400 hover:text-brand-green transition-colors rounded-full hover:bg-brand-green/10"
                      title="Forcer la synchronisation manuelle"
                    >
                      <RefreshCw size={12} className={isForceSyncing ? "animate-spin" : ""} />
                    </button>
                  </div>
                )}
              </div>`;

if (code.includes(syncStatusMatch)) {
  code = code.replace(syncStatusMatch, syncStatusReplacement);
} else {
  console.log("Could not find the exact sync block, using a regex");
  // Regex approach
  code = code.replace(/\{\/\* Sync Status Indicator \*\/\}[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>)/, syncStatusReplacement);
}

fs.writeFileSync(path, code);
console.log('Header patched');
