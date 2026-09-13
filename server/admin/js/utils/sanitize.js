// Elaraby Connect - Central HTML Sanitization Utility
// Prevents Stored and Reflected XSS by escaping HTML special characters.

/**
 * Escapes unsafe HTML characters to prevent XSS.
 * @param {any} str - Input value to sanitize
 * @returns {string} Sanitized string safe for DOM insertion
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitizes URLs to prevent javascript: or malicious protocol injection.
 * Only permits relative /uploads/ paths or safe http/https protocols.
 * @param {string} url - Candidate URL string
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^(\/uploads\/|https?:\/\/)/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return null;
}
