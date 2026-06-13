const fs = require('fs');

let path = 'src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /import \{ ExpertAdvisor \} from '\.\/components\/ExpertAdvisor';/,
  "import { ExpertAdvisor } from './components/ExpertAdvisor';\nimport { FinancialAuditor } from './components/FinancialAuditor';"
);

code = code.replace(
  /<Route path="assistant" element=\{<ExpertAdvisor \/>\} \/>/,
  "<Route path=\"assistant\" element={<ExpertAdvisor />} />\n                  <Route path=\"financial-auditor\" element={<FinancialAuditor />} />"
);

fs.writeFileSync(path, code);
