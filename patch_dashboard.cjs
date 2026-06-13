const fs = require('fs');
let path = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /{isVisible\('ai_insight'\) && \([\s\S]*?<\/motion\.div>\n\s*\)}/g;
const result = code.replace(regex, '');
fs.writeFileSync(path, result);
console.log('patched ai_insight');
