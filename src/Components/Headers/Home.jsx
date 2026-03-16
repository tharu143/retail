import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, X, Search, UserPlus,
  Loader2, CreditCard, Phone, DollarSign, Trash2, Info
} from 'lucide-react';
import { logout } from '../../Redux/Slices/userSlice';
import './Home.css';
import './LegacyPOS.css';
import OpeningEntryPage from '../../Pages/OpeningEntryPage';
import { db } from '../../db';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';
import POSService from '../../utils/posService';

// ---------- Frappe-style rounding Utilities (Outside for stability) ----------
const flt = (num, prec = 6) => {
  const factor = Math.pow(10, prec);
  return Math.round((num + Number.EPSILON) * factor) / factor;
};
const round2 = (num) => flt(num, 2);

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
  const loading = useSelector((state) => state.user.loading || false);

  const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [sessionOrderCount, setSessionOrderCount] = useState(1);

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
  const [lastInteractedItem, setLastInteractedItem] = useState(null);

  // ---------- Auth ----------
  useEffect(() => {
    if (!user || !session) {
      navigate('/');
      return;
    }
    if (!posOpeningEntry) setShowOpeningModal(true);
  }, [user, session, posOpeningEntry, navigate]);

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
      return sum + flt(itemPrice * item.qty);
    }, 0)
    , [billItems]);

  const discountAmount = useMemo(() => {
    if (discount.value <= 0) return 0;
    const amt = discount.type === 'percent'
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
      if (searchTerm.length < 2 || searchTerm === 'Cash') {
        setSearchResults([]); setShowDropdown(false); return;
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target)) setShowItemDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // NEW: Item search logic for barcode input
  useEffect(() => {
    const query = barcodeInput.trim().toLowerCase();
    if (query.length === 0 && (searchContext === 'inline' || searchContext === 'header')) {
      // Show top 10 items if empty (only when active)
      if (showItemDropdown) {
        setItemSearchResults(Items.slice(0, 10));
      } else {
        setItemSearchResults([]);
      }
      setActiveItemIndex(-1);
    } else if (query.length >= 1) {
      const results = Items.filter(it =>
        (it.name || "").toLowerCase().includes(query) ||
        (it.id || "").toLowerCase().includes(query) ||
        (it.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(query))
      ).slice(0, 12);
      setItemSearchResults(results);
      setShowItemDropdown(results.length > 0);
    } else {
      setItemSearchResults([]);
      setShowItemDropdown(false);
      setActiveItemIndex(-1);
    }
  }, [barcodeInput, Items, searchContext, showItemDropdown]);

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

      let url = `custom_retailpos.custom_retailpos.retail_api.retail.get_item_details?warehouse=${encodeURIComponent(warehouse)}`;

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

      const baseUrl = window.location.protocol === 'file:' ? 'http://75.119.130.59' : '';
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
      const results = await frappeCall({
        method: 'kyle_retail.retail_api.api.get_retail_item_details',
        args: { search_term: barcode.trim(), warehouse: warehouse }
      });
      const apiItem = (results || [])[0];

      if (apiItem) {
        const pendingInvoices = await db.invoices.where('is_synced').equals(0).toArray();
        let pendingQty = 0;
        pendingInvoices.forEach(inv => {
          (inv.items || []).forEach(it => {
            if (it.item_code === apiItem.name) {
              const qtyPieces = it.uom === 'Box' ? it.qty * (it.custom_pieces_per_box || 1) : it.qty;
              pendingQty += qtyPieces;
            }
          });
        });

        const itemToBill = {
          id: apiItem.name,
          name: apiItem.item_name,
          price: apiItem.price_list_rate || 0,
          actual_qty: apiItem.actual_qty || 0,
          local_qty: (apiItem.actual_qty || 0) - pendingQty,
          warehouse_details: apiItem.warehouse_details || [],
          custom_pieces_per_box: apiItem.custom_pieces_per_box || 1
        };

        if (itemToBill.local_qty <= 0) {
          try {
            Swal.fire({ title: 'Checking Nearby Stock...', didOpen: () => Swal.showLoading() });
            const nearest = await frappeCall({
              method: 'kyle_retail.retail_api.api.find_nearest_stock',
              args: { item_code: itemToBill.id, current_warehouse: warehouse }
            });
            // Update itemToBill with the latest proximity data
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
        // Fallback to local search if API fails to find it (for offline support)
        const foundLocal = Items.find(item =>
          item.barcodes?.some(b => b.barcode === barcode.trim())
        );

        if (foundLocal) {
          handleAddToBill(foundLocal);
          setBarcodeInput('');
        } else {
          Swal.fire('Not Found', 'Item not found in database.', 'error');
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
    if (e.key === 'ArrowDown' && showItemDropdown) {
      e.preventDefault();
      setActiveItemIndex(prev => Math.min(prev + 1, itemSearchResults.length - 1));
    } else if (e.key === 'ArrowUp' && showItemDropdown) {
      e.preventDefault();
      setActiveItemIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeItemIndex >= 0 && itemSearchResults[activeItemIndex]) {
        handleAddToBill(itemSearchResults[activeItemIndex]);
        setBarcodeInput('');
        setShowItemDropdown(false);
        setActiveItemIndex(-1);
        if (theme === 'legacy') {
          setTimeout(() => {
            const targetId = searchContext === 'header' ? 'legacy-header-search' : 'legacy-inline-search';
            document.getElementById(targetId)?.focus();
          }, 10);
        } else {
          barcodeInputRef.current?.focus();
        }
      } else {
        handleBarcodeScan(barcodeInput);
      }
    } else if (e.key === 'Escape') {
      setShowItemDropdown(false);
      setActiveItemIndex(-1);
    }
  };

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
      Swal.fire('No Data', 'No warehouse breakdown available.', 'info');
      return;
    }

    const html = `
        <div style="text-align: left; padding: 10px; max-height: 400px; overflow-y: auto;">
             <div style="display: flex; justify-content: space-between; font-weight: 800; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px;">
                <span>Branch / Warehouse</span>
                <span>Stock / Action</span>
            </div>
            ${details.map(d => {
      const qty = parseFloat(d.actual_qty);
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
        const newQty = Math.max(1, i.qty + delta);
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

  // Category slider
  const groupCategories = (cats, size) => {
    const groups = [];
    for (let i = 0; i < cats.length; i += size) groups.push(cats.slice(i, i + size));
    return groups;
  };
  const groupedCategories = groupCategories(categories, 4);
  const handlePrevSlide = () => setCurrentSlide(prev => (prev === 0 ? groupedCategories.length - 1 : prev - 1));
  const handleNextSlide = () => setCurrentSlide(prev => (prev === groupedCategories.length - 1 ? 0 : prev + 1));

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
            Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name}` });
          }
        } catch (err) {
          console.error("Customer lookup failed", err);
          Swal.fire('Error', 'Customer lookup failed or offline.', 'error');
        } finally {
          setCustomerLoading(false);
        }
      }
    }
  };


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
            } catch (e) {}
            
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

  const changeDue = tenderedAmount - grandTotal;

  // ---------- RENDER ----------
  return (
    <div className={`home-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      {theme === 'legacy' && (
        <div className="legacy-grid-header">
          <div className="legacy-info-panel">
            <div style={{ color: '#000' }}>Staff: <span style={{ color: '#0000cd' }}>{typeof user === 'object' ? (user?.full_name || user?.name) : (user || 'User')}</span></div>
            <div>Order No.: <span style={{ color: '#0000cd' }}>{sessionOrderCount}</span></div>
            <div>Date: <span style={{ color: '#0000cd' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
          </div>

          <div className="legacy-search-panel">
            <div className="legacy-search-row">
              <span className="legacy-search-label">Product :</span>
                <input 
                  type="text" 
                  className="legacy-search-input" 
                  value={barcodeInput} 
                  onChange={(e) => { setBarcodeInput(e.target.value); setSearchContext('header'); }}
                  onKeyDown={onBarcodeKeyDown}
                  onFocus={() => { setSearchContext('header'); setShowItemDropdown(true); }}
                  placeholder="Scan or type..."
                  id="legacy-header-search"
                />
                {showItemDropdown && theme === 'legacy' && searchContext === 'header' && (
                  <div 
                    ref={itemDropdownRef} 
                    className="legacy-customer-dropdown" 
                    style={{ top: '85px', left: '100px', width: '300px', zIndex: 9999 }}
                  >
                    {itemSearchResults.map((it, idx) => (
                      <div 
                        key={it.id} 
                        className={`legacy-dropdown-item ${activeItemIndex === idx ? 'active' : ''}`}
                        onClick={() => { handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); document.getElementById('legacy-header-search')?.focus(); }}
                      >
                        <div className="cust-name">{it.name}</div>
                        <div className="cust-phone">Code: {it.id} | Price: {it.price} | Stock: {it.local_qty}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            <div className="legacy-search-row">
              <span className="legacy-search-label">Customer :</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <input 
                  ref={mobileInputRef}
                  type="text" 
                  className="legacy-search-input" 
                  value={customerMobile || customerName}
                  onChange={e => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      setCustomerMobile(val);
                      setCustomerName(''); // Clear name when searching by mobile
                    } else {
                      setCustomerName(val);
                      setCustomerMobile(''); // Clear mobile when searching by name
                    }
                  }}
                   onFocus={() => {
                    const term = (customerMobile || customerName).trim();
                    if (term.length >= 2 && term !== 'Cash') {
                      setShowDropdown(true);
                    }
                  }}
                  onKeyDown={handleMobileEnter}
                  autoComplete="off"
                  placeholder="Mobile or Name..."
                  style={{ paddingRight: '25px' }}
                />
                <Phone size={12} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />
                
                {showDropdown && theme === 'legacy' && (
                  <div className="legacy-customer-dropdown">
                    {searchLoading ? (
                      <div className="legacy-dropdown-item loading">
                        <Loader2 size={14} className="animate-spin" /> Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="legacy-dropdown-item empty">No customers found</div>
                    ) : (
                      searchResults.map(c => (
                        <div key={c.name} className="legacy-dropdown-item" onClick={() => pickCustomer(c)}>
                          <div className="cust-name">{c.customer_name}</div>
                          {c.mobile_no && <div className="cust-phone">{c.mobile_no}</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => {
                  if ((customerMobile || customerName).length >= 2) {
                    setShowDropdown(!showDropdown);
                  }
                }} 
                className="legacy-search-btn"
              >
                Search
              </button>
            </div>

            {/* PRODUCT DROPDOWN FOR LEGACY */}
            {showItemDropdown && theme === 'legacy' && (
              <div 
                ref={itemDropdownRef} 
                className="legacy-customer-dropdown" 
                style={{ top: '85px', left: '100px', width: '300px', zIndex: 9999 }}
              >
                {itemSearchResults.map((it, idx) => (
                  <div 
                    key={it.id} 
                    className={`legacy-dropdown-item ${activeItemIndex === idx ? 'active' : ''}`}
                    style={activeItemIndex === idx ? { backgroundColor: '#000080', color: '#fff' } : {}}
                    onClick={() => { handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); barcodeInputRef.current?.focus(); }}
                  >
                    <div className="cust-name">{it.name}</div>
                    <div className="cust-phone">Code: {it.id} | Price: {it.price} | Stock: {it.local_qty}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="legacy-total-panel">
            <span className="legacy-total-label">Total :</span>
            <span className="legacy-total-value">{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="home-content">
        <div className="home-layout">
          <div className="home-main-section">
            {theme !== 'legacy' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-xl border border-sky-100">
                    <kbd className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px] font-black text-sky-600 border border-sky-200">F2</kbd>
                    <span className="text-[10px] font-black text-sky-900 uppercase tracking-tight">Customer</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-xl border border-sky-100">
                    <kbd className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px] font-black text-sky-600 border border-sky-200">F4</kbd>
                    <span className="text-[10px] font-black text-sky-900 uppercase tracking-tight">Search</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-xl border border-sky-100">
                    <kbd className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px] font-black text-sky-600 border border-sky-200">Space</kbd>
                    <span className="text-[10px] font-black text-sky-900 uppercase tracking-tight">Pay</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100">
                    <kbd className="bg-white px-2 py-0.5 rounded shadow-sm text-[10px] font-black text-amber-600 border border-amber-200">Esc</kbd>
                    <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight">Clear</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isOffline ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isOffline ? 'OFFLINE' : 'ONLINE'}
                    </span>
                  </div>
                  <div className="h-4 w-[1px] bg-slate-200"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{branchPrefix || 'DXB'} Branch</span>
                  </div>
                </div>
              </div>
            )}
                {/* Removed pending sync text from Home as per request */}
            {/* Category Slider - HIDDEN IN LEGACY */}
            {theme !== 'legacy' && (
              <div className="home-category-sidebar">
                <div className="home-carousel-container">
                  {groupedCategories.length > 1 && (
                    <button className="home-carousel-arrow home-carousel-arrow-left" onClick={handlePrevSlide}>
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <div className="home-carousel-slides">
                    <div className="home-carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                      {groupedCategories.map((group, i) => (
                          <div key={i} className="home-category-slide">
                            <div className="home-category-grid">
                              {group.map(cat => (
                                <button key={cat} className={`home-category-btn ${selectedCategory === cat ? "home-category-btn-active" : ""}`} onClick={() => handleFilter(cat)}>
                                  <span className="home-category-text" data-index={categories.indexOf(cat) + 1}>
                                    {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                  {groupedCategories.length > 1 && (
                    <button className="home-carousel-arrow home-carousel-arrow-right" onClick={handleNextSlide}>
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* Products Grid - HIDDEN IN LEGACY */}
            {theme !== 'legacy' && (
              <div className="home-items-container">
                <div className="home-items-grid">
                  {filteredItems.length === 0 ? (
                    <p className="home-no-items">No items in this category</p>
                  ) : (
                    filteredItems.map(item => (
                      <div key={item.id} className="home-item-wrapper" onClick={() => { setLastInteractedItem(item); item.local_qty > 0 && handleAddToBill(item); }}>
                        <div className="home-item-card" style={{ opacity: item.local_qty > 0 ? 1 : 0.6, cursor: item.local_qty > 0 ? 'pointer' : 'not-allowed' }}>
                            <div className="home-item-image-box">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="home-item-image"
                                  onError={e => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                className="home-item-placeholder"
                                style={{
                                  display: item.image ? 'none' : 'flex',
                                  width: '100%',
                                  height: '100%',
                                  backgroundColor: '#f1f5f9',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#94a3b8',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  textAlign: 'center',
                                  padding: '10px'
                                }}
                              >
                                {item.name}
                              </div>
                            </div>
                            <div className="home-item-body">
                              <h4 className="home-item-title">{item.name}</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <p className="home-item-price" style={{ margin: 0 }}><strong>AED</strong> {item.price}</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }} onClick={() => setLastInteractedItem(item)}>
                                  <span style={{ fontSize: '0.65rem', color: item.local_qty > 0 ? '#10b981' : (item.total_qty > 0 ? '#f59e0b' : '#ef4444'), background: item.local_qty > 0 ? 'rgba(16, 185, 129, 0.1)' : (item.total_qty > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'), padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                    {item.local_qty > 0 ? 'IN STOCK' : (item.total_qty > 0 ? 'NEARBY' : 'OUT STOCK')}: {item.local_qty}
                                  </span>
                                  {item.local_qty <= 0 && (
                                    <button onClick={(e) => { e.stopPropagation(); handleFindNearestStock(item); }} style={{ fontSize: '0.65rem', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid #6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}>
                                      Find Stock
                                    </button>
                                  )}
                                  <span style={{
                                    fontSize: '0.65rem',
                                    color: '#6366f1',
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }} onClick={(e) => { e.stopPropagation(); showStockBreakdown(item); }} title="Click to view all branches">
                                    Total: {item.total_qty}
                                    <Search size={10} />
                                  </span>
                                </div>
                                {item.local_qty <= 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); showStockBreakdown(item); }}
                                    style={{ marginTop: '8px', width: '100%', padding: '4px', fontSize: '0.75rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  >
                                    Stock Breakdown
                                  </button>
                                )}
                                {user?.role_profile === 'Retail Manager' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openPurchaseTools(item); }}
                                    style={{ marginTop: '4px', width: '100%', padding: '4px', fontSize: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  >
                                    Purchase Tools
                                  </button>
                                )}
                              </div>
                            </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* HORIZONTAL BILL SECTION (Legacy: Below Items) */}
            {theme === 'legacy' && (
              <div className="home-bill-section">
                <div className="legacy-bill-header">
                  <span>SI No</span>
                  <span>Description</span>
                  <span>Qty</span>
                  <span>UOM</span>
                  <span>Amount</span>
                  <span>Action</span>
                </div>
                <div className="home-bill-items">
                  {billItems.length === 0 ? (
                    <p className="home-bill-empty">No items added</p>
                  ) : (
                    <ul className="home-bill-item-list">
                      {billItems.map((item, idx) => (
                        <li key={item.id} className="home-bill-item-row">
                          <span className="box-cell">{idx + 1}</span>
                          <span className="box-cell name-cell" title={item.name}>{item.name}</span>
                          <div className="box-cell qty-cell">
                            <button className="legacy-qty-btn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                            <input 
                              type="number"
                              className="legacy-qty-input"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val)) {
                                  updateQuantity(item.id, val - item.qty);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                            />
                            <button className="legacy-qty-btn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                          </div>
                          <span className="box-cell uom-cell" onClick={() => toggleUom(item.id, item.uom === 'Piece' ? 'Box' : 'Piece')} style={{ cursor: 'pointer', color: '#2563eb', fontWeight: '800' }}>
                            {item.uom || 'Piece'}
                          </span>
                          <span className="box-cell amount-cell">{(item.qty * item.price).toFixed(2)}</span>
                          <div className="box-cell action-cell">
                            <button 
                              className="legacy-remove-btn" 
                              onClick={(e) => { e.stopPropagation(); removeFromBill(item.id); }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </li>
                      ))}
                      
                      {/* INTEGRATED SEARCH ROW INSIDE THE BOX */}
                      <li className="home-bill-item-row legacy-inline-search-row" style={{ backgroundColor: '#fffbe6', border: '2px solid #ffe58f' }}>
                        <span className="box-cell text-[#8c8c8c] font-bold">NEXT</span>
                        <div className="box-cell name-cell" style={{ position: 'relative', padding: 0 }}>
                           <input 
                             type="text"
                             id="legacy-inline-search"
                             className="w-full h-full px-2 font-bold text-xs outline-none border-none bg-transparent"
                             placeholder="TYPE ITEM NAME OR BARCODE TO ADD..."
                             value={barcodeInput}
                             onChange={(e) => { setBarcodeInput(e.target.value); setSearchContext('inline'); setShowItemDropdown(true); }}
                             onFocus={() => { setSearchContext('inline'); setShowItemDropdown(true); }}
                             onKeyDown={onBarcodeKeyDown}
                           />
                           {showItemDropdown && searchContext === 'inline' && (
                              <div 
                                className="legacy-customer-dropdown" 
                                style={{ top: '100%', left: 0, width: '100%', minWidth: '400px', zIndex: 10000, border: '2px solid #000080' }}
                              >
                                {itemSearchResults.map((it, idx) => (
                                  <div 
                                    key={it.id} 
                                    className={`legacy-dropdown-item ${activeItemIndex === idx ? 'active' : ''}`}
                                    onClick={() => { handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); document.getElementById('legacy-inline-search')?.focus(); }}
                                  >
                                    <div className="cust-name" style={{ color: activeItemIndex === idx ? '#fff' : '#000080' }}>{it.name}</div>
                                    <div className="cust-phone">Code: {it.id} | Price: {it.price} | Stock: {it.local_qty}</div>
                                  </div>
                                ))}
                              </div>
                           )}
                        </div>
                        <span className="box-cell qty-cell">-</span>
                        <span className="box-cell uom-cell">-</span>
                        <span className="box-cell amount-cell">-</span>
                        <div className="box-cell action-cell">
                           <Search size={14} className="text-[#bfbfbf]" />
                        </div>
                      </li>
                    </ul>
                  )}
                </div>
                <div className="legacy-numpad-area">
                  <div className="legacy-details-panel">
                    <div className="legacy-detail-row"><span>Subtotal:</span><span>{displaySubtotal.toFixed(2)}</span></div>
                    <div className="legacy-detail-row" style={{ alignItems: 'center' }}>
                      <span>Discount:</span>
                      <button 
                        onClick={() => setShowDiscountModal(true)}
                        style={{
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#2563eb'
                        }}
                      >
                        {discount.value > 0 ? `${discount.type === 'percent' ? `${discount.value}%` : `AED ${discount.value}`} ` : 'Add'} ({discountAmount.toFixed(2)})
                      </button>
                    </div>
                    <div className="legacy-detail-row"><span>VAT ({taxRate}%):</span><span>{displayTax.toFixed(2)}</span></div>
                    <div className="legacy-detail-row total"><span>To Pay:</span><span>{grandTotal.toFixed(2)}</span></div>
                  </div>
                  <div className="legacy-pay-group">
                    <button className="legacy-mode-btn pay" onClick={handleCheckout} style={{ gridColumn: 'span 2' }}>PAY</button>
                    <button className="legacy-mode-btn discount" onClick={() => setShowDiscountModal(true)} style={{ backgroundColor: '#8b5cf6' }}>DISCOUNT</button>
                    <button className="legacy-mode-btn clear" onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }} style={{ backgroundColor: '#64748b' }}>CLEAR BILL</button>
                    <button className="legacy-mode-btn close" onClick={closingEntry} style={{ gridColumn: 'span 2' }}>CLOSE</button>
                  </div>
                </div>
              </div>
            )}

          {/* RIGHT: MODERN BILL SECTION (Hidden in Legacy) */}
          {theme !== 'legacy' && (
            <div className="home-bill-section">
              {/* SPEED CHECKOUT - MOBILE NUMBER */}
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <input
                  ref={mobileInputRef}
                  type="tel"
                  placeholder="Mobile Number + Enter (Speed Checkout)"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  onKeyDown={handleMobileEnter}
                  className="home-customer-input"
                  style={{
                    background: 'linear-gradient(to right, #e1f4ff, #ffffff)',
                    border: '2px solid #3b82f6',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                />
                {customerLoading ? (
                  <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />
                ) : (
                  <Phone size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6' }} />
                )}
              </div>

              {/* BARCODE SCANNER INPUT - PROMINENT STYLE */}
              <div className="relative mb-3 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-sky-400 group-focus-within:text-sky-600 transition-colors" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="SCAN / TYPE PRODUCT NAME OR BARCODE..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={onBarcodeKeyDown}
                  className="w-full pl-12 pr-12 py-4 bg-sky-50/50 border-2 border-sky-100 rounded-2xl text-sm font-black text-sky-900 placeholder:text-sky-300 focus:bg-white focus:border-sky-500 outline-none shadow-sm transition-all"
                />
                {searchLoading && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <Loader2 size={18} className="animate-spin text-sky-500" />
                  </div>
                )}

                {/* Item Search Dropdown */}
                {showItemDropdown && (
                  <div ref={itemDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '300px', overflowY: 'auto', zIndex: 20, marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                    {itemSearchResults.map(it => (
                      <div key={it.id} onClick={() => { handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                        {it.image ? <img src={it.image.startsWith('http') ? it.image : `http://75.119.130.59${it.image}`} alt={it.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} /> : <div style={{ width: '32px', height: '32px', backgroundColor: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>No img</div>}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{it.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Code: {it.id} | Stock: {it.local_qty}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>AED {it.price}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CUSTOMER SELECTION - PREMIUM STYLE */}
              <div className="relative group mb-3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserPlus size={18} className="text-slate-400 group-focus-within:text-sky-600 transition-colors" />
                </div>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="CUSTOMER NAME (TYPE TO SEARCH...)"
                  value={customerName}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 outline-none shadow-sm transition-all"
                  onChange={e => { setCustomerName(e.target.value); if (e.target.value.trim() !== 'Cash') setSelectedCustomer(null); }}
                  onFocus={() => { if (customerName.trim() === 'Cash') nameInputRef.current?.select(); customerName.trim().length >= 2 && setShowDropdown(true); }}
                  onKeyDown={e => { if (e.key === 'Enter' && customerName.trim()) { const existing = searchResults.find(c => c.customer_name.toLowerCase() === customerName.trim().toLowerCase()); if (existing) pickCustomer(existing); else if (customerName.trim().length >= 2) openCreate(); } }}
                  autoComplete="off"
                />
                {searchLoading && <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />}
                {showDropdown && (
                  <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {searchResults.length === 0 ? <div style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>{customerName.trim().length < 2 ? 'Type 2+ chars' : 'No customers found'}</div> : searchResults.map(c => (
                      <div key={c.name} onClick={() => pickCustomer(c)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                        <div><div style={{ fontWeight: 600 }}>{c.customer_name}</div>{c.mobile_no && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.mobile_no}</div>}</div>
                        <Search size={16} style={{ color: '#94a3b8' }} />
                      </div>
                    ))}
                    {searchResults.every(c => c.customer_name.toLowerCase() !== customerName.trim().toLowerCase()) && <div onClick={openCreate} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: '#eef2ff', color: '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={18} /> Create "{customerName.trim()}"</div>}
                  </div>
                )}
              </div>
              <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="home-customer-input" />

              {/* Bill Items */}
              <div className="home-bill-items">
                {billItems.length === 0 ? (
                  <p className="home-bill-empty">No items added yet</p>
                ) : (
                  <ul className="home-bill-item-list">
                    {billItems.map(item => (
                      <li key={item.id} className="home-bill-item-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="home-bill-item-info">
                            <span className="home-bill-item-name">{item.name}</span>
                            <span className="home-bill-item-price"><strong>AED</strong> {item.uom === 'Box' ? (item.price * (item.custom_pieces_per_box || 1)) : item.price} × {item.qty} Pc</span>
                          </div>
                          <div className="home-bill-item-actions">
                            <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, -1); }}>-</button>
                            <span className="home-bill-qty">{item.qty}</span>
                            <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, 1); }}>+</button>
                            <button className="home-bill-remove-btn" onClick={e => { e.stopPropagation(); removeFromBill(item.id); }}><X size={14} /></button>
                          </div>
                        </div>
                        {/* PIECE VS BOX TOGGLE */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => toggleUom(item.id, 'Piece')} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #3b82f6', background: item.uom === 'Piece' ? '#3b82f6' : '#fff', color: item.uom === 'Piece' ? '#fff' : '#3b82f6' }}>Piece</button>
                          <button onClick={() => toggleUom(item.id, 'Box')} disabled={!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #8b5cf6', background: item.uom === 'Box' ? '#8b5cf6' : '#fff', color: item.uom === 'Box' ? '#fff' : '#8b5cf6', opacity: (!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1) ? 0.5 : 1 }}>Box ({item.custom_pieces_per_box || 1})</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Summary */}
              <div className="home-bill-summary">
                <div className="home-bill-summary-row"><span>Subtotal</span><span><strong>AED</strong> {displaySubtotal.toFixed(2)}</span></div>
                {discount.value > 0 && <div className="home-bill-summary-row home-bill-discount"><span>Discount {discount.type === 'percent' ? `(${discount.value}%)` : ''}</span><span>-<strong>AED</strong> {displayDiscount.toFixed(2)}</span></div>}
                <div className="home-bill-summary-row"><span>Tax ({taxRate}%)</span><span><strong>AED</strong> {displayTax.toFixed(2)}</span></div>
                <div className="home-bill-summary-row home-bill-grand-total"><span>Grand Total</span><span><strong>AED</strong> {grandTotal.toFixed(2)}</span></div>
              </div>

              {/* Buttons */}
              <div className="container-fluid">
                <div className="row">
                  <div className="col-12">
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
                      <button className="home-bill-discount-btn" onClick={() => setShowDiscountModal(true)}>{discount.value > 0 ? `Edit (${discount.type === 'percent' ? `${discount.value}%` : `AED ${discount.value}`})` : 'Add Discount'}</button>
                      {grandTotal > 0 && <button className="home-bill-pay-btn" onClick={handleCheckout}>Pay</button>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                      {billItems.length > 0 && <button className="home-bill-clear-btn" onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }}>Clear Bill</button>}
                      <button className="home-bill-clear-btn" onClick={closingEntry} style={{ backgroundColor: '#26abff' }}>Closing</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div> {/* close home-layout */}
      </div> {/* close home-content */}

      {/* ---------- MODALS ---------- */}
        {showDiscountModal && (
          <div className="home-modal-overlay" onClick={() => setShowDiscountModal(false)}>
            <div className="home-modal" onClick={e => e.stopPropagation()}>
              <div className="home-modal-header">
                <h3>Apply Discount</h3>
                <button className="home-modal-close" onClick={() => setShowDiscountModal(false)}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                <div className="home-discount-type">
                  <label><input type="radio" name="type" checked={discount.type === 'amount'} onChange={() => setDiscount({ ...discount, type: 'amount' })} /> Amount (AED)</label>
                  <label><input type="radio" name="type" checked={discount.type === 'percent'} onChange={() => setDiscount({ ...discount, type: 'percent' })} /> Percentage (%)</label>
                </div>
                <input
                  type="number"
                  placeholder={discount.type === 'percent' ? 'Enter %' : 'Enter AED'}
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  className="home-discount-input"
                  min="0"
                  step={discount.type === 'percent' ? '0.01' : '1'}
                />
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => setShowDiscountModal(false)}>Cancel</button>
                {discount.value > 0 && (
                  <button 
                    className="home-modal-cancel" 
                    onClick={clearDiscount}
                    style={{ backgroundColor: '#fee2e2', color: '#ef4444', borderColor: '#fecaca' }}
                  >
                    Remove Discount
                  </button>
                )}
                <button className="home-modal-apply" onClick={applyDiscountHandler}>Apply</button>
              </div>
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="home-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
              <div className="home-modal-header">
                <h3>Create New Customer</h3>
                <button className="home-modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                <input type="text" placeholder="Customer Name *" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="home-customer-input" style={{ marginBottom: '0.75rem' }} />
                <input type="tel" placeholder="Phone" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} className="home-customer-input" style={{ marginBottom: '0.75rem' }} />
                <input type="text" placeholder="Address (optional)" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} className="home-customer-input" style={{ marginBottom: '0.75rem' }} />
                <input type="email" placeholder="Email (optional)" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} className="home-customer-input" style={{ marginBottom: '0.75rem' }} />
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button
                  className="home-modal-apply"
                  onClick={createCustomer}
                  disabled={creatingCustomer}  // ← disables double click
                >
                  {creatingCustomer ? (
                    <>
                      <Loader2 size={18} className="animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    "Create Customer"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPaymentModal && (
          <div className="home-modal-overlay" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="home-modal-header">
                <h3>Payment Details</h3>
                <button className="home-modal-close" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}><X size={20} /></button>
              </div>
              
              <div className="home-modal-body">
                {/* Order Summary Summary */}
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

                {/* List of Payments */}
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

                {/* Add New Payment Mode */}
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
        )}

        {showOpeningModal && (
          <div className="home-modal-overlay" style={{ zIndex: 9999 }}>
            <div className="home-modal" style={{ maxWidth: '1100px', maxHeight: '95vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="home-modal-header">
                <h3>Open POS Shift</h3>
                <button className="home-modal-close" onClick={handleLogout}>X</button>
              </div>
              <div className="home-modal-body" style={{ padding: 0 }}>
                <OpeningEntryPage onOpeningEntrySuccess={handleOpeningSuccess} />
              </div>
            </div>
          </div>
        )}

        {showPurchaseModal && (
          <div className="home-modal-overlay" onClick={() => setShowPurchaseModal(false)}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="home-modal-header">
                <h3>Purchase Tools: {purchaseForm.item_code}</h3>
                <button className="home-modal-close" onClick={() => setShowPurchaseModal(false)}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Supplier</label>
                  <input type="text" placeholder="Enter Supplier Name" value={purchaseForm.supplier} onChange={e => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} className="home-customer-input" />

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', fontWeight: 700 }}>Purchase Rate (AED)</label>
                      <input type="number" value={purchaseForm.purchase_rate} onChange={e => updatePurchasePrice('purchase_rate', e.target.value)} className="home-customer-input" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '13px', fontWeight: 700 }}>Markup (%)</label>
                      <input type="number" value={purchaseForm.markup} onChange={e => updatePurchasePrice('markup', e.target.value)} className="home-customer-input" />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>Price Type:</span>
                      <span style={{ fontWeight: 700 }}>{purchaseForm.price_type}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '10px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
                        <input type="radio" checked={purchaseForm.price_type === 'Percentage'} onChange={() => updatePurchasePrice('price_type', 'Percentage')} /> Percentage
                      </label>
                      <label style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer', flex: 1 }}>
                        <input type="radio" checked={purchaseForm.price_type === 'Amount'} onChange={() => updatePurchasePrice('price_type', 'Amount')} /> Fixed Amount
                      </label>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', marginTop: '15px' }}>
                      <span style={{ fontWeight: 700 }}>Target Selling Price:</span>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>AED {purchaseForm.target_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
                <button className="home-modal-apply" onClick={handlePurchaseSubmit} style={{ background: '#10b981' }}>Submit Purchase</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default Home;

