const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceViewer.tsx', 'utf8');

const searchImports = `import { \n  X,`;
const replaceImports = `import { \n  X, BellRing,`;

const searchFunc = `const handleSendEmail = async () => {`;
const replaceFunc = `
  const handleSendReminder = async () => {
    try {
      const res = await apiFetch(\`/api/invoices/\${id}/remind\`, { method: 'POST' });
      if (res.ok) {
        dialogAlert("Rappel envoyé avec succès", 'success');
        if (onUpdate) onUpdate();
      } else {
        dialogAlert("Erreur lors de l'envoi du rappel", 'error');
      }
    } catch (err) {
      dialogAlert("Erreur réseau", 'error');
    }
  };
  
  ` + searchFunc;


  const searchJSXBtn = `{invoice.status === 'draft' && (`;
  const replaceJSXBtn = `{invoice.status === 'overdue' && (
              <button 
                onClick={handleSendReminder}
                className="flex-1 sm:flex-none p-3 sm:p-4 text-slate-500 hover:text-amber-600 hover:bg-amber-500/5 rounded-2xl transition-all active:scale-90 flex items-center justify-center gap-2 group"
                title="Envoyer un rappel de paiement"
              >
                <BellRing size={24} className="group-hover:-rotate-12 transition-transform" />
                <span className="sm:hidden font-bold text-sm">Relancer</span>
              </button>
            )}
            ` + searchJSXBtn;

if(code.includes(searchImports)) { code = code.replace(searchImports, replaceImports); }
if(code.includes(searchFunc)) { code = code.replace(searchFunc, replaceFunc); }
if(code.includes(searchJSXBtn)) { code = code.replace(searchJSXBtn, replaceJSXBtn); }

fs.writeFileSync('src/components/InvoiceViewer.tsx', code);
console.log("Patched InvoiceViewer.tsx successfully");
