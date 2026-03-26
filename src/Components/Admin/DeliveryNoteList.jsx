import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Package, Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette
} from 'lucide-react';
import '../Admin/SalesOrder.css';

const DeliveryNoteList = () => {
    const navigate = useNavigate();

    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnSourceDN, setReturnSourceDN] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [submittedReturnData, setSubmittedReturnData] = useState(null);
    const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');

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
        posting_date: new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().slice(0, 5),
        customer: '',
        customer_name: '',
        is_return: 0,
        return_against: '',
        set_warehouse: '',
        currency: 'INR',
        selling_price_list: 'Standard Selling',
        ignore_pricing_rule: 0,
        items: [],
        taxes_and_charges: '',
        taxes: [],
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
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return 'AED ';   // avoid RTL rendering issues with Arabic symbol
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

    // ─── Data Loading ───────────────────────────────────────────────────────────

    const loadDeliveryNotes = async () => {
        try {
            setLoading(true);
            const [custRes, whRes, taxRes, plRes, dnRes, companyRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                axios.get('/api/method/frappe.client.get_list', {
                    params: { doctype: 'Price List', filters: { selling: 1 }, fields: ['name'] }
                }),
                axios.get('/api/resource/Delivery Note', {
                    params: {
                        fields: '["name","customer_name","posting_date","grand_total","status","title","company","modified","is_return","return_against","currency","issue_credit_note"]',
                        limit_page_length: 2000,
                        order_by: 'modified desc'
                    }
                }),
                axios.get('/api/resource/Company')
            ]);

            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setPriceLists(plRes.data.data?.map(pl => pl.name) || ['Standard Selling']);
            setDeliveryNotes(dnRes.data.data || []);
            setFilteredNotes(dnRes.data.data || []);

            if (companyRes.data.data?.length > 0) {
                setDefaultIncomeAccount(companyRes.data.data[0].default_income_account || '');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDeliveryNotes(); }, []);

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

    // ─── Totals ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const items = form.items || [];
        const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const taxTotal = form.taxes.reduce((s, t) => s + (netTotal * (parseFloat(t.rate) || 0) / 100), 0);
        const grand = netTotal + taxTotal;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.items, form.taxes, form.currency]);

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

    const addItemRow = () => {
        if (isReturnMode) return;
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: 'Nos', rate: 0, amount: 0 }]
        }));
    };

    const selectItem = async (idx, item) => {
        if (isReturnMode) return;
        const items = [...form.items];
        items[idx] = {
            item_code: item.item_code,
            item_name: item.item_name,
            uom: item.stock_uom || 'Nos',
            qty: items[idx].qty || 1,
            rate: 0,
            amount: 0
        };
        try {
            const res = await axios.get(
                '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_dn',
                { params: { item_code: item.item_code, price_list: form.selling_price_list } }
            );
            items[idx].rate = res.data.message?.rate || 0;
        } catch (e) { console.error(e); }
        items[idx].amount = items[idx].qty * items[idx].rate;
        setForm(prev => ({ ...prev, items }));
        setItemQueries(prev => ({ ...prev, [idx]: '' }));
        setActiveItemRow(null);
        setDropdownPosition(null);
    };

    const updateItem = (i, field, value) => {
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
        }
        setForm(prev => ({ ...prev, items }));
    };

    const removeItem = (i) => {
        if (isReturnMode) return;
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
    };

    // ─── Barcode ─────────────────────────────────────────────────────────────────

    const handleBarcodeScan = async (e) => {
        if (e.key !== 'Enter' || !barcodeInput.trim()) return;
        e.preventDefault();
        const barcode = barcodeInput.trim();
        try {
            const checkRes = await axios.get(
                '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists',
                { params: { barcode } }
            );
            if (checkRes.data.message.exists) {
                const itemCode = checkRes.data.message.item;
                const itemRes = await axios.get(
                    '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si',
                    { params: { query: itemCode } }
                );
                const itemsList = itemRes.data.message || [];
                if (itemsList.length > 0) {
                    const item = itemsList[0];
                    let rate = 0;
                    try {
                        const rateRes = await axios.get(
                            '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si',
                            { params: { item_code: item.item_code, price_list: form.selling_price_list } }
                        );
                        rate = rateRes.data.rate || rateRes.data.message?.rate || 0;
                    } catch (err) { /* silent */ }
                    setForm(prev => ({
                        ...prev,
                        items: [...prev.items, {
                            item_code: item.item_code,
                            item_name: item.item_name,
                            qty: 1,
                            uom: item.stock_uom || 'Nos',
                            rate,
                            amount: rate,
                            income_account: defaultIncomeAccount
                        }]
                    }));
                    setBarcodeInput('');
                    setTimeout(() => { document.getElementById('barcode-scan-input')?.focus(); }, 100);
                } else {
                    alert('Item details not found');
                }
            } else {
                alert('Invalid barcode - No item found');
            }
        } catch (err) {
            console.error(err);
            alert('Error scanning barcode: ' + (err.response?.data?.message || err.message));
        }
    };

    // ─── Tax ────────────────────────────────────────────────────────────────────

    const applyTaxTemplate = async (template) => {
        if (!template) {
            setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
            return;
        }
        try {
            const res = await axios.get(
                '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn',
                { params: { template } }
            );
            setForm(prev => ({ ...prev, taxes: res.data.message || [], taxes_and_charges: template }));
        } catch (err) { /* silent */ }
    };

    // ─── Load Single DN ──────────────────────────────────────────────────────────

    const loadDeliveryNote = async (dnName, forceReturn = false) => {
        try {
            const res = await axios.get(`/api/resource/Delivery Note/${dnName}`);
            const dn = res.data.data;
            let formData;

            if (forceReturn) {
                const items = dn.items.map(i => ({
                    item_code: i.item_code,
                    item_name: i.item_name,
                    qty: -Math.abs(i.qty),
                    uom: i.uom || 'Nos',
                    rate: i.rate,
                    amount: -Math.abs(i.amount),
                    return_against: i.name
                }));
                formData = {
                    name: '',
                    title: dn.title || 'Cash',
                    posting_date: new Date().toISOString().split('T')[0],
                    posting_time: new Date().toTimeString().slice(0, 5),
                    customer: dn.customer || '',
                    customer_name: dn.customer_name || '',
                    is_return: 1,
                    return_against: dn.name,
                    set_warehouse: dn.set_warehouse || '',
                    currency: dn.currency || 'INR',
                    selling_price_list: dn.selling_price_list || 'Standard Selling',
                    ignore_pricing_rule: dn.ignore_pricing_rule || 0,
                    items,
                    taxes_and_charges: dn.taxes_and_charges || '',
                    taxes: dn.taxes || [],
                    total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
                    grand_total: 0, rounded_total: 0, in_words: ''
                };
                setIsReturnMode(true);
                setReturnSourceDN(dn.name);
                setIsViewOnly(false);
            } else {
                const items = dn.items.map(i => ({
                    item_code: i.item_code,
                    item_name: i.item_name,
                    qty: i.qty,
                    uom: i.uom || 'Nos',
                    rate: i.rate,
                    amount: i.amount,
                    return_against: i.return_against || ''
                }));
                formData = {
                    name: dn.name,
                    title: dn.title || 'Cash',
                    posting_date: dn.posting_date,
                    posting_time: dn.posting_time || new Date().toTimeString().slice(0, 5),
                    customer: dn.customer || '',
                    customer_name: dn.customer_name || '',
                    is_return: dn.is_return || 0,
                    return_against: dn.return_against || '',
                    set_warehouse: dn.set_warehouse || '',
                    currency: dn.currency || 'INR',
                    selling_price_list: dn.selling_price_list || 'Standard Selling',
                    ignore_pricing_rule: dn.ignore_pricing_rule || 0,
                    items,
                    taxes_and_charges: dn.taxes_and_charges || '',
                    taxes: dn.taxes || [],
                    total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
                    grand_total: 0, rounded_total: 0, in_words: ''
                };
                setIsReturnMode(!!dn.is_return);
                setReturnSourceDN(dn.return_against || null);
                setIsViewOnly(true);
            }

            setForm(formData);
            setSearchCustomer(dn.customer_name || '');
            setShowModal(true);
        } catch (err) {
            alert('Error loading Delivery Note');
        }
    };

    // ─── Save ────────────────────────────────────────────────────────────────────

    const saveDeliveryNote = async (submit = false) => {
        if (!form.customer || !form.set_warehouse || form.items.length === 0 ||
            form.items.some(i => !i.item_code || !i.item_name)) {
            alert('Please fill all required fields and items properly.');
            return;
        }
        setSaving(true);

        const payload = {
            doctype: 'Delivery Note',
            title: form.title || 'Cash',
            posting_date: form.posting_date,
            posting_time: form.posting_time,
            customer: form.customer,
            set_warehouse: form.set_warehouse,
            is_return: form.is_return ? 1 : 0,
            return_against: form.return_against || undefined,
            currency: form.currency,
            selling_price_list: form.selling_price_list,
            ignore_pricing_rule: form.ignore_pricing_rule,
            update_stock: submit ? 1 : 0,
            items: form.items.map(i => ({
                item_code: i.item_code,
                item_name: i.item_name,
                qty: form.is_return ? i.qty : Math.abs(i.qty),
                rate: i.rate,
                uom: i.uom,
                conversion_factor: i.conversion_factor || 1,
                return_against: form.is_return ? i.return_against : undefined
            })),
            taxes_and_charges: form.taxes_and_charges || undefined,
            taxes: form.taxes || []
        };
        if (submit) payload.docstatus = 1;

        try {
            let newDocName;
            if (form.name) {
                await axios.put(`/api/resource/Delivery Note/${form.name}`, payload);
                newDocName = form.name;
            } else {
                const res = await axios.post('/api/resource/Delivery Note', payload);
                newDocName = res.data.data.name;
            }

            if (!form.name && !submit) {
                setForm(prev => ({ ...prev, name: newDocName }));
            }

            if (submit && form.is_return && form.return_against) {
                await axios.post(
                    '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.update_dn_status_on_return',
                    { dn_name: form.return_against, status: 'Return Issued' }
                );
            }

            await loadDeliveryNotes();

            alert(
                submit
                    ? (form.is_return
                        ? 'Sales Return Submitted! Original DN marked as Return Issued'
                        : 'Delivery Note Submitted Successfully!')
                    : 'Saved as Draft Successfully!'
            );

            if (submit && form.is_return) {
                setSubmittedReturnData({
                    return_against: form.return_against,
                    customer: form.customer,
                    customer_name: form.customer_name,
                    currency: form.currency,
                    selling_price_list: form.selling_price_list,
                    taxes_and_charges: form.taxes_and_charges,
                    taxes: form.taxes,
                    items: form.items.map(i => ({
                        item_code: i.item_code, item_name: i.item_name,
                        qty: i.qty, rate: i.rate, amount: i.amount,
                        uom: i.uom, return_against: i.return_against
                    }))
                });
            }

            if (submit) {
                setShowModal(false);
                resetForm();
            }
        } catch (err) {
            console.error(err);
            alert('Error: ' + (err.response?.data?.message || err.message || 'Failed'));
        } finally {
            setSaving(false);
        }
    };

    // ─── Credit Note ─────────────────────────────────────────────────────────────

    const createCreditNote = () => {
        if (!submittedReturnData) return;
        const creditNoteData = {
            is_return: 1,
            return_against: submittedReturnData.return_against,
            customer: submittedReturnData.customer,
            customer_name: submittedReturnData.customer_name,
            posting_date: new Date().toISOString().split('T')[0],
            currency: submittedReturnData.currency,
            selling_price_list: submittedReturnData.selling_price_list,
            items: submittedReturnData.items.map(i => ({
                item_code: i.item_code, item_name: i.item_name,
                qty: Math.abs(i.qty), rate: i.rate,
                amount: Math.abs(i.amount), uom: i.uom
            })),
            taxes_and_charges: submittedReturnData.taxes_and_charges,
            taxes: submittedReturnData.taxes
        };
        navigate(`/salesinvoice?${new URLSearchParams({ returnData: JSON.stringify(creditNoteData) }).toString()}`);
    };

    const loadReturnForCreditNote = async (returnDNName) => {
        try {
            const res = await axios.get(`/api/resource/Delivery Note/${returnDNName}`);
            const dn = res.data.data;
            if (!dn.is_return) return;
            const creditNoteData = {
                is_return: 1,
                return_against: dn.return_against,
                customer: dn.customer,
                customer_name: dn.customer_name,
                posting_date: new Date().toISOString().split('T')[0],
                currency: dn.currency,
                selling_price_list: dn.selling_price_list,
                items: dn.items.map(i => ({
                    item_code: i.item_code, item_name: i.item_name,
                    qty: Math.abs(i.qty), rate: i.rate,
                    amount: Math.abs(i.amount), uom: i.uom || 'Nos'
                })),
                taxes_and_charges: dn.taxes_and_charges || '',
                taxes: dn.taxes || []
            };
            navigate(`/salesinvoice?${new URLSearchParams({ returnData: JSON.stringify(creditNoteData), autoOpen: 'true' }).toString()}`);
        } catch (err) {
            alert('Error loading return data for Credit Note');
            console.error(err);
        }
    };

    // ─── Reset ───────────────────────────────────────────────────────────────────

    const resetForm = () => {
        setForm({
            name: '', title: '',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: '',
            is_return: 0, return_against: '', currency: 'INR',
            selling_price_list: 'Standard Selling', items: [],
            taxes_and_charges: '', taxes: [],
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0,
            grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsReturnMode(false);
        setReturnSourceDN(null);
        setSearchCustomer('');
        setItemQueries({});
        setActiveItemRow(null);
        setDropdownPosition(null);
    };

    // ─── Derived ─────────────────────────────────────────────────────────────────

    const filteredCustomers = useMemo(() => customers.filter(c =>
        c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.name?.toLowerCase().includes(searchCustomer.toLowerCase())
    ).slice(0, 10), [searchCustomer, customers]);

    const netTotal = form.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const paginatedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredNotes.length / pageSize);

    // ─── Status color ────────────────────────────────────────────────────────────

    const getStatusStyle = (status, dn) => {
        const s = status || 'Draft';
        if (s === 'Completed' || s === 'Submitted') return {
            background: `${themeColor}20`, color: themeColor, border: `1px solid ${themeColor}40`
        };
        if (s === 'Draft') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
        if (s === 'Cancelled') return { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' };
        return { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' };
    };

    // ─── Shared field style constants ────────────────────────────────────────────
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

    // ─── Render ──────────────────────────────────────────────────────────────────

    return (
        <>
            <NavBar />
            <div className="so-page">

                {/* ── Page Header ── */}
                <div className="so-page-header">
                    <div>
                        <h1 className="so-page-title">
                            <Package size={20} /> Delivery Note
                        </h1>
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
                                cursor: 'pointer', transition: 'all 0.2s',
                                textTransform: 'uppercase', letterSpacing: '0.04em'
                            }}
                            title="Toggle Theme"
                        >
                            <Palette size={13} /> {dnTheme.toUpperCase()}
                        </button>
                        <button
                            className="so-btn-primary"
                            onClick={() => { resetForm(); setIsViewOnly(false); setShowModal(true); }}
                        >
                            <Plus size={16} /> New Delivery Note
                        </button>
                    </div>
                </div>

                <div className="so-layout" style={{ flexDirection: 'column' }}>

                    {/* ── Filter Bar ── */}
                    <div style={{
                        background: 'white', padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid var(--so-border)',
                        display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end'
                    }}>
                        {[
                            { label: 'Search', ph: 'Search anything...', val: searchTerm, set: setSearchTerm },
                            { label: 'Title', ph: 'e.g., Cash', val: titleFilter, set: setTitleFilter },
                            { label: 'Customer', ph: 'Customer name...', val: customerFilter, set: setCustomerFilter },
                            { label: 'Company', ph: 'Company name...', val: companyFilter, set: setCompanyFilter },
                        ].map(f => (
                            <div key={f.label} className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                                <label className="so-filter-label">{f.label}</label>
                                <input className="so-filter-input" placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                            </div>
                        ))}

                        <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                            <label className="so-filter-label">Status</label>
                            <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.4rem' }}>
                                <option value="all">All Status</option>
                                {['Draft', 'Return', 'To Bill', 'Submitted', 'Completed', 'Return Issued'].map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label">Amount Range</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                            </div>
                        </div>

                        <button
                            className="so-clear-btn"
                            style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1rem' }}
                            onClick={() => {
                                setSearchTerm(''); setTitleFilter(''); setCustomerFilter('');
                                setCompanyFilter(''); setStatusFilter('all'); setMinAmount(''); setMaxAmount('');
                            }}
                        >
                            Clear Filters
                        </button>
                    </div>

                    {/* ── Table ── */}
                    <div className="so-content" style={{ padding: '1.5rem' }}>
                        <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>
                            {filteredNotes.length} record(s) found
                        </p>
                        <div className="so-table-card">
                            <div className="so-table-wrapper">
                                <table className="so-table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Status</th>
                                            <th>Customer</th>
                                            <th>Company</th>
                                            <th style={{ textAlign: 'right' }}>Grand Total</th>
                                            <th>ID</th>
                                            <th style={{ width: '140px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan="7" className="so-empty">
                                                    <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                                                </td>
                                            </tr>
                                        ) : paginatedNotes.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="so-empty">No delivery notes found</td>
                                            </tr>
                                        ) : paginatedNotes.map(dn => (
                                            <tr key={dn.name} onClick={() => loadDeliveryNote(dn.name, false)} style={{ cursor: 'pointer' }}>
                                                <td style={{ fontWeight: 600 }}>{dn.title || 'Cash'}</td>
                                                <td>
                                                    <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', ...getStatusStyle(dn.status, dn) }}>
                                                        {dn.status || 'Draft'}{dn.is_return ? ' (Return)' : ''}
                                                    </span>
                                                </td>
                                                <td>{dn.customer_name || 'Cash'}</td>
                                                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{dn.company || 'Your Company'}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                    <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>
                                                        {getCurrencySymbol(dn.currency)}{dn.is_return ? '-' : ''}
                                                        {Number(Math.abs(dn.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>
                                                    {dn.name}
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {dn.status === 'To Bill' && !dn.is_return && dn.issue_credit_note !== 1 && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); loadDeliveryNote(dn.name, true); }}
                                                                className="so-btn-primary"
                                                                style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem', background: '#ef4444' }}
                                                            >
                                                                <ArrowLeft size={10} /> Return
                                                            </button>
                                                        )}
                                                        {dn.is_return === 1 &&
                                                            ['To Bill', 'Submitted'].includes(dn.status) &&
                                                            dn.issue_credit_note !== 1 && (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); loadReturnForCreditNote(dn.name); }}
                                                                    className="so-btn-primary"
                                                                    style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem', background: '#6366f1' }}
                                                                >
                                                                    <FileMinus size={10} /> Credit Note
                                                                </button>
                                                            )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {filteredNotes.length > 0 && (
                                <div style={{
                                    padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                                        Showing {Math.min((currentPage - 1) * pageSize + 1, filteredNotes.length)}–
                                        {Math.min(currentPage * pageSize, filteredNotes.length)} of {filteredNotes.length}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                                            {[20, 100, 500, 2500].map(num => (
                                                <button
                                                    key={num}
                                                    onClick={() => { setPageSize(num); setCurrentPage(1); }}
                                                    className={`so-page-btn ${pageSize === num ? 'active' : ''}`}
                                                    style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                                <ChevronLeft size={14} />
                                            </button>
                                            <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>
                                                {currentPage} / {totalPages}
                                            </span>
                                            <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════
                    MODAL — Full screen with proper flex layout so all content
                    is reachable and footer stays pinned at bottom
                ══════════════════════════════════════════════════════════════ */}
                {showModal && (
                    <div
                        className="so-modal-overlay"
                        onClick={e => e.target === e.currentTarget && (setShowModal(false), resetForm())}
                        style={{ padding: 0 }}
                    >
                        <div
                            className="so-modal"
                            style={{
                                maxWidth: 'none',
                                width: '100vw',
                                height: '100vh',
                                margin: 0,
                                borderRadius: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'          /* ← prevents outer scroll */
                            }}
                        >
                            {/* Header */}
                            <div
                                className="so-modal-header"
                                style={{
                                    flexShrink: 0,
                                    padding: '1rem 1.5rem',
                                    borderBottom: '2px solid var(--so-border)',
                                    background: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    minHeight: '60px',
                                }}
                            >
                                <h2 className="so-modal-title">
                                    {isReturnMode ? (
                                        <><ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                                            Sales Return — {returnSourceDN}</>
                                    ) : (
                                        <><FileText size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                                            {form.name ? `Delivery Note — ${form.name}` : 'New Delivery Note'}</>
                                    )}
                                </h2>
                                <button className="so-modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Body — scrollable, takes remaining height */}
                            <div
                                style={{
                                    flex: '1 1 auto',
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    backgroundColor: '#f8fafc',
                                    padding: '1.5rem',
                                }}
                            >
                                {/* ── Full Width content container ── */}
                                <div style={{
                                    maxWidth: '100%',
                                    margin: '0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                }}>

                                    {/* Basic Info Card */}
                                    <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                        {/* Row 1: Customer / Date / Time */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                                            {/* Customer */}
                                            <div>
                                                <label style={lbl}>Customer <span style={{ color: '#ef4444' }}>*</span></label>
                                                <div className="relative">
                                                    {(isViewOnly || isReturnMode) ? (
                                                        <div style={fieldReadonly}>{form.customer_name || 'Cash'}</div>
                                                    ) : (
                                                        <>
                                                            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                value={searchCustomer}
                                                                onChange={e => setSearchCustomer(e.target.value)}
                                                                onFocus={() => setShowCustomerDropdown(true)}
                                                                placeholder="Search customer..."
                                                                style={{ ...fieldStyle, paddingLeft: '2.5rem' }}
                                                            />
                                                            {showCustomerDropdown && filteredCustomers.length > 0 && (
                                                                <div style={{ position: 'absolute', zIndex: 50, marginTop: '4px', width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.375rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                                                    {filteredCustomers.map(c => (
                                                                        <div key={c.name} onClick={() => { setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name })); setSearchCustomer(c.customer_name); setShowCustomerDropdown(false); }} style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                                                                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.customer_name}</div>
                                                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.name}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Date */}
                                            <div>
                                                <label style={lbl}>Date <span style={{ color: '#ef4444' }}>*</span></label>
                                                <input type="date" disabled={isViewOnly} value={form.posting_date}
                                                    onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))}
                                                    style={isViewOnly ? fieldReadonly : fieldStyle} />
                                            </div>

                                            {/* Time */}
                                            <div>
                                                <label style={lbl}>Time <span style={{ color: '#ef4444' }}>*</span></label>
                                                <input type="time" disabled={isViewOnly} value={form.posting_time}
                                                    onChange={e => setForm(prev => ({ ...prev, posting_time: e.target.value }))}
                                                    style={isViewOnly ? fieldReadonly : fieldStyle} />
                                            </div>

                                            {/* Title (moved to same row to save space) */}
                                            <div>
                                                <label style={lbl}>Title</label>
                                                <input type="text" value={form.title} disabled={isViewOnly} placeholder="e.g., Cash"
                                                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                                    style={isViewOnly ? fieldReadonly : fieldStyle} />
                                            </div>
                                        </div>






                                        {/* Row 3: Is Return */}
                                        <div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', width: 'fit-content' }}>
                                                <input type="checkbox" checked={!!form.is_return} disabled={isReturnMode || isViewOnly}
                                                    onChange={e => !isReturnMode && setForm(prev => ({ ...prev, is_return: e.target.checked ? 1 : 0 }))}
                                                    style={{ width: '16px', height: '16px', accentColor: themeColor }} />
                                                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Is Return</span>
                                            </label>
                                        </div>

                                        {/* Row 4: Currency / Price List / Ignore Rule */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                            <div>
                                                <label style={lbl}>Currency <span style={{ color: '#ef4444' }}>*</span></label>
                                                <select value={form.currency} disabled={isViewOnly} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                                                    style={isViewOnly ? fieldReadonly : fieldStyle}>
                                                    <option value="INR">INR - Indian Rupee</option>
                                                    <option value="AED">AED - UAE Dirham</option>
                                                    <option value="USD">USD - US Dollar</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={lbl}>Price List <span style={{ color: '#ef4444' }}>*</span></label>
                                                <select value={form.selling_price_list} disabled={isViewOnly} onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))}
                                                    style={isViewOnly ? fieldReadonly : fieldStyle}>
                                                    {priceLists.map(pl => <option key={pl}>{pl}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={!!form.ignore_pricing_rule} disabled={isViewOnly}
                                                        onChange={e => setForm(prev => ({ ...prev, ignore_pricing_rule: e.target.checked ? 1 : 0 }))}
                                                        style={{ width: '16px', height: '16px', accentColor: themeColor }} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Ignore Pricing Rule</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Row 5: Warehouse */}
                                        <div>
                                            <label style={lbl}>Branch <span style={{ color: '#ef4444' }}>*</span></label>
                                            <select disabled={isViewOnly} value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))}
                                                style={{ ...(isViewOnly ? fieldReadonly : fieldStyle), maxWidth: '480px' }}>
                                                <option value="">Select Branch</option>
                                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                            </select>
                                        </div>

                                    </div>{/* end Card: Basic Info */}

                                    {/* Row 6: Barcode (only in edit mode) */}
                                    {!isViewOnly && (
                                        <div style={{
                                            background: 'white',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #e2e8f0',
                                            padding: '1.25rem 1.5rem',
                                        }}>
                                            <label style={lbl}>Scan Barcode</label>
                                            <input
                                                id="barcode-scan-input"
                                                type="text"
                                                value={barcodeInput}
                                                onChange={e => setBarcodeInput(e.target.value)}
                                                onKeyDown={handleBarcodeScan}
                                                placeholder="Scan or type barcode → press Enter"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.75rem 1.25rem',
                                                    fontSize: '1.1rem',
                                                    fontFamily: 'monospace',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '0.5rem',
                                                    outline: 'none',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.375rem' }}>
                                                Scanner auto-submits on Enter • Fast scanning ready!
                                            </p>
                                        </div>
                                    )}

                                    {/* Row 7: Items Table */}
                                    <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', margin: 0 }}>Items</h3>
                                            {!isViewOnly && !isReturnMode && (
                                                <button onClick={addItemRow} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 500, color: themeColor, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <Plus size={14} /> Add Item
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '40px' }}>#</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '200px' }}>Item Code</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Item Name</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '90px' }}>Qty</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '80px' }}>UOM</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '120px' }}>Rate ({form.currency})</th>
                                                        <th style={{ padding: '0.7rem 1rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', width: '130px' }}>Amount ({form.currency})</th>
                                                        {!isViewOnly && !isReturnMode && <th style={{ width: '50px' }}></th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.items.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={(!isViewOnly && !isReturnMode) ? "8" : "7"} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', fontSize: '0.875rem' }}>No items added yet</td>
                                                        </tr>
                                                    ) : form.items.map((item, i) => (
                                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#9ca3af' }}>{i + 1}</td>

                                                            {/* 1. Item Code Column */}
                                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                                {isReturnMode || isViewOnly ? (
                                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>{item.item_code}</div>
                                                                ) : (
                                                                    <div style={{ position: 'relative' }}>
                                                                        <input
                                                                            type="text"
                                                                            value={itemQueries[i] !== undefined ? itemQueries[i] : (item.item_code || '')}
                                                                            onChange={e => {
                                                                                const q = e.target.value;
                                                                                setItemQueries(prev => ({ ...prev, [i]: q }));
                                                                                if (q.length >= 2) searchItems(q);
                                                                            }}
                                                                            onFocus={e => {
                                                                                const rect = e.target.getBoundingClientRect();
                                                                                setDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: 300 });
                                                                                setActiveItemRow(i);
                                                                            }}
                                                                            placeholder="Search item code..."
                                                                            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem', outline: 'none' }}
                                                                        />
                                                                        {activeItemRow === i && dropdownPosition && (itemQueries[i] || '').length >= 2 && allItems.length > 0 && createPortal(
                                                                            <div style={{ position: 'fixed', top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, width: `${dropdownPosition.width}px`, background: 'white', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto' }}>
                                                                                {allItems.filter(it => it.item_code?.toLowerCase().includes((itemQueries[i] || '').toLowerCase()) || it.item_name?.toLowerCase().includes((itemQueries[i] || '').toLowerCase())).map(it => (
                                                                                    <div key={it.item_code} onMouseDown={() => selectItem(i, it)} style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>
                                                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{it.item_code}</div>
                                                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{it.item_name}</div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>, document.body
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* 2. Item Name Column */}
                                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                                                                {item.item_name || '-'}
                                                            </td>

                                                            {/* 3. QTY Column */}
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                                <input type="number" disabled={isViewOnly} value={item.qty ?? ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)}
                                                                    style={{ width: '70px', textAlign: 'center', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.375rem 0.4rem', fontSize: '0.875rem', background: isViewOnly ? '#f9fafb' : 'white', outline: 'none' }} />
                                                            </td>

                                                            {/* 4. UOM Column */}
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                                                                {item.uom || 'Nos'}
                                                            </td>

                                                            {/* 5. Rate Column */}
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                                <input type="number" disabled={isViewOnly} value={item.rate ?? ''} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} step="0.01"
                                                                    style={{ width: '100px', textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.375rem 0.5rem', fontSize: '0.875rem', background: isViewOnly ? '#f9fafb' : 'white', outline: 'none' }} />
                                                            </td>

                                                            {/* 6. Amount Column */}
                                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                                                                {getCurrencySymbol(form.currency)}{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </td>

                                                            {/* Actions */}
                                                            {!isViewOnly && !isReturnMode && (
                                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                                                    <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                                                        <X size={15} />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#374151' }}>
                                                Total Quantity: <strong style={{ fontSize: '1rem', color: '#111827' }}>{form.total_qty}</strong>
                                            </span>
                                        </div>
                                    </div>



                                    {/* Row 8 & 9: Tax Template + Breakdown */}
                                    <div style={{ background: 'white', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '0.375rem' }}>Taxes &amp; Charges Template</label>
                                            <select value={form.taxes_and_charges} disabled={isViewOnly} onChange={e => applyTaxTemplate(e.target.value)}
                                                style={{ width: '100%', maxWidth: '420px', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.5rem 0.875rem', fontSize: '0.875rem', background: isViewOnly ? '#f9fafb' : 'white', outline: 'none' }}>
                                                <option value="">No Tax</option>
                                                {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        {form.taxes.length > 0 && (
                                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                                                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.75rem' }}>Tax Breakdown</p>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <th style={{ textAlign: 'left', padding: '0.5rem 0', color: '#6b7280', fontWeight: 500 }}>Account Head</th>
                                                            <th style={{ textAlign: 'right', padding: '0.5rem 0', color: '#6b7280', fontWeight: 500, width: '80px' }}>Rate</th>
                                                            <th style={{ textAlign: 'right', padding: '0.5rem 0', color: '#6b7280', fontWeight: 500, width: '130px' }}>Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.taxes.map((t, i) => {
                                                            const amt = (t.rate / 100) * netTotal;
                                                            return (
                                                                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                    <td style={{ padding: '0.5rem 0', color: '#374151' }}>{t.account_head}</td>
                                                                    <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#374151' }}>{t.rate}%</td>
                                                                    <td style={{ textAlign: 'right', padding: '0.5rem 0', fontWeight: 500, color: '#111827', direction: 'ltr' }}>
                                                                        {getCurrencySymbol(form.currency)}{Number(amt).toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                                                            <td colSpan="2" style={{ textAlign: 'right', padding: '0.6rem 0', color: '#374151' }}>Total Tax</td>
                                                            <td style={{ textAlign: 'right', padding: '0.6rem 0', color: '#111827', direction: 'ltr' }}>
                                                                {getCurrencySymbol(form.currency)}{Number(form.total_taxes_and_charges).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 10: Grand Total Box */}
                                    <div style={{ background: '#0f172a', color: 'white', borderRadius: '0.75rem', padding: '2rem' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                                                Grand Total
                                            </div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em', direction: 'ltr' }}>
                                                {getCurrencySymbol(form.currency)}{Number(form.rounded_total).toFixed(2)}
                                            </div>
                                            {form.in_words && (
                                                <p style={{ fontSize: '0.85rem', opacity: 0.65, fontStyle: 'italic', marginTop: '0.75rem' }}>
                                                    {form.in_words}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* bottom padding so last content clears the footer shadow */}
                                    <div style={{ height: '1rem' }} />
                                </div>{/* end max-width container */}
                            </div>{/* end body */}

                            {/* Footer — always visible, pinned at bottom */}
                            <div
                                className="so-modal-footer"
                                style={{
                                    flexShrink: 0,
                                    borderTop: '1px solid var(--so-border)',
                                    background: 'white',
                                    padding: '0.875rem 1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <button
                                    className="so-btn-secondary"
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                >
                                    Cancel
                                </button>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {isViewOnly ? (
                                        <button
                                            className="so-btn-primary"
                                            onClick={() => setIsViewOnly(false)}
                                            style={{ background: '#6366f1', minWidth: '160px' }}
                                        >
                                            Edit Delivery Note
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="so-btn-secondary"
                                                onClick={() => saveDeliveryNote(false)}
                                                disabled={saving}
                                                style={{ minWidth: '120px' }}
                                            >
                                                {saving ? 'Saving...' : 'Save Draft'}
                                            </button>
                                            <button
                                                className="so-btn-primary"
                                                onClick={() => saveDeliveryNote(true)}
                                                disabled={saving}
                                                style={{ minWidth: '200px' }}
                                                title={!form.name ? 'Save as Draft first, then Submit' : ''}
                                            >
                                                {saving
                                                    ? <Loader2 size={14} className="so-spinner" />
                                                    : form.name
                                                        ? 'Submit Delivery Note'
                                                        : 'Save & Submit'
                                                }
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
};

export default DeliveryNoteList;