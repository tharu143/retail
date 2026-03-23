// src/Components/Admin/SupplierList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Building2, ChevronLeft,
  Users, AlertCircle, Trash2, Edit2,
  ChevronDown, Palette, Loader2, ChevronRight,
  ShoppingCart, Receipt, CreditCard, Tag, MapPin, Phone, Mail
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ isInactive, themeColor }) => (
  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm" style={{
    backgroundColor: !isInactive ? `${themeColor}15` : '#fee2e2',
    color: !isInactive ? themeColor : '#ef4444',
    border: `1px solid ${!isInactive ? `${themeColor}30` : '#fecaca'}`
  }}>
    {!isInactive ? 'Active' : 'Inactive'}
  </span>
);

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Theme toggle
  const [slTheme, setSlTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = slTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', slTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [slTheme, themeColor, themeColorHover, themeLight]);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingSupplierName, setEditingSupplierName] = useState(null);

  const [form, setForm] = useState({
    supplier_name: '',
    supplier_group: '',
    supplier_type: 'Company',
    disabled: false,
    image: null,
    imagePreview: null,
    tax_id: '',
    website: '',
    email_id: '',
    mobile_no: '',
    address: ''
  });

  const [saving, setSaving] = useState(false);

  // Dashboard states
  const [activeTab, setActiveTab] = useState('Dashboard'); // Dashboard, General, Connections
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [expandedLinks, setExpandedLinks] = useState({});
  const toggleLinkExpansion = (key) => setExpandedLinks(prev => ({ ...prev, [key]: !prev[key] }));

  const [supplierGroups, setSupplierGroups] = useState(['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler']);

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Supplier', {
        params: {
          fields: JSON.stringify(['name', 'supplier_name', 'supplier_group', 'supplier_type', 'disabled', 'image']),
          order_by: 'modified desc',
          limit_page_length: 1000
        },
        withCredentials: true
      });
      setSuppliers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardDetails = async (supplierName) => {
    try {
      setLoadingDashboard(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_supplier_dashboard_details', {
        params: { supplier: supplierName },
        withCredentials: true
      });
      const connRes = await axios.get(`/api/method/kyle_retail.retail_api.api.get_linked_documents?doctype=Supplier&name=${supplierName}`, { withCredentials: true });

      setDashboardData({
        ...(res.data.message || {}),
        connections: connRes.data?.message || null
      });
    } catch (err) {
      console.error('Dashboard Error:', err);
      setDashboardData({});
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchSupplierDetails = async (name) => {
    try {
      const res = await axios.get(`/api/resource/Supplier/${name}`, {
        withCredentials: true
      });
      const data = res.data.data;
      setForm({
        supplier_name: data.supplier_name,
        supplier_group: data.supplier_group,
        supplier_type: data.supplier_type,
        disabled: data.disabled === 1,
        tax_id: data.tax_id || '',
        website: data.website || '',
        email_id: data.email_id || '',
        mobile_no: data.mobile_no || '',
        address: data.address || '',
        image: null,
        imagePreview: data.image
      });
    } catch (err) {
      console.error('Failed to load details:', err);
    }
  };

  /* ==================== FILTERING ==================== */
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = !filterSearch ||
        s.supplier_name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(filterSearch.toLowerCase());
      const matchesGroup = !filterGroup || s.supplier_group === filterGroup;
      const matchesType = !filterType || s.supplier_type === filterType;
      return matchesSearch && matchesGroup && matchesType;
    });
  }, [suppliers, filterSearch, filterGroup, filterType]);

  const total = filteredSuppliers.length;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ==================== ACTIONS ==================== */
  const handleSave = async () => {
    if (!form.supplier_name.trim() || !form.supplier_group) {
      alert('Missing required fields');
      return;
    }

    setSaving(true);
    try {
      const data = {
        supplier_name: form.supplier_name,
        supplier_group: form.supplier_group,
        supplier_type: form.supplier_type,
        disabled: form.disabled ? 1 : 0,
        tax_id: form.tax_id,
        website: form.website,
        email_id: form.email_id,
        mobile_no: form.mobile_no,
        image: form.image || form.imagePreview || ''
      };

      if (isEditMode) {
        await axios.put(`/api/resource/Supplier/${editingSupplierName}`, data, { withCredentials: true });
        alert('Supplier updated!');
      } else {
        await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', { doctype: "Supplier", data }, { withCredentials: true });
        alert('Supplier created!');
      }
      setShowForm(false); resetForm(); fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await axios.delete(`/api/resource/Supplier/${name}`, { withCredentials: true });
      alert('Supplier deleted'); setShowForm(false); fetchSuppliers();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleRowClick = async (supplier) => {
    setIsViewMode(true); setIsEditMode(false); setEditingSupplierName(supplier.name);
    setShowForm(true); setActiveTab('Dashboard');
    await fetchSupplierDetails(supplier.name); fetchDashboardDetails(supplier.name);
  };

  const resetForm = () => {
    setForm({
      supplier_name: '', supplier_group: '', supplier_type: 'Company',
      disabled: false, image: null, imagePreview: null,
      tax_id: '', website: '', email_id: '', mobile_no: '', address: ''
    });
    setIsEditMode(false); setIsViewMode(false); setEditingSupplierName(null);
  };

  const handleCloseForm = () => {
    setShowForm(false); resetForm();
  };

  const clearFilters = () => {
    setFilterSearch(''); setFilterGroup(''); setFilterType(''); setCurrentPage(1);
  };

  /* ==================== RENDER ==================== */
  return (
    <>
      <NavBar />
      <div className="so-page">
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title"><Building2 size={20} /> Suppliers</h1>
            <p className="so-page-subtitle">{total} supplier(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setSlTheme(isGreen ? 'blue' : 'green')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#f8fafc', border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: themeColor, cursor: 'pointer' }}>
              <Palette size={13} /> {slTheme.toUpperCase()}
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="so-btn-primary"><Plus size={16} /> Add Supplier</button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          <div className="so-filter-bar" style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid var(--so-border)', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Search Supplier</label>
              <input type="text" placeholder="Name or ID..." value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1); }} className="so-filter-input" />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Group</label>
              <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }} className="so-filter-input">
                <option value="">All Groups</option>
                {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Type</label>
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} className="so-filter-input">
                <option value="">All Types</option>
                <option value="Company">Company</option>
                <option value="Individual">Individual</option>
              </select>
            </div>
            <button onClick={clearFilters} className="so-clear-btn" style={{ height: '38px', margin: 0 }}>Clear</button>
          </div>

          <div className="so-content" style={{ padding: '2rem' }}>
            {loading ? (
              <div style={{ padding: '8rem 0', textAlign: 'center' }}>
                <Loader2 size={40} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} />
                <p style={{ marginTop: '1.5rem', color: '#64748b', fontWeight: 600 }}>Gathering supplier data...</p>
              </div>
            ) : paginatedSuppliers.length === 0 ? (
              <div style={{ padding: '8rem 0', textAlign: 'center', background: 'white', borderRadius: '1.5rem', border: '2px dashed #e2e8f0' }}>
                <Building2 size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1, color: themeColor }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No suppliers found</h3>
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '1rem', background: 'white', overflow: 'hidden' }}>
                <table className="so-table">
                  <thead><tr><th style={{ padding: '1.25rem 2rem' }}>Supplier Name</th><th>Group</th><th>Type</th><th>Status</th><th style={{ textAlign: 'right', paddingRight: '2rem' }}>ID</th></tr></thead>
                  <tbody>
                    {paginatedSuppliers.map(s => (
                      <tr key={s.name} onClick={() => handleRowClick(s)} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '1.25rem 2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {s.image ? <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={20} style={{ color: '#94a3b8' }} />}
                            </div>
                            <span style={{ fontWeight: 800, color: '#1e293b' }}>{s.supplier_name}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#475569' }}>{s.supplier_group}</td>
                        <td style={{ fontWeight: 600, color: '#475569' }}>{s.supplier_type}</td>
                        <td><StatusBadge isInactive={s.disabled} themeColor={themeColor} /></td>
                        <td style={{ textAlign: 'right', paddingRight: '2rem', fontFamily: 'monospace', color: '#64748b', fontWeight: 700 }}>{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && total > 0 && (
              <div className="so-pagination" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Page {currentPage} of {Math.ceil(total / pageSize)}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="so-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
                  <button className="so-page-btn" disabled={currentPage >= Math.ceil(total / pageSize)} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="so-full-screen-view" style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'soModalIn 0.3s ease-out' }}>
          <div className="so-modal-header" style={{ padding: '1rem 2.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <button onClick={handleCloseForm} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.6rem', borderRadius: '0.75rem' }}><ChevronLeft size={22} /></button>
              <div>
                <h2 className="so-modal-title" style={{ fontSize: '1.4rem', fontWeight: 900 }}>{isViewMode ? form.supplier_name : (isEditMode ? 'Edit Supplier Record' : 'Onboard New Supplier')}</h2>
                {isViewMode && <p style={{ fontSize: '0.75rem', color: themeColor, fontWeight: 800, textTransform: 'uppercase' }}>{editingSupplierName}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleCloseForm} className="so-modal-close" style={{ background: '#fee2e2', color: '#ef4444', borderRadius: '0.75rem', padding: '0.6rem' }}><X size={22} /></button>
            </div>
          </div>

          <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '3.5rem' }}>
            {isViewMode ? (
              <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '3.5rem', borderBottom: '2.5px solid #e2e8f0', marginBottom: '3.5rem', background: 'white', position: 'sticky', top: '-3.5rem', zIndex: 10, padding: '1rem 0' }}>
                  {['Dashboard', 'General', 'Connections'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '1.25rem 2rem', fontWeight: 900, fontSize: '0.95rem', color: activeTab === tab ? themeColor : '#94a3b8', borderBottom: activeTab === tab ? `4px solid ${themeColor}` : '4px solid transparent', background: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '2px' }}>{tab}</button>
                  ))}
                </div>

                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 4rem' }}>
                  {activeTab === 'Dashboard' && (
                    <div style={{ animation: 'fadeIn 0.4s ease' }}>
                      {loadingDashboard ? (
                        <div style={{ padding: '10rem', textAlign: 'center' }}><Loader2 size={48} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} /></div>
                      ) : dashboardData?.connections ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                          {Object.entries(dashboardData.connections).map(([category, links]) => {
                            const rows = [];
                            if (typeof links === 'object' && links !== null) {
                              Object.entries(links).forEach(([k, v]) => {
                                if (Array.isArray(v)) {
                                  rows.push({ label: k, data: v });
                                } else if (typeof v === 'object' && v !== null) {
                                  Object.entries(v).forEach(([k2, v2]) => {
                                    if (Array.isArray(v2)) rows.push({ label: k2, data: v2 });
                                  });
                                }
                              });
                            }

                            if (rows.length === 0) return null;

                            return (
                              <div key={category} className="so-card" style={{ borderRadius: '2rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                <div className="so-card-header" style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderBottom: `4px solid ${themeColor}20` }}>
                                  <p className="so-card-title" style={{ fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', fontSize: '0.85rem', letterSpacing: '1px' }}>{category}</p>
                                </div>
                                <div className="so-card-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  {rows.map((row, idx) => {
                                    const routeMap = {
                                      'Purchase Order': 'purchaseorderlist',
                                      'Purchase Receipt': 'purchasereceiptlist',
                                      'Purchase Invoice': 'purchaseinvoicelist',
                                      'Payment Entry': 'paymententrylist',
                                      'Journal Entry': 'journalentrylist',
                                      'Item Price': 'itempricelist',
                                      'Pricing Rule': 'pricingrulelist',
                                      'Contact': 'contactlist',
                                      'Address': 'addresslist'
                                    };
                                    const routeName = routeMap[row.label] || '';

                                    return (
                                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div onClick={() => { if (routeName) window.location.href = `/#/${routeName}?supplier=${encodeURIComponent(editingSupplierName)}`; }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', background: '#ffffff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: routeName ? 'pointer' : 'default', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = themeColor} onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.9rem' }}>{row.label}</span>
                                            {routeName ? <span style={{ fontSize: '0.7rem', color: themeColor, fontWeight: 700 }}>View List →</span> : <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Unmapped</span>}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ fontWeight: 900, color: 'white', background: themeColor, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1rem', fontSize: '1rem', boxShadow: `0 4px 10px ${themeColor}40` }}>
                                              {row.data.length}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '8rem', textAlign: 'center' }}>No statistics available.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'General' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '4rem', animation: 'fadeIn 0.4s ease' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <div className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                          <div className="so-card-header" style={{ padding: '2rem 3rem' }}><p className="so-card-title">Commercial & Legal Profile</p></div>
                          <div className="so-card-body" style={{ padding: '3rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>SUPPLIER GROUP</label><p style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>{form.supplier_group}</p></div>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>LEGAL TYPE</label><p style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>{form.supplier_type}</p></div>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>TAX ID (TRN)</label><p style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>{form.tax_id || 'NOT REGISTERED'}</p></div>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>ACCOUNT STATUS</label><StatusBadge isInactive={form.disabled} themeColor={themeColor} /></div>
                            </div>
                          </div>
                        </div>
                        <div className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                          <div className="so-card-header" style={{ padding: '2rem 3rem' }}><p className="so-card-title">Communication Identity</p></div>
                          <div className="so-card-body" style={{ padding: '3rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}><Mail size={24} style={{ color: themeColor }} /></div>
                                <div><p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8' }}>OPERATIONAL EMAIL</p><p style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{form.email_id || 'NOT_SPECIFIED'}</p></div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}><Phone size={24} style={{ color: themeColor }} /></div>
                                <div><p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8' }}>DIRECT MOBILE</p><p style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{form.mobile_no || 'NOT_SPECIFIED'}</p></div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #f1f5f9' }}><MapPin size={24} style={{ color: themeColor }} /></div>
                                <div><p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#94a3b8' }}>REGISTERED ADDRESS</p><p style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{form.address || 'LOCAL_OFFICE'}</p></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <div className="so-card" style={{ height: '450px', overflow: 'hidden', borderRadius: '3.5rem', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', border: '8px solid white' }}>
                          {form.imagePreview ? <img src={form.imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><Building2 size={100} style={{ opacity: 0.1 }} /></div>}
                        </div>
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                          <button onClick={() => { setIsViewMode(false); setIsEditMode(true); }} className="so-btn-primary" style={{ height: '5rem', borderRadius: '1.5rem', fontSize: '1.2rem', fontWeight: 900, justifyContent: 'center' }}><Edit2 size={24} /> Edit Partner Profile</button>
                          <button onClick={() => handleDelete(editingSupplierName)} className="so-btn-danger" style={{ height: '5rem', borderRadius: '1.5rem', fontSize: '1.2rem', fontWeight: 900, justifyContent: 'center', background: '#fee2e2' }}><Trash2 size={24} /> Delete Partner</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Connections' && (
                    <div style={{ padding: '10rem', textAlign: 'center', background: 'white', borderRadius: '3rem', border: '3px dashed #e2e8f0' }}>
                      <ShoppingCart size={80} style={{ margin: '0 auto 2rem', opacity: 0.05, color: themeColor }} />
                      <p style={{ fontWeight: 900, color: '#94a3b8', fontSize: '1.5rem' }}>No Active Business Connections Found.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div className="so-card" style={{ borderRadius: '2.5rem', marginBottom: '2.5rem' }}>
                  <div className="so-card-header" style={{ padding: '1.5rem 3rem' }}><p className="so-card-title">Base Specifications</p></div>
                  <div className="so-card-body" style={{ padding: '3rem' }}>
                    <div className="so-form-grid" style={{ gap: '2rem' }}>
                      <div className="so-field"><label className="so-label">Supplier Name *</label><input type="text" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} className="so-input" /></div>
                      <div className="so-field"><label className="so-label">Supplier Group *</label><select value={form.supplier_group} onChange={e => setForm({ ...form, supplier_group: e.target.value })} className="so-input"><option value="">Select Group</option>{supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                      <div className="so-field"><label className="so-label">Entity Type</label><select value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value })} className="so-input"><option value="Company">Company</option><option value="Individual">Individual</option></select></div>
                      <div className="so-field"><label className="so-label">Tax TRN</label><input type="text" value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} className="so-input" /></div>
                    </div>
                  </div>
                </div>
                <div className="so-card" style={{ borderRadius: '2.5rem' }}>
                  <div className="so-card-header" style={{ padding: '1.5rem 3rem' }}><p className="so-card-title">Location & Contact</p></div>
                  <div className="so-card-body" style={{ padding: '3rem' }}>
                    <div className="so-form-grid" style={{ gap: '2rem' }}>
                      <div className="so-field"><label className="so-label">Email</label><input type="email" value={form.email_id} onChange={e => setForm({ ...form, email_id: e.target.value })} className="so-input" /></div>
                      <div className="so-field"><label className="so-label">Mobile</label><input type="text" value={form.mobile_no} onChange={e => setForm({ ...form, mobile_no: e.target.value })} className="so-input" /></div>
                      <div className="so-field" style={{ gridColumn: 'span 2' }}><label className="so-label">Full Address</label><textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="so-input" rows={3} style={{ minHeight: '120px' }} /></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isViewMode && (
            <div className="so-modal-footer" style={{ padding: '2rem 5rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '2rem' }}>
              <button onClick={handleCloseForm} className="so-btn-secondary">Discard</button>
              <button onClick={handleSave} disabled={saving} className="so-btn-primary" style={{ padding: '0 5rem', height: '4rem', fontSize: '1.1rem' }}>
                {saving ? 'Processing...' : (isEditMode ? 'Commit Base Updates' : 'Authorize Partner')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
