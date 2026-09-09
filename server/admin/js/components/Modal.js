// Accessible DOM Modal Dialog Component

export class Modal {
  constructor({ title, content, footer, wide = false, onClose } = {}) {
    this.title = title || '';
    this.content = content || '';
    this.footer = footer || null;
    this.wide = wide;
    this.onClose = onClose;
    this.backdrop = null;
    this.element = null;
    this.keydownHandler = null;
  }

  open() {
    return this.render();
  }

  render() {
    if (this.backdrop) return this.backdrop;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.element = this.backdrop;

    const windowEl = document.createElement('div');
    windowEl.className = `modal-window ${this.wide ? 'wide' : ''}`;

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'modal-header';
    headerEl.innerHTML = `
      <div class="modal-title">${this.title}</div>
      <button class="modal-close" aria-label="Close modal">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    headerEl.querySelector('.modal-close').onclick = () => this.close();

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'modal-body';
    if (typeof this.content === 'string') {
      bodyEl.innerHTML = this.content;
    } else if (this.content instanceof HTMLElement) {
      bodyEl.appendChild(this.content);
    }

    windowEl.appendChild(headerEl);
    windowEl.appendChild(bodyEl);

    // Footer
    if (this.footer) {
      const footerEl = document.createElement('div');
      footerEl.className = 'modal-footer';
      if (typeof this.footer === 'string') {
        footerEl.innerHTML = this.footer;
      } else if (this.footer instanceof HTMLElement) {
        footerEl.appendChild(this.footer);
      }
      windowEl.appendChild(footerEl);
    }

    this.backdrop.appendChild(windowEl);

    // Backdrop click outside closes
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });

    // Escape key closes
    this.keydownHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);

    document.body.appendChild(this.backdrop);
    return this.backdrop;
  }

  close() {
    if (this.backdrop) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.backdrop.remove();
      this.backdrop = null;
      this.element = null;
      if (typeof this.onClose === 'function') {
        this.onClose();
      }
    }
  }
}
