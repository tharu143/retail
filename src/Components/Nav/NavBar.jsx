import { useEffect, useState, useCallback, useRef } from "react";
import kyleLogo from '../../assets/kyleretail.png';
import './NavBar.css';
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, toggleTheme, markRead, markAllRead } from "../../Redux/Slices/userSlice";
import { persistor } from "../../Redux/store";
import { db } from "../../db";
import { RefreshCw, LayoutDashboard, ChevronLeft, Settings as SettingsIcon, Palette, Search, Bell } from "lucide-react";
import Swal from 'sweetalert2';
import { authFetchBase } from "../../utils/authFetch";
function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const theme = useSelector((state) => state.user.theme);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Navigation Search Bar States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Notification States
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsContainerRef = useRef(null);
  const notifications = useSelector((state) => state.user.notifications || []);
  const unreadCount = notifications.filter(n => !n.read).length;

  const SEARCHABLE_PAGES = [
    { name: "Customer List", path: "/customerlist", keywords: ["customer", "client", "buyer", "customerlist"] },
    { name: "New Customer", path: "/customer-details/new", keywords: ["add customer", "create customer", "new client"] },
    { name: "Item Group List", path: "/itemgrouplist", keywords: ["item group", "category", "product group", "itemgrouplist"] },
    { name: "Item List", path: "/itemlist", keywords: ["items", "products", "inventory", "stock", "itemlist"] },
    { name: "Item Price List", path: "/itempricelist", keywords: ["price", "item price", "selling price", "itempricelist"] },
    { name: "POS Profile List", path: "/posprofilelist", keywords: ["profile", "pos profile", "terminal settings", "posprofilelist"] },
    { name: "Purchase Invoice", path: "/purchaseinvoicelist", keywords: ["purchase invoice", "pi", "bill", "vendor bill", "purchaseinvoicelist"] },
    { name: "Purchase Receipt", path: "/purchasereceiptlist", keywords: ["purchase receipt", "pr", "goods receipt", "grn", "purchasereceiptlist"] },
    { name: "Purchase Order List", path: "/purchaseorderlist", keywords: ["purchase order", "po", "vendor order", "purchaseorderlist", "purchase order list"] },
    { name: "Create Purchase Order", path: "/purchaseorder", keywords: ["create purchase order", "new purchase order", "new po", "purchaseorder", "create po"] },
    { name: "Supplier List", path: "/supplierlist", keywords: ["supplier", "vendor", "manufacturer", "supplierlist"] },
    { name: "Sales Order", path: "/salesorderlist", keywords: ["sales order", "so", "customer order", "salesorderlist"] },
    { name: "Create Sales Order", path: "/salesorder/create", keywords: ["new sales order", "create so", "add sales order"] },
    { name: "Sales Invoice", path: "/salesinvoice", keywords: ["sales invoice", "si", "customer bill", "salesinvoice"] },
    { name: "Delivery Note", path: "/deliverynote", keywords: ["delivery note", "dn", "dispatch", "shipment", "deliverynote"] },
    { name: "Sync Manager", path: "/syncmanager", keywords: ["sync", "offline database", "sync manager", "upload"] },
    { name: "Settings", path: "/settings", keywords: ["settings", "configuration", "preferences", "options"] },
    { name: "Quick Stock In", path: "/quickstockin", keywords: ["quick stock", "stock in", "add stock", "quickstockin"] },
    { name: "Sales Return", path: "/salesreturn", keywords: ["sales return", "return sale", "refund", "salesreturn"] },
    { name: "Purchase Return", path: "/purchasereturn", keywords: ["purchase return", "return purchase", "vendor refund", "purchasereturn"] },
    { name: "Address List", path: "/addresslist", keywords: ["address", "location", "billing address", "addresslist"] },
    { name: "Contact List", path: "/contactlist", keywords: ["contact", "phone number", "email", "contactlist"] },
    { name: "POS Health", path: "/poshealth", keywords: ["health", "status", "system status", "poshealth"] },
    { name: "Dashboard", path: "/dashboard", keywords: ["dashboard", "stats", "analytics", "admin panel"] }
  ];

  // Filter pages on search query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = SEARCHABLE_PAGES.filter(
      (page) =>
        page.name.toLowerCase().includes(query) ||
        page.keywords.some((keyword) => keyword.toLowerCase().includes(query))
    );
    setSearchResults(filtered);
    setActiveSearchIndex(0);
  }, [searchQuery]);

  // Global hotkey to focus search bar (Ctrl + K or /) and other navigations
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Global navigation hotkeys
      if (e.shiftKey && e.altKey) {
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          navigate("/salesreturn");
          return;
        }
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          navigate("/purchasereturn");
          return;
        }
      }

      if ((e.ctrlKey && e.key === "k") || e.key === "/") {
        // Only trigger if we aren't typing in some input already
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.contentEditable !== "true"
        ) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Close search and notifications on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
      if (notificationsContainerRef.current && !notificationsContainerRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation for results dropdown
  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (searchResults.length > 0 ? (prev + 1) % searchResults.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (searchResults.length > 0 ? (prev - 1 + searchResults.length) % searchResults.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults[activeSearchIndex]) {
        navigate(searchResults[activeSearchIndex].path);
        setSearchQuery("");
        setShowSearchResults(false);
        searchInputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setShowSearchResults(false);
      searchInputRef.current?.blur();
    }
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const isSyncingRef = useRef(false);

  // Sync Timer Ref to ensure interval stability
  const syncTimerRef = useRef(null);

  const checkSyncCount = useCallback(async () => {
    try {
      const invCount = await db.invoices.where('is_synced').equals(0).count();
      const openCount = await db.opening_entries.where('is_synced').equals(0).count();
      const closeCount = await db.closing_entries.where('is_synced').equals(0).count();
      const custCount = await db.customers.where('is_synced').equals(0).count();

      const total = invCount + openCount + closeCount + custCount;
      setPendingCount(total);
      return total;
    } catch (e) {
      console.error("[SyncCheck] Failed to count pending items:", e);
      return 0;
    }
  }, []);

  const syncPending = useCallback(async () => {
    // 1. Initial Checks
    if (!navigator.onLine) {
      console.log("[AutoSync] Browser offline. Skipping.");
      return;
    }
    if (isSyncingRef.current) {
      console.log("[AutoSync] Sync already in progress. Skipping.");
      return;
    }

    // 2. Atomic Sync Lock (Avoid Multi-Tab Conflicts)
    const syncLock = localStorage.getItem('global_sync_lock');
    const now = Date.now();
    if (syncLock && (now - parseInt(syncLock)) < 25000) {
      console.log("[AutoSync] Skip: Sync lock is active.");
      return;
    }
    localStorage.setItem('global_sync_lock', now.toString());

    isSyncingRef.current = true;
    setIsSyncInProgress(true);
    console.log(`[Sync Cycle Started at ${new Date().toLocaleTimeString()}]`);

    try {
      // 0. Sync Opening Entries (Order matters!)
      const pendingOpening = await db.opening_entries.where('is_synced').equals(0).toArray();
      if (pendingOpening.length > 0) {
        console.log(`[Sync] Opening Entries: Found ${pendingOpening.length}`);
        for (const entry of pendingOpening) {
          const { id, is_synced, offline_id, timestamp, ...payload } = entry;
          const res = await authFetchBase('custom_retailpos.custom_retailpos.retail_api.retail.create_opening_entry', {
            method: 'POST', body: JSON.stringify(payload)
          });
          const result = await res.json();
          const data = result.message || result;
          if (data.status === 'success' || data.name) {
            const serverName = data.name;
            await db.opening_entries.update(entry.id, { is_synced: 1 });
            if (localStorage.getItem('posOpeningEntry') === entry.offline_id) {
              localStorage.setItem('posOpeningEntry', serverName);
              window.dispatchEvent(new CustomEvent('shift-synced', { detail: { name: serverName } }));
            }
            await db.invoices.where('pos_opening_entry').equals(entry.offline_id).modify({ pos_opening_entry: serverName });
          }
        }
        await checkSyncCount();
      }

      // 1. Sync Customers
      const pendingCust = await db.customers.where('is_synced').equals(0).toArray();
      if (pendingCust.length > 0) {
        console.log(`[Sync] Customers: Found ${pendingCust.length}`);
        for (const cust of pendingCust) {
          const res = await authFetchBase('custom_retailpos.custom_retailpos.retail_api.retail.create_customer', {
            method: 'POST', body: JSON.stringify({
              name: cust.customer_name,
              mobile_no: cust.mobile_no,
              customer_group: cust.customer_group || "Retail Customer"
            })
          });
          const result = await res.json();
          const data = result.message || result;
          if (data.status === 'success' || data.name) {
            const sId = data.name || data.customer_id;
            await db.customers.update(cust.name, { is_synced: 1, name: sId });
            await db.invoices.where('customer').equals(cust.name).modify({ customer: sId });
          }
        }
        await checkSyncCount();
      }

      // 2. Bulk Sync Invoices
      const allPendingInv = await db.invoices.where('is_synced').equals(0).toArray();
      // Filter out invoices where dependencies aren't synced yet (safety)
      const pendingInv = allPendingInv.filter(inv => !inv.customer.startsWith('OFFLINE-CUST') && !inv.pos_opening_entry.startsWith('OFFLINE-SHIFT'));

      if (pendingInv.length > 0) {
        console.log(`[Sync] Invoices: Found ${pendingInv.length} ready to sync.`);
        const payload = pendingInv.map(({ id, is_synced, synced_at, server_name, retry_count, conflicts, ...rest }) => rest);
        const res = await authFetchBase('custom_retailpos.custom_retailpos.retail_api.retail.bulk_sync_invoices', {
          method: 'POST', body: JSON.stringify({ invoices: payload })
        });
        const data = await res.json();
        const results = data.message || data.results || [];

        for (const resItem of results) {
          const inv = pendingInv.find(i => i.offline_id === resItem.offline_id);
          if (inv && (resItem.status === 'success' || String(resItem.message).includes("Duplicate ignored"))) {
            const sName = resItem.invoice_name || resItem.name;
            if (sName) {
              await db.invoices.update(inv.id, { is_synced: 1, synced_at: new Date().toISOString(), server_name: sName });
            }
          }
        }
        localStorage.removeItem('last_item_sync_time');
        window.dispatchEvent(new CustomEvent('invoices-synced'));
      }
    } catch (error) {
      console.error("[Master Sync Error]:", error);
    } finally {
      localStorage.removeItem('global_sync_lock');
      isSyncingRef.current = false;
      setIsSyncInProgress(false);
      checkSyncCount();
      console.log(`[Sync Cycle Finished at ${new Date().toLocaleTimeString()}]`);
    }
  }, [checkSyncCount]);

  const handleManualSync = async () => {
    if (!isOnline) {
      Swal.fire({ icon: 'warning', title: 'Offline', text: 'Connect to internet to sync.' });
      return;
    }
    if (isSyncingRef.current) return;
    localStorage.removeItem('global_sync_lock'); // Force clear lock
    console.log("[ManualSync] Triggered by user.");
    await syncPending();
    const count = await checkSyncCount();
    if (count === 0) {
      Swal.fire({ icon: 'success', title: 'Synced', text: 'All data is up to date!', timer: 1500, showConfirmButton: false });
    }
  };

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const countCheck = setInterval(checkSyncCount, 8000);

    // Use a more robust sync timer
    const startSyncTimer = () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      syncTimerRef.current = setInterval(() => {
        console.log("[AutoSync] Interval Fired.");
        syncPending();
      }, 30000); // 30 seconds interval for faster updates
    };

    startSyncTimer();

    const handleOnline = () => {
      setIsOnline(true);
      console.log("[Network] Online event - triggering sync.");
      syncPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
      console.log("[Network] Offline event.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkSyncCount();
    syncPending();

    return () => {
      clearInterval(clockTimer);
      clearInterval(countCheck);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkSyncCount, syncPending]);

  const handleMarkAllRead = async () => {
    try {
      const response = await authFetchBase('kyle_retail.retail_api.api.mark_all_notifications_as_read', {
        method: 'POST'
      });
      const resData = await response.json();
      const data = resData.message || resData;
      if (data && data.status === 'success') {
        dispatch(markAllRead());
      }
    } catch (error) {
      console.error("[NavBar] Failed to mark all notifications as read:", error);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      setShowNotifications(false);
      // Mark as read in backend
      const response = await authFetchBase('kyle_retail.retail_api.api.mark_notification_as_read', {
        method: 'POST',
        body: JSON.stringify({ notification_name: notif.name })
      });
      const resData = await response.json();
      const data = resData.message || resData;
      if (data && data.status === 'success') {
        dispatch(markRead(notif.name));
      }
      navigate(`/interbranchrequest/${notif.document_name}`);
    } catch (error) {
      console.error("[NavBar] Failed to mark notification as read:", error);
      navigate(`/interbranchrequest/${notif.document_name}`);
    }
  };




  const handleLogout = async () => {
    try {
      if (!navigator.onLine) {
        dispatch(logout()); await persistor.purge(); localStorage.clear();
        navigate("/"); return;
      }
      await fetch("/api/method/logout", { method: "POST", credentials: "include" });
      dispatch(logout()); await persistor.purge(); localStorage.clear();
      Swal.fire({ icon: 'success', title: 'Logout successful!', timer: 1500, showConfirmButton: false });
      navigate("/");
    } catch (error) {
      dispatch(logout()); await persistor.purge(); localStorage.clear(); navigate("/");
    }
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  // Do not render global NavBar when Legacy Theme is active (to avoid overflow/double header)
  if (theme === 'legacy' && location.pathname === '/homepage') return null;

  return (
    <nav className="navbar navbar-expand-lg nav-div">
      <div className="container-fluid justify-content-between">
        <div className="d-flex align-items-center gap-2">
          {location.pathname !== '/homepage' && location.pathname !== '/' && (
            <div
              className="d-flex align-items-center cursor-pointer gap-1 back-link"
              onClick={() => {
                // If a document or modal is open in search params (e.g. ?name=...), go back to clean list
                const search = window.location.search || window.location.hash.split('?')[1];
                if (search && search.includes('name=')) {
                  navigate(location.pathname, { replace: true });
                  return;
                }

                if (location.pathname.includes('/itemlist') || location.pathname.includes('/items')) {
                  window.dispatchEvent(new CustomEvent('close-item-modal'));
                  // Also step back if history state has modal
                  if (window.history.state && window.history.state.modal === 'item-details') {
                    window.history.back();
                  }
                  return;
                }

                if (location.pathname.includes('/item-details') || location.pathname.startsWith('/item/')) {
                  navigate('/itemlist');
                } else if (location.pathname.includes('/customer-details') || location.pathname.includes('/customer-edit')) {
                  navigate('/customerlist');
                } else if (location.pathname.includes('/supplier-details') || location.pathname.includes('/supplier-edit')) {
                  navigate('/supplierlist');
                } else if (location.pathname.includes('/salesorder-details') || location.pathname.includes('/salesorder/create')) {
                  navigate('/salesorderlist');
                } else if (location.pathname.includes('/deliverynote-details') || location.pathname.includes('/deliverynote/create')) {
                  navigate('/deliverynote');
                } else if (location.pathname.includes('/interbranchtransfer-details')) {
                  navigate('/interbranchtransfer');
                } else if (location.pathname.includes('/stockentry-details')) {
                  navigate('/stockentry');
                } else {
                  // Intelligent history back: if user has history in this session, step back 1 page
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate('/dashboard');
                  }
                }
              }}
              style={{ color: '#64748b' }}
            >
              <ChevronLeft size={22} />
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Back</span>
            </div>
          )}
          <div onClick={() => navigate('/homepage')} className="cursor-pointer flex items-center ms-2">
            <img src={kyleLogo} alt="Kyle Retail" className="h-9 w-auto max-w-[120px] md:max-w-[180px] object-contain mix-blend-multiply transition-opacity duration-300 hover:opacity-90" />
          </div>
        </div>

        {/* Global Navigation Search Bar */}
        <div className="nav-search-container" ref={searchContainerRef}>
          <div className="nav-search-wrapper">
            <Search className="nav-search-icon" size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search dashboard... (Ctrl + K)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              onKeyDown={handleSearchKeyDown}
              className="nav-search-input"
            />
            <div className="nav-search-shortcut">/</div>
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="nav-search-results-dropdown">
              <div className="nav-search-results-header">DASHBOARD / PAGES</div>
              {searchResults.map((result, idx) => (
                <div
                  key={result.path}
                  onClick={() => {
                    navigate(result.path);
                    setSearchQuery("");
                    setShowSearchResults(false);
                    searchInputRef.current?.blur();
                  }}
                  onMouseEnter={() => setActiveSearchIndex(idx)}
                  className={`nav-search-result-item ${idx === activeSearchIndex ? "active" : ""}`}
                >
                  <div className="nav-search-result-icon-wrapper">
                    <LayoutDashboard size={14} />
                  </div>
                  <div className="nav-search-result-details">
                    <span className="nav-search-result-name">{result.name}</span>
                    <span className="nav-search-result-path">Go to {result.path}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="d-flex align-items-center pe-3" style={{ gap: '28px' }}>
          {/* Group 1: Network Status & Syncing info */}
          <div className="d-flex align-items-center gap-2">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            <span className={`status-text ${isOnline ? 'text-online' : 'text-offline'}`}>{isOnline ? 'Online' : 'Offline'}</span>
            {(pendingCount > 0 || isSyncInProgress) && (
              <div
                onClick={handleManualSync}
                className={`pending-badge cursor-pointer ms-2 ${isSyncInProgress ? 'syncing' : ''}`}
              >
                <RefreshCw size={12} className={isSyncInProgress ? "animate-spin" : ""} />
                {isSyncInProgress ? "Syncing..." : `${pendingCount} Pending`}
              </div>
            )}
          </div>

          <div style={{ width: '1.5px', height: '22px', background: '#cbd5e1', opacity: 0.7 }} />

          {/* Group 2: Key Navigation Buttons */}
          <div className="d-flex align-items-center gap-3">
            {localStorage.getItem('posOpeningEntry') && (
              <div
                onClick={() => navigate('/closingentry')}
                className="cursor-pointer d-flex align-items-center justify-content-center"
                style={{
                  background: '#fef2f2',
                  color: '#ef4444',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  border: '1.5px solid #fecaca',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
              >
                CLOSE SHIFT
              </div>
            )}
             <LayoutDashboard className="cursor-pointer nav-icon" onClick={() => navigate('/syncmanager')} title="Sync Manager" />
          </div>


          <div style={{ width: '1.5px', height: '22px', background: '#cbd5e1', opacity: 0.7 }} />

          {/* Group 3: Theme Preferences & Notifications */}
          <div className="d-flex align-items-center gap-4">
            <div
              onClick={() => dispatch(toggleTheme())}
              className={`cursor-pointer nav-icon flex items-center gap-1 ${theme === 'legacy' ? 'text-indigo-600' : ''}`}
              title="Switch POS Theme"
            >
              <Palette size={20} />
              <span style={{ fontSize: '10px', fontWeight: 800 }}>THEME: {(theme || 'modern').toUpperCase()}</span>
            </div>

            {/* Notification Bell Dropdown */}
            <div className="nav-notification-container" ref={notificationsContainerRef}>
              <div
                onClick={() => setShowNotifications(!showNotifications)}
                className="cursor-pointer nav-icon position-relative flex items-center"
                title="Notifications"
                style={{ transition: 'all 0.2s ease', position: 'relative' }}
              >
                <Bell size={20} className={unreadCount > 0 ? "animate-pulse-subtle" : ""} />
                {unreadCount > 0 && (
                  <span className="position-absolute translate-middle badge rounded-pill bg-danger" style={{ fontSize: '8px', padding: '2px 4px', top: '-2px', right: '-10px' }}>
                    {unreadCount}
                  </span>
                )}
              </div>

              {showNotifications && (
                <div className="nav-notification-dropdown">
                  <div className="nav-notification-header d-flex justify-content-between align-items-center">
                    <span>NOTIFICATIONS</span>
                    {unreadCount > 0 && (
                      <button className="btn btn-link btn-sm p-0 text-decoration-none" style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6' }} onClick={handleMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="nav-notification-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="p-3 text-center text-muted" style={{ fontSize: '11px', fontWeight: 600 }}>No notifications</div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.name}
                          onClick={() => handleNotificationClick(notif)}
                          className={`nav-notification-item ${!notif.read ? 'unread' : ''}`}
                          style={{ cursor: 'pointer', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <span className="notif-title" style={{ fontWeight: !notif.read ? 800 : 600, fontSize: '11px', color: '#1e293b' }}>
                              {notif.title}
                            </span>
                            <span className="notif-time text-muted" style={{ fontSize: '9px', whiteSpace: 'nowrap' }}>
                              {new Date(notif.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="notif-message mb-0 text-muted" style={{ fontSize: '10.5px', marginTop: '2px', lineHeight: '1.3' }}>
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ width: '1.5px', height: '22px', background: '#cbd5e1', opacity: 0.7 }} />

          <div className="d-flex align-items-center gap-3">
            <div className="text-end d-flex flex-column align-items-end">
              <span className="user-name" style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', lineHeight: '1.2' }}>
                {user?.full_name || (typeof user === 'string' ? user : '') || "Guest"}
              </span>
              <div className="d-flex align-items-center gap-2 mt-1">
                <small className="text-muted" style={{ fontSize: '10px', fontWeight: 600 }}>{formattedDate}</small>
                <div className="digital-decoder-clock" style={{ fontSize: '11px', padding: '2px 6px', height: '18px', display: 'inline-flex', alignItems: 'center' }}>
                  <div className="digital-decoder-bg">88:88:88</div>
                  <div className="digital-decoder-fg">{formattedTime}</div>
                </div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 d-flex align-items-center justify-content-center text-slate-500 shadow-sm shrink-0">
              <i className="bi bi-person fs-5"></i>
            </div>
            <i className="bi bi-power cursor-pointer nav-icon logout fs-5" onClick={handleLogout} title="Logout"></i>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;