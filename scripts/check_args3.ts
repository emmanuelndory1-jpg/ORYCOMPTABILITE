import * as ts from 'typescript';
import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');
const sourceFile = ts.createSourceFile('server.ts', code, ts.ScriptTarget.Latest, true);

function countPlaceholders(sql: string) {
  return (sql.match(/\?/g) || []).length;
}

function traverse(node: ts.Node) {
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      const name = expr.name.text;
      if (['get', 'all', 'run'].includes(name)) {
        // We need to trace back to see if it's a Statement method.
        // For simplicity, we just assume any .get, .all, .run with arguments might be suspect,
        // IF we can find the db.prepare
        // A better heuristic is to find db.prepare calls.
      }
    }
  }
  ts.forEachChild(node, traverse);
}

// Just match regex accurately this time!
const regex = /(db\.prepare\(([`'"])((?:(?!\2).|\n)*)\2\)(?:\s*\n\s*)?(?:\.(?:bind)\((?:[^)]*)\))?\.(?:get|all|run)\(([^)]*)\))/g;

let match;
while ((match = regex.exec(code)) !== null) {
  const fullExpr = match[1];
  const sql = match[3];
  const argsRaw = match[4];
  
  if (!argsRaw.trim()) continue; // 0 args

  const expected = countPlaceholders(sql);
  
  // count commas that are top-level
  let got = 1;
  let d = 0;
  for(let i=0; i<argsRaw.length; i++){
    if(argsRaw[i]==='('||argsRaw[i]==='['||argsRaw[i]==='{') d++;
    if(argsRaw[i]===')'||argsRaw[i]===']'||argsRaw[i]==='}') d--;
    if(argsRaw[i]===',' && d===0) got++;
  }
  
  if (expected < got && !argsRaw.includes('...')) {
    console.log(`\nFound possible mismatch! Expected ${expected}, Got ${got}`);
    console.log(`SQL: ${sql.trim().slice(0, 80)}`);
    console.log(`Args: ${argsRaw}`);
  }
}
