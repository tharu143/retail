// src/Components/Admin/SupplierList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Save, Building2, ChevronLeft,
  Users, Trash2, Edit2, ChevronDown,
  Palette, Loader2, ChevronRight, Eye, Mail, Phone,
  Globe, CreditCard, ShieldCheck,
  TrendingUp, Activity, MapPin, Tag
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

/* ==================== UI COMPONENTS ==================== */
const StatusBadge = ({ isInactive, themeColor }) => (
  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${!isInactive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
    {!isInactive ? 'Operational' : 'Restricted'}
  </span>
);

export default function SupplierList() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);


  // Theme Hook
  const { isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);

  // Allow browser scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_group: '',
    supplier_type: 'Company',
    disabled: false,
    tax_id: '',
    website: '',
    email_id: '',
    mobile_no: '',
    address: '',
    contact_person: '',
    currency: 'AED'
  });

  const [supplierGroups] = useState(['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler', 'Retailer']);

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Supplier', {
        params: {
          fields: JSON.stringify(['name', 'supplier_name', 'supplier_group', 'supplier_type', 'disabled', 'email_id', 'mobile_no', 'tax_id']),
          order_by: 'modified desc',
          limit_page_length: 1000
        },
        withCredentials: true
      });
      setSuppliers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      Swal.fire({ icon: 'error', title: 'Connection Failure', text: 'System unable to synchronize with supplier database.', borderRadius: '2rem' });
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const fetchSupplierDetails = async (name) => {
    try {
      const res = await axios.get(`/api/resource/Supplier/${name}`, { withCredentials: true });
      const data = res.data.data;
      setForm({
        supplier_name: data.supplier_name || '',
        supplier_group: data.supplier_group || '',
        supplier_type: data.supplier_type || 'Company',
        disabled: data.disabled === 1,
        tax_id: data.tax_id || '',
        website: data.website || '',
        email_id: data.email_id || '',
        mobile_no: data.mobile_no || '',
        address: data.address || '',
        contact_person: data.contact_person || '',
        currency: data.currency || 'AED'
      });
    } catch (err) {
      console.error('Failed to load details:', err);
    }
  };

  /* ==================== FILTERING ==================== */
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = filterSearch.toLowerCase();
      const matchesSearch = !filterSearch ||
        s.supplier_name?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.email_id?.toLowerCase().includes(q) ||
        s.mobile_no?.includes(filterSearch);

      const matchesGroup = !filterGroup || s.supplier_group === filterGroup;
      const matchesType = !filterType || s.supplier_type === filterType;
      const matchesStatus = !filterStatus || (filterStatus === 'active' ? !s.disabled : s.disabled);

      return matchesSearch && matchesGroup && matchesType && matchesStatus;
    });
  }, [suppliers, filterSearch, filterGroup, filterType, filterStatus]);

  const total = filteredSuppliers.length;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const stats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter(s => !s.disabled).length,
    inactive: suppliers.filter(s => s.disabled).length,
    types: [...new Set(suppliers.map(s => s.supplier_type))].length
  }), [suppliers]);

  /* ==================== ACTIONS ==================== */
  const handleSave = async () => {
    if (!form.supplier_name.trim() || !form.supplier_group) {
      Swal.fire({ icon: 'warning', title: 'Missing Metadata', text: 'Supplier Name and Group are mandatory.' });
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, disabled: form.disabled ? 1 : 0 };
      if (isEditMode) {
        await axios.put(`/api/resource/Supplier/${editingSupplier.name}`, payload, { withCredentials: true });
        Swal.fire({ icon: 'success', title: 'Profile Updated', timer: 2000, showConfirmButton: false });
      } else {
        await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc',
          { doctype: "Supplier", data: payload }, { withCredentials: true }
        );
        Swal.fire({ icon: 'success', title: 'Partner Onboarded', timer: 2000, showConfirmButton: false });
      }
      handleCloseForm();
      fetchSuppliers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Process Rejected', text: err.response?.data?.message || 'Transaction failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    const result = await Swal.fire({
      title: 'De-register Partner?',
      text: `Are you certain you want to purge ${supplier.supplier_name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Execute Removal'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/resource/Supplier/${supplier.name}`, { withCredentials: true });
        Swal.fire({ icon: 'success', title: 'Purged' });
        fetchSuppliers();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Access Denied' });
      }
    }
  };

  const handleEdit = async (supplier) => {
    setEditingSupplier(supplier);
    setIsEditMode(true);
    await fetchSupplierDetails(supplier.name);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setForm({
      supplier_name: '', supplier_group: '', supplier_type: 'Company',
      disabled: false, tax_id: '', website: '', email_id: '', mobile_no: '',
      address: '', contact_person: '', currency: 'AED'
    });
    setIsEditMode(false);
    setEditingSupplier(null);
  };



  return (
    <>
      <div className="so-page" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible' }}>
        {/* Page Header */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Building2 size={20} /> Supplier Directory
            </h1>
            <p className="so-page-subtitle">Authorized Procurement & Vendor Registry</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
            >
              <Palette size={13} />
              {isGreen ? 'BLUE' : 'GREEN'}
            </button>



            <button className="so-btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Register Partner
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="so-filter-bar">
          <div style={{ flex: '1 1 200px' }}>
            <label className="so-filter-label">Search Partner</label>
            <input
              className="so-filter-input"
              type="text"
              placeholder="Name, ID or Contact..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="so-filter-label">Group</label>
            <select className="so-filter-input" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}>
              <option value="">All Groups</option>
              {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="so-filter-label">Entity Type</label>
            <select className="so-filter-input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
              <option value="">All Types</option>
              <option value="Company">Corporate / B2B</option>
              <option value="Individual">Individual / B2C</option>
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="so-filter-label">Status</label>
            <select className="so-filter-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
              <option value="">All Lifecycle States</option>
              <option value="active">Operational Only</option>
              <option value="inactive">Restricted Only</option>
            </select>
          </div>
          <button className="so-clear-btn" style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0 }} onClick={() => {
            setFilterSearch(''); setFilterGroup(''); setFilterType(''); setFilterStatus('');
          }}>Reset</button>
        </div>

        {/* Executive Dashboard */}
        <div style={{ padding: '1.25rem 2rem 0' }}>
          <div className="so-summary-bar">
            <div className="so-summary-item">
              <span className="so-summary-label">Total Assets</span>
              <span className="so-summary-value grand">{stats.total}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Operational</span>
              <span className="so-summary-value" style={{ color: '#059669' }}>{stats.active}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Risk Analysis</span>
              <span className="so-summary-value" style={{ color: '#ef4444' }}>{stats.inactive}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Geo Diversity</span>
              <span className="so-summary-value">{stats.types} Types</span>
            </div>
          </div>
        </div>

        {/* Main Directory Table */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div className="so-table-card">
            <div className="so-table-wrapper" style={{ maxHeight: 'none', overflowY: 'visible' }}>
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Organization Profile</th>
                    <th>Contact Vectors</th>
                    <th>Classification</th>
                    <th>Status</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="so-empty">
                        <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : paginatedSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="so-empty">
                        <Building2 size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                        No partners match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedSuppliers.map((s) => (
                      <tr key={s.name} onClick={() => navigate(`/supplier-details/${encodeURIComponent(s.name)}`)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '0.625rem',
                              background: themeLight, color: themeColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Building2 size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--so-text-heading)', fontSize: '0.85rem' }}>{s.supplier_name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--so-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{s.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {s.email_id && (
                              <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569' }}>
                                <Mail size={12} className="text-slate-400" /> {s.email_id}
                              </div>
                            )}
                            {s.mobile_no && (
                              <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569' }}>
                                <Phone size={12} className="text-slate-400" /> {s.mobile_no}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--so-text-heading)' }}>{s.supplier_type}</div>
                          <div style={{ fontSize: '0.68rem', color: themeColor, textTransform: 'uppercase', fontWeight: 800, marginTop: '0.1rem' }}>{s.supplier_group}</div>
                        </td>
                        <td>
                          <StatusBadge isInactive={s.disabled} themeColor={themeColor} />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                            <button className="so-btn-ghost" onClick={() => navigate(`/supplier-details/${encodeURIComponent(s.name)}`)} title="View Details">
                              <Eye size={15} />
                            </button>
                            <button className="so-btn-ghost" onClick={() => handleEdit(s)} style={{ color: '#d97706' }} title="Edit Record">
                              <Edit2 size={15} />
                            </button>
                            <button className="so-btn-ghost" onClick={() => handleDelete(s)} style={{ color: '#ef4444' }} title="Remove Partner">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Grid */}
            {!loading && total > 0 && (
              <div className="so-pagination" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--so-border)', marginTop: 0 }}>
                <span style={{ fontWeight: 600 }}>Showing {Math.min((currentPage - 1) * pageSize + 1, total)}–{Math.min(currentPage * pageSize, total)} of {total} records</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Page Capacity:</span>
                    <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="so-page-btn" style={{ padding: '0.25rem 0.5rem' }}>
                      {[10, 20, 50, 100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                  </div>
                  <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem' }}>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                    <span style={{ fontWeight: 800, color: themeColor, padding: '0 0.75rem', fontSize: '0.8rem' }}>{currentPage} / {totalPages}</span>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Initialize/Edit Partner Modal */}
      {showForm && (
        <div className="so-modal-overlay">
          <div className="so-modal" style={{ maxWidth: '850px' }}>
            <div className="so-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: themeLight, color: themeColor, borderRadius: '0.5rem' }}>
                  <Building2 size={20} />
                </div>
                <h2 className="so-modal-title">{isEditMode ? 'Authorize Profile Revision' : 'Initialize Global Partner'}</h2>
              </div>
              <button className="so-modal-close" onClick={handleCloseForm}><X size={22} /></button>
            </div>
            <div className="so-modal-body">
              <div className="so-card">
                <div className="so-card-header"><h3 className="so-card-title">Registry Specifications</h3></div>
                <div className="so-card-body">
                  <div className="so-form-grid">
                    <div className="so-field">
                      <label className="so-label">Legal Organization Name *</label>
                      <input className="so-input" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} placeholder="Corporate Title" />
                    </div>
                    <div className="so-field">
                      <label className="so-label">Economic Activity Group *</label>
                      <select className="so-select" value={form.supplier_group} onChange={e => setForm({ ...form, supplier_group: e.target.value })}>
                        <option value="">Functional Cluster</option>
                        {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="so-field">
                      <label className="so-label">Entity Classification</label>
                      <select className="so-select" value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value })}>
                        <option value="Company">Corporate / B2B Venture</option>
                        <option value="Individual">Individual / Proprietorship</option>
                      </select>
                    </div>
                    <div className="so-field">
                      <label className="so-label">Tax Residency (TRN)</label>
                      <input className="so-input" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} placeholder="VAT / TRN Registration" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="so-card">
                <div className="so-card-header"><h3 className="so-card-title">Logistics & Communication</h3></div>
                <div className="so-card-body">
                  <div className="so-form-grid">
                    <div className="so-field">
                      <label className="so-label">Digital Channel (Email)</label>
                      <input className="so-input" type="email" value={form.email_id} onChange={e => setForm({ ...form, email_id: e.target.value })} placeholder="protocol@organization.com" />
                    </div>
                    <div className="so-field">
                      <label className="so-label">Communication Line (Mobile)</label>
                      <input className="so-input" value={form.mobile_no} onChange={e => setForm({ ...form, mobile_no: e.target.value })} placeholder="+000 0000000" />
                    </div>
                    <div className="so-field" style={{ gridColumn: 'span 2' }}>
                      <label className="so-label">Registered Headquarters / Warehouse</label>
                      <textarea className="so-input" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Complete physical logistics vector" style={{ resize: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="so-card">
                <div className="so-card-header"><h3 className="so-card-title">Fiscal Framework</h3></div>
                <div className="so-card-body">
                  <div className="so-form-grid">
                    <div className="so-field">
                      <label className="so-label">Base Currency</label>
                      <select className="so-select" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                        <option value="AED">AED - UAE Dirham</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                      </select>
                    </div>
                    <div className="so-field">
                      <label className="so-label">Lifecycle Protocol</label>
                      <button
                        onClick={() => setForm({ ...form, disabled: !form.disabled })}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${!form.disabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}
                      >
                        {!form.disabled ? 'Operational' : 'Restricted Access'}
                        <div className={`w-2 h-2 rounded-full ml-3 ${!form.disabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="so-modal-footer">
              <button className="so-btn-secondary" onClick={handleCloseForm}>Discard Draft</button>
              <button
                className="so-btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ minWidth: '180px', justifyContent: 'center' }}
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Synchronizing...</>
                ) : (
                  <><Save size={16} /> {isEditMode ? 'Authorize Revision' : 'Confirm Registration'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}