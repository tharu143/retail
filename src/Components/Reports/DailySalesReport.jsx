import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Filter, RefreshCw, Printer, ChevronDown, 
    TrendingUp, DollarSign, Clock, User, Shield, CreditCard, ChevronRight, HelpCircle,
    ArrowUpRight, Receipt, Landmark, Smartphone, Tag, Gift, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { ExternalLink } from 'lucide-react';
import './DailySalesReport.css';

const UAE_DENOMS = [
    { value: 1000, label: '1000 AED' },
    { value: 500, label: '500 AED' },
    { value: 200, label: '200 AED' },
    { value: 100, label: '100 AED' },
    { value: 50, label: '50 AED' },
    { value: 20, label: '20 AED' },
    { value: 10, label: '10 AED' },
    { value: 5, label: '5 AED' },
    { value: 1, label: '1 AED' },
    { value: 0.50, label: '0.50 AED' },
    { value: 0.25, label: '0.25 AED' }
];

function DailySalesReport() {
    const navigate = useNavigate();
    const dateInputRef = useRef(null);

    // Get Redux values
    const { warehouse, user_roles } = useSelector((state) => state.user || {});
    const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

    // States
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState({ openings: [], closings: [], invoices: [] });
    const [activeTab, setActiveTab] = useState('invoices'); // invoices, openings, closings

    const getSession = () => localStorage.getItem('session') || '';
    const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

    useEffect(() => {
        if (isAdmin) {
            fetchWarehouses();
        } else if (warehouse) {
            setSelectedBranch(warehouse);
        }
    }, [isAdmin, warehouse]);

    useEffect(() => {
        fetchDailyReport();
    }, [selectedDate, selectedBranch]);

    const fetchWarehouses = async () => {
        try {
            const res = await fetch(`${API_PATH}.get_company_warehouses`, {
                headers: { 'X-Frappe-SID': getSession() },
                credentials: 'include'
            });
            if (res.ok) {
                const json = await res.json();
                const list = json.message || json.data || [];
                setWarehouses(list.map(w => ({
                    value: w.name,
                    label: w.warehouse_name || w.name
                })));
            }
        } catch (err) {
            console.error("Failed to fetch warehouses:", err);
        }
    };

    const fetchDailyReport = async () => {
        setLoading(true);
        setError('');
        try {
            const branchToQuery = isAdmin ? selectedBranch : warehouse;
            const params = new URLSearchParams({
                date: selectedDate,
                warehouse: branchToQuery || ''
            });

            const res = await fetch(`${API_PATH}.get_daily_sales_report?${params.toString()}`, {
                headers: { 'X-Frappe-SID': getSession() },
                credentials: 'include'
            });

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const json = await res.json();
            const result = json.message || json;

            if (result.status === 'success') {
                setData(result);
            } else {
                setError(result.message || 'Failed to query daily stats');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate aggregated daily metric totals
    const totalInvoicesCount = data.invoices?.length || 0;
    const totalRevenue = data.invoices?.reduce((sum, inv) => sum + (inv.grand_total || 0), 0) || 0;
    
    // Detailed payment modes calculation
    const getPaymentTotals = (invoices) => {
        let cash = 0;
        let card = 0;
        let instapay = 0;
        let bank = 0;
        let credit = 0;
        let total = 0;
        let netTotal = 0;
        let loyaltyAmount = 0;
        let discountAmount = 0;

        invoices?.forEach(inv => {
            netTotal += (inv.net_total || 0);
            loyaltyAmount += (inv.loyalty_amount || 0);
            discountAmount += (inv.discount_amount || 0);

            if (inv.outstanding_amount > 0) {
                credit += (inv.outstanding_amount || 0);
            }

            inv.payments?.forEach(p => {
                const mode = (p.mode_of_payment || '').toLowerCase().trim();
                const amt = p.amount || 0;
                total += amt;
                
                if (mode === 'cash') {
                    cash += amt;
                } else if (mode.includes('card') || mode.includes('visa') || mode.includes('master')) {
                    card += amt;
                } else if (mode.includes('insta')) {
                    instapay += amt;
                } else if (mode.includes('bank') || mode.includes('transfer') || mode.includes('wire')) {
                    bank += amt;
                } else if (mode.includes('credit')) {
                    // Handled via outstanding_amount above or direct payment
                } else {
                    cash += amt;
                }
            });
        });

        return { cash, card, instapay, bank, credit, total, netTotal, loyaltyAmount, discountAmount };
    };

    const totals = getPaymentTotals(data.invoices);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="dsr-container">
            
            {/* Top Bar / Header */}
            <header className="dsr-header no-print">
                <div className="dsr-header-title-box">
                    <div className="dsr-icon-badge">
                        <TrendingUp size={24} className="stroke-[2.5]" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 className="dsr-title">Daily Shift & Sales Report</h1>
                            <span className="dsr-live-tag">Live Audit</span>
                        </div>
                        <p className="dsr-subtitle">Shift float opening counts, daily sales payments, and closing reconciliations</p>
                    </div>
                </div>

                <div className="dsr-actions">
                    <button 
                        onClick={handlePrint}
                        className="dsr-btn-print"
                    >
                        <Printer size={15} /> 
                        <span>Print Report</span>
                    </button>
                    <button 
                        onClick={fetchDailyReport}
                        disabled={loading}
                        className="dsr-btn-refresh"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> 
                        <span>Refresh</span>
                    </button>
                </div>
            </header>

            {/* Print Only Header */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 p-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Shift & Sales Report</h1>
                        <p className="text-xs text-slate-600 mt-1">Full Audit Summary & Shift Reconciliation</p>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-700">
                        <div><b>Report Date:</b> {selectedDate}</div>
                        <div><b>Branch:</b> {isAdmin ? (selectedBranch || 'All Branches') : warehouse}</div>
                    </div>
                </div>
            </div>

            <main className="dsr-main-body">
                {/* Clean Independent Filters Bar */}
                <div className="dsr-filter-card no-print">
                    <div className="dsr-filter-inputs">
                        {/* Date Input */}
                        <div className="dsr-field-block">
                            <label className="dsr-label">
                                <Calendar size={12} color="#059669" />
                                Select Date
                            </label>
                            <input 
                                ref={dateInputRef}
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="dsr-input"
                                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                            />
                        </div>

                        {/* Branch Selection */}
                        {isAdmin ? (
                            <div className="dsr-field-block" style={{ flex: '1.2 1 240px' }}>
                                <label className="dsr-label">
                                    <Filter size={12} />
                                    Branch / Warehouse
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="dsr-select"
                                        style={{ paddingRight: '2.5rem' }}
                                    >
                                        <option value="">All Branches</option>
                                        {warehouses.map(w => (
                                            <option key={w.value} value={w.value}>{w.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                                </div>
                            </div>
                        ) : (
                            <div className="dsr-field-block" style={{ flex: '1.2 1 240px' }}>
                                <label className="dsr-label">
                                    <Shield size={12} color="#059669" />
                                    Active Branch
                                </label>
                                <div className="dsr-active-branch-box">
                                    <Shield size={14} color="#059669" />
                                    <span>{warehouse || 'Branch User'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setSelectedDate(new Date().toISOString().split('T')[0]);
                            if (isAdmin) setSelectedBranch('');
                        }}
                        className="dsr-btn-reset"
                    >
                        Reset to Today
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* KPI Metrics Cards Grid */}
                <div className="dsr-kpi-grid">
                    {/* 1. Total POS Revenue */}
                    <div className="dsr-kpi-card emerald">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Total POS Revenue</span>
                            <div className="dsr-kpi-icon-pill">
                                <Receipt size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext">
                                Net: AED {totals.netTotal.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* 2. Cash Payments */}
                    <div className="dsr-kpi-card green">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Cash Payments</span>
                            <div className="dsr-kpi-icon-pill">
                                <DollarSign size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#059669' }}>
                                Physical Cash Sales
                            </div>
                        </div>
                    </div>

                    {/* 3. Card Payments */}
                    <div className="dsr-kpi-card blue">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Card Payments</span>
                            <div className="dsr-kpi-icon-pill">
                                <CreditCard size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.card.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#2563eb' }}>
                                Credit / Debit Cards
                            </div>
                        </div>
                    </div>

                    {/* 4. InstaPay Payments */}
                    <div className="dsr-kpi-card cyan">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">InstaPay Payments</span>
                            <div className="dsr-kpi-icon-pill">
                                <Smartphone size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.instapay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#0891b2' }}>
                                InstaPay Transfers
                            </div>
                        </div>
                    </div>

                    {/* 5. Credit Sales */}
                    <div className="dsr-kpi-card amber">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Credit Sales</span>
                            <div className="dsr-kpi-icon-pill">
                                <Clock size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#d97706' }}>
                                Outstanding Credit
                            </div>
                        </div>
                    </div>

                    {/* 6. Loyalty Points */}
                    <div className="dsr-kpi-card purple">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Loyalty Redeemed</span>
                            <div className="dsr-kpi-icon-pill">
                                <Gift size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.loyaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#7c3aed' }}>
                                Points Redeemed
                            </div>
                        </div>
                    </div>

                    {/* 7. Total Discounts */}
                    <div className="dsr-kpi-card pink">
                        <div className="dsr-kpi-header">
                            <span className="dsr-kpi-title">Discounts Given</span>
                            <div className="dsr-kpi-icon-pill">
                                <Tag size={14} />
                            </div>
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} /> 
                                <span>{totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#db2777' }}>
                                Price Discounts
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Bar */}
                <div className="dsr-tab-nav no-print">
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`dsr-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                    >
                        <FileText size={16} /> 
                        <span>Sales Invoices ({data.invoices?.length || 0})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('openings')}
                        className={`dsr-tab-btn ${activeTab === 'openings' ? 'active' : ''}`}
                    >
                        <Clock size={16} /> 
                        <span>Shifts Opened ({data.openings?.length || 0})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('closings')}
                        className={`dsr-tab-btn ${activeTab === 'closings' ? 'active' : ''}`}
                    >
                        <CheckCircle2 size={16} /> 
                        <span>Shifts Closed ({data.closings?.length || 0})</span>
                    </button>
                </div>

                {/* Content Views */}
                {loading ? (
                    <div style={{ padding: '6rem 2rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <Loader2 size={36} color="#10b981" className="animate-spin" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loading daily transactions data...</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* SECTION 1: Sales Invoices */}
                        <div className={`dsr-section-card ${activeTab === 'invoices' ? 'block' : 'hidden print:block'}`}>
                            <div className="dsr-section-header">
                                <h3 className="dsr-section-heading">
                                    <FileText size={18} color="#10b981" />
                                    <span>Sales Invoices Breakdown</span>
                                </h3>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Total: {data.invoices?.length || 0} Invoices</span>
                            </div>

                            {data.invoices?.length === 0 ? (
                                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                                    No sales invoices submitted on this date.
                                </div>
                            ) : (
                                <div>
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                                    <th>Invoice ID</th>
                                                    <th>Customer</th>
                                                    <th>Cashier</th>
                                                    <th>Time</th>
                                                    <th>Payment Breakdown</th>
                                                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.invoices?.map((inv, idx) => (
                                                    <tr key={inv.name}>
                                                        <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 800 }}>{idx + 1}</td>
                                                        <td>
                                                            <span 
                                                                onClick={() => navigate('/salesinvoicelist', { state: { search: inv.name } })} 
                                                                className="dsr-doc-link"
                                                            >
                                                                {inv.name}
                                                                <ExternalLink size={12} color="#10b981" />
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: 800, color: '#1e293b' }}>{inv.customer_name}</td>
                                                        <td style={{ color: '#475569' }}>{inv.owner?.split('@')[0]}</td>
                                                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{inv.posting_time}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                {inv.payments?.map((p, pIdx) => (
                                                                    <span key={pIdx} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                                                                        {p.mode_of_payment}: <b style={{ color: '#0f172a' }}>{p.amount.toFixed(2)}</b>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                                            AED {inv.grand_total.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td style={{ textAlign: 'center' }}>TOTAL</td>
                                                    <td colSpan={4} style={{ color: '#64748b' }}>
                                                        {totalInvoicesCount} Invoices Processed
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {totals.cash > 0 && <span style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 900 }}>Cash: {totals.cash.toFixed(2)}</span>}
                                                            {totals.card > 0 && <span style={{ background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e40af', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 900 }}>Card: {totals.card.toFixed(2)}</span>}
                                                            {totals.bank > 0 && <span style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', color: '#6b21a8', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 900 }}>Bank: {totals.bank.toFixed(2)}</span>}
                                                            {totals.instapay > 0 && <span style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 900 }}>InstaPay: {totals.instapay.toFixed(2)}</span>}
                                                            {totals.credit > 0 && <span style={{ background: '#ffe4e6', border: '1px solid #fda4af', color: '#9f1239', borderRadius: '6px', padding: '2px 7px', fontSize: '0.72rem', fontWeight: 900 }}>Credit: {totals.credit.toFixed(2)}</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '0.95rem' }}>
                                                        AED {totalRevenue.toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    
                                    {/* Summary Cards */}
                                    <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                                        <h4 style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '0.75rem' }}>Daily Payment Mode Summary</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Cash</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 900, color: '#059669', marginTop: '0.2rem' }}>AED {totals.cash.toFixed(2)}</span>
                                            </div>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Card</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }}>AED {totals.card.toFixed(2)}</span>
                                            </div>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Bank Transfer</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 900, color: '#7c3aed', marginTop: '0.2rem' }}>AED {totals.bank.toFixed(2)}</span>
                                            </div>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>InstaPay</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 900, color: '#d97706', marginTop: '0.2rem' }}>AED {totals.instapay.toFixed(2)}</span>
                                            </div>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Credit</span>
                                                <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 900, color: '#e11d48', marginTop: '0.2rem' }}>AED {totals.credit.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* SECTION 2: Shifts Opened */}
                        <div className={`dsr-section-card ${activeTab === 'openings' ? 'block' : 'hidden print:block'}`}>
                            <div className="dsr-section-header">
                                <h3 className="dsr-section-heading">
                                    <Clock size={18} color="#10b981" />
                                    <span>Register Shifts Opened</span>
                                </h3>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{data.openings?.length || 0} Shifts</span>
                            </div>

                            {data.openings?.length === 0 ? (
                                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                                    No shifts opened on this date.
                                </div>
                            ) : (
                                <div>
                                    {data.openings?.map((op) => (
                                        <div key={op.name} className="dsr-shift-card">
                                            <div className="dsr-shift-header">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span 
                                                        onClick={() => navigate('/openingentry', { state: { search: op.name } })} 
                                                        className="dsr-doc-link"
                                                        style={{ fontSize: '0.95rem' }}
                                                    >
                                                        {op.name}
                                                        <ExternalLink size={14} color="#10b981" />
                                                    </span>
                                                    <span className={`dsr-status-badge ${op.status?.toLowerCase() === 'open' ? 'open' : 'closed'}`}>
                                                        {op.status}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><User size={14} color="#94a3b8" /> Cashier: <b style={{ color: '#0f172a' }}>{op.user?.split('@')[0]}</b></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} color="#94a3b8" /> Opened: <b style={{ color: '#0f172a' }}>{new Date(op.period_start_date).toLocaleTimeString()}</b></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CreditCard size={14} color="#94a3b8" /> Profile: <b style={{ color: '#0f172a' }}>{op.pos_profile}</b></div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                                {/* Balances details */}
                                                <div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Payment Mode Starting Floats</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {op.balances?.map((bal, idx) => (
                                                            <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{bal.mode_of_payment}</span>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a' }}>AED {bal.opening_amount.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* UAE currency Denominations list */}
                                                <div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Counted Opening Cash Denominations</span>
                                                    {op.denominations?.length === 0 ? (
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>No denominations recorded.</div>
                                                    ) : (
                                                        <div className="dsr-denom-grid">
                                                            {op.denominations?.map((den, idx) => (
                                                                <div key={idx} className="dsr-denom-box">
                                                                    <span className="dsr-denom-label">{den.denomination} AED</span>
                                                                    <div className="dsr-denom-count">{den.count} <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>qty</span></div>
                                                                    <span className="dsr-denom-total">AED {den.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SECTION 3: Shifts Closed */}
                        <div className={`dsr-section-card ${activeTab === 'closings' ? 'block' : 'hidden print:block'}`}>
                            <div className="dsr-section-header">
                                <h3 className="dsr-section-heading">
                                    <CheckCircle2 size={18} color="#10b981" />
                                    <span>Register Shifts Closed & Reconciled</span>
                                </h3>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{data.closings?.length || 0} Closed Shifts</span>
                            </div>

                            {data.closings?.length === 0 ? (
                                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                                    No shifts closed on this date.
                                </div>
                            ) : (
                                <div>
                                    {data.closings?.map((cl) => (
                                        <div key={cl.name} className="dsr-shift-card">
                                            <div className="dsr-shift-header">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span 
                                                        onClick={() => navigate('/closingentrylist', { state: { search: cl.name } })} 
                                                        className="dsr-doc-link"
                                                        style={{ fontSize: '0.95rem' }}
                                                    >
                                                        {cl.name}
                                                        <ExternalLink size={14} color="#10b981" />
                                                    </span>
                                                    <span 
                                                        onClick={() => navigate('/openingentry', { state: { search: cl.pos_opening_entry } })} 
                                                        style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        Opening: {cl.pos_opening_entry}
                                                        <ExternalLink size={10} color="#64748b" />
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><User size={14} color="#94a3b8" /> Closed By: <b style={{ color: '#0f172a' }}>{cl.user?.split('@')[0]}</b></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Clock size={14} color="#94a3b8" /> Closed: <b style={{ color: '#0f172a' }}>{new Date(cl.period_end_date).toLocaleTimeString()}</b></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CreditCard size={14} color="#94a3b8" /> Profile: <b style={{ color: '#0f172a' }}>{cl.pos_profile}</b></div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                                {/* Reconciliation breakdown details */}
                                                <div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Payment Mode Reconciliation</span>
                                                    <div className="dsr-table-wrapper">
                                                        <table className="dsr-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Mode</th>
                                                                    <th style={{ textAlign: 'right' }}>Opening</th>
                                                                    <th style={{ textAlign: 'right' }}>Expected</th>
                                                                    <th style={{ textAlign: 'right' }}>Counted</th>
                                                                    <th style={{ textAlign: 'right' }}>Variance</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {cl.reconciliation?.map((r, rIdx) => (
                                                                    <tr key={rIdx}>
                                                                        <td style={{ fontWeight: 800 }}>{r.mode_of_payment}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(r.opening_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(r.expected_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: '#0f172a' }}>{(r.closing_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ 
                                                                            textAlign: 'right', 
                                                                            fontFamily: 'monospace', 
                                                                            fontWeight: 900,
                                                                            color: r.difference > 0 ? '#e11d48' : r.difference < 0 ? '#059669' : '#94a3b8',
                                                                            background: r.difference > 0 ? '#fff1f2' : r.difference < 0 ? '#f0fdf4' : 'transparent'
                                                                        }}>
                                                                            {r.difference !== 0 ? (r.difference > 0 ? `-${r.difference.toFixed(2)}` : `+${Math.abs(r.difference).toFixed(2)}`) : '0.00'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Discrepancy Reason */}
                                                    {cl.discrepancy_reason && (
                                                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: '#e11d48', display: 'block' }}>Variance Reason</span>
                                                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9f1239', margin: '0.2rem 0 0 0' }}>"{cl.discrepancy_reason}"</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* UAE currency closing denominations counted list */}
                                                <div>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>Counted Closing Cash Denominations</span>
                                                    {cl.denominations?.length === 0 ? (
                                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>No closing denominations recorded.</div>
                                                    ) : (
                                                        <div className="dsr-denom-grid">
                                                            {cl.denominations?.map((den, idx) => (
                                                                <div key={idx} className="dsr-denom-box">
                                                                    <span className="dsr-denom-label">{den.denomination} AED</span>
                                                                    <div className="dsr-denom-count">{den.count} <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>qty</span></div>
                                                                    <span className="dsr-denom-total">AED {den.amount.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </main>
        </div>
    );
}

export default DailySalesReport;
