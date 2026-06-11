const fs = require('fs');
const content = fs.readFileSync('src/components/Journal.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(line => line.includes('transactions.map((tx) => ('));
const endIndex = lines.findIndex((line, i) => i > startIndex && line.includes('))') && lines[i+1]?.includes(')}'));

if (startIndex !== -1 && endIndex !== -1) {
    const rowLines = lines.slice(startIndex + 1, endIndex + 1);
    const componentLines = [
        `const TransactionRow = React.memo(({`,
        `  tx,`,
        `  selectedIds,`,
        `  toggleSelection,`,
        `  handleShowDetail,`,
        `  currentView,`,
        `  baseCurrency,`,
        `  formatCurrency,`,
        `  handleEdit,`,
        `  handleDuplicate,`,
        `  handleCreateInvoiceFromTransaction,`,
        `  handleRestore,`,
        `  handleDelete`,
        `}: any) => {`,
        `  return (`,
        ...rowLines.map(l => l.replace(/\}$/, ');')), // Remove the last })) things carefully, wait, let's keep it simple
    ];
}
