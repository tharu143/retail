// src/Components/Admin/ItemPriceList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Tag, Filter, Eye, Edit2, Trash2, 
  Loader2, ChevronLeft, ChevronRight, Warehouse, Scale,
  Box, ShieldCheck, MapPin, Calculator, Barcode
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import NavBar from '../Nav/NavBar';

function ItemPriceList() {
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
  }, [pollTheme]);

  // Filter Warehouse State
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', item_code: '', item_name: '', uom: 'Nos', 
    price_list: 'Standard Selling', buying: 0, selling: 1, 
    price_list_rate: 0, currency: 'AED'
  });

  // Fetch Metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_warehouses', { withCredentials: true });
        setWarehouses(res.data.message || []);
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
        filters: JSON.stringify({ warehouse: selectedWarehouse || null })
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

  useEffect(() => {
    fetchPriceRecords();
  }, [currentPage, pageSize, selectedWarehouse]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
       if (currentPage === 1) fetchPriceRecords();
       else setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
      price_list_rate: p.price_list_rate,
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

  return (
    <div className="so-page" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <NavBar />

      {/* Modern Report Header */}
      <div style={{ padding: '2.5rem 3rem', background: 'white', borderBottom: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1600px', margin: '0 auto' }}>
           <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: `${themeColor}10`, color: themeColor, borderRadius: '12px' }}><Scale size={24} /></div>
                <div>
                   <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', margin: 0, tracking: '-0.02em' }}>PRICE MASTER</h1>
                   <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>Global Pricing Reports & Inventory Valuation</p>
                </div>
             </div>
           </div>

           <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setPollTheme(isGreen ? 'blue' : 'green')}
                style={{ padding: '0 1.5rem', height: '3.5rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase' }}
              >
                THEME: {pollTheme}
              </button>
              <button onClick={() => { setForm({ item_code: '', item_name: '', uom: 'Nos', price_list: 'Standard Selling', buying: 0, selling: 1, price_list_rate: 0, currency: 'AED' }); setIsEditMode(false); setShowForm(true); }} className="so-btn-primary" style={{ padding: '0 2rem', height: '3.5rem', background: themeColor, gap: '10px', boxShadow: `0 10px 20px ${themeColor}20` }}>
                <Plus size={20} /> INITIALIZE NEW RATE
              </button>
           </div>
        </div>
      </div>

      <div style={{ padding: '2rem 3rem', maxWidth: '1600px', margin: '0 auto' }}>
         {/* Advanced Filters */}
         <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', border: '1px solid #e2e8f0', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-end', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ flex: 1 }}>
               <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Search Catalog</label>
               <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                  <input 
                    type="text" 
                    placeholder="Search by code, name or brand..." 
                    className="so-filter-input" 
                    style={{ paddingLeft: '45px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', height: '3.5rem', fontSize: '0.9rem' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
               </div>
            </div>

            <div style={{ width: '300px' }}>
               <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Warehouse Inventory View</label>
               <div style={{ position: 'relative' }}>
                  <Warehouse size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
                  <select 
                    className="so-filter-input" 
                    style={{ paddingLeft: '45px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', width: '100%', height: '3.5rem', appearance: 'none', cursor: 'pointer' }}
                    value={selectedWarehouse}
                    onChange={e => setSelectedWarehouse(e.target.value)}
                  >
                     <option value="">Global (Total Stock)</option>
                     {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                  </select>
               </div>
            </div>

            <button 
              onClick={() => { setSearchTerm(''); setSelectedWarehouse(''); setCurrentPage(1); }}
              style={{ background: '#fef2f2', color: '#ef4444', padding: '0 1.5rem', height: '3.5rem', border: 'none', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
            >
              RESET
            </button>
         </div>

         {/* Report Table */}
         <div style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
               <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                     <th style={{ padding: '1.5rem 2rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Item Identification</th>
                     <th style={{ padding: '1.5rem 2rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Registry Info</th>
                     <th style={{ padding: '1.5rem 2rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>On-Hand Stock</th>
                     <th style={{ padding: '1.5rem 2rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Valuation (AED)</th>
                     <th style={{ padding: '1.5rem 2rem', width: '100px' }}></th>
                  </tr>
               </thead>
               <tbody>
                  {loading ? (
                     <tr><td colSpan="5" style={{ padding: '10rem', textAlign: 'center' }}><Loader2 size={48} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} /></td></tr>
                  ) : prices.length === 0 ? (
                     <tr><td colSpan="5" style={{ padding: '10rem', textAlign: 'center' }}>
                        <Calculator size={64} style={{ margin: '0 auto', opacity: 0.1, marginBottom: '1.5rem' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>Zero results for current criteria</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>Try broadening your search or switching warehouses.</p>
                     </td></tr>
                  ) : prices.map(p => (
                     <tr key={p.name} style={{ borderBottom: '1px solid #f8fafc', transition: 'all 0.2s' }} className="hover:bg-slate-50">
                        <td style={{ padding: '1.5rem 2rem' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Box size={20} style={{ color: '#94a3b8' }} /></div>
                              <div>
                                 <p style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b', marginBottom: '2px' }}>{p.item_name}</p>
                                 <div style={{ display: 'flex', gap: '10px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>{p.item_code}</span>
                                    {p.brand && <span style={{ fontSize: '0.7rem', color: themeColor, fontWeight: 900, background: `${themeColor}10`, padding: '1px 6px', borderRadius: '4px' }}>{p.brand}</span>}
                                 </div>
                              </div>
                           </div>
                        </td>
                        <td style={{ padding: '1.5rem 2rem' }}>
                           <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 800, color: '#475569', fontSize: '0.9rem' }}>{p.price_list}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{p.uom} Units</span>
                           </div>
                        </td>
                        <td style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
                           <span style={{ 
                             padding: '6px 16px', 
                             borderRadius: '12px', 
                             background: p.actual_qty > 0 ? '#dcfce7' : '#fee2e2', 
                             color: p.actual_qty > 0 ? '#166534' : '#ef4444',
                             fontSize: '1.1rem',
                             fontWeight: 950
                           }}>
                              {p.actual_qty || 0}
                           </span>
                        </td>
                        <td style={{ padding: '1.5rem 2rem', textAlign: 'right' }}>
                           <p style={{ fontSize: '1.25rem', fontWeight: 950, color: themeColor, margin: 0 }}>
                              {Number(p.price_list_rate || 0).toFixed(2)}
                           </p>
                           <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Standard Core Rate</p>
                        </td>
                        <td style={{ padding: '1.5rem 2rem', textAlign: 'right' }}>
                           <button onClick={() => handleEdit(p)} style={{ width: '40px', height: '40px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover:border-blue-500 hover:text-blue-500">
                             <Edit2 size={16} />
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>

            {/* Pagination UI */}
            <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Showing <b>{(currentPage - 1) * pageSize + 1}</b> to <b>{Math.min(currentPage * pageSize, totalCount)}</b> of {totalCount} price records</span>
               <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ width: '40px', height: '40px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: currentPage === 1 ? 'default' : 'pointer' }}><ChevronLeft size={20} /></button>
                  <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * pageSize >= totalCount} style={{ width: '40px', height: '40px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: currentPage * pageSize >= totalCount ? 'default' : 'pointer' }}><ChevronRight size={20} /></button>
               </div>
            </div>
         </div>
      </div>

      {/* Modern Modal View (Page-like) */}
      {showForm && (
         <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ background: 'white', width: '550px', borderRadius: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                <div style={{ padding: '2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '8px', background: `${themeColor}15`, color: themeColor, borderRadius: '8px' }}><Edit2 size={20} /></div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{isEditMode ? 'Modify Price Registry' : 'New Price Definition'}</h3>
                   </div>
                   <button onClick={() => setShowForm(false)} style={{ color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div style={{ padding: '2.5rem' }}>
                   <div style={{ display: 'grid', gap: '1.5rem' }}>
                      <div className="so-field">
                        <label className="so-label">Target Item / SKU</label>
                        <input type="text" className="so-input" value={form.item_name} disabled style={{ background: '#f8fafc', fontWeight: 800 }} />
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontWeight: 700 }}>Code: {form.item_code}</p>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="so-field">
                          <label className="so-label">Price List</label>
                          <select className="so-input" value={form.price_list} onChange={e => setForm({...form, price_list: e.target.value})}>
                             <option value="Standard Selling">Standard Selling</option>
                             <option value="Standard Buying">Standard Buying</option>
                          </select>
                        </div>
                        <div className="so-field">
                          <label className="so-label">Unit (UOM)</label>
                          <input type="text" className="so-input" value={form.uom} onChange={e => setForm({...form, uom: e.target.value})} />
                        </div>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Price Rate (AED)</label>
                        <input 
                           type="number" 
                           className="so-input" 
                           style={{ height: '5rem', fontSize: '2.5rem', fontWeight: 950, color: themeColor, textAlign: 'center' }} 
                           value={form.price_list_rate} 
                           onChange={e => setForm({...form, price_list_rate: e.target.value})} 
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '1rem' }}>
                         <div style={{ flex: 1, padding: '1.5rem', borderRadius: '1.5rem', border: `2px solid ${form.buying ? '#fef3c7' : '#f1f5f9'}`, background: form.buying ? '#fefce8' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: form.buying ? '#d97706' : '#94a3b8' }}>BUYING</span>
                            <input type="checkbox" checked={form.buying === 1} onChange={e => setForm({...form, buying: e.target.checked ? 1 : 0})} />
                         </div>
                         <div style={{ flex: 1, padding: '1.5rem', borderRadius: '1.5rem', border: `2px solid ${form.selling ? '#dcfce7' : '#f1f5f9'}`, background: form.selling ? '#f0fdf4' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: form.selling ? '#166534' : '#94a3b8' }}>SELLING</span>
                            <input type="checkbox" checked={form.selling === 1} onChange={e => setForm({...form, selling: e.target.checked ? 1 : 0})} />
                         </div>
                      </div>
                   </div>
                </div>

                <div style={{ padding: '2rem', background: '#f8fafc', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                   <button onClick={() => setShowForm(false)} className="so-btn-secondary" style={{ padding: '0 2rem', height: '3.5rem' }}>Cancel</button>
                   <button onClick={handleSave} className="so-btn-primary" style={{ padding: '0 2rem', height: '3.5rem', background: themeColor, fontWeight: 900 }} disabled={saving}>
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