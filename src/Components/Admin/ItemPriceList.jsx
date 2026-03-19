// src/pages/ItemPriceList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, ChevronLeft, Tag, AlertCircle,
  ChevronDown, Palette, Loader2, Filter, Eye, Edit2, Trash2
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import NavBar from '../Nav/NavBar';
import '../Admin/SalesOrder.css'; // Reuse SalesOrder styles for consistency

function ItemPriceList() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Theme toggle (synced across pages)
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

  // Filters
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterItemName, setFilterItemName] = useState('');
  const [filterPriceList, setFilterPriceList] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    uom: 'Nos',
    packing_unit: 0,
    price_list: 'Standard Selling',
    buying: false,
    selling: true,
    customer: '',
    batch_no: '',
    currency: 'AED',
    rate: 0,
    valid_from: '',
    valid_upto: '',
    lead_time_days: 0,
    note: ''
  });
  const [saving, setSaving] = useState(false);

  // Item Search
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const dropdownRef = useRef(null);

  /* ==================== FETCH PRICES ==================== */
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(res.data.message || []);
      } catch (err) {
        Swal.fire('Error', 'Failed to load item prices', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  /* ==================== ITEM SEARCH ==================== */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemSearch.trim().length >= 2) {
        fetchItems(itemSearch);
      } else {
        setItems([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const fetchItems = async (q) => {
    setItemLoading(true);
    try {
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items',
        { params: { q }, withCredentials: true }
      );
      setItems(res.data.message || []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setItemLoading(false);
    }
  };

  const handleItemSelect = (item) => {
    setForm({
      ...form,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom || 'Nos'
    });
    setItemSearch('');
    setShowItemDropdown(false);
  };

  /* ==================== FILTERING ==================== */
  const filteredPrices = useMemo(() => {
    return prices.filter(p => {
      const code = !filterItemCode || p.item_code.toLowerCase().includes(filterItemCode.toLowerCase());
      const name = !filterItemName || p.item_name.toLowerCase().includes(filterItemName.toLowerCase());
      const list = !filterPriceList || p.price_list.toLowerCase().includes(filterPriceList.toLowerCase());
      return code && name && list;
    });
  }, [prices, filterItemCode, filterItemName, filterPriceList]);

  const total = filteredPrices.length;
  const paginated = filteredPrices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ==================== SAVE ==================== */
  const handleSave = async () => {
    if (!form.item_code || !form.price_list || !form.rate || form.rate <= 0) {
      alert('Please fill required fields: Item, Price List, and valid Rate.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_code: form.item_code,
        price_list: form.price_list,
        price_list_rate: parseFloat(form.rate),
        buying: form.buying ? 1 : 0,
        selling: form.selling ? 1 : 0,
        currency: form.currency,
        uom: form.uom,
        valid_from: form.valid_from || null,
        valid_upto: form.valid_upto || null,
        batch_no: form.batch_no || null,
        customer: form.customer || null,
        lead_time_days: parseInt(form.lead_time_days) || 0,
        packing_unit: parseInt(form.packing_unit) || 0,
        note: form.note || null
      };

      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item_price',
        payload,
        { withCredentials: true }
      );

      if (res.data.success || res.data.message?.success) {
        Swal.fire({ icon: 'success', title: 'Saved!', text: 'Item price saved successfully!', timer: 1500 });
        setShowForm(false);
        resetForm();
        // Refresh list
        const refresh = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(refresh.data.message || []);
        setCurrentPage(1);
      } else {
        Swal.fire('Error', res.data.message || 'Failed to save', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      item_code: '', item_name: '', uom: 'Nos', packing_unit: 0,
      price_list: 'Standard Selling', buying: false, selling: true,
      customer: '', batch_no: '', currency: 'AED', rate: 0,
      valid_from: '', valid_upto: '', lead_time_days: 0, note: ''
    });
  };

  const handleCloseForm = () => {
    const hasChanges = form.item_code || form.rate > 0 || form.price_list !== 'Standard Selling';
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false);
    resetForm();
  };

  return (
    <>
    <div className="so-page">
      <NavBar />
      
      {/* Page Header */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <Tag size={20} /> Item Price Catalog
          </h1>
          <p className="so-page-subtitle">Manage item rates and price lists</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search items..."
              value={filterItemCode}
              onChange={(e) => { setFilterItemCode(e.target.value); setCurrentPage(1); }}
              style={{
                paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.45rem', paddingBottom: '0.45rem',
                border: '1.5px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.8rem',
                width: '220px', outline: 'none', background: '#f8fafc', color: '#1e293b'
              }}
            />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
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
            {polTheme.toUpperCase()}
          </button>

          <button className="so-btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add New Price
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* Sidebar Filters */}
        <aside className="so-sidebar">
          <div className="so-filter-group">
            <label className="so-filter-label">Item Code</label>
            <input 
              type="text" 
              className="so-filter-input" 
              placeholder="Filter by code..."
              value={filterItemCode}
              onChange={(e) => setFilterItemCode(e.target.value)}
            />
          </div>
          <div className="so-filter-group">
            <label className="so-filter-label">Item Name</label>
            <input 
              type="text" 
              className="so-filter-input" 
              placeholder="Filter by name..."
              value={filterItemName}
              onChange={(e) => setFilterItemName(e.target.value)}
            />
          </div>
          <div className="so-filter-group">
            <label className="so-filter-label">Price List</label>
            <select 
              className="so-filter-select"
              value={filterPriceList}
              onChange={(e) => setFilterPriceList(e.target.value)}
            >
              <option value="">All Lists</option>
              <option value="Standard Selling">Standard Selling</option>
              <option value="Standard Buying">Standard Buying</option>
            </select>
          </div>
          
          <button 
            className="so-clear-btn"
            onClick={() => { setFilterItemCode(''); setFilterItemName(''); setFilterPriceList(''); }}
          >
            Clear Filters
          </button>
        </aside>

        {/* Main Content */}
        <main className="so-content">
          <div className="so-list-meta">
            Showing <b>{paginated.length}</b> of <b>{total}</b> price records
          </div>

          <div className="so-table-card">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Fetching Prices...</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="so-empty">
                <Tag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No pricing records found</p>
              </div>
            ) : (
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Item Details</th>
                    <th>Price List</th>
                    <th style={{ textAlign: 'right' }}>Rate (AED)</th>
                    <th style={{ textAlign: 'center' }}>Valid Range</th>
                    <th style={{ textAlign: 'center' }}>Last Updated</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(p => (
                    <tr key={p.name}>
                      <td>
                        <div className="so-item-display-name">{p.item_name}</div>
                        <div className="so-item-display-code">{p.item_code}</div>
                      </td>
                      <td>
                        <span className="so-badge so-badge-submitted" style={{ 
                          background: p.price_list.includes('Selling') ? themeLight : '#f1f5f9',
                          color: p.price_list.includes('Selling') ? themeColor : '#475569'
                        }}>
                          {p.price_list}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: themeColor }}>
                        {parseFloat(p.price_list_rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                        {p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '∞'} - {p.valid_upto ? new Date(p.valid_upto).toLocaleDateString() : '∞'}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(p.modified).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="so-btn-ghost"><Eye size={14} /></button>
                          <button className="so-btn-ghost"><Edit2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="so-pagination">
            <div>
              Page <b>{currentPage}</b> of <b>{Math.ceil(total / pageSize)}</b>
            </div>
            <div className="so-pagination-btns">
              <button 
                className="so-page-btn" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Previous
              </button>
              <button 
                className="so-page-btn"
                disabled={currentPage * pageSize >= total}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>

        {/* ==================== ADD PRICE MODAL ==================== */}
        {showForm && (
          <div className="so-modal-overlay">
            <div className="so-modal-container" style={{ maxWidth: '700px' }}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">New Item Price</h2>
                <button onClick={handleCloseForm} className="so-modal-close">
                  <X size={20} />
                </button>
              </div>

              <div className="so-modal-body">
                <div className="so-price-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Item Selection */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="so-form-label">Item / Product <span style={{ color: '#ef4444' }}>*</span></label>
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                      <div 
                        onClick={() => setShowItemDropdown(!showItemDropdown)}
                        className="so-form-input"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <span style={{ color: form.item_code ? '#1e293b' : '#94a3b8', fontWeight: form.item_code ? 700 : 400 }}>
                          {form.item_code ? `${form.item_code} - ${form.item_name}` : 'Select an item...'}
                        </span>
                        <ChevronDown size={16} />
                      </div>

                      {showItemDropdown && (
                        <div className="so-dropdown-portal" style={{ width: '100%', top: '100%', left: 0 }}>
                          <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                            <input 
                              type="text" 
                              className="so-filter-input" 
                              placeholder="Search item code/name..."
                              autoFocus
                              value={itemSearch}
                              onChange={e => setItemSearch(e.target.value)}
                            />
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {itemLoading ? (
                              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>Searching...</div>
                            ) : items.length === 0 ? (
                              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>No items found</div>
                            ) : (
                              items.map(it => (
                                <div key={it.name} onClick={() => handleItemSelect(it)} className="so-dropdown-item">
                                  <div className="so-item-display-name">{it.item_name}</div>
                                  <div className="so-item-display-code">{it.item_code}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="so-form-label">Price List</label>
                    <select 
                      className="so-form-input" 
                      value={form.price_list}
                      onChange={e => setForm({...form, price_list: e.target.value})}
                    >
                      <option value="Standard Selling">Standard Selling</option>
                      <option value="Standard Buying">Standard Buying</option>
                    </select>
                  </div>

                  <div>
                    <label className="so-form-label">Rate (AED) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="number" 
                      className="so-form-input" 
                      style={{ fontSize: '1.1rem', fontWeight: 800, color: themeColor }}
                      value={form.rate}
                      onChange={e => setForm({...form, rate: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="so-form-label">Valid From</label>
                    <input 
                      type="date" 
                      className="so-form-input" 
                      value={form.valid_from}
                      onChange={e => setForm({...form, valid_from: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="so-form-label">Valid Upto</label>
                    <input 
                      type="date" 
                      className="so-form-input" 
                      value={form.valid_upto}
                      onChange={e => setForm({...form, valid_upto: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="so-modal-footer">
                <button className="so-btn-secondary" onClick={handleCloseForm}>Discard</button>
                <button 
                  className="so-btn-primary" 
                  disabled={saving || !form.item_code || form.rate <= 0}
                  onClick={handleSave}
                  style={{ background: themeColor, borderColor: themeColor }}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Processing...' : 'Secure & Save Price'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ItemPriceList;