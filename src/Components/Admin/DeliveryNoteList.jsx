import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { Package, Plus, X, Search, Filter, ChevronDown, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const DeliveryNoteList = () => {
    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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

    // Form state (same as before)
    const [form, setForm] = useState({
        posting_date: new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().slice(0, 5),
        customer: '',
        customer_name: '',
        is_return: 0,
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

    const getCurrencySymbol = () => {
        switch (form.currency) {
            case 'INR': return '₹';
            case 'AED': return 'د.إ';
            case 'USD': return '$';
            default: return '₹';
        }
    };

    const numberToWords = (num) => {
        if (form.currency !== 'INR' || !num) return '';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Lakh', 'Crore'];

        let rupees = Math.floor(num);
        let paise = Math.round((num - rupees) * 100);

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

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [custRes, whRes, taxRes, plRes, dnRes] = await Promise.all([
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_dn'),
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_dn'),
                    axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn'),
                    axios.get('/api/method/frappe.client.get_list', { params: { doctype: 'Price List', filters: { selling: 1 }, fields: ['name'] } }),
                    axios.get('/api/resource/Delivery Note', {
                        params: {
                            fields: '["name","customer_name","posting_date","grand_total","status","title","company","modified"]',
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
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // Advanced filtering
    useEffect(() => {
        let filtered = deliveryNotes;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(dn =>
                dn.name?.toLowerCase().includes(term) ||
                dn.customer_name?.toLowerCase().includes(term) ||
                dn.title?.toLowerCase().includes(term) ||
                dn.company?.toLowerCase().includes(term)
            );
        }

        if (titleFilter) {
            filtered = filtered.filter(dn => (dn.title || 'Cash').toLowerCase().includes(titleFilter.toLowerCase()));
        }

        if (customerFilter) {
            filtered = filtered.filter(dn => dn.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
        }

        if (companyFilter) {
            filtered = filtered.filter(dn => dn.company?.toLowerCase().includes(companyFilter.toLowerCase()));
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(dn => (dn.status || 'Draft') === statusFilter);
        }

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
            case 'To Bill': return 'bg-orange-100 text-orange-800';
            case 'Submitted': return 'bg-blue-100 text-blue-800';
            case 'Completed': return 'bg-green-100 text-green-800';
            case 'Cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Calculate totals (same as before)
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

    useEffect(() => {
        calculateTotals();
    }, [form.items, form.taxes, form.currency]);

    const searchItems = async (query, rowIndex) => {
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
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: 'Nos', rate: 0, amount: 0 }]
        }));
    };

    const selectItem = async (idx, item) => {
        const items = [...form.items];
        items[idx] = {
            item_code: item.item_code,
            item_name: item.item_name,
            uom: item.stock_uom || 'Nos',
            qty: items[idx]?.qty || 1,
            rate: 0,
            amount: 0
        };

        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_dn', {
                params: { item_code: item.item_code, price_list: form.selling_price_list }
            });
            items[idx].rate = res.data.message?.rate || 0;
        } catch (e) { }

        items[idx].amount = items[idx].qty * items[idx].rate;
        setForm(prev => ({ ...prev, items }));
        setItemQueries(prev => ({ ...prev, [idx]: '' }));
        setActiveItemRow(null);
    };

    const updateItem = (i, field, value) => {
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            items[i].amount = (parseFloat(items[i].qty) || 0) * (parseFloat(items[i].rate) || 0);
        }
        setForm(prev => ({ ...prev, items }));
    };

    const createDeliveryNote = async () => {
        if (!form.customer || !form.set_warehouse || form.items.length === 0 || form.items.some(i => !i.item_code)) {
            alert("Please fill all required fields and add valid items.");
            return;
        }

        setSaving(true);
        const payload = {
            doctype: "Delivery Note",
            posting_date: form.posting_date,
            posting_time: form.posting_time,
            customer: form.customer,
            set_warehouse: form.set_warehouse,
            is_return: form.is_return,
            currency: form.currency,
            selling_price_list: form.selling_price_list,
            ignore_pricing_rule: form.ignore_pricing_rule,
            update_stock: 1,
            items: form.items.map(i => ({
                item_code: i.item_code,
                qty: i.qty,
                rate: i.rate,
                uom: i.uom
            })),
            taxes_and_charges: form.taxes_and_charges || undefined,
            taxes: form.taxes.map(t => ({
                charge_type: t.charge_type || "On Net Total",
                account_head: t.account_head,
                rate: t.rate,
                description: t.description || t.account_head
            }))
        };

        try {
            const res = await axios.post('/api/resource/Delivery Note', payload);
            alert(`Delivery Note Created: ${res.data.data.name}`);
            setShowModal(false);
            loadData();
            setForm({
                posting_date: new Date().toISOString().split('T')[0],
                posting_time: new Date().toTimeString().slice(0, 5),
                customer: '', customer_name: '', set_warehouse: '',
                is_return: 0, currency: 'INR', selling_price_list: 'Standard Selling',
                items: [], taxes_and_charges: '', taxes: [],
                total_qty: 0, base_total: 0, total_taxes_and_charges: 0, grand_total: 0, rounded_total: 0, in_words: ''
            });
        } catch (err) {
            alert("Error: " + (err.response?.data?.message || "Failed"));
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = useMemo(() => {
        return customers.filter(c =>
            c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
            c.name?.toLowerCase().includes(searchCustomer.toLowerCase())
        ).slice(0, 10);
    }, [searchCustomer, customers]);

    const currencySymbol = getCurrencySymbol();

    // Pagination
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
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-medium flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Add Delivery Note
                    </button>
                </div>

                <div className="flex">

                    {/* Sidebar - All Filters */}
                    <div className="w-72 bg-white border-r min-h-screen p-6 space-y-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Filters</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input
                                type="text"
                                placeholder="Search anything..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                            <input
                                type="text"
                                placeholder="e.g., Cash"
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                            <input
                                type="text"
                                placeholder="Company name..."
                                value={companyFilter}
                                onChange={e => setCompanyFilter(e.target.value)}
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
                                <option value="To Bill">To Bill</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Grand Total Range</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={minAmount}
                                    onChange={e => setMinAmount(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={maxAmount}
                                    onChange={e => setMaxAmount(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setTitleFilter('');
                                setCustomerFilter('');
                                setCompanyFilter('');
                                setStatusFilter('all');
                                setMinAmount('');
                                setMaxAmount('');
                            }}
                            className="w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg py-2 text-sm font-medium"
                        >
                            Clear Filters
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6">

                        <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>{filteredNotes.length} items</span>
                                <button className="flex items-center gap-1 hover:text-gray-900">
                                    <Filter className="w-4 h-4" /> Filters
                                </button>
                            </div>
                            <span>Last Updated On</span>
                        </div>

                        {/* Table */}
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        <tr><td colSpan="7" className="text-center py-16"><Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-400" /></td></tr>
                                    ) : paginatedNotes.length === 0 ? (
                                        <tr><td colSpan="7" className="text-center py-16 text-gray-500">No delivery notes found</td></tr>
                                    ) : (
                                        paginatedNotes.map(dn => (
                                            <tr key={dn.name} className="hover:bg-gray-50">
                                                <td className="px-6 py-4"><input type="checkbox" /></td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{dn.title || 'Cash'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dn.status)}`}>
                                                        {dn.status || 'Draft'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">{dn.customer_name || 'Cash'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{dn.company || 'Your Company'}</td>
                                                <td className="px-6 py-4 text-sm text-right font-medium">
                                                    {getCurrencySymbol('INR')}{Number(dn.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{dn.name}</td>
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

                    {/* Modal */}
                    {showModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">

                                <div className="sticky top-0 bg-gradient-to-r text-black px-8 py-5 flex justify-between items-center">
                                    <h2 className="text-2xl font-bold flex items-center gap-3">
                                        <FileText className="w-8 h-8" /> New Delivery Note
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8">

                                    {/* Customer, Date, Time */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={searchCustomer}
                                                    onChange={e => setSearchCustomer(e.target.value)}
                                                    onFocus={() => setShowCustomerDropdown(true)}
                                                    placeholder="Search customer..."
                                                    className="pl-10 w-full border border-gray-300 rounded-lg py-3 px-4 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                />
                                                {showCustomerDropdown && filteredCustomers.length > 0 && (
                                                    <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-xl max-h-60 overflow-auto">
                                                        {filteredCustomers.map(c => (
                                                            <div
                                                                key={c.name}
                                                                onClick={() => {
                                                                    setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                    setSearchCustomer(c.customer_name);
                                                                    setShowCustomerDropdown(false);
                                                                }}
                                                                className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0"
                                                            >
                                                                <div className="font-medium">{c.customer_name}</div>
                                                                <div className="text-xs text-gray-500">{c.name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {form.customer_name && <p className="mt-2 text-green-700 font-medium">{form.customer_name}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                                            <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg py-3 px-4" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                                            <input type="time" value={form.posting_time} onChange={e => setForm(prev => ({ ...prev, posting_time: e.target.value }))} className="w-full border border-gray-300 rounded-lg py-3 px-4" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={form.is_return} onChange={e => setForm(prev => ({ ...prev, is_return: e.target.checked ? 1 : 0 }))} className="rounded text-green-600" />
                                            <span className="text-sm font-medium">Is Return</span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Currency *</label>
                                            <select value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} className="w-full border border-gray-300 rounded-lg py-3 px-4">
                                                <option value="INR">INR - Indian Rupee</option>
                                                <option value="AED">AED - UAE Dirham</option>
                                                <option value="USD">USD - US Dollar</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Price List *</label>
                                            <select value={form.selling_price_list} onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))} className="w-full border border-gray-300 rounded-lg py-3 px-4">
                                                {priceLists.map(pl => <option key={pl}>{pl}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-end">
                                            <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={form.ignore_pricing_rule} onChange={e => setForm(prev => ({ ...prev, ignore_pricing_rule: e.target.checked ? 1 : 0 }))} className="rounded text-green-600" />
                                                <span className="text-sm">Ignore Pricing Rule</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse *</label>
                                        <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="w-full max-w-md border border-gray-300 rounded-lg py-3 px-4">
                                            <option value="">Select Warehouse</option>
                                            {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Items Table */ }
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">Items</h3>
                                            <button onClick={addItemRow} className="text-green-600 hover:text-green-700 font-medium flex items-center gap-2">
                                                <Plus className="w-5 h-5" /> Add Item
                                            </button>
                                        </div>

                                        <div className="border rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">#</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Item Code *</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Item Name</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Qty</th>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">UOM</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Rate ({form.currency})</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Amount ({form.currency})</th>
                                                        <th className="w-12"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.items.map((item, i) => (
                                                        <tr key={i} className="border-b hover:bg-gray-50">
                                                            <td className="px-4 py-3 text-sm text-gray-600">{i + 1}</td>
                                                            <td className="px-4 py-3 relative">
                                                                <input
                                                                    type="text"
                                                                    value={itemQueries[i] || ''}
                                                                    onChange={(e) => {
                                                                        const q = e.target.value;
                                                                        setItemQueries(prev => ({ ...prev, [i]: q }));
                                                                        if (q.length >= 2) searchItems(q, i);
                                                                        setActiveItemRow(i);
                                                                    }}
                                                                    onFocus={() => setActiveItemRow(i)}
                                                                    placeholder="Search item..."
                                                                    className="w-full border rounded px-3 py-2 text-sm"
                                                                />
                                                                {activeItemRow === i && allItems.length > 0 && (
                                                                    <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-xl max-h-60 overflow-auto">
                                                                        {allItems.map(it => (
                                                                            <div key={it.item_code} onClick={() => selectItem(i, it)} className="px-4 py-2 hover:bg-green-50 cursor-pointer text-sm">
                                                                                <div className="font-medium">{it.item_name}</div>
                                                                                <div className="text-xs text-gray-500">{it.item_code} • {it.stock_uom}</div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">{item.item_name || '-'}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <input type="number" value={item.qty || ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 1)} className="w-20 text-center border rounded px-2 py-1 text-sm" min="1" />
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-sm">{item.uom || 'Nos'}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <input type="number" value={item.rate || ''} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} className="w-24 text-right border rounded px-2 py-1 text-sm" step="0.01" />
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium">
                                                                {currencySymbol}{(item.amount || 0).toFixed(2)}
                                                            </td>
                                                            <td>
                                                                <button onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, x) => x !== i) }))} className="text-red-500 hover:text-red-700 p-1">
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {form.items.length === 0 && (
                                                        <tr>
                                                            <td colSpan="8" className="text-center py-12 text-gray-500">No items added</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="text-right mt-4 font-medium text-gray-700">
                                            Total Quantity: <span className="text-xl font-bold text-gray-900">{form.total_qty}</span>
                                        </div>
                                    </div>

                                    {/* Tax Template */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Taxes & Charges Template</label>
                                        <select value={form.taxes_and_charges} onChange={e => applyTaxTemplate(e.target.value)} className="w-full max-w-md border rounded-lg py-3 px-4">
                                            <option value="">No Tax</option>
                                            {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>

                                    {/* Taxes Table */}
                                    {form.taxes.length > 0 && (
                                        <div className="bg-gray-50 rounded-xl p-6 border">
                                            <h4 className="font-semibold mb-4 text-gray-900">Taxes & Charges</h4>
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-2">Account Head</th>
                                                        <th className="text-right py-2">Rate</th>
                                                        <th className="text-right py-2">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.taxes.map((t, i) => {
                                                        const amt = (t.rate / 100) * form.base_total;
                                                        return (
                                                            <tr key={i}>
                                                                <td className="py-2">{t.account_head}</td>
                                                                <td className="text-right py-2">{t.rate}%</td>
                                                                <td className="text-right font-medium py-2">
                                                                    {currencySymbol}{amt.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="font-bold text-base border-t-2 border-gray-300">
                                                        <td colSpan="2" className="text-right py-3">Total Tax</td>
                                                        <td className="text-right py-3">
                                                            {currencySymbol}{form.total_taxes_and_charges.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Final Totals */}
                                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl p-6 text-center">
                                        <div className="space-y-3">
                                            <div className="text-xl">
                                                <span className="font-medium">Grand Total</span>: {currencySymbol}{form.grand_total.toFixed(2)}
                                            </div>
                                            <div className="text-3xl font-bold">
                                                {currencySymbol}{form.rounded_total.toFixed(2)}
                                            </div>
                                            {form.currency === 'INR' && form.in_words && (
                                                <p className="text-lg italic mt-4 opacity-90">{form.in_words}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex justify-end gap-4 pt-6 border-t">
                                        <button onClick={() => setShowModal(false)} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={createDeliveryNote}
                                            disabled={saving}
                                            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-3 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                                            {saving ? 'Saving...' : 'Save Delivery Note'}
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