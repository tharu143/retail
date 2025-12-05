import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

const SalesInvoiceList = () => {
    const [invoices, setInvoices] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [form, setForm] = useState({
        posting_date: new Date().toISOString().split('T')[0],
        customer: '', customer_name: '',
        due_date: '', is_pos: false, pos_profile: '',
        set_warehouse: '', update_stock: false,
        items: [],
        taxes_and_charges: '',
        taxes: [],
        total_taxes_and_charges: 0,
        grand_total: 0,
        rounded_total: 0
    });

    // Dropdown States
    const [customers, setCustomers] = useState([]);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    const [itemsList, setItemsList] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    // Active row for item search
    const [activeItemRow, setActiveItemRow] = useState(null);
    const [itemSearchQuery, setItemSearchQuery] = useState({});

    useEffect(() => {
        fetchInitialData();
        fetchInvoices(); // NEW: Invoice list load pannum
    }, []);

    const fetchInitialData = async () => {
        try {
            const [custRes, itemRes, taxRes, whRes] = await Promise.all([
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_customers_list_si'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si'),
                axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses_si')
            ]);
            setCustomers(custRes.data.message);
            setItemsList(itemRes.data.message);
            setTaxTemplates(taxRes.data.message);
            setWarehouses(whRes.data.message);
        } catch (err) { console.error(err); }
    };

    const fetchInvoices = async () => {
        try {
            const res = await axios.get('/api/resource/Sales Invoice', { params: { fields: '["name","customer_name","posting_date","grand_total","status"]', limit_page_length: 50 } });
            setInvoices(res.data.data);
        } catch (err) { console.log("No invoices yet or error"); }
    };

    const fetchItems = async (query) => {
        if (!query) return;
        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_si', { params: { query } });
        setItemsList(res.data.message);
    };

    const fetchTaxes = async (template) => {
        if (!template) {
            setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
            calculateTotals();
            return;
        }
        const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_si', { params: { template } });
        setForm(prev => ({ ...prev, taxes: res.data.message, taxes_and_charges: template }));
        calculateTotals();
    };

    const addItemRow = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { item_code: '', item_name: '', qty: 1, uom: '', rate: 0, amount: 0 }]
        }));
    };

    const selectItem = async (rowIndex, item) => {
        const updated = [...form.items];
        updated[rowIndex] = {
            ...updated[rowIndex],
            item_code: item.item_code,
            item_name: item.item_name,
            uom: item.stock_uom,
        };

        // Fetch rate
        const rateRes = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_selling_rate_si', { params: { item_code: item.item_code } });
        updated[rowIndex].rate = rateRes.data.message.rate || 0;
        updated[rowIndex].amount = updated[rowIndex].qty * updated[rowIndex].rate;

        setForm(prev => ({ ...prev, items: updated }));
        setActiveItemRow(null);
        setItemSearchQuery(prev => ({ ...prev, [rowIndex]: '' }));
        calculateTotals();
    };

    const updateItemField = (index, field, value) => {
        const updated = [...form.items];
        updated[index][field] = value;
        if (field === 'qty' || field === 'rate') {
            updated[index].amount = (updated[index].qty || 0) * (updated[index].rate || 0);
        }
        setForm(prev => ({ ...prev, items: updated }));
        calculateTotals();
    };

    const calculateTotals = () => {
        const netTotal = form.items.reduce((sum, i) => sum + (i.amount || 0), 0);
        const taxTotal = form.taxes.reduce((sum, t) => sum + (t.tax_amount || (t.rate / 100 * netTotal) || 0), 0);
        const grand = netTotal + taxTotal;
        setForm(prev => ({
            ...prev,
            total_taxes_and_charges: taxTotal,
            grand_total: grand,
            rounded_total: Math.round(grand)
        }));
    };

    const [saving, setSaving] = useState(false); // Add this in state

    // FULLY WORKING CREATE INVOICE FUNCTION
    const createSalesInvoice = async () => {
        if (!form.customer) {
            alert("Customer is required!");
            return;
        }
        if (form.items.length === 0 || form.items.some(i => !i.item_code)) {
            alert("Please add at least one valid item!");
            return;
        }

        setSaving(true);

        const invoiceData = {
            docstatus: 0,
            doctype: "Sales Invoice",
            posting_date: form.posting_date,
            customer: form.customer,
            due_date: form.due_date || form.posting_date,
            is_pos: form.is_pos ? 1 : 0,
            update_stock: form.update_stock ? 1 : 0,
            set_warehouse: form.set_warehouse || undefined,
            items: form.items.map(item => ({
                item_code: item.item_code,
                qty: item.qty,
                rate: item.rate,
                uom: item.uom
            })),
            taxes_and_charges: form.taxes_and_charges || undefined,
            taxes: form.taxes.map(t => ({
                charge_type: t.charge_type,
                account_head: t.account_head,
                rate: t.rate,
                description: t.description,
                tax_amount: 0 // Frappe auto calculate pannum
            }))
        };

        try {
            const res = await axios.post('/api/resource/Sales Invoice', invoiceData);

            if (res.data?.data?.name) {
                alert(`Sales Invoice Created Successfully! ID: ${res.data.data.name}`);
                setShowModal(false);
                fetchInvoices(); // Refresh list
                // Reset form
                setForm({
                    posting_date: new Date().toISOString().split('T')[0],
                    customer: '', customer_name: '',
                    due_date: '', is_pos: false, pos_profile: '',
                    set_warehouse: '', update_stock: false,
                    items: [], taxes_and_charges: '', taxes: [],
                    total_taxes_and_charges: 0, grand_total: 0, rounded_total: 0
                });
                setSearchCustomer('');
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.exception || err.response?.data?.message || "Failed to create invoice";
            alert("Error: " + msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <NavBar />
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Sales Invoices</h1>
                    <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
                        + New Invoice
                    </button>
                </div>

                {/* INVOICE LIST - FIXED */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left">Invoice #</th>
                                <th className="px-6 py-4 text-left">Customer</th>
                                <th className="px-6 py-4 text-left">Date</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-12 text-gray-500">No invoices found</td></tr>
                            ) : (
                                invoices.map(inv => (
                                    <tr key={inv.name} className="border-t hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">{inv.name}</td>
                                        <td className="px-6 py-4">{inv.customer_name}</td>
                                        <td className="px-6 py-4">{inv.posting_date}</td>
                                        <td className="px-6 py-4 text-right font-medium">₹{inv.grand_total?.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* MODAL WITH FULLY FIXED ITEMS + TAXES */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-screen overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
                                <h2 className="text-2xl font-bold">New Sales Invoice</h2>
                                <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
                            </div>

                            <div className="p-6 space-y-8">
                                {/* Header Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <div>
                                        <label className="block font-medium mb-1">Posting Date <span className="text-red-500">*</span></label>
                                        <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="w-full px-4 py-2 border rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block font-medium mb-1">Customer <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={searchCustomer}
                                                onChange={e => setSearchCustomer(e.target.value)}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                placeholder="Search customer..."
                                                className="w-full px-4 py-2 border rounded-lg"
                                            />
                                            {showCustomerDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {customers
                                                        .filter(c => c.customer_name?.toLowerCase().includes(searchCustomer.toLowerCase()))
                                                        .map(c => (
                                                            <div key={c.name} onClick={() => {
                                                                setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                setSearchCustomer(c.customer_name);
                                                                setShowCustomerDropdown(false);
                                                            }} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
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

                                    <div className="flex gap-8 items-center">
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_pos} onChange={e => setForm(prev => ({ ...prev, is_pos: e.target.checked }))} /> <span>Is POS</span></label>
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={form.update_stock} onChange={e => setForm(prev => ({ ...prev, update_stock: e.target.checked }))} /> <span>Update Stock</span></label>
                                    </div>
                                </div>

                                {/* ITEMS TABLE - FULLY FIXED */}
                                <div>
                                    <div className="flex justify-between mb-3">
                                        <h3 className="text-lg font-semibold">Items</h3>
                                        <button onClick={addItemRow} className="text-blue-600 font-medium">+ Add Row</button>
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
                                                {form.items.length === 0 && (
                                                    <tr><td colSpan="6" className="text-center py-8 text-gray-500">No items added</td></tr>
                                                )}
                                                {form.items.map((item, i) => (
                                                    <tr key={i} className="border-t relative">
                                                        <td className="px-4 py-2">
                                                            <input
                                                                type="text"
                                                                value={itemSearchQuery[i] || ''}
                                                                onChange={e => {
                                                                    setItemSearchQuery(prev => ({ ...prev, [i]: e.target.value }));
                                                                    setActiveItemRow(i);
                                                                    fetchItems(e.target.value);
                                                                }}
                                                                onFocus={() => setActiveItemRow(i)}
                                                                placeholder="Search item..."
                                                                className="w-full border rounded px-3 py-2"
                                                            />
                                                            {activeItemRow === i && itemSearchQuery[i] && (
                                                                <div className="absolute z-50 bg-white border rounded-lg shadow-lg mt-1 w-full max-h-60 overflow-y-auto">
                                                                    {itemsList
                                                                        .filter(it => it.item_name.toLowerCase().includes(itemSearchQuery[i].toLowerCase()))
                                                                        .map(it => (
                                                                            <div
                                                                                key={it.item_code}
                                                                                onClick={() => selectItem(i, it)}
                                                                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                                                            >
                                                                                <div className="font-medium">{it.item_name}</div>
                                                                                <div className="text-xs text-gray-500">{it.item_code}</div>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            )}
                                                            {item.item_name && <div className="mt-1 text-sm font-medium">{item.item_name}</div>}
                                                        </td>
                                                        <td className="px-4 py-2"><input type="number" value={item.qty} onChange={e => updateItemField(i, 'qty', parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1" /></td>
                                                        <td className="px-4 py-2 text-center">{item.uom || '-'}</td>
                                                        <td className="px-4 py-2"><input type="number" value={item.rate} onChange={e => updateItemField(i, 'rate', parseFloat(e.target.value) || 0)} className="w-full border rounded px-2 py-1" /></td>
                                                        <td className="px-4 py-2 text-right font-medium">{item.amount.toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            <button onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))} className="text-red-600 hover:text-red-800">×</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* TAXES TABLE - ADDED & FIXED */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div>
                                        <label className="block font-medium mb-2">Taxes Template</label>
                                        <select value={form.taxes_and_charges} onChange={e => fetchTaxes(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                                            <option value="">Select Template</option>
                                            {taxTemplates.map(t => <option key={t.name}>{t.name}</option>)}
                                        </select>

                                        {form.taxes.length > 0 && (
                                            <div className="mt-4 border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">Account</th>
                                                            <th className="px-3 py-2 text-right">Rate (%)</th>
                                                            <th className="px-3 py-2 text-right">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {form.taxes.map((tax, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="px-3 py-2 text-xs">{tax.description || tax.account_head}</td>
                                                                <td className="px-3 py-2 text-right">{tax.rate}</td>
                                                                <td className="px-3 py-2 text-right font-medium">
                                                                    {tax.tax_amount || ((tax.rate / 100) * form.items.reduce((s, it) => s + it.amount, 0)).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Totals */}
                                    <div className="lg:col-span-2 bg-gray-50 p-6 rounded-xl space-y-3">
                                        <div className="flex justify-between text-lg"><span>Net Total</span> <span className="font-bold">₹{form.items.reduce((s, i) => s + i.amount, 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>Tax Total</span> <span>₹{form.total_taxes_and_charges.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-xl font-bold border-t pt-3"><span>Grand Total</span> <span className="text-blue-600">₹{form.grand_total.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-2xl font-bold"><span>Rounded Total</span> <span className="text-green-600">₹{form.rounded_total}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-4 pt-6 border-t sticky bottom-0 bg-white">
                                <button onClick={() => setShowModal(false)} className="px-8 py-3 border rounded-lg hover:bg-gray-100">Cancel</button>
                                <button
                                    onClick={createSalesInvoice}
                                    disabled={saving}
                                    className={`px-8 py-3 rounded-lg font-medium transition ${saving
                                            ? 'bg-gray-400 cursor-not-allowed text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    {saving ? 'Saving...' : 'Save Invoice'}
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