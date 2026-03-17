import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package,
  DollarSign, ShoppingCart, Save, Send, Trash2, Plus, Box, Scan, ChevronDown, ChevronUp, History
} from 'lucide-react';
import CustomSearchDropdown from './CustomSearchDropdown';
import './Purchase.css';
import '../Headers/LegacyPOS.css';

const POItemModel = {
  item_code: null,
  item_name: '',
  schedule_date: '',
  qty: 1,
  stock_uom: '',
  uom: '',
  rate: 0,
  amount: 0,
  custom_supplier_sl_num: '',
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

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = ''; // Relative path for browser compatibility
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
        setError(`No item found for barcode: ${barcode}`);
        return;
      }

      // Auto-fill the row with item data
      const items = [...formData.items];
      const rate = item.last_buying_rate || item.rate || 0;
      items[rowIndex] = {
        ...items[rowIndex],
        item_code: item.item_code,
        item_name: item.item_name,
        stock_uom: item.stock_uom || '',
        uom: item.stock_uom || '',
        rate: rate,
        last_buying_rate: item.last_buying_rate || 0,
        qty: items[rowIndex].qty || 1,
        custom_pieces_per_box: item.custom_pieces_per_box || 1,
        amount: rate * (items[rowIndex].qty || 1),
        temp_barcode: '' // Clear barcode field
      };

      setFormData({ ...formData, items });
      calculateTotals();

      // Optional: Add new empty row if this was the last one
      if (rowIndex === formData.items.length - 1) {
        addItemRow();
      }

      // Focus next barcode field
      setTimeout(() => {
        const nextInput = document.querySelector(`tr:nth-child(${rowIndex + 2}) input[placeholder="Scan barcode..."]`);
        nextInput?.focus();
      }, 100);

    } catch (err) {
      Swal.fire({
          icon: 'error',
          title: 'Barcode Not Found',
          text: `"${barcode}" does not exist in the catalog.`,
          toast: true,
          position: 'top-end',
          timer: 3000,
          showConfirmButton: false
      });
    } finally {
      setScanningRow(null);
    }

    // Clear the barcode input
    e.target.value = '';
  };

  useEffect(() => {
    fetchWarehouses();
    if (formData.company) {
      fetchTaxTemplates();
    }
  }, [formData.company]);

  const fetchWarehouses = async () => {
    try {
      const OLD_API = 'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
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

  const fetchTaxRows = async (template) => {
    if (!template) {
      setFormData(prev => ({
        ...prev,
        taxes: [],
        taxes_and_charges: null,
        grand_total: prev.total
      }));
      return;
    }

    try {
      const res = await fetch(`${API_PATH}.get_purchase_taxes_templates_po?template=${encodeURIComponent(template)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      if (!res.ok) {
        setError('Failed to load tax template');
        return;
      }

      const data = await res.json();
      const rawTaxes = Array.isArray(data) ? data : Array.isArray(data.message) ? data.message : [];

      // Filter out only completely empty rows (must have an account OR a rate)
      const formattedTaxes = rawTaxes
        .filter(t => t.account_head || (parseFloat(t.rate) > 0)) 
        .map(t => ({
          charge_type: t.charge_type || "On Net Total",
          account_head: t.account_head || 'Purchase Tax',
          rate: parseFloat(t.rate) || 0,
          tax_amount: 0,
          description: t.description || (t.account_head ? t.account_head.split(' - ')[0] : 'VAT'),
          add_deduct_tax: t.add_deduct_tax || "Add"
        }));

      setFormData(prev => {
        const netTotal = prev.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        let taxesTotal = 0;
        const updatedTaxes = formattedTaxes.map(tax => {
          let taxAmt = 0;
          if (tax.charge_type === "On Net Total") {
            taxAmt = netTotal * (tax.rate || 0) / 100;
          } else if (tax.charge_type === "Actual") {
            taxAmt = tax.rate || 0;
          }
          if (tax.add_deduct_tax === "Deduct") taxAmt = -taxAmt;
          taxesTotal += taxAmt;
          return { ...tax, tax_amount: taxAmt };
        });

        return {
          ...prev,
          taxes: updatedTaxes,
          taxes_and_charges: template,
          total: netTotal,
          grand_total: netTotal + taxesTotal
        };
      });
    } catch (err) {
      setError('Failed to load tax details');
    }
  };

  const handleInputChange = (e, rowIndex = null) => {
    const { name, value } = e.target;
    if (rowIndex !== null) {
      const items = [...formData.items];
      if (name === 'qty' || name === 'rate') {
        items[rowIndex][name] = parseFloat(value) || 0;
        items[rowIndex].amount = (items[rowIndex].qty || 0) * (items[rowIndex].rate || 0);
      } else if (['custom_box_qty', 'custom_pieces_per_box', 'custom_box_price'].includes(name)) {
        items[rowIndex][name] = parseFloat(value) || 0;
        const bQty = items[rowIndex].custom_box_qty || 0;
        const pPerB = items[rowIndex].custom_pieces_per_box || 1;
        const bPrice = items[rowIndex].custom_box_price || 0;
        
        items[rowIndex].qty = bQty * pPerB;
        items[rowIndex].rate = pPerB > 0 ? bPrice / pPerB : 0;
        items[rowIndex].amount = items[rowIndex].qty * items[rowIndex].rate;
      } else if (name === 'schedule_date') {
        if (value < formData.transaction_date) {
          setError('Schedule date cannot be before transaction date');
          return;
        }
        items[rowIndex][name] = value;
      } else {
        items[rowIndex][name] = value;
      }
      setFormData(prev => {
        const newState = { ...prev, items };
        calculateTotals(newState.items, newState.taxes);
        return newState;
      });
    } else {
      if (name === 'transaction_date') {
        const items = formData.items.map(item => ({
          ...item,
          schedule_date: item.schedule_date < value ? value : item.schedule_date
        }));
        setFormData(prev => {
          const newState = { ...prev, [name]: value, items };
          calculateTotals(newState.items, newState.taxes);
          return newState;
        });
      } else {
        setFormData(prev => {
          const newState = { ...prev, [name]: value };
          calculateTotals(newState.items, newState.taxes);
          return newState;
        });
      }
    }
  };

  const calculateTotals = (overrideItems = null, overrideTaxes = null) => {
    const items = overrideItems || formData.items;
    const taxes = overrideTaxes || formData.taxes;
    
    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    const netTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    let taxesTotal = 0;
    const updatedTaxes = (taxes || []).map(tax => {
      let taxAmt = 0;
      if (tax.charge_type === "On Net Total") {
        taxAmt = netTotal * (parseFloat(tax.rate) || 0) / 100;
      } else if (tax.charge_type === "Actual") {
        taxAmt = parseFloat(tax.rate) || 0;
      }
      if (tax.add_deduct_tax === "Deduct") taxAmt = -taxAmt;
      taxesTotal += taxAmt;
      return { ...tax, tax_amount: taxAmt };
    });

    setFormData(prev => ({
      ...prev,
      total_qty: totalQty,
      total: netTotal,
      taxes: updatedTaxes,
      grand_total: netTotal + taxesTotal
    }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...POItemModel, schedule_date: prev.transaction_date }]
    }));
  };

  const removeItemRow = (index) => {
    const items = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items }));
    calculateTotals();
  };

  const fetchHistory = async () => {
    const itemCodes = formData.items.map(i => i.item_code).filter(Boolean);
    if (!itemCodes.length) {
      setHistory({});
      return;
    }
    try {
      const OLD_API = 'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
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
    calculateTotals();
  }, [formData.items]);

  // ======================= SAVE DRAFT =======================
  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!formData.supplier?.name || !formData.company) {
      setError('Please select supplier and company');
      return;
    }
    if (formData.items.some(i => !i.item_code || i.qty <= 0)) {
      setError('All items must have item and valid qty');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...formData,
        supplier: formData.supplier.name,
        taxes_and_charges: formData.taxes_and_charges,
        items: formData.items.map(item => {
          const { use_box_entry, temp_barcode, ...rest } = item;
          return rest;
        }),
        taxes: formData.taxes.map(t => ({
          charge_type: t.charge_type,
          account_head: t.account_head,
          rate: t.rate,
          tax_amount: t.tax_amount,
          description: t.description || t.account_head
        }))
      };
      delete payload.total_qty;
      delete payload.total;
      delete payload.grand_total;
      delete payload.docstatus;
      delete payload.name; // name will be auto-generated or updated

      let response;
      if (formData.name) {
        // Update existing draft
        response = await fetch(`${RESOURCE_API}/${formData.name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        // Create new draft
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

  // ======================= SUBMIT =======================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      setError('Please Save as Draft first before submitting');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
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
      // Update local state to reflect submission so buttons show
      setFormData(prev => ({ ...prev, docstatus: 1 }));
      setCreatedDocName(null); // Clear previous created doc state
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
        items: formData.items.map(item => ({
          item_code: item.item_code,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          amount: item.amount,
          purchase_order: formData.name
        }))
      };
      
      const res = await fetch(`${API_PATH.replace('kyle_retail.retail_api.api', 'custom_retailpos.custom_retailpos.retail_api.retail')}.${endpoint}`, {
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

  // Supplier & Item handlers remain unchanged
  const handleSupplierSelect = (supplier) => setFormData(prev => ({ ...prev, supplier }));

  const handleSupplierCreate = async (name) => {
    const typeSelect = document.getElementById('new-supplier-type');
    const supplier_type = typeSelect ? typeSelect.value : "Company";

    try {
      const OLD_API = 'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
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
      if (result.status === 'success' && result.message) {
        const s = result.message;
        return { name: s.name, supplier_name: s.supplier_name || s.name, supplier_type: s.supplier_type || supplier_type };
      }
      if (Array.isArray(result.message) && result.message[0]) {
        const s = result.message[0];
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
    const items = [...formData.items];
    const rate = item.last_buying_rate || item.rate || 0;
    items[rowIndex] = {
      ...items[rowIndex],
      item_code: item.item_code,
      item_name: item.item_name,
      stock_uom: item.stock_uom || '',
      uom: item.stock_uom || '',
      rate: rate,
      last_buying_rate: item.last_buying_rate || 0,
      custom_pieces_per_box: item.custom_pieces_per_box || 1,
      amount: rate * (items[rowIndex].qty || 1),
      schedule_date: items[rowIndex].schedule_date || formData.transaction_date,
      custom_selling_price: item.selling_price || 0
    };
    setFormData({ ...formData, items });
    calculateTotals();
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
    <div className={`min-h-screen bg-[#f1f5f9] font-sans pb-10 purchase-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      <div className="max-w-[1700px] mx-auto px-4 py-6">
        
        {/* Top Floating Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="bg-sky-600 p-2 rounded-xl shadow-lg shadow-sky-100">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight flex items-center gap-2">
                Purchase Order
                {isEditMode && formData.name && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded uppercase tracking-wider">
                    Draft: {formData.name}
                  </span>
                )}
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">
                {isEditMode ? 'Editing existing draft' : 'New Procurement Entry'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || loading}
              className="po-btn-secondary"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || saving || !formData.name}
              className="po-btn-primary !bg-sky-600 hover:!bg-sky-700 !py-2.5 !w-auto !px-6"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Process Order
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-r-xl p-4 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm font-bold text-red-800">{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl p-6 flex flex-col gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              <div>
                <div className="text-lg font-black text-emerald-900">{success}</div>
                {!createdDocName && formData.docstatus === 1 && (
                  <p className="text-emerald-700 text-sm font-bold mt-1 uppercase tracking-tighter">What would you like to do next?</p>
                )}
              </div>
            </div>
            {!createdDocName && formData.docstatus === 1 && (
              <div className="flex gap-3 ml-10">
                <button onClick={() => handleCreateFlow('receipt')} className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-black text-xs uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">
                  Create Purchase Receipt
                </button>
                <button onClick={() => handleCreateFlow('invoice')} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-black text-xs uppercase shadow-lg shadow-slate-200 hover:bg-slate-900 transition-all active:scale-95">
                  Create Purchase Invoice
                </button>
              </div>
            )}
          </div>
        )}

        <div className="po-layout-full">
          {/* TOP AREA: Order Settings */}
          <div className="po-card mb-6">
            <div className="po-card-header !bg-slate-800 !text-white">
              <h3 className="po-card-title text-white">Order Settings</h3>
            </div>
            <div className="po-card-body grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="po-label">Supplier *</label>
                <CustomSearchDropdown
                  placeholder="Search supplier..."
                  value={formData.supplier}
                  onSelect={handleSupplierSelect}
                  fetchData={fetchSuppliers}
                  createOption={handleSupplierCreate}
                  optionsLabel="supplier_name"
                  extraCreateFields={() => (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                      <label className="text-[10px] font-bold uppercase mb-1 block">Type</label>
                      <select id="new-supplier-type" className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs outline-none" defaultValue="Company">
                        <option value="Company">Company</option>
                        <option value="Individual">Individual</option>
                      </select>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="po-label">Warehouse (Target)</label>
                <select name="set_warehouse" value={formData.set_warehouse} onChange={handleInputChange} className="po-input text-xs">
                  <option value="">Select...</option>
                  {warehouses.map(wh => <option key={wh.name} value={wh.name}>{wh.warehouse_name}</option>)}
                </select>
              </div>

              <div>
                <label className="po-label">Purchase Date</label>
                <input type="datetime-local" name="transaction_date" value={formData.transaction_date} onChange={handleInputChange} className="po-input text-xs" />
              </div>

              <div>
                <label className="po-label">Company</label>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                  {formData.company}
                </div>
              </div>
            </div>
          </div>

          <div className="po-main-section">
            
            {/* Global Scanner Card */}
            <div className="po-card !border-sky-200 !bg-sky-50/30">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 relative">
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
                  <input
                    type="text"
                    placeholder="SCAN ITEM BARCODE FOR QUICK ADD..."
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-sky-100 rounded-xl text-sm font-black text-sky-900 placeholder:text-sky-300 focus:border-sky-500 outline-none shadow-sm transition-all"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const barcode = e.target.value;
                        if (!barcode) return;
                        const emptyIdx = formData.items.findIndex(i => !i.item_code);
                        const targetIdx = emptyIdx !== -1 ? emptyIdx : formData.items.length;
                        if (emptyIdx === -1) addItemRow();
                        handleBarcodeEnter({ key: 'Enter', target: { value: barcode } }, targetIdx);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <div className="hidden md:block">
                  <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest leading-none">Press Enter to Add</span>
                </div>
              </div>
            </div>

            {/* Items Table Card */}
            <div className="po-card">
              <div className="po-card-header">
                <h3 className="po-card-title flex items-center gap-2">
                  <Package className="w-4 h-4 text-sky-500" />
                  Items in Basket
                  <span className="ml-2 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">
                    {formData.items.length} Lines
                  </span>
                </h3>
                <button 
                  type="button" 
                  onClick={addItemRow} 
                  className="bg-sky-50 text-sky-600 hover:bg-sky-100 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New
                </button>
              </div>
              
              <div className="purchase-table-container">
                <table className="purchase-table">
                  <thead>
                    <tr>
                      <th className="purchase-th w-[130px]">Scanner</th>
                      <th className="purchase-th min-w-[200px]">Item Description</th>
                      <th className="purchase-th w-[80px] text-center">Box Qty</th>
                      <th className="purchase-th w-[80px] text-center">Pcs/Box</th>
                      <th className="purchase-th w-[100px] text-center">Box Price</th>
                      <th className="purchase-th w-[100px] text-right">Selling Price</th>
                      <th className="purchase-th w-[110px]">Ref / SL #</th>
                      <th className="purchase-th w-[130px]">Sch. Date</th>
                      <th className="purchase-th w-[80px] text-right">Qty</th>
                      <th className="purchase-th w-[60px]">UOM</th>
                      <th className="purchase-th w-[100px] text-right">Rate</th>
                      <th className="purchase-th w-[120px] text-right">Subtotal</th>
                      <th className="purchase-th w-[40px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="purchase-td">
                          <div className="relative">
                            <Scan className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={item.temp_barcode || ''}
                              placeholder="Barcode..."
                              onChange={(e) => handleBarcodeScan(e, idx)}
                              onKeyDown={(e) => e.key === 'Enter' && handleBarcodeEnter(e, idx)}
                              className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            {scanningRow === idx && (
                              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-sky-500" />
                            )}
                          </div>
                        </td>
                        <td className="purchase-td">
                          <div className="relative">
                            <input
                              type="text"
                              value={item.item_name || ''}
                              placeholder="Type item..."
                                onChange={async (e) => {
                                 const q = e.target.value;
                                 const items = [...formData.items];
                                 items[idx].item_name = q;
                                 setFormData({ ...formData, items });
                                 if (q.length < 2) return;
                                 try {
                                   const results = await fetchItems(q);
                                   setActiveDropdownRow(idx);
                                   const rect = e.target.getBoundingClientRect();
                                   setDropdownPosition({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX, width: rect.width });
                                 } catch (err) {}
                               }}
                               className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-black text-slate-800 focus:border-sky-500 outline-none"
                             />
                            {activeDropdownRow === idx && dropdownPosition && allItems.length > 0 && createPortal(
                              <div className="fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-60 overflow-y-auto w-fit min-w-[300px]" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                                  {allItems.map((it) => (
                                    <div key={it.item_code} onClick={() => { handleItemSelect(it, idx); setActiveDropdownRow(null); }} className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0">
                                      <div className="flex justify-between items-start gap-3">
                                        <div className="text-xs font-bold text-slate-800">{it.item_name}</div>
                                        <div className="text-[10px] font-black text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded uppercase">{it.item_code}</div>
                                      </div>
                                      <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Last Rate: AED {parseFloat(it.last_buying_rate || 0).toFixed(2)}</div>
                                    </div>
                                  ))}
                              </div>, document.body
                            )}
                          </div>
                        </td>
                        <td className="purchase-td">
                          <input type="number" name="custom_box_qty" value={item.custom_box_qty} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-center font-bold text-xs bg-transparent border-b border-slate-100 outline-none focus:border-sky-500" placeholder="0" />
                        </td>
                        <td className="purchase-td">
                          <input type="number" name="custom_pieces_per_box" value={item.custom_pieces_per_box} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-center font-bold text-xs bg-transparent border-b border-slate-100 outline-none focus:border-sky-500" placeholder="1" />
                        </td>
                        <td className="purchase-td">
                          <input type="number" name="custom_box_price" value={item.custom_box_price} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-center font-bold text-xs bg-transparent border-b border-slate-100 outline-none focus:border-sky-500" placeholder="0.00" />
                        </td>
                        <td className="purchase-td">
                          <input 
                            type="number" 
                            name="custom_selling_price" 
                            value={item.custom_selling_price} 
                            onChange={(e) => handleInputChange(e, idx)} 
                            onFocus={(e) => e.target.select()}
                            className="po-input !py-1 text-xs text-right font-bold text-emerald-600" 
                            placeholder="0.00"
                          />
                        </td>
                        <td className="purchase-td">
                          <input type="text" name="custom_supplier_sl_num" value={item.custom_supplier_sl_num} onChange={(e) => handleInputChange(e, idx)} className="po-input !py-1 text-xs" placeholder="Serial..." />
                        </td>
                        <td className="purchase-td">
                          <input type="date" value={item.schedule_date?.split('T')[0]} onChange={(e) => handleInputChange(e, idx)} name="schedule_date" className="po-input !py-1 text-xs" />
                        </td>
                        <td className="purchase-td text-right">
                          <input type="number" name="qty" value={item.qty} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} className="w-full text-right font-bold text-xs bg-transparent border-none outline-none focus:ring-0" />
                        </td>
                        <td className="purchase-td">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{item.uom || 'Unit'}</span>
                        </td>
                        <td className="purchase-td text-right">
                          <input 
                            type="number" 
                            name="rate" 
                            value={item.rate} 
                            onChange={(e) => handleInputChange(e, idx)} 
                            onFocus={(e) => e.target.select()}
                            className={`w-full text-right font-black text-xs bg-transparent border-none outline-none focus:ring-0 ${item.rate > item.last_buying_rate && item.last_buying_rate > 0 ? 'text-red-500' : ''}`} 
                          />
                          {item.last_buying_rate > 0 && (
                            <div className="relative">
                              <button 
                                type="button"
                                onClick={() => setShowHistoryOverlay(showHistoryOverlay === idx ? null : idx)}
                                className={`text-[9px] font-bold uppercase mt-1 px-1 rounded flex items-center gap-1 transition-colors ${item.rate > item.last_buying_rate ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 hover:bg-sky-100 hover:text-sky-600'}`}
                              >
                                Prev: {item.last_buying_rate.toFixed(2)}
                                <History size={8} />
                              </button>
                              
                              {showHistoryOverlay === idx && history[item.item_code] && (
                                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-[50] p-2 animate-fadeIn">
                                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1">Last 5 Transactions</div>
                                  <div className="space-y-1.5">
                                    {history[item.item_code].slice(0, 5).map((e, i) => (
                                      <div key={i} className="flex justify-between text-[10px] items-center">
                                        <span className="text-slate-500 font-medium truncate max-w-[80px]">{e.parent}</span>
                                        <span className="text-slate-900 font-black">AED {parseFloat(e.rate).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="purchase-td text-right">
                          <span className="text-xs font-black text-slate-900 leading-none">
                            {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="purchase-td text-center">
                          <button type="button" onClick={() => removeItemRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* History Section - Compact Mini Cards */}
            {Object.keys(history).length > 0 && (
              <div className="po-card">
                <div className="po-card-header !bg-white">
                  <h3 className="po-card-title flex items-center gap-2">
                    <History className="w-4 h-4 text-sky-500" />
                    Last Purchased Prices
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(history).map(([code, entries]) => (
                    <div key={code} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{code}</div>
                      <div className="mt-2 space-y-1.5">
                        {entries.slice(0, 2).map((e, i) => (
                          <div key={i} className="flex justify-between text-[11px] font-bold">
                            <span className="text-sky-600 truncate mr-2">{e.parent}</span>
                            <span className="text-slate-900 whitespace-nowrap">AED {parseFloat(e.rate).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

            {/* FOOTER AREA: Taxes & Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Taxes Card */}
              <div className="po-card h-fit">
                <div className="po-card-header">
                  <h3 className="po-card-title">Taxes & Charges</h3>
                </div>
                <div className="po-card-body">
                  <select
                    value={formData.taxes_and_charges || ''}
                    onChange={(e) => fetchTaxRows(e.target.value || null)}
                    className="po-input text-xs mb-4"
                  >
                    <option value="">No Tax Applied</option>
                    {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>

                  {formData.taxes.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {formData.taxes.map((tax, i) => (
                        <div key={i} className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-500 uppercase">{tax.description || 'Tax'}</span>
                          <span className="text-slate-900">AED {tax.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Final Summary Card */}
              <div className="po-summary shadow-2xl shadow-slate-400">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="po-summary-row flex-col items-start !mb-0">
                    <span className="text-[10px] uppercase opacity-60">Total Items</span>
                    <span className="text-lg font-black">{formData.items.length}</span>
                  </div>
                  <div className="po-summary-row flex-col items-start !mb-0">
                    <span className="text-[10px] uppercase opacity-60">Total Quantity</span>
                    <span className="text-lg font-black">{formData.total_qty.toFixed(2)}</span>
                  </div>
                  <div className="po-summary-row flex-col items-start !mb-0">
                    <span className="text-[10px] uppercase opacity-60">Net Amount</span>
                    <span className="text-lg font-black">AED {formData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                <div className="po-summary-total">
                  <div className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Grand Total Payable</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-400">AED {formData.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  {!formData.name && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-amber-400 text-[10px] font-bold uppercase text-center mb-4">
                      Please save draft to enable submission
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || saving || !formData.name}
                    className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${!formData.name ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-white shadow-xl shadow-sky-500/20 active:scale-95'}`}
                  >
                    {loading ? 'Submitting...' : 'Finalize Purchase Order'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrder;
