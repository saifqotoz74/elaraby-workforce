// Status Badge Helper Component

export function createStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  let badgeClass = 'badge-neutral';
  let label = status || '—';

  if (['approved', 'active', 'success', 'paid'].includes(s)) {
    badgeClass = 'badge-success';
    label = s === 'active' ? 'Active' : s === 'approved' ? 'Approved' : status;
  } else if (['inreview', 'pending', 'warning', 'in review'].includes(s)) {
    badgeClass = 'badge-warning';
    label = s.includes('review') ? 'In Review' : 'Pending';
  } else if (['rejected', 'inactive', 'cancelled', 'danger'].includes(s)) {
    badgeClass = 'badge-danger';
    label = s === 'inactive' ? 'Inactive' : s === 'rejected' ? 'Rejected' : s === 'cancelled' ? 'Cancelled' : status;
  } else if (['info', 'morning', 'evening', 'night', 'office'].includes(s)) {
    badgeClass = 'badge-info';
    label = status.toUpperCase();
  }

  return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${label}</span>`;
}
