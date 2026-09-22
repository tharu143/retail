import PageHeader from '../UI/PageHeader';
// src/Components/Admin/SupplierList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Building2, ChevronLeft, ChevronRight,
  Edit2, Trash2, Eye, Mail, Phone, Globe, Calendar, Filter,
  MoreHorizontal, Loader2, RotateCcw, Palette
} from 'lucide-react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Swal from 'sweetalert2';
import './SupplierList.css';
import SupplierFormModal from './SupplierFormModal';
import ListCustomizer from './ListCustomizer';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

/* ==================== STATUS BADGE COMPONENT ==================== */
const StatusBadge = ({ supplier }) => {
  if (supplier.disabled || supplier.is_frozen) {
    return <span className="erp-status supplier-status-badge frozen">FROZEN</span>;
  }
  if (supplier.on_hold || supplier.status === 'Restricted' || supplier.supplier_type === 'Individual') {
    return <span className="erp-status supplier-status-badge restricted">RESTRICTED</span>;
  }
  return <span className="erp-status supplier-status-badge operational">OPERATIONAL</span>;
};

export default function SupplierList() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.user.user);
  const user_roles = useSelector((state) => state.user.user_roles || []);
  const warehouse = useSelector((state) => state.user.warehouse);
  const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");

  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Supplier');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterSearch, setFilterSearch] = useState(location.state?.search || '');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dropdown action menu
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  // Theme Hook
  const { themeColor, isGreen, toggleTheme } = useLegacyTheme();

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Global Sync Modal States
  const [showGlobalSyncModal, setShowGlobalSyncModal] = useState(false);
  const [globalSyncSearch, setGlobalSyncSearch] = useState('');
  const [globalSuppliers, setGlobalSuppliers] = useState([]);
  const [selectedGlobalSuppliers, setSelectedGlobalSuppliers] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [syncingGlobal, setSyncingGlobal] = useState(false);

  const supplierGroups = ['Distributor', 'Manufacturer', 'Service Provider', 'Wholesaler', 'Retailer', 'Local'];

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchSuppliers();
  }, [customColumns]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_suppliers_list', {
        params: {
          warehouse: warehouse,
          limit: 1000,
          extra_fields: JSON.stringify(customColumns)
        },
        withCredentials: true
      });
      setSuppliers(Array.isArray(res.data.message?.data) ? res.data.message.data : []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      Swal.fire({ icon: 'error', title: 'Connection Failure', text: 'System unable to synchronize with supplier database.' });
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  /* ==================== FILTERING & STATS ==================== */
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = filterSearch.toLowerCase();
      const matchesSearch = !filterSearch ||
        s.supplier_name?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.email_id?.toLowerCase().includes(q) ||
        s.mobile_no?.includes(filterSearch);

      const matchesGroup = !filterGroup || s.supplier_group?.toLowerCase() === filterGroup.toLowerCase();
      const matchesType = !filterType || s.supplier_type?.toLowerCase() === filterType.toLowerCase();

      let matchesStatus = true;
      if (filterStatus === 'active') {
        matchesStatus = !s.disabled && !s.is_frozen && !s.on_hold;
      } else if (filterStatus === 'inactive') {
        matchesStatus = s.disabled || s.is_frozen || s.on_hold || s.supplier_type === 'Individual';
      }

      return matchesSearch && matchesGroup && matchesType && matchesStatus;
    });
  }, [suppliers, filterSearch, filterGroup, filterType, filterStatus]);

  const total = filteredSuppliers.length;
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter(s => !s.disabled && !s.is_frozen && !s.on_hold && s.supplier_type !== 'Individual').length,
    inactive: suppliers.filter(s => s.disabled || s.is_frozen || s.on_hold || s.supplier_type === 'Individual').length,
    types: [...new Set(suppliers.map(s => s.supplier_type).filter(Boolean))].length || 2
  }), [suppliers]);

  /* ==================== GLOBAL SYNC ==================== */
  const openGlobalSyncModal = () => {
    setGlobalSyncSearch(filterSearch || '');
    setGlobalSuppliers([]);
    setSelectedGlobalSuppliers([]);
    setShowGlobalSyncModal(true);
    if (filterSearch) {
      setTimeout(() => runGlobalSearch(filterSearch), 100);
    }
  };

  const runGlobalSearch = async (searchTermOverride) => {
    const q = searchTermOverride !== undefined ? searchTermOverride : globalSyncSearch;
    if (!q.trim()) return Swal.fire('Search', 'Please enter a name or code to discover.', 'info');

    setSearchingGlobal(true);
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.find_supplier_globally_retail', {
        params: { search_term: q },
        withCredentials: true
      });
      const results = res.data.message?.data || [];
      setGlobalSuppliers(results);
      setSelectedGlobalSuppliers([]);
    } catch (err) {
      console.error('Global search failed:', err);
      Swal.fire('Search Failed', 'Unable to reach global registry.', 'error');
    } finally {
      setSearchingGlobal(false);
    }
  };

  const handleBulkSync = async () => {
    if (selectedGlobalSuppliers.length === 0) return;
    setSyncingGlobal(true);
    try {
      Swal.fire({ title: 'Synchronizing Partners...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.bulk_enable_suppliers_for_branch', {
        suppliers: JSON.stringify(selectedGlobalSuppliers),
        warehouse: warehouse
      }, { withCredentials: true });

      if (res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Sync Completed', text: 'All selected suppliers are now active for your branch.', timer: 2000 });
        setShowGlobalSyncModal(false);
        fetchSuppliers();
      } else {
        Swal.fire('Error', res.data.message?.message || 'Sync failed.', 'error');
      }
    } catch (err) {
      console.error('Bulk sync failed:', err);
      Swal.fire('Sync Error', err.response?.data?.message || 'Connection failure.', 'error');
    } finally {
      setSyncingGlobal(false);
    }
  };

  /* ==================== ACTIONS ==================== */
  const handleDelete = async (supplier) => {
    setActiveDropdown(null);
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

  const handleEdit = (supplier) => {
    setActiveDropdown(null);
    navigate(`/supplier-edit/${encodeURIComponent(supplier.name)}`);
  };

  const handleViewDetails = (supplier) => {
    setActiveDropdown(null);
    navigate(`/supplier-details/${encodeURIComponent(supplier.name)}`);
  };

  return (
    <div className="erp-page supplier-list-page">
      {/* 1. Top Sub-Tabs */}
      <div className="supplier-top-tabs-bar">
        <button className="supplier-tab-btn active">Supplier</button>
        <button className="supplier-tab-btn" onClick={() => navigate('/purchasereport')}>Reports</button>
      </div>

      {/* 2. Main Header */}
      <PageHeader className="supplier-header-container">
        <div className="supplier-title-group">
          <h1>SUPPLIER MANAGEMENT</h1>
          <p>Manage procurement and vendor records</p>
        </div>
        <div className="supplier-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              background: '#ffffff',
              color: themeColor || '#0082f6',
              border: `1.5px solid ${themeColor || '#0082f6'}`,
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease-in-out',
              boxSizing: 'border-box'
            }}
          >
            <Palette size={14} />
            <span>{isGreen ? 'BLUE' : 'GREEN'}</span>
          </button>
          <ListCustomizer
            doctype="Supplier"
            onSave={cols => setCustomColumns(cols)}
            themeColor={themeColor || '#0082f6'}
            btnStyle={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              background: '#ffffff',
              color: themeColor || '#0082f6',
              border: `1.5px solid ${themeColor || '#0082f6'}`,
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease-in-out',
              boxSizing: 'border-box'
            }}
          />
          <button className="erp-button erp-button-primary supplier-btn-create" onClick={() => navigate('/supplier-edit/new')}>
            <Plus size={16} />
            <span>CREATE SUPPLIER</span>
          </button>
        </div>
      </PageHeader>

      {/* 3. Filter Bar */}
      <div className="erp-filter-bar supplier-filter-bar">
        <div className="supplier-filter-group" style={{ flex: '1 1 320px' }}>
          <label className="supplier-filter-label">Search Supplier</label>
          <div className="supplier-search-wrapper">
            <div className="supplier-search-input-box">
              <Search className="supplier-search-icon" />
              <input
                type="text"
                className="supplier-search-input"
                placeholder="Name, ID or Contact..."
                value={filterSearch}
                onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button className="supplier-btn-global-sync" onClick={openGlobalSyncModal}>
              <Globe size={14} />
              <span>GLOBAL SYNC</span>
            </button>
          </div>
        </div>

        <div className="supplier-filter-group" style={{ flex: '1 1 160px' }}>
          <label className="supplier-filter-label">Group</label>
          <select className="supplier-select-input" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}>
            <option value="">All Groups</option>
            {supplierGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="supplier-filter-group" style={{ flex: '1 1 160px' }}>
          <label className="supplier-filter-label">Entity Type</label>
          <select className="supplier-select-input" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
            <option value="">All Types</option>
            <option value="Company">Company</option>
            <option value="Individual">Individual</option>
          </select>
        </div>

        <div className="supplier-filter-group" style={{ flex: '1 1 160px' }}>
          <label className="supplier-filter-label">Status</label>
          <select className="supplier-select-input" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
            <option value="">All Lifecycle States</option>
            <option value="active">Operational Only</option>
            <option value="inactive">Restricted Only</option>
          </select>
        </div>

        <button className="supplier-btn-reset" onClick={() => {
          setFilterSearch(''); setFilterGroup(''); setFilterType(''); setFilterStatus(''); setCurrentPage(1);
        }}>
          Reset
        </button>
      </div>

      {/* 4. Stats Summary Cards */}
      <div className="supplier-stats-card">
        <div className="supplier-stat-item">
          <span className="supplier-stat-label">TOTAL SUPPLIERS</span>
          <span className="supplier-stat-value total">{stats.total}</span>
        </div>
        <div className="supplier-stat-item">
          <span className="supplier-stat-label">ACTIVE</span>
          <span className="supplier-stat-value active">{stats.active}</span>
        </div>
        <div className="supplier-stat-item">
          <span className="supplier-stat-label">ON HOLD / FROZEN</span>
          <span className="supplier-stat-value frozen">{stats.inactive}</span>
        </div>
        <div className="supplier-stat-item">
          <span className="supplier-stat-label">CATEGORIES</span>
          <span className="supplier-stat-value types">{stats.types} Types</span>
        </div>
      </div>

      {/* 5. Main Directory Table */}
      <div className="erp-table-card supplier-table-card">
        <div className="erp-table-scroll supplier-table-wrapper">
          <table className="erp-table supplier-directory-table">
            <thead>
              <tr>
                <th>Organization Profile</th>
                <th>Contact Vectors</th>
                <th>Classification</th>
                {customColumns.map(col => (
                  <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                ))}
                <th>Status</th>
                <th style={{ width: '60px', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5 + customColumns.length} style={{ textAlign: 'center', padding: '40px' }}>
                    <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: '#0284c7' }} />
                  </td>
                </tr>
              ) : paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5 + customColumns.length} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <Building2 size={36} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No suppliers match the current filter criteria.</p>
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((s) => (
                  <tr
                    key={s.name}
                    className="supplier-table-row"
                    onClick={() => handleViewDetails(s)}
                  >
                    {/* Organization Profile */}
                    <td>
                      <div className="supplier-profile-cell">
                        <div className="supplier-profile-icon-box">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div className="supplier-profile-name">{s.supplier_name}</div>
                          <div className="supplier-profile-subtext">
                            {s.description || s.supplier_name || 'Manage procurement and vendor records'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact Vectors */}
                    <td>
                      <div className="supplier-contact-cell">
                        <div className="supplier-contact-item">
                          <Mail className="supplier-contact-icon" />
                          <span>{s.email_id || s.contact_details?.email_id || 'jkahmkv@gmail.com'}</span>
                        </div>
                        <div className="supplier-contact-item">
                          <Phone className="supplier-contact-icon" />
                          <span>{s.mobile_no || s.contact_details?.mobile_no || '+91 778542569'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Classification */}
                    <td>
                      <div className="supplier-classification-cell">
                        <span className="supplier-classification-type">{s.supplier_type || 'Company'}</span>
                        <span className="supplier-classification-group">
                          {(s.supplier_group || 'DISTRIBUTOR').toUpperCase()}
                        </span>
                      </div>
                    </td>

                    {/* Custom Columns */}
                    {customColumns.map(col => (
                      <td key={col} style={{ fontSize: '13px', fontWeight: 600 }}>
                        {s[col] !== undefined && s[col] !== null ? String(s[col]) : '-'}
                      </td>
                    ))}

                    {/* Status */}
                    <td>
                      <StatusBadge supplier={s} />
                    </td>

                    {/* Actions Menu */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="supplier-action-menu-container">
                        <button
                          className="supplier-action-btn"
                          onClick={() => setActiveDropdown(activeDropdown === s.name ? null : s.name)}
                          title="Actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {activeDropdown === s.name && (
                          <div className="supplier-action-dropdown" ref={dropdownRef}>
                            <button className="supplier-dropdown-item" onClick={() => handleViewDetails(s)}>
                              <Eye size={14} /> View Details
                            </button>
                            <button className="supplier-dropdown-item" onClick={() => handleEdit(s)}>
                              <Edit2 size={14} /> Edit Record
                            </button>
                            <button className="supplier-dropdown-item danger" onClick={() => handleDelete(s)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Table Footer / Pagination */}
        {!loading && total > 0 && (
          <div className="supplier-pagination-bar">
            <div>
              Showing {Math.min((currentPage - 1) * pageSize + 1, total)}–{Math.min(currentPage * pageSize, total)} of {total} records
            </div>
            <div className="supplier-pagination-right">
              <div className="supplier-capacity-group">
                <span className="supplier-capacity-label">PAGE CAPACITY:</span>
                <select
                  className="supplier-capacity-select"
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="supplier-page-nav">
                <button
                  className="supplier-nav-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="supplier-page-counter">
                  {currentPage}/{totalPages}
                </span>
                <button
                  className="supplier-nav-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Modal Form */}
      <SupplierFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={() => {
          fetchSuppliers();
          setShowForm(false);
        }}
        editingSupplier={editingSupplier}
        userWarehouse={warehouse}
      />

      {/* ────────────────────── GLOBAL SYNC MODAL ────────────────────── */}
      {showGlobalSyncModal && (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fadeIn p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] text-left">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 flex items-center justify-between" style={{ padding: '1.25rem 1.75rem' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-50 text-[#0369a1]">
                  <Globe size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">Global Discovery Wizard</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Sync Suppliers across branches</p>
                </div>
              </div>
              <button
                onClick={() => setShowGlobalSyncModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '1.75rem', gap: '1.25rem' }}>
              <div className="flex shrink-0" style={{ gap: '0.75rem' }}>
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, code, or contact globally..."
                    value={globalSyncSearch}
                    onChange={e => setGlobalSyncSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runGlobalSearch()}
                    className="w-full border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-sky-500 transition-all bg-slate-50/50"
                    style={{ height: '2.75rem', paddingLeft: '3rem', paddingRight: '1rem' }}
                  />
                </div>
                <button
                  onClick={() => runGlobalSearch()}
                  disabled={searchingGlobal}
                  className="px-6 text-xs font-bold uppercase tracking-wider text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-all flex items-center gap-2 shadow-md cursor-pointer"
                  style={{ height: '2.75rem' }}
                >
                  {searchingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Discover
                </button>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30 flex-1 min-h-[250px] flex flex-col">
                {searchingGlobal ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                    <Loader2 size={24} className="animate-spin text-[#0369a1]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Searching Global Registries...</span>
                  </div>
                ) : globalSuppliers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-3">
                    <Building2 size={36} className="text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">No Discovered Records</p>
                      <p className="text-[10px] text-slate-400 font-medium">Type a supplier name above and click Discover</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[350px] divide-y divide-slate-100 bg-white">
                    <div className="bg-slate-50/50 flex items-center justify-between" style={{ padding: '0.75rem 1.25rem' }}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGlobalSuppliers.length === globalSuppliers.filter(s => !s.active_branches || !s.active_branches.includes(warehouse)).length && globalSuppliers.filter(s => !s.active_branches || !s.active_branches.includes(warehouse)).length > 0}
                          onChange={(e) => {
                            const unlinked = globalSuppliers.filter(s => !s.active_branches || !s.active_branches.includes(warehouse));
                            if (e.target.checked) {
                              setSelectedGlobalSuppliers(unlinked.map(s => s.name));
                            } else {
                              setSelectedGlobalSuppliers([]);
                            }
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4"
                        />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select All Unlinked</span>
                      </label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {selectedGlobalSuppliers.length} Selected
                      </span>
                    </div>

                    {globalSuppliers.map((s, i) => {
                      const isLinked = s.active_branches && s.active_branches.includes(warehouse);
                      return (
                        <div key={i} className={`flex items-center justify-between hover:bg-slate-50/50 transition-colors ${isLinked ? 'opacity-60 bg-slate-50/20' : ''}`} style={{ padding: '0.875rem 1.25rem' }}>
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              disabled={isLinked}
                              checked={selectedGlobalSuppliers.includes(s.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGlobalSuppliers(prev => [...prev, s.name]);
                                } else {
                                  setSelectedGlobalSuppliers(prev => prev.filter(name => name !== s.name));
                                }
                              }}
                              className="rounded border-slate-300 text-sky-600 focus:ring-0 w-4 h-4 disabled:opacity-50"
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-[13px] text-slate-700">{s.supplier_name}</span>
                              <span className="text-[10px] text-slate-400 font-medium font-mono">{s.name} • {s.supplier_group}</span>
                            </div>
                          </label>
                          <div className="flex items-center gap-2">
                            {isLinked ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">Already Linked</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-600 border border-sky-100 uppercase tracking-wider">Ready to Sync</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0" style={{ padding: '1rem 1.75rem' }}>
              <button
                onClick={() => setShowGlobalSyncModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-rose-500 transition-all rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSync}
                disabled={syncingGlobal || selectedGlobalSuppliers.length === 0}
                className="px-6 py-2.5 text-white bg-sky-600 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:scale-100 cursor-pointer"
              >
                {syncingGlobal ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {syncingGlobal ? 'Syncing...' : `Sync ${selectedGlobalSuppliers.length} Selected`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}