import { useEffect, useState, useCallback, useRef } from "react";
import './NavBar.css';
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../Redux/Slices/userSlice";
import { persistor } from "../../Redux/store";
import { db } from "../../db";
import { RefreshCw, LayoutDashboard, ChevronLeft, Settings as SettingsIcon } from "lucide-react";
import Swal from 'sweetalert2';
import { authFetchBase } from "../../utils/authFetch";

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const session = useSelector((state) => state.user.session);
  const warehouse = useSelector((state) => state.user.warehouse);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const isSyncingRef = useRef(false);

  const checkSyncCount = useCallback(async () => {
    try {
      const count = await db.invoices.where('is_synced').equals(0).count();
      setPendingCount(count);
      return count;
    } catch (e) {
      return 0;
    }
  }, []);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || isSyncingRef.current) return;

    // ATOMIC SYNC LOCK: Prevent multiple tabs from syncing simultaneously
    const syncLock = localStorage.getItem('global_sync_lock');
    if (syncLock && (Date.now() - parseInt(syncLock)) < 30000) return;
    localStorage.setItem('global_sync_lock', Date.now().toString());

    isSyncingRef.current = true;
    setIsSyncInProgress(true);

    try {
      // 0. Opening Entries
      const pendingOpening = await db.opening_entries.where('is_synced').equals(0).toArray();
      for (const entry of pendingOpening) {
        try {
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
        } catch (e) { console.error("Opening Sync Error:", e); }
      }

      // 1. Bulk Sync Invoices
      const pendingInv = await db.invoices.where('is_synced').equals(0)
        .filter(inv => !inv.customer.startsWith('OFFLINE-CUST') && !inv.pos_opening_entry.startsWith('OFFLINE-SHIFT'))
        .toArray();

      if (pendingInv.length > 0) {
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
      console.error("Global Auto Sync Error:", error);
    } finally {
      localStorage.removeItem('global_sync_lock');
      isSyncingRef.current = false;
      setIsSyncInProgress(false);
      checkSyncCount();
    }
  }, [checkSyncCount]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const countCheckInterval = setInterval(checkSyncCount, 10000);
    const syncInterval = setInterval(syncPending, 60000);

    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial checks
    checkSyncCount();
    syncPending();

    return () => {
      clearInterval(timer);
      clearInterval(countCheckInterval);
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkSyncCount, syncPending]);


  const handleLogout = async () => {
    try {
      if (!navigator.onLine) {
        dispatch(logout()); await persistor.purge(); localStorage.clear();
        navigate("/"); return;
      }
      const response = await fetch("/api/method/logout", { method: "POST", credentials: "include" });
      dispatch(logout()); await persistor.purge(); localStorage.clear();
      Swal.fire({ icon: 'success', title: 'Logout successful!', timer: 1500, showConfirmButton: false });
      navigate("/");
    } catch (error) {
      dispatch(logout()); await persistor.purge(); localStorage.clear(); navigate("/");
    }
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <nav className="navbar navbar-expand-lg nav-div">
      <div className="container-fluid justify-content-between">
        <div className="d-flex align-items-center gap-3">
          {location.pathname !== '/homepage' && location.pathname !== '/' && (
            <ChevronLeft className="cursor-pointer" size={28} style={{ color: '#475569' }} onClick={() => navigate(-1)} />
          )}
          <div onClick={() => navigate('/homepage')} className="cursor-pointer">
            <h1 className="nav-title">Retail POS</h1>
          </div>
        </div>

        <div className="d-flex align-items-center gap-4 pe-3">
          <div className="d-flex align-items-center gap-2">
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
            <span className={`status-text ${isOnline ? 'text-online' : 'text-offline'}`}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {(pendingCount > 0 || isSyncInProgress) && (
            <div onClick={() => navigate('/syncmanager')} className="pending-badge">
              <RefreshCw size={12} className={isSyncInProgress ? "animate-spin" : ""} />
              {isSyncInProgress ? "Syncing..." : `${pendingCount} Pending`}
            </div>
          )}

          <SettingsIcon className="cursor-pointer nav-icon" onClick={() => navigate('/dashboard')} title="Dashboard" />
          <LayoutDashboard className="cursor-pointer nav-icon" onClick={() => navigate('/syncmanager')} title="Sync Manager" />
          <i className="bi bi-power cursor-pointer nav-icon logout" onClick={handleLogout} title="Logout"></i>

          <div className="text-end">
            <span className="user-name">{user || "Guest"}</span>
            <small className="nav-time">{formattedDate} | {formattedTime}</small>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;