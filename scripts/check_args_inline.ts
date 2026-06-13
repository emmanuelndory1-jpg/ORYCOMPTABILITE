import fs from 'fs';
import * as ts from 'typescript';

const code = fs.readFileSync('server.ts', 'utf8');
const sourceFile = ts.createSourceFile('server.ts', code, ts.ScriptTarget.Latest, true);

function countPlaceholders(sql: string) {
  return (sql.match(/\?/g) || []).length;
}

// Find statements like: const varName = db.prepare('...').get/all/run(...)
const regexInline = /db\.prepare\(([`'"])((?:(?!\1).|\n)*)\1\)\s*(?:\n\s*)?(?:\.(?:bind)\((?:[^)]*)\))?\.(get|all|run)\(([^)]*)\)/g;

let match;
while ((match = regexInline.exec(code)) !== null) {
  const sql = match[2];
  const method = match[3];
  const argsRaw = match[4].trim();
  
  if (argsRaw === '') continue;

  const expected = countPlaceholders(sql);
  
  let got = 1;
  let d = 0;
  for(let i=0; i<argsRaw.length; i++){
    if(argsRaw[i]==='('||argsRaw[i]==='['||argsRaw[i]==='{') d++;
    if(argsRaw[i]===')'||argsRaw[i]===']'||argsRaw[i]==='}') d--;
    if(argsRaw[i]===',' && d===0) got++;
  }
  
  if (expected < got && !argsRaw.includes('...')) {
    console.log(`\nINLINE MISMATCH: Expected ${expected}, Got ${got}`);
    console.log(`SQL: ${sql.slice(0, 50).trim()}`);
    console.log(`Args: ${argsRaw}`);
  }
}
