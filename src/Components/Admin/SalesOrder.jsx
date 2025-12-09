// src/pages/SalesOrder.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, X, Trash2, Package, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const RESOURCE_BASE = '/api/resource';


function recalcForm(form) {
    const items = form.items || [];
    const taxes = form.taxes || [];

    const total_qty = items.reduce(
        (sum, i) => sum + (parseFloat(i.qty) || 0),
        0
    );
    const base_total = items.reduce(
        (sum, i) => sum + (parseFloat(i.amount) || 0),
        0
    );

    let total_taxes = 0;
    let previous_total = base_total;

    const updatedTaxes = taxes.map(tax => {
        let taxAmount = 0;
        const rate = parseFloat(tax.rate) || 0;

        if (tax.charge_type === 'Actual') {
            taxAmount = parseFloat(tax.tax_amount) || 0;
        } else if (tax.charge_type === 'On Previous Row Amount') {
            taxAmount = previous_total * (rate / 100);
        } else {

            taxAmount = base_total * (rate / 100);
        }

        const signedAmount = tax.add_deduct_tax === 'Add'
            ? taxAmount
            : -taxAmount;

        total_taxes += signedAmount;
        previous_total += signedAmount;

        return {
            ...tax,
            tax_amount: tax.charge_type === 'Actual'
                ? parseFloat(tax.tax_amount || 0)
                : parseFloat(taxAmount.toFixed(3)),
            total: signedAmount.toFixed(3),
        };
    });

    const net_total_with_tax = base_total + total_taxes;

    const discount_perc = parseFloat(form.additional_discount_percentage) || 0;
    const discount_amt = parseFloat(form.discount_amount) || 0;
    const discount = form.apply_discount_on === 'Grand Total'
        ? (net_total_with_tax * discount_perc / 100) + discount_amt
        : (base_total * discount_perc / 100) + discount_amt;

    const grand_total = net_total_with_tax - discount;
    const rounded_total = Math.round(grand_total * 100) / 100;
    const rounding_adjustment = rounded_total - grand_total;

    return {
        ...form,
        total_qty,
        base_total,
        total: base_total,
        total_taxes_and_charges: parseFloat(total_taxes.toFixed(2)),
        grand_total: parseFloat(grand_total.toFixed(2)),
        rounded_total: parseFloat(rounded_total.toFixed(2)),
        rounding_adjustment: parseFloat(rounding_adjustment.toFixed(2)),
        taxes: updatedTaxes,
    };
}


function SalesOrder() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filteredOrders, setFilteredOrders] = useState([]);

    // Add these states with your others
    const [searchTerm, setSearchTerm] = useState('');
    const [titleFilter, setTitleFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');

    useEffect(() => {
        let filtered = orders;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(o =>
                o.name?.toLowerCase().includes(term) ||
                o.customer_name?.toLowerCase().includes(term) ||
                o.title?.toLowerCase().includes(term)
            );
        }
        if (titleFilter) filtered = filtered.filter(o => (o.title || '').toLowerCase().includes(titleFilter.toLowerCase()));
        if (customerFilter) filtered = filtered.filter(o => o.customer_name?.toLowerCase().includes(customerFilter.toLowerCase()));
        if (statusFilter !== 'all') filtered = filtered.filter(o =>
            (o.docstatus === 1 && statusFilter === 'Submitted') ||
            (o.docstatus === 0 && statusFilter === 'Draft')
        );

        if (minAmount || maxAmount) {
            filtered = filtered.filter(o => {
                const amt = Number(o.grand_total || 0);
                if (minAmount && amt < Number(minAmount)) return false;
                if (maxAmount && amt > Number(maxAmount)) return false;
                return true;
            });
        }

        setFilteredOrders(filtered);
    }, [searchTerm, titleFilter, customerFilter, statusFilter, minAmount, maxAmount, orders]);

    const [form, setForm] = useState({
        naming_series: 'SAL-ORD-.YYYY.-',
        transaction_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        customer: '',
        customer_name: '',
        order_type: 'Sales',
        currency: 'AED',
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        items: [{
            item_code: '',
            item_name: '',
            qty: 1,
            rate: 0,
            amount: 0,
            uom: 'Nos',
            delivery_date: ''
        }],
        taxes_and_charges: '',
        taxes: [],
        apply_discount_on: 'Grand Total',
        additional_discount_percentage: 0,
        discount_amount: 0,
        total_qty: 0,
        base_total: 0,
        total: 0,
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounding_adjustment: 0,
        rounded_total: 0
    });

    const [customers, setCustomers] = useState([]);
    const [itemsList, setItemsList] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [itemSearches, setItemSearches] = useState({});
    const [showItemDropdowns, setShowItemDropdowns] = useState({});

    useEffect(() => {
        fetchOrders();
        fetchCustomers();
        fetchTaxTemplates();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await axios.get('/api/resource/Sales Order', {
                params: {
                    fields: JSON.stringify([
                        "name",
                        "customer",
                        "customer_name",
                        "transaction_date",
                        "grand_total",
                        "docstatus"
                    ])
                },
                withCredentials: true
            });

            setOrders(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const res = await axios.get(`${API_PATH}.get_customers_list_so`, { withCredentials: true });
            setCustomers(res.data.message || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchTaxTemplates = async () => {
        try {
            const res = await axios.get(`${API_PATH}.get_sales_taxes_templates_so`, { withCredentials: true });
            setTaxTemplates(res.data.message || []);
        } catch (err) {
            console.error("Tax template fetch error:", err);
        }
    };

    const recalculate = useCallback(() => {
        setForm(prev => recalcForm(prev));
    }, []);


    const loadTaxTemplate = async (templateName) => {
        if (!templateName) {
            setForm(prev => recalcForm({
                ...prev,
                taxes_and_charges: '',
                taxes: []
            }));
            return;
        }

        try {
            const res = await axios.get(`${API_PATH}.get_sales_taxes_templates_so`, {
                params: { template: templateName },
                withCredentials: true
            });

            const newTaxes = (res.data.message || []).map(t => ({
                ...t,
                add_deduct_tax: t.add_deduct_tax || "Add",
                total: "0.000",
            }));

            setForm(prev => recalcForm({
                ...prev,
                taxes_and_charges: templateName,
                taxes: newTaxes
            }));
        } catch (err) {
            console.error("Failed to load tax template:", err);
            alert("Could not load tax template: " + (err.response?.data?.message || err.message));
        }
    };


    const updateItem = (idx, field, value) => {
        setForm(prev => {
            const items = [...prev.items];
            items[idx] = { ...items[idx], [field]: value };
            if (field === 'qty' || field === 'rate') {
                items[idx].amount = (parseFloat(items[idx].qty) || 0) * (parseFloat(items[idx].rate) || 0);
            }
            return { ...prev, items };
        });
        recalculate();
    };

    const selectItem = async (idx, item) => {
        try {
            const rateRes = await axios.get(`${API_PATH}.get_item_selling_rate_so`, {
                params: { item_code: item.item_code, price_list: form.selling_price_list },
                withCredentials: true
            });
            const rate = rateRes.data.message?.rate || 0;

            setForm(prev => {
                const items = [...prev.items];
                items[idx] = {
                    item_code: item.item_code,
                    item_name: item.item_name,
                    uom: item.stock_uom || 'Nos',
                    qty: 1,
                    rate: rate,
                    amount: rate * 1,
                    delivery_date: prev.delivery_date || prev.transaction_date
                };
                return { ...prev, items };
            });
            recalculate();
        } catch (err) {
            console.error(err);
        }
        setItemSearches(prev => ({ ...prev, [idx]: '' }));
        setShowItemDropdowns(prev => ({ ...prev, [idx]: false }));
    };

    const searchItems = async (query, idx) => {
        if (!query.trim()) return;
        try {
            const res = await axios.get(`${API_PATH}.get_items_so`, {
                params: { query },
                withCredentials: true
            });
            setItemsList(res.data.message || []);
            setShowItemDropdowns(prev => ({ ...prev, [idx]: true }));
        } catch (err) {
            console.error(err);
        }
    };

    const addItemRow = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, {
                item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos', delivery_date: prev.delivery_date
            }]
        }));
        recalculate();
    };

    const removeItemRow = (idx) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== idx)
        }));
        recalculate();
    };

    const addTaxRow = () => {
        setForm(prev => ({
            ...prev,
            taxes: [...prev.taxes, {
                add_deduct_tax: "Add",
                charge_type: "On Net Total",
                account_head: "",
                rate: 0,
                tax_amount: 0,
                total: "0.000"
            }]
        }));
        recalculate();
    };

    const updateTax = (idx, field, value) => {
        setForm(prev => {
            const taxes = [...prev.taxes];
            taxes[idx] = { ...taxes[idx], [field]: value };
            return { ...prev, taxes };
        });
        recalculate();
    };

    const removeTaxRow = (idx) => {
        setForm(prev => ({
            ...prev,
            taxes: prev.taxes.filter((_, i) => i !== idx)
        }));
        recalculate();
    };

    const handleSave = async () => {
        if (!form.customer) return alert("Customer is required");
        if (form.items.some(i => !i.item_code)) return alert("All items must be selected");

        setSaving(true);
        const payload = {
            doctype: "Sales Order",
            naming_series: form.naming_series,
            transaction_date: form.transaction_date,
            delivery_date: form.delivery_date || form.transaction_date,
            customer: form.customer,
            order_type: form.order_type,
            currency: form.currency,
            selling_price_list: form.selling_price_list,
            items: form.items.map(i => ({
                item_code: i.item_code,
                qty: i.qty,
                rate: i.rate,
                amount: i.amount
            })),
            taxes_and_charges: form.taxes_and_charges || undefined,
            taxes: form.taxes.map(t => ({
                charge_type: t.charge_type || "On Net Total",
                account_head: t.account_head,
                rate: parseFloat(t.rate || 0),
                tax_amount: t.charge_type === "Actual" ? parseFloat(t.tax_amount || 0) : 0,
                add_deduct_tax: t.add_deduct_tax || "Add",
                description: t.description || t.account_head
            })),
            additional_discount_percentage: form.additional_discount_percentage || 0,
            discount_amount: form.discount_amount || 0,
            apply_discount_on: form.apply_discount_on,
            rounded_total: form.rounded_total,
            rounding_adjustment: form.rounding_adjustment
        };

        try {
            await axios.post(`${RESOURCE_BASE}/Sales Order`, payload, { withCredentials: true });
            alert("Sales Order Created Successfully!");
            setShowModal(false);
            fetchOrders();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Failed to save Sales Order");
        } finally {
            setSaving(false);
        }
    };

    const openNew = () => {
        setForm({
            naming_series: 'SAL-ORD-.YYYY.-',
            transaction_date: new Date().toISOString().split('T')[0],
            delivery_date: '',
            customer: '', customer_name: '',
            order_type: 'Sales',
            currency: 'AED',
            selling_price_list: 'Standard Selling',
            price_list_currency: 'AED',
            items: [{ item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos', delivery_date: '' }],
            taxes_and_charges: '',
            taxes: [],
            apply_discount_on: 'Grand Total',
            additional_discount_percentage: 0,
            discount_amount: 0,
            total_qty: 0,
            base_total: 0,
            total: 0,
            total_taxes_and_charges: 0,
            grand_total: 0,
            rounding_adjustment: 0,
            rounded_total: 0
        });
        setSearchCustomer('');
        setItemSearches({});
        setShowItemDropdowns({});
        setShowModal(true);
    };

    return (
        <>
            <NavBar />
            <div className="min-h-screen bg-gray-100">

                {/* ERPNext Style Header */}
                <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                        <Package className="w-7 h-7" /> Sales Order
                    </h1>
                    <button
                        onClick={openNew}
                        className="bg-black text-white px-5 py-2.5 rounded-md hover:bg-gray-800 font-medium flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Add Sales Order
                    </button>
                </div>

                <div className="flex">

                    {/* Sidebar Filters - Exact Sales Invoice Style */}
                    <div className="w-72 bg-white border-r min-h-screen p-6 space-y-6">
                        <h3 className="font-semibold text-gray-800 mb-4">Filters</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                            <input
                                type="text"
                                placeholder="Search orders..."
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
                                <option value="To Deliver and Bill">To Deliver and Bill</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Amount Range</label>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Min" value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                                <input type="number" placeholder="Max" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full border rounded px-3 py-2 text-sm mt-2" />
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

                    {/* Main List - Exact Sales Invoice Style */}
                    <div className="flex-1 p-6">
                        <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>{filteredOrders.length} items</span>
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        <tr><td colSpan="6" className="text-center py-16"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></td></tr>
                                    ) : orders.length === 0 ? (
                                        <tr><td colSpan="6" className="text-center py-16 text-gray-500">No sales orders found</td></tr>
                                    ) : (
                                        orders.map(order => (
                                            <tr key={order.name} className="hover:bg-gray-50">
                                                <td className="px-6 py-4"><input type="checkbox" /></td>
                                                <td className="px-6 py-4 text-sm font-medium">{order.title || 'Sales Order'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.docstatus === 1
                                                        ? 'bg-green-100 text-green-800'
                                                        : order.docstatus === 0
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {order.docstatus === 1 ? 'Submitted' : 'Draft'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">{order.customer_name}</td>
                                                <td className="px-6 py-4 text-sm text-right font-medium">
                                                    AED {Number(order.grand_total || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{order.name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center mt-6">
                            <div className="text-sm text-gray-600">
                                Showing {orders.length > 0 ? '1' : '0'} to {orders.length} of {orders.length} entries
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button className="px-4 py-2 border rounded bg-black text-white">1</button>
                                <button className="p-2 border rounded hover:bg-gray-100 disabled:opacity-50" disabled>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-screen overflow-y-auto">
                            <div className="sticky top-0 bg-white px-6 py-4 border-b flex justify-between items-center z-10">
                                <h2 className="text-2xl font-bold">New Sales Order</h2>
                                <button onClick={() => setShowModal(false)}><X size={28} /></button>
                            </div>

                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {/* Row 1 */}
                                    {/* Customer Field */}
                                    <div className="space-y-1">
                                        <label className="block font-medium">Customer <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={searchCustomer}
                                                onChange={e => setSearchCustomer(e.target.value)}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                placeholder="Search customer..."
                                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            {showCustomerDropdown && customers.length > 0 && (
                                                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {customers
                                                        .filter(c => c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()))
                                                        .map(c => (
                                                            <div
                                                                key={c.name}
                                                                onClick={() => {
                                                                    setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                    setSearchCustomer(c.customer_name);
                                                                    setShowCustomerDropdown(false);
                                                                }}
                                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer transition"
                                                            >
                                                                <div className="font-medium">{c.customer_name}</div>
                                                                <div className="text-sm text-gray-500">{c.name}</div>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date Field */}
                                    <div className="space-y-1">
                                        <label className="block font-medium">Date</label>
                                        <input
                                            type="date"
                                            value={form.transaction_date}
                                            onChange={e => setForm(prev => ({ ...prev, transaction_date: e.target.value }))}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Row 2 */}
                                    {/* Delivery Date */}
                                    <div className="space-y-1">
                                        <label className="block font-medium">Delivery Date</label>
                                        <input
                                            type="date"
                                            value={form.delivery_date}
                                            onChange={e => setForm(prev => ({ ...prev, delivery_date: e.target.value }))}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Price List */}
                                    <div className="space-y-1">
                                        <label className="block font-medium">Price List</label>
                                        <select
                                            value={form.selling_price_list}
                                            onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="Standard Selling">Standard Selling</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-semibold">Items</h3>
                                        <button onClick={addItemRow} className="text-blue-600 flex items-center gap-1"><Plus size={18} /> Add Item</button>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-3">Item</th>
                                                    <th className="text-center p-3 w-24">Qty</th>
                                                    <th className="text-center p-3 w-32">Rate</th>
                                                    <th className="text-center p-3 w-32">Amount</th>
                                                    <th className="w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.items.map((item, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="p-3">
                                                            {item.item_code ? (
                                                                <div>
                                                                    <div className="font-medium">{item.item_name}</div>
                                                                    <div className="text-sm text-gray-500">{item.item_code}</div>
                                                                </div>
                                                            ) : (
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        value={itemSearches[i] || ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            setItemSearches(prev => ({ ...prev, [i]: val }));
                                                                            searchItems(val, i);
                                                                        }}
                                                                        placeholder="Search item..."
                                                                        className="w-full px-3 py-2 border rounded"
                                                                    />
                                                                    {showItemDropdowns[i] && itemsList.length > 0 && (
                                                                        <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                                            {itemsList.map(itm => (
                                                                                <div key={itm.item_code} onClick={() => selectItem(i, itm)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                                                                    <div>{itm.item_name}</div>
                                                                                    <div className="text-sm text-gray-500">{itm.item_code}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-3"><input type="number" value={item.qty || ''} onChange={e => updateItem(i, 'qty', e.target.value)} className="w-full text-center border rounded px-2 py-1" /></td>
                                                        <td className="p-3"><input type="number" step="0.01" value={item.rate || ''} onChange={e => updateItem(i, 'rate', e.target.value)} className="w-full text-right border rounded px-2 py-1" /></td>
                                                        <td className="p-3 text-right font-medium">AED {(parseFloat(item.amount) || 0).toFixed(2)}</td>
                                                        <td className="p-3 text-center">
                                                            {form.items.length > 1 && <button onClick={() => removeItemRow(i)} className="text-red-600"><Trash2 size={18} /></button>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Taxes */}
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-semibold mb-4">Taxes & Charges</h3>
                                    <div className="mb-4">
                                        <label className="block font-medium mb-1">Taxes and Charges Template</label>
                                        <select
                                            value={form.taxes_and_charges}
                                            onChange={e => loadTaxTemplate(e.target.value)}
                                            className="w-full md:w-96 px-4 py-2 border rounded-lg"
                                        >
                                            <option value="">None</option>
                                            {taxTemplates.map(t => (
                                                <option key={t.name} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="text-left p-3 w-12"></th>
                                                    <th className="text-left p-3 w-20">#</th>
                                                    <th className="text-left p-3">Type</th>
                                                    <th className="text-left p-3">Account</th>
                                                    <th className="text-center p-3 w-32">Rate %</th>
                                                    <th className="text-center p-3 w-32">Amount</th>
                                                    <th className="text-center p-3 w-32">Total</th>
                                                    <th className="w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {form.taxes.map((tax, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="p-3">
                                                            <input type="checkbox" checked={tax.add_deduct_tax === "Add"} onChange={e => updateTax(i, 'add_deduct_tax', e.target.checked ? "Add" : "Deduct")} className="w-5 h-5" />
                                                        </td>
                                                        <td className="p-3 text-center">{i + 1}</td>
                                                        <td className="p-3">
                                                            <select value={tax.charge_type || ''} onChange={e => updateTax(i, 'charge_type', e.target.value)} className="w-full px-2 py-1 border rounded">
                                                                <option value="On Net Total">On Net Total</option>
                                                                <option value="Actual">Actual</option>
                                                                <option value="On Previous Row Amount">On Previous Row Amount</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-3"><input type="text" value={tax.account_head || ''} onChange={e => updateTax(i, 'account_head', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                                                        <td className="p-3"><input type="number" value={tax.rate || ''} onChange={e => updateTax(i, 'rate', e.target.value)} className="w-full text-right border rounded px-2" /></td>
                                                        <td className="p-3"><input type="number" value={tax.tax_amount || ''} onChange={e => updateTax(i, 'tax_amount', e.target.value)} className="w-full text-right border rounded px-2" disabled={tax.charge_type !== 'Actual'} /></td>
                                                        <td className="p-3 text-right font-medium">{parseFloat(tax.total || 0).toFixed(2)}</td>
                                                        <td className="p-3 text-center"><button onClick={() => removeTaxRow(i)} className="text-red-600"><Trash2 size={16} /></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button onClick={addTaxRow} className="mt-2 text-blue-600 text-sm flex items-center gap-1"><Plus size={16} /> Add Row</button>
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="bg-blue-50 p-6 rounded-lg">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-right">
                                        <div><strong>Total Qty:</strong> {form.total_qty || 0}</div>
                                        <div><strong>Net Total:</strong> AED {Number(form.base_total || 0).toFixed(2)}</div>
                                        <div><strong>Taxes:</strong> AED {Number(form.total_taxes_and_charges || 0).toFixed(2)}</div>
                                        <div className="text-xl font-bold text-blue-700">
                                            Grand Total: AED {Number(form.rounded_total || 0).toFixed(2)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4">
                                    <button onClick={() => setShowModal(false)} className="px-6 py-3 border rounded-lg hover:bg-gray-50">Cancel</button>
                                    <button onClick={handleSave} disabled={saving} className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-70">
                                        {saving ? 'Saving...' : 'Save Sales Order'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default SalesOrder;
