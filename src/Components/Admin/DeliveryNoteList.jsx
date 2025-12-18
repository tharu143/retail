import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { Package, Plus, X, Search, Filter, ChevronDown, FileText, Loader2, ChevronLeft, ChevronRight, ArrowLeft, FileMinus } from 'lucide-react';

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
            const [custRes, whRes, taxRes, plRes, dnRes] = await Promise.all([
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
                })
            ]);

            setCustomers(custRes.data.message || []);
            setWarehouses(whRes.data.message || []);
            setTaxTemplates(taxRes.data.message || []);
            setPriceLists(plRes.data.data?.map(pl => pl.name) || ['Standard Selling']);
            setDeliveryNotes(dnRes.data.data || []);
            setFilteredNotes(dnRes.data.data || []);
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
            <div className="min-h-screen bg-gray-100">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                        <Package className="w-7 h-7" /> Delivery Note
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-medium flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> Add Delivery Note
                        </button>
                    </div>
                </div>

                <div className="flex">
                    {/* Sidebar Filters */}
                    <div className="w-72 bg-white border-r min-h-screen p-6 space-y-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Filters</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input type="text" placeholder="Search anything..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input type="text" placeholder="e.g., Cash" value={titleFilter} onChange={e => setTitleFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                            <input type="text" placeholder="Customer name..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                            <input type="text" placeholder="Company name..." value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                                <option value="all">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Return">Return</option>
                                <option value="To Bill">To Bill</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Completed">Completed</option>
                                <option value="Return Issued">Return Issued</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Grand Total Range</label>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                                <input type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <button onClick={() => {
                            setSearchTerm(''); setTitleFilter(''); setCustomerFilter(''); setCompanyFilter(''); setStatusFilter('all'); setMinAmount(''); setMaxAmount('');
                        }} className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium">
                            Clear Filters
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6">
                        <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>{filteredNotes.length} items</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="w-12 px-6 py-3"><input type="checkbox" /></th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        <tr><td colSpan="8" className="text-center py-16"><Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-400" /></td></tr>
                                    ) : paginatedNotes.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center py-16 text-gray-500">No delivery notes found</td></tr>
                                    ) : (
                                        paginatedNotes.map(dn => (
                                            <tr key={dn.name} className="hover:bg-gray-50">
                                                <td className="px-6 py-4"><input type="checkbox" /></td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 cursor-pointer" onClick={() => loadDeliveryNote(dn.name, false)}>
                                                    {dn.title || 'Cash'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dn.status)}`}>
                                                        {dn.status || 'Draft'} {dn.is_return ? '(Return)' : ''}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">{dn.customer_name || 'Cash'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{dn.company || 'Your Company'}</td>
                                                <td className="px-6 py-4 text-sm text-right font-medium">
                                                    {getCurrencySymbol(dn.currency)}
                                                    {dn.is_return ? '-' : ''}{Number(Math.abs(dn.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{dn.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-6">
                                                        {/* Create Return */}
                                                        {dn.status === 'To Bill' &&
                                                            !dn.is_return &&
                                                            dn.issue_credit_note !== 1 && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        loadDeliveryNote(dn.name, true);
                                                                    }}
                                                                    className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center gap-1"
                                                                >
                                                                    <ArrowLeft className="w-4 h-4" /> Create Return
                                                                </button>
                                                            )}

                                                        {/* Create Credit Note */}
                                                        {dn.is_return === 1 &&
                                                            ['To Bill', 'Submitted'].includes(dn.status) &&  // Completed um include cheyyam if needed
                                                            dn.issue_credit_note !== 1 && (  // This field is key
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        loadReturnForCreditNote(dn.name);
                                                                    }}
                                                                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center gap-1"
                                                                >
                                                                    <FileMinus className="w-4 h-4" /> Create Credit Note
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

                        {/* Pagination */}
                        <div className="flex justify-between items-center mt-6">
                            <div className="text-sm text-gray-600">
                                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredNotes.length)} of {filteredNotes.length} entries
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                {[20, 100, 500, 2500].map(num => (
                                    <button key={num} onClick={() => setPageSize(num)} className={`px-4 py-2 border rounded ${pageSize === num ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>
                                        {num}
                                    </button>
                                ))}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto border border-gray-200">
                            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                                    {isReturnMode ? (
                                        <> <ArrowLeft className="w-6 h-6" /> Sales Return - {returnSourceDN} </>
                                    ) : (
                                        <> <FileText className="w-6 h-6 text-gray-700" /> {form.name ? `Delivery Note - ${form.name}` : 'New Delivery Note'} </>
                                    )}
                                </h2>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                            <div className="p-6 space-y-8 bg-gray-50">
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse <span className="text-red-500">*</span></label>
                                    <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="w-full max-w-lg border border-gray-300 rounded-md py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                        <option value="">Select Warehouse</option>
                                        {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                    </select>
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
                                {/* Action Buttons */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button onClick={() => { setShowModal(false); resetForm(); }} className="px-6 py-2.5 border border-gray-300 rounded-md hover:bg-gray-100 font-medium text-gray-700 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={() => saveDeliveryNote(false)} disabled={saving} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-md font-medium">
                                        {saving ? 'Saving...' : 'Save Draft'}
                                    </button>
                                    <button
                                        onClick={() => saveDeliveryNote(true)}
                                        disabled={saving || !form.name}  // Optional: disable submit until saved once
                                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                                        {saving ? 'Submitting...' : (form.name ? 'Submit Delivery Note' : 'Save First to Submit')}
                                    </button>
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
