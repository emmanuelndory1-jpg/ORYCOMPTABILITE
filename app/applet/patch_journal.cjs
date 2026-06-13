const fs = require('fs');
let code = fs.readFileSync('src/components/Journal.tsx', 'utf8');

if (!code.includes('saveLocalTransactions')) {
  // Find imports and add
  code = code.replace("import { ThirdPartyFormModal } from './ThirdPartyFormModal';", 
    "import { ThirdPartyFormModal } from './ThirdPartyFormModal';\nimport { saveLocalTransactions } from '../lib/dataSync';");
  
  // Find where it sets transactions and add saving
  code = code.replace("setTransactions(data);", 
    "setTransactions(data);\n      if (currentView !== 'trash') { saveLocalTransactions(data).catch(console.error); }");
    
  fs.writeFileSync('src/components/Journal.tsx', code);
}
