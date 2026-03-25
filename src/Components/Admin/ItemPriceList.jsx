import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
   Plus, Search, X, Tag, Filter, Eye, Edit2, Trash2,
   Loader2, ChevronLeft, ChevronRight, Warehouse, Scale,
   Box, ShieldCheck, MapPin, Calculator, Barcode, Palette, ChevronDown
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import NavBar from '../Nav/NavBar';
import './SalesOrder.css';

function ItemPriceList() {
   const [searchParams] = useSearchParams();
   const navigate = useNavigate();
   const location = useLocation();
   const [prices, setPrices] = useState([]);
   const [loading, setLoading] = useState(true);
   const [totalCount, setTotalCount] = useState(0);
   const [pageSize, setPageSize] = useState(20);
   const [currentPage, setCurrentPage] = useState(1);

   // Theme Sync (consistent with ItemList)
   const [pollTheme, setPollTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
   const isGreen = pollTheme === 'green';
   const themeColor = isGreen ? '#10b981' : '#0ea5e9';
   const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

   useEffect(() => {
      localStorage.setItem('legacySubTheme', pollTheme);

      // Inject Global CSS Variables for the theme
      const root = document.documentElement;
      if (isGreen) {
         root.style.setProperty('--so-primary', '#10b981');
         root.style.setProperty('--so-primary-hover', '#059669');
         root.style.setProperty('--so-primary-light', '#f0fdf4');
      } else {
         root.style.setProperty('--so-primary', '#0ea5e9');
         root.style.setProperty('--so-primary-hover', '#0284c7');
         root.style.setProperty('--so-primary-light', '#f0f9ff');
      }
   }, [pollTheme, isGreen]);

   // Filter Warehouse State
   const [warehouses, setWarehouses] = useState([]);
   const [priceLists, setPriceLists] = useState([]);
   const [brands, setBrands] = useState([]);
   const [selectedWarehouse, setSelectedWarehouse] = useState('');
   const [selectedPriceList, setSelectedPriceList] = useState('');
   const [selectedBrand, setSelectedBrand] = useState('');
   const [searchTerm, setSearchTerm] = useState('');
   const [itemCodeFilter, setItemCodeFilter] = useState(searchParams.get('item_code') || '');

   // Form State
   const [showForm, setShowForm] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);
   const [saving, setSaving] = useState(false);
   const [form, setForm] = useState({
      name: '', item_code: '', item_name: '', uom: 'Nos',
      price_list: 'Standard Selling', buying: 0, selling: 1,
      price_list_rate: 0, currency: 'AED'
   });

   // Search Items (for new selection)
   const [items, setItems] = useState([]);
   const [itemLoading, setItemLoading] = useState(false);
   const [itemSearch, setItemSearch] = useState('');
   const [showItemDropdown, setShowItemDropdown] = useState(false);
   const dropdownRef = useRef(null);

   useEffect(() => {
      const timer = setTimeout(() => {
         if (itemSearch.trim().length >= 2) fetchItems(itemSearch);
         else setItems([]);
      }, 300);
      return () => clearTimeout(timer);
   }, [itemSearch, searchParams]);

   const fetchItems = async (q) => {
      setItemLoading(true);
      try {
         const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_items_for_dropdown', { params: { search: q }, withCredentials: true });
         setItems(res.data.message || []);
      } catch (err) { console.error(err); }
      finally { setItemLoading(false); }
   };

   const handleItemSelect = (it) => {
      setForm({ ...form, item_code: it.value, item_name: it.label, uom: it.stock_uom || 'Nos' });
      setItemSearch('');
      setShowItemDropdown(false);
   };

   // Fetch Metadata
   useEffect(() => {
      const fetchMeta = async () => {
         try {
            const [wRes, pRes, bRes] = await Promise.all([
               axios.get('/api/method/kyle_retail.retail_api.api.get_warehouses', { withCredentials: true }).catch(() => ({ data: { message: [] } })),
               axios.get('/api/method/kyle_retail.retail_api.api.get_price_lists', { withCredentials: true }).catch(() => ({ data: { message: [] } })),
               axios.get('/api/method/kyle_retail.retail_api.api.get_item_brands', { withCredentials: true }).catch(() => ({ data: { message: [] } }))
            ]);
            setWarehouses(wRes.data?.message?.data || []);
            setPriceLists(pRes.data?.message?.data || []);
            setBrands(bRes.data?.message?.data || bRes.data?.message || []);
         } catch (err) {
            console.error("Meta fetch error", err);
         }
      };
      fetchMeta();
   }, []);

   /* ==================== CORE API FETCH ==================== */
   const fetchPriceRecords = async () => {
      try {
         setLoading(true);
         const params = {
            start: (currentPage - 1) * pageSize,
            page_length: pageSize,
            search: searchTerm || '',
            filters: JSON.stringify({
               warehouse: selectedWarehouse || undefined,
               price_list: selectedPriceList || undefined,
               brand: selectedBrand || undefined,
               item_code: itemCodeFilter ? ["like", `%${itemCodeFilter}%`] : undefined
            })
         };

         const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_price_list_all', {
            params,
            withCredentials: true
         });

         const result = res.data.message;
         setPrices(result?.data || []);
         setTotalCount(result?.total_count || 0);
      } catch (err) {
         console.error("Prices Load Error", err);
         setPrices([]);
      } finally {
         setLoading(false);
      }
   };

   // Unified Fetch Logic with Debounce for text inputs
   useEffect(() => {
      // For immediate results on dropdown changes
      const isDropdownChange = [selectedWarehouse, selectedPriceList, selectedBrand, pageSize].some((v, i, a) => {
         // This is a bit complex for a simple hook, let's keep it simple:
         // Dropdown changes should reset page and fetch.
         return false; // placeholder for logic below
      });

      const timer = setTimeout(() => {
         fetchPriceRecords();
      }, 400);

      return () => clearTimeout(timer);
   }, [searchTerm, itemCodeFilter, currentPage, pageSize, selectedWarehouse, selectedPriceList, selectedBrand]);

   // Helper to reset page when filters change
   const handleFilterChange = (setter, value) => {
      setter(value);
      setCurrentPage(1);
   };

   /* ==================== FORM ACTIONS ==================== */
   const handleEdit = (p) => {
      setForm({
         name: p.name,
         item_code: p.item_code,
         item_name: p.item_name,
         uom: p.uom,
         price_list: p.price_list,
         buying: p.buying,
         selling: p.selling,
         price_list_rate: p.rate ?? p.price_list_rate ?? 0,
         currency: p.currency || 'AED'
      });
      setIsEditMode(true);
      setShowForm(true);
   };

   const handleSave = async () => {
      if (!form.item_code || !form.price_list || form.price_list_rate <= 0) {
         Swal.fire('Oops!', 'Please ensure item, price list, and a valid rate are provided.', 'warning');
         return;
      }

      setSaving(true);
      try {
         const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price', {
            item_code: form.item_code,
            data: form
         }, { withCredentials: true });

         if (res.data.message?.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Registry Updated!', timer: 1500, showConfirmButton: false });
            setShowForm(false);
            fetchPriceRecords();
         }
      } catch (err) {
         console.error("Save Error", err);
         Swal.fire('Error', 'Targeted update failed. Please verify ERPNext constraints.', 'error');
      } finally {
         setSaving(false);
      }
   };

   React.useEffect(() => {
      // Ensure the browser scroll is enabled on this page
      document.body.style.overflowY = 'auto';
      return () => { document.body.style.overflowY = 'auto'; };
   }, []);

   return (
      <div className="so-page" style={{ background: '#f8fafc', overflowY: 'auto', display: 'block' }}>
         <NavBar />

         {/* Page Header */}
         <div className="so-page-header">
            <div>
               <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <Scale size={20} style={{ color: themeColor }} />
                     <span>Price Master</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                     {totalCount} Entries
                  </span>
               </h1>
               <p className="so-page-subtitle">Global pricing reports & inventory valuation</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

               {/* Theme Toggle Button (Shows the theme you will switch TO) */}
               <button
                  onClick={() => setPollTheme(isGreen ? 'blue' : 'green')}
                  style={{
                     display: 'flex', alignItems: 'center', gap: '0.4rem',
                     padding: '0.45rem 0.9rem', background: '#f8fafc',
                     border: `1.5px solid ${isGreen ? '#0ea5e9' : '#10b981'}`,
                     borderRadius: '0.375rem',
                     fontSize: '0.75rem', fontWeight: 800,
                     color: isGreen ? '#0ea5e9' : '#10b981',
                     cursor: 'pointer', transition: 'all 0.2s',
                     textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}
                  title={`Switch to ${isGreen ? 'Blue' : 'Green'} Theme`}
               >
                  <Palette size={13} />
                  {isGreen ? 'BLUE' : 'GREEN'}
               </button>

               <button className="so-btn-primary" onClick={() => { setForm({ item_code: '', item_name: '', uom: 'Nos', price_list: 'Standard Selling', buying: 0, selling: 1, price_list_rate: 0, currency: 'AED' }); setIsEditMode(false); setShowForm(true); }}>
                  <Plus size={16} /> New Rate
               </button>
            </div>
         </div>

         <div style={{ padding: '1.25rem 2rem' }}>
            {/* Consolidated Filters */}
            <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
               <div style={{ flex: '2', minWidth: '220px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Search Item Name</label>
                  <div style={{ position: 'relative' }}>
                     <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                     <input
                        type="text"
                        placeholder="Search by name..."
                        className="so-filter-input"
                        style={{
                           paddingLeft: '2.2rem', background: '#f8fafc', height: '2.5rem', fontSize: '0.8rem',
                           border: `1.5px solid ${themeColor}33`, transition: 'all 0.2s',
                           borderRadius: '0.375rem', outline: 'none', width: '100%'
                        }}
                        onFocus={e => e.target.style.borderColor = themeColor}
                        onBlur={e => e.target.style.borderColor = `${themeColor}33`}
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                     />
                  </div>
               </div>
               <div style={{ flex: '1.5', minWidth: '180px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Search Item Code</label>
                  <input
                     type="text"
                     placeholder="Search Code..."
                     className="so-filter-input"
                     style={{
                        background: '#f8fafc', height: '2.5rem', fontSize: '0.8rem',
                        border: `1.5px solid ${themeColor}33`, transition: 'all 0.2s',
                        borderRadius: '0.375rem', outline: 'none'
                     }}
                     onFocus={e => e.target.style.borderColor = themeColor}
                     onBlur={e => e.target.style.borderColor = `${themeColor}33`}
                     value={itemCodeFilter}
                     onChange={e => { setItemCodeFilter(e.target.value); setCurrentPage(1); }}
                  />
               </div>

               <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Filter Registry</label>
                  <select
                     className="so-filter-input"
                     style={{
                        background: '#f8fafc', height: '2.5rem', fontSize: '0.8rem', cursor: 'pointer',
                        border: `1.5px solid ${themeColor}33`, borderRadius: '0.375rem', outline: 'none'
                     }}
                     value={selectedPriceList}
                     onChange={e => handleFilterChange(setSelectedPriceList, e.target.value)}
                  >
                     <option value="">All Price Lists</option>
                     {priceLists.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                  </select>
               </div>

               <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Filter Brand</label>
                  <select
                     className="so-filter-input"
                     style={{
                        background: '#f8fafc', height: '2.5rem', fontSize: '0.8rem', cursor: 'pointer',
                        border: `1.5px solid ${themeColor}33`, borderRadius: '0.375rem', outline: 'none'
                     }}
                     value={selectedBrand}
                     onChange={e => handleFilterChange(setSelectedBrand, e.target.value)}
                  >
                     <option value="">All Brands</option>
                     {Array.isArray(brands) && brands.map((b, i) => {
                        const val = typeof b === 'string' ? b : (b.name || b.value || b.label || '');
                        const display = typeof b === 'string' ? b : (b.label || b.name || b.value || '');
                        if (!val) return null;
                        return <option key={`${val}-${i}`} value={val}>{display}</option>;
                     })}
                  </select>
               </div>

               <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Filter Warehouse</label>
                  <select
                     className="so-filter-input"
                     style={{
                        background: '#f8fafc', height: '2.5rem', fontSize: '0.8rem', cursor: 'pointer',
                        border: `1.5px solid ${themeColor}33`, borderRadius: '0.375rem', outline: 'none'
                     }}
                     value={selectedWarehouse}
                     onChange={e => handleFilterChange(setSelectedWarehouse, e.target.value)}
                  >
                     <option value="">Global Stock</option>
                     {Array.isArray(warehouses) && warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                  </select>
               </div>

               <button
                  onClick={() => { setSearchTerm(''); setItemCodeFilter(''); setSelectedWarehouse(''); setSelectedPriceList(''); setSelectedBrand(''); setCurrentPage(1); }}
                  style={{ background: '#fef2f2', color: '#ef4444', height: '2.5rem', padding: '0 1rem', border: 'none', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
               >
                  Clear Filters
               </button>
            </div>

            {/* Result Table Table Card */}
            <div className="so-table-card" style={{ marginBottom: '4rem' }}>
               <table className="so-table">
                  <thead>
                     <tr>
                        <th>Item Identification</th>
                        <th>Registry Info</th>
                        <th style={{ textAlign: 'center' }}>On-Hand Stock</th>
                        <th style={{ textAlign: 'right' }}>Valuation (AED)</th>
                        <th style={{ textAlign: 'center' }}>Controls</th>
                     </tr>
                  </thead>
                  <tbody>
                     {loading ? (
                        <tr>
                           <td colSpan="5" className="so-empty">
                              <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto 0.5rem' }} />
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                 Analyzing Prices...
                              </div>
                           </td>
                        </tr>
                     ) : prices.length === 0 ? (
                        <tr>
                           <td colSpan="5" className="so-empty">
                              <Calculator size={36} style={{ margin: '0 auto 0.75rem', color: '#e2e8f0' }} />
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>Zero results found</div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                                 Try broadening your search or switching warehouses.
                              </div>
                           </td>
                        </tr>
                     ) : (
                        prices.map(p => (
                           <tr key={p.name} onClick={() => handleEdit(p)}>
                              {/* Identity */}
                              <td>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{
                                       width: '36px', height: '36px', borderRadius: '0.5rem',
                                       background: themeLight, color: themeColor,
                                       display: 'flex', alignItems: 'center', justifyContent: 'center',
                                       flexShrink: 0
                                    }}>
                                       <Box size={16} />
                                    </div>
                                    <div>
                                       <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>{p.item_name}</div>
                                       <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                                          {p.item_code}
                                          {p.brand && <span style={{ color: themeColor, marginLeft: '0.5rem' }}>• {p.brand}</span>}
                                       </div>
                                    </div>
                                 </div>
                              </td>

                              {/* Registry Info */}
                              <td>
                                 <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                                    {p.price_list}
                                 </div>
                                 <div style={{
                                    fontSize: '0.68rem', fontWeight: 700, color: themeColor,
                                    background: themeLight, padding: '0.1rem 0.4rem',
                                    borderRadius: '0.25rem', display: 'inline-block', marginTop: '0.25rem'
                                 }}>
                                    {p.uom} Units
                                 </div>
                              </td>

                              {/* On-Hand Stock */}
                              <td style={{ textAlign: 'center' }}>
                                 <span style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '9999px',
                                    background: (p.stock || p.actual_qty) > 0 ? themeLight : '#fee2e2',
                                    color: (p.stock || p.actual_qty) > 0 ? themeColor : '#ef4444',
                                    fontSize: '0.75rem',
                                    fontWeight: 800
                                 }}>
                                    {p.stock ?? p.actual_qty ?? 0}
                                 </span>
                              </td>

                              {/* Valuation */}
                              <td style={{ textAlign: 'right' }}>
                                 <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.15rem' }}>Core Rate</div>
                                 <div style={{ fontSize: '0.9rem', fontWeight: 950, color: themeColor, fontVariantNumeric: 'tabular-nums' }}>
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginRight: '0.2rem' }}>AED</span>
                                    {Number(p.rate ?? p.price_list_rate ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </div>
                              </td>

                              {/* Controls */}
                              <td>
                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                    <button
                                       onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                                       style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                                       onMouseEnter={e => { e.currentTarget.style.background = themeLight; e.currentTarget.style.color = themeColor; }}
                                       onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                                    >
                                       <Edit2 size={15} />
                                    </button>
                                    <button
                                       onClick={(e) => e.stopPropagation()}
                                       style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                                       onMouseEnter={e => { e.currentTarget.style.background = themeLight; e.currentTarget.style.color = themeColor; }}
                                       onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                                    >
                                       <Eye size={15} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>

               {/* Pagination Card Footer */}
               <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                     Showing <b>{(currentPage - 1) * pageSize + 1}</b> to <b>{Math.min(currentPage * pageSize, totalCount)}</b> of {totalCount} records
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.2rem', borderRadius: '0.5rem', gap: '0.15rem' }}>
                        {[20, 50, 100, 200, 500].map(size => (
                           <button
                              key={size}
                              onClick={() => { setPageSize(size); setCurrentPage(1); }}
                              style={{
                                 padding: '0.25rem 0.65rem', borderRadius: '0.35rem', fontSize: '0.7rem', fontWeight: 800,
                                 border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                 background: pageSize === size ? themeColor : 'transparent',
                                 color: pageSize === size ? '#fff' : '#64748b'
                              }}
                           >
                              {size}
                           </button>
                        ))}
                     </div>
                     <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                           onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(1, prev - 1)); }}
                           disabled={currentPage === 1}
                           className="so-page-btn"
                        >
                           <ChevronLeft size={16} />
                        </button>
                        <button
                           onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => prev + 1); }}
                           disabled={currentPage * pageSize >= totalCount}
                           className="so-page-btn"
                        >
                           <ChevronRight size={16} />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Modern Modal View */}
         {showForm && (
            <div className="so-modal-overlay">
               <div className="so-modal" style={{ maxWidth: '600px', borderRadius: '1rem' }}>
                  <div className="so-modal-header">
                     <h3 className="so-modal-title">{isEditMode ? 'Modify Price Registry' : 'New Price Definition'}</h3>
                     <button onClick={() => setShowForm(false)} className="so-modal-close"><X size={20} /></button>
                  </div>

                  <div className="so-modal-body" style={{ gap: '1.5rem', padding: '2rem' }}>
                     <div className="so-field">
                        <label className="so-label">Target Item / SKU</label>
                        {!isEditMode ? (
                           <div ref={dropdownRef} style={{ position: 'relative' }}>
                              <div
                                 onClick={() => setShowItemDropdown(!showItemDropdown)}
                                 className="so-input"
                                 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}
                              >
                                 <span style={{ color: form.item_code ? '#1e293b' : '#94a3b8' }}>{form.item_code ? `${form.item_name} (${form.item_code})` : 'Select Product...'}</span>
                                 <ChevronDown size={18} />
                              </div>
                              {showItemDropdown && (
                                 <div className="so-dropdown-portal">
                                    <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                       <input
                                          type="text"
                                          className="so-input"
                                          style={{ height: '2.5rem', fontSize: '0.8rem' }}
                                          placeholder="Search items..."
                                          autoFocus
                                          value={itemSearch}
                                          onChange={e => setItemSearch(e.target.value)}
                                       />
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                       {itemLoading ? <div style={{ padding: '1.5rem', textAlign: 'center' }}><Loader2 size={16} className="so-spinner" /></div> :
                                          items.length === 0 ? <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>No results</div> :
                                             items.map(it => (
                                                <div key={it.value} onClick={() => handleItemSelect(it)} className="so-dropdown-item">
                                                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                      {it.image && <img src={it.image} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />}
                                                      <div>
                                                         <p className="so-dropdown-item-name" style={{ margin: 0 }}>{it.label}</p>
                                                         <p className="so-dropdown-item-code" style={{ margin: 0 }}>{it.value}</p>
                                                      </div>
                                                   </div>
                                                </div>
                                             ))
                                       }
                                    </div>
                                 </div>
                              )}
                           </div>
                        ) : (
                           <>
                              <input type="text" className="so-input" value={form.item_name} disabled style={{ background: '#f8fafc', fontWeight: 700 }} />
                              <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontWeight: 700 }}>Code: {form.item_code}</p>
                           </>
                        )}
                     </div>

                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="so-field">
                           <label className="so-label">Price List</label>
                           <select
                              className="so-select"
                              value={form.price_list}
                              onChange={e => setForm({ ...form, price_list: e.target.value, buying: e.target.value.toLowerCase().includes('buying') ? 1 : 0, selling: e.target.value.toLowerCase().includes('selling') ? 1 : 0 })}
                           >
                              {Array.isArray(priceLists) && priceLists.map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                           </select>
                        </div>
                        <div className="so-field">
                           <label className="so-label">Unit (UOM)</label>
                           <input type="text" className="so-input" value={form.uom} onChange={e => setForm({ ...form, uom: e.target.value })} />
                        </div>
                     </div>

                     <div className="so-field">
                        <label className="so-label">Price Rate (AED)</label>
                        <input
                           type="number"
                           className="so-input"
                           style={{ height: '4rem', fontSize: '2rem', fontWeight: 800, color: themeColor, textAlign: 'center' }}
                           value={form.price_list_rate}
                           onChange={e => setForm({ ...form, price_list_rate: e.target.value })}
                        />
                     </div>

                     <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, padding: '1rem', borderRadius: '0.75rem', border: `1.5px solid ${form.buying ? '#fef3c7' : '#f1f5f9'}`, background: form.buying ? '#fefce8' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                           <span style={{ fontSize: '0.75rem', fontWeight: 700, color: form.buying ? '#d97706' : '#94a3b8' }}>BUYING</span>
                           <input type="checkbox" checked={form.buying === 1} onChange={e => setForm({ ...form, buying: e.target.checked ? 1 : 0 })} />
                        </div>
                        <div style={{ flex: 1, padding: '1rem', borderRadius: '0.75rem', border: `1.5px solid ${form.selling ? '#dcfce7' : '#f1f5f9'}`, background: form.selling ? '#f0fdf4' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                           <span style={{ fontSize: '0.75rem', fontWeight: 700, color: form.selling ? '#166534' : '#94a3b8' }}>SELLING</span>
                           <input type="checkbox" checked={form.selling === 1} onChange={e => setForm({ ...form, selling: e.target.checked ? 1 : 0 })} />
                        </div>
                     </div>
                  </div>

                  <div className="so-modal-footer">
                     <button onClick={() => setShowForm(false)} className="so-btn-secondary" style={{ padding: '0 1.5rem', height: '2.5rem' }}>Cancel</button>
                     <button onClick={handleSave} className="so-btn-primary" style={{ padding: '0 1.5rem', height: '2.5rem', background: themeColor }} disabled={saving}>
                        {saving ? 'Syncing...' : 'Commit Changes'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

export default ItemPriceList;