const fs = require('fs');
const code = fs.readFileSync('server.ts', 'utf8');

const regex = /INSERT INTO\s+(\w+)\s*\(([\s\S]*?)\)\s+VALUES\s*\(([\s\S]*?)\)/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const table = match[1];
  const cols = match[2].split(',').map(s => s.trim()).filter(Boolean);
  
  const valuesStr = match[3];
  
  let valTerms = 0;
  let inString = false;
  let inParen = 0;
  let currentTerm = '';
  for(let i=0; i<valuesStr.length; i++) {
    const c = valuesStr[i];
    if(c === "'") inString = !inString;
    if(c === '(' && !inString) inParen++;
    if(c === ')' && !inString) inParen--;
    
    if(c === ',' && !inString && inParen === 0) {
      valTerms++;
      currentTerm = '';
    } else {
      currentTerm += c;
    }
  }
  if(currentTerm.trim().length > 0) valTerms++;
  
  if (cols.length !== valTerms) {
    console.log(`Mismatch in ${table}: ${cols.length} cols vs ${valTerms} values. valuesStr: ${valuesStr}`);
  }
}
