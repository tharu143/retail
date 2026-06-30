import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from "react-router-dom";
import {
   Plus, Search, X, Tag, Filter, Edit2, Trash2,
   Loader2, ChevronLeft, ChevronRight, Scale,
   Box, Calculator, Palette, ChevronDown, Building2,
   TrendingUp, TrendingDown, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ListCustomizer from './ListCustomizer';

/* ─── Branch colour palette ────────────────────────────────── */
const BRANCH_COLORS = [
   { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
   { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
   { bg: '#fdf4ff', text: '#9333ea', border: '#e9d5ff' },
   { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
   { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
   { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
   { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
];

function getBranchColor(idx) {
   return BRANCH_COLORS[idx % BRANCH_COLORS.length];
}

/* ─── Derive branch label from price list name ─────────────── */
function branchFromPriceList(pl) {
   if (!pl) return null;
   return pl.replace(' Selling', '').replace(' Buying', '').trim();
}

/* ═══════════════════════════════════════════════════════════ */
function ItemPriceList() {
   const [searchParams] = useSearchParams();
   const [customColumns, setCustomColumns] = useState(() => {
      const saved = localStorage.getItem('custom_columns_Item Price');
      try {
         return saved ? JSON.parse(saved) : [];
      } catch (e) {
         return [];
      }
   });
   const [prices, setPrices] = useState([]);
   const [loading, setLoading] = useState(true);
   const [totalCount, setTotalCount] = useState(0);
   const [pageSize, setPageSize] = useState(20);
   const [currentPage, setCurrentPage] = useState(1);

   /* Role & Branch Access Control */
   const user_roles = JSON.parse(localStorage.getItem('user_roles') || '[]');
   const isAdmin = user_roles.includes('Administrator') || user_roles.includes('System Manager');
   const userWarehouse = localStorage.getItem('warehouse') || '';
   // Derive branch name from warehouse (e.g. "Shamkha Warehouse - NS" → "Shamkha")
   const userBranch = userWarehouse ? userWarehouse.replace(/\s*(?:Warehouse|-).*$/i, '').trim() : '';

   /* Theme */
   const [pollTheme, setPollTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
   const isGreen = pollTheme === 'green';
   const themeColor = isGreen ? '#10b981' : '#0ea5e9';
   const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

   useEffect(() => {
      localStorage.setItem('legacySubTheme', pollTheme);
      const root = document.documentElement;
      root.style.setProperty('--so-primary', isGreen ? '#10b981' : '#0ea5e9');
      root.style.setProperty('--so-primary-hover', isGreen ? '#059669' : '#0284c7');
      root.style.setProperty('--so-primary-light', isGreen ? '#f0fdf4' : '#f0f9ff');
   }, [pollTheme, isGreen]);

   /* Meta-data */
   const [priceLists, setPriceLists] = useState([]);         // all price lists
   const [branchGroups, setBranchGroups] = useState([]);     // unique branch names derived from price lists
   const [branchColorMap, setBranchColorMap] = useState({});

   /* Filters — non-admins are locked to their branch */
   const [selectedBranch, setSelectedBranch] = useState(!isAdmin ? userBranch : ''); // e.g. "Shamkha"
   const [selectedType, setSelectedType] = useState('');     // '' | 'Selling' | 'Buying'
   const [searchTerm, setSearchTerm] = useState('');
   const [itemCodeFilter, setItemCodeFilter] = useState(searchParams.get('item_code') || '');

   /* Form */
   const [showForm, setShowForm] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);
   const [saving, setSaving] = useState(false);
   const [deleting, setDeleting] = useState(null);
   const [form, setForm] = useState({
      name: '', item_code: '', item_name: '', uom: 'Nos',
      price_list: 'Standard Selling', buying: 0, selling: 1,
      price_list_rate: 0, currency: 'AED'
   });
   const [uoms, setUoms] = useState([]);

   /* Item search inside form */
   const [items, setItems] = useState([]);
   const [itemLoading, setItemLoading] = useState(false);
   const [itemSearch, setItemSearch] = useState('');
   const [showItemDropdown, setShowItemDropdown] = useState(false);
   const dropdownRef = useRef(null);

   /* Prevent body scroll on modal */
   useEffect(() => {
      document.body.style.overflowY = 'auto';
      return () => { document.body.style.overflowY = 'auto'; };
   }, []);

   /* ─── Fetch Metadata ───────────────────────────────────── */
   useEffect(() => {
      const load = async () => {
         try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_price_lists', { withCredentials: true });
            const lists = res.data?.message?.data || [];
            setPriceLists(lists);

            // Load UOMs
            try {
               const uomRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_uoms_retail', { withCredentials: true });
               const uomData = uomRes.data?.message?.data || uomRes.data?.message || [];
               setUoms(uomData.map(u => typeof u === 'string' ? u : (u.name || u.uom || u.value)));
            } catch (err) {
               console.error("Failed to load UOMs:", err);
            }

            // Derive unique branch names (strip "Selling"/"Buying" suffix)
            const branches = new Set();
            lists.forEach(pl => {
               const b = branchFromPriceList(pl.name);
               if (b) branches.add(b);
            });
            const branchArr = Array.from(branches).sort();
            setBranchGroups(branchArr);

            // Assign stable colors
            const colorMap = {};
            branchArr.forEach((b, i) => { colorMap[b] = getBranchColor(i); });
            setBranchColorMap(colorMap);
         } catch (e) { console.error(e); }
      };
      load();
   }, []);

   /* ─── Item search (form) ───────────────────────────────── */
   useEffect(() => {
      const t = setTimeout(() => {
         if (itemSearch.trim().length >= 2) fetchItems(itemSearch);
         else setItems([]);
      }, 300);
      return () => clearTimeout(t);
   }, [itemSearch]);

   const fetchItems = async (q) => {
      setItemLoading(true);
      try {
         const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_items_for_dropdown',
            { params: { search: q }, withCredentials: true });
         setItems(res.data.message || []);
      } catch (e) { console.error(e); }
      finally { setItemLoading(false); }
   };

   const handleItemSelect = (it) => {
      setForm(f => ({ ...f, item_code: it.value, item_name: it.label, uom: it.stock_uom || 'Nos' }));
      setItemSearch('');
      setShowItemDropdown(false);
   };

   /* ─── Fetch Price Records ──────────────────────────────── */
   const fetchPriceRecords = useCallback(async () => {
      try {
         setLoading(true);

         // Build price_list filter from branch + type selection
         let priceListFilter = undefined;
         if (selectedBranch && selectedType) {
            priceListFilter = `${selectedBranch} ${selectedType}`;
         } else if (selectedBranch) {
            // All price lists starting with this branch
            priceListFilter = ['like', `${selectedBranch}%`];
         } else if (selectedType) {
            priceListFilter = ['like', `%${selectedType}`];
         }

         const filterObj = {};
         if (priceListFilter) filterObj.price_list = priceListFilter;

         const params = {
            start: (currentPage - 1) * pageSize,
            page_length: pageSize,
            search: searchTerm || '',
            filters: JSON.stringify({
               ...filterObj,
               item_code: itemCodeFilter ? ['like', `%${itemCodeFilter}%`] : undefined
            }),
            extra_fields: JSON.stringify(customColumns)
         };

         const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_price_list_all',
            { params, withCredentials: true });

         const result = res.data.message;
         setPrices(result?.data || []);
         setTotalCount(result?.total_count || 0);
      } catch (e) {
         console.error(e);
         setPrices([]);
      } finally {
         setLoading(false);
      }
   }, [searchTerm, itemCodeFilter, currentPage, pageSize, selectedBranch, selectedType, customColumns]);

   useEffect(() => {
      const t = setTimeout(fetchPriceRecords, 350);
      return () => clearTimeout(t);
   }, [fetchPriceRecords]);

   const handleFilterChange = (setter, value) => {
      setter(value);
      setCurrentPage(1);
   };

   /* ─── Branch Quick-filter pills ───────────────────────── */
   const handleBranchPill = (branch) => {
      setSelectedBranch(prev => prev === branch ? '' : branch);
      setCurrentPage(1);
   };

   const handleTypePill = (type) => {
      setSelectedType(prev => prev === type ? '' : type);
      setCurrentPage(1);
   };

   /* ─── Edit ─────────────────────────────────────────────── */
   const handleEdit = (p) => {
      setForm({
         name: p.name,
         item_code: p.item_code,
         item_name: p.item_name,
         uom: p.uom,
         price_list: p.price_list,
         buying: p.buying ?? (p.price_list?.includes('Buying') ? 1 : 0),
         selling: p.selling ?? (p.price_list?.includes('Selling') ? 1 : 0),
         price_list_rate: p.rate ?? p.price_list_rate ?? 0,
         currency: p.currency || 'AED'
      });
      setIsEditMode(true);
      setShowForm(true);
   };

   /* ─── Save ─────────────────────────────────────────────── */
   const handleSave = async () => {
      if (!form.item_code || !form.price_list || Number(form.price_list_rate) <= 0) {
         Swal.fire('Oops!', 'Item, Price List, and a valid Rate are required.', 'warning');
         return;
      }
      setSaving(true);
      try {
         const res = await axios.post('/api/method/kyle_retail.retail_api.api.update_item_price',
            { item_code: form.item_code, data: form }, { withCredentials: true });
         if (res.data.message?.status === 'success') {
            Swal.fire({ icon: 'success', title: 'Price Updated!', timer: 1500, showConfirmButton: false });
            setShowForm(false);
            fetchPriceRecords();
         }
      } catch (e) {
         console.error(e);
         Swal.fire('Error', 'Update failed. Please try again.', 'error');
      } finally { setSaving(false); }
   };

   /* ─── Delete ───────────────────────────────────────────── */
   const handleDelete = async (p, e) => {
      e.stopPropagation();
      const result = await Swal.fire({
         title: 'Delete Price Record?',
         html: `<b>${p.item_name}</b><br/><span style="color:#64748b;font-size:0.85rem">${p.price_list} · ${p.uom}</span>`,
         icon: 'warning',
         showCancelButton: true,
         confirmButtonText: 'Delete',
         confirmButtonColor: '#ef4444',
         cancelButtonText: 'Cancel',
      });
      if (!result.isConfirmed) return;

      setDeleting(p.name);
      try {
         await axios.post('/api/method/frappe.client.delete',
            { doctype: 'Item Price', name: p.name }, { withCredentials: true });
         Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1200, showConfirmButton: false });
         fetchPriceRecords();
      } catch (e) {
         console.error(e);
         Swal.fire('Error', 'Could not delete. Check permissions.', 'error');
      } finally { setDeleting(null); }
   };

   /* ─── Summary counts per branch (computed from loaded prices) */
   const branchSummary = React.useMemo(() => {
      const map = {};
      prices.forEach(p => {
         const b = branchFromPriceList(p.price_list);
         if (!b) return;
         if (!map[b]) map[b] = { selling: 0, buying: 0 };
         if (p.selling) map[b].selling++;
         if (p.buying) map[b].buying++;
      });
      return map;
   }, [prices]);

   const totalPages = Math.ceil(totalCount / pageSize);

   /* ═══════════════════════════════════════════════════════ */
   return (
      <div className="so-page" style={{ background: '#f1f5f9', overflowY: 'auto', display: 'block', minHeight: '100vh' }}>

         {/* ── Header ──────────────────────────────────────── */}
         <div className="so-page-header" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 2rem' }}>
            <div>
               <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '0.6rem', background: themeLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Scale size={20} style={{ color: themeColor }} />
                  </div>
                  <span>Branch Price Lists</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                     {totalCount} records
                  </span>
               </h1>
               <p className="so-page-subtitle">Branch-specific buying &amp; selling prices per item</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
               <button
                  onClick={() => setPollTheme(isGreen ? 'blue' : 'green')}
                  style={{
                     display: 'flex', alignItems: 'center', gap: '0.4rem',
                     padding: '0.45rem 0.9rem', background: '#f8fafc',
                     border: `1.5px solid ${isGreen ? '#0ea5e9' : '#10b981'}`,
                     borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800,
                     color: isGreen ? '#0ea5e9' : '#10b981',
                     cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase'
                  }}
               >
                  <Palette size={13} /> {isGreen ? 'BLUE' : 'GREEN'}
               </button>
               <ListCustomizer
                  doctype="Item Price"
                  onSave={cols => setCustomColumns(cols)}
                  themeColor={themeColor}
               />
               <button
                  onClick={fetchPriceRecords}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
               >
                  <RefreshCw size={13} /> Refresh
               </button>
               <button className="so-btn-primary" style={{ background: themeColor }}
                  onClick={() => { setForm({ item_code: '', item_name: '', uom: 'Nos', price_list: 'Standard Selling', buying: 0, selling: 1, price_list_rate: 0, currency: 'AED' }); setIsEditMode(false); setShowForm(true); }}>
                  <Plus size={16} /> New Rate
               </button>
            </div>
         </div>

         <div style={{ padding: '1.5rem 2rem' }}>

            {/* ── Branch Quick-filter pills ───────────────── */}
            <div style={{ marginBottom: '1rem' }}>
               <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.07em' }}>
                  {isAdmin ? 'Filter by Branch' : `Branch: ${userBranch || 'Default'}`}
               </div>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  {isAdmin && (
                     <>
                        {/* All pill — admin only */}
                        <button
                           onClick={() => { handleBranchPill(''); handleFilterChange(setSelectedType, ''); }}
                           style={{
                              padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                              border: `2px solid ${!selectedBranch ? themeColor : '#e2e8f0'}`,
                              background: !selectedBranch ? themeColor : 'white',
                              color: !selectedBranch ? 'white' : '#64748b',
                              cursor: 'pointer', transition: 'all 0.15s'
                           }}
                        >
                           All Branches
                        </button>

                        {branchGroups.map((b, idx) => {
                           const col = branchColorMap[b] || getBranchColor(idx);
                           const isActive = selectedBranch === b;
                           const cnt = branchSummary[b];
                           return (
                              <button
                                 key={b}
                                 onClick={() => handleBranchPill(b)}
                                 style={{
                                    padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                                    border: `2px solid ${isActive ? col.text : col.border}`,
                                    background: isActive ? col.text : col.bg,
                                    color: isActive ? 'white' : col.text,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: '0.35rem'
                                 }}
                              >
                                 <Building2 size={11} />
                                 {b}
                                 {cnt && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.85 }}>
                                       {cnt.selling ? `S:${cnt.selling}` : ''}{cnt.selling && cnt.buying ? ' ' : ''}{cnt.buying ? `B:${cnt.buying}` : ''}
                                    </span>
                                 )}
                              </button>
                           );
                        })}
                     </>
                  )}

                  {/* Non-admin: show locked branch indicator */}
                  {!isAdmin && userBranch && (
                     <span
                        style={{
                           padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                           border: `2px solid ${themeColor}`,
                           background: themeColor,
                           color: 'white',
                           display: 'flex', alignItems: 'center', gap: '0.35rem'
                        }}
                     >
                        <Building2 size={11} />
                        {userBranch}
                     </span>
                  )}

                  {/* Buying / Selling type toggle */}
                  <div style={{ marginLeft: '0.75rem', display: 'flex', gap: '0.4rem' }}>
                     {['Selling', 'Buying'].map(type => (
                        <button
                           key={type}
                           onClick={() => handleTypePill(type)}
                           style={{
                              padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.73rem', fontWeight: 700,
                              border: `2px solid ${selectedType === type ? (type === 'Selling' ? '#059669' : '#d97706') : '#e2e8f0'}`,
                              background: selectedType === type ? (type === 'Selling' ? '#059669' : '#d97706') : 'white',
                              color: selectedType === type ? 'white' : (type === 'Selling' ? '#059669' : '#d97706'),
                              cursor: 'pointer', transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: '0.3rem'
                           }}
                        >
                           {type === 'Selling' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                           {type}
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* ── Text search bar ─────────────────────────── */}
            <div style={{ background: 'white', borderRadius: '0.6rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
               <div style={{ flex: '2', minWidth: '200px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Search Item Name</label>
                  <div style={{ position: 'relative' }}>
                     <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                     <input
                        type="text" placeholder="Search by name..."
                        className="so-filter-input"
                        style={{ paddingLeft: '2.2rem', background: '#f8fafc', height: '2.4rem', fontSize: '0.8rem', border: `1.5px solid ${themeColor}33`, borderRadius: '0.375rem', outline: 'none', width: '100%' }}
                        onFocus={e => e.target.style.borderColor = themeColor}
                        onBlur={e => e.target.style.borderColor = `${themeColor}33`}
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                     />
                  </div>
               </div>
               <div style={{ flex: '1.5', minWidth: '160px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Item Code</label>
                  <input
                     type="text" placeholder="Filter by code..."
                     className="so-filter-input"
                     style={{ background: '#f8fafc', height: '2.4rem', fontSize: '0.8rem', border: `1.5px solid ${themeColor}33`, borderRadius: '0.375rem', outline: 'none', width: '100%' }}
                     onFocus={e => e.target.style.borderColor = themeColor}
                     onBlur={e => e.target.style.borderColor = `${themeColor}33`}
                     value={itemCodeFilter}
                     onChange={e => { setItemCodeFilter(e.target.value); setCurrentPage(1); }}
                  />
               </div>
               <button
                  onClick={() => { setSearchTerm(''); setItemCodeFilter(''); setSelectedBranch(isAdmin ? '' : userBranch); setSelectedType(''); setCurrentPage(1); }}
                  style={{ background: '#fef2f2', color: '#ef4444', height: '2.4rem', padding: '0 1rem', border: '1px solid #fecdd3', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
               >
                  <X size={13} /> Clear All
               </button>
            </div>

            {/* ── Selected filter badge ───────────────────── */}
            {(selectedBranch || selectedType) && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>Showing:</span>
                  {selectedBranch && (
                     <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: themeLight, color: themeColor, fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Building2 size={11} /> {selectedBranch}
                     </span>
                  )}
                  {selectedType && (
                     <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: selectedType === 'Selling' ? '#f0fdf4' : '#fefce8', color: selectedType === 'Selling' ? '#059669' : '#d97706', fontSize: '0.72rem', fontWeight: 800 }}>
                        {selectedType}
                     </span>
                  )}
                  {selectedBranch && selectedType && (
                     <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>→ Price List: <b>{selectedBranch} {selectedType}</b></span>
                  )}
               </div>
            )}

            {/* ── Table ───────────────────────────────────── */}
            <div className="so-table-card" style={{ marginBottom: '4rem', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
               <table className="so-table">
                  <thead>
                     <tr style={{ background: '#f8fafc' }}>
                        <th style={{ width: '35%' }}>Item</th>
                        <th>Branch / Price List</th>
                        <th style={{ textAlign: 'center' }}>Type</th>
                        <th style={{ textAlign: 'center' }}>Stock</th>
                        <th style={{ textAlign: 'right' }}>
                           <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', width: '100%' }}>
                              Rate (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)
                           </span>
                        </th>
                        {customColumns.map(col => (
                           <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                        ))}
                        <th style={{ textAlign: 'center', width: 90 }}>Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {loading ? (
                        <tr><td colSpan={6 + customColumns.length} className="so-empty">
                           <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto 0.5rem' }} />
                           <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Loading prices...</div>
                        </td></tr>
                     ) : prices.length === 0 ? (
                        <tr><td colSpan={6 + customColumns.length} className="so-empty">
                           <Calculator size={36} style={{ margin: '0 auto 0.75rem', color: '#e2e8f0' }} />
                           <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>No price records found</div>
                           <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                              {selectedBranch ? `No prices set for "${selectedBranch}" branch yet.` : 'Try adjusting the filters above.'}
                           </div>
                        </td></tr>
                     ) : (
                        prices.map(p => {
                           const branch = branchFromPriceList(p.price_list);
                           const col = branch ? (branchColorMap[branch] || getBranchColor(0)) : { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
                           const isSelling = p.selling || p.price_list?.includes('Selling');
                           const isBuying = p.buying || p.price_list?.includes('Buying');
                           const isDeleting = deleting === p.name;

                           return (
                              <tr key={p.name} onClick={() => handleEdit(p)} style={{ cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}>
                                 {/* Item */}
                                 <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                       <div style={{ width: 34, height: 34, borderRadius: '0.45rem', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <Box size={15} />
                                       </div>
                                       <div>
                                          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>{p.item_name}</div>
                                          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#94a3b8', marginTop: '0.1rem' }}>
                                             {p.item_code}
                                             {p.brand && <span style={{ color: themeColor, marginLeft: '0.4rem' }}>• {p.brand}</span>}
                                          </div>
                                       </div>
                                    </div>
                                 </td>

                                 {/* Branch / Price List */}
                                 <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                       <span style={{ padding: '0.2rem 0.6rem', borderRadius: '0.35rem', background: col.bg, color: col.text, border: `1px solid ${col.border}`, fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', width: 'fit-content' }}>
                                          <Building2 size={10} />
                                          {branch || 'Standard'}
                                       </span>
                                       <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{p.uom}</div>
                                    </div>
                                 </td>

                                 {/* Type badge */}
                                 <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                                       {isSelling && (
                                          <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', background: '#f0fdf4', color: '#059669', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                             <TrendingUp size={9} /> SELL
                                          </span>
                                       )}
                                       {isBuying && (
                                          <span style={{ padding: '0.15rem 0.55rem', borderRadius: '9999px', background: '#fefce8', color: '#d97706', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                             <TrendingDown size={9} /> BUY
                                          </span>
                                       )}
                                    </div>
                                 </td>

                                 {/* Stock */}
                                 <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                       padding: '0.2rem 0.65rem', borderRadius: '9999px',
                                       background: (p.stock || 0) > 0 ? themeLight : '#fee2e2',
                                       color: (p.stock || 0) > 0 ? themeColor : '#ef4444',
                                       fontSize: '0.73rem', fontWeight: 800
                                    }}>
                                       {p.stock ?? 0}
                                    </span>
                                 </td>

                                 <td style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 900, color: themeColor, fontVariantNumeric: 'tabular-nums' }}>
                                       <DirhamIcon size={12} style={{ marginRight: '0.15rem', display: 'inline-block', verticalAlign: 'middle' }} />
                                       {Number(p.rate ?? p.price_list_rate ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                 </td>
                                 {customColumns.map(col => (
                                    <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                       {p[col] !== undefined && p[col] !== null ? String(p[col]) : '-'}
                                    </td>
                                 ))}
                                 {/* Actions */}
                                 <td onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                       <button
                                          onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                                          title="Edit"
                                          style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                                          onMouseEnter={e => { e.currentTarget.style.background = themeLight; e.currentTarget.style.color = themeColor; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                                       >
                                          <Edit2 size={14} />
                                       </button>
                                       <button
                                          onClick={(e) => handleDelete(p, e)}
                                          disabled={isDeleting}
                                          title="Delete"
                                          style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                                          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                                       >
                                          {isDeleting ? <Loader2 size={14} className="so-spinner" /> : <Trash2 size={14} />}
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>

               {/* Pagination */}
               <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                     Showing <b>{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</b>–<b>{Math.min(currentPage * pageSize, totalCount)}</b> of <b>{totalCount}</b>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                     <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.2rem', borderRadius: '0.5rem', gap: '0.1rem' }}>
                        {[20, 50, 100, 200].map(size => (
                           <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }}
                              style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', fontSize: '0.7rem', fontWeight: 800, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: pageSize === size ? themeColor : 'transparent', color: pageSize === size ? '#fff' : '#64748b' }}>
                              {size}
                           </button>
                        ))}
                     </div>
                     <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="so-page-btn">
                           <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '5rem', textAlign: 'center' }}>
                           Page {currentPage} / {totalPages || 1}
                        </span>
                        <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="so-page-btn">
                           <ChevronRight size={16} />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* ═══ Edit / New Modal ═══════════════════════════ */}
         {showForm && (
            <div className="so-modal-overlay">
               <div className="so-modal" style={{ maxWidth: '580px', borderRadius: '1rem' }}>
                  <div className="so-modal-header">
                     <h3 className="so-modal-title">{isEditMode ? 'Edit Price Record' : 'New Price Record'}</h3>
                     <button onClick={() => setShowForm(false)} className="so-modal-close"><X size={20} /></button>
                  </div>
                  <div className="so-modal-body" style={{ gap: '1.25rem', padding: '1.75rem' }}>

                     {/* Item selector */}
                     <div className="so-field">
                        <label className="so-label">Item / SKU</label>
                        {!isEditMode ? (
                           <div ref={dropdownRef} style={{ position: 'relative' }}>
                              <div onClick={() => setShowItemDropdown(!showItemDropdown)} className="so-input"
                                 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 700 }}>
                                 <span style={{ color: form.item_code ? '#1e293b' : '#94a3b8' }}>
                                    {form.item_code ? `${form.item_name} (${form.item_code})` : 'Select item...'}
                                 </span>
                                 <ChevronDown size={18} />
                              </div>
                              {showItemDropdown && (
                                 <div className="so-dropdown-portal">
                                    <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                       <input type="text" className="so-input" style={{ height: '2.4rem', fontSize: '0.8rem' }}
                                          placeholder="Search items..." autoFocus value={itemSearch}
                                          onChange={e => setItemSearch(e.target.value)} />
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                       {itemLoading
                                          ? <div style={{ padding: '1.5rem', textAlign: 'center' }}><Loader2 size={16} className="so-spinner" /></div>
                                          : items.length === 0
                                             ? <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>No results</div>
                                             : items.map(it => (
                                                <div key={it.value} onClick={() => handleItemSelect(it)} className="so-dropdown-item">
                                                   <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                      {it.image && <img src={it.image} style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
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
                              <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 4, fontWeight: 700 }}>Code: {form.item_code}</p>
                           </>
                        )}
                     </div>

                     {/* Price List + UOM */}
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="so-field">
                           <label className="so-label">Price List</label>
                           <select className="so-select" value={form.price_list}
                              onChange={e => setForm(f => ({ ...f, price_list: e.target.value, buying: e.target.value.includes('Buying') ? 1 : 0, selling: e.target.value.includes('Selling') ? 1 : 0 }))}>
                              {priceLists
                                 .filter(pl => isAdmin || !userBranch || branchFromPriceList(pl.name) === userBranch)
                                 .map(pl => <option key={pl.name} value={pl.name}>{pl.name}</option>)}
                           </select>
                        </div>
                        <div className="so-field">
                           <label className="so-label">UOM</label>
                           <select className="so-select" value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}>
                              {[form.uom, ...uoms].filter((v, i, a) => v && a.indexOf(v) === i).map(u => <option key={u} value={u}>{u}</option>)}
                           </select>
                        </div>
                     </div>

                     {/* Rate */}
                     <div className="so-field">
                        <label className="so-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                           Rate (<DirhamIcon size={10} style={{ display: 'inline-block' }} />)
                        </label>
                        <input
                           type="number" className="so-input"
                           style={{ height: '4rem', fontSize: '2rem', fontWeight: 800, color: themeColor, textAlign: 'center' }}
                           value={form.price_list_rate}
                           onChange={e => setForm(f => ({ ...f, price_list_rate: e.target.value }))}
                           onFocus={e => e.target.select()}
                        />
                     </div>

                     {/* Buying / Selling toggle */}
                     <div style={{ display: 'flex', gap: '1rem' }}>
                        {[{ key: 'buying', label: 'BUYING', activeColor: '#d97706', activeBg: '#fefce8' },
                          { key: 'selling', label: 'SELLING', activeColor: '#059669', activeBg: '#f0fdf4' }].map(({ key, label, activeColor, activeBg }) => (
                           <div key={key}
                              style={{ flex: 1, padding: '0.85rem', borderRadius: '0.6rem', border: `1.5px solid ${form[key] ? activeColor : '#e2e8f0'}`, background: form[key] ? activeBg : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                              onClick={() => setForm(f => ({ ...f, [key]: f[key] ? 0 : 1 }))}
                           >
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: form[key] ? activeColor : '#94a3b8' }}>{label}</span>
                              {form[key] ? <CheckCircle2 size={18} color={activeColor} /> : <AlertCircle size={18} color="#e2e8f0" />}
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="so-modal-footer">
                     <button onClick={() => setShowForm(false)} className="so-btn-secondary" style={{ padding: '0 1.5rem', height: '2.5rem' }}>Cancel</button>
                     <button onClick={handleSave} className="so-btn-primary" style={{ padding: '0 1.5rem', height: '2.5rem', background: themeColor }} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Price'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

export default ItemPriceList;