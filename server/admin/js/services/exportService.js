// Universal CSV & Excel Export Engine with UTF-8 BOM for Arabic Support

export class ExportService {
  /**
   * Generates and triggers download of a CSV file readable by Microsoft Excel.
   * Supports both 3-arg (filename, columns, rows) and 2-arg (filename, rows) signatures.
   * @param {string} filename - Base name of the file (without extension)
   * @param {Array<{ key: string, label: string, formatter?: (val: any, row: any) => string }>|Array<Object>} columns - Column definitions or rows
   * @param {Array<Object>} [rows] - Data records
   */
  static exportToCsv(filename, columns, rows) {
    // Robust overload support: if called as exportToCsv(filename, rows)
    if (rows === undefined && Array.isArray(columns)) {
      rows = columns;
      columns = null;
    }

    if (!rows || rows.length === 0) {
      if (typeof window !== 'undefined' && window.toast && typeof window.toast.warning === 'function') {
        window.toast.warning('Export', 'No data available to export.');
      } else {
        alert('No data available to export.');
      }
      return;
    }

    // Auto-derive columns from first row if not provided
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      const keys = Object.keys(rows[0] || {});
      columns = keys.map(k => ({ key: k, label: k }));
    }

    // 1. Header row
    const headerRow = columns.map(col => this._escapeCsvCell(col.label || col.key)).join(',');

    // 2. Data rows
    const dataRows = rows.map(row => {
      return columns.map(col => {
        let val;
        if (typeof col.formatter === 'function') {
          val = col.formatter(row[col.key], row);
        } else {
          val = row[col.key];
        }
        return this._escapeCsvCell(val);
      }).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\r\n');

    // 3. Prepend UTF-8 BOM (\uFEFF) so Excel parses Arabic/Unicode characters natively
    const bomCsv = '\uFEFF' + csvContent;
    const blob = new Blob([bomCsv], { type: 'text/csv;charset=utf-8;' });

    // 4. Trigger browser download
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeBaseName = (filename || 'export').replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    const finalFilename = `${safeBaseName}_${dateStr}.csv`;

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', finalFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Escape cell values according to RFC 4180 standard
   */
  static _escapeCsvCell(value) {
    if (value === null || value === undefined) return '""';
    const str = String(value).trim();
    // In RFC 4180, fields containing quotes, commas, or linebreaks must be enclosed in quotes
    // and internal double-quotes are doubled. Enclosing all values ensures clean tabular parsing in Excel.
    return '"' + str.replace(/"/g, '""') + '"';
  }
}
