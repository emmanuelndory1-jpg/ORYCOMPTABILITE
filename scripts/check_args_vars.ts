import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

// Try finding blocks of function or route handler.
// Since variable names are local, we can just split the file by 'app.get' or 'app.post' etc.
const routes = code.split(/app\.(get|post|put|delete)/);

for (let r = 0; r < routes.length; r++) {
  const segment = routes[r];
  
  const prepareRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*db\.prepare\(([`'"])((?:(?!\2).|\n)*)\2\)/g;
  const stmts = {};
  let match;
  while ((match = prepareRegex.exec(segment)) !== null) {
    stmts[match[1]] = (match[3].match(/\?/g) || []).length;
  }
  
  for (const varName of Object.keys(stmts)) {
    const expected = stmts[varName];
    const callRegex = new RegExp(`\\b${varName}\\.(get|all|run)\\s*\\(([^)]*)\\)`, 'g');
    let callMatch;
    while ((callMatch = callRegex.exec(segment)) !== null) {
      const argsRaw = callMatch[2].trim();
      if (!argsRaw) continue;
      
      let got = 1;
      let d = 0;
      for(let i=0; i<argsRaw.length; i++){
        if(argsRaw[i]==='('||argsRaw[i]==='['||argsRaw[i]==='{') d++;
        if(argsRaw[i]===')'||argsRaw[i]===']'||argsRaw[i]==='}') d--;
        if(argsRaw[i]===',' && d===0) got++;
      }
      
      if (expected < got && !argsRaw.includes('...')) {
        console.log(`\nMISMATCH in segment (Expected ${expected}, Got ${got}) for ${varName}`);
        console.log(`Call: ${callMatch[0]}`);
      }
    }
  }
}
