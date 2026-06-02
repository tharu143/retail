import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, RotateCw, Filter, ArrowRight, Check
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import './SalesOrder.css';

const API_BASE = '/api/method/kyle_retail.retail_api.api';

function PurchaseReturnList() {
  const { themeColor, themeLight, toggleTheme, legacySubTheme } = useLegacyTheme();
  const warehouse = useSelector((state) => state.user.warehouse);
  const company = useSelector((state) => state.user.company);
  
  // View States
  const [view, setView] = useState('list'); // 'list', 'create', 'detail'
  
  // Data States (List View)
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Create Flow Filters
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedItemFilter, setSelectedItemFilter] = useState(null);
  
  // Create Flow Invoices List & Workspace
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Selected Return Items & Quantities
  // Format: { [item_name_key]: { checked: boolean, qty: number } }
  const [returnSelection, setReturnSelection] = useState({});
  const [returnQueue, setReturnQueue] = useState([]);
  const [totals, setTotals] = useState({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
  const [calculatingTotals, setCalculatingTotals] = useState(false);
  
  // Saved Detail View State
  const [selectedReturnDoc, setSelectedReturnDoc] = useState(null);
  const [saving, setSaving] = useState(false);

  // Refs for shortcuts focus
  const supplierSearchRef = useRef(null);
  const itemFilterRef = useRef(null);

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    if (view === 'list') {
      fetchReturns();
    }
  }, [view]);

  // Load Invoices when supplier, dates, or item filters change in create mode
  useEffect(() => {
    if (view === 'create' && (selectedSupplier || selectedItemFilter)) {
      fetchInvoices();
    } else {
      setInvoices([]);
      setSelectedInvoice(null);
      setInvoiceItems([]);
      setReturnSelection({});
      setReturnQueue([]);
      setTotals({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
    }
  }, [view, selectedSupplier, fromDate, toDate, selectedItemFilter]);

  // Clear return queue when supplier changes
  useEffect(() => {
    setReturnQueue([]);
    setTotals({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
  }, [selectedSupplier]);

  // Recalculate totals on quantity or check changes in returnQueue
  useEffect(() => {
    if (view === 'create') {
      calculateLiveTotals();
    }
  }, [view, returnQueue]);

  /* ────────────────────── SHORTCUT KEYS ────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape -> Back to list or cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        setView('list');
      }
      
      // F2/F3 -> Focus supplier search dropdown
      if (e.key === 'F2' || e.key === 'F3') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Search supplier"]');
        input?.focus();
      }

      // F4 -> Focus item filter search dropdown
      if (e.key === 'F4') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Filter by item"]');
        input?.focus();
      }

      // F5 -> Clear filters
      if (e.key === 'F5') {
        e.preventDefault();
        clearFilters();
      }

      // F7 or Ctrl+S -> Save Return Draft
      if ((e.key === 'F7') || (e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        if (view === 'create' && returnQueue.length > 0) {
          handleSaveReturn();
        } else if (view === 'detail' && selectedReturnDoc?.docstatus === 0) {
          handleDocumentAction('save');
        }
      }

      // F12 or Ctrl+Enter -> Finalize / Submit Return
      if (e.key === 'F12' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (view === 'create' && returnQueue.length > 0) {
          handleSaveReturn(true); // Submit directly after save
        } else if (view === 'detail' && selectedReturnDoc?.docstatus === 0) {
          handleDocumentAction('submit');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, selectedSupplier, selectedInvoice, returnQueue, selectedReturnDoc, fromDate, toDate, selectedItemFilter]);

  /* ────────────────────── BACKEND API WRAPPERS ────────────────────── */
  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_return_documents_retail`, {
        params: { doctype: 'Purchase Invoice' }
      });
      const data = res.data.message?.data || res.data.message || [];
      setReturns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch returns', err);
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async (search = '') => {
    try {
      const res = await axios.get(`${API_BASE}.get_suppliers_list`, {
        params: { search, limit: 50, warehouse }
      });
      return res.data.message?.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const fetchBranchItems = async (search = '') => {
    try {
      const res = await axios.get(`${API_BASE}.search_items_in_branch`, {
        params: { search_term: search, warehouse }
      });
      return res.data.message?.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const fetchInvoices = async () => {
    if (!selectedSupplier && !selectedItemFilter) return;
    try {
      setLoadingInvoices(true);
      const res = await axios.get(`${API_BASE}.get_invoices_for_return`, {
        params: {
          doctype: 'Purchase Invoice',
          party_type: 'Supplier',
          party_name: selectedSupplier?.name || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          item_code: selectedItemFilter?.item_code || undefined,
          warehouse: warehouse || undefined
        }
      });
      setInvoices(res.data.message?.data || []);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSupplierSelect = async (supplier) => {
    if (returnQueue.length > 0 && selectedSupplier && selectedSupplier.name !== supplier?.name) {
      const result = await Swal.fire({
        title: 'Clear Return Queue?',
        text: `The queue contains return items for ${selectedSupplier.supplier_name || selectedSupplier.name}. Changing the supplier will clear your queue. Do you want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Clear and Change',
        cancelButtonText: 'No, Keep Current'
      });
      if (!result.isConfirmed) {
        return;
      }
    }
    setSelectedSupplier(supplier);
  };

  const handleSelectInvoice = async (invoice) => {
    if (returnQueue.length > 0 && selectedSupplier && selectedSupplier.name !== invoice.party_name) {
      const result = await Swal.fire({
        title: 'Clear Return Queue?',
        text: `The queue contains return items for ${selectedSupplier.supplier_name || selectedSupplier.name}. Selecting this invoice for a different supplier (${invoice.party_name}) will clear your queue. Do you want to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Clear and Change',
        cancelButtonText: 'No, Keep Current'
      });
      if (!result.isConfirmed) {
        return;
      }
    }

    setSelectedInvoice(invoice);
    setInvoiceItems([]);
    setReturnSelection({});
    if (invoice.party_name && (!selectedSupplier || selectedSupplier.name !== invoice.party_name)) {
      setSelectedSupplier({ name: invoice.party_name, supplier_name: invoice.party_name });
    }
    
    try {
      setLoadingItems(true);
      const res = await axios.get(`${API_BASE}.get_invoice_items_for_return`, {
        params: {
          doctype: 'Purchase Invoice',
          invoice_name: invoice.name
        }
      });
      const items = res.data.message?.data || [];
      setInvoiceItems(items);
      
      // Initialize return selections with default 0 return qtys or already queued qtys
      const initSelection = {};
      items.forEach(itm => {
        const queuedItem = returnQueue.find(q => q.parent_detail_docname === itm.name);
        initSelection[itm.name] = {
          checked: !!queuedItem,
          qty: queuedItem ? queuedItem.qty : 0,
          item_code: itm.item_code,
          parent_detail_docname: itm.name
        };
      });
      setReturnSelection(initSelection);
    } catch (err) {
      Swal.fire('Error', 'Failed to fetch invoice items', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  const calculateLiveTotals = async () => {
    if (!returnQueue.length) {
      setTotals({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
      return;
    }
    
    try {
      setCalculatingTotals(true);
      const res = await axios.post(`${API_BASE}.calculate_return_totals_retail`, {
        doctype: 'Purchase Invoice',
        source_name: returnQueue[0].parent,
        items: JSON.stringify(returnQueue)
      });
      if (res.data.message && res.data.message.status !== 'error') {
        setTotals(res.data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalculatingTotals(false);
    }
  };

  const handleSaveReturn = async (submitAfterSave = false) => {
    if (!returnQueue.length) {
      Swal.fire('Warning', 'Please select at least one item in the queue to return.', 'warning');
      return;
    }
    
    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}.make_custom_return_doc_retail`, {
        doctype: 'Purchase Invoice',
        source_name: returnQueue[0].parent,
        items: JSON.stringify(returnQueue)
      });
      
      const resData = res.data.message;
      if (resData && resData.status === 'success') {
        if (submitAfterSave) {
          // Submit doc status directly
          const submitRes = await axios.post(`${API_BASE}.handle_document_action`, {
            doctype: 'Purchase Invoice',
            docname: resData.name,
            action: 'submit'
          });
          if (submitRes.data.message?.success) {
            Swal.fire('Success', 'Purchase Return submitted successfully', 'success');
            setView('list');
          } else {
            throw new Error(submitRes.data.message?.message || 'Submission failed');
          }
        } else {
          Swal.fire('Success', 'Purchase Return draft saved successfully', 'success');
          loadReturnDetails(resData.name);
        }
      } else {
        throw new Error(resData?.message || 'Failed to create return document');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadReturnDetails = async (name) => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/resource/Purchase Invoice/${name}`);
      setSelectedReturnDoc(res.data.data);
      setView('detail');
    } catch (err) {
      Swal.fire('Error', 'Failed to load details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentAction = async (action) => {
    if (!selectedReturnDoc) return;
    
    if (action === 'submit') {
      const result = await Swal.fire({
        title: 'Confirm Submission',
        text: 'This will finalize the Purchase Return, update stocks (-), and debit the supplier account totals.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Submit'
      });
      if (!result.isConfirmed) return;
    }

    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}.handle_document_action`, {
        doctype: 'Purchase Invoice',
        docname: selectedReturnDoc.name,
        action: action
      });
      
      if (res.data.message?.success) {
        Swal.fire('Success', `Return ${action}ted successfully`, 'success');
        if (action === 'submit' || action === 'cancel' || action === 'delete') {
          setView('list');
        } else {
          loadReturnDetails(selectedReturnDoc.name);
        }
      } else {
        throw new Error(res.data.message?.message || 'Action failed');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = async () => {
    if (returnQueue.length > 0) {
      const result = await Swal.fire({
        title: 'Clear Return Queue?',
        text: 'Clearing filters will reset the supplier and clear your current return queue. Do you want to proceed?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Clear All',
        cancelButtonText: 'No, Keep Queue'
      });
      if (!result.isConfirmed) return;
    }
    setSelectedSupplier(null);
    setFromDate('');
    setToDate('');
    setSelectedItemFilter(null);
  };

  const handleItemSelectToggle = (itmId, checked) => {
    const originalItm = invoiceItems.find(i => i.name === itmId);
    if (!originalItm) return;
    
    const qty = checked ? originalItm.returnable_qty : 0;
    
    setReturnSelection(prev => ({
      ...prev,
      [itmId]: {
        ...prev[itmId],
        checked,
        qty
      }
    }));
    
    setReturnQueue(prevQueue => {
      const filtered = prevQueue.filter(q => q.parent_detail_docname !== itmId);
      if (checked && qty > 0) {
        return [
          ...filtered,
          {
            name: itmId,
            item_code: originalItm.item_code,
            item_name: originalItm.item_name,
            qty: qty,
            rate: originalItm.rate,
            uom: originalItm.uom,
            warehouse: originalItm.warehouse,
            parent: selectedInvoice.name,
            parent_detail_docname: itmId
          }
        ];
      }
      return filtered;
    });
  };

  const handleItemQtyChange = (itmId, val) => {
    const originalItm = invoiceItems.find(i => i.name === itmId);
    const maxQty = originalItm ? originalItm.returnable_qty : 0;
    let qty = parseFloat(val) || 0;
    
    if (qty > maxQty) {
      Swal.fire('Warning', `Cannot return more than remaining returnable qty: ${maxQty}`, 'warning');
      qty = maxQty;
    }
    if (qty < 0) qty = 0;

    setReturnSelection(prev => ({
      ...prev,
      [itmId]: {
        ...prev[itmId],
        qty,
        checked: qty > 0
      }
    }));
    
    setReturnQueue(prevQueue => {
      const filtered = prevQueue.filter(q => q.parent_detail_docname !== itmId);
      if (qty > 0) {
        return [
          ...filtered,
          {
            name: itmId,
            item_code: originalItm.item_code,
            item_name: originalItm.item_name,
            qty: qty,
            rate: originalItm.rate,
            uom: originalItm.uom,
            warehouse: originalItm.warehouse,
            parent: selectedInvoice.name,
            parent_detail_docname: itmId
          }
        ];
      }
      return filtered;
    });
  };

  const handleRemoveFromQueue = (itmId) => {
    setReturnQueue(prev => prev.filter(q => q.parent_detail_docname !== itmId));
    setReturnSelection(prev => {
      if (prev[itmId]) {
        return {
          ...prev,
          [itmId]: {
            ...prev[itmId],
            checked: false,
            qty: 0
          }
        };
      }
      return prev;
    });
  };

  const filtered = useMemo(() => {
    if (!Array.isArray(returns)) return [];
    return returns.filter(r => {
      const q = searchTerm.toLowerCase();
      return (r.name?.toLowerCase().includes(q) || 
              r.supplier_name?.toLowerCase().includes(q) || 
              r.return_against?.toLowerCase().includes(q));
    });
  }, [returns, searchTerm]);

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', position: 'relative', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .p-card { background: #fff; border-radius: 1.25rem; border: 1px solid #e2e8f0; transition: 0.2s; }
        .p-card:hover { border-color: ${themeColor}60; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .status-badge { padding: 4px 12px; border-radius: 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-action { height: 50px; padding: 0 1.5rem; border-radius: 12px; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: 0.2s; border: none; }
        .split-panel { height: calc(100vh - 270px); overflow-y: auto; }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="animate-in fade-in duration-300">
          <div style={{ padding: '2rem 3rem', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a' }}>
                  <RotateCw size={28} style={{ color: themeColor }} /> Purchase Returns
                </h1>
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>{returns.length} DEBIT VOUCHERS INDEXED</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={toggleTheme} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black bg-white hover:bg-slate-50 flex items-center gap-2" style={{ color: themeColor }}>
                  <Palette size={14} /> {legacySubTheme.toUpperCase()}
                </button>
                <button className="text-white rounded-xl text-xs font-black flex items-center gap-2 px-5 py-3 shadow-lg hover:opacity-90 transition-all active:scale-95" style={{ background: themeColor }} onClick={() => setView('create')}>
                  <Plus size={18} /> Initiate Debit Note
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem 3rem' }}>
            <div style={{ position: 'relative', marginBottom: '2rem' }}>
              <Search size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' }} />
              <input 
                style={{ width: '100%', height: '56px', borderRadius: '1rem', border: '1px solid #cbd5e1', paddingLeft: '3.75rem', fontSize: '14px', background: '#fff', fontWeight: 700, outline: 'none' }} 
                placeholder="Search Debit ID, Supplier or Original PINV..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table className="w-full border-collapse text-left">
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '1.25rem 2rem', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Supplier Node</th>
                    <th style={{ padding: '1.25rem', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '1.25rem', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Original Invoice</th>
                    <th style={{ padding: '1.25rem', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Debit Value</th>
                    <th style={{ padding: '1.25rem 2rem', fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '80px' }}><Loader2 size={40} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} /></td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '100px', color: '#cbd5e1', fontWeight: 800, fontSize: '16px' }}>NO DEBIT SHARDS DETECTED</td></tr>
                  ) : (
                    paginated.map(r => (
                      <tr key={r.name} onClick={() => loadReturnDetails(r.name)} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                        <td style={{ padding: '1.25rem 2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifycontent: 'center' }}>
                              <Building2 size={20} />
                            </div>
                            <div>
                              <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{r.supplier_name}</p>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>{r.posting_date}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${r.status === 'Submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>{r.return_against}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#334155', fontSize: '14px' }}>
                          {r.currency} {Math.abs(parseFloat(r.rounded_total || r.grand_total || r.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '2rem' }}><span style={{ fontWeight: 800, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>{r.name}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── CREATE VIEW (WORKSPACE) ────────────────────── */}
      {view === 'create' && (
        <div className="animate-in fade-in duration-300">
          {/* Header & Filter Controls */}
          <div style={{ padding: '1.5rem 3rem', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={() => setView('list')} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all border border-slate-200 bg-white"><ArrowLeft size={18} /></button>
                  <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Initiate Debit Note</h1>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>BRANCH: {warehouse || 'NO BRANCH CONFIGURED'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={clearFilters} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 bg-white">
                    Clear Filters (F5)
                  </button>
                  <button onClick={() => handleSaveReturn(false)} disabled={saving || !selectedInvoice} className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 border border-slate-300 bg-white flex items-center gap-1.5 disabled:opacity-50">
                    <Save size={16} /> Save Draft (F7)
                  </button>
                  <button onClick={() => handleSaveReturn(true)} disabled={saving || !selectedInvoice} className="px-6 py-2.5 rounded-xl text-xs font-black text-white hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50" style={{ background: themeColor }}>
                    <ShieldCheck size={16} /> Submit Return (F12)
                  </button>
                </div>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Supplier (F2/F3)</label>
                  <CustomSearchDropdown 
                    placeholder="Search supplier..."
                    value={selectedSupplier}
                    onSelect={handleSupplierSelect}
                    fetchData={fetchSuppliers}
                    optionsLabel="supplier_name"
                    themeColor={themeColor}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-slate-400 bg-white h-[34px]"
                    value={fromDate}
                    onChange={e => setFromDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">End Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-slate-400 bg-white h-[34px]"
                    value={toDate}
                    onChange={e => setToDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Filter by Item (F4)</label>
                  <CustomSearchDropdown 
                    placeholder="Filter by item..."
                    value={selectedItemFilter}
                    onSelect={setSelectedItemFilter}
                    fetchData={fetchBranchItems}
                    optionsLabel="item_name"
                    themeColor={themeColor}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Split Workspace */}
          <div style={{ maxWidth: '1600px', margin: '1.5rem auto', padding: '0 3rem' }}>
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Panel: Invoices List */}
              <div className="col-span-12 md:col-span-4 split-panel flex flex-col gap-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Matching Invoices ({invoices.length})</h3>
                {loadingInvoices ? (
                  <div className="flex flex-col items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                ) : (!selectedSupplier && !selectedItemFilter) ? (
                  <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase bg-white border border-slate-100 rounded-2xl">
                    Select a supplier or item to view invoices
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase bg-white border border-slate-100 rounded-2xl">
                    No eligible invoices found
                  </div>
                ) : (
                  invoices.map(inv => (
                    <div 
                      key={inv.name} 
                      onClick={() => handleSelectInvoice(inv)}
                      className={`p-card p-4 cursor-pointer flex justify-between items-center transition-all ${selectedInvoice?.name === inv.name ? 'border-2' : ''}`}
                      style={{ borderColor: selectedInvoice?.name === inv.name ? themeColor : undefined }}
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-800">{inv.name}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-[10px] font-bold text-slate-400">{inv.posting_date}</span>
                          {inv.party_name && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-bold">
                              {inv.party_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p className="font-black text-sm text-slate-800">{inv.currency} {inv.grand_total.toLocaleString()}</p>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Select Invoice <ArrowRight size={10} className="inline ml-1" /></span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Panel: Selected Invoice items mapping */}
              <div className="col-span-12 md:col-span-8 split-panel">
                {!selectedInvoice ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 text-center">
                    <Receipt size={48} className="text-slate-200 mb-4" />
                    <h2 className="text-base font-black text-slate-800 mb-1">No Invoice Selected</h2>
                    <p className="text-xs font-medium text-slate-400 max-w-sm">Please select a matching supplier invoice from the left panel to load the returnable items mapping workspace.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Invoice Meta details */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selected original invoice</span>
                        <h2 className="text-base font-black text-slate-800">{selectedInvoice.name}</h2>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">original value</span>
                        <p className="text-base font-black text-slate-800">{selectedInvoice.currency} {selectedInvoice.grand_total.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Items Matrix */}
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                      <table className="w-full border-collapse text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center w-12">Select</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Item Specification</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center w-28">Original / Returned</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center w-28">Return Qty</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right w-24">Rate</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right w-28">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {loadingItems ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px' }}><Loader2 size={32} className="animate-spin text-slate-300" style={{ margin: '0 auto' }} /></td></tr>
                          ) : invoiceItems.map(item => {
                            const sel = returnSelection[item.name] || { checked: false, qty: 0 };
                            return (
                              <tr key={item.name} className={sel.checked ? 'bg-slate-50/30' : ''}>
                                <td className="p-4 text-center">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                    checked={sel.checked}
                                    onChange={e => handleItemSelectToggle(item.name, e.target.checked)}
                                    disabled={item.returnable_qty <= 0}
                                  />
                                </td>
                                <td className="p-4">
                                  <p className="font-bold text-xs text-slate-800">{item.item_name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 fontFamily-monospace">{item.item_code}</span>
                                    <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 px-1 rounded font-bold uppercase tracking-tight flex items-center gap-0.5">
                                      Stock -
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 text-center text-xs font-bold text-slate-500">
                                  <div>{item.qty} {item.uom}</div>
                                  {item.returned_qty > 0 && (
                                    <span className="text-[9px] text-red-500 font-bold">({item.returned_qty} Ret'd)</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <input 
                                    type="number"
                                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800 text-center outline-none focus:border-slate-400 bg-white"
                                    value={sel.qty || ''}
                                    placeholder="0"
                                    onChange={e => handleItemQtyChange(item.name, e.target.value)}
                                    disabled={!sel.checked || item.returnable_qty <= 0}
                                  />
                                </td>
                                <td className="p-4 text-right text-xs font-bold text-slate-600">
                                  {selectedInvoice.currency} {(item.rate || 0).toFixed(2)}
                                </td>
                                <td className="p-4 text-right text-xs font-black text-slate-800">
                                  {selectedInvoice.currency} {((sel.qty || 0) * (item.rate || 0)).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Return Queue Summary Basket */}
                    {returnQueue.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Return Items Queue ({returnQueue.length})</h3>
                          <button 
                            onClick={() => { setReturnQueue([]); setReturnSelection({}); }}
                            className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:text-red-700 transition-colors"
                          >
                            Clear Queue
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400">
                                <th className="p-2 w-28">Invoice</th>
                                <th className="p-2">Item</th>
                                <th className="p-2 text-center w-24">Qty</th>
                                <th className="p-2 text-right w-24">Rate</th>
                                <th className="p-2 text-right w-28">Subtotal</th>
                                <th className="p-2 text-center w-12">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              {returnQueue.map(item => (
                                <tr key={item.parent_detail_docname}>
                                  <td className="p-2 text-slate-400 font-bold">{item.parent}</td>
                                  <td className="p-2">
                                    <p className="font-bold">{item.item_name}</p>
                                    <span className="text-[9px] text-slate-400">{item.item_code}</span>
                                  </td>
                                  <td className="p-2 text-center">{item.qty} {item.uom}</td>
                                  <td className="p-2 text-right">{selectedInvoice?.currency || 'AED'} {(item.rate || 0).toFixed(2)}</td>
                                  <td className="p-2 text-right">{selectedInvoice?.currency || 'AED'} {(item.qty * (item.rate || 0)).toFixed(2)}</td>
                                  <td className="p-2 text-center">
                                    <button 
                                      onClick={() => handleRemoveFromQueue(item.parent_detail_docname)}
                                      className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Financial vector totals summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-center">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Fiscal Tax Reversals</h4>
                        {calculatingTotals ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Loader2 size={12} className="animate-spin" /> Recalculating tax matrix...</div>
                        ) : totals.taxes?.length === 0 ? (
                          <span className="text-xs font-bold text-slate-400 italic">No taxes charged in this return</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {totals.taxes?.map((t, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-500">
                                <span>{t.description}</span>
                                <span>{selectedInvoice.currency} {Math.abs(t.tax_amount).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 p-6 rounded-2xl text-white">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Debit Impact Summary</span>
                        <div className="flex flex-col gap-3 mt-4">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                            <span>Subtotal Impact</span>
                            <span>{selectedInvoice.currency} {Math.abs(totals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                            <span>Tax Reversal</span>
                            <span>{selectedInvoice.currency} {Math.abs(totals.total_taxes_and_charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="h-px bg-slate-800 my-1" />
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-black text-slate-300">Total Debit Value</span>
                            <span className="text-lg font-black text-white">
                              {selectedInvoice.currency} {Math.abs(totals.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── DETAIL VIEW (SUBMITTED / DRAFT DETAILS) ────────────────────── */}
      {view === 'detail' && selectedReturnDoc && (
        <div className="animate-in fade-in duration-500" style={{ minHeight: '100vh', background: '#fff' }}>
           <div style={{ background: '#0f172a', padding: '3rem 4rem 2rem', color: '#fff' }}>
              <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <div style={{ display: 'flex', gap: '2rem' }}>
                    <button onClick={() => setView('list')} className="p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-all">
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                           <span style={{ background: '#6366f1', color: '#fff', padding: '3px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>Purchase Return (Debit Note)</span>
                           <span style={{ height: '1.5px', width: '24px', background: 'rgba(255,255,255,0.2)' }} />
                           <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>Against: {selectedReturnDoc.return_against}</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-0.03em', lineHeight: 1 }}>{selectedReturnDoc.supplier_name}</h1>
                        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: '12px' }}>ID: {selectedReturnDoc.name || 'DEBIT_NOTE_DRAFT'}</p>
                    </div>
                 </div>
                 
                 {selectedReturnDoc.docstatus === 0 && (
                   <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={() => handleDocumentAction('delete')} disabled={saving} className="btn-action" style={{ background: '#1e293b', color: '#ef4444', border: '2px solid rgba(239,68,68,0.2)' }}>
                         {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={16} />} Delete Draft
                      </button>
                      <button onClick={() => handleDocumentAction('save')} disabled={saving} className="btn-action" style={{ background: '#1e293b', color: '#fff', border: '2px solid rgba(255,255,255,0.1)' }}>
                         {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={16} />} Sync Draft
                      </button>
                      <button onClick={() => handleDocumentAction('submit')} disabled={saving} className="btn-action" style={{ background: themeColor, color: '#fff' }}>
                         {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={16} />} Finalize Debit
                      </button>
                   </div>
                 )}

                 {selectedReturnDoc.docstatus === 1 && (
                   <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.15)', padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1.5px solid #10b98140' }}>
                         <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                         <span style={{ fontWeight: 900, fontSize: '12px', color: '#10b981', tracking: '0.05em' }}>LEDGER SUBMITTED</span>
                      </div>
                      <button onClick={() => handleDocumentAction('cancel')} disabled={saving} className="btn-action" style={{ background: '#fef2f2', color: '#ef4444', border: '2px solid #fee2e2' }}>
                         {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={16} />} Cancel Transaction
                      </button>
                   </div>
                 )}
              </div>
           </div>

           <div style={{ maxWidth: '1600px', margin: '3rem auto', padding: '0 4rem 4rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem' }}>
                 
                 {/* Item List Shard */}
                 <div>
                    <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>Debit Item Matrix</h3>
                    <div style={{ background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                       <table className="w-full border-collapse text-left">
                          <thead style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                             <tr>
                                <th style={{ padding: '1.25rem 2rem', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Asset Specification</th>
                                <th style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Quantity</th>
                                <th style={{ textAlign: 'right', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Credit Rate</th>
                                <th style={{ textAlign: 'right', paddingRight: '2rem', fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>Extension</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {selectedReturnDoc.items?.map((item, idx) => (
                                <tr key={idx}>
                                   <td style={{ padding: '1.25rem 2rem' }}>
                                      <p style={{ fontWeight: 800, color: '#1e293b', fontSize: '13px' }}>{item.item_name}</p>
                                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', fontFamily: 'monospace' }}>{item.item_code}</span>
                                   </td>
                                   <td style={{ textAlign: 'center', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                                      {Math.abs(item.qty)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>{item.uom}</span>
                                   </td>
                                   <td style={{ textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '13px' }}>
                                      {selectedReturnDoc.currency} {item.rate.toLocaleString()}
                                   </td>
                                   <td style={{ textAlign: 'right', paddingRight: '2rem', fontWeight: 800, color: '#1e293b', fontSize: '13px' }}>
                                      {selectedReturnDoc.currency} {Math.abs(item.amount).toLocaleString()}
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Financial Vector Shard */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#1e293b', padding: '2.5rem', borderRadius: '2rem', color: '#fff' }}>
                       <h4 style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '1.5rem', tracking: '0.1em' }}>Financial Debit Impact</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <FinRow label="Net Asset Reversal" value={selectedReturnDoc.total} currency={selectedReturnDoc.currency} />
                          <FinRow label="Fiscal Tax Reversal" value={selectedReturnDoc.total_taxes_and_charges} currency={selectedReturnDoc.currency} />
                          <div style={{ height: '1.5px', background: 'rgba(255,255,255,0.05)', margin: '0.5rem 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>Total Debit Value</span>
                             <span style={{ fontSize: '2rem', fontWeight: 950, letterSpacing: '-0.03em', color: '#fff' }}>
                                {selectedReturnDoc.currency} {Math.abs(selectedReturnDoc.grand_total).toLocaleString()}
                             </span>
                          </div>
                       </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '2rem', border: '1px solid #f1f5f9' }}>
                       <h4 style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1.5rem', tracking: '0.1em' }}>Ledger Parameters</h4>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <ParamRow icon={Calendar} label="Posting Date" value={selectedReturnDoc.posting_date} />
                          <ParamRow icon={Hash} label="Original Purchase Reference" value={selectedReturnDoc.return_against} />
                          <ParamRow icon={Layers} label="Update Stock" value={selectedReturnDoc.update_stock ? 'ENABLED' : 'DISABLED'} />
                       </div>
                    </div>
                 </div>

              </div>
           </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */
const FinRow = ({ label, value, currency }) => (
  <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
     <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
     <span style={{ fontSize: '13px', fontWeight: 850 }}>{currency} {Math.abs(value).toLocaleString()}</span>
  </div>
);

const ParamRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
     <div style={{ height: '36px', width: '36px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifycontent: 'center', color: '#94a3b8' }}>
        <Icon size={16} />
     </div>
     <div>
        <p style={{ fontSize: '9px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</p>
        <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{value}</p>
     </div>
  </div>
);

export default PurchaseReturnList;

