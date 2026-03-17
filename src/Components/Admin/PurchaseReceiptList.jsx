import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Building2, Search, Calendar, Filter, Download, MoreVertical, Package, Warehouse as WarehouseIcon, Barcode, Edit3,
  Trash2
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';
import './PurchaseReceiptList.css';
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
      item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00'
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
      const res = await axios.get(`${API_PATH}.get_purchase_receipts`, { withCredentials: true });
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
        item_code: '', item_name: '', accepted_qty: 0, rejected_qty: 0, received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00'
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
      if (field === 'accepted_qty' || field === 'rejected_qty' || field === 'rate') {
        const accepted_qty = parseFloat(items[index].accepted_qty) || 0;
        const rejected_qty = parseFloat(items[index].rejected_qty) || 0;
        const rate = parseFloat(items[index].rate) || 0;
        items[index].received_qty = accepted_qty + rejected_qty;
        items[index].qty = accepted_qty;
        items[index].amount = (accepted_qty * rate).toFixed(2);
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
      received_qty: 0, qty: 0, uom: '', rate: 0, amount: '0.00'
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
          amount: i.amount?.toFixed(2) || '0.00'
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
        grand_total: doc.grand_total || '0.00'
      });
      setDocName(doc.name);
      setSearchSupplier(doc.supplier_name || '');
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error fetching receipt:', err);
      alert('Failed to load receipt for editing');
    } finally {
      setLoading(false);
    }
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
        // First save as draft
        const createRes = await axios.post(`${RESOURCE_BASE}/Purchase Receipt`, payload, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        });
        if (!createRes.data?.data?.name) throw new Error('Create failed');
        name = createRes.data.data.name;
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
      // Create draft
      const createRes = await axios.post(`${RESOURCE_BASE}/Purchase Receipt`, payload, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      // ERPNext returns response in createRes.data.data
      if (createRes.data?.data?.name) {
        const docName = createRes.data.data.name;
        // Submit using PUT (most reliable)
        await axios.put(
          `${RESOURCE_BASE}/Purchase Receipt/${docName}`,
          { docstatus: 1 },
          { withCredentials: true }
        );
        alert('Purchase Receipt Created & Submitted: ' + docName);
        setIsModalOpen(false);
        fetchReceipts();
      } else {
        console.error('Create failed - no name in response:', createRes.data);
        alert('Failed to create receipt. Check console.');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.exception ||
        err.response?.data?.message ||
        err.message || 'Unknown error';
      console.error('Create error:', err.response?.data || err);
      alert('Error: ' + errorMsg);
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
  return (
    <>
      <NavBar />
      <div className={`pr-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
        <div className="pr-header">
          <div className="pr-header-left">
            <h1 className="pr-title">Purchase Receipts</h1>
            <span className="pr-count">{total} total</span>
          </div>
          <div className="pr-header-actions">
            <button onClick={() => setShowFilters(!showFilters)} className="pr-btn-secondary">
              <Filter className="pr-icon" />
              Filters
            </button>
            <button onClick={openCreateModal} className="pr-btn-primary">
              <Plus className="pr-icon" />
              Create Receipt
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="pr-filters">
            <div className="pr-filters-grid">
              <div className="pr-filter-item">
                <label>Receipt Number</label>
                <div className="pr-input-wrapper">
                  <Search className="pr-input-icon" />
                  <input
                    type="text"
                    placeholder="Search receipt..."
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>Supplier</label>
                <div className="pr-input-wrapper">
                  <Building2 className="pr-input-icon" />
                  <input
                    type="text"
                    placeholder="Search supplier..."
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pr-select">
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="To Bill">To Bill</option>
                  <option value="Completed">Completed</option>
                  <option value="Return Issued">Return Issued</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="pr-filter-item">
                <label>From Date</label>
                <div className="pr-input-wrapper">
                  <Calendar className="pr-input-icon" />
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-item">
                <label>To Date</label>
                <div className="pr-input-wrapper">
                  <Calendar className="pr-input-icon" />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="pr-input"
                  />
                </div>
              </div>
              <div className="pr-filter-actions">
                <button onClick={clearFilters} className="pr-btn-ghost">Clear</button>
              </div>
            </div>
          </div>
        )}
        <main className="pr-main">
          {loading ? (
            <div className="pr-loading">
              <div className="pr-spinner"></div>
              <p>Loading receipts...</p>
            </div>
          ) : (
            <div className="pr-table-container">
              <div className="pr-table-wrapper">
                <table className="pr-table">
                  <thead>
                    <tr>
                    
                      <th className="pr-th">Receipt Number</th>
                      <th className="pr-th">Supplier</th>
                      <th className="pr-th">Date</th>
                      <th className="pr-th">Status</th>
                      <th className="pr-th-right">Amount</th>
                      <th className="pr-th-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="pr-empty">
                          <Package className="pr-empty-icon" />
                          <p>No receipts found</p>
                          <button onClick={openCreateModal} className="pr-btn-link">Create your first receipt</button>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(rec => (
                        <tr key={rec.name} className="pr-tr">
    
                          <td className="pr-td" onClick={() => fetchReceiptForEdit(rec.name)}>
                            <span className="pr-receipt-number">{rec.name}</span>
                          </td>
                          <td className="pr-td" onClick={() => fetchReceiptForEdit(rec.name)}>
                            <div className="pr-supplier">
                              <span className="pr-supplier-name">{rec.supplier_name}</span>
                              <span className="pr-supplier-code">{rec.supplier}</span>
                            </div>
                          </td>
                          <td className="pr-td" onClick={() => fetchReceiptForEdit(rec.name)}>
                            <span className="pr-date">{format(new Date(rec.posting_date), 'dd MMM yyyy')}</span>
                          </td>
                          <td className="pr-td" onClick={() => fetchReceiptForEdit(rec.name)}>
                            <span className={`pr-status ${getStatusColor(rec.status)}`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="pr-td-right" onClick={() => window.location.href = `/purchase-receipt/${rec.name}`}>
                            <span className="pr-amount">AED {rec.base_net_total?.toFixed(2)}</span>
                          </td>
                          <td className="pr-td-actions">
                            <button className="pr-btn-icon" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="pr-icon" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {total > 0 && (
                <div className="pr-pagination">
                  <div className="pr-pagination-info">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} receipts
                  </div>
                  <div className="pr-pagination-controls">
                    <div className="pr-page-size">
                      <span>Rows:</span>
                      {[20, 50, 100].map(s => (
                        <button
                          key={s}
                          onClick={() => { setPageSize(s); setCurrentPage(1); }}
                          className={`pr-page-size-btn ${pageSize === s ? 'active' : ''}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="pr-page-nav">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="pr-page-btn"
                      >
                        Previous
                      </button>
                      <span className="pr-page-current">Page {currentPage} of {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="pr-page-btn"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
        {isModalOpen && (
          <div className="pr-modal-overlay">
            <div className="pr-modal">
              <div className="pr-modal-header">
                <div>
                  <h2 className="pr-modal-title">New Purchase Receipt <span className="pr-not-saved">(Not Saved)</span></h2>
                  <p className="pr-modal-subtitle">Add supplier details and items to create a new receipt</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="pr-modal-close">
                  <X className="pr-icon" />
                </button>
              </div>
              <div className="pr-modal-body">
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Details</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Series <span className="pr-required">*</span></label>
                      <input
                        type="text"
                        value={formData.series}
                        onChange={e => setFormData(prev => ({ ...prev, series: e.target.value }))}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Date <span className="pr-required">*</span></label>
                      <div className="pr-input-wrapper">
                        <Calendar className="pr-input-icon" />
                        <input
                          type="date"
                          value={formData.posting_date}
                          onChange={e => setFormData(prev => ({ ...prev, posting_date: e.target.value }))}
                          className="pr-input"
                        />
                      </div>
                    </div>
                    <div className="pr-form-group">
                      <label className="pr-checkbox-group">
                        <input
                          type="checkbox"
                          checked={formData.apply_putaway_rule}
                          onChange={e => setFormData(prev => ({ ...prev, apply_putaway_rule: e.target.checked }))}
                        />
                        Apply Putaway Rule
                      </label>
                    </div>
                    <div className="pr-form-group" ref={supplierRef}>
                      <label className="pr-label">
                        Supplier <span className="pr-required">*</span>
                      </label>
                      <div className="pr-input-wrapper">
                        <Building2 className="pr-input-icon" />
                        <input
                          type="text"
                          value={searchSupplier}
                          onChange={e => setSearchSupplier(e.target.value)}
                          onFocus={() => searchSupplier && setShowSupplierDropdown(true)}
                          placeholder="Search and select supplier..."
                          className={`pr-input ${formErrors.supplier ? 'pr-input-error' : ''}`}
                        />
                      </div>
                      {showSupplierDropdown && suppliers.length > 0 && (
                        <div className="pr-dropdown">
                          {suppliers.map(s => (
                            <div key={s.name} onClick={() => selectSupplier(s)} className="pr-dropdown-item">
                              <div className="pr-dropdown-main">{s.supplier_name}</div>
                              <div className="pr-dropdown-sub">{s.name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {formErrors.supplier && <span className="pr-error">{formErrors.supplier}</span>}
                    </div>
                    <div className="pr-form-group">
                      <label>Posting Time <span className="pr-required">*</span></label>
                      <div className="pr-input-wrapper">
                        <Calendar className="pr-input-icon" />
                        <input
                          type="time"
                          value={formData.posting_time}
                          onChange={e => setFormData(prev => ({ ...prev, posting_time: e.target.value }))}
                          className="pr-input"
                        />
                      </div>
                    </div>
                    <div className="pr-form-group">
                      <label className="pr-checkbox-group">
                        <input
                          type="checkbox"
                          checked={formData.is_return}
                          onChange={e => setFormData(prev => ({ ...prev, is_return: e.target.checked }))}
                        />
                        Is Return
                      </label>
                    </div>
                    <div className="pr-form-group">
                      <label>Supplier Delivery Note</label>
                      <input
                        type="text"
                        value={formData.supplier_delivery_note}
                        onChange={e => setFormData(prev => ({ ...prev, supplier_delivery_note: e.target.value }))}
                        placeholder="Enter delivery note..."
                        className="pr-input"
                      />
                    </div>
                  </div>
                </div>
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Currency and Price List</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Currency</label>
                      <input
                        type="text"
                        value={formData.currency}
                        className="pr-input"
                        readOnly
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Buying Price List</label>
                      <input
                        type="text"
                        value={formData.buying_price_list}
                        onChange={e => setFormData(prev => ({ ...prev, buying_price_list: e.target.value }))}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Set Warehouse <span className="pr-required">*</span></label>
                      <select
                        value={formData.set_warehouse}
                        onChange={e => setFormData(prev => ({ ...prev, set_warehouse: e.target.value }))}
                        className={`pr-select ${formErrors.set_warehouse ? 'pr-input-error' : ''}`}
                      >
                        <option value="">Select Warehouse</option>
                        {warehouses.map(w => (
                          <option key={w.name} value={w.name}>{w.warehouse_name}</option>
                        ))}
                      </select>
                      {formErrors.set_warehouse && <span className="pr-error">{formErrors.set_warehouse}</span>}
                    </div>
                  </div>
                </div>
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Items</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group pr-full-width">
                      <label className="pr-barcode-label">Scan Barcode</label>
                      <div className="pr-input-wrapper">
                        <Barcode className="pr-input-icon" />
                        <input
                          id="barcode-scan-input-pr"
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyDown={handleBarcodeScan}
                          placeholder="Scan or type barcode → press Enter"
                          className="pr-input pr-barcode-input"
                          autoFocus
                        />
                      </div>
                      <p className="pr-barcode-note">
                        Fast scanning enabled • Auto add item on Enter
                      </p>
                    </div>
                  </div>
                  <div className="pr-items-table-wrapper">
                    <table className="pr-items-table">
                      <thead>
                        <tr>
          
                          <th className="pr-items-th" style={{ width: '40px' }}>No.</th>
                          <th className="pr-items-th">Item Code <span className="pr-required">*</span></th>
                          <th className="pr-items-th" style={{ width: '120px' }}>Accepted Quantity</th>
                          <th className="pr-items-th" style={{ width: '100px' }}>Rejected Qty</th>
                          <th className="pr-items-th" style={{ width: '120px' }}>Rate (AED)</th>
                          <th className="pr-items-th" style={{ width: '120px' }}>Amount (AED)</th>
                          <th className="pr-items-th" style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i} className="pr-items-tr">
                            <td className="pr-items-td">
                              <span className="pr-items-text">{i + 1}</span>
                            </td>
                            <td className="pr-items-td" ref={el => itemRefs.current[i] = el}>
                              <div className="pr-item-cell">
                                <input
                                  type="text"
                                  value={itemSearches[i] || ''}
                                  onChange={e => handleItemSearch(i, e.target.value)}
                                  onFocus={() => itemSearches[i] && setShowItemDropdowns(prev => ({ ...prev, [i]: true }))}
                                  placeholder="Search item..."
                                  className="pr-items-input"
                                />
                                {showItemDropdowns[i] && itemsList.length > 0 && (
                                  <div className="pr-dropdown">
                                    {itemsList.map(itm => (
                                      <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="pr-dropdown-item">
                                        <div className="pr-dropdown-main">{itm.item_name}</div>
                                        <div className="pr-dropdown-sub">{itm.item_code}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {item.item_name && (
                                  <div className="pr-item-selected">
                                    {item.item_name}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.accepted_qty}
                                onChange={e => updateItem(i, 'accepted_qty', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                min="0"
                              />
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.rejected_qty}
                                onChange={e => updateItem(i, 'rejected_qty', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                min="0"
                              />
                            </td>
                            <td className="pr-items-td">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={e => updateItem(i, 'rate', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                                placeholder={rateLoading[i] ? "Fetching..." : "Enter rate or auto-fetch"}
                                disabled={rateLoading[i]} // Brief disable during fetch
                              />
                              {rateLoading[i] && <small className="pr-rate-loading">Fetching rate...</small>}
                            </td>
                            <td className="pr-items-td">
                              <span className="pr-items-amount">{parseFloat(item.amount) || '0.00'}</span>
                            </td>
                            <td className="pr-items-td">
                              <button onClick={() => removeItemRow(i)} className="pr-btn-delete">
                                <Trash2 className="pr-icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: '1rem', textAlign: 'left' }}>
    <button onClick={addItemRow} className="pr-btn-link">
      <Plus className="pr-icon-sm" />
      Add Another Item
    </button>
  </div>
                  </div>
                  {formErrors.items && <span className="pr-error">{formErrors.items}</span>}
                  <div className="pr-totals-row">
                    <span>Total Quantity: {formData.total_qty}</span>
                    <span>Total (AED): {parseFloat(formData.net_total) || '0.00'}</span>
                  </div>
                </div>
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Taxes and Charges</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Purchase Taxes and Charges Template</label>
                      <select
                        value={formData.taxes_and_charges}
                        onChange={e => handleTaxesTemplateChange(e.target.value)}
                        className="pr-select"
                      >
                        <option value="">Select Template</option>
                        {taxesTemplates.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pr-taxes-table-wrapper">
                    <table className="pr-taxes-table">
                      <thead>
                        <tr>
                          <th className="pr-taxes-th" style={{ width: '40px' }}></th>
                          <th className="pr-taxes-th" style={{ width: '40px' }}>No.</th>
                          <th className="pr-taxes-th">Type <span className="pr-required">*</span></th>
                          <th className="pr-taxes-th">Account Head <span className="pr-required">*</span></th>
                          <th className="pr-taxes-th" style={{ width: '100px' }}>Tax Rate</th>
                          <th className="pr-taxes-th" style={{ width: '100px' }}>Amount</th>
                          <th className="pr-taxes-th" style={{ width: '100px' }}>Total</th>
                          <th className="pr-taxes-th" style={{ width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.taxes.map((tax, i) => (
                          <tr key={i}>
                            <td className="pr-taxes-td">
                              <input
                                type="checkbox"
                                checked={tax.add_row}
                                onChange={e => updateTax(i, 'add_row', e.target.checked)}
                                className="pr-checkbox"
                              />
                            </td>
                            <td className="pr-taxes-td">{i + 1}</td>
                            <td className="pr-taxes-td">
                              <select
                                value={tax.charge_type}
                                onChange={e => updateTax(i, 'charge_type', e.target.value)}
                                className="pr-items-input"
                              >
                                <option value="">Select Type</option>
                                {taxTypes.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="text"
                                value={tax.account_head}
                                onChange={e => updateTax(i, 'account_head', e.target.value)}
                                placeholder="Account Head"
                                className="pr-items-input"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="number"
                                value={tax.rate}
                                onChange={e => updateTax(i, 'rate', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <input
                                type="number"
                                value={tax.tax_amount}
                                onChange={e => updateTax(i, 'tax_amount', e.target.value)}
                                className="pr-items-input pr-items-input-number"
                                step="0.01"
                              />
                            </td>
                            <td className="pr-taxes-td">
                              <span className="pr-items-amount">{parseFloat(tax.total) || '0.00'}</span>
                            </td>
                            <td className="pr-taxes-td">
                              <button onClick={() => removeTaxRow(i)} className="pr-btn-delete">
                                <Trash2 className="pr-icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={addTaxRow} className="pr-btn-link">
                      <Plus className="pr-icon-sm" />
                      Add Row
                    </button>
                  </div>
                  <div className="pr-taxes-totals">
                    <div className="pr-total-row">
                      <span className="pr-total-label">Taxes and Charges Added (AED):</span>
                      <span className="pr-total-amount">AED {formData.taxes_added}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Taxes and Charges Deducted (AED):</span>
                      <span className="pr-total-amount">AED {formData.taxes_deducted}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Total Taxes and Charges (AED):</span>
                      <span className="pr-total-amount">AED {formData.total_taxes_and_charges}</span>
                    </div>
                  </div>
                </div>
                <div className="pr-form-section">
                  <h3 className="pr-section-title">Discounts and Rounding</h3>
                  <div className="pr-form-grid">
                    <div className="pr-form-group">
                      <label>Apply Discount On</label>
                      <select
                        value={formData.apply_discount_on}
                        onChange={e => updateDiscount('apply_discount_on', e.target.value)}
                        className="pr-select"
                      >
                        <option value="Net Total">Net Total</option>
                        <option value="Grand Total">Grand Total</option>
                      </select>
                    </div>
                    <div className="pr-form-group">
                      <label>Additional Discount Percentage</label>
                      <input
                        type="number"
                        value={formData.additional_discount_percentage}
                        onChange={e => updateDiscount('additional_discount_percentage', e.target.value)}
                        className="pr-input"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Discount Amount</label>
                      <input
                        type="number"
                        value={formData.discount_amount}
                        onChange={e => updateDiscount('discount_amount', e.target.value)}
                        className="pr-input"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="pr-form-group">
                      <label>Rounded Total</label>
                      <input
                        type="number"
                        value={formData.rounded_total}
                        onChange={e => updateDiscount('rounded_total', e.target.value)}
                        className="pr-input"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
                <div className="pr-form-section">
                  <div className="pr-totals-section">
                    <div className="pr-total-row">
                      <span className="pr-total-label">Net Total:</span>
                      <span className="pr-total-amount">AED {parseFloat(formData.net_total) || '0.00'}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Less Discount:</span>
                      <span className="pr-total-amount">AED {formData.discounted_amount}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Grand Total (AED):</span>
                      <span className="pr-total-amount">AED {formData.grand_total}</span>
                    </div>
                    <div className="pr-total-row">
                      <span className="pr-total-label">Rounding Adjustment (AED):</span>
                      <span className="pr-total-amount">AED {((parseFloat(formData.rounded_total) || 0) - (parseFloat(formData.grand_total) || 0)).toFixed(2)}</span>
                    </div>
                    <small className="pr-note">Note: Totals are approximate; exact values calculated on save.</small>
                  </div>
                </div>
              </div>
                            <div className="pr-modal-footer">
                <button onClick={() => setIsModalOpen(false)} className="pr-btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveDraft} disabled={saving} className="pr-btn-secondary">
                  {saving ? 'Saving...' : (docName ? 'Update Draft' : 'Save Draft')}
                </button>
                <button onClick={handleSubmit} disabled={saving} className="pr-btn-primary">
                  {saving ? (
                    <>
                      <div className="pr-btn-spinner"></div>
                      Processing...
                    </>
                  ) : (
                    docName ? 'Submit' : 'Save & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default PurchaseReceiptList;