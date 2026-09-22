import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useRef } from 'react';
import {
    Package, Save, X, Trash2, Search, Scan, Palette, Loader2,
    ArrowRight, Warehouse, User, FileText, ShoppingCart, Box, TrendingUp,
    Filter, RefreshCw, ChevronDown, PlusCircle, Camera, Image as ImageIcon, Upload
} from 'lucide-react';
import Swal from 'sweetalert2';
import POSService from '../../utils/posService';
import { db } from '../../db';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import '../Admin/SalesOrder.css';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const QuickStockInStandalone = () => {
    const user_roles = useSelector((state) => state.user.user_roles || []);
    const warehouse = useSelector((state) => state.user.warehouse);
    const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");
    const handleSupplierCreate = async (name) => {
        try {
            const res = await POSService.createSupplier(name);
            if (res?.status === 'success' && res?.message) {
                const s = res.message;
                return { name: s.name, supplier_name: s.supplier_name || s.name };
            }
            throw new Error('Failed to create supplier');
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
            throw err;
        }
    };

    const fetchSuppliersAPI = async (query) => {
        try {
            const res = await POSService.getSuppliers({ query });
            return (res || []).map(s => ({ name: s.name, supplier_name: s.supplier_name || s.name }));
        } catch (err) {
            return [];
        }
    };
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
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#ecfdf5' : '#f0f9ff';
    const themeHeaderBg = isGreen ? '#f2fdf9' : '#eff6ff';
    const themeHeaderText = isGreen ? '#0d9488' : '#1d4ed8';

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const html5QrcodeRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        localStorage.setItem('legacySubTheme', polTheme);
    }, [polTheme]);

    // Initial Data Fetch
    useEffect(() => {
        const loadInitData = async () => {
            try {
                const [whData, supData, taxData] = await Promise.all([
                    POSService.getWarehouses(),
                    POSService.getSuppliers(isAdmin ? {} : { filters: JSON.stringify([['custom_branch', '=', warehouse]]) }),
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

    const handleBarcodeEnter = async (e) => {
        if (e.key !== 'Enter') return;
        const barcode = e.target.value.trim();
        if (!barcode) return;

        setLoading(true);
        try {
            // Search local Dexie
            let found = await db.items.get(barcode);
            if (!found) {
                const results = await db.items.filter(it => 
                    (it.barcodes || []).some(b => (b.barcode || '').toLowerCase() === barcode.toLowerCase())
                ).toArray();
                found = results[0];
            }

            if (found) {
                selectItem(found);
            } else {
                // API check
                const online = await POSService.getItemByBarcode(barcode);
                if (online && online.status !== 'error') {
                    selectItem(online);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Not Found',
                        text: online?.message || `No item found for: ${barcode}`,
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
        setTimeout(() => {
            try {
                const html5Qrcode = new Html5Qrcode("standalone-scanner-reader");
                html5QrcodeRef.current = html5Qrcode;

                const config = {
                    fps: 15,
                    qrbox: (width, height) => {
                        const boxWidth = Math.min(width * 0.8, 450);
                        const boxHeight = Math.min(height * 0.6, 250);
                        return { width: boxWidth, height: boxHeight };
                    },
                    aspectRatio: 1.0
                };

                const formats = [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.QR_CODE
                ];

                html5Qrcode.start(
                    { facingMode: "environment" },
                    { ...config, formatsToSupport: formats },
                    (decodedText) => {
                        handleBarcodeEnter({ key: 'Enter', target: { value: decodedText.trim() } });
                        stopCameraScanner();
                    },
                    () => {}
                ).catch(err => {
                    console.error("Scanner failed, trying fallback device:", err);
                    html5Qrcode.start(
                        { deviceId: undefined },
                        { ...config, formatsToSupport: formats },
                        (decodedText) => {
                            handleBarcodeEnter({ key: 'Enter', target: { value: decodedText.trim() } });
                            stopCameraScanner();
                        },
                        () => {}
                    ).catch(finalErr => {
                        console.error("All startup options failed:", finalErr);
                        setIsScannerOpen(false);
                    });
                });
            } catch (err) {
                console.error(err);
                setIsScannerOpen(false);
            }
        }, 150);
    };

    const stopCameraScanner = () => {
        if (html5QrcodeRef.current) {
            if (html5QrcodeRef.current.isScanning) {
                html5QrcodeRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
            }
        }
        setIsScannerOpen(false);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        decodeImage(file);
    };

    const decodeImage = async (file) => {
        try {
            const html5Qrcode = html5QrcodeRef.current || new Html5Qrcode("standalone-scanner-reader");
            html5Qrcode.scanFile(file, false)
                .then(decodedText => {
                    handleBarcodeEnter({ key: 'Enter', target: { value: decodedText.trim() } });
                    stopCameraScanner();
                })
                .catch(err => {
                    Swal.fire('Error', 'No barcode found', 'error');
                });
        } catch (err) { }
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
        <div className="erp-page so-page" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* 1. PREMIUM HEADER */}
            <PageHeader className="so-page-header" style={{ padding: '0.75rem 1.5rem', flexShrink: 0 }}>
                <div>
                    <h1 className="so-page-title" style={{ fontSize: '1.1rem' }}>
                        <Package size={20} /> Quick Stock-In
                    </h1>
                    <p className="so-page-subtitle">Batch inventory intake & price management</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="so-badge so-badge-submitted" style={{ background: themeColor + '15', color: themeColor }}>
                        {itemsToSubmit.length} Record(s) in Queue
                    </div>

                    {/* Theme Toggle */}
                    <button
                        onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                            fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={13} />
                        {polTheme.toUpperCase()}
                    </button>

                    <button 
                        className="erp-button erp-button-primary so-btn-primary"
                        onClick={handleCommit} 
                        disabled={submitting || itemsToSubmit.length === 0}
                        style={{ height: '38px', background: themeColor, borderColor: themeColor }}
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {submitting ? 'Processing...' : 'Commit Batch'}
                    </button>
                </div>
            </PageHeader>

            {/* 2. CONFIGURATION BAR (Like Filter Bar) */}
            <div className="erp-filter-bar so-filter-bar" style={{
                background: 'white', 
                padding: '1rem 1.5rem', 
                borderBottom: '1px solid var(--so-border)',
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-end'
            }}>
                <div style={{ flex: '1 1 300px', position: 'relative' }}>
                    <label className="so-filter-label">Search or Scan Product</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Type name or scan barcode..."
                            className="so-filter-input"
                            style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem', height: '38px', width: '100%' }}
                            value={searchQuery}
                            onFocus={() => searchQuery.length > 0 && setShowResults(true)}
                            onChange={(e) => handleSearch(e.target.value)}
                            onKeyDown={handleBarcodeEnter}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                             <button 
                                type="button"
                                onClick={startCameraScanner}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg transition-all text-slate-400 hover:text-emerald-500"
                                title="Start Camera"
                            >
                                <Camera size={16} />
                            </button>
                            {loading && <Loader2 className="animate-spin" size={14} style={{ color: themeColor }} />}
                        </div>
                    </div>

                    {showResults && (
                        <div className="so-dropdown-portal" style={{ width: '100%', top: '105%', left: 0, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.25rem' }}>
                                {searchResults.map(it => (
                                    <div key={it.id} onClick={() => selectItem(it)} className="so-dropdown-item" style={{ borderRadius: '0.375rem', margin: '0.125rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyItems: 'center', overflow: 'hidden' }}>
                                                {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectCover: 'cover' }} /> : <Package size={14} style={{ margin: 'auto', color: '#cbd5e1' }} />}
                                            </div>
                                            <div>
                                                <div className="so-item-display-name">{it.name}</div>
                                                <div className="so-item-display-code">{it.id}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 800, color: themeColor, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <DirhamIcon size={12} /> {it.price?.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ width: '160px' }}>
                    <label className="so-filter-label">Entry Mode</label>
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '0.5rem', height: '38px' }}>
                        <button 
                            onClick={() => setForm({ ...form, entry_type: 'Purchase' })} 
                            style={{ flex: 1, border: 'none', borderRadius: '0.375rem', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', background: form.entry_type === 'Purchase' ? 'white' : 'transparent', color: form.entry_type === 'Purchase' ? '#0f172a' : '#94a3b8', boxShadow: form.entry_type === 'Purchase' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                        >Purchase</button>
                        <button 
                            onClick={() => setForm({ ...form, entry_type: 'Transfer' })} 
                            style={{ flex: 1, border: 'none', borderRadius: '0.375rem', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', background: form.entry_type === 'Transfer' ? 'white' : 'transparent', color: form.entry_type === 'Transfer' ? '#0f172a' : '#94a3b8', boxShadow: form.entry_type === 'Transfer' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                        >Transfer</button>
                    </div>
                </div>

                <div style={{ width: '180px' }}>
                    <label className="so-filter-label">Destination Branch</label>
                    <div style={{ position: 'relative' }}>
                        <Warehouse size={12} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
                        <select 
                            value={selectedWarehouse} 
                            onChange={(e) => setSelectedWarehouse(e.target.value)} 
                            className="so-filter-select" 
                            style={{ paddingLeft: '2.25rem', height: '38px' }}
                        >
                            {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ width: '200px' }}>
                    <label className="so-filter-label">{form.entry_type === 'Purchase' ? 'Supplier / Vendor' : 'Source Warehouse'}</label>
                    <div style={{ position: 'relative' }}>
                        <User size={12} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        {form.entry_type === 'Purchase' ? (
                            <CustomSearchDropdown
                                placeholder="Select Vendor..."
                                value={selectedSupplier ? { name: selectedSupplier, supplier_name: suppliers.find(s => s.name === selectedSupplier)?.supplier_name || selectedSupplier } : null}
                                onSelect={(s) => setSelectedSupplier(s.name)}
                                fetchData={fetchSuppliersAPI}
                                createOption={handleSupplierCreate}
                                optionsLabel="supplier_name"
                            />
                        ) : (
                            <select 
                                value={form.from_warehouse} 
                                onChange={(e) => setForm({ ...form, from_warehouse: e.target.value })} 
                                className="so-filter-select" 
                                style={{ paddingLeft: '2.25rem', height: '38px' }}
                            >
                                <option value="">Select Source...</option>
                                {warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name || w.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                <button 
                    className="so-clear-btn" 
                    onClick={() => { setSearchQuery(''); setSelectedItem(null); setItemsToSubmit([]); }}
                    style={{ height: '38px', width: 'auto', padding: '0 1rem', margin: 0 }}
                >Reset All</button>
            </div>

            {/* 3. MAIN SPLIT LAYOUT */}
            <div className="so-layout" style={{ flex: 1, padding: '1.25rem 1.5rem', gap: '1.25rem', minHeight: 0 }}>
                {/* LEFT: QUEUE TABLE */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <div className="so-list-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Current processing batch: <b>{itemsToSubmit.length} items</b></span>
                    </div>

                    <div className="erp-table-card so-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table className="erp-table so-table">
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th>Product Details</th>
                                        <th style={{ textAlign: 'center' }}>Quantity</th>
                                        <th style={{ textAlign: 'right' }}>Unit Buy</th>
                                        <th style={{ textAlign: 'right' }}>Sale Price</th>
                                        <th style={{ textAlign: 'right' }}>Sub-Total</th>
                                        <th style={{ textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsToSubmit.map((it, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                        {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={16} style={{ color: '#cbd5e1' }} />}
                                                    </div>
                                                    <div>
                                                        <div className="so-item-display-name" style={{ fontSize: '0.75rem' }}>{it.item_name}</div>
                                                        <div className="so-item-display-code">{it.item_code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ fontWeight: 800, color: '#1e293b' }}>{it.qty} PCS</div>
                                                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{it.box_qty} BOXES</div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                                {(it.purchase_price / it.pcs_per_box).toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: themeColor }}>
                                                {it.new_selling_price.toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                                {(it.box_qty * it.purchase_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => setItemsToSubmit(prev => prev.filter((_, i) => i !== idx))} 
                                                    className="so-btn-danger"
                                                    style={{ padding: '0.25rem' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {itemsToSubmit.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '6rem 0' }}>
                                                <div className="erp-empty so-empty">
                                                    <ShoppingCart size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                                    <p style={{ fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Queue is empty. Select a product to begin.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RIGHT: ENTRY FORM / MODIFIER */}
                <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '1.25rem', shrink: 0 }}>
                    <div className="erp-table-card so-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={14} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entry Details</span>
                        </div>

                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {selectedItem ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-fadeIn">
                                    {/* Item Preview Card */}
                                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.75rem', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                            <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                 {selectedItem.image ? <img src={selectedItem.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} /> : <Package size={20} style={{ color: themeColor }} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.125rem' }} className="truncate">{selectedItem.name}</div>
                                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 700, fontFamily: 'monospace' }}>ID: {selectedItem.id}</div>
                                            </div>
                                            <button onClick={() => setSelectedItem(null)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}><X size={14} /></button>
                                        </div>
                                    </div>

                                    {/* Inputs Grid */}
                                    <div className="so-form-grid">
                                        <div className="so-field">
                                            <label className="so-label">Quantity (Boxes)</label>
                                            <div style={{ position: 'relative' }}>
                                                <Box size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input 
                                                    type="number" 
                                                    className="so-input" 
                                                    style={{ paddingLeft: '2.25rem' }}
                                                    value={form.box_qty} 
                                                    onChange={e => setForm({ ...form, box_qty: parseFloat(e.target.value) || 0 })} 
                                                    onFocus={e => e.target.select()} autoFocus 
                                                />
                                            </div>
                                        </div>
                                        <div className="so-field">
                                            <label className="so-label">Pack (Pcs/Box)</label>
                                            <div style={{ position: 'relative' }}>
                                                <ShoppingCart size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                <input type="number" className="so-input" style={{ paddingLeft: '2.25rem', background: '#f8fafc', color: '#64748b' }} value={form.pcs_per_box} readOnly disabled />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="so-field">
                                        <label className="so-label" style={{ color: themeColor }}>Buying Rate (Total per Box)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                                                <DirhamIcon size={10} className="text-slate-400" />
                                            </span>
                                            <input 
                                                type="number" 
                                                className="so-input" 
                                                style={{ paddingLeft: '2.5rem', fontSize: '1.1rem', borderColor: themeColor + '60', color: themeColor }}
                                                value={form.purchase_price} 
                                                onChange={e => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} 
                                                onFocus={e => e.target.select()} 
                                            />
                                        </div>
                                    </div>

                                    {/* Pricing Logic Section */}
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', p: '0.75rem', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', background: '#e2e8f0', padding: '2px', borderRadius: '0.5rem' }}>
                                            <button 
                                                onClick={() => setForm({ ...form, price_type: 'Percentage' })} 
                                                style={{ flex: 1, border: 'none', borderRadius: '0.4rem', padding: '0.4rem', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', background: form.price_type === 'Percentage' ? 'white' : 'transparent', color: form.price_type === 'Percentage' ? '#0f172a' : '#64748b', transition: 'all 0.2s' }}
                                            >Profit Margin %</button>
                                            <button 
                                                onClick={() => setForm({ ...form, price_type: 'Amount' })} 
                                                style={{ flex: 1, border: 'none', borderRadius: '0.4rem', padding: '0.4rem', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', background: form.price_type === 'Amount' ? 'white' : 'transparent', color: form.price_type === 'Amount' ? '#0f172a' : '#64748b', transition: 'all 0.2s' }}
                                            >Fixed Sale Price</button>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0' }}>
                                            <input 
                                                type="number" 
                                                style={{ width: '140px', background: 'transparent', border: 'none', fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', textAlign: 'center', outline: 'none' }}
                                                value={form.value} 
                                                onChange={e => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} 
                                                onFocus={e => e.target.select()} 
                                            />
                                            {form.price_type === 'Percentage' && <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#cbd5e1', marginLeft: '0.25rem' }}>%</span>}
                                        </div>

                                        <div style={{ paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Unit Sale Price</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColor }}>
                                                    <DirhamIcon size={10} style={{ marginRight: '0.2rem', opacity: 0.6 }} />
                                                    {calculateLivePrice().toFixed(2)}
                                                </div>
                                            </div>
                                            <TrendingUp size={20} style={{ color: themeColor, opacity: 0.2 }} />
                                        </div>
                                    </div>

                                    <button 
                                        className="erp-button erp-button-primary so-btn-primary"
                                        style={{ width: '100%', height: '48px', fontSize: '0.85rem', background: '#0f172a', borderColor: '#0f172a' }}
                                        onClick={addToQueue}
                                    >
                                        <PlusCircle size={18} /> Add to Processing Batch
                                    </button>
                                </div>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, textAlign: 'center' }}>
                                    <Box size={48} style={{ marginBottom: '1rem', color: '#94a3b8' }} />
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Select a Product</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 600, marginTop: '0.5rem' }}>Search or scan to configure entry</div>
                                </div>
                            )}
                        </div>

                        {itemsToSubmit.length > 0 && !selectedItem && (
                            <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', background: themeLight + '30' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Batch Summary</span>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a' }}>{itemsToSubmit.length} Items</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                                    <div>
                                        <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Total Batch Cost</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                                            <DirhamIcon size={14} style={{ marginRight: '0.25rem' }} />
                                            {itemsToSubmit.reduce((sum, it) => sum + (it.box_qty * it.purchase_price), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <button 
                                        className="erp-button erp-button-primary so-btn-primary"
                                        style={{ background: themeColor, borderColor: themeColor }}
                                        onClick={handleCommit}
                                        disabled={submitting}
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Complete Batch
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
                                <div id="standalone-scanner-reader" className="w-full h-full" style={{ background: '#000' }}></div>
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

            <style dangerouslySetInnerHTML={{
                __html: `
                .so-page { --so-primary: ${themeColor}; --so-primary-hover: ${themeColorHover}; --so-primary-light: ${themeLight}; }
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
                
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


export default QuickStockInStandalone;
