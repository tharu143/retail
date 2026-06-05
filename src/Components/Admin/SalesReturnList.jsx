import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, RotateCcw, Filter, ArrowRight, Check
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import './SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const renderCurrency = (currencyCode, size = 12, className = "") => {
  if (currencyCode === 'AED') {
    return <DirhamIcon size={size} className={className || "inline mr-0.5"} />;
  }
  return <span>{currencyCode} </span>;
};

const API_BASE = '/api/method/kyle_retail.retail_api.api';

function SalesReturnList() {
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
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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
  const customerSearchRef = useRef(null);
  const itemFilterRef = useRef(null);

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    if (view === 'list') {
      fetchReturns();
    }
  }, [view]);

  // Load Invoices when customer, dates, or item filters change in create mode
  useEffect(() => {
    if (view === 'create' && (selectedCustomer || selectedItemFilter)) {
      fetchInvoices();
    } else {
      setInvoices([]);
      setSelectedInvoice(null);
      setInvoiceItems([]);
      setReturnSelection({});
      setReturnQueue([]);
      setTotals({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
    }
  }, [view, selectedCustomer, fromDate, toDate, selectedItemFilter]);

  // Clear return queue when customer changes
  useEffect(() => {
    setReturnQueue([]);
    setTotals({ total: 0, total_taxes_and_charges: 0, grand_total: 0, taxes: [] });
  }, [selectedCustomer]);

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
      
      // F2/F3 -> Focus customer search dropdown
      if (e.key === 'F2' || e.key === 'F3') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Search customer"]');
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
  }, [view, selectedCustomer, selectedInvoice, returnQueue, selectedReturnDoc, fromDate, toDate, selectedItemFilter]);

  /* ────────────────────── BACKEND API WRAPPERS ────────────────────── */
  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_return_documents_retail`, {
        params: { doctype: 'Sales Invoice' }
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

  const fetchCustomers = async (search = '') => {
    try {
      const res = await axios.get(`${API_BASE}.get_customers_list`, {
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
    if (!selectedCustomer && !selectedItemFilter) return;
    try {
      setLoadingInvoices(true);
      const res = await axios.get(`${API_BASE}.get_invoices_for_return`, {
        params: {
          doctype: 'Sales Invoice',
          party_type: 'Customer',
          party_name: selectedCustomer?.name || undefined,
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

  const handleCustomerSelect = async (customer) => {
    if (returnQueue.length > 0 && selectedCustomer && selectedCustomer.name !== customer?.name) {
      const result = await Swal.fire({
        title: 'Clear Return Queue?',
        text: `The queue contains return items for ${selectedCustomer.customer_name || selectedCustomer.name}. Changing the customer will clear your queue. Do you want to proceed?`,
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
    setSelectedCustomer(customer);
  };

  const handleSelectInvoice = async (invoice) => {
    if (returnQueue.length > 0 && selectedCustomer && selectedCustomer.name !== invoice.party_name) {
      const result = await Swal.fire({
        title: 'Clear Return Queue?',
        text: `The queue contains return items for ${selectedCustomer.customer_name || selectedCustomer.name}. Selecting this invoice for a different customer (${invoice.party_name}) will clear your queue. Do you want to proceed?`,
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
    if (invoice.party_name && (!selectedCustomer || selectedCustomer.name !== invoice.party_name)) {
      setSelectedCustomer({ name: invoice.party_name, customer_name: invoice.party_name });
    }
    
    try {
      setLoadingItems(true);
      const res = await axios.get(`${API_BASE}.get_invoice_items_for_return`, {
        params: {
          doctype: 'Sales Invoice',
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
        doctype: 'Sales Invoice',
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
        doctype: 'Sales Invoice',
        source_name: returnQueue[0].parent,
        items: JSON.stringify(returnQueue)
      });
      
      const resData = res.data.message;
      if (resData && resData.status === 'success') {
        if (submitAfterSave) {
          // Submit doc status directly
          const submitRes = await axios.post(`${API_BASE}.handle_document_action`, {
            doctype: 'Sales Invoice',
            docname: resData.name,
            action: 'submit'
          });
          if (submitRes.data.message?.success) {
            Swal.fire('Success', 'Sales Return submitted successfully', 'success');
            setView('list');
          } else {
            throw new Error(submitRes.data.message?.message || 'Submission failed');
          }
        } else {
          Swal.fire('Success', 'Sales Return draft saved successfully', 'success');
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
      const res = await axios.get(`/api/resource/Sales Invoice/${name}`);
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
        text: 'This will finalize the Sales Return, update stocks (+), and refund/debit customer totals.',
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
        doctype: 'Sales Invoice',
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
        text: 'Clearing filters will reset the customer and clear your current return queue. Do you want to proceed?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: themeColor,
        confirmButtonText: 'Yes, Clear All',
        cancelButtonText: 'No, Keep Queue'
      });
      if (!result.isConfirmed) return;
    }
    setSelectedCustomer(null);
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
              r.customer_name?.toLowerCase().includes(q) || 
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
        .split-panel { height: calc(100vh - 270px); overflow-y: auto; }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="so-page animate-in fade-in duration-300">
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">
                <RotateCcw size={20} style={{ color: themeColor }} />
                Sales Returns
              </h1>
              <p className="so-page-subtitle">{returns.length} CREDIT VOUCHERS INDEXED</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={toggleTheme} className="so-btn-secondary" style={{ color: themeColor }}>
                <Palette size={14} /> {legacySubTheme.toUpperCase()}
              </button>
              <button className="so-btn-primary" onClick={() => setView('create')}>
                <Plus size={16} /> Initiate Credit Note
              </button>
            </div>
          </div>

          <div className="so-content">
            <div className="relative mb-6" style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="so-input"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="Search Credit ID, Customer or Original SINV..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th>Customer Node</th>
                      <th>Status</th>
                      <th>Original Invoice</th>
                      <th style={{ textAlign: 'right' }}>Credit Value</th>
                      <th style={{ textAlign: 'right' }}>Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                          <Loader2 size={32} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>
                          NO CREDIT SHARDS DETECTED
                        </td>
                      </tr>
                    ) : (
                      paginated.map(r => (
                        <tr key={r.name} onClick={() => loadReturnDetails(r.name)}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RotateCcw size={18} />
                              </div>
                              <div>
                                <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', margin: 0 }}>{r.customer_name}</p>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>{r.posting_date}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`so-badge ${r.status === 'Submitted' ? 'so-badge-submitted' : 'so-badge-draft'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>{r.return_against}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {renderCurrency(r.currency, 12)}
                              <span>{Math.abs(parseFloat(r.rounded_total || r.grand_total || r.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                              {r.name}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Section */}
              {totalPages > 1 && (
                <div className="so-pagination" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--so-border)' }}>
                  <span>
                    Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filtered.length, currentPage * pageSize)} of {filtered.length} entries
                  </span>
                  <div className="so-pagination-btns">
                    <button
                      disabled={currentPage === 1}
                      onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.max(1, p - 1)); }}
                      className="so-page-btn"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setCurrentPage(i + 1); }}
                        className={`so-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={(e) => { e.stopPropagation(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                      className="so-page-btn"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────── CREATE VIEW (WORKSPACE) ────────────────────── */}
      {view === 'create' && (
        <div className="so-page animate-in fade-in duration-300">
          {/* Header & Filter Controls */}
          <div className="so-page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => setView('list')} className="so-btn-secondary" style={{ padding: '0.5rem', minWidth: 'auto' }}>
                <ArrowLeft size={18} />
              </button>
              <div className="flex flex-col text-left">
                <h1 className="so-page-title" style={{ margin: 0 }}>Initiate Sales Return</h1>
                <p className="so-page-subtitle">BRANCH: {warehouse || 'NO BRANCH CONFIGURED'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={clearFilters} className="so-btn-secondary">
                Clear Filters (F5)
              </button>
              <button
                onClick={() => handleSaveReturn(false)}
                disabled={saving || !selectedInvoice}
                className="so-btn-secondary"
                style={{ color: '#475569' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft (F7)
              </button>
              <button
                onClick={() => handleSaveReturn(true)}
                disabled={saving || !selectedInvoice}
                className="so-btn-primary"
              >
                <ShieldCheck size={14} /> Submit Return (F12)
              </button>
            </div>
          </div>

          <div className="so-content">
            {/* Filters grid */}
            <div className="so-card mb-6">
              <div className="so-card-body">
                <div className="so-form-grid-4">
                  <div className="so-field">
                    <span className="so-label">Customer (F2/F3)</span>
                    <CustomSearchDropdown 
                      placeholder="Search customer..."
                      value={selectedCustomer}
                      onSelect={handleCustomerSelect}
                      fetchData={fetchCustomers}
                      optionsLabel="customer_name"
                      themeColor={themeColor}
                    />
                  </div>
                  <div className="so-field">
                    <span className="so-label">Start Date</span>
                    <input
                      type="date"
                      className="so-input"
                      style={{ height: '38px', padding: '0.5rem 0.75rem' }}
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="so-field">
                    <span className="so-label">End Date</span>
                    <input
                      type="date"
                      className="so-input"
                      style={{ height: '38px', padding: '0.5rem 0.75rem' }}
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                    />
                  </div>
                  <div className="so-field">
                    <span className="so-label">Filter by Item (F4)</span>
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
            <div className="grid grid-cols-12 gap-6">
              
              {/* Left Panel: Invoices List */}
              <div className="col-span-12 md:col-span-4 split-panel flex flex-col gap-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Matching Invoices ({invoices.length})</h3>
                {loadingInvoices ? (
                  <div className="flex flex-col items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                ) : (!selectedCustomer && !selectedItemFilter) ? (
                  <div className="so-card">
                    <div className="so-card-body text-center py-8">
                      <span className="text-xs font-bold text-slate-400 uppercase">Select a customer or item to view invoices</span>
                    </div>
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="so-card">
                    <div className="so-card-body text-center py-8">
                      <span className="text-xs font-bold text-slate-400 uppercase">No eligible invoices found</span>
                    </div>
                  </div>
                ) : (
                  invoices.map(inv => (
                    <div 
                      key={inv.name} 
                      onClick={() => handleSelectInvoice(inv)}
                      className={`so-card cursor-pointer transition-all hover:bg-slate-50/50 ${selectedInvoice?.name === inv.name ? 'border-2' : ''}`}
                      style={{ borderColor: selectedInvoice?.name === inv.name ? themeColor : undefined }}
                    >
                      <div className="so-card-body" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p className="font-bold text-sm text-slate-800" style={{ margin: 0 }}>{inv.name}</p>
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
                          <div className="font-black text-sm text-slate-800" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {renderCurrency(inv.currency, 12)}
                            <span>{inv.grand_total.toLocaleString()}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Select Invoice <ArrowRight size={10} className="inline ml-1" /></span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Panel: Selected Invoice items mapping */}
              <div className="col-span-12 md:col-span-8 split-panel">
                {!selectedInvoice ? (
                  <div className="so-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center' }}>
                    <Receipt size={48} className="text-slate-300 mb-4" />
                    <h2 className="text-base font-black text-slate-800 mb-1">No Invoice Selected</h2>
                    <p className="text-xs font-medium text-slate-400 max-w-sm">Please select a matching customer invoice from the left panel to load the returnable items mapping workspace.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Invoice Meta details */}
                    <div className="so-card">
                      <div className="so-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem' }}>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Selected original invoice</span>
                          <h2 className="text-base font-black text-slate-800" style={{ margin: 0 }}>{selectedInvoice.name}</h2>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">original value</span>
                          <div className="text-base font-black text-slate-800" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {renderCurrency(selectedInvoice.currency, 14)}
                            <span>{selectedInvoice.grand_total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Items Matrix */}
                    <div className="so-table-card">
                      <div className="so-table-wrapper">
                        <table className="so-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'center', width: '48px' }}>Select</th>
                              <th>Item Specification</th>
                              <th style={{ textAlign: 'center' }}>Original / Returned</th>
                              <th style={{ textAlign: 'center', width: '120px' }}>Return Qty</th>
                              <th style={{ textAlign: 'right' }}>Rate</th>
                              <th style={{ textAlign: 'right' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loadingItems ? (
                              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin text-slate-300" style={{ margin: '0 auto' }} /></td></tr>
                            ) : invoiceItems.map(item => {
                              const sel = returnSelection[item.name] || { checked: false, qty: 0 };
                              return (
                                <tr key={item.name} className={sel.checked ? 'bg-slate-50/30' : ''}>
                                  <td style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                      checked={sel.checked}
                                      onChange={e => handleItemSelectToggle(item.name, e.target.checked)}
                                      disabled={item.returnable_qty <= 0}
                                    />
                                  </td>
                                  <td>
                                    <p className="font-bold text-xs text-slate-800" style={{ margin: 0 }}>{item.item_name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] font-bold text-slate-400 fontFamily-monospace">{item.item_code}</span>
                                      <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1 rounded font-bold uppercase tracking-tight flex items-center gap-0.5">
                                        Stock +
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                                    <div>{item.qty} {item.uom}</div>
                                    {item.returned_qty > 0 && (
                                      <span className="text-[9px] text-red-500 font-bold">({item.returned_qty} Ret'd)</span>
                                    )}
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="so-td-input"
                                      style={{ textAlign: 'center', padding: '0.25rem 0.5rem' }}
                                      value={sel.qty || ''}
                                      placeholder="0"
                                      onChange={e => handleItemQtyChange(item.name, e.target.value)}
                                      disabled={!sel.checked || item.returnable_qty <= 0}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                      {renderCurrency(selectedInvoice.currency, 11)}
                                      <span>{(item.rate || 0).toFixed(2)}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontSize: '12px', fontWeight: 'black', color: '#0f172a' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                      {renderCurrency(selectedInvoice.currency, 11)}
                                      <span>{((sel.qty || 0) * (item.rate || 0)).toFixed(2)}</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Return Queue Summary Basket */}
                    {returnQueue.length > 0 && (
                      <div className="so-table-card">
                        <div className="so-card-header" style={{ padding: '0.75rem 1.25rem' }}>
                          <h5 className="so-card-title">Return Items Queue ({returnQueue.length})</h5>
                          <button
                            onClick={() => { setReturnQueue([]); setReturnSelection({}); }}
                            className="text-[10px] font-black text-red-500 uppercase tracking-wider hover:text-red-700 transition-colors bg-transparent border-0 cursor-pointer"
                          >
                            Clear Queue
                          </button>
                        </div>
                        <div className="so-table-wrapper">
                          <table className="so-table">
                            <thead>
                              <tr>
                                <th>Invoice</th>
                                <th>Item</th>
                                <th style={{ textAlign: 'center' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Rate</th>
                                <th style={{ textAlign: 'right' }}>Subtotal</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {returnQueue.map(item => (
                                <tr key={item.parent_detail_docname} style={{ cursor: 'default' }}>
                                  <td style={{ color: '#94a3b8', fontWeight: 'bold' }}>{item.parent}</td>
                                  <td>
                                    <p className="font-bold" style={{ margin: 0 }}>{item.item_name}</p>
                                    <span className="text-[10px] text-slate-400">{item.item_code}</span>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.qty} {item.uom}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                      {renderCurrency(selectedInvoice?.currency || 'AED', 11)}
                                      <span>{(item.rate || 0).toFixed(2)}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                      {renderCurrency(selectedInvoice?.currency || 'AED', 11)}
                                      <span>{(item.qty * (item.rate || 0)).toFixed(2)}</span>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      onClick={() => handleRemoveFromQueue(item.parent_detail_docname)}
                                      className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold bg-transparent border-0 cursor-pointer"
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div className="so-card">
                        <div className="so-card-header">
                          <h5 className="so-card-title">Fiscal Tax Reversals</h5>
                        </div>
                        <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {calculatingTotals ? (
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold"><Loader2 size={12} className="animate-spin" /> Recalculating tax matrix...</div>
                          ) : totals.taxes?.length === 0 ? (
                            <span className="text-xs font-bold text-slate-400 italic">No taxes charged in this return</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {totals.taxes?.map((t, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-500">
                                  <span>{t.description}</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    {renderCurrency(selectedInvoice.currency, 11)}
                                    <span>{Math.abs(t.tax_amount).toFixed(2)}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="so-card" style={{ background: '#0f172a', color: '#ffffff', borderColor: '#1e293b' }}>
                        <div className="so-card-header" style={{ borderColor: '#1e293b' }}>
                          <h5 className="so-card-title" style={{ color: '#94a3b8' }}>Credit Impact Summary</h5>
                        </div>
                        <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                            <span>Subtotal Impact</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <span>-</span>
                              {renderCurrency(selectedInvoice.currency, 11)}
                              <span>{Math.abs(totals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                            <span>Tax Reversal</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <span>-</span>
                              {renderCurrency(selectedInvoice.currency, 11)}
                              <span>{Math.abs(totals.total_taxes_and_charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </span>
                          </div>
                          <div className="h-px bg-slate-800 my-1" />
                          <div className="flex justify-between items-end">
                            <span className="text-xs font-black text-slate-300">Total Credit Value</span>
                            <span className="text-lg font-black text-white" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <span>-</span>
                              {renderCurrency(selectedInvoice.currency, 14)}
                              <span>{Math.abs(totals.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
        <div className="so-page animate-in fade-in duration-500">
          {/* 1. Page Header */}
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">
                <RotateCcw size={20} />
                {selectedReturnDoc.name || 'CREDIT_NOTE_DRAFT'}
              </h1>
              <p className="so-page-subtitle">
                Customer: {selectedReturnDoc.customer_name} | Against: {selectedReturnDoc.return_against}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {selectedReturnDoc.docstatus === 0 && (
                <>
                  <button
                    onClick={() => handleDocumentAction('delete')}
                    disabled={saving}
                    className="so-btn-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete Draft
                  </button>
                  <button
                    onClick={() => handleDocumentAction('save')}
                    disabled={saving}
                    className="so-btn-secondary"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Sync Draft
                  </button>
                  <button
                    onClick={() => handleDocumentAction('submit')}
                    disabled={saving}
                    className="so-btn-primary"
                    style={{ background: themeColor, borderColor: themeColor }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Finalize Return
                  </button>
                </>
              )}

              {selectedReturnDoc.docstatus === 1 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.10)', padding: '0.45rem 1rem', borderRadius: '0.375rem', border: '1px solid #10b98140' }}>
                    <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                    <span style={{ fontWeight: 800, fontSize: '11px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEDGER SUBMITTED</span>
                  </div>
                  <button
                    onClick={() => handleDocumentAction('cancel')}
                    disabled={saving}
                    className="so-btn-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Cancel Transaction
                  </button>
                </>
              )}

              <button
                onClick={() => setView('list')}
                className="so-btn-secondary"
                style={{ color: '#475569' }}
              >
                Back
              </button>
            </div>
          </div>

          {/* 2. Main Page Layout */}
          <div className="so-layout">
            <div className="so-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              {/* Summary Bar for Stats */}
              <div className="so-summary-bar">
                <div className="so-summary-item">
                  <span className="so-summary-label">Credit Valuation</span>
                  <span className="so-summary-value grand" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    {renderCurrency(selectedReturnDoc.currency, 14)}
                    <span>{Math.abs(selectedReturnDoc.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </span>
                </div>
                <div className="so-summary-divider" />
                <div className="so-summary-item">
                  <span className="so-summary-label">Quantity Returned</span>
                  <span className="so-summary-value">
                    {selectedReturnDoc.items ? selectedReturnDoc.items.reduce((acc, it) => acc + Math.abs(it.qty), 0) : 0} Units
                  </span>
                </div>
                <div className="so-summary-divider" />
                <div className="so-summary-item">
                  <span className="so-summary-label">Lifecycle Status</span>
                  <span className="so-badge" style={{
                    background: selectedReturnDoc.docstatus === 1 ? '#dcfce7' : (selectedReturnDoc.docstatus === 2 ? '#fee2e2' : '#fef9c3'),
                    color: selectedReturnDoc.docstatus === 1 ? '#156534' : (selectedReturnDoc.docstatus === 2 ? '#b91c1c' : '#854d0e'),
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '9999px',
                    textTransform: 'uppercase'
                  }}>
                    {selectedReturnDoc.docstatus === 1 ? 'Submitted' : (selectedReturnDoc.docstatus === 2 ? 'Cancelled' : 'Draft')}
                  </span>
                </div>
                <div className="so-summary-divider" />
                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                  <span className="so-summary-label">Posting Date</span>
                  <span className="so-summary-value" style={{ fontSize: '0.85rem' }}>{selectedReturnDoc.posting_date}</span>
                </div>
              </div>

              {/* Main Detail Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="so-card">
                  <div className="so-card-header">
                    <h5 className="so-card-title">Credit Properties</h5>
                  </div>
                  <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Customer</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{selectedReturnDoc.customer_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Original Sales Reference</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: themeColor }}>{selectedReturnDoc.return_against}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Update Stock</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{selectedReturnDoc.update_stock ? 'ENABLED' : 'DISABLED'}</span>
                    </div>
                  </div>
                </div>

                <div className="so-card">
                  <div className="so-card-header">
                    <h5 className="so-card-title">Credit Summary Impact</h5>
                  </div>
                  <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Net Asset Reversal</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {renderCurrency(selectedReturnDoc.currency, 12)}
                        <span>{Math.abs(selectedReturnDoc.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Fiscal Tax Reversal</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {renderCurrency(selectedReturnDoc.currency, 12)}
                        <span>{Math.abs(selectedReturnDoc.total_taxes_and_charges).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Total Credit Value</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: themeColor, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        {renderCurrency(selectedReturnDoc.currency, 14)}
                        <span>{Math.abs(selectedReturnDoc.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table Presentation */}
              <div className="so-table-card">
                <div className="so-card-header" style={{ padding: '0.75rem 1.25rem' }}>
                  <h5 className="so-card-title">Credit Item Matrix</h5>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>
                    {selectedReturnDoc.items ? selectedReturnDoc.items.length : 0} ACTIVE ITEMS
                  </span>
                </div>
                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th>Asset Specification</th>
                        <th style={{ textAlign: 'center' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Credit Rate</th>
                        <th style={{ textAlign: 'right' }}>Extension</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturnDoc.items?.map((item, idx) => (
                        <tr key={idx} style={{ cursor: 'default' }}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.item_code}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{item.item_name}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#475569' }}>
                            {Math.abs(item.qty)} <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{item.uom}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {renderCurrency(selectedReturnDoc.currency, 12)}
                              <span>{item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {renderCurrency(selectedReturnDoc.currency, 12)}
                              <span>{Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
     <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
     <span style={{ fontSize: '13px', fontWeight: 850, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
       <span>-</span>
       {renderCurrency(currency, 12)}
       <span>{Math.abs(value).toLocaleString()}</span>
     </span>
  </div>
);

const ParamRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
     <div style={{ height: '36px', width: '36px', borderRadius: '10px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <Icon size={16} />
     </div>
     <div>
        <p style={{ fontSize: '9px', fontWeight: 900, color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '1px' }}>{label}</p>
        <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{value}</p>
     </div>
  </div>
);

export default SalesReturnList;
