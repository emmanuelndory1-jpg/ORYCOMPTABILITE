import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

// Find all db.prepare calls and map them to their variable names
const prepareRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*db\.prepare\(([`'"])((?:(?!\2).|\n)*)\2\)/g;

const stmts = {};
let match;
while ((match = prepareRegex.exec(code)) !== null) {
  const varName = match[1];
  const sql = match[3];
  stmts[varName] = (sql.match(/\?/g) || []).length;
}

// Now find all calls to these variables
for (const varName of Object.keys(stmts)) {
  const expected = stmts[varName];
  
  // Find varName.get(...), varName.all(...), varName.run(...)
  const callRegex = new RegExp(`\\b${varName}\\.(get|all|run)\\s*\\(([^)]*)\\)`, 'g');
  let callMatch;
  while ((callMatch = callRegex.exec(code)) !== null) {
    const argsRaw = callMatch[2];
    
    if (!argsRaw.trim()) {
       if (expected > 0) {
           // wait, missing params usually throws "Expected X parameters, got 0"
       }
       continue;
    }
    
    let got = 1;
    let d = 0;
    for(let i=0; i<argsRaw.length; i++){
      if(argsRaw[i]==='('||argsRaw[i]==='['||argsRaw[i]==='{') d++;
      if(argsRaw[i]===')'||argsRaw[i]===']'||argsRaw[i]==='}') d--;
      if(argsRaw[i]===',' && d===0) got++;
    }
    
    if (expected < got && !argsRaw.includes('...')) {
      console.log(`\nMISMATCH for variable: ${varName} (Expected ${expected}, Got ${got})`);
      console.log(`Call: ${callMatch[0]}`);
    }
  }
}
