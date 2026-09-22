// Workforce OS - Central HTML Sanitization Utility
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

/**
 * Sanitizes dynamic HTML strings to prevent Stored & Reflected XSS.
 * Removes dangerous tags (<script>, <iframe>, <object>, etc.) and event handlers (onload, onerror, etc.).
 * @param {any} dirty - Untrusted HTML string
 * @returns {string} Safe HTML string
 */
export function sanitizeHtml(dirty) {
  if (dirty === null || dirty === undefined) return '';
  let str = String(dirty);
  if (!str.includes('<') && !str.includes('&')) {
    return str;
  }

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(str, 'text/html');

      const FORBIDDEN_TAGS = new Set([
        'script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'base', 'form', 'frame', 'frameset', 'applet'
      ]);

      function clean(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
          if (child.nodeType === 1) { // Element node
            const tag = child.tagName.toLowerCase();
            if (FORBIDDEN_TAGS.has(tag)) {
              child.remove();
              continue;
            }

            // Remove dangerous attributes
            const attrs = Array.from(child.attributes);
            for (const attr of attrs) {
              const name = attr.name.toLowerCase();
              const val = attr.value.trim().toLowerCase();
              // Remove any on* event handlers (onerror, onclick, onload, etc.)
              if (name.startsWith('on') || name.startsWith('data-on')) {
                child.removeAttribute(attr.name);
              } else if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
                if (val.startsWith('javascript:') || val.startsWith('vbscript:') || (val.startsWith('data:') && !val.startsWith('data:image/'))) {
                  child.removeAttribute(attr.name);
                }
              }
            }

            clean(child);
          }
        }
      }

      clean(doc.body);
      return doc.body.innerHTML;
    } catch (_) {
      // Fall through to regex sanitizer
    }
  }

  // Robust fallback for Node.js / non-DOM environments:
  // 1. Remove script, iframe, and object blocks entirely
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '');
  str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe\s*>/gi, '');
  str = str.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object\s*>/gi, '');
  // 2. Strip inline on* event handlers (onerror, onload, onclick, etc.)
  str = str.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // 3. Strip javascript: / vbscript: URLs
  str = str.replace(/(href|src)\s*=\s*(?:"(?:javascript|vbscript):[^"]*"|'(?:javascript|vbscript):[^']*'|(?:javascript|vbscript):[^\s>]+)/gi, '');
  return escapeHtml(str);
}

