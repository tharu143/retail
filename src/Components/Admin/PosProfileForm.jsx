import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Building, Warehouse, CreditCard, Users, Store,
  Save, Plus, Trash2, Loader2, CheckCircle, Shield, DollarSign
} from 'lucide-react';
import './PosProfileForm.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const getSession = () => localStorage.getItem('session') || '';

export default function PosProfileForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id && id !== 'new');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    write_off_limit: 1,
    users: [{ user: '', default: false }],
    payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
  });

  // Dropdown options lists
  const [companiesList, setCompaniesList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [modesList, setModesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [costCentersList, setCostCentersList] = useState([]);
  const [currenciesList, setCurrenciesList] = useState([]);

  const extractArray = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.message)) return res.message;
    if (res.message && Array.isArray(res.message.data)) return res.message.data;
    return [];
  };

  /* ────────────────────── INITIAL FETCH DROPDOWNS ────────────────────── */
  useEffect(() => {
    fetchDropdowns();
    if (isEdit) {
      fetchProfileDetail();
    }
  }, [id, isEdit]);

  const fetchDropdowns = async () => {
    try {
      const endpoints = [
        `${API_PATH}.get_default_company`,
        `${API_PATH}.get_companies`,
        `${API_PATH}.get_warehouses`,
        `${API_PATH}.get_users`,
        `${API_PATH}.get_modes_of_payment`,
        `${API_PATH}.get_currencies`
      ];

      const responses = await Promise.all(endpoints.map(url =>
        fetch(url, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' })
      ));

      const [def, comp, wh, usr, mod, cur] = await Promise.all(responses.map(r => r.json()));

      const defaultComp = def.message?.company || '';
      setCompaniesList(extractArray(comp));
      setWarehouses(extractArray(wh));
      setUsersList(extractArray(usr));
      setModesList(extractArray(mod));
      setCurrenciesList(extractArray(cur));

      if (!isEdit && defaultComp) {
        setFormData(prev => ({ ...prev, company: prev.company || defaultComp }));
      }
    } catch (err) {
      console.error('Failed to load form dropdowns:', err);
    }
  };

  const fetchProfileDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_PATH}.get_pos_profile_detail?name=${encodeURIComponent(id)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        const doc = data.message.data;
        setFormData({
          name: doc.name || '',
          company: doc.company || '',
          warehouse: doc.warehouse || '',
          currency: doc.currency || '',
          write_off_account: doc.write_off_account || '',
          write_off_cost_center: doc.write_off_cost_center || '',
          write_off_limit: doc.write_off_limit ?? 1,
          users: doc.applicable_for_users?.length > 0
            ? doc.applicable_for_users.map(u => ({ user: u.user, default: Boolean(u.default) }))
            : [{ user: '', default: false }],
          payment_methods: doc.payments?.length > 0
            ? doc.payments.map(p => ({
                mode_of_payment: p.mode_of_payment,
                default: Boolean(p.default),
                allow_in_returns: Boolean(p.allow_in_returns)
              }))
            : [{ mode_of_payment: '', default: false, allow_in_returns: false }]
        });
      } else {
        alert(data.message?.message || 'Failed to load POS Profile');
        navigate('/posprofilelist');
      }
    } catch (err) {
      console.error('Error fetching POS Profile detail:', err);
      alert('Network error loading profile detail');
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────── FETCH DEPENDENT ACCOUNTS ────────────────────── */
  useEffect(() => {
    if (formData.company) {
      const params = new URLSearchParams({ company: formData.company });
      Promise.all([
        fetch(`${API_PATH}.get_accounts?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_cost_centers?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_company_default_currency?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' })
      ]).then(async ([accRes, ccRes, curRes]) => {
        const [acc, cc, cur] = await Promise.all([accRes.json(), ccRes.json(), curRes.json()]);
        setAccountsList(extractArray(acc));
        setCostCentersList(extractArray(cc));
        if (cur.message?.currency && !formData.currency) {
          setFormData(prev => ({ ...prev, currency: cur.message.currency }));
        }
      }).catch(err => console.error(err));
    } else {
      setAccountsList([]);
      setCostCentersList([]);
    }
  }, [formData.company]);

  /* ────────────────────── FORM HANDLERS ────────────────────── */
  const validateForm = () => {
    const errors = {};
    if (!isEdit && !formData.name?.trim()) errors.name = 'Profile Name is required';
    if (!formData.company) errors.company = 'Company is required';
    if (!formData.warehouse) errors.warehouse = 'Warehouse is required';
    if (!formData.currency) errors.currency = 'Currency is required';
    if (!formData.write_off_account) errors.write_off_account = 'Write Off Account is required';
    if (!formData.write_off_cost_center) errors.write_off_cost_center = 'Cost Center is required';
    if (formData.users.filter(u => u.user).length === 0) errors.users = 'At least one user is required';
    if (formData.payment_methods.filter(p => p.mode_of_payment).length === 0) errors.payments = 'At least one payment method is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    const payload = {
      doctype: "POS Profile",
      name: isEdit ? formData.name : formData.name.trim(),
      company: formData.company,
      warehouse: formData.warehouse,
      currency: formData.currency,
      write_off_account: formData.write_off_account,
      write_off_cost_center: formData.write_off_cost_center,
      write_off_limit: formData.write_off_limit,
      applicable_for_users: formData.users.filter(u => u.user).map(u => ({
        user: u.user,
        default: u.default ? 1 : 0
      })),
      payments: formData.payment_methods.filter(p => p.mode_of_payment).map(p => ({
        mode_of_payment: p.mode_of_payment,
        default: p.default ? 1 : 0,
        allow_in_returns: p.allow_in_returns ? 1 : 0
      }))
    };

    try {
      const endpoint = isEdit ? 'update_pos_profile' : 'create_pos_profile';
      const res = await fetch(`${API_PATH}.${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify({ doc: payload })
      });
      const data = await res.json();

      if (data.message?.success) {
        alert(isEdit ? 'POS Profile updated successfully!' : 'POS Profile created successfully!');
        navigate('/posprofilelist');
      } else {
        alert(data.message?.message || 'Failed to save POS Profile');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Network error while saving profile');
    } finally {
      setSaving(false);
    }
  };

  /* Users array helpers */
  const addRowUser = () => {
    setFormData(prev => ({
      ...prev,
      users: [...prev.users, { user: '', default: prev.users.length === 0 }]
    }));
  };

  const removeRowUser = (idx) => {
    setFormData(prev => ({
      ...prev,
      users: prev.users.filter((_, i) => i !== idx)
    }));
  };

  const updateUser = (idx, field, value) => {
    setFormData(prev => {
      const users = [...prev.users];
      if (field === 'default' && value) {
        users.forEach((u, i) => { u.default = i === idx; });
      } else {
        users[idx][field] = value;
      }
      return { ...prev, users };
    });
  };

  /* Payment methods array helpers */
  const addRowPayment = () => {
    setFormData(prev => ({
      ...prev,
      payment_methods: [...prev.payment_methods, { mode_of_payment: '', default: prev.payment_methods.length === 0, allow_in_returns: false }]
    }));
  };

  const removeRowPayment = (idx) => {
    setFormData(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.filter((_, i) => i !== idx)
    }));
  };

  const updatePayment = (idx, field, value) => {
    setFormData(prev => {
      const payments = [...prev.payment_methods];
      if (field === 'default' && value) {
        payments.forEach((p, i) => { p.default = i === idx; });
      } else {
        payments[idx][field] = value;
      }
      return { ...prev, payment_methods: payments };
    });
  };

  if (loading) {
    return (
      <div className="ppf-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#0082f6' }} />
        <span style={{ marginLeft: '0.75rem', fontWeight: 600, color: '#475569' }}>Loading POS Profile...</span>
      </div>
    );
  }

  return (
    <div className="ppf-page-wrapper">
      {/* 1. STICKY HEADER */}
      <div className="ppf-header-bar">
        <div className="ppf-header-left">
          <div className="ppf-title-group">
            <h1>{isEdit ? `EDIT POS PROFILE: ${formData.name}` : 'CREATE NEW POS PROFILE'}</h1>
            <p>Define store register profile settings, users, accounting & payment methods</p>
          </div>
        </div>

        <div className="ppf-header-right">
          <button className="ppf-btn-secondary" onClick={() => navigate('/posprofilelist')}>
            Cancel
          </button>
          <button className="ppf-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : isEdit ? 'Update Profile' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* 2. FORM CONTENT */}
      <div className="ppf-container">
        <div className="ppf-form-grid">

          {/* CARD 1: BASIC INFORMATION */}
          <div className="ppf-card">
            <div className="ppf-card-header">
              <div className="ppf-card-title">
                <Store className="ppf-card-icon" size={20} /> BASIC PROFILE DETAILS
              </div>
            </div>
            
            <div className="ppf-card-body">
              <div className="ppf-fields-row-4">
                {/* Profile Name */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Profile Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="ppf-input"
                    placeholder="e.g. Main POS Counter 1"
                    value={formData.name}
                    disabled={isEdit}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                  {formErrors.name && <span className="ppf-error-text">{formErrors.name}</span>}
                </div>

                {/* Company */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Company <span className="required">*</span>
                  </label>
                  <select
                    className="ppf-select"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                  >
                    <option value="">Select Company</option>
                    {companiesList.map(c => (
                      <option key={c.name || c} value={c.name || c}>{c.name || c}</option>
                    ))}
                  </select>
                  {formErrors.company && <span className="ppf-error-text">{formErrors.company}</span>}
                </div>

                {/* Warehouse */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Warehouse <span className="required">*</span>
                  </label>
                  <select
                    className="ppf-select"
                    value={formData.warehouse}
                    onChange={e => setFormData({ ...formData, warehouse: e.target.value })}
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.name || w} value={w.name || w}>{w.name || w}</option>
                    ))}
                  </select>
                  {formErrors.warehouse && <span className="ppf-error-text">{formErrors.warehouse}</span>}
                </div>

                {/* Currency */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Currency <span className="required">*</span>
                  </label>
                  <select
                    className="ppf-select"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="">Select Currency</option>
                    {currenciesList.map(cur => {
                      const val = cur.name || cur;
                      return <option key={val} value={val}>{val}</option>;
                    })}
                  </select>
                  {formErrors.currency && <span className="ppf-error-text">{formErrors.currency}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: ACCOUNTING & RECONCILIATIONS */}
          <div className="ppf-card">
            <div className="ppf-card-header">
              <div className="ppf-card-title">
                <DollarSign className="ppf-card-icon" size={20} /> ACCOUNTING & WRITE-OFF SETTINGS
              </div>
            </div>

            <div className="ppf-card-body">
              <div className="ppf-fields-row-3">
                {/* Write Off Account */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Write Off Account <span className="required">*</span>
                  </label>
                  <select
                    className="ppf-select"
                    value={formData.write_off_account}
                    onChange={e => setFormData({ ...formData, write_off_account: e.target.value })}
                  >
                    <option value="">Select Account</option>
                    {accountsList.map(a => (
                      <option key={a.name || a} value={a.name || a}>{a.name || a}</option>
                    ))}
                  </select>
                  {formErrors.write_off_account && <span className="ppf-error-text">{formErrors.write_off_account}</span>}
                </div>

                {/* Write Off Cost Center */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Write Off Cost Center <span className="required">*</span>
                  </label>
                  <select
                    className="ppf-select"
                    value={formData.write_off_cost_center}
                    onChange={e => setFormData({ ...formData, write_off_cost_center: e.target.value })}
                  >
                    <option value="">Select Cost Center</option>
                    {costCentersList.map(cc => (
                      <option key={cc.name || cc} value={cc.name || cc}>{cc.name || cc}</option>
                    ))}
                  </select>
                  {formErrors.write_off_cost_center && <span className="ppf-error-text">{formErrors.write_off_cost_center}</span>}
                </div>

                {/* Write Off Limit */}
                <div className="ppf-field">
                  <label className="ppf-label">
                    Write Off Limit
                  </label>
                  <input
                    type="number"
                    className="ppf-input"
                    min="0"
                    step="1"
                    value={formData.write_off_limit}
                    onChange={e => setFormData({ ...formData, write_off_limit: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: APPLICABLE USERS */}
          <div className="ppf-card">
            <div className="ppf-card-header">
              <div className="ppf-card-title">
                <Users className="ppf-card-icon" size={20} /> APPLICABLE USERS
              </div>
              <button className="ppf-add-btn" type="button" onClick={addRowUser}>
                <Plus size={14} /> Add User
              </button>
            </div>

            <div className="ppf-card-body">
              {formErrors.users && <div className="ppf-error-text" style={{ marginBottom: '1rem' }}>{formErrors.users}</div>}

              <div className="ppf-table-container">
                <table className="ppf-table">
                  <thead>
                    <tr>
                      <th>USER ID / EMAIL</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>IS DEFAULT</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.users.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                          No users added. Click "Add User" above.
                        </td>
                      </tr>
                    ) : (
                      formData.users.map((u, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="ppf-select"
                              value={u.user}
                              onChange={e => updateUser(idx, 'user', e.target.value)}
                            >
                              <option value="">Select User</option>
                              {usersList.map(usr => (
                                <option key={usr.name || usr} value={usr.name || usr}>{usr.name || usr}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <label className="ppf-checkbox-label">
                              <input
                                type="checkbox"
                                className="ppf-checkbox"
                                checked={u.default}
                                onChange={e => updateUser(idx, 'default', e.target.checked)}
                              />
                              <span>Default</span>
                            </label>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ppf-remove-btn"
                              onClick={() => removeRowUser(idx)}
                              title="Remove User"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CARD 4: PAYMENT METHODS */}
          <div className="ppf-card">
            <div className="ppf-card-header">
              <div className="ppf-card-title">
                <CreditCard className="ppf-card-icon" size={20} /> MODES OF PAYMENT
              </div>
              <button className="ppf-add-btn" type="button" onClick={addRowPayment}>
                <Plus size={14} /> Add Payment Method
              </button>
            </div>

            <div className="ppf-card-body">
              {formErrors.payments && <div className="ppf-error-text" style={{ marginBottom: '1rem' }}>{formErrors.payments}</div>}

              <div className="ppf-table-container">
                <table className="ppf-table">
                  <thead>
                    <tr>
                      <th>MODE OF PAYMENT</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>DEFAULT</th>
                      <th style={{ width: '180px', textAlign: 'center' }}>ALLOW IN RETURNS</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.payment_methods.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                          No payment methods added. Click "Add Payment Method" above.
                        </td>
                      </tr>
                    ) : (
                      formData.payment_methods.map((p, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              className="ppf-select"
                              value={p.mode_of_payment}
                              onChange={e => updatePayment(idx, 'mode_of_payment', e.target.value)}
                            >
                              <option value="">Select Mode of Payment</option>
                              {modesList.map(m => (
                                <option key={m.name || m} value={m.name || m}>{m.name || m}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <label className="ppf-checkbox-label">
                              <input
                                type="checkbox"
                                className="ppf-checkbox"
                                checked={p.default}
                                onChange={e => updatePayment(idx, 'default', e.target.checked)}
                              />
                              <span>Default</span>
                            </label>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <label className="ppf-checkbox-label">
                              <input
                                type="checkbox"
                                className="ppf-checkbox"
                                checked={p.allow_in_returns}
                                onChange={e => updatePayment(idx, 'allow_in_returns', e.target.checked)}
                              />
                              <span>Allow Returns</span>
                            </label>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="ppf-remove-btn"
                              onClick={() => removeRowPayment(idx)}
                              title="Remove Payment Method"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
