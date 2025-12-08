import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { Package, Plus, X, Search, Calendar, Warehouse, FileText, Loader2 } from 'lucide-react';

const DeliveryNoteList = () => {
    const [deliveryNotes, setDeliveryNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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
        company_address: '',
        items: [],
        taxes_and_charges: '',
        taxes: [],
        total_qty: 0,
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
    const [searchingItems, setSearchingItems] = useState({});

    const numberToWords = (num) => {
        if (!num) return 'Zero Rupees Only';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Lakh', 'Crore'];

        let rupees = Math.floor(num);
        let paise = Math.round((num - rupees) * 100);

        const convert = (n) => {
            if (n === 0) return '';
            if (n < 10) return ones[n];
            if (n < 20) return teens[n - 10];
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

        return (words || 'Zero') + ' Rupees' + (paise > 0 ? ' and ' + paise + ' Paise' : '') + ' Only';
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
                    axios.get('/api/resource/Delivery Note', { params: { fields: '["name","customer_name","posting_date","grand_total","status"]', limit_page_length: 100 } })
                ]);

                setCustomers(custRes.data.message || []);
                setWarehouses(whRes.data.message || []);
                setTaxTemplates(taxRes.data.message || []);
                setPriceLists(plRes.data.data?.map(pl => pl.name) || ['Standard Selling']);
                setDeliveryNotes(dnRes.data.data || []);
            } catch (err) {
                console.error(err);
                alert("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const searchItems = async (query, rowIndex) => {
        if (!query || query.trim().length < 2) return;
        setSearchingItems(prev => ({ ...prev, [rowIndex]: true }));
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items_dn', { params: { query } });
            setAllItems(res.data.message || []);
        } catch (err) { } finally {
            setSearchingItems(prev => ({ ...prev, [rowIndex]: false }));
        }
    };

    const applyTaxTemplate = async (template) => {
        if (!template) {
            setForm(prev => ({ ...prev, taxes: [], taxes_and_charges: '' }));
            calculateTotals();
            return;
        }
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_templates_dn', { params: { template } });
            setForm(prev => ({ ...prev, taxes: res.data.message || [], taxes_and_charges: template }));
            calculateTotals();
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
        calculateTotals();
    };

    const updateItem = (i, field, value) => {
        const items = [...form.items];
        items[i][field] = value;
        if (field === 'qty' || field === 'rate') {
            items[i].amount = (items[i].qty || 0) * (items[i].rate || 0);
        }
        setForm(prev => ({ ...prev, items }));
        calculateTotals();
    };

    const calculateTotals = () => {
        const totalQty = form.items.reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        const netTotal = form.items.reduce((s, i) => s + (i.amount || 0), 0);
        const taxTotal = form.taxes.reduce((s, t) => s + (netTotal * (t.rate || 0) / 100), 0);
        const grand = netTotal + taxTotal;
        const rounded = Math.round(grand);

        setForm(prev => ({
            ...prev,
            total_qty: totalQty,
            total_taxes_and_charges: taxTotal,
            grand_total: grand,
            rounded_total: rounded,
            in_words: numberToWords(rounded)
        }));
    };

    const createDeliveryNote = async () => {
        if (!form.customer || !form.set_warehouse || form.items.length === 0 || form.items.some(i => !i.item_code)) {
            alert("Please fill all required fields including valid items.");
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
                charge_type: t.charge_type,
                account_head: t.account_head,
                rate: t.rate,
                description: t.description || t.account_head
            }))
        };

        try {
            const res = await axios.post('/api/resource/Delivery Note', payload);
            alert(`Delivery Note Created: ${res.data.data.name}`);
            setShowModal(false);
            setDeliveryNotes(prev => [res.data.data, ...prev]);
            setForm({
                posting_date: new Date().toISOString().split('T')[0],
                posting_time: new Date().toTimeString().slice(0, 5),
                customer: '', customer_name: '', set_warehouse: '',
                is_return: 0, currency: 'INR', selling_price_list: 'Standard Selling',
                items: [], taxes_and_charges: '', taxes: [],
                total_qty: 0, total_taxes_and_charges: 0, grand_total: 0, rounded_total: 0, in_words: ''
            });
            setSearchCustomer('');
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

    return (
        <>
            <NavBar />
            <div className="min-h-screen bg-white">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">

                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-6 h-6 text-green-600" /> Delivery Notes
                            </h1>
                            <p className="text-gray-600 text-sm mt-1">Manage your delivery notes here</p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> New Delivery Note
                        </button>
                    </div>

                    <div className="bg-white border rounded-lg overflow-hidden">
                        {loading ? (
                            <div className="p-4 text-center"><Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" /></div>
                        ) : deliveryNotes.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">No delivery notes found</div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">DN No</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Customer</th>
                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {deliveryNotes.map(dn => (
                                        <tr key={dn.name} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-sm font-medium text-green-700">{dn.name}</td>
                                            <td className="px-4 py-2 text-sm">{dn.customer_name}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{new Date(dn.posting_date).toLocaleDateString('en-IN')}</td>
                                            <td className="px-4 py-2 text-sm text-right font-medium">₹{Number(dn.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {showModal && (
                        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
                            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">

                                <div className="border-b p-4 flex justify-between items-center">
                                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                                        <FileText className="w-6 h-6 text-green-600" /> New Delivery Note
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Customer *</label>
                                            <div className="relative mt-1">
                                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={searchCustomer}
                                                    onChange={e => setSearchCustomer(e.target.value)}
                                                    onFocus={() => setShowCustomerDropdown(true)}
                                                    placeholder="Search customer..."
                                                    className="pl-10 w-full border rounded-md py-2 text-sm"
                                                />
                                                {showCustomerDropdown && filteredCustomers.length > 0 && (
                                                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-auto">
                                                        {filteredCustomers.map(c => (
                                                            <div
                                                                key={c.name}
                                                                onClick={() => {
                                                                    setForm(prev => ({ ...prev, customer: c.name, customer_name: c.customer_name }));
                                                                    setSearchCustomer(c.customer_name);
                                                                    setShowCustomerDropdown(false);
                                                                }}
                                                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                            >
                                                                {c.customer_name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {form.customer_name && <p className="mt-1 text-sm text-green-700">{form.customer_name}</p>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Date *</label>
                                            <input type="date" value={form.posting_date} onChange={e => setForm(prev => ({ ...prev, posting_date: e.target.value }))} className="mt-1 w-full border rounded-md py-2 text-sm" />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Time *</label>
                                            <input type="time" value={form.posting_time} onChange={e => setForm(prev => ({ ...prev, posting_time: e.target.value }))} className="mt-1 w-full border rounded-md py-2 text-sm" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input type="checkbox" checked={form.is_return} onChange={e => setForm(prev => ({ ...prev, is_return: e.target.checked ? 1 : 0 }))} className="rounded text-green-600" />
                                            <span className="text-sm font-medium">Is Return</span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Currency *</label>
                                            <select value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} className="mt-1 w-full border rounded-md py-2 text-sm">
                                                <option>INR</option>
                                                <option>AED</option>
                                                <option>USD</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Price List *</label>
                                            <select value={form.selling_price_list} onChange={e => setForm(prev => ({ ...prev, selling_price_list: e.target.value }))} className="mt-1 w-full border rounded-md py-2 text-sm">
                                                {priceLists.map(pl => <option key={pl}>{pl}</option>)}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={form.ignore_pricing_rule} onChange={e => setForm(prev => ({ ...prev, ignore_pricing_rule: e.target.checked ? 1 : 0 }))} className="rounded text-green-600" />
                                                <span className="text-sm">Ignore Pricing Rule</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Warehouse *</label>
                                        <select value={form.set_warehouse} onChange={e => setForm(prev => ({ ...prev, set_warehouse: e.target.value }))} className="mt-1 w-full border rounded-md py-2 text-sm">
                                            <option value="">Select Warehouse</option>
                                            {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-lg font-semibold">Items</h3>
                                            <button onClick={addItemRow} className="text-green-600 hover:text-green-700 text-sm flex items-center gap-1">
                                                <Plus className="w-4 h-4" /> Add Item
                                            </button>
                                        </div>
                                        <div className="border rounded-md overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b">
                                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">#</th>
                                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item Code</th>
                                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item Name</th>
                                                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Qty</th>
                                                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">UOM</th>
                                                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Rate</th>
                                                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                                                        <th className="w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.items.map((item, i) => (
                                                        <tr key={i} className="border-b">
                                                            <td className="px-4 py-2 text-sm text-gray-600">{i + 1}</td>
                                                            <td className="px-4 py-2">
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
                                                                    placeholder="Search..."
                                                                    className="w-full border rounded-md py-1 px-2 text-sm"
                                                                />
                                                                {activeItemRow === i && allItems.length > 0 && (
                                                                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-auto">
                                                                        {allItems.map(it => (
                                                                            <div key={it.item_code} onClick={() => selectItem(i, it)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm">
                                                                                {it.item_name} ({it.item_code})
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2 text-sm">{item.item_name || '-'}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <input type="number" value={item.qty || ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 1)} className="w-16 border rounded-md py-1 px-2 text-sm text-center" min="1" />
                                                            </td>
                                                            <td className="px-4 py-2 text-center text-sm">{item.uom || 'Nos'}</td>
                                                            <td className="px-4 py-2 text-right">
                                                                <input type="number" value={item.rate || ''} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} className="w-20 border rounded-md py-1 px-2 text-sm text-right" step="0.01" />
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-sm font-medium">₹{item.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
                                                            <td className="px-2">
                                                                <button onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, x) => x !== i) }))} className="text-red-500 hover:text-red-700">
                                                                    <X className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {form.items.length === 0 && (
                                                        <tr>
                                                            <td colSpan="8" className="p-4 text-center text-gray-500">No items added. Click "Add Item" to begin.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="text-right mt-2 text-sm text-gray-600">Total Quantity: <span className="font-medium text-gray-900">{form.total_qty}</span></div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Taxes and Charges Template</label>
                                        <select value={form.taxes_and_charges} onChange={e => applyTaxTemplate(e.target.value)} className="mt-1 w-full border rounded-md py-2 text-sm">
                                            <option value="">Select Template</option>
                                            {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                        </select>
                                    </div>

                                    {form.taxes.length > 0 && (
                                        <div className="border rounded-md overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b">
                                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                                                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Account Head</th>
                                                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Rate</th>
                                                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {form.taxes.map((t, i) => {
                                                        const amt = (t.rate / 100) * form.items.reduce((s, it) => s + (it.amount || 0), 0);
                                                        return (
                                                            <tr key={i} className="border-b">
                                                                <td className="px-4 py-2 text-sm">{t.charge_type || 'On Net Total'}</td>
                                                                <td className="px-4 py-2 text-sm">{t.account_head}</td>
                                                                <td className="px-4 py-2 text-right text-sm">{t.rate}%</td>
                                                                <td className="px-4 py-2 text-right text-sm font-medium">₹{amt.toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="border-b">
                                                        <td colSpan="3" className="px-4 py-2 text-right text-sm font-medium">Total Taxes</td>
                                                        <td className="px-4 py-2 text-right text-sm font-medium">₹{form.total_taxes_and_charges.toFixed(2)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="bg-gray-100 p-4 rounded-md">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">Grand Total ({form.currency})</span>
                                            <span className="font-semibold">₹{form.grand_total.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-2">
                                            <span className="font-medium">Rounded Total ({form.currency})</span>
                                            <span className="font-semibold">₹{form.rounded_total.toFixed(2)}</span>
                                        </div>
                                        <div className="text-sm mt-2 italic text-gray-600">{form.in_words}</div>
                                    </div>

                                    <div className="flex justify-end gap-4 pt-4 border-t">
                                        <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={createDeliveryNote}
                                            disabled={saving}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 flex items-center gap-2"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default DeliveryNoteList;