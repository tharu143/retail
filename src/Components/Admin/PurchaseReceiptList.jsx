import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, X, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon, Barcode, Edit3,
  Trash2, Palette, Loader2, ChevronLeft, ChevronRight, Zap, CheckCircle2, ExternalLink, Link
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import '../Admin/SalesOrder.css';
const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const RESOURCE_BASE = '/api/resource';
function PurchaseReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [rateLoading, setRateLoading] = useState({});
  const [docName, setDocName] = useState('');
  const theme = useSelector(state => state.user.theme);
  const [barcodeInput, setBarcodeInput] = useState('');

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
  const [formData, setFormData] = useState({
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
      custom_box_qty: 0, custom_pieces_per_box: 1, custom_supplier_sl_num: '', custom_ref_sl_no: ''
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
  });
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
  useEffect(() => {
    fetchReceipts();
    fetchWarehouses();
    fetchTaxesTemplates();
    fetchTaxTypes();
  }, []);
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault();
      const barcode = barcodeInput.trim();
      try {
        // Fetch items by barcode (your existing endpoint supports it)
        const res = await axios.get(`${API_PATH}.get_items_for_pr`, {
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
      const res = await axios.get(`${API_PATH}.get_purchase_receipts`, { params: { limit: 2000, limit_page_length: 2000 }, withCredentials: true });
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
      const res = await axios.get(`${API_PATH}.get_suppliers_pr`, {
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
      const res = await axios.get(`${API_PATH}.get_items_for_pr`, {
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
      const res = await axios.get(`${API_PATH}.get_company_warehouses`, { withCredentials: true });
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
      const res = await axios.get(`${API_PATH}.get_purchase_taxes_templates`, {
        params: { company: companyData.company },
        withCredentials: true
      });
      setTaxesTemplates(res.data.message || []);
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
      const res = await axios.get(`${API_PATH}.get_default_company`, { withCredentials: true });
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
        setLinkedDocs(payload.categories || payload || {});
      }
    } catch (err) {
      console.error('Error fetching linked docs:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!docName) return;
    try {
      setSaving(true);
      const res = await axios.post(`${API_PATH}.create_purchase_invoice_from_pr`, {
        purchase_receipt: docName
      }, { withCredentials: true });
      
      const msg = res.data.message || res.data;
      if ((msg.success || msg.status === 'success') && msg.name) {
        window.location.hash = `#/purchaseinvoicelist?name=${msg.name}`;
      } else {
        alert(msg.message || 'Failed to create Invoice');
      }
    } catch (err) {
      console.error('Error creating PI:', err);
      const errorMsg = err.response?.data?.message || err.message;
      alert('Error creating Purchase Invoice: ' + errorMsg);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const nameParam = params.get('name');
    if (nameParam) {
      // Clear URL params after reading
      window.history.replaceState(null, '', window.location.hash.split('?')[0]);
      fetchReceiptForEdit(nameParam);
    }
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
        custom_box_qty: 0, custom_pieces_per_box: 1, custom_supplier_sl_num: '', custom_ref_sl_no: ''
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
  }, [warehouses]);
  // UPDATED: Combined recalc for items update
  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index][field] = value;

      // Real-time calculation for Box Qty and Pieces per Box
      if (field === 'custom_box_qty' || field === 'custom_pieces_per_box') {
        const box_qty = parseFloat(items[index].custom_box_qty) || 0;
        const pcs_per_box = parseFloat(items[index].custom_pieces_per_box) || 1;
        const total_qty = box_qty * pcs_per_box;
        items[index].accepted_qty = total_qty;
        items[index].received_qty = total_qty + (parseFloat(items[index].rejected_qty) || 0);
        items[index].qty = total_qty;
        items[index].amount = (total_qty * (parseFloat(items[index].rate) || 0)).toFixed(2);
      } else if (field === 'accepted_qty' || field === 'rejected_qty' || field === 'rate') {
        const accepted_qty = parseFloat(items[index].accepted_qty) || 0;
        const rejected_qty = parseFloat(items[index].rejected_qty) || 0;
        const rate = parseFloat(items[index].rate) || 0;
        items[index].received_qty = accepted_qty + rejected_qty;
        items[index].qty = accepted_qty;
        items[index].amount = (accepted_qty * rate).toFixed(2);
        
        // Back-calculate Box Qty if needed
        const pcs_per_box = parseFloat(items[index].custom_pieces_per_box) || 1;
        if (field === 'accepted_qty' && pcs_per_box > 0) {
          items[index].custom_box_qty = accepted_qty / pcs_per_box;
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
        custom_box_qty: 0, custom_pieces_per_box: 1, custom_supplier_sl_num: '', custom_ref_sl_no: ''
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
      const currentAccepted = parseFloat(items[rowIndex].accepted_qty) || 0;
      const newAccepted = currentAccepted > 0 ? currentAccepted : 1;
      const currentRejected = parseFloat(items[rowIndex].rejected_qty) || 0;
      const currentRate = parseFloat(items[rowIndex].rate) || 0;
      items[rowIndex] = {
        ...items[rowIndex],
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.stock_uom || 'Nos',
        accepted_qty: newAccepted,
        received_qty: newAccepted + currentRejected,
        qty: newAccepted,
        amount: (newAccepted * currentRate).toFixed(2)
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
    // Fetch rate (non-blocking)
    fetchItemRate(rowIndex, item.item_code);
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
      // Map doc to formData
      setFormData({
        series: doc.name.split('-')[0] + '-...',
        posting_date: doc.posting_date,
        posting_time: doc.posting_time?.slice(0, 5) || '',
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
          item_code: i.item_code || '',
          item_name: i.item_name || '',
          accepted_qty: i.qty || 0,
          rejected_qty: i.rejected_qty || 0,
          received_qty: i.received_qty || 0,
          qty: i.qty || 0,
          uom: i.uom || '',
          rate: i.rate || 0,
          amount: i.amount?.toFixed(2) || '0.00',
          custom_box_qty: i.custom_box_qty || 0,
          custom_pieces_per_box: i.custom_pieces_per_box || 1,
          custom_supplier_sl_num: i.custom_supplier_sl_num || i.custom_ref_sl_no || '',
          custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || ''
        })),
        taxes: (doc.taxes || []).map(t => ({
          add_row: t.add_deduct_tax === "Add",
          charge_type: t.charge_type || '',
          account_head: t.account_head || '',
          rate: t.rate || 0,
          tax_amount: t.tax_amount || 0,
          total: t.total?.toFixed(2) || '0.00',
          row_id: t.name || ''
        })),
        total_qty: doc.total_qty || 0,
        net_total: doc.net_total || 0,
        taxes_added: doc.taxes_added || '0.00',
        taxes_deducted: doc.taxes_deducted || '0.00',
        total_taxes_and_charges: doc.total_taxes_and_charges || '0.00',
        discounted_amount: doc.discounted_amount || '0.00',
        grand_total: doc.grand_total || '0.00',
        docstatus: doc.docstatus || 0
      });
      setDocName(doc.name);
      setSearchSupplier(doc.supplier_name || '');
      setIsModalOpen(true);
      if (doc.name) fetchLinkedDocuments(doc.name);
    } catch (err) {
      console.error('Error fetching receipt:', err);
      alert('Failed to load receipt for editing');
    } finally {
      setLoading(false);
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
            <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: themeColor }}>Linked Documents & Actions</span>
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
            {formData.docstatus === 1 && (
              <div style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Create New Record</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={handleCreateInvoice}
                    disabled={saving}
                    className="so-btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}
                  >
                    <Plus size={14} /> Create Purchase Invoice
                  </button>
                </div>
              </div>
            )}

            {/* Links Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              {Object.entries(categories).map(([catName, doctypes]) => {
                const hasLinks = doctypes.some(dt => linkedDocs[dt] && linkedDocs[dt].length > 0);
                if (!hasLinks && catName !== "Related") return null;

                return (
                  <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>{catName}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {doctypes.map(dt => {
                        const links = linkedDocs[dt] || [];
                        if (links.length === 0) return null;
                        return (
                          <div key={dt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 700 }}>
                            <Link size={12} style={{ opacity: 0.5 }} />
                            {dt}
                            <span style={{ padding: '0.1rem 0.4rem', background: `${themeColor}15`, color: themeColor, borderRadius: '1rem', fontSize: '0.6rem' }}>{links.length}</span>
                          </div>
                        );
                      })}
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
        .map(i => ({
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
          custom_box_qty: parseFloat(i.custom_box_qty || 0),
          custom_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
          custom_supplier_sl_num: i.custom_supplier_sl_num || i.custom_ref_sl_no || '',
          custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
          warehouse: formData.set_warehouse,
          accepted_warehouse: formData.set_warehouse,
          rejected_warehouse: parseFloat(i.rejected_qty) > 0 ? formData.set_warehouse : ''
        })),
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
    if (!validateForm()) return;
    setSaving(true);
    const payload = await getPayload();
    try {
      let response;
      if (docName) {
        // Existing draft → UPDATE (PUT)
        response = await axios.put(`${RESOURCE_BASE}/Purchase Receipt/${docName}`, payload, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        });
        alert(`Draft updated: ${docName}`);
      } else {
        // New → CREATE (POST)
        response = await axios.post(`${RESOURCE_BASE}/Purchase Receipt`, payload, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.data?.data?.name) {
          setDocName(response.data.data.name);
          alert(`Draft saved: ${response.data.data.name}`);
        } else {
          throw new Error('Failed to create draft');
        }
      }
      // Refresh list to show updated status
      fetchReceipts();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSaving(true);
    const payload = await getPayload();
    try {
      let name = docName;
      if (!name) {
        // First save as draft using generic doc creator
        const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
        const createRes = await axios.post(GENERIC_API, {
          doctype: "Purchase Receipt",
          data: payload
        }, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        });
        const apiResp = createRes.data.message || createRes.data;
        if (!apiResp.name) throw new Error('Create failed');
        name = apiResp.name;
        setDocName(name);
      }
      // Submit
      await axios.put(`${RESOURCE_BASE}/Purchase Receipt/${name}`, { docstatus: 1 }, { withCredentials: true });
      alert(`Purchase Receipt Submitted: ${name}`);
      setIsModalOpen(false);
      setDocName('');
      fetchReceipts();
    } catch (err) {
      alert('Submit failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
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
            rejected_warehouse: rejected_qty > 0 ? formData.set_warehouse : ''
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

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Header */}
        <div className="so-page-header">
          <div className="so-page-left">
            <h1 className="so-page-title">
              <Package size={20} /> Purchase Receipts
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

            <button onClick={openCreateModal} className="so-btn-primary">
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
                            <tr key={rec.name} onClick={() => fetchReceiptForEdit(rec.name)}>
                              <td>
                                <span style={{ fontWeight: 700, color: themeColor }}>{rec.name}</span>
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
                                AED {rec.grand_total ? parseFloat(rec.grand_total).toFixed(2) : '0.00'}
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
          <div className="so-modal-overlay" onClick={() => setIsModalOpen(false)} style={{ padding: 0 }}>
            <div className="so-modal" style={{ maxWidth: 'none', width: '100vw', height: '100vh', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="so-modal-header">
                <h2 className="so-modal-title">
                  <Package size={18} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {docName ? 'Edit' : 'New'} Purchase Receipt
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="so-modal-close">
                  <X size={20} />
                </button>
              </div>

              <div className="so-modal-body">
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
                        <input
                          type="text"
                          value={formData.series}
                          onChange={e => setFormData(prev => ({ ...prev, series: e.target.value }))}
                          className="so-input"
                        />
                      </div>
                      <div className="so-field">
                        <label className="so-label">Supplier <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <div className="relative" ref={supplierRef}>
                          <input
                            type="text"
                            value={searchSupplier}
                            onChange={e => setSearchSupplier(e.target.value)}
                            onFocus={() => searchSupplier && setShowSupplierDropdown(true)}
                            placeholder="Search and select supplier..."
                            className="so-input"
                          />
                          {showSupplierDropdown && suppliers.length > 0 && (
                            <div className="so-dropdown" style={{ left: 0, right: 0 }}>
                              {suppliers.map(s => (
                                <div key={s.name} onClick={() => selectSupplier(s)} className="so-dropdown-item">
                                  <div style={{ fontWeight: 700 }}>{s.supplier_name}</div>
                                  <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{s.name}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {formErrors.supplier && <span style={{ color: 'var(--so-danger)', fontSize: '0.7rem', fontWeight: 600 }}>{formErrors.supplier}</span>}
                      </div>
                      <div className="so-field">
                        <label className="so-label">Posting Date <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <input
                          type="date"
                          value={formData.posting_date}
                          onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                          className="so-input"
                        />
                      </div>
                      <div className="so-field">
                        <label className="so-label">Posting Time <span style={{ color: 'var(--so-danger)' }}>*</span></label>
                        <input
                          type="time"
                          value={formData.posting_time}
                          onChange={e => setFormData(prev => ({ ...prev, posting_time: e.target.value }))}
                          className="so-input"
                        />
                      </div>
                      <div className="so-field">
                        <label className="so-label">Set Branch <span style={{ color: 'var(--so-danger)' }}>*</span></label>
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
                        {formErrors.set_warehouse && <span style={{ color: 'var(--so-danger)', fontSize: '0.7rem', fontWeight: 600 }}>{formErrors.set_warehouse}</span>}
                      </div>
                      <div className="so-field">
                        <label className="so-label">Supplier Delivery Note</label>
                        <input
                          type="text"
                          value={formData.supplier_delivery_note}
                          onChange={e => setFormData(prev => ({ ...prev, supplier_delivery_note: e.target.value }))}
                          placeholder="Reference number..."
                          className="so-input"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem', padding: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={formData.apply_putaway_rule}
                          onChange={e => setFormData(prev => ({ ...prev, apply_putaway_rule: e.target.checked }))}
                        />
                        Apply Putaway Rule
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={formData.is_return}
                          onChange={e => setFormData(prev => ({ ...prev, is_return: e.target.checked }))}
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
                        placeholder="Scan or type barcode → press Enter..."
                        className="so-barcode-input"
                        style={{ fontSize: '1rem' }}
                      />
                    </div>
                  </div>
                </div>
                {/* Items Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <p className="so-card-title">Items</p>
                    <button onClick={addItemRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                  <div className="so-card-body" style={{ padding: 0 }}>
                    <div className="so-table-wrapper" style={{ boxShadow: 'none' }}>
                      <table className="so-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>No.</th>
                            <th>Item Details</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Supplier SL #</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Box Qty</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Pcs/Box</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Accepted</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Rejected</th>
                            <th style={{ width: '110px', textAlign: 'right' }}>Rate</th>
                            <th style={{ width: '130px', textAlign: 'right' }}>Amount</th>
                            <th style={{ width: '50px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.items.map((item, i) => (
                            <tr key={i}>
                              <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5 }}>{i + 1}</td>
                              <td ref={el => itemRefs.current[i] = el}>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    value={itemSearches[i] || ''}
                                    onChange={e => handleItemSearch(i, e.target.value)}
                                    onFocus={() => itemSearches[i] && setShowItemDropdowns(prev => ({ ...prev, [i]: true }))}
                                    placeholder="Search item..."
                                    className="so-input"
                                    style={{ height: '36px', fontSize: '0.85rem' }}
                                  />
                                  {showItemDropdowns[i] && itemsList.length > 0 && (
                                    <div className="so-dropdown" style={{ minWidth: '300px' }}>
                                      {itemsList.map(itm => (
                                        <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="so-dropdown-item">
                                          <div style={{ fontWeight: 700 }}>{itm.item_name}</div>
                                          <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{itm.item_code}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {item.item_name && (
                                    <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: themeColor, fontWeight: 700 }}>
                                      {item.item_name} — {item.item_code}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={item.custom_supplier_sl_num || ''}
                                  onChange={e => updateItem(i, 'custom_supplier_sl_num', e.target.value)}
                                  className="so-input"
                                  style={{ height: '36px', fontSize: '0.85rem' }}
                                  placeholder="SL #"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.custom_box_qty || 0}
                                  onChange={e => updateItem(i, 'custom_box_qty', e.target.value)}
                                  className="so-input"
                                  style={{ textAlign: 'center', height: '36px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.custom_pieces_per_box || 1}
                                  onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)}
                                  className="so-input"
                                  style={{ textAlign: 'center', height: '36px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.accepted_qty}
                                  onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                  className="so-input"
                                  style={{ textAlign: 'center', height: '36px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={item.rejected_qty}
                                  onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                  className="so-input"
                                  style={{ textAlign: 'center', height: '36px' }}
                                />
                              </td>
                              <td>
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
                                {rateLoading[i] && <div style={{ fontSize: '0.6rem', color: themeColor, textAlign: 'right', fontWeight: 700 }}>Fetching...</div>}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                                {(parseFloat(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button onClick={() => removeItemRow(i)} className="so-btn-danger" style={{ padding: '0.25rem' }}>
                                  <X size={14} />
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
                      <button onClick={addTaxRow} className="so-btn-ghost" style={{ fontSize: '0.7rem' }}>
                        <Plus size={14} /> Add Row
                      </button>
                    </div>
                    <div className="so-card-body">
                      <div className="so-field" style={{ marginBottom: '1.5rem' }}>
                        <label className="so-label">Tax Template</label>
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
                                  <input
                                    type="checkbox"
                                    checked={tax.add_row}
                                    onChange={e => updateTax(i, 'add_row', e.target.checked)}
                                  />
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{tax.account_head?.split(' - ')[0] || 'New Account'}</div>
                                  <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{tax.charge_type}</div>
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    value={tax.rate}
                                    onChange={e => updateTax(i, 'rate', e.target.value)}
                                    className="so-input"
                                    style={{ height: '30px', textAlign: 'center', fontSize: '0.75rem' }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.75rem' }}>
                                  {(parseFloat(tax.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button onClick={() => removeTaxRow(i)} className="so-btn-ghost" style={{ color: '#ef4444' }}><X size={12} /></button>
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
                            <select
                              value={formData.apply_discount_on}
                              onChange={e => updateDiscount('apply_discount_on', e.target.value)}
                              className="so-select"
                            >
                              <option value="Net Total">Net Total</option>
                              <option value="Grand Total">Grand Total</option>
                            </select>
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount %</label>
                            <input
                              type="number"
                              value={formData.additional_discount_percentage}
                              onChange={e => updateDiscount('additional_discount_percentage', e.target.value)}
                              className="so-input"
                              step="0.01"
                            />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Discount Amount</label>
                            <input
                              type="number"
                              value={formData.discount_amount}
                              onChange={e => updateDiscount('discount_amount', e.target.value)}
                              className="so-input"
                              step="0.01"
                            />
                          </div>
                          <div className="so-field column-span-2">
                            <label className="so-label">Rounded Total</label>
                            <input
                              type="number"
                              value={formData.rounded_total}
                              onChange={e => updateDiscount('rounded_total', e.target.value)}
                              className="so-input"
                            />
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
                          <span style={{ fontWeight: 700 }}>AED {(parseFloat(formData.net_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                          <span>Total Tax</span>
                          <span style={{ fontWeight: 700 }}>AED {(parseFloat(formData.total_taxes_and_charges) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, fontSize: '0.9rem' }}>
                          <span>Less Discount</span>
                          <span style={{ fontWeight: 700 }}>AED {(parseFloat(formData.discounted_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.5rem 0' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 600 }}>Grand Total</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>AED {(parseFloat(formData.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Rounded Total</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>AED {(parseFloat(formData.rounded_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <p style={{ fontSize: '0.65rem', opacity: 0.7, fontStyle: 'italic', marginTop: '0.5rem', textAlign: 'center' }}>
                          * Rounding Adjustment: AED {((parseFloat(formData.rounded_total) || 0) - (parseFloat(formData.grand_total) || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="so-modal-footer">
                <button onClick={() => setIsModalOpen(false)} className="so-btn-secondary">
                  Cancel
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleSaveDraft} disabled={saving} className="so-btn-secondary" style={{ background: 'white' }}>
                    {saving ? 'Saving...' : (docName ? 'Update Draft' : 'Save Draft')}
                  </button>
                  <button onClick={handleSubmit} disabled={saving} className="so-btn-primary">
                    {saving ? (
                      <><Loader2 className="so-spinner" size={16} /> Processing...</>
                    ) : (
                      docName ? 'Submit' : 'Save & Submit'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default PurchaseReceiptList;