// src/Components/Admin/ItemList.jsx
// ─── REDESIGNED: Clean, structured, consistent design system ───
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Package, Camera, ChevronLeft, ChevronRight,
  Users, Trash2, ChevronDown, Loader2, Edit2, Tag, Box,
  Info, ShieldCheck, Scale, MapPin, Activity, FileText,
  Calendar, BarChart3, ArrowUpRight, Check, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
import { useNavigate } from 'react-router-dom';
import NavBar from '../Nav/NavBar';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

/* ═══════════════════════════════════════════════
   DESIGN TOKENS — single source of truth
═══════════════════════════════════════════════ */
const T = {
  radius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  font: { xs: '11px', sm: '12px', base: '13px', md: '14px', lg: '16px', xl: '20px', '2xl': '24px' },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', '2xl': '32px', '3xl': '48px' },
  color: {
    bg: '#FFFFFF', surface: '#F8FAFC', border: '#E8EDF3', borderStrong: '#CBD5E1',
    text: '#0F172A', textMuted: '#64748B', textLight: '#94A3B8',
    blue: '#2563EB', blueLight: '#EFF6FF', blueBorder: '#BFDBFE',
    green: '#16A34A', greenLight: '#F0FDF4', greenBorder: '#BBF7D0',
    amber: '#D97706', amberLight: '#FFFBEB', amberBorder: '#FDE68A',
    red: '#DC2626', redLight: '#FEF2F2', redBorder: '#FECACA',
    slate: '#475569', slateLight: '#F1F5F9',
  }
};

/* ═══════════════════════════════════════════════
   SHARED UI PRIMITIVES
═══════════════════════════════════════════════ */

/** Pill badge */
const Badge = ({ children, variant = 'default', style }) => {
  const variants = {
    default: { bg: T.color.slateLight, color: T.color.slate, border: T.color.border },
    success: { bg: T.color.greenLight, color: T.color.green, border: T.color.greenBorder },
    danger: { bg: T.color.redLight, color: T.color.red, border: T.color.redBorder },
    info: { bg: T.color.blueLight, color: T.color.blue, border: T.color.blueBorder },
    warning: { bg: T.color.amberLight, color: T.color.amber, border: T.color.amberBorder },
  };
  const v = variants[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '100px',
      fontSize: T.font.xs, fontWeight: T.weight.bold, letterSpacing: '0.3px',
      background: v.bg, color: v.color, border: `1px solid ${v.border}`,
      ...style
    }}>{children}</span>
  );
};

/** Stat card used in overview bar */
const StatCard = ({ label, value, sub, accentColor }) => (
  <div style={{
    background: T.color.bg, border: `1px solid ${T.color.border}`,
    borderRadius: T.radius.lg, padding: '20px 24px',
    borderLeft: `4px solid ${accentColor}`,
    display: 'flex', flexDirection: 'column', gap: '6px'
  }}>
    <p style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{label}</p>
    <p style={{ fontSize: T.font['2xl'], fontWeight: T.weight.black, color: T.color.text, margin: 0, lineHeight: 1.1 }}>{value}</p>
    {sub && <p style={{ fontSize: T.font.xs, color: T.color.textMuted, fontWeight: T.weight.semibold, margin: 0 }}>{sub}</p>}
  </div>
);

/** Section card wrapper */
const Card = ({ children, style }) => (
  <div style={{
    background: T.color.bg, border: `1px solid ${T.color.border}`,
    borderRadius: T.radius.xl, overflow: 'hidden', ...style
  }}>{children}</div>
);

/** Card header row */
const CardHeader = ({ icon, title, action }) => (
  <div style={{
    padding: '16px 24px', background: T.color.surface,
    borderBottom: `1px solid ${T.color.border}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {icon && <span style={{ color: T.color.blue, display: 'flex' }}>{icon}</span>}
      <span style={{ fontSize: T.font.sm, fontWeight: T.weight.black, color: T.color.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
    </div>
    {action}
  </div>
);

/** Labeled field row */
const FieldRow = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
    {children}
  </div>
);

/** Text input */
const Input = ({ style, ...props }) => (
  <input style={{
    width: '100%', padding: '10px 14px', borderRadius: T.radius.md,
    border: `1px solid ${T.color.border}`, background: T.color.bg,
    fontSize: T.font.base, fontWeight: T.weight.medium, color: T.color.text,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
    ...style
  }}
    onFocus={e => e.target.style.borderColor = T.color.blue}
    onBlur={e => e.target.style.borderColor = T.color.border}
    {...props}
  />
);

/** Select */
const Select = ({ style, children, ...props }) => (
  <div style={{ position: 'relative' }}>
    <select style={{
      width: '100%', padding: '10px 36px 10px 14px', borderRadius: T.radius.md,
      border: `1px solid ${T.color.border}`, background: T.color.bg,
      fontSize: T.font.base, fontWeight: T.weight.medium, color: T.color.text,
      outline: 'none', appearance: 'none', cursor: 'pointer', ...style
    }} {...props}>{children}</select>
    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.color.textLight }} />
  </div>
);

/** Primary button */
const BtnPrimary = ({ children, style, ...props }) => (
  <button style={{
    padding: '10px 20px', background: T.color.blue, color: '#fff', border: 'none',
    borderRadius: T.radius.md, fontSize: T.font.sm, fontWeight: T.weight.bold,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px',
    transition: 'opacity 0.15s', ...style
  }}
    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    {...props}>{children}</button>
);

/** Ghost button */
const BtnGhost = ({ children, style, ...props }) => (
  <button style={{
    padding: '9px 16px', background: 'transparent', color: T.color.slate,
    border: `1px solid ${T.color.border}`, borderRadius: T.radius.md,
    fontSize: T.font.sm, fontWeight: T.weight.semibold, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'background 0.15s', ...style
  }}
    onMouseEnter={e => e.currentTarget.style.background = T.color.surface}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    {...props}>{children}</button>
);

/** Checkbox row */
const CheckRow = ({ label, desc, checked, onChange, danger }) => (
  <label style={{
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
    background: danger ? '#FFF5F5' : T.color.surface, borderRadius: T.radius.md,
    cursor: 'pointer', border: `1px solid ${danger ? T.color.redBorder : T.color.border}`
  }}>
    <div style={{
      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
      border: `2px solid ${checked ? (danger ? T.color.red : T.color.blue) : T.color.borderStrong}`,
      background: checked ? (danger ? T.color.red : T.color.blue) : T.color.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
    }}>
      {checked && <Check size={11} color="#fff" strokeWidth={3} />}
    </div>
    <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
    <div>
      <p style={{ fontSize: T.font.sm, fontWeight: T.weight.bold, color: danger ? T.color.red : T.color.text, margin: 0 }}>{label}</p>
      {desc && <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>{desc}</p>}
    </div>
  </label>
);

/* ═══════════════════════════════════════════════
   CAMERA SCANNER
═══════════════════════════════════════════════ */
const CameraScanner = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  const reader = useRef(new BrowserMultiFormatReader());
  useEffect(() => {
    reader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) onScan(result.getText());
    });
    return () => reader.current.reset();
  }, [onScan]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: T.color.bg, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.color.border}` }}>
        <span style={{ fontSize: T.font.lg, fontWeight: T.weight.bold }}>Scan Barcode</span>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px' }}><X size={22} /></button>
      </div>
      <video ref={videoRef} style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: '280px', height: '160px', border: '3px solid #EF4444', borderRadius: '12px', opacity: 0.85 }} />
      </div>
      <div style={{ position: 'absolute', bottom: '32px', left: 0, right: 0, textAlign: 'center' }}>
        <p style={{ display: 'inline-block', color: '#fff', background: 'rgba(0,0,0,0.65)', padding: '10px 24px', borderRadius: '100px', fontSize: T.font.base, fontWeight: T.weight.medium }}>Align barcode inside the frame</p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   ITEM CARD (image grid view)
═══════════════════════════════════════════════ */
const ItemCard = ({ item, onClick }) => (
  <div
    onClick={() => onClick(item)}
    style={{
      background: T.color.bg, border: `1px solid ${T.color.border}`,
      borderRadius: T.radius.xl, overflow: 'hidden', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
  >
    {/* Image area */}
    <div style={{ height: '140px', background: T.color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: `1px solid ${T.color.border}` }}>
      {item.image
        ? <img src={item.image} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '12px' }} alt={item.item_name} />
        : <Package size={40} color={T.color.border} />
      }
      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
        <Badge variant={item.disabled ? 'danger' : 'success'}>{item.disabled ? 'Disabled' : 'Active'}</Badge>
      </div>
    </div>
    {/* Content area */}
    <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <p style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: T.color.blue, textTransform: 'uppercase', letterSpacing: '0.3px', margin: 0 }}>{item.item_group}</p>
      <h3 style={{
        fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text, margin: 0,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.45'
      }}>{item.item_name}</h3>
    </div>
    <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', color: T.color.textLight, fontWeight: T.weight.bold, textTransform: 'uppercase' }}>Buying</span>
        <span style={{ fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.slate }}>{Number(item.valuation_rate || 0).toFixed(2)}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '10px', color: T.color.textLight, fontWeight: T.weight.bold, textTransform: 'uppercase' }}>Selling</span>
        <p style={{ fontSize: T.font.base, fontWeight: T.weight.black, color: T.color.text, margin: 0 }}>
          <span style={{ fontSize: T.font.xs, color: T.color.textMuted, marginRight: '3px' }}>AED</span>
          {Number(item.rate || item.standard_rate || 0).toFixed(2)}
        </p>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function ItemList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewType, setViewType] = useState('list');

  const { themeColor, isGreen, toggleTheme } = useLegacyTheme();
  const accent = themeColor || T.color.blue;

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHasVariants, setFilterHasVariants] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingItemCode, setEditingItemCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('General');

  const emptyForm = {
    item_code: '', item_name: '', item_group: '', disabled: false,
    maintain_stock: true, has_variants: false, variant_of: '',
    opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0, brand: '',
    default_uom: 'Nos', description: '', image: null, imagePreview: null,
    uoms: [], hsn_code: '', custom_loyalty_eligible: 0, custom_allow_discount: 1,
    is_stock_item: 1, is_sales_item: 1, is_purchase_item: 1, supplier_items: []
  };
  const [form, setForm] = useState({ ...emptyForm });

  // Master data
  const [itemGroups, setItemGroups] = useState([]);
  const [brands, setBrands] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(null); // 'search' or 'form'

  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [priceData, setPriceData] = useState({ prices: [], metrics: {}, warehouse_breakdown: [] });
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [isPriceDetailView, setIsPriceDetailView] = useState(false);
  const [priceForm, setPriceForm] = useState({ price_list: '', uom: '', price_list_rate: 0, buying: 0, selling: 1, name: '' });

  const [connectionActiveTab, setConnectionActiveTab] = useState(null);
  const [connectionSearch, setConnectionSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedLinks, setExpandedLinks] = useState({});
  const [warehouseDetails, setWarehouseDetails] = useState([]);

  const fileInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  /* ── Fetch helpers ── */
  useEffect(() => { fetchItems(); fetchBrands(); fetchUoms(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      // Fetch base item details (groups, images, etc)
      const resBase = await axios.get('/api/resource/Item', {
        params: { limit_page_length: 5000, fields: JSON.stringify(["item_code", "item_name", "item_group", "stock_uom", "image", "description", "disabled", "has_variants", "standard_rate"]), order_by: 'item_name asc' },
        withCredentials: true
      });
      const itemsBase = resBase.data?.data || [];

      // Fetch live prices and weighted average valuation
      const resPrices = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_price_list_all', { withCredentials: true });
      const priceData = resPrices.data?.message?.data || [];

      // Merge data
      const merged = itemsBase.map(item => {
        const pMatch = priceData.find(p => p.item_code === item.item_code);
        return {
          ...item,
          // Use the real-time rate and valuation from the special API
          valuation_rate: pMatch?.valuation_rate || 0,
          rate: pMatch?.rate || item.standard_rate || 0,
          stock: pMatch?.stock || 0,
          stock_value: pMatch?.stock_value || 0
        };
      });

      setItems(merged);
    } catch (err) {
      console.error('Fetch Items Error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showForm || isEditMode) {
      const t = setTimeout(() => fetchItemGroups(), 300);
      return () => clearTimeout(t);
    }
  }, [showForm, isEditMode]);

  const fetchItemGroups = async () => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', { withCredentials: true });
      const raw = res.data?.message?.data || res.data?.message || [];
      setItemGroups((Array.isArray(raw) ? raw : []).map(g => typeof g === 'string' ? { label: g, value: g } : g));
    } catch { }
  };

  const fetchBrands = async () => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_brands', { withCredentials: true });
      const raw = res.data?.message || [];
      const data = Array.isArray(raw) ? raw : (raw.data || []);
      setBrands(data.map(b => typeof b === 'string' ? { label: b, value: b } : { label: b.label || b.name, value: b.value || b.name }));
    } catch { }
  };

  const fetchUoms = async () => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_all_uoms', { withCredentials: true });
      setUoms(Array.isArray(res.data?.message) ? res.data.message.map(u => ({ label: u.name, value: u.name })) : []);
    } catch { }
  };

  const fetchItemDashboard = async (code) => {
    try {
      setLoadingDashboard(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_dashboard_details', { params: { item_code: code }, withCredentials: true });
      const result = res.data?.message || {};
      setDashboardData(result);
      if (result.item_details) {
        const item = result.item_details;
        setForm(prev => ({ ...prev, brand: item.brand || '', valuation_rate: item.valuation_rate || 0, uoms: item.uoms || [], hsn_code: item.hsn_code || '', custom_loyalty_eligible: item.custom_loyalty_eligible || 0, custom_allow_discount: item.custom_allow_discount || 0, is_stock_item: item.is_stock_item || 0, is_sales_item: item.is_sales_item || 0, is_purchase_item: item.is_purchase_item || 0, supplier_items: item.supplier_items || [], description: item.description || prev.description }));
        if (item.barcodes) setBarcodes(item.barcodes);
      }
      if (result.stock_status?.warehouse_details) setWarehouseDetails(result.stock_status.warehouse_details);
      try {
        const conn = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', { params: { doctype: 'Item', name: code }, withCredentials: true });
        if (conn.data?.message?.categories) setDashboardData(prev => ({ ...prev, connections: conn.data.message.categories }));
      } catch { }
    } catch { setDashboardData({}); } finally { setLoadingDashboard(false); }
  };

  const fetchPriceList = async (code) => {
    try {
      setLoadingPrices(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_prices', { params: { item_code: code }, withCredentials: true });
      const r = res.data?.message;
      setPriceData({ prices: r?.data || [], metrics: r?.metrics || {}, warehouse_breakdown: r?.warehouse_breakdown || [] });
    } catch { setPriceData({ prices: [], metrics: {}, warehouse_breakdown: [] }); } finally { setLoadingPrices(false); }
  };

  useEffect(() => {
    const cats = Object.keys(dashboardData?.connections || dashboardData?.categories || {});
    if (cats.length > 0 && !connectionActiveTab) setConnectionActiveTab(cats[0]);
  }, [dashboardData]);

  /* ── Barcodes ── */
  useEffect(() => {
    if (!showForm || !isScanning) return;
    let buf = '', timer;
    const onKey = (e) => {
      if (e.key === 'Enter' && buf.trim().length > 3) { e.preventDefault(); addBarcode(buf.trim()); buf = ''; }
      else if (e.key.length === 1) { buf += e.key; clearTimeout(timer); timer = setTimeout(() => buf = '', 100); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showForm, isScanning]);

  const addBarcode = async (code) => {
    if (!code?.trim()) return;
    code = code.trim();
    if (barcodes.some(b => b.barcode === code)) { alert('Barcode already added'); return; }
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', { params: { barcode: code }, withCredentials: true });
      if (res.data?.message?.exists) { alert(`Barcode ${code} is already used by: ${res.data.message.item}`); return; }
    } catch { }
    setBarcodes(prev => [...prev, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput(''); setIsScanning(false);
  };

  /* ── UOM / Supplier rows ── */
  const addUomRow = () => setForm(p => ({ ...p, uoms: [...p.uoms, { uom: '', conversion_factor: 1 }] }));
  const removeUomRow = (i) => setForm(p => ({ ...p, uoms: p.uoms.filter((_, j) => j !== i) }));
  const updateUomRow = (i, f, v) => { const a = [...form.uoms]; a[i][f] = v; setForm(p => ({ ...p, uoms: a })); };

  const addSupplierRow = () => setForm(p => ({ ...p, supplier_items: [...p.supplier_items, { supplier: '', supplier_part_no: '' }] }));
  const removeSupplierRow = (i) => setForm(p => ({ ...p, supplier_items: p.supplier_items.filter((_, j) => j !== i) }));
  const updateSupplierRow = (i, f, v) => { const a = [...form.supplier_items]; a[i][f] = v; setForm(p => ({ ...p, supplier_items: a })); };

  /* ── CRUD ── */
  const handleRowClick = async (item) => {
    setIsViewMode(true); setIsEditMode(false); setEditingItemCode(item.item_code);
    setForm({ ...emptyForm, item_code: item.item_code, item_name: item.item_name, item_group: item.item_group, disabled: item.disabled === 1, default_uom: item.stock_uom || 'Nos', standard_selling_rate: item.standard_rate || 0, imagePreview: item.image });
    setWarehouseDetails([]); setShowForm(true); setActiveTab('General');
    fetchPriceList(item.item_code); fetchItemDashboard(item.item_code);
  };

  const handleSave = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.item_group || !form.default_uom.trim()) { alert('Missing required fields'); return; }
    setSaving(true);
    try {
      const data = { item_code: form.item_code, item_name: form.item_name, item_group: form.item_group, stock_uom: form.default_uom, standard_rate: parseFloat(form.standard_selling_rate) || 0, disabled: form.disabled ? 1 : 0, maintain_stock: form.maintain_stock ? 1 : 0, has_variants: form.has_variants ? 1 : 0, description: form.description || '', image: form.image || form.imagePreview || '', hsn_code: form.hsn_code, brand: form.brand, custom_loyalty_eligible: form.custom_loyalty_eligible ? 1 : 0, custom_allow_discount: form.custom_allow_discount ? 1 : 0, is_stock_item: form.is_stock_item ? 1 : 0, is_sales_item: form.is_sales_item ? 1 : 0, is_purchase_item: form.is_purchase_item ? 1 : 0, barcodes: barcodes.map(b => ({ barcode: b.barcode, uom: b.uom })), uoms: form.uoms.map(u => ({ uom: u.uom, conversion_factor: u.conversion_factor })), supplier_items: form.supplier_items.map(s => ({ supplier: s.supplier, supplier_part_no: s.supplier_part_no })) };
      await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', { doctype: 'Item', data }, { withCredentials: true });
      alert(isEditMode ? 'Item updated!' : 'Item created!');
      setShowForm(false); resetForm(); fetchItems();
    } catch (err) { alert(err.response?.data?.message || err.message || 'Save failed'); } finally { setSaving(false); }
  };

  const handleSavePrice = async () => {
    try {
      setSaving(true);
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', { item_code: editingItemCode, data: priceForm }, { withCredentials: true });
      if (res.data?.status === 'success' || res.data?.message?.status === 'success') { alert('Price updated'); setIsPriceDetailView(false); fetchPriceList(editingItemCode); }
      else throw new Error(res.data?.message?.message || 'Update failed');
    } catch (err) { alert(err.message || 'Error saving price'); } finally { setSaving(false); }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete ${code}?`)) return;
    try { await axios.delete(`/api/resource/Item/${code}`, { withCredentials: true }); alert('Deleted'); setShowForm(false); fetchItems(); } catch { alert('Delete failed'); }
  };

  const resetForm = () => { setForm({ ...emptyForm }); setBarcodes([]); setIsEditMode(false); setIsViewMode(false); setEditingItemCode(null); };

  const handleCloseForm = () => {
    const dirty = !isViewMode && (form.item_code || form.item_name || form.item_group || barcodes.length > 0);
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false); resetForm();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onloadend = () => setForm(p => ({ ...p, image: r.result, imagePreview: r.result }));
    r.readAsDataURL(file);
  };

  /* ── Filtering & pagination ── */
  const filteredItems = useMemo(() => items.filter(item => {
    const q = filterName.toLowerCase();
    const matchSearch = !q || item.item_code.toLowerCase().includes(q) || item.item_name.toLowerCase().includes(q);
    const matchGroup = !filterGroup || item.item_group?.toLowerCase().includes(filterGroup.toLowerCase());
    const matchStatus = !filterStatus || (filterStatus === 'Enabled' ? !item.disabled : item.disabled);
    const matchVariants = !filterHasVariants || (filterHasVariants === 'Yes' ? item.has_variants : !item.has_variants);
    return matchSearch && matchGroup && matchStatus && matchVariants;
  }), [items, filterName, filterGroup, filterStatus, filterHasVariants]);

  const total = filteredItems.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ═══════════════════════════════════════════
     RENDER — MAIN LIST PAGE
  ═══════════════════════════════════════════ */
  return (
    <>
      <NavBar />
      <div style={{ background: T.color.surface, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', flexDirection: 'column' }}>

        {/* ── Top Header ── */}
        <div style={{ background: T.color.bg, borderBottom: `1px solid ${T.color.border}`, padding: '0 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            {/* Left: title + view toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={18} color={accent} />
                <span style={{ fontSize: T.font.lg, fontWeight: T.weight.black, color: T.color.text }}>Items</span>
                <span style={{ fontSize: T.font.sm, color: T.color.textMuted, fontWeight: T.weight.medium }}>({total})</span>
              </div>

              {/* View toggle */}
              <div style={{ display: 'flex', background: T.color.surface, border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, padding: '3px', gap: '2px' }}>
                {[['list', 'List'], ['card', 'Image']].map(([k, lbl]) => (
                  <button key={k} onClick={() => setViewType(k)} style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: T.font.xs, fontWeight: T.weight.bold, background: viewType === k ? T.color.bg : 'transparent', color: viewType === k ? accent : T.color.textMuted, boxShadow: viewType === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Right: actions */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <BtnGhost onClick={() => navigate('/itempricelist')} style={{ gap: '7px' }}><Scale size={14} />Price Master</BtnGhost>
              <BtnGhost onClick={toggleTheme} style={{ minWidth: '80px' }}>{isGreen ? 'Blue' : 'Green'}</BtnGhost>
              <BtnPrimary style={{ background: accent }} onClick={() => { resetForm(); setShowForm(true); fetchItemGroups(); }}><Plus size={16} />Add Item</BtnPrimary>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ background: T.color.bg, borderBottom: `1px solid ${T.color.border}`, padding: '14px 40px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Global search */}
            <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: T.color.textLight }} />
              <input
                type="text" placeholder="Search name/code or SCAN BARCODE…"
                value={filterName} 
                onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && filterName.trim().length > 5) {
                    e.preventDefault();
                    try {
                      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_by_barcode_retail', { 
                        params: { barcode: filterName.trim() }, 
                        withCredentials: true 
                      });
                      const data = res.data?.message;
                      const item = Array.isArray(data) ? data[0] : data;
                      if (item && (item.item_code || item.name)) {
                        handleRowClick(item);
                        setFilterName('');
                      }
                    } catch (err) { console.error('Scan Error:', err); }
                  }
                }}
                style={{ width: '100%', padding: '9px 44px 9px 36px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.base, fontWeight: T.weight.medium, color: T.color.text, background: T.color.surface, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = accent}
                onBlur={e => e.target.style.borderColor = T.color.border}
              />
              <button 
                onClick={() => setShowCameraScanner('search')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: T.color.textLight, display: 'flex' }}
                onMouseEnter={e => e.currentTarget.style.color = accent}
                onMouseLeave={e => e.currentTarget.style.color = T.color.textLight}
              >
                <Camera size={16} />
              </button>
            </div>

            <input type="text" placeholder="Group…" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}
              style={{ width: '160px', padding: '9px 12px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.base, fontWeight: T.weight.medium, background: T.color.surface, color: T.color.text, outline: 'none' }} />

            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              style={{ padding: '9px 28px 9px 12px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.base, fontWeight: T.weight.medium, background: T.color.surface, color: T.color.text, outline: 'none', appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
              <option value="">All Status</option><option value="Enabled">Active</option><option value="Disabled">Disabled</option>
            </select>

            <select value={filterHasVariants} onChange={e => { setFilterHasVariants(e.target.value); setCurrentPage(1); }}
              style={{ padding: '9px 28px 9px 12px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.base, fontWeight: T.weight.medium, background: T.color.surface, color: T.color.text, outline: 'none', appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
              <option value="">All Variants</option><option value="Yes">Has Variants</option><option value="No">No Variants</option>
            </select>

            {(filterName || filterGroup || filterStatus || filterHasVariants) && (
              <button onClick={() => { setFilterName(''); setFilterGroup(''); setFilterStatus(''); setFilterHasVariants(''); setCurrentPage(1); }}
                style={{ padding: '9px 14px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, background: 'transparent', fontSize: T.font.sm, color: T.color.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <X size={13} />Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, padding: '24px 40px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
              <Loader2 size={32} color={accent} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : paginatedItems.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '280px', background: T.color.bg, borderRadius: T.radius.xl, border: `1px dashed ${T.color.border}` }}>
              <Package size={48} color={T.color.border} style={{ marginBottom: '16px' }} />
              <p style={{ fontSize: T.font.lg, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>No items found</p>
              <p style={{ fontSize: T.font.base, color: T.color.textMuted, margin: '6px 0 0' }}>Try adjusting your filters</p>
            </div>
          ) : viewType === 'card' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
              {paginatedItems.map(item => <ItemCard key={item.item_code} item={item} onClick={handleRowClick} />)}
            </div>
          ) : (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                    {['Item', 'Group', 'Status', 'Rate (AED)'].map((h, i) => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: i === 3 ? 'right' : 'left', fontSize: T.font.xs, fontWeight: T.weight.black, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item, idx) => (
                    <tr key={item.item_code} onClick={() => handleRowClick(item)} style={{ borderBottom: idx < paginatedItems.length - 1 ? `1px solid ${T.color.surface}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.color.surface}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: T.radius.md, background: T.color.surface, border: `1px solid ${T.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Package size={18} color={T.color.border} />}
                          </div>
                          <div>
                            <p style={{ fontWeight: T.weight.bold, color: T.color.text, fontSize: T.font.md, margin: 0 }}>{item.item_name}</p>
                            <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0', fontFamily: 'monospace' }}>{item.item_code}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: T.font.sm, color: T.color.slate, fontWeight: T.weight.medium }}>{item.item_group}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <Badge variant={item.disabled ? 'danger' : 'success'}>{item.disabled ? 'Disabled' : 'Active'}</Badge>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <p style={{ fontSize: T.font.md, fontWeight: T.weight.black, color: T.color.text, margin: 0 }}>
                          <span style={{ fontSize: T.font.xs, color: T.color.textLight, marginRight: '3px' }}>S:</span>
                          {Number(item.rate || item.standard_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: T.color.slate, margin: '2px 0 0' }}>
                          <span style={{ color: T.color.textLight, marginRight: '3px' }}>B:</span>
                          {Number(item.valuation_rate || 0).toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && total > 0 && (
          <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderTop: `1px solid ${T.color.border}`, padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 }}>
            <span style={{ fontSize: T.font.sm, color: T.color.textMuted }}>
              Showing <b style={{ color: T.color.text }}>{(currentPage - 1) * pageSize + 1}</b>–<b style={{ color: T.color.text }}>{Math.min(currentPage * pageSize, total)}</b> of <b style={{ color: T.color.text }}>{total}</b>
            </span>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              {/* Page size */}
              <div style={{ display: 'flex', gap: '4px', background: T.color.surface, border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, padding: '3px' }}>
                {[20, 50, 100].map(s => (
                  <button key={s} onClick={() => { setPageSize(s); setCurrentPage(1); }} style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: T.font.xs, fontWeight: T.weight.bold, background: pageSize === s ? T.color.bg : 'transparent', color: pageSize === s ? accent : T.color.textMuted, boxShadow: pageSize === s ? '0 1px 3px rgba(0,0,0,0.07)' : 'none' }}>{s}</button>
                ))}
              </div>
              {/* Page nav */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, background: T.color.bg, cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}><ChevronLeft size={15} /></button>
                <span style={{ fontSize: T.font.sm, fontWeight: T.weight.semibold, color: T.color.textMuted, minWidth: '80px', textAlign: 'center' }}>Page <b style={{ color: T.color.text }}>{currentPage}</b> / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, background: T.color.bg, cursor: currentPage >= totalPages ? 'default' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}><ChevronRight size={15} /></button>
              </div>
            </div>
          </div>
        )}

        {showCameraScanner && (
          <CameraScanner 
            onScan={async (val) => {
              const mode = showCameraScanner;
              setShowCameraScanner(null);
              if (mode === 'search') {
                try {
                  const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_by_barcode_retail', { params: { barcode: val }, withCredentials: true });
                  const data = res.data?.message;
                  const item = Array.isArray(data) ? data[0] : data;
                  if (item && (item.item_code || item.name)) handleRowClick(item);
                } catch { }
              } else {
                addBarcode(val);
              }
            }} 
            onClose={() => setShowCameraScanner(null)} 
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DETAIL / EDIT PANEL
      ═══════════════════════════════════════════ */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: T.color.surface, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, sans-serif" }}>

          {/* Panel header */}
          <div style={{ background: T.color.bg, borderBottom: `1px solid ${T.color.border}`, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={handleCloseForm} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, background: T.color.surface, cursor: 'pointer' }}><ChevronLeft size={16} /></button>
              <div>
                <p style={{ fontWeight: T.weight.black, fontSize: T.font.lg, color: T.color.text, margin: 0 }}>
                  {isViewMode ? form.item_name : (isEditMode ? 'Edit Item' : 'New Item')}
                </p>
                {isViewMode && <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '1px 0 0', fontFamily: 'monospace' }}>{editingItemCode}</p>}
              </div>
            </div>

            {/* Tabs (view mode only) */}
            {isViewMode && (
              <div style={{ display: 'flex', gap: '2px', background: T.color.surface, border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, padding: '3px' }}>
                {['General', 'Prices', 'Dashboard', 'Stock'].map(t => (
                  <button key={t} onClick={() => { setActiveTab(t); if (t !== 'Prices') setIsPriceDetailView(false); }}
                    style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: T.font.sm, fontWeight: T.weight.bold, background: activeTab === t ? T.color.bg : 'transparent', color: activeTab === t ? accent : T.color.textMuted, boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.07)' : 'none', transition: 'all 0.15s' }}>{t}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              {isViewMode && (
                <BtnGhost onClick={() => { setIsViewMode(false); setIsEditMode(true); }}><Edit2 size={14} />Edit</BtnGhost>
              )}
              {isViewMode && editingItemCode && (
                <BtnGhost onClick={() => handleDelete(editingItemCode)} style={{ color: T.color.red, borderColor: T.color.redBorder }}><Trash2 size={14} />Delete</BtnGhost>
              )}
            </div>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            {isViewMode ? <ViewPanel form={form} barcodes={barcodes} dashboardData={dashboardData} priceData={priceData} loadingDashboard={loadingDashboard} loadingPrices={loadingPrices} activeTab={activeTab} accent={accent} editingItemCode={editingItemCode} saving={saving} priceForm={priceForm} setPriceForm={setPriceForm} isPriceDetailView={isPriceDetailView} setIsPriceDetailView={setIsPriceDetailView} handleSavePrice={handleSavePrice} connectionActiveTab={connectionActiveTab} setConnectionActiveTab={setConnectionActiveTab} connectionSearch={connectionSearch} setConnectionSearch={setConnectionSearch} fromDate={fromDate} setFromDate={setFromDate} toDate={toDate} setToDate={setToDate} expandedLinks={expandedLinks} setExpandedLinks={setExpandedLinks} />
              : <EditPanel form={form} setForm={setForm} barcodes={barcodes} setBarcodes={setBarcodes} barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} addBarcode={addBarcode} removeBarcode={(i) => setBarcodes(p => p.filter((_, j) => j !== i))} isEditMode={isEditMode} isScanning={isScanning} setIsScanning={setIsScanning} setShowCameraScanner={setShowCameraScanner} itemGroups={itemGroups} brands={brands} uoms={uoms} barcodeInputRef={barcodeInputRef} fileInputRef={fileInputRef} handleImageChange={handleImageChange} addUomRow={addUomRow} removeUomRow={removeUomRow} updateUomRow={updateUomRow} addSupplierRow={addSupplierRow} removeSupplierRow={removeSupplierRow} updateSupplierRow={updateSupplierRow} accent={accent} />}
          </div>

          {/* Save footer (edit mode) */}
          {!isViewMode && (
            <div style={{ background: T.color.bg, borderTop: `1px solid ${T.color.border}`, padding: '16px 32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', flexShrink: 0 }}>
              <BtnGhost onClick={handleCloseForm}>Discard</BtnGhost>
              <BtnPrimary style={{ background: accent }} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isEditMode ? 'Update Item' : 'Create Item'}</BtnPrimary>
            </div>
          )}
        </div>
      )}

      {showCameraScanner && <CameraScanner onScan={c => { addBarcode(c); setShowCameraScanner(false); }} onClose={() => setShowCameraScanner(false)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } body { margin: 0; }`}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════
   VIEW PANEL — tabs: General / Prices / Dashboard / Stock
═══════════════════════════════════════════════ */
function ViewPanel({ form, barcodes, dashboardData, priceData, loadingDashboard, loadingPrices, activeTab, accent, editingItemCode, saving, priceForm, setPriceForm, isPriceDetailView, setIsPriceDetailView, handleSavePrice, connectionActiveTab, setConnectionActiveTab, connectionSearch, setConnectionSearch, fromDate, setFromDate, toDate, setToDate, expandedLinks, setExpandedLinks }) {

  // ── GENERAL TAB ──
  if (activeTab === 'General') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Metric bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <StatCard label="Avg Buying" value={`${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.average_buying_price || 0).toFixed(2)}`} accentColor={accent} />
          <StatCard label="Last Buying" value={`${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.last_buying_price || 0).toFixed(2)}`} accentColor={T.color.amber} />
          <StatCard label="Total Stock" value={`${priceData.metrics?.total_stock || 0} ${form.default_uom}`} accentColor={T.color.blue} />
          <StatCard label="Stock Value" value={`${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} accentColor={T.color.green} />
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 280px', gap: '16px', alignItems: 'start' }}>

          {/* Pricing */}
          <Card>
            <CardHeader icon={<Tag size={15} />} title="Pricing" />
            <div style={{ padding: '16px' }}>
              {dashboardData?.item_prices?.length > 0 ? dashboardData.item_prices.slice(0, 4).map((p, i) => (
                <div key={i} style={{ padding: '12px', borderRadius: T.radius.md, border: `1px solid ${T.color.border}`, marginBottom: i < 3 ? '8px' : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>{p.price_list}</p>
                    <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>{p.uom || 'Nos'}</p>
                  </div>
                  <p style={{ fontSize: T.font.lg, fontWeight: T.weight.black, color: accent, margin: 0 }}>
                    <span style={{ fontSize: T.font.xs, color: T.color.textLight, marginRight: '3px' }}>AED</span>
                    {Number(p.price_list_rate || 0).toFixed(2)}
                  </p>
                </div>
              )) : <p style={{ fontSize: T.font.sm, color: T.color.textMuted, textAlign: 'center', padding: '24px 0' }}>No prices configured</p>}
            </div>
          </Card>

          {/* Catalog info */}
          <Card>
            <CardHeader icon={<Info size={15} />} title="Catalog Info" />
            <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
              {[
                { label: 'Group', value: form.item_group },
                { label: 'Brand', value: form.brand || '—', color: accent },
                { label: 'Base UOM', value: form.default_uom },
                { label: 'HSN Code', value: form.hsn_code || '—' },
                { label: 'Valuation Rate', value: `AED ${Number(form.valuation_rate || 0).toFixed(2)}` },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 3px' }}>{label}</p>
                  <p style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: color || T.color.text, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* UOM conversions */}
          <Card>
            <CardHeader icon={<Scale size={15} />} title="Unit System" />
            {form.uoms?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black, textTransform: 'uppercase' }}>UOM</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black, textTransform: 'uppercase' }}>Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {form.uoms.map((u, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.color.surface}` }}>
                      <td style={{ padding: '11px 16px', fontSize: T.font.base, fontWeight: T.weight.bold, color: T.color.text }}>{u.uom}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: T.font.base, fontWeight: T.weight.bold, color: accent }}>{u.conversion_factor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: T.font.sm, color: T.color.textMuted }}>Single unit</p>}
          </Card>

          {/* Identity sidebar (tall card — spans 2 rows) */}
          <div style={{ gridRow: 'span 2' }}>
            <Card style={{ height: '100%' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', boxSizing: 'border-box' }}>
                {/* Image */}
                <div style={{ aspectRatio: '1', background: T.color.surface, borderRadius: T.radius.lg, border: `1px solid ${T.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {form.imagePreview ? <img src={form.imagePreview} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" /> : <Package size={48} color={T.color.border} />}
                </div>

                {/* Status badge */}
                <div style={{ padding: '12px 16px', borderRadius: T.radius.md, background: form.disabled ? T.color.redLight : T.color.greenLight, border: `1px solid ${form.disabled ? T.color.redBorder : T.color.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color={form.disabled ? T.color.red : T.color.green} />
                  <span style={{ fontSize: T.font.sm, fontWeight: T.weight.black, color: form.disabled ? T.color.red : T.color.green, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{form.disabled ? 'Disabled' : 'Active'}</span>
                </div>

                {/* Barcodes */}
                <div>
                  <p style={{ fontSize: T.font.xs, fontWeight: T.weight.black, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Barcodes</p>
                  {barcodes?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {barcodes.map((b, i) => (
                        <div key={i} style={{ background: T.color.surface, border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, padding: '8px 12px' }}>
                          <p style={{ fontFamily: 'monospace', fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>{b.barcode}</p>
                          <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>{b.uom}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ fontSize: T.font.sm, color: T.color.textLight }}>No barcodes</p>}
                </div>
              </div>
            </Card>
          </div>

          {/* Description + flags */}
          <Card style={{ gridColumn: 'span 3' }}>
            <CardHeader icon={<FileText size={15} />} title="Description & Settings" />
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: T.font.base, color: T.color.slate, lineHeight: '1.65', marginBottom: '20px' }}>
                {dashboardData?.item_details?.description || form.description || 'No description available.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { label: 'Stock Tracking', active: form.is_stock_item === 1 },
                  { label: 'Sales', active: form.is_sales_item === 1 },
                  { label: 'Purchasing', active: form.is_purchase_item === 1 },
                  { label: 'Loyalty Points', active: form.custom_loyalty_eligible === 1 },
                  { label: 'Manual Discount', active: form.custom_allow_discount === 1 },
                  { label: 'Has Variants', active: form.has_variants === 1 },
                ].map(({ label, active }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '100px', background: active ? T.color.greenLight : T.color.surface, border: `1px solid ${active ? T.color.greenBorder : T.color.border}` }}>
                    <Check size={12} color={active ? T.color.green : T.color.border} strokeWidth={3} />
                    <span style={{ fontSize: T.font.xs, fontWeight: T.weight.bold, color: active ? T.color.green : T.color.textLight }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Suppliers */}
          <Card>
            <CardHeader icon={<Users size={15} />} title="Suppliers" />
            <div style={{ padding: '12px' }}>
              {form.supplier_items?.length > 0 ? form.supplier_items.map((s, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: T.radius.md, background: T.color.surface, border: `1px solid ${T.color.border}`, marginBottom: i < form.supplier_items.length - 1 ? '6px' : 0 }}>
                  <p style={{ fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>{s.supplier}</p>
                  <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>Part: {s.supplier_part_no || '—'}</p>
                </div>
              )) : <p style={{ fontSize: T.font.sm, color: T.color.textMuted, textAlign: 'center', padding: '20px 0' }}>No suppliers linked</p>}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── PRICES TAB ──
  if (activeTab === 'Prices') {
    if (isPriceDetailView) {
      return (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <button onClick={() => setIsPriceDetailView(false)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, background: T.color.bg, cursor: 'pointer' }}><ChevronLeft size={16} /></button>
            <div>
              <p style={{ fontSize: T.font.lg, fontWeight: T.weight.black, color: T.color.text, margin: 0 }}>Price Configuration</p>
              <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>{priceForm.name || 'New price definition'}</p>
            </div>
          </div>

          <Card style={{ padding: '28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <FieldRow label="Price List">
                <Select value={priceForm.price_list} onChange={e => setPriceForm({ ...priceForm, price_list: e.target.value, buying: e.target.value.toLowerCase().includes('buying') ? 1 : priceForm.buying, selling: e.target.value.toLowerCase().includes('selling') ? 1 : priceForm.selling })}>
                  <option value="Standard Selling">Standard Selling</option>
                  <option value="Standard Buying">Standard Buying</option>
                  <option value="Cash Selling">Cash Selling</option>
                  <option value="Retail Buying">Retail Buying</option>
                </Select>
              </FieldRow>
              <FieldRow label="Unit (UOM)">
                <Select value={priceForm.uom} onChange={e => setPriceForm({ ...priceForm, uom: e.target.value })}>
                  {[form.default_uom, ...(form.uoms || []).map(u => u.uom)].filter((v, i, a) => v && a.indexOf(v) === i).map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </FieldRow>
            </div>

            <FieldRow label="Rate (AED)">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: T.font.sm, color: T.color.textLight, fontWeight: T.weight.bold }}>AED</span>
                <input type="number" value={priceForm.price_list_rate} onChange={e => setPriceForm({ ...priceForm, price_list_rate: Number(e.target.value) })}
                  style={{ width: '100%', padding: '16px 16px 16px 52px', border: `2px solid ${T.color.border}`, borderRadius: T.radius.lg, fontSize: '28px', fontWeight: T.weight.black, color: accent, textAlign: 'center', outline: 'none', boxSizing: 'border-box', background: T.color.bg }}
                  onFocus={e => e.target.style.borderColor = accent} onBlur={e => e.target.style.borderColor = T.color.border} />
              </div>
            </FieldRow>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
              {[
                { key: 'buying', label: 'Buying Price', activeColor: T.color.amber, activeBg: T.color.amberLight },
                { key: 'selling', label: 'Selling Price', activeColor: T.color.green, activeBg: T.color.greenLight },
              ].map(({ key, label, activeColor, activeBg }) => {
                const active = priceForm[key] === 1;
                return (
                  <button key={key} onClick={() => setPriceForm({ ...priceForm, [key]: active ? 0 : 1 })}
                    style={{ padding: '16px', border: `2px solid ${active ? activeColor : T.color.border}`, borderRadius: T.radius.lg, background: active ? activeBg : T.color.bg, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: T.font.sm, fontWeight: T.weight.black, color: active ? activeColor : T.color.textMuted, margin: 0 }}>{label}</p>
                      <p style={{ fontSize: T.font.xs, color: active ? activeColor : T.color.textLight, margin: '2px 0 0' }}>{active ? 'Enabled' : 'Disabled'}</p>
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${active ? activeColor : T.color.border}`, background: active ? activeColor : T.color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active && <Check size={11} color="#fff" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '28px', paddingTop: '20px', borderTop: `1px solid ${T.color.border}` }}>
              <BtnGhost onClick={() => setIsPriceDetailView(false)}>Discard</BtnGhost>
              <BtnPrimary style={{ background: accent }} onClick={handleSavePrice} disabled={saving}>{saving ? 'Saving…' : priceForm.name ? 'Update Price' : 'Create Price'}</BtnPrimary>
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: T.font.xl, fontWeight: T.weight.black, color: T.color.text, margin: 0 }}>Price Registry</p>
            <p style={{ fontSize: T.font.sm, color: T.color.textMuted, margin: '4px 0 0' }}>{priceData.prices?.length || 0} price definitions</p>
          </div>
          <BtnPrimary style={{ background: accent }} onClick={() => { setPriceForm({ price_list: 'Standard Selling', uom: form.default_uom, price_list_rate: 0, buying: 0, selling: 1, name: '' }); setIsPriceDetailView(true); }}><Plus size={15} />Add Price</BtnPrimary>
        </div>

        <Card>
          {loadingPrices ? (
            <div style={{ padding: '80px', textAlign: 'center' }}><Loader2 size={32} color={accent} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : priceData.prices?.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center' }}>
              <Scale size={40} color={T.color.border} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>No prices configured</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                  {['Price List / UOM', 'Type', 'Rate (AED)', ''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 20px', textAlign: i === 2 ? 'right' : i === 3 ? 'center' : 'left', fontSize: T.font.xs, fontWeight: T.weight.black, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priceData.prices.map((p, idx) => (
                  <tr key={p.name || idx} onClick={() => { setPriceForm({ ...p }); setIsPriceDetailView(true); }}
                    style={{ borderBottom: `1px solid ${T.color.surface}`, cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.color.surface}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <p style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>{p.price_list}</p>
                      <p style={{ fontSize: T.font.xs, color: T.color.textMuted, margin: '2px 0 0' }}>{p.uom}</p>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {p.buying === 1 && <Badge variant="warning">Buying</Badge>}
                        {p.selling === 1 && <Badge variant="success">Selling</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: T.font.lg, fontWeight: T.weight.black, color: T.color.text }}>{Number(p.price_list_rate || 0).toFixed(2)}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}><ChevronRight size={16} color={T.color.textLight} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  }

  // ── DASHBOARD TAB ──
  if (activeTab === 'Dashboard') {
    if (loadingDashboard) return <div style={{ padding: '80px', textAlign: 'center' }}><Loader2 size={32} color={accent} style={{ animation: 'spin 1s linear infinite' }} /></div>;

    const connections = dashboardData?.connections || dashboardData?.categories || {};
    const catKeys = Object.keys(connections);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {dashboardData?.analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <StatCard label="Sales Volume" value={`AED ${Number(dashboardData.analytics.gross_sales?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${dashboardData.analytics.gross_sales?.total_qty || 0} units transacted`} accentColor={accent} />
            <StatCard label="Purchase Volume" value={`AED ${Number(dashboardData.analytics.gross_purchasing?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`${dashboardData.analytics.gross_purchasing?.total_qty || 0} units procured`} accentColor={T.color.amber} />
            <StatCard label="Stock Level" value={`${dashboardData.stock_status?.total_qty || 0} units`} sub={`Across ${dashboardData.stock_status?.warehouse_details?.length || 0} warehouses`} accentColor={T.color.green} />
          </div>
        )}

        {catKeys.length > 0 && (
          <Card>
            {/* Category tabs */}
            <div style={{ padding: '0 4px', background: T.color.surface, borderBottom: `1px solid ${T.color.border}`, display: 'flex', gap: '0', overflowX: 'auto' }}>
              {catKeys.map(cat => (
                <button key={cat} onClick={() => setConnectionActiveTab(cat)}
                  style={{ padding: '14px 24px', border: 'none', borderBottom: connectionActiveTab === cat ? `2px solid ${accent}` : '2px solid transparent', background: 'transparent', fontSize: T.font.sm, fontWeight: T.weight.bold, color: connectionActiveTab === cat ? accent : T.color.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}>{cat}</button>
              ))}
            </div>

            {/* Search/date bar */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.color.border}`, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: T.color.textLight }} />
                <input type="text" placeholder="Search by order ID, status…" value={connectionSearch} onChange={e => setConnectionSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 34px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.sm, background: T.color.surface, outline: 'none', boxSizing: 'border-box', color: T.color.text, fontWeight: T.weight.medium }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} color={T.color.textLight} />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '8px 10px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.sm, background: T.color.surface, outline: 'none', color: T.color.text }} />
                <span style={{ color: T.color.textLight, fontSize: T.font.sm }}>→</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '8px 10px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, fontSize: T.font.sm, background: T.color.surface, outline: 'none', color: T.color.text }} />
              </div>
            </div>

            {/* Connection rows */}
            <div style={{ padding: '12px' }}>
              {(() => {
                const links = connections[connectionActiveTab];
                if (!links || typeof links !== 'object') return <p style={{ padding: '32px', textAlign: 'center', color: T.color.textMuted, fontSize: T.font.sm }}>No records found</p>;
                const rows = Object.entries(links).filter(([, v]) => Array.isArray(v)).map(([k, v]) => {
                  const filtered = v.filter(doc => {
                    const s = connectionSearch.toLowerCase();
                    const d = doc.posting_date || '';
                    return (!s || (doc.name || '').toLowerCase().includes(s) || (doc.status || '').toLowerCase().includes(s)) && (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
                  });
                  return { label: k, data: filtered, total: v.length };
                }).filter(r => r.data.length > 0 || (!connectionSearch && !fromDate && !toDate));

                if (rows.length === 0) return <p style={{ padding: '32px', textAlign: 'center', color: T.color.textMuted, fontSize: T.font.sm }}>No matching records</p>;
                return rows.map((row, idx) => {
                  const exp = expandedLinks[row.label] || connectionSearch || fromDate || toDate;
                  return (
                    <div key={idx} style={{ marginBottom: '8px' }}>
                      <div onClick={() => setExpandedLinks(p => ({ ...p, [row.label]: !p[row.label] }))}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: T.radius.md, border: `1px solid ${exp ? accent : T.color.border}`, background: exp ? `${accent}08` : T.color.surface, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <span style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text }}>{row.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Badge variant="info">{row.total}</Badge>
                          <ChevronDown size={14} color={T.color.textMuted} style={{ transform: exp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>
                      </div>
                      {exp && (
                        <div style={{ marginTop: '6px', border: `1px solid ${T.color.border}`, borderRadius: T.radius.md, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                                {['Ref ID', 'Date', 'Qty', 'Rate', 'Total', 'Serial'].map((h, i) => (
                                  <th key={h} style={{ padding: '10px 14px', textAlign: i > 1 && i < 5 ? 'right' : 'left', fontSize: T.font.xs, fontWeight: T.weight.black, color: T.color.textLight, textTransform: 'uppercase' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {row.data.map((doc, di) => (
                                <tr key={di} style={{ borderBottom: di < row.data.length - 1 ? `1px solid ${T.color.surface}` : 'none' }}>
                                  <td style={{ padding: '11px 14px' }}>
                                    <p style={{ fontSize: T.font.sm, fontWeight: T.weight.bold, color: accent, margin: 0 }}>{doc.name || doc.parent || '—'}</p>
                                    <p style={{ fontSize: T.font.xs, color: T.color.green, margin: '2px 0 0', fontWeight: T.weight.bold }}>{doc.status}</p>
                                  </td>
                                  <td style={{ padding: '11px 14px', fontSize: T.font.sm, color: T.color.slate, fontWeight: T.weight.medium }}>{doc.posting_date ? doc.posting_date.split('-').reverse().join('-') : '—'}</td>
                                  <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.text }}>{doc.qty || 0} <span style={{ color: T.color.textLight, fontWeight: T.weight.normal }}>{doc.uom}</span></td>
                                  <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: T.font.sm, color: T.color.slate }}>{Number(doc.rate || 0).toFixed(2)}</td>
                                  <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: T.font.sm, fontWeight: T.weight.bold, color: accent }}>{Number(doc.amount || (doc.qty * doc.rate) || 0).toFixed(2)}</td>
                                  <td style={{ padding: '11px 14px', fontSize: T.font.xs, fontFamily: 'monospace', color: T.color.textMuted }}>{doc.custom_supplier_sl_num || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── STOCK TAB ──
  if (activeTab === 'Stock') {
    return (
      <Card>
        <CardHeader icon={<Package size={15} />} title="Warehouse Inventory" action={<Badge variant="info">Live</Badge>} />
        {loadingPrices ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><Loader2 size={28} color={accent} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : priceData.warehouse_breakdown?.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                {['Location', 'On Hand', 'Avg Buy Price', 'Stock Value'].map((h, i) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: i > 0 ? 'right' : 'left', fontSize: T.font.xs, fontWeight: T.weight.black, color: T.color.textLight, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priceData.warehouse_breakdown.map((w, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.color.surface}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.color.surface}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: T.radius.sm, background: T.color.surface, border: `1px solid ${T.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={14} color={T.color.textLight} />
                      </div>
                      <span style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text }}>{w.warehouse}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: T.font.md, fontWeight: T.weight.black, color: accent }}>{w.stock} <span style={{ fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.normal }}>{form.default_uom}</span></td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: T.font.md, fontWeight: T.weight.semibold, color: T.color.text }}><span style={{ fontSize: T.font.xs, color: T.color.textLight, marginRight: '4px' }}>AED</span>{Number(w.avg_buying_price || 0).toFixed(2)}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: T.font.md, fontWeight: T.weight.black, color: T.color.green }}><span style={{ fontSize: T.font.xs, color: T.color.textLight, marginRight: '4px' }}>AED</span>{Number(w.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Package size={40} color={T.color.border} style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: T.font.md, fontWeight: T.weight.bold, color: T.color.text, margin: 0 }}>No stock data available</p>
          </div>
        )}
      </Card>
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════
   EDIT PANEL — create / edit form
═══════════════════════════════════════════════ */
function EditPanel({ form, setForm, barcodes, setBarcodes, barcodeInput, setBarcodeInput, addBarcode, removeBarcode, isEditMode, isScanning, setIsScanning, setShowCameraScanner, itemGroups, brands, uoms, barcodeInputRef, fileInputRef, handleImageChange, addUomRow, removeUomRow, updateUomRow, addSupplierRow, removeSupplierRow, updateSupplierRow, accent }) {
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>

      {/* Basic Specs */}
      <Card>
        <CardHeader icon={<Package size={15} />} title="Item Specifications" />
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <FieldRow label="Item Code *"><Input value={form.item_code} onChange={e => sf('item_code', e.target.value)} disabled={isEditMode} placeholder="AUTO or custom" /></FieldRow>
          <FieldRow label="Item Name *"><Input value={form.item_name} onChange={e => sf('item_name', e.target.value)} placeholder="Full item name" /></FieldRow>
          <FieldRow label="HSN/SAC Code"><Input value={form.hsn_code} onChange={e => sf('hsn_code', e.target.value)} placeholder="GST code" /></FieldRow>
          <FieldRow label="Item Group *">
            <Select value={form.item_group} onChange={e => sf('item_group', e.target.value)}>
              <option value="">Select group…</option>
              {itemGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
          </FieldRow>
          <FieldRow label="Brand">
            <Select value={form.brand} onChange={e => { if (e.target.value === 'CREATE_NEW') { const n = prompt('New brand name:'); if (n) { /* handleCreateBrand(n) */ } } else sf('brand', e.target.value); }}>
              <option value="">No brand</option>
              {brands.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              <option value="CREATE_NEW">+ Create brand…</option>
            </Select>
          </FieldRow>
          <FieldRow label="Base UOM *">
            <Select value={form.default_uom} onChange={e => { if (e.target.value === 'CREATE_NEW') { const n = prompt('New UOM name:'); if (n) { /* handleCreateUom(n) */ } } else sf('default_uom', e.target.value); }}>
              {uoms.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              <option value="CREATE_NEW">+ Create UOM…</option>
            </Select>
          </FieldRow>
        </div>
      </Card>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card>
          <CardHeader icon={<BarChart3 size={15} />} title="Inventory & Sales" />
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <CheckRow label="Maintain Stock" desc="Track inventory movements" checked={form.is_stock_item === 1} onChange={e => sf('is_stock_item', e.target.checked ? 1 : 0)} />
            <CheckRow label="Allow Sales" desc="Show in POS and Sales Orders" checked={form.is_sales_item === 1} onChange={e => sf('is_sales_item', e.target.checked ? 1 : 0)} />
            <CheckRow label="Allow Purchase" desc="Available for procurement" checked={form.is_purchase_item === 1} onChange={e => sf('is_purchase_item', e.target.checked ? 1 : 0)} />
          </div>
        </Card>
        <Card>
          <CardHeader icon={<Tag size={15} />} title="Loyalty & Discounts" />
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <CheckRow label="Loyalty Eligible" desc="Earn points on purchase" checked={form.custom_loyalty_eligible === 1} onChange={e => sf('custom_loyalty_eligible', e.target.checked ? 1 : 0)} />
            <CheckRow label="Allow Discount" desc="Enable manual price override" checked={form.custom_allow_discount === 1} onChange={e => sf('custom_allow_discount', e.target.checked ? 1 : 0)} />
            <CheckRow label="Disabled" desc="Hide from active registries" danger checked={form.disabled} onChange={e => sf('disabled', e.target.checked)} />
          </div>
        </Card>
      </div>

      {/* Barcodes */}
      <Card>
        <CardHeader icon={<Tag size={15} />} title="Barcodes" action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <BtnGhost style={{ padding: '6px 12px', fontSize: T.font.xs }} onClick={() => setShowCameraScanner('form')}><Camera size={13} />Camera</BtnGhost>
            <BtnGhost style={{ padding: '6px 12px', fontSize: T.font.xs, color: isScanning ? accent : T.color.slate, borderColor: isScanning ? accent : T.color.border }} onClick={() => setIsScanning(p => !p)}>Scanner {isScanning ? '(active)' : ''}</BtnGhost>
          </div>
        } />
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Input ref={barcodeInputRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBarcode(barcodeInput)} placeholder="Type barcode and press Enter…" />
            <BtnPrimary style={{ background: accent, flexShrink: 0 }} onClick={() => addBarcode(barcodeInput)}>Add</BtnPrimary>
          </div>
          {barcodes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {barcodes.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 6px 14px', background: T.color.surface, border: `1px solid ${T.color.border}`, borderRadius: '100px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: T.font.sm, fontWeight: T.weight.bold, color: T.color.text }}>{b.barcode}</span>
                  <span style={{ fontSize: T.font.xs, color: T.color.textLight }}>({b.uom})</span>
                  <button onClick={() => removeBarcode(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.color.red, display: 'flex', padding: '2px' }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* UOM + Suppliers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Card>
          <CardHeader title="UOM Conversions" action={<BtnGhost style={{ padding: '5px 10px', fontSize: T.font.xs }} onClick={addUomRow}><Plus size={12} />Add</BtnGhost>} />
          {form.uoms.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: T.font.sm, color: T.color.textMuted }}>No conversions defined</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black }}>UOM</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black }}>Factor</th>
                <th style={{ width: '40px' }}></th>
              </tr></thead>
              <tbody>
                {form.uoms.map((u, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.color.surface}` }}>
                    <td style={{ padding: '8px 14px' }}><Input value={u.uom} onChange={e => updateUomRow(i, 'uom', e.target.value)} placeholder="e.g. Box" style={{ padding: '7px 10px' }} /></td>
                    <td style={{ padding: '8px 14px' }}><Input type="number" value={u.conversion_factor} onChange={e => updateUomRow(i, 'conversion_factor', Number(e.target.value))} style={{ textAlign: 'right', padding: '7px 10px' }} /></td>
                    <td style={{ textAlign: 'center', padding: '8px' }}><button onClick={() => removeUomRow(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.color.red, display: 'flex', padding: '4px' }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Supplier Mapping" action={<BtnGhost style={{ padding: '5px 10px', fontSize: T.font.xs }} onClick={addSupplierRow}><Plus size={12} />Add</BtnGhost>} />
          {form.supplier_items.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', fontSize: T.font.sm, color: T.color.textMuted }}>No suppliers linked</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: T.color.surface, borderBottom: `1px solid ${T.color.border}` }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black }}>Supplier</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: T.font.xs, color: T.color.textLight, fontWeight: T.weight.black }}>Part No.</th>
                <th style={{ width: '40px' }}></th>
              </tr></thead>
              <tbody>
                {form.supplier_items.map((s, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.color.surface}` }}>
                    <td style={{ padding: '8px 14px' }}><Input value={s.supplier} onChange={e => updateSupplierRow(i, 'supplier', e.target.value)} placeholder="Supplier name" style={{ padding: '7px 10px' }} /></td>
                    <td style={{ padding: '8px 14px' }}><Input value={s.supplier_part_no} onChange={e => updateSupplierRow(i, 'supplier_part_no', e.target.value)} placeholder="SKU / Part" style={{ padding: '7px 10px' }} /></td>
                    <td style={{ textAlign: 'center', padding: '8px' }}><button onClick={() => removeSupplierRow(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.color.red, display: 'flex', padding: '4px' }}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Image upload */}
      <Card>
        <CardHeader icon={<Camera size={15} />} title="Item Image" />
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: T.radius.lg, background: T.color.surface, border: `1px solid ${T.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {form.imagePreview ? <img src={form.imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Package size={36} color={T.color.border} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <BtnGhost onClick={() => fileInputRef.current?.click()}><Camera size={14} />Upload Photo</BtnGhost>
            {form.imagePreview && <button onClick={() => setForm(p => ({ ...p, image: null, imagePreview: null }))} style={{ border: 'none', background: 'transparent', fontSize: T.font.sm, color: T.color.red, cursor: 'pointer', textAlign: 'left', padding: 0 }}>Remove image</button>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
        </div>
      </Card>
    </div>
  );
}