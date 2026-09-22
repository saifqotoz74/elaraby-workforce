document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const empIdInput = document.getElementById('employee-id');
  const pinInput = document.getElementById('pin-code');
  const workerNameSpan = document.getElementById('worker-name');
  const errorBox = document.getElementById('login-error');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  function showError(msg) {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function hideError() {
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.style.display = 'none';
    }
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      hideError();
      const nationalId = (empIdInput?.value || '').trim();
      const pin = (pinInput?.value || '').trim();

      if (!nationalId) {
        showError('يرجى إدخال الرقم القومي أو كود الموظف');
        empIdInput?.focus();
        return;
      }

      if (!pin || pin.length !== 4) {
        showError('يرجى إدخال رمز المرور المكون من 4 أرقام');
        pinInput?.focus();
        return;
      }

      loginBtn.disabled = true;
      const originalText = loginBtn.textContent;
      loginBtn.textContent = 'جاري التحقق...';

      try {
        const res = await fetch('/api/auth/pin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nationalId, pin }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          if (res.status === 429) {
            showError('تم تجاوز عدد المحاولات المسموح بها، يرجى الانتظار والمحاولة لاحقاً');
          } else {
            showError('بيانات الدخول غير صحيحة، يرجى التأكد من الرقم ورمز المرور');
          }
          loginBtn.disabled = false;
          loginBtn.textContent = originalText;
          return;
        }

        // Authenticated successfully: store token & update worker info
        if (data.token) {
          try {
            sessionStorage.setItem('ess_token', data.token);
          } catch (_) {}
        }

        if (data.employee?.name && workerNameSpan) {
          workerNameSpan.textContent = data.employee.name;
        }

        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
      } catch (err) {
        showError('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة');
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = originalText;
      }
    });
  }

  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn?.click();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try {
        sessionStorage.removeItem('ess_token');
      } catch (_) {}
      if (empIdInput) empIdInput.value = '';
      if (pinInput) pinInput.value = '';
      hideError();
      dashboardScreen.classList.add('hidden');
      loginScreen.classList.remove('hidden');
    });
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.add('hidden'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.remove('hidden');
    });
  });
});

// Export for testing if needed
if (typeof module !== 'undefined') {
  module.exports = {};
}
