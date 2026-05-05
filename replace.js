const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;
      const regex = /\bfetch\((['"]\/api[^'"]+['"]|`\/api[^`]+`)/g;
      
      if (regex.test(content) && !content.includes('import { apiFetch }') && fullPath !== 'src/lib/api.ts') {
        content = content.replace(regex, 'apiFetch($1');
        
        // Add import at the top
        const depth = fullPath.split('/').length - 2; // src/components -> 1, src/components/ui/.. -> 2
        let importPath = '../lib/api';
        if (depth === 2) importPath = '../../lib/api';
        if (depth === 0) importPath = './lib/api';
        
        content = `import { apiFetch } from '${importPath}';\n` + content;
        modified = true;
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`Modified ${fullPath}`);
      }
    }
  }
}

replaceInDir('src');
