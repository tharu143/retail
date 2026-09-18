import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2, ShoppingCart, Receipt, Calendar, AlertCircle, Activity, Settings,
  Edit, ArrowLeft, Trash2, Edit2, Package, ChevronDown, ChevronRight as ChevronRightIcon, MapPin, User, Layers, Shield, CheckCircle2, Hash, TrendingUp, CreditCard, Clock, Globe, ShieldCheck, UserPlus, FileText, CheckCircle, AlertTriangle, Building2, UserCircle2, Briefcase, Award, Percent, DollarSign, Image as ImageIcon, HeartPulse, HardDrive, Smartphone, Zap, RotateCw, Filter, ArrowRight, Check,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import AttachmentSection from './AttachmentSection';
import ListCustomizer from './ListCustomizer';

const renderCurrency = (currencyCode, size = 12, className = "") => {
  if (currencyCode === 'AED') {
    return <DirhamIcon size={size} className={className || "inline mr-0.5"} />;
  }
  return <span>{currencyCode} </span>;
};

const API_BASE = '/api/method/kyle_retail.retail_api.api';

function PurchaseReturnList() {
  const { toggleTheme, legacySubTheme } = useLegacyTheme();
  const themeColor = '#b91c1c';
  const themeLight = '#fef2f2';
  const themeColorHover = '#7f1d1d';
  const warehouse = useSelector((state) => state.user.warehouse);
  const company = useSelector((state) => state.user.company);

  // View States
  const [view, setView] = useState('list'); // 'list', 'create', 'detail'

  const DEFAULT_PRTN_LIST_COLUMNS = [
    { key: 'supplier_name', label: 'Supplier Node' },
    { key: 'status', label: 'Status' },
    { key: 'return_against', label: 'Original Invoice' },
    { key: 'grand_total', label: 'Debit Value' },
    { key: 'name', label: 'Key' }
  ];

  const [hiddenDefaults, setHiddenDefaults] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Return`;
      const saved = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Return');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.hiddenDefaults)) return parsed.hiddenDefaults;
      }
    } catch (e) {}
    return [];
  });

  // Data States (List View)
  const [customColumns, setCustomColumns] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Return`;
      const savedConfig = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Return');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed.customColumns)) return parsed.customColumns;
      }
      const saved = localStorage.getItem(`custom_columns_${user}_Purchase Return`) || localStorage.getItem('custom_columns_Purchase Return');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const getTodayDate = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
  };

  const [filterDateFrom, setFilterDateFrom] = useState(() => getTodayDate());
  const [filterDateTo, setFilterDateTo] = useState(() => getTodayDate());

  // Create Flow Filters
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [fromDate, setFromDate] = useState(() => getTodayDate());
  const [toDate, setToDate] = useState(() => getTodayDate());
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

  // Item Search Modal State (Phase 3)
  const [showItemSearchModal, setShowItemSearchModal] = useState(false);
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [searchingItemInvoices, setSearchingItemInvoices] = useState(false);
  const [selectedModalItems, setSelectedModalItems] = useState({});

  // Refs for shortcuts focus
  const supplierSearchRef = useRef(null);
  const itemFilterRef = useRef(null);

  /* ────────────────────── INITIALIZATION ────────────────────── */
  useEffect(() => {
    if (view === 'list') {
      fetchReturns();
    }
  }, [view, customColumns]);

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
        params: { 
          doctype: 'Purchase Invoice',
          extra_fields: JSON.stringify(customColumns)
        }
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

  // Phase 3: Fetch item history
  const fetchItemHistory = async (item_code) => {
    try {
      setSelectedModalItems({});
      setSearchingItemInvoices(true);
      setShowItemSearchModal(true);
      const res = await axios.get(`${API_BASE}.get_item_history_for_return`, {
        params: {
          doctype: 'Purchase Invoice',
          item_code: item_code,
          party_type: 'Supplier',
          party_name: selectedSupplier?.name || undefined,
          warehouse: warehouse || undefined
        }
      });
      setItemSearchResults(res.data.message?.data || []);
    } catch (err) {
      console.error(err);
      setItemSearchResults([]);
    } finally {
      setSearchingItemInvoices(false);
    }
  };

  const handleSelectItemFromHistory = (itemRow) => {
    setReturnQueue(prev => {
      if (prev.find(q => q.parent_detail_docname === itemRow.parent_detail_docname)) {
        Swal.fire('Info', 'This item from this invoice is already in the return queue.', 'info');
        return prev;
      }
      return [...prev, {
        name: itemRow.parent_detail_docname,
        item_code: itemRow.item_code,
        item_name: itemRow.item_name,
        qty: itemRow.returnable_qty,
        rate: itemRow.rate,
        uom: itemRow.uom,
        warehouse: itemRow.warehouse,
        parent: itemRow.parent,
        parent_detail_docname: itemRow.parent_detail_docname
      }];
    });
    
    // Also update selection state to reflect checked status if we happen to load this invoice
    setReturnSelection(prev => ({
      ...prev,
      [itemRow.parent_detail_docname]: {
        checked: true,
        qty: itemRow.returnable_qty
      }
    }));
    
    setSelectedItemFilter(null);
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

  // Sorting
  const [sortField, setSortField] = useState('posting_date');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.6, marginLeft: '4px', verticalAlign: 'middle' }} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={13} style={{ color: '#ffffff', marginLeft: '4px', verticalAlign: 'middle' }} />
      : <ArrowDown size={13} style={{ color: '#ffffff', marginLeft: '4px', verticalAlign: 'middle' }} />;
  };

  const sortedReturns = useMemo(() => {
    let list = [...returns];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r => (
        r.name?.toLowerCase().includes(q) ||
        r.supplier_name?.toLowerCase().includes(q) ||
        r.return_against?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      ));
    }
    if (filterDateFrom) {
      list = list.filter(r => String(r.posting_date || '').slice(0, 10) >= String(filterDateFrom).slice(0, 10));
    }
    if (filterDateTo) {
      list = list.filter(r => String(r.posting_date || '').slice(0, 10) <= String(filterDateTo).slice(0, 10));
    }
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [returns, searchTerm, filterDateFrom, filterDateTo, sortField, sortDirection]);

  const paginated = sortedReturns.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(sortedReturns.length / pageSize);

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <div style={{
      padding: '24px',
      background: '#851515',
      minHeight: '100vh',
      position: 'relative',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .split-panel { height: calc(100vh - 270px); overflow-y: auto; padding-right: 4px; }

        /* Solid Dark Red & Pure White Theme across ALL Return Views (List, Create & Detail) */
        .so-page,
        div.so-page,
        div.so-detail-page {
          background: #851515 !important;
          padding: 1.5rem !important;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          color: #ffffff !important;
          border-radius: 12px !important;
        }

        /* High specificity overrides over SalesOrder.css */
        .so-page div.so-page-header,
        .so-page div.so-card,
        .so-page div.so-table-card,
        .so-page div.so-summary-bar,
        .so-page div.so-content,
        .so-detail-page div.so-page-header,
        .so-detail-page div.so-card,
        .so-detail-page div.so-table-card,
        .so-detail-page div.so-summary-bar,
        .so-detail-page div.so-content {
          background: #751010 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 12px !important;
        }

        .so-page div.so-card-header,
        .so-page div.so-card-body,
        .so-detail-page div.so-card-header,
        .so-detail-page div.so-card-body {
          background: transparent !important;
          color: #ffffff !important;
        }

        .so-page .so-label,
        .so-page span.so-label,
        .so-detail-page .so-label,
        .so-detail-page span.so-label {
          color: #ffffff !important;
          opacity: 0.95 !important;
          font-weight: 800 !important;
        }

        .so-page h1, .so-page h2, .so-page h3, .so-page h4, .so-page h5,
        .so-page p, .so-page span, .so-page div, .so-page th, .so-page td, .so-page label,
        .so-detail-page h1, .so-detail-page h2, .so-detail-page h3, .so-detail-page h4, .so-detail-page h5,
        .so-detail-page p, .so-detail-page span, .so-detail-page div, .so-detail-page th, .so-detail-page td, .so-detail-page label {
          color: #ffffff !important;
        }

        /* Page Header */
        .so-page-header {
          background: #751010 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.25) !important;
          border-left: 6px solid #ffffff !important;
          border-radius: 12px !important;
          padding: 1.25rem 2rem !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25) !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .so-page-header .so-page-title {
          color: #ffffff !important;
          font-weight: 900 !important;
          font-size: 1.35rem !important;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .so-page-header .so-page-title svg {
          color: #ffffff !important;
          stroke: #ffffff !important;
        }

        .so-page-header .so-page-subtitle {
          color: #ffffff !important;
          opacity: 0.95 !important;
          font-weight: 700 !important;
          font-size: 0.725rem !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          margin-top: 0.25rem;
        }

        /* Buttons & Badges */
        .so-page-header button,
        .so-page-header .so-btn-secondary,
        .so-page .so-btn-secondary,
        .so-detail-page button {
          background: transparent !important;
          color: #ffffff !important;
          border: 1.5px solid rgba(255, 255, 255, 0.7) !important;
          border-radius: 20px !important;
          padding: 0.45rem 1.25rem !important;
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          transition: all 0.2s !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.375rem !important;
        }

        .so-page-header button:hover,
        .so-page-header .so-btn-secondary:hover,
        .so-page .so-btn-secondary:hover,
        .so-detail-page button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          border-color: #ffffff !important;
          color: #ffffff !important;
        }

        .so-page-header .btn-primary,
        .so-page-header button[class*="bg-"] {
          background: #ffffff !important;
          color: #751010 !important;
          border: 1.5px solid #ffffff !important;
          border-radius: 20px !important;
          font-weight: 900 !important;
        }

        .so-page-header .btn-primary *,
        .so-page-header button[class*="bg-"] * {
          color: #751010 !important;
          stroke: #751010 !important;
        }

        /* Inputs, Selects, and Textareas - Clean White Box with Dark Text */
        .so-page input,
        .so-page select,
        .so-page textarea,
        .so-detail-page input,
        .so-detail-page select,
        .so-detail-page textarea,
        .so-input,
        .so-select,
        .so-td-input {
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px !important;
          padding: 0.65rem 0.95rem !important;
          font-size: 0.825rem !important;
          font-weight: 700 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        }

        .so-page input *,
        .so-page select option,
        .so-page textarea *,
        .so-detail-page input *,
        .so-detail-page select option,
        .so-detail-page textarea * {
          color: #0f172a !important;
          background: #ffffff !important;
        }

        .so-page input::placeholder,
        .so-page textarea::placeholder,
        .so-detail-page input::placeholder,
        .so-detail-page textarea::placeholder {
          color: #94a3b8 !important;
        }

        /* Cards, Table Containers, Summary Bars */
        .so-card,
        .so-table-card,
        .so-summary-bar {
          background: #751010 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.25) !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2) !important;
          overflow: hidden !important;
        }

        .so-card-header {
          background: transparent !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.25) !important;
          padding: 1rem 1.5rem !important;
        }

        .so-card-title {
          color: #ffffff !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          font-size: 0.85rem !important;
        }

        /* Summary Bar */
        .so-summary-bar {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 1rem !important;
          padding: 1.25rem 2rem !important;
        }

        .so-summary-item {
          border-right: 1px solid rgba(255, 255, 255, 0.25) !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.25rem !important;
        }

        .so-summary-item:last-child {
          border-right: none !important;
        }

        .so-summary-label {
          color: #ffffff !important;
          font-weight: 800 !important;
          font-size: 0.7rem !important;
          letter-spacing: 0.06em !important;
          text-transform: uppercase !important;
          opacity: 0.95 !important;
        }

        .so-summary-value {
          color: #ffffff !important;
          font-weight: 900 !important;
          font-size: 1.15rem !important;
        }

        .so-summary-value.grand {
          color: #ffffff !important;
          font-size: 1.35rem !important;
          font-weight: 900 !important;
        }

        /* Tables (Both List Table and Detail Table) */
        .so-table {
          width: 100%;
          border-collapse: collapse !important;
        }

        .so-table thead th {
          background: rgba(0, 0, 0, 0.25) !important;
          color: #ffffff !important;
          border-bottom: 2px solid rgba(255, 255, 255, 0.3) !important;
          font-weight: 900 !important;
          font-size: 0.75rem !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          padding: 1rem 1.25rem !important;
        }

        .so-table tbody td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
          padding: 0.95rem 1.25rem !important;
          font-size: 0.825rem !important;
        }

        .so-table tbody tr {
          background: transparent !important;
        }

        .so-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        /* Status Badges */
        .so-badge,
        .so-badge-submitted,
        .so-badge-draft {
          display: inline-flex !important;
          align-items: center !important;
          padding: 0.3rem 0.85rem !important;
          border-radius: 9999px !important;
          font-size: 0.675rem !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
          background: rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
        }

        /* SVGs and Icons */
        .so-page svg,
        .so-page svg path,
        .so-detail-page svg,
        .so-detail-page svg path {
          stroke: #ffffff !important;
          color: #ffffff !important;
        }

        /* Modals & Popups Solid Dark Red Theme */
        .fixed.inset-0 .bg-white,
        .fixed.inset-0 [class*="bg-white"],
        .fixed.inset-0 [class*="bg-slate-50"],
        .fixed.inset-0 [class*="bg-slate-100"],
        .fixed.inset-0 table,
        .fixed.inset-0 thead,
        .fixed.inset-0 tbody,
        .fixed.inset-0 tr {
          background: #751010 !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
          color: #ffffff !important;
        }

        .fixed.inset-0 div {
          border-color: rgba(255, 255, 255, 0.2) !important;
        }

        .fixed.inset-0 h1,
        .fixed.inset-0 h2,
        .fixed.inset-0 h3,
        .fixed.inset-0 h4,
        .fixed.inset-0 p,
        .fixed.inset-0 span,
        .fixed.inset-0 div,
        .fixed.inset-0 th,
        .fixed.inset-0 td,
        .fixed.inset-0 label {
          color: #ffffff !important;
        }

        .fixed.inset-0 th {
          background: rgba(0, 0, 0, 0.25) !important;
          color: #ffffff !important;
        }

        .fixed.inset-0 td {
          color: #ffffff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
        }

        .fixed.inset-0 button {
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.5) !important;
        }

        .fixed.inset-0 button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
        }

        .fixed.inset-0 button[class*="bg-rose-"],
        .fixed.inset-0 button[class*="bg-red-"],
        .fixed.inset-0 button[class*="bg-slate-"] {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
        }

        .so-page input.so-input,
        div.so-page input.so-input,
        .so-content input.so-input {
          padding-left: 3.5rem !important;
          background: #ffffff !important;
          color: #751010 !important;
          font-weight: 800 !important;
        }

        .so-page div.relative svg,
        .so-page div.relative svg path,
        div.so-page div.relative svg,
        div.so-page div.relative svg path {
          color: #751010 !important;
          stroke: #751010 !important;
        }

        .so-page input,
        .so-page select,
        .so-page textarea,
        .fixed.inset-0 input,
        .fixed.inset-0 select,
        .fixed.inset-0 textarea {
          background: #ffffff !important;
          color: #751010 !important;
          font-weight: 800 !important;
          border: 1px solid #cbd5e1 !important;
        }

        .so-page input *,
        .so-page select option,
        .fixed.inset-0 input *,
        .fixed.inset-0 select option {
          background: #ffffff !important;
          color: #751010 !important;
        }

        .so-page [style*="color: rgb(15, 23, 42)"],
        .so-page [style*="color: #0f172a"],
        .so-page [style*="color: rgb(71, 85, 105)"],
        .so-page [style*="color: #475569"],
        .so-page [style*="color: rgb(51, 65, 85)"],
        .so-page [style*="color: #334155"],
        .so-page [style*="color: rgb(148, 163, 184)"],
        .so-page [style*="color: #94a3b8"],
        .so-page [style*="color: rgb(100, 116, 139)"],
        .so-page [style*="color: #64748b"] {
          color: #ffffff !important;
        }

        .so-page tbody td,
        .so-page tbody td p,
        .so-page tbody td span,
        .so-page tbody td div {
          color: #ffffff !important;
        }

        .so-page tbody td div[style*="background"] {
          background: rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
        }

        .so-page tbody td span[style*="monospace"] {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
        }

        .fixed.inset-0 svg,
        .fixed.inset-0 svg path {
          stroke: #ffffff !important;
          color: #ffffff !important;
        }
      `}</style>

      {/* ────────────────────── LIST VIEW ────────────────────── */}
      {view === 'list' && (
        <div className="so-page animate-in fade-in duration-300">
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">
                <RotateCw size={20} style={{ color: themeColor }} />
                Purchase Returns
              </h1>
              <p className="so-page-subtitle">{returns.length} DEBIT VOUCHERS INDEXED</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                className="so-btn-primary"
                onClick={() => setView('create')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  height: '40px',
                  padding: '0 1.25rem',
                  background: '#ffffff',
                  color: '#751010',
                  border: '1.5px solid #ffffff',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} /> Initiate Debit Note
              </button>
            </div>
          </div>

          <div className="so-content" style={{ background: '#751010', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#751010', stroke: '#751010', zIndex: 10, pointerEvents: 'none' }} />
                <input
                  className="so-input"
                  style={{ width: '100%', paddingLeft: '3.25rem', background: '#ffffff', color: '#751010', fontWeight: 800, height: '40px', borderRadius: '8px', border: '1px solid #ffffff' }}
                  placeholder="Search Debit ID, Supplier or Original PINV..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ width: '160px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>FROM DATE</label>
                <input
                  type="date"
                  className="so-input"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', color: '#751010', fontWeight: 700, fontSize: '13px', border: '1px solid #ffffff' }}
                />
              </div>
              <div style={{ width: '160px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>TO DATE</label>
                <input
                  type="date"
                  className="so-input"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) {} }}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', color: '#751010', fontWeight: 700, fontSize: '13px', border: '1px solid #ffffff' }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setFilterDateFrom(''); setFilterDateTo(''); }}
                  style={{
                    height: '40px',
                    padding: '0 1.25rem',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: (searchTerm || filterDateFrom || filterDateTo) ? '#ef4444' : '#751010',
                    border: '1.5px solid #ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {(searchTerm || filterDateFrom || filterDateTo) ? <X size={14} /> : null}
                  <span>CLEAR</span>
                </button>
              </div>
            </div>

            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      {!hiddenDefaults.includes('supplier_name') && (
                        <th onClick={() => handleSort('supplier_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span>Supplier Node</span>
                            {renderSortIcon('supplier_name')}
                          </div>
                        </th>
                      )}
                      {!hiddenDefaults.includes('status') && (
                        <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span>Status</span>
                            {renderSortIcon('status')}
                          </div>
                        </th>
                      )}
                      {!hiddenDefaults.includes('return_against') && (
                        <th onClick={() => handleSort('return_against')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span>Original Invoice</span>
                            {renderSortIcon('return_against')}
                          </div>
                        </th>
                      )}
                      {!hiddenDefaults.includes('grand_total') && (
                        <th onClick={() => handleSort('grand_total')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                            <span>Debit Value</span>
                            {renderSortIcon('grand_total')}
                          </div>
                        </th>
                      )}
                      {customColumns.map(col => (
                        <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <span>{col.replace(/_/g, ' ').toUpperCase()}</span>
                            {renderSortIcon(col)}
                          </div>
                        </th>
                      ))}
                      {!hiddenDefaults.includes('name') && (
                        <th onClick={() => handleSort('name')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <span>Key</span>
                            {renderSortIcon('name')}
                          </div>
                        </th>
                      )}
                      <th style={{ width: '48px', textAlign: 'center', verticalAlign: 'middle', padding: '0 4px' }}>
                        <ListCustomizer
                          doctype="Purchase Invoice"
                          saveKey="Purchase Return"
                          defaultColumns={DEFAULT_PRTN_LIST_COLUMNS}
                          iconOnly
                          onSave={(cols, hidden) => {
                            setCustomColumns(cols);
                            setHiddenDefaults(hidden);
                          }}
                          themeColor={themeColor}
                          title="Configure Columns"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={DEFAULT_PRTN_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} style={{ textAlign: 'center', padding: '3rem' }}>
                          <Loader2 size={32} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={DEFAULT_PRTN_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>
                          NO DEBIT SHARDS DETECTED
                        </td>
                      </tr>
                    ) : (
                      paginated.map(r => (
                        <tr key={r.name} onClick={() => loadReturnDetails(r.name)} style={{ cursor: 'pointer' }}>
                          {!hiddenDefaults.includes('supplier_name') && (
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Building2 size={18} />
                                </div>
                                <div>
                                  <p 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSearchTerm(r.supplier_name || '');
                                      setCurrentPage(1);
                                    }}
                                    title="Click to filter by supplier"
                                    style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', margin: 0, cursor: 'pointer' }}
                                  >
                                    {r.supplier_name}
                                  </p>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (r.posting_date) {
                                        setSearchTerm(r.posting_date);
                                        setCurrentPage(1);
                                      }
                                    }}
                                    title="Click to filter by date"
                                    style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', cursor: 'pointer' }}
                                  >
                                    {r.posting_date}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}
                          {!hiddenDefaults.includes('status') && (
                            <td>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchTerm(r.status || '');
                                  setCurrentPage(1);
                                }}
                                title="Click to filter by status"
                                className={`so-badge ${r.status === 'Submitted' ? 'so-badge-submitted' : 'so-badge-draft'}`}
                                style={{ cursor: 'pointer' }}
                              >
                                {r.status}
                              </span>
                            </td>
                          )}
                          {!hiddenDefaults.includes('return_against') && (
                            <td style={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (r.return_against) {
                                    setSearchTerm(r.return_against);
                                    setCurrentPage(1);
                                  }
                                }}
                                title="Click to filter by invoice"
                                style={{ cursor: 'pointer' }}
                              >
                                {r.return_against}
                              </span>
                            </td>
                          )}
                          {!hiddenDefaults.includes('grand_total') && (
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                {renderCurrency(r.currency, 12)}
                                <span>{Math.abs(parseFloat(r.rounded_total || r.grand_total || r.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </span>
                            </td>
                          )}
                          {customColumns.map(col => (
                            <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {r[col] !== undefined && r[col] !== null ? String(r[col]) : '-'}
                            </td>
                          ))}
                          {!hiddenDefaults.includes('name') && (
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 800, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                                {r.name}
                              </span>
                            </td>
                          )}
                          <td></td>
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
                <h1 className="so-page-title" style={{ margin: 0 }}>Initiate Debit Note</h1>
                <p className="so-page-subtitle">BRANCH: {warehouse || 'NO BRANCH CONFIGURED'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={clearFilters} className="so-btn-secondary">
                Clear Filters (F5)
              </button>
              <button
                onClick={() => handleSaveReturn(false)}
                disabled={saving || returnQueue.length === 0}
                className="so-btn-primary"
                style={{ background: themeColor, borderColor: themeColor }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft (F7)
              </button>
            </div>
          </div>

          <div className="so-content">
            {/* Filters grid */}
            <div className="so-card mb-6">
              <div className="so-card-body">
                <div className="so-form-grid-4">
                  <div className="so-field">
                    <span className="so-label">Supplier (F2/F3)</span>
                    <CustomSearchDropdown
                      placeholder="Search supplier..."
                      value={selectedSupplier}
                      onSelect={handleSupplierSelect}
                      fetchData={fetchSuppliers}
                      optionsLabel="supplier_name"
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
                    <div className="flex justify-between items-center mb-1">
                      <span className="so-label m-0">Filter by Item (F4)</span>
                      {selectedSupplier && (
                        <button
                          onClick={() => fetchItemHistory(null)}
                          className="text-[10px] font-black text-rose-600 hover:text-rose-800 transition-colors uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                        >
                          Show All Supplier Items
                        </button>
                      )}
                    </div>
                    <CustomSearchDropdown 
                      placeholder="Filter by item..."
                      value={selectedItemFilter}
                      onSelect={(val) => {
                        setSelectedItemFilter(val);
                        if (val) {
                          fetchItemHistory(val.item_code);
                        }
                      }}
                      fetchData={fetchBranchItems}
                      optionsLabel="item_name"
                      themeColor={themeColor}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Workspace Area */}
            <div className="w-full">
              {returnQueue.length === 0 ? (
                <div className="so-card" style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center' }}>
                  <Receipt size={48} className="text-slate-300 mb-4 animate-bounce" />
                  <h2 className="text-base font-black text-slate-800 mb-1">Return Queue Empty</h2>
                  <p className="text-xs font-medium text-slate-400 max-w-sm mb-4">Search/select items or click "Show All Supplier Items" above to add return items to your queue.</p>
                  {selectedSupplier && (
                    <button 
                      onClick={() => fetchItemHistory(null)}
                      className="px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs font-bold transition-all shadow-lg cursor-pointer"
                    >
                      Search Supplier Items History
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Return Queue Summary Basket */}
                  <div className="so-table-card animate-in fade-in duration-300">
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
                            <th style={{ textAlign: 'center', width: '120px' }}>Return Qty</th>
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
                                <p className="font-bold text-xs text-slate-800" style={{ margin: 0 }}>{item.item_name}</p>
                                <span className="text-[10px] text-slate-400">{item.item_code}</span>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="so-td-input"
                                  style={{ textAlign: 'center', padding: '0.25rem 0.5rem', width: '80px', margin: '0 auto', display: 'block' }}
                                  value={item.qty || ''}
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setReturnQueue(prev => prev.map(q => {
                                      if (q.parent_detail_docname === item.parent_detail_docname) {
                                        let finalQty = val;
                                        if (finalQty > item.returnable_qty) {
                                          Swal.fire('Warning', `Cannot return more than remaining returnable qty: ${item.returnable_qty}`, 'warning');
                                          finalQty = item.returnable_qty;
                                        }
                                        if (finalQty < 0) finalQty = 0;
                                        return { ...q, qty: finalQty };
                                      }
                                      return q;
                                    }));
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                  {renderCurrency('AED', 11)}
                                  <span>{(item.rate || 0).toFixed(2)}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                  {renderCurrency('AED', 11)}
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
                                  {renderCurrency('AED', 11)}
                                  <span>{Math.abs(t.tax_amount).toFixed(2)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="so-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', borderColor: '#334155', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)' }}>
                      <div className="so-card-header" style={{ borderColor: '#334155' }}>
                        <h5 className="so-card-title" style={{ color: '#f43f5e', fontWeight: 900 }}>Debit Impact Summary</h5>
                      </div>
                      <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="flex justify-between items-center text-xs font-bold" style={{ color: '#fda4af' }}>
                          <span>Subtotal Impact</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>-</span>
                            {renderCurrency('AED', 11)}
                            <span>{Math.abs(totals.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold" style={{ color: '#fda4af' }}>
                          <span>Tax Reversal</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>-</span>
                            {renderCurrency('AED', 11)}
                            <span>{Math.abs(totals.total_taxes_and_charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </span>
                        </div>
                        <div style={{ background: 'rgba(244, 63, 94, 0.2)', height: '1px', margin: '4px 0' }} />
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-black" style={{ color: '#ffe4e6' }}>Total Debit Value</span>
                          <span className="text-lg font-black text-white" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>-</span>
                            {renderCurrency('AED', 14)}
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
          
          {/* Item Search Modal */}
          {showItemSearchModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: themeColor }}>
                      <Search size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Return Specific Item</h3>
                      <p className="text-xs font-semibold text-slate-400">Select an invoice to return this item from</p>
                    </div>
                  </div>
                  <button onClick={() => setShowItemSearchModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
                  {searchingItemInvoices ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-300 mb-4" />
                      <span className="text-sm font-bold text-slate-400">Searching invoice history...</span>
                    </div>
                  ) : itemSearchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
                      <span className="text-sm font-bold text-slate-500">No returnable invoices found for this item.</span>
                    </div>
                  ) : (
                    <div className="p-4">
                      <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="w-12 py-3 px-4 border-b border-slate-100 text-center">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 rounded text-red-700 border-gray-300 focus:ring-red-600 cursor-pointer"
                                checked={
                                  itemSearchResults.length > 0 &&
                                  itemSearchResults.every(row => {
                                    const isAdded = returnQueue.some(q => q.parent_detail_docname === row.parent_detail_docname);
                                    return isAdded || selectedModalItems[row.parent_detail_docname];
                                  })
                                }
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const newSelections = { ...selectedModalItems };
                                  itemSearchResults.forEach(row => {
                                    const isAdded = returnQueue.some(q => q.parent_detail_docname === row.parent_detail_docname);
                                    if (!isAdded) {
                                      newSelections[row.parent_detail_docname] = checked;
                                    }
                                  });
                                  setSelectedModalItems(newSelections);
                                }}
                              />
                            </th>
                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 px-4 border-b border-slate-100">Date</th>
                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 px-4 border-b border-slate-100">Invoice / Supplier</th>
                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 px-4 border-b border-slate-100">Item Rate</th>
                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 px-4 border-b border-slate-100 text-center">Returnable Qty</th>
                            <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 px-4 border-b border-slate-100 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemSearchResults.map((row, idx) => {
                            const isAdded = returnQueue.some(q => q.parent_detail_docname === row.parent_detail_docname);
                            const isChecked = !!selectedModalItems[row.parent_detail_docname];
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 group">
                                <td className="py-4 px-4 text-center">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-red-700 border-gray-300 focus:ring-red-600 cursor-pointer"
                                    checked={isAdded || isChecked}
                                    disabled={isAdded}
                                    onChange={(e) => {
                                      setSelectedModalItems(prev => ({
                                        ...prev,
                                        [row.parent_detail_docname]: e.target.checked
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="py-4 px-4 text-xs font-bold text-slate-800">
                                  {row.posting_date ? new Date(row.posting_date).toLocaleDateString() : ''}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="text-xs font-black text-slate-800">{row.parent}</div>
                                  <div className="text-[10px] font-semibold text-sky-500 mt-0.5">{row.party_name || row.supplier || 'Supplier'}</div>
                                </td>
                                <td className="py-4 px-4 text-xs font-bold text-slate-600">
                                  {renderCurrency('AED', 10)} {row.rate ? row.rate.toFixed(2) : '0.00'}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <span className="text-[11px] font-black text-white bg-white/20 border border-white/40 px-2.5 py-1 rounded-md">
                                    {row.returnable_qty} {row.uom || 'Nos'}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  {isAdded ? (
                                    <button disabled className="px-4 py-1.5 rounded bg-white/10 text-white/50 border border-white/20 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1 mx-auto w-24">
                                      <CheckCircle size={12} /> Added
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => handleSelectItemFromHistory(row)} 
                                      className="px-4 py-1.5 rounded bg-white/20 text-white hover:bg-white/30 border border-white/40 text-xs font-bold transition-colors mx-auto block w-24"
                                    >
                                      Return
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center">
                  <div>
                    {Object.values(selectedModalItems).filter(Boolean).length > 0 && (
                      <span className="text-xs font-bold text-slate-500">
                        {Object.values(selectedModalItems).filter(Boolean).length} items selected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    {Object.values(selectedModalItems).filter(Boolean).length > 0 && (
                      <button 
                        onClick={() => {
                          const toAdd = itemSearchResults.filter(row => selectedModalItems[row.parent_detail_docname]);
                          if (toAdd.length > 0) {
                            setReturnQueue(prev => {
                              const updated = [...prev];
                              toAdd.forEach(itemRow => {
                                if (!updated.some(q => q.parent_detail_docname === itemRow.parent_detail_docname)) {
                                  updated.push({
                                    name: itemRow.parent_detail_docname,
                                    item_code: itemRow.item_code,
                                    item_name: itemRow.item_name,
                                    qty: itemRow.returnable_qty,
                                    rate: itemRow.rate,
                                    uom: itemRow.uom,
                                    warehouse: itemRow.warehouse,
                                    parent: itemRow.parent,
                                    parent_detail_docname: itemRow.parent_detail_docname
                                  });
                                }
                              });
                              return updated;
                            });
                            setSelectedModalItems({});
                            Swal.fire('Success', `Added ${toAdd.length} items to return queue.`, 'success');
                          }
                        }}
                        className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                      >
                        Add Selected to Queue
                      </button>
                    )}
                    <button 
                      onClick={() => setShowItemSearchModal(false)}
                      className="px-6 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────── DETAIL VIEW (SUBMITTED / DRAFT DETAILS) ────────────────────── */}
      {view === 'detail' && selectedReturnDoc && (
        <div className="so-page so-detail-page animate-in fade-in duration-500">
          {/* 1. Page Header */}
          <div className="so-page-header">
            <div>
              <h1 className="so-page-title">
                <RotateCw size={20} />
                {selectedReturnDoc.name || 'DEBIT_NOTE_DRAFT'}
              </h1>
              <p className="so-page-subtitle">
                Supplier: {selectedReturnDoc.supplier_name} | Against: {selectedReturnDoc.return_against}
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
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Finalize Debit
                  </button>
                </>
              )}

              {selectedReturnDoc.docstatus === 1 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(185, 28, 28, 0.10)', padding: '0.45rem 1rem', borderRadius: '0.375rem', border: '1px solid rgba(185, 28, 28, 0.3)' }}>
                                    <CheckCircle2 size={14} style={{ color: '#b91c1c' }} />
                                    <span style={{ fontWeight: 800, fontSize: '11px', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEDGER SUBMITTED</span>
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
              <AttachmentSection doctype="Purchase Invoice" docname={selectedReturnDoc?.name} themeColor={themeColor} themeLight={themeLight} isDarkRedTheme={true} />
              {/* Summary Bar for Stats */}
              <div className="so-summary-bar">
                <div className="so-summary-item">
                  <span className="so-summary-label">Debit Valuation</span>
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
                    background: selectedReturnDoc.docstatus === 1 ? themeColor : (selectedReturnDoc.docstatus === 2 ? '#7f1d1d' : '#ffffff'),
                    color: selectedReturnDoc.docstatus === 1 ? '#ffffff' : (selectedReturnDoc.docstatus === 2 ? '#ffffff' : themeColor),
                    border: selectedReturnDoc.docstatus === 0 ? `1px solid ${themeColor}` : undefined,
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
                    <h5 className="so-card-title">Debit Properties</h5>
                  </div>
                  <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Supplier</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{selectedReturnDoc.supplier_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Original Purchase Reference</span>
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
                    <h5 className="so-card-title">Debit Summary Impact</h5>
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
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Total Debit Value</span>
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
                  <h5 className="so-card-title">Debit Item Matrix</h5>
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
      {renderCurrency(currency, 12)}
      <span>{Math.abs(value).toLocaleString()}</span>
    </span>
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