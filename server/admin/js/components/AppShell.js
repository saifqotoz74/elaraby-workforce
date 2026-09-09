// AppShell Component
// Assembles the Sidebar, Topbar, Content Container, and Responsive Drawer.

import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';
import { store } from '../state/store.js';

export class AppShell {
  constructor({ onNavigate, onLogout }) {
    this.sidebar = new Sidebar({
      onNavigate: (route) => {
        this.closeMobileSidebar();
        if (onNavigate) onNavigate(route);
      },
      onLogout,
    });

    this.topbar = new Topbar({
      onToggleSidebar: () => this.toggleMobileSidebar(),
    });

    this.element = null;
    this.contentContainer = null;
    this.overlay = null;

    // Listen to store updates for realtime status
    store.subscribe((state) => {
      this.topbar.setRealtimeStatus(state.realtimeConnected);
      if (state.stats?.pendingRequests !== undefined) {
        this.sidebar.updatePendingBadge(state.stats.pendingRequests);
      }
    });
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'app-shell';

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.overlay.onclick = () => this.closeMobileSidebar();

    const mainArea = document.createElement('div');
    mainArea.className = 'app-main';

    this.contentContainer = document.createElement('main');
    this.contentContainer.className = 'app-content';
    this.contentContainer.id = 'app-content-root';

    mainArea.appendChild(this.topbar.render());
    mainArea.appendChild(this.contentContainer);

    this.element.appendChild(this.sidebar.render());
    this.element.appendChild(mainArea);
    this.element.appendChild(this.overlay);

    return this.element;
  }

  setContent(viewElement, title = '') {
    if (!this.contentContainer) return;
    this.topbar.setTitle(title);
    this.contentContainer.innerHTML = '';
    if (viewElement instanceof HTMLElement) {
      this.contentContainer.appendChild(viewElement);
    }
  }

  setActiveRoute(route) {
    this.sidebar.setActive(route);
  }

  toggleMobileSidebar() {
    const sb = this.sidebar.element;
    if (!sb) return;
    sb.classList.toggle('open');
    if (this.overlay) {
      this.overlay.style.display = sb.classList.contains('open') ? 'block' : 'none';
    }
  }

  closeMobileSidebar() {
    const sb = this.sidebar.element;
    if (sb) sb.classList.remove('open');
    if (this.overlay) this.overlay.style.display = 'none';
  }
}
