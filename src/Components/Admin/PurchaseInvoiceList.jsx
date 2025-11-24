import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, ChevronDown, X, Trash2, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import './PurchaseInvoiceList.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    supplier: '',
    supplier_name: '',
    posting_date: new Date().toISOString().split('T')[0],
    due_date: '',
    bill_no: '',
    update_stock: true,
    buying_price_list: 'Standard Buying',
    taxes_template: 'UAE VAT 5%',
    is_paid: false,
    items: [{
      item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, warehouse: 'Stores'
    }]
  });

  const [searchSupplier, setSearchSupplier] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [itemsList, setItemsList] = useState([]);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});

  const [warehouses, setWarehouses] = useState([]);
  const [searchWarehouse, setSearchWarehouse] = useState({});
  const [showWarehouseDropdowns, setShowWarehouseDropdowns] = useState({});

  const [filterName, setFilterName] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Actions dropdown
  const [showActions, setShowActions] = useState(null);
  const actionsRefs = useRef({});

  const supplierRef = useRef(null);
  const itemRefs = useRef({});
  const warehouseRefs = useRef({});

  useEffect(() => {
    fetchInvoices();
    fetchWarehouses();
  }, []);

  const handleClickOutside = useCallback((e) => {
    if (supplierRef.current && !supplierRef.current.contains(e.target)) {
      setShowSupplierDropdown(false);
    }
    Object.keys(itemRefs.current).forEach(idx => {
      if (itemRefs.current[idx] && !itemRefs.current[idx].contains(e.target)) {
        setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
      }
    });
    Object.keys(warehouseRefs.current).forEach(idx => {
      if (warehouseRefs.current[idx] && !warehouseRefs.current[idx].contains(e.target)) {
        setShowWarehouseDropdowns(prev => ({ ...prev, [idx]: false }));
      }
    });
    if (showActions && actionsRefs.current[showActions] && !actionsRefs.current[showActions].contains(e.target)) {
      setShowActions(null);
    }
  }, [showActions]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_invoices`, { withCredentials: true });
      if (res.data.message?.success) {
        setInvoices(res.data.message.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async (query = '') => {
    try {
      const res = await axios.get(`${API_PATH}.get_suppliers_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setSuppliers(data);
    } catch (err) {
      console.error('Supplier fetch error:', err);
      setSuppliers([]);
    }
  };

  const fetchItems = async (query = '') => {
    try {
      const res = await axios.get(`${API_PATH}.get_items_for_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setItemsList(data);
    } catch (err) {
      console.error('Items fetch error:', err);
      setItemsList([]);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_PATH}.get_company_warehouses`, { withCredentials: true });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setWarehouses(data);
    } catch (err) {
      console.error('Warehouses fetch error:', err);
      setWarehouses([]);
    }
  };

  const fetchItemRate = async (itemCode, rowIndex) => {
    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: { item_code: itemCode },
        withCredentials: true
      });
      if (res.data.message) {
        updateItem(rowIndex, 'rate', res.data.message.rate);
      }
    } catch (err) {
      console.error('Error fetching item rate:', err);
    }
  };

  const fetchPurchaseInvoice = async (name) => {
    try {
      const res = await axios.get(`${API_PATH}.get_purchase_invoice`, {
        params: { name },
        withCredentials: true
      });
      if (res.data.message?.success) {
        const data = res.data.message.data;
        setFormData({
          name: data.name,
          supplier: data.supplier,
          supplier_name: data.supplier_name || data.supplier,
          posting_date: data.posting_date.split('T')[0],
          due_date: data.due_date ? data.due_date.split('T')[0] : '',
          bill_no: data.bill_no || '',
          items: (data.items || []).map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: item.qty || 1,
            uom: item.uom || '',
            rate: item.rate || 0,
            amount: item.amount || 0,
            warehouse: item.warehouse || 'Stores'
          }))
        });
        setSearchSupplier(data.supplier_name || data.supplier);
        setItemSearches({});
        setSearchWarehouse({});
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      alert('Failed to load invoice');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchSupplier.trim()) {
        fetchSuppliers(searchSupplier);
        setShowSupplierDropdown(true);
      } else {
        setShowSupplierDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchSupplier]);

  const openCreateModal = () => {
    setFormData({
      name: '',
      supplier: '', supplier_name: '',
      posting_date: new Date().toISOString().split('T')[0],
      due_date: '', bill_no: '',
      update_stock: true,
      buying_price_list: 'Standard Buying',
      taxes_template: 'UAE VAT 5%',
      is_paid: false,
      items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, warehouse: 'Stores' }]
    });
    setFormErrors({});
    setSearchSupplier('');
    setItemSearches({});
    setSearchWarehouse({});
    setSuppliers([]);
    setItemsList([]);
    setShowSupplierDropdown(false);
    setShowItemDropdowns({});
    setShowWarehouseDropdowns({});
    setIsEditMode(false);
    setIsViewMode(false);
    setSelectedInvoice(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (invoice) => {
    if (invoice.docstatus !== 0) {
      alert('Can only edit draft invoices');
      return;
    }
    await fetchPurchaseInvoice(invoice.name);
    setIsEditMode(true);
    setIsViewMode(false);
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const openViewModal = async (invoice) => {
    await fetchPurchaseInvoice(invoice.name);
    setIsEditMode(false);
    setIsViewMode(true);
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  const handleRowClick = (invoice) => {
    if (invoice.docstatus === 0) {
      openEditModal(invoice);
    } else {
      openViewModal(invoice);
    }
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index][field] = value;
      if (field === 'qty' || field === 'rate') {
        const qty = parseFloat(items[index].qty) || 0;
        const rate = parseFloat(items[index].rate) || 0;
        items[index].amount = (qty * rate).toFixed(2);
      }
      return { ...prev, items };
    });
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, warehouse: 'Stores' }]
    }));
  };

  const removeItemRow = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const selectSupplier = (supplier) => {
    setFormData(prev => ({ ...prev, supplier: supplier.name, supplier_name: supplier.supplier_name }));
    setSearchSupplier(supplier.supplier_name || supplier.name);
    setShowSupplierDropdown(false);
  };

  const selectItem = async (rowIndex, item) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[rowIndex] = {
        ...items[rowIndex],
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos',
        rate: 0,
        amount: 0
      };
      return { ...prev, items };
    });
    setItemSearches(prev => ({ ...prev, [rowIndex]: '' }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));
    await fetchItemRate(item.item_code, rowIndex);
  };

  const handleItemSearch = (index, value) => {
    setItemSearches(prev => ({ ...prev, [index]: value }));
    if (value.trim().length > 1) {
      fetchItems(value);
      setShowItemDropdowns(prev => ({ ...prev, [index]: true }));
    } else {
      setShowItemDropdowns(prev => ({ ...prev, [index]: false }));
    }
  };

  const selectWarehouse = (rowIndex, warehouse) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[rowIndex].warehouse = warehouse.warehouse_name;
      return { ...prev, items };
    });
    setSearchWarehouse(prev => ({ ...prev, [rowIndex]: warehouse.warehouse_name }));
    setShowWarehouseDropdowns(prev => ({ ...prev, [rowIndex]: false }));
  };

  const handleWarehouseSearch = (index, value) => {
    setSearchWarehouse(prev => ({ ...prev, [index]: value }));
    if (value.trim().length > 0) {
      setShowWarehouseDropdowns(prev => ({ ...prev, [index]: true }));
    } else {
      setShowWarehouseDropdowns(prev => ({ ...prev, [index]: false }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) {
      errors.items = 'At least one valid item required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    const payload = {
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      due_date: formData.due_date || null,
      bill_no: formData.bill_no || null,
      items: formData.items
        .filter(i => i.item_code && i.qty > 0)
        .map(i => ({
          item_code: i.item_code,
          qty: parseFloat(i.qty),
          rate: parseFloat(i.rate || 0),
          amount: parseFloat(i.amount || 0)
        }))
    };

    try {
      let res;
      if (isEditMode) {
        res = await axios.post(`${API_PATH}.update_purchase_invoice`, {
          name: formData.name,
          ...payload
        }, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
        if (res.data.message?.success) {
          alert('Purchase Invoice Updated: ' + res.data.message.name);
        } else {
          alert(res.data.message?.message || 'Failed to update');
        }
      } else {
        res = await axios.post(`${API_PATH}.create_purchase_invoice_direct`, payload, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.data.message?.success) {
          alert('Purchase Invoice Created: ' + res.data.message.name);
        } else {
          alert(res.data.message?.message || 'Failed to create');
        }
      }
      if (res.data.message?.success) {
        setIsModalOpen(false);
        fetchInvoices();
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (name) => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      const res = await axios.post(`${API_PATH}.cancel_purchase_invoice`, { name }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data.message?.success) {
        alert('Invoice cancelled successfully');
        fetchInvoices();
      } else {
        alert(res.data.message?.message || 'Failed to cancel');
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setShowActions(null);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    try {
      const res = await axios.post(`${API_PATH}.delete_purchase_invoice`, { name }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data.message?.success) {
        alert('Invoice deleted successfully');
        fetchInvoices();
      } else {
        alert(res.data.message?.message || 'Failed to delete');
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setShowActions(null);
    }
  };

  const openActions = (invoice) => {
    setShowActions(invoice.name);
  };

  const grandTotal = formData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2);

  const modalTitle = isEditMode ? 'Edit Purchase Invoice' : isViewMode ? 'View Purchase Invoice' : 'New Purchase Invoice';
  const modalSubtitle = isEditMode ? `Editing ${selectedInvoice?.name}` : isViewMode ? `Viewing ${selectedInvoice?.name}` : '';

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesName = !filterName || inv.name.toLowerCase().includes(filterName.toLowerCase());
      const matchesSupplier = !filterSupplier || inv.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
      const matchesStatus = !filterStatus || inv.status === filterStatus;
      const matchesFrom = !filterDateFrom || new Date(inv.posting_date) >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || new Date(inv.posting_date) <= new Date(filterDateTo);
      return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [invoices, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredInvoices.length;
  const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const map = {
      Paid: 'status-paid',
      Unpaid: 'status-unpaid',
      Overdue: 'status-overdue',
      Draft: 'status-draft',
      Return: 'status-return',
      Cancelled: 'status-cancelled',
    };
    return map[status] || 'status-default';
  };

  const clearFilters = () => {
    setFilterName('');
    setFilterSupplier('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <>
      <NavBar />
      <div className="pi-container">
        <div className="pi-header">
          <div className="pi-header-left">
            <h1 className="pi-title">Purchase Invoices</h1>
            <span className="pi-count">{total} total</span>
          </div>
          <div className="pi-header-actions">
            <button onClick={() => setShowFilters(!showFilters)} className="pi-btn-secondary">
              <Filter className="pi-icon" />
              Filters
            </button>
            <button onClick={openCreateModal} className="pi-btn-primary">
              <Plus className="pi-icon" />
              Create Invoice
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="pi-filters">
            <div className="pi-filters-grid">
              <div className="pi-filter-item">
                <label>Invoice Number</label>
                <div className="pi-input-wrapper">
                  <Search className="pi-input-icon" />
                  <input
                    type="text"
                    placeholder="Search invoice..."
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    className="pi-input"
                  />
                </div>
              </div>
              <div className="pi-filter-item">
                <label>Supplier</label>
                <div className="pi-input-wrapper">
                  <Building2 className="pi-input-icon" />
                  <input
                    type="text"
                    placeholder="Search supplier..."
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    className="pi-input"
                  />
                </div>
              </div>
              <div className="pi-filter-item">
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pi-select">
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Return">Return</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="pi-filter-item">
                <label>From Date</label>
                <div className="pi-input-wrapper">
                  <Calendar className="pi-input-icon" />
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="pi-input"
                  />
                </div>
              </div>
              <div className="pi-filter-item">
                <label>To Date</label>
                <div className="pi-input-wrapper">
                  <Calendar className="pi-input-icon" />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="pi-input"
                  />
                </div>
              </div>
              <div className="pi-filter-actions">
                <button onClick={clearFilters} className="pi-btn-ghost">Clear</button>
              </div>
            </div>
          </div>
        )}

        <main className="pi-main">
          {loading ? (
            <div className="pi-loading">
              <div className="pi-spinner"></div>
              <p>Loading invoices...</p>
            </div>
          ) : (
            <div className="pi-table-container">
              <div className="pi-table-wrapper">
                <table className="pi-table">
                  <thead>
                    <tr>
                      <th className="pi-th-checkbox">
                        <input type="checkbox" className="pi-checkbox" />
                      </th>
                      <th className="pi-th">Invoice Number</th>
                      <th className="pi-th">Supplier</th>
                      <th className="pi-th">Date</th>
                      <th className="pi-th">Status</th>
                      <th className="pi-th-right">Amount</th>
                      <th className="pi-th-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="pi-empty">
                          <Package className="pi-empty-icon" />
                          <p>No invoices found</p>
                          <button onClick={openCreateModal} className="pi-btn-link">Create your first invoice</button>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(inv => (
                        <tr key={inv.name} className="pi-tr">
                          <td className="pi-td-checkbox">
                            <input type="checkbox" className="pi-checkbox" onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="pi-td" onClick={() => handleRowClick(inv)}>
                            <span className="pi-invoice-number">{inv.name}</span>
                          </td>
                          <td className="pi-td" onClick={() => handleRowClick(inv)}>
                            <div className="pi-supplier">
                              <span className="pi-supplier-name">{inv.supplier_name}</span>
                              <span className="pi-supplier-code">{inv.supplier}</span>
                            </div>
                          </td>
                          <td className="pi-td" onClick={() => handleRowClick(inv)}>
                            <span className="pi-date">{format(new Date(inv.posting_date), 'dd MMM yyyy')}</span>
                          </td>
                          <td className="pi-td" onClick={() => handleRowClick(inv)}>
                            <span className={`pi-status ${getStatusColor(inv.status)}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="pi-td-right" onClick={() => handleRowClick(inv)}>
                            <span className="pi-amount">AED {inv.grand_total?.toFixed(2)}</span>
                          </td>
                          <td className="pi-td-actions">
                            <div ref={el => actionsRefs.current[inv.name] = el} style={{ position: 'relative' }}>
                              <button className="pi-btn-icon" onClick={e => { e.stopPropagation(); openActions(inv); }}>
                                <MoreVertical className="pi-icon" />
                              </button>
                              {showActions === inv.name && (
                                <div className="pi-actions-dropdown" style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  backgroundColor: 'white',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  zIndex: 2000,
                                  minWidth: '120px'
                                }}>
                                  {(inv.docstatus === 0 || inv.docstatus === 2) && (
                                    <div 
                                      className="pi-dropdown-item" 
                                      onClick={() => handleDelete(inv.name)} 
                                      style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'block'
                                      }} 
                                      onMouseEnter={e => e.target.style.backgroundColor = '#f5f5f5'}
                                      onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                                    >
                                      Delete
                                    </div>
                                  )}
                                  {inv.docstatus === 1 && (
                                    <div 
                                      className="pi-dropdown-item" 
                                      onClick={() => handleCancel(inv.name)} 
                                      style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'block'
                                      }} 
                                      onMouseEnter={e => e.target.style.backgroundColor = '#f5f5f5'}
                                      onMouseLeave={e => e.target.style.backgroundColor = 'white'}
                                    >
                                      Cancel
                                    </div>
                                  )}
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

              {total > 0 && (
                <div className="pi-pagination">
                  <div className="pi-pagination-info">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} invoices
                  </div>
                  <div className="pi-pagination-controls">
                    <div className="pi-page-size">
                      <span>Rows:</span>
                      {[20, 50, 100].map(s => (
                        <button
                          key={s}
                          onClick={() => { setPageSize(s); setCurrentPage(1); }}
                          className={`pi-page-size-btn ${pageSize === s ? 'active' : ''}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="pi-page-nav">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="pi-page-btn"
                      >
                        Previous
                      </button>
                      <span className="pi-page-current">Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="pi-page-btn"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {isModalOpen && (
          <div className="pi-modal-overlay">
            <div className="pi-modal">
              <div className="pi-modal-header">
                <div>
                  <h2 className="pi-modal-title">{modalTitle}</h2>
                  <p className="pi-modal-subtitle">{modalSubtitle}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="pi-modal-close">
                  <X className="pi-icon" />
                </button>
              </div>

              <div className="pi-modal-body">
                <div className="pi-form-section">
                  <h3 className="pi-section-title">Supplier Information</h3>
                  <div className="pi-form-grid">
                    <div className="pi-form-group" ref={supplierRef}>
                      <label className="pi-label">
                        Supplier <span className="pi-required">{!isViewMode && '*'}</span>
                      </label>
                      <div className="pi-input-wrapper">
                        <Building2 className="pi-input-icon" />
                        <input
                          type="text"
                          value={searchSupplier}
                          onChange={e => setSearchSupplier(e.target.value)}
                          onFocus={() => !isViewMode && searchSupplier && setShowSupplierDropdown(true)}
                          placeholder="Search and select supplier..."
                          className={`pi-input ${formErrors.supplier ? 'pi-input-error' : ''}`}
                          disabled={isViewMode}
                        />
                      </div>
                      {showSupplierDropdown && suppliers.length > 0 && !isViewMode && (
                        <div className="pi-dropdown">
                          {suppliers.map(s => (
                            <div key={s.name} onClick={() => selectSupplier(s)} className="pi-dropdown-item">
                              <div className="pi-dropdown-main">{s.supplier_name}</div>
                              <div className="pi-dropdown-sub">{s.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {formErrors.supplier && <span className="pi-error">{formErrors.supplier}</span>}
                    </div>

                    <div className="pi-form-group">
                      <label className="pi-label">
                        Posting Date <span className="pi-required">{!isViewMode && '*'}</span>
                      </label>
                      <div className="pi-input-wrapper">
                        <Calendar className="pi-input-icon" />
                        <input
                          type="date"
                          value={formData.posting_date}
                          onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                          className="pi-input"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    <div className="pi-form-group">
                      <label className="pi-label">Due Date</label>
                      <div className="pi-input-wrapper">
                        <Calendar className="pi-input-icon" />
                        <input
                          type="date"
                          value={formData.due_date}
                          onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                          className="pi-input"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>

                    <div className="pi-form-group">
                      <label className="pi-label">Bill Number</label>
                      <input
                        type="text"
                        value={formData.bill_no}
                        onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                        placeholder="Enter bill number..."
                        className="pi-input"
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </div>

                <div className="pi-form-section">
                  <div className="pi-section-header">
                    <h3 className="pi-section-title">Items</h3>
                    {!isViewMode && (
                      <button onClick={addItemRow} className="pi-btn-link">
                        <Plus className="pi-icon-sm" />
                        Add Item
                      </button>
                    )}
                  </div>

                  <div className="pi-items-table-wrapper">
                    <table className="pi-items-table">
                      <thead>
                        <tr>
                          <th className="pi-items-th">Item</th>
                          <th className="pi-items-th" style={{width: '100px'}}>Quantity</th>
                          <th className="pi-items-th" style={{width: '80px'}}>UOM</th>
                          <th className="pi-items-th" style={{width: '120px'}}>Rate (AED)</th>
                          <th className="pi-items-th" style={{width: '120px'}}>Amount (AED)</th>
                          <th className="pi-items-th" style={{width: '180px'}}>Warehouse</th>
                          <th className="pi-items-th" style={{width: '50px'}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i} className="pi-items-tr">
                            <td className="pi-items-td" ref={el => itemRefs.current[i] = el}>
                              {item.item_code ? (
                                <div className="pi-item-selected">
                                  {item.item_name}
                                </div>
                              ) : (
                                <div className="pi-item-cell">
                                  <input
                                    type="text"
                                    value={itemSearches[i] || ''}
                                    onChange={e => handleItemSearch(i, e.target.value)}
                                    onFocus={() => !isViewMode && itemSearches[i] && setShowItemDropdowns(prev => ({ ...prev, [i]: true }))}
                                    placeholder="Search item..."
                                    className="pi-items-input"
                                    disabled={isViewMode}
                                  />
                                  {showItemDropdowns[i] && itemsList.length > 0 && !isViewMode && (
                                    <div className="pi-dropdown pi-dropdown-absolute">
                                      {itemsList.map(itm => (
                                        <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="pi-dropdown-item">
                                          <div className="pi-dropdown-main">{itm.item_name}</div>
                                          <div className="pi-dropdown-sub">{itm.item_code}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="pi-items-td">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={e => updateItem(i, 'qty', e.target.value)}
                                className="pi-items-input pi-items-input-number"
                                min="1"
                                disabled={isViewMode}
                              />
                            </td>

                            <td className="pi-items-td">
                              <span className="pi-items-text">{item.uom || '-'}</span>
                            </td>

                            <td className="pi-items-td">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={e => updateItem(i, 'rate', e.target.value)}
                                className="pi-items-input pi-items-input-number"
                                step="0.01"
                                disabled={isViewMode}
                              />
                            </td>

                            <td className="pi-items-td">
                              <span className="pi-items-amount">{item.amount || '0.00'}</span>
                            </td>

                            <td className="pi-items-td" ref={el => warehouseRefs.current[i] = el}>
                              <div className="pi-warehouse-cell">
                                <WarehouseIcon className="pi-warehouse-icon" />
                                <input
                                  type="text"
                                  value={searchWarehouse[i] || item.warehouse}
                                  onChange={e => handleWarehouseSearch(i, e.target.value)}
                                  onFocus={() => !isViewMode && setShowWarehouseDropdowns(prev => ({ ...prev, [i]: true }))}
                                  placeholder="Warehouse..."
                                  className="pi-items-input"
                                  disabled={isViewMode}
                                />
                                {showWarehouseDropdowns[i] && warehouses.length > 0 && !isViewMode && (
                                  <div className="pi-dropdown pi-dropdown-absolute">
                                    {warehouses
                                      .filter(wh => !searchWarehouse[i] || wh.warehouse_name.toLowerCase().includes(searchWarehouse[i].toLowerCase()))
                                      .map(wh => (
                                        <div key={wh.name} onClick={() => selectWarehouse(i, wh)} className="pi-dropdown-item">
                                          <div className="pi-dropdown-main">{wh.warehouse_name}</div>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="pi-items-td">
                              {!isViewMode && formData.items.length > 1 && (
                                <button onClick={() => removeItemRow(i)} className="pi-btn-delete">
                                  <Trash2 className="pi-icon-sm" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {formErrors.items && <span className="pi-error">{formErrors.items}</span>}
                </div>

                <div className="pi-total-section">
                  <div className="pi-total-row">
                    <span className="pi-total-label">Grand Total:</span>
                    <span className="pi-total-amount">AED {grandTotal}</span>
                  </div>
                </div>
              </div>

              <div className="pi-modal-footer">
                <button onClick={() => setIsModalOpen(false)} className="pi-btn-secondary">
                  {isViewMode ? 'Close' : 'Cancel'}
                </button>
                {!isViewMode && (
                  <button onClick={handleSave} disabled={saving} className="pi-btn-primary">
                    {saving ? (
                      <>
                        <div className="pi-btn-spinner"></div>
                        {isEditMode ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      isEditMode ? 'Update Invoice' : 'Create Invoice'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default PurchaseInvoiceList;