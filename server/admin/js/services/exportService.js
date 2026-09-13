// Universal CSV & Excel Export Engine with UTF-8 BOM for Arabic Support

export class ExportService {
  /**
   * Generates and triggers download of a CSV file readable by Microsoft Excel.
   * @param {string} filename - Base name of the file (without extension)
   * @param {Array<{ key: string, label: string, formatter?: (val: any, row: any) => string }>} columns - Column definitions
   * @param {Array<Object>} rows - Data records
   */
  static exportToCsv(filename, columns, rows) {
    if (!rows || rows.length === 0) {
      alert('No data available to export.');
      return;
    }

    // 1. Header row
    const headerRow = columns.map(col => this._escapeCsvCell(col.label)).join(',');

    // 2. Data rows
    const dataRows = rows.map(row => {
      return columns.map(col => {
        let val;
        if (col.formatter) {
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
    const finalFilename = `${filename}_${dateStr}.csv`;

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
    let str = String(value).trim();
    // If value contains quotes, commas, or line breaks, enclose in quotes and escape internal quotes
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    } else {
      str = '"' + str + '"';
    }
    return str;
  }
}
