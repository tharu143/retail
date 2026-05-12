import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, X, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon, Barcode, Edit3,
  Trash2, Palette, Loader2, ChevronLeft, ChevronRight, Zap, CheckCircle2, ExternalLink, Link, Settings, FileText
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import '../Admin/SalesOrder.css';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';

// Custom APIs (moved to standardized path)
const API_PATH = '/api/method/kyle_retail.retail_api.api';
const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const RESOURCE_BASE = '/api/resource';

const DEFAULT_PR_COLUMNS = [
  { id: 'item_code',          label: 'Item Code',         visible: true,  width: 240 },
  { id: 'custom_ref_sl_no',   label: 'Ref / Supplier SL #', visible: true, width: 160 },
  { id: 'custom_box_qty',     label: 'Box Qty',           visible: true,  width: 90  },
  { id: 'uom',                label: 'UOM',               visible: true,  width: 80  },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box',        visible: true,  width: 90  },
  { id: 'custom_box_price',   label: 'Box Price',         visible: true,  width: 120 },
  { id: 'rate',               label: 'Rate (Nos)',        visible: true,  width: 120 },
  { id: 'custom_selling_price', label: 'Selling Price',   visible: true,  width: 120 },
  { id: 'accepted_qty',       label: 'Total Qty',         visible: true,  width: 100 },
  { id: 'rejected_qty',       label: 'Rejected Qty',      visible: true,  width: 100 },
  { id: 'amount',             label: 'Subtotal',          visible: true,  width: 140 }
];

function PurchaseReceiptList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
      const saved = localStorage.getItem('pr_column_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_PR_COLUMNS.map(c => c.id);
        const savedIds   = parsed.map(c => c.id);
        const missing    = DEFAULT_PR_COLUMNS.filter(c => !savedIds.includes(c.id));
        return [...parsed, ...missing];
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_PR_COLUMNS;
  };
  const [columnConfig, setColumnConfig]   = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      setColumnConfig(DEFAULT_PR_COLUMNS);
      localStorage.removeItem('pr_column_config');
    } else {
      setColumnConfig(newConfig);
      localStorage.setItem('pr_column_config', JSON.stringify(newConfig));
    }
    setShowColConfig(false);
  };

  const theme = useSelector(state => state.user.theme);
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
    posting_date: new Date().toISOString().split('T')[0],
    posting_time: new Date().toTimeString().slice(0, 5),
    apply_putaway_rule: false,
    is_return: false,
    supplier: '',
    supplier_name: '',
    supplier_delivery_note: '',
    currency: 'AED',
    buying_price_list: 'Standard Buying',
    set_warehouse: '',
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
  const [filterName, setFilterName] = useState('');
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
        Swal.fire('Operation Complete', `${action.toUpperCase()} processed successfully.`, 'success');
        
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
      Swal.fire('Matrix Failure', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      const barcode = barcodeInput.trim();
      try {
        // Fetch items by barcode (your existing endpoint supports it)
        const res = await axios.get(`${LEGACY_API}.get_items_for_pr`, {
          params: { query: barcode },
          withCredentials: true
        });
        const matchedItems = Array.isArray(res.data.message) ? res.data.message : [];
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
          updateItem(lastIndex, 'rate', rate);
          updateItem(lastIndex, 'accepted_qty', 1); // auto qty 1
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
          fields: '["name","supplier","supplier_name","posting_date","status","grand_total","rounded_total","total","net_total","base_net_total"]'
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
        params: { query: query || undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setSuppliers(data);
    } catch (err) {
      console.error('Supplier fetch error:', err);
      setSuppliers([]);
    }
  };
  const fetchItems = async (query = '') => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_items_for_pr`, {
        params: { query: query || undefined },
        withCredentials: true
      });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setItemsList(data);
    } catch (err) {
      console.error('Items fetch error:', err);
      setItemsList([]);
    }
  };
  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_company_warehouses`, { withCredentials: true });
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setWarehouses(data);
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
        const defaultTax = templates.find(t => t.name.toUpperCase() === 'UAE VAT 5%') || templates.find(t => t.name.includes('5%'));
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
      return;1
    }
    // Show loading
    setRateLoading(prev => ({ ...prev, [rowIndex]: true }));
    try {
      console.log(`Fetching rate for item ${itemCode}, supplier: ${formData.supplier || 'none'}`);
      const params = {
        item_code: itemCode,
        buying_price_list: formData.buying_price_list
      };
      if (formData.supplier) params.supplier = formData.supplier;
      const res = await axios.get(`${API_PATH}.get_item_buying_rate_pr`, {
        params,
        withCredentials: true
      });
      console.log('Rate API response:', res.data); // DEBUG: Check full response
      if (res.data.message?.success) {
        const rate = res.data.message.rate || 0;
        console.log(`Setting rate ${rate} for row ${rowIndex}`);
        updateItem(rowIndex, 'rate', rate);
      } else {
        console.error('Rate fetch failed:', res.data.message?.message || 'Unknown error');
        // Fallback to 0 (already default)
      }
    } catch (err) {
      console.error('Error fetching item rate:', err.response?.data || err.message);
    } finally {
      setRateLoading(prev => ({ ...prev, [rowIndex]: false }));
    }
  }, [formData.supplier, formData.buying_price_list]);

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
    const defaultWarehouse = warehouses.length > 0 ? warehouses[0].name : '';
    setFormData({
      series: 'MAT-PRE-.YYYY.-',
      posting_date: new Date().toISOString().split('T')[0],
      posting_time: new Date().toTimeString().slice(0, 5),
      apply_putaway_rule: false,
      is_return: false,
      supplier: '', supplier_name: '',
      supplier_delivery_note: '',
      currency: companyData.currency,
      buying_price_list: 'Standard Buying',
      set_warehouse: defaultWarehouse,
      taxes_and_charges: '',
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
      grand_total: '0.00'
    });
    setFormErrors({});
    setSearchSupplier('');
    setItemSearches({});
    setSuppliers([]);
    setItemsList([]);
    setShowSupplierDropdown(false);
    setShowItemDropdowns({});
    setRateLoading({}); // Reset loading
    setIsModalOpen(true);
    setLastSavedData(JSON.stringify(formData)); // Set base point for dirty check
  }, [warehouses, formData]);
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
    setFormData(prev => {
      const items = [...prev.items];
      const isBoxUom = (item.stock_uom || '').toLowerCase() === 'box' || (item.uom || '').toLowerCase() === 'box';
      const currentAccepted = parseFloat(items[rowIndex].accepted_qty) || 0;
      const newAccepted = currentAccepted > 0 ? currentAccepted : 1;
      const currentRejected = parseFloat(items[rowIndex].rejected_qty) || 0;
      
      items[rowIndex] = {
        ...items[rowIndex],
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos',
        accepted_qty: newAccepted,
        received_qty: newAccepted + currentRejected,
        qty: isBoxUom ? (parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1)) : newAccepted,
        custom_box_qty: isBoxUom ? 1 : newAccepted,
        custom_pieces_per_box: isBoxUom ? (parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1)) : 1,
        default_pieces_per_box: parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1),
        custom_selling_price: parseFloat(item.custom_selling_price || 0),
        custom_supplier_sl_num: item.custom_ref_sl_no || item.custom_supplier_sl_num || item.supplier_part_no || '',
        custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
        use_box_entry: isBoxUom,
        amount: (newAccepted * (parseFloat(items[rowIndex].rate) || 0)).toFixed(2)
      };
      
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
    setItemSearches(prev => ({ ...prev, [rowIndex]: item.item_name }));
    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));
    fetchItemRate(rowIndex, item.item_code);
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
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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
      setIsViewMode(true);
      setIsEditMode(false);
      setIsModalOpen(true);
      setLastSavedData(JSON.stringify(mapped)); // Use mapped object for stable comparison
      if (doc.name) fetchLinkedDocuments(doc.name);
    } catch (err) {
      console.error('Error fetching receipt:', err);
      alert('Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };  const navigateToDoc = (doctype, docname) => {
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
    if (!docName || !formData.docstatus) return null;

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
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={handleCreateInvoice}
                    disabled={saving}
                    className="so-btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}
                  >
                    <Plus size={14} /> Create Purchase Invoice
                  </button>
                  <button 
                    onClick={handleCreateReturn}
                    disabled={saving}
                    className="so-btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    <Link size={14} /> Create Purchase Return
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
          tax_amount: t.charge_type === 'Actual' ? parseFloat(t.tax_amount || 0) : 0,
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
          tax_amount: t.charge_type === 'Actual' ? parseFloat(t.tax_amount || 0) : 0,
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
      const matchesName = !filterName || rec.name.toLowerCase().includes(filterName.toLowerCase());
      const matchesSupplier = !filterSupplier || rec.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
      const matchesStatus = !filterStatus || rec.status === filterStatus;
      const matchesFrom = !filterDateFrom || new Date(rec.posting_date) >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || new Date(rec.posting_date) <= new Date(filterDateTo);
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

  useEffect(() => {
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart));
      const nameFromUrl = params.get('name');
      if (nameFromUrl) {
        setTimeout(() => fetchReceiptForEdit(nameFromUrl), 500);
      }
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
    fetchWarehouses();
    fetchTaxesTemplates();
    fetchTaxTypes();
  }, []);

  useEffect(() => {
    const nameParam = searchParams.get('name');
    if (nameParam === 'new') {
      openCreateModal();
    } else if (nameParam) {
      if (nameParam !== docName) {
        if (nameParam !== formData.return_against) {
          fetchReceiptForEdit(nameParam);
        }
      }
    } else {
      setIsModalOpen(false);
      setDocName('');
    }
  }, [searchParams, openCreateModal]);

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

  return (
    <>
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Package size={20} style={{ color: themeColor }} /> 
              Purchase Receipts
            </h1>
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

            <button onClick={() => setSearchParams({ name: 'new' })} className="so-btn-primary">
              <Plus size={16} /> Create Receipt
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          {/* Top Filters Bar */}
          <div className="so-filter-bar" style={{
            background: 'white',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--so-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end'
          }}>
            <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
              <label className="so-filter-label">Receipt Number</label>
              <input
                type="text"
                placeholder="Search receipt..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
              <label className="so-filter-label">Supplier</label>
              <input
                type="text"
                placeholder="Search supplier..."
                value={filterSupplier}
                onChange={e => setFilterSupplier(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
              <label className="so-filter-label">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="so-filter-select"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="To Bill">To Bill</option>
                <option value="Completed">Completed</option>
                <option value="Return Issued">Return Issued</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="so-filter-group" style={{ minWidth: '130px', flex: 1 }}>
              <label className="so-filter-label">From Date</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <div className="so-filter-group" style={{ minWidth: '130px', flex: 1 }}>
              <label className="so-filter-label">To Date</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="so-filter-input"
              />
            </div>

            <button onClick={clearFilters} className="so-clear-btn" style={{ margin: 0, width: 'auto', padding: '0.625rem 1rem' }}>
              Clear Filters
            </button>
          </div>

          {/* Table Area */}
          <div className="so-content">
            <p className="so-list-meta">{total} record(s) found</p>
            <div className="so-table-card">
              {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                  <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading receipts...</p>
                </div>
              ) : (
                <>
                  <div className="so-table-wrapper">
                    <table className="so-table">
                      <thead>
                        <tr>
                          <th>Receipt Number</th>
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
                              <p>No receipts found</p>
                              <button onClick={openCreateModal} style={{ color: themeColor, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
                                Create your first receipt
                              </button>
                            </td>
                          </tr>
                        ) : (
                          paginated.map(rec => (
                            <tr key={rec.name} onClick={() => setSearchParams({ name: rec.name })}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <a 
                                    href={`/#/purchasereceiptlist?name=${rec.name}`} 
                                    target="_blank" 
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
                                <div style={{ fontWeight: 500 }}>{rec.supplier_name}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{rec.supplier}</div>
                              </td>
                              <td>
                                <span style={{ color: '#475569' }}>{format(new Date(rec.posting_date), 'dd MMM yyyy')}</span>
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
                                AED {rec.is_return === 1 ? '-' : ''}{parseFloat(rec.rounded_total || rec.grand_total || rec.total || rec.base_net_total || rec.net_total || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                  <MoreVertical size={16} />
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
          <div className="so-modal-overlay" onClick={() => setIsModalOpen(false)} style={{ 
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
                  {/* ACTIONS CONTAINER */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* DRAFT PHASE */}
                    {formData.docstatus === 0 && (
                      <>
                        {(!docName || (allowedActions.includes('save') && isDirty)) && !isViewMode && (
                          <button 
                            onClick={() => handleDocAction('save')} 
                            disabled={saving} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                              {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                          </button>
                        )}

                        {allowedActions.includes('submit') && !isDirty && (
                          <button 
                            onClick={() => handleDocAction('submit')} 
                            disabled={saving} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                          >
                              {saving ? <Loader2 size={14} className="so-spinner" /> : 'SUBMIT'}
                          </button>
                        )}

                        {isViewMode && (
                          <button 
                            onClick={() => setIsViewMode(false)} 
                            className="so-btn-secondary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                          >
                             <Edit3 size={14} /> EDIT DRAFT
                          </button>
                        )}

                        {docName && allowedActions.includes('delete') && (
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
                    {formData.docstatus === 1 && (
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
                        
                        {formData.per_billed < 100 && (
                          <button 
                            onClick={() => handleCreateFlow('invoice')} 
                            className="so-btn-primary" 
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#0284c7', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
                          >
                              <Plus size={14} /> CREATE INVOICE
                          </button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', background: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #10b98140', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>
                          <CheckCircle2 size={14} /> SUBMITTED
                        </div>
                      </>
                    )}

                    {/* CANCELLED PHASE */}
                    {formData.docstatus === 2 && (
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
                      onClick={() => setIsModalOpen(false)} 
                      className="so-btn-secondary" 
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}
                    >
                      CLOSE
                    </button>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="so-modal-close" style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }}>
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
                        <label className="so-label">Branch/Warehouse <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        {isViewMode ? (
                          <div className="so-view-field">{formData.set_warehouse || '—'}</div>
                        ) : (
                          <select
                            value={formData.set_warehouse}
                            onChange={e => setFormData(prev => ({ ...prev, set_warehouse: e.target.value }))}
                            className="so-select"
                          >
                            <option value="">Select Branch</option>
                            {warehouses.map(w => (
                              <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                            ))}
                          </select>
                        )}
                        {formErrors.set_warehouse && <span style={{ color: 'var(--so-danger)', fontSize: '0.7rem', fontWeight: 600 }}>{formErrors.set_warehouse}</span>}
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={formData.is_return}
                          onChange={e => setFormData(prev => ({ ...prev, is_return: e.target.checked }))}
                          disabled={isViewMode}
                        />
                        Is Return
                      </label>
                    </div>
                  </div>
                </div>
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Barcode Scanner</p>
                  </div>
                  <div className="so-card-body">
                    <div className="so-barcode-area">
                      <Search size={18} />
                      <input
                        id="barcode-scan-input-pr"
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeScan}
                        placeholder={isViewMode ? "Scanner disabled in view mode" : "Scan or type barcode → press Enter..."}
                        className="so-barcode-input"
                        style={{ fontSize: '1rem' }}
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </div>
                {/* Items Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Items</p>
                    {/* Hide Add Row if mapped from PO */}
                    {!formData.items.some(i => i.purchase_order) && !isViewMode && (
                      <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                        <Plus size={14} /> Add Row
                      </button>
                    )}
                  </div>
                  <div className="so-card-body" style={{ padding: 0 }}>
                    <div className="so-table-wrapper" style={{ boxShadow: 'none' }}>
                      <table className="so-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                            {(() => {
                              const hasAnyBox = formData.items.some(i => i.use_box_entry);
                              const activeCols = columnConfig.filter(c => {
                                if (!c.visible) return false;
                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'accepted_qty'].includes(c.id)) return false;
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
                                                 ['custom_box_qty', 'custom_pieces_per_box', 'accepted_qty', 'rejected_qty', 'uom', 'custom_ref_sl_no', 'custom_supplier_sl_num'].includes(col.id) ? 'center' : 'left' 
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
                                  if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'accepted_qty'].includes(c.id)) return false;
                                  return true;
                                });
                                
                                return activeCols.map(col => {
                                  switch (col.id) {
                                  case 'custom_box_qty':
                                    return (
                                      <td key={col.id}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                          {isViewMode ? (
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, textAlign: "center", color: item.use_box_entry ? themeColor : "#1e293b" }}>
                                              {item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.use_box_entry ? (item.custom_box_qty || 0) : (item.accepted_qty || 0)}
                                              onChange={e => updateItem(i, item.use_box_entry ? "custom_box_qty" : "accepted_qty", e.target.value)}
                                              className="so-input"
                                              style={{ textAlign: "center", height: "36px", border: item.use_box_entry ? `1px solid ${themeColor}40` : "1px solid #e2e8f0" }}
                                            />
                                          )}
                                          {item.item_code && (
                                            <div style={{ fontSize: "0.55rem", fontWeight: 800, color: item.use_box_entry ? themeColor : "#94a3b8" }}>
                                              {item.use_box_entry ? "BOXES" : "NOS"}
                                            </div>
                                          )}
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
                                      )
                                  case 'item_code':
                                    return (
                                      <td key={col.id} ref={el => itemRefs.current[i] = el} style={{ verticalAlign: 'top' }}>
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {!isViewMode && (
                                            <CustomSearchDropdown
                                              value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                              placeholder="Search item..."
                                              onSelect={(val) => selectItem(i, val)}
                                              fetchData={fetchItems}
                                              themeColor={themeColor}
                                              optionsLabel="name"
                                            />
                                          )}
                                          {item.item_code && (
                                            <div style={{ 
                                              padding: '0.75rem', 
                                              background: isViewMode ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                              border: `1px solid ${isViewMode ? '#e2e8f0' : 'rgba(16, 185, 129, 0.1)'}`,
                                              borderLeft: `4px solid ${themeColor}`,
                                              borderRadius: '0.75rem',
                                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                                            }}>
                                              <div style={{ color: '#1e293b', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px', lineHeight: '1.3' }}>
                                                {item.item_name || 'Unnamed Item'}
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                <span style={{ 
                                                  color: themeColor, 
                                                  fontWeight: 700, 
                                                  fontSize: '0.68rem', 
                                                  fontFamily: 'monospace',
                                                  background: `${themeColor}12`,
                                                  padding: '2px 6px',
                                                  borderRadius: '4px'
                                                }}>
                                                  {item.item_code}
                                                </span>
                                                {(item.custom_pieces_per_box > 1 || item.use_box_entry) && (
                                                  <span style={{ 
                                                    background: '#f8fafc', 
                                                    color: '#64748b', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px', 
                                                    fontSize: '0.65rem',
                                                    fontWeight: 800,
                                                    border: '1px solid #e2e8f0'
                                                  }}>
                                                    {item.custom_pieces_per_box} PCS / BOX
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  case 'custom_supplier_sl_num':
                                    return (
                                      <td key={col.id}>
                                        {isViewMode ? (
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{item.custom_supplier_sl_num || '—'}</div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={item.custom_supplier_sl_num || ''}
                                              onChange={e => updateItem(i, 'custom_supplier_sl_num', e.target.value)}
                                              className="so-input"
                                              style={{ height: '36px', fontSize: '0.85rem' }}
                                              placeholder="SL #"
                                            />
                                          )}
                                      </td>
                                    );
                                  case 'custom_pieces_per_box':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
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
                                  case 'uom':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
                                        {!item.item_code || isViewMode ? (
                                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>
                                            {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
                                          </span>
                                        ) : (
                                          <select
                                            value={item.uom || item.stock_uom || ''}
                                            onChange={(e) => handleUOMChange(e.target.value, i)}
                                            style={{ 
                                              width: '100%', textAlign: 'center', fontSize: '0.75rem', 
                                              fontWeight: 'bold', color: '#475569', background: '#fff', 
                                              border: '1px solid #e2e8f0', borderRadius: '0.25rem', 
                                              cursor: 'pointer', outline: 'none', padding: '2px' 
                                            }}
                                          >
                                            {(item.uom_list && item.uom_list.length > 0 ? item.uom_list : [{ uom: item.stock_uom || item.uom || 'Nos' }]).map(u => (
                                              <option key={u.uom} value={u.uom}>{u.uom}</option>
                                            ))}
                                          </select>
                                        )}
                                      </td>
                                    );
                                  case 'accepted_qty':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
                                        {isViewMode ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                              <div style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', color: themeColor }}>{item.accepted_qty}</div>
                                              {item.use_box_entry && <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>NOS</div>}
                                            </div>
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                              <input
                                                type="number"
                                                value={item.accepted_qty}
                                                onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                                className="so-input"
                                                style={{ textAlign: 'center', height: '36px' }}
                                              />
                                              {item.use_box_entry && <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8' }}>NOS</div>}
                                            </div>
                                          )}
                                      </td>
                                    );
                                  case 'rejected_qty':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'center' }}>
                                        {isViewMode ? (
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', color: '#ef4444' }}>{item.rejected_qty}</div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.rejected_qty}
                                              onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                              className="so-input"
                                              style={{ textAlign: 'center', height: '36px', color: '#ef4444' }}
                                            />
                                          )}
                                      </td>
                                    );
                                  case 'custom_selling_price':
                                    return (
                                      <td key={col.id}>
                                        {isViewMode ? (
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'right', color: '#6366f1' }}>{formatPrice(item.custom_selling_price)}</div>
                                          ) : (
                                            <input
                                              type="number"
                                              value={item.custom_selling_price || 0}
                                              onChange={e => updateItem(i, 'custom_selling_price', e.target.value)}
                                              className="so-input"
                                              style={{ textAlign: 'right', height: '36px', color: '#6366f1', fontWeight: 'bold' }}
                                              placeholder="Selling"
                                            />
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
                                         <>
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
                                               placeholder={rateLoading[i] ? "..." : "0.00"}
                                               disabled={rateLoading[i]}
                                             />
                                           )}
                                           {rateLoading[i] && <div style={{ fontSize: '0.6rem', color: themeColor, textAlign: 'right', fontWeight: 700 }}>Fetching...</div>}
                                         </>
                                       </td>
                                     );
                                  case 'amount':
                                    return (
                                      <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                                        {formatPrice(item.amount)}
                                      </td>
                                    );
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
                <div className="so-form-grid" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'start' }}>
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

                      <div className="so-table-wrapper" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)', boxShadow: 'none' }}>
                        <table className="so-items-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Add</th>
                              <th>Account / Type</th>
                              <th style={{ width: '80px', textAlign: 'center' }}>Rate %</th>
                              <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                              <th style={{ width: '40px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.taxes.map((tax, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: 'center' }}>
                                  {isViewMode ? (
                                    tax.add_row ? <CheckCircle2 size={16} style={{ color: themeColor }} /> : <span style={{ opacity: 0.2 }}>—</span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={tax.add_row}
                                      onChange={e => updateTax(i, 'add_row', e.target.checked)}
                                    />
                                  )}
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{tax.account_head?.split(' - ')[0] || 'New Account'}</div>
                                  <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{tax.charge_type}</div>
                                </td>
                                <td>
                                  {isViewMode ? (
                                    <div className="so-view-field" style={{ textAlign: 'center' }}>{tax.rate}%</div>
                                  ) : (
                                    <input
                                      type="number"
                                      value={tax.rate}
                                      onChange={e => updateTax(i, 'rate', e.target.value)}
                                      className="so-input"
                                      style={{ height: '30px', textAlign: 'center', fontSize: '0.75rem' }}
                                    />
                                  )}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.75rem' }}>
                                  {(parseFloat(tax.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {!isViewMode && <button onClick={() => removeTaxRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }}><X size={12} /></button>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {/* Summary Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="so-card">
                      <div className="so-card-header">
                        <p className="so-card-title">Discounts & Rounding</p>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                          <div className="so-field column-span-2">
                            <label className="so-label">Apply Discount On</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.apply_discount_on || 'Net Total'}</div>
                            ) : (
                              <select
                                value={formData.apply_discount_on}
                                onChange={e => updateDiscount('apply_discount_on', e.target.value)}
                                className="so-select"
                              >
                                <option value="Net Total">Net Total</option>
                                <option value="Grand Total">Grand Total</option>
                              </select>
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount %</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formData.additional_discount_percentage || 0}%</div>
                            ) : (
                              <input
                                type="number"
                                value={formData.additional_discount_percentage}
                                onChange={e => updateDiscount('additional_discount_percentage', e.target.value)}
                                className="so-input"
                                step="0.01"
                              />
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount Amount</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formatPrice(formData.discount_amount)}</div>
                            ) : (
                              <input
                                type="number"
                                value={formData.discount_amount}
                                onChange={e => updateDiscount('discount_amount', e.target.value)}
                                className="so-input"
                                step="0.01"
                              />
                            )}
                          </div>
                          <div className="so-field column-span-2">
                            <label className="so-label">Rounded Total</label>
                            {isViewMode ? (
                              <div className="so-view-field">{formatPrice(formData.rounded_total)}</div>
                            ) : (
                              <input
                                type="number"
                                value={formData.rounded_total}
                                onChange={e => updateDiscount('rounded_total', e.target.value)}
                                className="so-input"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

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
                          <span style={{ fontWeight: 700 }}>AED {formatPrice(formData.net_total)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                          <span>Total Tax</span>
                          <span style={{ fontWeight: 700 }}>AED {formatPrice(formData.total_taxes_and_charges)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                          <span>Less Discount</span>
                          <span style={{ fontWeight: 700 }}>AED {formatPrice(formData.discounted_amount)}</span>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.5rem 0' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 600 }}>Grand Total</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>AED {formatPrice(formData.grand_total)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Rounded Total</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>AED {formatPrice(formData.rounded_total)}</span>
                        </div>
                        <p style={{ fontSize: '0.65rem', opacity: 0.7, fontStyle: 'italic', marginTop: '0.5rem', textAlign: 'center' }}>
                          * Rounding Adjustment: AED {((parseFloat(formData.rounded_total) || 0) - (parseFloat(formData.grand_total) || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
