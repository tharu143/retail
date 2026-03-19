import React, { useState, useEffect } from 'react';
import {
  Plus, ChevronDown, Search, Save, X, Loader2, Filter, MoreVertical, Edit2, Trash2, Palette, Building2
} from 'lucide-react';
import NavBar from '../Nav/NavBar';
import '../Admin/SalesOrder.css';

function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState('');
  const [form, setForm] = useState({
    supplier_name: '',
    supplier_type: 'Company',
    supplier_primary_address: '',
    supplier_primary_contact: ''
  });
  const [saving, setSaving] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());
  const [showActionsDropdown, setShowActionsDropdown] = useState(null);

  // Theme toggle (synced across pages)
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

  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    fetchSuppliers();
  }, [currentPage, pageSize, filterName]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const start = (currentPage - 1) * pageSize;
      const params = new URLSearchParams({
        start: start.toString(),
        page_size: pageSize.toString(),
        ...(filterName && { search: filterName })
      });

      const res = await fetch(`${API_PATH}.get_suppliers?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const { suppliers: rawSuppliers, total: totalCount } = data.message || { suppliers: [], total: 0 };

      setSuppliers(rawSuppliers.map(s => ({
        value: s.name,
        label: s.supplier_name || s.name
      })));
      setTotal(totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierForEdit = async (name) => {
    try {
      const res = await fetch(`${API_PATH}.get_supplier?name=${name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const msg = data.message;
      if (msg.status === 'success') {
        setForm({
          supplier_name: msg.supplier_name,
          supplier_type: msg.supplier_type,
          supplier_primary_address: msg.primary_address ? `${msg.primary_address.address_line1}, ${msg.primary_address.city}` : '',
          supplier_primary_contact: msg.primary_contact ? (msg.primary_contact.email_id || msg.primary_contact.phone || '') : ''
        });
        setEditingSupplierId(name);
        setIsEditMode(true);
        setShowForm(true);
      } else {
        alert(msg.message || 'Failed to load supplier');
      }
    } catch (err) {
      alert('Failed to load supplier');
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      alert('Supplier Name is required.');
      return;
    }

    setSaving(true);
    try {
      let res;
      if (isEditMode) {
        res = await fetch(`${API_PATH}.update_supplier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
          credentials: 'include',
          body: JSON.stringify({ name: editingSupplierId, ...form })
        });
      } else {
        res = await fetch(`${API_PATH}.create_supplier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
          credentials: 'include',
          body: JSON.stringify(form)
        });
      }

      const result = await res.json();

      if (result.message?.status === 'success') {
        setShowForm(false);
        setIsEditMode(false);
        setEditingSupplierId('');
        setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' });
        setCurrentPage(1);
        setFilterName('');
        await fetchSuppliers();
      } else {
        alert(result.message?.message || (isEditMode ? 'Failed to update supplier' : 'Failed to create supplier'));
      }
    } catch (err) {
      alert(isEditMode ? 'Failed to update supplier' : 'Failed to create supplier');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (namesToDelete = null) => {
    const names = namesToDelete || Array.from(selectedSuppliers);
    if (names.length === 0) { alert('No supplier selected.'); return; }
    if (!confirm(`Delete ${names.length} supplier(s)? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_PATH}.delete_supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify({ names })
      });
      const result = await res.json();
      if (result.message?.status === 'success') {
        setSelectedSuppliers(new Set());
        if (currentPage > 1 && suppliers.length <= names.length) setCurrentPage(currentPage - 1);
        await fetchSuppliers();
      } else {
        alert(result.message?.message || 'Failed to delete supplier(s)');
      }
    } catch (err) {
      alert('Failed to delete supplier(s)');
      console.error(err);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedSuppliers(new Set(suppliers.map(s => s.value)));
    } else {
      setSelectedSuppliers(new Set());
    }
  };

  const handleSelectSupplier = (value) => {
    const newSelected = new Set(selectedSuppliers);
    if (newSelected.has(value)) { newSelected.delete(value); } else { newSelected.add(value); }
    setSelectedSuppliers(newSelected);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedSuppliers(new Set());
  };

  const toggleActions = (value) => {
    setShowActionsDropdown(showActionsDropdown === value ? null : value);
  };

  useEffect(() => {
    const handleClickOutside = () => setShowActionsDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Building2 size={20} /> Suppliers
            </h1>
            <p className="so-page-subtitle">Manage and track all suppliers</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setSlTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {slTheme.toUpperCase()}
            </button>

            {/* Delete Selected */}
            {selectedSuppliers.size > 0 && (
              <button
                className="so-btn-secondary"
                onClick={() => handleDelete()}
                style={{ color: '#ef4444', borderColor: '#ef4444' }}
              >
                <Trash2 size={14} /> Delete ({selectedSuppliers.size})
              </button>
            )}

            <button
              className="so-btn-primary"
              onClick={() => {
                setIsEditMode(false);
                setEditingSupplierId('');
                setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' });
                setShowForm(true);
              }}
            >
              <Plus size={16} /> Add Supplier
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          {/* Top Filters Bar */}
          <div className="so-filter-bar" style={{ 
            background: 'white', 
            padding: '1.25rem 2rem', 
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end'
          }}>
            <div style={{ flex: '1 1 300px' }}>
              <label className="so-filter-label">Search by Name</label>
              <input
                className="so-filter-input"
                type="text"
                value={filterName}
                onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                placeholder="Filter by name..."
              />
            </div>
            
            <button
              className="so-clear-btn"
              onClick={() => { setFilterName(''); setCurrentPage(1); }}
              style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}
            >
              Clear Filters
            </button>
          </div>

          {/* Main Content */}
          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>
              {selectedSuppliers.size > 0
                ? `${selectedSuppliers.size} selected of ${total}`
                : `${total} record(s) found`}
            </p>
            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={suppliers.length > 0 && selectedSuppliers.size === suppliers.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th>Supplier Name</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="so-empty">
                          <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : suppliers.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="so-empty">
                          <Building2 size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                          <p>{filterName ? 'No suppliers found' : 'No suppliers yet'}</p>
                          {filterName && (
                            <button
                              onClick={() => setFilterName('')}
                              style={{ marginTop: '0.5rem', color: themeColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Clear filter
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      suppliers.map(s => (
                        <tr key={s.value}>
                          <td onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedSuppliers.has(s.value)}
                              onChange={() => handleSelectSupplier(s.value)}
                            />
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            <a
                              href={`#/supplier/${s.value}`}
                              style={{ color: themeColor, textDecoration: 'none', fontWeight: 700 }}
                            >
                              {s.label}
                            </a>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleActions(s.value); }}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  padding: '0.25rem', borderRadius: '0.25rem',
                                  color: '#64748b', display: 'flex', alignItems: 'center'
                                }}
                              >
                                <MoreVertical size={16} />
                              </button>
                              {showActionsDropdown === s.value && (
                                <div style={{
                                  position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                                  zIndex: 50, background: '#fff', border: '1px solid var(--so-border)',
                                  borderRadius: '0.5rem', boxShadow: 'var(--so-shadow)',
                                  minWidth: '130px', overflow: 'hidden'
                                }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); fetchSupplierForEdit(s.value); setShowActionsDropdown(null); }}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      padding: '0.6rem 1rem', background: 'none', border: 'none',
                                      cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--so-primary-light)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <Edit2 size={13} /> Edit
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete([s.value]); setShowActionsDropdown(null); }}
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      padding: '0.6rem 1rem', background: 'none', border: 'none',
                                      cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <Trash2 size={13} /> Delete
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

              {/* Pagination */}
              {!loading && total > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {total === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, total)}–{Math.min(currentPage * pageSize, total)} of {total}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 100, 500].map(size => (
                        <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); setSelectedSuppliers(new Set()); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{size}</button>
                      ))}
                    </div>
                    
                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages || 1}</span>
                      <button className="so-page-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ────── ADD / EDIT SUPPLIER MODAL ────── */}
        {showForm && (
          <div
            className="so-modal-overlay"
            onClick={e => e.target === e.currentTarget && (setShowForm(false), setIsEditMode(false), setEditingSupplierId(''))}
          >
            <div className="so-modal" style={{ maxWidth: '560px' }}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">
                  <Building2 size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {isEditMode ? 'Edit Supplier' : 'New Supplier'}
                </h2>
                <button
                  className="so-modal-close"
                  onClick={() => { setShowForm(false); setIsEditMode(false); setEditingSupplierId(''); setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' }); }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="so-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.supplier_name}
                      onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none"
                      placeholder="Enter supplier name"
                      autoFocus
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Enter the full name of the supplier</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Type</label>
                    <select
                      value={form.supplier_type}
                      onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none"
                    >
                      <option value="Company">Company</option>
                      <option value="Individual">Individual</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Proprietorship">Proprietorship</option>
                    </select>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Select the type of supplier entity</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Address</label>
                    <input
                      type="text"
                      value={form.supplier_primary_address}
                      onChange={e => setForm({ ...form, supplier_primary_address: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none"
                      placeholder="e.g., 123 Main St, City"
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Enter the primary address of the supplier</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Contact</label>
                    <input
                      type="text"
                      value={form.supplier_primary_contact}
                      onChange={e => setForm({ ...form, supplier_primary_contact: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none"
                      placeholder="e.g., +1-123-456-7890 or email"
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Enter the primary contact details</p>
                  </div>
                </div>
              </div>

              <div className="so-modal-footer">
                <button
                  className="so-btn-secondary"
                  onClick={() => { setShowForm(false); setIsEditMode(false); setEditingSupplierId(''); setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' }); }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="so-btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.supplier_name.trim()}
                  style={{ minWidth: '130px', opacity: (saving || !form.supplier_name.trim()) ? 0.5 : 1 }}
                >
                  {saving
                    ? <><Loader2 size={14} className="so-spinner" /> {isEditMode ? 'Updating...' : 'Saving...'}</>
                    : <><Save size={14} /> {isEditMode ? 'Update' : 'Save'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default SupplierList;
