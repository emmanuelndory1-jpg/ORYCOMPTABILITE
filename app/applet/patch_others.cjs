const fs = require('fs');

let pathViewer = '/app/applet/src/components/InvoiceViewer.tsx';
let codeViewer = fs.readFileSync(pathViewer, 'utf8');
codeViewer = codeViewer.replace("import { QRCodeSVG } from 'qrcode.react';\n", "");
fs.writeFileSync(pathViewer, codeViewer);

let pathPdf = '/app/applet/src/lib/exportUtils.ts';
let codePdf = fs.readFileSync(pathPdf, 'utf8');
// remove the block for QR Code completely.
// Actually, it's safer to use simple string replacement:
const qrBlock = `    // Add Mobile Money QR Code for unpaid invoices (non-FNE)
    if (isFacture && invoice.status !== 'paid') {
      try {
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(\`PAYMENT|\${invoice.number}|\${invoice.total_amount}|\${settings.phone || ''}\`, { margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        doc.addImage(qrDataUrl, 'PNG', 14, currentTotalsY - 10, 22, 22);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "bold");
        doc.text("Scanner pour payer via Mobile Money", 14, currentTotalsY + 15);
      } catch (err) {
        console.error("Failed to generate QR code", err);
      }
    }`;

codePdf = codePdf.replace(qrBlock, "");
fs.writeFileSync(pathPdf, codePdf);
