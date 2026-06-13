const fs = require('fs');

let code = fs.readFileSync('server/validation.ts', 'utf8');

code = code.replace(/password: z\.string\(\)\.min\([^,]+,[^\)]+\)/, 
  "password: z.string().min(1, \"Le mot de passe est requis\")");

fs.writeFileSync('server/validation.ts', code);
