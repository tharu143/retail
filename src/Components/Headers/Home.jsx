import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw, ExternalLink, LayoutDashboard, ChevronLeft, Settings, Power, Wifi, WifiOff, User as UserIcon,
    Search, Layers, SearchSlash, ChevronRight, X, UserPlus, Loader2, CreditCard, Phone,
    DollarSign, Trash2, Info, Package, Palette, MonitorSmartphone, Camera, Video, Scan,
    ShoppingCart, Minus, Plus, Upload, Percent,
    User,
    Tag,
    ArrowLeftRight,
    Move,
    QrCode,
    Smartphone,
    Banknote,
    Building2,
    Award,
    Coins,
    Barcode,
    Bell
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { logout, toggleTheme, setTheme, markRead, markAllRead } from '../../Redux/Slices/userSlice';
import './Home.css';
import './LegacyPOS.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ModernNoImageGrid from './ModernNoImageGrid';
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

const getBranchName = (wh) => {
    if (!wh) return '';
    return wh.replace(/\s*Warehouse\s*/gi, ' ').replace(/\s*-\s*\w+$/, '').trim() || wh;
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

    // Classic Theme Settings menu dropdown states
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const settingsDropdownRef = useRef(null);

    // Notification States
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationsContainerRef = useRef(null);
    const notifications = useSelector((state) => state.user.notifications || []);
    const unreadCount = notifications.filter(n => !n.read).length;

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
        z-index: 200 !important;
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
      .classic-shortcut-guide {
        background: ${isGreen ? '#0d4a35' : '#0d3050'} !important;
        border-bottom: 2px solid ${borderColor} !important;
        padding: 8px 16px !important;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px !important;
        box-shadow: inset 0 -2px 10px rgba(0,0,0,0.2) !important;
      }
      .classic-shortcut-guide.horizontal .classic-shortcut-badge {
        padding: 2.5px 7px !important;
        gap: 5px !important;
        border-radius: 6px !important;
      }
      .classic-shortcut-guide.horizontal .classic-shortcut-key {
        font-size: 9.5px !important;
        padding: 1px 4.5px !important;
      }
      .classic-shortcut-guide.horizontal .classic-shortcut-label {
        font-size: 12px !important;
      }
      .classic-shortcut-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px !important;
        background: ${isGreen ? '#083325' : '#081e33'} !important;
        border: 2px solid ${isGreen ? '#34d399' : '#38bdf8'} !important;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 3px 6px rgba(0,0,0,0.25);
      }
      .classic-shortcut-badge:hover {
        background: ${isGreen ? '#1a6b52' : '#1e4f7a'} !important;
        border-color: ${accentColor} !important;
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.35), 0 0 10px ${accentColor}66;
      }
      .classic-shortcut-badge:active {
        transform: translateY(1px);
        box-shadow: 0 1px 2px rgba(0,0,0,0.15);
      }
      .classic-shortcut-key {
        font-size: 11px;
        font-weight: 950;
        font-family: 'Share Tech Mono', monospace;
        color: #000000;
        background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%) !important;
        border-bottom: 3px solid #94a3b8;
        border-right: 1px solid #cbd5e1;
        border-left: 1px solid #cbd5e1;
        padding: 2.5px 6.5px !important;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1.5px 0 rgba(0,0,0,0.25);
        transition: all 0.1s ease;
      }
      .classic-shortcut-badge:active .classic-shortcut-key {
        border-bottom-width: 1px;
        transform: translateY(1px);
      }
      .classic-shortcut-label {
        font-size: 13px;
        font-weight: 950;
        color: #ffffff !important;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-family: 'Share Tech Mono', monospace;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      .classic-shortcut-icon {
        color: ${accentColor} !important;
        display: inline-flex;
        align-items: center;
      }
      .btn-shortcut-key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Share Tech Mono', 'Courier New', monospace;
        font-size: 10px;
        font-weight: 900;
        color: #ffffff !important;
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
        border: 1px solid #0f172a !important;
        border-bottom: 3px solid #020617 !important;
        padding: 1.5px 6px !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25) !important;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5) !important;
        margin-left: 6px;
        vertical-align: middle;
        line-height: 1;
        letter-spacing: 0.02em;
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
      @keyframes spinSlow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .animate-spin-slow {
        animation: spinSlow 3s linear infinite;
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

    // Close classic settings menu and notifications on click outside
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target)) {
                setShowSettingsMenu(false);
            }
            if (notificationsContainerRef.current && !notificationsContainerRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (posDropdownRef.current && !posDropdownRef.current.contains(e.target)) {
                setShowPosDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Sync & Order Count effect
    useEffect(() => {
        const updateStats = async () => {
            // 1. Pending sync count
            const unsynced = await db.invoices.where('is_synced').equals(0).count();
            setPendingSyncCount(unsynced);

            // 2. Sequential Order Number for today's date
            const todayStr = new Date().toISOString().slice(0, 10);
            const shiftCount = await db.invoices
                .where('posting_date')
                .equals(todayStr)
                .count();
            setSessionOrderCount(shiftCount + 1);
        };
        updateStats();
        const interval = setInterval(updateStats, 10000);
        return () => clearInterval(interval);
    }, []);



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
    const [countryCodePrefix, setCountryCodePrefix] = useState(() => localStorage.getItem('pos_country_code') || '+971');
    const mobileInputRef = useRef(null);
    const [lastInteractedItem, setLastInteractedItem] = useState(null);


    // Camera states
    const [showCamera, setShowCamera] = useState(false);
    const homeVideoRef = useRef(null);
    const homeCodeReader = useRef(null);
    const html5QrcodeRef = useRef(null);

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
            {showLoyaltyModal && renderLoyaltyModal()}
            {showPaymentModal && renderPaymentModal()}
            {showOpeningModal && (
                <div className="home-modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="home-modal" style={{ maxWidth: '950px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 p-5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight m-0">Open POS Session</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Initialize your cash register to begin</p>
                                </div>
                            </div>
                            <button
                                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                                onClick={handleLogout}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="home-modal-body" style={{ padding: 0, flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
                            <OpeningEntryPage onOpeningEntrySuccess={handleOpeningSuccess} isModal={true} onCancel={handleLogout} />
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
                                <div id="home-scanner-reader" className="w-full h-full" style={{ background: '#0f172a' }}></div>
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
                                        <label style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>Purchase Rate (<DirhamIcon size={12} />)</label>
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
                                        <span style={{ fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={14} /> {purchaseForm.target_price.toFixed(2)}</span>
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
                                                    {draft.total_qty || (draft.items && draft.items.length) || 0} Items • Saved: {format(new Date(draft.timestamp), 'MMM dd, HH:mm')}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>TOTAL</div>
                                                    <div style={{ fontWeight: 900, color: '#0ea5e9', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}><DirhamIcon size={16} /> {draft.grand_total?.toFixed(2)}</div>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={() => dispatch(setTheme('modern'))}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: '2px solid',
                                        borderColor: theme === 'modern' ? '#0ea5e9' : '#e2e8f0',
                                        background: theme === 'modern' ? '#f0f9ff' : '#ffffff',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                    }}
                                >
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Modern UI</span>
                                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Sleek, premium cards with images</span>
                                </button>
                                <button
                                    onClick={() => dispatch(setTheme('modern_no_image'))}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: '2px solid',
                                        borderColor: theme === 'modern_no_image' ? '#6366f1' : '#e2e8f0',
                                        background: theme === 'modern_no_image' ? '#e0e7ff' : '#ffffff',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                    }}
                                >
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Modern (No Image)</span>
                                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>High-density compact cards without images</span>
                                </button>
                                <button
                                    onClick={() => dispatch(setTheme('legacy'))}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        border: '2px solid',
                                        borderColor: theme === 'legacy' ? '#10b981' : '#e2e8f0',
                                        background: theme === 'legacy' ? '#ecfdf5' : '#ffffff',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                    }}
                                >
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Classic UI</span>
                                    <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>Retro POS terminal layout</span>
                                </button>
                            </div>
                        </div>

                        {/* Section: Shortcuts Position */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Shortcuts Position</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {['top', 'bottom', 'left', 'right'].map(pos => (
                                    <button
                                        key={pos}
                                        onClick={() => {
                                            setShortcutsPosition(pos);
                                            localStorage.setItem('pos_shortcuts_position', pos);
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '2px solid',
                                            borderColor: shortcutsPosition === pos ? '#6366f1' : '#e2e8f0',
                                            background: shortcutsPosition === pos ? '#e0e7ff' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            color: '#1e293b',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {pos}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section: Color Palette (Available for all layouts) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Accent Color</label>
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
        if (!isAdmin && !posOpeningEntry) {
            setShowOpeningModal(true);
        }
    }, [user, session, navigate, posOpeningEntry, isAdmin]);

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
    const [shortcutsPosition, setShortcutsPosition] = useState(localStorage.getItem('pos_shortcuts_position') || 'top');
    const [isDraggingShortcuts, setIsDraggingShortcuts] = useState(false);
    const [dragOverZone, setDragOverZone] = useState(null); // 'top', 'bottom', 'left', 'right'
    const [showPosDropdown, setShowPosDropdown] = useState(false);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const posDropdownRef = useRef(null);

    const handleShortcutsDragStart = (e) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', 'shortcuts');
            e.dataTransfer.effectAllowed = 'move';
        }
        setTimeout(() => {
            setIsDraggingShortcuts(true);
        }, 0);
    };

    const handleShortcutsDragEnd = () => {
        setIsDraggingShortcuts(false);
        setDragOverZone(null);
    };

    const handleShortcutsDrop = (position) => {
        setShortcutsPosition(position);
        localStorage.setItem('pos_shortcuts_position', position);
        setIsDraggingShortcuts(false);
        setDragOverZone(null);
    };

    const [Items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [error, setError] = useState("");
    const [categories, setCategories] = useState(["all"]);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [filteredItems, setFilteredItems] = useState([]);
    const [activeCardIndex, setActiveCardIndex] = useState(-1);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [billItems, setBillItems] = useState([]);
    const [selectedBillIndex, setSelectedBillIndex] = useState(-1);
    const [customerName, setCustomerName] = useState('Cash');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [creatingCustomer, setCreatingCustomer] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        if (selectedBillIndex !== -1) {
            const el = document.getElementById(`bill-row-${selectedBillIndex}`);
            if (el) el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }, [selectedBillIndex]);

    useEffect(() => {
        if (activeCardIndex !== -1) {
            const cardEl = document.querySelector(`.so-grid-area .so-item-card:nth-child(${activeCardIndex + 1})`);
            if (cardEl) {
                cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [activeCardIndex]);

    useEffect(() => {
        setActiveCardIndex(-1);
    }, [selectedCategory, barcodeInput]);
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
    const [discountCustInput, setDiscountCustInput] = useState('');
    const [creatingDiscountCust, setCreatingDiscountCust] = useState(false);

    // Loyalty Points State
    const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
    const [loyaltyAmount, setLoyaltyAmount] = useState(0);
    const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
    const [loyaltyInput, setLoyaltyInput] = useState("");

    // Authorization State
    const [secretKeyInput, setSecretKeyInput] = useState("");
    const userSecretKey = useSelector((state) => state.user.secret_key || '1234');
    const [discountAuthorizedBy, setDiscountAuthorizedBy] = useState("");
    const [loyaltyAuthorizedBy, setLoyaltyAuthorizedBy] = useState("");

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
    const taxRate = useMemo(() => {
        // 1. GLOBAL FALLBACK: If company is KSPL, we default to 5% if API fails
        if (taxTemplates.length === 0) return 5.0;

        // 2. Try to find the selected template
        let targetTemplate = selectedTaxTemplate;
        if (!targetTemplate && taxTemplates.length > 0) {
            const defaultT = taxTemplates.find(t => t.name.includes("VAT 5% - NS")) ||
                taxTemplates.find(t => t.name.includes("VAT 5% - KSPL")) ||
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

    const subtotal = useMemo(() =>
        billItems.reduce((sum, item) => {
            const lineTotal = item.price * item.qty;

            // If inclusive, extract base price; if exclusive, use the total as base
            let netItem = lineTotal;
            if (item.is_tax_inclusive) {
                netItem = lineTotal / (1 + (taxRate / 100));
            }
            return sum + flt(netItem);
        }, 0)
        , [billItems, taxRate]);

    const discountAmount = useMemo(() => {
        if (discount.value <= 0) return 0;
        const amt = (discount.type === 'percentage' || discount.type === 'percent')
            ? (subtotal * discount.value) / 100
            : discount.value;
        return flt(amt);
    }, [subtotal, discount]);

    const activeReduction = useMemo(() => {
        return discountAmount > 0 ? discountAmount : loyaltyAmount;
    }, [discountAmount, loyaltyAmount]);

    const netTotal = useMemo(() => flt(subtotal - activeReduction), [subtotal, activeReduction]);

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
                    const defaultTax = templates.find(t => t.name.includes("VAT 5% - NS")) ||
                        templates.find(t => t.name.includes("VAT 5% - KSPL")) ||
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
                if (isOffline) {
                    // Fallback to cached tax templates
                    try {
                        const cached = await db.tax_templates.toArray();
                        if (cached.length) {
                            setTaxTemplates(cached);
                            const defaultTax = cached.find(t => t.name.includes("VAT 5% - NS")) ||
                                cached.find(t => t.name.includes("VAT 5% - KSPL")) ||
                                cached.find(t => t.name.includes("UAE VAT 5%")) ||
                                cached[0];
                            setSelectedTaxTemplate(defaultTax.name);
                        }
                    } catch (e) { console.error('Local tax cache also failed:', e); }
                }
            }
        };
        fetchTaxTemplates();
    }, [authFetch, company, isOffline]);

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
                            search_type: searchType,
                            warehouse: warehouse
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
        let cleanPhone = phoneNumber || "";
        if (phoneNumber) {
            cleanPhone = phoneNumber
                .replace(/^\+?(971|91)/, '')   // remove UAE (+971) or India (+91) prefix
                .replace(/\D/g, '');            // remove any remaining non-digits
        }
        setCreateForm({ name: customerName.trim(), phone: cleanPhone, address: '', email: '' });
        setShowCreateModal(true); setShowDropdown(false);
    };

    const promoteCustomerGroup = async (cust, newGroup) => {
        try {
            const res = await frappeCall({
                method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
                args: {
                    mobile_no: cust.mobile_no || phoneNumber,
                    customer_name: cust.customer_name,
                    warehouse: warehouse,
                    customer_group: newGroup
                }
            });
            if (res && res.name) {
                const updatedCustomer = {
                    ...cust,
                    customer_group: newGroup
                };
                await db.customers.put(updatedCustomer);
                if (selectedCustomer?.name === cust.name || selectedCustomer?.customer_name === cust.customer_name) {
                    setSelectedCustomer(updatedCustomer);
                    setCustomerName(updatedCustomer.customer_name);
                    setPhoneNumber(updatedCustomer.mobile_no);
                }
                return updatedCustomer;
            }
        } catch (err) {
            console.error("Promotion failed", err);
        }
        return null;
    };

    const handleCreditPaymentSelection = async () => {
        if (!selectedCustomer || selectedCustomer.name === 'Cash') {
            Swal.fire({
                title: 'Select Named Customer',
                text: 'Credit payments can only be processed for named customers. Please select or create a customer first.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }
        if (selectedCustomer.customer_group !== 'Credit Customer') {
            const result = await Swal.fire({
                title: 'Promote to Credit Customer?',
                text: `Only Credit Customers can check out on Credit. Do you want to promote "${selectedCustomer.customer_name}" to Credit Customer?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, Promote',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                Swal.showLoading();
                const updated = await promoteCustomerGroup(selectedCustomer, 'Credit Customer');
                if (updated) {
                    setSelectedPaymentMode('Credit');
                    Swal.fire({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                        icon: 'success', title: 'Customer group updated to Credit Customer'
                    });
                }
            }
        } else {
            setSelectedPaymentMode('Credit');
        }
    };

    const pickCustomer = async (cust) => {
        setSelectedCustomer(cust);
        setCustomerName(cust.customer_name);
        setPhoneNumber(cust.mobile_no || '');
        setCustomerMobile(''); // Clear mobile search
        setShowDropdown(false);
        barcodeInputRef.current?.focus();

        let appliedDiscountValue = 0;

        if (cust && cust.custom_default_discount > 0) {
            appliedDiscountValue = cust.custom_default_discount;
            setDiscount({ type: 'percent', value: appliedDiscountValue });
            setDiscountAuthorizedBy("Auto-applied (Customer Default)");
        } else if (cust && cust.customer_group) {
            try {
                const cgRes = await frappeCall({
                    method: 'kyle_retail.kyle_retail.api.get_customer_group_discount',
                    args: {
                        customer_group: cust.customer_group
                    }
                });
                if (cgRes && cgRes > 0) {
                    appliedDiscountValue = cgRes;
                    setDiscount({ type: 'percent', value: appliedDiscountValue });
                    setDiscountAuthorizedBy(`Auto-applied (${cust.customer_group})`);
                } else {
                    setDiscount({ type: 'amount', value: 0 });
                    setDiscountAuthorizedBy("");
                }
            } catch (err) {
                console.error("Error fetching customer group discount", err);
                setDiscount({ type: 'amount', value: 0 });
                setDiscountAuthorizedBy("");
            }
        } else {
            setDiscount({ type: 'amount', value: 0 });
            setDiscountAuthorizedBy("");
        }

        if (cust && cust.name !== 'Cash' && appliedDiscountValue > 0 && cust.customer_group !== 'Discount Customer') {
            setTimeout(async () => {
                const result = await Swal.fire({
                    title: 'Promote to Discount Customer?',
                    text: `Do you want to promote "${cust.customer_name}" to the 'Discount Customer' group since a discount is active?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Promote',
                    cancelButtonText: 'No'
                });
                if (result.isConfirmed) {
                    Swal.showLoading();
                    const updated = await promoteCustomerGroup(cust, 'Discount Customer');
                    if (updated) {
                        Swal.fire({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                            icon: 'success', title: 'Customer group updated to Discount Customer'
                        });
                    }
                }
            }, 100);
        }
    }; const createCustomer = async () => {
        const cleanedName = createForm.name.trim().replace(/[^a-zA-Z\s]/g, '');
        if (!cleanedName) {
            Swal.fire('Validation Error', 'Customer name is required and must contain only alphabets.', 'warning');
            return;
        }

        const strippedNumber = createForm.phone.trim().replace(/\D/g, '');
        if (!strippedNumber) {
            Swal.fire('Validation Error', 'Mobile number is required.', 'warning');
            return;
        }

        if (countryCodePrefix === '+971' && strippedNumber.length !== 9) {
            Swal.fire('Validation Error', 'UAE mobile number must be exactly 9 digits.', 'warning');
            return;
        }
        if (countryCodePrefix === '+91' && strippedNumber.length !== 10) {
            Swal.fire('Validation Error', 'India mobile number must be exactly 10 digits.', 'warning');
            return;
        }

        const formattedPhone = `${countryCodePrefix}${strippedNumber}`;
        setCreatingCustomer(true);

        try {
            const formData = new FormData();
            formData.append("customer_name", createForm.name.trim());
            formData.append("customer_group", "Retail Customer");
            if (formattedPhone) formData.append("phone", formattedPhone);
            if (createForm.address) formData.append("address", createForm.address);
            if (createForm.email) formData.append("email", createForm.email);
            if (warehouse) formData.append("warehouse", warehouse);

            const hostname = window.location.hostname.toLowerCase();
            if (hostname.includes('retailpos') || hostname.includes('kyleretail') || hostname.includes('retail.kylesolutions.com')) {
                formData.append("country", "United Arab Emirates");
                formData.append("territory", "United Arab Emirates");
            }

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
                    mobile_no: formattedPhone || "",
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
                    mobile_no: formattedPhone || "",
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

    const handleCreateCustomerByName = async (name) => {
        setCustomerLoading(true);
        try {
            const formData = new FormData();
            formData.append("customer_name", name);
            formData.append("customer_group", "Retail Customer");
            if (warehouse) formData.append("warehouse", warehouse);

            const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.create_customer', {
                method: 'POST',
                body: formData,
            });
  
            const result = await res.json();
            const inner = result.message || result;

            if (inner.status === "success" || inner.name) {
                const newCust = {
                    name: inner.customer_id || inner.name,
                    customer_name: name,
                    mobile_no: "",
                    primary_address: "",
                    email_id: "",
                    is_synced: 1
                };
                await db.customers.put(newCust);
                pickCustomer(newCust);
                const Toast = Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                });
                Toast.fire({ icon: 'success', title: `Customer: ${name} Created` });
            } else {
                Swal.fire('Error', inner.message || "Failed to create customer", 'error');
            }
        } catch (err) {
            console.error(err);
            if (!navigator.onLine) {
                const offlineCustomer = {
                    name: `OFFLINE-CUST-${Date.now()}`,
                    customer_name: name,
                    mobile_no: "",
                    primary_address: "",
                    email_id: "",
                    is_synced: 0,
                    is_offline: true
                };
                await db.customers.put(offlineCustomer);
                pickCustomer(offlineCustomer);
                Swal.fire('Offline Save', 'Customer saved locally. Will sync when online.', 'info');
            } else {
                Swal.fire('Error', "Network error while creating customer", 'error');
            }
        } finally {
            setCustomerLoading(false);
        }
    };

    const createDiscountCustomer = async () => {
        const val = discountCustInput.trim();
        if (!val) {
            Swal.fire('Error', 'Please enter a name or number to create customer', 'error');
            return;
        }

        setCreatingDiscountCust(true);

        // Determine name and phone
        let name = val;
        let phone = "";
        if (/^\d+$/.test(val)) {
            if (countryCodePrefix === '+971' && val.length !== 9) {
                Swal.fire('Validation Error', 'UAE mobile number must be exactly 9 digits.', 'warning');
                setCreatingDiscountCust(false);
                return;
            }
            if (countryCodePrefix === '+91' && val.length !== 10) {
                Swal.fire('Validation Error', 'India mobile number must be exactly 10 digits.', 'warning');
                setCreatingDiscountCust(false);
                return;
            }
            phone = val;
        }

        try {
            const formData = new FormData();
            formData.append("customer_name", name);
            formData.append("customer_group", "Discount Customer");
            if (phone) formData.append("phone", phone);
            if (warehouse) formData.append("warehouse", warehouse);

            const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.create_customer', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();
            const inner = result.message || result;

            if (inner.status === "success" || inner.name) {
                Swal.fire({
                    icon: 'success',
                    title: 'Discount Customer Created',
                    text: `"${name}" has been saved as a Discount Customer.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                const newCust = {
                    name: inner.customer_id || inner.name,
                    customer_name: name,
                    mobile_no: phone,
                    customer_group: "Discount Customer",
                    primary_address: "",
                    email_id: "",
                    is_synced: 1
                };
                await db.customers.put(newCust); // Save locally for instant POS search
                pickCustomer(newCust);
                setDiscountCustInput('');
            } else {
                Swal.fire('Error', inner.message || "Failed to create customer", 'error');
            }
        } catch (err) {
            console.error(err);
            if (isOffline) {
                const offlineCustomer = {
                    name: `OFFLINE-CUST-${Date.now()}`,
                    customer_name: name,
                    mobile_no: phone,
                    customer_group: "Discount Customer",
                    primary_address: "",
                    email_id: "",
                    is_synced: 0,
                    is_offline: true
                };
                await db.customers.put(offlineCustomer);
                pickCustomer(offlineCustomer);
                setDiscountCustInput('');
                Swal.fire('Offline Save', 'Customer saved locally. Will sync when online.', 'info');
            } else {
                Swal.fire('Error', "Network error while creating customer", 'error');
            }
        } finally {
            setCreatingDiscountCust(false);
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
                        (typeof c === 'string' ? c : (c.name || c.item_group_name || c.item_group))
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
                        // Keep all items returned by the API so that 0-stock/other items are available to cashier
                        let filteredResults = results;
                        apiItems = filteredResults;

                        db.items.bulkPut(results.map(item => ({
                            id: item.name,
                            name: item.item_name,
                            image: item.image,
                            group: item.item_group || "others",
                            price: item.price_list_rate || 0,
                            prices: item.prices || {},
                            uom_conversions: item.uom_conversions || {},
                            stock_uom: item.stock_uom || 'Nos',
                            actual_qty: item.actual_qty || 0,
                            local_qty: item.actual_qty || 0,
                            total_qty: item.total_qty || item.actual_qty || 0,
                            warehouse_details: item.warehouse_details || [],
                            branch_availability: item.branch_availability || [],
                            barcodes: item.barcodes || [],
                            modified: item.modified,
                            custom_pieces_per_box: item.custom_pieces_per_box || 1,
                            custom_loyalty_eligible: item.custom_loyalty_eligible || 0
                        }))).catch(e => console.error("Dexie background update failed", e));

                        if (results.length > 0) {
                            const newestModified = results.reduce((max, item) =>
                                (item.modified > max ? item.modified : max), "");
                            localStorage.setItem('last_item_sync_time', newestModified || new Date().toISOString());
                        }
                    }
                } catch (fetchErr) {
                    console.error("Strict Online fetch failed:", fetchErr);
                    setError(`Server Connection Error: ${fetchErr.message || fetchErr}.`);
                    apiItems = [];
                }
            } else {
                // STRICT OFFLINE MODE: Use local Dexie cache
                let allCached = await db.items.toArray();
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
                    item_code: item.item_code || item.id || item.name,
                    name: item.item_name || item.name,
                    image: finalImage,
                    group: item.group || item.item_group || "others",
                    // Base price (Nos/Piece price) – branch-specific from API
                    price: item.price || item.price_list_rate || 0,
                    // UOM-keyed price map (e.g. { Nos: 10, Box: 120 }) – branch selling prices
                    prices: item.prices || {},
                    // UOM conversion factors (e.g. { Box: 12, Nos: 1 })
                    uom_conversions: item.uom_conversions || {},
                    stock_uom: item.stock_uom || 'Nos',
                    actual_qty: item.actual_qty || 0,
                    local_qty: item.local_qty !== undefined ? item.local_qty : (item.actual_qty || 0),
                    total_qty: item.total_qty || item.actual_qty || 0,
                    warehouse_details: item.warehouse_details || [],
                    branch_availability: item.branch_availability || [],
                    barcodes: item.barcodes || [],
                    custom_pieces_per_box: item.custom_pieces_per_box || 1,
                    custom_loyalty_eligible: item.custom_loyalty_eligible || 0
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
                text: 'Local cache cleared and updated with the latest items and branch prices.',
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
        const syncToken = localStorage.getItem('price_sync_v4');
        if (!syncToken && session) {
            db.items.clear().then(() => {
                localStorage.setItem('price_sync_v4', 'done');
                fetchItems(true);
            });
        }
    }, [session, fetchItems]);

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
        let filtered = selectedCategory.toLowerCase() === "all"
            ? Items
            : Items.filter(i => (i.group || '').toLowerCase() === selectedCategory.toLowerCase());

        if (showAvailableOnly) {
            filtered = filtered.filter(i => (i.local_qty !== undefined ? i.local_qty : 0) > 0);
        }

        if (barcodeInput.trim()) {
            const term = barcodeInput.toLowerCase().trim();
            filtered = filtered.filter(i =>
                (i.name || "").toLowerCase().includes(term) ||
                (i.id || "").toLowerCase().includes(term) ||
                (i.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(term))
            );
        }
        setFilteredItems(filtered);
    }, [selectedCategory, Items, barcodeInput, showAvailableOnly]);

    const handleOutOfStockAlert = async (item) => {
        const result = await Swal.fire({
            title: 'Out of Stock',
            text: `"${item.name || item.item_name}" is out of stock in your branch (${getBranchName(warehouse)}).`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Find Nearby Branch',
            cancelButtonText: 'Close',
            confirmButtonColor: '#2563eb'
        });
        if (result.isConfirmed) {
            handleFindNearestStock(item);
        }
    };

    // ---------- ITEM HANDLERS ----------
    const handleFilter = (cat) => setSelectedCategory(cat);
    const handleAddToBill = (item) => {
        setLastInteractedItem(item);
        setBillItems(prev => {
            const existingIdx = prev.findIndex(i => i.id === item.id);
            if (existingIdx !== -1) {
                setSelectedBillIndex(existingIdx);
                return prev;
            } else {
                if (item.local_qty <= 0) {
                    handleOutOfStockAlert(item);
                    return prev;
                }
                const baseUom = item.uom_conversions?.Nos ? 'Nos' : (item.uom_conversions?.Piece ? 'Piece' : 'Nos');
                const initialPrice = item.prices?.[baseUom] || item.price || 0;

                const newItem = {
                    ...item,
                    qty: 1,
                    uom: baseUom,
                    price: initialPrice,
                    base_unit_price: initialPrice,
                    is_tax_inclusive: true // Default to inclusive for retail
                };
                setSelectedBillIndex(prev.length);
                return [...prev, newItem];
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
                    handleOutOfStockAlert(itemToBill);
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
                                .map(b => getBranchName(b.warehouse_name || b.warehouse))
                                .filter((v, i, a) => a.indexOf(v) === i)
                                .join(", ");

                            Swal.fire({
                                title: 'Item Found in Other Branches',
                                html: `<div style="font-size: 15px; font-weight: 600; color: #475569; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                                    This item is not enabled for <span style="font-weight: 800; color: #0f172a;">${getBranchName(warehouse)}</span>.
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
                    html: `<div style="font-size: 15px; font-weight: 600; color: #475569; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                      This item is not in your branch catalog.
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #1e293b; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #4f46e5; text-align: left; line-height: 1.4; margin-bottom: 12px;">
                      ${it.item_name || it.name}
                    </div>
                    <div style="text-align: left; font-size: 14px; color: #475569;">
                      <p style="font-weight: 600; margin-bottom: 4px;">Available Stock elsewhere:</p>
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

    const barcodeScanRef = useRef(handleBarcodeScan);
    useEffect(() => {
        barcodeScanRef.current = handleBarcodeScan;
    }, [handleBarcodeScan]);

    // ---------- CAMERA SCANNER ENGINE ----------
    if (!homeCodeReader.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        homeCodeReader.current = new BrowserMultiFormatReader(hints);
    }

    useEffect(() => {
        if (showCamera) {
            console.log("[Scanner Debug] Starting Html5Qrcode...");
            const html5Qrcode = new Html5Qrcode("home-scanner-reader");
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
                {
                    ...config,
                    formatsToSupport: formats
                },
                (decodedText, decodedResult) => {
                    console.log("[Scanner Debug] Decoded text:", decodedText);
                    if (showCamera) {
                        barcodeScanRef.current(decodedText.trim());
                        setShowCamera(false);
                        html5Qrcode.stop().catch(err => console.error("[Scanner Debug] Error stopping on success:", err));
                    }
                },
                (errorMessage) => {
                    // Suppress verbose frame analysis logs
                }
            ).catch(err => {
                console.error("[Scanner Debug] start failed, trying fallback device:", err);
                html5Qrcode.start(
                    { deviceId: undefined },
                    { ...config, formatsToSupport: formats },
                    (decodedText, decodedResult) => {
                        if (showCamera) {
                            barcodeScanRef.current(decodedText.trim());
                            setShowCamera(false);
                            html5Qrcode.stop().catch(fallbackErr => console.error("[Scanner Debug] Error stopping on fallback success:", fallbackErr));
                        }
                    },
                    (errorMessage) => { }
                ).catch(finalErr => {
                    console.error("[Scanner Debug] All startup options failed:", finalErr);
                    Swal.fire('Camera Error', 'Could not start camera barcode scanner.', 'error');
                    setShowCamera(false);
                });
            });
        }

        return () => {
            if (html5QrcodeRef.current) {
                console.log("[Scanner Debug] Cleanup called.");
                if (html5QrcodeRef.current.isScanning) {
                    html5QrcodeRef.current.stop().catch(err => console.error("[Scanner Debug] Error during stop cleanup:", err));
                }
            }
        };
    }, [showCamera]);

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
        if (e.key === 'ArrowDown') {
            if (showItemDropdown) {
                e.preventDefault();
                setActiveItemIndex(prev => Math.min(prev + 1, itemSearchResults.length - 1));
            } else if (billItems.length > 0) {
                e.preventDefault();
                setSelectedBillIndex(prev => Math.min(prev + 1, billItems.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            if (showItemDropdown) {
                e.preventDefault();
                setActiveItemIndex(prev => Math.max(prev - 1, 0));
            } else if (billItems.length > 0) {
                e.preventDefault();
                setSelectedBillIndex(prev => Math.max(prev - 1, 0));
            }
        } else if (e.key === 'ArrowLeft') {
            if (selectedBillIndex !== -1) {
                e.preventDefault();
                const newBill = [...billItems];
                newBill[selectedBillIndex].is_tax_inclusive = false;
                setBillItems(newBill);
            }
        } else if (e.key === 'ArrowRight') {
            if (selectedBillIndex !== -1) {
                e.preventDefault();
                const newBill = [...billItems];
                newBill[selectedBillIndex].is_tax_inclusive = true;
                setBillItems(newBill);
            }
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
                        text: `"${query}" was not found in ${getBranchName(warehouse)}. Would you like to check the Global Industry Registry?`,
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

    const handleRequestStock = async (item, fromWarehouse = null) => {
        const hasBox = (item.custom_pieces_per_box || 0) > 1;
        const uomOptions = hasBox
            ? `<option value="Nos">Nos (Each)</option><option value="Box">Box (${item.custom_pieces_per_box} pcs)</option>`
            : `<option value="Nos">Nos (Each)</option>`;

        const { value: formValues } = await Swal.fire({
            title: 'Material Request',
            html: `
            <div style="font-family:'Inter',sans-serif;text-align:left;">
                <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:6px;">
                    Requesting stock for <span style="font-weight:800;color:#0f172a;">${getBranchName(warehouse)}</span>:
                </div>
                <div style="font-size:14px;font-weight:700;color:#1e293b;padding:8px 12px;background:#f8fafc;border-radius:8px;border-left:4px solid #f59e0b;margin-bottom:14px;line-height:1.4;">
                    ${item.name || item.item_name}
                </div>
                ${fromWarehouse ? `<div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:10px;padding:4px 10px;background:#fffbeb;border-radius:6px;">From: ${getBranchName(fromWarehouse)}</div>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
                    <div>
                        <label style="display:block;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">QTY</label>
                        <input
                            id="swal-mr-qty"
                            type="number"
                            value="1"
                            min="1"
                            style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:16px;font-weight:900;color:#0f172a;outline:none;box-sizing:border-box;transition:border-color 0.15s;"
                            onfocus="this.select();this.style.borderColor='#f59e0b';"
                            onblur="this.style.borderColor='#e2e8f0';"
                        />
                    </div>
                    <div>
                        <label style="display:block;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">UOM</label>
                        <select
                            id="swal-mr-uom"
                            style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:800;color:#0f172a;outline:none;background:#fff;cursor:pointer;box-sizing:border-box;"
                            onfocus="this.style.borderColor='#f59e0b';"
                            onblur="this.style.borderColor='#e2e8f0';"
                        >
                            ${uomOptions}
                        </select>
                    </div>
                </div>
            </div>`,
            showCancelButton: true,
            confirmButtonText: '📦 Submit Request',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            focusConfirm: false,
            didOpen: () => {
                const qtyInput = document.getElementById('swal-mr-qty');
                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
                // Tab from qty → uom → confirm button
                document.getElementById('swal-mr-qty')?.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Tab') { ev.preventDefault(); document.getElementById('swal-mr-uom')?.focus(); }
                    if (ev.key === 'Enter') { ev.preventDefault(); Swal.clickConfirm(); }
                });
                document.getElementById('swal-mr-uom')?.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); Swal.clickConfirm(); }
                });
            },
            preConfirm: () => {
                const qty = parseInt(document.getElementById('swal-mr-qty')?.value);
                const uom = document.getElementById('swal-mr-uom')?.value;
                if (!qty || qty <= 0) {
                    Swal.showValidationMessage('Please enter a valid quantity (minimum 1)');
                    return false;
                }
                return { qty, uom };
            }
        });

        if (formValues) {
            try {
                Swal.fire({ title: 'Submitting Request...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const res = await frappeCall({
                    method: 'kyle_retail.retail_api.api.create_draft_material_request',
                    args: {
                        item_code: item.id || item.item_code,
                        qty: formValues.qty,
                        uom: formValues.uom,
                        from_warehouse: fromWarehouse || '',
                        to_warehouse: warehouse || ''
                    }
                });

                if (res && (res.name || res.status === 'success')) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Request Submitted!',
                        html: `<div style="font-family:'Inter',sans-serif;text-align:center;">
                            <span style="font-size:13px;color:#64748b;">Material Request created for<br/>
                            <strong style="color:#0f172a;">${formValues.qty} ${formValues.uom}</strong> of <strong style="color:#f59e0b;">${item.name || item.item_name}</strong>
                            ${fromWarehouse ? `<br/><span style="color:#10b981;">from ${fromWarehouse}</span>` : ''}
                            </span></div>`,
                        timer: 3000,
                        showConfirmButton: false
                    });
                } else {
                    throw new Error('Failed to generate request');
                }
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    };


    const showStockBreakdown = (item) => {
        const details = (item.warehouse_details || []).filter(d => {
            const whLower = (d.warehouse_name || d.warehouse || "").toLowerCase();
            return !["goods in transit", "finished goods", "work in progress", "stores"].some(term => whLower.includes(term));
        });
        if (details.length === 0) {
            Swal.fire('No Data', 'No branch breakdown available.', 'info');
            return;
        }

        const uom = item.uom || item.stock_uom || 'Nos';

        const html = `
        <div style="text-align: left; padding: 10px; max-height: 500px; overflow-y: auto; font-family: 'Inter', sans-serif;">
             <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 10px; font-weight: 800; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 10px; font-size: 11px; text-transform: uppercase; color: #64748b;">
                <span>Branch</span>
                <span style="text-align: center;">Stock</span>
                <span style="text-align: center;">Buy</span>
                <span style="text-align: right;">Sell / Action</span>
            </div>
            ${details.map(d => {
            const qty = parseFloat(d.actual_qty);
            const buyPrice = parseFloat(d.buying_price || 0);
            const sellPrice = parseFloat(d.selling_price || 0);
            const rawBranchName = d.warehouse_name || d.warehouse;
            const displayBranchName = getBranchName(rawBranchName);

            return `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 10px; align-items: center; border-bottom: 1px solid #f1f5f9; padding: 12px 0; font-size: 13px;">
                    <div style="display: flex; flex-direction: column; min-width: 0;">
                      <span style="font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayBranchName}">${displayBranchName}</span>
                      ${d.distance ? `<span style="font-size: 9px; color: #94a3b8; font-weight: 600;">${d.distance} KM</span>` : ''}
                    </div>
                    
                    <div style="text-align: center;">
                      <span style="font-weight: 800; color: ${qty > 0 ? '#10b981' : '#ef4444'}">${qty} <span style="font-size: 9px; font-weight: 700; color: #64748b; margin-left: 2px;">${uom}</span></span>
                    </div>

                    <div style="text-align: center;">
                      <span style="font-weight: 600; color: #64748b;">${buyPrice.toFixed(2)}</span>
                    </div>

                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                      <span style="font-weight: 800; color: #3b82f6;">${sellPrice.toFixed(2)}</span>
                      ${(qty > 0 && rawBranchName !== warehouse) ? `
                        <button 
                          onclick="window.requestStock('${item.id}', '${rawBranchName}')"
                          style="background: #3b82f6; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);"
                        >REQUEST</button>
                      ` : ''}
                    </div>
                </div>
              `;
        }).join('')}
        </div>
    `;

        // Expose requestStock to window for the onclick handler inside the Swal HTML
        window.requestStock = async (itemCode, fromWarehouse) => {
            // Close the current breakdown popup first, then show enhanced MR dialog
            Swal.close();
            await handleRequestStock(item, fromWarehouse);
        };


        Swal.fire({
            title: 'Stock Breakdown',
            html: `<div style="font-size: 16px; font-weight: 700; color: #475569; margin-top: 8px; margin-bottom: 12px; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #3b82f6; text-align: left; line-height: 1.4;">
                ${item.name}
            </div>` + html,
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
                const originalSinglePrice = item.base_unit_price || item.prices?.Piece || item.prices?.Nos || (item.uom === 'Box' ? (item.price / (item.custom_pieces_per_box || 1)) : item.price);
                const hasValidBoxPrice = item.prices?.Box && item.prices.Box > originalSinglePrice;
                const newPrice = newUom === 'Box'
                    ? (hasValidBoxPrice ? item.prices.Box : (originalSinglePrice * (item.custom_pieces_per_box || 1)))
                    : (item.prices?.[newUom] || originalSinglePrice);
                return { ...item, uom: newUom, price: newPrice };
            }
            return item;
        }));
    };

    const handleUomBtnKeyDown = (e, itemId) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const activeItem = billItems.find(it => it.id === itemId);
            if (activeItem) {
                const nextUom = (activeItem.uom === 'Box' || activeItem.uom === 'BOX')
                    ? (activeItem.stock_uom || (activeItem.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece')
                    : 'Box';
                if (nextUom === 'Box' && !activeItem.custom_pieces_per_box) return;
                toggleUom(itemId, nextUom);
            }
        }
    };

    const removeFromBill = (id) => {
        setBillItems(prev => {
            const next = prev.filter(i => i.id !== id);
            if (next.length === 0) setSelectedBillIndex(-1);
            else if (selectedBillIndex >= next.length) setSelectedBillIndex(next.length - 1);
            return next;
        });
    };

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
                    return { ...updated, price: newPrice, prices, base_unit_price: newPrice / factor };
                } else {
                    const prices = { ...i.prices, Nos: newPrice, Piece: newPrice };
                    return { ...updated, price: newPrice, prices, base_unit_price: newPrice };
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
    const applyDiscountHandler = async () => {
        const value = parseFloat(discountInput) || 0;
        if (value > 0) {
            if (loyaltyAmount > 0) {
                Swal.fire('Error', 'Cannot apply discount when loyalty points are redeemed. Reset loyalty first.', 'error');
                return;
            }
            try {
                if (isOffline) {
                    if (secretKeyInput !== userSecretKey) {
                        Swal.fire('Unauthorized', 'Incorrect Secret Key (Offline Verification). Discount rejected.', 'error');
                        return;
                    }
                    setDiscountAuthorizedBy("Manager (Offline)");
                } else {
                    const res = await POSService.verifyAuthorizationKey(secretKeyInput, 'discount', warehouse);
                    if (res && res.status === 'error') {
                        Swal.fire('Unauthorized', res.message || 'Incorrect Secret Key.', 'error');
                        return;
                    }
                    setDiscountAuthorizedBy(res.authorized_by || "Authorized Cashier");
                }
            } catch (err) {
                if (err.message && err.message.includes("Incorrect Secret Key")) {
                    Swal.fire('Unauthorized', err.message, 'error');
                    return;
                }
                if (secretKeyInput !== userSecretKey) {
                    Swal.fire('Unauthorized', 'Incorrect Secret Key. Discount rejected.', 'error');
                    return;
                }
                setDiscountAuthorizedBy("Manager (Offline Fallback)");
            }
        }
        setDiscount(prev => ({ ...prev, value }));
        setShowDiscountModal(false);
        setDiscountInput("");
        setSecretKeyInput("");

        if (value > 0 && selectedCustomer && selectedCustomer.name !== 'Cash' && selectedCustomer.customer_group !== 'Discount Customer') {
            setTimeout(async () => {
                const result = await Swal.fire({
                    title: 'Promote to Discount Customer?',
                    text: `Do you want to promote "${selectedCustomer.customer_name}" to the 'Discount Customer' group since a discount is active?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Promote',
                    cancelButtonText: 'No'
                });
                if (result.isConfirmed) {
                    Swal.showLoading();
                    const updated = await promoteCustomerGroup(selectedCustomer, 'Discount Customer');
                    if (updated) {
                        Swal.fire({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                            icon: 'success', title: 'Customer group updated to Discount Customer'
                        });
                    }
                }
            }, 100);
        }
    };

    const clearDiscount = () => {
        setDiscount({ type: 'amount', value: 0 });
        setDiscountInput("");
        setSecretKeyInput("");
        setDiscountAuthorizedBy("");
        setShowDiscountModal(false);
    };

    const clearBillHandler = useCallback(() => {
        setBillItems([]);
        setSelectedBillIndex(-1);
        setDiscount({ type: 'amount', value: 0 });
        setDiscountInput("");
        setSecretKeyInput("");
        setDiscountAuthorizedBy("");
        setLoyaltyPointsToRedeem(0);
        setLoyaltyAmount(0);
        setLoyaltyInput("");
        setLoyaltyAuthorizedBy("");
    }, []);

    // Loyalty Points
    const handleLoyaltyPointsClick = () => {
        if (discount.value > 0) {
            Swal.fire('Restricted', 'Loyalty points cannot be redeemed when a manual discount is applied.', 'warning');
            return;
        }
        if (!selectedCustomer || selectedCustomer.name === 'Cash') {
            Swal.fire('Notice', 'Please select a customer first.', 'info');
            return;
        }
        if (selectedCustomer.customer_group === 'Discount Customer') {
            Swal.fire('Restricted', 'Loyalty points are not applicable for Discount Customers.', 'warning');
            return;
        }
        if (!selectedCustomer.loyalty_program) {
            Swal.fire('Notice', 'Selected customer is not enrolled in a loyalty program.', 'info');
            return;
        }
        setLoyaltyInput(loyaltyPointsToRedeem > 0 ? String(loyaltyPointsToRedeem) : "");
        setShowLoyaltyModal(true);
    };

    const applyLoyaltyPoints = async () => {
        const points = parseInt(loyaltyInput) || 0;
        if (points <= 0) {
            Swal.fire('Error', 'Please enter a valid points value.', 'error');
            return;
        }
        const redeemedValue = points * 1.0;
        if (redeemedValue > subtotal) {
            Swal.fire('Error', 'Redemption amount cannot exceed subtotal.', 'error');
            return;
        }

        try {
            if (isOffline) {
                if (secretKeyInput !== userSecretKey) {
                    Swal.fire('Unauthorized', 'Incorrect Secret Key (Offline Verification). Loyalty redemption rejected.', 'error');
                    return;
                }
                setLoyaltyAuthorizedBy("Manager (Offline)");
            } else {
                const res = await POSService.verifyAuthorizationKey(secretKeyInput, 'loyalty_redemption', warehouse);
                if (res && res.status === 'error') {
                    Swal.fire('Unauthorized', res.message || 'Incorrect Secret Key.', 'error');
                    return;
                }
                setLoyaltyAuthorizedBy(res.authorized_by || "Authorized Cashier");
            }
        } catch (err) {
            if (err.message && err.message.includes("Incorrect Secret Key")) {
                Swal.fire('Unauthorized', err.message, 'error');
                return;
            }
            if (secretKeyInput !== userSecretKey) {
                Swal.fire('Unauthorized', 'Incorrect Secret Key. Loyalty redemption rejected.', 'error');
                return;
            }
            setLoyaltyAuthorizedBy("Manager (Offline Fallback)");
        }

        setLoyaltyPointsToRedeem(points);
        setLoyaltyAmount(redeemedValue);
        setSecretKeyInput("");
        setShowLoyaltyModal(false);
    };

    const clearLoyaltyPoints = () => {
        setLoyaltyPointsToRedeem(0);
        setLoyaltyAmount(0);
        setLoyaltyInput("");
        setSecretKeyInput("");
        setLoyaltyAuthorizedBy("");
        setShowLoyaltyModal(false);
    };

    // Checkout
    const handleCheckout = () => {
        if (grandTotal <= 0) {
            Swal.fire('Info', 'No items in bill', 'info');
            return;
        }
        // POS opening entry shift check is bypassed
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
                const discRate = item.price;
                return {
                    item_code: item.id,
                    item_name: item.name || item.item_name,
                    qty: item.qty,
                    uom: item.uom,
                    uom_type: item.uom,
                    is_tax_inclusive: item.is_tax_inclusive !== false,
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
            payments: [{
                mode_of_payment: 'Cash',
                amount: parseFloat(grandTotal.toFixed(2))
            }],
            discount_amount: displayDiscount,
            apply_discount_on: "Net Total",
            redeem_loyalty_points: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : (loyaltyAmount > 0 ? 1 : 0),
            loyalty_points: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : loyaltyPointsToRedeem,
            loyalty_amount: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : loyaltyAmount,
            tax_template: selectedTaxTemplate,
            taxes_and_charges: selectedTaxTemplate,
            posting_date: new Date().toISOString().slice(0, 10),
            currency: 'AED',
            due_date: new Date().toISOString().slice(0, 10),
            docstatus: 0,
            is_draft: true,
            custom_discount_authorized_by: discountAuthorizedBy || "",
            custom_loyalty_authorized_by: loyaltyAuthorizedBy || ""
        };

        try {
            const data = await POSService.createInvoice(draftPayload);
            if (data && (data.status === 'success' || data.name)) {
                const serverName = data.name || data.invoice_name;

                setBillItems([]);
                setDiscount({ type: 'amount', value: 0 });
                setDiscountAuthorizedBy("");
                setLoyaltyPointsToRedeem(0);
                setLoyaltyAmount(0);
                setLoyaltyInput("");
                setLoyaltyAuthorizedBy("");
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
                const loadedItems = res.items.map(item => {
                    const itemId = item.id || item.item_code;
                    const catalogItem = Items.find(it => it.id === itemId);
                    return {
                        id: itemId,
                        name: item.item_name || catalogItem?.name || '',
                        qty: item.qty,
                        uom: item.uom,
                        price: item.rate,
                        is_tax_inclusive: item.is_tax_inclusive !== false,
                        custom_pieces_per_box: item.custom_pieces_per_box || catalogItem?.custom_pieces_per_box || 1,
                        image: item.image || catalogItem?.image,
                        category: item.category || catalogItem?.category || catalogItem?.group,
                        prices: catalogItem?.prices || { [item.uom]: item.rate },
                        uom_conversions: catalogItem?.uom_conversions || { [item.uom]: 1 },
                        local_qty: catalogItem?.local_qty || item.qty,
                        actual_qty: catalogItem?.actual_qty || item.qty,
                        warehouse_details: catalogItem?.warehouse_details || [],
                        base_unit_price: catalogItem?.prices?.Nos || catalogItem?.prices?.Piece || (item.uom === 'Box' ? (item.rate / (item.custom_pieces_per_box || 1)) : item.rate)
                    };
                });

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
                total_qty: d.total_qty || 0,
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
    const completePayment = async (directMode = null) => {
        if (paymentLoading) return;
        let finalPayments = [];

        if (directMode) {
            finalPayments.push({
                mode_of_payment: directMode,
                amount: round2(grandTotal)
            });
        } else {
            finalPayments = [...payments];
            // AUTO-CAPTURE: If there's an amount entered but not added to list, include it
            const amt = parseFloat(tenderedAmount) || 0;
            if (selectedPaymentMode && amt > 0) {
                finalPayments.push({
                    mode_of_payment: selectedPaymentMode,
                    amount: round2(amt)
                });
            }
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

        // Validate Credit payment safeguard
        const hasCreditPayment = finalPayments.some(p => p.mode_of_payment === 'Credit');
        if (hasCreditPayment && selectedCustomer?.customer_group !== 'Credit Customer') {
            if (selectedCustomer && selectedCustomer.name !== 'Cash') {
                const result = await Swal.fire({
                    title: 'Promote to Credit Customer?',
                    text: `Only Credit Customers can check out on Credit. Do you want to promote "${selectedCustomer.customer_name}" to Credit Customer?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Promote',
                    cancelButtonText: 'Cancel'
                });
                if (result.isConfirmed) {
                    Swal.showLoading();
                    const updated = await promoteCustomerGroup(selectedCustomer, 'Credit Customer');
                    if (!updated) {
                        Swal.fire('Error', 'Failed to promote customer. Credit checkout aborted.', 'error');
                        return;
                    }
                    Swal.close();
                } else {
                    return;
                }
            } else {
                Swal.fire('Error', 'Credit Checkout is only allowed for named/registered customers.', 'error');
                return;
            }
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
                return {
                    item_code: item.id,
                    item_name: item.name,
                    quantity: item.qty,
                    uom: item.uom,
                    uom_type: item.uom,
                    is_tax_inclusive: item.is_tax_inclusive !== false,
                    custom_pieces_per_box: item.custom_pieces_per_box,
                    basePrice: item.price,
                    rate: item.price,
                    price_list_rate: item.price,
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
            redeem_loyalty_points: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : (loyaltyAmount > 0 ? 1 : 0),
            loyalty_points: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : loyaltyPointsToRedeem,
            loyalty_amount: (selectedCustomer?.customer_group === 'Discount Customer') ? 0 : loyaltyAmount,
            tax_template: selectedTaxTemplate,
            taxes_and_charges: selectedTaxTemplate,
            posting_date: new Date().toISOString().slice(0, 10),
            currency: 'AED',
            due_date: new Date().toISOString().slice(0, 10),
            account_manager: user,
            docstatus: 1,
            is_draft: false,
            custom_discount_authorized_by: discountAuthorizedBy || "",
            custom_loyalty_authorized_by: loyaltyAuthorizedBy || ""
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
                        let loyaltyData = null;
                        if (selectedCustomer?.loyalty_program && selectedCustomer?.customer_group !== 'Discount Customer') {
                            const sumOfEligible = billItems.reduce((sum, item) => sum + (item.custom_loyalty_eligible ? (parseFloat(item.price) * parseFloat(item.qty)) : 0), 0);
                            const pointsEarned = Math.floor(sumOfEligible);
                            const oldPoints = parseInt(selectedCustomer?.loyalty_points || 0);
                            const pointsRedeemed = loyaltyPointsToRedeem || 0;
                            const newBalance = oldPoints + pointsEarned - pointsRedeemed;
                            loyaltyData = {
                                enabled: true,
                                oldPoints,
                                pointsEarned,
                                pointsRedeemed,
                                newBalance
                            };
                        }

                        handlePrint({
                            name: serverName,
                            grand_total: grandTotal,
                            subtotal: subtotal,
                            discount_amount: discountAmount,
                            tax_amount: taxAmount,
                            posting_date: format(new Date(), 'yyyy-MM-dd'),
                            posting_time: format(new Date(), 'HH:mm:ss'),
                            items: billItems,
                            payments: finalPayments,
                            loyalty: loyaltyData
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
            if (isOffline) {
                await db.invoices.add({ ...payload, is_synced: 0, grand_total: grandTotal });
                Swal.fire({
                    icon: 'info',
                    title: 'Saved Offline',
                    text: `The server reported an error (${e.message || e}). We have saved this invoice locally. It will sync automatically when possible.`,
                    confirmButtonColor: '#3b82f6'
                });
                finalizeOrder();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Payment Submission Failed',
                    text: `The server reported an error: ${e.message || e}. Please try again or check connection.`,
                    confirmButtonColor: '#ef4444'
                });
            }
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
                method: 'kyle_retail.retail_api.api.find_nearest_stock',
                args: { item_code: item.id, current_warehouse: warehouse }
            });

            Swal.close();

            if (results && results.length > 0) {
                const filteredResults = results.filter(res => {
                    const whLower = (res.warehouse || "").toLowerCase();
                    return !["goods in transit", "finished goods", "work in progress", "stores"].some(term => whLower.includes(term));
                });

                if (filteredResults.length > 0) {
                    const optionsHtml = filteredResults.slice(0, 7).map(res => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #e2e8f0;">
            <div style="text-align:left;">
              <div style="font-weight:900; color:#1e293b; font-size:0.85rem;">${getBranchName(res.warehouse)}</div>
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
                        const itemObj = Items.find(it => it.id === itemCode || it.item_code === itemCode);
                        const stockUom = itemObj?.stock_uom || 'Nos';
                        const conversions = itemObj?.uom_conversions || {};
                        const uomOptions = Object.keys(conversions).length > 0 ? Object.keys(conversions) : [stockUom];

                        const uomSelectHtml = uomOptions.map(u => `<option value="${u}">${u}</option>`).join('');

                        const { value: formValues } = await Swal.fire({
                            title: 'Request Details',
                            html: `
                                <div style="text-align: left; margin-bottom: 12px;">
                                    <label style="font-weight: 700; font-size: 13px; color: #475569;">Quantity</label>
                                    <input type="number" id="swal-input-qty" class="swal2-input" value="1" min="1" style="margin: 8px 0; width: 100%; box-sizing: border-box;">
                                </div>
                                <div style="text-align: left;">
                                    <label style="font-weight: 700; font-size: 13px; color: #475569;">UOM</label>
                                    <select id="swal-input-uom" class="swal2-select" style="margin: 8px 0; width: 100%; box-sizing: border-box; height: 50px;">
                                        ${uomSelectHtml}
                                    </select>
                                </div>
                            `,
                            focusConfirm: false,
                            showCancelButton: true,
                            confirmButtonText: 'Submit Request',
                            confirmButtonColor: '#2563eb',
                            preConfirm: () => {
                                const qty = document.getElementById('swal-input-qty').value;
                                const uom = document.getElementById('swal-input-uom').value;
                                if (!qty || parseFloat(qty) <= 0) {
                                    Swal.showValidationMessage('Please enter a valid quantity');
                                    return false;
                                }
                                return { qty, uom };
                            }
                        });

                        if (formValues) {
                            const { qty, uom } = formValues;
                            Swal.fire({ title: 'Creating Material Request...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                            try {
                                const res = await frappeCall({
                                    method: 'kyle_retail.retail_api.api.create_draft_material_request',
                                    args: {
                                        item_code: itemCode,
                                        qty: parseFloat(qty),
                                        from_warehouse: fromWh,
                                        to_warehouse: toWh,
                                        uom: uom
                                    }
                                });
                                if (res.status === 'success') {
                                    Swal.fire('Success', `Material Request ${res.name} submitted successfully!`, 'success');
                                } else {
                                    throw new Error(res.message || 'Failed to submit request');
                                }
                            } catch (e) {
                                Swal.fire('Error', e.message || 'Failed to create request', 'error');
                            }
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
        setSelectedBillIndex(-1);
        setDiscount({ type: 'amount', value: 0 });
        setDiscountInput("");
        setSecretKeyInput("");
        setDiscountAuthorizedBy("");
        setLoyaltyPointsToRedeem(0);
        setLoyaltyAmount(0);
        setLoyaltyInput("");
        setLoyaltyAuthorizedBy("");
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
            e.preventDefault();
            const rawTerm = (customerMobile || customerName).trim();
            if (!rawTerm || rawTerm === 'Cash') return;

            // Strip country code prefix (+971, +91, 971, 91) to get bare local number
            const strippedNumber = rawTerm
                .replace(/^\+?(971|91)/, '')   // remove UAE (+971) or India (+91) prefix
                .replace(/\D/g, '');            // remove any remaining non-digits

            // The lookup term: use stripped if it's a valid number, otherwise use raw
            const searchTerm = /^\d{7,}$/.test(strippedNumber) ? strippedNumber : rawTerm;

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
            if (/^\d{7,}$/.test(strippedNumber) || /^\d{7,}$/.test(rawTerm)) {
                const fullMobile = strippedNumber || rawTerm.replace(/\D/g, '');
                if (countryCodePrefix === '+971' && fullMobile.length !== 9) {
                    Swal.fire('Validation Error', 'UAE mobile number must be exactly 9 digits.', 'warning');
                    return;
                }
                if (countryCodePrefix === '+91' && fullMobile.length !== 10) {
                    Swal.fire('Validation Error', 'India mobile number must be exactly 10 digits.', 'warning');
                    return;
                }

                setCustomerLoading(true);
                // Build the full mobile number with country code for storage/display
                const mobileWithCode = `${countryCodePrefix}${fullMobile}`;
                try {
                    const res = await frappeCall({
                        method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
                        args: {
                            mobile_no: mobileWithCode,
                            warehouse: warehouse,
                            customer_group: 'Retail Customer'
                        }
                    });

                    if (res && res.name) {
                        pickCustomer(res);
                        const Toast = Swal.mixin({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                        });
                        Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name || res.name}` });
                        setCustomerMobile('');
                        barcodeInputRef.current?.focus();
                        return;
                    }
                } catch (err) {
                    if (err.message && err.message.includes("409")) {
                        // 409 means conflict - usually customer already exists; search by mobile
                        try {
                            const listRes = await frappeCall({
                                method: 'frappe.client.get_list',
                                args: { doctype: 'Customer', filters: [['mobile_no', '=', mobileWithCode]], fields: ['name', 'customer_name', 'mobile_no'] }
                            });
                            if (listRes && listRes.length > 0) {
                                pickCustomer(listRes[0]);
                                const Toast = Swal.mixin({
                                    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                                });
                                Toast.fire({ icon: 'success', title: `Customer: ${listRes[0].customer_name || listRes[0].name}` });
                                setCustomerMobile('');
                                barcodeInputRef.current?.focus();
                                return;
                            }
                        } catch (e2) { }
                    }
                    console.error("Customer lookup failed", err);
                    // If auto-create and fetch fails completely, open the Create Customer Modal
                    openCreate();
                } finally {
                    setCustomerLoading(false);
                }
            } else {
                // It's a name/non-numeric string, show input popup to enter mobile number with country prefix switch
                const cleanName = rawTerm.trim();
                const result = await Swal.fire({
                    title: 'Create Customer',
                    text: `Enter mobile number for "${cleanName}":`,
                    html: `
                        <div style="display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 15px;">
                            <select id="swal-country-code" style="height: 38px; padding: 0 8px; border: 1px solid #d1d5db; border-radius: 6px; font-weight: bold; outline: none; cursor: pointer;">
                                <option value="+971" ${countryCodePrefix === '+971' ? 'selected' : ''}>🇦🇪 +971</option>
                                <option value="+91" ${countryCodePrefix === '+91' ? 'selected' : ''}>🇮🇳 +91</option>
                            </select>
                            <input id="swal-mobile-input" type="tel" placeholder="Enter mobile number..." style="height: 38px; padding: 0 12px; border: 1px solid #d1d5db; border-radius: 6px; font-weight: bold; flex: 1; outline: none;" />
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Create Customer',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#2563eb',
                    allowEnterKey: false,
                    didOpen: () => {
                        const select = document.getElementById('swal-country-code');
                        const input = document.getElementById('swal-mobile-input');
                        if (select && input) {
                            input.focus();
                            const getLimit = () => select.value === '+971' ? 9 : 10;
                            input.addEventListener('input', (e) => {
                                let val = e.target.value.replace(/\D/g, '');
                                const maxDigits = getLimit();
                                if (val.length > maxDigits) {
                                    val = val.substring(0, maxDigits);
                                }
                                e.target.value = val;
                            });
                            input.addEventListener('keydown', (e) => {
                                const maxDigits = getLimit();
                                const stripped = input.value.replace(/\D/g, '');
                                if (stripped.length >= maxDigits &&
                                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                                    e.preventDefault();
                                }
                            });
                            select.addEventListener('change', () => {
                                let val = input.value.replace(/\D/g, '');
                                const maxDigits = getLimit();
                                if (val.length > maxDigits) {
                                    val = val.substring(0, maxDigits);
                                }
                                input.value = val;
                                input.focus();
                            });
                        }
                    },
                    preConfirm: () => {
                        const code = document.getElementById('swal-country-code').value;
                        const number = document.getElementById('swal-mobile-input').value;
                        const stripped = number.replace(/\D/g, '');
                        if (!stripped) {
                            Swal.showValidationMessage('Mobile number is required!');
                            return false;
                        }
                        if (code === '+971' && stripped.length !== 9) {
                            Swal.showValidationMessage('UAE mobile number must be exactly 9 digits.');
                            return false;
                        }
                        if (code === '+91' && stripped.length !== 10) {
                            Swal.showValidationMessage('India mobile number must be exactly 10 digits.');
                            return false;
                        }
                        return { code, number: stripped };
                    }
                });
                if (result.isConfirmed && result.value) {
                    const { code, number } = result.value;
                    const mobileWithCode = `${code}${number}`;
                    setCustomerLoading(true);
                    try {
                        const res = await frappeCall({
                            method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
                            args: {
                                mobile_no: mobileWithCode,
                                customer_name: cleanName,
                                warehouse: warehouse,
                                customer_group: 'Retail Customer'
                            }
                        });
                        if (res && res.name) {
                            pickCustomer(res);
                            const Toast = Swal.mixin({
                                toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                            });
                            Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name || res.name}` });
                            setCustomerMobile('');
                            barcodeInputRef.current?.focus();
                        } else {
                            Swal.fire('Error', "Failed to create customer", 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        Swal.fire('Error', err.message || "Failed to create customer", 'error');
                    } finally {
                        setCustomerLoading(false);
                    }
                }
            }
        }
    };


    // ---------- MODAL RENDERERS (REUSABLE) ----------
    const renderDiscountModal = () => (
        <div
            className="home-modal-overlay"
            onClick={() => setShowDiscountModal(false)}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000
            }}
        >
            <div
                className="home-modal"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    backgroundColor: '#ffffff',
                    borderRadius: '32px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    margin: '20px'
                }}
            >
                <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Percent size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Apply Discount</h3>
                    </div>
                    <button
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                        onClick={() => setShowDiscountModal(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="home-modal-body p-8 flex flex-col gap-6">
                    {/* Discount Type Toggle */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        <button
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${discount.type === 'amount' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setDiscount({ ...discount, type: 'amount' })}
                        >
                            <DirhamIcon size={14} /> Dirham
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${discount.type === 'percentage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setDiscount({ ...discount, type: 'percentage' })}
                        >
                            <Percent size={14} /> Percent
                        </button>
                    </div>

                    {/* Input Area */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                            <span className="text-2xl font-black text-blue-500 flex items-center justify-center">{discount.type === 'amount' ? <DirhamIcon size={20} /> : '%'}</span>
                        </div>
                        <input
                            type="number"
                            placeholder="0.00"
                            className="w-full pl-20 pr-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-4xl font-black text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-200"
                            value={discountInput}
                            onChange={e => setDiscountInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (parseFloat(discountInput) > 0) {
                                        setTimeout(() => {
                                            document.getElementById('cashier-secret-key-input')?.focus();
                                        }, 50);
                                    } else {
                                        applyDiscountHandler();
                                    }
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    {/* Cashier Secret Key Input (Premium Slate style) */}
                    {parseFloat(discountInput) > 0 && (
                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Cashier Secret Key</label>
                            <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl overflow-hidden focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                                <input
                                    id="cashier-secret-key-input"
                                    type="password"
                                    placeholder="••••"
                                    className="w-full px-6 py-4 bg-transparent text-lg font-black text-slate-900 outline-none placeholder:text-slate-300"
                                    value={secretKeyInput}
                                    onChange={e => setSecretKeyInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && applyDiscountHandler()}
                                />
                            </div>
                        </div>
                    )}

                    {/* Discount Customer instant creation */}
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 mt-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            {creatingDiscountCust ? "Creating Discount Customer..." : "Create & Select Discount Customer"}
                        </label>
                        <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl overflow-hidden focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <div className="absolute left-5 text-slate-400">
                                {creatingDiscountCust ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                ) : (
                                    <UserPlus className="w-5 h-5 text-blue-600" />
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Enter name or mobile & press Enter"
                                className="w-full pl-14 pr-6 py-4 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300"
                                value={discountCustInput}
                                onChange={e => setDiscountCustInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        createDiscountCustomer();
                                    }
                                }}
                                disabled={creatingDiscountCust}
                            />
                        </div>
                    </div>

                    {/* Impact Summary */}
                    <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12 blur-xl"></div>
                        <div className="flex justify-between items-center relative z-10">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Total</span>
                                <span className="text-lg font-black flex items-center gap-1"><DirhamIcon size={14} /> {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Final Price</span>
                                <span className="text-2xl font-black text-blue-400 flex items-center gap-1.5">
                                    <DirhamIcon size={18} /> {flt(subtotal - ((discount.type === 'percentage' ? subtotal * (parseFloat(discountInput) || 0) / 100 : (parseFloat(discountInput) || 0)))).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="home-modal-footer p-8 bg-slate-50 flex gap-4 items-center border-t border-slate-100">
                    <button
                        className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all text-xs"
                        onClick={clearDiscount}
                    >
                        Reset
                    </button>
                    <button
                        onClick={applyDiscountHandler}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all text-sm"
                    >
                        Apply Discount
                    </button>
                </div>
            </div>
        </div>
    );


    const renderLoyaltyModal = () => {
        const points = parseInt(loyaltyInput) || 0;
        const redeemedValue = points * 1.0;
        return (
            <div
                className="home-modal-overlay"
                onClick={() => setShowLoyaltyModal(false)}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000
                }}
            >
                <div
                    className="home-modal"
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: '420px',
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        margin: '20px'
                    }}
                >
                    <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 p-6 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                <Award size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Redeem Loyalty</h3>
                        </div>
                        <button
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                            onClick={() => setShowLoyaltyModal(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="home-modal-body p-8 flex flex-col gap-6">
                        {/* Customer Loyalty Profile Card */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Loyalty Program</span>
                                        <span className="text-lg font-black tracking-tight truncate max-w-[200px]">
                                            {selectedCustomer?.loyalty_program || 'Tier Program'}
                                        </span>
                                    </div>
                                    <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        Active
                                    </div>
                                </div>
                                <div className="flex justify-between items-end pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Available Balance</span>
                                        <span className="text-3xl font-black">{selectedCustomer?.loyalty_points || 0} <span className="text-xs font-normal">pts</span></span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">Redemption Rate</span>
                                        <span className="text-xs font-bold flex items-center gap-1">1 Pt = <DirhamIcon size={11} /> 1.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Points to Redeem</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-3xl font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all placeholder:text-slate-200"
                                    value={loyaltyInput}
                                    onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        const maxPts = selectedCustomer?.loyalty_points || 0;
                                        if (val > maxPts) {
                                            setLoyaltyInput(String(maxPts));
                                        } else {
                                            setLoyaltyInput(e.target.value);
                                        }
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && applyLoyaltyPoints()}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Cashier Secret Key Input for Loyalty Redemption */}
                        {points > 0 && (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Cashier Secret Key</label>
                                <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 rounded-3xl overflow-hidden focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50 transition-all">
                                    <input
                                        id="loyalty-cashier-secret-key-input"
                                        type="password"
                                        placeholder="••••"
                                        className="w-full px-6 py-4 bg-transparent text-lg font-black text-slate-900 outline-none placeholder:text-slate-300"
                                        value={secretKeyInput}
                                        onChange={e => setSecretKeyInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyLoyaltyPoints()}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Impact Summary */}
                        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12 blur-xl"></div>
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Total</span>
                                    <span className="text-lg font-black flex items-center gap-1"><DirhamIcon size={14} /> {subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Final Price</span>
                                    <span className="text-2xl font-black text-emerald-400 flex items-center gap-1.5">
                                        <DirhamIcon size={18} /> {Math.max(0, subtotal - redeemedValue).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="home-modal-footer p-8 bg-slate-50 flex gap-4 items-center border-t border-slate-100">
                        <button
                            className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all text-xs"
                            onClick={clearLoyaltyPoints}
                        >
                            Reset
                        </button>
                        <button
                            onClick={applyLoyaltyPoints}
                            className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all text-sm"
                        >
                            Confirm Redemption
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    const renderPaymentModal = () => (
        <div
            className="home-modal-overlay"
            onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000
            }}
        >
            <div
                className="home-modal payment-process-modal"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    backgroundColor: '#ffffff',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    margin: '20px',
                    maxHeight: '95vh'
                }}
            >
                <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 p-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-sky-200">
                            <CreditCard size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Process Payment</h3>
                    </div>
                    <button
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                        onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="home-modal-body p-5 flex flex-col gap-4 overflow-y-auto">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 payment-status-blocks">
                        {/* Total Bill Card */}
                        <div className="payment-status-card bg-gradient-to-br from-slate-800 to-slate-950 text-white p-3 rounded-2xl flex flex-col justify-between shadow-md border border-slate-900 relative overflow-hidden min-h-[76px]">
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-white/5 rounded-full blur-xl"></div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Bill</span>
                            <span className="text-base sm:text-lg font-black tracking-tight mt-1 flex items-center gap-1"><DirhamIcon size={12} /> {grandTotal.toFixed(2)}</span>
                        </div>

                        {/* Paid Amount Card */}
                        <div className="payment-status-card bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-950 p-3 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[76px]">
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500/5 rounded-full blur-xl"></div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Paid Amount</span>
                            <span className="text-base sm:text-lg font-black tracking-tight text-emerald-700 mt-1 flex items-center gap-1"><DirhamIcon size={12} /> {totalPaid.toFixed(2)}</span>
                        </div>

                        {/* Balance / Change Card */}
                        <div className={`payment-status-card bg-gradient-to-br ${balanceRemaining > 0
                            ? 'from-rose-500/10 to-red-500/10 border-rose-500/20 text-rose-950'
                            : 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-950'
                            } border p-3 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[76px]`}>
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-current opacity-[0.03] rounded-full blur-xl"></div>
                            <span className={`text-[9px] font-black uppercase tracking-wider ${balanceRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                {balanceRemaining > 0 ? 'Remaining' : 'Change Due'}
                            </span>
                            <span className={`text-base sm:text-lg font-black tracking-tight mt-1 ${balanceRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'
                                }`}>
                                <DirhamIcon size={12} /> {Math.abs(balanceRemaining).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Added Payments List */}
                    {payments.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Payment Ledger</h4>
                            <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto pr-1 payment-ledger-list">
                                {payments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 px-3 rounded-2xl border border-slate-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.mode_of_payment.includes('Cash') ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                                                {p.mode_of_payment.includes('Cash') ? <Banknote size={16} /> : <CreditCard size={16} />}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{p.mode_of_payment}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-black text-slate-900 flex items-center gap-1"><DirhamIcon size={11} /> {p.amount.toFixed(2)}</span>
                                            <button onClick={() => removePayment(idx)} className="text-rose-400 hover:text-rose-600 p-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment Selection Area */}
                    {balanceRemaining > 0 && (
                        <div className="flex flex-col gap-3">
                            {!selectedPaymentMode ? (
                                <>
                                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Payment Method</h5>
                                    <div className="grid grid-cols-3 gap-2.5 payment-methods-grid">
                                        <button
                                            className="payment-method-btn group p-3 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex flex-col items-center gap-1 hover:bg-emerald-600 hover:border-emerald-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Cash')}
                                        >
                                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded shadow-sm">1</div>
                                            <div className="w-9 h-9 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <DollarSign size={18} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-emerald-700 group-hover:text-white text-[9px]">Cash</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-3 bg-sky-50 border-2 border-sky-100 rounded-2xl flex flex-col items-center gap-1 hover:bg-sky-600 hover:border-sky-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Card')}
                                        >
                                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-sky-600 text-white text-[9px] font-black rounded shadow-sm">2</div>
                                            <div className="w-9 h-9 bg-white text-sky-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <CreditCard size={18} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-sky-700 group-hover:text-white text-[9px]">Card</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex flex-col items-center gap-1 hover:bg-indigo-600 hover:border-indigo-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('InstaPay')}
                                        >
                                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded shadow-sm">3</div>
                                            <div className="w-9 h-9 bg-white text-indigo-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Banknote size={18} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-indigo-700 group-hover:text-white text-[9px] text-center">InstaPay</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-3 bg-amber-50 border-2 border-amber-100 rounded-2xl flex flex-col items-center gap-1 hover:bg-amber-600 hover:border-amber-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={handleCreditPaymentSelection}
                                        >
                                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-600 text-white text-[9px] font-black rounded shadow-sm">4</div>
                                            <div className="w-9 h-9 bg-white text-amber-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Coins size={18} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-amber-700 group-hover:text-white text-[9px]">Credit</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-3 bg-purple-50 border-2 border-purple-100 rounded-2xl flex flex-col items-center gap-1 hover:bg-purple-600 hover:border-purple-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Bank')}
                                        >
                                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-purple-600 text-white text-[9px] font-black rounded shadow-sm">5</div>
                                            <div className="w-9 h-9 bg-white text-purple-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Building2 size={18} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-purple-700 group-hover:text-white text-[9px] text-center">Bank</span>
                                        </button>
                                    </div>

                                </>
                            ) : (
                                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-sky-200 animate-in fade-in slide-in-from-bottom-2 payment-mode-input-container">
                                    <div className="flex justify-between items-center mb-3 px-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedPaymentMode} Amount</span>
                                        <button onClick={() => setSelectedPaymentMode('')} className="text-[10px] font-black text-sky-600 hover:underline uppercase">Change Mode</button>
                                    </div>
                                    <div className="mb-3 flex items-center bg-white border-2 border-sky-500 rounded-xl overflow-hidden shadow-sm focus-within:ring-4 focus-within:ring-sky-100 transition-all">
                                        <span className="pl-4 pr-2 text-base font-black text-slate-400 flex items-center justify-center"><DirhamIcon size={16} /></span>
                                        <input
                                            type="number"
                                            value={tenderedAmount}
                                            onChange={e => setTenderedAmount(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.target.select()}
                                            className="w-full pr-4 py-3 bg-transparent text-2xl font-black text-slate-900 outline-none"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                                        />
                                    </div>
                                    <button
                                        onClick={addPayment}
                                        className="w-full py-3.5 bg-sky-600 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-xl shadow-sky-200 hover:bg-sky-700 active:scale-95 transition-all text-xs"
                                    >
                                        Add {selectedPaymentMode} <DirhamIcon size={11} className="mx-1" /> {(parseFloat(tenderedAmount) || 0).toFixed(2)}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="home-modal-footer p-5 bg-slate-50 flex gap-4 items-center border-t border-slate-100">
                    <button
                        className="flex-1 py-3 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all text-xs"
                        onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}
                    >
                        Cancel Order
                    </button>
                    <button
                        onClick={completePayment}
                        disabled={paymentLoading || balanceRemaining > 0}
                        className={`flex-[2] py-3 rounded-xl font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 text-xs ${balanceRemaining <= 0
                            ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        {paymentLoading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                        {paymentLoading ? (
                            'Finalizing...'
                        ) : (
                            <span className="flex items-center gap-1.5">
                                Complete Payment
                                <kbd className="px-1.5 py-0.5 text-[9px] font-black bg-white/20 rounded border border-white/10 uppercase tracking-normal">Space</kbd>
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );


    const handlePrint = (invoiceData) => {
        const cashierName = user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = company || 'KYLE RETAIL';
        const storeAddress = getBranchName(warehouse) || 'Main Store Address';
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.name}&scale=2&height=10`;
        const dirhamSvgHtml = `<svg viewBox="0 0 344.84 299.91" style="width: 12px; height: 10px; display: inline-block; vertical-align: middle; fill: currentColor; margin-right: 2px;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>`;

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
                    .divider { border-top: 1px dashed #000; margin: 10px 0; }
                    .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .header p { margin: 2px 0; font-size: 11px; }
                    .info { margin: 12px 0; font-size: 11px; }
                    .info-row { display: flex; justify-content: space-between; }
                    .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    .items-table th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 9px; font-weight: bold; }
                    .items-table td { padding: 4px 0; vertical-align: top; font-size: 8.5px; }
                    .text-left { text-align: left !important; }
                    .text-center { text-align: center !important; }
                    .text-right { text-align: right !important; }
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
                        <tr style="border-bottom: 1px dashed #000; border-top: 1px dashed #000;">
                            <th class="text-left" style="width: 6%; padding: 3px 0;">SL</th>
                            <th class="text-left" style="width: 28%; padding: 3px 2px;">ITEM</th>
                            <th class="text-center" style="width: 8%; padding: 3px 0;">QTY</th>
                            <th class="text-center" style="width: 8%; padding: 3px 0;">UOM</th>
                            <th class="text-right" style="width: 14%; padding: 3px 0;">PRICE</th>
                            <th class="text-center" style="width: 10%; padding: 3px 0;">VAT</th>
                            <th class="text-right" style="width: 11%; padding: 3px 0;">V.VAL</th>
                            <th class="text-right" style="width: 15%; padding: 3px 0;">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(invoiceData.items || []).map((it, idx) => {
            const qty = parseFloat(it.qty) || 1;
            const price = parseFloat(it.price || it.rate || it.basePrice || 0);
            const isInc = it.is_tax_inclusive !== false;
            const taxRatePercent = 5.0; // Standard VAT rate fallback

            // Calculate VAT for one unit
            const vatVal = isInc
                ? (price - (price / (1 + (taxRatePercent / 100))))
                : (price * (taxRatePercent / 100));

            // Calculate total line amount
            const lineTotal = isInc
                ? (qty * price)
                : (qty * (price + vatVal));

            return `
                            <tr style="border-bottom: 1px dotted #ccc;">
                                <td class="text-left" style="vertical-align: top; padding: 4px 0;">${idx + 1}</td>
                                <td class="text-left" style="vertical-align: top; padding: 4px 2px; word-break: break-word; font-weight: bold; line-height: 1.1;">${it.name || it.item_name || it.item_code || 'ITEM'}</td>
                                <td class="text-center" style="vertical-align: top; padding: 4px 0;">${qty}</td>
                                <td class="text-center" style="vertical-align: top; padding: 4px 0;">${it.uom || ''}</td>
                                <td class="text-right" style="vertical-align: top; padding: 4px 0;">${price.toFixed(2)}</td>
                                <td class="text-center" style="vertical-align: top; padding: 4px 0; font-size: 7px;">${isInc ? 'INC' : 'EXC'}</td>
                                <td class="text-right" style="vertical-align: top; padding: 4px 0;">${vatVal.toFixed(2)}</td>
                                <td class="text-right" style="vertical-align: top; padding: 4px 0;">${parseFloat(lineTotal).toFixed(2)}</td>
                            </tr>
                          `;
        }).join('')}
                    </tbody>
                </table>
                <div class="divider"></div>
                <div class="totals">
                    <div class="total-row">
                        <span>SUB TOTAL</span>
                        <span>${dirhamSvgHtml}${parseFloat(invoiceData.subtotal || invoiceData.grand_total).toFixed(2)}</span>
                    </div>
                    ${invoiceData.discount_amount > 0 ? `
                        <div class="total-row">
                            <span>DISCOUNT</span>
                            <span>-${dirhamSvgHtml}${parseFloat(invoiceData.discount_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${invoiceData.tax_amount > 0 ? `
                        <div class="total-row">
                            <span>TAX</span>
                            <span>${dirhamSvgHtml}${parseFloat(invoiceData.tax_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand-total bold">
                        <span>TOTAL</span>
                        <span>${dirhamSvgHtml}${parseFloat(invoiceData.grand_total).toFixed(2)}</span>
                    </div>
                    <div style="margin-top: 10px;">
                        ${(invoiceData.payments || [{ mode_of_payment: 'CASH', amount: invoiceData.grand_total }]).map(p => `
                            <div class="total-row">
                                <span>${(p.mode_of_payment || 'PAYMENT').toUpperCase()}</span>
                                <span>${dirhamSvgHtml}${parseFloat(p.amount || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="total-row" style="margin-top: 5px; opacity: 0.8;">
                        <span>CHANGE</span>
                        <span class="bold">${dirhamSvgHtml}${changeDue.toFixed(2)}</span>
                    </div>
                </div>
                ${invoiceData.loyalty?.enabled ? `
                <div class="divider"></div>
                <div class="totals" style="font-size: 10px;">
                    <div class="center bold" style="margin-bottom: 5px;">LOYALTY POINTS SUMMARY</div>
                    <div class="total-row">
                        <span>PREVIOUS BALANCE</span>
                        <span>${invoiceData.loyalty.oldPoints}</span>
                    </div>
                    <div class="total-row">
                        <span>POINTS EARNED</span>
                        <span>+${invoiceData.loyalty.pointsEarned}</span>
                    </div>
                    ${invoiceData.loyalty.pointsRedeemed > 0 ? `
                    <div class="total-row">
                        <span>POINTS REDEEMED</span>
                        <span>-${invoiceData.loyalty.pointsRedeemed}</span>
                    </div>
                    ` : ''}
                    <div class="total-row bold" style="border-top: 1px dashed #000; padding-top: 3px; margin-top: 3px;">
                        <span>NEW BALANCE</span>
                        <span>${invoiceData.loyalty.newBalance}</span>
                    </div>
                </div>
                ` : ''}
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
    // closingEntry bypassed

    const handleMarkAllRead = async () => {
        try {
            const response = await authFetch('kyle_retail.retail_api.api.mark_all_notifications_as_read', {
                method: 'POST'
            });
            const resData = await response.json();
            const data = resData.message || resData;
            if (data && data.status === 'success') {
                dispatch(markAllRead());
            }
        } catch (error) {
            console.error("[Home] Failed to mark all notifications as read:", error);
        }
    };

    const handleNotificationClick = async (notif) => {
        try {
            setShowNotifications(false);
            // Mark as read in backend
            const response = await authFetch('kyle_retail.retail_api.api.mark_notification_as_read', {
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
            console.error("[Home] Failed to mark notification as read:", error);
            navigate(`/interbranchrequest/${notif.document_name}`);
        }
    };

    const renderNotificationDropdown = () => {
        if (!showNotifications) return null;
        return (
            <div className="nav-notification-dropdown" style={{ top: 'calc(100% + 8px)' }}>
                <div className="nav-notification-header">
                    <span>NOTIFICATIONS</span>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: 0
                            }}
                            className="hover:underline"
                        >
                            Mark all read
                        </button>
                    )}
                </div>
                <div className="nav-notification-list" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
                            No notifications
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.name}
                                onClick={() => handleNotificationClick(notif)}
                                className={`nav-notification-item ${!notif.read ? 'unread' : ''}`}
                                style={{
                                    cursor: 'pointer',
                                    padding: '10px 12px',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <span className="notif-title" style={{ fontWeight: !notif.read ? 800 : 600, fontSize: '11px', color: '#1e293b' }}>
                                        {notif.title}
                                    </span>
                                    <span style={{ fontSize: '9px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                        {new Date(notif.creation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="notif-message" style={{ margin: 0, fontSize: '10.5px', color: '#64748b', lineHeight: '1.3', textAlign: 'left' }}>
                                    {notif.message}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const handleBulkQtyUpdate = useCallback(() => {
        if (selectedBillIndex !== -1) {
            const item = billItems[selectedBillIndex];
            Swal.fire({
                title: 'Bulk Qty',
                html: `<div style="font-size: 16px; font-weight: 700; color: #475569; margin-top: 8px; margin-bottom: 8px; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #d946ef; text-align: left; line-height: 1.4;">
                    ${item.item_name || item.name}
                </div>`,
                input: 'number',
                inputValue: item.qty,
                showCancelButton: true,
                confirmButtonText: 'Update',
                confirmButtonColor: '#d946ef',
                cancelButtonColor: '#64748b'
            }).then(result => {
                if (result.isConfirmed && result.value) {
                    const newQty = parseInt(result.value);
                    const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
                    if (newQty * factor > (item.local_qty || 0)) {
                        Swal.fire('Out of Stock', 'Insufficient stock.', 'warning');
                    } else {
                        const newBill = [...billItems];
                        newBill[selectedBillIndex].qty = newQty;
                        setBillItems(newBill);
                    }
                }
            });
        } else {
            Swal.fire('Info', 'Select an item in the cart first to update quantity.', 'info');
        }
    }, [selectedBillIndex, billItems]);

    const triggerSwapItem = useCallback(() => {
        if (selectedBillIndex !== -1) {
            const activeItem = billItems[selectedBillIndex];
            Swal.fire({
                title: 'Swap Item',
                html: `
                    <div style="font-family:'Inter',sans-serif; text-align:left;">
                        <div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">Swapping active item:</div>
                        <div style="font-size:14px; font-weight:900; color:#0f172a; padding:8px 12px; background:#f1f5f9; border-radius:8px; border-left:4px solid #8b5cf6; margin-bottom:12px;">
                            ${activeItem.name} (${activeItem.id})
                        </div>
                        <input id="swal-swap-search" class="swal2-input" placeholder="Search by name or code..." style="margin: 8px 0; width: 100%; box-sizing: border-box; font-weight: 700;">
                        <div id="swal-swap-results" style="max-height: 200px; overflow-y: auto; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; display: none;"></div>
                    </div>
                `,
                showCancelButton: true,
                showConfirmButton: false,
                cancelButtonText: 'Cancel',
                cancelButtonColor: '#64748b',
                didOpen: () => {
                    const searchInput = document.getElementById('swal-swap-search');
                    const resultsContainer = document.getElementById('swal-swap-results');
                    searchInput.focus();

                    let focusedRowIndex = -1;
                    let currentMatches = [];

                    const highlightRow = (idx) => {
                        const rows = resultsContainer.querySelectorAll('.swal-swap-item-row');
                        rows.forEach((row, i) => {
                            if (i === idx) {
                                row.style.backgroundColor = '#e2e8f0';
                                row.scrollIntoView({ block: 'nearest' });
                            } else {
                                row.style.backgroundColor = 'transparent';
                            }
                        });
                    };

                    const updateResults = () => {
                        const q = searchInput.value.toLowerCase().trim();
                        focusedRowIndex = -1;
                        if (!q) {
                            currentMatches = [];
                            resultsContainer.style.display = 'none';
                            resultsContainer.innerHTML = '';
                            return;
                        }

                        const matches = Items.filter(it =>
                            it.id.toLowerCase().includes(q) ||
                            (it.item_name || it.name || '').toLowerCase().includes(q) ||
                            (it.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(q))
                        ).slice(0, 5);

                        currentMatches = matches;

                        if (matches.length === 0) {
                            resultsContainer.style.display = 'block';
                            resultsContainer.innerHTML = '<div style="padding: 10px; color: #64748b; text-align: center; font-size: 13px;">No items found</div>';
                            return;
                        }

                        resultsContainer.style.display = 'block';
                        resultsContainer.innerHTML = matches.map(it => `
                            <div class="swal-swap-item-row" data-id="${it.id}" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.15s;">
                                <div style="text-align: left;">
                                    <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${it.item_name || it.name}</div>
                                    <div style="font-size: 11px; color: #64748b;">${it.id}</div>
                                </div>
                                <div style="font-weight: 800; color: #8b5cf6; font-size: 13px;">AED ${parseFloat(it.price || 0).toFixed(2)}</div>
                            </div>
                        `).join('');

                        const rows = resultsContainer.querySelectorAll('.swal-swap-item-row');
                        rows.forEach((row, i) => {
                            row.addEventListener('mouseover', () => {
                                focusedRowIndex = i;
                                highlightRow(i);
                            });
                            row.addEventListener('mouseout', () => {
                                if (focusedRowIndex !== i) {
                                    row.style.backgroundColor = 'transparent';
                                }
                            });
                            row.addEventListener('click', () => {
                                const targetId = row.getAttribute('data-id');
                                const selectedNewItem = Items.find(item => item.id === targetId);
                                if (selectedNewItem) {
                                    setBillItems(prev => {
                                        const newBill = [...prev];
                                        const currentUom = newBill[selectedBillIndex].uom || 'Nos';
                                        const newPrice = selectedNewItem.prices?.[currentUom] || selectedNewItem.price || 0;
                                        newBill[selectedBillIndex] = {
                                            ...newBill[selectedBillIndex],
                                            id: selectedNewItem.id,
                                            name: selectedNewItem.item_name || selectedNewItem.name,
                                            price: parseFloat(newPrice),
                                            base_unit_price: parseFloat(selectedNewItem.prices?.['Nos'] || selectedNewItem.prices?.['Piece'] || selectedNewItem.price || 0),
                                            image: selectedNewItem.image,
                                            barcode: selectedNewItem.barcode,
                                            custom_loyalty_eligible: selectedNewItem.custom_loyalty_eligible,
                                            actual_qty: selectedNewItem.actual_qty || 0,
                                            local_qty: selectedNewItem.local_qty || 0,
                                            warehouse_details: selectedNewItem.warehouse_details || [],
                                            custom_pieces_per_box: selectedNewItem.custom_pieces_per_box || 1,
                                            prices: selectedNewItem.prices || {},
                                            uom_conversions: selectedNewItem.uom_conversions || {},
                                            barcode_image: selectedNewItem.barcode_image || null
                                        };
                                        return newBill;
                                    });
                                    Swal.close();
                                    const Toast = Swal.mixin({
                                        toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true
                                    });
                                    Toast.fire({ icon: 'success', title: 'Item swapped successfully!' });
                                }
                            });
                        });
                    };

                    searchInput.addEventListener('input', updateResults);

                    searchInput.addEventListener('keydown', (e) => {
                        if (currentMatches.length === 0) return;

                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            focusedRowIndex = (focusedRowIndex + 1) % currentMatches.length;
                            highlightRow(focusedRowIndex);
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            focusedRowIndex = (focusedRowIndex - 1 + currentMatches.length) % currentMatches.length;
                            highlightRow(focusedRowIndex);
                        } else if (e.key === 'Enter') {
                            if (focusedRowIndex >= 0 && focusedRowIndex < currentMatches.length) {
                                e.preventDefault();
                                const rows = resultsContainer.querySelectorAll('.swal-swap-item-row');
                                if (rows[focusedRowIndex]) {
                                    rows[focusedRowIndex].click();
                                }
                            }
                        }
                    });
                }
            });
        } else {
            Swal.fire('Info', 'Please select an item in the cart first to swap.', 'info');
        }
    }, [selectedBillIndex, billItems, Items]);

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

            if (e.key.length === 1 && /^[0-9]$/.test(e.key) && !isInputFocused) {
                scannerBuffer.current += e.key;
            } else if (e.key === 'Enter' && scannerBuffer.current.length >= 6 && !isInputFocused) {
                // Hardware Scanner finished sequence (min 6 chars for retail codes)
                e.preventDefault();
                const scanValue = scannerBuffer.current;
                scannerBuffer.current = "";
                handleBarcodeScan(scanValue);
                return;
            }

            // 2. KEYBOARD SHORTCUTS
            // A. Discount Modal Shortcuts
            if (showDiscountModal) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setDiscount(prev => ({ ...prev, type: 'amount' }));
                    return;
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setDiscount(prev => ({ ...prev, type: 'percentage' }));
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowDiscountModal(false);
                    return;
                }
            }

            // B. Payment Modal Shortcuts
            if (showPaymentModal) {
                // Enter / F12 / Ctrl+Enter: Smart Handling in Payment Modal
                if (e.key === 'F12' || (e.key === 'Enter' && e.ctrlKey)) {
                    if (balanceRemaining <= 0 && !paymentLoading) {
                        e.preventDefault();
                        e.stopPropagation();
                        completePayment();
                        return;
                    }
                }

                if (e.key === 'Enter') {
                    if (selectedPaymentMode && parseFloat(tenderedAmount) > 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        addPayment();
                        return;
                    }
                }

                // Space: Complete Payment when balance is zero
                if (e.key === ' ') {
                    if (balanceRemaining <= 0 && !paymentLoading) {
                        e.preventDefault();
                        e.stopPropagation();
                        completePayment();
                        return;
                    }
                }

                if (!selectedPaymentMode) {
                    if (e.key === '1') {
                        e.preventDefault();
                        setSelectedPaymentMode('Cash');
                    } else if (e.key === '2') {
                        e.preventDefault();
                        setSelectedPaymentMode('Card');
                    } else if (e.key === '3') {
                        e.preventDefault();
                        setSelectedPaymentMode('InstaPay');
                    } else if (e.key === '4') {
                        e.preventDefault();
                        handleCreditPaymentSelection();
                    } else if (e.key === '5') {
                        e.preventDefault();
                        setSelectedPaymentMode('Bank');
                    }
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (selectedPaymentMode) setSelectedPaymentMode('');
                    else {
                        setShowPaymentModal(false);
                        setPayments([]);
                    }
                }
                return; // Prioritize payment modal keys
            }

            // F1 / Alt+D: Discount Modal Toggle
            if (e.key === 'F1' || (e.key.toLowerCase() === 'd' && e.altKey)) {
                e.preventDefault();
                setShowDiscountModal(prev => !prev);
            }

            // F12 / Alt+L: Loyalty Modal Toggle (Only outside payment modal)
            if (!showPaymentModal && (e.key === 'F12' || (e.key.toLowerCase() === 'l' && e.altKey))) {
                e.preventDefault();
                if (showLoyaltyModal) {
                    setShowLoyaltyModal(false);
                } else {
                    handleLoyaltyPointsClick();
                }
            }

            // F2: Focus Mobile Number
            if (e.key === 'F2') {
                e.preventDefault();
                mobileInputRef.current?.focus();
            }

            // F3: Focus Barcode/Search
            if (e.key === 'F3') {
                e.preventDefault();
                barcodeInputRef.current?.focus();
            }

            // F4: Toggle Country Code Prefix (+971 <-> +91)
            if (e.key === 'F4') {
                e.preventDefault();
                setCountryCodePrefix(prev => {
                    const next = prev === '+971' ? '+91' : '+971';
                    localStorage.setItem('pos_country_code', next);
                    const Toast = Swal.mixin({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 1000, timerProgressBar: false,
                    });
                    Toast.fire({ icon: 'success', title: `Country Code: ${next}` });
                    return next;
                });
            }

            // F5: Full Stock Breakdown (all branches with REQUEST button)
            if (e.key === 'F5') {
                e.preventDefault();
                if (lastInteractedItem) {
                    showStockBreakdown(lastInteractedItem);
                } else {
                    Swal.fire('Info', 'Select or scan an item first to check stock.', 'info');
                }
            }

            // + / -: Increase/Decrease Qty (Global / Selection)
            if (e.key === '+' || e.key === '=') {
                const isQtyInput = document.activeElement.id?.startsWith('qty-input-');
                if (!isInputFocused || isQtyInput || selectedBillIndex !== -1) {
                    e.preventDefault();
                    const targetItem = isQtyInput ? billItems[parseInt(document.activeElement.id.replace('qty-input-', ''))] : billItems[selectedBillIndex];
                    if (targetItem) updateQuantity(targetItem.id, 1);
                    else if (lastInteractedItem) updateQuantity(lastInteractedItem.id, 1);
                }
            } else if (e.key === '-' || e.key === '_') {
                const isQtyInput = document.activeElement.id?.startsWith('qty-input-');
                if (!isInputFocused || isQtyInput || selectedBillIndex !== -1) {
                    e.preventDefault();
                    const targetItem = isQtyInput ? billItems[parseInt(document.activeElement.id.replace('qty-input-', ''))] : billItems[selectedBillIndex];
                    if (targetItem) updateQuantity(targetItem.id, -1);
                    else if (lastInteractedItem) updateQuantity(lastInteractedItem.id, -1);
                }
            }


            // F6: Quick Price Update
            if (e.key === 'F11') {
                e.preventDefault();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    Swal.fire({
                        title: 'Update Price',
                        html: `<div style="font-size: 16px; font-weight: 700; color: #475569; margin-top: 8px; margin-bottom: 8px; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #0ea5e9; text-align: left; line-height: 1.4;">
                            ${item.item_name || item.name}
                        </div>`,
                        input: 'number',
                        inputValue: item.price,
                        showCancelButton: true,
                        confirmButtonText: 'Update',
                        inputAttributes: { step: '0.01' },
                        confirmButtonColor: '#0ea5e9',
                        cancelButtonColor: '#64748b'
                    }).then(result => {
                        if (result.isConfirmed && result.value) {
                            const newBill = [...billItems];
                            newBill[selectedBillIndex].price = parseFloat(result.value);
                            setBillItems(newBill);
                        }
                    });
                }
            }

            // F10: Bulk Quantity Update
            if (e.key === 'F6') {
                e.preventDefault();
                handleBulkQtyUpdate();
            }

            // F8: Toggle UOM of active cart item
            if (e.key === 'F8') {
                e.preventDefault();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    const newUom = item.uom === 'Box' ? (item.uom_conversions?.Nos ? 'Nos' : 'Piece') : 'Box';
                    toggleUom(item.id, newUom);
                } else {
                    Swal.fire('Info', 'Select an item in cart first', 'info');
                }
            }

            // F10: Save Draft
            if (e.key === 'F10') {
                e.preventDefault();
                handleSaveDraft();
            }

            // Card Selection Grid Navigation in Modern Themes
            if (theme !== 'legacy' && activeCardIndex !== -1 && !showDiscountModal && !showPaymentModal) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setActiveCardIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setActiveCardIndex(prev => Math.max(prev - 1, 0));
                    return;
                }
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const gridEl = document.querySelector('.so-grid-area');
                    let cols = 6;
                    if (gridEl) {
                        const computedStyle = window.getComputedStyle(gridEl);
                        const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');
                        if (gridTemplateColumns) {
                            cols = gridTemplateColumns.trim().split(/\s+/).length || 6;
                        }
                    }
                    setActiveCardIndex(prev => Math.min(prev + cols, filteredItems.length - 1));
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const gridEl = document.querySelector('.so-grid-area');
                    let cols = 6;
                    if (gridEl) {
                        const computedStyle = window.getComputedStyle(gridEl);
                        const gridTemplateColumns = computedStyle.getPropertyValue('grid-template-columns');
                        if (gridTemplateColumns) {
                            cols = gridTemplateColumns.trim().split(/\s+/).length || 6;
                        }
                    }
                    setActiveCardIndex(prev => Math.max(prev - cols, 0));
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = filteredItems[activeCardIndex];
                    if (item) {
                        if (item.local_qty > 0) {
                            handleAddToBill(item);
                        } else {
                            handleOutOfStockAlert(item);
                        }
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setActiveCardIndex(-1);
                    return;
                }
            }

            // Arrow Keys for Bill Navigation & Tax Toggle (Ignored when payment or discount modal is open)
            const isSearchDropdownOpen = showItemDropdown || showDropdown;
            if (billItems.length > 0 && !isSearchDropdownOpen && !showDiscountModal && !showPaymentModal) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedBillIndex(prev => prev === -1 ? 0 : Math.min(prev + 1, billItems.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedBillIndex(prev => prev === -1 ? billItems.length - 1 : Math.max(prev - 1, 0));
                } else if (e.key === 'ArrowLeft' && selectedBillIndex !== -1) {
                    e.preventDefault();
                    const newBill = [...billItems];
                    newBill[selectedBillIndex].is_tax_inclusive = false;
                    setBillItems(newBill);
                } else if (e.key === 'ArrowRight' && selectedBillIndex !== -1) {
                    e.preventDefault();
                    const newBill = [...billItems];
                    newBill[selectedBillIndex].is_tax_inclusive = true;
                    setBillItems(newBill);
                }
            }

            if (e.key === 'F7' || (e.key === ' ' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
                if (billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
                    e.preventDefault();
                    handleCheckout();
                }
            }

            // F9: Active Orders Toggle
            if (e.key === 'F9') {
                e.preventDefault();
                setShowDraftsModal(prev => !prev);
            }

            // Esc: Close Modals (Fallbacks)
            if (e.key === 'Escape') {
                if (showLoyaltyModal) {
                    setShowLoyaltyModal(false);
                } else if (showItemDropdown) {
                    setShowItemDropdown(false);
                }
            }

            // Alt + C: Clear Bill
            if (e.altKey && e.key?.toLowerCase() === 'c') {
                e.preventDefault();
                if (billItems.length > 0) {
                    clearBillHandler();
                }
            }

            // Alt + 1: Direct Cash
            if (e.altKey && e.key === '1') {
                e.preventDefault();
                if (billItems.length > 0) {
                    completePayment('Cash');
                }
            }

            // Alt + 2: Direct Card
            if (e.altKey && e.key === '2') {
                e.preventDefault();
                if (billItems.length > 0) {
                    completePayment('Card');
                }
            }

            // Alt + I: Grid Card Selection Mode (Modern Themes) or Swap Item (Classic Theme)
            if (e.altKey && e.key?.toLowerCase() === 'i') {
                e.preventDefault();
                if (theme !== 'legacy') {
                    if (filteredItems.length > 0) {
                        setActiveCardIndex(prev => prev === -1 ? 0 : -1);
                    }
                } else {
                    triggerSwapItem();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        billItems,
        showPaymentModal,
        showDiscountModal,
        showLoyaltyModal,
        showItemDropdown,
        selectedPaymentMode,
        showOpeningModal,
        lastInteractedItem,
        balanceRemaining,
        tenderedAmount,
        paymentLoading,
        handleBarcodeScan,
        clearBillHandler,
        selectedBillIndex,
        updateQuantity,
        triggerSwapItem,
        selectedCustomer,
        promoteCustomerGroup,
        toggleUom,
        showDropdown,
        handleCheckout,
        addPayment,
        completePayment,
        countryCodePrefix,
        showCreateModal,
        handleBulkQtyUpdate,
        handleSaveDraft,
        discount,
        setDiscount,
        activeCardIndex,
        filteredItems,
        handleAddToBill,
        handleOutOfStockAlert,
        theme
    ]);

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
                        const groups = [...new Set(local.map(i => i.group || "others"))];

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

    const renderShortcutsList = (isVertical) => {
        const getBadgeStyle = (baseColor) => ({
            flexShrink: 0,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: isVertical ? 'space-between' : 'flex-start',
            alignItems: 'center',
            width: isVertical ? '100%' : 'auto',
            gap: isVertical ? '10px' : '0.5rem'
        });

        const getLabelStyle = () => ({
            flexGrow: isVertical ? 1 : 0,
            textAlign: isVertical ? 'right' : 'left'
        });

        return (
            <>
                {/* 1. F1 (Discount) */}
                <div className="so-shortcut-badge violet" style={getBadgeStyle('violet')} onClick={() => setShowDiscountModal(prev => !prev)}>
                    <span className="so-shortcut-key">F1</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Discount</span>
                </div>
                {/* 2. F2 (Customer) */}
                <div className="so-shortcut-badge blue" style={getBadgeStyle('blue')} onClick={() => mobileInputRef.current?.focus()}>
                    <span className="so-shortcut-key">F2</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Customer</span>
                </div>
                {/* 3. F3 (Search) */}
                <div className="so-shortcut-badge indigo" style={getBadgeStyle('indigo')} onClick={() => barcodeInputRef.current?.focus()}>
                    <span className="so-shortcut-key">F3</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Search</span>
                </div>
                {/* 4. F4 (CC) */}
                <div className="so-shortcut-badge cyan" style={getBadgeStyle('cyan')} onClick={() => {
                    setCountryCodePrefix(prev => {
                        const next = prev === '+971' ? '+91' : '+971';
                        localStorage.setItem('pos_country_code', next);
                        const Toast = Swal.mixin({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1000, timerProgressBar: false,
                        });
                        Toast.fire({ icon: 'success', title: `Country Code: ${next}` });
                        return next;
                    });
                }}>
                    <span className="so-shortcut-key">F4</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>CC ({countryCodePrefix})</span>
                </div>
                {/* 5. F5 (Stock) */}
                <div className="so-shortcut-badge amber" style={getBadgeStyle('amber')} onClick={() => {
                    if (lastInteractedItem) showStockBreakdown(lastInteractedItem);
                    else Swal.fire('Info', 'Select or scan an item first.', 'info');
                }}>
                    <span className="so-shortcut-key">F5</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Stock</span>
                </div>
                {/* 6. F6 (Bulk Qty) */}
                <div className="so-shortcut-badge pink" style={getBadgeStyle('pink')} onClick={handleBulkQtyUpdate}>
                    <span className="so-shortcut-key">F6</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Bulk Qty</span>
                </div>
                {/* 7. F8 (UOM) */}
                <div className="so-shortcut-badge violet" style={getBadgeStyle('violet')} onClick={() => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const newUom = item.uom === 'Box' ? (item.uom_conversions?.Nos ? 'Nos' : 'Piece') : 'Box';
                        toggleUom(item.id, newUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }}>
                    <span className="so-shortcut-key">F8</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>UOM</span>
                </div>
                {/* 8. F9 (Orders) */}
                <div className="so-shortcut-badge sky" style={getBadgeStyle('sky')} onClick={() => setShowDraftsModal(prev => !prev)}>
                    <span className="so-shortcut-key">F9</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Orders</span>
                </div>
                {/* 9. F10 (Save Draft) */}
                <div className="so-shortcut-badge amber" style={getBadgeStyle('amber')} onClick={handleSaveDraft}>
                    <span className="so-shortcut-key">F10</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Save Draft</span>
                </div>
                {/* 10. F12 (Loyalty) */}
                <div className="so-shortcut-badge emerald" style={getBadgeStyle('emerald')} onClick={handleLoyaltyPointsClick}>
                    <span className="so-shortcut-key">F12</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Loyalty</span>
                </div>
                {/* 11. SPACE (Pay) */}
                <div className="so-shortcut-badge emerald" style={getBadgeStyle('emerald')} onClick={handleCheckout}>
                    <span className="so-shortcut-key">SPACE</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Pay</span>
                </div>
                {/* 12. ALT+C (Clear) */}
                <div className="so-shortcut-badge rose" style={getBadgeStyle('rose')} onClick={clearBillHandler}>
                    <span className="so-shortcut-key">ALT+C</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Clear</span>
                </div>
                {/* 12a. ALT+1 (Direct Cash) */}
                <div className="so-shortcut-badge emerald" style={getBadgeStyle('emerald')} onClick={() => { if (billItems.length > 0) completePayment('Cash'); }}>
                    <span className="so-shortcut-key">ALT+1</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Direct Cash</span>
                </div>
                {/* 12b. ALT+2 (Direct Card) */}
                <div className="so-shortcut-badge indigo" style={getBadgeStyle('indigo')} onClick={() => { if (billItems.length > 0) completePayment('Card'); }}>
                    <span className="so-shortcut-key">ALT+2</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Direct Card</span>
                </div>
                {/* 13. ALT+I (Select Item / Swap Item) */}
                {theme !== 'legacy' ? (
                    <div className="so-shortcut-badge indigo" style={getBadgeStyle('indigo')} onClick={() => {
                        if (filteredItems.length > 0) {
                            setActiveCardIndex(prev => prev === -1 ? 0 : -1);
                        }
                    }}>
                        <span className="so-shortcut-key">ALT+I</span>
                        <span className="so-shortcut-label" style={getLabelStyle()}>Select Item</span>
                    </div>
                ) : (
                    <div className="so-shortcut-badge indigo" style={getBadgeStyle('indigo')} onClick={triggerSwapItem}>
                        <span className="so-shortcut-key">ALT+I</span>
                        <span className="so-shortcut-label" style={getLabelStyle()}>Swap Item</span>
                    </div>
                )}
                {/* 14. ↑ ↓ (Navigate) */}
                <div className="so-shortcut-badge slate" style={getBadgeStyle('slate')}>
                    <span className="so-shortcut-key">↑ ↓</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Navigate</span>
                </div>
                {/* 15. + / - (Qty) */}
                <div className="so-shortcut-badge slate" style={getBadgeStyle('slate')}>
                    <span className="so-shortcut-key">+ / -</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Qty</span>
                </div>
                {/* 16. ← / → (Tax Toggle) */}
                <div className="so-shortcut-badge slate" style={getBadgeStyle('slate')}>
                    <span className="so-shortcut-key">← / →</span>
                    <span className="so-shortcut-label" style={getLabelStyle()}>Tax Toggle</span>
                </div>
            </>
        );
    };

    const changeBack = Math.max(0, totalPaid - grandTotal);

    const renderDragHandle = () => {
        return (
            <div
                draggable
                onDragStart={handleShortcutsDragStart}
                onDragEnd={handleShortcutsDragEnd}
                className="so-drag-handle"
                title="Drag to Top, Bottom, Left, or Right edge of items list to dock"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    cursor: 'grab',
                    background: '#f8fafc',
                    border: '1.5px dashed #cbd5e1',
                    color: '#94a3b8',
                    transition: 'all 0.2s',
                    flexShrink: 0
                }}
                onMouseDown={(e) => { e.currentTarget.style.cursor = 'grabbing'; }}
                onMouseUp={(e) => { e.currentTarget.style.cursor = 'grab'; }}
            >
                <Move size={12} />
            </div>
        );
    };

    const renderShortcutsSelector = () => {
        return (
            <div
                ref={posDropdownRef}
                className="so-pos-selector-container"
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowPosDropdown(prev => !prev);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="so-shortcut-badge slate"
                    title="Change shortcuts bar position"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: '#f8fafc',
                        border: '1.5px solid #cbd5e1',
                        color: '#64748b',
                        boxShadow: 'none',
                        userSelect: 'none',
                        flexShrink: 0
                    }}
                >
                    <LayoutDashboard size={12} className="text-slate-500" />
                </button>
                {showPosDropdown && (
                    <div style={{
                        position: 'absolute',
                        bottom: shortcutsPosition === 'bottom' ? '32px' : 'auto',
                        top: shortcutsPosition === 'bottom' ? 'auto' : '32px',
                        left: 0,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        zIndex: 10000,
                        minWidth: '120px',
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                    }}>
                        {['top', 'bottom', 'left', 'right'].map(pos => (
                            <button
                                key={pos}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShortcutsPosition(pos);
                                    localStorage.setItem('pos_shortcuts_position', pos);
                                    setShowPosDropdown(false);
                                }}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '9px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: shortcutsPosition === pos ? '#e0e7ff' : 'transparent',
                                    color: shortcutsPosition === pos ? '#4f46e5' : '#475569',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.15s'
                                }}
                                className="pos-dropdown-item"
                            >
                                <span>{pos}</span>
                                {shortcutsPosition === pos && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4f46e5' }}></span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderShortcutsHorizontal = () => {
        return (
            <div className="so-shortcuts-strip" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', background: '#f8fafc',
                borderBottom: shortcutsPosition === 'top' ? '1px solid #e2e8f0' : 'none',
                borderTop: shortcutsPosition === 'bottom' ? '1px solid #e2e8f0' : 'none',
                overflow: 'visible',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                flexShrink: 0
            }}>
                {renderDragHandle()}
                {renderShortcutsSelector()}
                <div style={{ height: '16px', width: '1px', background: '#cbd5e1', margin: '0 2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    width: '100%',
                    overflowY: 'visible'
                }}>
                    {renderShortcutsList(false)}
                </div>
            </div>
        );
    };

    const renderShortcutsVertical = (pos) => {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                width: '190px', flexShrink: 0, padding: '14px 10px',
                background: '#f8fafc',
                borderRight: '1px solid #e2e8f0',
                borderLeft: pos === 'right' ? '1px solid #e2e8f0' : 'none',
                boxShadow: pos === 'left' ? 'inset -1px 0 2px rgba(0,0,0,0.02)' : 'inset 1px 0 2px rgba(0,0,0,0.02)',
                height: '100%',
                overflow: 'visible'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px', flexShrink: 0 }}>
                    {renderDragHandle()}
                    {renderShortcutsSelector()}
                </div>

                <div style={{ height: '1px', width: '100%', background: '#cbd5e1', marginBottom: '2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    flex: 1,
                    overflowX: 'visible'
                }}>
                    {renderShortcutsList(true)}
                </div>
            </div>
        );
    };

    const renderDropZones = () => {
        return (
            <div className="so-drop-zones-overlay" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                pointerEvents: 'none',
                display: 'grid',
                gridTemplateRows: '80px 1fr 80px',
                gridTemplateColumns: '160px 1fr 160px',
                gap: '10px',
                padding: '20px'
            }}>
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('top'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleShortcutsDrop('top')}
                    style={{
                        gridColumn: '1 / span 3',
                        gridRow: '1',
                        pointerEvents: 'auto',
                        border: `3px dashed ${dragOverZone === 'top' ? '#4f46e5' : '#cbd5e1'}`,
                        background: dragOverZone === 'top' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: dragOverZone === 'top' ? '#4f46e5' : '#64748b',
                        fontWeight: 900,
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(4px)',
                        boxShadow: dragOverZone === 'top' ? '0 0 20px rgba(79, 70, 229, 0.2)' : 'none'
                    }}
                >
                    Drop at Top Edge
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('left'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleShortcutsDrop('left')}
                    style={{
                        gridColumn: '1',
                        gridRow: '2',
                        pointerEvents: 'auto',
                        border: `3px dashed ${dragOverZone === 'left' ? '#4f46e5' : '#cbd5e1'}`,
                        background: dragOverZone === 'left' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: dragOverZone === 'left' ? '#4f46e5' : '#64748b',
                        fontWeight: 900,
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(4px)',
                        boxShadow: dragOverZone === 'left' ? '0 0 20px rgba(79, 70, 229, 0.2)' : 'none',
                        textAlign: 'center',
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)'
                    }}
                >
                    Drop on Left of Items
                </div>

                <div></div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('right'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleShortcutsDrop('right')}
                    style={{
                        gridColumn: '3',
                        gridRow: '2',
                        pointerEvents: 'auto',
                        border: `3px dashed ${dragOverZone === 'right' ? '#4f46e5' : '#cbd5e1'}`,
                        background: dragOverZone === 'right' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: dragOverZone === 'right' ? '#4f46e5' : '#64748b',
                        fontWeight: 900,
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(4px)',
                        boxShadow: dragOverZone === 'right' ? '0 0 20px rgba(79, 70, 229, 0.2)' : 'none',
                        textAlign: 'center',
                        writingMode: 'vertical-lr'
                    }}
                >
                    Drop on Right of Items
                </div>

                <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverZone('bottom'); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={() => handleShortcutsDrop('bottom')}
                    style={{
                        gridColumn: '1 / span 3',
                        gridRow: '3',
                        pointerEvents: 'auto',
                        border: `3px dashed ${dragOverZone === 'bottom' ? '#4f46e5' : '#cbd5e1'}`,
                        background: dragOverZone === 'bottom' ? 'rgba(79, 70, 229, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: dragOverZone === 'bottom' ? '#4f46e5' : '#64748b',
                        fontWeight: 900,
                        fontSize: '13px',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        backdropFilter: 'blur(4px)',
                        boxShadow: dragOverZone === 'bottom' ? '0 0 20px rgba(79, 70, 229, 0.2)' : 'none'
                    }}
                >
                    Drop at Bottom Edge
                </div>
            </div>
        );
    };

    // ---------- CLASSIC THEME RENDERERS (Green & Blue) ----------
    const renderClassicShortcutsList = (isVertical) => {
        const classicShortcutsData = [
            { key: 'F1', label: 'Discount', color: '#ec4899', icon: <Percent size={12} />, action: () => setShowDiscountModal(prev => !prev) },
            { key: 'F2', label: 'Customer', color: '#3b82f6', icon: <User size={12} />, action: () => mobileInputRef.current?.focus() },
            { key: 'F3', label: 'Search', color: '#a855f7', icon: <Search size={12} />, action: () => barcodeInputRef.current?.focus() },
            {
                key: 'F4', label: `CC (${countryCodePrefix})`, color: '#0ea5e9', icon: <Phone size={12} />, action: () => {
                    setCountryCodePrefix(prev => {
                        const next = prev === '+971' ? '+91' : '+971';
                        localStorage.setItem('pos_country_code', next);
                        const Toast = Swal.mixin({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1000, timerProgressBar: false,
                        });
                        Toast.fire({ icon: 'success', title: `Country Code: ${next}` });
                        return next;
                    });
                }
            },
            {
                key: 'F5', label: 'Stock', color: '#f59e0b', icon: <Package size={12} />, action: () => {
                    if (lastInteractedItem) handleFindNearestStock(lastInteractedItem);
                    else Swal.fire('Info', 'Select an item first', 'info');
                }
            },
            { key: 'F6', label: 'Bulk Qty', color: '#d946ef', icon: <Layers size={12} />, action: handleBulkQtyUpdate },
            { key: 'F7', label: 'Pay', color: '#10b981', icon: <CreditCard size={12} />, action: () => { if (billItems.length > 0) handleCheckout(); } },
            {
                key: 'F8', label: 'UOM Toggle', color: '#6366f1', icon: <RefreshCw size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const newUom = item.uom === 'Box' ? (item.uom_conversions?.Nos ? 'Nos' : 'Piece') : 'Box';
                        toggleUom(item.id, newUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            { key: 'F9', label: 'Orders', color: '#0369a1', icon: <Package size={12} />, action: () => setShowDraftsModal(prev => !prev) },
            { key: 'F10', label: 'Save Draft', color: '#f59e0b', icon: <Upload size={12} />, action: handleSaveDraft },
            { key: 'F12', label: 'Loyalty', color: '#10b981', icon: <Award size={12} />, action: handleLoyaltyPointsClick },
            { key: 'ALT+C', label: 'Clear', color: '#ef4444', icon: <Trash2 size={12} />, action: clearBillHandler },
            { key: 'ALT+I', label: 'Swap Item', color: '#a855f7', icon: <RefreshCw size={12} />, action: triggerSwapItem },
            { key: '↑↓', label: 'Navigate', color: '#64748b', icon: <Move size={12} /> },
            { key: '+/-', label: 'Adjust Qty', color: '#64748b', icon: <Minus size={12} /> },
            { key: '←→', label: 'Tax Toggle', color: '#64748b', icon: <ArrowLeftRight size={12} /> },
        ];

        return classicShortcutsData.map((s, idx) => (
            <div
                key={idx}
                className="classic-shortcut-badge"
                onClick={s.action}
                style={{
                    flexShrink: 0,
                    width: isVertical ? '100%' : 'auto',
                    display: 'flex',
                    justifyContent: isVertical ? 'space-between' : 'flex-start',
                    alignItems: 'center',
                    gap: isVertical ? '10px' : '8px'
                }}
            >
                <span className="classic-shortcut-key" style={{ flexShrink: 0 }}>
                    {s.key}
                </span>
                <div className="classic-shortcut-icon" style={{ display: isVertical ? 'none' : 'flex', flexShrink: 0 }}>
                    {s.icon}
                </div>
                <span className="classic-shortcut-label" style={{
                    flexGrow: isVertical ? 1 : 0,
                    textAlign: isVertical ? 'right' : 'left'
                }}>
                    {s.label}
                </span>
            </div>
        ));
    };

    const renderClassicShortcutsHorizontal = () => {
        const isGreen = legacySubTheme === 'green';
        const borderColor = isGreen ? '#10b981' : '#0ea5e9';
        return (
            <div className="classic-shortcut-guide horizontal" style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 16px',
                background: isGreen ? '#0d4a35' : '#0d3050',
                borderBottom: shortcutsPosition === 'top' ? `2px solid ${borderColor}` : 'none',
                borderTop: shortcutsPosition === 'bottom' ? `2px solid ${borderColor}` : 'none',
                flexShrink: 0,
                overflow: 'visible'
            }}>
                {renderDragHandle()}
                {renderShortcutsSelector()}
                <div style={{ height: '20px', width: '2px', background: isGreen ? '#1e7556' : '#235985', margin: '0 2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    width: '100%',
                    overflowY: 'visible',
                    flexWrap: 'nowrap'
                }}>
                    {renderClassicShortcutsList(false)}
                </div>
            </div>
        );
    };

    const renderClassicShortcutsVertical = (pos) => {
        const isGreen = legacySubTheme === 'green';
        const borderColor = isGreen ? '#10b981' : '#0ea5e9';
        return (
            <div className="classic-shortcut-guide" style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                width: '190px', flexShrink: 0, padding: '14px 10px',
                background: isGreen ? '#0d4a35' : '#0d3050',
                borderRight: pos === 'left' ? `2px solid ${borderColor}` : 'none',
                borderLeft: pos === 'right' ? `2px solid ${borderColor}` : 'none',
                height: '100%',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)',
                alignItems: 'stretch',
                overflow: 'visible'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px', flexShrink: 0 }}>
                    {renderDragHandle()}
                    {renderShortcutsSelector()}
                </div>
                <div style={{ height: '1px', width: '100%', background: isGreen ? '#1e7556' : '#235985', marginBottom: '2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    flex: 1,
                    overflowX: 'visible',
                    alignItems: 'stretch'
                }}>
                    {renderClassicShortcutsList(true)}
                </div>
            </div>
        );
    };

    // ---------- LIGHT THEME RENDERER (Emerald & Slate) ----------
    const renderLightTheme = () => {
        return (
            <div className="so-page" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* MODERN TOOL STRIP — Two-Zone Layout */}
                <div className="so-tool-strip" style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible',
                    minHeight: 'fit-content', padding: '0', gap: '0',
                    borderBottom: '1px solid #e2e8f0', background: '#ffffff',
                    position: 'relative', zIndex: 150
                }}>
                    {/* ── LEFT: Logo ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '6px 14px', flexShrink: 0
                    }}>
                        {/* POS8 Logo */}
                        <div style={{ flexShrink: 0 }}>
                            <h1 className="text-xl font-black tracking-tighter text-slate-800">
                                POS<span className="text-emerald-500">8</span>
                            </h1>
                        </div>
                    </div>

                    {/* ── RIGHT: Fixed user info + actions (never overflow) ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '20px',
                        padding: '4px 14px', flexShrink: 0,
                        borderLeft: '1px solid #e2e8f0', marginLeft: 'auto',
                        background: '#ffffff'
                    }}>
                        {/* Group 1: Navigation & Shift */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Active Orders */}
                            <button
                                onClick={() => setShowDraftsModal(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0 0.65rem', height: '1.85rem', background: '#f0f9ff',
                                    border: '1.5px solid #bae6fd', borderRadius: '0.375rem',
                                    fontSize: '0.65rem', fontWeight: 850, color: '#0369a1',
                                    cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <Package size={11} /> Active Orders
                            </button>
                        </div>

                        {/* Separator */}
                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', flexShrink: 0 }} />

                        {/* Group 2: User Profile */}
                        <div
                            onClick={() => setShowThemeSidebar(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '4px 10px', background: '#f8fafc',
                                border: '1px solid #e2e8f0', borderRadius: '8px',
                                cursor: 'pointer', flexShrink: 0
                            }}
                            title="Open Theme Settings Sidebar"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
                                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#94a3b8', marginRight: '3px' }}>USER:</span>
                                    {user?.full_name || user || 'CASHIER'}
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.2, marginTop: '1px', color: '#10b981', whiteSpace: 'nowrap' }}>
                                    <span style={{ color: '#94a3b8', marginRight: '3px' }}>BR:</span>
                                    {getBranchName(warehouse)}
                                </span>
                                <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', marginTop: '1px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {format(currentTime, 'MMM dd | HH:mm:ss')}
                                </span>
                            </div>
                            <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50%', color: '#94a3b8', flexShrink: 0 }}>
                                <UserIcon size={13} />
                            </div>
                        </div>

                        {/* Separator */}
                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', flexShrink: 0 }} />

                        {/* Group 3: Quick Utilities */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* Notification Bell Dropdown */}
                            <div className="nav-notification-container" ref={notificationsContainerRef}>
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    style={{
                                        padding: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    className={unreadCount > 0 ? "animate-pulse-subtle" : ""}
                                    title="Notifications"
                                >
                                    <Bell size={16} />
                                    {unreadCount > 0 && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '-2px',
                                                right: '-2px',
                                                background: '#ef4444',
                                                color: '#ffffff',
                                                fontSize: '8px',
                                                fontWeight: 900,
                                                borderRadius: '9999px',
                                                padding: '1px 4px',
                                                lineHeight: '1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 0 0 2px #ffffff'
                                            }}
                                        >
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                                {renderNotificationDropdown()}
                            </div>

                            {/* New Tab */}
                            <button
                                onClick={() => window.open(window.location.origin + window.location.pathname + '#/homepage', '_blank')}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '50%', flexShrink: 0 }}
                                title="Open POS in New Tab"
                            >
                                <ExternalLink size={16} />
                            </button>

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#f43f5e', borderRadius: '50%', flexShrink: 0 }}
                                title="Logout"
                            >
                                <Power size={16} />
                            </button>

                            {/* Dropdown Settings Button */}
                            <div className="relative" ref={settingsDropdownRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSettingsMenu(!showSettingsMenu);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all ${showSettingsMenu ? 'bg-slate-100 border-slate-300' : ''}`}
                                    title="Settings"
                                    style={{ height: '1.85rem', width: '1.85rem', padding: 0 }}
                                >
                                    <Settings size={14} className={showSettingsMenu ? 'animate-spin-slow' : ''} />
                                </button>

                                {showSettingsMenu && (
                                    <div
                                        className="absolute right-0 top-full mt-3 w-72 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl z-[9999] p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200"
                                        style={{ borderTop: `4px solid var(--so-primary)` }}
                                    >
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 leading-none">
                                            Configuration
                                        </div>

                                        {/* Dashboard Button */}
                                        <button
                                            onClick={() => {
                                                navigate('/dashboard');
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:scale-110 transition-transform">
                                                    <LayoutDashboard size={14} />
                                                </div>
                                                Admin Dashboard
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400" />
                                        </button>

                                        {/* Theme Switcher Button */}
                                        <button
                                            onClick={() => {
                                                setShowThemeSidebar(true);
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 group-hover:scale-110 transition-transform">
                                                    <Palette size={14} />
                                                </div>
                                                Theme Config
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                                                {legacySubTheme.toUpperCase()}
                                            </span>
                                        </button>

                                        {/* Direct Color Switcher */}
                                        {theme === 'legacy' && (
                                            <button
                                                onClick={() => {
                                                    toggleTheme();
                                                }}
                                                className="w-full mt-2 p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                            >
                                                <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                    <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-sky-50 text-sky-500' : 'bg-emerald-50 text-emerald-500'} group-hover:scale-110 transition-transform`}>
                                                        <Palette size={14} />
                                                    </div>
                                                    Switch Color
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isGreen ? 'BLUE' : 'GREEN'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {shortcutsPosition === 'top' && renderShortcutsHorizontal()}

                <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
                    <main className="so-main-layout">
                        <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', height: '100%' }}>
                            {shortcutsPosition === 'left' && renderShortcutsVertical('left')}
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

                                    {/* Premium In Stock Only Toggle */}
                                    <div 
                                        onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                                        className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all ml-auto"
                                        style={{ height: '36px' }}
                                    >
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">In Stock Only</span>
                                        <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${showAvailableOnly ? 'bg-emerald-500' : 'bg-slate-200'}`} style={{ width: '2rem', height: '1.125rem', borderRadius: '9999px', padding: '2px', display: 'flex', alignItems: 'center' }}>
                                            <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${showAvailableOnly ? 'translate-x-3.5' : 'translate-x-0'}`} style={{ width: '0.875rem', height: '0.875rem', borderRadius: '9999px', backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                        </div>
                                    </div>
                                </div>

                                {theme === 'modern_no_image' ? (
                                    <ModernNoImageGrid
                                        filteredItems={filteredItems}
                                        setLastInteractedItem={setLastInteractedItem}
                                        handleAddToBill={handleAddToBill}
                                        handleOutOfStockAlert={handleOutOfStockAlert}
                                        showStockBreakdown={showStockBreakdown}
                                        handleFindNearestStock={handleFindNearestStock}
                                        activeCardIndex={activeCardIndex}
                                        setActiveCardIndex={setActiveCardIndex}
                                    />
                                ) : (
                                    <div className="so-grid-area">
                                        {filteredItems.length === 0 ? (
                                            <div className="col-span-full h-96 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-70">
                                                <SearchSlash size={64} strokeWidth={1} />
                                                <span className="font-black text-sm uppercase tracking-[0.2em]">No products found</span>
                                            </div>
                                        ) : (
                                            filteredItems.map((item, index) => (
                                                <div
                                                    key={item.id}
                                                    className={`so-item-card ${activeCardIndex === index ? 'focused-card' : ''}`}
                                                    onClick={() => {
                                                        setActiveCardIndex(index);
                                                        setLastInteractedItem(item);
                                                        if (item.local_qty > 0) {
                                                            handleAddToBill(item);
                                                        } else {
                                                            handleOutOfStockAlert(item);
                                                        }
                                                    }}
                                                    style={{ opacity: item.local_qty > 0 ? 1 : 0.6 }}
                                                >
                                                    <div className="relative group">
                                                        {item.image ? (
                                                            <img src={getImageUrl(item.image)} alt={item.name} className="so-item-img" />
                                                        ) : (
                                                            <div className="so-item-img flex flex-col items-center justify-center bg-slate-50 border border-slate-100 text-slate-300">
                                                                <Package size={28} strokeWidth={1.5} />
                                                                <span className="text-[8px] font-black text-slate-400 mt-1 uppercase tracking-wider">No Image</span>
                                                            </div>
                                                        )}
                                                        {activeCardIndex === index && (
                                                            <div className="absolute top-2 right-2 z-20 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                                                                <span className="bg-amber-600 px-1 rounded text-[8px]">ENTER</span> ADD
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col flex-1 justify-between gap-1.5">
                                                        <h4 className="so-item-name">
                                                            {item.name}
                                                        </h4>

                                                        <div style={{ height: '16px', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                                                            {((item.barcodes && item.barcodes.length > 0) || item.barcode || item.id) ? (
                                                                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <Barcode size={10} style={{ opacity: 0.6 }} /> {item.barcodes?.[0]?.barcode || item.barcode || item.id}
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: '9px', color: '#cbd5e1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                    <Barcode size={10} style={{ opacity: 0.3 }} /> -
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Price</span>
                                                                <span className="font-black text-slate-900 text-[13px] flex items-center gap-0.5">
                                                                    <DirhamIcon size={10} className="text-slate-400" /> {parseFloat(item.price).toFixed(2)}
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

                                                    <div style={{ height: '32px', display: 'flex', alignItems: 'center', marginTop: 'auto', flexShrink: 0 }}>
                                                        {item.local_qty <= 0 ? (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleFindNearestStock(item); }}
                                                                className="w-full py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 text-[8px] font-bold uppercase tracking-tight transition-all flex items-center justify-center"
                                                            >
                                                                Request More Stock
                                                            </button>
                                                        ) : (
                                                            <div className={`so-item-instock-placeholder ${item.local_qty <= 10 ? 'low-stock' : ''}`}>
                                                                {item.local_qty} UNITS
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            {shortcutsPosition === 'right' && renderShortcutsVertical('right')}
                        </div>

                        <aside className="so-bill-side">
                            <div className="so-bill-header flex flex-col gap-3">
                                <div className="relative group">
                                    <div className="flex items-center border-2 border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-emerald-500 transition-all">
                                        <select
                                            value={countryCodePrefix}
                                            onChange={e => { setCountryCodePrefix(e.target.value); localStorage.setItem('pos_country_code', e.target.value); }}
                                            className="h-12 px-3 bg-slate-50 border-r border-slate-200 text-xs font-black text-slate-700 outline-none cursor-pointer"
                                            style={{ minWidth: '75px' }}
                                            title="Country Code (Press F4 to toggle)"
                                        >
                                            <option value="+971">🇦🇪 +971</option>
                                            <option value="+91">🇮🇳 +91</option>
                                        </select>
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <UserPlus size={18} className="text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                                            </div>
                                            <input
                                                ref={nameInputRef}
                                                type="text"
                                                placeholder="Customer Name..."
                                                value={customerName === 'Cash' ? '' : customerName}
                                                className="w-full pl-10 pr-3 py-2.5 text-lg font-black text-slate-900 placeholder:text-slate-400 bg-transparent outline-none border-none"
                                                onChange={e => {
                                                    let val = e.target.value;
                                                    if (/^[\d+]*$/.test(val)) {
                                                        const cleaned = val.replace(/\D/g, '');
                                                        const limit = countryCodePrefix === '+971' ? 9 : 10;
                                                        val = cleaned.slice(0, limit);
                                                        setCustomerMobile(val);
                                                        setCustomerName(val);
                                                    } else {
                                                        setCustomerName(val);
                                                        setCustomerMobile('');
                                                    }
                                                    if (val.trim() !== 'Cash') setSelectedCustomer(null);
                                                }}
                                                onFocus={() => { if (customerName.trim() === 'Cash') setCustomerName(''); setShowDropdown(true); }}
                                                onBlur={() => { if (!customerName.trim()) setCustomerName('Cash'); }}
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const term = customerName.trim();
                                                        if (!term || term === 'Cash') return;

                                                        // Check if it is a mobile number (7+ digits after stripping prefix)
                                                        const strippedNumber = term
                                                            .replace(/^\+?(971|91)/, '')
                                                            .replace(/\D/g, '');
                                                        const isMobile = /^\d{7,}$/.test(strippedNumber) || /^\d{7,}$/.test(term);

                                                        // 1. If we have search results matching, pick the first one
                                                        if (searchResults.length > 0) {
                                                            const matched = searchResults.find(c =>
                                                                c.customer_name.toLowerCase() === term.toLowerCase() ||
                                                                (c.mobile_no && c.mobile_no.replace(/\D/g, '').includes(strippedNumber))
                                                            ) || searchResults[0];

                                                            pickCustomer(matched);
                                                            const Toast = Swal.mixin({
                                                                toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                                                            });
                                                            Toast.fire({ icon: 'success', title: `Customer: ${matched.customer_name}` });
                                                            return;
                                                        }

                                                        // 2. If it is a mobile number, register via speed checkout
                                                        if (isMobile) {
                                                            const fullMobile = strippedNumber || term.replace(/\D/g, '');
                                                            if (countryCodePrefix === '+971' && fullMobile.length !== 9) {
                                                                Swal.fire('Validation Error', 'UAE mobile number must be exactly 9 digits.', 'warning');
                                                                return;
                                                            }
                                                            if (countryCodePrefix === '+91' && fullMobile.length !== 10) {
                                                                Swal.fire('Validation Error', 'India mobile number must be exactly 10 digits.', 'warning');
                                                                return;
                                                            }

                                                            setCustomerLoading(true);
                                                            const mobileWithCode = `${countryCodePrefix}${fullMobile}`;
                                                            try {
                                                                const res = await frappeCall({
                                                                    method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
                                                                    args: {
                                                                        mobile_no: mobileWithCode,
                                                                        warehouse: warehouse,
                                                                        customer_group: 'Retail Customer'
                                                                    }
                                                                });

                                                                if (res && res.name) {
                                                                    pickCustomer(res);
                                                                    const Toast = Swal.mixin({
                                                                        toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                                                                    });
                                                                    Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name}` });
                                                                } else {
                                                                    Swal.fire('Error', "Failed to create customer", 'error');
                                                                }
                                                            } catch (err) {
                                                                console.error(err);
                                                                // Offline creation if network fails
                                                                if (!navigator.onLine) {
                                                                    const offlineCustomer = {
                                                                        name: `OFFLINE-CUST-${Date.now()}`,
                                                                        customer_name: `Customer ${mobileWithCode}`,
                                                                        mobile_no: mobileWithCode,
                                                                        primary_address: "",
                                                                        email_id: "",
                                                                        is_synced: 0,
                                                                        is_offline: true
                                                                    };
                                                                    await db.customers.put(offlineCustomer);
                                                                    pickCustomer(offlineCustomer);
                                                                    Swal.fire('Offline Save', 'Customer saved locally. Will sync when online.', 'info');
                                                                } else {
                                                                    Swal.fire('Error', 'Network error', 'error');
                                                                }
                                                            } finally {
                                                                setCustomerLoading(false);
                                                            }
                                                        } else {
                                                            // It's a name, show input popup to enter mobile number with country prefix switch
                                                            const result = await Swal.fire({
                                                                title: 'Create Customer',
                                                                text: `Enter mobile number for "${term}":`,
                                                                html: `
                                                                     <div style="display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 15px;">
                                                                         <select id="swal-country-code" style="height: 38px; padding: 0 8px; border: 1px solid #d1d5db; border-radius: 6px; font-weight: bold; outline: none; cursor: pointer;">
                                                                             <option value="+971" ${countryCodePrefix === '+971' ? 'selected' : ''}>🇦🇪 +971</option>
                                                                             <option value="+91" ${countryCodePrefix === '+91' ? 'selected' : ''}>🇮🇳 +91</option>
                                                                         </select>
                                                                         <input id="swal-mobile-input" type="tel" placeholder="Enter mobile number..." style="height: 38px; padding: 0 12px; border: 1px solid #d1d5db; border-radius: 6px; font-weight: bold; flex: 1; outline: none;" />
                                                                     </div>
                                                                 `,
                                                                showCancelButton: true,
                                                                confirmButtonText: 'Create Customer',
                                                                cancelButtonText: 'Cancel',
                                                                confirmButtonColor: '#2563eb',
                                                                allowEnterKey: false,
                                                                didOpen: () => {
                                                                    const select = document.getElementById('swal-country-code');
                                                                    const input = document.getElementById('swal-mobile-input');
                                                                    if (select && input) {
                                                                        input.focus();
                                                                        const getLimit = () => select.value === '+971' ? 9 : 10;
                                                                        input.addEventListener('input', (e) => {
                                                                            let val = e.target.value.replace(/\D/g, '');
                                                                            const maxDigits = getLimit();
                                                                            if (val.length > maxDigits) {
                                                                                val = val.substring(0, maxDigits);
                                                                            }
                                                                            e.target.value = val;
                                                                        });
                                                                        input.addEventListener('keydown', (e) => {
                                                                            const maxDigits = getLimit();
                                                                            const stripped = input.value.replace(/\D/g, '');
                                                                            if (stripped.length >= maxDigits &&
                                                                                !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                                                                                e.preventDefault();
                                                                            }
                                                                        });
                                                                        select.addEventListener('change', () => {
                                                                            let val = input.value.replace(/\D/g, '');
                                                                            const maxDigits = getLimit();
                                                                            if (val.length > maxDigits) {
                                                                                val = val.substring(0, maxDigits);
                                                                            }
                                                                            input.value = val;
                                                                            input.focus();
                                                                        });
                                                                    }
                                                                },
                                                                preConfirm: () => {
                                                                    const code = document.getElementById('swal-country-code').value;
                                                                    const number = document.getElementById('swal-mobile-input').value;
                                                                    const stripped = number.replace(/\D/g, '');
                                                                    if (!stripped) {
                                                                        Swal.showValidationMessage('Mobile number is required!');
                                                                        return false;
                                                                    }
                                                                    if (code === '+971' && stripped.length !== 9) {
                                                                        Swal.showValidationMessage('UAE mobile number must be exactly 9 digits.');
                                                                        return false;
                                                                    }
                                                                    if (code === '+91' && stripped.length !== 10) {
                                                                        Swal.showValidationMessage('India mobile number must be exactly 10 digits.');
                                                                        return false;
                                                                    }
                                                                    return { code, number: stripped };
                                                                }
                                                            });
                                                            if (result.isConfirmed && result.value) {
                                                                const { code, number } = result.value;
                                                                const mobileWithCode = `${code}${number}`;
                                                                setCustomerLoading(true);
                                                                try {
                                                                    const res = await frappeCall({
                                                                        method: 'kyle_retail.retail_api.api.get_or_create_customer_by_mobile',
                                                                        args: {
                                                                            mobile_no: mobileWithCode,
                                                                            customer_name: term,
                                                                            warehouse: warehouse,
                                                                            customer_group: 'Retail Customer'
                                                                        }
                                                                    });
                                                                    if (res && res.name) {
                                                                        pickCustomer(res);
                                                                        const Toast = Swal.mixin({
                                                                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                                                                        });
                                                                        Toast.fire({ icon: 'success', title: `Customer: ${res.customer_name}` });
                                                                    } else {
                                                                        Swal.fire('Error', "Failed to create customer", 'error');
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    Swal.fire('Error', err.message || "Failed to create customer", 'error');
                                                                } finally {
                                                                    setCustomerLoading(false);
                                                                }
                                                            }
                                                            setShowDropdown(false);
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {showDropdown && (
                                        <div ref={dropdownRef} className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-[300] mt-1 max-h-56 overflow-y-auto">
                                            {searchResults.map(c => (
                                                <div key={c.name} onMouseDown={() => pickCustomer(c)} className="p-3.5 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center group">
                                                    <div>
                                                        <div className="font-black text-sm text-slate-800 uppercase">{c.customer_name}</div>
                                                        <div className="text-xs text-slate-400 font-bold">{c.mobile_no}</div>
                                                    </div>
                                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-500" />
                                                </div>
                                            ))}
                                            <div onMouseDown={openCreate} className="p-3.5 bg-emerald-50 text-emerald-600 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-emerald-100 text-center">
                                                + Register New Customer
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={14} className="text-sky-400 group-focus-within:text-sky-600 transition-colors" />
                                    </div>
                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        placeholder="SCAN / SEARCH PRODUCT..."
                                        value={barcodeInput}
                                        onChange={e => setBarcodeInput(e.target.value)}
                                        onKeyDown={onBarcodeKeyDown}
                                        onFocus={() => setActiveCardIndex(-1)}
                                        className="so-customer-input pl-10 border-sky-100 bg-sky-50 focus:border-sky-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="so-bill-items">
                                {billItems.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-3 grayscale">
                                        <MonitorSmartphone size={64} strokeWidth={1} />
                                        <span className="font-black text-[10px] uppercase tracking-widest text-center px-12 leading-relaxed">
                                            Select items or scan barcode<br />to start a new transaction
                                        </span>
                                    </div>
                                ) : (
                                    billItems.map((item, idx) => {
                                        const effectivePrice = item.price;
                                        return (
                                            <div
                                                key={item.id}
                                                id={`bill-row-${idx}`}
                                                className={`so-bill-item transition-all cursor-pointer ${idx === selectedBillIndex ? 'active' : ''}`}
                                                onClick={() => setSelectedBillIndex(idx)}
                                            >
                                                <div className="relative flex justify-between items-start">
                                                    <div className="flex-1 pr-6">
                                                        <h4 className="so-bill-item-name">{item.name}</h4>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[11px] font-black text-slate-400 flex items-center gap-0.5"><DirhamIcon size={10} /> {item.price}</span>
                                                            <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                                <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => {
                                                                    const targetUom = item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece');
                                                                    toggleUom(item.id, targetUom);
                                                                }} className={`px-2.5 py-1 text-[9px] font-black transition-all ${item.uom === 'Piece' || item.uom === 'Nos' || (item.uom !== 'Box' && item.uom !== 'BOX') ? (isGreen ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white') : 'bg-white text-slate-400 hover:bg-slate-50'}`}>PC</button>
                                                                <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, 'Box')} disabled={!item.custom_pieces_per_box} className={`px-2.5 py-1 text-[9px] font-black transition-all ${item.uom === 'Box' || item.uom === 'BOX' ? (isGreen ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white') : 'bg-white text-slate-400 hover:bg-slate-50'} disabled:opacity-30`}>BOX</button>
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
                                                                onFocus={(e) => e.target.select()}
                                                                onClick={(e) => e.target.select()}
                                                            />
                                                            <button onClick={() => updateQuantity(item.id, 1)} className="so-bill-qty-btn text-emerald-500"><Plus size={11} /></button>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeFromBill(item.id)} className="so-bill-remove">
                                                        <X size={16} />
                                                    </button>
                                                </div>

                                                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-50">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Item Total</span>
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newBill = [...billItems];
                                                                newBill[idx].is_tax_inclusive = !newBill[idx].is_tax_inclusive;
                                                                setBillItems(newBill);
                                                            }}
                                                            className={`px-2 py-0.5 rounded-md text-[9px] font-black cursor-pointer hover:scale-105 active:scale-95 transition-all select-none ${item.is_tax_inclusive !== false ? 'bg-sky-100 text-sky-600 hover:bg-sky-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}
                                                            title={item.is_tax_inclusive !== false ? 'Tax Inclusive - Click to change' : 'Tax Exclusive - Click to change'}
                                                        >
                                                            {item.is_tax_inclusive !== false ? 'INC' : 'EXC'}
                                                        </div>
                                                    </div>
                                                    <span className="text-[13px] font-black text-slate-800 flex items-center gap-0.5"><DirhamIcon size={12} className="text-slate-800" /> {(item.qty * effectivePrice).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
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
                                        <span className="flex items-center gap-0.5"><DirhamIcon size={11} /> {displaySubtotal.toFixed(2)}</span>
                                    </div>
                                    {displayDiscount > 0 && (
                                        <div className="so-total-row" style={{ color: 'var(--so-danger)' }}>
                                            <span>Discount</span>
                                            <span className="flex items-center gap-0.5">-<DirhamIcon size={11} /> {displayDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {loyaltyAmount > 0 && (
                                        <div className="so-total-row" style={{ color: '#10b981' }}>
                                            <span>Loyalty Redeemed</span>
                                            <span className="flex items-center gap-0.5">-<DirhamIcon size={11} /> {loyaltyAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="so-total-row">
                                        <span>Tax ({taxRate}%)</span>
                                        <span className="flex items-center gap-0.5"><DirhamIcon size={11} /> {displayTax.toFixed(2)}</span>
                                    </div>

                                    <div className="so-grand-total">
                                        <span className="text-[0.6em] font-black uppercase tracking-widest opacity-40">TOTAL</span>
                                        <span className="flex items-center gap-0.5"><DirhamIcon size={15} /> {grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 mb-2">
                                    <button
                                        onClick={() => setShowDiscountModal(true)}
                                        className="so-btn-secondary flex-1"
                                        style={discountAmount > 0 ? { color: 'var(--so-danger)', borderColor: '#fee2e2', backgroundColor: '#fef2f2' } : {}}
                                    >
                                        <Palette size={14} /> % Discount <span className="btn-shortcut-key">F1</span>
                                    </button>
                                    <button
                                        onClick={handleLoyaltyPointsClick}
                                        className="so-btn-secondary flex-1"
                                        style={loyaltyAmount > 0 ? { color: '#10b981', borderColor: '#d1fae5', backgroundColor: '#ecfdf5' } : {}}
                                    >
                                        <Award size={14} /> Loyalty <span className="btn-shortcut-key">F12</span>
                                    </button>
                                </div>
                                <div className="flex gap-1.5 mb-4">
                                    <button
                                        onClick={handleSaveDraft}
                                        className="so-btn-secondary flex-1"
                                        style={{ color: '#d97706', borderColor: '#fef3c7' }}
                                        disabled={billItems.length === 0}
                                    >
                                        <Package size={14} /> Save Draft <span className="btn-shortcut-key">F10</span>
                                    </button>
                                    <button
                                        onClick={clearBillHandler}
                                        className="so-btn-secondary flex-1"
                                        style={{ color: 'var(--so-danger)', borderColor: '#fecaca' }}
                                    >
                                        <Trash2 size={14} /> Reset <span className="btn-shortcut-key">Alt+C</span>
                                    </button>
                                </div>

                                <div className="flex gap-1.5 mb-4">
                                    <button
                                        onClick={() => { if (billItems.length > 0) completePayment('Cash'); }}
                                        className="so-btn-secondary flex-1"
                                        style={{ color: '#10b981', borderColor: '#a7f3d0', backgroundColor: '#f0fdf4', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                                        disabled={grandTotal <= 0 || paymentLoading}
                                    >
                                        💵 Direct Cash <span className="btn-shortcut-key">Alt+1</span>
                                    </button>
                                    <button
                                        onClick={() => { if (billItems.length > 0) completePayment('Card'); }}
                                        className="so-btn-secondary flex-1"
                                        style={{ color: '#6366f1', borderColor: '#c7d2fe', backgroundColor: '#e0e7ff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                                        disabled={grandTotal <= 0 || paymentLoading}
                                    >
                                        💳 Direct Card <span className="btn-shortcut-key">Alt+2</span>
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
                                            <CreditCard size={18} /> Confirm & Pay <span className="btn-shortcut-key">Space / F7</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </aside>
                    </main>
                </div>

                {shortcutsPosition === 'bottom' && renderShortcutsHorizontal()}

                {isDraggingShortcuts && renderDropZones()}

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
            <div className={`classic-root ${!isGreen ? 'theme-blue' : ''}`} style={{ position: 'relative' }}>
                <style>{classicStyles}</style>

                {/* CLASSIC NAVBAR */}
                <nav className="classic-nav">
                    <div className="flex items-center gap-4 pl-4 py-2">
                        <span className="text-[32px] font-black text-slate-800 tracking-tighter uppercase leading-none select-none">
                            POS<span className={isGreen ? 'text-emerald-500' : 'text-sky-500'}>8</span>
                        </span>
                    </div>

                    <div className="ml-auto flex items-center pr-4" style={{ gap: '20px' }}>
                        {/* Group 1: Navigation */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className={`font-black text-[12px] uppercase tracking-wider transition-all hover:underline decoration-2 underline-offset-4 ${isGreen ? 'text-emerald-700' : 'text-sky-700'}`}
                        >
                            DASHBOARD
                        </button>

                        <div style={{ width: '1px', height: '24px', background: isGreen ? '#4a9a72' : '#4a7aaa', opacity: 0.5, flexShrink: 0 }} />

                        {/* Group 2: User Info Card */}
                        <div
                            onClick={() => setShowThemeSidebar(true)}
                            className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                            title="Open Theme Settings Sidebar"
                        >
                            <div className="flex flex-col items-end text-right">
                                <span className="text-[10px] font-black uppercase leading-tight">
                                    <span className="text-slate-400 mr-1">USER:</span>
                                    <span className="text-slate-800">{user?.full_name || user || 'CASHIER'}</span>
                                </span>
                                <span className="text-[10px] font-black uppercase leading-tight mt-0.5">
                                    <span className="text-slate-400 mr-1">BRANCH:</span>
                                    <span className={isGreen ? 'text-emerald-600' : 'text-sky-600'}>{getBranchName(warehouse)}</span>
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

                        <div style={{ width: '1px', height: '24px', background: isGreen ? '#4a9a72' : '#4a7aaa', opacity: 0.5, flexShrink: 0 }} />

                        {/* Group 3: Utilities */}
                        <div className="flex items-center gap-4">
                            {/* Connection Status Badge */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm select-none transition-all hover:bg-slate-50">
                                <div className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isOffline ? 'text-rose-600' : (isGreen ? 'text-emerald-600' : 'text-sky-600')}`}>
                                    {isOffline ? 'OFFLINE' : 'ONLINE'}
                                </span>
                            </div>

                            {/* Notification Bell Dropdown */}
                            <div className="nav-notification-container" ref={notificationsContainerRef}>
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className={`transition-all p-1.5 hover:bg-slate-100 rounded-full ${isGreen ? 'text-emerald-600 hover:text-emerald-800' : 'text-sky-600 hover:text-sky-800'} ${unreadCount > 0 ? "animate-pulse-subtle" : ""}`}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="Notifications"
                                >
                                    <Bell size={18} />
                                    {unreadCount > 0 && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '-2px',
                                                right: '-2px',
                                                background: '#ef4444',
                                                color: '#ffffff',
                                                fontSize: '8px',
                                                fontWeight: 900,
                                                borderRadius: '9999px',
                                                padding: '1px 4px',
                                                lineHeight: '1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 0 0 2px #ffffff'
                                            }}
                                        >
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                                {renderNotificationDropdown()}
                            </div>

                            {/* Open POS in New Tab */}
                            <button
                                onClick={() => window.open(window.location.origin + window.location.pathname + '#/homepage', '_blank')}
                                className={`transition-all p-1.5 hover:bg-slate-100 rounded-full ${isGreen ? 'text-emerald-600 hover:text-emerald-800' : 'text-sky-600 hover:text-sky-800'}`}
                                title="Open POS in New Tab"
                            >
                                <ExternalLink size={18} />
                            </button>

                            {/* Logout Button */}
                            <button onClick={handleLogout} className="text-rose-500 hover:text-rose-700 transition-all p-1 hover:bg-rose-50 rounded-full" title="Logout">
                                <Power size={20} />
                            </button>

                            {/* Dropdown Settings Button */}
                            <div className="relative" ref={settingsDropdownRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSettingsMenu(!showSettingsMenu);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all ${showSettingsMenu ? 'bg-slate-100 border-slate-300' : ''}`}
                                    title="Settings"
                                >
                                    <Settings size={18} className={showSettingsMenu ? 'animate-spin-slow' : ''} />
                                </button>

                                {showSettingsMenu && (
                                    <div
                                        className="absolute right-0 top-full mt-3 w-72 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl z-[9999] p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200"
                                        style={{ borderTop: `4px solid ${isGreen ? '#10b981' : '#0ea5e9'}` }}
                                    >
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 leading-none">
                                            Configuration
                                        </div>

                                        {/* Dashboard Button */}
                                        <button
                                            onClick={() => {
                                                navigate('/dashboard');
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-emerald-50 text-emerald-500' : 'bg-sky-50 text-sky-500'} group-hover:scale-110 transition-transform`}>
                                                    <LayoutDashboard size={14} />
                                                </div>
                                                Admin Dashboard
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400" />
                                        </button>

                                        {/* Theme Switcher Button */}
                                        <button
                                            onClick={() => {
                                                setShowThemeSidebar(true);
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-emerald-50 text-emerald-500' : 'bg-sky-50 text-sky-500'} group-hover:scale-110 transition-transform`}>
                                                    <Palette size={14} />
                                                </div>
                                                Theme Config
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                                                {legacySubTheme.toUpperCase()}
                                            </span>
                                        </button>

                                        {/* Direct Color Switcher */}
                                        {theme === 'legacy' && (
                                            <button
                                                onClick={() => {
                                                    toggleTheme();
                                                }}
                                                className="w-full mt-2 p-3.5 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between transition-all group text-left"
                                            >
                                                <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                                                    <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-sky-50 text-sky-500' : 'bg-emerald-50 text-emerald-500'} group-hover:scale-110 transition-transform`}>
                                                        <Palette size={14} />
                                                    </div>
                                                    Switch Color
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isGreen ? 'BLUE' : 'GREEN'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </nav>

                {/* CLASSIC SHORTCUTS GUIDE - RELOCATED TO TOP */}
                {shortcutsPosition === 'top' && renderClassicShortcutsHorizontal()}

                {/* CLASSIC HEADER FORM */}
                <div className="classic-header-form">
                    <div className="classic-field flex items-center gap-3 relative flex-1">
                        <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">CUSTOMER</label>
                        <div className="relative group flex-1" ref={dropdownRef}>
                            {/* Country code + mobile input wrapper */}
                            <div className="flex items-center h-11 border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 focus-within:border-sky-500 transition-all w-full">
                                <select
                                    value={countryCodePrefix}
                                    onChange={e => { setCountryCodePrefix(e.target.value); localStorage.setItem('pos_country_code', e.target.value); }}
                                    className="h-full px-2.5 bg-slate-100 border-r-2 border-slate-200 text-xs font-black text-slate-700 outline-none cursor-pointer"
                                    style={{ minWidth: '65px' }}
                                    title="Country Code (Press F4 to toggle)"
                                >
                                    <option value="+971">🇦🇪 +971</option>
                                    <option value="+91">🇮🇳 +91</option>
                                </select>
                                <input
                                    ref={mobileInputRef}
                                    value={customerMobile || customerName}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (/^[\d+]*$/.test(val)) {
                                            const cleaned = val.replace(/\D/g, '');
                                            const limit = countryCodePrefix === '+971' ? 9 : 10;
                                            const restricted = cleaned.slice(0, limit);
                                            setCustomerMobile(restricted);
                                            setCustomerName('');
                                        } else {
                                            setCustomerName(val);
                                            setCustomerMobile('');
                                        }
                                    }}
                                    onFocus={() => { setSearchContext('customer'); setShowDropdown(true); }}
                                    onClick={() => { setSearchContext('customer'); setShowDropdown(true); }}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
                                    onKeyDown={handleMobileEnter}
                                    className="flex-1 h-full px-3 text-base font-black text-slate-900 outline-none bg-transparent"
                                    placeholder="Mobile or Name..."
                                    style={{ minWidth: '110px' }}
                                />
                                {customerLoading && (
                                    <div className="pr-2 flex items-center">
                                        <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            {showDropdown && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white border-2 border-slate-900 shadow-[4px_4px_0_rgba(0,0,0,0.1)] z-[9999] max-h-48 overflow-y-auto mt-1">
                                    {searchResults.map(c => (
                                        <div key={c.name} className={`p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-900`} onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}>
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
                                className="w-48 h-11 px-3 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-sky-500 transition-all bg-amber-50/30"
                                autoFocus
                            />
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowCamera(true)}
                                    className="w-11 h-11 bg-slate-100 text-slate-600 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-all rounded-xl shadow-sm"
                                    title="Camera Scanner"
                                >
                                    <Camera size={18} />
                                </button>
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
                    {shortcutsPosition === 'left' && renderClassicShortcutsVertical('left')}

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
                                        const effectivePrice = item.price;
                                        const lineTotal = item.qty * effectivePrice;
                                        const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
                                        return (
                                            <tr
                                                key={idx}
                                                id={`bill-row-${idx}`}
                                                className={`border-b border-slate-100 transition-all cursor-pointer ${idx === selectedBillIndex ? 'bg-amber-100 border-l-4 border-l-amber-600 shadow-md ring-1 ring-inset ring-amber-200' : 'bg-white hover:bg-amber-50/50'}`}
                                                onClick={() => setSelectedBillIndex(idx)}
                                            >
                                                <td className="text-center font-bold text-slate-400 text-[10px]">{idx + 1}</td>
                                                <td className="px-2 font-bold text-slate-900 text-center">
                                                    <span className="classic-cell-text" title={item.name || item.item_name || item.item_code || item.id}>{item.name || item.item_name || item.item_code || item.id}</span>
                                                </td>
                                                <td className="p-0 relative group">
                                                    <input
                                                        type="text"
                                                        value={item.item_name || item.name}
                                                        onChange={e => {
                                                            const newBill = [...billItems];
                                                            if (newBill[idx].item_name !== undefined) newBill[idx].item_name = e.target.value;
                                                            else newBill[idx].name = e.target.value;
                                                            setBillItems(newBill);
                                                        }}
                                                        className="w-full h-full px-2 pr-8 font-black text-slate-700 uppercase bg-transparent border-none outline-none focus:bg-amber-100 placeholder:text-slate-300"
                                                        placeholder="Description"
                                                    />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); showStockBreakdown(item); }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 transition-colors cursor-pointer"
                                                        title="Item Info & Stock"
                                                    >
                                                        <Info size={14} />
                                                    </button>
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
                                                        onClick={e => e.target.select()}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (theme === 'legacy') {
                                                                    const targetId = searchContext === 'header' ? 'legacy-header-search' : 'legacy-inline-search';
                                                                    document.getElementById(targetId)?.focus();
                                                                } else {
                                                                    barcodeInputRef.current?.focus();
                                                                }
                                                            } else if (e.key === '+' || e.key === '=') {
                                                                e.preventDefault();
                                                                updateQuantity(item.id, 1);
                                                            } else if (e.key === '-' || e.key === '_') {
                                                                e.preventDefault();
                                                                updateQuantity(item.id, -1);
                                                            }
                                                        }}
                                                        className="w-full h-full text-center px-2 font-black text-sky-600 focus:bg-amber-100 outline-none border-none"
                                                    />
                                                </td>
                                                <td className="text-center px-2 font-black text-amber-600 bg-amber-50">
                                                    {item.qty * factor}
                                                </td>
                                                <td className="p-0 relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item._price_input_val !== undefined ? item._price_input_val : (parseFloat(effectivePrice) || 0).toFixed(2)}
                                                        onChange={e => setExactPrice(item.id, e.target.value)}
                                                        className="w-full h-full text-center px-2 font-black text-slate-800 focus:bg-amber-100 outline-none border-none"
                                                        onFocus={e => e.target.select()}
                                                        onClick={e => e.target.select()}
                                                    />
                                                    <div
                                                        onClick={() => {
                                                            const newBill = [...billItems];
                                                            newBill[idx].is_tax_inclusive = !newBill[idx].is_tax_inclusive;
                                                            setBillItems(newBill);
                                                        }}
                                                        className={`absolute -top-0.5 -right-0.5 px-2 py-0.5 rounded-bl-lg text-[10px] font-extrabold tracking-tight cursor-pointer hover:scale-105 active:scale-95 transition-all select-none ${item.is_tax_inclusive ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                                                        style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.15)', zIndex: 10 }}
                                                    >
                                                        {item.is_tax_inclusive ? 'VAT INC' : 'VAT EXC'}
                                                    </div>
                                                </td>
                                                <td className="text-center px-2 font-bold text-slate-500 text-[10px] italic">
                                                    {item.is_tax_inclusive
                                                        ? (lineTotal - (lineTotal / (1 + (taxRate / 100)))).toFixed(2)
                                                        : (lineTotal * (taxRate / 100)).toFixed(2)}
                                                </td>
                                                <td className="text-center px-2 font-black text-slate-900 bg-slate-50/50 flex items-center justify-center gap-0.5">
                                                    <DirhamIcon size={12} /> {item.is_tax_inclusive
                                                        ? (parseFloat(lineTotal) || 0).toFixed(2)
                                                        : (parseFloat(lineTotal) * (1 + (taxRate / 100))).toFixed(2)}
                                                </td>
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

                        {/* BOTTOM BAR: TOTALS ONLY */}
                        <div className="classic-bottom-bar flex flex-col md:flex-row items-stretch md:items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 gap-4">

                            {/* Active Orders Button on Left Side */}
                            <button
                                onClick={() => setShowDraftsModal(true)}
                                className={`px-4 py-1.5 flex items-center gap-2 rounded-lg border transition-all font-black text-[11px] uppercase tracking-wider shadow-sm select-none ${isGreen ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700' : 'bg-sky-600 text-white border-sky-700 hover:bg-sky-700'}`}
                                style={{ alignSelf: 'center', height: 'fit-content' }}
                                title="View Active Saved Orders (Drafts) (Press F9)"
                            >
                                <Package size={14} />
                                <span className="classic-active-orders-text">Active Orders</span>
                                <span className="btn-shortcut-key">F9</span>
                                {pendingSyncCount > 0 && (
                                    <span className="classic-active-orders-badge">
                                        {pendingSyncCount}
                                    </span>
                                )}
                            </button>

                            {/* Totals Section */}
                            <div className="flex items-center gap-4 ml-auto py-1">
                                <div className="flex flex-col items-start px-3 border-r border-slate-200">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Tax Template</span>
                                    <select
                                        value={selectedTaxTemplate}
                                        onChange={(e) => setSelectedTaxTemplate(e.target.value)}
                                        className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer"
                                    >
                                        {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex flex-col items-end px-3 border-r border-slate-200">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Subtotal</span>
                                    <span className="text-slate-800 font-black text-base leading-none flex items-center gap-0.5"><DirhamIcon size={13} /> {displaySubtotal.toFixed(2)}</span>
                                </div>

                                {displayDiscount > 0 && (
                                    <div className="flex flex-col items-end px-3 border-r border-slate-200">
                                        <span className="text-[9px] font-black text-rose-400 uppercase">Disc.</span>
                                        <span className="text-rose-500 font-black text-base leading-none flex items-center gap-0.5">-<DirhamIcon size={13} /> {displayDiscount.toFixed(2)}</span>
                                    </div>
                                )}

                                {loyaltyAmount > 0 && (
                                    <div className="flex flex-col items-end px-3 border-r border-slate-200">
                                        <span className="text-[9px] font-black text-emerald-500 uppercase">Loyalty</span>
                                        <span className="text-emerald-500 font-black text-base leading-none flex items-center gap-0.5">-<DirhamIcon size={13} /> {loyaltyAmount.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex flex-col items-end px-3 border-r border-slate-200">
                                    <span className={`text-[9px] font-black ${isGreen ? 'text-emerald-500' : 'text-sky-500'} uppercase`}>VAT ({taxRate}%)</span>
                                    <span className={`${isGreen ? 'text-emerald-500' : 'text-sky-500'} font-black text-base leading-none flex items-center gap-0.5`}><DirhamIcon size={13} /> {displayTax.toFixed(2)}</span>
                                </div>

                                <div className="flex flex-col items-end pl-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
                                    <span className={`text-2xl font-black ${isGreen ? 'text-emerald-600' : 'text-sky-600'} leading-none flex items-center gap-0.5`}>
                                        <DirhamIcon size={18} /> {grandTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ACTION BAR */}
                        <div className="flex bg-white border-t border-slate-200 w-full px-3 py-2 items-center">
                            <div className="flex-1" />
                            <div className="grid grid-cols-4 gap-2 w-full max-w-[720px]">
                                {/* Column 1: Discount & Clear Bill */}
                                <div className="col-span-1 flex flex-col gap-1.5">
                                    <button
                                        className={`py-1.5 bg-white border border-slate-300 ${isGreen ? 'text-emerald-700 hover:bg-slate-100' : 'text-sky-700 hover:bg-slate-100'} transition-all font-black text-[10px] rounded shadow-sm uppercase tracking-wide flex items-center justify-center gap-1`}
                                        onClick={() => setShowDiscountModal(true)}
                                    >
                                        <Palette size={12} /> DISCOUNT <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>F1</span>
                                    </button>
                                    <button
                                        className={`py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all font-black text-[10px] rounded shadow-sm uppercase tracking-wide flex items-center justify-center gap-1`}
                                        onClick={clearBillHandler}
                                    >
                                        <Trash2 size={12} /> CLEAR BILL <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>Alt+C</span>
                                    </button>
                                </div>

                                {/* Column 2: Loyalty & Save Draft */}
                                <div className="col-span-1 flex flex-col gap-1.5">
                                    <button
                                        className={`py-1.5 bg-white border border-slate-300 ${loyaltyAmount > 0 ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-700 hover:bg-slate-100'} transition-all font-black text-[10px] rounded shadow-sm uppercase tracking-wide flex items-center justify-center gap-1`}
                                        onClick={handleLoyaltyPointsClick}
                                    >
                                        <Award size={12} /> LOYALTY <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>F12</span>
                                    </button>
                                    <button
                                        className={`py-1.5 bg-amber-500 text-white border border-amber-600 hover:bg-amber-600 transition-all font-black text-[10px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1`}
                                        onClick={handleSaveDraft}
                                        disabled={billItems.length === 0}
                                    >
                                        <Package size={12} /> SAVE DRAFT <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>F10</span>
                                    </button>
                                </div>

                                {/* Column 3 & 4 (col-span-2): Direct Checkout (top) and Process Payment (bottom) */}
                                <div className="col-span-2 flex flex-col gap-1.5">
                                    {/* Row 1: Direct Cash & Direct Card */}
                                    <div className="flex gap-1.5">
                                        <button
                                            className="flex-1 py-1.5 bg-emerald-700 text-white border-none hover:bg-emerald-800 transition-all font-black text-[10px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                                            onClick={() => { if (billItems.length > 0) completePayment('Cash'); }}
                                            disabled={grandTotal <= 0 || paymentLoading}
                                        >
                                            💵 CASH <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>Alt+1</span>
                                        </button>
                                        <button
                                            className="flex-1 py-1.5 bg-indigo-600 text-white border-none hover:bg-indigo-700 transition-all font-black text-[10px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1"
                                            onClick={() => { if (billItems.length > 0) completePayment('Card'); }}
                                            disabled={grandTotal <= 0 || paymentLoading}
                                        >
                                            💳 CARD <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>Alt+2</span>
                                        </button>
                                    </div>
                                    {/* Row 2: Process Payment */}
                                    <button
                                        className={`py-2 ${isGreen ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'} text-white border-none transition-all font-black text-[12px] rounded shadow-md uppercase tracking-wider active:scale-95 flex items-center justify-center gap-1.5`}
                                        onClick={handleCheckout}
                                        disabled={grandTotal <= 0}
                                    >
                                        <CreditCard size={14} /> PROCESS PAYMENT <span className="btn-shortcut-key" style={{ fontSize: '8px', padding: '0px 3.5px' }}>Space / F7</span>
                                    </button>
                                </div>
                            </div>
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
                                <span className="text-white/20 font-bold uppercase">Branch:</span>
                                <span className="font-black text-emerald-400">{warehouse || 'No Branch'}</span>
                            </div>
                            <div className="ml-auto opacity-50 font-bold">READY · SYSTEM OK</div>
                        </div>
                    </div>
                    {shortcutsPosition === 'right' && renderClassicShortcutsVertical('right')}
                </div>

                {shortcutsPosition === 'bottom' && renderClassicShortcutsHorizontal()}

                {isDraggingShortcuts && renderDropZones()}



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
                                            <div key={item.id} className="home-item-wrapper" onClick={() => { setLastInteractedItem(item); if (item.local_qty > 0) { handleAddToBill(item); } else { handleOutOfStockAlert(item); } }}>
                                                <div className="home-item-card" style={{ opacity: item.local_qty > 0 ? 1 : 0.6, cursor: 'pointer' }}>
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
                                                        {((item.barcodes && item.barcodes.length > 0) || item.barcode || item.id) && (
                                                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', marginBottom: '4px' }}>
                                                                <Barcode size={10} style={{ opacity: 0.6 }} /> {item.barcodes?.[0]?.barcode || item.barcode || item.id}
                                                            </span>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                            <p className="home-item-price" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {item.price}</p>
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
                                    {/* Country code + mobile wrapper */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', overflow: 'hidden',
                                        background: 'linear-gradient(to right, #e1f4ff, #ffffff)',
                                        border: '2px solid #3b82f6', borderRadius: '12px',
                                    }}>
                                        <select
                                            value={countryCodePrefix}
                                            onChange={e => { setCountryCodePrefix(e.target.value); localStorage.setItem('pos_country_code', e.target.value); }}
                                            style={{
                                                height: '100%', padding: '0 8px',
                                                background: '#dbeafe', border: 'none', borderRight: '2px solid #93c5fd',
                                                fontSize: '12px', fontWeight: 900, color: '#1e40af',
                                                outline: 'none', cursor: 'pointer', flexShrink: 0
                                            }}
                                            title="Country Code (Press F4 to toggle)"
                                        >
                                            <option value="+971">🇦🇪 +971</option>
                                            <option value="+91">🇮🇳 +91</option>
                                        </select>
                                        <input
                                            ref={mobileInputRef}
                                            type="tel"
                                            placeholder="Mobile + Enter (Speed Checkout)"
                                            value={customerMobile}
                                            onChange={(e) => {
                                                const cleaned = e.target.value.replace(/\D/g, '');
                                                const limit = countryCodePrefix === '+971' ? 9 : 10;
                                                setCustomerMobile(cleaned.slice(0, limit));
                                            }}
                                            onKeyDown={handleMobileEnter}
                                            style={{
                                                flex: 1, padding: '10px 40px 10px 12px',
                                                background: 'transparent', border: 'none',
                                                fontWeight: 700, fontSize: '0.88rem', outline: 'none',
                                                color: '#1e3a8a'
                                            }}
                                        />
                                        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                            {customerLoading
                                                ? <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                                                : <Phone size={16} style={{ color: '#3b82f6' }} />
                                            }
                                        </div>
                                    </div>
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
                                        onFocus={() => setActiveCardIndex(-1)}
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
                                                        {it.is_global ? <span style={{ color: '#d97706', fontSize: 10, letterSpacing: '-0.2px' }}>AUTHORIZE ENTRY</span> : <span className="flex items-center gap-0.5"><DirhamIcon size={12} /> {parseFloat(it.price).toFixed(2)}</span>}
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
                                        <UserPlus size={20} className="text-slate-400 group-focus-within:text-sky-600 transition-colors" />
                                    </div>
                                    <input
                                        ref={nameInputRef}
                                        type="text"
                                        placeholder="CUSTOMER NAME (TYPE TO SEARCH...)"
                                        value={customerName}
                                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 outline-none shadow-sm transition-all"
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
                                <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={e => {
                                    const cleaned = e.target.value.replace(/\D/g, '');
                                    const limit = countryCodePrefix === '+971' ? 9 : 10;
                                    setPhoneNumber(cleaned.slice(0, limit));
                                }} className="home-customer-input" />

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
                                                            <span className="home-bill-item-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {item.name}
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newBill = [...billItems];
                                                                        const idx = newBill.findIndex(b => b.id === item.id);
                                                                        if (idx !== -1) {
                                                                            newBill[idx].is_tax_inclusive = !newBill[idx].is_tax_inclusive;
                                                                            setBillItems(newBill);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        fontSize: '9px',
                                                                        fontWeight: 900,
                                                                        padding: '1px 6px',
                                                                        borderRadius: '4px',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none',
                                                                        transition: 'all 0.15s ease',
                                                                        background: item.is_tax_inclusive !== false ? '#dbeafe' : '#fef3c7',
                                                                        color: item.is_tax_inclusive !== false ? '#2563eb' : '#d97706',
                                                                        flexShrink: 0
                                                                    }}
                                                                    title={item.is_tax_inclusive !== false ? 'Tax Inclusive - Click to toggle' : 'Tax Exclusive - Click to toggle'}
                                                                >
                                                                    {item.is_tax_inclusive !== false ? 'Inc' : 'Exc'}
                                                                </span>
                                                            </span>
                                                            <span className="home-bill-item-price flex items-center gap-0.5"><DirhamIcon size={11} /> {item.price} × {item.qty} {item.uom || 'Pc'}</span>
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
                                                        <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, item.uom_conversions?.Nos ? 'Nos' : 'Piece')} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #3b82f6', background: (item.uom === 'Piece' || item.uom === 'Nos') ? '#3b82f6' : '#fff', color: (item.uom === 'Piece' || item.uom === 'Nos') ? '#fff' : '#3b82f6' }}>Piece</button>
                                                        <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, 'Box')} disabled={!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #8b5cf6', background: item.uom === 'Box' ? '#8b5cf6' : '#fff', color: item.uom === 'Box' ? '#fff' : '#8b5cf6', opacity: (!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1) ? 0.5 : 1 }}>Box ({item.custom_pieces_per_box || 1})</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* Summary */}
                                <div className="home-bill-summary">
                                    <div className="home-bill-summary-row"><span>Subtotal</span><span className="flex items-center gap-0.5"><DirhamIcon size={11} /> {displaySubtotal.toFixed(2)}</span></div>
                                    {discount.value > 0 && <div className="home-bill-summary-row home-bill-discount"><span>Discount {discount.type === 'percent' ? `(${discount.value}%)` : ''}</span><span className="flex items-center gap-0.5">-<DirhamIcon size={11} /> {displayDiscount.toFixed(2)}</span></div>}
                                    {loyaltyAmount > 0 && <div className="home-bill-summary-row home-bill-discount" style={{ color: '#10b981' }}><span>Loyalty Redeemed</span><span className="flex items-center gap-0.5">-<DirhamIcon size={11} /> {loyaltyAmount.toFixed(2)}</span></div>}
                                    <div className="home-bill-summary-row"><span>Tax ({taxRate}%)</span><span className="flex items-center gap-0.5"><DirhamIcon size={11} /> {displayTax.toFixed(2)}</span></div>
                                    <div className="home-bill-summary-row home-bill-grand-total"><span>Grand Total</span><span className="flex items-center gap-0.5"><DirhamIcon size={14} /> {grandTotal.toFixed(2)}</span></div>
                                </div>

                                {/* Buttons */}
                                <div className="container-fluid">
                                    <div className="row">
                                        <div className="col-12">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
                                                <button className="home-bill-discount-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDiscountModal(true)}>{discount.value > 0 ? (discount.type === 'percent' ? `Edit (${discount.value}%)` : <span className="flex items-center justify-center gap-0.5">Edit (<DirhamIcon size={10} />{discount.value})</span>) : 'Add Discount'} <span className="btn-shortcut-key">F1</span></button>
                                                <button className="home-bill-discount-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: loyaltyAmount > 0 ? '#10b981' : '#64748b' }} onClick={handleLoyaltyPointsClick}>{loyaltyAmount > 0 ? `Loyalty: ${loyaltyPointsToRedeem} pts` : 'Add Loyalty'} <span className="btn-shortcut-key">F12</span></button>
                                                {grandTotal > 0 && <button className="home-bill-pay-btn" style={{ flex: 1 }} onClick={handleCheckout}>Pay</button>}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                                                {billItems.length > 0 && <button className="home-bill-clear-btn" style={{ flex: 1 }} onClick={clearBillHandler}>Clear Bill</button>}
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
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><input type="radio" name="type" checked={discount.type === 'amount'} onChange={() => setDiscount({ ...discount, type: 'amount' })} /> Amount (<DirhamIcon size={12} />)</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><input type="radio" name="type" checked={discount.type === 'percent'} onChange={() => setDiscount({ ...discount, type: 'percent' })} /> Percentage (%)</label>
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
                <div className="home-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
                    <div className="home-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <div className="home-modal-header">
                            <h3>Create New Customer</h3>
                            <button className="home-modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                        </div>
                        <div className="home-modal-body">
                            <input
                                type="text"
                                placeholder="Customer Name *"
                                value={createForm.name}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                    setCreateForm({ ...createForm, name: val });
                                }}
                                className="home-customer-input"
                                style={{ marginBottom: '0.75rem' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem' }}>
                                <select
                                    value={countryCodePrefix}
                                    onChange={e => {
                                        const newPrefix = e.target.value;
                                        setCountryCodePrefix(newPrefix);
                                        localStorage.setItem('pos_country_code', newPrefix);
                                        const limit = newPrefix === '+971' ? 9 : 10;
                                        if (createForm.phone.length > limit) {
                                            setCreateForm(prev => ({ ...prev, phone: prev.phone.slice(0, limit) }));
                                        }
                                    }}
                                    className="home-customer-input"
                                    style={{ width: '100px', cursor: 'pointer', fontWeight: 700 }}
                                >
                                    <option value="+971">🇦🇪 +971</option>
                                    <option value="+91">🇮🇳 +91</option>
                                </select>
                                <input
                                    type="tel"
                                    placeholder={`Phone (${countryCodePrefix === '+971' ? '9 digits' : '10 digits'}) *`}
                                    value={createForm.phone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        const limit = countryCodePrefix === '+971' ? 9 : 10;
                                        if (val.length <= limit) {
                                            setCreateForm({ ...createForm, phone: val });
                                        }
                                    }}
                                    className="home-customer-input"
                                    style={{ flex: 1, margin: 0 }}
                                />
                            </div>
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

