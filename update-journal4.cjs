const fs = require('fs');

const path = 'src/components/Journal.tsx';
let content = fs.readFileSync(path, 'utf8');

// The marker
const startMarker = 'transactions.map((tx) => (';
const endMarker = '                  ))';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  // Let's create a useMemo hook at the beginning of the functional component
  const useMemoStr = `
  const renderedTransactions = React.useMemo(() => {
    return transactions.map((tx) => (
      ${content.substring(startIndex + startMarker.length, endIndex)}
    ));
  }, [transactions, selectedIds, currentView, baseCurrency, formatCurrency]);
  `;
  
  // Actually, there are dependencies like `handleShowDetail`, `handleEdit` which would cause re-renders if not wrapped in useCallback.
  // It's safer to just wrap the map inside useMemo directly in JSX.
  const jsxUseMemo = `{React.useMemo(() => transactions.map((tx) => (
${content.substring(startIndex + startMarker.length, endIndex)}
  )), [transactions, selectedIds, currentView, baseCurrency])}`;

  content = content.substring(0, startIndex) + jsxUseMemo + content.substring(endIndex + endMarker.length);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Journal.tsx updated successfully!");
} else {
  console.log("Could not find markers.");
}
