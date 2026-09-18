import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import kyleLogo from '../../assets/kyleretail.png';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    RefreshCw, ExternalLink, LayoutDashboard, ChevronLeft, Settings, Power, Wifi, WifiOff, User as UserIcon,
    Search, Layers, SearchSlash, ChevronRight, X, UserPlus, Loader2, CreditCard, Phone, Mail, MapPin,
    DollarSign, Trash2, Info, Package, Palette, MonitorSmartphone, Camera, Video, Scan, Printer,
    ShoppingCart, Minus, Plus, Upload, Percent,
    User,
    UserRound,
    Landmark,
    History,
    Tag,
    ArrowLeftRight,
    Move,
    QrCode,
    Smartphone,
    Banknote,
    Wallet,
    Building2,
    Award,
    Coins,
    Barcode,
    Bell,
    Eye,
    EyeOff,
    Columns,
    Receipt,
    ShieldCheck,
    Gift,
    Star,
    Zap,
    FileText,
    Lock,
    KeyRound,
    Users,
    Clock,
    Edit,
    Pencil,
    SlidersHorizontal,
    Filter,
    ShieldAlert,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Crop
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { logout, toggleTheme, setTheme, markRead, markAllRead } from '../../Redux/Slices/userSlice';
import './Home.css';
import './LegacyPOS.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ModernNoImageGrid from './ModernNoImageGrid';
import PrintJobModal from './PrintJobModal';
import FastPrintModal from './FastPrintModal';
import ItemSearchFilterDrawer from './ItemSearchFilterDrawer';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import CardTerminalModal from '../Admin/CardTerminalModal';

import OpeningEntryPage from '../../Pages/OpeningEntryPage';
import { db } from '../../db';
import Swal from 'sweetalert2';
import { frappeCall } from '../../utils/frappe';
import POSService from '../../utils/posService';
import { GCC_COUNTRIES, OTHER_COUNTRIES, ALL_COUNTRY_CODES, getCountryRule, stripCountryPrefix } from '../../utils/countryCodes';
import { loadLocalMatrixConfig, fetchUserMatrixConfig, saveUserMatrixConfig } from '../../utils/tableMatrixHelper';
import CountryCodeSelector from '../Common/CountryCodeSelector';

const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

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
        <div className="flex items-center min-w-0 flex-1">
            <span
                title="Offline ID generated according to the continuous sequence"
                className="offline-id-input text-xs font-black tracking-tight text-slate-800 font-mono select-all truncate"
            >
                {displayString}
            </span>
        </div>
    );
};

const CurrentTimeDisplay = ({ variant }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (variant === 'legacy') {
        return (
            <span style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', marginTop: '1px', color: '#64748b', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{format(currentTime, 'MMM dd')}</span>
                <span style={{ color: '#94a3b8' }}>|</span>
                <div className="digital-decoder-clock">
                    <div className="digital-decoder-bg">88:88:88</div>
                    <div className="digital-decoder-fg">{format(currentTime, 'HH:mm:ss')}</div>
                </div>
            </span>
        );
    }
    return (
        <span className="text-[9px] font-bold uppercase mt-1 tracking-tighter flex items-center gap-1 whitespace-nowrap">
            <span className="text-slate-400 mr-1">DATE:</span>
            <span className="text-slate-500">{format(currentTime, 'MMM dd, yyyy')}</span>
            <span className="text-slate-300">|</span>
            <div className="digital-decoder-clock">
                <div className="digital-decoder-bg">88:88:88</div>
                <div className="digital-decoder-fg">{format(currentTime, 'HH:mm:ss')}</div>
            </div>
        </span>
    );
};

function Home() {
    const navigate = useNavigate();
    const location = useLocation();
    const { getShortcut, isShortcutPressed } = useCustomShortcuts();

    useEffect(() => {
        if (location.state?.loadSalesOrder) {
            loadSalesOrderIntoPOS(location.state.loadSalesOrder);
            // Clear the state so it doesn't loop
            window.history.replaceState({}, document.title);
        }
        if (location.state?.loadDeliveryNote) {
            loadDeliveryNoteIntoPOS(location.state.loadDeliveryNote);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const loadSalesOrderIntoPOS = async (soName) => {
        try {
            Swal.fire({ title: 'Loading Sales Order...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const soDoc = await frappeCall({
                method: 'frappe.client.get',
                args: { doctype: 'Sales Order', name: soName }
            });

            if (soDoc) {
                // Set Customer
                setCustomerName(soDoc.customer_name || soDoc.customer);
                setSelectedCustomer({
                    name: soDoc.customer,
                    customer_name: soDoc.customer_name,
                    customer_group: soDoc.customer_group
                });

                // Set Items
                const mappedItems = soDoc.items.map(i => ({
                    id: i.item_code,
                    name: i.item_name,
                    qty: i.qty,
                    uom: i.uom,
                    price: i.rate,
                    is_tax_inclusive: true,
                    custom_pieces_per_box: i.custom_pieces_per_box || 1,
                    custom_boxes_per_master_box: i.custom_boxes_per_master_box || 1,
                    sales_order: soDoc.name,
                    so_detail: i.name
                }));

                setBillItems(mappedItems);

                Swal.fire({
                    icon: 'success',
                    title: `Sales Order ${soName} Loaded`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
        } catch (e) {
            console.error("Error loading Sales Order:", e);
            Swal.fire('Error', 'Failed to load Sales Order details into POS', 'error');
        }
    };

    const loadDeliveryNoteIntoPOS = async (dnName) => {
        try {
            Swal.fire({ title: 'Loading Delivery Note...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const dnDoc = await frappeCall({
                method: 'frappe.client.get',
                args: { doctype: 'Delivery Note', name: dnName }
            });

            if (dnDoc) {
                // Set Customer
                setCustomerName(dnDoc.customer_name || dnDoc.customer);
                setSelectedCustomer({
                    name: dnDoc.customer,
                    customer_name: dnDoc.customer_name,
                    customer_group: dnDoc.customer_group
                });

                // Set Items
                const mappedItems = dnDoc.items.map(i => ({
                    id: i.item_code,
                    name: i.item_name,
                    qty: i.qty,
                    uom: i.uom,
                    price: i.rate,
                    is_tax_inclusive: true,
                    custom_pieces_per_box: i.custom_pieces_per_box || 1,
                    custom_boxes_per_master_box: i.custom_boxes_per_master_box || 1,
                    delivery_note: dnDoc.name,
                    dn_detail: i.name
                }));

                setBillItems(mappedItems);

                Swal.fire({
                    icon: 'success',
                    title: `Delivery Note ${dnName} Loaded`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
        } catch (e) {
            console.error("Error loading Delivery Note:", e);
            Swal.fire('Error', 'Failed to load Delivery Note details into POS', 'error');
        }
    };

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
    const isMac = useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        const plat = navigator.platform || '';
        const uadPlat = navigator.userAgentData?.platform || '';
        return /Mac|iPhone|iPod|iPad/i.test(plat) || /Macintosh|Mac OS X/i.test(ua) || /macOS/i.test(uadPlat);
    }, []);
    const formatKeyLabel = useCallback((keyStr) => {
        if (!keyStr) return '';
        const trimmed = String(keyStr).trim();
        if (!isMac) {
            return trimmed
                .replace(/^⌥\s*\+?\s*/i, 'Alt+')
                .replace(/^Option\s*\+\s*/i, 'Alt+')
                .replace(/^⌘\s*\+?\s*/i, 'Ctrl+')
                .replace(/^\^\s*Ctrl\s*\+\s*/i, 'Ctrl+')
                .replace(/^\^\s*\+?\s*/i, 'Ctrl+')
                .replace(/^fn\+/i, '');
        }
        if (/^F\d{1,2}$/i.test(trimmed)) {
            return `fn+${trimmed.toUpperCase()}`;
        }
        if (/^alt\s*\+\s*/i.test(trimmed) || /^option\s*\+\s*/i.test(trimmed) || /^⌥\s*Option\s*\+\s*/i.test(trimmed)) {
            return `⌥${trimmed.replace(/^(alt|option|⌥\s*option)\s*\+\s*/i, '').toUpperCase()}`;
        }
        if (/^ctrl\s*\+\s*/i.test(trimmed) || /^\^\s*Ctrl\s*\+\s*/i.test(trimmed)) {
            return `⌃${trimmed.replace(/^(ctrl|\^\s*ctrl)\s*\+\s*/i, '').toUpperCase()}`;
        }
        if (/^cmd\s*\+\s*/i.test(trimmed) || /^⌘\s*\+\s*/i.test(trimmed)) {
            return `⌘${trimmed.replace(/^(cmd|⌘)\s*\+\s*/i, '').toUpperCase()}`;
        }
        return trimmed;
    }, [isMac]);
    const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");
    const isManager = useSelector((state) => state.user.is_manager || false) || isAdmin;

    const [posOpeningEntry, setPosOpeningEntry] = useState(localStorage.getItem('posOpeningEntry') || '');
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [showPrintJobModal, setShowPrintJobModal] = useState(false);
    const [showFastPrintModal, setShowFastPrintModal] = useState(false);
    const [showItemSearchDrawer, setShowItemSearchDrawer] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Classic Theme Settings menu dropdown states
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const settingsDropdownRef = useRef(null);

    // Notification States
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationsContainerRef = useRef(null);
    const notifications = useSelector((state) => state.user.notifications || []);
    const unreadCount = notifications.filter(n => !n.read).length;

    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [sessionOrderCount, setSessionOrderCount] = useState(1);

    // POS Window Mode: 'fullscreen' or 'popup' (Compact popup card with background overlay)
    const [posWindowMode, setPosWindowMode] = useState(() => {
        try {
            return localStorage.getItem('pos_window_mode') || 'fullscreen';
        } catch (e) {
            return 'fullscreen';
        }
    });

    // POS Popup Dimensions, Crop & Scale State
    const [popupDimensions, setPopupDimensions] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_popup_dimensions');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed) {
                    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
                    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
                    return {
                        width: Math.min(Math.min(1280, winW - 24), Math.max(760, parsed.width || 1200)),
                        height: Math.min(Math.min(580, winH - 64), Math.max(380, parsed.height || 560)),
                        scale: 100,
                        isMax: !!parsed.isMax
                    };
                }
            }
        } catch (e) {}
        const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
        return {
            width: Math.min(1200, winW - 24),
            height: Math.min(560, winH - 64),
            scale: 100,
            isMax: false
        };
    });

    const isResizingRef = useRef(null);
    const [isResizing, setIsResizing] = useState(false);

    const updateDimensions = (newDim) => {
        setPopupDimensions(prev => {
            const updated = typeof newDim === 'function' ? newDim(prev) : { ...prev, ...newDim };
            try {
                localStorage.setItem('pos_popup_dimensions', JSON.stringify(updated));
            } catch (e) {}
            return updated;
        });
    };

    const handleResizeStart = (direction, e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = popupDimensions.width || 1200;
        const startH = popupDimensions.height || 560;

        isResizingRef.current = { direction, startX, startY, startW, startH };
        setIsResizing(true);

        const onMouseMove = (moveEvent) => {
            if (!isResizingRef.current) return;
            const { direction: dir, startX: sx, startY: sy, startW: sw, startH: sh } = isResizingRef.current;
            const dx = moveEvent.clientX - sx;
            const dy = moveEvent.clientY - sy;

            let nextW = sw;
            let nextH = sh;

            if (dir.includes('r')) {
                nextW = sw + dx * 2;
            } else if (dir.includes('l')) {
                nextW = sw - dx * 2;
            }

            if (dir.includes('b')) {
                nextH = sh + dy * 2;
            } else if (dir.includes('t')) {
                nextH = sh - dy * 2;
            }

            const maxW = Math.max(760, window.innerWidth - 30);
            const maxH = Math.max(400, window.innerHeight - 60);

            nextW = Math.round(Math.min(maxW, Math.max(760, nextW)));
            nextH = Math.round(Math.min(maxH, Math.max(380, nextH)));

            setPopupDimensions(prev => ({
                ...prev,
                width: nextW,
                height: nextH,
                isMax: false
            }));
        };

        const onMouseUp = () => {
            setIsResizing(false);
            isResizingRef.current = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setPopupDimensions(prev => {
                try {
                    localStorage.setItem('pos_popup_dimensions', JSON.stringify(prev));
                } catch (err) {}
                return prev;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const wrapWindowMode = (content) => {
        if (posWindowMode !== 'popup') {
            return (
                <div
                    className="pos-fullscreen-viewport"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh',
                        maxHeight: '100vh',
                        maxWidth: '100vw',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1
                    }}
                >
                    {content}
                </div>
            );
        }

        const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;

        const maxModalH = Math.max(380, winH - 56);
        const maxModalW = Math.max(740, winW - 20);

        const rawW = popupDimensions.isMax ? maxModalW : (popupDimensions.width || 1200);
        const rawH = popupDimensions.isMax ? maxModalH : (popupDimensions.height || 560);

        const effectiveWidth = `${Math.min(maxModalW, Math.max(740, rawW))}px`;
        const effectiveHeight = `${Math.min(maxModalH, Math.max(380, rawH))}px`;
        const zoomScale = (popupDimensions.scale || 100) / 100;

        return (
            <div
                className="pos-popup-backdrop"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 100,
                    backgroundColor: 'rgba(15, 23, 42, 0.76)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    padding: '8px 12px 10px 12px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    userSelect: isResizing ? 'none' : 'auto'
                }}
            >
                {/* FLOATING CROP & RESIZE CONTROLS TOOLBAR */}
                <div
                    className="pos-crop-toolbar animate-in fade-in slide-in-from-top-3 duration-200"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(12px)',
                        padding: '3px 12px',
                        borderRadius: '30px',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        marginBottom: '6px',
                        zIndex: 110,
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', paddingRight: '8px', borderRight: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        <Crop size={14} />
                        <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f8fafc' }}>
                            Crop & Scale
                        </span>
                    </div>

                    {/* Dimensions Pill */}
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '12px', fontFamily: 'monospace' }}>
                        {popupDimensions.isMax ? 'FULL VIEW' : `${Math.round(parseInt(effectiveWidth))} × ${Math.round(parseInt(effectiveHeight))} px`}
                    </span>

                    {/* Scale / Zoom Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
                        <button
                            type="button"
                            onClick={() => updateDimensions(prev => ({ ...prev, scale: Math.max(75, (prev.scale || 100) - 5) }))}
                            style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Decrease UI Scale (-5%)"
                        >
                            <ZoomOut size={13} />
                        </button>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#38bdf8', minWidth: '36px', textAlign: 'center' }}>
                            {popupDimensions.scale || 100}%
                        </span>
                        <button
                            type="button"
                            onClick={() => updateDimensions(prev => ({ ...prev, scale: Math.min(125, (prev.scale || 100) + 5) }))}
                            style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Increase UI Scale (+5%)"
                        >
                            <ZoomIn size={13} />
                        </button>
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: '8px' }}>
                        <button
                            type="button"
                            onClick={() => updateDimensions({ width: 1000, height: Math.min(520, winH - 56), isMax: false })}
                            style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#e2e8f0', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                        >
                            Compact
                        </button>
                        <button
                            type="button"
                            onClick={() => updateDimensions({ width: 1200, height: Math.min(580, winH - 56), isMax: false })}
                            style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#e2e8f0', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                        >
                            Medium
                        </button>
                        <button
                            type="button"
                            onClick={() => updateDimensions({ width: 1380, height: Math.min(640, winH - 56), isMax: false })}
                            style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#e2e8f0', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                        >
                            Large
                        </button>
                        <button
                            type="button"
                            onClick={() => updateDimensions(prev => ({ ...prev, isMax: !prev.isMax }))}
                            style={{ background: popupDimensions.isMax ? '#0284c7' : 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                        >
                            {popupDimensions.isMax ? 'Fit' : 'Max'}
                        </button>
                    </div>

                    {/* Reset Button */}
                    <button
                        type="button"
                        onClick={() => updateDimensions({ width: 1200, height: Math.min(560, winH - 56), scale: 100, isMax: false })}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 800 }}
                        title="Reset Dimensions & Scale"
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>

                    {/* Exit Popup / Fullscreen */}
                    <button
                        type="button"
                        onClick={() => {
                            setPosWindowMode('fullscreen');
                            try { localStorage.setItem('pos_window_mode', 'fullscreen'); } catch (e) {}
                        }}
                        style={{ background: '#10b981', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '3px 9px', fontSize: '10px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}
                    >
                        <Maximize2 size={11} />
                        FULLSCREEN
                    </button>
                </div>

                {/* RESIZABLE POPUP CONTAINER WITH CROP CORNERS & EDGES */}
                <div
                    className="pos-popup-modal-container pos-popup-mode"
                    style={{
                        width: effectiveWidth,
                        height: effectiveHeight,
                        maxWidth: 'calc(100vw - 20px)',
                        maxHeight: 'calc(100vh - 54px)',
                        borderRadius: '16px',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 0 2px rgba(56, 189, 248, 0.45)',
                        background: '#ffffff',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}
                >
                    {/* CROP CORNER HANDLES */}
                    <div className="pos-crop-handle pos-crop-tl" onMouseDown={(e) => handleResizeStart('tl', e)} title="Drag to Resize (Top-Left)" />
                    <div className="pos-crop-handle pos-crop-tr" onMouseDown={(e) => handleResizeStart('tr', e)} title="Drag to Resize (Top-Right)" />
                    <div className="pos-crop-handle pos-crop-bl" onMouseDown={(e) => handleResizeStart('bl', e)} title="Drag to Resize (Bottom-Left)" />
                    <div className="pos-crop-handle pos-crop-br" onMouseDown={(e) => handleResizeStart('br', e)} title="Drag to Resize (Bottom-Right)" />

                    {/* CROP EDGE HANDLES */}
                    <div className="pos-crop-edge-handle pos-crop-top" onMouseDown={(e) => handleResizeStart('t', e)} title="Drag to Resize Height" />
                    <div className="pos-crop-edge-handle pos-crop-bottom" onMouseDown={(e) => handleResizeStart('b', e)} title="Drag to Resize Height" />
                    <div className="pos-crop-edge-handle pos-crop-left" onMouseDown={(e) => handleResizeStart('l', e)} title="Drag to Resize Width" />
                    <div className="pos-crop-edge-handle pos-crop-right" onMouseDown={(e) => handleResizeStart('r', e)} title="Drag to Resize Width" />

                    <div
                        style={{
                            transform: zoomScale !== 1 ? `scale(${zoomScale})` : 'none',
                            transformOrigin: 'top left',
                            width: zoomScale !== 1 ? `${(100 / zoomScale).toFixed(2)}%` : '100%',
                            height: zoomScale !== 1 ? `${(100 / zoomScale).toFixed(2)}%` : '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            minHeight: 0,
                            overflow: 'hidden'
                        }}
                    >
                        {content}
                    </div>
                </div>
            </div>
        );
    };

    // NEW: Legacy Classic Themes (for styles)
    const { legacySubTheme, setLegacySubTheme, isGreen, toggleTheme: toggleLegacyColor } = useLegacyTheme();

    // New ref for category horizontal scroll
    const categoryScrollRef = useRef(null);

    // ----- Classic Theme Column Config -----
    const DEFAULT_CLASSIC_COLUMNS = [
        { id: 'barcode', label: 'Barcode', visible: true, width: 140 },
        { id: 'description', label: 'Description', visible: true, width: 240 },
        { id: 'uom', label: 'UOM', visible: true, width: 100 },
        { id: 'qty', label: 'Qty', visible: true, width: 60 },
        { id: 'pcs', label: 'Pcs', visible: true, width: 60 },
        { id: 'price', label: 'Price', visible: true, width: 80 },
        { id: 'vat', label: 'VAT (5%)', visible: true, width: 70 },
        { id: 'total', label: 'Total', visible: true, width: 100 },
        { id: 'item_code', label: 'Item Code', visible: false, width: 130 },
    ];

    const [classicColumns, setClassicColumns] = useState(() => loadLocalMatrixConfig('pos_home_matrix_config', DEFAULT_CLASSIC_COLUMNS));
    const [showClassicColConfig, setShowClassicColConfig] = useState(false);
    const [resizingClassicCol, setResizingClassicCol] = useState(null);

    useEffect(() => {
        fetchUserMatrixConfig('pos_home_matrix_config', DEFAULT_CLASSIC_COLUMNS).then(backendCols => {
            if (backendCols) setClassicColumns(backendCols);
        });
    }, []);

    const handleClassicColConfigUpdate = (newConfig) => {
        saveUserMatrixConfig('pos_home_matrix_config', newConfig, DEFAULT_CLASSIC_COLUMNS);
        if (newConfig === null) {
            setClassicColumns(DEFAULT_CLASSIC_COLUMNS);
        } else {
            setClassicColumns(newConfig);
        }
        setShowClassicColConfig(false);
    };

    const handleClassicColResizeMouseDown = (e, colId) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const targetCol = classicColumns.find(c => c.id === colId);
        const startWidth = parseInt(targetCol?.width || 100, 10);

        const handleMouseMove = (moveEvent) => {
            const diff = moveEvent.clientX - startX;
            const newWidth = Math.max(30, startWidth + diff);
            setClassicColumns(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            setResizingClassicCol(null);
            setClassicColumns(currentCols => {
                saveUserMatrixConfig('pos_home_matrix_config', currentCols, DEFAULT_CLASSIC_COLUMNS);
                return currentCols;
            });
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        setResizingClassicCol(colId);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const visibleClassicCols = classicColumns.filter(c => c.visible);
    // ----- End Classic Theme Column Config -----

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
        border-bottom: 1px solid #e2e8f0 !important;
        flex-shrink: 0 !important;
        position: relative !important;
        z-index: 110 !important;
      }
      .classic-field label { color: ${statusBarColor}; font-size: 10px; white-space: nowrap; font-weight: 900; letter-spacing: 0.5px; }
      .classic-field input, .classic-field select {
        background: #ffffff; border: 1.5px solid ${borderColor};
        padding: 6px 12px; font-size: 12px;
        font-family: inherit; color: #000; outline: none;
        border-radius: 12px;
        box-shadow: inset 1px 1px 2px rgba(0,0,0,0.1);
      }
      .classic-entry-area { flex: 1; display: flex; flex-direction: column; background: #f8fafc; position: relative; }
      .classic-entry-header {
        background: ${mainColor}; padding: 4px 10px;
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 1px solid ${borderColor}; flex-shrink: 0; gap: 10px;
      }
      table.classic-table {
        width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;
      }
      table.classic-table thead tr {
        background: #f1f5f9; color: #334155;
        position: sticky; top: 0; z-index: 5;
        border-bottom: 1px solid #cbd5e1;
      }
      table.classic-table thead th {
        padding: 6px 8px; text-align: left; font-weight: 700; font-size: 11px;
        letter-spacing: 0.04em; color: #334155;
        border-right: 1px solid #e2e8f0;
        background: #f1f5f9;
      }
      table.classic-table tbody td {
        padding: 0; border-right: 1px solid #e2e8f0;
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
        border-radius: 9999px !important;
      }
      .classic-shortcut-guide.horizontal .classic-shortcut-key {
        font-size: 9.5px !important;
        padding: 1px 4.5px !important;
        border-radius: 9999px !important;
      }
      .classic-shortcut-guide.horizontal .classic-shortcut-label {
        font-size: 12px !important;
      }
      .classic-shortcut-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px !important;
        background: #f4fbf9 !important;
        border: 1.5px solid #bce3da !important;
        border-radius: 9999px !important;
        cursor: pointer;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
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
       .classic-root .digital-decoder-clock {
         font-size: 10px !important;
         padding: 1px 4.5px !important;
         height: 16px !important;
         border-radius: 4px !important;
         display: inline-flex !important;
         align-items: center !important;
         justify-content: center !important;
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
    const [activeCustomerIndex, setActiveCustomerIndex] = useState(-1);
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
            {showItemDetailModal && renderItemDetailModal()}
            {showLoyaltyModal && renderLoyaltyModal()}
            {showPaymentModal && renderPaymentModal()}
            {showCreateModal && renderCreateModal()}
            {showGroupChangeModal && renderGroupChangeModal()}
            <CardTerminalModal
                isOpen={showCardTerminalModal}
                onClose={() => setShowCardTerminalModal(false)}
                amount={cardTerminalAmount || (balanceRemaining > 0 ? balanceRemaining : grandTotal)}
                onPaymentSuccess={handleTerminalSuccess}
            />


            <PrintJobModal
                isOpen={showPrintJobModal}
                onClose={() => setShowPrintJobModal(false)}
                onAddJobToCart={(item, uom, initialQty) => handleAddToBill(item, uom, initialQty)}
                themeColor="#10b981"
            />
            <FastPrintModal
                isOpen={showFastPrintModal}
                onClose={() => setShowFastPrintModal(false)}
                onAddJobToCart={(item, uom, initialQty) => handleAddToBill(item, uom, initialQty)}
            />
            <ItemSearchFilterDrawer
                isOpen={showItemSearchDrawer}
                onClose={() => setShowItemSearchDrawer(false)}
                items={Items}
                onSelectItem={(item) => handleAddToBill(item)}
                warehouse={warehouse}
                categories={categories}
                theme={theme}
            />
            {showOpeningModal && (
                <div className="home-modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="home-modal" style={{ maxWidth: '1450px', width: '98vw', maxHeight: '98vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 p-5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <DirhamIcon size={20} />
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
                                    {draftOrders.map((draft, idx) => {
                                        const isSelected = idx === activeDraftIndex;
                                        return (
                                            <div
                                                key={draft.id}
                                                id={`draft-card-${idx}`}
                                                onClick={() => setActiveDraftIndex(idx)}
                                                onDoubleClick={() => loadDraftOrder(draft)}
                                                style={{
                                                    background: isSelected ? '#e0f2fe' : '#f8fafc',
                                                    border: isSelected ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                                                    borderRadius: '12px',
                                                    padding: '15px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    boxShadow: isSelected ? '0 4px 12px -2px rgba(14, 165, 233, 0.25)' : 'none',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
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
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            loadDraftOrder(draft);
                                                        }}
                                                        style={{
                                                            background: '#0ea5e9',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '10px 20px',
                                                            fontWeight: 800,
                                                            fontSize: '13px',
                                                            cursor: 'pointer',
                                                            boxShadow: isSelected ? '0 4px 10px -1px rgba(14, 165, 233, 0.5)' : '0 4px 6px -1px rgba(14, 165, 233, 0.3)',
                                                            outline: isSelected ? '2px solid #0284c7' : 'none'
                                                        }}
                                                    >
                                                        RESUME
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                        <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>UI Settings</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={hideAllShortcuts}
                                    onChange={toggleHideAllShortcuts}
                                    style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                                />
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>Maximize POS (Hide Sidebars)</span>
                            </label>
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
        // Admin users never need an opening entry
        if (isAdmin) return;

        // For non-admin users: check the backend for the last opening entry status
        const checkOpeningEntry = async () => {
            try {
                const resp = await frappeCall({
                    method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries',
                    type: 'GET',
                    args: { warehouse }
                });
                const data = resp?.message || resp;
                const entries = data?.data || [];

                if (entries.length > 0) {
                    // There's an active (open, no closing) opening entry — auto-use it
                    const activeEntry = entries[0];
                    localStorage.setItem('posOpeningEntry', activeEntry.name);
                    setPosOpeningEntry(activeEntry.name);
                    setShowOpeningModal(false);
                } else {
                    // No active opening entry found.
                    // The user either closed their previous shift or hasn't created one today.
                    // Always prompt to open a new one.
                    localStorage.removeItem('posOpeningEntry');
                    setPosOpeningEntry('');
                    setShowOpeningModal(true);
                }
            } catch (e) {
                console.error('[Home] Error checking opening entry:', e);
                // Fallback: if localStorage has one, trust it
                if (!posOpeningEntry) {
                    setShowOpeningModal(false);
                }
            }
        };

        checkOpeningEntry();
    }, [user, session, navigate, isAdmin, warehouse]);

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
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'in_stock', 'out_of_stock'
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
    const [groupSearch, setGroupSearch] = useState("");

    const filteredCategories = useMemo(() => {
        if (!groupSearch.trim()) return categories;
        const term = groupSearch.toLowerCase().trim();

        // Find which categories match the category name directly
        // OR contain any item matching by item name, item code/id, sub-group, barcodes
        const matchingCategoriesFromItems = new Set();
        (Items || []).forEach(i => {
            const nameMatch = (i.name || "").toLowerCase().includes(term);
            const idMatch = (i.id || "").toLowerCase().includes(term) || (i.item_code || "").toLowerCase().includes(term);
            const groupMatch = (i.group || "").toLowerCase().includes(term);
            const subGroupMatch = (i.sub_group || i.item_sub_group || i.custom_sub_group || "").toLowerCase().includes(term);
            const barcodeMatch = (i.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(term));

            if (nameMatch || idMatch || groupMatch || subGroupMatch || barcodeMatch) {
                if (i.group) matchingCategoriesFromItems.add(i.group);
            }
        });

        return categories.filter(cat =>
            cat === "all" || 
            cat.toLowerCase().includes(term) || 
            matchingCategoriesFromItems.has(cat)
        );
    }, [categories, groupSearch, Items]);

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
    const [customerLastPrices, setCustomerLastPrices] = useState({});

    useEffect(() => {
        const custName = selectedCustomer?.name || selectedCustomer?.customer_name || (customerName && customerName !== 'Cash' ? customerName : null);
        if (custName && custName !== 'Cash') {
            axios.get(`${LEGACY_API}.get_customer_last_sale_prices`, {
                params: { customer: custName },
                withCredentials: true
            }).then(res => {
                if (res.data?.message) {
                    setCustomerLastPrices(res.data.message);
                } else {
                    setCustomerLastPrices({});
                }
            }).catch(() => setCustomerLastPrices({}));
        } else {
            setCustomerLastPrices({});
        }
    }, [selectedCustomer, customerName]);

    const isItemBarcode = useCallback((code) => {
        if (!code) return false;
        const trimmed = String(code).trim().toLowerCase();
        const numOnly = trimmed.replace(/\D/g, '');
        if (!trimmed) return false;
        return (Items || []).some(it => {
            if ((it.id && String(it.id).toLowerCase() === trimmed) || 
                (it.item_code && String(it.item_code).toLowerCase() === trimmed) ||
                (numOnly && it.item_code && String(it.item_code).replace(/\D/g, '') === numOnly)) {
                return true;
            }
            return (it.barcodes || []).some(b => {
                const bVal = typeof b === 'object' ? (b.barcode || b.name || '') : String(b);
                const bStr = String(bVal).trim().toLowerCase();
                return bStr === trimmed || (numOnly && bStr.replace(/\D/g, '') === numOnly);
            });
        });
    }, [Items]);

    const getCustomerLastPriceInfo = useCallback((item) => {
        if (!item || !customerLastPrices || Object.keys(customerLastPrices).length === 0) return null;
        const itemCode = item.item_code || item.id;
        if (!itemCode) return null;
        const itemPrices = customerLastPrices[itemCode];
        if (!itemPrices) return null;

        const currentUom = item.uom || 'Nos';
        if (itemPrices[currentUom]) {
            return itemPrices[currentUom];
        }
        if ((currentUom === 'Piece' || currentUom === 'Nos') && (itemPrices['Piece'] || itemPrices['Nos'])) {
            return itemPrices['Piece'] || itemPrices['Nos'];
        }
        return itemPrices['_default'] || null;
    }, [customerLastPrices]);

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
    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editingCustomerId, setEditingCustomerId] = useState(null);
    const [showCreateSecretKey, setShowCreateSecretKey] = useState(false);
    const [customerGroups, setCustomerGroups] = useState([]);
    const [showGroupChangeModal, setShowGroupChangeModal] = useState(false);
    const [groupChangeCust, setGroupChangeCust] = useState(null);
    const [targetGroup, setTargetGroup] = useState('Retail Customer');
    const [groupSecretKey, setGroupSecretKey] = useState('');
    const [showGroupSecretKey, setShowGroupSecretKey] = useState(false);
    const [groupChangeReason, setGroupChangeReason] = useState('');
    const [isSubmittingGroupChange, setIsSubmittingGroupChange] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '', phone: '', email: '',
        customer_group: 'Retail Customer',
        secret_key: '',
        address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
        custom_trn: ''
    });

    useEffect(() => {
        const fetchCustomerGroups = async () => {
            try {
                const res = await axios.get(`${LEGACY_API}.get_customer_meta_options`, { withCredentials: true });
                const groups = res.data?.message?.data?.customer_group || res.data?.data?.customer_group;
                if (groups && Array.isArray(groups) && groups.length > 0) {
                    setCustomerGroups(groups);
                } else {
                    const fallbackRes = await axios.get('/api/resource/Customer Group?fields=["name"]&limit=500', { withCredentials: true });
                    const fbGroups = fallbackRes.data?.data?.map(g => g.name).filter(Boolean);
                    if (fbGroups && fbGroups.length > 0) {
                        setCustomerGroups(fbGroups);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch customer groups:", err);
            }
        };
        fetchCustomerGroups();
    }, []);

    const [hiddenShortcuts, setHiddenShortcuts] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('pos_hidden_shortcuts')) || [];
        } catch {
            return [];
        }
    });

    const [hideAllShortcuts, setHideAllShortcuts] = useState(() => localStorage.getItem('pos_hide_all_shortcuts') === 'true');
    const toggleHideAllShortcuts = () => {
        setHideAllShortcuts(prev => {
            const next = !prev;
            localStorage.setItem('pos_hide_all_shortcuts', next);
            return next;
        });
    };

    const toggleHideShortcut = (key) => {
        setHiddenShortcuts(prev => {
            const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
            localStorage.setItem('pos_hidden_shortcuts', JSON.stringify(next));
            return next;
        });
    };

    const isShortcutShown = (key) => !hiddenShortcuts.includes(key);

    const allShortcutsList = [
        { key: formatKeyLabel(getShortcut('pos_home', 'discount', 'F1')), label: 'Discount' },
        { key: formatKeyLabel(getShortcut('pos_home', 'customer', 'F2')), label: 'Customer' },
        { key: formatKeyLabel(getShortcut('pos_home', 'search', 'F3')), label: 'Search' },
        { key: formatKeyLabel(getShortcut('pos_home', 'countryCode', 'F4')), label: 'Country Code (CC)' },
        { key: formatKeyLabel(getShortcut('pos_home', 'itemDetail', 'F5')), label: 'Item Detail' },
        { key: formatKeyLabel(getShortcut('pos_home', 'bulkQty', 'F6')), label: 'Bulk Qty' },
        { key: formatKeyLabel(getShortcut('pos_home', 'stock', 'F7')), label: 'Stock' },
        { key: formatKeyLabel(getShortcut('pos_home', 'uom', 'F8')), label: 'UOM Toggle' },
        { key: formatKeyLabel(getShortcut('pos_home', 'orders', 'F9')), label: 'Orders' },
        { key: formatKeyLabel(getShortcut('pos_home', 'printBill', 'F10')), label: 'Print Last Bill' },
        { key: formatKeyLabel(getShortcut('pos_home', 'priceUpdate', 'F11')), label: 'Price Update' },
        { key: formatKeyLabel(getShortcut('pos_home', 'loyalty', 'Alt+L')), label: 'Loyalty' },
        { key: getShortcut('pos_home', 'pay', 'Space'), label: 'Pay & Print' },
        { key: formatKeyLabel('Alt+N'), label: 'Pay No Print' },
        { key: formatKeyLabel('Alt+A'), label: 'Pay A4 Print' },
        { key: formatKeyLabel(getShortcut('pos_home', 'directCash', 'Alt+1')), label: 'Direct Cash' },
        { key: formatKeyLabel(getShortcut('pos_home', 'directBank', 'Ctrl+V')), label: 'Direct Bank' },
        { key: formatKeyLabel(getShortcut('pos_home', 'directCard', 'Alt+2')), label: 'Direct Card' },
        { key: formatKeyLabel(getShortcut('pos_home', 'clearBill', 'Alt+C')), label: 'Clear' },
        { key: formatKeyLabel(getShortcut('pos_home', 'saveDraft', 'Alt+S')), label: 'Save Draft' },
        { key: formatKeyLabel(getShortcut('pos_home', 'selectItem', 'Alt+I')), label: 'Select / Swap Item' },
        { key: '↑↓', label: 'Navigate' },
        { key: '+/-', label: 'Adjust Qty' },
        { key: '←→', label: 'Tax Toggle' }
    ];

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

    // Real-Time Employee PIN resolution states
    const [createPinEmployee, setCreatePinEmployee] = useState(null);
    const [discountPinEmployee, setDiscountPinEmployee] = useState(null);
    const [loyaltyPinEmployee, setLoyaltyPinEmployee] = useState(null);

    // Debounced lookup for Create Customer PIN
    useEffect(() => {
        const pin = (createForm.secret_key || '').trim();
        if (pin.length >= 3) {
            const timer = setTimeout(async () => {
                try {
                    const res = await POSService.getCashierBySecretKey(pin, warehouse);
                    if (res && res.status === 'success') {
                        setCreatePinEmployee(res);
                    } else {
                        setCreatePinEmployee({ status: 'invalid' });
                    }
                } catch {
                    setCreatePinEmployee({ status: 'invalid' });
                }
            }, 250);
            return () => clearTimeout(timer);
        } else {
            setCreatePinEmployee(null);
        }
    }, [createForm.secret_key, warehouse]);

    // Debounced lookup for Modal PINs (Discount & Loyalty)
    useEffect(() => {
        const pin = (secretKeyInput || '').trim();
        if (pin.length >= 3) {
            const timer = setTimeout(async () => {
                try {
                    const res = await POSService.getCashierBySecretKey(pin, warehouse);
                    if (res && res.status === 'success') {
                        setDiscountPinEmployee(res);
                        setLoyaltyPinEmployee(res);
                    } else {
                        setDiscountPinEmployee({ status: 'invalid' });
                        setLoyaltyPinEmployee({ status: 'invalid' });
                    }
                } catch {
                    setDiscountPinEmployee({ status: 'invalid' });
                    setLoyaltyPinEmployee({ status: 'invalid' });
                }
            }, 250);
            return () => clearTimeout(timer);
        } else {
            setDiscountPinEmployee(null);
            setLoyaltyPinEmployee(null);
        }
    }, [secretKeyInput, warehouse]);

    // Drafts & Themes
    const [showDraftsModal, setShowDraftsModal] = useState(false);
    const [draftOrders, setDraftOrders] = useState([]);
    const [activeDraftIndex, setActiveDraftIndex] = useState(0);
    const [showThemeSidebar, setShowThemeSidebar] = useState(false);

    // Payment
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [checkoutMode, setCheckoutMode] = useState('normal'); // 'normal', 'print', 'no-print', 'print-a4'
    const [showItemDetailModal, setShowItemDetailModal] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState(null);
    const [itemSalesHistory, setItemSalesHistory] = useState([]);
    const [itemSalesHistoryLoading, setItemSalesHistoryLoading] = useState(false);
    const [nearbyBranches, setNearbyBranches] = useState([]);
    const [nearbyBranchesLoading, setNearbyBranchesLoading] = useState(false);
    const [lastInvoiceData, setLastInvoiceData] = useState(null);
    const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
    const [paymentReferenceNo, setPaymentReferenceNo] = useState('');
    const [showCardTerminalModal, setShowCardTerminalModal] = useState(false);
    const [cardTerminalAmount, setCardTerminalAmount] = useState(0);
    const [tenderedAmount, setTenderedAmount] = useState('');


    const [deliveryFee, setDeliveryFee] = useState('');
    const [showDeliveryFee, setShowDeliveryFee] = useState(false);
    const [drivers, setDrivers] = useState([]);
    const [selectedDriver, setSelectedDriver] = useState('');
    const [instapayServiceFee, setInstapayServiceFee] = useState('');
    const [instapayTaxInclusive, setInstapayTaxInclusive] = useState(false);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [payments, setPayments] = useState([]); // Array of { mode_of_payment, amount }

    const dropdownRef = useRef(null);
    const nameInputRef = useRef(null);
    const justSelectedCustomerRef = useRef(false);

    const prevDeliveryFeeRef = useRef(0);
    const prevServiceFeeRef = useRef(0);

    useEffect(() => {
        const currentDelFee = parseFloat(deliveryFee) || 0;
        const currentSvcFee = parseFloat(instapayServiceFee) || 0;

        const diffDelFee = currentDelFee - prevDeliveryFeeRef.current;
        const diffSvcFee = currentSvcFee - prevServiceFeeRef.current;

        const totalDiff = diffDelFee + diffSvcFee;

        if (totalDiff !== 0 && payments.length > 0) {
            setPayments(prevPayments => {
                if (prevPayments.length === 0) return prevPayments;
                const updatedPayments = [...prevPayments];
                updatedPayments[0] = {
                    ...updatedPayments[0],
                    amount: round2(updatedPayments[0].amount + totalDiff)
                };
                return updatedPayments;
            });
        }

        prevDeliveryFeeRef.current = currentDelFee;
        prevServiceFeeRef.current = currentSvcFee;
    }, [deliveryFee, instapayServiceFee]);

    // Fetch last 10 sales transactions and nearest branch stock for selected item in F5 Modal
    useEffect(() => {
        if (!showItemDetailModal || !selectedDetailItem) {
            setItemSalesHistory([]);
            setNearbyBranches([]);
            return;
        }
        const itemCode = selectedDetailItem.item_code || selectedDetailItem.id || selectedDetailItem.name || selectedDetailItem.item_name;
        if (!itemCode) return;

        // 1. Fetch Sales History
        const custName = selectedCustomer?.name || selectedCustomer?.customer_name || (customerName && customerName !== 'Cash' ? customerName : null);
        setItemSalesHistoryLoading(true);

        axios.get(`${LEGACY_API}.get_customer_item_sales_history`, {
            params: {
                item_code: itemCode,
                customer: custName || undefined,
                limit: 10
            },
            withCredentials: true
        }).then(res => {
            if (res.data?.message && Array.isArray(res.data.message)) {
                setItemSalesHistory(res.data.message);
            } else {
                setItemSalesHistory([]);
            }
        }).catch(err => {
            console.error("Failed to load customer item sales history:", err);
            setItemSalesHistory([]);
        }).finally(() => {
            setItemSalesHistoryLoading(false);
        });

        // 2. Fetch all nearest branches stock for F5 modal
        setNearbyBranchesLoading(true);
        frappeCall({
            method: 'kyle_retail.retail_api.api.find_nearest_stock',
            args: { item_code: itemCode, current_warehouse: warehouse }
        }).then(results => {
            if (results && Array.isArray(results)) {
                const filtered = results.filter(res => {
                    const whLower = (res.warehouse || "").toLowerCase();
                    return !["goods in transit", "finished goods", "work in progress", "stores"].some(term => whLower.includes(term));
                });
                setNearbyBranches(filtered);
            } else {
                setNearbyBranches([]);
            }
        }).catch(err => {
            console.error("Failed to load nearest stock for F5 modal:", err);
            setNearbyBranches([]);
        }).finally(() => {
            setNearbyBranchesLoading(false);
        });
    }, [showItemDetailModal, selectedDetailItem, selectedCustomer, customerName, warehouse]);

    // Universal ESC Key listener to close open modals
    useEffect(() => {
        const handleEscClose = (e) => {
            if (e.key === 'Escape') {
                if (showItemDetailModal) setShowItemDetailModal(false);
                if (showPaymentModal) setShowPaymentModal(false);
                if (showDraftsModal) setShowDraftsModal(false);
                if (showThemeSidebar) setShowThemeSidebar(false);
                if (showCardTerminalModal) setShowCardTerminalModal(false);
                if (showDeliveryFee) setShowDeliveryFee(false);
            }
        };
        window.addEventListener('keydown', handleEscClose);
        return () => window.removeEventListener('keydown', handleEscClose);
    }, [showItemDetailModal, showPaymentModal, showDraftsModal, showThemeSidebar, showCardTerminalModal, showDeliveryFee]);

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
            if (item.is_tax_inclusive !== false) {
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

    const grandTotal = useMemo(() => round2(netTotal + taxAmount + (parseFloat(deliveryFee) || 0) + ((selectedPaymentMode === 'InstaPay' || payments.some(p => p.mode_of_payment === 'InstaPay')) ? (parseFloat(instapayServiceFee) || 0) : 0)), [netTotal, taxAmount, deliveryFee, instapayServiceFee, selectedPaymentMode, payments]);

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
            amount: round2(amt),
            reference_no: paymentReferenceNo ? paymentReferenceNo.trim() : ''
        };
        setPayments([...payments, newPayment]);
        setSelectedPaymentMode('');
        setTenderedAmount('');
        setPaymentReferenceNo('');
    };

    const handleTerminalSuccess = (txnData) => {
        setShowCardTerminalModal(false);

        // Attach approval metadata to Card payment in payments state
        const updatedPayments = payments.map(p => {
            if (p.mode_of_payment === 'Card' || p.mode_of_payment === 'Credit Card') {
                return {
                    ...p,
                    reference_no: txnData?.rrn || '',
                    approval_code: txnData?.approval_code || 'APPROVED'
                };
            }
            return p;
        });

        const hasCard = updatedPayments.some(p => p.mode_of_payment === 'Card' || p.mode_of_payment === 'Credit Card');
        if (!hasCard) {
            updatedPayments.push({
                mode_of_payment: 'Card',
                amount: round2(cardTerminalAmount || grandTotal),
                reference_no: txnData?.rrn || '',
                approval_code: txnData?.approval_code || 'APPROVED'
            });
        }

        setPayments(updatedPayments);
        setSelectedPaymentMode('');
        setTenderedAmount('');

        // Proceed to finalize invoice after card approval
        setTimeout(() => {
            completePayment();
        }, 150);
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
            if (searchTerm.length < 1 || searchTerm === 'Cash' || justSelectedCustomerRef.current) {
                if (justSelectedCustomerRef.current) {
                    justSelectedCustomerRef.current = false;
                }
                setSearchResults([]);
                setShowDropdown(false);
                return;
            }

            // If user accidentally scans or types an item barcode in customer search, do not search customer - redirect to barcode scanner
            if (isItemBarcode(searchTerm)) {
                setSearchResults([]);
                setShowDropdown(false);
                setCustomerName('Cash');
                setCustomerMobile('');
                handleBarcodeScan(searchTerm);
                return;
            }

            if (selectedCustomer && (
                selectedCustomer.customer_name?.toLowerCase() === searchTerm.toLowerCase() ||
                selectedCustomer.mobile_no === searchTerm
            )) {
                setSearchResults([]);
                setShowDropdown(false);
                return;
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
            finally {
                setSearchLoading(false);
                if (!justSelectedCustomerRef.current) {
                    setShowDropdown(true);
                } else {
                    justSelectedCustomerRef.current = false;
                    setShowDropdown(false);
                }
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [customerName, customerMobile, isOffline, selectedCustomer]);

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
    const openCreate = (passedName) => {
        let nameVal = "";
        let phoneVal = "";

        const nameToUse = (typeof passedName === 'string' ? passedName : '');
        const searchVal = (nameToUse || (customerName && customerName !== 'Cash' ? customerName : '') || (customerMobile && customerMobile !== 'Cash' ? customerMobile : '') || "").trim();

        // Check if searchVal is a number (mobile number)
        const isNumeric = /^\d+$/.test(searchVal.replace(/\+/g, '').replace(/\D/g, ''));

        if (isNumeric) {
            phoneVal = stripCountryPrefix(searchVal);
        } else {
            nameVal = searchVal.replace(/[^a-zA-Z0-9\s.\-_/&()#]/g, '');
            // Also check if customerMobile is numeric to prefill phoneVal
            if (customerMobile && /^\d+$/.test(customerMobile.replace(/\+/g, '').replace(/\D/g, ''))) {
                phoneVal = stripCountryPrefix(customerMobile);
            } else if (phoneNumber) {
                phoneVal = stripCountryPrefix(phoneNumber);
            }
        }

        setIsEditingCustomer(false);
        setEditingCustomerId(null);
        setCreateForm({
            name: nameVal,
            phone: phoneVal,
            email: '',
            customer_group: 'Retail Customer',
            secret_key: '',
            address_line1: '',
            address_line2: '',
            city: '',
            emirate: '',
            country: 'United Arab Emirates',
            custom_trn: ''
        });
        setShowCreateSecretKey(false);
        setShowCreateModal(true); setShowDropdown(false);
    };

    const openEditCustomer = async (cust) => {
        if (!cust || cust.name === 'Cash') return;

        let fullCust = cust;
        let addrLine1 = cust.address_line1 || '';
        let addrLine2 = cust.address_line2 || '';
        let cityVal = cust.city || '';
        let emirateVal = cust.emirate || cust.state || '';
        let countryVal = cust.country || 'United Arab Emirates';

        // Fetch full customer doc and linked address if available online
        if (!isOffline && cust.name) {
            try {
                const fetched = await frappeCall({
                    method: 'frappe.client.get',
                    args: { doctype: 'Customer', name: cust.name }
                });
                if (fetched) {
                    fullCust = { ...cust, ...fetched };
                }

                // Fetch linked address if available
                const addrRes = await axios.get('/api/resource/Address', {
                    params: {
                        filters: JSON.stringify([['Dynamic Link', 'link_doctype', '=', 'Customer'], ['Dynamic Link', 'link_name', '=', cust.name]]),
                        fields: JSON.stringify(['name', 'address_line1', 'address_line2', 'city', 'state', 'country']),
                        limit: 1
                    },
                    withCredentials: true
                });
                const addrList = addrRes.data?.data || [];
                if (addrList.length > 0) {
                    addrLine1 = addrList[0].address_line1 || '';
                    addrLine2 = addrList[0].address_line2 || '';
                    cityVal = addrList[0].city || '';
                    emirateVal = addrList[0].state || '';
                    countryVal = addrList[0].country || 'United Arab Emirates';
                }
            } catch (fetchErr) {
                console.warn("Could not fetch full customer address details for edit:", fetchErr);
            }
        }

        const rawPhone = fullCust.mobile_no || fullCust.phone || '';
        const phoneWithoutPrefix = stripCountryPrefix(rawPhone);

        setIsEditingCustomer(true);
        setEditingCustomerId(fullCust.name);
        setCreateForm({
            name: fullCust.customer_name || fullCust.name || '',
            phone: phoneWithoutPrefix,
            email: fullCust.email_id || fullCust.email || '',
            customer_group: fullCust.customer_group || 'Retail Customer',
            secret_key: '',
            address_line1: addrLine1,
            address_line2: addrLine2,
            city: cityVal,
            emirate: emirateVal,
            country: countryVal,
            custom_trn: fullCust.custom_trn || ''
        });
        setShowCreateSecretKey(false);
        setShowCreateModal(true);
        setShowDropdown(false);
    };

    const openCustomerGroupChangeModal = (cust) => {
        if (!cust || cust.name === 'Cash') {
            Swal.fire({
                icon: 'warning',
                title: 'Select Named Customer',
                text: 'Please select or search a registered customer first to edit customer group.',
                confirmButtonColor: '#0284c7'
            });
            return;
        }
        setGroupChangeCust(cust);
        setTargetGroup(cust.customer_group || 'Retail Customer');
        setGroupSecretKey('');
        setShowGroupSecretKey(false);
        setGroupChangeReason('');
        setShowGroupChangeModal(true);
    };

    const handleConfirmCustomerGroupChange = async () => {
        if (!groupChangeCust) return;
        if (!groupSecretKey || !groupSecretKey.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Secret Key Required',
                text: 'Cashier / Manager secret code is strictly required to change customer group.',
                confirmButtonColor: '#f59e0b'
            });
            return;
        }

        if (targetGroup === groupChangeCust.customer_group) {
            Swal.fire({
                icon: 'info',
                title: 'No Change',
                text: `Customer is already assigned to "${targetGroup}".`,
                confirmButtonColor: '#0ea5e9'
            });
            return;
        }

        setIsSubmittingGroupChange(true);
        try {
            if (isOffline) {
                if (groupSecretKey.trim() !== userSecretKey) {
                    throw new Error("Invalid Secret Key. Customer group update cancelled.");
                }
                const updatedCust = {
                    ...groupChangeCust,
                    customer_group: targetGroup
                };
                await db.customers.put(updatedCust);
                if (selectedCustomer?.name === groupChangeCust.name || selectedCustomer?.customer_name === groupChangeCust.customer_name) {
                    setSelectedCustomer(updatedCust);
                }
                setShowGroupChangeModal(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Customer Group Updated (Offline)',
                    text: `Customer group changed to ${targetGroup}. Will sync online.`,
                    confirmButtonColor: '#10b981',
                    timer: 2000
                });
                return;
            }

            const res = await POSService.updateCustomerGroupWithAuth({
                customerName: groupChangeCust.name || groupChangeCust.customer_name,
                newCustomerGroup: targetGroup,
                secretKey: groupSecretKey.trim(),
                warehouse: warehouse,
                reason: groupChangeReason.trim()
            });

            if (res && (res.status === 'success' || res.customer)) {
                const updatedCustomer = {
                    ...groupChangeCust,
                    customer_group: targetGroup,
                    ...(res.customer || {})
                };
                await db.customers.put(updatedCustomer);
                if (selectedCustomer?.name === groupChangeCust.name || selectedCustomer?.customer_name === groupChangeCust.customer_name) {
                    setSelectedCustomer(updatedCustomer);
                    setCustomerName(updatedCustomer.customer_name);
                    setPhoneNumber(updatedCustomer.mobile_no || phoneNumber);
                }

                try {
                    const discRes = await frappeCall({
                        method: 'kyle_retail.kyle_retail.api.get_customer_group_discount',
                        args: { customer_group: targetGroup }
                    });
                    if (discRes && typeof discRes.discount_percentage === 'number') {
                        setDiscountPercent(discRes.discount_percentage);
                    }
                } catch (dErr) {
                    console.warn("Could not fetch group discount:", dErr);
                }

                setShowGroupChangeModal(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Customer Group Updated',
                    html: `Customer <b>${groupChangeCust.customer_name}</b> is now set to <b>${targetGroup}</b>.<br/><small style="color: #64748b; font-size: 11px;">Activity timeline log added to customer record.</small>`,
                    confirmButtonColor: '#10b981',
                    timer: 2500
                });
            } else {
                throw new Error(res?.message || 'Failed to update customer group');
            }
        } catch (err) {
            console.error("Promotion failed", err);
            const rawMsg = err.message || err.response?.data?.message || (err._server_messages ? JSON.parse(err._server_messages)[0] : '') || 'Invalid Secret Key or unauthorized operation.';
            const cleanMsg = typeof rawMsg === 'string' ? rawMsg.replace(/<[^>]*>/g, '') : 'Invalid Secret Key';
            Swal.fire({
                icon: 'error',
                title: 'Authorization Failed',
                text: cleanMsg,
                confirmButtonColor: '#e11d48'
            });
        } finally {
            setIsSubmittingGroupChange(false);
        }
    };

    const promoteCustomerGroup = async (cust, newGroup) => {
        setGroupChangeCust(cust);
        setTargetGroup(newGroup);
        setGroupSecretKey('');
        setShowGroupSecretKey(false);
        setGroupChangeReason('Promoted during payment selection');
        setShowGroupChangeModal(true);
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
        justSelectedCustomerRef.current = true;

        let finalCust = cust;
        if (cust && cust.name && cust.name !== 'Cash' && (!cust.customer_name || cust.customer_name === cust.name)) {
            try {
                const fetched = await frappeCall({
                    method: 'frappe.client.get',
                    args: { doctype: 'Customer', name: cust.name }
                });
                if (fetched) {
                    finalCust = fetched;
                }
            } catch (err) {
                console.error("Failed to fetch customer document details", err);
            }
        }

        setSelectedCustomer(finalCust);
        setCustomerName(finalCust.customer_name || finalCust.name || 'Cash');
        setPhoneNumber(finalCust.mobile_no || '');
        setCustomerMobile(''); // Clear mobile search
        setShowDropdown(false);
        setActiveCustomerIndex(-1);
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
    };

    const handleCreateCustomerGroup = async () => {
        const { value: formValues } = await Swal.fire({
            title: '<div class="text-left font-black text-slate-800 text-base flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Create Customer Group</div>',
            html: `
                <div style="text-align: left; display: flex; flex-direction: column; gap: 10px; font-size: 12px; margin-top: 8px;">
                    <div>
                        <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">CUSTOMER GROUP NAME <span style="color:#ef4444">*</span></label>
                        <input id="swal_cust_group_name" class="swal2-input !h-10 !m-0 !w-full !text-xs !font-bold !rounded-xl" placeholder="e.g. VIP Customer / Wholesaler" />
                    </div>
                    <div>
                        <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">PARENT CUSTOMER GROUP</label>
                        <input id="swal_cust_group_parent" class="swal2-input !h-10 !m-0 !w-full !text-xs !rounded-xl !bg-slate-50" value="All Customer Groups" readonly />
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Create Group',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            customClass: { popup: '!rounded-2xl !p-5' },
            preConfirm: () => {
                const groupName = document.getElementById('swal_cust_group_name')?.value?.trim();
                if (!groupName) {
                    Swal.showValidationMessage('Customer Group Name is required');
                    return false;
                }
                return groupName;
            }
        });

        if (!formValues) return;

        try {
            Swal.fire({
                title: 'Creating Group...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const res = await axios.post('/api/method/kyle_retail.retail_api.api.create_customer_group', {
                customer_group_name: formValues,
                parent_customer_group: 'All Customer Groups'
            }, { withCredentials: true });

            const newGroupName = res.data?.message?.name || res.data?.name || formValues;
            
            // Add to dropdown list and auto-select
            setCustomerGroups(prev => {
                const existing = Array.isArray(prev) ? prev : [];
                return existing.includes(newGroupName) ? existing : [...existing, newGroupName];
            });
            setCreateForm(prev => ({ ...prev, customer_group: newGroupName }));

            Swal.fire({
                icon: 'success',
                title: 'Group Created',
                text: `Customer Group "${newGroupName}" created and selected!`,
                timer: 1800,
                showConfirmButton: false
            });
        } catch (err) {
            console.error("Create customer group error:", err);
            Swal.fire({
                icon: 'error',
                title: 'Error Creating Group',
                text: err.response?.data?.message || err.message || 'Could not create Customer Group'
            });
        }
    };

    const createCustomer = async () => {
        const cleanedName = createForm.name.trim().replace(/[^a-zA-Z0-9\s.\-_/&()#]/g, '');
        if (!cleanedName) {
            Swal.fire('Validation Error', 'Customer name is required and can contain letters, numbers, spaces, and basic symbols.', 'warning');
            return;
        }

        const selectedGroup = (createForm.customer_group || '').trim();
        if (!selectedGroup) {
            Swal.fire('Validation Error', 'Customer group is mandatory. Please select a customer group.', 'warning');
            return;
        }

        const enteredSecretKey = (createForm.secret_key || '').trim();
        if (!enteredSecretKey) {
            Swal.fire('Validation Error', 'Cashier Secret Code / PIN is required to create a customer.', 'warning');
            return;
        }

        const strippedNumber = createForm.phone.trim().replace(/\D/g, '');
        if (!strippedNumber) {
            Swal.fire('Validation Error', 'Mobile number is required.', 'warning');
            return;
        }

        const rule = getCountryRule(countryCodePrefix);
        if (strippedNumber.length < rule.minLen || strippedNumber.length > rule.maxLen) {
            const rangeStr = rule.minLen === rule.maxLen ? `${rule.minLen}` : `${rule.minLen}-${rule.maxLen}`;
            Swal.fire('Validation Error', `${rule.country} (${countryCodePrefix}) mobile number must be ${rangeStr} digits.`, 'warning');
            return;
        }

        if (createForm.custom_trn && createForm.custom_trn.length !== 15) {
            Swal.fire('Validation Error', 'TRN must be exactly 15 digits.', 'warning');
            return;
        }

        // ── Verify Secret Key against Employee / User records ─────────────────
        setCreatingCustomer(true);
        let isAuthorized = false;
        try {
            if (isOffline) {
                if (enteredSecretKey === userSecretKey) {
                    isAuthorized = true;
                }
            } else {
                const authRes = await POSService.verifyAuthorizationKey(enteredSecretKey, 'customer_creation', warehouse);
                if (authRes && (authRes.status === 'success' || authRes.message?.includes('Authorized'))) {
                    isAuthorized = true;
                } else {
                    const fallback = await POSService.verifySecretKey(enteredSecretKey);
                    if (fallback && (fallback.status === 'success' || fallback.message === 'Authorized')) {
                        isAuthorized = true;
                    } else if (enteredSecretKey === userSecretKey) {
                        isAuthorized = true;
                    }
                }
            }
        } catch (authErr) {
            console.warn("Error calling verifyAuthorizationKey, checking cached secret key:", authErr);
            if (enteredSecretKey === userSecretKey) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            setCreatingCustomer(false);
            Swal.fire({
                icon: 'error',
                title: 'Unauthorized',
                text: 'Invalid Secret Key. Please enter the correct Cashier Secret Code to proceed.',
                confirmButtonColor: '#e11d48'
            });
            return;
        }

        const formattedPhone = `${countryCodePrefix}${strippedNumber}`;

        // ── Duplicate mobile number check ──────────────────────────────────────
        // If editing and mobile is unchanged, skip duplicate check
        // 1. Check local IndexedDB cache first (fast)
        const localDup = await db.customers.filter(c =>
            c.mobile_no && c.mobile_no.replace(/\D/g, '') === strippedNumber &&
            (!isEditingCustomer || c.name !== editingCustomerId)
        ).first();

        if (localDup) {
            setCreatingCustomer(false);
            Swal.fire({
                icon: 'warning',
                title: 'Number Already Registered',
                html: `Mobile <b>${formattedPhone}</b> is already linked to customer <b>${localDup.customer_name}</b>.<br/>Please use a different number.`,
                confirmButtonColor: '#f59e0b'
            });
            return;
        }

        // 2. Check ERPNext via Contact (server-side, catches numbers not in local cache)
        try {
            const dupRes = await axios.get('/api/resource/Contact', {
                params: {
                    filters: JSON.stringify([['mobile_no', '=', formattedPhone]]),
                    fields: JSON.stringify(['name', 'mobile_no']),
                    limit: 5
                },
                withCredentials: true
            });
            const dupList = dupRes.data?.data || [];
            // If editing, check if contact belongs to a different customer
            if (Array.isArray(dupList) && dupList.length > 0 && !isEditingCustomer) {
                setCreatingCustomer(false);
                Swal.fire({
                    icon: 'warning',
                    title: 'Number Already Registered',
                    html: `Mobile <b>${formattedPhone}</b> is already registered in the system.<br/>Please use a different number.`,
                    confirmButtonColor: '#f59e0b'
                });
                return;
            }
        } catch (_) {
            // Network error during dup check – proceed anyway (server create_customer will catch it)
        }
        // ──────────────────────────────────────────────────────────────────────

        const addr_parts = [createForm.address_line1, createForm.address_line2, createForm.city, createForm.emirate, createForm.country];
        const addr_text = addr_parts.filter(Boolean).join(", ");

        try {
            const formData = new FormData();
            if (isEditingCustomer && editingCustomerId) {
                formData.append("customer_id", editingCustomerId);
            }
            formData.append("customer_name", createForm.name.trim());
            formData.append("customer_group", selectedGroup);
            if (enteredSecretKey) formData.append("secret_key", enteredSecretKey);
            if (formattedPhone) formData.append("phone", formattedPhone);
            if (createForm.email) formData.append("email", createForm.email);
            if (warehouse) formData.append("warehouse", warehouse);
            if (createForm.address_line1) formData.append("address_line1", createForm.address_line1);
            if (createForm.address_line2) formData.append("address_line2", createForm.address_line2);
            if (createForm.city) formData.append("city", createForm.city);
            if (createForm.emirate) formData.append("emirate", createForm.emirate);
            if (createForm.country) formData.append("country", createForm.country);
            if (createForm.custom_trn) formData.append("custom_trn", createForm.custom_trn);

            const hostname = window.location.hostname.toLowerCase();
            if (hostname.includes('retailpos') || hostname.includes('kyleretail') || hostname.includes('retail.kylesolutions.com')) {
                if (!createForm.country) {
                    formData.append("country", "United Arab Emirates");
                    formData.append("territory", "United Arab Emirates");
                }
            }

            const res = await authFetch('custom_retailpos.custom_retailpos.retail_api.retail.create_customer', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();
            const inner = result.message || result;

            if (inner.status === "success" || inner.name) {
                const actionText = isEditingCustomer ? 'Updated' : 'Created';
                Swal.fire({
                    icon: 'success',
                    title: `Customer ${actionText}`,
                    text: `"${createForm.name}" has been ${actionText.toLowerCase()} in ERPNext.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                const newCust = {
                    name: inner.customer_id || inner.name || editingCustomerId,
                    customer_name: createForm.name.trim(),
                    customer_group: selectedGroup,
                    mobile_no: formattedPhone || "",
                    primary_address: addr_text || "",
                    email_id: createForm.email || "",
                    custom_trn: createForm.custom_trn || "",
                    is_synced: 1
                };
                await db.customers.put(newCust); // Keep local searchable copy
                pickCustomer(newCust);
                setShowCreateModal(false);
                setIsEditingCustomer(false);
                setEditingCustomerId(null);
                setCreateForm({
                    name: '', phone: '', email: '',
                    customer_group: 'Retail Customer',
                    secret_key: '',
                    address_line1: '', address_line2: '', city: '', emirate: '', country: 'United Arab Emirates',
                    custom_trn: ''
                });
            } else {
                Swal.fire('Error', inner.message || `Failed to ${isEditingCustomer ? 'update' : 'create'} customer`, 'error');
            }
        } catch (err) {
            console.error(err);
            if (isOffline) {
                // Save to local cache for offline usage
                const offlineCustomer = {
                    name: isEditingCustomer && editingCustomerId ? editingCustomerId : `OFFLINE-CUST-${Date.now()}`,
                    customer_name: createForm.name.trim(),
                    customer_group: selectedGroup,
                    mobile_no: formattedPhone || "",
                    primary_address: addr_text || "",
                    email_id: createForm.email || "",
                    custom_trn: createForm.custom_trn || "",
                    is_synced: 0,
                    is_offline: true
                };
                await db.customers.put(offlineCustomer);
                pickCustomer(offlineCustomer);
                setShowCreateModal(false);
                setIsEditingCustomer(false);
                setEditingCustomerId(null);
                Swal.fire('Offline Save', 'Customer saved locally. Will sync when online.', 'info');
            } else {
                Swal.fire('Error', `Network error while ${isEditingCustomer ? 'updating' : 'creating'} customer`, 'error');
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
            const rule = getCountryRule(countryCodePrefix);
            if (val.length < rule.minLen || val.length > rule.maxLen) {
                const rangeStr = rule.minLen === rule.maxLen ? `${rule.minLen}` : `${rule.minLen}-${rule.maxLen}`;
                Swal.fire('Validation Error', `${rule.country} (${countryCodePrefix}) mobile number must be ${rangeStr} digits.`, 'warning');
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

                        db.items.bulkPut(results.map(item => {
                            const whDetail = (item.warehouse_details || []).find(w => (w.warehouse || w.warehouse_name) === warehouse);
                            const buyPrice = item.buying_price || whDetail?.buying_price || item.valuation_rate || 0;
                            return {
                                id: item.name,
                                name: item.item_name,
                                image: item.image,
                                group: item.item_group || "others",
                                price: item.price_list_rate || 0,
                                prices: item.prices || {},
                                buying_price: buyPrice,
                                valuation_rate: item.valuation_rate || 0,
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
                                custom_boxes_per_master_box: item.custom_boxes_per_master_box || item.boxes_per_master_box || 1,
                                custom_loyalty_eligible: item.custom_loyalty_eligible || 0,
                                is_bundle: item.is_bundle || 0
                            };
                        })).catch(e => console.error("Dexie background update failed", e));

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
                const whDetail = (item.warehouse_details || []).find(w => (w.warehouse || w.warehouse_name) === warehouse);
                const currentBuyingPrice = item.buying_price || whDetail?.buying_price || item.valuation_rate || 0;

                return {
                    id: item.id || item.name,
                    item_code: item.item_code || item.id || item.name,
                    name: item.item_name || item.name,
                    image: finalImage,
                    group: item.group || item.item_group || "others",
                    sub_group: item.sub_group || item.item_sub_group || item.custom_sub_group || item.parent_item_group || "",
                    description: item.description || "",
                    // Base price (Nos/Piece price) – branch-specific from API
                    price: item.price || item.price_list_rate || 0,
                    buying_price: currentBuyingPrice,
                    buy_price: currentBuyingPrice,
                    valuation_rate: item.valuation_rate || 0,
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
                    brand: item.brand || "",
                    custom_size: item.custom_size || item.size || "",
                    custom_pieces_per_box: item.custom_pieces_per_box || 1,
                    custom_boxes_per_master_box: item.custom_boxes_per_master_box || item.boxes_per_master_box || 1,
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

        if (stockFilter === 'in_stock') {
            filtered = filtered.filter(i => (i.local_qty !== undefined ? i.local_qty : 0) > 0);
        } else if (stockFilter === 'out_of_stock') {
            filtered = filtered.filter(i => (i.local_qty !== undefined ? i.local_qty : 0) <= 0);
        }

        // Filter by barcodeInput (main search)
        if (barcodeInput.trim()) {
            const term = barcodeInput.toLowerCase().trim();
            filtered = filtered.filter(i =>
                (i.name || "").toLowerCase().includes(term) ||
                (i.id || "").toLowerCase().includes(term) ||
                (i.item_code || "").toLowerCase().includes(term) ||
                (i.group || "").toLowerCase().includes(term) ||
                (i.sub_group || i.item_sub_group || i.custom_sub_group || "").toLowerCase().includes(term) ||
                (i.description || "").toLowerCase().includes(term) ||
                (i.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(term))
            );
        }

        // Filter by groupSearch (Item Group bar search: Group, Sub-group, Item Name, Item Code)
        if (groupSearch.trim()) {
            const gTerm = groupSearch.toLowerCase().trim();
            filtered = filtered.filter(i =>
                (i.group || "").toLowerCase().includes(gTerm) ||
                (i.sub_group || i.item_sub_group || i.custom_sub_group || "").toLowerCase().includes(gTerm) ||
                (i.name || "").toLowerCase().includes(gTerm) ||
                (i.id || "").toLowerCase().includes(gTerm) ||
                (i.item_code || "").toLowerCase().includes(gTerm) ||
                (i.description || "").toLowerCase().includes(gTerm) ||
                (i.barcodes || []).some(b => (b.barcode || "").toLowerCase().includes(gTerm))
            );
        }

        setFilteredItems(filtered);
    }, [selectedCategory, Items, barcodeInput, groupSearch, stockFilter]);

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
    const handleAddToBill = (item, targetUom = null, initialQty = 1) => {
        setLastInteractedItem(item);
        const addQty = parseInt(initialQty) || 1;
        setBillItems(prev => {
            const selectedUom = targetUom || (item.uom_conversions?.Nos ? 'Nos' : (item.uom_conversions?.Piece ? 'Piece' : 'Nos'));
            const existingIdx = prev.findIndex(i => i.id === item.id && i.uom === selectedUom);
            if (existingIdx !== -1) {
                const updated = [...prev];
                updated[existingIdx] = { ...updated[existingIdx], qty: updated[existingIdx].qty + addQty };
                setSelectedBillIndex(existingIdx);
                return updated;
            } else {
                if (!item.is_print_job && item.local_qty <= 0) {
                    handleOutOfStockAlert(item);
                    return prev;
                }
                const pcsPerBox = parseFloat(item.custom_pieces_per_box || 1) || 1;
                const boxesPerMb = parseFloat(item.custom_boxes_per_master_box || 1) || 1;
                const baseNosPrice = item.prices?.['Nos'] || item.prices?.['Piece'] || item.price || 0;
                const hasValidBoxPrice = item.prices?.['Box'] && Number(item.prices['Box']) > baseNosPrice;
                const hasValidMasterBoxPrice = item.prices?.['Master Box'] && Number(item.prices['Master Box']) > baseNosPrice;

                let calcPrice = baseNosPrice;
                if (selectedUom === 'Master Box') {
                    calcPrice = hasValidMasterBoxPrice ? Number(item.prices['Master Box']) : (baseNosPrice * pcsPerBox * boxesPerMb);
                } else if (selectedUom === 'Box') {
                    calcPrice = hasValidBoxPrice ? Number(item.prices['Box']) : (baseNosPrice * pcsPerBox);
                }

                const newItem = {
                    ...item,
                    qty: addQty,
                    uom: selectedUom,
                    price: calcPrice,
                    base_unit_price: baseNosPrice,
                    custom_pieces_per_box: pcsPerBox,
                    custom_boxes_per_master_box: boxesPerMb,
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

            // 1. Check if barcode belongs to a Printing Job or EMC Machine Barcode
            const jobResult = await frappeCall({
                method: 'kyle_retail.retail_api.api.get_printing_job_by_barcode',
                args: { barcode: barcode.trim() }
            });

            if (jobResult && (jobResult.job_name || jobResult.status === 'already_billed')) {
                if (jobResult.status === 'already_billed') {
                    setBarcodeInput('');
                    setSearchLoading(false);
                    Swal.fire({
                        icon: 'warning',
                        title: 'Already Billed!',
                        text: jobResult.message || 'This Printing Job has already been billed and completed.',
                        confirmButtonColor: '#f59e0b'
                    });
                    barcodeInputRef.current?.focus();
                    return;
                }

                // Auto load Printing Job into bill
                const printJobItem = {
                    id: jobResult.item_code || 'Document Print',
                    item_code: jobResult.item_code || 'Document Print',
                    name: `PRINT JOB [${jobResult.paper_size}] - ${jobResult.total_qty} PAGES (${jobResult.barcode})`,
                    price: jobResult.unit_rate,
                    actual_qty: jobResult.total_qty,
                    local_qty: jobResult.total_qty,
                    stock_uom: 'Nos',
                    custom_job_barcode: jobResult.barcode,
                    is_print_job: true,
                    is_tax_inclusive: true
                };
                handleAddToBill(printJobItem, 'Nos', jobResult.total_qty);
                setBarcodeInput('');
                const inlineSearchEl = document.getElementById('legacy-inline-search');
                if (inlineSearchEl) {
                    inlineSearchEl.focus();
                    inlineSearchEl.select?.();
                } else {
                    barcodeInputRef.current?.focus();
                }
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
                Toast.fire({ icon: 'success', title: `Loaded Print Job ${jobResult.job_name}: AED ${jobResult.total_amount}` });
                setSearchLoading(false);
                return;
            }

            const results = await frappeCall({
                method: 'kyle_retail.retail_api.api.get_retail_item_details',
                args: { search_term: barcode.trim(), warehouse: warehouse }
            });
            const apiItem = (results || [])[0];

            if (apiItem) {
                const scannedBarcodeStr = barcode.trim();
                const matchedBarcode = (apiItem.barcodes || []).find(b => b.barcode === scannedBarcodeStr);
                const rawUom = matchedBarcode?.uom || apiItem.scanned_uom || apiItem.uom || apiItem.stock_uom || 'Nos';
                const normUom = rawUom.toLowerCase();
                const scannedUom = normUom === 'master box' ? 'Master Box' : (normUom === 'box' ? 'Box' : rawUom);

                const pendingInvoices = await db.invoices.where('is_synced').equals(0).toArray();
                let pendingQty = 0;
                pendingInvoices.forEach(inv => {
                    (inv.items || []).forEach(it => {
                        if (it.item_code === apiItem.name) {
                            const pcsPerBox = parseFloat(it.custom_pieces_per_box || 1) || 1;
                            const boxesPerMb = parseFloat(it.custom_boxes_per_master_box || 1) || 1;
                            const qtyPieces = it.uom === 'Master Box'
                                ? it.qty * pcsPerBox * boxesPerMb
                                : (it.uom === 'Box' ? it.qty * pcsPerBox : it.qty);
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
                    custom_pieces_per_box: parseFloat(apiItem.pcs_per_box || apiItem.custom_pieces_per_box || 1) || 1,
                    custom_boxes_per_master_box: parseFloat(apiItem.custom_boxes_per_master_box || apiItem.boxes_per_master_box || 1) || 1,
                    prices: apiItem.prices || {},
                    barcodes: apiItem.barcodes || [],
                    uom_conversions: apiItem.uom_conversions || {},
                    barcode_image: apiItem.barcode_image || null
                };

                // Fallback for prices if missing
                if (!itemToBill.prices.Nos && !itemToBill.prices.Piece) {
                    itemToBill.prices = { "Nos": apiItem.price_list_rate || 0 };
                }

                if (itemToBill.local_qty <= 0) {
                    handleOutOfStockAlert(itemToBill);
                    setBarcodeInput('');
                    barcodeInputRef.current?.focus();
                    return;
                }

                handleAddToBill(itemToBill, scannedUom);
                setBarcodeInput('');
                const inlineSearchEl = document.getElementById('legacy-inline-search');
                if (inlineSearchEl) {
                    inlineSearchEl.focus();
                    inlineSearchEl.select?.();
                } else {
                    barcodeInputRef.current?.focus();
                }

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
                    const matchedBc = (foundLocal.barcodes || []).find(b => (b.barcode || '').toLowerCase() === barcode.trim().toLowerCase());
                    const rawUom = matchedBc?.uom || (foundLocal.uom_conversions?.Nos ? 'Nos' : 'Nos');
                    const normUom = rawUom.toLowerCase();
                    const localUom = normUom === 'master box' ? 'Master Box' : (normUom === 'box' ? 'Box' : rawUom);
                    handleAddToBill(foundLocal, localUom);
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
        // Let global shortcuts pass through (Alt keys, Function keys, Ctrl keys)
        if (e.altKey || (e.key && e.key.startsWith('F')) || e.ctrlKey || e.metaKey) {
            return;
        }
        if (e.key === 'ArrowDown') {
            if (showItemDropdown) {
                e.preventDefault();
                setActiveItemIndex(prev => Math.min(prev + 1, itemSearchResults.length - 1));
            } else if (billItems.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                setSelectedBillIndex(prev => prev === -1 ? 0 : Math.min(prev + 1, billItems.length - 1));
            }
        } else if (e.key === 'ArrowUp') {
            if (showItemDropdown) {
                e.preventDefault();
                setActiveItemIndex(prev => Math.max(prev - 1, 0));
            } else if (billItems.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                setSelectedBillIndex(prev => prev === -1 ? billItems.length - 1 : Math.max(prev - 1, 0));
            }
        } else if (e.key === 'ArrowLeft') {
            if (selectedBillIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                const newBill = [...billItems];
                newBill[selectedBillIndex].is_tax_inclusive = false;
                setBillItems(newBill);
            }
        } else if (e.key === 'ArrowRight') {
            if (selectedBillIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                const newBill = [...billItems];
                newBill[selectedBillIndex].is_tax_inclusive = true;
                setBillItems(newBill);
            }
        } else if (e.key === 'Enter') {
            if (activeItemIndex >= 0 && itemSearchResults[activeItemIndex]) {
                const selectedItem = itemSearchResults[activeItemIndex];
                handleAddToBill(selectedItem);
                setBarcodeInput('');
                setShowItemDropdown(false);
                setActiveItemIndex(-1);
                const inlineSearchEl = document.getElementById('legacy-inline-search');
                if (inlineSearchEl) {
                    inlineSearchEl.focus();
                    inlineSearchEl.select?.();
                } else {
                    barcodeInputRef.current?.focus();
                }
            } else if (barcodeInput.trim()) {
                const query = barcodeInput.trim();
                handleBarcodeScan(query);
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
        const hasMb = (item.custom_boxes_per_master_box || 0) > 1;
        const totalMbPcs = (parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1);
        const uomOptions = `
            <option value="Nos">Nos (Each)</option>
            ${hasBox ? `<option value="Box">Box (${item.custom_pieces_per_box} pcs)</option>` : ''}
            ${hasMb ? `<option value="Master Box">Master Box (${totalMbPcs} pcs)</option>` : ''}
        `;

        let pinTimeout = null;

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
                <div style="margin-top: 14px;">
                    <label style="display:block;font-size:10px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">
                        Secret Code / Cashier PIN <span style="color: #ef4444;">*</span>
                    </label>
                    <input 
                        type="password" 
                        id="swal-mr-pin" 
                        placeholder="••••" 
                        maxlength="10" 
                        style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:16px;font-weight:900;color:#0f172a;letter-spacing:0.2em;outline:none;box-sizing:border-box;"
                        onfocus="this.style.borderColor='#f59e0b';"
                        onblur="this.style.borderColor='#e2e8f0';"
                    />
                    <div id="swal-mr-pin-status" style="margin-top: 6px; min-height: 24px;">
                        <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>
                    </div>
                </div>
            </div>`,
            showCancelButton: true,
            confirmButtonText: '📦 Verify & Submit Request',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#64748b',
            focusConfirm: false,
            didOpen: () => {
                const qtyInput = document.getElementById('swal-mr-qty');
                const pinInput = document.getElementById('swal-mr-pin');
                const statusBox = document.getElementById('swal-mr-pin-status');

                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }

                pinInput?.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    if (!val) {
                        statusBox.innerHTML = `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>`;
                        return;
                    }

                    statusBox.innerHTML = `<div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b;">⟳ Verifying PIN...</div>`;

                    clearTimeout(pinTimeout);
                    pinTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_collector_by_secret_code?secret_code=${encodeURIComponent(val)}`, {
                                credentials: 'include'
                            });
                            const json = await res.json();
                            const result = json.message || json;
                            if (result.status === 'success' && result.data) {
                                statusBox.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 8px; border-radius: 6px;">
                                        <span style="color: #059669; font-weight: 900; font-size: 12px;">✓</span>
                                        <div>
                                            <span style="font-size: 11px; font-weight: 800; color: #065f46;">${result.data.collector_name}</span>
                                            <span style="font-size: 10px; color: #047857; margin-left: 4px;">(${result.data.employee})</span>
                                        </div>
                                    </div>
                                `;
                            } else {
                                statusBox.innerHTML = `
                                    <div style="font-size: 11px; color: #ef4444; font-weight: 700; background: #fef2f2; border: 1px solid #fecaca; padding: 4px 8px; border-radius: 6px;">
                                        ✕ Invalid Secret Key — Employee Not Recognized
                                    </div>
                                `;
                            }
                        } catch (err) {
                            statusBox.innerHTML = `<div style="font-size: 11px; color: #ef4444; font-weight: 700;">Verification error</div>`;
                        }
                    }, 250);
                });
            },
            preConfirm: () => {
                const qty = parseInt(document.getElementById('swal-mr-qty')?.value);
                const uom = document.getElementById('swal-mr-uom')?.value;
                const pin = document.getElementById('swal-mr-pin')?.value;
                if (!qty || qty <= 0) {
                    Swal.showValidationMessage('Please enter a valid quantity (minimum 1)');
                    return false;
                }
                if (!pin || !pin.trim()) {
                    Swal.showValidationMessage('Secret Code / Cashier PIN is mandatory');
                    return false;
                }
                return { qty, uom, pin };
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
                        to_warehouse: warehouse || '',
                        secret_key: formValues.pin
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
                    throw new Error(res?.message || 'Failed to generate request');
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




    const toggleUom = (id, newUom, targetIndex = null) => {
        setBillItems(prev => prev.map((item, index) => {
            const matches = targetIndex !== null ? index === targetIndex : item.id === id;
            if (matches) {
                const ppb = parseFloat(item.custom_pieces_per_box) || 1;
                const bpm = parseFloat(item.custom_boxes_per_master_box) || 1;
                const totalMbPcs = ppb * bpm;
                const normUom = (newUom || '').toLowerCase();
                const isMasterBox = normUom === 'master box';
                const isBox = normUom === 'box';

                // --- Stock Verification ---
                const factor = isMasterBox ? totalMbPcs : (isBox ? ppb : 1);
                const totalPiecesNeeded = item.qty * factor;

                if (totalPiecesNeeded > item.local_qty) {
                    Swal.fire('Out of Stock', `Insufficient stock to switch. Needed: ${totalPiecesNeeded}, Available: ${item.local_qty}`, 'warning');
                    return item;
                }

                // Standard UOM toggle logic - set price based on UOM or keep base price
                const originalSinglePrice = item.base_unit_price || item.prices?.Piece || item.prices?.Nos || (item.uom === 'Box' ? (item.price / ppb) : (item.uom === 'Master Box' ? (item.price / totalMbPcs) : item.price));
                const hasValidBoxPrice = item.prices?.Box && item.prices.Box > 0;
                const hasValidMasterBoxPrice = (item.prices?.['Master Box'] || item.custom_master_box_price || item.custom_master_box_selling_price) > 0;

                let newPrice = originalSinglePrice;
                let actualUomName = 'Nos';

                if (isMasterBox) {
                    actualUomName = 'Master Box';
                    newPrice = hasValidMasterBoxPrice
                        ? parseFloat(item.prices?.['Master Box'] || item.custom_master_box_price || item.custom_master_box_selling_price)
                        : (originalSinglePrice * totalMbPcs);
                } else if (isBox) {
                    actualUomName = 'Box';
                    newPrice = hasValidBoxPrice
                        ? parseFloat(item.prices.Box)
                        : (originalSinglePrice * ppb);
                } else {
                    actualUomName = item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece');
                    newPrice = item.prices?.[actualUomName] || originalSinglePrice;
                }

                return { ...item, uom: actualUomName, price: newPrice, base_unit_price: originalSinglePrice };
            }
            return item;
        }));
    };

    const handleUomBtnKeyDown = (e, itemId) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const activeItem = billItems.find(it => it.id === itemId);
            if (activeItem) {
                const curUom = (activeItem.uom || '').toLowerCase();
                const hasBox = (activeItem.custom_pieces_per_box || 0) > 1;
                const hasMb = (activeItem.custom_boxes_per_master_box || 0) > 1;
                let nextUom = 'Nos';
                if (curUom === 'nos' || curUom === 'piece') {
                    nextUom = hasBox ? 'Box' : (hasMb ? 'Master Box' : 'Nos');
                } else if (curUom === 'box') {
                    nextUom = hasMb ? 'Master Box' : 'Nos';
                } else {
                    nextUom = 'Nos';
                }
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

    const handlePriceBlur = (e, item, idx) => {
        const inputVal = e?.target?.value !== undefined ? e.target.value : item._price_input_val;
        if (inputVal === undefined || inputVal === '') return;
        const sellVal = parseFloat(inputVal) || 0;
        const isBox = item.uom === 'Box' || item.uom === 'BOX';
        const factor = isBox ? (item.custom_pieces_per_box || 1) : 1;
        
        // Find accurate buying price from item or master items list (Items state)
        const masterItem = (Items || filteredItems || []).find(it => it.id === item.id || it.item_code === item.id || it.name === item.name);
        const whDetail = (item.warehouse_details || masterItem?.warehouse_details || []).find(w => (w.warehouse || w.warehouse_name) === warehouse);
        
        let minBuyRate = 0;
        if (isBox) {
            const buyPriceBox = parseFloat(item.buying_prices?.Box || masterItem?.buying_prices?.Box || 0);
            if (buyPriceBox > 0) {
                minBuyRate = buyPriceBox;
            } else {
                const buyPriceNos = parseFloat(item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
                minBuyRate = buyPriceNos * factor;
            }
        } else {
            const buyPriceNos = parseFloat(item.buying_prices?.Nos || item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
            minBuyRate = buyPriceNos;
        }

        if (sellVal > 0 && minBuyRate > 0 && sellVal < minBuyRate) {
            // Revert back to default / previous valid price
            const defaultSinglePrice = item.base_unit_price || item.prices?.Piece || item.prices?.Nos || masterItem?.price || minBuyRate;
            const fallbackPrice = isBox
                ? (item.prices?.Box || (defaultSinglePrice * factor))
                : defaultSinglePrice;

            setBillItems(prev => prev.map((i, iIdx) => {
                if (iIdx === idx || i.id === item.id) {
                    const updated = { ...i, _price_input_val: undefined, price: fallbackPrice };
                    if (i.uom === 'Box') {
                        return { ...updated, prices: { ...i.prices, Box: fallbackPrice }, base_unit_price: fallbackPrice / factor };
                    } else {
                        return { ...updated, prices: { ...i.prices, Nos: fallbackPrice, Piece: fallbackPrice }, base_unit_price: fallbackPrice };
                    }
                }
                return i;
            }));

            if (e?.target) {
                e.target.value = fallbackPrice.toFixed(2);
            }

            Swal.fire({
                icon: 'error',
                title: isBox ? 'Box Price Restriction Warning' : 'Price Restriction Warning',
                html: `Row #${idx + 1} (${item.item_name || item.name || item.id}):<br/>` +
                    `${isBox ? 'Box ' : ''}Selling Price (<b>AED ${sellVal.toFixed(2)}</b>) cannot be LESS than ${isBox ? 'Box ' : ''}Buying Rate (<b>AED ${minBuyRate.toFixed(2)}</b>)!<br/><br/>` +
                    `<i>Entered value has been reset to AED ${fallbackPrice.toFixed(2)}.</i>`,
                confirmButtonColor: '#ef4444'
            });
        }
    };

    // Category slider
    const groupCategories = (cats, size) => {
        const groups = [];
        for (let i = 0; i < cats.length; i += size) groups.push(cats.slice(i, i + size));
        return groups;
    };
    const groupedCategories = groupCategories(filteredCategories, 4);
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

    // Helper: calculate total bill selling vs total bill cost
    const getBillCostDetails = useCallback(() => {
        let totalSelling = 0;
        let totalCost = 0;
        const itemBreakdown = [];

        billItems.forEach((item, idx) => {
            const isBox = item.uom === 'Box' || item.uom === 'BOX';
            const factor = isBox ? (item.custom_pieces_per_box || 1) : 1;
            const masterItem = (Items || filteredItems || []).find(it => it.id === item.id || it.item_code === item.id || it.name === item.name);
            const whDetail = (item.warehouse_details || masterItem?.warehouse_details || []).find(w => (w.warehouse || w.warehouse_name) === warehouse);

            let minBuyRate = 0;
            if (isBox) {
                const buyPriceBox = parseFloat(item.buying_prices?.Box || masterItem?.buying_prices?.Box || 0);
                if (buyPriceBox > 0) {
                    minBuyRate = buyPriceBox;
                } else {
                    const buyPriceNos = parseFloat(item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
                    minBuyRate = buyPriceNos * factor;
                }
            } else {
                const buyPriceNos = parseFloat(item.buying_prices?.Nos || item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
                minBuyRate = buyPriceNos;
            }

            const itemSellPrice = parseFloat(item.price || 0);
            const itemQty = parseFloat(item.qty || 1);
            const lineSelling = itemSellPrice * itemQty;
            const lineCost = minBuyRate * itemQty;

            totalSelling += lineSelling;
            totalCost += lineCost;

            itemBreakdown.push({
                idx,
                item,
                isBox,
                factor,
                itemSellPrice,
                itemQty,
                lineSelling,
                minBuyRate,
                lineCost,
                marginPerUnit: itemSellPrice - minBuyRate,
                totalMargin: lineSelling - lineCost
            });
        });

        const maxAllowedTotalDiscount = Math.max(0, totalSelling - totalCost);
        return { totalSelling, totalCost, maxAllowedTotalDiscount, itemBreakdown };
    }, [billItems, Items, filteredItems, warehouse]);

    // Discount
    const applyDiscountHandler = async () => {
        const value = parseFloat(discountInput) || 0;
        if (value > 0) {
            if (loyaltyAmount > 0) {
                Swal.fire('Error', 'Cannot apply discount when loyalty points are redeemed. Reset loyalty first.', 'error');
                return;
            }

            // Calculate Effective Discount Percentage on Total Selling
            const totalSelling = billItems.reduce((sum, it) => sum + (parseFloat(it.price || 0) * parseFloat(it.qty || 1)), 0);
            const calcDiscountAmt = (discount.type === 'percentage' || discount.type === 'percent')
                ? (totalSelling * value) / 100
                : value;

            // RULE 3: ABSOLUTE FLOOR RESTRICTION (Purchase Price takes absolute priority)
            // Even with Manager Secret Key, final selling price CANNOT be lower than Buying Cost
            const costDetails = getBillCostDetails();
            if (costDetails.totalCost > 0 && (totalSelling - calcDiscountAmt) < costDetails.totalCost) {
                const maxAllowedDisc = Math.max(0, totalSelling - costDetails.totalCost);
                Swal.fire({
                    icon: 'error',
                    title: 'Absolute Price Restriction Error',
                    html: `<b>Sale Below Purchase Price is STRICTLY PROHIBITED!</b><br/><br/>` +
                        `Cart Selling Value: <b>AED ${totalSelling.toFixed(2)}</b><br/>` +
                        `Cart Buying Cost: <b>AED ${costDetails.totalCost.toFixed(2)}</b><br/>` +
                        `Entered Discount: <b>AED ${calcDiscountAmt.toFixed(2)}</b><br/><br/>` +
                        `Final Sale Amount (AED ${(totalSelling - calcDiscountAmt).toFixed(2)}) is LESS than Purchase Cost (AED ${costDetails.totalCost.toFixed(2)})!<br/><br/>` +
                        `<i>Maximum allowable discount is <b>AED ${maxAllowedDisc.toFixed(2)}</b>. No Secret Key or Manager override can bypass this rule.</i>`,
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            let effectivePct = 0;
            if (discount.type === 'percentage' || discount.type === 'percent') {
                effectivePct = value;
            } else {
                effectivePct = totalSelling > 0 ? (value / totalSelling) * 100 : 0;
            }

            // 10% Threshold Rule:
            // If discount is > 10%, Secret Key is mandatory.
            // If discount is <= 10%, no Secret Key is required.
            const requiresAuth = effectivePct > 10.0;

            if (requiresAuth) {
                if (!secretKeyInput || secretKeyInput.trim() === '') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Authorization Required',
                        text: `Discounts greater than 10% (${effectivePct.toFixed(1)}%) require a Manager Secret Key. Please enter the Secret Key.`,
                        confirmButtonColor: '#2563eb'
                    });
                    setTimeout(() => {
                        document.getElementById('cashier-secret-key-input')?.focus();
                    }, 100);
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
            } else {
                // <= 10% Discount: No secret key required, record current logged in cashier/user
                const cashierDisplay = user ? (user.includes('@') ? user.split('@')[0] : user) : "Cashier";
                setDiscountAuthorizedBy(`Cashier: ${cashierDisplay} (Standard <=10%)`);
            }
        } else {
            setDiscountAuthorizedBy("");
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
        setDeliveryFee('');
        setShowDeliveryFee(false);
        setInstapayServiceFee('');
    }, []);

    // Dynamic Loyalty Program Details Fetcher
    const [loyaltyProgramConfig, setLoyaltyProgramConfig] = useState({ conversion_factor: 0.01, max_loyalty_redemption_amount: 0 });

    const fetchLoyaltyProgramDetails = async (customerName) => {
        if (!customerName) return;
        try {
            if (navigator.onLine) {
                const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_loyalty_program_details', {
                    params: { customer: customerName, warehouse },
                    withCredentials: true
                });
                if (res.data?.message) {
                    const config = res.data.message;
                    setLoyaltyProgramConfig(config);
                    localStorage.setItem(`loyalty_config_${customerName}`, JSON.stringify(config));
                }
            } else {
                const cached = localStorage.getItem(`loyalty_config_${customerName}`);
                if (cached) {
                    setLoyaltyProgramConfig(JSON.parse(cached));
                }
            }
        } catch (err) {
            console.error('Error fetching loyalty program details:', err);
        }
    };

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
        // Fetch dynamic loyalty program details if online
        if (selectedCustomer.name) {
            fetchLoyaltyProgramDetails(selectedCustomer.name);
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

        // Dynamic conversion factor from ERPNext backend
        const factor = loyaltyProgramConfig?.conversion_factor || 0.01;
        const LOYALTY_RATE = factor <= 1.0 ? factor : (1.0 / factor);
        const redeemedValue = parseFloat((points * LOYALTY_RATE).toFixed(2));

        if (redeemedValue > subtotal) {
            Swal.fire('Error', 'Redemption amount cannot exceed subtotal.', 'error');
            return;
        }

        // Maximum Redemption Limit Validation (from ERPNext settings / local storage fallback)
        const maxRedeemLimit = loyaltyProgramConfig?.max_loyalty_redemption_amount || parseFloat(localStorage.getItem('max_loyalty_redemption_amount') || 0);
        if (maxRedeemLimit > 0 && redeemedValue > maxRedeemLimit) {
            Swal.fire('Restricted', `Redemption amount (${redeemedValue.toFixed(2)} AED) exceeds maximum allowed limit of ${maxRedeemLimit.toFixed(2)} AED per transaction.`, 'warning');
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
    const handleCheckoutWithMode = async (mode) => {
        setCheckoutMode(mode);
        await handleCheckout();
    };

    // Checkout
    const handleCheckout = async () => {
        if (grandTotal <= 0) {
            Swal.fire('Info', 'No items in bill', 'info');
            return;
        }

        // Validate employee checkin status
        const employee = user?.employee_name || user?.name;
        if (employee) {
            try {
                Swal.fire({ title: 'Checking status...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const res = await axios.get(`${API_BASE}.get_employee_status`, { params: { employee } });
                Swal.close();
                if (res.data?.message?.status === 'success') {
                    if (res.data.message.data.current_status !== 'IN') {
                        Swal.fire('Access Denied', 'You must check in through the Administrator Dashboard before you can process Sales Invoices.', 'error');
                        return;
                    }
                }
            } catch (err) {
                Swal.close();
                console.error("Checkin status error", err);
            }
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
                    custom_boxes_per_master_box: item.custom_boxes_per_master_box || 1,
                    rate: discRate,
                    price_list_rate: discRate,
                    income_account: 'Sales of I/C - KSPL',
                    warehouse: warehouse
                };
            }),
            company,
            pos_profile: posProfile,
            warehouse: warehouse,
            delivery_fee: parseFloat(deliveryFee) || 0,
            instapay_service_fee: parseFloat(instapayServiceFee) || 0,
            instapay_tax_inclusive: instapayTaxInclusive ? 1 : 0,
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
                        custom_boxes_per_master_box: item.custom_boxes_per_master_box || catalogItem?.custom_boxes_per_master_box || 1,
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
            setActiveDraftIndex(0);
        }
    }, [showDraftsModal]);

    useEffect(() => {
        if (showDraftsModal && activeDraftIndex >= 0) {
            const el = document.getElementById(`draft-card-${activeDraftIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [activeDraftIndex, showDraftsModal]);

    useEffect(() => {
        if (showDropdown && activeCustomerIndex >= 0) {
            const el = document.getElementById(`cust-item-0-${activeCustomerIndex}`) ||
                document.getElementById(`cust-item-1-${activeCustomerIndex}`) ||
                document.getElementById(`cust-item-2-${activeCustomerIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [activeCustomerIndex, showDropdown]);

    useEffect(() => {
        if (showPaymentModal) {
            POSService.getDrivers().then(res => {
                const driversList = (res && res.message) ? res.message : res;
                if (Array.isArray(driversList)) {
                    setDrivers(driversList);
                }
            }).catch(err => console.error("Error fetching drivers:", err));
        } else {
            setSelectedDriver('');
        }
    }, [showPaymentModal]);

    // ---------- COMPLETE PAYMENT ----------
    const completePayment = async (directMode = null, directRefNo = '') => {
        if (typeof directMode !== 'string') directMode = null;
        if (paymentLoading) return;

        // Rule 1 & Rule 3: Strictly validate that Selling Price (and Net Price after discount) is NOT lower than Buying Price
        let totalCartBuyingCost = 0;
        let totalCartSellingVal = 0;

        for (let idx = 0; idx < billItems.length; idx++) {
            const item = billItems[idx];
            const isBox = item.uom === 'Box' || item.uom === 'BOX';
            const factor = isBox ? (item.custom_pieces_per_box || 1) : 1;
            
            const masterItem = (Items || filteredItems || []).find(it => it.id === item.id || it.item_code === item.id || it.name === item.name);
            const whDetail = (item.warehouse_details || masterItem?.warehouse_details || []).find(w => (w.warehouse || w.warehouse_name) === warehouse);
            
            let minBuyRate = 0;
            if (isBox) {
                const buyPriceBox = parseFloat(item.buying_prices?.Box || masterItem?.buying_prices?.Box || 0);
                if (buyPriceBox > 0) {
                    minBuyRate = buyPriceBox;
                } else {
                    const buyPriceNos = parseFloat(item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
                    minBuyRate = buyPriceNos * factor;
                }
            } else {
                const buyPriceNos = parseFloat(item.buying_prices?.Nos || item.buying_price || item.buy_price || whDetail?.buying_price || masterItem?.buying_price || masterItem?.valuation_rate || item.valuation_rate || 0);
                minBuyRate = buyPriceNos;
            }
            const sellPrice = parseFloat(item.price || 0);
            const itemQty = parseFloat(item.qty || 1);

            totalCartBuyingCost += (minBuyRate * itemQty);
            totalCartSellingVal += (sellPrice * itemQty);

            // Rule 1: Item unit price check
            if (sellPrice > 0 && minBuyRate > 0 && sellPrice < minBuyRate) {
                Swal.fire({
                    icon: 'error',
                    title: isBox ? 'Box Price Restriction Error' : 'Price Restriction Error',
                    html: `Row #${idx + 1} (<b>${item.name || item.id}</b>):<br/>` +
                        `${isBox ? 'Box ' : ''}Selling Price (<b>AED ${sellPrice.toFixed(2)}</b>) cannot be LESS than ${isBox ? 'Box ' : ''}Buying Rate (<b>AED ${minBuyRate.toFixed(2)}</b>)!<br/><br/>` +
                        `Please adjust the item rate before completing the payment.`,
                    confirmButtonColor: '#ef4444'
                });
                return;
            }
        }

        // Rule 3: Final Invoice Amount after discount vs Total Buying Cost
        if (discountAmount > 0 && totalCartBuyingCost > 0 && (totalCartSellingVal - discountAmount) < totalCartBuyingCost) {
            Swal.fire({
                icon: 'error',
                title: 'Absolute Price Restriction Error',
                html: `<b>Payment Blocked: Final Selling Total is Less than Buying Cost!</b><br/><br/>` +
                    `Cart Total: <b>AED ${totalCartSellingVal.toFixed(2)}</b><br/>` +
                    `Discount: <b>AED ${discountAmount.toFixed(2)}</b><br/>` +
                    `Final Payable: <b>AED ${(totalCartSellingVal - discountAmount).toFixed(2)}</b><br/>` +
                    `Purchase Cost: <b>AED ${totalCartBuyingCost.toFixed(2)}</b><br/><br/>` +
                    `<i>Sale below purchase price is strictly forbidden by policy. Please reduce or remove the discount.</i>`,
                confirmButtonColor: '#ef4444'
            });
            setPaymentLoading(false);
            return;
        }

        // 10% Discount Threshold Authorization Validation
        const totalCartSelling = billItems.reduce((sum, it) => sum + (parseFloat(it.price || 0) * parseFloat(it.qty || 1)), 0);
        const effectiveDiscPct = totalCartSelling > 0 ? (discountAmount / totalCartSelling) * 100 : 0;
        
        if (effectiveDiscPct > 10.0 && (!discountAuthorizedBy || discountAuthorizedBy.includes("Standard"))) {
            Swal.fire({
                icon: 'warning',
                title: 'Discount Authorization Required',
                text: `The invoice has a discount of ${effectiveDiscPct.toFixed(1)}% (> 10%). Please open the Discount modal (F1) and enter the Manager Secret Key before completing payment.`,
                confirmButtonColor: '#2563eb'
            });
            setPaymentLoading(false);
            return;
        }

        // Prompt for Reference No for Direct Bank
        if (directMode === 'Bank' && !directRefNo) {
            const { value: refInput, isDismissed } = await Swal.fire({
                title: 'Bank Reference / Txn ID',
                input: 'text',
                inputLabel: 'Enter Bank Reference / Transaction ID / Slip No:',
                inputPlaceholder: 'e.g. UTR / Auth / Ref No (Optional)',
                showCancelButton: true,
                confirmButtonText: 'Confirm & Pay',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#0ea5e9'
            });
            if (isDismissed) return;
            directRefNo = refInput ? refInput.trim() : '';
        }

        let finalPayments = [];

        if (directMode) {
            finalPayments.push({
                mode_of_payment: directMode,
                amount: round2(grandTotal),
                reference_no: directRefNo || ''
            });
        } else {
            finalPayments = [...payments];
            // AUTO-CAPTURE: If there's an amount entered but not added to list, include it
            const amt = parseFloat(tenderedAmount) || 0;
            if (selectedPaymentMode && amt > 0) {
                finalPayments.push({
                    mode_of_payment: selectedPaymentMode,
                    amount: round2(amt),
                    reference_no: paymentReferenceNo ? paymentReferenceNo.trim() : ''
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

        // Card Terminal Interceptor: Require card machine authorization before invoice creation
        const cardPaymentItem = finalPayments.find(p => p.mode_of_payment === 'Card' || p.mode_of_payment === 'Credit Card');
        if (cardPaymentItem && !cardPaymentItem.approval_code) {
            setCardTerminalAmount(cardPaymentItem.amount || grandTotal);
            setShowCardTerminalModal(true);
            return; // Intercept & wait for terminal authorization!
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
                const itemRate = item.price;
                return {
                    item_code: item.id,
                    item_name: item.name,
                    quantity: item.qty,
                    uom: item.uom,
                    uom_type: item.uom,
                    is_tax_inclusive: item.is_tax_inclusive !== false,
                    custom_pieces_per_box: item.custom_pieces_per_box,
                    custom_boxes_per_master_box: item.custom_boxes_per_master_box || 1,
                    basePrice: itemRate,
                    rate: itemRate,
                    price_list_rate: itemRate,
                    income_account: 'Sales of I/C - KSPL',
                    warehouse: warehouse,
                    sales_order: item.sales_order || null,
                    so_detail: item.so_detail || null,
                    custom_job_barcode: item.custom_job_barcode || null
                };
            }),
            company,
            pos_profile: posProfile,
            warehouse: warehouse,
            delivery_fee: parseFloat(deliveryFee) || 0,
            custom_delivery_driver: selectedDriver || null,
            instapay_service_fee: parseFloat(instapayServiceFee) || 0,
            instapay_tax_inclusive: instapayTaxInclusive ? 1 : 0,
            pos_opening_entry: posOpeningEntry,
            payments: finalPayments.map(p => ({
                mode_of_payment: p.mode_of_payment,
                amount: parseFloat(p.amount.toFixed(2)),
                reference_no: p.reference_no || ''
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

                const custDisplayName = selectedCustomer?.customer_name || selectedCustomer?.name || (customerName && customerName !== 'Cash' ? customerName : 'Cash');
                const custMobile = phoneNumber || selectedCustomer?.mobile_no || '';

                const printData = {
                    name: serverName,
                    customer: customerId,
                    customer_name: custDisplayName,
                    contact_mobile: custMobile,
                    grand_total: grandTotal,
                    subtotal: subtotal,
                    discount_amount: discountAmount,
                    tax_amount: taxAmount,
                    posting_date: format(new Date(), 'yyyy-MM-dd'),
                    posting_time: format(new Date(), 'HH:mm:ss'),
                    items: [...billItems],
                    payments: [...finalPayments],
                    loyalty: loyaltyData
                };
                setLastInvoiceData(printData);

                if (checkoutMode === 'print') {
                    handlePrint(printData);
                    Swal.fire({
                        icon: 'success',
                        title: isSuccess && String(data.message || data.name || "").includes("Duplicate") ? 'Already Sync Verified' : 'Invoice Created',
                        text: `Invoice: ${serverName} | Total: AED ${grandTotal.toFixed(2)}`,
                        showCancelButton: false,
                        confirmButtonText: 'Done',
                        confirmButtonColor: '#16a34a',
                        focusConfirm: true
                    }).then(() => {
                        setTimeout(() => {
                            barcodeInputRef.current?.focus();
                        }, 100);
                    });
                } else if (checkoutMode === 'no-print') {
                    Swal.fire({
                        icon: 'success',
                        title: isSuccess && String(data.message || data.name || "").includes("Duplicate") ? 'Already Sync Verified' : 'Invoice Created',
                        text: `Invoice: ${serverName} | Total: AED ${grandTotal.toFixed(2)}`,
                        showCancelButton: false,
                        confirmButtonText: 'Done',
                        confirmButtonColor: '#16a34a',
                        focusConfirm: true
                    }).then(() => {
                        setTimeout(() => {
                            barcodeInputRef.current?.focus();
                        }, 100);
                    });
                } else if (checkoutMode === 'print-a4') {
                    handlePrintA4(printData);
                    Swal.fire({
                        icon: 'success',
                        title: isSuccess && String(data.message || data.name || "").includes("Duplicate") ? 'Already Sync Verified' : 'Invoice Created',
                        text: `Invoice: ${serverName} | Total: AED ${grandTotal.toFixed(2)}`,
                        showCancelButton: false,
                        confirmButtonText: 'Done',
                        confirmButtonColor: '#16a34a',
                        focusConfirm: true
                    }).then(() => {
                        setTimeout(() => {
                            barcodeInputRef.current?.focus();
                        }, 100);
                    });
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: isSuccess && String(data.message || data.name || "").includes("Duplicate") ? 'Already Sync Verified' : 'Invoice Created',
                        text: `Invoice: ${serverName} | Total: AED ${grandTotal.toFixed(2)}`,
                        showCancelButton: true,
                        confirmButtonText: 'Done',
                        cancelButtonText: 'Print Receipt',
                        confirmButtonColor: '#16a34a',
                        cancelButtonColor: '#3b82f6',
                        focusConfirm: true
                    }).then((res) => {
                        if (res.dismiss === 'cancel') {
                            handlePrint(printData);
                        }
                        setTimeout(() => {
                            barcodeInputRef.current?.focus();
                        }, 100);
                    });
                }

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
                finalizeOrder(false);
            } else {
                // Fallback to offline if server returns a handled error (like duplicate but not success)
                throw new Error(data.message || "Server rejection. Saving to offline queue.");
            }
        } catch (e) {
            console.error("Order Submission Error:", e);
            if (isOffline) {
                await db.invoices.add({ ...payload, is_synced: 0, grand_total: grandTotal });
                const custDisplayName = selectedCustomer?.customer_name || selectedCustomer?.name || (customerName && customerName !== 'Cash' ? customerName : 'Cash');
                const custMobile = phoneNumber || selectedCustomer?.mobile_no || '';

                const offlinePrintData = {
                    name: offlineId,
                    customer: customerId,
                    customer_name: custDisplayName,
                    contact_mobile: custMobile,
                    grand_total: grandTotal,
                    subtotal: subtotal,
                    discount_amount: discountAmount,
                    tax_amount: taxAmount,
                    posting_date: format(new Date(), 'yyyy-MM-dd'),
                    posting_time: format(new Date(), 'HH:mm:ss'),
                    items: [...billItems],
                    payments: [...finalPayments],
                    loyalty: null
                };
                setLastInvoiceData(offlinePrintData);
                if (checkoutMode === 'print') {
                    handlePrint(offlinePrintData);
                } else if (checkoutMode === 'print-a4') {
                    handlePrintA4(offlinePrintData);
                }
                Swal.fire({
                    icon: 'info',
                    title: 'Saved Offline',
                    text: `The server reported an error (${e.message || e}). We have saved this invoice locally. It will sync automatically when possible.`,
                    confirmButtonColor: '#3b82f6',
                    focusConfirm: true
                }).then(() => {
                    setTimeout(() => {
                        barcodeInputRef.current?.focus();
                    }, 100);
                });
                finalizeOrder(false);
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

                        let resolvedEmpData = null;
                        let pinTimeout = null;

                        const { value: formValues } = await Swal.fire({
                            title: 'Request Details',
                            html: `
                                <div style="text-align: left; margin-bottom: 12px;">
                                    <label style="font-weight: 700; font-size: 13px; color: #475569;">Quantity</label>
                                    <input type="number" id="swal-input-qty" class="swal2-input" value="1" min="1" style="margin: 8px 0; width: 100%; box-sizing: border-box;">
                                </div>
                                <div style="text-align: left; margin-bottom: 14px;">
                                    <label style="font-weight: 700; font-size: 13px; color: #475569;">UOM</label>
                                    <select id="swal-input-uom" class="swal2-select" style="margin: 8px 0; width: 100%; box-sizing: border-box; height: 48px;">
                                        ${uomSelectHtml}
                                    </select>
                                </div>
                                <div style="text-align: left;">
                                    <label style="font-weight: 700; font-size: 13px; color: #1e293b; display: block; margin-bottom: 4px;">
                                        Secret Code / Cashier PIN <span style="color: #ef4444;">*</span>
                                    </label>
                                    <input type="password" id="swal-input-pin" class="swal2-input" placeholder="••••" maxlength="10" style="margin: 0; width: 100%; box-sizing: border-box; height: 44px; font-size: 16px; letter-spacing: 0.25em;">
                                    
                                    <div id="swal-pin-status" style="margin-top: 8px; min-height: 28px;">
                                        <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>
                                    </div>
                                </div>
                            `,
                            focusConfirm: false,
                            showCancelButton: true,
                            confirmButtonText: 'Verify & Submit Request',
                            confirmButtonColor: '#2563eb',
                            cancelButtonText: 'Cancel',
                            didOpen: () => {
                                const pinInput = document.getElementById('swal-input-pin');
                                const statusBox = document.getElementById('swal-pin-status');
                                const confirmBtn = Swal.getConfirmButton();

                                pinInput.addEventListener('input', (e) => {
                                    const val = e.target.value.trim();
                                    resolvedEmpData = null;

                                    if (!val) {
                                        statusBox.innerHTML = `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>`;
                                        return;
                                    }

                                    statusBox.innerHTML = `
                                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                                            <span style="display: inline-block;">⟳</span> Verifying PIN...
                                        </div>
                                    `;

                                    clearTimeout(pinTimeout);
                                    pinTimeout = setTimeout(async () => {
                                        try {
                                            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_collector_by_secret_code?secret_code=${encodeURIComponent(val)}`, {
                                                credentials: 'include'
                                            });
                                            const json = await res.json();
                                            const result = json.message || json;
                                            if (result.status === 'success' && result.data) {
                                                resolvedEmpData = result.data;
                                                statusBox.innerHTML = `
                                                    <div style="display: flex; align-items: center; gap: 8px; background: #ecfdf5; border: 1.5px solid #a7f3d0; padding: 6px 10px; border-radius: 8px;">
                                                        <div style="width: 20px; height: 20px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">✓</div>
                                                        <div>
                                                            <div style="font-size: 12px; font-weight: 800; color: #065f46;">${result.data.collector_name}</div>
                                                            <div style="font-size: 10px; color: #047857;">Authorized Cashier (${result.data.employee})</div>
                                                        </div>
                                                    </div>
                                                `;
                                            } else {
                                                statusBox.innerHTML = `
                                                    <div style="font-size: 11px; color: #ef4444; font-weight: 700; background: #fef2f2; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px;">
                                                        ✕ Invalid Secret Key — Employee Not Recognized
                                                    </div>
                                                `;
                                            }
                                        } catch (err) {
                                            statusBox.innerHTML = `
                                                <div style="font-size: 11px; color: #ef4444; font-weight: 700;">
                                                    Verification error
                                                </div>
                                            `;
                                        }
                                    }, 250);
                                });
                            },
                            preConfirm: () => {
                                const qty = document.getElementById('swal-input-qty').value;
                                const uom = document.getElementById('swal-input-uom').value;
                                const pin = document.getElementById('swal-input-pin').value;
                                if (!qty || parseFloat(qty) <= 0) {
                                    Swal.showValidationMessage('Please enter a valid quantity');
                                    return false;
                                }
                                if (!pin || !pin.trim()) {
                                    Swal.showValidationMessage('Secret Code / Cashier PIN is mandatory');
                                    return false;
                                }
                                return { qty, uom, pin };
                            }
                        });

                        if (formValues) {
                            const { qty, uom, pin } = formValues;
                            Swal.fire({ title: 'Creating Material Request...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                            try {
                                const res = await frappeCall({
                                    method: 'kyle_retail.retail_api.api.create_draft_material_request',
                                    args: {
                                        item_code: itemCode,
                                        qty: parseFloat(qty),
                                        from_warehouse: fromWh,
                                        to_warehouse: toWh,
                                        uom: uom,
                                        secret_key: pin
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

    const finalizeOrder = (shouldFocusBarcode = true) => {
        setCheckoutMode('normal');
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
        setDeliveryFee('');
        setShowDeliveryFee(false);
        setInstapayServiceFee('');
        setPayments([]);
        setShowPaymentModal(false);
        if (shouldFocusBarcode) {
            barcodeInputRef.current?.focus();
        }

        if (offlineIdType === 'continuous') {
            const nextCount = continuousOrderCount + 1;
            setContinuousOrderCount(nextCount);
            localStorage.setItem('offlineIdContinuousCount', nextCount.toString());
        }
    };

    // ---------- SPEED CHECKOUT & KEYBOARD SHORTCUTS ----------
    const handleMobileEnter = async (e) => {
        if (showDropdown && searchResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveCustomerIndex(prev => prev === -1 ? 0 : Math.min(prev + 1, searchResults.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveCustomerIndex(prev => prev === -1 ? searchResults.length - 1 : Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowDropdown(false);
                setActiveCustomerIndex(-1);
                return;
            }
            if (e.key === 'Enter') {
                if (activeCustomerIndex >= 0 && searchResults[activeCustomerIndex]) {
                    e.preventDefault();
                    pickCustomer(searchResults[activeCustomerIndex]);
                    setActiveCustomerIndex(-1);
                    return;
                }
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const rawTerm = (customerMobile || customerName).trim();
            if (!rawTerm || rawTerm === 'Cash') return;

            // Priority 0: Check if scanned value is an item barcode or item code (Local Cache)
            if (isItemBarcode(rawTerm)) {
                setSearchResults([]);
                setShowDropdown(false);
                setCustomerName('Cash');
                setCustomerMobile('');
                handleBarcodeScan(rawTerm);
                return;
            }

            // Priority 0.5: Quick Remote check if this is an Item Barcode from Backend before treating as customer
            try {
                const itemCheck = await frappeCall({
                    method: 'kyle_retail.retail_api.api.get_retail_item_details',
                    args: { search_term: rawTerm, warehouse: warehouse }
                });
                if (itemCheck && itemCheck.length > 0) {
                    setSearchResults([]);
                    setShowDropdown(false);
                    setCustomerName('Cash');
                    setCustomerMobile('');
                    handleBarcodeScan(rawTerm);
                    return;
                }
            } catch (err) {
                console.warn('Item barcode check fallback error:', err);
            }

            // Strip any country code prefix to get bare local number
            const strippedNumber = stripCountryPrefix(rawTerm);

            // The lookup term: use stripped if it's a valid number, otherwise use raw
            const searchTerm = /^\d{6,}$/.test(strippedNumber) ? strippedNumber : rawTerm;

            // 1. Check for exact match in suggestions
            const exactMatch = searchResults.find(c =>
                c.customer_name.toLowerCase() === rawTerm.toLowerCase() ||
                (c.mobile_no && c.mobile_no.replace(/\D/g, '').endsWith(strippedNumber))
            );
            if (exactMatch) {
                pickCustomer(exactMatch);
                const Toast = Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true,
                });
                Toast.fire({ icon: 'success', title: `Customer: ${exactMatch.customer_name}` });
                return;
            }

            // 2. If it looks like a mobile number, use speed checkout logic
            if (/^\d{6,}$/.test(strippedNumber) || /^\d{6,}$/.test(rawTerm.replace(/\D/g, ''))) {
                const fullMobile = strippedNumber || rawTerm.replace(/\D/g, '');
                const rule = getCountryRule(countryCodePrefix);
                if (fullMobile.length < rule.minLen || fullMobile.length > rule.maxLen) {
                    const rangeStr = rule.minLen === rule.maxLen ? `${rule.minLen}` : `${rule.minLen}-${rule.maxLen}`;
                    Swal.fire('Validation Error', `${rule.country} (${countryCodePrefix}) mobile number must be ${rangeStr} digits.`, 'warning');
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
                // It's a name/non-numeric string, open the custom React modal to enter mobile number, TRN, and address details
                openCreate(rawTerm);
            }
        }
    };


    // ---------- MODAL RENDERERS (REUSABLE) ----------
    const renderItemDetailModal = () => {
        if (!selectedDetailItem) return null;
        const item = selectedDetailItem;
        const effectivePrice = item.price;
        const lineTotal = item.qty * effectivePrice;
        const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;
        const pcsQty = item.qty * factor;

        return (
            <div
                className="home-modal-overlay"
                onClick={() => setShowItemDetailModal(false)}
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
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: '780px',
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={16} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    {item.item_name || item.name}
                                </h3>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', fontFamily: 'monospace' }}>
                                    CODE: {item.name || item.item_code || item.id} {item.brand ? `· BRAND: ${item.brand}` : ''}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowItemDetailModal(false)}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto' }}>
                        
                        {/* Quick Metrics Bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Selected UOM</div>
                                <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{item.uom || 'Nos'}</div>
                            </div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Cart Qty</div>
                                <div style={{ fontSize: '13px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>{item.qty} {item.uom} <span style={{ fontSize: '10px', color: '#94a3b8' }}>({pcsQty} pcs)</span></div>
                            </div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Unit Rate</div>
                                <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{effectivePrice?.toFixed(2)} AED</div>
                            </div>
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Current Branch Stock</div>
                                <div style={{ fontSize: '13px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>{item.actual_qty || 0} pcs</div>
                            </div>
                        </div>

                        {/* Branch Stock & Pricing Table (Nearest Branch Locations) */}
                        {(() => {
                            const pcsPerBox = item.custom_pieces_per_box || item.pcs_per_box || 1;
                            const hasBox = pcsPerBox > 1;

                            // Build full list of branches by combining live nearbyBranches API results with item.warehouse_details
                            let combinedBranches = [];
                            if (nearbyBranches && nearbyBranches.length > 0) {
                                combinedBranches = nearbyBranches.map(nb => {
                                    const wh = nb.warehouse;
                                    const existingWh = (item.warehouse_details || []).find(w => (w.warehouse_name || w.warehouse) === wh);
                                    return {
                                        warehouse: wh,
                                        warehouse_name: wh,
                                        actual_qty: nb.qty !== undefined ? nb.qty : (existingWh?.actual_qty || 0),
                                        distance: nb.distance,
                                        buying_price: existingWh?.buying_price || existingWh?.buy_price || 0,
                                        selling_price: existingWh?.selling_price || existingWh?.sell_price || nb.price || effectivePrice || 0
                                    };
                                });
                            } else if (item.warehouse_details && item.warehouse_details.length > 0) {
                                combinedBranches = (item.warehouse_details || []).filter(d => {
                                    const whLower = (d.warehouse_name || d.warehouse || "").toLowerCase();
                                    return !["goods in transit", "finished goods", "work in progress", "stores"].some(term => whLower.includes(term));
                                });
                            }

                            // Always include current warehouse if not present
                            if (warehouse && !combinedBranches.some(b => (b.warehouse_name || b.warehouse) === warehouse)) {
                                combinedBranches.unshift({
                                    warehouse: warehouse,
                                    warehouse_name: warehouse,
                                    actual_qty: item.actual_qty || 0,
                                    distance: 0,
                                    buying_price: item.buying_price || 0,
                                    selling_price: effectivePrice || 0
                                });
                            }

                            // User Requirement:
                            // 1. Current Branch at top
                            // 2. Other branches: First Priority = Stock > 0 (descending stock), Next Priority = Nearest distance (ascending distance)
                            combinedBranches.sort((a, b) => {
                                const aWh = a.warehouse_name || a.warehouse || '';
                                const bWh = b.warehouse_name || b.warehouse || '';
                                const aIsCurrent = aWh === warehouse || (warehouse && aWh.toLowerCase().includes((warehouse || '').toLowerCase()));
                                const bIsCurrent = bWh === warehouse || (warehouse && bWh.toLowerCase().includes((warehouse || '').toLowerCase()));
                                if (aIsCurrent) return -1;
                                if (bIsCurrent) return 1;

                                const aQty = parseFloat(a.actual_qty || 0);
                                const bQty = parseFloat(b.actual_qty || 0);

                                // Stock available branches first
                                if (aQty > 0 && bQty <= 0) return -1;
                                if (bQty > 0 && aQty <= 0) return 1;

                                // If both have stock, sort by distance nearest first
                                const aDist = a.distance !== undefined && a.distance !== null ? parseFloat(a.distance) : 99999;
                                const bDist = b.distance !== undefined && b.distance !== null ? parseFloat(b.distance) : 99999;
                                return aDist - bDist;
                            });

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Package size={13} className="text-amber-500" />
                                            Nearest Stock Locations & Availability
                                            {nearbyBranchesLoading && (
                                                <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 700 }}>
                                                    (Updating...)
                                                </span>
                                            )}
                                        </span>
                                        {hasBox && (
                                            <span style={{ fontSize: '10px', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px' }}>
                                                1 Box = {pcsPerBox} Nos
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                                            <thead>
                                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase', fontSize: '10px', fontWeight: 900, color: '#475569' }}>
                                                    <th style={{ padding: '8px 12px' }}>Branch</th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'center' }}>Stock</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Buy Price {hasBox ? '(Nos / Box)' : ''}</th>
                                                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>Sell Price {hasBox ? '(Nos / Box)' : ''}</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {combinedBranches.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                                                            {nearbyBranchesLoading ? 'Checking branch stock...' : 'No branch details available.'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    combinedBranches.map((d, index) => {
                                                        const rawWh = d.warehouse_name || d.warehouse || '';
                                                        const branchName = getBranchName(rawWh);
                                                        const qty = parseFloat(d.actual_qty || 0);
                                                        const buyNos = parseFloat(d.buying_price || d.buy_price || 0);
                                                        const sellNos = parseFloat(d.selling_price || d.sell_price || 0);
                                                        const buyBox = buyNos * pcsPerBox;
                                                        const sellBox = sellNos * pcsPerBox;
                                                        const isCurrentBranch = rawWh === warehouse || (warehouse && rawWh.toLowerCase().includes((warehouse || '').toLowerCase()));
                                                        const canRequest = !isCurrentBranch && qty > 0;

                                                        return (
                                                            <tr
                                                                key={index}
                                                                style={{
                                                                    borderBottom: index !== combinedBranches.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                                    background: isCurrentBranch ? '#f0f9ff' : '#ffffff'
                                                                }}
                                                            >
                                                                <td style={{ padding: '8px 12px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontWeight: 800, color: isCurrentBranch ? '#0369a1' : '#1e293b' }}>{branchName}</span>
                                                                            {d.distance !== undefined && d.distance !== null && !isCurrentBranch && (
                                                                                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>
                                                                                    {d.distance} km away
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {isCurrentBranch && (
                                                                            <span style={{ fontSize: '8.5px', fontWeight: 900, background: '#0284c7', color: '#ffffff', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>Current</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontWeight: 800,
                                                                        fontSize: '11px',
                                                                        padding: '2px 8px',
                                                                        borderRadius: '4px',
                                                                        background: qty > 0 ? '#dcfce7' : '#f1f5f9',
                                                                        color: qty > 0 ? '#15803d' : '#64748b'
                                                                    }}>
                                                                        {qty} {item.stock_uom || item.uom || 'Nos'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                        <span style={{ fontWeight: 800, color: '#334155' }}>{buyNos > 0 ? buyNos.toFixed(2) : '—'}</span>
                                                                        {hasBox && buyNos > 0 && (
                                                                            <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>Box: {buyBox.toFixed(2)}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                                        <span style={{ fontWeight: 900, color: '#0284c7', fontSize: '12px' }}>{sellNos > 0 ? sellNos.toFixed(2) : '—'}</span>
                                                                        {hasBox && sellNos > 0 && (
                                                                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6' }}>Box: {sellBox.toFixed(2)}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                                                                    {canRequest ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setShowItemDetailModal(false);
                                                                                handleRequestStock(item, rawWh);
                                                                            }}
                                                                            style={{
                                                                                background: '#2563eb',
                                                                                color: '#ffffff',
                                                                                border: 'none',
                                                                                padding: '4px 10px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '10.5px',
                                                                                fontWeight: 800,
                                                                                cursor: 'pointer',
                                                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                                                                            onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                                                                            title={`Request Stock from ${branchName}`}
                                                                        >
                                                                        <span>Request</span>
                                                                        </button>
                                                                    ) : (
                                                                        <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 700 }}>—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Last 10 Sales Transactions for this Item (Customer Based) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={13} className="text-sky-600" />
                                    Last 10 Sales History
                                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748b', textTransform: 'none', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                        {selectedCustomer?.name || (customerName && customerName !== 'Cash' ? customerName : 'All Customers / Cash')}
                                    </span>
                                </span>
                                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8' }}>
                                    {itemSalesHistory.length} {itemSalesHistory.length === 1 ? 'sale' : 'sales'} found
                                </span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase', fontSize: '9.5px', fontWeight: 900, color: '#475569' }}>
                                            <th style={{ padding: '7px 10px' }}>Date</th>
                                            <th style={{ padding: '7px 10px' }}>Invoice No</th>
                                            {(!selectedCustomer || customerName === 'Cash') && (
                                                <th style={{ padding: '7px 10px' }}>Customer</th>
                                            )}
                                            <th style={{ padding: '7px 8px', textAlign: 'center' }}>Qty</th>
                                            <th style={{ padding: '7px 10px', textAlign: 'right' }}>Price (AED)</th>
                                            <th style={{ padding: '7px 12px', textAlign: 'right' }}>Total (AED)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemSalesHistoryLoading ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                                                    Loading sales history...
                                                </td>
                                            </tr>
                                        ) : itemSalesHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                                                    No prior sales history found for this item
                                                </td>
                                            </tr>
                                        ) : (
                                            itemSalesHistory.map((s, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{
                                                        borderBottom: idx !== itemSalesHistory.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                                                    }}
                                                >
                                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                                                        {s.posting_date ? String(s.posting_date).slice(0, 10) : '—'}
                                                    </td>
                                                    <td style={{ padding: '7px 10px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowItemDetailModal(false);
                                                                navigate(`/salesinvoice?name=${encodeURIComponent(s.invoice_name)}`, { state: { invoiceId: s.invoice_name, invoice_name: s.invoice_name } });
                                                            }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                padding: 0,
                                                                color: '#0284c7',
                                                                fontWeight: 800,
                                                                fontFamily: 'monospace',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px'
                                                            }}
                                                            title={`View Invoice ${s.invoice_name}`}
                                                        >
                                                            {s.invoice_name}
                                                            <ExternalLink size={11} className="text-sky-500" />
                                                        </button>
                                                    </td>
                                                    {(!selectedCustomer || customerName === 'Cash') && (
                                                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {s.customer_name || s.customer || 'Cash'}
                                                        </td>
                                                    )}
                                                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                                                        <span style={{ fontWeight: 800, background: '#f1f5f9', color: '#334155', padding: '1.5px 6px', borderRadius: '4px' }}>
                                                            {s.qty} {s.uom || 'Nos'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: '#334155' }}>
                                                        {parseFloat(s.rate || 0).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: '#0284c7' }}>
                                                        {parseFloat(s.amount || (s.qty * s.rate) || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => setShowItemDetailModal(false)}
                            style={{
                                padding: '6px 16px',
                                background: '#1e293b',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDiscountModal = () => {
        const { totalSelling, totalCost, maxAllowedTotalDiscount } = getBillCostDetails();
        const enteredVal = parseFloat(discountInput) || 0;
        const calcDiscountAmt = (discount.type === 'percentage' || discount.type === 'percent')
            ? (totalSelling * enteredVal) / 100
            : enteredVal;
        const finalEstPrice = Math.max(0, totalSelling - calcDiscountAmt);
        const isExceedingCost = totalCost > 0 && calcDiscountAmt > maxAllowedTotalDiscount;
        const maxPct = totalSelling > 0 ? ((maxAllowedTotalDiscount / totalSelling) * 100).toFixed(1) : 0;

        return (
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
                        maxWidth: '460px',
                        backgroundColor: '#ffffff',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
                        display: 'flex',
                        flexDirection: 'column',
                        margin: '20px',
                        border: '1px solid #e2e8f0'
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '38px', height: '38px', background: '#2563eb', color: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
                                <Percent size={18} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Apply Discount</h3>
                                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Validate rates & prevent cost loss</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDiscountModal(false)}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
                        
                        {/* Summary Metrics Box Layout */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 12px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bill Subtotal</span>
                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <DirhamIcon size={12} /> {totalSelling.toFixed(2)}
                                </span>
                            </div>

                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px 12px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Buying Cost</span>
                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#475569', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <DirhamIcon size={12} /> {totalCost.toFixed(2)}
                                </span>
                            </div>

                            <div style={{ background: isExceedingCost ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isExceedingCost ? '#fecaca' : '#bbf7d0'}`, borderRadius: '14px', padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: isExceedingCost ? '#b91c1c' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Discount</span>
                                <span style={{ fontSize: '13px', fontWeight: 900, color: isExceedingCost ? '#dc2626' : '#16a34a', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <DirhamIcon size={11} /> {maxAllowedTotalDiscount.toFixed(2)} <span style={{ fontSize: '10px', opacity: 0.85 }}>({maxPct}%)</span>
                                </span>
                            </div>
                        </div>

                        {/* Discount Mode Selection (Tabs) */}
                        <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '14px', gap: '4px' }}>
                            <button
                                type="button"
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', border: 'none',
                                    background: discount.type === 'amount' ? '#ffffff' : 'transparent',
                                    color: discount.type === 'amount' ? '#2563eb' : '#64748b',
                                    boxShadow: discount.type === 'amount' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                                onClick={() => setDiscount({ ...discount, type: 'amount' })}
                            >
                                <DirhamIcon size={13} /> Flat Amount (AED)
                            </button>
                            <button
                                type="button"
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800,
                                    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', border: 'none',
                                    background: (discount.type === 'percentage' || discount.type === 'percent') ? '#ffffff' : 'transparent',
                                    color: (discount.type === 'percentage' || discount.type === 'percent') ? '#2563eb' : '#64748b',
                                    boxShadow: (discount.type === 'percentage' || discount.type === 'percent') ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                                onClick={() => setDiscount({ ...discount, type: 'percentage' })}
                            >
                                <Percent size={13} /> Percentage (%)
                            </button>
                        </div>

                        {/* Discount Value Input Box */}
                        <div style={{ background: '#ffffff', border: `2px solid ${isExceedingCost ? '#ef4444' : '#3b82f6'}`, borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                            <div style={{ width: '36px', height: '36px', background: isExceedingCost ? '#fee2e2' : '#eff6ff', color: isExceedingCost ? '#ef4444' : '#2563eb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '16px' }}>
                                {discount.type === 'amount' ? <DirhamIcon size={18} /> : '%'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {discount.type === 'amount' ? 'Enter Discount Amount' : 'Enter Discount Percentage'}
                                </label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '24px', fontWeight: 900, color: isExceedingCost ? '#dc2626' : '#0f172a', background: 'transparent' }}
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
                        </div>

                        {/* Discount Percentage Badge & Rule Indicator */}
                        {enteredVal > 0 && (
                            <div style={{
                                background: (discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0 ? '#eff6ff' : '#f0fdf4',
                                border: `1px solid ${(discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0 ? '#bfdbfe' : '#bbf7d0'}`,
                                borderRadius: '12px',
                                padding: '8px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                fontWeight: 800
                            }}>
                                <span style={{ color: (discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0 ? '#1e40af' : '#15803d' }}>
                                    {(discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0
                                        ? '🔒 Secret Key Required (> 10% Discount)'
                                        : '✅ No Secret Key Required (≤ 10% Standard Discount)'}
                                </span>
                                <span style={{
                                    background: (discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0 ? '#2563eb' : '#16a34a',
                                    color: '#ffffff',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '10px'
                                }}>
                                    {(discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)).toFixed(1)}%
                                </span>
                            </div>
                        )}

                        {/* Cashier Secret Key Box (Only for > 10% Discount) */}
                        {enteredVal > 0 && (discount.type === 'percentage' || discount.type === 'percent' ? enteredVal : (totalSelling > 0 ? (calcDiscountAmt / totalSelling) * 100 : 0)) > 10.0 && (
                            <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '16px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '9.5px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Manager / Cashier Secret Key</span>
                                    <span style={{ color: '#ef4444' }}>* Mandatory</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '4px 12px' }}>
                                    <input
                                        id="cashier-secret-key-input"
                                        type="password"
                                        placeholder="Enter Secret PIN ••••"
                                        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '16px', fontWeight: 800, color: '#0f172a', padding: '6px 0' }}
                                        value={secretKeyInput}
                                        onChange={e => setSecretKeyInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyDiscountHandler()}
                                    />
                                </div>
                                {discountPinEmployee && discountPinEmployee.status === 'success' && (
                                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#047857' }}>
                                        <ShieldCheck size={14} />
                                        <span>Authorized: <b>{discountPinEmployee.employee_name}</b> {discountPinEmployee.employee_id ? `(${discountPinEmployee.employee_id})` : ''}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Create & Select Discount Customer Box */}
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '9.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {creatingDiscountCust ? "Creating Discount Customer..." : "Create & Select Discount Customer"}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '4px 12px', gap: '8px' }}>
                                {creatingDiscountCust ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <UserPlus size={16} className="text-blue-600" />}
                                <input
                                    type="text"
                                    placeholder="Enter name or mobile & press Enter"
                                    style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', fontWeight: 700, color: '#0f172a', padding: '6px 0' }}
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

                        {/* Net Impact Preview Card */}
                        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '16px', padding: '14px 18px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Effective Discount</span>
                                <span style={{ fontSize: '16px', fontWeight: 900, color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    - <DirhamIcon size={13} /> {calcDiscountAmt.toFixed(2)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Payable</span>
                                <span style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <DirhamIcon size={16} /> {finalEstPrice.toFixed(2)}
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div style={{ padding: '14px 24px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={clearDiscount}
                            style={{ flex: 1, padding: '10px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={applyDiscountHandler}
                            style={{ flex: 2, padding: '10px 16px', background: '#2563eb', border: 'none', borderRadius: '12px', fontSize: '12px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'all 0.15s' }}
                        >
                            Apply Discount
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderCreateModal = () => (
        <div
            className="home-modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10000
            }}
        >
            <div
                className="animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '95%',
                    maxWidth: '860px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh'
                }}
            >
                {/* Header */}
                <div
                    className="bg-slate-900 flex justify-between items-center text-white border-b border-slate-800"
                    style={{ padding: '16px 24px', flexShrink: 0 }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            {isEditingCustomer ? <Edit size={18} /> : <UserPlus size={18} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white tracking-wide uppercase m-0">
                                    {isEditingCustomer ? 'Edit Customer Details' : 'Register New Customer'}
                                </h3>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                                    {isEditingCustomer ? 'Edit Mode' : 'Directory'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 m-0">
                                {isEditingCustomer ? 'Update customer information & address' : 'Quickly add customer details to your directory'}
                            </p>
                        </div>
                    </div>
                    <button
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition-all cursor-pointer"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div
                    className="bg-slate-100/60 flex flex-col md:flex-row gap-5 overflow-y-auto"
                    style={{ padding: '20px 24px', flex: '1 1 auto' }}
                >
                    {/* Left Column: Primary & Account Details */}
                    <div
                        className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col gap-3.5"
                        style={{ padding: '20px', borderRadius: '12px' }}
                    >
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                <User size={13} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">Primary Details</span>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Customer Name <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Enter customer name"
                                value={createForm.name}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^a-zA-Z0-9\s.\-_/&()#]/g, '');
                                    setCreateForm({ ...createForm, name: val });
                                }}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Phone Number <span className="text-rose-500">*</span></label>
                            <div className="flex gap-2">
                                <CountryCodeSelector
                                    value={countryCodePrefix}
                                    variant="modal"
                                    onChange={newPrefix => {
                                        setCountryCodePrefix(newPrefix);
                                        localStorage.setItem('pos_country_code', newPrefix);
                                        const rule = getCountryRule(newPrefix);
                                        if (createForm.phone.length > rule.maxLen) {
                                            setCreateForm(prev => ({ ...prev, phone: prev.phone.slice(0, rule.maxLen) }));
                                        }
                                    }}
                                />
                                <input
                                    type="tel"
                                    placeholder={`${getCountryRule(countryCodePrefix).maxLen}-digit mobile number`}
                                    value={createForm.phone}
                                    onChange={e => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        // Strip leading 0 so entering 0501234567 immediately becomes 501234567 (full 9 digits)
                                        while (val.startsWith('0')) {
                                            val = val.slice(1);
                                        }
                                        const rule = getCountryRule(countryCodePrefix);
                                        if (val.length <= rule.maxLen) {
                                            setCreateForm({ ...createForm, phone: val });
                                        }
                                    }}
                                    style={{ borderRadius: '8px', boxShadow: 'none' }}
                                    className="flex-1 min-w-0 h-10 px-3 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-600 block">
                                    Customer Group <span className="text-rose-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleCreateCustomerGroup}
                                    className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-tight flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                    + New Group
                                </button>
                            </div>
                            <div className="relative">
                                <select
                                    value={createForm.customer_group}
                                    onChange={e => setCreateForm({ ...createForm, customer_group: e.target.value })}
                                    style={{ borderRadius: '8px', boxShadow: 'none' }}
                                    className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-800 outline-none cursor-pointer transition-all appearance-none"
                                >
                                    {(customerGroups && customerGroups.length > 0 ? customerGroups : [
                                        'Retail Customer',
                                        'Discount Customer',
                                        'Credit Customer',
                                        'Commercial Customer',
                                        'Individual',
                                        'All Customer Groups'
                                    ]).map(grp => (
                                        <option key={grp} value={grp}>{grp}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <Layers size={14} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Cashier Secret Code / PIN <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center">
                                    <Lock size={15} />
                                </div>
                                <input
                                    type={showCreateSecretKey ? "text" : "password"}
                                    placeholder="Enter employee secret code / PIN"
                                    value={createForm.secret_key}
                                    onChange={e => setCreateForm({ ...createForm, secret_key: e.target.value })}
                                    style={{ borderRadius: '8px', boxShadow: 'none', paddingLeft: '36px', paddingRight: '36px' }}
                                    className="w-full h-10 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCreateSecretKey(!showCreateSecretKey)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    {showCreateSecretKey ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            {/* Live Employee Name feedback */}
                            {createPinEmployee && createPinEmployee.status === 'success' && (
                                <div className="mt-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 animate-in fade-in slide-in-from-top-1">
                                    <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                                    <span className="truncate">
                                        Authorized by: <b>{createPinEmployee.employee_name}</b> {createPinEmployee.employee_id ? `(${createPinEmployee.employee_id})` : ''}
                                    </span>
                                </div>
                            )}
                            {createPinEmployee && createPinEmployee.status === 'invalid' && (
                                <div className="mt-1 px-2 py-0.5 text-[10px] font-semibold text-rose-500 animate-in fade-in">
                                    Invalid PIN / Employee not found
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Email Address</label>
                            <input
                                type="email"
                                placeholder="e.g. name@domain.com"
                                value={createForm.email}
                                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>
                    </div>

                    {/* Right Column: Address & Tax Details */}
                    <div
                        className="flex-1 bg-white border border-slate-200 shadow-sm flex flex-col gap-3.5"
                        style={{ padding: '20px', borderRadius: '12px' }}
                    >
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                            <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                                <MapPin size={13} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">Address & Tax Details</span>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Address Line 1</label>
                            <input
                                type="text"
                                placeholder="Building / Flat / Villa / Street"
                                value={createForm.address_line1}
                                onChange={e => setCreateForm({ ...createForm, address_line1: e.target.value })}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Address Line 2</label>
                            <input
                                type="text"
                                placeholder="Area, Landmark / Nearby Location"
                                value={createForm.address_line2}
                                onChange={e => setCreateForm({ ...createForm, address_line2: e.target.value })}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">City</label>
                            <input
                                type="text"
                                placeholder="e.g. Dubai / Abu Dhabi"
                                value={createForm.city}
                                onChange={e => setCreateForm({ ...createForm, city: e.target.value })}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>

                        <div className="flex gap-3">
                            <div style={{ flex: 1.2 }}>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Emirate / State</label>
                                <select
                                    value={createForm.emirate}
                                    onChange={e => setCreateForm({ ...createForm, emirate: e.target.value })}
                                    style={{ borderRadius: '8px', boxShadow: 'none' }}
                                    className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 text-xs font-semibold text-slate-800 outline-none cursor-pointer transition-all"
                                >
                                    <option value="">Select Emirate</option>
                                    {["Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain"].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Country</label>
                                <input
                                    type="text"
                                    placeholder="Country"
                                    value={createForm.country}
                                    onChange={e => setCreateForm({ ...createForm, country: e.target.value })}
                                    style={{ borderRadius: '8px', boxShadow: 'none' }}
                                    className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">TRN (Tax Registration No.)</label>
                            <input
                                type="text"
                                placeholder="15-digit TRN"
                                value={createForm.custom_trn}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                                    setCreateForm({ ...createForm, custom_trn: val });
                                }}
                                style={{ borderRadius: '8px', boxShadow: 'none' }}
                                className="w-full h-10 px-3 bg-white border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs font-mono font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    className="bg-slate-50 flex items-center justify-between border-t border-slate-200"
                    style={{ padding: '16px 24px', flexShrink: 0 }}
                >
                    <div className="text-[11px] font-medium text-slate-500">
                        Fields with <span className="text-rose-500 font-bold">*</span> are required
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            type="button"
                            className="h-10 px-5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 rounded-lg font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                            onClick={() => setShowCreateModal(false)}
                        >
                            <X size={14} />
                            <span>Cancel</span>
                        </button>
                        <button
                            type="button"
                            onClick={createCustomer}
                            disabled={creatingCustomer}
                            className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {creatingCustomer ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{isEditingCustomer ? 'Updating...' : 'Creating...'}</span>
                                </>
                            ) : (
                                <>
                                    {isEditingCustomer ? <Edit size={15} /> : <UserPlus size={15} />}
                                    <span>{isEditingCustomer ? 'Update Customer' : 'Create Customer'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderGroupChangeModal = () => {
        const custName = groupChangeCust?.customer_name || groupChangeCust?.name || 'Customer';
        const currentGroup = groupChangeCust?.customer_group || 'Retail Customer';
        const availableGroups = customerGroups && customerGroups.length > 0
            ? customerGroups
            : ['Retail Customer', 'Discount Customer', 'Credit Customer', 'Commercial Customer', 'Individual'];

        return (
            <div
                className="home-modal-overlay"
                onClick={(e) => { if (e.target === e.currentTarget) setShowGroupChangeModal(false); }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10000,
                    padding: '20px'
                }}
            >
                <div
                    className="animate-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%',
                        maxWidth: '520px',
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(15, 23, 42, 0.08)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: '16px 20px',
                            background: '#0f172a',
                            borderBottom: '1px solid #1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#ffffff'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '12px',
                                    background: 'rgba(2, 132, 199, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#38bdf8',
                                    flexShrink: 0
                                }}
                            >
                                <ShieldCheck size={22} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                                    Change Customer Group
                                </h3>
                                <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, margin: '2px 0 0 0' }}>
                                    Authorized Pricing Tier & Group Update
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowGroupChangeModal(false)}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '10px',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = '#334155'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#1e293b'; }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
                        {/* Customer Info Card */}
                        <div
                            style={{
                                background: '#ffffff',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: '14px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '10px',
                                        background: '#e0f2fe',
                                        color: '#0369a1',
                                        fontWeight: 900,
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textTransform: 'uppercase',
                                        flexShrink: 0
                                    }}
                                >
                                    {custName.slice(0, 2)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {custName}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {groupChangeCust?.mobile_no || 'No Mobile'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                                    Current Group
                                </div>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '3px 10px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1'
                                    }}
                                >
                                    {currentGroup}
                                </span>
                            </div>
                        </div>

                        {/* Select New Group */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Layers size={13} style={{ color: '#0284c7' }} />
                                Select Target Customer Group <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '2px' }}>
                                {availableGroups.map((grp) => {
                                    const isSelected = targetGroup === grp;
                                    const isCurrent = currentGroup === grp;
                                    return (
                                        <button
                                            key={grp}
                                            type="button"
                                            onClick={() => setTargetGroup(grp)}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '12px',
                                                border: isSelected ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                                                background: isSelected ? '#f0f9ff' : '#ffffff',
                                                color: isSelected ? '#0369a1' : '#334155',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '6px',
                                                boxShadow: isSelected ? '0 2px 8px rgba(2, 132, 199, 0.15)' : 'none',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {grp}
                                                </div>
                                                {isCurrent && (
                                                    <span style={{ fontSize: '9px', fontWeight: 700, color: isSelected ? '#0284c7' : '#94a3b8' }}>
                                                        (Current)
                                                    </span>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Secret Key Input */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Lock size={13} style={{ color: '#4f46e5' }} />
                                Cashier Secret PIN / Manager Code <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: '#ffffff',
                                    border: '1.5px solid #cbd5e1',
                                    borderRadius: '12px',
                                    height: '44px',
                                    padding: '0 12px',
                                    gap: '10px',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <KeyRound size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                <input
                                    type={showGroupSecretKey ? "text" : "password"}
                                    placeholder="Enter secret PIN to authorize"
                                    value={groupSecretKey}
                                    onChange={e => setGroupSecretKey(e.target.value)}
                                    autoFocus
                                    style={{
                                        border: 'none',
                                        outline: 'none',
                                        width: '100%',
                                        fontSize: '14px',
                                        fontWeight: 800,
                                        fontFamily: 'monospace',
                                        letterSpacing: showGroupSecretKey ? 'normal' : '0.15em',
                                        color: '#0f172a',
                                        background: 'transparent'
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleConfirmCustomerGroupChange();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowGroupSecretKey(!showGroupSecretKey)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#334155'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                >
                                    {showGroupSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                                <ShieldAlert size={12} style={{ color: '#0284c7', flexShrink: 0 }} />
                                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 500 }}>
                                    Group changes modify customer pricing tiers. Action is verified and logged.
                                </span>
                            </div>
                        </div>

                        {/* Reason / Note (Optional) */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                Reason / Note <span style={{ color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. VIP upgrade, corporate discount approval"
                                value={groupChangeReason}
                                onChange={e => setGroupChangeReason(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '38px',
                                    borderRadius: '10px',
                                    border: '1.5px solid #e2e8f0',
                                    background: '#ffffff',
                                    padding: '0 12px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: '#0f172a',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: '14px 20px',
                            background: '#ffffff',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '10px'
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setShowGroupChangeModal(false)}
                            style={{
                                padding: '10px 18px',
                                borderRadius: '10px',
                                background: '#ffffff',
                                border: '1.5px solid #cbd5e1',
                                color: '#475569',
                                fontSize: '12px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#475569'; }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmCustomerGroupChange}
                            disabled={isSubmittingGroupChange || !groupSecretKey}
                            style={{
                                padding: '10px 22px',
                                borderRadius: '10px',
                                background: isSubmittingGroupChange || !groupSecretKey ? '#94a3b8' : '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                cursor: isSubmittingGroupChange || !groupSecretKey ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: isSubmittingGroupChange || !groupSecretKey ? 'none' : '0 4px 12px rgba(2, 132, 199, 0.3)',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { if (!isSubmittingGroupChange && groupSecretKey) e.currentTarget.style.background = '#0369a1'; }}
                            onMouseLeave={e => { if (!isSubmittingGroupChange && groupSecretKey) e.currentTarget.style.background = '#0284c7'; }}
                        >
                            {isSubmittingGroupChange ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Verifying & Updating...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={16} />
                                    <span>Authorize & Update Group</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

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
                        maxWidth: '560px',
                        backgroundColor: '#ffffff',
                        borderRadius: '28px',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        margin: '16px'
                    }}
                >
                    <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                                <Award size={18} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Redeem Loyalty Points</h3>
                        </div>
                        <button
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-all"
                            onClick={() => setShowLoyaltyModal(false)}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="home-modal-body p-6 flex flex-col gap-4">
                        {/* Customer Loyalty Profile Card */}
                        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Loyalty Program</span>
                                        <span className="text-base font-black tracking-tight truncate max-w-[280px]">
                                            {selectedCustomer?.loyalty_program || 'Tier Program'}
                                        </span>
                                    </div>
                                    <div className="px-2.5 py-0.5 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-wider">
                                        Active
                                    </div>
                                </div>
                                <div className="flex justify-between items-end pt-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Available Balance</span>
                                        <span className="text-2xl font-black">{selectedCustomer?.loyalty_points || 0} <span className="text-xs font-normal">pts</span></span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">Redemption Rate</span>
                                        <span className="text-xs font-bold flex items-center gap-1">
                                            1 Pt = <DirhamIcon size={11} /> {(loyaltyProgramConfig?.conversion_factor || 0.01).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Points to Redeem</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all placeholder:text-slate-200"
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
                            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Cashier Secret Key</label>
                                <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl overflow-hidden focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50 transition-all">
                                    <input
                                        id="loyalty-cashier-secret-key-input"
                                        type="password"
                                        placeholder="••••"
                                        className="w-full px-5 py-3 bg-transparent text-base font-black text-slate-900 outline-none placeholder:text-slate-300"
                                        value={secretKeyInput}
                                        onChange={e => setSecretKeyInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyLoyaltyPoints()}
                                    />
                                </div>
                                {/* Live Employee Name feedback */}
                                {loyaltyPinEmployee && loyaltyPinEmployee.status === 'success' && (
                                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1.5 text-xs font-bold text-emerald-700 animate-in fade-in slide-in-from-top-1">
                                        <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                                        <span className="truncate">
                                            Authorized by: <b>{loyaltyPinEmployee.employee_name}</b> {loyaltyPinEmployee.employee_id ? `(${loyaltyPinEmployee.employee_id})` : ''}
                                        </span>
                                    </div>
                                )}
                                {loyaltyPinEmployee && loyaltyPinEmployee.status === 'invalid' && (
                                    <div className="px-3 py-0.5 text-[11px] font-semibold text-rose-500 animate-in fade-in">
                                        Invalid PIN / Employee not found
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Impact Summary */}
                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -mr-12 -mt-12 blur-xl"></div>
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Total</span>
                                    <span className="text-base font-black flex items-center gap-1"><DirhamIcon size={13} /> {subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Final Price</span>
                                    <span className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                                        <DirhamIcon size={16} /> {Math.max(0, subtotal - redeemedValue).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="home-modal-footer p-5 bg-slate-50 flex gap-3 items-center border-t border-slate-100">
                        <button
                            className="flex-1 py-3 text-slate-400 font-black uppercase tracking-widest hover:text-slate-600 transition-all text-xs"
                            onClick={clearLoyaltyPoints}
                        >
                            Reset
                        </button>
                        <button
                            onClick={applyLoyaltyPoints}
                            className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all text-xs"
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
                    maxWidth: '520px',
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
                <div className="home-modal-header bg-slate-50/80 border-b border-slate-100 px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
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

                <div className="home-modal-body p-6 flex flex-col gap-5 overflow-y-auto">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3 payment-status-blocks">
                        {/* Total Bill Card */}
                        <div className="payment-status-card bg-gradient-to-br from-slate-800 to-slate-950 text-white p-4 rounded-2xl flex flex-col justify-between shadow-md border border-slate-900 relative overflow-hidden min-h-[86px]">
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-white/5 rounded-full blur-xl"></div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Bill</span>
                            <span className="text-base sm:text-lg font-black tracking-tight mt-1 flex items-center gap-1"><DirhamIcon size={12} /> {grandTotal.toFixed(2)}</span>
                        </div>

                        {/* Paid Amount Card */}
                        <div className="payment-status-card bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-950 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[86px]">
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-50/5 rounded-full blur-xl"></div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Paid Amount</span>
                            <span className="text-base sm:text-lg font-black tracking-tight text-emerald-700 mt-1 flex items-center gap-1"><DirhamIcon size={12} /> {totalPaid.toFixed(2)}</span>
                        </div>

                        {/* Balance / Change Card */}
                        <div className={`payment-status-card bg-gradient-to-br ${balanceRemaining > 0
                            ? 'from-rose-500/10 to-red-500/10 border-rose-500/20 text-rose-950'
                            : 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-950'
                            } border p-4 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[86px]`}>
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
                        <div className="flex flex-col gap-2.5">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Payment Ledger</h4>
                            <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1 payment-ledger-list">
                                {payments.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.mode_of_payment.includes('Cash') ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                                                {p.mode_of_payment.includes('Cash') ? <Banknote size={16} /> : <CreditCard size={16} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{p.mode_of_payment}</span>
                                                {p.reference_no && (
                                                    <span className="text-[10px] font-mono text-slate-400">Ref: {p.reference_no}</span>
                                                )}
                                            </div>
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
                        <div className="flex flex-col gap-4">
                            {!selectedPaymentMode ? (
                                <>
                                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Payment Method</h5>
                                    <div className="grid grid-cols-3 gap-3 payment-methods-grid">
                                        <button
                                            className="payment-method-btn group p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-emerald-600 hover:border-emerald-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Cash')}
                                        >
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded shadow-sm">1</div>
                                            <div className="w-10 h-10 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <DollarSign size={20} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-emerald-700 group-hover:text-white text-[9px] mt-1">Cash</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-4 bg-sky-50 border-2 border-sky-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-sky-600 hover:border-sky-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Card')}
                                        >


                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-sky-600 text-white text-[9px] font-black rounded shadow-sm">2</div>
                                            <div className="w-10 h-10 bg-white text-sky-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <CreditCard size={20} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-sky-700 group-hover:text-white text-[9px] mt-1">Card</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-indigo-600 hover:border-indigo-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('InstaPay')}
                                        >
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded shadow-sm">3</div>
                                            <div className="w-10 h-10 bg-white text-indigo-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Banknote size={20} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-indigo-700 group-hover:text-white text-[9px] text-center mt-1">InstaPay</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-4 bg-amber-50 border-2 border-amber-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-amber-600 hover:border-amber-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={handleCreditPaymentSelection}
                                        >
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-600 text-white text-[9px] font-black rounded shadow-sm">4</div>
                                            <div className="w-10 h-10 bg-white text-amber-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Coins size={20} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-amber-700 group-hover:text-white text-[9px] mt-1">Credit</span>
                                        </button>
                                        <button
                                            className="payment-method-btn group p-4 bg-purple-50 border-2 border-purple-100 rounded-2xl flex flex-col items-center gap-2 hover:bg-purple-600 hover:border-purple-600 transition-all hover:shadow-lg active:scale-95 relative"
                                            onClick={() => setSelectedPaymentMode('Bank')}
                                        >
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-600 text-white text-[9px] font-black rounded shadow-sm">5</div>
                                            <div className="w-10 h-10 bg-white text-purple-600 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white/20 group-hover:text-white transition-all">
                                                <Building2 size={20} />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-purple-700 group-hover:text-white text-[9px] text-center mt-1">Bank</span>
                                        </button>
                                    </div>

                                </>
                            ) : (
                                <div className="bg-slate-50 p-5 rounded-2xl border-2 border-sky-200 animate-in fade-in slide-in-from-bottom-2 payment-mode-input-container">
                                    <div className="flex justify-between items-center mb-3 px-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedPaymentMode} Amount</span>
                                        <button onClick={() => setSelectedPaymentMode('')} className="text-[10px] font-black text-sky-600 hover:underline uppercase">Change Mode</button>
                                    </div>
                                    <div className="mb-3 relative flex items-center bg-white border-2 border-sky-500 rounded-xl overflow-hidden shadow-sm focus-within:ring-4 focus-within:ring-sky-100 transition-all">
                                        <span className="absolute left-4 pointer-events-none text-slate-400 flex items-center justify-center"><DirhamIcon size={16} /></span>
                                        <input
                                            id="payment-tendered-amount"
                                            type="number"
                                            value={tenderedAmount}
                                            onChange={e => setTenderedAmount(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.target.select()}
                                            className="w-full pr-4 py-3 bg-transparent text-2xl font-black text-slate-900 outline-none"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                    {(selectedPaymentMode === 'Bank' || selectedPaymentMode === 'Card' || selectedPaymentMode === 'InstaPay') && (
                                        <div className="mb-3 relative flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition-all">
                                            <input
                                                type="text"
                                                placeholder={selectedPaymentMode === 'Bank' ? 'Bank Ref / Txn ID (Optional)' : 'Auth Code / Slip Ref No (Optional)'}
                                                value={paymentReferenceNo}
                                                onChange={e => setPaymentReferenceNo(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400"
                                                onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                                            />
                                        </div>
                                    )}
                                    <button
                                        onClick={addPayment}
                                        className="w-full py-4 bg-sky-600 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-xl shadow-sky-200 hover:bg-sky-700 active:scale-95 transition-all text-xs"
                                    >
                                        Add {selectedPaymentMode} <DirhamIcon size={11} className="mx-1" /> {(parseFloat(tenderedAmount) || 0).toFixed(2)}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CUSTOM FEES SECTION */}
                    <div className="mt-2 flex flex-col gap-4">
                        {(selectedPaymentMode === 'InstaPay' || payments.some(p => p.mode_of_payment === 'InstaPay')) && (
                            <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-2xl flex flex-col gap-4 shadow-sm" style={{ padding: '1.15rem' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                                        <Percent size={12} />
                                    </div>
                                    <span className="text-xs font-black text-indigo-950 uppercase tracking-widest">
                                        InstaPay Service Fee
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 mt-0.5">
                                    <div className="relative flex items-center bg-white border-2 border-indigo-100 rounded-xl overflow-hidden w-1/2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
                                        <span className="absolute left-4 pointer-events-none text-indigo-400 flex items-center justify-center"><DirhamIcon size={12} /></span>
                                        <input
                                            type="number"
                                            value={instapayServiceFee}
                                            onChange={e => setInstapayServiceFee(e.target.value)}
                                            placeholder="Fee"
                                            className="w-full pr-3 py-3 bg-transparent text-sm font-black text-slate-800 outline-none placeholder:text-slate-300"
                                            style={{ paddingLeft: '40px' }}
                                        />
                                    </div>

                                    {/* Tax Inclusive Custom Checkbox */}
                                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={instapayTaxInclusive}
                                                onChange={e => setInstapayTaxInclusive(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-5 h-5 border-2 rounded-lg transition-all flex items-center justify-center shadow-sm ${instapayTaxInclusive
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'bg-white border-indigo-200 group-hover:border-indigo-400'
                                                }`}>
                                                <svg
                                                    className={`w-3 h-3 text-white transition-all duration-200 ${instapayTaxInclusive ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                                                        }`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={4}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-indigo-800 uppercase tracking-wider group-hover:text-indigo-950 transition-colors">
                                            Tax Inclusive
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50/70 border border-slate-100/80 rounded-2xl flex flex-col gap-1 shadow-sm" style={{ padding: '1.15rem' }}>
                            <label className="flex items-center gap-3 cursor-pointer select-none group w-full justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${showDeliveryFee ? 'bg-slate-700 text-white shadow-md shadow-slate-100' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                        <Package size={12} />
                                    </div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                                        Add Delivery Fee
                                    </span>
                                </div>
                                {/* Custom Checkbox */}
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={showDeliveryFee}
                                        onChange={e => setShowDeliveryFee(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 border-2 rounded-lg transition-all flex items-center justify-center shadow-sm ${showDeliveryFee
                                        ? 'bg-slate-600 border-slate-600'
                                        : 'bg-white border-slate-200 group-hover:border-slate-400'
                                        }`}>
                                        <svg
                                            className={`w-3 h-3 text-white transition-all duration-200 ${showDeliveryFee ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                                                }`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={4}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                            </label>
                            {showDeliveryFee && (
                                <div className="flex flex-col gap-4 mt-4">
                                    <div className="relative flex items-center bg-white border-2 border-slate-100 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-50 transition-all">
                                        <span className="absolute left-4 pointer-events-none text-slate-400 flex items-center justify-center"><DirhamIcon size={12} /></span>
                                        <input
                                            type="number"
                                            value={deliveryFee}
                                            onChange={e => setDeliveryFee(e.target.value)}
                                            placeholder="Amount"
                                            className="w-full pr-3 py-3 bg-transparent text-sm font-black text-slate-800 outline-none placeholder:text-slate-300"
                                            style={{ paddingLeft: '40px' }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                            Assign Delivery Boy
                                        </label>
                                        <div className="flex items-center bg-white border-2 border-slate-100 rounded-xl overflow-hidden focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-50 transition-all">
                                            <select
                                                value={selectedDriver}
                                                onChange={e => setSelectedDriver(e.target.value)}
                                                className="w-full py-3 px-3 bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
                                            >
                                                <option value="" className="text-slate-400">Select Delivery Boy</option>
                                                {drivers.map(d => (
                                                    <option key={d.name} value={d.name}>
                                                        {d.full_name || d.name} {d.cell_number ? `(${d.cell_number})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                <div className="home-modal-footer p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
                    {/* Complete Payment Button */}
                    <button
                        onClick={completePayment}
                        disabled={paymentLoading || balanceRemaining > 0}
                        className="relative w-full overflow-hidden group"
                        style={{
                            borderRadius: '18px',
                            border: 'none',
                            padding: 0,
                            cursor: balanceRemaining <= 0 && !paymentLoading ? 'pointer' : 'not-allowed',
                            outline: 'none',
                        }}
                    >
                        {/* Outer glow pulse ring — only when ready */}
                        {balanceRemaining <= 0 && !paymentLoading && (
                            <span
                                className="absolute -inset-[3px] rounded-[21px] pointer-events-none"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #0d9488, #059669)',
                                    opacity: 0.4,
                                    animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                                    zIndex: 0,
                                }}
                            />
                        )}

                        {/* Main button body */}
                        <div
                            className="relative flex items-center w-full"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '18px',
                                zIndex: 1,
                                background: balanceRemaining <= 0
                                    ? 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)'
                                    : '#f1f5f9',
                                boxShadow: balanceRemaining <= 0
                                    ? '0 4px 24px -4px rgba(5,150,105,0.6), 0 1px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,0,0,0.1) inset'
                                    : 'none',
                                padding: '0 20px',
                                height: '68px',
                                transition: 'all 0.2s ease',
                                transform: balanceRemaining <= 0 ? undefined : undefined,
                            }}
                        >
                            {/* Shimmer sweep on hover */}
                            {balanceRemaining <= 0 && !paymentLoading && (
                                <span
                                    className="absolute inset-0 translate-x-[-110%] group-hover:translate-x-[110%] pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
                                        transition: 'transform 0.55s ease',
                                        borderRadius: '18px',
                                    }}
                                />
                            )}

                            {paymentLoading ? (
                                /* Loading State */
                                <div className="flex items-center gap-3 w-full justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader2 size={22} className="animate-spin text-white" />
                                    <div className="flex flex-col items-start" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Processing...</span>
                                        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 900, letterSpacing: '0.02em' }}>Finalizing Order</span>
                                    </div>
                                </div>
                            ) : balanceRemaining <= 0 ? (
                                /* Ready State — Premium */
                                <>
                                    {/* Left: Icon Circle */}
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '14px',
                                        background: 'rgba(255,255,255,0.18)',
                                        border: '1.5px solid rgba(255,255,255,0.25)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        backdropFilter: 'blur(4px)',
                                    }}>
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </div>

                                    {/* Center: Text */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: '16px', flex: 1 }}>
                                        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '9px', fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '1px' }}>
                                            All payments received
                                        </span>
                                        <span style={{ color: '#ffffff', fontSize: '17px', fontWeight: 900, letterSpacing: '0.01em' }}>
                                            Complete Payment
                                        </span>
                                    </div>

                                    {/* Right: SPACE kbd */}
                                    <div style={{
                                        flexShrink: 0,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                        marginLeft: '12px'
                                    }}>
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>press</span>
                                        <kbd style={{
                                            background: 'rgba(255,255,255,0.15)',
                                            border: '1.5px solid rgba(255,255,255,0.25)',
                                            borderRadius: '8px',
                                            padding: '3px 10px',
                                            color: '#fff',
                                            fontSize: '11px',
                                            fontWeight: 900,
                                            letterSpacing: '0.05em',
                                            fontFamily: 'inherit',
                                        }}>SPACE</kbd>
                                    </div>
                                </>
                            ) : (
                                /* Disabled State */
                                <div className="flex items-center gap-3 w-full justify-center">
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '12px',
                                        background: '#e2e8f0',
                                        display: 'flex', alignItems: 'center', justify: 'center',
                                    }}>
                                        <CreditCard size={18} color="#94a3b8" />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Balance remaining</span>
                                        <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 900 }}>Complete Payment</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </button>

                    {/* Cancel — subtle text link */}
                    <button
                        className="w-full py-1.5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-rose-400 transition-colors"
                        onClick={() => { setShowPaymentModal(false); setSelectedPaymentMode(''); setPayments([]); }}
                    >
                        ✕ &nbsp; Cancel Order
                    </button>
                </div>
            </div>
        </div>
    );


    const handleShowRecentInvoicesPrint = async () => {
        try {
            // Retrieve up to 50 latest invoices to allow searching beyond the top 5
            const allRecent = await db.invoices.orderBy('id').reverse().limit(50).toArray();
            if (allRecent.length === 0) {
                Swal.fire('Info', 'No invoices found in local history.', 'info');
                return;
            }

            let filteredList = [...allRecent];
            let selectedIndex = 0;

            const renderInvoiceList = () => {
                if (filteredList.length === 0) {
                    return `<div style="text-align: center; padding: 24px; color: #64748b; font-weight: 700; font-size: 13px;">No matching invoices found</div>`;
                }

                return filteredList.map((inv, idx) => {
                    const invName = inv.server_name || inv.offline_id || `Local #${inv.id}`;
                    const date = inv.posting_date || 'N/A';
                    const total = inv.grand_total || 0;
                    const itemsCount = inv.items?.length || 0;
                    const isSelected = idx === selectedIndex;

                    const borderStyle = isSelected ? '2px solid #4f46e5' : '2px solid #e2e8f0';
                    const backgroundStyle = isSelected ? '#f5f3ff' : '#f8fafc';
                    const actionLabel = isSelected ? '👉 PRESS ENTER TO PRINT' : 'SELECT TO PRINT';

                    return `
                        <button class="recent-inv-btn" id="recent-inv-btn-${idx}" onclick="window.printSpecificInvoice(${idx})" style="
                            width: 100%;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            background: ${backgroundStyle};
                            border: ${borderStyle};
                            border-radius: 12px;
                            padding: 12px 16px;
                            margin-bottom: 8px;
                            cursor: pointer;
                            transition: all 0.15s ease-in-out;
                            font-family: inherit;
                            text-align: left;
                            outline: none;
                        " onmouseover="window.updateSelectedRecentInv(${idx})">
                            <div>
                                <div style="font-weight: 900; color: #1e293b; font-size: 13px;">${invName}</div>
                                <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">${date} • ${itemsCount} items</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 900; color: #0f172a; font-size: 13px;">AED ${parseFloat(total).toFixed(2)}</div>
                                <div style="font-size: 9px; color: #4f46e5; font-weight: bold; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">${actionLabel}</div>
                            </div>
                        </button>
                    `;
                }).join('');
            };

            // Expose updater to window so inline event handlers and arrow keys can trigger re-renders
            window.updateSelectedRecentInv = (idx) => {
                selectedIndex = idx;
                const container = document.getElementById('recent-inv-list-container');
                if (container) {
                    container.innerHTML = renderInvoiceList();
                    // Scroll the selected item into view if it goes out of the scrolling viewport
                    const activeBtn = document.getElementById(`recent-inv-btn-${idx}`);
                    if (activeBtn) {
                        activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                }
            };

            window.printSpecificInvoice = (index) => {
                Swal.close();
                const inv = filteredList[index];
                if (!inv) return;

                const printItems = (inv.items || []).map(it => ({
                    name: it.item_name || it.name,
                    item_code: it.item_code || it.id,
                    qty: it.quantity || it.qty || 1,
                    uom: it.uom,
                    price: it.price || it.rate || it.basePrice || 0,
                    is_tax_inclusive: it.is_tax_inclusive !== false
                }));

                const computedSubtotal = printItems.reduce((sum, it) => sum + (it.qty * it.price), 0);

                const printData = {
                    name: inv.server_name || inv.offline_id || `OFFLINE-${inv.offline_id}`,
                    grand_total: inv.grand_total,
                    subtotal: computedSubtotal,
                    discount_amount: inv.discount_amount || 0,
                    tax_amount: inv.tax_amount || 0,
                    posting_date: inv.posting_date || format(new Date(), 'yyyy-MM-dd'),
                    posting_time: inv.posting_time || 'N/A',
                    items: printItems,
                    payments: inv.payments || [],
                    loyalty: inv.loyalty || null
                };

                handlePrint(printData);
            };

            Swal.fire({
                title: 'Print Recent Invoice',
                html: `
                    <div style="margin-bottom: 12px; position: relative;">
                        <input type="text" id="recent-inv-search" placeholder="🔍 Search by ID, Customer Name or Phone Number..." style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #cbd5e1;
                            border-radius: 12px;
                            font-size: 14px;
                            font-weight: 600;
                            outline: none;
                            box-sizing: border-box;
                            font-family: inherit;
                        " />
                    </div>
                    <div id="recent-inv-list-container" style="max-height: 280px; overflow-y: auto; padding: 4px; border: 1px solid #f1f5f9; border-radius: 12px;">
                        ${renderInvoiceList()}
                    </div>
                `,
                showCancelButton: true,
                cancelButtonText: 'CLOSE',
                cancelButtonColor: '#64748b',
                showConfirmButton: false,
                customClass: {
                    popup: 'recent-invoices-popup'
                },
                didOpen: () => {
                    const searchInput = document.getElementById('recent-inv-search');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.addEventListener('input', (e) => {
                            const query = e.target.value.toLowerCase().trim();
                            if (query) {
                                filteredList = allRecent.filter(inv => {
                                    const invName = (inv.server_name || inv.offline_id || `Local #${inv.id}`).toLowerCase();
                                    const customer = (inv.customer || '').toLowerCase();
                                    const mobile = (inv.contact_mobile || '').toLowerCase();
                                    return invName.includes(query) || customer.includes(query) || mobile.includes(query);
                                });
                            } else {
                                filteredList = [...allRecent];
                            }
                            selectedIndex = 0;
                            const container = document.getElementById('recent-inv-list-container');
                            if (container) {
                                container.innerHTML = renderInvoiceList();
                            }
                        });
                    }

                    // Listen to arrow key events inside the modal
                    const popup = Swal.getPopup();
                    popup.addEventListener('keydown', (e) => {
                        if (filteredList.length === 0) return;

                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const nextIndex = (selectedIndex + 1) % filteredList.length;
                            window.updateSelectedRecentInv(nextIndex);
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prevIndex = (selectedIndex - 1 + filteredList.length) % filteredList.length;
                            window.updateSelectedRecentInv(prevIndex);
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            window.printSpecificInvoice(selectedIndex);
                        }
                    });
                }
            });

        } catch (err) {
            console.error("Failed to show recent invoices:", err);
            Swal.fire('Error', 'Failed to retrieve recent invoices list.', 'error');
        }
    };

    const handlePrint = (invoiceData) => {
        const cashierName = user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = company || 'KYLE RETAIL';
        const storeAddress = getBranchName(warehouse) || 'Main Store Address';
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.name}&scale=2&height=10`;
        const dirhamSvgHtml = `<svg viewBox="0 0 344.84 299.91" style="width: 12px; height: 10px; display: inline-block; vertical-align: middle; fill: currentColor; margin-right: 2px;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>`;

        // Calculate total paid and change due
        const totalPaidAmount = (invoiceData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const changeDue = Math.max(0, totalPaidAmount - (parseFloat(invoiceData.grand_total) || 0));

        const htmlContent = `
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
                    <div class="info-row"><span>CUSTOMER:</span> <span class="bold">${invoiceData.customer_name || invoiceData.customer || selectedCustomer?.customer_name || selectedCustomer?.name || (customerName && customerName !== 'Cash' ? customerName : 'Cash')}</span></div>
                    ${(invoiceData.contact_mobile || phoneNumber || selectedCustomer?.mobile_no) ? `<div class="info-row"><span>PHONE:</span> <span>${invoiceData.contact_mobile || phoneNumber || selectedCustomer?.mobile_no}</span></div>` : ''}
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
                        <span>SUB TOTAL (EXCL. TAX)</span>
                        <span>${dirhamSvgHtml}${parseFloat(invoiceData.subtotal !== undefined ? invoiceData.subtotal : invoiceData.net_total || invoiceData.grand_total).toFixed(2)}</span>
                    </div>
                    ${invoiceData.discount_amount > 0 ? `
                        <div class="total-row">
                            <span>DISCOUNT</span>
                            <span>-${dirhamSvgHtml}${parseFloat(invoiceData.discount_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${invoiceData.tax_amount > 0 ? `
                        <div class="total-row">
                            <span>VAT (5%)</span>
                            <span>${dirhamSvgHtml}${parseFloat(invoiceData.tax_amount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand-total bold" style="font-size: 14px; border-top: 1.5px solid #000; padding-top: 4px; margin-top: 4px;">
                        <span>TOTAL (INCL. VAT)</span>
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
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const printWindow = iframe.contentWindow;
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 5000);
        }
    };

    const handlePrintA4 = (invoiceData) => {
        const cashierName = user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = company || 'KYLE RETAIL';
        const storeAddress = getBranchName(warehouse) || 'Main Store Address';
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.name}&scale=2&height=10`;

        // Calculate total paid and change due
        const totalPaidAmount = (invoiceData.payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const changeDue = Math.max(0, totalPaidAmount - (parseFloat(invoiceData.grand_total) || 0));

        const htmlContent = `
        <html>
            <head>
                <title>Tax Invoice - ${invoiceData.name}</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    body { 
                        margin: 0; padding: 0; 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        font-size: 13px; line-height: 1.4; color: #333;
                    }
                    .invoice-box { width: 100%; margin: auto; padding: 0; }
                    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .company-details { font-size: 14px; }
                    .company-name { font-size: 24px; font-weight: 800; color: #10b981; text-transform: uppercase; margin-bottom: 5px; }
                    .invoice-title { font-size: 26px; font-weight: 800; color: #1e293b; text-align: right; text-transform: uppercase; margin: 0; }
                    .invoice-meta { text-align: right; font-size: 12px; }
                    .divider { border-top: 2px solid #e2e8f0; margin: 15px 0; }
                    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .details-table td { width: 50%; vertical-align: top; padding: 5px 0; }
                    .section-title { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; tracking-wider; margin-bottom: 5px; }
                    .info-block { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 80px; }
                    .info-block p { margin: 3px 0; }
                    .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
                    .items-table th { background: #1f2937; color: #ffffff; text-align: left; padding: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
                    .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
                    .text-left { text-align: left !important; }
                    .text-center { text-align: center !important; }
                    .text-right { text-align: right !important; }
                    .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; }
                    .totals-table { width: 320px; border-collapse: collapse; }
                    .totals-table td { padding: 6px 10px; font-size: 13px; }
                    .totals-table tr.grand-total { border-top: 2px solid #10b981; font-weight: bold; font-size: 16px; color: #1e293b; }
                    .payments-section { margin-top: 20px; font-size: 12px; color: #475569; }
                    .barcode-container { text-align: center; margin-top: 40px; }
                    .barcode { max-height: 45px; margin-bottom: 8px; }
                    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                </style>
            </head>
            <body>
                <div class="invoice-box">
                    <table class="header-table">
                        <tr>
                            <td class="company-details">
                                <div class="company-name">${companyName}</div>
                                <div>${storeAddress}</div>
                                <div>Tel: +971 00 000 0000</div>
                                <div>VAT No: 100XXXXXXXXXXXX</div>
                            </td>
                            <td>
                                <h1 class="invoice-title">Tax Invoice</h1>
                                <div class="invoice-meta">
                                    <p style="margin: 3px 0;"><strong>Invoice No:</strong> ${invoiceData.name}</p>
                                    <p style="margin: 3px 0;"><strong>Date:</strong> ${invoiceData.posting_date}</p>
                                    <p style="margin: 3px 0;"><strong>Time:</strong> ${invoiceData.posting_time || 'N/A'}</p>
                                    <p style="margin: 3px 0;"><strong>Cashier:</strong> ${cashierName}</p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <div class="divider"></div>

                    <table class="details-table">
                        <tr>
                            <td style="padding-right: 10px;">
                                <div class="section-title">Bill To</div>
                                <div class="info-block">
                                    <p><strong>Name:</strong> ${selectedCustomer?.customer_name || customerName || 'Cash'}</p>
                                    <p><strong>Phone:</strong> ${phoneNumber || selectedCustomer?.mobile_no || 'N/A'}</p>
                                </div>
                            </td>
                            <td style="padding-left: 10px;">
                                <div class="section-title">Delivery Details</div>
                                <div class="info-block">
                                    <p><strong>Driver:</strong> ${selectedDriver || 'N/A'}</p>
                                    <p><strong>Delivery Fee:</strong> AED ${parseFloat(deliveryFee || 0).toFixed(2)}</p>
                                </div>
                            </td>
                        </tr>
                    </table>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th class="text-left" style="width: 5%;">SL</th>
                                <th class="text-left" style="width: 35%;">Item Description</th>
                                <th class="text-center" style="width: 10%;">Qty</th>
                                <th class="text-center" style="width: 10%;">UOM</th>
                                <th class="text-right" style="width: 12%;">Unit Price</th>
                                <th class="text-center" style="width: 8%;">VAT %</th>
                                <th class="text-right" style="width: 10%;">VAT Amt</th>
                                <th class="text-right" style="width: 12%;">Total (AED)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(invoiceData.items || []).map((it, idx) => {
            const qty = parseFloat(it.qty) || 1;
            const price = parseFloat(it.price || it.rate || it.basePrice || 0);
            const isInc = it.is_tax_inclusive !== false;
            const taxRatePercent = 5.0;

            const vatVal = isInc
                ? (price - (price / (1 + (taxRatePercent / 100))))
                : (price * (taxRatePercent / 100));

            const lineTotal = isInc
                ? (qty * price)
                : (qty * (price + vatVal));

            return `
                                    <tr>
                                        <td class="text-left">${idx + 1}</td>
                                        <td class="text-left" style="font-weight: 600;">${it.name || it.item_name || it.item_code || 'ITEM'}</td>
                                        <td class="text-center">${qty}</td>
                                        <td class="text-center">${it.uom || ''}</td>
                                        <td class="text-right">${price.toFixed(2)}</td>
                                        <td class="text-center">5%</td>
                                        <td class="text-right">${(vatVal * qty).toFixed(2)}</td>
                                        <td class="text-right" style="font-weight: 600;">${parseFloat(lineTotal).toFixed(2)}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <table class="totals-table">
                            <tr>
                                <td>Subtotal</td>
                                <td class="text-right">AED ${parseFloat(invoiceData.subtotal || invoiceData.grand_total).toFixed(2)}</td>
                            </tr>
                            ${invoiceData.discount_amount > 0 ? `
                                <tr>
                                    <td>Discount</td>
                                    <td class="text-right" style="color: #ef4444;">-AED ${parseFloat(invoiceData.discount_amount).toFixed(2)}</td>
                                </tr>
                            ` : ''}
                            ${invoiceData.tax_amount > 0 ? `
                                <tr>
                                    <td>VAT (5%)</td>
                                    <td class="text-right">AED ${parseFloat(invoiceData.tax_amount).toFixed(2)}</td>
                                </tr>
                            ` : ''}
                            <tr class="grand-total">
                                <td><strong>Grand Total</strong></td>
                                <td class="text-right"><strong>AED ${parseFloat(invoiceData.grand_total).toFixed(2)}</strong></td>
                            </tr>
                        </table>
                    </div>

                    <div class="payments-section">
                        <p><strong>Payment Summary:</strong></p>
                        <ul style="list-style: none; padding-left: 0; margin: 5px 0;">
                            ${(invoiceData.payments || [{ mode_of_payment: 'CASH', amount: invoiceData.grand_total }]).map(p => `
                                <li>• ${(p.mode_of_payment || 'Payment').toUpperCase()}: AED ${parseFloat(p.amount || 0).toFixed(2)}</li>
                            `).join('')}
                            ${changeDue > 0 ? `<li>• Change Due: AED ${changeDue.toFixed(2)}</li>` : ''}
                        </ul>
                    </div>

                    ${invoiceData.loyalty?.enabled ? `
                        <div class="divider"></div>
                        <div style="font-size: 11px; color: #475569; margin-top: 10px;">
                            <p><strong>Loyalty Points Summary:</strong> Balance: ${invoiceData.loyalty.oldPoints} | Earned: +${invoiceData.loyalty.pointsEarned} ${invoiceData.loyalty.pointsRedeemed > 0 ? `| Redeemed: -${invoiceData.loyalty.pointsRedeemed}` : ''} | New Balance: ${invoiceData.loyalty.newBalance}</p>
                        </div>
                    ` : ''}

                    <div class="barcode-container">
                        <img class="barcode" src="${barCodeUrl}" />
                        <div style="font-size: 10px; color: #94a3b8;">${invoiceData.name}</div>
                    </div>

                    <div class="footer">
                        <p style="font-weight: bold; font-size: 12px; margin: 0 0 5px 0;">THANK YOU FOR YOUR BUSINESS!</p>
                        <p style="margin: 0;">Powered by KYLE RETAIL</p>
                    </div>
                </div>
                <script>
                    window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
                </script>
            </body>
        </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const printWindow = iframe.contentWindow;
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 5000);
        }
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
            const availQty = item.local_qty || 0;
            const factor = item.uom === 'Box' ? (item.custom_pieces_per_box || 1) : 1;

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
                cancelButtonColor: '#64748b',
                didOpen: () => {
                    const input = Swal.getInput();
                    if (input) {
                        input.focus();
                        input.select();
                        const checkStock = () => {
                            const val = parseFloat(input.value);
                            if (!isNaN(val) && val * factor > availQty) {
                                Swal.showValidationMessage(`Available quantity is ${availQty}. Insufficient stock.`);
                            } else {
                                Swal.resetValidationMessage();
                            }
                        };
                        input.addEventListener('input', checkStock);
                        input.addEventListener('keyup', checkStock);
                        checkStock();
                    }
                },
                inputValidator: (value) => {
                    const newQty = parseFloat(value);
                    if (isNaN(newQty) || newQty <= 0) {
                        return 'Please enter a valid quantity.';
                    }
                    if (newQty * factor > availQty) {
                        return `Available quantity is ${availQty}. Insufficient stock.`;
                    }
                }
            }).then(result => {
                if (result.isConfirmed && result.value) {
                    const newQty = parseInt(result.value);
                    if (newQty * factor <= availQty) {
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
            // If SweetAlert is open, let it handle keyboard events natively
            if (Swal.isVisible()) return;

            // 1. GLOBAL HID SCANNER LISTENER (Intercepts rapid digits)
            const now = Date.now();
            const activeEl = document.activeElement;
            const isCustomerInput = activeEl === mobileInputRef.current;
            const isInputFocused = activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName) && !isCustomerInput;
            const isLegacyTableInput = (el) => {
                if (!el) return false;
                const id = el.id || '';
                return id === 'legacy-inline-search' || id.startsWith('desc-input-') || id.startsWith('qty-input-') || id.startsWith('price-input-');
            };

            // If user is not typing in a specific input, or if it's very fast (typical of hardware scanners < 50ms per char)
            if (now - lastKeyTime.current > 100) {
                scannerBuffer.current = ""; // Reset buffer if typing is too slow to be a scanner
            }
            lastKeyTime.current = now;

            if (e.key && e.key.length === 1 && /^[0-9a-zA-Z\-_]$/.test(e.key) && (!isInputFocused || isCustomerInput)) {
                scannerBuffer.current += e.key;
            } else if (e.key === 'Enter' && scannerBuffer.current.length >= 3) {
                // Hardware Scanner finished sequence
                const scanValue = scannerBuffer.current;
                // If this is an item barcode or we are on customer input, intercept it!
                if (isItemBarcode(scanValue) || isCustomerInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    scannerBuffer.current = "";
                    if (isCustomerInput) {
                        setCustomerMobile('');
                        setCustomerName('Cash');
                        setSearchResults([]);
                        setShowDropdown(false);
                    }
                    handleBarcodeScan(scanValue);
                    return;
                }
            }

            // 2. KEYBOARD SHORTCUTS
            // Drafts / Active Orders Modal Navigation
            if (showDraftsModal) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveDraftIndex(prev => Math.min(prev + 1, draftOrders.length - 1));
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveDraftIndex(prev => Math.max(prev - 1, 0));
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (draftOrders.length > 0 && activeDraftIndex >= 0 && activeDraftIndex < draftOrders.length) {
                        loadDraftOrder(draftOrders[activeDraftIndex]);
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowDraftsModal(false);
                    return;
                }
                return;
            }

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
                    const activeEl = document.activeElement;
                    const isTenderedInput = activeEl && activeEl.id === 'payment-tendered-amount';
                    // Only allow Enter key to add payment if an input is NOT focused, or if it is specifically the tendered amount input
                    if (selectedPaymentMode && parseFloat(tenderedAmount) > 0 && (!isInputFocused || isTenderedInput)) {
                        e.preventDefault();
                        e.stopPropagation();
                        addPayment();
                        return;
                    }
                }

                // Space: Complete Payment when balance is zero
                if (e.key === ' ') {
                    if (balanceRemaining <= 0 && !paymentLoading && !isInputFocused) {
                        e.preventDefault();
                        e.stopPropagation();
                        completePayment();
                        return;
                    }
                }

                if (!selectedPaymentMode && !isInputFocused) {
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

            // Discount Modal Toggle
            if (isShortcutPressed(e, 'pos_home', 'discount', 'F1') || (e.key.toLowerCase() === 'd' && e.altKey)) {
                e.preventDefault();
                e.stopPropagation();
                setShowDiscountModal(prev => !prev);
            }

            // Loyalty Modal Toggle (Only outside payment modal) (Alt+L / Option+L / dead ¬)
            if (!showPaymentModal && (isShortcutPressed(e, 'pos_home', 'loyalty', 'Alt+L') || (e.altKey && (e.key.toLowerCase() === 'l' || e.code === 'KeyL')) || e.key === '¬')) {
                e.preventDefault();
                e.stopPropagation();
                if (showLoyaltyModal) {
                    setShowLoyaltyModal(false);
                } else {
                    handleLoyaltyPointsClick();
                }
            }

            // Focus Mobile Number
            if (isShortcutPressed(e, 'pos_home', 'customer', 'F2')) {
                e.preventDefault();
                mobileInputRef.current?.focus();
            }

            // Focus Barcode/Search
            if (isShortcutPressed(e, 'pos_home', 'search', 'F3')) {
                e.preventDefault();
                barcodeInputRef.current?.focus();
            }

            // Cycle Country Code Prefix (GCC -> India -> Next)
            if (isShortcutPressed(e, 'pos_home', 'countryCode', 'F4')) {
                e.preventDefault();
                setCountryCodePrefix(prev => {
                    const gccAndPopular = [...GCC_COUNTRIES, ...OTHER_COUNTRIES.slice(0, 4)];
                    const currentIndex = gccAndPopular.findIndex(c => c.code === prev);
                    const nextItem = gccAndPopular[(currentIndex + 1) % gccAndPopular.length];
                    const next = nextItem ? nextItem.code : '+971';
                    const countryName = nextItem ? `${nextItem.flag} ${nextItem.country} (${nextItem.code})` : next;
                    localStorage.setItem('pos_country_code', next);
                    const Toast = Swal.mixin({
                        toast: true, position: 'top-end', showConfirmButton: false, timer: 1200, timerProgressBar: false,
                    });
                    Toast.fire({ icon: 'success', title: `Country: ${countryName}` });
                    return next;
                });
            }

            // Selected Item Detail Modal (Classic theme F5)
            if (isShortcutPressed(e, 'pos_home', 'itemDetail', 'F5')) {
                e.preventDefault();
                if (selectedBillIndex !== -1) {
                    setSelectedDetailItem(billItems[selectedBillIndex]);
                    setShowItemDetailModal(true);
                } else {
                    Swal.fire('Info', 'Select an item in cart first', 'info');
                }
            }

            // Full Stock Breakdown (all branches with REQUEST button)
            if (isShortcutPressed(e, 'pos_home', 'stock', 'F7')) {
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


            // Quick Price Update
            if (isShortcutPressed(e, 'pos_home', 'priceUpdate', 'F11')) {
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

            // Bulk Quantity Update
            if (isShortcutPressed(e, 'pos_home', 'bulkQty', 'F6')) {
                e.preventDefault();
                handleBulkQtyUpdate();
            }

            // Toggle UOM of active cart item (F8)
            if (isShortcutPressed(e, 'pos_home', 'uom', 'F8')) {
                e.preventDefault();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    const curUom = (item.uom || '').toLowerCase();
                    const hasBox = (item.custom_pieces_per_box || 0) > 1;
                    const hasMb = (item.custom_boxes_per_master_box || 0) > 1;
                    let nextUom = 'Nos';
                    if (curUom === 'nos' || curUom === 'piece') {
                        nextUom = hasBox ? 'Box' : (hasMb ? 'Master Box' : 'Nos');
                    } else if (curUom === 'box') {
                        nextUom = hasMb ? 'Master Box' : 'Nos';
                    } else {
                        nextUom = 'Nos';
                    }
                    toggleUom(item.id, nextUom);
                } else {
                    Swal.fire('Info', 'Select an item in cart first', 'info');
                }
            }

            // Set Master Box UOM Directly (Ctrl+M / Cmd+M / Option+M)
            const isCtrlOrCmdM = (e.ctrlKey || e.metaKey || (isMac && e.altKey)) && (e.key.toLowerCase() === 'm' || e.code === 'KeyM');
            if (isShortcutPressed(e, 'pos_home', 'masterBoxUom', 'Ctrl+M') || isCtrlOrCmdM || e.key === 'µ') {
                e.preventDefault();
                e.stopPropagation();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    if (item.custom_boxes_per_master_box && item.custom_boxes_per_master_box > 1) {
                        const targetUom = item.uom === 'Master Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Master Box';
                        toggleUom(item.id, targetUom);
                        const totalMbPcs = (parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1);
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
                        Toast.fire({ icon: 'success', title: `UOM: ${targetUom} (${targetUom === 'Master Box' ? `${totalMbPcs} Pcs` : '1 Pc'})` });
                    } else {
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                        Toast.fire({ icon: 'warning', title: `Master Box packaging not configured for this item` });
                    }
                } else {
                    Swal.fire('Info', 'Select an item in cart first (Press ↑ / ↓)', 'info');
                }
            }

            // Set Box UOM Directly / Toggle Box (Ctrl+B / Cmd+B / Option+B)
            const isCtrlOrCmdB = (e.ctrlKey || e.metaKey || (isMac && e.altKey)) && (e.key.toLowerCase() === 'b' || e.code === 'KeyB');
            if (isShortcutPressed(e, 'pos_home', 'boxUom', 'Ctrl+B') || isCtrlOrCmdB || e.key === '∫') {
                e.preventDefault();
                e.stopPropagation();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    if (item.custom_pieces_per_box && item.custom_pieces_per_box > 1) {
                        const targetUom = item.uom === 'Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Box';
                        toggleUom(item.id, targetUom);
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
                        Toast.fire({ icon: 'success', title: `UOM: ${targetUom} (${targetUom === 'Box' ? `${item.custom_pieces_per_box} Pcs` : '1 Pc'})` });
                    } else {
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                        Toast.fire({ icon: 'warning', title: `Box packaging not configured for this item` });
                    }
                } else {
                    Swal.fire('Info', 'Select an item in cart first (Press ↑ / ↓)', 'info');
                }
            }

            // Set Nos / Piece UOM Directly (Ctrl+N / Cmd+N / Option+N)
            const isCtrlOrCmdN = (e.ctrlKey || e.metaKey || (isMac && e.altKey)) && (e.key.toLowerCase() === 'n' || e.code === 'KeyN');
            if (isShortcutPressed(e, 'pos_home', 'nosUom', 'Ctrl+N') || isCtrlOrCmdN) {
                e.preventDefault();
                e.stopPropagation();
                if (selectedBillIndex !== -1) {
                    const item = billItems[selectedBillIndex];
                    const targetUom = item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece';
                    toggleUom(item.id, targetUom);
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
                    Toast.fire({ icon: 'success', title: `UOM: ${targetUom} (1 Pc)` });
                } else {
                    Swal.fire('Info', 'Select an item in cart first (Press ↑ / ↓)', 'info');
                }
            }

            // Save Draft (Alt+S / Option+S / dead ß)
            if (isShortcutPressed(e, 'pos_home', 'saveDraft', 'Alt+S') || (e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) || e.key === 'ß') {
                e.preventDefault();
                e.stopPropagation();
                handleSaveDraft();
            }

            // Print Recent Bill List
            if (isShortcutPressed(e, 'pos_home', 'printBill', 'F10')) {
                e.preventDefault();
                handleShowRecentInvoicesPrint();
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

            // Pay & Print (Space) - triggers checkout even if table input is focused (as long as input isn't pure text editing like customer notes or discount modal)
            if (isShortcutPressed(e, 'pos_home', 'pay', 'Space')) {
                const isTableInput = isLegacyTableInput(activeEl);
                if ((!isInputFocused || isTableInput) && billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCheckoutWithMode('print');
                }
            }

            // Fast Checkout: Print Slip (Alt+P / Option+P)
            if ((e.altKey && (e.key.toLowerCase() === 'p' || e.code === 'KeyP')) || e.key === 'π' || e.key === '∏') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
                    handleCheckoutWithMode('print');
                }
            }

            // Fast Checkout: No Print (Alt+N / Option+N / dead ~)
            if ((e.altKey && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) || e.key === '˜' || e.key === '~') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
                    handleCheckoutWithMode('no-print');
                }
            }

            // Fast Checkout: A4 Print (Alt+A / Option+A)
            if ((e.altKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) || e.key === 'Å' || e.key === 'å') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0 && !showPaymentModal && !showOpeningModal) {
                    handleCheckoutWithMode('print-a4');
                }
            }

            // Create Customer Modal Toggle (Alt+K / Option+K / dead ˚)
            if ((e.altKey && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) || e.key === '˚' || e.key === '°') {
                e.preventDefault();
                e.stopPropagation();
                openCreateCustomerModal();
            }

            // Active Orders Toggle
            if (isShortcutPressed(e, 'pos_home', 'orders', 'F9')) {
                e.preventDefault();
                e.stopPropagation();
                setShowDraftsModal(prev => !prev);
            }

            // Print Job Modal Shortcut (Alt+J / Option+J / Alt+P)
            if ((e.altKey && e.shiftKey && (e.key.toLowerCase() === 'p' || e.code === 'KeyP')) || (e.altKey && (e.key.toLowerCase() === 'j' || e.code === 'KeyJ')) || e.key === '∆') {
                e.preventDefault();
                e.stopPropagation();
                setShowPrintJobModal(prev => !prev);
            }

            // Fast Print Modal Shortcut (Alt+F / Option+F)
            if ((e.altKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) || e.key === 'ƒ' || e.key === 'Ï') {
                e.preventDefault();
                e.stopPropagation();
                setShowFastPrintModal(prev => !prev);
            }

            // Advanced Item Search & Filter Drawer Shortcut (Alt+S / Option+S)
            if ((e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) || e.key === 'ß' || e.key === '§') {
                e.preventDefault();
                e.stopPropagation();
                setShowItemSearchDrawer(prev => !prev);
            }

            // Screen Mode Toggle Shortcut (Alt+W / Option+W) -> Full Screen <-> Popup Window
            if ((e.altKey && (e.key.toLowerCase() === 'w' || e.code === 'KeyW')) || e.key === '∑' || e.key === '„') {
                e.preventDefault();
                e.stopPropagation();
                setPosWindowMode(prev => {
                    const next = prev === 'popup' ? 'fullscreen' : 'popup';
                    localStorage.setItem('pos_window_mode', next);
                    return next;
                });
            }

            // Esc: Close Modals (Fallbacks)
            if (e.key === 'Escape') {
                if (showItemSearchDrawer) {
                    setShowItemSearchDrawer(false);
                } else if (showPrintJobModal) {
                    setShowPrintJobModal(false);
                } else if (showFastPrintModal) {
                    setShowFastPrintModal(false);
                } else if (showLoyaltyModal) {
                    setShowLoyaltyModal(false);
                } else if (showCreateModal) {
                    setShowCreateModal(false);
                } else if (showItemDropdown) {
                    setShowItemDropdown(false);
                }
            }

            // Clear Bill (Alt+C / Option+C)
            if (isShortcutPressed(e, 'pos_home', 'clearBill', 'Alt+C') || (e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) || e.key === 'ç' || e.key === 'Ç') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0) {
                    clearBillHandler();
                }
            }

            // Direct Cash (Alt+1 / Option+1)
            if (isShortcutPressed(e, 'pos_home', 'directCash', 'Alt+1') || (e.altKey && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1')) || e.key === '¡') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0 && grandTotal > 0 && !paymentLoading) {
                    completePayment('Cash');
                }
            }

            // Direct Bank (Ctrl+V / Cmd+V / Direct Bank shortcut)
            if (isShortcutPressed(e, 'pos_home', 'directBank', 'Ctrl+V') || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'v' || e.code === 'KeyV'))) {
                // If focused on an input and has selected text or pasting into search, let native paste happen unless altKey is also pressed or it's not a text paste
                const isTableInput = isLegacyTableInput(activeEl);
                if (billItems.length > 0 && (!isInputFocused || (isTableInput && !activeEl.value))) {
                    e.preventDefault();
                    e.stopPropagation();
                    completePayment('Bank');
                }
            }

            // Direct Card (Alt+2 / Option+2)
            if (isShortcutPressed(e, 'pos_home', 'directCard', 'Alt+2') || (e.altKey && (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2')) || e.key === '™') {
                e.preventDefault();
                e.stopPropagation();
                if (billItems.length > 0 && grandTotal > 0 && !paymentLoading) {
                    completePayment('Card');
                }
            }

            // Grid Card Selection Mode (Modern Themes) or Swap Item (Classic Theme)
            if (isShortcutPressed(e, 'pos_home', 'selectItem', 'Alt+I') || (e.altKey && (e.key.toLowerCase() === 'i' || e.code === 'KeyI')) || e.key === 'ˆ') {
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
        theme,
        showDraftsModal,
        draftOrders,
        activeDraftIndex,
        loadDraftOrder
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

        const modernShortcutsData = [
            { key: getShortcut('pos_home', 'discount', 'F1'), label: 'Discount', colorClass: 'violet', action: () => setShowDiscountModal(prev => !prev) },
            { key: getShortcut('pos_home', 'customer', 'F2'), label: 'Customer', colorClass: 'blue', action: () => mobileInputRef.current?.focus() },
            { key: getShortcut('pos_home', 'search', 'F3'), label: 'Search', colorClass: 'indigo', action: () => barcodeInputRef.current?.focus() },
            {
                key: getShortcut('pos_home', 'countryCode', 'F4'), label: `CC (${countryCodePrefix})`, colorClass: 'cyan', action: () => {
                    setCountryCodePrefix(prev => {
                        const gccAndPopular = [...GCC_COUNTRIES, ...OTHER_COUNTRIES.slice(0, 4)];
                        const currentIndex = gccAndPopular.findIndex(c => c.code === prev);
                        const nextItem = gccAndPopular[(currentIndex + 1) % gccAndPopular.length];
                        const next = nextItem ? nextItem.code : '+971';
                        const countryName = nextItem ? `${nextItem.flag} ${nextItem.country} (${nextItem.code})` : next;
                        localStorage.setItem('pos_country_code', next);
                        const Toast = Swal.mixin({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1200, timerProgressBar: false,
                        });
                        Toast.fire({ icon: 'success', title: `Country: ${countryName}` });
                        return next;
                    });
                }
            },
            {
                key: getShortcut('pos_home', 'itemDetail', 'F5'), label: 'Item Detail', colorClass: 'pink', action: () => {
                    if (selectedBillIndex !== -1) {
                        setSelectedDetailItem(billItems[selectedBillIndex]);
                        setShowItemDetailModal(true);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            { key: getShortcut('pos_home', 'bulkQty', 'F6'), label: 'Bulk Qty', colorClass: 'pink', action: handleBulkQtyUpdate },
            {
                key: getShortcut('pos_home', 'stock', 'F7'), label: 'Stock', colorClass: 'amber', action: () => {
                    if (lastInteractedItem) showStockBreakdown(lastInteractedItem);
                    else Swal.fire('Info', 'Select or scan an item first.', 'info');
                }
            },
            {
                key: getShortcut('pos_home', 'uom', 'F8'), label: 'UOM Toggle', colorClass: 'violet', action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const hasMb = item.custom_boxes_per_master_box && item.custom_boxes_per_master_box > 1;
                        let nextUom = 'Nos';
                        if (item.uom === 'Nos' || item.uom === 'Piece' || item.uom === (item.stock_uom || 'Nos')) {
                            nextUom = (item.custom_pieces_per_box && item.custom_pieces_per_box > 1) ? 'Box' : (hasMb ? 'Master Box' : 'Nos');
                        } else if (item.uom === 'Box') {
                            nextUom = hasMb ? 'Master Box' : (item.stock_uom || 'Nos');
                        } else {
                            nextUom = item.stock_uom || 'Nos';
                        }
                        toggleUom(item.id, nextUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'boxUom', 'Ctrl+B'), label: 'Box UOM', colorClass: 'violet', action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        if (item.custom_pieces_per_box && item.custom_pieces_per_box > 1) {
                            const targetUom = item.uom === 'Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Box';
                            toggleUom(item.id, targetUom);
                        } else {
                            Swal.fire('Info', 'Box packaging not configured for this item', 'info');
                        }
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'masterBoxUom', 'Ctrl+M'), label: 'Master Box', colorClass: 'indigo', action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        if (item.custom_boxes_per_master_box && item.custom_boxes_per_master_box > 1) {
                            const targetUom = item.uom === 'Master Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Master Box';
                            toggleUom(item.id, targetUom);
                        } else {
                            Swal.fire('Info', 'Master Box packaging not configured for this item', 'info');
                        }
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'nosUom', 'Ctrl+N'), label: 'Nos / Unit', colorClass: 'emerald', action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const targetUom = item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece';
                        toggleUom(item.id, targetUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            { key: getShortcut('pos_home', 'orders', 'F9'), label: 'Orders', colorClass: 'sky', action: () => setShowDraftsModal(prev => !prev) },
            { key: getShortcut('pos_home', 'saveDraft', 'Alt+S'), label: 'Save Draft', colorClass: 'amber', action: handleSaveDraft },
            { key: getShortcut('pos_home', 'printBill', 'F10'), label: 'Print Bill', colorClass: 'indigo', action: handleShowRecentInvoicesPrint },
            { key: getShortcut('pos_home', 'loyalty', 'Alt+L'), label: 'Loyalty', colorClass: 'emerald', action: handleLoyaltyPointsClick },
            { key: 'SPACE', label: 'Pay & Print', colorClass: 'emerald', action: () => handleCheckoutWithMode('print') },
            { key: 'Alt+N', label: 'Pay No Print', colorClass: 'blue', action: () => handleCheckoutWithMode('no-print') },
            { key: 'Alt+A', label: 'Pay A4 Print', colorClass: 'violet', action: () => handleCheckoutWithMode('print-a4') },
            { key: getShortcut('pos_home', 'clearBill', 'Alt+C'), label: 'Clear', colorClass: 'rose', action: clearBillHandler },
            { key: getShortcut('pos_home', 'directCash', 'Alt+1'), label: 'Direct Cash', colorClass: 'emerald', action: () => { if (billItems.length > 0) completePayment('Cash'); } },
            { key: getShortcut('pos_home', 'directBank', 'Ctrl+V'), label: 'Direct Bank', colorClass: 'sky', action: () => { if (billItems.length > 0) completePayment('Bank'); } },
            { key: getShortcut('pos_home', 'directCard', 'Alt+2'), label: 'Direct Card', colorClass: 'indigo', action: () => { if (billItems.length > 0) { setSelectedPaymentMode('Card'); setShowCardTerminalModal(true); } } },
            { key: getShortcut('pos_home', 'selectItem', 'Alt+I'), label: theme !== 'legacy' ? 'Select Item' : 'Swap Item', colorClass: 'indigo', action: () => {
                if (theme !== 'legacy') {
                    if (filteredItems.length > 0) {
                        setActiveCardIndex(prev => prev === -1 ? 0 : -1);
                    }
                } else {
                    triggerSwapItem();
                }
            } },
            { key: '↑ ↓', label: 'Navigate', colorClass: 'slate' },
            { key: '+ / -', label: 'Qty', colorClass: 'slate' },
            { key: '← / →', label: 'Tax Toggle', colorClass: 'slate' }
        ];

        return (
            <>
                {modernShortcutsData.filter(s => isShortcutShown(s.key)).map((s, idx) => (
                    <div
                        key={idx}
                        className={`so-shortcut-badge ${s.colorClass} group/badge relative`}
                        style={getBadgeStyle(s.colorClass)}
                        onClick={s.action}
                    >
                        <span className="so-shortcut-key">{formatKeyLabel(s.key)}</span>
                        <span className="so-shortcut-label" style={getLabelStyle()}>{s.label}</span>
                        {s.action && (
                            <span
                                onClick={(e) => { e.stopPropagation(); toggleHideShortcut(s.key); }}
                                className="ml-1 opacity-0 group-hover/badge:opacity-100 transition-opacity hover:text-red-500 cursor-pointer flex items-center justify-center"
                                title="Hide Shortcut"
                            >
                                <EyeOff size={11} />
                            </span>
                        )}
                    </div>
                ))}
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
            <div className="classic-shortcut-guide horizontal" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px', background: '#0f172a',
                borderBottom: shortcutsPosition === 'top' ? '2px solid #1e293b' : 'none',
                borderTop: shortcutsPosition === 'bottom' ? '2px solid #1e293b' : 'none',
                flexShrink: 0,
                overflow: 'hidden'
            }}>
                {renderDragHandle()}
                {renderShortcutsSelector()}
                <div style={{ height: '32px', width: '1px', background: '#334155', margin: '0 2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px 8px',
                    flex: 1,
                    minWidth: 0,
                    flexWrap: 'wrap',
                    overflow: 'hidden'
                }}>
                    {renderClassicShortcutsList(false)}
                </div>
            </div>
        );
    };

    const renderShortcutsVertical = (pos) => {
        return (
            <div className="classic-shortcut-guide vertical" style={{
                display: 'flex', flexDirection: 'column', gap: '6px',
                width: '185px', flexShrink: 0, padding: '10px',
                background: '#ffffff',
                borderRight: pos === 'left' ? '1px solid #e2e8f0' : 'none',
                borderLeft: pos === 'right' ? '1px solid #e2e8f0' : 'none',
                height: '100%',
                overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '4px', flexShrink: 0 }}>
                    {renderDragHandle()}
                    {renderShortcutsSelector()}
                </div>

                <div style={{ height: '1px', width: '100%', background: '#e2e8f0', marginBottom: '2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    flex: 1
                }}>
                    {renderClassicShortcutsList(true)}
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
            { key: getShortcut('pos_home', 'customer', 'F2'), label: 'Customer', color: '#3b82f6', icon: <User size={12} />, action: () => mobileInputRef.current?.focus() },
            { key: getShortcut('pos_home', 'search', 'F3'), label: 'Search', color: '#a855f7', icon: <Search size={12} />, action: () => barcodeInputRef.current?.focus() },
            {
                key: getShortcut('pos_home', 'countryCode', 'F4'), label: `CC (${countryCodePrefix})`, color: '#0ea5e9', icon: <Phone size={12} />, action: () => {
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
                key: getShortcut('pos_home', 'itemDetail', 'F5'), label: 'Item Detail', color: '#ec4899', icon: <Info size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        setSelectedDetailItem(billItems[selectedBillIndex]);
                        setShowItemDetailModal(true);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            { key: getShortcut('pos_home', 'bulkQty', 'F6'), label: 'Bulk Qty', color: '#d946ef', icon: <Layers size={12} />, action: handleBulkQtyUpdate },
            {
                key: getShortcut('pos_home', 'stock', 'F7'), label: 'Stock', color: '#f59e0b', icon: <Package size={12} />, action: () => {
                    if (lastInteractedItem) handleFindNearestStock(lastInteractedItem);
                    else Swal.fire('Info', 'Select an item first', 'info');
                }
            },
            {
                key: getShortcut('pos_home', 'uom', 'F8'), label: 'UOM Toggle', color: '#6366f1', icon: <RefreshCw size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const hasMb = item.custom_boxes_per_master_box && item.custom_boxes_per_master_box > 1;
                        let nextUom = 'Nos';
                        if (item.uom === 'Nos' || item.uom === 'Piece' || item.uom === (item.stock_uom || 'Nos')) {
                            nextUom = (item.custom_pieces_per_box && item.custom_pieces_per_box > 1) ? 'Box' : (hasMb ? 'Master Box' : 'Nos');
                        } else if (item.uom === 'Box') {
                            nextUom = hasMb ? 'Master Box' : (item.stock_uom || 'Nos');
                        } else {
                            nextUom = item.stock_uom || 'Nos';
                        }
                        toggleUom(item.id, nextUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'boxUom', 'Ctrl+B'), label: 'Box UOM', color: '#8b5cf6', icon: <Package size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        if (item.custom_pieces_per_box && item.custom_pieces_per_box > 1) {
                            const targetUom = item.uom === 'Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Box';
                            toggleUom(item.id, targetUom);
                        } else {
                            Swal.fire('Info', 'Box packaging not configured for this item', 'info');
                        }
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'masterBoxUom', 'Ctrl+M'), label: 'Master Box', color: '#6366f1', icon: <Package size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        if (item.custom_boxes_per_master_box && item.custom_boxes_per_master_box > 1) {
                            const targetUom = item.uom === 'Master Box' ? (item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece') : 'Master Box';
                            toggleUom(item.id, targetUom);
                            const totalMbPcs = (parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1);
                            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
                            Toast.fire({ icon: 'success', title: `UOM: ${targetUom} (${targetUom === 'Master Box' ? `${totalMbPcs} Pcs` : '1 Pc'})` });
                        } else {
                            Swal.fire('Info', 'Master Box packaging not configured for this item', 'info');
                        }
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            {
                key: getShortcut('pos_home', 'nosUom', 'Ctrl+N'), label: 'Nos / Unit', color: '#10b981', icon: <Tag size={12} />, action: () => {
                    if (selectedBillIndex !== -1) {
                        const item = billItems[selectedBillIndex];
                        const targetUom = item.stock_uom || (item.uom_conversions?.Nos ? 'Nos' : 'Piece') || 'Piece';
                        toggleUom(item.id, targetUom);
                    } else {
                        Swal.fire('Info', 'Select an item in cart first', 'info');
                    }
                }
            },
            { key: getShortcut('pos_home', 'orders', 'F9'), label: 'Orders', color: '#0369a1', icon: <Package size={12} />, action: () => setShowDraftsModal(prev => !prev) },
            { key: getShortcut('pos_home', 'printBill', 'F10'), label: 'Print Bill', color: '#6366f1', icon: <Printer size={12} />, action: handleShowRecentInvoicesPrint },
            { key: getShortcut('pos_home', 'printJob', 'Alt+P'), label: 'PRINT JOB', color: '#0ea5e9', icon: <Printer size={12} />, action: () => setShowPrintJobModal(true) },
            { key: getShortcut('pos_home', 'fastPrint', 'Alt+F'), label: 'FAST PRINT', color: '#e11d48', icon: <Zap size={12} />, action: () => setShowFastPrintModal(true) },
            { key: getShortcut('pos_home', 'itemFilter', 'Alt+S'), label: 'Item Filter', color: '#6366f1', icon: <SlidersHorizontal size={12} />, action: () => setShowItemSearchDrawer(true) },
            { key: getShortcut('pos_home', 'selectItem', 'Alt+I'), label: 'Swap Item', color: '#a855f7', icon: <RefreshCw size={12} />, action: triggerSwapItem },
            { key: '↑↓', label: 'Navigate', color: '#64748b', icon: <Move size={12} /> },
            { key: '+/-', label: 'Adjust Qty', color: '#64748b', icon: <Minus size={12} /> },
            { key: '←→', label: 'Tax Toggle', color: '#64748b', icon: <ArrowLeftRight size={12} /> },
        ];

        return classicShortcutsData.filter(s => isShortcutShown(s.key)).map((s, idx) => (
            <div
                key={idx}
                className="classic-shortcut-badge group hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm active:scale-95"
                onClick={s.action}
                style={{
                    flexShrink: 0,
                    width: isVertical ? '100%' : 'auto',
                    minWidth: isVertical ? '100%' : '125px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 10px',
                    background: '#f4fbf9',
                    border: '1.5px solid #bce3da',
                    borderRadius: '9999px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div className="classic-shortcut-icon" style={{ display: 'flex', flexShrink: 0, color: s.color || '#0ea5e9' }}>
                        {s.icon}
                    </div>
                    <span className="classic-shortcut-label text-[11px] font-black text-slate-850 whitespace-nowrap" style={{
                        color: '#0f172a',
                        fontWeight: 800
                    }}>
                        {s.label}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: '4px' }}>
                    <span
                        className="classic-shortcut-key font-mono font-black text-slate-900 text-[9.5px]"
                        style={{
                            background: '#ffffff',
                            border: '1px solid #a7f3d0',
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                            color: '#047857',
                            fontWeight: 900
                        }}
                    >
                        {formatKeyLabel(s.key)}
                    </span>
                </div>
            </div>
        ));
    };

    const renderClassicShortcutsHorizontal = () => {
        const isGreen = legacySubTheme === 'green';
        const borderColor = isGreen ? '#10b981' : '#0ea5e9';
        return (
            <div className="classic-shortcut-guide horizontal" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px',
                background: '#e6f4f1',
                borderBottom: '1px solid #c2e2da',
                flexShrink: 0,
                overflow: 'hidden'
            }}>
                {renderDragHandle()}
                {renderShortcutsSelector()}
                <div style={{ height: '32px', width: '2px', background: isGreen ? '#1e7556' : '#235985', margin: '0 2px', flexShrink: 0 }}></div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px 8px',
                    flex: 1,
                    minWidth: 0,
                    flexWrap: 'wrap',
                    overflow: 'hidden'
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
        return wrapWindowMode(
            <div className="so-page" style={{ height: '100%', maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* MODERN TOOL STRIP — Two-Zone Layout */}
                <div className="so-tool-strip" style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    maxWidth: '100%', boxSizing: 'border-box', overflow: 'visible',
                    minHeight: 'fit-content', padding: '0', gap: '0',
                    borderBottom: '1px solid #e2e8f0', background: '#ffffff',
                    position: 'relative', zIndex: 150
                }}>
                    {/* ── LEFT: Back to Dashboard & Logo ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '6px 14px', flexShrink: 0
                    }}>
                        {/* Back to Dashboard Button */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs group"
                            title="Back to Admin Dashboard"
                        >
                            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                            <LayoutDashboard size={13} />
                            <span>DASHBOARD</span>
                        </button>

                        {/* Kyle Retail Logo */}
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            <img src={kyleLogo} alt="Kyle Retail Logo" className="h-10 w-auto max-w-[120px] md:max-w-[180px] object-contain mix-blend-multiply transition-opacity duration-300 hover:opacity-90" />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Screen Mode Switcher: Fullscreen <-> Popup */}
                            <button
                                onClick={() => {
                                    const nextMode = posWindowMode === 'popup' ? 'fullscreen' : 'popup';
                                    setPosWindowMode(nextMode);
                                    localStorage.setItem('pos_window_mode', nextMode);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0 0.65rem', height: '1.85rem',
                                    background: posWindowMode === 'popup' ? '#ecfdf5' : '#f8fafc',
                                    border: `1.5px solid ${posWindowMode === 'popup' ? '#6ee7b7' : '#cbd5e1'}`,
                                    borderRadius: '0.375rem',
                                    fontSize: '0.65rem', fontWeight: 900,
                                    color: posWindowMode === 'popup' ? '#047857' : '#334155',
                                    cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease'
                                }}
                                title={posWindowMode === 'popup' ? "Switch to Full Screen (Alt+W)" : "Switch to Mini Popup Window (Alt+W)"}
                            >
                                {posWindowMode === 'popup' ? (
                                    <>
                                        <Maximize2 size={12} color="#047857" /> FULL SCREEN
                                    </>
                                ) : (
                                    <>
                                        <Minimize2 size={12} color="#475569" /> POPUP VIEW
                                    </>
                                )}
                                <span style={{ background: posWindowMode === 'popup' ? 'rgba(4, 120, 87, 0.15)' : '#e2e8f0', color: posWindowMode === 'popup' ? '#047857' : '#64748b', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', marginLeft: '2px', fontWeight: 800 }}>
                                    {isMac ? '⌥W' : 'Alt+W'}
                                </span>
                            </button>

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

                            {/* Print Job Calculator Header Button */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log("PRINT JOB Header button clicked!");
                                    setShowPrintJobModal(true);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0 0.65rem', height: '1.85rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                                    border: '1.5px solid #334155', borderRadius: '0.375rem',
                                    fontSize: '0.65rem', fontWeight: 900, color: '#38bdf8',
                                    cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0,
                                    whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.12)'
                                }}
                                title="Print Job Calculator & Barcode Generator"
                            >
                                <Printer size={12} color="#38bdf8" /> PRINT JOB
                                <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', marginLeft: '2px', fontWeight: 800 }}>
                                    {isMac ? '⌥P' : 'Alt+P'}
                                </span>
                            </button>

                            {/* Fast Print Header Button */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowFastPrintModal(true);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                    padding: '0 0.65rem', height: '1.85rem', background: 'linear-gradient(135deg, #881337, #be123c)',
                                    border: '1.5px solid #fda4af', borderRadius: '0.375rem',
                                    fontSize: '0.65rem', fontWeight: 900, color: '#ffffff',
                                    cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0,
                                    whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(225,29,72,0.2)'
                                }}
                                title="Fast Print - Enter Direct Amount & Machine Barcode"
                            >
                                <Zap size={12} color="#ffffff" /> FAST PRINT
                                <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', fontSize: '9px', padding: '1px 5px', borderRadius: '3px', marginLeft: '2px', fontWeight: 800 }}>
                                    {isMac ? '⌥F' : 'Alt+F'}
                                </span>
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
                                <CurrentTimeDisplay variant="legacy" />
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
                                onClick={() => {
                                    if (window.location.protocol === 'file:') {
                                        window.location.hash = '#/homepage';
                                    } else {
                                        window.open(window.location.origin + window.location.pathname + '#/homepage', '_blank');
                                    }
                                }}
                                style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '50%', flexShrink: 0 }}
                                title={window.location.protocol === 'file:' ? "Go to POS Homepage" : "Open POS in New Tab"}
                            >
                                <ExternalLink size={16} />
                            </button>

                            {/* Sales Invoice Quick Button */}
                            <button
                                onClick={() => {
                                    dispatch(setTheme('legacy'));
                                    navigate('/homepage');
                                }}
                                style={{ padding: '4px 8px', background: 'var(--so-primary-light, #f0fdf4)', border: '1px solid var(--so-primary, #10b981)', cursor: 'pointer', color: 'var(--so-primary, #10b981)', borderRadius: '8px', flexShrink: 0, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Sales Invoice (POS Classic)"
                            >
                                <Receipt size={14} />
                                <span>Sales Invoice</span>
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
                                        if (!showSettingsMenu) {
                                            setShowDropdown(false);
                                            setShowItemDropdown(false);
                                        }
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
                                        className="absolute right-0 top-full mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[999999] p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-200"
                                        style={{ borderTop: `4px solid var(--so-primary)`, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
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
                                            className="w-full bg-slate-50/50 hover:bg-slate-100/70 flex items-center justify-between transition-all group text-left"
                                            style={{
                                                height: '46px',
                                                padding: '8px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                                                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:scale-110 transition-transform flex items-center justify-center">
                                                    <LayoutDashboard size={14} />
                                                </div>
                                                Admin Dashboard
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                        </button>

                                        {/* Theme Switcher Button */}
                                        <button
                                            onClick={() => {
                                                setShowThemeSidebar(true);
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full bg-slate-50/50 hover:bg-slate-100/70 flex items-center justify-between transition-all group text-left"
                                            style={{
                                                height: '46px',
                                                padding: '8px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                                                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 group-hover:scale-110 transition-transform flex items-center justify-center">
                                                    <Palette size={14} />
                                                </div>
                                                Theme Config
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {legacySubTheme.toUpperCase()}
                                            </span>
                                        </button>

                                        {/* Hidden Shortcuts Panel */}
                                        <div className="border-t border-slate-100 pt-3 mt-1 text-left">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">
                                                Hidden Shortcuts ({hiddenShortcuts.length})
                                            </div>
                                            {hiddenShortcuts.length === 0 ? (
                                                <div className="text-[11px] font-bold text-slate-400 italic px-2">
                                                    No hidden shortcuts
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto px-1">
                                                    {allShortcutsList.filter(s => hiddenShortcuts.includes(s.key)).map(s => (
                                                        <div key={s.key} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">{s.key}</span>
                                                                <span className="text-[11px] font-bold text-slate-600">{s.label}</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleHideShortcut(s.key);
                                                                }}
                                                                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-all border-none bg-transparent cursor-pointer"
                                                                title="Show Shortcut"
                                                            >
                                                                <Eye size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {!hideAllShortcuts && shortcutsPosition === 'top' && (
                    <div style={{ flexShrink: 0, width: '100%' }}>
                        {renderShortcutsHorizontal()}
                    </div>
                )}

                <div style={{ display: 'flex', flex: '1 1 0%', minHeight: 0, width: '100%', overflow: 'hidden' }}>
                    <main className="so-main-layout" style={{ display: 'grid', gridTemplateColumns: '1fr var(--so-bill-width, 460px)', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', height: '100%' }}>
                            {!hideAllShortcuts && shortcutsPosition === 'left' && renderShortcutsVertical('left')}
                            <div className="so-item-side">
                                <div className="so-cat-bar">
                                    {/* Item Group & Item Multi-Filter Search Input */}
                                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shrink-0" style={{ height: '36px', width: '220px' }}>
                                        <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Search groups, items, codes..."
                                            value={groupSearch}
                                            onChange={(e) => setGroupSearch(e.target.value)}
                                            className="w-full text-xs font-bold text-slate-700 placeholder:text-slate-400 bg-transparent border-none outline-none"
                                        />
                                        {groupSearch && (
                                            <button
                                                onClick={() => setGroupSearch("")}
                                                className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center shrink-0 ml-1"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Advanced Search & Multi-Attribute Filter Drawer Button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowItemSearchDrawer(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
                                        title="Advanced Item Search & Filter (Alt+S)"
                                        style={{ height: '36px' }}
                                    >
                                        <SlidersHorizontal size={14} className="text-indigo-600" />
                                        <span>Filter & Search</span>
                                    </button>

                                    {filteredCategories.length > 5 && (
                                        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-200" onClick={handlePrevSlide}>
                                            <ChevronLeft size={18} />
                                        </button>
                                    )}
                                    <div className="so-cat-tabs" ref={categoryScrollRef}>
                                        {filteredCategories.map(cat => (
                                            <button
                                                key={cat}
                                                className={`so-cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                                                onClick={() => handleFilter(cat)}
                                            >
                                                {cat === "all" ? "All Categories" : cat}
                                            </button>
                                        ))}
                                    </div>
                                    {filteredCategories.length > 5 && (
                                        <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 border border-slate-200" onClick={handleNextSlide}>
                                            <ChevronRight size={18} />
                                        </button>
                                    )}

                                    {/* Premium Stock Filter Tabs (All / In Stock / Out of Stock) */}
                                    <div 
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            backgroundColor: '#f1f5f9',
                                            padding: '3px',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            marginLeft: 'auto',
                                            height: '36px',
                                            boxSizing: 'border-box',
                                            flexShrink: 0
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setStockFilter('all')}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: '9px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                letterSpacing: '0.02em',
                                                border: stockFilter === 'all' ? '1px solid #cbd5e1' : '1px solid transparent',
                                                backgroundColor: stockFilter === 'all' ? '#ffffff' : 'transparent',
                                                color: stockFilter === 'all' ? '#0f172a' : '#64748b',
                                                cursor: 'pointer',
                                                boxShadow: stockFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                                transition: 'all 0.15s ease',
                                                lineHeight: '1.2'
                                            }}
                                        >
                                            All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStockFilter(stockFilter === 'in_stock' ? 'all' : 'in_stock')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 10px',
                                                borderRadius: '9px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                letterSpacing: '0.02em',
                                                border: stockFilter === 'in_stock' ? '1px solid #059669' : '1px solid transparent',
                                                backgroundColor: stockFilter === 'in_stock' ? '#10b981' : 'transparent',
                                                color: stockFilter === 'in_stock' ? '#ffffff' : '#047857',
                                                cursor: 'pointer',
                                                boxShadow: stockFilter === 'in_stock' ? '0 2px 4px rgba(16, 185, 129, 0.25)' : 'none',
                                                transition: 'all 0.15s ease',
                                                lineHeight: '1.2'
                                            }}
                                        >
                                            <span 
                                                style={{
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    backgroundColor: stockFilter === 'in_stock' ? '#ffffff' : '#10b981'
                                                }}
                                            />
                                            In Stock
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 10px',
                                                borderRadius: '9px',
                                                fontSize: '11px',
                                                fontWeight: 800,
                                                letterSpacing: '0.02em',
                                                border: stockFilter === 'out_of_stock' ? '1px solid #e11d48' : '1px solid transparent',
                                                backgroundColor: stockFilter === 'out_of_stock' ? '#f43f5e' : 'transparent',
                                                color: stockFilter === 'out_of_stock' ? '#ffffff' : '#be123c',
                                                cursor: 'pointer',
                                                boxShadow: stockFilter === 'out_of_stock' ? '0 2px 4px rgba(244, 63, 94, 0.25)' : 'none',
                                                transition: 'all 0.15s ease',
                                                lineHeight: '1.2'
                                            }}
                                        >
                                            <span 
                                                style={{
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    backgroundColor: stockFilter === 'out_of_stock' ? '#ffffff' : '#f43f5e'
                                                }}
                                            />
                                            Out of Stock
                                        </button>
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
                                            filteredItems.map((item, index) => {
                                                const isBundle = item.is_bundle || (item.id && (item.id.includes('BUNDLE') || item.id.includes('COMBO'))) || (item.name && item.name.toLowerCase().includes('combo'));
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`so-item-card ${activeCardIndex === index ? 'focused-card' : ''} ${isBundle ? 'bundle-card' : ''}`}
                                                        onClick={() => {
                                                            setActiveCardIndex(index);
                                                            setLastInteractedItem(item);
                                                            if (item.local_qty > 0) {
                                                                handleAddToBill(item);
                                                            } else {
                                                                handleOutOfStockAlert(item);
                                                            }
                                                        }}
                                                        style={{
                                                            opacity: item.local_qty > 0 ? 1 : 0.6,
                                                            ...(isBundle ? {
                                                                borderColor: '#059669',
                                                                boxShadow: '0 0 0 2px #10b981, 0 4px 18px rgba(16, 185, 129, 0.15)',
                                                                background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)'
                                                            } : {})
                                                        }}
                                                    >
                                                        {isBundle && (
                                                            <div className="bundle-ribbon-tag">
                                                                <div className="bundle-ribbon-tag-content">
                                                                    ★ ★ ★<br />COMBO<br />BUNDLE
                                                                </div>
                                                            </div>
                                                        )}
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
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                            {!hideAllShortcuts && shortcutsPosition === 'right' && renderShortcutsVertical('right')}
                        </div>

                        {/* ==================== MODERN CART SECTION ==================== */}
                        <div className="so-bill-side" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, maxHeight: '100%', overflow: 'hidden', width: '100%' }}>

                            {/* CUSTOMER */}
                            <div className="so-bill-header" style={{ flexShrink: 0 }}>

                                <div className="so-customer-wrapper">
                                    <div className="so-customer-field">
                                        <CountryCodeSelector
                                            value={countryCodePrefix}
                                            onChange={(newVal) => {
                                                setCountryCodePrefix(newVal);
                                                localStorage.setItem('pos_country_code', newVal);
                                            }}
                                        />

                                        <input
                                            ref={mobileInputRef}
                                            type="text"
                                            placeholder="Enter Customer Mobile / Name..."
                                            value={customerMobile || (selectedCustomer && selectedCustomer.name !== 'Cash' ? (selectedCustomer.mobile_no || selectedCustomer.customer_name || selectedCustomer.name) : (customerName === 'Cash' ? '' : customerName))}
                                            onChange={(e) => {
                                                justSelectedCustomerRef.current = false;
                                                setActiveCustomerIndex(-1);
                                                const val = e.target.value;

                                                if (/^[\d+]*$/.test(val)) {
                                                    let cleaned = val.replace(/\D/g, '');
                                                    while (cleaned.startsWith('0')) {
                                                        cleaned = cleaned.slice(1);
                                                    }
                                                    const rule = getCountryRule(countryCodePrefix);
                                                    const restricted = cleaned.slice(0, rule.maxLen);
                                                    setCustomerMobile(restricted);
                                                    setCustomerName('');
                                                } else {
                                                    setCustomerName(val);
                                                    setCustomerMobile('');
                                                }

                                                if (selectedCustomer) setSelectedCustomer(null);
                                                if (val.trim().length >= 1) {
                                                    setShowDropdown(true);
                                                }
                                            }}
                                            onFocus={() => {
                                                setSearchContext('customer');
                                                if (
                                                    !selectedCustomer &&
                                                    !justSelectedCustomerRef.current &&
                                                    (customerMobile || customerName).trim().length >= 1
                                                ) {
                                                    setShowDropdown(true);
                                                }
                                                setShowSettingsMenu(false);
                                            }}
                                            onBlur={() => {
                                                if (!customerMobile && !customerName.trim() && !selectedCustomer) {
                                                    setCustomerName('Cash');
                                                }
                                            }}
                                            onKeyDown={handleMobileEnter}
                                            className="so-customer-input"
                                        />

                                        {customerLoading ? (
                                            <Loader2 className="so-customer-status-icon animate-spin" size={15} />
                                        ) : (
                                            <Phone className="so-customer-status-icon" size={15} />
                                        )}
                                    </div>

                                    {showDropdown && (
                                        <div
                                            ref={dropdownRef}
                                            className="so-customer-dropdown animate-in fade-in slide-in-from-top-2 duration-150"
                                        >
                                            {searchResults.map((c, idx) => {
                                                const isSelected = idx === activeCustomerIndex;

                                                return (
                                                    <div
                                                        key={c.name}
                                                        id={`cust-item-0-${idx}`}
                                                        onMouseDown={() => {
                                                            pickCustomer(c);
                                                            setActiveCustomerIndex(-1);
                                                        }}
                                                        className={`so-customer-dropdown-item ${
                                                            isSelected ? 'active' : ''
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="so-customer-name">
                                                                {c.customer_name}
                                                            </div>

                                                            <div className="so-customer-mobile">
                                                                <Phone size={10} />
                                                                {c.mobile_no}
                                                            </div>
                                                        </div>

                                                        <ChevronRight size={14} />
                                                    </div>
                                                );
                                            })}

                                            <div
                                                onMouseDown={() => openCreate(customerMobile || customerName.trim())}
                                                className="so-customer-register-btn"
                                            >
                                                + Register New Customer
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* SEARCH */}
                                <div className="so-cart-search">
                                    <Search size={16} className="so-cart-search-icon" />

                                    <input
                                        ref={barcodeInputRef}
                                        type="text"
                                        placeholder="SCAN / SEARCH PRODUCT..."
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyDown={onBarcodeKeyDown}
                                        onFocus={() => {
                                            setActiveCardIndex(-1);
                                            setShowSettingsMenu(false);
                                        }}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowCamera(true)}
                                        className="so-cart-camera"
                                        title="Camera Barcode Scanner"
                                    >
                                        <Camera size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* CART ITEMS */}
                            <div className="so-bill-items" style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', width: '100%' }}>

                                {billItems.length === 0 ? (
                                    <div className="so-cart-empty">
                                        <ShoppingCart size={34} />
                                        <span>Cart is empty</span>
                                        <small>Scan or search a product to add it</small>
                                    </div>
                                ) : (
                                    billItems.map((item, idx) => {

                                        const isActive = idx === selectedBillIndex;

                                        const itemName =
                                            item.name ||
                                            item.item_name ||
                                            item.item_code ||
                                            item.id;

                                        const barcodeValue =
                                            item.barcode ||
                                            item.barcodes?.[0]?.barcode ||
                                            item.barcodes?.[0] ||
                                            item.custom_ref_sl_no ||
                                            item.id ||
                                            '';

                                        const qty = parseFloat(item.qty || item.quantity || 1);

                                        const price = parseFloat(item.price || 0);

                                        const hasBox =
                                            parseFloat(item.custom_pieces_per_box || 0) > 1;

                                        const hasMasterBox =
                                            parseFloat(item.custom_boxes_per_master_box || 0) > 1;

                                        const isInc = item.is_tax_inclusive !== false;
                                        const currentTaxRate = parseFloat(taxRate) || 5;
                                        const lineTotalBase = price * qty;
                                        const lineNet = isInc ? (lineTotalBase / (1 + currentTaxRate / 100)) : lineTotalBase;
                                        const lineTax = isInc ? (lineTotalBase - lineNet) : (lineTotalBase * (currentTaxRate / 100));
                                        const lineTotal = isInc ? lineTotalBase : (lineNet + lineTax);

                                        return (
                                            <div
                                                key={`${item.id}-${idx}`}
                                                className={`so-cart-item ${
                                                    isActive ? 'is-active' : ''
                                                }`}
                                                onClick={() => setSelectedBillIndex(idx)}
                                            >

                                                {/* TOP */}
                                                <div className="so-cart-item-top">

                                                    <div className="so-cart-item-info">

                                                        <div
                                                            className="so-cart-item-name"
                                                            title={itemName}
                                                        >
                                                            {itemName}
                                                        </div>

                                                        <div
                                                            className="so-cart-item-barcode"
                                                            title={String(barcodeValue)}
                                                        >
                                                            <Barcode size={10} />
                                                            <span>
                                                                {barcodeValue || '-'}
                                                            </span>
                                                        </div>

                                                    </div>

                                                    {/* INC / EXC Toggle Badge */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newBill = [...billItems];
                                                            newBill[idx].is_tax_inclusive = !isInc;
                                                            setBillItems(newBill);
                                                        }}
                                                        className={`so-cart-tax-badge ${isInc ? 'inc' : 'exc'}`}
                                                        title={`Tax ${isInc ? 'Inclusive' : 'Exclusive'} - Click to toggle (or use shortcut)`}
                                                    >
                                                        {isInc ? 'INC' : 'EXC'}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="so-cart-remove"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeFromBill(item.id);
                                                        }}
                                                        title="Remove item"
                                                    >
                                                        <X size={13} />
                                                    </button>
                                                </div>

                                                {/* MIDDLE */}
                                                <div className="so-cart-item-middle">

                                                    {/* UOM */}
                                                    <div className="so-cart-uom">

                                                        <span className="so-cart-label">
                                                            UOM
                                                        </span>

                                                        <div className="so-uom-buttons">

                                                            <button
                                                                type="button"
                                                                className={
                                                                    item.uom !== 'Box' &&
                                                                    item.uom !== 'Master Box'
                                                                        ? 'active'
                                                                        : ''
                                                                }
                                                                onClick={(e) => {
                                                                    e.stopPropagation();

                                                                    const targetUom =
                                                                        item.stock_uom ||
                                                                        (
                                                                            item.uom_conversions?.Nos
                                                                                ? 'Nos'
                                                                                : 'Piece'
                                                                        );

                                                                    toggleUom(
                                                                        item.id,
                                                                        targetUom
                                                                    );
                                                                }}
                                                            >
                                                                {item.stock_uom || 'Nos'}
                                                            </button>

                                                            {hasBox && (
                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        item.uom === 'Box'
                                                                            ? 'active'
                                                                            : ''
                                                                    }
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleUom(
                                                                            item.id,
                                                                            'Box'
                                                                        );
                                                                    }}
                                                                >
                                                                    BOX
                                                                </button>
                                                            )}

                                                            {hasMasterBox && (
                                                                <button
                                                                    type="button"
                                                                    className={
                                                                        item.uom === 'Master Box'
                                                                            ? 'active'
                                                                            : ''
                                                                    }
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleUom(
                                                                            item.id,
                                                                            'Master Box'
                                                                        );
                                                                    }}
                                                                >
                                                                    MASTER
                                                                </button>
                                                            )}

                                                        </div>
                                                    </div>

                                                    {/* QTY */}
                                                    <div className="so-cart-qty">

                                                        <span className="so-cart-label">
                                                            QTY
                                                        </span>

                                                        <div className="so-qty-control">

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setQuantity(
                                                                        item.id,
                                                                        Math.max(1, qty - 1)
                                                                    );
                                                                }}
                                                            >
                                                                −
                                                            </button>

                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={qty}
                                                                onChange={(e) => {
                                                                    const value =
                                                                        parseFloat(
                                                                            e.target.value
                                                                        ) || 1;

                                                                    setQuantity(
                                                                        item.id,
                                                                        value
                                                                    );
                                                                }}
                                                                onClick={(e) =>
                                                                    e.stopPropagation()
                                                                }
                                                            />

                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setQuantity(
                                                                        item.id,
                                                                        qty + 1
                                                                    );
                                                                }}
                                                            >
                                                                +
                                                            </button>

                                                        </div>
                                                    </div>

                                                    {/* PRICE */}
                                                    <div className="so-cart-price">

                                                        <span className="so-cart-label">
                                                            PRICE {isInc ? '(INC)' : '(EXC)'}
                                                        </span>

                                                        <span className="so-cart-price-value">
                                                            <DirhamIcon size={10} />
                                                            {price.toFixed(2)}
                                                        </span>

                                                    </div>

                                                </div>

                                                {/* BOTTOM INFO */}
                                                <div className="so-cart-item-bottom">

                                                    <div>
                                                        <span>NET</span>
                                                        <strong>
                                                            <DirhamIcon size={9} />
                                                            {lineNet.toFixed(2)}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>VAT ({currentTaxRate}%)</span>
                                                        <strong className="vat-value">
                                                            <DirhamIcon size={9} />
                                                            {lineTax.toFixed(2)}
                                                        </strong>
                                                    </div>

                                                    <div className="so-cart-line-total">
                                                        <span>TOTAL</span>
                                                        <strong>
                                                            <DirhamIcon size={10} />
                                                            {lineTotal.toFixed(2)}
                                                        </strong>
                                                    </div>

                                                </div>

                                                {/* PREVIOUS SALE */}
                                                <div className="so-previous-sale">

                                                    <span className="so-previous-sale-label">
                                                        <History size={10} />
                                                        Previous Sale
                                                    </span>

                                                    <span className="so-previous-sale-value">
                                                        {(() => {
                                                            const info =
                                                                item.previous_sale ||
                                                                item.previousSale;

                                                            if (
                                                                info &&
                                                                typeof info === 'object'
                                                            ) {
                                                                return (
                                                                    <>
                                                                        <DirhamIcon size={8} />
                                                                        {parseFloat(
                                                                            info.rate || 0
                                                                        ).toFixed(2)}

                                                                        {info.posting_date && (
                                                                            <em>
                                                                                ({info.posting_date})
                                                                            </em>
                                                                        )}
                                                                    </>
                                                                );
                                                            }

                                                            if (
                                                                info !== undefined &&
                                                                info !== null &&
                                                                info !== ''
                                                            ) {
                                                                return (
                                                                    <>
                                                                        <DirhamIcon size={8} />
                                                                        {parseFloat(
                                                                            info || 0
                                                                        ).toFixed(2)}
                                                                    </>
                                                                );
                                                            }

                                                            return (
                                                                <span className="no-previous-sale">
                                                                    No previous sale
                                                                </span>
                                                            );
                                                        })()}
                                                    </span>

                                                </div>

                                            </div>
                                        );
                                    })
                                )}

                            </div>

                            {/* FOOTER */}
                            <div className="so-bill-footer" style={{ flexShrink: 0, marginTop: 'auto', width: '100%', position: 'sticky', bottom: 0, zIndex: 30, background: '#ffffff' }}>

                                <div className="so-cart-footer-top">

                                    {/* ACTIONS */}
                                    <div className="so-cart-actions">

                                        <button
                                            type="button"
                                            onClick={() => setShowDiscountModal(true)}
                                            className="so-cart-action discount"
                                        >
                                            <span>
                                                <Percent size={14} />
                                                DISCOUNT
                                            </span>

                                            <kbd>
                                                F1
                                            </kbd>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleLoyaltyPointsClick}
                                            className="so-cart-action loyalty"
                                        >
                                            <span>
                                                <Gift size={14} />
                                                LOYALTY
                                            </span>

                                            <kbd>
                                                {formatKeyLabel(
                                                    getShortcut(
                                                        'pos_home',
                                                        'loyalty',
                                                        'Alt+L'
                                                    )
                                                )}
                                            </kbd>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSaveDraft}
                                            className="so-cart-action draft"
                                        >
                                            <span>
                                                <Upload size={14} />
                                                SAVE DRAFT
                                            </span>

                                            <kbd>
                                                {formatKeyLabel(
                                                    getShortcut(
                                                        'pos_home',
                                                        'saveDraft',
                                                        'Alt+S'
                                                    )
                                                )}
                                            </kbd>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={clearBillHandler}
                                            className="so-cart-action reset"
                                        >
                                            <span>
                                                <Trash2 size={14} />
                                                RESET
                                            </span>

                                            <kbd>
                                                {formatKeyLabel(
                                                    getShortcut(
                                                        'pos_home',
                                                        'clearBill',
                                                        'Alt+C'
                                                    )
                                                )}
                                            </kbd>
                                        </button>

                                    </div>

                                    {/* TOTALS */}
                                    <div className="so-cart-summary">

                                        <div className="so-summary-row">
                                            <span>Subtotal</span>

                                            <strong>
                                                <DirhamIcon size={10} />
                                                {displaySubtotal.toFixed(2)}
                                            </strong>
                                        </div>

                                        {discount.value > 0 && (
                                            <div className="so-summary-row discount-row">
                                                <span>
                                                    Discount
                                                    {discount.type === 'percent'
                                                        ? ` (${discount.value}%)`
                                                        : ''}
                                                </span>

                                                <strong>
                                                    −
                                                    <DirhamIcon size={10} />
                                                    {displayDiscount.toFixed(2)}
                                                </strong>
                                            </div>
                                        )}

                                        {loyaltyAmount > 0 && (
                                            <div className="so-summary-row loyalty-row">
                                                <span>
                                                    Loyalty
                                                </span>

                                                <strong>
                                                    −
                                                    <DirhamIcon size={10} />
                                                    {loyaltyAmount.toFixed(2)}
                                                </strong>
                                            </div>
                                        )}

                                        <div className="so-summary-row">
                                            <span>
                                                Tax ({taxRate}%)
                                            </span>

                                            <strong>
                                                <DirhamIcon size={10} />
                                                {displayTax.toFixed(2)}
                                            </strong>
                                        </div>

                                        <div className="so-grand-total">
                                            <span>TOTAL</span>

                                            <strong>
                                                <DirhamIcon size={16} />
                                                {grandTotal.toFixed(2)}
                                            </strong>
                                        </div>

                                    </div>

                                </div>

                                {/* PAYMENT METHODS */}
                                <div className="so-payment-methods">

                                    <button
                                        type="button"
                                        className="so-payment-method cash"
                                        disabled={paymentLoading}
                                        onClick={() => {
                                            setShowSettingsMenu(false);

                                            if (billItems.length > 0) {
                                                completePayment('Cash');
                                            } else {
                                                Swal.fire(
                                                    'Info',
                                                    'No items in bill',
                                                    'info'
                                                );
                                            }
                                        }}
                                    >
                                        <div className="so-btn-left">
                                            <Banknote size={15} />
                                            <span>CASH</span>
                                        </div>
                                        <kbd>
                                            {formatKeyLabel(
                                                getShortcut(
                                                    'pos_home',
                                                    'directCash',
                                                    'Alt+1'
                                                )
                                            )}
                                        </kbd>
                                    </button>

                                    <button
                                        type="button"
                                        className="so-payment-method bank"
                                        disabled={paymentLoading}
                                        onClick={() => {
                                            setShowSettingsMenu(false);

                                            if (billItems.length > 0) {
                                                setSelectedPaymentMode('Bank');
                                                setShowCardTerminalModal(true);
                                            } else {
                                                Swal.fire(
                                                    'Info',
                                                    'No items in bill',
                                                    'info'
                                                );
                                            }
                                        }}
                                    >
                                        <div className="so-btn-left">
                                            <Landmark size={15} />
                                            <span>BANK</span>
                                        </div>
                                        <kbd>Alt+V</kbd>
                                    </button>

                                    <button
                                        type="button"
                                        className="so-payment-method card"
                                        disabled={paymentLoading}
                                        onClick={() => {
                                            setShowSettingsMenu(false);

                                            if (billItems.length > 0) {
                                                setSelectedPaymentMode('Card');
                                                setShowCardTerminalModal(true);
                                            } else {
                                                Swal.fire(
                                                    'Info',
                                                    'No items in bill',
                                                    'info'
                                                );
                                            }
                                        }}
                                    >
                                        <div className="so-btn-left">
                                            <CreditCard size={15} />
                                            <span>CARD</span>
                                        </div>
                                        <kbd>Alt+2</kbd>
                                    </button>

                                </div>

                                {/* FINAL PAYMENTS */}
                                <div className="so-final-payment-buttons">

                                    <button
                                        type="button"
                                        className="so-final-payment print"
                                        disabled={paymentLoading || billItems.length === 0}
                                        onClick={() =>
                                            handleCheckoutWithMode('print')
                                        }
                                    >
                                        <div className="so-btn-left">
                                            <Printer size={15} />
                                            <span>PAY & PRINT</span>
                                        </div>
                                        <kbd>SPACE</kbd>
                                    </button>

                                    <button
                                        type="button"
                                        className="so-final-payment no-print"
                                        disabled={paymentLoading || billItems.length === 0}
                                        onClick={() =>
                                            handleCheckoutWithMode('no-print')
                                        }
                                    >
                                        <div className="so-btn-left">
                                            <Receipt size={15} />
                                            <span>PAY NO PRINT</span>
                                        </div>
                                        <kbd>CTRL+N</kbd>
                                    </button>

                                    <button
                                        type="button"
                                        className="so-final-payment a4"
                                        disabled={paymentLoading || billItems.length === 0}
                                        onClick={() =>
                                            handleCheckoutWithMode('print-a4')
                                        }
                                    >
                                        <div className="so-btn-left">
                                            <Printer size={15} />
                                            <span>PAY A4 PRINT</span>
                                        </div>
                                        <kbd>ALT+A</kbd>
                                    </button>

                                </div>

                            </div>

                        </div>
                    </main>
                </div>

                {!hideAllShortcuts && shortcutsPosition === 'bottom' && (
                    <div style={{ flexShrink: 0, width: '100%' }}>
                        {renderShortcutsHorizontal()}
                    </div>
                )}

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

        return wrapWindowMode(
            <div className={`classic-root ${!isGreen ? 'theme-blue' : ''}`} style={{ position: 'relative', height: '100%', maxHeight: '100%' }}>

                {/* CLASSIC NAVBAR */}
                <nav className="classic-nav">
                    <div className="flex items-center gap-3 pl-2 py-1">
                        {/* Back to Dashboard Button */}
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs group mr-1"
                            title="Back to Admin Dashboard"
                        >
                            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                            <LayoutDashboard size={13} />
                            <span>DASHBOARD</span>
                        </button>

                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img src={kyleLogo} alt="Kyle Retail Logo" className="h-9 w-auto max-w-[140px] md:max-w-[180px] object-contain transition-opacity duration-300 hover:opacity-90" />
                            <div className="flex flex-col">
                                <span className="font-extrabold text-[13px] tracking-wider text-slate-800 uppercase leading-none">KYLE RETAIL</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">POINT OF SALE</span>
                            </div>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center pr-2" style={{ gap: '12px' }}>
                        {/* Group 3: Utilities in Uniform Iconic Cards */}
                        <div className="flex items-center gap-2.5">
                            {/* Screen Mode Switcher Button */}
                            <button
                                onClick={() => {
                                    const nextMode = posWindowMode === 'popup' ? 'fullscreen' : 'popup';
                                    setPosWindowMode(nextMode);
                                    localStorage.setItem('pos_window_mode', nextMode);
                                }}
                                className={`h-9 px-2.5 flex items-center gap-1.5 bg-[#f4fbf9] border border-[#bce3da] text-slate-600 hover:bg-[#e6f4f1] hover:text-emerald-700 transition-all cursor-pointer shadow-sm ${posWindowMode === 'popup' ? 'bg-emerald-50 text-emerald-700 font-extrabold border-emerald-400' : ''}`}
                                style={{ borderRadius: '9999px', fontSize: '11px', fontWeight: 800 }}
                                title={posWindowMode === 'popup' ? "Switch to Full Screen (Alt+W)" : "Switch to Mini Popup Window (Alt+W)"}
                            >
                                {posWindowMode === 'popup' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                <span className="hidden sm:inline">{posWindowMode === 'popup' ? 'FULL' : 'POPUP'}</span>
                                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '9px', padding: '1px 4px', borderRadius: '3px', fontWeight: 800 }}>
                                    {isMac ? '⌥W' : 'Alt+W'}
                                </span>
                            </button>

                            {/* Connection Status Badge */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f4fbf9] border border-[#bce3da] shadow-sm select-none transition-all hover:bg-[#e6f4f1] cursor-pointer" style={{ borderRadius: '9999px' }}>
                                <div className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isOffline ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {isOffline ? 'OFFLINE' : 'ONLINE'}
                                </span>
                            </div>

                            {/* Notification Bell Dropdown Button */}
                            <div className="nav-notification-container" ref={notificationsContainerRef}>
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className={`w-9 h-9 flex items-center justify-center bg-[#f4fbf9] border border-[#bce3da] text-slate-700 hover:bg-[#e6f4f1] hover:text-emerald-700 transition-all cursor-pointer shadow-sm relative ${unreadCount > 0 ? "animate-pulse-subtle" : ""}`}
                                    style={{ borderRadius: '9999px' }}
                                    title="Notifications"
                                >
                                    <Bell size={16} className="text-slate-600" />
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
                                onClick={() => {
                                    if (window.location.protocol === 'file:') {
                                        window.location.hash = '#/homepage';
                                    } else {
                                        window.open(window.location.origin + window.location.pathname + '#/homepage', '_blank');
                                    }
                                }}
                                className="w-9 h-9 flex items-center justify-center bg-[#f4fbf9] border border-[#bce3da] text-slate-600 hover:bg-[#e6f4f1] hover:text-emerald-700 transition-all cursor-pointer shadow-sm"
                                style={{ borderRadius: '9999px' }}
                                title={window.location.protocol === 'file:' ? "Go to POS Homepage" : "Open POS in New Tab"}
                            >
                                <ExternalLink size={16} />
                            </button>

                            {/* Dropdown Settings Button */}
                            <div className="relative" ref={settingsDropdownRef}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSettingsMenu(!showSettingsMenu);
                                        if (!showSettingsMenu) {
                                            setShowDropdown(false);
                                            setShowItemDropdown(false);
                                        }
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className={`w-9 h-9 flex items-center justify-center bg-[#f4fbf9] border border-[#bce3da] text-slate-600 hover:bg-[#e6f4f1] hover:text-emerald-700 transition-all cursor-pointer shadow-sm ${showSettingsMenu ? 'bg-[#e6f4f1] border-emerald-400' : ''}`}
                                    style={{ borderRadius: '9999px' }}
                                    title="Settings"
                                >
                                    <Settings size={16} className={showSettingsMenu ? 'animate-spin-slow' : ''} />
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
                                            className="w-full bg-slate-50/50 hover:bg-slate-100/70 flex items-center justify-between transition-all group text-left"
                                            style={{
                                                height: '46px',
                                                padding: '8px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                                                <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-emerald-50 text-emerald-500' : 'bg-sky-50 text-sky-505'} group-hover:scale-110 transition-transform flex items-center justify-center`}>
                                                    <LayoutDashboard size={14} />
                                                </div>
                                                Admin Dashboard
                                            </div>
                                            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                        </button>

                                        {/* Theme Switcher Button */}
                                        <button
                                            onClick={() => {
                                                setShowThemeSidebar(true);
                                                setShowSettingsMenu(false);
                                            }}
                                            className="w-full bg-slate-50/50 hover:bg-slate-100/70 flex items-center justify-between transition-all group text-left"
                                            style={{
                                                height: '46px',
                                                padding: '8px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 font-bold text-[11px] text-slate-700 uppercase tracking-wider">
                                                <div className={`p-1.5 rounded-lg ${isGreen ? 'bg-emerald-50 text-emerald-500' : 'bg-sky-50 text-sky-550'} group-hover:scale-110 transition-transform flex items-center justify-center`}>
                                                    <Palette size={14} />
                                                </div>
                                                Theme Config
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm border border-slate-200/40 ${isGreen ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`} style={{ display: 'inline-flex', alignItems: 'center', justifycontent: 'center' }}>
                                                {legacySubTheme.toUpperCase()}
                                            </span>
                                        </button>

                                        {/* Hidden Shortcuts Panel */}
                                        <div className="border-t border-slate-100 pt-3 mt-1 text-left">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">
                                                Hidden Shortcuts ({hiddenShortcuts.length})
                                            </div>
                                            {hiddenShortcuts.length === 0 ? (
                                                <div className="text-[11px] font-bold text-slate-400 italic px-2">
                                                    No hidden shortcuts
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto px-1">
                                                    {allShortcutsList.filter(s => hiddenShortcuts.includes(s.key)).map(s => (
                                                        <div key={s.key} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">{s.key}</span>
                                                                <span className="text-[11px] font-bold text-slate-600">{s.label}</span>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleHideShortcut(s.key);
                                                                }}
                                                                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-all border-none bg-transparent cursor-pointer"
                                                                title="Show Shortcut"
                                                            >
                                                                <Eye size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ width: '1px', height: '24px', background: isGreen ? '#4a9a72' : '#4a7aaa', opacity: 0.5, flexShrink: 0 }} />

                        {/* Group 2: Cashier Profile Info */}
                        <div className="flex items-center gap-3">
                            <div
                                onClick={() => setShowThemeSidebar(true)}
                                className="flex items-center gap-2.5 cursor-pointer"
                                title="Open Theme Settings Sidebar"
                            >
                                <div className="flex flex-col items-end text-right">
                                    <span className="user-name font-black uppercase text-slate-800" style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', lineHeight: '1.2' }}>
                                        {user?.full_name || (typeof user === 'string' ? user : '') || 'CASHIER'}
                                    </span>
                                    <CurrentTimeDisplay variant="modern" />
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                                    <UserIcon size={16} />
                                </div>
                            </div>
                            <button onClick={handleLogout} className="text-rose-500 hover:text-rose-700 transition-all p-1 hover:bg-rose-50 rounded-full cursor-pointer border-none bg-transparent flex items-center justify-center animate-in fade-in" title="Logout">
                                <Power size={18} />
                            </button>
                        </div>
                    </div>
                </nav>

                {/* CLASSIC SHORTCUTS GUIDE - RELOCATED TO TOP */}
                {!hideAllShortcuts && shortcutsPosition === 'top' && renderClassicShortcutsHorizontal()}

                {/* CLASSIC HEADER FORM - 4 MODERN PREMIUM CARDS */}
                <div className="classic-header-form flex items-stretch gap-2.5 w-full bg-slate-100/60 p-2 border-b border-slate-200/90">
                    {/* Card 1: Customer Phone */}
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:shadow-[0_2px_12px_rgba(16,185,129,0.12)] rounded-xl px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-xs transition-all duration-200 flex-1 min-w-[220px] flex items-center gap-2.5 relative" ref={dropdownRef}>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/15 to-teal-500/25 text-emerald-700 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                            <Phone size={14} strokeWidth={2.4} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Customer Phone</span>
                            <div className="flex items-center w-full min-w-0">
                                <CountryCodeSelector
                                    value={countryCodePrefix}
                                    variant="classic"
                                    onChange={newVal => {
                                        setCountryCodePrefix(newVal);
                                        localStorage.setItem('pos_country_code', newVal);
                                    }}
                                />
                                <div className="h-4 w-[1px] bg-slate-200 mx-1.5 shrink-0" />
                                <input
                                    ref={mobileInputRef}
                                    value={customerMobile || (selectedCustomer && selectedCustomer.name !== 'Cash' ? (selectedCustomer.mobile_no || selectedCustomer.name) : customerName)}
                                    onChange={e => {
                                        justSelectedCustomerRef.current = false;
                                        setActiveCustomerIndex(-1);
                                        const val = e.target.value;
                                        if (/^[\d+]*$/.test(val)) {
                                            let cleaned = val.replace(/\D/g, '');
                                            while (cleaned.startsWith('0')) {
                                                cleaned = cleaned.slice(1);
                                            }
                                            const rule = getCountryRule(countryCodePrefix);
                                            const restricted = cleaned.slice(0, rule.maxLen);
                                            setCustomerMobile(restricted);
                                            setCustomerName('');
                                        } else {
                                            setCustomerName(val);
                                            setCustomerMobile('');
                                        }
                                        if (selectedCustomer) setSelectedCustomer(null);
                                    }}
                                    onFocus={() => { setSearchContext('customer'); if (!selectedCustomer && !justSelectedCustomerRef.current && (customerMobile || customerName).trim().length >= 1) setShowDropdown(true); setShowSettingsMenu(false); }}
                                    onClick={() => { setSearchContext('customer'); if (!selectedCustomer && !justSelectedCustomerRef.current && (customerMobile || customerName).trim().length >= 1) setShowDropdown(true); setShowSettingsMenu(false); }}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
                                    onKeyDown={handleMobileEnter}
                                    className="flex-1 h-5 px-1 text-xs font-black outline-none bg-transparent text-slate-800 placeholder:text-slate-400 placeholder:font-normal min-w-0"
                                    placeholder="Enter phone or name"
                                />

                                {customerLoading && (
                                    <div className="pr-1 flex items-center">
                                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {showDropdown && (
                            <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] max-h-56 overflow-y-auto mt-1.5 py-1">
                                {searchResults.length === 0 ? (
                                    <div style={{ padding: '12px 14px', color: '#64748b', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                        {(customerMobile || customerName).trim().length < 2 ? 'Type 2+ chars' : 'No customers found'}
                                    </div>
                                ) : searchResults.map((c, idx) => {
                                    const isSelected = idx === activeCustomerIndex;
                                    return (
                                        <div
                                            key={c.name}
                                            id={`cust-item-1-${idx}`}
                                            className={`cursor-pointer text-xs transition-colors ${isSelected ? 'bg-emerald-100 text-emerald-950 font-black' : 'hover:bg-slate-50 text-slate-700 font-semibold'}`}
                                            style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}
                                            onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); setActiveCustomerIndex(-1); }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate">{c.customer_name}</span>
                                                {c.mobile_no && (
                                                    <span className="text-[10px] opacity-60 font-mono bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0 text-slate-700">{c.mobile_no}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {searchResults.every(c => c.customer_name.toLowerCase() !== (customerMobile || customerName).trim().toLowerCase()) && (customerMobile || customerName).trim() && (
                                    <div
                                        onMouseDown={(e) => { e.preventDefault(); openCreate((customerMobile || customerName).trim()); }}
                                        className="bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-wider cursor-pointer hover:bg-emerald-100 text-center border-t border-emerald-100 transition-colors"
                                        style={{ padding: '10px 14px' }}
                                    >
                                        + Register New Customer
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Card 2: Customer */}
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 hover:border-slate-300 rounded-xl px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-xs transition-all duration-200 flex-1 min-w-[200px] flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/15 to-teal-500/25 text-teal-700 border border-teal-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                <User size={14} strokeWidth={2.4} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Customer</span>
                                <span className="truncate text-xs font-black text-slate-900 uppercase tracking-tight block" title={selectedCustomer?.customer_name || customerName || 'Cash'}>
                                    {selectedCustomer?.customer_name || customerName || 'Cash'}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => selectedCustomer && selectedCustomer.name !== 'Cash' ? openEditCustomer(selectedCustomer) : openCreate(customerMobile || customerName)}
                            className="group/btn h-7 px-2.5 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 hover:border-teal-600 text-[11px] font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:shadow-xs"
                            title="Edit Customer Details"
                        >
                            <Pencil size={11} strokeWidth={2.5} className="transition-transform duration-150 group-hover/btn:-rotate-12" />
                            <span>Edit</span>
                        </button>
                    </div>

                    {/* Card 3: Tier / Group */}
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 hover:border-slate-300 rounded-xl px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-xs transition-all duration-200 flex-1 min-w-[200px] flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-500/15 to-indigo-500/25 text-indigo-700 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                <Users size={14} strokeWidth={2.4} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Tier / Group</span>
                                <span className="truncate text-xs font-black text-slate-900 uppercase tracking-tight block" title={selectedCustomer ? (selectedCustomer.customer_group || 'Retail Customer') : 'Retail Customer'}>
                                    {selectedCustomer ? (selectedCustomer.customer_group || 'Retail Customer') : 'Retail Customer'}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => openCustomerGroupChangeModal(selectedCustomer)}
                            className="group/btn h-7 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-[11px] font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:shadow-xs"
                            title="Edit Customer Group / Pricing Tier"
                        >
                            <Pencil size={11} strokeWidth={2.5} className="transition-transform duration-150 group-hover/btn:-rotate-12" />
                            <span>Edit</span>
                        </button>
                    </div>

                    {/* Card 4: Invoice No */}
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 hover:border-slate-300 rounded-xl px-3 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-xs transition-all duration-200 flex-1 min-w-[200px] flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/15 to-orange-500/25 text-amber-700 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                <FileText size={14} strokeWidth={2.4} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Invoice No</span>
                                <div className="relative flex items-center flex-1 min-w-0">
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
                                        <div className="ml-2 flex items-center">
                                            <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CLASSIC MAIN BODY */}
                <div className="flex-1 flex overflow-hidden">
                    {!hideAllShortcuts && shortcutsPosition === 'left' && renderClassicShortcutsVertical('left')}

                    <div className="classic-entry-area">
                        {/* GRID SECTION */}
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-slate-100">
                            <table className="classic-table">
                                <colgroup>
                                    <col style={{ width: 40 }} />
                                    {visibleClassicCols.map(col => (
                                        <col key={col.id} style={{ width: col.id === 'description' && !classicColumns.some(c => c.id !== 'description' && !c.visible) ? 'auto' : (col.width || 'auto') }} />
                                    ))}
                                    <col style={{ width: 30 }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th className="text-center">#</th>
                                        {visibleClassicCols.map(col => (
                                            <th 
                                                key={col.id} 
                                                className={`relative select-none ${col.id === 'price' || col.id === 'vat' || col.id === 'total' ? 'text-right' : 'text-center'}`}
                                                style={{ userSelect: 'none' }}
                                            >
                                                <span>{col.label.toUpperCase()}</span>
                                                <div
                                                    onMouseDown={(e) => handleClassicColResizeMouseDown(e, col.id)}
                                                    className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-amber-400/80 active:bg-amber-500 z-10"
                                                    style={{ touchAction: 'none' }}
                                                    title="Drag to resize column"
                                                />
                                            </th>
                                        ))}
                                        <th className="text-center p-0">
                                            <button
                                                onClick={() => setShowClassicColConfig(true)}
                                                className="mx-auto flex items-center justify-center text-amber-400 hover:text-white transition-colors cursor-pointer"
                                                style={{ border: 'none', background: 'transparent', width: '14px', height: '14px', padding: 0, outline: 'none' }}
                                                title="Configure Columns"
                                            >
                                                <Columns size={10} />
                                            </button>
                                        </th>
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
                                                className={`border-b border-slate-100 transition-all cursor-pointer ${idx === selectedBillIndex ? 'bg-sky-100/90 border-l-[5px] border-l-sky-600 shadow-md ring-2 ring-inset ring-sky-300 font-black' : 'bg-white hover:bg-sky-50/50'}`}
                                                onClick={() => setSelectedBillIndex(idx)}
                                            >
                                                <td className={`text-center font-black text-[11px] ${idx === selectedBillIndex ? 'text-sky-800' : 'text-slate-400'}`}>{idx + 1}</td>
                                                {visibleClassicCols.some(c => c.id === 'barcode') && (
                                                    <td className="px-2 font-mono font-black text-slate-900 text-center">
                                                        {(() => {
                                                            const rawBc = item.barcode || item.barcodes?.[0] || item.custom_ref_sl_no || item.id;
                                                            const bcStr = typeof rawBc === 'object' && rawBc !== null ? (rawBc.barcode || rawBc.name || '') : String(rawBc || '');
                                                            return (
                                                                <span className="classic-cell-text text-emerald-700" title={bcStr}>
                                                                    {bcStr}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'item_code') && (
                                                    <td className="px-2 font-black text-slate-900 text-center">
                                                        <span className="classic-cell-text" title={item.name || item.item_name || item.item_code || item.id}>{item.name || item.item_name || item.item_code || item.id}</span>
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'description') && (
                                                    <td className="px-2 py-1 relative group">
                                                        <div className="flex flex-col justify-center">
                                                            <div className="relative flex items-center">
                                                                <input
                                                                    type="text"
                                                                    id={`desc-input-${idx}`}
                                                                    value={item.item_name || item.name}
                                                                    onChange={e => {
                                                                        const newBill = [...billItems];
                                                                        if (newBill[idx].item_name !== undefined) newBill[idx].item_name = e.target.value;
                                                                        else newBill[idx].name = e.target.value;
                                                                        setBillItems(newBill);
                                                                    }}
                                                                    className="w-full px-1 pr-6 font-black text-slate-900 uppercase bg-transparent border-none outline-none focus:bg-sky-200/70 placeholder:text-slate-300 text-[11px]"
                                                                    placeholder="Description"
                                                                    onKeyDown={e => {
                                                                        if (e.altKey || (e.key && e.key.startsWith('F')) || e.ctrlKey || e.metaKey) {
                                                                            return;
                                                                        }
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            document.getElementById(`qty-input-${idx}`)?.focus();
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); showStockBreakdown(item); }}
                                                                    className="absolute right-0 text-slate-400 hover:text-sky-500 transition-colors cursor-pointer"
                                                                    title="Item Info & Stock"
                                                                    tabIndex={-1}
                                                                >
                                                                    <Info size={13} />
                                                                </button>
                                                            </div>

                                                            {/* Customer Last Sale Price Badge */}
                                                            {(selectedCustomer || (customerName && customerName !== 'Cash')) && (
                                                                <div className="mt-0.5 text-[9px] font-extrabold text-amber-800 flex items-center gap-1">
                                                                    {(() => {
                                                                        const info = getCustomerLastPriceInfo(item);
                                                                        if (info) {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/80 leading-none">
                                                                                    <span className="opacity-80">Last Sale ({info.uom}):</span>
                                                                                    <DirhamIcon size={8} /> {parseFloat(info.rate || 0).toFixed(2)}
                                                                                    <span className="text-[8px] text-amber-600 font-normal ml-0.5">({info.posting_date})</span>
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return <span className="text-slate-400 font-normal italic text-[8px] leading-none">No previous sale</span>;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'uom') && (
                                                    <td className="p-0">
                                                        <select
                                                            value={item.uom || 'Nos'}
                                                            onChange={e => toggleUom(item.id, e.target.value, idx)}
                                                            disabled={item.is_print_job || item.is_bundle || (item.id && (item.id.includes('BUNDLE') || item.id.includes('COMBO'))) || ((!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1) && (!item.custom_boxes_per_master_box || item.custom_boxes_per_master_box <= 1))}
                                                            className="w-full h-full bg-slate-50 font-black text-[12px] text-center text-slate-700 border-none outline-none focus:bg-sky-200/70 cursor-pointer hover:bg-slate-100 transition-colors disabled:cursor-default"
                                                        >
                                                            <option value="Nos">Nos</option>
                                                            {item.custom_pieces_per_box > 1 && !(item.is_print_job || item.is_bundle || (item.id && (item.id.includes('BUNDLE') || item.id.includes('COMBO')))) && (
                                                                <option value="Box">Box ({item.custom_pieces_per_box})</option>
                                                            )}
                                                            {item.custom_boxes_per_master_box > 1 && !(item.is_print_job || item.is_bundle || (item.id && (item.id.includes('BUNDLE') || item.id.includes('COMBO')))) && (
                                                                <option value="Master Box">Master Box ({(parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1)})</option>
                                                            )}
                                                        </select>
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'qty') && (
                                                    <td className="p-0">
                                                        <input
                                                            id={`qty-input-${idx}`}
                                                            type="number"
                                                            value={item.qty === 0 ? '' : item.qty}
                                                            onChange={e => setExactQuantity(item.id, e.target.value)}
                                                            onFocus={e => e.target.select()}
                                                            onClick={e => e.target.select()}
                                                            onKeyDown={e => {
                                                                if (e.altKey || (e.key && e.key.startsWith('F')) || e.ctrlKey || e.metaKey) {
                                                                    return;
                                                                }
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    document.getElementById(`price-input-${idx}`)?.focus();
                                                                } else if (e.key === '+' || e.key === '=') {
                                                                    e.preventDefault();
                                                                    updateQuantity(item.id, 1);
                                                                } else if (e.key === '-' || e.key === '_') {
                                                                    e.preventDefault();
                                                                    updateQuantity(item.id, -1);
                                                                }
                                                            }}
                                                            className="w-full h-full text-center px-2 font-black text-sky-600 focus:bg-sky-200/70 outline-none border-none"
                                                        />
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'pcs') && (
                                                    <td className="text-center px-2 font-black text-amber-600 bg-amber-50">
                                                        {item.qty * factor}
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'price') && (
                                                    <td className="p-0">
                                                        <div className="flex items-center gap-1 px-1 h-full w-full">
                                                            <input
                                                                id={`price-input-${idx}`}
                                                                type="number"
                                                                step="0.01"
                                                                value={item._price_input_val !== undefined ? item._price_input_val : (parseFloat(effectivePrice) || 0).toFixed(2)}
                                                                onChange={e => setExactPrice(item.id, e.target.value)}
                                                                onBlur={e => handlePriceBlur(e, item, idx)}
                                                                className="w-0 flex-1 text-right font-black text-slate-900 focus:bg-sky-200/70 outline-none border-none bg-transparent h-full text-[11px]"
                                                                onFocus={e => e.target.select()}
                                                                onClick={e => e.target.select()}
                                                                onKeyDown={e => {
                                                                    if (e.altKey || (e.key && e.key.startsWith('F')) || e.ctrlKey || e.metaKey) {
                                                                        return;
                                                                    }
                                                                    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                                                                        e.preventDefault();
                                                                        handlePriceBlur(e, item, idx);
                                                                        if (idx === billItems.length - 1) {
                                                                            const el = document.getElementById('legacy-inline-search');
                                                                            el?.focus();
                                                                            el?.select();
                                                                        } else {
                                                                            const el = document.getElementById(`desc-input-${idx + 1}`);
                                                                            el?.focus();
                                                                            el?.select();
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newBill = [...billItems];
                                                                    newBill[idx].is_tax_inclusive = !newBill[idx].is_tax_inclusive;
                                                                    setBillItems(newBill);
                                                                }}
                                                                className={`px-1 py-0.5 rounded text-[8px] font-black tracking-tight select-none border-none cursor-pointer shrink-0 transition-all ${item.is_tax_inclusive !== false
                                                                    ? 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                                                                    : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                                                                    }`}
                                                                style={{ fontSize: '8px', lineHeight: '1' }}
                                                                tabIndex={-1}
                                                            >
                                                                {item.is_tax_inclusive !== false ? 'INC' : 'EXC'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'vat') && (
                                                    <td className="text-right px-2 font-bold text-slate-500 text-[10px] italic">
                                                        {item.is_tax_inclusive !== false
                                                            ? (lineTotal - (lineTotal / (1 + (taxRate / 100)))).toFixed(2)
                                                            : (lineTotal * (taxRate / 100)).toFixed(2)}
                                                    </td>
                                                )}
                                                {visibleClassicCols.some(c => c.id === 'total') && (
                                                    <td className="text-right px-2 font-black text-slate-900 bg-slate-50/50 flex items-center justify-end gap-0.5">
                                                        <DirhamIcon size={12} /> {item.is_tax_inclusive !== false
                                                            ? (parseFloat(lineTotal) || 0).toFixed(2)
                                                            : (parseFloat(lineTotal) * (1 + (taxRate / 100))).toFixed(2)}
                                                    </td>
                                                )}
                                                <td className="text-center">
                                                    <button onClick={() => removeFromBill(item.id)} className="text-rose-400 hover:text-rose-600 font-bold" tabIndex={-1}>×</button>
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
                                        <td colSpan={visibleClassicCols.filter(c => c.id === 'barcode' || c.id === 'item_code' || c.id === 'description').length || 1} className="p-0 relative h-10">
                                            <input
                                                ref={barcodeInputRef}
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
                                                autoFocus
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
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    handleAddToBill(it);
                                                                    setBarcodeInput('');
                                                                    setShowItemDropdown(false);
                                                                    const inlineSearchEl = document.getElementById('legacy-inline-search');
                                                                    if (inlineSearchEl) {
                                                                        inlineSearchEl.focus();
                                                                        inlineSearchEl.select?.();
                                                                    } else {
                                                                        barcodeInputRef.current?.focus();
                                                                    }
                                                                }}
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
                                        {visibleClassicCols.filter(c => c.id !== 'barcode' && c.id !== 'item_code' && c.id !== 'description').map((col, i, arr) => (
                                            i === arr.length - 1 ? (
                                                <td key={col.id} className="text-center px-2 font-black text-amber-600 bg-black/5">NEXT ITEM</td>
                                            ) : (
                                                <td key={col.id} className="text-center bg-black/5">-</td>
                                            )
                                        ))}
                                        <td className="text-center group-hover:bg-amber-400 transition-colors">
                                            <Search size={14} className="mx-auto text-amber-400 group-hover:text-black" />
                                        </td>
                                    </tr>

                                    {/* Aesthetic placeholder rows to fill the screen without causing huge scrollbars */}
                                    {Array.from({ length: Math.max(0, 17 - billItems.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="bg-white/30 border-b border-white/10 opacity-30">
                                            <td className="text-center text-slate-300 font-bold">{billItems.length + i + 2}</td>
                                            {visibleClassicCols.map(col => (
                                                <td key={col.id} className="border-r border-white/10"></td>
                                            ))}
                                            <td></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* BOTTOM SECTION — REDESIGNED TO MATCH IMAGE 2 EXACTLY */}
                        <div className="p-2.5 bg-[#e6f4f1] border-t border-[#d1e5e0]">
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">

                                {/* 2. ACTION BUTTON GRID (LEFT SIDE - ~55% width) */}
                                <div className="xl:col-span-7 flex">
                                    <div className="w-full bg-white p-3 border border-slate-200 shadow-sm" style={{ borderRadius: '26px' }}>
                                        <div className="grid grid-cols-4 grid-rows-2 gap-2.5 w-full h-full">
                                            {/* ROW 1: ACTIVE ORDERS, PRINT BILL, PAY & PRINT, PAY NO PRINT */}
                                            {/* ACTIVE ORDERS */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); setShowDraftsModal(true); }}
                                                className="h-14 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer"
                                                style={{ borderRadius: '18px' }}
                                                title="View Active Saved Orders (Drafts) (Press F9)"
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
                                                    <Package size={15} className="text-emerald-700" />
                                                    <span className="truncate">Active Orders</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'orders', 'F9'))}</span>
                                                    {pendingSyncCount > 0 && (
                                                        <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 font-bold rounded-full">
                                                            {pendingSyncCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>

                                            {/* PRINT BILL */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); handleShowRecentInvoicesPrint(); }}
                                                className="h-14 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer"
                                                style={{ borderRadius: '18px' }}
                                                title="Print Recent Bill (Press F10)"
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-900">
                                                    <Printer size={15} className="text-indigo-700" />
                                                    <span className="truncate">Print Bill</span>
                                                </div>
                                                <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'printBill', 'F10'))}</span>
                                            </button>

                                            {/* PRINT / LOADING CONTROL IN ROW 1 */}
                                            {paymentLoading ? (
                                                <button
                                                    className="col-span-2 h-14 bg-slate-100 text-slate-500 border border-slate-200 p-2 flex items-center justify-center gap-2 opacity-80 cursor-not-allowed font-bold text-[11px] uppercase"
                                                    disabled
                                                    style={{ borderRadius: '18px' }}
                                                >
                                                    <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Processing...</span>
                                                </button>
                                            ) : (
                                                <>
                                                    {/* PAY & PRINT */}
                                                    <button
                                                        onClick={() => { setShowSettingsMenu(false); handleCheckoutWithMode('print'); }}
                                                        disabled={paymentLoading}
                                                        className="h-14 bg-[#047857] hover:bg-[#065f46] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                                        style={{ borderRadius: '18px' }}
                                                    >
                                                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                            <Printer size={15} />
                                                            <span>PAY & PRINT</span>
                                                        </div>
                                                        <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">SPACE</span>
                                                    </button>

                                                    {/* PAY NO PRINT */}
                                                    <button
                                                        onClick={() => { setShowSettingsMenu(false); handleCheckoutWithMode('no-print'); }}
                                                        disabled={paymentLoading}
                                                        className="h-14 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                                        style={{ borderRadius: '18px' }}
                                                    >
                                                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                            <Zap size={15} />
                                                            <span>PAY NO PRINT</span>
                                                        </div>
                                                        <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel('Alt+N')}</span>
                                                    </button>
                                                </>
                                            )}

                                            {/* ROW 2: DISCOUNT, LOYALTY, SAVE DRAFT, A4, RESET (5 buttons across or neatly organized) */}
                                            {/* DISCOUNT */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); setShowDiscountModal(true); }}
                                                className="h-14 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer"
                                                style={{ borderRadius: '18px' }}
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                                                    <Percent size={15} className="text-slate-700" />
                                                    <span>DISCOUNT</span>
                                                </div>
                                                <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'discount', 'F1'))}</span>
                                            </button>

                                            {/* LOYALTY */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); handleLoyaltyPointsClick(); }}
                                                className="h-14 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer"
                                                style={{ borderRadius: '18px' }}
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                                                    <Gift size={15} className="text-slate-700" />
                                                    <span>LOYALTY</span>
                                                </div>
                                                <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'loyalty', 'Alt+L'))}</span>
                                            </button>

                                            {/* SAVE DRAFT */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); handleSaveDraft(); }}
                                                className="h-14 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                                style={{ borderRadius: '18px' }}
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                    <Upload size={15} />
                                                    <span>SAVE DRAFT</span>
                                                </div>
                                                <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'saveDraft', 'Alt+S'))}</span>
                                            </button>

                                            {/* RESET */}
                                            <button
                                                onClick={() => { setShowSettingsMenu(false); clearBillHandler(); }}
                                                className="h-14 bg-[#dc2626] hover:bg-[#b91c1c] text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                                style={{ borderRadius: '18px' }}
                                            >
                                                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                    <Trash2 size={15} />
                                                    <span>RESET</span>
                                                </div>
                                                <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'clearBill', 'Alt+C'))}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 1. TOTALS CARD (RIGHT SIDE - ~45% width) */}
                                <div className="xl:col-span-5 bg-white border border-slate-200 p-3 shadow-sm flex flex-col justify-between gap-3" style={{ borderRadius: '26px' }}>
                                    {/* TOP ROW: CASH, CARD, BANK — MATCHING LEFT GRID STYLE (H-14, ROUNDED-18px) */}
                                    <div className="grid grid-cols-3 gap-2.5 w-full">
                                        {/* CASH */}
                                        <button
                                            onClick={() => { setShowSettingsMenu(false); if (billItems.length > 0) { completePayment('Cash'); } else { Swal.fire('Info', 'No items in bill', 'info'); } }}
                                            disabled={paymentLoading}
                                            className="h-14 bg-[#047857] hover:bg-[#065f46] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                            style={{ borderRadius: '18px' }}
                                            title="Direct Cash Payment (Press Alt+1)"
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                <Banknote size={15} />
                                                <span>CASH</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'directCash', 'Alt+1'))}</span>
                                        </button>

                                        {/* CARD */}
                                        <button
                                            onClick={() => { setShowSettingsMenu(false); if (billItems.length > 0) { setSelectedPaymentMode('Card'); setShowCardTerminalModal(true); } else { Swal.fire('Info', 'No items in bill', 'info'); } }}
                                            disabled={paymentLoading}
                                            className="h-14 bg-[#7e22ce] hover:bg-[#6b21a8] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                            style={{ borderRadius: '18px' }}
                                            title="Direct Card Payment (Press Alt+2)"
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                <CreditCard size={15} />
                                                <span>CARD</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'directCard', 'Alt+2'))}</span>
                                        </button>

                                        {/* BANK */}
                                        <button
                                            onClick={() => { setShowSettingsMenu(false); if (billItems.length > 0) { completePayment('Bank'); } else { Swal.fire('Info', 'No items in bill', 'info'); } }}
                                            disabled={paymentLoading}
                                            className="h-14 bg-[#1d4ed8] hover:bg-[#1e40af] disabled:opacity-50 text-white px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                                            style={{ borderRadius: '18px' }}
                                            title="Direct Bank Payment (Press Ctrl+V)"
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                                <Building2 size={15} />
                                                <span>BANK</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white shadow-sm">{formatKeyLabel(getShortcut('pos_home', 'directBank', 'Ctrl+V'))}</span>
                                        </button>
                                    </div>

                                    {/* TOTALS AREA INSIDE CARD */}
                                    <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-100">
                                        {/* TAX TEMPLATE ON LEFT */}
                                        <div className="flex flex-col items-start">
                                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">TAX TEMPLATE</span>
                                            <select
                                                value={selectedTaxTemplate}
                                                onChange={(e) => setSelectedTaxTemplate(e.target.value)}
                                                className="bg-transparent text-[10px] font-bold text-slate-700 outline-none cursor-pointer p-0 m-0 border-none"
                                            >
                                                {(() => {
                                                    const filtered = taxTemplates.filter(t => t.name.toLowerCase().includes("vat 5%"));
                                                    const displayList = filtered.length > 0 ? filtered : taxTemplates;
                                                    return displayList.map(t => <option key={t.name} value={t.name}>{t.name}</option>);
                                                })()}
                                            </select>
                                        </div>

                                        {/* RIGHT ALIGNED TOTALS COLUMN */}
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold uppercase text-slate-400">SUBTOTAL</span>
                                                <span className="text-slate-800 font-bold text-sm flex items-center gap-0.5"><DirhamIcon size={12} /> {displaySubtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold uppercase text-slate-400">VAT ({taxRate}%)</span>
                                                <span className="text-slate-600 font-bold text-sm flex items-center gap-0.5"><DirhamIcon size={12} /> {displayTax.toFixed(2)}</span>
                                            </div>
                                            {displayDiscount > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-rose-400">DISCOUNT</span>
                                                    <span className="text-rose-600 font-bold text-sm flex items-center gap-0.5">-<DirhamIcon size={12} /> {displayDiscount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {loyaltyAmount > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-emerald-500">LOYALTY</span>
                                                    <span className="text-emerald-600 font-bold text-sm flex items-center gap-0.5">-<DirhamIcon size={12} /> {loyaltyAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex flex-col items-end mt-1">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GRAND TOTAL</span>
                                                <span className={`text-2xl font-black ${isGreen ? 'text-emerald-600' : 'text-sky-600'} leading-none flex items-center gap-0.5 mt-0.5`}>
                                                    <DirhamIcon size={18} /> {grandTotal.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. STATUS BAR (FULL WIDTH, BELOW BOTH SECTIONS) */}
                        <div className="bg-white border-t border-slate-100 px-4 py-1 text-[10px] color-[#94a3b8] flex items-center gap-5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold uppercase">Items:</span>
                                <span className="font-bold text-slate-800">{billItems.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold uppercase">Customer:</span>
                                <span className={`font-bold ${isGreen ? 'text-emerald-600' : 'text-sky-600'}`}>{customerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-bold uppercase">Branch:</span>
                                <span className={`font-bold ${isGreen ? 'text-emerald-600' : 'text-sky-600'}`}>{warehouse || 'No Branch'}</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1.5 font-bold text-slate-400 opacity-60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                <span>READY · SYSTEM OK</span>
                            </div>
                        </div>
                    </div>
                    {!hideAllShortcuts && shortcutsPosition === 'right' && renderClassicShortcutsVertical('right')}
                </div>

                {!hideAllShortcuts && shortcutsPosition === 'bottom' && renderClassicShortcutsHorizontal()}

                {isDraggingShortcuts && renderDropZones()}



                {/* Classic Column Config Modal */}
                <ColumnConfigModal
                    isOpen={showClassicColConfig}
                    onClose={() => setShowClassicColConfig(false)}
                    config={classicColumns}
                    onUpdate={handleClassicColConfigUpdate}
                    doctype="Classic POS"
                    themeColor={isGreen ? '#10b981' : '#0ea5e9'}
                />

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
                            <div className="classic-shortcut-guide horizontal mb-3" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', padding: '6px 12px', background: '#ffffff', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                {renderClassicShortcutsList(false)}
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
                                        <CountryCodeSelector
                                            value={countryCodePrefix}
                                            onChange={newVal => {
                                                setCountryCodePrefix(newVal);
                                                localStorage.setItem('pos_country_code', newVal);
                                            }}
                                        />
                                        <input
                                            ref={mobileInputRef}
                                            type="tel"
                                            placeholder="Mobile + Enter (Speed Checkout)"
                                            value={customerMobile}
                                            onChange={(e) => {
                                                const cleaned = e.target.value.replace(/\D/g, '');
                                                const rule = getCountryRule(countryCodePrefix);
                                                setCustomerMobile(cleaned.slice(0, rule.maxLen));
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
                                        onFocus={() => { setActiveCardIndex(-1); setShowSettingsMenu(false); }}
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
                                <div className="flex gap-2 mb-3">
                                    <div className="relative group flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <UserPlus size={20} className="text-slate-400 group-focus-within:text-sky-600 transition-colors" />
                                        </div>
                                        <input
                                            ref={nameInputRef}
                                            type="text"
                                            placeholder="CUSTOMER NAME (TYPE TO SEARCH...)"
                                            value={customerName}
                                            className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 outline-none shadow-sm transition-all"
                                            onChange={e => { justSelectedCustomerRef.current = false; setActiveCustomerIndex(-1); setCustomerName(e.target.value); if (e.target.value.trim() !== 'Cash') setSelectedCustomer(null); }}
                                            onFocus={() => { if (customerName.trim() === 'Cash') nameInputRef.current?.select(); if (!selectedCustomer && !justSelectedCustomerRef.current && customerName.trim().length >= 2) setShowDropdown(true); setShowSettingsMenu(false); }}
                                            onKeyDown={handleMobileEnter}
                                            autoComplete="off"
                                        />
                                        {searchLoading && <Loader2 size={18} className="animate-spin" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />}
                                        {showDropdown && (
                                            <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '220px', overflowY: 'auto', zIndex: 10, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                {searchResults.length === 0 ? <div style={{ padding: '0.75rem', color: '#64748b', textAlign: 'center' }}>{customerName.trim().length < 2 ? 'Type 2+ chars' : 'No customers found'}</div> : searchResults.map((c, idx) => {
                                                    const isSelected = idx === activeCustomerIndex;
                                                    return (
                                                        <div key={c.name} id={`cust-item-2-${idx}`} onClick={() => { pickCustomer(c); setActiveCustomerIndex(-1); }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', backgroundColor: isSelected ? '#e0f2fe' : '#fff' }} onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }} onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fff'; }}>
                                                            <div><div style={{ fontWeight: isSelected ? 800 : 600, color: isSelected ? '#0369a1' : 'inherit' }}>{c.customer_name}</div>{c.mobile_no && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.mobile_no}</div>}</div>
                                                            <Search size={16} style={{ color: isSelected ? '#0284c7' : '#94a3b8' }} />
                                                        </div>
                                                    );
                                                })}
                                                {searchResults.every(c => c.customer_name.toLowerCase() !== customerName.trim().toLowerCase()) && <div onClick={() => openCreate(customerName.trim())} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: '#eef2ff', color: '#4338ca', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={18} /> Create "{customerName.trim()}"</div>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center overflow-hidden bg-slate-50 border-2 border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm shrink-0">
                                        <div className="px-4 py-3 flex items-center gap-2">
                                            <Layers size={14} className="text-sky-500 shrink-0" />
                                            <span>{selectedCustomer ? (selectedCustomer.customer_group || 'Retail Customer') : 'Retail Customer'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openCustomerGroupChangeModal(selectedCustomer)}
                                            className="px-3 py-3 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white flex items-center gap-1 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                                            title="Edit Customer Group"
                                        >
                                            <Edit size={12} />
                                            <span>Edit</span>
                                        </button>
                                    </div>
                                </div>
                                <input type="tel" placeholder="Phone Number" value={phoneNumber} onChange={e => {
                                    const cleaned = e.target.value.replace(/\D/g, '');
                                    const rule = getCountryRule(countryCodePrefix);
                                    setPhoneNumber(cleaned.slice(0, rule.maxLen));
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
                                                            {/* Customer Last Sale Price Badge */}
                                                            {selectedCustomer && selectedCustomer.name !== 'Cash' && (
                                                                <div style={{ marginTop: '3px', fontSize: '9px', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    {(() => {
                                                                        const info = getCustomerLastPriceInfo(item);
                                                                        if (info) {
                                                                            return (
                                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                                                                    <span>Last Sale ({info.uom}):</span>
                                                                                    <DirhamIcon size={8} /> {parseFloat(info.rate || 0).toFixed(2)}
                                                                                    <span style={{ fontSize: '8px', color: '#92400e', fontWeight: 400 }}>({info.posting_date})</span>
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return <span style={{ color: '#94a3b8', fontWeight: 400, fontStyle: 'italic', fontSize: '8.5px' }}>No previous sale</span>;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="home-bill-item-actions">
                                                            <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, -1); }}>-</button>
                                                            <span className="home-bill-qty">{item.qty}</span>
                                                            <button className="home-bill-qty-btn" onClick={e => { e.stopPropagation(); updateQuantity(item.id, 1); }}>+</button>
                                                            <button className="home-bill-remove-btn" onClick={e => { e.stopPropagation(); removeFromBill(item.id); }}><X size={14} /></button>
                                                        </div>
                                                    </div>
                                                    {/* PIECE VS BOX VS MASTER BOX TOGGLE */}
                                                    {!(item.is_print_job || item.is_bundle || (item.id && (item.id.includes('BUNDLE') || item.id.includes('COMBO')))) && (item.custom_pieces_per_box > 1 || item.custom_boxes_per_master_box > 1) && (
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, item.uom_conversions?.Nos ? 'Nos' : 'Piece')} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #3b82f6', background: (item.uom === 'Piece' || item.uom === 'Nos') ? '#3b82f6' : '#fff', color: (item.uom === 'Piece' || item.uom === 'Nos') ? '#fff' : '#3b82f6' }}>Piece</button>
                                                            {item.custom_pieces_per_box > 1 && (
                                                                <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, 'Box')} disabled={!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #8b5cf6', background: item.uom === 'Box' ? '#8b5cf6' : '#fff', color: item.uom === 'Box' ? '#fff' : '#8b5cf6', opacity: (!item.custom_pieces_per_box || item.custom_pieces_per_box <= 1) ? 0.5 : 1 }}>Box ({item.custom_pieces_per_box || 1})</button>
                                                            )}
                                                            {item.custom_boxes_per_master_box > 1 && (
                                                                <button onKeyDown={(e) => handleUomBtnKeyDown(e, item.id)} onClick={() => toggleUom(item.id, 'Master Box')} style={{ flex: 1, padding: '4px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: '1px solid #7c3aed', background: item.uom === 'Master Box' ? '#7c3aed' : '#fff', color: item.uom === 'Master Box' ? '#fff' : '#7c3aed' }}>MB ({(parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1)})</button>
                                                            )}
                                                        </div>
                                                    )}
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
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '4px' }}>
                                                <button className="home-bill-discount-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDiscountModal(true)}>{discount.value > 0 ? (discount.type === 'percent' ? `Edit (${discount.value}%)` : <span className="flex items-center justify-center gap-0.5">Edit (<DirhamIcon size={10} />{discount.value})</span>) : 'Add Discount'} <span className="btn-shortcut-key">F1</span></button>
                                                <button className="home-bill-discount-btn" style={{ flex: 1, display: 'flex', itemsCenter: 'center', justifyContent: 'center', backgroundColor: loyaltyAmount > 0 ? '#10b981' : '#64748b' }} onClick={handleLoyaltyPointsClick}>{loyaltyAmount > 0 ? `Loyalty: ${loyaltyPointsToRedeem} pts` : 'Add Loyalty'} <span className="btn-shortcut-key">{getShortcut('pos_home', 'loyalty', 'Alt+L')}</span></button>
                                            </div>
                                            {grandTotal > 0 && (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '4px' }}>
                                                    <button
                                                        className="home-bill-pay-btn"
                                                        style={{
                                                            flex: 1,
                                                            backgroundColor: '#10b981',
                                                            borderColor: '#059669',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            padding: '8px 6px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleCheckoutWithMode('print')}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            <Printer size={12} />
                                                            <span>Pay & Print</span>
                                                        </span>
                                                        <span className="btn-shortcut-key">Space</span>
                                                    </button>
                                                    <button
                                                        className="home-bill-pay-btn"
                                                        style={{
                                                            flex: 1,
                                                            backgroundColor: '#3b82f6',
                                                            borderColor: '#2563eb',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            padding: '8px 6px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleCheckoutWithMode('no-print')}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            <CreditCard size={12} />
                                                            <span>Pay No Print</span>
                                                        </span>
                                                        <span className="btn-shortcut-key">Alt+N</span>
                                                    </button>
                                                    <button
                                                        className="home-bill-pay-btn"
                                                        style={{
                                                            flex: 1,
                                                            backgroundColor: '#8b5cf6',
                                                            borderColor: '#7c3aed',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '4px',
                                                            fontSize: '10px',
                                                            fontWeight: 'bold',
                                                            padding: '8px 6px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleCheckoutWithMode('print-a4')}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            <Printer size={12} />
                                                            <span>Pay A4 Print</span>
                                                        </span>
                                                        <span className="btn-shortcut-key">Alt+A</span>
                                                    </button>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                                                {billItems.length > 0 && <button className="home-bill-clear-btn" style={{ flex: 1 }} onClick={clearBillHandler}>Clear Bill</button>}
                                                <button
                                                    className="home-bill-clear-btn"
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: '#4f46e5',
                                                        borderColor: '#4338ca',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px'
                                                    }}
                                                    onClick={handleShowRecentInvoicesPrint}
                                                >
                                                    <Printer size={12} />
                                                    <span>Print Bill</span>
                                                    <span className="btn-shortcut-key" style={{ marginLeft: '4px' }}>F10</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div> {/* close home-layout */}
            </div> {/* close home-content */}

            {/* Common Modals */}
            {renderCommonModals()}

            {/* Print Job Calculator Modal */}
            <PrintJobModal
                isOpen={showPrintJobModal}
                onClose={() => setShowPrintJobModal(false)}
                onAddJobToCart={(item, uom, initialQty) => handleAddToBill(item, uom, initialQty)}
                themeColor="#10b981"
            />

            {/* Fast Print Modal (Direct Amount & Calculator Numpad) */}
            <FastPrintModal
                isOpen={showFastPrintModal}
                onClose={() => setShowFastPrintModal(false)}
                onAddJobToCart={(item, uom, initialQty) => handleAddToBill(item, uom, initialQty)}
            />
        </div>
        );
}
export default Home;

