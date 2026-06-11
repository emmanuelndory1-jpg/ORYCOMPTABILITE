const fs = require('fs');

let content = fs.readFileSync('src/components/Journal.tsx', 'utf8');

const startIndex = content.indexOf('transactions.map((tx) => (');
if (startIndex !== -1) {
    const endIndex = content.indexOf('))', startIndex) + 2; // to cover the "))"
    const rowContent = content.substring(startIndex, endIndex);

    const strippedContent = rowContent.replace('transactions.map((tx) => (', '');
    
    let newComponent = `
const TransactionRow = React.memo(({
  tx,
  selectedIds,
  toggleSelection,
  handleShowDetail,
  currentView,
  baseCurrency,
  formatCurrency,
  handleEdit,
  handleDuplicate,
  handleCreateInvoiceFromTransaction,
  handleRestore,
  handleDelete
}: any) => {
  return (
    ${strippedContent.substring(0, strippedContent.length - 2)}
  );
});
`;

    const exportIndex = content.search(/export (default )?function Journal/);
    if (exportIndex !== -1) {
        content = content.slice(0, exportIndex) + newComponent + '\n' + content.slice(exportIndex);
    }
    
    const replacement = `transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      selectedIds={selectedIds}
                      toggleSelection={toggleSelection}
                      handleShowDetail={handleShowDetail}
                      currentView={currentView}
                      baseCurrency={baseCurrency}
                      formatCurrency={formatCurrency}
                      handleEdit={handleEdit}
                      handleDuplicate={handleDuplicate}
                      handleCreateInvoiceFromTransaction={handleCreateInvoiceFromTransaction}
                      handleRestore={handleRestore}
                      handleDelete={handleDelete}
                    />
                  ))`;
                  
    content = content.replace(rowContent, replacement);
    fs.writeFileSync('src/components/Journal.tsx', content, 'utf8');
    console.log("Updated Journal.tsx");
} else {
    console.log("Could not find transactions.map segment");
}
