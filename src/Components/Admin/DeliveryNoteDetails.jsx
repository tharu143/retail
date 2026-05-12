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
            if (name && name !== 'create') {
                loadDeliveryNote(name);
            } else if (location.pathname.includes('/create')) {
                if (location.state?.returnData) {
                    setForm(location.state.returnData);
                    setIsViewOnly(false);
                    setIsDirty(true);
                } else {
                    openCreateModal();
                }
            }
        });
    }, [name, location.pathname, location.state]);

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
        setSaving(true);
        try {
            if (action === 'save') {
                const payload = { ...form, doctype: 'Delivery Note', items: form.items.map(i => ({ ...i, warehouse: i.warehouse || form.set_warehouse })) };
                const res = form.name ? await frappeCall({ method: 'frappe.client.save', args: { doc: payload } }) : await frappeCall({ method: 'frappe.client.insert', args: { doc: payload } });
                setForm(prev => ({ ...prev, ...res }));
                setIsDirty(false);
                Swal.fire({ icon: 'success', title: 'Saved', timer: 1500 });
            } else if (action === 'submit') {
                const res = await frappeCall({ method: 'frappe.client.submit', args: { doc: { ...form, doctype: 'Delivery Note' } } });
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

    const handleCreateReturn = async () => {
        if (!form.name) return;
        setSaving(true);
        try {
            const res = await axios.get(`/api/method/kyle_retail.retail_api.api.get_mapped_doc_retail`, {
                params: {
                    from_doctype: 'Delivery Note',
                    to_doctype: 'Sales Return',
                    source_name: form.name
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

                // Navigate to create route with mapped return data
                navigate('/deliverynote/create', { 
                    state: { 
                        returnData: {
                            ...mappedData,
                            is_return: 1,
                            return_against: form.name,
                            name: '' // Ensure it's a new document
                        } 
                    },
                    replace: true
                });
                setShowCreateMenu(false);
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

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div style={{ background: '#f8fafc', minHeight: 'calc(100vh - 74px)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="so-modal-header" style={{ padding: '0', background: 'transparent', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0, color: '#1e293b' }}>
                        <Package size={28} style={{ color: themeColor }} />
                        {form.docstatus === 1 ? 'View' : form.name ? 'Modify' : 'New'} Delivery Note
                        {form.name && <span style={{ fontSize: '1rem', fontWeight: 700, color: '#94a3b8', marginLeft: '0.5rem' }}>{form.name}</span>}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {/* TABS */}
                        {form.name && (
                            <div style={{ display: 'flex', background: '#fff', padding: '0.25rem', borderRadius: '0.5rem', marginRight: '1rem', border: '1px solid #e2e8f0' }}>
                                <button
                                    onClick={() => setActiveTab('details')}
                                    style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.4rem', border: 'none', background: activeTab === 'details' ? '#f1f5f9' : 'transparent', color: activeTab === 'details' ? themeColor : '#64748b', cursor: 'pointer' }}
                                >
                                    DETAILS
                                </button>
                                <button
                                    onClick={() => setActiveTab('connections')}
                                    style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.4rem', border: 'none', background: activeTab === 'connections' ? '#f1f5f9' : 'transparent', color: activeTab === 'connections' ? themeColor : '#64748b', cursor: 'pointer' }}
                                >
                                    CONNECTIONS
                                </button>
                            </div>
                        )}

                        {/* ACTIONS */}
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            {/* DRAFT ACTIONS */}
                            {form.docstatus === 0 && (
                                <>
                                    {(allowedActions.includes('save') && (!form.name || isDirty)) && !isViewOnly && (
                                        <button onClick={() => handleDocAction('save')} disabled={saving} className="so-btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#3b82f6', color: 'white', borderRadius: '0.6rem', fontWeight: 900, border: 'none', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)' }}>
                                            {saving ? <Loader2 size={16} className="so-spinner" /> : (form.name ? 'UPDATE' : 'SAVE')}
                                        </button>
                                    )}
                                    {allowedActions.includes('submit') && form.name && !isDirty && (
                                        <button onClick={() => handleDocAction('submit')} disabled={saving} className="so-btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#10b981', color: 'white', borderRadius: '0.6rem', fontWeight: 900, border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
                                            SUBMIT
                                        </button>
                                    )}
                                    {isViewOnly && (
                                        <button onClick={() => setIsViewOnly(false)} className="so-btn-secondary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#fff', color: '#475569', borderRadius: '0.6rem', fontWeight: 900, border: '1px solid #e2e8f0' }}>
                                            <Edit3 size={16} style={{ marginRight: '0.25rem', display: 'inline' }} /> EDIT
                                        </button>
                                    )}
                                    {allowedActions.includes('delete') && form.name && (
                                        <button onClick={() => handleDocAction('delete')} disabled={saving} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer' }} title="Delete Draft">
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </>
                            )}

                            {/* SUBMITTED ACTIONS */}
                            {form.docstatus === 1 && (
                                <>
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            onClick={() => setShowCreateMenu(!showCreateMenu)} 
                                            className="so-btn-primary" 
                                            style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#f59e0b', color: 'white', borderRadius: '0.6rem', fontWeight: 900, border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)' }}
                                        >
                                            CREATE <ChevronDown size={14} />
                                        </button>
                                        {showCreateMenu && (
                                            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '160px', overflow: 'hidden' }}>
                                                <button 
                                                    onClick={() => navigate(`/salesinvoice?dn=${encodeURIComponent(form.name)}`)} 
                                                    style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none', background: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }} 
                                                    className="hover:bg-slate-50"
                                                >
                                                    <FileText size={16} /> Sales Invoice
                                                </button>
                                                <button 
                                                    onClick={handleCreateReturn} 
                                                    style={{ width: '100%', textAlign: 'left', padding: '0.75rem 1rem', border: 'none', background: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }} 
                                                    className="hover:bg-red-50"
                                                >
                                                    <FileMinus size={16} /> Sales Return
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {allowedActions.includes('cancel') && (
                                        <button onClick={() => handleDocAction('cancel')} disabled={saving} className="so-btn-danger" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', borderRadius: '0.6rem', fontWeight: 900, border: 'none', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>
                                            CANCEL
                                        </button>
                                    )}
                                </>
                            )}

                            {/* CANCELLED ACTIONS */}
                            {form.docstatus === 2 && allowedActions.includes('amend') && (
                                <button onClick={() => handleDocAction('amend')} disabled={saving} className="so-btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.75rem', background: '#0ea5e9', color: 'white', borderRadius: '0.6rem', fontWeight: 900, border: 'none', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)' }}>
                                    AMEND
                                </button>
                            )}

                            <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 0.25rem' }}></div>

                            <button onClick={() => window.print()} style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer' }} title="Print">
                                <Printer size={18} />
                            </button>

                            <button onClick={() => navigate('/deliverynote')} style={{ background: '#fff', padding: '0.6rem 1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#475569', fontWeight: 800, fontSize: '0.75rem' }}>
                                BACK
                            </button>
                        </div>
                    </div>
                </div>

                {/* THE REST OF THE UI */}
                {activeTab === 'details' ? (
                    <>
                        <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div>
                                <label style={lbl}>Series *</label>
                                <select disabled={isViewOnly || form.name} value={form.naming_series} onChange={e => setForm(prev => ({ ...prev, naming_series: e.target.value }))} style={isViewOnly || form.name ? fieldReadonly : fieldStyle}>
                                    {namingSeriesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <label style={lbl}>Customer *</label>
                                {isViewOnly ? (
                                    <input type="text" value={form.customer_name} disabled={true} style={fieldReadonly} />
                                ) : (
                                    <>
                                        <input
                                            ref={customerInputRef}
                                            type="text"
                                            placeholder="Search Customer..."
                                            value={customerQuery || form.customer_name || ''}
                                            onChange={e => {
                                                setCustomerQuery(e.target.value);
                                                setShowCustomerDropdown(true);
                                            }}
                                            onFocus={() => setShowCustomerDropdown(true)}
                                            style={fieldStyle}
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
                                    </>
                                )}
                            </div>
                            <div>
                                <label style={lbl}>Branch *</label>
                                <select
                                    disabled={isViewOnly}
                                    value={form.set_warehouse}
                                    onChange={e => {
                                        const wh = e.target.value;
                                        setForm(prev => ({
                                            ...prev,
                                            set_warehouse: wh,
                                            items: prev.items.map(item => ({ ...item, warehouse: wh }))
                                        }));
                                    }}
                                    style={isViewOnly ? fieldReadonly : fieldStyle}
                                >
                                    <option value="">Select Branch</option>
                                    {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Date *</label>
                                <input type="date" disabled={isViewOnly} value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} style={isViewOnly ? fieldReadonly : fieldStyle} />
                            </div>
                        </div>

                        <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}><Package size={18} /> ITEMS</h3>
                                {!isViewOnly && (
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ position: 'relative', width: '300px' }}>
                                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                id="barcode-scan-input"
                                                type="text"
                                                placeholder="Scan Barcode..."
                                                value={barcodeInput}
                                                onChange={e => setBarcodeInput(e.target.value)}
                                                onKeyDown={handleBarcodeScan}
                                                style={{ ...fieldStyle, paddingLeft: '2.5rem', fontSize: '0.8rem' }}
                                            />
                                        </div>
                                        <button
                                            onClick={addItemRow}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 800, color: '#475569', cursor: 'pointer' }}
                                        >
                                            <Plus size={16} /> Add Row
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Item</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Qty</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Rate</th>
                                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Amount</th>
                                    </tr></thead>
                                    <tbody>
                                        {form.items.map((item, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                                                    {!isViewOnly ? (
                                                        <div style={{ position: 'relative' }}>
                                                            <input
                                                                ref={el => itemInputRefs.current[i] = el}
                                                                type="text"
                                                                placeholder="Item Code..."
                                                                value={item.item_code}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    updateItem(i, 'item_code', val);
                                                                    setItemQueries(prev => ({ ...prev, [i]: val }));
                                                                    setActiveItemRow(i);
                                                                }}
                                                                style={{ ...fieldStyle, fontSize: '0.85rem', fontWeight: 700 }}
                                                            />
                                                            {activeItemRow === i && (itemQueries[i] || '').length >= 1 && (
                                                                <ItemDropdown
                                                                    targetRef={{ current: itemInputRefs.current[i] }}
                                                                    query={itemQueries[i]}
                                                                    onSelect={(selected) => {
                                                                        const updatedItems = [...form.items];
                                                                        updatedItems[i] = {
                                                                            ...updatedItems[i],
                                                                            item_code: selected.item_code,
                                                                            item_name: selected.item_name,
                                                                            description: selected.description,
                                                                            uom: selected.stock_uom,
                                                                            warehouse: form.set_warehouse,
                                                                            rate: selected.price_list_rate || selected.valuation_rate || 0,
                                                                            amount: (selected.price_list_rate || selected.valuation_rate || 0) * (updatedItems[i].qty || 1)
                                                                        };
                                                                        setForm(prev => ({ ...prev, items: updatedItems }));
                                                                        setActiveItemRow(null);
                                                                        setItemQueries(prev => {
                                                                            const n = { ...prev };
                                                                            delete n[i];
                                                                            return n;
                                                                        });
                                                                        setIsDirty(true);
                                                                    }}
                                                                    warehouse={form.set_warehouse}
                                                                />
                                                            )}
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{item.item_name}</div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{item.item_code}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{item.item_name}</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                                                    {isViewOnly ? (
                                                        <span style={{ fontWeight: 600 }}>{item.qty} <span style={{ color: '#64748b' }}>{item.uom}</span></span>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                value={item.qty ?? ''}
                                                                placeholder="0"
                                                                onFocus={e => {
                                                                    e.target.select();
                                                                    setActiveItemRow(null);
                                                                }}
                                                                onChange={e => updateItem(i, 'qty', e.target.value)}
                                                                style={{ ...fieldStyle, width: '80px', padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}
                                                            />
                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{item.uom}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.85rem' }}>
                                                    {isViewOnly ? (
                                                        <span style={{ fontWeight: 600 }}>{getCurrencySymbol(form.currency)}{Number(item.rate).toFixed(2)}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.rate ?? ''}
                                                            placeholder="0.00"
                                                            onFocus={e => {
                                                                e.target.select();
                                                                setActiveItemRow(null);
                                                            }}
                                                            onBlur={e => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                updateItem(i, 'rate', val.toFixed(2));
                                                            }}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                updateItem(i, 'rate', val);
                                                            }}
                                                            style={{ ...fieldStyle, width: '120px', padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: themeColor }}>
                                                    {getCurrencySymbol(form.currency)}{Number(item.amount).toFixed(2)}
                                                    {!isViewOnly && (
                                                        <button onClick={() => removeItem(i)} style={{ marginLeft: '1rem', color: '#ef4444', background: '#fee2e2', borderRadius: '0.25rem', padding: '0.25rem', border: 'none', cursor: 'pointer' }}>
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {form.items.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                                    <Package size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                                    <p style={{ margin: 0, fontWeight: 600 }}>No items added.</p>
                                                    {!isViewOnly && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>Click "Add Row" or scan a barcode to begin.</p>}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* DISCOUNTS & TAXES */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}><Percent size={18} /> DISCOUNTS</h3>
                                <div style={{ display: 'grid', gap: '1.25rem' }}>
                                    <div>
                                        <label style={lbl}>Apply Discount On</label>
                                        <select disabled={isViewOnly} value={form.apply_discount_on} onChange={e => setForm(prev => ({ ...prev, apply_discount_on: e.target.value }))} style={isViewOnly ? fieldReadonly : fieldStyle}>
                                            <option value="Grand Total">Grand Total</option>
                                            <option value="Net Total">Net Total</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                        <div>
                                            <label style={lbl}>Discount (%)</label>
                                            <input type="number" disabled={isViewOnly} value={form.additional_discount_percentage} onChange={e => setForm(prev => ({ ...prev, additional_discount_percentage: parseFloat(e.target.value) || 0, discount_amount: 0 }))} style={isViewOnly ? fieldReadonly : fieldStyle} />
                                        </div>
                                        <div>
                                            <label style={lbl}>Discount Amount</label>
                                            <input type="number" disabled={isViewOnly} value={form.discount_amount} onChange={e => setForm(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0, additional_discount_percentage: 0 }))} style={isViewOnly ? fieldReadonly : fieldStyle} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}><Settings size={18} /> TAXES</h3>
                                <div>
                                    <label style={lbl}>Tax Template</label>
                                    <select disabled={isViewOnly} value={form.taxes_and_charges} onChange={e => applyTaxTemplate(e.target.value)} style={isViewOnly ? fieldReadonly : fieldStyle}>
                                        <option value="">No Tax</option>
                                        {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                {form.taxes.length > 0 && (
                                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                        {form.taxes.map((t, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.5rem 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                <span style={{ color: '#64748b', fontWeight: 600 }}>{t.account_head} <span style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>{t.rate}%</span></span>
                                                <span style={{ fontWeight: 800, color: '#1e293b' }}>{getCurrencySymbol(form.currency)}{Number((t.rate / 100) * (form.base_total)).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', color: 'white', borderRadius: '0.5rem', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 700, letterSpacing: '0.05em' }}>TOTAL QTY</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{form.total_qty}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 700, letterSpacing: '0.05em' }}>GRAND TOTAL</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#38bdf8' }}>{getCurrencySymbol(form.currency)} {Number(form.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {Object.entries(connections).map(([category, docs]) => (
                            <div key={category} style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <div style={{ padding: '1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <LinkIcon size={18} style={{ color: themeColor }} />
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e293b' }}>{category}</h3>
                                </div>
                                <div style={{ padding: '1rem' }}>
                                    {Object.entries(docs).length > 0 ? Object.entries(docs).map(([dt, list]) => (
                                        <div key={dt} style={{ padding: '0.5rem' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{dt} ({list.length})</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {list.map(d => (
                                                    <div key={d.name} onClick={() => navigate(`/${dt.toLowerCase().replace(' ', '')}list`)} style={{ padding: '0.5rem 0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: themeColor, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }} className="hover:bg-slate-200">
                                                        {d.name} <ArrowRight size={12} style={{ display: 'inline', marginLeft: '0.25rem' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>No connections found</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryNoteDetails;