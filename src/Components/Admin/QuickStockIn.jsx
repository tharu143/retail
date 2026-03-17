import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Save, X, Box, ShoppingCart, DollarSign, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';

const QuickStockIn = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const searchRef = useRef(null);

    const [form, setForm] = useState({
        box_qty: 0,
        pcs_per_box: 1,
        purchase_price: 0, // Box Price
        new_selling_price: 0 // Piece Price
    });

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedItem(null);
            setSearchResults([]);
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            // Search local Dexie first for speed
            const localItems = await db.items.toArray();
            const filtered = localItems.filter(it => 
                (it.name || '').toLowerCase().includes(val.toLowerCase()) ||
                (it.id || '').toLowerCase().includes(val.toLowerCase()) ||
                (it.barcodes || []).some(b => (b.barcode || '').toLowerCase().includes(val.toLowerCase()))
            ).slice(0, 5);

            setSearchResults(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const selectItem = (item) => {
        setSelectedItem(item);
        setSearchResults([]);
        setSearchQuery('');
        setForm({
            box_qty: 0,
            pcs_per_box: item.custom_pieces_per_box || 1,
            purchase_price: 0,
            new_selling_price: item.price || 0
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedItem) return;

        if (form.box_qty <= 0) {
            Swal.fire('Error', 'Quantity must be greater than 0', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                item_code: selectedItem.id,
                box_qty: form.box_qty,
                pcs_per_box: form.pcs_per_box,
                purchase_price: form.purchase_price,
                new_selling_price: form.new_selling_price,
                warehouse: localStorage.getItem('warehouse') || 'Finished Goods - L'
            };

            const res = await POSService.submitPurchaseEntry(payload);
            
            if (res.status === 'success' || res.name) {
                Swal.fire({
                    icon: 'success',
                    title: 'Stock Updated',
                    text: `Successfully added ${form.box_qty * form.pcs_per_box} pieces to inventory.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Refresh local Dexie item price and qty
                const existing = await db.items.get(selectedItem.id);
                if (existing) {
                    await db.items.update(selectedItem.id, {
                        price: form.new_selling_price,
                        actual_qty: (existing.actual_qty || 0) + (form.box_qty * form.pcs_per_box),
                        local_qty: (existing.local_qty || 0) + (form.box_qty * form.pcs_per_box)
                    });
                }

                onClose();
            } else {
                throw new Error(res.message || 'Failed to submit');
            }
        } catch (err) {
            Swal.fire('Failed', err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Package className="text-sky-600" size={20} />
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Manager Quick Stock-In</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6">
                    {!selectedItem ? (
                        <div className="relative">
                            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-sky-500 focus-within:bg-white transition-all shadow-sm">
                                <Search size={18} className="text-slate-400" />
                                <input 
                                    ref={searchRef}
                                    type="text" 
                                    placeholder="Scan Barcode or Type Item Name..." 
                                    className="bg-transparent border-none outline-none w-full text-xs font-bold text-slate-700 placeholder:text-slate-400"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                {loading && <Loader2 className="animate-spin text-sky-500" size={16} />}
                            </div>

                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-10 overflow-hidden divide-y divide-slate-50">
                                    {searchResults.map(it => (
                                        <div 
                                            key={it.id} 
                                            onClick={() => selectItem(it)}
                                            className="px-4 py-3 hover:bg-sky-50 cursor-pointer transition-colors flex justify-between items-center"
                                        >
                                            <div>
                                                <div className="text-xs font-black text-slate-800">{it.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase">{it.id}</div>
                                            </div>
                                            <div className="text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">
                                                Qty: {it.local_qty || 0}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Selected Item Card */}
                            <div className="bg-sky-50/50 rounded-2xl p-4 border border-sky-100 flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-1">Selected Item</div>
                                    <div className="text-xs font-black text-slate-800">{selectedItem.name}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{selectedItem.id}</div>
                                </div>
                                <button type="button" onClick={() => setSelectedItem(null)} className="text-[10px] font-black text-sky-600 hover:underline">Change</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Box Quantity</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-sky-500 focus-within:bg-white transition-all">
                                        <Box size={14} className="text-slate-400" />
                                        <input 
                                            type="number" 
                                            required
                                            value={form.box_qty}
                                            onChange={(e) => setForm({...form, box_qty: parseFloat(e.target.value) || 0})}
                                            className="bg-transparent border-none outline-none w-full text-xs font-black text-slate-700"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Pcs per Box</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-sky-500 focus-within:bg-white transition-all">
                                        <ShoppingCart size={14} className="text-slate-400" />
                                        <input 
                                            type="number" 
                                            required
                                            value={form.pcs_per_box}
                                            onChange={(e) => setForm({...form, pcs_per_box: parseFloat(e.target.value) || 1})}
                                            className="bg-transparent border-none outline-none w-full text-xs font-black text-slate-700"
                                            placeholder="1"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Purchase Price (Box)</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-sky-500 focus-within:bg-white transition-all">
                                        <DollarSign size={14} className="text-slate-400" />
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            value={form.purchase_price}
                                            onChange={(e) => setForm({...form, purchase_price: parseFloat(e.target.value) || 0})}
                                            className="bg-transparent border-none outline-none w-full text-xs font-black text-slate-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">New Selling (Pcs)</label>
                                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-3 py-2.5 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                                        <DollarSign size={14} className="text-emerald-500" />
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            value={form.new_selling_price}
                                            onChange={(e) => setForm({...form, new_selling_price: parseFloat(e.target.value) || 0})}
                                            className="bg-transparent border-none outline-none w-full text-xs font-black text-emerald-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Pieces</div>
                                    <div className="text-lg font-black text-slate-800">{(form.box_qty * form.pcs_per_box).toLocaleString()} Pcs</div>
                                </div>
                                
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    {submitting ? "Submitting..." : "Update Inventory & Price"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickStockIn;
