import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Package, ArrowLeft, Loader2, AlertCircle, Warehouse, 
    Calendar, Clock, CheckCircle2, FileText, ArrowRight, Activity
} from 'lucide-react';
import POSService from '../../utils/posService';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './SalesOrder.css';
import AttachmentSection from './AttachmentSection';

const StockEntryDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [entry, setEntry] = useState(null);

    // Theme support
    const polTheme = localStorage.getItem('legacySubTheme') || 'green';
    const isGreen = polTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeLight = isGreen ? '#ecfdf5' : '#f0f9ff';

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const res = await POSService.getStockEntryDetails(id);
                if (res.status === 'success') {
                    setEntry(res.message);
                } else {
                    setError(res.message || 'Failed to fetch Stock Entry');
                }
            } catch (err) {
                setError(err.message || 'Error communicating with server');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchDetails();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="so-page flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 size={32} className="animate-spin" style={{ color: themeColor }} />
                    <p className="text-sm font-semibold tracking-wider">Loading Stock Entry...</p>
                </div>
            </div>
        );
    }

    if (error || !entry) {
        return (
            <div className="so-page">
                <div className="so-page-header">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="so-page-title">Stock Entry Not Found</h1>
                    </div>
                </div>
                <div className="p-6">
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 font-medium">
                        <AlertCircle size={18} /> {error || 'Record does not exist.'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-slate-50 pb-12 font-sans">
            
            {/* 1. PREMIUM HEADER */}
            <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 transition-all duration-200 border border-slate-200/60 active:scale-95"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                <Activity size={20} style={{ color: themeColor }} strokeWidth={2.5} />
                                {entry.name}
                            </div>
                            {entry.docstatus === 1 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
                                    <CheckCircle2 size={10} strokeWidth={3} /> Submitted
                                </span>
                            )}
                            {entry.docstatus === 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700 shadow-sm">
                                    Draft
                                </span>
                            )}
                            {entry.docstatus === 2 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-700 shadow-sm">
                                    Cancelled
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
                            {entry.stock_entry_type}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. MAIN LAYOUT GRID */}
            <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start">
                    
                    {/* LEFT PANEL - Logistics & Metadata Details */}
                    <div className="w-full lg:w-[350px] flex flex-col gap-6 shrink-0">
                        
                        {/* Transaction Card */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <FileText size={12} style={{ color: themeColor }} /> Transaction Details
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center border transition-colors" style={{ background: themeLight, borderColor: `${themeColor}20`, color: themeColor }}>
                                        <Calendar size={15} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none mb-1">Posting Date</p>
                                        <p className="text-xs font-bold text-slate-800">{entry.posting_date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-100 bg-slate-50 text-slate-505">
                                        <Clock size={15} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none mb-1">Posting Time</p>
                                        <p className="text-xs font-bold text-slate-800">{entry.posting_time || '--:--'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Branch Movement Timeline Card */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Warehouse size={12} style={{ color: themeColor }} /> Logistics Movement
                            </div>
                            
                            <div className="relative pl-2">
                                {/* From Warehouse */}
                                <div className="flex gap-4 relative z-10 mb-8 items-start">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 bg-slate-50 border border-slate-200 text-slate-600 transition-colors">
                                        <Warehouse size={15} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5 leading-none">Source Branch (From)</p>
                                        <p className="text-xs font-bold text-slate-800 truncate" title={entry.from_warehouse || 'N/A'}>
                                            {entry.from_warehouse ? entry.from_warehouse.replace(/\s*-\s*\w+$/, '') : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Connecting Timeline Line */}
                                <div className="absolute left-6.5 top-8 bottom-8 w-0.5 border-l-2 border-dashed border-slate-200 z-0" style={{ left: '25px' }}></div>

                                {/* To Warehouse */}
                                <div className="flex gap-4 relative z-10 items-start">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 border transition-all" style={{ background: themeLight, borderColor: `${themeColor}40`, color: themeColor }}>
                                        <Warehouse size={15} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5 leading-none">Destination Branch (To)</p>
                                        <p className="text-xs font-bold truncate" style={{ color: themeColor }} title={entry.to_warehouse || 'N/A'}>
                                            {entry.to_warehouse ? entry.to_warehouse.replace(/\s*-\s*\w+$/, '') : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT PANEL - Transferred Items Table */}
                    <div className="w-full lg:flex-1">
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <Package size={15} style={{ color: themeColor }} /> Transferred Items
                                </div>
                                <span className="text-[10px] font-extrabold px-2.5 py-1 bg-slate-200/60 text-slate-700 rounded-lg uppercase tracking-wider">
                                    {entry.items?.length || 0} Line(s)
                                </span>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-55/10 bg-slate-50 text-left">
                                            <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Item Details</th>
                                            {(!entry.from_warehouse || !entry.to_warehouse) && (
                                                <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Specific Warehouse</th>
                                            )}
                                            <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right" style={{ width: '120px' }}>Quantity</th>
                                            <th className="px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-right" style={{ width: '150px' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {entry.items?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                <td className="px-5 py-4">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-800 mb-0.5">{item.item_name}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">{item.item_code}</div>
                                                    </div>
                                                </td>
                                                
                                                {/* Fallback column if global warehouses are null */}
                                                {(!entry.from_warehouse || !entry.to_warehouse) && (
                                                    <td className="px-5 py-4">
                                                        <div className="text-[10px] font-bold text-slate-500 space-y-0.5">
                                                            {item.s_warehouse && (
                                                                <div className="flex gap-1 items-center">
                                                                    <span className="text-slate-400 uppercase text-[9px]">From:</span> 
                                                                    <span className="truncate max-w-[150px]" title={item.s_warehouse}>{item.s_warehouse.replace(/\s*-\s*\w+$/, '')}</span>
                                                                </div>
                                                            )}
                                                            {item.t_warehouse && (
                                                                <div className="flex gap-1 items-center">
                                                                    <span className="text-slate-400 uppercase text-[9px]">To:</span> 
                                                                    <span className="truncate max-w-[150px] font-semibold" style={{ color: themeColor }} title={item.t_warehouse}>{item.t_warehouse.replace(/\s*-\s*\w+$/, '')}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}

                                                <td className="px-5 py-4 text-right">
                                                    <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-1 text-xs font-extrabold text-slate-800">
                                                        {item.qty} 
                                                        <span className="text-[9px] text-slate-450 uppercase text-slate-400 font-bold ml-0.5">{item.uom}</span>
                                                    </span>
                                                </td>
                                                
                                                <td className="px-5 py-4 text-right">
                                                    <div className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1">
                                                        <DirhamIcon size={11} className="text-slate-450 text-slate-400" />
                                                        {(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {entry.items?.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-16 text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50/10">
                                                    No items found in this entry.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 border-t border-slate-100 font-extrabold text-slate-800">
                                            <td colSpan={(!entry.from_warehouse || !entry.to_warehouse) ? 2 : 1} className="px-5 py-4 text-[10px] font-black text-slate-450 uppercase tracking-wider text-right">
                                                Total Summary
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="bg-slate-200/60 border border-slate-300/40 rounded-lg px-2.5 py-1 text-xs font-black text-slate-800">
                                                    {entry.total_qty || entry.items?.reduce((a,b) => a + (b.qty || 0), 0)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="text-sm font-black flex items-center justify-end gap-1" style={{ color: themeColor }}>
                                                    <DirhamIcon size={13} style={{ color: themeColor }} />
                                                    {(entry.total_amount || entry.items?.reduce((a,b) => a + (b.amount || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Attachments Section */}
                        <AttachmentSection doctype="Stock Entry" docname={entry.name} />
                    </div>

                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                .so-page { --primary-color: ${themeColor}; }
            `}} />
        </div>
    );
};

export default StockEntryDetails;
