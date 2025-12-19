import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import {
    Plus, X, Search, Filter, ChevronDown, FileText,
    Loader2, ChevronLeft, ChevronRight, ArrowLeft
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const SalesInvoiceList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { company: loggedCompany } = useSelector(state => state.user || {});

    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const [isReturnMode, setIsReturnMode] = useState(false);
    const [returnAgainst, setReturnAgainst] = useState(null);
    const [barcodeInput, setBarcodeInput] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [titleFilter, setTitleFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [pageSize, setPageSize] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);

    // Form state
    const [form, setForm] = useState({
        name: '',
        status: 'Draft',
        posting_date: new Date().toISOString().split('T')[0],
        customer: '',
        customer_name: '',
        due_date: '',
        is_pos: false,
        set_warehouse: '',
        update_stock: false,
        is_return: 0,
        return_against: '',
        currency: 'AED',
        selling_price_list: 'Standard Selling',
        update_outstanding_amount_in_self: false,
        update_billed_amount_in_delivery_note: false,
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
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [itemQueries, setItemQueries] = useState({});
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [defaultIncomeAccount, setDefaultIncomeAccount] = useState('');

    const company = loggedCompany || '';

    const getCurrencySymbol = (curr = form.currency) => {
        switch (curr) {
            case 'INR': return '₹';
            case 'AED': return 'د.إ';
            case 'USD': return '$';
            default: return 'د.إ';
        }
    };

    const numberToWords = (num) => {
        if (form.currency !== 'INR' || !num) return '';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Lakh', 'Crore'];
        let rupees = Math.floor(Math.abs(num));
        let paise = Math.round((Math.abs(num) - rupees) * 100);
        const convert = (n) => {
            if (n < 20) return ones[n];
            if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
            return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
        };
        let words = '';
        let scaleIndex = 0;
        while (rupees > 0) {
            let part = rupees % 1000;
            if (part !== 0) {
                words = convert(part) + (scaleIndex > 0 ? ' ' + scales[scaleIndex] : '') + (words ? ' ' + words : '');
            }
            rupees = Math.floor(rupees / 1000);
            scaleIndex++;
        }
        return (words.trim() || 'Zero') + ' Rupees' + (paise > 0 ? ' and ' + paise + ' Paise' : '') + ' Only';
    };

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

    useEffect(() => {
        if (!company) return;
        const fetchDefaultIncomeAccount = async () => {
            try {
                const res = await axios.get(`/api/resource/Company/${company}`);
                setDefaultIncomeAccount(res.data.data.default_income_account || '');
            } catch (err) {
                setDefaultIncomeAccount('');
            }
        };
        fetchDefaultIncomeAccount();
    }, [company]);

    // Handle returnData from Delivery Note Return → Credit Note
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const returnData = params.get('returnData');
        const autoOpen = params.get('autoOpen') === 'true';
        if (returnData) {
            try {
                const data = JSON.parse(returnData);
                setIsReturnMode(true);

                setReturnAgainst(data.return_against || '');
                setForm(prev => ({
                    ...prev,
                    ...data,
                    status: 'Draft',
                    is_return: 1,
                    posting_date: new Date().toISOString().split('T')[0],
                    update_billed_amount_in_delivery_note: true,
                    return_against: undefined,
                    items: data.items.map(i => ({
                        ...i,
                        qty: Math.abs(i.qty),
                        amount: Math.abs(i.amount)
                    }))
                }));
                setSearchCustomer(data.customer_name || '');
                if (autoOpen) setShowModal(true);
                navigate('/salesinvoice', { replace: true });
            } catch (e) {
                console.error('Failed to parse return data', e);
            }
        }
    }, [location.search, navigate]);

    // Load master data
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [custRes, whRes, taxRes, invRes] = await Promise.all([
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_si'),
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_si'),
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si'),
                    axios.get('/api/resource/Sales Invoice', {
                        params: {
                            fields: '["name","customer_name","posting_date","grand_total","status","title","outstanding_amount","currency","is_return"]',
                            limit_page_length: 500,
                            order_by: 'modified desc'
                        }
                    })
                ]);
                setCustomers(custRes.data.message || []);
                setWarehouses(whRes.data.message || []);
                setTaxTemplates(taxRes.data.message || []);
                setInvoices(invRes.data.data || []);
                setFilteredInvoices(invRes.data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Filtering logic
    useEffect(() => {
        let filtered = invoices;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(inv =>
                inv.name?.toLowerCase().includes(term) ||
                inv.customer_name?.toLowerCase().includes(term) ||
                inv.title?.toLowerCase().includes(term)
            );
        }
        if (titleFilter) filtered = filtered.filter(inv => (inv.title || '').toLowerCase().includes(titleFilter.toLowerCase()));
        if (customerFilter) filtered = filtered.filter(inv => inv.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
        if (statusFilter !== 'all') filtered = filtered.filter(inv => inv.status === statusFilter);
        if (minAmount || maxAmount) {
            filtered = filtered.filter(inv => {
                const amount = Math.abs(Number(inv.grand_total || 0));
                if (minAmount && amount < Number(minAmount)) return false;
                if (maxAmount && amount > Number(maxAmount)) return false;
                return true;
            });
        }
        setFilteredInvoices(filtered);
        setCurrentPage(1);
    }, [searchTerm, titleFilter, customerFilter, statusFilter, minAmount, maxAmount, invoices]);


    const getStatusColor = (status) => {
        switch (status) {
            case 'Paid': return 'bg-green-100 text-green-800';
            case 'Unpaid': return 'bg-yellow-100 text-yellow-800';
            case 'Overdue': return 'bg-red-100 text-red-800';
            case 'Draft': return 'bg-gray-100 text-gray-800';
            case 'Submitted': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Totals calculation
    const calculateTotals = () => {
        const items = form.items || [];
        const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
        const taxTotal = form.taxes.reduce((s, t) => s + (netTotal * (parseFloat(t.rate) || 0) / 100), 0);
        const grand = netTotal + taxTotal;
        const rounded = Math.round(grand);
        setForm(prev => ({
            ...prev,
            total_qty: totalQty,
            base_total: netTotal,
            total_taxes_and_charges: taxTotal,
            grand_total: grand,
            rounded_total: rounded,
            in_words: numberToWords(rounded)
        }));
    };

    useEffect(() => calculateTotals(), [form.items, form.taxes]);

    const searchItems = async (query) => {
        if (!query || query.trim().length < 2) return;
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si', { params: { query } });
            setAllItems(res.data.message || []);
        } catch (err) { }
    };

    const applyTaxTemplate = async (template) => {
        if (!template) {
            setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
            calculateTotals();
            return;
        }
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si', { params: { template } });
            setForm(prev => ({ ...prev, taxes: res.data.message || [], taxes_and_charges: template }));
            calculateTotals();
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
                amount: 0,
                income_account: defaultIncomeAccount
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
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', {
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
        if (isReturnMode && (field === 'qty' || field === 'rate')) return;
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
        }
        setForm(prev => ({ ...prev, items }));
        calculateTotals();
    };

    const resetForm = () => {
        setForm({
            name: '',
            status: 'Draft',
            posting_date: new Date().toISOString().split('T')[0],
            customer: '',
            customer_name: '',
            due_date: '',
            is_pos: false,
            set_warehouse: '',
            update_stock: false,
            is_return: 0,
            return_against: '',
            currency: 'AED',
            selling_price_list: 'Standard Selling',
            update_outstanding_amount_in_self: false,
            update_billed_amount_in_delivery_note: false,
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
        setIsReturnMode(false);
        setReturnAgainst(null);
        setSearchCustomer('');
        setItemQueries({});
        setActiveItemRow(null);
        setDropdownPosition(null);
    };

    const createSalesInvoice = async (submit = false) => {
        if (!form.customer || form.items.length === 0 || form.items.some(i => !i.item_code)) {
            alert("Please fill required fields and items");
            return;
        }
        setSaving(true);

        const payload = {
            posting_date: form.posting_date,
            customer: form.customer,
            due_date: form.due_date || form.posting_date,
            is_return: form.is_return ? 1 : 0,
            ...(form.is_return && returnAgainst && returnAgainst.startsWith('ACC-SINV') ? { return_against: returnAgainst } : {}),
            currency: form.currency,
            selling_price_list: form.selling_price_list,
            update_billed_amount_in_delivery_note: form.update_billed_amount_in_delivery_note ? 1 : 0,
            items: form.items.map(i => ({
                item_code: i.item_code,
                qty: form.is_return ? -Math.abs(i.qty) : i.qty,
                rate: i.rate,
                amount: form.is_return ? -Math.abs(i.amount) : i.amount,
                uom: i.uom,
                income_account: i.income_account || defaultIncomeAccount
            })),
            taxes_and_charges: form.taxes_and_charges || undefined,
            taxes: form.taxes
        };

        try {
            let invoiceName = form.name;

            // Save draft first
            if (form.name) {
                await axios.put(`/api/resource/Sales Invoice/${form.name}`, payload);
            } else {
                const res = await axios.post('/api/resource/Sales Invoice', payload);
                invoiceName = res.data.data.name;
                setForm(prev => ({ ...prev, name: invoiceName }));
            }

            if (submit) {
                // Reload latest doc before submit
                const latestDocRes = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
                const latestDoc = latestDocRes.data.data;

                // Submit
                await axios.post('/api/method/frappe.client.submit', {
                    doc: JSON.stringify({
                        ...latestDoc,
                        doctype: 'Sales Invoice',
                        name: invoiceName
                    })
                });

                // === NEW FIX: DN Return aanengil original DN status "Completed" aakkum ===
                if (isReturnMode && returnAgainst && !returnAgainst.startsWith('ACC-SINV')) {
                    // returnAgainst = original DN name (e.g., MAT-DN-XXXX)
                    try {
                        await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.update_dn_status_on_credit_note', {
                            original_dn_name: returnAgainst  // Pass original DN to find Return DN
                        });
                    } catch (e) {
                        console.warn("Failed to update Return DN status to Completed", e);
                    }
                }
                // Direct SI return aanengil mark original SI
                if (form.is_return && returnAgainst && returnAgainst.startsWith('ACC-SINV')) {
                    await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.mark_si_credit_note_issued', {
                        original_si_name: returnAgainst
                    });
                }
            }

            // Refresh list
            const invRes = await axios.get('/api/resource/Sales Invoice', {
                params: {
                    fields: '["name","customer_name","posting_date","grand_total","status","title","outstanding_amount","currency","is_return"]',
                    limit_page_length: 500,
                    order_by: 'modified desc'
                }
            });
            setInvoices(invRes.data.data || []);
            setFilteredInvoices(invRes.data.data || []);

            alert(submit ? (isReturnMode ? "Credit Note Submitted!" : "Invoice Submitted!") : "Saved as Draft");

            if (submit) {
                setShowModal(false);
                resetForm();
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || "Failed";
            alert("Error: " + msg);
            if (msg.includes("modified after you have opened it")) {
                alert("Document modified by someone else. Refresh and try again.");
            }
        } finally {
            setSaving(false);
        }
    };

    const loadInvoiceForEdit = async (invoiceName) => {
        try {
            const res = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
            const inv = res.data.data;
            setIsReturnMode(inv.is_return === 1);
            setReturnAgainst(inv.return_against || null);
            setForm({
                name: inv.name,
                status: inv.status || 'Draft',
                posting_date: inv.posting_date,
                customer: inv.customer,
                customer_name: inv.customer_name,
                due_date: inv.due_date || '',
                is_pos: inv.is_pos === 1,
                set_warehouse: inv.set_warehouse || '',
                update_stock: inv.update_stock === 1,
                is_return: inv.is_return ? 1 : 0,
                return_against: inv.return_against || '',
                currency: inv.currency || 'AED',
                selling_price_list: inv.selling_price_list || 'Standard Selling',
                update_outstanding_amount_in_self: inv.update_outstanding_amount_in_self === 1,
                update_billed_amount_in_delivery_note: inv.update_billed_amount_in_delivery_note === 1,
                items: inv.items.map(i => ({
                    item_code: i.item_code,
                    item_name: i.item_name,
                    qty: inv.is_return ? Math.abs(i.qty) : i.qty,
                    rate: i.rate,
                    amount: Math.abs(i.amount),
                    uom: i.uom || 'Nos',
                    conversion_factor: i.conversion_factor || 1,
                    base_rate: i.base_rate || i.rate,
                    base_amount: i.base_amount || Math.abs(i.amount),
                    income_account: i.income_account || defaultIncomeAccount
                })),
                taxes_and_charges: inv.taxes_and_charges || '',
                taxes: inv.taxes || [],
                total_qty: 0,
                base_total: 0,
                total_taxes_and_charges: 0,
                grand_total: 0,
                rounded_total: 0,
                in_words: ''
            });
            setSearchCustomer(inv.customer_name || '');
            setShowModal(true);
            calculateTotals();
        } catch (err) {
            alert("Error loading invoice for edit");
            console.error(err);
        }
    };

    const loadForReturn = async (invoiceName) => {
        try {
            const res = await axios.get(`/api/resource/Sales Invoice/${invoiceName}`);
            const inv = res.data.data;
            setIsReturnMode(true);
            setReturnAgainst(inv.name);
            setForm({
                name: '',
                status: 'Draft',
                posting_date: new Date().toISOString().split('T')[0],
                customer: inv.customer,
                customer_name: inv.customer_name,
                due_date: inv.due_date || '',
                is_return: 1,
                return_against: inv.name,
                currency: inv.currency || 'AED',
                selling_price_list: inv.selling_price_list || 'Standard Selling',
                update_outstanding_amount_in_self: true,
                update_billed_amount_in_delivery_note: true, // Always true for direct SI return
                items: inv.items.map(i => ({
                    item_code: i.item_code,
                    item_name: i.item_name,
                    qty: Math.abs(i.qty),
                    rate: i.rate,
                    amount: Math.abs(i.amount),
                    uom: i.uom || 'Nos'
                })),
                taxes_and_charges: inv.taxes_and_charges || '',
                taxes: inv.taxes || []
            });
            setSearchCustomer(inv.customer_name || '');
            setShowModal(true);
            calculateTotals();
        } catch (err) {
            alert("Error loading for return");
        }
    };

    const filteredCustomers = useMemo(() => customers.filter(c =>
        c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.name?.toLowerCase().includes(searchCustomer.toLowerCase())
    ).slice(0, 10), [searchCustomer, customers]);

    const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredInvoices.length / pageSize);
    const canSubmit = !form.name || form.status !== 'Submitted';

    return (
        <>
            <NavBar />
            <div className="min-h-screen bg-gray-100">
                {/* ERPNext Header */}
                <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                        <FileText className="w-7 h-7" /> Sales Invoice
                    </h1>
                    <button
                        onClick={() => {
                            resetForm();
                            setShowModal(true);
                        }}
                        className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-medium flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Add Sales Invoice
                    </button>

                </div>
                <div className="flex">
                    {/* Sidebar Filters */}
                    <div className="w-72 bg-white border-r min-h-screen p-6 space-y-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Filters</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input
                                type="text"
                                placeholder="Search invoices..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input
                                type="text"
                                placeholder="e.g., Cash, Credit"
                                value={titleFilter}
                                onChange={e => setTitleFilter(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                            <input
                                type="text"
                                placeholder="Customer name..."
                                value={customerFilter}
                                onChange={e => setCustomerFilter(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="all">All Status</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Paid">Paid</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amount Range</label>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                                <input type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setTitleFilter('');
                                setCustomerFilter('');
                                setStatusFilter('all');
                                setMinAmount('');
                                setMaxAmount('');
                            }}
                            className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
                        >
                            Clear Filters
                        </button>
                    </div>
                    {/* Main List */}
                    <div className="flex-1 p-6">
                        <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>{filteredInvoices.length} items</span>
                                <button className="flex items-center gap-1 hover:text-gray-900">
                                    <Filter className="w-4 h-4" /> Filters
                                </button>
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
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        <tr><td colSpan="7" className="text-center py-16"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></td></tr>
                                    ) : paginated.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-16 text-gray-500">No invoices found</td></tr>
                                    ) : (
                                        paginated.map(inv => (
                                            <tr
                                                key={inv.name}
                                                className="hover:bg-gray-50 cursor-pointer"
                                                onClick={() => loadInvoiceForEdit(inv.name)}
                                            >
                                                <td className="px-6 py-4"><input type="checkbox" onClick={(e) => e.stopPropagation()} /></td>
                                                <td className="px-6 py-4 text-sm font-medium">{inv.title || 'Invoice'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                                                        {inv.status || 'Draft'} {inv.is_return ? '(Credit Note)' : ''}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">{inv.customer_name || 'Customer'}</td>
                                                <td className="px-6 py-4 text-sm text-right font-medium">
                                                    {getCurrencySymbol(inv.currency || 'AED')}{inv.is_return ? '-' : ''}{Math.abs(Number(inv.grand_total || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{inv.name}</td>
                                                <td className="px-6 py-4">
                                                    {inv.status === 'Submitted' && !inv.is_return && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); loadForReturn(inv.name); }}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                                        >
                                                            Create Credit Note
                                                        </button>
                                                    )}
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
                                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length} entries
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                {[20, 100, 500].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setPageSize(num)}
                                        className={`px-4 py-2 border rounded ${pageSize === num ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                                    >
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
                {/* FULL MODAL - WITH TAX TABLE */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    {isReturnMode ? (
                                        <> <ArrowLeft className="w-6 h-6" /> Credit Note - Return Against: {returnAgainst} </>
                                    ) : (
                                        <> New Sales Invoice </>
                                    )}
                                </h2>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-2xl hover:text-red-600">×</button>
                            </div>
                            <div className="p-8 space-y-8">
                                {/* Header Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <div>
                                        <label className="block font-medium mb-1">Posting Date *</label>
                                        <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block font-medium mb-1">Customer *</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={searchCustomer}
                                                onChange={e => setSearchCustomer(e.target.value)}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                placeholder="Search customer..."
                                                className="w-full px-4 py-2 border rounded-lg"
                                            />
                                            {showCustomerDropdown && filteredCustomers.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {filteredCustomers.map(c => (
                                                        <div
                                                            key={c.name}
                                                            onClick={() => {
                                                                setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                setSearchCustomer(c.customer_name);
                                                                setShowCustomerDropdown(false);
                                                            }}
                                                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                        >
                                                            <div className="font-medium">{c.customer_name}</div>
                                                            <div className="text-sm text-gray-500">{c.name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block font-medium mb-1">Due Date</label>
                                        <input type="date" value={form.due_date} onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block font-medium mb-1">Warehouse</label>
                                        <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="w-full px-4 py-2 border rounded-lg">
                                            <option>Select Warehouse</option>
                                            {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2 flex flex-wrap gap-4 items-center">
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_pos} onChange={e => setForm(prev => ({ ...prev, is_pos: e.target.checked }))} /> <span>Is POS</span></label>
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.update_stock} onChange={e => setForm(prev => ({ ...prev, update_stock: e.target.checked }))} /> <span>Update Stock</span></label>
                                        {isReturnMode && (
                                            <>
                                                <label className="flex items-center gap-2"><input type="checkbox" checked={form.update_outstanding_amount_in_self} onChange={e => setForm(prev => ({ ...prev, update_outstanding_amount_in_self: e.target.checked }))} /> <span>Update Outstanding for Self</span></label>
                                                <label className="flex items-center gap-2"><input type="checkbox" checked={form.update_billed_amount_in_delivery_note} onChange={e => setForm(prev => ({ ...prev, update_billed_amount_in_delivery_note: e.target.checked }))} /> <span>Update Billed Amount in Delivery Note</span></label>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Scan Barcode
                                        </label>
                                        <input
                                            id="barcode-scan-input"
                                            type="text"
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            onKeyDown={handleBarcodeScan}
                                            placeholder="Scan or type barcode and press Enter"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                                            autoFocus={false}
                                        />
                                    </div>

                                    {/* ADD THIS NEW ROW */}
                                    <div className="md:col-span-2 flex items-center gap-3 mt-6 pt-4 border-t">
                                        <label className="flex items-center gap-3 text-lg font-semibold">
                                            <input
                                                type="checkbox"
                                                checked={isReturnMode}
                                                disabled
                                                className="w-6 h-6 text-red-600"
                                            />
                                            <span className={isReturnMode ? "text-red-700" : "text-gray-500"}>
                                                {isReturnMode ? "Credit Note (Return)" : "Regular Sales Invoice"}
                                            </span>
                                        </label>
                                        {isReturnMode && returnAgainst && (
                                            <div className="text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                                                Return Against: <strong className="text-red-800">{returnAgainst}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Items Table */}
                                <div>
                                    <div className="flex justify-between mb-3">
                                        <h3 className="text-lg font-semibold">Items</h3>
                                        {!isReturnMode && <button onClick={addItemRow} className="text-blue-600 font-medium">+ Add Row</button>}
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Item</th>
                                                    <th className="px-4 py-3 w-24">Qty</th>
                                                    <th className="px-4 py-3 w-20">UOM</th>
                                                    <th className="px-4 py-3 w-32">Rate</th>
                                                    <th className="px-4 py-3 w-32 text-right">Amount</th>
                                                    <th className="px-4 py-3 w-16"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.items.map((item, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="px-4 py-3">
                                                            <div className="relative">
                                                                {!isReturnMode ? (
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
                                                                                const input = e.target;
                                                                                const rect = input.getBoundingClientRect();
                                                                                setDropdownPosition({
                                                                                    top: rect.bottom + window.scrollY + 8,
                                                                                    left: rect.left + window.scrollX,
                                                                                    width: rect.width
                                                                                });
                                                                                setActiveItemRow(i);
                                                                            }}
                                                                            placeholder="Search item..."
                                                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                                        />
                                                                        {activeItemRow === i && dropdownPosition && itemQueries[i] && allItems.length > 0 && createPortal(
                                                                            <div
                                                                                className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] max-h-64 overflow-y-auto"
                                                                                style={{
                                                                                    top: dropdownPosition.top + 'px',
                                                                                    left: dropdownPosition.left + 'px',
                                                                                    width: dropdownPosition.width + 'px'
                                                                                }}
                                                                            >
                                                                                {allItems
                                                                                    .filter(it =>
                                                                                        it.item_name?.toLowerCase().includes((itemQueries[i] || '').toLowerCase()) ||
                                                                                        it.item_code?.toLowerCase().includes((itemQueries[i] || '').toLowerCase())
                                                                                    )
                                                                                    .slice(0, 20)
                                                                                    .map(it => (
                                                                                        <div
                                                                                            key={it.item_code}
                                                                                            onClick={() => {
                                                                                                selectItem(i, it);
                                                                                                setDropdownPosition(null);
                                                                                            }}
                                                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                                                                        >
                                                                                            <div className="font-medium text-gray-900">{it.item_name}</div>
                                                                                            <div className="text-xs text-gray-500">{it.item_code}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                {allItems.length === 0 && (
                                                                                    <div className="px-4 py-12 text-center text-gray-500 text-sm">No items found</div>
                                                                                )}
                                                                            </div>,
                                                                            document.body
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <div className="text-sm font-semibold text-gray-800 pl-1">{item.item_name}</div>
                                                                )}
                                                                {item.item_name && (
                                                                    <div className="mt-2 text-sm font-semibold text-gray-800 pl-1">{item.item_name}</div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input type="number" value={item.qty || ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)} className="w-20 border rounded px-2 py-2 text-center" disabled={isReturnMode} />
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-sm">{item.uom || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <input type="number" value={item.rate || ''} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} className="w-28 border rounded px-2 py-2 text-right" step="0.01" disabled={isReturnMode} />
                                                        </td>
                                                        <td className="px-4 py-3 text-left font-medium text-sm">
                                                            {getCurrencySymbol(form.currency)}{(item.amount || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {!isReturnMode && <button onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))} className="text-red-600 hover:text-red-800 text-xl">×</button>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* TAXES & CHARGES - FULLY VISIBLE */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Taxes & Charges Template</label>
                                        <select
                                            value={form.taxes_and_charges}
                                            onChange={e => applyTaxTemplate(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg py-3 px-4"
                                        >
                                            <option value="">No Tax</option>
                                            {taxTemplates.map(t => (
                                                <option key={t.name} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                        {form.taxes.length > 0 && (
                                            <div className="mt-6 bg-gray-50 rounded-xl p-5 border">
                                                <h4 className="font-semibold text-gray-900 mb-4">Taxes & Charges</h4>
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b">
                                                            <th className="text-left py-2 font-medium">Account Head</th>
                                                            <th className="text-center py-2 font-medium">Rate %</th>
                                                            <th className="text-right py-2 font-medium">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.taxes.map((tax, i) => {
                                                            const taxAmount = (tax.rate / 100) * form.base_total;
                                                            return (
                                                                <tr key={i} className="border-b">
                                                                    <td className="py-3">{tax.account_head}</td>
                                                                    <td className="py-3 text-center">{tax.rate}%</td>
                                                                    <td className="py-3 text-right font-medium">
                                                                        {getCurrencySymbol(form.currency)}{taxAmount.toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="font-bold bg-gray-100">
                                                            <td colSpan="2" className="py-3 text-right">Total Tax</td>
                                                            <td className="py-3 text-right">
                                                                {getCurrencySymbol(form.currency)}{form.total_taxes_and_charges.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                    {/* Final Totals */}
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6">
                                        <div className="space-y-4 text-lg">
                                            <div className="flex justify-between"><span>Net Total</span><span className="font-bold">{getCurrencySymbol(form.currency)}{form.base_total.toFixed(2)}</span></div>
                                            <div className="flex justify-between"><span>Tax Amount</span><span>{getCurrencySymbol(form.currency)}{form.total_taxes_and_charges.toFixed(2)}</span></div>
                                            <div className="flex justify-between text-xl font-bold border-t-2 border-white/30 pt-4">
                                                <span>Grand Total</span>
                                                <span>{getCurrencySymbol(form.currency)}{form.grand_total.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-2xl font-bold">
                                                <span>Rounded Total</span>
                                                <span>{getCurrencySymbol(form.currency)}{form.rounded_total.toFixed(2)}</span>
                                            </div>
                                            {form.currency === 'INR' && form.in_words && (
                                                <p className="text-base italic mt-4 opacity-90">{form.in_words}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-4 p-6 border-t bg-white sticky bottom-0">
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="px-8 py-3 border rounded-lg hover:bg-gray-100 font-medium">Cancel</button>
                                <button onClick={() => createSalesInvoice(false)} disabled={saving} className="px-8 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium">
                                    {saving ? 'Saving...' : 'Save Draft'}
                                </button>
                                <button onClick={() => createSalesInvoice(true)} disabled={saving} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                                    {saving ? 'Submitting...' : (isReturnMode ? 'Submit Credit Note' : 'Submit Invoice')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default SalesInvoiceList;