const fs = require('fs');
let path = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(path, 'utf8');

// The errors in Dashboard.tsx:
// 360: setAiInsight...
// 362: fetchInsight...
// 1149: fetchInsight
// 1150: loadingInsight
// 1154: loadingInsight
// 1162: loadingInsight
// 1168: aiInsight

code = code.replace(/setAiInsight\(.*?\);/g, '');
code = code.replace(/fetchInsight\(.*?\);/g, '');
code = code.replace(/loadingInsight/g, 'false');
code = code.replace(/aiInsight/g, 'null');

fs.writeFileSync(path, code);
