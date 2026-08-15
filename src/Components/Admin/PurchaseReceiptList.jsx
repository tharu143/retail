import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, X, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon, Barcode, Edit3,
  Trash2, Palette, Loader2, ChevronLeft, ChevronRight, Zap, CheckCircle2, ExternalLink, Link, Settings, FileText, Copy, Printer, Save, Send
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleTheme } from '../../Redux/Slices/userSlice';
import axios from 'axios';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import '../Admin/SalesOrder.css';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import AttachmentSection from './AttachmentSection';
import ListCustomizer from './ListCustomizer';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

// Custom APIs (moved to standardized path)
const API_PATH = '/api/method/kyle_retail.retail_api.api';
const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const RESOURCE_BASE = '/api/resource';

const DEFAULT_PR_COLUMNS = [
  { id: 'barcode', label: 'Scan Barcode', visible: true, width: 130 },
  { id: 'item_code', label: 'Item Code', visible: true, width: 180 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'custom_ref_sl_no', label: 'Ref / Supplier SL #', visible: true, width: 120 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price (Nos)', visible: true, width: 100 },
  { id: 'custom_box_selling_price', label: 'Selling Price (Box)', visible: true, width: 100 },
  { id: 'accepted_qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'rejected_qty', label: 'Rejected Qty', visible: false, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 },
  { id: 'last_purchase_rate', label: 'Last Purchase Price', visible: true, width: 110 }
];

const getLocalISODate = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
};

const getLocalISOTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function PurchaseReceiptList() {
  const dispatch = useDispatch();
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Purchase Receipt');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [rateLoading, setRateLoading] = useState({});
  const [docName, setDocName] = useState('');
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [allowedActions, setAllowedActions] = useState([]);
  const [lastSavedData, setLastSavedData] = useState(null); // Snapshot tracking



  // ----- Column Config -----
  const loadColumnConfig = () => {
    try {
      const saved = localStorage.getItem('pr_column_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_PR_COLUMNS.map(c => c.id);
        const savedIds = parsed.map(c => c.id);
        const missing = DEFAULT_PR_COLUMNS.filter(c => !savedIds.includes(c.id));
        return [...parsed, ...missing].map(c => ({...c, label: DEFAULT_PR_COLUMNS.find(d => d.id === c.id)?.label || c.label}));
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_PR_COLUMNS;
  };
  const [columnConfig, setColumnConfig] = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      setColumnConfig(DEFAULT_PR_COLUMNS);
      localStorage.removeItem('pr_column_config_v2');
    } else {
      setColumnConfig(newConfig);
      localStorage.setItem('pr_column_config_v2', JSON.stringify(newConfig));
    }
    setShowColConfig(false);
  };

  const { theme, warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");
  const [barcodeInput, setBarcodeInput] = useState('');

  const formatPrice = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Theme toggle (synced across pages)
  const [prTheme, setPrTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = prTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', prTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [prTheme, themeColor, themeColorHover, themeLight]);
  const initialState = {
    series: 'MAT-PRE-.YYYY.-',
    posting_date: getLocalISODate(),
    posting_time: new Date().toTimeString().slice(0, 5),
    apply_putaway_rule: false,
    is_return: false,
    supplier: '',
    supplier_name: '',
    supplier_delivery_note: '',
    currency: 'AED',
    buying_price_list: 'Standard Buying',
    set_warehouse: localStorage.getItem('warehouse') || '',
    taxes_and_charges: '',
    apply_discount_on: 'Net Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    rounded_total: 0,
    items: [{
      item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00',
      custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: ''
    }],
    taxes: [{
      add_row: true,
      charge_type: '',
      account_head: '',
      rate: 0,
      tax_amount: 0,
      total: '0.00',
      row_id: ''
    }],
    total_qty: 0,
    net_total: 0,
    taxes_added: '0.00',
    taxes_deducted: '0.00',
    total_taxes_and_charges: '0.00',
    discounted_amount: '0.00',
    grand_total: '0.00',
    docstatus: 0
  };

  const [formData, setFormData] = useState(initialState);

  const isDirty = useMemo(() => {
    if (!docName) return true; // New docs are always dirty
    const current = JSON.stringify(formData);
    return lastSavedData !== current;
  }, [formData, lastSavedData, docName]);
  const [searchSupplier, setSearchSupplier] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [itemsList, setItemsList] = useState([]);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [taxesTemplates, setTaxesTemplates] = useState([]);
  const [taxTypes, setTaxTypes] = useState(['Actual', 'On Net Total', 'On Previous Row Amount', 'On Previous Row Total', 'Compound']); // charge_types
  const location = useLocation();
  const [filterName, setFilterName] = useState(location.state?.search || '');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState({});
  const supplierRef = useRef(null);
  const itemRefs = useRef({});
  const recalcTaxesAndTotals = useCallback((items, net_total, taxes, additional_discount_percentage, discount_amount, rounded_total, apply_discount_on = 'Net Total') => {
    let prev_tax_amount = 0;
    let prev_total = net_total; // ← IMPORTANT: Initialize here
    const updatedTaxes = [];
    for (const tax of taxes) {
      const charge_type = tax.charge_type || "On Net Total";
      const rate = parseFloat(tax.rate) || 0;
      const tax_amount_fixed = parseFloat(tax.tax_amount) || 0;
      let gross_tax = 0;
      if (charge_type === 'Actual') {
        gross_tax = tax_amount_fixed;
      } else {
        let base = 0;
        if (charge_type === 'On Net Total') {
          base = net_total;
        } else if (charge_type === 'On Previous Row Amount') {
          base = prev_tax_amount;
        } else if (charge_type === 'On Previous Row Total' || charge_type === 'Compound') {
          base = prev_total;
        } else {
          base = net_total;
        }
        gross_tax = base * (rate / 100);
      }
      // add_row can be boolean, 1, or "Add"
      const isAdd = tax.add_row === true || tax.add_row === 1 || tax.add_deduct_tax === "Add";
      const signed_total = isAdd ? gross_tax : -gross_tax;
      updatedTaxes.push({
        ...tax,
        total: signed_total.toFixed(2),
        tax_amount: gross_tax.toFixed(2) // optional: show base tax
      });
      prev_tax_amount = gross_tax;
      prev_total += signed_total;
    }
    const added = updatedTaxes.filter(t => {
      const isAdd = t.add_row === true || t.add_row === 1 || t.add_deduct_tax === "Add";
      return isAdd;
    }).reduce((sum, t) => sum + parseFloat(t.total || 0), 0);
    const deducted = updatedTaxes.filter(t => {
      const isAdd = t.add_row === true || t.add_row === 1 || t.add_deduct_tax === "Add";
      return !isAdd;
    }).reduce((sum, t) => sum + Math.abs(parseFloat(t.total || 0)), 0);
    const total_taxes = added - deducted;
    const grand_before_discount = net_total + total_taxes;
    const discount_perc = parseFloat(additional_discount_percentage) || 0;
    const discount_amt = parseFloat(discount_amount) || 0;
    let discounted_amount = 0;
    if (apply_discount_on === 'Net Total') {
      discounted_amount = (net_total * (discount_perc / 100)) + discount_amt;
    } else {
      discounted_amount = (grand_before_discount * (discount_perc / 100)) + discount_amt;
    }
    const grand_total = grand_before_discount - discounted_amount;
    const final_rounded_total = parseFloat(rounded_total) || Math.round(grand_total * 100) / 100;
    return {
      taxes: updatedTaxes,
      taxes_added: added.toFixed(2),
      taxes_deducted: deducted.toFixed(2),
      total_taxes_and_charges: total_taxes.toFixed(2),
      discounted_amount: discounted_amount.toFixed(2),
      grand_total: grand_total.toFixed(2),
      rounded_total: final_rounded_total.toFixed(2)
    };
  }, []);
  const fetchWorkflowActions = async () => {
    if (!docName) return;
    try {
      const res = await axios.get(`${API_PATH}.get_document_status_details`, {
        params: { doctype: 'Purchase Receipt', docname: docName },
        withCredentials: true
      });
      const details = res.data.message?.data || res.data.message || {};
      setAllowedActions(details.allowed_actions || []);

      // Update metrics in formData for UI logic
      if (details.per_received !== undefined || details.per_billed !== undefined) {
        setFormData(prev => ({
          ...prev,
          per_received: details.per_received ?? prev.per_received,
          per_billed: details.per_billed ?? prev.per_billed
        }));
      }
    } catch (err) { console.error("Workflow fetch failed", err); }
  };

  const handleCreateFlow = (type) => {
    // Navigate to respective module with mapping data
    if (type === 'invoice') {
      navigate(`/purchaseinvoicelist?pr=${encodeURIComponent(docName || formData.name)}`);
    }
  };

  const handleDocAction = async (action) => {
    if (action === 'save' || action === 'submit') {
      if (!validateForm()) return;
    }

    const confirmMap = {
      submit: 'SUBMIT this Purchase Receipt? This will permanently update inventory.',
      cancel: 'CANCEL this Purchase Receipt? This will reverse stock entries.',
      delete: 'DELETE this Purchase Receipt? This action is permanent.',
      amend: 'Create a new Draft from this cancelled receipt?'
    };

    if (confirmMap[action]) {
      const result = await Swal.fire({
        title: action.toUpperCase(),
        text: confirmMap[action],
        icon: action === 'delete' ? 'error' : 'warning',
        showCancelButton: true,
        confirmButtonColor: action === 'cancel' || action === 'delete' ? '#ef4444' : '#10b981'
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
          doctype: 'Purchase Receipt',
          doc_data: payload,
          action: action
        }, { withCredentials: true });
      } else {
        res = await axios.post(`${API_PATH}.handle_document_action`, {
          doctype: 'Purchase Receipt',
          docname: docName || undefined,
          action: action,
          doc_data: undefined
        }, { withCredentials: true });
      }

      const rawMsg = res.data.message || {};
      const success = rawMsg.success || rawMsg.status === 'success';

      if (success) {
        // Subtle non-blocking Toast feedback
        Swal.fire({
          icon: 'success',
          title: `${action === 'save' ? 'Draft Saved' : action === 'submit' ? 'Receipt Submitted' : action.toUpperCase() + ' Successful'}`,
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });

        if (action === 'delete') {
          setIsModalOpen(false);
          fetchReceipts();
          return;
        }

        setLastSavedData(JSON.stringify(payload)); // Update base for dirty check after save
        const nextDoc = (rawMsg.data && rawMsg.data.name) || rawMsg.new_name || rawMsg.docname || docName;
        if (nextDoc !== docName) {
          fetchReceiptForEdit(nextDoc);
          if (action === 'amend') setIsViewMode(false);
        } else {
          fetchReceiptForEdit(docName);
        }
        fetchReceipts();
      } else {
        throw new Error(rawMsg.message || "Operation failed");
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: err.response?.data?.message || err.message,
        toast: true,
        position: 'top-end',
        timer: 4000,
        showConfirmButton: false
      });
    } finally {
      setSaving(false);
    }
  };
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      const barcode = barcodeInput.trim();
      try {
        // Fetch items by barcode
        const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
        const res = await axios.get(`${API_PATH}.get_item_by_barcode_pr?${warehouseParam}`, {
          params: { barcode: barcode },
          withCredentials: true
        });
        const matchedItems = Array.isArray(res.data.message) ? res.data.message : (res.data.message ? [res.data.message] : []);
        if (matchedItems.length > 0) {
          const item = matchedItems[0]; // First match
          // Fetch rate (reuse existing logic)
          let rate = 0;
          try {
            const rateRes = await axios.get(`${API_PATH}.get_item_buying_rate_pr`, {
              params: {
                item_code: item.item_code,
                buying_price_list: formData.buying_price_list,
                supplier: formData.supplier || undefined
              },
              withCredentials: true
            });
            rate = rateRes.data.message?.rate || 0;
          } catch (err) {
            console.error("Rate fetch failed in barcode:", err);
          }
          // Add to last row
          const lastIndex = formData.items.length - 1;
          selectItem(lastIndex, item);
          if (rate > 0) {
            updateItem(lastIndex, 'rate', rate);
          }
          // Clear input
          setBarcodeInput('');
          // Add new empty row
          addItemRow();
          // Focus on new row's item input
          setTimeout(() => {
            const newRowIndex = formData.items.length - 1;
            const inputs = document.querySelectorAll('.pr-items-input');
            if (inputs[newRowIndex]) inputs[newRowIndex].focus();
          }, 100);
        } else {
          alert('No item found with this barcode');
          setBarcodeInput('');
        }
      } catch (err) {
        console.error('Barcode scan error:', err);
        alert('Error scanning barcode');
        setBarcodeInput('');
      }
    }
  };
  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${LEGACY_API}.get_purchase_receipts`, {
        params: {
          limit: 2000,
          limit_page_length: 2000,
          order_by: 'modified desc',
          fields: '["name","supplier","supplier_name","posting_date","status","grand_total","rounded_total","total","net_total","base_net_total"]',
          warehouse: !isAdmin ? warehouse : undefined,
          extra_fields: JSON.stringify(customColumns)
        },
        withCredentials: true
      });
      if (res.data.message?.success) {
        setReceipts(res.data.message.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchSuppliers = async (query = '') => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_suppliers_pr`, {
        params: { query: query || undefined, warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setSuppliers(data);
      return data;
    } catch (err) {
      console.error('Supplier fetch error:', err);
      setSuppliers([]);
      return [];
    }
  };
  const fetchItems = async (query = '') => {
    try {
      const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
      const res = await axios.get(`${LEGACY_API}.get_items_for_pr?${warehouseParam}`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setItemsList(data);
      return data;
    } catch (err) {
      console.error('Items fetch error:', err);
      setItemsList([]);
      return [];
    }
  };
  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_company_warehouses`, {
        params: { warehouse: !isAdmin ? warehouse : undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setWarehouses(data);
      if (data.length > 0 && !formData.set_warehouse) {
        const userWarehouse = localStorage.getItem('warehouse');
        const defaultWh = (userWarehouse && data.some(w => w.name === userWarehouse))
          ? userWarehouse
          : data[0].name;
        setFormData(prev => ({ ...prev, set_warehouse: defaultWh }));
      }
    } catch (err) {
      console.error('Warehouses fetch error:', err);
      setWarehouses([]);
    }
  };
  const fetchTaxesTemplates = async () => {
    try {
      const companyData = await getDefaultCompany();
      const res = await axios.get(`${LEGACY_API}.get_purchase_taxes_templates`, {
        params: { company: companyData.company },
        withCredentials: true
      });
      const templates = res.data.message || [];
      setTaxesTemplates(templates);

      // Auto-set default 5% tax for NEW documents if nothing selected
      if (!docName && !formData.taxes_and_charges && templates.length > 0) {
        const defaultTax = templates.find(t => t.name.toUpperCase().includes('UAE VAT 5% - NS')) || templates.find(t => t.name.toUpperCase() === 'UAE VAT 5%') || templates.find(t => t.name.includes('5%'));
        if (defaultTax) {
          handleTaxesTemplateChange(defaultTax.name);
        }
      }
    } catch (err) {
      console.error('Taxes templates fetch error:', err);
    }
  };
  const fetchTaxTypes = async () => {
    // Hardcode common tax types for now: Actual, On Net Total, On Previous Row Amount, etc.
    setTaxTypes(['Actual', 'On Net Total', 'On Previous Row Amount', 'On Previous Row Total', 'Compound']);
  };
  const getDefaultCompany = async () => {
    try {
      const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await axios.get(`${LEGACY_API}.get_default_company`, { withCredentials: true });
      return res.data.message;
    } catch (err) {
      return { company: '', currency: 'AED' };
    }
  };
  // UPDATED: Fetch rate after item selection (proceed even without supplier for general rate)
  const fetchItemRate = useCallback(async (rowIndex, itemCode) => {
    if (!itemCode) {
      console.warn('Item code missing; skipping rate fetch.');
      return;
    }
    setRateLoading(prev => ({ ...prev, [rowIndex]: true }));
    try {
      const rowItem = formData.items[rowIndex];
      const params = {
        item_code: itemCode,
        buying_price_list: formData.buying_price_list,
        warehouse: formData.set_warehouse || localStorage.getItem('warehouse'),
        uom: rowItem?.uom || (rowItem?.use_box_entry ? 'Box' : 'Nos')
      };
      if (formData.supplier) params.supplier = formData.supplier;
      const res = await axios.get(`${API_PATH}.get_item_buying_rate_pr`, {
        params,
        withCredentials: true
      });
      if (res.data.message?.success) {
        const rate = parseFloat(res.data.message.rate) || 0;
        const lastPurRate = parseFloat(res.data.message.last_purchase_rate || res.data.message.last_buying_rate) || rate;
        const pPerBox = parseFloat(rowItem?.custom_pieces_per_box) || 1;
        updateItem(rowIndex, 'rate', rate);
        if (lastPurRate > 0) {
          updateItem(rowIndex, 'last_purchase_rate', lastPurRate);
        }
        if (rowItem?.use_box_entry || (rowItem?.uom || '').toLowerCase() === 'box') {
          updateItem(rowIndex, 'custom_box_price', parseFloat((rate * pPerBox).toFixed(2)));
        }
      }
    } catch (err) {
      console.error('Error fetching item rate:', err.response?.data || err.message);
    } finally {
      setRateLoading(prev => ({ ...prev, [rowIndex]: false }));
    }
  }, [formData.supplier, formData.buying_price_list, formData.set_warehouse, formData.items]);

  const fetchLinkedDocuments = async (name) => {
    if (!name) return;
    setLoadingLinks(true);
    try {
      const KYLE_API = '/api/method/kyle_retail.retail_api.api';
      const res = await axios.get(`${KYLE_API}.get_linked_documents`, {
        params: { doctype: 'Purchase Receipt', name },
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

  const handleCreateInvoice = () => {
    if (!docName) return;
    setIsModalOpen(false);
    setTimeout(() => {
      navigate(`/purchaseinvoicelist?pr=${encodeURIComponent(docName)}`);
    }, 100);
  };

  const handleCreateReturn = async () => {
    if (!docName) return;
    setSaving(true);
    try {
      const res = await axios.get(`${API_PATH}.get_mapped_doc_retail`, {
        params: {
          from_doctype: 'Purchase Receipt',
          to_doctype: 'Purchase Return',
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

        // Open the modal with mapped data
        setFormData({
          ...initialState, // Start with clean state
          ...mappedData,
          is_return: 1,
          return_against: docName,
          status: 'Draft'
        });
        setDocName(''); // Reset for new return doc
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
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchSupplier.trim()) {
        fetchSuppliers(searchSupplier);
        setShowSupplierDropdown(true);
      } else {
        setShowSupplierDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchSupplier]);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target)) {
        setShowSupplierDropdown(false);
      }
      Object.keys(itemRefs.current).forEach(idx => {
        if (itemRefs.current[idx] && !itemRefs.current[idx].contains(e.target)) {
          setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCreateModal = useCallback(async () => {
    const companyData = await getDefaultCompany();
    const userWarehouse = localStorage.getItem('warehouse');
    const defaultWarehouse = (userWarehouse && warehouses.some(w => w.name === userWarehouse))
      ? userWarehouse
      : (warehouses.length > 0 ? warehouses[0].name : '');

    const defaultTaxTemplate = taxesTemplates.find(t => t.name.toUpperCase().includes('UAE VAT 5% - NS'))?.name ||
      taxesTemplates.find(t => t.name.toUpperCase() === 'UAE VAT 5%')?.name ||
      taxesTemplates.find(t => t.name.includes('5%'))?.name || '';

    const initialFormData = {
      series: 'MAT-PRE-.YYYY.-',
      posting_date: getLocalISODate(),
      posting_time: new Date().toTimeString().slice(0, 5),
      apply_putaway_rule: false,
      is_return: false,
      supplier: '', supplier_name: '',
      supplier_delivery_note: '',
      currency: companyData.currency,
      buying_price_list: 'Standard Buying',
      set_warehouse: defaultWarehouse,
      taxes_and_charges: defaultTaxTemplate,
      apply_discount_on: 'Net Total',
      additional_discount_percentage: 0,
      discount_amount: 0,
      rounded_total: 0,
      items: [{
        item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00',
        custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '',
        use_box_entry: false, uom_list: [], stock_uom: ''
      }],
      taxes: [{
        add_row: true,
        charge_type: '',
        account_head: '',
        rate: 0,
        tax_amount: 0,
        total: '0.00',
        row_id: ''
      }],
      total_qty: 0,
      net_total: 0,
      taxes_added: '0.00',
      taxes_deducted: '0.00',
      total_taxes_and_charges: '0.00',
      discounted_amount: '0.00',
      grand_total: '0.00',
      docstatus: 0
    };

    setFormData(initialFormData);
    setFormErrors({});
    setSearchSupplier('');
    setItemSearches({});
    setSuppliers([]);
    setItemsList([]);
    setShowSupplierDropdown(false);
    setShowItemDropdowns({});
    setRateLoading({}); // Reset loading
    setIsModalOpen(true);
    setLastSavedData(JSON.stringify(initialFormData)); // Set base point for dirty check

    if (defaultTaxTemplate) {
      setTimeout(() => {
        handleTaxesTemplateChange(defaultTaxTemplate);
      }, 50);
    }
  }, [warehouses, taxesTemplates]);
  // Fetch UOM list for an item from ERPNext metadata
  const fetchItemUOMs = async (item_code) => {
    try {
      const res = await fetch(`/api/resource/Item/${encodeURIComponent(item_code)}?fields=["uoms","stock_uom"]`, {
        headers: { 'X-Frappe-SID': localStorage.getItem('session') || '' },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      const doc = data.data || {};
      const uomRows = doc.uoms || [];
      const list = uomRows.map(u => ({ uom: u.uom, conversion_factor: parseFloat(u.conversion_factor) || 1 }));
      if (!list.find(u => u.uom === doc.stock_uom)) {
        list.unshift({ uom: doc.stock_uom, conversion_factor: 1 });
      }
      return list;
    } catch (e) {
      return [];
    }
  };

  const handleUOMChange = (arg1, arg2) => {
    // Robust against both (uomValue, rowIndex) and (rowIndex, uomValue)
    let uomValue = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : 'Nos');
    let rowIndex = typeof arg1 === 'number' ? arg1 : (typeof arg2 === 'number' ? arg2 : 0);

    setFormData(prev => {
      const items = [...prev.items];
      if (!items[rowIndex]) return prev;
      const item = { ...items[rowIndex] };
      const isBox = String(uomValue || '').toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        // Box mode
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.accepted_qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
      } else {
        // Nos mode
        item.custom_pieces_per_box = 1;
        item.accepted_qty = parseFloat(item.custom_box_qty) || 0;
      }
      item.received_qty = item.accepted_qty + (parseFloat(item.rejected_qty) || 0);
      item.qty = item.accepted_qty;
      item.amount = (item.accepted_qty * (parseFloat(item.rate) || 0)).toFixed(2);

      items[rowIndex] = item;
      const total_qty = items.reduce((sum, i) => sum + parseFloat(i.received_qty || 0), 0);
      const net_total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      const totals = recalcTaxesAndTotals(items, net_total, prev.taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return { ...prev, items, total_qty, net_total, ...totals };
    });
  };

  // UPDATED: Combined recalc for items update
  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index][field] = value;
      const isBoxMode = items[index].use_box_entry;

      // Real-time calculation for Box Qty and Pieces per Box
      if (field === 'custom_box_qty' || field === 'custom_pieces_per_box') {
        const box_qty = parseFloat(items[index].custom_box_qty) || 0;
        const pcs_per_box = Math.max(1, parseFloat(items[index].custom_pieces_per_box) || 1);

        const total_qty = isBoxMode ? box_qty * pcs_per_box : box_qty;
        items[index].accepted_qty = total_qty;
        items[index].received_qty = total_qty + (parseFloat(items[index].rejected_qty) || 0);
        items[index].qty = total_qty;
        items[index].amount = (total_qty * (parseFloat(items[index].rate) || 0)).toFixed(2);
      } else if (field === 'accepted_qty' || field === 'rejected_qty' || field === 'rate' || field === 'custom_box_price') {
        const accepted_qty = parseFloat(field === 'accepted_qty' ? value : items[index].accepted_qty) || 0;
        const rejected_qty = parseFloat(field === 'rejected_qty' ? value : items[index].rejected_qty) || 0;
        const rate = parseFloat(field === 'rate' ? value : items[index].rate) || 0;
        const pPerBox = parseFloat(items[index].custom_pieces_per_box) || 1;

        if (field === 'custom_box_price') {
          const bp = parseFloat(value) || 0;
          const newRate = pPerBox > 0 ? bp / pPerBox : 0;
          items[index].rate = newRate.toFixed(2);
          items[index].amount = (accepted_qty * newRate).toFixed(2);
        } else if (field === 'rate') {
          items[index].amount = (accepted_qty * rate).toFixed(2);
          if (items[index].use_box_entry) items[index].custom_box_price = (rate * pPerBox).toFixed(2);
        } else {
          items[index].amount = (accepted_qty * rate).toFixed(2);
        }

        items[index].received_qty = accepted_qty + rejected_qty;
        items[index].qty = accepted_qty;

        // Back-calculate Box Qty if needed
        if (field === 'accepted_qty' && pPerBox > 0) {
          items[index].custom_box_qty = isBoxMode ? accepted_qty / pPerBox : accepted_qty;
        }
      } else if (field === 'custom_selling_price') {
        items[index].custom_selling_price = value;
        const sellNos = parseFloat(value) || 0;
        const pcs = parseFloat(items[index].custom_pieces_per_box) || 1;
        if (sellNos > 0 && pcs > 0) {
          items[index].custom_box_selling_price = parseFloat((sellNos * pcs).toFixed(2));
        } else if (value === '' || sellNos === 0) {
          items[index].custom_box_selling_price = '';
        }
      } else if (field === 'custom_box_selling_price') {
        items[index].custom_box_selling_price = value;
        const sellBox = parseFloat(value) || 0;
        const pcs = parseFloat(items[index].custom_pieces_per_box) || 1;
        if (sellBox > 0 && pcs > 0) {
          items[index].custom_selling_price = parseFloat((sellBox / pcs).toFixed(4));
        } else if (value === '' || sellBox === 0) {
          items[index].custom_selling_price = '';
        }
      } else if (field === 'discount_amount') {
        const discAmt = value === '' ? '' : parseFloat(value);
        items[index].discount_amount = discAmt;
        const baseTotal = (parseFloat(items[index].qty) || 0) * (parseFloat(items[index].rate) || 0);
        const numericAmt = parseFloat(discAmt) || 0;
        items[index].discount_percentage = baseTotal > 0 ? parseFloat(((numericAmt / baseTotal) * 100).toFixed(2)) : 0;
        items[index].amount = Math.max(0, baseTotal - numericAmt).toFixed(2);
      } else if (field === 'discount_percentage') {
        const discPct = value === '' ? '' : parseFloat(value);
        items[index].discount_percentage = discPct;
        const baseTotal = (parseFloat(items[index].qty) || 0) * (parseFloat(items[index].rate) || 0);
        const numericPct = parseFloat(discPct) || 0;
        const discAmt = parseFloat((baseTotal * (numericPct / 100)).toFixed(2));
        items[index].discount_amount = discAmt;
        items[index].amount = Math.max(0, baseTotal - discAmt).toFixed(2);
      }

      // Re-apply item discount if qty or rate changed
      if (field === 'custom_box_qty' || field === 'custom_pieces_per_box' || field === 'accepted_qty' || field === 'rate' || field === 'custom_box_price') {
        const baseTotal = (parseFloat(items[index].qty) || 0) * (parseFloat(items[index].rate) || 0);
        const discAmt = parseFloat(items[index].discount_amount) || 0;
        items[index].amount = Math.max(0, baseTotal - discAmt).toFixed(2);
      }
      const total_qty = items.reduce((sum, i) => sum + parseFloat(i.received_qty || 0), 0);
      const net_total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      const totals = recalcTaxesAndTotals(items, net_total, prev.taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        items,
        total_qty,
        net_total,
        ...totals
      };
    });
  };

  const handleNextFocus = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Tab' && e.shiftKey) return;
      e.preventDefault();

      const row = e.target.closest('tr');
      if (row) {
        const rowInputs = Array.from(row.querySelectorAll('input, select')).filter(el => {
          return !el.disabled && !el.readOnly && el.tabIndex !== -1 && (el.offsetWidth > 0 || el.getClientRects().length > 0);
        });

        const index = rowInputs.indexOf(e.target);
        if (index > -1 && index < rowInputs.length - 1) {
          const next = rowInputs[index + 1];
          next.focus();
          if (next.tagName === 'INPUT' && next.select) next.select();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
          const nextRow = row.nextElementSibling;
          if (nextRow) {
            const firstNextInput = nextRow.querySelector('input:not([disabled]):not([readonly]), select:not([disabled])');
            if (firstNextInput) {
              firstNextInput.focus();
              if (firstNextInput.tagName === 'INPUT' && firstNextInput.select) firstNextInput.select();
              firstNextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
          }
        }
      }
    }
  };

  const addItemRow = useCallback(() => {
    setFormData(prev => {
      const newItems = [...prev.items, {
        item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0,
        received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00',
        custom_box_qty: 0, custom_pieces_per_box: 1, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '',
        use_box_entry: false, uom_list: [], stock_uom: ''
      }];
      const total_qty = newItems.reduce((sum, i) => sum + parseFloat(i.received_qty || 0), 0);
      const net_total = newItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      const totals = recalcTaxesAndTotals(newItems, net_total, prev.taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);

      // Auto focus on new row after render
      setTimeout(() => {
        const inputs = document.querySelectorAll('.pr-items-input');
        if (inputs[newItems.length - 1]) {
          inputs[newItems.length - 1].focus();
        }
      }, 100);
      return {
        ...prev,
        items: newItems,
        total_qty,
        net_total,
        ...totals
      };
    });
  }, [recalcTaxesAndTotals]);
  const removeItemRow = (index) => {
    setFormData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      const total_qty = newItems.reduce((sum, i) => sum + parseFloat(i.received_qty || 0), 0);
      const net_total = newItems.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      const totals = recalcTaxesAndTotals(newItems, net_total, prev.taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        items: newItems,
        total_qty,
        net_total,
        ...totals
      };
    });
  };
  const selectSupplier = (supplier) => {
    setFormData(prev => {
      const updated = { ...prev, supplier: supplier.name, supplier_name: supplier.supplier_name };
      // Re-fetch rates for existing items if supplier changes
      updated.items.forEach((item, idx) => {
        if (item.item_code) fetchItemRate(idx, item.item_code);
      });
      return updated;
    });
    setSearchSupplier(supplier.supplier_name || supplier.name);
    setShowSupplierDropdown(false);
  };
  // UPDATED: Non-blocking async (fire-and-forget)
  const selectItem = (rowIndex, item) => {
    let existingIdx = -1;
    let targetIndex = -1;
    setFormData(prev => {
      let items = [...prev.items];
      const isBoxScan = (item.scanned_uom || item.uom || '').toLowerCase() === 'box';
      existingIdx = items.findIndex((i, idx) => 
        idx !== rowIndex && 
        i.item_code === item.item_code && 
        (isBoxScan ? i.use_box_entry : !i.use_box_entry)
      );
      const pcsPerBox = parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 12);

      if (existingIdx !== -1) {
        // Merge with existing item!
        const existingItem = { ...items[existingIdx] };
        if (isBoxScan || existingItem.use_box_entry) {
          existingItem.use_box_entry = true;
          existingItem.uom = 'Box';
          existingItem.custom_pieces_per_box = pcsPerBox;
          existingItem.custom_box_qty = Math.round((parseFloat(existingItem.custom_box_qty) || 0) + 1);
          existingItem.accepted_qty = Math.round(existingItem.custom_box_qty * pcsPerBox);
        } else {
          existingItem.accepted_qty = Math.round((parseFloat(existingItem.accepted_qty) || 0) + 1);
          if (pcsPerBox > 0) {
            existingItem.custom_box_qty = Math.round(existingItem.accepted_qty / pcsPerBox);
          }
        }
        existingItem.received_qty = existingItem.accepted_qty + (parseFloat(existingItem.rejected_qty) || 0);
        existingItem.qty = existingItem.accepted_qty;
        existingItem.amount = (existingItem.accepted_qty * (parseFloat(existingItem.rate) || 0)).toFixed(2);
        items[existingIdx] = existingItem;

        // Remove empty row if rowIndex was an empty placeholder
        items = items.filter(it => it.item_code);
        targetIndex = existingIdx;
      } else {
        const isBoxUom = isBoxScan || (item.stock_uom || '').toLowerCase() === 'box';
        const sellNos = parseFloat(item.custom_selling_price || 0);
        const sellBox = parseFloat(item.custom_box_selling_price || 0) || (sellNos * pcsPerBox);
        const lastPurRate = parseFloat(item.last_purchase_rate || item.last_buying_rate || item.rate || 0);
        const initialBoxPrice = isBoxUom ? (lastPurRate * pcsPerBox) : 0;

        // First find if there is an existing empty row (without item_code)
        const emptyRowIdx = items.findIndex(it => !it.item_code);
        const actualTarget = emptyRowIdx !== -1 ? emptyRowIdx : items.length;

        const newRow = {
          item_code: item.item_code,
          item_name: item.item_name,
          uom: isBoxUom ? 'Box' : (item.stock_uom || 'Nos'),
          accepted_qty: isBoxUom ? Math.round(pcsPerBox) : 1,
          received_qty: isBoxUom ? Math.round(pcsPerBox) : 1,
          rejected_qty: 0,
          qty: isBoxUom ? Math.round(pcsPerBox) : 1,
          rate: lastPurRate,
          last_purchase_rate: lastPurRate,
          custom_box_price: initialBoxPrice,
          custom_box_qty: 1,
          custom_pieces_per_box: pcsPerBox,
          default_pieces_per_box: pcsPerBox,
          custom_selling_price: sellNos,
          custom_box_selling_price: sellBox,
          custom_supplier_sl_num: item.custom_ref_sl_no || item.custom_supplier_sl_num || item.supplier_part_no || '',
          custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
          use_box_entry: isBoxUom,
          amount: ((isBoxUom ? Math.round(pcsPerBox) : 1) * lastPurRate).toFixed(2)
        };

        if (emptyRowIdx !== -1) {
          items[emptyRowIdx] = newRow;
          targetIndex = emptyRowIdx;
        } else {
          items.push(newRow);
          targetIndex = items.length - 1;
        }

        // Clean any leftover empty rows
        items = items.filter(it => it.item_code);
      }

      const total_qty = items.reduce((sum, i) => sum + parseFloat(i.received_qty || 0), 0);
      const net_total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
      const totals = recalcTaxesAndTotals(items, net_total, prev.taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        items,
        total_qty,
        net_total,
        ...totals
      };
    });
    setItemSearches(prev => ({ ...prev, [rowIndex]: '' }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));
    if (existingIdx === -1 && targetIndex !== -1) {
      fetchItemRate(targetIndex, item.item_code);
      fetchItemUOMs(item.item_code).then(uomList => {
        if (uomList && uomList.length > 0) {
          setFormData(current => {
            const currentItems = [...current.items];
            if (currentItems[targetIndex] && currentItems[targetIndex].item_code === item.item_code) {
              currentItems[targetIndex].uom_list = uomList;
            }
            return { ...current, items: currentItems };
          });
        }
      });
    }

    // Auto-focus the custom_ref_sl_no field of the selected item row
    setTimeout(() => {
      const rowNum = rowIndex + 1;
      const targetInput = document.querySelector(`table.purchase-table tbody tr:nth-child(${rowNum}) input[name="custom_ref_sl_no"]`);
      if (targetInput) {
        targetInput.focus();
        targetInput.select?.();
      }
    }, 150);
  };
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
      const res = await fetch(`${API_PATH}.get_suppliers_po?search=${encodeURIComponent(query || '')}`, {
        headers: { 'X-Frappe-SID': localStorage.getItem('session') },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.message || []).map(s => ({ name: s.name, supplier_name: s.supplier_name || s.name }));
    } catch (err) {
      return [];
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
  const addTaxRow = () => {
    setFormData(prev => {
      const newTaxes = [...prev.taxes, { add_row: true, charge_type: '', account_head: '', rate: 0, tax_amount: 0, total: '0.00', row_id: '' }];
      const totals = recalcTaxesAndTotals(prev.items, prev.net_total, newTaxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        taxes: newTaxes,
        ...totals
      };
    });
  };
  const updateTax = (index, field, value) => {
    setFormData(prev => {
      const taxes = [...prev.taxes];
      taxes[index][field] = value;
      const totals = recalcTaxesAndTotals(prev.items, prev.net_total, taxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        taxes,
        ...totals
      };
    });
  };
  const removeTaxRow = (index) => {
    setFormData(prev => {
      const newTaxes = prev.taxes.filter((_, i) => i !== index);
      const totals = recalcTaxesAndTotals(prev.items, prev.net_total, newTaxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
      return {
        ...prev,
        taxes: newTaxes,
        ...totals
      };
    });
  };
  const handleTaxesTemplateChange = async (template) => {
    if (!template) {
      setFormData(prev => {
        const totals = recalcTaxesAndTotals(prev.items, prev.net_total, [], prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
        return {
          ...prev,
          taxes_and_charges: '',
          taxes: [],
          ...totals
        };
      });
      return;
    }
    try {
      const companyData = await getDefaultCompany();
      const res = await axios.get(`${API_PATH}.get_purchase_taxes_from_template`, {
        params: { template, company: companyData.company },
        withCredentials: true
      });
      let newTaxes = (res.data.message || []).map(t => ({
        add_row: t.add_row === 1 || t.add_deduct_tax === "Add", // Handle both 1 and "Add"
        charge_type: t.charge_type || "On Net Total",
        account_head: t.account_head || '',
        rate: parseFloat(t.rate) || 0,
        tax_amount: parseFloat(t.tax_amount) || 0,
        total: '0.00', // initial
        description: t.description || t.account_head || 'Tax'
      }));
      // Recalculate with latest net_total
      setFormData(prev => {
        const net_total = prev.items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const totals = recalcTaxesAndTotals(prev.items, net_total, newTaxes, prev.additional_discount_percentage, prev.discount_amount, prev.rounded_total, prev.apply_discount_on);
        return {
          ...prev,
          taxes_and_charges: template,
          taxes: totals.taxes,
          net_total: net_total,
          taxes_added: totals.taxes_added,
          taxes_deducted: totals.taxes_deducted,
          total_taxes_and_charges: totals.total_taxes_and_charges,
          discounted_amount: totals.discounted_amount,
          grand_total: totals.grand_total,
          rounded_total: totals.rounded_total
        };
      });
    } catch (err) {
      console.error('Error loading taxes template:', err);
    }
  };
  const updateDiscount = (field, value) => {
    setFormData(prev => {
      let newApply = prev.apply_discount_on;
      let newPerc = prev.additional_discount_percentage;
      let newAmt = prev.discount_amount;
      if (field === 'apply_discount_on') {
        newApply = value;
      } else if (field === 'additional_discount_percentage') {
        newPerc = parseFloat(value) || 0;
      } else if (field === 'discount_amount') {
        newAmt = parseFloat(value) || 0;
      } else if (field === 'rounded_total') {
        return { ...prev, rounded_total: value };
      }
      const totals = recalcTaxesAndTotals(prev.items, prev.net_total, prev.taxes, newPerc, newAmt, prev.rounded_total, newApply);
      return {
        ...prev,
        apply_discount_on: newApply,
        additional_discount_percentage: newPerc,
        discount_amount: newAmt,
        ...totals
      };
    });
  };
  const validateForm = () => {
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (!formData.set_warehouse) errors.set_warehouse = 'Set Warehouse is required';
    if (formData.items.filter(i => i.item_code && parseFloat(i.accepted_qty) > 0).length === 0) {
      errors.items = 'At least one valid item required';
    }

    // Check if Selling Price is less than Buying Rate for any item
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.item_code) continue;
      const buyRateNos = parseFloat(item.rate) || 0;
      const sellPriceNos = parseFloat(item.custom_selling_price) || 0;
      const pcsPerBox = parseFloat(item.custom_pieces_per_box) || 1;
      const buyPriceBox = parseFloat(item.custom_box_price) || (buyRateNos * pcsPerBox);
      const sellPriceBox = parseFloat(item._temp_box_selling_price || (sellPriceNos * pcsPerBox)) || 0;

      const currentUom = (item.uom || '').toLowerCase();
      if (currentUom === 'box') {
        if (!sellPriceBox || sellPriceBox <= 0) {
          Swal.fire({
            icon: 'error',
            title: 'Selling Price Required',
            html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/><b>Selling Price (Box)</b> is MANDATORY for Box UOM!`
          });
          return false;
        }
      } else {
        if (!sellPriceNos || sellPriceNos <= 0) {
          Swal.fire({
            icon: 'error',
            title: 'Selling Price Required',
            html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/><b>Selling Price (NOS)</b> is MANDATORY!`
          });
          return false;
        }
      }

      if (sellPriceNos > 0 && buyRateNos > 0 && sellPriceNos < buyRateNos) {
        Swal.fire({
          icon: 'error',
          title: 'Price Restriction Error',
          html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Selling Price (<b>AED ${sellPriceNos.toFixed(2)}</b>) cannot be LESS than Buying Price (<b>AED ${buyRateNos.toFixed(2)}</b>)!`
        });
        return false;
      }

      if (sellPriceBox > 0 && buyPriceBox > 0 && sellPriceBox < buyPriceBox) {
        Swal.fire({
          icon: 'error',
          title: 'Box Price Restriction Error',
          html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Box Selling Price (<b>AED ${sellPriceBox.toFixed(2)}</b>) cannot be LESS than Box Buying Price (<b>AED ${buyPriceBox.toFixed(2)}</b>)!`
        });
        return false;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const handlePrintPDF = (nameToPrint) => {
    const docToPrint = nameToPrint || docName || formData.name;
    if (!docToPrint) return;
    const backendPort = '8089';
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const printUrl = `${protocol}//${host}:${backendPort}/api/method/frappe.utils.print_format.download_pdf?doctype=Purchase%20Receipt&name=${encodeURIComponent(docToPrint)}&format=Purchase%20Receipt%20Print&no_letterhead=1&letterhead=No%20Letterhead&settings=%7B%7D&_lang=en&pdf_generator=wkhtmltopdf`;
    window.open(printUrl, '_blank');
  };

  const handleDuplicate = () => {
    setDocName('');
    setFormData(prev => {
      const cleanedItems = (prev.items || []).map(item => {
        const {
          name, parent, parenttype, parentfield, creation, modified, modified_by, owner, docstatus,
          received_qty, billed_amt, returned_qty, rejected_qty,
          purchase_order, purchase_order_item, purchase_receipt, purchase_receipt_item,
          ...rest
        } = item;
        return {
          ...rest,
          name: '',
          docstatus: 0,
          received_qty: rest.qty || 0,
          billed_amt: 0,
          returned_qty: 0,
          rejected_qty: 0,
          purchase_order: '',
          purchase_order_item: '',
          purchase_receipt: '',
          purchase_receipt_item: ''
        };
      });
      return {
        ...prev,
        name: '',
        status: 'Draft',
        docstatus: 0,
        amended_from: null,
        per_billed: 0,
        per_returned: 0,
        posting_date: getLocalISODate(),
        posting_time: getLocalISOTime(),
        lr_no: '',
        lr_date: '',
        items: cleanedItems
      };
    });
    setIsViewMode(false);
    setIsEditMode(true);
    setIsModalOpen(true);
    setSearchParams({ name: 'new' }, { replace: true });
    Swal.fire({
      icon: 'success',
      title: 'Duplicated!',
      text: 'You are now editing a new Draft copy of this document.',
      timer: 2000
    });
  };

  const fetchReceiptForEdit = async (docName) => {
    try {
      setLoading(true);
      const res = await axios.get(`${RESOURCE_BASE}/Purchase Receipt/${docName}`, { withCredentials: true });
      const doc = res.data.data;
      if (!doc) {
        alert('Receipt not found');
        return;
      }
      const mapped = {
        name: doc.name,
        series: doc.name.split('-')[0] + '-...',
        posting_date: doc.posting_date,
        posting_time: doc.posting_time ? doc.posting_time.split(':').slice(0, 2).map(p => p.padStart(2, '0')).join(':') : '',
        apply_putaway_rule: doc.apply_putaway_rule || false,
        is_return: doc.is_return || false,
        supplier: doc.supplier || '',
        supplier_name: doc.supplier_name || '',
        supplier_delivery_note: doc.supplier_delivery_note || '',
        currency: doc.currency || 'AED',
        buying_price_list: doc.buying_price_list || 'Standard Buying',
        set_warehouse: doc.set_warehouse || '',
        taxes_and_charges: doc.taxes_and_charges || '',
        apply_discount_on: doc.apply_discount_on || 'Net Total',
        additional_discount_percentage: doc.additional_discount_percentage || 0,
        discount_amount: doc.discount_amount || 0,
        rounded_total: doc.rounded_total || 0,
        items: (doc.items || []).map(i => ({
          name: i.name || '',
          item_code: i.item_code || '',
          item_name: i.item_name || '',
          accepted_qty: parseFloat(i.qty) || 0,
          rejected_qty: parseFloat(i.rejected_qty) || 0,
          received_qty: parseFloat(i.received_qty) || 0,
          qty: parseFloat(i.qty) || 0,
          uom: i.uom || '',
          rate: parseFloat(i.rate) || 0,
          amount: parseFloat(i.amount || 0).toFixed(2),
          custom_box_qty: parseFloat(i.custom_box_qty) || 0,
          custom_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
          default_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
          custom_box_price: parseFloat(i.custom_box_price || 0),
          custom_selling_price: parseFloat(i.custom_selling_price || 0),
          custom_supplier_sl_num: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          custom_supplier_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          purchase_order: i.purchase_order || '',
          purchase_order_item: i.purchase_order_item || '',
          use_box_entry: (i.uom || '').toLowerCase() === 'box'
        })),
        taxes: (doc.taxes || []).map(t => ({
          add_row: t.add_deduct_tax === "Add",
          charge_type: t.charge_type || '',
          account_head: t.account_head || '',
          rate: parseFloat(t.rate) || 0,
          tax_amount: parseFloat(t.tax_amount) || 0,
          total: parseFloat(t.total || 0).toFixed(2),
          row_id: t.name || ''
        })),
        total_qty: parseFloat(doc.total_qty) || 0,
        net_total: parseFloat(doc.net_total) || 0,
        taxes_added: parseFloat(doc.taxes_added || 0).toFixed(2),
        taxes_deducted: parseFloat(doc.taxes_deducted || 0).toFixed(2),
        total_taxes_and_charges: parseFloat(doc.total_taxes_and_charges || 0).toFixed(2),
        discounted_amount: parseFloat(doc.discounted_amount || 0).toFixed(2),
        grand_total: parseFloat(doc.grand_total || 0).toFixed(2),
        docstatus: parseInt(doc.docstatus) || 0
      };

      // Data Enrichment: If this is a draft created from a PO, sync missing custom fields
      if (mapped.docstatus === 0) {
        const sourcePOName = doc.items?.find(i => i.purchase_order)?.purchase_order;
        if (sourcePOName) {
          try {
            const poRes = await axios.get(`${RESOURCE_BASE}/Purchase Order/${sourcePOName}`, { withCredentials: true });
            const poDoc = poRes.data.data;
            if (poDoc && poDoc.items) {
              mapped.items = mapped.items.map(item => {
                const poItem = poDoc.items.find(pi => pi.item_code === item.item_code);
                if (poItem) {
                  return {
                    ...item,
                    custom_selling_price: item.custom_selling_price || parseFloat(poItem.custom_selling_price || 0),
                    custom_box_qty: item.custom_box_qty || parseFloat(poItem.custom_box_qty || 0),
                    custom_pieces_per_box: item.custom_pieces_per_box || parseFloat(poItem.custom_pieces_per_box || 1),
                    custom_box_price: item.custom_box_price || parseFloat(poItem.custom_box_price || 0)
                  };
                }
                return item;
              });
            }
          } catch (e) { console.error("Auto-sync from PO failed", e); }
        }
      }

      setFormData(mapped);
      setDocName(doc.name);
      setSearchSupplier(doc.supplier_name || '');
      const isDraft = (parseInt(doc.docstatus) || 0) === 0;
      setIsViewMode(!isDraft ? true : false);
      setIsEditMode(isDraft);
      setIsModalOpen(true);
      setLastSavedData(JSON.stringify(mapped)); // Use mapped object for stable comparison
      if (doc.name) fetchLinkedDocuments(doc.name);

      // Fetch UOMs for all items asynchronously
      mapped.items.forEach((item, index) => {
        if (item.item_code) {
          fetchItemUOMs(item.item_code).then(uoms => {
            if (uoms && uoms.length > 0) {
              setFormData(prev => {
                const updatedItems = [...prev.items];
                if (updatedItems[index] && updatedItems[index].item_code === item.item_code) {
                  updatedItems[index].uom_list = uoms;
                }
                return { ...prev, items: updatedItems };
              });
            }
          });
        }
      });
    } catch (err) {
      console.error('Error fetching receipt:', err);
      if (err.response?.status === 404) {
        setSearchParams({}, { replace: true });
      } else {
        alert('Failed to load receipt: ' + (err.response?.data?.message || err.message));
      }
    } finally {
      setLoading(false);
    }
  }; const navigateToDoc = (doctype, docname) => {
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
    if (!docName || formData.docstatus === undefined || formData.docstatus === null) return null;

    const categories = {
      "Related": ["Purchase Order", "Purchase Invoice", "Quality Inspection"],
      "Payments": ["Payment Entry", "Journal Entry"],
      "Reference": ["Stock Entry", "Landed Cost Voucher"]
    };

    return (
      <div className="so-card" style={{ marginBottom: '1.5rem', border: `1px solid ${themeColor}20`, background: `${themeColor}05` }}>
        <div className="so-card-header" style={{ borderBottom: `1px solid ${themeColor}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={14} style={{ color: themeColor }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColor }}>Connections & Dashboard</span>
          </div>
          {formData.docstatus === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={12} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Submitted</span>
            </div>
          )}
        </div>
        <div className="so-card-body" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Actions Section */}
            {formData.docstatus === 1 && (formData.per_billed < 100) && (
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Actions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={handleCreateInvoice}
                    disabled={saving}
                    className="so-btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.7rem' }}
                  >
                    <Plus size={14} /> Create Purchase Invoice
                  </button>
                  <button
                    onClick={handleCreateReturn}
                    disabled={saving}
                    className="so-btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.7rem', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    <Link size={14} /> Create Purchase Return
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
  ;
  const getPayload = async () => {
    const companyData = await getDefaultCompany();
    // Calculate totals one last time before sending
    const net_total = formData.items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totals = recalcTaxesAndTotals(
      formData.items,
      net_total,
      formData.taxes,
      formData.additional_discount_percentage,
      formData.discount_amount,
      formData.rounded_total,
      formData.apply_discount_on
    );
    const grand_total = parseFloat(totals.grand_total) || 0;
    const rounded_total = parseFloat(totals.rounded_total) || grand_total;
    // conversion_rate usually 1 for AED, but safe aa include
    const conversion_rate = 1.0; // or fetch from company if multi-currency
    return {
      name: docName || undefined,
      doctype: "Purchase Receipt",
      company: companyData.company,
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      posting_time: formData.posting_time,
      currency: formData.currency,
      conversion_rate: conversion_rate,
      set_warehouse: formData.set_warehouse,
      buying_price_list: formData.buying_price_list,
      apply_putaway_rule: formData.apply_putaway_rule,
      is_return: formData.is_return,
      supplier_delivery_note: formData.supplier_delivery_note,
      // IMPORTANT: Explicitly send these
      base_grand_total: grand_total,
      base_rounded_total: rounded_total,
      grand_total: grand_total,
      rounded_total: rounded_total,
      items: formData.items
        .filter(i => i.item_code && parseFloat(i.accepted_qty) > 0)
        .map(i => {
          const isBox = (i.uom || '').toLowerCase() === 'box' || !!i.use_box_entry;
          return {
            name: i.name || undefined,
            doctype: "Purchase Receipt Item",
            item_code: i.item_code,
            received_qty: parseFloat(i.accepted_qty) + parseFloat(i.rejected_qty),
            qty: parseFloat(i.accepted_qty),
            rejected_qty: parseFloat(i.rejected_qty),
            rate: parseFloat(i.rate || 0),
            amount: parseFloat(i.amount || 0),
            base_rate: parseFloat(i.rate || 0),
            base_amount: parseFloat(i.amount || 0),
            uom: i.uom,
            custom_box_qty: isBox ? parseFloat(i.custom_box_qty || 0) : parseFloat(i.accepted_qty),
            custom_pieces_per_box: isBox ? parseFloat(i.custom_pieces_per_box || 1) : 1,
            custom_box_price: isBox ? parseFloat(i.custom_box_price || 0) : parseFloat(i.rate || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            purchase_order: i.purchase_order || undefined,
            purchase_order_item: i.purchase_order_item || undefined,
            custom_supplier_sl_num: i.custom_supplier_sl_num || i.custom_ref_sl_no || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            warehouse: (formData.set_warehouse && formData.set_warehouse !== "undefined" && formData.set_warehouse !== "null") ? formData.set_warehouse : "",
            accepted_warehouse: (formData.set_warehouse && formData.set_warehouse !== "undefined" && formData.set_warehouse !== "null") ? formData.set_warehouse : "",
            rejected_warehouse: (parseFloat(i.rejected_qty) > 0 && formData.set_warehouse && formData.set_warehouse !== "undefined" && formData.set_warehouse !== "null") ? formData.set_warehouse : ""
          };
        }),
      taxes_and_charges: formData.taxes_and_charges,
      taxes: formData.taxes
        .filter(t => t.charge_type && t.account_head)
        .map(t => ({
          doctype: "Purchase Taxes and Charges",
          charge_type: t.charge_type || "On Net Total",
          account_head: t.account_head,
          description: t.account_head,
          rate: parseFloat(t.rate || 0),
          tax_amount: parseFloat(t.tax_amount || 0),
          add_deduct_tax: t.add_row ? "Add" : "Deduct",
          category: "Total"
        })),
      apply_discount_on: formData.apply_discount_on,
      additional_discount_percentage: parseFloat(formData.additional_discount_percentage || 0),
      discount_amount: parseFloat(formData.discount_amount || 0)
    };
  };
  const handleSaveDraft = async () => {
    handleDocAction('save');
  };
  const handleSubmit = async () => {
    handleDocAction('submit');
  };
  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    const companyData = await getDefaultCompany();
    if (!companyData.company) {
      alert('No default company set');
      setSaving(false);
      return;
    }
    const payload = {
      doctype: "Purchase Receipt",
      company: companyData.company,
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      posting_time: formData.posting_time,
      currency: formData.currency,
      set_warehouse: formData.set_warehouse,
      buying_price_list: formData.buying_price_list,
      apply_putaway_rule: formData.apply_putaway_rule,
      is_return: formData.is_return,
      supplier_delivery_note: formData.supplier_delivery_note,
      items: formData.items
        .filter(i => i.item_code && parseFloat(i.accepted_qty) > 0)
        .map(i => {
          const accepted_qty = parseFloat(i.accepted_qty);
          const rejected_qty = parseFloat(i.rejected_qty);
          return {
            name: i.name || undefined,
            doctype: "Purchase Receipt Item",
            item_code: i.item_code,
            received_qty: accepted_qty + rejected_qty,
            qty: accepted_qty,
            rejected_qty: rejected_qty,
            rate: parseFloat(i.rate || 0),
            amount: parseFloat(i.amount || 0),
            uom: i.uom,
            warehouse: formData.set_warehouse,
            accepted_warehouse: formData.set_warehouse,
            rejected_warehouse: rejected_qty > 0 ? formData.set_warehouse : '',
            custom_box_qty: parseFloat(i.custom_box_qty || 0),
            custom_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
            custom_box_price: parseFloat(i.custom_box_price || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            purchase_order: i.purchase_order || undefined,
            purchase_order_item: i.purchase_order_item || undefined,
            custom_supplier_sl_num: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_supplier_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || ''
          };
        }),
      taxes_and_charges: formData.taxes_and_charges,
      taxes: formData.taxes
        .filter(t => t.charge_type && t.account_head) // Only valid rows
        .map(t => ({
          doctype: "Purchase Taxes and Charges",
          charge_type: t.charge_type || "On Net Total",
          account_head: t.account_head,
          description: t.account_head, // ← This fixes the mandatory error
          rate: parseFloat(t.rate || 0),
          tax_amount: parseFloat(t.tax_amount || 0),
          add_deduct_tax: t.add_row ? "Add" : "Deduct",
          category: "Total"
        })),
      apply_discount_on: formData.apply_discount_on,
      additional_discount_percentage: parseFloat(formData.additional_discount_percentage || 0),
      discount_amount: parseFloat(formData.discount_amount || 0),
      rounded_total: parseFloat(formData.rounded_total || 0)
    };
    try {
      const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
      const createRes = await axios.post(GENERIC_API, {
        doctype: "Purchase Receipt",
        data: payload
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });

      const apiResp = createRes.data.message || createRes.data;
      if (apiResp.name) {
        const createdName = apiResp.name;
        // Submit immediately if this is manual create submit
        await axios.put(
          `${RESOURCE_BASE}/Purchase Receipt/${createdName}`,
          { docstatus: 1 },
          { withCredentials: true }
        );
        alert('Purchase Receipt Created & Submitted: ' + createdName);
        setIsModalOpen(false);
        fetchReceipts();
      } else {
        alert('Failed to create receipt. Check console.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.exception ||
        err.response?.data?.message ||
        err.message || 'Unknown error';
      console.error('Create error:', err.response?.data || err);
      alert('Save failed: ' + errorMsg);
    } finally {
      setSaving(false);
    }
  };
  const filteredReceipts = useMemo(() => {
    return receipts.filter(rec => {
      const matchesName = !filterName || (rec.name || '').toLowerCase().includes(filterName.toLowerCase());
      const matchesSupplier = !filterSupplier || (rec.supplier_name || rec.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase());
      const matchesStatus = !filterStatus || rec.status === filterStatus;
      const recDateStr = String(rec.posting_date || '').slice(0, 10);
      const matchesFrom = !filterDateFrom || recDateStr >= String(filterDateFrom).slice(0, 10);
      const matchesTo = !filterDateTo || recDateStr <= String(filterDateTo).slice(0, 10);
      return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [receipts, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);
  const total = filteredReceipts.length;
  const paginated = filteredReceipts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);
  const getStatusColor = (status) => {
    const map = {
      'Completed': 'status-paid',
      'To Bill': 'status-unpaid',
      'Draft': 'status-draft',
      'Return Issued': 'status-return',
      'Cancelled': 'status-overdue',
    };
    return map[status] || 'status-default';
  };
  const clearFilters = () => {
    setFilterName('');
    setFilterSupplier('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDocName('');
    setIsEditMode(false);
    setIsViewMode(false);
    setFormErrors({});
    setBarcodeInput('');
    setSearchParams({}); // Clear query params to prevent reopening
  };

  useEffect(() => {
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart));
      const nameFromUrl = params.get('name');
      if (nameFromUrl && nameFromUrl !== 'new') {
        setTimeout(() => fetchReceiptForEdit(nameFromUrl), 500);
        // Clear URL params so refresh goes to list view
        window.history.replaceState(null, '', window.location.pathname + '#' + hash.slice(0, queryStart));
      }
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
    fetchWarehouses();
    fetchTaxesTemplates();
    fetchTaxTypes();
  }, [customColumns]);

  useEffect(() => {
    const poNameParam = searchParams.get('po_name');
    if (poNameParam) {
      setSaving(true);
      axios.get(`${API_PATH}.get_mapped_doc_retail`, {
        params: {
          from_doctype: 'Purchase Order',
          to_doctype: 'Purchase Receipt',
          source_name: poNameParam
        },
        withCredentials: true
      }).then(res => {
        const msg = res.data.message || res.data;
        if (msg.status === 'success' || res.data.status === 'success') {
          const rawData = msg.data || res.data.data;
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
          const mappedItems = (mappedData.items || []).map(it => ({
            ...it,
            accepted_qty: it.qty || it.accepted_qty || 0,
            received_qty: it.qty || it.received_qty || 0,
            qty: it.qty || 0,
            rate: it.rate || 0,
            amount: ((it.qty || 0) * (it.rate || 0)).toFixed(2),
            custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || '',
            use_box_entry: (it.uom || '').toLowerCase() === 'box'
          }));
          setFormData(prev => ({
            ...initialState,
            ...mappedData,
            items: mappedItems.length > 0 ? mappedItems : initialState.items,
            status: 'Draft',
            docstatus: 0
          }));
          setDocName('');
          setIsViewMode(false);
          setIsEditMode(false);
          setIsModalOpen(true);
        }
      }).catch(err => {
        console.error('PO Mapping Error:', err);
      }).finally(() => {
        setSaving(false);
      });
      return;
    }

    const nameParam = searchParams.get('name');
    if (nameParam === 'new') {
      if (!isModalOpen) {
        openCreateModal();
      }
    } else if (nameParam) {
      if (nameParam.startsWith('ACC-PINV-') || nameParam.startsWith('PINV-') || nameParam.startsWith('PUR-ORD-') || nameParam.startsWith('PO-')) {
        setSearchParams({}, { replace: true });
        return;
      }
      if (nameParam !== docName) {
        if (nameParam !== formData.return_against) {
          fetchReceiptForEdit(nameParam);
        }
      } else {
        const modeParam = searchParams.get('mode');
        if (modeParam === 'edit' && isViewMode) {
          setIsViewMode(false);
          setIsEditMode(true);
        }
      }
    } else {
      // If no nameParam and no po_name, close modal automatically so page responds to browser navigation
      if (isModalOpen) {
        setIsModalOpen(false);
        setDocName('');
        setIsViewMode(false);
        setIsEditMode(false);
      }
    }

  }, [searchParams, openCreateModal, isModalOpen, docName]);

  useEffect(() => {
    const supplierParam = searchParams.get('supplier');
    if (supplierParam) {
      setFilterSupplier(supplierParam);
      setShowFilters(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (docName) fetchWorkflowActions();
  }, [docName, formData.docstatus]);

  // Global Keyboard Shortcuts hook for Edit Modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleGlobalShortcuts = (e) => {
      const activeEl = document.activeElement;
      const inItemsTable = activeEl?.closest('table.purchase-table');

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
        const rows = document.querySelectorAll('table.purchase-table tbody tr');
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
        const scanInput = document.querySelector('input[placeholder="Place cursor here and scan barcode..."]') || document.querySelector('input[placeholder*="Scan or type barcode"]') || document.querySelector('input[placeholder*="barcode"]');
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
              inputValue: item.use_box_entry ? (item.custom_box_qty || '') : (item.accepted_qty || item.qty || ''),
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
                  updateItem(rowIndex, 'accepted_qty', newQty);
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
      if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault();
        if (!saving && (formData.docstatus === 0 || formData.docstatus === undefined)) {
          handleDocAction('save');
        }
      }

      // Add Item Row
      if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        const isDraft = formData.docstatus === 0 || !docName || formData.docstatus === undefined || formData.docstatus === null;
        if (isDraft) {
          if (isViewMode && docName) {
            Swal.fire({
              icon: 'warning',
              title: 'View Only Mode',
              text: 'Click "EDIT DRAFT" at the top right to modify this document.',
              toast: true,
              position: 'top-end',
              timer: 3000,
              showConfirmButton: false
            });
          } else {
            addItemRow();
            setTimeout(() => {
              const itemInputs = document.querySelectorAll('table.purchase-table tbody tr input[placeholder="Search item..."]');
              if (itemInputs.length > 0) {
                const lastInput = itemInputs[itemInputs.length - 1];
                if (lastInput) {
                  lastInput.focus();
                  lastInput.select?.();
                }
              }
            }, 100);
          }
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
      if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.purchase-table')) {
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
  }, [isModalOpen, formData, allowedActions, isViewMode, saving, taxesTemplates]);



  // =========================================================================
  // CLASSIC POS FULL TERMINAL LAYOUT FOR PURCHASE RECEIPT (All Modes: New, Edit, View / Submitted)
  // =========================================================================
  if (isModalOpen) {
    return (
      <div className="classic-root" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
        {/* CLASSIC NAVBAR */}
        <nav className="classic-nav" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div onClick={() => setIsModalOpen(false)} className="cursor-pointer flex items-center">
              <span className="font-black text-sm tracking-tight text-slate-800 flex items-center gap-1.5 uppercase">
                <Package className="w-5 h-5 text-emerald-600" />
                <span>KYLE POS • PURCHASE RECEIPT</span>
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* DOCSTATUS BADGE */}
            {formData.docstatus === 1 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-lg shadow-2xs select-none">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">SUBMITTED</span>
              </div>
            ) : formData.docstatus === 2 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-300 rounded-lg shadow-2xs select-none">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">CANCELLED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg shadow-2xs select-none">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  {docName ? 'DRAFT' : 'NEW'}
                </span>
              </div>
            )}

            {/* ACTION: CANCEL (When Submitted) */}
            {formData.docstatus === 1 && (
              <button
                type="button"
                onClick={() => handleDocAction('cancel')}
                disabled={saving}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                CANCEL
              </button>
            )}

            {/* PRINT PDF */}
            {docName && (
              <button
                type="button"
                onClick={() => handlePrintPDF(docName)}
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              >
                <Printer size={13} />
                <span>PRINT PDF</span>
              </button>
            )}

            {/* DUPLICATE */}
            {docName && (
              <button
                type="button"
                onClick={handleDuplicate}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
              >
                <Copy size={13} />
                <span>DUPLICATE</span>
              </button>
            )}

            {/* CLOSE / BACK TO LIST */}
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)} 
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ml-1"
            >
              <ChevronLeft size={14} />
              <span>BACK TO LIST</span>
            </button>
          </div>
        </nav>

        {/* CLASSIC SHORTCUTS GUIDE BAR */}
        <div className="so-shortcut-guide-banner" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
          <div className="so-shortcut-banner-title" style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping mr-1"></span>
            SHORTCUTS
          </div>
          <div className="so-shortcut-badges-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F2</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SUPPLIER</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#6366f1', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F3</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>ITEM SEARCH</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#06b6d4', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F4</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>BARCODE</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#d946ef', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F6</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>BULK QTY</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F7</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SAVE DRAFT</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#0ea5e9', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F10</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>ADD ROW</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>Ctrl+Enter</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SUBMIT</span>
            </div>
          </div>
        </div>

        {/* CLASSIC HEADER FORM */}
        <div className="classic-header-form" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
          <div className="classic-field flex items-center gap-3 relative flex-1">
            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">SUPPLIER</label>
            <div className="relative group flex-1" ref={supplierRef}>
              <CustomSearchDropdown
                placeholder="Search supplier / vendor..."
                value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                onSelect={(val) => {
                  setFormData(prev => ({ ...prev, supplier: val ? val.name : '', supplier_name: val ? val.supplier_name : '' }));
                }}
                fetchData={fetchSuppliers}
                optionsLabel="supplier_name"
                globalSearch={true}
                themeColor="#10b981"
              />
            </div>

            {formData.supplier && (
              <div className="h-11 px-3 flex items-center gap-1.5 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm shrink-0">
                <Building2 size={13} className="text-emerald-600" />
                <span>{formData.supplier_name || formData.supplier}</span>
              </div>
            )}

            {/* Warehouse Selector Tag */}
            <div className="h-11 px-3 flex items-center border-2 border-slate-200 bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm shrink-0 gap-1.5">
              <Package size={13} className="text-slate-500" />
              {isAdmin ? (
                <select
                  name="set_warehouse"
                  value={formData.set_warehouse || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, set_warehouse: e.target.value }))}
                  disabled={isViewMode}
                  className="bg-transparent border-none outline-none font-black text-xs cursor-pointer"
                >
                  <option value="">Select Branch...</option>
                  {warehouses.map(w => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              ) : (
                <span>{formData.set_warehouse || warehouse || 'Main Warehouse'}</span>
              )}
            </div>
          </div>

          <div className="classic-field flex items-center gap-3 ml-auto">
            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap">PR NO:</label>
            <div className="h-11 px-4 flex items-center bg-slate-100 border-2 border-slate-200 rounded-xl text-xs font-mono font-black text-slate-800">
              {docName || 'NEW-PUR-REC'}
            </div>
          </div>
        </div>

        {/* CLASSIC MAIN BODY: TABLE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <table className="classic-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                  <th style={{ width: '40px', textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>#</th>
                  {columnConfig.filter(c => c.visible).map(col => (
                    <th
                      key={col.id}
                      style={{
                        width: col.width ? `${col.width}px` : 'auto',
                        minWidth: col.width ? `${col.width}px` : '80px',
                        textAlign: ['rate', 'custom_box_price', 'custom_selling_price', 'custom_box_selling_price', 'amount', 'last_purchase_rate'].includes(col.id) ? 'right' : (['uom', 'custom_box_qty', 'custom_pieces_per_box', 'accepted_qty', 'rejected_qty'].includes(col.id) ? 'center' : 'left'),
                        padding: '8px 8px',
                        fontSize: '11px',
                        fontWeight: 900,
                        color: '#475569',
                        textTransform: 'uppercase',
                        borderRight: '1px solid #e2e8f0'
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th style={{ width: '40px', textAlign: 'center', padding: '8px 4px' }}>
                    <button type="button" onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-emerald-600 cursor-pointer" title="Configure Columns">
                      <Settings size={14} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => {
                  if (!item || !item.item_code) return null;
                  const itemIndex = formData.items.indexOf(item);
                  const displayIndex = formData.items.slice(0, idx + 1).filter(it => it && it.item_code).length;
                  return (
                    <tr key={item.item_code ? `${item.item_code}-${idx}` : idx} data-row-index={idx} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                    <td className="text-center font-bold text-slate-400 text-xs py-2 border-r border-slate-100">{displayIndex}</td>
                    {columnConfig.filter(c => c.visible).map(col => {
                      switch (col.id) {
                        case 'barcode':
                          return (
                            <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                              <input
                                type="text"
                                value={item.barcode || ''}
                                onChange={(e) => updateItem(idx, "barcode", e.target.value)}
                                disabled={isViewMode || formData.docstatus !== 0}
                                placeholder="Barcode"
                                className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'item_code':
                          return (
                            <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-xs leading-tight">{item.item_code}</span>
                                <span className="font-semibold text-slate-500 text-[10px] truncate max-w-[180px] leading-tight mt-0.5">{item.item_name || ''}</span>
                              </div>
                            </td>
                          );
                        case 'custom_ref_sl_no':
                          return (
                            <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                              <input
                                type="text"
                                value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                onChange={(e) => updateItem(idx, "custom_ref_sl_no", e.target.value)}
                                disabled={isViewMode || formData.docstatus !== 0}
                                placeholder="Ref / SL #"
                                className="w-full h-8 px-2 text-xs font-bold text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'uom':
                          return (
                            <td key={col.id} className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                              <select
                                value={item.uom || 'Nos'}
                                onChange={(e) => handleUOMChange(e.target.value, idx)}
                                disabled={isViewMode || formData.docstatus !== 0}
                                className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              >
                                <option value="Nos">Nos</option>
                                <option value="Box">Box</option>
                              </select>
                            </td>
                          );
                        case 'custom_box_qty':
                          return (
                            <td key={col.id} className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                              <div className="flex flex-col items-center justify-center">
                                <input
                                  type="number"
                                  value={item.use_box_entry ? (item.custom_box_qty || '') : (item.accepted_qty || '')}
                                  onChange={(e) => updateItem(idx, item.use_box_entry ? "custom_box_qty" : "accepted_qty", e.target.value)}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                                <span className="text-[8px] font-extrabold uppercase text-slate-400 mt-0.5">{item.use_box_entry ? 'BOX' : 'NOS'}</span>
                              </div>
                            </td>
                          );
                        case 'custom_pieces_per_box':
                          return (
                            <td key={col.id} className="px-2 py-1 text-center font-bold text-xs text-slate-700 border-r border-slate-100 align-middle">
                              {item.use_box_entry ? (
                                <input
                                  type="number"
                                  value={item.custom_pieces_per_box || ''}
                                  onChange={(e) => updateItem(idx, "custom_pieces_per_box", e.target.value)}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        case 'custom_box_price':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right font-bold text-xs text-slate-700 border-r border-slate-100 align-middle">
                              {item.use_box_entry ? (
                                <input
                                  type="number"
                                  value={item.custom_box_price || ''}
                                  onChange={(e) => updateItem(idx, "custom_box_price", e.target.value)}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        case 'rate':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                              <input
                                type="number"
                                value={item.rate || ''}
                                onChange={(e) => updateItem(idx, "rate", e.target.value)}
                                disabled={isViewMode || formData.docstatus !== 0}
                                className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'custom_selling_price':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                              <input
                                type="number"
                                value={item.custom_selling_price || ''}
                                onChange={(e) => updateItem(idx, "custom_selling_price", e.target.value)}
                                onBlur={(e) => {
                                  const sellVal = parseFloat(e.target.value) || 0;
                                  const rateVal = parseFloat(item.rate) || 0;
                                  if (sellVal > 0 && rateVal > 0 && sellVal < rateVal) {
                                    updateItem(idx, "custom_selling_price", '');
                                    Swal.fire({
                                      icon: 'error',
                                      title: 'Price Restriction Warning',
                                      html: `Row #${idx + 1} (${item.item_name || item.item_code}):<br/>Selling Price (<b>AED ${sellVal.toFixed(2)}</b>) cannot be LESS than Buying Rate (<b>AED ${rateVal.toFixed(2)}</b>)!<br/><br/><i>Entered value has been cleared.</i>`,
                                      confirmButtonColor: '#ef4444'
                                    });
                                  }
                                }}
                                disabled={isViewMode || formData.docstatus !== 0}
                                className="w-full h-8 px-2 text-right font-black text-xs text-emerald-700 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'custom_box_selling_price':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                              <input
                                type="number"
                                value={item.custom_box_selling_price || ''}
                                onChange={(e) => updateItem(idx, "custom_box_selling_price", e.target.value)}
                                onBlur={(e) => {
                                  const sellVal = parseFloat(e.target.value) || 0;
                                  const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
                                  const buyPriceBox = parseFloat(item.custom_box_price) || ((parseFloat(item.rate) || 0) * pPerBox);
                                  if (sellVal > 0 && buyPriceBox > 0 && sellVal < buyPriceBox) {
                                    updateItem(idx, "custom_box_selling_price", '');
                                    Swal.fire({
                                      icon: 'error',
                                      title: 'Box Price Restriction Warning',
                                      html: `Row #${idx + 1} (${item.item_name || item.item_code}):<br/>Box Selling Price (<b>AED ${sellVal.toFixed(2)}</b>) cannot be LESS than Box Buying Rate (<b>AED ${buyPriceBox.toFixed(2)}</b>)!<br/><br/><i>Entered value has been cleared.</i>`,
                                      confirmButtonColor: '#ef4444'
                                    });
                                  }
                                }}
                                disabled={isViewMode || formData.docstatus !== 0}
                                className="w-full h-8 px-2 text-right font-black text-xs text-sky-700 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'accepted_qty':
                          return (
                            <td key={col.id} className="px-2 py-1 text-center font-black text-xs text-slate-800 border-r border-slate-100 align-middle">
                              {item.accepted_qty || 0}
                            </td>
                          );
                        case 'rejected_qty':
                          return (
                            <td key={col.id} className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                              <input
                                type="number"
                                value={item.rejected_qty || ''}
                                onChange={(e) => updateItem(idx, "rejected_qty", e.target.value)}
                                disabled={isViewMode || formData.docstatus !== 0}
                                className="w-full h-8 text-center font-black text-xs text-rose-700 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                          );
                        case 'amount':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right font-black text-xs text-slate-900 border-r border-slate-100 align-middle">
                              {formatPrice(item.amount || 0)}
                            </td>
                          );
                        case 'last_purchase_rate':
                          return (
                            <td key={col.id} className="px-2 py-1 text-right font-bold text-xs text-amber-700 bg-amber-50/40 border-r border-slate-100 align-middle">
                              {item.last_purchase_rate || item.last_buying_rate ? formatPrice(item.last_purchase_rate || item.last_buying_rate) : '—'}
                            </td>
                          );
                        default:
                          return <td key={col.id} className="px-2 py-1 text-xs border-r border-slate-100 align-middle">{item[col.id] || '—'}</td>;
                      }
                    })}
                    <td className="text-center px-1">
                      <button type="button" onClick={() => removeItemRow(idx)} className="text-rose-400 hover:text-rose-600 font-black text-sm cursor-pointer">×</button>
                    </td>
                  </tr>
                  );
                })}

                {/* ADVANCED: Smart Inline Search Row with Amber Border */}
                <tr className="bg-emerald-50/40 border-y-2 border-amber-400 cursor-pointer hover:bg-amber-50/60 transition-all">
                  <td className="text-center font-black text-amber-600 text-xs py-2">{formData.items.filter(it => it.item_code).length + 1}</td>
                  {(() => {
                    const visibleCols = columnConfig.filter(c => c.visible);
                    const barcodeIdx = visibleCols.findIndex(c => c.id === 'barcode');
                    const itemCodeIdx = visibleCols.findIndex(c => c.id === 'item_code');
                    const hasBoth = barcodeIdx !== -1 && itemCodeIdx !== -1;
                    const primaryIdx = hasBoth ? Math.min(barcodeIdx, itemCodeIdx) : (barcodeIdx !== -1 ? barcodeIdx : itemCodeIdx);
                    const secondaryIdx = hasBoth ? Math.max(barcodeIdx, itemCodeIdx) : -1;

                    return visibleCols.map((col, cIdx) => {
                      if (cIdx === primaryIdx) {
                        return (
                          <td 
                            key="search-input-col" 
                            colSpan={hasBoth && Math.abs(barcodeIdx - itemCodeIdx) === 1 ? 2 : 1} 
                            className="p-0 relative h-10 align-middle"
                          >
                            <CustomSearchDropdown
                              placeholder="SCAN BARCODE OR TYPE ITEM NAME HERE TO ADD..."
                              value={null}
                              onSelect={(selectedItem) => {
                                if (selectedItem) {
                                  selectItem(formData.items.length, selectedItem);
                                }
                              }}
                              fetchData={fetchItems}
                              optionsLabel="item_name"
                              globalSearch={true}
                              themeColor="#10b981"
                              className="w-full h-full font-black italic text-slate-600"
                            />
                          </td>
                        );
                      }
                      if (hasBoth && Math.abs(barcodeIdx - itemCodeIdx) === 1 && cIdx === secondaryIdx) {
                        return null; // Covered by colSpan=2 above
                      }
                      return (
                        <td key={`search-empty-${col.id}`} className="text-center bg-black/5 font-bold text-xs border-r border-slate-100">-</td>
                      );
                    });
                  })()}
                  <td className="text-center px-1">
                    <Search size={14} className="mx-auto text-amber-500" />
                  </td>
                </tr>

                {/* Aesthetic empty placeholder rows */}
                {Array.from({ length: Math.max(0, 14 - formData.items.filter(it => it.item_code).length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="bg-white/40 border-b border-slate-100 opacity-40">
                    <td className="text-center text-slate-300 font-bold text-xs py-2">{formData.items.filter(it => it.item_code).length + i + 2}</td>
                    {columnConfig.filter(c => c.visible).map(col => (
                      <td key={`empty-cell-${col.id}`} className="border-r border-slate-100"></td>
                    ))}
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTTOM SECTION: ACTIONS GRID + TOTALS CARD */}
          <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex-shrink-0">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
              {/* ACTION BUTTON GRID (LEFT SIDE) */}
              <div className="xl:col-span-7 flex">
                <div className="grid grid-cols-4 grid-rows-2 gap-2 w-full h-full">
                  {/* SAVE DRAFT */}
                  {formData.docstatus === 0 || formData.docstatus === undefined ? (
                    <button
                      type="button"
                      onClick={() => handleDocAction('save')}
                      disabled={saving}
                      className="h-full bg-[#fffbeb] hover:bg-[#fef3c7] text-[#78350f] border-2 border-[#fcd34d] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#78350f]">
                        {saving ? <Loader2 size={15} className="animate-spin text-[#d97706]" /> : <Save size={15} />}
                        <span>{saving ? 'SAVING...' : 'SAVE DRAFT'}</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#d97706] text-white">Alt+S</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDocAction('cancel')}
                      disabled={saving || formData.docstatus === 2}
                      className="h-full bg-rose-50 hover:bg-rose-100 text-rose-800 border-2 border-rose-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-800">
                        {saving ? <Loader2 size={15} className="animate-spin text-rose-600" /> : <X size={15} />}
                        <span>CANCEL</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">Alt+C</span>
                    </button>
                  )}

                  {/* SUBMIT (Only in Draft Mode) */}
                  {formData.docstatus === 0 || formData.docstatus === undefined ? (
                    <button
                      type="button"
                      onClick={() => handleDocAction('submit')}
                      disabled={saving}
                      className="h-full bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#064e3b] border-2 border-[#6ee7b7] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#064e3b]">
                        {saving ? <Loader2 size={15} className="animate-spin text-[#047857]" /> : <CheckCircle2 size={15} />}
                        <span>{saving ? 'SUBMITTING...' : 'SUBMIT'}</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-[#047857] text-white">Ctrl+↵</span>
                    </button>
                  ) : (
                    <div className="h-full bg-emerald-50/60 border-2 border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-center text-emerald-700 font-black text-[11px] uppercase tracking-wider select-none animate-in fade-in zoom-in duration-200">
                      <CheckCircle2 size={15} className="mr-1.5 text-emerald-600" />
                      <span>{formData.docstatus === 1 ? 'SUBMITTED' : 'CANCELLED'}</span>
                    </div>
                  )}

                  {/* PRINT PDF */}
                  <button
                    type="button"
                    onClick={() => handlePrintPDF(docName)}
                    disabled={!docName}
                    className="h-full bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#0c4a6e] border-2 border-[#7dd3fc] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#0c4a6e]">
                      <Printer size={15} />
                      <span>PRINT PDF</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#0284c7] text-white">Space</span>
                  </button>

                  {/* DUPLICATE */}
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={!docName}
                    className="h-full bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#4c1d95] border-2 border-[#c084fc] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#4c1d95]">
                      <Copy size={15} />
                      <span>DUPLICATE</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#7c3aed] text-white">Alt+D</span>
                  </button>

                  {/* ADD ROW / PURCHASE RETURN (If Submitted) */}
                  {formData.docstatus === 1 ? (
                    <button
                      type="button"
                      onClick={() => handleCreateReturn()}
                      disabled={saving}
                      className="h-full bg-rose-50 hover:bg-rose-100 text-rose-900 border-2 border-rose-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-rose-900">
                        <Link size={14} />
                        <span>PURCHASE RETURN</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">+Ret</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={addItemRow}
                      disabled={formData.docstatus !== 0 && formData.docstatus !== undefined}
                      className="h-full bg-white hover:bg-slate-100 text-[#1e293b] border-2 border-slate-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#1e293b]">
                        <Plus size={15} />
                        <span>ADD ROW</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#475569] text-white">Alt+A</span>
                    </button>
                  )}

                  {/* BULK QTY / CREATE INVOICE (If Submitted) */}
                  {formData.docstatus === 1 ? (
                    <button
                      type="button"
                      onClick={handleCreateInvoice}
                      disabled={saving}
                      className="h-full bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900">
                        <Plus size={15} />
                        <span>CREATE INVOICE</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-600 text-white">+Inv</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={formData.docstatus !== 0 && formData.docstatus !== undefined}
                      onClick={() => {
                        if (formData.items.length > 0) {
                          const firstIdx = formData.items.findIndex(it => it.item_code);
                          if (firstIdx !== -1) {
                            handleUOMChange(formData.items[firstIdx].use_box_entry ? 'Nos' : 'Box', firstIdx);
                          }
                        }
                      }}
                      className="h-full bg-white hover:bg-slate-100 text-[#1e293b] border-2 border-slate-300 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#1e293b]">
                        <Package size={15} />
                        <span>BULK QTY</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#475569] text-white">F6</span>
                    </button>
                  )}

                  {/* DELETE / CLOSE */}
                  {formData.docstatus === 0 && docName ? (
                    <button
                      type="button"
                      onClick={() => handleDocAction('delete')}
                      disabled={saving}
                      className="h-full bg-[#fff5f5] hover:bg-[#fed7d7] text-[#7f1d1d] border-2 border-[#fca5a5] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#7f1d1d]">
                        <Trash2 size={15} />
                        <span>DELETE</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#dc2626] text-white">Del</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="h-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] border-2 border-[#cbd5e1] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#334155]">
                        <X size={15} />
                        <span>CLOSE</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#64748b] text-white">Esc</span>
                    </button>
                  )}
                </div>
              </div>

              {/* TOTALS CARD (RIGHT SIDE) */}
              <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">TAX TEMPLATE</span>
                    <select
                      value={formData.taxes_and_charges || ''}
                      onChange={(e) => handleTaxesTemplateChange(e.target.value)}
                      className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer p-0 m-0 border-none"
                    >
                      <option value="">No Tax Schedule...</option>
                      {taxesTemplates.map((t) => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">TOTAL QTY:</span>
                    <span className="text-sm font-black text-slate-900">{(parseFloat(formData.total_qty) || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3 pt-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-slate-400">SUBTOTAL</span>
                      <span className="text-slate-800 font-bold text-sm">{formatPrice(formData.net_total || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase text-slate-400">TAX</span>
                      <span className="text-slate-600 font-bold text-sm">{formatPrice(formData.total_taxes_and_charges || 0)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GRAND TOTAL</span>
                    <span className="text-2xl font-black text-emerald-600 leading-none flex items-center gap-0.5 mt-0.5">
                      <DirhamIcon size={18} /> {formatPrice(formData.grand_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STATUS BAR FOOTER */}
          <div className="bg-white border-t border-slate-100 px-4 py-1 text-[10px] text-slate-400 flex items-center gap-5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold uppercase">Items:</span>
              <span className="font-bold text-slate-800">{formData.items.filter(it => it.item_code).length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold uppercase">Supplier:</span>
              <span className="font-bold text-emerald-600">{formData.supplier_name || formData.supplier || 'Not Selected'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold uppercase">Branch:</span>
              <span className="font-bold text-emerald-600">{formData.set_warehouse || warehouse || 'No Branch'}</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 font-bold text-slate-400 opacity-60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>READY · SYSTEM OK</span>
            </div>
          </div>
        </div>

        {/* COLUMN CONFIGURATION MODAL IN CLASSIC VIEW */}
        <ColumnConfigModal
          isOpen={showColConfig}
          onClose={() => setShowColConfig(false)}
          columns={columnConfig}
          onUpdate={handleColConfigUpdate}
          doctype="Purchase Receipt"
        />
      </div>
    );
  }

  // =========================================================================
  // MODERN / MODAL RENDER
  // =========================================================================
  if (isModalOpen) {
    return (
      <>
        <div className="so-page font-sans bg-[#f8fafc] min-h-screen flex flex-col" style={{ height: '100vh', overflowY: 'auto' }}>
          {/* Premium Glassmorphic Keyboard Shortcuts Guide Banner */}
        <div className="so-shortcut-guide-banner">
          <style>{`
            .so-shortcut-guide-banner {
              width: 100%;
              background: #f8fafc;
              border-bottom: 1.5px solid #e2e8f0;
              padding: 6px 16px;
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .so-shortcut-badges-wrapper {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              align-items: center;
              flex: 1;
            }
            .so-shortcut-guide-banner::-webkit-scrollbar {
              display: none;
            }
            .so-shortcut-banner-title {
              display: flex;
              align-items: center;
              margin-top: 5px;
              gap: 4px;
              color: #64748b;
              font-size: 9px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin-right: 6px;
              flex-shrink: 0;
            }
            .so-shortcut-badge {
              display: flex;
              align-items: center;
              gap: 0.35rem;
              padding: 0.25rem 0.5rem;
              background: var(--so-white, #ffffff);
              border: 1.5px solid var(--key-border, #e2e8f0);
              border-radius: 0.5rem;
              cursor: pointer;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              flex-shrink: 0;
              box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
            }
            .so-shortcut-badge.blue {
              --key-color: #3b82f6;
              --key-bg: #eff6ff;
              --key-border: #bfdbfe;
              --key-glow: rgba(59, 130, 246, 0.22);
            }
            .so-shortcut-badge.indigo {
              --key-color: #6366f1;
              --key-bg: #e0e7ff;
              --key-border: #c7d2fe;
              --key-glow: rgba(99, 102, 241, 0.22);
            }
            .so-shortcut-badge.cyan {
              --key-color: #06b6d4;
              --key-bg: #ecfeff;
              --key-border: #cffafe;
              --key-glow: rgba(6, 182, 212, 0.22);
            }
            .so-shortcut-badge.emerald {
              --key-color: #10b981;
              --key-bg: #ecfdf5;
              --key-border: #a7f3d0;
              --key-glow: rgba(16, 185, 129, 0.22);
            }
            .so-shortcut-badge.rose {
              --key-color: #ef4444;
              --key-bg: #fef2f2;
              --key-border: #fecaca;
              --key-glow: rgba(239, 68, 68, 0.22);
            }
            .so-shortcut-badge.amber {
              --key-color: #f59e0b;
              --key-bg: #fffbeb;
              --key-border: #fde68a;
              --key-glow: rgba(245, 158, 11, 0.22);
            }
            .so-shortcut-badge.violet {
              --key-color: #8b5cf6;
              --key-bg: #f5f3ff;
              --key-border: #ddd6fe;
              --key-glow: rgba(139, 92, 246, 0.22);
            }
            .so-shortcut-badge.pink {
              --key-color: #d946ef;
              --key-bg: #fdf4ff;
              --key-border: #f5d0fe;
              --key-glow: rgba(217, 70, 239, 0.22);
            }
            .so-shortcut-badge.sky {
              --key-color: #0ea5e9;
              --key-bg: #f0f9ff;
              --key-border: #bae6fd;
              --key-glow: rgba(14, 165, 233, 0.22);
            }
            .so-shortcut-badge.slate {
              --key-color: #64748b;
              --key-bg: #f8fafc;
              --key-border: #e2e8f0;
              --key-glow: rgba(100, 116, 139, 0.12);
            }
            .so-shortcut-badge:hover {
              border-color: var(--key-color, #0284c7);
              background: var(--key-bg, #f0f9ff);
              transform: translateY(-2px);
              box-shadow: 0 6px 12px -2px var(--key-glow, rgba(2, 132, 199, 0.15)), 0 3px 6px -2px var(--key-glow, rgba(2, 132, 199, 0.08));
            }
            .so-shortcut-key {
              font-size: 9px;
              font-weight: 950;
              color: #ffffff;
              padding: 1.5px 5px;
              background: linear-gradient(135deg, var(--key-color, #0284c7) 0%, rgba(0, 0, 0, 0.25) 100%);
              border: 1.5px solid var(--key-color, #0284c7);
              border-radius: 4px;
              box-shadow: 0 1.5px 3px var(--key-glow, rgba(2, 132, 199, 0.35));
              text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              letter-spacing: 0.02em;
              line-height: 1;
            }
            .so-shortcut-label {
              font-size: 11px;
              font-weight: 950;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              line-height: 1;
            }
            
            /* Clean, Professional Fixed Grid Table Styling */
            .purchase-table {
              table-layout: fixed !important;
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1px solid #cbd5e1 !important;
            }
            .purchase-table th, .purchase-th {
              background: #f8fafc !important;
              color: #64748b !important;
              font-weight: 600 !important;
              border: 1px solid #e2e8f0 !important;
              padding: 6px 4px !important;
              font-size: 0.7rem !important;
              text-transform: capitalize !important;
              letter-spacing: 0.02em !important;
              height: 40px !important;
              text-align: center !important;
              white-space: normal !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              overflow: hidden !important;
              line-height: 1.2 !important;
            }
            .purchase-table td, .purchase-td {
              border: 1px solid #e2e8f0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 40px !important;
              vertical-align: middle !important;
              background: #ffffff !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              white-space: normal !important;
              word-break: break-all !important;
            }
            .purchase-table .premium-cell-container {
              min-height: 40px !important;
              height: auto !important;
              padding: 0 !important;
              display: flex !important;
              align-items: stretch !important;
              justify-content: stretch !important;
            }
            .purchase-table .premium-cell-box {
              height: auto !important;
              min-height: 40px !important;
              width: 100% !important;
              border-radius: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
              padding: 0 !important;
              display: flex !important;
              align-items: stretch !important;
              position: relative !important;
            }
            .purchase-table .premium-cell-box input,
            .purchase-table .premium-cell-box select,
            .purchase-table .premium-cell-box .so-input,
            .purchase-table .premium-cell-box div.relative.flex-1 input {
              border: none !important;
              border-radius: 0 !important;
              height: 40px !important;
              width: 100% !important;
              padding: 0 10px !important;
              background-color: transparent !important;
              box-shadow: none !important;
              font-size: 0.75rem !important;
              color: #1e293b !important;
              font-weight: 500 !important;
              outline: none !important;
              box-sizing: border-box !important;
              text-align: inherit !important;
            }
            .purchase-table .premium-cell-box input:focus,
            .purchase-table .premium-cell-box select:focus,
            .purchase-table .premium-cell-box .so-input:focus,
            .purchase-table .premium-cell-box div.relative.flex-1 input:focus {
              background-color: #f8fafc !important;
              outline: 1.5px solid #3b82f6 !important;
              outline-offset: -1.5px !important;
              z-index: 5 !important;
            }
            .purchase-table .premium-cell-readonly {
              border: none !important;
              background: transparent !important;
              padding: 6px 10px !important;
              height: auto !important;
              min-height: 100% !important;
              width: 100% !important;
              display: block !important;
              text-align: left !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              font-size: 0.75rem !important;
              font-weight: 500 !important;
              color: #334155 !important;
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              white-space: normal !important;
              word-break: break-all !important;
              box-sizing: border-box !important;
            }
            .purchase-table .premium-cell-readonly-center {
              text-align: center !important;
            }
            .purchase-table .premium-cell-readonly-right {
              text-align: right !important;
            }
            /* For Qty Adjust buttons (+/-) layout inside cell */
            .purchase-table .premium-cell-box > div {
              display: flex !important;
              width: 100% !important;
              height: 100% !important;
              gap: 0 !important;
              align-items: stretch !important;
            }
            .purchase-table .premium-cell-box > div button {
              border: none !important;
              border-radius: 0 !important;
              height: 100% !important;
              background: #f8fafc !important;
              color: #64748b !important;
              padding: 0 8px !important;
              font-weight: bold !important;
              cursor: pointer !important;
              transition: background 0.15s !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .purchase-table .premium-cell-box > div button:hover {
              background: #cbd5e1 !important;
              color: #1e293b !important;
            }
            .purchase-table .premium-cell-box > div input {
              flex: 1 !important;
              border: none !important;
              border-radius: 0 !important;
              height: 100% !important;
              text-align: center !important;
              padding: 0 4px !important;
            }
            /* Custom search dropdown container adjustments */
            .purchase-table .relative.flex-1 {
              width: 100% !important;
              height: 100% !important;
            }
            .purchase-table .premium-cell-box > div.flex.gap-2 {
              width: 100% !important;
              height: 100% !important;
              gap: 0 !important;
              align-items: stretch !important;
            }
          `}</style>
          <div className="so-shortcut-banner-title">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Quick Shortcuts
          </div>
          <div className="so-shortcut-badges-wrapper">
          <div className="so-shortcut-badge blue">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</span>
            <span className="so-shortcut-label">Supplier</span>
          </div>
          <div className="so-shortcut-badge indigo">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'itemSearch', 'F3')}</span>
            <span className="so-shortcut-label">Item Search</span>
          </div>
          <div className="so-shortcut-badge cyan">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'barcode', 'F4')}</span>
            <span className="so-shortcut-label">Barcode</span>
          </div>
          <div className="so-shortcut-badge pink">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'bulkQty', 'F6')}</span>
            <span className="so-shortcut-label">Bulk Qty</span>
          </div>
          <div className="so-shortcut-badge violet">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'uom', 'F8')}</span>
            <span className="so-shortcut-label">Toggle UOM</span>
          </div>
          <div className="so-shortcut-badge amber">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'saveDraft', 'F7')}</span>
            <span className="so-shortcut-label">Save Draft</span>
          </div>
          <div className="so-shortcut-badge sky">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut("doc_editor", "addRowAlt", "Alt+A")}</span>
            <span className="so-shortcut-label">Add Row</span>
          </div>
          <div className="so-shortcut-badge violet">
            <span className="so-shortcut-key">{getShortcut('doc_editor', 'warehouseBranch', 'F9')}</span>
            <span className="so-shortcut-label">Warehouse</span>
          </div>
          <div className="so-shortcut-badge emerald">
            <span className="so-shortcut-key">{getShortcut("doc_editor", "submitAlt", "Ctrl+Enter")} / {getShortcut('doc_editor', 'submit', 'F12')}</span>
            <span className="so-shortcut-label">Submit</span>
          </div>
          <div className="so-shortcut-badge slate">
            <span className="so-shortcut-key">Shift+F3 / Ctrl+↓</span>
            <span className="so-shortcut-label">Focus Table</span>
          </div>
          <div className="so-shortcut-badge rose">
            <span className="so-shortcut-key">Escape</span>
            <span className="so-shortcut-label">Close / Clear</span>
          </div>
          <div className="so-shortcut-badge slate">
            <span className="so-shortcut-key">+ / -</span>
            <span className="so-shortcut-label">Qty Adjust</span>
          </div>
          </div>
        </div>

          <div className="so-page-header" style={{ padding: '0.85rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, tracking: 'tight', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isViewMode ? 'View' : (docName ? 'Edit' : 'New')} {formData.is_return === 1 ? 'Purchase Return' : 'Purchase Receipt'}
              </h2>
              {docName && <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{docName} • Procurement</p>}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={() => dispatch(toggleTheme())}
                  className="so-btn-secondary"
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.75rem',
                    background: theme === 'legacy' ? '#ecfdf5' : (theme === 'modern_no_image' ? '#e0e7ff' : '#f0f9ff'),
                    color: theme === 'legacy' ? '#059669' : (theme === 'modern_no_image' ? '#4f46e5' : '#0284c7'),
                    border: `1.5px solid ${theme === 'legacy' ? '#a7f3d0' : (theme === 'modern_no_image' ? '#c7d2fe' : '#bae6fd')}`,
                    borderRadius: '0.75rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Switch UI Theme (Modern / No Image / Classic)"
                >
                  <Palette size={14} />
                  <span>THEME: {(theme || 'modern').toUpperCase()}</span>
                </button>

                {/* Always show DUPLICATE & PRINT PDF if docName exists */}
                {docName && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePrintPDF(docName)}
                      className="so-btn-secondary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                    >
                      <Printer size={14} /> PRINT PDF
                    </button>

                    <button
                      onClick={handleDuplicate}
                      className="so-btn-secondary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                    >
                      <Copy size={14} /> DUPLICATE
                    </button>
                  </>
                )}

                {/* DRAFT PHASE */}
                {(formData.docstatus === 0 || formData.docstatus === undefined) && (
                  <>
                    {/* 1. DELETE button (if allowed) */}
                    {docName && allowedActions.includes('delete') && (
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
                        onClick={() => { setIsViewMode(false); setSearchParams({ name: docName, mode: 'edit' }); }}
                        className="so-btn-secondary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                      >
                        <Edit3 size={14} /> EDIT DRAFT
                      </button>
                    )}

                    {/* 3. The SINGLE PRIMARY action button */}
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

                    {formData.per_billed < 100 && (
                      <button
                        onClick={() => handleCreateFlow('invoice')}
                        className="so-btn-primary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', transition: 'all 0.2s' }}
                      >
                        <Plus size={14} className="inline mr-1" /> CREATE INVOICE
                      </button>
                    )}

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
              </div>
              <button onClick={closeModal} className="so-btn-secondary" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ChevronLeft size={16} /> Back to List
              </button>
            </div>
          </div>

          <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
            <div className="w-full flex flex-col gap-6">
              {/* MAIN CONTENT AREA */}
                {/* Basic Details Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Basic Details</p>
                  </div>
                  <div className="so-card-body">
                    <div className="so-form-grid">
                      <div className="so-field">
                        <label className="so-label">Series</label>
                        <select
                          name="series"
                          value={formData.series}
                          onChange={e => setFormData(prev => ({ ...prev, series: e.target.value }))}
                          disabled={isViewMode}
                          className="so-select"
                          style={{ color: themeColor }}
                        >
                          <option value="MAT-PRE-.YYYY.-">MAT-PRE-.YYYY.-</option>
                        </select>
                      </div>

                      <div className="so-field">
                        <label className="so-label">Target Warehouse (Branch) {!isViewMode && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        {isAdmin ? (
                          <select
                            name="set_warehouse"
                            value={formData.set_warehouse || ''}
                            onChange={e => setFormData(prev => ({ ...prev, set_warehouse: e.target.value }))}
                            disabled={isViewMode}
                            className="so-select"
                          >
                            <option value="">Select Branch Warehouse...</option>
                            {warehouses.map(w => (
                              <option key={w.name} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={formData.set_warehouse || warehouse || '—'}
                            disabled
                            className="so-input"
                            style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}
                          />
                        )}
                        {formErrors.set_warehouse && <span style={{ color: 'red', fontSize: '0.7rem' }}>{formErrors.set_warehouse}</span>}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Posting Date</label>
                        {isViewMode ? (
                          <div className="so-view-field">{format(new Date(formData.posting_date), 'dd-MM-yyyy')}</div>
                        ) : (
                          <input
                            type="date"
                            name="posting_date"
                            value={formData.posting_date}
                            onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                            className="so-input"
                            onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                            onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                          />
                        )}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Posting Time</label>
                        {isViewMode ? (
                          <div className="so-view-field">{formData.posting_time}</div>
                        ) : (
                          <input
                            type="time"
                            name="posting_time"
                            value={formData.posting_time}
                            onChange={e => setFormData(prev => ({ ...prev, posting_time: e.target.value }))}
                            className="so-input"
                            onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                            onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                          />
                        )}
                      </div>



                      <div className="so-field" style={{ gridColumn: 'span 2' }}>
                        <label className="so-label">Supplier / Vendor</label>
                        {isViewMode ? (
                          <div className="so-view-field">{formData.supplier_name} ({formData.supplier})</div>
                        ) : (
                          <div className="relative" ref={supplierRef}>
                            <CustomSearchDropdown
                              placeholder="Search supplier..."
                              value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                              onSelect={selectSupplier}
                              fetchData={fetchSuppliers}
                              optionsLabel="supplier_name"
                              globalSearch={true}
                              onGlobalSearch={async (query) => {
                                const res = await axios.get('/api/method/kyle_retail.retail_api.api.find_supplier_globally_retail', { params: { search_term: query }, withCredentials: true });
                                return res.data.message?.data || [];
                              }}
                              onActivate={async (supp) => {
                                const sName = supp.name || supp.supplier_name;
                                const res = await axios.post('/api/method/kyle_retail.retail_api.api.enable_supplier_for_branch_retail', { supplier: sName, supplier_name: sName, warehouse: localStorage.getItem('warehouse') }, { withCredentials: true });
                                if (res.data.message?.success) {
                                  Swal.fire({ icon: 'success', title: 'Supplier Linked', text: 'Linked to your branch!', timer: 1500, showConfirmButton: false });
                                  return true;
                                }
                                return false;
                              }}
                            />
                          </div>
                        )}
                        {formErrors.supplier && <span style={{ color: 'red', fontSize: '0.7rem' }}>{formErrors.supplier}</span>}
                      </div>

                      <div className="so-field">
                        <label className="so-label">Supplier Delivery Note</label>
                        {isViewMode ? (
                          <div className="so-view-field">{formData.supplier_delivery_note || <span style={{ opacity: 0.3 }}>None</span>}</div>
                        ) : (
                          <input
                            type="text"
                            name="supplier_delivery_note"
                            value={formData.supplier_delivery_note}
                            onChange={e => setFormData(prev => ({ ...prev, supplier_delivery_note: e.target.value }))}
                            className="so-input"
                            placeholder="e.g. DN-12345"
                          />
                        )}
                      </div>


                    </div>
                  </div>
                </div>

                {/* Product Items Table Card */}
                <div className="so-card" style={{ overflow: 'visible' }}>
                  <div className="so-card-header" style={{ padding: '0.8rem 1.25rem' }}>
                    <p className="so-card-title">Product Basket</p>
                    {!isViewMode && (
                      <button onClick={addItemRow} className="so-btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.7rem' }}>
                        <Plus size={12} /> Add Row
                      </button>
                    )}
                  </div>
                  <div className="so-card-body" style={{ padding: 0 }}>
                    {/* Barcode scanner wrapper */}
                    {!isViewMode && (
                      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--so-border)', display: 'flex', gap: '0.5rem', background: '#f8fafc' }}>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Scan / Type item barcode here..."
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            onKeyDown={handleBarcodeScan}
                            className="so-input"
                            style={{ height: '36px', fontSize: '0.75rem' }}
                          />
                        </div>
                      </div>
                    )}                        <div className="purchase-table-container" style={{ boxShadow: 'none' }}>
                          <table className="purchase-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                                {(() => {
                                  const activeCols = columnConfig.filter(c => c.visible);
                                  const anyBoxUom = formData.items.some(i => i.use_box_entry);

                                  return activeCols.map(col => {
                                    if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
                                    let finalLabel = col.label;
                                    if (col.id === 'custom_box_qty') finalLabel = 'QTY';

                                    return (
                                      <th
                                        key={col.id}
                                        style={{
                                          width: col.width,
                                          minWidth: col.id === 'item_code' ? 200 : undefined,
                                          textAlign: ['rate', 'amount', 'custom_selling_price', 'custom_box_selling_price', 'custom_box_price'].includes(col.id) ? 'right' :
                                            ['custom_box_qty', 'accepted_qty', 'rejected_qty', 'custom_pieces_per_box'].includes(col.id) ? 'left' : 'center'
                                        }}
                                      >
                                        {finalLabel}
                                      </th>
                                    );
                                  });
                                })()}
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                  
                                    <button type="button" onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Configure Columns">
                                      <Settings size={16} />
                                    </button>
                                  
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {formData.items.map((item, i) => (
                                <tr key={i} tabIndex={-1}>
                                  <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>

                                  {(() => {
                                    const activeCols = columnConfig.filter(c => c.visible);
                                    const anyBoxUom = formData.items.some(i => i.use_box_entry);
                                    return activeCols.map(col => {
                                      if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
                                      switch (col.id) {
                                        case 'custom_box_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-center pb-0.5 w-full" style={{ color: item.use_box_entry ? themeColor : undefined }}>
                                                      {item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, item.use_box_entry ? "custom_box_qty" : "accepted_qty", e.target.value)}
                                                      className="so-input text-center font-bold w-full h-[28px] border-none"
                                                      style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {item.item_code && (
                                                    <div className="flex justify-center w-full mt-0.5">
                                                      <span
                                                        className="text-[8px] font-extrabold select-none pointer-events-none px-1.5 py-0.2 rounded border uppercase tracking-wider"
                                                        style={{
                                                          color: item.use_box_entry ? themeColor : '#64748b',
                                                          backgroundColor: item.use_box_entry ? `${themeColor}12` : '#f8fafc',
                                                          borderColor: item.use_box_entry ? `${themeColor}25` : '#e2e8f0',
                                                          lineHeight: 1.2
                                                        }}
                                                      >
                                                        {item.use_box_entry ? 'BOX' : 'NOS'}
                                                      </span>
                                                    </div>
                                                  )}
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
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">
                                                      {item.custom_ref_sl_no || item.custom_supplier_sl_num || '—'}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="text"
                                                      name="custom_ref_sl_no"
                                                      value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'custom_ref_sl_no', e.target.value)}
                                                      className="so-input text-center font-bold text-[10px]"
                                                      placeholder="REF / SL #"
                                                    />
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'item_code':
                                          return (
                                            <td key={col.id} ref={el => itemRefs.current[i] = el} style={{ verticalAlign: 'middle' }}>
                                              <div className="premium-cell-container" style={{ minHeight: '36px', justifyContent: 'center' }}>
                                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                                  {!isViewMode ? (
                                                    <div>
                                                      <CustomSearchDropdown
                                                        value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                        placeholder="Search item..."
                                                        onSelect={(val) => selectItem(i, val)}
                                                        fetchData={fetchItems}
                                                        createOption={(query) => {
                                                          window.open('#/itemlist?action=new', '_blank');
                                                        }}
                                                        themeColor={themeColor}
                                                        optionsLabel="name"
                                                        globalSearch={true}
                                                        onGlobalSearch={async (query) => {
                                                          const res = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', { search_term: query }, { withCredentials: true });
                                                          return res.data.message?.data || [];
                                                        }}
                                                        onActivate={async (it) => {
                                                          const res = await axios.post('/api/method/kyle_retail.retail_api.api.enable_item_for_branch_retail', { item_code: it.name || it.item_code, warehouse: localStorage.getItem('warehouse') }, { withCredentials: true });
                                                          if (res.data.message?.success) {
                                                            Swal.fire({ icon: 'success', title: 'Item Linked', text: 'Linked to your branch!', timer: 1500, showConfirmButton: false });
                                                            return true;
                                                          }
                                                          return false;
                                                        }}
                                                      />
                                                      {Boolean(item.item_code && (item.last_purchase_rate || item.last_buying_rate || item.rate)) && (
                                                        <div className="flex items-center gap-1 mt-1 px-1">
                                                          <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shadow-xs">
                                                            Last Pur: AED {formatPrice(item.last_purchase_rate || item.last_buying_rate || item.rate)}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    item.item_code && (
                                                      <div style={{
                                                        padding: '4px 10px',
                                                        background: 'white',
                                                        border: '1px solid #e2e8f0',
                                                        borderLeft: `4px solid ${themeColor}`,
                                                        borderRadius: '0.375rem',
                                                        boxSizing: 'border-box',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        height: '36px'
                                                      }}>
                                                        <div style={{ color: '#1e293b', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'center' }}>
                                                          {item.item_name || 'Unnamed Item'}
                                                        </div>
                                                      </div>
                                                    )
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'custom_supplier_sl_num':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">
                                                      {item.custom_supplier_sl_num || '—'}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="text"
                                                      value={item.custom_supplier_sl_num || ''}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'custom_supplier_sl_num', e.target.value)}
                                                      className="so-input text-left pl-2 font-bold"
                                                      placeholder="SL #"
                                                    />
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
                                                  {item.use_box_entry ? (
                                                    isViewMode ? (
                                                      <div className="premium-cell-readonly premium-cell-readonly-left pl-3">
                                                        {(item.custom_pieces_per_box || 1)}
                                                      </div>
                                                    ) : (
                                                      <input
                                                        type="number"
                                                        value={item.custom_pieces_per_box || 1}
                                                        onFocus={e => e.target.select()}
                                                        onClick={e => e.target.select()}
                                                        onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)}
                                                        className="so-input text-left pl-3 font-bold"
                                                      />
                                                    )
                                                  ) : (
                                                    <div className="premium-cell-readonly premium-cell-readonly-left pl-3">—</div>
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
                                                      {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
                                                    </div>
                                                  ) : (
                                                    <select
                                                      value={item.uom || item.stock_uom || ''}
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
                                        case 'accepted_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-[var(--so-primary)] text-center pb-0.5 w-full">
                                                      {item.accepted_qty}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.accepted_qty}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                                      className="so-input text-center font-bold w-full h-[28px] border-none"
                                                      style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {item.use_box_entry && (
                                                    <div className="flex justify-center w-full mt-0.5">
                                                      <span
                                                        className="text-[8px] font-extrabold select-none pointer-events-none px-1.5 py-0.2 rounded border uppercase tracking-wider"
                                                        style={{
                                                          color: '#64748b',
                                                          backgroundColor: '#f8fafc',
                                                          borderColor: '#e2e8f0',
                                                          lineHeight: 1.2
                                                        }}
                                                      >
                                                        NOS
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'rejected_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-red-500">
                                                      {item.rejected_qty}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.rejected_qty}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                                      className="so-input text-left pl-3 font-bold text-red-500"
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
                                                        step="0.01"
                                                        placeholder="Box Price"
                                                      />
                                                    )}
                                                  </div>
                                                </div>
                                              </td>
                                            );
                                          }
                                        case 'custom_box_price':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {item.use_box_entry ? (
                                                    isViewMode ? (
                                                      <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold">
                                                        {formatPrice(item.custom_box_price)}
                                                      </div>
                                                    ) : (
                                                      <input
                                                        type="number"
                                                        value={item.custom_box_price || 0}
                                                        onFocus={e => e.target.select()}
                                                        onClick={e => e.target.select()}
                                                        onChange={e => updateItem(i, 'custom_box_price', e.target.value)}
                                                        className="so-input text-right pr-3 font-bold"
                                                        step="0.01"
                                                      />
                                                    )
                                                  ) : (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
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
                                                  {isViewMode ? (
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
                                                      step="0.01"
                                                      placeholder={rateLoading[i] ? "..." : "0.00"}
                                                      disabled={rateLoading[i]}
                                                    />
                                                  )}
                                                </div>
                                                {rateLoading[i] && <div style={{ fontSize: '0.65rem', color: themeColor, textTransform: 'uppercase', fontWeight: 800, textAlign: 'center', marginTop: '2px' }}>Loading</div>}
                                              </div>
                                            </td>
                                          );
                                        case 'amount':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800">
                                                    {formatPrice(item.amount)}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          );
                                         case 'last_purchase_rate':
                                           return (
                                             <td key={col.id}>
                                               <div className="premium-cell-container">
                                                 <div className="premium-cell-box">
                                                   <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-amber-700 bg-amber-50/50" style={{ textAlign: 'right' }}>
                                                     {item.last_purchase_rate || item.last_buying_rate ? formatPrice(item.last_purchase_rate || item.last_buying_rate) : '—'}
                                                   </div>
                                                 </div>
                                               </div>
                                             </td>
                                           );
                                         default:
                                           return <td key={col.id}></td>;
                                      }
                                    });
                                  })()}

                                  <td style={{ textAlign: 'center' }}>
                                    <button onClick={() => removeItemRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }} disabled={isViewMode}>
                                      {!isViewMode && <X size={14} />}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                    </div>
                  </div>
                </div>

                {/* Taxes & Charges + Totals — 2 column layout */}
                <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  {/* Left: Tax Template */}
                  <div className="so-card">
                    <div className="so-card-header" style={{ padding: '0.8rem 1.25rem' }}>
                      <p className="so-card-title">Taxes & Charges</p>
                    </div>
                    <div className="so-card-body">
                      <div className="so-field">
                        <label className="so-label">Taxes Template</label>
                        {isViewMode ? (
                          <div className="so-view-field">{formData.taxes_and_charges || <span style={{ opacity: 0.3 }}>None</span>}</div>
                        ) : (
                          <select
                            value={formData.taxes_and_charges || ''}
                            onChange={e => handleTaxesTemplateChange(e.target.value)}
                            className="so-select"
                          >
                            <option value="">No Template</option>
                            {taxesTemplates.map(t => (
                              <option key={t.name} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {docName && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--so-border)' }}>
                          <label className="so-label" style={{ marginBottom: '0.5rem' }}>Attachments</label>
                          <AttachmentSection doctype="Purchase Receipt" docname={docName} compact={false} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Totals Summary */}
                  <div style={{
                    background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColorHover} 100%)`,
                    color: 'white',
                    borderRadius: '0.75rem',
                    padding: '1.75rem',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                        <span>Net Total</span>
                        <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(formData.net_total)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                        <span>Total Tax</span>
                        <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(formData.total_taxes_and_charges)}</span>
                      </div>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.5rem 0' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Grand Total</span>
                        <span style={{ fontSize: '1.6rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DirhamIcon size={20} /> {formatPrice(formData.grand_total)}</span>
                      </div>
                    </div>
                  </div>
                </div> {/* Closes MAIN CONTENT AREA */}
            </div> {/* Closes so-modal-body */}
          </div> {/* Closes so-page */}
        </div>
        {showColConfig && (
          <ColumnConfigModal
            isOpen={showColConfig}
            config={columnConfig}
            onUpdate={handleColConfigUpdate}
            onClose={() => setShowColConfig(false)}
            themeColor={themeColor}
            doctype="Purchase Receipt"
          />
        )}
      </>
    );
  }

  // Otherwise, render the list view page!
  return (
    <>
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header-container" style={{ display: isModalOpen ? 'none' : 'block' }}>
          <div className="so-page-tabs">
            <span className="so-page-tab active">Purchase Receipt</span>
            <span className="so-page-tab" onClick={() => navigate('/purchasereport')} style={{ cursor: 'pointer' }}>Reports</span>
          </div>
          <div className="so-page-header">
            <div className="so-page-left">
              <h1 className="so-page-title">Purchase Receipt Management</h1>
              <p className="so-page-subtitle">{total} total record(s) found</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Theme Toggle */}
              <button
                onClick={() => setPrTheme(isGreen ? 'blue' : 'green')}
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
                {prTheme.toUpperCase()}
              </button>

              <ListCustomizer
                doctype="Purchase Receipt"
                onSave={cols => setCustomColumns(cols)}
                themeColor={themeColor}
              />

              <button onClick={() => setSearchParams({ name: 'new' })} className="so-btn-primary">
                <Plus size={16} /> Create Receipt
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
              <label className="so-filter-label">Receipt Number</label>
              <input
                type="text"
                placeholder="Search receipt..."
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
                <option value="To Bill">To Bill</option>
                <option value="Completed">Completed</option>
                <option value="Return Issued">Return Issued</option>
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
                  <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading receipts...</p>
                </div>
              ) : (
                <>
                  <div className="purchase-table-container">
                    <table className="so-table">
                      <thead>
                        <tr>
                          <th>Receipt Number</th>
                          <th>Supplier</th>
                          <th>Branch / Warehouse</th>
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
                            <td colSpan={7 + customColumns.length} className="so-empty">
                              <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                              <p>No receipts found</p>
                              <button onClick={openCreateModal} style={{ color: themeColor, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                Create your first receipt
                              </button>
                            </td>
                          </tr>
                        ) : (
                          paginated.map(rec => (
                            <tr key={rec.name} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSearchParams({ name: rec.name })}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <a
                                    href={`/#/purchasereceiptlist?name=${rec.name}`}
                                    target={window.location.protocol === 'file:' ? '_self' : '_blank'}
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open in new tab"
                                    style={{ color: themeColor, textDecoration: 'none' }}
                                  >
                                    <ExternalLink size={12} style={{ opacity: 0.6 }} />
                                  </a>
                                  <span style={{ fontWeight: 700, color: themeColor }}>{rec.name}</span>
                                  {rec.is_return === 1 && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      backgroundColor: '#fee2e2',
                                      color: '#ef4444',
                                      padding: '0.1rem 0.4rem',
                                      borderRadius: '0.25rem',
                                      fontWeight: 700,
                                      marginLeft: '0.4rem'
                                    }}>
                                      PURCHASE RETURN
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{rec.supplier_name || rec.supplier}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{rec.supplier}</div>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#334155',
                                  backgroundColor: '#f1f5f9',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '0.375rem',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {rec.set_warehouse || rec.custom_branch || '—'}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: '#475569', fontSize: '0.85rem' }}>{rec.posting_date ? format(new Date(rec.posting_date), 'dd-MM-yyyy') : '—'}</span>
                              </td>
                              <td>
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                  backgroundColor: (rec.status === 'Completed' || rec.status === 'To Bill') ? `${themeColor}20` : (rec.status === 'Draft' ? '#f1f5f9' : '#fee2e2'),
                                  color: (rec.status === 'Completed' || rec.status === 'To Bill') ? themeColor : (rec.status === 'Draft' ? '#64748b' : '#ef4444'),
                                  border: `1px solid ${(rec.status === 'Completed' || rec.status === 'To Bill') ? `${themeColor}40` : (rec.status === 'Draft' ? '#e2e8f0' : '#fecaca')}`
                                }}>
                                  {rec.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                                  <DirhamIcon size={12} />
                                  <span>{rec.is_return === 1 ? '-' : ''}{parseFloat(rec.rounded_total || rec.grand_total || rec.total || rec.base_net_total || rec.net_total || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>
                                </div>
                              </td>
                              {customColumns.map(col => (
                                <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                  {rec[col] !== undefined && rec[col] !== null ? String(rec[col]) : '-'}
                                </td>
                              ))}
                              <td onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setSearchParams({ name: rec.name })}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                  title="Edit / View Details"
                                >
                                  <Edit3 size={15} className="hover:text-emerald-600 transition-colors" />
                                </button>
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
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                          <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem' }}>{currentPage} / {totalPages}</span>
                          <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
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
          <div className="so-modal-overlay" onClick={closeModal} style={{
            padding: 0,
            zIndex: 10500,
            top: '74px',
            height: 'calc(100vh - 74px)',
            background: 'rgba(255, 255, 255, 1)',
            backdropFilter: 'none'
          }}>
            <div className="so-modal" style={{
              maxWidth: 'none',
              width: '100vw',
              height: '100%',
              margin: 0,
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'none'
            }} onClick={e => e.stopPropagation()}>
              <div className="so-modal-header" style={{ padding: '0.85rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, tracking: 'tight', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isViewMode ? 'View' : (docName ? 'Edit' : 'New')} {formData.is_return === 1 ? 'Purchase Return' : 'Purchase Receipt'}
                    </h2>
                    {docName && <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{docName} • Procurement</p>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {docName && (
                      <button
                        onClick={handleDuplicate}
                        className="so-btn-secondary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                      >
                        <Copy size={14} /> DUPLICATE
                      </button>
                    )}

                    {(formData.docstatus === 0 || formData.docstatus === undefined) && (
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

                        {docName && isViewMode && (
                          <button
                            onClick={() => { setIsViewMode(false); setSearchParams({ name: docName, mode: 'edit' }); }}
                            className="so-btn-secondary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                          >
                            <Edit3 size={14} /> EDIT DRAFT
                          </button>
                        )}

                        {!docName ? (
                          <button
                            onClick={() => handleDocAction('save')}
                            disabled={saving}
                            className="so-btn-primary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                          </button>
                        ) : (
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

                        {formData.per_billed < 100 && (
                          <button
                            onClick={() => handleCreateFlow('invoice')}
                            className="so-btn-primary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', transition: 'all 0.2s' }}
                          >
                            <Plus size={14} className="inline mr-1" /> CREATE INVOICE
                          </button>
                        )}

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
                  </div>
                  <button onClick={closeModal} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
                <div className="flex flex-col lg:flex-row gap-6 relative items-start">
                  {/* STICKY SIDEBAR: Linked Documents */}
                  <div className="w-full lg:w-[260px] flex-shrink-0 animate-fadeIn">
                    <div className="sticky top-0 space-y-4">
                      {renderConnectionsDashboard()}
                    </div>
                  </div>

                  {/* MAIN CONTENT AREA */}
                  <div className="flex-1 min-w-0 flex flex-col gap-6">
                    {/* Basic Details Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <p className="so-card-title">Basic Details</p>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid">
                          <div className="so-field">
                            <label className="so-label">Series <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.series || '—'}</div>
                            ) : (
                              <input
                                type="text"
                                value={formData.series}
                                onChange={e => setFormData(prev => ({ ...prev, series: e.target.value }))}
                                className="so-input"
                              />
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Supplier <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                            <CustomSearchDropdown
                              placeholder="Search and select supplier..."
                              value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                              onSelect={selectSupplier}
                              fetchData={fetchSuppliersAPI}
                              createOption={handleSupplierCreate}
                              optionsLabel="supplier_name"
                              disabled={isViewMode}
                            />
                            {formErrors.supplier && <span style={{ color: 'var(--so-danger)', fontSize: '0.7rem', fontWeight: 600 }}>{formErrors.supplier}</span>}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Posting Date <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.posting_date || '—'}</div>
                            ) : (
                              <input
                                type="date"
                                value={formData.posting_date}
                                onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                                className="so-input"
                                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                              />
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Posting Time <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.posting_time || '—'}</div>
                            ) : (
                              <input
                                type="time"
                                value={formData.posting_time}
                                onChange={e => setFormData(prev => ({ ...prev, posting_time: e.target.value }))}
                                className="so-input"
                              />
                            )}
                          </div>


                          <div className="so-field">
                            <label className="so-label">Supplier Ref / Delivery Note</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.supplier_delivery_note || '—'}</div>
                            ) : (
                              <input
                                type="text"
                                value={formData.supplier_delivery_note}
                                onChange={e => setFormData(prev => ({ ...prev, supplier_delivery_note: e.target.value }))}
                                placeholder="Reference number..."
                                className="so-input"
                              />
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem', padding: '0.25rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={formData.apply_putaway_rule}
                              onChange={e => setFormData(prev => ({ ...prev, apply_putaway_rule: e.target.checked }))}
                              disabled={isViewMode}
                            />
                            Apply Putaway Rule
                          </label>

                        </div>
                      </div>
                    </div>

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
                          {!formData.items.some(i => i.purchase_order) && !isViewMode && (
                            <>
                              <button onClick={() => window.open('#/itemlist?action=new', '_blank')} className="so-btn-ghost" style={{ fontSize: '0.7rem', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Go to Create Item Page">
                                <Plus size={14} /> Create Item
                              </button>
                              <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                                <Plus size={14} /> Add Row
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="so-card-body" style={{ padding: 0 }}>
                        <div className="purchase-table-container" style={{ boxShadow: 'none' }}>
                          <table className="purchase-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#f8fafc' }}>No.</th>
                                {(() => {
                                  const hasAnyBox = formData.items.some(i => i.use_box_entry);
                                  const activeCols = columnConfig.filter(c => {
                                    if (!c.visible) return false;
                                    if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'accepted_qty'].includes(c.id)) return false;
                                    return true;
                                  });

                                  const stickyLefts = {
                                    'barcode': 40,
                                    'item_code': 170,
                                    'uom': 350,
                                    'custom_box_qty': 440
                                  };

                                  return activeCols.map(col => {
                                    let finalLabel = col.label;
                                    if (col.id === 'custom_box_qty') finalLabel = 'QTY';
                                    const isLpr = col.id === 'last_purchase_rate';
                                    const isSticky = ['barcode', 'item_code', 'uom', 'custom_box_qty'].includes(col.id);

                                    return (
                                      <th
                                        key={col.id}
                                        style={{
                                          width: col.width,
                                          minWidth: col.id === 'item_code' ? 180 : undefined,
                                          textAlign: ['rate', 'amount', 'custom_selling_price', 'custom_box_selling_price', 'custom_box_price', 'last_purchase_rate'].includes(col.id) ? 'right' :
                                            ['custom_box_qty', 'accepted_qty', 'rejected_qty', 'custom_pieces_per_box'].includes(col.id) ? 'left' : 'center',
                                          backgroundColor: isLpr ? '#fef3c7' : (isSticky ? '#f8fafc' : undefined),
                                          color: isLpr ? '#92400e' : undefined,
                                          fontWeight: isLpr ? 900 : undefined,
                                          position: isSticky ? 'sticky' : undefined,
                                          left: isSticky ? stickyLefts[col.id] : undefined,
                                          zIndex: isSticky ? 20 : undefined,
                                          boxShadow: col.id === 'custom_box_qty' ? '2px 0 5px -2px rgba(0,0,0,0.1)' : undefined
                                        }}
                                      >
                                        {finalLabel}
                                      </th>
                                    );
                                  });
                                })()}
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                  
                                    <button type="button" onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Configure Columns">
                                      <Settings size={16} />
                                    </button>
                                  
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {formData.items.map((item, i) => (
                                <tr key={i} tabIndex={-1}>
                                  <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>

                                  {(() => {
                                    const hasAnyBox = formData.items.some(i => i.use_box_entry);
                                    const activeCols = columnConfig.filter(c => {
                                      if (!c.visible) return false;
                                      if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'accepted_qty'].includes(c.id)) return false;
                                      return true;
                                    });
                                    return activeCols.map(col => {
                                      switch (col.id) {
                                        case 'custom_box_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-center pb-0.5 w-full" style={{ color: item.use_box_entry ? themeColor : undefined }}>
                                                      {item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, item.use_box_entry ? "custom_box_qty" : "accepted_qty", e.target.value)}
                                                      className="so-input text-center font-bold w-full h-[28px] border-none"
                                                      style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {item.item_code && (
                                                    <div className="flex justify-center w-full mt-0.5">
                                                      <span
                                                        className="text-[8px] font-extrabold select-none pointer-events-none px-1.5 py-0.2 rounded border uppercase tracking-wider"
                                                        style={{
                                                          color: item.use_box_entry ? themeColor : '#64748b',
                                                          backgroundColor: item.use_box_entry ? `${themeColor}12` : '#f8fafc',
                                                          borderColor: item.use_box_entry ? `${themeColor}25` : '#e2e8f0',
                                                          lineHeight: 1.2
                                                        }}
                                                      >
                                                        {item.use_box_entry ? 'BOX' : 'NOS'}
                                                      </span>
                                                    </div>
                                                  )}
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
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">
                                                      {item.custom_ref_sl_no || item.custom_supplier_sl_num || '—'}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="text"
                                                      name="custom_ref_sl_no"
                                                      value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'custom_ref_sl_no', e.target.value)}
                                                      className="so-input text-center font-bold text-[10px]"
                                                      placeholder="REF / SL #"
                                                    />
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'item_code':
                                          return (
                                            <td key={col.id} ref={el => itemRefs.current[i] = el} style={{ verticalAlign: 'middle' }}>
                                              <div className="premium-cell-container" style={{ minHeight: '36px', justifyContent: 'center' }}>
                                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                                  {!isViewMode ? (
                                                    <CustomSearchDropdown
                                                      value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                      placeholder="Search item..."
                                                      onSelect={(val) => selectItem(i, val)}
                                                      fetchData={fetchItems}
                                                      themeColor={themeColor}
                                                      optionsLabel="name"
                                                    />
                                                  ) : (
                                                    item.item_code && (
                                                      <div style={{
                                                        padding: '4px 10px',
                                                        background: 'white',
                                                        border: '1px solid #e2e8f0',
                                                        borderLeft: `4px solid ${themeColor}`,
                                                        borderRadius: '0.375rem',
                                                        boxSizing: 'border-box',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        height: '36px'
                                                      }}>
                                                        <div style={{ color: '#1e293b', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'center' }}>
                                                          {item.item_name || 'Unnamed Item'}
                                                        </div>
                                                      </div>
                                                    )
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'custom_supplier_sl_num':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">
                                                      {item.custom_supplier_sl_num || '—'}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="text"
                                                      value={item.custom_supplier_sl_num || ''}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'custom_supplier_sl_num', e.target.value)}
                                                      className="so-input text-left pl-2 font-bold"
                                                      placeholder="SL #"
                                                    />
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
                                                  {item.use_box_entry ? (
                                                    isViewMode ? (
                                                      <div className="premium-cell-readonly premium-cell-readonly-left pl-3">
                                                        {(item.custom_pieces_per_box || 1)}
                                                      </div>
                                                    ) : (
                                                      <input
                                                        type="number"
                                                        value={item.custom_pieces_per_box || 1}
                                                        onFocus={e => e.target.select()}
                                                        onClick={e => e.target.select()}
                                                        onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)}
                                                        className="so-input text-left pl-3 font-bold"
                                                      />
                                                    )
                                                  ) : (
                                                    <div className="premium-cell-readonly premium-cell-readonly-left pl-3">—</div>
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
                                                      {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
                                                    </div>
                                                  ) : (
                                                    <select
                                                      value={item.uom || item.stock_uom || ''}
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
                                        case 'accepted_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-[var(--so-primary)] text-center pb-0.5 w-full">
                                                      {item.accepted_qty}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.accepted_qty}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                                      className="so-input text-center font-bold w-full h-[28px] border-none"
                                                      style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                                    />
                                                  )}
                                                  {item.use_box_entry && (
                                                    <div className="flex justify-center w-full mt-0.5">
                                                      <span
                                                        className="text-[8px] font-extrabold select-none pointer-events-none px-1.5 py-0.2 rounded border uppercase tracking-wider"
                                                        style={{
                                                          color: '#64748b',
                                                          backgroundColor: '#f8fafc',
                                                          borderColor: '#e2e8f0',
                                                          lineHeight: 1.2
                                                        }}
                                                      >
                                                        NOS
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'rejected_qty':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {isViewMode ? (
                                                    <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-red-500">
                                                      {item.rejected_qty}
                                                    </div>
                                                  ) : (
                                                    <input
                                                      type="number"
                                                      value={item.rejected_qty}
                                                      onFocus={e => e.target.select()}
                                                      onClick={e => e.target.select()}
                                                      onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                                      className="so-input text-left pl-3 font-bold text-red-500"
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
                                                        step="0.01"
                                                        placeholder="Box Price"
                                                      />
                                                    )}
                                                  </div>
                                                </div>
                                              </td>
                                            );
                                          }
                                        case 'custom_box_price':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  {item.use_box_entry ? (
                                                    isViewMode ? (
                                                      <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold">
                                                        {formatPrice(item.custom_box_price)}
                                                      </div>
                                                    ) : (
                                                      <input
                                                        type="number"
                                                        value={item.custom_box_price || 0}
                                                        onFocus={e => e.target.select()}
                                                        onClick={e => e.target.select()}
                                                        onChange={e => updateItem(i, 'custom_box_price', e.target.value)}
                                                        className="so-input text-right pr-3 font-bold"
                                                        step="0.01"
                                                      />
                                                    )
                                                  ) : (
                                                    <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
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
                                                  {isViewMode ? (
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
                                                      step="0.01"
                                                      placeholder={rateLoading[i] ? "..." : "0.00"}
                                                      disabled={rateLoading[i]}
                                                    />
                                                  )}
                                                </div>
                                                {rateLoading[i] && <div style={{ fontSize: '0.65rem', color: themeColor, textTransform: 'uppercase', fontWeight: 800, textAlign: 'center', marginTop: '2px' }}>Loading</div>}
                                              </div>
                                            </td>
                                          );
                                        case 'amount':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800">
                                                    {formatPrice(item.amount)}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        case 'last_purchase_rate':
                                          return (
                                            <td key={col.id}>
                                              <div className="premium-cell-container">
                                                <div className="premium-cell-box">
                                                  <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-amber-700 bg-amber-50/50" style={{ textAlign: 'right' }}>
                                                    {item.last_purchase_rate || item.last_buying_rate ? formatPrice(item.last_purchase_rate || item.last_buying_rate) : '—'}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          );
                                        default:
                                          return <td key={col.id}></td>;
                                      }
                                    });
                                  })()}

                                  <td style={{ textAlign: 'center' }}>
                                    <button onClick={() => removeItemRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }} disabled={isViewMode}>
                                      {!isViewMode && <X size={14} />}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
                      {/* Taxes and Charges Card */}
                      <div className="so-card">
                        <div className="so-card-header">
                          <p className="so-card-title">Taxes & Charges</p>
                          {!isViewMode && (
                            <button onClick={addTaxRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                              <Plus size={14} /> Add Row
                            </button>
                          )}
                        </div>
                        <div className="so-card-body">
                          <div className="so-field" style={{ marginBottom: '1.5rem' }}>
                            <label className="so-label">Tax Template</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.taxes_and_charges || 'No Template'}</div>
                            ) : (
                              <select
                                value={formData.taxes_and_charges}
                                onChange={e => handleTaxesTemplateChange(e.target.value)}
                                className="so-select"
                              >
                                <option value="">Select Template</option>
                                {taxesTemplates.map(t => (
                                  <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          {docName && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--so-border)' }}>
                              <label className="so-label" style={{ marginBottom: '0.5rem' }}>Attachments</label>
                              <AttachmentSection doctype="Purchase Receipt" docname={docName} compact={false} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Summary Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{
                          background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColorHover} 100%)`,
                          color: 'white',
                          borderRadius: '0.75rem',
                          padding: '1.75rem',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                              <span>Net Total</span>
                              <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(formData.net_total)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                              <span>Total Tax</span>
                              <span style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={12} /> {formatPrice(formData.total_taxes_and_charges)}</span>
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.5rem 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Grand Total</span>
                              <span style={{ fontSize: '1.6rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DirhamIcon size={20} /> {formatPrice(formData.grand_total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div> {/* Closes MAIN CONTENT AREA */}
                </div> {/* Closes outer flex container */}
              </div> {/* Closes so-modal-body */}
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
          doctype="Purchase Receipt"
        />
      )}
    </>
  );
}
export default PurchaseReceiptList;
