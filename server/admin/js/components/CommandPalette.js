// Command Palette (Spotlight / Ctrl+K) Component
// Modern SaaS command bar for rapid navigation and quick actions

export class CommandPalette {
  constructor({ onNavigate, onAction }) {
    this.onNavigate = onNavigate;
    this.onAction = onAction;
    this.element = null;
    this.isOpen = false;
    this.selectedIndex = 0;
    this.items = [];
    this.filteredItems = [];

    this.initItems();
    this.bindGlobalShortcut();
  }

  initItems() {
    this.items = [
      // Navigation
      { id: 'nav-dash', group: 'Navigation', title: 'Dashboard & Analytics', icon: '📊', route: 'dashboard', keywords: 'home stats overview metrics' },
      { id: 'nav-emp', group: 'Navigation', title: 'Workforce & Employees', icon: '👥', route: 'employees', keywords: 'staff workers directory profiles users' },
      { id: 'nav-leave', group: 'Navigation', title: 'Leave & Vacation Requests', icon: '🏖️', route: 'leave', keywords: 'vacations holiday approvals sick' },
      { id: 'nav-shifts', group: 'Navigation', title: 'Shift Roster & Schedules', icon: '⏰', route: 'shifts', keywords: 'work hours roster rotation timetable' },
      { id: 'nav-attendance', group: 'Navigation', title: 'Live Attendance & Geofencing', icon: '📍', route: 'attendance', keywords: 'punches turnstile checkin checkout presence' },
      { id: 'nav-payroll', group: 'Navigation', title: 'Payroll & Salaries', icon: '💳', route: 'payroll', keywords: 'payslips compensation deductions wages' },
      { id: 'nav-loans', group: 'Navigation', title: 'Loans & Salary Advances', icon: '💰', route: 'loans', keywords: 'emergency advance loans installments borrow finances' },
      { id: 'nav-transport', group: 'Navigation', title: 'Fleet & Shuttle Logistics', icon: '🚌', route: 'transport', keywords: 'buses commute corridor shuttles drivers fleet' },
      { id: 'nav-reports', group: 'Navigation', title: 'Reports & Enterprise Integrations', icon: '📈', route: 'reports', keywords: 'executive analytics bank wps erp biometrics sync' },
      { id: 'nav-news', group: 'Navigation', title: 'Announcements & News', icon: '📢', route: 'announcements', keywords: 'broadcast alerts comms messages' },
      { id: 'nav-safety', group: 'Navigation', title: 'Workplace Safety & Concerns', icon: '🛡️', route: 'concerns', keywords: 'whistleblower reports incidents complaints' },
      { id: 'nav-audit', group: 'Navigation', title: 'Audit Trail & Compliance Logs', icon: '📝', route: 'audit', keywords: 'security history activity changes' },
      { id: 'nav-settings', group: 'Navigation', title: 'Admin Settings & RBAC Roles', icon: '⚙️', route: 'settings', keywords: 'roles permissions tenant configuration' },
      { id: 'nav-tenants', group: 'Navigation', title: 'Tenant Organizations', icon: '🏢', route: 'tenants', keywords: 'companies multi-tenant white-label' },

      // Quick Actions
      { id: 'act-add-emp', group: 'Quick Actions', title: 'Add New Employee Profile', icon: '➕', action: 'add-employee', keywords: 'create employee new hire' },
      { id: 'act-new-broadcast', group: 'Quick Actions', title: 'Publish Global Announcement', icon: '📣', action: 'new-announcement', keywords: 'broadcast alert notice message' },
      { id: 'act-review-loans', group: 'Quick Actions', title: 'Review Pending Emergency Loans', icon: '💰', action: 'review-loans', keywords: 'loans approve advance' },
      { id: 'act-view-attendance', group: 'Quick Actions', title: 'Monitor Live Shift Attendance', icon: '📍', action: 'view-attendance', keywords: 'attendance punches breaches' },
      { id: 'act-export-bank', group: 'Quick Actions', title: 'Generate Bank Payroll File (WPS)', icon: '🏛️', action: 'export-bank', keywords: 'wps bank payroll nbe misr cib cbe' },
      { id: 'act-sync-erp', group: 'Quick Actions', title: 'Trigger Enterprise ERP Sync', icon: '🔄', action: 'sync-erp', keywords: 'sap oracle erp biometrics reconciliation' },
      { id: 'act-theme', group: 'Quick Actions', title: 'Toggle Theme (Light / Dark)', icon: '🌓', action: 'toggle-theme', keywords: 'darkmode lightmode color night' },
      { id: 'act-lang', group: 'Quick Actions', title: 'Toggle Language (العربية / English)', icon: '🌐', action: 'toggle-lang', keywords: 'arabic english rtl ltr translate' },
      { id: 'act-export', group: 'Quick Actions', title: 'Export Workforce to Excel', icon: '📥', action: 'export-excel', keywords: 'download spreadsheet csv' },
    ];
    this.filteredItems = [...this.items];
  }

  bindGlobalShortcut() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    document.body.appendChild(this.element);

    const input = this.element.querySelector('#command-palette-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.filter('');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  filter(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          (item.keywords && item.keywords.includes(q))
        );
      });
    }
    this.selectedIndex = 0;
    this.renderResults();
  }

  renderResults() {
    if (!this.element) return;
    const resultsContainer = this.element.querySelector('#command-palette-results');
    if (!resultsContainer) return;

    if (this.filteredItems.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 13.5px;">
          No matching commands or pages found.
        </div>
      `;
      return;
    }

    // Group items by group
    const groups = {};
    this.filteredItems.forEach((item, index) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({ item, globalIndex: index });
    });

    let html = '';
    for (const [groupName, list] of Object.entries(groups)) {
      html += `<div class="command-palette-group-title">${groupName}</div>`;
      for (const { item, globalIndex } of list) {
        const isSelected = globalIndex === this.selectedIndex;
        html += `
          <div class="command-palette-item ${isSelected ? 'active' : ''}" data-index="${globalIndex}">
            <div class="command-palette-item-left">
              <span style="font-size: 18px;">${item.icon}</span>
              <span style="font-weight: 600;">${item.title}</span>
            </div>
            <span class="kbd-badge">${item.route ? 'Jump' : 'Action'}</span>
          </div>
        `;
      }
    }
    resultsContainer.innerHTML = html;

    // Attach click listeners
    const rows = resultsContainer.querySelectorAll('.command-palette-item');
    rows.forEach((row) => {
      row.onclick = () => {
        const idx = Number(row.dataset.index);
        this.executeIndex(idx);
      };
      row.onmouseenter = () => {
        const idx = Number(row.dataset.index);
        this.selectedIndex = idx;
        this.highlightSelected();
      };
    });

    this.scrollToSelected();
  }

  highlightSelected() {
    if (!this.element) return;
    const items = this.element.querySelectorAll('.command-palette-item');
    items.forEach((it) => {
      if (Number(it.dataset.index) === this.selectedIndex) {
        it.classList.add('active');
      } else {
        it.classList.remove('active');
      }
    });
  }

  scrollToSelected() {
    if (!this.element) return;
    const activeItem = this.element.querySelector('.command-palette-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  executeIndex(index) {
    const item = this.filteredItems[index];
    if (!item) return;
    this.close();

    if (item.route && this.onNavigate) {
      this.onNavigate(item.route);
    } else if (item.action && this.onAction) {
      this.onAction(item.action);
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'command-palette-backdrop';

    this.element.innerHTML = `
      <div class="command-palette-modal" role="dialog" aria-modal="true">
        <div class="command-palette-search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="command-palette-input" placeholder="Type a command, page, or action..." autocomplete="off" />
          <span class="kbd-badge">ESC to close</span>
        </div>

        <div class="command-palette-results" id="command-palette-results"></div>

        <div class="command-palette-footer">
          <div style="display: flex; gap: 14px; align-items: center;">
            <span><span class="kbd-badge">↑</span> <span class="kbd-badge">↓</span> Navigate</span>
            <span><span class="kbd-badge">↵</span> Select</span>
          </div>
          <span>Workforce OS Spotlight</span>
        </div>
      </div>
    `;

    // Click backdrop to close
    this.element.onclick = (e) => {
      if (e.target === this.element) {
        this.close();
      }
    };

    const input = this.element.querySelector('#command-palette-input');
    input.oninput = () => {
      this.filter(input.value);
    };

    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filteredItems.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredItems.length;
          this.highlightSelected();
          this.scrollToSelected();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filteredItems.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.filteredItems.length) % this.filteredItems.length;
          this.highlightSelected();
          this.scrollToSelected();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeIndex(this.selectedIndex);
      }
    };

    return this.element;
  }
}
