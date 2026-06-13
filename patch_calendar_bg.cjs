const fs = require('fs');

let path = 'src/components/TasksManager.tsx';
let code = fs.readFileSync(path, 'utf8');

// Ensure isWeekend is imported
if (!code.includes('isWeekend')) {
  code = code.replace(/import \{([^}]+)\} from 'date-fns';/, "import { , isWeekend } from 'date-fns';");
}

// Add weekend background color style
const classMatch = `"bg-white dark:bg-slate-900 border-r border-b border-slate-200 dark:border-slate-800 p-1 sm:p-2 transition-all relative group",`;
const classReplace = `cn("border-r border-b border-slate-200 dark:border-slate-800 p-1 sm:p-2 transition-all relative group", isWeekend(day) ? "bg-slate-50 dark:bg-slate-800/20" : "bg-white dark:bg-slate-900"),`;

code = code.replace(classMatch, classReplace);

// replace hover add task logic
const addTaskMatch = `opacité-0 group-hover:opacity-100`; // this is currently "opacity-0 group-hover:opacity-100"
code = code.replace(/opacity-0 group-hover:opacity-100/g, "opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100");
// just in case we need mobile tap

fs.writeFileSync(path, code);
console.log('patched');
