const fs = require('fs');

let path = 'server/validation.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /vatRegime: z\.string\(\)\.optional\(\)\.nullable\(\),/,
  "vatRegime: z.string().optional().nullable(),\n  taxDeadlines: z.string().optional().nullable(),"
);
// fallback
if (!code.includes('taxDeadlines: z.string')) {
    code = code.replace(
      /currency: z\.string\(\)\.optional\(\)\.nullable\(\),/,
      "currency: z.string().optional().nullable(),\n  taxDeadlines: z.string().optional().nullable(),"
    );
}

fs.writeFileSync(path, code);
console.log('patched validation.ts');
