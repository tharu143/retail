import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, X, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon, Barcode, Edit3,
  Trash2
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import './PurchaseReceiptList.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

function PurchaseReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // NEW: Track rate loading per row
  const [rateLoading, setRateLoading] = useState({});

  const [formData, setFormData] = useState({
    series: 'MAT-PRE-.YYYY.-',
    posting_date: new Date().toISOString().split('T')[0],
    posting_time: new Date().toTimeString().slice(0, 5),
    apply_putaway_rule: false,
    is_return: false,
    supplier: '',
    supplier_name: '',
    supplier_delivery_note: '',
    currency: 'AED',
    buying_price_list: 'Standard Buying',
    items: [{
      item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, uom: '', rate: 0, amount: 0, accepted_warehouse: '', rejected_warehouse: ''
    }],
    taxes_template: '',
    taxes: [],
    net_total: 0,
    grand_total: 0
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

  const [taxesTemplates, setTaxesTemplates] = useState([]);
  const [taxTypes, setTaxTypes] = useState([]); // For tax table types: Actual, On Net Total, etc.

  const [filterName, setFilterName] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const supplierRef = useRef(null);
  const itemRefs = useRef({});
  const warehouseRefs = useRef({});

  useEffect(() => {
    fetchReceipts();
    fetchWarehouses();
    fetchTaxesTemplates();
    fetchTaxTypes();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_receipts`, { withCredentials: true });
      if (res.data.message?.success) {
        setReceipts(res.data.message.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async (query = '') => {
    try {
      const res = await axios.get(`${API_PATH}.get_suppliers`, {
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
      const res = await axios.get(`${API_PATH}.get_items_for_pr`, {
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

  const fetchTaxesTemplates = async () => {
    try {
      const company = await getDefaultCompany();
      const res = await axios.get(`${API_PATH}.get_purchase_taxes_templates`, {
        params: { company: company.company },
        withCredentials: true
      });
      setTaxesTemplates(res.data.message || []);
    } catch (err) {
      console.error('Taxes templates fetch error:', err);
    }
  };

  const fetchTaxTypes = async () => {
    // Hardcode common tax types for now: Actual, On Net Total, On Previous Row Amount, etc.
    setTaxTypes(['Actual', 'On Net Total', 'On Previous Row Amount', 'Compound']);
  };

  const getDefaultCompany = async () => {
    try {
      const res = await axios.get(`${API_PATH}.get_default_company`, { withCredentials: true });
      return res.data.message;
    } catch (err) {
      return { company: '' };
    }
  };

  // UPDATED: Fetch rate after item selection (proceed even without supplier for general rate)
  const fetchItemRate = useCallback(async (rowIndex, itemCode) => {
    if (!itemCode) {
      console.warn('Item code missing; skipping rate fetch.');
      return;
    }
    // Show loading
    setRateLoading(prev => ({ ...prev, [rowIndex]: true }));
    try {
      console.log(`Fetching rate for item ${itemCode}, supplier: ${formData.supplier || 'none'}`);
      const params = {
        item_code: itemCode,
        buying_price_list: formData.buying_price_list
      };
      if (formData.supplier) params.supplier = formData.supplier;
      const res = await axios.get(`${API_PATH}.get_item_buying_rate_pr`, {
        params,
        withCredentials: true
      });
      console.log('Rate API response:', res.data); // DEBUG: Check full response
      if (res.data.message?.success) {
        const rate = res.data.message.rate || 0;
        console.log(`Setting rate ${rate} for row ${rowIndex}`);
        updateItem(rowIndex, 'rate', rate);
      } else {
        console.error('Rate fetch failed:', res.data.message?.message || 'Unknown error');
        // Fallback to 0 (already default)
      }
    } catch (err) {
      console.error('Error fetching item rate:', err.response?.data || err.message);
    } finally {
      setRateLoading(prev => ({ ...prev, [rowIndex]: false }));
    }
  }, [formData.supplier, formData.buying_price_list]);

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

  useEffect(() => {
    const handleClickOutside = (e) => {
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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCreateModal = useCallback(() => {
    const defaultWarehouse = warehouses.length > 0 ? warehouses[0].warehouse_name : '';
    setFormData({
      series: 'MAT-PRE-.YYYY.-',
      posting_date: new Date().toISOString().split('T')[0],
      posting_time: new Date().toTimeString().slice(0, 5),
      apply_putaway_rule: false,
      is_return: false,
      supplier: '', supplier_name: '',
      supplier_delivery_note: '',
      currency: 'AED',
      buying_price_list: 'Standard Buying',
      items: [{
        item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, uom: '', rate: 0, amount: 0, accepted_warehouse: defaultWarehouse, rejected_warehouse: ''
      }],
      taxes_template: '',
      taxes: [],
      net_total: 0,
      grand_total: 0
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
    setRateLoading({}); // Reset loading
    setIsModalOpen(true);
  }, [warehouses]);

  // UPDATED: Fix net_total to use new 'items' (not stale formData.items)
  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index][field] = value;
      if (field === 'accepted_qty' || field === 'rejected_qty' || field === 'rate') {
        const accepted_qty = parseFloat(items[index].accepted_qty) || 0;
        const rejected_qty = parseFloat(items[index].rejected_qty) || 0;
        const rate = parseFloat(items[index].rate) || 0;
        items[index].amount = ((accepted_qty + rejected_qty) * rate).toFixed(2);
      }
      // FIXED: Use 'items' for recalc (not formData.items)
      const net_total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      return { ...prev, items, net_total };
    });
  };

  const addItemRow = useCallback(() => {
    const defaultWarehouse = warehouses.length > 0 ? warehouses[0].warehouse_name : '';
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, uom: '', rate: 0, amount: 0, accepted_warehouse: defaultWarehouse, rejected_warehouse: '' }]
    }));
  }, [warehouses]);

  const removeItemRow = (index) => {
    setFormData(prev => {
      const items = prev.items.filter((_, i) => i !== index);
      const net_total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      return { ...prev, items, net_total };
    });
  };

  const selectSupplier = (supplier) => {
    setFormData(prev => ({ ...prev, supplier: supplier.name, supplier_name: supplier.supplier_name }));
    setSearchSupplier(supplier.supplier_name || supplier.name);
    setShowSupplierDropdown(false);
    // OPTIONAL: Re-fetch rates for existing items if supplier changes
    formData.items.forEach((item, idx) => {
      if (item.item_code) fetchItemRate(idx, item.item_code);
    });
  };

  // UPDATED: Non-blocking async (fire-and-forget)
  const selectItem = (rowIndex, item) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[rowIndex] = {
        ...items[rowIndex],
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos'
      };
      return { ...prev, items };
    });
    setItemSearches(prev => ({ ...prev, [rowIndex]: item.item_name }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));

    // Fetch rate (non-blocking)
    fetchItemRate(rowIndex, item.item_code);
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

  const selectWarehouse = (rowIndex, field, warehouse) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[rowIndex][field] = warehouse.warehouse_name;
      return { ...prev, items };
    });
    setSearchWarehouse(prev => ({ ...prev, [rowIndex]: warehouse.warehouse_name }));
    setShowWarehouseDropdowns(prev => ({ ...prev, [rowIndex]: false }));
  };

  const handleWarehouseSearch = (index, field, value) => {
    setSearchWarehouse(prev => ({ ...prev, [index]: value }));
    if (value.trim().length > 0) {
      setShowWarehouseDropdowns(prev => ({ ...prev, [index]: true }));
    } else {
      setShowWarehouseDropdowns(prev => ({ ...prev, [index]: false }));
    }
  };

  const addTaxRow = () => {
    setFormData(prev => ({
      ...prev,
      taxes: [...prev.taxes, { type: '', account_head: '', tax_rate: 0, amount: 0, total: 0 }]
    }));
  };

  const updateTax = (index, field, value) => {
    setFormData(prev => {
      const taxes = [...prev.taxes];
      taxes[index][field] = value;
      // Recalculate total for this tax if needed
      if (field === 'tax_rate' || field === 'amount') {
        const tax_rate = parseFloat(taxes[index].tax_rate) || 0;
        const amount = parseFloat(taxes[index].amount) || 0;
        taxes[index].total = (tax_rate / 100 * prev.net_total + amount).toFixed(2);
      }
      // Recalculate grand total
      const taxes_total = taxes.reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
      return { ...prev, taxes, grand_total: (prev.net_total + taxes_total).toFixed(2) };
    });
  };

  const removeTaxRow = (index) => {
    setFormData(prev => {
      const taxes = prev.taxes.filter((_, i) => i !== index);
      const taxes_total = taxes.reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
      return { ...prev, taxes, grand_total: (prev.net_total + taxes_total).toFixed(2) };
    });
  };

  const handleTaxesTemplateChange = (template) => {
    setFormData(prev => {
      // Fetch and populate taxes from template
      // For now, simulate
      const newTaxes = template ? [{ type: 'On Net Total', account_head: 'VAT - KSPL', tax_rate: 5, amount: 0, total: 0 }] : [];
      const taxes_total = newTaxes.reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
      return { ...prev, taxes_template: template, taxes: newTaxes, grand_total: (prev.net_total + taxes_total).toFixed(2) };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && (i.accepted_qty > 0 || i.rejected_qty > 0)).length === 0) {
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
      posting_time: formData.posting_time,
      apply_putaway_rule: formData.apply_putaway_rule,
      is_return: formData.is_return,
      supplier_delivery_note: formData.supplier_delivery_note,
      items: formData.items
        .filter(i => i.item_code && (i.accepted_qty > 0 || i.rejected_qty > 0))
        .map(i => ({
          item_code: i.item_code,
          accepted_qty: parseFloat(i.accepted_qty),
          rejected_qty: parseFloat(i.rejected_qty),
          rate: parseFloat(i.rate || 0),
          amount: parseFloat(i.amount || 0),
          warehouse: i.accepted_warehouse,
          rejected_warehouse: i.rejected_warehouse,
          uom: i.uom
        })),
      taxes: formData.taxes.map(t => ({
        charge_type: t.type,
        account_head: t.account_head,
        rate: parseFloat(t.tax_rate),
        tax_amount: parseFloat(t.amount)
      }))
    };

    try {
      const res = await axios.post(`${API_PATH}.create_purchase_receipt_direct`, payload, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.data.message?.success) {
        alert('Purchase Receipt Created: ' + res.data.message.name);
        setIsModalOpen(false);
        fetchReceipts();
      } else {
        alert(res.data.message?.message || 'Failed to create');
      }
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter(rec => {
      const matchesName = !filterName || rec.name.toLowerCase().includes(filterName.toLowerCase());
      const matchesSupplier = !filterSupplier || rec.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
      const matchesStatus = !filterStatus || rec.status === filterStatus;
      const matchesFrom = !filterDateFrom || new Date(rec.posting_date) >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || new Date(rec.posting_date) <= new Date(filterDateTo);
      return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [receipts, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredReceipts.length;
  const paginated = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const map = {
      'Completed': 'status-paid',
      'To Bill': 'status-unpaid',
      'Draft': 'status-draft',
      'Return Issued': 'status-return',
      'Cancelled': 'status-overdue',
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
      <div className="pr-container">
        <div className="pr-header">
          <div className="pr-header-left">
            <h1 className="pr-title">Purchase Receipts</h1>
            <span className="pr-count">{total} total</span>
          </div>
          <div className="pr-header-actions">
            <button onClick={() => setShowFilters(!showFilters)} className="pr-btn-secondary">
              <Filter className="pr-icon" />
              Filters
            </button>
            <button className="pr-btn-secondary">
              <Download className="pr-icon" />
              Export
            </button>
            <button onClick={openCreateModal} className="pr-btn-primary">
              <Plus className="pr-icon" />
              Create Receipt
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="pr-filters">
            <div className="pr-filters-grid">
              <div className="pr-filter-item">
                <label>Receipt Number</label>
                <div className="pr-input-wrapper">
                  <Search className="pr-input-icon" />
                  <input
                    type="text"
                    placeholder="Search receipt..."
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>Supplier</label>
                <div className="pr-input-wrapper">
                  <Building2 className="pr-input-icon" />
                  <input
                    type="text"
                    placeholder="Search supplier..."
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pr-select">
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="To Bill">To Bill</option>
                  <option value="Completed">Completed</option>
                  <option value="Return Issued">Return Issued</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="pr-filter-item">
                <label>From Date</label>
                <div className="pr-input-wrapper">
                  <Calendar className="pr-input-icon" />
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>To Date</label>
                <div className="pr-input-wrapper">
                  <Calendar className="pr-input-icon" />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-actions">
                <button onClick={clearFilters} className="pr-btn-ghost">Clear</button>
              </div>
            </div>
          </div>
        )}

        <main className="pr-main">
          {loading ? (
            <div className="pr-loading">
              <div className="pr-spinner"></div>
              <p>Loading receipts...</p>
            </div>
          ) : (
            <div className="pr-table-container">
              <div className="pr-table-wrapper">
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th className="pr-th-checkbox">
                        <input type="checkbox" className="pr-checkbox" />
                      </th>
                      <th className="pr-th">Receipt Number</th>
                      <th className="pr-th">Supplier</th>
                      <th className="pr-th">Date</th>
                      <th className="pr-th">Status</th>
                      <th className="pr-th-right">Amount</th>
                      <th className="pr-th-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="pr-empty">
                          <Package className="pr-empty-icon" />
                          <p>No receipts found</p>
                          <button onClick={openCreateModal} className="pr-btn-link">Create your first receipt</button>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(rec => (
                        <tr key={rec.name} className="pr-tr">
                          <td className="pr-td-checkbox">
                            <input type="checkbox" className="pr-checkbox" onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="pr-td" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <span className="pr-receipt-number">{rec.name}</span>
                          </td>
                          <td className="pr-td" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <div className="pr-supplier">
                              <span className="pr-supplier-name">{rec.supplier_name}</span>
                              <span className="pr-supplier-code">{rec.supplier}</span>
                            </div>
                          </td>
                          <td className="pr-td" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <span className="pr-date">{format(new Date(rec.posting_date), 'dd MMM yyyy')}</span>
                          </td>
                          <td className="pr-td" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <span className={`pr-status ${getStatusColor(rec.status)}`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="pr-td-right" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <span className="pr-amount">AED {rec.base_net_total?.toFixed(2)}</span>
                          </td>
                          <td className="pr-td-actions">
                            <button className="pr-btn-icon" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="pr-icon" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {total > 0 && (
                <div className="pr-pagination">
                  <div className="pr-pagination-info">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} receipts
                  </div>
                  <div className="pr-pagination-controls">
                    <div className="pr-page-size">
                      <span>Rows:</span>
                      {[20, 50, 100].map(s => (
                        <button
                          key={s}
                          onClick={() => { setPageSize(s); setCurrentPage(1); }}
                          className={`pr-page-size-btn ${pageSize === s ? 'active' : ''}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="pr-page-nav">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="pr-page-btn"
                      >
                        Previous
                      </button>
                      <span className="pr-page-current">Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="pr-page-btn"
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
          <div className="pr-modal-overlay">
            <div className="pr-modal">
              <div className="pr-modal-header">
                <div>
                  <h2 className="pr-modal-title">Create Purchase Receipt</h2>
                  <p className="pr-modal-subtitle">Add supplier details and items to create a new receipt</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="pr-modal-close">
                  <X className="pr-icon" />
                </button>
              </div>

              <div className="pr-modal-body">
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Receipt Information</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Series</label>
                      <input
                        type="text"
                        value={formData.series}
                        onChange={e => setFormData(prev => ({ ...prev, series: e.target.value }))}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Date *</label>
                      <div className="pr-input-wrapper">
                        <Calendar className="pr-input-icon" />
                        <input
                          type="date"
                          value={formData.posting_date}
                          onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                          className="pr-input"
                        />
                      </div>
                    </div>
                    <div className="pr-form-group">
                      <label>Posting Time *</label>
                      <div className="pr-input-wrapper">
                        <Calendar className="pr-input-icon" />
                        <input
                          type="time"
                          value={formData.posting_time}
                          onChange={e => setFormData(prev => ({ ...prev, posting_time: e.target.value }))}
                          className="pr-input"
                        />
                      </div>
                    </div>
                    <div className="pr-form-group">
                      <label className="pr-checkbox-group">
                        <input
                          type="checkbox"
                          checked={formData.apply_putaway_rule}
                          onChange={e => setFormData(prev => ({ ...prev, apply_putaway_rule: e.target.checked }))}
                        />
                        Apply Putaway Rule
                      </label>
                    </div>
                    <div className="pr-form-group">
                      <label className="pr-checkbox-group">
                        <input
                          type="checkbox"
                          checked={formData.is_return}
                          onChange={e => setFormData(prev => ({ ...prev, is_return: e.target.checked }))}
                        />
                        Is Return
                      </label>
                    </div>
                    <div className="pr-form-group" ref={supplierRef}>
                      <label className="pr-label">
                        Supplier <span className="pr-required">*</span>
                      </label>
                      <div className="pr-input-wrapper">
                        <Building2 className="pr-input-icon" />
                        <input
                          type="text"
                          value={searchSupplier}
                          onChange={e => setSearchSupplier(e.target.value)}
                          onFocus={() => searchSupplier && setShowSupplierDropdown(true)}
                          placeholder="Search and select supplier..."
                          className={`pr-input ${formErrors.supplier ? 'pr-input-error' : ''}`}
                        />
                      </div>
                      {showSupplierDropdown && suppliers.length > 0 && (
                        <div className="pr-dropdown">
                          {suppliers.map(s => (
                            <div key={s.name} onClick={() => selectSupplier(s)} className="pr-dropdown-item">
                              <div className="pr-dropdown-main">{s.supplier_name}</div>
                              <div className="pr-dropdown-sub">{s.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {formErrors.supplier && <span className="pr-error">{formErrors.supplier}</span>}
                    </div>
                    <div className="pr-form-group">
                      <label>Supplier Delivery Note</label>
                      <input
                        type="text"
                        value={formData.supplier_delivery_note}
                        onChange={e => setFormData(prev => ({ ...prev, supplier_delivery_note: e.target.value }))}
                        placeholder="Enter delivery note..."
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Currency</label>
                      <input
                        type="text"
                        value={formData.currency}
                        onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Buying Price List</label>
                      <input
                        type="text"
                        value={formData.buying_price_list}
                        onChange={e => setFormData(prev => ({ ...prev, buying_price_list: e.target.value }))}
                        className="pr-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="pr-form-section">
                  <div className="pr-section-header">
                    <h3 className="pr-section-title">Items</h3>
                    <div>
                      <input type="text" placeholder="Scan Barcode" className="pr-input pr-scan-input" />
                      <button onClick={addItemRow} className="pr-btn-link">
                        <Plus className="pr-icon-sm" />
                        Add Row
                      </button>
                    </div>
                  </div>

                  <div className="pr-items-table-wrapper">
                    <table className="pr-items-table">
                      <thead>
                        <tr>
                          <th className="pr-items-th">Item</th>
                          <th className="pr-items-th" style={{width: '100px'}}>Accepted Qty</th>
                          <th className="pr-items-th" style={{width: '80px'}}>Rejected Qty</th>
                          <th className="pr-items-th" style={{width: '80px'}}>UOM</th>
                          <th className="pr-items-th" style={{width: '120px'}}>Rate (AED)</th>
                          <th className="pr-items-th" style={{width: '120px'}}>Amount (AED)</th>
                          <th className="pr-items-th" style={{width: '150px'}}>Accepted Warehouse</th>
                          <th className="pr-items-th" style={{width: '150px'}}>Rejected Warehouse</th>
                          <th className="pr-items-th" style={{width: '50px'}}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i} className="pr-items-tr">
                            <td className="pr-items-td" ref={el => itemRefs.current[i] = el}>
                              <div className="pr-item-cell">
                                <input
                                  type="text"
                                  value={itemSearches[i] || ''}
                                  onChange={e => handleItemSearch(i, e.target.value)}
                                  onFocus={() => itemSearches[i] && setShowItemDropdowns(prev => ({ ...prev, [i]: true }))}
                                  placeholder="Search item..."
                                  className="pr-items-input"
                                />
                                {showItemDropdowns[i] && itemsList.length > 0 && (
                                  <div className="pr-dropdown pr-dropdown-absolute">
                                    {itemsList.map(itm => (
                                      <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="pr-dropdown-item">
                                        <div className="pr-dropdown-main">{itm.item_name}</div>
                                        <div className="pr-dropdown-sub">{itm.item_code}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {item.item_name && (
                                  <div className="pr-item-selected">
                                    {item.item_name}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.accepted_qty}
                                onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                min="0"
                              />
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.rejected_qty}
                                onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                min="0"
                              />
                            </td>
                            <td className="pr-items-td">
                              <span className="pr-items-text">{item.uom || '-'}</span>
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={e => updateItem(i, 'rate', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                                placeholder={rateLoading[i] ? "Fetching..." : "Enter rate or auto-fetch"}
                                disabled={rateLoading[i]} // Brief disable during fetch
                              />
                              {rateLoading[i] && <small className="pr-rate-loading">Fetching rate...</small>}
                            </td>
                            <td className="pr-items-td">
                              <span className="pr-items-amount">{item.amount || '0.00'}</span>
                            </td>
                            <td className="pr-items-td" ref={el => warehouseRefs.current[`${i}_accepted`] = el}>
                              <div className="pr-warehouse-cell">
                                <WarehouseIcon className="pr-warehouse-icon" />
                                <input
                                  type="text"
                                  value={searchWarehouse[i] || item.accepted_warehouse}
                                  onChange={e => handleWarehouseSearch(i, 'accepted_warehouse', e.target.value)}
                                  onFocus={() => setShowWarehouseDropdowns(prev => ({ ...prev, [i]: true }))}
                                  placeholder="Accepted Warehouse..."
                                  className="pr-items-input"
                                />
                                {showWarehouseDropdowns[i] && warehouses.length > 0 && (
                                  <div className="pr-dropdown pr-dropdown-absolute">
                                    {warehouses.map(wh => (
                                      <div key={wh.name} onClick={() => selectWarehouse(i, 'accepted_warehouse', wh)} className="pr-dropdown-item">
                                        <div className="pr-dropdown-main">{wh.warehouse_name}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="pr-items-td" ref={el => warehouseRefs.current[`${i}_rejected`] = el}>
                              <div className="pr-warehouse-cell">
                                <WarehouseIcon className="pr-warehouse-icon" />
                                <input
                                  type="text"
                                  value={searchWarehouse[`${i}_rejected`] || item.rejected_warehouse}
                                  onChange={e => handleWarehouseSearch(i, 'rejected_warehouse', e.target.value)}
                                  onFocus={() => setShowWarehouseDropdowns(prev => ({ ...prev, [`${i}_rejected`]: true }))}
                                  placeholder="Rejected Warehouse..."
                                  className="pr-items-input"
                                />
                                {showWarehouseDropdowns[`${i}_rejected`] && warehouses.length > 0 && (
                                  <div className="pr-dropdown pr-dropdown-absolute">
                                    {warehouses.map(wh => (
                                      <div key={wh.name} onClick={() => selectWarehouse(i, 'rejected_warehouse', wh)} className="pr-dropdown-item">
                                        <div className="pr-dropdown-main">{wh.warehouse_name}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="pr-items-td">
                              <button onClick={() => removeItemRow(i)} className="pr-btn-delete">
                                <Trash2 className="pr-icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {formErrors.items && <span className="pr-error">{formErrors.items}</span>}
                  <div className="pr-totals-row">
                    <span>Total Quantity: {formData.items.reduce((sum, i) => sum + (parseFloat(i.accepted_qty || 0) + parseFloat(i.rejected_qty || 0)), 0)}</span>
                    <span>Net Total: AED {formData.net_total}</span>
                  </div>
                </div>

                <div className="pr-form-section">
                  <h3 className="pr-section-title">Taxes and Charges</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Purchase Taxes and Charges Template</label>
                      <select
                        value={formData.taxes_template}
                        onChange={e => handleTaxesTemplateChange(e.target.value)}
                        className="pr-select"
                      >
                        <option value="">Select Template</option>
                        {taxesTemplates.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pr-taxes-table-wrapper">
                    <table className="pr-taxes-table">
                      <thead>
                        <tr>
                          <th className="pr-taxes-th">No</th>
                          <th className="pr-taxes-th">Type *</th>
                          <th className="pr-taxes-th">Account Head *</th>
                          <th className="pr-taxes-th">Tax Rate</th>
                          <th className="pr-taxes-th">Amount</th>
                          <th className="pr-taxes-th">Total</th>
                          <th className="pr-taxes-th"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.taxes.map((tax, i) => (
                          <tr key={i}>
                            <td className="pr-taxes-td">{i + 1}</td>
                            <td className="pr-taxes-td">
                              <select
                                value={tax.type}
                                onChange={e => updateTax(i, 'type', e.target.value)}
                                className="pr-items-input"
                              >
                                <option value="">Select Type</option>
                                {taxTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="text"
                                value={tax.account_head}
                                onChange={e => updateTax(i, 'account_head', e.target.value)}
                                placeholder="Account Head"
                                className="pr-items-input"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="number"
                                value={tax.tax_rate}
                                onChange={e => updateTax(i, 'tax_rate', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="number"
                                value={tax.amount}
                                onChange={e => updateTax(i, 'amount', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <span className="pr-items-amount">{tax.total || '0.00'}</span>
                            </td>
                            <td className="pr-taxes-td">
                              <button onClick={() => removeTaxRow(i)} className="pr-btn-delete">
                                <Trash2 className="pr-icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={addTaxRow} className="pr-btn-link">
                      <Plus className="pr-icon-sm" />
                      Add Row
                    </button>
                  </div>
                  <div className="pr-totals-section">
                    <div className="pr-total-row">
                      <span className="pr-total-label">Net Total:</span>
                      <span className="pr-total-amount">AED {formData.net_total}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Taxes and Charges Added:</span>
                      <span className="pr-total-amount">AED 0.00</span> {/* Calculate based on added */}
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Taxes and Charges Deducted:</span>
                      <span className="pr-total-amount">AED 0.00</span> {/* Calculate based on deducted */}
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Total Taxes and Charges:</span>
                      <span className="pr-total-amount">AED {formData.taxes.reduce((sum, t) => sum + parseFloat(t.total || 0), 0)}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Grand Total:</span>
                      <span className="pr-total-amount">AED {formData.grand_total}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Rounding Adjustment:</span>
                      <span className="pr-total-amount">AED 0.00</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pr-modal-footer">
                <button onClick={() => setIsModalOpen(false)} className="pr-btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="pr-btn-primary">
                  {saving ? (
                    <>
                      <div className="pr-btn-spinner"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Receipt'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default PurchaseReceiptList;