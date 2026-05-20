const fs = require('fs');

const filesToFix = [
  'src/components/Journal.tsx',
  'src/components/HRReports.tsx',
  'src/components/PayrollWizard.tsx',
  'src/components/AuditTrail.tsx',
  'src/components/Dashboard.tsx',
  'src/components/PayrollManager.tsx',
  'src/components/AuditLogViewer.tsx',
  'src/lib/exportUtils.ts'
];

filesToFix.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('JSON.parse')) {
    content = 'import { parseSafeJSON } from "../lib/utils";\n' + content.replace(/JSON\.parse\(/g, 'parseSafeJSON(');
    fs.writeFileSync(file, content);
  }
});
