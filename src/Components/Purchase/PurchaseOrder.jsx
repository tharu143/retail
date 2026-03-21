import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package, Users,
  DollarSign, ShoppingCart, Save, Send, Trash2, Plus, Box, Scan, ChevronDown, ChevronUp, History,
  Search, File, Camera, X, Upload, Image as ImageIcon, Zap, Palette
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
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
    docstatus: 0, // 0 = Draft, 1 = Submitted
    quick_entry: false, // New: Direct Stock In
    naming_series: 'PO-' // Default naming series
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

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = '';
  const API_PATH = `/api/method/kyle_retail.retail_api.api`;
  const RESOURCE_API = `/api/resource/Purchase Order`;

  const [scanningRow, setScanningRow] = useState(null); // Track which row is scanning
  const [poTheme, setPoTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const [drafts, setDrafts] = useState([]);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  useEffect(() => {
    localStorage.setItem('legacySubTheme', poTheme);
    const primary = poTheme === 'green' ? '#10b981' : '#0ea5e9';
    const hover = poTheme === 'green' ? '#059669' : '#0284c7';
    const light = poTheme === 'green' ? '#f0fdf4' : '#f0f9ff';

    document.documentElement.style.setProperty('--po-primary', primary);
    document.documentElement.style.setProperty('--po-primary-hover', hover);
    document.documentElement.style.setProperty('--po-primary-light', light);
  }, [poTheme]);

  const handleBarcodeScan = (e, rowIndex) => {
    const value = e.target.value;
    const items = [...formData.items];
    items[rowIndex].temp_barcode = value;
    setFormData({ ...formData, items });
  };

  const handleNextFocus = (e) => {
    if (e.key === 'Enter') {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])'));
      const index = inputs.indexOf(e.target);
      if (index > -1 && index < inputs.length - 1) {
        e.preventDefault();
        const next = inputs[index + 1];
        next.focus();
        if (next.tagName === 'INPUT' && next.select) next.select();
      }
    }
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
            custom_box_qty: (items[existingIdx].custom_pieces_per_box > 0) ? Math.max(1, Math.round(updatedQty / items[existingIdx].custom_pieces_per_box)) : 1
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
            qty: piecesPerBox,
            amount: rate * piecesPerBox,
            custom_pieces_per_box: piecesPerBox,
            custom_box_price: rate * piecesPerBox,
            custom_box_qty: 1,
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

  const startCameraScanner = async () => {
    setIsScannerOpen(true);
    setTimeout(async () => {
      try {
        const videoInputDevices = await codeReader.current.listVideoInputDevices();
        const selectedDeviceId = videoInputDevices[0].deviceId;

        codeReader.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (result, err) => {
          if (result) {
            const barcode = result.getText();
            handleBarcodeEnter({ key: 'Enter', target: { value: barcode } }, formData.items.length - 1);
            stopCameraScanner();
            Swal.fire({
              icon: 'success',
              title: 'Scanned Successfully',
              text: `Item found: ${barcode}`,
              toast: true,
              position: 'top-end',
              timer: 2000,
              showConfirmButton: false
            });
          }
        });
      } catch (err) {
        console.error("Camera error:", err);
        setIsScannerOpen(false);
      }
    }, 100);
  };

  const stopCameraScanner = () => {
    codeReader.current.reset();
    setIsScannerOpen(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    decodeImage(file);
  };

  const decodeImage = async (file) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const image = new Image();
        image.src = reader.result;
        image.onload = async () => {
          try {
            const result = await codeReader.current.decodeFromImageElement(image);
            const barcode = result.getText();
            handleBarcodeEnter({ key: 'Enter', target: { value: barcode } }, formData.items.length - 1);
            stopCameraScanner();
            Swal.fire({
              icon: 'success',
              title: 'Barcode Detected',
              text: `Added: ${barcode}`,
              toast: true,
              position: 'top-end',
              timer: 2000,
              showConfirmButton: false
            });
          } catch (err) {
            Swal.fire({
              icon: 'error',
              title: 'Not Found',
              text: 'Could not find a valid barcode in this image. Please try again.',
              timer: 2000
            });
          }
        };
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image decode error:", err);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) decodeImage(file);
  };

  const fetchDraftPOs = async () => {
    try {
      setLoadingDrafts(true);
      const res = await fetch(`${RESOURCE_API}?filters=[["docstatus","=",0],["company","=","${encodeURIComponent(formData.company)}"]]&fields=["name","supplier","grand_total","transaction_date"]&order_by=creation desc&limit=20`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const data = await res.json();
      setDrafts(data.data || []);
    } catch (err) {
      console.error('Drafts fetch error:', err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const loadDraft = async (draftName) => {
    try {
      setLoading(true);
      const res = await fetch(`${RESOURCE_API}/${draftName}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load draft');
      const data = await res.json();
      const draft = data.data;

      // Map Frappe doc to local formData state
      setFormData({
        name: draft.name,
        supplier: { name: draft.supplier, supplier_name: draft.supplier }, // Basic map
        transaction_date: draft.transaction_date,
        company: draft.company,
        currency: draft.currency || 'AED',
        conversion_rate: 1.0,
        set_warehouse: draft.set_warehouse,
        items: (draft.items || []).map(it => ({
          ...POItemModel,
          ...it,
          custom_box_qty: parseFloat(it.custom_box_qty) || 0,
          custom_pieces_per_box: parseFloat(it.custom_pieces_per_box) || 1,
          custom_box_price: parseFloat(it.custom_box_price) || 0,
          custom_selling_price: parseFloat(it.custom_selling_price) || 0,
          qty: parseFloat(it.qty) || 0,
          rate: parseFloat(it.rate) || 0,
          amount: parseFloat(it.amount) || 0,
        })),
        total_qty: parseFloat(draft.total_qty) || 0,
        total: parseFloat(draft.total) || 0,
        taxes_and_charges: draft.taxes_and_charges,
        taxes: draft.taxes || [],
        tax_total: parseFloat(draft.total_taxes_and_charges) || 0,
        grand_total: parseFloat(draft.grand_total) || 0,
        docstatus: 0,
        quick_entry: false,
        naming_series: draft.naming_series || 'PO-'
      });
      setIsEditMode(true);
      setShowDraftsList(false);
      setSuccess(`Draft loaded: ${draftName}`);
    } catch (err) {
      setError(`Failed to load draft: ${err.message}`);
    } finally {
      setLoading(false);
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
      const whList = data.message || [];
      setWarehouses(whList);

      // Auto-select first warehouse if none set
      if (whList.length > 0 && !formData.set_warehouse) {
        setFormData(prev => ({ ...prev, set_warehouse: whList[0].name }));
      }
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const fetchTaxTemplates = async () => {
    try {
      // Step 1: Get templates for the company
      const res = await fetch(`${API_PATH}.get_purchase_tax_templates?company=${encodeURIComponent(formData.company)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTaxTemplates(data.message || []);
    } catch (err) {
      console.error('Tax templates error:', err);
    }
  };

  const onTaxChange = async (templateName) => {
    if (!templateName) {
      setFormData(prev => ({
        ...prev,
        taxes_and_charges: null,
        taxes: [],
        ...calculateTotals(prev.items, [])
      }));
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_PATH}.get_tax_template_details?template_name=${encodeURIComponent(templateName)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch details');
      const data = await res.json();

      // Robustly handle both array messages and object messages with a 'taxes' key
      const templateDetails = Array.isArray(data.message)
        ? data.message
        : (data.message?.taxes || (data.message ? [data.message] : []));

      setFormData(prev => {
        const totals = calculateTotals(prev.items, templateDetails);
        return {
          ...prev,
          taxes_and_charges: templateName,
          taxes: templateDetails,
          ...totals
        };
      });
    } catch (err) {
      console.error('Tax loading failed:', err);
      // Fallback: update naming only
      setFormData(prev => ({ ...prev, taxes_and_charges: templateName }));
    } finally {
      setLoading(false);
    }
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
            item.custom_box_price = parseFloat((item.rate * (item.custom_pieces_per_box || 1)).toFixed(2));
          } else {
            item.custom_box_qty = (item.custom_pieces_per_box > 0) ? Math.floor(item.qty / item.custom_pieces_per_box) : 0;
          }
        } else if (['custom_box_qty', 'custom_pieces_per_box', 'custom_box_price', 'custom_selling_price'].includes(name)) {
          // Task: Box Qty must always be a whole number
          const finalVal = name === 'custom_box_qty' ? Math.round(val) : parseFloat(parseFloat(val).toFixed(2));
          item[name] = finalVal === '' ? 0 : finalVal;

          if (name === 'custom_box_price') {
            item.rate = parseFloat((item.custom_box_price / (item.custom_pieces_per_box || 1)).toFixed(2));
          } else if (name === 'custom_box_qty') {
            const boxQty = parseInt(val) || 0;
            item.custom_box_qty = boxQty;
            item.qty = parseFloat((boxQty * (item.custom_pieces_per_box || 1)).toFixed(2));
          } else if (name === 'custom_pieces_per_box') {
            const pPerBox = parseFloat(parseFloat(val).toFixed(2)) || 1;
            item.custom_pieces_per_box = pPerBox;
            item.qty = parseFloat(((item.custom_box_qty || 0) * pPerBox).toFixed(2));
            item.custom_box_price = parseFloat((item.rate * pPerBox).toFixed(2));
          }
          item.amount = parseFloat(((item.qty || 0) * (item.rate || 0)).toFixed(2));
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
    // CRITICAL FIX: Ensure taxes is always an array before mapping
    const taxArray = Array.isArray(taxes) ? taxes : [];

    const updatedTaxes = taxArray.map(tax => {
      let taxAmt = 0;
      const rate = parseFloat(tax.rate) || 0;
      const chargeType = tax.charge_type || 'On Net Total';

      if (chargeType === "Actual") {
        taxAmt = rate;
      } else {
        // Default to percentage check (On Net Total OR On Previous Row Amount simplified for now)
        taxAmt = (netTotal * rate) / 100;
      }

      if (tax.add_deduct_tax === "Deduct") {
        taxesTotal -= taxAmt;
      } else {
        taxesTotal += taxAmt;
      }
      return { ...tax, tax_amount: parseFloat(taxAmt.toFixed(4)) };
    });

    return {
      total_qty: parseFloat(totalQty.toFixed(2)),
      total: parseFloat(netTotal.toFixed(2)),
      tax_total: parseFloat(taxesTotal.toFixed(2)),
      taxes: updatedTaxes,
      grand_total: parseFloat((netTotal + taxesTotal).toFixed(2))
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
          custom_box_price: parseFloat(item.custom_box_price || 0),
          custom_selling_price: parseFloat(item.custom_selling_price || 0),
          new_selling_price: parseFloat(item.custom_selling_price || 0),
          custom_ref_sl_no: item.custom_ref_sl_no || "",
          custom_supplier_sl_num: item.custom_ref_sl_no || ""
        })),
        taxes_and_charges: formData.taxes_and_charges,
        taxes: (formData.taxes || []).map(t => ({
          charge_type: t.charge_type,
          account_head: t.account_head,
          rate: parseFloat(t.rate),
          tax_amount: parseFloat(t.tax_amount),
          description: t.description || t.account_head
        })),
        total: parseFloat(formData.total),
        tax_total: parseFloat(formData.tax_total),
        total_qty: parseFloat(formData.total_qty),
        grand_total: parseFloat(formData.grand_total),
        naming_series: formData.naming_series || 'PO-'
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
      const updatedDoc = data.data || data.message;
      const docName = updatedDoc?.name;

      if (updatedDoc) {
        setFormData(prev => ({
          ...prev,
          name: docName,
          docstatus: 0,
          taxes: updatedDoc.taxes || prev.taxes,
          grand_total: parseFloat(updatedDoc.grand_total || 0),
          tax_total: parseFloat(updatedDoc.total_taxes_and_charges || updatedDoc.tax_total || 0),
          total: parseFloat(updatedDoc.total || updatedDoc.net_total || 0)
        }));
      }
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
      if (formData.quick_entry) {
        // --- 1. QUICK STOCK IN FLOW ---
        const payload = {
          supplier: formData.supplier?.name || formData.supplier,
          company: formData.company,
          warehouse: formData.set_warehouse,
          entry_type: 'Purchase',
          taxes_and_charges: formData.taxes_and_charges || '',
          taxes: formData.taxes || [],
          total: formData.total,
          tax_total: formData.tax_total,
          total_qty: formData.total_qty,
          grand_total: formData.grand_total,
          supplier_sl_no: formData.items[0]?.custom_ref_sl_no || '',
          custom_supplier_sl_num: formData.items[0]?.custom_ref_sl_no || '',
          items: formData.items.filter(it => it.item_code).map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            box_qty: parseFloat(item.custom_box_qty) || 0,
            pcs_per_box: parseFloat(item.custom_pieces_per_box) || 1,
            purchase_price: parseFloat(item.custom_box_price) || 0,
            new_selling_price: parseFloat(item.custom_selling_price) || 0,
            qty: item.qty,
            uom: item.uom,
            valuation_rate: item.rate,
            custom_ref_sl_no: item.custom_ref_sl_no || '',
            custom_supplier_sl_num: item.custom_ref_sl_no || ''
          })),
        };

        const res = await (await import('../../utils/posService')).default.submitPurchaseEntry(payload);

        if (res?.status === 'success' || res?.po || res?.name) {
          // Update state with backend calculated totals
          if (res.grand_total || res.taxes) {
            setFormData(prev => ({
              ...prev,
              taxes: res.taxes || prev.taxes,
              grand_total: parseFloat(res.grand_total || 0),
              tax_total: parseFloat(res.total_taxes_and_charges || res.tax_total || 0),
              total: parseFloat(res.total || res.net_total || 0),
              docstatus: 1
            }));
          } else {
            setFormData(prev => ({ ...prev, docstatus: 1 }));
          }

          setSuccess(`Quick Stock In Completed! PO: ${res.po || ''}, PR: ${res.pr || res.name || ''}, PI: ${res.pi || ''}`);
          Swal.fire({
            icon: 'success',
            title: 'Quick Entry Success',
            text: 'Stock has been updated across all documents.',
            timer: 3000
          });
        } else {
          throw new Error(res?.message || 'Quick Entry failed');
        }
      } else {
        // --- 2. STANDARD PO FLOW ---
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
      }

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
      if (type === 'both') {
        const types = ['receipt', 'invoice'];
        let results = [];
        for (const t of types) {
          const endpoint = t === 'receipt' ? 'create_purchase_receipt_from_po' : 'create_purchase_invoice_from_po';
          const body = {
            po_name: formData.name,
            company: formData.company,
            supplier: formData.supplier?.name || formData.supplier,
            posting_date: new Date().toISOString().slice(0, 10),
            set_warehouse: formData.set_warehouse,
            taxes_and_charges: formData.taxes_and_charges,
            taxes: formData.taxes,
            total: formData.total,
            tax_total: formData.tax_total,
            total_qty: formData.total_qty,
            grand_total: formData.grand_total,
            items: formData.items.filter(i => i.item_code).map(item => ({
              item_code: item.item_code,
              item_name: item.item_name,
              qty: item.qty,
              uom: item.uom,
              rate: item.rate,
              amount: item.amount,
              purchase_order: formData.name,
              custom_box_qty: item.custom_box_qty,
              custom_pieces_per_box: item.custom_pieces_per_box,
              custom_box_price: item.custom_box_price,
              custom_selling_price: item.custom_selling_price,
              new_selling_price: item.custom_selling_price,
              custom_ref_sl_no: item.custom_ref_sl_no,
              custom_supplier_sl_num: item.custom_ref_sl_no
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
            results.push(`${t === 'receipt' ? 'Receipt' : 'Invoice'}: ${apiResp.name}`);
          } else {
            throw new Error(apiResp.message || `Failed to create ${t}`);
          }
        }
        setSuccess(`Successfully created: ${results.join(' & ')}`);
        setCreatedDocName('BOTH_CREATED');
      } else {
        const endpoint = type === 'receipt' ? 'create_purchase_receipt_from_po' : 'create_purchase_invoice_from_po';
        const body = {
          po_name: formData.name,
          posting_date: new Date().toISOString().slice(0, 10),
          set_warehouse: formData.set_warehouse,
          items: formData.items.filter(i => i.item_code).map(item => ({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: item.qty,
            uom: item.uom,
            rate: item.rate,
            amount: item.amount,
            purchase_order: formData.name,
            custom_box_qty: item.custom_box_qty,
            custom_pieces_per_box: item.custom_pieces_per_box,
            custom_box_price: item.custom_box_price,
            custom_selling_price: item.custom_selling_price,
            new_selling_price: item.custom_selling_price,
            custom_ref_sl_no: item.custom_ref_sl_no,
            custom_supplier_sl_num: item.custom_ref_sl_no
          }))
        };
        body.company = formData.company;
        body.supplier = formData.supplier?.name || formData.supplier;
        body.taxes_and_charges = formData.taxes_and_charges;
        body.taxes = formData.taxes;
        body.total = formData.total;
        body.tax_total = formData.tax_total;
        body.total_qty = formData.total_qty;
        body.grand_total = formData.grand_total;


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
          qty: pPerBox,
          amount: rate * pPerBox,
          custom_box_price: rate * pPerBox,
          custom_box_qty: 1,
          temp_barcode: '',
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
    <>
      <div className={`font-sans purchase-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
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
              onClick={() => setPoTheme(prev => prev === 'green' ? 'blue' : 'green')}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-tight text-slate-500 hover:bg-white transition-all focus:ring-0"
              title="Toggle Theme Color"
            >
              <Palette className={`w-3.5 h-3.5 ${poTheme === 'green' ? 'text-emerald-500' : 'text-sky-500'}`} />
            </button>

            <div className="h-6 w-px bg-slate-100 mx-1" />

            <div className="flex items-center gap-2 mr-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-pointer" onClick={() => setFormData(p => ({ ...p, quick_entry: !p.quick_entry }))}>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.quick_entry ? 'bg-[var(--po-primary)]' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${formData.quick_entry ? 'left-4.5' : 'left-0.5'}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-tight ${formData.quick_entry ? 'text-[var(--po-primary)]' : 'text-slate-400'}`}>
                {formData.quick_entry ? 'Direct Stock In ON' : 'Standard PO Only'}
              </span>
              {formData.quick_entry && <Zap className="w-3 h-3 text-[var(--po-primary)] animate-pulse ml-1" />}
            </div>

            {formData.docstatus === 0 && !formData.name && !formData.quick_entry && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || loading}
                className="po-btn-secondary"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Draft
              </button>
            )}

            {(formData.name || formData.quick_entry || formData.docstatus === 1) && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || saving || !formData.supplier || formData.items.filter(i => i.item_code).length === 0 || formData.docstatus === 1}
                className={`po-btn-primary px-6 ${formData.quick_entry ? '!bg-[var(--po-primary)] border-[var(--po-primary)]' : ''}`}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {formData.docstatus === 1 ? 'Submitted' : (formData.quick_entry ? 'ZAP! Quick Stock In' : 'Submit')}
              </button>
            )}
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
            <div className="mb-8 border-l-4 border-[var(--po-primary)] bg-white shadow-sm p-6 animate-fadeIn">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="w-6 h-6 text-[var(--po-primary)]" />
                  <div>
                    <h4 className="text-base font-bold text-slate-900 leading-tight">{success}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">Transaction processed successfully</p>
                  </div>
                </div>

                {!createdDocName && formData.docstatus === 1 && (
                  <div className="flex gap-3">
                    <button onClick={() => handleCreateFlow('both')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:translate-y-0.5 flex items-center gap-2">
                      <Zap size={14} className="fill-white" /> Create PR & PI (OneClick)
                    </button>
                    <div className="w-[1px] h-10 bg-slate-200 mx-1"></div>
                    <button onClick={() => handleCreateFlow('receipt')} className="px-4 py-2 bg-[var(--po-primary-light)] text-[var(--po-primary)] border border-[var(--po-primary-light)] rounded-lg text-xs font-bold uppercase hover:bg-[var(--po-primary)] hover:text-white transition-all">
                      Create Receipt
                    </button>
                    <button onClick={() => handleCreateFlow('invoice')} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold uppercase hover:bg-slate-900 hover:text-white transition-all">
                      Create Invoice
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="po-card lg:col-span-4">
                  <div className="po-card-header">
                    <h3 className="po-card-title flex items-center gap-2">
                      <Users className="w-4 h-4 text-[var(--po-primary)]" />
                      Supplier Information
                    </h3>
                  </div>
                  <div className="po-card-body grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="po-label">Series</label>
                      <select
                        name="naming_series"
                        value={formData.naming_series}
                        onChange={handleInputChange}
                        onKeyDown={handleNextFocus}
                        className="po-input font-bold text-[var(--po-primary)]"
                      >
                        <option value="PUR-ORD-.YYYY.-">PUR-ORD-.YYYY.-</option>
                      </select>
                    </div>
                    <div>
                      <label className="po-label">Supplier / Vendor</label>
                      <div onKeyDown={handleNextFocus}>
                        <CustomSearchDropdown
                          placeholder="Search supplier..."
                          value={formData.supplier}
                          onSelect={handleSupplierSelect}
                          fetchData={fetchSuppliers}
                          createOption={handleSupplierCreate}
                          optionsLabel="supplier_name"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="po-card lg:col-span-8">
                  <div className="po-card-header">
                    <h3 className="po-card-title flex items-center gap-2">
                      <Package className="w-4 h-4 text-[var(--po-primary)]" />
                      Logistics & Metadata
                    </h3>
                  </div>
                  <div className="po-card-body grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="po-label">Warehouse (Target)</label>
                      <select name="set_warehouse" value={formData.set_warehouse} onChange={handleInputChange} onKeyDown={handleNextFocus} className="po-input font-bold">
                        <option value="">Choose warehouse...</option>
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
                      <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase h-[42px] flex items-center">
                        {formData.company}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="po-card">
                <div className="po-card-header">
                  <h3 className="po-card-title">Product Inventory Basket</h3>
                </div>

                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 bg-white">
                  <div className="relative flex-1 group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#10b981] transition-colors">
                      <Scan className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Enter Barcode / Scan here..."
                      className="w-full pl-10 pr-12 h-[42px] bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#10b981] focus:bg-white transition-all shadow-sm"
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
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#10b981] hover:bg-emerald-50 rounded-lg transition-all"
                      title="Start Camera Scanner"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" onClick={addItemRow} className="po-btn-secondary h-[42px] px-8 rounded-xl flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                </div>

                {isScannerOpen && createPortal(
                  <div
                    className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fadeIn"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className={`relative w-full max-w-lg aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border-4 transition-all duration-300 ${isDragging ? 'border-emerald-500 scale-105 ring-4 ring-emerald-500/20' : 'border-emerald-500/30'}`}>
                      {isDragging ? (
                        <div className="absolute inset-0 bg-emerald-600/40 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-pulse">
                          <Upload className="w-16 h-16 text-white mb-4" />
                          <p className="text-white font-bold text-lg uppercase tracking-widest">Drop Image to Scan</p>
                        </div>
                      ) : (
                        <>
                          <video ref={videoRef} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none flex items-center justify-center">
                            <div className="w-full h-full border-2 border-emerald-400/50 relative">
                              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] absolute animate-scanLine" />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="absolute top-4 right-4 flex gap-2">
                        <label className="w-10 h-10 bg-white/10 hover:bg-emerald-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20 cursor-pointer group" title="Upload Image">
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </label>
                        <button
                          onClick={stopCameraScanner}
                          className="w-10 h-10 bg-white/10 hover:bg-red-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                        <div className="text-white bg-emerald-600/80 backdrop-blur-md px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg whitespace-nowrap">
                          {isDragging ? 'Release to Scan' : 'Align Barcode or Drop Image'}
                        </div>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                <div className="purchase-table-container">
                  <table className="purchase-table">
                    <thead>
                      <tr>
                        <th className="purchase-th !pl-3 w-[140px] text-center">Scanner</th>
                        <th className="purchase-th min-w-[240px]">Item Description</th>
                        <th className="purchase-th w-[90px] text-center">Box Qty</th>
                        <th className="purchase-th w-[90px] text-center">Pcs/Box</th>
                        <th className="purchase-th w-[140px] text-center">Box Price</th>
                        <th className="purchase-th w-[140px] text-center">Selling Price</th>
                        <th className="purchase-th w-[120px] text-center">Ref / SL #</th>
                        <th className="purchase-th w-[100px] text-center">Qty</th>
                        <th className="purchase-th w-[80px] text-center">UOM</th>
                        <th className="purchase-th w-[140px] text-center">Rate</th>
                        <th className="purchase-th w-[170px] text-center !pr-3">Subtotal</th>
                        <th className="purchase-th w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                          <td className="purchase-td !pl-5">
                            <input
                              type="text"
                              value={item.temp_barcode ?? ''}
                              placeholder="Barcode"
                              onChange={(e) => handleBarcodeScan(e, idx)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value) {
                                  handleBarcodeEnter(e, idx);
                                } else {
                                  handleNextFocus(e);
                                }
                              }}
                              className="w-full text-[11px] font-bold outline-none"
                            />
                          </td>
                          <td className="purchase-td">
                            <div className="relative product-search-container">
                              <input
                                type="text"
                                value={item.item_name ?? ''}
                                placeholder="Search product..."
                                onFocus={async (e) => {
                                  const q = e.target.value;
                                  const results = await fetchItems(q);
                                  setAllItems(results || []);
                                  setActiveDropdownRow(idx);
                                  setSelectedProductIndex(0);
                                  const rect = e.target.getBoundingClientRect();
                                  setDropdownPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                                }}
                                onBlur={() => setTimeout(() => setActiveDropdownRow(null), 200)}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedProductIndex(prev => (prev < allItems.length - 1 ? prev + 1 : prev));
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedProductIndex(prev => (prev > 0 ? prev - 1 : 0));
                                  } else if (e.key === 'Enter') {
                                    if (activeDropdownRow !== null && allItems[selectedProductIndex]) {
                                      e.preventDefault();
                                      handleItemSelect(allItems[selectedProductIndex], idx);
                                      setActiveDropdownRow(null);
                                    } else {
                                      handleNextFocus(e);
                                    }
                                  }
                                }}
                                onChange={async (e) => {
                                  const q = e.target.value;
                                  setFormData(prev => {
                                    const its = [...prev.items];
                                    its[idx] = { ...its[idx], item_name: q };
                                    return { ...prev, items: its };
                                  });
                                  const results = await fetchItems(q);
                                  setAllItems(results || []);
                                  setActiveDropdownRow(idx);
                                  setSelectedProductIndex(0);
                                  const rect = e.target.getBoundingClientRect();
                                  setDropdownPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
                                }}
                              />
                              {activeDropdownRow === idx && dropdownPosition && allItems.length > 0 && createPortal(
                                <div ref={dropdownRef} className="absolute bg-white border border-slate-200 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto min-w-[300px] product-dropdown-portal" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
                                  {allItems.map((it, i) => (
                                    <div 
                                      key={it.item_code} 
                                      onMouseDown={(e) => { 
                                        e.preventDefault(); // Prevent blur
                                        handleItemSelect(it, idx); 
                                        setActiveDropdownRow(null); 
                                      }} 
                                      className={`px-4 py-2.5 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors ${selectedProductIndex === i ? 'bg-[var(--po-primary-light)]' : 'hover:bg-slate-50'}`}
                                    >
                                      <div className="flex justify-between items-center gap-3">
                                        <div className={`text-[11px] font-bold ${selectedProductIndex === i ? 'text-[var(--po-primary)]' : 'text-slate-800'}`}>{it.item_name}</div>
                                        <div className="text-[9px] font-bold text-[#003d7c] bg-slate-100 px-1.5 py-0.5 rounded italic opacity-70 group-hover:opacity-100">{it.item_code}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>, document.body
                              )}
                            </div>
                          </td>
                          <td className="purchase-td">
                            <input type="number" name="custom_box_qty" step="1" value={item.custom_box_qty ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-center font-bold" />
                          </td>
                          <td className="purchase-td">
                            <input type="number" name="custom_pieces_per_box" step="1" value={item.custom_pieces_per_box ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-center" />
                          </td>
                          <td className="purchase-td text-right">
                            <input type="number" name="custom_box_price" step="0.01" value={item.custom_box_price ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-right" />
                          </td>
                          <td className="purchase-td text-right">
                            <input type="number" name="custom_selling_price" step="0.01" value={item.custom_selling_price ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-right !text-[var(--po-primary)]" />
                          </td>
                          <td className="purchase-td">
                            <input type="text" name="custom_ref_sl_no" value={item.custom_ref_sl_no ?? ''} onChange={(e) => handleInputChange(e, idx)} onKeyDown={handleNextFocus} placeholder="Serial..." className="w-full text-center text-[10px]" />
                          </td>
                          <td className="purchase-td text-center">
                            <input type="number" name="qty" step="0.01" value={item.qty ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-right" />
                          </td>
                          <td className="purchase-td text-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{item.uom ?? 'UNIT'}</span>
                          </td>
                          <td className="purchase-td text-right !text-center">
                            <input type="number" name="rate" step="0.01" value={item.rate ?? ''} onChange={(e) => handleInputChange(e, idx)} onFocus={(e) => e.target.select()} onKeyDown={handleNextFocus} className="w-full text-center" />
                          </td>
                          <td className="purchase-td text-right !pr-5 !text-center">
                            <span className="text-xs font-bold text-slate-900 tabular-nums">
                              {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: item.amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}
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
                    <select value={formData.taxes_and_charges || ''} onChange={(e) => onTaxChange(e.target.value)} onKeyDown={handleNextFocus} className="summary-select focus:border-[#10b981]">
                      <option value="">No Tax Schedule...</option>
                      {taxTemplates.map((t) => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="flex gap-10">
                    <div className="text-center">
                      <span className="summary-label">Total Qty</span>
                      <p className="detail-value text-[var(--po-primary)] font-black">{(formData.total_qty || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <span className="summary-label">Tax</span>
                      <p className="detail-value text-[var(--po-primary)] font-black">{(formData.tax_total || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <span className="summary-label">Gross Total</span>
                      <p className="detail-value text-[var(--po-primary)] font-black">{(formData.total || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="summary-section grand-total-section border-l border-slate-200 pl-12">
                    <div className="text-right">
                      <span className="summary-label block">Grand Total</span>
                      <p className="grand-total-value"><span className="currency-label-large">AED</span> {(formData.grand_total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drafts List Sidebar/Overlay */}
      {showDraftsList && createPortal(
        <div className="fixed inset-0 z-[10001] bg-slate-900/40 backdrop-blur-[2px] flex justify-end animate-fadeIn">
          <div className="w-[400px] h-full bg-white shadow-2xl flex flex-col animate-slideLeft">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 font-sans">
                  <History className="w-5 h-5 text-orange-600" />
                  Resume Drafts
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 font-sans">Found {drafts.length} incomplete orders</p>
              </div>
              <button onClick={() => setShowDraftsList(false)} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingDrafts ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                  <span className="text-xs font-bold uppercase font-sans">Fetching Drafts...</span>
                </div>
              ) : drafts.length > 0 ? (
                drafts.map(d => (
                  <div
                    key={d.name}
                    onClick={() => loadDraft(d.name)}
                    className="p-5 border border-slate-100 rounded-2xl hover:border-orange-500 hover:bg-orange-50/30 cursor-pointer transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-black text-slate-900 group-hover:text-orange-600 transition-colors font-sans">{d.name}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold font-sans">
                        {new Date(d.transaction_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={12} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600 font-sans">{d.supplier || 'No Supplier'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-sans">
                        <DollarSign size={13} className="text-emerald-500" />
                        <span className="text-sm font-black text-slate-800">{d.grand_total?.toLocaleString()} AED</span>
                      </div>
                      <div className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-black text-orange-600 uppercase group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm font-sans">
                        Resume Order
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 font-sans">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 font-sans">
                    <FileText className="w-8 h-8 text-slate-300 font-sans" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">No Drafts Found</h3>
                  <p className="text-xs text-slate-500 mt-1 font-sans">Start a new purchase order to see it here later.</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default PurchaseOrder;
