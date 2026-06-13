const fs = require('fs');

let path = 'src/components/TasksManager.tsx';
let code = fs.readFileSync(path, 'utf8');

const eventBlockMatch = `<span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full mr-1" style={{backgroundColor: 'currentColor'}} />
                  {e.title}`;

const eventBlockReplacement = `{e.type === 'task' ? <CheckSquare size={10} className="mr-1 shrink-0" /> : 
                   (e.type === 'invoice' || e.type === 'quote') ? <FileText size={10} className="mr-1 shrink-0" /> :
                   e.type === 'recurring' ? <Repeat size={10} className="mr-1 shrink-0" /> :
                   e.type === 'payroll' ? <Users size={10} className="mr-1 shrink-0" /> :
                   e.type === 'transaction' ? <CreditCard size={10} className="mr-1 shrink-0" /> :
                   e.type === 'asset' ? <FileText size={10} className="mr-1 shrink-0" /> :
                   e.type === 'crm' ? <Users size={10} className="mr-1 shrink-0" /> :
                   e.type === 'advance' ? <CreditCard size={10} className="mr-1 shrink-0" /> :
                   <CalendarIcon size={10} className="mr-1 shrink-0" />}
                  <span className="truncate">{e.title}</span>`;

code = code.replace(eventBlockMatch, eventBlockReplacement);

// Change week view tallness
code = code.replace(/view === 'week' \? "min-h-\[200px\]" : "min-h-\[100px\] sm:min-h-\[120px\]"/, 'view === \'week\' ? "min-h-[300px]" : "min-h-[100px] sm:min-h-[120px]"');

// Change display limits
code = code.replace(/const maxDisplay = view === 'week' \? 10 : 3;/, 'const maxDisplay = view === \'week\' ? 15 : 4;');

// Add flex items-center gap-0.5 to the classname
code = code.replace(/"text-\[9px\] sm:text-\[10px\] px-1.5 py-1 rounded truncate cursor-pointer transition-colors border font-bold shadow-sm relative z-10"/, '"text-[9px] sm:text-[10px] px-1.5 py-1 rounded cursor-pointer transition-colors border font-bold shadow-sm relative z-10 flex items-center"');

fs.writeFileSync(path, code);
console.log('patched');
