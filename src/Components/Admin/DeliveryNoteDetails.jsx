import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Package, Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette,
    Save, CheckCircle2, Trash2, Edit3, AlertCircle, Printer, Send,
    Settings, Link as LinkIcon, Info, CreditCard, Percent, ArrowRight,
    Camera, ScanLine, Zap
} from 'lucide-react';
import { frappeCall } from '../../utils/frappe';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import AttachmentSection from './AttachmentSection';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import QuickItemCreateModal from '../Purchase/QuickItemCreateModal';


const DEFAULT_DN_COLUMNS = [
    { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
    { id: 'item_name', label: 'Item Name', visible: true, width: 180 },
    { id: 'custom_box_qty', label: 'QTY', visible: true, width: 90 },
    { id: 'uom', label: 'UOM', visible: true, width: 90 },
    { id: 'custom_pieces_per_box', label: 'Pcs/Box', visible: true, width: 90 },
    { id: 'custom_box_price', label: 'Box Price', visible: true, width: 90 },
    { id: 'rate', label: 'Rate (Nos)', visible: true, width: 90 },
    { id: 'is_tax_inclusive', label: 'Tax Inc/Exc', visible: true, width: 95 },
    { id: 'qty', label: 'Total Qty', visible: true, width: 90 },
    { id: 'amount', label: 'Subtotal', visible: true, width: 90 }
];

const DNItemModel = {
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
    custom_selling_price: 0,
    is_tax_inclusive: true
};

const loadColumnConfig = () => {
    try {
        const saved = localStorage.getItem('delivery_matrix_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            const defaultIds = DEFAULT_DN_COLUMNS.map(c => c.id);
            const savedIds = parsed.map(c => c.id);
            const existing = parsed.filter(c => defaultIds.includes(c.id));
            const missing = DEFAULT_DN_COLUMNS.filter(c => !savedIds.includes(c.id));
            return [...existing, ...missing];
        }
    } catch (e) {
        console.error("DN Matrix Config Error:", e);
    }
    return DEFAULT_DN_COLUMNS;
};

function recalcForm(form) {
    const items = form.items || [];
    const taxes = form.taxes || [];

    const total_qty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
    const totalTaxRate = taxes.reduce((s, t) => s + (parseFloat(t.rate) || 0), 0);

    let total_taxes = 0;
    let net_base_total = 0;
    let gross_base_total = 0;

    items.forEach(item => {
        const itemAmt = parseFloat(item.amount) || 0;
        if (itemAmt <= 0) return;

        const isInc = item.is_tax_inclusive !== false;
        gross_base_total += itemAmt;

        if (isInc && totalTaxRate > 0) {
            const itemNet = itemAmt / (1 + totalTaxRate / 100);
            net_base_total += itemNet;
            total_taxes += (itemAmt - itemNet);
        } else {
            net_base_total += itemAmt;
            if (totalTaxRate > 0) {
                total_taxes += itemAmt * (totalTaxRate / 100);
            }
        }
    });

    const updatedTaxes = taxes.map(tax => {
        const rate = parseFloat(tax.rate) || 0;
        let taxAmount = 0;
        if (totalTaxRate > 0 && rate > 0) {
            taxAmount = total_taxes * (rate / totalTaxRate);
        }
        return {
            ...tax,
            tax_amount: parseFloat(taxAmount.toFixed(2)),
            total: taxAmount.toFixed(2),
        };
    });

    const disc_perc = parseFloat(form.additional_discount_percentage) || 0;
    const disc_amt = parseFloat(form.discount_amount) || 0;

    const hasInclusiveItem = items.some(i => i.is_tax_inclusive !== false && parseFloat(i.amount) > 0);
    const displayBaseTotal = (hasInclusiveItem && totalTaxRate > 0)
        ? net_base_total
        : gross_base_total;

    let discount = 0;
    if (form.apply_discount_on === 'Net Total') {
        discount = disc_perc ? (displayBaseTotal * disc_perc / 100) : disc_amt;
    }

    const net = (hasInclusiveItem && totalTaxRate > 0)
        ? gross_base_total
        : (gross_base_total + total_taxes);

    if (form.apply_discount_on === 'Grand Total') {
        discount = disc_perc ? (net * disc_perc / 100) : disc_amt;
    }

    const grand_total = net - discount;
    const rounded_total = Math.round(grand_total * 100) / 100;

    return {
        ...form,
        items,
        taxes: updatedTaxes,
        total_qty: Math.abs(total_qty),
        base_total: parseFloat(displayBaseTotal.toFixed(2)),
        total_taxes_and_charges: parseFloat(total_taxes.toFixed(2)),
        grand_total: Math.max(0, grand_total),
        rounded_total: Math.max(0, rounded_total),
    };
}

const CustomerDropdown = ({ onSelect, customers, targetRef, selectedIndex, setSelectedIndex }) => {
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);

    useEffect(() => {
        const updateCoords = () => {
            if (targetRef?.current) {
                const rect = targetRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [targetRef, customers]);

    useEffect(() => {
        if (selectedIndex >= 0 && dropdownRef.current) {
            const activeEl = dropdownRef.current.children[selectedIndex];
            if (activeEl) {
                activeEl.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
    }, [selectedIndex]);

    if (customers.length === 0) return null;

    return createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: Math.max(coords.width, 250),
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                zIndex: 999999,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                maxHeight: '250px',
                overflowY: 'auto'
            }}
        >
            {customers.map((c, i) => (
                <div
                    key={c.name}
                    onClick={() => onSelect(c)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: selectedIndex === i ? '#f8fafc' : 'white',
                        transition: 'background-color 0.15s ease'
                    }}
                >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: selectedIndex === i ? '#10b981' : '#1e293b' }}>{c.customer_name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.name}</div>
                </div>
            ))}
        </div>,
        document.body
    );
};

const ItemDropdown = ({ query, onSelect, warehouse, targetRef }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', {
                    params: { search_term: query || '', warehouse: warehouse }
                });
                setResults(res.data.message || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetchItems, query ? 250 : 0);
        return () => clearTimeout(timer);
    }, [query, warehouse]);

    useEffect(() => {
        const updateCoords = () => {
            if (targetRef?.current) {
                const rect = targetRef.current.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [targetRef, results, loading]);

    if (!query || query.length < 1) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            minWidth: Math.max(coords.width, 300),
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            zIndex: 999999,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxHeight: '250px',
            overflowY: 'auto'
        }}>
            {loading ? (
                <div style={{ padding: '1rem', textAlign: 'center' }}><Loader2 size={16} className="so-spinner" /></div>
            ) : results.length > 0 ? (
                results.map(item => (
                    <div
                        key={item.item_code}
                        onClick={() => onSelect(item)}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.item_code} | {item.stock_uom}</div>
                        {item.price_list_rate && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><DirhamIcon size={10} /> {item.price_list_rate}</div>}
                    </div>
                ))
            ) : (
                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>No items found</div>
            )}
        </div>,
        document.body
    );
};

const DeliveryNoteDetails = () => {
    const navigate = useNavigate();
    const { name } = useParams();
    const location = useLocation();
    const customerInputRef = useRef(null);
    const itemInputRefs = useRef({});
    const loggedWarehouse = useSelector(state => state.user?.warehouse || '');
    const user_roles = useSelector(state => state.user?.user_roles || []);
    const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");
    const theme = useSelector(state => state.user?.theme || 'modern');
    const { getShortcut, isShortcutPressed } = useCustomShortcuts();


    const [showModal, setShowModal] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('details');
    const [connections, setConnections] = useState({});
    const [namingSeriesOptions, setNamingSeriesOptions] = useState([]);
    const [allowedActions, setAllowedActions] = useState(['save', 'submit', 'delete']);
    const [showCreateDropdown, setShowCreateDropdown] = useState(false);
    const createDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) {
                setShowCreateDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navigateToDoc = (doctype, docname) => {
        const routes = {
            'Sales Order': (id) => `/salesorder-details/${encodeURIComponent(id)}`,
            'Delivery Note': (id) => `/deliverynote-details/${encodeURIComponent(id)}`,
            'Sales Invoice': (id) => `/salesinvoice?invoice=${encodeURIComponent(id)}`,
        };
        const getRoute = routes[doctype];
        if (getRoute) {
            navigate(getRoute(docname));
        }
    };

    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerSelectedIndex, setCustomerSelectedIndex] = useState(-1);
    const [barcodeInput, setBarcodeInput] = useState('');

    const [dnColumns, setDnColumns] = useState(loadColumnConfig);
    const [showColConfig, setShowColConfig] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const barcodeRef = useRef(null);
    const scannerBuffer = useRef("");
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Column Resizing
    const [resizingCol, setResizingCol] = useState(null);

    const handleResizeMouseDown = (e, colId) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const targetCol = dnColumns.find(c => c.id === colId);
        const startWidth = parseInt(targetCol?.width || 100, 10);

        const handleMouseMove = (moveEvent) => {
            const diff = moveEvent.clientX - startX;
            const newWidth = Math.max(40, startWidth + diff);
            setDnColumns(prev => prev.map(c => c.id === colId ? { ...c, width: newWidth } : c));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            setResizingCol(null);
            setDnColumns(currentCols => {
                localStorage.setItem('delivery_matrix_config', JSON.stringify(currentCols));
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
            setDnColumns(prevCols => {
                const fromIndex = prevCols.findIndex(c => c.id === sourceColId);
                const toIndex = prevCols.findIndex(c => c.id === targetColId);
                if (fromIndex !== -1 && toIndex !== -1) {
                    const newCols = [...prevCols];
                    const [moved] = newCols.splice(fromIndex, 1);
                    newCols.splice(toIndex, 0, moved);
                    localStorage.setItem('delivery_matrix_config', JSON.stringify(newCols));
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

    const getSession = () => localStorage.getItem('session') || '';

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

    const handleUOMChangeDetails = (uomValue, rowIndex) => {
        setForm(prev => {
            const items = [...prev.items];
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

    const handleInputChangeDetails = (e, rowIndex) => {
        const { name, value } = e.target;
        setForm(prev => {
            const newState = { ...prev };
            const items = [...prev.items];
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
            newState.items = items;
            return recalcForm(newState);
        });
    };

    const selectItem = async (idx, item) => {
        try {
            const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
                params: { item_code: item.item_code, price_list: form.selling_price_list },
                withCredentials: true
            });
            const rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || 0;

            const pPerBox = parseFloat(item.custom_pieces_per_box || 1);
            const uomList = item.uom_list || [];

            setForm(prev => {
                const items = [...prev.items];
                items[idx] = {
                    ...items[idx],
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
                    warehouse: prev.set_warehouse || ''
                };

                // Async fetch UOMs
                fetchItemUOMs(item.item_code).then(fetchedUoms => {
                    setForm(p => {
                        const its = [...p.items];
                        const ri = its.findIndex(i => i.item_code === item.item_code);
                        if (ri !== -1) its[ri] = { ...its[ri], uom_list: fetchedUoms };
                        return { ...p, items: its };
                    });
                });

                // Auto-add next row
                if (idx === items.length - 1) {
                    items.push({ ...DNItemModel, qty: 1, rate: 0, amount: 0 });
                }

                return recalcForm({ ...prev, items });
            });
        } catch (err) { console.error(err); }
        setItemQueries(prev => {
            const n = { ...prev };
            delete n[idx];
            return n;
        });
        setActiveItemRow(null);
    };

    const [dnTheme, setDnTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = dnTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', dnTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [dnTheme, themeColor, themeColorHover, themeLight]);

    const [form, setForm] = useState({
        name: '', title: '', naming_series: '',
        posting_date: new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().slice(0, 5),
        customer: '', customer_name: '', docstatus: 0,
        is_return: 0, return_against: '', set_warehouse: '',
        currency: 'AED', selling_price_list: 'Standard Selling',
        items: [], taxes: [], taxes_and_charges: '',
        apply_discount_on: 'Grand Total', additional_discount_percentage: 0,
        discount_amount: 0, total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
    });

    const isNew = !form.name;
    const isEditing = !isViewOnly;

    const [customers, setCustomers] = useState([]);

    const filteredCustomers = useMemo(() => {
        if (!customerQuery) return customers.slice(0, 10);
        const q = customerQuery.toLowerCase();
        return customers.filter(c =>
            (c.customer_name || '').toLowerCase().includes(q) ||
            (c.name || '').toLowerCase().includes(q)
        ).slice(0, 10);
    }, [customerQuery, customers]);
    const [warehouses, setWarehouses] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [showQuickItemModal, setShowQuickItemModal] = useState(false);
    const [quickItemInitialCode, setQuickItemInitialCode] = useState('');
    const [quickItemTargetRow, setQuickItemTargetRow] = useState(null);

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return <DirhamIcon size={12} className="inline mr-1" />;
            case 'USD': return '$';
            default: return '₹';
        }
    };

    const numToWords = (num) => {
        if (!num) return 'Zero';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
            'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
            'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
            return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        };
        return convert(num).trim();
    };

    const numberToWords = (num, currency) => {
        if (!num) return '';
        const words = numToWords(Math.floor(Math.abs(num)));
        return `${currency} ${words} Only.`;
    };

    const setDefaultBranch = async () => {
        try {
            const userEmail = localStorage.getItem('user_id');
            if (userEmail) {
                const branchRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_branch_name', {
                    params: { user_email: userEmail }
                });
                if (branchRes.data.message) {
                    const whs = warehouses.length > 0 ? warehouses : (await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn')).data.message || [];
                    const defaultWh = whs.find(w => w.name.includes(branchRes.data.message))?.name;
                    if (defaultWh) {
                        setForm(prev => ({ ...prev, set_warehouse: defaultWh }));
                    }
                }
            }
        } catch (err) { console.error("Error setting default branch:", err); }
    };

    const loadMetadata = async () => {
        try {
            const [custRes, whRes, taxRes, nsRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                axios.get('/api/method/kyle_retail.retail_api.api.get_naming_series_retail', { params: { doctype: 'Delivery Note' } })
            ]);
            const filteredTemplates = (taxRes.data.message || []).filter(t => t.name.toUpperCase().includes('NS'));
            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(filteredTemplates);
            setNamingSeriesOptions(nsRes.data.message?.options || []);
            return filteredTemplates;
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    const loadDeliveryNote = async (dnName) => {
        try {
            setLoading(true);
            const [dnRes, statusRes, connectionsRes] = await Promise.all([
                axios.get(`/api/resource/Delivery Note/${dnName}`),
                axios.get('/api/method/kyle_retail.retail_api.api.get_document_status_details', { params: { doctype: 'Delivery Note', docname: dnName } }),
                axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', { params: { doctype: 'Delivery Note', name: dnName } })
            ]);
            const dn = dnRes.data.data;
            const loadedItems = (dn.items || []).map(it => {
                const isBox = (it.uom || '').toLowerCase() === 'box';
                const pPerBox = parseFloat(it.custom_pieces_per_box || 1);
                return {
                    ...DNItemModel,
                    ...it,
                    custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || '',
                    custom_box_qty: parseFloat(parseFloat(it.custom_box_qty || 0).toFixed(2)),
                    custom_pieces_per_box: pPerBox,
                    default_pieces_per_box: pPerBox,
                    custom_box_price: parseFloat(parseFloat(it.custom_box_price || 0).toFixed(2)),
                    custom_selling_price: parseFloat(parseFloat(it.custom_selling_price || 0).toFixed(2)),
                    qty: parseFloat(parseFloat(it.qty || 0).toFixed(2)),
                    rate: parseFloat(parseFloat(it.rate || 0).toFixed(2)),
                    amount: parseFloat(parseFloat(it.amount || 0).toFixed(2)),
                    use_box_entry: isBox
                };
            });

            // Async fetch UOM lists for each item
            loadedItems.forEach((item, idx) => {
                fetchItemUOMs(item.item_code).then(fetchedUoms => {
                    setForm(p => {
                        const its = [...p.items];
                        if (its[idx]) {
                            its[idx] = { ...its[idx], uom_list: fetchedUoms };
                        }
                        return { ...p, items: its };
                    });
                });
            });

            setForm({
                ...dn,
                items: loadedItems,
                taxes: dn.taxes || []
            });
            setCustomerQuery(dn.customer_name || '');
            setAllowedActions(statusRes.data.data?.allowed_actions || []);
            const payload = connectionsRes.data.message?.categories || {};
            const flatDocs = {};
            Object.values(payload).forEach(cat => {
                if (cat && typeof cat === 'object') {
                    Object.entries(cat).forEach(([dt, rows]) => {
                        if (rows && rows.length > 0) {
                            flatDocs[dt] = rows;
                        }
                    });
                }
            });
            setConnections(flatDocs);
            setIsViewOnly(dn.docstatus !== 0);
            setIsDirty(false);
            setActiveTab('details');
            setLoading(false);
        } catch (err) { navigate('/deliverynote'); }
    };

    const loadMappedSI = async (siName) => {
        try {
            setLoading(true);
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_mapped_doc_retail', {
                params: { from_doctype: 'Sales Invoice', to_doctype: 'Delivery Note', source_name: siName },
                withCredentials: true
            });
            if (res.data.message?.status === 'success') {
                const mappedData = res.data.message.data;
                const loadedItems = (mappedData.items || []).map(it => {
                    const isBox = (it.uom || '').toLowerCase() === 'box';
                    const pPerBox = parseFloat(it.custom_pieces_per_box || 1);
                    return {
                        ...DNItemModel,
                        ...it,
                        custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || '',
                        custom_box_qty: parseFloat(parseFloat(it.custom_box_qty || 0).toFixed(2)),
                        custom_pieces_per_box: pPerBox,
                        default_pieces_per_box: pPerBox,
                        custom_box_price: parseFloat(parseFloat(it.custom_box_price || 0).toFixed(2)),
                        custom_selling_price: parseFloat(parseFloat(it.custom_selling_price || 0).toFixed(2)),
                        qty: parseFloat(parseFloat(it.qty || 0).toFixed(2)),
                        rate: parseFloat(parseFloat(it.rate || 0).toFixed(2)),
                        amount: parseFloat(parseFloat(it.amount || 0).toFixed(2)),
                        use_box_entry: isBox
                    };
                });

                // Async fetch UOM lists for each item
                loadedItems.forEach((item, idx) => {
                    fetchItemUOMs(item.item_code).then(fetchedUoms => {
                        setForm(p => {
                            const its = [...p.items];
                            if (its[idx]) {
                                its[idx] = { ...its[idx], uom_list: fetchedUoms };
                            }
                            return { ...p, items: its };
                        });
                    });
                });

                setForm({
                    ...mappedData,
                    name: '', // New draft
                    status: 'Draft',
                    docstatus: 0,
                    posting_date: new Date().toISOString().split('T')[0],
                    posting_time: new Date().toTimeString().slice(0, 5),
                    items: loadedItems,
                    taxes: mappedData.taxes || []
                });
                setCustomerQuery(mappedData.customer_name || '');
                setIsViewOnly(false);
                setIsDirty(true);
                setActiveTab('details');
            } else {
                throw new Error(res.data.message?.message || 'Failed to map Sales Invoice');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Mapping Failed', text: err.message });
            navigate('/deliverynote');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = (templates = []) => {
        const defaultWh = loggedWarehouse || localStorage.getItem('warehouse') || '';
        const list = templates.length > 0 ? templates : taxTemplates;
        const defaultTax = list.find(t =>
            t.name.toUpperCase().includes('VAT 5%') ||
            t.name.toUpperCase().includes('5%') ||
            t.name.toUpperCase().includes('VAT 5')
        )?.name || 'UAE VAT 5% - NS';

        setForm({
            name: '', title: '',
            naming_series: namingSeriesOptions[0] || 'MAT-DN-.YYYY.-',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: defaultWh,
            docstatus: 0, is_return: 0, return_against: '', currency: 'AED',
            selling_price_list: 'Standard Selling', items: [{ ...DNItemModel, qty: 1, rate: 0, amount: 0 }],
            taxes_and_charges: '', taxes: [],
            apply_discount_on: 'Grand Total',
            additional_discount_percentage: 0,
            discount_amount: 0,
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
            grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsViewOnly(false);
        setLoading(false);
        if (!defaultWh) {
            setDefaultBranch();
        }
        if (defaultTax) {
            applyTaxTemplate(defaultTax);
        }
    };

    useEffect(() => {
        loadMetadata().then((templates) => {
            const params = new URLSearchParams(location.search);
            const siName = params.get('si');
            if (name) {
                loadDeliveryNote(name);
            } else if (siName) {
                loadMappedSI(siName);
            } else if (location.pathname.includes('/create')) {
                openCreateModal(templates);
            }
        });
    }, [name, location.pathname, location.search]);

    useEffect(() => {
        setForm(prev => {
            const updated = recalcForm(prev);
            return {
                ...updated,
                in_words: numberToWords(updated.rounded_total, updated.currency)
            };
        });
    }, [form.items, form.taxes, form.currency, form.apply_discount_on, form.additional_discount_percentage, form.discount_amount]);

    const handleDocAction = async (action) => {
        if (action === 'save' || action === 'submit') {
            if (!form.customer) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Customer Required',
                    text: 'Please select a Target Customer before saving/submitting.',
                    confirmButtonColor: themeColor
                });
                return;
            }
            if (!form.set_warehouse) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Branch/Warehouse Required',
                    text: 'Please select a Branch/Warehouse (Branch field) before saving/submitting.',
                    confirmButtonColor: themeColor
                });
                return;
            }
            if (!form.items || form.items.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Items Required',
                    text: 'Please add at least one item before saving/submitting.',
                    confirmButtonColor: themeColor
                });
                return;
            }
            const invalidItem = form.items.find(i => !i.item_code || parseFloat(i.qty) <= 0);
            if (invalidItem) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Item Row',
                    text: 'Please ensure all item rows have a selected product and a quantity greater than zero.',
                    confirmButtonColor: themeColor
                });
                return;
            }
        }

        setSaving(true);
        try {
            if (action === 'save') {
                const payload = { ...form, doctype: 'Delivery Note', items: form.items.map(i => ({ ...i, warehouse: i.warehouse || form.set_warehouse })) };
                const res = form.name ? await frappeCall({ method: 'frappe.client.save', args: { doc: payload } }) : await frappeCall({ method: 'frappe.client.insert', args: { doc: payload } });
                setForm(prev => ({ ...prev, ...res }));
                setIsDirty(false);
                Swal.fire({ icon: 'success', title: 'Saved', timer: 1500 });
            } else if (action === 'submit') {
                // Ensure all items have a warehouse when submitting as well
                const payload = { ...form, doctype: 'Delivery Note', items: form.items.map(i => ({ ...i, warehouse: i.warehouse || form.set_warehouse })) };
                const res = await frappeCall({ method: 'frappe.client.submit', args: { doc: payload } });
                setForm(prev => ({ ...prev, ...res }));
                setIsViewOnly(true);
                Swal.fire({ icon: 'success', title: 'Submitted' });
            } else if (action === 'delete') {
                await frappeCall({ method: 'frappe.client.delete', args: { doctype: 'Delivery Note', name: form.name } });
                navigate('/deliverynote');
            }
        } catch (err) { Swal.fire({ icon: 'error', text: err.message }); }
        finally { setSaving(false); }
    };

    const handleCreateInvoice = () => {
        if (!form.name) return;
        navigate('/homepage', { state: { loadDeliveryNote: form.name } });
    };

    const updateItem = (i, field, value) => {
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
        setForm(prev => ({ ...prev, items }));
        setIsDirty(true);
    };

    const removeItem = (i) => {
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
        setIsDirty(true);
    };

    const addItemRow = () => {
        setForm(prev => ({ ...prev, items: [...prev.items, { item_code: '', item_name: '', qty: 0, rate: 0, amount: 0, uom: 'Nos', warehouse: form.set_warehouse }] }));
    };

    const applyTaxTemplate = async (templateName) => {
        if (!templateName) { setForm(prev => recalcForm({ ...prev, taxes_and_charges: '', taxes: [] })); return; }
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn', { params: { template: templateName } });
            let rows = (res.data.message || []).map(t => ({
                charge_type: t.charge_type || 'On Net Total',
                account_head: t.account_head,
                description: t.description || t.account_head || 'VAT',
                rate: parseFloat(t.rate) || 0,
                tax_amount: parseFloat(t.tax_amount) || 0,
                total: parseFloat(t.total) || 0,
                add_deduct_tax: t.add_deduct_tax || 'Add'
            }));
            if (rows.length === 0 && templateName) {
                let rate = 0; let account = "";
                if (templateName.includes("5%")) { rate = 5; account = "VAT 5% - NS"; }
                else if (templateName.includes("Zero")) { rate = 0; account = "VAT Zero - NS"; }
                rows = [{ charge_type: "On Net Total", account_head: account || templateName, description: account || templateName, rate: rate, add_deduct_tax: "Add", tax_amount: 0, total: 0 }];
            }
            setForm(prev => recalcForm({ ...prev, taxes_and_charges: templateName, taxes: rows }));
        } catch (err) {
            console.error('Failed to load tax template:', err);
            let rate = 0;
            if (templateName.includes("5%")) rate = 5;
            const rows = [{ charge_type: "On Net Total", account_head: templateName, description: templateName, rate: rate, add_deduct_tax: "Add", tax_amount: 0, total: 0 }];
            setForm(prev => recalcForm({ ...prev, taxes_and_charges: templateName, taxes: rows }));
        }
    };

    const handleBarcodeSearchDirect = async (val) => {
        if (!val.trim()) return;
        const activeWarehouse = form.set_warehouse || localStorage.getItem('warehouse') || '';
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
                params: { search_term: val, warehouse: activeWarehouse },
                withCredentials: true
            });
            const apiItem = (res.data.message || [])[0];

            if (apiItem) {
                // Fetch actual selling rate from price list
                let rate = apiItem.price_list_rate || 0;
                try {
                    const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
                        params: { item_code: apiItem.name, price_list: form.selling_price_list },
                        withCredentials: true
                    });
                    rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || rate;
                } catch (e) { console.warn('Rate fetch failed, using fallback:', e); }

                setForm(prev => {
                    const items = [...prev.items];
                    const emptyIdx = items.findIndex(i => !i.item_code);
                    const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;

                    const pPerBox = parseFloat(apiItem.custom_pieces_per_box || 1);
                    const uomList = apiItem.uom_list || [];

                    const newRow = {
                        ...DNItemModel,
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
                        warehouse: prev.set_warehouse || localStorage.getItem('warehouse') || ''
                    };

                    if (emptyIdx !== -1) {
                        items[emptyIdx] = newRow;
                    } else {
                        items.push(newRow);
                    }

                    // Async fetch UOMs
                    fetchItemUOMs(apiItem.name).then(fetchedUoms => {
                        setForm(p => {
                            const its = [...p.items];
                            const ri = its.findIndex(i => i.item_code === apiItem.name);
                            if (ri !== -1) its[ri] = { ...its[ri], uom_list: fetchedUoms };
                            return { ...p, items: its };
                        });
                    });

                    if (items.every(i => i.item_code)) {
                        items.push({ ...DNItemModel, qty: 1, rate: 0, amount: 0 });
                    }

                    return recalcForm({ ...prev, items });
                });
                setBarcodeInput('');
                setTimeout(() => barcodeRef.current?.focus(), 100);
            } else {
                // Global Discovery Fallback
                try {
                    const globalRes = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_globally_retail', {
                        search_term: val
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
                                This item is not enabled for <span style="font-weight: 800; color: #0f172a;">${activeWarehouse}</span>.
                            </div>
                            <div style="font-size: 16px; font-weight: 700; color: #1e293b; padding: 8px 12px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #4f46e5; text-align: left; line-height: 1.4; margin-bottom: 12px;">
                                ${it.item_name || it.name}
                            </div>
                            <div style="text-align: left; font-size: 14px; color: #475569;">
                                <p style="font-weight: 600; margin-bottom: 4px;">Stock available in:</p>
                                <p style="color: #059669; font-weight: 700;">${availableBranches || 'None (No physical stock)'}</p>
                            </div>`,
                            icon: 'info',
                            confirmButtonColor: themeColor
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

    const handleBarcodeSearch = async (e) => {
        if (e.key !== 'Enter' || !barcodeInput.trim()) return;
        handleBarcodeSearchDirect(barcodeInput.trim());
    };

    // Camera scanner start/stop logic
    const html5QrcodeRef = useRef(null);
    useEffect(() => {
        if (showCamera) {
            const html5Qrcode = new Html5Qrcode("dndetails-scanner-reader");
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
                        handleBarcodeSearchDirect(decodedText.trim());
                        setShowCamera(false);
                        html5Qrcode.stop().catch(err => console.error("Error stopping camera on success:", err));
                    }
                },
                () => { }
            ).catch(err => {
                console.error("Camera start failed, trying fallback:", err);
                html5Qrcode.start(
                    { deviceId: undefined },
                    { ...config, formatsToSupport: formats },
                    (decodedText) => {
                        if (showCamera) {
                            handleBarcodeSearchDirect(decodedText.trim());
                            setShowCamera(false);
                            html5Qrcode.stop().catch(fallbackErr => console.error("Error stopping fallback camera success:", fallbackErr));
                        }
                    },
                    () => { }
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
    }, [showCamera]);

    // Global hardware barcode scanner interceptor & Quick Shortcuts
    const lastKeyTime = useRef(0);
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const now = Date.now();
            const activeEl = document.activeElement;
            const isInputFocused = ['INPUT', 'TEXTAREA'].includes(activeEl?.tagName);

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
                if (!isViewOnly) {
                    handleBarcodeSearchDirect(scanValue);
                }
                return;
            }

            // Keyboard shortcuts (doc_editor context)
            const inItemsTable = activeEl?.closest('table.so-table');
            const activeRowIndex = inItemsTable ? parseInt(activeEl.closest('tr')?.getAttribute('data-row-index') || '-1', 10) : -1;

            // Focus Customer Search input
            if (isShortcutPressed(e, 'doc_editor', 'customerSupplier', 'F2')) {
                e.preventDefault();
                const customerInput = customerInputRef.current || document.querySelector('input[placeholder="Search Customer..."]');
                if (customerInput) {
                    customerInput.focus();
                    customerInput.select?.();
                }
            }

            // Focus Item Search input
            if (isShortcutPressed(e, 'doc_editor', 'itemSearch', 'F3')) {
                e.preventDefault();
                const itemInputs = document.querySelectorAll('input[placeholder="SKU or Name..."]');
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
                const scanInput = barcodeRef.current || document.querySelector('input[placeholder="Scan Barcode SKU / Supplier Code directly here..."]');
                if (scanInput) {
                    scanInput.focus();
                    scanInput.select?.();
                }
            }

            // Bulk Quantity Update popup
            if (isShortcutPressed(e, 'doc_editor', 'bulkQty', 'F6')) {
                e.preventDefault();
                let rowIndex = inItemsTable ? activeRowIndex : ((form.items || []).length - 1);
                if (rowIndex >= 0 && rowIndex < (form.items || []).length) {
                    const item = (form.items || [])[rowIndex];
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
                                handleInputChangeDetails({ target: { name, value: newQty } }, rowIndex);
                            }
                        });
                    }
                }
            }

            // Toggle UOM
            if (isShortcutPressed(e, 'doc_editor', 'uom', 'F8')) {
                e.preventDefault();
                let rowIndex = inItemsTable ? activeRowIndex : ((form.items || []).length - 1);
                if (rowIndex >= 0 && rowIndex < (form.items || []).length) {
                    const item = (form.items || [])[rowIndex];
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
                        handleUOMChangeDetails(nextUom, rowIndex);
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

            // Save Draft
            if (isShortcutPressed(e, 'doc_editor', 'saveDraft', 'F7') || (e.ctrlKey && e.key.toLowerCase() === 's')) {
                e.preventDefault();
                if (!saving) {
                    handleDocAction('save');
                }
            }

            // Add Item Row
            if (isShortcutPressed(e, 'doc_editor', 'addRow', 'F10') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
                e.preventDefault();
                addItemRow();
                setTimeout(() => {
                    const itemInputs = document.querySelectorAll('table.so-table tbody tr input[placeholder="SKU or Name..."]');
                    if (itemInputs.length > 0) {
                        const lastInput = itemInputs[itemInputs.length - 1];
                        if (lastInput) {
                            lastInput.focus();
                            lastInput.select?.();
                        }
                    }
                }, 100);
            }

            // Focus Warehouse Select
            if (isShortcutPressed(e, 'doc_editor', 'warehouseBranch', 'F9')) {
                e.preventDefault();
                const warehouseSelect = document.querySelector('select[value="' + form.set_warehouse + '"]') || document.querySelector('select');
                if (warehouseSelect) {
                    warehouseSelect.focus();
                }
            }

            // Submit
            if (isShortcutPressed(e, 'doc_editor', 'submit', 'F12') || (e.ctrlKey && e.key === 'Enter')) {
                e.preventDefault();
                if (!saving && !isNew) {
                    handleDocAction('submit');
                }
            }

            // Escape
            if (e.key === 'Escape') {
                e.preventDefault();
                if (showColConfig) setShowColConfig(false);
                else if (isEditing && isNew) {
                    navigate('/deliverynotelist');
                } else if (isEditing) {
                    setIsViewOnly(true);
                } else if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
                    activeEl.blur();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isViewOnly, form.items, form.name, saving, showColConfig, form.set_warehouse, isEditing, isNew]);


    const fieldStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.55rem 0.875rem', fontSize: '0.875rem', outline: 'none', background: 'white' };
    const fieldReadonly = { ...fieldStyle, background: '#f9fafb', color: '#6b7280' };
    const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.375rem' };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-gray-50">
            <Loader2 size={40} className="animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Delivery Note...</p>
        </div>
    );

    // Helper to extract linked docs safely
    const getLinkedDocs = (doctype) => {
        const list = [];
        const docs = connections[doctype] || [];
        docs.forEach(d => {
            if (d && typeof d === 'object') {
                list.push(d.name);
            } else if (typeof d === 'string') {
                list.push(d);
            }
        });
        return list;
    };

    const linkedSalesOrders = getLinkedDocs('Sales Order');
    const linkedSalesInvoices = getLinkedDocs('Sales Invoice');

    if (theme === 'legacy') {
        const isViewOnly = !isEditing || form.docstatus !== 0;

        return (
            <div className="classic-root" style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>

                {/* 1. CLASSIC SHORTCUTS GUIDE BAR */}
                <div className="so-shortcut-guide-banner" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping mr-0.5"></span>
                        <span>DELIVERY NOTE</span>
                    </div>
                    <div className="so-shortcut-badges-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#3b82f6', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F2</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>CUSTOMER</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#0ea5e9', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F3</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SEARCH</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F4</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>BARCODE</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#a855f7', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F6</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>BULK QTY</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#eab308', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F7</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SAVE DRAFT</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#0ea5e9', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>F10</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>ADD ROW</span>
                        </div>
                        <div className="so-shortcut-badge" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '6px', padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span className="so-shortcut-key" style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>CTRL+↵</span>
                            <span className="so-shortcut-label" style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>SUBMIT</span>
                        </div>
                    </div>
                </div>

                {/* 2. CLASSIC HEADER FORM */}
                <div className="classic-header-form" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0.6rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0 }}>
                    {/* Row 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
                        {/* Customer Selection */}
                        <div className="classic-field flex items-center gap-3 relative flex-1">
                            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap font-bold">CUSTOMER</label>
                            <div className="relative group flex-1">
                                <CustomSearchDropdown
                                    placeholder="Search customer..."
                                    value={form.customer ? { name: form.customer, customer_name: form.customer_name } : null}
                                    onSelect={(val) => {
                                        if (val) {
                                            setForm(prev => ({ ...prev, customer: val.name, customer_name: val.customer_name }));
                                            setCustomerQuery(val.customer_name);
                                        } else {
                                            setForm(prev => ({ ...prev, customer: '', customer_name: '' }));
                                            setCustomerQuery('');
                                        }
                                    }}
                                    fetchData={async (val) => {
                                        const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list_so', { params: { search_term: val }, withCredentials: true });
                                        return res.data.message || [];
                                    }}
                                    optionsLabel="customer_name"
                                    globalSearch={true}
                                    themeColor={themeColor}
                                    disabled={isViewOnly}
                                />
                            </div>
                        </div>

                        {/* Warehouse Selector */}
                        <div className="classic-field flex items-center gap-3 relative flex-1">
                            <label className="uppercase font-black text-[11px] text-slate-500 tracking-tight whitespace-nowrap font-bold">BRANCH</label>
                            <div className="relative group flex-1">
                                {!isViewOnly && isAdmin ? (
                                    <select
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full cursor-pointer"
                                        value={form.set_warehouse || ''}
                                        onChange={e => {
                                            const wh = e.target.value;
                                            setForm(prev => ({
                                                ...prev,
                                                set_warehouse: wh,
                                                items: prev.items.map(item => ({ ...item, warehouse: wh }))
                                            }));
                                        }}
                                    >
                                        <option value="">Select Warehouse...</option>
                                        {warehouses.map(w => (
                                            <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="h-10 px-3 flex items-center border border-slate-200 bg-slate-100/80 rounded-lg text-xs font-black tracking-wider text-slate-700 shadow-2xs w-full">
                                        <span>{(form.set_warehouse || loggedWarehouse || 'Main Warehouse').split(' - ')[0]}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Posting Date */}
                        <div className="classic-field flex items-center gap-3">
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">DATE</label>
                            <input
                                type="date"
                                value={form.posting_date}
                                disabled={isViewOnly}
                                onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                onChange={e => setForm({ ...form, posting_date: e.target.value })}
                                className="h-10 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>

                        {/* Naming Series */}
                        <div className="classic-field flex items-center gap-3 relative flex-1">
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">SERIES</label>
                            <div className="relative group flex-1">
                                {!isViewOnly && !form.name ? (
                                    <select
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full cursor-pointer"
                                        value={form.naming_series || ''}
                                        onChange={e => setForm(prev => ({ ...prev, naming_series: e.target.value }))}
                                    >
                                        {namingSeriesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : (
                                    <div className="h-10 px-3 flex items-center border border-slate-200 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 shadow-2xs w-full">
                                        <span>{form.naming_series || '—'}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* DN NO */}
                        <div className="classic-field flex items-center gap-3">
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">DN NO</label>
                            <div className="h-10 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-black text-slate-800">
                                {form.name || 'NEW-DN'}
                            </div>
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', width: '100%', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                        {/* Customer PO */}
                        <div className="classic-field flex items-center gap-3" style={{ flex: 1.5 }}>
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">CUSTOMER PO</label>
                            <input
                                type="text"
                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full disabled:bg-slate-100 disabled:text-slate-500"
                                value={form.po_no || ''}
                                disabled={isViewOnly}
                                onChange={e => setForm({ ...form, po_no: e.target.value })}
                                placeholder="Enter PO Number"
                            />
                        </div>

                        {/* Customer PO Date */}
                        <div className="classic-field flex items-center gap-3" style={{ flex: 1.5 }}>
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">CUSTOMER PO DATE</label>
                            <input
                                type="date"
                                className="h-10 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 w-full"
                                value={form.po_date || ''}
                                disabled={isViewOnly || !form.po_no}
                                onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                onChange={e => setForm({ ...form, po_date: e.target.value })}
                            />
                        </div>

                        {/* Is Return Checkbox */}
                        <div className="classic-field flex items-center gap-3" style={{ flex: 0.8 }}>
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">IS RETURN</label>
                            <div className="flex items-center h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={form.is_return === 1}
                                    disabled={isViewOnly}
                                    onChange={e => setForm({ ...form, is_return: e.target.checked ? 1 : 0 })}
                                    className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Return Against */}
                        <div className="classic-field flex items-center gap-3" style={{ flex: 2 }}>
                            <label className="uppercase font-black text-[10px] text-slate-500 tracking-tight whitespace-nowrap font-bold">RETURN AGAINST</label>
                            <input
                                type="text"
                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white w-full disabled:bg-slate-100 disabled:text-slate-500"
                                value={form.return_against || ''}
                                disabled={isViewOnly || form.is_return !== 1}
                                onChange={e => setForm({ ...form, return_against: e.target.value })}
                                placeholder="Return against document..."
                            />
                        </div>
                    </div>
                </div>

                {/* 3. CLASSIC MAIN BODY: TABLE + BOTTOM CONTROLS */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-2">

                    {/* Table container */}
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs">

                        {/* Barcode scanner bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '240px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                ref={barcodeRef}
                                                className="so-select text-xs font-bold text-slate-800"
                                                style={{ height: '2.2rem', paddingRight: '2.5rem', width: '100%', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                                                placeholder="Scan barcode SKU directly here..."
                                                disabled={isViewOnly}
                                                value={barcodeInput}
                                                onChange={e => setBarcodeInput(e.target.value)}
                                                onKeyDown={handleBarcodeSearch}
                                            />
                                            <ScanLine size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(true)}
                                    className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <Camera size={14} /> SCAN WITH CAMERA
                                </button>
                            </div>
                        </div>

                        {/* Items Table */}
                        {(() => {
                            const hasAnyBox = form.items.some(i => i.use_box_entry);
                            return (
                                <table className="classic-table" style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', background: '#ffffff', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                                            <th style={{ width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>#</th>
                                            <th style={{ width: '220px', minWidth: '220px', textAlign: 'left', padding: '10px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Item Details</th>
                                            {hasAnyBox ? (
                                                <>
                                                    <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Box Qty</th>
                                                    <th style={{ width: '90px', minWidth: '90px', textAlign: 'left', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>UOM</th>
                                                    <th style={{ width: '80px', minWidth: '80px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Pcs/Box</th>
                                                    <th style={{ width: '100px', minWidth: '100px', textAlign: 'right', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Box Price</th>
                                                    <th style={{ width: '100px', minWidth: '100px', textAlign: 'right', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Rate (Nos)</th>
                                                    <th style={{ width: '95px', minWidth: '95px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Tax Inc/Exc</th>
                                                    <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Total Qty</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th style={{ width: '100px', minWidth: '100px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Qty</th>
                                                    <th style={{ width: '90px', minWidth: '90px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>UOM</th>
                                                    <th style={{ width: '140px', minWidth: '140px', textAlign: 'right', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Rate</th>
                                                    <th style={{ width: '95px', minWidth: '95px', textAlign: 'center', padding: '10px 4px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Tax Inc/Exc</th>
                                                </>
                                            )}
                                            <th style={{ width: '130px', minWidth: '130px', textAlign: 'right', padding: '10px 8px', fontSize: '11px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', borderRight: '1px solid #e2e8f0' }}>Amount</th>
                                            <th style={{ width: '40px', minWidth: '40px', textAlign: 'center', padding: '10px 4px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {form.items.map((item, i) => (
                                            <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                                                <td className="text-center font-bold text-slate-400 text-xs py-2 border-r border-slate-100">{i + 1}</td>
                                                <td className="px-2 py-1 border-r border-slate-100 align-middle">
                                                    {!isViewOnly ? (
                                                        <div style={{ position: 'relative' }}>
                                                            <input
                                                                ref={el => itemInputRefs.current[i] = el}
                                                                className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-800 outline-none w-full focus:bg-white focus:border-emerald-500"
                                                                type="text"
                                                                placeholder="SKU Code / Name..."
                                                                value={item.item_code}
                                                                onFocus={() => {
                                                                    setActiveItemRow(i);
                                                                    setItemQueries(prev => ({ ...prev, [i]: item.item_code || '' }));
                                                                }}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    updateItem(i, 'item_code', val);
                                                                    setItemQueries(prev => ({ ...prev, [i]: val }));
                                                                    setActiveItemRow(i);
                                                                }}
                                                            />
                                                            {activeItemRow === i && (
                                                                <ItemDropdown
                                                                    targetRef={{ current: itemInputRefs.current[i] }}
                                                                    query={itemQueries[i] ?? item.item_code ?? ''}
                                                                    warehouse={form.set_warehouse}
                                                                    onSelect={(selected) => selectItem(i, selected)}
                                                                />
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="font-black text-slate-900 text-xs leading-tight">{item.item_name}</span>
                                                            <span className="block font-bold text-[9px] text-emerald-600 uppercase tracking-widest mt-0.5">{item.item_code}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                {hasAnyBox ? (
                                                    <>
                                                        {/* Box Qty */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <input
                                                                type="number"
                                                                name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                                                value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                                                onChange={(e) => handleInputChangeDetails(e, i)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-2 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                            />
                                                        </td>
                                                        {/* UOM */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <select
                                                                value={item.uom || 'Nos'}
                                                                onChange={(e) => handleUOMChangeDetails(e.target.value, i)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
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
                                                                        if (display === 'box' || display === 'BOX') display = 'Box';
                                                                        else if (display === 'nos' || display === 'NOS') display = 'Nos';
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
                                                        {/* Pcs/Box */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            {item.use_box_entry ? (
                                                                <input
                                                                    type="number"
                                                                    name="custom_pieces_per_box"
                                                                    value={item.custom_pieces_per_box || ''}
                                                                    onChange={(e) => handleInputChangeDetails(e, i)}
                                                                    disabled={isViewOnly}
                                                                    className="w-full h-8 px-2 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                        {/* Box Price */}
                                                        <td className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                                            {item.use_box_entry ? (
                                                                <input
                                                                    type="number"
                                                                    name="custom_box_price"
                                                                    value={item.custom_box_price || ''}
                                                                    onChange={(e) => handleInputChangeDetails(e, i)}
                                                                    disabled={isViewOnly}
                                                                    className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-300 pr-2">—</span>
                                                            )}
                                                        </td>
                                                        {/* Rate */}
                                                        <td className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                                            <input
                                                                type="number"
                                                                name="rate"
                                                                value={item.rate || ''}
                                                                onChange={(e) => handleInputChangeDetails(e, i)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                            />
                                                        </td>
                                                        {/* Tax Inc/Exc */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <select
                                                                value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                                                                onChange={e => {
                                                                    const val = e.target.value === 'Inclusive';
                                                                    setForm(prev => {
                                                                        const items = [...prev.items];
                                                                        items[i] = { ...items[i], is_tax_inclusive: val };
                                                                        return recalcForm({ ...prev, items });
                                                                    });
                                                                }}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
                                                            >
                                                                <option value="Inclusive">Inclusive</option>
                                                                <option value="Exclusive">Exclusive</option>
                                                            </select>
                                                        </td>
                                                        {/* Total Qty (Nos) */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle text-xs font-black text-slate-500">
                                                            {item.qty || 0}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Qty Input */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <input
                                                                type="number"
                                                                value={item.qty || ''}
                                                                onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-2 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                            />
                                                        </td>
                                                        {/* UOM */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <select
                                                                value={item.uom || 'Nos'}
                                                                onChange={(e) => handleUOMChangeDetails(e.target.value, i)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
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
                                                                        if (display === 'box' || display === 'BOX') display = 'Box';
                                                                        else if (display === 'nos' || display === 'NOS') display = 'Nos';
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
                                                        {/* Rate */}
                                                        <td className="px-2 py-1 text-right border-r border-slate-100 align-middle">
                                                            <input
                                                                type="number"
                                                                value={item.rate || ''}
                                                                onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-2 text-right font-black text-xs text-slate-800 bg-transparent border-none outline-none focus:bg-emerald-50/40"
                                                            />
                                                        </td>
                                                        {/* Tax Inc/Exc */}
                                                        <td className="px-2 py-1 text-center border-r border-slate-100 align-middle">
                                                            <select
                                                                value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                                                                onChange={e => {
                                                                    const val = e.target.value === 'Inclusive';
                                                                    setForm(prev => {
                                                                        const items = [...prev.items];
                                                                        items[i] = { ...items[i], is_tax_inclusive: val };
                                                                        return recalcForm({ ...prev, items });
                                                                    });
                                                                }}
                                                                disabled={isViewOnly}
                                                                className="w-full h-8 px-1 text-center font-black text-xs text-slate-800 bg-transparent border-none outline-none cursor-pointer focus:bg-emerald-50/40"
                                                            >
                                                                <option value="Inclusive">Inclusive</option>
                                                                <option value="Exclusive">Exclusive</option>
                                                            </select>
                                                        </td>
                                                    </>
                                                )}
                                                {/* Amount */}
                                                <td className="text-right px-2 py-1.5 border-r border-slate-100 align-middle text-xs font-black text-slate-900 pr-3">
                                                    {((item.qty || 0) * (item.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-center px-1">
                                                    {!isViewOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))}
                                                            className="text-rose-500 hover:text-rose-600 font-black text-sm cursor-pointer border-none bg-transparent"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Aesthetic placeholder rows */}
                                        {Array.from({ length: Math.max(0, 10 - form.items.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`} className="bg-white/40 border-b border-slate-100 opacity-40">
                                                <td className="text-center text-slate-300 font-bold text-xs py-2">{form.items.length + i + 2}</td>
                                                <td className="border-r border-slate-100"></td>
                                                {hasAnyBox ? (
                                                    <>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                        <td className="border-r border-slate-100"></td>
                                                    </>
                                                )}
                                                <td className="border-r border-slate-100"></td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                        {/* Discount fields row */}
                        <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
                            <div className="so-field" style={{ flex: 1 }}>
                                <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Discount %</label>
                                <input
                                    className="so-input"
                                    type="number"
                                    value={form.additional_discount_percentage}
                                    onChange={e => setForm(prev => ({ ...prev, additional_discount_percentage: parseFloat(e.target.value) || 0, discount_amount: 0 }))}
                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                />
                            </div>
                            <div className="so-field" style={{ flex: 1 }}>
                                <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Discount Amount</label>
                                <input
                                    className="so-input"
                                    type="number"
                                    value={form.discount_amount}
                                    onChange={e => setForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0, additional_discount_percentage: 0 }))}
                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sales Taxes & Template card */}
                    <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', marginTop: '0.75rem' }}>
                        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                            <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Taxes & Template</h5>
                        </div>
                        <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="so-field">
                                <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Tax Template</label>
                                <select
                                    className="so-select"
                                    value={form.taxes_and_charges || ''}
                                    onChange={e => applyTaxTemplate(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                >
                                    <option value="">No Tax Template Applied</option>
                                    {taxTemplates.map(t => (
                                        <option key={t.name} value={t.name}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {form.taxes.length > 0 && (
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {form.taxes.map((t, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>{t.account_head} ({t.rate}%)</span>
                                            <span style={{ fontWeight: 700, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                {getCurrencySymbol()}{((t.rate / 100) * form.base_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BOTTOM SECTION: ACTIONS GRID + TOTALS CARD (Matching SO Layout) */}
                    <div className="pt-3 flex-shrink-0">
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">

                            {/* ACTION BUTTON GRID (LEFT SIDE) */}
                            <div className="xl:col-span-7 flex">
                                <div className="grid grid-cols-4 grid-rows-2 gap-2.5 w-full h-full p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">

                                    {/* Row 1 / Col 1: SAVE DRAFT */}
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => handleDocAction('save')}
                                            disabled={saving}
                                            className="h-full bg-[#f59e0b] hover:bg-[#d97706] text-white border-2 border-[#f59e0b] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer disabled:opacity-40"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                                <Save size={15} />
                                                <span>SAVE DRAFT</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">F7</span>
                                        </button>
                                    )}

                                    {/* Row 1 / Col 2: SUBMIT DN */}
                                    {!isNew && form.docstatus === 0 && isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => handleDocAction('submit')}
                                            disabled={saving}
                                            className="h-full bg-[#10b981] hover:bg-[#059669] text-white border-2 border-[#10b981] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                                <CheckCircle2 size={15} />
                                                <span>SUBMIT</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">Ctrl+↵</span>
                                        </button>
                                    )}

                                    {/* Row 1 / Col 3: CREATE SI (Sales Invoice) — only when submitted */}
                                    {form.name && form.docstatus === 1 && (form.per_billed || 0) < 99.9 && (
                                        <button
                                            type="button"
                                            onClick={() => handleCreateInvoice()}
                                            className="h-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white border-2 border-[#0ea5e9] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                                                <Plus size={15} />
                                                <span>CREATE SI</span>
                                            </div>
                                        </button>
                                    )}

                                    {/* Row 1 / Col 4: CANCEL DN — only when submitted */}
                                    {form.docstatus === 1 && allowedActions.includes('cancel') && (
                                        <button
                                            type="button"
                                            onClick={() => handleDocAction('cancel')}
                                            disabled={saving}
                                            className="h-full bg-[#ef4444] hover:bg-[#dc2626] text-white border-2 border-[#ef4444] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                                <X size={15} />
                                                <span>CANCEL</span>
                                            </div>
                                        </button>
                                    )}

                                    {/* Row 2 / Col 1: DISCARD */}
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => isNew ? navigate('/deliverynote') : setIsViewOnly(true)}
                                            className="h-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#334155] border-2 border-[#cbd5e1] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#334155]">
                                                <X size={15} />
                                                <span>DISCARD</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-650">Esc</span>
                                        </button>
                                    )}

                                    {/* Row 2 / Col 2: MODIFY (read-only mode only) */}
                                    {!isEditing && form.docstatus === 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsViewOnly(false)}
                                            className="h-full bg-[#3b82f6] hover:bg-[#2563eb] text-white border-2 border-[#3b82f6] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                                <Edit3 size={15} />
                                                <span>MODIFY</span>
                                            </div>
                                        </button>
                                    )}

                                    {/* Row 2 / Col 3: PRINT PDF */}
                                    {form.name && (
                                        <button
                                            type="button"
                                            onClick={() => window.open(`/api/method/frappe.utils.print_format.download_pdf?doctype=Delivery Note&name=${form.name}&format=Standard`, '_blank')}
                                            className="h-full bg-[#0284c7] hover:bg-[#0369a1] text-white border-2 border-[#0284c7] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                                                <Printer size={15} />
                                                <span>PRINT PDF</span>
                                            </div>
                                            <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-white/20 text-white">PDF</span>
                                        </button>
                                    )}

                                    {/* Row 2 / Col 4: BACK TO LIST */}
                                    <button
                                        type="button"
                                        onClick={() => navigate('/deliverynote')}
                                        className="h-full bg-[#f8fafc] hover:bg-slate-100 text-slate-700 border-2 border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                        style={{ borderRadius: '18px' }}
                                    >
                                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700">
                                            <ChevronLeft size={15} />
                                            <span>LIST</span>
                                        </div>
                                        <span className="inline-flex items-center justify-center font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Esc</span>
                                    </button>

                                    {/* Row 2 / Col: DELETE — only in read mode, draft */}
                                    {!isEditing && form.docstatus === 0 && allowedActions.includes('delete') && form.name && (
                                        <button
                                            type="button"
                                            onClick={() => handleDocAction('delete')}
                                            disabled={saving}
                                            className="h-full bg-[#fef2f2] hover:bg-[#fee2e2] text-[#ef4444] border-2 border-[#fca5a5] rounded-xl px-3 py-2 flex items-center justify-between transition-all active:scale-95 shadow-xs cursor-pointer"
                                            style={{ borderRadius: '18px' }}
                                        >
                                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#ef4444]">
                                                <Trash2 size={15} />
                                                <span>DELETE</span>
                                            </div>
                                        </button>
                                    )}

                                </div>
                            </div>

                            {/* TOTALS CARD (RIGHT SIDE, col-span-5) */}
                            <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    {/* Tax Template Selection */}
                                    <div className="flex flex-col items-start">
                                        <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">TAX TEMPLATE</span>
                                        <select
                                            value={form.taxes_and_charges || ''}
                                            disabled={isViewOnly}
                                            onChange={(e) => applyTaxTemplate(e.target.value)}
                                            className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer p-0 m-0 border-none"
                                        >
                                            <option value="">No Tax Schedule...</option>
                                            {taxTemplates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    {/* Total Qty Display */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-500">TOTAL QTY:</span>
                                        <span className="text-sm font-black text-slate-900">{(form.total_qty || form.items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0)).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Subtotal, Tax and Grand Total */}
                                <div className="flex items-end justify-between gap-3 pt-1">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase text-slate-400">SUBTOTAL</span>
                                            <span className="text-slate-800 font-bold text-sm">{getCurrencySymbol()} {(form.base_total || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase text-slate-400">TAX</span>
                                            <span className="text-slate-650 font-bold text-sm">{getCurrencySymbol()} {(form.total_taxes_and_charges || 0).toFixed(2)}</span>
                                        </div>
                                        {form.discount_amount > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold uppercase text-rose-500">DISCOUNT</span>
                                                <span className="text-rose-650 font-bold text-sm">-{getCurrencySymbol()} {form.discount_amount.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end font-sans">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GRAND TOTAL</span>
                                        <span className="text-2xl font-black text-emerald-600 leading-none flex items-center gap-0.5 mt-0.5">
                                            {getCurrencySymbol()} {(form.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* STATUS BAR FOOTER */}
                    <div className="bg-white border-t border-slate-100 px-4 py-1 text-[10px] text-slate-400 flex items-center gap-5 flex-shrink-0 mt-3" style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold uppercase">Items:</span>
                            <span className="font-bold text-slate-850">{form.items.filter(it => it.item_code).length}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold uppercase">Customer:</span>
                            <span className="font-bold text-emerald-600">{form.customer_name || form.customer || 'Not Selected'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold uppercase">Branch:</span>
                            <span className="font-bold text-emerald-600">{form.set_warehouse || warehouse || 'No Branch'}</span>
                        </div>

                        {/* Theme Toggle Button */}
                        <div className="ml-auto flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDnTheme(prev => prev === 'legacy' ? 'modern' : 'legacy')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '2px 8px',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '6px',
                                    fontSize: '9px', fontWeight: 900,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    textTransform: 'uppercase'
                                }}
                                title="Switch UI Theme"
                            >
                                <Palette size={10} />
                                <span>THEME: {(dnTheme || 'legacy').toUpperCase()}</span>
                            </button>

                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            <span className="font-bold text-slate-400 opacity-60">READY · SYSTEM OK</span>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="so-page">
            {/* 1. Premium Keyboard Shortcuts Guide Banner — Matching POS Classic Theme */}
            <div className="so-shortcut-guide-banner">
                <div className="so-shortcut-banner-title">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span>Quick Actions</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</span>
                    <span className="so-shortcut-label">Customer</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'itemSearch', 'F3')}</span>
                    <span className="so-shortcut-label">Search</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'barcode', 'F4')}</span>
                    <span className="so-shortcut-label">Barcode</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'bulkQty', 'F6')}</span>
                    <span className="so-shortcut-label">Bulk Qty</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'uom', 'F8')}</span>
                    <span className="so-shortcut-label">UOM Toggle</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut("doc_editor", "addRowAlt", "Alt+A")}</span>
                    <span className="so-shortcut-label">Add Row</span>
                </div>
                <div className="so-shortcut-badge emerald">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'saveDraft', 'F7')}</span>
                    <span className="so-shortcut-label">Save Draft</span>
                </div>
                <div className="so-shortcut-badge emerald">
                    <span className="so-shortcut-key">{getShortcut("doc_editor", "submitAlt", "Ctrl+Enter")} / {getShortcut('doc_editor', 'submit', 'F12')}</span>
                    <span className="so-shortcut-label">Submit</span>
                </div>
                <div className="so-shortcut-badge slate">
                    <span className="so-shortcut-key">Shift+F3</span>
                    <span className="so-shortcut-label">Focus Table</span>
                </div>
                <div className="so-shortcut-badge rose">
                    <span className="so-shortcut-key">Escape</span>
                    <span className="so-shortcut-label">Close</span>
                </div>
            </div>

            {/* 2. Page Header */}
            <div className="so-page-header">
                <div>
                    <h1 className="so-page-title">
                        <Package size={20} />
                        {isNew ? 'Create Delivery Note' : (isEditing ? 'Modify Delivery Note' : form.name)}
                    </h1>
                    <p className="so-page-subtitle">
                        {isNew ? 'New delivery orchestration' : `Customer: ${form.customer_name || 'Individual Partner'}`}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={() => setDnTheme(isGreen ? 'blue' : 'green')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                            fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={13} />
                        {dnTheme.toUpperCase()}
                    </button>

                    {isEditing ? (
                        <>
                            <button
                                onClick={() => isNew ? navigate('/deliverynote') : setIsViewOnly(true)}
                                className="so-btn-secondary"
                            >
                                <X size={16} /> Discard
                            </button>
                            {(form.docstatus === 0 || isNew) && (
                                <button
                                    onClick={() => handleDocAction('save')}
                                    disabled={saving}
                                    className="so-btn-primary"
                                >
                                    {saving ? <Loader2 size={16} className="so-spinner" /> : <Save size={16} />} Save Draft
                                </button>
                            )}
                            {!isNew && form.docstatus === 0 && (
                                <button
                                    onClick={() => handleDocAction('submit')}
                                    disabled={saving}
                                    className="so-btn-primary"
                                    style={{ background: '#10b981', borderColor: '#10b981' }}
                                >
                                    {saving ? <Loader2 size={16} className="so-spinner" /> : <CheckCircle2 size={16} />} Submit Delivery
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {form.docstatus === 0 && (
                                <>
                                    <button
                                        onClick={() => setIsViewOnly(false)}
                                        className="so-btn-primary"
                                    >
                                        <Edit3 size={16} /> Modify Detail
                                    </button>
                                    {allowedActions.includes('submit') && form.name && (
                                        <button
                                            onClick={() => handleDocAction('submit')}
                                            disabled={saving}
                                            className="so-btn-primary"
                                            style={{ background: '#10b981', borderColor: '#10b981' }}
                                        >
                                            {saving ? <Loader2 size={16} className="so-spinner" /> : <CheckCircle2 size={16} />} Submit Delivery
                                        </button>
                                    )}
                                    {allowedActions.includes('delete') && form.name && (
                                        <button
                                            onClick={() => handleDocAction('delete')}
                                            disabled={saving}
                                            className="so-btn-danger"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    )}
                                </>
                            )}
                            {form.docstatus === 1 && (
                                <>
                                    {allowedActions.includes('cancel') && (
                                        <button
                                            onClick={() => handleDocAction('cancel')}
                                            disabled={saving}
                                            className="so-btn-danger"
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                        >
                                            <X size={16} /> Cancel DN
                                        </button>
                                    )}
                                </>
                            )}
                            {form.name && (
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
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-extrabold">Create & Connections</span>
                                            </div>

                                            {/* Primary Workflow Actions */}
                                            {form.docstatus === 1 && (
                                                <div className="flex flex-col gap-2 mb-4">
                                                    {(form.per_billed || 0) < 99.9 && (
                                                        <button
                                                            onClick={() => {
                                                                setShowCreateDropdown(false);
                                                                handleCreateInvoice();
                                                            }}
                                                            className="w-full flex items-center justify-center gap-2 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Create Sales Invoice
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Connected Docs */}
                                            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                                                {Object.keys(connections).some(dt => (connections[dt] || []).length > 0) ? (
                                                    Object.entries(connections)
                                                        .filter(([dt, links]) => links && links.length > 0)
                                                        .map(([dt, links]) => (
                                                            <div key={dt} className="flex flex-col gap-1.5 text-left">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight text-slate-400">{dt}</span>
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
                                                        <p className="text-[9px] font-bold text-slate-400 italic text-slate-400 font-semibold">No connections yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {form.docstatus === 2 && allowedActions.includes('amend') && (
                                <button
                                    onClick={() => handleDocAction('amend')}
                                    disabled={saving}
                                    className="so-btn-primary"
                                    style={{ background: '#0ea5e9', borderColor: '#0ea5e9' }}
                                >
                                    <Edit3 size={16} /> Amend DN
                                </button>
                            )}
                            <button
                                onClick={() => window.print()}
                                style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.55rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Print Document"
                            >
                                <Printer size={16} />
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => navigate('/deliverynote')}
                        className="so-btn-secondary"
                        style={{ color: '#475569' }}
                    >
                        Back
                    </button>
                </div>
            </div>

            {/* Premium Keyboard Shortcuts Guide Banner */}
            <div className="so-shortcut-guide-banner">
                <div className="so-shortcut-banner-title">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span>Quick Actions</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'customerSupplier', 'F2')}</span>
                    <span className="so-shortcut-label">Customer</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'itemSearch', 'F3')}</span>
                    <span className="so-shortcut-label">Item Search</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'barcode', 'F4')}</span>
                    <span className="so-shortcut-label">Barcode</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'bulkQty', 'F6')}</span>
                    <span className="so-shortcut-label">Bulk Qty</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'uom', 'F8')}</span>
                    <span className="so-shortcut-label">Toggle UOM</span>
                </div>
                <div className="so-shortcut-badge emerald">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'saveDraft', 'F7')}</span>
                    <span className="so-shortcut-label">Save Draft</span>
                </div>
                <div className="so-shortcut-badge sky">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'addRow', 'F10')} / {getShortcut("doc_editor", "addRowAlt", "Alt+A")}</span>
                    <span className="so-shortcut-label">Add Row</span>
                </div>
                <div className="so-shortcut-badge violet">
                    <span className="so-shortcut-key">{getShortcut('doc_editor', 'warehouseBranch', 'F9')}</span>
                    <span className="so-shortcut-label">Branch</span>
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
            </div>

            {/* 2. Main Page Layout */}
            <div className="so-layout">
                <div className="so-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <AttachmentSection doctype="Delivery Note" docname={isNew ? null : form.name} compact={true} />
                    {isEditing ? (
                        /* PREMIUM DELIVERY NOTE EDIT FORM */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }} className="animate-in fade-in duration-300">

                            {/* Basic Info Card */}
                            <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                                    <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Basic Delivery Context</h5>
                                </div>
                                <div style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Naming Series *</label>
                                            <select
                                                className="so-select"
                                                disabled={form.name}
                                                value={form.naming_series}
                                                onChange={e => setForm(prev => ({ ...prev, naming_series: e.target.value }))}
                                                style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                            >
                                                {namingSeriesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Target Customer *</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    ref={customerInputRef}
                                                    className="so-input"
                                                    type="text"
                                                    placeholder="Search Customer..."
                                                    value={customerQuery || form.customer_name || ''}
                                                    onChange={e => {
                                                        setCustomerQuery(e.target.value);
                                                        setShowCustomerDropdown(true);
                                                        setCustomerSelectedIndex(-1);
                                                    }}
                                                    onFocus={() => setShowCustomerDropdown(true)}
                                                    onKeyDown={e => {
                                                        if (!showCustomerDropdown) return;
                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            setCustomerSelectedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
                                                        } else if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            setCustomerSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
                                                        } else if (e.key === 'Enter') {
                                                            if (customerSelectedIndex >= 0 && filteredCustomers[customerSelectedIndex]) {
                                                                e.preventDefault();
                                                                const c = filteredCustomers[customerSelectedIndex];
                                                                setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                setCustomerQuery(c.customer_name);
                                                                setShowCustomerDropdown(false);
                                                                setCustomerSelectedIndex(-1);
                                                            }
                                                        } else if (e.key === 'Escape') {
                                                            setShowCustomerDropdown(false);
                                                            setCustomerSelectedIndex(-1);
                                                        }
                                                    }}
                                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                                />
                                                {showCustomerDropdown && (
                                                    <CustomerDropdown
                                                        targetRef={customerInputRef}
                                                        customers={filteredCustomers}
                                                        selectedIndex={customerSelectedIndex}
                                                        setSelectedIndex={setCustomerSelectedIndex}
                                                        onSelect={(c) => {
                                                            setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                            setCustomerQuery(c.customer_name);
                                                            setShowCustomerDropdown(false);
                                                            setCustomerSelectedIndex(-1);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Branch / Warehouse *</label>
                                            {isAdmin ? (
                                                <select
                                                    className="so-select"
                                                    value={form.set_warehouse}
                                                    onChange={e => {
                                                        const wh = e.target.value;
                                                        setForm(prev => ({
                                                            ...prev,
                                                            set_warehouse: wh,
                                                            items: prev.items.map(item => ({ ...item, warehouse: wh }))
                                                        }));
                                                    }}
                                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                                >
                                                    <option value="">Select Branch</option>
                                                    {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                                </select>
                                            ) : (
                                                <div style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', background: '#f8fafc', fontWeight: 800, fontSize: '0.8rem', color: '#334155' }}>
                                                    {(form.set_warehouse || loggedWarehouse || 'Main Warehouse').split(' - ')[0]}
                                                </div>
                                            )}
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Posting Date *</label>
                                            <input
                                                className="so-input"
                                                type="date"
                                                value={form.posting_date}
                                                onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))}
                                                style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Barcode Area */}
                            <div style={{ background: isGreen ? '#f0fdf4' : '#f0f9ff', border: `2px dashed ${themeColor}`, borderRadius: '0.75rem', padding: '1.25rem' }}>
                                <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', gap: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <ScanLine size={20} style={{ color: themeColor }} />
                                    <input
                                        ref={barcodeRef}
                                        type="text"
                                        placeholder="Scan Barcode SKU / Supplier Code directly here..."
                                        value={barcodeInput}
                                        onChange={e => setBarcodeInput(e.target.value)}
                                        onKeyDown={handleBarcodeSearch}
                                        onFocus={() => setIsInputFocused(true)}
                                        onBlur={() => setIsInputFocused(false)}
                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}
                                    />
                                    {barcodeInput.trim() && (
                                        <button
                                            onClick={() => handleBarcodeSearchDirect(barcodeInput.trim())}
                                            style={{ padding: '0.4rem 1rem', background: themeColor, color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            Add
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items Card */}
                            <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Matrix Items</h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowColConfig(true)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Column Configuration"
                                        >
                                            <Settings size={15} style={{ color: '#94a3b8' }} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowCamera(true)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Camera Barcode Scanner"
                                        >
                                            <Camera size={15} style={{ color: '#94a3b8' }} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={addItemRow}
                                        className="px-4 py-2 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all active:scale-95 duration-150"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        <Plus size={14} /> Add Row
                                    </button>
                                </div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }} className="so-table">
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                {(() => {
                                                    const hasAnyBox = form.items.some(i => i.use_box_entry);
                                                    const activeCols = dnColumns.filter(c => {
                                                        if (!c.visible) return false;
                                                        if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                                        return true;
                                                    });
                                                    /* align map for is_tax_inclusive */

                                                    return activeCols.map(col => {
                                                        let finalLabel = col.label;

                                                        if (!hasAnyBox) {
                                                            if (col.id === 'custom_box_qty') finalLabel = 'Qty Delivered';
                                                            if (col.id === 'custom_box_price') finalLabel = 'Price';
                                                            if (col.id === 'custom_pieces_per_box') finalLabel = '';
                                                        }

                                                        const colW = col.width ? (typeof col.width === 'number' || !col.width.includes('px') ? `${parseInt(col.width)}px` : col.width) : '100px';
                                                        const isDraggingThis = draggedColId === col.id;
                                                        const isDragOverThis = dragOverColId === col.id;

                                                        let alignStyle = { padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', width: colW, minWidth: colW, maxWidth: colW };
                                                        if (['item_code', 'uom'].includes(col.id)) {
                                                            alignStyle.textAlign = 'left';
                                                        } else if (['custom_box_qty', 'qty', 'custom_pieces_per_box', 'is_tax_inclusive'].includes(col.id)) {
                                                            alignStyle.textAlign = 'center';
                                                        } else if (['custom_box_price', 'rate', 'amount'].includes(col.id)) {
                                                            alignStyle.textAlign = 'right';
                                                        }

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
                                                                style={alignStyle}
                                                            >
                                                                <span className="truncate block pointer-events-none">{finalLabel}</span>
                                                                <div
                                                                    onMouseDown={(e) => handleResizeMouseDown(e, col.id)}
                                                                    className={`absolute top-0 right-0 w-2 h-full cursor-col-resize z-20 hover:bg-emerald-500/40 transition-colors ${resizingCol === col.id ? 'bg-emerald-600' : ''}`}
                                                                    style={{ touchAction: 'none' }}
                                                                    title="Drag to resize column"
                                                                />
                                                            </th>
                                                        );
                                                    });
                                                })()}
                                                <th style={{ width: '60px', minWidth: '60px', padding: '0.75rem 1rem' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                                                        No items added. Click "Add Row" or scan barcode above.
                                                    </td>
                                                </tr>
                                            ) : (
                                                form.items.map((item, idx) => (
                                                    <tr key={idx} data-row-index={idx} tabIndex="-1" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        {(() => {
                                                            const hasAnyBox = form.items.some(i => i.use_box_entry);
                                                            const activeCols = dnColumns.filter(c => {
                                                                if (!c.visible) return false;
                                                                if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                                                return true;
                                                            });
                                                            /* row-level activeCols for modern theme */

                                                            return activeCols.map(col => {
                                                                switch (col.id) {
                                                                    case 'item_code':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <CustomSearchDropdown
                                                                                    placeholder="Search item..."
                                                                                    value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                                                    onSelect={(it) => {
                                                                                        if (it) selectItem(idx, it);
                                                                                    }}
                                                                                    fetchData={async (q) => {
                                                                                        const activeWh = form.set_warehouse || loggedWarehouse || localStorage.getItem('warehouse') || '';
                                                                                        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_so', {
                                                                                            params: { query: q, warehouse: activeWh },
                                                                                            withCredentials: true
                                                                                        });
                                                                                        return res.data?.message || [];
                                                                                    }}
                                                                                    createOption={(query) => {
                                                                                        setQuickItemInitialCode(query || '');
                                                                                        setQuickItemTargetRow(idx);
                                                                                        setShowQuickItemModal(true);
                                                                                    }}
                                                                                    themeColor={themeColor}
                                                                                    optionsLabel="item_name"
                                                                                    globalSearch={true}
                                                                                    onGlobalSearch={async (query) => {
                                                                                        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.find_item_globally_retail', {
                                                                                            params: { search_term: query },
                                                                                            withCredentials: true
                                                                                        });
                                                                                        return res.data?.message?.data || res.data?.message || [];
                                                                                    }}
                                                                                    onActivate={async (it) => {
                                                                                        const targetWh = form.set_warehouse || loggedWarehouse || localStorage.getItem('warehouse');
                                                                                        const res = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.enable_item_for_branch_retail', {
                                                                                            item_code: it.name || it.item_code,
                                                                                            warehouse: targetWh
                                                                                        }, { withCredentials: true });
                                                                                        if (res.data?.message?.success || res.data?.success) {
                                                                                        Swal.fire({ icon: 'success', title: 'Item Linked', text: 'Linked to branch!', timer: 1500, showConfirmButton: false });
                                                                                        selectItem(idx, it);
                                                                                        return true;
                                                                                    }
                                                                                    return false;
                                                                                }}
                                                                            />
                                                                        </td>
                                                                        );

                                                                    case 'item_name':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <input
                                                                                    className="so-td-input"
                                                                                    style={{ fontWeight: 600, color: '#334155', padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
                                                                                    type="text"
                                                                                    placeholder="Item Name..."
                                                                                    value={item.item_name || ''}
                                                                                    onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                                                                                />
                                                                            </td>
                                                                        );

                                                                    case 'custom_box_qty':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                                                    <input
                                                                                        className="so-td-input"
                                                                                        style={{ textAlign: 'center', fontWeight: 'bold', color: item.use_box_entry ? '#0284c7' : '#334155', padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        name={item.use_box_entry ? "custom_box_qty" : "qty"}
                                                                                        value={item.use_box_entry ? (item.custom_box_qty || '') : (item.qty || '')}
                                                                                        onChange={(e) => handleInputChangeDetails(e, idx)}
                                                                                        onFocus={(e) => e.target.select()}
                                                                                    />
                                                                                    {item.item_code && (
                                                                                        <span style={{
                                                                                            position: 'absolute', right: '6px', fontSize: '8px', fontWeight: 'extrabold',
                                                                                            color: item.use_box_entry ? '#0284c7' : '#64748b',
                                                                                            background: item.use_box_entry ? 'rgba(2, 132, 199, 0.08)' : '#f8fafc',
                                                                                            border: `1px solid ${item.use_box_entry ? 'rgba(2, 132, 199, 0.15)' : '#e2e8f0'}`,
                                                                                            borderRadius: '3px', padding: '1px 3px', pointerEvents: 'none'
                                                                                        }}>
                                                                                            {item.use_box_entry ? 'BOX' : 'NOS'}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    case 'uom':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <select
                                                                                    className="so-td-input"
                                                                                    value={item.uom || 'Nos'}
                                                                                    onChange={e => handleUOMChangeDetails(e.target.value, idx)}
                                                                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
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
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                {item.use_box_entry ? (
                                                                                    <input
                                                                                        className="so-td-input"
                                                                                        style={{ textAlign: 'center', padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        name="custom_pieces_per_box"
                                                                                        value={item.custom_pieces_per_box || ''}
                                                                                        onChange={(e) => handleInputChangeDetails(e, idx)}
                                                                                        onFocus={(e) => e.target.select()}
                                                                                    />
                                                                                ) : (
                                                                                    <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.3 }}>—</div>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    case 'custom_box_price':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                {item.use_box_entry ? (
                                                                                    <input
                                                                                        className="so-td-input"
                                                                                        style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
                                                                                        type="text"
                                                                                        inputMode="decimal"
                                                                                        name="custom_box_price"
                                                                                        value={item.custom_box_price || ''}
                                                                                        onChange={(e) => handleInputChangeDetails(e, idx)}
                                                                                        onFocus={(e) => e.target.select()}
                                                                                    />
                                                                                ) : (
                                                                                    <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.3 }}>—</div>
                                                                                )}
                                                                            </td>
                                                                        );
                                                                    case 'rate':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <input
                                                                                    className="so-td-input"
                                                                                    style={{ textAlign: 'right', fontWeight: 'bold', padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none' }}
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    name="rate"
                                                                                    value={item.rate || ''}
                                                                                    onChange={(e) => handleInputChangeDetails(e, idx)}
                                                                                    onFocus={(e) => e.target.select()}
                                                                                />
                                                                            </td>
                                                                        );

                                                                    case 'is_tax_inclusive':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                                                <select
                                                                                    className="so-td-input"
                                                                                    value={item.is_tax_inclusive !== false ? 'Inclusive' : 'Exclusive'}
                                                                                    onChange={e => {
                                                                                        const val = e.target.value === 'Inclusive';
                                                                                        setForm(prev => {
                                                                                            const items = [...prev.items];
                                                                                            items[idx] = { ...items[idx], is_tax_inclusive: val };
                                                                                            return recalcForm({ ...prev, items });
                                                                                        });
                                                                                    }}
                                                                                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', outline: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                                                                >
                                                                                    <option value="Inclusive">Inclusive</option>
                                                                                    <option value="Exclusive">Exclusive</option>
                                                                                </select>
                                                                            </td>
                                                                        );

                                                                    case 'qty':
                                                                        return (
                                                                            <td key={col.id} style={{ padding: '0.5rem 0.75rem' }}>
                                                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                                                    <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', height: '36px', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                                                                                        {item.qty || 0}
                                                                                    </div>
                                                                                    {item.use_box_entry && (
                                                                                        <span style={{
                                                                                            position: 'absolute', right: '8px', fontSize: '8px', fontWeight: 'extrabold',
                                                                                            color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0',
                                                                                            borderRadius: '3px', padding: '1px 3px', pointerEvents: 'none'
                                                                                        }}>
                                                                                            NOS
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    case 'amount':
                                                                        return (
                                                                            <td key={col.id} style={{ textAlign: 'right', fontWeight: 700, padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>
                                                                                {getCurrencySymbol()}{(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </td>
                                                                        );
                                                                    default:
                                                                        return null;
                                                                }
                                                            });
                                                        })()}
                                                        <td style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                                                            <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}>
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Discounts & Taxes Card */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #cbd5e1' }}>
                                        <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discounts & Allowances</h5>
                                    </div>
                                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Apply Discount On</label>
                                            <select
                                                className="so-select"
                                                value={form.apply_discount_on}
                                                onChange={e => setForm(prev => ({ ...prev, apply_discount_on: e.target.value }))}
                                                style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                            >
                                                <option value="Grand Total">Grand Total</option>
                                                <option value="Net Total">Net Total</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                            <div className="so-field">
                                                <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Discount %</label>
                                                <input
                                                    className="so-input"
                                                    type="number"
                                                    value={form.additional_discount_percentage}
                                                    onChange={e => setForm(prev => ({ ...prev, additional_discount_percentage: parseFloat(e.target.value) || 0, discount_amount: 0 }))}
                                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                                />
                                            </div>
                                            <div className="so-field">
                                                <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Discount Amount</label>
                                                <input
                                                    className="so-input"
                                                    type="number"
                                                    value={form.discount_amount}
                                                    onChange={e => setForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0, additional_discount_percentage: 0 }))}
                                                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #cbd5e1' }}>
                                        <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Taxes & Template</h5>
                                    </div>
                                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="so-field">
                                            <label className="so-label" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Tax Template</label>
                                            <select
                                                className="so-select"
                                                value={form.taxes_and_charges || ''}
                                                onChange={e => applyTaxTemplate(e.target.value)}
                                                style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', outline: 'none' }}
                                            >
                                                <option value="">No Tax Template Applied</option>
                                                {taxTemplates.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {form.taxes.length > 0 && (
                                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {form.taxes.map((t, idx) => (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                                        <span style={{ color: '#64748b', fontWeight: 600 }}>{t.account_head} ({t.rate}%)</span>
                                                        <span style={{ fontWeight: 700, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                            {getCurrencySymbol()}{((t.rate / 100) * form.base_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Bar */}
                            <div className="so-summary-bar" style={{ alignSelf: 'flex-end', minWidth: '350px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="so-summary-item" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="so-summary-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Base Total</span>
                                    <span className="so-summary-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '1rem', fontWeight: 700, color: '#334155' }}>{getCurrencySymbol()}{form.base_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="so-summary-divider" style={{ width: '1px', height: '30px', background: '#e2e8f0' }} />
                                <div className="so-summary-item" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                                    <span className="so-summary-label" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Net Payable</span>
                                    <span className="so-summary-value grand" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '1.4rem', fontWeight: 900, color: themeColor }}>{getCurrencySymbol()}{form.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    ) : (            /* GORGEOUS DELIVERY NOTE DETAILS VIEW */
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-in fade-in duration-300">

                            {/* Header Summary Cards */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                                <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <div>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Grand Total</span>
                                        <h3 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0.25rem 0 0", color: themeColor }}>
                                            {getCurrencySymbol()}{form.rounded_total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </h3>
                                    </div>
                                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: themeLight, display: "flex", alignItems: "center", justifyContent: "center", color: themeColor }}>
                                        <FileText size={22} />
                                    </div>
                                </div>

                                <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <div>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Lifecycle Status</span>
                                        <div style={{ marginTop: "0.4rem" }}>
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                                backgroundColor: form.docstatus === 1 ? '#dcfce7' : (form.docstatus === 2 ? '#fee2fee2' : '#fef9c3'),
                                                color: form.docstatus === 1 ? '#156534' : (form.docstatus === 2 ? '#b91c1c' : '#854d0e'),
                                                border: `1px solid ${form.docstatus === 1 ? '#bbf7d0' : (form.docstatus === 2 ? '#fecaca' : '#fef08a')}`
                                            }}>
                                                {form.docstatus === 1 ? 'Submitted' : (form.docstatus === 2 ? 'Cancelled' : 'Draft')}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                                        <Palette size={20} />
                                    </div>
                                </div>

                                <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <div>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Posting Date</span>
                                        <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0.25rem 0 0", color: "#1e293b" }}>
                                            {form.posting_date}
                                        </h3>
                                    </div>
                                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                                        <ChevronRight size={20} />
                                    </div>
                                </div>

                                <div style={{ background: "white", padding: "1.25rem 1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <div>
                                        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Items & Quantity</span>
                                        <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0.25rem 0 0", color: "#1e293b" }}>
                                            {form.items?.length || 0} Items / {form.total_qty || 0} Qty
                                        </h3>
                                    </div>
                                    <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                                        <ChevronLeft size={20} />
                                    </div>
                                </div>
                            </div>

                            {/* Customer & System Detail Cards */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
                                <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                                        Customer details
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Customer Name</span>
                                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.customer_name || "N/A"}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Customer ID</span>
                                            <span style={{ color: "#64748b", fontWeight: 700, fontFamily: "monospace" }}>{form.customer || "N/A"}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Currency</span>
                                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.currency || "AED"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                                        System & Options
                                    </h3>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.875rem" }}>
                                        <div>
                                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Branch / Warehouse</span>
                                            <span style={{ color: themeColor, fontWeight: 700 }}>{form.set_warehouse || "Not Specified"}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Selling Price List</span>
                                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.selling_price_list || "Standard Selling"}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Return Status</span>
                                            <span style={{
                                                color: form.is_return ? "#ef4444" : "#64748b",
                                                fontWeight: 800,
                                                background: form.is_return ? "#fee2e2" : "#f1f5f9",
                                                padding: "0.1rem 0.5rem",
                                                borderRadius: "0.25rem",
                                                fontSize: "0.75rem",
                                                display: "inline-block"
                                            }}>{form.is_return ? "YES" : "NO"}</span>
                                        </div>
                                        {form.return_against && (
                                            <div>
                                                <span style={{ color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>Return Against</span>
                                                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "0.75rem" }}>{form.return_against}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Static Items Table */}
                            <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                                        Delivery Items
                                    </h3>
                                    <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8" }}>{form.items.length} ACTIVE ITEMS</span>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                                        <thead>
                                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                                {(() => {
                                                    const hasAnyBox = form.items.some(i => i.use_box_entry);
                                                    const activeCols = dnColumns.filter(c => {
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

                                                        const colW = col.width ? (typeof col.width === 'number' || !col.width.includes('px') ? `${parseInt(col.width)}px` : col.width) : '100px';

                                                        let alignStyle = { padding: "1rem 1.5rem", fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", width: colW, minWidth: colW, maxWidth: colW };
                                                        if (['item_code', 'uom'].includes(col.id)) {
                                                            alignStyle.textAlign = "left";
                                                        } else if (['custom_box_qty', 'qty', 'custom_pieces_per_box'].includes(col.id)) {
                                                            alignStyle.textAlign = "center";
                                                        } else if (['custom_box_price', 'rate', 'amount'].includes(col.id)) {
                                                            alignStyle.textAlign = "right";
                                                        }

                                                        return (
                                                            <th key={col.id} style={alignStyle}>
                                                                {finalLabel}
                                                            </th>
                                                        );
                                                    });
                                                })()}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.map((i, idx) => (
                                                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                    {(() => {
                                                        const hasAnyBox = form.items.some(item => item.use_box_entry);
                                                        const activeCols = dnColumns.filter(c => {
                                                            if (!c.visible) return false;
                                                            if (!hasAnyBox && ['custom_pieces_per_box', 'custom_box_price', 'qty'].includes(c.id)) return false;
                                                            return true;
                                                        });

                                                        return activeCols.map(col => {
                                                            const baseTdStyle = { padding: "1rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#334155" };
                                                            switch (col.id) {
                                                                case 'item_code':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "left" }}>
                                                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{i.item_code}</div>
                                                                            <div style={{ fontSize: '0.7rem', color: themeColor, fontWeight: 800, marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{i.item_name}</div>
                                                                        </td>
                                                                    );

                                                                case 'custom_box_qty':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "center" }}>
                                                                            {i.use_box_entry ? `${i.custom_box_qty} Box` : `${i.qty} Nos`}
                                                                        </td>
                                                                    );
                                                                case 'uom':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "left", color: "#64748b", fontSize: "0.75rem" }}>
                                                                            {i.use_box_entry ? 'Box' : (i.uom || 'Nos')}
                                                                        </td>
                                                                    );
                                                                case 'custom_pieces_per_box':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "center" }}>
                                                                            {i.use_box_entry ? i.custom_pieces_per_box : '—'}
                                                                        </td>
                                                                    );
                                                                case 'custom_box_price':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "right" }}>
                                                                            {i.use_box_entry ? `${getCurrencySymbol()}${parseFloat(i.custom_box_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : '—'}
                                                                        </td>
                                                                    );
                                                                case 'rate':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "right" }}>
                                                                            {getCurrencySymbol()}{parseFloat(i.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                                                        </td>
                                                                    );

                                                                case 'qty':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "center", fontWeight: 800 }}>
                                                                            {i.qty} Nos
                                                                        </td>
                                                                    );
                                                                case 'amount':
                                                                    return (
                                                                        <td key={col.id} style={{ ...baseTdStyle, textAlign: "right", fontWeight: 800, color: "#1e293b" }}>
                                                                            {getCurrencySymbol()}{parseFloat(i.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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

                            {/* Bottom Row Details Grid (Taxes, Linked Docs, Gradient Summary) */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem", alignItems: "stretch" }}>

                                {/* Taxes & Charges */}
                                <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                                        Taxes & Charges
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, justifyContent: "center" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                                            <span style={{ color: "#94a3b8", fontWeight: 600 }}>Tax Template</span>
                                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{form.taxes_and_charges || "No Tax Applied"}</span>
                                        </div>
                                        {form.taxes?.map((t, idx) => (
                                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: "1px dashed #f1f5f9", paddingTop: "0.5rem" }}>
                                                <span style={{ color: "#64748b", fontWeight: 600 }}>{t.account_head || "Tax Account"} ({t.rate || 0}%)</span>
                                                <span style={{ color: "#1e293b", fontWeight: 700 }}>{getCurrencySymbol()}{(t.tax_amount || (form.base_total * (parseFloat(t.rate) || 0) / 100))?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Linked Documents */}
                                <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e2e8f0", padding: "1.5rem", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                                    <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ width: "4px", height: "14px", borderRadius: "2px", background: themeColor, display: "inline-block" }}></span>
                                        Linked Documents
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1, justifyContent: "center" }}>
                                        <div>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>Linked Sales Orders</span>
                                            {linkedSalesOrders.length > 0 ? (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                                    {linkedSalesOrders.map(so => (
                                                        <span key={so} className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm cursor-pointer hover:bg-emerald-100 transition-all duration-150">
                                                            {so}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>No linked Sales Orders</span>
                                            )}
                                        </div>

                                        <div style={{ borderTop: "1px dashed #f1f5f9", paddingTop: "0.75rem" }}>
                                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>Linked Sales Invoices</span>
                                            {linkedSalesInvoices.length > 0 ? (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                                    {linkedSalesInvoices.map(si => (
                                                        <span key={si} className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-sky-50 text-sky-600 border-sky-100 shadow-sm cursor-pointer hover:bg-sky-100 transition-all duration-150">
                                                            {si}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>No linked Sales Invoices</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Final Summary Card with Gradient */}
                                <div style={{ borderRadius: "0.75rem", background: isGreen ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)" : "linear-gradient(135deg, #0c4a6e 0%, #075985 100%)", color: "white", padding: "1.5rem", display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
                                    <p style={{ color: "white", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.75rem", marginBottom: "1rem", fontWeight: 800, textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Final Summary</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9, fontSize: "0.875rem" }}>
                                            <span>Subtotal</span>
                                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.base_total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.9, fontSize: "0.875rem" }}>
                                            <span>Taxes</span>
                                            <span style={{ fontWeight: 700 }}>{getCurrencySymbol()}{form.total_taxes_and_charges?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "1rem", fontWeight: 700 }}>Grand Total</span>
                                            <span style={{ fontSize: "1.8rem", fontWeight: 900 }}>{getCurrencySymbol()}{form.rounded_total?.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCamera && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: 0 }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '0.5rem', background: '#e0f2fe', color: '#0284c7', borderRadius: '0.5rem', display: 'flex', alignItems: 'center' }}>
                                    <Camera size={20} />
                                </div>
                                <span style={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.85rem' }}>Delivery Note Camera Scanner</span>
                            </div>
                            <button onClick={() => setShowCamera(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ position: 'relative', aspectRatio: '1.77778', borderRadius: '1rem', overflow: 'hidden', background: '#0f172a' }}>
                                <div id="dndetails-scanner-reader" style={{ width: '100%', height: '100%' }}></div>
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
                config={dnColumns}
                onUpdate={(newConfig) => {
                    if (newConfig === null) {
                        setDnColumns(DEFAULT_DN_COLUMNS);
                        localStorage.removeItem('delivery_matrix_config');
                    } else {
                        setDnColumns(newConfig);
                        localStorage.setItem('delivery_matrix_config', JSON.stringify(newConfig));
                    }
                    setShowColConfig(false);
                }}
                doctype="Delivery Note"
                themeColor={themeColor}
            />

            {/* Quick Item Creation Modal */}
            <QuickItemCreateModal
                isOpen={showQuickItemModal}
                onClose={() => {
                    setShowQuickItemModal(false);
                    setQuickItemInitialCode('');
                    setQuickItemTargetRow(null);
                }}
                initialItemCode={quickItemInitialCode}
                initialItemName={quickItemInitialCode}
                warehouse={form.set_warehouse || loggedWarehouse || localStorage.getItem('warehouse')}
                onItemCreated={(createdItem) => {
                    if (quickItemTargetRow !== null && quickItemTargetRow >= 0) {
                        selectItem(quickItemTargetRow, createdItem);
                    }
                }}
            />
        </div>
    );
};

export default DeliveryNoteDetails;
