import React, { useState, useEffect } from 'react';
import {
  Plus, ChevronDown, Search, Save, X, Loader2, Filter, MoreVertical, Edit2, Trash2
} from 'lucide-react';
import NavBar from '../Nav/NavBar';
import './SupplierList.css';

function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);  // New: Edit mode toggle
  const [editingSupplierId, setEditingSupplierId] = useState('');  // New: For edit
  const [form, setForm] = useState({ 
    supplier_name: '', 
    supplier_type: 'Company',
    supplier_primary_address: '',
    supplier_primary_contact: ''
  });
  const [saving, setSaving] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());
  const [showActionsDropdown, setShowActionsDropdown] = useState(null);  // New: For per-row dropdown

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

  // New: Fetch single supplier for edit
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

  // Updated: Handle save (create or update)
  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      alert('Supplier Name is required.');
      return;
    }

    setSaving(true);
    try {
      let res;
      if (isEditMode) {
        // Update
        res = await fetch(`${API_PATH}.update_supplier`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-SID': getSession()
          },
          credentials: 'include',
          body: JSON.stringify({
            name: editingSupplierId,
            ...form
          })
        });
      } else {
        // Create (existing)
        res = await fetch(`${API_PATH}.create_supplier`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-SID': getSession()
          },
          credentials: 'include',
          body: JSON.stringify(form)
        });
      }

      const result = await res.json();

      if (result.message?.status === 'success') {
        setShowForm(false);
        setIsEditMode(false);
        setEditingSupplierId('');
        setForm({ 
          supplier_name: '', 
          supplier_type: 'Company',
          supplier_primary_address: '',
          supplier_primary_contact: ''
        });
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

  // New: Handle delete (single or bulk)
  const handleDelete = async (namesToDelete = null) => {
    const names = namesToDelete || Array.from(selectedSuppliers);
    if (names.length === 0) {
      alert('No supplier selected.');
      return;
    }

    if (!confirm(`Delete ${names.length} supplier(s)? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_PATH}.delete_supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-SID': getSession()
        },
        credentials: 'include',
        body: JSON.stringify({ names })
      });

      const result = await res.json();

      if (result.message?.status === 'success') {
        setSelectedSuppliers(new Set());
        if (currentPage > 1 && suppliers.length <= names.length) {
          setCurrentPage(currentPage - 1);  // Go back if last page empty
        }
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
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelectedSuppliers(newSelected);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedSuppliers(new Set());
  };

  // New: Toggle actions dropdown
  const toggleActions = (value) => {
    setShowActionsDropdown(showActionsDropdown === value ? null : value);
  };

  // New: Close dropdown on outside click (simple, add useEffect for full)
  useEffect(() => {
    const handleClickOutside = () => setShowActionsDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <NavBar />
      <div className="supplier-list-container">

        <div className="supplier-header">
          <div className="header-left">
            <h1 className="page-title">Supplier</h1>
            <div className="view-selector">
              <span>List View</span>
              <ChevronDown className="icon-sm" />
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => handleDelete()}>  {/* New: Bulk delete */}
              <Trash2 className="icon-sm" />
              <span>Delete Selected</span>
            </button>
            <button className="btn-secondary">
              <Filter className="icon-sm" />
              <span>Filter</span>
            </button>
            <button
              onClick={() => {
                setIsEditMode(false);
                setEditingSupplierId('');
                setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' });
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="icon-sm" />
              <span>Add Supplier</span>
            </button>
          </div>
        </div>

        <main className="content-area">
          {loading ? (
            <div className="loading-state">
              <Loader2 className="icon-spin" />
              <span>Loading suppliers...</span>
            </div>
          ) : (
            <>
              <div className="list-stats">
                <span className="stats-text">
                  {selectedSuppliers.size > 0
                    ? `${selectedSuppliers.size} selected`
                    : `${total} suppliers`}
                </span>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="col-checkbox">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={suppliers.length > 0 && selectedSuppliers.size === suppliers.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="col-name">
                        <div className="th-content">
                          <span className="th-label">Name</span>
                          <div className="filter-input-wrapper">
                            <Search className="filter-icon" />
                            <input
                              type="text"
                              value={filterName}
                              onChange={e => {
                                setFilterName(e.target.value);
                                setCurrentPage(1);
                              }}
                              placeholder="Filter by name"
                              className="filter-input"
                            />
                            {filterName && (
                              <button
                                onClick={() => setFilterName('')}
                                className="clear-filter"
                              >
                                <X className="icon-xs" />
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                      <th className="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="empty-state">  {/* Updated colspan for new th */}
                          <div className="empty-content">
                            <p className="empty-text">No suppliers found</p>
                            {filterName && (
                              <button
                                onClick={() => setFilterName('')}
                                className="btn-link"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      suppliers.map(s => (
                        <tr key={s.value} className="data-row">
                          <td className="col-checkbox">
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selectedSuppliers.has(s.value)}
                              onChange={() => handleSelectSupplier(s.value)}
                            />
                          </td>
                          <td className="col-name">
                            <a href={`#/supplier/${s.value}`} className="supplier-link">
                              {s.label}
                            </a>
                          </td>
                          <td className="col-actions">
                            <div className="relative">  {/* New: Dropdown container */}
                              <button 
                                className="btn-icon" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActions(s.value);
                                }}
                              >
                                <MoreVertical className="icon-sm" />
                              </button>
                              {showActionsDropdown === s.value && (
                                <div className="dropdown-menu">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchSupplierForEdit(s.value);
                                      setShowActionsDropdown(null);
                                    }}
                                    className="dropdown-item"
                                  >
                                    <Edit2 className="icon-xs" />
                                    <span>Edit</span>
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete([s.value]);
                                      setShowActionsDropdown(null);
                                    }}
                                    className="dropdown-item danger"
                                  >
                                    <Trash2 className="icon-xs" />
                                    <span>Delete</span>
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

              <div className="table-footer">
                <div className="pagination-info">
                  <span>
                    Showing {total === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, total)} of {total}
                  </span>
                </div>
                <div className="pagination-controls">
                  <div className="page-size-selector">
                    {[20, 100, 500].map(size => (
                      <button
                        key={size}
                        onClick={() => {
                          setPageSize(size);
                          setCurrentPage(1);
                          setSelectedSuppliers(new Set());
                        }}
                        className={`page-size-btn ${pageSize === size ? 'active' : ''}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <div className="page-navigation">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="nav-btn"
                    >
                      Previous
                    </button>
                    <span className="page-indicator">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="nav-btn"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {showForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <div className="modal-header-left">
                  <h2 className="modal-title">{isEditMode ? 'Edit Supplier' : 'New Supplier'}</h2>
                  <span className="status-badge unsaved">{isEditMode ? 'Updated' : 'Not Saved'}</span>
                </div>
                <div className="modal-header-right">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setIsEditMode(false);
                      setEditingSupplierId('');
                      setForm({ supplier_name: '', supplier_type: 'Company', supplier_primary_address: '', supplier_primary_contact: '' });
                    }}
                    className="btn-secondary"
                    disabled={saving}
                  >
                    <X className="icon-sm" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="icon-sm icon-spin" />
                        <span>{isEditMode ? 'Updating...' : 'Saving...'}</span>
                      </>
                    ) : (
                      <>
                        <Save className="icon-sm" />
                        <span>{isEditMode ? 'Update' : 'Save'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="modal-body">
                <div className="form-section">
                  <div className="form-group">
                    <label className="form-label required">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={form.supplier_name}
                      onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                      className="form-input"
                      placeholder="Enter supplier name"
                      autoFocus
                    />
                    <p className="form-help">Enter the full name of the supplier</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Supplier Type
                    </label>
                    <select
                      value={form.supplier_type}
                      onChange={e => setForm({ ...form, supplier_type: e.target.value })}
                      className="form-select"
                    >
                      <option value="Company">Company</option>
                      <option value="Individual">Individual</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Proprietorship">Proprietorship</option>
                    </select>
                    <p className="form-help">Select the type of supplier entity</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Supplier Primary Address
                    </label>
                    <input
                      type="text"
                      value={form.supplier_primary_address}
                      onChange={e => setForm({ ...form, supplier_primary_address: e.target.value })}
                      className="form-input"
                      placeholder="Enter primary address (e.g., 123 Main St, City)"
                    />
                    <p className="form-help">Enter the primary address of the supplier</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Supplier Primary Contact
                    </label>
                    <input
                      type="text"
                      value={form.supplier_primary_contact}
                      onChange={e => setForm({ ...form, supplier_primary_contact: e.target.value })}
                      className="form-input"
                      placeholder="Enter primary contact (e.g., +1-123-456-7890 or email)"
                    />
                    <p className="form-help">Enter the primary contact details</p>
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

export default SupplierList;