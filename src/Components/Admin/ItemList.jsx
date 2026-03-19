// src/pages/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle,
  ChevronDown, Palette, Loader2, ChevronRight
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
import NavBar from '../Nav/NavBar';

function ItemList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Theme toggle (synced across pages)
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
    allow_alternative_item: false, maintain_stock: true, has_variants: false,
    opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
    is_fixed_asset: false, is_zero_rated: false, is_exempt: false,
    default_uom: 'Nos', tax_code: '', description: '', image: null, imagePreview: null
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Item Groups
  const [itemGroups, setItemGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Barcodes
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const barcodeInputRef = useRef(null);

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
      if (res.data.message.exists) {
        alert(`Barcode ${code} is already used by item: ${res.data.message.item}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }

    setBarcodes(prev => [...prev, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput('');
    setIsScanning(false);
  };

  /* ==================== CAMERA SCANNER ==================== */
  const CameraScanner = () => {
    const videoRef = useRef(null);
    const reader = useRef(new BrowserMultiFormatReader());

    useEffect(() => {
      reader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          addBarcode(result.getText());
          setShowCameraScanner(false);
        }
      });
      return () => reader.current.reset();
    }, []);

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="bg-white p-5 flex justify-between items-center shadow-lg">
          <h3 className="text-xl font-semibold">Scan Barcode with Camera</h3>
          <button onClick={() => setShowCameraScanner(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-7 h-7" />
          </button>
        </div>
        <video ref={videoRef} className="flex-1 w-full object-cover" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="border-4 border-red-500 rounded-xl w-80 h-48 opacity-80"></div>
        </div>
        <div className="absolute bottom-10 left-0 right-0 text-center">
          <p className="text-white text-xl font-medium bg-black bg-opacity-60 py-3 px-8 rounded-full inline-block">
            Align barcode inside the red frame
          </p>
        </div>
      </div>
    );
  };

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', { withCredentials: true });
      setItems(res.data.message || []);
    } catch (err) {
      alert('Failed to load items');
    } finally {
      setLoading(false);
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

  /* ==================== IMAGE HANDLING ==================== */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, image: reader.result, imagePreview: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setForm({ ...form, image: null, imagePreview: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ==================== SAVE ITEM ==================== */
  const handleCreate = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.item_group || !form.default_uom.trim()) {
      alert('Please fill all required fields: Item Code, Item Name, Item Group, Default UOM');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        disabled: form.disabled ? 1 : 0,
        allow_alternative_item: form.allow_alternative_item ? 1 : 0,
        maintain_stock: form.maintain_stock ? 1 : 0,
        has_variants: form.has_variants ? 1 : 0,
        is_fixed_asset: form.is_fixed_asset ? 1 : 0,
        is_zero_rated: form.is_zero_rated ? 1 : 0,
        is_exempt: form.is_exempt ? 1 : 0,
        image: form.image || '',
        barcodes: barcodes.length > 0 ? barcodes : undefined
      };

      const res = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item', payload, { withCredentials: true });

      if (res.data.message.success) {
        alert('Item created successfully!');
        setShowForm(false);
        setBarcodes([]);
        setForm({
          item_code: '', item_name: '', item_group: '', disabled: false,
          allow_alternative_item: false, maintain_stock: true, has_variants: false,
          opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
          is_fixed_asset: false, is_zero_rated: false, is_exempt: false,
          default_uom: 'Nos', tax_code: '', description: '', image: null, imagePreview: null
        });
        fetchItems();
        setCurrentPage(1);
      }
    } catch (err) {
      alert(err.response?.data?.message?.message || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseForm = () => {
    const hasChanges = form.item_code || form.item_name || form.item_group || barcodes.length > 0 || form.image;
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false);
    setBarcodes([]);
    setForm(prev => ({ ...prev, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
  };

  const clearFilters = () => {
    setFilterId('');
    setFilterName('');
    setFilterGroup('');
    setFilterStatus('');
    setFilterHasVariants('');
    setCurrentPage(1);
  };

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title">
              <Package size={20} /> Items
            </h1>
            <p className="so-page-subtitle">{total} record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setItTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {itTheme.toUpperCase()}
            </button>

            <button
              onClick={() => { setShowForm(true); fetchItemGroups(); }}
              className="so-btn-primary"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          {/* Top Filters Bar */}
          <div className="so-filter-bar" style={{ 
            background: 'white', 
            padding: '1.25rem 2rem', 
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end'
          }}>
            <div style={{ flex: '1 1 220px' }}>
              <label className="so-filter-label">Search / Code</label>
              <input
                type="text"
                placeholder="Search code or name..."
                value={filterName || filterId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterId(val);
                  setFilterName(val);
                  setCurrentPage(1);
                }}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Item Group</label>
              <input
                type="text"
                placeholder="Filter by group..."
                value={filterGroup}
                onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="so-filter-input"
                style={{ padding: '0.45rem' }}
              >
                <option value="">All Statuses</option>
                <option value="Enabled">Enabled</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Has Variants</label>
              <select
                value={filterHasVariants}
                onChange={e => { setFilterHasVariants(e.target.value); setCurrentPage(1); }}
                className="so-filter-input"
                style={{ padding: '0.45rem' }}
              >
                <option value="">All</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <button onClick={clearFilters} className="so-clear-btn" style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}>
              Clear
            </button>
          </div>

          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{total} record(s) found</p>
            <div className="so-table-card">
              <div className="so-table-wrapper">
                {loading ? (
                  <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading items...</p>
                  </div>
                ) : paginatedItems.length === 0 ? (
                  <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--so-text-heading)' }}>
                      {total === 0 ? 'No items yet' : 'No items match your filters'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--so-text-muted)', marginTop: '0.5rem' }}>
                      {total === 0 ? 'Start by adding your first item.' : 'Try adjusting your search or filters.'}
                    </p>
                    {total === 0 && (
                      <button
                        onClick={() => { setShowForm(true); fetchItemGroups(); }}
                        style={{ marginTop: '1rem', color: themeColor, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Add First Item
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Item Group</th>
                        <th>Status</th>
                        <th>Variants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map(item => (
                        <tr key={item.name}>
                          <td style={{ fontWeight: 700, color: themeColor }}>{item.item_code}</td>
                          <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                          <td>{item.item_group}</td>
                          <td>
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                              backgroundColor: !item.disabled ? `${themeColor}20` : '#fee2e2',
                              color: !item.disabled ? themeColor : '#ef4444',
                              border: `1px solid ${!item.disabled ? `${themeColor}40` : '#fecaca'}`
                            }}>
                              {!item.disabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.has_variants ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {!loading && total > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 50, 100].map(size => (
                        <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{size}</button>
                      ))}
                    </div>
                    
                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {Math.ceil(total / pageSize) || 1}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={currentPage >= Math.ceil(total / pageSize)}><ChevronRight size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== ADD ITEM MODAL ==================== */}
        {showForm && (
          <div className="so-modal-overlay" onClick={e => e.target === e.currentTarget && handleCloseForm()}>
            <div className="so-modal" style={{ maxWidth: '900px' }}>
              {/* Modal Header */}
              <div className="so-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button onClick={handleCloseForm} className="so-modal-close">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="so-modal-title">New Item</h2>
                </div>
                <button onClick={handleCloseForm} className="so-modal-close">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="so-modal-body">
                {/* Basic Info Grid */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Basic Information</p>
                  </div>
                  <div className="so-card-body">
                    <div className="so-form-grid">
                      <div className="so-field">
                        <label className="so-label">Item Code <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <input
                          type="text"
                          value={form.item_code}
                          onChange={e => setForm({ ...form, item_code: e.target.value })}
                          className="so-input"
                          placeholder="ITM-001"
                          autoFocus
                        />
                      </div>

                      <div className="so-field">
                        <label className="so-label">Item Name <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <input
                          type="text"
                          value={form.item_name}
                          onChange={e => setForm({ ...form, item_name: e.target.value })}
                          className="so-input"
                          placeholder="Product Name"
                        />
                      </div>

                      <div className="so-field" style={{ position: 'relative' }}>
                        <label className="so-label">Item Group <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <button
                          type="button"
                          onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                          className="so-select"
                          style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span style={{ opacity: form.item_group ? 1 : 0.5 }}>{selectedGroupLabel}</span>
                          <ChevronDown size={16} />
                        </button>
                        {showGroupDropdown && (
                          <div className="so-dropdown" style={{ left: 0, right: 0 }}>
                            <input
                              type="text"
                              value={groupSearch}
                              onChange={e => setGroupSearch(e.target.value)}
                              placeholder="Search groups..."
                              className="so-input"
                              style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid var(--so-border)' }}
                              autoFocus
                            />
                            {itemGroups.map(g => (
                              <div
                                key={g.value}
                                onClick={() => {
                                  setForm({ ...form, item_group: g.value });
                                  setShowGroupDropdown(false);
                                  setGroupSearch('');
                                }}
                                className="so-dropdown-item"
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <span>{g.label}</span>
                                {form.item_group === g.value && <ChevronRight size={14} style={{ color: 'var(--so-primary)' }} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Default UOM <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <input
                          type="text"
                          value={form.default_uom}
                          onChange={e => setForm({ ...form, default_uom: e.target.value })}
                          className="so-input"
                          placeholder="Nos"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Properties Grid */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Configuration & Rates</p>
                  </div>
                  <div className="so-card-body">
                    <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', padding: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.disabled} onChange={e => setForm({ ...form, disabled: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                        Disabled
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.maintain_stock} onChange={e => setForm({ ...form, maintain_stock: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                        Maintain Stock
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.has_variants} onChange={e => setForm({ ...form, has_variants: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                        Has Variants
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input type="checkbox" checked={form.is_fixed_asset} onChange={e => setForm({ ...form, is_fixed_asset: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                        Fixed Asset
                      </label>
                    </div>

                    <div className="so-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      <div className="so-field">
                        <label className="so-label">Opening Stock</label>
                        <input type="number" value={form.opening_stock} onChange={e => setForm({ ...form, opening_stock: Number(e.target.value) })} className="so-input" />
                      </div>
                      <div className="so-field">
                        <label className="so-label">Valuation Rate</label>
                        <input type="number" value={form.valuation_rate} onChange={e => setForm({ ...form, valuation_rate: Number(e.target.value) })} className="so-input" />
                      </div>
                      <div className="so-field">
                        <label className="so-label">Selling Rate</label>
                        <input type="number" value={form.standard_selling_rate} onChange={e => setForm({ ...form, standard_selling_rate: Number(e.target.value) })} className="so-input" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="so-field">
                  <label className="so-label">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="so-input"
                    placeholder="Optional item description..."
                    style={{ height: 'auto', minHeight: '80px', paddingTop: '0.75rem' }}
                  />
                </div>

                {/* Barcodes */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Barcodes</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setIsScanning(true); barcodeInputRef.current?.focus(); }}
                        className="so-btn-ghost"
                        style={{ fontSize: '0.65rem' }}
                      >
                        <Package size={14} /> Hardware
                      </button>
                      <button
                        onClick={() => setShowCameraScanner(true)}
                        className="so-btn-ghost"
                        style={{ fontSize: '0.65rem' }}
                      >
                        <Camera size={14} /> Camera
                      </button>
                    </div>
                  </div>
                  <div className="so-card-body">
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div className="so-barcode-area" style={{ flex: 1 }}>
                        <Search size={16} />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && barcodeInput && addBarcode(barcodeInput)}
                          placeholder="Type or scan barcode..."
                          className="so-barcode-input"
                        />
                      </div>
                      <button
                        onClick={() => barcodeInput && addBarcode(barcodeInput)}
                        className="so-btn-primary"
                        style={{ padding: '0 1.5rem' }}
                      >
                        Add
                      </button>
                    </div>

                    {barcodes.length > 0 && (
                      <div className="so-table-wrapper" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)' }}>
                        <table className="so-items-table">
                          <thead>
                            <tr>
                              <th>Barcode</th>
                              <th>UOM</th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {barcodes.map((b, i) => (
                              <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem' }}>{b.barcode}</td>
                                <td>{b.uom}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    onClick={() => setBarcodes(prev => prev.filter((_, idx) => idx !== i))}
                                    className="so-btn-danger"
                                    style={{ padding: '0.25rem' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Item Image</p>
                  </div>
                  <div className="so-card-body">
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                      <div style={{ position: 'relative', width: '120px', height: '120px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {form.imagePreview ? (
                          <>
                            <img src={form.imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              onClick={removeImage}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', padding: '2px', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <Package size={32} style={{ opacity: 0.1 }} />
                        )}
                      </div>
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="so-btn-secondary"
                        >
                          <Upload size={14} /> Choose Image
                        </button>
                        <p style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)', marginTop: '0.5rem' }}>PNG, JPG up to 5MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="so-modal-footer">
                <button onClick={handleCloseForm} className="so-btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.item_code.trim() || !form.item_name.trim() || !form.item_group}
                  className="so-btn-primary"
                  style={{ minWidth: '120px' }}
                >
                  {saving ? <><Loader2 size={14} className="so-spinner" /> Saving...</> : 'Save Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner */}
        {showCameraScanner && <CameraScanner />}
      </div>
    </>
  );
}

export default ItemList;