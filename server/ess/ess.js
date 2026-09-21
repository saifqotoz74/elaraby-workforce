document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  loginBtn.addEventListener('click', () => {
    // Mock login
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
  });

  logoutBtn.addEventListener('click', () => {
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));

      // Add active to clicked
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.remove('hidden');
    });
  });
});

// Export for testing if needed
if (typeof module !== 'undefined') {
  module.exports = {};
}
