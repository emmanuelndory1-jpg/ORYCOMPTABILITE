const fs = require('fs');

const path = 'src/components/Journal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace {React.useMemo with React.useMemo
content = content.replace('{React.useMemo(() => transactions.map((tx) => (', 'React.useMemo(() => transactions.map((tx) => (');

// and the end brace })} to )}
content = content.replace(')), [transactions, selectedIds, currentView, baseCurrency])}', ')), [transactions, selectedIds, currentView, baseCurrency])');

fs.writeFileSync(path, content, 'utf8');
