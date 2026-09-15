import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    Plus, Search, Calendar, Filter, Loader2, ArrowRightLeft, 
    ArrowRight, ChevronRight, FileText, Activity, Palette, Warehouse, ShieldAlert, Package, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import POSService from '../../utils/posService';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './SalesOrder.css';

function StockEntryList() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    
    // Theme support
    const polTheme = localStorage.getItem('legacySubTheme') || 'blue';
    const isGreen = polTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0082f6';
    const themeLight = isGreen ? '#ecfdf5' : '#f0f9ff';

    const { warehouse, user_roles } = useSelector(state => state.user || {});
    const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

    useEffect(() => {
        fetchStockEntries();
    }, [searchTerm, selectedType, selectedStatus]);

    const fetchStockEntries = async () => {
        try {
            setLoading(true);
            const res = await POSService.getStockEntries({
                searchTerm: searchTerm || undefined,
                status: selectedStatus || undefined,
                stock_entry_type: selectedType || undefined,
                warehouse: !isAdmin ? warehouse : undefined
            });
            if (res.status === 'success') {
                setEntries(res.message || []);
            } else {
                setEntries([]);
            }
        } catch (err) {
            console.error('Failed to fetch stock entries:', err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (docstatus) => {
        switch (docstatus) {
            case 1: // Submitted
                return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', label: 'Submitted' };
            case 0: // Draft
                return { bg: '#eff6ff', text: '#1d4ed8', border: '#dbeafe', label: 'Draft' };
            case 2: // Cancelled
                return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', label: 'Cancelled' };
            default:
                return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', label: 'Unknown' };
        }
    };

    return (
        <div className="so-page" style={{ background: '#f1f5f9', overflowY: 'auto', display: 'block', minHeight: '100vh' }}>
            {/* Page Header */}
            <div className="so-page-header" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <Package size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
                        <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                            STOCK ENTRIES
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginLeft: '4px' }}>
                            {entries.length} RECORDS
                        </span>
                    </h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                        Manage inventory stock movements, transfers &amp; receipts
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={fetchStockEntries}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#475569', cursor: 'pointer', textTransform: 'uppercase' }}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> REFRESH
                    </button>
                </div>
            </div>

            <div style={{ padding: '1.5rem 2rem' }}>
                {/* Filter Bar */}
                <div className="so-content" style={{ padding: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                        {/* Search Input */}
                        <div className="relative" style={{ position: 'relative', flex: '1 1 250px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                className="so-input"
                                style={{ paddingLeft: '2.75rem' }}
                                placeholder="Search Stock Entry ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Stock Entry Type Filter */}
                        <div style={{ flex: '1 1 200px' }}>
                            <select 
                                className="so-input" 
                                value={selectedType}
                                onChange={e => setSelectedType(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">All Entry Types</option>
                                <option value="Material Transfer">Material Transfer</option>
                                <option value="Material Receipt">Material Receipt</option>
                                <option value="Material Issue">Material Issue</option>
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div style={{ flex: '1 1 200px' }}>
                            <select 
                                className="so-input" 
                                value={selectedStatus}
                                onChange={e => setSelectedStatus(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Table Card */}
                    <div className="so-table-card">
                        <div className="so-table-wrapper">
                            <table className="so-table">
                                <thead>
                                    <tr>
                                        <th>Stock Entry ID</th>
                                        <th>Type</th>
                                        <th>Source Warehouse</th>
                                        <th>Target Warehouse</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'center' }}>Total Qty</th>
                                        <th style={{ textAlign: 'right' }}>Total Value</th>
                                        <th style={{ textAlign: 'right' }}>Date</th>
                                        <th style={{ textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                                                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                                            </td>
                                        </tr>
                                    ) : entries.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>
                                                NO STOCK ENTRIES FOUND
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry) => {
                                            const style = getStatusStyle(entry.docstatus);
                                            return (
                                                <tr 
                                                    key={entry.name} 
                                                    onClick={() => navigate(`/stock-entry/${entry.name}`)}
                                                    className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                                >
                                                    {/* ID */}
                                                    <td>
                                                        <span style={{ fontWeight: 800, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                                                            {entry.name}
                                                        </span>
                                                    </td>

                                                    {/* Type */}
                                                    <td style={{ fontWeight: 700, color: '#334155', fontSize: '13px' }}>
                                                        {entry.stock_entry_type}
                                                    </td>

                                                    {/* From */}
                                                    <td style={{ fontSize: '13px', color: '#475569' }}>
                                                        {entry.from_warehouse || '--'}
                                                    </td>

                                                    {/* To */}
                                                    <td style={{ fontSize: '13px', color: '#475569' }}>
                                                        {entry.to_warehouse || '--'}
                                                    </td>

                                                    {/* Status */}
                                                    <td>
                                                        <span 
                                                            className="so-badge"
                                                            style={{
                                                                backgroundColor: style.bg, 
                                                                color: style.text, 
                                                                borderColor: style.border,
                                                                border: `1px solid ${style.border}`
                                                            }}
                                                        >
                                                            {style.label}
                                                        </span>
                                                    </td>

                                                    {/* Qty */}
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                                                        {entry.total_qty}
                                                    </td>

                                                    {/* Value */}
                                                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <DirhamIcon size={12} className="text-slate-400" />
                                                            {(entry.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </td>

                                                    {/* Date */}
                                                    <td style={{ textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                                        {entry.posting_date && format(new Date(entry.posting_date), 'dd MMM yyyy')}
                                                    </td>

                                                    {/* Actions */}
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button 
                                                            className="so-btn-secondary"
                                                            style={{ fontSize: '0.65rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/stock-entry/${entry.name}`); }}
                                                        >
                                                            Details <ChevronRight size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StockEntryList;
