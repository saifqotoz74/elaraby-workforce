// Domain-specific Admin API Endpoints

import { api, apiFetch } from './client.js';

export const authApi = {
  login: (credentials) => api.post('/api/admin/login', credentials),
  logout: () => api.post('/api/admin/logout', {}),
};

export const employeeApi = {
  list: (params) => api.get('/api/admin/employees', params),
  get: (id) => api.get(`/api/admin/employees/${id}`),
  create: (data) => api.post('/api/admin/employees', data),
  update: (id, data) => api.put(`/api/admin/employees/${id}`, data),
  toggle: (id) => api.post(`/api/admin/employees/${id}/toggle`, {}),
};

export const leaveApi = {
  list: (params) => api.get('/api/admin/requests', params),
  decide: (id, decision) => api.post(`/api/admin/requests/${id}/decide`, decision),
};

export const payrollApi = {
  get: (employeeId) => api.get(`/api/admin/payroll/${employeeId}`),
  update: (employeeId, data) => api.put(`/api/admin/payroll/${employeeId}`, data),
};

export const shiftApi = {
  get: (employeeId) => api.get(`/api/admin/roster/${employeeId}`),
  update: (employeeId, data) => api.put(`/api/admin/roster/${employeeId}`, data),
  listRosters: (params) => api.get('/api/admin/rosters', params),
  listSwaps: (params) => api.get('/api/admin/shifts/swaps', params),
  decideSwap: (id, decision) => api.post(`/api/admin/shifts/swaps/${id}/decide`, decision),
  swapDirect: (data) => api.post('/api/admin/shifts/swap-direct', data),
};

export const overtimeApi = {
  list: (params) => api.get('/api/admin/overtime', params),
  decide: (id, decision) => api.post(`/api/admin/overtime/${id}/decide`, decision),
};

export const contentApi = {
  listAnnouncements: (params) => api.get('/api/admin/announcements', params),
  createAnnouncement: (data) => api.post('/api/admin/announcements', data),
  deleteAnnouncement: (id) => api.delete(`/api/admin/announcements/${id}`),

  listNews: (params) => api.get('/api/admin/news', params),
  createNews: (data) => api.post('/api/admin/news', data),
  deleteNews: (id) => api.delete(`/api/admin/news/${id}`),

  listBenefits: (params) => api.get('/api/admin/benefits', params),
  createBenefit: (data) => api.post('/api/admin/benefits', data),
  deleteBenefit: (id) => api.delete(`/api/admin/benefits/${id}`),

  listTrips: (params) => api.get('/api/admin/trips', params),
  createTrip: (data) => api.post('/api/admin/trips', data),
  deleteTrip: (id) => api.delete(`/api/admin/trips/${id}`),
};

export const statsApi = {
  get: () => api.get('/api/admin/stats'),
};

export const auditApi = {
  list: (params) => api.get('/api/admin/audit-logs', params),
};

export const concernsApi = {
  list: () => api.get('/api/admin/concerns'),
};

export const uploadApi = {
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/api/admin/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

export const metricsApi = {
  get: () => api.get('/api/admin/metrics'),
};

export const superAdminApi = {
  listTenants: () => api.get('/api/super-admin/tenants'),
  createTenant: (data) => api.post('/api/super-admin/tenants', data),
  updateTenant: (id, data) => api.put(`/api/super-admin/tenants/${id}`, data),
  updateLogo: (id, logoUrl) => api.post(`/api/super-admin/tenants/${id}/logo`, { logoUrl }),
  deactivateTenant: (id) => api.delete(`/api/super-admin/tenants/${id}`),
};

export const transportApi = {
  getFleet: () => api.get('/api/admin/transport/fleet'),
  getRoutes: () => api.get('/api/admin/transport/routes'),
  getManifest: (routeId) => api.get(`/api/admin/transport/manifest/${routeId}`),
  reportAlert: (data) => api.post('/api/admin/transport/alerts', data),
};

export const loanApi = {
  list: (params) => api.get('/api/admin/loans', params),
  updateStatus: (id, data) => api.post(`/api/admin/loans/${id}/status`, data),
};

export const attendanceApi = {
  getToday: (params) => api.get('/api/admin/attendance/today', params),
};

export const reportsApi = {
  getAnalytics: (params) => api.get('/api/admin/reports/analytics', params),
  getBankExportUrl: (format, period, facilityCode, tenantId) =>
    `/api/admin/reports/bank-export?format=${encodeURIComponent(format || 'wps_cbe')}&period=${encodeURIComponent(period || '')}&facilityCode=${encodeURIComponent(facilityCode || '')}&tenantId=${encodeURIComponent(tenantId || '')}`,
};

export const integrationsApi = {
  getStatus: () => api.get('/api/admin/integrations/status'),
  triggerSync: (domain, options) => api.post('/api/admin/integrations/sync', { domain, options }),
  getReconciliation: (params) => api.get('/api/admin/integrations/reconciliation', params),
  resolveReconciliation: (data) => api.post('/api/admin/integrations/reconciliation/resolve', data),
};

export const alertApi = {
  list: (params) => api.get('/api/admin/alerts', params),
  markRead: (id) => api.put(`/api/admin/alerts/${id}/read`, {}),
  markAllRead: (params) => api.post('/api/admin/alerts/mark-all-read', params || {}),
};

export const analyticsApi = {
  getBiOverview: (params) => api.get('/api/admin/analytics/bi-overview', params),
  getReportExportUrl: (tenantId, format = 'csv') =>
    `/api/admin/analytics/export/report?format=${encodeURIComponent(format)}&tenantId=${encodeURIComponent(tenantId || '')}`,
};

export const rosterSolverApi = {
  solve: (data) => api.post('/api/admin/roster/solve', data),
  getWeek: (weekStart) => api.get(`/api/admin/roster/week?weekStart=${encodeURIComponent(weekStart)}`),
  getExportUrl: (weekStart, format = 'csv') => `/api/admin/roster/export?weekStart=${encodeURIComponent(weekStart)}&format=${encodeURIComponent(format)}`,
};

