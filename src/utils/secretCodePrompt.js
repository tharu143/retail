import Swal from 'sweetalert2';
import axios from 'axios';

/**
 * promptSecretCode
 * Interactive SweetAlert2 modal that prompts for employee secret PIN,
 * performs real-time validation to display the Employee Name under the PIN input,
 * and resolves with { secret_key, employee_name, employee_id, is_manager }.
 */
export const promptSecretCode = async ({
  title = 'Authorization Required',
  subtitle = 'Enter Employee Secret Code to authorize this action',
  warehouse
} = {}) => {
  return new Promise((resolve) => {
    let verifiedEmp = null;
    let debounceTimer = null;

    Swal.fire({
      title: `<div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:800;color:#1e293b;">
        <span style="display:inline-flex;padding:6px;background:#ecfdf5;color:#059669;border-radius:8px;">🔒</span>
        ${title}
      </div>`,
      html: `
        <div style="display:flex;flex-direction:column;gap:12px;text-align:left;padding:4px 0;">
          <p style="font-size:12px;color:#64748b;margin:0;">${subtitle}</p>
          <div>
            <label style="display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#475569;margin-bottom:4px;">
              Secret Code / PIN <span style="color:#ef4444;">*</span>
            </label>
            <input 
              id="swal-secret-pin-input" 
              type="password" 
              placeholder="••••" 
              maxlength="10"
              autocomplete="off"
              style="width:100%;text-align:center;font-family:monospace;font-size:22px;letter-spacing:0.25em;padding:10px 14px;border-radius:12px;border:1.5px solid #cbd5e1;background:#f8fafc;outline:none;font-weight:800;color:#0f172a;box-sizing:border-box;"
            />
          </div>
          <div id="swal-secret-emp-preview" style="min-height:42px;display:flex;align-items:center;justify-content:center;">
            <span style="font-size:11px;color:#94a3b8;font-style:italic;">Enter code to verify employee...</span>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Authorize & Continue',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#94a3b8',
      focusConfirm: false,
      didOpen: () => {
        const input = document.getElementById('swal-secret-pin-input');
        const preview = document.getElementById('swal-secret-emp-preview');
        const confirmBtn = Swal.getConfirmButton();
        if (confirmBtn) confirmBtn.disabled = true;

        if (input) {
          input.focus();
          input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (debounceTimer) clearTimeout(debounceTimer);

            if (val.length >= 3) {
              preview.innerHTML = `<span style="font-size:11px;color:#64748b;">Checking code...</span>`;
              debounceTimer = setTimeout(async () => {
                try {
                  const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_cashier_by_secret_key', {
                    params: { secret_key: val, warehouse },
                    withCredentials: true
                  });
                  const data = res.data?.message;
                  if (data && data.status === 'success' && data.employee_name) {
                    verifiedEmp = {
                      secret_key: val,
                      employee_name: data.employee_name,
                      employee_id: data.employee_id,
                      is_manager: data.is_manager
                    };
                    preview.innerHTML = `
                      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;width:100%;box-sizing:border-box;">
                        <span style="background:#059669;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;">✓</span>
                        <div style="display:flex;flex-direction:column;min-width:0;flex:1;">
                          <span style="font-size:12px;font-weight:800;color:#065f46;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.employee_name}</span>
                          <span style="font-size:10px;font-weight:600;color:#047857;">${data.is_manager ? 'Universal Manager' : (data.branch || 'Authorized Employee')}</span>
                        </div>
                      </div>
                    `;
                    if (confirmBtn) confirmBtn.disabled = false;
                  } else {
                    verifiedEmp = null;
                    preview.innerHTML = `<span style="font-size:11px;color:#e11d48;font-weight:700;">✕ ${data?.message || 'Invalid Secret Code'}</span>`;
                    if (confirmBtn) confirmBtn.disabled = true;
                  }
                } catch {
                  verifiedEmp = null;
                  preview.innerHTML = `<span style="font-size:11px;color:#e11d48;font-weight:700;">✕ Verification failed</span>`;
                  if (confirmBtn) confirmBtn.disabled = true;
                }
              }, 200);
            } else {
              verifiedEmp = null;
              preview.innerHTML = `<span style="font-size:11px;color:#94a3b8;font-style:italic;">Enter code to verify employee...</span>`;
              if (confirmBtn) confirmBtn.disabled = true;
            }
          });
        }
      },
      preConfirm: () => {
        if (!verifiedEmp) {
          Swal.showValidationMessage('Please enter a valid Employee Secret Code');
          return false;
        }
        return verifiedEmp;
      }
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        resolve(result.value);
      } else {
        resolve(null);
      }
    });
  });
};
