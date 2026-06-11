const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');
content = content.replace(/gemini-3-flash-preview/g, 'gemini-3.5-flash');
fs.writeFileSync('src/services/geminiService.ts', content);

let currContent = fs.readFileSync('src/components/CurrencyAnalyzer.tsx', 'utf8');
currContent = currContent.replace(/gemini-3-flash-preview/g, 'gemini-3.5-flash');
fs.writeFileSync('src/components/CurrencyAnalyzer.tsx', currContent);

let serverContent = fs.readFileSync('server.ts', 'utf8');
serverContent = serverContent.replace(/"gemini-2\.5-flash", "gemini-2\.5-pro"/g, '"gemini-3.5-flash", "gemini-3.1-pro-preview"');
fs.writeFileSync('server.ts', serverContent);
