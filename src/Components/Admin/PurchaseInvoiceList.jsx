import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, X, Trash2, Building2, Search, Calendar, Filter, MoreVertical, Package,
  Warehouse as WarehouseIcon, Percent, DollarSign, Loader2
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import './PurchaseInvoiceList.css';

// Custom APIs (kept for suppliers, items, warehouses, tax templates)
const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

// Standard Resource API — ONLY for Purchase Invoice (Create/Update/Cancel/Delete)
const RESOURCE_API = '/api/resource/Purchase Invoice';

function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [taxTemplates, setTaxTemplates] = useState([]);
  const [loadingTaxTemplates, setLoadingTaxTemplates] = useState(false);
  const [taxPreview, setTaxPreview] = useState([]);

  const [formData, setFormData] = useState({
    name: '', supplier: '', supplier_name: '',
    posting_date: new Date().toISOString().split('T')[0],
    due_date: '', bill_no: '',
    update_stock: true,
    apply_discount_on: 'Grand Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    taxes_and_charges: '',
    items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0 }]
  });

  const [searchSupplier, setSearchSupplier] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [itemsList, setItemsList] = useState([]);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});

  const [filterName, setFilterName] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(null);

  const supplierRef = useRef(null);
  const itemRefs = useRef({});
  const actionsRefs = useRef({});

  // Calculations
  const subtotal = useMemo(() => formData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0), [formData.items]);
  const discountAmount = useMemo(() => {
    if (formData.additional_discount_percentage > 0) return (subtotal * formData.additional_discount_percentage) / 100;
    return parseFloat(formData.discount_amount) || 0;
  }, [subtotal, formData.additional_discount_percentage, formData.discount_amount]);
  const netTotal = subtotal - discountAmount;
  const taxTotal = useMemo(() => {
  return taxPreview.reduce((sum, t) => {
    return sum + (netTotal * (parseFloat(t.rate || 0) / 100));
  }, 0);
}, [taxPreview, netTotal]);
  const grandTotal = (netTotal + taxTotal).toFixed(2);

  useEffect(() => {
    fetchInvoices();
    fetchTaxTemplates();
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const handleClickOutside = (e) => {
    if (supplierRef.current && !supplierRef.current.contains(e.target)) setShowSupplierDropdown(false);
    Object.keys(itemRefs.current).forEach(idx => {
      if (itemRefs.current[idx] && !itemRefs.current[idx].contains(e.target)) {
        setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
      }
    });
    if (showActions && actionsRefs.current[showActions] && !actionsRefs.current[showActions].contains(e.target)) {
      setShowActions(null);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_invoices`, { withCredentials: true });
      if (res.data.message?.success) setInvoices(res.data.message.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchTaxTemplates = async () => {
    setLoadingTaxTemplates(true);
    try {
      const res = await axios.get(`${API_PATH}.get_purchase_taxes_templates_pi`, { withCredentials: true });
      setTaxTemplates(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { console.error(err); }
    finally { setLoadingTaxTemplates(false); }
  };

  // Supplier search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchSupplier.trim().length >= 2) {
        fetchSuppliers(searchSupplier);
        setShowSupplierDropdown(true);
      } else {
        setShowSupplierDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchSupplier]);

  const fetchSuppliers = async (query = '') => {
    try {
      const res = await axios.get(`${API_PATH}.get_suppliers_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      setSuppliers(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { setSuppliers([]); }
  };

  const fetchItems = async (query = '') => {
    try {
      const res = await axios.get(`${API_PATH}.get_items_for_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      setItemsList(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { setItemsList([]); }
  };

  const fetchItemRate = async (itemCode, rowIndex) => {
    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: { item_code: itemCode },
        withCredentials: true
      });
      if (res.data.message?.rate) {
        updateItem(rowIndex, 'rate', res.data.message.rate);
      }
    } catch (err) { }
  };

  // Tax preview
  // FIXED: Properly encode tax template name with spaces/special chars
  useEffect(() => {
    if (!formData.taxes_and_charges) {
      setTaxPreview([]);
      return;
    }

    const loadTaxTemplate = async () => {
      try {
        const encodedName = encodeURIComponent(formData.taxes_and_charges);
        const res = await axios.get(
          `/api/resource/Purchase Taxes and Charges Template/${encodedName}`,
          { withCredentials: true }
        );
        setTaxPreview(res.data.data.taxes || []);
      } catch (err) {
        console.warn("Tax template not found or invalid:", formData.taxes_and_charges);
        setTaxPreview([]);
      }
    };

    loadTaxTemplate();
  }, [formData.taxes_and_charges]);

  const openCreateModal = () => {
    setFormData({
      name: '', supplier: '', supplier_name: '',
      posting_date: new Date().toISOString().split('T')[0],
      due_date: '', bill_no: '',
      update_stock: true,
      apply_discount_on: 'Grand Total',
      additional_discount_percentage: 0,
      discount_amount: 0,
      taxes_and_charges: '',
      items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0 }]
    });
    setFormErrors({});
    setSearchSupplier('');
    setTaxPreview([]);
    setIsEditMode(false);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const fetchPurchaseInvoice = async (name) => {
    try {
      const res = await axios.get(`${API_PATH}.get_purchase_invoice`, { params: { name }, withCredentials: true });
      if (res.data.message?.success) {
        const d = res.data.message.data;
        setFormData({
          name: d.name,
          supplier: d.supplier,
          supplier_name: d.supplier_name || d.supplier,
          posting_date: d.posting_date.split('T')[0],
          due_date: d.due_date ? d.due_date.split('T')[0] : '',
          bill_no: d.bill_no || '',
          update_stock: !!d.update_stock,
          apply_discount_on: d.apply_discount_on || 'Grand Total',
          additional_discount_percentage: d.additional_discount_percentage || 0,
          discount_amount: d.discount_amount || 0,
          taxes_and_charges: d.taxes_and_charges || '',
          items: (d.items || []).map(i => ({
            item_code: i.item_code,
            item_name: i.item_name,
            qty: i.qty || 1,
            uom: i.uom || '',
            rate: i.rate || 0,
            amount: i.amount || 0
          }))
        });
        setSearchSupplier(d.supplier_name || d.supplier);
      }
    } catch (err) {
      alert('Failed to load invoice');
    }
  };

  const openEditModal = async (invoice) => {
    if (invoice.docstatus !== 0) return alert('Can only edit draft invoices');
    await fetchPurchaseInvoice(invoice.name);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const openViewModal = async (invoice) => {
    await fetchPurchaseInvoice(invoice.name);
    setIsViewMode(true);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleRowClick = (invoice) => {
    if (invoice.docstatus === 0) openEditModal(invoice);
    else openViewModal(invoice);
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index] }; // important: clone

      if (field === 'qty' || field === 'rate') {
        const qty = parseFloat(value) || 0;
        const rate = field === 'rate' ? qty : (parseFloat(items[index].rate) || 0);
        const qtyFinal = field === 'qty' ? qty : (parseFloat(items[index].qty) || 0);
        items[index].amount = qtyFinal * rate; // number, not string!
        items[index][field] = value === '' ? '' : qty; // keep empty string for input
      } else {
        items[index][field] = value;
      }

      return { ...prev, items };
    });
  };

  const addItemRow = () => setFormData(prev => ({
    ...prev,
    items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0 }]
  }));

  const removeItemRow = (index) => setFormData(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== index)
  }));

  const selectSupplier = (supplier) => {
    setFormData(prev => ({ ...prev, supplier: supplier.name, supplier_name: supplier.supplier_name }));
    setSearchSupplier(supplier.supplier_name || supplier.name);
    setShowSupplierDropdown(false);
  };

  const selectItem = async (rowIndex, item) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[rowIndex] = {
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos',
        qty: 1,
        rate: 0,
        amount: 0
      };
      return { ...prev, items };
    });

    setItemSearches(prev => ({ ...prev, [rowIndex]: '' }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));


    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: { item_code: item.item_code },
        withCredentials: true
      });
      if (res.data.message?.rate) {
        updateItem(rowIndex, 'rate', res.data.message.rate);

      }
    } catch (err) {
      console.log("No buying rate found");
    }
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

  const handleSave = async () => {
  const errors = {};
  if (!formData.supplier) errors.supplier = 'Supplier is required';
  if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    return;
  }

  setSaving(true);

  // Calculate net total before discount
  const itemsTotal = formData.items
    .filter(i => i.item_code && i.qty > 0)
    .reduce((sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0);

  const discountAmountCalc = formData.additional_discount_percentage > 0
    ? (itemsTotal * formData.additional_discount_percentage) / 100
    : parseFloat(formData.discount_amount) || 0;

  const netTotal = itemsTotal - discountAmountCalc;

  // Build taxes array from taxPreview
  const taxes = taxPreview.map(tax => ({
    charge_type: "On Net Total",        // or "Actual" if needed
    account_head: tax.account_head,
    rate: parseFloat(tax.rate || 0),
    tax_amount: netTotal * (parseFloat(tax.rate || 0) / 100),
    description: tax.description || tax.account_head
  }));

  const payload = {
    supplier: formData.supplier,
    posting_date: formData.posting_date,
    due_date: formData.due_date || null,
    bill_no: formData.bill_no || null,
    update_stock: formData.update_stock ? 1 : 0,
    apply_discount_on: formData.apply_discount_on,
    additional_discount_percentage: formData.additional_discount_percentage > 0 ? parseFloat(formData.additional_discount_percentage) : null,
    discount_amount: formData.discount_amount > 0 ? parseFloat(formData.discount_amount) : null,
    taxes_and_charges: formData.taxes_and_charges || null,
    taxes: taxes.length > 0 ? taxes : null,  // ← THIS IS THE KEY!
    items: formData.items
      .filter(i => i.item_code && i.qty > 0)
      .map(i => ({
        item_code: i.item_code,
        qty: parseFloat(i.qty) || 1,
        rate: parseFloat(i.rate || 0)
      }))
  };

  try {
    let res;
    if (isEditMode) {
      res = await axios.put(`${RESOURCE_API}/${formData.name}`, payload, { withCredentials: true });
    } else {
      res = await axios.post(RESOURCE_API, payload, { withCredentials: true });
    }
    alert(`${isEditMode ? 'Updated' : 'Created'} successfully: ${res.data.data.name}`);
    setIsModalOpen(false);
    fetchInvoices();
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.exception || 'Save failed';
    alert("Error: " + msg);
    console.error(err.response?.data);
  } finally {
    setSaving(false);
  }
};

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const matchesName = !filterName || inv.name.toLowerCase().includes(filterName.toLowerCase());
    const matchesSupplier = !filterSupplier || inv.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
    const matchesStatus = !filterStatus || inv.status === filterStatus;
    const matchesFrom = !filterDateFrom || new Date(inv.posting_date) >= new Date(filterDateFrom);
    const matchesTo = !filterDateTo || new Date(inv.posting_date) <= new Date(filterDateTo);
    return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
  }), [invoices, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredInvoices.length;
  const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const map = { Paid: 'status-paid', Unpaid: 'status-unpaid', Overdue: 'status-overdue', Draft: 'status-draft', Return: 'status-return', Cancelled: 'status-cancelled' };
    return map[status] || 'status-default';
  };

  const clearFilters = () => {
    setFilterName(''); setFilterSupplier(''); setFilterStatus('');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  return (
    <>
      <NavBar />
      <div className="pi-container">
        {/* Header */}
        <div className="pi-header">
          <div className="pi-header-left">
            <h1 className="pi-title">Purchase Invoices</h1>
            <span className="pi-count">{total} total</span>
          </div>
          <div className="pi-header-actions">
            <button onClick={() => setShowFilters(!showFilters)} className="pi-btn-secondary">
              <Filter className="pi-icon" /> Filters
            </button>
            <button onClick={openCreateModal} className="pi-btn-primary">
              <Plus className="pi-icon" /> Create Invoice
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="pi-filters">
            <div className="pi-filters-grid">
              <div className="pi-filter-item">
                <label>Invoice Number</label>
                <div className="pi-input-wrapper">
                  <Search className="pi-input-icon" />
                  <input type="text" placeholder="Search invoice..." value={filterName} onChange={e => setFilterName(e.target.value)} className="pi-input" />
                </div>
              </div>
              <div className="pi-filter-item">
                <label>Supplier</label>
                <div className="pi-input-wrapper">
                  <Building2 className="pi-input-icon" />
                  <input type="text" placeholder="Search supplier..." value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="pi-input" />
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
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="pi-input" />
                </div>
              </div>
              <div className="pi-filter-item">
                <label>To Date</label>
                <div className="pi-input-wrapper">
                  <Calendar className="pi-input-icon" />
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="pi-input" />
                </div>
              </div>
              <div className="pi-filter-actions">
                <button onClick={clearFilters} className="pi-btn-ghost">Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
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
                      <th className="pi-th-checkbox"><input type="checkbox" className="pi-checkbox" /></th>
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
                        <tr key={inv.name} className="pi-tr" onClick={() => handleRowClick(inv)}>
                          <td className="pi-td-checkbox" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="pi-checkbox" />
                          </td>
                          <td className="pi-td">
                            <span className="pi-invoice-number">{inv.name}</span>
                          </td>
                          <td className="pi-td">
                            <div className="pi-supplier">
                              <span className="pi-supplier-name">{inv.supplier_name}</span>
                              <span className="pi-supplier-code">{inv.supplier}</span>
                            </div>
                          </td>
                          <td className="pi-td">
                            <span className="pi-date">{format(new Date(inv.posting_date), 'dd MMM yyyy')}</span>
                          </td>
                          <td className="pi-td">
                            <span className={`pi-status ${getStatusColor(inv.status)}`}>{inv.status}</span>
                          </td>
                          <td className="pi-td-right">
                            <span className="pi-amount">AED {inv.grand_total?.toFixed(2)}</span>
                          </td>
                          <td className="pi-td-actions" onClick={e => e.stopPropagation()}>
                            <div ref={el => actionsRefs.current[inv.name] = el} style={{ position: 'relative' }}>
                              <button className="pi-btn-icon" onClick={() => setShowActions(showActions === inv.name ? null : inv.name)}>
                                <MoreVertical className="pi-icon" />
                              </button>
                              {showActions === inv.name && (
                                <div className="pi-actions-dropdown">
                                  {(inv.docstatus === 0 || inv.docstatus === 2) && (
                                    <div className="pi-dropdown-item" onClick={() => handleDelete(inv.name)}>Delete</div>
                                  )}
                                  {inv.docstatus === 1 && (
                                    <div className="pi-dropdown-item" onClick={() => handleCancel(inv.name)}>Cancel</div>
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
                        <button key={s} onClick={() => { setPageSize(s); setCurrentPage(1); }}
                          className={`pi-page-size-btn ${pageSize === s ? 'active' : ''}`}>{s}</button>
                      ))}
                    </div>
                    <div className="pi-page-nav">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="pi-page-btn">Previous</button>
                      <span className="pi-page-current">Page {currentPage} of {totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="pi-page-btn">Next</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {isModalOpen && (
          <div className="pi-modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="pi-modal" onClick={e => e.stopPropagation()}>
              <div className="pi-modal-header">
                <h2 className="pi-modal-title">
                  {isEditMode ? 'Edit' : isViewMode ? 'View' : 'New'} Purchase Invoice
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="pi-modal-close">
                  <X className="pi-icon" />
                </button>
              </div>

              <div className="pi-modal-body">
                {/* Supplier Info */}
                <div className="pi-form-section">
                  <h3 className="pi-section-title">Supplier Information</h3>
                  <div className="pi-form-grid">
                    <div className="pi-form-group" ref={supplierRef}>
                      <label className="pi-label">Supplier {!isViewMode && <span className="pi-required">*</span>}</label>
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
                      <label className="pi-label">Posting Date {!isViewMode && <span className="pi-required">*</span>}</label>
                      <div className="pi-input-wrapper">
                        <Calendar className="pi-input-icon" />
                        <input type="date" value={formData.posting_date}
                          onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                          className="pi-input" disabled={isViewMode} />
                      </div>
                    </div>

                    <div className="pi-form-group">
                      <label className="pi-label">Due Date</label>
                      <div className="pi-input-wrapper">
                        <Calendar className="pi-input-icon" />
                        <input type="date" value={formData.due_date}
                          onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                          className="pi-input" disabled={isViewMode} />
                      </div>
                    </div>

                    <div className="pi-form-group">
                      <label className="pi-label">Bill Number</label>
                      <input type="text" value={formData.bill_no}
                        onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                        placeholder="Enter bill number..." className="pi-input" disabled={isViewMode} />
                    </div>
                  </div>
                </div>

                

                {/* Items Table - WAREHOUSE COLUMN REMOVED */}
                <div className="pi-form-section">
                  <div className="pi-section-header">
                    <h3 className="pi-section-title">Items</h3>
                    {!isViewMode && <button onClick={addItemRow} className="pi-btn-link"><Plus className="pi-icon-sm" /> Add Item</button>}
                  </div>
                  <div className="pi-items-table-wrapper">
                    <table className="pi-items-table">
                      <thead>
                        <tr>
                          <th className="pi-items-th">Item</th>
                          <th className="pi-items-th" style={{ width: '120px' }}>Qty</th>
                          <th className="pi-items-th" style={{ width: '100px' }}>UOM</th>
                          <th className="pi-items-th" style={{ width: '140px' }}>Rate (AED)</th>
                          <th className="pi-items-th" style={{ width: '140px' }}>Amount (AED)</th>
                          <th className="pi-items-th" style={{ width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i}>
                            <td className="pi-items-td" ref={el => itemRefs.current[i] = el}>
                              {item.item_code ? (
                                <div className="pi-item-selected">{item.item_name}</div>
                              ) : (
                                <div className="pi-item-cell">
                                  <input
                                    type="text"
                                    value={itemSearches[i] || ''}
                                    onChange={e => handleItemSearch(i, e.target.value)}
                                    placeholder="Search item..."
                                    className="pi-items-input"
                                    disabled={isViewMode}
                                  />
                                  {showItemDropdowns[i] && itemsList.length > 0 && !isViewMode && (
                                    <div className="pi-dropdown pi-dropdown-absolute">
                                      {itemsList.map(itm => (
                                        // THIS LINE WAS BROKEN → FIXED ORDER
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
                                value={item.qty || ''}
                                onChange={e => updateItem(i, 'qty', e.target.value)}
                                className="pi-items-input pi-items-input-number"
                                min="1"
                                disabled={isViewMode}
                              />
                            </td>
                            <td className="pi-items-td"><span className="pi-items-text">{item.uom || '-'}</span></td>
                            <td className="pi-items-td">
                              <input
                                type="number"
                                value={item.rate || ''}
                                onChange={e => updateItem(i, 'rate', e.target.value)}
                                className="pi-items-input pi-items-input-number"
                                step="0.01"
                                disabled={isViewMode}
                              />
                            </td>
                            <td className="pi-items-td">
                              <span className="pi-items-amount">
                                {item.amount ? parseFloat(item.amount).toFixed(2) : '0.00'}
                              </span>
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
                </div>

                {/* Discount & Taxes Section */}
                <div className="pi-form-section">
                  <h3 className="pi-section-title">Discount & Taxes</h3>

                  <div className="pi-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="pi-form-group">
                      <label className="pi-label">Apply Discount On</label>
                      <select value={formData.apply_discount_on}
                        onChange={e => setFormData(prev => ({ ...prev, apply_discount_on: e.target.value }))}
                        disabled={isViewMode} className="pi-select">
                        <option>Grand Total</option>
                        <option>Net Total</option>
                      </select>
                    </div>
                    <div className="pi-form-group">
                      <label className="pi-label">Discount (%)</label>
                      <div className="pi-input-wrapper">
                        <Percent className="pi-input-icon" />
                        <input type="number" value={formData.additional_discount_percentage}
                          onChange={e => setFormData(prev => ({ ...prev, additional_discount_percentage: e.target.value, discount_amount: 0 }))}
                          className="pi-input" min="0" max="100" step="0.01" disabled={isViewMode} />
                      </div>
                    </div>
                    <div className="pi-form-group">
                      <label className="pi-label">Discount Amount</label>
                      <div className="pi-input-wrapper">
                        <DollarSign className="pi-input-icon" />
                        <input type="number" value={formData.discount_amount}
                          onChange={e => setFormData(prev => ({ ...prev, discount_amount: e.target.value, additional_discount_percentage: 0 }))}
                          className="pi-input" min="0" step="0.01" disabled={isViewMode} />
                      </div>
                    </div>
                  </div>
                  {/* Tax Template */}
                <div className="pi-form-section">
                  <div className="pi-form-group">
                    <label className="pi-label">Taxes and Charges Template</label>
                    <select value={formData.taxes_and_charges}
                      onChange={e => setFormData(prev => ({ ...prev, taxes_and_charges: e.target.value }))}
                      disabled={isViewMode || loadingTaxTemplates} className="pi-select">
                      <option value="">No Tax</option>
                      {taxTemplates.map(t => (
                        <option key={t.name} value={t.name}>{t.title || t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                  {/*  Tax Table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h4 className="pi-section-title" style={{ marginBottom: '1rem' }}>Purchase Taxes and Charges</h4>
                    {taxPreview.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', color: '#6c757d' }}>
                        <p style={{ margin: 0, fontStyle: 'italic' }}>No tax template selected</p>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
                        <table style={{ width: '100%', backgroundColor: 'white' }}>
                          <thead style={{ backgroundColor: '#f8f9fa' }}>
                            <tr>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Account Head</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>Rate (%)</th>
                              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Amount (AED)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {taxPreview.map((tax, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #dee2e6' }}>
                                <td style={{ padding: '16px' }}>
                                  <span style={{
                                    backgroundColor: '#e3f2fd',
                                    color: '#1976d2',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600'
                                  }}>Actual</span>
                                </td>
                                <td style={{ padding: '16px', fontWeight: '500' }}>{tax.account_head || 'N/A'}</td>
                                <td style={{ padding: '16px', textAlign: 'center' }}>{parseFloat(tax.rate || 0).toFixed(2)}%</td>
                                <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: '#2e7d32' }}>
                                  AED {(netTotal * (parseFloat(tax.rate || 0) / 100)).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Update Stock */}
                  <div style={{ marginBottom: '2rem' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: isViewMode ? 'not-allowed' : 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={formData.update_stock}
                        onChange={e => setFormData(prev => ({ ...prev, update_stock: e.target.checked }))}
                        disabled={isViewMode}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span>Update Stock</span>
                      <span style={{ fontWeight: '400', color: '#666' }}>(Receive items into warehouse)</span>
                    </label>
                  </div>

                  {/* Grand Total Box */}
                  <div style={{
                    backgroundColor: '#f0f8ff',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '2px solid #b3e5fc'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: '500' }}>Net Total:</span>
                      <strong>AED {netTotal.toFixed(2)}</strong>
                    </div>
                    {discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#c62828' }}>
                        <span style={{ fontWeight: '500' }}>Discount:</span>
                        <strong>-AED {discountAmount.toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: '500' }}>Total Tax:</span>
                      <strong>AED {taxTotal.toFixed(2)}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '1rem',
                      borderTop: '3px double #1976d2',
                      fontSize: '1.4rem',
                      fontWeight: 'bold'
                    }}>
                      <span>Grand Total:</span>
                      <span style={{ color: '#1976d2' }}>AED {grandTotal}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pi-modal-footer" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button onClick={() => setIsModalOpen(false)} className="pi-btn-secondary">
                    {isViewMode ? 'Close' : 'Cancel'}
                  </button>
                  {!isViewMode && (
                    <button onClick={handleSave} disabled={saving} className="pi-btn-primary" style={{ minWidth: '160px' }}>
                      {saving ? (
                        <>
                          <Loader2 className="animate-spin" size={20} style={{ marginRight: '8px' }} />
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
          </div>
        )}
      </div>
    </>
  );
}

export default PurchaseInvoiceList;