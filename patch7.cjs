const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicingManager.tsx', 'utf8');

const s1 = `const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');`;
const r1 = `const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');`;

if(code.includes(s1)) {
  code = code.replace(s1, r1);
}

const s2 = `const filteredDocs = (documents || []).filter(doc => {
    const matchesSearch = (doc.number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                          (doc.third_party_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');`;

// Let me just fix it manually using generic regex
code = code.replace(/const \[statusFilter, setStatusFilter\] = useState<string>\('all'\);\n\s*const \[statusFilter, setStatusFilter\] = useState<string>\('all'\);/g, "const [statusFilter, setStatusFilter] = useState<string>('all');");


fs.writeFileSync('src/components/InvoicingManager.tsx', code);
