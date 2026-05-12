
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
    border: [226, 232, 240] as [number, number, number], // Slate-200
  },
  fonts: {
    normal: "helvetica",
    bold: "helvetica",
  }
};

/**
 * Generates a standard PDF header with company information
 */
export function addPDFHeader(doc: jsPDF, settings: CompanySettings, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.width;
  const today = new Date().toLocaleDateString('fr-FR');

  // Background accent for header (Top bar)
  doc.setFillColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Company Logo & Info
  let y = 15;
  try {
    // Try to draw a placeholder if logo fails
    doc.setFillColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    doc.roundedRect(14, y, 10, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("OC", 17, y + 7);
  } catch (e) {
    console.warn("Logo placeholder error");
  }

  // Company Name
  doc.setFontSize(14);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(sanitizeText(settings.name || PDF_CONFIG.companyName).toUpperCase(), 30, y + 7);
  
  doc.setFontSize(8);
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  
  y = y + 15;
  const col1X = 14;
  const col2X = pageWidth / 2;
  const col3X = pageWidth - 14;

  // Left Column - Contact
  let leftY = y;
  if (settings.address) {
    doc.text(sanitizeText(settings.address), col1X, leftY);
    leftY += 4;
  }
  if (settings.city || settings.country) {
    doc.text(sanitizeText(`${settings.city || ''} ${settings.country || ''}`.trim()), col1X, leftY);
    leftY += 4;
  }
  if (settings.phone || settings.email) {
    doc.text(sanitizeText(`${settings.phone || ''} ${settings.email ? ' | ' + settings.email : ''}`.trim()), col1X, leftY);
  }

  // Right Column - Legal
  let rightY = y;
  if (settings.fiscal_id) {
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.text(`NIF: ${settings.fiscal_id}`, col3X, rightY, { align: 'right' });
    rightY += 4;
  }
  if (settings.rccm) {
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.text(`RCCM: ${settings.rccm}`, col3X, rightY, { align: 'right' });
    rightY += 4;
  }
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  if (settings.tax_regime) {
    doc.text(`Régime: ${settings.tax_regime}`, col3X, rightY, { align: 'right' });
  }

  // Divider
  doc.setDrawColor(PDF_CONFIG.colors.border[0], PDF_CONFIG.colors.border[1], PDF_CONFIG.colors.border[2]);
  doc.setLineWidth(0.5);
  doc.line(14, leftY + 10, pageWidth - 14, leftY + 10);

  // Document Title
  y = leftY + 25;
  doc.setFontSize(22);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(sanitizeText(title).toUpperCase(), pageWidth / 2, y, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont(PDF_CONFIG.fonts.normal, "normal");
    doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    doc.text(sanitizeText(subtitle), pageWidth / 2, y + 8, { align: 'center' });
    y += 8;
  }

  doc.setFontSize(8);
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  doc.text(`Date d'édition : ${today}`, col3X, y + 15, { align: 'right' });

  return y + 25; // Return next Y position
}

/**
 * Generates an Audit Report PDF
 */
export function generateAuditPDF(report: any, settings: CompanySettings) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  const startY = addPDFHeader(doc, settings, "Rapport d'Audit Financier", "Intelligence Synthétique SYSCOHADA");
  let y = startY;

  // Health Score Box
  doc.setFillColor(PDF_CONFIG.colors.light[0], PDF_CONFIG.colors.light[1], PDF_CONFIG.colors.light[2]);
  doc.roundedRect(14, y, pageWidth - 28, 30, 3, 3, 'F');
  
  doc.setFontSize(12);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("INDICE DE SANTÉ FINANCIÈRE", 25, y + 12);
  
  doc.setFontSize(24);
  const scoreColor = report.healthScore >= 80 ? [22, 163, 74] : report.healthScore >= 60 ? [217, 119, 6] : [225, 29, 72];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${report.healthScore}/100`, pageWidth - 25, y + 18, { align: 'right' });
  
  y += 40;

  // Summary
  doc.setFontSize(14);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("RÉSUMÉ EXÉCUTIF", 14, y);
  
  y += 8;
  doc.setFontSize(10);
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  const summaryLines = doc.splitTextToSize(sanitizeText(report.summary.replace(/\*/g, '')), pageWidth - 28);
  doc.text(summaryLines, 14, y);
  
  y += (summaryLines.length * 5) + 15;

  // Strengths & Weaknesses in a table or two columns
  autoTable(doc, {
    startY: y,
    head: [['FORCES ET OPPORTUNITÉS', 'POINTS DE VIGILANCE']],
    body: [
      [
        report.strengths.map((s: string) => `• ${sanitizeText(s)}`).join('\n\n'),
        report.weaknesses.map((w: string) => `• ${sanitizeText(w)}`).join('\n\n')
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_CONFIG.colors.secondary, halign: 'center' },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: {
      0: { textColor: [22, 163, 74], fontStyle: 'bold' },
      1: { textColor: [225, 29, 72], fontStyle: 'bold' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Ratios Table
  doc.setFontSize(12);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("ANALYSE DES RATIOS", 14, y);
  
  autoTable(doc, {
    startY: y + 5,
    head: [['Indicateur', 'Performance', 'Statut']],
    body: report.ratios.map((r: any) => [
      sanitizeText(r.name),
      `${r.value}%`,
      r.value >= 75 ? 'Optimal' : r.value >= 50 ? 'Satisfaisant' : 'À surveiller'
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_CONFIG.colors.primary },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 15;
  if (y > doc.internal.pageSize.height - 60) {
    doc.addPage();
    y = 20;
  }

  // Recommendations
  doc.setFontSize(12);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.text("RECOMMANDATIONS STRATÉGIQUES", 14, y);
  
  autoTable(doc, {
    startY: y + 5,
    head: [['Titre', 'Description', 'Impact']],
    body: report.recommendations.map((r: any) => [
      sanitizeText(r.title),
      sanitizeText(r.description),
      sanitizeText(r.impact)
    ]),
    theme: 'grid',
    headStyles: { fillColor: PDF_CONFIG.colors.secondary },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 25 }
    }
  });

  addPDFFooter(doc);
  doc.save(`Audit_Financier_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generates an Audit Trail PDF
 */
export function generateAuditTrailPDF(logs: any[], settings: CompanySettings) {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  
  const startY = addPDFHeader(doc, settings, "Journal des Activités (Audit Trail)", "Historique complet des opérations système");
  
  autoTable(doc, {
    startY: startY + 10,
    head: [['Date/Heure', 'Utilisateur', 'Action', 'Entité', 'ID', 'Détails']],
    body: logs.map(log => [
      log.date,
      sanitizeText(log.user),
      log.action,
      sanitizeText(log.entity),
      log.entity_id || '-',
      sanitizeText(log.details?.substring(0, 50) || '-')
    ]),
    theme: 'striped',
    headStyles: { fillColor: PDF_CONFIG.colors.secondary, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 15 },
      5: { cellWidth: 'auto' }
    }
  });

  addPDFFooter(doc);
  doc.save(`Journal_Audit_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generates a professional Payslip PDF
 */
export function generatePayslipPDF(payslip: any, period: any, settings: CompanySettings) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const monthName = new Date(2000, period.month - 1).toLocaleString('fr-FR', { month: 'long' });
  const year = period.year;

  const startY = addPDFHeader(doc, settings, "Bulletin de Paie", `Période de ${monthName} ${year}`);
  let y = startY;

  // Employee & Date Section
  doc.setFillColor(PDF_CONFIG.colors.light[0], PDF_CONFIG.colors.light[1], PDF_CONFIG.colors.light[2]);
  doc.roundedRect(14, y, pageWidth - 28, 25, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text("SALARIÉ :", 20, y + 10);
  doc.text("INFOS PÉRIODE :", pageWidth / 2 + 10, y + 10);
  
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  doc.text(`${sanitizeText(payslip.first_name)} ${sanitizeText(payslip.last_name)}`, 20, y + 16);
  doc.text(sanitizeText(payslip.position || "Employé"), 20, y + 21);
  
  doc.text(`Matricule : EMP-${payslip.employee_id}`, pageWidth / 2 + 10, y + 16);
  doc.text(`Édité le : ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2 + 10, y + 21);
  
  y += 35;

  // Details Table
  const details = typeof payslip.details === 'string' ? JSON.parse(payslip.details) : payslip.details;
  
  const body: any[] = [
    ['Salaire de base', '', '', formatCurrencyPDF(payslip.base_salary)],
  ];

  if (details.bonusDetails && details.bonusDetails.length > 0) {
    details.bonusDetails.forEach((b: any) => {
      body.push([sanitizeText(b.label), '', '', formatCurrencyPDF(b.amount)]);
    });
  }

  body.push([{ content: 'BRUT TOTAL', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }, '', '', { content: formatCurrencyPDF(details.grossTotal || details.gross), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } }]);
  
  body.push([{ content: 'RETENUES', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  
  body.push(['CNPS Part Salariale', '6.3%', '', `(${formatCurrencyPDF(details.cnpsEmployee || 0)})`]);
  body.push(['ITS (Impôt s/ Trait. & Sal.)', '', '', `(${formatCurrencyPDF(details.taxes?.is || 0)})`]);
  body.push(['CN (Contrib. Nationale)', '', '', `(${formatCurrencyPDF(details.taxes?.cn || 0)})`]);
  body.push(['IGR (Impôt Gén. sur Rev.)', '', '', `(${formatCurrencyPDF(details.taxes?.igr || 0)})`]);
  
  if (details.deductionDetails && details.deductionDetails.length > 0) {
    details.deductionDetails.forEach((d: any) => {
      body.push([sanitizeText(d.label), '', '', `(${formatCurrencyPDF(d.amount)})`]);
    });
  }

  const totalDeductions = (details.cnpsEmployee || 0) + (details.taxes?.is || 0) + (details.taxes?.cn || 0) + (details.taxes?.igr || 0) + (payslip.deductions || 0);

  autoTable(doc, {
    startY: y,
    head: [['RUBRIQUES', 'TAUX', 'RETAINU', 'GAIN']],
    body: body as any[],
    theme: 'grid',
    headStyles: { fillColor: PDF_CONFIG.colors.secondary, halign: 'center' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right', textColor: [225, 29, 72] },
      3: { halign: 'right', textColor: [22, 163, 74] }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Final Net
  doc.setFillColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.rect(pageWidth - 90, y, 76, 15, 'F');
  
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("NET À PAYER :", pageWidth - 85, y + 10);
  doc.text(formatCurrencyPDF(payslip.net_salary), pageWidth - 18, y + 10, { align: 'right' });

  y += 25;
  
  // Footer / Signature Section
  doc.setFontSize(8);
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  doc.text("Pour valoir ce que de droit.", 14, y);
  
  addPDFSignature(doc, y + 10, "L'Employeur");
  
  // Add another signature spot for employee
  doc.text("Signature du Salarié", 40, y + 10);
  doc.line(14, y + 30, 70, y + 30);

  addPDFFooter(doc);
  doc.save(`Bulletin_${payslip.last_name}_${monthName}_${year}.pdf`);
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

