// Enterprise Admin API Client with Cookie Session Support,
// Auto-CSRF Injection, and Centralized Error Handling.

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfToken() {
  return getCookie('csrf_token') || window.__CSRF_TOKEN__ || '';
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Robust fetch wrapper for Admin API operations.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `/api/admin/${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  // Mutating requests require CSRF token when authenticated via cookies
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
    // Only set Content-Type if body is not FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const fetchOptions = {
    method,
    headers,
    credentials: 'same-origin', // Sends HttpOnly admin_session cookie
    ...options,
  };

  if (fetchOptions.body && typeof fetchOptions.body === 'object' && !(fetchOptions.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr) {
    throw new ApiError('Network connection failed. Please check your internet connection.', 0, null);
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {}
  } else {
    try {
      data = { text: await response.text() };
    } catch (_) {}
  }

  if (!response.ok) {
    if (response.status === 401 && !url.includes('/login')) {
      // Session expired or revoked
      window.dispatchEvent(new CustomEvent('admin:unauthorized'));
    }

    const errorMessage =
      data?.error ||
      data?.message ||
      (response.status === 403 ? 'Access Forbidden: Insufficient permissions' : 'An error occurred');

    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint, query) => {
    let url = endpoint;
    if (query) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, v);
        }
      }
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return apiFetch(url, { method: 'GET' });
  },

  post: (endpoint, body) => apiFetch(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => apiFetch(endpoint, { method: 'PUT', body }),
  patch: (endpoint, body) => apiFetch(endpoint, { method: 'PATCH', body }),
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
};
