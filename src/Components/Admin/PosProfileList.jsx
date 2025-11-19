// src/pages/PosProfileList.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Building, Warehouse, Users, CreditCard, Search, Filter, ChevronLeft, ChevronRight, X, Check, User, DollarSign, FileText, MapPin, CheckCircle } from 'lucide-react';
import NavBar from '../Nav/NavBar';
import { useNavigate } from 'react-router-dom';

function PosProfileList() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    company: '',
    warehouse: '',
    user: ''
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    // Optional: users and payment_methods as arrays
    users: [{ user: '', default: false }],
    payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
  });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Lists for dropdowns
  const [defaultCompany, setDefaultCompany] = useState('');
  const [companiesList, setCompaniesList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [modesList, setModesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [costCentersList, setCostCentersList] = useState([]);
  const [currenciesList, setCurrenciesList] = useState([]);

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  const getSession = () => localStorage.getItem('session') || '';

  /* ────────────────────── FETCH PROFILES ────────────────────── */
  useEffect(() => {
    fetchProfiles();
  }, [currentPage, pageSize, filters]);

  /* ────────────────────── FETCH DEFAULTS AND LISTS ────────────────────── */
  useEffect(() => {
    fetchDefaults();
  }, []);

  const fetchDefaults = async () => {
    try {
      // Default Company
      const res1 = await fetch(`${API_PATH}.get_default_company`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data1 = await res1.json();
      if (data1.message && data1.message.company) {
        setDefaultCompany(data1.message.company);
      }

      // Companies
      const res2 = await fetch(`${API_PATH}.get_companies`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data2 = await res2.json();
      setCompaniesList(Array.isArray(data2) ? data2 : data2.message || []);

      // Warehouses
      const res3 = await fetch(`${API_PATH}.get_warehouses`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data3 = await res3.json();
      setWarehouses(Array.isArray(data3) ? data3 : data3.message || []);

      // Users
      const res4 = await fetch(`${API_PATH}.get_users`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data4 = await res4.json();
      setUsersList(Array.isArray(data4) ? data4 : data4.message || []);

      // Modes of Payment
      const res5 = await fetch(`${API_PATH}.get_modes_of_payment`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data5 = await res5.json();
      setModesList(Array.isArray(data5) ? data5 : data5.message || []);

      // Currencies
      const res6 = await fetch(`${API_PATH}.get_currencies`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data6 = await res6.json();
      setCurrenciesList(Array.isArray(data6) ? data6 : data6.message || []);
    } catch (err) {
      console.error('Error fetching defaults:', err);
    }
  };

  // Fetch accounts, cost centers, and company default currency based on company
  useEffect(() => {
    if (formData.company) {
      fetchAccountsAndCostCenters(formData.company);
      fetchCompanyCurrency(formData.company);
    } else {
      setAccountsList([]);
      setCostCentersList([]);
      updateFormField('currency', '');
    }
  }, [formData.company]);

  const fetchAccountsAndCostCenters = async (company) => {
    try {
      // Accounts
      const paramsA = new URLSearchParams({ company });
      const resA = await fetch(`${API_PATH}.get_accounts?${paramsA}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const dataA = await resA.json();
      setAccountsList(Array.isArray(dataA) ? dataA : dataA.message || []);

      // Cost Centers
      const paramsC = new URLSearchParams({ company });
      const resC = await fetch(`${API_PATH}.get_cost_centers?${paramsC}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const dataC = await resC.json();
      setCostCentersList(Array.isArray(dataC) ? dataC : dataC.message || []);
    } catch (err) {
      console.error('Error fetching accounts/cost centers:', err);
    }
  };

  const fetchCompanyCurrency = async (company) => {
    try {
      const params = new URLSearchParams({ company });
      const res = await fetch(`${API_PATH}.get_company_default_currency?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.currency) {
        updateFormField('currency', data.message.currency);
      }
    } catch (err) {
      console.error('Error fetching company currency:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize,
        filters: JSON.stringify(filters)
      });
      const res = await fetch(`${API_PATH}.get_pos_profiles?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        setProfiles(data.message.data);
        setTotal(data.message.total);
      } else {
        alert(data.message?.message || 'Failed to load');
      }
    } catch (err) {
      alert('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────── MODAL FORM HANDLERS ────────────────────── */
  const openModal = () => {
    const initialCompany = defaultCompany || (companiesList.length > 0 ? companiesList[0].name : '');
    const initialWarehouse = warehouses.length > 0 ? warehouses[0].name : '';
    setFormData(prev => ({
      ...prev,
      company: initialCompany,
      warehouse: '',
      name: '',
      currency: '',
      write_off_account: '',
      write_off_cost_center: '',
      users: [{ user: '', default: false }],
      payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
    }));
    setIsModalOpen(true);
  };

  const initFormData = {
    name: '',
    company: '',
    warehouse: '',
    currency: '',
    write_off_account: '',
    write_off_cost_center: '',
    users: [{ user: '', default: false }],
    payment_methods: [{ mode_of_payment: '', default: false, allow_in_returns: false }]
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.company.trim()) errors.company = 'Company is required';
    if (!formData.warehouse.trim()) errors.warehouse = 'Warehouse is required';
    if (!formData.currency.trim()) errors.currency = 'Currency is required';
    if (!formData.write_off_account.trim()) errors.write_off_account = 'Write Off Account is required';
    if (!formData.write_off_cost_center.trim()) errors.write_off_cost_center = 'Write Off Cost Center is required';
    // Check payment methods
    const hasValidPayment = formData.payment_methods.some(pm => pm.mode_of_payment.trim());
    if (!hasValidPayment) errors.payment_methods = 'At least one Payment Method is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    const cleanedDoc = {
      doctype: "POS Profile",
      name: formData.name.trim(),
      company: formData.company || null,
      warehouse: formData.warehouse || null,
      currency: formData.currency || null,
      write_off_account: formData.write_off_account || null,
      write_off_cost_center: formData.write_off_cost_center || null,
      write_off_limit: 1,
      disabled: 0,

      applicable_for_users: formData.users
        .filter(row => row.user)
        .map(row => ({
          user: row.user,
          default: row.default ? 1 : 0
        })),

      payments: formData.payment_methods
        .filter(row => row.mode_of_payment)
        .map(row => ({
          mode_of_payment: row.mode_of_payment,
          default: row.default ? 1 : 0,
          allow_in_returns: row.allow_in_returns ? 1 : 0
        }))
    };

    try {
      const res = await fetch(`${API_PATH}.create_pos_profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-SID': getSession()
        },
        credentials: 'include',
        body: JSON.stringify({ doc: cleanedDoc })
      });

      const data = await res.json();
      if (data.message?.success) {
        alert("POS Profile created successfully!");
        setIsModalOpen(false);
        setFormData(initFormData);
        fetchProfiles();
      } else {
        alert(data.message?.message || "Failed to create POS Profile");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  const addUserRow = () => setFormData({ ...formData, users: [...formData.users, { user: '', default: false }] });
  const removeUserRow = (index) => setFormData({ ...formData, users: formData.users.filter((_, i) => i !== index) });

  const addPaymentRow = () => setFormData({ ...formData, payment_methods: [...formData.payment_methods, { mode_of_payment: '', default: false, allow_in_returns: false }] });
  const removePaymentRow = (index) => setFormData({ ...formData, payment_methods: formData.payment_methods.filter((_, i) => i !== index) });

  const updateFormField = (field, value) => setFormData({ ...formData, [field]: value });
  const updateTableField = (table, index, field, value) => {
    const updatedFormData = { ...formData };
    updatedFormData[table][index][field] = value;
    setFormData(updatedFormData);
  };

  /* ────────────────────── PAGINATION ────────────────────── */
  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">POS Profiles</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>List View</span>
            </div>
          </div>
          <button
            onClick={openModal}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Profile</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.company}
                onChange={e => setFilters({ ...filters, company: e.target.value })}
                placeholder="Filter by Company"
                className="w-full pl-10 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <Warehouse className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.warehouse}
                onChange={e => setFilters({ ...filters, warehouse: e.target.value })}
                placeholder="Filter by Warehouse"
                className="w-full pl-10 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.user}
                onChange={e => setFilters({ ...filters, user: e.target.value })}
                placeholder="Filter by User"
                className="w-full pl-10 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <main className="p-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : profiles.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-500">No POS profiles found</td></tr>
                  ) : (
                    profiles.map(p => (
                      <tr
                        key={p.name}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/pos-profile/${p.name}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {p.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Building className="w-4 h-4 text-gray-400" />
                            {p.company}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Warehouse className="w-4 h-4 text-gray-400" />
                            {p.warehouse}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {p.users.slice(0, 3).map(u => (
                              <span
                                key={u.user}
                                className={`px-2 py-1 text-xs rounded-full ${u.default ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                  }`}
                              >
                                {u.user.split('@')[0]}
                              </span>
                            ))}
                            {p.users.length > 3 && (
                              <span className="text-xs text-gray-500">+{p.users.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-1">
                            {p.payment_methods.map(pm => (
                              <span
                                key={pm.mode_of_payment}
                                className={`px-2 py-1 text-xs rounded-full ${pm.default ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                                  }`}
                              >
                                <CreditCard className="w-3 h-3 inline mr-1" />
                                {pm.mode_of_payment}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                            {p.disabled ? 'Disabled' : 'Enabled'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} profiles
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages || 1, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="ml-3 px-3 py-1 border rounded text-sm"
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </main>

        {/* Creation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  New POS Profile
                  <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">Not Saved</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormData(initFormData);
                      setFormErrors({});
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-6">
                {/* Basic Info - Two Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={e => updateFormField('name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.name ? 'border-red-500' : ''}`}
                        placeholder="Enter POS Profile Name"
                      />
                      {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                      <select
                        value={formData.company}
                        onChange={e => updateFormField('company', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.company ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select Company</option>
                        {companiesList.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      {formErrors.company && <p className="text-red-500 text-xs mt-1">{formErrors.company}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse *</label>
                      <select
                        value={formData.warehouse}
                        onChange={e => updateFormField('warehouse', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.warehouse ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select Warehouse</option>
                        {warehouses.map(w => (
                          <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                        ))}
                      </select>
                      {formErrors.warehouse && <p className="text-red-500 text-xs mt-1">{formErrors.warehouse}</p>}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                      <select
                        value={formData.currency}
                        onChange={e => updateFormField('currency', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.currency ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select Currency</option>
                        {currenciesList.map(c => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      {formErrors.currency && <p className="text-red-500 text-xs mt-1">{formErrors.currency}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Write Off Account *</label>
                      <select
                        value={formData.write_off_account}
                        onChange={e => updateFormField('write_off_account', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.write_off_account ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select Write Off Account</option>
                        {accountsList.map(a => (
                          <option key={a.name} value={a.name}>{a.account_name}</option>
                        ))}
                      </select>
                      {formErrors.write_off_account && <p className="text-red-500 text-xs mt-1">{formErrors.write_off_account}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Write Off Cost Center *</label>
                      <select
                        value={formData.write_off_cost_center}
                        onChange={e => updateFormField('write_off_cost_center', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${formErrors.write_off_cost_center ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select Write Off Cost Center</option>
                        {costCentersList.map(cc => (
                          <option key={cc.name} value={cc.name}>{cc.cost_center_name}</option>
                        ))}
                      </select>
                      {formErrors.write_off_cost_center && <p className="text-red-500 text-xs mt-1">{formErrors.write_off_cost_center}</p>}
                    </div>
                  </div>
                </div>

                {/* Applicable for Users Table */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.users.length > 0 && formData.users.some(u => u.user)}
                      onChange={e => {
                        if (e.target.checked) {
                          addUserRow();
                        } else {
                          setFormData({ ...formData, users: [] });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Applicable for Users</span>
                  </label>
                  {formData.users.length > 0 && (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">No.</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Default</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">User</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.users.map((u, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2 text-sm">{index + 1}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={u.default}
                                  onChange={e => updateTableField('users', index, 'default', e.target.checked)}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={u.user}
                                  onChange={e => updateTableField('users', index, 'user', e.target.value)}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                >
                                  <option value="">Select User</option>
                                  {usersList.map(user => (
                                    <option key={user.name} value={user.name}>
                                      {user.email || user.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => removeUserRow(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        onClick={addUserRow}
                        className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        Add Row
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment Methods Table */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods</label>
                  {formErrors.payment_methods && <p className="text-red-500 text-xs">{formErrors.payment_methods}</p>}
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">No.</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Default</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Allow In Returns</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Mode of Payment *</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.payment_methods.map((pm, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2 text-sm">{index + 1}</td>
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={pm.default}
                                onChange={e => updateTableField('payment_methods', index, 'default', e.target.checked)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={pm.allow_in_returns}
                                onChange={e => updateTableField('payment_methods', index, 'allow_in_returns', e.target.checked)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={pm.mode_of_payment}
                                onChange={e => updateTableField('payment_methods', index, 'mode_of_payment', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="">Select Mode of Payment</option>
                                {modesList.map(mode => (
                                  <option key={mode.name} value={mode.name}>
                                    {mode.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => removePaymentRow(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      onClick={addPaymentRow}
                      className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Add Row
                    </button>
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

export default PosProfileList;