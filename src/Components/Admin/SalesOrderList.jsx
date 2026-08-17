import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, ShoppingCart, Receipt, Calendar, User, Layers,
  CheckCircle2, Clock, CreditCard, Palette, Loader2, ChevronLeft, ChevronRight,
  ArrowRight, FileText, Filter, Save, ScanLine, Camera
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { toggleTheme as toggleMainTheme } from '../../Redux/Slices/userSlice';
import '../Headers/LegacyPOS.css';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import ListCustomizer from './ListCustomizer';
import { Settings } from 'lucide-react';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

const API_PATH_C = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const DEFAULT_SO_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
  { id: 'custom_ref_sl_no', label: 'Ref / Customer SL #', visible: true, width: 120 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price', visible: true, width: 90 },
  { id: 'is_tax_inclusive', label: 'Tax Inc/Exc', visible: true, width: 100 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 }
];

const SOItemModel = {
  item_code: '',
  item_name: '',
  rate: 0,
  amount: 0,
  custom_ref_sl_no: '',
  custom_box_qty: 0,
  custom_pieces_per_box: 1,
  custom_box_price: 0,
  use_box_entry: false,
  uom_list: [],
  custom_selling_price: 0,
  is_tax_inclusive: true
};

const loadColumnConfig = () => {
  try {
    const saved = localStorage.getItem('sales_matrix_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaultIds = DEFAULT_SO_COLUMNS.map(c => c.id);
      const savedIds = parsed.map(c => c.id);
      const existing = parsed.filter(c => defaultIds.includes(c.id));
      const missing = DEFAULT_SO_COLUMNS.filter(c => !savedIds.includes(c.id));
      return [...existing, ...missing];
    }
  } catch (e) {
    console.error("SO Matrix Config Error:", e);
  }
  return DEFAULT_SO_COLUMNS;
};

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
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { warehouse, user_roles, theme } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const isAdministrator = (user_roles || []).includes("Administrator");
  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Sales Order');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(location.state?.search || '');

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
  const [showCamera, setShowCamera] = useState(false);
  const html5QrcodeRef = useRef(null);
  const scannerBuffer = useRef("");
  const lastKeyTime = useRef(0);
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

  // Columns Matrix Configuration
  const [soColumns, setSoColumns] = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      setSoColumns(DEFAULT_SO_COLUMNS);
      localStorage.removeItem('sales_matrix_config');
    } else {
      setSoColumns(newConfig);
      localStorage.setItem('sales_matrix_config', JSON.stringify(newConfig));
    }
    setShowColConfig(false);
  };

  const fetchItemUOMs = async (item_code) => {
    try {
      const res = await fetch(`/api/resource/Item/${encodeURIComponent(item_code)}?fields=["uoms","stock_uom"]`, {
        headers: { 'X-Frappe-SID': localStorage.getItem('session') || '' },
        credentials: 'include'
      });
      if (!res.ok) return [{ uom: 'Nos', conversion_factor: 1 }, { uom: 'Box', conversion_factor: 0 }];
      const data = await res.json();
      const doc = data.data || {};
      const uomRows = doc.uoms || [];
      const list = uomRows.map(u => ({ uom: u.uom, conversion_factor: parseFloat(u.conversion_factor) || 1 }));

      const stockUom = doc.stock_uom || 'Nos';
      if (!list.find(u => u.uom === stockUom)) {
        list.unshift({ uom: stockUom, conversion_factor: 1 });
      }

      if (!list.find(u => (u.uom || '').toLowerCase() === "nos")) {
        list.push({ uom: "Nos", conversion_factor: 1 });
      }
      if (!list.find(u => (u.uom || '').toLowerCase() === "box")) {
        list.push({ uom: "Box", conversion_factor: 0 });
      }
      return list;
    } catch (err) {
      return [{ uom: 'Nos', conversion_factor: 1 }, { uom: 'Box', conversion_factor: 0 }];
    }
  };

  const handleUOMChangeList = (uomValue, rowIndex) => {
    setFormData(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[rowIndex] };
      const isBox = uomValue.toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((item.rate || 0) * pPerBox).toFixed(2));
      } else {
        item.custom_pieces_per_box = 1;
        item.qty = parseFloat(item.custom_box_qty) || 0;
        item.custom_box_price = item.rate || 0;
      }
      item.amount = (item.qty || 0) * (item.rate || 0);
      items[rowIndex] = item;
      return recalculate({ ...prev, items });
    });
  };

  const handleInputChangeList = (e, rowIndex) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[rowIndex] };
      item[name] = value;

      const val = (value === '' || value === '.') ? 0 : parseFloat(value);
      const isBoxMode = item.use_box_entry;

      if (name === 'qty' || name === 'rate') {
        const q = name === 'qty' ? val : (parseFloat(item.qty) || 0);
        const r = name === 'rate' ? val : (parseFloat(item.rate) || 0);
        item.amount = parseFloat((q * r).toFixed(2));

        if (name === 'rate') {
          item.custom_box_price = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
        } else if (name === 'qty') {
          item.custom_box_qty = (item.custom_pieces_per_box > 0) ? parseFloat((val / item.custom_pieces_per_box).toFixed(2)) : 0;
        }
      } else if (name === 'custom_box_qty') {
        if (isBoxMode) {
          item.qty = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
        } else {
          item.qty = val;
        }
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_pieces_per_box') {
        const pPerBox = Math.max(1, isNaN(val) ? 1 : val);
        item.qty = parseFloat(((parseFloat(item.custom_box_qty) || 0) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((parseFloat(item.rate) || 0) * pPerBox).toFixed(2));
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_box_price') {
        item.rate = parseFloat((val / (item.custom_pieces_per_box || 1)).toFixed(2));
        item.amount = parseFloat(((parseFloat(item.qty) || 0) * item.rate).toFixed(2));
      }

      items[rowIndex] = item;
      return recalculate({ ...prev, items });
    });
  };

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
  }, [customColumns]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify([
            'name', 'customer', 'customer_name', 'transaction_date', 'grand_total',
            'docstatus', 'status', 'total_qty', 'base_total', 'naming_series',
            ...customColumns
          ]),
          filters: !isAdmin && warehouse ? JSON.stringify([['Sales Order Item', 'warehouse', '=', warehouse]]) : undefined,
          order_by: '`tabSales Order`.modified desc'
        },
        withCredentials: true
      });
      const rawOrders = Array.isArray(res.data.data) ? res.data.data : [];
      const uniqueOrders = [];
      const seen = new Set();
      for (const order of rawOrders) {
        if (!seen.has(order.name)) {
          seen.add(order.name);
          uniqueOrders.push(order);
        }
      }
      setOrders(uniqueOrders);
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
      items: [{ ...SOItemModel, delivery_date: today, qty: 1, rate: 0, amount: 0 }],
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

    let currentTaxesTemplates = taxesTemplates;

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
        currentTaxesTemplates = taxRes.data.data || [];
        setTaxesTemplates(currentTaxesTemplates);
      } catch (err) {
        Swal.fire('Metadata Error', 'Could not fetch Sales Order structure', 'error');
      } finally {
        setLoadingMetadata(false);
      }
    }

    if (currentTaxesTemplates.length > 0) {
      const defaultTax = currentTaxesTemplates.find(t => t.name.toUpperCase().includes('VAT 5% - NS')) ||
        currentTaxesTemplates.find(t => t.name.toUpperCase().includes('VAT 5% - KSPL')) ||
        currentTaxesTemplates.find(t => t.name.toUpperCase().includes('UAE VAT 5%')) ||
        currentTaxesTemplates.find(t => t.name.toUpperCase().includes('VAT 5%')) ||
        currentTaxesTemplates.find(t => t.name.toUpperCase().includes('5%'));
      if (defaultTax) {
        try {
          const res = await axios.get(`${API_PATH_C}.get_sales_taxes_templates_so`, { params: { template: defaultTax.name }, withCredentials: true });
          let rows = (res.data.message || []).map(t => ({
            charge_type: t.charge_type,
            account_head: t.account_head,
            description: t.description || t.account_head || 'VAT',
            rate: t.rate,
            add_deduct_tax: t.add_deduct_tax || 'Add',
            tax_amount: 0,
            total: 0
          }));
          if (rows.length === 0 && defaultTax.name) {
            let rate = 0; let account = "";
            if (defaultTax.name.includes("5%")) { rate = 5; account = "VAT 5% - NS"; }
            else if (defaultTax.name.includes("Zero")) { rate = 0; account = "VAT Zero - NS"; }
            else if (defaultTax.name.includes("Exempted")) { rate = 0; account = "VAT Exempted - NS"; }
            else if (defaultTax.name.includes("50%")) { rate = 50; account = "Excise 50% - NS"; }
            else if (defaultTax.name.includes("100%")) { rate = 100; account = "Excise 100% - NS"; }
            if (account) {
              rows = [{ charge_type: "On Net Total", account_head: account, description: account, rate: rate, add_deduct_tax: "Add", tax_amount: 0, total: 0 }];
            }
          }
          setFormData(prev => recalculate({
            ...prev,
            taxes_and_charges: defaultTax.name,
            taxes: rows
          }));
        } catch (err) {
          console.error('Failed to auto-load default tax template details:', err);
        }
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
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_customer_retail', {
        data: {
          customer_name: newCustomer.customer_name,
          mobile_no: newCustomer.mobile_no
        }
      }, { withCredentials: true });

      const respData = res.data.message;
      if (respData && respData.status === 'error') {
        return Swal.fire('Error', respData.message, 'error');
      }

      const createdName = respData.name;
      const createdCustomerName = respData.customer_name || respData.name;
      Swal.fire({ icon: 'success', title: 'Customer Created', text: createdCustomerName, timer: 1500, showConfirmButton: false });

      // Auto-select the newly created customer
      handleInputChange('customer', createdName);
      handleInputChange('customer_name', createdCustomerName);
      setCustomerSearch(createdCustomerName);

      setIsCustomerModalOpen(false);
      setNewCustomer({ customer_name: '', mobile_no: '' });
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

    const total_qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const base_total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    let total_taxes = 0;
    let prev_total = base_total;

    const updatedTaxes = taxes.map(tax => {
      const rate = parseFloat(tax.rate) || 0;
      let taxAmount = 0;
      if (tax.charge_type === 'Actual') {
        taxAmount = parseFloat(tax.tax_amount) || 0;
      } else if (tax.charge_type === 'On Previous Row Amount') {
        taxAmount = prev_total * (rate / 100);
      } else {
        taxAmount = base_total * (rate / 100);
      }
      const signed = tax.add_deduct_tax === 'Add' ? taxAmount : -taxAmount;
      total_taxes += signed;
      prev_total += signed;
      return {
        ...tax,
        tax_amount: tax.charge_type === 'Actual' ? parseFloat(tax.tax_amount || 0) : parseFloat(taxAmount.toFixed(3)),
        total: signed.toFixed(3),
      };
    });

    const net = base_total + total_taxes;
    const disc_perc = parseFloat(currentForm.additional_discount_percentage) || 0;
    const disc_amt = parseFloat(currentForm.discount_amount) || 0;
    const discount = currentForm.apply_discount_on === 'Grand Total'
      ? (net * disc_perc / 100) + disc_amt
      : (base_total * disc_perc / 100) + disc_amt;

    const grand_total = net - discount;
    const rounded_total = Math.round(grand_total * 100) / 100;

    return {
      ...currentForm,
      total_qty,
      base_total,
      total: base_total,
      total_taxes_and_charges: parseFloat(total_taxes.toFixed(2)),
      grand_total: parseFloat(grand_total.toFixed(2)),
      rounded_total: parseFloat(rounded_total.toFixed(2)),
      rounding_adjustment: parseFloat((rounded_total - grand_total).toFixed(2)),
      taxes: updatedTaxes,
    };
  };

  const handleInputChange = (fieldname, value) => {
    setFormData(prev => ({ ...prev, [fieldname]: value }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { ...SOItemModel, delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 }]
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

  const handleBarcodeSearchModalDirect = async (val) => {
    if (!val.trim()) return;
    const activeWarehouse = formData.set_source_warehouse || warehouse || localStorage.getItem('warehouse') || '';
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
        params: { search_term: val, warehouse: activeWarehouse },
        withCredentials: true
      });
      const apiItem = (res.data.message || [])[0];

      if (apiItem) {
        let rate = apiItem.price_list_rate || 0;
        try {
          const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
            params: {
              item_code: apiItem.name,
              price_list: formData.selling_price_list || 'Standard Selling'
            },
            withCredentials: true
          });
          const fetchedRate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || rateRes.data?.rate;
          if (fetchedRate !== undefined) {
            rate = fetchedRate;
          }
        } catch (err) {
          console.warn('Failed to fetch selling rate, using fallback rate', err);
        }

        setFormData(prev => {
          const items = [...(prev.items || [])];
          const emptyIdx = items.findIndex(i => !i.item_code);
          const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;

          const pPerBox = parseFloat(apiItem.custom_pieces_per_box || 1);
          const uomList = apiItem.uom_list || [];

          const newRow = {
            ...SOItemModel,
            item_code: apiItem.name,
            item_name: apiItem.item_name,
            stock_uom: apiItem.stock_uom || 'Nos',
            uom: apiItem.stock_uom || 'Nos',
            uom_list: uomList,
            use_box_entry: false,
            qty: 1,
            rate,
            amount: rate,
            custom_pieces_per_box: 1,
            default_pieces_per_box: pPerBox,
            custom_box_qty: 1,
            custom_box_price: rate,
            custom_selling_price: parseFloat(apiItem.selling_price || 0),
            custom_ref_sl_no: apiItem.custom_ref_sl_no || apiItem.custom_supplier_sl_num || '',
            warehouse: apiItem.warehouse || prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
          };

          if (emptyIdx !== -1) items[emptyIdx] = newRow;
          else items.push(newRow);

          // Async fetch UOMs
          fetchItemUOMs(apiItem.name).then(fetchedUoms => {
            setFormData(p => {
              const its = [...(p.items || [])];
              const ri = its.findIndex(i => i.item_code === apiItem.name);
              if (ri !== -1) its[ri] = { ...its[ri], uom_list: fetchedUoms };
              return { ...p, items: its };
            });
          });

          if (items.every(i => i.item_code)) {
            items.push({ ...SOItemModel, delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 });
          }
          return recalculate({ ...prev, items });
        });
        setBarcodeInput('');
      } else {
        // Global Discovery Fallback
        try {
          const globalRes = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', {
            search_term: val
          }, { withCredentials: true });
          const it = globalRes.data?.message?.[0] || globalRes.data?.[0] || null;

          if (it) {
            const availableBranches = (it.warehouse_details || it.branch_availability || [])
              .filter(b => (b.actual_qty || b.qty || 0) > 0)
              .map(b => b.warehouse_name || b.warehouse)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(", ");

            Swal.fire({
              title: 'Item Found in Other Branches',
              html: `<div style="font-size: 15px; font-weight: 600; color: #475569; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                  This item is not enabled for <span style="font-weight: 800; color: #0f172a;">${activeWarehouse}</span>.
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #1e293b; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #4f46e5; text-align: left; line-height: 1.4; margin-bottom: 12px;">
                  ${it.item_name || it.name}
              </div>
              <div style="text-align: left; font-size: 14px; color: #475569;">
                  <p style="font-weight: 600; margin-bottom: 4px;">Stock available in:</p>
                  <p style="color: #059669; font-weight: 700;">${availableBranches || 'None (No physical stock)'}</p>
              </div>`,
              icon: 'info',
              confirmButtonColor: '#4f46e5'
            });
            setBarcodeInput('');
          } else {
            Swal.fire('Not Found', 'Item not found in local or global database.', 'error');
            setBarcodeInput('');
          }
        } catch (globalErr) {
          console.error("Global search failed:", globalErr);
          Swal.fire('Not Found', 'Item not found in database.', 'error');
          setBarcodeInput('');
        }
      }
    } catch (err) {
      Swal.fire('Scan Error', err.response?.data?.message || err.message || 'Unknown error', 'error');
    }
  };

  const handleBarcodeSearchModal = async (e) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    handleBarcodeSearchModalDirect(barcodeInput.trim());
  };

  // Camera scanner start/stop logic
  useEffect(() => {
    if (showCamera) {
      const html5Qrcode = new Html5Qrcode("solist-scanner-reader");
      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: (width, height) => {
          const boxWidth = Math.min(width * 0.8, 450);
          const boxHeight = Math.min(height * 0.6, 250);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.777778
      };

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      html5Qrcode.start(
        { facingMode: "environment" },
        { ...config, formatsToSupport: formats },
        (decodedText) => {
          if (showCamera) {
            handleBarcodeSearchModalDirect(decodedText.trim());
            setShowCamera(false);
            html5Qrcode.stop().catch(err => console.error("Error stopping camera on success:", err));
          }
        },
        () => { }
      ).catch(err => {
        console.error("Camera start failed, trying fallback:", err);
        html5Qrcode.start(
          { deviceId: undefined },
          { ...config, formatsToSupport: formats },
          (decodedText) => {
            if (showCamera) {
              handleBarcodeSearchModalDirect(decodedText.trim());
              setShowCamera(false);
              html5Qrcode.stop().catch(fallbackErr => console.error("Error stopping fallback camera success:", fallbackErr));
            }
          },
          () => { }
        ).catch(finalErr => {
          console.error("All startup options failed:", finalErr);
          Swal.fire('Camera Error', 'Could not start camera barcode scanner.', 'error');
          setShowCamera(false);
        });
      });
    }

    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().catch(err => console.error("Error during stop cleanup:", err));
        }
      }
    };
  }, [showCamera]);

  // Global shortcuts and hardware barcode scanner interceptor
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const now = Date.now();
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);

      // Barcode interceptor
      if (now - lastKeyTime.current > 150) {
        scannerBuffer.current = "";
      }
      lastKeyTime.current = now;

      if (e.key.length === 1 && /^[0-9]$/.test(e.key) && !isInputFocused) {
        scannerBuffer.current += e.key;
        return;
      } else if (e.key === 'Enter' && scannerBuffer.current.length >= 6 && !isInputFocused) {
        e.preventDefault();
        const scanValue = scannerBuffer.current;
        scannerBuffer.current = "";
        if (isModalOpen) {
          handleBarcodeSearchModalDirect(scanValue);
        }
        return;
      }

      // Keyboard Shortcuts when creation modal is open
      if (!isModalOpen) return;

      const inItemsTable = activeEl && activeEl.closest('table.so-table');
      let activeRowIndex = -1;
      if (inItemsTable && activeEl) {
        const tr = activeEl.closest('tr');
        if (tr) {
          const rowIndexAttr = tr.getAttribute('data-row-index');
          if (rowIndexAttr !== null) {
            activeRowIndex = parseInt(rowIndexAttr, 10);
          }
        }
      }

      // F2: Focus Customer Search input
      if (isShortcutPressed(e, 'doc_editor', 'customerSupplier', 'F2')) {
        e.preventDefault();
        const customerInput = document.querySelector('input[placeholder="Search customer..."]');
        if (customerInput) {
          customerInput.focus();
          customerInput.select?.();
        }
      }

      // F3: Focus Item Search input
      if (isShortcutPressed(e, 'doc_editor', 'itemSearch', 'F3')) {
        e.preventDefault();
        const itemInputs = document.querySelectorAll('input[placeholder="SKU or Name..."]');
        if (itemInputs.length > 0) {
          const firstInput = itemInputs[0];
          const targetInput = (firstInput && !firstInput.value) ? firstInput : itemInputs[itemInputs.length - 1];
          if (targetInput) {
            targetInput.focus();
            targetInput.select?.();
          }
        }
      }

      // F4: Focus Barcode/Scan input
      if (isShortcutPressed(e, 'doc_editor', 'barcode', 'F4')) {
        e.preventDefault();
        const scanInput = document.querySelector('input[placeholder="Focus here to scan..."]');
        if (scanInput) {
          scanInput.focus();
          scanInput.select?.();
        }
      }

      // F6: Bulk Quantity Update popup
      if (isShortcutPressed(e, 'doc_editor', 'bulkQty', 'F6')) {
        e.preventDefault();
        let rowIndex = inItemsTable ? activeRowIndex : ((formData.items || []).length - 1);
        if (rowIndex >= 0 && rowIndex < (formData.items || []).length) {
          const item = (formData.items || [])[rowIndex];
          if (item && item.item_code) {
            Swal.fire({
              title: 'Bulk Quantity',
              html: `<div style="font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; padding: 10px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #10b981; text-align: left;">
                ${item.item_name || item.item_code}
              </div>`,
              input: 'number',
              inputPlaceholder: 'Enter quantity...',
              inputValue: item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || ''),
              showCancelButton: true,
              confirmButtonText: 'Update',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#64748b'
            }).then(result => {
              if (result.isConfirmed && result.value !== undefined) {
                const newQty = result.value || '';
                const name = item.use_box_entry ? 'custom_box_qty' : 'qty';
                handleInputChangeList({ target: { name, value: newQty } }, rowIndex);
              }
            });
          }
        }
      }

      // F8: Toggle UOM
      if (isShortcutPressed(e, 'doc_editor', 'uom', 'F8')) {
        e.preventDefault();
        let rowIndex = inItemsTable ? activeRowIndex : ((formData.items || []).length - 1);
        if (rowIndex >= 0 && rowIndex < (formData.items || []).length) {
          const item = (formData.items || [])[rowIndex];
          if (item && item.item_code) {
            let nextUom = '';
            const currentUom = (item.uom || item.stock_uom || '').toLowerCase();
            const uomList = item.uom_list || [];
            if (uomList.length > 1) {
              const currentIndex = uomList.findIndex(u => u.uom.toLowerCase() === currentUom);
              const nextIndex = (currentIndex + 1) % uomList.length;
              nextUom = uomList[nextIndex].uom;
            } else {
              nextUom = currentUom === 'box' ? (item.stock_uom || 'Nos') : 'Box';
            }
            handleUOMChangeList(nextUom, rowIndex);
            Swal.fire({
              icon: 'info',
              title: 'UOM Switched',
              text: `Row ${rowIndex + 1}: Switched UOM to ${nextUom}`,
              toast: true,
              position: 'top-end',
              timer: 2000,
              showConfirmButton: false
            });
          }
        }
      }

      // F7 or Ctrl+S: Save Draft
      if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        if (!savingOrder) {
          submitCreate();
        }
      }

      // F10 or Alt+A: Add Item Row
      if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        addItemRow();
        setTimeout(() => {
          const itemInputs = document.querySelectorAll('table.so-table tbody tr input[placeholder="SKU or Name..."]');
          if (itemInputs.length > 0) {
            const lastInput = itemInputs[itemInputs.length - 1];
            if (lastInput) {
              lastInput.focus();
              lastInput.select?.();
            }
          }
        }, 100);
      }

      // F9: Focus Source Warehouse Select
      if (isShortcutPressed(e, 'doc_editor', 'warehouseBranch', 'F9')) {
        e.preventDefault();
        const warehouseSelect = document.querySelector('select[name="set_source_warehouse"]');
        if (warehouseSelect) {
          warehouseSelect.focus();
        }
      }

      // F12 or Ctrl+Enter: Submit sales order
      if (isShortcutPressed(e, 'doc_editor', 'submit', 'F12') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (!savingOrder) {
          submitCreate();
        }
      }

      // Escape: Close modals/menus or blur active input
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showColConfig) setShowColConfig(false);
        else if (isModalOpen) {
          setIsModalOpen(false);
        } else if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          activeEl.blur();
        }
      }

      // Tab Key Navigation Inside Table (Do not close or leave)
      if (e.key === 'Tab') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            const rowInputs = Array.from(tr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
            const inputIndex = rowInputs.indexOf(activeEl);

            if (inputIndex === rowInputs.length - 1 && !e.shiftKey) {
              e.preventDefault();
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              const isLastRow = rowIndex === (formData.items || []).length - 1;

              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const firstInput = newTr.querySelector('input:not([disabled]), select:not([disabled])');
                    if (firstInput) {
                      firstInput.focus();
                      firstInput.select?.();
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input:not([disabled]), select:not([disabled])');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else if (inputIndex === 0 && e.shiftKey) {
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              if (rowIndex > 0) {
                e.preventDefault();
                const prevTr = tr.previousElementSibling;
                if (prevTr) {
                  const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
                  if (prevInputs.length > 0) {
                    const lastInput = prevInputs[prevInputs.length - 1];
                    lastInput.focus();
                    lastInput.select?.();
                  }
                }
              }
            }
          }
        }
      }

      // Enter key inside table inputs: add row or navigate down
      if (e.key === 'Enter') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const isSearchInput = activeEl.placeholder === 'SKU or Name...';
          const isDropdownOpen = document.querySelector('.so-dropdown');
          if (isSearchInput && isDropdownOpen) return; // Let search dropdown handle it

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            const isLastRow = rowIndex === (formData.items || []).length - 1;
            const isRateField = activeEl.name === 'rate' || activeEl.name === 'custom_box_price';

            if (isRateField) {
              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const firstInput = newTr.querySelector('input[placeholder="SKU or Name..."]');
                    if (firstInput) {
                      firstInput.focus();
                      firstInput.select?.();
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input[placeholder="SKU or Name..."]');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else {
              if (isLastRow) {
                addItemRow();
                setTimeout(() => {
                  const tableBody = tr.parentNode;
                  const newTr = tableBody.lastElementChild;
                  if (newTr) {
                    const targetTd = newTr.children[colIndex];
                    if (targetTd) {
                      const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                      if (targetInput) {
                        targetInput.focus();
                        targetInput.select?.();
                      }
                    }
                  }
                }, 50);
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const targetTd = nextTr.children[colIndex];
                  if (targetTd) {
                    const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                    if (targetInput) {
                      targetInput.focus();
                      targetInput.select?.();
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Escape key inside table input to select/focus the parent row (TR) itself
      if (e.key === 'Escape') {
        if (inItemsTable && activeEl && activeEl.tagName !== 'TR') {
          const tr = activeEl.closest('tr');
          if (tr) {
            e.preventDefault();
            tr.focus();
            return;
          }
        }
      }

      // Keyboard actions when the row itself is focused
      if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.so-table')) {
        const tr = activeEl;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
          if (targetTr && targetTr.tagName === 'TR') {
            targetTr.focus();
          }
        }

        if (e.key === 'Enter' || e.key === 'F3' || e.key === ' ') {
          e.preventDefault();
          const firstInput = tr.querySelector('input:not([disabled]), select:not([disabled])');
          if (firstInput) {
            firstInput.focus();
            firstInput.select?.();
          }
        }

        if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
          const isPlus = e.key === '+' || e.key === '=';
          const qtyInput = tr.querySelector('input[name="qty"]:not([disabled])') || tr.querySelector('input[name="custom_box_qty"]:not([disabled])');
          if (qtyInput && activeRowIndex !== -1) {
            e.preventDefault();
            const currentVal = parseFloat(qtyInput.value) || 0;
            const diff = isPlus ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            handleInputChangeList({ target: { name: qtyInput.name, value: newVal.toString() } }, activeRowIndex);
          }
        }
      }

      // Arrow Up/Down navigation inside table inputs
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isSearchInput = activeEl.placeholder === 'SKU or Name...';
          const isDropdownOpen = document.querySelector('.so-dropdown');
          if (isSearchInput && isDropdownOpen && !e.altKey && !e.ctrlKey) return;

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
            if (targetTr) {
              const targetTd = targetTr.children[colIndex];
              if (targetTd) {
                const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                if (targetInput) {
                  targetInput.focus();
                  targetInput.select?.();
                }
              }
            }
          }
        }
      }

      // + / -: Increase / Decrease focused row quantity
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isQtyField = activeEl.name === 'qty' || activeEl.name === 'custom_box_qty';
          if (isQtyField && activeRowIndex !== -1) {
            e.preventDefault();
            const currentVal = parseFloat(activeEl.value) || 0;
            const diff = (e.key === '+' || e.key === '=') ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            handleInputChangeList({ target: { name: activeEl.name, value: newVal.toString() } }, activeRowIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModalOpen, formData, savingOrder, showColConfig]);

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

      const pPerBox = parseFloat(item.custom_pieces_per_box || 1);
      const uomList = item.uom_list || [];

      setFormData(prev => {
        const newItems = [...(prev.items || [])];
        newItems[idx] = {
          ...SOItemModel,
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom || 'Nos',
          uom: item.stock_uom || 'Nos',
          uom_list: uomList,
          use_box_entry: false,
          qty: 1,
          rate,
          amount: rate,
          custom_pieces_per_box: 1,
          default_pieces_per_box: pPerBox,
          custom_box_qty: 1,
          custom_box_price: rate,
          custom_selling_price: parseFloat(item.selling_price || 0),
          custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
          warehouse: item.warehouse || prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
        };

        // Async fetch UOMs
        fetchItemUOMs(item.item_code).then(fetchedUoms => {
          setFormData(p => {
            const its = [...(p.items || [])];
            if (its[idx]) its[idx].uom_list = fetchedUoms;
            return { ...p, items: its };
          });
        });

        if (idx === newItems.length - 1) {
          newItems.push({ ...SOItemModel, delivery_date: prev.delivery_date || '', qty: 0, rate: 0, amount: 0 });
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
        .map(i => {
          const isBox = (i.uom || '').toLowerCase() === 'box';
          return {
            ...i,
            qty: isBox ? (parseFloat(i.custom_box_qty) || 0) : (parseFloat(i.qty) || 0),
            rate: isBox ? (parseFloat(i.custom_box_price) || 0) : (parseFloat(i.rate) || 0),
            amount: parseFloat(i.amount) || 0,
            conversion_factor: isBox ? (parseFloat(i.custom_pieces_per_box) || 1) : 1.0,
            stock_qty: parseFloat(i.qty) || 0,
            stock_uom_rate: parseFloat(i.rate) || 0,
            custom_ref_sl_no: i.custom_ref_sl_no || '',
            custom_box_qty: parseFloat(i.custom_box_qty) || 0,
            custom_pieces_per_box: parseFloat(i.custom_pieces_per_box) || 1,
            custom_box_price: parseFloat(i.custom_box_price) || 0,
            custom_selling_price: parseFloat(i.custom_selling_price) || 0,
            warehouse: i.warehouse || formData.set_source_warehouse || localStorage.getItem('warehouse')
          };
        });

      if (validItems.length === 0) return Swal.fire('Error', 'No items added', 'warning');

      setSavingOrder(true);
      const payload = {
        ...formData,
        set_warehouse: formData.set_source_warehouse,
        items: validItems,
        taxes: (formData.taxes || []).map(t => ({
          charge_type: t.charge_type,
          account_head: t.account_head,
          rate: parseFloat(t.rate) || 0,
          tax_amount: parseFloat(t.tax_amount) || parseFloat(t.total) || 0,
          description: t.description || t.account_head || 'VAT'
        })),
        advance_paid: parseFloat(formData.advance_paid) || 0,
        total_qty: parseFloat(formData.total_qty) || 0,
        base_total: parseFloat(formData.base_total) || 0,
        grand_total: parseFloat(formData.grand_total) || 0,
        rounded_total: parseFloat(formData.rounded_total) || 0
      };

      const res = await axios.post(`${API_PATH_C}.save_transaction_document`, {
        doctype: 'Sales Order',
        doc_data: payload,
        action: 'save'
      }, { withCredentials: true });
      
      const savedDocName = res.data?.data?.name || res.data?.message?.data?.name;
      Swal.fire({ icon: 'success', title: 'Order Created', text: `ID: ${savedDocName}`, timer: 3000 });
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
          <div className="so-page-header-container">
            <div className="so-page-tabs">
              <span className="so-page-tab active">Sales Order</span>
              <span className="so-page-tab" onClick={() => navigate('/salesreport')} style={{ cursor: 'pointer' }}>Reports</span>
            </div>
            <div className="so-page-header">
              <div>
                <h1 className="so-page-title">Sales Order Management</h1>
                <p className="so-page-subtitle">Manage and track all sales</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => dispatch(toggleMainTheme())}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    background: theme === 'legacy' ? '#ecfdf5' : (theme === 'modern_no_image' ? '#e0e7ff' : '#f0f9ff'),
                    color: theme === 'legacy' ? '#059669' : (theme === 'modern_no_image' ? '#4f46e5' : '#0284c7'),
                    border: `1.5px solid ${theme === 'legacy' ? '#a7f3d0' : (theme === 'modern_no_image' ? '#c7d2fe' : '#bae6fd')}`,
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem', fontWeight: 900,
                    cursor: 'pointer', transition: 'all 0.2s',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}
                  title="Switch UI Theme (Modern / No Image / Classic)"
                >
                  <Palette size={13} />
                  <span>THEME: {(theme || 'modern').toUpperCase()}</span>
                </button>

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
                <ListCustomizer
                  doctype="Sales Order"
                  onSave={cols => setCustomColumns(cols)}
                  themeColor={themeColor}
                />
                <button className="so-btn-primary" onClick={() => navigate('/salesorder/create')}>
                  <Plus size={16} /> Create Sales Order
                </button>
              </div>
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
                      {customColumns.map(col => (
                        <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                      ))}
                      <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6 + customColumns.length} className="so-empty">
                          <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Loading Orders...</p>
                        </td>
                      </tr>
                    ) : paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6 + customColumns.length} className="so-empty">
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
                          {customColumns.map(col => (
                            <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {order[col] !== undefined && order[col] !== null ? String(order[col]) : '-'}
                            </td>
                          ))}
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

            {/* Premium Glassmorphic Keyboard Shortcuts Guide Banner */}
            <div className="w-full bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-sky-50/50 backdrop-blur-md border-b border-emerald-100/60 px-8 py-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] font-medium text-slate-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase tracking-wider text-[10px]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Quick Shortcuts
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Customer</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'itemSearch', 'F3')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Item Search</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'barcode', 'F4')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Barcode</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'bulkQty', 'F6')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Bulk Qty</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'uom', 'F8')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Toggle UOM</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200/80 shadow-sm transition-all hover:scale-105 hover:bg-emerald-50">
                  <kbd className="px-1.5 py-0.5 bg-emerald-200 border border-emerald-300 rounded text-[9px] font-black text-emerald-700 shadow-sm">{getShortcut('doc_editor', 'saveDraft', 'F7')}</kbd>
                  <span className="text-[10px] font-semibold text-emerald-800">Save Draft</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut("doc_editor", "addRowAlt", "Alt+A")}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Add Row</span>
                </div>
                {isAdministrator && (
                  <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'warehouseBranch', 'F9')}</kbd>
                    <span className="text-[10px] font-semibold text-slate-600">Branch</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut("doc_editor", "submitAlt", "Ctrl+Enter")} / {getShortcut('doc_editor', 'submit', 'F12')}</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Submit</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Shift+F3 / Ctrl+↓</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Focus Table</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Escape</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Close / Clear</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">+ / -</kbd>
                  <span className="text-[10px] font-semibold text-slate-600">Qty Adjust</span>
                </div>
              </div>
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
                            <input className="so-input" type="date" value={formData.transaction_date || ''}
                              onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                              onChange={e => handleInputChange('transaction_date', e.target.value)} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Delivery Date</label>
                            <input className="so-input" type="date" value={formData.delivery_date || ''}
                              onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                              onChange={e => handleInputChange('delivery_date', e.target.value)} />
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
                              <input className="so-input" type="date" value={formData.po_date || ''}
                                onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                onChange={e => handleInputChange('po_date', e.target.value)} />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</h3>
                          <button
                            type="button"
                            onClick={() => setShowColConfig(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            title="Column Configuration"
                          >
                            <Settings size={14} style={{ color: '#94a3b8' }} />
                          </button>
                        </div>
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                          <div className="so-field">
                            <label className="so-label">Scan Barcode / SKU</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                  className="so-input"
                                  placeholder="Point scanner here..."
                                  ref={barcodeRef}
                                  value={barcodeInput}
                                  onChange={e => setBarcodeInput(e.target.value)}
                                  onKeyDown={handleBarcodeSearchModal}
                                  style={{ width: '100%' }}
                                />
                                <ScanLine size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowCamera(true)}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: '38px', height: '38px',
                                  background: themeColor, color: '#fff',
                                  border: 'none', borderRadius: '0.375rem',
                                  cursor: 'pointer', transition: 'background 0.2s',
                                  flexShrink: 0
                                }}
                                title="Start Camera Scanner"
                              >
                                <Camera size={16} />
                              </button>
                            </div>
                          </div>
                          {isAdministrator && (
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
                          )}
                        </div>
                      </div>

                      <div className="so-table-wrapper" style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <table className="so-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}><input type="checkbox" /></th>
                              <th style={{ width: '50px' }}>No.</th>
                              {(() => {
                                const hasAnyBox = (formData.items || []).some(i => i.use_box_entry);
                                const activeCols = soColumns.filter(c => {
                                  if (!c.visible) return false;
                                  if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                  return true;
                                });

                                return activeCols.map(col => {
                                  let finalLabel = col.label;

                                  if (!hasAnyBox) {
                                    if (col.id === 'custom_box_qty') finalLabel = 'Qty';
                                    if (col.id === 'custom_box_price') finalLabel = 'Price';
                                    if (col.id === 'custom_pieces_per_box') finalLabel = '';
                                  }

                                  let alignClass = "text-center";
                                  if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
                                    alignClass = "text-left pl-3";
                                  } else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) {
                                    alignClass = "text-right pr-3";
                                  }

                                  return (
                                    <th
                                      key={col.id}
                                      className={alignClass}
                                      style={{ width: col.width, minWidth: col.id === 'item_code' ? 120 : undefined }}
                                    >
                                      {finalLabel}
                                    </th>
                                  );
                                });
                              })()}
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(formData.items || []).map((item, idx) => (
                              <tr key={idx} style={{ zIndex: showItemDropdowns[idx] ? 100 : 1 }}>
                                <td><input type="checkbox" /></td>
                                <td style={{ fontWeight: 700, opacity: 0.4 }}>{idx + 1}</td>
                                {(() => {
                                  const hasAnyBox = (formData.items || []).some(i => i.use_box_entry);
                                  const activeCols = soColumns.filter(c => {
                                    if (!c.visible) return false;
                                    if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                    return true;
                                  });

                                  return activeCols.map(col => {
                                    switch (col.id) {
                                      case 'item_code':
                                        return (
                                          <td
                                            key={col.id}
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
                                        );
                                      case 'custom_ref_sl_no':
                                        return (
                                          <td key={col.id}>
                                            <input
                                              className="so-table-input"
                                              style={{ textAlign: 'center' }}
                                              type="text"
                                              name="custom_ref_sl_no"
                                              value={item.custom_ref_sl_no || ''}
                                              onChange={(e) => handleInputChangeList(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              placeholder="Serial..."
                                            />
                                          </td>
                                        );
                                      case 'custom_box_qty':
                                        return (
                                          <td key={col.id}>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                              <input
                                                className="so-table-input"
                                                style={{ textAlign: 'left', paddingLeft: '10px', paddingRight: '45px', fontWeight: 'bold', color: item.use_box_entry ? '#0284c7' : '#334155' }}
                                                type="text"
                                                inputMode="decimal"
                                                name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                                value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                                onChange={(e) => handleInputChangeList(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                              {item.item_code && (
                                                <span style={{
                                                  position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                  color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                  background: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                  border: `1px solid ${item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0'}`,
                                                  borderRadius: '3px', padding: '1px 4px', pointerEvents: 'none'
                                                }}>
                                                  {item.use_box_entry ? 'BOXES' : 'NOS'}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      case 'uom':
                                        return (
                                          <td key={col.id}>
                                            <select
                                              className="so-table-input"
                                              value={item.uom || 'Nos'}
                                              onChange={e => handleUOMChangeList(e.target.value, idx)}
                                            >
                                              {(() => {
                                                const uniqueUoms = [];
                                                const seen = new Set();
                                                const candidates = [];
                                                if (item.uom_list && Array.isArray(item.uom_list)) {
                                                  item.uom_list.forEach(u => { if (u && u.uom) candidates.push(u.uom); });
                                                }
                                                candidates.push(item.stock_uom || 'Nos');
                                                candidates.push(item.uom || 'Nos');
                                                candidates.push('Nos');
                                                candidates.push('Box');

                                                candidates.forEach(u => {
                                                  const norm = u.trim().toLowerCase();
                                                  let display = u.trim();
                                                  if (norm === 'box') display = 'Box';
                                                  else if (norm === 'nos') display = 'Nos';

                                                  if (!seen.has(norm)) {
                                                    seen.add(norm);
                                                    uniqueUoms.push(display);
                                                  }
                                                });
                                                return uniqueUoms.map(uomVal => (
                                                  <option key={uomVal} value={uomVal}>{uomVal}</option>
                                                ));
                                              })()}
                                            </select>
                                          </td>
                                        );
                                      case 'custom_pieces_per_box':
                                        return (
                                          <td key={col.id}>
                                            {item.use_box_entry ? (
                                              <input
                                                className="so-table-input"
                                                style={{ textAlign: 'left', paddingLeft: '10px' }}
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_pieces_per_box"
                                                value={item.custom_pieces_per_box || ''}
                                                onChange={(e) => handleInputChangeList(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                            ) : (
                                              <div style={{ padding: '0 10px', fontSize: '0.75rem', opacity: 0.4, textAlign: 'left' }}>—</div>
                                            )}
                                          </td>
                                        );
                                      case 'custom_box_price':
                                        return (
                                          <td key={col.id}>
                                            {item.use_box_entry ? (
                                              <input
                                                className="so-table-input"
                                                style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold' }}
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_box_price"
                                                value={item.custom_box_price || ''}
                                                onChange={(e) => handleInputChangeList(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                            ) : (
                                              <div style={{ padding: '0 10px', fontSize: '0.75rem', opacity: 0.4, textAlign: 'center' }}>—</div>
                                            )}
                                          </td>
                                        );
                                      case 'rate':
                                        return (
                                          <td key={col.id}>
                                            <input
                                              className="so-table-input"
                                              style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold' }}
                                              type="text"
                                              inputMode="decimal"
                                              name="rate"
                                              value={item.rate || ''}
                                              onChange={(e) => handleInputChangeList(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                            />
                                          </td>
                                        );
                                      case 'custom_selling_price':
                                        return (
                                          <td key={col.id}>
                                            <input
                                              className="so-table-input"
                                              style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold', color: themeColor }}
                                              type="text"
                                              inputMode="decimal"
                                              name="custom_selling_price"
                                              value={item.custom_selling_price || ''}
                                              onChange={(e) => handleInputChangeList(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                            />
                                          </td>
                                        );
                                      case 'is_tax_inclusive':
                                        return (
                                          <td key={col.id}>
                                            <select
                                              className="so-table-input"
                                              style={{ height: '38px', fontSize: '0.75rem', fontWeight: 'bold' }}
                                              value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                                              onChange={e => {
                                                const val = e.target.value === 'Inclusive';
                                                setFormData(prev => {
                                                  const items = [...(prev.items || [])];
                                                  items[idx] = { ...items[idx], is_tax_inclusive: val };
                                                  return recalculate({ ...prev, items });
                                                });
                                              }}
                                            >
                                              <option value="Inclusive">Inclusive</option>
                                              <option value="Exclusive">Exclusive</option>
                                            </select>
                                          </td>
                                        );
                                      case 'qty':
                                        return (
                                          <td key={col.id}>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                              <div style={{ padding: '0 10px', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', height: '38px', display: 'flex', alignItems: 'center', width: '100%' }}>
                                                {item.qty || 0}
                                              </div>
                                              {item.use_box_entry && (
                                                <span style={{
                                                  position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                  color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                  borderRadius: '3px', padding: '1px 4px', pointerEvents: 'none'
                                                }}>
                                                  NOS
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      case 'amount':
                                        return (
                                          <td key={col.id} style={{ textAlign: 'right', fontWeight: 700, verticalAlign: 'middle', paddingRight: '10px' }}>
                                            {(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </td>
                                        );
                                      default:
                                        return null;
                                    }
                                  });
                                })()}
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
                                const res = await axios.get(`${API_PATH_C}.get_sales_taxes_templates_so`, { params: { template: val }, withCredentials: true });
                                let rows = (res.data.message || []).map(t => ({
                                  charge_type: t.charge_type,
                                  account_head: t.account_head,
                                  description: t.description || t.account_head || 'VAT',
                                  rate: t.rate,
                                  add_deduct_tax: t.add_deduct_tax || 'Add',
                                  tax_amount: 0,
                                  total: 0
                                }));
                                if (rows.length === 0 && val) {
                                  let rate = 0; let account = "";
                                  if (val.includes("5%")) { rate = 5; account = "VAT 5% - NS"; }
                                  else if (val.includes("Zero")) { rate = 0; account = "VAT Zero - NS"; }
                                  else if (val.includes("Exempted")) { rate = 0; account = "VAT Exempted - NS"; }
                                  else if (val.includes("50%")) { rate = 50; account = "Excise 50% - NS"; }
                                  else if (val.includes("100%")) { rate = 100; account = "Excise 100% - NS"; }
                                  if (account) {
                                    rows = [{ charge_type: "On Net Total", account_head: account, description: account, rate: rate, add_deduct_tax: "Add", tax_amount: 0, total: 0 }];
                                  }
                                }
                                setFormData(prev => recalculate({
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
                <input className="so-input" value={newCustomer.customer_name} onChange={e => setNewCustomer({ ...newCustomer, customer_name: e.target.value })} placeholder="Enter customer name..." />
              </div>
              <div className="so-field">
                <label className="so-label">Mobile Number</label>
                <input className="so-input" value={newCustomer.mobile_no} onChange={e => setNewCustomer({ ...newCustomer, mobile_no: e.target.value })} placeholder="Enter mobile number..." />
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
      {showCamera && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: 0 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: '#e0f2fe', color: '#0284c7', borderRadius: '0.5rem', display: 'flex', alignItems: 'center' }}>
                  <Camera size={20} />
                </div>
                <span style={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.85rem' }}>Sales Order Camera Scanner</span>
              </div>
              <button onClick={() => setShowCamera(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ position: 'relative', aspectRatio: '1.77778', borderRadius: '1rem', overflow: 'hidden', background: '#0f172a' }}>
                <div id="solist-scanner-reader" style={{ width: '100%', height: '100%' }}></div>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowCamera(false)}
                  style={{ padding: '0.6rem 2rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ColumnConfigModal
        isOpen={showColConfig}
        onClose={() => setShowColConfig(false)}
        config={soColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Sales Order"
        themeColor={themeColor}
      />
      <GlobalStyles themeColor={themeColor} themeLight={themeLight} />
    </>
  );
}
