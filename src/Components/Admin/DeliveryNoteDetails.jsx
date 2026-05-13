import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Package, Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette,
    Save, CheckCircle2, Trash2, Edit3, AlertCircle, Printer, Send,
    Settings, Link as LinkIcon, Info, CreditCard, Percent, ArrowRight
} from 'lucide-react';
import { frappeCall } from '../../utils/frappe';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';

const CustomerDropdown = ({ query, onSelect, customers, targetRef }) => {
    const results = useMemo(() => {
        if (!query) return customers.slice(0, 10);
        const q = query.toLowerCase();
        return customers.filter(c =>
            (c.customer_name || '').toLowerCase().includes(q) ||
            (c.name || '').toLowerCase().includes(q)
        ).slice(0, 10);
    }, [query, customers]);

    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

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
    }, [targetRef, results]);

    if (results.length === 0) return null;

    return createPortal(
        <div style={{
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
        }}>
            {results.map(c => (
                <div
                    key={c.name}
                    onClick={() => onSelect(c)}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
                >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.customer_name}</div>
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
            if (!query || query.length < 1) return;
            setLoading(true);
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', {
                    params: { search_term: query, warehouse: warehouse }
                });
                setResults(res.data.message || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(fetchItems, 300);
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
                        {item.price_list_rate && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>AED {item.price_list_rate}</div>}
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

    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');

    const [dnTheme, setDnTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = dnTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

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
        grand_total: 0, rounded_total: 0, in_words: ''
    });

    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return 'AED ';
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
            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setNamingSeriesOptions(nsRes.data.message?.options || []);
        } catch (err) { console.error(err); }
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
            setForm({ ...dn });
            setCustomerQuery(dn.customer_name || '');
            setAllowedActions(statusRes.data.data?.allowed_actions || []);
            setConnections(connectionsRes.data.data || {});
            setIsViewOnly(dn.docstatus !== 0);
            setIsDirty(false);
            setActiveTab('details');
            setLoading(false);
        } catch (err) { navigate('/deliverynote'); }
    };

    const openCreateModal = () => {
        setForm({
            name: '', title: '',
            naming_series: namingSeriesOptions[0] || 'MAT-DN-.YYYY.-',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: '',
            docstatus: 0, is_return: 0, return_against: '', currency: 'AED',
            selling_price_list: 'Standard Selling', items: [],
            taxes_and_charges: '', taxes: [],
            apply_discount_on: 'Grand Total',
            additional_discount_percentage: 0,
            discount_amount: 0,
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
            grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsViewOnly(false);
        setLoading(false);
        setDefaultBranch();
    };

    useEffect(() => {
        loadMetadata().then(() => {
            if (name) loadDeliveryNote(name);
            else if (location.pathname.includes('/create')) openCreateModal();
        });
    }, [name, location.pathname]);

    useEffect(() => {
        const items = form.items || [];
        const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        let discount = 0;
        if (form.apply_discount_on === 'Net Total') discount = form.additional_discount_percentage ? (netTotal * form.additional_discount_percentage / 100) : (form.discount_amount || 0);
        const baseForTax = netTotal - discount;
        const taxTotal = form.taxes.reduce((s, t) => s + (baseForTax * (parseFloat(t.rate) || 0) / 100), 0);
        let grand = baseForTax + taxTotal;
        if (form.apply_discount_on === 'Grand Total') grand -= (form.additional_discount_percentage ? (grand * form.additional_discount_percentage / 100) : (form.discount_amount || 0));
        const rounded = Math.round(grand);
        setForm(prev => ({ ...prev, total_qty: Math.abs(totalQty), base_total: Math.abs(netTotal), total_taxes_and_charges: Math.abs(taxTotal), grand_total: grand, rounded_total: rounded, in_words: numberToWords(rounded, form.currency) }));
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
        if (!templateName) { setForm(prev => ({ ...prev, taxes_and_charges: '', taxes: [] })); return; }
        const res = await axios.get('/api/method/erpnext.controllers.accounts_controller.get_taxes_and_charges', { params: { master_doctype: 'Sales Taxes and Charges Template', master_name: templateName } });
        setForm(prev => ({ ...prev, taxes_and_charges: templateName, taxes: res.data.message }));
    };

    const handleBarcodeScan = async (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', { params: { search_term: barcodeInput, warehouse: form.set_warehouse } });
            if (res.data.message?.length > 0) {
                const item = res.data.message[0];
                setForm(prev => ({ ...prev, items: [...prev.items, { item_code: item.item_code, item_name: item.item_name, qty: 1, rate: item.price_list_rate, amount: item.price_list_rate, uom: item.stock_uom, warehouse: form.set_warehouse }] }));
                setBarcodeInput('');
            }
        }
    };

    const fieldStyle = { width: '100%', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.55rem 0.875rem', fontSize: '0.875rem', outline: 'none', background: 'white' };
    const fieldReadonly = { ...fieldStyle, background: '#f9fafb', color: '#6b7280' };
    const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.375rem' };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen flex-col gap-4 bg-gray-50">
            <Loader2 size={40} className="animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Loading Delivery Note...</p>
        </div>
    );

    const isNew = !form.name;
    const isEditing = !isViewOnly;

    // Helper to extract linked docs safely
    const getLinkedDocs = (doctype) => {
        const list = [];
        Object.entries(connections || {}).forEach(([cat, docs]) => {
            if (docs && docs[doctype]) {
                docs[doctype].forEach(d => {
                    if (d && typeof d === 'object') {
                        list.push(d.name);
                    } else if (typeof d === 'string') {
                        list.push(d);
                    }
                });
            }
        });
        return list;
    };

    const linkedSalesOrders = getLinkedDocs('Sales Order');
    const linkedSalesInvoices = getLinkedDocs('Sales Invoice');

    return (
        <div className="so-page">
            {/* 1. Page Header */}
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
                            {(allowedActions.includes('save') || isNew) && (
                                <button
                                    onClick={() => handleDocAction('save')}
                                    disabled={saving}
                                    className="so-btn-primary"
                                >
                                    {saving ? <Loader2 size={16} className="so-spinner" /> : <Save size={16} />} Save Draft
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
                                    <button
                                        onClick={handleCreateInvoice}
                                        className="so-btn-primary"
                                        style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                                    >
                                        <FileText size={16} /> Create Invoice
                                    </button>
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

            {/* 2. Main Page Layout */}
            <div className="so-layout">
                <div className="so-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {isEditing ? (
                        /* EDIT MODE LAYOUT */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                            <div className="so-card">
                                <div className="so-card-header">
                                    <h5 className="so-card-title">Delivery Context & Timeline</h5>
                                </div>
                                <div className="so-card-body">
                                    <div className="so-form-grid">
                                        <div className="so-field">
                                            <label className="so-label">Series *</label>
                                            <select
                                                className="so-select"
                                                disabled={form.name}
                                                value={form.naming_series}
                                                onChange={e => setForm(prev => ({ ...prev, naming_series: e.target.value }))}
                                            >
                                                {namingSeriesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label">Target Customer *</label>
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
                                                    }}
                                                    onFocus={() => setShowCustomerDropdown(true)}
                                                />
                                                {showCustomerDropdown && (
                                                    <CustomerDropdown
                                                        targetRef={customerInputRef}
                                                        query={customerQuery}
                                                        customers={customers}
                                                        onSelect={(c) => {
                                                            setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                            setCustomerQuery(c.customer_name);
                                                            setShowCustomerDropdown(false);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label">Warehouse</label>
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
                                            >
                                                <option value="">Select Branch</option>
                                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="so-field">
                                            <label className="so-label">Posting Date *</label>
                                            <input
                                                className="so-input"
                                                type="date"
                                                value={form.posting_date}
                                                onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Card */}
                            <div className="so-table-card">
                                <div className="so-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h5 className="so-card-title">Items</h5>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '250px' }}>
                                            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                className="so-input"
                                                style={{ paddingLeft: '2.25rem', height: '2.25rem', fontSize: '0.75rem' }}
                                                type="text"
                                                placeholder="Scan Barcode..."
                                                value={barcodeInput}
                                                onChange={e => setBarcodeInput(e.target.value)}
                                                onKeyDown={handleBarcodeScan}
                                            />
                                        </div>
                                        <button
                                            onClick={addItemRow}
                                            className="so-btn-primary"
                                            style={{ height: '2.25rem', padding: '0 1rem', fontSize: '0.75rem' }}
                                        >
                                            <Plus size={14} /> Add Row
                                        </button>
                                    </div>
                                </div>

                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40%' }}>Product SKU / Description</th>
                                                <th style={{ width: '15%', textAlign: 'center' }}>UOM</th>
                                                <th style={{ width: '15%', textAlign: 'center' }}>Qty Delivered</th>
                                                <th style={{ width: '15%', textAlign: 'right' }}>Authorized Rate</th>
                                                <th style={{ width: '15%', textAlign: 'right' }}>Line Total</th>
                                                <th style={{ width: '5%', textAlign: 'center' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                                        No items added. Click "Add Row" or scan barcode.
                                                    </td>
                                                </tr>
                                            ) : (
                                                form.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td>
                                                            <div style={{ position: 'relative' }}>
                                                                <input
                                                                    ref={el => itemInputRefs.current[idx] = el}
                                                                    className="so-td-input"
                                                                    style={{ fontWeight: 700 }}
                                                                    type="text"
                                                                    placeholder="Type item SKU or code..."
                                                                    value={item.item_code}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        updateItem(idx, 'item_code', val);
                                                                        setItemQueries(prev => ({ ...prev, [idx]: val }));
                                                                        setActiveItemRow(idx);
                                                                    }}
                                                                />
                                                                {activeItemRow === idx && (itemQueries[idx] || '').length >= 1 && (
                                                                    <ItemDropdown
                                                                        targetRef={{ current: itemInputRefs.current[idx] }}
                                                                        query={itemQueries[idx]}
                                                                        warehouse={form.set_warehouse}
                                                                        onSelect={(selected) => {
                                                                            const updatedItems = [...form.items];
                                                                            updatedItems[idx] = {
                                                                                ...updatedItems[idx],
                                                                                item_code: selected.item_code,
                                                                                item_name: selected.item_name,
                                                                                description: selected.description,
                                                                                uom: selected.stock_uom,
                                                                                warehouse: form.set_warehouse,
                                                                                rate: selected.price_list_rate || selected.valuation_rate || 0,
                                                                                amount: (selected.price_list_rate || selected.valuation_rate || 0) * (updatedItems[idx].qty || 1)
                                                                            };
                                                                            setForm(prev => ({ ...prev, items: updatedItems }));
                                                                            setActiveItemRow(null);
                                                                            setItemQueries(prev => {
                                                                                const n = { ...prev };
                                                                                delete n[idx];
                                                                                return n;
                                                                            });
                                                                            setIsDirty(true);
                                                                        }}
                                                                    />
                                                                )}
                                                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, paddingLeft: '0.5rem', marginTop: '0.2rem' }}>{item.item_name}</div>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{item.uom}</td>
                                                        <td>
                                                            <input
                                                                className="so-td-input"
                                                                style={{ textAlign: 'center', fontWeight: 800 }}
                                                                type="number"
                                                                value={item.qty ?? ''}
                                                                onChange={e => updateItem(idx, 'qty', e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                className="so-td-input"
                                                                style={{ textAlign: 'right', fontWeight: 600 }}
                                                                type="number"
                                                                value={item.rate ?? ''}
                                                                onChange={e => updateItem(idx, 'rate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                            {(parseFloat(item.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                                <Trash2 size={14} />
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="so-card">
                                    <div className="so-card-header">
                                        <h5 className="so-card-title">Discounts</h5>
                                    </div>
                                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="so-field">
                                            <label className="so-label">Apply Discount On</label>
                                            <select
                                                className="so-select"
                                                value={form.apply_discount_on}
                                                onChange={e => setForm(prev => ({ ...prev, apply_discount_on: e.target.value }))}
                                            >
                                                <option value="Grand Total">Grand Total</option>
                                                <option value="Net Total">Net Total</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                            <div className="so-field">
                                                <label className="so-label">Discount %</label>
                                                <input
                                                    className="so-input"
                                                    type="number"
                                                    value={form.additional_discount_percentage}
                                                    onChange={e => setForm(prev => ({ ...prev, additional_discount_percentage: parseFloat(e.target.value) || 0, discount_amount: 0 }))}
                                                />
                                            </div>
                                            <div className="so-field">
                                                <label className="so-label">Discount Amount</label>
                                                <input
                                                    className="so-input"
                                                    type="number"
                                                    value={form.discount_amount}
                                                    onChange={e => setForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0, additional_discount_percentage: 0 }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="so-card">
                                    <div className="so-card-header">
                                        <h5 className="so-card-title">Sales Taxes and Charges</h5>
                                    </div>
                                    <div className="so-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="so-field">
                                            <label className="so-label">Tax Template</label>
                                            <select
                                                className="so-select"
                                                value={form.taxes_and_charges || ''}
                                                onChange={e => applyTaxTemplate(e.target.value)}
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
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                                            AED {((t.rate / 100) * form.base_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Bar */}
                            <div className="so-summary-bar" style={{ alignSelf: 'flex-end', minWidth: '350px' }}>
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Base Total</span>
                                    <span className="so-summary-value">AED {form.base_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                                    <span className="so-summary-label">Net Payable</span>
                                    <span className="so-summary-value grand">AED {form.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* VIEW MODE LAYOUT */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                            {/* Summary Bar for Stats */}
                            <div className="so-summary-bar">
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Artifact Valuation</span>
                                    <span className="so-summary-value grand">AED {form.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Quantity Delivered</span>
                                    <span className="so-summary-value">{form.total_qty} Units</span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Lifecycle Status</span>
                                    <span className="so-badge" style={{
                                        background: form.docstatus === 1 ? '#dcfce7' : (form.docstatus === 2 ? '#fee2fee2' : '#fef9c3'),
                                        color: form.docstatus === 1 ? '#156534' : (form.docstatus === 2 ? '#b91c1c' : '#854d0e'),
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '9999px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {form.docstatus === 1 ? 'Submitted' : (form.docstatus === 2 ? 'Cancelled' : 'Draft')}
                                    </span>
                                </div>
                                <div className="so-summary-divider" />
                                <div className="so-summary-item" style={{ textAlign: 'right' }}>
                                    <span className="so-summary-label">Posting Date</span>
                                    <span className="so-summary-value" style={{ fontSize: '0.85rem' }}>{form.posting_date}</span>
                                </div>
                            </div>

                            {/* Main Detail Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div className="so-card">
                                    <div className="so-card-header">
                                        <h5 className="so-card-title">Delivery Properties</h5>
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
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Branch/Warehouse</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: themeColor }}>{form.set_warehouse || 'Not Specified'}</span>
                                        </div>

                                        {linkedSalesOrders.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Linked Sales Orders</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    {linkedSalesOrders.map(so => (
                                                        <span key={so} className="so-badge" style={{ background: '#ecfdf5', color: '#10b981', borderColor: '#a7f3d0', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                                                            {so}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {linkedSalesInvoices.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Linked Sales Invoices</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    {linkedSalesInvoices.map(si => (
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
                                                                <td style={{ textAlign: 'right', fontWeight: 700, color: themeColor }}>AED {parseFloat((t.rate / 100) * form.base_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                                <div className="so-card-header" style={{ padding: '0.75rem 1.25rem' }}>
                                    <h5 className="so-card-title">Items</h5>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8' }}>{form.items.length} ACTIVE ITEMS</span>
                                </div>
                                <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                                    <table className="so-table">
                                        <thead>
                                            <tr>
                                                <th>Product SKU / Description</th>
                                                <th style={{ textAlign: 'center' }}>UOM</th>
                                                <th style={{ textAlign: 'center' }}>Qty Delivered</th>
                                                <th style={{ textAlign: 'right' }}>Authorized Rate</th>
                                                <th style={{ textAlign: 'right' }}>Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.map((item, idx) => (
                                                <tr key={idx} style={{ cursor: 'default' }}>
                                                    <td>
                                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.item_code}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{item.item_name}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{item.uom}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#475569' }}>{item.qty}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>AED {parseFloat(item.rate || 0).toLocaleString()}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>AED {parseFloat(item.amount || 0).toLocaleString()}</td>
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
};

export default DeliveryNoteDetails;