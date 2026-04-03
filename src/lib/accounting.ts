
export interface JournalEntryLine {
  account_code: string;
  account_name?: string;
  debit: number;
  credit: number;
}

export interface CustomOperationTemplate {
  account_code: string;
  type: 'debit' | 'credit';
  formula: 'ht' | 'tva' | 'ttc';
}

export interface CustomOperation {
  id: number;
  label: string;
  icon: string;
  vat_account_debit?: string;
  vat_account_credit?: string;
  entries_template: CustomOperationTemplate[];
}

export type PaymentMode = 'caisse' | 'banque' | 'mobile_money' | 'credit';

export const DEFAULT_OPERATION_TYPES = [
  { id: 'vente_marchandises', label: 'Vente Marchandises', icon: '🛒' },
  { id: 'vente_services', label: 'Prestation Services', icon: '💼' },
  { id: 'achat_marchandises', label: 'Achat Stock', icon: '📦' },
  { id: 'achat_services', label: 'Achat Services', icon: '🛠️' },
  { id: 'frais_generaux', label: 'Frais Généraux', icon: '💡' },
  { id: 'paiement_fournisseur', label: 'Paiement Fournisseur', icon: '💸' },
  { id: 'encaissement_client', label: 'Encaissement Client', icon: '💰' },
  { id: 'paiement_salaire', label: 'Paiement Salaire', icon: '👥' },
  { id: 'paiement_impot', label: 'Paiement Impôt', icon: '🏛️' },
  { id: 'retrait_banque', label: 'Retrait Banque', icon: '🏧' },
  { id: 'depot_banque', label: 'Dépôt Banque', icon: '🏦' },
  { id: 'pret_bancaire', label: 'Prêt Bancaire', icon: '🤝' },
  { id: 'amortissement', label: 'Amortissement', icon: '📉' },
  { id: 'charges_a_payer', label: 'Charges à payer', icon: '🕒' },
  { id: 'charges_constatees_avance', label: 'Charges constatées d\'avance', icon: '⏳' },
  { id: 'produits_constates_avance', label: 'Produits constatés d\'avance', icon: '📦' },
];

export const calculateEntries = (
  operationType: string,
  amountHT: number,
  vatRate: number,
  paymentMode: PaymentMode,
  customOperations: CustomOperation[],
  thirdPartyAccount?: string,
  vatSettings: { rate: number, account_collected: string, account_deductible: string }[] = [],
  treasuryAccount?: string,
  companySettings?: any
): JournalEntryLine[] => {
  const ht = Number(amountHT) || 0;
  const tva = Math.round(ht * (vatRate / 100));
  const ttc = ht + tva;

  let newEntries: JournalEntryLine[] = [];

  // Helper to get payment account
  const getPaymentAccount = () => {
    if (treasuryAccount) return treasuryAccount;
    switch (paymentMode) {
      case 'caisse': return companySettings?.payment_cash_account || '571';
      case 'banque': return companySettings?.payment_bank_account || '521';
      case 'mobile_money': return companySettings?.payment_mobile_account || '585';
      case 'credit': return thirdPartyAccount || '401'; // Default supplier if credit
    }
  };

  // Helper to get client account
  const getClientAccount = () => {
    if (paymentMode === 'credit') return thirdPartyAccount || '411';
    return getPaymentAccount();
  };

  // Helper to get supplier account
  const getSupplierAccount = () => {
    if (paymentMode === 'credit') return thirdPartyAccount || '401';
    return getPaymentAccount();
  };

  // Find VAT accounts based on selected rate
  const vatSetting = vatSettings.find(s => s.rate === vatRate);
  const vatAccountCollected = vatSetting?.account_collected || '4431';
  const vatAccountDeductible = vatSetting?.account_deductible || '4452';

  // Check if it's a custom operation
  if (operationType.startsWith('custom_')) {
    const customOpId = parseInt(operationType.split('_')[1]);
    const customOp = customOperations.find(op => op.id === customOpId);
    
    if (customOp) {
      newEntries = customOp.entries_template.map(line => {
        let amount = 0;
        if (line.formula === 'ht') amount = ht;
        if (line.formula === 'tva') amount = tva;
        if (line.formula === 'ttc') amount = ttc;

        let account = line.account_code;
        if (account === 'PAYMENT') account = getPaymentAccount();
        if (account === 'THIRD_PARTY') account = thirdPartyAccount || (paymentMode === 'credit' ? '401' : getPaymentAccount());
        if (account === 'VAT_DEBIT') account = customOp.vat_account_debit || vatAccountDeductible;
        if (account === 'VAT_CREDIT') account = customOp.vat_account_credit || vatAccountCollected;

        return {
          account_code: account,
          debit: line.type === 'debit' ? amount : 0,
          credit: line.type === 'credit' ? amount : 0
        };
      });
      return newEntries.filter(e => e.debit > 0 || e.credit > 0);
    }
  }

  switch (operationType) {
    case 'vente_marchandises':
      newEntries = [
        { account_code: getClientAccount(), debit: ttc, credit: 0 },
        { account_code: '701', debit: 0, credit: ht },
        { account_code: vatAccountCollected, debit: 0, credit: tva }
      ];
      break;

    case 'vente_services':
      newEntries = [
        { account_code: getClientAccount(), debit: ttc, credit: 0 },
        { account_code: '706', debit: 0, credit: ht },
        { account_code: vatAccountCollected, debit: 0, credit: tva }
      ];
      break;

    case 'achat_marchandises':
      newEntries = [
        { account_code: '601', debit: ht, credit: 0 },
        { account_code: vatAccountDeductible, debit: tva, credit: 0 },
        { account_code: getSupplierAccount(), debit: 0, credit: ttc }
      ];
      break;

    case 'achat_services':
    case 'frais_generaux':
      newEntries = [
        { account_code: '605', debit: ht, credit: 0 }, // Simplified to 605 for MVP
        { account_code: vatAccountDeductible, debit: tva, credit: 0 },
        { account_code: getSupplierAccount(), debit: 0, credit: ttc }
      ];
      break;

    case 'amortissement':
      // Dotation aux amortissements
      newEntries = [
        { account_code: '681', debit: ht, credit: 0 }, // Dotations d'exploitation
        { account_code: '281', debit: 0, credit: ht }  // Amortissement immobilisations corporelles (simplified)
      ];
      break;

    case 'charges_a_payer':
      // Charges à payer (Facture non parvenue)
      newEntries = [
        { account_code: '605', debit: ht, credit: 0 },
        { account_code: '4458', debit: tva, credit: 0 }, // TVA à régulariser
        { account_code: '408', debit: 0, credit: ttc }   // Fournisseurs, factures non parvenues
      ];
      break;

    case 'charges_constatees_avance':
      // Regularization: Debit 476, Credit 6xx
      newEntries = [
        { account_code: '476', debit: ht, credit: 0 },
        { account_code: '605', debit: 0, credit: ht } // Using 605 as generic expense
      ];
      break;

    case 'produits_constates_avance':
      // Regularization: Debit 7xx, Credit 477
      newEntries = [
        { account_code: '706', debit: ht, credit: 0 }, // Using 706 as generic revenue
        { account_code: '477', debit: 0, credit: ht }
      ];
      break;

    case 'paiement_fournisseur':
      newEntries = [
        { account_code: thirdPartyAccount || '401', debit: ttc, credit: 0 },
        { account_code: getPaymentAccount(), debit: 0, credit: ttc }
      ];
      break;

    case 'encaissement_client':
      newEntries = [
        { account_code: getPaymentAccount(), debit: ttc, credit: 0 },
        { account_code: thirdPartyAccount || '411', debit: 0, credit: ttc }
      ];
      break;

    case 'paiement_salaire':
      newEntries = [
        { account_code: '661', debit: ttc, credit: 0 }, // Rémunération directe
        { account_code: getPaymentAccount(), debit: 0, credit: ttc }
      ];
      break;

    case 'paiement_impot':
      newEntries = [
        { account_code: '444', debit: ttc, credit: 0 }, // Etat, Impôts (assumption)
        { account_code: getPaymentAccount(), debit: 0, credit: ttc }
      ];
      break;

    case 'retrait_banque':
      // Banque -> Caisse
      newEntries = [
        { account_code: companySettings?.payment_cash_account || '571', debit: ttc, credit: 0 },
        { account_code: companySettings?.payment_bank_account || '521', debit: 0, credit: ttc }
      ];
      break;

    case 'depot_banque':
      // Caisse -> Banque
      newEntries = [
        { account_code: companySettings?.payment_bank_account || '521', debit: ttc, credit: 0 },
        { account_code: companySettings?.payment_cash_account || '571', debit: 0, credit: ttc }
      ];
      break;

    case 'pret_bancaire':
      // Réception emprunt
      newEntries = [
        { account_code: companySettings?.payment_bank_account || '521', debit: ttc, credit: 0 },
        { account_code: '162', debit: 0, credit: ttc }
      ];
      break;
  }

  // Filter out zero lines (e.g. if TVA is 0)
  return newEntries.filter(e => e.debit > 0 || e.credit > 0);
};
