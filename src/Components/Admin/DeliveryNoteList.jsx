import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { Package, Plus, X, Search, Filter, ChevronDown, FileText, Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus, Palette } from 'lucide-react';
import '../Admin/SalesOrder.css';

const DeliveryNoteList = () => {
    const navigate = useNavigate();

    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnSourceDN, setReturnSourceDN] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [submittedReturnData, setSubmittedReturnData] = useState(null);
    const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');
    const [barcodeInput, setBarcodeInput] = useState('');

    // Theme toggle (synced across pages)
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


    const handleBarcodeScan = async (e) => {
        if (e.key === 'Enter' && barcodeInput.trim()) {
            e.preventDefault();
            const barcode = barcodeInput.trim();
    
            try {
                // Use safe backend method (bypasses child table permission)
                const checkRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', {
                    params: { barcode }
                });
    
                if (checkRes.data.message.exists) {
                    const itemCode = checkRes.data.message.item;
    
                    // Fetch full item details
                    const itemRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si', {
                        params: { query: itemCode }
                    });
    
                    const itemsList = itemRes.data.message || [];
                    if (itemsList.length > 0) {
                        const item = itemsList[0];
    
                        // Fetch rate
                        let rate = 0;
                        try {
                            const rateRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', {
                                params: {
                                    item_code: item.item_code,
                                    price_list: form.selling_price_list
                                }
                            });
                            rate = rateRes.data.rate || rateRes.data.message?.rate || 0;
                        } catch (err) { }
    
                        // Add to table
                        setForm(prev => ({
                            ...prev,
                            items: [...prev.items, {
                                item_code: item.item_code,
                                item_name: item.item_name,
                                qty: 1,
                                uom: item.stock_uom || 'Nos',
                                rate: rate,
                                amount: rate * 1,
                                income_account: defaultIncomeAccount
                            }]
                        }));
    
                        calculateTotals();
                        setBarcodeInput('');
                        // Focus back
                        setTimeout(() => {
                            const el = document.getElementById('barcode-scan-input');
                            if (el) el.focus();
                        }, 100);
                    } else {
                        alert("Item details not found");
                    }
                } else {
                    alert("Invalid barcode - No item found");
                }
            } catch (err) {
                console.error(err);
                alert("Error scanning barcode: " + (err.response?.data?.message || err.message));
            }
        }
    };

    const getCurrencySymbol = (currency = 'INR') => {
        switch (currency) {
            case 'INR': return '₹';
            case 'AED': return 'د.إ';
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
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Million', 'Billion'];
        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
            return convert(Math.floor(n / 1000)) + ' ' + scales[Math.log10(n) / 3 | 0 + 1] + (n % 1000 ? ' ' + convert(n % 1000) : '');
        };
        return convert(num).trim();
    };

    const numberToWords = (num, currency) => {
        if (!num) return '';
        const words = numToWords(Math.floor(Math.abs(num)));
        const currencyStr = getCurrencyName(currency);
        if (currencyStr) {
            return `${currencyStr} ${words} Only`;
        } else {
            return `${currency} ${words.charAt(0).toUpperCase() + words.slice(1)} Only.`;
        }
    };

    const loadDeliveryNotes = async () => {
        try {
            setLoading(true);
            const [custRes, whRes, taxRes, plRes, dnRes, companyRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                axios.get('/api/method/frappe.client.get_list', { params: { doctype: 'Price List', filters: { selling: 1 }, fields: ['name'] } }),
                axios.get('/api/resource/Delivery Note', {
                    params: {
                        fields: '["name","customer_name","posting_date","grand_total","status","title","company","modified","is_return","return_against","currency","issue_credit_note"]',
                        limit_page_length: 500,
                        order_by: 'modified desc'
                    }
                }),
                axios.get('/api/resource/Company')  // Default company list
            ]);

            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setPriceLists(plRes.data.data?.map(pl => pl.name) || ['Standard Selling']);
            setDeliveryNotes(dnRes.data.data || []);
            setFilteredNotes(dnRes.data.data || []);

            // Set default income account (first company usually default)
            if (companyRes.data.data?.length > 0) {
                const comp = companyRes.data.data[0];
                setDefaultIncomeAccount(comp.default_income_account || '');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDeliveryNotes();
    }, []);

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

    const getStatusColor = (status) => {
        switch (status || 'Draft') {
            case 'Draft': return 'bg-gray-100 text-gray-800';
            case 'Return': return 'bg-yellow-100 text-yellow-800';
            case 'To Bill': return 'bg-orange-100 text-orange-800';
            case 'Submitted': return 'bg-blue-100 text-blue-800';
            case 'Completed': return 'bg-green-100 text-green-800';
            case 'Cancelled': return 'bg-red-100 text-red-800';
            case 'Return Issued': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const calculateTotals = () => {
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
    };

    useEffect(() => {
        calculateTotals();
    }, [form.items, form.taxes, form.currency]);

    const searchItems = async (query) => {
        if (!query || query.trim().length < 2) return;
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_dn', { params: { query } });
            setAllItems(res.data.message || []);
        } catch (err) { }
    };

    const applyTaxTemplate = async (template) => {
        if (!template) {
            setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
            return;
        }
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn', { params: { template } });
            setForm(prev => ({ ...prev, taxes: res.data.message || [], taxes_and_charges: template }));
        } catch (err) { }
    };

    const addItemRow = () => {
        if (isReturnMode) return;
        setForm(prev => ({
            ...prev,
            items: [...prev.items, {
                item_code: '',
                item_name: '',
                qty: 1,
                uom: 'Nos',
                rate: 0,
                amount: 0
            }]
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
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_dn', {
                params: {
                    item_code: item.item_code,
                    price_list: form.selling_price_list
                }
            });
            items[idx].rate = res.data.message?.rate || 0;
        } catch (e) {
            console.error(e);
        }
        items[idx].amount = items[idx].qty * items[idx].rate;
        setForm(prev => ({ ...prev, items }));
        setItemQueries(prev => ({ ...prev, [idx]: '' }));
        setActiveItemRow(null);
        setDropdownPosition(null);
        calculateTotals();
    };

    const updateItem = (i, field, value) => {
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
        }
        setForm(prev => ({ ...prev, items }));
        calculateTotals();
    };

    const removeItem = (i) => {
        if (isReturnMode) return;
        setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
        calculateTotals();
    };

    const loadDeliveryNote = async (dnName, forceReturn = false) => {
        try {
            const res = await axios.get(`/api/resource/Delivery Note/${dnName}`);
            const dn = res.data.data;
            let items, formData;
            if (forceReturn) {
                items = dn.items.map(i => ({
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
                    items: items,
                    taxes_and_charges: dn.taxes_and_charges || '',
                    taxes: dn.taxes || [],
                    total_qty: 0,
                    base_total: 0,
                    total_taxes_and_charges: 0,
                    grand_total: 0,
                    rounded_total: 0,
                    in_words: ''
                };
                setIsReturnMode(true);
                setReturnSourceDN(dn.name);
            } else {
                items = dn.items.map(i => ({
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
                    items: items,
                    taxes_and_charges: dn.taxes_and_charges || '',
                    taxes: dn.taxes || [],
                    total_qty: 0,
                    base_total: 0,
                    total_taxes_and_charges: 0,
                    grand_total: 0,
                    rounded_total: 0,
                    in_words: ''
                };
                setIsReturnMode(!!dn.is_return);
                setReturnSourceDN(dn.return_against || null);
            }
            setForm(formData);
            setSearchCustomer(dn.customer_name || '');
            setShowModal(true);
            calculateTotals();
        } catch (err) {
            alert("Error loading Delivery Note");
        }
    };

    const saveDeliveryNote = async (submit = false) => {
        if (!form.customer || !form.set_warehouse || form.items.length === 0 || form.items.some(i => !i.item_code || !i.item_name)) {
            alert("Please fill all required fields and items properly.");
            return;
        }

        setSaving(true);

        const payload = {
            doctype: "Delivery Note",
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

        if (submit) {
            payload.docstatus = 1;
        }

        try {
            let newDocName;

            if (form.name) {
                await axios.put(`/api/resource/Delivery Note/${form.name}`, payload);
                newDocName = form.name;
            } else {
                const res = await axios.post('/api/resource/Delivery Note', payload);
                newDocName = res.data.data.name;
            }

            // Update the form with the saved name if it's a new document
            if (!form.name && !submit) {
                setForm(prev => ({ ...prev, name: newDocName }));
            }

            if (submit && form.is_return && form.return_against) {
                await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.update_dn_status_on_return', {
                    dn_name: form.return_against,
                    status: 'Return Issued'
                });
            }

            await loadDeliveryNotes(); // Refresh list

            alert(
                submit
                    ? (form.is_return
                        ? "Sales Return Submitted! Original DN marked as Return Issued"
                        : "Delivery Note Submitted Successfully!")
                    : "Saved as Draft Successfully!"
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
                        item_code: i.item_code,
                        item_name: i.item_name,
                        qty: i.qty,
                        rate: i.rate,
                        amount: i.amount,
                        uom: i.uom,
                        return_against: i.return_against
                    }))
                });
            }

            // Only close modal on Submit
            if (submit) {
                setShowModal(false);
                resetForm();
            }
            // If it's just Save Draft → Keep modal open, do NOT reset or close

        } catch (err) {
            console.error(err);
            alert("Error: " + (err.response?.data?.message || err.message || "Failed"));
        } finally {
            setSaving(false);
        }
    };

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
                item_code: i.item_code,
                item_name: i.item_name,
                qty: Math.abs(i.qty),
                rate: i.rate,
                amount: Math.abs(i.amount),
                uom: i.uom
            })),
            taxes_and_charges: submittedReturnData.taxes_and_charges,
            taxes: submittedReturnData.taxes
        };

        const params = new URLSearchParams({
            returnData: JSON.stringify(creditNoteData)
        });

        navigate(`/salesinvoice?${params.toString()}`);
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
                    item_code: i.item_code,
                    item_name: i.item_name,
                    qty: Math.abs(i.qty),
                    rate: i.rate,
                    amount: Math.abs(i.amount),
                    uom: i.uom || 'Nos'
                })),
                taxes_and_charges: dn.taxes_and_charges || '',
                taxes: dn.taxes || []
            };

            const params = new URLSearchParams({
                returnData: JSON.stringify(creditNoteData),
                autoOpen: 'true'
            });

            navigate(`/salesinvoice?${params.toString()}`);
        } catch (err) {
            alert("Error loading return data for Credit Note");
            console.error(err);
        }
    };

    const resetForm = () => {
        setForm({
            name: '',
            title: '',
            posting_date: new Date().toISOString().split('T')[0],
            posting_time: new Date().toTimeString().slice(0, 5),
            customer: '', customer_name: '', set_warehouse: '',
            is_return: 0, return_against: '', currency: 'INR', selling_price_list: 'Standard Selling',
            items: [], taxes_and_charges: '', taxes: [],
            total_qty: 0, base_total: 0, total_taxes_and_charges: 0, grand_total: 0, rounded_total: 0, in_words: ''
        });
        setIsReturnMode(false);
        setReturnSourceDN(null);
        setSearchCustomer('');
        setItemQueries({});
        setActiveItemRow(null);
        setDropdownPosition(null);
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c =>
            c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
            c.name?.toLowerCase().includes(searchCustomer.toLowerCase())
        ).slice(0, 10);
    }, [searchCustomer, customers]);

    const netTotal = form.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const paginatedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredNotes.length / pageSize);

    return (
        <>
            <NavBar />
            <div className="so-page">
                {/* Page Header */}
                <div className="so-page-header">
                    <div>
                        <h1 className="so-page-title">
                            <Package size={20} /> Delivery Note
                        </h1>
                        <p className="so-page-subtitle">Manage and track all delivery notes</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Theme Toggle */}
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
                            <Palette size={13} />
                            {dnTheme.toUpperCase()}
                        </button>
                        <button
                            className="so-btn-primary"
                            onClick={() => { resetForm(); setShowModal(true); }}
                        >
                            <Plus size={16} /> New Delivery Note
                        </button>
                    </div>
                </div>

                <div className="so-layout" style={{ flexDirection: 'column' }}>
                    {/* Top Filters Bar */}
                    <div className="so-filter-bar" style={{ 
                        background: 'white', 
                        padding: '1.25rem 1.5rem', 
                        borderBottom: '1px solid var(--so-border)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1.25rem',
                        alignItems: 'flex-end'
                    }}>
                        <div className="so-filter-group" style={{ minWidth: '150px', flex: 1 }}>
                            <label className="so-filter-label">Search</label>
                            <input className="so-filter-input" placeholder="Search anything..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                            <label className="so-filter-label">Title</label>
                            <input className="so-filter-input" placeholder="e.g., Cash" value={titleFilter} onChange={e => setTitleFilter(e.target.value)} />
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                            <label className="so-filter-label">Customer</label>
                            <input className="so-filter-input" placeholder="Customer name..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} />
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                            <label className="so-filter-label">Company</label>
                            <input className="so-filter-input" placeholder="Company name..." value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} />
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '120px', flex: 1 }}>
                            <label className="so-filter-label">Status</label>
                            <select className="so-filter-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.4rem' }}>
                                <option value="all">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Return">Return</option>
                                <option value="To Bill">To Bill</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Completed">Completed</option>
                                <option value="Return Issued">Return Issued</option>
                            </select>
                        </div>

                        <div className="so-filter-group" style={{ minWidth: '140px', flex: 1 }}>
                            <label className="so-filter-label">Amount Range</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input className="so-filter-input" type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                                <input className="so-filter-input" type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                            </div>
                        </div>

                        <button className="so-clear-btn" style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1rem' }} onClick={() => {
                            setSearchTerm(''); setTitleFilter(''); setCustomerFilter(''); setCompanyFilter(''); setStatusFilter('all'); setMinAmount(''); setMaxAmount('');
                        }}>
                            Clear Filters
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="so-content" style={{ padding: '1.5rem' }}>
                        <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{filteredNotes.length} record(s) found</p>
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
                                            <th style={{ width: '120px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan="7" className="so-empty"><Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} /></td></tr>
                                        ) : paginatedNotes.length === 0 ? (
                                            <tr><td colSpan="7" className="so-empty">No delivery notes found</td></tr>
                                        ) : (
                                            paginatedNotes.map(dn => (
                                                <tr key={dn.name} onClick={() => loadDeliveryNote(dn.name, false)} style={{ cursor: 'pointer' }}>
                                                    <td style={{ fontWeight: 600 }}>{dn.title || 'Cash'}</td>
                                                    <td>
                                                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                                                            backgroundColor: (dn.status === 'Completed' || dn.status === 'Submitted') ? `${themeColor}20` : (dn.status === 'Draft' ? '#f1f5f9' : (dn.status === 'Cancelled' ? '#fee2e2' : '#fef9c3')),
                                                            color: (dn.status === 'Completed' || dn.status === 'Submitted') ? themeColor : (dn.status === 'Draft' ? '#64748b' : (dn.status === 'Cancelled' ? '#ef4444' : '#854d0e')),
                                                            border: `1px solid ${(dn.status === 'Completed' || dn.status === 'Submitted') ? `${themeColor}40` : (dn.status === 'Draft' ? '#e2e8f0' : (dn.status === 'Cancelled' ? '#fecaca' : '#fde047'))}`
                                                        }}>
                                                            {dn.status || 'Draft'} {dn.is_return ? '(Return)' : ''}
                                                        </span>
                                                    </td>
                                                    <td>{dn.customer_name || 'Cash'}</td>
                                                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{dn.company || 'Your Company'}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {getCurrencySymbol(dn.currency)}{dn.is_return ? '-' : ''}{Number(Math.abs(dn.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--so-text-muted)' }}>{dn.name}</td>
                                                    <td onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center gap-2">
                                                            {/* Create Return */}
                                                            {dn.status === 'To Bill' &&
                                                                !dn.is_return &&
                                                                dn.issue_credit_note !== 1 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            loadDeliveryNote(dn.name, true);
                                                                        }}
                                                                        className="so-btn-primary"
                                                                        style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem', background: '#ef4444' }}
                                                                    >
                                                                        <ArrowLeft size={10} /> Return
                                                                    </button>
                                                                )}

                                                            {/* Create Credit Note */}
                                                            {dn.is_return === 1 &&
                                                                ['To Bill', 'Submitted'].includes(dn.status) &&
                                                                dn.issue_credit_note !== 1 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            loadReturnForCreditNote(dn.name);
                                                                        }}
                                                                        className="so-btn-primary"
                                                                        style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem', background: '#6366f1' }}
                                                                    >
                                                                        <FileMinus size={10} /> Credit Note
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredNotes.length > 0 && (
                                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                                        Showing {Math.min((currentPage - 1) * pageSize + 1, filteredNotes.length)}–{Math.min(currentPage * pageSize, filteredNotes.length)} of {filteredNotes.length}
                                    </span>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                                            {[20, 100, 500, 2500].map(num => (
                                                <button key={num} onClick={() => { setPageSize(num); setCurrentPage(1); }} className={`so-page-btn ${pageSize === num ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{num}</button>
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
                        </div>
                    </div>
                </div>
                {/* Modal */}
                {showModal && (
                    <div className="so-modal-overlay" onClick={e => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
                        <div className="so-modal">
                            <div className="so-modal-header">
                                <h2 className="so-modal-title">
                                    {isReturnMode ? (
                                        <><ArrowLeft size={16} style={{ display: 'inline', marginRight: '0.4rem' }} /> Sales Return — {returnSourceDN}</>
                                    ) : (
                                        <><FileText size={16} style={{ display: 'inline', marginRight: '0.4rem' }} /> {form.name ? `Delivery Note — ${form.name}` : 'New Delivery Note'}</>
                                    )}
                                </h2>
                                <button className="so-modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="so-modal-body">
                                {/* Customer, Date, Time */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            {isReturnMode ? (
                                                <div className="pl-10 w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm bg-gray-50">
                                                    {form.customer_name || 'Cash'}
                                                </div>
                                            ) : (
                                                <>
                                                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={searchCustomer}
                                                        onChange={e => setSearchCustomer(e.target.value)}
                                                        onFocus={() => setShowCustomerDropdown(true)}
                                                        placeholder="Search customer..."
                                                        className="pl-10 w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                                                        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                                            {filteredCustomers.map(c => (
                                                                <div
                                                                    key={c.name}
                                                                    onClick={() => {
                                                                        setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                        setSearchCustomer(c.customer_name);
                                                                        setShowCustomerDropdown(false);
                                                                    }}
                                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                                                                >
                                                                    <div className="font-medium text-gray-900">{c.customer_name}</div>
                                                                    <div className="text-xs text-gray-500">{c.name}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {!isReturnMode && form.customer_name && <p className="mt-2 text-sm font-medium text-gray-800">{form.customer_name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                                        <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Time <span className="text-red-500">*</span></label>
                                        <input type="time" value={form.posting_time} onChange={e => setForm(prev => ({ ...prev, posting_time: e.target.value }))} className="w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                                    </div>
                                </div>
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input type="text" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="w-full max-w-md border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g., Cash" />
                                </div>
                                {/* Is Return Checkbox */}
                                <div className="flex items-center">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!form.is_return}
                                            disabled={isReturnMode}
                                            onChange={e => !isReturnMode && setForm(prev => ({ ...prev, is_return: e.target.checked ? 1 : 0 }))}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Is Return</span>
                                    </label>
                                </div>
                                {/* Currency, Price List, Ignore Rule */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency <span className="text-red-500">*</span></label>
                                        <select value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} className="w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                            <option value="INR">INR - Indian Rupee</option>
                                            <option value="AED">AED - UAE Dirham</option>
                                            <option value="USD">USD - US Dollar</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Price List <span className="text-red-500">*</span></label>
                                        <select value={form.selling_price_list} onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))} className="w-full border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                            {priceLists.map(pl => <option key={pl}>{pl}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.ignore_pricing_rule} onChange={e => setForm(prev => ({ ...prev, ignore_pricing_rule: e.target.checked ? 1 : 0 }))} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                            <span className="text-sm font-medium text-gray-700">Ignore Pricing Rule</span>
                                        </label>
                                    </div>
                                </div>
                                {/* Warehouse */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
                                    <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="w-full max-w-lg border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                        <option value="">Select Branch</option>
                                        {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                    </select>
                                </div>

                                <div className="col-span-1 md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Scan Barcode
                                    </label>
                                    <input
                                        id="barcode-scan-input"
                                        type="text"
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        onKeyDown={handleBarcodeScan}
                                        placeholder="Scan or type barcode → press Enter"
                                        className="w-full px-6 py-4 text-xl font-mono border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner"
                                        autoFocus={false}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Scanner auto-submits on Enter • Fast scanning ready!</p>
                                </div>

                                {/* Items Table */}
                                <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                        <h3 className="text-lg font-semibold text-gray-900">Items</h3>
                                        {!isReturnMode && (
                                            <button onClick={addItemRow} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1.5">
                                                <Plus className="w-4 h-4" /> Add Item
                                            </button>
                                        )}
                                    </div>
                                    <table className="w-full">
                                        <thead className="bg-gray-50 text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3 text-left">#</th>
                                                <th className="px-4 py-3 text-left">Item Code *</th>
                                                <th className="px-4 py-3 text-left">Item Name</th>
                                                <th className="px-4 py-3 text-center">Qty</th>
                                                <th className="px-4 py-3 text-center">UOM</th>
                                                <th className="px-4 py-3 text-right">Rate ({form.currency})</th>
                                                <th className="px-4 py-3 text-right">Amount ({form.currency})</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {form.items.map((item, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-600">{i + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="relative">
                                                            {isReturnMode && item.item_code ? (
                                                                <div className="text-sm font-medium text-gray-800">{item.item_code}</div>
                                                            ) : (
                                                                <>
                                                                    <input
                                                                        type="text"
                                                                        value={itemQueries[i] || ''}
                                                                        onChange={(e) => {
                                                                            const q = e.target.value;
                                                                            setItemQueries(prev => ({ ...prev, [i]: q }));
                                                                            if (q.length >= 2) searchItems(q);
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            const rect = e.target.getBoundingClientRect();
                                                                            setDropdownPosition({
                                                                                top: rect.bottom + window.scrollY + 8,
                                                                                left: rect.left + window.scrollX,
                                                                                width: rect.width
                                                                            });
                                                                            setActiveItemRow(i);
                                                                        }}
                                                                        placeholder="Search item..."
                                                                        className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                                    />
                                                                    {activeItemRow === i && dropdownPosition && itemQueries[i] && allItems.length > 0 && createPortal(
                                                                        <div className="fixed bg-white border border-gray-300 rounded-md shadow-xl z-[9999] max-h-64 overflow-y-auto" style={{
                                                                            top: `${dropdownPosition.top}px`,
                                                                            left: `${dropdownPosition.left}px`,
                                                                            width: `${dropdownPosition.width}px`
                                                                        }}>
                                                                            {allItems.filter(it => it.item_name?.toLowerCase().includes(itemQueries[i].toLowerCase()) || it.item_code?.toLowerCase().includes(itemQueries[i].toLowerCase())).slice(0, 20).map(it => (
                                                                                <div key={it.item_code} onClick={() => selectItem(i, it)} className="px-4 py-2.5 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0">
                                                                                    <div className="font-medium text-gray-900 text-sm">{it.item_name}</div>
                                                                                    <div className="text-xs text-gray-500">{it.item_code} • Stock: {it.actual_qty || 0}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>,
                                                                        document.body
                                                                    )}
                                                                </>
                                                            )}
                                                            {item.item_name && <div className="mt-1 text-sm font-medium text-gray-800">{item.item_name}</div>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">{item.item_name || '-'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input type="number" value={item.qty || ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)} className="w-20 text-center border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm">{item.uom || 'Nos'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input type="number" value={item.rate || ''} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} className="w-28 text-right border border-gray-300 rounded px-2 py-1.5 text-sm" step="0.01" />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                        {getCurrencySymbol(form.currency)}{Number(item.amount || 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {!isReturnMode && (
                                                            <button onClick={() => removeItem(i)} className="text-red-600 hover:text-red-800">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {form.items.length === 0 && (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-12 text-gray-500 text-sm">No items added yet</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-right">
                                        <span className="text-sm font-medium text-gray-700">
                                            Total Quantity: <span className="text-lg font-bold text-gray-900">{form.total_qty}</span>
                                        </span>
                                    </div>
                                </div>
                                {/* Tax Template */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Taxes & Charges Template</label>
                                    <select value={form.taxes_and_charges} onChange={e => applyTaxTemplate(e.target.value)} className="w-full max-w-md border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                        <option value="">No Tax</option>
                                        {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                {/* Taxes Summary */}
                                {form.taxes.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-300 p-5">
                                        <h4 className="font-semibold text-gray-900 mb-3">Taxes & Charges</h4>
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-gray-200">
                                                <tr>
                                                    <th className="text-left py-2 text-gray-600">Account Head</th>
                                                    <th className="text-right py-2 text-gray-600">Rate</th>
                                                    <th className="text-right py-2 text-gray-600">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.taxes.map((t, i) => {
                                                    const amt = (t.rate / 100) * netTotal;
                                                    return (
                                                        <tr key={i} className="border-b border-gray-100">
                                                            <td className="py-2 text-gray-700">{t.account_head}</td>
                                                            <td className="text-right py-2 text-gray-700">{t.rate}%</td>
                                                            <td className="text-right font-medium py-2 text-gray-900">
                                                                {getCurrencySymbol(form.currency)}{Number(amt).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="font-bold border-t-2 border-gray-300">
                                                    <td colSpan="2" className="text-right py-3">Total Tax</td>
                                                    <td className="text-right py-3 text-gray-900">
                                                        {getCurrencySymbol(form.currency)}{Number(form.total_taxes_and_charges).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {/* Grand Total Box */}
                                <div className="bg-gray-900 text-white rounded-lg p-6">
                                    <div className="text-center space-y-2">
                                        <div className="text-sm opacity-90">Grand Total</div>
                                        <div className="text-3xl font-bold">
                                            {getCurrencySymbol(form.currency)}{Number(form.rounded_total).toFixed(2)}
                                        </div>
                                        {form.in_words && (
                                            <p className="text-sm italic opacity-80 mt-3">{form.in_words}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="so-modal-footer">
                                <button className="so-btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
                                <button className="so-btn-secondary" onClick={() => saveDeliveryNote(false)} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Draft'}
                                </button>
                                <button
                                    className="so-btn-primary"
                                    onClick={() => saveDeliveryNote(true)}
                                    disabled={saving || !form.name}
                                    style={{ minWidth: '200px', opacity: (!form.name || saving) ? 0.5 : 1 }}
                                >
                                    {saving ? <><Loader2 size={14} className="so-spinner" /> Submitting...</> : (form.name ? 'Submit Delivery Note' : 'Save First to Submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
export default DeliveryNoteList;
