const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicingManager.tsx', 'utf8');

const searchState = `const [searchQuery, setSearchQuery] = useState('');`;
const replaceState = searchState + `\n  const [statusFilter, setStatusFilter] = useState<string>('all');`;

const searchFiltered = `const filteredDocs = (documents || []).filter(doc => 
    (doc.number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (doc.third_party_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );`;

const replaceFiltered = `const filteredDocs = (documents || []).filter(doc => {
    const matchesSearch = (doc.number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                          (doc.third_party_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });`;

const searchJSX1 = `<div className="relative flex-1 max-w-md">`;
const replaceJSX1 = `<div className="flex gap-2">
                <button 
                  onClick={() => setStatusFilter('all')}
                  className={\`px-4 py-2 rounded-xl text-sm font-bold transition-all \${statusFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}\`}
                >
                  Tous
                </button>
                {activeTab === 'invoice' && (
                  <>
                    <button 
                      onClick={() => setStatusFilter('overdue')}
                      className={\`px-4 py-2 rounded-xl text-sm font-bold transition-all \${statusFilter === 'overdue' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40'}\`}
                    >
                      En retard
                    </button>
                    <button 
                      onClick={() => setStatusFilter('paid')}
                      className={\`px-4 py-2 rounded-xl text-sm font-bold transition-all \${statusFilter === 'paid' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40'}\`}
                    >
                      Payés
                    </button>
                  </>
                )}
              </div>
              ` + searchJSX1;


if(code.includes(searchState)) { code = code.replace(searchState, replaceState); }
if(code.includes(searchFiltered)) { code = code.replace(searchFiltered, replaceFiltered); }
if(code.includes(searchJSX1)) { 
  code = code.replace(searchJSX1, replaceJSX1); 
}

fs.writeFileSync('src/components/InvoicingManager.tsx', code);
console.log("Patched InvoicingManager.tsx successfully");
