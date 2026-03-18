import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, Package, Save, X, Box, ShoppingCart, DollarSign, Loader2, Warehouse, 
    History, ArrowRight, TrendingUp, Layout, User, Hash, CheckCircle2, 
    FileText, Receipt, Truck, SearchSlash, AlertCircle, ArrowUpRight, 
    BarChart3, Layers, Zap, RefreshCw, ChevronRight, Users, Trash2, Plus, Scan
} from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';
import '../Purchase/Purchase.css'; // Reuse some PO styles for consistency

const QuickStockInStandalone = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [selectedTaxTemplate, setSelectedTaxTemplate] = useState('');
    const [itemHistory, setItemHistory] = useState(null);
    const searchRef = useRef(null);

    const [itemsToSubmit, setItemsToSubmit] = useState([]);
    
    const [form, setForm] = useState({
        box_qty: 1,
        pcs_per_box: 1,
        purchase_price: 0, 
        value: 0, 
        price_type: 'Percentage', 
        supplier_sl_no: '',
        entry_type: 'Purchase',
        from_warehouse: ''
    });

    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    useEffect(() => {
        fetchInitialData();
        setTimeout(() => searchRef.current?.focus(), 100);
    }, []);

    const fetchInitialData = async () => {
        try {
            const [whData, supData, taxData] = await Promise.all([
                POSService.getWarehouses(),
                POSService.getSuppliers(),
                POSService.getPurchaseTaxTemplates()
            ]);
            const safeWh = Array.isArray(whData) ? whData : (whData?.data || []);
            const safeSup = Array.isArray(supData) ? supData : (supData?.data || []);
            const safeTax = Array.isArray(taxData) ? taxData : (taxData?.data || []);

            setWarehouses(safeWh);
            setSuppliers(safeSup);
            setTaxTemplates(safeTax);
            
            const defaultWh = localStorage.getItem('warehouse') || (safeWh?.[0]?.name || '');
            setSelectedWarehouse(defaultWh);

            const defaultTax = safeTax.find(t => t.title?.includes('5%') || t.name?.includes('5%'));
            if (defaultTax) setSelectedTaxTemplate(defaultTax.name);
        } catch (err) {
            console.error('Failed to fetch initial data', err);
        }
    };

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (!val || val.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            const query = val.toLowerCase();
            let filtered = await db.items
                .filter(it => 
                    (it.name || '').toLowerCase().includes(query) ||
                    (it.id || '').toLowerCase().includes(query) ||
                    (it.item_code || '').toLowerCase().includes(query) ||
                    (it.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(query))
                )
                .limit(10)
                .toArray();

            if (filtered.length < 5 && val.length >= 2) {
                try {
                    const onlineResults = await POSService.getRetailItems({ search_term: val });
                    if (Array.isArray(onlineResults)) {
                        const formatted = onlineResults.map(it => ({
                            ...it,
                            id: it.item_code || it.name,
                            name: it.item_name || it.name,
                            actual_qty: it.actual_qty || 0
                        }));
                        const existingIds = new Set(filtered.map(f => f.id));
                        formatted.forEach(f => {
                            if (!existingIds.has(f.id) && filtered.length < 15) filtered.push(f);
                        });
                    }
                } catch (e) {}
            }

            if (filtered.length === 0 && val.length >= 4) {
                try {
                    const globalItem = await POSService.findItemGlobal(val);
                    if (globalItem && globalItem.item_code) {
                        filtered.push({
                            ...globalItem,
                            id: globalItem.item_code,
                            name: globalItem.item_name || globalItem.name,
                            price: globalItem.custom_selling_price || 0,
                            is_global_match: true,
                            custom_pieces_per_box: globalItem.pcs_per_box || 1,
                            last_purchase_price: globalItem.last_purchase_rate || 0
                        });
                    }
                } catch (e) {}
            }
            setSearchResults(filtered);
            
            // Auto-select if exact match barcode
            if (filtered.length === 1 && val === filtered[0].id) {
                selectItem(filtered[0]);
            }
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    const selectItem = async (item) => {
        setSelectedItem(item);
        setSearchResults([]);
        setSearchQuery('');
        
        const pcsPerBox = item.custom_pieces_per_box || item.pcs_per_box || 1;
        const lastRate = item.last_purchase_price || 0;

        setForm(prev => ({
            ...prev,
            box_qty: 1,
            pcs_per_box: pcsPerBox,
            purchase_price: lastRate ? (lastRate * pcsPerBox) : 0,
            value: item.price || 0,
            price_type: item.price > 0 ? 'Amount' : 'Percentage'
        }));

        if (!item.is_global_match) {
            try {
                const history = await POSService.getItemPricingHistory(item.id);
                if (history && history[item.id]) {
                    const lastEntry = history[item.id][0];
                    setItemHistory(lastEntry);
                    if (lastEntry) {
                        setForm(prev => ({
                            ...prev,
                            purchase_price: lastEntry.rate * pcsPerBox
                        }));
                    }
                }
            } catch (err) {}
        }
    };

    const calculateLiveTarget = () => {
        const buyingPerPiece = (form.purchase_price / (form.pcs_per_box || 1));
        if (form.price_type === 'Percentage') {
            return buyingPerPiece * (1 + (form.value / 100));
        }
        return form.value;
    };

    const addToStaging = (e) => {
        if (e) e.preventDefault();
        if (!selectedItem) return;
        
        const livePrice = calculateLiveTarget();
        const newItem = {
            item_code: selectedItem.id,
            item_name: selectedItem.name,
            box_qty: form.box_qty,
            pcs_per_box: form.pcs_per_box,
            purchase_price: form.purchase_price,
            price_type: form.price_type,
            new_selling_price: form.price_type === 'Amount' ? form.value : round2(livePrice),
            margin_percent: form.price_type === 'Percentage' ? form.value : 0,
            image: selectedItem.image,
            qty: (form.box_qty || 0) * (form.pcs_per_box || 1),
            valuation_rate: (form.purchase_price || 0) / (form.pcs_per_box || 1)
        };

        setItemsToSubmit(prev => [...prev, newItem]);
        setSelectedItem(null);
        setSearchQuery("");
        setForm(prev => ({ ...prev, box_qty: 1, purchase_price: 0, value: 0 }));
        searchRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (itemsToSubmit.length === 0) {
            Swal.fire({ title: 'Batch Empty', text: 'Please add items to the batch.', icon: 'warning' });
            return;
        }
        if (form.entry_type === 'Purchase' && !selectedSupplier) {
            Swal.fire({ title: 'Missing Supplier', text: 'Please select a supplier.', icon: 'warning' });
            return;
        }
        if (form.entry_type === 'Transfer' && !form.from_warehouse) {
            Swal.fire({ title: 'Missing Source', text: 'Please select a source warehouse.', icon: 'warning' });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                items: itemsToSubmit,
                warehouse: selectedWarehouse,
                supplier_sl_no: form.supplier_sl_no,
                supplier: form.entry_type === 'Transfer' ? form.from_warehouse : selectedSupplier,
                from_warehouse: form.from_warehouse,
                entry_type: form.entry_type,
                tax_template: selectedTaxTemplate
            };
            const res = await POSService.submitPurchaseEntry(payload);
            if (res) {
                Swal.fire({ title: 'Success!', text: 'Stock-in processed successfully.', icon: 'success' });
                setItemsToSubmit([]);
                setForm(prev => ({ ...prev, box_qty: 1, purchase_price: 0, value: 0, supplier_sl_no: '' }));
            }
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.message, icon: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* STICKY COMPACT HEADER */}
            <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setForm({...form, entry_type: 'Purchase'})}
                            className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${form.entry_type === 'Purchase' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >Purchase</button>
                        <button 
                            onClick={() => setForm({...form, entry_type: 'Transfer'})}
                            className={`px-4 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${form.entry_type === 'Transfer' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >Transfer</button>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target WH</label>
                            <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="bg-transparent text-[13px] font-bold text-emerald-600 outline-none cursor-pointer">
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{form.entry_type === 'Purchase' ? 'Supplier' : 'Source WH'}</label>
                            {form.entry_type === 'Purchase' ? (
                                <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="bg-transparent text-[13px] font-bold text-slate-700 outline-none cursor-pointer">
                                    <option value="">Select...</option>
                                    {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>)}
                                </select>
                            ) : (
                                <select value={form.from_warehouse} onChange={(e) => setForm({...form, from_warehouse: e.target.value})} className="bg-transparent text-[13px] font-bold text-slate-700 outline-none cursor-pointer">
                                    <option value="">Select WH...</option>
                                    {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reference No</label>
                            <input type="text" value={form.supplier_sl_no} onChange={(e) => setForm({...form, supplier_sl_no: e.target.value})} placeholder="Inv #..." className="bg-transparent border-none p-0 text-[13px] font-bold text-slate-700 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Batch Total</span>
                        <div className="text-xl font-black text-emerald-600 tabular-nums">
                            <small className="text-[11px] mr-1">AED</small>
                            {itemsToSubmit.reduce((acc, it) => acc + (it.box_qty * it.purchase_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <button 
                        onClick={handleSubmit}
                        disabled={submitting || itemsToSubmit.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'Posting...' : 'Commit Batch'}
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN: SEARCH & QUEUE */}
                <div className="lg:col-span-8 space-y-6">
                    {/* SEARCH BOX */}
                    <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500">
                            <Scan size={22} strokeWidth={2.5} />
                        </div>
                        <input 
                            ref={searchRef}
                            type="text" 
                            placeholder="Scan Barcode or Search Inventory..." 
                            className="w-full pl-14 pr-16 py-5 bg-white border border-slate-200 focus:border-emerald-500/50 rounded-2xl text-[16px] font-bold shadow-sm outline-none transition-all placeholder:text-slate-300"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {loading && (
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-emerald-500">
                                <Loader2 size={20} />
                            </div>
                        )}

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-[110%] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[90] overflow-hidden p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchResults.map(it => (
                                    <button 
                                        key={it.id} 
                                        onClick={() => selectItem(it)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-emerald-50/50 group transition-all text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400 group-hover:text-emerald-600 overflow-hidden shadow-sm">
                                                {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : it.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-[14px] font-bold text-slate-800">{it.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">#{it.id}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[14px] font-black text-emerald-600">AED {it.price?.toFixed(2)}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Sale Rate</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* QUEUE TABLE */}
                    <div className="bg-white rounded-3xl border border-slate-200 relative overflow-hidden shadow-sm">
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Processing Queue ({itemsToSubmit.length})</h3>
                            {itemsToSubmit.length > 0 && (
                                <button onClick={() => setItemsToSubmit([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest">Clear All</button>
                            )}
                        </div>
                        
                        <div className="overflow-x-auto min-h-[500px]">
                            <table className="w-full border-collapse">
                                <thead className="bg-[#0f172a]">
                                    <tr>
                                        <th className="px-8 py-4 text-[9px] font-bold text-white/40 uppercase tracking-widest text-left">Product</th>
                                        <th className="px-4 py-4 text-[9px] font-bold text-white/40 uppercase tracking-widest text-center">Batch Details</th>
                                        <th className="px-4 py-4 text-[9px] font-bold text-white/40 uppercase tracking-widest text-right">Unit Net</th>
                                        <th className="px-4 py-4 text-[9px] font-bold text-white/40 uppercase tracking-widest text-right">Selling</th>
                                        <th className="px-4 py-4 text-[9px] font-bold text-white/40 uppercase tracking-widest text-right">Total</th>
                                        <th className="w-[80px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {itemsToSubmit.length > 0 ? (
                                        itemsToSubmit.map((it, idx) => (
                                            <tr key={idx} className="group hover:bg-emerald-50/30 transition-all">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-300 overflow-hidden">
                                                            {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : it.item_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-[13px] font-bold text-slate-800">{it.item_name}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Code: {it.item_code}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className="text-[13px] font-black text-slate-900">{it.box_qty} <small className="text-[9px] opacity-40">BOX</small></span>
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">{it.qty} PCS Total</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5 text-right">
                                                    <span className="text-[13px] font-bold text-slate-600 tabular-nums">{(it.purchase_price / it.pcs_per_box).toFixed(2)}</span>
                                                </td>
                                                <td className="px-4 py-5 text-right">
                                                    <span className="text-[13px] font-black text-emerald-600 tabular-nums">{it.new_selling_price.toFixed(2)}</span>
                                                </td>
                                                <td className="px-4 py-5 text-right">
                                                    <span className="text-[14px] font-black text-slate-900 tabular-nums">{(it.box_qty * it.purchase_price).toFixed(2)}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button onClick={() => setItemsToSubmit(prev => prev.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="py-24 text-center">
                                                <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                                    <ShoppingCart size={40} />
                                                </div>
                                                <h4 className="text-base font-bold text-slate-800">No items captured</h4>
                                                <p className="text-xs text-slate-400 mt-2">Scan a barcode or search to start filling the batch.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: SELECTED ITEM MODIFIER */}
                <div className="lg:col-span-4">
                    <div className="bg-[#0f172a] rounded-[32px] p-8 text-white shadow-2xl sticky top-24">
                        {selectedItem ? (
                            <form onSubmit={addToStaging} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex gap-6 items-start">
                                    <div className="w-20 h-20 bg-white/10 rounded-[22px] flex items-center justify-center font-bold text-emerald-400 text-2xl border border-white/10 overflow-hidden ring-4 ring-emerald-500/10 shrink-0">
                                        {selectedItem.image ? <img src={selectedItem.image} alt="" className="w-full h-full object-cover" /> : selectedItem.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h2 className="text-xl font-black text-white leading-tight uppercase tracking-tight truncate">{selectedItem.name}</h2>
                                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-2 bg-emerald-500/10 px-3 py-1 rounded-full inline-block">CODE: {selectedItem.id}</div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Stock in Boxes</label>
                                            <input type="number" value={form.box_qty || ''} onChange={(e) => setForm({...form, box_qty: parseFloat(e.target.value) || 0})} onFocus={(e) => e.target.select()} className="bg-transparent border-none p-0 text-3xl font-black text-white outline-none w-full" autoFocus />
                                        </div>
                                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">Packing (Nos)</label>
                                            <input type="number" value={form.pcs_per_box || ''} onChange={(e) => setForm({...form, pcs_per_box: parseFloat(e.target.value) || 1})} className="bg-transparent border-none p-0 text-3xl font-black text-white/50 outline-none w-full" />
                                        </div>
                                    </div>

                                    <div className="bg-emerald-600/20 border border-emerald-500/20 p-6 rounded-2xl relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 block">Buying Rate (per Box)</label>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-bold text-emerald-400/50">AED</span>
                                                <input type="number" step="0.01" value={form.purchase_price || ''} onChange={(e) => setForm({...form, purchase_price: parseFloat(e.target.value) || 0})} onFocus={(e) => e.target.select()} className="bg-transparent border-none p-0 text-3xl font-black text-emerald-400 outline-none w-full tabular-nums" />
                                            </div>
                                        </div>
                                        <TrendingUp className="absolute right-[-20px] bottom-[-20px] w-24 h-24 text-emerald-500/10 -rotate-12 transition-all group-hover:rotate-0" />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex bg-white/5 p-1 rounded-xl">
                                            <button type="button" onClick={() => setForm({...form, price_type: 'Percentage'})} className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all rounded-lg ${form.price_type === 'Percentage' ? 'bg-white text-[#0f172a]' : 'text-white/40'}`}>Markup %</button>
                                            <button type="button" onClick={() => setForm({...form, price_type: 'Amount'})} className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all rounded-lg ${form.price_type === 'Amount' ? 'bg-white text-[#0f172a]' : 'text-white/40'}`}>Amount AED</button>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                            <label className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-2 block">{form.price_type === 'Percentage' ? 'Margin Percentage' : 'Target Sale Rate'}</label>
                                            <input type="number" step="0.01" value={form.value || ''} onChange={(e) => setForm({...form, value: parseFloat(e.target.value) || 0})} className="bg-transparent border-none p-0 text-4xl font-black text-white outline-none w-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <span className="text-[10px] font-bold text-white/40 uppercase">Projected Net Sale</span>
                                        <span className="text-2xl font-black text-emerald-400 tabular-nums">AED {calculateLiveTarget().toFixed(2)}</span>
                                    </div>
                                    <button type="submit" className="w-full h-16 bg-white text-[#0f172a] hover:bg-emerald-400 hover:text-white rounded-[22px] font-black text-sm uppercase tracking-widest shadow-xl shadow-white/5 active:scale-95 transition-all flex items-center justify-center gap-3 group">
                                        Add To Batch <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                                <div className="relative">
                                    <div className="w-24 h-24 border-4 border-dashed border-white/20 rounded-full animate-spin-slow"></div>
                                    <Scan className="absolute inset-0 m-auto w-10 h-10 text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold">Waiting for Scan</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest leading-loose">The selection matrix is ready.<br/>Please pick an item to edit.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                
                body { 
                    font-family: 'Outfit', sans-serif !important;
                    background-color: #f8fafc !important;
                }
                
                header {
                    background: rgba(255, 255, 255, 0.8) !important;
                    backdrop-filter: blur(20px);
                }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 12s linear infinite;
                }

                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}} />
        </div>
    );
};

export default QuickStockInStandalone;
