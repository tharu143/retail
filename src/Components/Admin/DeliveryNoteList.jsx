import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Package, Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette,
    Save, CheckCircle2, Trash2, Edit3, AlertCircle, Printer, Send,
    Settings, Link as LinkIcon, Info, CreditCard, Percent
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

const DeliveryNoteList = () => {
    const navigate = useNavigate();
    const customerInputRef = useRef(null);
    const itemInputRefs = useRef({});

    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnSourceDN, setReturnSourceDN] = useState(null);
    const [submittedReturnData, setSubmittedReturnData] = useState(null);
    const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('details'); // details, connections
    const [connections, setConnections] = useState({});
    const [namingSeriesOptions, setNamingSeriesOptions] = useState([]);
    const [allowedActions, setAllowedActions] = useState(['save', 'submit', 'delete']);

    // Search states for items in rows
    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [searchResults, setSearchResults] = useState({});
    const [showItemDropdowns, setShowItemDropdowns] = useState({});
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerQuery, setCustomerQuery] = useState('');

    // Theme toggle
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

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.so-modal')) return; // Ignore if modal is not open
            // Simple logic: if not clicking an input, close dropdowns
            if (!e.target.closest('input')) {
                setShowCustomerDropdown(false);
                setActiveItemRow(null);
                setShowCreateMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [titleFilter, setTitleFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Form state
    const [form, setForm] = useState({
        name: '',
        title: '',
        naming_series: '',
        posting_date: new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().slice(0, 5),
        customer: '',
        customer_name: '',
        docstatus: 0,
        is_return: 0,
        return_against: '',
        set_warehouse: '',
        currency: 'AED',
        selling_price_list: 'Standard Selling',
        ignore_pricing_rule: 0,
        items: [],
        taxes_and_charges: '',
        taxes: [],
        apply_discount_on: 'Grand Total',
        additional_discount_percentage: 0,
        discount_amount: 0,
        total_qty: 0,
        base_total: 0,
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounded_total: 0,
        in_words: ''
    });

    const [customers, setCustomers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [allItems, setAllItems] = useState([]);

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return 'AED ';
            case 'USD': return '$';
            default: return '₹';
        }
    };

    const getCurrencyName = (currency) => {
        switch (currency) {
            case 'INR': return 'Rupees';
            case 'USD': return 'Dollars';
            case 'AED': return currency;
            default: return '';
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
        const currencyStr = getCurrencyName(currency);
        return currencyStr ? `${currencyStr} ${words} Only` : `${currency} ${words} Only.`;
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
                        return defaultWh;
                    }
                }
            }
        } catch (err) {
            console.error("Error setting default branch:", err);
        }
        return null;
    };


    // ─── Data Loading ───────────────────────────────────────────────────────────

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [custRes, whRes, taxRes, plRes, dnRes, companyRes, nsRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                axios.get('/api/method/frappe.client.get_list', {
                    params: { doctype: 'Price List', filters: { selling: 1 }, fields: ['name'] }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_delivery_note_list_retail', {
                    params: { limit: 2000 }
                }),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_info_dn'),
                axios.get('/api/method/kyle_retail.retail_api.api.get_naming_series_retail', { params: { doctype: 'Delivery Note' } })
            ]);

            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setPriceLists(plRes.data.data?.map(pl => pl.name) || ['Standard Selling']);
            setDeliveryNotes(dnRes.data.message || []);
            setFilteredNotes(dnRes.data.message || []);

            const nsData = nsRes.data.message || {};
            const nsOptions = nsData.options || [];
            setNamingSeriesOptions(nsOptions);

            if (nsOptions.length > 0 && !form.naming_series) {
                setForm(prev => ({ ...prev, naming_series: nsOptions[0] }));
            }

            if (companyRes.data.message?.length > 0) {
                setDefaultIncomeAccount(companyRes.data.message[0].default_income_account || '');
            }

            // SET DEFAULT BRANCH/WAREHOUSE
            await setDefaultBranch();

            // SET DEFAULT TAX
            const taxes = taxRes.data.message || [];
            if (taxes.length > 0 && !form.taxes_and_charges) {
                const vat5 = taxes.find(t => t.name.includes('VAT 5%'));
                const toApply = vat5 || taxes[0];
                applyTaxTemplate(toApply.name);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadInitialData(); }, []);

    // ─── Filters ────────────────────────────────────────────────────────────────

    useEffect(() => {
        let filtered = deliveryNotes;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(dn =>
                dn.name?.toLowerCase().includes(term) ||
                dn.customer_name?.toLowerCase().includes(term) ||
                (dn.title || 'Cash').toLowerCase().includes(term) ||
                dn.company?.toLowerCase().includes(term)
            );
        }
        if (titleFilter) filtered = filtered.filter(dn => (dn.title || 'Cash').toLowerCase().includes(titleFilter.toLowerCase()));
        if (customerFilter) filtered = filtered.filter(dn => dn.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
        if (companyFilter) filtered = filtered.filter(dn => dn.company?.toLowerCase().includes(companyFilter.toLowerCase()));
        if (statusFilter !== 'all') filtered = filtered.filter(dn => (dn.status || 'Draft') === statusFilter);
        if (minAmount || maxAmount) {
            filtered = filtered.filter(dn => {
                const amount = Number(dn.grand_total || 0);
                if (minAmount && amount < Number(minAmount)) return false;
                if (maxAmount && amount > Number(maxAmount)) return false;
                return true;
            });
        }
        setFilteredNotes(filtered);
        setCurrentPage(1);
    }, [searchTerm, titleFilter, customerFilter, companyFilter, statusFilter, minAmount, maxAmount, deliveryNotes]);

    // ─── Item Management ────────────────────────────────────────────────────────

    const [dropdownPosition, setDropdownPosition] = useState(null);

    const handleBarcodeScan = async (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            try {
                const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', {
                    params: { search_term: barcodeInput, warehouse: form.set_warehouse }
                });
                const items = res.data.message || [];
                if (items.length > 0) {
                    selectItem(items[0]);
                    setBarcodeInput('');
                } else {
                    Swal.fire({ icon: 'error', title: 'Not Found', text: 'Item not found.', timer: 1000, showConfirmButton: false, target: '.so-modal' });
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const selectItem = (item) => {
        const newItem = {
            item_code: item.item_code,
            item_name: item.item_name,
            description: item.description,
            uom: item.stock_uom,
            qty: 1,
            rate: item.price_list_rate || item.valuation_rate || 0,
            amount: item.price_list_rate || item.valuation_rate || 0,
            warehouse: form.set_warehouse || item.default_warehouse,
            rate_stock_uom: item.price_list_rate || item.valuation_rate || 0,
            stock_qty: 1
        };
        setForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setIsDirty(true);
    };

    const addItemRow = () => {
        const newItem = {
            item_code: '',
            item_name: '',
            description: '',
            qty: 0,
            rate: 0,
            amount: 0,
            uom: 'Nos',
            warehouse: form.set_warehouse
        };
        setForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
        setIsDirty(true);
    };

    const applyTaxTemplate = async (templateName) => {
        if (!templateName) {
            setForm(prev => ({ ...prev, taxes_and_charges: '', taxes: [] }));
            return;
        }
        try {
            const res = await axios.get('/api/method/erpnext.controllers.accounts_controller.get_taxes_and_charges', {
                params: { master_doctype: 'Sales Taxes and Charges Template', master_name: templateName }
            });
            if (res.data.message) {
                setForm(prev => ({
                    ...prev,
                    taxes_and_charges: templateName,
                    taxes: res.data.message.map(t => ({
                        charge_type: t.charge_type,
                        account_head: t.account_head,
                        rate: t.rate,
                        description: t.description,
                        cost_center: t.cost_center
                    }))
                }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updateItem = (i, field, value) => {
        if (isViewOnly) return;
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            const q = parseFloat(items[i].qty) || 0;
            const r = parseFloat(items[i].rate) || 0;
            items[i].amount = q * r;
        }
        setForm(prev => ({ ...prev, items }));
        setIsDirty(true);
    };

    const removeItem = (i) => {
        if (isViewOnly) return;
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
        setIsDirty(true);
    };

    // ─── Totals ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const items = form.items || [];
        const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

        let discount = 0;
        if (form.apply_discount_on === 'Net Total') {
            discount = form.additional_discount_percentage ? (netTotal * form.additional_discount_percentage / 100) : (form.discount_amount || 0);
        }

        const baseForTax = netTotal - discount;
        const taxTotal = form.taxes.reduce((s, t) => s + (baseForTax * (parseFloat(t.rate) || 0) / 100), 0);

        let grand = baseForTax + taxTotal;
        if (form.apply_discount_on === 'Grand Total') {
            const grandDiscount = form.additional_discount_percentage ? (grand * form.additional_discount_percentage / 100) : (form.discount_amount || 0);
            grand -= grandDiscount;
        }

        const rounded = Math.round(grand);
        setForm(prev => ({
            ...prev,
            total_qty: Math.abs(totalQty),
            base_total: Math.abs(netTotal),
            total_taxes_and_charges: Math.abs(taxTotal),
            grand_total: grand,
            rounded_total: rounded,
            in_words: numberToWords(rounded, form.currency)
        }));
    }, [form.items, form.taxes, form.currency, form.apply_discount_on, form.additional_discount_percentage, form.discount_amount]);

    // Tracking dirty state
    useEffect(() => {
        if (showModal) setIsDirty(true);
    }, [form.items, form.customer, form.set_warehouse, form.posting_date]);

    // ─── Items ──────────────────────────────────────────────────────────────────

    const searchItems = async (query) => {
        if (!query || query.trim().length < 2) return;
        try {
            const res = await axios.get(
                '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_dn',
                { params: { query } }
            );
            setAllItems(res.data.message || []);
        } catch (err) { /* silent */ }
    };

    // ─── Actions ────────────────────────────────────────────────────────────────

    const handleCreateInvoice = () => {
        if (!form.name) return;
        navigate(`/salesinvoice?dn=${encodeURIComponent(form.name)}`);
        setShowModal(false);
    };

    const handleDocAction = async (action) => {
        if (!form.customer || !form.set_warehouse) {
            Swal.fire({ icon: 'warning', title: 'Missing Info', text: 'Customer and Branch are required.', target: '.so-modal' });
            return;
        }

        if (form.items.length === 0) {
            Swal.fire({ icon: 'warning', title: 'No Items', text: 'At least one item is required.', target: '.so-modal' });
            return;
        }

        const confirmText = {
            submit: "Are you sure you want to SUBMIT this Delivery Note? This will update stock.",
            cancel: "Are you sure you want to CANCEL this Delivery Note?",
            delete: "Are you sure you want to DELETE this Draft?",
            amend: "This will create a new Draft based on this Cancelled document. Proceed?"
        };

        if (confirmText[action]) {
            const result = await Swal.fire({
                title: 'Confirm Action',
                text: confirmText[action],
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: themeColor,
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, proceed',
                target: '.so-modal'
            });
            if (!result.isConfirmed) return;
        }

        setSaving(true);
        try {
            if (action === 'save') {
                const payload = {
                    ...form,
                    doctype: 'Delivery Note',
                    items: form.items.map(i => ({
                        ...i,
                        warehouse: i.warehouse || form.set_warehouse,
                        qty: form.is_return ? -Math.abs(i.qty) : Math.abs(i.qty)
                    }))
                };

                let res;
                if (form.name) {
                    res = await frappeCall({ method: 'frappe.client.save', args: { doc: payload } });
                } else {
                    res = await frappeCall({ method: 'frappe.client.insert', args: { doc: payload } });
                }

                if (res) {
                    setForm(prev => ({ ...prev, ...res }));
                    setIsDirty(false);
                    Swal.fire({ icon: 'success', title: 'Saved', text: 'Document saved as Draft.', timer: 1500, showConfirmButton: false, target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'submit') {
                const payload = {
                    ...form,
                    doctype: 'Delivery Note',
                    items: form.items.map(i => ({
                        ...i,
                        warehouse: i.warehouse || form.set_warehouse,
                        qty: form.is_return ? -Math.abs(i.qty) : Math.abs(i.qty)
                    }))
                };
                const res = await frappeCall({
                    method: 'frappe.client.submit',
                    args: { doc: payload }
                });
                if (res) {
                    setForm(prev => ({ ...prev, ...res }));
                    setIsDirty(false);
                    setIsViewOnly(true);
                    Swal.fire({ icon: 'success', title: 'Submitted', text: 'Delivery Note submitted successfully.', target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'cancel') {
                const res = await frappeCall({
                    method: 'frappe.client.set_value',
                    args: { doctype: 'Delivery Note', name: form.name, fieldname: 'docstatus', value: 2 }
                });
                if (res) {
                    setForm(prev => ({ ...prev, docstatus: 2 }));
                    Swal.fire({ icon: 'info', title: 'Cancelled', text: 'Delivery Note has been cancelled.', target: '.so-modal' });
                    loadInitialData();
                }
            }
            else if (action === 'delete') {
                await frappeCall({ method: 'frappe.client.delete', args: { doctype: 'Delivery Note', name: form.name } });
                setShowModal(false);
                resetForm();
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Draft deleted.', timer: 1500, showConfirmButton: false });
                loadInitialData();
            }
            else if (action === 'amend') {
                const res = await frappeCall({
                    method: 'custom_retailpos.custom_retailpos.retail_api.retail.amend_document',
                    args: { doctype: 'Delivery Note', name: form.name }
                });
                if (res) {
                    setForm({ ...res, name: '' });
                    setIsViewOnly(false);
                    setIsDirty(true);
                    Swal.fire({ icon: 'success', title: 'Amended', text: 'New Draft created from previous document.', target: '.so-modal' });
                }
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Action Failed', text: err.message || 'Something went wrong', target: '.so-modal' });
        } finally {
            setSaving(false);
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
            setForm({ ...dn });
            setCustomerQuery(dn.customer_name || '');
            setAllowedActions(statusRes.data.data?.allowed_actions || []);
            setConnections(connectionsRes.data.data || {});

            setShowModal(true);
            setIsViewOnly(dn.docstatus !== 0);
            setIsDirty(false);
            setActiveTab('details');
        } catch (err) {
            alert('Error loading Delivery Note');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({
            name: '', title: '',
            naming_series: namingSeriesOptions[0] || 'MAT-DN-.YYYY.-',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: '',
            docstatus: 0,
            is_return: 0, return_against: '', currency: 'AED',
            selling_price_list: 'Standard Selling', items: [],
            taxes_and_charges: taxTemplates.length > 0 ? taxTemplates[0].name : '', taxes: [],
            apply_discount_on: 'Grand Total',
            additional_discount_percentage: 0,
            discount_amount: 0,
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
            grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsReturnMode(false);
        setReturnSourceDN(null);
        setCustomerQuery('');
        setBarcodeInput('');
        setItemQueries({});
        setActiveItemRow(null);
        setDropdownPosition(null);
        setIsDirty(false);
        setAllowedActions(['save', 'submit', 'delete']);
        setConnections({});
        setDefaultBranch();
    };

    // ─── Derived ─────────────────────────────────────────────────────────────────


    const paginatedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredNotes.length / pageSize);

    // ─── Status color ────────────────────────────────────────────────────────────

    const getStatusStyle = (status) => {
        const s = status === 0 ? 'Draft' : status === 1 ? 'Submitted' : 'Cancelled';
        if (s === 'Submitted') return { background: `${themeColor}20`, color: themeColor, border: `1px solid ${themeColor}40` };
        if (s === 'Draft') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
        if (s === 'Cancelled') return { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' };
        return { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
    };

    const fieldStyle = {
        width: '100%', border: '1px solid #d1d5db', borderRadius: '0.375rem',
        padding: '0.55rem 0.875rem', fontSize: '0.875rem', outline: 'none',
        background: 'white', boxSizing: 'border-box', color: '#111827',
    };
    const fieldReadonly = {
        ...fieldStyle, background: '#f9fafb', color: '#6b7280', cursor: 'default',
    };
    const lbl = {
        display: 'block', fontSize: '0.875rem', fontWeight: 500,
        color: '#374151', marginBottom: '0.375rem',
    };

    return (
        <>
            <div className="so-page">
                <div className="so-page-header">
                    <div>
                        <h1 className="so-page-title"><Package size={20} /> Delivery Note</h1>
                        <p className="so-page-subtitle">Manage and track all delivery notes</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            onClick={() => setDnTheme(isGreen ? 'blue' : 'green')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.45rem 0.9rem', background: '#f8fafc',
                                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase'
                            }}
                        >
                            <Palette size={13} /> {dnTheme.toUpperCase()}
                        </button>
                        <button className="so-btn-primary" onClick={() => navigate('/deliverynote/create')}>
                            <Plus size={16} /> New Delivery Note
                        </button>
                    </div>
                </div>

                <div className="so-layout" style={{ flexDirection: 'column' }}>
                    <div style={{ background: 'white', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--so-border)', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
                        <div className="so-filter-group" style={{ minWidth: '200px', flex: 1 }}>
                            <label className="so-filter-label">Search</label>
                            <input className="so-filter-input" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label">Status</label>
                            <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="all">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                        <button className="so-clear-btn" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>Clear</button>
                    </div>

                    <div className="so-content" style={{ padding: '1.5rem' }}>
                        <div className="so-table-card">
                            <div className="so-table-wrapper">
                                <table className="so-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Status</th>
                                            <th>Customer</th>
                                            <th style={{ textAlign: 'right' }}>Grand Total</th>
                                            <th>ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="5" className="so-empty"><Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} /></td></tr>
                                        ) : paginatedNotes.map(dn => (
                                            <tr key={dn.name} onClick={() => navigate(`/deliverynote-details/${encodeURIComponent(dn.name)}`)} style={{ cursor: 'pointer' }}>
                                                <td style={{ fontWeight: 600 }}>{dn.title || 'Cash'}</td>
                                                <td><span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', ...getStatusStyle(dn.docstatus) }}>{dn.docstatus === 0 ? 'Draft' : dn.docstatus === 1 ? 'Submitted' : 'Cancelled'}</span></td>
                                                <td>{dn.customer_name}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{getCurrencySymbol(dn.currency)} {Number(dn.grand_total).toLocaleString()}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{dn.name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};


export default DeliveryNoteList;