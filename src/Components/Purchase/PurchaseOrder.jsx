import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import POSService from '../../utils/posService';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package, Users,
  DollarSign, ShoppingCart, Save, Send, Trash2, Plus, Box, Scan, ChevronDown, ChevronUp, History,
  Search, File, Camera, X, Upload, Image as ImageIcon, Zap, Palette, Edit2, Edit3, Settings, Link, Copy
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import CustomSearchDropdown from './CustomSearchDropdown';
import ColumnConfigModal from './ColumnConfigModal';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './Purchase.css';
import '../Headers/LegacyPOS.css';
import AttachmentSection from '../Admin/AttachmentSection';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

const DEFAULT_PO_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
  { id: 'custom_ref_sl_no', label: 'Ref / Supplier SL #', visible: true, width: 120 },
  { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
  { id: 'uom', label: 'UOM', visible: true, width: 90 },
  { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
  { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
  { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
  { id: 'custom_selling_price', label: 'Selling Price', visible: true, width: 90 },
  { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
  { id: 'amount', label: 'Subtotal', visible: true, width: 90 }
];

const POItemModel = {
  item_code: null,
  item_name: '',
  rate: 0,
  amount: 0,
  custom_supplier_sl_num: '', // Legacy/Internal
  custom_ref_sl_no: '',       // NEW: REF / SL #
  supplier_part_no: '',       // Standard ERPNext field
  custom_box_qty: 0,
  custom_pieces_per_box: 1,
  custom_box_price: 0,
  use_box_entry: false,       // true = Box UOM selected, false = Nos/direct qty
  uom_list: [],               // available UOMs from item metadata
  last_buying_rate: 0,
  custom_selling_price: 0,
  received_qty: 0,
  rejected_qty: 0,
  rejected_warehouse: ''
};

const getLocalISOString = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
};

const getDefaultTaxTemplate = (templates, activeWarehouse) => {
  if (!templates || templates.length === 0) return '';
  const companyAbbr = activeWarehouse && activeWarehouse.includes(' - ')
    ? activeWarehouse.split(' - ').pop()
    : '';
  if (companyAbbr) {
    const target = templates.find(t =>
      t.name.toLowerCase().includes('5%') && t.name.toLowerCase().includes(companyAbbr.toLowerCase())
    );
    if (target) return target.name;
  }
  const target5Percent = templates.find(t =>
    t.name.toLowerCase().includes('vat 5%') || t.name.toLowerCase().includes('5%')
  );
  if (target5Percent) return target5Percent.name;
  return templates[0]?.name || '';
};

function PurchaseOrder() {
  const navigate = useNavigate();
  const { getShortcut, isShortcutPressed } = useCustomShortcuts();
  const { warehouse, user_roles, theme } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const navigateToDoc = (doctype, docname) => {
    const routes = {
      'Purchase Order': '/purchaseorder',
      'Purchase Receipt': '/purchasereceiptlist',
      'Purchase Invoice': '/purchaseinvoicelist',
    };
    const route = routes[doctype];
    if (route) {
      if (docname === formData.name) return; // Already on this doc
      navigate(`${route}?name=${encodeURIComponent(docname)}`);
    }
  };
  const [formData, setFormData] = useState({
    name: '', // For draft name
    supplier: null,
    transaction_date: getLocalISOString(),
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
  const [isViewOnly, setIsViewOnly] = useState(false); // ERP-style View mode vs Edit mode
  const [createdDocName, setCreatedDocName] = useState(null); // Store created PR/PI name
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(null); // Row index for history popup
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const [lastSavedData, setLastSavedData] = useState(null); // Added for dirty check
  const searchTimeoutRef = useRef(null);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState({});
  const [linkedCategories, setLinkedCategories] = useState({});
  const [linkedConnections, setLinkedConnections] = useState([]); // New state for dashboard connections
  const [linkedDocStatuses, setLinkedDocStatuses] = useState({});
  const [loadingLinks, setLoadingLinks] = useState(false);
  const html5QrcodeRef = useRef(null);

  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const createDropdownRef = useRef(null);

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

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = '';
  const API_PATH = `/api/method/kyle_retail.retail_api.api`;
  const RESOURCE_API = `/api/resource/Purchase Order`;

  const [scanningRow, setScanningRow] = useState(null); // Track which row is scanning
  const [poTheme, setPoTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const [drafts, setDrafts] = useState([]);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [allowedActions, setAllowedActions] = useState([]); // Workflow actions [save, submit, cancel, etc]

  // ----- Column Config -----
  const loadColumnConfig = () => {
    try {
      const saved = localStorage.getItem('purchase_matrix_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_PO_COLUMNS.map(c => c.id);
        const savedIds = parsed.map(c => c.id);

        // Match only valid PO columns and append any missing defaults
        const existing = parsed.filter(c => defaultIds.includes(c.id));
        const missing = DEFAULT_PO_COLUMNS.filter(c => !savedIds.includes(c.id));

        return [...existing, ...missing];
      }
    } catch (e) { console.error("PO Style Config Error:", e); }
    return DEFAULT_PO_COLUMNS;
  };

  const [poColumns, setPoColumns] = useState(loadColumnConfig);
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (newConfig) => {
    if (newConfig === null) {
      setPoColumns(DEFAULT_PO_COLUMNS);
      localStorage.removeItem('purchase_matrix_config');
    } else {
      setPoColumns(newConfig);
      localStorage.setItem('purchase_matrix_config', JSON.stringify(newConfig));
    }
    setShowColConfig(false);
  };

  useEffect(() => {
    if (formData.name) fetchWorkflowActions();
  }, [formData.name, formData.docstatus]);

  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      const activeEl = document.activeElement;
      const inItemsTable = activeEl?.closest('table.so-items-table, table.purchase-table');

      let activeRowIndex = -1;
      if (inItemsTable && activeEl) {
        const tr = activeEl.closest('tr');
        if (tr) {
          const rowIndexAttr = tr.getAttribute('data-row-index');
          if (rowIndexAttr !== null) {
            activeRowIndex = parseInt(rowIndexAttr, 10);
          }
        }
      }

      // Ctrl+ArrowDown, Ctrl+ArrowUp, or Shift+F3: Jump focus into items table rows
      if ((e.ctrlKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || (e.shiftKey && e.key === 'F3')) {
        const rows = document.querySelectorAll('table.so-items-table tbody tr, table.purchase-table tbody tr');
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
        const supplierInput = document.querySelector('input[placeholder="Search supplier..."]');
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
        const scanInput = document.querySelector('input[placeholder="Enter Barcode / Scan here..."]');
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
                const newQty = result.value || '';
                const name = item.use_box_entry ? 'custom_box_qty' : 'qty';
                handleInputChange({ target: { name, value: newQty } }, rowIndex);
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

      // Save Draft / Update Draft (Primary action)
      if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        if (!saving && formData.docstatus === 0) {
          handleDocAction('save');
        }
      }

      // Add Item Row
      if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        if (formData.docstatus === 0) {
          if (isViewOnly) {
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
        const warehouseSelect = document.querySelector('select[name="set_warehouse"]');
        if (warehouseSelect) {
          warehouseSelect.focus();
        }
      }

      // Submit document
      if (isShortcutPressed(e, 'doc_editor', 'submit', 'F12') || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (!loading && formData.docstatus === 0 && allowedActions.includes('submit')) {
          handleDocAction('submit');
        }
      }

      // Escape: Close configuration modals, reset selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showColConfig) setShowColConfig(false);
        else if (showDraftsList) setShowDraftsList(false);
        else if (showHistoryOverlay !== null) setShowHistoryOverlay(null);
        else if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
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
                if (formData.docstatus === 0 && !isViewOnly) {
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
                if (formData.docstatus === 0 && !isViewOnly) {
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
                if (formData.docstatus === 0 && !isViewOnly) {
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
      if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.so-items-table, table.purchase-table')) {
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
            const qtyInput = tr.querySelector('input[name="qty"]:not([disabled])') || tr.querySelector('input[name="custom_box_qty"]:not([disabled])');
            if (qtyInput && activeRowIndex !== -1) {
              e.preventDefault();
              const currentVal = parseFloat(qtyInput.value) || 0;
              const diff = isPlus ? 1 : -1;
              const newVal = Math.max(0, currentVal + diff);
              handleInputChange({ target: { name: qtyInput.name, value: newVal.toString() } }, activeRowIndex);
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
        if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
          const isQtyField = activeEl.name === 'qty' || activeEl.name === 'custom_box_qty';
          if (isQtyField && activeRowIndex !== -1) {
            e.preventDefault();
            const currentVal = parseFloat(activeEl.value) || 0;
            const diff = (e.key === '+' || e.key === '=') ? 1 : -1;
            const newVal = Math.max(0, currentVal + diff);
            handleInputChange({ target: { name: activeEl.name, value: newVal.toString() } }, activeRowIndex);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [formData, allowedActions, isViewOnly, saving, loading, taxTemplates]);



  const isDirty = useMemo(() => {
    if (!formData.name) return true; // New docs are always dirty
    const current = JSON.stringify(formData);
    return lastSavedData !== current;
  }, [formData, lastSavedData]);

  const fetchWorkflowActions = async () => {
    if (!formData.name) return;
    try {
      const res = await axios.get(`${API_PATH}.get_document_status_details`, {
        params: { doctype: 'Purchase Order', docname: formData.name },
        withCredentials: true
      });
      // Handle both nested data and direct message response structures
      const details = res.data.message?.data || res.data.message || {};
      setAllowedActions(details.allowed_actions || []);

      // Update completion percentages in formData for UI logic
      if (details.per_received !== undefined || details.per_billed !== undefined) {
        setFormData(prev => ({
          ...prev,
          per_received: details.per_received ?? prev.per_received,
          per_billed: details.per_billed ?? prev.per_billed
        }));
      }
    } catch (err) { console.error("Workflow fetch failed", err); }
  };

  const handleDocAction = async (action) => {
    // Basic validation before save/submit
    if (action === 'save' || action === 'submit') {
      if (!validateForm(action === 'submit')) return;
    }

    const confirmMap = {
      submit: 'Are you sure you want to SUBMIT this Purchase Order? Status will be Locked.',
      cancel: 'Are you sure you want to CANCEL this Purchase Order? Status will change to Cancelled.',
      delete: 'Are you sure you want to DELETE this Purchase Order? This action is IRREVERSIBLE.',
      amend: 'This will create a new Draft based on this cancelled PO. Proceed?'
    };

    if (confirmMap[action]) {
      const result = await Swal.fire({
        title: action.toUpperCase(),
        text: confirmMap[action],
        icon: action === 'delete' ? 'error' : 'warning',
        showCancelButton: true,
        confirmButtonColor: action === 'cancel' || action === 'delete' ? '#ef4444' : '#0ea5e9',
        confirmButtonText: `Yes, ${action} it!`
      });
      if (!result.isConfirmed) return;
    }

    setSaving(true);
    try {
      // 1. Prepare data for Save/Submit if needed
      let payload = null;
      if (action === 'save' || action === 'submit') {
        payload = {
          supplier: formData.supplier?.name || formData.supplier,
          company: formData.company,
          transaction_date: formData.transaction_date,
          set_warehouse: formData.set_warehouse,
          currency: formData.currency || 'AED',
          conversion_rate: 1.0,
          taxes_and_charges: formData.taxes_and_charges,
          items: formData.items.filter(i => i.item_code).map(item => {
            const isBox = (item.uom || '').toLowerCase() === 'box' || !!item.use_box_entry;
            return {
              item_code: item.item_code,
              item_name: item.item_name,
              qty: parseFloat(item.qty),
              uom: item.uom,
              rate: parseFloat(item.rate),
              warehouse: formData.set_warehouse || undefined,
              schedule_date: item.schedule_date || formData.transaction_date,
              custom_pieces_per_box: isBox ? parseFloat(item.custom_pieces_per_box || 1) : 1,
              custom_box_qty: isBox ? parseFloat(item.custom_box_qty || 0) : parseFloat(item.qty),
              custom_box_price: isBox ? parseFloat(item.custom_box_price || 0) : parseFloat(item.rate),
              custom_selling_price: parseFloat(item.custom_selling_price || 0),
              custom_supplier_sl_num: item.custom_ref_sl_no || item.custom_supplier_sl_num || "",
              custom_supplier_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || "",
              custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || "",
              supplier_part_no: item.supplier_part_no || item.custom_supplier_sl_num || ""
            };
          }),
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
          naming_series: formData.naming_series || 'PO-',
          name: formData.name || undefined
        };
      }

      let res;
      if (action === 'save' || action === 'submit') {
        res = await axios.post(`${API_PATH}.save_transaction_document`, {
          doctype: 'Purchase Order',
          doc_data: payload,
          action: action
        }, { withCredentials: true });
      } else if (action === 'amend') {
        // Use Dedicated Amend logic
        return handleAmendEntry();
      } else {
        // Use Workflow Engine for Lifecycle actions
        res = await axios.post(`${API_PATH}.handle_document_action`, {
          doctype: 'Purchase Order',
          docname: formData.name || undefined,
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
          navigate('/purchaseorderlist');
          return;
        }

        // Get the doc name from either response structure
        const nextDoc = (rawMsg.data && rawMsg.data.name) || rawMsg.new_name || rawMsg.docname || formData.name;

        if (nextDoc !== formData.name) {
          // Amendment or new doc creation
          loadDraft(nextDoc);
          if (action === 'amend') setIsViewOnly(false);
        } else {
          loadDraft(formData.name);
        }
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
    localStorage.setItem('legacySubTheme', poTheme);
    const primary = poTheme === 'green' ? '#10b981' : '#0ea5e9';
    const hover = poTheme === 'green' ? '#059669' : '#0284c7';
    const light = poTheme === 'green' ? '#f0fdf4' : '#f0f9ff';

    document.documentElement.style.setProperty('--po-primary', primary);
    document.documentElement.style.setProperty('--po-primary-hover', hover);
    document.documentElement.style.setProperty('--po-primary-light', light);
  }, [poTheme]);

  const formatPrice = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleBarcodeScan = (e, rowIndex) => {
    const value = e.target.value;
    const items = [...formData.items];
    items[rowIndex].temp_barcode = value;
    setFormData({ ...formData, items });
  };

  const handleNextFocus = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Find the row of the current input field
      const row = e.target.closest('tr');
      if (row) {
        // Find all editable inputs & selects in this row
        const rowInputs = Array.from(row.querySelectorAll('input:not([disabled]), select:not([disabled])')).filter(el => {
          return !el.readOnly && el.tabIndex !== -1 && el.offsetWidth > 0 && el.offsetHeight > 0;
        });

        const index = rowInputs.indexOf(e.target);
        if (index > -1 && index < rowInputs.length - 1) {
          // Move focus to next input in the same row
          const next = rowInputs[index + 1];
          next.focus();
          if (next.tagName === 'INPUT' && next.select) next.select();
        } else {
          // At the end of the current row, jump to the Item Search of the next row!
          const nextRow = row.nextElementSibling;
          if (nextRow) {
            const nextItemSearch = nextRow.querySelector('input[placeholder="Search item..."]');
            if (nextItemSearch) {
              nextItemSearch.focus();
            }
          } else {
            // No next row, focus on Save Draft or primary action button
            const saveBtn = document.querySelector('.so-btn-primary');
            saveBtn?.focus();
          }
        }
      } else {
        // Fallback for fields not inside the items table (e.g. headers)
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])')).filter(el => {
          return !el.readOnly && el.offsetWidth > 0 && el.offsetHeight > 0;
        });
        const index = inputs.indexOf(e.target);
        if (index > -1 && index < inputs.length - 1) {
          const next = inputs[index + 1];
          next.focus();
          if (next.tagName === 'INPUT' && next.select) next.select();
        }
      }
    }
  };

  const handleBarcodeEnter = async (e, rowIndex) => {
    if (e.key !== 'Enter') return;
    const barcode = e.target.value.trim();
    if (!barcode) return;

    setScanningRow(rowIndex);
    try {
      const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
      const res = await fetch(`${API_PATH}.get_item_by_barcode_po?barcode=${encodeURIComponent(barcode)}${warehouseParam}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Item not found');
      const data = await res.json();
      const item = Array.isArray(data.message) ? data.message[0] : data.message;
      if (!item || item.status === 'error' || (!item.item_code && !item.name)) {
        throw new Error(item?.message || `No item found for barcode: ${barcode}`);
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
          const isBox = (item.scanned_uom || item.uom || '').toLowerCase() === 'box';
          const piecesPerBox = parseFloat(item.custom_pieces_per_box || 12);
          const baseRate = parseFloat(item.last_buying_rate || item.rate || 0);
          const boxQty = 1;
          const totalPieces = isBox ? (boxQty * piecesPerBox) : 1;
          const totalAmount = totalPieces * baseRate;

          items[rowIndex] = {
            ...items[rowIndex],
            item_code: item.item_code,
            item_name: item.item_name,
            stock_uom: item.stock_uom || 'Nos',
            uom: isBox ? 'Box' : (item.stock_uom || 'Nos'),
            rate: baseRate,
            last_buying_rate: baseRate,
            qty: totalPieces,
            amount: totalAmount,
            custom_pieces_per_box: piecesPerBox,
            custom_box_price: baseRate * piecesPerBox,
            custom_box_qty: isBox ? boxQty : (piecesPerBox > 0 ? 1 / piecesPerBox : 1),
            use_box_entry: isBox,
            custom_supplier_sl_num: item.custom_supplier_sl_num || item.supplier_part_no || '',
            supplier_part_no: item.supplier_part_no || item.custom_supplier_sl_num || '',
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
    setTimeout(() => {
      try {
        const html5Qrcode = new Html5Qrcode("po-scanner-reader");
        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: (width, height) => {
            const boxWidth = Math.min(width * 0.8, 450);
            const boxHeight = Math.min(height * 0.6, 250);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.0
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
            const barcode = decodedText.trim();
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
          },
          () => {}
        ).catch(err => {
          console.error("Scanner failed, trying fallback device:", err);
          html5Qrcode.start(
            { deviceId: undefined },
            { ...config, formatsToSupport: formats },
            (decodedText) => {
              const barcode = decodedText.trim();
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
            },
            () => {}
          ).catch(finalErr => {
            console.error("All startup options failed:", finalErr);
            setIsScannerOpen(false);
          });
        });
      } catch (err) {
        console.error("Camera setup error:", err);
        setIsScannerOpen(false);
      }
    }, 150);
  };

  const stopCameraScanner = () => {
    if (html5QrcodeRef.current) {
      if (html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
      }
    }
    setIsScannerOpen(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    decodeImage(file);
  };

  const decodeImage = async (file) => {
    try {
      const html5Qrcode = html5QrcodeRef.current || new Html5Qrcode("po-scanner-reader");
      html5Qrcode.scanFile(file, false)
        .then(decodedText => {
          const barcode = decodedText.trim();
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
        })
        .catch(err => {
          Swal.fire({
            icon: 'error',
            title: 'Not Found',
            text: 'Could not find a valid barcode in this image. Please try again.',
            timer: 2000
          });
        });
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
      const res = await fetch(`${API_PATH}.get_purchase_orders?company=${encodeURIComponent(formData.company)}&docstatus=0`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch drafts');
      const data = await res.json();
      setDrafts(data.message || data.data || []);
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
      const mapped = {
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
          custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || it.supplier_sl_no || '',
          custom_supplier_sl_num: it.custom_supplier_sl_num || it.custom_ref_sl_no || it.supplier_sl_no || '',
          supplier_part_no: it.supplier_part_no || it.custom_supplier_sl_num || '',
          custom_box_qty: parseFloat(parseFloat(it.custom_box_qty || 0).toFixed(2)),
          custom_pieces_per_box: parseFloat(parseFloat(it.custom_pieces_per_box || 1).toFixed(2)),
          default_pieces_per_box: parseFloat(parseFloat(it.custom_pieces_per_box || 1).toFixed(2)),
          custom_box_price: parseFloat(parseFloat(it.custom_box_price || 0).toFixed(2)),
          custom_selling_price: parseFloat(parseFloat(it.custom_selling_price || 0).toFixed(2)),
          qty: parseFloat(parseFloat(it.qty || 0).toFixed(2)),
          rate: parseFloat(parseFloat(it.rate || 0).toFixed(2)),
          amount: parseFloat(parseFloat(it.amount || 0).toFixed(2)),
          purchase_order: it.purchase_order || '',
          purchase_order_item: it.purchase_order_item || '',
          use_box_entry: (it.uom || '').toLowerCase() === 'box',
        })),
        total_qty: parseFloat(parseFloat(draft.total_qty || 0).toFixed(2)),
        total: parseFloat(parseFloat(draft.total || 0).toFixed(2)),
        taxes_and_charges: draft.taxes_and_charges,
        taxes: draft.taxes || [],
        tax_total: parseFloat(parseFloat(draft.total_taxes_and_charges || 0).toFixed(2)),
        grand_total: parseFloat(parseFloat(draft.grand_total || 0).toFixed(2)),
        docstatus: parseInt(draft.docstatus) || 0,
        per_billed: parseFloat(parseFloat(draft.per_billed || 0).toFixed(2)),
        per_received: parseFloat(parseFloat(draft.per_received || 0).toFixed(2)),
        status: draft.status || '',
        quick_entry: false,
        naming_series: draft.naming_series || 'PO-'
      };

      setFormData(mapped);
      setIsEditMode(true);
      setLastSavedData(JSON.stringify(mapped)); // Use mapped object for stable comparison

      // STRICT RULE: If submitted/cancelled, must be ViewOnly. If draft, default to view mode.
      setIsViewOnly(true);
      setShowDraftsList(false);
      // Removed setSuccess(`Record loaded: ${draftName}`); to avoid duplicate title
      fetchLinkedDocs(draftName);
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
      const warehouseParam = !isAdmin && warehouse ? `&warehouse=${encodeURIComponent(warehouse)}` : '';
      const res = await fetch(`${OLD_API}.get_warehouses?is_group=0${warehouseParam}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const whList = data.message || [];
      setWarehouses(whList);

      // Auto-set default warehouse based on logged-in user
      if (whList.length > 0 && !formData.set_warehouse) {
        const userWarehouse = localStorage.getItem('warehouse');
        const defaultWh = (userWarehouse && whList.some(w => w.name === userWarehouse))
          ? userWarehouse
          : whList[0].name;
        setFormData(prev => ({ ...prev, set_warehouse: defaultWh }));
      }
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const fetchTaxTemplates = async () => {
    try {
      // Fetch templates from the same legacy endpoint used in other purchase modules
      const LEGACY_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
      const res = await axios.get(`${LEGACY_API}.get_purchase_taxes_templates`, {
        params: { company: formData.company },
        withCredentials: true
      });
      const templates = res.data?.message || [];
      setTaxTemplates(templates);

      // Auto-set default 5% tax for NEW documents if nothing selected
      if (!formData.name && !formData.taxes_and_charges && templates.length > 0) {
        const defaultTaxName = getDefaultTaxTemplate(templates, warehouse || localStorage.getItem('warehouse') || '');
        if (defaultTaxName) {
          onTaxChange(defaultTaxName);
        }
      }
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

  /* ==================== ADVANCED WORKFLOW HANDLERS ==================== */
  const handleCancelEntry = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to CANCEL this Purchase Order? Status will change to Cancelled.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, Cancel it!'
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await axios.post(`${API_PATH}.cancel_retail_doc`, null, {
        params: { doctype: 'Purchase Order', name: formData.name },
        withCredentials: true
      });
      Swal.fire('Cancelled', 'Document status updated to Cancelled', 'success');
      loadDraft(formData.name);
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.message || 'Cancel failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAmendEntry = async () => {
    const result = await Swal.fire({
      title: 'Amend Document?',
      text: "This will create a new Draft based on this cancelled PO.",
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      confirmButtonText: 'Yes, Amend'
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API_PATH}.amend_retail_doc`, null, {
        params: { doctype: 'Purchase Order', name: formData.name },
        withCredentials: true
      });
      // Extract name robustly
      const newDraftName = res.data?.message?.data?.name || res.data?.data?.name || res.data?.message?.name || res.data?.new_name;

      if (!newDraftName) throw new Error("Could not extract new document name. Server response: " + JSON.stringify(res.data));

      Swal.fire('Amended!', `New draft created: ${newDraftName}`, 'success');
      loadDraft(newDraftName);
      setIsViewOnly(false);
      setIsUpdateMode(false);
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.message || 'Amend failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItems = async () => {
    const result = await Swal.fire({
      title: 'Save Changes?',
      text: "Update Quantities and Rates for this Submitted PO?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Update'
    });

    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      const itemData = formData.items.map(it => ({
        name: it.name,
        qty: parseFloat(it.qty) || 0,
        rate: parseFloat(it.rate) || 0
      }));
      await axios.post(`${API_PATH}.update_purchase_order_items`, {
        name: formData.name,
        item_data: itemData
      }, { withCredentials: true });
      Swal.fire('Updated!', 'Quantities and Rates updated successfully', 'success');
      setIsUpdateMode(false);
      setIsViewOnly(true);
      loadDraft(formData.name);
    } catch (err) {
      Swal.fire('Failed', err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Fetch UOM list for an item from ERPNext metadata
  const fetchItemUOMs = async (item_code) => {
    try {
      const res = await fetch(`/api/resource/Item/${encodeURIComponent(item_code)}?fields=["uoms","stock_uom"]`, {
        headers: { 'X-Frappe-SID': getSession() },
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

      // Mandatory high-density options
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

  // Called when user changes UOM dropdown for a row
  const handleUOMChange = (uomValue, rowIndex) => {
    setFormData(prev => {
      const items = [...prev.items];
      const item = { ...items[rowIndex] };
      const isBox = uomValue.toLowerCase() === 'box';
      item.uom = uomValue;
      item.use_box_entry = isBox;

      if (isBox) {
        // Box mode: qty = box_qty × pcs_per_box
        const pPerBox = parseFloat(item.default_pieces_per_box || item.custom_pieces_per_box) || 1;
        item.custom_pieces_per_box = pPerBox;
        item.qty = parseFloat(((item.custom_box_qty || 1) * pPerBox).toFixed(2));
        item.custom_box_price = parseFloat(((item.rate || 0) * pPerBox).toFixed(2));
      } else {
        // Nos mode: box_qty IS the qty, pcs_per_box not relevant
        item.custom_pieces_per_box = 1;
        item.qty = parseFloat(item.custom_box_qty) || 0;
        item.custom_box_price = item.rate || 0;
      }
      item.amount = (item.qty || 0) * (item.rate || 0);
      items[rowIndex] = item;
      const totals = calculateTotals(items, prev.taxes);
      return { ...prev, items, ...totals };
    });
  };

  const handleInputChange = (e, rowIndex = null) => {
    const { name, value } = e.target;

    // We strictly use the raw string 'value' for the field being typed to avoid stripping dots
    setFormData(prev => {
      const newState = { ...prev };
      const items = [...prev.items];

      if (rowIndex !== null) {
        const item = { ...items[rowIndex] };
        item[name] = value; // PRESERVE TYPING

        // Calculate numeric equivalent for dependencies
        const val = (value === '' || value === '.') ? 0 : parseFloat(value);
        const isBoxMode = item.use_box_entry;

        if (name === 'qty' || name === 'rate') {
          // Update amount using raw values converted to numbers
          const q = name === 'qty' ? val : (parseFloat(item.qty) || 0);
          const r = name === 'rate' ? val : (parseFloat(item.rate) || 0);
          item.amount = parseFloat((q * r).toFixed(2));

          // Sync box fields based on which one changed
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
          item.received_qty = item.qty;
        } else if (name === 'custom_pieces_per_box') {
          const pPerBox = Math.max(1, isNaN(val) ? 1 : val);
          item.qty = parseFloat(((parseFloat(item.custom_box_qty) || 0) * pPerBox).toFixed(2));
          item.custom_box_price = parseFloat(((parseFloat(item.rate) || 0) * pPerBox).toFixed(2));
          item.amount = parseFloat(((item.qty || 0) * (parseFloat(item.rate) || 0)).toFixed(2));
          item.received_qty = item.qty;
        } else if (name === 'custom_box_price') {
          item.rate = parseFloat((val / (item.custom_pieces_per_box || 1)).toFixed(2));
          item.amount = parseFloat(((parseFloat(item.qty) || 0) * item.rate).toFixed(2));
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
      const fixedAmount = parseFloat(tax.tax_amount) || 0; // The actual amount from template

      if (chargeType === "Actual") {
        taxAmt = fixedAmount; // Use fixed amount for 'Actual'
      } else {
        // Percentage based (On Net Total, etc.)
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
    try {
      const KYLE_API = '/api/method/kyle_retail.retail_api.api';
      const supplier = formData.supplier?.name || formData.supplier || '';
      const res = await fetch(
        `${KYLE_API}.get_purchase_order_history?company=${encodeURIComponent(formData.company)}&supplier=${encodeURIComponent(supplier)}&limit=50`,
        { headers: { 'X-Frappe-SID': getSession() }, credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        const msg = data.message;
        // Handle both: direct array OR { status, data: [] }
        if (Array.isArray(msg)) setHistory(msg);
        else if (msg?.data) setHistory(msg.data);
        else setHistory([]);
      }
    } catch (err) { console.error('fetchHistory err:', err); }
  };

  const fetchLinkedDocs = async (name) => {
    if (!name) return;
    setLoadingLinks(true);
    try {
      const res = await fetch(`${API_PATH}.get_purchase_order_dashboard?purchase_order=${name}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const msg = data.message || {};

        // Use the new connections structure
        if (msg.status === 'success' || msg.connections) {
          const connections = msg.connections || [];
          setLinkedConnections(connections);

          // Flatten for easy access elsewhere
          let flattened = {};
          let allDocs = [];

          connections.forEach(group => {
            group.items.forEach(item => {
              const key = item.label.replace(/ /g, '_');
              flattened[key] = item.names || [];
              if (item.names) {
                item.names.forEach(n => allDocs.push({ name: n, type: item.doctype || item.label }));
              }
            });
          });
          setLinkedDocs(flattened);

          // Fetch statuses for these docs
          const statuses = {};
          await Promise.all(allDocs.map(async ({ name: docName, type }) => {
            try {
              const r = await fetch(`/api/resource/${encodeURIComponent(type)}/${docName}?fields=["docstatus","status"]`, {
                headers: { 'X-Frappe-SID': getSession() }, credentials: 'include'
              });
              if (r.ok) {
                const docData = await r.json();
                statuses[docName] = {
                  docstatus: docData.data?.docstatus ?? 0,
                  status: docData.data?.status || (docData.data?.docstatus === 1 ? 'Submitted' : 'Draft')
                };
              }
            } catch (err) { console.error('fetchDocStatus err:', err); }
          }));
          setLinkedDocStatuses(statuses);
        }
      }
    } catch (err) {
      console.error('fetchLinkedDocs err:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleDocActionExternally = async (docname, doctype, action) => {
    if (!confirm(`${action.toUpperCase()} ${doctype}: ${docname}?`)) return;
    try {
      setSaving(true);
      const res = await axios.post(`${API_PATH}.handle_document_action`, {
        doctype, docname, action
      }, { withCredentials: true });
      if (res.data.message?.status === 'success') {
        Swal.fire('Success', `${doctype} updated`, 'success');
        fetchLinkedDocs(formData.name);
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Auto-load PO from URL query param (e.g. /#/purchaseorder?name=PUR-ORD-2026-00035)
  // Uses window.location.hash directly for reliable HashRouter support
  useEffect(() => {
    const hash = window.location.hash; // e.g. #/purchaseorder?name=PUR-ORD-2026-00035
    const queryStart = hash.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(hash.slice(queryStart));
      const nameFromUrl = params.get('name');
      if (nameFromUrl) {
        loadDraft(nameFromUrl);
        // Clear URL params so refresh goes to list view
        window.history.replaceState(null, '', window.location.pathname + '#' + hash.slice(0, queryStart));
      }
    }
  }, []);

  useEffect(() => {
    if (formData.company) fetchHistory();
  }, [formData.supplier, formData.company]);

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
    if (!formData.supplier?.name && !formData.supplier) {
      setError('Please select a Supplier / Vendor');
      return false;
    }
    if (!formData.set_warehouse) {
      const defaultWh = localStorage.getItem('warehouse') || warehouses[0]?.name || '';
      if (defaultWh) {
        formData.set_warehouse = defaultWh;
      } else {
        setError('Please select a Target Warehouse');
        return false;
      }
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
    if (isSubmitting && !formData.name && !formData.quick_entry) {
      setError('Please Save as Draft before processing the order');
      return false;
    }
    return true;
  };

  const handleDuplicate = () => {
    setFormData(prev => {
      const cleanedItems = (prev.items || []).map(item => {
        const {
          name, parent, parenttype, parentfield, creation, modified, modified_by, owner, docstatus,
          ...rest
        } = item;
        return {
          ...POItemModel,
          ...rest,
          schedule_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 16)
        };
      });
      return {
        ...prev,
        name: '',
        docstatus: 0,
        transaction_date: getLocalISOString(),
        items: cleanedItems
      };
    });
    setIsEditMode(true);
    setIsViewOnly(false);
    setCreatedDocName(null);
    navigate('/purchaseorder');
    Swal.fire({
      icon: 'success',
      title: 'Duplicated!',
      text: 'You are now editing a new Draft copy of this document.',
      timer: 2000
    });
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
          custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || "",
          custom_supplier_sl_num: item.custom_supplier_sl_num || item.custom_ref_sl_no || "",
          supplier_part_no: item.supplier_part_no || item.custom_supplier_sl_num || "",
          warehouse: (formData.set_warehouse && formData.set_warehouse !== "undefined" && formData.set_warehouse !== "null") ? formData.set_warehouse : ""
        })),
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
          ...data.data,
          name: docName,
          supplier_name: data.data.supplier_name || data.data.supplier
        }));
        fetchLinkedDocs(docName);
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
          supplier_sl_no: formData.items[0]?.custom_supplier_sl_num || formData.items[0]?.custom_ref_sl_no || '',
          custom_supplier_sl_num: formData.items[0]?.custom_supplier_sl_num || formData.items[0]?.custom_ref_sl_no || '',
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
            custom_ref_sl_no: item.custom_ref_sl_no || item.custom_supplier_sl_num || '',
            custom_supplier_sl_num: item.custom_supplier_sl_num || item.custom_ref_sl_no || '',
            supplier_part_no: item.supplier_part_no || item.custom_supplier_sl_num || ''
          })),
        };

        const res = await POSService.submitPurchaseEntry(payload);

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
        fetchLinkedDocs(formData.name);
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

    // VALIDATION: Check if already received
    if (type === 'receipt' && formData.per_received >= 100) {
      setError(`Notice: This Purchase Order has been 100% received. No further receipts can be generated.`);
      return;
    }

    // VALIDATION: Check if already billed
    if (type === 'invoice' && formData.per_billed >= 100) {
      setError(`Notice: This Purchase Order has been 100% billed. No further invoices can be generated.`);
      return;
    }

    // VALIDATION: Check status
    if (['Closed', 'Cancelled'].includes(formData.status)) {
      setError(`Workflow Error: Cannot create transitions for a ${formData.status} document.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const OLD_API = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

    const postCreate = async (endpoint) => {
      try {
        const res = await axios.post(`${OLD_API}.${endpoint}`, {
          po_name: formData.name
        }, { withCredentials: true });

        const msg = res.data.message || res.data;
        if (msg.status === 'success' || (msg.success && msg.name)) return msg.name;
        throw new Error(msg.message || msg.exc_type || 'Failed to create document');
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message;
        if (errorMsg.includes("No items to receive")) {
          throw new Error("The stock for this PO has already been received or is currently being processed.");
        }
        throw new Error(errorMsg);
      }
    };

    try {
      if (type === 'both') {
        const prName = await postCreate('create_purchase_receipt_from_po');
        const piName = await postCreate('create_purchase_invoice_from_po');
        setSuccess(`✅ Receipt: ${prName}   |   Invoice: ${piName}`);
        setCreatedDocName('BOTH_CREATED');
      } else {
        const endpoint = type === 'receipt'
          ? 'create_purchase_receipt_from_po'
          : 'create_purchase_invoice_from_po';
        const docName = await postCreate(endpoint);
        setSuccess(`${type === 'receipt' ? '📦 Receipt' : '🧾 Invoice'} ${docName} created successfully (Draft)!`);
        setCreatedDocName(docName);

        // Route immediately to the respective draft details screen in the same view
        if (type === 'receipt') {
          navigate(`/purchasereceiptlist?name=${encodeURIComponent(docName)}`);
        } else {
          navigate(`/purchaseinvoicelist?name=${encodeURIComponent(docName)}`);
        }
        Swal.fire({
          title: 'Success',
          text: `${type === 'receipt' ? 'Receipt' : 'Invoice'} ${docName} created successfully.`,
          icon: 'success'
        });
      }
      fetchLinkedDocs(formData.name);
    } catch (err) {
      setError(`Create failed: ${err.message}`);
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
      const res = await fetch(`${API_PATH}.get_suppliers_po?search=${encodeURIComponent(query || '')}&warehouse=${warehouse || ''}`, {
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

  const handleGlobalSupplierSearch = async (term) => {
    const res = await axios.get(`${API_PATH}.find_supplier_globally_retail`, { params: { search_term: term } });
    return res.data.message.data;
  };

  const handleActivateSupplier = async (item) => {
    const res = await axios.post(`${API_PATH}.enable_supplier_for_branch_retail`, {
      supplier: item.name,
      warehouse: warehouse
    });
    return res.data.message.success;
  };

  const handleGlobalItemSearch = async (term) => {
    const res = await axios.get(`${API_PATH}.find_item_globally_retail`, { params: { search_term: term } });
    return res.data.message.data;
  };

  const handleActivateItem = async (item) => {
    const res = await axios.post(`${API_PATH}.enable_item_for_branch_retail`, {
      item_code: item.name || item.item_code,
      warehouse: warehouse
    });
    return res.data.message.success;
  };

  const handleItemSelect = (item, rowIndex) => {
    setFormData(prev => {
      const items = [...prev.items];
      const existingIdx = items.findIndex((i, idx) => i.item_code === item.item_code && idx !== rowIndex);
      const rate = parseFloat(item.last_buying_rate || item.rate || 0);

      if (existingIdx !== -1) {
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
        existingItem.amount = existingItem.qty * (parseFloat(existingItem.rate) || 0);
        items[existingIdx] = existingItem;

        if (items.length > 1) {
          items.splice(rowIndex, 1);
        } else {
          items[rowIndex] = { ...POItemModel, schedule_date: prev.transaction_date };
        }
      } else {
        const pPerBox = parseFloat(item.custom_pieces_per_box || 1);
        const uomList = item.uom_list || [];
        items[rowIndex] = {
          ...items[rowIndex],
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom || '',
          uom: item.stock_uom || '',
          uom_list: uomList,
          use_box_entry: false, // default Nos mode
          rate: rate,
          last_buying_rate: rate,
          custom_pieces_per_box: 1,
          default_pieces_per_box: pPerBox,
          qty: 1,
          amount: rate,
          custom_box_price: rate,
          custom_box_qty: 1,
          temp_barcode: '',
          schedule_date: items[rowIndex].schedule_date || prev.transaction_date,
          custom_supplier_sl_num: item.custom_supplier_sl_num || item.supplier_part_no || '',
          supplier_part_no: item.supplier_part_no || item.custom_supplier_sl_num || '',
          custom_selling_price: parseFloat(item.selling_price || 0)
        };

        // Async fetch UOMs and update row
        fetchItemUOMs(item.item_code).then(uomList => {
          setFormData(p => {
            const its = [...p.items];
            const ri = its.findIndex(i => i.item_code === item.item_code);
            if (ri !== -1) its[ri] = { ...its[ri], uom_list: uomList };
            return { ...p, items: its };
          });
        });
      }

      if (items.every(i => i.item_code)) {
        items.push({ ...POItemModel, schedule_date: prev.transaction_date });
      }

      const totals = calculateTotals(items, prev.taxes);
      return { ...prev, items, ...totals };
    });

    // Auto-focus the custom_ref_sl_no field of the selected item row
    setTimeout(() => {
      const rowNum = rowIndex + 1;
      const targetInput = document.querySelector(`tr:nth-child(${rowNum}) input[name="custom_ref_sl_no"]`) ||
                          document.querySelector(`tr:nth-child(${rowNum}) input[name="custom_box_qty"], tr:nth-child(${rowNum}) input[name="qty"]`);
      if (targetInput) {
        targetInput.focus();
        targetInput.select?.();
      }
    }, 150);
  };

  const fetchItems = async (query) => {
    try {
      if (!query) {
        // Optional: Return a default set or empty if needed
        // For now, allow default fetching
      }
      const wh = formData.set_warehouse || (!isAdmin ? warehouse : '');
      const warehouseParam = wh ? `&warehouse=${encodeURIComponent(wh)}` : '';
      const res = await fetch(`${API_PATH}.get_items_for_po?query=${encodeURIComponent(query)}&search=${encodeURIComponent(query)}${warehouseParam}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      const results = (data.message || []).map(it => ({
        ...it,
        rate: parseFloat(it.last_buying_rate || it.rate || 0)
      }));

      // Client-side filtering as a fallback if backend returns everything
      const filtered = results.filter(it =>
        (it.item_name || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.item_code || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.supplier_part_no || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.custom_supplier_sl_num || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.barcode || '').toLowerCase().includes(query.toLowerCase())
      );

      // Only show filtered results if there is a query, otherwise show what the server returned
      const finalResults = query ? filtered : results;
      return finalResults;
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
      <div className={`font-sans purchase-container ${theme === 'legacy' ? 'theme-legacy' : ''}`} style={{ height: '100vh', overflowY: 'auto' }}>
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
        <div className="bg-white px-6 py-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex flex-col text-left">
              <h1 className="text-[18px] font-bold text-[#0f172a] leading-tight tracking-tight">
                {formData.docstatus === 1 ? `Purchase Order: ${formData.name}` : (formData.name ? (isViewOnly ? `View PO: ${formData.name}` : `Edit PO: ${formData.name}`) : 'New Purchase Order')}
              </h1>
              <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                {formData.docstatus === 1 ? 'Submitted Document' : 'Procurement & Inventory'}
              </p>
            </div>


          </div>

          <div className="flex items-center gap-3">
            {/* Always show DELETE for drafts */}
            {formData.name && formData.docstatus === 0 && allowedActions.includes('delete') && (
              <button
                onClick={() => handleDocAction('delete')}
                className="so-btn-ghost hover:bg-red-50"
                style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', transition: 'all 0.2s' }}
              >
                <Trash2 size={14} className="inline mr-1" /> DELETE
              </button>
            )}

            {/* Always show DUPLICATE if name exists */}
            {formData.name && (
              <button
                onClick={handleDuplicate}
                className="so-btn-secondary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
              >
                <Copy size={14} /> DUPLICATE
              </button>
            )}

            {/* NEW: CREATE & CONNECTIONS DROPDOWN BUTTON */}
            {formData.name && (
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
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Create & Connections</span>
                    </div>

                    {/* Primary Workflow Actions */}
                    {formData.docstatus === 1 && (formData.per_received < 100 || formData.per_billed < 100) && (
                      <div className="flex flex-col gap-2 mb-4">
                        {formData.per_received < 100 && (
                          <button
                            onClick={() => {
                              setShowCreateDropdown(false);
                              handleCreateFlow('receipt');
                            }}
                            disabled={loadingLinks}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            Create Receipt
                          </button>
                        )}
                        {formData.per_billed < 100 && (
                          <button
                            onClick={() => {
                              setShowCreateDropdown(false);
                              handleCreateFlow('invoice');
                            }}
                            disabled={loadingLinks}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            Create Invoice
                          </button>
                        )}
                      </div>
                    )}

                    {/* Connected Docs */}
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {linkedConnections.length > 0 ? (
                        linkedConnections.filter(g => g.items.some(i => i.count > 0)).map((group) => (
                          <div key={group.group} className="flex flex-col gap-1.5 text-left">
                            <span className="text-[9px] font-black text-slate-450 uppercase tracking-tight text-slate-450">{group.group}</span>
                            <div className="flex flex-col gap-2">
                              {group.items.filter(item => item.count > 0).map((item) => (
                                <div key={item.label} className="bg-slate-50/50 rounded-lg p-2 border border-slate-100/50">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Link size={10} className="text-slate-450" />
                                      <span className="text-[9px] font-black text-slate-550 uppercase tracking-wider text-slate-600">{item.label}</span>
                                    </div>
                                    <span className="text-[8px] px-1.5 py-0.5 bg-white border border-slate-100 text-slate-400 rounded font-bold">{item.count}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {(item.names || []).map(id => {
                                      const s = linkedDocStatuses[id];
                                      const isSub = s?.docstatus === 1;
                                      return (
                                        <button
                                          key={id}
                                          onClick={() => {
                                            setShowCreateDropdown(false);
                                            navigateToDoc(item.label, id);
                                          }}
                                          className="group/id flex items-center gap-1 p-0.5 px-1.5 bg-white border border-slate-100 rounded transition-all hover:border-indigo-200 hover:shadow-sm"
                                          title={`View ${item.label}: ${id}`}
                                        >
                                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSub ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 'bg-orange-400 animate-pulse'}`} />
                                          <span className="text-[9px] font-bold text-slate-700 tabular-nums truncate">{id}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-2 text-center">
                          <p className="text-[9px] font-bold text-slate-450 italic text-slate-400">No connections yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Always show EDIT DRAFT as secondary action on the left of primary when in view mode */}
            {formData.name && formData.docstatus === 0 && isViewOnly && (
              <button
                onClick={() => setIsViewOnly(false)}
                className="so-btn-secondary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}
              >
                <Edit3 size={14} /> EDIT DRAFT
              </button>
            )}

            {/* THE SINGLE DYNAMIC PRIMARY ACTION BUTTON (always rightmost) */}
            {!formData.name ? (
              // 1. New Document state -> SAVE DRAFT
              <button
                onClick={() => handleDocAction('save')}
                disabled={saving}
                className="so-btn-primary"
                style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'SAVE DRAFT'}
              </button>
            ) : (
              formData.docstatus === 0 ? (
                // 2. Draft phase
                !isViewOnly ? (
                  // Edit mode -> UPDATE DRAFT
                  <button
                    onClick={() => handleDocAction('save')}
                    disabled={saving}
                    className="so-btn-primary"
                    style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : 'UPDATE DRAFT'}
                  </button>
                ) : (
                  // View mode (not dirty) -> SUBMIT
                  allowedActions.includes('submit') && (
                    <button
                      onClick={() => handleDocAction('submit')}
                      disabled={saving}
                      className="so-btn-primary"
                      style={{ padding: '0.5rem 1.5rem', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'all 0.2s' }}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : 'SUBMIT'}
                    </button>
                  )
                )
              ) : formData.docstatus === 1 ? (
                // 3. Submitted phase -> CANCEL
                <div className="flex items-center gap-3">
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
                      {saving ? <Loader2 size={14} className="animate-spin" /> : 'CANCEL'}
                    </button>
                  )}
                </div>
              ) : formData.docstatus === 2 ? (
                // 4. Cancelled phase -> AMEND
                <div className="flex items-center gap-3">
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
                      {saving ? <Loader2 size={14} className="animate-spin" /> : 'AMEND'}
                    </button>
                  )}
                </div>
              ) : null
            )}
          </div>
        </div>


        <div className="po-layout-container !pt-4 pb-20">
          <div className="w-full flex flex-col gap-6 relative">
            {/* MAIN CONTENT AREA */}
            <div className="w-full flex flex-col gap-6">
              {error && (
                <div className="mb-6 bg-red-50 border border-red-100 rounded-lg p-4 flex items-center gap-3 animate-fadeIn">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-semibold text-red-800">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-8 border-l-4 border-[var(--po-primary)] bg-white shadow-sm p-6 animate-fadeIn">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <CheckCircle2 className="w-6 h-6 text-[var(--po-primary)]" />
                        <div>
                          <h4 className="text-base font-bold text-slate-900 leading-tight">{success}</h4>
                          <p className="text-xs text-slate-500 font-medium mt-1">Transaction processed successfully</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className={`po-card ${isViewOnly ? 'lg:col-span-12' : 'lg:col-span-6'} animate-fadeIn`}>
                    <div className="po-card-header !bg-slate-50/50">
                      <h3 className="po-card-title flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--po-primary)]" />
                        Supplier Information
                      </h3>
                    </div>
                    <div className={`po-card-body grid grid-cols-1 ${isViewOnly ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-6`}>
                      <div>
                        <label className="po-label">Series</label>
                        {isViewOnly || formData.docstatus !== 0 ? (
                          <div className="po-input border border-slate-200 rounded-lg bg-slate-50/30 px-3 flex items-center h-[42px] font-black text-slate-800 text-base">
                            {formData.naming_series || 'PUR-ORD-.YYYY.-'}
                          </div>
                        ) : (
                          <select
                            name="naming_series"
                            value={formData.naming_series}
                            onChange={handleInputChange}
                            onKeyDown={handleNextFocus}
                            disabled={isViewOnly || formData.docstatus !== 0}
                            className="po-input font-bold text-[var(--po-primary)] disabled:bg-slate-50 disabled:cursor-not-allowed border border-slate-200 shadow-none text-base"
                          >
                            <option value="PUR-ORD-.YYYY.-">PUR-ORD-.YYYY.-</option>
                          </select>
                        )}
                      </div>
                      <div className={isViewOnly ? 'col-span-2' : ''}>
                        <label className="po-label">Supplier / Vendor</label>
                        <div onKeyDown={handleNextFocus}>
                          {isViewOnly || formData.docstatus !== 0 ? (
                            <div className="po-input border border-slate-200 rounded-lg bg-slate-50/30 px-3 flex items-center text-slate-800 font-black h-[42px] text-base">
                              {formData.supplier?.supplier_name || formData.supplier || 'No Supplier'}
                            </div>
                          ) : (
                            <CustomSearchDropdown
                              placeholder="Search supplier..."
                              value={formData.supplier}
                              onSelect={handleSupplierSelect}
                              fetchData={fetchSuppliers}
                              createOption={handleSupplierCreate}
                              optionsLabel="supplier_name"
                              globalSearch={true}
                              onGlobalSearch={handleGlobalSupplierSearch}
                              onActivate={handleActivateSupplier}
                            />
                          )}
                        </div>
                      </div>
                      {isViewOnly && (
                        <div>
                          <label className="po-label text-[var(--po-primary)]">Current Status</label>
                          <div className="flex items-center h-[42px]">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${formData.docstatus === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                              {formData.docstatus === 1 ? 'Submitted' : 'Draft Document'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`po-card ${isViewOnly ? 'lg:col-span-12' : 'lg:col-span-6'} animate-fadeIn`}>
                    <div className="po-card-header !bg-slate-50/50">
                      <h3 className="po-card-title flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--po-primary)]" />
                        Purchase Details & Attachments
                      </h3>
                    </div>
                    <div className={`po-card-body grid grid-cols-1 ${isViewOnly ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                      <div>
                        <label className="po-label">Transaction Date</label>
                        <div className={`po-input border border-slate-200 rounded-lg bg-slate-50/30 px-3 flex items-center text-slate-800 h-[42px] ${isViewOnly ? 'font-black text-base' : 'text-slate-500 font-semibold'}`}>
                          <span>
                            {new Date(formData.transaction_date).toLocaleString('en-GB', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            }).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {isViewOnly && (
                        <div>
                          <label className="po-label">Currency</label>
                          <div className="po-input border border-slate-200 rounded-lg bg-slate-50/30 px-3 flex items-center text-base font-black text-[var(--po-primary)] h-[42px] gap-1.5">
                            {(formData.currency || 'AED') === 'AED' ? (
                              <>
                                <DirhamIcon size={16} />
                                <span>AED</span>
                              </>
                            ) : (
                              formData.currency || 'AED'
                            )}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="po-label">Target Warehouse (Branch) {!isViewOnly && <span className="text-red-500">*</span>}</label>
                        {isAdmin ? (
                          <select
                            name="set_warehouse"
                            value={formData.set_warehouse || ''}
                            onChange={handleInputChange}
                            disabled={isViewOnly || formData.docstatus !== 0}
                            className="po-input font-bold text-slate-800 disabled:bg-slate-50 disabled:cursor-not-allowed border border-slate-200 shadow-none text-base"
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
                            className="po-input border border-slate-200 rounded-lg bg-slate-50/30 px-3 flex items-center font-black text-slate-700 h-[42px] text-base"
                          />
                        )}
                      </div>
                      <div className="col-span-1 flex flex-col justify-end">
                        <label className="po-label opacity-0 select-none pointer-events-none">Attachment</label>
                        <AttachmentSection doctype="Purchase Order" docname={formData.name} compact={true} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="po-card">
                  <div className="po-card-header flex items-center justify-between">
                    <h3 className="po-card-title">Product Inventory Basket</h3>
                    <button
                      type="button"
                      onClick={() => setShowColConfig(true)}
                      title="Configure Columns"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all text-[11px] font-bold"
                    >
                      <Settings size={15} />
                      <span>Columns</span>
                    </button>
                  </div>

                  {!isViewOnly && formData.docstatus === 0 && (
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-4 bg-white animate-fadeIn">
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
                  )}

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
                            <div id="po-scanner-reader" className="w-full h-full" style={{ background: '#000' }}></div>
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
                          {(() => {
                            const hasAnyBox = formData.items.some(i => i.use_box_entry);
                            const activeCols = poColumns.filter(c => {
                              if (!c.visible) return false;
                              if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                              return true;
                            });

                            return activeCols.map(col => {
                              let finalLabel = col.label;
                              if (col.id === 'custom_box_qty') finalLabel = 'QTY';

                              if (!hasAnyBox) {
                                if (col.id === 'custom_box_price') finalLabel = 'Price';
                                if (col.id === 'custom_pieces_per_box') finalLabel = '';
                              }

                              let alignClass = "text-center";
                              if (col.align === 'left') alignClass = "text-left pl-3";
                              else if (col.align === 'right') alignClass = "text-right pr-3";
                              else if (col.align === 'center') alignClass = "text-center";
                              else {
                                if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) alignClass = "text-left pl-3";
                                else if (['custom_box_price', 'custom_selling_price', 'rate', 'amount'].includes(col.id)) alignClass = "text-right pr-3";
                              }

                              return (
                                <th
                                  key={col.id}
                                  className={`purchase-th ${alignClass}`}
                                  style={{ width: col.width, minWidth: col.id === 'item_code' ? 120 : undefined }}
                                >
                                  {finalLabel}
                                </th>
                              );
                            });
                          })()}
                          <th className="purchase-th w-[50px] text-center">
                            <button type="button" onClick={() => setShowColConfig(true)} className="text-slate-400 hover:text-[var(--po-primary)] transition-colors p-1" title="Configure Columns">
                              <Settings className="w-4 h-4" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx} tabIndex={-1} data-row-index={idx} className="group hover:bg-slate-50 transition-colors">
                            {(() => {
                              const hasAnyBox = formData.items.some(i => i.use_box_entry);
                              const activeCols = poColumns.filter(c => {
                                if (!c.visible) return false;
                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                return true;
                              });

                              return activeCols.map(col => {
                                switch (col.id) {
                                  case 'scanner':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <input
                                              type="text"
                                              value={item.temp_barcode ?? ''}
                                              placeholder={isViewOnly ? '' : 'Barcode'}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleBarcodeScan(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.target.value) handleBarcodeEnter(e, idx);
                                                else handleNextFocus(e);
                                              }}
                                              className={`font-bold \${alignClass}`}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'item_code':
                                    return (
                                      <td key={col.id} className="purchase-td" style={{ verticalAlign: 'middle' }}>
                                        <div className="premium-cell-container" style={{ minHeight: '36px', justifyContent: 'center' }}>
                                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                            {!(isViewOnly || formData.docstatus !== 0) ? (
                                              <div>
                                                <CustomSearchDropdown
                                                  value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                  placeholder="Search item..."
                                                  onSelect={(val) => handleItemSelect(val, idx)}
                                                  themeColor="var(--po-primary)"
                                                  optionsLabel="name"
                                                  fetchData={fetchItems}
                                                  globalSearch={true}
                                                  onGlobalSearch={handleGlobalItemSearch}
                                                  onActivate={handleActivateItem}
                                                />
                                                {Boolean(item.item_code && (item.last_purchase_rate || item.last_buying_rate || item.last_buying_price || item.rate)) && (
                                                  <div className="flex items-center gap-1 mt-1 px-1">
                                                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shadow-xs">
                                                      Last Pur: AED {formatPrice(item.last_purchase_rate || item.last_buying_rate || item.last_buying_price || item.rate)}
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
                                                  borderLeft: '4px solid var(--po-primary)',
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
                                  case 'custom_box_qty':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full">
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                              value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleInputChange(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={handleNextFocus}
                                              className={`text-center font-bold outline-none w-full h-[28px] border-none ${item.use_box_entry ? 'text-sky-600' : 'text-slate-800'}`}
                                              style={{ padding: '0 4px', fontSize: '0.75rem' }}
                                              title={item.use_box_entry ? "Number of Boxes" : "Quantity"}
                                            />
                                            {item.item_code && (
                                              <div className="flex justify-center w-full mt-0.5">
                                                <span
                                                  className="text-[8px] font-extrabold select-none pointer-events-none px-1.5 py-0.2 rounded border uppercase tracking-wider"
                                                  style={{
                                                    color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                    backgroundColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                    borderColor: item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0',
                                                    lineHeight: 1.2
                                                  }}
                                                >
                                                  {item.use_box_entry ? 'BOXES' : 'NOS'}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_pieces_per_box':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {item.use_box_entry ? (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_pieces_per_box"
                                                value={item.custom_pieces_per_box || ''}
                                                readOnly={isViewOnly || formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className={`\${alignClass}`}
                                                title="Pieces per Box"
                                              />
                                            ) : (
                                              <div className="premium-cell-readonly premium-cell-readonly-left pl-3">—</div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_box_price':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {item.use_box_entry ? (
                                              isViewOnly ? (
                                                <div className="premium-cell-readonly premium-cell-readonly-right">{formatPrice(item.custom_box_price)}</div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  inputMode="decimal"
                                                  name="custom_box_price"
                                                  value={item.custom_box_price || ''}
                                                  readOnly={formData.docstatus !== 0}
                                                  onChange={(e) => handleInputChange(e, idx)}
                                                  onFocus={(e) => e.target.select()}
                                                  onClick={(e) => e.target.select()}
                                                  onKeyDown={handleNextFocus}
                                                  className={`font-bold \${alignClass}`}
                                                />
                                              )
                                            ) : (
                                              <div className="premium-cell-readonly premium-cell-readonly-center">—</div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_selling_price':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewOnly ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right !text-[var(--po-primary)]">{formatPrice(item.custom_selling_price)}</div>
                                            ) : (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="custom_selling_price"
                                                value={item.custom_selling_price || ''}
                                                readOnly={formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className={`font-bold \${alignClass} !text-[var(--po-primary)]`}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'custom_ref_sl_no':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <input
                                              type="text"
                                              name="custom_ref_sl_no"
                                              value={item.custom_ref_sl_no || item.custom_supplier_sl_num || ''}
                                              readOnly={isViewOnly || formData.docstatus !== 0}
                                              onChange={(e) => handleInputChange(e, idx)}
                                              onFocus={(e) => e.target.select()}
                                              onClick={(e) => e.target.select()}
                                              onKeyDown={handleNextFocus}
                                              placeholder={isViewOnly ? '' : 'Serial...'}
                                              className="text-center text-[10px] font-bold"
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'qty':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box flex flex-col justify-center items-center py-1 w-full relative">
                                            <div className="premium-cell-readonly premium-cell-readonly-center font-bold text-center pb-0.5 w-full">{item.qty || 0}</div>
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
                                  case 'uom':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {!item.item_code || isViewOnly || formData.docstatus !== 0 ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-center text-[10px] font-bold uppercase text-slate-700">
                                                {item.use_box_entry ? 'BOX' : (item.uom || item.stock_uom || 'NOS')}
                                              </div>
                                            ) : (
                                              <select
                                                value={item.uom || item.stock_uom || ''}
                                                onChange={(e) => handleUOMChange(e.target.value, idx)}
                                                className="text-center text-[10px] font-bold text-slate-600 bg-white"
                                                title="Select Unit of Measure"
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
                                  case 'rate':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            {isViewOnly && !isUpdateMode ? (
                                              <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold">{formatPrice(item.rate)}</div>
                                            ) : (
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                name="rate"
                                                value={item.rate || ''}
                                                readOnly={!isUpdateMode && formData.docstatus !== 0}
                                                onChange={(e) => handleInputChange(e, idx)}
                                                onFocus={(e) => e.target.select()}
                                                onClick={(e) => e.target.select()}
                                                onKeyDown={handleNextFocus}
                                                className={`text-right pr-3 font-bold outline-none ${isUpdateMode ? 'bg-amber-50 ring-1 ring-amber-200 rounded px-1' : ''}`}
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    );
                                  case 'amount':
                                    return (
                                      <td key={col.id} className="purchase-td">
                                        <div className="premium-cell-container">
                                          <div className="premium-cell-box">
                                            <div className="premium-cell-readonly premium-cell-readonly-right pr-3 font-bold text-slate-900 tabular-nums">{formatPrice(item.amount)}</div>
                                          </div>
                                        </div>
                                      </td>
                                    );
                                }
                              });
                            })()}
                            <td className="purchase-td text-center">
                              {(!isViewOnly && formData.docstatus === 0) && (
                                <button type="button" onClick={() => removeItemRow(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all mx-auto"><Trash2 className="w-4 h-4" /></button>
                              )}
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
                      <select value={formData.taxes_and_charges || ''} onChange={(e) => onTaxChange(e.target.value)} onKeyDown={handleNextFocus} disabled={isViewOnly || formData.docstatus !== 0} className="summary-select focus:border-[#10b981] disabled:bg-slate-50 disabled:text-slate-500">
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
                        <p className="detail-value text-[var(--po-primary)] font-black">{formatPrice(formData.tax_total)}</p>
                      </div>
                      <div className="text-center">
                        <span className="summary-label">Gross Total</span>
                        <p className="detail-value text-[var(--po-primary)] font-black">{formatPrice(formData.total)}</p>
                      </div>
                    </div>

                    <div className="summary-section grand-total-section border-l border-slate-200 pl-12">
                      <div className="text-right">
                        <span className="summary-label block">Grand Total</span>
                        <p className="grand-total-value flex items-center justify-end gap-1.5"><DirhamIcon size={20} className="text-slate-700" /> {formatPrice(formData.grand_total)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column Config Modal */}
      <ColumnConfigModal
        isOpen={showColConfig}
        onClose={() => setShowColConfig(false)}
        config={poColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Purchase Order"
        themeColor="var(--po-primary)"
      />

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
                        <span className="text-sm font-black text-slate-800 flex items-center gap-1"><DirhamIcon size={12} /> {d.grand_total?.toLocaleString()}</span>
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
