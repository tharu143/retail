import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, X, Trash2, Building2, Search, Calendar, Filter, MoreVertical, Package,
  Warehouse as WarehouseIcon, Percent, DollarSign, Loader2, Barcode, Palette, ChevronLeft, ChevronRight, Zap, CheckCircle2, ExternalLink, Link, Edit2, Settings, Copy, ChevronDown
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import AttachmentSection from './AttachmentSection';
import ListCustomizer from './ListCustomizer';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

// Custom APIs (moved to standardized path)
const API_PATH = '/api/method/kyle_retail.retail_api.api';
const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const RESOURCE_API = '/api/resource/Purchase Invoice';
const RESOURCE_BASE = '/api/resource';

const DEFAULT_PI_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
  { id: 'item_name', label: 'Item Name', visible: false, width: 150 },
  { id: 'custom_ref_sl_no', label: 'Ref / Supplier SL #', visible: true, width: 120 },
  { id: 'custom_box_qty', label: 'Box Qty', visible: true, width: 90 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price (Nos)', visible: true, width: 100 },
  { id: 'custom_box_selling_price', label: 'Selling Price (Box)', visible: true, width: 100 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 }
];

const getLocalISODate = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
};

const getDefaultTaxTemplate = (templates, activeWarehouse) => {
  if (!templates || templates.length === 0) return '';

  // Try to find the company abbreviation suffix from the warehouse name (e.g. "Main Store - KSPL" -> "KSPL")
  const companyAbbr = activeWarehouse && activeWarehouse.includes(' - ')
    ? activeWarehouse.split(' - ').pop()
    : '';

  // 1. Tries to match a 5% VAT template containing the active company suffix (e.g. "UAE VAT 5% - KSPL")
  if (companyAbbr) {
    const target = templates.find(t =>
      t.name.toLowerCase().includes('5%') && t.name.toLowerCase().includes(companyAbbr.toLowerCase())
    );
    if (target) return target.name;
  }

  // 2. Tries to match any template containing "VAT 5%" or "5%" (case-insensitive)
  const target5Percent = templates.find(t =>
    t.name.toLowerCase().includes('vat 5%') || t.name.toLowerCase().includes('5%')
  );
  if (target5Percent) return target5Percent.name;

  // 3. Fallback to the first available tax template
  return templates[0]?.name || '';
};

function PurchaseInvoiceList() {
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Purchase Invoice');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
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
  const { theme, warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

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
        // Rebuild from DEFAULT_PI_COLUMNS so order in saved is respected,
        // but any NEW columns added to DEFAULT that are missing from saved
        // are always appended so they appear in Configure Columns panel.
        const merged = DEFAULT_PI_COLUMNS.map(defCol => {
          const savedCol = parsed.find(c => c.id === defCol.id);
          if (savedCol) {
            return { ...defCol, visible: savedCol.visible, width: savedCol.width };
          }
          // New column not in saved config → use default (visible)
          return defCol;
        });
        return merged;
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_PI_COLUMNS;
  };
  const [columnConfig, setColumnConfig] = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      // Reset to defaults
      setColumnConfig([...DEFAULT_PI_COLUMNS]);
      localStorage.removeItem('pi_column_config');
    } else {
      setColumnConfig(newConfig);
      localStorage.setItem('pi_column_config', JSON.stringify(newConfig));
    }
  };

  // One-time migration: if saved column config is missing new columns, clear it so defaults apply
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pi_column_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const requiredCols = ['custom_selling_price', 'custom_box_selling_price'];
        const hasAll = requiredCols.every(id => parsed.some(c => c.id === id));
        if (!hasAll) {
          localStorage.removeItem('pi_column_config');
          setColumnConfig([...DEFAULT_PI_COLUMNS]);
        }
      }
    } catch (e) { /* ignore */ }
  }, []);

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
        params: { query: query || undefined, warehouse: !isAdmin ? warehouse : undefined },
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
        params: { query: query || undefined, warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      return Array.isArray(res.data.message) ? res.data.message : [];
    } catch (err) {
      return [];
    }
  };

  // NEW: Warehouses State (filtered for non-group)
  const [warehouses, setWarehouses] = useState([]);

  const initialState = {
    name: '', supplier: '', supplier_name: '',
    posting_date: getLocalISODate(),
    due_date: '', bill_no: '',
    update_stock: true,
    accepted_warehouse: warehouse || '',
    rejected_warehouse: '',
    is_subcontracted: false,
    apply_discount_on: 'Grand Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    taxes_and_charges: '',
    items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_selling_price: 0 }],
    docstatus: 0
  };

  const [formData, setFormData] = useState(initialState);

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

  const location = useLocation();
  const [filterName, setFilterName] = useState(location.state?.search || '');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState({});
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createDropdownRef = useRef(null);

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
        const boxQty = parseFloat(i.custom_box_qty || 0);
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
          po_detail: i.purchase_order_item || undefined,
          purchase_receipt: pr.name,
          purchase_receipt_item: i.name,
          pr_detail: i.name || undefined,
          use_box_entry: isBoxUom,
        };
      });

      setFormData({
        name: '',
        supplier: pr.supplier || '',
        supplier_name: pr.supplier_name || pr.supplier || '',
        posting_date: pr.posting_date || getLocalISODate(),
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
        items: mappedItems.length > 0 ? mappedItems : [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '' }],
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

  // NEW: Auto-set default accepted warehouse if needed based on logged-in user
  useEffect(() => {
    if (formData.accepted_warehouse === '' && warehouses.length > 0) {
      const userWarehouse = localStorage.getItem('warehouse');
      const defaultWh = (userWarehouse && warehouses.some(w => w.name === userWarehouse))
        ? userWarehouse
        : warehouses[0].name;
      setFormData(prev => ({ ...prev, accepted_warehouse: defaultWh }));
    }
  }, [warehouses, formData.accepted_warehouse]);

  useEffect(() => {
    if (docName) fetchWorkflowActions();
  }, [docName, docStatus]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target)) {
        setShowCreateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [createDropdownRef]);



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
          // Always keep searchParams URL in sync with the current active document
          setSearchParams({ name: nextDoc });
          if (nextDoc !== docName) {
            await fetchPurchaseInvoice(nextDoc);
          } else {
            await fetchPurchaseInvoice(docName);
          }
          if (action === 'amend') {
            setIsEditMode(true);
            setIsViewMode(false);
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
        params: { warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      const whs = Array.isArray(res.data.message) ? res.data.message : [];
      setWarehouses(whs);
      if (whs.length > 0 && !formData.accepted_warehouse) {
        const userWarehouse = localStorage.getItem('warehouse');
        const defaultWh = (userWarehouse && whs.some(w => w.name === userWarehouse))
          ? userWarehouse
          : whs[0].name;
        setFormData(prev => ({ ...prev, accepted_warehouse: defaultWh }));
      }
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
        const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
        const res = await axios.get(`${API_PATH}.get_item_by_barcode_pi?${warehouseParam}`, {
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
        params: {
          limit: 2000,
          limit_page_length: 2000,
          order_by: 'modified desc',
          warehouse: !isAdmin ? warehouse : undefined,
          extra_fields: JSON.stringify(customColumns)
        },
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

      // Filter out templates not matching the active company's warehouse suffix
      const companyAbbr = warehouse && warehouse.includes(' - ') ? warehouse.split(' - ').pop() : 'NS';
      const filteredTemplates = templates.filter(t => t.name.includes(`- ${companyAbbr}`));
      setTaxTemplates(filteredTemplates);

      // Auto-set default 5% tax for NEW documents if nothing selected
      if (!docName && !formData.taxes_and_charges && filteredTemplates.length > 0) {
        const defaultTaxName = getDefaultTaxTemplate(filteredTemplates, warehouse);
        if (defaultTaxName) {
          setFormData(prev => ({ ...prev, taxes_and_charges: defaultTaxName }));
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
        params: { query: query || undefined, warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      setSuppliers(Array.isArray(res.data.message) ? res.data.message : []);
    } catch (err) { setSuppliers([]); }
  };

  const fetchItems = async (query = '') => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_items_for_pi`, {
        params: { query: query || undefined, warehouse: !isAdmin ? warehouse : undefined },
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
        const res = await axios.get(
          '/api/method/kyle_retail.retail_api.api.get_tax_template_details',
          {
            params: { template_name: formData.taxes_and_charges },
            withCredentials: true
          }
        );
        // Frappe whitelisted endpoint returns result in 'message' field
        setTaxPreview(res.data.message?.taxes || []);
      } catch (err) {
        console.warn("Tax template not found or invalid:", formData.taxes_and_charges);
        setTaxPreview([]);
      }
    };

    loadTaxTemplate();
  }, [formData.taxes_and_charges]);

  const openCreateModal = useCallback(() => {
    const defaultTax = getDefaultTaxTemplate(taxTemplates, localStorage.getItem('warehouse') || '');
    setFormData({
      name: '', supplier: '', supplier_name: '',
      posting_date: getLocalISODate(),
      due_date: '', bill_no: '',
      update_stock: true,
      accepted_warehouse: localStorage.getItem('warehouse') || '',
      rejected_warehouse: '',
      is_subcontracted: false,
      apply_discount_on: 'Grand Total',
      additional_discount_percentage: 0,
      discount_amount: 0,
      taxes_and_charges: defaultTax,
      items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '' }],
      docstatus: 0
    });
    setFormErrors({});
    setSearchSupplier('');
    // NOTE: Do NOT clear taxPreview here — the useEffect watching formData.taxes_and_charges
    // will automatically load the correct tax template details when taxes_and_charges is set above.
    setDocName('');
    setDocStatus(null);
    setBarcodeInput(''); // NEW: Reset barcode
    setIsEditMode(false);
    setIsViewMode(false);
    setIsModalOpen(true);

  }, [taxTemplates]);

  const handleDuplicate = () => {
    setDocName('');
    setFormData(prev => {
      const cleanedItems = (prev.items || []).map(item => {
        const {
          name, parent, parenttype, parentfield, creation, modified, modified_by, owner, docstatus,
          ...rest
        } = item;
        return rest;
      });
      return {
        ...prev,
        name: '',
        docstatus: 0,
        posting_date: getLocalISODate(),
        items: cleanedItems
      };
    });
    setIsViewMode(false);
    navigate('/purchaseinvoicelist');
    Swal.fire({
      icon: 'success',
      title: 'Duplicated!',
      text: 'You are now editing a new Draft copy of this document.',
      timer: 2000
    });
  };

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
            custom_box_price: parseFloat(i.custom_box_price || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_supplier_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            purchase_order: i.purchase_order || '',
            purchase_order_item: i.purchase_order_item || '',
            po_detail: i.po_detail || i.purchase_order_item || '',
            purchase_receipt: i.purchase_receipt || '',
            pr_detail: i.pr_detail || '',
            use_box_entry: (i.uom || '').toLowerCase() === 'box'
          })),
          total_qty: d.total_qty || 0,
          net_total: d.net_total || 0,
          total_taxes_and_charges: d.total_taxes_and_charges || 0,
          grand_total: d.grand_total || 0,
          rounded_total: d.rounded_total || 0,
          outstanding_amount: d.outstanding_amount !== undefined ? d.outstanding_amount : (d.grand_total || 0),
          docstatus: parseInt(d.docstatus) || 0,
          payment_schedule: d.payment_schedule || []
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
                        custom_supplier_sl_num: prItem.custom_supplier_sl_num || prItem.custom_ref_sl_no || item.custom_supplier_sl_num || '',
                        custom_ref_sl_no: prItem.custom_ref_sl_no || prItem.custom_supplier_sl_num || item.custom_ref_sl_no || '',
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
                      custom_supplier_sl_num: poItem.custom_supplier_sl_num || poItem.custom_ref_sl_no || item.custom_supplier_sl_num || '',
                      custom_ref_sl_no: poItem.custom_ref_sl_no || poItem.custom_supplier_sl_num || item.custom_ref_sl_no || '',
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
        const isDraft = (parseInt(d.docstatus) || 0) === 0;
        setIsViewMode(!isDraft);
        setIsEditMode(isDraft);
        setIsModalOpen(true);
        return mapped;
      }
    } catch (err) {
      alert('Failed to load invoice');
    }
    return null;
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
      const msg = res.data.message || res.data;
      if (msg.status === 'success' || res.data.status === 'success') {
        const rawData = msg.data || res.data.data;

        // Sanitize data: convert null to empty string to avoid React controlled input warnings
        const sanitizeData = (obj) => {
          if (Array.isArray(obj)) return obj.map(sanitizeData);
          if (obj !== null && typeof obj === 'object') {
            return Object.fromEntries(
              Object.entries(obj).map(([k, v]) => [k, v === null ? '' : sanitizeData(v)])
            );
          }
          return obj;
        };

        const mappedData = sanitizeData(rawData);

        setFormData({
          ...initialState, // Start with a clean state
          ...mappedData,
          is_return: 1,
          return_against: docName,
          status: 'Draft'
        });
        setDocName('');
        setIsViewMode(false);
        setIsEditMode(false);
        setIsModalOpen(true);
      } else {
        throw new Error(typeof msg.message === 'string' ? msg.message : "Mapping failed");
      }
    } catch (err) {
      console.error('Mapping error:', err);
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
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
          '<span style="font-size: 1rem; font-weight: 900; color: #10b981; display: inline-flex; align-items: center; gap: 3px;"><svg viewBox=\"0 0 344.84 299.91\" style=\"width: 14px; height: 12px; display: inline-block; fill: currentColor; margin-right: 2px;\"><path d=\"M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z\"/></svg> ' + (parseFloat(formData.outstanding_amount !== undefined ? formData.outstanding_amount : formData.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '</span>' +
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
          '<label style="font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 4px; margin-bottom: 5px;">Amount to Pay <svg viewBox=\"0 0 344.84 299.91\" style=\"width: 12px; height: 10px; display: inline-block; fill: currentColor;\"><path d=\"M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z\"/></svg></label>' +
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
          {docStatus === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Draft</span>
            </div>
          )}
          {docStatus === 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Cancelled</span>
            </div>
          )}
        </div>
        <div className="so-card-body" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Actions Section */}
            {docStatus === 1 && (
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Actions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={handleCreatePayment}
                    disabled={saving}
                    className="so-btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.7rem', background: '#eab308', borderColor: '#eab308' }}
                  >
                    <Plus size={14} /> Create Payment Entry
                  </button>
                  <button
                    onClick={handleCreateReturn}
                    disabled={saving}
                    className="so-btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.7rem', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    <Link size={14} /> Create Debit Note
                  </button>
                </div>
              </div>
            )}

            {/* Links Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...new Set(Object.values(categories).flat())].map(dt => {
                const links = linkedDocs[dt] || [];
                if (links.length === 0) return null;

                return (
                  <div key={dt} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', padding: '0.85rem', background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
    const doc = await fetchPurchaseInvoice(invoice.name);
    const isDraft = doc && (parseInt(doc.docstatus) === 0);
    setIsEditMode(isDraft);
    setIsViewMode(!isDraft);
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
          items[index].custom_box_price = (rate * pPerBox).toFixed(2);
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
    let existingIdx = -1;
    setFormData(prev => {
      const items = [...prev.items];
      existingIdx = items.findIndex((i, idx) => i.item_code === item.item_code && idx !== rowIndex);

      if (existingIdx !== -1) {
        // Merge with existing item!
        const existingItem = { ...items[existingIdx] };
        if (existingItem.use_box_entry) {
          existingItem.custom_box_qty = (parseFloat(existingItem.custom_box_qty) || 0) + 1;
          existingItem.qty = existingItem.custom_box_qty * (parseFloat(existingItem.custom_pieces_per_box) || 1);
        } else {
          existingItem.qty = (parseFloat(existingItem.qty) || 0) + 1;
          const pPerBox = parseFloat(existingItem.custom_pieces_per_box) || 1;
          if (pPerBox > 0) {
            existingItem.custom_box_qty = existingItem.qty / pPerBox;
          }
        }
        existingItem.amount = (existingItem.qty * (parseFloat(existingItem.rate) || 0)).toFixed(2);
        items[existingIdx] = existingItem;

        // Reset current row to empty
        items[rowIndex] = {
          item_code: '',
          item_name: '',
          qty: 1,
          uom: '',
          rate: 0,
          amount: 0,
          custom_box_qty: 0,
          custom_pieces_per_box: 1,
          custom_selling_price: 0,
          custom_supplier_sl_num: '',
          custom_ref_sl_no: '',
          use_box_entry: false
        };
      } else {
        // Normal item selection
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
      }
      return { ...prev, items };
    });

    setItemSearches(prev => ({ ...prev, [rowIndex]: '' }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));

    if (existingIdx !== -1) {
      // Already merged, buying rate exists
      return;
    }

    try {
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: {
          item_code: item.item_code,
          warehouse: formData.accepted_warehouse || warehouse || undefined
        },
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
      payment_schedule: formData.payment_schedule && formData.payment_schedule.length > 0
        ? formData.payment_schedule.map(row => ({
          due_date: row.due_date || formData.due_date,
          payment_amount: parseFloat(row.payment_amount) || 0,
          description: row.description || undefined
        }))
        : null,
      items: formData.items
        .filter(i => i.item_code && i.qty > 0)
        .map(i => {
          const isBox = (i.uom || '').toLowerCase() === 'box' || !!i.use_box_entry;
          return {
            name: i.name || undefined,
            doctype: "Purchase Invoice Item",
            item_code: i.item_code,
            qty: parseFloat(i.qty) || 1,
            uom: i.uom || undefined,
            rate: parseFloat(i.rate || 0),
            custom_box_qty: isBox ? parseFloat(i.custom_box_qty || 0) : parseFloat(i.qty),
            custom_pieces_per_box: isBox ? parseFloat(i.custom_pieces_per_box || 1) : 1,
            custom_box_price: isBox ? parseFloat(i.custom_box_price || 0) : parseFloat(i.rate || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_supplier_sl_num: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            purchase_order: i.purchase_order || undefined,
            purchase_order_item: i.purchase_order_item || undefined,
            po_detail: i.po_detail || i.purchase_order_item || undefined,
            purchase_receipt: i.purchase_receipt || undefined,
            pr_detail: i.pr_detail || undefined,
          };
        }),
    };
  };

  const handleSaveDraft = async () => {
    if (formData.update_stock && !formData.accepted_warehouse) {
      formData.accepted_warehouse = localStorage.getItem('warehouse') || warehouses[0]?.name || '';
    }
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
    if (formData.update_stock && !formData.accepted_warehouse) {
      formData.accepted_warehouse = localStorage.getItem('warehouse') || warehouses[0]?.name || '';
    }
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
  }, [customColumns]);

  useEffect(() => {
    const nameParam = searchParams.get('name');
    const prParam = searchParams.get('pr');

    if (nameParam === 'new') {
      if (!isModalOpen) {
        openCreateModal();
      }
    } else if (nameParam) {
      // Don't reload if we are currently showing a return draft against this document
      if (nameParam !== docName || !isModalOpen) {
        if (nameParam !== formData.return_against || !isModalOpen) {
          fetchPurchaseInvoice(nameParam);
        }
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
  }, [searchParams, openCreateModal, createPIFromPR, fetchPurchaseInvoice, isModalOpen]);

  useEffect(() => {
    const supplierParam = searchParams.get('supplier');
    if (supplierParam) {
      setFilterSupplier(supplierParam);
      setShowFilters(true);
    }
  }, [searchParams]);

  // Global Keyboard Shortcuts hook for Edit Modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleGlobalShortcuts = (e) => {
      const activeEl = document.activeElement;
      const inItemsTable = activeEl?.closest('table.so-items-table');

      let activeRowIndex = -1;
      if (inItemsTable) {
        const tr = activeEl.closest('tr');
        if (tr && tr.parentNode) {
          const index = Array.from(tr.parentNode.children).indexOf(tr);
          if (index !== -1 && index < formData.items.length) {
            activeRowIndex = index;
          }
        }
      }

      // Ctrl+ArrowDown, Ctrl+ArrowUp, or Shift+F3: Jump focus into items table rows
      if ((e.ctrlKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || (e.shiftKey && e.key === 'F3')) {
        const rows = document.querySelectorAll('table.so-items-table tbody tr');
        if (rows.length > 0) {
          e.preventDefault();
          const targetRow = (e.key === 'ArrowUp') ? rows[rows.length - 1] : rows[0];
          if (targetRow) {
            targetRow.focus();
            return;
          }
        }
      }

      // Focus Supplier Search
      if (isShortcutPressed(e, 'doc_editor', 'customerSupplier', 'F2')) {
        e.preventDefault();
        const supplierInput = document.querySelector('input[placeholder="Search and select supplier..."]') || document.querySelector('input[placeholder="Search supplier..."]');
        if (supplierInput) {
          supplierInput.focus();
          supplierInput.select?.();
        }
      }

      // Focus Item Search (first row if empty, else last row)
      if (isShortcutPressed(e, 'doc_editor', 'itemSearch', 'F3')) {
        e.preventDefault();
        const itemInputs = document.querySelectorAll('input[placeholder="Search item..."]');
        if (itemInputs.length > 0) {
          const firstInput = itemInputs[0];
          const targetInput = (firstInput && !firstInput.value) ? firstInput : itemInputs[itemInputs.length - 1];
          if (targetInput) {
            targetInput.focus();
            targetInput.select?.();
          }
        }
      }

      // Focus Barcode/Scan input
      if (isShortcutPressed(e, 'doc_editor', 'barcode', 'F4')) {
        e.preventDefault();
        const scanInput = document.querySelector('input[placeholder="Place cursor here and scan barcode..."]') || document.querySelector('input[placeholder="Enter Barcode / Scan here..."]');
        if (scanInput) {
          scanInput.focus();
          scanInput.select?.();
        }
      }


      // Bulk Quantity Update popup
      if (isShortcutPressed(e, 'doc_editor', 'bulkQty', 'F6')) {
        e.preventDefault();
        let rowIndex = inItemsTable ? activeRowIndex : (formData.items.length - 1);

        if (rowIndex >= 0 && rowIndex < formData.items.length) {
          const item = formData.items[rowIndex];
          if (item && item.item_code) {
            Swal.fire({
              title: 'Bulk Quantity',
              html: `<div style="font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; padding: 10px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #10b981; text-align: left;">
                ${item.item_name || item.item_code}
              </div>`,
              input: 'number',
              inputPlaceholder: 'Enter quantity...',
              inputValue: item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || ''),
              showCancelButton: true,
              confirmButtonText: 'Update',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#64748b'
            }).then(result => {
              if (result.isConfirmed && result.value !== undefined) {
                const newQty = parseFloat(result.value) || 0;
                if (item.use_box_entry) {
                  updateItem(rowIndex, 'custom_box_qty', newQty);
                } else {
                  updateItem(rowIndex, 'qty', newQty);
                }
              }
            });
          }
        }
      }

      // Toggle UOM of active row (or last row)
      if (isShortcutPressed(e, 'doc_editor', 'uom', 'F8')) {
        e.preventDefault();
        let rowIndex = inItemsTable ? activeRowIndex : (formData.items.length - 1);

        if (rowIndex >= 0 && rowIndex < formData.items.length) {
          const item = formData.items[rowIndex];
          if (item && item.item_code) {
            let nextUom = '';
            const currentUom = (item.uom || item.stock_uom || '').toLowerCase();
            const uomList = item.uom_list || [];

            if (uomList.length > 1) {
              const currentIndex = uomList.findIndex(u => u.uom.toLowerCase() === currentUom);
              const nextIndex = (currentIndex + 1) % uomList.length;
              nextUom = uomList[nextIndex].uom;
            } else {
              nextUom = currentUom === 'box' ? (item.stock_uom || 'Nos') : 'Box';
            }

            handleUOMChange(nextUom, rowIndex);
            Swal.fire({
              icon: 'info',
              title: 'UOM Switched',
              text: `Row ${rowIndex + 1}: Switched UOM to ${nextUom}`,
              toast: true,
              position: 'top-end',
              timer: 2000,
              showConfirmButton: false
            });
          }
        }
      }

      // Save Draft / Update Draft
      if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS'))) {
        e.preventDefault();
        if (!saving && (formData.docstatus === 0 || formData.docstatus === undefined)) {
          if (docName && !isDirty) {
            handleDocAction('submit');
          } else {
            handleDocAction('save');
          }
        }
      }

      // Add Item Row
      if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        if (formData.docstatus === 0 && !isViewMode) {
          addItemRow();
        }
      }

      // Focus Target Warehouse Select
      if (isShortcutPressed(e, 'doc_editor', 'warehouseBranch', 'F9')) {
        e.preventDefault();
        const warehouseSelect = document.querySelector('select[name="accepted_warehouse"]') || document.querySelector('select[name="set_warehouse"]') || document.querySelector('select');
        if (warehouseSelect) {
          warehouseSelect.focus();
        }
      }

      // Submit document
      if (isShortcutPressed(e, 'doc_editor', 'submit', 'F12') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (!saving && (formData.docstatus === 0 || formData.docstatus === undefined)) {
          handleDocAction('submit');
        }
      }

      // Escape: Close configuration modals, reset selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showColConfig) setShowColConfig(false);
        else if (isModalOpen) {
          setDocName('');
        } else if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          activeEl.blur();
        }
      }

      // Tab Key Navigation Inside Table (Do not close or leave)
      if (e.key === 'Tab') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            const rowInputs = Array.from(tr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
            const inputIndex = rowInputs.indexOf(activeEl);

            if (inputIndex === rowInputs.length - 1 && !e.shiftKey) {
              e.preventDefault();
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              const isLastRow = rowIndex === formData.items.length - 1;

              if (isLastRow) {
                if (formData.docstatus === 0 && !isViewMode) {
                  addItemRow();
                  setTimeout(() => {
                    const tableBody = tr.parentNode;
                    const newTr = tableBody.lastElementChild;
                    if (newTr) {
                      const firstInput = newTr.querySelector('input:not([disabled]), select:not([disabled])');
                      if (firstInput) {
                        firstInput.focus();
                        firstInput.select?.();
                      }
                    }
                  }, 50);
                }
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input:not([disabled]), select:not([disabled])');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else if (inputIndex === 0 && e.shiftKey) {
              const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
              if (rowIndex > 0) {
                e.preventDefault();
                const prevTr = tr.previousElementSibling;
                if (prevTr) {
                  const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]), select:not([disabled])'));
                  if (prevInputs.length > 0) {
                    const lastInput = prevInputs[prevInputs.length - 1];
                    lastInput.focus();
                    lastInput.select?.();
                  }
                }
              }
            }
          }
        }
      }

      // Enter key inside table inputs: add row or navigate down
      if (e.key === 'Enter') {
        if (inItemsTable && activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          const isSearchInput = activeEl.placeholder === 'Search item...';
          const isDropdownOpen = document.querySelector('.custom-dropdown-portal');
          if (isSearchInput && isDropdownOpen) return; // Let search dropdown handle it

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr && tr.parentNode) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            const isLastRow = rowIndex === formData.items.length - 1;
            const isSellingPriceField = activeEl.placeholder === 'Nos Price' ||
              activeEl.placeholder === 'Box Price' ||
              activeEl.name === 'custom_selling_price' ||
              activeEl.name === 'custom_box_selling_price';

            if (isSellingPriceField) {
              if (isLastRow) {
                if (formData.docstatus === 0 && !isViewMode) {
                  addItemRow();
                  setTimeout(() => {
                    const tableBody = tr.parentNode;
                    const newTr = tableBody.lastElementChild;
                    if (newTr) {
                      const firstInput = newTr.querySelector('input[placeholder="Search item..."]');
                      if (firstInput) {
                        firstInput.focus();
                        firstInput.select?.();
                      }
                    }
                  }, 50);
                }
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const firstInput = nextTr.querySelector('input[placeholder="Search item..."]');
                  if (firstInput) {
                    firstInput.focus();
                    firstInput.select?.();
                  }
                }
              }
            } else {
              if (isLastRow) {
                if (formData.docstatus === 0 && !isViewMode) {
                  addItemRow();
                  setTimeout(() => {
                    const tableBody = tr.parentNode;
                    const newTr = tableBody.lastElementChild;
                    if (newTr) {
                      const targetTd = newTr.children[colIndex];
                      if (targetTd) {
                        const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                        if (targetInput) {
                          targetInput.focus();
                          targetInput.select?.();
                        }
                      }
                    }
                  }, 50);
                }
              } else {
                const nextTr = tr.nextElementSibling;
                if (nextTr) {
                  const targetTd = nextTr.children[colIndex];
                  if (targetTd) {
                    const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                    if (targetInput) {
                      targetInput.focus();
                      targetInput.select?.();
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 1. Escape key inside table input to select/focus the parent row (TR) itself
      if (e.key === 'Escape') {
        if (inItemsTable && activeEl && activeEl.tagName !== 'TR') {
          const tr = activeEl.closest('tr');
          if (tr) {
            e.preventDefault();
            tr.focus();
            return;
          }
        }
      }

      // 2. Keyboard actions when the row itself is focused
      if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.so-items-table')) {
        const tr = activeEl;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
          if (targetTr && targetTr.tagName === 'TR') {
            targetTr.focus();
          }
        }

        if (e.key === 'Enter' || e.key === 'F3' || e.key === ' ') {
          e.preventDefault();
          const firstInput = tr.querySelector('input:not([disabled]), select:not([disabled])');
          if (firstInput) {
            firstInput.focus();
            firstInput.select?.();
          }
        }

        if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
          const isPlus = e.key === '+' || e.key === '=';
          const qtyBtn = isPlus
            ? tr.querySelector('button[style*="borderRadius: 0 4px 4px 0"]') || tr.querySelector('.quantity-plus')
            : tr.querySelector('button[style*="borderRadius: 4px 0 0 4px"]') || tr.querySelector('.quantity-minus');
          if (qtyBtn) {
            e.preventDefault();
            qtyBtn.click();
          } else {
            const numInput = tr.querySelector('input[type="number"]:not([disabled])');
            if (numInput) {
              e.preventDefault();
              const currentVal = parseFloat(numInput.value) || 0;
              const diff = isPlus ? 1 : -1;
              const newVal = Math.max(0, currentVal + diff);
              numInput.value = newVal;
              const event = new Event('input', { bubbles: true });
              numInput.dispatchEvent(event);
            }
          }
        }
      }

      // Arrow Up/Down navigation inside table inputs
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isSearchInput = activeEl.placeholder === 'Search item...';
          const isDropdownOpen = document.querySelector('.custom-dropdown-portal');
          // If search input and dropdown is open, only block if they do not hold Alt/Ctrl
          if (isSearchInput && isDropdownOpen && !e.altKey && !e.ctrlKey) return;

          const td = activeEl.closest('td');
          const tr = activeEl.closest('tr');
          if (td && tr) {
            e.preventDefault();
            const colIndex = Array.from(tr.children).indexOf(td);
            const targetTr = e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
            if (targetTr) {
              const targetTd = targetTr.children[colIndex];
              if (targetTd) {
                const targetInput = targetTd.querySelector('input:not([disabled]), select:not([disabled])');
                if (targetInput) {
                  targetInput.focus();
                  targetInput.select?.();
                }
              }
            }
          }
        }
      }

      // + / -: Increase / Decrease focused row quantity
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'number') {
          const td = activeEl.closest('td');
          const isQtyField = activeEl.name?.toLowerCase().includes('qty') ||
            activeEl.placeholder?.toLowerCase().includes('qty') ||
            (activeEl.previousElementSibling && activeEl.previousElementSibling.innerText === '-') ||
            (activeEl.nextElementSibling && activeEl.nextElementSibling.innerText === '+') ||
            (td && (td.closest('table')?.querySelector(`thead th:nth-child(${Array.from(td.closest('tr').children).indexOf(td) + 1})`)?.innerText.toLowerCase().includes('qty') || activeEl.placeholder?.toLowerCase().includes('qty')));
          if (isQtyField) {
            e.preventDefault();
            const currentVal = parseFloat(activeEl.value) || 0;
            const diff = (e.key === '+' || e.key === '=') ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            activeEl.value = newVal;
            const event = new Event('input', { bubbles: true });
            activeEl.dispatchEvent(event);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isModalOpen, formData, allowedActions, isViewMode, saving, taxTemplates, isDirty, docName]);

  if (isModalOpen) {
    return (
      <>
        <div className="so-page font-sans bg-[#f8fafc] min-h-screen flex flex-col" style={{ height: '100vh', overflowY: 'auto' }}>
          <div className="so-page-header" style={{ padding: '0.85rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, tracking: 'tight', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isViewMode ? 'View' : (docName ? 'Edit' : 'New')} {formData.is_return === 1 ? 'Debit Note' : 'Purchase Invoice'}
                </h2>
                {docName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{docName} • Accounts</p>
                    <a
                      href={`/app/purchase-invoice/${encodeURIComponent(docName)}`}
                      target={window.location.protocol === 'file:' ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase ml-2 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <ExternalLink size={10} className="mr-1" /> Open in ERPNext
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* Always show DUPLICATE if docName exists */}
                {docName && (
                  <button
                    onClick={handleDuplicate}
                    className="so-btn-secondary"
                    style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                  >
                    <Copy size={14} /> DUPLICATE
                  </button>
                )}

                {/* DRAFT PHASE */}
                {(formData.docstatus === 0 || formData.docstatus === undefined) && (
                  <>
                    {/* 1. DELETE button (if allowed) */}
                    {docName && (allowedActions.includes('delete') || allowedActions.length === 0) && (
                      <button
                        onClick={() => handleDocAction('delete')}
                        className="so-btn-ghost"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', transition: 'all 0.2s' }}
                      >
                        <Trash2 size={14} className="inline mr-1" /> DELETE
                      </button>
                    )}

                    {/* 2. EDIT DRAFT button (only if in view mode) */}
                    {docName && isViewMode && (
                      <button
                        onClick={() => setIsViewMode(false)}
                        className="so-btn-secondary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                      >
                        <Edit2 size={14} /> EDIT DRAFT
                      </button>
                    )}

                    {/* 3. Primary action button(s) */}
                    {!docName ? (
                      // New Document -> SAVE DRAFT
                      <button
                        onClick={() => handleDocAction('save')}
                        disabled={saving}
                        className="so-btn-primary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                      >
                        {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                      </button>
                    ) : (
                      // Saved Document -> Show BOTH Update and Submit (if allowed)
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {!isViewMode && (
                          <button
                            onClick={() => handleDocAction('save')}
                            disabled={saving}
                            className="so-btn-secondary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'UPDATE DRAFT'}
                          </button>
                        )}
                        {(allowedActions.includes('submit') || allowedActions.length === 0) && (
                          <button
                            onClick={() => handleDocAction('submit')}
                            disabled={saving}
                            className="so-btn-primary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'SUBMIT'}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* SUBMITTED PHASE */}
                {formData.docstatus === 1 && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#ecfdf5', borderRadius: '0.75rem', border: '1px solid #10b98140', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>
                      <CheckCircle2 size={14} /> SUBMITTED
                    </div>

                    {allowedActions.includes('cancel') && (
                      <button
                        onClick={() => handleDocAction('cancel')}
                        disabled={saving}
                        className="so-btn-primary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)', transition: 'all 0.2s' }}
                      >
                        {saving ? <Loader2 size={14} className="so-spinner" /> : 'CANCEL'}
                      </button>
                    )}
                  </>
                )}

                {/* CANCELLED PHASE */}
                {formData.docstatus === 2 && (
                  <>
                    {docName && allowedActions.includes('delete') && (
                      <button
                        onClick={() => handleDocAction('delete')}
                        className="so-btn-ghost"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', transition: 'all 0.2s' }}
                      >
                        <Trash2 size={14} className="inline mr-1" /> DELETE
                      </button>
                    )}

                    <div style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', fontWeight: 900, borderRadius: '0.75rem', textTransform: 'uppercase' }}>
                      CANCELLED
                    </div>

                    {allowedActions.includes('amend') && (
                      <button
                        onClick={() => handleDocAction('amend')}
                        disabled={saving}
                        className="so-btn-primary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)', transition: 'all 0.2s' }}
                      >
                        {saving ? <Loader2 size={14} className="so-spinner" /> : 'AMEND'}
                      </button>
                    )}
                  </>
                )}
                {/* NEW: CREATE & CONNECTIONS DROPDOWN BUTTON */}
                {docName && (
                  <div className="relative" ref={createDropdownRef}>
                    <button
                      onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                      className="so-btn-secondary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                    >
                      <Plus size={14} /> CREATE <ChevronDown size={14} />
                    </button>
                    {showCreateDropdown && (
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4 animate-fadeIn text-left">
                        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                          <Zap className="w-4 h-4 text-indigo-500 opacity-80 shrink-0" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-extrabold">Create & Connections</span>
                        </div>

                        {/* Actions Section */}
                        {formData.docstatus === 1 && (
                          <div className="flex flex-col gap-2 mb-4">
                            <button
                              onClick={() => {
                                setShowCreateDropdown(false);
                                handleCreatePayment();
                              }}
                              disabled={saving}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                              Create Payment Entry
                            </button>
                            <button
                              onClick={() => {
                                setShowCreateDropdown(false);
                                handleCreateReturn();
                              }}
                              disabled={saving}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Link size={14} />
                              Create Debit Note
                            </button>
                          </div>
                        )}

                        {/* Connected Docs / Links */}
                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                          {Object.keys(linkedDocs).some(dt => (linkedDocs[dt] || []).length > 0) ? (
                            Object.entries(linkedDocs)
                              .filter(([dt, links]) => links && links.length > 0)
                              .map(([dt, links]) => (
                                <div key={dt} className="flex flex-col gap-1.5 text-left">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{dt}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {links.map(link => (
                                      <button
                                        key={link.name}
                                        onClick={() => {
                                          setShowCreateDropdown(false);
                                          navigateToDoc(dt, link.name);
                                        }}
                                        className="group/id flex items-center gap-1 p-0.5 px-1.5 bg-white border border-slate-100 rounded transition-all hover:border-indigo-200 hover:shadow-sm"
                                        title={`View ${dt}: ${link.name}`}
                                      >
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${link.docstatus === 1 ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : (link.docstatus === 2 ? 'bg-rose-400' : 'bg-orange-400 animate-pulse')}`} />
                                        <span className="text-[9px] font-bold text-slate-700 tabular-nums truncate">{link.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="py-2 text-center">
                              <p className="text-[9px] font-bold text-slate-400 italic text-slate-450 font-semibold">No connections yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button onClick={closeModal} className="so-btn-secondary" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ChevronLeft size={16} /> Back to List
              </button>
            </div>
          </div>

          {/* Premium Glassmorphic Keyboard Shortcuts Guide Banner */}
          <div className="w-full bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-sky-50/50 backdrop-blur-md border-b border-emerald-100/60 px-8 py-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-[11px] font-medium text-slate-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold uppercase tracking-wider text-[10px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Quick Shortcuts
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Supplier</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'itemSearch', 'F3')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Item Search</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'barcode', 'F4')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Barcode</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'bulkQty', 'F6')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Bulk Qty</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'uom', 'F8')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Toggle UOM</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200/80 shadow-sm transition-all hover:scale-105 hover:bg-emerald-50">
                <kbd className="px-1.5 py-0.5 bg-emerald-200 border border-emerald-300 rounded text-[9px] font-black text-emerald-700 shadow-sm">{getShortcut('doc_editor', 'saveDraft', 'F7')}</kbd>
                <span className="text-[10px] font-semibold text-emerald-800">Save Draft</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'addRow', 'F10')} / Alt+A</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Add Row</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">{getShortcut('doc_editor', 'warehouseBranch', 'F9')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Warehouse</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Ctrl+Enter / {getShortcut('doc_editor', 'submit', 'F12')}</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Submit</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Shift+F3 / Ctrl+↓</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Focus Table</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">Escape</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Close / Clear</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm transition-all hover:scale-105 hover:bg-white">
                <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300/70 rounded text-[9px] font-black text-slate-500 shadow-sm">+ / -</kbd>
                <span className="text-[10px] font-semibold text-slate-600">Qty Adjust</span>
              </div>
            </div>
          </div>

          <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
            <AttachmentSection doctype="Purchase Invoice" docname={docName} />
            <div className="w-full flex flex-col gap-6 mt-4">
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
                        onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
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
                        onChange={e => {
                          const newDueDate = e.target.value;
                          setFormData(prev => {
                            const schedule = (prev.payment_schedule || []).map(row => ({
                              ...row,
                              due_date: newDueDate
                            }));
                            return { ...prev, due_date: newDueDate, payment_schedule: schedule };
                          });
                        }}
                        className="so-input"
                        style={{ paddingLeft: '2.5rem' }}
                        disabled={isViewMode}
                        onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                        onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
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

            {/* Items Card */}
            <div className="so-card">
              <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="so-card-title">Items</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowColConfig(true)}
                    className="so-btn-ghost"
                    style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    title="Configure Columns"
                  >
                    <Settings size={14} />
                    <span>Columns</span>
                  </button>
                  {!isViewMode && (
                    <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                      <Plus size={14} /> Add Row
                    </button>
                  )}
                </div>
              </div>
              <div className="so-card-body">
                <div className="so-table-wrapper" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)', boxShadow: 'none' }}>
                  <table className="so-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                        {(() => {
                          const activeCols = columnConfig.filter(c => c.visible);
                          const anyBoxUom = formData.items.some(it => (it.uom || '').toLowerCase() === 'box');

                          return activeCols.map(col => {
                            if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
                            let finalLabel = col.label;
                            if (col.id === 'custom_box_qty' && !anyBoxUom) finalLabel = 'Qty';
                            return (
                              <th
                                key={col.id}
                                style={{
                                  width: col.width,
                                  minWidth: col.id === 'item_code' ? 120 : undefined,
                                  textAlign: ['rate', 'amount', 'custom_selling_price', 'custom_box_selling_price', 'custom_box_price'].includes(col.id) ? 'right' :
                                    ['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id) ? 'left' : 'center'
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
                        <tr key={i} tabIndex={-1}>
                          <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>

                          {(() => {
                            const activeCols = columnConfig.filter(c => c.visible);
                            const isNosUom = (item.uom || '').toLowerCase() !== 'box';
                            const anyBoxUom = formData.items.some(it => (it.uom || '').toLowerCase() === 'box');

                            return activeCols.map(col => {
                              if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
                              switch (col.id) {
                                case 'custom_box_qty':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box" style={{ position: 'relative' }}>
                                          {isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-slate-800" style={{ paddingRight: item.item_code ? '48px' : '0.5rem' }}>
                                              {item.use_box_entry ? (item.custom_box_qty || 0) : (item.qty || 0)}
                                            </div>
                                          ) : !item.use_box_entry ? (
                                            <input
                                              type="number"
                                              value={item.qty !== undefined ? item.qty : ''}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'qty', e.target.value)}
                                              className="so-input text-center font-bold"
                                              style={{ border: `1px solid ${themeColor}40`, borderRadius: '4px', height: '36px', paddingRight: item.item_code ? '48px' : '0.5rem', width: '100%', flex: 1 }}
                                              placeholder="Qty"
                                            />
                                          ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentVal = parseFloat(item.custom_box_qty) || 0;
                                                  updateItem(i, 'custom_box_qty', Math.max(0, currentVal - 1));
                                                }}
                                                style={{ padding: '0 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px 0 0 4px', height: '36px', fontWeight: 'bold', cursor: 'pointer' }}
                                              >
                                                -
                                              </button>
                                              <input
                                                type="number"
                                                value={item.custom_box_qty !== undefined ? item.custom_box_qty : ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'custom_box_qty', e.target.value)}
                                                className="so-input text-center font-bold"
                                                style={{ borderTop: `1px solid ${themeColor}40`, borderBottom: `1px solid ${themeColor}40`, borderRadius: 0, height: '36px', paddingRight: item.item_code ? '48px' : '0.5rem', width: '40px', flex: 1, minWidth: '40px' }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentVal = parseFloat(item.custom_box_qty) || 0;
                                                  updateItem(i, 'custom_box_qty', currentVal + 1);
                                                }}
                                                style={{ padding: '0 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0 4px 4px 0', height: '36px', fontWeight: 'bold', cursor: 'pointer' }}
                                              >
                                                +
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'custom_pieces_per_box':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {isNosUom ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                          ) : isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-slate-800">
                                              {(item.custom_pieces_per_box || 1)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.custom_pieces_per_box !== undefined ? item.custom_pieces_per_box : ''}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)}
                                              className="so-input text-left pl-3 font-bold"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'item_name':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-slate-800" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.item_name || '—'}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'custom_ref_sl_no':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-slate-800">
                                              {item.custom_ref_sl_no || item.custom_supplier_sl_num || '—'}
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                              onChange={e => updateItem(i, 'custom_ref_sl_no', e.target.value)}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              placeholder="Serial..."
                                              className="so-input text-center font-bold text-[10px]"
                                              style={{ textAlign: 'center' }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'item_code':
                                  return (
                                    <td key={col.id} ref={el => itemRefs.current[i] = el} style={{ minWidth: '200px' }}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {isViewMode ? (
                                            <div style={{ padding: '0.4rem 0.6rem' }}>
                                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>{item.item_name}</div>
                                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem', fontWeight: 600 }}>{item.item_code}</div>
                                            </div>
                                          ) : (
                                            <CustomSearchDropdown
                                              placeholder="Search item..."
                                              value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                              onSelect={it => selectItem(i, it)}
                                              fetchData={fetchItemsAPI}
                                              optionsLabel="item_name"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'qty':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box" style={{ position: 'relative' }}>
                                          {isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-[var(--so-primary)]" style={{ paddingRight: item.use_box_entry ? '42px' : '0.5rem' }}>
                                              {item.qty}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.qty}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'qty', e.target.value)}
                                              className="so-input text-left pl-3 font-bold"
                                              style={{ paddingRight: item.use_box_entry ? '42px' : '0.5rem' }}
                                            />
                                          )}
                                          {item.use_box_entry && (
                                            <span
                                              className="absolute right-2 text-[9px] font-extrabold select-none pointer-events-none px-1.5 py-0.5 rounded border uppercase"
                                              style={{
                                                position: 'absolute',
                                                right: '8px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: '#64748b',
                                                backgroundColor: '#f8fafc',
                                                borderColor: '#e2e8f0',
                                                lineHeight: 1
                                              }}
                                            >
                                              NOS
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'uom':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {!item.item_code || isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-center text-[10px] uppercase text-slate-500 font-bold">
                                              {item.use_box_entry ? 'BOX' : (item.uom || 'NOS')}
                                            </div>
                                          ) : (
                                            <select
                                              value={item.uom || ''}
                                              onChange={(e) => handleUOMChange(e.target.value, i)}
                                              className="text-center text-[10px] font-bold text-slate-600 bg-white"
                                            >
                                              {(() => {
                                                const uniqueUoms = [];
                                                const seen = new Set();
                                                const candidates = [];

                                                if (item.uom_list && Array.isArray(item.uom_list)) {
                                                  item.uom_list.forEach(u => {
                                                    if (u && u.uom) candidates.push(u.uom);
                                                  });
                                                }

                                                candidates.push(item.stock_uom || 'Nos');
                                                candidates.push(item.uom || 'Nos');
                                                candidates.push('Nos');
                                                candidates.push('Box');

                                                candidates.forEach(u => {
                                                  const norm = u.trim().toLowerCase();
                                                  let display = u.trim();
                                                  if (norm === 'box') display = 'Box';
                                                  else if (norm === 'nos') display = 'Nos';

                                                  if (!seen.has(norm)) {
                                                    seen.add(norm);
                                                    uniqueUoms.push(display);
                                                  }
                                                });

                                                return uniqueUoms.map(uomVal => (
                                                  <option key={uomVal} value={uomVal}>{uomVal}</option>
                                                ));
                                              })()}
                                            </select>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'custom_box_price':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {isNosUom ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                          ) : isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800">
                                              {formatPrice(item.custom_box_price)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.custom_box_price !== undefined ? item.custom_box_price : ''}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'custom_box_price', e.target.value)}
                                              className="so-input text-right pr-3 font-bold"
                                              style={{ textAlign: 'right' }}
                                              step="0.01"
                                              placeholder="Box Price"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'rate':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {item.use_box_entry || (item.uom || '').toLowerCase() === 'box' ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                          ) : isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-[var(--so-primary)]">
                                              {formatPrice(item.rate)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.rate}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'rate', e.target.value)}
                                              className="so-input text-right pr-3 font-bold"
                                              style={{ textAlign: 'right' }}
                                              step="0.01"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'custom_selling_price':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          {isViewMode ? (
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-[#6366f1]">
                                              {formatPrice(item.custom_selling_price)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.custom_selling_price || ''}
                                              onFocus={e => e.target.select()}
                                              onClick={e => e.target.select()}
                                              onChange={e => updateItem(i, 'custom_selling_price', e.target.value)}
                                              className="so-input text-right pr-3 font-bold text-[#6366f1]"
                                              style={{ textAlign: 'right' }}
                                              step="0.01"
                                              placeholder="Nos Price"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                case 'custom_box_selling_price':
                                  {
                                    const isBoxUom = (item.uom || '').toLowerCase() === 'box';
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {!isBoxUom ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                            ) : isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-[#10b981]">
                                                {formatPrice((item.custom_selling_price || 0) * (item.custom_pieces_per_box || 1))}
                                              </div>
                                            ) : (
                                              <input
                                                type="number"
                                                value={item._temp_box_selling_price !== undefined ? item._temp_box_selling_price : (item.custom_selling_price ? ((item.custom_selling_price || 0) * (item.custom_pieces_per_box || 1)).toFixed(2) : '')}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => {
                                                  const typedVal = e.target.value;
                                                  const val = parseFloat(typedVal) || 0;
                                                  const pcs = parseFloat(item.custom_pieces_per_box) || 1;
                                                  const nosPrice = pcs > 0 ? (val / pcs).toFixed(4) : 0;

                                                  setFormData(prev => {
                                                    const newItems = [...prev.items];
                                                    newItems[i] = {
                                                      ...newItems[i],
                                                      custom_selling_price: parseFloat(nosPrice),
                                                      _temp_box_selling_price: typedVal
                                                    };
                                                    return { ...prev, items: newItems };
                                                  });
                                                }}
                                                onBlur={() => {
                                                  setFormData(prev => {
                                                    const newItems = [...prev.items];
                                                    newItems[i] = {
                                                      ...newItems[i],
                                                      custom_selling_price: parseFloat(newItems[i].custom_selling_price).toFixed(2),
                                                      _temp_box_selling_price: undefined
                                                    };
                                                    return { ...prev, items: newItems };
                                                  });
                                                }}
                                                className="so-input text-right pr-3 font-bold text-[#10b981]"
                                                style={{ textAlign: 'right' }}
                                                step="0.01"
                                                placeholder="Box Price"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }
                                case 'amount':
                                  return (
                                    <td key={col.id}>
                                      <div className="premium-cell-container">
                                        <div className="premium-cell-box">
                                          <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800" style={{ textAlign: 'right' }}>
                                            {formatPrice(item.amount)}
                                          </div>
                                        </div>
                                      </div>
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
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(subtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fda4af' }}>
                      <span>Total Discount</span>
                      <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>- <DirhamIcon size={12} /> {formatPrice(discountAmount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.9rem' }}>
                    <span>Tax Total</span>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(taxTotal)}</span>
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
                        <span className="flex items-center justify-end gap-1.5"><DirhamIcon size={20} /> {formatPrice(grandTotal)}</span>
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
    </>
    );
  }

  return (
    <>
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header-container" style={{ display: isModalOpen ? 'none' : 'block' }}>
          <div className="so-page-tabs">
            <span className="so-page-tab active">Purchase Invoice</span>
            <span className="so-page-tab" onClick={() => navigate('/purchasereport')} style={{ cursor: 'pointer' }}>Reports</span>
          </div>
          <div className="so-page-header">
            <div className="so-page-left">
              <h1 className="so-page-title">Purchase Invoice Management</h1>
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

              <ListCustomizer
                doctype="Purchase Invoice"
                onSave={cols => setCustomColumns(cols)}
                themeColor={themeColor}
              />

              <button onClick={() => setSearchParams({ name: 'new' })} className="so-btn-primary">
                <Plus size={16} /> Create Invoice
              </button>
            </div>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column', display: isModalOpen ? 'none' : 'flex' }}>
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
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="so-filter-input"
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
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
                          {customColumns.map(col => (
                            <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
                          ))}
                          <th style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr>
                            <td colSpan={6 + customColumns.length} className="so-empty">
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
                                    target={window.location.protocol === 'file:' ? '_self' : '_blank'}
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open in new tab"
                                    style={{ color: themeColor, textDecoration: 'none' }}
                                  >
                                    <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                  </a>
                                  <span style={{ fontWeight: 700, color: themeColor }}>{inv.name}</span>
                                  {inv.is_return === 1 && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      backgroundColor: '#fee2e2',
                                      color: '#ef4444',
                                      padding: '0.1rem 0.4rem',
                                      borderRadius: '0.25rem',
                                      fontWeight: 700,
                                      marginLeft: '0.4rem'
                                    }}>
                                      DEBIT NOTE
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{inv.supplier_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.supplier}</div>
                              </td>
                              <td>
                                <span style={{ color: '#475569', fontSize: '0.85rem' }}>{format(new Date(inv.posting_date), 'dd-MM-yyyy')}</span>
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
                               <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} /> {inv.is_return === 1 ? '-' : ''}{Math.abs(inv.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </td>
                              {customColumns.map(col => (
                                <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                  {inv[col] !== undefined && inv[col] !== null ? String(inv[col]) : '-'}
                                </td>
                              ))}
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