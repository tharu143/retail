import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Save, X, Box, ShoppingCart, DollarSign, Loader2, Warehouse, History, ArrowRight, TrendingUp, Layout, User, Hash, CheckCircle2, FileText, Receipt, Truck, SearchSlash, AlertCircle, ArrowUpRight, BarChart3, Layers, Zap, RefreshCw, ChevronRight, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';

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
        entry_type: 'Purchase'
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

            // Default Tax Template to 5% VAT if it exists
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
            
            // 1. IMPROVED Local Search: Direct filter on the collection
            let filtered = await db.items
                .filter(it => 
                    (it.name || '').toLowerCase().includes(query) ||
                    (it.id || '').toLowerCase().includes(query) ||
                    (it.item_code || '').toLowerCase().includes(query) ||
                    (it.description || '').toLowerCase().includes(query) ||
                    (it.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(query))
                )
                .limit(20)
                .toArray();

            // 2. Online Search Fallback
            if (filtered.length < 5 && val.length >= 2) {
                try {
                    const onlineResults = await POSService.getRetailItems({ 
                        search_term: val,
                        search: val
                    });
                    
                    if (Array.isArray(onlineResults)) {
                        const formatted = onlineResults.map(it => ({
                            ...it,
                            id: it.item_code || it.name,
                            name: it.item_name || it.name,
                            actual_qty: it.actual_qty || 0
                        }));
                        
                        // Merge results avoiding duplicates
                        const existingIds = new Set(filtered.map(f => f.id));
                        formatted.forEach(f => {
                            if (!existingIds.has(f.id) && filtered.length < 15) {
                                filtered.push(f);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Global live search fallback failed:', e);
                }
            }

            // 3. GLOBAL DISCOVERY FALLBACK: If standard searches fail, audit all branches/history
            if (filtered.length === 0 && val.length >= 4) {
                try {
                    const globalItem = await POSService.findItemGlobal(val);
                    if (globalItem && globalItem.item_code) {
                        filtered.push({
                            ...globalItem,
                            id: globalItem.item_code,
                            name: globalItem.item_name || globalItem.name,
                            price: globalItem.custom_selling_price || 0,
                            actual_qty: 0, // It's new to this warehouse
                            is_global_match: true,
                            custom_pieces_per_box: globalItem.pcs_per_box || 1,
                            last_purchase_price: globalItem.last_purchase_rate || 0
                        });
                    }
                } catch (e) {
                    console.warn('Global discovery failed:', e);
                }
            }

            setSearchResults(filtered);
        } catch (err) {
            console.error('Advanced search failure:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectItem = async (item) => {
        setSelectedItem(item);
        setSearchResults([]);
        setSearchQuery('');
        
        // Auto-populate based on item data (including global matches)
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

        // Fetch deep history only if it's not already pre-populated from global search
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
            } catch (err) {
                console.error('History fetch failed', err);
            }
        } else {
            // Display global info as pseudo-history
            setItemHistory({
                rate: lastRate,
                supplier: 'GLOBAL RECORD',
                posting_date: 'PREVIOUS'
            });
        }
    };

    const calculateLiveTarget = () => {
        const buyingPerPiece = (form.purchase_price / (form.pcs_per_box || 1));
        if (form.price_type === 'Percentage') {
            return buyingPerPiece * (1 + (form.value / 100));
        }
        return form.value;
    };

    const calculateValuation = () => {
        return (form.purchase_price || 0) / (form.pcs_per_box || 1);
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
            valuation_rate: calculateValuation()
        };

        setItemsToSubmit(prev => [...prev, newItem]);
        setSelectedItem(null);
        setSearchQuery("");
        setForm(prev => ({
            ...prev,
            box_qty: 1,
            purchase_price: 0,
            value: 0
        }));
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            background: '#0f172a',
            color: '#fff'
        });
        Toast.fire({ icon: 'success', title: 'Item added to staging list' });
    };

    const removeFromStaging = (index) => {
        setItemsToSubmit(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        // Include currently open item if it hasn't been added yet
        let finalItems = [...itemsToSubmit];
        if (selectedItem) {
            const livePrice = calculateLiveTarget();
            finalItems.push({
                item_code: selectedItem.id,
                item_name: selectedItem.name,
                box_qty: form.box_qty,
                pcs_per_box: form.pcs_per_box,
                purchase_price: form.purchase_price,
                price_type: form.price_type,
                new_selling_price: form.price_type === 'Amount' ? form.value : round2(livePrice),
                margin_percent: form.price_type === 'Percentage' ? form.value : 0,
                valuation_rate: calculateValuation(),
                qty: (form.box_qty || 0) * (form.pcs_per_box || 1)
            });
        }

        if (finalItems.length === 0) {
            Swal.fire({ 
                title: 'Staging Empty', 
                text: 'Search and add at least one item to current batch before posting.', 
                icon: 'warning', 
                confirmButtonColor: '#0f172a' 
            });
            return;
        }



        if (form.entry_type === 'Purchase' && !selectedSupplier) {
            Swal.fire({ title: 'Missing Supplier', text: 'Supplier is required for Direct Purchase.', icon: 'warning', confirmButtonColor: '#0f172a' });
            return;
        }

        if (form.entry_type === 'Transfer' && !form.from_warehouse) {
            Swal.fire({ title: 'Missing Source', text: 'Sending branch is required for Transfers.', icon: 'warning', confirmButtonColor: '#0f172a' });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                items: finalItems,
                warehouse: selectedWarehouse || "Main - LINC",
                supplier_sl_no: form.supplier_sl_no || "",
                // In Transfer mode, 'supplier' field often represents the source branch name in the backend logic
                supplier: form.entry_type === 'Transfer' ? form.from_warehouse : selectedSupplier,
                from_warehouse: form.from_warehouse || "",
                entry_type: form.entry_type || "Purchase",
                tax_template: selectedTaxTemplate
            };

            const res = await POSService.submitPurchaseEntry(payload);
            
            // Handle multiple document IDs in response (e.g., PO, PR, PI)
            if (res) {
                // Collect all possible document identifiers returned
                const docLinks = [];
                if (res.name) docLinks.push(`Doc: ${res.name}`);
                if (res.purchase_order) docLinks.push(`PO: ${res.purchase_order}`);
                if (res.purchase_receipt) docLinks.push(`PR: ${res.purchase_receipt}`);
                if (res.purchase_invoice) docLinks.push(`PI: ${res.purchase_invoice}`);
                if (res.stock_entry) docLinks.push(`Transfer: ${res.stock_entry}`);
                
                // Fallback: If the above specific keys aren't found, try to find any string values
                if (docLinks.length === 0) {
                    Object.entries(res).forEach(([key, val]) => {
                        if (typeof val === 'string' && val.length > 3 && !['message', 'status'].includes(key)) {
                            docLinks.push(`${key.replace('_', ' ').toUpperCase()}: ${val}`);
                        }
                    });
                }

                // Optimistic Local DB Update
                for (const it of finalItems) {
                    const localItem = await db.items.get(it.item_code);
                    if (localItem) {
                        const totalPieces = it.qty;
                        const updatedWD = (localItem.warehouse_details || []).map(wd => {
                            if (wd.warehouse === selectedWarehouse || wd.warehouse_name === selectedWarehouse) {
                                return { ...wd, actual_qty: (wd.actual_qty || 0) + totalPieces };
                            }
                            return wd;
                        });

                        await db.items.update(it.item_code, {
                            price: it.new_selling_price,
                            actual_qty: (localItem.actual_qty || 0) + totalPieces,
                            warehouse_details: updatedWD
                        });
                    }
                }

                Swal.fire({
                    title: 'Batch Posted!',
                    html: `
                        <div class="text-left space-y-3">
                            <p class="text-sm font-medium text-slate-600">Inventory updated successfully. Generated Documents:</p>
                            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                                ${docLinks.map(link => `
                                    <div class="flex items-center gap-2 text-xs font-bold text-sky-600 font-mono">
                                        <div class="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
                                        ${link}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonColor: '#0f172a'
                });

                setItemsToSubmit([]);
                setSelectedItem(null);
                setSearchQuery("");
                setForm(prev => ({
                    ...prev,
                    box_qty: 1,
                    pcs_per_box: 1,
                    purchase_price: 0,
                    value: 0,
                    supplier_sl_no: ''
                }));
            }
        } catch (err) {
            Swal.fire({
                title: 'Submission Failed',
                text: err.message || 'Error communicating with server',
                icon: 'error',
                confirmButtonColor: '#0f172a'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6 font-sans selection:bg-sky-100 text-slate-900">
            <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                {/* UNIFIED RAPID STOCK-IN HEADER */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 relative">
                    {/* Top Layer: Mode & Search */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center mb-4">
                        <div className="lg:col-span-3 flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                            <button 
                                onClick={() => setForm({...form, entry_type: 'Purchase'})}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${form.entry_type === 'Purchase' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                            >
                                <ShoppingCart size={14} /> Purchase
                            </button>
                            <button 
                                onClick={() => setForm({...form, entry_type: 'Transfer'})}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${form.entry_type === 'Transfer' ? 'bg-[#0f172a] text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                            >
                                <RefreshCw size={14} /> Transfer
                            </button>
                        </div>
                        
                        <div className="lg:col-span-9 relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-500">
                                <Search size={18} strokeWidth={2.5} />
                            </div>
                            <input 
                                ref={searchRef}
                                type="text" 
                                placeholder="Scan Barcode or Search Inventory..." 
                                className="w-full pl-14 pr-32 py-3.5 bg-slate-50 border border-slate-200 focus:border-sky-500/50 focus:bg-white rounded-xl text-sm font-semibold placeholder:text-slate-400 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                            {loading && (
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-sky-500">
                                    <Loader2 size={16} strokeWidth={2.5} />
                                </div>
                            )}

                            {/* Refined Search Overlay */}
                            {((searchResults && searchResults.length > 0) || (searchQuery.length > 2 && !loading)) && (
                                <div className="absolute top-[110%] left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-200 z-[100] p-2 max-h-[350px] overflow-y-auto custom-scrollbar-light">
                                    {searchResults && searchResults.length > 0 ? (
                                        searchResults.map(it => (
                                            <button 
                                                key={it.id} 
                                                onClick={() => selectItem(it)}
                                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-all group/it"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-400 group-hover/it:text-sky-500 overflow-hidden">
                                                        {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : it.name.charAt(0)}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-xs font-bold text-slate-900 group-hover/it:text-sky-600 truncate max-w-[250px]">{it.name}</div>
                                                        <div className="text-[9px] font-semibold text-slate-400 tracking-wider">#{it.id}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[12px] font-bold text-emerald-600">AED {it.price?.toFixed(2)}</div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center opacity-40">
                                            <SearchSlash size={32} className="mx-auto mb-2" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">No matching items</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Layer: Source & Reference */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-3 border border-slate-100 transition-all group/src">
                            <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-sky-500">
                                {form.entry_type === 'Purchase' ? <Users size={18} /> : <Warehouse size={18} />}
                            </div>
                            <div className="flex-1">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                    {form.entry_type === 'Purchase' ? 'SUPPLIER ORIGIN' : 'SOURCE'}
                                </label>
                                {form.entry_type === 'Purchase' ? (
                                    <select 
                                        value={selectedSupplier}
                                        onChange={(e) => setSelectedSupplier(e.target.value)}
                                        className="w-full bg-transparent border-none text-[13px] font-bold text-slate-900 outline-none cursor-pointer"
                                    >
                                        <option value="">Select Supplier...</option>
                                        {suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>)}
                                    </select>
                                ) : (
                                    <select 
                                        value={form.from_warehouse}
                                        onChange={(e) => setForm({...form, from_warehouse: e.target.value})}
                                        className="w-full bg-transparent border-none text-[13px] font-bold text-slate-900 outline-none cursor-pointer"
                                    >
                                        <option value="">Select Sending Branch...</option>
                                        {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-white rounded-xl p-3 border border-slate-200 transition-all group/ref">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                <FileText size={18} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">REFERENCE / INVOICE NO</label>
                                <input 
                                    type="text"
                                    value={form.supplier_sl_no || ''}
                                    onChange={(e) => setForm({...form, supplier_sl_no: e.target.value})}
                                    placeholder="Enter Document Num..."
                                    className="w-full bg-transparent border-none text-[13px] font-bold text-slate-900 outline-none placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* UNIFIED RAPID STOCK-IN DASHBOARD */}
                <div className="flex flex-col gap-8">
                    
                    {/* Part 1: Selected Item Workspace / Entry Form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden flex flex-col">
                        {selectedItem ? (
                            <form onSubmit={addToStaging} className="flex-1 flex flex-col relative z-20 animate-in fade-in duration-300">
                                {/* Compact Item Header */}
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-14 h-14 bg-white shadow-sm rounded-lg flex items-center justify-center text-xl font-bold text-sky-500 border border-slate-200 overflow-hidden">
                                            {selectedItem.image ? <img src={selectedItem.image} alt="" className="w-full h-full object-cover" /> : selectedItem.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase leading-tight">{selectedItem.name}</h1>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[9px] font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded uppercase tracking-wider">{selectedItem.id}</span>
                                                <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                                                    <Layers size={10} strokeWidth={2.5} />
                                                    {selectedItem.group || 'General'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right px-6 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">CURRENT SALE</div>
                                        <div className="text-2xl font-black text-emerald-600 tabular-nums">
                                            <small className="text-[10px] mr-1 font-bold">AED</small>{(selectedItem.price || 0).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Branch Stock</label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar-light">
                                            {warehouses.map((wh, idx) => {
                                                const wd = (selectedItem.warehouse_details || []).find(d => d.warehouse === wh.name || d.warehouse_name === wh.name);
                                                const qty = wd ? wd.actual_qty : 0;
                                                const active = selectedWarehouse === wh.name;
                                                return (
                                                    <button key={idx} type="button" onClick={() => setSelectedWarehouse(wh.name)} className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${active ? 'bg-sky-50 border-sky-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                        <span className={`text-[8px] font-bold uppercase truncate ${active ? 'text-sky-600' : 'text-slate-400'}`}>{wh.warehouse_name || wh.name}</span>
                                                        <span className={`text-lg font-bold mt-1 ${active ? 'text-sky-700' : 'text-slate-900'}`}>{qty} <small className="text-[10px] opacity-40">PCS</small></span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-2">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Tax template</label>
                                            <select value={selectedTaxTemplate} onChange={(e) => setSelectedTaxTemplate(e.target.value)} className="w-full bg-slate-50 rounded-xl p-3 text-sm font-bold text-slate-900 border border-slate-200 focus:border-sky-500 outline-none transition-all cursor-pointer">
                                                <option value="">No Tax / Exempt</option>
                                                {taxTemplates.map(t => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Boxes</label>
                                                <input type="number" value={form.box_qty || ''} onChange={(e) => setForm({...form, box_qty: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 rounded-xl p-3 text-xl font-bold text-slate-900 outline-none border border-slate-200 focus:border-sky-500" placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Pcs/Box</label>
                                                <input type="number" value={form.pcs_per_box || ''} onChange={(e) => setForm({...form, pcs_per_box: parseFloat(e.target.value) || 1})} className="w-full bg-slate-100/50 rounded-xl p-3 text-xl font-bold text-slate-500 outline-none border-none" placeholder="1" />
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Purchase Price (per Box)</label>
                                            <div className="relative">
                                                <input type="number" step="0.01" value={form.purchase_price || ''} onChange={(e) => setForm({...form, purchase_price: parseFloat(e.target.value) || 0})} className="w-full bg-emerald-50 rounded-xl p-3 text-xl font-bold text-emerald-900 outline-none border border-emerald-200 focus:border-emerald-500" placeholder="0.00" />
                                                <small className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-300">AED</small>
                                            </div>
                                        </div>

                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 mt-4">
                                            <button type="button" onClick={() => setForm({...form, price_type: 'Percentage'})} className={`flex-1 py-2 px-2 rounded-lg text-[9px] font-bold uppercase transition-all ${form.price_type === 'Percentage' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-500'}`}>Markup %</button>
                                            <button type="button" onClick={() => setForm({...form, price_type: 'Amount'})} className={`flex-1 py-2 px-2 rounded-lg text-[9px] font-bold uppercase transition-all ${form.price_type === 'Amount' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-500'}`}>Amount AED</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#0f172a] rounded-2xl p-6 text-white shadow-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{form.price_type === 'Percentage' ? 'Set Target Markup (%)' : 'Set New Net Selling Price'}</span>
                                        <div className="text-sky-400 font-bold tabular-nums text-lg">{calculateLiveTarget().toFixed(2)} AED</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <input type="number" step="0.01" value={form.value || ''} onChange={(e) => setForm({...form, value: parseFloat(e.target.value) || 0})} className="flex-1 bg-white/10 border border-white/10 outline-none rounded-xl p-4 text-2xl font-bold text-white hover:bg-white/15 transition-all" placeholder="0.00" />
                                        <div className="text-right">
                                            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Valuation</div>
                                            <div className="text-xl font-bold text-emerald-400">AED {(form.box_qty * form.purchase_price).toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center bg-slate-50 -mx-6 -mb-6 p-6">
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Adding to batch</span>
                                            <span className="text-2xl font-black text-sky-600 tracking-tight">+{form.box_qty * form.pcs_per_box} <small className="text-[10px] font-bold opacity-40">NOS</small></span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button type="submit" className="h-12 px-8 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold uppercase tracking-wider text-[10px] shadow-sm transition-all active:scale-95 flex items-center gap-2">
                                            <Package size={16} /> Add to batch
                                        </button>
                                    </div>
                                </div>
                            </form>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-32 h-32 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center mb-6 text-slate-300">
                                    <Search size={48} strokeWidth={1.5} />
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Inventory Discovery</h1>
                                <p className="text-xs font-semibold text-slate-400 max-w-sm mx-auto leading-relaxed">
                                    Search for products above or scan a barcode to begin your professional line-by-line stock-in process.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Part 2: Batch Processing List */}
                    <div className="bg-[#0f172a] rounded-2xl shadow-lg p-6 relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-sky-500 shadow-lg flex items-center justify-center rounded-lg text-white">
                                    <ShoppingCart size={18} strokeWidth={2} />
                                </div>
                                <div>
                                    <h2 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Processing Queue</h2>
                                    <h1 className="text-xl font-bold text-white tracking-tight">BATCH ITEMS ({itemsToSubmit.length})</h1>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-2.5 rounded-xl px-5">
                                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">TOTAL</span>
                                    <div className="text-lg font-bold text-sky-400 tabular-nums">
                                        <small className="text-[10px] mr-1.5 text-sky-400/50 font-bold">AED</small>
                                        {itemsToSubmit.reduce((acc, it) => acc + (it.box_qty * it.purchase_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleSubmit} 
                                    disabled={submitting || (itemsToSubmit.length === 0 && !selectedItem)} 
                                    className="h-12 px-8 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-20 flex items-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {submitting ? 'Posting...' : 'Commit Batch'}
                                </button>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-2">
                            {itemsToSubmit.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {/* Compact Table Header */}
                                    <div className="grid grid-cols-12 gap-4 px-6 py-2 opacity-30 text-[8px] font-bold text-white uppercase tracking-wider border-b border-white/5">
                                        <div className="col-span-5">Product Details</div>
                                        <div className="col-span-3 text-center">Quantity</div>
                                        <div className="col-span-2 text-center">Unit Cost</div>
                                        <div className="col-span-1 text-right">Sale</div>
                                        <div className="col-span-1"></div>
                                    </div>
                                    
                                    {itemsToSubmit.map((it, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-4 bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-xl items-center transition-all duration-200">
                                            <div className="col-span-5 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-sky-400 font-bold overflow-hidden">
                                                    {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : it.item_name.charAt(0)}
                                                </div>
                                                <div className="truncate">
                                                    <div className="text-xs font-bold text-white uppercase truncate">{it.item_name}</div>
                                                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{it.item_code}</div>
                                                </div>
                                            </div>
                                            <div className="col-span-3 text-center leading-tight">
                                                <div className="text-[11px] font-bold text-white">{it.box_qty} BOX <small className="opacity-40">×</small> {it.pcs_per_box}</div>
                                                <div className="text-[9px] font-bold text-sky-400/60">{it.qty} PCS</div>
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <div className="text-[11px] font-bold text-emerald-400">{(it.purchase_price / it.pcs_per_box).toFixed(2)}</div>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <div className="text-[11px] font-bold text-sky-400">{it.new_selling_price.toFixed(2)}</div>
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <button onClick={() => removeFromStaging(idx)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                                                    <X size={14} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center border-2 border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">No items in queue</p>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;700;900&display=swap');
                
                body { 
                    font-family: 'Outfit', sans-serif; 
                    -webkit-font-smoothing: antialiased;
                }

                .custom-scrollbar-light::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar-light::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 20px; }
                .custom-scrollbar-light:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
                
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                    50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s infinite;
                }

                input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}} />
        </div>
    );
};

export default QuickStockInStandalone;
