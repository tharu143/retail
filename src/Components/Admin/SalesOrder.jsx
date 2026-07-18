// src/Components/Admin/SalesOrder.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Package, Loader2,
  ChevronLeft, ChevronRight, X, Search, ScanLine, Palette, Zap, Camera, Settings
} from 'lucide-react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import './SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';

const DEFAULT_SO_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
  { id: 'custom_ref_sl_no', label: 'Ref / Customer SL #', visible: true, width: 120 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price', visible: true, width: 90 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 }
];

const SOItemModel = {
  item_code: '',
  item_name: '',
  rate: 0,
  amount: 0,
  custom_ref_sl_no: '',
  custom_box_qty: 0,
  custom_pieces_per_box: 1,
  custom_box_price: 0,
  use_box_entry: false,
  uom_list: [],
  custom_selling_price: 0
};

const loadColumnConfig = () => {
  try {
    const saved = localStorage.getItem('sales_matrix_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaultIds = DEFAULT_SO_COLUMNS.map(c => c.id);
      const savedIds = parsed.map(c => c.id);
      const existing = parsed.filter(c => defaultIds.includes(c.id));
      const missing = DEFAULT_SO_COLUMNS.filter(c => !savedIds.includes(c.id));
      return [...existing, ...missing];
    }
  } catch (e) {
    console.error("SO Matrix Config Error:", e);
  }
  return DEFAULT_SO_COLUMNS;
};

const API_PATH_K = '/api/method/kyle_retail.retail_api.api';
const API_PATH_C = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const API_PATH = API_PATH_K;
const RESOURCE_BASE = '/api/resource';

/* ------------------------------------------------------------------ */
/* Recalculation                                                        */
/* ------------------------------------------------------------------ */
function recalcForm(form) {
  const items = form.items || [];
  const taxes = form.taxes || [];

  const total_qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
  const base_total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  let total_taxes = 0;
  let prev_total = base_total;

  const updatedTaxes = taxes.map(tax => {
    const rate = parseFloat(tax.rate) || 0;
    let taxAmount = 0;
    if (tax.charge_type === 'Actual') {
      taxAmount = parseFloat(tax.tax_amount) || 0;
    } else if (tax.charge_type === 'On Previous Row Amount') {
      taxAmount = prev_total * (rate / 100);
    } else {
      taxAmount = base_total * (rate / 100);
    }
    const signed = tax.add_deduct_tax === 'Add' ? taxAmount : -taxAmount;
    total_taxes += signed;
    prev_total += signed;
    return {
      ...tax,
      tax_amount: tax.charge_type === 'Actual' ? parseFloat(tax.tax_amount || 0) : parseFloat(taxAmount.toFixed(3)),
      total: signed.toFixed(3),
    };
  });

  const net = base_total + total_taxes;
  const disc_perc = parseFloat(form.additional_discount_percentage) || 0;
  const disc_amt = parseFloat(form.discount_amount) || 0;
  const discount = form.apply_discount_on === 'Grand Total'
    ? (net * disc_perc / 100) + disc_amt
    : (base_total * disc_perc / 100) + disc_amt;

  const grand_total = net - discount;
  const rounded_total = Math.round(grand_total * 100) / 100;

  return {
    ...form,
    total_qty,
    base_total,
    total: base_total,
    total_taxes_and_charges: parseFloat(total_taxes.toFixed(2)),
    grand_total: parseFloat(grand_total.toFixed(2)),
    rounded_total: parseFloat(rounded_total.toFixed(2)),
    rounding_adjustment: parseFloat((rounded_total - grand_total).toFixed(2)),
    taxes: updatedTaxes,
  };
}

const emptyForm = () => ({
  naming_series: 'SAL-ORD-.YYYY.-',
  transaction_date: new Date().toISOString().split('T')[0],
  delivery_date: '',
  customer: '',
  customer_name: '',
  order_type: 'Sales',
  currency: 'AED',
  selling_price_list: 'Standard Selling',
  price_list_currency: 'AED',
  items: [],
  taxes_and_charges: '',
  taxes: [],
  apply_discount_on: 'Grand Total',
  additional_discount_percentage: 0,
  discount_amount: 0,
  total_qty: 0,
  base_total: 0,
  total: 0,
  total_taxes_and_charges: 0,
  grand_total: 0,
  rounding_adjustment: 0,
  rounded_total: 0,
});

/* ------------------------------------------------------------------ */
function SalesOrder() {
  const { warehouse } = useSelector((state) => state.user);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const html5QrcodeRef = useRef(null);
  const scannerBuffer = useRef("");
  const lastKeyTime = useRef(0);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDocName, setEditingDocName] = useState(null);
  const [linkedDocs, setLinkedDocs] = useState({});
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // Columns Matrix Configuration
  const [soColumns, setSoColumns] = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      setSoColumns(DEFAULT_SO_COLUMNS);
      localStorage.removeItem('sales_matrix_config');
    } else {
      setSoColumns(newConfig);
      localStorage.setItem('sales_matrix_config', JSON.stringify(newConfig));
    }
    setShowColConfig(false);
  };

  const fetchItemUOMs = async (item_code) => {
    try {
      const res = await fetch(`/api/resource/Item/${encodeURIComponent(item_code)}?fields=["uoms","stock_uom"]`, {
        headers: { 'X-Frappe-SID': localStorage.getItem('session') || '' },
        credentials: 'include'
      });
      if (!res.ok) return [{ uom: 'Nos', conversion_factor: 1 }, { uom: 'Box', conversion_factor: 0 }];
      const data = await res.json();
      const doc = data.data || {};
      const uomRows = doc.uoms || [];
      const list = uomRows.map(u => ({ uom: u.uom, conversion_factor: parseFloat(u.conversion_factor) || 1 }));

      const stockUom = doc.stock_uom || 'Nos';
      if (!list.find(u => u.uom === stockUom)) {
        list.unshift({ uom: stockUom, conversion_factor: 1 });
      }

      if (!list.find(u => (u.uom || '').toLowerCase() === "nos")) {
        list.push({ uom: "Nos", conversion_factor: 1 });
      }
      if (!list.find(u => (u.uom || '').toLowerCase() === "box")) {
        list.push({ uom: "Box", conversion_factor: 0 });
      }
      return list;
    } catch (err) {
      return [{ uom: 'Nos', conversion_factor: 1 }, { uom: 'Box', conversion_factor: 0 }];
    }
  };

  const handleUOMChange = (uomValue, rowIndex) => {
    setForm(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[rowIndex] };
      const isBox = uomValue.toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((item.rate || 0) * pPerBox).toFixed(2));
      } else {
        item.custom_pieces_per_box = 1;
        item.qty = parseFloat(item.custom_box_qty) || 0;
        item.custom_box_price = item.rate || 0;
      }
      item.amount = (item.qty || 0) * (item.rate || 0);
      items[rowIndex] = item;
      return recalcForm({ ...prev, items });
    });
  };

  const handleInputChange = (e, rowIndex) => {
    const { name, value } = e.target;
    setForm(prev => {
      const items = [...(prev.items || [])];
      const item = { ...items[rowIndex] };
      item[name] = value;

      const val = (value === '' || value === '.') ? 0 : parseFloat(value);
      const isBoxMode = item.use_box_entry;

      if (name === 'qty' || name === 'rate') {
        const q = name === 'qty' ? val : (parseFloat(item.qty) || 0);
        const r = name === 'rate' ? val : (parseFloat(item.rate) || 0);
        item.amount = parseFloat((q * r).toFixed(2));

        if (name === 'rate') {
          item.custom_box_price = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
        } else if (name === 'qty') {
          item.custom_box_qty = (item.custom_pieces_per_box > 0) ? parseFloat((val / item.custom_pieces_per_box).toFixed(2)) : 0;
        }
      } else if (name === 'custom_box_qty') {
        if (isBoxMode) {
          item.qty = parseFloat((val * (item.custom_pieces_per_box || 1)).toFixed(2));
        } else {
          item.qty = val;
        }
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_pieces_per_box') {
        const pPerBox = Math.max(1, isNaN(val) ? 1 : val);
        item.qty = parseFloat(((parseFloat(item.custom_box_qty) || 0) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((parseFloat(item.rate) || 0) * pPerBox).toFixed(2));
        item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
      } else if (name === 'custom_box_price') {
        item.rate = parseFloat((val / (item.custom_pieces_per_box || 1)).toFixed(2));
        item.amount = parseFloat(((parseFloat(item.qty) || 0) * item.rate).toFixed(2));
      }

      items[rowIndex] = item;
      return recalcForm({ ...prev, items });
    });
  };

  const [soTheme, setSoTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = soTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', soTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [soTheme, themeColor, themeColorHover, themeLight]);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [form, setForm] = useState({ ...emptyForm(), selling_price_list: 'Standard Selling' });
  
  useEffect(() => {
    if (warehouse) {
      // Determine Price List from Warehouse name convention
      const branchName = warehouse.split(' Warehouse')[0];
      const pl = `${branchName} Selling`;
      // We set it as default, but backend will also check POS Profile
      setForm(prev => ({ ...prev, selling_price_list: pl }));
    }
  }, [warehouse]);

  // Camera scanner start/stop logic
  useEffect(() => {
    if (showCamera) {
      const html5Qrcode = new Html5Qrcode("so-scanner-reader");
      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: (width, height) => {
          const boxWidth = Math.min(width * 0.8, 450);
          const boxHeight = Math.min(height * 0.6, 250);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.777778
      };

      const formats = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE
      ];

      html5Qrcode.start(
        { facingMode: "environment" },
        { ...config, formatsToSupport: formats },
        (decodedText) => {
          if (showCamera) {
            handleBarcodeScanDirect(decodedText.trim());
            setShowCamera(false);
            html5Qrcode.stop().catch(err => console.error("Error stopping camera on success:", err));
          }
        },
        () => {}
      ).catch(err => {
        console.error("Camera start failed, trying fallback:", err);
        html5Qrcode.start(
          { deviceId: undefined },
          { ...config, formatsToSupport: formats },
          (decodedText) => {
            if (showCamera) {
              handleBarcodeScanDirect(decodedText.trim());
              setShowCamera(false);
              html5Qrcode.stop().catch(fallbackErr => console.error("Error stopping fallback camera success:", fallbackErr));
            }
          },
          () => {}
        ).catch(finalErr => {
          console.error("All startup options failed:", finalErr);
          Swal.fire('Camera Error', 'Could not start camera barcode scanner.', 'error');
          setShowCamera(false);
        });
      });
    }

    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().catch(err => console.error("Error during stop cleanup:", err));
        }
      }
    };
  }, [showCamera, warehouse]);

  // Global hardware barcode scanner interceptor
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const now = Date.now();
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

      if (now - lastKeyTime.current > 150) {
        scannerBuffer.current = "";
      }
      lastKeyTime.current = now;

      if (e.key.length === 1 && /^[0-9]$/.test(e.key) && !isInputFocused) {
        scannerBuffer.current += e.key;
      } else if (e.key === 'Enter' && scannerBuffer.current.length >= 6 && !isInputFocused) {
        e.preventDefault();
        const scanValue = scannerBuffer.current;
        scannerBuffer.current = "";
        if (showModal && !isViewMode) {
          handleBarcodeScanDirect(scanValue);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showModal, isViewMode, warehouse]);

  const [customers, setCustomers] = useState([]);
  const [taxTemplates, setTaxTemplates] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [itemSearches, setItemSearches] = useState({});
  const [showItemDropdowns, setShowItemDropdowns] = useState({});
  const [barcodeInput, setBarcodeInput] = useState('');
  const [highlightedItemIndex, setHighlightedItemIndex] = useState({});

  const barcodeRef = useRef(null);

  useEffect(() => {
    let f = orders;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      f = f.filter(o =>
        o.name?.toLowerCase().includes(t) ||
        o.customer_name?.toLowerCase().includes(t)
      );
    }
    if (customerFilter) f = f.filter(o => o.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
    if (statusFilter !== 'all') f = f.filter(o =>
      (statusFilter === 'Submitted' && o.docstatus === 1) ||
      (statusFilter === 'Draft' && o.docstatus === 0)
    );
    if (minAmount) f = f.filter(o => Number(o.grand_total || 0) >= Number(minAmount));
    if (maxAmount) f = f.filter(o => Number(o.grand_total || 0) <= Number(maxAmount));
    setFilteredOrders(f);
  }, [searchTerm, customerFilter, statusFilter, minAmount, maxAmount, orders]);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchTaxTemplates();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'docstatus']),
          order_by: 'modified desc'
        },
        withCredentials: true
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_PATH_K}.get_customers_list_so`, { withCredentials: true });
      setCustomers(res.data.message || []);
    } catch (err) { console.error(err); }
  };

  const fetchTaxTemplates = async () => {
    try {
      const res = await axios.get(`${API_PATH_K}.get_sales_taxes_templates_so`, { withCredentials: true });
      setTaxTemplates(res.data.message || []);
    } catch (err) { console.error(err); }
  };

  const recalculate = useCallback(() => {
    setForm(prev => recalcForm(prev));
  }, []);

  const searchItems = async (query, idx) => {
    setHighlightedItemIndex(p => ({ ...p, [idx]: -1 }));
    if (!query.trim()) {
      setItemsList([]);
      setShowItemDropdowns(p => ({ ...p, [idx]: false }));
      return;
    }
    try {
      const res = await axios.get(`${API_PATH}.get_items_so`, { params: { query }, withCredentials: true });
      setItemsList(res.data.message || []);
      setShowItemDropdowns(p => ({ ...p, [idx]: true }));
    } catch { setItemsList([]); }
  };

  const selectItem = async (idx, item) => {
    try {
      const rateRes = await axios.get(`${API_PATH}.get_item_selling_rate_so`, {
        params: { 
          item_code: item.item_code, 
          price_list: form.selling_price_list,
          warehouse: warehouse // Pass warehouse for backend fallback
        },
        withCredentials: true
      });
      const rate =
        rateRes.data?.message?.message?.rate ||
        rateRes.data?.message?.rate ||
        rateRes.data?.rate || 0;

      const pPerBox = parseFloat(item.custom_pieces_per_box || 1);
      const uomList = item.uom_list || [];

      setForm(prev => {
        const items = [...prev.items];
        items[idx] = {
          ...SOItemModel,
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom || 'Nos',
          uom: item.stock_uom || 'Nos',
          uom_list: uomList,
          use_box_entry: false,
          qty: 1,
          rate,
          amount: rate,
          custom_pieces_per_box: 1,
          default_pieces_per_box: pPerBox,
          custom_box_qty: 1,
          custom_box_price: rate,
          custom_selling_price: parseFloat(item.selling_price || 0),
          custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
          delivery_date: prev.delivery_date || prev.transaction_date,
          warehouse: prev.set_source_warehouse || warehouse || ''
        };

        // Async UOM fetch
        fetchItemUOMs(item.item_code).then(fetchedUoms => {
          setForm(p => {
            const its = [...p.items];
            if (its[idx]) its[idx].uom_list = fetchedUoms;
            return { ...p, items: its };
          });
        });

        return recalcForm({ ...prev, items });
      });
    } catch {
      setForm(prev => {
        const items = [...prev.items];
        items[idx] = { ...items[idx], rate: 0, amount: 0 };
        return recalcForm({ ...prev, items });
      });
    }
    setItemSearches(p => ({ ...p, [idx]: '' }));
    setShowItemDropdowns(p => ({ ...p, [idx]: false }));
  };

  const updateItem = (idx, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'qty' || field === 'rate') {
        items[idx].amount = (parseFloat(items[idx].qty) || 0) * (parseFloat(items[idx].rate) || 0);
      }
      return recalcForm({ ...prev, items });
    });
  };

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...SOItemModel, qty: 1, rate: 0, amount: 0, delivery_date: prev.delivery_date || prev.transaction_date }]
    }));
  };

  const removeItemRow = idx => {
    setForm(prev => recalcForm({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleBarcodeScanDirect = async (barcode) => {
    if (!barcode.trim()) return;
    try {
      const res = await axios.get(`${API_PATH}.get_retail_item_details`, {
        params: { search_term: barcode, warehouse: warehouse },
        withCredentials: true
      });
      const apiItem = (res.data.message || [])[0];

      if (apiItem) {
        let rate = apiItem.price_list_rate || 0;
        try {
          const rateRes = await axios.get(`${API_PATH}.get_item_selling_rate_so`, {
            params: { 
              item_code: apiItem.name, 
              price_list: form.selling_price_list,
              warehouse: warehouse
            },
            withCredentials: true
          });
          const fetchedRate =
            rateRes.data?.message?.message?.rate ||
            rateRes.data?.message?.rate ||
            rateRes.data?.rate;
          if (fetchedRate !== undefined) {
            rate = fetchedRate;
          }
        } catch (err) {
          console.warn('Failed to fetch selling rate, using fallback rate', err);
        }

        setForm(prev => {
          const items = [...prev.items];
          const emptyIdx = items.findIndex(i => !i.item_code);
          const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;

          const pPerBox = parseFloat(apiItem.custom_pieces_per_box || 1);
          const uomList = apiItem.uom_list || [];

          const newRow = {
            ...SOItemModel,
            item_code: apiItem.name,
            item_name: apiItem.item_name,
            stock_uom: apiItem.stock_uom || 'Nos',
            uom: apiItem.stock_uom || 'Nos',
            uom_list: uomList,
            use_box_entry: false,
            qty: 1,
            rate,
            amount: rate,
            custom_pieces_per_box: 1,
            default_pieces_per_box: pPerBox,
            custom_box_qty: 1,
            custom_box_price: rate,
            custom_selling_price: parseFloat(apiItem.selling_price || 0),
            custom_ref_sl_no: apiItem.custom_ref_sl_no || apiItem.custom_supplier_sl_num || '',
            delivery_date: prev.delivery_date || prev.transaction_date,
            warehouse: prev.set_source_warehouse || warehouse || ''
          };

          if (emptyIdx !== -1) {
            items[emptyIdx] = newRow;
          } else {
            items.push(newRow);
          }

          // Async UOM fetch
          fetchItemUOMs(apiItem.name).then(fetchedUoms => {
            setForm(p => {
              const its = [...p.items];
              const ri = its.findIndex(i => i.item_code === apiItem.name);
              if (ri !== -1) its[ri] = { ...its[ri], uom_list: fetchedUoms };
              return { ...p, items: its };
            });
          });

          return recalcForm({ ...prev, items });
        });

        setBarcodeInput('');
        setTimeout(() => barcodeRef.current?.focus(), 100);
      } else {
        // Global Discovery Fallback
        try {
          const globalRes = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', {
            search_term: barcode
          }, { withCredentials: true });
          const it = globalRes.data?.message?.[0] || globalRes.data?.[0] || null;

          if (it) {
            const availableBranches = (it.warehouse_details || it.branch_availability || [])
              .filter(b => (b.actual_qty || b.qty || 0) > 0)
              .map(b => b.warehouse_name || b.warehouse)
              .filter((v, i, a) => a.indexOf(v) === i)
              .join(", ");

            Swal.fire({
              title: 'Item Found in Other Branches',
              html: `<div style="font-size: 15px; font-weight: 600; color: #475569; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                  This item is not enabled for <span style="font-weight: 800; color: #0f172a;">${warehouse}</span>.
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #1e293b; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #4f46e5; text-align: left; line-height: 1.4; margin-bottom: 12px;">
                  ${it.item_name || it.name}
              </div>
              <div style="text-align: left; font-size: 14px; color: #475569;">
                  <p style="font-weight: 600; margin-bottom: 4px;">Stock available in:</p>
                  <p style="color: #059669; font-weight: 700;">${availableBranches || 'None (No physical stock)'}</p>
              </div>`,
              icon: 'info',
              confirmButtonColor: '#4f46e5'
            });
            setBarcodeInput('');
            setTimeout(() => barcodeRef.current?.focus(), 100);
          } else {
            Swal.fire('Not Found', 'Item not found in local or global database.', 'error');
            setBarcodeInput('');
            setTimeout(() => barcodeRef.current?.focus(), 100);
          }
        } catch (globalErr) {
          console.error("Global search failed:", globalErr);
          Swal.fire('Not Found', 'Item not found in database.', 'error');
          setBarcodeInput('');
          setTimeout(() => barcodeRef.current?.focus(), 100);
        }
      }
    } catch (err) {
      Swal.fire('Scan Error', err.response?.data?.message || err.message || 'Unknown error', 'error');
    }
  };

  const handleBarcodeScan = async e => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return;
    e.preventDefault();
    handleBarcodeScanDirect(barcodeInput.trim());
  };

  const loadTaxTemplate = async templateName => {
    if (!templateName) {
      setForm(prev => recalcForm({ ...prev, taxes_and_charges: '', taxes: [] }));
      return;
    }
    try {
      const res = await axios.get(`${API_PATH}.get_sales_taxes_templates_so`, {
        params: { template: templateName }, withCredentials: true
      });
      const newTaxes = (res.data.message || []).map(t => ({ ...t, add_deduct_tax: t.add_deduct_tax || 'Add', total: '0.000' }));
      setForm(prev => recalcForm({ ...prev, taxes_and_charges: templateName, taxes: newTaxes }));
    } catch (err) {
      alert('Could not load tax template: ' + (err.response?.data?.message || err.message));
    }
  };

  const updateTax = (idx, field, value) => {
    setForm(prev => {
      const taxes = [...prev.taxes];
      taxes[idx] = { ...taxes[idx], [field]: value };
      return recalcForm({ ...prev, taxes });
    });
  };

  const removeTaxRow = idx => {
    setForm(prev => recalcForm({ ...prev, taxes: prev.taxes.filter((_, i) => i !== idx) }));
  };

  const addTaxRow = () => {
    setForm(prev => ({
      ...prev,
      taxes: [...prev.taxes, { add_deduct_tax: 'Add', charge_type: 'On Net Total', account_head: '', rate: 0, tax_amount: 0, total: '0.000' }]
    }));
  };

  const handleSave = async (submit = false) => {
    if (!form.customer) return alert('Customer is required');
    if (!form.items.length) return alert('Add at least one item');
    if (form.items.some(i => !i.item_code)) return alert('All items must be selected');

    const setS = submit ? setIsSubmitting : setSaving;
    setS(true);

    const payload = {
      doctype: 'Sales Order',
      naming_series: form.naming_series,
      transaction_date: form.transaction_date,
      delivery_date: form.delivery_date || form.transaction_date,
      customer: form.customer,
      order_type: form.order_type,
      currency: form.currency,
      selling_price_list: form.selling_price_list,
      items: form.items.map(i => ({
        item_code: i.item_code,
        qty: parseFloat(i.qty) || 0,
        rate: parseFloat(i.rate) || 0,
        amount: parseFloat(i.amount) || 0,
        uom: i.uom || 'Nos',
        custom_ref_sl_no: i.custom_ref_sl_no || '',
        custom_box_qty: parseFloat(i.custom_box_qty) || 0,
        custom_pieces_per_box: parseFloat(i.custom_pieces_per_box) || 1,
        custom_box_price: parseFloat(i.custom_box_price) || 0,
        custom_selling_price: parseFloat(i.custom_selling_price) || 0,
        delivery_date: i.delivery_date || form.delivery_date || form.transaction_date
      })),
      taxes_and_charges: form.taxes_and_charges || undefined,
      taxes: form.taxes.map(t => ({
        charge_type: t.charge_type || 'On Net Total',
        account_head: t.account_head,
        rate: parseFloat(t.rate || 0),
        tax_amount: parseFloat(t.tax_amount || 0),
        add_deduct_tax: t.add_deduct_tax || 'Add',
        description: t.description || t.account_head
      })),
      additional_discount_percentage: form.additional_discount_percentage || 0,
      discount_amount: form.discount_amount || 0,
      apply_discount_on: form.apply_discount_on,
      rounded_total: form.rounded_total,
      rounding_adjustment: form.rounding_adjustment,
      ...(submit ? { docstatus: 1 } : {})
    };

    try {
      if (editingDocName) {
        await axios.put(`${RESOURCE_BASE}/Sales Order/${editingDocName}`, payload, { withCredentials: true });
        alert(submit ? 'Sales Order Submitted!' : 'Draft Updated!');
      } else {
        const res = await axios.post(`${RESOURCE_BASE}/Sales Order`, payload, { withCredentials: true });
        alert(submit ? 'Sales Order Submitted!' : 'Saved as Draft!');
        if (!submit) setEditingDocName(res.data.data.name);
      }
      if (submit) { setShowModal(false); setEditingDocName(null); }
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleTransition = async (type) => {
    if (!editingDocName) return;
    setLoadingLinks(true);
    try {
      const endpoint = type === 'delivery_note' ? 'create_delivery_note_from_so' : 'create_sales_invoice_from_so';
      const res = await axios.post(`${API_PATH_K}.${endpoint}`, {
        so_name: editingDocName,
        submit_doc: true
      }, { withCredentials: true });

      const apiResp = res.data.message || res.data;
      if (apiResp.status === 'success') {
        alert(`${type === 'delivery_note' ? 'Delivery Note' : 'Sales Invoice'} created: ${apiResp.name}`);
        fetchLinkedDocs(editingDocName);
      } else {
        throw new Error(apiResp.message || 'Failed to create');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoadingLinks(false);
    }
  };

  const deleteOrder = async name => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      setSaving(true);
      await axios.delete(`${RESOURCE_BASE}/Sales Order/${name}`, { withCredentials: true });
      alert('Sales Order deleted!');
      closeModal();
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const fetchLinkedDocs = async (name) => {
    setLoadingLinks(true);
    try {
      const res = await axios.get(`${API_PATH_K}.get_linked_documents`, {
        params: { doctype: 'Sales Order', name },
        withCredentials: true
      });
      setLinkedDocs(res.data.message || {});
    } catch (err) { console.error(err); }
    finally { setLoadingLinks(false); }
  };

  const loadSalesOrder = async docName => {
    try {
      setLoading(true);
      const res = await axios.get(`${RESOURCE_BASE}/Sales Order/${docName}`, { withCredentials: true });
      const d = res.data.data;

      setForm({
        naming_series: d.naming_series || 'SAL-ORD-.YYYY.-',
        transaction_date: d.transaction_date,
        delivery_date: d.delivery_date || '',
        customer: d.customer || '',
        customer_name: d.customer_name || '',
        order_type: d.order_type || 'Sales',
        currency: d.currency || 'AED',
        selling_price_list: d.selling_price_list || 'Standard Selling',
        price_list_currency: d.price_list_currency || 'AED',
        items: (d.items || []).map((it, idx) => {
          const isBox = (it.uom || '').toLowerCase() === 'box';
          const newRow = {
            ...SOItemModel,
            ...it,
            custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || '',
            custom_box_qty: parseFloat(parseFloat(it.custom_box_qty || 0).toFixed(2)),
            custom_pieces_per_box: parseFloat(parseFloat(it.custom_pieces_per_box || 1).toFixed(2)),
            default_pieces_per_box: parseFloat(parseFloat(it.custom_pieces_per_box || 1).toFixed(2)),
            custom_box_price: parseFloat(parseFloat(it.custom_box_price || 0).toFixed(2)),
            custom_selling_price: parseFloat(parseFloat(it.custom_selling_price || 0).toFixed(2)),
            qty: parseFloat(parseFloat(it.qty || 0).toFixed(2)),
            rate: parseFloat(parseFloat(it.rate || 0).toFixed(2)),
            amount: parseFloat(parseFloat(it.amount || 0).toFixed(2)),
            use_box_entry: isBox
          };

          // Fetch UOMs asynchronously
          if (it.item_code) {
            fetchItemUOMs(it.item_code).then(fetchedUoms => {
              setForm(p => {
                const its = [...p.items];
                if (its[idx]) its[idx].uom_list = fetchedUoms;
                return { ...p, items: its };
              });
            });
          }

          return newRow;
        }),
        taxes_and_charges: d.taxes_and_charges || '',
        taxes: (d.taxes || []).map(t => ({ ...t, add_deduct_tax: t.add_deduct_tax || 'Add', total: '0.000' })),
        apply_discount_on: d.apply_discount_on || 'Grand Total',
        additional_discount_percentage: d.additional_discount_percentage || 0,
        discount_amount: d.discount_amount || 0,
        total_qty: d.total_qty || 0,
        base_total: d.base_total || 0,
        total: d.total || 0,
        total_taxes_and_charges: d.total_taxes_and_charges || 0,
        grand_total: d.grand_total || 0,
        rounding_adjustment: d.rounding_adjustment || 0,
        rounded_total: d.rounded_total || 0,
        docstatus: d.docstatus,
      });
      setSearchCustomer(d.customer_name || '');
      setEditingDocName(docName);
      setIsViewMode(true);
      setShowModal(true);
      fetchLinkedDocs(docName);
      setTimeout(() => barcodeRef.current?.focus(), 300);
    } catch { alert('Failed to load Sales Order'); }
    finally { setLoading(false); }
  };

  const openNew = () => {
    setEditingDocName(null);
    const base = emptyForm();
    // Derive selling price list from current user's branch warehouse
    if (warehouse) {
      const branchName = warehouse.split(' Warehouse')[0].split(' - ')[0];
      const pl = `${branchName} Selling`;
      base.selling_price_list = pl;
    }
    setForm(base);
    setSearchCustomer('');
    setItemSearches({});
    setShowItemDropdowns({});
    setBarcodeInput('');
    setIsViewMode(false);
    setShowModal(true);
    // Auto-load matching VAT 5% template as default tax template
    const defaultTax = taxTemplates.find(t => t.name.toUpperCase().includes('VAT 5% - NS')) ||
                       taxTemplates.find(t => t.name.toUpperCase().includes('VAT 5% - KSPL')) ||
                       taxTemplates.find(t => t.name.toUpperCase().includes('UAE VAT 5%')) ||
                       taxTemplates.find(t => t.name.toUpperCase().includes('VAT 5%')) ||
                       taxTemplates.find(t => t.name.toUpperCase().includes('5%'));
    const defaultTaxName = defaultTax ? defaultTax.name : 'UAE VAT 5% - NS';

    setTimeout(() => {
      loadTaxTemplate(defaultTaxName);
      barcodeRef.current?.focus();
    }, 100);
  };

  const closeModal = () => { setShowModal(false); setEditingDocName(null); };

  const clearFilters = () => {
    setSearchTerm(''); setCustomerFilter(''); setStatusFilter('all');
    setMinAmount(''); setMaxAmount('');
  };

  /* ================================================================ */
  return (
    <>
      <div className="so-page">

        {/* ---- Page Header ---- */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Package size={20} />
              Sales Orders
            </h1>
            <p className="so-page-subtitle">Manage and track all sales</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setSoTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                background: '#f8fafc',
                border: `1.5px solid ${themeColor}`,
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: themeColor,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {soTheme.toUpperCase()}
            </button>
            <button className="so-btn-primary" onClick={openNew}>
              <Plus size={16} /> New Sales Order
            </button>
          </div>
        </div>

        <div className="so-layout">
          {/* ---- Horizontal Filter Bar ---- */}
          <div className="so-filter-bar">
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Search Orders</label>
              <input
                className="so-filter-input"
                placeholder="Order ID or customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Customer</label>
              <input
                className="so-filter-input"
                placeholder="Customer name..."
                value={customerFilter}
                onChange={e => setCustomerFilter(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label">Status</label>
              <select
                className="so-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label">Amount Range</label>
              <div className="so-amount-range">
                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
              </div>
            </div>
            <button
              className="so-clear-btn"
              onClick={clearFilters}
              style={{ width: 'auto', margin: 0, padding: '0 1.5rem', height: '38px', fontWeight: 600 }}
            >
              Clear Filters
            </button>
          </div>

          {/* ---- Main Content ---- */}
          <div className="so-content">
            <p className="so-list-meta">{filteredOrders.length} record(s) found</p>
            <div className="so-table-card">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="so-empty">
                        <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="so-empty">No sales orders found</td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.name} onClick={() => loadSalesOrder(order.name)}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{order.name}</td>
                        <td>{order.transaction_date}</td>
                        <td>{order.customer_name}</td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 700 }}>
                            <DirhamIcon size={12} />
                            <span>{Number(order.grand_total || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </td>
                        <td>
                          {order.docstatus === 1 ? (
                            <span className="so-badge" style={{
                              background: isGreen ? '#dcfce7' : '#e0f2fe',
                              color: isGreen ? '#166534' : '#0369a1',
                              border: `1px solid ${isGreen ? '#bbf7d0' : '#bae6fd'}`
                            }}>
                              Submitted
                            </span>
                          ) : (
                            <span className="so-badge so-badge-draft">Draft</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="so-pagination">
              <span>Showing {filteredOrders.length} of {orders.length} records</span>
              <div className="so-pagination-btns">
                <button className="so-page-btn" disabled><ChevronLeft size={14} /></button>
                <button className="so-page-btn active">1</button>
                <button className="so-page-btn" disabled><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Modal — TRUE FULLSCREEN                                          */}
        {/* ================================================================ */}
        {showModal && (
          <div
            className="so-modal-overlay"
            onClick={e => e.target === e.currentTarget && closeModal()}
          >
            <div className="so-modal">

              {/* Modal Header */}
              <div className="so-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button onClick={closeModal} className="so-modal-close" style={{ background: '#f8fafc' }}>
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <h2 className="so-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {isViewMode ? `Order: ${editingDocName}` : (editingDocName ? 'Edit Sales Order' : 'New Sales Order')}
                    </h2>
                    {isViewMode && <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{form.customer_name}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {isViewMode && form.docstatus === 0 && (
                    <button
                      onClick={() => setIsViewMode(false)}
                      className="so-btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
                    >
                      <Plus size={14} /> Edit Order
                    </button>
                  )}
                  {form.docstatus === 1 && (
                    <span className="so-badge" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>SUBMITTED</span>
                  )}
                  <button className="so-modal-close" onClick={closeModal}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="so-modal-body">
                {isViewMode ? (
                  <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

                    {/* Dashboard Connections */}
                    <div className="so-card" style={{ marginBottom: '2rem', border: `1px solid ${themeColor}30`, background: 'white' }}>
                      <div className="so-card-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <p className="so-card-title" style={{ fontSize: '0.7rem', color: themeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard / Connections</p>
                      </div>
                      <div className="so-card-body">
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                          <div style={{ padding: '0.75rem 1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Delivery Notes</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>{linkedDocs.Delivery_Note?.length || 0}</span>
                          </div>
                          <div style={{ padding: '0.75rem 1.25rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '160px' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#075985', textTransform: 'uppercase' }}>Sales Invoices</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0369a1' }}>{linkedDocs.Sales_Invoice?.length || 0}</span>
                          </div>
                        </div>
                        {form.docstatus === 1 && (
                          <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                            <button onClick={() => handleTransition('delivery_note')} disabled={loadingLinks} className="so-btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.75rem' }}>
                              Create Delivery Note
                            </button>
                            <button onClick={() => handleTransition('sales_invoice')} disabled={loadingLinks} className="so-btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.75rem' }}>
                              Create Sales Invoice
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                          {linkedDocs.Delivery_Note?.map(dn => (
                            <span key={dn} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>DN: {dn}</span>
                          ))}
                          {linkedDocs.Sales_Invoice?.map(si => (
                            <span key={si} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>SI: {si}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="so-card">
                          <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <p className="so-card-title">Order Summary</p>
                              <button
                                type="button"
                                onClick={() => setShowColConfig(true)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                title="Column Configuration"
                              >
                                <Settings size={14} style={{ color: '#94a3b8' }} />
                              </button>
                            </div>
                          </div>
                          <div className="so-card-body">
                            <div className="so-table-wrapper" style={{ maxHeight: 'none', border: '1px solid #f1f5f9' }}>
                              <table className="so-table">
                                <thead>
                                  <tr>
                                    {(() => {
                                      const hasAnyBox = form.items.some(i => i.use_box_entry);
                                      const activeCols = soColumns.filter(c => {
                                        if (!c.visible) return false;
                                        if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                        return true;
                                      });

                                      return activeCols.map(col => {
                                        let finalLabel = col.label;

                                        if (!hasAnyBox) {
                                          if (col.id === 'custom_box_qty') finalLabel = 'Qty';
                                          if (col.id === 'custom_box_price') finalLabel = 'Price';
                                          if (col.id === 'custom_pieces_per_box') finalLabel = '';
                                        }

                                        let alignClass = "text-center";
                                        if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
                                          alignClass = "text-left pl-3";
                                        } else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) {
                                          alignClass = "text-right pr-3";
                                        }

                                        return (
                                          <th
                                            key={col.id}
                                            className={alignClass}
                                            style={{ width: col.width }}
                                          >
                                            {finalLabel}
                                          </th>
                                        );
                                      });
                                    })()}
                                  </tr>
                                </thead>
                                <tbody>
                                  {form.items.map((i, idx) => (
                                    <tr key={idx} style={{ cursor: 'default' }}>
                                      {(() => {
                                        const hasAnyBox = form.items.some(item => item.use_box_entry);
                                        const activeCols = soColumns.filter(c => {
                                          if (!c.visible) return false;
                                          if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                          return true;
                                        });

                                        return activeCols.map(col => {
                                          switch (col.id) {
                                            case 'item_code':
                                              return (
                                                <td key={col.id}>
                                                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{i.item_code}</div>
                                                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{i.item_name}</div>
                                                </td>
                                              );
                                            case 'custom_ref_sl_no':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'center', fontWeight: 600 }}>
                                                  {i.custom_ref_sl_no || '—'}
                                                </td>
                                              );
                                            case 'custom_box_qty':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'left', pl: '10px', fontWeight: 600 }}>
                                                  {i.use_box_entry ? `${i.custom_box_qty} Box` : `${i.qty} Nos`}
                                                </td>
                                              );
                                            case 'uom':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                                                  {i.use_box_entry ? 'Box' : (i.uom || 'Nos')}
                                                </td>
                                              );
                                            case 'custom_pieces_per_box':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'left', pl: '10px', fontWeight: 600 }}>
                                                  {i.use_box_entry ? i.custom_pieces_per_box : '—'}
                                                </td>
                                              );
                                            case 'custom_box_price':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'right', pr: '10px', fontWeight: 600 }}>
                                                  {i.use_box_entry ? i.custom_box_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                </td>
                                              );
                                            case 'rate':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'right', pr: '10px', fontWeight: 600 }}>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                    <DirhamIcon size={12} />
                                                    <span>{parseFloat(i.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                  </div>
                                                </td>
                                              );
                                            case 'custom_selling_price':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'right', pr: '10px', fontWeight: 600, color: themeColor }}>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                    <DirhamIcon size={12} />
                                                    <span>{parseFloat(i.custom_selling_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                  </div>
                                                </td>
                                              );
                                            case 'qty':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'left', pl: '10px', fontWeight: 800 }}>
                                                  {i.qty} Nos
                                                </td>
                                              );
                                            case 'amount':
                                              return (
                                                <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                    <DirhamIcon size={13} />
                                                    <span>{parseFloat(i.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                  </div>
                                                </td>
                                              );
                                            default:
                                              return null;
                                          }
                                        });
                                      })()}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="so-card">
                          <div className="so-card-header"><p className="so-card-title">Order Info</p></div>
                          <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Date</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{form.transaction_date}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Delivery</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{form.delivery_date || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
                              <span className="so-badge" style={{
                                background: form.docstatus === 1 ? '#dcfce7' : '#f1f5f9',
                                color: form.docstatus === 1 ? '#166534' : '#64748b'
                              }}>
                                {form.docstatus === 1 ? 'SUBMITTED' : 'DRAFT'}
                              </span>
                            </div>
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Currency</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{form.currency}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 900 }}>Total</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColor, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <DirhamIcon size={18} />
                                  <span>{form.grand_total.toFixed(2)}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>

                    {form.docstatus === 1 && (
                      <div className="so-card" style={{ border: `1.5px solid ${themeColor}`, background: themeLight }}>
                        <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="so-card-title" style={{ color: themeColor, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap size={14} fill={themeColor} /> Transition & Quick Actions
                          </span>
                          {loadingLinks && <Loader2 size={14} className="so-spinner" />}
                        </div>
                        <div className="so-card-body">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <button className="so-btn-primary" onClick={() => handleTransition('delivery_note')} disabled={loadingLinks} style={{ height: '36px', fontSize: '0.75rem' }}>
                              Create Delivery Note
                            </button>
                            <button className="so-btn-secondary" onClick={() => handleTransition('sales_invoice')} disabled={loadingLinks} style={{ height: '36px', fontSize: '0.75rem', background: '#fff' }}>
                              Create Sales Invoice
                            </button>
                          </div>
                          {(linkedDocs.Delivery_Note?.length > 0 || linkedDocs.Sales_Invoice?.length > 0 || linkedDocs.Payment_Entry?.length > 0) && (
                            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem' }}>
                              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>Linked Documents</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {linkedDocs.Delivery_Note?.map(dn => (
                                  <span key={dn} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>DN: {dn}</span>
                                ))}
                                {linkedDocs.Sales_Invoice?.map(si => (
                                  <span key={si} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>SI: {si}</span>
                                ))}
                                {linkedDocs.Payment_Entry?.map(pe => (
                                  <span key={pe} className="so-badge" style={{ background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.65rem' }}>PE: {pe}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Core Details Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <span className="so-card-title">Order Details</span>
                      </div>
                      <div className="so-card-body">
                        <div className="so-form-grid">
                          <div className="so-field so-relative">
                            <label className="so-label">Customer <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                              className="so-input"
                              placeholder="Search customer..."
                              value={searchCustomer}
                              onChange={e => setSearchCustomer(e.target.value)}
                              onFocus={() => setShowCustomerDropdown(true)}
                              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                            />
                            {showCustomerDropdown && customers.length > 0 && (
                              <div className="so-dropdown">
                                {customers
                                  .filter(c => c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()))
                                  .map(c => (
                                    <div key={c.name} className="so-dropdown-item"
                                      onMouseDown={() => {
                                        setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                        setSearchCustomer(c.customer_name);
                                        setShowCustomerDropdown(false);
                                      }}
                                    >
                                      <div className="so-dropdown-item-name">{c.customer_name}</div>
                                      <div className="so-dropdown-item-code">{c.name}</div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div className="so-field">
                            <label className="so-label">Transaction Date</label>
                            <input type="date" className="so-input" value={form.transaction_date}
                              onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                              onChange={e => setForm(prev => ({ ...prev, transaction_date: e.target.value }))} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Delivery Date</label>
                            <input type="date" className="so-input" value={form.delivery_date}
                              onClick={e => { try { e.target.showPicker(); } catch (err) {} }}
                              onChange={e => setForm(prev => ({ ...prev, delivery_date: e.target.value }))} />
                          </div>
                          <div className="so-field">
                            <label className="so-label">Price List</label>
                            <select className="so-select" value={form.selling_price_list}
                              onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))}>
                              <option value="Standard Selling">Standard Selling</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barcode Scanner */}
                    <div className="so-barcode-area" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', border: 'none', background: 'transparent', padding: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '0.375rem', padding: '0 0.75rem', height: '38px' }}>
                        <ScanLine size={18} style={{ color: '#64748b', marginRight: '0.5rem', flexShrink: 0 }} />
                        <input
                          ref={barcodeRef}
                          id="barcode-scan-input-so"
                          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', height: '100%', fontSize: '0.85rem' }}
                          placeholder="Scan barcode and press Enter..."
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={handleBarcodeScan}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '38px', height: '38px',
                          background: themeColor, color: '#fff',
                          border: 'none', borderRadius: '0.375rem',
                          cursor: 'pointer', transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                        title="Start Camera Scanner"
                      >
                        <Camera size={18} />
                      </button>
                    </div>

                    <div className="so-card">
                      <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="so-card-title">Product Items</span>
                          <button
                            type="button"
                            onClick={() => setShowColConfig(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            title="Column Configuration"
                          >
                            <Settings size={14} style={{ color: '#94a3b8' }} />
                          </button>
                        </div>
                        <button className="so-btn-ghost" onClick={addItemRow}><Plus size={14} /> Add Item</button>
                      </div>
                      <div className="so-items-table-wrap">
                        <table className="so-items-table">
                          <thead>
                            <tr>
                              {(() => {
                                const hasAnyBox = form.items.some(i => i.use_box_entry);
                                const activeCols = soColumns.filter(c => {
                                  if (!c.visible) return false;
                                  if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                  return true;
                                });

                                return activeCols.map(col => {
                                  let finalLabel = col.label;

                                  if (!hasAnyBox) {
                                    if (col.id === 'custom_box_qty') finalLabel = 'Qty';
                                    if (col.id === 'custom_box_price') finalLabel = 'Price';
                                    if (col.id === 'custom_pieces_per_box') finalLabel = '';
                                  }

                                  let alignClass = "text-center";
                                  if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
                                    alignClass = "text-left pl-3";
                                  } else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) {
                                    alignClass = "text-right pr-3";
                                  }

                                  return (
                                    <th
                                      key={col.id}
                                      className={alignClass}
                                      style={{ width: col.width }}
                                    >
                                      {finalLabel}
                                    </th>
                                  );
                                });
                              })()}
                              <th style={{ width: '50px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="so-empty">No items yet — scan a barcode or click <strong>Add Item</strong></td>
                              </tr>
                            ) : (
                              form.items.map((item, i) => (
                                <tr key={i}>
                                  {(() => {
                                    const hasAnyBox = form.items.some(item => item.use_box_entry);
                                    const activeCols = soColumns.filter(c => {
                                      if (!c.visible) return false;
                                      if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                      return true;
                                    });

                                    return activeCols.map(col => {
                                      switch (col.id) {
                                        case 'item_code':
                                          return (
                                            <td key={col.id} className="so-relative">
                                              {item.item_code ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                  <div style={{ flex: 1 }}>
                                                    <div className="so-item-display-name">{item.item_name}</div>
                                                    <div className="so-item-display-code">{item.item_code}</div>
                                                  </div>
                                                  <button
                                                    title="Change item"
                                                    onClick={() => {
                                                      setForm(prev => {
                                                        const items = [...prev.items];
                                                        items[i] = { item_code: '', item_name: '', qty: items[i].qty || 1, rate: 0, amount: 0, uom: 'Nos', delivery_date: items[i].delivery_date };
                                                        return recalcForm({ ...prev, items });
                                                      });
                                                      setItemSearches(p => ({ ...p, [i]: '' }));
                                                      setShowItemDropdowns(p => ({ ...p, [i]: false }));
                                                    }}
                                                    style={{ padding: '0.2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                  >
                                                    <X size={13} />
                                                  </button>
                                                </div>
                                              ) : (
                                                <div className="so-relative">
                                                  <input className="so-td-input" placeholder="Search item..." autoFocus
                                                    value={itemSearches[i] || ''}
                                                    onChange={e => {
                                                      const v = e.target.value;
                                                      setItemSearches(p => ({ ...p, [i]: v }));
                                                      searchItems(v, i);
                                                    }}
                                                    onKeyDown={e => {
                                                      if (!showItemDropdowns[i] || itemsList.length === 0) return;
                                                      const currIndex = highlightedItemIndex[i] !== undefined ? highlightedItemIndex[i] : -1;
                                                      if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setHighlightedItemIndex(prev => ({ ...prev, [i]: currIndex < itemsList.length - 1 ? currIndex + 1 : currIndex }));
                                                      } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setHighlightedItemIndex(prev => ({ ...prev, [i]: currIndex > 0 ? currIndex - 1 : currIndex }));
                                                      } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (currIndex >= 0 && itemsList[currIndex]) {
                                                          selectItem(i, itemsList[currIndex]);
                                                        } else if (itemsList.length > 0) {
                                                          selectItem(i, itemsList[0]);
                                                        }
                                                      }
                                                    }}
                                                  />
                                                  {showItemDropdowns[i] && itemsList.length > 0 && (
                                                    <div className="so-dropdown">
                                                      {itemsList.map((itm, idx) => (
                                                        <div key={itm.item_code} 
                                                             className="so-dropdown-item" 
                                                             onMouseDown={(e) => {
                                                               e.preventDefault();
                                                               selectItem(i, itm);
                                                             }}
                                                             style={{ backgroundColor: highlightedItemIndex[i] === idx ? '#e2e8f0' : '' }}
                                                        >
                                                          <div className="so-dropdown-item-name">{itm.item_name}</div>
                                                          <div className="so-dropdown-item-code">{itm.item_code}</div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          );
                                        case 'custom_ref_sl_no':
                                          return (
                                            <td key={col.id}>
                                              <input
                                                className="so-td-input"
                                                style={{ textAlign: 'center' }}
                                                type="text"
                                                name="custom_ref_sl_no"
                                                value={item.custom_ref_sl_no || ''}
                                                onChange={(e) => handleInputChange(e, i)}
                                                onFocus={(e) => e.target.select()}
                                                placeholder="Serial..."
                                              />
                                            </td>
                                          );
                                        case 'custom_box_qty':
                                          return (
                                            <td key={col.id}>
                                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <input
                                                  className="so-td-input"
                                                  style={{ textAlign: 'left', paddingLeft: '10px', paddingRight: '45px', fontWeight: 'bold', color: item.use_box_entry ? '#0284c7' : '#334155' }}
                                                  type="text"
                                                  inputMode="decimal"
                                                  name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                                  value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                                  onChange={(e) => handleInputChange(e, i)}
                                                  onFocus={(e) => e.target.select()}
                                                />
                                                {item.item_code && (
                                                  <span style={{
                                                    position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                    color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                    background: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                    border: `1px solid ${item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0'}`,
                                                    borderRadius: '3px', padding: '1px 4px', pointerEvents: 'none'
                                                  }}>
                                                    {item.use_box_entry ? 'BOXES' : 'NOS'}
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        case 'uom':
                                          return (
                                            <td key={col.id}>
                                              <select
                                                className="so-td-input"
                                                value={item.uom || 'Nos'}
                                                onChange={e => handleUOMChange(e.target.value, i)}
                                              >
                                                {(() => {
                                                  const uniqueUoms = [];
                                                  const seen = new Set();
                                                  const candidates = [];
                                                  if (item.uom_list && Array.isArray(item.uom_list)) {
                                                    item.uom_list.forEach(u => { if (u && u.uom) candidates.push(u.uom); });
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
                                            </td>
                                          );
                                        case 'custom_pieces_per_box':
                                          return (
                                            <td key={col.id}>
                                              {item.use_box_entry ? (
                                                <input
                                                  className="so-td-input"
                                                  style={{ textAlign: 'left', paddingLeft: '10px' }}
                                                  type="text"
                                                  inputMode="decimal"
                                                  name="custom_pieces_per_box"
                                                  value={item.custom_pieces_per_box || ''}
                                                  onChange={(e) => handleInputChange(e, i)}
                                                  onFocus={(e) => e.target.select()}
                                                />
                                              ) : (
                                                <div style={{ padding: '0 10px', fontSize: '0.75rem', opacity: 0.4, textAlign: 'left' }}>—</div>
                                              )}
                                            </td>
                                          );
                                        case 'custom_box_price':
                                          return (
                                            <td key={col.id}>
                                              {item.use_box_entry ? (
                                                <input
                                                  className="so-td-input"
                                                  style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold' }}
                                                  type="text"
                                                  inputMode="decimal"
                                                  name="custom_box_price"
                                                  value={item.custom_box_price || ''}
                                                  onChange={(e) => handleInputChange(e, i)}
                                                  onFocus={(e) => e.target.select()}
                                                />
                                              ) : (
                                                <div style={{ padding: '0 10px', fontSize: '0.75rem', opacity: 0.4, textAlign: 'center' }}>—</div>
                                              )}
                                            </td>
                                          );
                                        case 'rate':
                                          return (
                                            <td key={col.id}>
                                              <input
                                                className="so-td-input"
                                                style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold' }}
                                                type="text"
                                                inputMode="decimal"
                                                name="rate"
                                                value={item.rate || ''}
                                                onChange={(e) => handleInputChange(e, i)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                            </td>
                                          );
                                        case 'custom_selling_price':
                                          return (
                                            <td key={col.id}>
                                              <input
                                                className="so-td-input"
                                                style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold', color: themeColor }}
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_selling_price"
                                                value={item.custom_selling_price || ''}
                                                onChange={(e) => handleInputChange(e, i)}
                                                onFocus={(e) => e.target.select()}
                                              />
                                            </td>
                                          );
                                        case 'qty':
                                          return (
                                            <td key={col.id}>
                                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <div style={{ padding: '0 10px', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', height: '38px', display: 'flex', alignItems: 'center', width: '100%' }}>
                                                  {item.qty || 0}
                                                </div>
                                                {item.use_box_entry && (
                                                  <span style={{
                                                    position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                    color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                    borderRadius: '3px', padding: '1px 4px', pointerEvents: 'none'
                                                  }}>
                                                    NOS
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          );
                                        case 'amount':
                                          return (
                                            <td key={col.id} style={{ textAlign: 'right', fontWeight: 700, verticalAlign: 'middle', paddingRight: '10px' }}>
                                              {(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                          );
                                        default:
                                          return null;
                                      }
                                    });
                                  })()}
                                  <td style={{ textAlign: 'center' }}>
                                    <button className="so-btn-danger" onClick={() => removeItemRow(i)}><Trash2 size={14} /></button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Taxes Card */}
                    <div className="so-card">
                      <div className="so-card-header">
                        <span className="so-card-title">Taxes & Charges</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <select className="so-select"
                            style={{ width: 'auto', minWidth: '220px', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            value={form.taxes_and_charges} onChange={e => loadTaxTemplate(e.target.value)}>
                            <option value="">No Tax Template</option>
                            {taxTemplates.map(t => (
                              <option key={t.name} value={t.name}>
                                {t.name}{t.name === 'UAE VAT 5% - NS' ? ' ✓ Default' : ''}
                              </option>
                            ))}
                          </select>
                          <button className="so-btn-ghost" onClick={addTaxRow}><Plus size={14} /> Add Row</button>
                        </div>
                      </div>
                      {form.taxes.length > 0 && (
                        <div className="so-items-table-wrap">
                          <table className="so-taxes-table">
                            <thead>
                              <tr>
                                <th style={{ width: '5%' }}>Add</th>
                                <th style={{ width: '25%' }}>Type</th>
                                <th style={{ width: '30%' }}>Account</th>
                                <th style={{ width: '12%' }}>Rate %</th>
                                <th style={{ width: '15%' }}>Amount</th>
                                <th style={{ width: '13%' }}>Total</th>
                                <th style={{ width: '5%' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.taxes.map((tax, i) => (
                                <tr key={i}>
                                  <td>
                                    <input type="checkbox" checked={tax.add_deduct_tax === 'Add'}
                                      onChange={e => updateTax(i, 'add_deduct_tax', e.target.checked ? 'Add' : 'Deduct')} />
                                  </td>
                                  <td>
                                    <select className="so-td-input" value={tax.charge_type || ''}
                                      onChange={e => updateTax(i, 'charge_type', e.target.value)}>
                                      <option value="On Net Total">On Net Total</option>
                                      <option value="Actual">Actual</option>
                                      <option value="On Previous Row Amount">On Prev Row</option>
                                    </select>
                                  </td>
                                  <td>
                                    <input className="so-td-input" value={tax.account_head || ''}
                                      onChange={e => updateTax(i, 'account_head', e.target.value)} />
                                  </td>
                                  <td>
                                    <input type="number" className="so-td-input" style={{ textAlign: 'right' }}
                                      value={tax.rate || ''} onChange={e => updateTax(i, 'rate', e.target.value)} />
                                  </td>
                                  <td>
                                    <input type="number" className="so-td-input" style={{ textAlign: 'right' }}
                                      value={tax.tax_amount || ''} onChange={e => updateTax(i, 'tax_amount', e.target.value)}
                                      disabled={tax.charge_type !== 'Actual'} />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                    {parseFloat(tax.total || 0).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button className="so-btn-danger" onClick={() => removeTaxRow(i)}><Trash2 size={13} /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Summary Bar */}
                    <div className="so-summary-bar">
                      <div className="so-summary-item">
                        <span className="so-summary-label">Total Qty</span>
                        <span className="so-summary-value">{form.total_qty || 0}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Net Total</span>
                        <span className="so-summary-value flex items-center gap-1"><DirhamIcon size={12} /> {Number(form.base_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Taxes</span>
                        <span className="so-summary-value flex items-center gap-1"><DirhamIcon size={12} /> {Number(form.total_taxes_and_charges || 0).toFixed(2)}</span>
                      </div>
                      <div className="so-summary-divider" />
                      <div className="so-summary-item">
                        <span className="so-summary-label">Grand Total</span>
                        <span className="so-summary-value grand flex items-center gap-1"><DirhamIcon size={14} /> {Number(form.rounded_total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Modal Footer */}
              {!isViewMode && (
                <div className="so-modal-footer">
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {editingDocName && form.docstatus === 0 && (
                      <button className="so-btn-danger" onClick={() => deleteOrder(editingDocName)}>
                        <Trash2 size={16} /> Delete Order
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="so-btn-secondary" onClick={closeModal}>Cancel</button>
                    {form.docstatus !== 1 && (
                      <button className="so-btn-primary" onClick={() => handleSave(false)} disabled={saving || isSubmitting}>
                        {saving ? <><Loader2 size={14} className="so-spinner" /> Saving...</> : 'Save Draft'}
                      </button>
                    )}
                    {form.docstatus !== 1 && (
                      <button className="so-btn-primary" onClick={() => handleSave(true)} disabled={saving || isSubmitting} style={{ background: themeColor }}>
                        {isSubmitting ? <><Loader2 size={14} className="so-spinner" /> Submitting...</> : 'Submit'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {showCamera && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: 0 }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: '#e0f2fe', color: '#0284c7', borderRadius: '0.5rem', display: 'flex', alignItems: 'center' }}>
                    <Camera size={20} />
                  </div>
                  <span style={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.85rem' }}>Sales Order Camera Scanner</span>
                </div>
                <button onClick={() => setShowCamera(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ position: 'relative', aspectRatio: '1.77778', borderRadius: '1rem', overflow: 'hidden', background: '#0f172a' }}>
                  <div id="so-scanner-reader" style={{ width: '100%', height: '100%' }}></div>
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowCamera(false)}
                    style={{ padding: '0.6rem 2rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ColumnConfigModal
          isOpen={showColConfig}
          onClose={() => setShowColConfig(false)}
          config={soColumns}
          onUpdate={handleColConfigUpdate}
          doctype="Sales Order"
          themeColor={themeColor}
        />
      </div>
    </>
  );
}

export default SalesOrder;
