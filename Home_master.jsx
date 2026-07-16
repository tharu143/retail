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
import { db } from './src/db'; // Correct path to src/db from root Home_master.jsx
import { v4 as uuidv4 } from 'uuid'; // Standard for offline_id

function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const session = useSelector((state) => state.user.session);
  const company = useSelector((state) => state.user.company);
  const posProfile = useSelector((state) => state.user.posProfile);
  const loading = useSelector((state) => state.user.loading || false);

  const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');
  const [showOpeningModal, setShowOpeningModal] = useState(false);



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
    const fullUrl = url.startsWith('http') ? url : `/api/method${url.startsWith('/') ? url : `/${url}`}`;
    const headers = {
      ...options.headers,
      "Accept": "application/json",
      ...(session ? { "X-Frappe-SID": session } : {}),
    };
    const config = { ...options, headers, credentials: 'include' };
    const response = await fetch(fullUrl, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    return response;
  }, [session]);

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
  
  // Nearest Stock
  const [nearestStock, setNearestStock] = useState([]);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [selectedItemForStock, setSelectedItemForStock] = useState(null);

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
    billItems.reduce((sum, item) => {
      const itemPrice = item.uom_type === 'Box' ? (item.price * item.pieces_per_box) : item.price;
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

  // ---------- TAX FETCH ----------
  useEffect(() => {
    const fetchTaxTemplates = async () => {
      try {
        const res = await authFetch('kyle_retail.retail_api.api.get_sales_taxes_details');
        const data = await res.json();
        const templates = data.message || data || [];
        setTaxTemplates(templates);
        if (templates.length) setSelectedTaxTemplate(templates[0].name);
      } catch (err) { console.error(err); }
    };
    fetchTaxTemplates();
  }, [authFetch]);

  // ---------- CUSTOMER SEARCH ----------
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerName.trim().length < 2) {
        setSearchResults([]); setShowDropdown(false); return;
      }
      setSearchLoading(true);
      try {
        const res = await authFetch(
          `kyle_retail.retail_api.api.get_customers?search=${encodeURIComponent(customerName.trim())}`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data.message) ? data.message : []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); setShowDropdown(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, authFetch]);

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

    setCreatingCustomer(true);  // ??? Loading starts

    try {
      // Using kyle_retail fast customer endpoint as per requirement
      const payload = {
        mobile_no: createForm.phone,
        customer_name: createForm.name.trim()
      };

      const res = await authFetch('kyle_retail.retail_api.api.get_or_create_customer_by_mobile', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      const inner = result.message || result;

      if (inner.status === "success" || inner.name) {
        alert("Customer successfully identified/created!");
        pickCustomer({
          name: inner.name || inner.customer_id,
          customer_name: inner.customer_name || createForm.name.trim(),
          mobile_no: inner.mobile_no || createForm.phone || "",
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
      setCreatingCustomer(false);
    }
  };
  // ---------- FETCH ALL ITEMS ----------

  useEffect(() => {
    const fetchItems = async () => {
      if (!session) return;
      try {
        setLoadingItems(true); setError("");
        // Using Enhanced kyle_retail items endpoint as per recommendation
        const response = await authFetch('kyle_retail.retail_api.api.get_retail_item_details');
        const data = await response.json();
        const apiItems = data.message || data;
        const baseUrl = 'http://75.119.130.59';
        const transformed = apiItems.map(item => ({
          id: item.name,
          name: item.item_name,
          image: item.image ? `${baseUrl}${item.image}` : 'https://via.placeholder.com/300?text=No+Image',
          group: (item.item_group || "others").toLowerCase(),
          price: item.price_list_rate || 0,
          barcodes: item.barcodes || [],
          pieces_per_box: item.custom_pieces_per_box || 1,
          stock: item.actual_qty || 0
        }));
        const groups = [...new Set(transformed.map(i => i.group))];
        setCategories(["all", ...groups.sort()]);
        setItems(transformed);
        setFilteredItems(transformed);
      } catch (err) { setError(err.message || "Failed to load items."); }
      finally { setLoadingItems(false); }
    };
    fetchItems();
  }, [authFetch, session]);




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
      handleAddToBill(foundItem); // Reuse the add logic
      setBarcodeInput('');
    } else {
      // Red flash if not found
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#fee2e2';
        setTimeout(() => {
          if (barcodeInputRef.current) barcodeInputRef.current.style.backgroundColor = '';
        }, 400);
      }
    }
  }, [Items, handleAddToBill]);

  const onBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBarcodeScan(barcodeInput);
    }
  };

  // ---------- NEAREST STOCK ----------
  const fetchNearestStock = async (itemCode, itemName) => {
    setStockLoading(true);
    setSelectedItemForStock(itemName);
    setShowStockModal(true);
    try {
      const warehouse = localStorage.getItem('warehouse');
      const res = await authFetch(`kyle_retail.retail_api.api.find_nearest_stock?item_code=${itemCode}&current_warehouse=${warehouse}`);
      const data = await res.json();
      setNearestStock(data.message || []);
    } catch (err) {
      console.error(err);
      setNearestStock([]);
    } finally {
      setStockLoading(false);
    }
  };

  // ---------- ITEM HANDLERS ----------
  const handleFilter = (cat) => setSelectedCategory(cat);
  const handleAddToBill = (item) => {
    setBillItems(prev => {
      const existing = prev.find(i => i.id === item.id && i.uom_type === 'Piece');
      return existing
        ? prev.map(i => (i.id === item.id && i.uom_type === 'Piece') ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...item, qty: 1, uom_type: 'Piece' }]; // Default to Piece
    });
  };

  const toggleUOM = (id, currentUOM) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, uom_type: currentUOM === 'Piece' ? 'Box' : 'Piece' };
      }
      return item;
    }));
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

  // ---------- COMPLETE PAYMENT ----------
  const completePayment = async () => {
    const offlineId = uuidv4();
    const customer = selectedCustomer?.customer_name || customerName;
    if (!customer.trim()) { alert('Enter customer name'); return; }

    const invoiceItems = billItems.map(item => ({
      item_code: item.id,
      item_name: item.name,
      // Rule: Convert to pieces if UOM is Box
      quantity: item.uom_type === 'Box' ? (item.qty * item.pieces_per_box) : item.qty,
      basePrice: item.price,
      uom: item.uom_type, // Some backends use 'uom' field for display
      uom_type: item.uom_type,
      income_account: 'Sales of I/C - KSPL'
    }));

    const payload = {
      customer,
      contact_mobile: phoneNumber,
      items: invoiceItems,
      company,
      pos_profile: posProfile,
      pos_opening_entry: posOpeningEntry,
      offline_id: offlineId,
      payments: [{
        mode_of_payment: selectedPaymentMode,
        amount: parseFloat(grandTotal.toFixed(2))
      }],
      discount_amount: discountAmount,
      apply_discount_on: "Net Total",
      tax_template: selectedTaxTemplate,
      posting_date: new Date().toISOString().slice(0, 10),
      currency: 'AED',
      due_date: new Date().toISOString().slice(0, 10),
      is_synced: 0
    };

    setPaymentLoading(true);
    try {
      if (!navigator.onLine) {
        // Force offline save if network is known to be down
        await db.invoices.add(payload);
        finalizeOrder();
        alert('Saved offline. Will sync when online.');
        return;
      }

      const res = await authFetch('kyle_retail.retail_api.api.create_retail_invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }), // Wrapped in 'data' key as required
      });
      
      const result = await res.json();
      const data = result.message || result;

      if (data.status === 'success' || data.name) {
        // Mark as synced if successful
        await db.invoices.add({ 
            ...payload, 
            is_synced: 1, 
            server_name: data.invoice_name || data.name,
            synced_at: new Date().toISOString()
        });
        alert(`Invoice: ${data.invoice_name || data.name}\nTotal: AED ${grandTotal.toFixed(2)}`);
        finalizeOrder();
      } else {
        // Save offline even on server rejection (non-network errors usually handled by user)
        // But for truly persistent POS, we queue it
        await db.invoices.add(payload);
        finalizeOrder();
        alert('Server returned error. Added to sync queue: ' + (data.message || 'Unknown Error'));
      }
    } catch (e) {
      console.error("Payment error, saving offline...", e);
      await db.invoices.add(payload);
      finalizeOrder();
      alert('Network Error. Saved to offline queue.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const finalizeOrder = () => {
    setBillItems([]);
    setDiscount({ type: 'amount', value: 0 });
    setCustomerName(''); setSelectedCustomer(null); setPhoneNumber('');
    setSelectedPaymentMode(''); setTenderedAmount(0);
    setShowPaymentModal(false);
  };

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
                          <img src={item.image} alt={item.name} className="home-item-image" onError={e => e.target.src = "https://via.placeholder.com/300?text=No+Image"} />
                          {item.stock <= 0 && (
                            <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Out of Stock
                            </div>
                          )}
                        </div>
                        <div className="home-item-body">
                          <h4 className="home-item-title">{item.name}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p className="home-item-price"><strong>AED</strong> {item.price}</p>
                            {item.stock <= 0 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); fetchNearestStock(item.id, item.name); }}
                                style={{ fontSize: '10px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                Find Stock
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
          </div>

          {/* RIGHT: BILL */}
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
                    <li key={`${item.id}-${item.uom_type}`} className="home-bill-item-row">
                      <div className="home-bill-item-info">
                        <span className="home-bill-item-name">{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="home-bill-item-price">
                            <strong>AED</strong> {item.uom_type === 'Box' ? (item.price * item.pieces_per_box).toFixed(2) : item.price}
                          </span>
                          {item.pieces_per_box > 1 && (
                            <button
                              onClick={() => toggleUOM(item.id, item.uom_type)}
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #007bff',
                                backgroundColor: item.uom_type === 'Box' ? '#007bff' : 'transparent',
                                color: item.uom_type === 'Box' ? '#fff' : '#007bff',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              {item.uom_type}
                            </button>
                          )}
                        </div>
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
                  disabled={creatingCustomer}  // ??? disables double click
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

        {showStockModal && (
          <div className="home-modal-overlay" onClick={() => setShowStockModal(false)}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="home-modal-header">
                <h3>Stock Availability: {selectedItemForStock}</h3>
                <button className="home-modal-close" onClick={() => setShowStockModal(false)}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                {stockLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                ) : nearestStock.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>No stock found in nearby branches.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {nearestStock.map((branch, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{branch.warehouse}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{branch.distance_km ? `${branch.distance_km} km away` : 'Distance unknown'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: branch.actual_qty > 0 ? '#10b981' : '#ef4444' }}>
                            {branch.actual_qty} Qty
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => setShowStockModal(false)} style={{ width: '100%' }}>Close</button>
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

