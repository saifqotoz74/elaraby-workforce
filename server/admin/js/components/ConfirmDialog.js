// Async Accessible Confirmation & Input Prompt Dialogs
// Completely replaces window.confirm() and window.prompt()

import { Modal } from './Modal.js';

export function confirmDialog({
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let resolved = false;

    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = `<p style="font-size: 14px; color: #334155;">${message}</p>`;

    const footerEl = document.createElement('div');
    footerEl.style.display = 'flex';
    footerEl.style.gap = '10px';
    footerEl.style.justifyContent = 'flex-end';
    footerEl.style.width = '100%';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`;
    confirmBtn.textContent = confirmText;

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);

    const modal = new Modal({
      title,
      content: bodyEl,
      footer: footerEl,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      },
    });

    cancelBtn.onclick = () => {
      resolved = true;
      modal.close();
      resolve(false);
    };

    confirmBtn.onclick = () => {
      resolved = true;
      modal.close();
      resolve(true);
    };

    modal.render();
    confirmBtn.focus();
  });
}

export function promptDialog({
  title = 'Input Required',
  message = 'Please provide details below:',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  required = false,
} = {}) {
  return new Promise((resolve) => {
    let resolved = false;

    const bodyEl = document.createElement('div');
    bodyEl.innerHTML = `
      <p style="font-size: 13.5px; color: #475569; margin-bottom: 12px;">${message}</p>
      <input type="text" class="form-input prompt-input" placeholder="${placeholder}" value="${defaultValue}" />
      <div class="prompt-error form-error" style="display: none; margin-top: 6px;"></div>
    `;

    const input = bodyEl.querySelector('.prompt-input');
    const errEl = bodyEl.querySelector('.prompt-error');

    const footerEl = document.createElement('div');
    footerEl.style.display = 'flex';
    footerEl.style.gap = '10px';
    footerEl.style.justifyContent = 'flex-end';
    footerEl.style.width = '100%';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary btn-sm';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary btn-sm';
    confirmBtn.textContent = confirmText;

    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);

    const modal = new Modal({
      title,
      content: bodyEl,
      footer: footerEl,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      },
    });

    const submit = () => {
      const val = input.value.trim();
      if (required && !val) {
        errEl.textContent = 'This field is required.';
        errEl.style.display = 'block';
        input.focus();
        return;
      }
      resolved = true;
      modal.close();
      resolve(val);
    };

    cancelBtn.onclick = () => {
      resolved = true;
      modal.close();
      resolve(null);
    };

    confirmBtn.onclick = submit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') submit();
    };

    modal.render();
    setTimeout(() => input.focus(), 50);
  });
}

// Support both direct function call and object method invocation
confirmDialog.confirm = confirmDialog;
confirmDialog.prompt = promptDialog;

