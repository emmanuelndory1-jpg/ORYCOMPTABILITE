
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { sanitizeText, formatCurrencyPDF } from './pdfUtils';

export { sanitizeText, formatCurrencyPDF };

export interface CompanySettings {
  name: string;
  legal_form?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  fiscal_id?: string;
  rccm?: string;
  tax_regime?: string;
  vat_regime?: string;
  currency?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_iban?: string;
  bank_swift?: string;
  payment_bank_enabled?: boolean;
  payment_bank_account?: string;
  payment_cash_enabled?: boolean;
  payment_cash_account?: string;
  payment_mobile_enabled?: boolean;
  payment_mobile_account?: string;
  vat_settings?: { rate: number, account_collected: string, account_deductible: string }[];
}

/**
 * Utility for exporting data to CSV format.
 */
export function exportToCSV(data: any[], filename: string, headers: string[]) {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(';')); // Use semicolon for better Excel compatibility in French regions
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      // Try to find the key in the row object
      const key = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase().replace(/ /g, '_')) || header;
      const val = row[key] !== undefined ? row[key] : '';
      
      // Escape quotes and wrap in quotes if contains semicolon
      const escaped = ('' + val).replace(/"/g, '""');
      return escaped.includes(';') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(';'));
  }
  
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Utility for exporting data to Excel format using xlsx library.
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formats a number as currency for CSV/Excel compatibility (no symbols, just decimal)
 */
export function formatNumberForExport(num: number): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/,/g, '');
}

/**
 * Common PDF Header configuration
 */
export const PDF_CONFIG = {
  companyName: "ORYCOMPTABILITE",
  logoUrl: "/logo.png",
  colors: {
    primary: [22, 163, 74] as [number, number, number], // Emerald-600
    secondary: [15, 23, 42] as [number, number, number], // Slate-900
    text: [71, 85, 105] as [number, number, number], // Slate-600
    light: [241, 245, 249] as [number, number, number], // Slate-100
  }
};

/**
 * Generates a standard PDF header with company information
 */
export function addPDFHeader(doc: jsPDF, settings: CompanySettings, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.width;
  const today = new Date().toLocaleDateString('fr-FR');

  // Background accent for header
  doc.setFillColor(PDF_CONFIG.colors.light[0], PDF_CONFIG.colors.light[1], PDF_CONFIG.colors.light[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Logo
  try {
    doc.addImage(PDF_CONFIG.logoUrl, 'PNG', 14, 8, 30, 15);
  } catch (e) {
    console.warn("Logo could not be loaded for PDF");
  }

  // Company Info (Left)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(settings.name || PDF_CONFIG.companyName, 50, 15);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  
  let y = 20;
  const infoLines = [];
  if (settings.legal_form) infoLines.push(settings.legal_form);
  if (settings.address) infoLines.push(settings.address);
  if (settings.city || settings.country) infoLines.push(`${settings.city || ''} ${settings.country || ''}`.trim());
  if (settings.phone) infoLines.push(`Tél: ${settings.phone}`);
  if (settings.email) infoLines.push(`Email: ${settings.email}`);
  
  infoLines.forEach(line => {
    doc.text(sanitizeText(line), 50, y);
    y += 4;
  });

  // Tax Info (Right)
  y = 15;
  doc.setFont("helvetica", "bold");
  if (settings.fiscal_id) {
    doc.text(`NIF: ${settings.fiscal_id}`, pageWidth - 14, y, { align: 'right' });
    y += 4;
  }
  if (settings.rccm) {
    doc.text(`RCCM: ${settings.rccm}`, pageWidth - 14, y, { align: 'right' });
    y += 4;
  }
  if (settings.tax_regime) {
    doc.setFont("helvetica", "normal");
    doc.text(`Régime: ${settings.tax_regime}`, pageWidth - 14, y, { align: 'right' });
  }

  // Document Title Section
  doc.setDrawColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
  doc.setLineWidth(1);
  doc.line(14, 45, pageWidth - 14, 45);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(title.toUpperCase(), pageWidth / 2, 55, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    doc.text(subtitle, pageWidth / 2, 62, { align: 'center' });
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  doc.text(`Édité le : ${today}`, pageWidth - 14, 70, { align: 'right' });

  return 80; // Return next Y position
}

/**
 * Generates a full Invoice/Quote PDF
 */
export function generateInvoicePDF(invoice: any, companySettings: CompanySettings | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const settings = companySettings || { name: PDF_CONFIG.companyName };
  const title = invoice.type === 'invoice' ? 'FACTURE' : 'DEVIS';
  const subtitle = `${title} N° ${invoice.number}`;

  const startY = addPDFHeader(doc, settings, title, subtitle);
  let currentY = startY + 10;

  // Client Info (Right)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("DESTINATAIRE :", 120, currentY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  doc.text(sanitizeText(invoice.third_party_name), 120, currentY + 5);
  
  let clientY = currentY + 10;
  if (invoice.third_party_address) {
    const addrLines = doc.splitTextToSize(sanitizeText(invoice.third_party_address), 80);
    doc.text(addrLines, 120, clientY);
    clientY += addrLines.length * 5;
  }
  if (invoice.third_party_tax_id) {
    doc.text(`NIF: ${invoice.third_party_tax_id}`, 120, clientY);
  }

  // Document Info (Left)
  doc.setFont("helvetica", "bold");
  doc.text("RÉFÉRENCES :", 14, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(`Date : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, 14, currentY + 7);
  if (invoice.due_date) {
    doc.text(`Échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, 14, currentY + 13);
  }
  if (invoice.status) {
    const statusText = invoice.status === 'paid' ? 'PAYÉE' : 
                      invoice.status === 'sent' ? 'ENVOYÉE' : 
                      invoice.status === 'draft' ? 'BROUILLON' : 
                      invoice.status.toUpperCase();
    doc.text(`Statut : ${statusText}`, 14, currentY + 19);
  }

  // Items Table
  autoTable(doc, {
    startY: Math.max(clientY, currentY + 25),
    head: [['Description', 'Qté', 'Prix Unit.', 'TVA', 'Total']],
    body: invoice.items.map((item: any) => [
      sanitizeText(item.description),
      item.quantity,
      formatCurrencyPDF(item.unit_price),
      `${item.vat_rate}%`,
      formatCurrencyPDF(item.total || (item.quantity * item.unit_price))
    ]),
    theme: 'striped',
    headStyles: { 
      fillColor: PDF_CONFIG.colors.secondary as [number, number, number],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 }
    }
  });

  // Totals
  const finalY = ((doc as any).lastAutoTable?.finalY || 140) + 15;
  const totalsX = 130;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total HT :", totalsX, finalY);
  doc.text(formatCurrencyPDF(invoice.subtotal), pageWidth - 14, finalY, { align: 'right' });
  
  doc.text("TVA :", totalsX, finalY + 7);
  doc.text(formatCurrencyPDF(invoice.vat_amount), pageWidth - 14, finalY + 7, { align: 'right' });
  
  // Total Box
  doc.setFillColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
  doc.rect(totalsX - 5, finalY + 12, pageWidth - totalsX - 9, 12, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TTC :", totalsX, finalY + 20);
  doc.text(formatCurrencyPDF(invoice.total_amount), pageWidth - 14, finalY + 20, { align: 'right' });

  // Notes & Terms
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  if (invoice.notes || invoice.terms) {
    let notesY = finalY + 40;
    if (notesY > doc.internal.pageSize.height - 60) {
      doc.addPage();
      notesY = 20;
    }
    
    if (invoice.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Notes :", 14, notesY);
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(sanitizeText(invoice.notes), pageWidth - 28);
      doc.text(noteLines, 14, notesY + 5);
      notesY += (noteLines.length * 5) + 10;
    }
    
    if (invoice.terms) {
      doc.setFont("helvetica", "bold");
      doc.text("Conditions :", 14, notesY);
      doc.setFont("helvetica", "normal");
      const termLines = doc.splitTextToSize(sanitizeText(invoice.terms), pageWidth - 28);
      doc.text(termLines, 14, notesY + 5);
      notesY += (termLines.length * 5) + 10;
    }
  }

  // Signature
  addPDFSignature(doc, doc.internal.pageSize.height - 60);

  // Bank Details
  if (settings.bank_name || settings.bank_account_number) {
    addBankDetails(doc, settings, doc.internal.pageSize.height - 45);
  }

  // Paid Stamp
  if (invoice.status === 'paid') {
    addPaidStamp(doc);
  }

  // Footer
  addPDFFooter(doc);

  doc.save(`${title}_${invoice.number}.pdf`);
}

/**
 * Adds bank details to PDF
 */
export function addBankDetails(doc: jsPDF, settings: CompanySettings, y: number) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("COORDONNÉES BANCAIRES :", 14, y);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  
  let details = [];
  if (settings.bank_name) details.push(`Banque: ${settings.bank_name}`);
  if (settings.bank_account_number) details.push(`Compte: ${settings.bank_account_number}`);
  if (settings.bank_iban) details.push(`IBAN: ${settings.bank_iban}`);
  if (settings.bank_swift) details.push(`SWIFT: ${settings.bank_swift}`);
  
  doc.text(details.join(' | '), 14, y + 5);
}

/**
 * Adds a "PAID" stamp to the PDF
 */
export function addPaidStamp(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.2 }));
  doc.setFontSize(60);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 197, 94); // Emerald 500
  
  // Rotate and place in center
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  doc.text("PAYÉ", pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45
  });
  
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(2);
  doc.rect(pageWidth / 2 - 50, pageHeight / 2 - 40, 100, 50, 'S');
  
  doc.restoreGraphicsState();
}

/**
 * Adds a standard footer to PDF
 */
export function addPDFFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Document généré par ORYCOMPTABILITE - Solutions de Gestion Comptable`,
      14,
      pageHeight - 10
    );
    
    doc.text(
      `Page ${i} sur ${pageCount}`,
      pageWidth - 14,
      pageHeight - 10,
      { align: 'right' }
    );
  }
}

/**
 * Adds a signature section at the end of the document
 */
export function addPDFSignature(doc: jsPDF, y: number, label: string = "Le Responsable") {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Check if we have enough space, otherwise add a new page
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  
  doc.text(label, pageWidth - 60, y);
  
  // Signature line
  doc.setDrawColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 70, y + 20, pageWidth - 14, y + 20);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Cachet et Signature", pageWidth - 55, y + 25);
  
  return y + 35;
}

