import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, ShoppingCart, Receipt, Calendar, User, Layers,
  CheckCircle2, Clock, CreditCard, Palette, Loader2, ChevronLeft, ChevronRight,
  ArrowRight, FileText, Filter, Save, ScanLine
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const API_PATH_C = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

/* ==================== GLOBAL CSS FIXES ==================== */
const GlobalStyles = ({ themeColor, themeLight }) => (
  <style>{`
    /* The modal body MUST be allowed to scroll internally */
    .so-modal-body {
      overflow-y: auto !important;
      flex: 1 !important;
    }

    /* Keep internal containers visible ONLY so the dropdown can float over the table rows */
    .so-table-wrapper, 
    .so-table-card,
    .so-card,
    .so-card-body {
      overflow: visible !important;
    }
    
    .so-dropdown {
      position: absolute !important;
      top: 100% !important;
      left: 0 !important;
      width: 550px !important;
      background: #ffffff !important;
      border: 1px solid #cbd5e1 !important;
      z-index: 999999 !important;
      max-height: 280px !important;
      overflow-y: auto !important;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
      border-radius: 10px !important;
      margin-top: 6px !important;
      padding: 4px 0 !important;
    }

    .so-table-input-wrapper {
      position: relative !important;
      width: 100% !important;
      display: block !important;
    }

    .so-table-input {
      width: 100% !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 6px !important;
      padding: 0 12px !important;
      height: 38px !important;
      outline: none !important;
      transition: all 0.2s !important;
    }

    .so-table-input:focus {
      border-color: ${themeColor} !important;
      box-shadow: 0 0 0 2px ${themeLight} !important;
    }
  `}</style>
);

/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ docstatus }) => {
  const isSubmitted = docstatus === 1;
  const isCancelled = docstatus === 2;

  if (isCancelled) {
    return (
      <span className="so-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
        Cancelled
      </span>
    );
  }

  return (
    <span className={`so-badge ${isSubmitted ? 'so-badge-submitted' : 'so-badge-draft'}`}>
      {isSubmitted ? 'Submitted' : 'Draft'}
    </span>
  );
};

export default function SalesOrderList() {
  const navigate = useNavigate();
  const { warehouse, user_roles } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Theme logic
  const { themeColor, themeLight, toggleTheme, legacySubTheme, isGreen } = useLegacyTheme();

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Creation Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [formData, setFormData] = useState({});
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);
  const [isAdvancedSearchModalOpen, setIsAdvancedSearchModalOpen] = useState(false);
  const [advancedSearchTerm, setAdvancedSearchTerm] = useState('');
  const [allCustomers, setAllCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [taxesTemplates, setTaxesTemplates] = useState([]);
  const [itemSearches, setItemSearches] = useState({});
  const [searchResults, setSearchResults] = useState({}); // Renamed to match user request style
  const [showItemDropdowns, setShowItemDropdowns] = useState({});
  const [loadingAllCustomers, setLoadingAllCustomers] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customer_name: '', mobile_no: '', email_id: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Sync Global Body Scroll
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isModalOpen]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'docstatus', 'status', 'total_qty', 'base_total', 'naming_series']),
          filters: !isAdmin && warehouse ? JSON.stringify([['set_warehouse', '=', warehouse]]) : undefined,
          order_by: 'modified desc'
        },
        withCredentials: true
      });
      setOrders(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error('Failed to fetch sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const stats = useMemo(() => {
    const total = orders.length;
    const submitted = orders.filter(o => o.docstatus === 1).length;
    const drafts = total - submitted;
    const totalValue = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
    return { total, submitted, drafts, totalValue };
  }, [orders]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  const handleRowClick = (name) => {
    navigate(`/salesorder-details/${name}`);
  };

  const openCreateModal = async () => {
    setIsModalOpen(true);
    const today = new Date().toISOString().split('T')[0];
    const initial = {
      items: [{ item_code: '', delivery_date: '', qty: '', rate: '', amount: 0 }],
      transaction_date: today,
      delivery_date: '',
      po_date: today,
      naming_series: 'SAL-ORD-.YYYY.-',
      order_type: 'Sales',
      set_source_warehouse: warehouse || '',
      taxes_and_charges: '',
      taxes: [],
      advance_paid: ''
    };
    setFormData(initial);
    setCustomerSearch('');

    if (!metadata) {
      try {
        setLoadingMetadata(true);
        const [metaRes, whRes, taxRes] = await Promise.all([
          axios.get(`${API_PATH_C}.get_doctype_metadata`, { params: { doctype: 'Sales Order' }, withCredentials: true }),
          axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses', { params: { is_group: 0, warehouse: warehouse }, withCredentials: true }),
          axios.get('/api/resource/Sales Taxes and Charges Template', { params: { fields: JSON.stringify(['name']) }, withCredentials: true })
        ]);
        setMetadata(metaRes.data.message || null);
        setWarehouses(whRes.data.message || []);
        setTaxesTemplates(taxRes.data.data || []);
      } catch (err) {
        Swal.fire('Metadata Error', 'Could not fetch Sales Order structure', 'error');
      } finally {
        setLoadingMetadata(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowTaxDropdowns({});
      setShowItemDropdowns({});
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // Always fetch initially if search is empty to show recent or basic list, or fetch on typing
      try {
        const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list', {
          params: { order_by: 'modified desc', limit_page_length: 50, warehouse: warehouse },
          withCredentials: true
        });
        const fetched = res.data.message?.data || [];

        if (customerSearch.length > 0) {
          const lowerSearch = customerSearch.toLowerCase();
          const results = fetched.filter(c =>
            (c.customer_name || '').toLowerCase().includes(lowerSearch) ||
            (c.name || '').toLowerCase().includes(lowerSearch) ||
            (c.label || '').toLowerCase().includes(lowerSearch)
          );
          setCustomerResults(results.slice(0, 5));
        } else {
          // If empty search, show the most recent ones
          setCustomerResults(fetched.slice(0, 5));
        }
      } catch (err) {
        console.error('Customer fetch failing', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  const submitQuickCustomer = async () => {
    try {
      if (!newCustomer.customer_name) return Swal.fire('Error', 'Customer Name is required', 'warning');
      setSavingCustomer(true);
      const res = await axios.post('/api/resource/Customer', {
        ...newCustomer,
        customer_type: 'Individual',
        customer_group: 'All Customer Groups',
        territory: 'All Territories'
      }, { withCredentials: true });

      const created = res.data.data;
      Swal.fire({ icon: 'success', title: 'Customer Created', text: created.name, timer: 2000 });

      // Auto-select the newly created customer
      handleInputChange('customer', created.name);
      handleInputChange('customer_name', created.customer_name || created.name);
      setCustomerSearch(created.customer_name || created.name);

      setIsCustomerModalOpen(false);
      setNewCustomer({ customer_name: '', mobile_no: '', email_id: '' });
    } catch (err) {
      Swal.fire('Failed to create customer', err.response?.data?._server_messages || err.message, 'error');
    } finally {
      setSavingCustomer(false);
    }
  };

  const openAdvancedSearch = async () => {
    setIsAdvancedSearchModalOpen(true);
    if (allCustomers.length === 0) {
      try {
        setLoadingAllCustomers(true);
        const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list', {
          params: { limit_page_length: 500 },
          withCredentials: true
        });
        setAllCustomers(res.data.message?.data || []);
      } catch (err) {
        console.error('Failed to load all customers');
      } finally {
        setLoadingAllCustomers(false);
      }
    }
  };

  const filteredAdvanced = allCustomers.filter(c =>
    (c.customer_name || '').toLowerCase().includes(advancedSearchTerm.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(advancedSearchTerm.toLowerCase())
  );
  const recalculate = (currentForm) => {
    const items = currentForm.items || [];
    const taxes = currentForm.taxes || [];

    const base_total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const total_qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);

    // Simple Tax calculation (can be expanded)
    let total_taxes = 0;
    const computedTaxes = taxes.map(t => {
      let amt = 0;
      if (t.charge_type === 'On Net Total') {
        amt = base_total * (parseFloat(t.rate) / 100);
      } else {
        amt = parseFloat(t.tax_amount) || 0;
      }
      total_taxes += amt;
      return { ...t, tax_amount: amt, total: base_total + total_taxes };
    });

    const grand_total = base_total + total_taxes;
    const rounded_total = Math.round(grand_total);
    const rounding_adjustment = rounded_total - grand_total;

    return {
      ...currentForm,
      base_total,
      grand_total,
      total_qty,
      total_taxes_and_charges: total_taxes,
      taxes: computedTaxes,
      rounded_total,
      rounding_adjustment
    };
  };

  const handleInputChange = (fieldname, value) => {
    setFormData(prev => ({ ...prev, [fieldname]: value }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { item_code: '', delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 }]
    }));
  };

  const addTaxRow = () => {
    setFormData(prev => ({
      ...prev,
      taxes: [...(prev.taxes || []), { charge_type: 'On Net Total', account_head: 'VAT 5% - KSPL', rate: 5, tax_amount: 0, total: 0 }]
    }));
  };

  const [taxAccountSearchResults, setTaxAccountSearchResults] = useState({});
  const [showTaxDropdowns, setShowTaxDropdowns] = useState({});

  const handleTaxAccountSearch = async (idx, query) => {
    setShowTaxDropdowns(prev => ({ ...prev, [idx]: true }));
    try {
      const res = await axios.get('/api/resource/Account', {
        params: {
          fields: JSON.stringify(['name']),
          filters: JSON.stringify([['is_group', '=', 0], ['account_type', 'in', ['Tax', 'Charge Table', 'Tax Receivable', 'Tax Payable']]]),
          or_filters: JSON.stringify([['name', 'like', `%${query}%`]]),
          limit: 10
        },
        withCredentials: true
      });
      setTaxAccountSearchResults(prev => ({ ...prev, [idx]: res.data.data || [] }));
    } catch (err) {
      console.error("Tax Search Error:", err);
      setTaxAccountSearchResults(prev => ({ ...prev, [idx]: [] }));
    }
  };

  const selectTaxAccount = (idx, accName) => {
    handleTaxChange(idx, 'account_head', accName);
    setShowTaxDropdowns(prev => ({ ...prev, [idx]: false }));
  };

  const handleBarcodeSearchModal = async (e) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    const val = barcodeInput.trim();
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_by_barcode_retail', {
        params: { barcode: val },
        withCredentials: true
      });
      const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;
      if (!item || item.status === 'error' || (!item.item_code && !item.name)) {
        throw new Error(item?.message || 'Item not found');
      }

      const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
        params: {
          item_code: item.item_code,
          price_list: formData.selling_price_list || 'Standard Selling'
        },
        withCredentials: true
      });
      const rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || item.rate || item.last_selling_rate || 0;

      setFormData(prev => {
        const items = [...(prev.items || [])];
        const emptyIdx = items.findIndex(i => !i.item_code);
        const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;

        const newRow = {
          item_code: item.item_code,
          item_name: item.item_name,
          uom: item.stock_uom || 'Nos',
          qty: 1,
          rate: rate,
          amount: rate * 1,
          warehouse: item.warehouse || prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
        };

        if (emptyIdx !== -1) items[emptyIdx] = newRow;
        else items.push(newRow);

        if (items.every(i => i.item_code)) {
          items.push({ item_code: '', delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 });
        }
        return recalculate({ ...prev, items });
      });
      setBarcodeInput('');
    } catch (err) {
      Swal.fire('Scan Error', err.message, 'error');
    }
  };

  const handleItemSearch = async (idx, query) => {
    setItemSearches(prev => ({ ...prev, [idx]: query }));
    setShowItemDropdowns(prev => ({ ...prev, [idx]: true }));
    try {
      // 1. Try specialized Sales Order search
      const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
      let res = await axios.get(`/api/method/kyle_retail.retail_api.api.get_items_so?${warehouseParam}`, {
        params: { query: query || '' },
        withCredentials: true
      });

      let items = res.data.message || res.data.data || [];
      if (items.data && Array.isArray(items.data)) items = items.data;

      // 2. Fallback to global search if no results
      if (!Array.isArray(items) || items.length === 0) {
        const fallback = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_global', {
          search_term: query || ''
        }, { withCredentials: true });
        items = fallback.data.message?.data || fallback.data.message || [];
      }

      setSearchResults(prev => ({ ...prev, [idx]: Array.isArray(items) ? items.slice(0, 15) : [] }));
    } catch (err) {
      console.error("Search Error:", err);
      setSearchResults(prev => ({ ...prev, [idx]: [] }));
    }
  };

  const selectItem = async (idx, item) => {
    try {
      // Fetch rate for the selected item
      const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
        params: {
          item_code: item.item_code,
          price_list: formData.selling_price_list || 'Standard Selling'
        },
        withCredentials: true
      });
      const rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || item.price || 0;

      setFormData(prev => {
        const newItems = [...(prev.items || [])];
        newItems[idx] = {
          ...newItems[idx],
          item_code: item.item_code,
          item_name: item.item_name,
          uom: item.stock_uom || 'Nos',
          rate: rate,
          qty: 1,
          amount: rate * 1,
          warehouse: item.warehouse || prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
        };

        if (idx === newItems.length - 1) {
          newItems.push({ item_code: '', delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 });
        }
        return recalculate({ ...prev, items: newItems });
      });

      setItemSearches(prev => ({ ...prev, [idx]: item.item_name || item.item_code }));
      setSearchResults(prev => ({ ...prev, [idx]: [] }));
      setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
    } catch (err) {
      console.error("Select Item Error:", err);
    }
  };

  const removeItemRow = (idx) => {
    setFormData(prev => {
      const nextItems = (prev.items || []).filter((_, i) => i !== idx);
      return recalculate({ ...prev, items: nextItems });
    });
  };

  const handleItemChange = (idx, field, value) => {
    setFormData(prev => {
      const newItems = [...(prev.items || [])];
      newItems[idx] = { ...newItems[idx], [field]: value };

      if (field === 'qty' || field === 'rate') {
        const q = parseFloat(newItems[idx].qty) || 0;
        const r = parseFloat(newItems[idx].rate) || 0;
        newItems[idx].amount = q * r;
      }

      // Auto-add next row if we just selected an item in the last available row
      if (field === 'item_code' && value && idx === newItems.length - 1) {
        newItems.push({ item_code: '', delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 });
      }

      return recalculate({ ...prev, items: newItems });
    });
  };

  const handleTaxChange = (idx, field, value) => {
    setFormData(prev => {
      const newTaxes = [...(prev.taxes || [])];
      newTaxes[idx] = { ...newTaxes[idx], [field]: value };
      return recalculate({ ...prev, taxes: newTaxes });
    });
  };

  const submitCreate = async () => {
    try {
      if (!formData.customer) return Swal.fire('Error', 'Customer is required', 'warning');

      const validItems = (formData.items || [])
        .filter(i => i.item_code)
        .map(i => ({
          ...i,
          qty: parseFloat(i.qty) || 0,
          rate: parseFloat(i.rate) || 0,
          amount: parseFloat(i.amount) || 0,
          warehouse: i.warehouse || formData.set_source_warehouse || localStorage.getItem('warehouse')
        }));

      if (validItems.length === 0) return Swal.fire('Error', 'No items added', 'warning');

      setSavingOrder(true);
      const payload = {
        ...formData,
        items: validItems,
        taxes: (formData.taxes || []).map(t => ({
          ...t,
          description: t.description || t.account_head || 'VAT'
        })),
        advance_paid: parseFloat(formData.advance_paid) || 0,
        total_qty: parseFloat(formData.total_qty) || 0,
        base_total: parseFloat(formData.base_total) || 0,
        grand_total: parseFloat(formData.grand_total) || 0,
        rounded_total: parseFloat(formData.rounded_total) || 0
      };

      const res = await axios.post('/api/resource/Sales Order', payload, { withCredentials: true });
      Swal.fire({ icon: 'success', title: 'Order Created', text: `ID: ${res.data.data.name}`, timer: 3000 });
      setIsModalOpen(false);
      fetchOrders();
    } catch (err) {
      Swal.fire('Failed', err.response?.data?._server_messages || err.message, 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <>
      <div className="so-page">
        {/* 1. Header Section */}
        {!isModalOpen && (
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">
                <ShoppingCart size={20} /> Sales Orders
              </h1>
              <p className="so-page-subtitle">Manage and track all sales</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={toggleTheme}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.45rem 0.9rem',
                  background: '#f8fafc',
                  border: `1.5px solid ${themeColor}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: themeColor,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <Palette size={13} />
                {legacySubTheme.toUpperCase()}
              </button>
              <button className="so-btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Create Sales Order
              </button>
            </div>
          </div>
        )}

        <div className="so-layout">
          {/* 2. Actions / Filter Bar */}
          <div className="so-filter-bar">
            <div style={{ flex: '1 1 300px' }}>
              <label className="so-filter-label">Search Order Matrix</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  className="so-filter-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Search by Order ID or Customer..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
            <button
              className="so-clear-btn"
              style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0, fontWeight: 600 }}
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          </div>

          {/* 3. Executive Dashboard (Summary Bar) */}
          <div style={{ padding: '1.25rem 1.5rem 0' }}>
            <div className="so-summary-bar">
              <div className="so-summary-item">
                <span className="so-summary-label">Total Orders</span>
                <span className="so-summary-value grand">{stats.total}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Submitted</span>
                <span className="so-summary-value" style={{ color: '#10b981' }}>{stats.submitted}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Drafts</span>
                <span className="so-summary-value" style={{ color: '#f59e0b' }}>{stats.drafts}</span>
              </div>
              <div className="so-summary-divider" />
              <div className="so-summary-item">
                <span className="so-summary-label">Total Amount</span>
                <span className="so-summary-value flex items-center gap-1">
                  <DirhamIcon size={14} />
                  <span>{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
            </div>
          </div>

          {/* 4. Main Directory Table */}
          <div className="so-content">
            <div className="so-list-meta">{filteredOrders.length} record(s) found</div>

            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Grand Total</th>
                      <th>Status</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="so-empty">
                          <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Loading Orders...</p>
                        </td>
                      </tr>
                    ) : paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="so-empty">
                          No orders found
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => (
                        <tr
                          key={order.name}
                          onClick={() => handleRowClick(order.name)}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '38px', height: '38px', borderRadius: '10px',
                                background: themeLight, color: themeColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <ShoppingCart size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: 'var(--so-text-heading)', fontSize: '0.85rem' }}>{order.name}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--so-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{order.naming_series || 'SAL-ORD'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <User size={14} className="text-slate-400" />
                              <span style={{ fontWeight: 600 }}>{order.customer_name || order.customer}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Calendar size={14} className="text-slate-400" />
                              <span style={{ fontWeight: 600 }}>{order.transaction_date}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <DirhamIcon size={12} />
                              <span>{parseFloat(order.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--so-text-muted)', fontWeight: 600 }}>
                              Items: {order.total_qty || 0}
                            </div>
                          </td>
                          <td>
                            <StatusBadge docstatus={order.docstatus} />
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <div style={{ color: themeColor }}>
                                <ArrowRight size={18} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Grid */}
              {!loading && filteredOrders.length > 0 && (
                <div className="so-pagination" style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--so-border)', margin: 0 }}>
                  <span style={{ fontWeight: 600 }}>Showing {Math.min((currentPage - 1) * pageSize + 1, filteredOrders.length)}–{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} records</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Page Capacity:</span>
                      <select
                        value={pageSize}
                        onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="so-page-btn"
                        style={{ padding: '0.2rem 0.5rem' }}
                      >
                        {[10, 20, 50, 100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontWeight: 800, color: themeColor, padding: '0 0.5rem' }}>{currentPage} / {totalPages}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Creation Full-Screen Overlay */}
      {isModalOpen && (
        <div className="so-modal-overlay" style={{ padding: 0, top: '64px', height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 999 }}>
          <div className="so-modal so-modal-full" onClick={e => e.stopPropagation()} style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, background: '#f8fafc', width: '100vw' }}>

            {/* 1. Header Section (Fixed) */}
            <div className="so-page-header" style={{ flexShrink: 0, zIndex: 100, borderBottom: '1.5px solid #e2e8f0', background: '#fff' }}>
              <div>
                <h1 className="so-page-title"><ShoppingCart size={20} /> Create Sales Order</h1>
                <p className="so-page-subtitle">INITIALIZE NEW SALES PROTOCOL</p>
              </div>
              <button className="so-btn-secondary" onClick={() => setIsModalOpen(false)}>
                <X size={16} /> Return to List
              </button>
            </div>

            {/* 2. Main Content Body (Completely Fixed) */}
            <div className="so-modal-body" style={{ background: '#f8fafc', padding: '1.5rem 2.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loadingMetadata ? (
                <div style={{ padding: '8rem', textAlign: 'center' }}>
                  <Loader2 size={40} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', fontWeight: 800, opacity: 0.6 }}>FETCHING DOMAIN METADATA...</p>
                </div>
              ) : metadata ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

                  {/* Primary Order Context (Custom Tailored Fields) */}
                  <div className="so-card">
                    <div className="so-card-body" style={{ padding: '2rem' }}>
                      <div className="so-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>

                        {/* Column 1 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div className="so-field">
                            <label className="so-label">Series <span style={{ color: '#ef4444' }}>*</span></label>
                            <select className="so-input" value={formData.naming_series || 'SAL-ORD-.YYYY.-'} onChange={e => handleInputChange('naming_series', e.target.value)}>
                              <option value="SAL-ORD-.YYYY.-">SAL-ORD-.YYYY.-</option>
                            </select>
                          </div>
                          <div className="so-field" style={{ position: 'relative' }}>
                            <label className="so-label">Customer <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                              className="so-input"
                              value={customerSearch || formData.customer_name || formData.customer || ''}
                              onChange={e => {
                                setCustomerSearch(e.target.value);
                                handleInputChange('customer', e.target.value);
                                if (!showCustomerDropdown) setShowCustomerDropdown(true);
                              }}
                              onFocus={() => setShowCustomerDropdown(true)}
                              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                              placeholder="Search Customer..."
                            />
                            {showCustomerDropdown && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: '#fff', border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem', marginTop: '4px', zIndex: 10000,
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                overflow: 'hidden'
                              }}>
                                {customerResults.length > 0 ? (
                                  customerResults.map(c => (
                                    <div
                                      key={c.name}
                                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', fontWeight: 600 }}
                                      onClick={() => {
                                        handleInputChange('customer', c.name);
                                        handleInputChange('customer_name', c.customer_name);
                                        setCustomerSearch(c.customer_name);
                                        setShowCustomerDropdown(false);
                                      }}
                                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      {c.customer_name || c.name}
                                    </div>
                                  ))
                                ) : customerSearch.length > 0 ? (
                                  <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.75rem', fontWeight: 800 }}>
                                    NO PARTNERS FOUND
                                  </div>
                                ) : null}
                                <div
                                  style={{ padding: '0.75rem 1rem', borderTop: '2px solid #f1f5f9', background: '#f8fafc', fontSize: '0.75rem', color: themeColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsCustomerModalOpen(true);
                                  }}
                                >
                                  <Plus size={14} /> Create a new Customer
                                </div>
                                <div
                                  style={{ padding: '0.75rem 1rem', background: '#f8fafc', fontSize: '0.75rem', opacity: 0.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    openAdvancedSearch();
                                  }}
                                >
                                  <Search size={14} /> Advanced Search
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Order Type <span style={{ color: '#ef4444' }}>*</span></label>
                            <select className="so-input" value={formData.order_type || 'Sales'} onChange={e => handleInputChange('order_type', e.target.value)}>
                              <option value="Sales">Sales</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Shopping Cart">Shopping Cart</option>
                            </select>
                          </div>
                        </div>

                        {/* Column 2 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div className="so-field">
                            <label className="so-label">Date <span style={{ color: '#ef4444' }}>*</span></label>
                            <input className="so-input" type="date" value={formData.transaction_date || ''} onChange={e => handleInputChange('transaction_date', e.target.value)} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Delivery Date</label>
                            <input className="so-input" type="date" value={formData.delivery_date || ''} onChange={e => handleInputChange('delivery_date', e.target.value)} />
                          </div>
                        </div>

                        {/* Column 3 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div className="so-field">
                            <label className="so-label">Customer's Purchase Order</label>
                            <input className="so-input" value={formData.po_no || ''} onChange={e => handleInputChange('po_no', e.target.value)} />
                          </div>

                          {formData.po_no && (
                            <div className="so-field" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                              <label className="so-label">Customer's Purchase Order Date</label>
                              <input className="so-input" type="date" value={formData.po_date || ''} onChange={e => handleInputChange('po_date', e.target.value)} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items & Fulfillment Area */}
                  <div className="so-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="so-card-body" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h3>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                          <div className="so-field">
                            <label className="so-label">Scan Barcode / SKU</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                className="so-input"
                                placeholder="Point scanner here..."
                                ref={barcodeRef}
                                value={barcodeInput}
                                onChange={e => setBarcodeInput(e.target.value)}
                                onKeyDown={handleBarcodeSearchModal}
                              />
                              <ScanLine size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            </div>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Set Source Warehouse</label>
                            <select className="so-input" value={formData.set_source_warehouse || ''} onChange={e => {
                              const wh = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                set_source_warehouse: wh,
                                items: (prev.items || []).map(item => ({ ...item, warehouse: wh }))
                              }));
                            }}>
                              <option value="">Select Warehouse...</option>
                              {warehouses.map(wh => (
                                <option key={wh.name} value={wh.name}>{wh.warehouse_name || wh.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="so-table-wrapper" style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <table className="so-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}><input type="checkbox" /></th>
                              <th style={{ width: '50px' }}>No.</th>
                              <th>Item Code <span style={{ color: '#ef4444' }}>*</span></th>
                              <th style={{ width: '100px' }}>UOM</th>
                              <th style={{ width: '140px' }}>Delivery Date <span style={{ color: '#ef4444' }}>*</span></th>
                              <th style={{ width: '100px', textAlign: 'center' }}>Quantity <span style={{ color: '#ef4444' }}>*</span></th>
                              <th style={{ width: '130px', textAlign: 'right' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                                  Rate (<DirhamIcon size={10} />)
                                </span>
                              </th>
                              <th style={{ width: '130px', textAlign: 'right' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                                  Amount (<DirhamIcon size={10} />)
                                </span>
                              </th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(formData.items || []).map((item, idx) => (
                              <tr key={idx} style={{ zIndex: showItemDropdowns[idx] ? 100 : 1 }}>
                                <td><input type="checkbox" /></td>
                                <td style={{ fontWeight: 700, opacity: 0.4 }}>{idx + 1}</td>
                                <td
                                  style={{ padding: '0.25rem', overflow: 'visible', position: 'relative', cursor: 'text' }}
                                  onClick={() => {
                                    const input = document.getElementById(`item-input-${idx}`);
                                    if (input) input.focus();
                                  }}
                                >
                                  <div className="so-table-input-wrapper" onClick={e => e.stopPropagation()}>
                                    <input
                                      id={`item-input-${idx}`}
                                      className="so-table-input"
                                      autoComplete="off"
                                      value={itemSearches[idx] !== undefined ? itemSearches[idx] : (item.item_name || item.item_code || '')}
                                      onChange={e => handleItemSearch(idx, e.target.value)}
                                      onFocus={(e) => {
                                        const val = e.target.value;
                                        if (val) handleItemSearch(idx, val);
                                        else handleItemSearch(idx, '');
                                        const newShow = { ...showItemDropdowns };
                                        newShow[idx] = true;
                                        setShowItemDropdowns(newShow);
                                      }}
                                      onBlur={() => {
                                        setTimeout(() => {
                                          const newShow = { ...showItemDropdowns };
                                          newShow[idx] = false;
                                          setShowItemDropdowns(newShow);
                                        }, 300);
                                      }}
                                      placeholder="Item Name / Code"
                                    />
                                    {showItemDropdowns[idx] && searchResults[idx]?.length > 0 && (
                                      <div className="so-dropdown">
                                        {searchResults[idx].map(res => (
                                          <div
                                            key={res.item_code}
                                            className="so-dropdown-item"
                                            style={{ padding: '0.85rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              selectItem(idx, res);
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#0f172a' }}>{res.item_name}</span>
                                              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, background: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '4px' }}>{res.item_code}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>{res.item_group}</span>
                                              {res.price && <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {parseFloat(res.price).toLocaleString()}</span>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="so-table-input"
                                    value={item.uom || 'Nos'}
                                    disabled={!item.item_code}
                                    onChange={e => handleItemChange(idx, 'uom', e.target.value)}
                                  >
                                    <option value="Nos">Nos</option>
                                    <option value="Box">Box</option>
                                    {item.uom && item.uom !== 'Nos' && item.uom !== 'Box' && (
                                      <option value={item.uom}>{item.uom}</option>
                                    )}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="date"
                                    className="so-table-input"
                                    style={{ fontSize: '0.7rem' }}
                                    value={item.delivery_date}
                                    onChange={e => handleItemChange(idx, 'delivery_date', e.target.value)}
                                    disabled={!item.item_code}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    className="so-table-input"
                                    style={{ textAlign: 'center' }}
                                    value={item.qty || ''}
                                    placeholder="0"
                                    disabled={!item.item_code}
                                    onFocus={e => e.target.select()}
                                    onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <input
                                      type="text"
                                      className="so-table-input"
                                      style={{ textAlign: 'right' }}
                                      value={(item.rate === '0.00' || item.rate === 0) ? '' : (item.rate || '')}
                                      placeholder=".00"
                                      disabled={!item.item_code}
                                      onFocus={e => e.target.select()}
                                      onBlur={e => {
                                        const val = parseFloat(e.target.value) || 0;
                                        handleItemChange(idx, 'rate', val.toFixed(2));
                                      }}
                                      onChange={e => {
                                        const val = e.target.value.replace(/[^0-9.]/g, '');
                                        handleItemChange(idx, 'rate', val);
                                      }}
                                    />
                                    <DirhamIcon size={10} className="text-slate-400 ml-1" style={{ opacity: 0.5 }} />
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <input
                                      readOnly
                                      className="so-table-input"
                                      style={{ textAlign: 'right', fontWeight: 800, color: themeColor, background: 'transparent', border: 'none' }}
                                      value={(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    />
                                    <DirhamIcon size={10} className="text-slate-400 ml-1" style={{ opacity: 0.5 }} />
                                  </div>
                                </td>
                                <td>
                                  <button onClick={() => removeItemRow(idx)} style={{ border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button className="so-btn-secondary" style={{ height: '36px', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 800 }} onClick={addItemRow}>
                            <Plus size={14} /> Add Row
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', marginTop: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '2rem' }}>
                        <div className="so-field">
                          <label className="so-label">Total Quantity</label>
                          <input className="so-input" readOnly value={formData.total_qty || 0} style={{ background: '#f8fafc', fontWeight: 800 }} />
                        </div>
                        <div className="so-field">
                          <label className="so-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Net Total (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)</label>
                          <input className="so-input" readOnly value={(parseFloat(formData.base_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} style={{ background: '#f8fafc', fontWeight: 800 }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tax & Charges Area */}
                  <div className="so-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fff', padding: '2rem', borderTop: '4px solid #f1f5f9' }}>
                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="so-field" style={{ maxWidth: '400px' }}>
                        <label className="so-label">Sales Taxes and Charges Template</label>
                        <select
                          className="so-input"
                          value={formData.taxes_and_charges || ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (val) {
                              try {
                                const encodedVal = encodeURIComponent(val);
                                const res = await axios.get(`/api/resource/Sales Taxes and Charges Template/${encodedVal}`, { withCredentials: true });
                                const rows = (res.data.data?.taxes || []).map(t => ({
                                  charge_type: t.charge_type,
                                  account_head: t.account_head,
                                  rate: t.rate,
                                  tax_amount: 0,
                                  total: 0
                                }));
                                setFormData(prev => ({
                                  ...prev,
                                  taxes_and_charges: val,
                                  taxes: rows
                                }));
                              } catch (err) {
                                console.error('Failed to fetch tax template details');
                                handleInputChange('taxes_and_charges', val);
                              }
                            } else {
                              setFormData(prev => ({ ...prev, taxes_and_charges: '', taxes: [] }));
                            }
                          }}
                        >
                          <option value="">Select Template...</option>
                          {taxesTemplates.map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Taxes and Charges</h3>
                      </div>

                      <div className="so-table-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <table className="so-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}><input type="checkbox" /></th>
                              <th style={{ width: '60px' }}>No.</th>
                              <th style={{ width: '180px' }}>Type <span style={{ color: '#ef4444' }}>*</span></th>
                              <th>Account Head <span style={{ color: '#ef4444' }}>*</span></th>
                              <th style={{ width: '120px' }}>Tax Rate %</th>
                              <th style={{ width: '140px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  Amount (<DirhamIcon size={10} />)
                                </span>
                              </th>
                              <th style={{ width: '140px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  Total (<DirhamIcon size={10} />)
                                </span>
                              </th>
                              <th style={{ width: '50px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(formData.taxes || []).map((tax, idx) => (
                              <tr key={idx}>
                                <td><input type="checkbox" /></td>
                                <td style={{ fontWeight: 700, opacity: 0.4 }}>{idx + 1}</td>
                                <td>
                                  <select className="so-table-input" value={tax.charge_type} onChange={e => handleTaxChange(idx, 'charge_type', e.target.value)}>
                                    <option value="On Net Total">On Net Total</option>
                                    <option value="Actual">Actual</option>
                                  </select>
                                </td>
                                <td style={{ position: 'relative' }}>
                                  <input
                                    className="so-table-input"
                                    value={tax.account_head || ''}
                                    onChange={e => {
                                      handleTaxChange(idx, 'account_head', e.target.value);
                                      handleTaxAccountSearch(idx, e.target.value);
                                    }}
                                    onFocus={() => handleTaxAccountSearch(idx, tax.account_head || '')}
                                    placeholder="Account Head..."
                                  />
                                  {showTaxDropdowns[idx] && taxAccountSearchResults[idx]?.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                      {taxAccountSearchResults[idx].map(acc => (
                                        <div key={acc.name} style={{ padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.8rem' }} onMouseDown={() => selectTaxAccount(idx, acc.name)} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                                          {acc.name}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input type="number" className="so-table-input" style={{ textAlign: 'right' }} value={tax.rate} onChange={e => handleTaxChange(idx, 'rate', e.target.value)} />
                                </td>
                                 <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}><DirhamIcon size={10} /> {(tax.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 800, color: themeColor }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%', color: themeColor }}><DirhamIcon size={10} /> {(tax.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </td>
                                <td>
                                  <button onClick={() => {
                                    const next = [...(formData.taxes || [])];
                                    next.splice(idx, 1);
                                    handleInputChange('taxes', next);
                                  }} style={{ border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <button className="so-btn-secondary" style={{ height: '36px', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 800 }} onClick={addTaxRow}>
                          <Plus size={14} /> Add Row
                        </button>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>Total Taxes and Charges (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)</label>
                          <div style={{ background: '#f8fafc', padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontWeight: 900, color: themeColor, fontSize: '1.1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={12} /> {(formData.total_taxes_and_charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Totals Section */}
                    <div className="so-card" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2rem', background: '#fff', padding: '2.5rem' }}>
                      <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totals</h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1.5rem', alignSelf: 'flex-end', width: '400px' }}>
                        <div className="so-field" style={{ width: '100%' }}>
                          <label className="so-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Grand Total (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)</label>
                          <div style={{ position: 'relative' }}>
                            <input className="so-input" readOnly value={(formData.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} style={{ background: '#f8fafc', fontWeight: 800, textAlign: 'right', paddingRight: '3rem' }} />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', opacity: 0.4 }}><DirhamIcon size={12} /></span>
                          </div>
                        </div>

                        <div className="so-field" style={{ width: '100%' }}>
                          <label className="so-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Rounding Adjustment (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)</label>
                          <div style={{ position: 'relative' }}>
                            <input className="so-input" readOnly value={(formData.rounding_adjustment || 0).toFixed(2)} style={{ background: '#f8fafc', fontWeight: 800, textAlign: 'right', paddingRight: '3rem' }} />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', opacity: 0.4 }}><DirhamIcon size={12} /></span>
                          </div>
                        </div>

                        <div className="so-field" style={{ width: '100%' }}>
                          <label className="so-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Rounded Total (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)</label>
                          <div style={{ position: 'relative' }}>
                            <input className="so-input" readOnly value={(formData.rounded_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} style={{ background: '#f8fafc', fontWeight: 900, fontSize: '1.2rem', color: themeColor, textAlign: 'right', paddingRight: '3rem' }} />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', opacity: 0.5, color: themeColor }}><DirhamIcon size={14} /></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}
            </div>

            {/* 3. Footer Actions (Fixed) */}
            <div className="so-modal-footer" style={{ flexShrink: 0, padding: '1.25rem 2.5rem', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button disabled={savingOrder} className="so-btn-secondary" style={{ padding: '0.65rem 2rem' }} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button disabled={savingOrder || !metadata} className="so-btn-primary" style={{ padding: '0.65rem 2.5rem', fontSize: '0.85rem' }} onClick={submitCreate}>
                {savingOrder ? <Loader2 className="so-spinner" /> : <Save size={16} />} Save Sales Order
              </button>
            </div>

          </div>
        </div>
      )}
      {/* Quick Customer Creation Modal */}
      {isCustomerModalOpen && (
        <div className="so-modal-overlay" style={{ zIndex: 20000 }}>
          <div className="so-modal" style={{ width: '450px', background: '#fff', borderRadius: '1rem', overflow: 'hidden' }}>
            <div className="so-modal-header" style={{ background: themeColor, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <User size={18} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Create Partner</h3>
              </div>
              <X size={20} className="so-close-btn" onClick={() => setIsCustomerModalOpen(false)} style={{ color: '#fff' }} />
            </div>
            <div className="so-modal-body" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="so-field">
                <label className="so-label">Customer Name *</label>
                <input className="so-input" value={newCustomer.customer_name} onChange={e => setNewCustomer({ ...newCustomer, customer_name: e.target.value })} placeholder="Ex: Star Electronics" />
              </div>
              <div className="so-field">
                <label className="so-label">Mobile Number</label>
                <input className="so-input" value={newCustomer.mobile_no} onChange={e => setNewCustomer({ ...newCustomer, mobile_no: e.target.value })} placeholder="+971..." />
              </div>
              <div className="so-field">
                <label className="so-label">Email Address</label>
                <input className="so-input" type="email" value={newCustomer.email_id} onChange={e => setNewCustomer({ ...newCustomer, email_id: e.target.value })} placeholder="partner@example.com" />
              </div>
            </div>
            <div className="so-modal-footer" style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
              <button className="so-btn-secondary" style={{ flex: 1 }} onClick={() => setIsCustomerModalOpen(false)}>Cancel</button>
              <button className="so-btn-primary" style={{ flex: 1 }} disabled={savingCustomer} onClick={submitQuickCustomer}>
                {savingCustomer ? <Loader2 className="so-spinner" /> : 'Create & Select'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Customer Search Selection Modal */}
      {isAdvancedSearchModalOpen && (
        <div className="so-modal-overlay" style={{ zIndex: 20000 }}>
          <div className="so-modal" style={{ width: '800px', height: '80vh', background: '#fff', borderRadius: '1.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="so-modal-header" style={{ background: themeColor, color: '#fff', padding: '1.5rem 2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Search size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Advanced Partner Selection</h3>
                  <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.8, fontWeight: 600 }}>SEARCH AND SELECT FROM FULL REGISTRY</p>
                </div>
              </div>
              <X size={24} className="so-close-btn" onClick={() => setIsAdvancedSearchModalOpen(false)} style={{ color: '#fff' }} />
            </div>

            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  autoFocus
                  className="so-input"
                  style={{ paddingLeft: '3rem', height: '50px', fontSize: '1rem', borderRadius: '12px' }}
                  placeholder="Type anything to search partners..."
                  value={advancedSearchTerm}
                  onChange={e => setAdvancedSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
              {loadingAllCustomers ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', opacity: 0.5 }}>
                  <Loader2 size={40} className="so-spinner" style={{ color: themeColor }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.1em' }}>SYNCHRONIZING REGISTRY...</span>
                </div>
              ) : filteredAdvanced.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, fontWeight: 900, fontSize: '0.8rem' }}>
                  NO PARTNERS MATCH YOUR SEARCH
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                      <th style={{ padding: '1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Identity Profile</th>
                      <th style={{ padding: '1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Registry ID</th>
                      <th style={{ padding: '1rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvanced.map(c => (
                      <tr
                        key={c.name}
                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}
                        onClick={() => {
                          handleInputChange('customer', c.name);
                          handleInputChange('customer_name', c.customer_name);
                          setCustomerSearch(c.customer_name);
                          setIsAdvancedSearchModalOpen(false);
                          setShowCustomerDropdown(false);
                        }}
                      >
                        <td style={{ padding: '1rem', fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{c.customer_name}</td>
                        <td style={{ padding: '1rem', fontBold: 600, fontSize: '0.8rem', color: themeColor, fontFamily: 'monospace' }}>{c.name}</td>
                        <td style={{ padding: '1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{c.customer_group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, opacity: 0.5 }}>
              TOTAL RESULTS: {filteredAdvanced.length}
            </div>
          </div>
        </div>
      )}
      <GlobalStyles themeColor={themeColor} themeLight={themeLight} />
    </>
  );
}
