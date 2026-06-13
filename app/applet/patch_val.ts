import fs from 'fs';

let code = fs.readFileSync('server/validation.ts', 'utf8');

code = code.replace(/export const loginSchema = z\.object\(\{\s*email:([^,]+),\s*password: z\.string\(\)\.min\([^,]+,[^\)]+\)/, 
  "export const loginSchema = z.object({\n  email:$1,\n  password: z.string().min(1, \"Le mot de passe est requis\")");

fs.writeFileSync('server/validation.ts', code);
