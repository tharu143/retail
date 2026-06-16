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
        <div className="so-page" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {/* 1. HEADER */}
            <div className="so-page-header shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="so-page-title text-xl flex items-center gap-2">
                                <Activity size={22} style={{ color: themeColor }} />
                                {entry.name}
                            </h1>
                            {entry.docstatus === 1 && <span className="so-badge so-badge-submitted"><CheckCircle2 size={12} /> Submitted</span>}
                            {entry.docstatus === 0 && <span className="so-badge so-badge-draft">Draft</span>}
                            {entry.docstatus === 2 && <span className="so-badge so-badge-cancelled">Cancelled</span>}
                        </div>
                        <p className="so-page-subtitle mt-1 text-slate-500 text-sm">
                            {entry.stock_entry_type}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. MAIN CONTENT */}
            <div className="so-layout flex-1 p-6" style={{ minHeight: 0, overflowY: 'auto' }}>
                <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
                    
                    {/* LEFT COLUMN - Branch & Meta Details */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-6">
                        
                        {/* Transaction Card */}
                        <div className="so-table-card p-5 border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText size={14} /> Transaction Details
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: themeLight, color: themeColor }}>
                                        <Calendar size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posting Date</p>
                                        <p className="text-sm font-semibold text-slate-700">{entry.posting_date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-500">
                                        <Clock size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posting Time</p>
                                        <p className="text-sm font-semibold text-slate-700">{entry.posting_time || '--:--'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Branch Details Card */}
                        <div className="so-table-card p-5 border border-slate-100 bg-gradient-to-b from-slate-50 to-white">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                                <Warehouse size={14} /> Branch Movement
                            </h3>
                            
                            <div className="relative">
                                {/* From Warehouse */}
                                <div className="flex gap-4 relative z-10 mb-8">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-white border-2 border-slate-100 text-slate-500">
                                        <ArrowRight size={18} className="rotate-45 opacity-50" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Source Branch (From)</p>
                                        <p className="text-sm font-bold text-slate-800">{entry.from_warehouse || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Connecting Line */}
                                <div className="absolute left-5 top-10 bottom-10 w-0.5 bg-slate-200 z-0"></div>

                                {/* To Warehouse */}
                                <div className="flex gap-4 relative z-10">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm shrink-0 bg-white border-2" style={{ borderColor: themeLight, color: themeColor }}>
                                        <Warehouse size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Destination Branch (To)</p>
                                        <p className="text-sm font-bold text-slate-800" style={{ color: themeColor }}>{entry.to_warehouse || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attachments Section */}
                        <AttachmentSection doctype="Stock Entry" docname={entry.name} />
                    </div>

                    {/* RIGHT COLUMN - Items Table */}
                    <div className="w-full lg:w-2/3 flex flex-col">
                        <div className="so-table-card flex-1 flex flex-col border border-slate-100">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Package size={14} /> Transferred Items
                                </h3>
                                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                                    {entry.items?.length || 0} Line(s)
                                </span>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="so-table w-full">
                                    <thead>
                                        <tr>
                                            <th>Item Details</th>
                                            {(!entry.from_warehouse || !entry.to_warehouse) && <th>Specific Warehouse</th>}
                                            <th className="text-right">Qty</th>
                                            <th className="text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entry.items?.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800">{item.item_name}</div>
                                                        <div className="text-xs font-medium text-slate-500 font-monospace mt-0.5">{item.item_code}</div>
                                                    </div>
                                                </td>
                                                
                                                {/* Fallback column if the header doesn't specify global warehouses */}
                                                {(!entry.from_warehouse || !entry.to_warehouse) && (
                                                    <td>
                                                        <div className="text-[11px] font-medium text-slate-500">
                                                            {item.s_warehouse && <div className="flex gap-1 items-center"><span className="text-slate-400">From:</span> {item.s_warehouse}</div>}
                                                            {item.t_warehouse && <div className="flex gap-1 items-center mt-0.5"><span className="text-slate-400">To:</span> <span style={{ color: themeColor }}>{item.t_warehouse}</span></div>}
                                                        </div>
                                                    </td>
                                                )}

                                                <td className="text-right">
                                                    <div className="text-sm font-bold text-slate-800">{item.qty}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{item.uom}</div>
                                                </td>
                                                <td className="text-right">
                                                    <div className="text-sm font-bold text-slate-800 flex items-center justify-end gap-1">
                                                        <DirhamIcon size={12} className="text-slate-400" />
                                                        {(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {entry.items?.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-center py-12 text-slate-400 text-sm">
                                                    No items found in this entry.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50/80">
                                            <td colSpan={(!entry.from_warehouse || !entry.to_warehouse) ? 2 : 1} className="text-right font-bold text-slate-500 text-xs uppercase tracking-wider">
                                                Total
                                            </td>
                                            <td className="text-right font-black text-slate-800">
                                                {entry.total_qty || entry.items?.reduce((a,b) => a + (b.qty || 0), 0)}
                                            </td>
                                            <td className="text-right font-black text-slate-800 flex items-center justify-end gap-1">
                                                <DirhamIcon size={14} className="text-slate-400" />
                                                {(entry.total_amount || entry.items?.reduce((a,b) => a + (b.amount || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
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
