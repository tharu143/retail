// src/pages/PosProfileList.jsx
import React, { useState, useEffect } from 'react';
import {
  Plus, Building, Warehouse, Users, CreditCard,
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Trash2, Search, Filter,
  Palette, Loader2
} from 'lucide-react';
import NavBar from '../Nav/NavBar';
import '../Admin/SalesOrder.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const getSession = () => localStorage.getItem('session') || '';

export default function PosProfileList() {
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Theme support (synced)
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

  // Form Data
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
      const res = await fetch(`${API_PATH}.get_pos_profiles`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        const list = data.message.data || [];
        setProfiles(list);
        setFilteredProfiles(list);
        setTotal(list.length);
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
  }, []);

  // Filtering
  useEffect(() => {
    let filtered = profiles;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.company?.toLowerCase().includes(term)
      );
    }
    if (companyFilter) filtered = filtered.filter(p => p.company === companyFilter);
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => (p.disabled ? 'disabled' : 'enabled') === statusFilter);
    }

    setFilteredProfiles(filtered);
    setCurrentPage(1);
  }, [searchTerm, companyFilter, statusFilter, profiles]);

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
      setCompaniesList(comp.message || []);
      setWarehouses(wh.message || []);
      setUsersList(usr.message || []);
      setModesList(mod.message || []);
      setCurrenciesList(cur.message || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load accounts & cost centers
  useEffect(() => {
    if (formData.company) {
      const params = new URLSearchParams({ company: formData.company });
      Promise.all([
        fetch(`${API_PATH}.get_accounts?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_cost_centers?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }),
        fetch(`${API_PATH}.get_company_default_currency?${params}`, { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' })
      ]).then(async ([accRes, ccRes, curRes]) => {
        const [acc, cc, cur] = await Promise.all([accRes.json(), ccRes.json(), curRes.json()]);
        setAccountsList(acc.message || []);
        setCostCentersList(cc.message || []);
        if (cur.message?.currency && !formData.currency) {
          setFormData(prev => ({ ...prev, currency: cur.message.currency }));
        }
      });
    } else {
      setAccountsList([]);
      setCostCentersList([]);
    }
  }, [formData.company]);

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
    resetForm();
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
      alert("Failed to load profile");
    }
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!editingProfile && !formData.name?.trim()) errors.name = 'Name is required';
    if (!formData.company) errors.company = 'Company required';
    if (!formData.warehouse) errors.warehouse = 'Warehouse required';
    if (!formData.currency) errors.currency = 'Currency required';
    if (!formData.write_off_account) errors.write_off_account = 'Write Off Account required';
    if (!formData.write_off_cost_center) errors.write_off_cost_center = 'Cost Center required';
    if (formData.users.filter(u => u.user).length === 0) errors.users = 'At least one user required';
    if (formData.payment_methods.filter(p => p.mode_of_payment).length === 0) errors.payments = 'At least one payment method required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    const payload = {
      doctype: "POS Profile",
      name: formData.name.trim() || undefined,
      company: formData.company,
      warehouse: formData.warehouse,
      currency: formData.currency,
      write_off_account: formData.write_off_account,
      write_off_cost_center: formData.write_off_cost_center,
      write_off_limit: formData.write_off_limit,
      applicable_for_users: formData.users.filter(u => u.user).map(u => ({ user: u.user, default: u.default ? 1 : 0 })),
      payments: formData.payment_methods.filter(p => p.mode_of_payment).map(p => ({
        mode_of_payment: p.mode_of_payment,
        default: p.default ? 1 : 0,
        allow_in_returns: p.allow_in_returns ? 1 : 0
      }))
    };

    try {
      const endpoint = editingProfile ? 'update_pos_profile' : 'create_pos_profile';
      const res = await fetch(`${API_PATH}.${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify({ doc: payload })
      });
      const data = await res.json();

      if (data.message?.success) {
        alert(editingProfile ? 'Updated!' : 'Created!');
        setIsModalOpen(false);
        resetForm();
        fetchProfiles();
      } else {
        alert(data.message?.message || 'Failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

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

  const paginated = filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredProfiles.length / pageSize);

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Header (Matching Customer List) */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <CreditCard size={20} /> POS Profiles
            </h1>
            <p className="so-page-subtitle">{total} profile(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
               onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
               style={{
                 display: 'flex', alignItems: 'center', gap: '0.4rem',
                 padding: '0.45rem 0.9rem', background: '#f8fafc',
                 border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                 fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                 cursor: 'pointer', transition: 'all 0.2s',
                 textTransform: 'uppercase', letterSpacing: '0.04em'
               }}
            >
              <Palette size={13} /> {polTheme.toUpperCase()}
            </button>
            <button className="so-btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Create Profile
            </button>
          </div>
        </div>

        {/* Layout: Full Width Column (No Sidebar) */}
        <div className="so-layout" style={{ flexDirection: 'column' }}>
          
          {/* Top Filter Bar (Full Width) */}
          <div className="so-filter-bar" style={{ 
            background: 'white', 
            padding: '1.25rem 2rem', 
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'flex-end'
          }}>
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Search Profile</label>
              <input 
                type="text" 
                placeholder="Name or company..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="so-filter-input" 
              />
            </div>

            <div style={{ flex: '0 0 200px' }}>
              <label className="so-filter-label">Company</label>
              <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="so-filter-input">
                <option value="">All Companies</option>
                {companiesList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ flex: '0 0 150px' }}>
              <label className="so-filter-label">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="so-filter-input">
                <option value="all">All Status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <button 
              onClick={() => { setSearchTerm(''); setCompanyFilter(''); setStatusFilter('all'); }} 
              className="so-clear-btn"
              style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}
            >
              Reset
            </button>
          </div>

          {/* Main List Area */}
          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{filteredProfiles.length} record(s) found</p>
            
            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th className="w-12 px-6 py-3"><input type="checkbox" /></th>
                      <th>Profile Name</th>
                      <th>Company</th>
                      <th>Branch</th>
                      <th>Users</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="so-empty">
                         <Loader2 size={24} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td></tr>
                    ) : paginated.length === 0 ? (
                      <tr><td colSpan="6" className="so-empty">No POS profiles found</td></tr>
                    ) : (
                      paginated.map(p => (
                        <tr key={p.name} className="cursor-pointer hover:bg-slate-50" onClick={() => openEditModal(p)}>
                          <td className="px-6 py-4" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                          <td className="font-semibold" style={{ color: themeColor }}>{p.name}</td>
                          <td>{p.company}</td>
                          <td>{p.warehouse}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {p.users?.slice(0, 3).map(u => (
                                <span key={u.user} style={{ 
                                  fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                                  background: u.default ? 'var(--so-primary-light)' : '#f1f5f9',
                                  color: u.default ? 'var(--so-primary)' : '#64748b',
                                  fontWeight: 700
                                }}>
                                  {u.user.split('@')[0]}
                                </span>
                              ))}
                              {p.users?.length > 3 && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>+{p.users.length - 3}</span>}
                            </div>
                          </td>
                          <td className="text-center">
                            <span style={{ 
                              fontSize: '0.65rem', padding: '0.2rem 0.75rem', borderRadius: '1rem', fontWeight: 800, textTransform: 'uppercase',
                              background: p.disabled ? '#fee2e2' : 'var(--so-primary-light)',
                              color: p.disabled ? '#ef4444' : 'var(--so-primary)'
                            }}>
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
              {!loading && filteredProfiles.length > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of {filteredProfiles.length}
                  </span>
                  
                  <div className="so-pagination-btns" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                    <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal (Matching Customer List Modal Style) */}
        {isModalOpen && (
          <div className="so-modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
            <div className="so-modal" style={{ maxWidth: '800px' }}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">
                  <CreditCard size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {editingProfile ? `Edit: ${editingProfile.name}` : 'New POS Profile'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   <button className="so-btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Profile'}
                   </button>
                   <button className="so-modal-close" onClick={() => setIsModalOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="so-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Basic Identity</h3>
                      
                      <div>
                        <label className="so-filter-label">Profile Name *</label>
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={e => updateField('name', e.target.value)} 
                          disabled={!!editingProfile}
                          placeholder="Main Counter"
                          className="so-filter-input"
                          style={editingProfile ? { background: '#f8fafc' } : {}}
                        />
                      </div>

                      <div>
                        <label className="so-filter-label">Company *</label>
                        <select value={formData.company} onChange={e => updateField('company', e.target.value)} className="so-filter-input">
                          <option value="">Select...</option>
                          {companiesList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="so-filter-label">Default Branch *</label>
                        <select value={formData.warehouse} onChange={e => updateField('warehouse', e.target.value)} className="so-filter-input">
                          <option value="">Select...</option>
                          {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="so-filter-label">Currency *</label>
                        <select value={formData.currency} onChange={e => updateField('currency', e.target.value)} className="so-filter-input">
                          <option value="">Select...</option>
                          {currenciesList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                   </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Account & Limits</h3>
                      
                      <div>
                        <label className="so-filter-label">Write Off Account *</label>
                        <select value={formData.write_off_account} onChange={e => updateField('write_off_account', e.target.value)} className="so-filter-input">
                          <option value="">Select...</option>
                          {accountsList.map(a => <option key={a.name} value={a.name}>{a.account_name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="so-filter-label">Cost Center *</label>
                        <select value={formData.write_off_cost_center} onChange={e => updateField('write_off_cost_center', e.target.value)} className="so-filter-input">
                          <option value="">Select...</option>
                          {costCentersList.map(cc => <option key={cc.name} value={cc.name}>{cc.cost_center_name || cc.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="so-filter-label">Write Off Limit</label>
                        <input 
                          type="number" 
                          value={formData.write_off_limit} 
                          onChange={e => updateField('write_off_limit', parseFloat(e.target.value) || 0)} 
                          className="so-filter-input" 
                        />
                      </div>
                   </div>
                </div>

                <div style={{ marginTop: '2rem' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Assigned Operators</h3>
                      <button className="so-clear-btn" style={{ margin: 0, padding: '0.2rem 1rem' }} onClick={() => addRow('users')}>+ User</button>
                   </div>
                   <div className="so-table-wrapper" style={{ maxHeight: '150px', border: '1px solid #f1f5f9', borderRadius: '0.5rem' }}>
                      <table className="so-table text-xs">
                         <thead className="bg-[#f8fafc]">
                            <tr>
                               <th style={{ width: '80px' }}>Default</th>
                               <th>User Email</th>
                               <th style={{ width: '50px' }}></th>
                            </tr>
                         </thead>
                         <tbody>
                            {formData.users.map((u, i) => (
                              <tr key={i}>
                                 <td className="text-center">
                                    <input type="checkbox" checked={u.default} onChange={e => updateTable('users', i, 'default', e.target.checked)} />
                                 </td>
                                 <td>
                                    <select value={u.user} onChange={e => updateTable('users', i, 'user', e.target.value)} className="so-filter-input" style={{ padding: '0.25rem' }}>
                                       <option value="">Select User...</option>
                                       {usersList.map(usr => <option key={usr.name} value={usr.name}>{usr.email || usr.name}</option>)}
                                    </select>
                                 </td>
                                 <td className="text-center">
                                    <button onClick={() => removeRow('users', i)} style={{ color: '#ef4444' }}><Trash2 size={12} /></button>
                                 </td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                <div style={{ marginTop: '2rem' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>Payment Gateways</h3>
                      <button className="so-clear-btn" style={{ margin: 0, padding: '0.2rem 1rem' }} onClick={() => addRow('payment_methods')}>+ Method</button>
                   </div>
                   <div className="so-table-wrapper" style={{ maxHeight: '200px', border: '1px solid #f1f5f9', borderRadius: '0.5rem' }}>
                      <table className="so-table text-xs">
                         <thead className="bg-[#f8fafc]">
                            <tr>
                               <th style={{ width: '80px' }}>Default</th>
                               <th style={{ width: '80px' }}>Return</th>
                               <th>Mode of Payment</th>
                               <th style={{ width: '50px' }}></th>
                            </tr>
                         </thead>
                         <tbody>
                            {formData.payment_methods.map((p, i) => (
                              <tr key={i}>
                                 <td className="text-center">
                                    <input type="checkbox" checked={p.default} onChange={e => updateTable('payment_methods', i, 'default', e.target.checked)} />
                                 </td>
                                 <td className="text-center">
                                    <input type="checkbox" checked={p.allow_in_returns} onChange={e => updateTable('payment_methods', i, 'allow_in_returns', e.target.checked)} />
                                 </td>
                                 <td>
                                    <select value={p.mode_of_payment} onChange={e => updateTable('payment_methods', i, 'mode_of_payment', e.target.value)} className="so-filter-input" style={{ padding: '0.25rem' }}>
                                       <option value="">Select Gateway...</option>
                                       {modesList.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                    </select>
                                 </td>
                                 <td className="text-center">
                                    <button onClick={() => removeRow('payment_methods', i)} style={{ color: '#ef4444' }}><Trash2 size={12} /></button>
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