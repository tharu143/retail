import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Search, UserPlus, Loader2, CreditCard, Smartphone, DollarSign } from 'lucide-react';
import { logout } from '../../Redux/Slices/UserSlice';
import NavBar from '../Nav/NavBar';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const session = useSelector((state) => state.user.session);
  const company = useSelector((state) => state.user.company); // From Redux
  const posProfile = useSelector((state) => state.user.posProfile); // From Redux
  const loading = useSelector((state) => state.user.loading || false);

  // POS Opening Entry from localStorage
  const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');

  // Redirect if no auth or no opening entry
  useEffect(() => {
    if (!user || !session) {
      navigate('/login');
      return;
    }
    if (!posOpeningEntry) {
      // Redirect to opening entry or show alert - assuming route exists
      navigate('/opening-entry');
      return;
    }
  }, [user, session, posOpeningEntry, navigate]);

  // Enhanced authFetch: Memoized
  const authFetch = useCallback(async (url, options = {}) => {
    const fullUrl = url.startsWith('http') ? url : `/api/method${url.startsWith('/') ? url : `/${url}`}`;
    const headers = {
      ...options.headers,
      "Accept": "application/json",
      ...(session ? { "X-Frappe-SID": session } : {}),
    };
    const config = {
      ...options,
      headers,
      credentials: 'include',
    };
    console.log("API Call:", fullUrl, "Session:", session ? 'Present' : 'Missing');
    const response = await fetch(fullUrl, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API Error:", errorData);
      if (errorData._server_messages?.some(msg => msg.message.includes('not permitted') || msg.message.includes('whitelisted'))) {
        alert("API access denied. Check backend whitelisting or re-login.");
      }
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    return response;
  }, [session]);

  // States for items, categories, etc. (unchanged)
  const [Items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState(["all"]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [billItems, setBillItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
  });
  const [applyTax, setApplyTax] = useState(false);
  const [discount, setDiscount] = useState({ type: 'amount', value: 0 });
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  // New states for checkout
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const dropdownRef = useRef(null);
  const nameInputRef = useRef(null);

  // Memoized calculations
  const subtotal = useMemo(() => billItems.reduce((sum, item) => sum + item.price * item.qty, 0), [billItems]);
  const discountAmount = useMemo(() => discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value, [subtotal, discount]);
  const taxableAmount = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => applyTax ? taxableAmount * 0.05 : 0, [taxableAmount, applyTax]);
  const grandTotal = useMemo(() => taxableAmount + taxAmount, [taxableAmount, taxAmount]);

  // Update tendered amount when grandTotal changes
  useEffect(() => {
    setTenderedAmount(grandTotal);
  }, [grandTotal]);

  // Customer search (unchanged)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customerName.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await authFetch(
          `custom_retailpos.custom_retailpos.retail_api.retail.get_customers?search=${encodeURIComponent(customerName.trim())}`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data.message) ? data.message : []);
      } catch (e) {
        console.error("Search Error:", e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
        setShowDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerName, authFetch]);

  // Click outside (unchanged)
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Customer handlers (unchanged)
  const openCreate = () => {
    setCreateForm({
      name: customerName.trim(),
      phone: phoneNumber,
      address: '',
      email: '',
    });
    setShowCreateModal(true);
    setShowDropdown(false);
  };

  const pickCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.customer_name);
    setPhoneNumber(cust.mobile_no || '');
    setShowDropdown(false);
  };

  const createCustomer = async () => {
    if (!createForm.name) return;

    try {
      const res = await authFetch(
        'custom_retailpos.custom_retailpos.retail_api.retail.create_customer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: createForm.name,
            phone: createForm.phone || null,
            address: createForm.address || null,
            email: createForm.email || null,
          }),
        }
      );

      const result = await res.json();

      if (result.status === 'success') {
        const newCust = {
          name: result.customer_id,
          customer_name: createForm.name,
          mobile_no: createForm.phone,
          primary_address: createForm.address,
          email_id: createForm.email,
        };
        pickCustomer(newCust);
        setShowCreateModal(false);
      } else {
        alert(result.message || 'Failed to create customer');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while creating customer');
    }
  };

  // Fetch items (unchanged)
  useEffect(() => {
    const fetchItems = async () => {
      if (!session) return;
      try {
        setLoadingItems(true);
        setError("");
        console.log("Fetching items once...");
        const response = await authFetch(
          'custom_retailpos.custom_retailpos.retail_api.retail.get_item_details',
          { method: "GET" }
        );

        const data = await response.json();
        const apiItems = data.message || data;

        const baseUrl = 'http://75.119.130.59';

        const transformedItems = apiItems.map(item => ({
          id: item.name,
          name: item.item_name,
          image: item.image ? `${baseUrl}${item.image}` : 'https://via.placeholder.com/300?text=No+Image',
          group: (item.item_group || "others").toLowerCase(),
          price: item.price_list_rate || 0,
          barcodes: item.barcodes || []
        }));

        const uniqueGroups = [...new Set(transformedItems.map(item => item.group))];
        const dynamicCategories = ["all", ...uniqueGroups.sort()];
        setCategories(dynamicCategories);
        setItems(transformedItems);
        setFilteredItems(transformedItems);
      } catch (err) {
        console.error("Failed to fetch items:", err);
        setError(err.message || "Failed to load items. Check backend whitelisting or session.");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [authFetch]);

  // Filter items (unchanged)
  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredItems(Items);
    } else {
      const filtered = Items.filter(item => item.group === selectedCategory.toLowerCase());
      setFilteredItems(filtered);
    }
  }, [selectedCategory, Items]);

  const handleFilter = (category) => setSelectedCategory(category);

  const handleAddToBill = (item) => {
    setBillItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromBill = (id) => setBillItems(prev => prev.filter(i => i.id !== id));

  const updateQuantity = (id, delta) => {
    setBillItems(prev =>
      prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  };

  const groupCategories = (cats, size) => {
    const groups = [];
    for (let i = 0; i < cats.length; i += size) {
      groups.push(cats.slice(i, i + size));
    }
    return groups;
  };

  const groupedCategories = groupCategories(categories, 4);

  const handlePrevSlide = () => {
    setCurrentSlide(prev => (prev === 0 ? groupedCategories.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide(prev => (prev === groupedCategories.length - 1 ? 0 : prev + 1));
  };

  const applyDiscountHandler = () => {
    const value = parseFloat(discountInput) || 0;
    if (value > 0) setDiscount({ type: discount.type, value });
    setShowDiscountModal(false);
    setDiscountInput("");
  };

  // Checkout handler
  const handleCheckout = () => {
    if (grandTotal <= 0) {
      alert('No items in bill');
      return;
    }
    if (!posOpeningEntry) {
      alert('Please open a shift first');
      return;
    }
    setShowPaymentModal(true);
  };

  // Select payment mode
  const selectPaymentMode = (mode) => {
    setSelectedPaymentMode(mode);
    setTenderedAmount(grandTotal);
  };

  // Complete payment
  const completePayment = async () => {
    if (!selectedPaymentMode) return;

    // Validate tendered for cash
    if (selectedPaymentMode === 'Cash' && tenderedAmount < grandTotal) {
      alert('Tendered amount must cover the grand total');
      return;
    }

    setPaymentLoading(true);
    try {
      const customer = selectedCustomer ? selectedCustomer.customer_name : customerName;
      if (!customer) {
        alert('Please select or enter customer name');
        return;
      }

      const taxRate = applyTax ? 5 : 0;

      const payload = {
        customer,
        contact_mobile: phoneNumber,
        contact_email: '', // Add if needed
        items: billItems.map(item => ({
          item_code: item.id,
          item_name: item.name,
          quantity: item.qty,
          basePrice: item.price,
          income_account: 'Sales of I/C - KSPL' // Default, adjust if needed
        })),
        company,
        pos_profile: posProfile,
        pos_opening_entry: posOpeningEntry,
        payments: [{
          mode_of_payment: selectedPaymentMode,
          amount: grandTotal
        }],
        discount_amount: discountAmount,
        tax_rate: taxRate,
        posting_date: new Date().toISOString().slice(0, 10),
        currency: 'AED',
        due_date: new Date().toISOString().slice(0, 10) // Same as posting
      };

      console.log('Creating POS Invoice Payload:', payload);

      const res = await authFetch(
        'custom_retailpos.custom_retailpos.retail_api.retail.create_pos_invoice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      let result = await res.json();
      // Flatten if nested (Frappe often wraps in {message: ...})
      const responseData = result.message || result;

      console.log('API Response:', responseData);  // Add for debugging

      if (responseData.status === 'success') {
        alert(`Invoice created successfully: ${responseData.invoice_name}\nGrand Total: AED ${responseData.grand_total?.toFixed(2) || grandTotal.toFixed(2)}`);
        // Clear bill
        setBillItems([]);
        setDiscount({ type: 'amount', value: 0 });
        setApplyTax(false);
        setCustomerName('');
        setSelectedCustomer(null);
        setPhoneNumber('');
        setSelectedPaymentMode('');
        setTenderedAmount(0);
        // Optionally print or show invoice details
      } else {
        console.error('API Error Response:', responseData);
        alert(`Failed to create invoice: ${responseData.message || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Payment Error:', e);
      alert(`Network error during payment: ${e.message}`);
    } finally {
      setPaymentLoading(false);
      setShowPaymentModal(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch(
        'custom_retailpos.custom_retailpos.retail_api.retail.user_logout',
        { method: "POST" }
      );
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      localStorage.clear();
      dispatch(logout());
      navigate('/');
    }
  };

  const closingEntry = () =>{
    navigate('/closingentry')
  }

  if (loadingItems) {
    return (
      <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading items...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const changeDue = tenderedAmount - grandTotal;

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-layout">
          <div className="home-main-section">
            {/* CATEGORY SLIDER (unchanged) */}
            <div className="home-category-sidebar">
              <div className="home-carousel-container">
                {groupedCategories.length > 1 && (
                  <button className="home-carousel-arrow home-carousel-arrow-left" onClick={handlePrevSlide}>
                    <ChevronLeft size={20} />
                  </button>
                )}
                <div className="home-carousel-slides">
                  <div className="home-carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                    {groupedCategories.map((group, groupIndex) => (
                      <div key={groupIndex} className="home-category-slide">
                        <div className="home-category-grid">
                          {group.map((category) => (
                            <button
                              key={category}
                              className={`home-category-btn ${selectedCategory === category ? "home-category-btn-active" : ""}`}
                              onClick={() => handleFilter(category)}
                            >
                              <span className="home-category-text">
                                {category === "all" ? "All" : category.charAt(0).toUpperCase() + category.slice(1)}
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

            {/* ITEMS GRID (unchanged) */}
            <div className="home-items-container">
              <div className="home-items-grid">
                {filteredItems.length === 0 ? (
                  <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#666' }}>
                    No items in this category
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <div key={item.id} className="home-item-wrapper" onClick={() => handleAddToBill(item)}>
                      <div className="home-item-card">
                        <div className="home-item-image-box">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="home-item-image"
                            onError={e => e.target.src = "https://via.placeholder.com/300?text=No+Image"}
                          />
                        </div>
                        <div className="home-item-body">
                          <h4 className="home-item-title">{item.name}</h4>
                          <p className="home-item-price"><strong>AED</strong> {item.price}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* BILL SECTION */}
          <div className="home-bill-section">
            <div className="home-bill-header">
              <h2 className="home-bill-title">Bill</h2>
            </div>
            {/* Customer Input (unchanged) */}
            <div style={{ position: 'relative' }}>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Customer Name (type to search)"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomer(null);
                }}
                onFocus={() => customerName.trim().length >= 2 && setShowDropdown(true)}
                onKeyDown={(e) => {
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
              {searchLoading && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}

              {showDropdown && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 10,
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                      {customerName.trim().length < 2 ? 'Type at least 2 characters' : 'No customers found'}
                    </div>
                  ) : (
                    searchResults.map((c) => (
                      <div
                        key={c.name}
                        onClick={() => pickCustomer(c)}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                          {c.mobile_no && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.mobile_no}</div>}
                        </div>
                        <Search size={16} style={{ color: '#94a3b8' }} />
                      </div>
                    ))
                  )}
                  {searchResults.every(c => c.customer_name.toLowerCase() !== customerName.trim().toLowerCase()) && (
                    <div
                      onClick={openCreate}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        background: '#eef2ff',
                        color: '#4338ca',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: "center",
                        gap: '0.5rem',
                      }}
                    >
                      <UserPlus size={18} />
                      Create "{customerName.trim()}"
                    </div>
                  )}
                </div>
              )}
            </div>

            <input
              type="tel"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="home-customer-input"
            />

            {/* Bill Items (unchanged) */}
            <div className="home-bill-items">
              {billItems.length === 0 ? (
                <p className="home-bill-empty">No items added yet</p>
              ) : (
                <ul className="home-bill-item-list">
                  {billItems.map(item => (
                    <li key={item.id} className="home-bill-item-row">
                      <div className="home-bill-item-info">
                        <span className="home-bill-item-name">{item.name}</span>
                        <span className="home-bill-item-price">
                          <strong>AED</strong> {item.price} × {item.qty}
                        </span>
                      </div>
                      <div className="home-bill-item-actions">
                        <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, -1); }}>-</button>
                        <span className="home-bill-qty">{item.qty}</span>
                        <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, 1); }}>+</button>
                        <button className="home-bill-remove-btn" onClick={e => { e.stopPropagation(); removeFromBill(item.id); }}>
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bill Summary (now using memoized values) */}
            <div className="home-bill-summary">
              <div className="home-bill-summary-row"><span>Subtotal</span><span><strong>AED</strong> {subtotal.toFixed(2)}</span></div>
              {discount.value > 0 && (
                <div className="home-bill-summary-row home-bill-discount">
                  <span>Discount {discount.type === 'percent' ? `(${discount.value}%)` : `AED ${discount.value}`}</span>
                  <span>-<strong>AED</strong> {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="home-bill-summary-row"><span>Taxable</span><span><strong>AED</strong> {taxableAmount.toFixed(2)}</span></div>
              <div className="home-bill-summary-row">
                <label className="home-bill-tax-toggle">
                  <input type="checkbox" checked={applyTax} onChange={e => setApplyTax(e.target.checked)} /> Tax (5%)
                </label>
                <span><strong>AED</strong> {taxAmount.toFixed(2)}</span>
              </div>
              <div className="home-bill-summary-row home-bill-grand-total">
                <span>Grand Total</span><span><strong>AED</strong> {grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className='container-fluid'>
              <div className='row'>
                <div className='col-12' >
                  <div className='col-6' style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%',gap:'5px' }}>
                    <button className="home-bill-discount-btn" onClick={() => setShowDiscountModal(true)}>
                      {discount.value > 0 ? `Edit Discount (${discount.type === 'percent' ? `${discount.value}%` : `AED ${discount.value}`})` : 'Add Discount'}
                    </button>

                    {grandTotal > 0 && (
                      <button className="home-bill-pay-btn" onClick={handleCheckout}>
                        Pay
                      </button>
                    )}
                  </div>
                  <div className='col-6' style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%',gap:'5px', marginTop:'2px'}}>
                    {billItems.length > 0 && (
                      <button className="home-bill-clear-btn" onClick={() => {
                        setBillItems([]);
                        setDiscount({ type: 'amount', value: 0 });
                        setApplyTax(false);
                      }}>
                        Clear Bill
                      </button>
                    )}
                    <button className="home-bill-clear-btn" onClick={closingEntry} style={{ backgroundColor: '#212529' ,marginTop:'2px' }}>
                      Closing
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


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

        {/* CREATE CUSTOMER MODAL (unchanged) */}
        {showCreateModal && (
          <div className="home-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="home-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
              <div className="home-modal-header">
                <h3>Create New Customer</h3>
                <button className="home-modal-close" onClick={() => setShowCreateModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="home-modal-body">
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="home-customer-input"
                  style={{ marginBottom: '0.75rem' }}
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="home-customer-input"
                  style={{ marginBottom: '0.75rem' }}
                />
                <input
                  type="text"
                  placeholder="Address (optional)"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="home-customer-input"
                  style={{ marginBottom: '0.75rem' }}
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="home-customer-input"
                  style={{ marginBottom: '0.75rem' }}
                />
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button className="home-modal-apply" onClick={createCustomer}>
                  Create Customer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT MODAL - New */}
        {showPaymentModal && (
          <div className="home-modal-overlay" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}>
            <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="home-modal-header">
                <h3>{selectedPaymentMode ? `Payment via ${selectedPaymentMode}` : 'Select Payment Mode'}</h3>
                <button className="home-modal-close" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}><X size={20} /></button>
              </div>
              <div className="home-modal-body">
                {!selectedPaymentMode ? (
                  <div className="payment-modes">
                    <h4>Select Payment Method</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button className="payment-mode-btn" onClick={() => selectPaymentMode('Cash')}>
                        <DollarSign size={24} /> Cash
                      </button>
                      <button className="payment-mode-btn" onClick={() => selectPaymentMode('Credit Card')}>
                        <CreditCard size={24} /> Credit Card
                      </button>
                      <button className="payment-mode-btn" onClick={() => selectPaymentMode('UPI')}>
                        <Smartphone size={24} /> UPI
                      </button>
                    </div>
                  </div>
                ) : selectedPaymentMode === 'Cash' ? (
                  <div className="cash-payment">
                    <h4>Cash Payment</h4>
                    {/* Items Summary */}
                    <div className="payment-items-summary">
                      <h5>Items</h5>
                      <ul style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                        {billItems.map(item => (
                          <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                            <span>{item.name} x {item.qty}</span>
                            <span>AED {(item.price * item.qty).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Totals */}
                    <div className="payment-totals" style={{ margin: '1rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>AED {subtotal.toFixed(2)}</span></div>
                      {discount.value > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Discount:</span><span>- AED {discountAmount.toFixed(2)}</span></div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax ({applyTax ? '5%' : '0%'}):</span><span>AED {taxAmount.toFixed(2)}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}><span>Grand Total:</span><span>AED {grandTotal.toFixed(2)}</span></div>
                    </div>
                    {/* Tender Input */}
                    <div style={{ margin: '1rem 0' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Amount Tendered (AED)</label>
                      <input
                        type="number"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(parseFloat(e.target.value) || 0)}
                        min={grandTotal}
                        step="0.01"
                        className="home-discount-input"
                        placeholder={`Enter amount >= ${grandTotal.toFixed(2)}`}
                      />
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: changeDue >= 0 ? 'green' : 'red' }}>
                      Change Due: AED {changeDue.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="simple-payment">
                    <h4>{selectedPaymentMode} Payment</h4>
                    <p>Total Amount: AED {grandTotal.toFixed(2)}</p>
                    <p>Process {selectedPaymentMode} payment for the above amount.</p>
                  </div>
                )}
              </div>
              <div className="home-modal-footer">
                <button className="home-modal-cancel" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); }}>Cancel</button>
                <button
                  className="home-modal-apply"
                  onClick={completePayment}
                  disabled={paymentLoading || (selectedPaymentMode === 'Cash' && tenderedAmount < grandTotal)}
                >
                  {paymentLoading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {paymentLoading ? 'Processing...' : 'Complete Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;