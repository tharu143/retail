import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Save, CheckCircle2, XCircle, Package, Building2, User,
    Search, Trash2, Loader2, AlertTriangle, AlertCircle, ArrowRight, ArrowLeftRight, Info, Plus, Scan, MapPin, X, Copy, Edit3, FileText,
    MessageSquare, Clock, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import Swal from 'sweetalert2';
import './ibt-details.css'; // Dedicated Inter-Branch Transfer styles
import DirhamIcon from '../../assets/Currency/DirhamIcon';

const API_PATH = '/api/method/kyle_retail.retail_api.api';

// Accept & Transfer Modal - shown to Branch B when accepting a request
const AcceptTransferModal = ({ isOpen, onClose, items, sourceWarehouse, onConfirm }) => {
    const [prices, setPrices] = useState({});
    const [itemQtys, setItemQtys] = useState({});
    const [loading, setLoading] = useState(false);
    const [minPrices, setMinPrices] = useState({});
    const [pinValue, setPinValue] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    useEffect(() => {
        if (isOpen && items?.length > 0 && sourceWarehouse) {
            fetchPrices();
            const initialQtys = {};
            items.forEach(it => {
                initialQtys[it.item_code] = it.qty || 1;
            });
            setItemQtys(initialQtys);
        }
    }, [isOpen, items, sourceWarehouse]);

    const fetchPrices = async () => {
        try {
            setLoading(true);
            const sid = localStorage.getItem('session') || '';
            const itemCodes = items.map(it => it.item_code);
            const res = await axios.post(`${API_PATH}.get_branch_selling_prices`, {
                items: JSON.stringify(itemCodes),
                warehouse: sourceWarehouse
            }, {
                headers: { 'X-Frappe-SID': sid },
                withCredentials: true
            });
            const data = res.data?.message || {};
            const initialPrices = {};
            const mins = {};
            items.forEach(it => {
                const p = data[it.item_code] || {};
                const uomIsBox = (it.uom || '').toLowerCase() === 'box';
                initialPrices[it.item_code] = {
                    selling_price: uomIsBox ? (p.box_price || 0) : (p.nos_price || 0),
                    nos_price: p.nos_price || 0,
                    box_price: p.box_price || 0,
                    pcs_per_box: p.pcs_per_box || 1
                };
                mins[it.item_code] = {
                    nos: p.nos_price || 0,
                    box: p.box_price || 0
                };
            });
            setPrices(initialPrices);
            setMinPrices(mins);
            setValidationErrors({});
        } catch (err) {
            console.error('Failed to fetch branch prices:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePriceChange = (itemCode, value, uom) => {
        const numVal = parseFloat(value) || 0;
        const isBox = (uom || '').toLowerCase() === 'box';
        const minPrice = isBox ? (minPrices[itemCode]?.box || 0) : (minPrices[itemCode]?.nos || 0);

        const newErrors = { ...validationErrors };
        if (numVal > 0 && numVal < minPrice) {
            newErrors[itemCode] = `Cannot be lower than ${minPrice.toFixed(2)}`;
        } else {
            delete newErrors[itemCode];
        }
        setValidationErrors(newErrors);

        setPrices(prev => ({
            ...prev,
            [itemCode]: {
                ...prev[itemCode],
                selling_price: numVal,
                ...(isBox ? { box_price: numVal } : { nos_price: numVal })
            }
        }));
    };

    const handleQtyChange = (itemCode, value) => {
        const numVal = parseFloat(value) || 0;
        setItemQtys(prev => ({
            ...prev,
            [itemCode]: numVal
        }));
    };

    const handleConfirm = () => {
        if (Object.keys(validationErrors).length > 0) {
            return;
        }
        if (!pinValue) {
            return;
        }
        // Build selling_prices array with updated quantities for the API
        const sellingPrices = items.map(it => ({
            item_code: it.item_code,
            qty: itemQtys[it.item_code] ?? it.qty,
            selling_price_nos: prices[it.item_code]?.nos_price || 0,
            selling_price_box: prices[it.item_code]?.box_price || 0
        }));
        onConfirm(pinValue, sellingPrices);
    };

    if (!isOpen) return null;

    const hasErrors = Object.keys(validationErrors).length > 0;

    const grandTotal = items?.reduce((sum, item) => {
        const itemPrices = prices[item.item_code] || {};
        const q = itemQtys[item.item_code] ?? (item.qty || 0);
        return sum + (q * (itemPrices.selling_price || 0));
    }, 0) || 0;

    const totalQty = items?.reduce((sum, item) => sum + (itemQtys[item.item_code] ?? (item.qty || 0)), 0) || 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-4xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                                <Package size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-base font-extrabold text-slate-950 tracking-tight leading-none">Accept & Transfer</h2>
                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider">
                                        Source: {sourceWarehouse?.replace(' - KSPL', '')}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                                    Verify quantities, confirm selling prices & authorize dispatch
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-50 active:scale-95 rounded-xl transition-all text-slate-400 hover:text-slate-700">
                            <X size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* Items Container */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/20">
                    {loading ? (
                        <div className="py-16 text-center space-y-4">
                            <Loader2 className="animate-spin mx-auto text-emerald-500" size={28} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Branch Prices...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Items Table Card */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
                                <div className="erp-scroll-region overflow-x-auto">
                                    <table className="erp-table w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-150 bg-slate-50/75">
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center" style={{ width: '50px' }}>#</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Details & Last Supplier</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center" style={{ width: '130px' }}>Quantity</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right" style={{ width: '180px' }}>Selling Price</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right" style={{ width: '160px' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item, idx) => {
                                                const itemPrices = prices[item.item_code] || {};
                                                const isBox = (item.uom || '').toLowerCase() === 'box';
                                                const sellingPrice = itemPrices.selling_price || 0;
                                                const currentQty = itemQtys[item.item_code] ?? (item.qty || 0);
                                                const totalPrice = currentQty * sellingPrice;
                                                const error = validationErrors[item.item_code];
                                                const minPrice = isBox ? (minPrices[item.item_code]?.box || 0) : (minPrices[item.item_code]?.nos || 0);

                                                return (
                                                    <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${error ? 'bg-rose-50/20' : ''}`}>
                                                        <td className="px-4 py-4 text-center text-xs font-bold text-slate-400">
                                                            {idx + 1}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className="text-xs font-extrabold text-slate-900 block leading-tight">{item.item_name}</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.item_code}</span>
                                                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                                    Supplier: {item.last_purchase_supplier || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    className="w-20 h-9 px-2 border border-slate-200 rounded-xl font-extrabold text-xs outline-none text-center bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-inner"
                                                                    value={currentQty}
                                                                    onChange={(e) => handleQtyChange(item.item_code, e.target.value)}
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase">{item.uom || 'Nos'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex flex-col items-end gap-1">
                                                                <div className="relative w-32">
                                                                    <input
                                                                        type="number"
                                                                        className={`w-full h-9 pl-3 pr-9 border rounded-xl font-bold text-xs outline-none transition-all text-right bg-white ${error
                                                                                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                                                                                : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
                                                                            }`}
                                                                        value={sellingPrice || ''}
                                                                        placeholder="0.00"
                                                                        onChange={(e) => handlePriceChange(item.item_code, e.target.value, item.uom)}
                                                                        onFocus={(e) => e.target.select()}
                                                                    />
                                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">
                                                                        AED
                                                                    </span>
                                                                </div>
                                                                {error ? (
                                                                    <span className="text-[8px] font-bold text-rose-500 leading-tight">{error}</span>
                                                                ) : (
                                                                    <span className="text-[8px] font-bold text-slate-400 leading-tight">
                                                                        Min: <span className="text-slate-600 font-semibold">{minPrice.toFixed(2)}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <span className="text-xs font-black text-slate-950">
                                                                AED {totalPrice.toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* Summary Row */}
                                            <tr className="bg-slate-50/50 border-t border-slate-200">
                                                <td colSpan={2} className="px-4 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">
                                                    Total Items: {items.length}
                                                </td>
                                                <td className="px-4 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                                                    {totalQty}
                                                </td>
                                                <td className="px-4 py-3.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-right">
                                                    Grand Total:
                                                </td>
                                                <td className="px-4 py-3.5 text-sm font-black text-emerald-600 text-right">
                                                    AED {grandTotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* PIN Authorization Panel */}
                            <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white text-slate-650 rounded-xl border border-slate-150 shadow-xs">
                                        <Info size={16} className="text-slate-500" />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Cashier Authorization PIN</h4>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                            Enter your 4-digit security PIN to authorize this dispatch transfer.
                                        </p>
                                    </div>
                                </div>
                                <div className="w-full md:w-auto">
                                    <input
                                        type="password"
                                        maxLength={4}
                                        className="w-full md:w-36 h-10 px-4 border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-xl font-black text-sm outline-none transition-all text-center tracking-[0.5em] bg-white shadow-inner"
                                        value={pinValue}
                                        onChange={(e) => setPinValue(e.target.value)}
                                        placeholder="••••"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || hasErrors || !pinValue}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                        <CheckCircle2 size={13} /> Confirm & Dispatch
                    </button>
                </div>
            </div>
        </div>
    );
};

// Dispatch Prices View Modal - shown to Branch A to see what B sent
const DispatchPricesModal = ({ isOpen, onClose, items, sourceWarehouse }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">Dispatch Prices</h2>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            Selling prices provided by {sourceWarehouse?.replace(' - KSPL', '') || 'Source Branch'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-600">
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                    {items.map((item, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                                    {idx + 1}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-700">{item.item_name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item.item_code}</span>
                                        <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                            Supplier: {item.last_purchase_supplier || 'N/A'}
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-bold text-blue-500 mt-0.5">{item.qty} {item.uom || 'Nos'}</p>
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="text-sm font-black text-slate-800">
                                    {parseFloat(item.rate || 0).toFixed(2)} <span className="text-[8px] text-slate-400 uppercase">/ {item.uom || 'Nos'}</span>
                                </div>
                                <div className="text-xs font-bold text-blue-600">
                                    Total: {(parseFloat(item.rate || 0) * parseFloat(item.qty || 0)).toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter text-center">
                        These are the selling prices set by the source branch for this transfer
                    </p>
                </div>
            </div>
        </div>
    );
};

// Branch Availability Modal
const BranchAvailabilityModal = ({ isOpen, onClose, itemCode, itemName, currentWarehouse, onSelectBranch }) => {
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (isOpen && itemCode) {
            fetchNearestStock();
        }
    }, [isOpen, itemCode]);

    const fetchNearestStock = async () => {
        try {
            setLoading(true);
            const sid = localStorage.getItem('session') || '';
            const res = await axios.get(`${API_PATH}.find_nearest_stock`, {
                params: { item_code: itemCode, current_warehouse: currentWarehouse },
                headers: { 'X-Frappe-SID': sid }
            });
            const stockBranches = (res.data?.message || []).filter(b => b.qty > 0);
            setBranches(stockBranches);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="erp-overlay ibt-modal-overlay">
            <div className="ibt-modal-box">
                <div className="erp-dialog-edge ibt-modal-header">
                    <div>
                        <h2 className="ibt-modal-title">Available Nearby</h2>
                        <p className="ibt-modal-subtitle">
                            <Package size={12} /> {itemName}
                        </p>
                    </div>
                    <button onClick={onClose} className="ibt-modal-close-btn" title="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="erp-dialog-body ibt-modal-body">
                    {loading ? (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--ibt-text-muted)' }}>
                            <Loader2 className="animate-spin" size={28} style={{ margin: '0 auto 0.75rem auto', color: 'var(--ibt-primary)' }} />
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locating Inventory...</p>
                        </div>
                    ) : branches.length > 0 ? (
                        branches.map((b, idx) => (
                            <div key={idx} className="ibt-branch-card">
                                <div className="ibt-branch-card-info">
                                    <h4 className="ibt-branch-card-title">{b.warehouse}</h4>
                                    <div className="ibt-branch-card-dist">
                                        <MapPin size={11} style={{ color: 'var(--ibt-text-muted)' }} /> {b.distance === 9999 ? 'Nearby Branch' : `${b.distance} km`}
                                    </div>
                                </div>
                                <div className="ibt-branch-card-stats">
                                    <div className="ibt-branch-stat-group">
                                        <div className="ibt-branch-stat-label">In Stock</div>
                                        <div className="ibt-branch-stat-val">{b.qty}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onSelectBranch(b.warehouse, b.qty, b.price);
                                            onClose();
                                        }}
                                        className="erp-button erp-button-primary ibt-btn ibt-btn-primary"
                                        style={{ height: '2rem', padding: '0 0.85rem', fontSize: '0.75rem' }}
                                    >
                                        Select
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--ibt-text-muted)' }}>
                            <XCircle size={32} style={{ margin: '0 auto 0.5rem auto', color: '#cbd5e1' }} />
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Out of stock globally</p>
                        </div>
                    )}
                </div>

                <div className="erp-dialog-edge ibt-modal-footer">
                    <p className="ibt-modal-footer-text">
                        Select a branch to set as source warehouse
                    </p>
                </div>
            </div>
        </div>
    );
};

function InterBranchTransferDetails() {
    const { name } = useParams();
    const navigate = useNavigate();
    const isNew = !name;

    const { themeColor, themeColorHover, themeLight } = useLegacyTheme();
    const currentWarehouse = useSelector((state) => state.user.warehouse);

    const [doc, setDoc] = useState({
        set_from_warehouse: '',
        set_warehouse: currentWarehouse || '',
        items: isNew ? [{ item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0, rate: 0 }] : [],
        status: 'Draft',
        docstatus: 0
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [decisionLoading, setDecisionLoading] = useState(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [activeItemIndex, setActiveItemIndex] = useState(null);

    const [sellingPrices, setSellingPrices] = useState({});
    const [updatingPrices, setUpdatingPrices] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);

    const [acceptingStock, setAcceptingStock] = useState(false);
    const [sourcePrices, setSourcePrices] = useState({});

    // Accept & Transfer Modal state
    const [showAcceptModal, setShowAcceptModal] = useState(false);
    // Dispatch Prices Modal state (for Branch A to view B's prices)
    const [showDispatchPrices, setShowDispatchPrices] = useState(false);

    useEffect(() => {
        fetchWarehouses();
        if (!isNew) {
            fetchRequest();
        } else {
            setIsViewOnly(false);
        }
    }, [name]);

    // Sync currentWarehouse to set_warehouse when it loads asynchronously for new requests
    useEffect(() => {
        if (isNew && currentWarehouse && !doc.set_warehouse) {
            setDoc(prev => ({
                ...prev,
                set_warehouse: currentWarehouse
            }));
        }
    }, [currentWarehouse, isNew]);

    // Fetch read-only source buying & selling prices for items
    useEffect(() => {
        if (doc?.items && doc.items.length > 0 && doc.set_from_warehouse) {
            fetchSourcePrices();
        }
    }, [doc?.items, doc?.set_from_warehouse]);

    const fetchSourcePrices = async () => {
        if (!doc?.items) return;
        const prices = {};
        for (const it of doc.items) {
            if (!it.item_code) continue;
            try {
                const r = await axios.get(`${API_PATH}.get_retail_item_details`, {
                    params: { searchTerm: it.item_code, warehouse: doc.set_from_warehouse },
                    headers: { 'X-Frappe-SID': getSession() },
                    withCredentials: true
                });
                const details = r.data?.message?.[0];
                const whDetail = details?.warehouse_details?.find(w => w.warehouse === doc.set_from_warehouse);
                prices[it.item_code] = {
                    buying_price: whDetail?.buying_price || details?.valuation_rate || 0,
                    selling_price: whDetail?.selling_price || details?.price_list_rate || 0
                };
            } catch (e) {
                console.error(e);
            }
        }
        setSourcePrices(prices);
    };

    // State to store pieces_per_box fetched from Item master
    const [itemPcsPerBox, setItemPcsPerBox] = useState({});

    // Sync selling prices from doc when it arrives (with Box & Nos support)
    // Also fetch custom_pieces_per_box from Item master
    useEffect(() => {
        if (doc?.status === 'Transferred' && doc?.items) {
            // Fetch pieces_per_box from Item master for each item
            const fetchPcsPerBox = async () => {
                const pcsMap = {};
                for (const it of doc.items) {
                    if (!it.item_code) continue;
                    try {
                        const r = await axios.get(`/api/resource/Item/${encodeURIComponent(it.item_code)}`, {
                            params: { fields: JSON.stringify(["custom_pieces_per_box"]) },
                            headers: { 'X-Frappe-SID': getSession() },
                            withCredentials: true
                        });
                        pcsMap[it.item_code] = r.data?.data?.custom_pieces_per_box || 1;
                    } catch (e) {
                        pcsMap[it.item_code] = 1;
                    }
                }
                setItemPcsPerBox(pcsMap);

                // Now set initial selling prices using fetched pcs_per_box
                const prices = {};
                doc.items.forEach(it => {
                    const ppb = pcsMap[it.item_code] || 1;
                    prices[it.item_code] = {
                        Nos: it.rate || 0,
                        Box: (it.rate || 0) * ppb
                    };
                });
                setSellingPrices(prices);
            };
            fetchPcsPerBox();
        }
    }, [doc]);

    const getSession = () => localStorage.getItem('session') || '';

    const fetchWarehouses = async () => {
        try {
            const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses', {
                headers: { 'X-Frappe-SID': getSession() },
                withCredentials: true
            });
            const list = res.data?.message || res.data || [];
            const results = list.map(w => ({
                value: w.name,
                label: w.warehouse_name || w.name
            }));
            setWarehouses(results);
        } catch (err) {
            console.error("Failed to fetch warehouses:", err);
            setWarehouses([]);
        }
    };

    const fetchRequest = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_PATH}.get_inter_branch_requests`, {
                params: { search: name },
                withCredentials: true, headers: { 'X-Frappe-SID': getSession() }
            });
            const data = res.data?.message;
            if (data) {
                const loadedDoc = data.data || (Array.isArray(data) ? data[0] : data);
                if (loadedDoc && typeof loadedDoc === 'object') {
                    setDoc(loadedDoc);
                    setIsViewOnly(Boolean(loadedDoc.docstatus > 0));
                }
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleAddItemRow = () => {
        setDoc(prev => ({
            ...prev,
            items: [...(prev.items || []), { item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0, rate: 0 }]
        }));
    };

    const handleRemoveItemRow = (idx) => {
        const newItems = [...(doc.items || [])];
        if (newItems.length <= 1) {
            // If only 1 row, clear it out instead of deleting so the user still has an empty row to type in
            newItems[0] = { item_code: '', item_name: '', qty: 1, uom: '', source_stock: 0, rate: 0 };
        } else {
            newItems.splice(idx, 1);
        }
        setDoc(prev => ({ ...prev, items: newItems }));
    };

    const handleItemSelect = async (it, idx) => {
        const newItems = [...(doc.items || [])];
        newItems[idx] = {
            ...newItems[idx],
            item_code: it.name,
            item_name: it.item_name || it.name,
            uom: it.stock_uom || 'Nos',
            rate: it.last_buying_rate || it.valuation_rate || it.rate || 0,
            source_stock: 0
        };

        // If source warehouse is already selected, immediately fetch stock from it
        if (doc.set_from_warehouse) {
            try {
                const r = await axios.get(`${API_PATH}.get_retail_item_details`, {
                    params: { searchTerm: it.name, warehouse: doc.set_from_warehouse },
                    headers: { 'X-Frappe-SID': getSession() },
                    withCredentials: true
                });
                const details = r.data?.message?.[0];
                const whDetail = details?.warehouse_details?.find(w => w.warehouse === doc.set_from_warehouse);
                newItems[idx].source_stock = whDetail?.actual_qty || 0;
            } catch (e) {
                console.error(e);
            }
        }

        setDoc(prev => ({ ...prev, items: newItems }));
        setActiveItemIndex(idx);
    };

    const handleBranchSelectFromModal = (wh, stock, price) => {
        const newItems = [...doc.items];
        if (activeItemIndex !== null) {
            newItems[activeItemIndex].source_stock = stock;
            if (price && (!newItems[activeItemIndex].rate || newItems[activeItemIndex].rate === 0)) {
                newItems[activeItemIndex].rate = price;
            }
        }
        setDoc(prev => ({
            ...prev,
            set_from_warehouse: wh,
            items: newItems
        }));
    };

    const handleQtyChange = (val, idx) => {
        const newItems = [...doc.items];
        newItems[idx].qty = parseFloat(val) || 0;
        setDoc(prev => ({ ...prev, items: newItems }));
    };

    const handleSourceWarehouseChange = async (val) => {
        setDoc(prev => ({ ...prev, set_from_warehouse: val }));

        if (val) {
            const updatedItems = await Promise.all(doc.items.map(async (item) => {
                if (!item.item_code) return item;
                try {
                    const r = await axios.get(`${API_PATH}.get_retail_item_details`, {
                        params: { searchTerm: item.item_code, warehouse: val },
                        headers: { 'X-Frappe-SID': getSession() },
                        withCredentials: true
                    });
                    const details = r.data?.message?.[0];
                    const whDetail = details?.warehouse_details?.find(w => w.warehouse === val);
                    return { ...item, source_stock: whDetail?.actual_qty || 0 };
                } catch (e) { return item; }
            }));
            setDoc(prev => ({ ...prev, items: updatedItems }));
        }
    };

    const handleUpdateSellingPrices = async () => {
        try {
            setUpdatingPrices(true);
            const itemsToUpdate = [];
            Object.keys(sellingPrices).forEach(code => {
                if (sellingPrices[code]?.Nos) {
                    itemsToUpdate.push({
                        item_code: code,
                        uom: 'Nos',
                        selling_price: sellingPrices[code].Nos
                    });
                }
                if (sellingPrices[code]?.Box) {
                    itemsToUpdate.push({
                        item_code: code,
                        uom: 'Box',
                        selling_price: sellingPrices[code].Box
                    });
                }
            });

            const res = await axios.post(`${API_PATH}.update_ibt_prices`, {
                items: JSON.stringify(itemsToUpdate),
                warehouse: doc.set_warehouse
            }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

            if (res.data?.message?.status === 'success') {
                Swal.fire('Prices Updated', res.data.message.message, 'success');
            } else {
                Swal.fire('Error', res.data?.message?.message || "Price update failed", 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', "Failed to update price list", 'error');
        } finally {
            setUpdatingPrices(false);
        }
    };

    const handleAcceptStock = async () => {
        let pinTimeout = null;

        const { value: secretKey } = await Swal.fire({
            title: 'Verify & Receive Stock',
            html: `
                <div style="text-align: left; font-size: 13px; color: #334155;">
                    <p style="margin-bottom: 12px; color: #475569; font-weight: 600; line-height: 1.4;">
                        Confirm physical receipt of transferred stock into <strong>${doc.set_warehouse}</strong>.
                    </p>
                    <label style="font-weight: 800; display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; color: #1e293b;">
                        Secret Code / Cashier PIN <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="password" id="swal-receive-pin" class="swal2-input" placeholder="••••" maxlength="10" style="margin: 0; width: 100%; box-sizing: border-box; height: 44px; font-size: 16px; letter-spacing: 0.25em;">
                    
                    <div id="swal-receive-pin-status" style="margin-top: 8px; min-height: 30px;">
                        <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Verify & Receive',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                const pinInput = document.getElementById('swal-receive-pin');
                const statusBox = document.getElementById('swal-receive-pin-status');

                pinInput?.focus();
                pinInput?.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    if (!val) {
                        statusBox.innerHTML = `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>`;
                        return;
                    }

                    statusBox.innerHTML = `<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">⟳ Verifying PIN...</div>`;

                    clearTimeout(pinTimeout);
                    pinTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_collector_by_secret_code?secret_code=${encodeURIComponent(val)}`, {
                                credentials: 'include'
                            });
                            const json = await res.json();
                            const result = json.message || json;
                            if (result.status === 'success' && result.data) {
                                statusBox.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 8px; background: #ecfdf5; border: 1.5px solid #a7f3d0; padding: 6px 10px; border-radius: 8px;">
                                        <div style="width: 20px; height: 20px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">✓</div>
                                        <div>
                                            <div style="font-size: 12px; font-weight: 800; color: #065f46;">${result.data.collector_name}</div>
                                            <div style="font-size: 10px; color: #047857;">Authorized Cashier (${result.data.employee})</div>
                                        </div>
                                    </div>
                                `;
                            } else {
                                statusBox.innerHTML = `
                                    <div style="font-size: 11px; color: #ef4444; font-weight: 700; background: #fef2f2; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px;">
                                        ✕ Invalid Secret Key — Employee Not Recognized
                                    </div>
                                `;
                            }
                        } catch (err) {
                            statusBox.innerHTML = `<div style="font-size: 11px; color: #ef4444; font-weight: 700;">Verification error</div>`;
                        }
                    }, 250);
                });
            },
            preConfirm: () => {
                const pin = document.getElementById('swal-receive-pin')?.value;
                if (!pin || !pin.trim()) {
                    Swal.showValidationMessage('A valid Secret Code PIN is mandatory to receive stock!');
                    return false;
                }
                return pin;
            }
        });

        if (!secretKey) return;

        try {
            setAcceptingStock(true);
            const res = await axios.post(`/api/method/kyle_retail.retail_api.api.accept_and_submit_stock_transfer`, {
                request_name: name,
                secret_key: secretKey
            }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

            if (res.data?.message?.status === 'success') {
                Swal.fire('Accepted!', 'Stock entry submitted and transfer completed.', 'success');
                fetchRequest();
            } else {
                Swal.fire('Failed', res.data?.message?.message || 'Acceptance failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.response?.data?.message || 'Failed to accept stock transfer.', 'error');
        } finally {
            setAcceptingStock(false);
        }
    };

    // ----- SAVE DRAFT (REST API wrapper) -----
    const handleSaveDraft = async () => {
        const validItems = doc.items.filter(i => i.item_code && i.qty > 0);
        if (!doc.set_from_warehouse || validItems.length === 0) {
            Swal.fire('Required', "Source branch and at least one item with quantity are required.", 'warning');
            return;
        }

        const { value: secretKey } = await Swal.fire({
            title: 'Authorization Required',
            input: 'password',
            inputLabel: 'Enter Cashier PIN / Secret Key to Save',
            inputPlaceholder: '••••',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off',
                maxlength: 10
            },
            showCancelButton: true,
            confirmButtonText: 'Verify & Save',
            confirmButtonColor: '#2563eb',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Secret Key PIN is mandatory!';
                }
            }
        });

        if (!secretKey) return;

        try {
            setSaving(true);
            const sid = getSession();
            const headers = { 'Content-Type': 'application/json', 'X-Frappe-SID': sid };

            const res = await axios.post(`${API_PATH}.create_or_submit_inter_branch_request`, {
                items: JSON.stringify(validItems),
                set_from_warehouse: doc.set_from_warehouse,
                set_warehouse: doc.set_warehouse,
                secret_key: secretKey,
                docname: isNew ? null : name,
                submit: 0
            }, { headers, withCredentials: true });

            if (res.data?.message?.status === 'success') {
                const dataName = res.data.message.name;
                Swal.fire({
                    title: 'Saved Draft!',
                    text: `Material Request draft ${dataName} has been saved successfully.`,
                    icon: 'success',
                    timer: 2000
                });
                if (isNew) {
                    navigate(`/interbranchrequest/${dataName}`);
                } else {
                    fetchRequest();
                    setIsViewOnly(true);
                }
            } else {
                Swal.fire('Authentication / Save Failed', res.data?.message?.message || res.data?.message || "Save failed", 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Failed', err.response?.data?.message || err.message || "Save failed", 'error');
        } finally {
            setSaving(false);
        }
    };

    // ----- SUBMIT DRAFT REQUEST WITH MANDATORY SECRET KEY -----
    const handleSubmitRequest = async () => {
        const validItems = doc.items.filter(i => i.item_code && i.qty > 0);
        if (!doc.set_from_warehouse || validItems.length === 0) {
            Swal.fire('Required', "Source branch and at least one item with quantity are required.", 'warning');
            return;
        }

        let resolvedEmpData = null;
        let pinTimeout = null;

        const { value: secretKey } = await Swal.fire({
            title: 'Submit Stock Request',
            html: `
                <div style="text-align: left; font-size: 13px; color: #334155;">
                    <p style="margin-bottom: 14px; color: #475569; font-weight: 600; font-size: 13px; line-height: 1.4;">
                        Submit this stock transfer request to <strong>${doc.set_from_warehouse}</strong>? Once submitted, it cannot be modified.
                    </p>
                    <label style="font-weight: 800; display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; color: #1e293b;">
                        Secret Code / Cashier PIN <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="password" id="swal-submit-pin" class="swal2-input" placeholder="••••" maxlength="10" style="margin: 0; width: 100%; box-sizing: border-box; height: 44px; font-size: 16px; letter-spacing: 0.25em;">
                    
                    <div id="swal-submit-pin-status" style="margin-top: 8px; min-height: 30px;">
                        <div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Verify & Submit Request',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                const pinInput = document.getElementById('swal-submit-pin');
                const statusBox = document.getElementById('swal-submit-pin-status');

                pinInput.focus();
                pinInput.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    resolvedEmpData = null;

                    if (!val) {
                        statusBox.innerHTML = `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Enter PIN to verify employee...</div>`;
                        return;
                    }

                    statusBox.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                            <span style="display: inline-block;">⟳</span> Verifying PIN...
                        </div>
                    `;

                    clearTimeout(pinTimeout);
                    pinTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_collector_by_secret_code?secret_code=${encodeURIComponent(val)}`, {
                                credentials: 'include'
                            });
                            const json = await res.json();
                            const result = json.message || json;
                            if (result.status === 'success' && result.data) {
                                resolvedEmpData = result.data;
                                statusBox.innerHTML = `
                                    <div style="display: flex; align-items: center; gap: 8px; background: #ecfdf5; border: 1.5px solid #a7f3d0; padding: 6px 10px; border-radius: 8px;">
                                        <div style="width: 20px; height: 20px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px;">✓</div>
                                        <div>
                                            <div style="font-size: 12px; font-weight: 800; color: #065f46;">${result.data.collector_name}</div>
                                            <div style="font-size: 10px; color: #047857;">Authorized Employee (${result.data.employee})</div>
                                        </div>
                                    </div>
                                `;
                            } else {
                                statusBox.innerHTML = `
                                    <div style="font-size: 11px; color: #ef4444; font-weight: 700; background: #fef2f2; border: 1px solid #fecaca; padding: 6px 10px; border-radius: 6px;">
                                        ✕ Invalid Secret Key — Employee Not Recognized
                                    </div>
                                `;
                            }
                        } catch (err) {
                            statusBox.innerHTML = `
                                <div style="font-size: 11px; color: #ef4444; font-weight: 700;">
                                    Verification error
                                </div>
                            `;
                        }
                    }, 250);
                });
            },
            preConfirm: () => {
                const pin = document.getElementById('swal-submit-pin').value;
                if (!pin || !pin.trim()) {
                    Swal.showValidationMessage('A valid Secret Code PIN is mandatory to submit!');
                    return false;
                }
                return pin;
            }
        });

        if (!secretKey) return;

        try {
            setSaving(true);
            const sid = getSession();
            const headers = { 'Content-Type': 'application/json', 'X-Frappe-SID': sid };

            const res = await axios.post(`${API_PATH}.create_or_submit_inter_branch_request`, {
                items: JSON.stringify(validItems),
                set_from_warehouse: doc.set_from_warehouse,
                set_warehouse: doc.set_warehouse,
                secret_key: secretKey,
                docname: isNew ? null : name,
                submit: 1
            }, { headers, withCredentials: true });

            if (res.data?.message?.status === 'success') {
                const dataName = res.data.message.name;
                const authBy = res.data.message.authorized_by;
                Swal.fire('Submitted!', `Material Request ${dataName} has been authorized by ${authBy} and submitted successfully to ${doc.set_from_warehouse}.`, 'success');
                if (isNew) {
                    navigate(`/interbranchrequest/${dataName}`);
                } else {
                    fetchRequest();
                }
            } else {
                Swal.fire('Authorization Failed', res.data?.message?.message || res.data?.message || "Submit failed", 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Failed', err.response?.data?.message || err.message || "Submit failed", 'error');
        } finally {
            setSaving(false);
        }
    };

    // ----- DELETE DRAFT REQUEST -----
    const handleDeleteRequest = async () => {
        const result = await Swal.fire({
            title: 'Delete Draft?',
            text: "Are you sure you want to permanently delete this Draft stock request?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Delete'
        });

        if (!result.isConfirmed) return;

        try {
            setSaving(true);
            const sid = getSession();
            const headers = { 'X-Frappe-SID': sid };

            await axios.delete(`/api/resource/Material Request/${name}`, {
                headers,
                withCredentials: true
            });

            Swal.fire('Deleted!', `Material Request ${name} has been deleted successfully.`, 'success');
            navigate('/interbranchrequests');
        } catch (err) {
            console.error(err);
            Swal.fire('Failed', err.response?.data?.message || err.message || "Delete failed", 'error');
        } finally {
            setSaving(false);
        }
    };

    // ----- DUPLICATE REQUEST -----
    const handleDuplicate = () => {
        const clonedItems = (doc.items || []).map(({ name, parent, parenttype, parentfield, creation, modified, ...rest }) => ({
            ...rest,
            source_stock: 0
        }));

        setDoc({
            set_from_warehouse: doc.set_from_warehouse,
            set_warehouse: currentWarehouse,
            items: clonedItems,
            status: 'Draft',
            docstatus: 0
        });

        navigate('/newinterbranchrequest');
        setIsViewOnly(false);
        Swal.fire({
            icon: 'success',
            title: 'Duplicated!',
            text: 'You are now editing a new Draft copy of this request.',
            timer: 2000
        });
    };

    const handleDecision = async (decision) => {
        if (decision === 'accept') {
            // Open the Accept & Transfer modal instead of just asking for PIN
            setShowAcceptModal(true);
            return;
        }

        // Handle reject with Secret Key + Rejection Reason Modal
        const { value: formValues } = await Swal.fire({
            title: 'Reject Stock Request',
            html: `
                <div style="text-align: left; font-size: 13px; color: #334155; margin-bottom: 8px;">
                    <label style="font-weight: 700; display: block; margin-bottom: 4px;">Authorization PIN / Secret Key <span style="color: #ef4444;">*</span></label>
                    <input id="swal-reject-pin" type="password" class="swal2-input" placeholder="Enter Cashier / Manager PIN" style="margin: 0 0 14px 0; width: 100%; box-sizing: border-box; font-size: 13px;">
                    
                    <label style="font-weight: 700; display: block; margin-bottom: 4px;">Rejection Reason <span style="color: #ef4444;">*</span></label>
                    <textarea id="swal-reject-reason" class="swal2-textarea" placeholder="Enter reason (e.g. Out of stock / Low inventory)" style="margin: 0; width: 100%; height: 75px; box-sizing: border-box; font-size: 13px; resize: none;"></textarea>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Confirm Reject',
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const pin = document.getElementById('swal-reject-pin').value;
                const reason = document.getElementById('swal-reject-reason').value;
                if (!pin) {
                    Swal.showValidationMessage('Authorization PIN is required');
                    return false;
                }
                if (!reason || !reason.trim()) {
                    Swal.showValidationMessage('Please enter a rejection reason');
                    return false;
                }
                return { pin, reason };
            }
        });

        if (!formValues) return;

        try {
            setDecisionLoading(decision);
            const res = await axios.post(`${API_PATH}.handle_inter_branch_decision`, {
                request_name: name,
                decision: 'reject',
                comment: formValues.reason,
                secret_key: formValues.pin
            }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

            if (res.data?.message?.status === 'success') {
                Swal.fire('Request Rejected', res.data.message.message, 'success');
                fetchRequest();
            } else {
                Swal.fire('Action Failed', res.data?.message?.message || 'Action failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.response?.data?.message || err.message || 'Request failed', 'error');
        } finally {
            setDecisionLoading(null);
        }
    };

    // Called from AcceptTransferModal when B confirms with PIN and prices
    const handleAcceptWithPrices = async (secretKey, sellingPrices) => {
        setShowAcceptModal(false);
        try {
            setDecisionLoading('accept');
            const res = await axios.post(`${API_PATH}.handle_inter_branch_decision`, {
                request_name: name,
                decision: 'accept',
                secret_key: secretKey,
                selling_prices: JSON.stringify(sellingPrices)
            }, { withCredentials: true, headers: { 'X-Frappe-SID': getSession() } });

            if (res.data?.message?.status === 'success') {
                Swal.fire('Dispatched!', res.data.message.message, 'success');
                fetchRequest();
            } else {
                Swal.fire('Action Failed', res.data?.message?.message || 'Action failed', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.response?.data?.message || 'Request failed', 'error');
        }
        finally { setDecisionLoading(null); }
    };

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={40} /></div>;

    return (
        <div className="ibt-page-wrapper">
            <BranchAvailabilityModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                itemCode={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_code : ''}
                itemName={activeItemIndex !== null ? doc.items[activeItemIndex]?.item_name : ''}
                currentWarehouse={currentWarehouse}
                onSelectBranch={handleBranchSelectFromModal}
            />

            {/* Accept & Transfer Modal for Branch B */}
            <AcceptTransferModal
                isOpen={showAcceptModal}
                onClose={() => setShowAcceptModal(false)}
                items={doc.items || []}
                sourceWarehouse={doc.set_from_warehouse}
                onConfirm={handleAcceptWithPrices}
            />

            {/* Dispatch Prices Modal for Branch A */}
            <DispatchPricesModal
                isOpen={showDispatchPrices}
                onClose={() => setShowDispatchPrices(false)}
                items={doc.items || []}
                sourceWarehouse={doc.set_from_warehouse}
            />

            {/* Header Bar */}
            {/* Header Bar */}
            <div className="ibt-header-bar">
                <div>
                    <h1 className="ibt-title-heading">
                        <ArrowLeftRight size={20} style={{ color: 'var(--ibt-primary)' }} />
                        {isNew ? 'NEW INTER-BRANCH REQUEST' : `INTER-BRANCH REQUEST: ${name}`}
                    </h1>
                    <div className="ibt-status-pill">
                        <div className={`ibt-status-dot ${doc.status === 'Requested' ? 'bg-blue-500' :
                            doc.status === 'Dispatched' ? 'bg-amber-500' :
                                doc.status === 'Transferred' ? 'bg-emerald-500' :
                                    doc.status === 'Stopped' ? 'bg-rose-500' : 'bg-slate-300'
                            }`} />
                        <span className="ibt-status-text">{doc.status || 'Draft'}</span>
                    </div>
                </div>

                {/* DYNAMIC ACTIONS TOOLBAR */}
                <div className="ibt-actions-group">

                    {/* 1. DUPLICATE BUTTON */}
                    {!isNew && (
                        <button
                            onClick={handleDuplicate}
                            className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                        >
                            <Copy size={13} /> Duplicate
                        </button>
                    )}

                    {/* 2. DELETE DRAFT BUTTON */}
                    {!isNew && doc.docstatus === 0 && (
                        <button
                            onClick={handleDeleteRequest}
                            disabled={saving}
                            className="ibt-btn ibt-btn-danger"
                        >
                            <Trash2 size={13} /> Delete Draft
                        </button>
                    )}

                    {/* 3. EDIT DRAFT BUTTON */}
                    {!isNew && doc.docstatus === 0 && isViewOnly && (
                        <button
                            onClick={() => setIsViewOnly(false)}
                            className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                        >
                            <Edit3 size={13} /> Edit Request
                        </button>
                    )}

                    {/* 4. DRAFT PRIMARY CONTROLS (Save & Submit) */}
                    {(!isNew && doc.docstatus === 0 && !isViewOnly) || isNew ? (
                        <>
                            <button
                                onClick={handleSaveDraft}
                                disabled={saving}
                                className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                            >
                                {saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                                {isNew ? 'Save Draft' : 'Save Changes'}
                            </button>

                            {!isNew && (
                                <button
                                    onClick={handleSubmitRequest}
                                    disabled={saving}
                                    className="erp-button erp-button-primary ibt-btn ibt-btn-primary"
                                >
                                    <CheckCircle2 size={13} /> Submit Request
                                </button>
                            )}
                        </>
                    ) : null}

                    {/* 5. DECISION CONTROLS (For Submitted requests) */}
                    {!isNew && doc.docstatus === 1 && (doc.status === 'Requested' || doc.status === 'Pending') ? (
                        <div className="flex items-center gap-2">
                            {doc.set_from_warehouse === currentWarehouse ? (
                                <>
                                    <button
                                        onClick={() => handleDecision('reject')}
                                        disabled={decisionLoading}
                                        className="ibt-btn ibt-btn-danger"
                                    >
                                        <XCircle size={13} /> Stop / Reject
                                    </button>
                                    <button
                                        onClick={() => handleDecision('accept')}
                                        disabled={decisionLoading}
                                        className="erp-button erp-button-primary ibt-btn ibt-btn-primary"
                                    >
                                        <CheckCircle2 size={13} /> Accept & Transfer
                                    </button>
                                </>
                            ) : (
                                <div className="ibt-status-tag-pill ibt-status-tag-blue">
                                    <Loader2 size={12} className="animate-spin" /> Awaiting Branch Approval
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* 6. COMPLETED/CANCELLED INDICATORS */}
                    {!isNew && doc.status === 'Stopped' && (
                        <div className="ibt-status-tag-pill ibt-status-tag-rose">
                            <XCircle size={13} /> Request Stopped
                        </div>
                    )}
                    {!isNew && doc.status === 'Dispatched' && (
                        <div className="flex items-center gap-2">
                            {doc.set_warehouse === currentWarehouse ? (
                                <button
                                    onClick={handleAcceptStock}
                                    disabled={acceptingStock}
                                    className="erp-button erp-button-primary ibt-btn ibt-btn-primary"
                                >
                                    {acceptingStock ? <Loader2 className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
                                    Received
                                </button>
                            ) : (
                                <div className="ibt-status-tag-pill ibt-status-tag-amber">
                                    <Loader2 size={12} className="animate-spin text-amber-500" /> Awaiting Target Acceptance
                                </div>
                            )}
                        </div>
                    )}
                    {!isNew && doc.status === 'Transferred' && (
                        <div className="ibt-status-tag-pill ibt-status-tag-emerald">
                            <CheckCircle2 size={13} /> Transfer Complete
                        </div>
                    )}
                    {/* Stock Entry Link */}
                    {!isNew && doc.custom_stock_entry && (
                        <button
                            onClick={() => navigate(`/stock-entry/${doc.custom_stock_entry}`)}
                            className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                        >
                            <FileText size={13} /> View Stock Entry: {doc.custom_stock_entry}
                        </button>
                    )}
                    {/* View Dispatch Prices Button */}
                    {!isNew && (doc.status === 'Dispatched' || doc.status === 'Transferred') && doc.set_warehouse === currentWarehouse && (
                        <button
                            onClick={() => setShowDispatchPrices(true)}
                            className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                        >
                            <Info size={13} /> View Dispatch Prices
                        </button>
                    )}
                </div>
            </div>

            <div className="ibt-content-container">

                {/* 1. UNIFIED ROUTE & SUMMARY CARD */}
                <div className="ibt-card">
                    <div className="ibt-route-row">
                        {/* Source Branch */}
                        <div className="ibt-route-box">
                            <div className="ibt-route-box-header">
                                <span className="ibt-route-box-label">
                                    <Building2 size={13} className="text-amber-500" /> Source Warehouse
                                </span>
                                {doc.set_from_warehouse === currentWarehouse && (
                                    <span className="ibt-tag-amber">
                                        Your Branch
                                    </span>
                                )}
                            </div>
                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                                <select
                                    value={doc.set_from_warehouse}
                                    onChange={(e) => handleSourceWarehouseChange(e.target.value)}
                                    className="ibt-route-select"
                                >
                                    <option value="">Select source branch...</option>
                                    {warehouses.filter(w => w.value !== currentWarehouse).map(w => (
                                        <option key={w.value} value={w.value}>{w.label || w.value}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="ibt-route-box-value">
                                    {doc.set_from_warehouse || '—'}
                                </div>
                            )}
                        </div>

                        {/* Transfer Direction Arrow */}
                        <div className="hidden md:flex ibt-route-arrow-col">
                            <div className="ibt-route-arrow-circle">
                                <ArrowRight size={16} />
                            </div>
                            <span className="ibt-route-arrow-text">Transfer</span>
                        </div>

                        {/* Destination Branch */}
                        <div className="ibt-route-box">
                            <div className="ibt-route-box-header">
                                <span className="ibt-route-box-label">
                                    <Building2 size={13} style={{ color: 'var(--ibt-primary)' }} /> Destination Warehouse
                                </span>
                                {(doc.set_warehouse === currentWarehouse || doc.warehouse === currentWarehouse) && (
                                    <span className="ibt-tag-emerald">
                                        Requesting Branch (YOU)
                                    </span>
                                )}
                            </div>
                            <div className="ibt-route-box-value">
                                {doc.set_warehouse || doc.warehouse || currentWarehouse}
                            </div>
                        </div>
                    </div>

                    {/* 2. EMPLOYEE AUTHORIZATION TRAIL */}
                    {!isNew && (
                        <div className="ibt-auth-strip">
                            <div className="ibt-auth-item">
                                <div className="ibt-auth-icon-wrap ibt-auth-icon-blue">
                                    <User size={15} />
                                </div>
                                <div className="min-w-0">
                                    <div className="ibt-auth-label">Requested By</div>
                                    <div className="ibt-auth-name">{doc.requested_by_employee_name || 'System'}</div>
                                </div>
                            </div>
                            <div className="ibt-auth-item">
                                <div className="ibt-auth-icon-wrap ibt-auth-icon-amber">
                                    <User size={15} />
                                </div>
                                <div className="min-w-0">
                                    <div className="ibt-auth-label">Dispatched By</div>
                                    <div className="ibt-auth-name">
                                        {doc.dispatched_by_employee_name || (doc.status === 'Dispatched' || doc.status === 'Transferred' ? 'Branch Staff' : 'Pending')}
                                    </div>
                                </div>
                            </div>
                            <div className="ibt-auth-item">
                                <div className="ibt-auth-icon-wrap ibt-auth-icon-emerald">
                                    <User size={15} />
                                </div>
                                <div className="min-w-0">
                                    <div className="ibt-auth-label">Received By</div>
                                    <div className="ibt-auth-name">
                                        {doc.received_by_employee_name || (doc.status === 'Transferred' ? 'Branch Staff' : 'Pending')}
                                    </div>
                                </div>
                            </div>
                            <div className="ibt-auth-item">
                                <div className={`ibt-auth-icon-wrap ${doc.status === 'Stopped' ? 'ibt-auth-icon-rose' : 'ibt-auth-icon-muted'}`}>
                                    {doc.status === 'Stopped' ? <XCircle size={15} /> : <User size={15} />}
                                </div>
                                <div className="min-w-0">
                                    <div className="ibt-auth-label">Rejected By</div>
                                    <div className="ibt-auth-name">
                                        {doc.rejected_by_employee_name || doc.custom_rejected_by || (doc.status === 'Stopped' ? 'Source Staff' : '—')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rejection Banner if Stopped */}
                    {(doc.status === 'Stopped' || doc.custom_rejection_reason) && (
                        <div className="ibt-rejection-banner">
                            <AlertCircle size={16} className="text-rose-500 shrink-0" />
                            <div>
                                <span className="title">Rejection Reason: </span>
                                <span className="desc">{doc.custom_rejection_reason || 'Stock unavailable at source branch.'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. PRODUCT ITEMS CARD */}
                <div className="ibt-card">
                    <div className="ibt-card-header">
                        <div className="ibt-card-title">
                            <Package size={16} />
                            <span>Requested Products ({doc.items?.length || 0})</span>
                        </div>
                        {(isNew || (doc.docstatus === 0 && !isViewOnly)) && (
                            <button
                                onClick={handleAddItemRow}
                                className="erp-button erp-button-secondary ibt-btn ibt-btn-secondary"
                                style={{ height: '2rem', padding: '0 0.75rem', fontSize: '0.75rem' }}
                            >
                                <Plus size={13} /> Add Product
                            </button>
                        )}
                    </div>

                    <div className="ibt-table-wrap">
                        <table className="erp-table ibt-items-table">
                            <thead>
                                <tr>
                                    <th>Product Details</th>
                                    <th style={{ width: '160px', textAlign: 'center' }}>Quantity</th>
                                    {(!isNew && doc.docstatus > 0 && (doc.status === 'Dispatched' || doc.status === 'Transferred')) && (
                                        <th style={{ width: '180px', textAlign: 'right' }}>Selling Price</th>
                                    )}
                                    <th style={{ width: '180px', textAlign: 'right' }}>Source Stock</th>
                                    {(isNew || (doc.docstatus === 0 && !isViewOnly)) && <th style={{ width: '50px' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {doc.items.map((item, idx) => (
                                    <tr key={idx}>
                                        {/* Product Details */}
                                        <td>
                                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                                                <div style={{ maxWidth: '400px' }}>
                                                    <CustomSearchDropdown
                                                        placeholder="Search product..."
                                                        optionsLabel="item_name"
                                                        value={item.item_code ? { name: item.item_code, item_name: item.item_name } : null}
                                                        fetchData={async (q) => {
                                                            const r = await axios.get(`${API_PATH}.get_retail_item_details`, {
                                                                params: { searchTerm: q },
                                                                headers: { 'X-Frappe-SID': getSession() }
                                                            });
                                                            return r.data?.message || [];
                                                        }}
                                                        onSelect={(it) => handleItemSelect(it, idx)}
                                                    />
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="ibt-item-name">{item.item_name}</div>
                                                    <div className="ibt-item-meta">
                                                        <span className="ibt-item-code-badge">
                                                            {item.item_code}
                                                        </span>
                                                        {item.last_purchase_supplier && (
                                                            <span className="ibt-item-supplier-badge">
                                                                Supplier: {item.last_purchase_supplier}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* Quantity */}
                                        <td style={{ textAlign: 'center' }}>
                                            {(isNew || (doc.docstatus === 0 && !isViewOnly)) ? (
                                                <div className="ibt-qty-cell">
                                                    <input
                                                        type="number"
                                                        className="ibt-qty-input"
                                                        value={item.qty === 0 ? '' : item.qty}
                                                        placeholder="0"
                                                        onChange={(e) => handleQtyChange(e.target.value, idx)}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--ibt-text-muted)' }}>
                                                        {item.uom || 'Nos'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="ibt-qty-badge-static">
                                                    <span>{item.qty}</span>
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{item.uom || 'Nos'}</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* Selling Price (Dispatched / Transferred) */}
                                        {(!isNew && doc.docstatus > 0 && (doc.status === 'Dispatched' || doc.status === 'Transferred')) && (
                                            <td>
                                                <div className="ibt-price-cell">
                                                    <div className="ibt-price-val">
                                                        <DirhamIcon size={13} /> {parseFloat(item.rate || 0).toFixed(2)}
                                                    </div>
                                                    <div className="ibt-price-sub">per {item.uom || 'Nos'}</div>
                                                </div>
                                            </td>
                                        )}

                                        {/* Source Stock */}
                                        <td>
                                            <div className="ibt-stock-cell">
                                                <span className={item.source_stock >= item.qty ? 'ibt-stock-pill-ok' : 'ibt-stock-pill-low'}>
                                                    {item.source_stock || 0} in stock
                                                </span>
                                                <span className="ibt-stock-location-sub">
                                                    at {doc.set_from_warehouse?.replace(' - KSPL', '') || 'Source'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Delete Action */}
                                        {(isNew || (doc.docstatus === 0 && !isViewOnly)) && (
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleRemoveItemRow(idx)}
                                                    className="ibt-delete-btn"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. SET LOCAL PRICE LISTS (When Transferred) */}
                {doc.status === 'Transferred' && doc.set_warehouse === currentWarehouse && (
                    <div className="ibt-card">
                        <div className="ibt-card-header">
                            <div className="ibt-card-title">
                                <Save size={16} />
                                <div>
                                    <span>Set Your Local Selling Price</span>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--ibt-text-muted)', textTransform: 'none', fontWeight: 600, marginTop: '2px' }}>
                                        Update local price list to start selling at your counter
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleUpdateSellingPrices}
                                disabled={updatingPrices}
                                className="erp-button erp-button-primary ibt-btn ibt-btn-primary"
                            >
                                {updatingPrices ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                Update Price List
                            </button>
                        </div>

                        <div className="ibt-prices-grid">
                            {doc.items.map((item, idx) => (
                                <div key={idx} className="ibt-price-item-card">
                                    <div className="ibt-price-card-header">
                                        <div className="ibt-price-idx-badge">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="ibt-item-name" style={{ fontSize: '0.825rem' }}>{item.item_name}</div>
                                            <div className="ibt-item-code-badge" style={{ display: 'inline-block', marginTop: '2px' }}>{item.item_code}</div>
                                        </div>
                                    </div>

                                    {/* Source Benchmark Prices */}
                                    <div className="ibt-benchmark-bar">
                                        <div>
                                            <div className="ibt-benchmark-label">Source Buying</div>
                                            <div className="ibt-benchmark-val">AED {(sourcePrices[item.item_code]?.buying_price || 0).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="ibt-benchmark-label">Source Selling</div>
                                            <div className="ibt-benchmark-val">AED {(sourcePrices[item.item_code]?.selling_price || 0).toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Price Inputs */}
                                    <div className="space-y-2">
                                        <div className="ibt-price-field">
                                            <label>Local Price (Nos)</label>
                                            <input
                                                type="number"
                                                value={sellingPrices[item.item_code]?.Nos || ''}
                                                placeholder="0.00"
                                                onChange={(e) => {
                                                    const nosVal = parseFloat(e.target.value) || 0;
                                                    const pcsPerBox = itemPcsPerBox[item.item_code] || 1;
                                                    setSellingPrices(prev => ({
                                                        ...prev,
                                                        [item.item_code]: {
                                                            ...prev[item.item_code],
                                                            Nos: nosVal,
                                                            Box: nosVal * pcsPerBox
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="ibt-price-field">
                                            <label>Local Price (Box)</label>
                                            <input
                                                type="number"
                                                value={sellingPrices[item.item_code]?.Box || ''}
                                                placeholder="0.00"
                                                onChange={(e) => {
                                                    const boxVal = parseFloat(e.target.value) || 0;
                                                    const pcsPerBox = itemPcsPerBox[item.item_code] || 1;
                                                    setSellingPrices(prev => ({
                                                        ...prev,
                                                        [item.item_code]: {
                                                            ...prev[item.item_code],
                                                            Box: boxVal,
                                                            Nos: pcsPerBox > 0 ? boxVal / pcsPerBox : 0
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. ACTIVITY NOTES & AUDIT TIMELINE */}
                {!isNew && (
                    <div className="ibt-card">
                        <div className="ibt-card-header">
                            <div className="ibt-card-title">
                                <MessageSquare size={16} />
                                <span>Activity Notes & Audit Trail</span>
                            </div>
                            <span className="ibt-card-badge">
                                {(doc.comments || []).length} Event(s)
                            </span>
                        </div>

                        <div className="ibt-timeline-container">
                            {(!doc.comments || doc.comments.length === 0) ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.8rem', color: 'var(--ibt-text-muted)' }}>
                                    No activity records available for this request.
                                </div>
                            ) : (
                                <div className="ibt-timeline-list">
                                    {doc.comments.map((c, cIdx) => {
                                        const isReject = c.content?.toLowerCase().includes('reject');
                                        const isReceived = c.content?.toLowerCase().includes('received');
                                        const isAccept = c.content?.toLowerCase().includes('accept') || c.content?.toLowerCase().includes('dispatch');
                                        const isRequest = c.content?.toLowerCase().includes('request');

                                        const dotClass = isReject ? 'reject' : isAccept ? 'pending' : isRequest ? 'request' : isReceived ? '' : '';

                                        return (
                                            <div key={c.name || cIdx} className="ibt-timeline-row">
                                                <div className={`ibt-timeline-dot ${dotClass}`} />
                                                <div className="ibt-timeline-card">
                                                    <div className="ibt-timeline-card-header">
                                                        <span className="ibt-timeline-content">
                                                            {c.content}
                                                        </span>
                                                        {c.creation && (
                                                            <span className="ibt-timeline-date">
                                                                {format(new Date(c.creation), 'MMM dd, yyyy · hh:mm a')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="ibt-timeline-meta">
                                                        <span>Status Event</span>
                                                        {c.comment_by && <span>· {c.comment_by}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default InterBranchTransferDetails;
