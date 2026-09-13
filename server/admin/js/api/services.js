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
  deactivateTenant: (id) => api.delete(`/api/super-admin/tenants/${id}`),
};

