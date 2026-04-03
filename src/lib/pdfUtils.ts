/**
 * Utility functions for PDF generation to ensure consistent encoding and formatting.
 * This helps avoid "bizarre characters" (encoding issues) in jsPDF exports.
 */

/**
 * Removes accents and special characters from a string to ensure compatibility with standard PDF fonts.
 * @param text The text to sanitize
 * @returns Sanitized text (ASCII only)
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters
}

/**
 * Formats a number for PDF export with a standard space as thousands separator.
 * Avoids non-breaking spaces (\u00A0 or \u202F) which cause encoding issues in jsPDF.
 * @param amount The number to format
 * @returns Formatted string (e.g., "1 234 567")
 */
export function formatCurrencyPDF(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '';
  if (amount === 0) return ''; // Optional: return '0' or '' based on preference, usually '' for readability in tables
  
  // Round to 0 decimal places for FCFA
  const rounded = Math.round(amount);
  
  // Convert to string and add spaces manually
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
