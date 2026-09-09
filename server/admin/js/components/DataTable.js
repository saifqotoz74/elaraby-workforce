// Reusable DataTable Component

export class DataTable {
  constructor({ columns = [], data = [], emptyMessage = 'No records found.', loading = false }) {
    this.columns = columns;
    this.data = data;
    this.emptyMessage = emptyMessage;
    this.loading = loading;
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'table-container';

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';

    const table = document.createElement('table');
    table.className = 'data-table';

    // Thead
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of this.columns) {
      const th = document.createElement('th');
      th.textContent = col.header || '';
      if (col.width) th.style.width = col.width;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Tbody
    const tbody = document.createElement('tbody');

    if (this.loading) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = this.columns.length;
      cell.style.textAlign = 'center';
      cell.style.padding = '40px';
      cell.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted);">
          <div class="animate-spin" style="width: 20px; height: 20px; border: 2px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%;"></div>
          <span>Loading records...</span>
        </div>
      `;
      row.appendChild(cell);
      tbody.appendChild(row);
    } else if (!this.data || this.data.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = this.columns.length;
      cell.style.textAlign = 'center';
      cell.style.padding = '40px';
      cell.innerHTML = `
        <div class="empty-state" style="padding: 20px 0;">
          <div class="empty-state-icon" style="width: 48px; height: 48px; margin-bottom: 10px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="empty-state-title" style="font-size: 14px;">${this.emptyMessage}</div>
        </div>
      `;
      row.appendChild(cell);
      tbody.appendChild(row);
    } else {
      for (const item of this.data) {
        const row = document.createElement('tr');
        for (const col of this.columns) {
          const td = document.createElement('td');
          if (typeof col.render === 'function') {
            const rendered = col.render(item);
            if (rendered instanceof HTMLElement) {
              td.appendChild(rendered);
            } else {
              td.innerHTML = rendered !== undefined && rendered !== null ? String(rendered) : '—';
            }
          } else if (col.field) {
            const val = item[col.field];
            td.textContent = val !== undefined && val !== null ? String(val) : '—';
          }
          row.appendChild(td);
        }
        tbody.appendChild(row);
      }
    }

    table.appendChild(tbody);
    scrollWrap.appendChild(table);
    this.element.appendChild(scrollWrap);
    return this.element;
  }

  update(data, loading = false) {
    this.data = data;
    this.loading = loading;
    if (this.element && this.element.parentElement) {
      const newEl = this.render();
      this.element.replaceWith(newEl);
      this.element = newEl;
    }
  }
}
