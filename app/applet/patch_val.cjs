const fs = require('fs');
let code = fs.readFileSync('server/validation.ts', 'utf8');
code = code.replace(/password: z\.string\(\)\.min\(\d+.*?\)/g, "password: z.string().min(1, \"Mot de passe requis\")");
fs.writeFileSync('server/validation.ts', code);
