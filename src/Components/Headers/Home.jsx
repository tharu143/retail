import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, LayoutDashboard, ChevronLeft, Settings, Power, Wifi, WifiOff, User as UserIcon,
  Search, Layers, SearchSlash, ChevronRight, X, UserPlus, Loader2, CreditCard, Phone,
  DollarSign, Trash2, Info, Package, Palette, MonitorSmartphone
} from 'lucide-react';
import { logout, toggleTheme } from '../../Redux/Slices/userSlice';
import './Home.css';
import './LegacyPOS.css';
import OpeningEntryPage from '../../Pages/OpeningEntryPage';
import { db } from '../../db';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';
import POSService from '../../utils/posService';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

// QuickStockIn removed - using route /quickstockin

// ---------- Frappe-style rounding Utilities (Outside for stability) ----------
const flt = (num, prec = 6) => {
  const factor = Math.pow(10, prec);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};
const round2 = (num) => flt(num, 2);

const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  
  const trimmedPath = path.trim();

  // 1. IMPROVED: Check for 'data:' anywhere in the first 10 characters
  // This catches cases like "/data:image..." or if there's a hidden char
  if (/^.?data:image/i.test(trimmedPath)) {
    // If it starts with a slash like "/data:image", remove the slash
    return trimmedPath.startsWith('/') ? trimmedPath.substring(1) : trimmedPath;
  }

  // 2. If it's already a full HTTP URL (Barcode API), return as is
  if (trimmedPath.startsWith("http")) {
    return trimmedPath;
  }

  // 3. For relative paths (ERPNext /files/...), add the domain.
  // We ensure there is exactly one slash between domain and path.
  const cleanPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  return `https://retail.kylesolutions.com${cleanPath}`;
};

function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const theme = useSelector((state) => state.user.theme);
  const session = useSelector((state) => state.user.session);
  const company = useSelector((state) => state.user.company);
  const posProfile = useSelector((state) => state.user.posProfile);
  const warehouse = useSelector((state) => state.user.warehouse);
  const branchPrefix = useSelector((state) => state.user.branchPrefix);
  const isManager = useSelector((state) => state.user.is_manager);
  const loading = useSelector((state) => state.user.loading || false);

  const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [sessionOrderCount, setSessionOrderCount] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());


  // New: Legacy Classic Themes
  // Legacy Classic Hook
  const { legacySubTheme, setLegacySubTheme, isGreen, toggleTheme: toggleLegacyColor } = useLegacyTheme();


  const classicStyles = useMemo(() => {
    // Dynamic Legacy Colors for Green / Blue Themes
    const isGreen = legacySubTheme === 'green';

    // Legacy main POS body colors
    const mainColor = isGreen ? '#1a6b52' : '#4a90d9';
    const darkColor = isGreen ? '#0d4a35' : '#0d3050';
    const lightColor = isGreen ? '#c8e8d4' : '#c5d8ed';
    const accentColor = '#e8c84a';
    const borderColor = isGreen ? '#4a9a72' : '#4a7aaa';
    const statusBarColor = isGreen ? '#8ac8a8' : '#8ab4d8';

    // Top nav unified clean to match newly styled buttons and avoid text contrast issues
    const topBarBg = '#ffffff';
    const topBarBorder = '#e2e8f0';

    return `
      .classic-root {
        display: flex; flex-direction: column; height: 100vh; max-height: 100vh;
        background: ${mainColor}; color: ${isGreen ? '#0a2e1e' : '#0a1a30'};
        font-family: 'Share Tech Mono', 'Courier New', monospace;
        overflow: hidden;
      }
      .classic-titlebar {
        background: ${topBarBg}; color: ${statusBarColor};
        padding: 4px 12px; display: flex;
        align-items: center; justify-content: space-between;
        border-bottom: 1px solid ${topBarBorder}; font-size: 12px; flex-shrink: 0;
      }
      .classic-nav {
        background: ${topBarBg}; border-bottom: 1px solid ${topBarBorder};
        height: 48px; display: flex; align-items: center;
        justify-content: space-between; padding: 0 14px;
        flex-shrink: 0; position: relative; z-index: 100;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      .classic-header-form {
        background: ${topBarBg}; padding: 8px 16px;
        border-bottom: 2px solid ${borderColor};
        display: flex; flex-wrap: nowrap; gap: 20px; align-items: center;
        flex-shrink: 0; position: relative; z-index: 110;
      }
      .classic-field label { color: ${statusBarColor}; font-size: 10px; white-space: nowrap; font-weight: 900; letter-spacing: 0.5px; }
      .classic-field input, .classic-field select {
        background: #ffffff; border: 1px solid ${topBarBorder}; border-radius: 4px;
        padding: 5px 8px; font-size: 12px;
        font-family: inherit; color: #000; outline: none;
      }
      .classic-entry-area { flex: 1; display: flex; flex-direction: column; background: ${lightColor}; position: relative; }
      .classic-entry-header {
        background: ${mainColor}; padding: 4px 10px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid ${borderColor}; flex-shrink: 0; gap: 10px;
      }
      table.classic-table {
        width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;
      }
      table.classic-table thead tr {
        background: ${darkColor}; color: ${accentColor};
        position: sticky; top: 0; z-index: 5;
      }
      table.classic-table thead th {
        padding: 5px 5px; text-align: left; font-weight: bold;
        border-right: 1px solid ${borderColor};
      }
      table.classic-table tbody td {
        padding: 0; border-right: 1px solid ${isGreen ? '#b0d8c0' : '#a8c4e0'};
        height: 32px; vertical-align: middle;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .classic-cell-text {
        padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        display: block; width: 100%;
      }
      .classic-bottom-bar {
        background: ${darkColor}; border-top: 2px solid ${borderColor};
        display: flex; align-items: center; justify-content: flex-end; padding: 4px 10px; flex-shrink: 0;
      }
      .classic-action-bar {
        background: ${isGreen ? '#156047' : '#154070'}; padding: 5px 10px;
        display: flex; align-items: center; justify-content: center;
        border-top: 2px solid ${borderColor}; gap: 8px; flex-shrink: 0;
      }
      .classic-statusbar {
        background: ${darkColor}; color: ${statusBarColor}; font-size: 10px;
        padding: 2px 10px; display: flex; gap: 20px;
        border-top: 1px solid ${borderColor}; flex-shrink: 0;
      }
      .classic-btn {
        padding: 4px 16px; font-size: 11px; font-family: inherit;
        font-weight: bold; cursor: pointer; border: 2px outset;
        text-transform: uppercase; letter-spacing: 0.5px;
      }
      .classic-btn.gold { background: ${accentColor}; color: ${darkColor}; border-color: #f8e070 #907820 #907820 #f8e070; }
      
      /* New Discount Toggle Styles */
      .home-discount-toggle {
        display: flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 12px;
        margin-bottom: 20px;
        border: 2px solid #e2e8f0;
      }
      .home-discount-type-btn {
        flex: 1;
        padding: 10px;
        border: none;
        background: transparent;
        font-family: inherit;
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        color: #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .home-discount-type-btn.active {
        background: #ffffff;
        color: #2563eb;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      .home-discount-type-btn:hover:not(.active) {
        background: rgba(0,0,0,0.05);
      }
    `;
  }, [legacySubTheme]);

  // Connectivity monitoring
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


  // Sync & Order Count effect
  useEffect(() => {
    const updateStats = async () => {
      // 1. Pending sync count
      const unsynced = await db.invoices.where('is_synced').equals(0).count();
      setPendingSyncCount(unsynced);

      // 2. Sequential Order Number for current Opening Entry
      if (posOpeningEntry) {
        const shiftCount = await db.invoices
          .where('pos_opening_entry')
          .equals(posOpeningEntry)
          .count();
        // The NEXT order is current count + 1
        setSessionOrderCount(shiftCount + 1);
      } else {
        setSessionOrderCount(1);
      }
    };
    updateStats();
    const interval = setInterval(updateStats, 10000);
    return () => clearInterval(interval);
  }, [posOpeningEntry]);



  // NEW: Barcode scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [searchContext, setSearchContext] = useState('header'); // 'header' or 'inline'
  const itemDropdownRef = useRef(null);

  // Speed Checkout
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const mobileInputRef = useRef(null);
  const inlineInputRef = useRef(null);
  const [lastInteractedItem, setLastInteractedItem] = useState(null);

  // ---------- Auth ----------
  useEffect(() => {
    if (!user || !session) {
      navigate('/');
      return;
    }
    if (!posOpeningEntry && !isManager) setShowOpeningModal(true);
  }, [user, session, posOpeningEntry, isManager, navigate]);

  const handleOpeningSuccess = (entryId) => {
    localStorage.setItem('posOpeningEntry', entryId);
    setPosOpeningEntry(entryId);
    setShowOpeningModal(false);
    Swal.fire({
      icon: 'success',
      title: 'Shift Opened',
      text: 'Your shift has been opened successfully!',
      timer: 2000,
      showConfirmButton: false,
      background: '#fff',
      color: '#1e293b'
    });
  };

  // ---------- Auth Fetch ----------
  const authFetch = useCallback(async (url, options = {}) => {
    if (isOffline && options.method && options.method !== 'GET') {
      throw new Error("You are currently offline. This action will be queued for sync.");
    }

    const fullUrl = url.startsWith('http') ? url : `/api/method/${url.startsWith('/') ? url.slice(1) : url}`;
    const headers = {
      ...options.headers,
      "Accept": "application/json",
    };

    const config = { ...options, headers, credentials: 'include' };

    try {
      const response = await fetch(fullUrl, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      if (err.name === 'TypeError' && !navigator.onLine) {
        setIsOffline(true);
        throw new Error("Network connection lost. Saved to offline storage.");
      }
      throw err;
    }
  }, [isOffline]);


  // ---------- States ----------
  const [Items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState(["all"]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [billItems, setBillItems] = useState([]);
  const [customerName, setCustomerName] = useState('Cash');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '', address: '', email: '' });

  // Tax
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [selectedTaxTemplate, setSelectedTaxTemplate] = useState('');

  // Discount
  const [discount, setDiscount] = useState({ type: 'amount', value: 0 });
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  // Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payments, setPayments] = useState([]); // Array of { mode_of_payment, amount }

  const dropdownRef = useRef(null);
  const nameInputRef = useRef(null);

  // ---------- CALCULATIONS (Defined before handlers) ----------
  const subtotal = useMemo(() =>
    billItems.reduce((sum, item) => {
      const itemPrice = item.uom === 'Box' ? item.price * (item.custom_pieces_per_box || 1) : item.price;
      return sum + flt(itemPrice * (parseFloat(item.qty) || 0));
    }, 0)
    , [billItems]);

  const discountAmount = useMemo(() => {
    if (discount.value <= 0) return 0;
    const amt = (discount.type === 'percentage' || discount.type === 'percent')
      ? (subtotal * discount.value) / 100
      : discount.value;
    return flt(amt);
  }, [subtotal, discount]);

  const netTotal = useMemo(() => flt(subtotal - discountAmount), [subtotal, discountAmount]);

  const taxRate = useMemo(() => {
    // 1. GLOBAL FALLBACK: If company is KSPL, we default to 5% if API fails
    if (taxTemplates.length === 0) return 5.0;

    // 2. Try to find the selected template
    let targetTemplate = selectedTaxTemplate;
    if (!targetTemplate && taxTemplates.length > 0) {
      const defaultT = taxTemplates.find(t => t.name.includes("VAT 5% - KSPL")) ||
        taxTemplates.find(t => t.name.includes("5%")) ||
        taxTemplates[0];
      targetTemplate = defaultT.name;
    }

    // 3. Last resort fallback
    if (!targetTemplate) return 5.0;

    const tmpl = taxTemplates.find(t => t.name === targetTemplate);

    // 4. Deep search for rate
    let rate = tmpl?.sales_tax?.[0]?.rate ??
      tmpl?.taxes?.[0]?.rate ??
      tmpl?.taxes?.[0]?.tax_rate ??
      tmpl?.rate ??
      0;

    // 5. Intelligent Name Match Fallback
    if (rate === 0 && targetTemplate.includes('5%')) {
      rate = 5.0;
    }

    // Default to 5.0 if still 0 but we have a template selected (likely 5% template)
    return flt(rate || 5.0);
  }, [selectedTaxTemplate, taxTemplates]);

  const taxAmount = useMemo(() => flt(netTotal * (taxRate / 100)), [netTotal, taxRate]);

  const grandTotal = useMemo(() => round2(netTotal + taxAmount), [netTotal, taxAmount]);

  const displaySubtotal = round2(subtotal);
  const displayDiscount = round2(discountAmount);
  const displayTaxable = round2(netTotal);
  const displayTax = round2(taxAmount);

  // ---------- PAYMENT HANDLERS & MEMOS ----------
  const totalPaid = useMemo(() => round2(payments.reduce((sum, p) => sum + p.amount, 0)), [payments]);
  const balanceRemaining = useMemo(() => round2(grandTotal - totalPaid), [grandTotal, totalPaid]);

  const addPayment = () => {
    if (!selectedPaymentMode || tenderedAmount <= 0) return;
    const newPayment = {
      mode_of_payment: selectedPaymentMode,
      amount: round2(tenderedAmount)
    };
    setPayments([...payments, newPayment]);
    setSelectedPaymentMode('');
    setTenderedAmount(0);
  };

  const removePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index));
  };


  // Purchase Tools (Manager Only)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    item_code: '',
    supplier: '',
    purchase_rate: 0,
    price_type: 'Percentage', // Amount / Percentage
    margin_percent: 15,
    target_price: 0
  });

  // ---------- Update tendered amount for selected payment mode ----------
  useEffect(() => {
    if (selectedPaymentMode) {
      const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = grandTotal - paidSoFar;
      setTenderedAmount(round2(remaining > 0 ? remaining : 0));
    }
  }, [grandTotal, selectedPaymentMode, payments]);

  // ---------- TAX FETCH (with offline cache) ----------
  useEffect(() => {
    const fetchTaxTemplates = async () => {
      try {
        const res = await POSService.getSalesTaxes({ company: company });
        // Filter templates to only include those matching the current company
        const templates = (res || []).filter(t => !t.company || t.company === company);
        setTaxTemplates(templates);
        if (templates.length) {
          // Default to the requested template: VAT 5% - KSPL
          const defaultTax = templates.find(t => t.name.includes("VAT 5% - KSPL")) ||
            templates.find(t => t.name.includes("UAE VAT 5%")) ||
            templates[0];
          setSelectedTaxTemplate(defaultTax.name);
        }

        // Cache to Dexie for offline use
        await db.tax_templates.clear();
        for (const t of templates) {
          await db.tax_templates.put(t);
        }
      } catch (err) {
        console.error('Tax fetch failed, trying local cache:', err);
        // Fallback to cached tax templates
        try {
          const cached = await db.tax_templates.toArray();
          if (cached.length) {
            setTaxTemplates(cached);
            const defaultTax = cached.find(t => t.name.includes("VAT 5% - KSPL")) ||
              cached.find(t => t.name.includes("UAE VAT 5%")) ||
              cached[0];
            setSelectedTaxTemplate(defaultTax.name);
          }
        } catch (e) { console.error('Local tax cache also failed:', e); }
      }
    };
    fetchTaxTemplates();
  }, [authFetch, company]);

  // ---------- CUSTOMER SEARCH (with offline fallback) ----------
  useEffect(() => {
    const timer = setTimeout(async () => {
      const searchTerm = (customerMobile || customerName).trim();
      if (searchTerm.length < 1 || searchTerm === 'Cash') {
        setSearchResults([]); return;
      }

      // Determine search type based on input pattern
      let searchType = 'all';
      const isNumeric = /^\d+$/.test(searchTerm);

      // Only force 'mobile' if it's purely numeric and long enough
      // If it has letters (like POS-...) it stays as 'all' or 'name'
      if (isNumeric && searchTerm.length >= 7) {
        searchType = 'mobile';
      } else if (!isNumeric && !/.*\d.*/.test(searchTerm)) {
        // purely text
        searchType = 'name';
      }

      setSearchLoading(true);
      try {
        if (isOffline) {
          // Search local Dexie customer cache respecting searchType
          const allCustomers = await db.customers.toArray();
          const query = searchTerm.toLowerCase();
          const filtered = allCustomers.filter(c => {
            if (searchType === 'mobile') {
              return (c.mobile_no || '').includes(query);
            } else if (searchType === 'name') {
              return (c.customer_name || '').toLowerCase().includes(query) ||
                (c.name || '').toLowerCase().includes(query);
            } else {
              return (c.customer_name || '').toLowerCase().includes(query) ||
                (c.name || '').toLowerCase().includes(query) ||
                (c.mobile_no || '').includes(query);
            }
          });
          setSearchResults(filtered);
        } else {
          // Call updated API with search_type
          const results = await frappeCall({
            method: 'kyle_retail.retail_api.api.get_customers',
            args: {
              search: searchTerm,
              search_type: searchType
            }
          });
          setSearchResults(results || []);

          // Cache customers to Dexie for offline use
          for (const cust of (results || [])) {
            await db.customers.put(cust);
          }
        }
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); setShowDropdown(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, customerMobile, isOffline]);

  // Click outside dropdowns
  useEffect(() => {
    const handler = (e) => {
      // Customer dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !nameInputRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
      // Item search results dropdown
      if (itemDropdownRef.current &&
        !itemDropdownRef.current.contains(e.target) &&
        !barcodeInputRef.current?.contains(e.target) &&
        !inlineInputRef.current?.contains(e.target)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // NEW: Item search logic for barcode input
  useEffect(() => {
    const query = barcodeInput.trim().toLowerCase();
    if (query.length === 0 && (searchContext === 'inline' || searchContext === 'header')) {
      // ALWAYS prepare top 10 results so they are ready the moment the dropdown opens
      setItemSearchResults(Items.slice(0, 10));
      setActiveItemIndex(-1);
    } else if (query.length >= 1) {
      const results = Items.filter(it => {
        const n = (it.name || "").toLowerCase();
        const i = (it.id || "").toLowerCase();
        const b = (it.barcodes || []).some(bc => (bc.barcode || "").toLowerCase().includes(query));
        return n.includes(query) || i.includes(query) || b;
      }).sort((a, b) => {
        // Sort matches starting with the query first for better results
        const aStart = (a.name || "").toLowerCase().startsWith(query);
        const bStart = (b.name || "").toLowerCase().startsWith(query);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return 0;
      }).slice(0, 15);
      setItemSearchResults(results);
      setShowItemDropdown(results.length > 0);
    } else {
      setItemSearchResults([]);
      setShowItemDropdown(false);
      setActiveItemIndex(-1);
    }
  }, [barcodeInput, Items, searchContext]); // removed showItemDropdown from deps to stay ready

  // ---------- CUSTOMER HANDLERS ----------
  const openCreate = () => {
    setCreateForm({ name: customerName.trim(), phone: phoneNumber, address: '', email: '' });
    setShowCreateModal(true); setShowDropdown(false);
  };

  const pickCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.customer_name);
    setPhoneNumber(cust.mobile_no || '');
    setCustomerMobile(''); // Clear mobile search
    setShowDropdown(false);
    barcodeInputRef.current?.focus();
  };

  const createCustomer = async () => {
    if (!createForm.name.trim()) {
      alert("Customer name is required!");
      return;
    }

    setCreatingCustomer(true);  // ← Loading starts

    try {
      const formData = new FormData();
      formData.append("customer_name", createForm.name.trim());
      if (createForm.phone) formData.append("phone", createForm.phone);
      if (createForm.address) formData.append("address", createForm.address);
      if (createForm.email) formData.append("email", createForm.email);

      const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.create_customer', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      const inner = result.message || result;

      if (inner.status === "success" || inner.name) {
        Swal.fire({
          icon: 'success',
          title: 'Customer Created',
          text: `"${createForm.name}" has been saved to ERPNext.`,
          timer: 2000,
          showConfirmButton: false
        });
        const newCust = {
          name: inner.customer_id || inner.name,
          customer_name: createForm.name.trim(),
          mobile_no: createForm.phone || "",
          primary_address: createForm.address || "",
          email_id: createForm.email || "",
          is_synced: 1
        };
        await db.customers.put(newCust); // Keep local searchable copy
        pickCustomer(newCust);
        setShowCreateModal(false);
        setCreateForm({ name: '', phone: '', address: '', email: '' });
      } else {
        Swal.fire('Error', inner.message || "Failed to create customer", 'error');
      }
    } catch (err) {
      console.error(err);
      if (isOffline) {
        // Save to local cache for offline usage
        const offlineCustomer = {
          name: `OFFLINE-CUST-${Date.now()}`,
          customer_name: createForm.name.trim(),
          mobile_no: createForm.phone || "",
          primary_address: createForm.address || "",
          email_id: createForm.email || "",
          is_synced: 0,
          is_offline: true
        };
        await db.customers.put(offlineCustomer);
        pickCustomer(offlineCustomer);
        setShowCreateModal(false);
        Swal.fire('Offline Save', 'Customer saved locally. Will sync when online.', 'info');
      } else {
        Swal.fire('Error', "Network error while creating customer", 'error');
      }
    } finally {
      setCreatingCustomer(false);  // ← Loading ends (always!)
    }
  };
  // ---------- FETCH ALL ITEMS ----------


  const fetchCategories = useCallback(async () => {
    try {
      if (!session) return;
      const isActuallyOnline = navigator.onLine;
      if (isActuallyOnline) {
        const results = await POSService.getItemCategories();
        if (results && results.length > 0) {
          const catNames = results.map(c =>
            (typeof c === 'string' ? c : (c.name || c.item_group_name || c.item_group)).toLowerCase()
          );
          // Combine with "all" and remove duplicates just in case
          const uniqueCats = ["all", ...new Set(catNames.sort())];
          setCategories(uniqueCats);

          // Cache to Dexie for offline use
          await db.payment_modes.put({ name: 'categories', data: uniqueCats }); // reusing payment_modes or create new store
        }
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, [session]);

  const fetchItems = useCallback(async (force = false) => {
    if (!session) return;
    try {
      setLoadingItems(true); setError("");

      const rawLastSync = localStorage.getItem('last_item_sync_time') || "";
      const storedLastSync = (rawLastSync === "undefined" || rawLastSync === "null") ? "" : rawLastSync;

      let url = `kyle_retail.retail_api.api.get_item_details?warehouse=${encodeURIComponent(warehouse)}`;

      if (storedLastSync && !force) {
        const d = new Date(storedLastSync);
        if (d instanceof Date && !isNaN(d.getTime())) {
          const formattedDate = format(d, 'yyyy-MM-dd HH:mm:ss');
          url += `&modified_after=${encodeURIComponent(formattedDate)}`;
        }
      }

      let apiItems = [];
      const isActuallyOnline = navigator.onLine;

      if (isActuallyOnline) {
        try {
          const results = await POSService.getRetailItems({
            warehouse: warehouse,
            modified_after: (!force && storedLastSync) ? (() => {
              const d = new Date(storedLastSync);
              return (d instanceof Date && !isNaN(d.getTime())) ? format(d, 'yyyy-MM-dd HH:mm:ss') : undefined;
            })() : undefined
          });

          // DEBUG: Log first 2 images to check raw format
          if (results && results.length > 0) {
            console.log("RAW IMAGE DATA:", results.slice(0, 2).map(i => ({ name: i.item_name, image_sample: i.image?.substring(0, 50) })));
          }

          if (force || results?.length > 0) {
            if (force) await db.items.clear();

            // Recalibrate local_qty: server_actual_qty - pending_sales
            const pendingInvoices = await db.invoices.where('is_synced').equals(0).toArray();
            const pendingSales = {};
            pendingInvoices.forEach(inv => {
              (inv.items || []).forEach(it => {
                const code = it.item_code || it.id;
                const qtyPieces = it.uom === 'Box' ? (it.quantity || it.qty || 0) * (it.custom_pieces_per_box || 1) : (it.quantity || it.qty || 0);
                pendingSales[code] = (pendingSales[code] || 0) + qtyPieces;
              });
            });

            await db.items.bulkPut(results.map(item => {
              const serverQty = item.actual_qty || 0;
              const pendingQty = pendingSales[item.name] || 0;

              // Recalibrate warehouse_details: server_actual_qty - pending_sales (for current warehouse)
              const recalibratedWarehouseDetails = (item.warehouse_details || []).map(wd => {
                const name = wd.warehouse_name || wd.warehouse;
                if (name === warehouse) {
                  return { ...wd, actual_qty: (wd.actual_qty || 0) - pendingQty };
                }
                return wd;
              });

              return {
                id: item.name,
                name: item.item_name,
                image: item.image,
                group: (item.item_group || "others").toLowerCase(),
                price: item.price_list_rate || 0,
                actual_qty: serverQty,
                local_qty: serverQty - pendingQty,
                total_qty: (item.total_qty || serverQty) - pendingQty,
                warehouse_details: recalibratedWarehouseDetails,
                barcodes: item.barcodes || [],
                modified: item.modified,
                custom_pieces_per_box: item.custom_pieces_per_box || 1
              };
            }));

            const newestTimeFromItems = results.reduce((max, item) => {
              if (!item.modified) return max;
              if (!max) return item.modified;
              return item.modified > max ? item.modified : max;
            }, storedLastSync);

            const finalSyncTime = newestTimeFromItems || new Date().toISOString();
            localStorage.setItem('last_item_sync_time', finalSyncTime);
            apiItems = await db.items.toArray();
          } else {
            apiItems = await db.items.toArray();
          }
        } catch (fetchErr) {
          console.error("Strict Online fetch failed:", fetchErr);
          setError(`Server Connection (HTTP 500). Using local cache.`);
          apiItems = await db.items.toArray();
        }
      } else {
        // Strictly Offline - load what we have in cache
        apiItems = await db.items.toArray();
        if (apiItems.length === 0) {
          setError("You are currently OFFLINE and no local item cache was found. Please connect to internet to sync items.");
        }
      }

      const baseUrl = window.location.protocol === 'file:' ? 'https://retail.kylesolutions.com' : '';
      const transformed = apiItems.map(item => {
        const hasImage = item.image && item.image.trim() !== "";
        let finalImage = null;
        if (hasImage) {
          if (item.image.startsWith('http')) {
            finalImage = item.image;
          } else {
            // Ensure leading slash for relative paths
            const imagePath = item.image.startsWith('/') ? item.image : `/${item.image}`;
            finalImage = `${baseUrl}${imagePath}`;
          }
        }
        return {
          id: item.id || item.name,
          name: item.item_name || item.name,
          image: finalImage,
          group: (item.group || item.item_group || "others").toLowerCase(),
          price: item.price || item.price_list_rate || 0,
          actual_qty: item.actual_qty || 0,
          local_qty: item.local_qty !== undefined ? item.local_qty : (item.actual_qty || 0),
          total_qty: item.total_qty || item.actual_qty || 0,
          warehouse_details: item.warehouse_details || [],
          barcodes: item.barcodes || [],
          custom_pieces_per_box: item.custom_pieces_per_box || 1
        };
      });


      // Only derive categories from items if we haven't fetched them from API yet or if offline
      if (categories.length <= 1) {
        const groups = [...new Set(transformed.map(i => i.group))];
        setCategories(["all", ...groups.sort()]);
      }

      setItems(transformed);
      setFilteredItems(transformed);
    } catch (err) {
      setError(err.message || "Failed to load items. Please check connection.");
    } finally {
      setLoadingItems(false);
    }
  }, [authFetch, session, warehouse]);

  const forceFullRefresh = useCallback(async () => {
    try {
      setLoadingItems(true);
      // Force clear cache
      await db.items.clear();
      await db.customers.clear();
      await db.tax_templates.clear();

      // Re-fetch everything
      await fetchItems(true);

      Swal.fire({
        icon: 'success',
        title: 'Database Synchronized',
        text: 'Local cache cleared and updated with the latest 61 items from server.',
        timer: 3000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Sync Error', 'Failed to force refresh items. Local data preserved.', 'error');
    } finally {
      setLoadingItems(false);
    }
  }, [fetchItems]);

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, [fetchCategories, fetchItems]);

  // ---------- PERIODIC 5-MINUTE REFRESH ----------
  useEffect(() => {
    if (isOffline) return;
    const interval = setInterval(() => {
      console.log("5-Minute Periodic Sync: Refreshing item cache...");
      fetchItems();
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [isOffline, fetchItems]);




  // Filter items
  useEffect(() => {
    let filtered = selectedCategory === "all"
      ? Items
      : Items.filter(i => i.group === selectedCategory.toLowerCase());

    if (barcodeInput.trim()) {
      const term = barcodeInput.toLowerCase().trim();
      filtered = filtered.filter(i =>
        (i.name || "").toLowerCase().includes(term) ||
        (i.id || "").toLowerCase().includes(term) ||
        (i.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(term))
      );
    }
    setFilteredItems(filtered);
  }, [selectedCategory, Items, barcodeInput]);

  // ---------- BARCODE SCANNER HANDLER ----------
  const handleBarcodeScan = useCallback(async (barcode) => {
    if (!barcode.trim()) return;

    try {
      setSearchLoading(true);
      const apiItem = await POSService.getItemByBarcode(barcode.trim());

      if (apiItem && apiItem.item_code && apiItem.status !== 'error') {
        const pendingInvoices = await db.invoices.where('is_synced').equals(0).toArray();
        let pendingQty = 0;
        pendingInvoices.forEach(inv => {
          (inv.items || []).forEach(it => {
            if (it.item_code === apiItem.item_code) {
              const qtyPieces = it.uom === 'Box' ? it.qty * (it.custom_pieces_per_box || 1) : it.qty;
              pendingQty += qtyPieces;
            }
          });
        });

        const itemToBill = {
          id: apiItem.item_code,
          name: apiItem.item_name,
          price: apiItem.price_list_rate || apiItem.rate || 0,
          actual_qty: apiItem.actual_qty || 0,
          local_qty: (apiItem.actual_qty || 0) - pendingQty,
          warehouse_details: apiItem.warehouse_details || [],
          custom_pieces_per_box: apiItem.custom_pieces_per_box || 1,
          barcodes: apiItem.barcodes || []
        };

        if (itemToBill.local_qty <= 0) {
          try {
            Swal.fire({ title: 'Checking Nearby Stock...', didOpen: () => Swal.showLoading() });
            const nearest = await frappeCall({
              method: 'kyle_retail.retail_api.api.find_nearest_stock',
              args: { item_code: itemToBill.id, current_warehouse: warehouse }
            });
            itemToBill.warehouse_details = nearest || [];
            showStockBreakdown(itemToBill);
          } catch (err) {
            Swal.fire('Out of Stock', `"${itemToBill.name}" is out of stock. Nearby check failed: ${err.message || err}`, 'warning');
          }
          setBarcodeInput('');
          barcodeInputRef.current?.focus();
          return;
        }

        handleAddToBill(itemToBill);
        setBarcodeInput('');
        barcodeInputRef.current?.focus();

        // Green flash
        if (barcodeInputRef.current) {
          barcodeInputRef.current.style.backgroundColor = '#d1fae5';
          setTimeout(() => {
            if (barcodeInputRef.current) barcodeInputRef.current.style.backgroundColor = '';
          }, 200);
        }
      } else {
        const query = barcode.trim().toLowerCase();
        const foundLocal = Items.find(item =>
          item.barcodes?.some(b => b.barcode.trim() === barcode.trim()) ||
          item.id.toLowerCase() === query ||
          item.name.toLowerCase().includes(query)
        );

        if (foundLocal) {
          handleAddToBill(foundLocal);
          setBarcodeInput('');
        } else {
          Swal.fire('Not Found', apiItem?.message || 'Item not found in database.', 'error');
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '#fee2e2';
            setTimeout(() => {
              if (barcodeInputRef.current) barcodeInputRef.current.style.backgroundColor = '';
            }, 400);
          }
        }
      }
    } catch (err) {
      console.warn("Barcode search error:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [Items, warehouse, authFetch]);

  const onBarcodeKeyDown = (e) => {
    // Standardize navigation: Arrows ONLY for the dropdown, as requested.
    if (e.key === 'ArrowDown' && showItemDropdown) {
      e.preventDefault();
      setActiveItemIndex(prev => Math.min(prev + 1, itemSearchResults.length - 1));
    } else if (e.key === 'ArrowUp' && showItemDropdown) {
      e.preventDefault();
      setActiveItemIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || (e.key === 'Tab' && showItemDropdown && activeItemIndex >= 0)) {
      // If we have a selected item (via arrows) OR it's Enter, handle the selection
      if (activeItemIndex >= 0 && itemSearchResults[activeItemIndex]) {
        e.preventDefault();
        const selected = itemSearchResults[activeItemIndex];
        handleAddToBill(selected);
        setBarcodeInput('');
        setShowItemDropdown(false);
        setActiveItemIndex(-1);

        // Standard flow: Focus the QUANTITY field of the item just added for rapid adjustment
        setTimeout(() => {
          const newIdx = billItems.length; // The index of the item that will be added (after state update)
          const qtyInput = document.getElementById(`qty-input-${newIdx}`);
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
          } else if (theme === 'legacy') {
            const targetId = searchContext === 'header' ? 'legacy-header-search' : 'legacy-inline-search';
            document.getElementById(targetId)?.focus();
          } else {
            barcodeInputRef.current?.focus();
          }
        }, 50);
      } else if (e.key === 'Enter' && itemSearchResults.length > 0) {
        // Fallback: If no arrow selection but Enter is pressed with results, take the first one
        e.preventDefault();
        const first = itemSearchResults[0];
        handleAddToBill(first);
        setBarcodeInput('');
        setShowItemDropdown(false);
        setActiveItemIndex(-1);

        setTimeout(() => {
          const newIdx = billItems.length;
          document.getElementById(`qty-input-${newIdx}`)?.focus();
        }, 50);
      } else if (e.key === 'Enter' && barcodeInput.trim()) {
        // No local matches, try full barcode scan (API)
        e.preventDefault();
        handleBarcodeScan(barcodeInput);
      }
    } else if (e.key === 'Escape') {
      setShowItemDropdown(false);
      setActiveItemIndex(-1);
    }
  };

  // ---------- AUTO SCROLL FOR SEARCH DROPDOWN ----------
  useEffect(() => {
    if (activeItemIndex >= 0 && showItemDropdown) {
      setTimeout(() => {
        const activeItem = document.querySelector('.active-dropdown-item');
        if (activeItem) {
          activeItem.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
          });
        }
      }, 10);
    }
  }, [activeItemIndex, showItemDropdown]);

  // NEW: Request Stock from other warehouses
  const handleRequestStock = async (item) => {
    const { value: quantity } = await Swal.fire({
      title: 'Request Stock',
      text: `Enter quantity of "${item.name}" you need for ${warehouse}`,
      input: 'number',
      inputLabel: 'Quantity',
      inputValue: 1,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || parseInt(value) <= 0) {
          return 'Please enter a valid quantity'
        }
      }
    });

    if (quantity) {
      try {
        Swal.showLoading();
        const res = await frappeCall({
          method: 'kyle_retail.retail_api.api.create_draft_material_request',
          args: {
            item_code: item.id,
            qty: parseInt(quantity), // Renamed from quantity
            to_branch: warehouse
          }
        });

        if (res && (res.name || res.status === 'success')) {
          Swal.fire('Success', 'Stock Request created successfully!', 'success');
        } else {
          throw new Error('Failed to generate request');
        }
      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const showStockBreakdown = (item) => {
    const details = item.warehouse_details || [];
    if (details.length === 0) {
      Swal.fire('No Data', 'No branch breakdown available.', 'info');
      return;
    }

    const html = `
        <div style="text-align: left; padding: 10px; max-height: 400px; overflow-y: auto;">
             <div style="display: flex; justify-content: space-between; font-weight: 800; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px;">
                <span>Branch</span>
                <span>Stock / Action</span>
            </div>
            ${details.map(d => {
      const qty = parseFloat(d.actual_qty ?? d.qty ?? d.stock_qty ?? 0) || 0;
      const branchName = d.warehouse_name || d.warehouse;
      return `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 12px 0;">
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-weight: 600;">${branchName}</span>
                      ${d.distance ? `<span style="font-size: 10px; color: #64748b;">${d.distance} KM away</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span style="font-weight: 700; color: ${qty > 0 ? '#10b981' : '#ef4444'}">${qty}</span>
                      ${(qty > 0 && branchName !== warehouse) ? `
                        <button 
                          onclick="window.requestStock('${item.id}', '${branchName}')"
                          style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;"
                        >Request</button>
                      ` : ''}
                    </div>
                </div>
              `;
    }).join('')}
        </div>
    `;

    // Expose requestStock to window for the onclick handler
    window.requestStock = async (itemCode, fromWarehouse) => {
      try {
        Swal.fire({
          title: 'Requesting Stock...',
          text: `Requesting "${item.name}" from ${fromWarehouse}`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });

        await frappeCall({
          method: 'kyle_retail.retail_api.api.create_draft_material_request',
          args: {
            item_code: itemCode,
            from_branch: fromWarehouse, // Renamed from from_warehouse
            to_branch: warehouse,       // Renamed from to_warehouse
            qty: 1                      // Renamed from quantity
          }
        });

        Swal.fire('Success', `Stock request draft created for ${fromWarehouse}.`, 'success');
      } catch (err) {
        Swal.fire('Failure', `Could not create material request: ${err.message || err}`, 'error');
      }
    };

    Swal.fire({
      title: `Stock Breakdown: ${item.name}`,
      html: html,
      confirmButtonText: 'Close',
      confirmButtonColor: '#3b82f6',
      width: '600px'
    });
  };

  // ---------- ITEM HANDLERS ----------
  const handleFilter = (cat) => setSelectedCategory(cat);
  const handleAddToBill = (item) => {
    setLastInteractedItem(item);
    setBillItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        // Check pieces vs boxes
        const piecesNeeded = existing.uom === 'Box' ? (existing.custom_pieces_per_box || 1) : 1;
        const currentPieces = existing.uom === 'Box' ? (existing.qty * (existing.custom_pieces_per_box || 1)) : existing.qty;

        if (currentPieces + piecesNeeded > item.local_qty) {
          Swal.fire('Out of Stock', `Only ${item.local_qty} pieces available.`, 'warning');
          return prev;
        }
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      } else {
        if (item.local_qty <= 0) {
          Swal.fire('Out of Stock', `"${item.name}" is out of stock.`, 'warning');
          return prev;
        }
        return [...prev, { ...item, qty: 1, uom: 'Piece' }];
      }
    });
    barcodeInputRef.current?.focus();
  };

  const toggleUom = (id, newUom) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        // Validation: If switching to Box, ensure stock exists
        if (newUom === 'Box') {
          const factor = item.custom_pieces_per_box || 1;
          if (item.qty * factor > item.local_qty) {
            Swal.fire('Out of Stock', `Insufficient stock to switch to Box.`, 'warning');
            return item;
          }
        }
        return { ...item, uom: newUom };
      }
      return item;
    }));
  };
  const removeFromBill = (id) => setBillItems(prev => prev.filter(i => i.id !== id));

  const openPurchaseTools = (item) => {
    setPurchaseForm({
      item_code: item.id || item.item_code,
      supplier: '',
      purchase_rate: 0,
      selling_update_type: 'Percentage',
      markup: 15,
      target_price: round2((item.price || 0) * 1.15)
    });
    setShowPurchaseModal(true);
  };

  const updatePurchasePrice = (field, val) => {
    setPurchaseForm(prev => {
      const next = { ...prev, [field]: val };
      if (next.price_type === 'Percentage') {
        const rate = parseFloat(next.purchase_rate) || 0;
        const margin_percent = parseFloat(next.margin_percent) || 0;
        next.target_price = round2(rate * (1 + (margin_percent / 100)));
      }
      return next;
    });
  };

  const handlePurchaseSubmit = async () => {
    try {
      if (!purchaseForm.supplier) return Swal.fire('Error', 'Please select a supplier', 'error');

      Swal.fire({ title: 'Submitting Purchase...', didOpen: () => Swal.showLoading() });
      await frappeCall({
        method: 'kyle_retail.retail_api.api.submit_purchase_entry',
        args: {
          item_code: purchaseForm.item_code,
          supplier: purchaseForm.supplier,
          purchase_rate: purchaseForm.purchase_rate,
          price_type: purchaseForm.price_type,
          margin_percent: purchaseForm.margin_percent,
          target_price: purchaseForm.target_price,
          warehouse: warehouse
        }
      });
      setShowPurchaseModal(false);
      Swal.fire('Success', 'Purchase entry created and selling price updated.', 'success');
      fetchItems(true);
    } catch (err) {
      Swal.fire('Error', err.message || err, 'error');
    }
  };

  const updateQuantity = (id, delta) => {
    setBillItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, (i.qty || 0) + delta);
        if (delta > 0) {
          const piecesNeeded = i.uom === 'Box' ? newQty * (i.custom_pieces_per_box || 1) : newQty;
          if (piecesNeeded > (i.local_qty || 0)) {
            Swal.fire('Out of Stock', `Insufficient stock.`, 'warning');
            return i;
          }
        }
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const setQuantity = (id, val) => {
    const newQty = parseInt(val);
    if (isNaN(newQty)) {
      setBillItems(prev => prev.map(i => i.id === id ? { ...i, qty: "" } : i));
      return;
    }

    setBillItems(prev => prev.map(i => {
      if (i.id === id) {
        const finalQty = Math.max(1, newQty);
        const piecesNeeded = i.uom === 'Box' ? finalQty * (i.custom_pieces_per_box || 1) : finalQty;
        if (piecesNeeded > (i.local_qty || 0)) {
          Swal.fire('Out of Stock', `Insufficient stock for ${finalQty} units.`, 'warning');
          return i;
        }
        return { ...i, qty: finalQty };
      }
      return i;
    }));
  };

  // Category Scrolling Ref (Required for Modern UI)
  const categoryScrollRef = useRef(null);

  const handlePrevSlide = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: -240, behavior: "smooth" });
    }
  };
  const handleNextSlide = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: 240, behavior: "smooth" });
    }
  };

  // Discount
  const applyDiscountHandler = () => {
    const value = parseFloat(discountInput) || 0;
    if (value >= 0) {
      setDiscount(prev => ({ ...prev, value }));
    }
    setShowDiscountModal(false);
    setDiscountInput("");
  };

  const clearDiscount = () => {
    setDiscount({ type: 'amount', value: 0 });
    setDiscountInput("");
    setShowDiscountModal(false);
  };

  // Checkout
  const handleCheckout = () => {
    if (grandTotal <= 0) {
      Swal.fire('Info', 'No items in bill', 'info');
      return;
    }
    if (!posOpeningEntry) {
      Swal.fire('Warning', 'Open a shift first', 'warning');
      return;
    }
    setShowPaymentModal(true);
  };
  const selectPaymentMode = (mode) => {
    setSelectedPaymentMode(mode);
    setTenderedAmount(grandTotal);
  };

  // Removed updateLocalStock as backend now handles Smart Virtual Stock deduction
  // including pending POS sales.


  // ---------- COMPLETE PAYMENT ----------
  const completePayment = async () => {
    if (paymentLoading) return;
    let finalPayments = [...payments];

    // AUTO-CAPTURE: If there's an amount entered but not added to list, include it
    if (selectedPaymentMode && tenderedAmount > 0) {
      finalPayments.push({
        mode_of_payment: selectedPaymentMode,
        amount: round2(tenderedAmount)
      });
    }

    if (finalPayments.length === 0) {
      Swal.fire('Error', 'No payment added.', 'error');
      return;
    }

    const paidTotal = round2(finalPayments.reduce((sum, p) => sum + p.amount, 0));
    if (paidTotal < grandTotal) {
      Swal.fire('Error', `Insufficient amount. Paid: ${paidTotal}, Required: ${grandTotal}`, 'error');
      return;
    }

    setPaymentLoading(true);
    // Use the ID (name) if selected, otherwise fallback to the entered text or default Cash
    const customerId = selectedCustomer?.name || selectedCustomer?.customer_name || customerName || 'Cash';

    const generateOfflineId = () => {
      const now = new Date();
      const prefix = branchPrefix || user?.split('@')[0].slice(0, 3).toUpperCase() || 'POS';
      const dateStr = format(now, 'yyyyMMdd');
      const timeStr = format(now, 'HHmmssSS'); // Include milliseconds for uniqueness
      const seqKey = `offline_seq_${dateStr}`;
      const currentSeq = parseInt(localStorage.getItem(seqKey) || '0') + 1;
      localStorage.setItem(seqKey, currentSeq.toString());
      return `${prefix}-${dateStr}-${timeStr}-${String(currentSeq).padStart(4, '0')}`;
    };

    const offlineId = generateOfflineId();

    const payload = {
      offline_id: offlineId,
      customer: customerId,
      contact_mobile: phoneNumber,
      items: billItems.map(item => ({
        item_code: item.id,
        item_name: item.name,
        quantity: item.qty,
        uom: item.uom,
        uom_type: item.uom,
        custom_pieces_per_box: item.custom_pieces_per_box,
        basePrice: item.price,
        income_account: 'Sales of I/C - KSPL',
        warehouse: warehouse
      })),
      company,
      pos_profile: posProfile,
      warehouse: warehouse,
      pos_opening_entry: posOpeningEntry,
      payments: finalPayments.map(p => ({
        mode_of_payment: p.mode_of_payment,
        amount: parseFloat(p.amount.toFixed(2))
      })),
      discount_amount: discountAmount,
      apply_discount_on: "Net Total",
      tax_template: selectedTaxTemplate,
      posting_date: new Date().toISOString().slice(0, 10),
      currency: 'AED',
      due_date: new Date().toISOString().slice(0, 10)
    };

    try {
      // ALWAYS TRY ONLINE POST FIRST
      const data = await POSService.createInvoice(payload);

      // Check for success or duplicate
      const isSuccess = data && (data.status === 'success' || data.name || data.invoice_name);

      if (isSuccess) {
        const serverName = data.invoice_name || data.name || (data.message && data.message.invoice_name) || offlineId;

        Swal.fire({
          icon: 'success',
          title: isSuccess && String(data.message || data.name || "").includes("Duplicate") ? 'Already Sync Verified' : 'Invoice Created',
          text: `Invoice: ${serverName} | Total: AED ${grandTotal.toFixed(2)}`,
          showCancelButton: true,
          confirmButtonText: 'Print Receipt',
          cancelButtonText: 'Done',
          confirmButtonColor: '#16a34a'
        }).then((res) => {
          if (res.isConfirmed) {
            handlePrint({
              name: serverName,
              grand_total: grandTotal,
              subtotal: subtotal,
              discount_amount: discountAmount,
              tax_amount: taxAmount,
              posting_date: format(new Date(), 'yyyy-MM-dd'),
              posting_time: format(new Date(), 'HH:mm:ss'),
              items: billItems,
              payments: finalPayments
            });
          }
        });

        // Save to synced history locally
        await db.invoices.add({
          ...payload,
          is_synced: 1,
          server_name: serverName,
          grand_total: grandTotal,
          synced_at: new Date().toISOString()
        });

        // Deduct from local_qty in Dexie immediately
        for (const item of billItems) {
          const localItem = await db.items.get(item.id);
          if (localItem) {
            const piecesSold = item.uom === 'Box' ? item.qty * (item.custom_pieces_per_box || 1) : item.qty;
            await db.items.update(item.id, {
              local_qty: (localItem.local_qty || 0) - piecesSold
            });
          }
        }

        // IMMEDIATE UI UPDATE: Decrement stock from local React state
        const updateStock = (it) => {
          const sold = billItems.find(bi => bi.id === it.id);
          if (!sold) return it;
          const piecesSold = sold.uom === 'Box' ? sold.qty * (sold.custom_pieces_per_box || 1) : sold.qty;
          return {
            ...it,
            local_qty: (it.local_qty || 0) - piecesSold,
            total_qty: (it.total_qty || 0) - piecesSold,
            warehouse_details: (it.warehouse_details || []).map(wd => {
              if ((wd.warehouse_name || wd.warehouse) === warehouse) {
                return { ...wd, actual_qty: (wd.actual_qty || 0) - piecesSold };
              }
              return wd;
            })
          };
        };
        setItems(prev => prev.map(updateStock));
        setFilteredItems(prev => prev.map(updateStock));

        // Force next fetch to refresh
        localStorage.removeItem('last_item_sync_time');
        finalizeOrder();
      } else {
        // Fallback to offline if server returns a handled error (like duplicate but not success)
        throw new Error(data.message || "Server rejection. Saving to offline queue.");
      }
    } catch (e) {
      console.error("Order Submission Error:", e);
      await db.invoices.add({ ...payload, is_synced: 0, grand_total: grandTotal });
      Swal.fire({
        icon: 'info',
        title: 'Saved Offline',
        text: `The server reported an error (${e}). We have saved this invoice locally. It will sync automatically when possible.`,
        confirmButtonColor: '#3b82f6'
      });
      finalizeOrder();
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleFindNearestStock = async (item) => {
    try {
      Swal.fire({
        title: 'Searching branches...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const results = await frappeCall({
        method: 'kyle_retail.retail_api.api.auto_handle_missing_stock',
        args: { item_code: item.id, current_warehouse: warehouse }
      });

      Swal.close();

      if (results && results.length > 0) {
        const optionsHtml = results.slice(0, 3).map(res => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #e2e8f0;">
            <div style="text-align:left;">
              <div style="font-weight:900; color:#1e293b; font-size:0.85rem;">${res.warehouse}</div>
              <div style="font-size:0.75rem; color:#64748b;">${res.distance} km away</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:900; color:#10b981;">${res.qty} Units</div>
              <button onclick="window.requestStock('${item.id}', '${res.warehouse}', '${warehouse}')" 
                style="background:#2563eb; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:700; cursor:pointer; margin-top:4px;">
                Request
              </button>
            </div>
          </div>
        `).join('');

        window.requestStock = async (itemCode, fromWh, toWh) => {
          Swal.fire({ title: 'Creating Material Request...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          try {
            const res = await frappeCall({
              method: 'kyle_retail.retail_api.api.create_draft_material_request',
              args: { item_code: itemCode, qty: 1, from_warehouse: fromWh, to_warehouse: toWh }
            });
            if (res.status === 'success') {
              Swal.fire('Success', `Draft Material Request ${res.name} created!`, 'success');
            }
          } catch (e) {
            Swal.fire('Error', e.message || 'Failed to create request', 'error');
          }
        };

        Swal.fire({
          title: 'Nearest Stock Locations',
          html: `<div style="margin-top:15px;">${optionsHtml}</div>`,
          showConfirmButton: false,
          showCloseButton: true
        });
      } else {
        Swal.fire('No Stock', 'Item is not available in any other branch.', 'warning');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to fetch nearby stock.', 'error');
    }
  };

  const finalizeOrder = () => {
    setBillItems([]);
    setDiscount({ type: 'amount', value: 0 });
    setCustomerName('Cash'); setSelectedCustomer(null); setPhoneNumber('');
    setSelectedPaymentMode(''); setTenderedAmount(0);
    setShowPaymentModal(false);
    barcodeInputRef.current?.focus();
  };

  // ---------- SPEED CHECKOUT & KEYBOARD SHORTCUTS ----------
  const handleMobileEnter = async (e) => {
    if (e.key === 'Enter') {
      const searchTerm = (customerMobile || customerName).trim();
      if (!searchTerm || searchTerm === 'Cash') return;

      // 1. If we have active suggestions, pick the first one
      if (searchResults.length > 0) {
        pickCustomer(searchResults[0]);
        const Toast = Swal.mixin({
          toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
        });
        Toast.fire({ icon: 'success', title: `Customer: ${searchResults[0].customer_name}` });
        return;
      }

      // 2. If it looks like a mobile number, use speed checkout logic
      if (/^\d{7,}$/.test(searchTerm)) {
        setCustomerLoading(true);
        try {
          const res = await frappeCall({
            method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
            args: { mobile_no: searchTerm }
          });

          if (res && res.name) {
            pickCustomer(res);
            const Toast = Swal.mixin({
              toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
            });
            Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name || res.name}` });
            return;
          }
        } catch (err) {
          if (err.message && err.message.includes("409")) {
            // 409 means conflict - usually customer already exists
            try {
              // Try searching one more time or use a simpler detail call
              const searchRes = await frappeCall({
                method: 'kyle_retail.retail_api.api.get_customer_details',
                args: { customer: searchTerm }
              });
              if (searchRes && searchRes.name) {
                pickCustomer(searchRes);
                return;
              }
            } catch (e2) { }
          }
          console.error("Customer lookup failed", err);
          Swal.fire('Error', 'Customer lookup failed or exists with different details (409). Check if mobile is correct.', 'error');
        } finally {
          setCustomerLoading(false);
        }
      }
    }
  };

  // ---------- MODAL RENDERERS (REUSABLE) ----------
  const renderDiscountModal = () => (
    <div className="home-modal-overlay" onClick={() => setShowDiscountModal(false)}>
      <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="home-modal-header">
          <h3>Apply Discount</h3>
          <button className="home-modal-close" onClick={() => setShowDiscountModal(false)}><X size={20} /></button>
        </div>
        <div className="home-modal-body">
          <div className="home-discount-toggle">
            <button
              className={`home-discount-type-btn ${discount.type === 'amount' ? 'active' : ''}`}
              onClick={() => setDiscount({ ...discount, type: 'amount' })}
            >
              <DollarSign size={16} /> AED (Fixed)
            </button>
            <button
              className={`home-discount-type-btn ${discount.type === 'percentage' ? 'active' : ''}`}
              onClick={() => setDiscount({ ...discount, type: 'percentage' })}
            >
              <Layers size={16} /> % (Percent)
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: '#2563eb', fontSize: '1.2rem' }}>
              {discount.type === 'amount' ? 'AED' : '%'}
            </span>
            <input
              type="number"
              placeholder="0.00"
              className="home-customer-input"
              style={{ paddingLeft: '3.5rem', fontSize: '1.5rem', fontWeight: 900, textAlign: 'right' }}
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setDiscount({ ...discount, value: parseFloat(discountInput) || 0 }), setShowDiscountModal(false))}
              autoFocus
            />
          </div>
        </div>
        <div className="home-modal-footer">
          <button className="home-modal-cancel" onClick={clearDiscount}>Clear</button>
          <button className="home-modal-apply" onClick={() => { setDiscount({ ...discount, value: parseFloat(discountInput) || 0 }); setShowDiscountModal(false); }}>Apply</button>
        </div>
      </div>
    </div>
  );

  const renderPaymentModal = () => (
    <div className="home-modal-overlay" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}>
      <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="home-modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
          <h3 style={{ margin: 0 }}>Payment Details</h3>
        </div>

        <div className="home-modal-body">
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#64748b' }}>
              <span>Grand Total:</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>AED {grandTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#10b981' }}>
              <span>Paid So Far:</span>
              <span style={{ fontWeight: 700 }}>AED {totalPaid.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '2px dashed #cbd5e1' }}>
              <span style={{ fontWeight: 800, color: balanceRemaining > 0 ? '#ef4444' : '#10b981' }}>
                {balanceRemaining > 0 ? 'Remaining Balance:' : 'Fully Paid / Change:'}
              </span>
              <span style={{ fontWeight: 900, fontSize: '1.2rem', color: balanceRemaining > 0 ? '#ef4444' : '#10b981' }}>
                AED {Math.abs(balanceRemaining).toFixed(2)}
              </span>
            </div>
          </div>

          {payments.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>Added Payments</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {p.mode_of_payment === 'Cash' ? <DollarSign size={16} color="#10b981" /> : <CreditCard size={16} color="#3b82f6" />}
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.mode_of_payment}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 700 }}>AED {p.amount.toFixed(2)}</span>
                      <button onClick={() => removePayment(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {balanceRemaining > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.75rem' }}>Add Payment</h4>

              {!selectedPaymentMode ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button className="payment-mode-btn cash" onClick={() => setSelectedPaymentMode('Cash')} style={{ padding: '0.75rem', height: 'auto', flexDirection: 'row', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <DollarSign size={20} /> Cash
                  </button>
                  <button className="payment-mode-btn card" onClick={() => setSelectedPaymentMode('Credit Card')} style={{ padding: '0.75rem', height: 'auto', flexDirection: 'row', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <CreditCard size={20} /> Card
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{selectedPaymentMode} Amount:</span>
                    <button onClick={() => setSelectedPaymentMode('')} style={{ fontSize: '0.75rem', color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}>Change Mode</button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>AED</span>
                    <input
                      type="number"
                      value={tenderedAmount}
                      onChange={e => setTenderedAmount(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 3rem', borderRadius: '8px', border: '2px solid #3b82f6', fontSize: '1.1rem', fontWeight: 700 }}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                    />
                  </div>
                  <button onClick={addPayment} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                    Add {selectedPaymentMode} Payment
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="home-modal-footer" style={{ borderTop: '1px solid #e2e8f0', marginTop: '1rem' }}>
          <button className="home-modal-cancel" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}>Cancel</button>
          <button
            className="home-modal-apply"
            onClick={completePayment}
            disabled={paymentLoading || balanceRemaining > 0}
            style={{ background: balanceRemaining <= 0 ? '#10b981' : '#94a3b8', minWidth: '180px' }}
          >
            {paymentLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
            {paymentLoading ? 'Processing...' : 'Complete Payment'}
          </button>
        </div>
      </div>
    </div>
  );


  const handlePrint = (invoiceData) => {
    const cashierName = user?.split('@')[0].toUpperCase() || 'CASHIER';
    const companyName = company || 'KYLE RETAIL';
    const storeAddress = warehouse || 'Main Store Address';
    const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.name}&scale=2&height=10`;

    // Calculate total paid and change due
    const totalPaidAmount = (invoiceData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const changeDue = Math.max(0, totalPaidAmount - (parseFloat(invoiceData.grand_total) || 0));

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt - ${invoiceData.name}</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { 
                        width: 72mm; margin: 0 auto; padding: 10px 0; 
                        font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; color: #000;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                    .header p { margin: 2px 0; font-size: 11px; }
                    .info { margin: 10px 0; font-size: 11px; }
                    .info-row { display: flex; justify-content: space-between; }
                    .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; }
                    .items-table td { padding: 4px 0; vertical-align: top; font-size: 11px; }
                    .text-right { text-align: right; }
                    .totals { margin: 8px 0; }
                    .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
                    .grand-total { font-size: 16px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                    .barcode { display: block; margin: 15px auto; width: 100%; max-height: 40px; }
                    .footer { font-size: 10px; margin-top: 15px; }
                    @media print { body { width: 72mm; margin: 0 auto; } }
                </style>
            </head>
            <body>
                <div class="header center">
                    <h2 class="bold">${companyName}</h2>
                    <p>${storeAddress}</p>
                    <p>Tel: +971 00 000 0000</p>
                </div>
                <div class="divider"></div>
                <div class="info">
                    <div class="info-row"><span>CASHIER:</span> <span class="bold">#${cashierName}</span></div>
                    <div class="info-row"><span>DATE:</span> <span>${invoiceData.posting_date}</span></div>
                    <div class="info-row"><span>TIME:</span> <span>${invoiceData.posting_time || 'N/A'}</span></div>
                    <div class="info-row"><span>INV NO:</span> <span class="bold">${invoiceData.name}</span></div>
                </div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 55%; text-align: left;">ITEM</th>
                            <th class="text-right" style="width: 15%;">QTY</th>
                            <th class="text-right" style="width: 30%;">PRICE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(invoiceData.items || []).map(it => {
      const unitPrice = (it.uom === 'Box' ? (it.price * (it.custom_pieces_per_box || 1)) : it.price) || it.rate || it.basePrice || 0;
      const lineTotal = (it.qty || 1) * unitPrice;
      return `
                            <tr>
                                <td style="padding-right: 5px; word-break: break-word;">${it.item_name || it.item_code || it.name || 'ITEM'}</td>
                                <td class="text-right" style="padding-right: 5px;">${it.qty || 1}</td>
                                <td class="text-right">${parseFloat(lineTotal).toFixed(2)}</td>
                            </tr>
                          `;
    }).join('')}
                    </tbody>
                </table>
                <div class="divider"></div>
                <div class="totals">
                    <div class="total-row">
                        <span>SUB TOTAL</span>
                        <span>AED ${parseFloat(invoiceData.subtotal || invoiceData.grand_total).toFixed(2)}</span>
                    </div>
                    ${invoiceData.discount_amount > 0 ? `
                        <div class="total-row">
                            <span>DISCOUNT</span>
                            <span>-AED ${parseFloat(invoiceData.discount_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${invoiceData.tax_amount > 0 ? `
                        <div class="total-row">
                            <span>TAX</span>
                            <span>AED ${parseFloat(invoiceData.tax_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand-total bold">
                        <span>TOTAL</span>
                        <span>AED ${parseFloat(invoiceData.grand_total).toFixed(2)}</span>
                    </div>
                    <div style="margin-top: 10px;">
                        ${(invoiceData.payments || [{ mode_of_payment: 'CASH', amount: invoiceData.grand_total }]).map(p => `
                            <div class="total-row">
                                <span>${(p.mode_of_payment || 'PAYMENT').toUpperCase()}</span>
                                <span>AED ${parseFloat(p.amount || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="total-row" style="margin-top: 5px; opacity: 0.8;">
                        <span>CHANGE</span>
                        <span class="bold">AED ${changeDue.toFixed(2)}</span>
                    </div>
                </div>
                <div class="center">
                    <img class="barcode" src="${barCodeUrl}" />
                    <div class="footer">
                        <p class="bold" style="font-size: 12px;">THANK YOU!</p>
                        <p>GLAD TO SEE YOU AGAIN!</p>
                        <p style="margin-top: 5px; opacity: 0.7;">Powered by KYLE RETAIL</p>
                    </div>
                </div>
                <script>
                    window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
  };

  // Background sync logic
  // Centralized Global Sync Listeners
  useEffect(() => {
    const handleShiftSynced = (e) => {
      const serverName = e.detail.name;
      setPosOpeningEntry(serverName);
    };

    const handleInvoicesSynced = () => {
      fetchItems(); // Refresh stock immediately after sync
      const checkCount = async () => {
        const count = await db.invoices.where('is_synced').equals(0).count();
        setPendingSyncCount(count);
      };
      checkCount();
    };

    window.addEventListener('shift-synced', handleShiftSynced);
    window.addEventListener('invoices-synced', handleInvoicesSynced);

    return () => {
      window.removeEventListener('shift-synced', handleShiftSynced);
      window.removeEventListener('invoices-synced', handleInvoicesSynced);
    };
  }, [fetchItems]);

  const handleLogout = async () => {
    try { await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.user_logout', { method: "POST" }); }
    catch { }
    localStorage.clear(); dispatch(logout()); navigate('/');
  };
  const closingEntry = () => navigate('/closingentry');

  // ---------- KEYBOARD SHORTCUTS ENGINE ----------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2: Focus Mobile Number
      if (e.key === 'F2') {
        e.preventDefault();
        mobileInputRef.current?.focus();
      }

      // F4: Focus Barcode/Search
      if (e.key === 'F4') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }

      // F8: Nearby Branch Stock Check
      if (e.key === 'F8') {
        e.preventDefault();
        if (lastInteractedItem) {
          handleFindNearestStock(lastInteractedItem);
        }
      }

      // Space: Open Payment (Global focus handling)
      if (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
          e.preventDefault();
          handleCheckout();
        }
      }

      // Enter: Smart Handling in Payment Modal
      if (e.key === 'Enter' && showPaymentModal) {
        if (selectedPaymentMode && tenderedAmount > 0) {
          e.preventDefault();
          addPayment();
        } else if (balanceRemaining <= 0 && !paymentLoading) {
          e.preventDefault();
          completePayment();
        }
      }

      // Esc: Close/Clear
      if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
          setSelectedPaymentMode('');
        } else if (showDiscountModal) {
          setShowDiscountModal(false);
        } else if (showItemDropdown) {
          setShowItemDropdown(false);
        } else if (billItems.length > 0) {
          setBillItems([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billItems.length, showPaymentModal, showDiscountModal, showItemDropdown, selectedPaymentMode, showOpeningModal, lastInteractedItem, balanceRemaining, tenderedAmount, paymentLoading]);

  if (loadingItems) return <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Loading items...</p></div>;

  if (error) return (
    <div className="home-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1.5rem', backgroundColor: '#fff' }}>
      <div style={{ textAlign: 'center', color: '#ef4444', maxWidth: '600px', padding: '0 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem', color: '#1e293b' }}>Strict Online Sync Required</h2>
        <div style={{ background: '#fef2f2', padding: '1.25rem', borderRadius: '12px', border: '1px solid #fee2e2', textAlign: 'left' }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: '0.85rem', fontWeight: 600 }}>{error}</p>
        </div>
        <p style={{ marginTop: '1.5rem', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
          The system is configured to use <strong>Live Server Data</strong> while online.
          If this error persists, it usually means the Backend is down or the network is blocked.
        </p>
      </div>
      <button
        onClick={() => { setError(""); fetchItems(true); }}
        style={{
          padding: '12px 32px',
          borderRadius: '8px',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
        }}
      >
        Retry Online Sync
      </button>

      {/* Secret Emergency Button - for technician only */}
      <button
        onClick={async () => {
          const local = await db.items.toArray();
          if (local.length > 0) {
            setError("");
            const groups = [...new Set(local.map(i => (i.group || "others").toLowerCase()))];

            // Try to load cached categories from DB first
            let finalCats = ["all", ...groups.sort()];
            try {
              const cached = await db.payment_modes.get('categories');
              if (cached && cached.data) finalCats = cached.data;
            } catch (e) { }

            setCategories(finalCats);
            setItems(local);
            setFilteredItems(local);
          }
          barcodeInputRef.current?.focus();
        }}
        style={{ opacity: 0.1, fontSize: '10px', marginTop: '20px', border: 'none', background: 'none' }}
      >
        Emergency Bypass
      </button>
    </div>
  );

  const changeBack = Math.max(0, totalPaid - grandTotal);

  // ---------- RENDER ----------
  // NEW CLASSIC RENDERER (Embedded logic for Green/Blue themes)
  if (theme === 'legacy') {
    const isGreen = legacySubTheme === 'green';
    const accentColor = '#e8c84a';

    return (
      <div className={`classic-root ${!isGreen ? 'theme-blue' : ''}`}>
        <style>{classicStyles}</style>

        {/* CLASSIC NAVBAR */}
        <nav className="classic-nav">
          <div className="flex items-center gap-4 pl-4 py-2">
            <span className="text-[28px] font-black text-slate-800 tracking-tighter uppercase leading-none select-none">
              POS<span className={isGreen ? 'text-emerald-500' : 'text-sky-500'}>8</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded bg-slate-50 border border-slate-200 transition-all font-black text-[12px] shadow-sm uppercase tracking-wide ${isOffline ? 'text-rose-600' : (isGreen ? 'text-emerald-700' : 'text-sky-700')}`}>
              {isOffline ? <WifiOff size={11} /> : <Wifi size={11} />}
              {isOffline ? 'OFFLINE' : 'ONLINE'}
            </div>
            {pendingSyncCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-sky-50 border border-sky-200 text-sky-600 text-[10px] font-black tracking-widest cursor-pointer" onClick={() => navigate('/syncmanager')}>
                <RefreshCw size={11} className="animate-spin" /> {pendingSyncCount} PENDING
              </div>
            )}
            <div className="h-5 w-[1px] bg-slate-200" />
            <button
              onClick={toggleLegacyColor}
              className={`flex items-center gap-2 px-4 py-1.5 rounded bg-slate-50 border border-slate-200 transition-all font-black text-[12px] shadow-sm uppercase tracking-wide ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'}`}
              title="Toggle Legacy Color"
            >
              <Palette size={11} /> {!isGreen ? 'GREEN' : 'BLUE'}
            </button>

            <div className="h-5 w-[1px] bg-slate-200" />
            <button
              onClick={() => dispatch(toggleTheme())}
              className={`flex items-center gap-2 px-4 py-1.5 rounded bg-slate-50 border border-slate-200 transition-all font-black text-[12px] shadow-sm uppercase tracking-wide ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'}`}
              title="Switch to Modern UI"
            >
              <MonitorSmartphone size={11} /> MODERN UI
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-6 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'}`}
            >
              ADMIN
            </button>
            <div className="flex items-center gap-3 px-3 py-1 bg-slate-50 border border-slate-200 rounded">
              <UserIcon size={12} className="text-slate-500" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-800 uppercase leading-none">{user?.full_name || user || 'CASHIER'}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{format(currentTime, 'dd MMM · HH:mm:ss')}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white transition-all rounded">
              <Power size={14} />
            </button>
          </div>
        </nav>

        {/* CLASSIC HEADER FORM */}
        <div className="classic-header-form">


          <div className="classic-field flex items-center gap-2 relative">
            <label className="uppercase font-bold">CUSTOMER</label>
            <div className="relative group" ref={dropdownRef}>
              <input
                value={customerMobile || customerName}
                onChange={e => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) { setCustomerMobile(val); setCustomerName(''); }
                  else { setCustomerName(val); setCustomerMobile(''); }
                }}
                onFocus={() => { setSearchContext('customer'); setShowDropdown(true); }}
                onClick={() => { setSearchContext('customer'); setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
                onKeyDown={handleMobileEnter}
                className="w-48 h-6 px-2"
                placeholder="Mobile or Name..."
              />
              {showDropdown && (
                <div className="absolute top-full left-0 w-64 bg-white border-2 border-slate-900 shadow-[4px_4px_0_rgba(0,0,0,0.1)] z-[9999] max-h-48 overflow-y-auto">
                  {searchResults.map(c => (
                    <div key={c.name} className={`p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-[11px] font-bold text-slate-900`} onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}>
                      {c.customer_name} — {c.mobile_no}
                    </div>
                  ))}
                  <div className="p-2 bg-sky-50 text-sky-600 font-black text-[10px] cursor-pointer hover:bg-amber-400 hover:text-black" onMouseDown={(e) => { e.preventDefault(); openCreate(); }}>+ CREATE NEW CUSTOMER</div>
                </div>
              )}
            </div>
          </div>

          <div className="classic-field flex items-center gap-2" style={{ position: 'relative' }}>
            <label className="uppercase font-bold">BARCODE</label>
            <div style={{ position: 'relative' }} ref={itemDropdownRef}>
              <input
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={e => { setBarcodeInput(e.target.value); setSearchContext('header'); setShowItemDropdown(true); }}
                onKeyDown={onBarcodeKeyDown}
                onFocus={() => { setSearchContext('header'); setShowItemDropdown(true); setActiveItemIndex(-1); }}
                onClick={() => { setSearchContext('header'); setShowItemDropdown(true); }}
                onBlur={() => setTimeout(() => setShowItemDropdown(false), 300)}
                id="legacy-header-search"
                className="w-48 h-6 px-2 bg-amber-50"
                placeholder="Scan Barcode or Search..."
              />
              {showItemDropdown && itemSearchResults.length > 0 && searchContext === 'header' && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, minWidth: '320px',
                  background: '#fff', border: '2px solid #1e293b',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.12)', zIndex: 9999,
                  maxHeight: '260px', overflowY: 'auto'
                }}>
                  {itemSearchResults.map((it, idx) => (
                    <div
                      key={it.id}
                      style={{
                        padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                        background: activeItemIndex === idx ? (isGreen ? '#fef3c7' : '#e0f2fe') : '#fff'
                      }}
                      className={activeItemIndex === idx ? 'active-dropdown-item' : ''}
                      onMouseDown={(e) => { e.preventDefault(); handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); barcodeInputRef.current?.focus(); }}
                      onMouseEnter={() => setActiveItemIndex(idx)}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{it.name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {it.barcodes && it.barcodes.length > 0 ? `${it.barcodes[0].barcode} · ` : ''}
                          {it.id} · Stock: {it.local_qty}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: isGreen ? '#10b981' : '#0284c7', fontSize: '12px' }}>AED {it.price}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-1 bg-slate-50 border border-slate-200 rounded">
              <span className="text-[10px] font-black text-slate-400 uppercase">Branch:</span>
              <span className="text-[11px] font-black text-slate-800">{warehouse}</span>
            </div>
          </div>
        </div>

        {/* CLASSIC MAIN BODY */}
        <div className="flex-1 flex overflow-hidden">
          <div className="classic-entry-area">
            {/* GRID SECTION */}
            <div className="flex-1 overflow-auto bg-white/40 pb-64" style={{ minHeight: '300px' }}>
              <table className="classic-table">
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center">#</th>
                    <th>ITEM CODE</th>
                    <th>DESCRIPTION</th>
                    <th className="text-center">UOM</th>
                    <th className="text-right">QTY</th>
                    <th className="text-right">PRICE</th>
                    <th className="text-right">TOTAL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item, idx) => {
                    const itemPrice = item.uom === 'Box' ? item.price * (item.custom_pieces_per_box || 1) : item.price;
                    const lineTotal = item.qty * itemPrice;
                    return (
                      <tr key={idx} className="bg-white hover:bg-amber-50 group border-b border-slate-100">
                        <td className="text-center font-bold text-slate-400 text-[10px]">{idx + 1}</td>
                        <td className="px-2 font-bold text-slate-900">
                          <span className="classic-cell-text" title={item.item_code || item.id}>{item.item_code || item.id}</span>
                        </td>
                        <td className="px-2 font-black text-slate-700 uppercase">
                          <span className="classic-cell-text" title={item.item_name || item.name}>{item.item_name || item.name}</span>
                        </td>
                        <td className="p-0">
                          <select
                            value={item.uom}
                            onChange={e => toggleUom(item.id, e.target.value)}
                            className="w-full h-full bg-slate-50 font-black text-[12px] text-center text-slate-700 border-none outline-none focus:bg-amber-200 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <option value="Piece">Pc</option>
                            <option value="Box">Box</option>
                          </select>
                        </td>
                        <td className="p-0">
                          <input
                            id={`qty-input-${idx}`}
                            type="number"
                            value={item.qty}
                            onChange={e => setQuantity(item.id, e.target.value)}
                            onFocus={e => e.target.select()}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (theme === 'legacy') {
                                  const targetId = searchContext === 'header' ? 'legacy-header-search' : 'legacy-inline-search';
                                  document.getElementById(targetId)?.focus();
                                } else {
                                  barcodeInputRef.current?.focus();
                                }
                              }
                            }}
                            className="w-full h-full text-right px-2 font-black text-sky-600 focus:bg-amber-100 outline-none border-none"
                          />
                        </td>
                        <td className="text-right px-2 font-black text-slate-800 bg-slate-50/30">
                          {parseFloat(item.price).toFixed(2)}
                        </td>
                        <td className="text-right px-2 font-black text-slate-900 bg-slate-50/50">AED {(parseFloat(lineTotal) || 0).toFixed(2)}</td>
                        <td className="text-center">
                          <button onClick={() => removeFromBill(item.id)} className="text-rose-400 hover:text-rose-600 font-bold">×</button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* ADVANCED: Smart Inline Search Row (The "Active" Empty Row) */}
                  <tr
                    className={`${isGreen ? 'bg-emerald-50/50' : 'bg-sky-50/50'} border-y-2 border-amber-400 group relative cursor-pointer hover:bg-amber-100/30 transition-all`}
                    onClick={() => { inlineInputRef.current?.focus(); setSearchContext('inline'); setShowItemDropdown(true); }}
                  >
                    <td className="text-center font-bold text-amber-600">{billItems.length + 1}</td>
                    <td colSpan={2} className="p-0 relative h-10">
                      <input
                        type="text"
                        id="legacy-inline-search"
                        ref={inlineInputRef}
                        className="w-full h-full px-4 font-black italic text-slate-400 focus:text-slate-900 bg-transparent outline-none placeholder:text-slate-300 cursor-pointer"
                        placeholder="SCAN BARCODE OR TYPE ITEM NAME HERE TO ADD..."
                        value={barcodeInput}
                        onChange={e => { setBarcodeInput(e.target.value); setSearchContext('inline'); setShowItemDropdown(true); }}
                        onFocus={() => { setSearchContext('inline'); setShowItemDropdown(true); setActiveItemIndex(-1); }}
                        onClick={(e) => { e.stopPropagation(); setSearchContext('inline'); setShowItemDropdown(true); }}
                        onBlur={() => setTimeout(() => setShowItemDropdown(false), 300)}
                        onKeyDown={onBarcodeKeyDown}
                      />
                      {/* Fixed-position dropdown — avoids overflow:auto clipping — shifted for UOM column */}
                      {showItemDropdown && itemSearchResults.length > 0 && searchContext === 'inline' && inlineInputRef.current && (() => {
                        const rect = inlineInputRef.current.getBoundingClientRect();
                        return (
                          <div style={{
                            position: 'fixed',
                            top: rect.bottom,
                            left: rect.left,
                            width: Math.max(rect.width + 80, 560),
                            background: '#fff',
                            border: '2px solid #1e293b',
                            boxShadow: '8px 8px 0 rgba(0,0,0,0.12)',
                            zIndex: 9999,
                            maxHeight: '280px',
                            overflowY: 'auto'
                          }}>
                            {itemSearchResults.map((it, i) => (
                              <div
                                key={it.id}
                                style={{
                                  padding: '8px 14px',
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: activeItemIndex === i ? (isGreen ? '#fef3c7' : '#e0f2fe') : (i === 0 ? (isGreen ? '#f0fdf4' : '#f0f9ff') : '#fff')
                                }}
                                className={activeItemIndex === i ? 'active-dropdown-item' : ''}
                                onMouseDown={(e) => { e.preventDefault(); handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); inlineInputRef.current?.focus(); }}
                                onMouseEnter={() => setActiveItemIndex(i)}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>{it.name}</div>
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    {it.barcodes && it.barcodes.length > 0 ? `${it.barcodes[0].barcode} · ` : ''}
                                    {it.id} &nbsp;·&nbsp; Stock: {it.local_qty}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 800, color: isGreen ? '#10b981' : '#0284c7', fontSize: '13px', marginLeft: 16 }}>AED {it.price}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="bg-black/5">-</td>
                    <td className="bg-black/5">-</td>
                    <td className="text-right px-2 font-black text-amber-600 bg-black/5">NEXT ITEM</td>
                    <td className="text-center group-hover:bg-amber-400 transition-colors">
                      <Search size={14} className="mx-auto text-amber-400 group-hover:text-black" />
                    </td>
                  </tr>

                  {/* Aesthetic placeholder rows to fill the screen without causing huge scrollbars */}
                  {Array.from({ length: Math.max(0, 17 - billItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="bg-white/30 border-b border-white/10 opacity-30">
                      <td className="text-center text-slate-300 font-bold">{billItems.length + i + 2}</td>
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BOTTOM TOTALS */}
            <div className="classic-bottom-bar">
              <div className="flex items-center gap-8 px-8 py-2 bg-white">
                <div className="flex flex-col items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">SUBTOTAL</label>
                  <span className="text-slate-900 font-black text-xl">AED {displaySubtotal.toFixed(2)}</span>
                </div>
                {displayDiscount > 0 && (
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-0.5">
                      DISCOUNT {(discount.type === 'percentage' || discount.type === 'percent') ? `(${discount.value}%)` : ''}
                    </label>
                    <span className="text-rose-600 font-black text-xl">-AED {displayDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <label className={`text-[10px] font-black ${isGreen ? 'text-emerald-600' : 'text-sky-600'} uppercase tracking-widest mb-0.5`}>VAT ({taxRate}%)</label>
                  <span className={`${isGreen ? 'text-emerald-500' : 'text-sky-500'} font-black text-xl`}>AED {displayTax.toFixed(2)}</span>
                </div>
                <div className="h-10 w-[2px] bg-slate-200" />
                <div className="flex flex-col items-center min-w-[140px]">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">TOTAL AMOUNT</label>
                  <span className={`${isGreen ? 'text-emerald-500' : 'text-sky-500'} font-black text-[28px] tracking-tighter`}>AED {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* ACTION BAR */}
            <div className="classic-action-bar flex items-center gap-3 p-2 bg-white border-t border-slate-100">
              <button
                className={`px-6 py-2 bg-slate-50 border border-slate-200 ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'} transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide`}
                onClick={() => setShowDiscountModal(true)}
              >
                % DISCOUNT
              </button>
              <button
                className={`px-6 py-2 bg-slate-50 border border-slate-200 ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'} transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide`}
                onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }}
              >
                ↺ CLEAR BILL
              </button>
              <div className="flex-1" />
              <button
                className={`px-10 py-2.5 bg-slate-50 border border-slate-300 ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'} transition-all font-black text-[13px] rounded shadow-md uppercase tracking-wider active:scale-95`}
                onClick={handleCheckout}
                disabled={grandTotal <= 0}
              >
                💳 PROCESS PAYMENT [F12]
              </button>
              <button
                className={`px-6 py-2 bg-slate-50 border border-slate-200 ${isGreen ? 'text-emerald-700 hover:bg-white' : 'text-sky-700 hover:bg-white'} transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide`}
                onClick={closingEntry}
              >
                [F10] CLOSING
              </button>
            </div>

            {/* STATUS BAR */}
            <div className="classic-statusbar">
              <div className="flex items-center gap-2">
                <span className="text-white/20 font-bold uppercase">Items:</span>
                <span className="font-black text-amber-400">{billItems.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/20 font-bold uppercase">Customer:</span>
                <span className="font-black text-amber-400">{customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/20 font-bold uppercase">Session:</span>
                <span className="font-black text-emerald-400">{posOpeningEntry}</span>
              </div>
              <div className="ml-auto opacity-50 font-bold">READY · SYSTEM OK</div>
            </div>
          </div>
        </div>

        {/* Reuse Modals from existing Home.jsx logic */}
        {showDiscountModal && renderDiscountModal()}
        {showPaymentModal && renderPaymentModal()}
        {showOpeningModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2000] flex items-center justify-center p-8">
            <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl">
              <OpeningEntryPage onOpeningEntrySuccess={handleOpeningSuccess} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- MODERN RENDER (EMERALD & SLATE) ----------
  return (
    <div className={`home-container ${!isGreen ? 'theme-blue' : ''} ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      {theme === 'legacy' ? (
        <div className={`classic-root ${!isGreen ? 'theme-blue' : ''}`}>
          <style>{classicStyles}</style>

          {/* CLASSIC NAVBAR */}
          <nav className="classic-nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div
                className="so-brand"
                style={{
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                }}
                onClick={() => navigate('/homepage')}
              >
                <MonitorSmartphone size={24} style={{ color: isGreen ? '#10b981' : '#0ea5e9' }} />
                <span style={{ color: '#0f172a' }}>POS<span style={{ color: isGreen ? '#10b981' : '#0ea5e9' }}>8</span></span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => dispatch(toggleTheme())}
                  style={{
                    padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                    background: '#ffffff', color: '#64748b', fontSize: '11px', fontWeight: 900,
                    textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <LayoutDashboard size={14} /> Theme: {theme.toUpperCase()}
                </button>

                <button
                  onClick={toggleTheme}
                  style={{
                    padding: '8px 16px', borderRadius: '12px', border: '1.5px solid',
                    borderColor: isGreen ? '#10b981' : '#0ea5e9',
                    background: '#ffffff', color: isGreen ? '#10b981' : '#0ea5e9',
                    fontSize: '11px', fontWeight: 950, textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <Palette size={14} /> {isGreen ? 'BLUE' : 'GREEN'}

                </button>

              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {isOffline ? 'Offline' : 'Online'}
                </span>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  width: '40px', height: '40px', borderRadius: '12px', background: '#fef2f2',
                  color: '#ef4444', border: '1px solid #fee2e2', display: 'flex',
                  alignItems: 'center', justifyCenter: 'center', cursor: 'pointer'
                }}
              >
                <Power size={18} />
              </button>
            </div>
          </nav>

          {/* ... classic view content remaining as is ... */}
          {/* Due to size limit, I'm focusing on the main structure. 
              The classic view body was mostly placeholder in the last iteration.
              Moving to Modern view which is the target. */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', opacity: 0.5 }}>
            CLASSIC MODE ACTIVE
          </div>
        </div>
      ) : (
        <div className="so-page">
          {/* MODERN TOOL STRIP */}
          <div className="so-tool-strip">
            <div className="so-shortcut-badge" onClick={() => nameInputRef.current?.focus()}>
              <span className="so-shortcut-key">F2</span>
              <span className="so-shortcut-label">Customer</span>
            </div>
            <div className="so-shortcut-badge" onClick={() => barcodeInputRef.current?.focus()}>
              <span className="so-shortcut-key">F4</span>
              <span className="so-shortcut-label">Search</span>
            </div>
            <div className="so-shortcut-badge" onClick={handleCheckout}>
              <span className="so-shortcut-key">SPACE</span>
              <span className="so-shortcut-label">Pay Now</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#fef2f2', borderColor: '#fee2e2' }} onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }}>
              <span className="so-shortcut-key" style={{ color: '#ef4444', borderColor: '#fca5a5' }}>ESC</span>
              <span className="so-shortcut-label" style={{ color: '#991b1b' }}>Clear Bill</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 mx-2"></div>

            <button
                onClick={toggleLegacyColor}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0 0.75rem', height: '2rem', background: 'transparent',
                  border: `1.5px solid var(--so-primary)`, borderRadius: '0.375rem',
                  fontSize: '0.7rem', fontWeight: 850, color: 'var(--so-primary)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >
                <Palette size={12} /> {!isGreen ? 'GREEN' : 'BLUE'}
              </button>

              <button
                onClick={() => dispatch(toggleTheme())}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0 0.75rem', height: '2rem', background: 'transparent',
                  border: '1.5px solid var(--so-border)', borderRadius: '0.375rem',
                  fontSize: '0.7rem', fontWeight: 850, color: 'var(--so-text-muted)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  textTransform: 'uppercase'
                }}
              >
                <MonitorSmartphone size={12} /> Layout
              </button>

            <div className="flex-1"></div>
            <button
              onClick={() => navigate('/quickstockin')}
              className="so-btn-primary"
              style={{ padding: '0 1.5rem', height: '2.5rem' }}
            >
              <Package size={16} /> Quick Stock-In
            </button>
          </div>

          <main className="so-main-layout">
            <div className="so-item-side">
              <div className="so-cat-bar">
                {categories.length > 5 && (
                  <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-200" onClick={handlePrevSlide}>
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div className="so-cat-tabs" ref={categoryScrollRef}>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`so-cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => handleFilter(cat)}
                    >
                      {cat === "all" ? "All Categories" : cat}
                    </button>
                  ))}
                </div>
                {categories.length > 5 && (
                  <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-200" onClick={handleNextSlide}>
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              <div className="so-grid-area">
                {filteredItems.length === 0 ? (
                  <div className="col-span-full h-96 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-70">
                    <SearchSlash size={64} strokeWidth={1} />
                    <span className="font-black text-sm uppercase tracking-[0.2em]">No products found</span>
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <div
                      key={item.id}
                      className="so-item-card"
                      onClick={() => { setLastInteractedItem(item); item.local_qty > 0 && handleAddToBill(item); }}
                      style={{ opacity: item.local_qty > 0 ? 1 : 0.6 }}
                    >
                      <div className="relative group">
                        {item.image ? (
                          <img src={getImageUrl(item.image)} alt={item.name} className="so-item-img" />
                        ) : (
                          <div className="so-item-img flex items-center justify-center p-6 text-center text-slate-400 font-black text-[10px] uppercase bg-slate-50 border-2 border-dashed border-slate-200">
                            {item.name}
                          </div>
                        )}
                        <div className="absolute top-2.5 right-2.5">
                          <span className={`so-item-badge ${item.local_qty > 10 ? 'so-badge-emerald' : (item.local_qty > 0 ? 'so-badge-amber' : 'so-badge-rose')}`}>
                            {item.local_qty > 0 ? `${item.local_qty} UNIT` : 'OUT STOCK'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col flex-1 justify-between gap-1.5">
                        <h4 className="so-item-name">
                          {item.name}
                        </h4>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Price</span>
                            <span className="font-black text-slate-900 text-[13px]">
                              <span className="text-[9px] text-slate-400 mr-0.5">AED</span> {parseFloat(item.price).toFixed(2)}
                            </span>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); showStockBreakdown(item); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all border border-slate-100"
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </div>

                      {item.local_qty <= 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFindNearestStock(item); }}
                          className="w-full mt-2 py-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 text-[10px] font-black uppercase tracking-tighter hover:bg-sky-600 hover:text-white transition-all"
                        >
                          Locate in Other Branches
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* BILL SIDE */}
            <aside className="so-bill-side">
              <div className="so-bill-header flex flex-col gap-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserPlus size={18} className="text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                  </div>
                  <input
                    ref={nameInputRef}
                    type="text"
                    placeholder="Search Customer..."
                    value={customerName === 'Cash' ? '' : customerName}
                    className="so-customer-input pl-12"
                    onChange={e => { setCustomerName(e.target.value); if (e.target.value.trim() !== 'Cash') setSelectedCustomer(null); }}
                    onFocus={() => { if (customerName.trim() === 'Cash') setCustomerName(''); setShowDropdown(true); }}
                    onBlur={() => { if (!customerName.trim()) setCustomerName('Cash'); }}
                  />
                  {showDropdown && (
                    <div ref={dropdownRef} className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[300] mt-2 max-h-56 overflow-y-auto">
                      {searchResults.map(c => (
                        <div key={c.name} onMouseDown={() => pickCustomer(c)} className="p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center group">
                          <div>
                            <div className="font-black text-[13px] text-slate-800 uppercase">{c.customer_name}</div>
                            <div className="text-[11px] text-slate-400 font-bold">{c.mobile_no}</div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500" />
                        </div>
                      ))}
                      <div onMouseDown={openCreate} className="p-4 bg-emerald-50 text-emerald-600 font-black text-[11px] uppercase tracking-wider cursor-pointer hover:bg-emerald-100 text-center">
                        + Register New Customer
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search size={18} className="text-sky-400 group-focus-within:text-sky-600 transition-colors" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="SCAN OR TYPE PRODUCT NAME..."
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={onBarcodeKeyDown}
                    className="so-customer-input pl-12 border-sky-100 bg-sky-50 focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="so-bill-items">
                {billItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4 mt-12 grayscale">
                    <MonitorSmartphone size={80} strokeWidth={1} />
                    <span className="font-black text-[11px] uppercase tracking-widest text-center px-16 leading-relaxed">
                      Select items or scan barcode<br />to start a new transaction
                    </span>
                  </div>
                ) : (
                  billItems.map((item, idx) => (
                    <div key={item.id} className="so-bill-item">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-6">
                          <h4 className="so-bill-item-name">{item.name}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-black text-slate-400">AED {item.price}</span>
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                              <button onClick={() => toggleUom(item.id, 'Piece')} className={`px-2.5 py-1 text-[9px] font-black transition-all ${item.uom === 'Piece' ? (isGreen ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white') : 'bg-white text-slate-400 hover:bg-slate-50'}`}>PC</button>
                              <button onClick={() => toggleUom(item.id, 'Box')} disabled={!item.custom_pieces_per_box} className={`px-2.5 py-1 text-[9px] font-black transition-all ${item.uom === 'Box' ? (isGreen ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white') : 'bg-white text-slate-400 hover:bg-slate-50'} disabled:opacity-30`}>BOX</button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="so-bill-qty-control shadow-sm">
                            <button onClick={() => updateQuantity(item.id, -1)} className="so-bill-qty-btn">
                              {item.qty > 1 ? <RefreshCw size={11} className="opacity-40" /> : <X size={11} className="text-rose-400" />}
                            </button>
                            <input
                              id={`qty-input-${idx}`}
                              className="so-bill-qty-input"
                              value={item.qty}
                              onChange={(e) => setQuantity(item.id, e.target.value)}
                            />
                            <button onClick={() => updateQuantity(item.id, 1)} className="so-bill-qty-btn text-emerald-500">+</button>
                          </div>
                        </div>
                        <button onClick={() => removeFromBill(item.id)} className="so-bill-remove ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-50">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Item Total</span>
                        <span className="text-[13px] font-black text-slate-800">AED {(item.qty * (item.uom === 'Box' ? (item.price * (item.custom_pieces_per_box || 1)) : item.price)).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="so-bill-footer">
                <div className="so-total-box">
                  <div className="so-total-row">
                    <span>Subtotal</span>
                    <span>AED {displaySubtotal.toFixed(2)}</span>
                  </div>
                  {displayDiscount > 0 && (
                    <div className="so-total-row" style={{ color: 'var(--so-danger)' }}>
                      <span>Discount</span>
                      <span>-AED {displayDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="so-total-row">
                    <span>Tax ({taxRate}%)</span>
                    <span>AED {displayTax.toFixed(2)}</span>
                  </div>

                  <div className="so-grand-total">
                    <span className="text-[0.6em] font-black uppercase tracking-widest opacity-40">TOTAL</span>
                    <span>AED {grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="so-btn-secondary flex-1"
                  >
                    <Palette size={14} /> % Discount
                  </button>
                  <button
                    onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }}
                    className="so-btn-secondary flex-1"
                    style={{ color: 'var(--so-danger)', borderColor: '#fecaca' }}
                  >
                    <Trash2 size={14} /> Reset
                  </button>
                </div>

                <button
                  className="so-btn-pay"
                  disabled={grandTotal <= 0}
                  onClick={handleCheckout}
                >
                  <CreditCard size={18} /> Confirm & Pay (Space)
                </button>
              </div>
            </aside>
          </main>
        </div>
      )}

      {/* MODALS */}
      {showDiscountModal && (
        <div className="home-modal-overlay" onClick={() => setShowDiscountModal(false)}>
          <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="home-modal-header text-center">
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Apply Discount</h3>
            </div>
            <div className="home-modal-body">
              <div className="home-discount-toggle">
                <button
                  className={`home-discount-type-btn ${discount.type === 'amount' ? 'active' : ''}`}
                  onClick={() => setDiscount({ ...discount, type: 'amount' })}
                >
                  <DollarSign size={16} /> Amount
                </button>
                <button
                  className={`home-discount-type-btn ${discount.type === 'percent' ? 'active' : ''}`}
                  onClick={() => setDiscount({ ...discount, type: 'percent' })}
                >
                  <Palette size={16} /> Percent
                </button>
              </div>

              <input
                type="number"
                placeholder={discount.type === 'percent' ? 'Enter %' : 'Enter AED'}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                className="so-customer-input text-center text-2xl h-16"
                min="0"
              />
            </div>
            <div className="home-modal-footer">
              <button className="so-btn-secondary flex-1" onClick={() => setShowDiscountModal(false)}>Cancel</button>
              {discount.value > 0 && (
                <button className="so-btn-secondary flex-1" style={{ color: 'var(--so-danger)', borderColor: '#fee2e2' }} onClick={clearDiscount}>Remove</button>
              )}
              <button className="so-btn-primary flex-[2]" onClick={applyDiscountHandler}>Apply Discount</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="home-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="home-modal-header">
              <h3 className="text-xl font-black uppercase tracking-tight">New Customer Profile</h3>
            </div>
            <div className="home-modal-body">
              <div className="form-group">
                <label>Customer Full Name *</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="so-customer-input" placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label>Phone / Mobile *</label>
                <input type="tel" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} className="so-customer-input" placeholder="+971 -- --- ----" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Primary Email</label>
                  <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="so-customer-input" placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>Branch Location</label>
                  <input type="text" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} className="so-customer-input" placeholder="Optional" />
                </div>
              </div>
            </div>
            <div className="home-modal-footer">
              <button className="so-btn-secondary flex-1" onClick={() => setShowCreateModal(false)}>Discard</button>
              <button className="so-btn-primary flex-[2]" onClick={createCustomer} disabled={creatingCustomer}>
                {creatingCustomer ? 'Saving Data...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && renderPaymentModal()}

      {showOpeningModal && (
        <div className="home-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="home-modal" style={{ maxWidth: '1100px', maxHeight: '95vh', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="home-modal-header flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">Open New POS Session</h3>
              <button className="p-2 text-slate-400 hover:text-rose-500" onClick={handleLogout}><X size={24} /></button>
            </div>
            <div className="home-modal-body p-0 overflow-auto" style={{ maxHeight: 'calc(95vh - 84px)' }}>
              <OpeningEntryPage onOpeningEntrySuccess={handleOpeningSuccess} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;

