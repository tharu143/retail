// src/Components/Admin/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle, Trash2, ChevronDown, Palette, Loader2, ChevronRight,
  Edit2, ShoppingCart, Barcode, Tag, Box, Info, ShieldCheck, Scale, MapPin, Activity, FileText
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
import { useNavigate } from 'react-router-dom';
import NavBar from '../Nav/NavBar';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';


/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ disabled, themeColor }) => (
  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm" style={{
    backgroundColor: !disabled ? `${themeColor}15` : '#fee2e2',
    color: !disabled ? themeColor : '#ef4444',
    border: `1px solid ${!disabled ? `${themeColor}30` : '#fecaca'}`
  }}>
    {!disabled ? 'Enabled' : 'Disabled'}
  </span>
);

/* ==================== CAMERA SCANNER ==================== */
const CameraScanner = ({ onScan, onClose }) => {
  const videoRef = useRef(null);
  const reader = useRef(new BrowserMultiFormatReader());

  useEffect(() => {
    reader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) {
        onScan(result.getText());
      }
    });
    return () => reader.current.reset();
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white p-5 flex justify-between items-center shadow-lg">
        <h3 className="text-xl font-semibold">Scan Barcode with Camera</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-7 h-7" />
        </button>
      </div>
      <video ref={videoRef} className="flex-1 w-full object-cover" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none" style={{ position: 'absolute' }}>
        <div className="border-4 border-red-500 rounded-xl w-80 h-48 opacity-80"></div>
      </div>
      <div className="absolute bottom-10 left-0 right-0 text-center" style={{ position: 'absolute' }}>
        <p className="text-white text-xl font-medium bg-black bg-opacity-60 py-3 px-8 rounded-full inline-block">
          Align barcode inside the red frame
        </p>
      </div>
    </div>
  );
};

export default function ItemList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewType, setViewType] = useState('card');

  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();


  // Filters
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHasVariants, setFilterHasVariants] = useState('');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_code: '', item_name: '', item_group: '', disabled: false,
    maintain_stock: true, has_variants: false, is_variant: false, variant_of: '',
    opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0, brand: '',
    default_uom: 'Nos', description: '', image: null, imagePreview: null,
    uoms: []
  });
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingItemCode, setEditingItemCode] = useState(null);
  const [warehouseDetails, setWarehouseDetails] = useState([]);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  const fileInputRef = useRef(null);

  const [itemGroups, setItemGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Dashboard Tab Data
  const [activeTab, setActiveTab] = useState('General');
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [priceData, setPriceData] = useState({ prices: [], metrics: {}, warehouse_breakdown: [] });
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [isPriceDetailView, setIsPriceDetailView] = useState(false);
  const [priceForm, setPriceForm] = useState({
    price_list: '', uom: '', price_list_rate: 0, buying: 0, selling: 1, name: ''
  });
  const [expandedLinks, setExpandedLinks] = useState({});
  const toggleLinkExpansion = (key) => setExpandedLinks(prev => ({ ...prev, [key]: !prev[key] }));

  // Barcodes
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const barcodeInputRef = useRef(null);

  const selectedGroupLabel = useMemo(() => {
    const g = itemGroups.find(g => g.value === form.item_group);
    return g ? g.label : 'Select Group';
  }, [itemGroups, form.item_group]);

  /* ==================== HARDWARE SCANNER ==================== */
  useEffect(() => {
    if (!showForm || !isScanning) return;
    let input = '';
    let timeout;
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && input.trim().length > 3) {
        e.preventDefault();
        addBarcode(input.trim());
        input = '';
      } else if (e.key.length === 1) {
        input += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => input = '', 100);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm, isScanning]);

  /* ==================== ADD BARCODE ==================== */
  const addBarcode = async (code) => {
    if (!code) return;
    code = code.trim();
    if (!code) return;
    if (barcodes.some(b => b.barcode === code)) {
      alert('This barcode is already added!');
      return;
    }
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', {
        params: { barcode: code },
        withCredentials: true
      });
      if (res.data?.message?.exists) {
        alert(`Barcode ${code} is already used by item: ${res.data.message.item}`);
        return;
      }
    } catch (err) { console.error(err); }
    setBarcodes(prev => [...prev, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput('');
    setIsScanning(false);
  };

  /* ==================== FETCH DATA ==================== */
  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Item', {
        params: {
          limit_page_length: 5000,
          fields: JSON.stringify(["item_code", "item_name", "item_group", "stock_uom", "image", "description", "disabled", "has_variants", "standard_rate"]),
          order_by: 'item_name asc'
        },
        withCredentials: true
      });
      const data = res.data?.data || [];
      setItems(data);
    } catch (err) {
      console.error('Fetch Items Error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchItemDashboardDetails = async (code) => {
    try {
      setLoadingDashboard(true);
      setLoadingWarehouse(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_dashboard_details', {
        params: { item_code: code },
        withCredentials: true
      });
      const result = res.data?.message || {};
      setDashboardData(result);
      
      // Sync form with fresh item details from dashboard call
      if (result.item_details) {
        const item = result.item_details;
        setForm(prev => ({
          ...prev,
          brand: item.brand || '',
          valuation_rate: item.valuation_rate || 0,
          is_variant: item.has_variants === 1,
          variant_of: item.variant_of || '',
          uoms: item.uoms || [],
          description: item.description || prev.description
        }));
      }
      
      if (result.stock_status?.warehouse_details) {
        setWarehouseDetails(result.stock_status.warehouse_details);
      }
    } catch (err) {
      console.error('Fetch Dashboard Error:', err);
      setDashboardData({});
    } finally {
      setLoadingDashboard(false);
      setLoadingWarehouse(false);
    }
  };

  const fetchPriceList = async (code) => {
    try {
      setLoadingPrices(true);
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_prices', {
        params: { item_code: code },
        withCredentials: true
      });
      const result = res.data.message;
      setPriceData({
        prices: result?.data || [],
        metrics: result?.metrics || {},
        warehouse_breakdown: result?.warehouse_breakdown || []
      });
    } catch (err) {
      console.error('Fetch Prices Error:', err);
      setPriceData({ prices: [], metrics: {}, warehouse_breakdown: [] });
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleSavePrice = async () => {
    try {
      setSaving(true);
      const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
        item_code: editingItemCode,
        data: priceForm
      }, { withCredentials: true });

      if (res.data.status === 'success' || res.data.message?.status === 'success') {
        alert('Price updated successfully');
        setShowPriceForm(false);
        fetchPriceList(editingItemCode);
      } else {
        throw new Error(res.data.message?.message || 'Update failed');
      }
    } catch (err) {
      alert(err.message || 'Error saving price');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (showForm || isEditMode) {
      const t = setTimeout(() => fetchItemGroups(groupSearch), 300);
      return () => clearTimeout(t);
    }
  }, [groupSearch, showForm, isEditMode]);

  const fetchItemGroups = async (search = '') => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', {
        params: { search },
        withCredentials: true
      });
      if (res.data.message && (res.data.message.status === 'success' || res.data.message.success || res.data.message.data)) {
        const rawData = res.data.message.data || res.data.message;
        const groups = (Array.isArray(rawData) ? rawData : []).map(g => typeof g === 'string' ? { label: g, value: g } : g);
        setItemGroups(groups);
      }
    } catch (err) { 
      console.error("Fetch Item Groups Error:", err); 
    }
  };

  /* ==================== FILTERING ==================== */
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const id = !filterId || item.item_code.toLowerCase().includes(filterId.toLowerCase());
      const name = !filterName || item.item_name.toLowerCase().includes(filterName.toLowerCase());
      const group = !filterGroup || item.item_group.toLowerCase().includes(filterGroup.toLowerCase());
      const status = !filterStatus || (filterStatus === 'Enabled' ? !item.disabled : item.disabled);
      const variants = !filterHasVariants || (filterHasVariants === 'Yes' ? item.has_variants : !item.has_variants);
      return id && name && group && status && variants;
    });
  }, [items, filterId, filterName, filterGroup, filterStatus, filterHasVariants]);

  const total = filteredItems.length;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setForm({ ...form, image: reader.result, imagePreview: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setForm({ ...form, image: null, imagePreview: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.item_group || !form.default_uom.trim()) {
      alert('Missing required fields');
      return;
    }
    setSaving(true);
    try {
      const data = {
        item_code: form.item_code, item_name: form.item_name, item_group: form.item_group,
        stock_uom: form.default_uom, standard_rate: parseFloat(form.standard_selling_rate) || 0,
        disabled: form.disabled ? 1 : 0, maintain_stock: form.maintain_stock ? 1 : 0,
        has_variants: form.has_variants ? 1 : 0, description: form.description || '', image: form.image || ''
      };
      if (isEditMode) {
        await axios.put(`/api/resource/Item/${editingItemCode}`, data, { withCredentials: true });
        alert('Item updated!');
      } else {
        await axios.post('/api/method/kyle_retail.retail_api.api.create_generic_doc', { doctype: "Item", data }, { withCredentials: true });
        alert('Item created!');
      }
      setShowForm(false); resetForm(); fetchItems();
    } catch (err) { alert(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (itemCode) => {
    if (!window.confirm(`Are you sure you want to delete ${itemCode}?`)) return;
    try {
      await axios.delete(`/api/resource/Item/${itemCode}`, { withCredentials: true });
      alert('Item deleted'); setShowForm(false); fetchItems();
    } catch (err) { alert('Delete failed'); }
  };

  const handleRowClick = async (item) => {
    setIsViewMode(true); setIsEditMode(false); setEditingItemCode(item.item_code);
    setForm({
      item_code: item.item_code, item_name: item.item_name, item_group: item.item_group,
      disabled: item.disabled === 1, maintain_stock: true, has_variants: item.has_variants === 1,
      default_uom: item.stock_uom || 'Nos', standard_selling_rate: item.standard_rate || 0,
      imagePreview: item.image, image: null
    });
    setWarehouseDetails([]); setShowForm(true); setActiveTab('General');
    fetchPriceList(item.item_code);
    fetchItemDashboardDetails(item.item_code);
  };

  const resetForm = () => {
    setForm({
      item_code: '', item_name: '', item_group: '', disabled: false,
      maintain_stock: true, has_variants: false,
      standard_selling_rate: 0, default_uom: 'Nos', description: '', image: null, imagePreview: null
    });
    setBarcodes([]); setIsEditMode(false); setIsViewMode(false); setEditingItemCode(null);
  };

  const handleCloseForm = () => {
    const hasChanges = !isViewMode && (form.item_code || form.item_name || form.item_group || barcodes.length > 0 || form.image);
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false); setBarcodes([]);
    setForm(prev => ({ ...prev, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
  };

  const clearFilters = () => {
    setFilterId(''); setFilterName(''); setFilterGroup(''); setFilterStatus(''); setFilterHasVariants(''); setCurrentPage(1);
  };
  const ItemCard = ({ item, themeColor, onClick }) => (
    <div
      onClick={() => onClick(item)}
      style={{
        background: 'white',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        border: '1px solid #f1f5f9'
      }}
      className="group hover:shadow-lg hover:-translate-y-1"
    >
      <div style={{ height: '150px', background: '#f8fafc', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        {item.image ? (
          <img src={item.image} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={item.item_name} />
        ) : (
          <div style={{ textAlign: 'center', opacity: 0.2 }}>
            <Package size={48} />
            <p style={{ fontSize: '9px', fontWeight: 900, marginTop: '4px', textTransform: 'uppercase' }}>NO IMAGE</p>
          </div>
        )}
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <span style={{ background: '#e0f2fe', color: '#0ea5e9', padding: '4px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
            ENABLED
          </span>
        </div>
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{item.item_group || 'ADHESIVES & TAPES'}</p>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#333', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '42px' }}>{item.item_name}</h3>
      </div>
      <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{item.stock_uom || 'Nos'}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '16px', fontWeight: 900, color: '#0ea5e9' }}><span style={{ fontSize: '11px', marginRight: '4px', fontWeight: 800 }}>AED</span>{Number(item.standard_rate || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <NavBar />
      <div className="so-page" style={{ background: '#f5f6f8', minHeight: '100vh', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header Section */}
        <div style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#333', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}><Package size={22} style={{ color: '#0ea5e9' }} /> ITEMS</h1>
              <p style={{ fontSize: '12px', color: '#777', fontWeight: 600, marginTop: '2px', margin: 0 }}>{total} record(s) found</p>
            </div>
            <div style={{ background: '#e2e8f0', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
              <button onClick={() => setViewType('card')} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: viewType === 'card' ? '#0ea5e9' : '#64748b', background: viewType === 'card' ? 'white' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: viewType === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}><Tag size={13} /> IMAGE VIEW</button>
              <button onClick={() => setViewType('list')} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: viewType === 'list' ? '#0ea5e9' : '#64748b', background: viewType === 'list' ? 'white' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: viewType === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}><Users size={13} /> LIST VIEW</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => navigate('/itempricelist')}
              style={{ padding: '10px 24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 900, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
              className="hover:border-blue-500 hover:text-blue-500"
            >
              <Scale size={16} /> PRICE MASTER
            </button>
            <button onClick={toggleTheme} style={{ padding: '10px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#777', cursor: 'pointer', textTransform: 'uppercase' }}>{isGreen ? 'BLUE' : 'GREEN'}</button>


            <button onClick={() => { resetForm(); setShowForm(true); fetchItemGroups(); }} style={{ padding: '10px 24px', background: themeColor, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><Plus size={18} /> ADD ITEM</button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column', display: 'flex', flex: '1 0 auto', minHeight: 0, overflowY: 'visible' }}>
          {/* Filters Bar */}
          <div style={{ padding: '0 40px 24px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Search Items</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input type="text" placeholder="Search by name or code..." value={filterName || filterId} onChange={(e) => { const val = e.target.value; setFilterId(val); setFilterName(val); setCurrentPage(1); }} style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ width: '220px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Item Group</label>
              <input type="text" placeholder="Filter group..." value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }} />
            </div>
            <div style={{ width: '160px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Status</label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}><option value="">All</option><option value="Enabled">Enabled</option><option value="Disabled">Disabled</option></select>
            </div>
            <div style={{ width: '160px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: '#777', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Variants</label>
              <select value={filterHasVariants} onChange={e => { setFilterHasVariants(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}><option value="">All</option><option value="Yes">Yes</option><option value="No">No</option></select>
            </div>
            <button onClick={clearFilters} style={{ padding: '12px 24px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#777', cursor: 'pointer' }}>Reset Filters</button>
          </div>

          {/* Grid Section */}
          <div style={{ padding: '0 40px 40px' }}>
            {loading ? (
              <div style={{ padding: '8rem 0', textAlign: 'center' }}><Loader2 size={40} className="so-spinner" style={{ color: '#0ea5e9' }} /></div>
            ) : paginatedItems.length === 0 ? (
              <div style={{ padding: '8rem 0', textAlign: 'center', background: 'white', borderRadius: '1rem', border: '2px dashed #e2e8f0' }}>
                <Package size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1, color: '#0ea5e9' }} /><h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>No items found</h3>
              </div>
            ) : (
              viewType === 'card' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                  {paginatedItems.map(item => <ItemCard key={item.item_code} item={item} themeColor={themeColor} onClick={handleRowClick} />)}
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Item</th>
                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Group</th>
                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map(item => (
                        <tr key={item.item_code} onClick={() => handleRowClick(item)} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} style={{ opacity: 0.1 }} />}</div>
                              <div><p style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{item.item_name}</p><p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{item.item_code}</p></div>
                            </div>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>{item.item_group}</td>
                          <td style={{ padding: '1.25rem 1.5rem' }}><StatusBadge disabled={item.disabled} themeColor={themeColor} /></td>
                          <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', fontWeight: 900, color: themeColor, fontSize: '1rem' }}>AED {Number(item.standard_rate || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Sticky Pagination Section */}
          {!loading && total > 0 && (
            <div style={{ position: 'sticky', bottom: 0, padding: '16px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', boxShadow: '0 -4px 12px rgba(0,0,0,0.03)', zIndex: 20 }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Showing <b style={{ color: '#1e293b' }}>{(currentPage - 1) * pageSize + 1}</b> to <b style={{ color: '#1e293b' }}>{Math.min(currentPage * pageSize, total)}</b> of <b style={{ color: '#1e293b' }}>{total}</b> records</span>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px' }}>
                  {[20, 50, 100].map(size => <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, background: pageSize === size ? 'white' : 'transparent', color: pageSize === size ? '#0ea5e9' : '#94a3b8', boxShadow: pageSize === size ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', border: 'none', cursor: 'pointer' }}>{size}</button>)}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: currentPage === 1 ? '#cbd5e1' : '#64748b', cursor: currentPage === 1 ? 'default' : 'pointer' }}><ChevronLeft size={18} /></button>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', padding: '0 10px' }}>Page <span style={{ color: '#0ea5e9' }}>{currentPage}</span> of {Math.ceil(total / pageSize)}</div>
                  <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={currentPage >= Math.ceil(total / pageSize)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: currentPage >= Math.ceil(total / pageSize) ? '#cbd5e1' : '#64748b', cursor: currentPage >= Math.ceil(total / pageSize) ? 'default' : 'pointer' }}><ChevronRight size={18} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="so-full-screen-view" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#f8fafc', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'soModalIn 0.3s ease-out' }}>
          <div className="so-modal-header" style={{ padding: '1rem 2rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', minWidth: 0, flexShrink: 1 }}>
              <button onClick={handleCloseForm} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem', flexShrink: 0 }}><ChevronLeft size={22} /></button>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <h2 className="so-modal-title" style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isViewMode ? form.item_name : (isEditMode ? 'Edit Item Master' : 'New Item Master')}</h2>
                {isViewMode && <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editingItemCode}</p>}
              </div>
            </div>

            {/* Integrated Tabs in Header */}
            {isViewMode && (
                <div style={{ display: 'flex', gap: '10px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                    {['General', 'Prices', 'Stock', 'Dashboard'].map(t => (
                        <button
                            key={t}
                            onClick={() => {
                                setActiveTab(t);
                                if (t !== 'Prices') setIsPriceDetailView(false);
                            }}
                            style={{
                                padding: '8px 24px',
                                background: activeTab === t ? 'white' : 'transparent',
                                borderRadius: '8px',
                                border: 'none',
                                color: activeTab === t ? '#0ea5e9' : '#64748b',
                                fontWeight: 800,
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                                boxShadow: activeTab === t ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {isViewMode && (
                <button 
                  onClick={() => { setIsViewMode(false); setIsEditMode(true); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    fontWeight: 900,
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                  className="hover:bg-slate-100"
                >
                  <Edit2 size={13} /> Edit Master
                </button>
              )}
            </div>
          </div>
          <div className="so-modal-body" style={{ flex: 1, padding: '1.25rem 2rem', background: '#f8fafc', overflowY: 'auto' }}>
            {isViewMode ? (
              <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
                <div style={{ width: '100%', padding: '0 0.5rem' }}>
                  {activeTab === 'General' && (
                    <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Metric Summary Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                        {[
                          { label: 'Average Buying', val: `${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.average_buying_price || 0).toFixed(2)}`, border: themeColor, text: '#1e293b' },
                          { label: 'Last Buying Price', val: `${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.last_buying_price || 0).toFixed(2)}`, border: '#f59e0b', text: '#f59e0b' },
                          { label: 'Total Inventory', val: `${priceData.metrics?.total_stock || 0} ${form.default_uom}`, border: '#3b82f6', text: '#1e293b' },
                          { label: 'Inventory Value', val: `${priceData.metrics?.currency || 'AED'} ${Number(priceData.metrics?.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, border: '#10b981', text: '#10b981' }
                        ].map((m, i) => (
                          <div key={i} className="so-card" style={{ padding: '1rem 1.5rem', borderRadius: '1.25rem', borderLeft: `6px solid ${m.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                            <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{m.label}</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: m.text }}>{m.val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Master Item Dashboard Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
                        {/* 1. PRICING DETAILS */}
                        <div className="so-card" style={{ borderRadius: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                          <div className="so-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                            <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}><Tag size={15} style={{ color: '#0ea5e9' }} /> Pricing Details</p>
                          </div>
                          <div className="so-card-body" style={{ padding: '1rem', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                              {dashboardData?.item_prices && dashboardData.item_prices.length > 0 ? dashboardData.item_prices.slice(0, 4).map((priceObj, idx) => (
                                <div key={idx} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '1rem', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                  <label style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {priceObj.price_list} ({priceObj.uom || 'Nos'})
                                  </label>
                                  <p style={{ fontWeight: 950, fontSize: '1.1rem', color: '#0ea5e9' }}>
                                    <span style={{ fontSize: '0.6rem', color: '#64748b', marginRight: '4px' }}>AED</span>
                                    {Number(priceObj.price_list_rate || 0).toFixed(2)}
                                  </p>
                                </div>
                              )) : <p style={{ color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center' }}>No price records</p>}
                            </div>
                          </div>
                        </div>

                        {/* 2. CATALOG INFO */}
                        <div className="so-card" style={{ borderRadius: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
                          <div className="so-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                            <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}><Info size={15} style={{ color: '#0ea5e9' }} /> Catalog Info</p>
                          </div>
                          <div className="so-card-body" style={{ padding: '1.25rem', flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                            <div><label style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Group</label><p style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{form.item_group}</p></div>
                            <div><label style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Brand</label><p style={{ fontWeight: 800, color: themeColor, fontSize: '0.9rem' }}>{form.brand || 'No Brand'}</p></div>
                            <div><label style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Base UOM</label><p style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{form.default_uom}</p></div>
                            <div><label style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Valuation</label><p style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{Number(form.valuation_rate || 0).toFixed(2)}</p></div>
                          </div>
                        </div>

                        {/* 3. UNITS OF MEASURE (Taller Table) */}
                        <div className="so-card" style={{ borderRadius: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                          <div className="so-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}><Scale size={15} style={{ color: themeColor }} /> Units System</p>
                          </div>
                          <div className="so-card-body" style={{ padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#94a3b8', fontWeight: 900 }}>UOM</th>
                                  <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#94a3b8', fontWeight: 900 }}>FACT.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(form.uoms && form.uoms.length > 0) ? form.uoms.map((u, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 900, color: '#1e293b' }}>{u.uom}</td>
                                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: 900, color: themeColor }}>{u.conversion_factor}</td>
                                  </tr>
                                )) : (
                                  <tr><td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Single Unit</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* 4. IDENTIFICATION SIDEBAR (Tall Card) */}
                        <div className="so-card" style={{ gridRow: 'span 2', borderRadius: '1.5rem', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'white' }}>
                          <div style={{ padding: '1.5rem', display: 'flex', flex: 1, flexDirection: 'column', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '1.5rem', overflow: 'hidden', padding: '1rem' }}>
                              {form.imagePreview ? <img src={form.imagePreview} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Package size={64} style={{ opacity: 0.1 }} />}
                            </div>
                            
                            <div style={{ textAlign: 'center' }}>
                              <h3 style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Consensus Identity</h3>
                              <div style={{ marginBottom: '0.75rem' }}>
                                {dashboardData?.item_details?.custom_barcode_image ? (
                                  <img src={dashboardData.item_details.custom_barcode_image} style={{ height: '40px', margin: '0 auto' }} />
                                ) : (
                                  <div style={{ opacity: 0.1 }}><Barcode size={40} /></div>
                                )}
                              </div>
                              <p style={{ fontSize: '0.9rem', fontWeight: 950, color: '#64748b', letterSpacing: '3px', fontFamily: 'monospace' }}>
                                {dashboardData?.item_details?.barcodes?.[0]?.barcode || dashboardData?.item_details?.item_code || 'UNLINKED'}
                              </p>
                            </div>

                            <div style={{ width: '100%' }}>
                              <div style={{ 
                                padding: '0.85rem', 
                                borderRadius: '1.25rem', 
                                background: form.disabled ? '#fee2e2' : '#f0fdf4',
                                color: form.disabled ? '#ef4444' : '#15803d',
                                border: `1px solid ${form.disabled ? '#fecaca' : '#bbf7d0'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase'
                              }}>
                                <ShieldCheck size={18} />
                                {form.disabled ? 'DISABLED' : 'CERTIFIED ACTIVE'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 5. TECHNICAL DESCRIPTION (Large Span) */}
                        <div className="so-card" style={{ gridColumn: 'span 3', borderRadius: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                          <div className="so-card-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                            <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}><FileText size={15} style={{ color: '#64748b' }} /> Technical Description & Specifications</p>
                          </div>
                          <div className="so-card-body" style={{ padding: '1.25rem' }}>
                            <p style={{ color: '#64748b', lineHeight: '1.5', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{dashboardData?.item_details?.description || 'No extended documentation available for this item record.'}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                              {['Active Stock Tracking', 'Multi-UOM Conversion', 'Loyalty Program Eligible', 'Verified Master Integrity'].map(feat => (
                                <div key={feat} style={{ background: '#f1f5f9', padding: '0.35rem 0.65rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid #e2e8f0' }}>
                                  <ShieldCheck size={12} style={{ color: '#10b981' }} /><span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569' }}>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>


                      </div>
                    </div>
                  )}

                  {activeTab === 'Prices' && (
                    <div style={{ animation: 'fadeIn 0.4s ease', padding: '1rem' }}>
                      {!isPriceDetailView ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <div>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#1e293b' }}>Item Price Registry</h3>
                              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{priceData.prices?.length || 0} active pricing definitions for {editingItemCode}</p>
                            </div>
                            <button 
                              onClick={() => {
                                setPriceForm({ price_list: 'Standard Selling', uom: form.default_uom, price_list_rate: 0, buying: 0, selling: 1, name: '' });
                                setIsPriceDetailView(true);
                              }}
                              className="so-btn-primary" 
                              style={{ height: '3.5rem', padding: '0 2rem', borderRadius: '1.25rem', background: themeColor, fontSize: '0.8rem', fontWeight: 950, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: `0 10px 25px -5px ${themeColor}40` }}
                            >
                              <Plus size={20} /> INITIALIZE RECORD
                            </button>
                          </div>

                          <div className="so-card" style={{ borderRadius: '2rem', overflow: 'hidden', boxShadow: '0 15px 40px -10px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                              <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                  <th style={{ padding: '1.5rem 2.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Price List / UOM</th>
                                  <th style={{ padding: '1.5rem 2.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Scope</th>
                                  <th style={{ padding: '1.5rem 2.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Rate (AED)</th>
                                  <th style={{ padding: '1.5rem 2.5rem', width: '80px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {loadingPrices ? (
                                  <tr><td colSpan="4" style={{ padding: '8rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={40} style={{ margin: '0 auto', color: themeColor }} /></td></tr>
                                ) : (priceData?.prices || []).length === 0 ? (
                                  <tr><td colSpan="4" style={{ padding: '12rem', textAlign: 'center' }}>
                                    <div style={{ opacity: 0.1, marginBottom: '2rem' }}><Scale size={80} style={{ margin: '0 auto' }} /></div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 950, color: '#1e293b', marginBottom: '8px' }}>No pricing detected</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 800 }}>Start by initializing a price list for this item.</p>
                                  </td></tr>
                                ) : priceData?.prices?.map((p, idx) => (
                                  <tr key={p.name || idx} onClick={() => { setPriceForm({...p}); setIsPriceDetailView(true); }} style={{ transition: 'all 0.2s', cursor: 'pointer' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '1.75rem 2.5rem', borderTop: '1px solid #f8fafc' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontWeight: 950, color: '#1e293b', fontSize: '1.05rem' }}>{p.price_list}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <Box size={12} style={{ color: themeColor }} />
                                          <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b' }}>{p.uom}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '1.75rem 2.5rem', textAlign: 'center', borderTop: '1px solid #f8fafc' }}>
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                        {p.buying === 1 && <span style={{ background: '#fffbeb', color: '#92400e', padding: '6px 14px', borderRadius: '1rem', fontSize: '10px', fontWeight: 950, textTransform: 'uppercase', border: '1px solid #fef3c7' }}>Buying</span>}
                                        {p.selling === 1 && <span style={{ background: '#f0fdf4', color: '#166534', padding: '6px 14px', borderRadius: '1rem', fontSize: '10px', fontWeight: 950, textTransform: 'uppercase', border: '1px solid #dcfce7' }}>Selling</span>}
                                      </div>
                                    </td>
                                    <td style={{ padding: '1.75rem 2.5rem', textAlign: 'right', borderTop: '1px solid #f8fafc' }}>
                                       <p style={{ fontWeight: 950, color: '#1e293b', fontSize: '1.25rem' }}>{Number(p.price_list_rate || 0).toFixed(2)}</p>
                                       <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 900 }}>Per {p.uom}</p>
                                    </td>
                                    <td style={{ padding: '1.75rem 2.5rem', textAlign: 'right', borderTop: '1px solid #f8fafc' }}>
                                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#cbd5e1' }}>
                                        <ChevronRight size={18} />
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div style={{ animation: 'slideInRight 0.3s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '3rem' }}>
                             <button onClick={() => setIsPriceDetailView(false)} style={{ width: '3.5rem', height: '3.5rem', background: 'white', borderRadius: '1.25rem', border: '1px solid #e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}><ChevronLeft size={24} /></button>
                             <div>
                               <h3 style={{ fontSize: '1.5rem', fontWeight: 950, color: '#1e293b' }}>Price Configuration</h3>
                               <p style={{ fontSize: '0.85rem', color: themeColor, fontWeight: 950, letterSpacing: '1px' }}>{priceForm.name || 'NEW DRAFT DEFINITION'}</p>
                             </div>
                          </div>

                          <div className="so-card" style={{ borderRadius: '2.5rem', padding: '4rem', boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.08)', border: '1px solid #f1f5f9' }}>
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                                <div className="so-field">
                                  <label className="so-label" style={{ marginBottom: '1rem', display: 'block' }}>Active Price List</label>
                                  <div style={{ position: 'relative' }}>
                                    <select 
                                      className="so-input" 
                                      style={{ height: '4.5rem', borderRadius: '1.50rem', padding: '0 1.5rem', fontSize: '1rem', fontWeight: 900 }}
                                      value={priceForm.price_list} 
                                      onChange={e => setPriceForm({ 
                                        ...priceForm, 
                                        price_list: e.target.value, 
                                        buying: e.target.value.toLowerCase().includes('buying') ? 1 : priceForm.buying, 
                                        selling: e.target.value.toLowerCase().includes('selling') ? 1 : priceForm.selling 
                                      })}
                                    >
                                      <option value="Standard Selling">Standard Selling (AED)</option>
                                      <option value="Standard Buying">Standard Buying (AED)</option>
                                      <option value="Cash Selling">Cash Selling (AED)</option>
                                      <option value="Retail Buying">Retail Buying (AED)</option>
                                      <option value="CREATE_NEW">+ Create new Price List...</option>
                                    </select>
                                    <ChevronDown size={20} style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                  </div>
                                </div>
                                <div className="so-field">
                                  <label className="so-label" style={{ marginBottom: '1rem', display: 'block' }}>Target Unit (UOM)</label>
                                  <div style={{ position: 'relative' }}>
                                    <select 
                                      className="so-input" 
                                      style={{ height: '4.5rem', borderRadius: '1.50rem', padding: '0 1.5rem', fontSize: '1rem', fontWeight: 900 }}
                                      value={priceForm.uom} 
                                      onChange={e => setPriceForm({ ...priceForm, uom: e.target.value })}
                                    >
                                      {[form.default_uom, ...(form.uoms || []).map(u => u.uom)].filter((v, i, a) => v && a.indexOf(v) === i).map(u => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                    <ChevronDown size={20} style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                                  </div>
                                </div>
                                
                                <div className="so-field" style={{ gridColumn: 'span 2' }}>
                                  <label className="so-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}><Tag size={16} /> Base Rate Value</label>
                                  <div style={{ position: 'relative' }}>
                                    <input 
                                      type="number" 
                                      className="so-input" 
                                      style={{ height: '6.5rem', fontSize: '3rem', fontWeight: 950, color: themeColor, textAlign: 'center', borderRadius: '2rem' }}
                                      value={priceForm.price_list_rate} 
                                      onChange={e => setPriceForm({ ...priceForm, price_list_rate: Number(e.target.value) })} 
                                    />
                                    <span style={{ position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', fontWeight: 950, color: '#cbd5e1' }}>AED</span>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', gridColumn: 'span 2' }}>
                                  <button 
                                    onClick={() => setPriceForm({ ...priceForm, buying: priceForm.buying ? 0 : 1 })}
                                    style={{ 
                                      padding: '2rem', 
                                      border: priceForm.buying ? `3px solid #fbbf24` : '2px solid #f1f5f9', 
                                      borderRadius: '2rem', 
                                      background: priceForm.buying ? '#fffbeb' : 'white',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      transition: 'all 0.2s', cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{ textAlign: 'left' }}>
                                      <p style={{ fontSize: '0.7rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Buying Enabled</p>
                                      <p style={{ fontWeight: 950, color: priceForm.buying ? '#92400e' : '#cbd5e1', fontSize: '1.1rem' }}>{priceForm.buying ? 'ACTIVE' : 'INACTIVE'}</p>
                                    </div>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', border: '2px solid #e2e8f0', background: priceForm.buying ? '#fbbf24' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {priceForm.buying === 1 && <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'white' }}></div>}
                                    </div>
                                  </button>
                                  <button 
                                    onClick={() => setPriceForm({ ...priceForm, selling: priceForm.selling ? 0 : 1 })}
                                    style={{ 
                                      padding: '2rem', 
                                      border: priceForm.selling ? `3px solid #10b981` : '2px solid #f1f5f9', 
                                      borderRadius: '2rem', 
                                      background: priceForm.selling ? '#f0fdf4' : 'white',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      transition: 'all 0.2s', cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{ textAlign: 'left' }}>
                                      <p style={{ fontSize: '0.7rem', fontWeight: 950, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Selling Enabled</p>
                                      <p style={{ fontWeight: 950, color: priceForm.selling ? '#065f46' : '#cbd5e1', fontSize: '1.1rem' }}>{priceForm.selling ? 'ACTIVE' : 'INACTIVE'}</p>
                                    </div>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', border: '2px solid #e2e8f0', background: priceForm.selling ? '#10b981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {priceForm.selling === 1 && <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'white' }}></div>}
                                    </div>
                                  </button>
                                </div>
                             </div>

                             <div style={{ marginTop: '5rem', display: 'flex', gap: '2rem', justifyContent: 'flex-end' }}>
                               <button 
                                 onClick={() => setIsPriceDetailView(false)} 
                                 className="so-btn-secondary" 
                                 style={{ padding: '0 4rem', height: '4.5rem', borderRadius: '1.5rem', fontWeight: 950, fontSize: '1rem' }}
                               >
                                 Discard
                               </button>
                               <button 
                                 className="so-btn-primary" 
                                 style={{ padding: '0 5rem', height: '4.5rem', background: themeColor, borderRadius: '1.5rem', fontWeight: 950, fontSize: '1.1rem', boxShadow: `0 15px 30px -5px ${themeColor}40` }}
                                 onClick={async () => {
                                   await handleSavePrice();
                                   setIsPriceDetailView(false);
                                 }}
                                 disabled={saving}
                               >
                                 {saving ? 'Synchronizing...' : (priceForm.name ? 'Update Master Record' : 'Publish Detail')}
                               </button>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Dashboard' && (
                    <div style={{ animation: 'fadeIn 0.4s ease' }}>
                      {loadingDashboard ? (
                        <div style={{ padding: '10rem', textAlign: 'center' }}><Loader2 size={48} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} /></div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                          {/* Summary Statistics */}
                          {dashboardData?.analytics && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                               <div className="so-card" style={{ padding: '1.5rem', borderRadius: '1.5rem', borderLeft: `6px solid ${themeColor}` }}>
                                  <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Sales Volume</p>
                                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: '6px' }}>AED</span>
                                    {Number(dashboardData.analytics.gross_sales?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>Qty: {dashboardData.analytics.gross_sales?.total_qty || 0}</p>
                               </div>
                               <div className="so-card" style={{ padding: '1.5rem', borderRadius: '1.5rem', borderLeft: '6px solid #f59e0b' }}>
                                  <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Purchase Volume</p>
                                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: '6px' }}>AED</span>
                                    {Number(dashboardData.analytics.gross_purchasing?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>Qty: {dashboardData.analytics.gross_purchasing?.total_qty || 0}</p>
                               </div>
                               <div className="so-card" style={{ padding: '1.5rem', borderRadius: '1.5rem', borderLeft: '6px solid #8b5cf6' }}>
                                  <p style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Global Stock Status</p>
                                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#8b5cf6' }}>
                                    {dashboardData.stock_status?.total_qty || 0}
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '6px' }}>{form.default_uom}</span>
                                  </p>
                                  <p style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>Across {dashboardData.stock_status?.warehouse_details?.length || 0} Warehouses</p>
                               </div>
                            </div>
                          )}

                          {dashboardData?.connections && Object.values(dashboardData.connections).some(category => 
                            Object.values(category).some(docs => Array.isArray(docs) && docs.length > 0)
                          ) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                              {Object.entries(dashboardData.connections).map(([category, links]) => {
                                const rows = [];
                                if (typeof links === 'object' && links !== null) {
                                  Object.entries(links).forEach(([k, v]) => {
                                    if (Array.isArray(v)) rows.push({ label: k, data: v });
                                    else if (typeof v === 'object' && v !== null) {
                                      Object.entries(v).forEach(([k2, v2]) => {
                                        if (Array.isArray(v2)) rows.push({ label: k2, data: v2 });
                                      });
                                    }
                                  });
                                }
                                if (rows.length === 0) return null;
                                return (
                                  <div key={category} className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                    <div className="so-card-header" style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderBottom: `4px solid ${themeColor}20` }}>
                                      <p className="so-card-title" style={{ fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', fontSize: '0.85rem' }}>{category}</p>
                                    </div>
                                    <div className="so-card-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                      {rows.map((row, idx) => {
                                        const isExpanded = expandedLinks[row.label];
                                        return (
                                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div onClick={() => toggleLinkExpansion(row.label)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', background: '#ffffff', borderRadius: '1.5rem', border: isExpanded ? `1.5px solid ${themeColor}` : '1px solid #f1f5f9', cursor: 'pointer' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 800, color: '#475569', fontSize: '0.85rem' }}>{row.label}</span>
                                                {row.data[0]?.status && <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Sync Active</span>}
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <span style={{ fontWeight: 900, color: themeColor, background: `${themeColor}10`, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '1rem' }}>
                                                  {row.data.length}
                                                </span>
                                                <ChevronDown size={14} style={{ color: '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                              </div>
                                            </div>
                                            {isExpanded && (
                                              <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #e2e8f0', marginLeft: '1rem' }}>
                                                {row.data.map((doc, dIdx) => (
                                                  <div key={dIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: dIdx < row.data.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: themeColor }}>{doc.name || doc.item_code}</span>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{doc.status || 'Active'}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ padding: '6rem', textAlign: 'center', background: 'white', borderRadius: '2rem', border: '2px dashed #e2e8f0' }}>
                              <Activity size={40} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
                              <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8' }}>NO LIVE CONNECTIONS FOUND</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Stock' && (
                    <div className="so-card" style={{ borderRadius: '2rem', overflow: 'hidden', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                      <div className="so-card-header" style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className="so-card-title" style={{ fontSize: '1rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={20} style={{ color: themeColor }} /> Detailed Warehouse Inventory
                        </p>
                        <div style={{ padding: '4px 12px', background: `${themeColor}15`, color: themeColor, borderRadius: '100px', fontSize: '10px', fontWeight: 900 }}>REAL-TIME SYNC</div>
                      </div>
                      <div className="so-card-body" style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '1.25rem 2.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Warehouse Location</th>
                              <th style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>On Hand Stock</th>
                              <th style={{ padding: '1.25rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Avg Buying Price</th>
                              <th style={{ padding: '1.25rem 2.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Inventory Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingPrices ? (
                               <tr><td colSpan="4" style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: '0 auto', color: themeColor }} /></td></tr>
                            ) : priceData.warehouse_breakdown?.length > 0 ? (
                              priceData.warehouse_breakdown.map((w, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }} className="hover:bg-slate-50">
                                  <td style={{ padding: '1.5rem 2.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <MapPin size={16} style={{ color: '#94a3b8' }} />
                                      </div>
                                      <span style={{ fontWeight: 800, color: '#1e293b' }}>{w.warehouse}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                                    <span style={{ fontWeight: 900, color: themeColor, fontSize: '1.1rem' }}>{w.stock}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '4px', fontWeight: 700 }}>{form.default_uom}</span>
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginRight: '4px' }}>AED</span>
                                    <span style={{ fontWeight: 800, color: '#475569' }}>{Number(w.avg_buying_price || 0).toFixed(2)}</span>
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '1.5rem 2.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '4px', fontWeight: 700 }}>AED</span>
                                    <span style={{ fontWeight: 900, color: '#10b981', fontSize: '1.1rem' }}>{Number(w.stock_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                               <tr><td colSpan="4" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontWeight: 800 }}>No stock locations identified for this item.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <div className="so-card" style={{ borderRadius: '2rem', marginBottom: '2rem' }}>
                  <div className="so-card-header"><p className="so-card-title">Specifications</p></div>
                  <div className="so-card-body" style={{ padding: '2.5rem' }}>
                    <div className="so-form-grid">
                      <div className="so-field"><label className="so-label">Item Code</label><input type="text" value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} className="so-input" disabled={isEditMode} /></div>
                      <div className="so-field"><label className="so-label">Item Name</label><input type="text" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} className="so-input" /></div>
                      <div className="so-field">
                        <label className="so-label">Item Group</label>
                        <div style={{ position: 'relative' }}>
                          <select 
                             value={form.item_group} 
                             onChange={e => setForm({ ...form, item_group: e.target.value })} 
                             className="so-input"
                          >
                             {itemGroups.length === 0 && <option value="">Loading groups...</option>}
                             {itemGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                          </select>
                          <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }} />
                        </div>
                      </div>
                      <div className="so-field"><label className="so-label">Base UOM</label><input type="text" value={form.default_uom} onChange={e => setForm({ ...form, default_uom: e.target.value })} className="so-input" /></div>
                      <div className="so-field" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                        <input type="checkbox" checked={form.disabled} onChange={e => setForm({ ...form, disabled: e.target.checked })} style={{ width: '18px', height: '18px' }} id="chk-disabled" />
                        <label htmlFor="chk-disabled" style={{ fontSize: '13px', fontWeight: 600, color: '#444' }}>Disabled (Hide in POS)</label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="so-card" style={{ borderRadius: '2rem' }}>
                  <div className="so-card-header"><p className="so-card-title">Branding</p></div>
                  <div className="so-card-body" style={{ padding: '2.5rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                      <div style={{ width: '120px', height: '120px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden' }}>
                        {form.imagePreview ? <img src={form.imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={48} style={{ opacity: 0.1 }} />}
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="so-btn-secondary">Upload Photo</button>
                      <input ref={fileInputRef} type="file" hidden onChange={handleImageChange} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!isViewMode && (
            <div className="so-modal-footer" style={{ padding: '1.5rem 4rem', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1.5rem' }}>
              <button onClick={handleCloseForm} className="so-btn-secondary">Discard</button>
              <button onClick={handleSave} className="so-btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (isEditMode ? 'Update Item' : 'Create Item')}
              </button>
            </div>
          )}
        </div>
      )}

      {showCameraScanner && <CameraScanner onScan={(c) => { addBarcode(c); setShowCameraScanner(false); }} onClose={() => setShowCameraScanner(false)} />}

      {/* Item Price Modal */}
      {showPriceForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
          <div style={{ background: 'white', width: '450px', borderRadius: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e293b' }}>{priceForm.name ? 'Refine Item Price' : 'Initialize New Price'}</h3>
              <button onClick={() => setShowPriceForm(false)} style={{ color: '#94a3b8' }}><X size={24} /></button>
            </div>
            <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="so-field">
                  <label className="so-label">Price List</label>
                  <select 
                    value={priceForm.price_list} 
                    onChange={e => setPriceForm({ ...priceForm, price_list: e.target.value, buying: e.target.value.toLowerCase().includes('buying') ? 1 : 0, selling: e.target.value.toLowerCase().includes('selling') ? 1 : 0 })} 
                    className="so-input"
                  >
                    <option value="Standard Selling">Standard Selling</option>
                    <option value="Standard Buying">Standard Buying</option>
                  </select>
                </div>
                <div className="so-field">
                  <label className="so-label">Unit (UOM)</label>
                  <input type="text" value={priceForm.uom} onChange={e => setPriceForm({ ...priceForm, uom: e.target.value })} className="so-input" placeholder="e.g. Nos" />
                </div>
              </div>
              <div className="so-field">
                <label className="so-label">Base Rate (AED)</label>
                <input 
                  type="number" 
                  value={priceForm.price_list_rate} 
                  onChange={e => setPriceForm({ ...priceForm, price_list_rate: e.target.value })} 
                  className="so-input" 
                  style={{ fontSize: '1.5rem', fontWeight: 900, color: themeColor, height: '4rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                   onClick={() => setPriceForm({ ...priceForm, buying: priceForm.buying === 1 ? 0 : 1 })}
                   style={{ flex: 1, padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9', background: priceForm.buying === 1 ? '#fef3c7' : 'white', color: priceForm.buying === 1 ? '#d97706' : '#94a3b8', fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.2s' }}
                >
                  BUYING PRICE
                </button>
                <button 
                  onClick={() => setPriceForm({ ...priceForm, selling: priceForm.selling === 1 ? 0 : 1 })}
                  style={{ flex: 1, padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9', background: priceForm.selling === 1 ? '#dcfce7' : 'white', color: priceForm.selling === 1 ? '#15803d' : '#94a3b8', fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.2s' }}
                >
                  SELLING PRICE
                </button>
              </div>
            </div>
            <div style={{ padding: '2rem', background: '#f8fafc', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPriceForm(false)} className="so-btn-secondary" style={{ padding: '0 2rem', height: '3.5rem' }}>Cancel</button>
              <button onClick={handleSavePrice} className="so-btn-primary" style={{ padding: '0 2rem', height: '3.5rem', background: themeColor, fontWeight: 900 }} disabled={saving}>
                {saving ? 'Syncing...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}