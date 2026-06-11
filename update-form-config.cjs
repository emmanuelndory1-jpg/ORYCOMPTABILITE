const fs = require('fs');
let code = fs.readFileSync('src/components/Journal.tsx', 'utf8');

const replacement = `
  const getFormConfig = (type: string) => {
    const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;
    
    // First figure out the base logic
    let hasVAT = false;
    let hasPayment = false;
    let amountLabel = 'Montant';
    
    switch (type) {
      case 'vente_marchandises':
      case 'vente_services':
      case 'achat_marchandises':
      case 'achat_services':
      case 'frais_generaux':
        hasVAT = true;
        hasPayment = false;
        amountLabel = 'Montant HT';
        break;
      case 'encaissement_client':
      case 'paiement_fournisseur':
        hasVAT = false;
        hasPayment = true;
        amountLabel = 'Montant';
        break;
      default:
        hasVAT = true;
        hasPayment = true;
        amountLabel = 'Montant';
    }
    
    // Then forcibly disable VAT if company settings disable it
    if (!taxesEnabled) {
      hasVAT = false;
      if (amountLabel === 'Montant HT') {
        amountLabel = 'Montant (TTC/Total)';
      }
    }
    
    return { hasVAT, hasPayment, amountLabel };
  };
`;

// we need to replace the whole `const getFormConfig = (type: string) => { ... };`
const reg = /const getFormConfig = \(type: string\) => \{[\s\S]*?\};/;
code = code.replace(reg, replacement.trim());

fs.writeFileSync('src/components/Journal.tsx', code, 'utf8');
console.log('Fixed Journal.tsx getFormConfig');
