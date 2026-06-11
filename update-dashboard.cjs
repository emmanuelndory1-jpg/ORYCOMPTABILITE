const fs = require('fs');

let text = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

text = text.replace(
  "const { isActive } = useModules();",
  "const { isActive } = useModules();\n  const { companySettings } = useOutletContext<any>();\n  const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;"
);

// We need to add import for useOutletContext if it doesn't exist
if (!text.includes('useOutletContext')) {
  text = text.replace(
    "import { useNavigate",
    "import { useNavigate, useOutletContext "
  );
}

const quickActionsItemsOriginal = `
          {[
            { label: 'Journal', icon: Calculator, path: '/journal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Tiers', icon: Users, path: '/third-parties', color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
            { label: 'Trésorerie', icon: Wallet, path: '/treasury', color: 'text-brand-green', bg: 'bg-brand-green/10' },
            { label: 'Factures', icon: FileText, path: '/invoicing', color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Paie & RH', icon: Users, path: '/payroll', color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { label: 'TVA', icon: Percent, path: '/vat', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Actifs', icon: Building2, path: '/assets', color: 'text-rose-500', bg: 'bg-rose-500/10' },
            { label: 'Audit', icon: ShieldCheck, path: '/audit', color: 'text-slate-500', bg: 'bg-slate-500/10' },
          ].map((item, idx) => (
`;

const quickActionsItemsNew = `
          {[
            { label: 'Journal', icon: Calculator, path: '/journal', color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Tiers', icon: Users, path: '/third-parties', color: 'text-brand-gold', bg: 'bg-brand-gold/10' },
            { label: 'Trésorerie', icon: Wallet, path: '/treasury', color: 'text-brand-green', bg: 'bg-brand-green/10' },
            { label: 'Factures', icon: FileText, path: '/invoicing', color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { label: 'Paie & RH', icon: Users, path: '/payroll', color: 'text-orange-500', bg: 'bg-orange-500/10' },
            ...(taxesEnabled ? [{ label: 'TVA', icon: Percent, path: '/vat', color: 'text-emerald-500', bg: 'bg-emerald-500/10' }] : []),
            { label: 'Actifs', icon: Building2, path: '/assets', color: 'text-rose-500', bg: 'bg-rose-500/10' },
            { label: 'Audit', icon: ShieldCheck, path: '/audit', color: 'text-slate-500', bg: 'bg-slate-500/10' },
          ].map((item, idx) => (
`;

text = text.replace(quickActionsItemsOriginal, quickActionsItemsNew);

fs.writeFileSync('src/components/Dashboard.tsx', text, 'utf8');
console.log('Fixed Dashboard.tsx to hide TVA');
