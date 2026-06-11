const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// remove filteredNavGroups block
code = code.replace(/const filteredNavGroups = navGroups\.map[\s\S]*?group\.items\.length > 0\);\n/g, '');

// update filteredGroups
code = code.replace(
  '(!item.module || isActive(item.module))',
  '(!item.module || isActive(item.module)) && (taxesEnabled || (item.id !== "vat" && item.id !== "tax-report"))'
);

fs.writeFileSync('src/components/Sidebar.tsx', code, 'utf8');
console.log('Fixed nav array');
