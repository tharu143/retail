import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    ShoppingCart, Package, MapPin, Phone, Mail, ChevronLeft, Loader2,
    AlertCircle, Globe, Tag, Receipt, Layers, CreditCard,
    ArrowRight, Settings, Edit2, Save, X, CheckCircle2, Clock,
    Plus, Search, ScanLine, Trash2, Calendar, User, FileText, Info, Palette, Camera
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import './SalesOrder.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';

const DEFAULT_SO_COLUMNS = [
    { id: 'item_code', label: 'Item Code', visible: true, width: 120 },
    { id: 'custom_ref_sl_no', label: 'Ref / Customer SL #', visible: true, width: 120 },
    { id: 'custom_box_qty', label: 'Box Qty', visible: true, width: 90 },
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


/* ==================== CORE LOGIC ==================== */
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

const emptyForm = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
        naming_series: 'SAL-ORD-.YYYY.-',
        transaction_date: today,
        delivery_date: '',
        customer: '',
        customer_name: '',
        order_type: 'Sales',
        po_no: '',
        po_date: today,
        company: localStorage.getItem('company') || '',
        set_source_warehouse: localStorage.getItem('warehouse') || '',
        items: [{ ...SOItemModel, delivery_date: today, qty: 1, rate: 0, amount: 0 }],
        taxes: [],
        total_qty: 0,
        base_total: 0,
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounded_total: 0,
        rounding_adjustment: 0,
        status: 'Draft',
        docstatus: 0,
        currency: 'AED',
        selling_price_list: 'Standard Selling'
    };
};

//* ==================== UI HELPERS ==================== */
const StatusBadge = ({ status, themeColor }) => {
    const isCompleted = status === 'Submitted' || status === 'Authorized';
    const isDraft = status === 'Draft' || status === 'Pending Authorization';

    let bg = '#f1f5f9';
    let color = '#64748b';
    let border = '#e2e8f0';

    if (isCompleted) {
        bg = `${themeColor}15`;
        color = themeColor;
        border = `${themeColor}30`;
    } else if (isDraft) {
        bg = '#fffbeb';
        color = '#d97706';
        border = '#fef3c7';
    }

    return (
        <span className="so-badge" style={{ backgroundColor: bg, color: color, border: `1px solid ${border}` }}>
            {status}
        </span>
    );
};

const ConnectionCard = ({ title, links, onTransistion, loadingLinks, themeColor }) => (
    <div className="so-card" style={{ height: '100%' }}>
        <div className="so-card-header">
            <h5 className="so-card-title">{title}</h5>
        </div>
        <div className="so-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {links && links.map((link, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                    >
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{link}</span>
                        <ArrowRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-all" />
                    </div>
                ))}
                {(!links || links.length === 0) && (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f8fafc', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle size={24} />
                        </div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No connections detected</p>
                        <button
                            onClick={onTransistion}
                            disabled={loadingLinks}
                            className="so-btn-primary"
                            style={{ fontSize: '0.7rem', padding: '0.4rem 1rem' }}
                        >
                            {loadingLinks ? 'Syncing...' : `Generate ${title.split(' ')[0]}`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
);

export default function SalesOrderDetails() {
    const { name } = useParams();
    const navigate = useNavigate();
    const isNew = name === 'create';

    const { themeColor, themeLight, isGreen, toggleTheme, legacySubTheme } = useLegacyTheme();

    // States
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(isNew);
    const [activeTab, setActiveTab] = useState('Overview');
    const [form, setForm] = useState(emptyForm());
    const [linkedDocs, setLinkedDocs] = useState({});
    const [loadingLinks, setLoadingLinks] = useState(false);

    // Matrix Columns Configuration
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

    // Dropdowns
    const [customers, setCustomers] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [itemSearches, setItemSearches] = useState({});
    const [showItemDropdowns, setShowItemDropdowns] = useState({});
    const [barcodeInput, setBarcodeInput] = useState('');
    const barcodeRef = useRef(null);
    const [showCamera, setShowCamera] = useState(false);
    const html5QrcodeRef = useRef(null);
    const scannerBuffer = useRef("");
    const lastKeyTime = useRef(0);

    // Fetch Initial Data
    useEffect(() => {
        fetchMetadata();
        if (!isNew) {
            fetchOrder();
            fetchLinkedDocs();
        }
    }, [name]);

    const fetchMetadata = async () => {
        try {
            const [custRes, taxRes, whRes] = await Promise.all([
                axios.get('/api/method/kyle_retail.retail_api.api.get_customers_list_so', { withCredentials: true }),
                axios.get('/api/method/kyle_retail.retail_api.api.get_sales_taxes_templates_so', { withCredentials: true }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses', { params: { is_group: 0 }, withCredentials: true })
            ]);
            const templates = (taxRes.data.message || []).filter(t => t.name.toUpperCase().includes('NS'));
            setCustomers(custRes.data.message || []);
            setTaxTemplates(templates);
            setWarehouses(whRes.data.message || []);

            if (isNew && templates.length > 0) {
                const defaultTax = templates.find(t => t.name.toUpperCase().includes('VAT 5% - NS')) ||
                    templates.find(t => t.name.toUpperCase().includes('VAT 5% - KSPL')) ||
                    templates.find(t => t.name.toUpperCase().includes('UAE VAT 5%')) ||
                    templates.find(t => t.name.toUpperCase().includes('VAT 5%')) ||
                    templates.find(t => t.name.toUpperCase().includes('5%'));
                const defaultTaxName = defaultTax ? defaultTax.name : 'UAE VAT 5% - NS';
                try {
                    const encodedVal = encodeURIComponent(defaultTaxName);
                    const res = await axios.get(`/api/resource/Sales Taxes and Charges Template/${encodedVal}`, { withCredentials: true });
                    const rows = (res.data.data?.taxes || []).map(t => ({
                        charge_type: t.charge_type,
                        account_head: t.account_head,
                        description: t.description || t.account_head || 'VAT',
                        rate: t.rate,
                        tax_amount: 0,
                        total: 0
                    }));
                    setForm(prev => recalcForm({
                        ...prev,
                        taxes_and_charges: defaultTaxName,
                        taxes: rows
                    }));
                } catch (err) {
                    console.error('Failed to auto-load default tax template details:', err);
                }
            }
        } catch (err) { console.error(err); }
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/resource/Sales Order/${name}`, { withCredentials: true });
            const d = res.data.data;
            const loadedItems = (d.items || []).map(it => {
                const isBox = (it.uom || '').toLowerCase() === 'box';
                const cf = parseFloat(it.conversion_factor) || parseFloat(it.custom_pieces_per_box) || 1.0;
                
                let custom_box_qty = parseFloat(it.custom_box_qty || 0);
                let custom_pieces_per_box = parseFloat(it.custom_pieces_per_box || cf || 1.0);
                let custom_box_price = parseFloat(it.custom_box_price || 0);
                let qty = parseFloat(it.qty || 0);
                let rate = parseFloat(it.rate || 0);

                if (isBox) {
                    if (!custom_box_qty || custom_box_qty === 0) {
                        custom_box_qty = it.qty || 0;
                    }
                    if (!custom_box_price || custom_box_price === 0) {
                        custom_box_price = it.rate || 0;
                    }
                    qty = custom_box_qty * custom_pieces_per_box;
                    rate = custom_pieces_per_box > 0 ? (custom_box_price / custom_pieces_per_box) : custom_box_price;
                }

                return {
                    ...SOItemModel,
                    ...it,
                    custom_ref_sl_no: it.custom_ref_sl_no || it.custom_supplier_sl_num || '',
                    custom_box_qty: parseFloat(custom_box_qty.toFixed(2)),
                    custom_pieces_per_box: parseFloat(custom_pieces_per_box.toFixed(2)),
                    default_pieces_per_box: parseFloat(custom_pieces_per_box.toFixed(2)),
                    custom_box_price: parseFloat(custom_box_price.toFixed(2)),
                    custom_selling_price: parseFloat(parseFloat(it.custom_selling_price || 0).toFixed(2)),
                    qty: parseFloat(qty.toFixed(2)),
                    rate: parseFloat(rate.toFixed(2)),
                    amount: parseFloat((qty * rate).toFixed(2)),
                    use_box_entry: isBox
                };
            });

            setForm({
                ...d,
                set_source_warehouse: d.set_warehouse || (loadedItems[0] && loadedItems[0].warehouse) || '',
                items: loadedItems,
                taxes: d.taxes || []
            });

            // Async UOM fetch for each item
            loadedItems.forEach((it, idx) => {
                if (it.item_code) {
                    fetchItemUOMs(it.item_code).then(fetchedUoms => {
                        setForm(p => {
                            const its = [...p.items];
                            if (its[idx]) its[idx].uom_list = fetchedUoms;
                            return { ...p, items: its };
                        });
                    });
                }
            });

            setSearchCustomer(d.customer_name || d.customer);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Load Failed', text: 'Could not retrieve Sales Order' });
        } finally {
            setLoading(false);
        }
    };

    const fetchLinkedDocs = async () => {
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_linked_documents', {
                params: { doctype: 'Sales Order', name },
                withCredentials: true
            });
            setLinkedDocs(res.data.message || {});
        } catch (err) { console.error(err); }
    };

    const handleSave = async (submit = false) => {
        if (!form.customer) return Swal.fire('Error', 'Customer is required', 'warning');
        if (!form.items.length) return Swal.fire('Error', 'Add at least one item', 'warning');

        try {
            setSaving(true);
            const payload = {
                ...form,
                set_warehouse: form.set_source_warehouse,
                docstatus: submit ? 1 : 0,
                delivery_date: form.delivery_date || form.transaction_date,
                items: form.items.filter(i => i.item_code).map(i => {
                    const isBox = (i.uom || '').toLowerCase() === 'box';
                    return {
                        ...i,
                        qty: isBox ? (parseFloat(i.custom_box_qty) || 0) : (parseFloat(i.qty) || 0),
                        rate: isBox ? (parseFloat(i.custom_box_price) || 0) : (parseFloat(i.rate) || 0),
                        conversion_factor: isBox ? (parseFloat(i.custom_pieces_per_box) || 1) : 1.0,
                        stock_qty: parseFloat(i.qty) || 0,
                        stock_uom_rate: parseFloat(i.rate) || 0,
                        custom_box_qty: parseFloat(i.custom_box_qty) || 0,
                        custom_pieces_per_box: parseFloat(i.custom_pieces_per_box) || 1,
                        custom_box_price: parseFloat(i.custom_box_price) || 0,
                        delivery_date: i.delivery_date || form.delivery_date || form.transaction_date
                    };
                }),
                taxes: (form.taxes || []).map(t => ({
                    ...t,
                    description: t.description || t.account_head || 'VAT'
                }))
            };

            let res;
            if (isNew) {
                res = await axios.post('/api/resource/Sales Order', payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Order Created', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                navigate(`/salesorder-details/${res.data.data.name}`);
            } else {
                await axios.put(`/api/resource/Sales Order/${name}`, payload, { withCredentials: true });
                Swal.fire({ icon: 'success', title: 'Order Synchronized', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                setIsEditing(false);
                fetchOrder();
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Action Failed', text: err.response?.data?._server_messages || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTransistion = async (type) => {
        try {
            setLoadingLinks(true);
            const endpoint = type === 'Delivery Note' ? 'create_delivery_note_from_so' : 'create_sales_invoice_from_so';
            const res = await axios.post(`/api/method/kyle_retail.retail_api.api.${endpoint}`, {
                so_name: name,
                submit_doc: true
            }, { withCredentials: true });

            if (res.data.message?.status === 'success') {
                Swal.fire({ icon: 'success', title: `${type} Created`, text: res.data.message.name });
                fetchLinkedDocs();
            } else {
                throw new Error(res.data.message?.message || 'Transition failed');
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Transition Failed', text: err.message });
        } finally {
            setLoadingLinks(false);
        }
    };

    // Item Management
    const addItemRow = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { ...SOItemModel, delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 }]
        }));
    };

    const removeItemRow = (idx) => {
        setForm(prev => recalcForm({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
    };

    const searchItems = async (query, idx) => {
        if (!query.trim()) {
            setItemsList([]);
            setShowItemDropdowns(p => ({ ...p, [idx]: false }));
            return;
        }
        try {
            // 1. Try specialized Sales Order search
            let res = await axios.get('/api/method/kyle_retail.retail_api.api.get_items_so', {
                params: { query },
                withCredentials: true
            });

            let items = res.data.message || res.data.data || [];
            if (items.data && Array.isArray(items.data)) items = items.data;

            // 2. Global fallback
            if (!Array.isArray(items) || items.length === 0) {
                const fallback = await axios.post('/api/method/kyle_retail.retail_api.api.find_item_global', {
                    search_term: query || ''
                }, { withCredentials: true });
                items = fallback.data.message?.data || fallback.data.message || [];
            }

            setItemsList(items || []);
            setShowItemDropdowns(p => ({ ...p, [idx]: true }));
        } catch (err) {
            console.error(err);
            setItemsList([]);
        }
    };

    const handleBarcodeSearchDirect = async (val) => {
        if (!val.trim()) return;
        const activeWarehouse = form.set_source_warehouse || localStorage.getItem('warehouse') || '';
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_retail_item_details', {
                params: { search_term: val, warehouse: activeWarehouse },
                withCredentials: true
            });
            const apiItem = (res.data.message || [])[0];

            if (apiItem) {
                let rate = apiItem.price_list_rate || 0;
                try {
                    const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
                        params: {
                            item_code: apiItem.name,
                            price_list: form.selling_price_list || 'Standard Selling'
                        },
                        withCredentials: true
                    });
                    const fetchedRate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || rateRes.data?.rate;
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
                        warehouse: prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
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
                        items.push({ ...SOItemModel, delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 });
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

    const handleBarcodeSearch = async (e) => {
        if (e.key !== 'Enter' || !barcodeInput.trim()) return;
        handleBarcodeSearchDirect(barcodeInput.trim());
    };

    // Camera scanner start/stop logic
    useEffect(() => {
        if (showCamera) {
            const html5Qrcode = new Html5Qrcode("sodetails-scanner-reader");
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

    // Global hardware barcode scanner interceptor
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            const now = Date.now();
            const activeEl = document.activeElement;
            const isInputFocused = activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);

            // Barcode scanner interceptor
            if (now - lastKeyTime.current > 150) {
                scannerBuffer.current = "";
            }
            lastKeyTime.current = now;

            if (e.key.length === 1 && /^[0-9]$/.test(e.key) && !isInputFocused) {
                scannerBuffer.current += e.key;
                return;
            } else if (e.key === 'Enter' && scannerBuffer.current.length >= 6 && !isInputFocused) {
                e.preventDefault();
                const scanValue = scannerBuffer.current;
                scannerBuffer.current = "";
                if (isEditing) {
                    handleBarcodeSearchDirect(scanValue);
                }
                return;
            }

            // Keyboard Shortcuts when editing is active
            if (!isEditing) return;

            const inItemsTable = activeEl && activeEl.closest('table.so-table');
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

            // F2: Focus Customer Search input
            if (e.key === 'F2') {
                e.preventDefault();
                const customerInput = document.querySelector('input[placeholder="Search customer..."]');
                if (customerInput) {
                    customerInput.focus();
                    customerInput.select?.();
                }
            }

            // F3: Focus Item Search input
            if (e.key === 'F3') {
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

            // F4: Focus Barcode/Scan input
            if (e.key === 'F4') {
                e.preventDefault();
                const scanInput = document.querySelector('input[placeholder="Focus here to scan..."]');
                if (scanInput) {
                    scanInput.focus();
                    scanInput.select?.();
                }
            }

            // F6: Bulk Quantity Update popup
            if (e.key === 'F6') {
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

            // F8: Toggle UOM
            if (e.key === 'F8') {
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

            // F7 or Ctrl+S: Save Draft
            if (e.key === 'F7' || (e.ctrlKey && e.key.toLowerCase() === 's')) {
                e.preventDefault();
                if (!saving) {
                    handleSave(false);
                }
            }

            // F10 or Alt+A: Add Item Row
            if (e.key === 'F10' || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
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

            // F9: Focus Source Warehouse Select
            if (e.key === 'F9') {
                e.preventDefault();
                const warehouseSelect = document.querySelector('select[name="set_source_warehouse"]');
                if (warehouseSelect) {
                    warehouseSelect.focus();
                }
            }

            // F12 or Ctrl+Enter: Submit sales order
            if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F12') {
                e.preventDefault();
                if (!saving && !isNew) {
                    handleSave(true);
                }
            }

            // Escape: Close modals/menus or blur active input
            if (e.key === 'Escape') {
                e.preventDefault();
                if (showColConfig) setShowColConfig(false);
                else if (isEditing && isNew) {
                    navigate('/salesorderlist');
                } else if (isEditing) {
                    setIsEditing(false);
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
                            const isLastRow = rowIndex === (form.items || []).length - 1;

                            if (isLastRow) {
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
                    const isSearchInput = activeEl.placeholder === 'SKU or Name...';
                    const isDropdownOpen = document.querySelector('.so-dropdown');
                    if (isSearchInput && isDropdownOpen) return; // Let search dropdown handle it

                    const td = activeEl.closest('td');
                    const tr = activeEl.closest('tr');
                    if (td && tr && tr.parentNode) {
                        e.preventDefault();
                        const colIndex = Array.from(tr.children).indexOf(td);
                        const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
                        const isLastRow = rowIndex === (form.items || []).length - 1;
                        const isRateField = activeEl.name === 'rate' || activeEl.name === 'custom_box_price';

                        if (isRateField) {
                            if (isLastRow) {
                                addItemRow();
                                setTimeout(() => {
                                    const tableBody = tr.parentNode;
                                    const newTr = tableBody.lastElementChild;
                                    if (newTr) {
                                        const firstInput = newTr.querySelector('input[placeholder="SKU or Name..."]');
                                        if (firstInput) {
                                            firstInput.focus();
                                            firstInput.select?.();
                                        }
                                    }
                                }, 50);
                            } else {
                                const nextTr = tr.nextElementSibling;
                                if (nextTr) {
                                    const firstInput = nextTr.querySelector('input[placeholder="SKU or Name..."]');
                                    if (firstInput) {
                                        firstInput.focus();
                                        firstInput.select?.();
                                    }
                                }
                            }
                        } else {
                            if (isLastRow) {
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

            // Escape key inside table input to select/focus the parent row (TR) itself
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

            // Keyboard actions when the row itself is focused
            if (activeEl && activeEl.tagName === 'TR' && activeEl.closest('table.so-table')) {
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
                    const qtyInput = tr.querySelector('input[name="qty"]:not([disabled])') || tr.querySelector('input[name="custom_box_qty"]:not([disabled])');
                    if (qtyInput && activeRowIndex !== -1) {
                        e.preventDefault();
                        const currentVal = parseFloat(qtyInput.value) || 0;
                        const diff = isPlus ? 1 : -1;
                        const newVal = Math.max(0, currentVal + diff);
                        handleInputChangeDetails({ target: { name: qtyInput.name, value: newVal.toString() } }, activeRowIndex);
                    }
                }
            }

            // Arrow Up/Down navigation inside table inputs
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (inItemsTable && activeEl && activeEl.tagName === 'INPUT') {
                    const isSearchInput = activeEl.placeholder === 'SKU or Name...';
                    const isDropdownOpen = document.querySelector('.so-dropdown');
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
                        handleInputChangeDetails({ target: { name: activeEl.name, value: newVal.toString() } }, activeRowIndex);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isEditing, form, saving, showColConfig]);

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
                    warehouse: prev.set_source_warehouse || ''
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
                    items.push({ ...SOItemModel, delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 });
                }

                return recalcForm({ ...prev, items });
            });
        } catch (err) { console.error(err); }
        setShowItemDropdowns(p => ({ ...p, [idx]: false }));
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-gray-50">
            <Loader2 size={40} className="animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Order Artifacts...</p>
        </div>
    );

    return (
        <div className="so-page">
            {/* 1. Page Header */}
            <div className="so-page-header">
                <div>
                    <h1 className="so-page-title">
                        <Package size={20} />
                        {isNew ? 'Create Sales Order' : (isEditing ? 'Edit Sales Order' : name)}
                    </h1>
                    <p className="so-page-subtitle">
                        {isNew ? 'New procurement orchestration' : `Customer: ${form.customer_name || 'Individual Partner'}`}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={toggleTheme}
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
                        {legacySubTheme.toUpperCase()}
                    </button>

                    {isEditing ? (
                        <>
                            <button
                                onClick={() => isNew ? navigate('/salesorderlist') : setIsEditing(false)}
                                className="so-btn-secondary"
                            >
                                <X size={16} /> Discard
                            </button>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={saving}
                                className="so-btn-primary"
                            >
                                {saving ? <Loader2 size={16} className="so-spinner" /> : <Save size={16} />} Save Draft
                            </button>
                            {!isNew && form.docstatus === 0 && (
                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={saving}
                                    className="so-btn-primary"
                                    style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                                >
                                    <CheckCircle2 size={16} /> Submit Order
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {form.docstatus === 0 && (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="so-btn-primary"
                                    >
                                        <Edit2 size={16} /> Modify Detail
                                    </button>
                                    <button
                                        onClick={() => handleSave(true)}
                                        disabled={saving}
                                        className="so-btn-primary"
                                        style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
                                    >
                                        {saving ? <Loader2 size={16} className="so-spinner" /> : <CheckCircle2 size={16} />} Submit Order
                                    </button>
                                </>
                            )}
                            {form.docstatus === 1 && (
                                <>
                                    <button
                                        onClick={() => handleTransistion('Delivery Note')}
                                        disabled={loadingLinks}
                                        className="so-btn-primary"
                                        style={{ background: '#10b981', borderColor: '#10b981' }}
                                    >
                                        {loadingLinks ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Create DN
                                    </button>
                                    <button
                                        onClick={() => handleTransistion('Sales Invoice')}
                                        disabled={loadingLinks}
                                        className="so-btn-primary"
                                        style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                                    >
                                        {loadingLinks ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />} Create Invoice
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="so-layout">
                <div className="so-content">
                    {isEditing ? (
                        /* EDITING / CREATION VIEW */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                            <div className="so-card">
                                <div className="so-card-header">
                                    <h5 className="so-card-title">Order Context & Timeline</h5>
                                </div>
                                <div className="so-card-body">
                                    <div className="so-form-grid">
                                        <div className="so-field">
                                            <label className="so-label">Target Customer *</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    className="so-input"
                                                    type="text"
                                                    value={searchCustomer}
                                                    onChange={(e) => {
                                                        setSearchCustomer(e.target.value);
                                                        setShowCustomerDropdown(true);
                                                    }}
                                                    placeholder="Search customer..."
                                                />
                                                {showCustomerDropdown && (
                                                    <div className="so-dropdown">
                                                        {customers.filter(c => c.customer_name.toLowerCase().includes(searchCustomer.toLowerCase())).map(c => (
                                                            <div key={c.name} onClick={() => {
                                                                setForm({ ...form, customer: c.name, customer_name: c.customer_name });
                                                                setSearchCustomer(c.customer_name);
                                                                setShowCustomerDropdown(false);
                                                            }} className="so-dropdown-item">
                                                                <div className="so-dropdown-item-name">{c.customer_name}</div>
                                                                <div className="so-dropdown-item-code">{c.name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="so-form-grid" style={{ gap: '1rem' }}>
                                            <div className="so-field">
                                                <label className="so-label">Issue Date</label>
                                                <input
                                                    className="so-input"
                                                    type="date"
                                                    value={form.transaction_date}
                                                    onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                                    onChange={e => setForm({ ...form, transaction_date: e.target.value })}
                                                />
                                            </div>
                                            <div className="so-field">
                                                <label className="so-label">Delivery Target</label>
                                                <input
                                                    className="so-input"
                                                    type="date"
                                                    value={form.delivery_date}
                                                    onClick={e => { try { e.target.showPicker(); } catch (err) { } }}
                                                    onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="so-card">
                                <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h5 className="so-card-title">Orchestration Itemized Bill</h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowColConfig(true)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Column Configuration"
                                        >
                                            <Settings size={14} style={{ color: '#94a3b8' }} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                                            <label className="so-label" style={{ marginBottom: '0.25rem', color: themeColor }}>Scan Barcode / SKU</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <div style={{ position: 'relative', flex: 1 }}>
                                                    <input
                                                        className="so-select"
                                                        style={{ height: '2.5rem', fontSize: '0.75rem', fontWeight: 700, paddingRight: '2.5rem', width: '100%' }}
                                                        placeholder="Focus here to scan..."
                                                        ref={barcodeRef}
                                                        value={barcodeInput}
                                                        onChange={e => setBarcodeInput(e.target.value)}
                                                        onKeyDown={handleBarcodeSearch}
                                                    />
                                                    <ScanLine size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCamera(true)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        width: '2.5rem', height: '2.5rem',
                                                        background: themeColor, color: '#fff',
                                                        border: 'none', borderRadius: '0.375rem',
                                                        cursor: 'pointer', transition: 'background 0.2s',
                                                        flexShrink: 0
                                                    }}
                                                    title="Start Camera Scanner"
                                                >
                                                    <Camera size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                                            <label className="so-label" style={{ marginBottom: '0.25rem', color: themeColor }}>Set Source Warehouse</label>
                                            <select
                                                className="so-select"
                                                style={{ height: '2.5rem', fontSize: '0.75rem', fontWeight: 700 }}
                                                value={form.set_source_warehouse || ''}
                                                onChange={e => {
                                                    const wh = e.target.value;
                                                    setForm(prev => ({
                                                        ...prev,
                                                        set_source_warehouse: wh,
                                                        items: prev.items.map(item => ({ ...item, warehouse: wh }))
                                                    }));
                                                }}
                                            >
                                                <option value="">Select Warehouse...</option>
                                                {warehouses.map(w => (
                                                    <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button onClick={addItemRow} className="so-btn-ghost" style={{ marginTop: 'auto' }}>
                                            <Plus size={14} /> Add Row
                                        </button>
                                    </div>
                                </div>
                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
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
                                                                style={{ width: col.width, minWidth: col.id === 'item_code' ? 120 : undefined }}
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
                                            {form.items.map((item, idx) => (
                                                <tr key={idx} data-row-index={idx}>
                                                    {(() => {
                                                        const hasAnyBox = form.items.some(i => i.use_box_entry);
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
                                                                            <div style={{ position: 'relative' }}>
                                                                                <input
                                                                                    className="so-td-input"
                                                                                    type="text"
                                                                                    value={item.item_code}
                                                                                    placeholder="SKU or Name..."
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        const itms = [...form.items];
                                                                                        itms[idx].item_code = val;
                                                                                        setForm({ ...form, items: itms });
                                                                                        searchItems(val, idx);
                                                                                    }}
                                                                                />
                                                                                {showItemDropdowns[idx] && (
                                                                                    <div className="so-dropdown">
                                                                                        {itemsList.map(it => (
                                                                                            <div key={it.item_code} onClick={() => selectItem(idx, it)} className="so-dropdown-item">
                                                                                                <div className="so-dropdown-item-name">{it.item_name}</div>
                                                                                                <div className="so-dropdown-item-code">{it.item_code}</div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
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
                                                                                onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                                                    onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                                                onChange={e => handleUOMChangeDetails(e.target.value, idx)}
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
                                                                                    onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                                                    onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                                                onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                                                onChange={(e) => handleInputChangeDetails(e, idx)}
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
                                                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                        <button onClick={() => removeItemRow(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Tax & Charges Area */}
                            <div className="so-card">
                                <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h5 className="so-card-title">Sales Taxes and Charges</h5>
                                    <div style={{ minWidth: '300px' }}>
                                        <select
                                            className="so-select"
                                            style={{ height: '2.5rem', fontSize: '0.75rem', fontWeight: 700 }}
                                            value={form.taxes_and_charges || ''}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                if (val) {
                                                    try {
                                                        const encodedVal = encodeURIComponent(val);
                                                        const res = await axios.get(`/api/resource/Sales Taxes and Charges Template/${encodedVal}`, { withCredentials: true });
                                                        const rows = (res.data.data?.taxes || []).map(t => ({
                                                            charge_type: t.charge_type,
                                                            account_head: t.account_head,
                                                            description: t.description || t.account_head || 'VAT',
                                                            rate: t.rate,
                                                            tax_amount: 0,
                                                            total: 0
                                                        }));
                                                        setForm(prev => recalcForm({
                                                            ...prev,
                                                            taxes_and_charges: val,
                                                            taxes: rows
                                                        }));
                                                    } catch (err) {
                                                        console.error('Failed to fetch tax template details');
                                                        setForm(prev => ({ ...prev, taxes_and_charges: val }));
                                                    }
                                                } else {
                                                    setForm(prev => recalcForm({ ...prev, taxes_and_charges: '', taxes: [] }));
                                                }
                                            }}
                                        >
                                            <option value="">Select Template...</option>
                                            {taxTemplates.map(t => (
                                                <option key={t.name} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '5%' }}>No.</th>
                                                <th style={{ width: '25%' }}>Type</th>
                                                <th style={{ width: '40%' }}>Account Head</th>
                                                <th style={{ width: '15%', textAlign: 'center' }}>Tax Rate %</th>
                                                <th style={{ width: '15%', textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', width: '100%' }}>
                                                        <span>Amount (</span>
                                                        <DirhamIcon size={10} />
                                                        <span>)</span>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(form.taxes || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>No taxes applied</td>
                                                </tr>
                                            ) : (
                                                form.taxes.map((tax, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: 700, opacity: 0.4 }}>{idx + 1}</td>
                                                        <td>
                                                            <select
                                                                className="so-td-input"
                                                                value={tax.charge_type}
                                                                onChange={e => {
                                                                    const txs = [...form.taxes];
                                                                    txs[idx].charge_type = e.target.value;
                                                                    setForm(recalcForm({ ...form, taxes: txs }));
                                                                }}
                                                            >
                                                                <option value="On Net Total">On Net Total</option>
                                                                <option value="Actual">Actual</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                className="so-td-input"
                                                                value={tax.account_head || ''}
                                                                readOnly
                                                                placeholder="Account Head..."
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                className="so-td-input"
                                                                style={{ textAlign: 'center' }}
                                                                type="number"
                                                                value={tax.rate}
                                                                onChange={e => {
                                                                    const txs = [...form.taxes];
                                                                    txs[idx].rate = e.target.value;
                                                                    setForm(recalcForm({ ...form, taxes: txs }));
                                                                }}
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                            {(parseFloat(tax.tax_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="so-summary-bar" style={{ alignSelf: 'flex-end', minWidth: '350px' }}>
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Base Total</span>
                                    <span className="so-summary-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <DirhamIcon size={12} />
                                        <span>{form.base_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                                    <span className="so-summary-label">Net Payable</span>
                                    <span className="so-summary-value grand" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <DirhamIcon size={14} />
                                        <span>{form.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                            {/* Summary Bar for Stats */}
                            <div className="so-summary-bar">
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Artifact Valuation</span>
                                    <span className="so-summary-value grand" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <DirhamIcon size={14} />
                                        <span>{form.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Quantity Items</span>
                                    <span className="so-summary-value">{form.total_qty} Units</span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Lifecycle Status</span>
                                    <StatusBadge status={form.docstatus === 1 ? 'Authorized' : 'Pending Authorization'} themeColor={themeColor} />
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                                    <span className="so-summary-label">Created On</span>
                                    <span className="so-summary-value" style={{ fontSize: '0.85rem' }}>{form.creation?.split(' ')[0] || form.transaction_date}</span>
                                </div>
                            </div>

                            {/* Main Detail Grid (2-Column Layout, Connection Cards Removed) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="so-card">
                                    <div className="so-card-header">
                                        <h5 className="so-card-title">Order Properties</h5>
                                    </div>
                                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Currency</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{form.currency}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Selling Price List</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{form.selling_price_list}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Fulfilment Data</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: themeColor }}>{form.delivery_date || 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Source Warehouse</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: themeColor }}>{form.set_source_warehouse || 'Not Specified'}</span>
                                        </div>
                                        {linkedDocs.Delivery_Note && linkedDocs.Delivery_Note.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Linked Delivery Notes</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    {linkedDocs.Delivery_Note.map(dn => (
                                                        <span key={dn} className="so-badge" style={{ background: '#ecfdf5', color: '#10b981', borderColor: '#a7f3d0', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                                            {dn}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {linkedDocs.Sales_Invoice && linkedDocs.Sales_Invoice.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Linked Sales Invoices</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    {linkedDocs.Sales_Invoice.map(si => (
                                                        <span key={si} className="so-badge" style={{ background: '#eff6ff', color: '#3b82f6', borderColor: '#bfdbfe', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                                            {si}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="so-card">
                                    <div className="so-card-header">
                                        <h5 className="so-card-title">Applied Taxes & Charges</h5>
                                    </div>
                                    <div className="so-card-body" style={{ padding: '0' }}>
                                        <div className="so-table-wrapper" style={{ maxHeight: 'none', border: 'none' }}>
                                            <table className="so-table">
                                                <thead>
                                                    <tr>
                                                        <th>Account Head</th>
                                                        <th style={{ textAlign: 'center' }}>Rate %</th>
                                                        <th style={{ textAlign: 'right' }}>Tax Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(form.taxes || []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>No taxes applied</td>
                                                        </tr>
                                                    ) : (
                                                        form.taxes.map((t, idx) => (
                                                            <tr key={idx} style={{ cursor: 'default' }}>
                                                                <td style={{ fontWeight: 700 }}>{t.account_head}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{t.rate}%</td>
                                                                <td style={{ textAlign: 'right', fontWeight: 700, color: themeColor }}>
                                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                                        <DirhamIcon size={12} />
                                                                        <span>{parseFloat(t.tax_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table Presentation */}
                            <div className="so-table-card">
                                <div className="so-card-header" style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <h5 className="so-card-title">Orchestration Itemized Bill</h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowColConfig(true)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            title="Column Configuration"
                                        >
                                            <Settings size={14} style={{ color: '#94a3b8' }} />
                                        </button>
                                    </div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>{form.items.length} ACTIVE ITEMS</span>
                                </div>
                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
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
                                                                        <td key={col.id} style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 600 }}>
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
                                                                        <td key={col.id} style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 600 }}>
                                                                            {i.use_box_entry ? i.custom_pieces_per_box : '—'}
                                                                        </td>
                                                                    );
                                                                case 'custom_box_price':
                                                                    return (
                                                                        <td key={col.id} style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 600 }}>
                                                                            {i.use_box_entry ? i.custom_box_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                                        </td>
                                                                    );
                                                                case 'rate':
                                                                    return (
                                                                        <td key={col.id} style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 600 }}>
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                                                <DirhamIcon size={12} />
                                                                                <span>{parseFloat(i.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                case 'custom_selling_price':
                                                                    return (
                                                                        <td key={col.id} style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 600, color: themeColor }}>
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                                                                                <DirhamIcon size={12} />
                                                                                <span>{parseFloat(i.custom_selling_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                case 'qty':
                                                                    return (
                                                                        <td key={col.id} style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 800 }}>
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
                                <span style={{ fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', fontSize: '0.85rem' }}>Sales Order Camera Scanner</span>
                            </div>
                            <button onClick={() => setShowCamera(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ position: 'relative', aspectRatio: '1.77778', borderRadius: '1rem', overflow: 'hidden', background: '#0f172a' }}>
                                <div id="sodetails-scanner-reader" style={{ width: '100%', height: '100%' }}></div>
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
    );
}
