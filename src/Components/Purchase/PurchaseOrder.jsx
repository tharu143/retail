import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package, Users,
  DollarSign, ShoppingCart, Save, Send, Trash2, Plus, Box, Scan, ChevronDown, ChevronUp, History,
  Search, File
} from 'lucide-react';
import CustomSearchDropdown from './CustomSearchDropdown';
import './Purchase.css';
import '../Headers/LegacyPOS.css';

const POItemModel = {
  item_code: null,
  item_name: '',
  rate: 0,
  amount: 0,
  custom_supplier_sl_num: '', // Legacy/Internal
  custom_ref_sl_no: '',       // NEW: REF / SL #
  custom_box_qty: 0,
  custom_pieces_per_box: 1,
  custom_box_price: 0,
  use_box_entry: false,
  last_buying_rate: 0,
  custom_selling_price: 0
};

function PurchaseOrder() {
  const theme = useSelector((state) => state.user.theme);
  const [formData, setFormData] = useState({
    name: '', // For draft name
    supplier: null,
    transaction_date: new Date().toISOString().slice(0, 16),
    company: localStorage.getItem('company') || '',
    currency: 'AED',
    conversion_rate: 1.0,
    set_warehouse: '',
    items: [{
      ...POItemModel,
      schedule_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 16)
    }],
    total_qty: 0,
    total: 0,
    taxes_and_charges: null,
    taxes: [],
    tax_total: 0,
    grand_total: 0,
    docstatus: 0 // 0 = Draft, 1 = Submitted
  });

  const [warehouses, setWarehouses] = useState([]);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);     // For Submit
  const [saving, setSaving] = useState(false);       // For Save Draft
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const [activeDropdownRow, setActiveDropdownRow] = useState(null);
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false); // Shows if we are editing a draft
  const [createdDocName, setCreatedDocName] = useState(''); // Store created PR/PI name
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(null); // Row index for history popup
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const dropdownRef = useRef(null);

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = '';
  const API_PATH = `/api/method/kyle_retail.retail_api.api`;
  const RESOURCE_API = `/api/resource/Purchase Order`;

  const [scanningRow, setScanningRow] = useState(null); // Track which row is scanning

  const handleBarcodeScan = (e, rowIndex) => {
    const value = e.target.value;
    const items = [...formData.items];
    items[rowIndex].temp_barcode = value;
    setFormData({ ...formData, items });
  };

  const handleBarcodeEnter = async (e, rowIndex) => {
    if (e.key !== 'Enter') return;
    const barcode = e.target.value.trim();
    if (!barcode) return;

    setScanningRow(rowIndex);
    try {
      const res = await fetch(`${API_PATH}.get_item_by_barcode_po?barcode=${encodeURIComponent(barcode)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Item not found');
      const data = await res.json();
      const item = data.message;
      if (!item || !item.item_code) {
        throw new Error(`No item found for barcode: ${barcode}`);
      }

      setFormData(prev => {
        const items = [...prev.items];
        const existingIdx = items.findIndex(i => i.item_code === item.item_code);
        const rate = parseFloat(item.last_buying_rate || item.rate || 0);

        if (existingIdx !== -1) {
          // Item already exists, merge by incrementing quantity
          const updatedQty = (items[existingIdx].qty || 0) + 1;
          items[existingIdx] = {
            ...items[existingIdx],
            qty: updatedQty,
            amount: updatedQty * items[existingIdx].rate,
            custom_box_qty: (items[existingIdx].custom_pieces_per_box > 0) ? (updatedQty / items[existingIdx].custom_pieces_per_box) : 0
          };
          // If the current row was a blank row, clear its barcode input
          if (rowIndex !== existingIdx && items[rowIndex] && !items[rowIndex].item_code) {
            items[rowIndex].temp_barcode = '';
          }
        } else {
          // Item does not exist, add it to the current row
          const piecesPerBox = parseFloat(item.custom_pieces_per_box || 1);
          items[rowIndex] = {
            ...items[rowIndex],
            item_code: item.item_code,
            item_name: item.item_name,
            stock_uom: item.stock_uom || '',
            uom: item.stock_uom || '',
            rate: rate,
            last_buying_rate: rate,
            qty: 1,
            amount: rate,
            custom_pieces_per_box: piecesPerBox,
            custom_box_price: rate * piecesPerBox,
            custom_box_qty: (piecesPerBox > 0) ? (1 / piecesPerBox) : 0,
            temp_barcode: ''
          };
        }

        // Add new empty row if all existing rows are filled
        if (items.every(i => i.item_code)) {
          items.push({ ...POItemModel, schedule_date: prev.transaction_date });
        }

        const totals = calculateTotals(items, prev.taxes);
        return { ...prev, items, ...totals };
      });

      // Clear the barcode input field
      e.target.value = '';
      // Focus back to the current barcode input or the next one if a new row was added
      setTimeout(() => {
        const nextInput = document.querySelector(`tr:nth-child(${rowIndex + 1}) input[placeholder="Barcode"]`);
        if (nextInput) {
          nextInput.focus();
        } else {
          // If no next input, focus on the last one (which might be the newly added row)
          const lastInput = document.querySelector(`tr:last-child input[placeholder="Barcode"]`);
          lastInput?.focus();
        }
      }, 10);

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Scan Error',
        text: err.message,
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
    } finally {
      setScanningRow(null);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    if (formData.company) {
      fetchTaxTemplates();
    }
  }, [formData.company]);

  const fetchWarehouses = async () => {
    try {
      const OLD_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await fetch(`${OLD_API}.get_warehouses?is_group=0`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWarehouses(data.message || []);
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const fetchTaxTemplates = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_purchase_taxes_templates_po?company=${encodeURIComponent(formData.company)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const allT = data.message || data || [];
      // Prioritize KSPL templates for this company
      const filtered = allT.filter(t => t.name.includes("KSPL"));
      setTaxTemplates(filtered.length > 0 ? filtered : allT);
    } catch (err) {
      console.error('Tax templates error:', err);
    }
  };

  const onTaxChange = (template) => {
    setFormData(prev => {
      if (!template) {
        const totals = calculateTotals(prev.items, []);
        return { 
          ...prev, 
          taxes_and_charges: null, 
          taxes: [], 
          ...totals 
        };
      }

      // Extract numeric percentage from string (e.g. "UAE VAT 5%" -> 5)
      const match = template.match(/(\d+(?:\.\d+)?)%/);
      const taxPercentage = match ? parseFloat(match[1]) : 0;

      // Create a virtual tax row for calculation
      const formattedTaxes = [{
        charge_type: "On Net Total",
        account_head: 'Tax - KSPL',
        rate: taxPercentage,
        tax_amount: 0, 
        description: template,
        add_deduct_tax: "Add"
      }];

      // Unified Recalculation
      const totals = calculateTotals(prev.items, formattedTaxes);
      
      return { 
        ...prev, 
        ...totals, 
        taxes_and_charges: template 
      };
    });
  };

  const handleInputChange = (e, rowIndex = null) => {
    const { name, value } = e.target;
    const val = value === '' ? '' : Math.max(0, parseFloat(value) || 0);

    setFormData(prev => {
      const newState = { ...prev };
      if (rowIndex !== null) {
        const items = [...prev.items];
        const item = { ...items[rowIndex] };

        if (name === 'qty' || name === 'rate') {
          item[name] = val === '' ? 0 : val;
          item.amount = (item.qty || 0) * (item.rate || 0);

          // Sync box fields if relevant
          if (name === 'rate') {
            item.custom_box_price = item.rate * (item.custom_pieces_per_box || 1);
          } else {
            item.custom_box_qty = (item.custom_pieces_per_box > 0) ? (item.qty / item.custom_pieces_per_box) : 0;
          }
        } else if (['custom_box_qty', 'custom_pieces_per_box', 'custom_box_price', 'custom_selling_price'].includes(name)) {
          item[name] = val === '' ? 0 : val;
          if (name === 'custom_box_price') {
            item.rate = item.custom_box_price / (item.custom_pieces_per_box || 1);
          } else if (name === 'custom_box_qty') {
            item.qty = item.custom_box_qty * (item.custom_pieces_per_box || 1);
          } else if (name === 'custom_pieces_per_box') {
            item.qty = (item.custom_box_qty || 0) * item.custom_pieces_per_box;
            item.custom_box_price = item.rate * item.custom_pieces_per_box; // Recalculate box price if pieces per box changes
          }
          item.amount = (item.qty || 0) * (item.rate || 0);
        } else if (name === 'schedule_date') {
          item[name] = value;
        } else {
          item[name] = value;
        }
        items[rowIndex] = item;
        newState.items = items;
      } else {
        newState[name] = value;
      }

      const totals = calculateTotals(newState.items, newState.taxes);
      return { ...newState, ...totals };
    });
  };

  const calculateTotals = (items = formData.items, taxes = formData.taxes) => {
    if (!items) return {};
    const validItems = items.filter(i => i.item_code);
    const totalQty = validItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const netTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    let taxesTotal = 0;
    const updatedTaxes = (taxes || []).map(tax => {
      let taxAmt = 0;
      const rate = parseFloat(tax.rate) || 0;
      if (tax.charge_type === "On Net Total") {
        taxAmt = (netTotal * rate) / 100;
      } else if (tax.charge_type === "Actual") {
        taxAmt = rate;
      }
      if (tax.add_deduct_tax === "Deduct") taxAmt = -taxAmt;
      taxesTotal += taxAmt;
      return { ...tax, tax_amount: parseFloat(taxAmt.toFixed(4)) };
    });

    return {
      total_qty: parseFloat(totalQty.toFixed(4)),
      total: parseFloat(netTotal.toFixed(4)),
      tax_total: parseFloat(taxesTotal.toFixed(4)),
      taxes: updatedTaxes,
      grand_total: parseFloat((netTotal + taxesTotal).toFixed(4))
    };
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...POItemModel, schedule_date: prev.transaction_date }]
    }));
  };

  const removeItemRow = (index) => {
    setFormData(prev => {
      const items = prev.items.filter((_, i) => i !== index);
      const totals = calculateTotals(items, prev.taxes);
      return { ...prev, items, ...totals };
    });
  };

  const fetchHistory = async () => {
    const itemCodes = formData.items.map(i => i.item_code).filter(Boolean);
    if (!itemCodes.length) {
      setHistory({});
      return;
    }
    try {
      const OLD_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await fetch(`${OLD_API}.get_po_history?item_codes_json=${JSON.stringify(itemCodes)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(data.message || {});
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [formData.items]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.product-search-container') && !e.target.closest('.product-dropdown-portal')) {
        setActiveDropdownRow(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedProductIndex >= 0 && dropdownRef.current) {
      const activeItem = dropdownRef.current.childNodes[selectedProductIndex];
      if (activeItem) {
        activeItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedProductIndex]);

  const validateForm = (isSubmitting = false) => {
    if (!formData.supplier?.name) {
      setError('Please select a Supplier / Vendor');
      return false;
    }
    if (!formData.set_warehouse) {
      setError('Please select a Target Warehouse');
      return false;
    }
    const validItems = formData.items.filter(i => i.item_code);
    if (validItems.length === 0) {
      setError('Please add at least one valid item');
      return false;
    }
    if (validItems.some(i => i.qty <= 0)) {
      setError('All items must have a quantity greater than zero');
      return false;
    }
    if (isSubmitting && !formData.name) {
      setError('Please Save as Draft before processing the order');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm(false)) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const validItems = formData.items.filter(i => i.item_code);
      const payload = {
        supplier: formData.supplier.name,
        company: formData.company,
        transaction_date: formData.transaction_date,
        set_warehouse: formData.set_warehouse,
        currency: formData.currency || 'AED',
        conversion_rate: 1.0,
        taxes_and_charges: formData.taxes_and_charges,
        items: validItems.map(item => ({
          item_code: item.item_code,
          item_name: item.item_name,
          qty: parseFloat(item.qty),
          uom: item.uom,
          rate: parseFloat(item.rate),
          schedule_date: item.schedule_date || formData.transaction_date,
          custom_pieces_per_box: parseFloat(item.custom_pieces_per_box || 1),
          custom_box_qty: parseFloat(item.custom_box_qty || 0),
          custom_box_price: parseFloat(item.custom_box_price || 0)
        })),
        taxes: (formData.taxes || []).map(t => ({
          charge_type: t.charge_type,
          account_head: t.account_head,
          rate: parseFloat(t.rate),
          tax_amount: parseFloat(t.tax_amount),
          description: t.description || t.account_head
        }))
      };

      let response;
      if (formData.name) {
        response = await fetch(`${RESOURCE_API}/${formData.name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(RESOURCE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const docName = data.data?.name || data.message?.name;

      setFormData(prev => ({ ...prev, name: docName, docstatus: 0 }));
      setIsEditMode(true);
      setSuccess(`Draft ${formData.name ? 'updated' : 'saved'}: ${docName}`);
    } catch (err) {
      setError(`Save Draft failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm(true)) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await handleSaveDraft();

      const response = await fetch(`${RESOURCE_API}/${formData.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify({ docstatus: 1 })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      setSuccess(`Purchase Order ${formData.name} submitted successfully!`);
      setFormData(prev => ({ ...prev, docstatus: 1 }));
      setCreatedDocName(null);
      setIsEditMode(false);
    } catch (err) {
      setError(`Submit failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFlow = async (type) => {
    if (!formData.name) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = type === 'receipt' ? 'create_purchase_receipt_from_po' : 'create_purchase_invoice_from_po';
      const body = {
        po_name: formData.name,
        posting_date: new Date().toISOString().slice(0, 10),
        set_warehouse: formData.set_warehouse,
        items: formData.items.filter(i => i.item_code).map(item => ({
          item_code: item.item_code,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          amount: item.amount,
          purchase_order: formData.name
        }))
      };

      const OLD_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await fetch(`${OLD_API}.${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await res.json();
      const apiResp = data.message || data;
      if (apiResp.status === 'success') {
        setSuccess(`${type === 'receipt' ? 'Receipt' : 'Invoice'} ${apiResp.name} created successfully!`);
        setCreatedDocName(apiResp.name);
      } else {
        throw new Error(apiResp.message || 'Failed to create');
      }
    } catch (err) {
      setError(`Transition failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = (supplier) => setFormData(prev => ({ ...prev, supplier }));

  const handleSupplierCreate = async (name) => {
    const typeSelect = document.getElementById('new-supplier-type');
    const supplier_type = typeSelect ? typeSelect.value : "Company";

    try {
      const OLD_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await fetch(`${OLD_API}.create_supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify({ supplier_name: name.trim(), supplier_type })
      });
      const result = await res.json();

      if (result.message?.status === 'success' && result.message?.message) {
        const s = result.message.message;
        return { name: s.name, supplier_name: s.supplier_name || s.name, supplier_type: s.supplier_type || supplier_type };
      }
      throw new Error('Invalid response');
    } catch (err) {
      setError(`Cannot create supplier: ${err.message}`);
      throw err;
    }
  };

  const fetchSuppliers = async (query) => {
    try {
      const res = await fetch(`${API_PATH}.get_suppliers_po?query=${encodeURIComponent(query)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.message || []).map(s => ({ name: s.name, supplier_name: s.supplier_name || s.name }));
    } catch (err) {
      return [];
    }
  };

  const handleItemSelect = (item, rowIndex) => {
    setFormData(prev => {
      const items = [...prev.items];
      const existingIdx = items.findIndex((i, idx) => i.item_code === item.item_code && idx !== rowIndex);
      const rate = parseFloat(item.last_buying_rate || item.rate || 0);

      if (existingIdx !== -1) {
        const newQty = items[existingIdx].qty + 1;
        items[existingIdx] = {
          ...items[existingIdx],
          qty: newQty,
          amount: newQty * items[existingIdx].rate
        };
        if (items.length > 1) {
          items.splice(rowIndex, 1);
        } else {
          items[rowIndex] = { ...POItemModel, schedule_date: prev.transaction_date };
        }
      } else {
        const pPerBox = parseFloat(item.custom_pieces_per_box || 1);
        items[rowIndex] = {
          ...items[rowIndex],
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom || '',
          uom: item.stock_uom || '',
          rate: rate,
          last_buying_rate: rate,
          custom_pieces_per_box: pPerBox,
          qty: 1,
          amount: rate,
          custom_box_price: rate * pPerBox,
          custom_box_qty: 1 / pPerBox,
          schedule_date: items[rowIndex].schedule_date || prev.transaction_date,
          custom_selling_price: parseFloat(item.selling_price || 0)
        };
      }

      if (items.every(i => i.item_code)) {
        items.push({ ...POItemModel, schedule_date: prev.transaction_date });
      }

      const totals = calculateTotals(items, prev.taxes);
      return { ...prev, items, ...totals };
    });
  };

  const fetchItems = async (query) => {
    try {
      const res = await fetch(`${API_PATH}.get_items_for_po?query=${query}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results = (data.message || []).map(it => ({
        ...it,
        rate: it.last_buying_rate || it.rate || 0
      }));
      setAllItems(results);
      return results;
    } catch (err) {
      return [];
    }
  };

  if (!formData.company) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-600 font-medium font-sans">Restoring Session...</p>
      </div>
    );
  }

  return (
    <div className={`font-sans purchase-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      {/* 1. Professional Minimal Header */}
      <div className="bg-white px-6 py-2 border-b border-slate-100 flex items-center justify-between">
        <div className="flex flex-col text-left">
          <h1 className="text-[18px] font-bold text-[#0f172a] leading-tight tracking-tight">
            {formData.name ? `Edit PO: ${formData.name}` : 'New Purchase Order'}
          </h1>
          <p className="text-[11px] font-normal text-slate-400 mt-0.5">
            Procurement & Inventory
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || loading}
            className="po-btn-secondary"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || saving || !formData.supplier || formData.items.filter(i => i.item_code).length === 0 || formData.docstatus === 1}
            className="po-btn-primary px-6"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {formData.docstatus === 1 ? 'Submitted' : 'Process Order'}
          </button>
        </div>
      </div>

      <div className="po-layout-container !pt-4 pb-20">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 rounded-lg p-4 flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-semibold text-red-800">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-8 border-l-4 border-emerald-500 bg-white shadow-sm p-6 animate-fadeIn">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">{success}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">Transaction processed successfully</p>
                </div>
              </div>

              {!createdDocName && formData.docstatus === 1 && (
                <div className="flex gap-3">
                  <button onClick={() => handleCreateFlow('receipt')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-700 transition-all shadow-sm">
                    Create Receipt
                  </button>
                  <button onClick={() => handleCreateFlow('invoice')} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase hover:bg-slate-900 transition-all shadow-sm">
                    Create Invoice
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="space-y-6">
            <div className="po-card">
              <div className="po-card-header">
                <h3 className="po-card-title">Order Core Details</h3>
              </div>
              <div className="po-card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="po-label">Supplier / Vendor</label>
                  <CustomSearchDropdown
                    placeholder="Search supplier..."
                    value={formData.supplier}
                    onSelect={handleSupplierSelect}
                    fetchData={fetchSuppliers}
                    createOption={handleSupplierCreate}
                    optionsLabel="supplier_name"
                  />
                </div>
                <div>
                  <label className="po-label">Branch (Target)</label>
                  <select name="set_warehouse" value={formData.set_warehouse} onChange={handleInputChange} className="po-input font-bold">
                    <option value="">Choose branch...</option>
                    {warehouses.map(wh => <option key={wh.name} value={wh.name}>{wh.warehouse_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="po-label">Transaction Date</label>
                  <div className="po-input bg-slate-50/50 border-slate-100 flex items-center justify-between text-slate-500 cursor-not-allowed h-[42px]">
                    <span className="font-bold text-[13px]">
                      {new Date(formData.transaction_date).toLocaleString('en-GB', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      }).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="po-label">Entity / Company</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase">
                    {formData.company}
                  </div>
                </div>
              </div>
            </div>

            <div className="po-card">
              <div className="po-card-header">
                <h3 className="po-card-title">Product Inventory Basket</h3>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 bg-white">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter Barcode / Scan here..."
                    className="w-full px-4 h-[38px] bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-[#10b981] focus:bg-white transition-all"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const barcode = e.target.value.trim();
                        if (barcode) {
                          await handleBarcodeEnter({ key: 'Enter', target: { value: barcode } }, formData.items.length - 1);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </div>
                <button type="button" onClick={addItemRow} className="po-btn-secondary h-[38px] px-8">Add Row</button>
              </div>

              <div className="purchase-table-container">
                <table className="purchase-table">
                  <thead>
                    <tr>
                      <th className="purchase-th !pl-5 w-[140px]">Scanner</th>
                      <th className="purchase-th min-w-[180px]">Item Description</th>
                      <th className="purchase-th w-[70px] text-center">Box Qty</th>
                      <th className="purchase-th w-[70px] text-center">Pcs/Box</th>
                      <th className="purchase-th w-[90px] text-right">Box Price</th>
                      <th className="purchase-th w-[100px] text-right">Selling Price</th>
                      <th className="purchase-th w-[120px] text-center">Ref / SL #</th>
                      <th className="purchase-th w-[70px] text-center">Qty</th>
                      <th className="purchase-th w-[60px] text-center">UOM</th>
                      <th className="purchase-th w-[100px] text-right">Rate</th>
                      <th className="purchase-th w-[120px] text-right !pr-5">Subtotal</th>
                      <th className="purchase-th w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                        <td className="purchase-td !pl-5">
                          <input
                            type="text"
                            value={item.temp_barcode || ''}
                            placeholder="Barcode"
                            onChange={(e) => handleBarcodeScan(e, idx)}
                            onKeyDown={(e) => e.key === 'Enter' && handleBarcodeEnter(e, idx)}
                            className="w-full text-[11px] font-bold outline-none"
                          />
                        </td>
                        <td className="purchase-td">
                          <div className="relative product-search-container">
                            <input
                              type="text"
                              value={item.item_name || ''}
                              placeholder="Search product..."
                              onChange={async (e) => {
                                const q = e.target.value;
                                const items = [...formData.items];
                                items[idx].item_name = q;
                                setFormData({ ...formData, items });
                                try {
                                  await fetchItems(q);
                                  setActiveDropdownRow(idx);
                                  setSelectedProductIndex(-1);
                                  const rect = e.target.getBoundingClientRect();
                                  setDropdownPosition({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX, width: rect.width });
                                } catch (err) { }
                              }}
                              onKeyDown={(e) => {
                                if (activeDropdownRow !== idx) return;
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setSelectedProductIndex(prev => (prev < allItems.length - 1 ? prev + 1 : prev));
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setSelectedProductIndex(prev => (prev > 0 ? prev - 1 : 0));
                                } else if (e.key === 'Enter') {
                                  if (selectedProductIndex >= 0 && allItems[selectedProductIndex]) {
                                    e.preventDefault();
                                    handleItemSelect(allItems[selectedProductIndex], idx);
                                    setActiveDropdownRow(null);
                                  }
                                } else if (e.key === 'Escape') {
                                  setActiveDropdownRow(null);
                                }
                              }}
                              className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none"
                            />
                            {activeDropdownRow === idx && dropdownPosition && allItems.length > 0 && createPortal(
                              <div ref={dropdownRef} className="fixed bg-white border border-slate-200 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto min-w-[300px] product-dropdown-portal" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                                {allItems.map((it, i) => (
                                  <div key={it.item_code} onClick={() => { handleItemSelect(it, idx); setActiveDropdownRow(null); }} onMouseEnter={() => setSelectedProductIndex(i)} className={`px-4 py-2.5 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors ${selectedProductIndex === i ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center gap-3">
                                      <div className={`text-[11px] font-bold ${selectedProductIndex === i ? 'text-emerald-600' : 'text-slate-800'}`}>{it.item_name}</div>
                                      <div className="text-[9px] font-bold text-[#003d7c] bg-slate-100 px-1.5 py-0.5 rounded">{it.item_code}</div>
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Rate: {parseFloat(it.last_buying_rate || 0).toFixed(2)}</div>
                                  </div>
                                ))}
                              </div>, document.body
                            )}
                          </div>
                        </td>
                        <td className="purchase-td">
                          <input type="number" name="custom_box_qty" value={item.custom_box_qty} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-center" />
                        </td>
                        <td className="purchase-td">
                          <input type="number" name="custom_pieces_per_box" value={item.custom_pieces_per_box} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-center" />
                        </td>
                        <td className="purchase-td text-right">
                          <input type="number" name="custom_box_price" value={item.custom_box_price} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-right" />
                        </td>
                        <td className="purchase-td text-right">
                          <input type="number" name="custom_selling_price" value={item.custom_selling_price} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-right !text-[#10b981]" />
                        </td>
                        <td className="purchase-td">
                          <input type="text" name="custom_ref_sl_no" value={item.custom_ref_sl_no || ''} onChange={(e) => handleInputChange(e, idx)} placeholder="Serial..." className="w-full text-center text-[10px]" />
                        </td>
                        <td className="purchase-td text-center">
                          <input type="number" name="qty" value={item.qty} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-right" />
                        </td>
                        <td className="purchase-td text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{item.uom || 'UNIT'}</span>
                        </td>
                        <td className="purchase-td text-right">
                          <input type="number" name="rate" value={item.rate} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-right" />
                        </td>
                        <td className="purchase-td text-right !pr-5">
                          <span className="text-xs font-bold text-slate-900 tabular-nums">
                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="purchase-td text-center">
                          <button type="button" onClick={() => removeItemRow(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="po-summary-row-container">
            <div className="po-summary-card-horizontal">
              <div className="summary-section tax-section">
                <span className="summary-label">Tax Schedule</span>
                <div className="relative mt-2">
                  <select value={formData.taxes_and_charges || ''} onChange={(e) => onTaxChange(e.target.value)} className="summary-select focus:border-[#10b981]">
                    <option value="">No Tax Schedule...</option>
                    {taxTemplates.map((t) => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-12">
                <div className="flex gap-10">
                  <div className="text-right">
                    <span className="summary-label">Gross Total</span>
                    <p className="detail-value text-slate-400">{formData.total.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="summary-label">Tax</span>
                    <p className="detail-value text-slate-400">{formData.tax_total.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="summary-label">Total Qty</span>
                    <p className="detail-value">{formData.total_qty.toFixed(2)}</p>
                  </div>
                </div>

                <div className="summary-section grand-total-section border-l border-slate-200 pl-12">
                  <div className="text-right">
                    <span className="summary-label block">Grand Total</span>
                    <p className="grand-total-value"><span className="currency-label-large">AED</span> {formData.grand_total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrder;
