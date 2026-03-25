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
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
    navigate(`/supplier-details/${encodeURIComponent(supplier.name)}`);
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
        <div className="fixed inset-0 bg-gray-50/95 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 lg:p-12">
          <div className="bg-white w-full max-w-5xl h-full lg:h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white">
            
            {/* Modal Header */}
            <div className="px-10 py-8 flex justify-between items-center border-b border-gray-50 shrink-0">
               <div className="flex items-center gap-6">
                  <button onClick={handleCloseForm} className="p-3 hover:bg-gray-50 rounded-2xl text-gray-400 transition-colors">
                    <ChevronLeft size={24} />
                  </button>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                    {isEditMode ? 'Modify Partner Profile' : 'Onboard New Supplier'}
                  </h2>
               </div>
               <button onClick={handleCloseForm} className="p-3 hover:bg-gray-50 rounded-2xl text-gray-400 transition-colors">
                  <X size={24} />
               </button>
            </div>

            {/* Modal Scroll Body */}
            <div className="flex-1 overflow-y-auto p-10 bg-gray-50/50">
               <div className="max-w-4xl mx-auto space-y-8 pb-12">
                  
                  {/* Card 1: Base Specs */}
                  <div className="bg-white p-10 rounded-[2rem] border border-white shadow-sm space-y-8">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                      <div className="w-2 h-6 bg-blue-600 rounded-full" />
                      Base Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Supplier Name *</label>
                        <input 
                          type="text" 
                          value={form.supplier_name} 
                          onChange={e => setForm({...form, supplier_name: e.target.value})}
                          placeholder="Enter legal entity name"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Supplier Group *</label>
                        <select 
                          value={form.supplier_group} 
                          onChange={e => setForm({...form, supplier_group: e.target.value})}
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all cursor-pointer"
                        >
                          <option value="">Select Category</option>
                          {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Entity Type</label>
                        <div className="flex items-center gap-8">
                          {['Company', 'Individual'].map(type => (
                            <label key={type} className="flex items-center gap-3 cursor-pointer group">
                              <div className="relative flex items-center justify-center">
                                <input 
                                  type="radio" 
                                  name="supplier_type" 
                                  value={type}
                                  checked={form.supplier_type === type}
                                  onChange={e => setForm({...form, supplier_type: e.target.value})}
                                  className="peer appearance-none w-6 h-6 border-2 border-gray-200 rounded-full checked:border-blue-600 transition-all"
                                />
                                <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full opacity-0 peer-checked:opacity-100 transition-all" />
                              </div>
                              <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Tax TRN</label>
                        <input 
                          type="text" 
                          value={form.tax_id} 
                          onChange={e => setForm({...form, tax_id: e.target.value})}
                          placeholder="Registration number"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Contact Info */}
                  <div className="bg-white p-10 rounded-[2rem] border border-white shadow-sm space-y-8">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                      <div className="w-2 h-6 bg-blue-600 rounded-full" />
                      Location & Contact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Operational Email</label>
                        <input 
                          type="email" 
                          value={form.email_id} 
                          onChange={e => setForm({...form, email_id: e.target.value})}
                          placeholder="support@partner.com"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Direct Mobile</label>
                        <input 
                          type="text" 
                          value={form.mobile_no} 
                          onChange={e => setForm({...form, mobile_no: e.target.value})}
                          placeholder="+X XXX XXX XXXX"
                          className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Full Registered Address</label>
                        <textarea 
                          rows={3}
                          value={form.address} 
                          onChange={e => setForm({...form, address: e.target.value})}
                          placeholder="Building, Street, Landmark, Country"
                          className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] font-bold text-gray-800 text-sm focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>

               </div>
            </div>

            {/* Modal Footer */}
            <div className="px-10 py-8 border-t border-gray-50 flex justify-end items-center gap-5 shrink-0 bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
               <button 
                  onClick={handleCloseForm} 
                  className="px-8 py-3.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors"
                >
                  Discard
               </button>
               <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] flex items-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.2)] hover:shadow-[0_15px_40px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Synchronizing...' : (isEditMode ? 'Authorize Updates' : 'Authorize Partner')}
               </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}