const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  "logoUrl?: string | null;",
  "logoUrl?: string | null;\n  taxesEnabled?: boolean;"
);

code = code.replace(
  "logoUrl, user }: SidebarProps)",
  "logoUrl, user, taxesEnabled = true }: SidebarProps)"
);

// We need to conditionally remove or add 'vat' to navGroups
// Wait, `taxesEnabled` is available in the component body.
// So we can filter out module: 'vat' if !taxesEnabled

const filterLogic = `
  const filteredNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Modèles Conditionnels
      if (item.module && !isActive(item.module)) return false;
      
      // Activer / Désactiver la TVA et les impôts
      if (!taxesEnabled && (item.id === 'vat' || item.id === 'tax-report')) {
        return false;
      }
      
      return true;
    })
  })).filter(group => group.items.length > 0);
`;

code = code.replace(
  /navGroups\.map\(\(group, groupIdx\) => \(\{/g,
  `filteredNavGroups.map((group, groupIdx) => ({`
);

// We can inject filteredNavGroups before return
code = code.replace(
  '  return (',
  filterLogic + '\n  return ('
);

fs.writeFileSync('src/components/Sidebar.tsx', code, 'utf8');
console.log('Fixed Sidebar.tsx');
