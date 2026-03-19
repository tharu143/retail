import React, { useState, useEffect, useRef } from 'react';
import {
    Package, Save, X, Trash2, Search, Scan, Palette, Loader2,
    ArrowRight, Warehouse, User, FileText, ShoppingCart, Box, TrendingUp,
    Filter, RefreshCw, ChevronDown
} from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';

const QuickStockInStandalone = () => {
    // Basic States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [itemsToSubmit, setItemsToSubmit] = useState([]);
    const [showResults, setShowResults] = useState(false);

    // Batch Details
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [taxTemplates, setTaxTemplates] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [selectedTaxTemplate, setSelectedTaxTemplate] = useState('');

    // Form for Selected Item
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

    const searchRef = useRef(null);

    // Theme Support
    const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = polTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeHeaderBg = isGreen ? '#f2fdf9' : '#eff6ff';
    const themeHeaderText = isGreen ? '#0d9488' : '#1d4ed8';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', polTheme);
    }, [polTheme]);

    // Initial Data Fetch
    useEffect(() => {
        const loadInitData = async () => {
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
                if (safeSup.length > 0) setSelectedSupplier(safeSup[0].name);
            } catch (err) { }
        };
        loadInitData();
        setTimeout(() => searchRef.current?.focus(), 100);
    }, []);

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (!val || val.trim().length === 0) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setLoading(true);
        try {
            const query = val.toLowerCase();
            let results = await db.items
                .filter(it =>
                    (it.name || '').toLowerCase().includes(query) ||
                    (it.item_code || '').toLowerCase().includes(query) ||
                    (it.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(query))
                )
                .limit(10)
                .toArray();

            if (results.length < 5 && val.length >= 3) {
                try {
                    const online = await POSService.getRetailItems({ search_term: val });
                    if (Array.isArray(online)) {
                        const formatted = online.map(it => ({
                            ...it,
                            id: it.item_code || it.name,
                            name: it.item_name || it.name
                        }));
                        const existingIds = new Set(results.map(f => f.id));
                        formatted.forEach(f => { if (!existingIds.has(f.id)) results.push(f); });
                    }
                } catch (e) { }
            }

            if (results.length === 0 && val.length >= 4) {
                try {
                    const global = await POSService.findItemGlobal(val);
                    if (global && global.item_code) {
                        results.push({
                            ...global,
                            id: global.item_code,
                            name: global.item_name || global.name,
                            price: global.custom_selling_price || 0,
                            is_global: true,
                            custom_pcs_per_box: global.pcs_per_box || 1,
                            last_price: global.last_purchase_rate || 0
                        });
                    }
                } catch (e) { }
            }

            setSearchResults(results);
            setShowResults(results.length > 0);

            if (results.length === 1 && val === results[0].id) {
                selectItem(results[0]);
            }
        } finally {
            setLoading(false);
        }
    };

    const selectItem = async (item) => {
        setSelectedItem(item);
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);

        const pcs = item.custom_pcs_per_box || item.pcs_per_box || 1;
        const lastRate = item.last_price || 0;

        setForm(prev => ({
            ...prev,
            box_qty: 1,
            pcs_per_box: pcs,
            purchase_price: lastRate ? (lastRate * pcs) : 0,
            value: item.price || 0,
            price_type: item.price > 0 ? 'Amount' : 'Percentage'
        }));

        if (!item.is_global) {
            try {
                const history = await POSService.getItemPricingHistory(item.id);
                if (history?.[item.id]?.[0]) {
                    setForm(prev => ({ ...prev, purchase_price: history[item.id][0].rate * pcs }));
                }
            } catch (err) { }
        }
    };

    const calculateLivePrice = () => {
        const unitBuy = (form.purchase_price / (form.pcs_per_box || 1));
        if (form.price_type === 'Percentage') return unitBuy * (1 + (form.value / 100));
        return form.value;
    };

    const addToQueue = (e) => {
        if (e) e.preventDefault();
        if (!selectedItem) return;

        const liveSale = calculateLivePrice();
        const newItem = {
            item_code: selectedItem.id,
            item_name: selectedItem.name,
            box_qty: form.box_qty,
            pcs_per_box: form.pcs_per_box,
            purchase_price: form.purchase_price,
            price_type: form.price_type,
            new_selling_price: form.price_type === 'Amount' ? form.value : Math.round((liveSale + Number.EPSILON) * 100) / 100,
            margin_percent: form.price_type === 'Percentage' ? form.value : 0,
            image: selectedItem.image,
            qty: form.box_qty * form.pcs_per_box
        };

        setItemsToSubmit(prev => [...prev, newItem]);
        setSelectedItem(null);
        setForm(prev => ({ ...prev, box_qty: 1, purchase_price: 0, value: 0 }));
        searchRef.current?.focus();
    };

    const handleCommit = async () => {
        if (itemsToSubmit.length === 0) return Swal.fire('Error', 'Queue is empty', 'warning');
        if (form.entry_type === 'Purchase' && !selectedSupplier) return Swal.fire('Error', 'Select Supplier', 'warning');

        setSubmitting(true);
        try {
            const payload = {
                items: itemsToSubmit,
                warehouse: selectedWarehouse,
                supplier_sl_no: form.supplier_sl_no,
                supplier: form.entry_type === 'Transfer' ? form.from_warehouse : selectedSupplier,
                entry_type: form.entry_type,
                tax_template: selectedTaxTemplate
            };
            const res = await POSService.submitPurchaseEntry(payload);
            if (res) {
                Swal.fire({
                    icon: 'success',
                    title: 'Stock Updated',
                    text: 'Batch successfully committed',
                    timer: 1500,
                    showConfirmButton: false
                });
                setItemsToSubmit([]);
                setForm(prev => ({ ...prev, supplier_sl_no: '' }));
            }
        } catch (err) {
            Swal.fire('Error', err.message || 'Post failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {/* 1. COMPACT PAGE HEADER */}
            <header className="px-6 py-4 flex items-center justify-between shrink-0 bg-white border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-black text-slate-900">Quick Stock-In</h1>
                    <span className="h-4 w-[1px] bg-slate-200"></span>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{itemsToSubmit.length} record(s) in queue</p>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setPolTheme(isGreen ? 'blue' : 'green')} className="px-3 py-1.5 border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-emerald-500 transition-all">Theme: {polTheme.toUpperCase()}</button>
                    <button onClick={handleCommit} disabled={submitting || itemsToSubmit.length === 0} className="px-6 py-1.5 bg-[#10b981] text-white rounded-lg text-[11px] font-black uppercase shadow-lg shadow-emerald-200 hover:brightness-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 transition-all">
                        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Commit Batch
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
                {/* 2. COMPACT SEARCH & CONFIGURATION ROW */}
                <div className="flex items-end gap-3 shrink-0">
                    <div className="flex-1 flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Search or Scan Product</label>
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={16} />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search products..."
                                className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:border-emerald-500 transition-all shadow-sm"
                                value={searchQuery}
                                onFocus={() => searchQuery.length > 0 && setShowResults(true)}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                            {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-500" size={16} />}

                            {showResults && (
                                <div className="absolute top-[105%] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-[50] overflow-hidden p-1">
                                    {searchResults.map(it => (
                                        <div key={it.id} onClick={() => selectItem(it)} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer group transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg border border-slate-100 bg-white flex items-center justify-center overflow-hidden">
                                                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-slate-200" />}
                                                </div>
                                                <div>
                                                    <div className="text-[12px] font-black text-slate-800">{it.name}</div>
                                                    <div className="text-[9px] text-slate-400 font-mono tracking-tighter">{it.id}</div>
                                                </div>
                                            </div>
                                            <div className="text-[12px] font-black text-emerald-500">AED {it.price?.toFixed(2)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Mode</label>
                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 h-[38px] items-center">
                            <button onClick={() => setForm({ ...form, entry_type: 'Purchase' })} className={`px-4 py-1 rounded-md text-[9px] font-black uppercase transition-all ${form.entry_type === 'Purchase' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>Purchase</button>
                            <button onClick={() => setForm({ ...form, entry_type: 'Transfer' })} className={`px-4 py-1 rounded-md text-[9px] font-black uppercase transition-all ${form.entry_type === 'Transfer' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>Transfer</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Branch</label>
                        <div className="flex items-center px-3 bg-white border border-slate-200 rounded-lg h-[38px] shadow-sm min-w-[130px]">
                            <Warehouse size={12} className="text-emerald-500 mr-2" />
                            <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="text-[11px] font-black text-slate-700 outline-none bg-transparent flex-1 cursor-pointer appearance-none">
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                            </select>
                            <ChevronDown size={12} className="text-slate-300 ml-1" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{form.entry_type === 'Purchase' ? 'Supplier' : 'Source'}</label>
                        <div className="flex items-center px-3 bg-white border border-slate-200 rounded-lg h-[38px] shadow-sm min-w-[150px]">
                            <User size={12} className="text-slate-400 mr-2" />
                            {form.entry_type === 'Purchase' ? (
                                <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="text-[11px] font-black text-slate-700 outline-none bg-transparent flex-1 cursor-pointer appearance-none">
                                    <option value="">Select Vendor...</option>
                                    {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>)}
                                </select>
                            ) : (
                                <select value={form.from_warehouse} onChange={(e) => setForm({ ...form, from_warehouse: e.target.value })} className="text-[11px] font-black text-slate-700 outline-none bg-transparent flex-1 cursor-pointer appearance-none">
                                    <option value="">Select Warehouse...</option>
                                    {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                </select>
                            )}
                            <ChevronDown size={12} className="text-slate-300 ml-1" />
                        </div>
                    </div>

                    <button onClick={() => { setSearchQuery(''); setSelectedItem(null); setItemsToSubmit([]); }} className="h-[38px] px-4 border border-slate-200 text-slate-400 text-[10px] font-black uppercase hover:bg-slate-50 transition-all rounded-lg">Reset</button>
                </div>

                {/* 3. MAIN CONTENT GRID (TIGHTENED) */}
                <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                    {/* QUEUE TABLE AREA */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between shrink-0">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Processing Queue</span>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-500 text-white rounded-full">{itemsToSubmit.length} Units</span>
                        </div>

                        <div className="flex-1 overflow-auto scrollbar-thin">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-20">
                                    <tr style={{ background: themeHeaderBg }}>
                                        <th className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest" style={{ color: themeHeaderText }}>Product Details</th>
                                        <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest" style={{ color: themeHeaderText }}>Inventory</th>
                                        <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest" style={{ color: themeHeaderText }}>Unit Cost</th>
                                        <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest" style={{ color: themeHeaderText }}>Sale Price</th>
                                        <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-widest" style={{ color: themeHeaderText }}>Sub-Total</th>
                                        <th className="px-6 py-3 w-10" style={{ color: themeHeaderText }}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {itemsToSubmit.map((it, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 group transition-all text-xs">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                        {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : <Package size={14} className="text-slate-200" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-slate-800 uppercase leading-none">{it.item_name}</div>
                                                        <div className="text-[8px] text-slate-300 font-mono mt-1 leading-none">{it.item_code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="font-black text-slate-800 leading-none">{it.qty} UNIT</div>
                                                <div className="text-[9px] text-slate-300 font-bold mt-1 leading-none">{it.box_qty} BX</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-slate-400 tabular-nums font-mono">{(it.purchase_price / it.pcs_per_box).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-black text-emerald-600 tabular-nums font-mono">{it.new_selling_price.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right font-black text-slate-900 tabular-nums font-mono font-mono leading-none">{(it.box_qty * it.purchase_price).toFixed(2)}</td>
                                            <td className="px-6 py-3 text-center">
                                                <button onClick={() => setItemsToSubmit(prev => prev.filter((_, i) => i !== idx))} className="text-slate-200 hover:text-red-500 transition-all"><X size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {itemsToSubmit.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-32 text-center text-slate-200">
                                                <ShoppingCart size={32} className="mx-auto mb-4 opacity-10" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Batch Empty</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* COMPACT MODIFIER AREA (SPACE REMOVED) */}
                    <div className="w-[340px] flex flex-col shrink-0 gap-4 overflow-hidden">
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2 shrink-0">
                                <Filter size={12} className="text-slate-400" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entry Detail</span>
                            </div>

                            <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
                                {selectedItem ? (
                                    <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
                                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4 shrink-0">
                                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                {selectedItem.image ? <img src={selectedItem.image} alt="" className="w-full h-full object-cover" /> : <Package size={20} className="text-slate-200" />}
                                            </div>
                                            <div className="flex-1 min-w-0 pr-6 relative">
                                                <div className="text-[12px] font-black text-slate-900 leading-tight uppercase truncate">{selectedItem.name}</div>
                                                <div className="text-[9px] text-slate-400 font-mono tracking-tighter mt-1">ID: {selectedItem.id}</div>
                                                <button onClick={() => setSelectedItem(null)} className="absolute -top-1 right-0 text-slate-200 hover:text-red-400 transition-all"><X size={14} /></button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 shrink-0">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-1">Intake</label>
                                                <div className="relative">
                                                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-[13px] font-black text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all font-mono" value={form.box_qty} onChange={e => setForm({ ...form, box_qty: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} autoFocus />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">BX</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest pl-1">Packing</label>
                                                <div className="relative">
                                                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-[13px] font-black text-slate-300 outline-none font-mono" value={form.pcs_per_box} readOnly />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-200 opacity-20">PCS</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1 shrink-0">
                                            <label className="text-[8px] font-black uppercase text-emerald-500 tracking-widest pl-1">Buying Rate (Box)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">AED</span>
                                                <input type="number" className="w-full bg-emerald-50/30 border border-emerald-500/20 rounded-lg py-2.5 pl-10 pr-3 text-lg font-black text-emerald-600 outline-none focus:bg-white focus:border-emerald-500 transition-all font-mono" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} />
                                            </div>
                                        </div>

                                        <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-200 flex flex-col gap-3 min-h-0">
                                            <div className="flex bg-slate-200/40 p-1 rounded-lg shrink-0">
                                                <button onClick={() => setForm({ ...form, price_type: 'Percentage' })} className={`flex-1 py-1 text-[8px] font-black uppercase rounded transition-all ${form.price_type === 'Percentage' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Markup %</button>
                                                <button onClick={() => setForm({ ...form, price_type: 'Amount' })} className={`flex-1 py-1 text-[8px] font-black uppercase rounded transition-all ${form.price_type === 'Amount' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Sale AED</button>
                                            </div>

                                            <div className="flex-1 flex items-center justify-center min-h-0">
                                                <input type="number" className="w-full bg-transparent border-none text-[2.5rem] font-black text-slate-900 text-center outline-none p-0 focus:ring-0 tracking-tighter" value={form.value} onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} onFocus={e => e.target.select()} />
                                                {form.price_type === 'Percentage' && <span className="text-xl font-black text-slate-200 ml-1">%</span>}
                                            </div>

                                            <div className="pt-2 border-t border-slate-200/50 flex justify-between items-end shrink-0">
                                                <div>
                                                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Final Unit Price</span>
                                                    <div className="text-xl font-black text-emerald-600 leading-none">
                                                        <small className="text-[10px] mr-0.5 opacity-40 font-bold">AED</small>
                                                        {calculateLivePrice().toFixed(2)}
                                                    </div>
                                                </div>
                                                <TrendingUp size={20} className="text-emerald-500 opacity-10" />
                                            </div>
                                        </div>

                                        <button onClick={addToQueue} className="w-full h-10 rounded-lg bg-[#10b981] font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-white shrink-0">
                                            PUSH TO BATCH <ArrowRight size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-20">
                                        <Box size={32} className="text-slate-300 mb-4" />
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Select Product</h3>
                                        <p className="text-[9px] text-slate-400 mt-2 font-medium">Capture details here</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                body { margin: 0; padding: 0; background: #f8fafc !important; }
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                .scrollbar-none::-webkit-scrollbar { display: none; }
                .scrollbar-thin::-webkit-scrollbar { width: 3px; height: 3px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
            `}} />
        </div>
    );
};

export default QuickStockInStandalone;
