const fs = require('fs');
let code = fs.readFileSync('src/lib/exportUtils.ts', 'utf8');

const replacement = `
    const taxesEnabled = companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0;

    let headRow = [];
    if (template === 'minimal') {
      headRow = taxesEnabled 
        ? [['Description', 'Qté', 'Prix Unit.', 'Remise', 'TVA', 'Total']]
        : [['Description', 'Qté', 'Prix Unit.', 'Remise', 'Total']];
    } else {
      headRow = taxesEnabled 
        ? [['Description', 'Qté', 'Prix Unit.', 'Remise', 'TVA', 'Total']]
        : [['Description', 'Qté', 'Prix Unit.', 'Remise', 'Total']];
    }
    
    autoTable(doc, {
      startY: currentY,
      head: headRow,
      body: invoice.items.map((item: any) => {
        let row = [
          sanitizeText(item.description),
          item.quantity,
          formatCurrencyPDF(item.unit_price),
          item.discount > 0 ? \`\${item.discount}%\` : '-'
        ];
        if (taxesEnabled) row.push(\`\${item.vat_rate}%\`);
        row.push(formatCurrencyPDF(item.total || (item.quantity * item.unit_price)));
        return row;
      }),
`;

code = code.replace(
  /autoTable\(doc, \{\s*startY: currentY,\s*head: \[\[.*\]\],\s*body: invoice\.items\.map\(\(item: any\) => \([\s\S]*?\]\),/g,
  replacement
);

const totalsMinimalReplacement = `
    doc.text("- " + formatCurrencyPDF(totalDiscount), pageWidth - 14, finalY + 6, { align: 'right' });

    if (taxesEnabled) {
      doc.text("Net HT :", totalsX, finalY + 12);
      doc.text(formatCurrencyPDF(invoice.subtotal), pageWidth - 14, finalY + 12, { align: 'right' });

      doc.text("TVA :", totalsX, finalY + 18);
      doc.text(formatCurrencyPDF(invoice.vat_amount), pageWidth - 14, finalY + 18, { align: 'right' });
    }
`;

code = code.replace(
  /doc\.text\("- " \+ formatCurrencyPDF\(totalDiscount\), pageWidth - 14, finalY \+ 6, \{ align: 'right' \}\);\s*doc\.text\("Net HT :", totalsX, finalY \+ 12\);\s*doc\.text\(formatCurrencyPDF\(invoice\.subtotal\), pageWidth - 14, finalY \+ 12, \{ align: 'right' \}\);\s*doc\.text\("TVA :", totalsX, finalY \+ 18\);\s*doc\.text\(formatCurrencyPDF\(invoice\.vat_amount\), pageWidth - 14, finalY \+ 18, \{ align: 'right' \}\);/g,
  totalsMinimalReplacement
);

// Advanced template
const advancedHead = `
    const advHead = taxesEnabled 
      ? [['CODE', 'DÉSIGNATION', 'P.U (HT)', 'QTE', 'REM.', 'TVA', 'U.M', 'TOTAL']]
      : [['CODE', 'DÉSIGNATION', 'P.U (HT/TTC)', 'QTE', 'REM.', 'U.M', 'TOTAL']];
    
    autoTable(doc, {
      startY: yPos,
      body: invoice.items.map((item: any, i: number) => {
        let r = [
          \`Art-\${(i+1).toString().padStart(2, '0')}\`,
          sanitizeText(item.description),
          formatCurrencyPDF(item.unit_price),
          item.quantity,
          item.discount > 0 ? \`\${item.discount}%\` : '-'
        ];
        if (taxesEnabled) r.push(item.vat_rate > 0 ? \`TVA (\${item.vat_rate})\` : '-');
        r.push('1');
        r.push(formatCurrencyPDF(item.total || (item.quantity * item.unit_price)));
        return r;
      }),
      theme: 'grid',
      head: advHead,
`;

code = code.replace(
  /autoTable\(doc, \{\s*startY: yPos,[\s\S]*?head: \[\['CODE', 'DÉSIGNATION', 'P.U \(HT\)', 'QTE', 'REM.', 'TVA', 'U.M', 'TOTAL'\]\],/g,
  advancedHead
);

const advancedTotals = `
    let totalsBody = [
      ['TOTAL' + (taxesEnabled ? ' HT' : ''), formatCurrencyPDF(invoice.subtotal + totalDiscount)],
      ['REMISE', '- ' + formatCurrencyPDF(totalDiscount)],
      ['NET' + (taxesEnabled ? ' HT' : ''), formatCurrencyPDF(invoice.subtotal)],
    ];
    if (taxesEnabled) {
      totalsBody.push(['TVA', formatCurrencyPDF(invoice.vat_amount)]);
    }
    totalsBody.push(['TOTAL TTC', formatCurrencyPDF(invoice.total_amount)]);
    totalsBody.push(['TOTAL A PAYER', formatCurrencyPDF(invoice.total_amount)]);
    if (invoice.paid_amount > 0) {
      totalsBody.push(['ACOMPTE COMPTANT', '- ' + formatCurrencyPDF(invoice.paid_amount)]);
      totalsBody.push(['NET A REGLER', formatCurrencyPDF(invoice.total_amount - invoice.paid_amount)]);
    }
    
    autoTable(doc, {
      startY: finalY,
      body: totalsBody,
`;

code = code.replace(
  /autoTable\(doc, \{\s*startY: finalY,\s*body: \[[\s\S]*?\],/g,
  advancedTotals
);

const resumeTVA = `
  if (taxesEnabled) {
    if (resumeY > pageHeight - 40) {
      doc.addPage();
      resumeY = 20;
    }

    // "RÉSUMÉ TAXES & REGIMES TVA"
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("RESUME DES TAXES & REGIME TVA", 14, resumeY);
    
    autoTable(doc, {
      startY: resumeY + 2,
      head: [['CATÉGORIE DE TVA', 'BASE IMPOSABLE (HT)', 'TAUX', 'MONTANT TAXE']],
      body: invoice.vat_amount > 0 ? [
        ['TVA Normale (Taux Standard standardisé)', formatCurrencyPDF(invoice.subtotal), '18%', formatCurrencyPDF(invoice.vat_amount)]
      ] : [
        ['Exonéré (Taux Zéro / Exportations)', formatCurrencyPDF(invoice.subtotal), '0%', formatCurrencyPDF(0)]
      ],
      theme: 'plain',
      headStyles: { 
        fillColor: [240, 240, 240], 
        textColor: [50, 50, 50],
        fontSize: 7,
        fontStyle: 'bold'
      },
      styles: { fontSize: 7, cellPadding: 2 }
    });
  }
`;

code = code.replace(
  /if \(resumeY > pageHeight - 40\) \{\s*doc\.addPage\(\);\s*resumeY = 20;\s*\}\s*\/\/ "RÉSUMÉ TAXES & REGIMES TVA"[\s\S]*?styles: \{ fontSize: 7, cellPadding: 2 \}\s*\}\);/g,
  resumeTVA
);

fs.writeFileSync('src/lib/exportUtils.ts', code, 'utf8');
console.log('Fixed exportUtils for PDF format');
