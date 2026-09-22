import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, X, Trash2, Building2, Search, Calendar, Filter, MoreVertical, Package,
  Warehouse as WarehouseIcon, Percent, DollarSign, Loader2, Barcode, Palette, ChevronLeft, ChevronRight, Zap, CheckCircle2, CheckCircle, AlertTriangle, ExternalLink, Link, Edit2, Settings, Copy, ChevronDown, Printer, Save, Send, FileText, Box, CalendarDays, Hash, Receipt, LayoutGrid,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleTheme } from '../../Redux/Slices/userSlice';
import axios from 'axios';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import QuickItemCreateModal from '../Purchase/QuickItemCreateModal';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { promptSecretCode } from '../../utils/secretCodePrompt';
import AttachmentSection from './AttachmentSection';
import ListCustomizer from './ListCustomizer';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';
import { loadLocalMatrixConfig, fetchUserMatrixConfig, saveUserMatrixConfig } from '../../utils/tableMatrixHelper';

// Custom APIs (moved to standardized path)
const API_PATH = '/api/method/kyle_retail.retail_api.api';
const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

const RESOURCE_API = '/api/resource/Purchase Invoice';
const RESOURCE_BASE = '/api/resource';

const DEFAULT_PI_COLUMNS = [
  { id: 'barcode', label: 'Scan Barcode', visible: true, width: 130 },
  { id: 'item_code', label: 'Item Code', visible: true, width: 140 },
  { id: 'item_name', label: 'Item Name', visible: true, width: 150 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'custom_ref_sl_no', label: 'Ref / Supplier SL #', visible: true, width: 120 },
  { id: 'custom_pieces_per_box', label: 'UOM/Unit', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'UOM Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'discount_amount', label: 'Disc Amt (%)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price (Nos)', visible: true, width: 100 },
  { id: 'custom_box_selling_price', label: 'Selling Price (Box)', visible: true, width: 100 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 },
  { id: 'last_purchase_rate', label: 'Last Purchase Price', visible: true, width: 110 },
  { id: 'margin', label: 'Margin', visible: true, width: 95 }
];

const calculateItemMargin = (item) => {
  if (!item) return { marginPercent: null, profitAmount: null, isLoss: false };

  const uom = String(item.uom || 'Nos').trim().toLowerCase();
  let cost = 0;
  let sell = 0;

  if (uom === 'box') {
    const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
    cost = parseFloat(item.custom_box_price) || ((parseFloat(item.rate) || 0) * pPerBox);
    sell = parseFloat(item.custom_box_selling_price) || 0;
  } else if (uom === 'master box') {
    const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
    const bPerMB = parseFloat(item.custom_boxes_per_master_box) || 1;
    const totalPcs = (bPerMB * pPerBox) || 1;
    cost = parseFloat(item.custom_master_box_price) || ((parseFloat(item.rate) || 0) * totalPcs);
    sell = parseFloat(item.custom_master_box_selling_price) || 0;
  } else {
    // Default: Nos
    cost = parseFloat(item.rate) || 0;
    sell = parseFloat(item.custom_selling_price) || 0;
  }

  // Fallback: If primary sell is 0, check if the other unit's selling price is entered
  if (sell <= 0) {
    if (parseFloat(item.custom_selling_price) > 0 && parseFloat(item.rate) > 0) {
      cost = parseFloat(item.rate) || 0;
      sell = parseFloat(item.custom_selling_price) || 0;
    } else if (parseFloat(item.custom_box_selling_price) > 0) {
      const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
      cost = parseFloat(item.custom_box_price) || ((parseFloat(item.rate) || 0) * pPerBox);
      sell = parseFloat(item.custom_box_selling_price) || 0;
    }
  }

  if (sell <= 0 || cost <= 0) {
    return { marginPercent: null, profitAmount: null, isLoss: false };
  }

  const profitAmount = sell - cost;
  const marginPercent = (profitAmount / sell) * 100;
  const isLoss = profitAmount < 0;

  return {
    marginPercent: marginPercent.toFixed(1),
    profitAmount: profitAmount.toFixed(2),
    isLoss
  };
};


const getLocalISODate = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
};

const getLocalISOTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

const DEFAULT_PI_LIST_COLUMNS = [
  { key: 'name', label: 'INVOICE NUMBER' },
  { key: 'supplier_name', label: 'SUPPLIER' },
  { key: 'set_warehouse', label: 'BRANCH / WAREHOUSE' },
  { key: 'posting_date', label: 'DATE' },
  { key: 'status', label: 'STATUS' },
  { key: 'grand_total', label: 'AMOUNT' }
];

function PurchaseInvoiceList() {
  const dispatch = useDispatch();
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const [hiddenDefaults, setHiddenDefaults] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Invoice`;
      const saved = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Invoice');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.hiddenDefaults)) return parsed.hiddenDefaults;
      }
    } catch (e) {}
    return [];
  });
  const [customColumns, setCustomColumns] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Invoice`;
      const savedConfig = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Invoice');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed.customColumns)) return parsed.customColumns;
      }
      const saved = localStorage.getItem(`custom_columns_${user}_Purchase Invoice`) || localStorage.getItem('custom_columns_Purchase Invoice');
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
  const themeColor = isGreen ? '#10b981' : '#0082f6';
  const themeColorHover = isGreen ? '#059669' : '#0070d8';
  const themeLight = isGreen ? '#f0fdf4' : '#ebf4fe';

  // ----- Column Config -----
  const [columnConfig, setColumnConfig] = useState(() => loadLocalMatrixConfig('pi_column_config', DEFAULT_PI_COLUMNS));
  const [resizingCol, setResizingCol] = useState(null);

  useEffect(() => {
    fetchUserMatrixConfig('pi_column_config', DEFAULT_PI_COLUMNS).then(backendCols => {
      if (backendCols) setColumnConfig(backendCols);
    });
  }, []);

  const handleResizeMouseDown = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const targetCol = columnConfig.find(c => c.id === colId);
    const startWidth = parseInt(targetCol?.width || 100, 10);

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff);
      setColumnConfig(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      setResizingCol(null);
      // Persist to localStorage & backend
      setColumnConfig(currentCols => {
        saveUserMatrixConfig('pi_column_config', currentCols, DEFAULT_PI_COLUMNS);
        return currentCols;
      });
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setResizingCol(colId);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Direct Column Drag & Drop Reordering on Table Header
  const [draggedColId, setDraggedColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  const handleColumnDragStart = (e, colId) => {
    if (resizingCol) {
      e.preventDefault();
      return;
    }
    setDraggedColId(colId);
    e.dataTransfer.setData('text/plain', colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e, colId) => {
    e.preventDefault();
    if (draggedColId && draggedColId !== colId) {
      setDragOverColId(colId);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleColumnDragLeave = (e, colId) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleColumnDrop = (e, targetColId) => {
    e.preventDefault();
    const sourceColId = draggedColId || e.dataTransfer.getData('text/plain');
    if (sourceColId && targetColId && sourceColId !== targetColId) {
      setColumnConfig(prevCols => {
        const fromIndex = prevCols.findIndex(c => c.id === sourceColId);
        const toIndex = prevCols.findIndex(c => c.id === targetColId);
        if (fromIndex !== -1 && toIndex !== -1) {
          const newCols = [...prevCols];
          const [moved] = newCols.splice(fromIndex, 1);
          newCols.splice(toIndex, 0, moved);
          saveUserMatrixConfig('pi_column_config', newCols, DEFAULT_PI_COLUMNS);
          return newCols;
        }
        return prevCols;
      });
    }
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    saveUserMatrixConfig('pi_column_config', newConfig, DEFAULT_PI_COLUMNS);
    if (newConfig === null) {
      // Reset to defaults
      setColumnConfig([...DEFAULT_PI_COLUMNS]);
    } else {
      setColumnConfig(newConfig);
    }
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
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [quickItemInitialCode, setQuickItemInitialCode] = useState('');
  const [quickItemTargetRow, setQuickItemTargetRow] = useState(null);
  const [showPrimaryInfo, setShowPrimaryInfo] = useState(true);

  const handleSupplierCreate = async (name) => {
    try {
      const targetWarehouse = formData.set_warehouse || warehouse || localStorage.getItem('warehouse');
      
      // Fetch dynamic Supplier Groups from API
      let supplierGroups = ['All Supplier Groups', 'Local', 'Distributor', 'Services'];
      try {
        const groupRes = await axios.get('/api/resource/Supplier Group?fields=["name"]&limit=100', { withCredentials: true });
        if (groupRes.data?.data && Array.isArray(groupRes.data.data)) {
          supplierGroups = groupRes.data.data.map(g => g.name);
        }
      } catch (e) {
        console.warn("Using fallback supplier groups", e);
      }

      const groupOptionsHtml = supplierGroups.map(g => `<option value="${g}">${g}</option>`).join('');

      // Step 1: Clean Supplier Details Popup
      const { value: formValues } = await Swal.fire({
        title: '<div class="text-left font-black text-slate-800 text-lg flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Create New Supplier</div>',
        html: `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 12px; font-size: 12px; margin-top: 8px;">
            <div>
              <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">SUPPLIER NAME <span style="color:#ef4444">*</span></label>
              <input id="swal_supp_name" class="swal2-input !h-10 !m-0 !w-full !text-xs !font-bold !rounded-xl" value="${(name || '').trim()}" placeholder="Enter Supplier Legal / Trade Name" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">MOBILE NO</label>
                <input id="swal_supp_mobile" class="swal2-input !h-10 !m-0 !w-full !text-xs !rounded-xl" placeholder="e.g. 0501234567" />
              </div>
              <div>
                <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">EMAIL</label>
                <input id="swal_supp_email" type="email" class="swal2-input !h-10 !m-0 !w-full !text-xs !rounded-xl" placeholder="supplier@example.com" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">TAX ID / TRN (15 DIGITS)</label>
                <input id="swal_supp_tax" maxlength="15" class="swal2-input !h-10 !m-0 !w-full !text-xs !rounded-xl !font-mono" placeholder="100XXXXXXXXX003" />
              </div>
              <div>
                <label style="font-weight: 800; color: #334155; font-size: 11px; display: block; margin-bottom: 4px;">SUPPLIER GROUP</label>
                <select id="swal_supp_group" class="swal2-input !h-10 !m-0 !w-full !text-xs !bg-white !rounded-xl">
                  ${groupOptionsHtml}
                </select>
              </div>
            </div>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Next: Authorize →',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        customClass: { popup: '!rounded-2xl !p-6' },
        didOpen: () => {
          const taxInput = document.getElementById('swal_supp_tax');
          if (taxInput) {
            taxInput.addEventListener('input', (e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 15);
            });
          }
        },
        preConfirm: () => {
          const suppName = document.getElementById('swal_supp_name')?.value?.trim();
          const mobile = document.getElementById('swal_supp_mobile')?.value?.trim();
          const email = document.getElementById('swal_supp_email')?.value?.trim();
          const taxId = document.getElementById('swal_supp_tax')?.value?.trim();
          const suppGroup = document.getElementById('swal_supp_group')?.value;

          if (!suppName) {
            Swal.showValidationMessage('Supplier Name is required');
            return false;
          }
          if (taxId && taxId.length !== 15) {
            Swal.showValidationMessage('TAX ID / TRN must be exactly 15 digits');
            return false;
          }
          return { suppName, mobile, email, taxId, suppGroup };
        }
      });

      if (!formValues) return null;

      // Step 2: Mandatory Employee Secret Code Prompt
      const auth = await promptSecretCode({
        title: 'Authorize Supplier Creation',
        subtitle: `Enter Employee Secret Code to register "${formValues.suppName}"`,
        warehouse: targetWarehouse
      });
      if (!auth || !auth.secret_key) return null;

      Swal.fire({
        title: 'Creating & Linking...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const res = await axios.post(`${API_PATH}.create_supplier`, {
        supplier_name: formValues.suppName,
        supplier_type: "Company",
        supplier_group: formValues.suppGroup || "All Supplier Groups",
        custom_branch: targetWarehouse,
        secret_key: auth.secret_key,
        employee_name: auth.employee_name,
        employee_id: auth.employee_id,
        mobile_no: formValues.mobile,
        email_id: formValues.email,
        tax_id: formValues.taxId
      }, { withCredentials: true });

      if (res.data?.status === 'error' || res.data?.message?.status === 'error') {
        throw new Error(res.data?.message?.message || res.data?.message || 'Creation failed');
      }

      const msg = res.data?.message;
      const sName = (msg && typeof msg === 'object' && msg.name) || msg?.supplier_name || res.data?.data?.supplier || formValues.suppName;
      const authEmp = auth.employee_name || res.data?.data?.employee_name || 'Authorized Staff';

      Swal.fire({
        icon: 'success',
        title: 'Supplier Created',
        text: `Supplier "${sName}" successfully registered by ${authEmp}!`,
        timer: 2000,
        showConfirmButton: false
      });

      return { name: sName, supplier_name: sName };
    } catch (err) {
      console.error("Supplier create error:", err);
      Swal.fire({ icon: 'error', title: 'Registration Error', text: err.response?.data?.message || err.message });
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

  const handleBulkQtyOpen = () => {
    const validItems = formData.items.filter(it => it && it.item_code);
    if (validItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Items', text: 'Please add items before updating bulk quantity.' });
      return;
    }
    const lastItemIdx = formData.items.findLastIndex(it => it && it.item_code);
    const item = formData.items[lastItemIdx];
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
        const newQty = result.value || '';
        const field = item.use_box_entry ? 'custom_box_qty' : 'qty';
        handleItemChange(lastItemIdx, field, newQty);
      }
    });
  };

  const onGlobalSupplierSearch = async (query) => {
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.find_supplier_globally_retail', {
        params: { search_term: query },
        withCredentials: true
      });
      return res.data.message?.data || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const onActivateSupplier = async (supp) => {
    try {
      const sName = supp.name || supp.supplier_name;
      const targetWarehouse = formData.set_warehouse || warehouse || localStorage.getItem('warehouse');

      // Prompt Employee Secret Code
      const auth = await promptSecretCode({
        title: 'Activate Supplier Authorization',
        subtitle: `Enter Secret Code to sync "${sName}" to ${targetWarehouse}`,
        warehouse: targetWarehouse
      });
      if (!auth) return false;

      const res = await axios.post('/api/method/kyle_retail.retail_api.api.enable_supplier_for_branch_retail', {
        supplier: sName,
        supplier_name: sName,
        warehouse: targetWarehouse,
        secret_key: auth.secret_key,
        employee_name: auth.employee_name,
        employee_id: auth.employee_id
      }, { withCredentials: true });

      if (res.data.message?.success || res.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Supplier Activated',
          text: `${supp.supplier_name || supp.name} authorized by ${auth.employee_name} and linked to your branch!`,
          timer: 1800,
          showConfirmButton: false
        });
        return true;
      }
      return false;
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
      return false;
    }
  };

  const onGlobalItemSearch = async (query) => {
    console.log('[PurchaseInvoice] onGlobalItemSearch called with query:', query);
    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.find_item_globally_retail', {
        params: { search_term: query },
        withCredentials: true
      });
      console.log('[PurchaseInvoice] onGlobalItemSearch API response:', res.data);
      const items = res.data?.message?.data || res.data?.message || [];
      console.log('[PurchaseInvoice] onGlobalItemSearch returning items:', items);
      return items;
    } catch (e) {
      console.error('[PurchaseInvoice] onGlobalItemSearch error:', e);
      return [];
    }
  };

  const onActivateItem = async (item) => {
    console.log('[PurchaseInvoice] onActivateItem called with item:', item);
    try {
      const targetWh = formData.set_warehouse || warehouse || localStorage.getItem('warehouse');
      console.log('[PurchaseInvoice] target warehouse for activation:', targetWh);
      const res = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.enable_item_for_branch_retail', {
        item_code: item.name || item.item_code,
        warehouse: targetWh
      }, { withCredentials: true });
      console.log('[PurchaseInvoice] onActivateItem API response:', res.data);
      if (res.data?.message?.success || res.data?.success) {
        Swal.fire({ icon: 'success', title: 'Item Activated', text: `${item.item_name || item.name} linked to your branch!`, timer: 1500, showConfirmButton: false });
        return true;
      }
      return false;
    } catch (e) {
      console.error('[PurchaseInvoice] onActivateItem error:', e);
      Swal.fire('Error', e.message, 'error');
      return false;
    }
  };

  // NEW: Warehouses State (filtered for non-group)
  const [warehouses, setWarehouses] = useState([]);

  const initialState = {
    name: '', supplier: '', supplier_name: '',
    posting_date: getLocalISODate(),
    due_date: '', bill_no: '', bill_date: '',
    custom_supplier_invoice_amount: '',
    custom_supplier_invoice_status: '',
    update_stock: true,
    accepted_warehouse: warehouse || '',
    rejected_warehouse: '',
    is_subcontracted: false,
    apply_discount_on: 'Grand Total',
    additional_discount_percentage: 0,
    discount_amount: 0,
    taxes_and_charges: '',
    is_cash_purchase: false,
    items: [{ item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_selling_price: 0 }],
    docstatus: 0
  };

  const [formData, setFormData] = useState(initialState);
  const latestItemsRef = useRef([]);
  useEffect(() => {
    if (formData && formData.items) {
      const validItems = formData.items.filter(i => i && i.item_code);
      if (validItems.length > 0) {
        latestItemsRef.current = validItems;
      }
    }
  }, [formData.items]);

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
  const getTodayDate = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
  };

  const [filterDateFrom, setFilterDateFrom] = useState(() => getTodayDate());
  const [filterDateTo, setFilterDateTo] = useState(() => getTodayDate());
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
        const grossRate = parseFloat(i.price_list_rate || i.rate || 0);
        const perUnitDisc = parseFloat(i.discount_amount || 0);
        const totalRowDisc = parseFloat((perUnitDisc * (invoiceQty > 0 ? invoiceQty : 1)).toFixed(2));
        const netAmount = Math.max(0, (invoiceQty * grossRate) - totalRowDisc).toFixed(2);

        return {
          name: '',
          item_code: i.item_code || '',
          item_name: i.item_name || '',
          qty: invoiceQty,
          uom: i.uom || '',
          rate: grossRate,
          amount: parseFloat(i.amount || netAmount || 0),
          custom_box_qty: boxQty,
          custom_pieces_per_box: pcsPerBox,
          custom_box_price: parseFloat(i.custom_box_price || (grossRate * pcsPerBox) || 0),
          custom_selling_price: parseFloat(i.custom_selling_price || 0),
          custom_box_selling_price: parseFloat(i.custom_box_selling_price || 0),
          discount_amount: totalRowDisc,
          discount_percentage: parseFloat(i.discount_percentage || 0),
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

      let paymentTerms = pr.payment_terms || pr.payment_terms_template || '';
      let creditDays = 0;
      if (pr.supplier) {
        try {
          const suppRes = await axios.get(`${LEGACY_API}.get_supplier_details`, {
            params: { supplier_name: pr.supplier },
            withCredentials: true
          });
          if (suppRes.data.message) {
            paymentTerms = suppRes.data.message.payment_terms || paymentTerms;
            creditDays = suppRes.data.message.credit_days || 0;
          }
        } catch (e) { }
      }
      if (!creditDays && paymentTerms) {
        creditDays = parseCreditDays(paymentTerms);
      }
      const postingDate = pr.posting_date || getLocalISODate();
      const calculatedDueDate = calcDueDate(postingDate, false, creditDays);

      setFormData({
        name: '',
        supplier: pr.supplier || '',
        supplier_name: pr.supplier_name || pr.supplier || '',
        payment_terms_template: paymentTerms,
        credit_days: creditDays,
        posting_date: postingDate,
        due_date: calculatedDueDate,
        bill_no: pr.supplier_delivery_note || '',
        bill_date: postingDate,
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
        setFormData(prev => {
          const updated = {
            ...prev,
            per_received: details.per_received ?? prev.per_received,
            per_billed: details.per_billed ?? prev.per_billed,
            grand_total: details.grand_total ?? prev.grand_total
          };
          // Only update lastSavedData if it's already set (meaning we are not in the middle of editing a new unsaved doc)
          if (targetName) {
            setLastSavedData(JSON.stringify(updated));
          }
          return updated;
        });
      }
    } catch (err) { console.error("Workflow fetch failed", err); }
  }, [docName]);

  const handleDocAction = async (action) => {
    if (action === 'save' || action === 'submit') {
      const errors = {};
      if (!formData.supplier) errors.supplier = 'Supplier is required';
      if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
      if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';
      // Check if Selling Price is specified and valid
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
            Swal.fire('Selling Price Required', `Row #${i + 1} (${item.item_name || item.item_code}): Selling Price (Box) is MANDATORY for Box UOM!`, 'error');
            return;
          }
        } else if (currentUom === 'nos') {
          if (!sellPriceNos || sellPriceNos <= 0) {
            Swal.fire('Selling Price Required', `Row #${i + 1} (${item.item_name || item.item_code}): Selling Price (NOS) is MANDATORY!`, 'error');
            return;
          }
        }

        if (sellPriceNos > 0 && buyRateNos > 0 && sellPriceNos < buyRateNos) {
          Swal.fire({
            icon: 'error',
            title: 'Price Restriction Error',
            html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Selling Price (<b>AED ${sellPriceNos.toFixed(2)}</b>) cannot be LESS than Buying Price (<b>AED ${buyRateNos.toFixed(2)}</b>)!`
          });
          return;
        }

        if (sellPriceBox > 0 && buyPriceBox > 0 && sellPriceBox < buyPriceBox) {
          Swal.fire({
            icon: 'error',
            title: 'Box Price Restriction Error',
            html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Box Selling Price (<b>AED ${sellPriceBox.toFixed(2)}</b>) cannot be LESS than Box Buying Price (<b>AED ${buyPriceBox.toFixed(2)}</b>)!`
          });
          return;
        }
      }

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
        setLastSavedData(JSON.stringify(formData)); // Update base for dirty check after save
        Swal.fire({
          icon: 'success',
          title: `${action === 'save' ? 'Draft Saved' : action === 'submit' ? 'Invoice Submitted' : action.toUpperCase() + ' Successful'}`,
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });

        if (action === 'delete') {
          closeModal();
          fetchInvoices();
          return;
        }

        if (action === 'submit') {
          fetchInvoices();
          setSearchParams({ name: 'new' }, { replace: true });
          return;
        }

        const returnedDoc = rawMsg.data || {};
        const nextDoc = returnedDoc.name || rawMsg.new_name || rawMsg.docname || rawMsg.name || docName;
        const currentIsCash = !!payload?.custom_is_cash_purchase;

        if (nextDoc) {
          setDocName(nextDoc);
          setSearchParams({ name: nextDoc });
          await fetchPurchaseInvoice(nextDoc);
          // Preserve local cash purchase selection explicitly
          setFormData(prev => ({
            ...prev,
            is_cash_purchase: currentIsCash
          }));
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
      e.preventDefault();
      const code = barcodeInput.trim();
      setBarcodeLoading(true);
      try {
        const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
        const res = await axios.get(`${API_PATH}.get_item_by_barcode_pi?${warehouseParam}`, {
          params: { barcode: code },
          withCredentials: true
        });
        const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;

        if (item && item.item_code) {
          setFormData(prev => {
            const scannedUomStr = String(item.scanned_uom || item.uom || '').toLowerCase();
            const isMasterBoxScan = scannedUomStr === 'master box';
            const isBoxScan = scannedUomStr === 'box';
            const isBoxOrMbScan = isMasterBoxScan || isBoxScan;
            const pcsPerBox = parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || 1) || 1;
            const boxesPerMb = parseFloat(item.custom_boxes_per_master_box || 1) || 1;

            // Check if item already exists in table
            const existingIdx = items.findIndex(i =>
              i.item_code === item.item_code &&
              (isMasterBoxScan
                ? (i.uom || '').toLowerCase() === 'master box'
                : isBoxScan
                ? (i.uom || '').toLowerCase() === 'box'
                : !i.use_box_entry)
            );

            if (existingIdx !== -1) {
              // Increment Qty for existing item
              const existing = { ...items[existingIdx] };
              if (isMasterBoxScan) {
                existing.custom_box_qty = (parseFloat(existing.custom_box_qty) || 0) + 1;
                existing.qty = Math.round(existing.custom_box_qty * boxesPerMb * pcsPerBox);
              } else if (isBoxScan || existing.use_box_entry) {
                existing.custom_box_qty = (parseFloat(existing.custom_box_qty) || 0) + 1;
                existing.qty = Math.round(existing.custom_box_qty * pcsPerBox);
              } else {
                existing.qty = (parseFloat(existing.qty) || 0) + 1;
                if (pcsPerBox > 0) existing.custom_box_qty = existing.qty / pcsPerBox;
              }
              existing.amount = (existing.qty * (parseFloat(existing.rate) || 0)).toFixed(2);
              items[existingIdx] = existing;
            } else {
              // Prepare new item row object
              const isBoxUom = isBoxScan || (item.stock_uom || '').toLowerCase() === 'box';
              const lastPurRate = parseFloat(item.last_purchase_rate || item.last_buying_rate || item.rate || 0);
              const selectedUom = isMasterBoxScan ? 'Master Box' : (isBoxUom ? 'Box' : (item.stock_uom || 'Nos'));
              const calcQty = isMasterBoxScan ? Math.round(boxesPerMb * pcsPerBox) : (isBoxUom ? Math.round(pcsPerBox) : 1);

              const newItemRow = {
                item_code: item.item_code,
                item_name: item.item_name,
                barcode: code,
                scanned_barcode: code,
                uom: selectedUom,
                qty: calcQty,
                rate: lastPurRate,
                custom_selling_price: parseFloat(item.custom_selling_price || 0),
                custom_box_selling_price: parseFloat(item.custom_box_selling_price || (parseFloat(item.custom_selling_price || 0) * pcsPerBox)),
                custom_master_box_selling_price: parseFloat(item.custom_master_box_selling_price || (parseFloat(item.custom_selling_price || 0) * pcsPerBox * boxesPerMb)),
                custom_pieces_per_box: pcsPerBox,
                default_pieces_per_box: pcsPerBox,
                custom_boxes_per_master_box: boxesPerMb,
                default_boxes_per_master_box: boxesPerMb,
                custom_box_qty: 1,
                custom_box_price: (lastPurRate * pcsPerBox),
                custom_master_box_price: (lastPurRate * pcsPerBox * boxesPerMb),
                use_box_entry: isBoxOrMbScan,
                amount: (calcQty * lastPurRate).toFixed(2),
                last_purchase_rate: lastPurRate,
                last_buying_rate: lastPurRate
              };

              // If last row in table is empty (unselected), replace it. Otherwise append a new row!
              const lastIdx = items.length - 1;
              if (lastIdx >= 0 && !items[lastIdx].item_code) {
                items[lastIdx] = newItemRow;
              } else {
                items.push(newItemRow);
              }
            }

            return { ...prev, items };
          });

          // Focus to UOM field of the scanned item row
          setTimeout(() => {
            const uomSelects = document.querySelectorAll('select[data-field="uom"], table select');
            if (uomSelects && uomSelects.length > 0) {
              const lastUom = uomSelects[uomSelects.length - 1];
              if (lastUom) lastUom.focus();
            }
          }, 150);
        } else {
          alert('Item not found for barcode: ' + code);
          setBarcodeInput('');
          barcodeRef.current?.focus();
        }
      } catch (err) {
        console.error('Barcode fetch error:', err);
        alert('Error fetching item by barcode');
        setBarcodeInput('');
        barcodeRef.current?.focus();
      } finally {
        setBarcodeLoading(false);
        setBarcodeInput('');
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
      const data = Array.isArray(res.data.message) ? res.data.message : [];
      setSuppliers(data);
      return data;
    } catch (err) {
      setSuppliers([]);
      return [];
    }
  };

  const fetchItems = async (query = '') => {
    try {
      const searchValue = String(query || '').trim();

      const res = await axios.get(`${LEGACY_API}.get_items_for_pi`, {
        params: {
          query: searchValue || undefined,
          warehouse: !isAdmin ? warehouse : undefined
        },
        withCredentials: true
      });

      let data = Array.isArray(res.data.message) ? res.data.message : [];

      /*
       * IMPORTANT:
       * If the user entered/scanned a barcode, verify it using
       * the barcode-specific API and attach the scanned barcode
       * to the returned item.
       */
      if (/^\d+$/.test(searchValue)) {
        try {
          const warehouseParam =
            !isAdmin && warehouse
              ? `&warehouse=${encodeURIComponent(warehouse)}`
              : '';

          const barcodeRes = await axios.get(
            `${API_PATH}.get_item_by_barcode_pi?${warehouseParam}`,
            {
              params: { barcode: searchValue },
              withCredentials: true
            }
          );

          const barcodeItem = Array.isArray(barcodeRes.data.message)
            ? barcodeRes.data.message[0]
            : barcodeRes.data.message;

          if (barcodeItem?.item_code) {
            const barcodeItemCode = barcodeItem.item_code;

            data = data.map(item =>
              item.item_code === barcodeItemCode
                ? {
                    ...item,
                    barcode: searchValue,
                    scanned_barcode: searchValue
                  }
                : item
            );

            /*
             * If get_items_for_pi didn't return the item,
             * add the barcode API result directly.
             */
            if (!data.some(item => item.item_code === barcodeItemCode)) {
              data.unshift({
                ...barcodeItem,
                barcode: searchValue,
                scanned_barcode: searchValue
              });
            }
          }
        } catch (barcodeErr) {
          console.log(
            '[PurchaseInvoice] Barcode verification failed:',
            barcodeErr
          );
        }
      }

      console.log(
        '[PurchaseInvoice fetchItems API] Query:',
        query,
        'Returned items sample:',
        data.slice(0, 3)
      );

      setItemsList(data);
      return data;
    } catch (err) {
      console.error('[PurchaseInvoice fetchItems API Error]:', err);
      setItemsList([]);
      return [];
    }
  };
  const fetchItemsAPI = fetchItems;

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

  const handlePrintPDF = (nameToPrint) => {
    const docToPrint = nameToPrint || docName || formData.name;
    if (!docToPrint) return;
    const printUrl = `/api/method/frappe.utils.print_format.download_pdf?doctype=Purchase%20Invoice&name=${encodeURIComponent(docToPrint)}&format=Retail%20Purchase%20Invoice&no_letterhead=1&letterhead=No%20Letterhead&settings=%7B%7D&_lang=en&pdf_generator=wkhtmltopdf`;
    window.open(printUrl, '_blank');
  };

  const handleDuplicate = () => {
    setDocName('');
    setDocStatus(0);
    setFormData(prev => {
      const cleanedItems = (prev.items || []).map(item => {
        const {
          name, parent, parenttype, parentfield, creation, modified, modified_by, owner, docstatus,
          received_qty, billed_amt, returned_qty,
          purchase_order, purchase_order_item, purchase_receipt, purchase_receipt_item, purchase_invoice_item,
          ...rest
        } = item;
        return {
          ...rest,
          name: '',
          docstatus: 0,
          received_qty: 0,
          billed_amt: 0,
          returned_qty: 0,
          purchase_order: '',
          purchase_order_item: '',
          purchase_receipt: '',
          purchase_receipt_item: '',
          purchase_invoice_item: ''
        };
      });
      return {
        ...prev,
        name: '',
        status: 'Draft',
        docstatus: 0,
        amended_from: null,
        posting_date: getLocalISODate(),
        posting_time: getLocalISOTime(),
        bill_date: getLocalISODate(),
        bill_no: '',
        due_date: getLocalISODate(),
        outstanding_amount: 0,
        paid_amount: 0,
        base_paid_amount: 0,
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

  const fetchPurchaseInvoice = useCallback(async (name) => {
    try {
      const res = await axios.get(`${LEGACY_API}.get_purchase_invoice`, { params: { name }, withCredentials: true });
      if (res.data.message?.success) {
        const d = res.data.message.data;
        let paymentTerms = d.payment_terms_template || d.payment_terms || '';
        let creditDays = parseCreditDays(paymentTerms);

        if (d.supplier) {
          try {
            const suppRes = await axios.get(`${LEGACY_API}.get_supplier_details`, {
              params: { supplier_name: d.supplier },
              withCredentials: true
            });
            if (suppRes.data.message) {
              if (suppRes.data.message.payment_terms) {
                paymentTerms = suppRes.data.message.payment_terms;
              }
              if (suppRes.data.message.credit_days) {
                creditDays = suppRes.data.message.credit_days;
              }
            }
          } catch (err) { }
        }

        const mapped = {
          name: d.name,
          supplier: d.supplier,
          supplier_name: d.supplier_name || d.supplier,
          payment_terms_template: paymentTerms,
          credit_days: creditDays,
          posting_date: d.posting_date.split('T')[0],
          due_date: d.due_date ? d.due_date.split('T')[0] : '',
          bill_no: d.bill_no || '',
          bill_date: d.bill_date ? d.bill_date.split('T')[0] : '',
          custom_supplier_invoice_amount: d.custom_supplier_invoice_amount || '',
          custom_supplier_invoice_status: d.custom_supplier_invoice_status || '',
          update_stock: !!d.update_stock,
          accepted_warehouse: d.accepted_warehouse || '',
          rejected_warehouse: d.rejected_warehouse || '',
          is_subcontracted: !!d.is_subcontracted,
          is_cash_purchase: formData.is_cash_purchase || !!(d.custom_is_cash_purchase || d.is_cash_purchase),
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
            discount_percentage: i.discount_percentage !== undefined && i.discount_percentage !== null ? parseFloat(i.discount_percentage) : 0,
            discount_amount: i.discount_amount !== undefined && i.discount_amount !== null
              ? (() => {
                const calc = parseFloat(i.discount_amount) * (parseFloat(i.qty) || 1);
                return Math.abs(calc - Math.round(calc)) < 0.05 ? Math.round(calc) : parseFloat(calc.toFixed(2));
              })()
              : 0,
            custom_box_qty: parseFloat(i.custom_box_qty || 0),
            custom_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
            default_pieces_per_box: parseFloat(i.custom_pieces_per_box || 1),
            custom_box_price: parseFloat(i.custom_box_price || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_box_selling_price: parseFloat(i.custom_box_selling_price || 0) > 0
              ? parseFloat(i.custom_box_selling_price)
              : ((parseFloat(i.custom_selling_price || 0) * (parseFloat(i.custom_pieces_per_box) || 1)) || 0),
            custom_supplier_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            custom_ref_sl_no: i.custom_ref_sl_no || i.custom_supplier_sl_num || '',
            purchase_order: i.purchase_order || '',
            purchase_order_item: i.purchase_order_item || '',
            po_detail: i.po_detail || i.purchase_order_item || '',
            purchase_receipt: i.purchase_receipt || '',
            pr_detail: i.pr_detail || '',
            use_box_entry: ['box', 'master box'].includes((i.uom || '').toLowerCase())
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

        setFormData(prev => {
          let enrichedWithRates = mapped.items;
          const refItems = latestItemsRef.current;
          if (refItems && refItems.length > 0) {
            enrichedWithRates = mapped.items.map((mappedItem, idx) => {
              const prevItem = (refItems[idx] && refItems[idx].item_code === mappedItem.item_code)
                 ? refItems[idx]
                 : refItems.find(pi => pi.item_code === mappedItem.item_code);
                 
              if (prevItem) {
                return { 
                  ...mappedItem, 
                  last_purchase_rate: prevItem.last_purchase_rate !== undefined ? prevItem.last_purchase_rate : (mappedItem.last_purchase_rate || 0),
                  last_buying_rate: prevItem.last_buying_rate !== undefined ? prevItem.last_buying_rate : (mappedItem.last_buying_rate || 0)
                };
              }
              return mappedItem;
            });
          }
          const finalMapped = { ...mapped, items: enrichedWithRates };
          setTimeout(() => setLastSavedData(JSON.stringify(finalMapped)), 0); // FIX: Set lastSavedData safely
          return finalMapped;
        });
        setSearchSupplier(d.supplier_name || d.supplier);
        setDocName(d.name);
        setDocStatus(parseInt(d.docstatus) || 0); // Store docstatus

        // Fetch linked documents if it's already created
        if (d.name) {
          fetchLinkedDocuments(d.name);
          fetchWorkflowActions(d.name); // Explicitly fetch workflow actions with the name
        }

        const isDraft = (parseInt(d.docstatus) || 0) === 0;
        setIsViewMode(!isDraft ? true : false);
        setIsEditMode(isDraft);
        setIsModalOpen(true);
        return mapped;
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      if (err.response?.status === 404) {
        setSearchParams({}, { replace: true });
      } else {
        alert('Failed to load invoice: ' + (err.response?.data?.message || err.message));
      }
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
          '<span style="font-size: 1rem; font-weight: 900; color: #10b981; display: inline-flex; align-items: center; gap: 3px;"><svg viewBox="0 0 344.84 299.91" style="width: 14px; height: 12px; display: inline-block; fill: currentColor; margin-right: 2px;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg> ' + (parseFloat(formData.outstanding_amount !== undefined ? formData.outstanding_amount : formData.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '</span>' +
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
          '<label style="font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 4px; margin-bottom: 5px;">Amount to Pay <svg viewBox="0 0 344.84 299.91" style="width: 12px; height: 10px; display: inline-block; fill: currentColor;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg></label>' +
          '<input id="swal-amount" type="text" inputMode="decimal" class="swal2-input" style="margin: 0; width: 100%;" value="' + (parseFloat(formData.outstanding_amount !== undefined ? formData.outstanding_amount : formData.grand_total) || 0).toFixed(2) + '">' +
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
          title: 'Payment Entry Created & Submitted',
          text: `Payment Entry ${msg.name} created & submitted successfully!`,
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
      <div className="erp-card so-card" style={{ marginBottom: '1.5rem', border: `1px solid ${themeColor}20`, background: `${themeColor}05` }}>
        <div className="erp-section-header so-card-header" style={{ borderBottom: `1px solid ${themeColor}10`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    className="erp-button erp-button-primary so-btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0.5rem 1rem', fontSize: '0.7rem', background: '#eab308', borderColor: '#eab308' }}
                  >
                    <Plus size={14} /> Create Payment Entry
                  </button>
                  <button
                    onClick={handleCreateReturn}
                    disabled={saving}
                    className="erp-button erp-button-secondary so-btn-secondary"
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

      const uom = (items[index].uom || '').toLowerCase();
      const isMasterBox = uom === 'master box';
      const isBox = uom === 'box';

      if (field === 'custom_box_qty' || field === 'custom_pieces_per_box' || field === 'custom_boxes_per_master_box') {
        const box_qty = parseFloat(field === 'custom_box_qty' ? value : items[index].custom_box_qty) || 0;
        const pcs_per_box = parseFloat(field === 'custom_pieces_per_box' ? value : items[index].custom_pieces_per_box) || 1;
        const boxes_per_mb = parseFloat(field === 'custom_boxes_per_master_box' ? value : items[index].custom_boxes_per_master_box) || 1;

        if (isMasterBox) {
          const total_qty = Math.round(box_qty * boxes_per_mb * pcs_per_box);
          items[index].qty = total_qty;
        } else if (isBox) {
          const total_qty = Math.round(box_qty * pcs_per_box);
          items[index].qty = total_qty;
        } else {
          items[index].qty = Math.round(box_qty);
        }
        items[index][field] = value;
      } else if (field === 'custom_selling_price') {
        items[index].custom_selling_price = value;
      } else if (field === 'custom_box_selling_price') {
        items[index].custom_box_selling_price = value;
      } else {
        items[index][field] = value;
      }

      const qty = parseFloat(items[index].qty) || 0;
      const rate = parseFloat(items[index].rate) || 0;
      const pPerBox = parseFloat(items[index].custom_pieces_per_box) || 1;
      const boxesPerMB = parseFloat(items[index].custom_boxes_per_master_box) || 1;
      const baseTotal = qty * rate;

      if (field === 'discount_percentage') {
        const discPct = value === '' ? '' : parseFloat(value);
        items[index].discount_percentage = discPct;
        const numericPct = parseFloat(discPct) || 0;
        items[index].discount_amount = parseFloat((baseTotal * (numericPct / 100)).toFixed(2));
      } else if (field === 'discount_amount') {
        const discAmt = value === '' ? '' : parseFloat(value);
        items[index].discount_amount = discAmt;
        const numericAmt = parseFloat(discAmt) || 0;
        items[index].discount_percentage = baseTotal > 0 ? parseFloat(((numericAmt / baseTotal) * 100).toFixed(2)) : 0;
      } else if (parseFloat(items[index].discount_percentage) > 0) {
        // Recalculate discount_amount if rate or qty changed
        const discPct = parseFloat(items[index].discount_percentage) || 0;
        items[index].discount_amount = parseFloat((baseTotal * (discPct / 100)).toFixed(2));
      }

      const discAmt = parseFloat(items[index].discount_amount) || 0;
      items[index].amount = Math.max(0, baseTotal - discAmt).toFixed(2);

      if (field === 'custom_master_box_price') {
        const mbPrice = parseFloat(value) || 0;
        const totalPcsInMB = boxesPerMB * pPerBox;
        const newRate = totalPcsInMB > 0 ? mbPrice / totalPcsInMB : 0;
        items[index].rate = newRate.toFixed(2);
        items[index].custom_box_price = (newRate * pPerBox).toFixed(2);
        items[index].amount = Math.max(0, (qty * newRate) - discAmt).toFixed(2);
      } else if (field === 'custom_box_price') {
        const bp = parseFloat(value) || 0;
        const newRate = pPerBox > 0 ? bp / pPerBox : 0;
        items[index].rate = newRate.toFixed(2);
        items[index].custom_master_box_price = (bp * boxesPerMB).toFixed(2);
        items[index].amount = Math.max(0, (qty * newRate) - discAmt).toFixed(2);
      } else if (field === 'rate') {
        items[index].custom_box_price = (rate * pPerBox).toFixed(2);
        items[index].custom_master_box_price = (rate * pPerBox * boxesPerMB).toFixed(2);
      }

      if (field === 'qty') {
        if (isMasterBox && boxesPerMB * pPerBox > 0) {
          items[index].custom_box_qty = Math.round(qty / (boxesPerMB * pPerBox));
        } else if (isBox && pPerBox > 0) {
          items[index].custom_box_qty = Math.round(qty / pPerBox);
        }
      }

      return { ...prev, items };
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
          if (next) {
            next.focus();
            if (next.tagName === 'INPUT' && next.select) next.select();
            next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
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

  const addItemRow = () => setFormData(prev => ({
    ...prev,
    items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0, custom_box_qty: 0, custom_pieces_per_box: 1, custom_boxes_per_master_box: 1, custom_box_price: 0, custom_master_box_price: 0, custom_selling_price: 0, custom_supplier_sl_num: '', custom_ref_sl_no: '' }]
  }));

  const removeItemRow = (index) => setFormData(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== index)
  }));

  const parseCreditDays = (paymentTerms) => {
    if (!paymentTerms) return 0;
    const match = paymentTerms.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const calcDueDate = (postingDate, isCashPurchase, creditDays) => {
    if (isCashPurchase || !creditDays || creditDays <= 0) {
      return postingDate || getLocalISODate();
    }
    const d = new Date(postingDate || getLocalISODate());
    d.setDate(d.getDate() + parseInt(creditDays));
    return d.toISOString().split('T')[0];
  };

  const selectSupplier = (supplier) => {
    const sName = typeof supplier === 'object' ? (supplier.name || supplier.supplier_name) : supplier;
    const paymentTerms = supplier?.payment_terms || '';
    let creditDays = supplier?.credit_days || 0;
    if (!creditDays && paymentTerms) {
      creditDays = parseCreditDays(paymentTerms);
    }

    setFormData(prev => {
      const postingDate = prev.posting_date || getLocalISODate();
      const calculatedDueDate = calcDueDate(postingDate, prev.is_cash_purchase, creditDays);
      const schedule = (prev.payment_schedule || []).map(row => ({
        ...row,
        due_date: calculatedDueDate
      }));
      return {
        ...prev,
        supplier: sName,
        supplier_name: supplier.supplier_name || sName,
        payment_terms_template: paymentTerms,
        credit_days: creditDays,
        due_date: calculatedDueDate,
        payment_schedule: schedule
      };
    });
    setSearchSupplier(typeof supplier === 'object' ? (supplier.supplier_name || sName) : sName);
    setShowSupplierDropdown(false);
  };
  const handleSupplierSelect = selectSupplier;

  const handleUOMChange = async (uomValue, rowIndex) => {
    const safeUom = String(uomValue || 'Nos');
    const normUom = safeUom.toLowerCase();
    const isMasterBox = normUom === 'master box';
    const isBox = normUom === 'box';

    setFormData(prev => {
      let items = [...prev.items];
      if (rowIndex < 0 || rowIndex >= items.length) return prev;
      const item = { ...items[rowIndex] };

      item.uom = isMasterBox ? 'Master Box' : (isBox ? 'Box' : 'Nos');
      item.use_box_entry = isBox || isMasterBox;

      const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
      const bPerMB = parseFloat(item.default_boxes_per_master_box || item.custom_boxes_per_master_box) || 1;
      const totalPcsInMB = bPerMB * pPerBox;

      item.custom_pieces_per_box = pPerBox;
      item.custom_boxes_per_master_box = bPerMB;

      // Dynamically select the barcode matching this UOM
      const bcList = item.barcode_details || item.barcodes || [];
      const matchingBc = Array.isArray(bcList) ? bcList.find(b => {
        if (typeof b === 'object' && b !== null) {
          return (b.uom || '').toLowerCase() === normUom;
        }
        return false;
      }) : null;
      if (matchingBc && matchingBc.barcode) {
        item.barcode = matchingBc.barcode;
        item.scanned_barcode = matchingBc.barcode;
      }

      const baseRate = parseFloat(item.base_nos_rate || (item.use_box_entry ? (parseFloat(item.custom_box_price) / pPerBox) : item.rate) || item.rate) || 0;
      item.base_nos_rate = baseRate;

      let currentRate = baseRate;
      if (isMasterBox) {
        item.custom_box_qty = 1;
        item.qty = Math.round(1 * totalPcsInMB);
        const mbPrice = parseFloat(item.custom_master_box_price) > 0 ? parseFloat(item.custom_master_box_price) : (baseRate * totalPcsInMB);
        item.custom_master_box_price = mbPrice;
        currentRate = totalPcsInMB > 0 ? (mbPrice / totalPcsInMB) : baseRate;
        item.rate = currentRate;
      } else if (isBox) {
        item.custom_box_qty = 1;
        item.qty = Math.round(pPerBox);
        const bPrice = parseFloat(item.custom_box_price) > 0 ? parseFloat(item.custom_box_price) : (baseRate * pPerBox);
        item.custom_box_price = bPrice;
        currentRate = pPerBox > 0 ? (bPrice / pPerBox) : baseRate;
        item.rate = currentRate;
      } else {
        item.qty = 1;
        item.custom_box_qty = 1;
        currentRate = baseRate;
        item.rate = currentRate;
      }

      item.amount = (parseFloat(item.qty) * currentRate).toFixed(2);
      items[rowIndex] = item;

      return { ...prev, items };
    });

    // Fetch exact price list rate and barcodes for the newly selected UOM
    try {
      const targetItem = formData.items?.[rowIndex];
      if (targetItem?.item_code) {
        const selectedUomParam = isMasterBox ? 'Master Box' : (isBox ? 'Box' : 'Nos');
        const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
          params: {
            item_code: targetItem.item_code,
            warehouse: formData.accepted_warehouse || warehouse || undefined,
            uom: selectedUomParam
          },
          withCredentials: true
        });
        if (res.data?.message) {
          const d = res.data.message;
          const buyingRate = parseFloat(d.rate) || 0;
          const boxBuyingPrice = parseFloat(d.box_price) || 0;
          const masterBoxBuyingPrice = parseFloat(d.master_box_price) || 0;
          const newBcList = d.barcode_details || d.barcodes || [];

          setFormData(currentForm => {
            const items = [...currentForm.items];
            if (items[rowIndex] && items[rowIndex].item_code === targetItem.item_code) {
              const cur = { ...items[rowIndex] };
              if (buyingRate > 0) cur.base_nos_rate = buyingRate;
              if (buyingRate > 0) cur.rate = buyingRate;
              if (boxBuyingPrice > 0) cur.custom_box_price = boxBuyingPrice;
              if (masterBoxBuyingPrice > 0) cur.custom_master_box_price = masterBoxBuyingPrice;
              if (Array.isArray(newBcList) && newBcList.length > 0) {
                cur.barcode_details = newBcList;
                cur.barcodes = newBcList;
                const matchingBc = newBcList.find(b => {
                  if (typeof b === 'object' && b !== null) {
                    return (b.uom || '').toLowerCase() === normUom;
                  }
                  return false;
                });
                if (matchingBc && matchingBc.barcode) {
                  cur.barcode = matchingBc.barcode;
                  cur.scanned_barcode = matchingBc.barcode;
                }
              }
              cur.amount = (parseFloat(cur.qty || 1) * (parseFloat(cur.rate) || buyingRate)).toFixed(2);
              items[rowIndex] = cur;
            }
            return { ...currentForm, items };
          });
        }
      }
    } catch (e) {
      // Keep local calculation
    }
  };

  const selectItem = async (rowIndex, item) => {
    console.log('[PurchaseInvoice selectItem] Incoming item data:', item);
    let existingIdx = -1;
    let targetIndex = rowIndex;
    const rawUom = String(item.scanned_uom || item.uom || item.stock_uom || 'Nos').trim();
    const normUom = rawUom.toLowerCase();
    const isMasterBoxScan = normUom === 'master box';
    const isBoxScan = normUom === 'box';
    const isBoxOrMbScan = isMasterBoxScan || isBoxScan;

    const pcsPerBox = parseFloat(item.custom_pcs_per_box || item.custom_pieces_per_box || item.default_pieces_per_box || 1) || 1;
    const boxesPerMb = parseFloat(item.custom_boxes_per_master_box || item.boxes_per_master_box || item.default_boxes_per_master_box || 1) || 1;
    const totalPcsInMB = pcsPerBox * boxesPerMb;

    setFormData(prev => {
      let items = [...prev.items];
      existingIdx = items.findIndex((i, idx) =>
        idx !== rowIndex &&
        i.item_code === item.item_code &&
        (isMasterBoxScan
          ? (i.uom || '').toLowerCase() === 'master box'
          : isBoxScan
          ? (i.uom || '').toLowerCase() === 'box'
          : (!i.use_box_entry && (i.uom || '').toLowerCase() === normUom))
      );

      if (existingIdx !== -1) {
        // Merge with existing item!
        const existingItem = { ...items[existingIdx] };
        const scannedBarcode =
          item.scanned_barcode ||
          item.barcode ||
          (item.barcodes?.[0]
            ? (typeof item.barcodes[0] === 'object'
                ? item.barcodes[0].barcode
                : item.barcodes[0])
            : '') ||
          '';

        existingItem.scanned_barcode =
          scannedBarcode || existingItem.scanned_barcode || '';
        existingItem.barcode =
          scannedBarcode || existingItem.barcode || '';

        if (isMasterBoxScan) {
          existingItem.use_box_entry = true;
          existingItem.uom = 'Master Box';
          existingItem.custom_pieces_per_box = pcsPerBox;
          existingItem.custom_boxes_per_master_box = boxesPerMb;
          existingItem.custom_box_qty = Math.round((parseFloat(existingItem.custom_box_qty) || 0) + 1);
          existingItem.qty = Math.round(existingItem.custom_box_qty * boxesPerMb * pcsPerBox);
        } else if (isBoxScan || existingItem.use_box_entry) {
          existingItem.use_box_entry = true;
          existingItem.uom = 'Box';
          existingItem.custom_pieces_per_box = pcsPerBox;
          existingItem.custom_box_qty = Math.round((parseFloat(existingItem.custom_box_qty) || 0) + 1);
          existingItem.qty = Math.round(existingItem.custom_box_qty * pcsPerBox);
        } else {
          existingItem.qty = Math.round((parseFloat(existingItem.qty) || 0) + 1);
          if (pcsPerBox > 0) {
            existingItem.custom_box_qty = Math.round(existingItem.qty / pcsPerBox);
          }
        }
        existingItem.amount = (existingItem.qty * (parseFloat(existingItem.rate) || 0)).toFixed(2);
        items[existingIdx] = existingItem;

        // Remove current row so empty duplicate row is not left behind
        items = items.filter((_, idx) => idx !== rowIndex);
      } else {
        // Clean items array if replacing empty row or appending
        let targetIndex = rowIndex;
        if (targetIndex >= items.length) {
          items.push({});
          targetIndex = items.length - 1;
        }

        const selectedUom = isMasterBoxScan ? 'Master Box' : (isBoxScan ? 'Box' : (item.stock_uom || rawUom || 'Nos'));
        const nosLastPurRate = item.last_purchase_rate
          ? (isMasterBoxScan ? parseFloat(item.last_purchase_rate) / totalPcsInMB : (isBoxScan ? parseFloat(item.last_purchase_rate) / pcsPerBox : parseFloat(item.last_purchase_rate)))
          : 0;
        const rate = parseFloat(item.rate || item.last_buying_rate || nosLastPurRate || 0);
        const lastPurRate = parseFloat(item.last_purchase_rate || item.last_buying_rate || rate || 0);
        const defaultBoxPrice = parseFloat(item.custom_box_price || (rate * pcsPerBox) || 0);
        const defaultMasterBoxPrice = parseFloat(item.custom_master_box_price || (rate * totalPcsInMB) || 0);
        const sellNos = parseFloat(item.custom_selling_price || 0);
        const sellBox = parseFloat(item.custom_box_selling_price || item.custom_selling_price_box || (sellNos * pcsPerBox) || 0);
        const sellMasterBox = parseFloat(item.custom_master_box_selling_price || (sellNos * totalPcsInMB) || 0);
        const itemQty = isMasterBoxScan
          ? Math.round(totalPcsInMB)
          : (isBoxScan ? Math.round(pcsPerBox) : 1);
        const rawBarcode = item.scanned_barcode || item.barcode || (item.barcodes && item.barcodes[0] ? (typeof item.barcodes[0] === 'object' ? item.barcodes[0].barcode : item.barcodes[0]) : '') || '';
        const barcodeVal = typeof rawBarcode === 'object' && rawBarcode !== null ? (rawBarcode.barcode || rawBarcode.name || '') : String(rawBarcode || '');

        items[targetIndex] = {
          item_code: item.item_code,
          item_name: item.item_name,
          barcode: barcodeVal,
          scanned_barcode: barcodeVal,
          uom: selectedUom,
          qty: itemQty,
          base_nos_rate: rate,
          rate: rate,
          last_purchase_rate: lastPurRate,
          amount: (itemQty * rate).toFixed(2),
          custom_box_price: defaultBoxPrice,
          custom_master_box_price: defaultMasterBoxPrice,
          custom_box_qty: 1,
          custom_pieces_per_box: pcsPerBox,
          default_pieces_per_box: pcsPerBox,
          custom_boxes_per_master_box: boxesPerMb,
          default_boxes_per_master_box: boxesPerMb,
          custom_selling_price: sellNos,
          custom_box_selling_price: sellBox,
          custom_master_box_selling_price: sellMasterBox,
          discount_percentage: 0,
          discount_amount: 0,
          custom_supplier_sl_num: item.custom_supplier_sl_num || '',
          custom_ref_sl_no: item.custom_ref_sl_no || '',
          use_box_entry: isBoxOrMbScan,
          barcodes: item.barcodes || item.barcode_details || [],
          barcode_details: item.barcode_details || item.barcodes || []
        };

        // Filter out any other empty dummy rows that had no item_code
        items = items.filter(it => it.item_code);
      }
      return { ...prev, items };
    });

    setShowItemDropdowns(prev => ({ ...prev, [rowIndex]: false }));

    if (existingIdx !== -1) {
      // Already merged, buying rate exists
      return;
    }

    try {
      const selectedUomParam = isMasterBoxScan ? 'Master Box' : (isBoxScan ? 'Box' : (item.stock_uom || rawUom || 'Nos'));
      const res = await axios.get(`${API_PATH}.get_item_buying_rate`, {
        params: {
          item_code: item.item_code,
          warehouse: formData.accepted_warehouse || warehouse || undefined,
          uom: selectedUomParam
        },
        withCredentials: true
      });
      if (res.data?.message) {
        const d = res.data.message;
        const buyingRate = parseFloat(d.rate) || 0;
        const boxBuyingPrice = parseFloat(d.box_price) || (buyingRate * pcsPerBox);
        const masterBoxBuyingPrice = parseFloat(d.master_box_price) || (buyingRate * totalPcsInMB);
        if (buyingRate > 0 || boxBuyingPrice > 0 || masterBoxBuyingPrice > 0) {
          setFormData(currentForm => {
            const items = [...currentForm.items];
            const curIdx = targetIndex < items.length ? targetIndex : rowIndex;
            if (curIdx >= 0 && items[curIdx]) {
              const currentBarcode =
                items[curIdx].scanned_barcode ||
                item.scanned_barcode ||
                items[curIdx].barcode ||
                item.barcode ||
                (item.barcodes?.[0]
                  ? (typeof item.barcodes[0] === 'object'
                      ? item.barcodes[0].barcode
                      : item.barcodes[0])
                  : '') ||
                '';
              items[curIdx] = {
                ...items[curIdx],
                barcode: currentBarcode,
                scanned_barcode: currentBarcode,
                base_nos_rate: buyingRate > 0 ? buyingRate : items[curIdx].base_nos_rate,
                rate: buyingRate > 0 ? buyingRate : items[curIdx].rate,
                custom_box_price: boxBuyingPrice > 0 ? boxBuyingPrice : items[curIdx].custom_box_price,
                custom_master_box_price: masterBoxBuyingPrice > 0 ? masterBoxBuyingPrice : items[curIdx].custom_master_box_price,
                amount: (parseFloat(items[curIdx].qty || 1) * (buyingRate > 0 ? buyingRate : items[curIdx].rate)).toFixed(2)
              };
            }
            return { ...currentForm, items };
          });
        }
      }
    } catch (err) {
      console.log("No buying rate found");
    }

    // Secondary fallback: If barcode is still missing, fetch item details to get barcode
    try {
      setFormData(currentForm => {
        const row = currentForm.items.find(it => it && it.item_code === item.item_code);
        if (row && (!row.barcode || !row.scanned_barcode)) {
          axios.get(`${LEGACY_API}.get_item_details`, {
            params: { item_code: item.item_code, warehouse: formData.accepted_warehouse || warehouse || undefined },
            withCredentials: true
          }).then(res => {
            if (res.data && res.data.message) {
              const d = res.data.message;
              const foundBc = d.barcode || (d.barcodes && d.barcodes[0] ? (typeof d.barcodes[0] === 'object' ? d.barcodes[0].barcode : d.barcodes[0]) : '');
              if (foundBc) {
                setFormData(f => ({
                  ...f,
                  items: f.items.map(it => it.item_code === item.item_code ? {
                    ...it,
                    barcode: it.barcode || String(foundBc),
                    scanned_barcode: it.scanned_barcode || String(foundBc)
                  } : it)
                }));
              }
            }
          }).catch(() => {});
        }
        return currentForm;
      });
    } catch (err) {}

    // Auto-focus the UOM / custom_box_qty field of the selected item row on barcode scan
    setTimeout(() => {
      setFormData(currentForm => {
        const targetIdx = currentForm.items.findIndex(it => it && it.item_code === item.item_code);
        if (targetIdx !== -1) {
          const rowNum = targetIdx + 1;
          const uomSelect = document.querySelector(`table.purchase-table tbody tr:nth-child(${rowNum}) select`) ||
            document.querySelector(`table.classic-table tbody tr:nth-child(${rowNum}) select`) ||
            document.querySelector(`table tbody tr:nth-child(${rowNum}) select`);
          if (uomSelect) {
            uomSelect.focus();
          } else {
            const qtyInput = document.querySelector(`table tbody tr:nth-child(${rowNum}) input[type="text"][inputmode="decimal"]`) ||
              document.querySelector(`table tbody tr:nth-child(${rowNum}) input`);
            qtyInput?.focus();
            qtyInput?.select?.();
          }
        }
        return currentForm;
      });
    }, 150);
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

    const taxTotalCalc = taxes.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0);
    const grandTotalCalc = netTotalCalc + taxTotalCalc;

    return {
      name: docName || undefined,
      disable_rounded_total: 1,
      grand_total: grandTotalCalc,
      rounded_total: grandTotalCalc,
      base_grand_total: grandTotalCalc,
      base_rounded_total: grandTotalCalc,
      supplier: formData.supplier,
      posting_date: formData.posting_date,
      due_date: formData.due_date || null,
      bill_no: formData.bill_no || null,
      bill_date: formData.bill_date || null,
      custom_supplier_invoice_amount: formData.custom_supplier_invoice_amount ? parseFloat(formData.custom_supplier_invoice_amount) : 0,
      custom_supplier_invoice_status: (() => {
        const supp = parseFloat(formData.custom_supplier_invoice_amount) || 0;
        if (supp > 0) {
          return Math.abs(supp - grandTotalCalc) < 0.01 ? "MATCHED" : "UNMATCHED";
        }
        return "NOT ENTERED";
      })(),
      update_stock: formData.update_stock ? 1 : 0,
      accepted_warehouse: formData.update_stock ? formData.accepted_warehouse : null,
      rejected_warehouse: formData.update_stock ? formData.rejected_warehouse : null,
      is_subcontracted: formData.is_subcontracted ? 1 : 0,
      custom_is_cash_purchase: formData.is_cash_purchase ? 1 : 0,
      is_cash_purchase: formData.is_cash_purchase ? 1 : 0,
      apply_discount_on: formData.apply_discount_on,
      additional_discount_percentage: formData.additional_discount_percentage > 0 ? parseFloat(formData.additional_discount_percentage) : null,
      discount_amount: formData.discount_amount > 0 ? parseFloat(formData.discount_amount) : null,
      taxes_and_charges: formData.taxes_and_charges || null,
      taxes: taxes.length > 0 ? taxes : null,
      payment_schedule: null,
      items: formData.items
        .filter(i => i.item_code && i.qty > 0)
        .map(i => {
          const isBox = (i.uom || '').toLowerCase() === 'box' || !!i.use_box_entry;
          const itemQty = parseFloat(i.qty) || 1;
          const grossRate = parseFloat(i.rate || 0);
          const totalDiscAmt = parseFloat(i.discount_amount || 0);
          const perUnitDiscAmt = itemQty > 0 ? (totalDiscAmt / itemQty) : 0;
          const netRate = parseFloat(i.rate || 0);
          const itemStockUom = i.stock_uom || 'Nos';
          const selectedUom = i.uom || itemStockUom;
          const pcsPerBox = parseFloat(i.custom_pieces_per_box) || 1;

          return {
            name: i.name || undefined,
            doctype: "Purchase Invoice Item",
            item_code: i.item_code,
            qty: itemQty,
            uom: selectedUom,
            stock_uom: itemStockUom,
            conversion_factor: selectedUom.toLowerCase() === 'box' ? pcsPerBox : 1,
            rate: grossRate,
            price_list_rate: grossRate,
            discount_percentage: parseFloat(i.discount_percentage || 0),
            discount_amount: totalDiscAmt,
            custom_box_qty: (isBox || selectedUom.toLowerCase() === 'master box') ? parseFloat(i.custom_box_qty || 0) : parseFloat(i.qty),
            custom_pieces_per_box: (isBox || selectedUom.toLowerCase() === 'master box') ? pcsPerBox : 1,
            custom_boxes_per_master_box: selectedUom.toLowerCase() === 'master box' ? parseFloat(i.custom_boxes_per_master_box || 1) : undefined,
            custom_box_price: parseFloat(i.custom_box_price || 0),
            custom_master_box_price: parseFloat(i.custom_master_box_price || 0),
            custom_selling_price: parseFloat(i.custom_selling_price || 0),
            custom_box_selling_price: parseFloat(i.custom_box_selling_price || 0),
            custom_master_box_selling_price: parseFloat(i.custom_master_box_selling_price || 0),
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

  const checkUnmatchedConfirmation = async (actionLabel = 'Save Draft') => {
    const suppAmt = parseFloat(formData.custom_supplier_invoice_amount) || 0;
    const itemsGrandTotal = parseFloat(grandTotal) || 0;
    const diff = itemsGrandTotal - suppAmt;

    if (suppAmt > 0 && Math.abs(diff) >= 0.01) {
      const isSubmitAction = actionLabel.toLowerCase().includes('submit');
      const result = await Swal.fire({
        title: '⚠️ Invoice Amount Mismatch',
        html: `
          <div style="text-align: left; font-size: 13px; line-height: 1.6; padding: 6px 4px;">
            <p style="margin-bottom: 8px; color: #475569;">The entered Supplier Bill Amount does not match the Items Total:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748b; font-weight: 600;">Supplier Bill Amount:</span>
                <span style="font-weight: 800; color: #0f172a;">AED ${formatPrice(suppAmt)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #64748b; font-weight: 600;">Items Grand Total:</span>
                <span style="font-weight: 800; color: #059669;">AED ${formatPrice(itemsGrandTotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 4px;">
                <span style="color: #e11d48; font-weight: 700;">Difference (Unmatched):</span>
                <span style="font-weight: 900; color: #e11d48;">${diff > 0 ? '+' : ''}AED ${formatPrice(diff)}</span>
              </div>
            </div>
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              ${isSubmitAction
                ? '<span style="color: #dc2626; font-weight: 700;">Employee Secret Code authorization is MANDATORY</span> to submit this mismatched invoice.'
                : `Do you want to proceed with <b>${actionLabel}</b> or go back to review?`}
            </p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: isSubmitAction ? 'Authorize with Secret Code' : `Proceed with ${actionLabel}`,
        cancelButtonText: 'Go Back & Review',
        confirmButtonColor: isSubmitAction ? '#059669' : '#f59e0b',
        cancelButtonColor: '#64748b',
        reverseButtons: true
      });

      if (!result.isConfirmed) return false;

      // If SUBMIT, prompt mandatory Employee Secret Code
      if (isSubmitAction) {
        const auth = await promptSecretCode({
          title: 'Authorize Mismatch Submission',
          subtitle: `Enter Employee Secret Code to authorize submit with AED ${diff > 0 ? '+' : ''}${formatPrice(diff)} mismatch`,
          warehouse: formData.accepted_warehouse || localStorage.getItem('warehouse') || ''
        });
        if (!auth || !auth.secret_key) return false;
        return { authorized: true, authData: auth, suppAmt, itemsGrandTotal, diff };
      }

      return { authorized: true };
    }
    return { authorized: true };
  };

  const handleSaveDraft = async () => {
    if (formData.update_stock && !formData.accepted_warehouse) {
      formData.accepted_warehouse = localStorage.getItem('warehouse') || warehouses[0]?.name || '';
    }
    const errors = {};
    if (!formData.supplier) errors.supplier = 'Supplier is required';
    if (!formData.bill_no || !formData.bill_no.trim()) errors.bill_no = 'Invoice Number is required';
    if (!formData.bill_date) errors.bill_date = 'Invoice Date is required';
    const suppAmt = parseFloat(formData.custom_supplier_invoice_amount);
    if (!formData.custom_supplier_invoice_amount || isNaN(suppAmt) || suppAmt <= 0) {
      errors.custom_supplier_invoice_amount = 'Supplier Invoice Amount is required and must be greater than 0';
    }
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.supplier) {
        Swal.fire({
          icon: 'warning',
          title: 'Supplier Required',
          text: 'Please choose a supplier before saving draft.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.bill_no) {
        Swal.fire({
          icon: 'warning',
          title: 'Invoice Number Required',
          text: 'Supplier Invoice Number is mandatory. Please enter the invoice number before saving draft.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.bill_date) {
        Swal.fire({
          icon: 'warning',
          title: 'Invoice Date Required',
          text: 'Supplier Invoice Date is mandatory. Please select the invoice date before saving draft.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.custom_supplier_invoice_amount) {
        Swal.fire({
          icon: 'warning',
          title: 'Supplier Invoice Amount Required',
          text: 'Supplier Invoice Amount is mandatory (> 0). Please enter the supplier bill amount before saving draft.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.items) {
        Swal.fire({
          icon: 'warning',
          title: 'Item Required',
          text: 'Please add at least one item to the invoice before saving draft.',
          confirmButtonColor: '#10b981'
        });
      }
      return;
    }

    // Validate mandatory Selling Price by UOM
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.item_code) continue;
      const currentUom = (item.uom || '').toLowerCase();
      const sellPriceNos = parseFloat(item.custom_selling_price) || 0;
      const pcsPerBox = parseFloat(item.custom_pieces_per_box) || 1;
      const sellPriceBox = parseFloat(item._temp_box_selling_price || (sellPriceNos * pcsPerBox)) || 0;

      if (currentUom === 'box') {
        if (!sellPriceBox || sellPriceBox <= 0) {
          Swal.fire('Selling Price Required', `Row #${i + 1} (${item.item_name || item.item_code}): Selling Price (Box) is MANDATORY for Box UOM!`, 'error');
          return;
        }
      } else if (currentUom === 'nos') {
        if (!sellPriceNos || sellPriceNos <= 0) {
          Swal.fire('Selling Price Required', `Row #${i + 1} (${item.item_name || item.item_code}): Selling Price (NOS) is MANDATORY!`, 'error');
          return;
        }
      }
    }

    // Unmatched Confirmation Prompt
    const confirmRes = await checkUnmatchedConfirmation('Save Draft');
    if (!confirmRes || !confirmRes.authorized) return;

    setSaving(true);
    const payload = await getPayload();

    try {
      let response;
      const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
      if (docName) {
        // Existing draft → UPDATE via create_generic_doc (POST bypasses CSRF restrictions)
        response = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: { ...payload, name: docName }
        }, { withCredentials: true });
        await fetchPurchaseInvoice(docName);
        Swal.fire({
          icon: 'success',
          title: `Draft updated: ${docName}`,
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        // New → CREATE (POST) using create_generic_doc
        response = await axios.post(GENERIC_API, {
          doctype: "Purchase Invoice",
          data: payload
        }, { withCredentials: true });
        const apiResp = response.data.message || response.data;
        const targetDocName = docName || apiResp.name;
        if (targetDocName) {
          setDocName(targetDocName);
          setSearchParams({ name: targetDocName });
          await fetchPurchaseInvoice(targetDocName);
          Swal.fire({
            icon: 'success',
            title: `Draft saved: ${targetDocName}`,
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          throw new Error('Failed to create draft');
        }
      }
      setDocStatus(0); // Set as draft after save
      setLastSavedData(JSON.stringify(formData));
      fetchInvoices();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Save failed';
      Swal.fire({
        icon: 'error',
        title: 'Draft Save Error',
        text: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
      });
      console.error("Save Draft Error:", err);
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
    if (!formData.bill_no || !formData.bill_no.trim()) errors.bill_no = 'Invoice Number is required';
    if (!formData.bill_date) errors.bill_date = 'Invoice Date is required';
    const suppAmt = parseFloat(formData.custom_supplier_invoice_amount);
    if (!formData.custom_supplier_invoice_amount || isNaN(suppAmt) || suppAmt <= 0) {
      errors.custom_supplier_invoice_amount = 'Supplier Invoice Amount is required and must be greater than 0';
    }
    if (formData.items.filter(i => i.item_code && i.qty > 0).length === 0) errors.items = 'Add at least one item';
    if (formData.update_stock && !formData.accepted_warehouse) errors.accepted_warehouse = 'Accepted Warehouse is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.supplier) {
        Swal.fire({
          icon: 'warning',
          title: 'Supplier Required',
          text: 'Please choose a supplier before submitting.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.bill_no) {
        Swal.fire({
          icon: 'warning',
          title: 'Invoice Number Required',
          text: 'Supplier Invoice Number is mandatory. Please enter the invoice number before submitting.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.bill_date) {
        Swal.fire({
          icon: 'warning',
          title: 'Invoice Date Required',
          text: 'Supplier Invoice Date is mandatory. Please select the invoice date before submitting.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.custom_supplier_invoice_amount) {
        Swal.fire({
          icon: 'warning',
          title: 'Supplier Invoice Amount Required',
          text: 'Supplier Invoice Amount is mandatory (> 0). Please enter the supplier bill amount before submitting.',
          confirmButtonColor: '#10b981'
        });
      } else if (errors.items) {
        Swal.fire({
          icon: 'warning',
          title: 'Item Required',
          text: 'Please add at least one item to the invoice before submitting.',
          confirmButtonColor: '#10b981'
        });
      }
      return;
    }

    // Unmatched Confirmation Prompt (Mandates Secret Code if Mismatch)
    const confirmRes = await checkUnmatchedConfirmation('Submit');
    if (!confirmRes || !confirmRes.authorized) return;

    setSaving(true);
    const payload = await getPayload();
    try {
      const GENERIC_API = '/api/method/kyle_retail.retail_api.api.create_generic_doc';
      // Always save draft with latest payload first
      const createRes = await axios.post(GENERIC_API, {
        doctype: "Purchase Invoice",
        data: docName ? { ...payload, name: docName } : payload
      }, { withCredentials: true });
      const apiResp = createRes.data?.message || createRes.data;
      const targetName = docName || apiResp?.name;
      if (!targetName) throw new Error(apiResp?.message || 'Create draft before submit failed');
      let name = targetName;
      setDocName(name);

      // Submit via custom whitelist API (avoids CSRF issues)
      const SUBMIT_API = '/api/method/kyle_retail.retail_api.api.submit_generic_doc';
      const subRes = await axios.post(SUBMIT_API, {
        doctype: "Purchase Invoice",
        name: name
      }, { withCredentials: true });

      const subMsg = subRes.data?.message || subRes.data;
      if (subMsg?.status === 'error') {
        throw new Error(subMsg?.message || 'Submit failed');
      }

      // If mismatch was authorized via secret code, log audit Activity Log and timeline comment in ERPNext
      if (confirmRes.authData) {
        try {
          await axios.post('/api/method/kyle_retail.retail_api.api.log_purchase_invoice_mismatch_approval', {
            docname: name,
            supplier_amount: confirmRes.suppAmt,
            items_grand_total: confirmRes.itemsGrandTotal,
            difference: confirmRes.diff,
            secret_key: confirmRes.authData.secret_key,
            employee_name: confirmRes.authData.employee_name,
            employee_id: confirmRes.authData.employee_id,
            warehouse: formData.accepted_warehouse || localStorage.getItem('warehouse') || ''
          }, { withCredentials: true });
        } catch (auditErr) {
          console.error("Failed to log mismatch audit trail:", auditErr);
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Submitted!',
        text: `Purchase Invoice ${name} submitted successfully`,
        timer: 2000,
        showConfirmButton: false
      });
      fetchInvoices();
      setSearchParams({ name: 'new' }, { replace: true });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?._server_messages || err.message || 'Submit failed';
      Swal.fire({
        icon: 'error',
        title: 'Submit Error',
        text: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
      });
      console.error("Submit Error:", err);
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

  // Sorting
  const [sortField, setSortField] = useState('posting_date');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={13} style={{ opacity: 0.4, marginLeft: '4px', verticalAlign: 'middle' }} />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp size={13} style={{ color: themeColor || '#0082f6', marginLeft: '4px', verticalAlign: 'middle' }} />
      : <ArrowDown size={13} style={{ color: themeColor || '#0082f6', marginLeft: '4px', verticalAlign: 'middle' }} />;
  };

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const matchesName = !filterName || (inv.name || '').toLowerCase().includes(filterName.toLowerCase());
    const matchesSupplier = !filterSupplier || (inv.supplier_name || inv.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase());
    const matchesStatus = !filterStatus || inv.status === filterStatus;
    const invDateStr = String(inv.posting_date || '').slice(0, 10);
    const matchesFrom = !filterDateFrom || invDateStr >= String(filterDateFrom).slice(0, 10);
    const matchesTo = !filterDateTo || invDateStr <= String(filterDateTo).slice(0, 10);
    return matchesName && matchesSupplier && matchesStatus && matchesFrom && matchesTo;
  }), [invoices, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const sortedInvoices = useMemo(() => {
    let list = [...filteredInvoices];
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [filteredInvoices, sortField, sortDirection]);

  const total = sortedInvoices.length;
  const paginated = sortedInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const map = { Paid: 'status-paid', Unpaid: 'status-unpaid', Overdue: 'status-overdue', Draft: 'status-draft', Return: 'status-return', Cancelled: 'status-cancelled' };
    return map[status] || 'status-default';
  };

  const clearFilters = () => {
    setFilterName(''); setFilterSupplier(''); setFilterStatus('');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  // Retain URL search parameters across page reloads

  useEffect(() => {
    fetchInvoices();
    fetchTaxTemplates();
    fetchWarehouses();
  }, [customColumns]);

  useEffect(() => {
    const nameParam = searchParams.get('name');
    const prParam = searchParams.get('pr');

    if (nameParam === 'new') {
      if (!isModalOpen || docName !== '') {
        openCreateModal();
      }
    } else if (nameParam) {
      if (nameParam.startsWith('MAT-PRE-') || nameParam.startsWith('PR-') || nameParam.startsWith('PUR-ORD-') || nameParam.startsWith('PO-')) {
        setSearchParams({}, { replace: true });
        return;
      }
      // Don't reload if we are currently showing a return draft against this document
      if (nameParam !== docName || !isModalOpen) {
        if (nameParam !== formData.return_against || !isModalOpen) {
          fetchPurchaseInvoice(nameParam);
        }
      } else {
        // Already loaded this doc - check if mode changed
        const modeParam = searchParams.get('mode');
        if (modeParam === 'edit' && isViewMode) {
          setIsViewMode(false);
          setIsEditMode(true);
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

  }, [searchParams, openCreateModal, createPIFromPR, fetchPurchaseInvoice, isModalOpen, docName]);

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
      const inItemsTable = activeEl?.closest('table.purchase-table, table.classic-table');

      let activeRowIndex = -1;
      if (inItemsTable) {
        const tr = activeEl.closest('tr');
        if (tr && tr.parentNode) {
          const rowIndexAttr = tr.getAttribute('data-row-index');
          if (rowIndexAttr !== null) {
            activeRowIndex = parseInt(rowIndexAttr, 10);
          } else {
            const index = Array.from(tr.parentNode.children).indexOf(tr);
            if (index !== -1 && index < formData.items.length) {
              activeRowIndex = index;
            }
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

      // Focus Supplier Search (F2)
      if (isShortcutPressed(e, 'doc_editor', 'customerSupplier', 'F2') || e.key === 'F2') {
        e.preventDefault();
        const supplierInput = supplierRef.current?.querySelector('input') ||
          document.querySelector('input[placeholder*="supplier" i]') ||
          document.querySelector('input[placeholder="Search and select supplier..."]') ||
          document.querySelector('input[placeholder="Search supplier..."]');
        if (supplierInput) {
          supplierInput.focus();
          supplierInput.select?.();
        }
      }

      // Focus Item Search & Barcode Input (F3 / F4)
      if (
        isShortcutPressed(e, 'doc_editor', 'itemSearch', 'F3') || e.key === 'F3' ||
        isShortcutPressed(e, 'doc_editor', 'barcode', 'F4') || e.key === 'F4'
      ) {
        e.preventDefault();
        const itemInputs =
          document.querySelector('tr.bg-emerald-50\\/40 input') ||
          document.querySelector('input[placeholder*="BARCODE" i]') ||
          document.querySelector('input[placeholder*="Search item" i]') ||
          document.querySelector('input[placeholder="Place cursor here and scan barcode..."]') ||
          document.querySelector('input[placeholder="Enter Barcode / Scan here..."]');
        if (itemInputs) {
          itemInputs.focus();
          itemInputs.select?.();
        }
      }

      // Bulk Quantity Update popup (F6)
      if (isShortcutPressed(e, 'doc_editor', 'bulkQty', 'F6') || e.key === 'F6') {
        e.preventDefault();
        const validItems = formData.items.filter(it => it && it.item_code);
        let rowIndex = inItemsTable && activeRowIndex >= 0 ? activeRowIndex : (validItems.length - 1);

        if (rowIndex >= 0 && rowIndex < formData.items.length) {
          const item = formData.items[rowIndex];
          if (item && item.item_code) {
            Swal.fire({
              title: 'Bulk Quantity',
              html: `<div style="font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 12px; padding: 10px; background-color: #f1f5f9; border-radius: 8px; border-left: 4px solid #10b981; text-align: left;">
                ${item.item_name || item.item_code} (Row #${rowIndex + 1})
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

      // Toggle UOM of active row (F8)
      if (isShortcutPressed(e, 'doc_editor', 'uom', 'F8') || e.key === 'F8') {
        e.preventDefault();
        const validItems = formData.items.filter(it => it && it.item_code);
        let rowIndex = inItemsTable && activeRowIndex >= 0 ? activeRowIndex : (validItems.length - 1);

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

      // Unified Save / Submit / Action Shortcut (Alt+S, Ctrl+S, F7, F12, Ctrl+Enter)
      const isSaveDraftShortcut =
        (e.altKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) ||
        (e.ctrlKey && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) ||
        e.key === 'F7' ||
        isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') ||
        isShortcutPressed(e, 'doc_editor', 'saveDraftAlt', 'Alt+S');

      const isSubmitShortcut =
        isShortcutPressed(e, 'doc_editor', 'submit', 'F12') ||
        isShortcutPressed(e, 'doc_editor', 'submitAlt', 'Ctrl+Enter') ||
        e.key === 'F12' ||
        (e.ctrlKey && e.key === 'Enter');

      if (isSaveDraftShortcut || isSubmitShortcut) {
        e.preventDefault();
        e.stopPropagation();

        if (!saving) {
          if (formData.docstatus === 0 || formData.docstatus === undefined) {
            // If dirty or new document -> Save Draft
            if (isDirty || !docName) {
              handleSaveDraft();
            } else {
              // If already saved clean draft -> Submit
              if (allowedActions.includes('submit') || allowedActions.length === 0) {
                handleSubmit();
              } else {
                handleSaveDraft();
              }
            }
          }
        }
      }

      // Action Cancel Shortcut (Alt+C)
      if (
        (e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) ||
        isShortcutPressed(e, 'doc_editor', 'cancel', 'Alt+C')
      ) {
        if (formData.docstatus === 1 && !saving && (allowedActions.includes('cancel') || allowedActions.length === 0)) {
          e.preventDefault();
          e.stopPropagation();
          handleDocAction('cancel');
        }
      }

      // Action Amend Shortcut (Alt+M)
      if (
        (e.altKey && (e.key.toLowerCase() === 'm' || e.code === 'KeyM')) ||
        isShortcutPressed(e, 'doc_editor', 'amend', 'Alt+M')
      ) {
        if (formData.docstatus === 2 && !saving && (allowedActions.includes('amend') || allowedActions.length === 0)) {
          e.preventDefault();
          e.stopPropagation();
          handleDocAction('amend');
        }
      }

      // Add Item Row / Focus Search (F10 / Alt+A)
      if (
        isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || e.key === 'F10' ||
        (e.altKey && (e.key === 'a' || e.key === 'A'))
      ) {
        e.preventDefault();
        const searchInput =
          document.querySelector('tr.bg-emerald-50\\/40 input') ||
          document.querySelector('input[placeholder*="BARCODE" i]') ||
          document.querySelector('input[placeholder*="Search item" i]');
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        } else if (formData.docstatus === 0 && !isViewMode) {
          addItemRow();
        }
      }

      // Focus Target Warehouse Select (F9)
      if (isShortcutPressed(e, 'doc_editor', 'warehouseBranch', 'F9') || e.key === 'F9') {
        e.preventDefault();
        const warehouseSelect =
          document.querySelector('select[name="set_warehouse"]') ||
          document.querySelector('select[name="accepted_warehouse"]') ||
          document.querySelector('header select') ||
          document.querySelector('select');
        if (warehouseSelect) {
          warehouseSelect.focus();
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
            const numInput = tr.querySelector('input[type="text" inputMode="decimal"]:not([disabled])');
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
        const isDropdownOpen = !!document.querySelector('.custom-dropdown-portal') || !!document.querySelector('.so-dropdown');
        // If dropdown is open, let dropdown navigation handle arrow keys
        if (isDropdownOpen && !e.altKey && !e.ctrlKey) return;

        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          if (activeEl.type === 'number' && !e.altKey && !e.ctrlKey) {
            return;
          }

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

  // =========================================================================
  // CLASSIC POS FULL TERMINAL LAYOUT FOR PURCHASE INVOICE (All Modes: New, Edit, View / Submitted)
  // =========================================================================
  if (isModalOpen) {
    return (
      <>
        <div className="classic-root" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
        {/* CLASSIC NAVBAR */}
        <nav className="classic-nav" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px', flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div onClick={() => setIsModalOpen(false)} className="cursor-pointer flex items-center">
              <span className="font-black text-sm tracking-tight text-slate-800 flex items-center gap-1.5 uppercase">
                <Package className="w-5 h-5 text-emerald-600" />
                <span>KYLE POS • PURCHASE INVOICE</span>
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

            {/* ACTION: CANCEL (When Submitted & Allowed) */}
            {formData.docstatus === 1 && (allowedActions.includes('cancel') || allowedActions.length === 0) && (
              <button
                type="button"
                onClick={() => handleDocAction('cancel')}
                disabled={saving}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                CANCEL
              </button>
            )}

            {/* ACTION: AMEND (When Cancelled & Allowed) */}
            {formData.docstatus === 2 && (allowedActions.includes('amend') || allowedActions.length === 0) && (
              <button
                type="button"
                onClick={() => handleDocAction('amend')}
                disabled={saving}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-black text-[11px] uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                AMEND
              </button>
            )}

            {/* ACTION: CREATE & CONNECTIONS DROPDOWN */}
            {docName && (
              <div className="relative" ref={createDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-black text-[11px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                >
                  <Plus size={13} className="text-slate-500" />
                  <span>CREATE</span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>
                {showCreateDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-[12000] p-4 animate-fadeIn text-left">
                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100">
                      <Zap className="w-4 h-4 text-indigo-500 opacity-80 shrink-0" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Create & Connections</span>
                    </div>

                    {/* Actions Section */}
                    {formData.docstatus === 1 && (
                      <div className="flex flex-col gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            handleCreatePayment();
                          }}
                          disabled={saving}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-black shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Payment Entry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            handleCreateReturn();
                          }}
                          disabled={saving}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          <Link size={14} />
                          <span>Create Debit Note</span>
                        </button>
                      </div>
                    )}

                    {/* Connected Docs / Links */}
                    <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
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
                                    type="button"
                                    onClick={() => {
                                      setShowCreateDropdown(false);
                                      navigateToDoc(dt, link.name);
                                    }}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer truncate max-w-full"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="truncate">{link.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-[11px] font-semibold text-slate-400">No linked documents found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping mr-0.5"></span>
            <span>PURCHASE INVOICE</span>
          </div>
          <div className="so-shortcut-badges-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'customerSupplier', 'F2')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SUPPLIER</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#6366f1', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'itemSearch', 'F3')} / {getShortcut('doc_editor', 'barcode', 'F4')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>ITEM / BARCODE</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#d946ef', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'bulkQty', 'F6')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>BULK QTY</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#8b5cf6', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'uom', 'F8')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>TOGGLE UOM</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#f59e0b', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'saveDraft', 'F7')} / {getShortcut('doc_editor', 'saveDraftAlt', 'Alt+S')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SAVE DRAFT</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#0ea5e9', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut('doc_editor', 'addRowAlt', 'Alt+A')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>ADD ROW</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>{getShortcut('doc_editor', 'submit', 'F12')} / {getShortcut('doc_editor', 'submitAlt', 'Ctrl+Enter')}</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SUBMIT</span>
            </div>
            <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="so-shortcut-key" style={{ background: '#475569', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>+ / -</span>
              <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>QTY</span>
            </div>
          </div>
        </div>

        {/* CLASSIC HEADER FORM: ENTRY HEADER BAR DESIGN */}
        <header className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs shrink-0 mx-2 my-1.5">
          <div className={`grid grid-cols-2 items-end gap-x-4 gap-y-3 md:grid-cols-4 ${isAdmin ? 'xl:grid-cols-[1.6fr_1.4fr_1fr_1fr_1.1fr_1.1fr_1.2fr_auto]' : 'xl:grid-cols-[2fr_1fr_1fr_1.2fr_1.2fr_1.3fr_auto]'}`}>

            {/* 1. Supplier */}
            <div className="flex min-w-0 flex-col gap-1.5 col-span-2 md:col-span-2 xl:col-span-1">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Supplier Name <span className="text-red-500 font-bold">*</span>
              </span>
              <div className="relative group w-full" ref={supplierRef}>
                <CustomSearchDropdown
                  placeholder="Search supplier..."
                  value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                  onSelect={(val) => selectSupplier(val)}
                  fetchData={fetchSuppliers}
                  createOption={handleSupplierCreate}
                  optionsLabel="supplier_name"
                  globalSearch={true}
                  onGlobalSearch={onGlobalSupplierSearch}
                  onActivate={onActivateSupplier}
                  themeColor="#10b981"
                  className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  disabled={isViewMode || formData.docstatus !== 0}
                />
              </div>
            </div>

            {/* 2. Branch Warehouse (Visible ONLY to Administrator / System Manager) */}
            {isAdmin && (
              <div className="flex min-w-0 flex-col gap-1.5 col-span-2 md:col-span-2 xl:col-span-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <Building2 className="size-3 text-slate-400" aria-hidden />
                  Branch <span className="text-red-500 font-bold">*</span>
                </span>
                <div className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-800 outline-none transition-colors flex items-center truncate">
                  <select
                    name="set_warehouse"
                    value={formData.set_warehouse || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, set_warehouse: e.target.value, accepted_warehouse: e.target.value }))}
                    disabled={isViewMode}
                    className="w-full bg-transparent border-none outline-none font-semibold text-sm text-slate-800 cursor-pointer truncate p-0"
                  >
                    <option value="">Select Branch...</option>
                    {warehouses.map(w => (
                      <option key={w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 3. Posting Date */}
            <div
              onClick={(e) => {
                const inp = e.currentTarget.querySelector('input[type="date"]');
                if (inp && inp.showPicker) {
                  try { inp.showPicker(); } catch (err) { }
                }
              }}
              className="flex min-w-0 flex-col gap-1.5 cursor-pointer group"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 cursor-pointer">
                <CalendarDays className="size-3 text-slate-400 group-hover:text-emerald-600 transition-colors" aria-hidden />
                Posting
              </span>
              <input
                type="date"
                value={formData.posting_date || ''}
                disabled={isViewMode}
                onChange={e => {
                  const newPostingDate = e.target.value;
                  setFormData(prev => {
                    const calculatedDueDate = calcDueDate(newPostingDate, prev.is_cash_purchase, prev.credit_days);
                    return { ...prev, posting_date: newPostingDate, due_date: calculatedDueDate };
                  });
                }}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                aria-label="Posting date"
              />
            </div>

            {/* 4. Due Date */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <CalendarDays className="size-3 text-slate-400" aria-hidden />
                Due
              </span>
              <input
                type="date"
                value={formData.due_date || ''}
                disabled={true}
                title={formData.is_cash_purchase ? 'CASH Purchase: Due Date equals Posting Date' : 'CREDIT Purchase Due Date'}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-500 outline-none cursor-not-allowed"
                aria-label="Due date"
              />
            </div>

            {/* 5. Inv # (Mandatory) */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Hash className="size-3 text-slate-400" aria-hidden />
                Invoice # <span className="text-red-500 font-bold">*</span>
              </span>
              <input
                type="text"
                placeholder="e.g. 5467345"
                value={formData.bill_no || ''}
                disabled={isViewMode}
                onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                className={`h-10 w-full min-w-0 rounded-md border ${formErrors.bill_no ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50/50'} px-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20`}
                aria-label="Invoice number"
              />
            </div>

            {/* 6. Supplier Inv Date (Mandatory) */}
            <div
              onClick={(e) => {
                const inp = e.currentTarget.querySelector('input[type="date"]');
                if (inp && inp.showPicker) {
                  try { inp.showPicker(); } catch (err) { }
                }
              }}
              className="flex min-w-0 flex-col gap-1.5 cursor-pointer group"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 cursor-pointer">
                <CalendarDays className="size-3 text-slate-400 group-hover:text-emerald-600 transition-colors" aria-hidden />
                Invoice Date <span className="text-red-500 font-bold">*</span>
              </span>
              <input
                type="date"
                value={formData.bill_date || ''}
                disabled={isViewMode}
                onChange={e => {
                  const newBillDate = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    bill_date: newBillDate,
                    due_date: newBillDate && prev.due_date && newBillDate > prev.due_date ? newBillDate : prev.due_date
                  }));
                }}
                className={`h-10 w-full min-w-0 rounded-md border ${formErrors.bill_date ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50/50'} px-3 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 cursor-pointer`}
                aria-label="Supplier Invoice date"
              />
            </div>

            {/* 7. Supplier Bill Amt (Mandatory) */}
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <Receipt className="size-3 text-slate-400" aria-hidden />
                Supplier Inv Amt <span className="text-red-500 font-bold">*</span>
              </span>
              <input
                type="text" inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={formData.custom_supplier_invoice_amount || ''}
                disabled={isViewMode}
                onChange={e => setFormData(prev => ({ ...prev, custom_supplier_invoice_amount: e.target.value }))}
                className={`h-10 w-full min-w-0 rounded-md border ${formErrors.custom_supplier_invoice_amount ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50/50'} px-3 text-sm font-bold text-right tabular-nums text-emerald-600 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20`}
                aria-label="Supplier Bill amount"
              />
            </div>

            {/* 8. Credit / Cash Toggle */}
            <div className="flex flex-col gap-1.5 col-span-2 md:col-span-4 xl:col-span-1 min-w-[170px]">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Payment Type
              </span>
              <div className="flex h-10 w-full items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
                <button
                  type="button"
                  disabled={isViewMode}
                  onClick={() => {
                    setFormData(prev => {
                      const calculatedDueDate = calcDueDate(prev.posting_date, false, prev.credit_days);
                      return { ...prev, is_cash_purchase: false, due_date: calculatedDueDate };
                    });
                  }}
                  className={`flex-1 h-full flex items-center justify-center rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${!formData.is_cash_purchase ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Credit
                </button>
                <button
                  type="button"
                  disabled={isViewMode}
                  onClick={() => {
                    setFormData(prev => {
                      const calculatedDueDate = calcDueDate(prev.posting_date, true, prev.credit_days);
                      return { ...prev, is_cash_purchase: true, due_date: calculatedDueDate };
                    });
                  }}
                  className={`flex-1 h-full flex items-center justify-center rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${formData.is_cash_purchase ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Cash
                </button>
              </div>
            </div>

          </div>
        </header>

        {/* CLASSIC MAIN BODY: TABLE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          <div className="erp-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <table className="erp-table classic-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', background: '#ffffff', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                  <th style={{ width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>#</th>
                  {columnConfig.filter(c => c.visible).map(col => {
                    const colW = col.width ? (typeof col.width === 'number' || !col.width.includes('px') ? `${parseInt(col.width)}px` : col.width) : '100px';
                    const isDraggingThis = draggedColId === col.id;
                    const isDragOverThis = dragOverColId === col.id;
                    return (
                      <th
                        key={col.id}
                        draggable={!resizingCol}
                        onDragStart={(e) => handleColumnDragStart(e, col.id)}
                        onDragOver={(e) => handleColumnDragOver(e, col.id)}
                        onDragLeave={(e) => handleColumnDragLeave(e, col.id)}
                        onDrop={(e) => handleColumnDrop(e, col.id)}
                        onDragEnd={handleColumnDragEnd}
                        className={`relative group select-none cursor-grab active:cursor-grabbing transition-colors ${
                          isDragOverThis ? 'border-l-2 border-emerald-500 bg-emerald-50' : ''
                        } ${isDraggingThis ? 'opacity-40 bg-slate-200' : ''}`}
                        style={{
                          width: colW,
                          minWidth: colW,
                          maxWidth: colW,
                          textAlign: col.align || (['rate', 'custom_master_box_price', 'custom_box_price', 'custom_selling_price', 'custom_box_selling_price', 'custom_master_box_selling_price', 'discount_amount', 'discount_percentage', 'amount', 'last_purchase_rate', 'margin'].includes(col.id) ? 'right' : (['uom', 'custom_box_qty', 'custom_boxes_per_master_box', 'custom_pieces_per_box', 'qty'].includes(col.id) ? 'center' : 'left')),
                          padding: '8px 8px',
                          fontSize: '11px',
                          fontWeight: 900,
                          color: '#475569',
                          textTransform: 'uppercase',
                          borderRight: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span className="truncate block pointer-events-none">{col.label}</span>
                        <div
                          onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                          className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-20 hover:bg-emerald-500/40 transition-colors ${resizingCol === col.id ? 'bg-emerald-600' : ''}`}
                          style={{ touchAction: 'none' }}
                          title="Drag to resize column"
                        />
                      </th>
                    );
                  })}
                  <th style={{ width: '40px', minWidth: '40px', textAlign: 'center', padding: '8px 4px' }}>
                    <button type="button" tabIndex={-1} onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-emerald-600 cursor-pointer" title="Configure Columns">
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
                          case 'item_code':
                            return (
                              <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                                <span className="font-black text-slate-900 text-xs leading-tight">{item.item_code}</span>
                              </td>
                            );
                          case 'item_name':
                            return (
                              <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                                <span className="font-semibold text-slate-700 text-xs leading-tight block truncate" title={item.item_name || ''}>{item.item_name || '—'}</span>
                              </td>
                            );
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
                          case 'custom_ref_sl_no':
                            return (
                              <td key={col.id} className="px-2 py-1 border-r border-slate-100 align-middle">
                                <input
                                  type="text"
                                  name="custom_ref_sl_no"
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
                                  className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer transition-all focus:bg-emerald-100 focus:text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                  <option value="Nos">Nos</option>
                                  <option value="Box">Box</option>
                                  <option value="Master Box">Master Box</option>
                                </select>
                              </td>
                            );
                          case 'custom_box_qty':
                            return (
                              <td key={col.id} className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                <div className="flex flex-col items-center justify-center">
                                  <input
                                    type="text" inputMode="decimal"
                                    value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                    onChange={(e) => updateItem(idx, item.use_box_entry ? "custom_box_qty" : "qty", e.target.value)} onBlur={(e) => updateItem(idx, item.use_box_entry ? "custom_box_qty" : "qty", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                    disabled={isViewMode || formData.docstatus !== 0}
                                    className="w-full h-8 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                  />
                                </div>
                              </td>
                            );
                          case 'custom_boxes_per_master_box':
                            return (
                              <td key={col.id} className="px-2 py-1 text-center font-bold text-xs text-slate-700 border-r border-slate-100 align-middle">
                                {(item.uom || '').toLowerCase() === 'master box' ? (
                                  <input
                                    type="text" inputMode="decimal"
                                    value={item.custom_boxes_per_master_box || ''}
                                    onChange={(e) => updateItem(idx, "custom_boxes_per_master_box", e.target.value)} onBlur={(e) => updateItem(idx, "custom_boxes_per_master_box", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                    disabled={isViewMode || formData.docstatus !== 0}
                                    className="w-full h-8 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                  />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          case 'custom_pieces_per_box':
                            return (
                              <td key={col.id} className="px-2 py-1 text-center font-bold text-xs text-slate-700 border-r border-slate-100 align-middle">
                                {item.use_box_entry ? (
                                  <input
                                    type="text" inputMode="decimal"
                                    value={item.custom_pieces_per_box || ''}
                                    onChange={(e) => updateItem(idx, "custom_pieces_per_box", e.target.value)} onBlur={(e) => updateItem(idx, "custom_pieces_per_box", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                    disabled={isViewMode || formData.docstatus !== 0}
                                    className="w-full h-8 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                  />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          case 'custom_master_box_price':
                            return (
                              <td key={col.id} className="px-2 py-1 text-right font-bold text-xs text-slate-700 border-r border-slate-100 align-middle">
                                {(item.uom || '').toLowerCase() === 'master box' ? (
                                  <input
                                    type="text" inputMode="decimal"
                                    value={item.custom_master_box_price || ''}
                                    onChange={(e) => updateItem(idx, "custom_master_box_price", e.target.value)} onBlur={(e) => updateItem(idx, "custom_master_box_price", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                    disabled={isViewMode || formData.docstatus !== 0}
                                    className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
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
                                    type="text" inputMode="decimal"
                                    value={item.custom_box_price || ''}
                                    onChange={(e) => updateItem(idx, "custom_box_price", e.target.value)} onBlur={(e) => updateItem(idx, "custom_box_price", e.target.value ? Number(e.target.value).toFixed(2) : "")}
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
                                  type="text" inputMode="decimal"
                                  value={item.rate || ''}
                                  onChange={(e) => updateItem(idx, "rate", e.target.value)} onBlur={(e) => updateItem(idx, "rate", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              </td>
                            );
                          case 'custom_selling_price':
                            return (
                              <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                <input
                                  type="text" inputMode="decimal"
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
                                  type="text" inputMode="decimal"
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
                          case 'custom_master_box_selling_price':
                            return (
                              <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                <input
                                  type="text" inputMode="decimal"
                                  value={item.custom_master_box_selling_price || ''}
                                  onChange={(e) => updateItem(idx, "custom_master_box_selling_price", e.target.value)}
                                  onBlur={(e) => {
                                    const sellVal = parseFloat(e.target.value) || 0;
                                    const pPerBox = parseFloat(item.custom_pieces_per_box) || 1;
                                    const bPerMB = parseFloat(item.custom_boxes_per_master_box) || 1;
                                    const totalPcs = (bPerMB * pPerBox) || 1;
                                    const buyPriceMB = parseFloat(item.custom_master_box_price) || ((parseFloat(item.rate) || 0) * totalPcs);
                                    if (sellVal > 0 && buyPriceMB > 0 && sellVal < buyPriceMB) {
                                      updateItem(idx, "custom_master_box_selling_price", '');
                                      Swal.fire({
                                        icon: 'error',
                                        title: 'Master Box Price Restriction Warning',
                                        html: `Row #${idx + 1} (${item.item_name || item.item_code}):<br/>Master Box Selling Price (<b>AED ${sellVal.toFixed(2)}</b>) cannot be LESS than Master Box Buying Rate (<b>AED ${buyPriceMB.toFixed(2)}</b>)!<br/><br/><i>Entered value has been cleared.</i>`,
                                        confirmButtonColor: '#ef4444'
                                      });
                                    }
                                  }}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 px-2 text-right font-black text-xs text-purple-700 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              </td>
                            );
                          case 'discount_percentage':
                            return (
                              <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                <input
                                  type="text" inputMode="decimal"
                                  value={item.discount_percentage || ''}
                                  onChange={(e) => updateItem(idx, "discount_percentage", e.target.value)} onBlur={(e) => updateItem(idx, "discount_percentage", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              </td>
                            );
                          case 'discount_amount':
                            return (
                              <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                <input
                                  type="text" inputMode="decimal"
                                  value={item.discount_amount || ''}
                                  onChange={(e) => updateItem(idx, "discount_amount", e.target.value)} onBlur={(e) => updateItem(idx, "discount_amount", e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                  disabled={isViewMode || formData.docstatus !== 0}
                                  className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40 disabled:bg-slate-100 disabled:text-slate-500"
                                />
                              </td>
                            );
                          case 'qty':
                            return (
                              <td key={col.id} className="px-2 py-1 text-center font-black text-xs text-slate-800 border-r border-slate-100 align-middle">
                                {item.qty || 0}
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
                                {item.last_purchase_rate || item.last_buying_rate ? formatPrice(item.last_purchase_rate || item.last_buying_rate) : '0'}
                              </td>
                            );
                          case 'margin': {
                            const { marginPercent, profitAmount, isLoss } = calculateItemMargin(item);
                            return (
                              <td key={col.id} className="px-2 py-1 text-right border-r border-slate-100 align-middle bg-slate-50/20">
                                {marginPercent !== null ? (
                                  <div className="flex flex-col items-end justify-center leading-none">
                                    <span className={`font-black text-xs ${isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                                      {marginPercent}%
                                    </span>
                                    <span className={`text-[9.5px] font-bold mt-0.5 ${isLoss ? 'text-rose-500' : 'text-slate-400'}`}>
                                      {profitAmount >= 0 ? `+${profitAmount}` : profitAmount}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-bold text-xs">—</span>
                                )}
                              </td>
                            );
                          }
                          default:
                            return <td key={col.id} className="px-2 py-1 text-xs border-r border-slate-100 align-middle">{item[col.id] || '—'}</td>;
                        }
                      })}
                      <td className="text-center px-1">
                        {!(isViewMode || formData.docstatus !== 0) && (
                          <button type="button" onClick={() => removeItemRow(idx)} className="text-rose-400 hover:text-rose-600 font-black text-sm cursor-pointer">×</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* ADVANCED: Smart Inline Search Row */}
                {formData.docstatus === 0 && !isViewMode && (
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
                                clearOnSelect={true}
                                onSelect={(selectedItem, searchQuery) => {
                                  if (selectedItem) {
                                    const code = String(searchQuery || '').trim();
                                    const itemWithBarcode =
                                      /^\d{4,}$/.test(code)
                                        ? {
                                            ...selectedItem,
                                            barcode: selectedItem.barcode || code,
                                            scanned_barcode: selectedItem.scanned_barcode || code
                                          }
                                        : selectedItem;
                                    console.log('[PurchaseInvoice inline search] Selected Item:', itemWithBarcode);
                                    selectItem(formData.items.length, itemWithBarcode);
                                  }
                                }}
                                fetchData={fetchItemsAPI}
                                createOption={(query) => {
                                  console.log('[PurchaseInvoice inline search] createOption query:', query);
                                  setQuickItemInitialCode(query || '');
                                  setQuickItemTargetRow(formData.items.length);
                                  setShowQuickItemModal(true);
                                }}
                                optionsLabel="item_name"
                                globalSearch={true}
                                onGlobalSearch={onGlobalItemSearch}
                                onActivate={async (it) => {
                                  console.log('[PurchaseInvoice inline search] onActivate:', it);
                                  const ok = await onActivateItem(it);
                                  if (ok) {
                                    selectItem(formData.items.length, it);
                                  }
                                  return ok;
                                }}
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
                    <td className="text-center">
                      <Search size={14} className="mx-auto text-amber-500" />
                    </td>
                  </tr>
                )}

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
                <div className="grid grid-cols-3 grid-rows-2 gap-2 w-full h-full">
                  {/* Slot 1: SAVE DRAFT (New/Dirty) / SUBMIT (Clean Draft) / CANCEL (Submitted) / AMEND (Cancelled) */}
                  {formData.docstatus === 0 || formData.docstatus === undefined ? (
                    isDirty || !docName ? (
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={saving}
                        className="h-full bg-[#f59e0b] hover:bg-[#d97706] text-white border-2 border-[#f59e0b] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                        style={{ borderRadius: '8px' }}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                          {saving ? <Loader2 size={15} className="animate-spin text-white" /> : <Save size={15} />}
                          <span>{saving ? 'SAVING...' : 'SAVE DRAFT'}</span>
                        </div>
                        <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'saveDraftAlt', 'Alt+S')}</span>
                      </button>
                    ) : (
                      (allowedActions.includes('submit') || allowedActions.length === 0) ? (
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={saving || !docName}
                          className="h-full bg-[#10b981] hover:bg-[#059669] text-white border-2 border-[#10b981] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40 ring-2 ring-emerald-300"
                          style={{ borderRadius: '8px' }}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                            {saving ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} />}
                            <span>{saving ? 'SUBMITTING...' : 'SUBMIT'}</span>
                          </div>
                          <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'submitAlt', 'Ctrl+Enter')}</span>
                        </button>
                      ) : (
                        <div className="h-full bg-slate-100 border-2 border-slate-200 rounded-xl px-3 py-2 flex items-center justify-center text-slate-400 font-black text-[11px] uppercase tracking-wider select-none" style={{ borderRadius: '8px' }}>
                          <span>DRAFT SAVED</span>
                        </div>
                      )
                    )
                  ) : formData.docstatus === 1 ? (
                    (allowedActions.includes('cancel') || allowedActions.length === 0) ? (
                      <button
                        type="button"
                        onClick={() => handleDocAction('cancel')}
                        disabled={saving}
                        className="h-full bg-[#dc2626] hover:bg-[#b91c1c] text-white border-2 border-[#dc2626] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                        style={{ borderRadius: '8px' }}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                          <X size={15} />
                          <span>CANCEL</span>
                        </div>
                        <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'cancel', 'Alt+C')}</span>
                      </button>
                    ) : (
                      <div className="h-full bg-slate-100 border-2 border-slate-200 rounded-xl px-3 py-2 flex items-center justify-center text-slate-400 font-black text-[11px] uppercase tracking-wider select-none" style={{ borderRadius: '8px' }}>
                        <span>LOCKED</span>
                      </div>
                    )
                  ) : (
                    (allowedActions.includes('amend') || allowedActions.length === 0) ? (
                      <button
                        type="button"
                        onClick={() => handleDocAction('amend')}
                        disabled={saving}
                        className="h-full bg-[#1d4ed8] hover:bg-[#1e40af] text-white border-2 border-[#1d4ed8] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                        style={{ borderRadius: '8px' }}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                          <Plus size={15} />
                          <span>AMEND</span>
                        </div>
                        <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'amend', 'Alt+M')}</span>
                      </button>
                    ) : (
                      <div className="h-full bg-slate-100 border-2 border-slate-200 rounded-xl px-3 py-2 flex items-center justify-center text-slate-400 font-black text-[11px] uppercase tracking-wider select-none" style={{ borderRadius: '8px' }}>
                        <span>CANCELLED</span>
                      </div>
                    )
                  )}

                  {/* Slot 2: CREATE PAYMENT ENTRY (Submitted) / DELETE (Draft) */}
                  {formData.docstatus === 1 ? (
                    <button
                      type="button"
                      onClick={() => handleCreatePayment()}
                      disabled={saving}
                      className="h-full bg-[#d97706] hover:bg-[#b45309] text-white border-2 border-[#d97706] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                      style={{ borderRadius: '8px' }}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                        <Plus size={15} />
                        <span>PAYMENT ENTRY</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">+Pay</span>
                    </button>
                  ) : formData.docstatus === 0 && docName && (allowedActions.includes('delete') || allowedActions.length === 0) ? (
                    <button
                      type="button"
                      onClick={() => handleDocAction('delete')}
                      disabled={saving}
                      className="h-full bg-[#fff5f5] hover:bg-[#fed7d7] text-[#7f1d1d] border-2 border-[#fca5a5] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                      style={{ borderRadius: '8px' }}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#7f1d1d]">
                        <Trash2 size={15} />
                        <span>DELETE</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-[#dc2626] text-white">Del</span>
                    </button>
                  ) : (
                    <div className="h-full bg-amber-50 border-2 border-amber-200 rounded-xl px-3 py-2 flex items-center justify-center text-amber-700 font-black text-[11px] uppercase tracking-wider select-none" style={{ borderRadius: '8px' }}>
                      <span>{formData.docstatus === 2 ? 'CANCELLED' : 'DRAFT MODE'}</span>
                    </div>
                  )}

                  {/* Slot 3: DUPLICATE */}
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={!docName}
                    className="h-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white border-2 border-[#7c3aed] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                    style={{ borderRadius: '8px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Copy size={15} />
                      <span>DUPLICATE</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'duplicate', 'Alt+D')}</span>
                  </button>

                  {/* Slot 4: PRINT PDF */}
                  <button
                    type="button"
                    onClick={() => handlePrintPDF(docName)}
                    disabled={!docName}
                    className="h-full bg-[#0284c7] hover:bg-[#0369a1] text-white border-2 border-[#0284c7] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                    style={{ borderRadius: '8px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <Printer size={15} />
                      <span>PRINT PDF</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">PDF</span>
                  </button>

                  {/* Slot 5: ADD ROW (Draft) / BULK QTY */}
                  {formData.docstatus === 0 || formData.docstatus === undefined ? (
                    <button
                      type="button"
                      onClick={addItemRow}
                      disabled={formData.docstatus !== 0 && formData.docstatus !== undefined}
                      className="h-full bg-[#0284c7] hover:bg-[#0369a1] text-white border-2 border-[#0284c7] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                      style={{ borderRadius: '8px' }}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                        <Plus size={15} />
                        <span>ADD ROW</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'addRowAlt', 'Alt+A')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBulkQtyOpen}
                      disabled={formData.docstatus !== 0 && formData.docstatus !== undefined}
                      className="h-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white border-2 border-[#8b5cf6] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                      style={{ borderRadius: '8px' }}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                        <LayoutGrid size={15} />
                        <span>BULK QTY</span>
                      </div>
                      <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">{getShortcut('doc_editor', 'bulkQty', 'F6')}</span>
                    </button>
                  )}

                  {/* Slot 6: CLOSE / EXIT */}
                  <button
                    type="button"
                    onClick={() => {
                      if (docName && (isEditMode || isViewMode)) {
                        setIsModalOpen(false);
                        setSearchParams({});
                      } else {
                        navigate('/homepage');
                      }
                    }}
                    className="h-full bg-slate-700 hover:bg-slate-800 text-white border-2 border-slate-700 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                    style={{ borderRadius: '8px' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      <ChevronLeft size={15} />
                      <span>EXIT</span>
                    </div>
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-black px-2 py-0.5 rounded bg-white/20 text-white">Esc</span>
                  </button>
                </div>
              </div>

              {/* TOTALS CARD (RIGHT SIDE) */}
              <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">TAX TEMPLATE</span>
                    <select
                      value={formData.taxes_and_charges || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxes_and_charges: e.target.value }))}
                      className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer p-0 m-0 border-none"
                    >
                      <option value="">No Tax Schedule...</option>
                      {taxTemplates.map((t) => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">TOTAL QTY:</span>
                    <span className="text-sm font-black text-slate-900">{formData.items.filter(it => it && it.item_code).reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3 pt-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-bold uppercase text-slate-400 w-16">SUBTOTAL</span>
                      <span className="text-slate-800 font-bold text-sm">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-bold uppercase text-slate-400 w-16">TAX</span>
                      <span className="text-slate-600 font-bold text-sm">{formatPrice(taxTotal)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GRAND TOTAL</span>
                    <span className="text-2xl font-black text-emerald-600 leading-none flex items-center gap-0.5 mt-0.5">
                      <DirhamIcon size={18} /> {formatPrice(grandTotal)}
                    </span>
                  </div>
                </div>

                {/* Live Reconciliation Bar */}
                {(() => {
                  const suppAmt = parseFloat(formData.custom_supplier_invoice_amount) || 0;
                  const diff = parseFloat(grandTotal) - suppAmt;
                  const isMatched = suppAmt > 0 && Math.abs(diff) < 0.01;
                  const isUnmatched = suppAmt > 0 && Math.abs(diff) >= 0.01;

                  return (
                    <div className="mt-1 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Bill: AED {formatPrice(suppAmt)}</span>
                        {suppAmt > 0 && (
                          <span className={`text-[10px] font-black ${isMatched ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Diff: {diff > 0 ? '+' : ''}{formatPrice(diff)}
                          </span>
                        )}
                      </div>
                      <div>
                        {isMatched ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wide flex items-center gap-1">
                            <CheckCircle size={11} className="text-emerald-600" />
                            <span>MATCHED</span>
                          </span>
                        ) : isUnmatched ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black tracking-wide flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={11} className="text-rose-600" />
                            <span>UNMATCHED</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">Bill Amt Not Entered</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
          doctype="Purchase Invoice"
        />
      </div>

      {/* QUICK ITEM CREATE MODAL — outside classic-root stacking context */}
      <QuickItemCreateModal
        isOpen={showQuickItemModal}
        onClose={() => {
          setShowQuickItemModal(false);
          setQuickItemInitialCode('');
          setQuickItemTargetRow(null);
        }}
        initialItemCode={quickItemInitialCode}
        initialItemName={quickItemInitialCode}
        warehouse={formData.set_warehouse || warehouse || localStorage.getItem('warehouse')}
        onItemCreated={(createdItem) => {
          if (quickItemTargetRow !== null && quickItemTargetRow >= 0) {
            selectItem(quickItemTargetRow, createdItem);
          }
        }}
      />
    </>
    );
  }

  // =========================================================================
  // MODERN / MODAL RENDER
  // =========================================================================
  if (isModalOpen) {
    return (
      <>
        <div className="erp-page so-page font-sans bg-[#f8fafc] min-h-screen flex flex-col" style={{ height: '100vh', overflowY: 'auto' }}>
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
            .purchase-table .premium-cell-box div.relative.flex-1 input:focus,
            .classic-table input:focus,
            .classic-table select:focus,
            input:focus,
            select:focus,
            button:focus-visible {
              background-color: #d1fae5 !important;
              outline: 2.5px solid #059669 !important;
              outline-offset: -1.5px !important;
              box-shadow: inset 0 0 0 1.5px #059669, 0 0 0 4px rgba(16, 185, 129, 0.35) !important;
              color: #064e3b !important;
              font-weight: 900 !important;
              z-index: 20 !important;
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
                <span className="so-shortcut-key">Alt+S</span>
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

          <PageHeader className="so-page-header" style={{ padding: '0.85rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, tracking: 'tight', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isViewMode ? 'View' : (docName ? 'Edit' : 'New')} {formData.is_return === 1 ? 'Debit Note' : 'Purchase Invoice'}
                </h2>
                {docName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', margin: '0.1rem 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{docName} • Accounts</p>
                    <a
                      href={`http://75.119.130.59:8089/app/purchase-invoice/${encodeURIComponent(docName)}`}
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
                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={() => dispatch(toggleTheme())}
                  className="erp-button erp-button-secondary so-btn-secondary"
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
                      className="erp-button erp-button-secondary so-btn-secondary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
                    >
                      <Printer size={14} /> PRINT PDF
                    </button>

                    <button
                      onClick={handleDuplicate}
                      className="erp-button erp-button-secondary so-btn-secondary"
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
                        onClick={() => { setIsViewMode(false); setSearchParams({ name: docName, mode: 'edit' }); }}
                        className="erp-button erp-button-secondary so-btn-secondary"
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
                        className="erp-button erp-button-primary so-btn-primary"
                        style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                      >
                        {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                      </button>
                    ) : (
                      // Saved Document -> Show Save Draft if dirty, else Submit
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {isDirty && !isViewMode ? (
                          <button
                            onClick={() => handleDocAction('save')}
                            disabled={saving}
                            className="erp-button erp-button-secondary so-btn-secondary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', transition: 'all 0.2s' }}
                          >
                            {saving ? <Loader2 size={14} className="so-spinner" /> : 'SAVE DRAFT'}
                          </button>
                        ) : (
                          (allowedActions.includes('submit') || allowedActions.length === 0) && (
                            <button
                              onClick={() => handleDocAction('submit')}
                              disabled={saving}
                              className="erp-button erp-button-primary so-btn-primary"
                              style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                            >
                              {saving ? <Loader2 size={14} className="so-spinner" /> : 'SUBMIT'}
                            </button>
                          )
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
                        className="erp-button erp-button-primary so-btn-primary"
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
                        className="erp-button erp-button-primary so-btn-primary"
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
                      className="erp-button erp-button-secondary so-btn-secondary"
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
              <button onClick={closeModal} className="erp-button erp-button-secondary so-btn-secondary" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <ChevronLeft size={16} /> Back to List
              </button>
            </div>
          </PageHeader>

          <div className="erp-dialog-body so-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
            <div className="w-full flex flex-col gap-6">

              {/* STOCK UPDATE HIGHLIGHT BANNER */}
              {formData.update_stock ? (
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  boxShadow: '0 1px 2px rgba(16,185,129,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#10b981', display: 'inline-block',
                      boxShadow: '0 0 0 3px #d1fae5'
                    }} />
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#047857', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        🟢 UPDATE STOCK: ACTIVE (YES)
                      </span>
                      <p style={{ fontSize: '0.7rem', color: '#059669', margin: '2px 0 0', fontWeight: 600 }}>
                        Physical warehouse inventory will be <strong>INCREMENTED</strong> upon submitting this Purchase Invoice.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 900, color: '#047857',
                      background: '#d1fae5', padding: '4px 10px', borderRadius: '6px',
                      border: '1px solid #6ee7b7', textTransform: 'uppercase'
                    }}>
                      PI Stock Entry (update_stock = 1)
                    </span>
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, update_stock: false }))}
                        style={{
                          fontSize: '0.65rem', fontWeight: 800, color: '#475569',
                          background: '#ffffff', padding: '3px 8px', borderRadius: '6px',
                          border: '1px solid #cbd5e1', cursor: 'pointer'
                        }}
                      >
                        Turn OFF Stock Update
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  boxShadow: '0 1px 2px rgba(14,165,233,0.05)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#0ea5e9', display: 'inline-block',
                      boxShadow: '0 0 0 3px #e0f2fe'
                    }} />
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        ℹ️ UPDATE STOCK: INACTIVE (NO)
                      </span>
                      <p style={{ fontSize: '0.7rem', color: '#0284c7', margin: '2px 0 0', fontWeight: 600 }}>
                        Warehouse inventory was <strong>ALREADY UPDATED</strong> via Purchase Receipt (PR) or stock update is disabled for this invoice.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 900, color: '#0369a1',
                      background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px',
                      border: '1px solid #7dd3fc', textTransform: 'uppercase'
                    }}>
                      Accounting Only (update_stock = 0)
                    </span>
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, update_stock: true }))}
                        style={{
                          fontSize: '0.65rem', fontWeight: 800, color: '#475569',
                          background: '#ffffff', padding: '3px 8px', borderRadius: '6px',
                          border: '1px solid #cbd5e1', cursor: 'pointer'
                        }}
                      >
                        Turn ON Stock Update
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Basic Details Card (Collapsible) */}
              <div className="erp-card so-card">
                <div className="erp-section-header so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="so-card-title">Basic Details (Supplier & Invoice Info)</p>
                  <button
                    type="button"
                    onClick={() => setShowPrimaryInfo(p => !p)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] border border-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title={showPrimaryInfo ? "Collapse Basic Details" : "Expand Basic Details"}
                  >
                    {showPrimaryInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    <span>{showPrimaryInfo ? 'HIDE DETAILS' : 'SHOW DETAILS'}</span>
                  </button>
                </div>
                {showPrimaryInfo && (
                <div className="so-card-body">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Column 1: Supplier, Posting Date, Supplier Invoice No, Payment Type */}
                    <div className="md:col-span-4 flex flex-col gap-4">
                      <div className="so-field">
                        <label className="so-label">Supplier {!isViewMode && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        <CustomSearchDropdown
                          placeholder="Search and select supplier..."
                          value={formData.supplier ? { name: formData.supplier, supplier_name: formData.supplier_name } : null}
                          onSelect={selectSupplier}
                          fetchData={fetchSuppliersAPI}
                          createOption={handleSupplierCreate}
                          optionsLabel="supplier_name"
                          globalSearch={true}
                          onGlobalSearch={onGlobalSupplierSearch}
                          onActivate={onActivateSupplier}
                          disabled={isViewMode || formData.docstatus !== 0}
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
                            onChange={e => {
                              const newPostingDate = e.target.value;
                              setFormData(prev => {
                                const calculatedDueDate = calcDueDate(newPostingDate, prev.is_cash_purchase, prev.credit_days);
                                const schedule = (prev.payment_schedule || []).map(row => ({
                                  ...row,
                                  due_date: calculatedDueDate
                                }));
                                return { ...prev, posting_date: newPostingDate, due_date: calculatedDueDate, payment_schedule: schedule };
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
                        <label className="so-label font-bold text-slate-700">Supplier Invoice No</label>
                        <input
                          type="text"
                          value={formData.bill_no}
                          onChange={e => setFormData(prev => ({ ...prev, bill_no: e.target.value }))}
                          placeholder="Enter invoice number..."
                          className="so-input"
                          disabled={isViewMode}
                        />
                      </div>

                      <div className="so-field">
                        <label className="so-label font-bold text-slate-700">Payment Type</label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            disabled={isViewMode}
                            onClick={() => {
                              setFormData(prev => {
                                const calculatedDueDate = calcDueDate(prev.posting_date, false, prev.credit_days);
                                const schedule = (prev.payment_schedule || []).map(row => ({
                                  ...row,
                                  due_date: calculatedDueDate
                                }));
                                return { ...prev, is_cash_purchase: false, due_date: calculatedDueDate, payment_schedule: schedule };
                              });
                            }}
                            className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${!formData.is_cash_purchase
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${!formData.is_cash_purchase ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                            CREDIT
                          </button>

                          <button
                            type="button"
                            disabled={isViewMode}
                            onClick={() => {
                              setFormData(prev => {
                                const calculatedDueDate = calcDueDate(prev.posting_date, true, prev.credit_days);
                                const schedule = (prev.payment_schedule || []).map(row => ({
                                  ...row,
                                  due_date: calculatedDueDate
                                }));
                                return { ...prev, is_cash_purchase: true, due_date: calculatedDueDate, payment_schedule: schedule };
                              });
                            }}
                            className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${formData.is_cash_purchase
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${formData.is_cash_purchase ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                            CASH
                          </button>
                        </div>
                        {formData.is_cash_purchase && (
                          <p className="text-[10px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                            ⚡ Auto-creates Cash Payment Entry upon Submit!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Target Warehouse, Due Date, Supplier Invoice Date, Supplier Invoice Amount */}
                    <div className="md:col-span-4 flex flex-col gap-4">
                      <div className="so-field">
                        <label className="so-label">Target Warehouse (Branch) {!isViewMode && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        {isAdmin ? (
                          <select
                            name="accepted_warehouse"
                            value={formData.accepted_warehouse || ''}
                            onChange={e => setFormData(prev => ({ ...prev, accepted_warehouse: e.target.value }))}
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
                            value={formData.accepted_warehouse || warehouse || '—'}
                            disabled
                            className="so-input"
                            style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}
                          />
                        )}
                        {formErrors.accepted_warehouse && <span className="so-error-text">{formErrors.accepted_warehouse}</span>}
                      </div>

                      <div className="so-field">
                        <label className="so-label font-bold text-slate-700">Due Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                          <input
                            type="date"
                            value={formData.due_date || ''}
                            disabled={true}
                            className="so-input"
                            style={{ paddingLeft: '2.5rem', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 700, cursor: 'not-allowed' }}
                          />
                        </div>
                        {formData.is_cash_purchase ? (
                          <p className="text-[10px] text-emerald-600 font-bold mt-1 shadow-2xs">
                            ⚡ CASH Purchase: Due Date equals Posting Date
                          </p>
                        ) : (
                          <p className="text-[10px] text-indigo-600 font-bold mt-1 shadow-2xs">
                            💳 CREDIT Purchase: {formData.payment_terms_template ? `${formData.payment_terms_template} (${formData.credit_days || 0} Days)` : (formData.credit_days ? `${formData.credit_days} Days` : 'Same as Posting Date')}
                          </p>
                        )}
                      </div>

                      <div className="so-field">
                        <label className="so-label font-bold text-slate-700">Supplier Invoice Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                          <input
                            type="date"
                            value={formData.bill_date}
                            onChange={e => {
                              const newBillDate = e.target.value;
                              setFormData(prev => {
                                let newDueDate = prev.due_date;
                                // In ERPNext, Due Date cannot be before Supplier Invoice Date (bill_date)
                                if (newBillDate && prev.due_date && newBillDate > prev.due_date) {
                                  newDueDate = newBillDate;
                                }
                                const schedule = (prev.payment_schedule || []).map(row => ({
                                  ...row,
                                  due_date: newDueDate
                                }));
                                return { ...prev, bill_date: newBillDate, due_date: newDueDate, payment_schedule: schedule };
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
                        <label className="so-label font-bold text-slate-700">Supplier Invoice Amount (AED)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs pointer-events-none">AED</span>
                          <input
                            type="text" inputMode="decimal"
                            step="0.01"
                            value={formData.custom_supplier_invoice_amount}
                            onChange={e => setFormData(prev => ({ ...prev, custom_supplier_invoice_amount: e.target.value }))}
                            placeholder="0.00"
                            className="so-input font-bold text-slate-900"
                            style={{ paddingLeft: '3rem' }}
                            disabled={isViewMode}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Attachments */}
                    <div className="md:col-span-4 flex flex-col h-full justify-start mt-1">
                      <AttachmentSection doctype="Purchase Invoice" docname={docName} />
                    </div>
                  </div>
                </div>
                )}
              </div>



              {/* Items Card */}
              <div className="erp-card so-card">
                <div className="erp-section-header so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="flex items-center gap-4">
                    <p className="so-card-title">Items</p>
                    {!isViewMode && (
                      <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200 shadow-inner">
                        <Barcode size={16} className="text-slate-500 shrink-0" />
                        <input
                          ref={barcodeRef}
                          type="text"
                          value={barcodeInput}
                          onChange={e => setBarcodeInput(e.target.value)}
                          onKeyDown={handleBarcodeScan}
                          placeholder="Scan Barcode / Enter..."
                          disabled={barcodeLoading}
                          className="bg-transparent border-none text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none w-48"
                        />
                        {barcodeLoading && <Loader2 size={14} className="animate-spin text-slate-500 shrink-0" />}
                      </div>
                    )}
                  </div>
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
                  <div className="erp-table-scroll purchase-table-container" style={{ borderRadius: '0.4rem', border: '1px solid var(--so-border)', boxShadow: 'none' }}>
                    <table className="erp-table purchase-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center', position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#f8fafc' }}>No.</th>
                          {(() => {
                            const activeCols = columnConfig.filter(c => c.visible);
                            const anyBoxUom = formData.items.some(it => (it.uom || '').toLowerCase() === 'box');

                            const stickyLefts = {
                              'barcode': 40,
                              'item_code': 170,
                              'uom': 350,
                              'custom_box_qty': 440
                            };

                            return activeCols.map(col => {
                              if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
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
                                    textAlign: ['rate', 'amount', 'custom_selling_price', 'custom_box_selling_price', 'custom_box_price', 'last_purchase_rate', 'margin'].includes(col.id) ? 'right' :
                                      ['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id) ? 'left' : 'center',
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
                          <tr key={i} tabIndex={-1} onKeyDown={handleNextFocus}>
                            <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#ffffff' }}>{i + 1}</td>

                            {(() => {
                              const activeCols = columnConfig.filter(c => c.visible);
                              const isNosUom = !['box', 'master box'].includes((item.uom || '').toLowerCase());
                              const anyBoxUom = formData.items.some(it => ['box', 'master box'].includes((it.uom || '').toLowerCase()));

                              const stickyLefts = {
                                'barcode': 40,
                                'item_code': 170,
                                'uom': 350,
                                'custom_box_qty': 440
                              };

                              return activeCols.map(col => {
                                if (col.id === 'custom_box_selling_price' && !anyBoxUom) return null;
                                const isSticky = ['barcode', 'item_code', 'uom', 'custom_box_qty'].includes(col.id);
                                const tdStyle = isSticky ? {
                                  position: 'sticky',
                                  left: stickyLefts[col.id],
                                  zIndex: 10,
                                  backgroundColor: '#ffffff',
                                  boxShadow: col.id === 'custom_box_qty' ? '2px 0 5px -2px rgba(0,0,0,0.1)' : undefined
                                } : undefined;

                                switch (col.id) {
                                  case 'custom_box_qty':
                                    return (
                                      <td key={col.id} style={tdStyle}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                            {isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-slate-800 text-center pb-0.5 w-full">
                                                {item.use_box_entry ? (item.custom_box_qty || 0) : (item.qty || 0)}
                                              </div>
                                            ) : !item.use_box_entry ? (
                                              <input
                                                type="text" inputMode="decimal"
                                                step="1"
                                                value={item.qty !== undefined ? item.qty : ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => {
                                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                                  updateItem(i, 'qty', val === '' ? '' : parseInt(val, 10));
                                                }}
                                                className="so-input text-center font-bold w-full h-[28px] border-none"
                                                style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                                placeholder="Qty"
                                              />
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                step="1"
                                                value={item.custom_box_qty !== undefined ? item.custom_box_qty : ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => {
                                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                                  updateItem(i, 'custom_box_qty', val === '' ? '' : parseInt(val, 10));
                                                }}
                                                className="so-input text-center font-bold w-full h-[28px] border-none"
                                                style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_pieces_per_box':
                                    const isMbUnit = (item.uom || '').toLowerCase() === 'master box';
                                    const displayUnits = isMbUnit
                                      ? Math.round((parseFloat(item.custom_boxes_per_master_box) || 1) * (parseFloat(item.custom_pieces_per_box) || 1))
                                      : (item.custom_pieces_per_box || 1);
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isNosUom ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                            ) : isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-left pl-3 font-bold text-slate-800">
                                                {displayUnits}
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={isMbUnit ? displayUnits : (item.custom_pieces_per_box !== undefined ? item.custom_pieces_per_box : '')}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'custom_pieces_per_box', e.target.value)} onBlur={e => updateItem(i, 'custom_pieces_per_box', e.target.value ? Number(e.target.value).toFixed(2) : "")}
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
                                                name="custom_ref_sl_no"
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
                                  case 'barcode':
                                    return (
                                      <td key={col.id} style={tdStyle}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-slate-700">
                                                {item.scanned_barcode || '—'}
                                              </div>
                                            ) : (
                                              <input
                                                type="text"
                                                value={item.scanned_barcode || ''}
                                                onChange={e => updateItem(i, 'scanned_barcode', e.target.value)}
                                                onKeyDown={async e => {
                                                  if (e.key === 'Enter' && e.target.value.trim()) {
                                                    e.preventDefault();
                                                    const code = e.target.value.trim();
                                                    try {
                                                      const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
                                                      const res = await axios.get(`${API_PATH}.get_item_by_barcode_pi?${warehouseParam}`, {
                                                        params: { barcode: code },
                                                        withCredentials: true
                                                      });
                                                      const matched = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;
                                                      if (matched && matched.item_code) {
                                                        matched.scanned_barcode = code;
                                                        selectItem(i, matched);
                                                      } else {
                                                        alert('Item not found for barcode: ' + code);
                                                      }
                                                    } catch (err) {
                                                      console.error(err);
                                                    }
                                                  }
                                                }}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                placeholder="Scan..."
                                                className="so-input text-center font-bold text-[11px]"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'item_code':
                                    return (
                                      <td key={col.id} ref={el => itemRefs.current[i] = el} style={{ ...tdStyle, minWidth: '180px' }}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewMode ? (
                                              <div style={{ padding: '0.4rem 0.6rem' }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>{item.item_name}</div>
                                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem', fontWeight: 600 }}>{item.item_code}</div>
                                              </div>
                                            ) : (
                                              <div>
                                                <CustomSearchDropdown
                                                 placeholder="Search item..."
                                                 value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                 onSelect={(it, searchQuery) => {
                                                   if (!it) return;
                                                   const code = String(searchQuery || '').trim();
                                                   const itemWithBarcode =
                                                     /^\d{4,}$/.test(code)
                                                       ? {
                                                           ...it,
                                                           barcode: it.barcode || code,
                                                           scanned_barcode: it.scanned_barcode || code
                                                         }
                                                       : it;
                                                   selectItem(i, itemWithBarcode);
                                                 }}
                                                 fetchData={fetchItemsAPI}
                                                 createOption={(query) => {
                                                   setQuickItemInitialCode(query || '');
                                                   setQuickItemTargetRow(i);
                                                   setShowQuickItemModal(true);
                                                 }}
                                                 optionsLabel="item_name"
                                                 globalSearch={true}
                                                 onGlobalSearch={onGlobalItemSearch}
                                                 onActivate={onActivateItem}
                                               />
                                               {item.scanned_barcode && (
                                                  <div className="flex items-center gap-1 mt-1 px-1">
                                                    <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shadow-xs flex items-center gap-1">
                                                      <Barcode size={11} className="text-indigo-600 shrink-0" />
                                                      <span>{item.scanned_barcode}</span>
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'qty':
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                            {isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-[var(--so-primary)] text-center pb-0.5 w-full">
                                                {item.qty}
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={item.qty}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'qty', e.target.value)} onBlur={e => updateItem(i, 'qty', e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                                className="so-input text-center font-bold w-full h-[28px] border-none"
                                                style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'uom':
                                    return (
                                      <td key={col.id} style={tdStyle}>
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
                                                className="w-full h-8 text-center text-xs font-black text-slate-800 bg-white border-none outline-none transition-all focus:bg-emerald-100 focus:text-emerald-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
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
                                                  candidates.push('Master Box');

                                                  candidates.forEach(u => {
                                                    const norm = u.trim().toLowerCase();
                                                    let display = u.trim();
                                                    if (norm === 'box') display = 'Box';
                                                    else if (norm === 'nos') display = 'Nos';
                                                    else if (norm === 'master box') display = 'Master Box';

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
                                                {formatPrice(uomPriceDisplay)}
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={uomPriceDisplay !== undefined ? uomPriceDisplay : ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, isMbRow ? 'custom_master_box_price' : 'custom_box_price', e.target.value)}
                                                onBlur={e => updateItem(i, isMbRow ? 'custom_master_box_price' : 'custom_box_price', e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                                className="so-input text-right pr-3 font-bold"
                                                style={{ textAlign: 'right' }}
                                                step="0.01"
                                                placeholder="UOM Price"
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
                                            {item.use_box_entry || ['box', 'master box'].includes((item.uom || '').toLowerCase()) ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                            ) : isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-[var(--so-primary)]">
                                                {formatPrice(item.rate)}
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={item.rate}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'rate', e.target.value)} onBlur={e => updateItem(i, 'rate', e.target.value ? Number(e.target.value).toFixed(2) : "")}
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
                                                type="text" inputMode="decimal"
                                                value={item.custom_selling_price || ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'custom_selling_price', e.target.value)}
                                                onBlur={e => {
                                                  const sellVal = parseFloat(e.target.value) || 0;
                                                  const rateVal = parseFloat(item.rate) || 0;
                                                  if (sellVal > 0 && rateVal > 0 && sellVal < rateVal) {
                                                    updateItem(i, 'custom_selling_price', '');
                                                    Swal.fire({
                                                      icon: 'error',
                                                      title: 'Price Restriction Warning',
                                                      html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Selling Price (<b>AED ${sellVal.toFixed(2)}</b>) cannot be LESS than Buying Rate (<b>AED ${rateVal.toFixed(2)}</b>)!<br/><br/><i>Entered value has been cleared.</i>`,
                                                      confirmButtonColor: '#ef4444'
                                                    });
                                                  }
                                                }}
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
                                                  type="text" inputMode="decimal"
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
                                                    const val = parseFloat(item._temp_box_selling_price !== undefined ? item._temp_box_selling_price : (item.custom_selling_price ? (item.custom_selling_price * (item.custom_pieces_per_box || 1)) : 0)) || 0;
                                                    const pcs = parseFloat(item.custom_pieces_per_box) || 1;
                                                    const buyRateNos = parseFloat(item.rate) || 0;
                                                    const buyPriceBox = parseFloat(item.custom_box_price) || (buyRateNos * pcs);

                                                    if (val > 0 && buyPriceBox > 0 && val < buyPriceBox) {
                                                      setFormData(prev => {
                                                        const newItems = [...prev.items];
                                                        newItems[i] = {
                                                          ...newItems[i],
                                                          custom_selling_price: '',
                                                          _temp_box_selling_price: undefined
                                                        };
                                                        return { ...prev, items: newItems };
                                                      });
                                                      Swal.fire({
                                                        icon: 'error',
                                                        title: 'Box Price Restriction Warning',
                                                        html: `Row #${i + 1} (${item.item_name || item.item_code}):<br/>Selling Price per Box (<b>AED ${val.toFixed(2)}</b>) cannot be LESS than Buying Price per Box (<b>AED ${buyPriceBox.toFixed(2)}</b>)!<br/><br/><i>Entered value has been cleared.</i>`,
                                                        confirmButtonColor: '#ef4444'
                                                      });
                                                      return;
                                                    }

                                                    setFormData(prev => {
                                                      const newItems = [...prev.items];
                                                      const nosVal = parseFloat(newItems[i].custom_selling_price);
                                                      newItems[i] = {
                                                        ...newItems[i],
                                                        custom_selling_price: isNaN(nosVal) ? '' : nosVal,
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
                                  case 'discount_percentage':
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800">
                                                {parseFloat(item.discount_percentage || 0).toFixed(2)}%
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={item.discount_percentage ?? ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'discount_percentage', e.target.value)} onBlur={e => updateItem(i, 'discount_percentage', e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                                className="so-input text-right pr-3 font-bold text-rose-600"
                                                style={{ textAlign: 'right' }}
                                                step="0.01"
                                                placeholder="0%"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'discount_amount':
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-800">
                                                {formatPrice(item.discount_amount || 0)}
                                              </div>
                                            ) : (
                                              <input
                                                type="text" inputMode="decimal"
                                                value={item.discount_amount ?? ''}
                                                onFocus={e => e.target.select()}
                                                onClick={e => e.target.select()}
                                                onChange={e => updateItem(i, 'discount_amount', e.target.value)} onBlur={e => updateItem(i, 'discount_amount', e.target.value ? Number(e.target.value).toFixed(2) : "")}
                                                className="so-input text-right pr-3 font-bold text-rose-600"
                                                style={{ textAlign: 'right' }}
                                                step="0.01"
                                                placeholder="0.00"
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
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
                                  case 'last_purchase_rate':
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-amber-700 bg-amber-50/50" style={{ textAlign: 'right' }}>
                                              {item.last_purchase_rate || item.last_buying_rate ? formatPrice(item.last_purchase_rate || item.last_buying_rate) : '0'}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'margin': {
                                    const { marginPercent, isLoss } = calculateItemMargin(item);
                                    return (
                                      <td key={col.id}>
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <div
                                              className={`premium-cell-readonly premium-cell-readonly-right pr-3 font-bold ${
                                                isLoss ? 'text-rose-700 bg-rose-50/50' : 'text-emerald-700 bg-emerald-50/50'
                                              }`}
                                              style={{ textAlign: 'right' }}
                                            >
                                              {marginPercent !== null ? `${marginPercent}%` : '—'}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  }
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
                  <div className="erp-card so-card">
                    <div className="erp-section-header so-card-header">
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
                            type="text" inputMode="decimal"
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
                            type="text" inputMode="decimal"
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
                    <div className="erp-card so-card">
                      <div className="erp-section-header so-card-header">
                        <p className="so-card-title">Taxes & Charges</p>
                      </div>
                      <div className="so-card-body">
                        <div className="erp-table-scroll purchase-table-container" style={{ boxShadow: 'none', border: '1px solid var(--so-border)', marginTop: 0 }}>
                          <table className="erp-table purchase-table">
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
                <div className="erp-card so-card" style={{
                  background: isGreen
                    ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                    : 'linear-gradient(135deg, #0c4a6e 0%, #075985 100%)',
                  color: 'white',
                  height: '100%'
                }}>
                  <div className="erp-section-header so-card-header" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
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

                    {/* Supplier Invoice Reconciliation Section */}
                    {(() => {
                      const suppAmt = parseFloat(formData.custom_supplier_invoice_amount) || 0;
                      const diff = grandTotal - suppAmt;
                      const isMatched = Math.abs(diff) < 0.01;

                      return (
                        <div className="mt-3 p-3 rounded-xl border bg-black/20 backdrop-blur-xs flex flex-col gap-2">
                          <div className="flex justify-between items-center text-xs opacity-90 font-medium">
                            <span>Supplier Bill Amount:</span>
                            <span className="font-bold flex items-center gap-1"><DirhamIcon size={11} /> {formatPrice(suppAmt)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs opacity-90 font-medium">
                            <span>Difference:</span>
                            <span className={`font-bold flex items-center gap-1 ${diff === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {diff > 0 ? '+' : ''}<DirhamIcon size={11} /> {formatPrice(diff)}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">Status</span>
                            {isMatched ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 text-[11px] font-black tracking-wide flex items-center gap-1.5 shadow-sm">
                                <CheckCircle size={12} className="text-emerald-400" />
                                <span>✓ MATCHED</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/30 border border-rose-400/50 text-rose-200 text-[11px] font-black tracking-wide flex items-center gap-1.5 shadow-sm animate-pulse">
                                <AlertTriangle size={12} className="text-rose-300" />
                                <span>⚠ UNMATCHED</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
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

        {/* QUICK ITEM CREATE MODAL — outside so-page div, portal renders to document.body */}
        <QuickItemCreateModal
          isOpen={showQuickItemModal}
          onClose={() => {
            setShowQuickItemModal(false);
            setQuickItemInitialCode('');
            setQuickItemTargetRow(null);
          }}
          initialItemCode={quickItemInitialCode}
          initialItemName={quickItemInitialCode}
          warehouse={formData.set_warehouse || warehouse || localStorage.getItem('warehouse')}
          onItemCreated={(createdItem) => {
            if (quickItemTargetRow !== null && quickItemTargetRow >= 0) {
              selectItem(quickItemTargetRow, createdItem);
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="erp-page so-page">
        {/* Header */}
        <div className="so-page-header-container" style={{ display: isModalOpen ? 'none' : 'block' }}>
          <div className="so-page-tabs">
            <span className="so-page-tab active">Purchase Invoice</span>
            <span className="so-page-tab" onClick={() => navigate('/purchasereport')} style={{ cursor: 'pointer' }}>Reports</span>
          </div>
          <PageHeader className="so-page-header">
            <div>
              <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <Package size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
                <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                  PURCHASE INVOICE MANAGEMENT
                </span>
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                Manage and track all purchase invoices
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={() => setPiTheme(isGreen ? 'blue' : 'green')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  background: '#ffffff',
                  color: themeColor || '#0082f6',
                  border: `1.5px solid ${themeColor || '#0082f6'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease-in-out',
                  boxSizing: 'border-box'
                }}
                title="Toggle Theme"
              >
                <Palette size={14} />
                <span>{piTheme.toUpperCase()}</span>
              </button>

              <button
                type="button"
                onClick={() => setSearchParams({ name: 'new' })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  background: themeColor || '#0082f6',
                  color: '#ffffff',
                  border: `1.5px solid ${themeColor || '#0082f6'}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 130, 246, 0.25)',
                  transition: 'all 0.15s ease-in-out',
                  boxSizing: 'border-box'
                }}
              >
                <Plus size={16} />
                <span>CREATE INVOICE</span>
              </button>
            </div>
          </PageHeader>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column', display: isModalOpen ? 'none' : 'flex', background: '#f8fafc', padding: '1.5rem 2rem' }}>
          {/* Top Filters Bar */}
          <div className="erp-filter-bar so-filter-bar" style={{
            background: '#f8fafc',
            padding: '0 0 1.25rem 0',
            borderBottom: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end',
            marginBottom: '0.5rem'
          }}>
            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>INVOICE NUMBER</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
                <input
                  type="text"
                  placeholder="Search invoice..."
                  value={filterName}
                  onChange={e => setFilterName(e.target.value)}
                  className="so-filter-input so-filter-input-icon"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 180px' }}>
              <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>SUPPLIER</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
                <input
                  type="text"
                  placeholder="Search supplier..."
                  value={filterSupplier}
                  onChange={e => setFilterSupplier(e.target.value)}
                  className="so-filter-input so-filter-input-icon"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 140px' }}>
              <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>STATUS</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="so-filter-input"
                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', fontWeight: 600, color: '#0f172a' }}
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
              <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>FROM DATE</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="so-filter-input"
                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: filterDateFrom ? '#0f172a' : '#64748b', fontWeight: 500 }}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            <div style={{ flex: '1 1 150px' }}>
              <label className="so-filter-label" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>TO DATE</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="so-filter-input"
                style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: filterDateTo ? '#0f172a' : '#64748b', fontWeight: 500 }}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            <button
              type="button"
              onClick={clearFilters}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              {(filterName || filterSupplier || filterStatus || filterDateFrom || filterDateTo) ? <X size={14} /> : null}
              <span>CLEAR</span>
            </button>
          </div>

          {/* Table Area */}
          <div className="so-content" style={{ padding: 0 }}>
            <p className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{total} record(s) found</p>
            <div className="erp-table-card so-table-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
              {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                  <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1rem', color: '#64748b', fontWeight: 600 }}>Loading invoices...</p>
                </div>
              ) : (
                <>
                  <div className="erp-table-scroll purchase-table-container">
                    <table className="erp-table so-table">
                      <thead>
                        <tr>
                          {!hiddenDefaults.includes('name') && (
                            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>INVOICE NUMBER</span>
                                {renderSortIcon('name')}
                              </div>
                            </th>
                          )}
                          {!hiddenDefaults.includes('supplier_name') && (
                            <th onClick={() => handleSort('supplier_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>SUPPLIER</span>
                                {renderSortIcon('supplier_name')}
                              </div>
                            </th>
                          )}
                          {!hiddenDefaults.includes('set_warehouse') && (
                            <th onClick={() => handleSort('set_warehouse')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>BRANCH / WAREHOUSE</span>
                                {renderSortIcon('set_warehouse')}
                              </div>
                            </th>
                          )}
                          {!hiddenDefaults.includes('posting_date') && (
                            <th onClick={() => handleSort('posting_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>DATE</span>
                                {renderSortIcon('posting_date')}
                              </div>
                            </th>
                          )}
                          {!hiddenDefaults.includes('status') && (
                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>STATUS</span>
                                {renderSortIcon('status')}
                              </div>
                            </th>
                          )}
                          {!hiddenDefaults.includes('grand_total') && (
                            <th onClick={() => handleSort('grand_total')} style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                <span>AMOUNT</span>
                                {renderSortIcon('grand_total')}
                              </div>
                            </th>
                          )}
                          {customColumns.map(col => (
                            <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span>{col.replace(/_/g, ' ').toUpperCase()}</span>
                                {renderSortIcon(col)}
                              </div>
                            </th>
                          ))}
                          <th style={{ width: '48px', textAlign: 'center', verticalAlign: 'middle', padding: '0 4px' }}>
                            <ListCustomizer
                              doctype="Purchase Invoice"
                              defaultColumns={DEFAULT_PI_LIST_COLUMNS}
                              iconOnly
                              onSave={(cols, hidden) => {
                                setCustomColumns(cols);
                                setHiddenDefaults(hidden);
                              }}
                              themeColor={themeColor || '#0082f6'}
                              title="Configure Columns"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.length === 0 ? (
                          <tr>
                            <td colSpan={DEFAULT_PI_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} className="erp-empty so-empty">
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
                              {!hiddenDefaults.includes('name') && (
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
                              )}
                              {!hiddenDefaults.includes('supplier_name') && (
                                <td>
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterSupplier(inv.supplier_name || inv.supplier || '');
                                      setCurrentPage(1);
                                    }}
                                    title="Click to filter by supplier"
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div style={{ fontWeight: 600 }}>{inv.supplier_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{inv.supplier}</div>
                                  </div>
                                </td>
                              )}
                              {!hiddenDefaults.includes('set_warehouse') && (
                                <td>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (inv.custom_branch || inv.set_warehouse) {
                                        setFilterName(inv.custom_branch || inv.set_warehouse);
                                        setCurrentPage(1);
                                      }
                                    }}
                                    title="Click to filter by branch/warehouse"
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      color: '#334155',
                                      backgroundColor: '#f1f5f9',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '0.375rem',
                                      border: '1px solid #e2e8f0',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {inv.custom_branch || inv.set_warehouse || '—'}
                                  </span>
                                </td>
                              )}
                              {!hiddenDefaults.includes('posting_date') && (
                                <td>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (inv.posting_date) {
                                        setFilterDateFrom(inv.posting_date);
                                        setFilterDateTo(inv.posting_date);
                                        setCurrentPage(1);
                                      }
                                    }}
                                    title="Click to filter by date"
                                    style={{ color: '#475569', fontSize: '0.85rem', cursor: 'pointer' }}
                                  >
                                    {inv.posting_date ? format(new Date(inv.posting_date), 'dd-MM-yyyy') : '—'}
                                  </span>
                                </td>
                              )}
                              {!hiddenDefaults.includes('status') && (
                                <td>
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterStatus(inv.status || '');
                                      setCurrentPage(1);
                                    }}
                                    title="Click to filter by status"
                                    className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" 
                                    style={{
                                      backgroundColor: inv.status === 'Paid' ? `${themeColor}20` : (inv.status === 'Unpaid' ? '#fef9c3' : (inv.status === 'Draft' ? '#f1f5f9' : '#fee2e2')),
                                      color: inv.status === 'Paid' ? themeColor : (inv.status === 'Unpaid' ? '#854d0e' : (inv.status === 'Draft' ? '#64748b' : '#ef4444')),
                                      border: `1px solid ${inv.status === 'Paid' ? `${themeColor}40` : (inv.status === 'Unpaid' ? '#fde047' : (inv.status === 'Draft' ? '#e2e8f0' : '#fecaca'))}`,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                              )}
                              {!hiddenDefaults.includes('grand_total') && (
                                <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                  <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} /> {inv.is_return === 1 ? '-' : ''}{Math.abs(inv.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </td>
                              )}
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
                                      <button
                                        style={{ width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.8rem', color: '#0284c7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        onClick={() => handlePrintPDF(inv.name)}
                                      >
                                        <Printer size={13} /> Print PDF
                                      </button>
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
                    <div className="erp-pagination so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

      {/* QUICK ITEM CREATE MODAL */}
      <QuickItemCreateModal
        isOpen={showQuickItemModal}
        onClose={() => {
          setShowQuickItemModal(false);
          setQuickItemInitialCode('');
          setQuickItemTargetRow(null);
        }}
        initialItemCode={quickItemInitialCode}
        initialItemName={quickItemInitialCode}
        warehouse={formData.set_warehouse || warehouse || localStorage.getItem('warehouse')}
        onItemCreated={(createdItem) => {
          if (quickItemTargetRow !== null && quickItemTargetRow >= 0) {
            selectItem(quickItemTargetRow, createdItem);
          }
        }}
      />
    </>
  );
}

export default PurchaseInvoiceList;