import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, X, Trash2, Building2, Search, Calendar, Filter, MoreVertical, Package,
  Warehouse as WarehouseIcon, Percent, DollarSign, Loader2, Barcode, Palette, ChevronLeft, ChevronRight, Zap, CheckCircle2, ExternalLink, Link, Edit2, Settings
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../Admin/SalesOrder.css';

// Custom APIs (moved to standardized path)
const API_PATH = '/api/method/kyle_retail.retail_api.api';
const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const RESOURCE_API = '/api/resource/Purchase Invoice';
const RESOURCE_BASE = '/api/resource';

const DEFAULT_PI_COLUMNS = [
  { id: 'item_code',          label: 'Item Code',         visible: true,  width: 240 },
  { id: 'custom_ref_sl_no',   label: 'Ref / Supplier SL #', visible: true, width: 160 },
  { id: 'custom_box_qty',     label: 'Box Qty',           visible: true,  width: 90  },
  { id: 'uom',                label: 'UOM',               visible: true,  width: 80  },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box',        visible: true,  width: 90  },
  { id: 'custom_box_price',   label: 'Box Price',         visible: true,  width: 120 },
  { id: 'rate',               label: 'Rate (Nos)',        visible: true,  width: 120 },
  { id: 'custom_selling_price', label: 'Selling Price',   visible: true,  width: 120 },
  { id: 'qty',                label: 'Total Qty',         visible: true,  width: 100 },
  { id: 'amount',             label: 'Subtotal',          visible: true,  width: 140 }
];

function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [lastSavedData, setLastSavedData] = useState(null); // Dirty Check Base


  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [docName, setDocName] = useState('');
  const [docStatus, setDocStatus] = useState(null);
  const [allowedActions, setAllowedActions] = useState([]);
  const theme = useSelector(state => state.user.theme);

  // Theme toggle (synced across pages)
  const [piTheme, setPiTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = piTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  // ----- Column Config -----
  const loadColumnConfig = () => {
    try {
      const saved = localStorage.getItem('pi_column_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_PI_COLUMNS.map(c => c.id);
        const savedIds   = parsed.map(c => c.id);
        const missing    = DEFAULT_PI_COLUMNS.filter(c => !savedIds.includes(c.id));
        return [...parsed, ...missing];
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_PI_COLUMNS;
  };
  const [columnConfig, setColumnConfig]   = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    setColumnConfig(newConfig);
    localStorage.setItem('pi_column_config', JSON.stringify(newConfig));
  };

  useEffect(() => {
    localStorage.setItem('legacySubTheme', piTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [piTheme, themeColor, themeColorHover, themeLight]);

  const [taxTemplates, setTaxTemplates] = useState([]);
  const [loadingTaxTemplates, setLoadingTaxTemplates] = useState(false);
  const [taxPreview, setTaxPreview] = useState([]);

  const handleSupplierCreate = async (name) => {
    try {
      const res = await fetch(`${API_PATH}.create_supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': localStorage.getItem('session') },
        credentials: 'include',
        body: JSON.stringify({ supplier_name: name.trim(), supplier_type: "Company" })
      });
      const result = await res.json();
      if (result.message?.status === 'success' && result.message?.message) {
        const s = result.message.message;
        return { name: s.name, supplier_name: s.supplier_name || s.name };
      }
      throw new Error('Invalid response');
    } catch (err) {
      alert(`Cannot create supplier: ${err.message}`);
      throw err;
    }
  };

  const fetchSuppliersAPI = async (query) => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_suppliers_pr`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      return Array.isArray(res.data.message) ? res.data.message : [];
    } catch (err) {
      return [];
    }
  };

  const fetchItemsAPI = async (query) => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_items_for_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      return Array.isArray(res.data.message) ? res.data.message : [];
    } catch (err) {
      return [];
    }
  };

  // NEW: Warehouses State (filtered for non-group)
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    name: '', supplier: '', supplier_name: '',
    posting_date: new Date().toISOString().split('T')[0],
    due_date: '', bill_no: '',
    update_stock: true,
    accepted_warehouse: '',
    rejected_warehouse: '',
    is_subcontracted: false,
    apply_discount_on: 'Grand Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    taxes_and_charges: '',
    items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_selling_price: 0 }],
    docstatus: 0
  });

  const isDirty = useMemo(() => {
    if (!docName) return true;
    const current = JSON.stringify(formData);
    return lastSavedData !== current;
  }, [formData, lastSavedData, docName]);

  const [searchSupplier, setSearchSupplier] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const [itemsList, setItemsList] = useState([]);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});

  // NEW: Barcode Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const barcodeRef = useRef(null);

  const [filterName, setFilterName] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState({});

  const supplierRef = useRef(null);
  const itemRefs = useRef({});
  const actionsRefs = useRef({});

  // Calculations
  const subtotal = useMemo(() => formData.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0), [formData.items]);
  const discountAmount = useMemo(() => {
    if (formData.additional_discount_percentage > 0) return (subtotal * formData.additional_discount_percentage) / 100;
    return parseFloat(formData.discount_amount) || 0;
  }, [subtotal, formData.additional_discount_percentage, formData.discount_amount]);
  const netTotal = subtotal - discountAmount;
  const taxTotal = useMemo(() => {
    return taxPreview.reduce((sum, t) => {
      return sum + (netTotal * (parseFloat(t.rate || 0) / 100));
    }, 0);
  }, [taxPreview, netTotal]);
  const grandTotal = (netTotal + taxTotal).toFixed(2);

  // Opens a blank PI modal pre-filled with data from Purchase Receipt `prName`
  const createPIFromPR = useCallback(async (prName) => {
    try {
      const res = await axios.get(`/api/resource/Purchase Receipt/${encodeURIComponent(prName)}`, {
        withCredentials: true
      });
      const pr = res.data.data;
      if (!pr) { alert('Purchase Receipt not found: ' + prName); return; }

      const mappedItems = (pr.items || []).map(i => {
        const isBoxUom = (i.uom || '').toLowerCase() === 'box';
        const boxQty   = parseFloat(i.custom_box_qty || 0);
        const pcsPerBox = parseFloat(i.custom_pieces_per_box || 1);
        const invoiceQty = parseFloat(i.qty) || 0;

        return {
          name: '',
          item_code: i.item_code || '',
          item_name: i.item_name || '',
          qty: invoiceQty,
          uom: i.uom || '',
          rate: parseFloat(i.rate || 0),
          amount: parseFloat(i.amount || 0),
          custom_box_qty: boxQty,
          custom_pieces_per_box: pcsPerBox,
          custom_box_price: parseFloat(i.custom_box_price || 0),
          custom_selling_price: parseFloat(i.custom_selling_price || 0),
          custom_supplier_sl_num: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          purchase_order: i.purchase_order || undefined,
          purchase_order_item: i.purchase_order_item || undefined,
          purchase_receipt: pr.name,
          purchase_receipt_item: i.name,
          use_box_entry: isBoxUom,
        };
      });

      setFormData({
        name: '',
        supplier: pr.supplier || '',
        supplier_name: pr.supplier_name || pr.supplier || '',
        posting_date: pr.posting_date || new Date().toISOString().split('T')[0],
        due_date: '',
        bill_no: pr.supplier_delivery_note || '',
        update_stock: false,
        accepted_warehouse: pr.set_warehouse || '',
        rejected_warehouse: '',
        is_subcontracted: false,
        apply_discount_on: pr.apply_discount_on || 'Grand Total',
        additional_discount_percentage: parseFloat(pr.additional_discount_percentage || 0),
        discount_amount: parseFloat(pr.discount_amount || 0),
        taxes_and_charges: pr.taxes_and_charges || '',
        items: mappedItems.length > 0 ? mappedItems : [{ item_code:'', item_name:'', qty:1, uom:'', rate:0, amount:0, custom_box_qty:0, custom_pieces_per_box:1, custom_selling_price:0, custom_supplier_sl_num:'', custom_ref_sl_no:'' }],
        taxes: (pr.taxes || []).map(t => ({
          add_row: t.add_deduct_tax === 'Add',
          charge_type: t.charge_type || 'On Net Total',
          account_head: t.account_head || '',
          rate: parseFloat(t.rate || 0),
          tax_amount: parseFloat(t.tax_amount || 0),
          total: t.total || '0.00',
          description: t.description || t.account_head || ''
        })),
        docstatus: 0,
      });
      setSearchSupplier(pr.supplier_name || pr.supplier || '');
      setFormErrors({});
      setDocName('');
      setDocStatus(null);
      setIsEditMode(false);
      setIsViewMode(false);
      setIsModalOpen(true);
    } catch (err) {
      console.error('createPIFromPR error:', err);
      alert('Failed to load Purchase Receipt data: ' + (err.response?.data?.message || err.message));
    }
  }, []);

  // NEW: Auto-set default accepted warehouse if needed
  useEffect(() => {
    if (formData.update_stock && formData.accepted_warehouse === '' && warehouses.length > 0) {
      setFormData(prev => ({ ...prev, accepted_warehouse: warehouses[0].name }));
    }
  }, [warehouses, formData.update_stock, formData.accepted_warehouse]);

  useEffect(() => {
    if (docName) fetchWorkflowActions();
  }, [docName, docStatus]);



  const fetchWorkflowActions = useCallback(async (forcedName) => {
    const targetName = forcedName || docName;
    if (!targetName) return;
    try {
      const res = await axios.get(`${API_PATH}.get_document_status_details`, {
        params: { doctype: 'Purchase Invoice', docname: targetName },
        withCredentials: true
      });
      const details = res.data.message?.data || res.data.message || {};
      setAllowedActions(details.allowed_actions || []);
      
      // Update metrics in formData for UI logic
      if (details.per_received !== undefined || details.per_billed !== undefined) {
        setFormData(prev => ({
          ...prev,
          per_received: details.per_received ?? prev.per_received,
          per_billed: details.per_billed ?? prev.per_billed,
          grand_total: details.grand_total ?? prev.grand_total
        }));
      }
    } catch (err) { console.error("Workflow fetch failed", err); }
  }, [docName]);

  const handleDocAction = async (action) => {
    if (action === 'save' || action === 'submit') {
        const errors = {};
        if (!formData.supplier) errors.supplier = 'Supplier is required';
        if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
        if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
        }
    }

    const confirmMap = {
      submit: 'SUBMIT this Purchase Invoice? This will update stock and ledger if enabled.',
      cancel: 'CANCEL this Purchase Invoice? This cannot be undone.',
      delete: 'DELETE this Purchase Invoice? IRREVERSIBLE ACTION.',
      amend: 'Create a new Draft based on this cancelled Invoice?'
    };

    if (confirmMap[action]) {
        const result = await Swal.fire({
            title: action.toUpperCase(),
            text: confirmMap[action],
            icon: action === 'delete' ? 'error' : 'warning',
            showCancelButton: true,
            confirmButtonColor: action === 'cancel' || action === 'delete' ? '#ef4444' : '#0ea5e9'
        });
        if (!result.isConfirmed) return;
    }

    setSaving(true);
    try {
      let payload = null;
      if (action === 'save' || action === 'submit') {
          payload = await getPayload();
      }

      let res;
      if (action === 'save' || action === 'submit') {
          res = await axios.post(`${API_PATH}.save_transaction_document`, {
            doctype: 'Purchase Invoice',
            doc_data: payload,
            action: action
          }, { withCredentials: true });
      } else {
          res = await axios.post(`${API_PATH}.handle_document_action`, {
            doctype: 'Purchase Invoice',
            docname: docName || undefined,
            action: action,
            doc_data: undefined
          }, { withCredentials: true });
      }

      const rawMsg = res.data.message || {};
      const success = rawMsg.success || rawMsg.status === 'success';

      if (success) {
        setLastSavedData(JSON.stringify(payload)); // Update base for dirty check after save
        Swal.fire('Success', `${action.toUpperCase()} operation completed successfully.`, 'success');
        
        if (action === 'delete') {
            closeModal();
            fetchInvoices();
            return;
        }

        const nextDoc = (rawMsg.data && rawMsg.data.name) || rawMsg.new_name || rawMsg.docname || rawMsg.name || docName;
        
        if (nextDoc) {
            setDocName(nextDoc);
            // If the URL is still 'new', update it to the actual name
            if (searchParams.get('name') === 'new' || searchParams.get('pr')) {
                setSearchParams({ name: nextDoc });
            } else if (nextDoc !== docName) {
                fetchPurchaseInvoice(nextDoc);
            } else {
                fetchPurchaseInvoice(docName);
            }
        }
        fetchInvoices();
      } else {
          throw new Error(rawMsg.message || "Operation failed");
      }
    } catch (err) {
      Swal.fire('Matrix Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_company_warehouses`, {
        withCredentials: true
      });
      setWarehouses(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
  };

  // NEW: Handle Barcode Scan on Enter
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      setBarcodeLoading(true);
      try {
        // Call API to fetch item by barcode (enhance backend if needed)
        const res = await axios.get(`${API_PATH}.get_item_by_barcode_pi`, {
          params: { barcode: barcodeInput.trim() },
          withCredentials: true
        });
        const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;

        if (item && item.item_code) {
          // Add to last row or create new row
          const lastIndex = formData.items.length - 1;
          if (formData.items[lastIndex].item_code) {
            // Create new row if last is filled
            addItemRow();
          }
          // Select item in the last row
          await selectItem(lastIndex, item);
        } else {
          alert('Item not found for barcode: ' + barcodeInput);
        }
      } catch (err) {
        console.error('Barcode fetch error:', err);
        alert('Error fetching item by barcode');
      } finally {
        setBarcodeLoading(false);
        setBarcodeInput(''); // Clear input after scan
        barcodeRef.current?.focus(); // Refocus for next scan
      }
    }
  };

  const formatPrice = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleClickOutside = (e) => {
    if (supplierRef.current && !supplierRef.current.contains(e.target)) setShowSupplierDropdown(false);
    Object.keys(itemRefs.current).forEach(idx => {
      if (itemRefs.current[idx] && !itemRefs.current[idx].contains(e.target)) {
        setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
      }
    });
    if (showActions && actionsRefs.current[showActions] && !actionsRefs.current[showActions].contains(e.target)) {
      setShowActions(null);
    }
  };



  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${LEGACY_API}.get_purchase_invoices`, { 
        params: { limit: 2000, limit_page_length: 2000, order_by: 'modified desc' }, 
        withCredentials: true 
      });
      if (res.data.message?.success) setInvoices(res.data.message.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchTaxTemplates = async () => {
    setLoadingTaxTemplates(true);
    try {
      const res = await axios.get(`${LEGACY_API}.get_purchase_taxes_templates_pi`, { withCredentials: true });
      const templates = Array.isArray(res.data.message) ? res.data.message : [];
      setTaxTemplates(templates);

      // Auto-set default 5% tax for NEW documents if nothing selected
      if (!docName && !formData.taxes_and_charges && templates.length > 0) {
        const defaultTax = templates.find(t => t.name.toUpperCase() === 'UAE VAT 5%') || templates.find(t => t.name.includes('5%'));
        if (defaultTax) {
          setFormData(prev => ({ ...prev, taxes_and_charges: defaultTax.name }));
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingTaxTemplates(false); }
  };

  // Supplier search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchSupplier.trim().length >= 2) {
        fetchSuppliers(searchSupplier);
        setShowSupplierDropdown(true);
      } else {
        setShowSupplierDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchSupplier]);

  const fetchSuppliers = async (query = '') => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_suppliers_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      setSuppliers(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { setSuppliers([]); }
  };

  const fetchItems = async (query = '') => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_items_for_pi`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      setItemsList(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { setItemsList([]); }
  };

  const fetchItemRate = async (itemCode, rowIndex) => {
    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: { item_code: itemCode },
        withCredentials: true
      });
      if (res.data.message?.rate) {
        updateItem(rowIndex, 'rate', res.data.message.rate);
      }
    } catch (err) { }
  };

  useEffect(() => {
    if (!formData.taxes_and_charges) {
      setTaxPreview([]);
      return;
    }

    const loadTaxTemplate = async () => {
      try {
        const encodedName = encodeURIComponent(formData.taxes_and_charges);
        const res = await axios.get(
          `/api/resource/Purchase Taxes and Charges Template/${encodedName}`,
          { withCredentials: true }
        );
        setTaxPreview(res.data.data.taxes || []);
      } catch (err) {
        console.warn("Tax template not found or invalid:", formData.taxes_and_charges);
        setTaxPreview([]);
      }
    };

    loadTaxTemplate();
  }, [formData.taxes_and_charges]);

  const openCreateModal = useCallback(() => {
    setFormData({
      name: '', supplier: '', supplier_name: '',
      posting_date: new Date().toISOString().split('T')[0],
      due_date: '', bill_no: '',
      update_stock: true,
      accepted_warehouse: '',
      rejected_warehouse: '',
      is_subcontracted: false,
      apply_discount_on: 'Grand Total',
      additional_discount_percentage: 0,
      discount_amount: 0,
      taxes_and_charges: '',
      items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '' }],
      docstatus: 0
    });
    setFormErrors({});
    setSearchSupplier('');
    setTaxPreview([]);
    setDocName('');
    setDocStatus(null);
    setBarcodeInput(''); // NEW: Reset barcode
    setIsEditMode(false);
    setIsViewMode(false);
    setIsModalOpen(true);
  }, []);

  const fetchPurchaseInvoice = useCallback(async (name) => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_purchase_invoice`, { params: { name }, withCredentials: true });
      if (res.data.message?.success) {
        const d = res.data.message.data;
        const mapped = {
          name: d.name,
          supplier: d.supplier,
          supplier_name: d.supplier_name || d.supplier,
          posting_date: d.posting_date.split('T')[0],
          due_date: d.due_date ? d.due_date.split('T')[0] : '',
          bill_no: d.bill_no || '',
          update_stock: !!d.update_stock,
          accepted_warehouse: d.accepted_warehouse || '',
          rejected_warehouse: d.rejected_warehouse || '',
          is_subcontracted: !!d.is_subcontracted,
          apply_discount_on: d.apply_discount_on || 'Grand Total',
          additional_discount_percentage: d.additional_discount_percentage || 0,
          discount_amount: d.discount_amount || 0,
          taxes_and_charges: d.taxes_and_charges || '',
          items: (d.items || []).map(i => ({
            name: i.name || '',
            item_code: i.item_code,
            item_name: i.item_name,
            qty: i.qty || 1,
            uom: i.uom || '',
            rate: i.rate || 0,
            amount: i.amount || 0,
            custom_box_qty: parseFloat(i.custom_box_qty || 0),
            custom_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
            default_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_supplier_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            purchase_order: i.purchase_order || '',
            purchase_order_item: i.purchase_order_item || '',
            purchase_receipt: i.purchase_receipt || '',
            use_box_entry: (i.uom || '').toLowerCase() === 'box'
          })),
          total_qty: d.total_qty || 0,
          net_total: d.net_total || 0,
          total_taxes_and_charges: d.total_taxes_and_charges || 0,
          grand_total: d.grand_total || 0,
          rounded_total: d.rounded_total || 0,
          outstanding_amount: d.outstanding_amount !== undefined ? d.outstanding_amount : (d.grand_total || 0),
          docstatus: parseInt(d.docstatus) || 0
        };
        
        // Populate tax preview for UI/Calculations
        if (d.taxes && d.taxes.length > 0) {
          setTaxPreview(d.taxes.map(t => ({
            account_head: t.account_head,
            rate: t.rate,
            tax_amount: t.tax_amount,
            description: t.description || t.account_head
          })));
        }
        // Data Enrichment: Cascading sync from PR and PO
        if ((d.docstatus || 0) === 0) {
          try {
            const sourcePRName = d.items?.find(i => i.purchase_receipt)?.purchase_receipt;
            const sourcePOName = d.items?.find(i => i.purchase_order)?.purchase_order;
            
            let enrichedItems = [...mapped.items];
            
            // 1. Sync from PR if available
            if (sourcePRName) {
              const prRes = await axios.get(`${RESOURCE_BASE}/Purchase Receipt/${sourcePRName}`, { withCredentials: true });
              const prDoc = prRes.data.data;
              if (prDoc) {
                // Sync date if it's the default today's date
                if (mapped.posting_date === new Date().toISOString().split('T')[0]) {
                   mapped.posting_date = prDoc.posting_date;
                }
                if (prDoc.items) {
                  enrichedItems = enrichedItems.map(item => {
                    const prItem = prDoc.items.find(pi => pi.item_code === item.item_code);
                    if (prItem) {
                      return {
                        ...item,
                        uom: prItem.uom || item.uom,
                        use_box_entry: (prItem.uom || item.uom || '').toLowerCase() === 'box',
                        custom_selling_price: item.custom_selling_price || parseFloat(prItem.custom_selling_price || 0),
                        custom_box_qty: parseFloat(prItem.custom_box_qty || 0),
                        custom_pieces_per_box: parseFloat(prItem.custom_pieces_per_box || 1),
                        custom_box_price: parseFloat(prItem.custom_box_price || 0),
                        qty: parseFloat(prItem.qty || 0)
                      };
                    }
                    return item;
                  });
                }
              }
            }
            
            // 2. Further sync from PO if PR was missing fields or no PR
            if (sourcePOName) {
              const poRes = await axios.get(`${RESOURCE_BASE}/Purchase Order/${sourcePOName}`, { withCredentials: true });
              const poDoc = poRes.data.data;
              if (poDoc && poDoc.items) {
                enrichedItems = enrichedItems.map(item => {
                  const poItem = poDoc.items.find(pi => pi.item_code === item.item_code);
                  if (poItem) {
                    return {
                      ...item,
                      uom: poItem.uom || item.uom,
                      use_box_entry: (poItem.uom || item.uom || '').toLowerCase() === 'box',
                      custom_selling_price: item.custom_selling_price || parseFloat(poItem.custom_selling_price || 0),
                      custom_box_qty: parseFloat(poItem.custom_box_qty || 0),
                      custom_pieces_per_box: parseFloat(poItem.custom_pieces_per_box || 1),
                      custom_box_price: parseFloat(poItem.custom_box_price || 0),
                      qty: parseFloat(poItem.qty || 0)
                    };
                  }
                  return item;
                });
              }
            }
            mapped.items = enrichedItems;
          } catch (e) { console.error("PI Data Enrichment failed", e); }
        }

        setFormData(mapped);
        setSearchSupplier(d.supplier_name || d.supplier);
        setDocName(d.name);
        setDocStatus(parseInt(d.docstatus) || 0); // Store docstatus
        
        // Fetch linked documents if it's already created
        if (d.name) {
            fetchLinkedDocuments(d.name);
            fetchWorkflowActions(d.name); // Explicitly fetch workflow actions with the name
        }
        
        setLastSavedData(JSON.stringify(mapped)); // Set base point for dirty check
        setIsViewMode(true);
        setIsEditMode(false);
        setIsModalOpen(true);
      }
    } catch (err) {
      alert('Failed to load invoice');
    }
  }, [fetchWorkflowActions]);

  const fetchLinkedDocuments = async (name) => {
    if (!name) return;
    setLoadingLinks(true);
    try {
      const KYLE_API = '/api/method/kyle_retail.retail_api.api';
      const res = await axios.get(`${KYLE_API}.get_linked_documents`, {
        params: { doctype: 'Purchase Invoice', name },
        withCredentials: true
      });
      if (res.data.message?.success || res.data.message?.status === 'success') {
        const payload = res.data.message.data || res.data.message;
        const categories = payload.categories || {};
        
        // Flatten the categorized structure for easier UI rendering
        const flatDocs = {};
        Object.values(categories).forEach(cat => {
          Object.entries(cat).forEach(([dt, rows]) => {
            if (rows && rows.length > 0) {
              flatDocs[dt] = rows;
            }
          });
        });
        
        setLinkedDocs(flatDocs);
      }
    } catch (err) {
      console.error('Error fetching linked docs:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleCreateReturn = async () => {
    if (!docName) return;
    setSaving(true);
    try {
      const res = await axios.get(`${API_PATH}.get_mapped_doc_retail`, {
        params: {
          from_doctype: 'Purchase Invoice',
          to_doctype: 'Debit Note',
          source_name: docName
        },
        withCredentials: true
      });
      if (res.data.status === 'success') {
        const mappedData = res.data.data;
        setFormData({
          ...formData,
          ...mappedData,
          is_return: true,
          return_against: docName
        });
        setDocName('');
        setIsViewMode(false);
        setIsEditMode(false);
        setIsModalOpen(true);
      } else {
        throw new Error(res.data.message || "Mapping failed");
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!docName) return;

    try {
      const { value: formValues } = await Swal.fire({
        title: 'Make Payment',
        html:
          '<div style="text-align: left; padding: 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">' +
            '<p style="margin: 0; font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Invoice: ' + docName + '</p>' +
            '<p style="margin: 5px 0 0; font-size: 0.9rem; font-weight: 900; color: #1e293b;">' + (formData.supplier_name || formData.supplier) + '</p>' +
            '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center;">' +
              '<span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Outstanding:</span>' +
              '<span style="font-size: 1rem; font-weight: 900; color: #10b981;">AED ' + (parseFloat(formData.outstanding_amount !== undefined ? formData.outstanding_amount : formData.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="text-align: left; margin-bottom: 20px;">' +
            '<label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">Mode of Payment</label>' +
            '<select id="swal-mode" class="swal2-select" style="margin: 0; width: 100%;">' +
              '<option value="Cash">Cash</option>' +
              '<option value="Bank">Bank Transfer</option>' +
              '<option value="Cheque">Cheque</option>' +
            '</select>' +
          '</div>' +
          '<div style="text-align: left; margin-bottom: 20px;">' +
            '<label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">Payment Date</label>' +
            '<input id="swal-post-date" type="date" class="swal2-input" style="margin: 0; width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">' +
          '</div>' +
          '<div style="text-align: left; margin-bottom: 20px;">' +
            '<label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">Amount to Pay (AED)</label>' +
            '<input id="swal-amount" type="number" class="swal2-input" style="margin: 0; width: 100%;" value="' + (parseFloat(formData.outstanding_amount !== undefined ? formData.outstanding_amount : formData.grand_total) || 0).toFixed(2) + '">' +
          '</div>' +
          '<div id="ref-fields-container" style="display: none;">' +
            '<div style="text-align: left; margin-bottom: 20px;">' +
              '<label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">Reference Number (Chq/Trans ID)</label>' +
              '<input id="swal-ref-no" class="swal2-input" style="margin: 0; width: 100%;" placeholder="e.g. TXN-123456">' +
            '</div>' +
            '<div style="text-align: left; margin-bottom: 20px;">' +
              '<label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 5px;">Reference Date</label>' +
              '<input id="swal-ref-date" type="date" class="swal2-input" style="margin: 0; width: 100%;" value="' + new Date().toISOString().split('T')[0] + '">' +
            '</div>' +
          '</div>',
        didOpen: () => {
          const modeSelect = document.getElementById('swal-mode');
          const refFields = document.getElementById('ref-fields-container');
          modeSelect.addEventListener('change', () => {
            refFields.style.display = (modeSelect.value === 'Bank' || modeSelect.value === 'Cheque') ? 'block' : 'none';
          });
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Save Payment (Draft)',
        confirmButtonColor: '#eab308',
        preConfirm: () => {
          const mode = document.getElementById('swal-mode').value;
          const ref_no = document.getElementById('swal-ref-no').value;
          const ref_date = document.getElementById('swal-ref-date').value;

          if ((mode === 'Bank' || mode === 'Cheque') && !ref_no.trim()) {
            Swal.showValidationMessage(`Reference Number is required for ${mode} payments.`);
            return false;
          }

          return {
            mode,
            post_date: document.getElementById('swal-post-date').value,
            amount: document.getElementById('swal-amount').value,
            ref_no: (mode === 'Bank' || mode === 'Cheque') ? ref_no : '',
            ref_date: (mode === 'Bank' || mode === 'Cheque') ? ref_date : ''
          };
        }
      });

      if (!formValues) return;

      setSaving(true);
      
      const payload = {
        purchase_invoice: docName,
        mode_of_payment: formValues.mode,
        posting_date: formValues.post_date,
        amount: parseFloat(formValues.amount) || 0
      };

      if (formValues.mode !== 'Cash') {
        payload.reference_no = formValues.ref_no;
        payload.reference_date = formValues.ref_date;
      }

      const res = await axios.post(`${API_PATH}.create_payment_entry_from_pi`, payload, { withCredentials: true });
      
      const msg = res.data.message || res.data;
      if ((msg.success || msg.status === 'success') && msg.name) {
        Swal.fire({
          icon: 'success',
          title: 'Payment Entry Created',
          text: `Draft document ${msg.name} created successfully!`,
          confirmButtonColor: '#10b981'
        });
        fetchLinkedDocuments(docName);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: msg.message || 'Failed to create Payment Entry'
        });
      }
    } catch (err) {
      console.error('Error creating PE:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const navigateToDoc = (doctype, docname) => {
    const routes = {
      'Purchase Order': '/purchaseorder',
      'Purchase Receipt': '/purchasereceiptlist',
      'Purchase Invoice': '/purchaseinvoicelist',
    };
    const route = routes[doctype];
    if (route) {
      if (docname === docName) return; // Already on this doc
      setIsModalOpen(false); // Close current modal
      // Small timeout to allow modal to close before navigation
      setTimeout(() => {
        navigate(`${route}?name=${encodeURIComponent(docname)}`);
      }, 100);
    }
  };

  const renderConnectionsDashboard = () => {
    if (!docName || docStatus === null) return null;

    const categories = {
      "Related": ["Purchase Order", "Purchase Receipt", "Payment Entry"],
      "Reference": ["Journal Entry", "Asset", "Landed Cost Voucher"]
    };

    return (
      <div className="so-card" style={{ marginBottom: '1.5rem', border: `1px solid ${themeColor}20`, background: `${themeColor}05` }}>
        <div className="so-card-header" style={{ borderBottom: `1px solid ${themeColor}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={14} style={{ color: themeColor }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColor }}>Connections & Dashboard</span>
          </div>
          {docStatus === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={12} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Submitted</span>
            </div>
          )}
        </div>
        <div className="so-card-body" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Actions Section */}
            {docStatus === 1 && (
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Actions</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={handleCreatePayment}
                    disabled={saving}
                    className="so-btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', background: '#eab308', borderColor: '#eab308' }}
                  >
                    <Plus size={14} /> Create Payment Entry
                  </button>
                  <button 
                    onClick={handleCreateReturn}
                    disabled={saving}
                    className="so-btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    <Link size={14} /> Create Debit Note
                  </button>
                </div>
              </div>
            )}
            
            {/* Links Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
              {[...new Set(Object.values(categories).flat())].map(dt => {
                const links = linkedDocs[dt] || [];
                if (links.length === 0) return null;

                return (
                  <div key={dt} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: '160px', padding: '0.85rem', background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: `${themeColor}10`, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Link size={10} strokeWidth={2.5} />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{dt}</span>
                      </div>
                      <span style={{ padding: '0.1rem 0.4rem', background: `${themeColor}15`, color: themeColor, borderRadius: '0.5rem', fontSize: '0.6rem', fontWeight: 900 }}>{links.length}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {links.map(link => (
                        <button
                          key={link.name}
                          onClick={() => navigateToDoc(dt, link.name)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: '#1e293b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.2s'
                          }}
                          className="hover:border-indigo-300 hover:bg-white"
                          title={`View ${dt}: ${link.name}`}
                        >
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: link.docstatus === 1 ? '#10b981' : (link.docstatus === 2 ? '#ef4444' : '#f59e0b') }} />
                          <span style={{ color: themeColor }}>{link.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const openEditModal = async (invoice) => {
    await fetchPurchaseInvoice(invoice.name);
    setIsEditMode(true);
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const openViewModal = async (invoice) => {
    await fetchPurchaseInvoice(invoice.name);
    setIsViewMode(true);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleRowClick = (invoice) => {
    openViewModal(invoice);
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index] }; // important: clone

      if (field === 'custom_box_qty' || field === 'custom_pieces_per_box') {
        const box_qty = parseFloat(field === 'custom_box_qty' ? value : items[index].custom_box_qty) || 0;
        const pcs_per_box = parseFloat(field === 'custom_pieces_per_box' ? value : items[index].custom_pieces_per_box) || 1;
        const total_qty = box_qty * pcs_per_box;
        items[index].qty = total_qty;
        items[index].amount = total_qty * parseFloat(items[index].rate || 0);
        items[index][field] = value;
      } else if (field === 'qty' || field === 'rate' || field === 'custom_box_price') {
        const qty = parseFloat(field === 'qty' ? value : items[index].qty) || 0;
        const rate = parseFloat(field === 'rate' ? value : items[index].rate) || 0;
        const pPerBox = parseFloat(items[index].custom_pieces_per_box) || 1;

        if (field === 'custom_box_price') {
          const bp = parseFloat(value) || 0;
          const newRate = pPerBox > 0 ? bp / pPerBox : 0;
          items[index].rate = newRate.toFixed(2);
          items[index].amount = (qty * newRate).toFixed(2);
        } else if (field === 'rate') {
          items[index].amount = (qty * rate).toFixed(2);
          if (items[index].use_box_entry) items[index].custom_box_price = (rate * pPerBox).toFixed(2);
        } else {
          items[index].amount = (qty * rate).toFixed(2);
        }
        
        items[index][field] = value;
        // Back-calculate Box Qty if needed
        if (field === 'qty' && pPerBox > 0) items[index].custom_box_qty = qty / pPerBox;
      } else {
        items[index][field] = value;
      }

      return { ...prev, items };
    });
  };

  const addItemRow = () => setFormData(prev => ({
    ...prev,
    items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '' }]
  }));

  const removeItemRow = (index) => setFormData(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== index)
  }));

  const selectSupplier = (supplier) => {
    setFormData(prev => ({ ...prev, supplier: supplier.name, supplier_name: supplier.supplier_name }));
    setSearchSupplier(supplier.supplier_name || supplier.name);
    setShowSupplierDropdown(false);
  };

  const handleUOMChange = (uomValue, rowIndex) => {
    setFormData(prev => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      const isBox = uomValue.toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        // Box mode
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
      } else {
        // Nos mode
        item.custom_pieces_per_box = 1;
        item.qty = parseFloat(item.custom_box_qty) || 0;
      }
      item.amount = (parseFloat(item.qty) * (parseFloat(item.rate) || 0)).toFixed(2);
      
      items[rowIndex] = item;
      return { ...prev, items };
    });
  };

  const selectItem = async (rowIndex, item) => {
    setFormData(prev => {
      const items = [...prev.items];
      const isBoxUom = (item.stock_uom || '').toLowerCase() === 'box' || (item.uom || '').toLowerCase() === 'box';
      items[rowIndex] = {
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos',
        qty: isBoxUom ? (parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1)) : 1,
        rate: 0,
        amount: 0,
        custom_box_qty: 1,
        custom_pieces_per_box: isBoxUom ? (parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1)) : 1,
        default_pieces_per_box: parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1),
        custom_selling_price: parseFloat(item.custom_selling_price || 0),
        custom_supplier_sl_num: item.custom_ref_sl_no || item.custom_supplier_sl_num || item.supplier_part_no || '',
        custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
        use_box_entry: isBoxUom
      };
      return { ...prev, items };
    });

    setItemSearches(prev => ({ ...prev, [rowIndex]: '' }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));

    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: { item_code: item.item_code },
        withCredentials: true
      });
      if (res.data.message?.rate) {
        updateItem(rowIndex, 'rate', res.data.message.rate);
      }
    } catch (err) {
      console.log("No buying rate found");
    }
  };

  const handleItemSearch = (index, value) => {
    setItemSearches(prev => ({ ...prev, [index]: value }));
    if (value.trim().length > 1) {
      fetchItems(value);
      setShowItemDropdowns(prev => ({ ...prev, [index]: true }));
    } else {
      setShowItemDropdowns(prev => ({ ...prev, [index]: false }));
    }
  };

  const getPayload = async () => {
    // Calculate net total before discount
    const itemsTotal = formData.items
      .filter(i => i.item_code && i.qty > 0)
      .reduce((sum, i) => sum + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0);

    const discountAmountCalc = formData.additional_discount_percentage > 0
      ? (itemsTotal * formData.additional_discount_percentage) / 100
      : parseFloat(formData.discount_amount) || 0;

    const netTotalCalc = itemsTotal - discountAmountCalc;

    // Build taxes array from taxPreview
    const taxes = taxPreview.map(tax => ({
      charge_type: "On Net Total",        // or "Actual" if needed
      account_head: tax.account_head,
      rate: parseFloat(tax.rate || 0),
      tax_amount: netTotalCalc * (parseFloat(tax.rate || 0) / 100),
      description: tax.description || tax.account_head
    }));

    return {
      name: docName || undefined,
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      due_date: formData.due_date || null,
      bill_no: formData.bill_no || null,
      update_stock: formData.update_stock ? 1 : 0,
      accepted_warehouse: formData.update_stock ? formData.accepted_warehouse : null,
      rejected_warehouse: formData.update_stock ? formData.rejected_warehouse : null,
      is_subcontracted: formData.is_subcontracted ? 1 : 0,
      apply_discount_on: formData.apply_discount_on,
      additional_discount_percentage: formData.additional_discount_percentage > 0 ? parseFloat(formData.additional_discount_percentage) : null,
      discount_amount: formData.discount_amount > 0 ? parseFloat(formData.discount_amount) : null,
      taxes_and_charges: formData.taxes_and_charges || null,
      taxes: taxes.length > 0 ? taxes : null,
      items: formData.items
        .filter(i => i.item_code && i.qty > 0)
        .map(i => {
          const isBox = (i.uom || '').toLowerCase() === 'box' || !!i.use_box_entry;
          return {
            name: i.name || undefined,
            doctype: "Purchase Invoice Item",
            item_code: i.item_code,
            qty: parseFloat(i.qty) || 1,
            rate: parseFloat(i.rate || 0),
            custom_box_qty: isBox ? parseFloat(i.custom_box_qty || 0) : parseFloat(i.qty),
            custom_pieces_per_box: isBox ? parseFloat(i.custom_pieces_per_box || 1) : 1,
            custom_box_price: isBox ? parseFloat(i.custom_box_price || 0) : parseFloat(i.rate || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_supplier_sl_num: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            purchase_order: i.purchase_order || undefined,
            purchase_order_item: i.purchase_order_item || undefined,
            purchase_receipt: i.purchase_receipt || undefined,
          };
        }),
    };
  };

  const handleSaveDraft = async () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const payload = await getPayload();

    try {
      let response;
      const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
      if (docName) {
        // Existing draft → UPDATE (PUT)
        response = await axios.put(`${RESOURCE_API}/${docName}`, payload, { withCredentials: true });
        alert(`Draft updated: ${docName}`);
      } else {
        // New → CREATE (POST) using create_generic_doc
        response = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: payload
        }, { withCredentials: true });
        const apiResp = response.data.message || response.data;
        if (apiResp.name) {
          setDocName(apiResp.name);
          alert(`Draft saved: ${apiResp.name}`);
        } else {
          throw new Error('Failed to create draft');
        }
      }
      setDocStatus(0); // Set as draft after save
      setLastSavedData(JSON.stringify(formData));
      fetchInvoices();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.exception || 'Save failed';
      alert("Error: " + msg);
      console.error(err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    const payload = await getPayload();
    try {
      let name = docName;
      if (!name) {
        const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
        // First save as draft using generic doc creator
        const createRes = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: payload
        }, { withCredentials: true });
        const apiResp = createRes.data.message || createRes.data;
        if (!apiResp.name) throw new Error('Create failed');
        name = apiResp.name;
        setDocName(name);
      }
      // Submit
      await axios.put(`${RESOURCE_API}/${name}`, { docstatus: 1 }, { withCredentials: true });
      alert(`Purchase Invoice Submitted: ${name}`);
      setIsModalOpen(false);
      setDocName('');
      setDocStatus(null);
      fetchInvoices();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.exception || 'Submit failed';
      alert("Error: " + msg);
      console.error(err.response?.data);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name) => {
    handleDocAction('delete');
  };

  const handleCancel = async (name) => {
     handleDocAction('cancel');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDocName('');
    setDocStatus(null);
    setIsEditMode(false);
    setIsViewMode(false);
    setFormErrors({});
    setBarcodeInput('');
    setSearchParams({}); // Added to clear URL and prevent re-opening
  };

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const matchesName = !filterName || inv.name.toLowerCase().includes(filterName.toLowerCase());
    const matchesSupplier = !filterSupplier || inv.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
    const matchesStatus = !filterStatus || inv.status === filterStatus;
    const matchesFrom = !filterDateFrom || new Date(inv.posting_date) >= new Date(filterDateFrom);
    const matchesTo = !filterDateTo || new Date(inv.posting_date) <= new Date(filterDateTo);
    return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
  }), [invoices, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredInvoices.length;
  const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const map = { Paid: 'status-paid', Unpaid: 'status-unpaid', Overdue: 'status-overdue', Draft: 'status-draft', Return: 'status-return', Cancelled: 'status-cancelled' };
    return map[status] || 'status-default';
  };

  const clearFilters = () => {
    setFilterName(''); setFilterSupplier(''); setFilterStatus('');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  useEffect(() => {
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart));
      const nameFromUrl = params.get('name');
      if (nameFromUrl) {
        setTimeout(() => openEditModal({ name: nameFromUrl }), 500);
      }
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchTaxTemplates();
    fetchWarehouses(); 
  }, []);

  useEffect(() => {
    const nameParam = searchParams.get('name');
    const prParam   = searchParams.get('pr');

    if (nameParam === 'new') {
      if (!isModalOpen) {
        openCreateModal();
      }
    } else if (nameParam) {
      if (nameParam !== docName || !isModalOpen) {
        fetchPurchaseInvoice(nameParam);
      }
    } else if (prParam) {
      if (!isModalOpen || formData.purchase_receipt !== prParam) {
        createPIFromPR(prParam);
      }
    } else {
      // If no params, ensure modal is closed
      if (isModalOpen) {
        setIsModalOpen(false);
        setDocName('');
        setDocStatus(null);
        setIsEditMode(false);
        setIsViewMode(false);
        setFormErrors({});
        setAllowedActions([]);
      }
    }
  }, [searchParams, openCreateModal, createPIFromPR, fetchPurchaseInvoice]);

  useEffect(() => {
    const supplierParam = searchParams.get('supplier');
    if (supplierParam) {
      setFilterSupplier(supplierParam);
      setShowFilters(true);
    }
  }, [searchParams]);

  return (
    <>
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Package size={20} style={{ color: themeColor }} /> 
              Purchase Invoices
            </h1>
            <p className="so-page-subtitle">{total} total record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setPiTheme(isGreen ? 'blue' : 'green')}
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
              {piTheme.toUpperCase()}
            </button>

            <button onClick={() => setSearchParams({ name: 'new' })} className="so-btn-primary">
              <Plus size={16} /> Create Invoice
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
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Invoice Number</label>
              <input
                type="text"
                placeholder="Search invoice..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label">Supplier</label>
              <input
                type="text"
                placeholder="Search supplier..."
                value={filterSupplier}
                onChange={e => setFilterSupplier(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="so-filter-input"
                style={{ padding: '0.45rem' }}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Return">Return</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <button onClick={clearFilters} className="so-clear-btn" style={{ margin: 0, height: '38px' }}>
              Clear
            </button>
          </div>

          {/* Table Area */}
          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{total} record(s) found</p>
            <div className="so-table-card">
              {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                  <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading invoices...</p>
                </div>
              ) : (
                <>
                  <div className="so-table-wrapper">
                    <table className="so-table">
                      <thead>
                        <tr>
                          <th>Invoice Number</th>
                          <th>Supplier</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="so-empty">
                              <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                              <p>No invoices found</p>
                              <button onClick={openCreateModal} style={{ color: themeColor, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                Create your first invoice
                              </button>
                            </td>
                          </tr>
                        ) : (
                          paginated.map(inv => (
                            <tr key={inv.name} onClick={() => setSearchParams({ name: inv.name })} style={{ cursor: 'pointer' }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <a 
                                    href={`/#/purchaseinvoicelist?name=${inv.name}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open in new tab"
                                    style={{ color: themeColor, textDecoration: 'none' }}
                                  >
                                    <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                  </a>
                                  <span style={{ fontWeight: 700, color: themeColor }}>{inv.name}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{inv.supplier_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.supplier}</div>
                              </td>
                              <td>
                                <span style={{ color: '#475569', fontSize: '0.85rem' }}>{format(new Date(inv.posting_date), 'dd MMM yyyy')}</span>
                              </td>
                              <td>
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                  backgroundColor: inv.status === 'Paid' ? `${themeColor}20` : (inv.status === 'Unpaid' ? '#fef9c3' : (inv.status === 'Draft' ? '#f1f5f9' : '#fee2e2')),
                                  color: inv.status === 'Paid' ? themeColor : (inv.status === 'Unpaid' ? '#854d0e' : (inv.status === 'Draft' ? '#64748b' : '#ef4444')),
                                  border: `1px solid ${inv.status === 'Paid' ? `${themeColor}40` : (inv.status === 'Unpaid' ? '#fde047' : (inv.status === 'Draft' ? '#e2e8f0' : '#fecaca'))}`
                                }}>
                                  {inv.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                AED {inv.grand_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div ref={el => actionsRefs.current[inv.name] = el} style={{ position: 'relative' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
                                    onClick={() => setShowActions(showActions === inv.name ? null : inv.name)}
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {showActions === inv.name && (
                                    <div style={{
                                      position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                                      zIndex: 100, background: '#fff', border: '1px solid var(--so-border)',
                                      borderRadius: '0.5rem', boxShadow: 'var(--so-shadow)',
                                      minWidth: '120px', overflow: 'hidden'
                                    }}>
                                      {inv.status === 'Draft' && (
                                        <button
                                          style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer' }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                          onClick={() => handleDelete(inv.name)}
                                        >
                                          Delete
                                        </button>
                                      )}
                                      {inv.status !== 'Draft' && inv.status !== 'Cancelled' && (
                                        <button
                                          style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer' }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                          onClick={() => handleCancel(inv.name)}
                                        >
                                          Cancel
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {total > 0 && (
                    <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                          {[20, 50, 100].map(s => (
                            <button key={s} onClick={() => { setPageSize(s); setCurrentPage(1); }} className={`so-page-btn ${pageSize === s ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{s}</button>
                          ))}
                        </div>

                        <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                          <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {isModalOpen && (
          <div className="so-modal-overlay" onClick={closeModal} style={{ padding: 0, zIndex: 10500, top: '74px', height: 'calc(100vh - 74px)', background: 'white' }}>
            <div className="so-modal" style={{ maxWidth: 'none', width: '100vw', height: '100%', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="so-modal-header" style={{ padding: '0.85rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, tracking: 'tight', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isViewMode ? 'View' : (docName ? 'Edit' : 'New')} Purchase Invoice
                    </h2>
                    {formData.name && <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{formData.name} • Accounts</p>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* NEW DOC — not yet saved (docName is empty) */}
                    {!docName && (
                      <button 
                        onClick={() => handleDocAction('save')} 
                        disabled={saving} 
                        className="so-btn-primary" 
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                      >
                        {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                      </button>
                    )}

                    {/* DRAFT PHASE — allowedActions from get_document_status_details */}
                    {docName && formData.docstatus === 0 && (
                      <>
                        {/* UPDATE DRAFT — when dirty and server allows save */}
                        {(allowedActions.includes('save') && isDirty) && !isViewMode && (
                          <button 
                            onClick={() => handleDocAction('save')} 
                            disabled={saving} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                          </button>
                        )}

                        {/* SUBMIT — when server allows and no unsaved changes (or in view mode) */}
                        {allowedActions.includes('submit') && (!isDirty || isViewMode) && (
                          <button 
                            onClick={() => handleDocAction('submit')} 
                            disabled={saving} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'SUBMIT'}
                          </button>
                        )}

                        {/* EDIT DRAFT — view mode only */}
                        {isViewMode && (
                          <button 
                            onClick={() => setIsViewMode(false)} 
                            className="so-btn-secondary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                          >
                             <Edit2 size={14} /> EDIT DRAFT
                          </button>
                        )}

                        {/* DELETE */}
                        {allowedActions.includes('delete') && (
                          <button 
                            onClick={() => handleDocAction('delete')} 
                            className="so-btn-ghost" 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase' }}
                          >
                            <Trash2 size={14} /> DELETE
                          </button>
                        )}
                      </>
                    )}

                    {/* SUBMITTED PHASE */}
                    {docName && formData.docstatus === 1 && (
                      <>
                        {allowedActions.includes('cancel') && (
                          <button 
                            onClick={() => handleDocAction('cancel')} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}
                          >
                            CANCEL
                          </button>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', background: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #10b98140', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>
                          <CheckCircle2 size={14} /> SUBMITTED
                        </div>
                      </>
                    )}

                    {/* CANCELLED PHASE */}
                    {docName && formData.docstatus === 2 && (
                      <>
                        {allowedActions.includes('amend') && (
                          <button 
                            onClick={() => handleDocAction('amend')} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)' }}
                          >
                            AMEND
                          </button>
                        )}
                        <div style={{ padding: '0.45rem 1rem', background: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', fontWeight: 900, borderRadius: '0.5rem', textTransform: 'uppercase' }}>
                          CANCELLED
                        </div>
                      </>
                    )}
                    <button 
                      onClick={closeModal} 
                      className="so-btn-secondary" 
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                    >
                      CLOSE
                    </button>
                  </div>
                  <button onClick={closeModal} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.25rem 2rem' }}>
                {renderConnectionsDashboard()}
                {/* Basic Details Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Basic Details</p>
                  </div>
                  <div className="so-card-body">
                    <div className="so-form-grid">
                      <div className="so-field">
                        <label className="so-label">Supplier {!isViewMode && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        <CustomSearchDropdown
                          placeholder="Search and select supplier..."
                          value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                          onSelect={selectSupplier}
                          fetchData={fetchSuppliersAPI}
                          createOption={handleSupplierCreate}
                          optionsLabel="supplier_name"
                        />
                        {formErrors.supplier && <span className="so-error-text">{formErrors.supplier}</span>}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Posting Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="date"
                            value={formData.posting_date}
                            onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                            className="so-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Due Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="date"
                            value={formData.due_date}
                            onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                            className="so-input"
                            style={{ paddingLeft: '2.5rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Bill Number</label>
                        <input
                          type="text"
                          value={formData.bill_no}
                          onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                          placeholder="Enter bill number..."
                          className="so-input"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barcode Scanner Card */}
                {!isViewMode && (
                  <div className="so-card" style={{ border: `1px dashed ${themeColor}`, background: `${themeColor}05` }}>
                    <div className="so-card-body" style={{ padding: '1rem 1.5rem' }}>
                      <div className="so-form-grid" style={{ gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ background: themeColor, color: 'white', padding: '0.5rem', borderRadius: '0.5rem' }}>
                            <Barcode size={20} />
                          </div>
                          <div>
                            <p style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColor }}>Quick Scan</p>
                            <p style={{ fontSize: '0.65rem', opacity: 0.6 }}>Add items instantly</p>
                          </div>
                        </div>
                        <input
                          ref={barcodeRef}
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={handleBarcodeScan}
                          placeholder="Place cursor here and scan barcode..."
                          className="so-input"
                          style={{ height: '42px', fontSize: '0.9rem', borderStyle: 'dashed' }}
                          disabled={barcodeLoading}
                          autoFocus
                        />
                        {barcodeLoading && <Loader2 className="so-spinner" size={20} />}
                      </div>
                    </div>
                  </div>
                )}
                {/* Stock Controls Card */}
                <div className="so-card">
                  <div className="so-card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: isViewMode ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={formData.update_stock}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              update_stock: checked,
                              accepted_warehouse: checked ? (prev.accepted_warehouse || warehouses[0]?.name || '') : '',
                            }));
                          }}
                          disabled={isViewMode}
                          style={{ width: '1.2rem', height: '1.2rem', accentColor: themeColor }}
                        />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>Update Stock</p>
                          <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>Receive items into inventory upon submission</p>
                        </div>
                      </label>

                      {formData.update_stock && (
                        <div className="so-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr) auto', alignItems: 'end' }}>
                          <div className="so-field">
                            <label className="so-label">Accepted Branch</label>
                            <select
                              value={formData.accepted_warehouse}
                              onChange={e => setFormData(prev => ({ ...prev, accepted_warehouse: e.target.value }))}
                              className="so-select"
                              disabled={isViewMode}
                            >
                              <option value="">Select Branch</option>
                              {warehouses.map(w => (
                                <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Rejected Branch</label>
                            <select
                              value={formData.rejected_warehouse}
                              onChange={e => setFormData(prev => ({ ...prev, rejected_warehouse: e.target.value }))}
                              className="so-select"
                              disabled={isViewMode}
                            >
                              <option value="">None</option>
                              {warehouses.map(w => (
                                <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isViewMode ? 'not-allowed' : 'pointer', marginBottom: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={formData.is_subcontracted}
                              onChange={e => setFormData(prev => ({ ...prev, is_subcontracted: e.target.checked }))}
                              disabled={isViewMode}
                              style={{ accentColor: themeColor }}
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Subcontracted</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Items</p>
                    {!isViewMode && <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                      <Plus size={14} /> Add Row
                    </button>}
                  </div>
                  <div className="so-card-body">
                    <div className="so-table-wrapper" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)', boxShadow: 'none' }}>
                      <table className="so-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                            {(() => {
                              const hasAnyBox = formData.items.some(i => i.use_box_entry);
                              const activeCols = columnConfig.filter(c => {
                                if (!c.visible) return false;
                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                return true;
                              });
                              
                              return activeCols.map(col => {
                                let finalLabel = col.label;
                                if (!hasAnyBox) {
                                  if (col.id === 'custom_box_qty') finalLabel = 'Qty';
                                }

                                return (
                                  <th
                                    key={col.id}
                                    style={{ 
                                      width: col.width, 
                                      minWidth: col.id === 'item_code' ? 200 : undefined,
                                      textAlign: ['rate', 'amount', 'custom_selling_price', 'custom_box_price'].includes(col.id) ? 'right' : 
                                                 ['custom_box_qty', 'custom_pieces_per_box', 'qty', 'uom', 'custom_ref_sl_no', 'custom_supplier_sl_num'].includes(col.id) ? 'center' : 'left'
                                    }}
                                  >
                                    {finalLabel}
                                  </th>
                                );
                              });
                            })()}
                            <th style={{ width: '40px', textAlign: 'center' }}>
                              {!isViewMode && (
                                <button type="button" onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Configure Columns">
                                  <Settings size={16} />
                                </button>
                              )}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>
                              
                              {(() => {
                                const hasAnyBox = formData.items.some(i => i.use_box_entry);
                                const activeCols = columnConfig.filter(c => {
                                  if (!c.visible) return false;
                                  if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                  return true;
                                });
                                
                                return activeCols.map(col => {
                                  switch (col.id) {
                                  case 'custom_box_qty':
                                    return (
                                      <td key={col.id}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                          {isViewMode ? (
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', color: item.use_box_entry ? themeColor : '#1e293b' }}>
                                              {item.use_box_entry ? (item.custom_box_qty || 0) : (item.qty || 0)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.use_box_entry ? (item.custom_box_qty || 0) : (item.qty || 0)}
                                              onChange={e => updateItem(i, item.use_box_entry ? 'custom_box_qty' : 'qty', e.target.value)}
                                              className="so-input"
                                              style={{ textAlign: 'center', height: '36px', border: item.use_box_entry ? `1px solid ${themeColor}40` : '1px solid #e2e8f0' }}
                                            />
                                          )}
                                          {item.item_code && (
                                            <div style={{ fontSize: '0.55rem', fontWeight: 800, color: item.use_box_entry ? themeColor : '#94a3b8' }}>
                                              {item.use_box_entry ? 'BOXES' : 'NOS'}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  case 'custom_pieces_per_box':
                                    return (
                                      <td key={col.id}>
                                        {item.use_box_entry ? (
                                          isViewMode ? (
                                              <div style={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>{(item.custom_pieces_per_box || 1)}</div>
                                            ) : (
                                              <input
                                                type="number"
                                                value={item.custom_pieces_per_box || 1}
                                                onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)}
                                                className="so-input"
                                                style={{ textAlign: 'center', height: '36px' }}
                                              />
                                            )
                                        ) : (
                                          <div style={{ textAlign: 'center', color: '#cbd5e1', fontWeight: 'bold' }}>—</div>
                                        )}
                                      </td>
                                    );
                                  case 'item_code':
                                    return (
                                      <td key={col.id} style={{ position: 'relative' }}>
                                        <div ref={el => itemRefs.current[i] = el}>
                                          {isViewMode ? (
                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{item.item_code}</div>
                                          ) : (
                                            <CustomSearchDropdown
                                              value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                              placeholder="Search..."
                                              onSelect={(val) => selectItem(i, val)}
                                              fetchData={fetchItemsAPI}
                                              themeColor={themeColor}
                                              optionsLabel="name"
                                            />
                                          )}
                                          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 500 }}>{item.item_name}</div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_ref_sl_no':
                                      return (
                                        <td key={col.id}>
                                          <input
                                            type="text"
                                            value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                            onChange={e => updateItem(i, 'custom_ref_sl_no', e.target.value)}
                                            className="so-input"
                                            style={{ textAlign: 'center', height: '36px', fontSize: '0.75rem' }}
                                            placeholder="REF / SL #"
                                            disabled={isViewMode}
                                          />
                                        </td>
                                      );
                                  case 'qty':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
                                        {isViewMode ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', color: themeColor }}>{item.qty}</div>
                                            {item.use_box_entry && <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>NOS</div>}
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <input
                                              type="number"
                                              value={item.qty}
                                              onChange={e => updateItem(i, 'qty', e.target.value)}
                                              className="so-input"
                                              style={{ height: '36px', textAlign: 'center', fontWeight: 'bold' }}
                                            />
                                            {item.use_box_entry && <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>NOS</div>}
                                          </div>
                                        )}
                                      </td>
                                    );
                                  case 'uom':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
                                        {isViewMode ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span className="text-[10px] font-bold text-slate-700 uppercase">
                                              {item.use_box_entry ? 'BOX' : (item.uom || 'NOS')}
                                            </span>
                                          </div>
                                        ) : (
                                          <select
                                            value={item.uom || ''}
                                            onChange={(e) => handleUOMChange(e.target.value, i)}
                                            style={{ 
                                              width: '100%', textAlign: 'center', fontSize: '0.75rem', 
                                              fontWeight: 'bold', color: '#475569', background: '#fff', 
                                              border: '1px solid #e2e8f0', borderRadius: '0.25rem', 
                                              cursor: 'pointer', outline: 'none', padding: '2px' 
                                            }}
                                          >
                                            {(item.uom_list && item.uom_list.length > 0 ? item.uom_list : [{ uom: item.uom || 'Nos' }]).map(u => (
                                              <option key={u.uom} value={u.uom}>{u.uom}</option>
                                            ))}
                                            {!item.uom_list?.some(u => u.uom === 'Box') && <option value="Box">Box</option>}
                                            {!item.uom_list?.some(u => u.uom === (item.uom || 'Nos')) && <option value={item.uom || 'Nos'}>{item.uom || 'Nos'}</option>}
                                          </select>
                                        )}
                                      </td>
                                    );
                                  case 'custom_box_price':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'right' }}>
                                        {item.use_box_entry ? (
                                          isViewMode ? (
                                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.85rem' }}>{formatPrice(item.custom_box_price)}</span>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.custom_box_price || 0}
                                              onChange={e => updateItem(i, 'custom_box_price', e.target.value)}
                                              className="so-input"
                                              style={{ textAlign: 'right', height: '36px' }}
                                              step="0.01"
                                            />
                                          )
                                        ) : (
                                          <span style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', paddingRight: '0.5rem' }}>—</span>
                                        )}
                                      </td>
                                    );
                                  case 'rate':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'right' }}>
                                        {isViewMode ? (
                                          <span style={{ fontWeight: 800, color: themeColor, fontSize: '0.85rem' }}>{formatPrice(item.rate)}</span>
                                        ) : (
                                          <input
                                            type="number"
                                            value={item.rate}
                                            onChange={e => updateItem(i, 'rate', e.target.value)}
                                            className="so-input"
                                            style={{ textAlign: 'right', height: '36px' }}
                                            step="0.01"
                                          />
                                        )}
                                      </td>
                                    );
                                  case 'custom_selling_price':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'right' }}>
                                        <input
                                          type="number"
                                          value={item.custom_selling_price || 0}
                                          onChange={e => updateItem(i, 'custom_selling_price', e.target.value)}
                                          className="so-input"
                                          style={{ textAlign: 'right', height: '36px', color: '#6366f1', fontWeight: 'bold' }}
                                          placeholder="Selling"
                                          disabled={isViewMode}
                                        />
                                      </td>
                                    );
                                  case 'amount':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 900, color: '#1e293b', fontSize: '0.85rem' }}>{formatPrice(item.amount)}</span>
                                      </td>
                                    );
                                  }
                                });
                              })()}
                              
                              <td style={{ textAlign: 'center' }}>
                                {!isViewMode && (
                                  <button onClick={() => removeItemRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }}>
                                    <X size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Discounts & Taxes Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Left Column: Discounts & Tax Selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="so-card">
                      <div className="so-card-header">
                        <p className="so-card-title">Discounts & Rounding</p>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <div className="so-field" style={{ gridColumn: 'span 2' }}>
                            <label className="so-label">Apply Discount On</label>
                            <select
                              value={formData.apply_discount_on}
                              onChange={e => setFormData(prev => ({ ...prev, apply_discount_on: e.target.value }))}
                              disabled={isViewMode}
                              className="so-select"
                            >
                              <option>Grand Total</option>
                              <option>Net Total</option>
                            </select>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount (%)</label>
                            <input
                              type="number"
                              value={formData.additional_discount_percentage}
                              onChange={e => setFormData(prev => ({ ...prev, additional_discount_percentage: e.target.value, discount_amount: 0 }))}
                              className="so-input"
                              min="0" max="100" step="0.01"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount Amount</label>
                            <input
                              type="number"
                              value={formData.discount_amount}
                              onChange={e => setFormData(prev => ({ ...prev, discount_amount: e.target.value, additional_discount_percentage: 0 }))}
                              className="so-input"
                              min="0" step="0.01"
                              disabled={isViewMode}
                            />
                          </div>
                          <div className="so-field" style={{ gridColumn: 'span 2' }}>
                            <label className="so-label">Tax Template</label>
                            <select
                              value={formData.taxes_and_charges}
                              onChange={e => setFormData(prev => ({ ...prev, taxes_and_charges: e.target.value }))}
                              disabled={isViewMode || loadingTaxTemplates}
                              className="so-select"
                            >
                              <option value="">No Tax</option>
                              {taxTemplates.map(t => (
                                <option key={t.name} value={t.name}>{t.title || t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Taxes Table Card */}
                    {taxPreview.length > 0 && (
                      <div className="so-card">
                        <div className="so-card-header">
                          <p className="so-card-title">Taxes & Charges</p>
                        </div>
                        <div className="so-card-body">
                          <div className="so-table-wrapper" style={{ boxShadow: 'none', border: '1px solid var(--so-border)', marginTop: 0 }}>
                            <table className="so-items-table">
                              <thead>
                                <tr>
                                  <th>Type</th>
                                  <th>Account</th>
                                  <th style={{ textAlign: 'center' }}>Rate</th>
                                  <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {taxPreview.map((tax, i) => (
                                  <tr key={i}>
                                    <td><span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '1rem', background: '#e0f2fe', color: '#0369a1' }}>ACTUAL</span></td>
                                    <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>{tax.account_head?.split(' - ')[0]}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{tax.rate}%</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                                                            {formatPrice(netTotal * (parseFloat(tax.rate || 0) / 100))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Totals Summary */}
                  <div className="so-card" style={{
                    background: isGreen
                      ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                      : 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
                    color: 'white',
                    height: '100%'
                  }}>
                    <div className="so-card-header" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                      <p className="so-card-title" style={{ color: 'white' }}>Final Summary</p>
                    </div>
                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.9rem' }}>
                        <span>Subtotal</span>
                        <span style={{ fontWeight: 700 }}>AED {formatPrice(subtotal)}</span>
                      </div>

                      {discountAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fda4af' }}>
                          <span>Total Discount</span>
                          <span style={{ fontWeight: 700 }}>- AED {formatPrice(discountAmount)}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.9rem' }}>
                        <span>Tax Total</span>
                        <span style={{ fontWeight: 700 }}>AED {formatPrice(taxTotal)}</span>
                      </div>

                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '1rem', fontWeight: 500 }}>Grand Total</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.75rem', fontWeight: 900, display: 'block', lineHeight: 1 }}>
                            AED {formatPrice(grandTotal)}
                          </span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inc. All Taxes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
      {showColConfig && (
        <ColumnConfigModal
          isOpen={showColConfig}
          config={columnConfig}
          onUpdate={handleColConfigUpdate}
          onClose={() => setShowColConfig(false)}
          themeColor={themeColor}
          doctype="Purchase Invoice"
        />
      )}
    </>
  );
}

export default PurchaseInvoiceList;