// Reusable Pagination Component

export function renderPagination({ page = 1, totalPages = 1, total = 0, onPageChange }) {
  if (totalPages <= 1) return '';

  const container = document.createElement('div');
  container.className = 'pagination-container';

  const info = document.createElement('div');
  info.className = 'pagination-info';
  info.textContent = `Showing page ${page} of ${totalPages} (${total} total records)`;

  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = page <= 1;
  prevBtn.onclick = () => onPageChange(page - 1);

  controls.appendChild(prevBtn);

  // Generate page numbers window
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);

  for (let p = startPage; p <= endPage; p++) {
    const numBtn = document.createElement('button');
    numBtn.className = `page-btn ${p === page ? 'active' : ''}`;
    numBtn.textContent = p;
    numBtn.onclick = () => onPageChange(p);
    controls.appendChild(numBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.textContent = 'Next';
  nextBtn.disabled = page >= totalPages;
  nextBtn.onclick = () => onPageChange(page + 1);

  controls.appendChild(nextBtn);

  container.appendChild(info);
  container.appendChild(controls);
  return container;
}

export class Pagination {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
  }

  render() {
    if (!this.container) return null;
    this.container.innerHTML = '';
    const el = renderPagination({
      page: this.options.currentPage || 1,
      totalPages: this.options.totalPages || 1,
      total: this.options.totalItems || 0,
      onPageChange: this.options.onPageChange,
    });
    if (el) {
      this.container.appendChild(el);
    }
    return el;
  }
}
