import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Package, Save, X, Box, ShoppingCart, DollarSign, Loader2, Warehouse, History, ArrowRight, Palette, Camera, Scan, Upload, ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';
import { BrowserMultiFormatReader } from '@zxing/library';

const QuickStockIn = ({ isOpen, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState('');
    const [itemHistory, setItemHistory] = useState(null);
    const searchRef = useRef(null);

    // Theme toggle (synced across pages)
    const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = polTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const videoRef = useRef(null);
    const codeReader = useRef(new BrowserMultiFormatReader());
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        localStorage.setItem('legacySubTheme', polTheme);
        document.documentElement.style.setProperty('--po-primary', themeColor);
        document.documentElement.style.setProperty('--po-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--po-primary-light', themeLight);
    }, [polTheme, themeColor, themeColorHover, themeLight]);

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
            fetchWarehouses();
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const fetchWarehouses = async () => {
        try {
            const data = await POSService.getWarehouses();
            setWarehouses(data || []);
            const defaultWh = localStorage.getItem('warehouse') || (data?.[0]?.name || '');
            setSelectedWarehouse(defaultWh);
        } catch (err) {
            console.error('Failed to fetch warehouses', err);
        }
    };

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
            ).slice(0, 8);

            setSearchResults(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBarcodeEnter = async (e) => {
        if (e.key !== 'Enter') return;
        const barcode = e.target.value.trim();
        if (!barcode) return;

        setLoading(true);
        try {
            const localItems = await db.items.toArray();
            const found = localItems.find(it => 
                (it.id || '').toLowerCase() === barcode.toLowerCase() ||
                (it.barcodes || []).some(b => (b.barcode || '').toLowerCase() === barcode.toLowerCase())
            );

            if (found) {
                selectItem(found);
            } else {
                // Try API
                const res = await POSService.getItemByBarcode(barcode);
                if (res && res.status !== 'error') {
                    selectItem(res);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: res?.message || `No item found for barcode: ${barcode}`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setSearchQuery('');
        }
    };

    const startCameraScanner = async () => {
        setIsScannerOpen(true);
        setTimeout(async () => {
            try {
                const videoInputDevices = await codeReader.current.listVideoInputDevices();
                const selectedDeviceId = videoInputDevices[0].deviceId;
                codeReader.current.decodeFromVideoDevice(selectedDeviceId, videoRef.current, (result) => {
                    if (result) {
                        const barcode = result.getText();
                        handleBarcodeEnter({ key: 'Enter', target: { value: barcode } });
                        stopCameraScanner();
                    }
                });
            } catch (err) {
                console.error(err);
                setIsScannerOpen(false);
            }
        }, 100);
    };

    const stopCameraScanner = () => {
        codeReader.current.reset();
        setIsScannerOpen(false);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        decodeImage(file);
    };

    const decodeImage = async (file) => {
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const image = new Image();
                image.src = reader.result;
                image.onload = async () => {
                    try {
                        const result = await codeReader.current.decodeFromImageElement(image);
                        handleBarcodeEnter({ key: 'Enter', target: { value: result.getText() } });
                        stopCameraScanner();
                    } catch (err) {
                        Swal.fire('Error', 'No barcode found in image', 'error');
                    }
                };
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
        }
    };

    const selectItem = async (item) => {
        setSelectedItem(item);
        setSearchResults([]);
        setSearchQuery('');
        
        // Load initial form data
        setForm({
            box_qty: 0,
            pcs_per_box: item.custom_pieces_per_box || 1,
            purchase_price: 0,
            new_selling_price: item.price || 0
        });

        // Fetch pricing history/last buy rate
        try {
            const history = await POSService.getItemPricingHistory(item.id);
            if (history && history[item.id]) {
                const lastEntry = history[item.id][0];
                setItemHistory(lastEntry);
                setForm(prev => ({
                    ...prev,
                    purchase_price: lastEntry ? (lastEntry.rate * (item.custom_pieces_per_box || 1)) : 0
                }));
            }
        } catch (err) {
            console.error('History fetch failed', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedItem || !selectedWarehouse) {
            Swal.fire('Error', 'Please select item and warehouse', 'error');
            return;
        }

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
                purchase_price: form.purchase_price, // This is box price
                new_selling_price: form.new_selling_price, // This is piece price
                warehouse: selectedWarehouse
            };

            const res = await POSService.submitPurchaseEntry(payload);
            
            if (res.status === 'success' || res.name) {
                Swal.fire({
                    icon: 'success',
                    title: 'Inventory Updated!',
                    text: `${selectedItem.name} stock increased.`,
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // Refresh local Dexie item price and qty
                const existing = await db.items.get(selectedItem.id);
                if (existing) {
                    const totalPieces = form.box_qty * form.pcs_per_box;
                    
                    // Update specific warehouse in details if it matches
                    const updatedWD = (existing.warehouse_details || []).map(wd => {
                        if (wd.warehouse === selectedWarehouse || wd.warehouse_name === selectedWarehouse) {
                            return { ...wd, actual_qty: (wd.actual_qty || 0) + totalPieces };
                        }
                        return wd;
                    });

                    await db.items.update(selectedItem.id, {
                        price: form.new_selling_price,
                        actual_qty: (existing.actual_qty || 0) + totalPieces,
                        local_qty: (existing.local_qty || 0) + totalPieces,
                        warehouse_details: updatedWD
                    });
                }

                onClose();
            } else {
                throw new Error(res.message || 'Failed to submit');
            }
        } catch (err) {
            Swal.fire('Process Failed', err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div 
                    className="px-8 py-6 flex justify-between items-center text-white"
                    style={{ background: '#0f172a' }} // Deep slate
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-xl">
                            <Package style={{ color: themeColor }} size={24} />
                        </div>
                        <div>
                            <h3 className="font-black uppercase tracking-widest text-lg leading-tight">Quick Stock-In</h3>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">Manager Authorization Required</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.05)',
                                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                                fontSize: '0.65rem', fontWeight: 800, color: themeColor,
                                cursor: 'pointer', transition: 'all 0.2s',
                                textTransform: 'uppercase', letterSpacing: '0.04em'
                            }}
                            title="Toggle Theme"
                        >
                            <Palette size={12} />
                            {polTheme}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {!selectedItem ? (
                        <div className="space-y-6">
                            <div className="relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Search size={22} strokeWidth={2.5} style={{ color: themeColor }} />
                                </div>
                                <input 
                                    ref={searchRef}
                                    type="text" 
                                    placeholder="SCAN BARCODE OR TYPE ITEM NAME..." 
                                    className="w-full bg-slate-100 border-2 border-transparent rounded-[1.5rem] pl-14 pr-16 py-5 text-sm font-black text-slate-800 placeholder:text-slate-400 focus:bg-white transition-all shadow-sm outline-none"
                                    style={{ borderColor: 'transparent' }}
                                    onFocus={(e) => e.target.style.borderColor = themeColor}
                                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    onKeyDown={handleBarcodeEnter}
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={startCameraScanner}
                                        className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-emerald-500"
                                        title="Start Camera"
                                    >
                                        <Camera size={20} />
                                    </button>
                                    {loading && (
                                        <Loader2 className="animate-spin" size={20} style={{ color: themeColor }} />
                                    )}
                                </div>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="bg-slate-50 rounded-[2rem] border border-slate-100 divide-y divide-slate-200 overflow-hidden shadow-sm">
                                    {searchResults.map(it => (
                                        <div 
                                            key={it.id} 
                                            onClick={() => selectItem(it)}
                                            className="px-6 py-5 hover:bg-slate-100 cursor-pointer transition-all flex justify-between items-center group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 group-hover:border-slate-200 shadow-sm transition-all">
                                                    <Package size={18} className="text-slate-400 group-hover:text-emerald-500" style={{ color: isGreen ? '' : '#0ea5e9' }} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-800 leading-tight">{it.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{it.id}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black px-3 py-1 rounded-full" style={{ background: themeLight, color: themeColor }}>
                                                    STK: {it.local_qty || 0}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchQuery.length > 1 && searchResults.length === 0 && !loading && (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-3">🔍</div>
                                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No matching items found</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Selected Item Detail */}
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <div className="relative z-10 flex justify-between items-start">
                                    <div>
                                        <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: themeColor }}>Item Identified</div>
                                        <h4 className="text-lg font-black leading-tight mb-1">{selectedItem.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded">{selectedItem.id}</span>
                                            <span className="text-[10px] font-black" style={{ color: themeColor }}>● {selectedItem.group}</span>
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setSelectedItem(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all h-fit">
                                        <ArrowRight className="rotate-180" size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Stock Location */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">
                                    <Warehouse size={12} style={{ color: themeColor }} />
                                    Target Branch
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    <select 
                                        required
                                        value={selectedWarehouse}
                                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                                        className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 outline-none focus:bg-white transition-all appearance-none cursor-pointer"
                                        style={{ borderColor: 'transparent' }}
                                        onFocus={(e) => e.target.style.borderColor = themeColor}
                                        onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                    >
                                        <option value="">Select Branch...</option>
                                        {warehouses.map(wh => (
                                            <option key={wh.name} value={wh.name}>{wh.warehouse_name || wh.name}</option>
                                        ))}
                                    </select>
                                    
                                    {/* Existing stock in warehouses mini-list */}
                                    <div className="flex flex-wrap gap-2 px-2">
                                        {(selectedItem.warehouse_details || []).map((wd, idx) => {
                                            const isSelected = selectedWarehouse === (wd.warehouse || wd.warehouse_name);
                                            return (
                                                <div key={idx} className={`text-[9px] font-black px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all ${isSelected ? '' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                                     style={isSelected ? { background: themeColor, color: '#fff', borderColor: themeColor } : {}}>
                                                    <span>{wd.warehouse_name || wd.warehouse}:</span>
                                                    <span className={isSelected ? 'text-white' : 'text-slate-900'}>{wd.actual_qty || 0}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Form Input Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Boxes to Add</label>
                                    <div className="relative">
                                        <Box size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="number" 
                                            required
                                            value={form.box_qty || ''}
                                            onChange={(e) => setForm({...form, box_qty: parseFloat(e.target.value) || 0})}
                                            className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 rounded-2xl text-sm font-black text-slate-800 focus:bg-white outline-none transition-all shadow-sm"
                                            style={{ borderColor: 'transparent' }}
                                            onFocus={(e) => e.target.style.borderColor = themeColor}
                                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Pack Size (Pcs/Box)</label>
                                    <div className="relative">
                                        <ShoppingCart size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="number" 
                                            required
                                            value={form.pcs_per_box || ''}
                                            onChange={(e) => setForm({...form, pcs_per_box: parseFloat(e.target.value) || 1})}
                                            className="w-full pl-11 pr-4 py-4 bg-slate-50 border-2 rounded-2xl text-sm font-black text-slate-800 focus:bg-white outline-none transition-all shadow-sm"
                                            style={{ borderColor: 'transparent' }}
                                            onFocus={(e) => e.target.style.borderColor = themeColor}
                                            onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                            placeholder="1"
                                        />
                                    </div>
                                </div>

                                {/* PRICING SIDE BY SIDE */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Buying Price (Box)</label>
                                    <div className="bg-slate-50 border-2 border-slate-50 rounded-2xl p-1 focus-within:bg-white transition-all shadow-sm" style={{ borderColor: 'transparent' }} onFocus={(e) => e.currentTarget.style.borderColor = themeColor} onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}>
                                        <div className="flex items-center gap-2 pl-3">
                                            <DollarSign size={14} className="text-slate-400" />
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                value={form.purchase_price || ''}
                                                onChange={(e) => setForm({...form, purchase_price: parseFloat(e.target.value) || 0})}
                                                className="bg-transparent border-none outline-none w-full py-3 text-sm font-black text-slate-800"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {itemHistory && (
                                            <div className="bg-slate-900 mx-1 mb-1 rounded-xl px-3 py-1.5 flex justify-between items-center">
                                                <span className="text-[8px] font-black text-slate-400 uppercase">Last Buy:</span>
                                                <span className="text-[9px] font-black" style={{ color: themeColor }}>AED {parseFloat(itemHistory.rate * form.pcs_per_box).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Selling (Pcs)</label>
                                    <div className="bg-emerald-50 border-2 border-emerald-50 rounded-2xl p-1 focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-sm">
                                        <div className="flex items-center gap-2 pl-3">
                                            <ArrowRight size={14} className="text-emerald-500" />
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                required
                                                value={form.new_selling_price || ''}
                                                onChange={(e) => setForm({...form, new_selling_price: parseFloat(e.target.value) || 0})}
                                                className="bg-transparent border-none outline-none w-full py-3 text-sm font-black text-emerald-700"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="mx-1 mb-1 rounded-xl px-3 py-1.5 flex justify-between items-center" style={{ background: themeColor }}>
                                            <span className="text-[8px] font-black text-emerald-100 uppercase">Current:</span>
                                            <span className="text-[9px] font-black text-white">AED {parseFloat(selectedItem.price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Total Summary */}
                            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Stock Impact</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900">+{ (form.box_qty * form.pcs_per_box).toLocaleString() }</span>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pieces</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Net Cost</p>
                                        <span className="text-lg font-black text-slate-700">AED { (form.box_qty * form.purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) }</span>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="w-full text-white rounded-2xl py-5 mt-6 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                                    style={{ background: themeColor }}
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    {submitting ? "Processing..." : "Commit Inventory & Price Update"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
            
            {isScannerOpen && createPortal(
                <div 
                    className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fadeIn"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) decodeImage(file);
                    }}
                >
                    <div className={`relative w-full max-w-lg aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border-4 transition-all duration-300 ${isDragging ? 'border-emerald-500 scale-105 ring-4 ring-emerald-500/20' : 'border-emerald-500/30'}`}>
                        {isDragging ? (
                            <div className="absolute inset-0 bg-emerald-600/40 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-pulse">
                                <Upload className="w-16 h-16 text-white mb-4" />
                                <p className="text-white font-bold text-lg uppercase tracking-widest">Drop Image to Scan</p>
                            </div>
                        ) : (
                            <>
                                <video ref={videoRef} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-[60px] border-black/40 pointer-events-none flex items-center justify-center">
                                    <div className="w-full h-full border-2 border-emerald-400/50 relative">
                                        <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                                        <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                                        <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                                        <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                                        <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] absolute animate-scanLine" />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="absolute top-4 right-4 flex gap-2">
                            <label className="w-10 h-10 bg-white/10 hover:bg-emerald-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20 cursor-pointer group" title="Upload Image">
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </label>
                            <button 
                                onClick={stopCameraScanner}
                                className="w-10 h-10 bg-white/10 hover:bg-red-500/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all border border-white/20"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                            <div className="text-white bg-emerald-600/80 backdrop-blur-md px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg whitespace-nowrap">
                                {isDragging ? 'Release to Scan' : 'Align Barcode or Drop Image'}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                
                @keyframes scanLine {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scanLine {
                    animation: scanLine 2s linear infinite;
                }
            `}} />
        </div>
    );
};

export default QuickStockIn;
