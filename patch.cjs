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
      
      if (regex.test(content) && !content.includes('import { apiFetch }') && fullPath !== 'src/lib/api.ts' && fullPath !== 'src/main.tsx') {
        content = content.replace(regex, 'apiFetch($1');
        
        let importPath = '../lib/api';
        const depth = fullPath.split('/').length - 2; 
        if (depth === 2) importPath = '../../lib/api';
        if (depth === 0) importPath = './lib/api';
        if (depth === 1) importPath = '../lib/api'; // src/components
        
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
