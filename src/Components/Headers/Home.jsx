import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, X, Search, UserPlus,
  Loader2, CreditCard, Smartphone, DollarSign
} from 'lucide-react';
import { logout } from '../../Redux/Slices/userSlice';
import './Home.css';
import OpeningEntryPage from '../../Pages/OpeningEntryPage';
import { db } from '../../db';

function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
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

  // Sync effect
  useEffect(() => {
    const checkSyncCount = async () => {
      const count = await db.invoices.where('is_synced').equals(0).count();
      setPendingSyncCount(count);
    };
    checkSyncCount();
    const interval = setInterval(checkSyncCount, 10000);
    return () => clearInterval(interval);
  }, []);



  // NEW: Barcode scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);

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
    alert("Shift opened successfully!");
  };

  // ---------- Auth Fetch ----------
  const authFetch = useCallback(async (url, options = {}) => {
    if (isOffline && options.method && options.method !== 'GET') {
      throw new Error("You are currently offline. This action will be queued for sync.");
    }

    const fullUrl = url.startsWith('http') ? url : `/api/method/${url.startsWith('/') ? url.slice(1) : url}`;

    // Frappe handles authentication via cookies when credentials: 'include' is used.
    // Adding custom headers like X-Frappe-SID can trigger a CORS preflight (OPTIONS)
    // which might fail with 403 if the backend isn't configured to allow that custom header.
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
  }, [isOffline, dispatch, navigate]);

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

  const dropdownRef = useRef(null);
  const nameInputRef = useRef(null);

  // ---------- Frappe-style rounding ----------
  const flt = (num, prec = 6) => {
    const factor = Math.pow(10, prec);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  };
  const round2 = (num) => flt(num, 2);

  // ---------- CALCULATIONS ----------
  const subtotal = useMemo(() =>
    billItems.reduce((sum, item) => sum + flt(item.price * item.qty), 0)
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
    const tmpl = taxTemplates.find(t => t.name === selectedTaxTemplate);
    return tmpl?.sales_tax?.[0]?.rate || 0;
  }, [selectedTaxTemplate, taxTemplates]);

  const taxAmount = useMemo(() => flt(netTotal * (taxRate / 100)), [netTotal, taxRate]);

  const grandTotal = useMemo(() => round2(netTotal + taxAmount), [netTotal, taxAmount]);

  const displaySubtotal = round2(subtotal);
  const displayDiscount = round2(discountAmount);
  const displayTaxable = round2(netTotal);
  const displayTax = round2(taxAmount);

  // ---------- Update tendered amount for Cash ----------
  useEffect(() => {
    if (selectedPaymentMode === 'Cash') setTenderedAmount(grandTotal);
  }, [grandTotal, selectedPaymentMode]);

  // ---------- TAX FETCH (with offline cache) ----------
  useEffect(() => {
    const fetchTaxTemplates = async () => {
      try {
        const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_details');
        const data = await res.json();
        const templates = data.message || data || [];
        setTaxTemplates(templates);
        if (templates.length) setSelectedTaxTemplate(templates[0].name);

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
            setSelectedTaxTemplate(cached[0].name);
          }
        } catch (e) { console.error('Local tax cache also failed:', e); }
      }
    };
    fetchTaxTemplates();
  }, [authFetch]);

  // ---------- CUSTOMER SEARCH (with offline fallback) ----------
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerName.trim().length < 2) {
        setSearchResults([]); setShowDropdown(false); return;
      }
      setSearchLoading(true);
      try {
        if (isOffline) {
          // Search local Dexie customer cache
          const allCustomers = await db.customers.toArray();
          const query = customerName.trim().toLowerCase();
          const filtered = allCustomers.filter(c =>
            (c.customer_name || '').toLowerCase().includes(query) ||
            (c.name || '').toLowerCase().includes(query) ||
            (c.mobile_no || '').includes(query)
          );
          setSearchResults(filtered);
        } else {
          const res = await authFetch(
            `custom_retailpos.custom_retailpos.retail_api.retail.get_customers?search=${encodeURIComponent(customerName.trim())}`
          );
          const data = await res.json();
          const results = Array.isArray(data.message) ? data.message : [];
          setSearchResults(results);

          // Cache customers to Dexie for offline use
          for (const cust of results) {
            await db.customers.put(cust);
          }
        }
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); setShowDropdown(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, authFetch, isOffline]);

  // Click outside dropdown
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ---------- CUSTOMER HANDLERS ----------
  const openCreate = () => {
    setCreateForm({ name: customerName.trim(), phone: phoneNumber, address: '', email: '' });
    setShowCreateModal(true); setShowDropdown(false);
  };

  const pickCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.customer_name);
    setPhoneNumber(cust.mobile_no || '');
    setShowDropdown(false);
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

      if (inner.status === "success") {
        alert("Customer created successfully!");
        pickCustomer({
          name: inner.customer_id,
          customer_name: createForm.name.trim(),
          mobile_no: createForm.phone || "",
          primary_address: createForm.address || "",
          email_id: createForm.email || "",
        });
        setShowCreateModal(false);
        setCreateForm({ name: '', phone: '', address: '', email: '' });
      } else {
        alert(inner.message || "Failed to create customer");
      }
    } catch (err) {
      console.error(err);
      alert("Network error or server issue");
    } finally {
      setCreatingCustomer(false);  // ← Loading ends (always!)
    }
  };
  // ---------- FETCH ALL ITEMS ----------

  useEffect(() => {
    const fetchItems = async () => {
      if (!session) return;
      try {
        setLoadingItems(true); setError("");

        // Try online fetch first
        let apiItems = [];
        try {
          const response = await authFetch(`custom_retailpos.custom_retailpos.retail_api.retail.get_item_details?warehouse=${encodeURIComponent(warehouse)}`);
          const data = await response.json();
          apiItems = data.message || data;

          // Cache successful response in Dexie
          if (Array.isArray(apiItems)) {
            await db.items.clear();
            await db.items.bulkAdd(apiItems.map(item => ({
              id: item.name,
              name: item.item_name,
              image: item.image,
              group: (item.item_group || "others").toLowerCase(),
              price: item.price_list_rate || 0,
              actual_qty: item.actual_qty || 0,
              barcodes: item.barcodes || []
            })));
          }
        } catch (fetchErr) {
          console.warn("Online fetch failed, using local DB:", fetchErr);
          apiItems = await db.items.toArray();
          if (apiItems.length === 0) throw fetchErr;
        }

        const baseUrl = 'http://75.119.130.59';
        const transformed = apiItems.map(item => ({
          id: item.id || item.name,
          name: item.item_name || item.name,
          image: item.image ? (item.image.startsWith('http') ? item.image : `${baseUrl}${item.image}`) : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5OTk5IiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4KICAgIE5vIEltYWdlCiAgPC90ZXh0Pgo8L3N2Zz4=',
          group: (item.group || item.item_group || "others").toLowerCase(),
          price: item.price || item.price_list_rate || 0,
          actual_qty: item.actual_qty || 0,
          barcodes: item.barcodes || []
        }));

        const groups = [...new Set(transformed.map(i => i.group))];
        setCategories(["all", ...groups.sort()]);
        setItems(transformed);
        setFilteredItems(transformed);
      } catch (err) {
        setError(err.message || "Failed to load items. Check your internet connection.");
      } finally {
        setLoadingItems(false);
      }
    };
    fetchItems();
  }, [authFetch, session, warehouse]);




  // Filter items
  useEffect(() => {
    setFilteredItems(selectedCategory === "all"
      ? Items
      : Items.filter(i => i.group === selectedCategory.toLowerCase())
    );
  }, [selectedCategory, Items]);

  // ---------- BARCODE SCANNER HANDLER ----------
  const handleBarcodeScan = useCallback((barcode) => {
    if (!barcode.trim()) return;

    const foundItem = Items.find(item =>
      item.barcodes?.some(b => b.barcode === barcode.trim())
    );

    if (foundItem) {
      setBillItems(prev => {
        const existing = prev.find(i => i.id === foundItem.id);
        return existing
          ? prev.map(i => i.id === foundItem.id ? { ...i, qty: i.qty + 1 } : i)
          : [...prev, { ...foundItem, qty: 1 }];
      });

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
      // Red flash if not found
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#fee2e2';
        setTimeout(() => {
          if (barcodeInputRef.current) barcodeInputRef.current.style.backgroundColor = '';
        }, 400);
      }
    }
  }, [Items]);

  const onBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeScan(barcodeInput);
    }
  };

  // ---------- ITEM HANDLERS ----------
  const handleFilter = (cat) => setSelectedCategory(cat);
  const handleAddToBill = (item) => {
    setBillItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      return existing
        ? prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...item, qty: 1 }];
    });
  };
  const removeFromBill = (id) => setBillItems(prev => prev.filter(i => i.id !== id));
  const updateQuantity = (id, delta) => {
    setBillItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
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
    if (value > 0) setDiscount({ ...discount, value });
    setShowDiscountModal(false); setDiscountInput("");
  };

  // Checkout
  const handleCheckout = () => {
    if (grandTotal <= 0 || !posOpeningEntry) {
      alert(grandTotal <= 0 ? 'No items in bill' : 'Open a shift first');
      return;
    }
    setShowPaymentModal(true);
  };
  const selectPaymentMode = (mode) => {
    setSelectedPaymentMode(mode);
    setTenderedAmount(grandTotal);
  };

  // ---------- UPDATE LOCAL STOCK ----------
  const updateLocalStock = async (soldItems) => {
    try {
      // 1. Update Dexie DB
      for (const sold of soldItems) {
        const item = await db.items.get(sold.item_code);
        if (item) {
          const newQty = Math.max(0, (item.actual_qty || 0) - sold.quantity);
          await db.items.update(sold.item_code, { actual_qty: newQty });
        }
      }

      // 2. Update React State to reflect immediately
      setItems(prevItems =>
        prevItems.map(item => {
          const sold = soldItems.find(s => s.item_code === item.id);
          if (sold) {
            return { ...item, actual_qty: Math.max(0, (item.actual_qty || 0) - sold.quantity) };
          }
          return item;
        })
      );
    } catch (err) {
      console.error("Failed to update local stock:", err);
    }
  };

  // ---------- COMPLETE PAYMENT ----------
  const completePayment = async () => {
    if (!selectedPaymentMode) return;
    if (selectedPaymentMode === 'Cash' && tenderedAmount < grandTotal) {
      alert('Tendered amount insufficient'); return;
    }

    setPaymentLoading(true);
    const customer = selectedCustomer?.customer_name || customerName;
    if (!customer.trim()) { alert('Enter customer name'); setPaymentLoading(false); return; }

    const timestamp = Date.now();
    const offlineId = `${branchPrefix || 'POS'}-${timestamp}`;

    const payload = {
      offline_id: offlineId,
      customer,
      contact_mobile: phoneNumber,
      items: billItems.map(item => ({
        item_code: item.id,
        item_name: item.name,
        quantity: item.qty,
        basePrice: item.price,
        income_account: 'Sales of I/C - KSPL'
      })),
      company,
      pos_profile: posProfile,
      warehouse: warehouse,
      pos_opening_entry: posOpeningEntry,
      payments: [{
        mode_of_payment: selectedPaymentMode,
        amount: parseFloat(grandTotal.toFixed(2))
      }],
      discount_amount: discountAmount,
      apply_discount_on: "Net Total",
      tax_template: selectedTaxTemplate,
      posting_date: new Date().toISOString().slice(0, 10),
      currency: 'AED',
      due_date: new Date().toISOString().slice(0, 10)
    };

    try {
      if (isOffline) {
        // Save to Dexie
        await db.invoices.add({
          ...payload,
          is_synced: 0,
          grand_total: grandTotal
        });

        // Decrement local stock immediately for offline sales
        await updateLocalStock(payload.items);

        alert(`Offline Invoice Saved: ${offlineId}\nWill sync when online.`);
        finalizeOrder();
      } else {
        const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.create_pos_invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        const data = result.message || result;

        if (data.status === 'success' || (data.message && data.message.includes("Duplicate ignored"))) {
          // Decrement local stock for real-time UI update even when online
          await updateLocalStock(payload.items);

          alert(`Invoice: ${data.invoice_name || offlineId}\nTotal: AED ${grandTotal.toFixed(2)}`);
          finalizeOrder();
        } else {
          // Fallback to offline on server error too
          await db.invoices.add({ ...payload, is_synced: 0, grand_total: grandTotal });
          // Decrement local stock even if it failed but saved offline
          await updateLocalStock(payload.items);

          alert("Server error. Invoice saved offline for sync.");
          finalizeOrder();
        }
      }
    } catch (e) {
      await db.invoices.add({ ...payload, is_synced: 0, grand_total: grandTotal });
      // Decrement local stock for catch block too
      await updateLocalStock(payload.items);

      alert('Network issue. Invoice saved offline for sync.');
      finalizeOrder();
    } finally {
      setPaymentLoading(false);
    }
  };

  const finalizeOrder = () => {
    setBillItems([]);
    setDiscount({ type: 'amount', value: 0 });
    setCustomerName('Cash'); setSelectedCustomer(null); setPhoneNumber('');
    setSelectedPaymentMode(''); setTenderedAmount(0);
    setShowPaymentModal(false);
  };

  // Background sync logic
  useEffect(() => {
    if (isOffline) return;

    const syncPending = async () => {
      const pending = await db.invoices.where('is_synced').equals(0).toArray();
      if (pending.length === 0) return;

      let syncedCount = 0;
      for (const inv of pending) {
        try {
          const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_pos_invoice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              "Accept": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify(inv),
          });
          const data = await res.json();
          const result = data.message || data;

          if (result.status === 'success' || (result.message && result.message.includes("Duplicate ignored"))) {
            const now = new Date().toISOString();
            const serverName = result.invoice_name || result.name || inv.offline_id;

            await db.invoices.update(inv.id, {
              is_synced: 1,
              synced_at: now,
              server_name: serverName
            });

            // Log sync action for history
            await db.sync_log.add({
              offline_id: inv.offline_id,
              action: 'invoice_synced',
              timestamp: now,
              status: 'success',
              server_name: serverName
            });

            syncedCount++;
            console.log(`Synced offline invoice: ${inv.offline_id} → ${serverName}`);
          }
        } catch (e) {
          console.error(`Sync failed for ${inv.offline_id}:`, e);
          break;
        }
      }
      if (syncedCount > 0) {
        const remaining = await db.invoices.where('is_synced').equals(0).count();
        setPendingSyncCount(remaining);
      }
    };

    const interval = setInterval(syncPending, 15000);
    return () => clearInterval(interval);
  }, [isOffline, session]);

  const handleLogout = async () => {
    try { await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.user_logout', { method: "POST" }); }
    catch { }
    localStorage.clear(); dispatch(logout()); navigate('/');
  };
  const closingEntry = () => navigate('/closingentry');

  if (loadingItems) return <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Loading items...</p></div>;
  if (error) return <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}><p>{error}</p><button onClick={() => window.location.reload()}>Retry</button></div>;

  const changeDue = tenderedAmount - grandTotal;

  // ---------- RENDER ----------
  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-layout">

          {/* LEFT: MENU */}
          <div className="home-main-section">
            {/* Category Slider */}
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
                              <span className="home-category-text">
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

            {/* Items Grid */}
            <div className="home-items-container">
              <div className="home-items-grid">
                {filteredItems.length === 0 ? (
                  <p className="home-no-items">No items in this category</p>
                ) : (
                  filteredItems.map(item => (
                    <div key={item.id} className="home-item-wrapper" onClick={() => handleAddToBill(item)}>
                      <div className="home-item-card">
                        <div className="home-item-image-box">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="home-item-image"
                            onError={e => {
                              if (!e.target.dataset.errorResolved) {
                                e.target.dataset.errorResolved = true;
                                e.target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTk5OTk5IiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4KICAgIE5vIEltYWdlCiAgPC90ZXh0Pgo8L3N2Zz4=";
                              }
                            }}
                          />
                        </div>
                        <div className="home-item-body">
                          <h4 className="home-item-title">{item.name}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="home-item-price"><strong>AED</strong> {item.price}</p>
                            <span style={{
                              fontSize: '0.75rem',
                              color: item.actual_qty > 0 ? '#10b981' : '#ef4444',
                              background: item.actual_qty > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 700
                            }}>
                              Stock: {item.actual_qty}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="home-bill-section">
            {/* BARCODE SCANNER INPUT */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan / Type Barcode + Enter"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={onBarcodeKeyDown}
                className="home-customer-input"
                style={{
                  fontWeight: '600',
                  backgroundColor: '#f0fafdff',
                  border: '2px solid #86daefff',
                  transition: 'background-color 0.3s ease'
                }}
              />
              <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#000000ff' }} />
            </div>

            {/* Customer */}
            <div style={{ position: 'relative' }}>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Customer Name (type to search)"
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);

                  if (e.target.value.trim() !== 'Cash') {
                    setSelectedCustomer(null);
                  }
                }}
                onFocus={() => {
                  if (customerName.trim() === 'Cash') {

                    nameInputRef.current?.select();
                  }
                  customerName.trim().length >= 2 && setShowDropdown(true);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customerName.trim()) {
                    const existing = searchResults.find(
                      c => c.customer_name.toLowerCase() === customerName.trim().toLowerCase()
                    );
                    if (existing) {
                      pickCustomer(existing);
                    } else if (customerName.trim().length >= 2) {
                      openCreate();
                    }
                  }
                }}
                className="home-customer-input"
                autoComplete="off"
              />
              {searchLoading && <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />}
              {showDropdown && (
                <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                      {customerName.trim().length < 2 ? 'Type 2+ chars' : 'No customers found'}
                    </div>
                  ) : (
                    searchResults.map(c => (
                      <div key={c.name} onClick={() => pickCustomer(c)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}>
                        <div><div style={{ fontWeight: 600 }}>{c.customer_name}</div>{c.mobile_no && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.mobile_no}</div>}</div>
                        <Search size={16} style={{ color: '#94a3b8' }} />
                      </div>
                    ))
                  )}
                  {searchResults.every(c => c.customer_name.toLowerCase() !== customerName.trim().toLowerCase()) && (
                    <div onClick={openCreate} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: '#eef2ff', color: '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserPlus size={18} /> Create "{customerName.trim()}"
                    </div>
                  )}
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
                    <li key={item.id} className="home-bill-item-row">
                      <div className="home-bill-item-info">
                        <span className="home-bill-item-name">{item.name}</span>
                        <span className="home-bill-item-price"><strong>AED</strong> {item.price} × {item.qty}</span>
                      </div>
                      <div className="home-bill-item-actions">
                        <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, -1); }}>-</button>
                        <span className="home-bill-qty">{item.qty}</span>
                        <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, 1); }}>+</button>
                        <button className="home-bill-remove-btn" onClick={e => { e.stopPropagation(); removeFromBill(item.id); }}><X size={14} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tax Template Selector */}
            {/* {taxTemplates.length > 1 && (
              <div style={{ margin: '0.5rem 0' }}>
                <select value={selectedTaxTemplate} onChange={e => setSelectedTaxTemplate(e.target.value)} className="home-customer-input" style={{ fontSize: '0.9rem' }}>
                  {taxTemplates.map(t => (
                    <option key={t.name} value={t.name}>{t.name} ({t.sales_tax?.[0]?.rate || 0}%)</option>
                  ))}
                </select>
              </div>
            )} */}

            {/* Summary */}
            <div className="home-bill-summary">
              <div className="home-bill-summary-row"><span>Subtotal</span><span><strong>AED</strong> {displaySubtotal.toFixed(2)}</span></div>
              {discount.value > 0 && (
                <div className="home-bill-summary-row home-bill-discount">
                  <span>Discount {discount.type === 'percent' ? `(${discount.value}%)` : ''}</span>
                  <span>-<strong>AED</strong> {displayDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="home-bill-summary-row"><span>Tax ({taxRate}%)</span><span><strong>AED</strong> {displayTax.toFixed(2)}</span></div>
              <div className="home-bill-summary-row home-bill-grand-total">
                <span>Grand Total</span><span><strong>AED</strong> {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="container-fluid">
              <div className="row">
                <div className="col-12">
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
                    <button className="home-bill-discount-btn" onClick={() => setShowDiscountModal(true)}>
                      {discount.value > 0 ? `Edit (${discount.type === 'percent' ? `${discount.value}%` : `AED ${discount.value}`})` : 'Add Discount'}
                    </button>
                    {grandTotal > 0 && <button className="home-bill-pay-btn" onClick={handleCheckout}>Pay</button>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                    {billItems.length > 0 && (
                      <button className="home-bill-clear-btn" onClick={() => {
                        setBillItems([]); setDiscount({ type: 'amount', value: 0 });
                      }}>Clear Bill</button>
                    )}
                    <button className="home-bill-clear-btn" onClick={closingEntry} style={{ backgroundColor: '#26abff' }}>Closing</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
          <div className="home-modal-overlay" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="home-modal-header">
                <h3>{selectedPaymentMode ? `Payment via ${selectedPaymentMode}` : 'Select Payment Mode'}</h3>
                <button className="home-modal-close" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                {!selectedPaymentMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button className="payment-mode-btn" onClick={() => selectPaymentMode('Cash')}><DollarSign size={24} /> Cash</button>
                    <button className="payment-mode-btn" onClick={() => selectPaymentMode('Credit Card')}><CreditCard size={24} /> Credit Card</button>
                    <button className="payment-mode-btn" onClick={() => selectPaymentMode('UPI')}><Smartphone size={24} /> UPI</button>
                  </div>
                ) : selectedPaymentMode === 'Cash' ? (
                  <div>
                    <div style={{ margin: '1rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>AED {displaySubtotal.toFixed(2)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax ({taxRate}%):</span><span>AED {displayTax.toFixed(2)}</span></div>
                      {discount.value > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Discount:</span><span>-AED {displayDiscount.toFixed(2)}</span></div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}><span>Grand Total:</span><span>AED {grandTotal.toFixed(2)}</span></div>
                    </div>
                    <input type="number" value={tenderedAmount} onChange={e => setTenderedAmount(parseFloat(e.target.value) || 0)} placeholder={`>= ${grandTotal.toFixed(2)}`} className="home-discount-input" style={{ width: '100%', marginBottom: '1rem' }} />
                    <div style={{ textAlign: 'center', fontWeight: 'bold', color: changeDue >= 0 ? 'green' : 'red' }}>
                      Change Due: AED {changeDue.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <p>Process {selectedPaymentMode} payment for AED {grandTotal.toFixed(2)}</p>
                )}
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}>Cancel</button>
                <button className="home-modal-apply" onClick={completePayment} disabled={paymentLoading || (selectedPaymentMode === 'Cash' && tenderedAmount < grandTotal)}>
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
      </div>
    </div>
  );
}

export default Home;

