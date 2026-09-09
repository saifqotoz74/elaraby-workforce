// Client-side Hash Router with Authentication & RBAC Route Guards

import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';

export class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.currentParams = {};
  }

  addRoute(path, handler, requiredPermission = null) {
    // Convert path pattern e.g. /employees/:id to regex
    const paramNames = [];
    const regexPath = path.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
      paramNames.push(key);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexPath}$`);

    this.routes.push({
      path,
      regex,
      paramNames,
      handler,
      requiredPermission,
    });
  }

  getHashPath() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    return hash.startsWith('/') ? hash : `/${hash}`;
  }

  navigate(path) {
    const target = path.startsWith('/') ? path : `/${path}`;
    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
    }
    this.resolve();
  }

  resolve() {
    const path = this.getHashPath();

    // 1. Authentication Guard
    const isAuth = store.isAuthenticated();
    if (!isAuth && path !== '/login') {
      this.navigate('/login');
      return;
    }
    if (isAuth && path === '/login') {
      this.navigate('/dashboard');
      return;
    }

    // 2. Match Route
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        // RBAC Permission Guard
        if (route.requiredPermission && !store.hasPermission(route.requiredPermission)) {
          toast.warning('Access Forbidden', 'Your administrative role lacks permission for this section.');
          this.navigate('/dashboard');
          return;
        }

        const params = {};
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });

        this.currentRoute = route.path;
        this.currentParams = params;
        store.setActiveRoute(route.path.split('/')[1] || 'dashboard');

        route.handler(params);
        return;
      }
    }

    // 404 Fallback
    this.navigate('/dashboard');
  }

  start() {
    window.addEventListener('hashchange', () => this.resolve());
    window.addEventListener('admin:unauthorized', () => {
      store.clearUser();
      this.navigate('/login');
    });
    this.resolve();
  }
}
