// Realtime SSE Event Stream Consumer
// Manages EventSource connection to backend and triggers reactive UI updates & Toast notifications.

import { store } from '../state/store.js';
import { toast } from '../components/Toast.js';

let eventSource = null;
let reconnectTimer = null;
let reconnectDelay = 2000;

export function initRealtimeBridge() {
  if (!store.isAuthenticated()) return;
  if (eventSource) {
    eventSource.close();
  }

  // EventSource automatically includes cookies with same-origin requests
  eventSource = new EventSource('/api/admin/realtime');

  eventSource.onopen = () => {
    store.setRealtimeConnected(true);
    reconnectDelay = 2000;
  };

  eventSource.onerror = () => {
    store.setRealtimeConnected(false);
    eventSource.close();
    eventSource = null;

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      initRealtimeBridge();
    }, reconnectDelay);
  };

  eventSource.addEventListener('connected', () => {
    store.setRealtimeConnected(true);
  });

  // 1. Mobile Employee Leave Request Created
  eventSource.addEventListener('leave.request.created', (e) => {
    try {
      const data = JSON.parse(e.data);
      const req = data.request || {};
      toast.info(
        'New Request Submitted',
        `${req.title || 'Leave request'} submitted by ${req.employeeName || 'Employee'}`
      );
      window.dispatchEvent(new CustomEvent('realtime:leave.request.created', { detail: data }));
    } catch (_) {}
  });

  // 2. Leave Request Approved
  eventSource.addEventListener('leave.request.approved', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast.success(
        'Request Approved',
        `Request "${data.request?.title || ''}" was approved.`
      );
      window.dispatchEvent(new CustomEvent('realtime:leave.request.approved', { detail: data }));
    } catch (_) {}
  });

  // 3. Leave Request Rejected
  eventSource.addEventListener('leave.request.rejected', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast.warning(
        'Request Rejected',
        `Request "${data.request?.title || ''}" was rejected.`
      );
      window.dispatchEvent(new CustomEvent('realtime:leave.request.rejected', { detail: data }));
    } catch (_) {}
  });

  // 4. Employee Created or Updated
  eventSource.addEventListener('employee.created', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast.success('New Employee Added', `Employee ${data.employee?.name || ''} was registered.`);
      window.dispatchEvent(new CustomEvent('realtime:employee.created', { detail: data }));
    } catch (_) {}
  });

  eventSource.addEventListener('employee.updated', (e) => {
    try {
      const data = JSON.parse(e.data);
      window.dispatchEvent(new CustomEvent('realtime:employee.updated', { detail: data }));
    } catch (_) {}
  });

  // 5. Announcements
  eventSource.addEventListener('announcement.created', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast.info('New Broadcast Published', data.announcement?.title || 'Announcement');
      window.dispatchEvent(new CustomEvent('realtime:announcement.created', { detail: data }));
    } catch (_) {}
  });

  eventSource.addEventListener('announcement.deleted', (e) => {
    try {
      const data = JSON.parse(e.data);
      window.dispatchEvent(new CustomEvent('realtime:announcement.deleted', { detail: data }));
    } catch (_) {}
  });

  // 6. OTP Requested
  eventSource.addEventListener('otp.requested', (e) => {
    try {
      const data = JSON.parse(e.data);
      toast.info('🔐 New OTP Requested', `Code for ${data.employeeName || 'Employee'}: ${data.otpCode}`);
      window.dispatchEvent(new CustomEvent('realtime:otp.requested', { detail: data }));
    } catch (_) {}
  });
}

export function closeRealtimeBridge() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  store.setRealtimeConnected(false);
}
