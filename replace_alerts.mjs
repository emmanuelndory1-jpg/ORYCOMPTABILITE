import fs from 'fs';
import path from 'path';

const componentsDir = 'src/components';
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if we don't use 'alert('
  if (!content.includes('alert(') && !content.includes('window.alert(')) {
    continue;
  }

  // If we already have useDialog imported, just make sure we extract alert: dialogAlert
  let modified = false;

  // Replace only function calls to alert, not destructuring 'alert'
  content = content.replace(/(?<!const \{[^}]*)\balert\s*\(/g, 'dialogAlert(');
  content = content.replace(/window\.alert\s*\(/g, 'dialogAlert(');

  if (!content.includes('import { useDialog }')) {
    content = `import { useDialog } from './DialogProvider';\n` + content;
    
    // Attempt to inject `const { alert: dialogAlert } = useDialog();` at the beginning of the component
    // We look for 'export function ComponentName() {' or 'export const ComponentName = () => {'
    content = content.replace(/(export (function|const) \w+\s*=?\s*\([^)]*\)\s*(:\s*React\.FC[^=]*=\s*)?(=>\s*)?\{)/, `$1\n  const { alert: dialogAlert } = useDialog();`);
  } else {
    // If it's imported, check if we destructure alert: dialogAlert
    if (!content.includes('alert: dialogAlert')) {
       if (content.includes('const { confirm } = useDialog()')) {
         content = content.replace('const { confirm } = useDialog()', 'const { confirm, alert: dialogAlert } = useDialog()');
       } else if (content.includes('const { alert } = useDialog()')) {
         content = content.replace('const { alert } = useDialog()', 'const { alert: dialogAlert } = useDialog()');
       } else {
         // Just prepend it to the first export function...
         content = content.replace(/(export (function|const) \w+\s*=?\s*\([^)]*\)\s*(:\s*React\.FC[^=]*=\s*)?(=>\s*)?\{)/, `$1\n  const { alert: dialogAlert } = useDialog();`);
       }
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
