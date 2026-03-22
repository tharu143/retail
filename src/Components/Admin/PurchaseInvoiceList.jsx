import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, X, Trash2, Building2, Search, Calendar, Filter, MoreVertical, Package,
  Warehouse as WarehouseIcon, Percent, DollarSign, Loader2, Barcode, Palette, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import '../Admin/SalesOrder.css';

// Custom APIs (kept for suppliers, items, warehouses, tax templates)
const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

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
  const [docName, setDocName] = useState('');
  const [docStatus, setDocStatus] = useState(null);
  const theme = useSelector(state => state.user.theme);

  // Theme toggle (synced across pages)
  const [piTheme, setPiTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = piTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', piTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [piTheme, themeColor, themeColorHover, themeLight]);

  const [taxTemplates, setTaxTemplates] = useState([]);
  const [loadingTaxTemplates, setLoadingTaxTemplates] = useState(false);
  const [taxPreview, setTaxPreview] = useState([]);

  // NEW: Warehouses State (filtered for non-group)
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    name: '', supplier: '', supplier_name: '',
    posting_date: new Date().toISOString().split('T')[0],
    due_date: '', bill_no: '',
    update_stock: true,
    accepted_warehouse: '',
    rejected_warehouse: '',
    is_subcontracted: false,
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

  // NEW: Barcode Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const barcodeRef = useRef(null);

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
    fetchWarehouses(); // NEW: Fetch warehouses
  }, []);

  // NEW: Auto-set default accepted warehouse if needed
  useEffect(() => {
    if (formData.update_stock && formData.accepted_warehouse === '' && warehouses.length > 0) {
      setFormData(prev => ({ ...prev, accepted_warehouse: warehouses[0].name }));
    }
  }, [warehouses, formData.update_stock, formData.accepted_warehouse]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  // FIXED: Fetch Warehouses (only non-group nodes)
  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_PATH}.get_company_warehouses`, {
        params: { is_group: 0 }, // NEW: Filter for leaf nodes only
        withCredentials: true
      });
      setWarehouses(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
      // Fallback: Fetch all and filter client-side
      try {
        const fallbackRes = await axios.get(`${API_PATH}.get_warehouses`, { withCredentials: true });
        const allWh = Array.isArray(fallbackRes.data.message) ? fallbackRes.data.message : [];
        setWarehouses(allWh.filter(w => w.is_group === 0)); // Client-side filter if API doesn't support
      } catch (fallbackErr) {
        console.error('Fallback warehouse fetch failed:', fallbackErr);
      }
    }
  };

  // NEW: Handle Barcode Scan on Enter
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      setBarcodeLoading(true);
      try {
        // Call API to fetch item by barcode (enhance backend if needed)
        const res = await axios.get(`${API_PATH}.get_item_by_barcode_pi`, {
          params: { barcode: barcodeInput.trim() },
          withCredentials: true
        });
        const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;

        if (item && item.item_code) {
          // Add to last row or create new row
          const lastIndex = formData.items.length - 1;
          if (formData.items[lastIndex].item_code) {
            // Create new row if last is filled
            addItemRow();
          }
          // Select item in the last row
          await selectItem(lastIndex, item);
        } else {
          alert('Item not found for barcode: ' + barcodeInput);
        }
      } catch (err) {
        console.error('Barcode fetch error:', err);
        alert('Error fetching item by barcode');
      } finally {
        setBarcodeLoading(false);
        setBarcodeInput(''); // Clear input after scan
        barcodeRef.current?.focus(); // Refocus for next scan
      }
    }
  };

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
      const res = await axios.get(`${API_PATH}.get_purchase_invoices`, { params: { limit: 2000, limit_page_length: 2000 }, withCredentials: true });
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
      accepted_warehouse: '',
      rejected_warehouse: '',
      is_subcontracted: false,
      apply_discount_on: 'Grand Total',
      additional_discount_percentage: 0,
      discount_amount: 0,
      taxes_and_charges: '',
      items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0 }]
    });
    setFormErrors({});
    setSearchSupplier('');
    setTaxPreview([]);
    setDocName('');
    setDocStatus(null);
    setBarcodeInput(''); // NEW: Reset barcode
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
          accepted_warehouse: d.accepted_warehouse || '',
          rejected_warehouse: d.rejected_warehouse || '',
          is_subcontracted: !!d.is_subcontracted,
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
        setDocName(d.name);
        setDocStatus(d.docstatus || 0); // Store docstatus
      }
    } catch (err) {
      alert('Failed to load invoice');
    }
  };

  const openEditModal = async (invoice) => {
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
    if (invoice.status === 'Draft') {
      openEditModal(invoice);
    } else {
      openViewModal(invoice);
    }
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

  const getPayload = async () => {
    // Calculate net total before discount
    const itemsTotal = formData.items
      .filter(i => i.item_code && i.qty > 0)
      .reduce((sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0);

    const discountAmountCalc = formData.additional_discount_percentage > 0
      ? (itemsTotal * formData.additional_discount_percentage) / 100
      : parseFloat(formData.discount_amount) || 0;

    const netTotalCalc = itemsTotal - discountAmountCalc;

    // Build taxes array from taxPreview
    const taxes = taxPreview.map(tax => ({
      charge_type: "On Net Total",        // or "Actual" if needed
      account_head: tax.account_head,
      rate: parseFloat(tax.rate || 0),
      tax_amount: netTotalCalc * (parseFloat(tax.rate || 0) / 100),
      description: tax.description || tax.account_head
    }));

    return {
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      due_date: formData.due_date || null,
      bill_no: formData.bill_no || null,
      update_stock: formData.update_stock ? 1 : 0,
      accepted_warehouse: formData.update_stock ? formData.accepted_warehouse : null,
      rejected_warehouse: formData.update_stock ? formData.rejected_warehouse : null,
      is_subcontracted: formData.is_subcontracted ? 1 : 0,
      apply_discount_on: formData.apply_discount_on,
      additional_discount_percentage: formData.additional_discount_percentage > 0 ? parseFloat(formData.additional_discount_percentage) : null,
      discount_amount: formData.discount_amount > 0 ? parseFloat(formData.discount_amount) : null,
      taxes_and_charges: formData.taxes_and_charges || null,
      taxes: taxes.length > 0 ? taxes : null,
      items: formData.items
        .filter(i => i.item_code && i.qty > 0)
        .map(i => ({
          item_code: i.item_code,
          qty: parseFloat(i.qty) || 1,
          rate: parseFloat(i.rate || 0),
          warehouse: formData.update_stock ? formData.accepted_warehouse : '',
          target_warehouse: formData.update_stock ? formData.accepted_warehouse : ''
        }))
    };
  };

  const handleSaveDraft = async () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const payload = await getPayload();

    try {
      let response;
      const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
      if (docName) {
        // Existing draft → UPDATE (PUT)
        response = await axios.put(`${RESOURCE_API}/${docName}`, payload, { withCredentials: true });
        alert(`Draft updated: ${docName}`);
      } else {
        // New → CREATE (POST) using create_generic_doc
        response = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: payload
        }, { withCredentials: true });
        const apiResp = response.data.message || response.data;
        if (apiResp.name) {
          setDocName(apiResp.name);
          alert(`Draft saved: ${apiResp.name}`);
        } else {
          throw new Error('Failed to create draft');
        }
      }
      setDocStatus(0); // Set as draft after save
      fetchInvoices();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.exception || 'Save failed';
      alert("Error: " + msg);
      console.error(err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const payload = await getPayload();
    try {
      let name = docName;
      if (!name) {
        const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
        // First save as draft using generic doc creator
        const createRes = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: payload
        }, { withCredentials: true });
        const apiResp = createRes.data.message || createRes.data;
        if (!apiResp.name) throw new Error('Create failed');
        name = apiResp.name;
        setDocName(name);
      }
      // Submit
      await axios.put(`${RESOURCE_API}/${name}`, { docstatus: 1 }, { withCredentials: true });
      alert(`Purchase Invoice Submitted: ${name}`);
      setIsModalOpen(false);
      setDocName('');
      setDocStatus(null);
      fetchInvoices();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.exception || 'Submit failed';
      alert("Error: " + msg);
      console.error(err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name) => {
    if (confirm('Delete this draft?')) {
      try {
        await axios.delete(`${RESOURCE_API}/${name}`, { withCredentials: true });
        fetchInvoices();
        setShowActions(null);
      } catch (err) {
        alert('Delete failed');
      }
    }
  };

  const handleCancel = async (name) => {
    if (confirm('Cancel this invoice?')) {
      try {
        await axios.put(`${RESOURCE_API}/${name}`, { docstatus: 2 }, { withCredentials: true });
        fetchInvoices();
        setShowActions(null);
      } catch (err) {
        alert('Cancel failed');
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDocName('');
    setDocStatus(null);
    setIsEditMode(false);
    setIsViewMode(false);
    setFormErrors({});
    setBarcodeInput(''); // NEW: Reset barcode on close
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

  useEffect(() => {
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart));
      const nameFromUrl = params.get('name');
      if (nameFromUrl) {
        setTimeout(() => openEditModal({ name: nameFromUrl }), 500);
      }
    }
  }, []);

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title">
              <Package size={20} /> Purchase Invoices
            </h1>
            <p className="so-page-subtitle">{total} total record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setPiTheme(isGreen ? 'blue' : 'green')}
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
              {piTheme.toUpperCase()}
            </button>

            <button onClick={openCreateModal} className="so-btn-primary">
              <Plus size={16} /> Create Invoice
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
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Invoice Number</label>
              <input
                type="text"
                placeholder="Search invoice..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Supplier</label>
              <input
                type="text"
                placeholder="Search supplier..."
                value={filterSupplier}
                onChange={e => setFilterSupplier(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="so-filter-input"
                style={{ padding: '0.45rem' }}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Return">Return</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <button onClick={clearFilters} className="so-clear-btn" style={{ margin: 0, height: '38px' }}>
              Clear
            </button>
          </div>

          {/* Table Area */}
          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{total} record(s) found</p>
            <div className="so-table-card">
              {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                  <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading invoices...</p>
                </div>
              ) : (
                <>
                  <div className="so-table-wrapper">
                    <table className="so-table">
                      <thead>
                        <tr>
                          <th>Invoice Number</th>
                          <th>Supplier</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="so-empty">
                              <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                              <p>No invoices found</p>
                              <button onClick={openCreateModal} style={{ color: themeColor, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                Create your first invoice
                              </button>
                            </td>
                          </tr>
                        ) : (
                          paginated.map(inv => (
                            <tr key={inv.name} onClick={() => handleRowClick(inv)} style={{ cursor: 'pointer' }}>
                              <td>
                                <span style={{ fontWeight: 700, color: themeColor }}>{inv.name}</span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{inv.supplier_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.supplier}</div>
                              </td>
                              <td>
                                <span style={{ color: '#475569', fontSize: '0.85rem' }}>{format(new Date(inv.posting_date), 'dd MMM yyyy')}</span>
                              </td>
                              <td>
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                  backgroundColor: inv.status === 'Paid' ? `${themeColor}20` : (inv.status === 'Unpaid' ? '#fef9c3' : (inv.status === 'Draft' ? '#f1f5f9' : '#fee2e2')),
                                  color: inv.status === 'Paid' ? themeColor : (inv.status === 'Unpaid' ? '#854d0e' : (inv.status === 'Draft' ? '#64748b' : '#ef4444')),
                                  border: `1px solid ${inv.status === 'Paid' ? `${themeColor}40` : (inv.status === 'Unpaid' ? '#fde047' : (inv.status === 'Draft' ? '#e2e8f0' : '#fecaca'))}`
                                }}>
                                  {inv.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                AED {inv.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div ref={el => actionsRefs.current[inv.name] = el} style={{ position: 'relative' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                                    onClick={() => setShowActions(showActions === inv.name ? null : inv.name)}
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {showActions === inv.name && (
                                    <div style={{
                                      position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                                      zIndex: 100, background: '#fff', border: '1px solid var(--so-border)',
                                      borderRadius: '0.5rem', boxShadow: 'var(--so-shadow)',
                                      minWidth: '120px', overflow: 'hidden'
                                    }}>
                                      {inv.status === 'Draft' && (
                                        <button
                                          style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer' }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                          onClick={() => handleDelete(inv.name)}
                                        >
                                          Delete
                                        </button>
                                      )}
                                      {inv.status !== 'Draft' && inv.status !== 'Cancelled' && (
                                        <button
                                          style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer' }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                          onClick={() => handleCancel(inv.name)}
                                        >
                                          Cancel
                                        </button>
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
                    <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                          {[20, 50, 100].map(s => (
                            <button key={s} onClick={() => { setPageSize(s); setCurrentPage(1); }} className={`so-page-btn ${pageSize === s ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{s}</button>
                          ))}
                        </div>

                        <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                          <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div className="so-modal-overlay" onClick={closeModal} style={{ padding: 0 }}>
            <div className="so-modal" style={{ maxWidth: 'none', width: '100vw', height: '100vh', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">
                  <Package size={18} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {isEditMode ? 'Edit' : isViewMode ? 'View' : 'New'} Purchase Invoice
                </h2>
                <button onClick={closeModal} className="so-modal-close">
                  <X size={20} />
                </button>
              </div>
              <div className="so-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Basic Details Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Basic Details</p>
                  </div>
                  <div className="so-card-body">
                    <div className="so-form-grid">
                      <div className="so-field" ref={supplierRef} style={{ position: 'relative' }}>
                        <label className="so-label">Supplier {!isViewMode && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        <div style={{ position: 'relative' }}>
                          <Building2 size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="text"
                            value={searchSupplier}
                            onChange={e => setSearchSupplier(e.target.value)}
                            onFocus={() => !isViewMode && searchSupplier && setShowSupplierDropdown(true)}
                            placeholder="Search supplier..."
                            className="so-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                        {showSupplierDropdown && suppliers.length > 0 && !isViewMode && (
                          <div className="so-dropdown" style={{ top: '100%', left: 0, right: 0, zIndex: 100 }}>
                            {suppliers.map(s => (
                              <div key={s.name} onClick={() => selectSupplier(s)} className="so-dropdown-item">
                                <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{s.supplier_name}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{s.name}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {formErrors.supplier && <span className="so-error-text">{formErrors.supplier}</span>}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Posting Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="date"
                            value={formData.posting_date}
                            onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                            className="so-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Due Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="date"
                            value={formData.due_date}
                            onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                            className="so-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Bill Number</label>
                        <input
                          type="text"
                          value={formData.bill_no}
                          onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                          placeholder="Enter bill number..."
                          className="so-input"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barcode Scanner Card */}
                {!isViewMode && (
                  <div className="so-card" style={{ border: `1px dashed ${themeColor}`, background: `${themeColor}05` }}>
                    <div className="so-card-body" style={{ padding: '1rem 1.5rem' }}>
                      <div className="so-form-grid" style={{ gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ background: themeColor, color: 'white', padding: '0.5rem', borderRadius: '0.5rem' }}>
                            <Barcode size={20} />
                          </div>
                          <div>
                            <p style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColor }}>Quick Scan</p>
                            <p style={{ fontSize: '0.65rem', opacity: 0.6 }}>Add items instantly</p>
                          </div>
                        </div>
                        <input
                          ref={barcodeRef}
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={handleBarcodeScan}
                          placeholder="Place cursor here and scan barcode..."
                          className="so-input"
                          style={{ height: '42px', fontSize: '0.9rem', borderStyle: 'dashed' }}
                          disabled={barcodeLoading}
                          autoFocus
                        />
                        {barcodeLoading && <Loader2 className="so-spinner" size={20} />}
                      </div>
                    </div>
                  </div>
                )}
                {/* Stock Controls Card */}
                <div className="so-card">
                  <div className="so-card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isViewMode ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={formData.update_stock}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              update_stock: checked,
                              accepted_warehouse: checked ? (prev.accepted_warehouse || warehouses[0]?.name || '') : '',
                            }));
                          }}
                          disabled={isViewMode}
                          style={{ width: '1.2rem', height: '1.2rem', accentColor: themeColor }}
                        />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>Update Stock</p>
                          <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>Receive items into inventory upon submission</p>
                        </div>
                      </label>

                      {formData.update_stock && (
                        <div className="so-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr) auto', alignItems: 'end' }}>
                          <div className="so-field">
                            <label className="so-label">Accepted Branch</label>
                            <select
                              value={formData.accepted_warehouse}
                              onChange={e => setFormData(prev => ({ ...prev, accepted_warehouse: e.target.value }))}
                              className="so-select"
                              disabled={isViewMode}
                            >
                              <option value="">Select Branch</option>
                              {warehouses.map(w => (
                                <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Rejected Branch</label>
                            <select
                              value={formData.rejected_warehouse}
                              onChange={e => setFormData(prev => ({ ...prev, rejected_warehouse: e.target.value }))}
                              className="so-select"
                              disabled={isViewMode}
                            >
                              <option value="">None</option>
                              {warehouses.map(w => (
                                <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isViewMode ? 'not-allowed' : 'pointer', marginBottom: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={formData.is_subcontracted}
                              onChange={e => setFormData(prev => ({ ...prev, is_subcontracted: e.target.checked }))}
                              disabled={isViewMode}
                              style={{ accentColor: themeColor }}
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Subcontracted</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Items</p>
                    {!isViewMode && <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                      <Plus size={14} /> Add Row
                    </button>}
                  </div>
                  <div className="so-card-body">
                    <div className="so-table-wrapper" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)', boxShadow: 'none' }}>
                      <table className="so-items-table">
                        <thead>
                          <tr>
                            <th>Item Description</th>
                            <th style={{ width: '100px', textAlign: 'center' }}>Accepted Qty</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>UOM</th>
                            <th style={{ width: '120px', textAlign: 'right' }}>Rate (AED)</th>
                            <th style={{ width: '120px', textAlign: 'right' }}>Amount (AED)</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, i) => (
                            <tr key={i}>
                              <td ref={el => itemRefs.current[i] = el}>
                                {item.item_code ? (
                                  <div style={{ padding: '0.5rem 0' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: themeColor }}>{item.item_code}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.8 }}>{item.item_name}</div>
                                  </div>
                                ) : (
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="text"
                                      value={itemSearches[i] || ''}
                                      onChange={e => handleItemSearch(i, e.target.value)}
                                      placeholder="Search and select item..."
                                      className="so-input"
                                      style={{ height: '36px', fontSize: '0.75rem' }}
                                      disabled={isViewMode}
                                    />
                                    {showItemDropdowns[i] && itemsList.length > 0 && !isViewMode && (
                                      <div className="so-dropdown" style={{ top: '100%', left: 0, right: 0, zIndex: 110 }}>
                                        {itemsList.map(itm => (
                                          <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="so-dropdown-item">
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{itm.item_name}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{itm.item_code}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="number"
                                  value={item.qty}
                                  onChange={e => updateItem(i, 'qty', e.target.value)}
                                  className="so-input"
                                  style={{ height: '36px', textAlign: 'center', fontWeight: 700 }}
                                  disabled={isViewMode}
                                />
                              </td>
                              <td style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600 }}>{item.uom || '-'}</td>
                              <td>
                                <input
                                  type="number"
                                  value={item.rate}
                                  onChange={e => updateItem(i, 'rate', e.target.value)}
                                  className="so-input"
                                  style={{ height: '36px', textAlign: 'right', fontWeight: 700 }}
                                  disabled={isViewMode}
                                  step="0.01"
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.8rem' }}>
                                {(parseFloat(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {!isViewMode && formData.items.length > 1 && (
                                  <button onClick={() => removeItemRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }}>
                                    <X size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Discounts & Taxes Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Left Column: Discounts & Tax Selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="so-card">
                      <div className="so-card-header">
                        <p className="so-card-title">Discounts & Rounding</p>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <div className="so-field" style={{ gridColumn: 'span 2' }}>
                            <label className="so-label">Apply Discount On</label>
                            <select
                              value={formData.apply_discount_on}
                              onChange={e => setFormData(prev => ({ ...prev, apply_discount_on: e.target.value }))}
                              disabled={isViewMode}
                              className="so-select"
                            >
                              <option>Grand Total</option>
                              <option>Net Total</option>
                            </select>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount (%)</label>
                            <input
                              type="number"
                              value={formData.additional_discount_percentage}
                              onChange={e => setFormData(prev => ({ ...prev, additional_discount_percentage: e.target.value, discount_amount: 0 }))}
                              className="so-input"
                              min="0" max="100" step="0.01"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount Amount</label>
                            <input
                              type="number"
                              value={formData.discount_amount}
                              onChange={e => setFormData(prev => ({ ...prev, discount_amount: e.target.value, additional_discount_percentage: 0 }))}
                              className="so-input"
                              min="0" step="0.01"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="so-field" style={{ gridColumn: 'span 2' }}>
                            <label className="so-label">Tax Template</label>
                            <select
                              value={formData.taxes_and_charges}
                              onChange={e => setFormData(prev => ({ ...prev, taxes_and_charges: e.target.value }))}
                              disabled={isViewMode || loadingTaxTemplates}
                              className="so-select"
                            >
                              <option value="">No Tax</option>
                              {taxTemplates.map(t => (
                                <option key={t.name} value={t.name}>{t.title || t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Taxes Table Card */}
                    {taxPreview.length > 0 && (
                      <div className="so-card">
                        <div className="so-card-header">
                          <p className="so-card-title">Taxes & Charges</p>
                        </div>
                        <div className="so-card-body">
                          <div className="so-table-wrapper" style={{ boxShadow: 'none', border: '1px solid var(--so-border)', marginTop: 0 }}>
                            <table className="so-items-table">
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Account</th>
                                  <th style={{ textAlign: 'center' }}>Rate</th>
                                  <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {taxPreview.map((tax, i) => (
                                  <tr key={i}>
                                    <td><span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#e0f2fe', color: '#0369a1' }}>ACTUAL</span></td>
                                    <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>{tax.account_head?.split(' - ')[0]}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{tax.rate}%</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                      {(netTotal * (parseFloat(tax.rate || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Totals Summary */}
                  <div className="so-card" style={{
                    background: isGreen
                      ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                      : 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
                    color: 'white',
                    height: '100%'
                  }}>
                    <div className="so-card-header" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                      <p className="so-card-title" style={{ color: 'white' }}>Final Summary</p>
                    </div>
                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.9rem' }}>
                        <span>Subtotal</span>
                        <span style={{ fontWeight: 700 }}>AED {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      {discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fda4af' }}>
                          <span>Total Discount</span>
                          <span style={{ fontWeight: 700 }}>- AED {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.9rem' }}>
                        <span>Tax Total</span>
                        <span style={{ fontWeight: 700 }}>AED {taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '1rem', fontWeight: 500 }}>Grand Total</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.75rem', fontWeight: 900, display: 'block', lineHeight: 1 }}>
                            AED {parseFloat(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inc. All Taxes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="so-modal-footer">
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'flex-end' }}>
                    {(docStatus === 0 || docStatus === null) ? (
                      <>
                        <button onClick={closeModal} className="so-btn-secondary">Cancel</button>
                        <button
                          onClick={handleSaveDraft}
                          disabled={saving}
                          className="so-btn-secondary"
                          style={{ minWidth: '140px' }}
                        >
                          {saving ? <Loader2 size={16} className="so-spinner" /> : (docName ? 'Update Draft' : 'Save Draft')}
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={saving}
                          className="so-btn-primary"
                          style={{ minWidth: '180px' }}
                        >
                          {saving ? <Loader2 size={16} className="so-spinner" /> : 'Submit Invoice'}
                        </button>
                      </>
                    ) : (
                      <button onClick={closeModal} className="so-btn-primary" style={{ minWidth: '120px' }}>Done</button>
                    )}
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

export default PurchaseInvoiceList;