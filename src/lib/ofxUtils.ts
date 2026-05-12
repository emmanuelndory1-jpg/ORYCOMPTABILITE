
export function generateOFX(
  bankName: string,
  accountNumber: string,
  transactions: any[],
  currency: string = 'EUR'
): string {
  const now = new Date().toISOString().replace(/[:\-T]/g, '').split('.')[0];
  
  const header = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${now}
<LANGUAGE>FRA
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${now}
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>${currency}
<BANKACCTFROM>
<BANKID>${bankName}
<ACCTID>${accountNumber}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${now}
<DTEND>${now}
`;

  const footer = `</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>0.00
<DTASOF>${now}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

  const transactionList = transactions.map(tx => {
    const txDate = new Date(tx.date).toISOString().replace(/[:\-T]/g, '').split('.')[0];
    const amount = Number(tx.amount).toFixed(2);
    // Determine type: DEBIT or CREDIT
    const type = Number(tx.amount) < 0 ? 'DEBIT' : 'CREDIT';
    
    return `
<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${txDate}
<TRNAMT>${amount}
<FITID>${tx.id || Math.random().toString(36).substr(2, 9)}
<NAME>${tx.description?.substring(0, 32).replace(/[&<>]/g, '') || 'Transaction'}
<MEMO>${tx.description?.substring(0, 255).replace(/[&<>]/g, '') || ''}
</STMTTRN>`;
  }).join('');

  return header + transactionList + footer;
}

export function downloadOFX(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/x-ofx' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
