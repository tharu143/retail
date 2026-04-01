import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Package, MapPin, Phone, Mail, ChevronLeft, Loader2,
    AlertCircle, Globe, Tag, Receipt, Layers, CreditCard,
    ArrowRight, Settings, Edit2, Save, X, CheckCircle2, Clock,
    Plus, Search, ScanLine, Trash2, Calendar, User, FileText, Info, Palette
} from 'lucide-react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SalesOrder.css';

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
        items: [{ item_code: '', delivery_date: today, qty: 1, rate: 0, amount: 0 }],
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
            setCustomers(custRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setWarehouses(whRes.data.message || []);
        } catch (err) { console.error(err); }
    };

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/resource/Sales Order/${name}`, { withCredentials: true });
            const d = res.data.data;
            setForm({
                ...d,
                items: d.items || [],
                taxes: d.taxes || []
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
                docstatus: submit ? 1 : 0,
                delivery_date: form.delivery_date || form.transaction_date,
                items: form.items.filter(i => i.item_code).map(i => ({
                    ...i,
                    delivery_date: i.delivery_date || form.delivery_date || form.transaction_date
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
            items: [...prev.items, { item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos' }]
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

    const handleBarcodeSearch = async (e) => {
        if (e.key !== 'Enter' || !barcodeInput.trim()) return;
        const val = barcodeInput.trim();
        try {
            const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_by_barcode_retail', {
                params: { barcode: val },
                withCredentials: true
            });
            const item = Array.isArray(res.data.message) ? res.data.message[0] : res.data.message;
            if (!item || item.status === 'error' || (!item.item_code && !item.name)) {
                throw new Error(item?.message || 'Item not found');
            }
            
            // Add to a new row or find the first empty row
            setForm(prev => {
                const items = [...prev.items];
                const emptyIdx = items.findIndex(i => !i.item_code);
                const targetIdx = emptyIdx !== -1 ? emptyIdx : items.length;
                
                const rate = item.rate || item.last_selling_rate || item.standard_rate || 0;
                const newRow = {
                    item_code: item.item_code,
                    item_name: item.item_name,
                    uom: item.stock_uom || 'Nos',
                    qty: 1,
                    rate,
                    amount: rate,
                    warehouse: prev.set_source_warehouse || localStorage.getItem('warehouse') || ''
                };

                if (emptyIdx !== -1) {
                    items[emptyIdx] = newRow;
                } else {
                    items.push(newRow);
                }

                // Append an extra blank row if needed
                if (items.every(i => i.item_code)) {
                    items.push({ item_code: '', delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 });
                }

                return recalcForm({ ...prev, items });
            });
            setBarcodeInput('');
        } catch (err) {
            Swal.fire('Scan Error', err.message, 'error');
        }
    };

    const selectItem = async (idx, item) => {
        try {
            const rateRes = await axios.get('/api/method/kyle_retail.retail_api.api.get_item_selling_rate_so', {
                params: { item_code: item.item_code, price_list: form.selling_price_list },
                withCredentials: true
            });
            const rate = rateRes.data?.message?.message?.rate || rateRes.data?.message?.rate || 0;

            setForm(prev => {
                const items = [...prev.items];
                items[idx] = {
                    item_code: item.item_code,
                    item_name: item.item_name,
                    uom: item.stock_uom || 'Nos',
                    qty: 1,
                    rate,
                    amount: rate,
                    warehouse: prev.set_source_warehouse || ''
                };

                // Auto-add next row
                if (idx === items.length - 1) {
                    items.push({ item_code: '', delivery_date: prev.delivery_date || prev.transaction_date, qty: 1, rate: 0, amount: 0 });
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
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="so-btn-primary"
                                >
                                    <Edit2 size={16} /> Modify Detail
                                </button>
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
                                                    onChange={e => setForm({ ...form, transaction_date: e.target.value })}
                                                />
                                            </div>
                                            <div className="so-field">
                                                <label className="so-label">Delivery Target</label>
                                                <input
                                                    className="so-input"
                                                    type="date"
                                                    value={form.delivery_date}
                                                    onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="so-card">
                                <div className="so-card-header">
                                    <h5 className="so-card-title">Orchestration Itemized Bill</h5>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '220px' }}>
                                            <label className="so-label" style={{ marginBottom: '0.25rem', color: themeColor }}>Scan Barcode / SKU</label>
                                            <div style={{ position: 'relative' }}>
                                                <input 
                                                    className="so-select"
                                                    style={{ height: '2.5rem', fontSize: '0.75rem', fontWeight: 700, paddingRight: '2.5rem' }}
                                                    placeholder="Focus here to scan..."
                                                    ref={barcodeRef}
                                                    value={barcodeInput}
                                                    onChange={e => setBarcodeInput(e.target.value)}
                                                    onKeyDown={handleBarcodeSearch}
                                                />
                                                <ScanLine size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
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
                                                <th style={{ width: '35%' }}>Product SKU / Description</th>
                                                <th style={{ width: '15%' }}>UOM</th>
                                                <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
                                                <th style={{ width: '20%', textAlign: 'right' }}>Unit Rate</th>
                                                <th style={{ width: '20%', textAlign: 'right' }}>Line Total</th>
                                                <th style={{ width: '50px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
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
                                                    <td>
                                                        <select
                                                            className="so-td-input"
                                                            value={item.uom || 'Nos'}
                                                            onChange={e => {
                                                                const itms = [...form.items];
                                                                itms[idx].uom = e.target.value;
                                                                setForm({ ...form, items: itms });
                                                            }}
                                                        >
                                                            <option value="Nos">Nos</option>
                                                            <option value="Box">Box</option>
                                                            {item.uom && item.uom !== 'Nos' && item.uom !== 'Box' && (
                                                                <option value={item.uom}>{item.uom}</option>
                                                            )}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="so-td-input"
                                                            style={{ textAlign: 'center' }}
                                                            type="number"
                                                            value={item.qty}
                                                            onChange={e => {
                                                                const itms = [...form.items];
                                                                itms[idx].qty = e.target.value;
                                                                itms[idx].amount = (parseFloat(e.target.value) || 0) * (parseFloat(itms[idx].rate) || 0);
                                                                setForm(recalcForm({ ...form, items: itms }));
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="so-td-input"
                                                            style={{ textAlign: 'right' }}
                                                            type="number"
                                                            value={item.rate}
                                                            onChange={e => {
                                                                const itms = [...form.items];
                                                                itms[idx].rate = e.target.value;
                                                                itms[idx].amount = (parseFloat(itms[idx].qty) || 0) * (parseFloat(e.target.value) || 0);
                                                                setForm(recalcForm({ ...form, items: itms }));
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
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

                            <div className="so-summary-bar" style={{ alignSelf: 'flex-end', minWidth: '350px' }}>
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Base Total</span>
                                    <span className="so-summary-value">AED {form.base_total.toLocaleString()}</span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                                    <span className="so-summary-label">Net Payable</span>
                                    <span className="so-summary-value grand">AED {form.grand_total.toLocaleString()}</span>
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
                                    <span className="so-summary-value grand">AED {form.grand_total.toLocaleString()}</span>
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

                            {/* Main Detail Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                <ConnectionCard
                                    title="Delivery Connections"
                                    links={linkedDocs.Delivery_Note}
                                    onTransistion={() => handleTransistion('Delivery Note')}
                                    loadingLinks={loadingLinks}
                                    themeColor={themeColor}
                                />
                                <ConnectionCard
                                    title="Revenue Triggers"
                                    links={linkedDocs.Sales_Invoice}
                                    onTransistion={() => handleTransistion('Sales Invoice')}
                                    loadingLinks={loadingLinks}
                                    themeColor={themeColor}
                                />
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
                                    </div>
                                </div>
                            </div>

                            {/* Items Table Presentation */}
                            <div className="so-table-card">
                                <div className="so-card-header" style={{ padding: '0.75rem 1.25rem' }}>
                                    <h5 className="so-card-title">Orchestration Itemized Bill</h5>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>{form.items.length} ACTIVE ITEMS</span>
                                </div>
                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th>Product SKU / Description</th>
                                                <th style={{ textAlign: 'center' }}>UOM</th>
                                                <th style={{ textAlign: 'center' }}>Qty Authorized</th>
                                                <th style={{ textAlign: 'right' }}>Authorized Rate</th>
                                                <th style={{ textAlign: 'right' }}>Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.map((i, idx) => (
                                                <tr key={idx} style={{ cursor: 'default' }}>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{i.item_code}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{i.item_name}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{i.uom}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#475569' }}>{i.qty}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>AED {parseFloat(i.rate || 0).toLocaleString()}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>AED {parseFloat(i.amount || 0).toLocaleString()}</td>
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
        </div>
    );
}
