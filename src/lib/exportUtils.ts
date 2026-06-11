import { parseSafeJSON } from "../lib/utils";

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
  taxes_enabled?: boolean;
  manager_name?: string;
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
  logo_url?: string | null;
  vat_settings?: { rate: number, account_collected: string, account_deductible: string }[];
}

/**
 * Utility for exporting data to CSV format.
 */
export function exportToCSV(data: any[], filename: string, headers: string[]) {
  const csvRows = ['\uFEFF']; // Add BOM for Excel UTF-8 support
  
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
    primary: [15, 118, 110] as [number, number, number], // Teal-600 (Modern luxury)
    secondary: [30, 41, 59] as [number, number, number], // Slate-800
    text: [71, 85, 105] as [number, number, number], // Slate-600
    highlight: [248, 250, 252] as [number, number, number], // Slate-50
    light: [241, 245, 249] as [number, number, number], // Slate-100
    border: [226, 232, 240] as [number, number, number], // Slate-200
  },
  fonts: {
    normal: "helvetica",
    bold: "helvetica",
  }
};

/**
 * Draws the logo into a JS PDF document while preserving aspect ratio and fitting within maximum constraints
 */
export function drawPDFLogo(doc: jsPDF, logoUrl: string, x: number, y: number, maxWidth: number, maxHeight: number) {
  let format = 'PNG';
  if (logoUrl.includes('image/png')) format = 'PNG';
  else if (logoUrl.includes('image/jpeg') || logoUrl.includes('image/jpg')) format = 'JPEG';
  else if (logoUrl.includes('image/webp')) format = 'WEBP';
  
  try {
    const props = doc.getImageProperties(logoUrl);
    const ratio = props.width / props.height;
    
    let w = maxWidth;
    let h = maxWidth / ratio;
    
    if (h > maxHeight) {
      h = maxHeight;
      w = maxHeight * ratio;
    }
    
    // align vertically in the bounding box
    const drawY = y + (maxHeight - h) / 2;
    doc.addImage(logoUrl, format, x, drawY, w, h);
  } catch (e) {
    console.warn("Failed to get image properties, falling back to stretched draw", e);
    doc.addImage(logoUrl, format, x, y, maxWidth, maxHeight);
  }
}

/**
 * Generates a standard PDF header with company information
 */
export function addPDFHeader(doc: jsPDF, settings: CompanySettings, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.width;
  const today = new Date().toLocaleDateString('fr-FR');

  // Background accent for header (Top bar)
  doc.setFillColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Subtle separator line under the top bar
  doc.setDrawColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.setLineWidth(0.5);
  doc.line(0, 8, pageWidth, 8);

  // Company Logo & Info
  let y = 20;
  try {
    if (settings.logo_url) {
      drawPDFLogo(doc, settings.logo_url, 14, y, 16, 12);
    } else {
      // Elegant logo placeholder
      doc.setFillColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
      doc.roundedRect(14, y, 12, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(PDF_CONFIG.fonts.bold, "bold");
      doc.text("OC", 16.5, y + 8);
    }
  } catch (e) {
    console.warn("Logo rendering error in PDF:", e);
    // Fallback placeholder
    try {
      doc.setFillColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
      doc.roundedRect(14, y, 12, 12, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(PDF_CONFIG.fonts.bold, "bold");
      doc.text("OC", 16.5, y + 8);
    } catch (e2) {}
  }

  // Company Name
  doc.setFontSize(16);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(sanitizeText(settings.name || PDF_CONFIG.companyName).toUpperCase(), 32, y + 8);
  
  doc.setFontSize(9);
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  
  y = y + 18;
  const col1X = 14;
  const col3X = pageWidth - 14;

  // Left Column - Contact
  let leftY = y;
  if (settings.address) {
    doc.text(sanitizeText(settings.address), col1X, leftY);
    leftY += 5;
  }
  if (settings.city || settings.country) {
    doc.text(sanitizeText(`${settings.city || ''} ${settings.country || ''}`.trim()), col1X, leftY);
    leftY += 5;
  }
  if (settings.phone || settings.email) {
    doc.text(sanitizeText(`${settings.phone || ''} ${settings.email ? ' | ' + settings.email : ''}`.trim()), col1X, leftY);
  }

  // Right Column - Legal
  let rightY = y;
  doc.setFontSize(8);
  if (settings.fiscal_id) {
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.text(`NIF: ${settings.fiscal_id}`, col3X, rightY, { align: 'right' });
    rightY += 5;
  }
  if (settings.rccm) {
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.text(`RCCM: ${settings.rccm}`, col3X, rightY, { align: 'right' });
    rightY += 5;
  }
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  if (settings.tax_regime) {
    doc.text(`Régime: ${settings.tax_regime}`, col3X, rightY, { align: 'right' });
  }

  // Divider
  doc.setDrawColor(PDF_CONFIG.colors.border[0], PDF_CONFIG.colors.border[1], PDF_CONFIG.colors.border[2]);
  doc.setLineWidth(0.5);
  doc.line(14, leftY + 12, pageWidth - 14, leftY + 12);

  // Document Title
  y = leftY + 30;
  doc.setFontSize(24);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  doc.text(sanitizeText(title).toUpperCase(), pageWidth / 2, y, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont(PDF_CONFIG.fonts.normal, "normal");
    doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    doc.text(sanitizeText(subtitle), pageWidth / 2, y + 8, { align: 'center' });
    y += 10;
  }

  doc.setFontSize(9);
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
  
  // Fancy Date box
  doc.setFillColor(PDF_CONFIG.colors.highlight[0], PDF_CONFIG.colors.highlight[1], PDF_CONFIG.colors.highlight[2]);
  doc.roundedRect(pageWidth - 50, y + 10, 36, 8, 1, 1, 'F');
  doc.text(`Date : ${today}`, col3X - 2, y + 15.5, { align: 'right' });

  return y + 28; // Return next Y position
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
  const details = typeof payslip.details === 'string' ? parseSafeJSON(payslip.details) : payslip.details;
  
  const body: any[] = [];
  
  if (details.prorataFactor && details.prorataFactor < 1) {
    const originalBase = Math.round(payslip.base_salary / details.prorataFactor);
    body.push(['Salaire de base', '', '', formatCurrencyPDF(originalBase)]);
    body.push([`Prorata temporis (${details.activeDays} jrs)`, `${(details.prorataFactor * 100).toFixed(2)}%`, '', formatCurrencyPDF(payslip.base_salary)]);
  } else {
    body.push(['Salaire de base', '', '', formatCurrencyPDF(payslip.base_salary)]);
  }

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
export async function generateInvoicePDF(invoice: any, companySettings: CompanySettings | null) {
  const doc = await buildInvoicePDF(invoice, companySettings);
  const isInvoice = invoice.type === 'invoice';
  const prefix = isInvoice ? 'FACTURE' : invoice.type === 'quote' ? 'DEVIS' : 'PROFORMA';
  doc.save(`${prefix}_${invoice.number || 'BROUILLON'}.pdf`);
}

/**
 * Builds the jsPDF instance for an Invoice/Quote
 */
export async function buildInvoicePDF(invoice: any, companySettings: CompanySettings | null): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const settings = companySettings || { name: PDF_CONFIG.companyName };
  const isFacture = invoice.type === 'invoice';
  const title = isFacture ? 'FACTURE' : 'DEVIS';
  
  const totalDiscount = invoice.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unit_price * ((item.discount || 0)/100)), 0);
  
  const template = invoice.template || 'prestige';
    // Custom beautiful styling for quotes or non-FNE invoices (classic, minimal, prestige)
    let primaryColor = PDF_CONFIG.colors.primary;
    let secondaryColor = PDF_CONFIG.colors.secondary;
    let accentColor = PDF_CONFIG.colors.highlight;
    let textColor = PDF_CONFIG.colors.text;

    if (template === 'minimal') {
      primaryColor = [75, 85, 99];
      secondaryColor = [31, 41, 55];
      accentColor = [243, 244, 246];
      textColor = [55, 65, 81];
    } else if (template === 'prestige') {
      primaryColor = [180, 142, 60]; // Golden luxe
      secondaryColor = [17, 24, 39]; // Charcoal
      accentColor = [253, 244, 215]; // Warm gold cream
      textColor = [31, 41, 55];
    } else if (template === 'classic') {
      primaryColor = [2, 132, 199]; // Deep Sky Blue
      secondaryColor = [15, 23, 42]; // Slate corporate
      accentColor = [240, 249, 255]; 
      textColor = [51, 65, 85];
    }

    // Page-wide border for Prestige template
    if (template === 'prestige') {
      doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.4); doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S'); doc.setLineWidth(1.0); doc.rect(7, 7, pageWidth - 14, pageHeight - 14, 'S');
    }

    // 1. HEADER SECTION
    let headerY = 15;
    
    if (template === 'prestige') {
      // Draw dark luxury panel at the top
      doc.setFillColor(20, 24, 30); doc.rect(7, 7, pageWidth - 14, 46, 'F');
      
      // Golden separation line below panel
      doc.setDrawColor(197, 160, 89);
      doc.setLineWidth(1.5);
      doc.line(7, 53, pageWidth - 7, 53);
      
      let companyStartX = 14;
      if (settings.logo_url) {
        try {
          drawPDFLogo(doc, settings.logo_url, 14, 14, 20, 16);
          companyStartX = 38;
        } catch (e) {
          console.warn("Prestige template logo rendering failed:", e);
        }
      }

      // Top luxury Brand Text
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(197, 160, 89);
      doc.text(sanitizeText(settings.name || PDF_CONFIG.companyName).toUpperCase(), companyStartX, 26);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(243, 244, 246);
      doc.text(sanitizeText(settings.address || ''), companyStartX, 33);
      doc.text(sanitizeText(`${settings.phone || ''} | ${settings.email || ''}`.trim()), companyStartX, 38);
      
      // Document Metadata (Prestige styled inside header)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(197, 160, 89);
      doc.text(`${title} N° ${invoice.number}`, pageWidth - 14, 24, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(209, 213, 219);
      doc.text(`Date de Facturation : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, pageWidth - 14, 31, { align: 'right' });
      if (invoice.due_date) {
        doc.text(`Date d'Échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, pageWidth - 14, 36, { align: 'right' });
      }
      doc.text(`NIF Emetteur : ${settings.fiscal_id || '-'}`, pageWidth - 14, 41, { align: 'right' });
      
      headerY = 58;
    } else if (template === 'minimal') {
      let companyStartX = 14;
      if (settings.logo_url) {
        try {
          drawPDFLogo(doc, settings.logo_url, 14, 14, 18, 14);
          companyStartX = 36;
        } catch (e) {
          console.warn("Minimal template logo rendering failed:", e);
        }
      }

      // Light modern brand header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(sanitizeText(settings.name || PDF_CONFIG.companyName).toUpperCase(), companyStartX, 22);
      
      // Subtle gray label
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(sanitizeText(settings.address || ''), companyStartX, 28);
      doc.text(sanitizeText(`${settings.phone || ''} | ${settings.email || ''}`.trim()), companyStartX, 33);
      
      // Light gray separator
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(14, 38, pageWidth - 14, 38);
      
      // Document metadata
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(`${title} N° ${invoice.number}`, pageWidth - 14, 22, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`Émis le : ${new Date(invoice.date).toLocaleDateString('fr-FR')}`, pageWidth - 14, 28, { align: 'right' });
      if (invoice.due_date) {
        doc.text(`Échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}`, pageWidth - 14, 33, { align: 'right' });
      }
      
      headerY = 46;
    } else {
      // Classic layout: Call standard addPDFHeader
      const subtitle = `${title} N° ${invoice.number}`;
      const startY = addPDFHeader(doc, settings, title, subtitle);
      headerY = startY + 10;
    }

    let currentY = headerY;
    
    // 2. CLIENT INFO BLOCK
    if (template === 'prestige') {
      // Draw luxury colored container for client
      doc.setFillColor(253, 244, 215);
      doc.roundedRect(14, currentY, pageWidth - 28, 25, 2, 2, 'F');
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 142, 60);
      doc.text("DESTINATAIRE (CLIENT DE CONFIANCE) :", 18, currentY + 6);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(sanitizeText(invoice.third_party_name).toUpperCase(), 18, currentY + 13);
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81);
      doc.text(sanitizeText(invoice.third_party_address || '-'), 18, currentY + 19);
      if (invoice.third_party_tax_id) {
        doc.text(`NIF Client : ${invoice.third_party_tax_id}`, pageWidth - 18, currentY + 13, { align: 'right' });
      }
      
      currentY += 35;
    } else if (template === 'minimal') {
      // Modern side-by-side without border boxes
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(156, 163, 175);
      doc.text("FACTURÉ À :", 14, currentY);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(sanitizeText(invoice.third_party_name), 14, currentY + 6);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      
      let clientY = currentY + 11;
      if (invoice.third_party_address) {
        const addrLines = doc.splitTextToSize(sanitizeText(invoice.third_party_address), 90);
        doc.text(addrLines, 14, clientY);
        clientY += addrLines.length * 5;
      }
      if (invoice.third_party_tax_id) {
        doc.text(`Identifiant Fiscal (NIF) : ${invoice.third_party_tax_id}`, 14, clientY);
      }
      
      // Reference column on the right
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(156, 163, 175);
      doc.text("RÉSUMÉ COMMERCIAL :", 120, currentY);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      doc.text(`Mode : Virement ou Espèces`, 120, currentY + 6);
      doc.text(`Statut : ${invoice.status?.toUpperCase() || 'BROUILLON'}`, 120, currentY + 11);
      if (invoice.currency) {
        doc.text(`Devise commerciale : ${invoice.currency}`, 120, currentY + 16);
      }
      
      currentY += 30;
    } else {
      // Classic layout customer display
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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
      
      // References on the left
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
      
      currentY = Math.max(clientY + 10, currentY + 25);
    }

    // 3. TABLE OF ITEMS (THEMED)
    let autoTableTheme: 'striped' | 'plain' | 'grid' = 'striped';
    if (template === 'minimal') autoTableTheme = 'plain';
    
    autoTable(doc, {
      startY: currentY,
      head: [['Description', 'Qté', 'Prix Unit.', 'Remise', 'TVA', 'Total']],
      body: invoice.items.map((item: any) => [
        sanitizeText(item.description),
        item.quantity,
        formatCurrencyPDF(item.unit_price),
        item.discount > 0 ? `${item.discount}%` : '-',
        `${item.vat_rate}%`,
        formatCurrencyPDF(item.total || (item.quantity * item.unit_price))
      ]),
      theme: autoTableTheme,
      headStyles: { 
        fillColor: secondaryColor as [number, number, number],
        fontSize: 9,
        fontStyle: 'bold',
        textColor: template === 'prestige' ? [197, 160, 89] : [255, 255, 255],
        halign: 'center'
      },
      styles: { 
        fontSize: 8.5,
        cellPadding: template === 'minimal' ? 3 : 4,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 35 }
      }
    });

    // 4. TOTALS (THEMED)
    const finalY = ((doc as any).lastAutoTable?.finalY || 140) + 12;
    const totalsX = 130;
    
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);
    doc.text("Total HT :", totalsX, finalY);
    doc.text(formatCurrencyPDF(invoice.subtotal + totalDiscount), pageWidth - 14, finalY, { align: 'right' });
    
    doc.text("Remise :", totalsX, finalY + 6);
    doc.text('- ' + formatCurrencyPDF(totalDiscount), pageWidth - 14, finalY + 6, { align: 'right' });

    doc.text("Net HT :", totalsX, finalY + 12);
    doc.text(formatCurrencyPDF(invoice.subtotal), pageWidth - 14, finalY + 12, { align: 'right' });

    doc.text("TVA :", totalsX, finalY + 18);
    doc.text(formatCurrencyPDF(invoice.vat_amount), pageWidth - 14, finalY + 18, { align: 'right' });
    
    // Total Box
    let currentTotalsY = finalY + 22;
    if (template === 'minimal') {
      // Elegant line separator instead of a solid box
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(totalsX - 5, currentTotalsY, pageWidth - 14, currentTotalsY);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text("TOTAL TTC :", totalsX, currentTotalsY + 6);
      doc.text(formatCurrencyPDF(invoice.total_amount), pageWidth - 14, currentTotalsY + 6, { align: 'right' });
      currentTotalsY += 6;
    } else {
      // Classic & Prestige Solid Filled Box
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(totalsX - 5, currentTotalsY, pageWidth - totalsX - 9, 10, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("TOTAL TTC :", totalsX, currentTotalsY + 6);
      doc.text(formatCurrencyPDF(invoice.total_amount), pageWidth - 14, currentTotalsY + 6, { align: 'right' });
      currentTotalsY += 10;
    }

    if (invoice.paid_amount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(75, 85, 99);
      currentTotalsY += 6;
      doc.text("Acompte payé :", totalsX, currentTotalsY);
      doc.text('- ' + formatCurrencyPDF(invoice.paid_amount), pageWidth - 14, currentTotalsY, { align: 'right' });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(17, 24, 39);
      currentTotalsY += 8;
      doc.text("Reste à payer :", totalsX, currentTotalsY);
      doc.text(formatCurrencyPDF(invoice.total_amount - invoice.paid_amount), pageWidth - 14, currentTotalsY, { align: 'right' });
    }
  
    // Add Mobile Money QR Code for unpaid invoices (non-FNE)
    if (isFacture && invoice.status !== 'paid') {
      try {
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(`PAYMENT|${invoice.number}|${invoice.total_amount}|${settings.phone || ''}`, { margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        doc.addImage(qrDataUrl, 'PNG', 14, currentTotalsY - 10, 22, 22);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "bold");
        doc.text("Scanner pour payer via Mobile Money", 14, currentTotalsY + 15);
      } catch (e) {
        console.error("Failed to generate Mobile Money QR Code for PDF", e);
      }
    }

    // Notes & Terms
    doc.setTextColor(75, 85, 99);
    if (invoice.notes || invoice.terms) {
      let notesY = currentTotalsY + 15;
      if (notesY > pageHeight - 55) {
        doc.addPage();
        notesY = 20;
      }
      
      if (invoice.notes) {
        doc.setFont("helvetica", "bold");
        doc.text("Notes :", 14, notesY);
        doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(sanitizeText(invoice.notes), pageWidth - 28);
        doc.text(noteLines, 14, notesY + 5);
        notesY += (noteLines.length * 4.5) + 8;
      }
      
      if (invoice.terms) {
        doc.setFont("helvetica", "bold");
        doc.text("Conditions :", 14, notesY);
        doc.setFont("helvetica", "normal");
        const termLines = doc.splitTextToSize(sanitizeText(invoice.terms), pageWidth - 28);
        doc.text(termLines, 14, notesY + 5);
        notesY += (termLines.length * 4.5) + 8;
      }
    }
  
    // Stamp or Signature space
    addPDFSignature(doc, doc.internal.pageSize.height - 50);
  
    // Bank Details
    if (settings.bank_name || settings.bank_account_number) {
      addBankDetails(doc, settings, doc.internal.pageSize.height - 35);
    }
  
    // Footer & Stamp
    addPDFFooter(doc);
    if (invoice.status === 'paid') {
      addPaidStamp(doc);
    }
    
    return doc;
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
    doc.setDrawColor(PDF_CONFIG.colors.border[0], PDF_CONFIG.colors.border[1], PDF_CONFIG.colors.border[2]);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

    doc.setFontSize(8);
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
    doc.text(
      `ORYCOMPTABILITE`,
      14,
      pageHeight - 12
    );

    doc.setFont(PDF_CONFIG.fonts.normal, "normal");
    doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
    doc.text(
      ` - Document généré et authentifié électroniquement`,
      45,
      pageHeight - 12
    );
    
    // Page count pill
    doc.setFillColor(PDF_CONFIG.colors.highlight[0], PDF_CONFIG.colors.highlight[1], PDF_CONFIG.colors.highlight[2]);
    doc.roundedRect(pageWidth - 30, pageHeight - 15, 16, 6, 3, 3, 'F');
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    doc.text(
      `${i} / ${pageCount}`,
      pageWidth - 22,
      pageHeight - 11,
      { align: 'center' }
    );
  }
}

// This function generates a customizable dashboard PDF
export function generateCustomDashboardPDF(data: any, customConfig: any, settings: CompanySettings) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Custom Header
  if (customConfig.headerText) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(PDF_CONFIG.colors.text[0], PDF_CONFIG.colors.text[1], PDF_CONFIG.colors.text[2]);
    doc.text(sanitizeText(customConfig.headerText), pageWidth / 2, 10, { align: 'center' });
  }

  const title = customConfig.title || "Rapport Tableau de Bord";
  const startY = addPDFHeader(doc, settings, title, "Synthèse Financière");
  let y = startY;

  // Key stats Block
  doc.setFillColor(PDF_CONFIG.colors.light[0], PDF_CONFIG.colors.light[1], PDF_CONFIG.colors.light[2]);
  doc.roundedRect(14, y, pageWidth - 28, 25, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.setTextColor(PDF_CONFIG.colors.secondary[0], PDF_CONFIG.colors.secondary[1], PDF_CONFIG.colors.secondary[2]);
  
  doc.text("Trésorerie:", 20, y + 10);
  doc.text("Chiffre d'Affaires:", 70, y + 10);
  doc.text("Résultat Net:", 130, y + 10);
  
  doc.setFont(PDF_CONFIG.fonts.normal, "normal");
  doc.text(formatCurrencyPDF(data.cash), 20, y + 18);
  doc.text(formatCurrencyPDF(data.turnover), 70, y + 18);
  doc.text(formatCurrencyPDF(data.net_result), 130, y + 18);

  y += 35;

  // Ratios and Breakdowns Table
  doc.setFontSize(12);
  doc.setFont(PDF_CONFIG.fonts.bold, "bold");
  doc.text("Indicateurs Clés de Performance", 14, y);
  
  autoTable(doc, {
    startY: y + 5,
    head: [['Indicateur', 'Valeur', 'Tendance']],
    body: [
      ['Marge Brute', `${data.kpis?.grossMargin || 0}%`, ''],
      ['Marge Nette', `${data.ratios?.netMargin || 0}%`, ''],
      ['Créances Clients', formatCurrencyPDF(data.receivables), ''],
      ['Dettes Fournisseurs', formatCurrencyPDF(data.payables), ''],
    ],
    theme: 'grid',
    headStyles: { fillColor: PDF_CONFIG.colors.secondary }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // Cashflow Table
  if (data.cashflowData && data.cashflowData.length > 0) {
    if (y > doc.internal.pageSize.height - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont(PDF_CONFIG.fonts.bold, "bold");
    doc.text("Évolution de la Trésorerie (30 jours)", 14, y);

    autoTable(doc, {
      startY: y + 5,
      head: [['Date', 'Entrées', 'Sorties', 'Solde']],
      body: data.cashflowData.map((row: any) => [
        sanitizeText(row.date),
        formatCurrencyPDF(row.in || row.Entrées || 0),
        formatCurrencyPDF(row.out || row.Sorties || 0),
        formatCurrencyPDF(row.balance || row.Solde || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: PDF_CONFIG.colors.primary }
    });
    y = (doc as any).lastAutoTable.finalY + 15;
  }

  addPDFFooter(doc);
  
  // Custom Footer
  if (customConfig.footerText) {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text(sanitizeText(customConfig.footerText), pageWidth / 2, doc.internal.pageSize.height - 5, { align: 'center' });
    }
  }

  doc.save(`Tableau_de_Bord_${new Date().toISOString().slice(0, 10)}.pdf`);
}
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

/**
 * Draws the official Facture Normalisée Électronique (FNE) logo of Côte d'Ivoire.
 */
export function drawFNELogo(doc: jsPDF, centerX: number, centerY: number, radius: number) {
  // Save current graphics state
  const originalDraw = doc.getDrawColor();
  const originalFill = doc.getFillColor();
  const originalWidth = doc.getLineWidth();

  // 1. Draw outer orange circle
  doc.setDrawColor(242, 110, 31); // FNE Orange (#F26E1F)
  doc.setLineWidth(0.8);
  doc.circle(centerX, centerY, radius, 'S');

  // R is the active scaling factor for the map inside
  const r = radius * 0.82;
  
  // 2. Beautiful vector rendering of the Côte d'Ivoire map outline
  // Draw the West (Orange) border
  doc.setDrawColor(242, 110, 31); // Orange
  doc.setLineWidth(0.65);
  doc.setLineCap('round');
  
  const leftPoints = [
    [-0.3, -0.6],  // Top north-west
    [-0.45, -0.4],
    [-0.4, -0.2],
    [-0.5, -0.1],
    [-0.55, 0.1],  // Dent West (Danané)
    [-0.5, 0.25],
    [-0.45, 0.4],
    [-0.48, 0.6],  // West bottom
    [-0.35, 0.8],  // South-west point (Tabou)
    [-0.2, 0.75],
    [-0.05, 0.7],  // South coast
  ];
  
  for (let i = 0; i < leftPoints.length - 1; i++) {
    doc.line(
      centerX + leftPoints[i][0] * r, centerY + leftPoints[i][1] * r,
      centerX + leftPoints[i+1][0] * r, centerY + leftPoints[i+1][1] * r
    );
  }

  // Draw the East/North (Green) border
  doc.setDrawColor(16, 185, 129); // emerald-500 Green
  doc.setLineWidth(0.65);
  const rightPoints = [
    [-0.3, -0.6],  // North start
    [-0.15, -0.65], // High North
    [0.1, -0.62],
    [0.25, -0.5],  // North-East
    [0.4, -0.55], 
    [0.55, -0.45],
    [0.6, -0.2],   // East bump (Bondoukou)
    [0.45, 0.0],
    [0.5, 0.2],
    [0.55, 0.4],   // South-East
    [0.45, 0.58],  // South-East point (Aboisso)
    [0.2, 0.62],   // Abidjan coast
    [-0.05, 0.7]   // South coast join
  ];
  
  for (let i = 0; i < rightPoints.length - 1; i++) {
    doc.line(
      centerX + rightPoints[i][0] * r, centerY + rightPoints[i][1] * r,
      centerX + rightPoints[i+1][0] * r, centerY + rightPoints[i+1][1] * r
    );
  }

  // 3. Inner green circle
  doc.setDrawColor(16, 185, 129); // Green
  doc.setLineWidth(0.5);
  doc.circle(centerX, centerY - 0.05 * r, radius * 0.45, 'S');

  // 4. Stylized "f" (Orange) and "e" (Green) letters
  // Lowercase 'f' (Orange)
  doc.setFontSize(radius * 1.3);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(242, 110, 31);
  doc.text("f", centerX - radius * 0.23, centerY + radius * 0.12);
  
  // Lowercase 'e' (Green)
  doc.setTextColor(16, 185, 129);
  doc.text("e", centerX + radius * 0.05, centerY + radius * 0.12);

  // Restore previous colors
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(originalDraw);
  doc.setFillColor(originalFill);
  doc.setLineWidth(originalWidth);
}

/**
 * Adds an OHADA compliance digital signature / watermark and standard signature line at the given Y position.
 */
export function addOHADAComplianceSignature(doc: jsPDF, y: number, managerName: string = "L'Administrateur", documentRef: string = "") {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  // Draw the stamp box
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(1);
  doc.roundedRect(14, y, 90, 35, 3, 3, 'S');

  // Stamp header
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(14, y, 90, 8, 3, 3, 'F');
  // Fill the bottom corners of the header to make it flat against the rest of the box
  doc.rect(14, y + 5, 90, 3, 'F'); 

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("CERTIFIÉ CONFORME SYSCOHADA", 18, y + 5.5);
  
  // Stamp details
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const secureHash = `SH-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  doc.text(`Émis le : ${timestamp}`, 18, y + 14);
  doc.text(`Réf : ${documentRef || 'DOC-' + secureHash.substring(3, 10)}`, 18, y + 19);
  doc.text(`Signataire : ${managerName}`, 18, y + 24);

  // Digital Signature Hash
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129);
  doc.text(`Empreinte numérique : ${secureHash}`, 18, y + 31);

  // Add standard visual signature line for the authorized person on the right side
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Signature Autorisée", pageWidth - 55, y + 10);
  
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 70, y + 25, pageWidth - 14, y + 25);
  
  return y + 45;
}

