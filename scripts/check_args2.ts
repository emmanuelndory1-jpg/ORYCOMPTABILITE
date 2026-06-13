import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

// We need to parse all db.prepare(...).get(...) or .all(...) calls and verify parameter counts.

const matches = [];
const regex = /db\.prepare\(\s*([\s\S]*?)\s*\)\s*(?:\.(?:bind|pluck)\(.*?\)\s*)*\.(get|all|run)\(([\s\S]*?)\)/g;

let match;
while ((match = regex.exec(code)) !== null) {
  const sqlArg = match[1];
  const method = match[2];
  const paramsStr = match[3].trim();
  
  if (!paramsStr) continue;

  let sqlParamsCount = 0;
  if (/(\`|'|")/.test(sqlArg[0])) {
    const qmatch = sqlArg.match(/\?/g);
    sqlParamsCount = qmatch ? qmatch.length : 0;
    
    // count arguments passed
    let argCount = 1;
    let depth = 0;
    for (let j = 0; j < paramsStr.length; j++) {
      if (paramsStr[j] === '(' || paramsStr[j] === '[' || paramsStr[j] === '{') depth++;
      if (paramsStr[j] === ')' || paramsStr[j] === ']' || paramsStr[j] === '}') depth--;
      if (paramsStr[j] === ',' && depth === 0) argCount++;
    }
    
    // If it's an array or object passed as first param? Not standard better-sqlite3 unless it's an array for placeholders... better-sqlite3 .run(1,2) or .run([1,2])?
    if (sqlParamsCount !== argCount && !(paramsStr.includes('...'))) {
       console.log("MISMATCH AT LINE: ...",  sqlArg.slice(0, 40).replace(/\n/g," "), "| Expect:", sqlParamsCount, "| Got:", argCount, "| Params:", paramsStr);
    }
  }
}
