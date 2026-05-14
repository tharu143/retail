import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, LayoutDashboard, ChevronLeft, Settings, Power, Wifi, WifiOff, User as UserIcon,
  Search, Layers, SearchSlash, ChevronRight, X, UserPlus, Loader2, CreditCard, Phone,
  DollarSign, Trash2, Info, Package, Palette, MonitorSmartphone, Camera, Video, Scan,
  ShoppingCart, Minus, Plus, Upload, Percent
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { logout, toggleTheme } from '../../Redux/Slices/userSlice';
import './Home.css';
import './LegacyPOS.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import OpeningEntryPage from '../../Pages/OpeningEntryPage';
import { db } from '../../db';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';
import POSService from '../../utils/posService';
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

// Isolated internal clock component to prevent flickering in the main POS page
const InvoiceNumberDisplay = ({ branchPrefix, userName, ddmm, sessionOrderCount, formatType, onToggleFormat, continuousCount }) => {
  const [tick, setTick] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const userNumMatch = userName?.match(/\d+$/);
  const userCode = userNumMatch ? `CS${userNumMatch[0]}` : 'CS1';

  let displayString = "";
  if (formatType === 'continuous') {
    const ddmmyy = format(tick, 'ddMMyy');
    displayString = `${branchPrefix || 'POS'}-${userCode}-${ddmmyy}-${String(continuousCount || 1).padStart(6, '0')}`;
  } else {
    // Legacy mode (No timestamp as requested)
    displayString = `${branchPrefix || 'POS'}-${userCode}-${ddmm}-${String(sessionOrderCount).padStart(3, '0')}`;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-8 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
        SEQUENCE
      </div>
      <input
        value={displayString}
        readOnly
        title="Offline ID generated according to the continuous sequence"
        className="offline-id-input w-48 h-8 px-3 text-center text-[12px] cursor-text font-black italic text-sky-600 bg-sky-50 outline-none border border-sky-200 rounded-lg shadow-sm"
      />
    </div>
  );
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
  const loading = useSelector((state) => state.user.loading || false);
  const user_roles = useSelector((state) => state.user.user_roles || []);
  const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");
  const isManager = useSelector((state) => state.user.is_manager || false) || isAdmin;

  const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [sessionOrderCount, setSessionOrderCount] = useState(1);

  // NEW: Legacy Classic Themes (for styles)
  const { legacySubTheme, setLegacySubTheme, isGreen, toggleTheme: toggleLegacyColor } = useLegacyTheme();

  // New ref for category horizontal scroll
  const categoryScrollRef = useRef(null);

  const classicStyles = useMemo(() => {
    const isGreen = legacySubTheme === 'green';
    const mainColor = isGreen ? '#1a6b52' : '#4a90d9';
    const darkColor = isGreen ? '#0d4a35' : '#0d3050';
    const lightColor = isGreen ? '#c8e8d4' : '#c5d8ed';
    const accentColor = '#e8c84a';
    const borderColor = isGreen ? '#4a9a72' : '#4a7aaa';
    const statusBarColor = isGreen ? '#8ac8a8' : '#8ab4d8';

    return `
      .classic-root {
        display: flex; flex-direction: column; height: 100vh; max-height: 100vh;
        background: ${mainColor}; color: ${isGreen ? '#0a2e1e' : '#0a1a30'};
        font-family: 'Share Tech Mono', 'Courier New', monospace;
        overflow: hidden;
      }
      .classic-titlebar {
        background: ${darkColor}; color: #d0ede0;
        padding: 4px 12px; display: flex;
        align-items: center; justify-content: space-between;
        border-bottom: 2px solid ${borderColor}; font-size: 12px; flex-shrink: 0;
      }
      .classic-nav {
        background: #ffffff !important;
        border-bottom: 1px solid #e2e8f0 !important;
        height: 85px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 0 1.25rem !important;
        flex-shrink: 0 !important;
        position: relative !important;
        z-index: 100 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
      }
      .classic-header-form {
        background: #ffffff !important;
        padding: 0.6rem 1.25rem !important;
        border-bottom: 1px solid #e2e8f0 !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 1.5rem !important;
        align-items: center !important;
        flex-shrink: 0 !important;
        position: relative !important;
        z-index: 110 !important;
        height: 70px !important;
      }
      .classic-field label { color: ${statusBarColor}; font-size: 10px; white-space: nowrap; font-weight: 900; letter-spacing: 0.5px; }
      .classic-field input, .classic-field select {
        background: #ffffff; border: 1.5px solid ${borderColor};
        padding: 6px 12px; font-size: 12px;
        font-family: inherit; color: #000; outline: none;
        border-radius: 12px;
        box-shadow: inset 1px 1px 2px rgba(0,0,0,0.1);
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
        background: #ffffff; border-top: 1px solid #e2e8f0;
        display: flex; align-items: center; padding: 0.5rem 2.5rem; flex-shrink: 0;
        height: 70px;
      }
      .shortcut-guide {
        display: flex; gap: 2rem; align-items: center;
      }
      .shortcut-item {
        display: flex; align-items: center; gap: 0.6rem;
        position: relative;
      }
      .shortcut-item:not(:last-child)::after {
        content: ''; position: absolute; right: -1rem; height: 12px; width: 1px; background: #e2e8f0;
      }
      .shortcut-key {
        background: linear-gradient(180deg, #334155 0%, #1e293b 100%);
        color: #ffffff; padding: 4px 8px; border-radius: 6px; 
        font-size: 11px; font-weight: 800; font-family: 'Share Tech Mono', monospace;
        box-shadow: 0 2px 0 #0f172a;
      }
      .shortcut-label {
        font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;
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

  // Offline Generation Toggle
  const [offlineIdType, setOfflineIdType] = useState(() => localStorage.getItem('offlineIdType') || 'continuous');
  const [continuousOrderCount, setContinuousOrderCount] = useState(() => parseInt(localStorage.getItem('offlineIdContinuousCount')) || 1);
  const [isSyncingCount, setIsSyncingCount] = useState(false);

  // Sync Continuous Count from Server on Mount
  useEffect(() => {
    const syncCount = async () => {
      if (offlineIdType !== 'continuous' || !user) return;
      
      try {
        setIsSyncingCount(true);
        const now = new Date();
        const bPrefix = branchPrefix || (typeof user === 'string' ? user.split('@')[0].slice(0, 3).toUpperCase() : 'POS');
        const usernamePart = typeof user === 'string' ? user.split('@')[0] : '';
        const userNumMatch = usernamePart.match(/\d+$/);
        const userCode = userNumMatch ? `CS${userNumMatch[0]}` : 'CS1';
        const year = format(now, 'yyyy');
        
        const searchPrefix = `${bPrefix}-${userCode}-`;
        const lastSeq = await POSService.getLastOfflineId(searchPrefix);
        
        if (lastSeq >= 0) {
          const localCount = parseInt(localStorage.getItem('offlineIdContinuousCount')) || 1;
          // Use whichever is higher
          const nextCount = Math.max(lastSeq + 1, localCount);
          setContinuousOrderCount(nextCount);
          localStorage.setItem('offlineIdContinuousCount', nextCount.toString());
        }
      } catch (err) {
        console.warn("Count sync failed:", err);
      } finally {
        setIsSyncingCount(false);
      }
    };
    syncCount();
  }, [offlineIdType, user, branchPrefix]);
  const setOfflineIdMethodHandle = (method) => {
    setOfflineIdType(method);
    localStorage.setItem('offlineIdType', method);
  };

  // Speed Checkout
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const mobileInputRef = useRef(null);
  const [lastInteractedItem, setLastInteractedItem] = useState(null);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const homeVideoRef = useRef(null);
  const homeCodeReader = useRef(null);

  if (!homeCodeReader.current) {
    const hints = new Map();
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_128
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);
    homeCodeReader.current = new BrowserMultiFormatReader(hints);
  }

  // External HID Scanner Buffer
  const scannerBuffer = useRef("");
  const lastKeyTime = useRef(0);

  const stopHomeCamera = () => {
    if (homeCodeReader.current) homeCodeReader.current.reset();
    setShowCamera(false);
  };

  const renderCommonModals = () => (
    <>
      {showDiscountModal && renderDiscountModal()}
      {showPaymentModal && renderPaymentModal()}
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
      {showCamera && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sky-100 text-sky-600 rounded-2xl shadow-inner">
                  <Video size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">POS Camera Scanner</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Quick Scan Mode Active</p>
                </div>
              </div>
              <button
                onClick={stopHomeCamera}
                className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center hover:text-slate-600 border border-slate-100 shadow-sm transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-900 shadow-inner group">
                <video
                  ref={homeVideoRef}
                  className="w-full h-full object-cover"
                />
                {/* OVERLAY GUIDES */}
                <div className="absolute inset-0 border-[2px] border-sky-400/30"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 border-[2px] border-sky-400 rounded-2xl shadow-[0_0_0_1000px_rgba(15,23,42,0.6)]">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-[4px] border-l-[4px] border-sky-400 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-[4px] border-r-[4px] border-sky-400 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-[4px] border-l-[4px] border-sky-400 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-[4px] border-r-[4px] border-sky-400 rounded-br-lg"></div>

                  <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-bounce"></div>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center gap-6">
                <div
                  className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-sky-400 hover:bg-sky-50 transition-all cursor-pointer group"
                  onDragOver={e => e.preventDefault()}
                  onDrop={onScanDrop}
                  onClick={() => document.getElementById('modal-image-upload')?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Scan size={32} className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      Drag & Drop Image or Click to Open File
                    </div>
                  </div>
                  <input id="modal-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageScan} />
                </div>

                <button
                  onClick={stopHomeCamera}
                  className="px-12 py-4 bg-slate-900 text-white font-black uppercase text-[12px] tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                >
                  Stop Scanner
                </button>
              </div>
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
      {showDraftsModal && (
        <div className="home-modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowDraftsModal(false)}>
          <div className="home-modal" style={{ maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="home-modal-header">
              <h3>Active Saved Orders (Drafts)</h3>
              <button className="home-modal-close" onClick={() => setShowDraftsModal(false)}><X size={20} /></button>
            </div>
            <div className="home-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {draftOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <Package size={48} style={{ margin: '0 auto 15px', opacity: 0.5 }} />
                  <p style={{ fontWeight: 700, fontSize: '16px' }}>No Active Draft Orders</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {draftOrders.map(draft => (
                    <div key={draft.id} style={{ 
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                          {draft.customerName || 'Cash Customer'} 
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px', fontWeight: 600 }}>{draft.mobile}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                          {draft.items.length} Items • Saved: {format(new Date(draft.timestamp), 'MMM dd, HH:mm')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>TOTAL</div>
                          <div style={{ fontWeight: 900, color: '#0ea5e9', fontSize: '18px' }}>AED {draft.grand_total?.toFixed(2)}</div>
                        </div>
                        <button 
                          onClick={() => loadDraftOrder(draft)}
                          style={{
                            background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px',
                            padding: '10px 20px', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.3)'
                          }}
                        >
                          RESUME
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showThemeSidebar && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end',
            transition: 'opacity 0.3s ease'
          }}
          onClick={() => setShowThemeSidebar(false)}
        >
          <div 
            style={{
              width: '340px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 25px -5px rgba(0,0,0,0.1), -10px 0 10px -5px rgba(0,0,0,0.04)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            {/* Sidebar Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette className="text-slate-700" size={18} />
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '14px', color: '#1e293b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Theme Customizer</h3>
              </div>
              <button 
                onClick={() => setShowThemeSidebar(false)} 
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                className="hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Section: Layout Style */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Layout Style</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => { if (theme === 'legacy') dispatch(toggleTheme()); }}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: theme !== 'legacy' ? '#0ea5e9' : '#e2e8f0',
                    background: theme !== 'legacy' ? '#f0f9ff' : '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Modern UI</span>
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Sleek, bright cards</span>
                </button>
                <button
                  onClick={() => { if (theme !== 'legacy') dispatch(toggleTheme()); }}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: theme === 'legacy' ? '#10b981' : '#e2e8f0',
                    background: theme === 'legacy' ? '#ecfdf5' : '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Classic UI</span>
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Retro POS terminal</span>
                </button>
              </div>
            </div>

            {/* Section: Color Palette (Only shown for legacy/classic layout) */}
            {theme === 'legacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Classic Accent Color</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => setLegacySubTheme('green')}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '2px solid',
                      borderColor: legacySubTheme === 'green' ? '#10b981' : '#e2e8f0',
                      background: legacySubTheme === 'green' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>Green Theme</span>
                  </button>
                  <button
                    onClick={() => setLegacySubTheme('blue')}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '2px solid',
                      borderColor: legacySubTheme === 'blue' ? '#0ea5e9' : '#e2e8f0',
                      background: legacySubTheme === 'blue' ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0ea5e9' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>Blue Theme</span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '16px', textAlign: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em' }}>RETAIL POS v1.2</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ---------- Auth ----------
  useEffect(() => {
    if (!user || !session) {
      navigate('/');
      return;
    }
    // Only show opening modal if NOT a manager
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

  // Drafts & Themes
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftOrders, setDraftOrders] = useState([]);
  const [showThemeSidebar, setShowThemeSidebar] = useState(false);

  // Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [payments, setPayments] = useState([]); // Array of { mode_of_payment, amount }

  const dropdownRef = useRef(null);
  const nameInputRef = useRef(null);

  // ---------- CALCULATIONS (Defined before handlers) ----------
  const subtotal = useMemo(() =>
    billItems.reduce((sum, item) => {
      // Calculate effective price for the selected UOM
      // If Box is selected and a specific Box price exists, use it. Otherwise, use piece price * factor.
      const factor = (item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1);
      const effectivePrice = (item.uom === 'Box' && item.prices?.Box) ? item.prices.Box : (item.price * factor);
      return sum + flt(effectivePrice * item.qty);
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
    const amt = parseFloat(tenderedAmount) || 0;
    if (!selectedPaymentMode || amt <= 0) return;
    const newPayment = {
      mode_of_payment: selectedPaymentMode,
      amount: round2(amt)
    };
    setPayments([...payments, newPayment]);
    setSelectedPaymentMode('');
    setTenderedAmount('');
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
      setTenderedAmount(String(round2(remaining > 0 ? remaining : 0)));
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
      let results = [];
      if (searchContext === 'header') {
        // strictly barcode search in header
        results = Items.filter(it =>
          (it.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(query)) ||
          (it.id || "").toLowerCase() === query // allow direct item code
        ).slice(0, 12);
      } else {
        // generic search in inline
        results = Items.filter(it =>
          (it.name || "").toLowerCase().includes(query) ||
          (it.id || "").toLowerCase().includes(query) ||
          (it.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(query))
        ).slice(0, 12);
      }
      setItemSearchResults(results);
      setShowItemDropdown(results.length > 0 || query.length > 2);
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
      const isActuallyOnline = !isOffline;
      if (isActuallyOnline) { // Strictly Online Check
        const results = await POSService.getItemCategories();
        if (results && results.length > 0) {
          const catNames = results.map(c =>
            (typeof c === 'string' ? c : (c.name || c.item_group_name || c.item_group)).toLowerCase()
          );
          // Combine with "all" and remove duplicates just in case
          const uniqueCats = ["all", ...new Set(catNames.sort())];
          setCategories(uniqueCats);
          await db.payment_modes.put({ name: 'categories', data: uniqueCats });
        }
      } else {
        const cached = await db.payment_modes.get('categories');
        if (cached && cached.data) setCategories(cached.data);
      }
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, [session, isOffline]);

  const fetchItems = useCallback(async (force = false) => {
    if (!session) return;
    try {
      if (Items.length === 0) {
        setLoadingItems(true);
      }
      setError("");







      let apiItems = [];
      const isActuallyOnline = !isOffline;

      if (isActuallyOnline) {
        try {
          // STRICT ONLINE MODE: Always fetch full state from server
          // If Admin, fetch all. If not, restrict by warehouse.
          const results = await POSService.getRetailItems(isAdmin ? {} : { warehouse: warehouse });
          if (results) {
            // Apply Branch Restriction if not Admin
            let filteredResults = results;
            if (!isAdmin) {
              filteredResults = results.filter(item => {
                if (item.branch_availability && item.branch_availability.length > 0) {
                  return item.branch_availability.some(ba => ba.warehouse === warehouse);
                }
                if (item.warehouse_details && item.warehouse_details.length > 0) {
                  return item.warehouse_details.some(wd => (wd.warehouse_name || wd.warehouse) === warehouse);
                }
                return true; 
              });
            }
            apiItems = filteredResults;

            // Background: Update local cache for offline fallback
            db.items.bulkPut(results.map(item => ({
              id: item.name,
              name: item.item_name,
              image: item.image,
              group: (item.item_group || "others").toLowerCase(),
              price: item.price_list_rate || 0,
              actual_qty: item.actual_qty || 0,
              local_qty: item.actual_qty || 0,
              total_qty: item.total_qty || item.actual_qty || 0,
              warehouse_details: item.warehouse_details || [],
              branch_availability: item.branch_availability || [],
              barcodes: item.barcodes || [],
              modified: item.modified,
              custom_pieces_per_box: item.custom_pieces_per_box || 1
            }))).catch(e => console.error("Dexie background update failed", e));
            
            if (results.length > 0) {
              const newestModified = results.reduce((max, item) => 
                (item.modified > max ? item.modified : max), "");
              localStorage.setItem('last_item_sync_time', newestModified || new Date().toISOString());
            }
          }
        } catch (fetchErr) {
          console.error("Strict Online fetch failed:", fetchErr);
          setError(`Server Connection (HTTP 500). Using local cache.`);
          apiItems = await db.items.toArray();
        }
      } else {
        // STRICT OFFLINE MODE: Use local Dexie cache
        let allCached = await db.items.toArray();
        if (!isAdmin) {
          allCached = allCached.filter(item => {
            if (item.branch_availability && item.branch_availability.length > 0) {
              return item.branch_availability.some(ba => ba.warehouse === warehouse);
            }
            if (item.warehouse_details && item.warehouse_details.length > 0) {
              return item.warehouse_details.some(wd => (wd.warehouse_name || wd.warehouse) === warehouse);
            }
            return true;
          });
        }
        apiItems = allCached;
        if (apiItems.length === 0) {
          setError("Offline: No local item cache found for your branch. Please connect to internet to sync.");
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
  }, [session, warehouse, categories.length, isOffline]);

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

  // ---------- ITEM HANDLERS ----------
  const handleFilter = (cat) => setSelectedCategory(cat);
  const handleAddToBill = (item) => {
    setLastInteractedItem(item);
    setBillItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        // --- Stock Verification ---
        // Get conversion factor for current UOM
        const factor = existing.uom_conversions?.[existing.uom] || (existing.uom === 'Box' ? (existing.custom_pieces_per_box || 1) : 1);
        const piecesNeeded = factor;
        const currentPieces = existing.qty * factor;

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
        // Default to Base UOM (usually Nos or Piece)
        const baseUom = item.uom_conversions?.Nos ? 'Nos' : (item.uom_conversions?.Piece ? 'Piece' : 'Nos');
        const initialPrice = item.prices?.[baseUom] || item.price || 0;

        return [...prev, {
          ...item,
          qty: 1,
          uom: baseUom,
          price: initialPrice // Set rate initially based on Base UOM
        }];
      }
    });
    barcodeInputRef.current?.focus();
  };

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
          custom_pieces_per_box: apiItem.pcs_per_box || apiItem.custom_pieces_per_box || 1,
          prices: apiItem.prices || {},
          uom_conversions: apiItem.uom_conversions || {},
          barcode_image: apiItem.barcode_image || null
        };

        // Fallback for prices if missing
        if (!itemToBill.prices.Nos && !itemToBill.prices.Piece) {
          itemToBill.prices = { "Nos": apiItem.price_list_rate || 0 };
        }
        if (!itemToBill.uom_conversions.Nos && !itemToBill.uom_conversions.Piece) {
          itemToBill.uom_conversions = { "Nos": 1 };
        }

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
          (item.id || "").toLowerCase() === barcode.trim().toLowerCase() ||
          item.barcodes?.some(b => (b.barcode || "").toLowerCase() === barcode.trim().toLowerCase())
        );

        if (foundLocal) {
          handleAddToBill(foundLocal);
          setBarcodeInput('');
        } else {
          // Tier 3: Global Discovery Fallback
          try {
            setSearchLoading(true);
            const globalRes = await POSService.findItemGlobally(barcode.trim());
            const it = globalRes?.message?.[0] || globalRes?.[0] || null;

            if (it) {
              const availableBranches = (it.warehouse_details || it.branch_availability || [])
                .filter(b => (b.actual_qty || b.qty || 0) > 0)
                .map(b => b.warehouse_name || b.warehouse)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(", ");

              Swal.fire({
                title: 'Item Found in Other Branches',
                html: `<div style="text-align: left; font-size: 14px;">
                        <p><b>${it.item_name || it.name}</b> is not enabled for <b>${warehouse}</b>.</p>
                        <p style="margin-top: 10px;">Stock available in:</p>
                        <p style="color: #059669; font-weight: 700;">${availableBranches || 'None (No physical stock)'}</p>
                       </div>`,
                icon: 'info',
                confirmButtonColor: '#4f46e5'
              });
              setBarcodeInput('');
            } else {
              Swal.fire('Not Found', 'Item not found in local or global database.', 'error');
              if (barcodeInputRef.current) {
                barcodeInputRef.current.style.backgroundColor = '#fee2e2';
                setTimeout(() => {
                  if (barcodeInputRef.current) barcodeInputRef.current.style.backgroundColor = '';
                }, 400);
              }
            }
          } catch (globalErr) {
            console.error("Global search failed:", globalErr);
            Swal.fire('Not Found', 'Item not found in database.', 'error');
          }
        }
      }
    } catch (err) {
      console.warn("Barcode search error:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [Items, warehouse, authFetch, handleAddToBill]);

  const triggerGlobalSearch = async (term) => {
    if (!term) return;
    try {
      setSearchLoading(true);
      const globalRes = await POSService.findItemGlobally(term.trim());
      const it = globalRes?.message?.[0] || globalRes?.[0] || null;
      if (it) {
        const availableBranches = (it.warehouse_details || it.branch_availability || [])
          .filter(b => (b.actual_qty || b.qty || 0) > 0)
          .map(b => b.warehouse_name || b.warehouse)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(", ");

        Swal.fire({
          title: 'Global Stock Check',
          html: `<div style="text-align: left; font-size: 14px;">
                  <p><b>${it.item_name || it.name}</b> is not in your branch catalog.</p>
                  <p style="margin-top: 10px;">Available Stock elsewhere:</p>
                  <p style="color: #059669; font-weight: 700;">${availableBranches || 'None in stock anywhere'}</p>
                 </div>`,
          icon: 'info',
          confirmButtonColor: '#4f46e5'
        });
      } else {
        Swal.fire('Not Found', 'Item not found in global database.', 'info');
      }
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      setSearchLoading(false);
      setShowItemDropdown(false);
    }
  };

  // ---------- CAMERA SCANNER ENGINE ----------
  if (!homeCodeReader.current) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    homeCodeReader.current = new BrowserMultiFormatReader(hints);
  }

  useEffect(() => {
    if (showCamera && homeVideoRef.current) {
      const startScanner = async () => {
        try {
          const constraints = {
            video: {
              facingMode: 'environment',
              width: { ideal: 640 },
              height: { ideal: 480 },
              aspectRatio: { ideal: 1.3333333333 }
            }
          };
          await homeCodeReader.current.decodeFromVideoDevice(constraints, homeVideoRef.current, (result, err) => {
            if (result && showCamera) {
              const scannedText = result.text.trim();
              handleBarcodeScan(scannedText);
              setShowCamera(false);
              homeCodeReader.current.reset();
            }
          });
        } catch (error) {
          try {
            await homeCodeReader.current.decodeFromVideoDevice(null, homeVideoRef.current, (result, err) => {
              if (result && showCamera) {
                handleBarcodeScan(result.text.trim());
                setShowCamera(false);
                homeCodeReader.current.reset();
              }
            });
          } catch (fallbackError) {
            Swal.fire('Camera Error', 'Could not open scanner.', 'error');
            setShowCamera(false);
          }
        }
      };
      startScanner();
    }
    return () => { if (homeCodeReader.current) homeCodeReader.current.reset(); };
  }, [showCamera, handleBarcodeScan]);

  const handleImageScan = async (fileOrEvent) => {
    let file;
    if (fileOrEvent.target && fileOrEvent.target.files) {
      file = fileOrEvent.target.files[0];
    } else {
      file = fileOrEvent; // Passed directly from drop
    }

    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const img = new Image();
          img.src = event.target.result;
          img.onload = async () => {
            try {
              const result = await homeCodeReader.current.decodeFromImageElement(img);
              if (result) {
                handleBarcodeScan(result.text.trim());
                Swal.fire({ title: 'Success', text: `Scanned: ${result.text}`, icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
              }
            } catch (err) {
              Swal.fire('Scan Failed', 'Could not find a valid barcode in this image.', 'error');
            }
          };
        } catch (err) {
          console.error("Image loading error:", err);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("File reading error:", err);
    }
  };

  const onScanDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageScan(file);
    }
  };

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
      } else if (barcodeInput.trim()) {
        const query = barcodeInput.trim();
        const localMatch = Items.find(it => it.id.toLowerCase() === query.toLowerCase() || (it.barcodes || []).some(b => b.barcode.toLowerCase() === query.toLowerCase()));
        if (localMatch) {
          handleAddToBill(localMatch);
          setBarcodeInput(''); setShowItemDropdown(false);
        } else {
          // NOT IN BRANCH PROMPT
          Swal.fire({
            title: 'Item Not in Branch!',
            text: `"${query}" was not found in ${warehouse}. Would you like to check the Global Industry Registry?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '🔄 Search Industry-wide',
            cancelButtonText: 'Close',
            confirmButtonColor: '#0284c7'
          }).then((result) => {
            if (result.isConfirmed) handleGlobalSearch(query);
          });
        }
      }
    } else if (e.key === 'Escape') {
      setShowItemDropdown(false);
      setActiveItemIndex(-1);
    }
  };

  // NEW: Request Stock from other warehouses
  const handleGlobalSearch = async (term) => {
    try {
      setSearchLoading(true);
      const res = await POSService.findItemGlobally(term);
      if (res && res.length > 0) {
        setItemSearchResults(res.map(it => ({
          ...it,
          id: it.name,
          name: it.item_name,
          is_global: true
        })));
        setShowItemDropdown(true);
      } else {
        Swal.fire('Not Found', 'This item does not exist in any branch.', 'info');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleEnableGlobalItem = async (item) => {
    try {
      Swal.fire({ title: 'Enabling Item for Branch...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await POSService.enableItemForBranch(item.id, warehouse);
      if (res && (res.success || res.message?.success)) {
        Swal.fire('Success', 'Item authorized for your branch!', 'success');
        handleAddToBill({ ...item, is_global: false });
        setBarcodeInput('');
        setShowItemDropdown(false);
        fetchItems(true);
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

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




  const toggleUom = (id, newUom) => {
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        // --- Stock Verification ---
        const factor = newUom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
        const totalPiecesNeeded = item.qty * factor;

        if (totalPiecesNeeded > item.local_qty) {
          Swal.fire('Out of Stock', `Insufficient stock to switch. Needed: ${totalPiecesNeeded}, Available: ${item.local_qty}`, 'warning');
          return item;
        }

        // Standard UOM toggle logic - set price based on UOM or keep base price
        const newPrice = item.prices?.[newUom] || item.price || 0;
        return { ...item, uom: newUom, price: newPrice };
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
        const currentQty = parseInt(i.qty) || 0;
        const newQty = Math.max(1, currentQty + delta);
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

  const setExactQuantity = (id, val) => {
    setBillItems(prev => prev.map(i => {
      if (i.id === id) {
        if (val === '') return { ...i, qty: '' };

        const newQty = parseInt(val);
        if (isNaN(newQty) || newQty < 0) return i;

        const currentQty = parseInt(i.qty) || 0;
        if (newQty > currentQty) {
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

  const setExactPrice = (id, val) => {
    setBillItems(prev => prev.map(i => {
      if (i.id === id) {
        if (val === '') {
          return { ...i, _price_input_val: '' };
        }
        const newPrice = parseFloat(val);
        if (isNaN(newPrice) || newPrice < 0) return i;

        const updated = { ...i, _price_input_val: val };
        if (i.uom === 'Box') {
          const prices = { ...i.prices, Box: newPrice };
          const factor = i.custom_pieces_per_box || 1;
          return { ...updated, price: newPrice / factor, prices };
        } else {
          const prices = { ...i.prices, Nos: newPrice, Piece: newPrice };
          return { ...updated, price: newPrice, prices };
        }
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
  const handlePrevSlide = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };
  const handleNextSlide = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
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
    setTenderedAmount(String(grandTotal));
  };

  // Removed updateLocalStock as backend now handles Smart Virtual Stock deduction
  // including pending POS sales.


  // ---------- SAVE DRAFT ----------
  const handleSaveDraft = async () => {
    if (billItems.length === 0) {
      Swal.fire('Info', 'No items to save as draft', 'info');
      return;
    }
    
    Swal.fire({
      title: 'Saving Draft...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const customerId = selectedCustomer?.name || selectedCustomer?.customer_name || customerName || 'Cash';

    // Construct backend payload format
    const draftPayload = {
      customer: customerId,
      customer_name: customerName,
      contact_mobile: phoneNumber,
      items: billItems.map(item => {
        const discRate = item.custom_pieces_per_box > 0 && item.uom === 'Box' 
          ? item.price * item.custom_pieces_per_box 
          : item.price;
        return {
          item_code: item.id,
          item_name: item.name || item.item_name,
          qty: item.qty,
          uom: item.uom,
          uom_type: item.uom,
          custom_pieces_per_box: item.custom_pieces_per_box,
          rate: discRate,
          price_list_rate: discRate,
          income_account: 'Sales of I/C - KSPL',
          warehouse: warehouse
        };
      }),
      company,
      pos_profile: posProfile,
      warehouse: warehouse,
      pos_opening_entry: posOpeningEntry,
      discount_amount: displayDiscount,
      apply_discount_on: "Net Total",
      tax_template: selectedTaxTemplate,
      taxes_and_charges: selectedTaxTemplate,
      posting_date: new Date().toISOString().slice(0, 10),
      currency: 'AED',
      due_date: new Date().toISOString().slice(0, 10),
      docstatus: 0,
      is_draft: true
    };

    try {
      const data = await POSService.createInvoice(draftPayload);
      if (data && (data.status === 'success' || data.name)) {
        const serverName = data.name || data.invoice_name;
        
        setBillItems([]);
        setDiscount({ type: 'amount', value: 0 });
        setCustomerName('Cash');
        setPhoneNumber('');
        setSelectedCustomer(null);
        
        Swal.fire({
          icon: 'success',
          title: 'Draft Saved',
          text: `Order has been saved as draft on server: ${serverName}`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(data?.message || 'Server did not return a valid response');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', `Could not save draft: ${err.message}`, 'error');
    }
  };

  const loadDraftOrder = async (draft) => {
    Swal.fire({
      title: 'Loading Draft Order...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await POSService.getDraftInvoiceDetails(draft.name);
      if (res && res.status === 'success') {
        // Map backend items back to frontend format
        const loadedItems = res.items.map(item => ({
          id: item.id || item.item_code,
          name: item.item_name,
          qty: item.qty,
          uom: item.uom,
          price: item.rate,
          custom_pieces_per_box: item.custom_pieces_per_box,
          image: item.image,
          category: item.category
        }));

        setBillItems(loadedItems);
        if (res.discount) {
          setDiscount(res.discount);
        } else {
          setDiscount({ type: 'amount', value: 0 });
        }
        setCustomerName(res.customer_name || res.customer || 'Cash');
        setPhoneNumber(res.mobile || '');
        if (res.tax_template) setSelectedTaxTemplate(res.tax_template);
        setShowDraftsModal(false);

        // Delete the draft on loading so it is removed from lists, 
        // preventing duplicates when editing or resaving
        await POSService.deleteDraftInvoice(draft.name);

        Swal.fire({
          icon: 'success',
          title: 'Draft Loaded',
          text: 'Draft order loaded into cart successfully!',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error(res?.message || 'Failed to fetch details');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', `Failed to load draft: ${e.message}`, 'error');
    }
  };

  const fetchDrafts = async () => {
    try {
      const drafts = await POSService.getDraftInvoices(posProfile);
      setDraftOrders((drafts || []).map(d => ({
        id: d.name,
        name: d.name,
        customerName: d.customer_name || d.customer,
        grand_total: d.grand_total,
        timestamp: new Date(d.creation).getTime(),
        creation: d.creation
      })));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (showDraftsModal) {
      fetchDrafts();
    }
  }, [showDraftsModal]);

  // ---------- COMPLETE PAYMENT ----------
  const completePayment = async () => {
    if (paymentLoading) return;
    let finalPayments = [...payments];

    // AUTO-CAPTURE: If there's an amount entered but not added to list, include it
    const amt = parseFloat(tenderedAmount) || 0;
    if (selectedPaymentMode && amt > 0) {
      finalPayments.push({
        mode_of_payment: selectedPaymentMode,
        amount: round2(amt)
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
      // Prefix: Use branchPrefix (e.g., AJM) or first 3 of username
      const bPrefix = branchPrefix || user?.split('@')[0].slice(0, 3).toUpperCase() || 'POS';

      // User Code: Extract digits or identifier before @
      const usernamePart = user?.split('@')[0] || '';
      const userNumMatch = usernamePart.match(/\d+$/);
      const userCode = userNumMatch ? `CS${userNumMatch[0]}` : 'CS1';

      if (offlineIdType === 'continuous') {
        const ddmmyy = format(now, 'ddMMyy');
        return `${bPrefix}-${userCode}-${ddmmyy}-${String(continuousOrderCount).padStart(6, '0')}`;
      } else {
        const ddmm = format(now, 'ddMM');
        // Removed timeStr to satisfy "no timestamp" request
        return `${bPrefix}-${userCode}-${ddmm}-${String(sessionOrderCount).padStart(3, '0')}`;
      }
    };

    const offlineId = generateOfflineId();

    const payload = {
      offline_id: offlineId,
      customer: customerId,
      contact_mobile: phoneNumber,
      items: billItems.map(item => {
        const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
        const effectivePrice = (item.uom === 'Box' && item.prices?.Box) ? item.prices.Box : (item.price * factor);
        return {
          item_code: item.id,
          item_name: item.name,
          quantity: item.qty,
          uom: item.uom,
          uom_type: item.uom,
          custom_pieces_per_box: item.custom_pieces_per_box,
          basePrice: item.price,
          rate: effectivePrice,
          price_list_rate: effectivePrice,
          income_account: 'Sales of I/C - KSPL',
          warehouse: warehouse
        };
      }),
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
      taxes_and_charges: selectedTaxTemplate,
      posting_date: new Date().toISOString().slice(0, 10),
      currency: 'AED',
      due_date: new Date().toISOString().slice(0, 10),
      account_manager: user
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
    setSelectedPaymentMode(''); setTenderedAmount('');
    setPayments([]);
    setShowPaymentModal(false);
    barcodeInputRef.current?.focus();

    if (offlineIdType === 'continuous') {
      const nextCount = continuousOrderCount + 1;
      setContinuousOrderCount(nextCount);
      localStorage.setItem('offlineIdContinuousCount', nextCount.toString());
    }
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
              // Try searching for the exact customer by mobile number
              const listRes = await frappeCall({
                method: 'frappe.client.get_list',
                args: { doctype: 'Customer', filters: [['mobile_no', '=', searchTerm]], fields: ['name', 'customer_name', 'mobile_no'] }
              });
              if (listRes && listRes.length > 0) {
                pickCustomer(listRes[0]);
                const Toast = Swal.mixin({
                  toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                });
                Toast.fire({ icon: 'success', title: `Customer: ${listRes[0].customer_name || listRes[0].name}` });
                return;
              }
            } catch (e2) { }
          }
          console.error("Customer lookup failed", err);
          // If auto-create and fetch fails completely, open the Create Custom Modal automatically
          openCreate();
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
        <div className="home-modal-footer" style={{ gap: '12px', padding: '20px' }}>
          <button 
            className="home-modal-cancel" 
            onClick={clearDiscount}
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '12px', 
              background: '#f1f5f9', 
              color: '#64748b', 
              fontWeight: 800, 
              fontSize: '13px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              transition: 'all 0.2s'
            }}
          >
            Clear
          </button>
          <button 
            className="home-modal-apply" 
            onClick={() => { setDiscount({ ...discount, value: parseFloat(discountInput) || 0 }); setShowDiscountModal(false); }}
            style={{ 
              flex: 2, 
              padding: '12px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
              color: '#ffffff', 
              fontWeight: 800, 
              fontSize: '13px', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );

  const renderPaymentModal = () => (
    <div className="home-modal-overlay" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }} style={{ zIndex: 9999 }}>
      <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div className="home-modal-header bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Add Payment</h3>
          <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}><X size={24} /></button>
        </div>

        <div className="home-modal-body p-8 flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-sky-50 border-2 border-sky-100 p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase tracking-widest text-sky-600/70">Total Amount</span>
              <span className="text-xs font-black uppercase tracking-widest text-sky-600/70">Paid So Far</span>
            </div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-2xl font-black text-slate-800">AED {grandTotal.toFixed(2)}</span>
              <span className="text-2xl font-black text-emerald-600">AED {totalPaid.toFixed(2)}</span>
            </div>
            <div className="pt-4 border-t border-sky-200/50 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-wide text-slate-500">
                {balanceRemaining > 0 ? 'Balance to Pay' : 'Change Due'}
              </span>
              <span className={`text-3xl font-black ${balanceRemaining > 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                AED {Math.abs(balanceRemaining).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Added Payments List */}
          {payments.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Current Ledger</h4>
              <div className="flex flex-col gap-2">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.mode_of_payment === 'Cash' ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                        {p.mode_of_payment === 'Cash' ? <DollarSign size={20} /> : <CreditCard size={20} />}
                      </div>
                      <span className="font-bold text-slate-700">{p.mode_of_payment}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-slate-900">AED {p.amount.toFixed(2)}</span>
                      <button onClick={() => removePayment(idx)} className="text-rose-400 hover:text-rose-600 p-2 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Selection Area */}
          {balanceRemaining > 0 && (
            <div className="flex flex-col gap-4">
              {!selectedPaymentMode ? (
                <>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Method</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      className="group p-6 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex flex-col items-center gap-3 hover:bg-emerald-600 hover:border-emerald-600 transition-all hover:shadow-lg active:scale-95"
                      onClick={() => setSelectedPaymentMode('Cash')}
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all">
                        <DollarSign size={28} />
                      </div>
                      <span className="font-black uppercase tracking-widest text-emerald-700 group-hover:text-white">Cash Payment</span>
                    </button>
                    <button
                      className="group p-6 bg-sky-50 border-2 border-sky-100 rounded-2xl flex flex-col items-center gap-3 hover:bg-sky-600 hover:border-sky-600 transition-all hover:shadow-lg active:scale-95"
                      onClick={() => setSelectedPaymentMode('Credit Card')}
                    >
                      <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-all">
                        <CreditCard size={28} />
                      </div>
                      <span className="font-black uppercase tracking-widest text-sky-700 group-hover:text-white">Card Payment</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-sky-200 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{selectedPaymentMode} Amount</span>
                    <button onClick={() => setSelectedPaymentMode('')} className="text-xs font-bold text-sky-600 hover:underline">Change Mode</button>
                  </div>
                  <div className="mb-4 flex items-center bg-white border-2 border-sky-500 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-sky-100 transition-all">
                    <span className="pl-6 pr-3 text-xl font-black text-slate-400">AED</span>
                    <input
                      type="number"
                      value={tenderedAmount}
                      onChange={e => setTenderedAmount(e.target.value)}
                      className="w-full pr-6 py-4 bg-transparent text-3xl font-black text-slate-900 outline-none"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                    />
                  </div>
                  <button
                    onClick={addPayment}
                    className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-95 transition-all"
                  >
                    Confirm AED {(parseFloat(tenderedAmount) || 0).toFixed(2)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="home-modal-footer p-6 bg-slate-50 flex justify-between items-center border-t border-slate-100">
          <button
            className="px-8 py-3 text-slate-500 font-black uppercase tracking-widest hover:text-slate-700 transition-all"
            onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}
          >
            Cancel
          </button>
          <button
            onClick={completePayment}
            disabled={paymentLoading || balanceRemaining > 0}
            className={`px-10 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-3 ${balanceRemaining <= 0
                ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
          >
            {paymentLoading ? <Loader2 size={20} className="animate-spin" /> : <Package size={20} />}
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
                                <td class="text-right" style="padding-right: 5px;">${it.qty || 1} <span style="font-size: 0.85em; opacity: 0.8;">${it.uom || ''}</span></td>
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
      // 1. GLOBAL HID SCANNER LISTENER (Intercepts rapid digits)
      const now = Date.now();
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

      // If user is not typing in a specific input, or if it's very fast (typical of hardware scanners)
      if (now - lastKeyTime.current > 150) {
        scannerBuffer.current = ""; // Reset buffer if typing is too slow to be a scanner
      }
      lastKeyTime.current = now;

      if (e.key.length === 1 && /^[0-9]$/.test(e.key)) {
        scannerBuffer.current += e.key;
      } else if (e.key === 'Enter' && scannerBuffer.current.length >= 6) {
        // Hardware Scanner finished sequence (min 6 chars for retail codes)
        e.preventDefault();
        const scanValue = scannerBuffer.current;
        scannerBuffer.current = "";
        handleBarcodeScan(scanValue);
        return;
      }

      // 2. KEYBOARD SHORTCUTS
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

      // Space or F12: Open Payment (Global focus handling)
      if ((e.key === ' ' || e.key === 'F12') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
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
  }, [billItems.length, showPaymentModal, showDiscountModal, showItemDropdown, selectedPaymentMode, showOpeningModal, lastInteractedItem, balanceRemaining, tenderedAmount, paymentLoading, handleBarcodeScan]);

  if (loadingItems && Items.length === 0) return <div className="home-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><p>Loading items...</p></div>;

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

  // ---------- LIGHT THEME RENDERER (Emerald & Slate) ----------
  const renderLightTheme = () => {
    return (
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
            onClick={() => setShowThemeSidebar(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0 0.85rem', height: '2.2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              border: '1.5px solid #cbd5e1', borderRadius: '0.5rem',
              fontSize: '0.75rem', fontWeight: 900, color: '#334155',
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            className="hover:bg-slate-100 hover:border-slate-400 active:scale-95 flex items-center gap-1.5"
            title="Configure Themes & Layouts"
          >
            <Palette size={14} className="text-indigo-600" /> Theme Customizer
          </button>

          <div className="flex-1"></div>
          
          <button
            onClick={() => setShowDraftsModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0 0.75rem', height: '2rem', background: '#f0f9ff',
              border: '1.5px solid #bae6fd', borderRadius: '0.375rem',
              fontSize: '0.7rem', fontWeight: 850, color: '#0369a1',
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase', marginRight: '0.5rem'
            }}
          >
            <Package size={12} /> ACTIVE ORDERS
          </button>

          {/* Persistent Top-Right User Header */}
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm mr-2" style={{ height: '2.5rem' }}>
            <div className="flex flex-col items-end text-right">
              <span className="text-[9px] font-black uppercase leading-tight">
                <span className="text-slate-400 mr-1">USER:</span>
                <span className="text-slate-800">{user?.full_name || user || 'CASHIER'}</span>
              </span>
              <span className="text-[9px] font-black uppercase leading-tight mt-0.5">
                <span className="text-slate-400 mr-1">BRANCH:</span>
                <span className="text-emerald-600">{warehouse}</span>
              </span>
              <span className="text-[8px] font-bold uppercase mt-0.5 tracking-tighter">
                <span className="text-slate-400 mr-1">DATE:</span>
                <span className="text-slate-500">{format(currentTime, 'MMM dd, yyyy | HH:mm:ss')}</span>
              </span>
            </div>
            <div className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400">
              <UserIcon size={14} />
            </div>
          </div>

          <button onClick={handleLogout} className="text-rose-500 hover:text-rose-700 transition-all p-1 hover:bg-rose-50 rounded-full mr-2" title="Logout">
            <Power size={18} />
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="so-btn-primary"
            style={{ padding: '0 1.25rem', height: '2.5rem' }}
          >
            <LayoutDashboard size={14} /> Dashboard
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
                )
                ))}
            </div>
          </div>

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
                    <div className="relative flex justify-between items-start">
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
                            {item.qty > 1 ? <Minus size={11} className="opacity-40" /> : <X size={11} className="text-rose-400" />}
                          </button>
                          <input
                            id={`qty-input-${idx}`}
                            className="so-bill-qty-input"
                            value={item.qty}
                            onChange={(e) => setQuantity(item.id, e.target.value)}
                          />
                          <button onClick={() => updateQuantity(item.id, 1)} className="so-bill-qty-btn text-emerald-500"><Plus size={11} /></button>
                        </div>
                      </div>
                      <button onClick={() => removeFromBill(item.id)} className="so-bill-remove">
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
              {/* Sales Taxes and Charges Template Dropdown */}
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Sales Taxes & Charges
                </label>
                <div className="relative">
                  <select
                    value={selectedTaxTemplate}
                    onChange={(e) => setSelectedTaxTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold cursor-pointer transition-all duration-200 hover:bg-slate-50"
                  >
                    {taxTemplates.length === 0 ? (
                      <option value="">No Tax Templates Available</option>
                    ) : (
                      taxTemplates.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                    <Percent size={14} />
                  </div>
                </div>
              </div>

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
                  onClick={handleSaveDraft}
                  className="so-btn-secondary flex-1"
                  style={{ color: '#d97706', borderColor: '#fef3c7' }}
                  disabled={billItems.length === 0}
                >
                  <Package size={14} /> Save Draft
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
                className={`so-btn-pay ${paymentLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={grandTotal <= 0 || paymentLoading}
                onClick={handleCheckout}
              >
                {paymentLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <CreditCard size={18} /> Confirm & Pay (Space)
                  </>
                )}
              </button>
            </div>
          </aside>
        </main>

        {renderCommonModals()}
      </div>
    );
  };


  // ---------- MAIN RENDER CONTEXT ----------
  // MODERN THEME (Simplified Priority Render)
  if (theme !== 'legacy') {
    return renderLightTheme();
  }

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
            <span className="text-[32px] font-black text-slate-800 tracking-tighter uppercase leading-none select-none">
              POS<span className={isGreen ? 'text-emerald-500' : 'text-sky-500'}>8</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-6 pr-4">
            
            {/* Quick Actions / Status grouped together */}
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className={`flex items-center gap-2 font-black text-[11px] uppercase tracking-wider ${isOffline ? 'text-rose-600' : (isGreen ? 'text-emerald-700' : 'text-sky-700')}`}>
                {isOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </div>
              <div className="w-[1px] h-4 bg-slate-300"></div>
              <button
                onClick={() => setShowThemeSidebar(true)}
                className={`font-black text-[11px] uppercase tracking-wider transition-all hover:scale-105 flex items-center gap-1.5 ${isGreen ? 'text-emerald-700' : 'text-sky-700'}`}
                title="Open Theme Settings Sidebar"
              >
                <Palette size={13} /> THEME CONFIG
              </button>
              <div className="w-[1px] h-4 bg-slate-300"></div>
              <button
                onClick={() => setShowDraftsModal(true)}
                className={`font-black text-[11px] uppercase tracking-wider transition-all hover:scale-105 flex items-center gap-1.5 ${isGreen ? 'text-emerald-700' : 'text-sky-700'}`}
              >
                <Package size={14} />
                ACTIVE ORDERS
              </button>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className={`font-black text-[12px] uppercase tracking-wider transition-all hover:underline decoration-2 underline-offset-4 ${isGreen ? 'text-emerald-700' : 'text-sky-700'}`}
            >
              DASHBOARD
            </button>

            {/* User Info with Labels */}
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm ml-2">
              <div className="flex flex-col items-end text-right">
                <span className="text-[10px] font-black uppercase leading-tight">
                  <span className="text-slate-400 mr-1">USER:</span>
                  <span className="text-slate-800">{user?.full_name || user || 'CASHIER'}</span>
                </span>
                <span className="text-[10px] font-black uppercase leading-tight mt-0.5">
                  <span className="text-slate-400 mr-1">BRANCH:</span>
                  <span className={isGreen ? 'text-emerald-600' : 'text-sky-600'}>{warehouse}</span>
                </span>
                <span className="text-[9px] font-bold uppercase mt-1 tracking-tighter">
                  <span className="text-slate-400 mr-1">DATE:</span>
                  <span className="text-slate-500">{format(currentTime, 'MMM dd, yyyy | HH:mm:ss')}</span>
                </span>
              </div>
              <div className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400">
                <UserIcon size={18} />
              </div>
            </div>

            <button onClick={handleLogout} className="text-rose-500 hover:text-rose-700 transition-all p-1 hover:bg-rose-50 rounded-full ml-2">
              <Power size={20} />
            </button>
          </div>
        </nav>

        {/* CLASSIC HEADER FORM */}
        <div className="classic-header-form">
          <div className="classic-field flex items-center gap-3 relative">
            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">CUSTOMER</label>
            <div className="relative group" ref={dropdownRef}>
              <input
                ref={mobileInputRef}
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
                className="w-48 h-8 px-3 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-900 outline-none focus:border-sky-500 transition-all bg-slate-50/50"
                placeholder="Mobile or Name..."
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-64 bg-white border-2 border-slate-900 shadow-[4px_4px_0_rgba(0,0,0,0.1)] z-[9999] max-h-48 overflow-y-auto mt-1">
                  {searchResults.map(c => (
                    <div key={c.name} className={`p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-[11px] font-bold text-slate-900`} onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}>
                      {c.customer_name} — {c.mobile_no}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="classic-field flex items-center gap-3 relative">
            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">BARCODE</label>
            <div className="flex items-center gap-1.5" ref={itemDropdownRef}>
              <input
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={e => { setBarcodeInput(e.target.value); setSearchContext('header'); setShowItemDropdown(true); }}
                onKeyDown={onBarcodeKeyDown}
                onFocus={() => { setBarcodeInput(''); setSearchContext('header'); setShowItemDropdown(false); setActiveItemIndex(-1); }}
                onClick={() => { setBarcodeInput(''); setSearchContext('header'); setShowItemDropdown(false); }}
                onBlur={() => setTimeout(() => setShowItemDropdown(false), 300)}
                id="legacy-header-search"
                className="w-48 h-8 px-3 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-900 outline-none focus:border-sky-500 transition-all bg-amber-50/30"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCamera(true)}
                  className="w-8 h-8 bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-all rounded-lg shadow-sm"
                  title="Camera Scanner"
                >
                  <Camera size={16} />
                </button>
                <label className="w-8 h-8 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg cursor-pointer shadow-sm relative flex items-center justify-center" title="Upload Image File" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="flex items-center justify-center mt-1">
                    <Upload size={16} />
                  </div>
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handleImageScan} />
                </label>
              </div>
            </div>
          </div>

          <div className="classic-field flex items-center gap-3 ml-auto">
            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">INV NO:</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <InvoiceNumberDisplay
                branchPrefix={branchPrefix}
                userName={user?.split('@')[0]}
                ddmm={format(new Date(), 'ddMM')}
                sessionOrderCount={sessionOrderCount}
                formatType={offlineIdType}
                onToggleFormat={setOfflineIdMethodHandle}
                continuousCount={continuousOrderCount}
              />
              {isSyncingCount && (
                <div style={{ position: 'absolute', right: '-20px', display: 'flex', alignItems: 'center' }}>
                  <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CLASSIC MAIN BODY */}
        <div className="flex-1 flex overflow-hidden">
          <div className="classic-entry-area">
            {/* GRID SECTION */}
            <div className="flex-1 overflow-auto bg-slate-100 pb-16">
              <table className="classic-table">
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 30 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center">#</th>
                    <th className="text-center">ITEM CODE</th>
                    <th className="text-center">DESCRIPTION</th>
                    <th className="text-center">UOM</th>
                    <th className="text-center">QTY</th>
                    <th className="text-center">PCS</th>
                    <th className="text-center">PRICE</th>
                    <th className="text-center">VAT (5%)</th>
                    <th className="text-center">TOTAL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item, idx) => {
                    const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
                    const effectivePrice = (item.uom === 'Box' && item.prices?.Box) ? item.prices.Box : (item.price * factor);
                    const lineTotal = item.qty * effectivePrice;
                    return (
                      <tr key={idx} className="bg-white hover:bg-amber-50 group border-b border-slate-100">
                        <td className="text-center font-bold text-slate-400 text-[10px]">{idx + 1}</td>
                        <td className="px-2 font-bold text-slate-900 text-center">
                          <span className="classic-cell-text" title={item.item_code || item.id}>{item.item_code || item.id}</span>
                        </td>
                        <td className="p-0">
                          <input
                            type="text"
                            value={item.item_name || item.name}
                            onChange={e => {
                              const newBill = [...billItems];
                              if (newBill[idx].item_name !== undefined) newBill[idx].item_name = e.target.value;
                              else newBill[idx].name = e.target.value;
                              setBillItems(newBill);
                            }}
                            className="w-full h-full px-2 font-black text-slate-700 uppercase bg-transparent border-none outline-none focus:bg-amber-100 placeholder:text-slate-300"
                            placeholder="Description"
                          />
                        </td>
                        <td className="p-0">
                          <select
                            value={item.uom}
                            onChange={e => toggleUom(item.id, e.target.value)}
                            className="w-full h-full bg-slate-50 font-black text-[12px] text-center text-slate-700 border-none outline-none focus:bg-amber-200 cursor-pointer hover:bg-slate-100 transition-colors"
                          >
                            <option value="Piece">Pc</option>
                            {item.custom_pieces_per_box > 0 && <option value="Box">Box ({item.custom_pieces_per_box})</option>}
                          </select>
                        </td>
                        <td className="p-0">
                          <input
                            id={`qty-input-${idx}`}
                            type="number"
                            value={item.qty === 0 ? '' : item.qty}
                            onChange={e => setExactQuantity(item.id, e.target.value)}
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
                            className="w-full h-full text-center px-2 font-black text-sky-600 focus:bg-amber-100 outline-none border-none"
                          />
                        </td>
                        <td className="text-center px-2 font-black text-amber-600 bg-amber-50">
                          {item.qty * factor}
                        </td>
                        <td className="p-0">
                          <input
                            type="number"
                            step="0.01"
                            value={item._price_input_val !== undefined ? item._price_input_val : (parseFloat(effectivePrice) || 0).toFixed(2)}
                            onChange={e => setExactPrice(item.id, e.target.value)}
                            className="w-full h-full text-center px-2 font-black text-slate-800 focus:bg-amber-100 outline-none border-none"
                            onFocus={e => e.target.select()}
                          />
                        </td>
                        <td className="text-center px-2 font-bold text-slate-500 text-[10px] italic">
                          {(lineTotal * 0.05).toFixed(2)}
                        </td>
                        <td className="text-center px-2 font-black text-slate-900 bg-slate-50/50">AED {(parseFloat(lineTotal) || 0).toFixed(2)}</td>
                        <td className="text-center">
                          <button onClick={() => removeFromBill(item.id)} className="text-rose-400 hover:text-rose-600 font-bold">×</button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* ADVANCED: Smart Inline Search Row (The "Active" Empty Row) */}
                  <tr
                    className={`${isGreen ? 'bg-emerald-50/50' : 'bg-sky-50/50'} border-y-2 border-amber-400 group relative cursor-pointer hover:bg-amber-100/30 transition-all`}
                    onClick={() => { const el = document.getElementById('legacy-inline-search'); if (el) el.focus(); setSearchContext('inline'); setShowItemDropdown(true); }}
                  >
                    <td className="text-center font-bold text-amber-600">{billItems.length + 1}</td>
                    <td colSpan={2} className="p-0 relative h-10">
                      <input
                        type="text"
                        id="legacy-inline-search"
                        className="w-full h-full px-4 font-black italic text-slate-400 focus:text-slate-900 bg-transparent outline-none placeholder:text-slate-300 cursor-pointer"
                        placeholder="SCAN BARCODE OR TYPE ITEM NAME HERE TO ADD..."
                        value={barcodeInput}
                        onChange={e => { setBarcodeInput(e.target.value); setSearchContext('inline'); setShowItemDropdown(true); }}
                        onFocus={() => { setBarcodeInput(''); setSearchContext('inline'); setShowItemDropdown(false); setActiveItemIndex(-1); }}
                        onClick={(e) => { e.stopPropagation(); setBarcodeInput(''); setSearchContext('inline'); setShowItemDropdown(false); }}
                        onBlur={() => setTimeout(() => setShowItemDropdown(false), 300)}
                        onKeyDown={onBarcodeKeyDown}
                      />
                      {/* Fixed-position dropdown — avoids overflow:auto clipping — shifted for UOM column */}
                      {showItemDropdown && itemSearchResults.length > 0 && searchContext === 'inline' && (() => {
                        const searchEl = document.getElementById('legacy-inline-search');
                        if (!searchEl) return null;
                        const rect = searchEl.getBoundingClientRect();
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
                                  textAlign: 'left',
                                  background: activeItemIndex === i ? (isGreen ? '#fef3c7' : '#e0f2fe') : (i === 0 ? (isGreen ? '#f0fdf4' : '#f0f9ff') : '#fff')
                                }}
                                className={activeItemIndex === i ? 'active-dropdown-item' : ''}
                                onMouseDown={(e) => { e.preventDefault(); handleAddToBill(it); setBarcodeInput(''); setShowItemDropdown(false); const el2 = document.getElementById('legacy-inline-search'); if (el2) el2.focus(); }}
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
                    <td className="text-center bg-black/5">-</td>
                    <td className="text-center bg-black/5">-</td>
                    <td className="text-center bg-black/5">-</td>
                    <td className="text-center bg-black/5">-</td>
                    <td className="text-center bg-black/5">-</td>
                    <td className="text-center px-2 font-black text-amber-600 bg-black/5">NEXT ITEM</td>
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
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td className="border-r border-white/10"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BOTTOM BAR: SHORTCUTS & TOTALS */}
            <div className="classic-bottom-bar flex items-center justify-between px-6 py-3">
              {/* Shortcut Overview on the Left */}
              <div className="shortcut-guide flex gap-3 flex-none">
                <button
                  onClick={() => mobileInputRef.current?.focus()}
                  className="shortcut-item flex items-center gap-2 bg-white/40 hover:bg-slate-50 border border-slate-200/60 p-1.5 rounded-lg transition-all active:scale-95 group cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                  title="Click to search customer (F2)"
                >
                  <span 
                    className="shortcut-key px-2.5 py-1 rounded font-black text-xs text-white shadow-md transition-transform group-hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                  >
                    F2
                  </span>
                  <span className="shortcut-label text-[11px] font-black text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Customer</span>
                </button>

                <button
                  onClick={() => barcodeInputRef.current?.focus()}
                  className="shortcut-item flex items-center gap-2 bg-white/40 hover:bg-slate-50 border border-slate-200/60 p-1.5 rounded-lg transition-all active:scale-95 group cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                  title="Click to search items (F4)"
                >
                  <span 
                    className="shortcut-key px-2.5 py-1 rounded font-black text-xs text-white shadow-md transition-transform group-hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)', textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                  >
                    F4
                  </span>
                  <span className="shortcut-label text-[11px] font-black text-slate-500 uppercase tracking-wider group-hover:text-purple-600 transition-colors">Search</span>
                </button>

                <button
                  onClick={() => {
                    if (lastInteractedItem) {
                      handleFindNearestStock(lastInteractedItem);
                    } else {
                      alert('Please select or search for an item first to check warehouse stock!');
                    }
                  }}
                  className="shortcut-item flex items-center gap-2 bg-white/40 hover:bg-slate-50 border border-slate-200/60 p-1.5 rounded-lg transition-all active:scale-95 group cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                  title="Click to check warehouse stock (F8)"
                >
                  <span 
                    className="shortcut-key px-2.5 py-1 rounded font-black text-xs text-white shadow-md transition-transform group-hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                  >
                    F8
                  </span>
                  <span className="shortcut-label text-[11px] font-black text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Stock</span>
                </button>

                <button
                  onClick={() => { if (billItems.length > 0) handleCheckout(); }}
                  className="shortcut-item flex items-center gap-2 bg-white/40 hover:bg-emerald-50 border border-emerald-200/60 p-1.5 rounded-lg transition-all active:scale-95 group cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                  disabled={billItems.length === 0}
                  title="Click to checkout & pay (F12)"
                >
                  <span 
                    className="shortcut-key px-2.5 py-1 rounded font-black text-xs text-white shadow-md transition-transform group-hover:-translate-y-0.5"
                    style={{ 
                      background: billItems.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : '#94a3b8', 
                      textShadow: '0 1px 1px rgba(0,0,0,0.2)',
                      opacity: billItems.length > 0 ? 1 : 0.6 
                    }}
                  >
                    F12
                  </span>
                  <span className="shortcut-label text-[11px] font-black text-emerald-600 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">Pay</span>
                </button>
              </div>

              {/* Totals Section grouped together on the Right with clean divider columns */}
              <div className="flex items-center gap-6 ml-auto flex-none">
                {/* Tax Template Selector */}
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TAX TEMPLATE:</span>
                  <select
                    value={selectedTaxTemplate}
                    onChange={(e) => setSelectedTaxTemplate(e.target.value)}
                    className={`bg-slate-100 border border-slate-200 text-[11px] font-black rounded px-3 py-1 cursor-pointer focus:outline-none transition-all ${isGreen ? 'text-emerald-700' : 'text-sky-700'}`}
                  >
                    {taxTemplates.length === 0 ? (
                      <option value="">No Tax Templates</option>
                    ) : (
                      taxTemplates.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="h-8 w-[1.5px] bg-slate-200" />

                {/* Subtotal */}
                <div className="flex flex-col items-end">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">SUBTOTAL</label>
                  <span className="text-slate-900 font-black text-xl leading-none">AED {displaySubtotal.toFixed(2)}</span>
                </div>

                {displayDiscount > 0 && (
                  <>
                    <div className="h-8 w-[1.5px] bg-slate-200" />
                    <div className="flex flex-col items-end">
                      <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-0.5">
                        DISCOUNT {(discount.type === 'percentage' || discount.type === 'percent') ? `(${discount.value}%)` : ''}
                      </label>
                      <span className="text-rose-500 font-black text-xl leading-none">-AED {displayDiscount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="h-8 w-[1.5px] bg-slate-200" />

                {/* VAT */}
                <div className="flex flex-col items-end">
                  <label className={`text-[10px] font-black ${isGreen ? 'text-emerald-500' : 'text-sky-500'} uppercase tracking-widest mb-0.5`}>VAT ({taxRate}%)</label>
                  <span className={`${isGreen ? 'text-emerald-500' : 'text-sky-500'} font-black text-xl leading-none`}>AED {displayTax.toFixed(2)}</span>
                </div>

                <div className="h-10 w-[2px] bg-slate-300 mx-2" />

                {/* Grand Total */}
                <div className="flex flex-col items-end min-w-[180px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">TOTAL AMOUNT</label>
                  <span className={`${isGreen ? 'text-emerald-500' : 'text-sky-500'} font-black text-[36px] tracking-tighter leading-none`}>AED {grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* ACTION BAR */}
            <div className="classic-action-bar flex items-center justify-end gap-4 p-3 bg-slate-50 border-t border-slate-200 shadow-inner">
              <div className="flex-1" />
              <button
                className={`px-6 py-2.5 bg-white border border-slate-300 ${isGreen ? 'text-emerald-700 hover:bg-slate-100' : 'text-sky-700 hover:bg-slate-100'} transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide flex items-center gap-2`}
                onClick={() => setShowDiscountModal(true)}
              >
                <Palette size={14} /> % DISCOUNT
              </button>
              <button
                className={`px-6 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all font-black text-[12px] rounded shadow-sm uppercase tracking-wide flex items-center gap-2`}
                onClick={() => { setBillItems([]); setDiscount({ type: 'amount', value: 0 }); }}
              >
                <Trash2 size={14} /> CLEAR BILL
              </button>
              <button
                className={`px-8 py-2.5 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-all font-black text-[13px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center gap-2 ml-4`}
                onClick={handleSaveDraft}
                disabled={billItems.length === 0}
              >
                <Package size={16} /> SAVE DRAFT
              </button>
              <button
                className={`px-12 py-2.5 ${isGreen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'} text-white border-none transition-all font-black text-[14px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center gap-2`}
                onClick={handleCheckout}
                disabled={grandTotal <= 0}
              >
                <CreditCard size={18} /> PROCESS PAYMENT
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

        {/* Common Modals */}
        {renderCommonModals()}
      </div>
    );
  }

  // ---------- MODERN RENDER (UNCHANGED) ----------
  return (
    <div className={`home-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      {/* Removed Redundant Legacy Header for Modern View */}

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
                  <button
                    onClick={() => navigate('/quickstockin')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800 hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <Package size={14} className="text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tight">Quick Stock-In</span>
                  </button>
                  <button
                    onClick={() => dispatch(toggleTheme())}
                    className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 rounded-xl border border-sky-400 hover:bg-sky-400 transition-all cursor-pointer shadow-lg active:scale-95"
                    title="Switch POS Theme"
                  >
                    <Palette size={14} className="text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tight">Theme</span>
                  </button>
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
                                src={getImageUrl(item.image)}
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
                            {/* Overlay Barcode Image if exists */}
                            {item.barcode_image && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.8)', padding: '2px', display: 'flex', justifyContent: 'center' }}>
                                <img src={getImageUrl(item.barcode_image)} alt="barcode" style={{ height: '20px', width: 'auto', mixBlendMode: 'multiply' }} />
                              </div>
                            )}
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
            {/* Removed Redundant Legacy Bill section for Modern View */}

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
                  <button
                    onClick={() => setShowCamera(true)}
                    className="absolute right-12 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-sky-500 rounded-xl flex items-center justify-center border border-sky-100 shadow-sm hover:bg-sky-50 transition-all"
                    title="Camera Scanner"
                  >
                    <Camera size={20} />
                  </button>
                  <label className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-emerald-500 rounded-xl flex items-center justify-center border border-sky-100 shadow-sm hover:bg-sky-50 transition-all cursor-pointer" title="Scan Image File">
                    <Scan size={20} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageScan} />
                  </label>
                  {searchLoading && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <Loader2 size={18} className="animate-spin text-sky-500" />
                    </div>
                  )}

                  {/* Item Search Dropdown */}
                  {showItemDropdown && (
                    <div ref={itemDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '300px', overflowY: 'auto', zIndex: 100, marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      {itemSearchResults.map(it => (
                        <div key={it.id} onClick={() => it.is_global ? handleEnableGlobalItem(it) : (handleAddToBill(it), setBarcodeInput(''), setShowItemDropdown(false))} style={{ padding: '0.9rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem', background: it.is_global ? '#fffbeb' : '#fff' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = it.is_global ? '#fef3c7' : '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = it.is_global ? '#fffbeb' : '#fff'}>
                          {it.image ? <img src={getImageUrl(it.image)} alt={it.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} /> : <div style={{ width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', border: '1px dashed #cbd5e1' }}>IMG</div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
                              {it.is_global && <span style={{ fontSize: 9, background: '#f59e0b', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 900 }}>GLOBAL</span>}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>{it.is_global ? 'Registry discovery - sync to branch' : `Stock: ${it.local_qty} UNITS | Code: ${it.id}`}</div>
                          </div>
                          <div style={{ fontWeight: 900, color: '#0f172a', textAlign: 'right' }}>
                            {it.is_global ? <span style={{ color: '#d97706', fontSize: 10, letterSpacing: '-0.2px' }}>AUTHORIZE ENTRY</span> : `AED ${parseFloat(it.price).toFixed(2)}`}
                          </div>
                        </div>
                      ))}
                      {itemSearchResults.length === 0 && barcodeInput.length >= 2 && !searchLoading && (
                        <div 
                          onClick={() => triggerGlobalSearch(barcodeInput)}
                          style={{ padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f5f3ff', borderTop: '1px dashed #ddd6fe' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ede9fe'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                        >
                          <Search size={20} style={{ margin: '0 auto 8px', color: '#4f46e5' }} />
                          <p style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5' }}>NOT IN THIS BRANCH</p>
                          <p style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', marginTop: 4 }}>Tap to Check Global Stock</p>
                        </div>
                      )}
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
                            <button onClick={() => toggleUom(item.id, item.uom_conversions?.Nos ? 'Nos' : 'Piece')} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #3b82f6', background: (item.uom === 'Piece' || item.uom === 'Nos') ? '#3b82f6' : '#fff', color: (item.uom === 'Piece' || item.uom === 'Nos') ? '#fff' : '#3b82f6' }}>Piece</button>
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

      {showPaymentModal && renderPaymentModal()}

      {/* Common Modals */}
      {renderCommonModals()}
    </div>
  );
}

export default Home;

