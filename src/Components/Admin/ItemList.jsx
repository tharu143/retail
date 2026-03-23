// src/pages/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle, Trash2, ChevronDown, Palette, Loader2, ChevronRight,
  Edit2, ShoppingCart, Barcode, Tag, Box, Info, ShieldCheck, Scale
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
import NavBar from '../Nav/NavBar';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const formatPrice = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Theme toggle
  const [itTheme, setItTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = itTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', itTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [itTheme, themeColor, themeColorHover, themeLight]);

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
    maintain_stock: true, has_variants: false,
    opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
    default_uom: 'Nos', description: '', image: null, imagePreview: null
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
      const res = await axios.get('/api/resource/Item?limit_page_length=2000&fields=["item_code","item_name","item_group","stock_uom","image","description","disabled","has_variants","standard_rate"]&order_by=modified desc', { withCredentials: true });
      const data = res.data?.data || [];
      setItems(data);
    } catch (err) {
      console.error('Fetch Items Error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardDetails = async (code) => {
    try {
      setLoadingDashboard(true);
      const res = await axios.get(`/api/method/kyle_retail.retail_api.api.get_item_dashboard_details?item_code=${code}`, { withCredentials: true });
      const connRes = await axios.get(`/api/method/kyle_retail.retail_api.api.get_linked_documents?doctype=Item&name=${code}`, { withCredentials: true });
      setDashboardData({
        ...(res.data?.message || {}),
        connections: connRes.data?.message || null
      });
    } catch (err) {
      console.error('Dashboard Error:', err);
      setDashboardData({});
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchStockDetails = async (code) => {
    try {
      setLoadingWarehouse(true);
      const res = await axios.get(`/api/method/kyle_retail.retail_api.api.get_retail_item_details?search_term=${code}`, { withCredentials: true });
      const itemData = Array.isArray(res.data?.message) ? res.data.message[0] : res.data?.message;
      setWarehouseDetails(itemData?.warehouse_details || []);
    } catch (err) {
      console.error('Stock Details Error:', err);
      setWarehouseDetails([]);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  useEffect(() => {
    if (showForm) {
      const t = setTimeout(() => fetchItemGroups(groupSearch), 300);
      return () => clearTimeout(t);
    }
  }, [groupSearch, showForm]);

  const fetchItemGroups = async (search = '') => {
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', {
        params: { search },
        withCredentials: true
      });
      if (res.data.message.success) setItemGroups(res.data.message.data);
    } catch (err) { console.error(err); }
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
    fetchStockDetails(item.item_code); fetchDashboardDetails(item.item_code);
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
    const hasChanges = form.item_code || form.item_name || form.item_group || barcodes.length > 0 || form.image;
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false); setBarcodes([]);
    setForm(prev => ({ ...prev, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
  };

  const clearFilters = () => {
    setFilterId(''); setFilterName(''); setFilterGroup(''); setFilterStatus(''); setFilterHasVariants(''); setCurrentPage(1);
  };

  return (
    <>
      <NavBar />
      <div className="so-page">
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title"><Package size={20} /> Items</h1>
            <p className="so-page-subtitle">{total} record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setItTheme(isGreen ? 'blue' : 'green')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#f8fafc', border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: themeColor, cursor: 'pointer' }}>
              <Palette size={13} /> {itTheme.toUpperCase()}
            </button>
            <button onClick={() => { setShowForm(true); fetchItemGroups(); }} className="so-btn-primary"><Plus size={16} /> Add Item</button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          <div className="so-filter-bar" style={{ background: 'white', padding: '1.25rem 2rem', borderBottom: '1px solid var(--so-border)', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label className="so-filter-label">Search / Code</label>
              <input type="text" placeholder="Search code or name..." value={filterName || filterId} onChange={(e) => { const val = e.target.value; setFilterId(val); setFilterName(val); setCurrentPage(1); }} className="so-filter-input" />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Item Group</label>
              <input type="text" placeholder="Filter by group..." value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }} className="so-filter-input" />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Status</label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="so-filter-input" style={{ padding: '0.45rem' }}>
                <option value="">All Statuses</option>
                <option value="Enabled">Enabled</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Has Variants</label>
              <select value={filterHasVariants} onChange={e => { setFilterHasVariants(e.target.value); setCurrentPage(1); }} className="so-filter-input" style={{ padding: '0.45rem' }}>
                <option value="">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <button onClick={clearFilters} className="so-clear-btn" style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}>Clear</button>
          </div>

          <div className="so-content" style={{ padding: '2rem' }}>
            {loading ? (
              <div style={{ padding: '8rem 0', textAlign: 'center' }}>
                <Loader2 size={40} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} />
                <p style={{ marginTop: '1.5rem', color: '#64748b', fontWeight: 600 }}>Bringing your items to life...</p>
              </div>
            ) : paginatedItems.length === 0 ? (
              <div style={{ padding: '8rem 0', textAlign: 'center', background: 'white', borderRadius: '1.5rem', border: '2px dashed #e2e8f0' }}>
                <Package size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1, color: themeColor }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{total === 0 ? 'No items found' : 'No match found'}</h3>
                {total === 0 && <button onClick={() => { setShowForm(true); fetchItemGroups(); }} className="so-btn-primary" style={{ marginTop: '2rem' }}><Plus size={16} /> Create First Item</button>}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                {paginatedItems.map(item => (
                  <div key={item.item_code} onClick={() => handleRowClick(item)} className="so-item-card" style={{ background: 'white', borderRadius: '1.5rem', overflow: 'hidden', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                    <div style={{ height: '200px', background: '#f8fafc', position: 'relative' }}>
                      {item.image ? <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={64} style={{ opacity: 0.05 }} /></div>}
                      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}><StatusBadge disabled={item.disabled} themeColor={themeColor} /></div>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 800, color: themeColor, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{item.item_group}</p>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>{item.item_name}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{item.stock_uom}</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColor }}>AED {formatPrice(item.standard_rate || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!loading && total > 0 && (
            <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}</span>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[20, 50, 100].map(size => <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`}>{size}</button>)}
                </div>
                <div className="so-pagination-btns" style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                  <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>{currentPage} / {Math.ceil(total / pageSize)}</span>
                  <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={currentPage >= Math.ceil(total / pageSize)}><ChevronRight size={14} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="so-full-screen-view" style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'soModalIn 0.3s ease-out' }}>
          <div className="so-modal-header" style={{ padding: '1rem 2rem', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <button onClick={handleCloseForm} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }}><ChevronLeft size={22} /></button>
              <div>
                <h2 className="so-modal-title" style={{ fontSize: '1.25rem', fontWeight: 900 }}>{isViewMode ? form.item_name : (isEditMode ? 'Edit Item Master' : 'New Item Master')}</h2>
                {isViewMode && <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{editingItemCode}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleCloseForm} className="so-modal-close" style={{ background: '#fee2e2', color: '#ef4444' }}><X size={22} /></button>
            </div>
          </div>
          <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '3rem', background: '#f8fafc' }}>
            {isViewMode ? (
              <div style={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginBottom: '4rem', borderBottom: '1px solid #e2e8f0', background: 'white', position: 'sticky', top: '-3rem', zIndex: 10, padding: '1rem 0' }}>
                  {['Dashboard', 'General', 'Stock'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '1rem 3rem', background: 'transparent', border: 'none', borderBottom: activeTab === t ? `4px solid ${themeColor}` : '4px solid transparent', color: activeTab === t ? themeColor : '#64748b', fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>{t}</button>
                  ))}
                </div>

                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 4rem' }}>
                  {activeTab === 'General' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 450px', gap: '4rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2.5rem' }}>
                          <div className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                            <div className="so-card-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9' }}>
                              <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem' }}><Tag size={20} style={{ color: themeColor }} /> Pricing Details</p>
                            </div>
                            <div className="so-card-body" style={{ padding: '2rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                {dashboardData?.item_details?.prices ? Object.entries(dashboardData.item_details.prices).map(([uom, price]) => (
                                  <div key={uom} style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>{uom.toUpperCase()}</label>
                                    <p style={{ fontWeight: 900, fontSize: '1.5rem', color: themeColor }}>{formatPrice(price)}</p>
                                  </div>
                                )) : <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', gridColumn: 'span 2' }}>No price records found.</p>}
                              </div>
                            </div>
                          </div>
                          <div className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                            <div className="so-card-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9' }}>
                              <p className="so-card-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '1rem' }}><Info size={20} style={{ color: themeColor }} /> Catalog Info</p>
                            </div>
                            <div className="so-card-body" style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'block' }}>GROUP</label><p style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>{form.item_group}</p></div>
                              <div><label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'block' }}>BASE UOM</label><p style={{ fontWeight: 900, color: '#1e293b', fontSize: '1.25rem' }}>{form.default_uom}</p></div>
                            </div>
                          </div>
                        </div>
                        <div className="so-card" style={{ borderRadius: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)' }}>
                          <div className="so-card-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid #f1f5f9' }}><p className="so-card-title">Technical Description</p></div>
                          <div className="so-card-body" style={{ padding: '3rem' }}>
                            <p style={{ color: '#475569', lineHeight: '2', fontSize: '1.1rem' }}>{dashboardData?.item_details?.description || 'Extended description not available.'}</p>
                            <div style={{ marginTop: '3rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                              {['Active Stock Tracking', 'Multi-UOM Converison', 'Loyalty Eligible', 'ERP Listing'].map(feat => (
                                <div key={feat} style={{ background: '#f0fdf4', padding: '0.75rem 1.5rem', borderRadius: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #bbf7d0' }}>
                                  <ShieldCheck size={18} style={{ color: '#15803d' }} /><span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#166534' }}>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                        <div className="so-card" style={{ borderRadius: '3rem', overflow: 'hidden', height: '550px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.15)', border: '8px solid white' }}>
                          {form.imagePreview ? <img src={form.imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><Package size={100} style={{ opacity: 0.1 }} /></div>}
                        </div>
                        <div className="so-card" style={{ borderRadius: '2rem', background: '#0f172a', padding: '3rem', textAlign: 'center' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'block' }}>Identification</label>
                          {dashboardData?.item_details?.custom_barcode_image ? <img src={dashboardData.item_details.custom_barcode_image} style={{ width: '100%', height: '80px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} /> : <Barcode size={60} style={{ opacity: 0.1, margin: '0 auto', color: 'white' }} />}
                          <p style={{ marginTop: '1.5rem', fontWeight: 900, letterSpacing: '5px', fontSize: '1.5rem', fontFamily: 'monospace', color: 'white' }}>{dashboardData?.item_details?.barcodes?.[0]?.barcode || 'UNLINKED'}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <button onClick={() => { setIsViewMode(false); setIsEditMode(true); }} className="so-btn-primary" style={{ height: '4.5rem', borderRadius: '1.5rem', fontSize: '1.1rem', fontWeight: 900, justifyContent: 'center' }}><Edit2 size={22} /> Edit Master</button>
                          <button onClick={() => handleDelete(form.item_code)} className="so-btn-danger" style={{ height: '4.5rem', borderRadius: '1.5rem', fontSize: '1.1rem', fontWeight: 900, justifyContent: 'center', background: '#fee2e2' }}><Trash2 size={22} /> Delete</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Dashboard' && (
                    <div style={{ animation: 'fadeIn 0.4s ease' }}>
                      {loadingDashboard ? (
                        <div style={{ padding: '10rem', textAlign: 'center' }}><Loader2 size={48} className="so-spinner" style={{ margin: '0 auto', color: themeColor }} /></div>
                      ) : dashboardData?.connections ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                          {Object.entries(dashboardData.connections).map(([category, links]) => {
                            // Extract all actual document lists from this category
                            const rows = [];
                            if (typeof links === 'object' && links !== null) {
                              Object.entries(links).forEach(([k, v]) => {
                                if (Array.isArray(v)) {
                                  rows.push({ label: k, data: v });
                                } else if (typeof v === 'object' && v !== null) {
                                  // Handle double nested like { Pricing: { "Item Price": [...] } }
                                  Object.entries(v).forEach(([k2, v2]) => {
                                    if (Array.isArray(v2)) rows.push({ label: k2, data: v2 });
                                  });
                                }
                              });
                            }

                            if (rows.length === 0) return null;

                            return (
                              <div key={category} className="so-card" style={{ borderRadius: '2rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                                <div className="so-card-header" style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderBottom: `4px solid ${themeColor}20` }}>
                                  <p className="so-card-title" style={{ fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', fontSize: '0.85rem', letterSpacing: '1px' }}>{category}</p>
                                </div>
                                <div className="so-card-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  {rows.map((row, idx) => {
                                    const isExpanded = expandedLinks[row.label];
                                    return (
                                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div onClick={() => toggleLinkExpansion(row.label)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.75rem', background: '#ffffff', borderRadius: '1.5rem', border: isExpanded ? `1.5px solid ${themeColor}` : '1px solid #f1f5f9', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 800, color: '#475569', fontSize: '0.9rem' }}>{row.label}</span>
                                            {row.data[0]?.status && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Status: {row.data[0].status}</span>}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ fontWeight: 900, color: themeColor, background: `${themeColor}10`, width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '1rem', fontSize: '1.25rem' }}>
                                              {row.data.length}
                                            </span>
                                            <ChevronDown size={18} style={{ color: '#94a3b8', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                                          </div>
                                        </div>
                                        {isExpanded && (
                                          <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #e2e8f0', marginLeft: '1rem', animation: 'fadeIn 0.3s ease' }}>
                                            {row.data.map((doc, dIdx) => (
                                              <div key={dIdx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: dIdx < row.data.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: themeColor, fontFamily: 'monospace' }}>{doc.name || doc.item_code}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{doc.status || ''}</span>
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
                        <div style={{ padding: '8rem', textAlign: 'center' }}>No statistics available.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Stock' && (
                    <div className="so-card" style={{ borderRadius: '2rem', overflow: 'hidden', maxWidth: '1000px', margin: '0 auto' }}>
                      <div className="so-card-header" style={{ padding: '1.5rem 2rem', background: '#f8fafc' }}><p className="so-card-title">Warehouse Inventory</p></div>
                      <div className="so-card-body" style={{ padding: 0 }}>
                        <table className="so-table">
                          <thead><tr style={{ background: '#f1f5f9' }}><th>Warehouse</th><th>Actual Qty</th><th>UOM</th></tr></thead>
                          <tbody>
                            {warehouseDetails.map((w, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1.5rem 2.5rem', fontWeight: 700 }}>{w.warehouse}</td>
                                <td style={{ textAlign: 'center' }}><span style={{ fontWeight: 900, color: themeColor }}>{w.actual_qty}</span></td>
                                <td style={{ textAlign: 'right', paddingRight: '2rem' }}>{form.default_uom}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div className="so-card" style={{ borderRadius: '2rem', marginBottom: '2rem' }}>
                  <div className="so-card-header"><p className="so-card-title">Specifications</p></div>
                  <div className="so-card-body" style={{ padding: '2.5rem' }}>
                    <div className="so-form-grid">
                      <div className="so-field"><label className="so-label">Item Code</label><input type="text" value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} className="so-input" disabled={isEditMode} /></div>
                      <div className="so-field"><label className="so-label">Item Name</label><input type="text" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} className="so-input" /></div>
                      <div className="so-field"><label className="so-label">Item Group</label><select value={form.item_group} onChange={e => setForm({ ...form, item_group: e.target.value })} className="so-input">{itemGroups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
                      <div className="so-field"><label className="so-label">Base UOM</label><input type="text" value={form.default_uom} onChange={e => setForm({ ...form, default_uom: e.target.value })} className="so-input" /></div>
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
    </>
  );
}