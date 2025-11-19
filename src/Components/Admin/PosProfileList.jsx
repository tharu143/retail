// src/pages/PosProfileList.jsx
import React, { useState, useEffect } from 'react';
import {
  Plus, Building, Warehouse, Users, CreditCard,
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Trash2
} from 'lucide-react';
import NavBar from '../Nav/NavBar';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const getSession = () => localStorage.getItem('session') || '';

export default function PosProfileList() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null); // null = create, object = edit
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form Data
  const [formData, setFormData] = useState({
    name: null,
    company: '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    write_off_limit: 1,
    users: [],
    payment_methods: []
  });

  // Dropdowns
  const [companiesList, setCompaniesList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [modesList, setModesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [costCentersList, setCostCentersList] = useState([]);
  const [currenciesList, setCurrenciesList] = useState([]);
  const [defaultCompany, setDefaultCompany] = useState('');

  // Fetch Profiles
  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize
      });
      const res = await fetch(`${API_PATH}.get_pos_profiles?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        setProfiles(data.message.data);
        setTotal(data.message.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchDropdowns();
  }, [currentPage]);

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

      setDefaultCompany(def.message?.company || '');
      setCompaniesList(comp.message || comp || []);
      setWarehouses(wh.message || wh || []);
      setUsersList(usr.message || usr || []);
      setModesList(mod.message || mod || []);
      setCurrenciesList(cur.message || cur || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load accounts & cost centers when company changes
  useEffect(() => {
    if (formData.company) {
      const params = new URLSearchParams({ company: formData.company });
      Promise.all([
        fetch(`${API_PATH}.get_accounts?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_cost_centers?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_company_default_currency?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' })
      ]).then(async ([accRes, ccRes, curRes]) => {
        const [acc, cc, cur] = await Promise.all([accRes.json(), ccRes.json(), curRes.json()]);
        setAccountsList(acc.message || acc || []);
        setCostCentersList(cc.message || cc || []);
        if (cur.message?.currency && !formData.currency) {
          setFormData(prev => ({ ...prev, currency: cur.message.currency }));
        }
      });
    } else {
      setAccountsList([]);
      setCostCentersList([]);
    }
  }, [formData.company]);

  // Reset Form & Open Modal
  const resetForm = () => {
  setFormData({
    name: '',
    company: defaultCompany || '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    write_off_limit: 1,
    users: [{ user: '', default: false }],
    payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
  });
  setFormErrors({});
  setEditingProfile(null);
};

  const openCreateModal = () => {
  setFormData({
    name: '',
    company: defaultCompany || '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    write_off_limit: 1,
    users: [{ user: '', default: false }],
    payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
  });
  setFormErrors({});
  setEditingProfile(null);
  setIsModalOpen(true);
};

  const openEditModal = async (profile) => {
    setEditingProfile(profile);
    try {
      const res = await fetch(`${API_PATH}.get_pos_profile_detail?name=${profile.name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        const doc = data.message.data;
        setFormData({
          name: doc.name,
          company: doc.company || '',
          warehouse: doc.warehouse || '',
          currency: doc.currency || '',
          write_off_account: doc.write_off_account || '',
          write_off_cost_center: doc.write_off_cost_center || '',
          write_off_limit: doc.write_off_limit || 1,
          users: doc.applicable_for_users?.length > 0
            ? doc.applicable_for_users.map(u => ({ user: u.user, default: !!u.default }))
            : [{ user: '', default: false }],
          payment_methods: doc.payments?.length > 0
            ? doc.payments.map(p => ({
              mode_of_payment: p.mode_of_payment,
              default: !!p.default,
              allow_in_returns: !!p.allow_in_returns
            }))
            : [{ mode_of_payment: '', default: false, allow_in_returns: false }]
        });
      }
    } catch (err) {
      alert("Failed to load profile details");
    }
    setIsModalOpen(true);
  };

  const validateForm = () => {
  const errors = {};

  if (!editingProfile && (!formData.name || formData.name.toString().trim() === '')) {
    errors.name = 'Name is required';
  }
  if (!formData.company) errors.company = 'Company is required';
  if (!formData.warehouse) errors.warehouse = 'Warehouse is required';
  if (!formData.currency) errors.currency = 'Currency is required';
  if (!formData.write_off_account) errors.write_off_account = 'Write Off Account required';
  if (!formData.write_off_cost_center) errors.write_off_cost_center = 'Write Off Cost Center required';
  if (formData.users.filter(u => u.user).length === 0) errors.users = 'At least one user required';
  if (formData.payment_methods.filter(p => p.mode_of_payment).length === 0) errors.payments = 'At least one payment method required';

  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};

  const handleSave = async () => {
  if (!validateForm()) return;
  setSaving(true);

  const isEdit = !!editingProfile;

  // Build payload WITH name always (user-provided Profile Name)
  const payload = {
  doctype: "POS Profile",
  name: formData.name.trim() || undefined,  // Send if user typed, else undefined → backend handles
  company: formData.company || null,
  warehouse: formData.warehouse || null,
  currency: formData.currency || null,
  write_off_account: formData.write_off_account || null,
  write_off_cost_center: formData.write_off_cost_center || null,
  write_off_limit: formData.write_off_limit || 1,
  applicable_for_users: (formData.users || []).filter(u => u.user).map(u => ({ user: u.user, default: u.default ? 1 : 0 })),
  payments: (formData.payment_methods || []).filter(p => p.mode_of_payment).map(p => ({
    mode_of_payment: p.mode_of_payment,
    default: p.default ? 1 : 0,
    allow_in_returns: p.allow_in_returns ? 1 : 0
  }))
};

  // No need for conditional name addition/deletion anymore

  console.log("FINAL PAYLOAD →", payload); // Debug: Now includes name

  try {
    const endpoint = isEdit ? 'update_pos_profile' : 'create_pos_profile';

    const res = await fetch(`${API_PATH}.${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-SID': getSession()
      },
      credentials: 'include',
      body: JSON.stringify({ doc: payload })
    });

    const data = await res.json();

    if (data.message?.success) {
      alert(isEdit ? 'Updated successfully!' : 'Created successfully!');
      setIsModalOpen(false);
      resetForm();
      fetchProfiles();
    } else {
      alert(data.message?.message || 'Operation failed');
      console.error("Error response:", data);
    }
  } catch (err) {
    console.error("Network Error:", err);
    alert('Network error');
  } finally {
    setSaving(false);
  }
};

  // Table row actions
  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const updateTable = (table, idx, field, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      updated[table][idx][field] = value;
      return updated;
    });
  };
  const addRow = (table) => {
    const newRow = table === 'users'
      ? { user: '', default: false }
      : { mode_of_payment: '', default: false, allow_in_returns: false };
    setFormData(prev => ({ ...prev, [table]: [...prev[table], newRow] }));
  };
  const removeRow = (table, idx) => {
    setFormData(prev => ({ ...prev, [table]: prev[table].filter((_, i) => i !== idx) }));
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">POS Profiles</h1>
          <button onClick={openCreateModal} className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create Profile
          </button>
        </div>

        {/* Table */}
        <div className="p-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="6" className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : profiles.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-12 text-gray-500">No profiles found</td></tr>
                ) : (
                  profiles.map(p => (
                    <tr key={p.name} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEditModal(p)}>
                      <td className="px-6 py-4 font-medium text-blue-600">{p.name}</td>
                      <td className="px-6 py-4 text-sm">{p.company}</td>
                      <td className="px-6 py-4 text-sm">{p.warehouse}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.users.slice(0, 3).map(u => (
                            <span key={u.user} className={`px-2 py-1 text-xs rounded-full ${u.default ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                              {u.user.split('@')[0]}
                            </span>
                          ))}
                          {p.users.length > 3 && <span className="text-xs text-gray-500">+{p.users.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.payment_methods.map(pm => (
                            <span key={pm.mode_of_payment} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {pm.mode_of_payment}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${p.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {p.disabled ? 'Disabled' : 'Enabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-white px-6 py-3 flex items-center justify-between border-t">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm">Page {currentPage}</span>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage * pageSize >= total}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal - Create & Edit */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  {editingProfile ? `Edit Profile: ${editingProfile.name}` : 'Create New POS Profile'}
                </h2>
                <div className="flex gap-3">
                  <button onClick={handleSave} disabled={saving}
                    className="bg-black text-white px-6 py-2.5 rounded hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                    {saving ? 'Saving...' : (editingProfile ? 'Update' : 'Save')}
                  </button>
                  <button onClick={() => { setIsModalOpen(false); resetForm(); }}
                    className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="p-6 space-y-8">
                {/* Basic Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Profile Name {editingProfile ? '' : '*'}
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''} 
                      onChange={e => updateField('name', e.target.value)}
                      disabled={!!editingProfile}
                      placeholder="e.g. Main POS"
                      className={`w-full px-4 py-2 border rounded ${editingProfile ? 'bg-gray-100' : ''} ${formErrors.name ? 'border-red-500' : ''}`}
                    />
                    {formErrors.name && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{formErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Company *</label>
                    <select value={formData.company} onChange={e => updateField('company', e.target.value)}
                      className={`w-full px-4 py-2 border rounded ${formErrors.company ? 'border-red-500' : ''}`}>
                      <option value="">Select Company</option>
                      {companiesList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {formErrors.company && <p className="text-red-500 text-xs mt-1">{formErrors.company}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Warehouse *</label>
                    <select value={formData.warehouse} onChange={e => updateField('warehouse', e.target.value)}
                      className={`w-full px-4 py-2 border rounded ${formErrors.warehouse ? 'border-red-500' : ''}`}>
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                    </select>
                    {formErrors.warehouse && <p className="text-red-500 text-xs mt-1">{formErrors.warehouse}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Currency *</label>
                    <select value={formData.currency} onChange={e => updateField('currency', e.target.value)}
                      className={`w-full px-4 py-2 border rounded ${formErrors.currency ? 'border-red-500' : ''}`}>
                      <option value="">Select Currency</option>
                      {currenciesList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {formErrors.currency && <p className="text-red-500 text-xs mt-1">{formErrors.currency}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Write Off Account *</label>
                    <select value={formData.write_off_account} onChange={e => updateField('write_off_account', e.target.value)}
                      className={`w-full px-4 py-2 border rounded ${formErrors.write_off_account ? 'border-red-500' : ''}`}>
                      <option value="">Select Account</option>
                      {accountsList.map(a => <option key={a.name} value={a.name}>{a.account_name}</option>)}
                    </select>
                    {formErrors.write_off_account && <p className="text-red-500 text-xs mt-1">{formErrors.write_off_account}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Write Off Cost Center *</label>
                    <select value={formData.write_off_cost_center} onChange={e => updateField('write_off_cost_center', e.target.value)}
                      className={`w-full px-4 py-2 border rounded ${formErrors.write_off_cost_center ? 'border-red-500' : ''}`}>
                      <option value="">Select Cost Center</option>
                      {costCentersList.map(cc => <option key={cc.name} value={cc.name}>{cc.cost_center_name || cc.name}</option>)}
                    </select>
                    {formErrors.write_off_cost_center && <p className="text-red-500 text-xs mt-1">{formErrors.write_off_cost_center}</p>}
                  </div>
                </div>

                {/* Users Table */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium">Applicable Users *</h3>
                    <button onClick={() => addRow('users')} className="text-sm text-blue-600 hover:underline">+ Add User</button>
                  </div>
                  {formErrors.users && <p className="text-red-500 text-xs mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{formErrors.users}</p>}
                  <div className="border rounded overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs">Default</th>
                          <th className="px-4 py-2 text-left text-xs">User</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.users.map((u, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 text-center">
                              <input type="checkbox" checked={u.default} onChange={e => updateTable('users', i, 'default', e.target.checked)} />
                            </td>
                            <td className="px-4 py-2">
                              <select value={u.user} onChange={e => updateTable('users', i, 'user', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-sm">
                                <option value="">Select User</option>
                                {usersList.map(user => (
                                  <option key={user.name} value={user.name}>{user.email || user.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="text-center">
                              <button onClick={() => removeRow('users', i)} className="text-red-600 hover:text-red-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Methods Table */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-medium">Payment Methods *</h3>
                    <button onClick={() => addRow('payment_methods')} className="text-sm text-blue-600 hover:underline">+ Add Payment</button>
                  </div>
                  {formErrors.payments && <p className="text-red-500 text-xs mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{formErrors.payments}</p>}
                  <div className="border rounded overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs">Default</th>
                          <th className="px-4 py-2 text-left text-xs">Allow Returns</th>
                          <th className="px-4 py-2 text-left text-xs">Mode of Payment</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.payment_methods.map((p, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 text-center">
                              <input type="checkbox" checked={p.default} onChange={e => updateTable('payment_methods', i, 'default', e.target.checked)} />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input type="checkbox" checked={p.allow_in_returns} onChange={e => updateTable('payment_methods', i, 'allow_in_returns', e.target.checked)} />
                            </td>
                            <td className="px-4 py-2">
                              <select value={p.mode_of_payment} onChange={e => updateTable('payment_methods', i, 'mode_of_payment', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-sm">
                                <option value="">Select Payment</option>
                                {modesList.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                              </select>
                            </td>
                            <td className="text-center">
                              <button onClick={() => removeRow('payment_methods', i)} className="text-red-600 hover:text-red-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}