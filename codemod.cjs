const fs = require('fs');

let code = fs.readFileSync('/src/components/Dashboard.tsx', 'utf8');

const importMaximize = "Maximize2, Minimize2,";
if (!code.includes('Maximize2,')) {
    code = code.replace(/import \{([\s\S]*?)ExternalLink, Download,/g, "import {$1ExternalLink, Download, Maximize2, Minimize2,");
}

let addition = `
  const [maximizedWidget, setMaximizedWidget] = useState<string | null>(null);

  const maxClasses = (id: string) => maximizedWidget === id 
    ? "fixed inset-0 sm:inset-4 md:inset-8 z-[100] m-0 !rounded-[2.5rem] !max-w-none !col-span-full shadow-2xl overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
    : "";

  const MaximizeButton = ({ id }: { id: string }) => (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMaximizedWidget(maximizedWidget === id ? null : id); }}
      className="absolute top-4 right-4 p-2 sm:p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all duration-300 z-[110] opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 shadow-lg backdrop-blur-md"
      aria-label="Plein écran"
      title="Plein écran"
    >
      {maximizedWidget === id ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );
`;

if (!code.includes('const maxClasses =')) {
    code = code.replace("const [isExportingImage, setIsExportingImage] = useState(false);", "const [isExportingImage, setIsExportingImage] = useState(false);\n" + addition);
}

const isVisibleRegex = /\{isVisible\('([^']+)'\) && \(\s*<motion\.div([\s\S]+?)className=(["{])([\s\S]+?)(["}])\s*>/g;

code = code.replace(isVisibleRegex, (match, id, beforeClass, classQuoteStart, classContent, classQuoteEnd) => {
    let newClassContent = classContent;
    if (classQuoteStart === '"') {
       newClassContent = `cn("${classContent}", maxClasses('${id}'))`;
    } else if (classQuoteStart === '{') {
       if (classContent.startsWith('cn(') && classContent.endsWith(')')) {
          newClassContent = `{cn(${classContent.slice(3, -1)}, maxClasses('${id}'))}`;
       }
       else if (classContent.includes("maxClasses")) {
           return match;
       } else {
          newClassContent = `{cn(${classContent}, maxClasses('${id}'))}`;
       }
    }

    if (id === 'stats') return match; 

    let rep = `{isVisible('${id}') && (\n          <motion.div${beforeClass}className=${classQuoteStart === '"' ? `{${newClassContent}}` : newClassContent}>\n            <MaximizeButton id="${id}" />`;
    return rep;
});

if (code.includes('const StatCard =') && !code.includes('maxClasses(id)')) {
    code = code.replace(
      /const StatCard = \(\{[\s\S]+?colSpan[^\}]+?\}\: any\) => \(\s*<motion\.div[\s\S]+?className=\{cn\(([\s\S]+?)\)\}\s*>/,
      (match, classContent) => {
          let injected = match.replace(/className=\{cn\(/, "className={cn(").replace(/\)\}\s*>$/, `, maxClasses(id))}\n    >`);
          injected += `\n      {id && <MaximizeButton id={id} />}`;
          return injected;
      }
    );
}

fs.writeFileSync('/src/components/Dashboard.tsx', code);
console.log('Modified /src/components/Dashboard.tsx');
